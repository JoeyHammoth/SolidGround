import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type {
  PackageRecord,
  Policy,
  SmokeResult,
  SolidState,
} from "@solid-ground/schema";
import { CONTROL_HISTORY_FILE, foldBatch, publishBatch } from "../src/index.js";

const POLICY: Policy = {
  version: "2026.11.1",
  unmaintainedAfterMonths: 18,
  staleness: {
    metadataHours: 48,
    staticScanDays: 7,
    smokeDays: 21,
    attestationDays: 90,
  },
};

const SOLID: SolidState = {
  stable2: "2.0.4",
  next: null,
  observedAt: "2026-11-27T00:00:00Z",
};

const NOW = new Date("2026-11-27T00:00:00Z");

function record(overrides: Partial<PackageRecord> = {}): PackageRecord {
  return {
    schemaVersion: 1,
    name: "@example/lib",
    family: null,
    category: "utilities",
    repository: "https://example.com/lib",
    lines: [],
    upstream: { hasSolid2Work: false, isArchived: false, links: [] },
    attestations: [],
    smoke: { import: null, build: null, types: null },
    shipsTypes: true,
    tested: { solid: "2.0.4", solidNext: null, rules: "2026.11.1", tool: "0.1.0" },
    status: "ready",
    confidence: ["D", "S", "U"],
    verified: false,
    reasons: [],
    recommendedVersion: "2.0.4",
    solid2Version: "2.0.4",
    ...overrides,
  } as PackageRecord;
}

function result(overrides: Partial<SmokeResult> = {}): SmokeResult {
  return {
    schemaVersion: 1,
    name: "@example/lib",
    version: "2.0.4",
    solid: "2.0.4",
    channel: "stable",
    smoke: { import: true, build: true, types: true },
    entry: "esm",
    durationMs: 1000,
    error: null,
    at: "2026-11-26T00:00:00Z",
    ...overrides,
  };
}

const GOOD = result({
  name: "@solid-ground/control-good",
  version: "0.0.0",
  smoke: { import: true, build: true, types: true },
});
const BAD = result({
  name: "@solid-ground/control-bad",
  version: "0.0.0",
  smoke: { import: false, build: null, types: null },
});
const SUBPATH = result({
  name: "@solid-ground/control-subpath",
  version: "0.0.0",
  target: "@solid-ground/control-subpath/widget",
});

async function edition(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sg-smoke-publish-"));
  await mkdir(path.join(dir, "packages"), { recursive: true });
  await writeFile(
    path.join(dir, "meta.json"),
    JSON.stringify({
      schemaVersion: 1,
      generatedAt: "2026-11-27T00:00:00Z",
      lastSuccessfulCollect: "2026-11-27T00:00:00Z",
      lastSuccessfulVerify: null,
      solid: SOLID,
      counts: { ready: 1, total: 1 },
      versions: { rules: "2026.11.1", tool: "0.1.0", schema: 1 },
      coverage: { tracked: 1, curated: 1, candidates: 0 },
      anomaly: { held: false, reasons: [] },
    }),
  );
  await writeFile(
    path.join(dir, "packages", "example.json"),
    JSON.stringify(record()),
  );
  await writeFile(
    path.join(dir, "index.json"),
    JSON.stringify([
      {
        name: "@example/lib",
        status: "ready",
        confidence: ["D", "S", "U"],
        verified: false,
        solid2Version: "2.0.4",
        category: "utilities",
        family: null,
        downloadsWeekly: 10,
        checkedAt: "2026-11-27T00:00:00Z",
      },
    ]),
  );
  return dir;
}

async function writeAudit(dir: string, days: number): Promise<void> {
  const lines: string[] = [];
  for (let index = 0; index < days; index += 1) {
    const day = String(index + 1).padStart(2, "0");
    const at = `2026-11-${day}T04:00:00Z`;
    for (const base of [GOOD, BAD, SUBPATH]) {
      lines.push(JSON.stringify({ ...base, at }));
    }
  }
  await mkdir(path.join(dir, "smoke"), { recursive: true });
  await writeFile(path.join(dir, CONTROL_HISTORY_FILE), `${lines.join("\n")}\n`);
}

