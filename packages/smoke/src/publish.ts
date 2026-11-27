import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateSmokeResult } from "@solid-ground/schema";
import type {
  IndexRow,
  PackageRecord,
  Policy,
  SmokeResult,
  SolidState,
} from "@solid-ground/schema";
import { parse as parseYaml } from "yaml";
import { checkControls, isControlResult } from "./controls.js";
import { foldSmoke } from "./report.js";

/**
 * The write path of the verify matrix, kept apart from the job that runs
 * package code. It takes a batch the report step already validated, folds it
 * into the published edition and refuses to touch anything unless the controls
 * still answer correctly.
 */

/** Control verdicts live under `smoke/`, beside the records they guard. */
export const CONTROL_HISTORY_FILE = "smoke/controls.jsonl";

export interface PublishOptions {
  dataDir: string;
  results: SmokeResult[];
  policy: Policy;
  now?: Date;
  /** Report what would change without writing anything. */
  dryRun?: boolean;
  /** The report step already checked the controls; publish checks again. */
  requireControls?: boolean;
}

export interface PublishOutcome {
  /** Package names whose record changed. */
  changed: string[];
  /** Names that gained `verified` in this batch. */
  verified: string[];
  /** Names whose verification was withdrawn in this batch. */
  withdrawn: string[];
  /** Reads that were already on the record and stayed there. */
  unchanged: number;
  /** Control results appended to the history file. */
  controls: number;
  dryRun: boolean;
}

/**
 * Fold a batch into every record it names. Results for controls and for
 * versions the record does not recommend are ignored by `foldSmoke` itself, so
 * this is a plain map over the edition.
 */
export function foldBatch(
  records: PackageRecord[],
  results: SmokeResult[],
  policy: Policy,
  solid: SolidState,
  now: Date,
): PackageRecord[] {
  const packageResults = results.filter((result) => !isControlResult(result));
  return records.map((record) =>
    foldSmoke(record, packageResults, policy, solid, now),
  );
}

function rejected(results: SmokeResult[]): string[] {
  return results.flatMap((result) =>
    validateSmokeResult(result).map((message) => `${result.name}: ${message}`),
  );
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8")) as unknown;
}

async function readRecords(
  dir: string,
): Promise<Array<{ file: string; record: PackageRecord }>> {
  const names = (await readdir(dir).catch(() => [] as string[]))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const records: Array<{ file: string; record: PackageRecord }> = [];
  for (const name of names) {
    const record = (await readJson(path.join(dir, name))) as PackageRecord;
    if (record?.name) records.push({ file: name, record });
  }
  return records;
}

async function appendControls(
  dataDir: string,
  results: SmokeResult[],
): Promise<number> {
  const file = path.join(dataDir, CONTROL_HISTORY_FILE);
  let existing = "";
  try {
    existing = await readFile(file, "utf8");
  } catch {
    existing = "";
  }
  const seen = new Set(existing.split("\n").filter((line) => line.trim().length > 0));
  const fresh = results
    .filter((result) => isControlResult(result))
    .sort((a, b) => (a.name === b.name ? a.at.localeCompare(b.at) : a.name.localeCompare(b.name)))
    .map((result) => JSON.stringify(result))
    .filter((line) => !seen.has(line));
  if (fresh.length === 0) return 0;
  await mkdir(path.dirname(file), { recursive: true });
  const base = existing.length > 0 && !existing.endsWith("\n") ? `${existing}\n` : existing;
  await writeFile(file, `${base}${fresh.join("\n")}\n`, "utf8");
  return fresh.length;
}

/**
 * Fold a batch into the dataset. Throws before writing anything when a result
 * is malformed or a control is wrong: a batch that cannot be trusted must not
 * change a record, and a partial publish is worse than none.
 */
export async function publishBatch(
  options: PublishOptions,
): Promise<PublishOutcome> {
  const now = options.now ?? new Date();
  const malformed = rejected(options.results);
  if (malformed.length > 0) {
    throw new Error(
      `batch rejected: ${malformed.length} malformed result(s); nothing was written (${malformed.join("; ")})`,
    );
  }
  if (options.requireControls !== false) {
    const failures = checkControls(options.results);
    if (failures.length > 0) {
      throw new Error(
        `batch discarded: ${failures.join("; ")}; nothing was written. A batch without trustworthy controls must not change a record.`,
      );
    }
  }

  const meta = (await readJson(path.join(options.dataDir, "meta.json"))) as {
    solid?: SolidState;
    lastSuccessfulVerify?: string | null;
  };
  const solid = meta.solid;
  if (!solid?.stable2) {
    throw new Error(`${options.dataDir}/meta.json carries no solid.stable2`);
  }

  const packagesDir = path.join(options.dataDir, "packages");
  const stored = await readRecords(packagesDir);
  const folded = foldBatch(
    stored.map((entry) => entry.record),
    options.results,
    options.policy,
    solid,
    now,
  );

  const outcome: PublishOutcome = {
    changed: [],
    verified: [],
    withdrawn: [],
    unchanged: 0,
    controls: 0,
    dryRun: options.dryRun === true,
  };

  const changes: Array<{ file: string; record: PackageRecord }> = [];
  for (let index = 0; index < stored.length; index += 1) {
    const entry = stored[index] as { file: string; record: PackageRecord };
    const next = folded[index] as PackageRecord;
    if (JSON.stringify(entry.record) === JSON.stringify(next)) {
      outcome.unchanged += 1;
      continue;
    }
    outcome.changed.push(next.name);
    if (next.verified && !entry.record.verified) outcome.verified.push(next.name);
    if (!next.verified && entry.record.verified) outcome.withdrawn.push(next.name);
    changes.push({ file: entry.file, record: next });
  }

  const controls = options.results.filter((result) => isControlResult(result)).length;
  outcome.controls = controls;

  if (options.dryRun === true) return outcome;

  const writes: Promise<void>[] = changes.map((change) =>
    writeFile(
      path.join(packagesDir, change.file),
      `${JSON.stringify(change.record, null, 2)}\n`,
      "utf8",
    ),
  );

  const byName = new Map(changes.map((change) => [change.record.name, change.record]));
  if (byName.size > 0) {
    const indexPath = path.join(options.dataDir, "index.json");
    let index: IndexRow[] = [];
    try {
      const parsed = await readJson(indexPath);
      if (Array.isArray(parsed)) index = parsed as IndexRow[];
    } catch {
      index = [];
    }
    if (index.length > 0) {
      const nextIndex = index.map((row) => {
        const record = byName.get(row.name);
        return record ? { ...row, verified: record.verified, confidence: record.confidence } : row;
      });
      writes.push(
        writeFile(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`, "utf8"),
      );
    }
  }

  if (changes.length > 0) {
    const nextMeta = { ...meta, lastSuccessfulVerify: now.toISOString() };
    writes.push(
      writeFile(
        path.join(options.dataDir, "meta.json"),
        `${JSON.stringify(nextMeta, null, 2)}\n`,
        "utf8",
      ),
    );
  }

  await Promise.all(writes);
  await appendControls(options.dataDir, options.results);
  return outcome;
}

/** The policy file is the single source of the freshness window. */
export async function loadPolicy(file: string): Promise<Policy> {
  return parseYaml(await readFile(file, "utf8")) as Policy;
}
