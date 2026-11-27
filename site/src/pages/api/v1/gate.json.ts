import type { APIRoute } from "astro";
import { gateState } from "@solid-ground/smoke/status";
import { controls } from "../../../lib/data";
import { GATE_SCHEMA_URL } from "../../../lib/schema-urls";

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      { $schema: GATE_SCHEMA_URL, ...gateState(controls) },
      null,
      2,
    ),
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
