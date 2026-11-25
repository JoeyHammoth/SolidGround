import { scanPackage } from "./index.js";

const target = process.argv.slice(2).find((value) => !value.startsWith("-"));
if (!target) {
  console.error("usage: pnpm scan <name>@<version>    e.g. pnpm scan solid-js@2.0.4");
  process.exit(2);
}

const at = target.lastIndexOf("@");
const name = at > 0 ? target.slice(0, at) : target;
const version = at > 0 ? target.slice(at + 1) : "latest";

try {
  const result = await scanPackage(name, version);
  console.log(`${result.name}@${result.version}: ${result.clean ? "clean" : "findings"} (surface ${result.surfaceVersion})`);
  console.log(`entrypoints: ${result.entrypoints.join(", ") || "none"}`);
  console.log(`files parsed: ${result.files.length}`);
  for (const finding of result.findings) {
    const where = finding.name ? `${finding.specifier}#${finding.name}` : (finding.specifier ?? finding.name);
    console.log(`  [${finding.code}] ${finding.file} :: ${where}${finding.hint ? ` — ${finding.hint}` : ""}`);
  }
  process.exitCode = result.clean ? 0 : 1;
} catch (error) {
  console.error(`scan failed: ${(error as Error).message}`);
  process.exitCode = 2;
}
