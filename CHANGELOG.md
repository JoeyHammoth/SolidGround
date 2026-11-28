# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `/health/` names a blocked refresh for what it is: the page links the `ci: …`
  issue instead of claiming a refresh pull request is open, and `/llms.txt` no
  longer says to merge one. The header smoke badge carries the recorded
  fixture's lag in its tooltip on every page.
- `/api/v1/gate.json` publishes the recorded fixture's state and run beside the
  gate numbers, so a monitor reads the lag without loading `/health/`. It is
  null in an edition with no recorded API check, and optional in the schema so
  a payload built before the field existed still validates.
- `/health/` names the recorded fixture's state — current, one batch behind or
  more than one batch behind — from the last scheduled API check, so a stale
  recording is visible without opening an Actions log.
- `/llms.txt` names the recorded gate fixture's state and the run it was
  recorded at, and says when `/api/v1/controls.json` may list a newer run than
  the gate counts, so an agent reading the document does not take a lagging
  recording for a current one.
- A blocked fixture refresh owns one `ci: …` issue: when the workflow token may
  not open the pull request, the job names the Actions setting to enable and
  closes the issue on the next run that opens it, or finds nothing to refresh.
- The `live API` job proposes the recorded fixture refresh as a pull request:
  it rebuilds `fixtures/live/controls.json` from the data branch, force-pushes
  one `automation/api-fixture` branch and reuses a single open pull request, so
  the refresh never needs a bypass on `main`. `docs/runbooks/verify.md` names the
  two settings it needs and the exact bypass a direct push would require.
- A fixture one batch behind now prints a `note` instead of a warning: every
  nightly batch moves `lastRun`, so only a fixture two or more batches behind —
  or one whose recorded day no longer matches the deployed answer — warns.
- A publish-gate reminder: `pnpm smoke:gate` reports the clean-day count, and
  `--notify` opens one issue when the fourteen-day gate is met, with the
  `publish=true` dispatch to run. The publish job closes it after committing,
  so the notification is neither missed nor left behind.
- `pnpm check` prints a `Probed` column beside each package, naming the subpath
  the sandbox imported (`root` for a root pass) so the CLI report matches the
  site. Index rows carry `smokeAt` so the two can be told apart after a publish.
- The home page and the health page count down the clean days still needed for
  the publish gate, instead of only saying whether it is met.
- `index.json` is now schema-validated: a new `index-row.schema.json` checks
  every row, including `smokeTarget` and `smokeAt`, and `pnpm validate` reports
  the failing row by position. `meta.json` and `solid.json` gain their own
  schemas, so every published dataset file is checked.
- The site header carries a smoke-gate badge (`Smoke gate 0/14`) linking to the
  health page, with the remaining clean days in its tooltip; waiting and met
  states are styled differently.
- The control log is schema-validated: each line must be a smoke result or an
  archived `control-summary`, and `pnpm validate` reports the failing line.
- Verify validates the checked-out data branch on every scheduled run, so a
  malformed `index`, `meta`, `solid`, record, event or control-log file turns
  the audit job red before the next publish.
- `pnpm smoke:gate --json` prints the streak, required days, remaining days and
  readiness for a monitor; with `--notify` it adds the issue outcome.
- The health page reports build-time dataset consistency (record/index/meta and
  control-day agreement) alongside the deploy's recorded full schema validation.
- `pnpm validate --json` prints a machine-readable `{ ok, checkedAt, targets,
  problems }` summary, and the deploy writes it into the dataset checkout so the
  health page can show when and over what the edition passed.
- `/api/v1/gate.json` exposes the publish-gate streak, required and remaining
  days, readiness and last control run as JSON.
- `/api/v1/validation.json` publishes the deploy's recorded schema validation,
  with an explicit `recorded: false` shape when a build has no summary.
- `/llms.txt` is generated at build and now states the publish-gate streak,
  remaining days, last control run and recorded schema validation, linking
  `gate.json` and `validation.json`.
