import type { APIRoute } from "astro";
import { badgeMap, records } from "../../lib/data";

export function getStaticPaths() {
  return records.map((record) => ({
    params: { slug: record.name.replace(/\//g, "__") },
    props: { record },
  }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(
    JSON.stringify(
      {
        schemaVersion: 1,
        label: "Solid 2",
        message: props.record.status,
        color: badgeMap(props.record),
        cacheSeconds: 3600,
      },
      null,
      2,
    ),
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
