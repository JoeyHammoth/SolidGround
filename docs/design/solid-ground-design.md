# Solid Ground — SolidJS 2.0 ecosystem readiness tracker

**Design & Implementation Plan**

| | |
|---|---|
| **Name** | **Solid Ground**, tagline "Know what's solid before you upgrade." Repo: `solid-ground`. See [1.1](#11-name-and-branding) |
| **Status** | Proposal v0.1 |
| **Written** | 2026-11-24 |
| **Research basis** | Public sources available on 2026-11-24 (listed in [References](#22-references)) |
| **Hosting target** | GitHub Pages (free), static site plus static JSON dataset |
| **License target** | MIT (code), CC BY 4.0 (data and docs) |

**Legend.** ✅ = verified against a public source. ⚠ = assumption that must be validated in the M0 spike before relying on it.

---

## Table of contents

1. [Summary](#1-summary)
2. [What already exists, and the gaps](#2-what-already-exists-and-the-gaps)
3. [Goals, non-goals, principles](#3-goals-non-goals-principles)
4. [Users and use cases](#4-users-and-use-cases)
5. [Form factor](#5-form-factor)
6. [Architecture](#6-architecture)
7. [Status model and decision logic](#7-status-model-and-decision-logic)
8. [Data collection](#8-data-collection)
9. [Verification mechanisms](#9-verification-mechanisms)
10. [Automation and pipeline operations](#10-automation-and-pipeline-operations)
11. [Data model and public API](#11-data-model-and-public-api)
12. [Information shown in the tracker](#12-information-shown-in-the-tracker)
13. [Frontend](#13-frontend)
14. [Hosting and deployment](#14-hosting-and-deployment)
15. [Keeping it fresh](#15-keeping-it-fresh)
16. [Open source governance and community files](#16-open-source-governance-and-community-files)
17. [Repository security and CI/CD](#17-repository-security-and-cicd)
18. [Quality strategy](#18-quality-strategy)
19. [Roadmap and milestones](#19-roadmap-and-milestones)
20. [Risks and mitigations](#20-risks-and-mitigations)
21. [Open decisions](#21-open-decisions)
22. [References](#22-references)
23. [Appendices](#23-appendices)

---

## 1. Summary

Solid 2.0 reached stable on 2026-11-16 after a beta (March), an API-frozen release candidate (August) and 23 further release candidates. It is a breaking release: async moved into the reactive graph, web rendering moved to `@solidjs/web`, stores moved into `solid-js`, and many 1.x APIs were removed. Because the release is breaking, **every library, plugin and tool that depends on `solid-js` needs its own Solid 2 release**, and application teams cannot upgrade until their dependencies do.

Today there is no central, structured, time-stamped answer to the question *"Which Solid libraries work with Solid 2, on which version, and how do we know?"* Information is spread across the Solid homepage, a release announcement, per-repo milestones, Discord, and hand-built tables that downstream projects write in their own issues (see [section 2](#2-what-already-exists-and-the-gaps)).

**Proposal.** Build a fully open-source tracker with these parts:

1. A **static dashboard** (GitHub Pages) showing the Solid 2 readiness of ecosystem packages.
2. An **open, versioned dataset** (JSON) that the dashboard, badges, a CLI and AI tools all consume.
3. An **evidence-based status engine** that combines npm metadata, static analysis of published code against the actual Solid 2 export surface, sandboxed build/import tests, upstream repository signals, and maintainer attestations. Peer ranges alone are not trusted.
4. **Embeddable badges** and a **"check my app" tool** that reads a `package.json` or lockfile and lists which dependencies block a Solid 2 upgrade.
5. An **automated freshness pipeline** (GitHub Actions) driven by schedules and by Solid releases themselves, with staleness made visible rather than hidden.

Everything runs on free infrastructure: GitHub public-repo features and GitHub Pages. There is no server and no database.

### 1.1 Name and branding

**Name: Solid Ground.** **Tagline: "Know what's solid before you upgrade."** Descriptive subtitle for the README, repository description and page titles: *SolidJS 2.0 ecosystem readiness tracker*.

Why this name:

- It is a pun on the framework's name that states the product's promise: which libraries are firm enough to build on.
- It is short, easy to say and easy to remember. It supports friendly copy ("Is your ground solid yet?", "48 of the top 100 libraries are on solid ground") while the statuses themselves stay neutral and factual.

| Item | Proposed value |
|---|---|
| Repository | `solid-ground` |
| CLI | `npx solid-ground check` |
| Badge | label `Solid 2`, message = status (alt text: "Solid Ground: Solid 2 readiness") |
| Site URL | `<owner>.github.io/solid-ground` to start; custom domain optional |
| npm names | `solid-ground` (CLI) or scoped `@solid-ground/cli`; availability to be confirmed in M0 |

**Alternatives** if the name turns out to be taken: **Solid Radar** (emphasises monitoring), **Solid Atlas** (a map of the ecosystem), **Is It Solid Yet?** (playful, in the spirit of "are we X yet" trackers), **Firm Footing**.

**Name checks (M0, about 30 minutes).** My searches found no existing SolidJS project called "Solid Ground", but that search is not exhaustive, and "solid ground" is a common phrase that will not rank on its own. Always pair it with "SolidJS" in the repository description, page titles, topics and README subtitle. Before committing, check npm (`solid-ground`, `@solid-ground`), GitHub organisation and repository names, the domain, social handles, and run a trademark search in your jurisdiction. "Solid" is also the name of an unrelated decentralized-web project, so descriptive text must say "SolidJS".

**Voice.** Playful at the edges (name, tagline, empty states, the overview headline) and neutral in statuses and reasons. Never use shaming metaphors for a package's state. The project is not official: keep the disclaimer in the footer and README, and read Solid's Media & Brand page before using any Solid logo.

---

## 2. What already exists, and the gaps

Findings from research on 2026-11-24. No dedicated compatibility tracker was found, but I could not search Discord or read every page (see [limits of this research](#24-limits-of-this-research)).

### 2.1 Existing artifacts

| # | Existing thing | What it gives you | What it does not give you |
|---|---|---|---|
| E1 | Solid homepage "Libraries and tools" list ✅ | Curated official/community links; says to check each project's README for its Solid 2.0 status | No status values, versions, evidence or timestamps |
| E2 | RC announcement (2026-08-13) and the Solid X post ✅ | Names libraries ready at the time (Router, Meta, vite-plugin, Solid Primitives, Kobalte, TanStack, Storybook, Testing Library, AG Grid); invites unready maintainers to Discord `#next` | One-off snapshot, prose only, now partly out of date |
| E3 | `solid-primitives` "Solid 2.0 Migration" milestone and `next` branch ✅ | Granular, per-package migration PRs for that monorepo | Covers only its own packages |
| E4 | Hand-built readiness tables in downstream issues ✅ (omniglass #2290, mmtypst #5, beghu #43) | Real npm dist-tag/peer-range checks dated 2026-11-20 for 5–8 libraries each; proof of demand | Duplicated manual effort; stale on creation; not reusable |
| E5 | Library-side questions ✅ (urql discussion) | Shows maintainers and users asking "is this tracked anywhere?" | The answer was that no tracking could be found |
| E6 | Solid 1→2 codemods and migration assistant ✅ (`devagrawal09/solid-codemod`, `solidjs-community/solid-codemod`, `solid-migration-assistant`) | Help migrate **your own source code** | Nothing about your **dependencies** |
| E7 | `eslint-plugin-solid` v2 configs ✅ | Lints for removed APIs and 2.0 pitfalls in your code | Same: your code only |
| E8 | Official migration docs and AI-oriented docs ✅ (`docs.solidjs.com/migration/from-solid-1`, `guides/ai-tools`, in-package skill/cheatsheet) | Authoritative API changes; a source of truth for this tracker's rules | Not an ecosystem view |
| E9 | React→Solid converters ✅ (`react2solid`, `solid-reactor`, SUID codemod) | Adoption on-ramps from React | Predate 2.0 semantics (for example single-function `createEffect` changed) |
| E10 | `awesome-solid-js` ✅ | Discovery of resources | Snapshot I saw was last pushed March 2024; no 2.0 data |
| E11 | npm `dist-tags` and `peerDependencies` ✅ | Raw signals | Uninterpreted, and can mislead (see G4) |

### 2.2 Gaps this project fills

| ID | Gap | Evidence | How the tracker addresses it |
|---|---|---|---|
| G1 | No single structured view of 2.0 readiness across the ecosystem | E1, E2, E4, E5 | Dashboard plus dataset |
| G2 | No timestamps or freshness guarantees | E2 is a snapshot; E4 tables are dated by hand | Every record has `checkedAt`, tested versions, and visible staleness |
| G3 | No dependency-level answer to "Can I upgrade my app?" | E6/E7 only cover your own code | "Check my app" web tool and CLI |
| G4 | Peer ranges mislead | TanStack devtools deliberately capped `solid-js` to `^1` because an open range would wrongly accept 2.0 ✅; the beghu issue found `@tanstack/solid-virtual` imports removed APIs ✅ | Static analysis of published code against the real Solid 2 exports |
| G5 | No early warning when Solid itself changes | Solid shipped 23 RCs in 14 weeks ✅ | Canary runs against `solid-js@next`; Solid-release sentinel |
| G6 | No feedback loop to maintainers | Maintainers told to "come find us" on Discord (E2) | Status badges, attestations, a reusable CI action |
| G7 | No machine-readable data for assistants and tooling | Solid already ships assistant docs (E8) but no ecosystem data | JSON API, `llms.txt` |
| G8 | No place to see where contributors can help | Blocked/in-progress libraries are scattered | "Needs help" view linking blockers and upstream issues |
| G9 | Naming confusion that hurts users | SolidStart v2 targets Solid **1** ✅; Kobalte skipped 1.0.0 ✅; `vite-plugin-solid` became `@solidjs/vite-plugin` ✅ | Per-package "version line" table: which release works with which Solid |

### 2.3 Snapshot of current state, used later as test fixtures

As reported in public issues on 2026-11-20 (not independently verified by me, because shell network access was unavailable). They make good golden fixtures for the status engine:

| Package | Stable (`latest`) | Stable peer range | Solid 2 line |
|---|---|---|---|
| `solid-js` | 2.0.3 | n/a | stable |
| `@solidjs/router` | 2.0.1 | `solid-js ^2`, `@solidjs/web ^2` | stable |
| `@kobalte/core` | 0.13.14 | `solid-js ^1.9.8` | `2.0.0-alpha.5` only |
| `@tanstack/solid-query` | 5.108.2 | `solid-js ^1.6` | `6.0.0-rc.6` only |
| `vite-plugin-solid` | 2.11.17 | `solid-js ^1.7.2` | `3.0.0-next.27` (the line is now `@solidjs/vite-plugin`) |
| `@solidjs/testing-library` | 0.8.10 | Solid 1 | `1.0.0-rc.2` |
| `@astrojs/solid-js` | 7.1.6 | `solid-js ^1.9.13` | none found |
| `@tanstack/solid-virtual` | 3.13.46 | `solid-js ^1.3.0` | none found; imports `mergeProps`, `onMount`, `createComputed`, `solid-js/store` |

### 2.4 Limits of this research

- I could not read `solidjs.com/ecosystem` or search Discord (`#next`), where tracking may exist.
- Search engines index npm and GitHub topic pages poorly. **Before building, spend 30 minutes** on: `npm search` for a `solid-2` keyword, GitHub topic search, and asking in Discord `#next`.

---

## 3. Goals, non-goals, principles

### Goals

- G-1. Give an accurate, dated answer to "is package X usable with Solid 2, and which version?"
- G-2. Prefer **evidence over declarations**; show the evidence.
- G-3. Stay fresh automatically; make staleness obvious when automation fails.
- G-4. Be useful to app developers, library maintainers, the Solid team, and AI tools.
- G-5. Cost nothing to run and little to maintain.
- G-6. Be fully open: code, data, methodology and governance.

### Non-goals

- Not an official Solid project. Not a package registry, a quality ranking, or a general popularity list.
- Not a code migration tool. It links to existing codemods and the official migration guide.
- Not a security scanner for packages (beyond protecting the tracker itself).
- Not a place for opinion about libraries. Statuses are derived from published rules.

### Principles

1. **Neutral and rule-based.** Anyone can read the methodology and reproduce a status.
2. **Say "unverified", not "broken".** Wording matters to volunteer maintainers.
3. **Right of reply.** Maintainers can correct their own entry (with evidence) quickly.
4. **Untrusted input everywhere.** Package contents, metadata and attestations are untrusted.
5. **Static first.** No servers, no databases, no secrets beyond `GITHUB_TOKEN`.
6. **Git is the audit trail.** Every data change is a commit.

---

## 4. Users and use cases

| Persona | Question | Feature |
|---|---|---|
| App developer planning an upgrade | "Which of my dependencies block Solid 2?" | Check-my-app (web + CLI), package pages, "how to fix" links |
| Library maintainer | "What do users see about my package? How do I show it's ready?" | Package page, evidence, badge, attestation file, correction form |
| Prospective contributor | "Where can I help?" | Filter by `blocked`/`in-progress`, link to upstream issue, "needs help" label |
| Solid core/community team | "Where is the ecosystem stuck? What did a Solid release break?" | Overview stats, canary results, events feed |
| AI assistant / tool author | "Is this library safe to suggest for Solid 2?" | `/api/v1/*.json`, `llms.txt` |
| Evaluator choosing a framework | "Is the ecosystem ready?" | Overview percentages by category |

---

## 5. Form factor

### 5.1 Options considered

| Form | Pros | Cons | Verdict |
|---|---|---|---|
| **Static dashboard site** | Free on GitHub Pages; SEO per package; simple | Needs rebuilds to refresh | **Core (v1)** |
| **Open dataset (static JSON)** | Powers everything; machine-readable; forkable | Needs schema discipline | **Core (v1)** |
| **Shields.io endpoint badges** | Maintainers embed in READMEs; free marketing | Needs stable per-package URLs | **v1.1** |
| **"Check my app"** (browser, client-side only) and **CLI** | Immediate value for app teams; differentiates from codemods | Needs lockfile parsing | **v2** |
| **Reusable GitHub Action for maintainers (push model)** | High-quality evidence from the library's own CI | Adoption friction | **v2** |
| GitHub App/bot that comments on other repos | Proactive | Spammy, needs trust and permissions | **Rejected** |
| Wiki/README table | Trivial | Stale and unscalable | **Rejected** (this is the status quo) |
| Dynamic server app with a database | Real-time | Cost, ops, security surface | **Rejected for v1** |
| Editor extension | Convenient | Extra maintenance | Later, if ever |

### 5.2 Recommended product

1. Static site: overview, filterable table, package pages, methodology, changelog/feed.
2. Public dataset: `index.json`, per-package JSON, `meta.json`, `events.json`.
3. Badges: `badges/<pkg>.json` in the Shields endpoint format.
4. Check-my-app: runs entirely in the browser (paste `package.json` or a lockfile; nothing uploaded) and as `npx solid-ground check`.
5. Maintainer tooling: attestation file schema and, later, a reusable Action.

Complementary to existing tools, not competing: the Solid migration assistant scans **your source**; this tracker scans **your dependencies**.

---

## 6. Architecture

### 6.1 Component diagram

```text
                      ┌───────────────────────────────┐
                      │ Inputs                        │
                      │  registry/*.yml  (curated)    │
                      │  rules/*.yml     (policy)     │
                      └──────────────┬────────────────┘
                                     │
   Sentinel (hourly) ──triggers──►   ▼
   solid-js / @solidjs/* tags   ┌───────────┐   npm registry, downloads API
   docs migration page ETag     │ Collector │◄── GitHub GraphQL/REST (repos, PRs, issues)
                                └─────┬─────┘   deps.dev (optional enrichment)
                                      │ packuments, dist-tags, peers, upstream signals
                                      ▼
                                ┌───────────┐   tarballs (never executed)
                                │  Scanner  │◄── AST import analysis vs real Solid 2 exports
                                └─────┬─────┘
                                      │ findings (JSON artifact)
                                      ▼
                                ┌───────────┐   isolated matrix jobs, no secrets, egress allowlist
                                │ Verifier  │◄── install --ignore-scripts → build/import/types smoke
                                └─────┬─────┘
                                      │ results (JSON artifact only)
                                      ▼
                                ┌───────────┐   pure functions, fully unit-tested
                                │  Engine   │── status + confidence + reasons + events
                                └─────┬─────┘
                                      │ schema-validated JSON
                                      ▼
                         ┌──────────────────────┐
                         │ `data` branch (git)  │  audit trail of every change
                         └──────────┬───────────┘
                                    ▼
                         ┌──────────────────────┐
                         │ Site build (Astro)   │──► GitHub Pages: site, /api/v1, /badges, feed
                         └──────────────────────┘
                                    ▲
                         CLI / check-my-app consume the published JSON
```

### 6.2 Principles for the pipeline

- **Pipeline stages communicate only through schema-validated JSON.** No stage trusts another stage's output blindly. The privileged "commit data" stage never touches package code.
- **Privilege separation.** Stages that handle untrusted package contents run with read-only tokens and no secrets. Only the final commit job can write, and only to the `data` branch.
- **Idempotent and incremental.** Results are cached by `(package@version, solidVersion, rulesVersion, toolVersion)` and recomputed only when one of those changes.
- **Deterministic.** The same inputs produce the same status (important for reviewability and for `events.json` diffs).

### 6.3 Repository layout

```text
solid-ground/
├─ .github/
│  ├─ workflows/            # ci, codeql, dependency-review, scorecard, workflow-lint,
│  │                        # collect, verify, canary, discovery, rules-drift, sentinel,
│  │                        # deploy, watchdog
│  ├─ ISSUE_TEMPLATE/       # add-package.yml, correct-status.yml, bug.yml, config.yml
│  ├─ dependabot.yml
│  ├─ CODEOWNERS
│  └─ PULL_REQUEST_TEMPLATE.md
├─ registry/
│  ├─ packages/             # one YAML per tracked package (human-curated metadata)
│  └─ categories.yml
├─ rules/
│  ├─ status-policy.yml     # thresholds, staleness windows, versioned
│  ├─ removed-apis.yml      # human-curated replacement hints (detection itself is dynamic)
│  ├─ discovery.yml         # npm search queries, noise filters, scope threshold
│  └─ solid-packages.yml    # Solid core packages watched by the sentinel
├─ packages/
│  ├─ schema/               # JSON Schemas + generated TS types
│  ├─ engine/               # status engine (pure)
│  ├─ collector/            # npm / GitHub / deps.dev clients with caching and backoff
│  ├─ scanner/              # static analysis of tarballs
│  ├─ smoke/                # sandbox harness
│  └─ cli/                  # `solid-ground check`
├─ site/                    # Astro static site
├─ docs/                    # METHODOLOGY.md, ARCHITECTURE.md, ADRs/
├─ CODE_OF_CONDUCT.md  CONTRIBUTING.md  SECURITY.md  GOVERNANCE.md
├─ SUPPORT.md  MAINTAINERS.md  LICENSE  LICENSE-DATA
└─ README.md
```

Data lives on an orphan `data` branch (`packages/*.json`, `meta.json`, `solid.json`, `events.ndjson`, `freshness.json`, `fingerprints.json`, `discovery/candidates.json`, `runs/latest.json`; see [8.8](#88-data-lifecycle-and-retention)). This keeps bot churn out of `main`, gives a free audit trail, and lets anyone clone the dataset.

### 6.4 Technology choices

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript on current Node LTS | Matches the ecosystem; share types with the CLI and site |
| Package manager | pnpm with committed lockfile | Common in the Solid ecosystem; recent pnpm versions do not run dependency lifecycle scripts by default ⚠ confirm the version you pin |
| Semver | `semver` library with `includePrerelease` | Prerelease handling is central to this problem |
| Static analysis | `es-module-lexer` or an ESM-capable parser (acorn/OXC) | Fast import extraction without executing code |
| Validation | JSON Schema with Ajv | Contract between stages |
| Tests | Vitest | Common, fast |
| Site | Astro static output | Zero JS by default, per-package pages for SEO, GitHub Pages friendly |
| Site search | Pagefind (static index) ⚠ confirm Astro integration | Search without a server |
| YAML | `yaml` library | Registry parsing |

---

## 7. Status model and decision logic

### 7.1 Statuses

| Status | Meaning | Typical example |
|---|---|---|
| `ready` | A **stable** release works with stable Solid 2 | `@solidjs/router` 2.x |
| `prerelease` | Compatible only on a prerelease line (`next`, `rc`, `beta`, `alpha`) | Kobalte `2.0.0-alpha.5` |
| `in-progress` | No compatible release yet, but upstream shows active work (open PR/branch/milestone, maintainer-acknowledged issue) | Library with a `solid-2` branch |
| `blocked` | No compatible line and either the stable line declares Solid 1 only, or published code uses removed APIs, with no upstream work found | `@tanstack/solid-virtual` (per the fixture above) |
| `unmaintained` | Deprecated on npm, archived repository, or no release for a long period (policy window, default 18 months) | Abandoned plugin |
| `agnostic` | Does not depend on Solid; shown but excluded from percentages | Framework-neutral utility |
| `unknown` | Not enough evidence | Newly added package before first run |

A status is always shown with:

- **Version line table**: which package versions work with Solid 1 and Solid 2 (for example `0.13.x → Solid 1; 2.0.0-alpha.x → Solid 2`).
- **Confidence** (evidence level, below).
- **Reasons**: machine-generated, human-readable sentences.
- **Checked at / tested against**: dates and exact Solid versions.

### 7.2 Evidence levels

| Level | Source | Strength |
|---|---|---|
| `D` Declared | `peerDependencies`, `dependencies` ranges, dist-tags | Weak (can mislead) |
| `S` Static | Import analysis of published code against the actual Solid 2 export surface | Medium |
| `B` Build/import smoke | Package installs with Solid 2, entrypoints import, a bundler build succeeds | Medium-strong |
| `T` Types smoke | A TypeScript consumer snippet compiles against Solid 2 types | Medium-strong |
| `A` Attested | Maintainer attestation with evidence link | Strong, but human-asserted |
| `U` Upstream CI | Library's own CI (reusable Action) tests against Solid 2 | Strongest |

`ready` requires at least `D + S`. The UI marks it **verified** when `B` (and `T`, if the package ships types) also pass. Anything weaker is shown as `ready (declared)`.

### 7.3 Decision logic

Inputs per package: all dist-tags, versions, peer ranges, scan findings, smoke results, upstream signals, attestations, deprecation/archive flags.

```ts
type Solid = { stable2: string; next: string | null };      // for example { stable2: "2.0.3", next: "2.1.0-next.4" }

function evaluate(pkg: PackageEvidence, solid: Solid, policy: Policy): Verdict {
  if (!pkg.dependsOnSolid) return verdict("agnostic");

  // 1. Candidate lines: each dist-tag target plus the highest stable version that admits Solid 2.
  const lines = candidateLines(pkg);                         // [{ version, tag, stability }]

  // 2. A line "admits" Solid 2 if its solid-js peer/dependency range accepts a Solid 2 version.
  //    Use semver.satisfies(v, range, { includePrerelease: true }).
  const admits = (l) => rangeAdmits(l.solidRange, [solid.stable2, solid.next]);

  // 3. A line is "clean" if the scan found no removed imports/exports reachable from its entrypoints.
  const clean = (l) => scan(l).violations.length === 0;

  const stableOk = lines.filter(l => l.stability === "stable" && admits(l) && clean(l));
  if (stableOk.length) return ready(best(stableOk), confidence(stableOk));

  const preOk = lines.filter(l => l.stability !== "stable" && admits(l) && clean(l));
  if (preOk.length) return prerelease(best(preOk));

  if (pkg.upstream.hasSolid2Work) return inProgress(pkg.upstream);

  // 4. Overlays
  if (pkg.deprecated || pkg.repoArchived || stale(pkg, policy.unmaintainedAfterMonths))
    return unmaintained(pkg);

  if (lines.some(l => !admits(l)) || lines.some(l => !clean(l)))
    return blocked(reasons(lines));                          // includes "peer range too permissive"

  return unknown();
}
```

Notes:

- **Open peer ranges** (`>=1.7`, `*`) technically admit Solid 2. They count as `D` only; the scanner and smoke tests decide the rest. A permissive range with removed imports yields `blocked` with the reason *"peer range accepts Solid 2 but code imports removed APIs"*.
- **Dual-support ranges** (`^1.9 || ^2.0.0`) admit both and are fine.
- **Attestations** can raise confidence or add an `in-progress`/`ready` claim, but a maintainer-asserted `ready` that contradicts a failing scan or smoke test is shown as **disputed**, not silently accepted. Attestations carry an expiry (default 90 days).
- **Overrides** by project maintainers (not package maintainers) require a linked public evidence item and a second maintainer's review, and are stored in `registry/` with a reason and expiry.

---

## 8. Data collection

This section specifies **what is collected, from where, how, how often, and what happens when collection goes wrong**. Judging package code (static scan, smoke tests) is in [section 9](#9-verification-mechanisms). The workflows that run all of this are in [section 10](#10-automation-and-pipeline-operations). What ends up on screen is in [section 12](#12-information-shown-in-the-tracker).

### 8.1 Principles

1. **Public sources and official APIs only.** No scraping of HTML where an API exists. The single exception is the Solid migration page, which is used only as a change-detection signal and never as the source of a status.
2. **Pull, do not ask.** v1 needs nothing from maintainers. Their input (attestations, corrections) only adds evidence.
3. **Polite by design.** Identifying `User-Agent` with a contact URL, low concurrency, conditional requests, backoff, and per-host circuit breakers.
4. **Every fact carries provenance**: source, fetch time, and a fingerprint (see [8.5](#85-normalisation-and-provenance)).
5. **Facts are stored separately from judgements.** Rules can change and statuses can be recomputed without re-fetching anything.
6. **Fail soft.** Keep the last good data and mark it stale. Never delete or downgrade a record because a fetch failed.
7. **Everything package-controlled is hostile input**: names, versions, URLs, descriptions, file contents.
8. **Minimal personal data** (see [8.9](#89-what-is-deliberately-not-collected)).

### 8.2 Source catalogue

| ID | Source | Read via | Collected | Used for | Cadence |
|---|---|---|---|---|---|
| S1 | npm registry packument | `GET registry.npmjs.org/{name}` | dist-tags, publish times, per-version peer and dependency ranges, export maps, deprecation, repository, license | Version lines, declared compatibility, deprecation | Every 6 hours (conditional) |
| S2 | npm registry search | `GET registry.npmjs.org/-/v1/search` | names, keywords, versions, links | Discovery of candidates | Daily |
| S3 | npm downloads API | `GET api.npmjs.org/downloads/point/last-week/{name}` | weekly download count | Ranking and weighting only | Daily |
| S4 | npm tarballs | `dist.tarball` taken from S1 | file contents, in a temp directory only | Static scan, smoke tests | On new versions, rule changes, Solid changes |
| S5 | GitHub GraphQL | `POST api.github.com/graphql` | archive flag, last push, releases, branches, milestones, recent issues and pull requests | Upstream signals, "needs help", unmaintained | Every 6 hours |
| S6 | Solid releases | npm packuments and GitHub releases of the Solid core packages | dist-tags, release tags | Versions under test, sentinel trigger | Hourly |
| S7 | Solid migration docs and in-package guides | conditional GET of the docs page; files inside the installed `solid-js` package | content hashes, identifier sets | Rules-drift detection | Hourly, and per Solid release |
| S8 | Solid export surface | local install of `solid-js` 1.x and 2.x in a temp project | exported names and subpaths | Dynamic removed-API detection | Per Solid release |
| S9 | Curated registry | YAML files in the repository | categories, families, aliases, supersession, notes | Scope, grouping, renames | On change |
| S10 | Contributions | issue forms and pull requests | corrections, attestations, add-package requests | Human evidence | On change |
| S11 | Optional enrichment (⚠ unverified) | deps.dev, ecosyste.ms | dependent counts | Discovery and ranking | Weekly |
| S12 | Pipeline evidence | the tracker's own scan and smoke jobs | findings, pass/fail results, diagnostics | Evidence levels `S`, `B`, `T` | See [section 9](#9-verification-mechanisms) |

Classification: **S1 to S3, S5 to S7 are facts about the world. S4, S8 and S12 are derived locally. S9 and S10 are human inputs.**

### 8.3 Source-by-source mechanics

**S1 — npm packument**

- Request `GET https://registry.npmjs.org/<name>` (scoped names encode the slash as `%2F`). Send `If-None-Match` with the stored ETag; a `304` response costs almost nothing.
- Read `dist-tags`; `time` (per-version publish times and `modified`); and for each retained version `peerDependencies`, `peerDependenciesMeta`, `dependencies`, `optionalDependencies`, `exports`, `main`, `module`, `types`, `deprecated`, `dist.tarball`, `dist.integrity`, `repository`, `license`, `keywords`.
- **Versions retained:** every dist-tag target, the newest stable version of each major line, and the 10 newest by publish time. Older versions are summarised (count, first and last date), not stored.
- **Fingerprint** = hash of (dist-tags, `time.modified`, deprecation flags of retained versions, version count). An unchanged fingerprint means all downstream work for that package is skipped.
- **Full document, not the abbreviated install format**, until an M0 spike confirms the abbreviated format on registry.npmjs.org carries `peerDependenciesMeta`. ⚠ A GitLab issue reports that format omitting it in GitLab's own registry implementation, and optional peers change how a missing `solid-js` peer must be read.
- Cap the response size (for example 20 MB) and fail soft on oversize.

**S2 — npm search**

- `GET https://registry.npmjs.org/-/v1/search?text=<query>&size=<n>&from=<offset>`. ⚠ Third-party sources report up to 250 results per page; confirm during M0.
- Query set (configurable in `rules/discovery.yml`): `keywords:solid-js`, `keywords:solidjs`, `keywords:solid`, plain text `solid-js` and `solidjs`, plus scope searches for known families.
- Output: candidate name, latest version, keywords, links and modified date, written to `data/discovery/candidates.json`. Candidates are **never auto-promoted** (see [8.4](#84-discovery-and-scope)).

**S3 — npm downloads**

- `GET https://api.npmjs.org/downloads/point/last-week/<name>`, one request per package, concurrency at most 4. ⚠ Bulk forms of this endpoint may exist, but one third-party source says there is none; treat bulk as an optimisation to measure later.
- Stored: the last four weekly counts and the fetch date. **Used for ranking and weighting only; it never changes a status.** A missing value is stored as `null`, not zero.

**S4 — Tarballs**

- Fetched only for versions not yet scanned under the current `(rulesVersion, solidVersion, toolVersion)` tuple.
- The tarball URL must be on `registry.npmjs.org`; reject any other host. Verify `dist.integrity` after download.
- Extract into a temp directory under hard caps: compressed size at most 50 MB, unpacked at most 200 MB, at most 10,000 files, directory depth at most 20. Skip symlinks, hardlinks and device files. Reject absolute paths and `..` segments.
- Parse only `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`, `.d.ts` and `.json`. **Never execute** (execution is a separate, sandboxed stage in [9.3](#93-stage-c--sandboxed-smoke-tests)).
- Delete after scanning. Persist only derived findings and the integrity hash.

**S5 — GitHub repository signals (GraphQL)**

- Repository resolution: take owner and name from the `repository` field of S1. Accept `https://github.com/o/r(.git)`, `git+https://`, `git://`, `ssh://`, `github:o/r` and the `o/r` shorthand. Hosts other than github.com are recorded as `upstream: unsupported-host` in v1. Keep a monorepo `directory` value for display. **Never fetch an arbitrary URL taken from package metadata.**
- Batch about 25 repositories per query using aliases and a shared fragment, sequentially, with at least one second between queries:

```graphql
fragment Signals on Repository {
  isArchived
  pushedAt
  defaultBranchRef { name }
  latestRelease { tagName isPrerelease publishedAt }
  refs(refPrefix: "refs/heads/", first: 100) {
    nodes { name target { ... on Commit { committedDate } } }
  }
  milestones(first: 20, states: OPEN) { nodes { title url } }
  issues(first: 30, states: OPEN, orderBy: { field: UPDATED_AT, direction: DESC }) {
    nodes { title url updatedAt }
  }
  pullRequests(first: 30, states: [OPEN, MERGED], orderBy: { field: UPDATED_AT, direction: DESC }) {
    nodes { title url state isDraft updatedAt headRefName }
  }
}

query Batch {
  rateLimit { cost remaining resetAt }
  r0: repository(owner: "kobaltedev", name: "kobalte") { ...Signals }
  r1: repository(owner: "TanStack", name: "query") { ...Signals }
}
```

- Matching is done **locally** against configured patterns (`rules/status-policy.yml`), so no search endpoints are used (they have stricter limits).
- Limits (verified against GitHub's documentation): the Actions `GITHUB_TOKEN` gets **1,000 GraphQL points per repository per hour**; points are the number of requests divided by 100, rounded, minimum 1; one call may request at most **500,000 nodes**; at most **100 concurrent** requests; secondary limit of **2,000 points per minute**; requests running over about **10 seconds** can time out. A batch of 25 repositories should cost roughly 1 to 2 points (confirm with the `rateLimit.cost` field in M1). Read `rateLimit` on every response; when `remaining` falls below 100, stop and mark the remaining repositories `upstream: deferred`.

Signal definitions:

| Signal | Strength | Notes |
|---|---|---|
| Branch matching a configured pattern (for example a Solid 2 or `next` branch) with a commit in the last 180 days | strong | Needs the `committedDate` field above |
| Open or merged pull request in the last 180 days whose title or branch matches the patterns | strong | |
| Prerelease GitHub release newer than the latest stable release, tag matching the patterns | strong | |
| Open milestone whose title matches the patterns | weak | Planning, not work |
| Open issue whose title matches the patterns | weak | Interest, not work |

**`hasSolid2Work` is true when at least one strong signal was updated within 180 days.** Weak-only signals do not change the status, but the package page shows "an issue exists" with a link.

**S6 — Solid core releases (sentinel)**

- Watched packages (configurable in `rules/solid-packages.yml`): `solid-js`, `@solidjs/web`, `@solidjs/signals`, `@solidjs/vite-plugin`, `babel-preset-solid`. Read their packuments (S1 mechanics) hourly.
- GitHub releases of the `solidjs/solid` repository are read with a small GraphQL query (`releases(first: 10)`), because package-level tags such as `@solidjs/signals@2.0.0-rc.22` appear there.
- Written to `data/solid.json`: `stable` (the highest non-prerelease version in major 2, found by semver comparison rather than trusting the `latest` tag alone), `next` (if present), the full dist-tag map, publish times, plus `surfaceHash`, `docsHash` and `cheatsheetHash` from S7 and S8.
- **Any change triggers the pipeline** (see [10.1](#101-the-pipeline-as-a-dag)).

**S7 — Solid migration docs and in-package guides (rules-drift detection)**

- Conditional `GET https://docs.solidjs.com/migration/from-solid-1` with `If-None-Match` and `If-Modified-Since`. Hash the extracted main text and extract the set of identifiers written in inline code. Store only the hash and the identifier set.
- After S8 installs Solid, hash the guides that ship inside the package when present: `CHEATSHEET.md` and `skills/solid-2.0/SKILL.md` (Solid documents both as living in `node_modules/solid-js`).
- A change opens or updates a single `rules-review` issue listing identifiers added or removed. **Rules are never rewritten automatically**; replacement hints in `rules/removed-apis.yml` are curated by humans. Detection of removed APIs does not depend on this file because it is derived dynamically in S8.

**S8 — Solid export surface (dynamic rules)**

- In a temp directory, install in separate subfolders the latest `solid-js` 1.x, the current stable 2.x and the `next` tag (plus `@solidjs/web` for 2.x), always with `--ignore-scripts`.
- Record (a) the public entry points from each `package.json` `exports` map (subpaths such as `solid-js/store`) and (b) the `Object.keys` of each entry's ESM namespace.
- Derive: `removedIn2 = exports(1.x) minus exports(2.x)` (both subpaths and names), `addedIn2` the reverse, and `surface2` the current Solid 2 surface. Cache by Solid version; the hash of `surface2` is the `surfaceHash`.
- The scanner uses these sets: a named import from `solid-js` that is in `surface2` is fine; one in `removedIn2` is a `removed-in-2` finding with a replacement hint if one exists; one in neither is an `unknown-export` (low severity, may be a type or internal). Types are covered separately by the types check ([9.3](#93-stage-c--sandboxed-smoke-tests)).
- **Result: when Solid ships a new version, the rules update themselves.**

**S9 — Curated registry**

YAML files under `registry/` (see [11.4](#114-registry-entry-human-curated-input)) provide categories, family grouping, aliases, `supersededBy` for renames, `alternatives`, notes and attestations. Validated against a JSON Schema in CI. Changes arrive only through reviewed pull requests.

**S10 — Contributions**

Issue forms ("Add a package", "Correct a status") and pull requests. In v1 these are processed by humans; evidence URLs in attestations are checked for reachability and host allowlisting by CI. The optional `/recheck` command is described in [10.6](#106-human-in-the-loop-controls).

**S11 — Optional enrichment (⚠ unverified)**

deps.dev offers a free, unauthenticated API (for example `GET https://api.deps.dev/v3/systems/npm/packages/<name>`), and ecosyste.ms offers package and dependent data. Evaluate in M0 whether either gives a reliable dependents count for `solid-js`. If not, discovery remains search plus curated plus requests, and the site states that coverage is not exhaustive. This source never affects a status.

**S12 — Pipeline evidence**

Produced by the tracker's own scan and smoke stages; specified in [section 9](#9-verification-mechanisms).

### 8.4 Discovery and scope

**Discovery steps (weekly, plus on demand):**

1. Run the S2 query set and collect candidates.
2. Remove packages already tracked, deprecated packages with no Solid 2 line, and obvious noise (name or keyword filters in `rules/discovery.yml`).
3. Score candidates by weekly downloads (S3), optional dependents (S11) and whether the package depends or peers on `solid-js` or `@solidjs/*` (from S1).
4. Write `data/discovery/candidates.json` and open **one pull request or issue** listing the top new candidates as a checklist for a human to promote into `registry/`.

**Scope rule (published in the methodology):** track a package when it depends or peers on `solid-js` or `@solidjs/*` **and** meets the threshold (default: at least N weekly downloads, or listed in the registry, or requested by an issue). Tiers:

| Tier | Meaning | How it gets there |
|---|---|---|
| Curated | Hand-listed in `registry/` | Pull request |
| Tracked | Meets the threshold, approved | Promotion from candidates |
| Candidate | Discovered, not yet tracked | Automatic, never shown as a status |

**Families** (for example `@solid-primitives/*`) share a `family` value and get a per-package status plus a family roll-up. **Renames** are recorded with `supersededBy`; deprecation messages that say a package moved are flagged for human review.

**Coverage statement:** the site always shows how many packages are tracked, how many are curated, and how many candidates await review, and says plainly that discovery is not exhaustive.

### 8.5 Normalisation and provenance

**Normalisation rules**

- Package names are canonicalised (lowercase, scoped form `@scope/name`, no URL forms).
- Repository URLs are reduced to host, owner, name and optional directory.
- Version ranges are parsed with a semver library. Unparseable ranges (`workspace:`, `npm:` aliases, malformed text) are kept as raw strings with `parsed: false` and treated as `unknown` for that line, never as compatible.
- Dates are stored in UTC ISO 8601. Publish times in the future are clamped and flagged.
- All JSON from package metadata is parsed into null-prototype objects and size-capped.

**Provenance envelope.** Every stored fact records where it came from:

```json
{
  "peerSolidRange": {
    "value": "^1.9.8",
    "source": "npm-packument",
    "packageVersion": "0.13.14",
    "fetchedAt": "2026-11-24T06:12:03Z",
    "fingerprint": "sha256:3f2a9c0d",
    "toolVersion": "0.3.0"
  }
}
```

Every evidence entry records the check, the level, the result, the Solid version it ran against, the rules version, the run identifier, and the hash of the result artifact, so any statement on the site can be traced back to a run.

### 8.6 Change detection and the work set

Recompute work only when something relevant changed. Triggers:

| Trigger | What is recomputed |
|---|---|
| Package fingerprint changed (S1) | Facts, then scan if a new version appeared, then status |
| New version of a retained package | Static scan for that version; smoke test queued |
| Solid stable or `next` changed (S6) | All smoke tests and scans, highest download count first |
| `surfaceHash` changed (S8) | All static scans |
| Rules version changed | All statuses (no re-fetch needed) |
| Tool version changed | Affected checks |
| Freshness threshold passed | The expired check for that package |
| Attestation added or expired | Status for that package |
| Maintainer `/recheck` | Everything for that package |

The planning algorithm is in [10.2](#102-work-set-planning).

### 8.7 Data quality controls

1. **Schema validation** at every stage boundary, with maximum string lengths and array sizes.
2. **Sanity invariants** checked before publishing: the tracked package count must not drop by more than the configured share; every record must have a status; `checkedAt` values may not be in the future; every dist-tag must point to an existing version.
3. **Anomaly gate.** If one run would change too many statuses at once, the result is **held for human review** instead of published. This protects against a registry outage or a bug causing a wave of false `unknown` or `blocked` results. Thresholds live in the policy file:

```yaml
anomaly:
  maxStatusChangeShare: 0.05      # more than 5 percent of tracked packages changing status in one run
  maxNewUnknownShare: 0.03        # more than 3 percent newly becoming unknown
  minTrackedRatio: 0.9            # fewer than 90 percent of last run's packages present
  holdOnSolidVersionChange: true  # a new Solid version always gets a human look at the first diff
```

4. **Control packages** (see [10.5](#105-failure-handling-and-degradation)): a known-good and a known-bad fixture run with every verification batch. If the controls do not return their expected verdicts, the whole batch is discarded as an infrastructure failure rather than recorded as package failures.
5. **Cross-source checks**: a repository named by npm that GitHub reports as not found becomes `upstream: repo-not-found`; a dist-tag pointing to a missing version is ignored and flagged.
6. **Never overwrite good data with an error.** A failed fetch leaves the previous values in place and only affects the freshness record.

### 8.8 Data lifecycle and retention

| Layer | Contents | Where it lives | Retention |
|---|---|---|---|
| Raw responses | HTTP bodies | Memory or runner temp only; never committed | Job lifetime |
| Fingerprints | ETag and hash per source per package | `data/fingerprints.json` | Overwritten each run (small) |
| Facts | Normalised, provenance-tagged values | `data/packages/*.json` | Permanent in git history |
| Evidence | Scan, smoke and types results | `data/packages/*.json`, `data/evidence/` | Latest per check, history in git |
| Judgements | Statuses, reasons, events | `data/packages/*.json`, `data/events.ndjson` | Permanent in git history |
| Freshness | Last-confirmed time per package and check | `data/freshness.json` | Overwritten each run |
| Run reports | Counts, durations, errors, anomalies | `data/runs/latest.json` | Latest, plus history in git |
| Handoff artefacts | JSON passed between jobs | Actions artifacts | About 3 days |
| Published output | Site, API, badges | GitHub Pages | Latest deploy |

The Actions cache is limited (10 GB per repository for GitHub Free) and best-effort. **The pipeline must work from a cold cache**: fingerprints in the `data` branch, not the cache, tell it what is unchanged.

### 8.9 What is deliberately not collected

- **No visitor data.** No cookies, no analytics, no fingerprinting. "Check my app" parses files in the browser; nothing is uploaded.
- **No personal data beyond public handles.** npm maintainer emails and names are not stored or published. GitHub handles appear only where a person made an attestation or correction in public.
- **No package source code is retained** beyond hashes and short, bounded excerpts of finding locations (specifier names, not code bodies).
- **No credentials** other than the repository's own `GITHUB_TOKEN`, no logged-in scraping, no private repositories.
- **Terms of use.** The tracker reads documented public APIs at modest rates with an identifying `User-Agent`. If a provider asks for lower rates or blocks the client, the pipeline degrades (see [10.5](#105-failure-handling-and-degradation)) rather than working around it.
- **Opt-out and removal.** Facts about public packages are public and the listing stays. Maintainers can correct their entry, decline badges and notifications, and request removal of personal data (handles) at any time.


---

## 9. Verification mechanisms

### 9.1 How the stages fit together

| Stage | Name | Specified in | Evidence level produced |
|---|---|---|---|
| A | Collect metadata (no code) | [Section 8](#8-data-collection) (sources S1 to S3 and S6) | `D` |
| B | Static scan | [9.2](#92-stage-b--static-scan-code-is-parsed-never-executed) | `S` |
| C | Sandboxed smoke tests | [9.3](#93-stage-c--sandboxed-smoke-tests) | `B`, `T` |
| D | Upstream signals | [8.3](#83-source-by-source-mechanics) (source S5) and [9.4](#94-stage-d--upstream-signals) | none; feeds `in-progress` and the "needs help" view |
| E | Attestations and push model | [9.5](#95-stage-e--maintainer-attestations-and-the-push-model) | `A`, `U` |

Stages communicate only through schema-validated JSON (see [6.2](#62-principles-for-the-pipeline)). Collection and automation details live in [section 8](#8-data-collection) and [section 10](#10-automation-and-pipeline-operations); this section covers how package code is judged.


### 9.2 Stage B — Static scan (code is parsed, never executed)

1. Download the tarball from `dist.tarball`, verify `dist.integrity`, extract into a temp dir with path-traversal protection and **size/file-count caps** (decompression bombs).
2. Resolve entrypoints from `exports`/`main`/`module`/`types` for the conditions that matter (`import`, `browser`, `development`, `solid`, `default`). Many Solid libraries ship JSX source under a `solid` condition; scan those files too.
3. Extract import specifiers and named imports (`es-module-lexer` or a parser), following relative imports to a bounded depth.
4. Build the **Solid 2 export surface dynamically**: in a clean temp project install the current `solid-js` (stable and `next`), and record `Object.keys()` of each public entry (`solid-js`, `@solidjs/web`, `@solidjs/signals` if public). Cache it by Solid version. This means **the rule set updates itself whenever Solid changes**, with no hand-maintained list required for detection.
5. Classify findings:

| Finding | Detection | Example |
|---|---|---|
| `removed-subpath` | Specifier is `solid-js/web`, `solid-js/store`, `solid-js/h`, `solid-js/html`, `solid-js/universal`, `solid-js/jsx-runtime`, `solid-js/jsx-dev-runtime` ✅ (all removed or moved per the migration guide) | `import { render } from "solid-js/web"` |
| `missing-export` | Named import from a Solid entry that does not exist in the installed Solid 2 | `mergeProps`, `splitProps`, `createResource`, `onMount`, `createComputed`, `batch`, `on` ✅ (listed as removed/renamed in the guide) |
| `type-ownership` | `JSX`/`ComponentProps` imported from `solid-js` rather than `@solidjs/web` ✅ | `import type { JSX } from "solid-js"` |
| `jsx-removed-syntax` (phase 3) | In shipped JSX source: `classList`, `use:`, `on:`, `attr:`, `bool:` on native elements ✅ (compile errors in Solid 2) | `<div classList={...}>` |

6. Attach a **replacement hint** from `rules/removed-apis.yml` (for example `mergeProps → merge`, `splitProps → omit`, `onMount → onSettled`, `Suspense → Loading`, `ErrorBoundary → Errored`, `Index → For keyed={false}`, `vite-plugin-solid → @solidjs/vite-plugin`, `createResource → async createMemo`) and a link to the relevant migration-guide section.

Known limits (document them in METHODOLOGY.md): dead code and optional dual-support imports can cause false positives; semantic runtime changes (batching, effect timing, async hold behaviour) cannot be seen statically. That is why static findings never produce `ready` alone at "verified" confidence.

### 9.3 Stage C — Sandboxed smoke tests

Goal: cheap, generic, hard-to-fake evidence that a package works **at all** with Solid 2.

Per `(package, version, solidVersion)`:

1. Create a temp project with `solid-js@<v>`, `@solidjs/web@<v>`, `@solidjs/vite-plugin`, TypeScript, and the package under test. Install with **`--ignore-scripts`** and a **fresh lockfile-less resolution with overrides** forcing a single Solid 2 copy.
2. **Import check (Node, server conditions)**: dynamic `import()` of each public entrypoint. Catches immediate failures such as removed exports at load time (the urql discussion reported exactly this failure mode).
3. **Build check**: generate a tiny entry that imports each public export and run a production build with the Solid 2 Vite plugin. Catches JSX/compiler issues in source-shipped packages.
4. **Types check** (if the package ships types): compile a snippet using the package's main API with `tsc --noEmit`, `jsxImportSource: "@solidjs/web"`.
5. **Dev-mode diagnostics (optional)**: Solid 2 dev builds report mistakes with stable error codes; harvest any emitted at import/build and attach them as evidence. ✅ (Solid documents stable diagnostic codes and a diagnostics-enabled dev server option.)
6. **Deeper tier (opt-in)**: if the package provides `solid2-compat` smoke metadata (command or file), run it. Generic render tests across arbitrary libraries are not feasible, so deeper evidence comes from maintainers' own CI (see [8.6](#95-stage-e--maintainer-attestations-and-the-push-model)).

Outputs are JSON only (`pass|fail|skipped`, durations, first N bytes of error text, diagnostic codes), never raw logs rendered as HTML.

#### Sandbox security model (this is the highest-risk part)

Importing a package executes its code. Treat every package as hostile:

- Run each package in its **own matrix job on an ephemeral GitHub-hosted runner**. ✅ Each job runs in a fresh VM.
- **No secrets, `permissions: contents: read`**, no `GITHUB_TOKEN` write scopes, no cache sharing with privileged jobs.
- **Egress allowlist** with a runner-hardening agent (for example StepSecurity Harden-Runner in `block` mode permitting only the npm registry and GitHub hosts). ⚠ validate that block mode works on free public-repo runners and which endpoints are needed.
- **Hard timeouts** per job (minutes) and per command; **resource caps** on output size.
- **Never interpolate matrix values into shell**; pass them as environment variables.
- Results leave the sandbox **only as a schema-validated JSON artifact**. The privileged commit job validates the schema and size limits and treats all strings as untrusted text (escaped on output, never `innerHTML`).
- Matrix sizing: GitHub allows at most **256 jobs per workflow run** ✅, so shard (for example by hash of package name) when tracking more than ~200 packages, and run the top packages more often.

### 9.4 Stage D — Upstream signals

Used for `in-progress` and for the "needs help" view. Signals and their strengths are defined in [8.3](#83-source-by-source-mechanics) (source S5). They never mark a package `ready`. They only say "work exists" and link to it.

### 9.5 Stage E — Maintainer attestations and the push model

**Pull model (v1):** maintainers submit a PR adding evidence to `registry/packages/<pkg>.yml`:

```yaml
attestations:
  - claim: ready
    version: "2.0.0"
    evidence: https://github.com/example/lib/actions/runs/123456789   # CI run testing against Solid 2
    attestedBy: github:example-maintainer
    expires: 2027-02-24
```

CI validates the schema and that the evidence URL is reachable. A human maintainer reviews.

**Push model (v2):** a small reusable GitHub Action/workflow that library maintainers add to their own CI. It runs their tests against `solid-js@latest` and `@next`, then optionally dispatches a result to the tracker. Because inbound results are untrusted, the tracker verifies them by re-running the generic checks and by checking that the claiming workflow run is in the claimed repository (via the GitHub API) rather than trusting the payload. Keep this out of v1.

### 9.6 Check-my-app

Input: `package.json`, `package-lock.json`, `pnpm-lock.yaml` or `yarn.lock` (parsed client-side). Output:

- Direct and transitive dependencies that depend on `solid-js`, each with status, the version to upgrade to, and links.
- **Blocking set**: dependencies with status `blocked`, `in-progress`, `prerelease` or `unknown`.
- A shareable Markdown summary (copy button), and in the CLI a non-zero exit code when blockers exist (for CI gates).
- Privacy: no upload, no analytics, the dataset is fetched as static JSON.

---

## 10. Automation and pipeline operations

[Section 8](#8-data-collection) says what is collected. [Section 9](#9-verification-mechanisms) says how package code is judged. This section says **how it all runs without a human**: the order of jobs, what triggers what, how work is limited to what changed, how results reach the site, and what happens when something breaks. Freshness policy (staleness thresholds, the 60-day trap) is in [section 15](#15-keeping-it-fresh); workflow skeletons are in [Appendix D](#appendix-d--workflow-skeletons).

### 10.1 The pipeline as a DAG

```text
 triggers: sentinel (hourly) · schedule (6 h / daily / weekly) · push to main · workflow_dispatch · /recheck
      │
      ▼
 ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌────────────────────┐   ┌──────────┐
 │ 1 PLAN  │──►│ 2 COLLECT│──►│ 3 SCAN    │──►│ 4 VERIFY (matrix)  │──►│ 5 ENGINE │
 │ work set│   │ S1..S3,S5│   │ S4 + S8   │   │ sandbox, no secrets│   │ statuses │
 └─────────┘   └──────────┘   └───────────┘   └────────────────────┘   └────┬─────┘
   reads: data branch,          read-only token                              │ validated JSON
   rules, registry              no write                                     ▼
                                                              ┌──────────────────────────┐
                                                              │ 6 PUBLISH (only writer)  │
                                                              │ gates → commit `data`    │
                                                              └────────────┬─────────────┘
                                                                           ▼
                                                              ┌──────────────────────────┐
                                                              │ 7 BUILD + DEPLOY (Pages) │
                                                              └──────────────────────────┘
```

| Step | Job | Token and network | Input | Output |
|---|---|---|---|---|
| 1 | `plan` | read-only; no network except the `data` branch | `data/`, `registry/`, `rules/`, trigger payload | `workset.json` (packages to refresh, checks to run) |
| 2 | `collect` | read-only; npm, GitHub API, docs host | `workset.json` | `facts.json`, `solid.json`, `fingerprints.json` |
| 3 | `scan` | read-only; npm tarball host only | `facts.json` | `findings.json`, `surface.json` |
| 4 | `verify` (matrix shards) | **no token, no secrets**, egress allowlist | `workset.json` shard | `smoke-<shard>.json` |
| 5 | `engine` | read-only; no network | all JSON above plus previous `data` | `packages/*.json`, `events.ndjson`, `meta.json`, `freshness.json`, `run-report.json` |
| 6 | `publish` | **write to `data` branch only**; never touches package code | validated `engine` output | a commit on `data` (or a held review, see [8.7](#87-data-quality-controls)) |
| 7 | `deploy` | Pages deploy permission | `data` branch plus `main` | the live site |

Rules that follow from the privilege model in [6.2](#62-principles-for-the-pipeline):

- Steps 3 and 4 handle hostile content, so they never hold a write token, and nothing they emit is trusted until the schema gate in step 6 passes.
- The **only** data flowing between jobs is JSON uploaded as a workflow artifact (about 3 days of retention). No shared caches between privileged and unprivileged jobs.
- Step 6 is the single writer. It re-validates against the JSON Schemas, runs the anomaly gate, and commits with a message that records the run identifier, the Solid versions tested and the counts.

### 10.2 Work set planning

The `plan` job turns "something happened" into "this is the minimum to redo". It compares stored fingerprints and freshness with the trigger and the rules.

```ts
// Pure function, unit-tested with fixtures. Inputs are plain JSON.
function plan(input: {
  trigger: "schedule" | "sentinel" | "dispatch" | "recheck" | "push";
  scope?: { packages?: string[]; checks?: Check[] };
  state: { fingerprints: Fingerprints; freshness: Freshness; solid: SolidState };
  current: { solid: SolidState; rulesVersion: string; toolVersion: string };
  policy: Policy;
  budget: { smokeMinutes: number; maxShards: number };
}): WorkSet {
  const solidChanged = input.state.solid.hash !== input.current.solid.hash;
  const rulesChanged = input.state.solid.rulesVersion !== input.current.rulesVersion;
  const work: WorkItem[] = [];

  for (const pkg of trackedPackages()) {
    const checks = new Set<Check>();
    if (input.scope?.packages && !input.scope.packages.includes(pkg.name)) continue;

    if (fingerprintChanged(pkg))             checks.add("facts");                 // new publish or tag move
    if (newVersionSince(pkg, "scan"))        checks.add("scan");
    if (solidChanged || surfaceChanged())    { checks.add("scan"); checks.add("smoke"); }
    if (rulesChanged)                        checks.add("engine");                // no network needed
    for (const c of expiredChecks(pkg, input.policy.staleness)) checks.add(c);
    if (input.trigger === "recheck")         ["facts", "scan", "smoke", "upstream"].forEach(c => checks.add(c as Check));

    if (checks.size) work.push({ pkg: pkg.name, checks: [...checks], priority: priorityOf(pkg) });
  }

  // Highest priority first, then fit the smoke work into the time budget.
  return fitToBudget(sortByPriority(work), input.budget);
}
```

**Priority** is `downloadsWeekly` (descending), then packages whose status recently changed, then packages with open correction requests, then everything else by oldest `checkedAt`. Because downloads only order the work and never change a result, this is safe.

**Budget fitting.** Smoke tests are the expensive step. If a Solid release invalidates everything, the plan runs the top packages first and carries the remainder over to the next scheduled run. Those carried-over packages keep their previous evidence, flagged **pending re-verification** with the new Solid version, so the site shows "verified against 2.0.2, re-check queued for 2.0.3" instead of silently implying the new version was tested.

**Idempotency.** Running the same plan twice with no new upstream changes produces an empty work set and a no-op commit (nothing is committed when output bytes are identical, except the heartbeat in [15.3](#153-avoiding-the-scheduled-workflow-silently-stops-trap)).

### 10.3 Schedules and triggers

| Workflow | Trigger | Cadence | Does | Concurrency group |
|---|---|---|---|---|
| `sentinel.yml` | schedule | hourly | S6 and S7 reads; if a change is found, dispatches `collect` with `trigger=sentinel` | `sentinel` (cancel in progress) |
| `collect.yml` | schedule, dispatch | every 6 hours | Steps 1, 2, 3 and 5 to 7 for changed packages (facts, upstream, scans for new versions) | `pipeline` (queue, never cancel) |
| `verify.yml` | schedule, dispatch, `workflow_run` | weekly, plus on Solid change | Steps 1, 3, 4 and 5 to 7 for smoke tests, top packages first | `pipeline` |
| `canary.yml` | schedule | daily | Smoke test against `solid-js@next`; writes the separate `canary` channel only | `canary` |
| `discovery.yml` | schedule | weekly | S2 and S3 for candidates; opens one candidates PR | `discovery` |
| `rules-drift.yml` | schedule, dispatch | daily and per Solid release | S7 and S8 comparison; opens or updates a `rules-review` issue | `rules` |
| `watchdog.yml` | schedule | daily | Reads the live `meta.json`; opens or updates a "pipeline stale" issue | `watchdog` |
| `deploy.yml` | push to `main`, push to `data` | on change | Step 7 | `pages` |
| `ci.yml` | pull request | on change | Lint, types, unit tests, schema validation, a site build with fixtures | per PR |

Concurrency matters: two pipeline runs must never publish at once, so `collect` and `verify` share one non-cancelling group and the `publish` step rebases onto the latest `data` head and re-validates before pushing. If the rebase would change an already-published record in a conflicting way, the job fails and the next run recomputes.

**Cron hygiene.** Scheduled runs use UTC, avoid the top of the hour (for example `17 */6 * * *`) because GitHub delays or drops scheduled runs at peak times, and tolerate missed runs by making every run incremental against stored state, never "since the last run".

### 10.4 Data flow, storage and publication

```text
 npm / GitHub / docs ─► facts ─► findings ─► smoke ─► engine ─► data branch ─► site build ─► Pages
  (HTTP, conditional)    JSON      JSON       JSON     JSON      git commit     static files   CDN
```

| Layer | Written by | Format | Who reads it |
|---|---|---|---|
| `facts` | `collect` | JSON with provenance envelope ([8.5](#85-normalisation-and-provenance)) | `scan`, `engine` |
| `findings` | `scan` | JSON (finding code, specifier, file, severity, replacement hint) | `engine`, package page |
| `smoke` | `verify` | JSON (`pass`, `fail`, `skipped`, durations, truncated error text, diagnostic codes) | `engine`, package page |
| `packages/*.json` | `engine` | The per-package record ([11.2](#112-per-package-record-abridged)) | Site, API, CLI |
| `events.ndjson` | `engine` | One line per status change or notable event | Changes page, Atom feed, API |
| `meta.json` | `engine` | Counts, timestamps, Solid versions, rules and tool versions, anomaly flags | Home banner, health page, third parties |
| `freshness.json` | `engine` | Last-confirmed time per package per check | Staleness UI, `plan` |

**Commit shape.** One commit per successful publish, authored by a bot identity, with machine-readable trailers (`Run-Id`, `Solid-Stable`, `Solid-Next`, `Rules`, `Tool`). Because files are normalised (sorted keys, stable formatting), diffs show exactly which facts changed. `git log data` is the audit trail and the source of the history timeline.

**History without a database.** Per-package history is derived from `events.ndjson` (compact, append-only) and, when deeper detail is needed, from `git log -- packages/<name>.json`. A nightly step compacts events older than 12 months into monthly summaries.

**Build and publish.** The deploy workflow checks out `main` (site code) and `data` (dataset), runs the Astro build, produces the static API files and badge JSON in the same build, and deploys the artifact to Pages. The deploy job gates on `meta.json` schema validity, so a malformed dataset never replaces a good site.

**Rollback.** Revert the offending commit on `data`; the push triggers a redeploy. Because the site is a pure function of `main` plus `data`, rollback needs no special tooling.

### 10.5 Failure handling and degradation

| Failure | Detection | Behaviour |
|---|---|---|
| npm registry error or timeout | HTTP status or timeout | Retry with exponential backoff and jitter (honour `Retry-After`), then keep last good facts, flag `collect: stale` on affected packages |
| npm throttling (429) | status code | Reduce concurrency, wait, resume; after repeated failure the circuit breaker stops npm work for the run |
| GitHub rate limit or secondary limit | `rateLimit.remaining`, `403`/`429` with headers | Stop at the threshold; remaining repositories marked `upstream: deferred`; resume next run |
| GitHub GraphQL timeout or `502/504` | status code | Halve the batch size and retry once; then defer the batch |
| Tarball too large, invalid or host not allowed | download and extraction caps | Record `scan: skipped (reason)`; the package gets no `S` evidence, and the engine falls back to declared evidence with `unknown` where required |
| Sandbox job crash or timeout | job conclusion | Record `smoke: error` (not `fail`) and retry once; a package is never marked failing because of infrastructure |
| Control packages misbehave | known-good or known-bad fixture returns an unexpected verdict | **Discard the whole verification batch** as an infrastructure failure, keep previous evidence, open an issue |
| Anomaly gate trips | thresholds in `rules/status-policy.yml` | Hold the commit; upload the proposed diff as an artifact; open an issue for a human to approve or reject |
| Schema validation fails | Ajv | Fail the publish; previous data stays live; open an issue |
| Whole pipeline stops (disabled schedule, outage) | watchdog reads live `meta.json` age | Site banner after 72 hours; "pipeline stale" issue; external dead-man's-switch alert |
| Pages deploy fails | job conclusion | Previous deploy stays live; alert on repeated failure |

**Control packages.** The repository keeps two tiny fixture packages that are verified in every batch: a known-good one that must pass and a known-bad one that imports a removed Solid 1 API and must fail with the expected finding. They are published to a local test registry or installed from tarballs inside the job, so they test the harness without depending on the network.

**Stale, not wrong.** The principle is that failures reduce **freshness**, never **correctness claims**: a package that cannot be re-checked keeps its last result with an older timestamp and a visible stale marker. After the thresholds in [15.2](#152-making-staleness-visible) are passed, a `verified` result is shown as `declared`, and a package with no successful check in a long window shows `unknown`.

### 10.6 Human-in-the-loop controls

Automation proposes; people decide in the places where judgement is needed.

| Where | What the bot does | What a human does |
|---|---|---|
| Discovery pull request | Lists new candidate packages with downloads and dependency evidence as a checklist | Ticks and promotes selected packages into `registry/` |
| `rules-review` issue | Lists identifiers added or removed on the Solid docs page or export surface | Updates `rules/removed-apis.yml` replacement hints, bumps `rulesVersion` |
| Anomaly hold | Uploads the proposed diff and explains which threshold tripped | Approves a re-run with the override flag, or investigates a bug |
| Correction issue form | Validates the form and labels it | Reviews the evidence and edits the registry or attestation |
| Attestation pull request | CI checks schema, evidence host allowlist and reachability | Maintainer review before merge (CODEOWNERS) |
| `/recheck <package>` comment | Runs a one-package work set and replies with the result link | Only repository maintainers can trigger it (checked via the commenter's permission, never from comment text alone) |
| Status override | None | Rare, requires a registry entry with a reason, an expiry date and a maintainer approval; shown on the package page as **manual override** |

**Overrides** exist because the engine can be wrong in edge cases (for example a package that supports Solid 2 through a renamed package). They are visible, expire after at most 90 days, and appear in the events feed, so they cannot quietly become permanent.

### 10.7 Operating budget

Targets to confirm during the M0 spike and then enforce in CI with a run-time report:

| Job | Target duration | Notes |
|---|---|---|
| `plan` | under 1 minute | Pure computation |
| `collect` (incremental) | under 10 minutes | Mostly `304` responses after the first run |
| `collect` (cold, first run for about 300 packages) | under 40 minutes | npm at concurrency 4 to 5, GitHub batches of 25 |
| `scan` (new versions only) | under 15 minutes | Parallel by shard |
| `verify` (full) | under 60 minutes wall-clock | Sharded matrix; well under 256 jobs per run |
| `publish` and `deploy` | under 5 minutes | The Pages deploy timeout is 10 minutes |

Every run emits `run-report.json` (durations per step, requests per host, cache and `304` hit rate, GitHub rate-limit points used, anomalies, deferred items). The health page ([12.8](#128-changes-feed-health-page-and-methodology)) shows the most recent report, so budget regressions are visible before they cause failures. ⚠ GitHub-hosted runners are free for public repositories at the time of writing; confirm against current billing documentation when starting M0.


---

## 11. Data model and public API

### 11.1 Published files (all static)

```text
/api/v1/index.json                 # compact list for the dashboard, CLI and search
/api/v1/packages/<name>.json       # full record; scoped names use "__": @kobalte__core.json
/api/v1/meta.json                  # generatedAt, lastSuccessfulRun, Solid versions tested, counts, schemaVersion
/api/v1/events.json                # recent status changes
/api/v1/solid.json                 # Solid dist-tags and export-surface hashes
/badges/<name>.json                # Shields endpoint format
/feed.xml                          # Atom feed of status changes
/llms.txt                          # plain description of the dataset for AI assistants
```

`schemaVersion` is a required integer in every file. Breaking changes bump the version and the path prefix (`/api/v2/`), and `v1` stays published during a deprecation window.

### 11.2 Per-package record (abridged)

```json
{
  "schemaVersion": 1,
  "name": "@kobalte/core",
  "family": null,
  "category": "ui-components",
  "repository": "https://github.com/kobaltedev/kobalte",
  "status": "prerelease",
  "confidence": ["D", "S"],
  "verified": false,
  "reasons": [
    "Stable line 0.13.14 declares solid-js ^1.9.8 and does not admit Solid 2.",
    "Prerelease 2.0.0-alpha.5 (dist-tag: next) admits Solid 2 and the scan found no removed APIs."
  ],
  "lines": [
    { "solid": 1, "version": "0.13.14", "tag": "latest", "stability": "stable" },
    { "solid": 2, "version": "2.0.0-alpha.5", "tag": "next", "stability": "alpha" }
  ],
  "upstream": { "hasSolid2Work": true, "links": ["https://github.com/kobaltedev/kobalte/..."] },
  "attestations": [],
  "checkedAt": "2026-11-24T06:12:00Z",
  "tested": { "solid": "2.0.3", "solidNext": "2.1.0-next.4", "rules": "2026.11.1", "tool": "0.3.0" },
  "downloadsWeekly": 123456,
  "links": { "npm": "https://www.npmjs.com/package/@kobalte/core", "migration": "https://docs.solidjs.com/migration/from-solid-1" }
}
```

(Illustrative values. Real values come from the pipeline.)

### 11.3 Badges

Shields endpoint schema ✅: `schemaVersion` (always 1), `label`, `message`, `color`; optional `cacheSeconds`, `isError`, `namedLogo`.

```json
{ "schemaVersion": 1, "label": "Solid 2", "message": "ready", "color": "brightgreen", "cacheSeconds": 3600 }
```

Maintainers embed:

```markdown
[![Solid 2](https://img.shields.io/endpoint?url=https://<host>/badges/%40kobalte__core.json)](https://<host>/packages/%40kobalte__core/)
```

Colour must never be the only signal on the site (accessibility); badges also say the status in text.

### 11.4 Registry entry (human-curated input)

```yaml
# registry/packages/kobalte-core.yml
name: "@kobalte/core"
category: ui-components
tracked: true
aliases: []
supersededBy: null          # for renames, for example vite-plugin-solid -> @solidjs/vite-plugin
alternatives: []            # curated suggestions if blocked/unmaintained
notes: null
solidMaintainerContact: null
attestations: []
```

---

## 12. Information shown in the tracker

This section is the catalogue of **what a visitor, a script or an AI assistant can see**, where each field comes from, and how it is worded. Layout and technology are in [section 13](#13-frontend). The underlying files are in [section 11](#11-data-model-and-public-api).

### 12.1 Information inventory

| Surface | Audience | Answers the question |
|---|---|---|
| Overview (home) | Everyone | "How is the ecosystem doing, and is this data fresh?" |
| Package explorer | Library users | "What is the status of the libraries I care about?" |
| Package page | Users and maintainers | "Why this status, what evidence, what do I do next?" |
| Needs help | Contributors | "Where can I help the ecosystem move to Solid 2?" |
| Check my app | App teams | "What blocks my upgrade?" |
| Changes | Followers | "What changed recently?" |
| Health and methodology | Skeptics, maintainers | "Can I trust this, and how does it work?" |
| Badges | Maintainers | "How do I show my status in my README?" |
| JSON API and `llms.txt` | Tools and AI assistants | "How do I read the data programmatically?" |

### 12.2 Overview (home page)

| Element | Content | Source fields |
|---|---|---|
| Headline | Friendly sentence, for example "31 of the top 100 libraries are on solid ground" (counts of `ready` in the top N by downloads) | `status`, `downloadsWeekly` |
| Status breakdown | Counts and percentages for `ready`, `prerelease`, `in-progress`, `blocked`, `unmaintained`, `agnostic`, `unknown`, as a bar with text labels and counts | `status` |
| By category | The same breakdown per category (UI components, routing, data fetching, state, forms, build tools, testing, meta-frameworks, primitives, other) | `category`, `status` |
| Solid versions | Latest stable and `next`, with release dates; "Tested against" with the exact versions used in the last run | `solid.json`, `meta.tested` |
| Data freshness | "Updated 2 hours ago", last successful collect and verify, and a banner if older than 72 hours | `meta.generatedAt`, `lastSuccessfulCollect`, `lastSuccessfulVerify` |
| Biggest blockers | The most-downloaded packages that are `blocked` or `in-progress`, with links | `status`, `downloadsWeekly` |
| Recent changes | The last 10 events (for example "`@scope/pkg` moved to ready") | `events` |
| Coverage | "Tracking 312 packages (84 curated). Discovery is not exhaustive." with a link to add one | `meta.counts` |
| Calls to action | Check my app, add a package, correct a status, help wanted | static |

### 12.3 Package explorer (table)

Every row is one tracked package. All columns are sortable except Notes. Filters and search run client-side over `index.json`.

| Column | Content | Notes |
|---|---|---|
| Package | Name (scoped names in full), family badge if any | Link to package page |
| Status | Text label plus icon (never colour alone) | See [7.1](#71-statuses) |
| Solid 2 version | Lowest version known to support Solid 2 and its channel (`latest`, `next`, `rc`) | Empty for `blocked` |
| Latest version | Newest version overall and release age | Helps spot abandonment |
| Evidence | Compact `D S B T A U` strip with filled/hollow marks | See [12.5](#125-evidence-checklist) |
| Confidence | `declared`, `analysed`, `tested` or `attested` (derived from evidence) | Words, not percentages |
| Downloads | Weekly downloads, bucketed (for example "10k to 100k") | Display only; never used for status |
| Last checked | Relative age with an exact time on hover | Stale marker if past thresholds |
| Upstream | Icon if Solid 2 work exists upstream | Link to the PR or branch |
| Category | One of the categories above | Filterable |

Filters: status (multi-select), category, evidence level present or missing, "stale only", "has upstream work", "no attestation", family, text search by name, keyword or description. Sorts: downloads, recently changed, last checked, name. The table state is stored in the URL so views can be shared. A "download CSV" button exports the filtered view.

### 12.4 Package page

Sections in order:

1. **Header.** Name, status label with confidence, one-line plain-language verdict (for example "No Solid 2 release yet. The latest stable version caps `solid-js` at `^1.9`."), last checked time, links to npm, repository and changelog, and a badge snippet.
2. **Why this status.** The ordered `reasons` list from the engine, each a short sentence with a link to the evidence behind it.
3. **What to do.** A short, rule-based action: use version X with Solid 2; upgrade to prerelease Y at your own risk; subscribe to the upstream issue; consider alternatives (curated); or "contribute here" with the upstream link.
4. **Version lines.** A table of the versions that matter:

| Line | Version | Channel | Stability | Published | Declared Solid range | Peer metadata | Deprecated |
|---|---|---|---|---|---|---|---|
| Solid 1 | 0.13.14 | `latest` | stable | 2025-xx-xx | `^1.9.8` | peer `solid-js` | no |
| Solid 2 | 2.0.0-alpha.5 | `next` | alpha | 2026-xx-xx | `^2.0.0-0` | peer `solid-js` | no |

(Illustrative values. Real values come from the pipeline.)

5. **Evidence checklist** with per-check results and timestamps ([12.5](#125-evidence-checklist)).
6. **Static findings.** Each finding: code (`removed-subpath`, `missing-export`, `type-ownership`, `jsx-removed-syntax`), the specifier or export name, file path inside the package, severity, a replacement hint and a link to the matching migration-guide section. Capped list with a "show all" toggle.
7. **Smoke results.** Import, build and types results as pass, fail or skipped with durations, the truncated error text (escaped text only), and any Solid diagnostic codes with links to Solid's documentation of those codes.
8. **Upstream.** Repository, archived flag, last push, latest release, and the strong and weak Solid 2 signals found, with links and dates.
9. **Attestations.** Who claimed what, for which version, with the evidence link, date and expiry. Expired attestations are shown greyed out as expired.
10. **Maintainer notes and overrides.** Curated notes, supersession ("renamed to X"), alternatives, and any manual override with reason and expiry.
11. **History.** Timeline of status changes with the event reason, from `events.ndjson`.
12. **Family and related.** Siblings in the same family with their statuses.
13. **Provenance.** "Data from npm (2026-11-24 06:12 UTC), GitHub (06:14 UTC). Rules 2026.11.1. Tool 0.3.0. Run 123456789", with a link to the run and to the raw JSON.
14. **Report a problem.** Prefilled link to the correction issue form with the package name and the current status.

### 12.5 Evidence checklist

Each level has a fixed label, a tooltip and a plain-language definition, shown identically everywhere.

| Level | Label | Shown as | Meaning | Freshness window |
|---|---|---|---|---|
| `D` | Declared | "Peer range admits Solid 2" or "caps at Solid 1" | Package metadata says what it supports | 48 h |
| `S` | Static scan | "No removed Solid 1 APIs found in shipped code" or "n findings" | Published code was parsed against the real Solid 2 exports | 7 days |
| `B` | Build or import | "Loads and builds with Solid 2" | The package imported and built in a sandbox | 21 days |
| `T` | Types | "Types compile with Solid 2" | A snippet using the package's API type-checked | 21 days |
| `A` | Attested | "Maintainer reports Solid 2 support" | A named maintainer claims support, with evidence | 90 days |
| `U` | Upstream CI | "Upstream CI tests Solid 2" | A linked upstream workflow runs against Solid 2 | 90 days |

Each entry shows one of: **pass**, **fail**, **not run**, **skipped (reason)** or **expired**, plus the time. The word "verified" is used only when `B` has passed within its window for the tested Solid version. Everything else is described as declared, analysed or attested. No status is ever shown without its evidence.

### 12.6 Status wording and meaning

Statuses are defined in [7.1](#71-statuses). The wording below is what the site displays, so everything stays consistent.

| Status | Label | One-line definition on the site |
|---|---|---|
| `ready` | Ready | A stable release admits Solid 2 and the evidence policy for `ready` is met |
| `prerelease` | Prerelease | Only an alpha, beta or release-candidate line supports Solid 2 |
| `in-progress` | In progress | No Solid 2 release yet, but upstream work is visible |
| `blocked` | Blocked | No Solid 2 support and no visible work |
| `unmaintained` | Unmaintained | Deprecated, archived or no releases for the configured period |
| `agnostic` | Framework-agnostic | Does not depend on Solid APIs, so Solid 2 is not applicable |
| `unknown` | Unknown | Not enough evidence either way, with the reason stated |

Text rules: statuses describe **packages**, not people; use "has not published" rather than "refuses"; never show a status without a date; "unknown" always carries its reason.

### 12.7 Where each displayed field comes from

| Displayed field | Origin | Source ID ([8.2](#82-source-catalogue)) | Evidence |
|---|---|---|---|
| Names, versions, dist-tags, publish dates | npm packument | S1 | `D` |
| Declared Solid range, peer metadata | npm packument | S1 | `D` |
| Deprecation message | npm packument | S1 | `D` |
| Weekly downloads | npm downloads API | S3 | none |
| Category, family, aliases, alternatives, notes | Curated registry | S9 | human |
| Static findings and replacement hints | Scanner plus export surface | S4, S8, S12 | `S` |
| Import, build and types results | Sandbox | S12 | `B`, `T` |
| Diagnostic codes | Sandbox harvest | S12 | `B` |
| Upstream links and activity | GitHub | S5 | none |
| Attestations | Registry and pull requests | S9, S10 | `A`, `U` |
| Status, confidence, reasons, events | Engine | derived | all |
| Solid versions and tested-against | Solid releases | S6 | none |
| Freshness and stale markers | Engine | derived | none |
| Pipeline health | Run reports | derived | none |

### 12.8 Changes feed, health page and methodology

**Changes.** A reverse-chronological list of events: status change (from, to, reason), new tracked package, new Solid release, rules version change, manual override added or expired, and anomaly holds. Each event has a timestamp and links to the package or run. The same data is the Atom feed and `events.json`. Filters by status transition (for example "became ready") and by category.

**Needs help.** A list of high-download packages that are `blocked` or `in-progress`, with the upstream issue or milestone, the replacement hints for the removed APIs found, and a "start here" link to the migration guide. Intended to point contributors at the highest-impact work.

**Health.** Last successful run per workflow, last-run durations, requests per source, `304` hit rate, GitHub rate-limit points used, count of stale records, deferred items, anomalies held, and the age of the last Solid release check. Also lists the current rules, tool and schema versions.

**Methodology.** Status definitions, evidence levels and windows, the exact decision logic, scope rule, source list with dates, limits (dead code, runtime semantics, non-GitHub hosts), the privacy statement from [8.9](#89-what-is-deliberately-not-collected), and a change log of rule versions.

### 12.9 Check my app: what it displays

Input is a `package.json` or a lockfile, parsed in the browser. Output sections:

| Section | Content |
|---|---|
| Summary | Count of Solid-related dependencies by status, and a verdict: "Ready to try", "Blocked by N packages" or "Unknown for N packages" |
| Blocking set | Dependencies with status `blocked`, `in-progress`, `prerelease` or `unknown`, each with current version, the first Solid 2 version if any, and a link |
| Direct versus transitive | Which dependencies you control and which come through other packages |
| Not tracked | Dependencies that depend on Solid but are not in the dataset, with an "add this package" link |
| Suggested order | An ordered upgrade path: first the compiler, build plugin and `solid-js` itself, then libraries that are ready, then prerelease ones |
| Export | Copy as Markdown, download JSON, and in the CLI a non-zero exit code when blockers exist |
| Data age | The dataset timestamp used, so results are reproducible |

### 12.10 Badges and machine-readable outputs

| Output | Content |
|---|---|
| Shields badge | Label `Solid 2`, message equal to the status, colour mapped from the status, `cacheSeconds` of 3600 ([11.3](#113-badges)) |
| `/api/v1/index.json` | One compact row per package: name, status, confidence, Solid 2 version, downloads bucket, category, `checkedAt`, `smokeTarget` and `smokeAt` |
| `/api/v1/packages/<name>.json` | The full record from [11.2](#112-per-package-record-abridged) |
| `/api/v1/meta.json` | Timestamps, counts per status, Solid versions tested, schema, rules and tool versions, anomaly flags |
| `/api/v1/events.json` | Recent status changes |
| `/api/v1/solid.json` | Solid dist-tags and export-surface hashes |
| `/feed.xml` | Atom feed of status changes |
| `/llms.txt` | Plain description of the dataset and field meanings for AI assistants ([Appendix H](#appendix-h--example-llmstxt)) |

### 12.11 What the tracker does not show

- No ratings, rankings of quality, or "best library" lists. Downloads are shown as context, not as merit.
- No individual maintainer profiles, emails or activity metrics. Handles appear only on attestations and corrections that people made in public.
- No unverified claim presented as fact: every statement has a source and a date.
- No raw logs or package-supplied HTML. All package-derived strings are rendered as escaped text.
- No usage analytics, cookies or personalised views.

### 12.12 Example: one package, end to end

For a library whose latest stable version still caps `solid-js` at `^1.9`, with a prerelease `next` build that scans clean and an open upstream pull request:

| Item | Value shown |
|---|---|
| Status | **Prerelease** (confidence: analysed) |
| Verdict | "A prerelease line supports Solid 2. The latest stable version does not." |
| Evidence | `D` pass (prerelease admits Solid 2), `S` pass (0 findings), `B` pass on the prerelease, `T` not run, `A` none, `U` none |
| Upstream | "Open pull request: Solid 2 support, updated 6 days ago" |
| What to do | "Try the `next` build in a branch. Do not ship to production until a stable release or attestation exists." |
| Provenance | "npm 2026-11-24 06:12 UTC, GitHub 06:14 UTC, rules 2026.11.1" |
| Badge | `Solid 2: prerelease` |
| Changes | "2026-11-20: in-progress → prerelease (prerelease 2.0.0-alpha.5 published)" |

(Illustrative example, not real data.)


---

## 13. Frontend

### 13.1 Pages

The full field-by-field content of each page is catalogued in [section 12](#12-information-shown-in-the-tracker); this list is the site map.

- **Home**: headline counts per status, percentage of the top-N by downloads, Solid versions tested, last-updated, data-age banner ([12.2](#122-overview-home-page)).
- **Packages**: filterable, searchable table (status, category, text); sort by downloads or recent change.
- **Package page**: status, version-line table, evidence checklist (`D S B T A U`) with timestamps, reasons, upstream links, "how to fix" hints, badge snippet, history timeline from events.
- **Check my app**: paste/drop `package.json` or a lockfile; client-side.
- **Changes** and **Needs help**: events, Atom feed, and high-impact blockers ([12.8](#128-changes-feed-health-page-and-methodology)).
- **Methodology**: status definitions, evidence levels, the exact rules, known limitations.
- **Contribute and Correct a status**: links to issue forms.
- **Health**: pipeline last success, per-stage durations, count of stale records.

### 13.2 Tech and constraints

- **Astro static output**, minimal client JS (filter/search and check-my-app islands). Pagefind for search ⚠.
- **Dogfooding milestone**: once `@astrojs/solid-js` supports Solid 2 (the fixtures show it does not today), consider re-writing interactive islands with Solid 2. The tracker would then also report on itself. Not required for v1.
- Performance budget (for example < 100 KB JS per page), WCAG 2.2 AA, dark mode, semantic HTML, keyboard navigation, no color-only status.
- **No cookies and no third-party analytics by default.** If usage stats are wanted later, use a privacy-friendly, cookie-less option and disclose it.
- **Output safety**: all package-derived strings are rendered as text. Astro escapes by default; do not use raw-HTML directives for data. A CSP `<meta>` tag is the only option on Pages (no header control), so avoid inline scripts.

---

## 14. Hosting and deployment

### 14.1 Recommendation: GitHub Pages, deployed by Actions

✅ Pages is available for **public repositories on GitHub Free**. Limits that matter:

- Published site ≤ **1 GB**; recommended source repo ≤ 1 GB.
- **Soft bandwidth limit 100 GB/month.**
- **Deployments time out after 10 minutes.**
- Soft **10 builds/hour limit, which does not apply when you build and publish with a custom GitHub Actions workflow** (our case).
- Not for commercial/SaaS use; an open-source, non-commercial tracker is in scope.

Estimated footprint: a few hundred packages × tens of KB of JSON = low tens of MB. Far below limits.

Deployment mechanics: `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`; environment `github-pages` restricted to `main`; HTTPS enforced; optional custom domain (CNAME + `.nojekyll` not needed with an artifact deploy).

### 14.2 Alternatives and fallbacks

| Option | Cost | Use when |
|---|---|---|
| **Cloudflare Pages** | Free tier | PR preview deployments (Pages has none); mirror if GitHub is down; heavy traffic. Cloudflare is a Solid sponsor ✅, which is irrelevant technically but means friendly ground |
| Netlify / Vercel free tiers | Free tiers with terms limits | Check their free-tier terms for open-source use before choosing |
| Self-host (VPS) | Paid | Not recommended |

Because the site is purely static, switching hosts is a deploy-workflow change only.

### 14.3 Environments

- `main` → production Pages.
- Pull requests → CI build with a **built-site artifact** attached for reviewers (or Cloudflare Pages previews if you add them). No secrets exposed to fork PRs.
- `data` branch updates → production rebuild.

---

## 15. Keeping it fresh

The core promise is trustworthy dates. This section is the main defence against rot.

### 15.1 Triggers

This is the policy view. The job-level mechanics (work-set planning, concurrency, failure handling) are in [section 10](#10-automation-and-pipeline-operations), and the sources each trigger reads are in [8.2](#82-source-catalogue).

| Trigger | Cadence | Work | Why |
|---|---|---|---|
| **Solid sentinel** (`sentinel.yml`) | Hourly | Compare dist-tags of `solid-js`, `@solidjs/web`, `@solidjs/signals`, `@solidjs/vite-plugin`; compare the migration-guide page ETag/hash; on change, dispatch `collect` and `verify` for all packages | Updates to Solid itself invalidate prior verification |
| **Collect (light)** | Every 6 h | Packuments, dist-tags, upstream signals; recompute statuses | Most changes are new publishes |
| **Static scan** | Daily, plus on version change | Scan only new package versions | Cheap incremental |
| **Smoke (full)** | Weekly, plus on Solid change | Matrix of smoke tests, top packages first | Costly; cache by tuple |
| **Canary** | Daily | Run against `solid-js@next` only; publish as a separate channel that never changes main statuses | Early warning for maintainers |
| **Rules drift** | Daily | Diff the Solid 2 export surface against the previous snapshot; open an issue if an export is added or removed | Keeps the rule base honest |
| **Watchdog** | Daily | Check `meta.json` age and last successful run; open or update a "pipeline stale" issue | Detects silent failure |
| **Manual / chat-ops** | On demand | `workflow_dispatch`; a maintainer comment such as `/recheck <pkg>` on an issue (restricted to maintainers) | Fast corrections |
| **Maintainer push** (v2) | Event | Repository dispatch/verification of an attestation | Fresher evidence |

### 15.2 Making staleness visible

- Every record has `checkedAt`; the UI shows relative age and a **stale ribbon** after thresholds from `rules/status-policy.yml` (defaults: metadata 48 h, static scan 7 days, smoke 21 days, attestation 90 days).
- A stale `verified` badge **downgrades** to "declared" rather than staying green.
- A site-wide banner appears if no successful full pipeline run in the last 72 hours.
- `meta.json` exposes `generatedAt`, `lastSuccessfulCollect`, `lastSuccessfulVerify`, so third parties can alert on it.

### 15.3 Avoiding the "scheduled workflow silently stops" trap

✅ GitHub **automatically disables scheduled workflows in a public repository after 60 days with no repository activity**, and scheduled workflows are disabled by default on forks.

Mitigations (use more than one):

1. Normal project activity (Dependabot PRs, merged corrections, releases) counts as activity. Do not depend on this alone.
2. A **heartbeat commit** to the `data` branch each run. ⚠ GitHub does not document whether bot commits made with `GITHUB_TOKEN` reset the 60-day timer; **test this in M0** (disable/observe) before relying on it.
3. The **watchdog** workflow plus an external dead-man's-switch (a free uptime/cron service that alerts if `meta.json` stops changing) so a disabled scheduler is noticed.
4. A documented runbook: `gh workflow enable <workflow>` and a calendar reminder.
5. An optional external scheduler that calls `workflow_dispatch` via a fine-grained, repository-scoped token. This adds a secret, so use it only if mitigation 2 fails the test.

### 15.4 Efficiency and rate limits

- Cache by `(package@version, solidVersion, rulesVersion, toolVersion)`; skip unchanged packages using ETags and `time.modified`.
- GitHub: batch with GraphQL; stay well under the **1,000 requests/hour/repository** `GITHUB_TOKEN` limit ✅; avoid the stricter search endpoints; respect secondary limits (concurrency ≤ 100 shared; avoid bursts) ✅.
- npm: modest concurrency (for example 5), exponential backoff with jitter, honour `Retry-After`.
- ⚠ Standard GitHub-hosted runners are free for public repositories; confirm against current billing docs. Even so, budget run time (for example full smoke < 60 minutes with sharding).

### 15.5 Ecosystem churn

- **Renames/supersession**: `registry` field `supersededBy`; npm `deprecated` messages are parsed for "moved to / renamed to" hints and flagged for human review.
- **New packages**: the discovery job proposes candidates as pull requests (never auto-adds) so humans curate scope.
- **Library status changes** produce **events** (`ready → blocked` is notable), written to `events.json` and the Atom feed.

### 15.6 Retirement plan

If more than ~90% of the tracked top-100 packages are `ready` and activity falls, switch to maintenance mode: monthly runs, a banner, and eventually a read-only archive of the dataset in the `data` branch tagged by date.

---

## 16. Open source governance and community files

### 16.1 License

| Asset | License | Notes |
|---|---|---|
| Code | **MIT** | Matches Solid's own MIT licensing ✅, maximises reuse in the ecosystem. Apache-2.0 is the alternative if you want an explicit patent grant |
| Data and documentation | **CC BY 4.0** (`LICENSE-DATA`) | Requires attribution link back; CC0 is the permissive alternative. Pick one deliberately, because changing later is hard |
| Code of Conduct text | CC BY-SA 4.0 | Inherited from the Contributor Covenant ✅; keep the attribution |

Add `package.json` `license` fields and SPDX identifiers.

### 16.2 `CODE_OF_CONDUCT.md`

- Adopt **Contributor Covenant 3.0** (released July 2025, CC BY-SA 4.0) ✅. It has a customisable template and an "addressing and repairing harm" enforcement approach ✅.
- Customise: reporting contact (a dedicated alias monitored by **at least two** people, because GitHub's private vulnerability reporting is for security only), response target (for example acknowledge within 3 days), and scope (repository, issues, discussions, any official chat).
- Solid's community also has its own code of conduct page ✅; mention that people active in both spaces are expected to follow both.

### 16.3 `CONTRIBUTING.md` (outline)

1. **Ways to help**: correct a status, add a package, improve rules, fix bugs, docs, accessibility, translations (later).
2. **How statuses are decided**: link to `METHODOLOGY.md`; **evidence beats opinion**; maintainers of a package get priority to correct their own entry.
3. **Correcting a status**: use the issue form; include links; a maintainer replies within 7 days (target).
4. **Adding a package**: YAML in `registry/packages/`; schema validated by CI; criteria for inclusion.
5. **Development setup**: Node version, pnpm install (`--ignore-scripts`), `pnpm test`, `pnpm dev`, running the engine on fixtures, running a single-package scan locally.
6. **Branches and PRs**: fork and PR; Conventional Commits; small PRs; CI must pass; CODEOWNERS review for `.github/**`, `rules/**`, `packages/engine/**`.
7. **Sign-off**: **DCO** (`Signed-off-by`) rather than a CLA, to keep the bar low. Enforce with a DCO check.
8. **Changes to methodology** need an RFC-style issue and two maintainer approvals (they alter many statuses at once).
9. **AI-assisted contributions**: allowed; the author is responsible for correctness and licence compatibility; no bulk unreviewed automated PRs.
10. **Security issues** go to `SECURITY.md`, not public issues.

### 16.4 `SECURITY.md` (policy)

- **Reporting**: GitHub **private vulnerability reporting** enabled on the repository; fallback security email.
- **Scope (in)**: remote code execution or sandbox escape in the verification pipeline, secret or token exposure, XSS or injection via package-derived data, supply-chain weaknesses in workflows, data-poisoning via forged attestations or inbound dispatches, vulnerabilities in the CLI/site.
- **Out of scope**: vulnerabilities in third-party packages that the tracker merely lists; disputes about a status (use the correction form).
- **Targets**: acknowledge within 3 business days; triage within 7 days; coordinated disclosure, default 90 days or sooner once fixed.
- **Supported versions**: `main`, the latest published CLI, and the current data schema.
- Safe-harbour language for good-faith research; credit in advisories; use GitHub Security Advisories (and CVEs where applicable).
- Full template in [Appendix G](#appendix-g--securitymd-template).

### 16.5 Other community files

- **`GOVERNANCE.md`**: roles (Maintainer, Triager, Contributor), lazy-consensus decisions, a **bus-factor ≥ 2** rule (add a second maintainer early), succession, neutrality statement (no paid placement, sponsors cannot influence statuses), and an option to move to a community organisation if invited.
- **`MAINTAINERS.md`**, **`CODEOWNERS`**, **`SUPPORT.md`** (where to ask what), **`PULL_REQUEST_TEMPLATE.md`**, issue forms (`add-package`, `correct-status`, `bug`) with blank issues disabled and a link to Discussions/Discord.
- **README**: purpose, live link, how statuses work in 5 lines, badge snippet, how to run locally, links to the policies, and a clear **"community project, not affiliated with the Solid team"** line. ✅ Solid publishes a "Media & Brand" page; read it before using the Solid name or logo. Prefer a descriptive name such as "…for SolidJS", not an implication of officialness.
- **Naming note**: "Solid" is also the name of an unrelated decentralized-web project (my searches returned its libraries). Use "SolidJS" in titles, descriptions and the repo topic list so people and search engines can tell them apart.
- **Labels**: `status:blocked`, `status:in-progress`, `good first issue`, `help wanted`, `methodology`, `pipeline`, `security`, `data-correction`.
- **Fairness policy** (in METHODOLOGY): wording rules, right of reply, no automatic outreach spam. Do not open issues on other projects automatically. If a maintainer wants notifications, they opt in via the registry.

---

## 17. Repository security and CI/CD

### 17.1 Repository settings checklist

**Branch/ruleset protection (`main`)**: require PRs; require ≥ 1 approving review (≥ 2 for methodology/workflow changes); require CODEOWNERS review; dismiss stale approvals; require status checks (CI, CodeQL, dependency review, workflow lint, DCO); require conversation resolution; linear history; block force pushes and deletion. Restrict who can push to `data` to the workflow identity only.

**Security features to enable** (all free on public repos ✅ unless noted):

- Dependency graph, **Dependabot alerts**, **Dependabot security updates**
- **Secret scanning** and **push protection**
- **Code scanning** (CodeQL) and **private vulnerability reporting**
- **2FA required** for every maintainer; consider a maintainer-only GitHub organisation or team for permissions

**Actions settings**: default `GITHUB_TOKEN` to **read-only**; allow only GitHub-owned and explicitly allowlisted actions; require **approval for all outside collaborators'** workflow runs; prohibit Actions from approving PRs; Pages environment `github-pages` limited to `main`.

### 17.2 Dependabot

- Ecosystems: `npm` (pnpm lockfiles are handled under this ecosystem) for `/` (and `/site` if separate), and `github-actions` for `/`. ✅ GitHub Actions is a supported Dependabot ecosystem and a `directory` of `/` covers `.github/workflows`.
- Weekly schedule, **grouped** updates to reduce PR noise (dev-dependency minor/patch group; separate PR for majors).
- **Cooldown** ✅: Dependabot applies a default 3-day cooldown to version updates and supports `cooldown` with `default-days`, `semver-major-days`, `semver-minor-days`, `semver-patch-days`, `include`, `exclude`. It does **not** apply to security updates. Use a longer cooldown (for example 7 days) to avoid freshly published malicious versions; security updates still arrive immediately.
- Dependabot **alerts are configured in repository settings**, not in `dependabot.yml` ✅.
- Auto-merge: none by default; require review (maintainers may auto-merge patch updates for dev dependencies only, after CI).
- Full file in [Appendix E](#appendix-e--dependabotyml).

### 17.3 Workflow inventory

| Workflow | Trigger | Permissions | Purpose |
|---|---|---|---|
| `ci.yml` | PR, push to `main` | `contents: read` | Lint, typecheck, unit tests, schema validation of `registry/` and fixtures, build site, link check |
| `codeql.yml` | PR, push, weekly | `security-events: write`, `contents: read` | JavaScript/TypeScript code scanning |
| `dependency-review.yml` | PR | `contents: read` | Fail on vulnerable or disallowed-license dependency changes |
| `scorecard.yml` | Weekly, push to `main` | `security-events: write`, `id-token: write` | OpenSSF Scorecard (supply-chain posture) and README badge |
| `workflow-lint.yml` | PR touching workflows | `contents: read` | `actionlint` plus a workflow static analyser such as `zizmor` (injection, permissions, unpinned actions, credential persistence) |
| `sentinel.yml` | Hourly | `actions: write` (dispatch only) | Detect Solid releases and migration-guide changes, dispatch pipeline |
| `collect.yml` | Every 6 h, dispatch | scan job `contents: read`; commit job `contents: write` | Collect and static scan → engine → commit to `data` |
| `verify.yml` | Weekly, dispatch | `contents: read` | Sandboxed smoke-test matrix |
| `deploy.yml` | Push to `main`, after successful `collect`, dispatch | build `contents: read`; deploy `pages: write`, `id-token: write` | Build and deploy the site |
| `watchdog.yml` | Daily | `issues: write` | Freshness check; keeps the scheduler honest |
| `release.yml` (v2) | Tag | `id-token: write`, `contents: read` | Publish CLI/Action to npm with **trusted publishing/provenance** ⚠ verify current npm trusted-publishing setup |

### 17.4 Workflow hardening rules (apply to all)

1. **Pin every third-party action to a full commit SHA** with a version comment; let Dependabot update the pins. ✅ (A widely cited 2025 incident, in which a popular action was maliciously updated, compromised many unpinned dependants.)
2. **Top-level `permissions: {}`** (deny), then grant the minimum per job.
3. `actions/checkout` with **`persist-credentials: false`** except in the single job that pushes to `data`.
4. **Never use `pull_request_target`** to build or run PR code. Do not check out PR head with elevated tokens.
5. **No untrusted values in `run:` expressions**: pass `${{ matrix.* }}`, issue titles and branch names via `env:`.
6. **Concurrency groups** for `collect`, `verify` and `pages`; `cancel-in-progress: false` for data-writing workflows.
7. **`timeout-minutes`** on every job.
8. **`npm`/`pnpm` installs**: lockfile enforced (`--frozen-lockfile`), `--ignore-scripts` in all jobs that touch package-under-test code (and in CI by default).
9. **No long-lived secrets**: only `GITHUB_TOKEN` and OIDC. If higher rate limits are ever needed, use a GitHub App installation token rather than a personal token.
10. Run **actionlint** and a security linter on workflow changes, and run **Scorecard** weekly to catch regressions.
11. Optionally publish **artifact attestations** for the generated dataset so consumers can verify it came from this repository's workflow. ⚠ confirm availability and cost for public repos.

### 17.5 Data integrity and abuse resistance

- JSON Schema validation on every stage boundary, with maximum string lengths and array sizes; use null-prototype objects when parsing package-controlled JSON (defends against `__proto__` and constructor tricks).
- Reject or sanitise package names, versions and URLs; only allow `https` links; render external links with `rel="noopener noreferrer"`.
- Attestations: allowlist hosts for evidence URLs; require repository-ownership checks via the GitHub API.
- Rate-limit and size-limit every outbound fetch and decompression.
- Moderation: any maintainer can set a record to "under review" with a reason during disputes.

---

## 18. Quality strategy

- **Unit tests for the engine** with golden fixtures drawn from [section 2.3](#23-snapshot-of-current-state-used-later-as-test-fixtures) (open range, `^1` cap, `^1 || ^2`, prerelease-only line, rename, removed imports, deprecated). Property tests for semver edge cases (`includePrerelease`, `0.x` ranges, hyphen ranges, `workspace:`/`npm:` aliases, missing peer).
- **Scanner tests** with synthetic tarballs: dual-package exports maps, conditional exports, source-shipped JSX, large/hostile archives (zip bombs, path traversal, huge files, invalid UTF-8).
- **Hand-verified ground truth set** (for example 30 packages checked manually). Track precision and recall of `ready`/`blocked` in CI on every rule change, and publish the numbers in METHODOLOGY.
- **Snapshot tests** of generated JSON and badge output; schema-compat tests across `schemaVersion`s.
- **End-to-end dry run** in CI against a recorded set of registry responses (no network), plus a periodic live run.
- **Accessibility checks** (axe) on built pages.
- **Failure-mode tests**: registry outage, GitHub rate limit, partial failure (keep the last good record and mark it stale, never delete).

---

## 19. Roadmap and milestones

Estimates are rough, for one part-time maintainer.

| Milestone | Scope | Exit criteria | Rough effort |
|---|---|---|---|
| **M0 — Foundations and spikes** | Repo, license, CoC, CONTRIBUTING, SECURITY, governance, issue forms, CI skeleton, Dependabot, CodeQL, Scorecard, rulesets. **Spikes** for the ⚠ items: heartbeat-commit vs 60-day disable, Harden-Runner egress block, ecosyste.ms/deps.dev dependents, Pagefind+Astro, 30-minute ecosystem search ([2.4](#24-limits-of-this-research)), plus the collection spikes in [8.3](#83-source-by-source-mechanics): abbreviated npm metadata and `peerDependenciesMeta`, npm search page size, bulk downloads endpoint, GraphQL batch cost, and name availability checks ([1.1](#11-name-and-branding)) | All security features on; CI green on an empty project; spike results recorded in `docs/ADRs/` | 1–3 days |
| **M1 — Collector + engine (declared evidence)** | Registry schema, npm collector with ETag caching, provenance envelope and fingerprints ([section 8](#8-data-collection)), `plan` job ([10.2](#102-work-set-planning)), status engine with fixtures, `data` branch commit job, `meta.json` | 50 curated packages with correct `D`-level statuses; engine tests green; scheduled collect runs for a week | ~1 week |
| **M2 — Site MVP + deploy** | Astro site with the pages catalogued in [section 12](#12-information-shown-in-the-tracker) (home, table, package page, methodology, health), `/api/v1`, Pages deploy | Live on GitHub Pages; links work; data-age banner works; Lighthouse/axe pass | ~1 week |
| **M3 — Static scan + badges + sentinel** | Export-surface builder, tarball scanner, removed-API hints, Shields endpoints, Solid sentinel, rules-drift, watchdog | Scanner matches ground truth ≥ target on the hand-verified set; sentinel triggers a rerun on a Solid dist-tag change | 1–2 weeks |
| **M4 — Smoke verification + canary** | Sandboxed matrix (import/build/types), canary vs `next`, evidence UI, stale downgrades | Isolation reviewed (no secrets, egress policy); `verified` flag live; canary channel published | 1–2 weeks |
| **M5 — Check-my-app + CLI** | Lockfile parsers, web tool, `npx solid-ground check`, Markdown export | Parses npm/pnpm/yarn lockfiles; blockers list matches dataset; zero-upload verified | 1–2 weeks |
| **M6 — Community + push model** | Attestation flow, reusable Action, "needs help" view, outreach to Solid maintainers, Atom feed | At least 3 maintainers have claimed/corrected entries; docs for maintainers | ongoing |
| **M7 — Sustain** | Quarterly rule review, dependency hygiene, handover/org move if invited | Second maintainer onboarded; runbook exercised | ongoing |

**MVP = M0–M2 plus the sentinel**, which already beats the status quo (a structured, dated, public view).

**Success measures**: packages tracked; share with `verified` status; median record age under 24 h; ground-truth precision/recall; number of maintainer-attested entries; badge adoption; correction turnaround time; weekly CLI use; and (qualitatively) whether the Solid team links to it.

---

## 20. Risks and mitigations

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| R1 | Scheduled workflows are disabled after 60 days of inactivity ✅ | Medium / High | Heartbeat test (M0), watchdog, external dead-man's-switch, runbook ([15.3](#153-avoiding-the-scheduled-workflow-silently-stops-trap)) |
| R2 | Running untrusted package code in CI | Medium / High | Per-package ephemeral jobs, no secrets, egress allowlist, `--ignore-scripts`, timeouts, JSON-only output, privilege separation ([9.3](#93-stage-c--sandboxed-smoke-tests)) |
| R3 | False positives/negatives upset maintainers | High / Medium | Evidence display, "unverified" wording, right of reply, correction SLA, published precision/recall |
| R4 | Static analysis cannot see runtime semantics | High / Medium | Confidence tiers; `verified` needs build/types smoke; maintainer attestations and opt-in push model |
| R5 | Solid itself changes quickly (many RCs) | Medium / Medium | Sentinel, dynamic export surface, canary channel, rules-drift alerts |
| R6 | API limits or blocking (npm, GitHub) | Medium / Medium | Caching, ETags, GraphQL batching, backoff, graceful degradation (keep last good, mark stale) |
| R7 | Incomplete discovery | High / Medium | State coverage openly; request form; curated families; evaluate dependents APIs |
| R8 | GitHub Pages limits or policy | Low / Low | Footprint is tiny; fallback to Cloudflare Pages |
| R9 | Maintainer burnout or bus factor of one | Medium / High | Automation-first design, low-ops architecture, second maintainer early, governance doc, retirement plan |
| R10 | Perceived as "official" or brand misuse | Medium / Medium | Clear disclaimer, descriptive name, read Media & Brand page, ask Solid team |
| R11 | Supply-chain attack on the tracker's own dependencies/actions | Medium / High | SHA pinning, Dependabot with cooldown, Scorecard, CodeQL, dependency review, minimal dependencies |
| R12 | Data poisoning through attestations or inbound events | Low / Medium | Reviewed PRs only in v1; verify claims against GitHub API in v2; expiry on attestations |
| R13 | Name collision with the unrelated "Solid" decentralized-web project | Medium / Low | Use "SolidJS" everywhere |
| R14 | A bad run publishes wrong statuses at scale (registry outage, harness bug) | Medium / High | Control packages, anomaly gate, schema gates, never overwrite good data with errors, easy rollback of the `data` branch ([8.7](#87-data-quality-controls), [10.5](#105-failure-handling-and-degradation)) |

---

## 21. Open decisions

1. **Name and home**: the proposed name is **Solid Ground** ([1.1](#11-name-and-branding)); confirm availability (npm, GitHub, domain, trademark search) in M0 and fall back to an alternative if needed. Personal account first or a new organisation? Proposing a move to `solidjs-community` later is possible (that org hosts community-managed projects ✅), but starting independently needs no permission and is fine.
2. **Data licence**: CC BY 4.0 (recommended) vs CC0.
3. **Scope threshold** for tracked packages (downloads cut-off vs curated only).
4. **Domain**: default `github.io` URL vs custom domain.
5. **Dogfooding**: build islands with Solid 2 from day one or wait for ecosystem readiness.
6. **Outreach plan**: introduce the project in Discord `#next` and in a GitHub discussion on the Solid repository **after** the M2 demo, asking about existing efforts and status wording.
7. **Analytics**: none (recommended) vs privacy-friendly.
8. **Maintainer count**: who is the second maintainer and the second CoC contact?

---

## 22. References

Official and ecosystem:

- Solid homepage: https://www.solidjs.com/
- Solid docs, "From Solid 1.x": https://docs.solidjs.com/migration/from-solid-1
- Solid docs, "Solid for AI tools": https://docs.solidjs.com/guides/ai-tools
- Solid 2.0 RC announcement: https://github.com/solidjs/solid/discussions/2995
- Solid X post (library readiness at RC): https://x.com/solid_js/status/2087958309160780182
- Solid 2.0 stable coverage (AlternativeTo): https://alternativeto.net/news/2026/11/solid-2-0-reaches-stable-after-five-years-rebuilding-async-into-its-reactive-core/
- SolidStart v2 (targets Solid 1): https://www.infoq.com/news/2026/09/solid-start-v2/
- Solid community org: https://github.com/solidjs-community
- Solid Primitives migration PRs (examples): https://github.com/solidjs-community/solid-primitives/pull/907 , /pull/934
- Kobalte roadmap note (npm page snapshot): https://socket.dev/npm/package/@kobalte/core/overview/2.0.0-alpha.1

Existing migration tooling:

- https://github.com/devagrawal09/solid-codemod
- https://github.com/solidjs-community/solid-codemod
- https://github.com/solidjs-community/solid-migration-assistant
- https://github.com/rrjanbiah/react2solid
- https://github.com/yellowsink/solid-reactor
- https://github.com/swordev/suid
- https://github.com/one-aalam/awesome-solid-js

Evidence of ad hoc tracking and misleading peer ranges:

- https://github.com/hyperscaleav/omniglass/issues/2290
- https://github.com/shiguri-01/mmtypst/issues/5
- https://github.com/tomsjansons/beghu/issues/43
- https://github.com/urql-graphql/urql/discussions/3917
- https://github.com/TanStack/devtools/releases/tag/@tanstack%2Fdevtools-utils@0.7.2

Platform documentation:

- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Disabling scheduled workflows (60-day rule): https://docs.github.com/actions/managing-workflow-runs/disabling-and-enabling-a-workflow
- REST API rate limits (`GITHUB_TOKEN` 1,000/hour/repo): https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- Actions limits (256-job matrix cap): https://docs.github.com/en/actions/reference/actions-limits
- Dependabot options (cooldown, groups): https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference
- npm registry API: https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md
- deps.dev API: https://github.com/google/deps.dev
- Shields endpoint badge: https://shields.io/badges/endpoint-badge
- Contributor Covenant 3.0 announcement: https://ethicalsource.dev/blog/contributor-covenant-3
- StepSecurity Harden-Runner and secure-workflows: https://github.com/step-security/secure-workflows
- OpenSSF Scorecard Action: https://github.com/ossf/scorecard-action

---

## 23. Appendices

### Appendix A — Issue form: correct a status

```yaml
# .github/ISSUE_TEMPLATE/correct-status.yml
name: Correct a package status
description: Tell us a status is wrong or out of date. Evidence helps us fix it faster.
labels: ["data-correction"]
body:
  - type: input
    id: package
    attributes:
      label: npm package name
      placeholder: "@scope/name"
    validations:
      required: true
  - type: dropdown
    id: relationship
    attributes:
      label: Your relationship to the package
      options: [Maintainer, Contributor, User, Other]
    validations:
      required: true
  - type: dropdown
    id: claim
    attributes:
      label: What should the status be?
      options: [ready, prerelease, in-progress, blocked, unmaintained, agnostic, I am not sure]
    validations:
      required: true
  - type: textarea
    id: evidence
    attributes:
      label: Evidence
      description: Links to a release, CI run, PR, or issue. Please paste links, not screenshots.
    validations:
      required: true
  - type: checkboxes
    id: coc
    attributes:
      label: Code of Conduct
      options:
        - label: I agree to follow this project's Code of Conduct
          required: true
```

### Appendix B — `.github/ISSUE_TEMPLATE/config.yml`

```yaml
blank_issues_enabled: false
contact_links:
  - name: Security vulnerability
    url: https://github.com/OWNER/solid-ground/security/advisories/new
    about: Report privately. Do not open a public issue.
  - name: Questions and ideas
    url: https://github.com/OWNER/solid-ground/discussions
    about: Ask questions or propose changes to the methodology here.
```

### Appendix C — Status policy (`rules/status-policy.yml`)

```yaml
version: "2026.11.1"
staleness:
  metadataHours: 48
  staticScanDays: 7
  smokeDays: 21
  attestationDays: 90
unmaintainedAfterMonths: 18
upstreamPatterns:
  branches: ["solid-2", "solid2", "v2", "next"]
  titleRegex: "solid(\\s|-)?(js)?\\s*2|solid-js@2|solid 2\\.0"
solidEntryPoints: ["solid-js", "@solidjs/web"]
removedSubpaths:
  - solid-js/web
  - solid-js/store
  - solid-js/h
  - solid-js/html
  - solid-js/universal
  - solid-js/jsx-runtime
  - solid-js/jsx-dev-runtime
```

### Appendix D — Workflow skeletons

Pin all actions to full commit SHAs in the real files (`<sha>` below are placeholders). Versions are illustrative.

#### D.1 `collect.yml` (privilege-separated)

```yaml
name: collect
on:
  schedule:
    - cron: "17 */6 * * *"
  workflow_dispatch:
concurrency:
  group: collect
  cancel-in-progress: false
permissions: {}

jobs:
  scan:                       # handles untrusted package contents: read-only, no secrets
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<sha>   # v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@<sha> # v4
        with:
          node-version-file: .nvmrc
      - run: corepack enable && pnpm install --frozen-lockfile --ignore-scripts
      - run: pnpm --filter collector run collect --out collected.json
        env:
          GITHUB_TOKEN: ${{ github.token }}     # read-only token for API calls
      - run: pnpm --filter scanner run scan --in collected.json --out scan.json
      - uses: actions/upload-artifact@<sha> # v4
        with:
          name: scan-results
          path: |
            collected.json
            scan.json
          retention-days: 3

  commit:                     # privileged: validates JSON, never touches package code
    needs: scan
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write         # pushes to the data branch only
    steps:
      - uses: actions/checkout@<sha>   # v4
        with:
          persist-credentials: false
      - uses: actions/checkout@<sha>   # v4
        with:
          ref: data
          path: data
          persist-credentials: true    # needed to push; scoped to this job
      - uses: actions/download-artifact@<sha> # v4
        with:
          name: scan-results
      - uses: actions/setup-node@<sha> # v4
        with:
          node-version-file: .nvmrc
      - run: corepack enable && pnpm install --frozen-lockfile --ignore-scripts
      - run: pnpm --filter engine run build-data --collected collected.json --scan scan.json --out data
      - name: Validate schema, then commit
        run: |
          pnpm --filter schema run validate data
          cd data
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A
          git diff --cached --quiet || git commit -m "data: update $(date -u +%FT%TZ)"
          git push origin data
```

#### D.2 `verify.yml` (sandboxed matrix)

```yaml
name: verify
on:
  schedule:
    - cron: "41 3 * * 0"
  workflow_dispatch:
permissions: {}

jobs:
  plan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      matrix: ${{ steps.plan.outputs.matrix }}
    steps:
      - uses: actions/checkout@<sha>   # v4
        with:
          ref: data
          persist-credentials: false
      - id: plan
        run: node -e "/* emit JSON matrix of {pkg,version,solid}, max 256 entries per shard */" >> "$GITHUB_OUTPUT"

  smoke:
    needs: plan
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read          # nothing else, no secrets
    strategy:
      fail-fast: false
      max-parallel: 8
      matrix:
        include: ${{ fromJSON(needs.plan.outputs.matrix) }}
    steps:
      - uses: step-security/harden-runner@<sha>   # restrict egress, see its docs for syntax
        with:
          egress-policy: block
          allowed-endpoints: >
            registry.npmjs.org:443
            github.com:443
      - uses: actions/checkout@<sha>   # v4 (tools only)
        with:
          ref: main
          persist-credentials: false
      - uses: actions/setup-node@<sha> # v4
        with:
          node-version-file: .nvmrc
      - run: corepack enable && pnpm install --frozen-lockfile --ignore-scripts
      - name: Smoke test (values passed via env, never interpolated into the script)
        run: node packages/smoke/bin/smoke.mjs --pkg "$PKG" --version "$VER" --solid "$SOLID" --out result.json
        env:
          PKG: ${{ matrix.pkg }}
          VER: ${{ matrix.version }}
          SOLID: ${{ matrix.solid }}
      - uses: actions/upload-artifact@<sha> # v4
        with:
          name: result-${{ strategy.job-index }}
          path: result.json
          retention-days: 3
```

#### D.3 `sentinel.yml`

```yaml
name: sentinel
on:
  schedule:
    - cron: "7 * * * *"
  workflow_dispatch:
permissions: {}

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      actions: write          # only to dispatch other workflows
      contents: read
    steps:
      - uses: actions/checkout@<sha>   # v4
        with:
          ref: data
          persist-credentials: false
      - name: Compare Solid dist-tags and docs page ETag with data/solid.json
        id: diff
        run: node tools/sentinel.mjs >> "$GITHUB_OUTPUT"      # sets changed=true|false
      - name: Dispatch pipeline on change
        if: steps.diff.outputs.changed == 'true'
        run: |
          gh workflow run collect.yml --repo "$GITHUB_REPOSITORY"
          gh workflow run verify.yml  --repo "$GITHUB_REPOSITORY"
        env:
          GH_TOKEN: ${{ github.token }}
```

#### D.4 `deploy.yml`

```yaml
name: deploy
on:
  push:
    branches: [main]
  workflow_run:
    workflows: [collect]
    types: [completed]
  workflow_dispatch:
concurrency:
  group: pages
  cancel-in-progress: false
permissions: {}

jobs:
  build:
    if: github.event_name != 'workflow_run' || github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<sha>   # v4
        with:
          ref: main
          persist-credentials: false
      - uses: actions/checkout@<sha>   # v4
        with:
          ref: data
          path: data
          persist-credentials: false
      - uses: actions/setup-node@<sha> # v4
        with:
          node-version-file: .nvmrc
      - run: corepack enable && pnpm install --frozen-lockfile --ignore-scripts
      - run: pnpm --filter site run build
      - uses: actions/configure-pages@<sha>        # v5
      - uses: actions/upload-pages-artifact@<sha>  # v3
        with:
          path: site/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@<sha>           # v4
```

#### D.5 `ci.yml`

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@<sha>   # v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@<sha> # v4
        with:
          node-version-file: .nvmrc
      - run: corepack enable && pnpm install --frozen-lockfile --ignore-scripts
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm --filter schema run validate registry fixtures   # registry and fixtures match JSON Schema
      - run: pnpm --filter site run build
```

### Appendix E — `dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    cooldown:
      default-days: 7
      semver-major-days: 14
    groups:
      dev-dependencies:
        dependency-type: "development"
        update-types: ["minor", "patch"]
      production-dependencies:
        dependency-type: "production"
        update-types: ["minor", "patch"]
    labels: ["dependencies"]
    commit-message:
      prefix: "chore(deps)"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    cooldown:
      default-days: 7
    groups:
      actions:
        patterns: ["*"]
    labels: ["dependencies", "ci"]
    commit-message:
      prefix: "chore(ci)"
```

Remember: Dependabot **alerts** and **security updates** are turned on in repository settings, not in this file. The cooldown applies to version updates only, not to security updates.

### Appendix F — `CODEOWNERS`

```text
# Default
*                       @OWNER/maintainers

# Changes here alter many statuses or the trust boundary: require maintainer review
/.github/**             @OWNER/maintainers
/rules/**               @OWNER/maintainers
/packages/engine/**     @OWNER/maintainers
/packages/scanner/**    @OWNER/maintainers
/packages/smoke/**      @OWNER/maintainers
/SECURITY.md            @OWNER/maintainers
/CODE_OF_CONDUCT.md     @OWNER/maintainers
```

### Appendix G — `SECURITY.md` template

```markdown
# Security Policy

## Supported versions
Only `main`, the latest published CLI release, and the current data schema receive security fixes.

## Reporting a vulnerability
Please report privately using GitHub's "Report a vulnerability" button on the Security tab.
If that is not possible, email <security-contact> (monitored by at least two maintainers).
Do not open a public issue.

We aim to acknowledge reports within 3 business days and to triage within 7 days.
We follow coordinated disclosure with a default window of 90 days, sooner once a fix ships.

## In scope
- Code execution or sandbox escape in the verification pipeline
- Token or secret exposure; weaknesses in workflows or supply chain
- XSS or injection through package-derived data
- Forged attestations, poisoned data, or tampering with published datasets
- Vulnerabilities in the CLI or website

## Out of scope
- Vulnerabilities in third-party packages that this project only lists
- Disagreements about a package's status (use the "Correct a package status" form)
- Findings that need physical access or social engineering of maintainers

## Safe harbour
Good-faith research that follows this policy will not be pursued. Please avoid privacy violations,
service degradation, and accessing data that is not yours.

## Credit
We credit reporters in the advisory unless you ask us not to.
```

### Appendix H — Example `llms.txt`

```text
# Solid Ground: SolidJS 2.0 ecosystem compatibility data
> Community-maintained dataset describing which npm packages work with SolidJS 2.0.
> Not an official SolidJS project. Data is CC BY 4.0.

- Index of tracked packages: /api/v1/index.json
- Per-package records: /api/v1/packages/<name>.json (scoped names use "__")
- Methodology and status definitions: /methodology/
- Always check meta.json for generatedAt before trusting a status; stale records are flagged.
```
