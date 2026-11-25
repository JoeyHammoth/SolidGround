import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  bodyText,
  detectChanges,
  fetchObservation,
  flattenDistTags,
  loadWatchList,
  type SentinelState,
} from "../src/sentinel.js";

const stored: SentinelState = {
  schemaVersion: 1,
  observedAt: "2026-11-24T00:00:00.000Z",
  stable2: "2.0.3",
  next: "2.0.0-rc.23",
  distTags: {
    "solid-js@latest": "2.0.3",
    "solid-js@next": "2.0.0-rc.23",
    "babel-preset-solid@latest": "1.9.19",
  },
  release: "v2.0.3",
  docsHash: "aaaaaaaaaaaaaaaa",
  surfaceHash: null,
};

describe("sentinel change detection", () => {
  it("reports nothing when the observation matches stored state", () => {
    expect(detectChanges(stored, { ...stored, observedAt: "2026-11-25T00:00:00.000Z" })).toEqual([]);
  });

  it("reports a dist-tag move and a new tag", () => {
    const observed: SentinelState = {
      ...stored,
      distTags: { ...stored.distTags, "solid-js@latest": "2.0.4", "solid-js@v1-latest": "1.9.20" },
    };
    expect(detectChanges(stored, observed)).toEqual([
      "solid-js@latest: 2.0.3 -> 2.0.4",
      "solid-js@v1-latest: removed -> 1.9.20",
    ]);
  });

  it("reports a new GitHub release", () => {
    expect(detectChanges(stored, { ...stored, release: "v2.1.0" })).toEqual([
      "release: v2.0.3 -> v2.1.0",
    ]);
  });

  it("reports a migration-docs hash change without dumping the whole hash", () => {
    expect(detectChanges(stored, { ...stored, docsHash: "bbbbbbbbbbbbbbbb" })).toEqual([
      "migration docs: aaaaaaaa -> bbbbbbbb",
    ]);
  });

  it("treats a missing or unversioned state file as a change", () => {
    expect(detectChanges(null, stored)).toEqual(["no stored state on the data branch yet"]);
  });

  it("flattens per-package dist-tags into stable composite keys", () => {
    expect(
      flattenDistTags({ "solid-js": { latest: "2.0.4" }, "@solidjs/web": null }),
    ).toEqual({ "solid-js@latest": "2.0.4" });
  });

  it("ignores the document head so asset hashes alone are not a change", () => {
    expect(
      bodyText("<head><script src=\"/app.9f2c.js\"></script></head><body><h1>Migrate</h1></body>"),
    ).toBe("<body><h1>Migrate</h1></body>");
  });
});

describe("sentinel observation", () => {
  it("loads the watch list from the versioned rules file", async () => {
    const watch = await loadWatchList("rules");
    expect(watch.packages).toContain("solid-js");
    expect(watch.docs.migration).toContain("docs.solidjs.com");
  });

  it("prefers the page source when the rendered docs page refuses CI", async () => {
    const source = "---\ntitle: From Solid 1.x\n---\nUse @solidjs/web.\n";
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (new URL(url).hostname === "registry.npmjs.org") {
        return new Response(JSON.stringify({ "dist-tags": { latest: "2.0.4" }, versions: { "2.0.4": {} } }), { status: 200 });
      }
      if (new URL(url).hostname === "raw.githubusercontent.com") return new Response(source, { status: 200 });
      return new Response("blocked", { status: 403 });
    }) as typeof fetch;

    const observed = await fetchObservation(
      {
        packages: ["solid-js"],
        docs: {
          migration: "https://docs.solidjs.com/migration/from-solid-1",
          migrationSource: "https://raw.githubusercontent.com/solidjs/solid-docs/v2-rebuild/src/routes/(6)migration/(0)from-solid-1.mdx",
        },
      },
      null,
      { fetchImpl },
    );

    const expected = createHash("sha256").update(source.replace(/\s+/g, " ").trim()).digest("hex");
    expect(observed.docsHash).toBe(expected);
  });

  it("authenticates release lookups when a token is available", async () => {
    let authorization: string | undefined;
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      if (new URL(String(input)).hostname === "registry.npmjs.org") {
        return new Response(JSON.stringify({ "dist-tags": { latest: "2.0.4" }, versions: { "2.0.4": {} } }), { status: 200 });
      }
      authorization = (init?.headers as Record<string, string> | undefined)?.authorization;
      return new Response(JSON.stringify({ tag_name: "v2.0.4" }), { status: 200 });
    }) as typeof fetch;

    const observed = await fetchObservation(
      { packages: ["solid-js"], docs: {} },
      stored,
      { fetchImpl, githubToken: "t0ken" },
    );

    expect(authorization).toBe("Bearer t0ken");
    expect(observed.release).toBe("v2.0.4");
  });

  it("keeps the previous release and docs hash when a source fails", async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      const host = new URL(String(input)).hostname;
      if (host === "registry.npmjs.org") {
        return new Response(JSON.stringify({ "dist-tags": { latest: "2.0.4", next: "2.0.0-rc.23" }, versions: { "2.0.4": {}, "2.0.0-rc.23": {} } }), { status: 200 });
      }
      return new Response("denied", { status: 403 });
    }) as typeof fetch;

    const observed = await fetchObservation(
      { packages: ["solid-js"], docs: { migration: "https://docs.solidjs.com/migration/from-solid-1" } },
      stored,
      { fetchImpl, now: new Date("2026-11-25T00:00:00.000Z") },
    );

    expect(observed.stable2).toBe("2.0.4");
    expect(observed.release).toBe("v2.0.3");
    expect(observed.docsHash).toBe(stored.docsHash);
  });
});
