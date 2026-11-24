import type { APIRoute } from "astro";
import { records } from "../../../../lib/data";

export function getStaticPaths() {
  return records.map((record) => ({
    params: { slug: record.name.replace(/\//g, "__") },
    props: { record },
  }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.record, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
