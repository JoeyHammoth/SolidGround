import { describe, expect, it } from "vitest";
import { datasetConsistencyProblems, type ConsistencyInput } from "../src/lib/consistency.js";

function input(overrides: Partial<ConsistencyInput> = {}): ConsistencyInput {
  return {
    meta: { counts: { total: 2 }, solid: { stable2: "2.0.4" } },
    index: [
      { name: "@example/a", status: "ready", verified: true },
      { name: "@example/b", status: "in-progress", verified: false },
    ],
    records: [
      { name: "@example/a", status: "ready", verified: true, schemaVersion: 1 },
      { name: "@example/b", status: "in-progress", verified: false, schemaVersion: 1 },
    ],
    solid: { stable2: "2.0.4" },
    ...overrides,
  };
}

describe("dataset consistency", () => {
  it("accepts files that agree", () => {
    expect(datasetConsistencyProblems(input())).toEqual([]);
  });

  it("reports a meta count that disagrees with the records", () => {
    const fixture = input();
    fixture.meta = { counts: { total: 3 }, solid: { stable2: "2.0.4" } };
    expect(datasetConsistencyProblems(fixture)).toContain("meta.counts.total 3 != 2 records");
  });

  it("reports an index that is missing a row", () => {
    const fixture = input();
    fixture.index = fixture.index.slice(0, 1);
    expect(datasetConsistencyProblems(fixture)).toContain(
      "index.json has 1 rows for 2 records",
    );
  });

  it("reports an index row without a record", () => {
    const fixture = input();
    fixture.index = [...fixture.index, { name: "@example/c", status: "ready", verified: true }];
    expect(datasetConsistencyProblems(fixture)).toContain(
      "index row @example/c has no record",
    );
  });

  it("reports an index row that disagrees with its record", () => {
    const fixture = input();
    fixture.index = [
      { name: "@example/a", status: "ready", verified: true },
      { name: "@example/b", status: "ready", verified: false },
    ];
    expect(datasetConsistencyProblems(fixture)).toContain(
      "index row @example/b disagrees with its record",
    );
  });

  it("reports a record written against another schema", () => {
    const fixture = input();
    fixture.records = [
      { name: "@example/a", status: "ready", verified: true, schemaVersion: 1 },
      { name: "@example/b", status: "in-progress", verified: false, schemaVersion: 2 },
    ];
    expect(datasetConsistencyProblems(fixture)).toContain("@example/b has schema 2");
  });

  it("reports a Solid version that disagrees between meta and solid.json", () => {
    const fixture = input();
    fixture.solid = { stable2: "2.0.5" };
    expect(datasetConsistencyProblems(fixture)).toContain(
      "meta.solid.stable2 2.0.4 != solid.stable2 2.0.5",
    );
  });
});
