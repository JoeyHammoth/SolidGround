import { describe, expect, it } from "vitest";
import {
  API_CLOSE_COMMENT,
  API_ISSUE_BODY,
  API_ISSUE_TITLE,
  syncApiIssue,
} from "../src/api-issue.js";

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

describe("syncApiIssue", () => {
  it("names the API check in the issue it opens", () => {
    const gh = harness();
    expect(syncApiIssue({ stale: true, run: gh.run })).toBe("created");
    expect(gh.calls.at(-1)).toEqual([
      "issue",
      "create",
      "--title",
      API_ISSUE_TITLE,
      "--body",
      API_ISSUE_BODY,
    ]);
    expect(API_ISSUE_TITLE).toContain("deployed JSON");
    expect(API_ISSUE_BODY).toContain("pnpm check:live");
    expect(API_ISSUE_BODY).toContain("fixtures/live/controls.json");
  });

  it("comments on the open issue and closes it with its own comment", () => {
    const gh = harness("51\n");
    expect(syncApiIssue({ stale: true, run: gh.run })).toBe("commented");
    expect(gh.calls.at(-1)).toEqual(["issue", "comment", "51", "--body", API_ISSUE_BODY]);

    expect(syncApiIssue({ stale: false, run: gh.run })).toBe("closed");
    expect(gh.calls.at(-1)).toEqual(["issue", "close", "51", "--comment", API_CLOSE_COMMENT]);
    expect(API_CLOSE_COMMENT).not.toContain("audit");
  });
});
