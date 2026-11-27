import { describe, expect, it } from "vitest";
import type { PackageRecord, Policy, SmokeResult, SolidState } from "@solid-ground/schema";
import { environmentalFailure, foldSmoke, isFresh, smokeResult } from "../src/index.js";

const POLICY: Policy = {
  version: "2026.11.1",
  unmaintainedAfterMonths: 18,
  staleness: {
    metadataHours: 26,
    staticScanDays: 30,
    smokeDays: 30,
    attestationDays: 90,
  },
};

const SOLID: SolidState = {
  stable2: "2.0.4",
  next: null,
  observedAt: "2026-11-26T00:00:00Z",
};

function record(overrides: Partial<PackageRecord> = {}): PackageRecord {
  return {
    name: "@example/lib",
    status: "ready",
    confidence: ["D", "S", "U"],
    verified: false,
    recommendedVersion: "2.0.4",
    solid2Version: "2.0.4",
    shipsTypes: true,
    tested: { solid: "2.0.4", solidNext: null, rules: "2026.11.1", tool: "0.1.0" },
    smoke: { import: null, build: null, types: null },
    ...overrides,
  } as PackageRecord;
}

function result(overrides: Partial<SmokeResult> = {}): SmokeResult {
  return {
    schemaVersion: 1,
    name: "@example/lib",
    version: "2.0.4",
    solid: "2.0.4",
    channel: "stable",
    smoke: { import: true, build: true, types: true },
    entry: "esm",
    durationMs: 1000,
    error: null,
    at: "2026-11-26T00:00:00Z",
    ...overrides,
  };
}

const NOW = new Date("2026-11-27T00:00:00Z");

describe("smokeResult", () => {
  it("writes absent optional fields as null rather than omitting them", () => {
    const built = smokeResult({
      name: "@example/lib",
      version: "2.0.4",
      solid: "2.0.4",
      channel: "stable",
      smoke: { import: true, build: null, types: null },
      at: "2026-11-26T00:00:00Z",
    });
    expect(built.entry).toBeNull();
    expect(built.durationMs).toBeNull();
    expect(built.error).toBeNull();
  });

  it("records an environmental failure as nulls, never as a failure", () => {
    const failed = environmentalFailure({
      name: "@example/lib",
      version: "2.0.4",
      solid: "2.0.4",
      channel: "stable",
      at: "2026-11-26T00:00:00Z",
      error: "registry returned 429",
    });
    expect(failed.smoke).toEqual({ import: null, build: null, types: null });
    expect(failed.error).toBe("registry returned 429");
  });
});

describe("isFresh", () => {
  it("measures from the result timestamp, not the clock", () => {
    expect(isFresh("2026-11-26T00:00:00Z", NOW, 7)).toBe(true);
    expect(isFresh("2026-11-01T00:00:00Z", NOW, 7)).toBe(false);
    expect(isFresh("not a date", NOW, 7)).toBe(false);
  });
});

describe("foldSmoke", () => {
  it("marks a passing import as verified with B and T evidence", () => {
    const folded = foldSmoke(record(), [result()], POLICY, SOLID, NOW);
    expect(folded.verified).toBe(true);
    expect(folded.smoke).toEqual({ import: true, build: true, types: true });
    expect(folded.confidence).toEqual(["D", "S", "B", "T", "U"]);
  });

  it("stamps the record with when the folded pass finished", () => {
    const folded = foldSmoke(record(), [result()], POLICY, SOLID, NOW);
    expect(folded.smokeAt).toBe("2026-11-26T00:00:00Z");
  });

  it("ages a pass out while Solid stands still", () => {
    const aged = record({
      verified: true,
      confidence: ["D", "S", "B"],
      smokeAt: "2026-09-01T00:00:00Z",
      smoke: { import: true, build: true, types: null },
    });
    const folded = foldSmoke(aged, [], POLICY, SOLID, NOW);
    expect(folded.verified).toBe(false);
    expect(folded.smokeAt).toBeNull();
    expect(folded.confidence).toEqual(["D", "S"]);
  });

  it("keeps a pass inside the policy window", () => {
    const freshPass = record({
      verified: true,
      confidence: ["D", "S", "B"],
      smokeAt: "2026-11-20T00:00:00Z",
      smoke: { import: true, build: true, types: null },
    });
    expect(foldSmoke(freshPass, [], POLICY, SOLID, NOW)).toBe(freshPass);
  });

  it("leaves an edition published before smokeAt existed alone", () => {
    const legacy = record({
      verified: true,
      confidence: ["D", "S", "B"],
      tested: { solid: "2.0.4", solidNext: null, rules: "2026.10.1", tool: "0.1.0" },
      smoke: { import: true, build: true, types: null },
    });
    delete (legacy as { smokeAt?: string | null }).smokeAt;
    expect(foldSmoke(legacy, [], POLICY, SOLID, NOW)).toBe(legacy);
  });

  it("withholds T when the package does not ship types", () => {
    const folded = foldSmoke(record({ shipsTypes: false }), [result()], POLICY, SOLID, NOW);
    expect(folded.confidence).toEqual(["D", "S", "B", "U"]);
  });

  it("does not verify a package that failed to import", () => {
    const failing = result({ smoke: { import: false, build: null, types: null } });
    const folded = foldSmoke(record(), [failing], POLICY, SOLID, NOW);
    expect(folded.verified).toBe(false);
    expect(folded.confidence).toEqual(["D", "S", "U"]);
  });

  it("ignores a result for another version", () => {
    const other = result({ version: "2.0.1" });
    expect(foldSmoke(record(), [other], POLICY, SOLID, NOW).smoke.import).toBeNull();
  });

  it("ignores a result against another Solid release", () => {
    const other = result({ solid: "2.0.3" });
    expect(foldSmoke(record(), [other], POLICY, SOLID, NOW).verified).toBe(false);
  });

  it("ignores a result older than the policy window", () => {
    const old = result({ at: "2026-09-01T00:00:00Z" });
    expect(foldSmoke(record(), [old], POLICY, SOLID, NOW).verified).toBe(false);
  });

  it("keeps the newest fresh result when several are published", () => {
    const older = result({ smoke: { import: false, build: null, types: null } });
    const newer = result({
      at: "2026-11-26T12:00:00Z",
      smoke: { import: true, build: true, types: null },
    });
    const folded = foldSmoke(record(), [older, newer], POLICY, SOLID, NOW);
    expect(folded.verified).toBe(true);
  });

  it("clears a verification that no longer covers the Solid release under test", () => {
    const verified = record({
      verified: true,
      confidence: ["D", "S", "B"],
      tested: { solid: "2.0.3", solidNext: null, rules: "2026.10.1", tool: "0.1.0" },
      smoke: { import: true, build: true, types: null },
    });
    const folded = foldSmoke(verified, [], POLICY, SOLID, NOW);
    expect(folded.verified).toBe(false);
    expect(folded.confidence).toEqual(["D", "S"]);
  });

  it("leaves a record alone when there is nothing to fold and nothing went stale", () => {
    const unchanged = record();
    expect(foldSmoke(unchanged, [], POLICY, SOLID, NOW)).toBe(unchanged);
  });

  it("leaves a record with no recommended version alone", () => {
    const blocked = record({ status: "blocked", recommendedVersion: null });
    expect(foldSmoke(blocked, [result()], POLICY, SOLID, NOW)).toBe(blocked);
  });

  it("is deterministic for the same inputs", () => {
    const once = foldSmoke(record(), [result()], POLICY, SOLID, NOW);
    const twice = foldSmoke(record(), [result()], POLICY, SOLID, NOW);
    expect(once).toEqual(twice);
  });
});
