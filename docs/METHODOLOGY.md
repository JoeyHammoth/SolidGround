# Methodology

Solid Ground publishes **what is known, how it is known, and when it was last
checked**. This page is the contract. If a status cannot be reproduced from the
rules below, it is a bug.

## 1. The question

> Does this package work with SolidJS 2, on which version, and what is the
> evidence?

The scope is npm packages that depend or peer on `solid-js` or `@solidjs/*`.
Discovery is not exhaustive. The site says how many packages are tracked, and
anyone may request an addition.

## 2. Statuses

| Status | Definition |
|---|---|
| `ready` | A stable release admits Solid 2 and the evidence policy is met. |
| `prerelease` | Only an alpha, beta, rc or `next` line admits Solid 2. |
| `in-progress` | No Solid 2 release yet, but upstream work is visible. |
| `blocked` | No Solid 2 support and no visible upstream work. |
| `unmaintained` | Deprecated, archived, or no release inside the policy window (18 months). |
| `agnostic` | No `solid-js` dependency or peer range; excluded from percentages. |
| `unknown` | Not enough evidence; always shown with a reason. |

Statuses are about **packages, not people**. Wording rules: "has not published",
never "refuses"; no status without a date; "unknown" always carries its reason;
no shaming metaphors.

Colour is never the only signal: every status has a text label.

## 3. Evidence levels

| Level | Source | Strength | Freshness |
|---|---|---|---|
| `D` Declared | npm `peerDependencies` / `dependencies` ranges and dist-tags | Weak. Ranges can mislead. | 48 h |
| `S` Static | Import analysis of published code against the real Solid 2 export surface | Medium | 7 days |
| `B` Build/import | Sandboxed install, import and build with Solid 2 | Medium-strong | 21 days |
| `T` Types | A TypeScript consumer snippet compiles against Solid 2 types | Medium-strong | 21 days |
| `A` Attested | Named maintainer claim with a public evidence link | Strong, human-asserted | 90 days |
| `U` Upstream CI | The library's own CI tests against Solid 2 | Strongest | 90 days |

`ready` requires at least `D + S`, or a passing `B` check when a scan cannot run.
The UI calls a record **verified** only when `B` has passed inside its window for
the tested Solid version. Everything else is **declared**, **analysed** or
**attested** — never "verified".

## 4. Decision logic

Inputs: every retained version, its dist-tag, its declared `solid-js` range, the
static scan result per version, smoke results, upstream signals, attestations,
deprecation and archive flags.

1. If the package does not depend on Solid APIs → `agnostic`.
2. A line **admits** Solid 2 when its range satisfies the tested stable or
   `next` Solid version with `includePrerelease: true`. Open ranges (`*`) admit
   Solid 2 but count only as `D`.
3. A line is **clean** when the static scan found no removed subpath, missing
   export or type-ownership error reachable from its entry points.
4. Highest matching stable line that admits and is not dirty → `ready`.
5. Otherwise a prerelease line that admits and is not dirty → `prerelease`.
6. Otherwise visible upstream work → `in-progress`.
7. Otherwise deprecated/archived/stale → `unmaintained`.
8. Otherwise a line that caps Solid 1, or a permissive line with dirty code →
   `blocked`.
9. Otherwise → `unknown`.

Properties:

- **Open peer ranges do not produce `ready`.** A range like `>=1.7` with imports
  of removed APIs yields `blocked` with the reason "peer range accepts Solid 2
  but code imports removed APIs".
- **Dual-support ranges** (`^1.9 || ^2.0.0`) are fine.
- **Attestations** can raise confidence, but a maintainer-asserted `ready` that
  contradicts a failing scan or smoke test is displayed as **disputed**. They
  expire after 90 days.
- **Overrides** are visible, need public evidence, a reason and an expiry of at
  most 90 days, and require a second maintainer's review.
- **Determinism.** The engine is pure: same evidence, Solid state and policy
  version produce the same verdict, which is what makes data diffs reviewable.

## 5. What the static scan checks

The scan parses files; it never executes them. It resolves entry points from
`exports`/`main`/`module`/`types` for the `import`, `browser`, `development`,
`solid` and `default` conditions — including JSX source shipped under the
`solid` condition — and extracts import specifiers.

