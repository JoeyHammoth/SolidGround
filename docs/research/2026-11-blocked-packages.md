# Why the blocked packages are blocked

Generated from the published edition for Solid stable `2.0.4`, rules `2026.11.1`. Regenerate with `pnpm audit:blocked --data data`; `--check` fails when this file is stale.

5 of 14 tracked packages are `blocked`: none has a published stable release that admits Solid 2.

| Package | Latest stable | Declares | Static scan | What blocks it | What would unblock it |
|---|---|---|---|---|---|
| `@astrojs/solid-js` | `7.1.6` | `^1.9.13` | clean | declares `^1.9.13`, which excludes 2.x | A release whose peer range admits 2.x and targets `@solidjs/web`. |
| `@solidjs/start` | `2.2.3` | `^1.9.15` | removed APIs found | declares `^1.9.15`, which excludes 2.x; published code imports APIs Solid 2 removed | A release ported to Solid 2; a wider peer range alone would not be enough. |
| `@suid/material` | `0.19.0` | `^1.9.7` | removed APIs found | declares `^1.9.7`, which excludes 2.x; published code imports APIs Solid 2 removed | A release ported to Solid 2; a wider peer range alone would not be enough. |
| `@tanstack/solid-virtual` | `3.13.55` | `^1.3.0` | removed APIs found | declares `^1.3.0`, which excludes 2.x; published code imports APIs Solid 2 removed | A release ported to Solid 2; a wider peer range alone would not be enough. |
| `vite-plugin-solid` | `2.11.17` | `^1.7.2` | clean | declares `^1.7.2`, which excludes 2.x | Nothing for this package: `@solidjs/vite-plugin` is the successor. |

## Unmaintained window (18 months after the latest stable release)

| Package | Latest stable | Window opens |
|---|---|---|
| `@suid/material` | `0.19.0` | 2026-12-14 |
| `@astrojs/solid-js` | `7.1.6` | 2028-05-13 |
| `@solidjs/start` | `2.2.3` | 2028-05-16 |
| `vite-plugin-solid` | `2.11.17` | 2028-05-18 |
| `@tanstack/solid-virtual` | `3.13.55` | 2028-05-22 |

`@suid/material` is first, on 2026-12-14, unless a release lands before then.

## What this means

- 2 of 5 are blocked by the declared peer range alone; 3 also ship code that imports APIs Solid 2 removed, so a wider range would not be enough.
- `vite-plugin-solid` is superseded by `@solidjs/vite-plugin`, so the useful action is a different package rather than a new release.
- The sandbox probes a real subpath when a package exports no root entry. A pass against a component subpath is recorded in the artifact's `target` field and is never read as a pass against the package root.

## Reproduce

```bash
# Engine reasons for one record.
git show origin/data:packages/@astrojs__solid-js.json | jq .reasons

# Re-run one cell; the artifact names the specifier it probed.
printf '%s' '{"name":"@kobalte/core","version":"2.0.0-alpha.5","solid":"2.0.4","channel":"stable","steps":{"import":true,"build":true,"types":true}}' \
  | pnpm smoke:run
```

