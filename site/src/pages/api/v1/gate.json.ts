import type { APIRoute } from "astro";
import { gateState } from "@solid-ground/smoke/status";
import { controls } from "../../../lib/data";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(gateState(controls), null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
