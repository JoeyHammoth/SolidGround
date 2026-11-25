# Collection runbook

`collect.yml` turns live npm evidence into the dataset on the `data` branch.

## What runs

| Job | Token | What it does |
|---|---|---|
| `collect` | `contents: read` | Reads `registry/` and `rules/`, fetches npm packuments, scans published tarballs (`--scan`), validates the result against the schemas, uploads it as an artifact. |
| `publish` | `contents: write` | Checks out `data`, replaces everything except `.sentinel/`, and commits the new dataset. |

Only `publish` can write, and only to `data`. `main` stays reviewable.

## When

- The sentinel (`sentinel.yml`) dispatches it when a Solid dist-tag, release or
  migration-docs hash changes.
- Daily at 03:17 UTC.
- Manually: `gh workflow run collect.yml`.

## What a run costs

Fifteen packages, no download-statistics endpoint when `--no-downloads` is used,
one tarball per package for the scan. A normal run is a few minutes.

## When it looks broken

- **`collect` fails on one package.** The collector throws on a failed packument
  fetch rather than silently dropping a record. Re-run; npm registry errors are
  usually transient.
- **`--scan` fails for a package.** The scanner logs `scan skipped` and leaves
  `clean: null`, which downgrades that package to declared evidence. It never
  invents a finding.
- **`publish` reports nothing to commit.** The dataset was identical; that is a
  success, not a failure.
- **The site still shows old data.** Pages builds from `fixtures/dataset` today.
  Pointing it at the `data` branch is a separate change; until then the data
  branch is the record, not the published site.
