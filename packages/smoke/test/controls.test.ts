import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SmokeResult } from "@solid-ground/schema";
import { CONTROLS, checkControls, controlCells } from "../src/controls.js";

function result(overrides: Partial<SmokeResult> = {}): SmokeResult {
  return {
    schemaVersion: 1,
    name: "@solid-ground/control-good",
    version: "0.0.0",
    solid: "2.0.4",
    channel: "stable",
    smoke: { import: true, build: true, types: true },
    entry: "esm",
    durationMs: 1000,
    error: null,
    at: "2026-11-27T00:00:00Z",
    ...overrides,
  };
}

const GOOD = result();
const BAD = result({
  name: "@solid-ground/control-bad",
  smoke: { import: false, build: null, types: null },
});
const SUBPATH = result({
  name: "@solid-ground/control-subpath",
  target: "@solid-ground/control-subpath/widget",
});

describe("control fixtures", () => {
  it("ship every file their manifest points at, so a gitignored path cannot vanish", () => {
    for (const control of CONTROLS) {
      const dir = path.resolve(control.path);
      const manifest = JSON.parse(
        readFileSync(path.join(dir, "package.json"), "utf8"),
      ) as {
        main?: string;
        module?: string;
        types?: string;
        exports?: Record<string, unknown>;
      };
      const targets = [manifest.main, manifest.module, manifest.types].filter(
        (target): target is string => typeof target === "string",
      );
      for (const entry of Object.values(manifest.exports ?? {})) {
        if (typeof entry === "string") targets.push(entry);
        else if (typeof entry === "object" && entry !== null) {
          for (const value of Object.values(entry)) {
            if (typeof value === "string") targets.push(value);
          }
        }
      }
      for (const target of targets) {
        expect(existsSync(path.join(dir, target)), `${control.id}: ${target}`).toBe(true);
      }
    }
  });
});

describe("controlCells", () => {
  it("runs both controls against the Solid release under test", () => {
    const cells = controlCells("2.0.4");
    expect(cells.map((cell) => cell.id)).toEqual([
      "control-good",
      "control-bad",
      "control-subpath",
    ]);
    expect(
      cells.every(
        (cell) => cell.solid === "2.0.4" && cell.channel === "stable",
      ),
    ).toBe(true);
    const paths = cells.map((cell) => cell.source.path);
    for (const control of CONTROLS) expect(paths).toContain(control.path);
  });

  it("does not build the known-bad control, which cannot import", () => {
    const bad = controlCells("2.0.4").find((cell) => cell.id === "control-bad");
    expect(bad?.steps).toEqual({ import: true, build: false, types: false });
  });
});

describe("checkControls", () => {
  it("accepts a batch where every control answered as expected", () => {
    expect(checkControls([GOOD, BAD, SUBPATH])).toEqual([]);
  });

  it("rejects a batch where the good control failed to import", () => {
    const broken = result({
      smoke: { import: false, build: true, types: true },
    });
    expect(checkControls([broken, BAD, SUBPATH])).toEqual([
      "control-good: import was false, expected true",
    ]);
  });

  it("rejects a batch where the known-bad control passed", () => {
    const wrong = result({
      name: "@solid-ground/control-bad",
      smoke: { import: true, build: null, types: null },
    });
    expect(checkControls([GOOD, wrong, SUBPATH])).toEqual([
      "control-bad: import was true, expected false",
    ]);
  });

  it("rejects a batch with a missing control", () => {
    expect(checkControls([GOOD, SUBPATH])).toEqual([
      "control-bad: no result in the batch",
    ]);
  });

  it("rejects a control that only reached an environmental failure", () => {
    const failed = result({
      smoke: { import: null, build: null, types: null },
      error: "pnpm install failed: 429 Too Many Requests",
    });
    const failures = checkControls([failed, BAD, SUBPATH]);
    expect(failures[0]).toContain("environmental failure");
    expect(failures).toContain("control-good: import was null, expected true");
  });

  it("rejects a subpath control that probed the package root", () => {
    const atRoot = result({ name: "@solid-ground/control-subpath", target: null });
    expect(checkControls([GOOD, BAD, atRoot])).toEqual([
      "control-subpath: probed null, expected @solid-ground/control-subpath/widget",
    ]);
  });

  it("checks the newest result for a control", () => {
    const older = result({
      smoke: { import: false, build: true, types: true },
    });
    const newer = result({ at: "2026-11-27T01:00:00Z" });
    expect(checkControls([older, newer, BAD, SUBPATH])).toEqual([]);
  });
});
