import semver from "semver";
import type {
  EvidenceLevel,
  PackageEvidence,
  PackageRecord,
  Phase,
  Policy,
  SolidState,
  Status,
  VersionLine,
  Verdict,
} from "@solid-ground/schema";

export const MIGRATION_URL = "https://docs.solidjs.com/migration/from-solid-1";

/** True when a declared range accepts at least one of the given versions. */
export function rangeAdmits(range: string | null, versions: Array<string | null>): boolean {
  if (!range) return false;
  const parsed = semver.validRange(range, { loose: true });
  if (!parsed) return false;
  return versions.some((version) => {
    if (!version) return false;
    const candidate = semver.valid(version);
    if (!candidate) return false;
    return semver.satisfies(candidate, parsed, { includePrerelease: true });
  });
}

export function phaseOf(version: string): Phase {
  const parsed = semver.parse(version);
  if (!parsed) return "dev";
  if (parsed.prerelease.length === 0) return "stable";
  const first = String(parsed.prerelease[0] ?? "").toLowerCase();
  if (first === "rc") return "rc";
  if (first === "beta") return "beta";
  if (first === "alpha") return "alpha";
  if (first === "next") return "next";
  return "dev";
}

export function stabilityOf(version: string): "stable" | "prerelease" {
  const parsed = semver.parse(version);
  return parsed && parsed.prerelease.length === 0 ? "stable" : "prerelease";
}

function compareVersions(a: VersionLine, b: VersionLine): number {
  const av = semver.valid(a.version);
  const bv = semver.valid(b.version);
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return semver.rcompare(av, bv);
}

/** Mark which lines admit Solid 2, given the Solid versions under test. */
export function annotateLines(
  lines: VersionLine[],
  solid: Pick<SolidState, "stable2" | "next">,
): VersionLine[] {
  const tested = [solid.stable2, solid.next];
  return lines
    .map((line) => ({
      ...line,
      parsed: Boolean(semver.validRange(line.solidRange ?? "", { loose: true })),
      admitsSolid2: rangeAdmits(line.solidRange, tested),
    }))
    .sort(compareVersions);
}

