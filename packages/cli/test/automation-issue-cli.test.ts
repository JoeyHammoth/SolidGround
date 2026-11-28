import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The refresh step runs `automation:issue` with `GH_TOKEN` set either from the
 * `FIXTURE_REFRESH_TOKEN` secret or from `github.token`. The workflow test
 * checks the expression; this one runs the command against a fake `gh` so the
 * step is known to work under either value, and the token reaches `gh`.
 */
const CLI = "packages/cli/src/automation-issue.ts";

interface Call {
  token: string;
  args: string;
}

function run(fixture: string, token: string | undefined): { output: string; calls: Call[] } {
  const dir = mkdtempSync(join(tmpdir(), "sg-fake-gh-"));
  const log = join(dir, "calls.tsv");
  const gh = join(dir, "gh");
  writeFileSync(
    gh,
    [
      "#!/bin/sh",
      // One log line per call: flatten the body's newlines so the arguments
      // stay on the line they belong to.
      `printf '%s\\t%s\\n' "\${GH_TOKEN-unset}" "$(printf '%s ' "$@" | tr '\\n' ' ')" >> "${log}"`,
      'if [ "$1" = "issue" ] && [ "$2" = "list" ]; then exit 0; fi',
      'if [ "$1" = "issue" ] && [ "$2" = "view" ]; then exit 0; fi',
      "exit 0",
      "",
    ].join("\n"),
  );
  chmodSync(gh, 0o755);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${dir}:${process.env.PATH ?? ""}`,
  };
  delete env["GH_TOKEN"];
  if (token !== undefined) env["GH_TOKEN"] = token;

  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", CLI, "--blocked", "--fixture", fixture],
    { encoding: "utf8", env },
  );
  const calls = readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [seen = "", ...rest] = line.split("\t");
      return { token: seen, args: rest.join("\t") };
    });
  return { output, calls };
}

describe("automation:issue with a token", () => {
  it("hands the maintainer token to every gh call", () => {
    const { output, calls } = run("behind", "pat-token");
    expect(output).toContain("automation issue: created");
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((call) => call.token === "pat-token")).toBe(true);

    const create = calls.at(-1);
    expect(create?.args).toContain("issue create");
    expect(create?.args).toContain("Recorded fixture: one batch behind");
  });

  it("works when only the workflow token is present", () => {
    // The workflow falls back to github.token; the command itself must not
    // depend on the secret existing.
    const { output, calls } = run("stale", undefined);
    expect(output).toContain("automation issue: created");
    expect(calls[0]?.token).toBe("unset");
    expect(calls.at(-1)?.args).toContain("Recorded fixture: more than one batch behind");
  });
}, 30_000);
