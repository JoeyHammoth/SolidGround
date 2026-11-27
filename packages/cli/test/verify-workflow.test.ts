import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

/**
 * The issue lifecycles are unit-tested against a fake `gh`, but nothing proved
 * the workflow actually calls them. This reads the workflow as written, so a
 * dropped step or a missing permission fails the suite instead of silently
 * disarming the nudge.
 */
const workflow = parse(
  readFileSync(new URL("../../../.github/workflows/verify.yml", import.meta.url), "utf8"),
) as {
  jobs: Record<
    string,
    { permissions?: Record<string, string>; steps?: Array<{ name?: string; run?: string }> }
  >;
};

function stepRun(job: string, name: string): string {
  const step = workflow.jobs[job]?.steps?.find((candidate) => candidate.name === name);
  expect(step, `${job} has no step named ${name}`).toBeDefined();
  return step?.run ?? "";
}

describe("verify workflow issue wiring", () => {
  it("lets the audit job own its issue and still exits red when stale", () => {
    expect(workflow.jobs["audit"]?.permissions?.["issues"]).toBe("write");
    const run = stepRun("audit", "Sync the audit issue");
    expect(run).toContain("pnpm run audit:issue --stale");
    expect(run).toContain("pnpm run audit:issue --clean");
    expect(run).toContain("exit 1");
  });

  it("validates the checked-out dataset on every run", () => {
    expect(stepRun("audit", "Validate the published dataset")).toContain(
      "pnpm run validate data",
    );
  });

  it("announces the publish gate from the job that already reads the control log", () => {
    const run = stepRun("audit", "Announce the publish gate");
    expect(run).toContain("pnpm run smoke:gate");
    expect(run).toContain("--notify");
  });

  it("closes the gate reminder from the publish job", () => {
    expect(workflow.jobs["publish"]?.permissions?.["issues"]).toBe("write");
    expect(stepRun("publish", "Close the gate notification")).toContain(
      "pnpm run smoke:gate --close",
    );
  });
});
