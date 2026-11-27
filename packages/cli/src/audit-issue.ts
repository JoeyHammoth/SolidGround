import { execFileSync } from "node:child_process";

/**
 * Keep the blocked-package audit drift visible. The workflow hands this module
 * the result of `audit:blocked --check`, and it owns the issue lifecycle so the
 * decide/create/close branches can be tested without touching GitHub.
 */

export const AUDIT_ISSUE_TITLE = "docs: the blocked-package audit is stale";
export const AUDIT_CLOSE_COMMENT =
  "The committed audit matches the published edition again. Closing.";
export const AUDIT_ISSUE_BODY = [
  "The committed audit no longer matches the edition on the data branch.",
  "Run `pnpm audit:blocked --data data`, review the diff and commit it. This job stays red until the note matches again.",
].join("\n\n");

export type AuditIssueOutcome = "created" | "commented" | "closed" | "none";
export type GhRunner = (args: string[]) => string;

function defaultGh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8" });
}

/** Sync the single audit issue with the current drift state. */
export function syncAuditIssue(options: {
  stale: boolean;
  run?: GhRunner;
  title?: string;
  body?: string;
  closeComment?: string;
}): AuditIssueOutcome {
  const title = options.title ?? AUDIT_ISSUE_TITLE;
  const body = options.body ?? AUDIT_ISSUE_BODY;
  const closeComment = options.closeComment ?? AUDIT_CLOSE_COMMENT;
  const run = options.run ?? defaultGh;
  const open = run([
    "issue",
    "list",
    "--state",
    "open",
    "--limit",
    "100",
    "--json",
    "number,title",
    "--jq",
    `.[] | select(.title == ${JSON.stringify(title)}) | .number`,
  ])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (options.stale) {
    const first = open[0];
    if (first) {
      run(["issue", "comment", first, "--body", body]);
      return "commented";
    }
    run(["issue", "create", "--title", title, "--body", body]);
    return "created";
  }

  for (const number of open) {
    run(["issue", "close", number, "--comment", closeComment]);
  }
  return open.length > 0 ? "closed" : "none";
}

async function main(argv: string[]): Promise<number> {
  const stale = argv.includes("--stale");
  const clean = argv.includes("--clean");
  if (stale === clean) {
    console.error("usage: audit-issue.ts <--stale|--clean>");
    return 2;
  }
  const outcome = syncAuditIssue({ stale });
  console.log(`audit issue: ${outcome}`);
  return 0;
}

const invoked = process.argv[1] ?? "";
if (/audit-issue\.(?:ts|js|mts|mjs)$/.test(invoked)) {
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
