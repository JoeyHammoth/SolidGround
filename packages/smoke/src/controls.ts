import type { SmokeResult, SmokeResults } from "@solid-ground/schema";
import type { SmokeSteps } from "./plan.js";

/**
 * Two fixtures run in every batch. If either control returns the wrong verdict,
 * the batch is discarded as an infrastructure failure: without this guard a
 * broken sandbox quietly marks every package as failing, which is worse than no
 * verification at all.
 */

export interface Control {
  /** Stable id, also used as the artifact name. */
  id: string;
  name: string;
  /** Repo-relative directory holding the fixture package. */
  path: string;
  steps: SmokeSteps;
  /** What each attempted step must return for the harness to be trusted. */
  expected: Partial<SmokeResults>;
}

export const CONTROLS: readonly Control[] = [
  {
    id: "control-good",
    name: "@solid-ground/control-good",
    path: "packages/smoke/fixtures/control-good",
    steps: { import: true, build: true, types: true },
    expected: { import: true, build: true, types: true },
  },
  {
    id: "control-bad",
    name: "@solid-ground/control-bad",
    path: "packages/smoke/fixtures/control-bad",
    // The point is the failing import; building a package that cannot load
    // proves nothing extra and only burns the job's budget.
    steps: { import: true, build: false, types: false },
    expected: { import: false },
  },
];

/** Cells for the controls, aimed at the Solid release under test. */
export function controlCells(solid: string): Array<{
  id: string;
  name: string;
  version: string;
  solid: string;
  channel: "stable";
  steps: SmokeSteps;
  source: { kind: "path"; path: string };
}> {
  return CONTROLS.map((control) => ({
    id: control.id,
    name: control.name,
    version: "0.0.0",
    solid,
    channel: "stable" as const,
    steps: control.steps,
    source: { kind: "path" as const, path: control.path },
  }));
}

/**
 * Check every control against its expectation. Returns human-readable failures;
 * an empty array means the batch can be trusted.
 */
export function checkControls(results: SmokeResult[]): string[] {
  const failures: string[] = [];
  for (const control of CONTROLS) {
    const mine = results
      .filter((result) => result.name === control.name)
      .sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? 1 : -1));
    const latest = mine[0];
    if (!latest) {
      failures.push(`${control.id}: no result in the batch`);
      continue;
    }
    if (latest.error) {
      failures.push(`${control.id}: environmental failure (${latest.error})`);
    }
    for (const [step, expected] of Object.entries(control.expected) as Array<
      [keyof SmokeResults, boolean]
    >) {
      const actual = latest.smoke[step];
      if (actual !== expected) {
        failures.push(
          `${control.id}: ${step} was ${String(actual)}, expected ${String(expected)}`,
        );
      }
    }
  }
  return failures;
}
