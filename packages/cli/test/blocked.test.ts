import { describe, expect, it } from "vitest";
import type { DatasetMeta, PackageRecord, Policy } from "@solid-ground/schema";
import { renderBlockedReport } from "../src/blocked.js";

const POLICY: Pick<Policy, "unmaintainedAfterMonths"> = {
  unmaintainedAfterMonths: 18,
};

const META: Pick<DatasetMeta, "solid" | "versions" | "coverage"> = {
  solid: { stable2: "2.0.4", next: null, observedAt: "2026-11-27T00:00:00Z" },
  versions: { rules: "2026.11.1", tool: "0.1.0", schema: 1 },
  coverage: { tracked: 3, curated: 3, candidates: 0 },
};

function record(overrides: Partial<PackageRecord>): PackageRecord {
  return {
    schemaVersion: 1,
    name: "@example/lib",
    status: "blocked",
    confidence: [],
    verified: false,
    recommendedVersion: null,
    solid2Version: null,
    reasons: [],
    lines: [],
    upstream: { hasSolid2Work: false, isArchived: false, links: [] },
    attestations: [],
    smoke: { import: null, build: null, types: null },
    shipsTypes: false,
    checkedAt: "2026-11-27T00:00:00Z",
    tested: { solid: "2.0.4", solidNext: null, rules: "2026.11.1", tool: "0.1.0" },
    ...overrides,
  } as PackageRecord;
}

function line(overrides: Partial<PackageRecord["lines"][number]>): PackageRecord["lines"][number] {
  return {
    version: "1.0.0",
    tag: "latest",
    stability: "stable",
    phase: "stable",
    solidRange: "^1.9.0",
    parsed: true,
    admitsSolid2: false,
    clean: true,
    publishedAt: "2025-06-14T00:00:00Z",
    deprecated: false,
    ...overrides,
  };
}

function report(records: PackageRecord[]) {
  return renderBlockedReport({
    records,
    registry: new Map([
      [
        "@example/superseded",
        { name: "@example/superseded", supersededBy: "@example/successor" },
      ],
    ]),
    meta: META,
    policy: POLICY,
  });
}

describe("renderBlockedReport", () => {
  it("describes a range-only block and its successor", () => {
    const text = report([
      record({ name: "@example/lib", lines: [line({})] }),
      record({
        name: "@example/superseded",
        lines: [line({ version: "2.0.0", publishedAt: "2025-01-10T00:00:00Z" })],
      }),
      record({ name: "ready", status: "ready", lines: [line({})] }),
    ]);

    expect(text).toContain("2 of 3 tracked packages are `blocked`");
    expect(text).toContain("declares `^1.9.0`, which excludes 2.x");
    expect(text).toContain("A release whose peer range admits 2.x");
    expect(text).toContain("Nothing for this package: `@example/successor` is the successor.");
    expect(text).not.toContain("| `ready` |");
  });

  it("separates a code block from a range block", () => {
    const text = report([
      record({
        name: "@example/lib",
        lines: [line({ clean: false, version: "0.19.0" })],
      }),
    ]);
    expect(text).toContain("published code imports APIs Solid 2 removed");
    expect(text).toContain("A release ported to Solid 2; a wider peer range alone");
    expect(text).toContain("1 also ships code");
  });

  it("computes the unmaintained window from the latest stable release", () => {
    const text = report([
      record({ name: "@example/lib", lines: [line({ publishedAt: "2025-06-14T00:00:00Z" })] }),
    ]);
    expect(text).toContain("| `@example/lib` | `1.0.0` | 2026-12-14 |");
  });

  it("is deterministic for the same edition", () => {
    const records = [record({ name: "@example/lib", lines: [line({})] })];
    expect(report(records)).toBe(report(records));
  });
});
