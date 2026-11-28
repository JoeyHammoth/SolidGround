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
is served rather than a screenshot of it.

### The scheduled refresh

`main` requires a pull request, so the `live API` job proposes the refresh
instead of pushing it. When the deployed answer is newer than the recording, it
rebuilds the fixture from `data/smoke/controls.jsonl`, force-pushes the
`automation/api-fixture` branch and opens — or reuses — one pull request against
`main`. Every scheduled run rewrites that branch, so a single pull request
carries the newest answer; merge it whenever convenient.

A fixture one batch behind is the normal state between merges: the check prints
a `note` and the job keeps the pull request current without failing. Only a
fixture two or more batches behind, or one whose recorded day no longer matches
the deployed answer, prints a `warn`. `pnpm check:live --strict` fails on either,
which is how a maintainer asks whether the recording is current. The verdict is
recorded in `api-check.json`, and `/health/` shows it under **Deployed API**, so
a stale recording does not need an Actions log to be seen.

The automation needs two repository settings:

- **Settings → Actions → General → Workflow permissions → "Allow GitHub Actions
  to create and approve pull requests"** must be enabled, or the job needs the
  maintainer token described next. Without either, the workflow token cannot
  open the pull request: the job still pushes the branch, prints a warning and
  opens one `ci: …` issue, which closes on the next run that opens the pull
  request. Turning the setting on is the whole fix. The issue comments once per
  fixture state — one batch behind, or more than one — rather than once per run.
- **Or store a `FIXTURE_REFRESH_TOKEN` secret.** A fine-grained personal access
  token scoped to this repository with Contents, Pull requests and Issues write
  makes the refresh step push and open the pull request as its owner rather than
  as `github-actions`; the issue lifecycle for a blocked refresh uses the same
  token. Nothing is required when the setting above is on: delete the secret and
  the step falls back to the workflow token. Rotate it like any credential.
- **The `Protect main` ruleset** requires the `test` and `analyze` checks and
  enables _require extra approval for unattributed changes_, so a bot commit
  needs one human approval. A pull request created by a workflow token starts its
  checks in the approval-required state: open the pull request and use
  **Approve workflows to run**, then approve and merge as usual. The bot never
  merges.

### Bypassing the rule instead (not recommended)

The `Protect main` ruleset's bypass list holds only the repository admin role,
always. A direct push from the workflow needs a bypass actor, and the eligible
ones are roles, teams, GitHub Apps and Dependabot. The built-in `GITHUB_TOKEN`
is not among them, which is why the earlier attempt failed with `GH013`; the
workaround would be a GitHub App installed on the repository, its token added to
the bypass list, and the job pushing with
[`actions/create-github-app-token`](https://github.com/actions/create-github-app-token).
That grant is repository-wide — the app could push any file to `main`, not just
the fixture — so the pull request path is the narrower one.

## When a batch is discarded

`pnpm smoke:report` exits non-zero and writes the control log even when it does,
so the failed day is on record. The `history` job appends it to the `data`
branch and the deploy rebuilds `/health/` and `/api/v1/controls.json`. Read the
reasons with:

```bash
pnpm smoke:status --file data/smoke/controls.jsonl --last 1
```
