import { describe, expect, it } from "vitest";
import type { PackageRecord, SmokeResult, SolidState } from "@solid-ground/schema";
import { cellId, planBatch } from "../src/index.js";

function record(overrides: Partial<PackageRecord> = {}): PackageRecord {
  return {
    name: "@example/lib",
    status: "ready",
    recommendedVersion: "2.0.4",
    solid2Version: "2.0.4",
    ...overrides,
  } as PackageRecord;
}

const SOLID: SolidState = {
  stable2: "2.0.4",
  next: null,
  observedAt: "2026-11-26T00:00:00Z",
};

function result(overrides: Partial<SmokeResult> = {}): SmokeResult {
  return {
    schemaVersion: 1,
    name: "@example/lib",
    version: "2.0.4",
    solid: "2.0.4",
    channel: "stable",
    smoke: { import: true, build: true, types: null },
    entry: "esm",
    durationMs: 1000,
    error: null,
    at: "2026-11-26T00:00:00Z",
    ...overrides,
  };
}

const NOW = new Date("2026-11-27T00:00:00Z");

describe("planBatch", () => {
  it("plans one stable cell per record, in name order", () => {
    const cells = planBatch({
      records: [record({ name: "b-pkg" }), record({ name: "a-pkg" })],
      solid: SOLID,
      now: NOW,
    });
    expect(cells).toEqual([
      { name: "a-pkg", version: "2.0.4", solid: "2.0.4", channel: "stable" },
      { name: "b-pkg", version: "2.0.4", solid: "2.0.4", channel: "stable" },
    ]);
  });

  it("adds the next channel only when Solid publishes a prerelease", () => {
    const withNext = planBatch({
      records: [record()],
      solid: { ...SOLID, next: "2.1.0-next.1" },
      now: NOW,
    });
    expect(withNext.map((cell) => cell.channel)).toEqual(["stable", "next"]);
    expect(withNext[1]?.solid).toBe("2.1.0-next.1");

    const withoutNext = planBatch({
      records: [record()],
      solid: SOLID,
      includeNext: false,
      now: NOW,
    });
    expect(withoutNext).toHaveLength(1);
  });

  it("skips records with no recommended version", () => {
    const cells = planBatch({
      records: [record({ recommendedVersion: null }), record({ name: "b-pkg" })],
      solid: SOLID,
      now: NOW,
    });
    expect(cells.map((cell) => cell.name)).toEqual(["b-pkg"]);
  });

  it("skips a cell with a fresh result and plans a stale one again", () => {
    const known = [result()];
    expect(planBatch({ records: [record()], solid: SOLID, known, now: NOW })).toEqual([]);

    const stale = planBatch({
      records: [record()],
      solid: SOLID,
      known,
      now: new Date("2026-12-10T00:00:00Z"),
    });
    expect(stale).toHaveLength(1);
  });

  it("ignores fresh results that name a different cell", () => {
    const cells = planBatch({
      records: [record()],
      solid: { ...SOLID, next: "2.1.0-next.1" },
      known: [result()],
      now: NOW,
    });
    expect(cells).toHaveLength(1);
    expect(cells[0]?.channel).toBe("next");
  });

  it("replans everything under force", () => {
    const cells = planBatch({
      records: [record()],
      solid: SOLID,
      known: [result()],
      force: true,
      now: NOW,
    });
    expect(cells).toHaveLength(1);
  });

  it("stops at the cell cap so a batch rotates instead of growing", () => {
    const records = Array.from({ length: 5 }, (_, index) => record({ name: `pkg-${index}` }));
    const cells = planBatch({ records, solid: SOLID, maxCells: 3, now: NOW });
    expect(cells).toHaveLength(3);
    expect(cells.map(cellId)).toEqual(["pkg-0@2.0.4~2.0.4", "pkg-1@2.0.4~2.0.4", "pkg-2@2.0.4~2.0.4"]);
  });
});
