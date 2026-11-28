import { describe, expect, it } from "vitest";
import { GET } from "../src/pages/api/v1/gate.json.js";
import { AUDIT_DAYS } from "@solid-ground/smoke/status";

describe("GET /api/v1/gate.json", () => {
  it("reports the gate state with the required day count", async () => {
    const response = await GET({} as never);
    expect(response.headers.get("content-type")).toContain("application/json");

    const state = (await response.json()) as {
      streak: number;
      required: number;
      remaining: number;
      ready: boolean;
      lastRun: string | null;
      fixture: { status: string; lastRun: string | null } | null;
    };

    expect(state.required).toBe(AUDIT_DAYS);
    expect(state.streak + state.remaining).toBe(AUDIT_DAYS);
    expect(state.ready).toBe(state.streak >= AUDIT_DAYS);
    expect(state.lastRun === null || !Number.isNaN(new Date(state.lastRun).getTime())).toBe(
      true,
    );
  });

  it("publishes the recorded fixture verdict beside the gate numbers", async () => {
    const state = (await (await GET({} as never)).json()) as {
      fixture: { status: string; lastRun: string | null } | null;
    };
    // Null in the golden dataset, which carries no api-check.json; the data
    // edition records one and then the status and run are published.
    expect(state).toHaveProperty("fixture");
    if (state.fixture !== null) {
      expect(state.fixture.status.length).toBeGreaterThan(0);
      expect(
        state.fixture.lastRun === null ||
          !Number.isNaN(new Date(state.fixture.lastRun).getTime()),
      ).toBe(true);
    }
  });
});
