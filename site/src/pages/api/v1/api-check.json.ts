import type { APIRoute } from "astro";
import { apiCheck } from "../../../lib/data";
import { API_CHECK_SCHEMA_URL } from "../../../lib/schema-urls";

/**
 * What the Verify `live API` job recorded when it last validated the deployed
 * JSON: the outcome, when, how many endpoints answered, the problems behind a
 * failure, and how the recorded fixture compared to the deployed answer.
 *
 * A static build cannot choose a status code, so an edition with no recorded
 * check publishes `{ error }` rather than a 404 or a record-shaped placeholder:
 * the schema describes a check that happened and requires a timestamp, and
 * `pnpm check:live` should fail on an edition that never recorded one.
 */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      apiCheck
        ? {
            $schema: API_CHECK_SCHEMA_URL,
            schemaVersion: 1,
            ...apiCheck,
          }
        : {
            error:
              "no recorded API check for this edition; the Verify live API job writes api-check.json to the dataset",
          },
      null,
      2,
    ),
    { headers: { "content-type": "application/json; charset=utf-8" } },
  );
