/**
 * Cross-file checks the site can run without the Ajv validators. Astro's
 * prerender chunking breaks the validators' `createRequire` schema loading, so
 * the deploy enforces the JSON schemas and the site checks that the files agree
 * with each other.
 */

export interface ConsistencyInput {
  meta: { counts: { total: number }; solid: { stable2: string } };
  index: ReadonlyArray<{ name: string; status: string; verified: boolean }>;
  records: ReadonlyArray<{
    name: string;
    status: string;
    verified: boolean;
    schemaVersion: number;
  }>;
  solid: { stable2: string };
}

export function datasetConsistencyProblems(input: ConsistencyInput): string[] {
  const problems: string[] = [];
  const { meta, index, records, solid } = input;

  if (meta.counts.total !== records.length)
    problems.push(`meta.counts.total ${meta.counts.total} != ${records.length} records`);
  if (index.length !== records.length)
    problems.push(`index.json has ${index.length} rows for ${records.length} records`);

  const byName = new Map(records.map((record) => [record.name, record]));
  for (const row of index) {
    const record = byName.get(row.name);
    if (!record) {
      problems.push(`index row ${row.name} has no record`);
      continue;
    }
    if (record.status !== row.status || record.verified !== row.verified)
      problems.push(`index row ${row.name} disagrees with its record`);
  }

  for (const record of records) {
    if (record.schemaVersion !== 1)
      problems.push(`${record.name} has schema ${String(record.schemaVersion)}`);
  }

  if (meta.solid.stable2 !== solid.stable2)
    problems.push(`meta.solid.stable2 ${meta.solid.stable2} != solid.stable2 ${solid.stable2}`);

  return problems;
}
