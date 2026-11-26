import { describe, expect, it } from "vitest";
import type { ChangeEvent } from "@solid-ground/schema";
import { compactEvents } from "../src/index.js";

function event(at: string, overrides: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    schemaVersion: 1,
    name: "@example/lib",
    at,
    kind: "status",
    from: "in-progress",
    to: "ready",
    ...overrides,
  };
}

const NOW = "2026-11-26T00:00:00Z";

describe("compactEvents", () => {
  it("keeps events inside the window, newest first", () => {
    const events = [event("2026-06-01T00:00:00Z"), event("2026-11-01T00:00:00Z")];
    expect(compactEvents(events, NOW, 12)).toEqual([events[1], events[0]]);
  });

  it("collapses older events into one summary per month with a count", () => {
    const events = [
      event("2025-08-03T00:00:00Z"),
      event("2025-09-02T00:00:00Z"),
      event("2025-09-20T00:00:00Z"),
      event("2026-11-01T00:00:00Z"),
    ];
    expect(compactEvents(events, NOW, 12)).toEqual([
      events[3],
      { schemaVersion: 1, name: "", at: "2025-09-20T00:00:00Z", kind: "summary", from: null, to: "2025-09", count: 2 },
      { schemaVersion: 1, name: "", at: "2025-08-03T00:00:00Z", kind: "summary", from: null, to: "2025-08", count: 1 },
    ]);
  });

  it("folds a late event into an existing month summary", () => {
    const summary: ChangeEvent = {
      schemaVersion: 1,
      name: "",
      at: "2025-09-30T00:00:00Z",
      kind: "summary",
      from: null,
      to: "2025-09",
      count: 40,
    };
    expect(compactEvents([summary, event("2025-09-02T00:00:00Z")], NOW, 12)).toEqual([
      { ...summary, count: 41 },
    ]);
  });

  it("is idempotent", () => {
    const once = compactEvents(
      [event("2025-09-02T00:00:00Z"), event("2026-11-01T00:00:00Z")],
      NOW,
      12,
    );
    expect(compactEvents(once, NOW, 12)).toEqual(once);
  });

  it("uses the supplied instant, not the clock", () => {
    const events = [event("2025-09-02T00:00:00Z")];
    expect(compactEvents(events, "2026-01-01T00:00:00Z", 12)).toHaveLength(1);
    expect(compactEvents(events, "2027-06-01T00:00:00Z", 12)[0]?.kind).toBe("summary");
  });
});
