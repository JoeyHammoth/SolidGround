import { describe, expect, it } from "vitest";
import {
  describeFixtureStatus,
  fixtureTooltip,
  refreshOutcome,
} from "../src/lib/fixture-status.js";

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

describe("refreshOutcome", () => {
  it("names what the run did about the lag", () => {
    expect(refreshOutcome("current")).toBe("current");
    expect(refreshOutcome("opened")).toBe("opened");
    expect(refreshOutcome("blocked")).toBe("blocked");
    expect(refreshOutcome("skipped")).toBe("skipped");
  });

  it("says nothing for an edition recorded before the field existed", () => {
    expect(refreshOutcome(null)).toBe("unknown");
    expect(refreshOutcome(undefined)).toBe("unknown");
    expect(refreshOutcome("whatever")).toBe("unknown");
  });
});

describe("fixtureTooltip", () => {
  it("stays quiet when there is nothing to report", () => {
    expect(fixtureTooltip(null)).toBeNull();
    expect(fixtureTooltip({ status: "current" })).toBeNull();
  });

  it("names the lag and a blocked refresh", () => {
    expect(fixtureTooltip({ status: "behind", refresh: "opened" })).toBe(
      "Recorded fixture one batch behind",
    );
    expect(fixtureTooltip({ status: "behind", refresh: "blocked" })).toBe(
      "Recorded fixture one batch behind, refresh blocked",
    );
    expect(fixtureTooltip({ status: "stale" })).toBe(
      "Recorded fixture more than one batch behind",
    );
  });
});
