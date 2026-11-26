import { describe, expect, it } from "vitest";
import type { PackageRecord } from "@solid-ground/schema";
import { diffRecords } from "../src/index.js";

function record(overrides: Partial<PackageRecord>): PackageRecord {
  return {
    schemaVersion: 1,
    name: "@example/lib",
    family: null,
    category: "state",
    repository: "https://github.com/example/lib",
    status: "ready",
    confidence: ["D"],
    verified: false,
    reasons: [],
    recommendedVersion: "2.0.1",
    solid2Version: "2.0.1",
    solid2Tag: null,
    lines: [],
    upstream: { hasSolid2Work: false, isArchived: false, links: [] },
    attestations: [],
    smoke: { import: null, build: null, types: null },
    shipsTypes: true,
    checkedAt: "2026-11-25T06:00:00Z",
    tested: { solid: "2.0.3", solidNext: null, rules: "2026.11.1", tool: "solid-ground 0.1.0" },
    downloadsWeekly: 1000,
    links: {
      npm: "https://www.npmjs.com/package/@example/lib",
      repository: "https://github.com/example/lib",
      migration: "https://docs.solidjs.com/migration/from-solid-1",
    },
    ...overrides,
  };
}

describe("diffRecords", () => {
  it("emits one new event for a package with no previous record", () => {
    const next = record({ checkedAt: "2026-11-25T06:00:00Z" });
    expect(diffRecords(null, next)).toEqual([
      { schemaVersion: 1, name: "@example/lib", at: "2026-11-25T06:00:00Z", kind: "new", from: null, to: "ready" },
    ]);
  });

  it("emits one status event when the status changes", () => {
    const previous = record({ status: "in-progress", solid2Version: "2.0.1" });
    const next = record({ status: "ready", solid2Version: "2.0.1", checkedAt: "2026-11-25T07:00:00Z" });
    expect(diffRecords(previous, next)).toEqual([
      { schemaVersion: 1, name: "@example/lib", at: "2026-11-25T07:00:00Z", kind: "status", from: "in-progress", to: "ready" },
    ]);
  });

  it("emits one version event when only the Solid 2 version changes", () => {
    const previous = record({ status: "ready", solid2Version: "2.0.1" });
    const next = record({ status: "ready", solid2Version: "2.0.2", checkedAt: "2026-11-25T07:00:00Z" });
    expect(diffRecords(previous, next)).toEqual([
      { schemaVersion: 1, name: "@example/lib", at: "2026-11-25T07:00:00Z", kind: "version", from: "2.0.1", to: "2.0.2" },
    ]);
  });

  it("emits only the status event when both the status and the version change", () => {
    const previous = record({ status: "in-progress", solid2Version: "2.0.1" });
    const next = record({ status: "ready", solid2Version: "2.0.2", checkedAt: "2026-11-25T07:00:00Z" });
    expect(diffRecords(previous, next)).toEqual([
      { schemaVersion: 1, name: "@example/lib", at: "2026-11-25T07:00:00Z", kind: "status", from: "in-progress", to: "ready" },
    ]);
  });

  it("emits nothing for an unchanged rerun", () => {
    const previous = record({ status: "ready", solid2Version: "2.0.1" });
    const next = record({ status: "ready", solid2Version: "2.0.1", checkedAt: "2026-11-25T07:00:00Z" });
    expect(diffRecords(previous, next)).toEqual([]);
  });
});
