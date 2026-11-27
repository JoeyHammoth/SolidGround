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
    };

    expect(state.required).toBe(AUDIT_DAYS);
    expect(state.streak + state.remaining).toBe(AUDIT_DAYS);
    expect(state.ready).toBe(state.streak >= AUDIT_DAYS);
    expect(state.lastRun === null || !Number.isNaN(new Date(state.lastRun).getTime())).toBe(
      true,
    );
  });
});
