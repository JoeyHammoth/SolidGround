# Roadmap

Milestones mirror the design document. The project board is the live view; this
file is the stable summary.

| Milestone | Scope | Exit criteria | Status |
|---|---|---|---|
| **M0 Foundations** | Governance, licences, CI, security settings, spikes | CI green, security features on, ADRs recorded | ✅ done |
| **M1 Collector + engine** | Registry schema, npm collector, provenance, pure engine, dataset | 15 curated packages with `D`/`S` verdicts, engine tests green | ✅ v0.1 |
| **M2 Site MVP** | Astro dashboard, package pages, methodology, API JSON, Pages deploy | Live site, working links, data-age banner, accessible | 🚧 in progress |
| **M3 Static scan + badges + sentinel** | Export-surface builder, tarball scanner, Shields endpoints, hourly sentinel | Scanner meets the hand-verified ground truth; sentinel triggers rerun | ⬜ next |
| **M4 Smoke verification + canary** | Sandboxed import/build/types matrix, `next` canary, stale downgrades | Isolation reviewed; `verified` flag live | ⬜ |
| **M5 Check my app + CLI** | Lockfile parsers, browser tool, `npx solid-ground check` | npm/pnpm/yarn lockfiles parse; blockers match the dataset | 🟡 CLI MVP |
| **M6 Community + push model** | Attestation flow, reusable Action, needs-help view | 3 maintainers have attested or corrected entries | ⬜ |
| **M7 Sustain** | Quarterly rules review, dependency hygiene, succession | Second maintainer onboarded; runbook exercised | ⬜ |

## Good next tasks

- Scanner: resolve `exports` conditions and compare imports with the Solid 2 surface.
- Sentinel workflow: compare Solid dist-tags and dispatch collection.
- Watcher: open “pipeline stale” issues from `meta.json` age.
- Accessibility: axe checks on the built site.

Issues labelled [`good first issue`](https://github.com/JoeyHammoth/SolidGround/labels/good%20first%20issue)
are scoped for newcomers.
