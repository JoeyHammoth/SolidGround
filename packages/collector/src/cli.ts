import path from "node:path";
import { buildDataset, detectSolidState, loadPolicy, loadRegistry, writeDataset } from "./index.js";
import { fetchPackument } from "./npm.js";
import { createScanner } from "./scan.js";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value ?? fallback;
}

const registryDir = path.resolve(arg("registry", "registry"));
const rulesDir = path.resolve(arg("rules", "rules"));
const outDir = path.resolve(arg("out", "data"));
const noDownloads = process.argv.includes("--no-downloads");
const withScan = process.argv.includes("--scan");

const [entries, policy] = await Promise.all([loadRegistry(registryDir), loadPolicy(rulesDir)]);
console.log(`collecting ${entries.length} tracked packages into ${outDir}`);

const { packument } = await fetchPackument("solid-js");
const observedAt = new Date().toISOString();
const solid = detectSolidState(packument, observedAt);
console.log(`Solid stable 2: ${solid.stable2}; next: ${solid.next ?? "none"}`);

const dataset = await buildDataset({
  entries,
  policy,
  solid: { stable2: solid.stable2, next: solid.next, observedAt },
  includeDownloads: !noDownloads,
  ...(withScan ? { scan: createScanner() } : {}),
  onProgress: (message) => console.log(`  ${message}`),
});

await writeDataset(outDir, dataset);
console.log(
  `wrote ${dataset.records.length} records; statuses: ${JSON.stringify(dataset.meta.counts)}`,
);
