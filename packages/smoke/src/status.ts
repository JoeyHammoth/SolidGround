import { readFile } from "node:fs/promises";
import type { SmokeResult } from "@solid-ground/schema";
import { checkControls, controlFailures, isControlResult } from "./controls.js";

/**
 * The audit trail of the matrix. Phase 0 gates every later phase on two weeks
 * of clean control runs, so the runs themselves have to be readable rather than
 * living only in a seven-day CI artifact.
 */

export interface ControlDay {
  /** UTC calendar day, `YYYY-MM-DD`. */
  day: string;
  clean: boolean;
  /** Human-readable control failures for the last batch of that day. */
  failures: string[];
  /** Control results recorded that day, across batches. */
  runs: number;
  /** The newest control result timestamp for that day. */
  at: string;
}

export interface ControlHistory {
  days: ControlDay[];
  /** Clean days, counting back from the newest recorded day. */
  streak: number;
  lastRun: string | null;
  /** The gate the design document sets for promoting past phase 0. */
  auditMet: boolean;
}

export const AUDIT_DAYS = 14;
export const DEFAULT_RETENTION_DAYS = 180;
const DAY_MS = 86_400_000;

function dayOf(at: string): string | null {
  const time = new Date(at);
  if (Number.isNaN(time.getTime())) return null;
  return time.toISOString().slice(0, 10);
}

/**
 * Group control results by UTC day and judge each day against the control
 * expectations. One failed batch marks the day: the audit is about whether the
 * harness can be trusted, and a single wrong verdict says it cannot.
 */
export function summarizeControls(results: SmokeResult[]): ControlHistory {
  const controlResults = results.filter((result) => isControlResult(result));
  const byDay = new Map<string, SmokeResult[]>();
  for (const result of controlResults) {
    const day = dayOf(result.at);
    if (day === null) continue;
    const bucket = byDay.get(day) ?? [];
    bucket.push(result);
    byDay.set(day, bucket);
  }

  const days: ControlDay[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, bucket]) => {
      // Every result is judged on its own: a good retry later the same day does
      // not excuse a wrong verdict earlier in it. The batch check adds a failure
      // for a control that did not run at all, so a day is only clean when the
      // full set answered correctly.
      const failures = [
        ...new Set([...checkControls(bucket), ...bucket.flatMap(controlFailures)]),
      ];
      const at = bucket
        .map((result) => result.at)
        .sort()
        .at(-1) as string;
      return { day, clean: failures.length === 0, failures, runs: bucket.length, at };
    });

  let streak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (!(days[index] as ControlDay).clean) break;
    streak += 1;
  }

  return {
    days,
    streak,
    lastRun: days.length > 0 ? (days.at(-1) as ControlDay).at : null,
    auditMet: streak >= AUDIT_DAYS,
  };
}

/** The fields the log needs; the site and the CLI use the same guard. */
function isResult(value: unknown): value is SmokeResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  const smoke = result["smoke"] as Record<string, unknown> | undefined;
  return (
    typeof result["name"] === "string" &&
    typeof result["at"] === "string" &&
    typeof smoke === "object" &&
    smoke !== null &&
    ["import", "build", "types"].every(
      (step) => smoke[step] === null || typeof smoke[step] === "boolean",
    )
  );
}

/**
 * One archived month in the control log. Raw results older than the retention
 * window are replaced by these, so the file stays bounded while the audit still
 * remembers that the month happened and how much of it was clean.
 */
export interface ControlSummary {
  schemaVersion: 1;
  kind: "control-summary";
  /** `YYYY-MM`. */
  month: string;
  days: number;
  cleanDays: number;
  results: number;
}

export function isControlSummary(value: unknown): value is ControlSummary {
  if (typeof value !== "object" || value === null) return false;
  const summary = value as Record<string, unknown>;
  return (
    summary["kind"] === "control-summary" &&
    typeof summary["month"] === "string" &&
    typeof summary["days"] === "number" &&
    typeof summary["cleanDays"] === "number" &&
    typeof summary["results"] === "number"
  );
}

export interface ControlLog {
  results: SmokeResult[];
  summaries: ControlSummary[];
}

/** Parse the append-only log; a damaged line is skipped, not fatal. */
export function parseControlLog(text: string): ControlLog {
  const results: SmokeResult[] = [];
  const summaries: ControlSummary[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isResult(parsed)) results.push(parsed);
      else if (isControlSummary(parsed)) summaries.push(parsed);
    } catch {
      // Ignore a truncated or hand-edited line.
    }
  }
  return { results, summaries };
}

export function parseControlHistory(text: string): SmokeResult[] {
  return parseControlLog(text).results;
}

/** Read the append-only control log; a missing file is an empty history. */
export async function readControlLog(file: string): Promise<ControlLog> {
  try {
    return parseControlLog(await readFile(file, "utf8"));
  } catch {
    return { results: [], summaries: [] };
  }
}

export async function readControlHistory(file: string): Promise<SmokeResult[]> {
  return (await readControlLog(file)).results;
}

/**
 * Bound the log: keep `retentionDays` of raw control results and replace the
 * rest with one summary per month. A month is summarized only once, because a
 * later run cannot move a result back out of the archived window.
 */
export function compactControlLog(
  text: string,
  options: { retentionDays: number; now?: Date },
): { text: string; kept: number; summarized: number } {
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - options.retentionDays * DAY_MS;
  const { results, summaries } = parseControlLog(text);
  const byMonth = new Map(summaries.map((summary) => [summary.month, summary]));
  const kept: SmokeResult[] = [];
  const archived = new Map<string, SmokeResult[]>();

  for (const result of results) {
    const time = new Date(result.at).getTime();
    if (Number.isNaN(time) || time >= cutoff) {
      kept.push(result);
      continue;
    }
    const month = result.at.slice(0, 7);
    archived.set(month, [...(archived.get(month) ?? []), result]);
  }

  let summarized = 0;
  for (const [month, monthResults] of archived) {
    if (byMonth.has(month)) continue;
    const history = summarizeControls(monthResults);
    byMonth.set(month, {
      schemaVersion: 1,
      kind: "control-summary",
      month,
      days: history.days.length,
      cleanDays: history.days.filter((day) => day.clean).length,
      results: monthResults.length,
    });
    summarized += 1;
  }

  const lines = [
    ...[...byMonth.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((summary) => JSON.stringify(summary)),
    ...kept
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((result) => JSON.stringify(result)),
  ];
  return {
    text: lines.length > 0 ? `${lines.join("\n")}\n` : "",
    kept: kept.length,
    summarized,
  };
}

/** One line per day, newest last, for the CLI. */
export function describeControls(
  history: ControlHistory,
  limit = 14,
  summaries: ControlSummary[] = [],
): string[] {
  const lines = history.days.slice(-limit).map((day) => {
    const label = day.clean ? "clean" : "FAIL ";
    return `${label} ${day.day}  ${day.runs} control result(s) at ${day.at.slice(11, 19)}Z`;
  });
  for (const summary of summaries) {
    lines.push(
      `archived ${summary.month}  ${summary.days} day(s), ${summary.cleanDays} clean, ` +
        `${summary.results} result(s)`,
    );
  }
  const gate = history.auditMet ? "met" : "not met";
  lines.push(
    `${history.days.length} control day(s) on record; ${history.streak} clean in a row; ` +
      `last run ${history.lastRun ?? "never"}; two-week audit gate ${gate}`,
  );
  return lines;
}
