# Verify runbook

The `Verify` workflow runs the sandboxed import/build/types matrix, records the
control verdicts and — only on a manual dispatch with `publish: true` — folds a
batch into the `data` branch. Schedule: nightly at 04:10 UTC, after `collect`.

## Before publishing

The gate is fourteen consecutive clean control days. Read it with:

```bash
pnpm smoke:status --file data/smoke/controls.jsonl
pnpm smoke:gate --file data/smoke/controls.jsonl --json
```

`--skip-audit` exists for a maintainer bootstrap and is never passed by CI.

## Check the deployed API

`pnpm check:live` fetches every published JSON endpoint and validates the body
against its schema, including the `$schema` each response names. It needs
network access, so it is not part of `pnpm test`.

The scheduled `live API` job runs it, opens one issue while it fails
(`api: issue …`), and closes it on the next passing run. It also writes
`api-check.json` to the `data` branch and redeploys, which is what the
"Deployed API" line on `/health/` reads; a failing check is recorded there too,
so the page never hides a bad result behind the issue.

## Refresh the recorded API fixture

`fixtures/live/controls.json` is a captured answer from the deployed
`/api/v1/controls.json`, kept so the offline suite validates the shape a
consumer actually receives. Regenerate it from the control log, which is what
the deploy builds the endpoint from:

```bash
git fetch origin data
git show origin/data:smoke/controls.jsonl > /tmp/controls.jsonl
pnpm smoke:fixture --file /tmp/controls.jsonl
pnpm check:live --strict   # fails while the fixture is behind
```

`smoke:fixture` shares its builder with the endpoint, so the file matches what
is served rather than a screenshot of it. The `history` job cannot do this for
you: `main` requires a pull request and two green checks, so a workflow token
push is rejected (`GH013`). The refresh is therefore a normal PR, and
`check:live --strict` is what says it is due.

A scheduled run that finds the fixture behind prints a warning with the same
command instead of failing, because a fixture refresh is not an API problem. If
the warning persists, the `history` job's refresh step is the thing to look at.

## When a batch is discarded

`pnpm smoke:report` exits non-zero and writes the control log even when it does,
so the failed day is on record. The `history` job appends it to the `data`
branch and the deploy rebuilds `/health/` and `/api/v1/controls.json`. Read the
reasons with:

```bash
pnpm smoke:status --file data/smoke/controls.jsonl --last 1
```
