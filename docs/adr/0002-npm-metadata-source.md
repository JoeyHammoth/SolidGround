# ADR 0002: Read full npm packuments, not the abbreviated format

- **Status:** accepted
- **Date:** 2026-11-25

## Context

The npm registry serves an abbreviated packument
(`Accept: application/vnd.npm.install-v1+json`) that is much smaller and is what
package managers use. The design assumed it might be enough, but flagged a
warning: optional peer metadata (`peerDependenciesMeta`) is critical to reading
a missing `solid-js` peer correctly.

A live check on 2026-11-25 of `@kobalte/core@0.13.14` with the install Accept
header returned `peerDependencies` but **no** `peerDependenciesMeta`.

## Decision

Fetch the full packument. Cap the response body at 20 MB, retain only the
versions that matter (every dist-tag target, the newest stable of each major,
and the 10 newest by publish time), and store fingerprints rather than raw
bodies.

## Consequences

- More bytes per first fetch, mitigated by ETag conditional requests (`304`).
- Optional-peer semantics remain correct.
- Provenance can record `peerDependenciesMeta` for auditability.
