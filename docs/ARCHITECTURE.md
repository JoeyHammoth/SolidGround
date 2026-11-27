# Architecture

Solid Ground is a static site plus an open dataset. There is no server, no
database and no secret beyond `GITHUB_TOKEN`. The full design rationale lives in
[`docs/design/solid-ground-design.md`](design/solid-ground-design.md); this page
is the implementation map.

## Pipeline

```text
registry/*.yml   rules/*.yml
      │                │
      ▼                ▼
   ┌──────────────────────┐
   │ collect (npm facts)  │  conditional GETs, provenance, fingerprints
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ scan (parse tarballs)│  never executes package code
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ verify (sandboxed)   │  no secrets, read-only token, egress allowlist
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ engine (pure)        │  status + confidence + reasons
   └──────────┬───────────┘
              ▼
   schema-validated JSON ──► `data` branch (audit trail)
              │
              ▼
   Astro build ──► GitHub Pages: site, /api/v1, /badges, feed
              ▲
        CLI / check-my-app
```

Stages communicate only through schema-validated JSON. The only job allowed to
write is the publish job, and only to the `data` branch. Jobs that touch package
contents never hold a write token.

## Repository layout

| Path | Contents |
|---|---|
| `registry/packages/*.yml` | Human-curated scope, category, family, aliases, attestations |
| `registry/categories.yml` | Public taxonomy |
| `rules/status-policy.yml` | Versioned decision thresholds and staleness windows |
| `rules/removed-apis.yml` | Curated replacement hints (detection is dynamic) |
| `rules/discovery.yml` | npm search queries and noise filters |
| `rules/solid-packages.yml` | Solid core packages watched by the sentinel |
| `packages/schema/` | Shared types, JSON Schemas, Ajv validator |
| `packages/engine/` | Pure status engine and golden-fixture tests |
| `packages/collector/` | npm clients, normalisation, dataset builder |
| `packages/scanner/` | Static import analysis (planned, M3) |
| `packages/smoke/` | Batch planning and result folding for the sandbox (runner planned, M4) |
| `packages/cli/` | `solid-ground check` dependency checker |
| `site/` | Astro static site and generated API routes |
| `fixtures/` | Recorded evidence and the golden dataset used by tests and CI |
| `docs/` | Methodology, architecture, ADRs, research notes |

## Data flow

| Layer | Written by | Read by |
|---|---|---|
| Facts | collector | engine, site |
| Scan findings | scanner | engine, package page |
| Smoke results | verify matrix | engine, package page |
| `packages/*.json` | engine | site, API, CLI |
| `index.json` | engine | table, search, CLI |
| `meta.json` | engine | banner, health page, third parties |
| `solid.json` | sentinel/collector | engine, site |
| `events.ndjson` | engine, appended by collect | changes feed, Atom feed |

Events are derived by diffing an edition against the one already published on
the `data` branch, so history is never re-derived from scratch. Package events
(`new`, `status`, `version`, an expired `attestation`) come from `diffRecords`;
dataset events (`solid`, `rules`, `anomaly`) come from diffing `meta.json`. Every
line is validated against `change-event.schema.json`, and events older than
twelve months are compacted into one `summary` per calendar month.

The dataset is normalised (sorted keys, stable formatting), so a git diff shows
exactly which facts changed.

## Public outputs

```text
/api/v1/index.json
/api/v1/packages/<name>.json     # scoped names use "__"
/api/v1/meta.json
/api/v1/solid.json
/api/v1/events.json
/badges/<name>.json              # Shields endpoint format
/feed.xml
/llms.txt
```

## Current slice (v0.1)

Implemented now: schema + validator, engine + golden tests, npm collector and
dataset builder, CLI checker, Astro dashboard, CI, Pages deploy, and the change
events pipeline behind `/changes/`, `/feed.xml` and `/api/v1/events.json`.

Next: static scanner against the real Solid 2 export surface (M3), sandboxed
smoke matrix (M4), rules-drift review. See the [roadmap](ROADMAP.md) and the
issues on the project board.