function monthsBetween(from: string, to: Date): number {
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return (to.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

function formatRange(range: string | null): string {
  return range ? `\`${range}\`` : "no declared `solid-js` range";
}

function cleanState(line: VersionLine): "clean" | "dirty" | "unscanned" {
  if (line.clean === true) return "clean";
  if (line.clean === false) return "dirty";
  return "unscanned";
}

function confidenceFor(status: Status, lines: VersionLine[], evidence: PackageEvidence): EvidenceLevel[] {
  const levels = new Set<EvidenceLevel>();
  const candidates = lines.filter((line) => line.admitsSolid2);
  if (candidates.length > 0) levels.add("D");
  if (candidates.some((line) => line.clean === true)) levels.add("S");
  if (status === "ready" && evidence.smoke.import === true) {
    levels.add("B");
    if (evidence.shipsTypes && evidence.smoke.types === true) levels.add("T");
  }
  if (evidence.attestations.length > 0) levels.add("A");
  return ["D", "S", "B", "T", "A", "U"].filter((level) =>
    levels.has(level as EvidenceLevel),
  ) as EvidenceLevel[];
}

function recommended(lines: VersionLine[], predicate: (line: VersionLine) => boolean): VersionLine | null {
  const matches = lines.filter(predicate);
  return matches[0] ?? null;
}

function verdict(
  status: Status,
  lines: VersionLine[],
  evidence: PackageEvidence,
  reasons: string[],
): Verdict {
  const chosen =
    recommended(lines, (line) => line.stability === "stable" && line.admitsSolid2) ??
    recommended(lines, (line) => line.admitsSolid2);
  return {
    status,
    confidence: confidenceFor(status, lines, evidence),
    verified: status === "ready" && evidence.smoke.import === true,
    reasons,
    recommendedVersion: chosen?.version ?? null,
    solid2Version: chosen?.version ?? null,
    solid2Tag: chosen?.tag ?? null,
  };
}

/**
 * The status engine. Pure: the same evidence, Solid state and policy always
 * produce the same verdict, so a data diff is always reviewable.
 */
export function evaluate(
  evidence: PackageEvidence,
  solid: SolidState,
  policy: Policy,
  now: Date = new Date(),
): Verdict {
  const lines = annotateLines(evidence.lines, solid);

  if (!evidence.dependsOnSolid) {
    return verdict("agnostic", lines, evidence, [
      "No `solid-js` dependency or peer range is declared, so Solid 2 does not apply.",
    ]);
  }

  const reasons: string[] = [];
  const stableReady = lines.filter(
    (line) => line.stability === "stable" && line.admitsSolid2 && line.clean !== false,
  );
  const preReady = lines.filter(
    (line) => line.stability !== "stable" && line.admitsSolid2 && line.clean !== false,
  );
  const stableLatest = lines.find((line) => line.stability === "stable") ?? null;

  if (stableReady.length > 0) {
    const line = stableReady[0] as VersionLine;
    reasons.push(
      `Stable release ${line.version} admits Solid 2 (${formatRange(line.solidRange)}).`,
    );
    const state = cleanState(line);
    if (state === "clean") {
      reasons.push("Static scan of the published code found no removed Solid 1 APIs.");
    } else if (state === "unscanned") {
      reasons.push("The published code has not been statically scanned yet.");
    }
    if (evidence.smoke.import === true) {
      reasons.push("The package imported successfully in a Solid 2 sandbox.");
    }
    return verdict("ready", lines, evidence, reasonsWithAttestations(reasons, evidence, "ready"));
  }

  if (preReady.length > 0) {
    const line = preReady[0] as VersionLine;
    reasons.push(
      `Only a prerelease line admits Solid 2: ${line.version}${line.tag ? ` (dist-tag ${line.tag})` : ""}.`,
    );
    if (stableLatest) {
      reasons.push(
        `The newest stable release is ${stableLatest.version} with ${formatRange(stableLatest.solidRange)}, which does not admit Solid 2.`,
      );
    }
    return verdict("prerelease", lines, evidence, reasonsWithAttestations(reasons, evidence, "prerelease"));
  }

  if (evidence.upstream.hasSolid2Work) {
    reasons.push("No Solid 2 release yet, but upstream work toward Solid 2 is visible.");
    for (const link of evidence.upstream.links.slice(0, 3)) reasons.push(`Upstream: ${link}`);
    return verdict("in-progress", lines, evidence, reasonsWithAttestations(reasons, evidence, "in-progress"));
  }

  if (
    evidence.deprecated ||
    evidence.repoArchived ||
    evidence.upstream.isArchived ||
    stale(evidence, policy, now)
  ) {
    if (evidence.deprecated) reasons.push("The package is deprecated on npm.");
    if (evidence.repoArchived || evidence.upstream.isArchived) {
      reasons.push("The upstream repository is archived.");
    }
    if (stale(evidence, policy, now) && evidence.lastPublishAt) {
      const months = Math.floor(monthsBetween(evidence.lastPublishAt, now));
      reasons.push(`No release has been published for ${months} months.`);
    }
    return verdict("unmaintained", lines, evidence, reasonsWithAttestations(reasons, evidence, "unmaintained"));
  }

  const caps = lines.filter((line) => !line.admitsSolid2);
  const dirty = lines.filter((line) => line.clean === false);
  if (caps.length > 0 || dirty.length > 0) {
    if (stableLatest) {
      reasons.push(
        `The newest stable release ${stableLatest.version} declares ${formatRange(stableLatest.solidRange)} and does not admit Solid 2.`,
      );
    }
    if (dirty.length > 0) {
      reasons.push(
        `Published code in ${dirty[0]?.version} imports APIs that Solid 2 removed (see static findings).`,
      );
    }
    const permissive = lines.filter((line) => line.admitsSolid2 && line.clean === false);
    if (permissive.length > 0) {
      reasons.push("The peer range accepts Solid 2 but the shipped code imports removed APIs.");
    }
    return verdict("blocked", lines, evidence, reasonsWithAttestations(reasons, evidence, "blocked"));
  }

  reasons.push("Not enough evidence to decide yet.");
  return verdict("unknown", lines, evidence, reasonsWithAttestations(reasons, evidence, "unknown"));
}

function stale(evidence: PackageEvidence, policy: Policy, now: Date): boolean {
  if (!evidence.lastPublishAt) return false;
  return monthsBetween(evidence.lastPublishAt, now) >= policy.unmaintainedAfterMonths;
}

function reasonsWithAttestations(
  reasons: string[],
  evidence: PackageEvidence,
  derived: Status,
): string[] {
  const active = evidence.attestations.filter(
    (attestation) => new Date(attestation.expires).getTime() > Date.now(),
  );
  if (active.length === 0) return reasons;
  const claims = active.map((attestation) => attestation.claim);
  const out = [...reasons];
  if (claims.includes(derived)) {
    out.push(
      `A maintainer attestation supports this status (evidence: ${active[0]?.evidence}, expires ${active[0]?.expires}).`,
    );
  } else {
    out.push(
      `A maintainer attestation claims "${claims[0]}" for ${active[0]?.version}, which conflicts with the evidence above and is shown as disputed.`,
    );
  }
  return out;
}

export function toRecord(
  evidence: PackageEvidence,
  verdictResult: Verdict,
  solid: SolidState,
  policy: Policy,
  checkedAt: string,
  toolVersion: string,
): PackageRecord {
  return {
    schemaVersion: 1,
    name: evidence.name,
    family: evidence.family,
    category: evidence.category,
    repository: evidence.repository,
    lines: annotateLines(evidence.lines, solid),
    upstream: evidence.upstream,
    attestations: evidence.attestations,
    smoke: evidence.smoke,
    shipsTypes: evidence.shipsTypes,
    checkedAt,
    tested: {
      solid: solid.stable2,
      solidNext: solid.next,
      rules: policy.version,
      tool: toolVersion,
    },
    downloadsWeekly: evidence.downloadsWeekly,
    links: {
      npm: `https://www.npmjs.com/package/${evidence.name}`,
      repository: evidence.repository,
      migration: MIGRATION_URL,
    },
    ...verdictResult,
  };
}
