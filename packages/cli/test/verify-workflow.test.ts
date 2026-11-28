import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    {
      permissions?: Record<string, string>;
      steps?: Array<{ name?: string; run?: string; env?: Record<string, string> }>;
    }
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

  it("proposes the fixture refresh as a pull request instead of pushing main", () => {
    expect(workflow.jobs["api"]?.permissions?.["pull-requests"]).toBe("write");
    const run = stepRun("api", "Refresh the recorded API fixture");
    expect(run).toContain("pnpm run smoke:fixture");
    expect(run).toContain("automation/api-fixture");
    expect(run).toContain("gh pr create");
    expect(run).toContain("Allow GitHub Actions to create and approve");
  });

  it("turns a blocked refresh into an issue and closes it when unblocked", () => {
    const run = stepRun("api", "Refresh the recorded API fixture");
    expect(run).toContain("pnpm run automation:issue --blocked");
    expect(run).toContain("pnpm run automation:issue --clear");
    // The lag goes into the issue so a worse one comments again.
    expect(run).toContain('--blocked --fixture "${{ steps.live.outputs.fixture }}"');
  });

  it("can use a maintainer token, falling back to the workflow token", () => {
    const step = workflow.jobs["api"]?.steps?.find(
      (candidate) => candidate.name === "Refresh the recorded API fixture",
    );
    expect(step?.env?.["GH_TOKEN"]).toContain("secrets.FIXTURE_REFRESH_TOKEN");
    expect(step?.env?.["GH_TOKEN"]).toContain("github.token");
  });

  it("reads the recorded run from the trigger commit, not the refreshed tree", () => {
    // The refresh step before this one checks out a branch, rebuilds the
    // fixture and commits, so HEAD and the working tree name a newer run than
    // the one the verdict was computed from. Run the step's own command to
    // prove it still answers with the trigger commit's lastRun.
    const run = stepRun("api", "Record the result for /health/");
    const line = run
      .split("\n")
      .map((candidate) => candidate.trim())
      .find((candidate) => candidate.startsWith("recorded="));
    expect(line, "the record step no longer reads a recorded timestamp").toBeDefined();

    const repo = mkdtempSync(join(tmpdir(), "sg-recorded-"));
    const live = join(repo, "fixtures", "live");
    mkdirSync(live, { recursive: true });
    const writeFixture = (lastRun: string) =>
      writeFileSync(join(live, "controls.json"), `${JSON.stringify({ lastRun }, null, 2)}\n`);
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: repo, encoding: "utf8" });
    git("init", "-q");
    git("config", "user.name", "test");
    git("config", "user.email", "test@example.com");
    writeFixture("2026-01-01T00:00:00.000Z");
    git("add", "-A");
    git("commit", "-q", "-m", "recorded fixture");
    const trigger = git("rev-parse", "HEAD").trim();

    git("checkout", "-q", "-b", "automation/api-fixture");
    writeFixture("2026-02-02T00:00:00.000Z");
    git("commit", "-q", "-am", "refreshed fixture");

    const recorded = execFileSync("bash", ["-c", `${line}\nprintf '%s' "$recorded"`], {
      cwd: repo,
      encoding: "utf8",
      env: { ...process.env, GITHUB_SHA: trigger },
    });
    expect(recorded).toBe("2026-01-01T00:00:00.000Z");
  });

  it("records what the refresh step did, so the page cannot promise a pull request", () => {
    const refresh = stepRun("api", "Refresh the recorded API fixture");
    expect(refresh).toContain("refresh=opened");
    expect(refresh).toContain("refresh=blocked");
    expect(refresh).toContain("refresh=current");

    const run = stepRun("api", "Record the result for /health/");
    expect(run).toContain("steps.refresh.outputs.refresh");
    expect(run).toContain("refresh: (if $refresh");
  });

  it("records the fixture verdict for the health page", () => {
    const run = stepRun("api", "Record the result for /health/");
    expect(run).toContain("fixture: (if $fixture");
    // The refresh step checks out its own branch and rewrites the fixture, so
    // the recorded run has to come from the commit the status describes.
    expect(run).toContain('git show "${GITHUB_SHA}:fixtures/live/controls.json"');
  });
});
