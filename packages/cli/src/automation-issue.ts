import { syncAuditIssue, type AuditIssueOutcome, type GhRunner } from "./audit-issue.js";

/**
 * The recorded fixture refresh is proposed as a pull request, and opening one
 * needs repository permission the workflow token may not have. A warning in a
 * log nobody reads is not a durable record, so a blocked refresh owns an issue
 * the same way a stale audit does, and closes on the next run that opens the
 * pull request (or finds nothing to refresh).
 */

export const AUTOMATION_ISSUE_TITLE = "ci: the fixture refresh pull request cannot be opened";

export const AUTOMATION_ISSUE_BODY = [
  "The scheduled `live API` job rebuilt `fixtures/live/controls.json` and pushed the `automation/api-fixture` branch, but could not open the pull request.",
  "Enable **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**, then rerun the job. Alternatively, open the pull request from `automation/api-fixture` by hand and merge it.",
  "The refresh procedure and the ruleset behaviour are in `docs/runbooks/verify.md`. This issue closes on the next run that opens the pull request or finds the fixture current.",
].join("\n\n");

export const AUTOMATION_CLOSE_COMMENT =
  "The fixture refresh pull request can be opened again. Closing.";

export function syncAutomationIssue(options: {
  blocked: boolean;
  run?: GhRunner;
}): AuditIssueOutcome {
  return syncAuditIssue({
    stale: options.blocked,
    ...(options.run ? { run: options.run } : {}),
    title: AUTOMATION_ISSUE_TITLE,
    body: AUTOMATION_ISSUE_BODY,
    closeComment: AUTOMATION_CLOSE_COMMENT,
  });
}

async function main(argv: string[]): Promise<number> {
  const blocked = argv.includes("--blocked");
  const clear = argv.includes("--clear");
  if (blocked === clear) {
    console.error("usage: automation-issue.ts <--blocked|--clear>");
    return 2;
  }
  console.log(`automation issue: ${syncAutomationIssue({ blocked })}`);
  return 0;
}

const invoked = process.argv[1] ?? "";
if (/automation-issue\.(?:ts|js|mts|mjs)$/.test(invoked)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
