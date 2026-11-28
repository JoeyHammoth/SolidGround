import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateControls } from "@solid-ground/schema";

/**
 * A recorded answer from the deployed endpoint, kept as a fixture so the shape
 * consumers actually receive stays covered by an offline test. Refresh it with
 * `curl https://joeyhammoth.github.io/SolidGround/api/v1/controls.json >
 * fixtures/live/controls.json` after a control run; `pnpm check:live` checks
 * the live responses themselves.
 */
const payload: unknown = JSON.parse(readFileSync("fixtures/live/controls.json", "utf8"));

describe("deployed /api/v1/controls.json", () => {
  it("matches the schema consumers are pointed at", () => {
    expect(validateControls(payload)).toEqual([]);
  });

  it("names the published schema in $schema", () => {
    const declared = (payload as { $schema: string }).$schema;
    expect(declared).toMatch(
      /^https:\/\/raw\.githubusercontent\.com\/JoeyHammoth\/SolidGround\/main\/packages\/schema\/schemas\/controls\.schema\.json$/,
    );
  });

  it("keeps the failed day's reasons grouped by control id", () => {
    const body = payload as {
      streak: number;
      lastRun: string;
      days: {
        day: string;
        clean: boolean;
        runs: number;
        at: string;
        failures: number;
        groups: { subject: string; details: string[] }[];
      }[];
    };
    const failed = body.days.find((day) => !day.clean);

    expect(failed?.day).toBe("2026-11-27");
    expect(failed?.runs).toBe(34);
    expect(failed?.failures).toBe(3);
    expect(failed?.groups).toEqual([
      {
        subject: "control-subpath",
        details: [
          "import was false, expected true",
          "build was false, expected true",
          "types was false, expected true",
        ],
      },
    ]);
    // Derived, not pinned: the scheduled refresh adds a day every batch, and a
    // hardcoded streak made every refresh pull request fail this suite.
    const trailingClean = [...body.days].reverse().findIndex((day) => !day.clean);
    expect(body.streak).toBe(trailingClean === -1 ? body.days.length : trailingClean);
    expect(body.lastRun).toBe(body.days.at(-1)?.at);
  });
});
