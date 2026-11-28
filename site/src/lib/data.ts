import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import type { DatasetMeta, IndexRow, PackageRecord, SolidFile } from "@solid-ground/schema";
// The pure half of the smoke package: no validator, no filesystem, so Astro can
// bundle it into the prerender without pulling Ajv's JSON schemas along.
import { parseControlHistory, summarizeControls } from "@solid-ground/smoke/status";
import { datasetConsistencyProblems } from "./consistency.js";

/**
 * The site is a pure function of the dataset. Prefer `DATA_DIR` (a checkout of
 * the `data` branch), then a sibling `data/` directory, then the committed
 * golden fixtures used by CI.
 */
function resolveDataDir(): string {
  const candidates = [
    process.env.DATA_DIR,
    path.resolve(process.cwd(), "..", "data"),
    path.resolve(process.cwd(), "..", "fixtures", "dataset"),
    path.resolve(process.cwd(), "fixtures", "dataset"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "index.json"))) return candidate;
  }
  throw new Error(
    `No dataset found. Looked in:\n${candidates.map((candidate) => `  - ${candidate}`).join("\n")}\n` +
      "Run `pnpm dataset --out data` or commit fixtures/dataset.",
  );
}

export const dataDir = resolveDataDir();

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, file), "utf8")) as T;
}

function decodeSlug(slug: string): string {
  return slug.replace(/__/g, "/");
}

export const index: IndexRow[] = readJson<IndexRow[]>("index.json");
export const meta = readJson<DatasetMeta>("meta.json");
export const solid = readJson<SolidFile>("solid.json");

/**
 * The verify matrix's control log. Optional: an edition published before the
 * matrix existed simply has no history to show.
 */
function readControls() {
  const file = path.join(dataDir, "smoke", "controls.jsonl");
  if (!existsSync(file)) return parseControlHistory("");
  return parseControlHistory(readFileSync(file, "utf8"));
}

export const controls = summarizeControls(readControls());

export const records: PackageRecord[] = readdirSync(path.join(dataDir, "packages"))
  .filter((file) => file.endsWith(".json"))
  .map((file) => JSON.parse(readFileSync(path.join(dataDir, "packages", file), "utf8")) as PackageRecord)
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Cross-file checks over the edition. The deploy enforces the JSON schemas;
 * this catches the local shapes the schema cannot see: the files disagreeing.
 */
export const consistencyProblems = datasetConsistencyProblems({ meta, index, records, solid });

/** The summary the deploy writes after validating the dataset. */
export interface DeployValidation {
  ok: boolean;
  checkedAt: string | null;
  targets: string[];
  problems: string[];
}

function readDeployValidation(): DeployValidation | null {
  const file = path.join(dataDir, "validation.json");
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<DeployValidation>;
    if (
      typeof parsed.ok !== "boolean" ||
      !Array.isArray(parsed.targets) ||
      !Array.isArray(parsed.problems)
    )
      return null;
    return {
      ok: parsed.ok,
      checkedAt: typeof parsed.checkedAt === "string" ? parsed.checkedAt : null,
      targets: parsed.targets,
      problems: parsed.problems,
    };
  } catch {
    return null;
  }
}

/** Null in local builds and in editions published before the deploy recorded it. */
export const deployValidation = readDeployValidation();

/**
 * What the Verify workflow saw when it last validated the deployed JSON. It
 * lives in the dataset because a static site cannot ask at request time, and a
 * reader should not have to open an Actions log to know the API still parses.
 */
export interface DeployApiCheck {
  ok: boolean;
  checkedAt: string | null;
  base: string;
  endpoints: number;
  problems: string[];
  /**
   * How the recorded fixture compared to the deployed answer during that check,
   * and what the same run did about it: current, opened, blocked or skipped.
   * `refresh` is null in an edition recorded before it was written.
   */
  fixture: { status: string; lastRun: string | null; refresh: string | null } | null;
}

function readApiCheckFixture(value: unknown): DeployApiCheck["fixture"] {
  if (typeof value !== "object" || value === null) return null;
  const fixture = value as Record<string, unknown>;
  if (typeof fixture["status"] !== "string") return null;
  return {
    status: fixture["status"],
    lastRun: typeof fixture["lastRun"] === "string" ? fixture["lastRun"] : null,
    refresh: typeof fixture["refresh"] === "string" ? fixture["refresh"] : null,
  };
}

function readApiCheck(): DeployApiCheck | null {
  const file = path.join(dataDir, "api-check.json");
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<DeployApiCheck>;
    if (typeof parsed.ok !== "boolean" || !Array.isArray(parsed.problems)) return null;
    return {
      ok: parsed.ok,
      checkedAt: typeof parsed.checkedAt === "string" ? parsed.checkedAt : null,
      base: typeof parsed.base === "string" ? parsed.base : "",
      endpoints: typeof parsed.endpoints === "number" ? parsed.endpoints : 0,
      problems: parsed.problems,
      fixture: readApiCheckFixture(parsed.fixture),
    };
  } catch {
    return null;
  }
}

/** Null until a Verify run has recorded a check for this edition. */
export const apiCheck = readApiCheck();

export function recordBySlug(slug: string): PackageRecord | undefined {
  return records.find((record) => record.name.replace(/\//g, "__") === decodeSlug(slug));
}

export function badgeMap(record: PackageRecord): string {
  switch (record.status) {
    case "ready":
      return "brightgreen";
    case "prerelease":
      return "blue";
    case "in-progress":
      return "yellow";
    case "blocked":
      return "red";
    case "unmaintained":
      return "lightgrey";
    case "agnostic":
      return "lightgrey";
    default:
      return "orange";
  }
}

export const CATEGORY_LABELS: Record<string, string> = {
  "ui-components": "UI components",
  routing: "Routing",
  "data-fetching": "Data fetching",
  state: "State",
  forms: "Forms",
  "build-tools": "Build tools",
  testing: "Testing",
  "meta-frameworks": "Meta-frameworks",
  primitives: "Primitives",
  styling: "Styling",
  devtools: "Devtools",
  other: "Other",
};

export const STATUS_ORDER = [
  "ready",
  "prerelease",
  "in-progress",
  "blocked",
  "unmaintained",
  "agnostic",
  "unknown",
] as const;

export function statusIcon(status: string): string {
  switch (status) {
    case "ready":
      return "✅";
    case "prerelease":
      return "🧪";
    case "in-progress":
      return "🚧";
    case "blocked":
      return "⛔";
    case "unmaintained":
      return "🪦";
    case "agnostic":
      return "➖";
    default:
      return "❓";
  }
}

export function relativeAge(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function formatDownloads(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}
