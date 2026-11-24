# ADR 0004: Publish data as commits on an orphan `data` branch

- **Status:** accepted
- **Date:** 2026-11-25

## Context

The dataset changes on a schedule. Committing it to `main` would bury code
changes under bot churn and force the site to rebuild for every data tick. A
database would add a server, credentials, backups and a query surface this
project does not need. GitHub's scheduled workflows are also disabled after 60
days without repository activity, so the design must not depend on silent
automation.

## Decision

- The dataset lives on an orphan `data` branch: `packages/*.json`, `index.json`,
  `meta.json`, `solid.json`, `freshness.json`, `events.ndjson`.
- Only the publish job writes, and only to `data`; it commits normalised JSON
  with machine-readable trailers (`Run-Id`, `Solid-Stable`, `Rules`, `Tool`).
- The site is a pure function of `main` plus `data`, so rollback is a revert.
- Freshness is explicit: every record carries `checkedAt`; stale `verified`
  results downgrade to `declared`; a site banner appears after 72 hours without
  a successful run.
- Mitigations for the 60-day rule: watchdog issue, runbook, normal project
  activity, and optionally an external dead-man's switch. A heartbeat test is
  tracked as an issue rather than assumed to work.

## Consequences

- Bot churn is isolated; `git log data` is a free audit trail.
- Anyone can clone the dataset without cloning history from `main`.
- Publishing needs a rebase-and-revalidate step so two runs cannot overwrite
  each other.
