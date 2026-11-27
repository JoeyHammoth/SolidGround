import type { APIRoute } from "astro";
import { gateState } from "@solid-ground/smoke/status";
import { controls, deployValidation } from "../lib/data";

export const GET: APIRoute = () => {
  const gate = gateState(controls);
  const validation = deployValidation
    ? `${deployValidation.ok ? "passed" : "failed"} at ${deployValidation.checkedAt ?? "an unrecorded time"} (${deployValidation.problems.length} problem(s))`
    : "not recorded in this build";

  const body = `# Solid Ground: SolidJS 2 ecosystem compatibility data

> Community-maintained dataset describing which npm packages work with SolidJS 2.0.
> Not an official SolidJS project. Data is CC BY 4.0; code is MIT.
> Every record carries the exact Solid version tested, an evidence level and a checked-at timestamp.

## Start here

- Index of tracked packages: /api/v1/index.json
- Per-package records: /api/v1/packages/<name>.json (scoped names use "__", e.g. @kobalte__core.json)
- Dataset metadata and counts: /api/v1/meta.json
- Solid versions under test: /api/v1/solid.json
- Recent changes (new packages, status and version changes, expired overrides, Solid releases, rules changes, anomaly holds): /api/v1/events.json
- Changes page and Atom feed: /changes/ and /feed.xml
- Shields badge endpoint: /badges/<name>.json
- Methodology and status definitions: /methodology/
- Health and freshness: /health/

## How to read a status

- ready: a stable release admits Solid 2 and the evidence policy is met
- prerelease: only an alpha, beta, rc or next line supports Solid 2
- in-progress: no release yet, but upstream work is visible
- blocked: no Solid 2 support and no visible upstream work
- unmaintained: deprecated, archived, or no release for 18 months
- agnostic: no solid-js dependency; exclude from readiness percentages
- unknown: not enough evidence; the reason is always stated

## Evidence levels

D declared (peer/dependency range), S static scan, B build/import, T types,
A maintainer attestation, U upstream CI.

"verified" means a ready verdict with a passing build/import check inside its
freshness window. A stale verified record is downgraded to "declared". Do not
treat "declared" as proof.

## Before trusting a status

Read meta.json and check \`generatedAt\`. If it is more than 72 hours old, the
dataset is stale. Each package record has \`checkedAt\` and \`tested.solid\`.

## Publish gate

The smoke matrix may only change a record after ${gate.required} clean control days.
Current: ${gate.streak} clean day(s) in a row; ${gate.remaining} more needed${gate.ready ? " (gate met)" : ""}.
Last control run: ${gate.lastRun ?? "never"}.
Machine-readable gate state: /api/v1/gate.json.
Dataset schema validation: ${validation}.
Machine-readable validation summary: /api/v1/validation.json.
Response schemas: https://github.com/JoeyHammoth/SolidGround/blob/main/packages/schema/schemas/gate.schema.json
and https://github.com/JoeyHammoth/SolidGround/blob/main/packages/schema/schemas/validation.schema.json.

## Attribution

Data from Solid Ground (https://github.com/JoeyHammoth/SolidGround), licensed
CC BY 4.0. Indicate changes if you filter or transform the data.
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
