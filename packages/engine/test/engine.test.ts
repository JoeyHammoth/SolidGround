import { describe, expect, it } from "vitest";
import type { PackageEvidence, Policy, SolidState, VersionLine } from "@solid-ground/schema";
import { annotateLines, evaluate, phaseOf, rangeAdmits } from "../src/index.js";

const solid: SolidState = { stable2: "2.0.3", next: "2.1.0-next.4", observedAt: "2026-11-25T06:00:00Z" };
const policy: Policy = {
  version: "2026.11.1",
  unmaintainedAfterMonths: 18,
  staleness: { metadataHours: 48, staticScanDays: 7, smokeDays: 21, attestationDays: 90 },
};

function line(overrides: Partial<VersionLine>): VersionLine {
  return {
    version: "0.1.0",
    tag: null,
    stability: "stable",
    phase: "stable",
    solidRange: "^1.9.0",
    parsed: true,
    admitsSolid2: false,
    clean: true,
    publishedAt: "2026-06-01T00:00:00Z",
    deprecated: false,
    ...overrides,
  };
}

function pkg(overrides: Partial<PackageEvidence>): PackageEvidence {
  return {
    name: "@example/lib",
    family: null,
    category: "state",
    repository: "https://github.com/example/lib",
    dependsOnSolid: true,
    downloadsWeekly: 1000,
    deprecated: false,
    repoArchived: false,
    lastPublishAt: "2026-06-01T00:00:00Z",
    lines: [],
    upstream: { hasSolid2Work: false, isArchived: false, links: [] },
    attestations: [],
    smoke: { import: null, build: null, types: null },
    shipsTypes: true,
    ...overrides,
  };
}

describe("semver helpers", () => {
  it("does not treat a Solid 1 peer cap as admitting Solid 2", () => {
    expect(rangeAdmits("^1.9.8", ["2.0.3", "2.1.0-next.4"])).toBe(false);
  });

  it("accepts dual-support ranges and open ranges", () => {
    expect(rangeAdmits("^1.9 || ^2.0.0", ["2.0.3"])).toBe(true);
    expect(rangeAdmits("*", ["2.0.3"])).toBe(true);
    expect(rangeAdmits(">=2.0.0-0", ["2.0.3"])).toBe(true);
  });

  it("rejects unparseable or missing ranges", () => {
    expect(rangeAdmits("workspace:*", ["2.0.3"])).toBe(false);
    expect(rangeAdmits(null, ["2.0.3"])).toBe(false);
  });

  it("classifies prerelease phases", () => {
    expect(phaseOf("2.0.0-alpha.5")).toBe("alpha");
    expect(phaseOf("2.0.0-rc.6")).toBe("rc");
    expect(phaseOf("2.1.0-next.4")).toBe("next");
    expect(phaseOf("2.0.3")).toBe("stable");
  });

  it("sorts lines newest-first", () => {
    const lines = annotateLines(
      [line({ version: "1.0.0" }), line({ version: "2.0.0" }), line({ version: "1.5.0" })],
      solid,
    );
    expect(lines.map((entry) => entry.version)).toEqual(["2.0.0", "1.5.0", "1.0.0"]);
  });
});

describe("status engine", () => {
  it("marks a stable, clean, admitting release ready", () => {
    const verdict = evaluate(
      pkg({ lines: [line({ version: "2.0.1", solidRange: "^2.0.0", admitsSolid2: true })] }),
      solid,
      policy,
    );
    expect(verdict.status).toBe("ready");
    expect(verdict.solid2Version).toBe("2.0.1");
    expect(verdict.confidence).toContain("D");
    expect(verdict.confidence).toContain("S");
  });

  it("marks a stable, clean, admitting release verified when import smoke passes", () => {
    const verdict = evaluate(
      pkg({
        lines: [line({ version: "2.0.1", solidRange: "^2.0.0" })],
        smoke: { import: true, build: true, types: true },
      }),
      solid,
      policy,
    );
    expect(verdict.status).toBe("ready");
    expect(verdict.verified).toBe(true);
    expect(verdict.confidence).toEqual(["D", "S", "B", "T"]);
  });

  it("reports prerelease when only the next line supports Solid 2", () => {
    const verdict = evaluate(
      pkg({
        lines: [
          line({ version: "0.13.14", tag: "latest", solidRange: "^1.9.8" }),
          line({
            version: "2.0.0-alpha.5",
            tag: "next",
            stability: "prerelease",
            phase: "alpha",
            solidRange: "^2.0.0-0",
          }),
        ],
      }),
      solid,
      policy,
    );
    expect(verdict.status).toBe("prerelease");
    expect(verdict.solid2Version).toBe("2.0.0-alpha.5");
    expect(verdict.solid2Tag).toBe("next");
    expect(verdict.reasons.join(" ")).toContain("newest stable release is 0.13.14");
  });

  it("reports in-progress when upstream work exists", () => {
    const verdict = evaluate(
      pkg({
        lines: [line({ version: "1.4.0" })],
        upstream: {
          hasSolid2Work: true,
          isArchived: false,
          links: ["https://github.com/example/lib/pull/42"],
        },
      }),
      solid,
      policy,
    );
    expect(verdict.status).toBe("in-progress");
    expect(verdict.reasons.join(" ")).toContain("pull/42");
  });

  it("reports blocked for a permissive range with removed imports", () => {
    const verdict = evaluate(
      pkg({ lines: [line({ version: "1.7.0", solidRange: ">=1.7", clean: false })] }),
      solid,
      policy,
    );
    expect(verdict.status).toBe("blocked");
    expect(verdict.reasons.join(" ")).toContain("peer range accepts Solid 2");
  });

  it("reports unmaintained for a deprecated package", () => {
    const verdict = evaluate(
      pkg({ deprecated: true, lines: [line({ version: "1.0.0" })] }),
      solid,
      policy,
    );
    expect(verdict.status).toBe("unmaintained");
    expect(verdict.reasons.join(" ")).toContain("deprecated");
  });

  it("reports unmaintained when there has been no release inside the policy window", () => {
    const verdict = evaluate(
      pkg({ lastPublishAt: "2023-01-01T00:00:00Z", lines: [line({ version: "1.0.0" })] }),
      solid,
      policy,
      new Date("2026-11-25T00:00:00Z"),
    );
    expect(verdict.status).toBe("unmaintained");
    expect(verdict.reasons.join(" ")).toContain("months");
  });

  it("reports agnostic for packages that do not depend on Solid", () => {
    const verdict = evaluate(pkg({ dependsOnSolid: false, lines: [] }), solid, policy);
    expect(verdict.status).toBe("agnostic");
    expect(verdict.confidence).toEqual([]);
  });

  it("reports unknown when nothing decides the case", () => {
    const verdict = evaluate(pkg({ lines: [line({ version: "1.0.0" })] }), solid, policy);
    expect(verdict.status).toBe("blocked");
    const noLines = evaluate(pkg({ lines: [] }), solid, policy);
    expect(noLines.status).toBe("unknown");
    expect(noLines.reasons.join(" ")).toContain("Not enough evidence");
  });

  it("does not let a maintainer attestation override a failing scan silently", () => {
    const verdict = evaluate(
      pkg({
        lines: [line({ version: "1.7.0", clean: false })],
        attestations: [
          {
            claim: "ready",
            version: "1.7.0",
            evidence: "https://github.com/example/lib/actions/runs/1",
            attestedBy: "github:example",
            expires: "2099-01-01",
          },
        ],
      }),
      solid,
      policy,
    );
    expect(verdict.status).toBe("blocked");
    expect(verdict.reasons.join(" ")).toContain("disputed");
  });
});
