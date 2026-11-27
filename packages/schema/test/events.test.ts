import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateChangeEvent, validateEvents } from "../src/index.js";

const fixture = readFileSync(
  new URL("../../../fixtures/dataset/events.ndjson", import.meta.url),
  "utf8",
);

describe("validateChangeEvent", () => {
  it("accepts a package event", () => {
    expect(
      validateChangeEvent({
        schemaVersion: 1,
        name: "@example/lib",
        at: "2026-11-25T06:00:00Z",
        kind: "status",
        from: "in-progress",
        to: "ready",
      }),
    ).toEqual([]);
  });

  it("accepts a dataset event", () => {
    expect(
      validateChangeEvent({
        schemaVersion: 1,
        name: "solid-js",
        at: "2026-11-25T06:00:00Z",
        kind: "solid",
        from: "2.0.3",
        to: "2.0.4",
      }),
    ).toEqual([]);
  });

  it("accepts a monthly summary with its count", () => {
    expect(
      validateChangeEvent({
        schemaVersion: 1,
        name: "",
        at: "2025-09-20T00:00:00Z",
        kind: "summary",
        from: null,
        to: "2025-09",
        count: 2,
      }),
    ).toEqual([]);
  });

  it("rejects a summary without a count", () => {
    const errors = validateChangeEvent({
      schemaVersion: 1,
      name: "",
      at: "2025-09-20T00:00:00Z",
      kind: "summary",
      from: null,
      to: "2025-09",
    });
    expect(errors.join(" ")).toContain("count");
  });

  it("rejects an unknown kind and stray fields", () => {
    expect(
      validateChangeEvent({
        schemaVersion: 1,
        name: "@example/lib",
        at: "2026-11-25T06:00:00Z",
        kind: "vibes",
        from: null,
        to: "ready",
      }),
    ).toHaveLength(1);
    expect(
      validateChangeEvent({
        schemaVersion: 1,
        name: "@example/lib",
        at: "2026-11-25T06:00:00Z",
        kind: "status",
        from: null,
        to: "ready",
        extra: true,
      }),
    ).toHaveLength(1);
  });
});

describe("validateEvents", () => {
  it("validates every committed fixture line", () => {
    expect(validateEvents(fixture)).toEqual([]);
  });

  it("accepts blank lines and a trailing newline", () => {
    expect(validateEvents("\n\n")).toEqual([]);
  });

  it("names the line that is not JSON", () => {
    const failures = validateEvents(`${fixture.split("\n")[0]}\nnot json\n`);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/^line 2: invalid JSON/);
  });

  it("names the line that fails the schema", () => {
    const failures = validateEvents(
      `{"schemaVersion":1,"name":"x","at":"2026-11-25T06:00:00Z","kind":"status","from":null,"to":"ready"}\n{"schemaVersion":2,"name":"x","at":"2026-11-25T06:00:00Z","kind":"status","from":null,"to":"ready"}\n`,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/^line 2: /);
  });
});
