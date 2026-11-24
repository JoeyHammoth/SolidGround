import type { APIRoute } from "astro";
import { index } from "../../../lib/data";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(index, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
