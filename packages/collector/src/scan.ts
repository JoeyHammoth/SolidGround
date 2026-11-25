import { scanPackage } from "@solid-ground/scanner";

export type ScanVersions = (name: string, versions: string[]) => Promise<Record<string, boolean>>;

/**
 * A scan is a network round trip plus an archive read, so results are cached
 * for the run. A failed scan is reported and skipped: missing `S` evidence is a
 * downgrade, never a wrong verdict.
 */
export function createScanner(): ScanVersions {
  const cache = new Map<string, boolean>();

  return async (name, versions) => {
    const results: Record<string, boolean> = {};
    for (const version of versions) {
      const key = `${name}@${version}`;
      let clean = cache.get(key);
      if (clean === undefined) {
        try {
          clean = (await scanPackage(name, version)).clean;
          cache.set(key, clean);
        } catch (error) {
          console.warn(`scan skipped ${key}: ${(error as Error).message}`);
          continue;
        }
      }
      results[version] = clean;
    }
    return results;
  };
}
