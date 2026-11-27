# Plan: sandboxed import/build/types matrix (issue #4)

- **Status:** phase 0 implemented — runner, controls, an append-only control
  log and a manual publish path; a scheduled run still cannot change a record
  until two weeks of clean control runs are on record
- **Owner:** maintainers ([#4](https://github.com/JoeyHammoth/SolidGround/issues/4))
- **Depends on:** [ADR 0005](../adr/0005-sandbox-trust-boundary.md), the static
  scanner (M3), `SmokeResults` in `@solid-ground/schema`
- **Milestone:** M4 — smoke verification

## Why

A declared `solid-js` range is evidence level `D`. Today the dataset can say
*"this package claims to accept Solid 2"*, and the scanner can say *"its shipped
code does not import APIs that Solid 2 removed"* (`S`). Neither proves the
package actually loads and builds against Solid 2. Until one does, `verified`
stays `false` for every record and the top of the status ladder is unused.

The matrix is the only stage that executes package code, so it is also the most
dangerous one. ADR 0005 sets the trust boundary; this document is the
implementation plan for staying inside it.

## Goal and non-goals

**Goal.** For a given `(package, version, solid version)` produce three booleans —
`import`, `build`, `types` — that are good enough to move a record from declared
evidence to build evidence, and to light up `verified`.

**Non-goals.**

- Reproducing a package's own test suite. If it needs its tests to pass, it is
  out of scope; the harness only proves the public entry point works.
- Judging behaviour. A package that imports and then renders nothing is still a
  pass; the matrix proves compatibility, not correctness.
- Replacing the scanner. The matrix is expensive and sampled; the scanner is
  cheap and exhaustive. The scanner decides *whether to bother*, the matrix
  decides *verified*.

## Package layout

```text
packages/smoke/
  src/index.ts        # pure: plan a batch, fold results into records
  src/plan.ts         # matrix selection + the per-cell spec
  src/controls.ts     # the two fixtures' expectations + the discard rule
  src/runner.ts       # child-process install/import/build in a throwaway dir,
                      # including which entry point (root or subpath) to probe
  src/report.ts       # results -> schema-validated JSON artifact
  src/publish.ts      # fold a trusted batch into the published edition
  src/status.ts       # the control log and the two-week audit streak
  src/cli.ts          # plan, report, publish and status, locally and in CI
  fixtures/control-good/  # must import, build and typecheck
  fixtures/control-bad/   # imports an API Solid 2 removed; must fail import
  fixtures/control-subpath/  # no root export; must pass through ./widget
  test/plan.test.ts   # selection and folding, no network
  test/report.test.ts # artifact round-trip
  test/runner.test.ts # spec parsing, entry choice, manifest and file layout
  test/controls.test.ts # expectations and the discard rule
  test/publish.test.ts  # folding, refusals and the control log
  test/status.test.ts   # day grouping and the audit streak
```

Everything except `runner.ts` is pure and unit-tested. `runner.ts` is the only
file that spawns processes, and it is deliberately dumb: it takes a JSON spec on
stdin, runs three steps, and prints one JSON object.

## The matrix

| Axis | Values | Notes |
|---|---|---|
| package | every `tracked: true` registry entry | 14 today, so the full matrix is affordable |
| version | the record's `recommendedVersion`, plus the newest stable | two cells in the common case |
| solid | `meta.solid.stable2`, and `meta.solid.next` when non-null | the canary channel |
| step | `import`, `build`, `types` | one job per package, not per step |

One job per package keeps the install cost down: the job installs once per axis
cell and runs all three steps in sequence. A failure in `import` still attempts
`build` and `types`, because a partial result is more useful than an early exit.

### What each step proves

1. **import** — `node --input-type=module -e "await import('<name>')"` in a
   project whose only `solid-js` is the version under test. For a package with no
   ESM entry, fall back to `createRequire` and record which entry was used.
2. **build** — a minimal Vite + `@solidjs/vite-plugin` app that imports the
   package and runs `vite build`. This is the step that catches the real world:
   JSX transforms, peer-range mismatches, subpath exports that only fail under
   bundling.
3. **types** — `tsc --noEmit` on a three-line `import` of the package's types,
   only when the record has `shipsTypes: true`. A package without types is
   `null`, never `false`.

## Sandbox rules

These are restatements of ADR 0005 as things the code must enforce:

- `permissions: contents: read`, no secrets in the job, `timeout-minutes: 15`.
- Matrix values reach the job through `env:`, never interpolated into `run:`.
- Fresh, lockfile-less install with `--ignore-scripts`.
- `overrides` / `pnpm.overrides` pins exactly one `solid-js` copy per cell; a
  second copy is a harness bug, not a package failure.
- StepSecurity Harden-Runner: start in `audit`, promote to `block` with only
  `registry.npmjs.org:443` and the GitHub hosts once two clean weeks are on
  record.
- One package per job, so a compromise sees one job token with read access and
  nothing else. The publish job never runs package code.
- Every child process gets `HOME`, `TMPDIR` and a temp working directory inside
  the job workspace, and nothing is written outside it.

## Result contract

`SmokeResults` already models the output:

```ts
{ import: boolean | null; build: boolean | null; types: boolean | null }
```

Three states, not two, and the third matters: `null` means *not attempted or
inconclusive*, `false` means *the package failed a step that ran*. The artifact
per cell is:

```json
{
  "schemaVersion": 1,
  "name": "@kobalte/core",
  "version": "0.13.14",
  "solid": "2.0.4",
  "channel": "stable",
  "smoke": { "import": true, "build": true, "types": null },
  "entry": "esm",
  "target": null,
  "durationMs": 41230,
  "error": null,
  "at": "2026-11-26T04:12:00Z"
}
```

`at` is the instant the cell finished, and it is required: freshness is measured
from it, never from the record's `checkedAt`. `target` names the specifier the
steps imported when it is not the package root, so a pass against
`@kobalte/core/accordion` can never be mistaken for a pass against
`@kobalte/core`.

`error` carries an environmental failure string — registry 429, install
timeout, runner OOM. An environmental failure emits `smoke: null` for the
affected steps and a `error` string; it never emits `false`.

The artifact is validated by a new `smoke-result.schema.json` before upload, on
the same principle as `events.ndjson`: bad output fails the run rather than
silently downgrading a record.

## Folding results into the dataset

`foldSmoke(record, results, policy, now)` lives in `packages/smoke` and is pure:

- Results older than `policy.staleness.smokeDays` are ignored, so a stale pass
  cannot keep `verified` alive.
- A cell only applies to the version it names; a pass on `2.0.0-rc.1` never
  changes a record whose `recommendedVersion` is `2.0.4`.
- `verified` becomes true when `status === "ready"`, the recommended version
  imported successfully against the current `stable2`, and nothing disagrees.
- When Solid moves past the release a record was tested against, the pass stops
  covering the version under test and `verified` is cleared. Ageing a pass out
  while Solid stands still uses `smokeAt` on the record, which is written
  whenever a pass is folded in and cleared when one is withdrawn. An edition
  published before the field existed carries no age, so only the moved-Solid
  rule applies to it.
- Evidence levels `B` and `T` are added from the same facts, so the record's
  `confidence` explains itself.

The publish job is the only write path. It is manual (`workflow_dispatch` with
`publish: true`) and re-checks the controls before it touches anything. It also
reads the control log and refuses to publish until there are fourteen clean
days on record, so the phase-0 gate is enforced by the code rather than by a
comment. `--skip-audit` exists for a maintainer bootstrap and for local
experiments; CI never passes it.

```bash
pnpm smoke:publish --data data --results smoke/results.ndjson --dry-run
```

It changes only records the batch names, updates `verified` and `confidence` on
the matching `index.json` rows, stamps `meta.lastSuccessfulVerify`, and appends
the batch's control results to `smoke/controls.jsonl` on the data branch. A
malformed result, a wrong control or a short audit trail aborts before the first
write.

A failed `build` with a passing `import` withholds `verified` but does not
downgrade `status` (decision 2 below): a bundler edge case is not evidence that
the package is broken.

## Controls

Three fixtures ship with the harness and run in **every** batch:

- **known-good:** a two-line Solid 2 component that must return
  `{ import: true, build: true, types: true }` through the package root.
- **known-bad:** the same component importing `batch` from `solid-js`, which
  Solid 2 removed, and calling it at module scope, which must return
  `import: false`.
- **subpath-only:** a package with no root export and one `./widget` entry. It
  must pass all three steps and the artifact must name
  `@solid-ground/control-subpath/widget` in `target`. If the subpath probe
  regresses, this control fails and every batch is discarded.

If either control returns the wrong verdict, the whole batch is discarded as an
infrastructure failure. This is the single most important guard: without it a
broken sandbox quietly marks packages as failing.

## CI wiring

```text
verify.yml  (workflow_dispatch, nightly 04:10 UTC)
  plan    contents: read   -> matrix JSON (packages x cells + all controls)
  smoke   contents: read   -> one job per cell, uploads one result artifact
  report  contents: read   -> merge + validate + controls -> smoke/ artifact
  history contents: write  -> append + compact the control log on data (always, on main)
  publish contents: write  -> manual only: fold a trusted batch into data, close the gate issue
  audit   issues: write    -> check the generated blocked-package note, announce a met gate
```

Both jobs write the audit trail to the run's step summary as well, so a passing
or failing control day is visible without downloading an artifact. A separate
`audit` job checks that the generated blocked-package note matches the edition
and opens (or updates) an issue when it does not, then fails itself. That keeps
a stale note visible without blocking the control runs the two-week gate depends
on. The issue lifecycle is `pnpm audit:issue --stale|--clean`, whose
create/comment/close branches are unit-tested against a fake `gh`. The same job
runs `pnpm smoke:gate --notify` against the control log: once fourteen clean
days are on record it opens one "the two-week control gate is met" issue with
the publish command, and later runs leave it alone. The publish job runs
`pnpm smoke:gate --close` after committing, so the reminder does not outlive
the first batch. A scheduled
run stops after `history`: it records the control verdicts — the failures too —
but cannot change a record. `publish` needs the manual input, so
promoting a batch is a deliberate act rather than a cron side effect. Both write
jobs share the `data-write` concurrency group with collect, so they cannot race
each other. `verify.yml` attaches `step-security/harden-runner` in `audit` mode
to the jobs that run package code; the publish and history jobs run none.

### Running it

```bash
# Plan three packages plus the controls from the published edition.
pnpm smoke:plan --data data \
  --packages "@solid-primitives/storage,@solidjs/meta,@kobalte/core" \
  --max-cells 3 --out smoke-plan.json

# One cell, reading a spec from stdin (this is what a matrix job does).
printf '%s' "$SPEC" | pnpm smoke:run

# Merge the artifacts, validate them and check the controls.
pnpm smoke:report --dir results --out smoke/results.ndjson

# Preview what a trusted batch would change, then publish it.
pnpm smoke:publish --data data --results smoke/results.ndjson --dry-run
pnpm smoke:publish --data data --results smoke/results.ndjson

# The audit trail and the generated blocked-package note.
pnpm smoke:status --file data/smoke/controls.jsonl
pnpm smoke:compact --file data/smoke/controls.jsonl  # archive months past the window
pnpm smoke:gate --file data/smoke/controls.jsonl    # gate state; --notify opens the reminder
pnpm audit:blocked --data data          # writes docs/research/2026-11-blocked-packages.md
pnpm audit:blocked --data data --check  # exits 1 when the committed note is stale
```

The control log keeps 180 days of raw verdicts and replaces older results with
one summary per month, so the file stays small and `smoke:status` still says how
much of each archived month was clean.

`smoke:publish` refuses a real publish until the log has fourteen clean days.
`--skip-audit` bypasses that check for a maintainer bootstrap only.

`smoke:report` exits non-zero and writes nothing when a cell is malformed or a
control answers wrongly: a batch without trustworthy controls must not be able
to change a record, so the failure has to be visible.

`plan` reads the `data` branch edition so it only re-tests what is missing or
stale: an unchanged package with a fresh pass is not re-run. A `--force` input
re-tests everything, for after a scanner or rules change.

## Known findings

- **`@kobalte/core@2.0.0-alpha.5` fails all three steps, and the verdict is
  correct.** The alpha publishes `main`, `module` and `types` but its `exports`
  map has only `"./*"`, so the root specifier resolves to nothing:
  `ERR_PACKAGE_PATH_NOT_EXPORTED` under Node, a Vite/Rolldown resolve error,
  and `TS2307` from `tsc`. `pnpm install` succeeds and `solid-js 2.0.4` is the
  only copy in the tree, so this is packaging and not a harness or peer-range
  fault. The stable `0.13.14` line does export `"."`, so this arrived with the
  alpha. Whether to probe a subpath for such packages is open decision 4.

## Rollout

| Phase | Scope | Exit test |
|---|---|---|
| 0 | harness + controls only, 3 hand-picked packages, Harden-Runner `audit` | the known-bad control fails every time, for two weeks |
| 1 | all 14 curated packages nightly | `verified` is true for at least the packages the scanner already calls clean |
| 2 | egress `block`, `next` canary cells, stale downgrades | a stale pass visibly drops `verified` on the site |
| 3 | candidate discovery packages, on demand | a candidate can reach `verified` without a maintainer touching a YAML file |

Phase 0 is deliberately narrow: the failure mode to fear is a harness that
*looks* right, so the controls run for two weeks before the matrix is allowed to
change a record.

## Cost

Fourteen packages × two cells × two Solid channels is 56 jobs at roughly three
minutes each, inside GitHub's free minutes for a public repository, but it is not
free forever. The plan caps a batch at 20 cells, rotates the rest across nights,
and drops `next` to weekly once the canary channel is stable.

## Failure modes to write down before phase 1

- **Install times out.** Record `null` plus the error; retry once; never `false`.
- **Package needs a peer we do not install** (a router needing history). A small
  allowlist of stub peers, kept in `plan.ts`, and a reason string in the record.
- **Types fail only under `skipLibCheck: false`.** Run with `skipLibCheck: true`;
  a package that ships broken third-party types is not our problem.
- **A package exports no root entry.** `@kobalte/core@2.0.0-alpha.5` sets
  `main`, `module` and `types` but its `exports` map contains only `"./*"`, so
  `import "@kobalte/core"` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` in Node,
  at Vite resolve time and as `TS2307` in `tsc` — install succeeds, and none of
  it is a `solid-js/web` incompatibility. The runner now falls back to the first
  real subpath: for Kobalte it expands the directory-shaped pattern onto
  `@kobalte/core/accordion`, which imports, builds and typechecks against
  `2.0.4`, and records that specifier in `target`. A file-shaped export pattern
  is not expanded, and such a package still gets the root probe.
- **Node version skew.** The matrix pins `.nvmrc`, like every other job.
- **A pass that later looks wrong.** Because the artifact is committed, the roll
  forward is `git revert` of the verify commit, and the record returns to
  declared evidence on the next deploy.

## Open decisions

1. Do we publish per-cell results publicly (`/api/v1/smoke/<name>.json`) or only
   the folded `smoke` object on the record? *Decided: folded-only, plus the
   control log — the per-cell artifacts stay in CI.*
2. Does a failed `build` with a passing `import` downgrade the status, or only
   withhold `verified`? *Decided: withhold only.* `foldSmoke` never changes
   `status`; a pass only adds `B`/`T` evidence and `verified`.
3. Who reviews the first month of control runs? Needs a named maintainer before
   phase 0 ends.
4. Should the import probe follow a package's first `exports` subpath when it
   declares no `"."` entry? *Decided: yes.* The runner prefers the root; when it
   is not exported it takes the first explicit subpath, or expands a
   directory-shaped `"./*"` pattern on disk, and records the choice in `target`.
   Only the directory form is expanded; a file-shaped pattern still gets the
   root probe.

## Task list

- [x] `smoke-result.schema.json` + validator wiring
- [x] `packages/smoke` plan/report/fold with unit tests, no network
- [x] `smokeAt` on the record, so a pass on an unchanged Solid release can age out
- [x] `runner.ts` with the three steps and the temp-dir discipline
- [x] control fixtures and the discard-on-bad-control rule
- [x] `verify.yml` in `audit` mode, three packages, no scheduled publish
- [x] `smoke:publish`: fold a clean batch into records, index and meta, refusing
  a malformed result or a wrong control
- [x] control log on the data branch, `smoke:status` and a health-page section,
  so the two-week audit is visible after the artifact expires
- [x] subpath-only control fixture, so a probe regression discards the batch
- [x] publish refuses without fourteen clean control days, and the blocked
  audit is generated from the dataset with a freshness check that owns an issue
- [x] control-log compaction, and the smoke evidence (including the probed
  `target`) rendered on each package page once a pass is published
- [ ] two weeks of clean control runs, then promote to nightly
