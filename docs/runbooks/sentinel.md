# Sentinel runbook

The sentinel watches Solid releases hourly and asks the pipeline to re-collect
only when something actually moved.

## What it checks

Every run, `.github/workflows/sentinel.yml` compares three things against the
stored observation:

| Signal | Source | Stored as |
|---|---|---|
| Dist-tags of every package in `rules/solid-packages.yml` | npm registry | `distTags["<package>@<tag>"]` |
| Latest `solidjs/solid` GitHub release | GitHub releases API | `release` |
| Migration guide text | `migrationSource` (page source in `solidjs/solid-docs`), falling back to `migration` | `docsHash` (SHA-256 of normalised text) |

Comparison is always against the stored `solid.json`, never "since the last
run", so a skipped, cancelled or failed run cannot lose a change.

## Where state lives

`.sentinel/state.json` is committed to the **`data` branch**, not `main`; the
branch root belongs to the collected dataset, so the sentinel keeps its own
bookkeeping in a directory of its own. The `watch` job
is read-only (`contents: read`, `actions: write`); only the `record` job, which
runs after a change, can write, and it writes to that branch alone. This keeps
`main` reviewable and lets the workflow run under branch protection.

## What a change does

1. The run prints each difference in the job summary and fails nothing.
2. It dispatches `collect.yml` and `verify.yml` — if they exist. Until #2 and #4
   land, the run logs a notice and skips them.
3. The `record` job commits the new observation to `data`.

## When it looks broken

- **Dispatches every hour.** The `record` job is failing, or `data` is missing.
  Check the record job log and the branch list. No state means "everything is
  new", which is the safe default.
- **Never dispatches.** Confirm the schedule is enabled (GitHub disables cron
  workflows after 60 days of repository inactivity — see #11) and that
  `rules/solid-packages.yml` still lists the packages you expect.
- **Release or docs lookups warn.** The run keeps the previous value rather than
  reporting a false change. Release lookups are authenticated with
  `GITHUB_TOKEN`; a 403 there means the token was not passed to the step.
  The docs signal reads `docs.migrationSource`, the page source on the
  `v2-rebuild` branch of `solidjs/solid-docs`, because the rendered page sits
  behind a WAF that refuses CI egress. If that branch or path moves, update
  `rules/solid-packages.yml`; the rendered `migration` URL stays as the link
  readers follow.
- **`data` branch is missing.** Recreate it from `main`; the next changed run
  seeds it. Until then every run dispatches, which is noisy but harmless.

## Manual run

```bash
gh workflow run sentinel.yml
gh run list --workflow sentinel.yml --limit 5
```
