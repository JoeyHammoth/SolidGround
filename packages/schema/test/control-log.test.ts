import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateControlLog,
  validateControlSummary,
  validatePaths,
} from "../src/index.js";

const log = readFileSync(new URL("./fixtures/control-log.jsonl", import.meta.url), "utf8");

describe("control log", () => {
  it("accepts a result and an archived month in the same file", () => {
    expect(validateControlLog(log)).toEqual([]);
  });

  it("rejects a malformed result with its line number", () => {
    const broken = log.replace('"channel":"stable"', '"channel":"nightly"');
    const failures = validateControlLog(broken);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("line 1");
  });

  it("rejects a summary with an impossible month", () => {
    const summary = { schemaVersion: 1, kind: "control-summary", month: "2026-13", days: 1, cleanDays: 1, results: 3 };
    expect(validateControlSummary(summary).join(" ")).toContain("month");
  });

  it("validates smoke/controls.jsonl inside a dataset tree", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sg-controls-"));
    try {
      await mkdir(path.join(dir, "smoke"), { recursive: true });
      await writeFile(
        path.join(dir, "smoke", "controls.jsonl"),
        '{"schemaVersion":1,"kind":"control-summary","month":"2026-11"}\n',
        "utf8",
      );
      const failures = await validatePaths([dir]);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain("controls.jsonl: line 1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
