# Contributing to Solid Ground

Thanks for helping. Solid Ground only works if it stays accurate, neutral and
easy to correct, and every contribution — a data correction, a docs fix, a new
rule — moves it forward.

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

- **Correct a status.** Use the [“Correct a package status”](https://github.com/JoeyHammoth/SolidGround/issues/new?template=correct-status.yml) form. If you maintain the package, say so — maintainers get priority on their own entry.
- **Add a package.** Use the [“Add a package”](https://github.com/JoeyHammoth/SolidGround/issues/new?template=add-package.yml) form or open a PR adding a file under `registry/packages/`.
- **Improve the rules.** Replacement hints live in `rules/removed-apis.yml`; scoring and staleness policy live in `rules/status-policy.yml`.
- **Fix the pipeline or the site.** Issues labelled [`good first issue`](https://github.com/JoeyHammoth/SolidGround/labels/good%20first%20issue) are scoped for newcomers.
- **Question the methodology.** Open a discussion or an issue with the `methodology` label. Changes to how statuses are decided need an RFC-style issue and maintainer approval.

## Evidence beats opinion

Every status is derived from published rules and public evidence. See
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md). When you disagree with a status,
link to a release, a CI run, a pull request or a published tarball — not a
screenshot.

## Development setup

Requirements: Node.js 20.19 or newer, and pnpm (Corepack is bundled with Node).

```bash
git clone https://github.com/JoeyHammoth/SolidGround.git
cd SolidGround
corepack enable
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm typecheck
```

Run the whole local check suite (what CI runs):

```bash
pnpm run ci
```

Useful commands:

| Command | What it does |
|---|---|
| `pnpm test` | Unit tests for the engine, collector and schema |
| `pnpm typecheck` | Strict TypeScript across every package |
| `pnpm validate registry fixtures` | Validate registry YAML and dataset JSON against the schemas |
| `pnpm dataset --out data` | Collect live npm evidence into `data/` |
| `pnpm site:dev` | Run the dashboard locally |
| `pnpm site:build` | Build the static site |
| `pnpm check:app package.json` | Run the dependency checker on a project |

The test suite is offline: recorded fixtures stand in for npm. The live
collector is only run deliberately, with a polite `User-Agent` and modest
concurrency.

## Workflow

1. **Open or comment on an issue first** for anything beyond a typo, so the approach can be agreed before code is written.
2. Fork the repository and branch from `main`: `git checkout -b fix/short-description`.
3. Keep changes focused. Add tests for engine or collector behaviour; update docs in the same PR.
4. Run `pnpm typecheck && pnpm test && pnpm validate registry fixtures` locally.
5. Open a PR using the template. Link the issue it closes.

Commits use [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `docs:`, `chore:`). We use the **Developer Certificate of
Origin** rather than a CLA: sign off your commits with `git commit -s`.

## Claiming an issue

Small tasks carry the [`good first issue`](https://github.com/JoeyHammoth/SolidGround/labels/good%20first%20issue)
label and are deliberately left unassigned so anyone can take one.

1. Comment on the issue saying you intend to work on it, and roughly when.
2. A maintainer assigns it to you, normally within two business days. Start
   reading the code once you have commented; do not wait for the assignment.
3. Open a pull request within seven days. If you need longer, say so in the
   issue and it stays yours.
4. With no pull request or update after seven days, we unassign the issue and
   return it to the pool, so the next person is not blocked.

Ask your questions in the issue before writing code — a five-minute answer is
cheaper than a rewrite. If you decide not to continue, say so and we will
release the issue.

## Changing the methodology

Statuses alter what maintainers and users see, so changes to
`rules/status-policy.yml`, `packages/engine/`, or the evidence levels require:

1. an issue describing the change and its effect on existing records;
2. a before/after run over the fixture set, pasted into the PR;
3. approval from a maintainer (see [`GOVERNANCE.md`](GOVERNANCE.md)).

## What to expect

We aim to acknowledge issues and PRs within **5 business days**. If we are slow,
a polite ping is welcome. Data corrections are prioritised over new features.

## AI-assisted contributions

AI-assisted work is welcome. The person opening the PR is responsible for its
correctness, its licence compatibility and for having reviewed every line. No
bulk, unreviewed automated PRs.

## Security

Do not report vulnerabilities in public issues. See [`SECURITY.md`](SECURITY.md).
