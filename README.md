<p align="center">
  <img src="docs/assets/logo.svg" width="72" height="72" alt="Solid Ground logo">
</p>

<h1 align="center">Solid Ground</h1>

<p align="center">
  <strong>Know what's solid before you upgrade.</strong><br>
  An open, evidence-based readiness tracker for the <strong>SolidJS 2</strong> ecosystem.
</p>

<p align="center">
  <a href="https://github.com/JoeyHammoth/SolidGround/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/JoeyHammoth/SolidGround/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="Code licence: MIT" src="https://img.shields.io/badge/licence-MIT-2dd4bf"></a>
  <a href="LICENSE-DATA"><img alt="Data licence: CC BY 4.0" src="https://img.shields.io/badge/data-CC%20BY%204.0-4f46e5"></a>
  <a href="https://github.com/JoeyHammoth/SolidGround/labels/good%20first%20issue"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen"></a>
</p>

<p align="center">
  <img src="docs/assets/hero-blocks.png" width="260" alt="Abstract glass blocks forming a stable structure">
</p>

---

**Solid 2 changed the reactive graph, moved rendering to `@solidjs/web` and
removed many 1.x APIs.** Every library, plugin and tool needs its own Solid 2
release — and application teams cannot upgrade until their dependencies do.

Solid Ground answers one question with dates and evidence instead of vibes:

> *Which Solid packages work with Solid 2, on which version, and how do we know?*

