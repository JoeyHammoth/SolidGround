import type { APIRoute } from "astro";
import { solid } from "../../../lib/data";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(solid, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
