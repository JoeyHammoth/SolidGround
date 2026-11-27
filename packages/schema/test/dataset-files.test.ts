import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateMeta, validatePaths, validateSolidFile } from "../src/index.js";

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../../../fixtures/dataset/${name}`, import.meta.url), "utf8"),
  );
}

const dataset = fileURLToPath(new URL("../../../fixtures/dataset", import.meta.url));

describe("meta.json", () => {
  it("accepts the committed edition", () => {
    expect(validateMeta(fixture("meta.json"))).toEqual([]);
  });

  it("rejects a missing status count and an unknown field", () => {
    const meta = fixture("meta.json") as { counts: Record<string, number> };
    delete meta.counts["ready"];
    expect(validateMeta(meta).join(" ")).toContain("ready");
    const base = fixture("meta.json") as Record<string, unknown>;
    expect(validateMeta({ ...base, extra: true }).join(" ")).toContain("additional");
  });
});

describe("solid.json", () => {
  it("accepts the committed edition", () => {
    expect(validateSolidFile(fixture("solid.json"))).toEqual([]);
  });

  it("rejects a non-string dist-tag", () => {
    const solid = fixture("solid.json") as { distTags: Record<string, unknown> };
    solid.distTags["latest"] = 2;
    expect(validateSolidFile(solid).join(" ")).toContain("distTags");
  });
});

describe("dataset validation", () => {
  it("validates index, meta and solid together", async () => {
    expect(await validatePaths([dataset])).toEqual([]);
  });

  it("reports a malformed meta.json by path", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sg-meta-"));
    try {
      await writeFile(path.join(dir, "meta.json"), "{}\n", "utf8");
      const failures = await validatePaths([dir]);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain("meta.json");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
