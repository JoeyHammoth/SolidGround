import { describe, expect, it } from "vitest";
import { GET } from "../src/pages/llms.txt.js";
import { apiCheck, controls } from "../src/lib/data.js";
import { AUDIT_DAYS } from "@solid-ground/smoke/status";

describe("GET /llms.txt", () => {
  it("documents the publish gate with the current state", async () => {
    const response = await GET({} as never);
    expect(response.headers.get("content-type")).toContain("text/plain");

    const text = await response.text();
    expect(text).toContain("## Publish gate");
    expect(text).toContain(`${AUDIT_DAYS} clean control days`);
    expect(text).toContain(`${controls.streak} clean day(s) in a row`);
    expect(text).toContain("/api/v1/gate.json");
    expect(text).toContain("/api/v1/validation.json");
    expect(text).toContain("/api/v1/controls.json");
    expect(text).toContain("gate.schema.json");
    expect(text).toContain("controls.schema.json");
    expect(text).toContain("validation.schema.json");
    expect(text).toContain("`$schema`");
  });

  it("names the recorded fixture the gate was computed from", async () => {
    const text = await (await GET({} as never)).text();
    // The golden dataset carries no api-check.json; the data edition does, and
    // then the line names the recorded state and run instead.
    const fixture = apiCheck?.fixture
      ? `Recorded gate fixture (fixtures/live/controls.json): `
      : "Recorded gate fixture (fixtures/live/controls.json): not recorded in this build.";
    expect(text).toContain(fixture);
  });
});
