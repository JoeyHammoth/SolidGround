import { describe, expect, it } from "vitest";
import {
  AUTOMATION_CLOSE_COMMENT,
  AUTOMATION_ISSUE_BODY,
  AUTOMATION_ISSUE_TITLE,
  syncAutomationIssue,
} from "../src/automation-issue.js";

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
    expect(AUTOMATION_ISSUE_BODY).toContain("automation/api-fixture");
    expect(AUTOMATION_ISSUE_BODY).toContain("docs/runbooks/verify.md");
  });

  it("comments while blocked and closes once the pull request opens", () => {
    const gh = harness("83\n");
    expect(syncAutomationIssue({ blocked: true, run: gh.run })).toBe("commented");
    expect(gh.calls.at(-1)).toEqual(["issue", "comment", "83", "--body", AUTOMATION_ISSUE_BODY]);

    expect(syncAutomationIssue({ blocked: false, run: gh.run })).toBe("closed");
    expect(gh.calls.at(-1)).toEqual(["issue", "close", "83", "--comment", AUTOMATION_CLOSE_COMMENT]);
    expect(AUTOMATION_CLOSE_COMMENT).not.toContain("audit");
  });

  it("leaves no issue behind when nothing was ever blocked", () => {
    expect(syncAutomationIssue({ blocked: false, run: harness().run })).toBe("none");
  });
});
