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
