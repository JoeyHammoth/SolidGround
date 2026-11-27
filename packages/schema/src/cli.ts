import { validatePaths } from "./validate.js";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const targets = args.filter((arg) => arg !== "--json");
if (targets.length === 0) {
  console.error("usage: tsx packages/schema/src/cli.ts [--json] <path...>");
  process.exit(2);
}

const failures = await validatePaths(targets);
if (asJson) {
  console.log(
    JSON.stringify(
      {
        ok: failures.length === 0,
        checkedAt: new Date().toISOString(),
        targets,
        problems: failures,
      },
      null,
      2,
    ),
  );
}
if (failures.length > 0) {
  if (!asJson) {
    console.error(`schema validation failed (${failures.length} problem(s))`);
    for (const failure of failures) console.error(`  - ${failure}`);
  }
  process.exit(1);
}

if (!asJson) console.log(`schema validation passed for: ${targets.join(", ")}`);
