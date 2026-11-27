import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateIndexRow, validateIndexRows, validatePaths } from "../src/index.js";

const row = {
  name: "@example/lib",
  status: "ready",
  confidence: ["D", "B"],
  verified: true,
  solid2Version: "2.0.4",
  category: "state",
  family: null,
  downloadsWeekly: 1200,
  checkedAt: "2026-11-26T00:00:00Z",
};

describe("index rows", () => {
  it("accepts a row without smoke evidence, as older editions publish it", () => {
    expect(validateIndexRow(row)).toEqual([]);
  });

  it("accepts the subpath and root-pass smoke fields", () => {
    expect(validateIndexRow({ ...row, smokeTarget: "@example/lib/widget" })).toEqual([]);
    expect(
      validateIndexRow({ ...row, smokeTarget: null, smokeAt: "2026-11-26T00:00:00Z" }),
    ).toEqual([]);
  });

  it("rejects a malformed smoke date and an unknown field", () => {
    expect(validateIndexRow({ ...row, smokeAt: "last Tuesday" }).join(" ")).toContain("smokeAt");
    expect(validateIndexRow({ ...row, smoke: true }).join(" ")).toContain("additional");
  });

  it("names the failing row by position", () => {
    const failures = validateIndexRows([row, { ...row, status: "shipped" }], "index.json");
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("index.json[1]");
  });

  it("accepts a fixture shaped like a published row with smoke evidence", () => {
    const fixture: unknown = JSON.parse(
      readFileSync(new URL("./fixtures/published-index-row.json", import.meta.url), "utf8"),
    );
    expect(validateIndexRow(fixture)).toEqual([]);
  });

  it("validates index.json on disk, where publishes actually write it", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sg-index-"));
    try {
      await writeFile(
        path.join(dir, "index.json"),
        `${JSON.stringify([{ ...row, smokeAt: "not-a-date" }])}\n`,
        "utf8",
      );
      const failures = await validatePaths([dir]);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain("index.json[0]");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
