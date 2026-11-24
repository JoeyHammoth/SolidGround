import { validatePaths } from "./validate.js";

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: tsx packages/schema/src/cli.ts <path...>");
  process.exit(2);
}

const failures = await validatePaths(targets);
if (failures.length > 0) {
  console.error(`schema validation failed (${failures.length} problem(s))`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`schema validation passed for: ${targets.join(", ")}`);
