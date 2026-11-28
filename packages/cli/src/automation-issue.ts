import { appendFileSync } from "node:fs";
import {
  syncAuditIssueResult,
  type AuditIssueOutcome,
  type AuditIssueResult,
  type GhRunner,
} from "./audit-issue.js";

/**
 * The recorded fixture refresh is proposed as a pull request, and opening one
 * needs repository permission the workflow token may not have. A warning in a
 * log nobody reads is not a durable record, so a blocked refresh owns an issue
 * the same way a stale audit does, and closes on the next run that opens the
 * pull request (or finds nothing to refresh).
 */

export const AUTOMATION_ISSUE_TITLE = "ci: the fixture refresh pull request cannot be opened";

/**
 * The body carries the lag, so the issue lifecycle's one-comment-per-state rule
 * reports a fixture that fell from one batch behind to more than one, and stays
 * quiet while the same block repeats.
 */
export function automationIssueBody(fixture?: string): string {
  const lag =
    fixture === "behind"
      ? "one batch behind the deployed answer"
      : fixture === "stale"
        ? "more than one batch behind the deployed answer"
        : "state not reported by this run";
  return [
    "The scheduled `live API` job rebuilt `fixtures/live/controls.json` and pushed the `automation/api-fixture` branch, but could not open the pull request.",
    `Recorded fixture: ${lag}.`,
    "Enable **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests**, or set a `FIXTURE_REFRESH_TOKEN` secret (contents, pull requests and issues write) for the job to use instead. Alternatively, open the pull request from `automation/api-fixture` by hand and merge it.",
    "The refresh procedure and the ruleset behaviour are in `docs/runbooks/verify.md`. This issue closes on the next run that opens the pull request or finds the fixture current.",
  ].join("\n\n");
}

export const AUTOMATION_ISSUE_BODY = automationIssueBody();

export const AUTOMATION_CLOSE_COMMENT =
  "The fixture refresh pull request can be opened again. Closing.";

export function syncAutomationIssueResult(options: {
  blocked: boolean;
  fixture?: string;
  run?: GhRunner;
}): AuditIssueResult {
  return syncAuditIssueResult({
    stale: options.blocked,
    ...(options.run ? { run: options.run } : {}),
    title: AUTOMATION_ISSUE_TITLE,
    body: automationIssueBody(options.fixture),
    closeComment: AUTOMATION_CLOSE_COMMENT,
  });
}

export function syncAutomationIssue(options: {
  blocked: boolean;
  fixture?: string;
  run?: GhRunner;
}): AuditIssueOutcome {
  return syncAutomationIssueResult(options).outcome;
}

async function main(argv: string[]): Promise<number> {
  const blocked = argv.includes("--blocked");
  const clear = argv.includes("--clear");
  if (blocked === clear) {
    console.error(
    "usage: automation-issue.ts <--blocked [--fixture current|behind|stale] [--github-output]|--clear>",
  );
    return 2;
  }
  const at = argv.indexOf("--fixture");
  const fixture = at >= 0 ? argv[at + 1] : undefined;
  const result = syncAutomationIssueResult({ blocked, ...(fixture ? { fixture } : {}) });
  // The workflow records this for /health/, which links the exact issue rather
  // than a search that may miss it.
  const output = process.env["GITHUB_OUTPUT"];
  if (argv.includes("--github-output") && result.number && output) {
    appendFileSync(output, `issue=${result.number}\n`);
  }
  console.log(`automation issue: ${result.outcome}`);
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
