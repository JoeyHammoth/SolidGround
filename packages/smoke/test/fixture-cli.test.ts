import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateControls } from "@solid-ground/schema";
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
    at: "2026-11-28T04:10:00Z",
    ...overrides,
  };
}

/**
 * A failed day: the subpath control ran and answered wrongly, so its reasons are
 * recorded rather than the missing-control fallback.
 */
const DAY = [
  result(),
  result({
    name: "@solid-ground/control-bad",
    smoke: { import: false, build: null, types: null },
    at: "2026-11-28T04:11:00Z",
  }),
  result({
    name: "@solid-ground/control-subpath",
    target: "@solid-ground/control-subpath/widget",
    smoke: { import: false, build: false, types: false },
    at: "2026-11-28T04:12:00Z",
  }),
];

async function sketch(): Promise<{ dir: string; file: string; out: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sg-fixture-cli-"));
  const file = path.join(dir, "controls.jsonl");
  await writeFile(file, `${DAY.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
  return { dir, file, out: path.join(dir, "controls.json") };
}

describe("smoke:fixture", () => {
  it("writes a body the controls schema accepts", async () => {
    const { dir, file, out } = await sketch();
    try {
      const log = execFileSync(
        process.execPath,
        ["--import", "tsx", CLI, "fixture", "--file", file, "--out", out],
        { encoding: "utf8" },
      );
      expect(log).toContain("wrote");

      const body: unknown = JSON.parse(await readFile(out, "utf8"));
      expect(validateControls(body)).toEqual([]);
      expect((body as { $schema: string }).$schema).toMatch(/\/controls\.schema\.json$/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("records the failed day with grouped reasons and the gate arithmetic", async () => {
    const { dir, file, out } = await sketch();
    try {
      execFileSync(
        process.execPath,
        ["--import", "tsx", CLI, "fixture", "--file", file, "--out", out],
        { encoding: "utf8" },
      );
      const body = JSON.parse(await readFile(out, "utf8")) as {
        streak: number;
        required: number;
        remaining: number;
        auditMet: boolean;
        lastRun: string;
        days: { day: string; clean: boolean; runs: number; failures: number; groups: unknown }[];
      };

      expect(body.streak).toBe(0);
      expect(body.required).toBe(14);
      expect(body.required - body.remaining).toBe(body.streak);
      expect(body.auditMet).toBe(false);
      expect(body.lastRun).toBe("2026-11-28T04:12:00Z");
      expect(body.days).toHaveLength(1);
      expect(body.days[0]).toMatchObject({
        day: "2026-11-28",
        clean: false,
        runs: 3,
        failures: 3,
      });
      expect(body.days[0]?.groups).toEqual([
        {
          subject: "control-subpath",
          details: [
            "import was false, expected true",
            "build was false, expected true",
            "types was false, expected true",
          ],
        },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}, 30_000);
