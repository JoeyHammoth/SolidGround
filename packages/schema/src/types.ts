/**
 * Shared domain types for the Solid Ground dataset.
 *
 * These types are the contract between the collector, the status engine, the
 * site and the CLI. Anything that crosses a stage boundary is plain JSON.
 */

export const STATUSES = [
  "ready",
  "prerelease",
  "in-progress",
  "blocked",
  "unmaintained",
  "agnostic",
  "unknown",
] as const;

export type Status = (typeof STATUSES)[number];

export type EvidenceLevel = "D" | "S" | "B" | "T" | "A" | "U";

export type Stability = "stable" | "prerelease";

export type Phase = "stable" | "alpha" | "beta" | "rc" | "next" | "dev";

export interface Attestation {
  /** The status the maintainer claims. */
  claim: Status;
  version: string;
  /** Public evidence link, normally a CI run. */
  evidence: string;
  /** `github:handle` or `npm:handle`. Public handles only. */
  attestedBy: string;
  /** ISO date after which the claim is no longer displayed as current. */
  expires: string;
}

export interface SmokeResults {
  import: boolean | null;
  build: boolean | null;
  types: boolean | null;
}

/** Which Solid release line a cell was tested against. */
export type SmokeChannel = "stable" | "next";

/**
 * One sandboxed verification cell, published as JSON so a run can be audited
 * after the runner is gone. `error` is an environmental failure (registry 429,
 * timeout): the affected steps stay `null`, never `false`.
 */
export interface SmokeResult {
  schemaVersion: 1;
  name: string;
  version: string;
  /** The `solid-js` version installed for the cell. */
  solid: string;
  channel: SmokeChannel;
  smoke: SmokeResults;
  /** Which entry point the import step exercised, or null when it did not run. */
  entry: string | null;
  durationMs: number | null;
  error: string | null;
  /** When the cell finished, ISO. Freshness is measured from here. */
  at: string;
}

/** A release line of a package: the version, its channel and what it declares. */
export interface VersionLine {
  version: string;
  /** The dist-tag pointing at this version, when there is one. */
  tag: string | null;
  stability: Stability;
  phase: Phase;
  /** The raw `solid-js` range declared in peer/dependencies, or null. */
  solidRange: string | null;
  /** False when the range could not be parsed as semver. */
  parsed: boolean;
  /** True when the range accepts a Solid 2 version. */
  admitsSolid2: boolean;
  /** Static-scan result for this version: null means not scanned yet. */
  clean: boolean | null;
  publishedAt: string | null;
  deprecated: boolean;
}

export interface UpstreamSignals {
  hasSolid2Work: boolean;
  isArchived: boolean;
  links: string[];
  lastPushAt?: string | null;
}

export interface SolidState {
  /** Highest stable 2.x version, e.g. "2.0.3". */
  stable2: string;
  /** Highest prerelease of the next line, e.g. "2.1.0-next.4". */
  next: string | null;
  /** ISO timestamp of the observation. */
  observedAt: string;
}

export interface Policy {
  version: string;
  unmaintainedAfterMonths: number;
  staleness: {
    metadataHours: number;
    staticScanDays: number;
    smokeDays: number;
    attestationDays: number;
  };
}

/** Input to the status engine. No network access, no clock reads. */
export interface PackageEvidence {
  name: string;
  family: string | null;
  category: string;
  repository: string | null;
  dependsOnSolid: boolean;
  downloadsWeekly: number | null;
  deprecated: boolean;
  repoArchived: boolean;
  lastPublishAt: string | null;
  lines: VersionLine[];
  upstream: UpstreamSignals;
  attestations: Attestation[];
  smoke: SmokeResults;
  /** Whether the package ships its own type declarations. */
  shipsTypes: boolean;
}

export interface Verdict {
  status: Status;
  confidence: EvidenceLevel[];
  verified: boolean;
  reasons: string[];
  /** The version a user should reach for, when there is one. */
  recommendedVersion: string | null;
  /** The lowest version known to admit Solid 2. */
  solid2Version: string | null;
  /** Channel for `solid2Version`: latest, next, etc. */
  solid2Tag: string | null;
}

/** The published per-package record. */
export interface PackageRecord extends Verdict {
  schemaVersion: 1;
  name: string;
  family: string | null;
  category: string;
  repository: string | null;
  lines: VersionLine[];
  upstream: UpstreamSignals;
  attestations: Attestation[];
  smoke: SmokeResults;
  /**
   * When the folded smoke result finished, or null when no pass stands behind
   * the record. Absent on editions published before the field existed; those are
   * aged out by the moved-Solid rule only.
   */
  smokeAt?: string | null;
  shipsTypes: boolean;
  checkedAt: string;
  tested: {
    solid: string;
    solidNext: string | null;
    rules: string;
    tool: string;
  };
  downloadsWeekly: number | null;
  links: {
    npm: string;
    repository: string | null;
    migration: string;
  };
}

export interface IndexRow {
  name: string;
  status: Status;
  confidence: EvidenceLevel[];
  verified: boolean;
  solid2Version: string | null;
  category: string;
  family: string | null;
  downloadsWeekly: number | null;
  checkedAt: string;
}

export interface DatasetMeta {
  schemaVersion: 1;
  generatedAt: string;
  lastSuccessfulCollect: string | null;
  lastSuccessfulVerify: string | null;
  solid: SolidState;
  counts: Record<Status, number> & { total: number };
  versions: { rules: string; tool: string; schema: number };
  coverage: { tracked: number; curated: number; candidates: number };
  anomaly: { held: boolean; reasons: string[] };
}

export interface SolidFile extends SolidState {
  schemaVersion: 1;
  distTags: Record<string, string>;
  surfaceHash: string | null;
  docsHash: string | null;
}

/**
 * One change event. Package events are derived by diffing two package records;
 * dataset events (`rules`, `solid`, `anomaly`) by diffing two `meta.json`
 * editions. `summary` replaces events older than the retention window: one line
 * per calendar month.
 */
export interface ChangeEvent {
  schemaVersion: 1;
  /** A package name, or the dataset subject: `solid-js`, `rules`, `dataset`. */
  name: string;
  /**
   * `next.checkedAt` for a record and `next.generatedAt` for the dataset — never
   * a clock read. For a summary, the month's last event.
   */
  at: string;
  kind:
    | "new"
    | "status"
    | "version"
    | "attestation"
    | "rules"
    | "solid"
    | "anomaly"
    | "summary";
  from: string | null;
  /** For `solid`, a prerelease version means the `next` line rather than stable. */
  to: string;
  /** For `summary` only: how many events the summary stands in for. */
  count?: number;
}
