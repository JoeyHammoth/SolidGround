import semver from "semver";
import type { Attestation, PackageEvidence, VersionLine } from "@solid-ground/schema";
import { phaseOf, stabilityOf } from "@solid-ground/engine";

const REGISTRY = "https://registry.npmjs.org";
const DOWNLOADS = "https://api.npmjs.org/downloads/point/last-week";

export const USER_AGENT =
  "solid-ground/0.1 (+https://github.com/JoeyHammoth/SolidGround; ecosystem readiness tracker)";

export interface PackumentVersion {
  version?: string;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  deprecated?: string;
  types?: string;
  typings?: string;
  exports?: unknown;
  main?: string;
  module?: string;
  repository?: string | { type?: string; url?: string; directory?: string };
}

export interface Packument {
  name?: string;
  "dist-tags"?: Record<string, string>;
  versions?: Record<string, PackumentVersion>;
  time?: Record<string, string>;
  repository?: string | { type?: string; url?: string; directory?: string };
}

export interface RegistryEntry {
  name: string;
  category: string;
  tracked: boolean;
  family?: string | null;
  aliases?: string[];
  supersededBy?: string | null;
  alternatives?: string[];
  notes?: string | null;
  attestations?: Attestation[];
}

export interface FetchResult {
  packument: Packument;
  etag: string | null;
  notModified: boolean;
}

export interface PackumentCache {
  [name: string]: { etag: string | null; fingerprint: string };
}

/** Package names are used in URLs and file paths, so normalise them strictly. */
export function canonicalName(name: string): string {
  return name.trim().toLowerCase().replace(/^https?:\/\/registry\.npmjs\.org\//, "");
}

export function fileSlug(name: string): string {
  return name.replace(/\//g, "__");
}

function headerValue(response: Response, key: string): string | null {
  return response.headers.get(key);
}

export async function fetchPackument(
  name: string,
  options: {
    fetchImpl?: typeof fetch;
    etag?: string | null;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<FetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const encoded = name.replace("/", "%2F");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  try {
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": USER_AGENT,
    };
    if (options.etag) headers["if-none-match"] = options.etag;
    const response = await fetchImpl(`${REGISTRY}/${encoded}`, {
      headers,
      signal: options.signal ?? controller.signal,
    });
    if (response.status === 304) {
      return { packument: {}, etag: options.etag ?? null, notModified: true };
    }
    if (!response.ok) {
      throw new Error(`npm registry returned ${response.status} for ${name}`);
    }
    const body = (await response.json()) as Packument;
    return { packument: body, etag: headerValue(response, "etag"), notModified: false };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWeeklyDownloads(
  name: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<number | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${DOWNLOADS}/${name.replace("/", "%2F")}`, {
      headers: { "user-agent": USER_AGENT },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { downloads?: number };
    return typeof body.downloads === "number" ? body.downloads : null;
  } catch {
    return null;
  }
}

export function normalizeRepository(repository: Packument["repository"]): string | null {
  const raw = typeof repository === "string" ? repository : repository?.url;
  if (!raw) return null;
  const cleaned = raw
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^ssh:\/\/git@/, "https://")
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "")
    .replace(/^github:/, "https://github.com/");
  try {
    const url = new URL(cleaned);
    if (url.hostname !== "github.com") return cleaned;
    const parts = url.pathname.split("/").filter(Boolean).slice(0, 2);
    return parts.length === 2 ? `https://github.com/${parts[0]}/${parts[1]}` : cleaned;
  } catch {
    return null;
  }
}

function solidRangeFor(version: PackumentVersion): string | null {
  return (
    version.peerDependencies?.["solid-js"] ??
    version.dependencies?.["solid-js"] ??
    version.optionalDependencies?.["solid-js"] ??
    null
  );
}

export function retainedVersions(packument: Packument): string[] {
  const versions = Object.keys(packument.versions ?? {}).filter((version) => semver.valid(version));
  versions.sort(semver.rcompare);
  const tags = Object.values(packument["dist-tags"] ?? {});
  const retained = new Set<string>(tags);
  const seenMajors = new Set<number>();
  for (const version of versions) {
    const parsed = semver.parse(version);
    if (!parsed || parsed.prerelease.length > 0) continue;
    if (!seenMajors.has(parsed.major)) {
      seenMajors.add(parsed.major);
      retained.add(version);
    }
  }
  for (const version of versions.slice(0, 10)) retained.add(version);
  return [...retained].sort(semver.rcompare);
}

export function toEvidence(
  entry: RegistryEntry,
  packument: Packument,
  downloadsWeekly: number | null,
): PackageEvidence {
  const tags = packument["dist-tags"] ?? {};
  const tagByVersion = new Map<string, string>();
  for (const [tag, version] of Object.entries(tags)) tagByVersion.set(version, tag);

  const versions = retainedVersions(packument);
  const lines: VersionLine[] = versions.map((version) => {
    const meta = packument.versions?.[version] ?? {};
    return {
      version,
      tag: tagByVersion.get(version) ?? null,
      stability: stabilityOf(version),
      phase: phaseOf(version),
      solidRange: solidRangeFor(meta),
      parsed: Boolean(semver.validRange(solidRangeFor(meta) ?? "", { loose: true })),
      admitsSolid2: false,
      clean: null,
      publishedAt: packument.time?.[version] ?? null,
      deprecated: Boolean(meta.deprecated),
    };
  });

  const latest = tags.latest ? packument.versions?.[tags.latest] : undefined;
  const referenced = versions.map((version) => packument.versions?.[version] ?? {});
  const dependsOnSolid =
    entry.name === "solid-js" ||
    entry.name.startsWith("@solidjs/") ||
    referenced.some((meta) => solidRangeFor(meta) !== null);

  const publishTimes = versions
    .map((version) => packument.time?.[version])
    .filter((value): value is string => typeof value === "string")
    .sort();
  const lastPublishAt = publishTimes.at(-1) ?? null;

  return {
    name: entry.name,
    family: entry.family ?? null,
    category: entry.category,
    repository: normalizeRepository(packument.repository ?? latest?.repository),
    dependsOnSolid,
    downloadsWeekly,
    deprecated: Boolean(latest?.deprecated),
    repoArchived: false,
    lastPublishAt,
    lines,
    upstream: { hasSolid2Work: false, isArchived: false, links: [] },
    attestations: entry.attestations ?? [],
    smoke: { import: null, build: null, types: null },
    shipsTypes: Boolean(latest?.types ?? latest?.typings),
  };
}

/** Highest stable 2.x version, independent of which dist-tag happens to point at it. */
export function highestStable2(packument: Packument): string | null {
  const candidates = Object.keys(packument.versions ?? {})
    .filter((version) => {
      const parsed = semver.parse(version);
      return parsed?.major === 2 && parsed.prerelease.length === 0;
    })
    .sort(semver.rcompare);
  return candidates[0] ?? null;
}

export function detectSolidState(
  solidPackument: Packument,
  observedAt: string,
): { stable2: string; next: string | null; distTags: Record<string, string> } {
  const stable2 = highestStable2(solidPackument);
  if (!stable2) throw new Error("solid-js has no stable 2.x release published");
  const distTags = solidPackument["dist-tags"] ?? {};
  return { stable2, next: distTags.next ?? null, distTags };
}