const cleanup: string[] = [];
afterEach(async () => {
  for (const dir of cleanup.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe("foldBatch", () => {
  it("folds a package result and ignores the controls", () => {
    const folded = foldBatch([record()], [GOOD, BAD, SUBPATH, result()], POLICY, SOLID, NOW);
    expect(folded).toHaveLength(1);
    expect(folded[0]?.verified).toBe(true);
    expect(folded[0]?.smoke.import).toBe(true);
  });
});

describe("publishBatch", () => {
  it("writes the folded record, index row and verify timestamp", async () => {
    const dir = await edition();
    cleanup.push(dir);
    const outcome = await publishBatch({
      dataDir: dir,
      results: [GOOD, BAD, SUBPATH, result({ target: "@example/lib/widget" })],
      policy: POLICY,
      now: NOW,
    });

    expect(outcome.changed).toEqual(["@example/lib"]);
    expect(outcome.verified).toEqual(["@example/lib"]);

    const written = JSON.parse(
      await readFile(path.join(dir, "packages", "example.json"), "utf8"),
    ) as PackageRecord;
    expect(written.verified).toBe(true);
    expect(written.smokeAt).toBe("2026-11-26T00:00:00Z");
    expect(written.smokeTarget).toBe("@example/lib/widget");
    expect(written.confidence).toContain("B");

    const index = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
    expect(index[0].verified).toBe(true);
    expect(index[0].smokeTarget).toBe("@example/lib/widget");
    expect(index[0].smokeAt).toBe("2026-11-26T00:00:00Z");

    const meta = JSON.parse(await readFile(path.join(dir, "meta.json"), "utf8"));
    expect(meta.lastSuccessfulVerify).toBe(NOW.toISOString());
  });

  it("records the controls without folding them into a record", async () => {
    const dir = await edition();
    cleanup.push(dir);
    await publishBatch({
      dataDir: dir,
      results: [GOOD, BAD, SUBPATH, result()],
      policy: POLICY,
      now: NOW,
    });

    const lines = (await readFile(path.join(dir, CONTROL_HISTORY_FILE), "utf8"))
      .trim()
      .split("\n");
    expect(lines).toHaveLength(3);
    expect(lines.map((line) => JSON.parse(line).name).sort()).toEqual([
      "@solid-ground/control-bad",
      "@solid-ground/control-good",
      "@solid-ground/control-subpath",
    ]);
  });

  it("does not duplicate control lines when the same batch is published twice", async () => {
    const dir = await edition();
    cleanup.push(dir);
    await publishBatch({ dataDir: dir, results: [GOOD, BAD, SUBPATH, result()], policy: POLICY, now: NOW });
    const second = await publishBatch({
      dataDir: dir,
      results: [GOOD, BAD, SUBPATH, result()],
      policy: POLICY,
      now: NOW,
    });

    expect(second.changed).toEqual([]);
    const lines = (await readFile(path.join(dir, CONTROL_HISTORY_FILE), "utf8"))
      .trim()
      .split("\n");
    expect(lines).toHaveLength(3);
  });

  it("refuses to write anything when a control is wrong", async () => {
    const dir = await edition();
    cleanup.push(dir);
    const wrong = result({
      name: "@solid-ground/control-bad",
      version: "0.0.0",
      smoke: { import: true, build: null, types: null },
    });

    await expect(
      publishBatch({
        dataDir: dir,
        results: [GOOD, wrong, SUBPATH, result()],
        policy: POLICY,
        now: NOW,
      }),
    ).rejects.toThrow(/control-bad: import was true/);

    const stored = JSON.parse(
      await readFile(path.join(dir, "packages", "example.json"), "utf8"),
    ) as PackageRecord;
    expect(stored.verified).toBe(false);
  });

  it("refuses a malformed result", async () => {
    const dir = await edition();
    cleanup.push(dir);
    await expect(
      publishBatch({
        dataDir: dir,
        results: [{ ...GOOD, name: "" } as SmokeResult, BAD, SUBPATH],
        policy: POLICY,
        now: NOW,
      }),
    ).rejects.toThrow(/malformed result/);
  });

  it("reports changes without writing them on a dry run", async () => {
    const dir = await edition();
    cleanup.push(dir);
    const outcome = await publishBatch({
      dataDir: dir,
      results: [GOOD, BAD, SUBPATH, result()],
      policy: POLICY,
      dryRun: true,
      now: NOW,
    });
    expect(outcome.dryRun).toBe(true);
    expect(outcome.changed).toEqual(["@example/lib"]);

    const stored = JSON.parse(
      await readFile(path.join(dir, "packages", "example.json"), "utf8"),
    ) as PackageRecord;
    expect(stored.verified).toBe(false);
  });

  it("refuses a real publish before the two-week control gate", async () => {
    const dir = await edition();
    cleanup.push(dir);
    await writeAudit(dir, 13);

    await expect(
      publishBatch({
        dataDir: dir,
        results: [GOOD, BAD, SUBPATH, result()],
        policy: POLICY,
        requireAudit: true,
        now: NOW,
      }),
    ).rejects.toThrow(/publish refused: 13 clean control day\(s\) on record, 14 required/);

    const stored = JSON.parse(
      await readFile(path.join(dir, "packages", "example.json"), "utf8"),
    ) as PackageRecord;
    expect(stored.verified).toBe(false);
  });

  it("still previews a batch before the audit gate", async () => {
    const dir = await edition();
    cleanup.push(dir);
    const outcome = await publishBatch({
      dataDir: dir,
      results: [GOOD, BAD, SUBPATH, result()],
      policy: POLICY,
      requireAudit: true,
      dryRun: true,
      now: NOW,
    });
    expect(outcome.changed).toEqual(["@example/lib"]);
  });

  it("publishes once fourteen clean control days are recorded", async () => {
    const dir = await edition();
    cleanup.push(dir);
    await writeAudit(dir, 14);

    const outcome = await publishBatch({
      dataDir: dir,
      results: [GOOD, BAD, SUBPATH, result()],
      policy: POLICY,
      requireAudit: true,
      now: NOW,
    });
    expect(outcome.changed).toEqual(["@example/lib"]);
  });

  it("withdraws a pass that names another Solid release", async () => {
    const dir = await edition();
    cleanup.push(dir);
    const verified = record({
      verified: true,
      confidence: ["D", "S", "B"],
      smoke: { import: true, build: true, types: null },
      smokeAt: "2026-11-20T00:00:00Z",
      tested: { solid: "2.0.3", solidNext: null, rules: "2026.11.1", tool: "0.1.0" },
    });
    await writeFile(
      path.join(dir, "packages", "example.json"),
      JSON.stringify(verified),
    );

    const outcome = await publishBatch({
      dataDir: dir,
      results: [GOOD, BAD, SUBPATH, result({ solid: "2.0.3" })],
      policy: POLICY,
      now: NOW,
    });
    expect(outcome.withdrawn).toEqual(["@example/lib"]);
    const stored = JSON.parse(
      await readFile(path.join(dir, "packages", "example.json"), "utf8"),
    ) as PackageRecord;
    expect(stored.smokeAt).toBeNull();
  });
});
