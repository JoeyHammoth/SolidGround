import { describe, expect, it } from "vitest";
import {
  AUDIT_CLOSE_COMMENT,
  AUDIT_ISSUE_BODY,
  AUDIT_ISSUE_TITLE,
  syncAuditIssue,
} from "../src/audit-issue.js";

function harness(openIssues = "", lastComment = "") {
  const calls: string[][] = [];
  return {
    calls,
    run(args: string[]) {
      calls.push(args);
      if (args[1] === "list") return openIssues;
      if (args[1] === "view") return lastComment;
      return "";
    },
  };
}

describe("syncAuditIssue", () => {
  it("opens the issue when a stale note has no issue yet", () => {
    const gh = harness();
    expect(syncAuditIssue({ stale: true, run: gh.run })).toBe("created");
    expect(gh.calls.at(-1)).toEqual([
      "issue",
      "create",
      "--title",
      AUDIT_ISSUE_TITLE,
      "--body",
      AUDIT_ISSUE_BODY,
    ]);
    expect(AUDIT_ISSUE_BODY).toContain("pnpm audit:blocked --data data");
  });

  it("comments on the open issue instead of opening a second one", () => {
    const gh = harness("41\n");
    expect(syncAuditIssue({ stale: true, run: gh.run })).toBe("commented");
    expect(gh.calls.at(-1)).toEqual(["issue", "comment", "41", "--body", AUDIT_ISSUE_BODY]);
  });

  it("leaves the issue alone while the same state repeats", () => {
    const gh = harness("41\n", AUDIT_ISSUE_BODY);
    expect(syncAuditIssue({ stale: true, run: gh.run })).toBe("unchanged");
    expect(gh.calls.some((call) => call[1] === "comment")).toBe(false);
    expect(gh.calls.at(-1)).toEqual([
      "issue",
      "view",
      "41",
      "--json",
      "comments",
      "--jq",
      '.comments[-1].body // ""',
    ]);
  });

  it("comments again when the last comment described a different state", () => {
    const gh = harness("41\n", "an older report");
    expect(syncAuditIssue({ stale: true, run: gh.run })).toBe("commented");
    expect(gh.calls.at(-1)).toEqual(["issue", "comment", "41", "--body", AUDIT_ISSUE_BODY]);
  });

  it("closes every open instance once the note matches again", () => {
    const gh = harness("41\n43\n");
    expect(syncAuditIssue({ stale: false, run: gh.run })).toBe("closed");
    expect(gh.calls.slice(-2)).toEqual([
      ["issue", "close", "41", "--comment", AUDIT_CLOSE_COMMENT],
      ["issue", "close", "43", "--comment", AUDIT_CLOSE_COMMENT],
    ]);
  });

  it("does nothing when a clean check has no issue to close", () => {
    const gh = harness();
    expect(syncAuditIssue({ stale: false, run: gh.run })).toBe("none");
    expect(gh.calls).toHaveLength(1);
  });
});
