import type { APIRoute } from "astro";
import { gateState } from "@solid-ground/smoke/status";
import { apiCheck, controls } from "../../../lib/data";
import { publicFixture } from "../../../lib/fixture-status.js";
import { GATE_SCHEMA_URL } from "../../../lib/schema-urls";

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        $schema: GATE_SCHEMA_URL,
        ...gateState(controls),
        // The gate counts the recorded fixture, a batch behind the deployed
        // answer between refreshes. Publish that verdict with the numbers so a
        // monitor does not read a lagging streak as current. Null until a
        // Verify run has recorded a check for this edition. Only the fields the
        // schema lists: the refresh outcome and blocker issue stay in
        // api-check.json, where /health/ reads them.
        fixture: publicFixture(apiCheck?.fixture),
      },
      null,
      2,
    ),
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
