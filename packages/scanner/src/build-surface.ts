import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { init, parse } from "es-module-lexer";
import { resolveEntrypoints } from "./resolve.js";
import { extractArchive, readArchiveFile } from "./tarball.js";
import type { Surface } from "./surface.js";

const REGISTRY = "https://registry.npmjs.org";
const USER_AGENT = "solid-ground-scanner/0.1 (+https://github.com/JoeyHammoth/SolidGround)";
const TARGETS = ["solid-js", "@solidjs/web", "@solidjs/signals"] as const;

async function json(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

/**
 * Read the named exports of a published package's root entry, straight from its
 * tarball. Nothing is installed and no package code runs: the entry is parsed
 * with a lexer and its export list recorded.
 */
async function surfaceFor(name: string): Promise<{ version: string; names: string[] }> {
  const encoded = encodeURIComponent(name).replace(/%40/g, "@");
  const packument = (await json(`${REGISTRY}/${encoded}`)) as {
    "dist-tags"?: Record<string, string>;
    versions?: Record<string, { dist?: { tarball?: string } }>;
  };
  const version = packument["dist-tags"]?.latest;
  if (!version) throw new Error(`${name} has no latest dist-tag`);
  const tarballUrl = packument.versions?.[version]?.dist?.tarball;
  if (!tarballUrl) throw new Error(`${name}@${version} has no tarball`);

  const download = await fetch(tarballUrl, { headers: { "user-agent": USER_AGENT } });
  if (!download.ok) throw new Error(`tarball for ${name}@${version} returned ${download.status}`);
  const archive = await extractArchive(Buffer.from(await download.arrayBuffer()));
  try {
    const prefix = archive.files.includes("package/package.json") ? "package/" : "";
    const pkg = JSON.parse(await readArchiveFile(archive, `${prefix}package.json`)) as Parameters<typeof resolveEntrypoints>[0];
    const entries = resolveEntrypoints(pkg).filter((file) => archive.files.includes(`${prefix}${file}`));
    const names = new Set<string>();
    await init();
    for (const entry of entries.slice(0, 4)) {
      const code = await readArchiveFile(archive, `${prefix}${entry}`);
      try {
        const [, exports] = parse(code);
        for (const item of exports) {
          // `export * from` names nothing itself; its names belong to the target.
          if (item.type !== "reexport-all") names.add(item.name);
        }
      } catch {
        // An unparsable build simply contributes no names.
      }
    }
    if (names.size === 0) throw new Error(`no exports found in ${name}@${version}`);
    return { version, names: [...names].sort() };
  } finally {
    await archive.cleanup();
  }
}

const surface: Surface = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  versions: {},
  exports: {},
};

for (const target of TARGETS) {
  try {
    const { version, names } = await surfaceFor(target);
    surface.versions[target] = version;
    surface.exports[target] = names;
    console.log(`${target}@${version}: ${names.length} exports`);
  } catch (error) {
    console.warn(`${target}: skipped (${(error as Error).message})`);
  }
}

if (Object.keys(surface.exports).length === 0) throw new Error("no surfaces built");
const out = fileURLToPath(new URL("../../../rules/solid2-surface.json", import.meta.url));
await writeFile(out, `${JSON.stringify(surface, null, 2)}\n`);
console.log(`wrote ${out}`);
