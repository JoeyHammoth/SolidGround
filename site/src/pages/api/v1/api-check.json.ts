import type { APIRoute } from "astro";
import { apiCheck } from "../../../lib/data";
import { API_CHECK_SCHEMA_URL } from "../../../lib/schema-urls";

/**
 * What the Verify `live API` job recorded when it last validated the deployed
 * JSON: the outcome, when, how many endpoints answered, the problems behind a
 * failure, and how the recorded fixture compared to the deployed answer.
 *
 * A 404 until a Verify run has recorded a check for this edition. Unlike
 * `validation.json`, the schema describes a check that happened and requires a
 * timestamp, so there is no honest body for "none yet": a consumer should read
 * the status code rather than a record-shaped placeholder.
 */
export const GET: APIRoute = () =>
  apiCheck
    ? new Response(
        JSON.stringify(
          {
            $schema: API_CHECK_SCHEMA_URL,
            schemaVersion: 1,
            ...apiCheck,
          },
          null,
          2,
        ),
        { headers: { "content-type": "application/json; charset=utf-8" } },
      )
    : new Response(
        JSON.stringify(
          {
            error:
              "no recorded API check for this edition; the Verify live API job writes api-check.json to the dataset",
          },
          null,
          2,
        ),
        { status: 404, headers: { "content-type": "application/json; charset=utf-8" } },
      );
