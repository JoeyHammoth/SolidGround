# ADR 0003: Derive the removed-API rule set dynamically

- **Status:** accepted
- **Date:** 2026-11-25

## Context

Solid shipped 23 release candidates in 14 weeks. A hand-maintained list of
removed exports would be stale within days, and a stale rule set produces false
`blocked` or false `ready` verdicts — the two most damaging errors this project
can make.

## Decision

Build the Solid 2 export surface at check time:

1. Install the latest `solid-js` 1.x, stable 2.x and `next` in isolated temp
   directories with `--ignore-scripts`.
2. Read each package's `exports` map and `Object.keys()` of each public entry's
   ESM namespace.
3. Derive `removedIn2` (1.x exports minus 2.x exports), `addedIn2` and
   `surface2`; cache by Solid version and hash the surface.
4. The scanner classifies imports against those sets. Static files are parsed,
   never executed.

`rules/removed-apis.yml` contains **replacement hints only**; detection does not
depend on it.

## Consequences

- A new Solid release updates detection with no human edit.
- Removal of an export triggers a rules-drift issue, not an automatic rewrite.
- The check needs network access to install Solid, so a cached surface is stored
  with the dataset; a missing surface degrades the package to `D` evidence.
