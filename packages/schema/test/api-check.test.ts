import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateApiCheck, validatePaths } from "../src/index.js";

const recorded = {
  schemaVersion: 1,
  ok: true,
  checkedAt: "2026-11-28T02:00:23Z",
  base: "https://joeyhammoth.github.io/SolidGround",
  endpoints: 6,
  problems: [],
  fixture: {
    status: "behind",
    lastRun: "2026-11-28T01:06:11.353Z",
    refresh: "blocked",
    issue: 94,
  },
};

describe("api-check.json", () => {
  it("accepts what the Verify job writes", () => {
    expect(validateApiCheck(recorded)).toEqual([]);
    expect(validateApiCheck({ ...recorded, fixture: null })).toEqual([]);
    expect(
      validateApiCheck({ ...recorded, fixture: { status: "current", lastRun: null } }),
    ).toEqual([]);
    expect(
      validateApiCheck({
        ...recorded,
        fixture: { ...recorded.fixture, refresh: null, issue: null },
      }),
    ).toEqual([]);
  });

  it("rejects a record the site would have to guess about", () => {
    expect(validateApiCheck({ ...recorded, ok: "yes" }).join(" ")).toContain("ok");
    expect(
      validateApiCheck({ ...recorded, fixture: { ...recorded.fixture, refresh: "merged" } }).join(
        " ",
      ),
    ).toContain("refresh");
    expect(
      validateApiCheck({ ...recorded, fixture: { ...recorded.fixture, issue: 0 } }).join(" "),
    ).toContain("issue");
    expect(validateApiCheck({ ...recorded, problem: [] }).join(" ")).toContain("additional");
  });

  it("is checked by validatePaths, with the path in the message", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sg-api-check-"));
    try {
      await writeFile(
        path.join(dir, "api-check.json"),
        JSON.stringify({ ...recorded, ok: "yes" }),
        "utf8",
      );
      const failures = await validatePaths([dir]);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain("api-check.json");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
