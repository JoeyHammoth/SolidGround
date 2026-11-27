import { describe, expect, it } from "vitest";
import type { DatasetMeta } from "@solid-ground/schema";
import { diffMeta } from "../src/index.js";

function meta(overrides: Partial<DatasetMeta> = {}): DatasetMeta {
  return {
    schemaVersion: 1,
    generatedAt: "2026-11-25T06:00:00Z",
    lastSuccessfulCollect: "2026-11-25T06:00:00Z",
    lastSuccessfulVerify: null,
    solid: { stable2: "2.0.3", next: "2.0.0-rc.23", observedAt: "2026-11-25T06:00:00Z" },
    counts: {
      ready: 7,
      prerelease: 2,
      "in-progress": 0,
      blocked: 5,
      unmaintained: 0,
      agnostic: 0,
      unknown: 0,
      total: 14,
    },
    versions: { rules: "2026.11.1", tool: "0.1.0", schema: 1 },
    coverage: { tracked: 14, curated: 14, candidates: 0 },
    anomaly: { held: false, reasons: [] },
    ...overrides,
  };
}

describe("diffMeta", () => {
  it("says nothing about the first edition", () => {
    expect(diffMeta(null, meta())).toEqual([]);
  });

  it("reports a Solid release", () => {
    const previous = meta({ solid: { stable2: "2.0.3", next: null, observedAt: "2026-11-24T00:00:00Z" } });
    const next = meta({
      generatedAt: "2026-11-25T06:00:00Z",
      solid: { stable2: "2.0.4", next: null, observedAt: "2026-11-25T06:00:00Z" },
    });
    expect(diffMeta(previous, next)).toEqual([
      {
        schemaVersion: 1,
        name: "solid-js",
        at: "2026-11-25T06:00:00Z",
        kind: "solid",
        from: "2.0.3",
        to: "2.0.4",
      },
    ]);
  });

  it("reports a move on the next line separately from stable", () => {
    const previous = meta({
      solid: { stable2: "2.0.3", next: "2.0.0-rc.23", observedAt: "2026-11-24T00:00:00Z" },
    });
    const next = meta({
      solid: { stable2: "2.0.3", next: "2.1.0-next.1", observedAt: "2026-11-25T06:00:00Z" },
    });
    expect(diffMeta(previous, next)).toEqual([
      {
        schemaVersion: 1,
        name: "solid-js",
        at: "2026-11-25T06:00:00Z",
        kind: "solid",
        from: "2.0.0-rc.23",
        to: "2.1.0-next.1",
      },
    ]);
  });

  it("stays quiet when the next line disappears", () => {
    const previous = meta({
      solid: { stable2: "2.0.3", next: "2.1.0-next.1", observedAt: "2026-11-24T00:00:00Z" },
    });
    const next = meta({ solid: { stable2: "2.0.3", next: null, observedAt: "2026-11-25T06:00:00Z" } });
    expect(diffMeta(previous, next)).toEqual([]);
  });

  it("reports a rules version change", () => {
    const previous = meta({ versions: { rules: "2026.10.1", tool: "0.1.0", schema: 1 } });
    expect(diffMeta(previous, meta())).toEqual([
      {
        schemaVersion: 1,
        name: "rules",
        at: "2026-11-25T06:00:00Z",
        kind: "rules",
        from: "2026.10.1",
        to: "2026.11.1",
      },
    ]);
  });

  it("reports an anomaly hold appearing, changing and clearing", () => {
    const held = meta({ anomaly: { held: true, reasons: ["4 packages failed to collect"] } });
    expect(diffMeta(meta(), held)).toEqual([
      {
        schemaVersion: 1,
        name: "dataset",
        at: "2026-11-25T06:00:00Z",
        kind: "anomaly",
        from: "clear",
        to: "4 packages failed to collect",
      },
    ]);

    const worse = meta({
      anomaly: { held: true, reasons: ["4 packages failed to collect", "status counts disagree"] },
    });
    expect(diffMeta(held, worse)).toHaveLength(1);
    expect(diffMeta(worse, held)[0]).toMatchObject({
      kind: "anomaly",
      from: "4 packages failed to collect; status counts disagree",
      to: "4 packages failed to collect",
    });
    expect(diffMeta(held, meta())[0]).toMatchObject({ from: "4 packages failed to collect", to: "clear" });
  });

  it("emits nothing for an unchanged edition", () => {
    expect(diffMeta(meta(), meta({ generatedAt: "2026-11-26T06:00:00Z" }))).toEqual([]);
  });
});
