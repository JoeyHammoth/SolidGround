import { describe, expect, it } from "vitest";
import {
  validateControls,
  validateGateState,
  validateValidationSummary,
} from "@solid-ground/schema";
import { GET as controlsGET } from "../src/pages/api/v1/controls.json.js";
import { GET as gateGET } from "../src/pages/api/v1/gate.json.js";
import { GET as validationGET } from "../src/pages/api/v1/validation.json.js";

describe("API response schemas", () => {
  it("gate.json matches the gate schema", async () => {
    const body = await (await gateGET({} as never)).json();
    expect(validateGateState(body)).toEqual([]);
    expect(body.$schema).toContain("gate.schema.json");
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

  it("accepts a recorded fixture verdict, or none", () => {
    const gate = {
      streak: 1,
      required: 14,
      remaining: 13,
      ready: false,
      lastRun: "2026-11-28T01:06:11.353Z",
    };
    expect(validateGateState({ ...gate, fixture: null })).toEqual([]);
    expect(
      validateGateState({
        ...gate,
        fixture: { status: "behind", lastRun: "2026-11-27T15:47:28.855Z" },
      }),
    ).toEqual([]);
    expect(validateGateState({ ...gate, fixture: { status: "behind", lastRun: null } })).toEqual(
      [],
    );
  });

  it("rejects a gate whose fixture verdict is not an object", () => {
    const gate = { streak: 1, required: 14, remaining: 13, ready: false, lastRun: null };
    expect(validateGateState({ ...gate, fixture: "behind" }).length).toBeGreaterThan(0);
    expect(validateGateState({ ...gate, fixture: { status: "" } }).length).toBeGreaterThan(0);
  });

  it("validation.json matches the validation schema in either state", async () => {
    const body = await (await validationGET({} as never)).json();
    expect(validateValidationSummary(body)).toEqual([]);
    expect(body.$schema).toContain("validation.schema.json");
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

  it("controls.json matches the controls schema", async () => {
    const body = await (await controlsGET({} as never)).json();
    expect(validateControls(body)).toEqual([]);
    expect(body.$schema).toContain("controls.schema.json");
    expect(Array.isArray(body.days)).toBe(true);
  });

  it("accepts a control day with grouped failures", () => {
    expect(
      validateControls({
        schemaVersion: 1,
        streak: 0,
        required: 14,
        remaining: 14,
        auditMet: false,
        lastRun: "2026-11-27T04:11:00Z",
        days: [
          {
            day: "2026-11-27",
            clean: false,
            runs: 2,
            at: "2026-11-27T04:11:00Z",
            failures: 1,
            groups: [
              { subject: "control-subpath", details: ["no result in the batch"] },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });

  it("rejects a control day whose groups are not an array", () => {
    expect(
      validateControls({
        schemaVersion: 1,
        streak: 0,
        required: 14,
        remaining: 14,
        auditMet: false,
        lastRun: null,
        days: [{ day: "2026-11-27", clean: true, runs: 3, at: "2026-11-27T04:11:00Z", failures: 0, groups: "none" }],
      }).length,
    ).toBeGreaterThan(0);
  });
});
