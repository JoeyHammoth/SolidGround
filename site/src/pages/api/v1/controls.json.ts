import type { APIRoute } from "astro";
import { gateState, groupControlFailures } from "@solid-ground/smoke/status";
import { controls } from "../../../lib/data";
import { CONTROLS_SCHEMA_URL } from "../../../lib/schema-urls";

/**
 * The audit trail behind the publish gate. `/health/` draws the same days; this
 * endpoint is for monitors that only need the verdict and the reasons.
 */
export const GET: APIRoute = () => {
  const gate = gateState(controls);
  const body = {
    $schema: CONTROLS_SCHEMA_URL,
    schemaVersion: 1,
    streak: gate.streak,
    required: gate.required,
    remaining: gate.remaining,
    auditMet: gate.ready,
    lastRun: gate.lastRun,
    days: controls.days.map((day) => ({
      day: day.day,
      clean: day.clean,
      runs: day.runs,
      at: day.at,
      failures: day.failures.length,
      groups: groupControlFailures(day.failures),
    })),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
