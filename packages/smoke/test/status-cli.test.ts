import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SmokeResult } from "@solid-ground/schema";

const CLI = path.resolve("packages/smoke/src/cli.ts");

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
    at: "2026-11-27T04:10:00Z",
    ...overrides,
  };
}

/** A batch with no subpath control, so the day fails on the missing control. */
const FAILED_DAY = [
  result(),
  result({
    name: "@solid-ground/control-bad",
    smoke: { import: false, build: null, types: null },
    at: "2026-11-27T04:11:00Z",
  }),
];

/** Every control answering correctly, so the day is clean. */
const CLEAN_DAY = [
  result({ at: "2026-11-28T04:10:00Z" }),
  result({
    name: "@solid-ground/control-bad",
    smoke: { import: false, build: null, types: null },
    at: "2026-11-28T04:11:00Z",
  }),
  result({
    name: "@solid-ground/control-subpath",
    target: "@solid-ground/control-subpath/widget",
    at: "2026-11-28T04:12:00Z",
  }),
];

async function writeLog(results: SmokeResult[]): Promise<{ dir: string; file: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sg-status-cli-"));
  const file = path.join(dir, "controls.jsonl");
  await writeFile(
    file,
    `${results.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
    "utf8",
  );
  return { dir, file };
}

function logFile(): Promise<{ dir: string; file: string }> {
  return writeLog(FAILED_DAY);
}

function status(file: string, extra: string[] = []): string {
  return execFileSync(
    process.execPath,
    ["--import", "tsx", CLI, "status", "--file", file, ...extra],
    { encoding: "utf8" },
  );
}

function statusRun(file: string, extra: string[] = []) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", CLI, "status", "--file", file, ...extra],
    { encoding: "utf8" },
  );
}

describe("smoke:status output", () => {
  it("groups failures under a counted day", async () => {
    const { dir, file } = await logFile();
    try {
      expect(status(file).trimEnd()).toBe(
        [
          "FAIL  2026-11-27  2 control result(s) at 04:11:00Z",
          "1 control day(s) on record; 0 clean in a row; last run 2026-11-27T04:11:00Z; two-week audit gate not met",
          "  2026-11-27  1 failure(s)",
          "    control-subpath: no result in the batch",
        ].join("\n"),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("includes grouped failures in --json", async () => {
    const { dir, file } = await logFile();
    try {
      const report = JSON.parse(status(file, ["--json"])) as {
        streak: number;
        days: { day: string; groups: { subject: string; details: string[] }[] }[];
      };
      expect(report.streak).toBe(0);
      expect(report.days[0]?.day).toBe("2026-11-27");
      expect(report.days[0]?.groups).toEqual([
        { subject: "control-subpath", details: ["no result in the batch"] },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("exits 1 under --strict when the newest day failed", async () => {
    const { dir, file } = await logFile();
    try {
      const run = statusRun(file, ["--strict"]);
      expect(run.status).toBe(1);
      expect(run.stdout).toContain("FAIL  2026-11-27");
      expect(run.stderr).toContain("the newest control day is not clean");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("exits 0 under --strict when the newest day is clean", async () => {
    const { dir, file } = await writeLog(CLEAN_DAY);
    try {
      const run = statusRun(file, ["--strict"]);
      expect(run.status).toBe(0);
      expect(run.stdout).toContain("clean 2026-11-28");
      expect(run.stderr).toBe("");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
