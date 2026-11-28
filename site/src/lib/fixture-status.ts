/**
 * The Verify `live API` job records how `fixtures/live/controls.json` compared
 * to the deployed answer. The label is kept away from the page so the wording
 * can be tested without building Astro.
 */
export function describeFixtureStatus(status: string): string {
  switch (status) {
    case "current":
      return "current";
    case "behind":
      return "one batch behind";
    case "stale":
      return "more than one batch behind";
    default:
      return "unknown";
  }
}

/**
 * What the same run did about the lag. A blocked refresh has no pull request to
 * merge, so pages must not promise one; `unknown` covers an edition recorded
 * before the field existed and says nothing either way.
 */
export function refreshOutcome(
  refresh: string | null | undefined,
): "current" | "opened" | "blocked" | "skipped" | "unknown" {
  switch (refresh) {
    case "current":
      return "current";
    case "opened":
      return "opened";
    case "blocked":
      return "blocked";
    case "skipped":
      return "skipped";
    default:
      return "unknown";
  }
}

/**
 * The public half of a recorded fixture, for `/api/v1/gate.json`. The refresh
 * outcome and the blocker issue belong to `/health/` and `api-check.json`; the
 * gate payload is published against a schema that lists only these two, so it
 * must not pass the whole record through.
 */
export function publicFixture(
  fixture: { status: string; lastRun: string | null } | null | undefined,
): { status: string; lastRun: string | null } | null {
  return fixture ? { status: fixture.status, lastRun: fixture.lastRun } : null;
}

/**
 * One line for the header badge, which every page shows. Null when there is
 * nothing to report: no recording, or a recording that is current.
 */
export function fixtureTooltip(
  fixture: { status: string; refresh?: string | null } | null | undefined,
): string | null {
  if (!fixture || fixture.status === "current") return null;
  const blocked = refreshOutcome(fixture.refresh) === "blocked" ? ", refresh blocked" : "";
  return `Recorded fixture ${describeFixtureStatus(fixture.status)}${blocked}`;
}
