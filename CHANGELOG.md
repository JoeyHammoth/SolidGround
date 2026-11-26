# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Change events: `diffRecords` emits one event per new package, status change,
  Solid 2 version change or expired override, and collect appends them to
  `events.ndjson` on the `data` branch by diffing the edition already published
  there. Events older than twelve months are compacted into monthly summaries.
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