**[Browse the tracker](https://joeyhammoth.github.io/SolidGround/)** ·
**[Read the methodology](docs/METHODOLOGY.md)** ·
**[Check your app](#check-your-app)** ·
**[Add a package](https://github.com/JoeyHammoth/SolidGround/issues/new?template=add-package.yml)**

## Why another compatibility list?

Peer ranges lie. A package can declare `solid-js: >=1.7`, accept Solid 2 by
accident, and still import `mergeProps` or `solid-js/web` at runtime. Existing
readiness tables are hand-built in downstream issues, undated, and duplicated.

| | Solid 1→2 codemods | Ad-hoc readiness tables | **Solid Ground** |
|---|---|---|---|
| Migrates **your source** | ✅ | — | — |
| Answers **your dependencies** | — | partly | ✅ |
| Structured, versioned data | — | — | ✅ |
| Shows evidence and timestamps | — | dated by hand | ✅ |
| Machine-readable API | — | — | ✅ |
| Badge for maintainers | — | — | ✅ |

It complements the official [migration guide](https://docs.solidjs.com/migration/from-solid-1)
and the existing codemods. It does not migrate code or rank quality.

## Statuses

| Status | Meaning |
|---|---|
| ✅ **Ready** | A stable release admits Solid 2 and the evidence policy is met. |
| 🧪 **Prerelease** | Only an alpha, beta, rc or `next` line supports Solid 2. |
| 🚧 **In progress** | No release yet, but upstream work is visible. |
| ⛔ **Blocked** | No support and no visible upstream work. |
| 🪦 **Unmaintained** | Deprecated, archived, or no release for 18 months. |
| ➖ **Framework-agnostic** | Does not depend on Solid APIs. |
| ❓ **Unknown** | Not enough evidence, with the reason stated. |

Every status shows its **evidence** (`D`eclared, `S`tatic, `B`uild, `T`ypes,
`A`ttested, `U`pstream CI), the exact Solid version tested and the last check
time. A stale `verified` result is downgraded to **declared**, not left green.

## How it works

```text
registry/ + rules/  ──►  collect (npm, GitHub)  ──►  scan (parse, never execute)
                                                     │
                     publish ◄── engine (pure) ◄───── verify (sandboxed)
                        │
                        ▼
             `data` branch ──► Astro site ──► GitHub Pages + JSON API + badges
```

- **Facts are separate from judgements.** Rules can change and every status is
  recomputed without re-fetching.
- **Code is parsed, never executed** during scanning. Smoke tests run in
  ephemeral jobs with no secrets and an egress allowlist.
- **Git is the audit trail.** Every published data change is a commit.
- **Failures reduce freshness, not truth.** A failed fetch keeps the last good
  record and marks it stale.

Read [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) for the exact decision logic,
and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the pipeline.

## Quick start

Requirements: Node.js **20.18+** and pnpm (Corepack ships with Node).

```bash
git clone https://github.com/JoeyHammoth/SolidGround.git
cd SolidGround
corepack enable
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
pnpm site:dev
```

The test suite is offline: recorded fixtures stand in for npm.

Build the static site and its JSON API:

```bash
pnpm site:build
```

Collect live evidence for the curated registry into `data/`:

```bash
pnpm dataset --out data
```

This sends polite, conditional requests to the npm registry. Nothing is
published; the dataset is written to disk for inspection.

## Check your app

```bash
pnpm check:app path/to/package.json
```

It lists direct dependencies that block a Solid 2 upgrade, the first version
that supports Solid 2, and an upgrade order. A non-zero exit code means
blockers exist, so it can gate CI. The report's **Probed** column names the
subpath the sandbox actually imported, matching the site: `root` means the
package root passed, and — means no sandboxed pass is published. A browser
version that never uploads your lockfile is on the roadmap.

> **Package name note.** The unscoped npm name `solid-ground` is already taken
> by an unrelated package, so `npx solid-ground` is **not** the install command.
> A scoped release (`@solid-ground/cli`) is planned; until then, run the CLI
> from a clone as shown above. Tracked in
> [issue #9](https://github.com/JoeyHammoth/SolidGround/issues/9).

## Smoke evidence

Sandboxed import, build and type results are folded into the dataset only after
the known-good, known-bad and subpath controls have answered correctly for
fourteen consecutive days. The site and the CLI report show the subpath the pass
actually exercised, so `verified` never implies more than was run.

Maintainers can read the audit trail with
`pnpm smoke:status --file data/smoke/controls.jsonl` and see how far the gate has
to go with `pnpm smoke:gate --file data/smoke/controls.jsonl`. Both accept
`--json`; the status report includes failures grouped by control id. The Verify workflow opens one reminder issue when the gate is met and
closes it after the first publish batch.

## JSON API

The site publishes static, versioned JSON. Nothing is generated per request:

| File | Contents |
|---|---|
| `/api/v1/index.json` | One compact row per tracked package |
| `/api/v1/packages/<name>.json` | Full record; scoped names use `__` |
| `/api/v1/meta.json` | Counts, Solid versions tested, rules version, freshness |
| `/api/v1/solid.json` | Solid dist-tags and surface hashes |
| `/api/v1/events.json` | Recent new-package, status, version and dataset events |
| `/api/v1/gate.json` | Publish-gate streak, required and remaining days, readiness |
| `/api/v1/validation.json` | Deploy-recorded schema validation: timestamp, targets, problems |

`gate.json` and `validation.json` are described by
[`gate.schema.json`](packages/schema/schemas/gate.schema.json) and
[`validation.schema.json`](packages/schema/schemas/validation.schema.json).

Data is licensed **CC BY 4.0**; code is **MIT**. Attribution example is in
[`LICENSE-DATA`](LICENSE-DATA).

## Contributing

Contributions of every size are welcome — especially **corrections with
evidence**.

- Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`GOVERNANCE.md`](GOVERNANCE.md).
- Pick a [`good first issue`](https://github.com/JoeyHammoth/SolidGround/labels/good%20first%20issue).
- Correct a status with the [correction form](https://github.com/JoeyHammoth/SolidGround/issues/new?template=correct-status.yml).
- Ask questions in [Discussions](https://github.com/JoeyHammoth/SolidGround/discussions).

<p align="center">
  <img src="docs/assets/community-blocks.png" width="180" alt="Building blocks assembling a house">
</p>

## Support and security

Questions: [Discussions](https://github.com/JoeyHammoth/SolidGround/discussions).
Bugs and data corrections: [Issues](https://github.com/JoeyHammoth/SolidGround/issues).
Security: **do not** open a public issue — see [`SECURITY.md`](SECURITY.md).

## Licence and disclaimer

- Code: [MIT](LICENSE).
- Data, registry and documentation: [CC BY 4.0](LICENSE-DATA).
- Code of Conduct: adapted from Contributor Covenant 3.0, CC BY-SA 4.0.

**Solid Ground is a community project and is not affiliated with or endorsed by
the SolidJS team.** "SolidJS" is used descriptively to distinguish the framework
from the unrelated Solid decentralised-web project. Solid's
[Media & Brand](https://www.solidjs.com/media) guidance is respected; no Solid
logo is used.

Illustrations are from [Icons8](https://icons8.com) and are used under their
free licence. Status emoji are plain Unicode so the data stays accessible.

## Acknowledgements

Thanks to the SolidJS maintainers for a clear migration guide, to the library
maintainers who document their Solid 2 work in public, and to everyone who
files a correction instead of a complaint.
