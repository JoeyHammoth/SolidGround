import { describe, expect, it } from "vitest";
import {
  GATE_CLOSE_COMMENT,
  GATE_ISSUE_TITLE,
  announceGate,
  closeGateIssue,
  gateBody,
} from "../src/gate.js";

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
