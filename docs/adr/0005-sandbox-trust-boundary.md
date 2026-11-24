# ADR 0005: Treat every package as hostile; verify in ephemeral jobs

- **Status:** accepted
- **Date:** 2026-11-25

## Context

Importing a package executes its code. A tracker that runs `npm install` and
`import` on arbitrary published code is a supply-chain target: a malicious
package could read the job token, exfiltrate data, or poison the dataset.

## Decision

- Static scanning parses files and never executes them.
- Smoke tests run one package per matrix job on an ephemeral GitHub-hosted
  runner with `permissions: contents: read`, no secrets and a hard timeout.
- Egress is restricted with StepSecurity Harden-Runner: start in `audit`, then
  `block` with only `registry.npmjs.org:443` and the GitHub hosts allowlisted.
- Installs use `--ignore-scripts` and a fresh, lockfile-less resolution with
  overrides forcing a single Solid 2 copy.
- Matrix values are passed via `env:`, never interpolated into `run:`.
- Results leave the sandbox only as schema-validated JSON artifacts.
- The publish job never touches package code.

## Consequences

- Slower than a single job, but a compromise cannot reach a write token.
- Some packages will fail for environmental reasons; the harness records
  `smoke: error`, never `fail`, and retries once.
- Known-good and known-bad control fixtures run in every batch; if they do not
  return their expected verdicts, the batch is discarded as an infrastructure
  failure.
