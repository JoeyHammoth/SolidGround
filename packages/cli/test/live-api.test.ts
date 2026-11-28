import { describe, expect, it } from "vitest";
import {
  checkLiveEndpoints,
  compareRecordedControls,
  reportProblems,
  schemaFileName,
  type FetchJson,
} from "../src/live-api.js";

const GATE = {
  $schema: "https://example.test/schemas/gate.schema.json",
  streak: 0,
  required: 14,
  remaining: 14,
  ready: false,
  lastRun: null,
};

const CONTROLS = {
  $schema: "https://example.test/schemas/controls.schema.json",
  schemaVersion: 1,
  streak: 1,
  required: 14,
  remaining: 13,
  auditMet: false,
  lastRun: "2026-11-28T04:11:00Z",
  days: [
    {
      day: "2026-11-28",
      clean: false,
      runs: 2,
      at: "2026-11-28T04:11:00Z",
      failures: 1,
      groups: [{ subject: "control-subpath", details: ["no result in the batch"] }],
    },
  ],
};

function fetchMap(bodies: Record<string, unknown>, failing: string[] = []): FetchJson {
  return async (url) => {
    for (const path of failing) {
      if (url.endsWith(path)) throw new Error("HTTP 404");
    }
    const match = Object.entries(bodies).find(([path]) => url.endsWith(path));
    if (!match) throw new Error("HTTP 404");
    return match[1];
  };
}

describe("schemaFileName", () => {
  it("maps an endpoint to the schema that describes it", () => {
    expect(schemaFileName("/api/v1/gate.json")).toBe("gate.schema.json");
    expect(schemaFileName("/api/v1/controls.json")).toBe("controls.schema.json");
  });
});

describe("compareRecordedControls", () => {
  const NEXT_DAY = {
    day: "2026-11-29",
    clean: true,
    runs: 3,
    at: "2026-11-29T04:11:00Z",
    failures: 0,
    groups: [],
  };

  it("accepts a fixture recorded from the same run", () => {
    expect(compareRecordedControls(CONTROLS, CONTROLS)).toEqual([]);
  });

  it("marks a fixture one batch behind as routine", () => {
    const notes = compareRecordedControls(CONTROLS, {
      ...CONTROLS,
      lastRun: "2026-11-29T04:11:00Z",
      days: [...CONTROLS.days, NEXT_DAY],
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.routine).toBe(true);
    expect(notes[0]?.message).toContain("fixtures/live/controls.json: recorded lastRun");
    expect(notes[0]?.message).toContain("older than the deployed 2026-11-29T04:11:00Z");
    expect(notes[0]?.message).toContain("refresh it");
  });

  it("marks another batch on the same day as routine", () => {
    const notes = compareRecordedControls(CONTROLS, {
      ...CONTROLS,
      lastRun: "2026-11-28T16:11:00Z",
      days: [{ ...CONTROLS.days[0], runs: 3, at: "2026-11-28T16:11:00Z" }],
    });
    expect(notes[0]?.routine).toBe(true);
  });

  it("warns when the fixture is more than one batch behind", () => {
    const notes = compareRecordedControls(CONTROLS, {
      ...CONTROLS,
      lastRun: "2026-11-30T04:11:00Z",
      days: [
        ...CONTROLS.days,
        NEXT_DAY,
        { ...NEXT_DAY, day: "2026-11-30", at: "2026-11-30T04:11:00Z" },
      ],
    });
    expect(notes[0]?.routine).toBe(false);
  });

  it("warns when a recorded day no longer matches the deployed answer", () => {
    const notes = compareRecordedControls(CONTROLS, {
      ...CONTROLS,
      lastRun: "2026-11-29T04:11:00Z",
      days: [{ ...CONTROLS.days[0], runs: 3 }, NEXT_DAY],
    });
    expect(notes[0]?.routine).toBe(false);
  });

  it("accepts a fixture ahead of a lagging deploy", () => {
    expect(
      compareRecordedControls(
        { ...CONTROLS, lastRun: "2026-11-30T04:11:00Z" },
        CONTROLS,
      ),
    ).toEqual([]);
  });

  it("accepts a deployed response with no runs yet", () => {
    expect(compareRecordedControls(CONTROLS, { ...CONTROLS, lastRun: null })).toEqual([]);
  });

  it("fails a missing or run-less fixture", () => {
    expect(compareRecordedControls(undefined, CONTROLS)[0]?.message).toContain("missing");
    expect(compareRecordedControls({ ...CONTROLS, lastRun: null }, CONTROLS)[0]?.message).toContain(
      "carries no lastRun",
    );
  });
});

describe("reportProblems", () => {
  const report = {
    valid: [],
    problems: ["schema drift"],
    fixture: [{ message: "fixture behind", routine: true }],
    bodies: {},
  };

  it("keeps fixture staleness out of the default failure set", () => {
    expect(reportProblems(report, false)).toEqual(["schema drift"]);
  });

  it("includes it under --strict", () => {
    expect(reportProblems(report, true)).toEqual(["schema drift", "fixture behind"]);
  });
});

describe("checkLiveEndpoints", () => {
  it("reports only the endpoints whose bodies were supplied and validated", async () => {
    const report = await checkLiveEndpoints({
      base: "https://example.test/",
      fetchJson: fetchMap({
        "/api/v1/gate.json": GATE,
        "/api/v1/controls.json": CONTROLS,
      }),
    });

    expect(report.valid).toEqual(["/api/v1/gate.json", "/api/v1/controls.json"]);
    expect(report.problems).toHaveLength(4);
    expect(report.problems[0]).toContain("/api/v1/index.json: unreachable");
  });

  it("fails a response whose $schema names another document", async () => {
    const report = await checkLiveEndpoints({
      base: "https://example.test",
      fetchJson: fetchMap({
        "/api/v1/gate.json": {
          ...GATE,
          $schema: "https://example.test/schemas/validation.schema.json",
        },
        "/api/v1/controls.json": CONTROLS,
      }),
    });

    expect(report.valid).toEqual(["/api/v1/controls.json"]);
    expect(report.problems).toContainEqual(
      expect.stringContaining("/api/v1/gate.json: $schema is"),
    );
  });

  it("fails a control day that drifted from the schema", async () => {
    const report = await checkLiveEndpoints({
      base: "https://example.test",
      fetchJson: fetchMap({
        "/api/v1/controls.json": {
          ...CONTROLS,
          days: [{ ...CONTROLS.days[0], groups: "none" }],
        },
      }),
    });

    expect(report.valid).toEqual([]);
    expect(report.problems.join("\n")).toContain("/api/v1/controls.json: /days/0/groups");
  });

  it("names an unreachable endpoint and keeps checking the rest", async () => {
    const report = await checkLiveEndpoints({
      base: "https://example.test",
      fetchJson: fetchMap({ "/api/v1/gate.json": GATE }, ["/api/v1/meta.json"]),
    });

    expect(report.problems).toContain("/api/v1/meta.json: unreachable (HTTP 404)");
    expect(report.valid).toEqual(["/api/v1/gate.json"]);
  });
});
