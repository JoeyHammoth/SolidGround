import type { APIRoute } from "astro";
import { controlsResponse } from "@solid-ground/smoke/status";
import { controls } from "../../../lib/data";
import { CONTROLS_SCHEMA_URL } from "../../../lib/schema-urls";

/**
 * The audit trail behind the publish gate. `/health/` draws the same days; this
 * endpoint is for monitors that only need the verdict and the reasons. The
 * Verify `history` job writes the same body to `fixtures/live/controls.json`.
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(controlsResponse(controls, CONTROLS_SCHEMA_URL), null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
