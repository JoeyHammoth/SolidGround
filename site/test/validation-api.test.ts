import { describe, expect, it } from "vitest";
import { GET } from "../src/pages/api/v1/validation.json.js";

describe("GET /api/v1/validation.json", () => {
  it("returns a stable shape even without a recorded summary", async () => {
    const response = await GET({} as never);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body).toMatchObject({ schemaVersion: 1 });
    expect(typeof body.recorded).toBe("boolean");
    expect(Array.isArray(body.targets)).toBe(true);
    expect(Array.isArray(body.problems)).toBe(true);
    if (!body.recorded) {
      expect(body.ok).toBeNull();
      expect(body.checkedAt).toBeNull();
    }
  });
});
