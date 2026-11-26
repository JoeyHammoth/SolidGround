import type { APIRoute } from "astro";
import { events } from "../../../lib/events";

/** Recent change events, newest first. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(events, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
