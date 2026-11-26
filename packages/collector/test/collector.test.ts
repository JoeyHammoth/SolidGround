import { describe, expect, it } from "vitest";
import { applyScan } from "../src/index.js";
import {
  detectSolidState,
  highestStable2,
  normalizeRepository,
  retainedVersions,
  toEvidence,
} from "../src/npm.js";

const packument = {
  name: "@example/lib",
  "dist-tags": { latest: "0.13.14", next: "2.0.0-alpha.5" },
  versions: {
    "0.13.14": {
      peerDependencies: { "solid-js": "^1.9.8" },
      types: "./index.d.ts",
    },
    "2.0.0-alpha.5": {
      peerDependencies: { "solid-js": "^2.0.0-0" },
    },
    "0.12.0": { peerDependencies: { "solid-js": "^1.8.0" } },
    "2.0.0-rc.1": { peerDependencies: { "solid-js": "^2.0.0-0" } },
  },
  time: {
    "0.13.14": "2026-10-01T00:00:00Z",
    "2.0.0-alpha.5": "2026-11-01T00:00:00Z",
    "0.12.0": "2025-01-01T00:00:00Z",
    "2.0.0-rc.1": "2026-11-10T00:00:00Z",
  },
  repository: { url: "git+https://github.com/example/lib.git" },
};

const entry = {
  name: "@example/lib",
  category: "ui-components",
  tracked: true,
  family: null,
  attestations: [],
};

describe("packument normalisation", () => {
  it("retains dist-tag targets and the newest stable of each major", () => {
    const versions = retainedVersions(packument);
    expect(versions).toContain("0.13.14");
    expect(versions).toContain("2.0.0-alpha.5");
    expect(versions).toContain("0.12.0");
  });

  it("normalises GitHub shorthand and https URLs", () => {
    expect(normalizeRepository("git+https://github.com/example/lib.git")).toBe(
      "https://github.com/example/lib",
    );
    expect(normalizeRepository("github:example/lib")).toBe("https://github.com/example/lib");
    expect(normalizeRepository("https://gitlab.com/example/lib")).toBe(
      "https://gitlab.com/example/lib",
    );
  });

  it("extracts declared Solid ranges per line", () => {
    const evidence = toEvidence(entry, packument, 1234);
    expect(evidence.dependsOnSolid).toBe(true);
    expect(evidence.shipsTypes).toBe(true);
    expect(evidence.downloadsWeekly).toBe(1234);
    expect(evidence.repository).toBe("https://github.com/example/lib");
    const next = evidence.lines.find((line) => line.version === "2.0.0-alpha.5");
    expect(next?.solidRange).toBe("^2.0.0-0");
    expect(next?.stability).toBe("prerelease");
    expect(next?.phase).toBe("alpha");
    expect(next?.tag).toBe("next");
  });

  it("marks a package without a Solid range as agnostic-eligible", () => {
    const evidence = toEvidence(
      { ...entry, name: "left-pad" },
      { "dist-tags": { latest: "1.0.0" }, versions: { "1.0.0": {} } },
      null,
    );
    expect(evidence.dependsOnSolid).toBe(false);
  });
});

describe("static scan enrichment", () => {
  it("applies a verdict only to the line that was scanned", () => {
    const lines = [
      { version: "2.0.4", clean: null },
      { version: "1.9.20", clean: null },
    ] as unknown as Parameters<typeof applyScan>[0];
    const scanned = applyScan(lines, { "2.0.4": true });
    expect(scanned[0]?.clean).toBe(true);
    expect(scanned[1]?.clean).toBeNull();
  });

  it("leaves every line untouched when nothing was scanned", () => {
    const lines = [{ version: "2.0.4", clean: false }] as unknown as Parameters<typeof applyScan>[0];
    expect(applyScan(lines, {})).toEqual(lines);
  });
});

describe("Solid state detection", () => {
  it("finds the highest stable 2.x version regardless of tags", () => {
    expect(
      highestStable2({
        "dist-tags": { latest: "2.0.3" },
        versions: { "2.0.3": {}, "2.1.0-next.4": {}, "1.9.20": {} },
      }),
    ).toBe("2.0.3");
  });

  it("throws when Solid 2 is not published yet", () => {
    expect(() => detectSolidState({ versions: { "1.9.20": {} } }, "2026-01-01")).toThrow();
  });
});
