# ADR 0006: Serve `$schema` from the raw files, not the future domain

- **Status:** accepted
- **Date:** 2026-11-27

## Context

Every schema carries `$id: https://solid-ground.dev/schemas/…`. That domain is
the intended canonical home, but it does not resolve: `curl` fails with
"Could not resolve host", and GitHub Pages reports no custom domain. A `$schema`
value has to resolve to a JSON document, so pointing responses at `$id` today
would hand every consumer a dead URL — worse than no link at all, because it
looks authoritative.

## Decision

- Published responses set `$schema` to the raw file under
  `https://raw.githubusercontent.com/JoeyHammoth/SolidGround/main/packages/schema/schemas/`.
- `SCHEMA_BASE` in `packages/smoke/src/status.ts` is the single definition of
  that base. The site's endpoint constants and the fixture writer derive from
  it, so a move is one edit rather than six.
- The `$id` values stay on `solid-ground.dev`. They name the intended document
  and are the only stable identity the schemas have; rewriting them to the
  GitHub path would bake a repository layout into the schema identity.
- Human-facing links (README, `/llms.txt`) keep pointing at the GitHub blob
  pages, which render the schema; consumers get the raw file.
- `pnpm check:live` fails when a response's `$schema` does not end in the
  matching file name, so a half-finished migration breaks loudly.

## Consequences

- A consumer can validate a payload today with no repository knowledge.
- The `$schema` URLs contain `main`, so they follow the default branch. A schema
  change and the code that emits it must land together; the endpoint tests
  validate the generated bodies against the same files.
- When `solid-ground.dev` serves the schemas, changing `SCHEMA_BASE` and the
  `$id` values in one commit moves every response, and `check:live` confirms it
  from the outside.
