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
 */

export const DEFAULT_BASE = "https://joeyhammoth.github.io/SolidGround";

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

export interface LiveReport {
  /** Endpoints whose body validated. */
  valid: string[];
  problems: string[];
}

/** `/api/v1/gate.json` is described by `gate.schema.json`. */
export function schemaFileName(path: string): string {
  return path.replace(/^\/api\/v1\//, "").replace(/\.json$/, ".schema.json");
}

export async function checkLiveEndpoints(options: {
  base?: string;
  fetchJson: FetchJson;
}): Promise<LiveReport> {
  const base = (options.base ?? DEFAULT_BASE).replace(/\/+$/, "");
  const valid: string[] = [];
  const problems: string[] = [];

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
  }

  return { valid, problems };
}

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function main(argv: string[]): Promise<number> {
  const base = flagValue(argv, "--base") ?? DEFAULT_BASE;
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
  console.log(
    `${report.valid.length}/${ENDPOINTS.length} endpoint(s) valid, ${report.problems.length} problem(s) against ${base}`,
  );
  return report.problems.length === 0 ? 0 : 1;
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