| Finding | Meaning |
|---|---|
| `removed-subpath` | The package imports a subpath Solid 2 removed or moved, e.g. `solid-js/web`. |
| `missing-export` | A named import does not exist in the installed Solid 2 export surface. |
| `type-ownership` | `JSX` or `ComponentProps` is imported from `solid-js` rather than `@solidjs/web`. |
| `jsx-removed-syntax` | Shipped JSX uses `classList`, `use:`, `on:`, `attr:` or `bool:` (a Solid 2 compile error). |

Detection is **dynamic**: the export surface is extracted from the published
tarballs of `solid-js`, `@solidjs/web` and `@solidjs/signals`, by parsing their
root entry points — nothing is installed and no package code runs. The result
is committed to [`rules/solid2-surface.json`](../rules/solid2-surface.json) with
the versions it was built from, so a new Solid release updates the rule set
without a hand-maintained list and every finding is attributable to a surface
version. Regenerate it with `pnpm --filter @solid-ground/scanner surface`.
Replacement hints in [`rules/removed-apis.yml`](../rules/removed-apis.yml) are
human-curated.

### Known limits

- Dead code and optional dual-support imports can produce false positives.
- Semantic runtime changes (batching, effect timing, async hold behaviour)
  cannot be detected statically.
- Static findings therefore never make a package "verified" on their own.

## 6. Freshness and staleness

Every record carries `checkedAt`, the tested Solid versions and the rules
version. Past its window:

- a `verified` record is downgraded to **declared**;
- a record with no successful check in a long window becomes `unknown`;
- a site banner appears after 72 hours without a successful pipeline run.

Failures reduce **freshness**, never correctness claims. A failed fetch keeps the
last good values and marks the record stale; it never deletes or downgrades a
record on its own.

## 7. Discovery and scope

Discovery searches npm for `keywords:solid-js`, `keywords:solidjs`, `solid-js`,
`solidjs` and known scopes. Candidates are **never** shown with a status or
auto-promoted. A human promotes a candidate into `registry/packages/`.

Tiers:

| Tier | Meaning |
|---|---|
| **Curated** | Hand-listed in `registry/` with a category and optional family. |
| **Tracked** | Meets the scope threshold and has been approved. |
| **Candidate** | Discovered, not yet tracked. Shown as coverage only. |

Renames are recorded with `supersededBy` (for example `vite-plugin-solid` →
`@solidjs/vite-plugin`). Families such as `@solid-primitives/*` roll up to a
family view.

## 8. Data sources

| Source | Read via | Used for |
|---|---|---|
| npm packument | `registry.npmjs.org/<name>` with conditional requests | versions, dist-tags, peer ranges, deprecation |
| npm search | `/-/v1/search` | discovery only |
| npm downloads | `api.npmjs.org/downloads/point/last-week/<name>` | ordering and display; never a status |
| npm tarballs | `dist.tarball`, integrity verified | static scan in a temp directory |
| GitHub GraphQL | repository, releases, branches, PRs and issues | upstream signals only |
| Solid releases | packuments and GitHub releases of core packages | versions under test |
| Solid migration docs | conditional GET, hashed | rules-drift review |
| Solid export surface | local installs of Solid 1.x/2.x | dynamic removed-API detection |
| Curated registry | YAML in this repository | scope, categories, attestations |
| Contributions | issue forms and PRs | human evidence |

Every stored fact carries a provenance envelope: value, source, package version,
fetch time, fingerprint and tool version.

## 9. What is deliberately not collected

- No visitor data, cookies, analytics or fingerprinting. “Check my app” parses
  files in the browser; nothing is uploaded.
- No maintainer emails or names. Public GitHub handles appear only where a
  person made a public attestation or correction.
- No package source is retained beyond hashes, specifier names and bounded
  excerpts of finding locations.
- No credentials beyond the repository's own `GITHUB_TOKEN`.
- Reads are polite: identifying `User-Agent`, low concurrency, conditional
  requests, backoff and circuit breakers. If a provider asks us to slow down or
  stop, the pipeline degrades rather than working around it.

## 10. Fairness and right of reply

- Any maintainer can correct their own entry with evidence, and gets priority.
- Corrections are reviewed within a 7-day target.
- We never open issues on other projects automatically, and never send
  unsolicited outreach. Notifications are opt-in through the registry.
- Every status links to its evidence and to this page.
- Disputes are shown as **disputed**, not silently resolved in either direction.

## 11. Change log of rules

| Rules version | Date | Change |
|---|---|---|
| `2026.11.1` | 2026-11-25 | Initial published policy: seven statuses, six evidence levels, 18-month unmaintained window. |
