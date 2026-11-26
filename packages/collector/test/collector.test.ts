import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DatasetMeta, PackageRecord } from "@solid-ground/schema";
import { applyScan, writeDataset, type Dataset } from "../src/index.js";
import { fileSlug } from "../src/npm.js";
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

describe("dataset events", () => {
  function record(overrides: Partial<PackageRecord> = {}): PackageRecord {
    return {
      name: "@example/lib",
      status: "ready",
      checkedAt: "2026-11-25T06:00:00Z",
      solid2Version: "2.0.1",
      attestations: [],
      ...overrides,
    } as PackageRecord;
  }

  function dataset(records: PackageRecord[], generatedAt: string): Dataset {
    return {
      records,
      index: [],
      meta: { generatedAt } as DatasetMeta,
      solid: { schemaVersion: 1 } as Dataset["solid"],
    };
  }

  it("appends one event per change and nothing for an unchanged rerun", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "solid-ground-events-"));
    try {
      const previous = record({ status: "in-progress", checkedAt: "2026-11-24T06:00:00Z" });
      await mkdir(path.join(dir, "packages"), { recursive: true });
      await writeFile(
        path.join(dir, "packages", `${fileSlug(previous.name)}.json`),
        JSON.stringify(previous),
      );

      const next = record({ status: "ready", checkedAt: "2026-11-25T06:00:00Z" });
      const added = await writeDataset(dir, dataset([next], next.checkedAt));
      expect(added).toEqual([
        {
          schemaVersion: 1,
          name: "@example/lib",
          at: "2026-11-25T06:00:00Z",
          kind: "status",
          from: "in-progress",
          to: "ready",
        },
      ]);
      const first = await readFile(path.join(dir, "events.ndjson"), "utf8");
      expect(first.trim().split("\n")).toHaveLength(1);

      const rerun = record({ status: "ready", checkedAt: "2026-11-26T06:00:00Z" });
      expect(await writeDataset(dir, dataset([rerun], rerun.checkedAt))).toEqual([]);
      expect(await readFile(path.join(dir, "events.ndjson"), "utf8")).toBe(first);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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
