import type { SmokeResult, SmokeResults } from "@solid-ground/schema";
import type { SmokeSteps } from "./plan.js";

/**
 * Three fixtures run in every batch. If any control returns the wrong verdict,
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
  /**
   * The specifier the runner must have probed, when it is not the package
   * root. This is what makes a subpath-only fixture a real regression guard:
   * a root probe fails the batch even if the steps somehow pass.
   */
  target?: string;
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
  {
    // No root export, only `./widget`. If the subpath probe regresses, this
    // control fails and every batch is discarded, which is exactly the alarm
    // we want rather than silently mis-testing subpath-only packages.
    id: "control-subpath",
    name: "@solid-ground/control-subpath",
    path: "packages/smoke/fixtures/control-subpath",
    steps: { import: true, build: true, types: true },
    expected: { import: true, build: true, types: true },
    target: "@solid-ground/control-subpath/widget",
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

/** True when a result belongs to a control fixture rather than a package. */
export function isControlResult(result: SmokeResult): boolean {
  return CONTROLS.some((control) => control.name === result.name);
}

/**
 * Judge one control result against its expectation. Returns human-readable
 * failures; an empty array means the control answered correctly.
 */
export function controlFailures(result: SmokeResult): string[] {
  const control = CONTROLS.find((candidate) => candidate.name === result.name);
  if (!control) return [];
  const failures: string[] = [];
  if (result.error) {
    failures.push(`${control.id}: environmental failure (${result.error})`);
  }
  if (control.target !== undefined && result.target !== control.target) {
    failures.push(
      `${control.id}: probed ${String(result.target)}, expected ${control.target}`,
    );
  }
  for (const [step, expected] of Object.entries(control.expected) as Array<
    [keyof SmokeResults, boolean]
  >) {
    const actual = result.smoke[step];
    if (actual !== expected) {
      failures.push(
        `${control.id}: ${step} was ${String(actual)}, expected ${String(expected)}`,
      );
    }
  }
  return failures;
}

/**
 * Check every control against its expectation, keeping only the newest result
 * for each. Returns human-readable failures; an empty array means the batch can
 * be trusted.
 */
export function checkControls(results: SmokeResult[]): string[] {
  const failures: string[] = [];
  for (const control of CONTROLS) {
    const latest = results
      .filter((result) => result.name === control.name)
      .sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? 1 : -1))[0];
    if (!latest) {
      failures.push(`${control.id}: no result in the batch`);
      continue;
    }
    failures.push(...controlFailures(latest));
  }
  return failures;
}
