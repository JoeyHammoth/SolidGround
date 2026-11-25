import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type {
  DatasetMeta,
  IndexRow,
  PackageRecord,
  Policy,
  SolidFile,
  SolidState,
  Status,
} from "@solid-ground/schema";
import { STATUSES } from "@solid-ground/schema";
import { evaluate, toRecord } from "@solid-ground/engine";
import {
  fetchPackument,
  fetchWeeklyDownloads,
  fileSlug,
  detectSolidState,
  toEvidence,
  type PackumentCache,
  type RegistryEntry,
} from "./npm.js";

export const TOOL_VERSION = "0.1.0";

export async function loadRegistry(dir: string): Promise<RegistryEntry[]> {
  const packagesDir = path.join(dir, "packages");
  const files = (await readdir(packagesDir)).filter((name) => name.endsWith(".yml")).sort();
  const entries: RegistryEntry[] = [];
  for (const file of files) {
    const parsed = parseYaml(await readFile(path.join(packagesDir, file), "utf8")) as RegistryEntry;
    if (parsed?.name && parsed.tracked) entries.push(parsed);
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadPolicy(dir: string): Promise<Policy> {
  const raw = parseYaml(await readFile(path.join(dir, "status-policy.yml"), "utf8")) as Policy;
  return raw;
}

export interface BuildOptions {
  entries: RegistryEntry[];
  policy: Policy;
  solid: SolidState;
  /** Optional static scan. Missing versions keep `clean: null`. */
  scan?: (name: string, versions: string[]) => Promise<Record<string, boolean>>;
  fetchImpl?: typeof fetch;
  cache?: PackumentCache;
  now?: Date;
  includeDownloads?: boolean;
  concurrency?: number;
  onProgress?: (message: string) => void;
}

export interface Dataset {
  records: PackageRecord[];
  index: IndexRow[];
  meta: DatasetMeta;
  solid: SolidFile;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Collect facts for one package. Network failures keep the entry out of the run. */
export async function collectPackage(
  entry: RegistryEntry,
  options: {
    policy: Policy;
    solid: SolidState;
    fetchImpl?: typeof fetch;
    now: Date;
    includeDownloads?: boolean;
    scan?: (name: string, versions: string[]) => Promise<Record<string, boolean>>;
  },
): Promise<PackageRecord> {
  const fetchOptions = options.fetchImpl ? { fetchImpl: options.fetchImpl } : {};
  const { packument } = await fetchPackument(entry.name, fetchOptions);
  const downloads = options.includeDownloads
    ? await fetchWeeklyDownloads(entry.name, fetchOptions)
    : null;
  const evidence = toEvidence(entry, packument, downloads);
  if (options.scan) {
    const stable = evidence.lines.filter((line) => line.stability === "stable");
    const targets = (stable.length > 0 ? stable : evidence.lines).slice(0, 1).map((line) => line.version);
    const results = await options.scan(evidence.name, targets);
    evidence.lines = applyScan(evidence.lines, results);
  }
  const verdict = evaluate(evidence, options.solid, options.policy, options.now);
  const checkedAt = options.now.toISOString();
  return toRecord(evidence, verdict, options.solid, options.policy, checkedAt, TOOL_VERSION);
}

export function applyScan(
  lines: PackageRecord["lines"],
  results: Record<string, boolean>,
): PackageRecord["lines"] {
  return lines.map((line) =>
    Object.hasOwn(results, line.version)
      ? { ...line, clean: results[line.version] ?? line.clean }
      : line,
  );
}

export function buildIndex(records: PackageRecord[]): IndexRow[] {
  return records
    .map((record) => ({
      name: record.name,
      status: record.status,
      confidence: record.confidence,
      verified: record.verified,
      solid2Version: record.solid2Version,
      category: record.category,
      family: record.family,
      downloadsWeekly: record.downloadsWeekly,
      checkedAt: record.checkedAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildMeta(
  records: PackageRecord[],
  solid: SolidState,
  policy: Policy,
  generatedAt: string,
  curatedCount: number,
): DatasetMeta {
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<Status, number>;
  for (const record of records) counts[record.status] += 1;
  return {
    schemaVersion: 1,
    generatedAt,
    lastSuccessfulCollect: generatedAt,
    lastSuccessfulVerify: null,
    solid,
    counts: { ...counts, total: records.length },
    versions: { rules: policy.version, tool: TOOL_VERSION, schema: 1 },
    coverage: { tracked: records.length, curated: curatedCount, candidates: 0 },
    anomaly: { held: false, reasons: [] },
  };
}

export async function buildDataset(options: BuildOptions): Promise<Dataset> {
  const now = options.now ?? new Date();
  const records = await mapLimit(options.entries, options.concurrency ?? 4, async (entry) => {
    options.onProgress?.(`collecting ${entry.name}`);
    try {
      return await collectPackage(entry, {
        policy: options.policy,
        solid: options.solid,
        now,
        includeDownloads: options.includeDownloads ?? true,
        ...(options.scan ? { scan: options.scan } : {}),
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      });
    } catch (error) {
      throw new Error(`failed to collect ${entry.name}: ${(error as Error).message}`);
    }
  });

  return {
    records,
    index: buildIndex(records),
    meta: buildMeta(records, options.solid, options.policy, now.toISOString(), options.entries.length),
    solid: {
      schemaVersion: 1,
      ...options.solid,
      distTags: {},
      surfaceHash: null,
      docsHash: null,
    },
  };
}

export async function writeDataset(outDir: string, dataset: Dataset): Promise<void> {
  const packagesDir = path.join(outDir, "packages");
  await mkdir(packagesDir, { recursive: true });
  const writes: Promise<void>[] = [];
  for (const record of dataset.records) {
    writes.push(
      writeFile(
        path.join(packagesDir, `${fileSlug(record.name)}.json`),
        `${JSON.stringify(record, null, 2)}\n`,
        "utf8",
      ),
    );
  }
  writes.push(writeFile(path.join(outDir, "index.json"), `${JSON.stringify(dataset.index, null, 2)}\n`));
  writes.push(writeFile(path.join(outDir, "meta.json"), `${JSON.stringify(dataset.meta, null, 2)}\n`));
  writes.push(writeFile(path.join(outDir, "solid.json"), `${JSON.stringify(dataset.solid, null, 2)}\n`));
  await Promise.all(writes);
}

export { detectSolidState, fetchPackument, toEvidence };
