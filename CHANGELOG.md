# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- A publish-gate reminder: `pnpm smoke:gate` reports the clean-day count, and
  `--notify` opens one issue when the fourteen-day gate is met, with the
  `publish=true` dispatch to run. The publish job closes it after committing,
  so the notification is neither missed nor left behind.
- `pnpm check` prints a `Probed` column beside each package, naming the subpath
  the sandbox imported so the CLI report matches the site.
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
- Scanner accuracy harness: 25 pinned packages compared against an independent
  detector, with hand adjudication of every disagreement and the result
  published in METHODOLOGY.

### Fixed

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
