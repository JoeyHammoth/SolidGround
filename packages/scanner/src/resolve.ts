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

function normalize(target: string): string | null {
  if (!target.startsWith("./")) return null;
  const cleaned = target.replace(/^\.\//, "").replace(/\\/g, "/");
  return cleaned.length > 0 ? cleaned : null;
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
 * All candidate entry files for the root export, plus `main`/`module`/`browser`
 * fallbacks. Only paths present in the archive should survive, which the caller
 * enforces.
 */
export function resolveEntrypoints(pkg: PackageJson): string[] {
  const found: string[] = [];

  const exportsField = pkg.exports;
  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    found.push(...walkExports(exportsField));
  } else if (exportsField && typeof exportsField === "object") {
    const record = exportsField as Record<string, unknown>;
    const hasSubpaths = Object.keys(record).some((key) => key.startsWith("."));
    if (hasSubpaths) found.push(...walkExports(record["."]));
    else found.push(...walkExports(record));
  }

  if (typeof pkg.module === "string") found.push(...walkExports(pkg.module));
  if (typeof pkg.main === "string") found.push(...walkExports(pkg.main));
  if (typeof pkg.browser === "string") found.push(...walkExports(pkg.browser));

  return [...new Set(found.filter((file) => ANALYSABLE.test(file)))];
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
