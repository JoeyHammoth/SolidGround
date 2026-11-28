import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { validateApiCheck, validateGateState } from "@solid-ground/schema";

/**
 * The stale path, end to end through the routes: a recorded check that says the
 * fixture is more than one batch behind, with a blocked refresh, is loaded from
 * a dataset the way a deploy would and then published. The golden dataset has no
 * `api-check.json`, so the first block pins the no-recording answer and the
 * second builds a copy of that dataset with a stale record.
 */

interface Route {
  GET: (context: never) => Response | Promise<Response>;
}

async function loadRoutes(): Promise<{ gate: Route; apiCheck: Route; llms: Route }> {
  vi.resetModules();
  const gate = (await import("../src/pages/api/v1/gate.json.js")) as unknown as Route;
  const apiCheck = (await import("../src/pages/api/v1/api-check.json.js")) as unknown as Route;
  const llms = (await import("../src/pages/llms.txt.js")) as unknown as Route;
  return { gate, apiCheck, llms };
}

describe("/api/v1/api-check.json with no recording", () => {
  let routes: Awaited<ReturnType<typeof loadRoutes>>;

  beforeAll(async () => {
    delete process.env.DATA_DIR;
    routes = await loadRoutes();
  });

  it("answers 404 rather than a record-shaped placeholder", async () => {
    const response = await routes.apiCheck.GET({} as never);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = (await response.json()) as { error?: string };
    expect(body.error).toContain("no recorded API check");
  });

  it("publishes no fixture verdict in gate.json either", async () => {
    const gate = await (await routes.gate.GET({} as never)).json();
    expect(gate.fixture).toBeNull();
    expect(validateGateState(gate)).toEqual([]);
  });
});

describe("/api/v1/api-check.json from a stale-fixture dataset", () => {
  const record = {
    schemaVersion: 1,
    ok: false,
    checkedAt: "2026-11-28T01:06:11.353Z",
    base: "https://joeyhammoth.github.io/SolidGround",
    endpoints: 7,
    problems: ["/api/v1/gate.json: /fixture must NOT have additional properties"],
    fixture: {
      status: "stale",
      lastRun: "2026-11-26T15:47:28.855Z",
      refresh: "blocked",
      issue: 83,
    },
  };

  let dataset: string;
  let routes: Awaited<ReturnType<typeof loadRoutes>>;

  beforeAll(async () => {
    dataset = mkdtempSync(path.join(tmpdir(), "sg-stale-fixture-"));
    cpSync(path.resolve("fixtures/dataset"), dataset, { recursive: true });
    writeFileSync(path.join(dataset, "api-check.json"), JSON.stringify(record));
    process.env.DATA_DIR = dataset;
    routes = await loadRoutes();
  });

  afterAll(() => {
    delete process.env.DATA_DIR;
    rmSync(dataset, { recursive: true, force: true });
  });

  it("publishes the record under its own schema", async () => {
    const response = await routes.apiCheck.GET({} as never);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.$schema).toMatch(/\/api-check\.schema\.json$/);
    expect(validateApiCheck(body)).toEqual([]);
    expect(body.ok).toBe(false);
    expect(body.problems).toEqual(record.problems);
    expect(body.fixture).toEqual(record.fixture);
  });

  it("keeps the workflow state out of the gate payload", async () => {
    const body = await (await routes.gate.GET({} as never)).json();
    expect(body.fixture).toEqual({
      status: "stale",
      lastRun: record.fixture.lastRun,
    });
    expect(validateGateState(body)).toEqual([]);
  });

  it("tells an agent reading llms.txt that the refresh is blocked, not mergeable", async () => {
    const text = await (await routes.llms.GET({} as never)).text();
    expect(text).toContain("more than one batch behind");
    expect(text).toContain("blocked refresh");
    expect(text).not.toContain("until the refresh pull request is merged");
  });
});
