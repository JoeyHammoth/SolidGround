import { createHash } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { highestStable2, type Packument } from "./npm.js";

export const SENTINEL_UA =
  "solid-ground-sentinel/0.1 (+https://github.com/JoeyHammoth/SolidGround; release watcher)";

const REGISTRY = "https://registry.npmjs.org";
const RELEASE_URL = "https://api.github.com/repos/solidjs/solid/releases/latest";

/**
 * The observation the sentinel stores on the `data` branch. It is deliberately
 * stateless between runs: every comparison is made against this file, so a
 * skipped or failed run can never lose a change.
 */
export interface SentinelState {
  schemaVersion: 1;
  observedAt: string;
  stable2: string | null;
  next: string | null;
  /** `<package>@<dist-tag>` to version, for every watched package. */
  distTags: Record<string, string>;
  /** Latest GitHub release tag of `solidjs/solid`. */
  release: string | null;
  /** SHA-256 of the normalised migration-page text. */
  docsHash: string | null;
  surfaceHash: string | null;
}

export interface WatchList {
  packages: string[];
  docs: Record<string, string>;
}

export async function loadWatchList(dir: string): Promise<WatchList> {
  const raw = parseYaml(await readFile(path.join(dir, "solid-packages.yml"), "utf8")) as {
    packages?: unknown;
    docs?: unknown;
  };
  const packages = Array.isArray(raw.packages)
    ? raw.packages.filter((value): value is string => typeof value === "string")
    : [];
  if (packages.length === 0) {
    throw new Error(`${path.join(dir, "solid-packages.yml")} lists no packages to watch`);
  }
  const docs: Record<string, string> = {};
  if (raw.docs && typeof raw.docs === "object") {
    for (const [key, value] of Object.entries(raw.docs as Record<string, unknown>)) {
      if (typeof value === "string") docs[key] = value;
    }
  }
  return { packages, docs };
}

export function flattenDistTags(
  input: Record<string, Record<string, string> | null>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, tags] of Object.entries(input)) {
    for (const [tag, version] of Object.entries(tags ?? {})) out[`${name}@${tag}`] = version;
  }
  return out;
}

/**
 * Keep only the document body and collapse whitespace, so a rebuild that only
 * changes asset hashes in the head does not look like an edited page.
 */
export function bodyText(html: string): string {
  const start = html.indexOf("<body");
  const body = start >= 0 ? html.slice(start) : html;
  return body.replace(/\s+/g, " ").trim();
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function short(value: string | null): string {
  return value ? value.slice(0, 8) : "none";
}

/**
 * Compare an observation with stored state. Ordering is stable so the reasons
 * are reviewable, and every difference is reported — never just the latest one.
 */
export function detectChanges(stored: SentinelState | null, observed: SentinelState): string[] {
  if (!stored || stored.schemaVersion !== 1) return ["no stored state on the data branch yet"];

  const reasons: string[] = [];
  const keys = new Set([...Object.keys(stored.distTags), ...Object.keys(observed.distTags)]);
  for (const key of [...keys].sort()) {
    const before = stored.distTags[key] ?? null;
    const after = observed.distTags[key] ?? null;
    if (before !== after) reasons.push(`${key}: ${before ?? "removed"} -> ${after ?? "removed"}`);
  }
  if (stored.release !== observed.release) {
    reasons.push(`release: ${stored.release ?? "none"} -> ${observed.release ?? "none"}`);
  }
  if (stored.docsHash !== observed.docsHash) {
    reasons.push(`migration docs: ${short(stored.docsHash)} -> ${short(observed.docsHash)}`);
  }
  return reasons;
}

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { "user-agent": SENTINEL_UA, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

/**
 * Read every watched dist-tag, the latest `solidjs/solid` release and the
 * migration page. A failing secondary source keeps its previous value rather
 * than inventing a change.
 */
export async function fetchObservation(
  watch: WatchList,
  previous: SentinelState | null,
  options: { fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<SentinelState> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const observedAt = (options.now ?? new Date()).toISOString();

  const tags: Record<string, Record<string, string> | null> = {};
  let solid: Packument | null = null;
  for (const name of watch.packages) {
    const encoded = encodeURIComponent(name).replace(/%40/g, "@");
    const body = (await getJson(`${REGISTRY}/${encoded}`, fetchImpl)) as Packument;
    tags[name] = body["dist-tags"] ?? null;
    if (name === "solid-js") solid = body;
  }

  let release = previous?.release ?? null;
  try {
    const body = (await getJson(RELEASE_URL, fetchImpl)) as { tag_name?: unknown };
    if (typeof body.tag_name === "string") release = body.tag_name;
  } catch (error) {
    console.warn(`release lookup failed, keeping ${release ?? "none"}: ${(error as Error).message}`);
  }

  let docsHash = previous?.docsHash ?? null;
  const migration = watch.docs.migration;
  if (migration) {
    try {
      const response = await fetchImpl(migration, {
        headers: { "user-agent": SENTINEL_UA },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) docsHash = hashText(bodyText(await response.text()));
      else console.warn(`migration page returned ${response.status}, keeping ${short(docsHash)}`);
    } catch (error) {
      console.warn(`migration page failed, keeping ${short(docsHash)}: ${(error as Error).message}`);
    }
  }

  const solidTags = tags["solid-js"] ?? null;
  return {
    schemaVersion: 1,
    observedAt,
    stable2: solid ? highestStable2(solid) : (previous?.stable2 ?? null),
    next: solidTags?.next ?? null,
    distTags: flattenDistTags(tags),
    release,
    docsHash,
    surfaceHash: previous?.surfaceHash ?? null,
  };
}

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value ?? fallback;
}

async function readState(file: string): Promise<SentinelState | null> {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as SentinelState;
    return parsed.schemaVersion === 1 ? parsed : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const rulesDir = path.resolve(arg("rules", "rules"));
  const statePath = path.resolve(arg("state", "data/solid.json"));
  const writePath = process.argv.includes("--write") ? path.resolve(arg("write", statePath)) : null;
  const reportPath = arg("report", "");

  const watch = await loadWatchList(rulesDir);
  const stored = await readState(statePath);
  const observed = await fetchObservation(watch, stored);
  const reasons = detectChanges(stored, observed);

  if (reasons.length === 0) {
    console.log(`sentinel: no change across ${watch.packages.length} packages`);
  } else {
    for (const reason of reasons) console.log(`sentinel: changed — ${reason}`);
  }

  if (writePath) {
    await writeFile(writePath, `${JSON.stringify(observed, null, 2)}\n`);
    console.log(`sentinel: wrote ${writePath}`);
  }

  if (reportPath) {
    await appendFile(
      reportPath,
      `changed=${reasons.length > 0}\nreasons<<SENTINEL_REASONS\n${reasons.join("; ") || "no change"}\nSENTINEL_REASONS\n`,
    );
  }
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entry && import.meta.url === entry) {
  await main();
}
