import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateSmokeResult } from "@solid-ground/schema";
import type {
  PackageRecord,
  SmokeResult,
  SolidState,
} from "@solid-ground/schema";
import { checkControls, controlCells, isControlResult } from "./controls.js";
import { artifactId, cellId, planBatch } from "./plan.js";
import type { CellSource, SmokeCell, SmokeSteps } from "./plan.js";
import { CONTROL_HISTORY_FILE, loadPolicy, publishBatch } from "./publish.js";
import {
  DEFAULT_RETENTION_DAYS,
  compactControlLog,
  describeControls,
  readControlLog,
  summarizeControls,
} from "./status.js";

/**
 * The plan, report, publish and status steps of `verify.yml`, on a laptop:
 *
 *   pnpm smoke:plan --data data --packages "@solidjs/meta" --max-cells 3
 *   pnpm smoke:report --dir results --out smoke/results.ndjson
 *   pnpm smoke:publish --data data --results smoke/results.ndjson
 *   pnpm smoke:status
 *
 * Each command is thin: selection lives in `plan.ts`, trust in `controls.ts`,
 * the write path in `publish.ts`, and the audit trail in `status.ts`.
 */

interface PlannedCell extends SmokeCell {
  /** Filesystem-safe identity, used as the CI artifact name. */
  id: string;
  steps: SmokeSteps;
  source: CellSource;
}

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function readJsonFile(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8")) as unknown;
}

async function readRecords(
  dir: string,
  only: string[],
): Promise<PackageRecord[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  const records: PackageRecord[] = [];
  for (const name of names.sort()) {
    if (!name.endsWith(".json")) continue;
    const parsed = (await readJsonFile(path.join(dir, name))) as PackageRecord;
    if (only.length > 0 && !only.includes(parsed.name)) continue;
    records.push(parsed);
  }
  return records;
}

async function readKnown(dir: string): Promise<SmokeResult[]> {
  const names = await readdir(dir).catch(() => [] as string[]);
  const known: SmokeResult[] = [];
  for (const name of names.sort()) {
    if (!name.endsWith(".json")) continue;
    const parsed = await readJsonFile(path.join(dir, name));
    if (validateSmokeResult(parsed).length === 0)
      known.push(parsed as SmokeResult);
  }
  return known;
}

async function planCommand(args: string[]): Promise<number> {
  const dataDir = flagValue(args, "--data") ?? "data";
  const out = flagValue(args, "--out");
  const maxCells = Number(flagValue(args, "--max-cells") ?? "20");
  const only = (flagValue(args, "--packages") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const force = args.includes("--force");
  const includeControls = !args.includes("--no-controls");

  const meta = (await readJsonFile(path.join(dataDir, "meta.json"))) as {
    solid?: SolidState;
  };
  const solid = meta.solid;
  if (!solid?.stable2)
    throw new Error(`${dataDir}/meta.json carries no solid.stable2`);

  const records = await readRecords(path.join(dataDir, "packages"), only);
  const known = await readKnown(path.join(dataDir, "smoke"));
  const planned = planBatch({
    records,
    solid,
    known,
    force,
    maxCells,
    includeNext: args.includes("--include-next"),
  });

  const cells: PlannedCell[] = [];
  if (includeControls) cells.push(...controlCells(solid.stable2));
  for (const cell of planned) {
    const record = records.find((candidate) => candidate.name === cell.name);
    cells.push({
      ...cell,
      id: artifactId(cell),
      // A package without types is `null`, never `false`: the step was not
      // attempted, which is a different fact from a failed type check.
      steps: { import: true, build: true, types: record?.shipsTypes ?? true },
      source: { kind: "registry" },
    });
  }

  const payload = { solid, cells };
  if (out)
    await writeFile(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const controlCount = cells.length - planned.length;
  console.log(
    `planned ${planned.length} package cells and ${controlCount} controls against solid ${solid.stable2}`,
  );
  return 0;
}

/** Every artifact file under a path; `.ndjson` batches and `.json` cells both. */
async function resultFiles(dir: string): Promise<string[]> {
  const info = await stat(dir).catch(() => null);
  if (!info) return [];
  const wanted = (name: string): boolean =>
    name.endsWith(".json") || name.endsWith(".ndjson");
  if (info.isFile()) return wanted(dir) ? [dir] : [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await resultFiles(full)));
    else if (wanted(entry.name)) files.push(full);
  }
  return files;
}

/** Parse one artifact file into results, collecting every problem it carries. */
async function parseResultFile(
  file: string,
): Promise<{ results: SmokeResult[]; failures: string[] }> {
  const results: SmokeResult[] = [];
  const failures: string[] = [];
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    return { results, failures: [`${file}: ${(error as Error).message}`] };
  }
  const values: unknown[] = [];
  if (file.endsWith(".ndjson")) {
    text.split("\n").forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        values.push(JSON.parse(trimmed));
      } catch (error) {
        failures.push(
          `${file}: line ${index + 1}: invalid JSON (${(error as Error).message})`,
        );
      }
    });
  } else {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) values.push(...parsed);
      else values.push(parsed);
    } catch (error) {
      failures.push(`${file}: invalid JSON (${(error as Error).message})`);
    }
  }
  for (const value of values) {
    const messages = validateSmokeResult(value);
    if (messages.length > 0) {
      for (const message of messages) failures.push(`${file}: ${message}`);
      continue;
    }
    results.push(value as SmokeResult);
  }
  return { results, failures };
}

