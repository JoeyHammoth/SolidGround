import { execFileSync } from "node:child_process";
import { AUDIT_DAYS } from "./status.js";

/**
 * The two-week gate is enforced in `publish.ts`, but a log that quietly reaches
 * fourteen clean days helps nobody if no one notices. This module owns the one
 * issue that says the gate is ready and the one that says it is done, so both
 * branches can be tested without touching GitHub.
 */

export const GATE_ISSUE_TITLE = "smoke: the two-week control gate is met";
export const GATE_CLOSE_COMMENT =
  "The first publish batch landed, so this gate notification is done.";

export type GhRunner = (args: string[]) => string;
export type GateAnnouncement = "created" | "existing" | "none";
export type GateClose = "closed" | "none";

function defaultGh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8" });
}

export function gateBody(streak: number): string {
  return [
    `The control log holds ${streak} clean day(s) in a row, meeting the ${AUDIT_DAYS}-day gate.`,
    "Dispatch Verify with `publish: true` to fold the first batch into the edition: `gh workflow run verify.yml --ref main -f publish=true`. `pnpm smoke:publish` refuses until this gate is met, so this is the only remaining step.",
    "The publish job closes this issue once the batch is committed.",
  ].join("\n\n");
}

function openIssues(run: GhRunner, title: string): string[] {
  return run([
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
}

/** Open the reminder once the gate is met; never open a second copy. */
export function announceGate(options: {
  ready: boolean;
  streak: number;
  run?: GhRunner;
  title?: string;
}): GateAnnouncement {
  if (!options.ready) return "none";
  const run = options.run ?? defaultGh;
  const title = options.title ?? GATE_ISSUE_TITLE;
  if (openIssues(run, title).length > 0) return "existing";
  run(["issue", "create", "--title", title, "--body", gateBody(options.streak)]);
  return "created";
}

/** Close the reminder after a publish; harmless when it was never opened. */
export function closeGateIssue(options: {
  run?: GhRunner;
  title?: string;
} = {}): GateClose {
  const run = options.run ?? defaultGh;
  const open = openIssues(run, options.title ?? GATE_ISSUE_TITLE);
  for (const number of open) {
    run(["issue", "close", number, "--comment", GATE_CLOSE_COMMENT]);
  }
  return open.length > 0 ? "closed" : "none";
}
