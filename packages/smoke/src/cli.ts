import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateSmokeResult } from "@solid-ground/schema";
import type {
  PackageRecord,
  SmokeResult,
  SolidState,
} from "@solid-ground/schema";
import { checkControls, controlCells } from "./controls.js";
import { artifactId, cellId, planBatch } from "./plan.js";
import type { CellSource, SmokeCell, SmokeSteps } from "./plan.js";

/**
 * The plan and report steps of `verify.yml`, on a laptop:
 *
 *   pnpm smoke:plan --data data --packages "@solidjs/meta" --max-cells 3
 *   pnpm smoke:report --dir results --out smoke/results.ndjson
 *
 * Both are thin: selection lives in `plan.ts`, trust in `controls.ts`, and the
 * artifact contract in `@solid-ground/schema`.
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

async function collectJson(dir: string): Promise<string[]> {
  const info = await stat(dir).catch(() => null);
  if (!info) return [];
  if (info.isFile()) return dir.endsWith(".json") ? [dir] : [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJson(full)));
    else if (entry.name.endsWith(".json")) files.push(full);
  }
  return files;
}

async function reportCommand(args: string[]): Promise<number> {
  const dir = flagValue(args, "--dir") ?? "results";
  const out = flagValue(args, "--out");
  const files = await collectJson(dir);

  const results: SmokeResult[] = [];
  const failures: string[] = [];
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = await readJsonFile(file);
    } catch (error) {
      failures.push(`${file}: invalid JSON (${(error as Error).message})`);
      continue;
    }
    const messages = validateSmokeResult(parsed);
    if (messages.length > 0) {
      for (const message of messages) failures.push(`${file}: ${message}`);
      continue;
    }
    results.push(parsed as SmokeResult);
  }

  if (!args.includes("--no-controls")) failures.push(...checkControls(results));

  if (failures.length > 0) {
    for (const failure of failures) console.error(`discard: ${failure}`);
    console.error(
      `batch discarded: ${failures.length} problem(s); nothing was written. A batch without trustworthy controls must not change a record.`,
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

export async function main(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  if (command === "plan") return planCommand(args);
  if (command === "report") return reportCommand(args);
  console.error("usage: cli.ts <plan|report> [options]");
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
