import { describe, expect, it } from "vitest";
import type { ChangeEvent } from "@solid-ground/schema";
import { eventRow, events, isDatasetEvent } from "../src/lib/events.js";

const datasetEvents = events.filter(isDatasetEvent);

function event(kind: ChangeEvent["kind"], overrides: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    schemaVersion: 1,
    name: "@example/lib",
    at: "2026-11-26T00:00:00Z",
    kind,
    from: null,
    to: "ready",
    ...overrides,
  };
}

describe("changes rows", () => {
  it("has dataset events in the committed fixtures", () => {
    expect(datasetEvents.length).toBeGreaterThan(0);
    expect(new Set(datasetEvents.map((item) => item.kind))).toEqual(
      new Set(["solid", "rules", "anomaly"]),
    );
  });

  it("never links a dataset event to a package page", () => {
    for (const item of datasetEvents) {
      const row = eventRow(item, "/SolidGround");
      expect(row.href).toBeNull();
      expect(row.category).toBe("dataset");
    }
  });

  it("labels the subject by kind", () => {
    expect(eventRow(event("solid", { name: "solid-js" })).subject).toBe("solid-js");
    expect(eventRow(event("rules", { name: "rules" })).subject).toBe("rules");
    expect(eventRow(event("anomaly", { name: "dataset" })).subject).toBe("dataset");
  });

  it("links a package event to its page", () => {
    const row = eventRow(event("status", { name: "@astrojs/solid-js" }), "/SolidGround");
    expect(row.href).toBe("/SolidGround/packages/@astrojs__solid-js/");
    expect(row.subject).toBe("@astrojs/solid-js");
    expect(row.category).toBe("meta-frameworks");
  });

  it("renders a monthly summary as text under the summary category", () => {
    const row = eventRow(
      event("summary", { name: "", from: null, to: "2025-09", count: 4 }),
      "/SolidGround",
    );
    expect(row.href).toBeNull();
    expect(row.subject).toBe("all packages");
    expect(row.category).toBe("summary");
    expect(row.title).toBe("4 changes in September 2025");
  });

  it("gives each kind a readable title", () => {
    expect(eventRow(event("solid", { from: "2.0.3", to: "2.0.4" })).title).toBe(
      "Solid 2.0.4 was released",
    );
    expect(eventRow(event("solid", { from: "2.0.0-rc.23", to: "2.1.0-next.1" })).title).toBe(
      "Solid's next line moved to 2.1.0-next.1",
    );
    expect(eventRow(event("rules", { from: "2026.10.1", to: "2026.11.1" })).title).toBe(
      "The status rules moved from 2026.10.1 to 2026.11.1",
    );
    expect(eventRow(event("anomaly", { from: null, to: "clear" })).title).toBe(
      "The anomaly hold on the dataset was cleared",
    );
  });
});
