import { describe, expect, it } from "vitest";
import { validateGateState, validateValidationSummary } from "@solid-ground/schema";
import { GET as gateGET } from "../src/pages/api/v1/gate.json.js";
import { GET as validationGET } from "../src/pages/api/v1/validation.json.js";

describe("API response schemas", () => {
  it("gate.json matches the gate schema", async () => {
    const body = await (await gateGET({} as never)).json();
    expect(validateGateState(body)).toEqual([]);
    expect(validateGateState({ ...body, ready: "yes" }).length).toBeGreaterThan(0);
  });

  it("accepts a gate with no control runs yet", () => {
    expect(
      validateGateState({
        streak: 0,
        required: 14,
        remaining: 14,
        ready: false,
        lastRun: null,
      }),
    ).toEqual([]);
  });

  it("validation.json matches the validation schema in either state", async () => {
    const body = await (await validationGET({} as never)).json();
    expect(validateValidationSummary(body)).toEqual([]);
    expect(
      validateValidationSummary({ ...body, recorded: true, ok: null }).length,
    ).toBeGreaterThan(0);
  });

  it("accepts a recorded validation summary", () => {
    expect(
      validateValidationSummary({
        schemaVersion: 1,
        recorded: true,
        ok: true,
        checkedAt: "2026-11-27T13:41:12.387Z",
        targets: ["data"],
        problems: [],
      }),
    ).toEqual([]);
  });
});