- The health page draws the last fourteen control days as a clean/failed
  timeline instead of a plain list, with a legend and a full date/state/run-count
  label on each cell.
- `validation.json` names the validated dataset (`data`) instead of exposing the
  runner's checkout path, and the footer links `llms.txt` for assistants.
- Failed control days on `/health/` expand to the individual control failures,
  grouped by control id and counted on the timeline cell, the validation line
  names the validated dataset, and a test fails when the README JSON API table
  drifts from the endpoints on disk.
- `gate.schema.json` and `validation.schema.json` define the two publish-gate
  JSON responses, tests validate the generated endpoint bodies against them
  (including a gate with no runs), and the README API table links both schemas.
- `pnpm smoke:fixture` regenerates `fixtures/live/controls.json` from the
  control log with the same `controlsResponse` builder `/api/v1/controls.json`
  serves, so the recorded answer cannot differ from the served one. It stays a
  PR rather than a workflow commit: `main` requires a pull request and two
  green checks, and a workflow token push is rejected.
- The site header's smoke badge carries the deployed API check in its tooltip
  (`API check passed <time>`), so a drift is visible from any page instead of
  only `/health/`.
- ADR 0006 records why `$schema` points at the raw schema files rather than the
  `$id` domain: `solid-ground.dev` does not resolve, so the canonical URL would
  be a dead link. It also names the one-line switch for when it does.
- `/health/` reports the last deployed API check: pass or fail, when it ran,
  how many endpoints answered and the problems behind a failure. The Verify
  `live API` job records the result as `api-check.json` on the `data` branch,
  so the page needs no request-time work and a broken endpoint is visible
  without opening an Actions log.
- The Verify workflow now checks the deployed JSON on every scheduled run:
  `pnpm check:live` validates each endpoint, and a failure opens one issue
  (`pnpm api:issue --stale`) that closes on the next clean run. The control
  matrix keeps running whether or not the API check passes.
- `pnpm check:live --strict` also fails when `fixtures/live/controls.json` is
  older than the deployed `lastRun`, and a scheduled run that finds it behind
  prints the refresh command as a warning instead of failing every night.
  `docs/runbooks/verify.md` documents the refresh step.
- `pnpm check:live` fetches the published JSON endpoints and validates every
  body against its schema, including the `$schema` each one names. It needs
  network access, so it stays out of `pnpm test`; a recorded deployed
  `controls.json` in `fixtures/live/` covers the same shape offline.
- `/health/` links `controls.json` from the smoke section and the
  machine-readable footer, so the grouped failure reasons are one click from a
  page before anyone reaches for `curl`.
- `smoke:status --json --last <n>` is tested to return only the newest `n`
  days, with the unlimited report as the control.
- `/api/v1/gate.json`, `/api/v1/validation.json` and the new `/api/v1/controls.json`
  carry a `$schema` field naming their JSON Schema, so a consumer can validate a
  response without hard-coding the repository path.
- `/api/v1/controls.json` publishes the control-day audit trail: the streak and
  remaining days, plus one entry per day with its run count, failure count and
  failures grouped by control id. `controls.schema.json` describes it.
- `pnpm smoke:status --strict` becomes a usable CI gate: two new tests pin that
  it exits 1 when the newest control day is not clean and 0 when it is, so the
  command's exit code is now part of the contract.
- `pnpm smoke:status` renders the same grouped failure reasons as `/health/`,
  so the terminal no longer repeats a control id on every line. `--json` emits
  the same grouped report for monitors, and a test pins both formats.
- `llms.txt` links the gate and validation response schemas.
- A workflow test reads `verify.yml` and fails if the audit job stops calling
  `audit:issue`, loses `issues: write`, or the gate steps are unwired.
- Change events: `diffRecords` emits one event per new package, status change,
  Solid 2 version change or expired override, and collect appends them to
  `events.ndjson` on the `data` branch by diffing the edition already published
  there. Events older than twelve months are compacted into monthly summaries.
