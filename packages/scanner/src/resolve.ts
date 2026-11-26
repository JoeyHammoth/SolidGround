/**
 * Entry point resolution. Solid libraries commonly ship several builds under
 * `exports`, and the build that matters for a Solid 2 scan is the one selected
 * by `solid`, `import`, `browser` or `default` — JSX source is often behind the
 * `solid` condition.
 */
export const SCAN_CONDITIONS = ["solid", "import", "browser", "development", "default"] as const;

export const ANALYSABLE = /\.(?:m?js|cjs|jsx|tsx?)$/i;

export interface PackageJson {
  exports?: unknown;
  main?: string;
  module?: string;
  types?: string;
  browser?: unknown;
}

/**
 * `exports` targets must start with `./`, but `main` and `module` conventionally
 * do not (`"main": "index.jsx"`), so a leading `./` is optional here.
 */
function normalize(target: string): string | null {
  const cleaned = target.replace(/^\.\//, "").replace(/\\/g, "/");
  if (cleaned.length === 0 || cleaned.startsWith("/")) return null;
  if (cleaned.split("/").includes("..")) return null;
  return cleaned;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A pattern target such as `./dist/* /index.js` cannot be resolved without the
 * archive listing. `*` matches one path segment, which keeps a `./src/*` export
 * from pulling every nested source file into the scan.
 */
function expandPattern(target: string, archiveFiles: readonly string[]): string[] {
  const normalized = normalize(target);
  if (!normalized) return [];
  if (!normalized.includes("*")) return [normalized];
  const pattern = new RegExp(`^${normalized.split("*").map(escapeRegExp).join("[^/]+")}$`);
  return archiveFiles.filter((file) => pattern.test(file));
}

function walkExports(value: unknown, depth = 0): string[] {
  if (depth > 8) return [];
  if (typeof value === "string") {
    const normalized = normalize(value);
    return normalized ? [normalized] : [];
  }
  if (Array.isArray(value)) return value.flatMap((entry) => walkExports(entry, depth + 1));
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const found: string[] = [];
    for (const condition of SCAN_CONDITIONS) {
      if (condition in record) found.push(...walkExports(record[condition], depth + 1));
    }
    if (found.length === 0 && "types" in record) found.push(...walkExports(record["types"], depth + 1));
    return found;
  }
  return [];
}

/**
 * Every exported entry point, not just `.`: packages that publish `./client`,
 * `./server` or one subpath per component ship code that is reached by nothing
 * else. `main`/`module`/`browser` are included as fallbacks.
 *
 * `archiveFiles` is needed only to expand wildcard export targets; without it a
 * `./*` key resolves to nothing and the root export is still scanned.
 */
export function resolveEntrypoints(pkg: PackageJson, archiveFiles: readonly string[] = []): string[] {
  const found: string[] = [];

  const exportsField = pkg.exports;
  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    found.push(...walkExports(exportsField));
  } else if (exportsField && typeof exportsField === "object") {
    const record = exportsField as Record<string, unknown>;
    const subpaths = Object.entries(record).filter(([key]) => key.startsWith("."));
    if (subpaths.length === 0) {
      found.push(...walkExports(record));
    } else {
      for (const [key, value] of subpaths) {
        if (!key.includes("*")) {
          found.push(...walkExports(value));
          continue;
        }
        for (const target of walkExports(value)) found.push(...expandPattern(target, archiveFiles));
      }
    }
  }

  if (typeof pkg.module === "string") found.push(...walkExports(pkg.module));
  if (typeof pkg.main === "string") found.push(...walkExports(pkg.main));
  if (typeof pkg.browser === "string") found.push(...walkExports(pkg.browser));

  // The analysis loop caps itself, so a generous entry list only costs a few
  // stat calls; a wildcard export over a large package can otherwise be huge.
  return [...new Set(found.filter((file) => ANALYSABLE.test(file)))].slice(0, 400);
}

/** Resolve a relative import from one file to another, inside the archive. */
export function resolveRelative(fromFile: string, specifier: string): string[] {
  const base = fromFile.split("/").slice(0, -1).join("/");
  const joined = specifier.startsWith("./") || specifier.startsWith("../")
    ? `${base}/${specifier.slice(2)}`
    : specifier;
  const parts: string[] = [];
  for (const segment of joined.split("/")) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  const normalized = parts.join("/");
  return [normalized, `${normalized}.js`, `${normalized}.mjs`, `${normalized}/index.js`];
}