async function readBatch(
  target: string,
): Promise<{ results: SmokeResult[]; failures: string[] }> {
  const results: SmokeResult[] = [];
  const failures: string[] = [];
  for (const file of await resultFiles(target)) {
    const parsed = await parseResultFile(file);
    results.push(...parsed.results);
    failures.push(...parsed.failures);
  }
  return { results, failures };
}

async function reportCommand(args: string[]): Promise<number> {
  const dir = flagValue(args, "--dir") ?? "results";
  const out = flagValue(args, "--out");
  const controlsOut =
    flagValue(args, "--controls-out") ??
    (out ? path.join(path.dirname(out), "controls.jsonl") : undefined);
  const { results, failures } = await readBatch(dir);

  if (!args.includes("--no-controls")) failures.push(...checkControls(results));

  // The control log is written even when the batch is discarded: a failed run
  // is exactly what the two-week audit has to be able to see later.
  const controls = results
    .filter((result) => isControlResult(result))
    .sort((a, b) =>
      a.name === b.name ? a.at.localeCompare(b.at) : a.name.localeCompare(b.name),
    );
  if (controlsOut && controls.length > 0) {
    await mkdir(path.dirname(controlsOut), { recursive: true });
    await writeFile(
      controlsOut,
      `${controls.map((result) => JSON.stringify(result)).join("\n")}\n`,
      "utf8",
    );
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`discard: ${failure}`);
    console.error(
      `batch discarded: ${failures.length} problem(s); no records were written. A batch without trustworthy controls must not change a record.`,
    );
    return 1;
  }

  const sorted = [...results].sort((a, b) =>
    cellId(a).localeCompare(cellId(b)),
  );
  const ndjson = `${sorted.map((result) => JSON.stringify(result)).join("\n")}\n`;
  if (out) {
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, ndjson, "utf8");
  } else {
    process.stdout.write(ndjson);
  }
  console.log(`${results.length} results, controls passed`);
  return 0;
}

async function publishCommand(args: string[]): Promise<number> {
  const dataDir = flagValue(args, "--data") ?? "data";
  const target = flagValue(args, "--results") ?? "smoke/results.ndjson";
  const policy = await loadPolicy(flagValue(args, "--policy") ?? "rules/status-policy.yml");
  const dryRun = args.includes("--dry-run");

  const { results, failures } = await readBatch(target);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`reject: ${failure}`);
    console.error("batch rejected: nothing was written.");
    return 1;
  }
  if (results.length === 0) {
    console.error(`no results in ${target}; nothing to publish`);
    return 1;
  }

  const skipAudit = args.includes("--skip-audit");
  if (skipAudit && !dryRun) {
    console.warn(
      "warning: --skip-audit bypasses the two-week control gate; only a maintainer bootstrap should use it.",
    );
  }
  const outcome = await publishBatch({
    dataDir,
    results,
    policy,
    dryRun,
    requireControls: !args.includes("--no-controls"),
    requireAudit: !skipAudit,
  });

  const prefix = outcome.dryRun ? "would publish" : "published";
  console.log(
    `${prefix}: ${outcome.changed.length} record(s) changed, ${outcome.unchanged} unchanged; ` +
      `${outcome.verified.length} gained verified, ${outcome.withdrawn.length} withdrawn; ` +
      `${outcome.controls} control result(s) recorded`,
  );
  for (const name of outcome.verified) console.log(`  verified: ${name}`);
  for (const name of outcome.withdrawn) console.log(`  withdrawn: ${name}`);
  return 0;
}

async function statusCommand(args: string[]): Promise<number> {
  const file = flagValue(args, "--file") ?? path.join("data", CONTROL_HISTORY_FILE);
  const last = Number(flagValue(args, "--last") ?? "14");
  const { results, summaries } = await readControlLog(file);
  const history = summarizeControls(results);

  if (history.days.length === 0 && summaries.length === 0) {
    console.log(`no control history at ${file} yet`);
    return 0;
  }
  for (const line of describeControls(history, last, summaries)) console.log(line);
  for (const day of history.days.slice(-last)) {
    if (day.clean) continue;
    for (const failure of day.failures) console.log(`  ${day.day}: ${failure}`);
  }
  if (args.includes("--strict") && !(history.days.at(-1) as { clean: boolean }).clean) {
    console.error("the newest control day is not clean");
    return 1;
  }
  return 0;
}

async function compactCommand(args: string[]): Promise<number> {
  const file = flagValue(args, "--file") ?? path.join("data", CONTROL_HISTORY_FILE);
  const retentionDays = Number(
    flagValue(args, "--retention-days") ?? DEFAULT_RETENTION_DAYS,
  );
  const nowValue = flagValue(args, "--now");
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    console.log(`no control log at ${file}; nothing to compact`);
    return 0;
  }
  const lines = text.split("\n").filter((line) => line.trim().length > 0).length;
  const result = compactControlLog(text, {
    retentionDays,
    ...(nowValue ? { now: new Date(nowValue) } : {}),
  });
  await writeFile(file, result.text, "utf8");
  console.log(
    `compacted ${file}: ${result.kept} raw result(s) kept, ` +
      `${result.summarized} month(s) archived, ${lines} line(s) before`,
  );
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  if (command === "plan") return planCommand(args);
  if (command === "report") return reportCommand(args);
  if (command === "publish") return publishCommand(args);
  if (command === "status") return statusCommand(args);
  if (command === "compact") return compactCommand(args);
  console.error("usage: cli.ts <plan|report|publish|status|compact> [options]");
  return 2;
}

const invoked = process.argv[1] ?? "";
if (/cli\.(?:ts|js|mts|mjs)$/.test(invoked)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
