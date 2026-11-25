import { describe, expect, it } from "vitest";
import {
  detectChanges,
  fetchObservation,
  flattenDistTags,
  loadWatchList,
  normalizeHtml,
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

  it("normalises markup so a docs redeploy alone is not a change", () => {
    expect(normalizeHtml("<main><h1>Migrate</h1> <script>x()</script> to 2.0</main>")).toBe(
      "Migrate to 2.0",
    );
  });
});

describe("sentinel observation", () => {
  it("loads the watch list from the versioned rules file", async () => {
    const watch = await loadWatchList("rules");
    expect(watch.packages).toContain("solid-js");
    expect(watch.docs.migration).toContain("docs.solidjs.com");
  });

  it("keeps the previous release and docs hash when a source fails", async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("registry.npmjs.org")) {
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
