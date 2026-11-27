import type { APIRoute } from "astro";
import { deployValidation } from "../../../lib/data";

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      deployValidation
        ? { schemaVersion: 1, recorded: true, ...deployValidation }
        : {
            schemaVersion: 1,
            recorded: false,
            ok: null,
            checkedAt: null,
            targets: [],
            problems: [],
          },
      null,
      2,
    ),
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
