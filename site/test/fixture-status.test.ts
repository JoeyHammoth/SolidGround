import { describe, expect, it } from "vitest";
import { describeFixtureStatus } from "../src/lib/fixture-status.js";

describe("describeFixtureStatus", () => {
  it("names each recorded fixture state", () => {
    expect(describeFixtureStatus("current")).toBe("current");
    expect(describeFixtureStatus("behind")).toBe("one batch behind");
    expect(describeFixtureStatus("stale")).toBe("more than one batch behind");
  });

  it("does not invent a verdict for a value it does not know", () => {
    expect(describeFixtureStatus("")).toBe("unknown");
    expect(describeFixtureStatus("whatever")).toBe("unknown");
  });
});
