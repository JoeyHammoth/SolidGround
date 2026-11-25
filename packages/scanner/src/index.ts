import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  analyzeSource,
  scanJsx,
  type Finding,
  type RemovedRules,
} from "./analyze.js";
import { DEFAULT_LIMITS, type ArchiveLimits } from "./limits.js";
import { ANALYSABLE, resolveEntrypoints, resolveRelative, type PackageJson } from "./resolve.js";
import { loadSurface, surfaceNames, type Surface } from "./surface.js";
import { extractArchive, readArchiveFile, verifyIntegrity } from "./tarball.js";

const REGISTRY = "https://registry.npmjs.org";
/** Repository root, so defaults work from any package cwd. */
export const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const USER_AGENT =
  "solid-ground-scanner/0.1 (+https://github.com/JoeyHammoth/SolidGround; static scan, no execution)";

export interface ScanResult {
  name: string;
  version: string;
  clean: boolean;
  findings: Finding[];
  files: string[];
  entrypoints: string[];
  surfaceVersion: string;
}

export interface ScanOptions {
  fetchImpl?: typeof fetch;
  rulesDir?: string;
  surfacePath?: string;
  limits?: ArchiveLimits;
  /** Follow relative imports this many levels deep. */
  depth?: number;
}

export async function loadRules(dir: string): Promise<RemovedRules> {
  const parsed = parseYaml(await readFile(path.join(dir, "removed-apis.yml"), "utf8")) as Partial<RemovedRules>;
  return {
    subpaths: Array.isArray(parsed.subpaths) ? parsed.subpaths : [],
    exports: Array.isArray(parsed.exports) ? parsed.exports : [],
  };
}

function encodePackage(name: string): string {
  return encodeURIComponent(name).replace(/%40/g, "@");
}

async function fetchMetadata(name: string, version: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl(`${REGISTRY}/${encodePackage(name)}/${encodeURIComponent(version)}`, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`npm metadata for ${name}@${version} returned ${response.status}`);
  return (await response.json()) as {
    "dist-tags"?: Record<string, string>;
    dist?: { tarball?: string; integrity?: string };
    exports?: unknown;
    main?: string;
    module?: string;
    types?: string;
  };
}

/**
 * Download, verify, extract and parse a published version. Code is only ever
 * read: no module is imported and no lifecycle script can run.
 */
export async function scanPackage(
  name: string,
  version: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const limits = options.limits ?? DEFAULT_LIMITS;
  const rules = await loadRules(options.rulesDir ?? path.join(REPO_ROOT, "rules"));
  const surface: Surface = await loadSurface(
    options.surfacePath ?? path.join(REPO_ROOT, "rules", "solid2-surface.json"),
  );
  const metadata = await fetchMetadata(name, version, fetchImpl);

  const tarballUrl = metadata.dist?.tarball;
  const integrity = metadata.dist?.integrity;
  if (!tarballUrl || !integrity) throw new Error(`${name}@${version} has no dist.tarball or dist.integrity`);

  const download = await fetchImpl(tarballUrl, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(60_000),
  });
  if (!download.ok) throw new Error(`tarball for ${name}@${version} returned ${download.status}`);
  const buffer = Buffer.from(await download.arrayBuffer());
  if (!verifyIntegrity(buffer, integrity).matches) {
    throw new Error(`tarball for ${name}@${version} failed integrity verification`);
  }

  const archive = await extractArchive(buffer, limits);
  try {
    const prefix = archive.files.some((file) => file === "package/package.json") ? "package/" : "";
    const packageJson = JSON.parse(await readArchiveFile(archive, `${prefix}package.json`, limits)) as PackageJson;
    const declared = resolveEntrypoints(packageJson);
    const entrypoints = declared.filter((file) => archive.files.includes(`${prefix}${file}`));

    const pending = [...entrypoints];
    const seen = new Set<string>();
    const findings: Finding[] = [];
    const analysed: string[] = [];
    const depth = options.depth ?? 3;

    while (pending.length > 0 && analysed.length < 200) {
      const relative = pending.shift() as string;
      if (seen.has(relative)) continue;
      seen.add(relative);
      const archivePath = `${prefix}${relative}`;
      if (!ANALYSABLE.test(relative) || !archive.files.includes(archivePath)) continue;

      let code: string;
      try {
        code = await readArchiveFile(archive, archivePath, limits);
      } catch {
        continue;
      }
      analysed.push(relative);

      const surfaceFor = (specifier: string) => surfaceNames(surface, specifier);
      findings.push(...(await analyzeSource(relative, code, surfaceFor, rules)));
      findings.push(...scanJsx(relative, code));

      if (relative.split("/").length < depth) {
        for (const match of code.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
          const specifier = match[1];
          if (!specifier) continue;
          for (const candidate of resolveRelative(relative, specifier)) {
            if (archive.files.includes(`${prefix}${candidate}`)) {
              pending.push(candidate);
              break;
            }
          }
        }
      }
    }

    const runtime = findings.filter((finding) => finding.runtime);
    const versions = Object.values(surface.versions).join(", ");
    return {
      name,
      version,
      clean: runtime.length === 0,
      findings,
      files: analysed,
      entrypoints,
      surfaceVersion: versions,
    };
  } finally {
    await archive.cleanup();
  }
}

export { analyzeSource, scanJsx } from "./analyze.js";
export { loadSurface, surfaceNames } from "./surface.js";
export { extractArchive, verifyIntegrity } from "./tarball.js";
export { resolveEntrypoints, SCAN_CONDITIONS } from "./resolve.js";
