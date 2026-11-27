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

The scheduled `live API` job runs it and opens one issue while it fails
(`api: issue …`). The issue closes by itself on the next passing run.

## Refresh the recorded API fixture

`fixtures/live/controls.json` is a captured answer from the deployed
`/api/v1/controls.json`, kept so the offline suite validates the shape a
consumer actually receives. Every control batch moves the deployed `lastRun`, so
refresh the file after a batch lands and before opening a PR that touches the
control code:

```bash
curl -fsS https://joeyhammoth.github.io/SolidGround/api/v1/controls.json \
  > fixtures/live/controls.json
pnpm check:live --strict   # fails while the fixture is behind
```

A scheduled run that finds the fixture behind prints a warning with the same
command and puts it in the job summary; it does not open an issue, because the
fixture is refreshed by whoever next touches the control path.

## When a batch is discarded

`pnpm smoke:report` exits non-zero and writes the control log even when it does,
so the failed day is on record. The `history` job appends it to the `data`
branch and the deploy rebuilds `/health/` and `/api/v1/controls.json`. Read the
reasons with:

```bash
pnpm smoke:status --file data/smoke/controls.jsonl --last 1
```
