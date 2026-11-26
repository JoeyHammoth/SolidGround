# Scanner accuracy measurement

The scanner's claim is narrow: it reads published code and reports imports that
Solid 2 no longer supports. This directory measures how often that claim holds.

## What it does

1. `corpus.json` pins 25 published packages and exact versions. Nothing resolves
   `latest` at run time, so a measurement can be reproduced.
2. `run.ts` scans each package with the real scanner (`scanPackage`), then
   downloads the same tarball again and looks for the same problems with a
   deliberately naive oracle: regular expressions over the raw file text.
3. Comparison is per file and per finding, restricted to files the scanner
   actually analysed, so file selection cannot masquerade as an accuracy result.
4. Disagreements are written to `results.json` and must be judged by hand in
   `adjudication.json`. Until every one has a verdict the run exits non-zero,
   because un-adjudicated disagreements cannot be counted as correct.

The oracle covers `removed-subpath`, `missing-export` (curated removed names
only) and `type-ownership`. It cannot see `unknown-export`, and its
`jsx-removed-syntax` detector is the same regular-expression family as the
scanner's, so neither is treated as an independent check.

## Running it

```bash
volta run --node 24.22.3 corepack pnpm run eval:scanner
```

It fetches 25 packages from npm, so it is not part of `pnpm ci`. Results are
written to `results.json`; the summary table is printed.

## Reading the numbers

- **Precision** = (agreed + hand-confirmed scanner-only) / all scanner findings
  that the oracle could also have seen.
- **Recall** = (agreed + hand-confirmed scanner-only) / all real issues in the
  analysed files, including those only the oracle spotted.

Both are statements about *import-level detection on this corpus*, not about
whether a package works with Solid 2. Dead code, optional dual-support imports
and everything runtime-level sit outside what either detector can see.

Agreement alone is weak evidence, so the published numbers also rest on a hand
check: on 2026-11-26, three findings per package that published any (30 in
total) were read back against the cited line of the published tarball. All 30
were real imports of a removed API. When the corpus changes, repeat that check
before quoting the numbers.

## Adding a package

Pin the exact version, not a range, and prefer a package the corpus does not
already cover at the same tier. A measurement taken after npm has moved is not
comparable with the old one, so record the date with the result.
