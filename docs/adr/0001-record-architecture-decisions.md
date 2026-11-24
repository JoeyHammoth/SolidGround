# ADR 0001: Record architecture decisions

- **Status:** accepted
- **Date:** 2026-11-25

## Context

Solid Ground has an unusually high cost of being wrong: a status is read by
maintainers and by application teams deciding whether to upgrade. Decisions
about evidence, scope and trust boundaries therefore need a durable, reviewable
record that survives contributor turnover.

## Decision

Use lightweight Architecture Decision Records in `docs/adr/`, numbered
sequentially. Each records context, the decision, consequences and status
(proposed, accepted, superseded). Changes to `rules/`, `packages/engine/` and
the workflow trust boundary require an ADR or an explicit note in the PR
explaining why one is not needed.

## Consequences

- Methodology debates have a home and a decision trail.
- Reviewers can point at a decision instead of re-litigating it.
- The set stays small; ADRs are for decisions that constrain future work, not
  for every change.
