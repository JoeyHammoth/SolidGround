import { syncAuditIssue, type AuditIssueOutcome, type GhRunner } from "./audit-issue.js";

/**
 * The deployed JSON is the public contract, so drift earns an issue rather than
 * only a red run someone might not read. The lifecycle is the same one the
 * blocked-package audit uses: one open issue, a comment while it lasts, closed
 * on the next clean check.
 */

export const API_ISSUE_TITLE = "api: the deployed JSON no longer matches its schemas";

export const API_ISSUE_BODY = [
  "`pnpm check:live` reports that a published JSON endpoint fails its schema, names the wrong `$schema`, or cannot be fetched.",
  "Run it locally for the details, fix the endpoint or its schema, and rebuild the site. This issue closes on the next scheduled run that passes.",
  "If only the recorded fixture is behind, refresh it with `curl https://joeyhammoth.github.io/SolidGround/api/v1/controls.json > fixtures/live/controls.json`.",
].join("\n\n");

export const API_CLOSE_COMMENT =
  "Every published endpoint matches its schema again. Closing.";

export function syncApiIssue(options: { stale: boolean; run?: GhRunner }): AuditIssueOutcome {
  return syncAuditIssue({
    stale: options.stale,
    ...(options.run ? { run: options.run } : {}),
    title: API_ISSUE_TITLE,
    body: API_ISSUE_BODY,
    closeComment: API_CLOSE_COMMENT,
  });
}

async function main(argv: string[]): Promise<number> {
  const stale = argv.includes("--stale");
  const clean = argv.includes("--clean");
  if (stale === clean) {
    console.error("usage: api-issue.ts <--stale|--clean>");
    return 2;
  }
  console.log(`api issue: ${syncApiIssue({ stale })}`);
  return 0;
}

const invoked = process.argv[1] ?? "";
if (/api-issue\.(?:ts|js|mts|mjs)$/.test(invoked)) {
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
