import { readFile } from "node:fs/promises";

/**
 * The Solid 2 export surface, generated from the published packages rather than
 * hand-maintained. `pnpm --filter @solid-ground/scanner surface` regenerates it;
 * the file records the versions it was built from so findings are attributable.
 */
export interface Surface {
  schemaVersion: 1;
  generatedAt: string;
  versions: Record<string, string>;
  exports: Record<string, string[]>;
}

export function surfaceNames(surface: Surface, specifier: string): ReadonlySet<string> {
  if (specifier === "@solidjs/web" || specifier === "@solidjs/signals") {
    return new Set(surface.exports[specifier] ?? []);
  }
  return new Set(surface.exports["solid-js"] ?? []);
}

export async function loadSurface(file: string): Promise<Surface> {
  const parsed = JSON.parse(await readFile(file, "utf8")) as Surface;
  if (parsed.schemaVersion !== 1 || !parsed.exports) {
    throw new Error(`${file} is not a Solid 2 surface file`);
  }
  return parsed;
}
