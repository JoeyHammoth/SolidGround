import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SmokeResult } from "@solid-ground/schema";
import {
  AUDIT_DAYS,
  compactControlLog,
  describeControls,
  groupControlFailures,
  parseControlLog,
  readControlHistory,
  summarizeControls,
} from "../src/index.js";

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
    at: "2026-11-25T04:10:00Z",
    ...overrides,
  };
}

const BAD = result({
  name: "@solid-ground/control-bad",
  smoke: { import: false, build: null, types: null },
});

function batch(at: string): SmokeResult[] {
  return [
    result({ at: `${at}T04:10:00Z` }),
    result({
      name: "@solid-ground/control-bad",
      smoke: { import: false, build: null, types: null },
      at: `${at}T04:11:00Z`,
    }),
    result({
      name: "@solid-ground/control-subpath",
      target: "@solid-ground/control-subpath/widget",
      at: `${at}T04:12:00Z`,
    }),
  ];
}

describe("summarizeControls", () => {
  it("groups results by UTC day and counts the clean streak", () => {
    const history = summarizeControls([
      ...batch("2026-11-24"),
      ...batch("2026-11-25"),
      ...batch("2026-11-26"),
    ]);
    expect(history.days.map((day) => day.day)).toEqual([
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
    ]);
    expect(history.days.every((day) => day.clean)).toBe(true);
    expect(history.streak).toBe(3);
    expect(history.lastRun).toBe("2026-11-26T04:12:00Z");
    expect(history.auditMet).toBe(false);
  });

  it("breaks the streak at a wrong control verdict", () => {
    const wrong = result({
      name: "@solid-ground/control-bad",
      smoke: { import: true, build: null, types: null },
      at: "2026-11-25T04:11:00Z",
    });
    const history = summarizeControls([...batch("2026-11-24"), wrong, ...batch("2026-11-26")]);
    expect(history.days.find((day) => day.day === "2026-11-24")?.clean).toBe(true);
    expect(history.days.find((day) => day.day === "2026-11-25")?.clean).toBe(false);
    expect(history.streak).toBe(1);
  });

  it("does not count a day missing a control as clean", () => {
    const history = summarizeControls([
      result({ at: "2026-11-26T04:10:00Z" }),
      result({
        name: "@solid-ground/control-bad",
        smoke: { import: false, build: null, types: null },
        at: "2026-11-26T04:11:00Z",
      }),
    ]);
    const day = history.days[0];
    expect(day?.clean).toBe(false);
    expect(day?.failures.join(" ")).toContain("control-subpath: no result in the batch");
    expect(history.streak).toBe(0);
  });

  it("keeps a failed retry later the same day visible", () => {
    const broken = result({
      at: "2026-11-26T05:00:00Z",
      smoke: { import: false, build: true, types: true },
    });
    const history = summarizeControls([...batch("2026-11-26"), broken]);
    const day = history.days[0];
    expect(day?.clean).toBe(false);
    expect(day?.failures[0]).toContain("control-good: import was false");
  });

  it("marks the audit gate once enough clean days exist", () => {
    const days = Array.from({ length: AUDIT_DAYS }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return batch(`2026-10-${day}`);
    }).flat();
    const history = summarizeControls(days);
    expect(history.streak).toBe(AUDIT_DAYS);
    expect(history.auditMet).toBe(true);
  });

  it("has nothing to report before a batch has run", () => {
    const history = summarizeControls([]);
    expect(history.days).toEqual([]);
    expect(history.lastRun).toBeNull();
    expect(describeControls(history)[0]).toContain("0 control day(s)");
  });
});

describe("groupControlFailures", () => {
  it("groups repeated control ids and preserves first-seen order", () => {
    expect(
      groupControlFailures([
        "control-subpath: import was false, expected true",
        "control-bad: import was true, expected false",
        "control-subpath: build was false, expected true",
      ]),
    ).toEqual([
      {
        subject: "control-subpath",
        details: ["import was false, expected true", "build was false, expected true"],
      },
      { subject: "control-bad", details: ["import was true, expected false"] },
    ]);
  });

  it("keeps a message without a control prefix under a generic subject", () => {
    expect(groupControlFailures(["the batch was empty"])).toEqual([
      { subject: "control", details: ["the batch was empty"] },
    ]);
  });

  it("returns no groups for no failures", () => {
    expect(groupControlFailures([])).toEqual([]);
  });
});

describe("compactControlLog", () => {
  const NOW = new Date("2026-11-27T00:00:00Z");

  it("archives whole months older than the retention window", () => {
    const text = `${[...batch("2026-05-10"), ...batch("2026-05-11"), ...batch("2026-11-25")]
      .map((entry) => JSON.stringify(entry))
      .join("\n")}\n`;

    const compacted = compactControlLog(text, { retentionDays: 90, now: NOW });
    const parsed = parseControlLog(compacted.text);

    expect(parsed.results).toHaveLength(3);
    expect(parsed.summaries).toEqual([
      {
        schemaVersion: 1,
        kind: "control-summary",
        month: "2026-05",
        days: 2,
        cleanDays: 2,
        results: 6,
      },
    ]);
    expect(compacted.summarized).toBe(1);
    expect(compacted.kept).toBe(3);
  });

  it("is idempotent, so a second run changes nothing", () => {
    const text = [...batch("2026-05-10"), ...batch("2026-11-25")]
      .map((entry) => JSON.stringify(entry))
      .join("\n");
    const once = compactControlLog(text, { retentionDays: 90, now: NOW });
    const twice = compactControlLog(once.text, { retentionDays: 90, now: NOW });
    expect(twice.text).toBe(once.text);
    expect(twice.summarized).toBe(0);
  });

  it("reports archived months through the status lines", () => {
    const history = summarizeControls(batch("2026-11-25"));
    const lines = describeControls(history, 14, [
      {
        schemaVersion: 1,
        kind: "control-summary",
        month: "2026-05",
        days: 2,
        cleanDays: 2,
        results: 6,
      },
    ]);
    expect(lines).toContain("archived 2026-05  2 day(s), 2 clean, 6 result(s)");
  });
});

describe("readControlHistory", () => {
  it("skips a damaged line instead of failing the whole log", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sg-smoke-controls-"));
    try {
      const file = path.join(dir, "controls.jsonl");
      await writeFile(
        file,
        `${JSON.stringify(result())}\nnot json\n${JSON.stringify(BAD)}\n`,
      );
      const results = await readControlHistory(file);
      expect(results).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns an empty history when the log does not exist yet", async () => {
    expect(await readControlHistory("/nonexistent/controls.jsonl")).toEqual([]);
  });
});
