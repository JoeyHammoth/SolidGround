import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  validateControls,
  validateGateState,
  validateIndexRows,
  validateMeta,
  validateSolidFile,
  validateValidationSummary,
} from "@solid-ground/schema";

/**
 * Follow the published `$schema` promise from the outside: fetch each JSON
 * endpoint and validate the answer. This is the check a consumer would run, so
 * it fails on the same things they would notice — an unreachable file, a field
 * that drifted, or a `$schema` that no longer names the right document.
 *
 * The recorded fixture in `fixtures/live/` is compared too, because an offline
 * test over an outdated answer proves less than it looks like it does.
 */

export const DEFAULT_BASE = "https://joeyhammoth.github.io/SolidGround";
export const RECORDED_CONTROLS = "fixtures/live/controls.json";

interface Endpoint {
  path: string;
  /** Responses that single out their schema must fill `$schema` with it. */
  schemaField: boolean;
  validate: (value: unknown) => string[];
}

export const ENDPOINTS: readonly Endpoint[] = [
  {
    path: "/api/v1/index.json",
    schemaField: false,
    validate: (value) => validateIndexRows(value, "index.json"),
  },
  { path: "/api/v1/meta.json", schemaField: false, validate: validateMeta },
  { path: "/api/v1/solid.json", schemaField: false, validate: validateSolidFile },
  { path: "/api/v1/gate.json", schemaField: true, validate: validateGateState },
  { path: "/api/v1/controls.json", schemaField: true, validate: validateControls },
  { path: "/api/v1/validation.json", schemaField: true, validate: validateValidationSummary },
];

export type FetchJson = (url: string) => Promise<unknown>;

export interface FixtureNote {
  /** Why the recorded answer needs a refresh. */
  message: string;
  /**
   * The deployed answer only gained the newest control day. Every nightly batch
   * moves `lastRun`, so this is the expected state between refreshes rather
   * than a problem worth warning about on every scheduled run.
   */
  routine: boolean;
}

export interface LiveReport {
  /** Endpoints whose body validated. */
  valid: string[];
  /** Schema or transport failures: the deployed API is wrong. */
  problems: string[];
  /** The recorded fixture lags the deployed answer; `routine` ones are nightly. */
  fixture: FixtureNote[];
  /** Bodies by endpoint path, for the checks that need the content. */
  bodies: Record<string, unknown>;
}

/** `/api/v1/gate.json` is described by `gate.schema.json`. */
export function schemaFileName(path: string): string {
  return path.replace(/^\/api\/v1\//, "").replace(/\.json$/, ".schema.json");
}

function lastRunOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const lastRun = (value as Record<string, unknown>)["lastRun"];
  return typeof lastRun === "string" ? lastRun : null;
}

/** Day fields that must still agree for a recording to describe the deployed answer. */
const DAY_FIELDS = ["day", "clean", "runs", "at", "failures", "groups"] as const;

function daysOf(value: unknown): Record<string, unknown>[] | null {
  if (typeof value !== "object" || value === null) return null;
  const days = (value as Record<string, unknown>)["days"];
  return Array.isArray(days) ? (days as Record<string, unknown>[]) : null;
}

function sameDay(recorded: Record<string, unknown>, deployed: Record<string, unknown>): boolean {
  return DAY_FIELDS.every(
    (field) => JSON.stringify(recorded[field]) === JSON.stringify(deployed[field]),
  );
}

/**
 * True when the only gap is the newest deployed day: a second batch moved it, or
 * the batch added it. Every earlier recorded day still has to match, so two
 * missing batches, a missing middle day or a day that changed after the fact is
 * real staleness.
 */
export function isOneBatchBehind(recorded: unknown, deployed: unknown): boolean {
  const recordedDays = daysOf(recorded);
  const deployedDays = daysOf(deployed);
  if (recordedDays === null || deployedDays === null) return false;
  if (deployedDays.length < recordedDays.length) return false;
  if (deployedDays.length > recordedDays.length + 1) return false;
  const byDay = new Map(recordedDays.map((day) => [String(day["day"]), day]));
  for (const day of deployedDays.slice(0, -1)) {
    const match = byDay.get(String(day["day"]));
    if (match === undefined || !sameDay(day, match)) return false;
  }
  return true;
}