- `diffMeta` adds dataset events from `meta.json`: a new Solid stable release, a
  move on the `next` line, a rules version change, and the anomaly hold
  appearing, changing or clearing.
- `events.ndjson` is schema-validated line by line, so a malformed event fails
  collect and deploy with its line number instead of disappearing at read time.
- Sandbox runner for the smoke matrix: `pnpm smoke:run` installs one package
  version against one Solid version in a throwaway directory with
  `--ignore-scripts`, pins a single `solid-js` copy through `pnpm.overrides`,
  and reports import, build and type results. Install failures stay `null` with
  the reason attached, never `false`.
- The known-good and known-bad control fixtures run in every batch. If either
  answers wrongly, `smoke:report` discards the whole batch and writes no
  results. Collect's publish step now
  preserves the verify matrix's `smoke/` directory when it replaces the data
  branch.
- `verify.yml` plans a batch from the published edition, runs one cell per job
  with Harden-Runner in `audit` mode, then validates the artifacts and the
  controls. Phase 0 has no publish job, so a run cannot change a record yet.
- Package pages render the folded smoke evidence once a pass is published:
  import, build and types verdicts, when the cell finished, and the subpath it
  probed (`smokeTarget` on the record). A page whose record has no sandbox
  result shows nothing new rather than a wall of "not run".
- The home table gains a "Probed" column and `index.json` rows carry
  `smokeTarget`, so the API index and the table agree on which subpath a pass
  imported.
- The audit job's issue lifecycle lives in `audit:issue` with tests for create,
  comment and close, so the stale branch is exercised without touching GitHub.
- The control log keeps 180 days of raw verdicts and archives older results as
  one summary per month. Verify compacts after every append, and `smoke:status`
  reports archived months beside the live days.
- A dedicated verify job checks the generated blocked-package audit against the
  published edition, opens or updates an issue when it drifts, and stays red
  until the note matches again. It is independent of the matrix, so a stale note
  cannot stop control runs.
- A third control fixture has no root export and only a `./widget` entry. It
  must pass all three steps with `target: "@solid-ground/control-subpath/widget"`,
  so a regression in the subpath probe discards the batch instead of quietly
  testing the wrong specifier.
- `smoke:publish` refuses a real publish until the control log holds fourteen
  clean days, enforcing the phase-0 gate in code. `--skip-audit` covers a
  maintainer bootstrap; CI never uses it.
- The blocked-package audit is generated from the dataset by
  `pnpm audit:blocked`, with `--check` for staleness. Verify runs the check
  against the published edition and marks the step red without stopping the
  control runs.
- The sandbox runner probes a package's first real subpath when its root is not
  exported, and records it in a new `target` field. `@kobalte/core@2.0.0-alpha.5`
  exports only directory-shaped subpaths, so the root probe failed on packaging;
  `@kobalte/core/accordion` imports, builds and typechecks against `2.0.4`.
- An environmental failure never withdraws a pass: `foldSmoke` ignores a fresh
  result whose `error` is set, because a registry 429 or install timeout says
  nothing about the package.
- `verify.yml` writes each batch's control verdicts and the fourteen-day audit
  trail to the run's step summary, so a failing control day is visible without
  downloading an artifact.
- `smoke:publish` folds a batch the report step trusted into the published
  edition: it updates the record's `smoke`, `smokeAt`, `verified` and
  `confidence`, the matching `index.json` rows and `meta.lastSuccessfulVerify`.
  It re-checks the controls and refuses a malformed result before writing
  anything, and `verify.yml` exposes it only behind a manual input, so a
  scheduled run still cannot change a record.
- The verify matrix keeps an append-only control log at `smoke/controls.jsonl`
  on the `data` branch. `smoke:report` writes the batch's control verdicts even
  when it discards the batch, a `history` job records them on every run, and
  `smoke:status` reports the clean-day streak against the two-week audit gate.
  The health page shows the same history, which outlives the seven-day CI
  artifact.
