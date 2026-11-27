import { describe, expect, it } from "vitest";
import { validateSmokeResult } from "../src/index.js";

function cell(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    name: "@example/lib",
    version: "2.0.4",
    solid: "2.0.4",
    channel: "stable",
    smoke: { import: true, build: true, types: null },
    entry: "esm",
    durationMs: 41230,
    error: null,
    at: "2026-11-26T00:00:00Z",
    ...overrides,
  };
}

describe("validateSmokeResult", () => {
  it("accepts a full cell", () => {
    expect(validateSmokeResult(cell())).toEqual([]);
  });

  it("accepts an environmental failure: nulls plus a reason", () => {
    expect(
      validateSmokeResult(
        cell({
          smoke: { import: null, build: null, types: null },
          error: "registry returned 429",
        }),
      ),
    ).toEqual([]);
  });

  it("requires the timestamp freshness is measured from", () => {
    const withoutAt = cell();
    delete withoutAt.at;
    expect(validateSmokeResult(withoutAt).join(" ")).toContain("at");
  });

  it("requires all three steps, so a pass cannot omit one", () => {
    expect(
      validateSmokeResult(cell({ smoke: { import: true } })).join(" "),
    ).toContain("build");
  });

  it("rejects an unknown channel and a negative duration", () => {
    expect(validateSmokeResult(cell({ channel: "canary" }))).toHaveLength(1);
    expect(validateSmokeResult(cell({ durationMs: -1 }))).toHaveLength(1);
  });

  it("rejects stray fields", () => {
    expect(validateSmokeResult(cell({ retries: 1 }))).toHaveLength(1);
  });
});