/**
 * The offline suite validates a recorded deployed answer, so that answer has to
 * keep up with the API. Returns a note only when the deployed run is newer: a
 * fixture ahead of the deploy means the release has not landed yet.
 */
export function compareRecordedControls(
  recorded: unknown,
  deployed: unknown,
  file = RECORDED_CONTROLS,
): FixtureNote[] {
  if (recorded === undefined || recorded === null) {
    return [
      {
        message: `${file}: missing; record the deployed answer with \`curl <base>/api/v1/controls.json > ${file}\``,
        routine: false,
      },
    ];
  }
  const deployedRun = lastRunOf(deployed);
  if (deployedRun === null) return [];
  const recordedRun = lastRunOf(recorded);
  if (recordedRun === null) {
    return [
      {
        message: `${file}: carries no lastRun while the deployed response reports ${deployedRun}; refresh it`,
        routine: false,
      },
    ];
  }
  if (new Date(deployedRun).getTime() > new Date(recordedRun).getTime()) {
    return [
      {
        message: `${file}: recorded lastRun ${recordedRun} is older than the deployed ${deployedRun}; refresh it`,
        routine: isOneBatchBehind(recorded, deployed),
      },
    ];
  }
  return [];
}

/** What the process should report, and therefore what it exits on. */
export function reportProblems(report: LiveReport, strict: boolean): string[] {
  return strict
    ? [...report.problems, ...report.fixture.map((note) => note.message)]
    : report.problems;
}

export async function checkLiveEndpoints(options: {
  base?: string;
  fetchJson: FetchJson;
}): Promise<LiveReport> {
  const base = (options.base ?? DEFAULT_BASE).replace(/\/+$/, "");
  const valid: string[] = [];
  const problems: string[] = [];
  const bodies: Record<string, unknown> = {};

  for (const endpoint of ENDPOINTS) {
    let value: unknown;
    try {
      value = await options.fetchJson(`${base}${endpoint.path}`);
    } catch (error) {
      problems.push(
        `${endpoint.path}: unreachable (${error instanceof Error ? error.message : String(error)})`,
      );
      continue;
    }

    if (endpoint.schemaField) {
      const declared = (value as Record<string, unknown> | null)?.["$schema"];
      const expected = schemaFileName(endpoint.path);
      if (typeof declared !== "string" || !declared.endsWith(`/${expected}`)) {
        problems.push(
          `${endpoint.path}: $schema is ${JSON.stringify(declared ?? null)}, expected a URL ending in ${expected}`,
        );
        continue;
      }
    }

    const messages = endpoint.validate(value);
    if (messages.length > 0) {
      for (const message of messages) problems.push(`${endpoint.path}: ${message}`);
      continue;
    }
    valid.push(endpoint.path);
    bodies[endpoint.path] = value;
  }

  const deployedControls = bodies["/api/v1/controls.json"];
  const fixture =
    deployedControls === undefined
      ? []
      : compareRecordedControls(
          await readRecorded(RECORDED_CONTROLS),
          deployedControls,
          RECORDED_CONTROLS,
        );

  return { valid, problems, fixture, bodies };
}

async function readRecorded(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path.resolve(file), "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function main(argv: string[]): Promise<number> {
  const base = flagValue(argv, "--base") ?? DEFAULT_BASE;
  const strict = argv.includes("--strict");
  const report = await checkLiveEndpoints({
    base,
    fetchJson: async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as unknown;
    },
  });

  for (const path of report.valid) console.log(`ok   ${path}`);
  for (const problem of report.problems) console.error(`fail ${problem}`);
  for (const note of report.fixture) {
    // A fixture one batch behind is the normal state between merges; only a
    // larger or inconsistent lag is worth the `warn` the workflow watches for.
    if (strict) console.error(`fail ${note.message}`);
    else if (note.routine) console.log(`note ${note.message}`);
    else console.log(`warn ${note.message}`);
  }

  const reported = reportProblems(report, strict);
  console.log(
    `${report.valid.length}/${ENDPOINTS.length} endpoint(s) valid, ${report.problems.length} problem(s), ` +
      `${report.fixture.length} fixture note(s) against ${base}` +
      (strict ? "" : "; pass --strict to fail on a stale fixture"),
  );
  return reported.length === 0 ? 0 : 1;
}

const invoked = process.argv[1] ?? "";
if (/live-api\.(?:ts|js|mts|mjs)$/.test(invoked)) {
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
