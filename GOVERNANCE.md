# Governance

Solid Ground is a community project, not an official SolidJS project. It exists
to give the ecosystem a neutral, dated, evidence-based view of Solid 2
readiness. Neutrality is a product requirement, not a slogan.

## Roles

| Role | Responsibilities | How to join |
|---|---|---|
| **Contributor** | Reports corrections, adds packages, improves docs or code | Open a PR |
| **Triager** | Labels issues, asks for evidence, closes duplicates | Invited by a maintainer |
| **Maintainer** | Reviews code and methodology changes, publishes releases, holds the trust boundary (`.github/`, `rules/`, `packages/engine/`) | Invited after sustained contributions |
| **Steward** | Owns repository and hosting access, ensures a second maintainer exists | Current owner until handed over |

## Decisions

- **Lazy consensus** for routine changes: a PR with one maintainer approval merges.
- **Methodology changes** (`rules/status-policy.yml`, evidence levels, engine
  decision logic) need an issue that states the effect on existing records, a
  before/after fixture run, and approval from a maintainer who did not author
  the change.
- **Overrides** of an individual package's status need a public evidence link,
  a reason, an expiry of at most 90 days and a second maintainer's approval.
- **Security and trust-boundary changes** need review from a maintainer listed
  in [`CODEOWNERS`](.github/CODEOWNERS).
- If consensus fails, the steward decides and records the reasoning in the
  issue. Decisions that affect many statuses are recorded as an ADR in
  `docs/adr/`.

## Bus factor

The project must never depend on one person. We aim to have:

- at least **two maintainers** with repository admin access;
- at least **two people** monitoring the Code of Conduct contact and the
  security inbox;
- every automation runbook executable by any maintainer.

## Neutrality and funding

- No paid placement, sponsored statuses or priority listing.
- Sponsors, if any, cannot influence statuses, wording or scope.
- Downloads are shown as context, never as a quality ranking.
- Maintainers disclose conflicts of interest on the packages they maintain and
  do not review corrections to their own packages alone.

## Succession

If the steward becomes unavailable for 60 days without notice, maintainers may
continue using the shared repository credentials according to this document and
should recruit a replacement steward. If the project is invited to move to a
community organisation such as `solidjs-community`, maintainers decide by lazy
consensus and record the decision publicly.

## Code of Conduct

Enforcement follows [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Conduct reports
go to the contact listed there, never to a public issue.
