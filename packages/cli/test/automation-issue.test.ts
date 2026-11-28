import { describe, expect, it } from "vitest";
import {
  AUTOMATION_CLOSE_COMMENT,
  AUTOMATION_ISSUE_BODY,
  AUTOMATION_ISSUE_TITLE,
  automationIssueBody,
  syncAutomationIssue,
} from "../src/automation-issue.js";

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

describe("syncAutomationIssue", () => {
  it("names the missing permission in the issue it opens", () => {
    const gh = harness();
    expect(syncAutomationIssue({ blocked: true, run: gh.run })).toBe("created");
    expect(gh.calls.at(-1)).toEqual([
      "issue",
      "create",
      "--title",
      AUTOMATION_ISSUE_TITLE,
      "--body",
      AUTOMATION_ISSUE_BODY,
    ]);
    expect(AUTOMATION_ISSUE_BODY).toContain("Allow GitHub Actions to create and approve pull requests");
    expect(AUTOMATION_ISSUE_BODY).toContain("FIXTURE_REFRESH_TOKEN");
    expect(AUTOMATION_ISSUE_BODY).toContain("automation/api-fixture");
    expect(AUTOMATION_ISSUE_BODY).toContain("docs/runbooks/verify.md");
  });

  it("names the lag the run could not refresh", () => {
    expect(automationIssueBody("behind")).toContain("Recorded fixture: one batch behind");
    expect(automationIssueBody("stale")).toContain(
      "Recorded fixture: more than one batch behind",
    );
    expect(automationIssueBody()).toContain("Recorded fixture: state not reported");
    // Different states produce different bodies, which is what lets the issue
    // comment once per state instead of once per run.
    expect(automationIssueBody("behind")).not.toBe(automationIssueBody("stale"));
  });

  it("comments while blocked and closes once the pull request opens", () => {
    const gh = harness("83\n");
    expect(syncAutomationIssue({ blocked: true, fixture: "behind", run: gh.run })).toBe("commented");
    expect(gh.calls.at(-1)).toEqual([
      "issue",
      "comment",
      "83",
      "--body",
      automationIssueBody("behind"),
    ]);

    expect(syncAutomationIssue({ blocked: false, run: gh.run })).toBe("closed");
    expect(gh.calls.at(-1)).toEqual(["issue", "close", "83", "--comment", AUTOMATION_CLOSE_COMMENT]);
    expect(AUTOMATION_CLOSE_COMMENT).not.toContain("audit");
  });

  it("stays quiet when the same block repeats with the same lag", () => {
    const gh = harness("83\n", automationIssueBody("behind"));
    expect(syncAutomationIssue({ blocked: true, fixture: "behind", run: gh.run })).toBe("unchanged");
    expect(gh.calls.some((call) => call[1] === "comment")).toBe(false);
  });

  it("leaves no issue behind when nothing was ever blocked", () => {
    expect(syncAutomationIssue({ blocked: false, run: harness().run })).toBe("none");
  });
});
