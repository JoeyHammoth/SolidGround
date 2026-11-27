# Why five packages are blocked

Snapshot: 2026-11-27, `data` edition generated 2026-11-27T09:43Z, rules
`2026.11.1`, Solid stable `2.0.4`.

Five of the fourteen curated packages are `blocked`. None of them has a
published stable release that admits Solid 2, and for three of the five the
declared range is not the only problem: the published code also imports APIs
Solid 2 removed, so widening the peer range would not make them work.

| Package | Latest stable | Declares | Static scan | What blocks it | What would unblock it |
|---|---|---|---|---|---|
| `@astrojs/solid-js` | 7.1.6 | `solid-js ^1.9.13` | clean | Peer range only; the adapter targets the Solid 1 renderer. | An Astro adapter release whose peer range admits 2.x (and that imports `@solidjs/web`). |
| `@solidjs/start` | 2.2.3 | `solid-js ^1.9.15` | removed APIs found | Both the range and the shipped code. It already peers `vite ^8 \|\| ^9`, so the toolchain moved but the renderer did not. | A 2.x line of the framework; not a range correction. |
| `@suid/material` | 0.19.0 | `solid-js ^1.9.7` | removed APIs found | Both. Last release 2025-06-14, so it is also approaching the 18-month unmaintained window. | A maintained release ported to Solid 2, or a maintainer deeming it unmaintained. |
| `@tanstack/solid-virtual` | 3.13.55 | `solid-js ^1.3.0` | removed APIs found | Both. Releases are frequent (2026-11-22), so this is an active port not yet done, not an abandoned package. | A release whose adapter targets Solid 2; the registry keeps it as a removed-API fixture until then. |
| `vite-plugin-solid` | 2.11.17 | `solid-js ^1.7.2` | clean | Peer range only. The package was renamed for the Solid 2 line and is kept for 1.x users. | Nothing: `@solidjs/vite-plugin` is the tracked successor and is already the harness toolchain. |

## What this means

- The blocked statuses are not harness gaps. `@astrojs/solid-js` and
  `vite-plugin-solid` scan clean and fail only on the declared peer range, which
  is the documented meaning of `blocked` (`D` evidence, no admissible release).
  The other three would still fail an import against Solid 2 even if the range
  were loosened.
- **`vite-plugin-solid` is the only package where the right user action is a
  different package**, not a new release. Its registry entry already carries
  `supersededBy: "@solidjs/vite-plugin"` and the harness builds with the
  successor.
- **`@suid/material` is the next status to watch.** Its latest stable release is
  from 2025-06-14; with `unmaintainedAfterMonths: 18` it crosses that window in
  December 2026 unless a release lands.
- The sandbox matrix now probes a real subpath when a package exports no root
  entry, so the subpath-only packages in this list (none today) will be measured
  rather than failed by the probe. `@kobalte/core@2.0.0-alpha.5` is the case that
  motivated it: root import fails by packaging, while
  `@kobalte/core/accordion` imports, builds and typechecks against `2.0.4`.

## Reproduce

```bash
# The reasons the engine wrote into each record.
git show origin/data:packages/@astrojs__solid-js.json | jq .reasons

# Re-run one cell; the artifact says which specifier was tested.
printf '%s' '{"name":"@kobalte/core","version":"2.0.0-alpha.5","solid":"2.0.4","channel":"stable","steps":{"import":true,"build":true,"types":true}}' \
  | pnpm smoke:run
```

A `blocked` record carries no `recommendedVersion`, so the matrix does not test
it; the diagnosis above comes from the version lines, the static scan and the
upstream signals already published in the record.
