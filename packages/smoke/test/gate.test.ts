import { describe, expect, it } from "vitest";
import {
  GATE_CLOSE_COMMENT,
  GATE_ISSUE_TITLE,
  announceGate,
  closeGateIssue,
  gateBody,
  gateState,
} from "../src/gate.js";
import { summarizeControls } from "../src/status.js";
import type { SmokeResult } from "@solid-ground/schema";

function harness(openIssues = "") {
  const calls: string[][] = [];
  return {
    calls,
    run(args: string[]) {
      calls.push(args);
      return args[1] === "list" ? openIssues : "";
    },
  };
}

function cleanDay(day: number, year = 2026, month = 11): SmokeResult[] {
  const at = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T10:00:00Z`;
  const base = { schemaVersion: 1 as const, version: "0.0.0", solid: "2.0.4", channel: "stable" as const, at };
  return [
    { ...base, name: "@solid-ground/control-good", smoke: { import: true, build: true, types: true }, target: null },
    { ...base, name: "@solid-ground/control-bad", smoke: { import: false, build: null, types: null }, target: null },
    {
      ...base,
      name: "@solid-ground/control-subpath",
      smoke: { import: true, build: true, types: true },
      target: "@solid-ground/control-subpath/widget",
    },
  ] as SmokeResult[];
}

describe("gateState", () => {
  it("counts the days still missing", () => {
    const history = summarizeControls([1, 2, 3].flatMap((day) => cleanDay(day)));
    expect(gateState(history)).toMatchObject({ streak: 3, required: 14, remaining: 11, ready: false });
  });

  it("reports a met gate and no remaining days", () => {
    const history = summarizeControls(Array.from({ length: 14 }, (_, index) => cleanDay(index + 1)).flat());
    expect(gateState(history)).toMatchObject({ streak: 14, remaining: 0, ready: true });
  });
});

describe("announceGate", () => {
  it("opens one reminder when the gate is met and none is open", () => {
    const gh = harness();
    expect(announceGate({ ready: true, streak: 14, run: gh.run })).toBe("created");
    expect(gh.calls.at(-1)).toEqual([
      "issue",
      "create",
      "--title",
      GATE_ISSUE_TITLE,
      "--body",
      gateBody(14),
    ]);
    expect(gateBody(14)).toContain("14 clean day(s)");
    expect(gateBody(14)).toContain("publish=true");
  });

  it("keeps a single reminder across later runs", () => {
    const gh = harness("60\n");
    expect(announceGate({ ready: true, streak: 15, run: gh.run })).toBe("existing");
    expect(gh.calls).toHaveLength(1);
  });

  it("does not touch GitHub before the gate is met", () => {
    const gh = harness();
    expect(announceGate({ ready: false, streak: 13, run: gh.run })).toBe("none");
    expect(gh.calls).toHaveLength(0);
  });
});

describe("closeGateIssue", () => {
  it("closes every open reminder after a publish", () => {
    const gh = harness("60\n62\n");
    expect(closeGateIssue({ run: gh.run })).toBe("closed");
    expect(gh.calls.slice(-2)).toEqual([
      ["issue", "close", "60", "--comment", GATE_CLOSE_COMMENT],
      ["issue", "close", "62", "--comment", GATE_CLOSE_COMMENT],
    ]);
  });

  it("does nothing when no reminder was opened", () => {
    const gh = harness();
    expect(closeGateIssue({ run: gh.run })).toBe("none");
    expect(gh.calls).toHaveLength(1);
  });
});
