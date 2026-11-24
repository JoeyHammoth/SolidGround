import type { APIRoute } from "astro";
import { meta } from "../../../lib/data";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(meta, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