- Package records carry `smokeAt`, the instant the folded smoke pass finished,
  so a pass ages out of the policy window while Solid stands still instead of
  keeping `verified` alive indefinitely. Editions published before the field
  existed keep their verification until Solid moves.
- Sandboxed smoke matrix, first slice: `smoke-result.schema.json`, and a pure
  `@solid-ground/smoke` package that plans a batch of cells and folds results
  into records. Environmental failures stay `null` and never read as a verdict.
  The sandbox runner itself is not wired up yet.
- `/changes/` lists every event newest first with filters by transition and
  category, `/feed.xml` is an Atom feed of the same events, and
  `/api/v1/events.json` exposes them as JSON.
- Freshness watchdog: an hourly check of `meta.json` that opens, updates and
  closes a `pipeline-stale` issue, with a recovery runbook.
- An optional `FIXTURE_REFRESH_TOKEN` secret lets the `live API` job push and
  open the fixture refresh pull request when the repository cannot grant a
  workflow that permission; without the secret the step uses `github.token` as
  before.
- Scanner accuracy harness: 25 pinned packages compared against an independent
  detector, with hand adjudication of every disagreement and the result
  published in METHODOLOGY.

### Fixed

- The blocked-refresh issue comments only when the fixture state changes, not on
  every scheduled run; the body names the lag, so a fall from one batch behind
  to more than one still comments.
- The recorded-answer test derives the control streak and `lastRun` from the
  recorded days instead of pinning them, so the scheduled fixture refresh pull
  request can pass CI; the old pin made every refresh fail the suite.
- `/health/` pairs the fixture verdict with the commit's own `lastRun`: the
  refresh step rewrote the working-tree fixture before the record step read it,
  so a stale status carried the fresh timestamp.
- The deployed site is built from the `data` branch rather than the committed
  fixtures. If that branch cannot be read the deploy falls back to the fixtures
  with a warning instead of failing, and a successful collect dispatches a
  redeploy so new data appears without waiting for the next push to `main`.
- The scanner no longer loses every finding in a file the lexer rejects: shipped
  JSX with nested tags falls back to a conservative text read.
- CJS builds are scanned: `require("solid-js/web")` is reported as a removed
  subpath.
- Subpath exports, wildcard export patterns and a `main` without a leading `./`
  now resolve, so packages that publish only subpaths are no longer scanned as
  empty and called clean.
- Findings in `.d.ts` files are type-level, never runtime breaks.

### Planned

- Static scanner against the real Solid 2 export surface (`removed-subpath`,
  `missing-export`, `type-ownership`, `jsx-removed-syntax`).
- Hourly Solid sentinel and rules-drift review.
- Sandboxed import/build/types verification matrix and a `next` canary channel.

## [0.1.0] - 2026-11-25

### Added

- Repository foundations: MIT code licence, CC BY 4.0 data licence, governance,
  Code of Conduct, security policy, support guide, issue forms and PR template.
- Shared domain types, JSON Schemas and an Ajv validator for registry entries and
  published records.
- Pure status engine with seven statuses, six evidence levels, neutral
  human-readable reasons and golden-fixture tests.
- npm collector with provenance-ready normalisation, retained-version selection,
  repository URL canonicalisation and a dataset builder.
- 15 curated packages across 9 categories, plus versioned status, discovery and
  removed-API rules.
- `solid-ground check` CLI that reports the dependency set blocking a Solid 2
  upgrade and exits non-zero when blockers exist.
- Astro dashboard with status overview, filterable package table, package pages,
  methodology, health page and static `/api/v1` JSON.
- CI (typecheck, tests, schema validation, site build), CodeQL, dependency
  review, OpenSSF Scorecard, Dependabot and a GitHub Pages deploy workflow.
