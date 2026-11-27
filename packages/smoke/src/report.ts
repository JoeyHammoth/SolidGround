import type {
  EvidenceLevel,
  PackageRecord,
  Policy,
  SmokeChannel,
  SmokeResult,
  SmokeResults,
  SolidState,
} from "@solid-ground/schema";

const DAY_MS = 86_400_000;
const EVIDENCE_ORDER: EvidenceLevel[] = ["D", "S", "B", "T", "A", "U"];

/** True when a result is recent enough to stand behind a record. */
export function isFresh(at: string, now: Date, days: number): boolean {
  const time = new Date(at).getTime();
  if (Number.isNaN(time)) return false;
  return now.getTime() - time <= days * DAY_MS;
}

export interface SmokeRun {
  name: string;
  version: string;
  solid: string;
  channel: SmokeChannel;
  smoke: SmokeResults;
  at: string;
  entry?: string | null;
  /** The subpath tested, or null when the package root was. */
  target?: string | null;
  durationMs?: number | null;
  error?: string | null;
}

/** One artifact line. Optional fields are written as null, never omitted. */
export function smokeResult(run: SmokeRun): SmokeResult {
  return {
    schemaVersion: 1,
    name: run.name,
    version: run.version,
    solid: run.solid,
    channel: run.channel,
    smoke: run.smoke,
    entry: run.entry ?? null,
    target: run.target ?? null,
    durationMs: run.durationMs ?? null,
    error: run.error ?? null,
    at: run.at,
  };
}

/**
 * An environmental failure — registry 429, install timeout, runner OOM. Every
 * step is `null` and the reason is carried in `error`, so nothing downstream can
 * read infrastructure trouble as "this package does not work".
 */
export function environmentalFailure(run: {
  name: string;
  version: string;
  solid: string;
  channel: SmokeChannel;
  at: string;
  error: string;
}): SmokeResult {
  return smokeResult({
    ...run,
    smoke: { import: null, build: null, types: null },
  });
}

/** Evidence levels implied by one set of smoke results. */
function levelsFor(record: PackageRecord, smoke: SmokeResults): EvidenceLevel[] {
  const levels = new Set<EvidenceLevel>(
    record.confidence.filter((level) => level !== "B" && level !== "T"),
  );
  if (record.status === "ready" && smoke.import === true) {
    levels.add("B");
    if (record.shipsTypes && smoke.types === true) levels.add("T");
  }
  return EVIDENCE_ORDER.filter((level) => levels.has(level));
}

function applySmoke(
  record: PackageRecord,
  smoke: SmokeResults,
  smokeAt: string | null,
): PackageRecord {
  return {
    ...record,
    smoke,
    smokeAt,
    verified: record.status === "ready" && smoke.import === true,
    confidence: levelsFor(record, smoke),
  };
}

/**
 * True when the pass already on the record has aged out of the policy window.
 * An edition published before `smokeAt` existed has no age to check, so it is
 * left alone rather than silently downgraded.
 */
function passHasAgedOut(
  record: PackageRecord,
  policy: Policy,
  now: Date,
): boolean {
  if (record.smokeAt === null || record.smokeAt === undefined) return false;
  return !isFresh(record.smokeAt, now, policy.staleness.smokeDays);
}

/**
 * Fold the freshest stable-channel result into a record. Pure: `solid` and `now`
 * are arguments, so the same inputs always produce the same record.
 *
 * A cell only applies to the version and Solid release it names — a pass on
 * `2.0.0-rc.1` never stands behind a record recommending `2.0.4`, and a pass
 * against an older Solid release stops counting once Solid moves, because the
 * record's `verified` claim is then about a version nobody installs any more.
 */
export function foldSmoke(
  record: PackageRecord,
  results: SmokeResult[],
  policy: Policy,
  solid: SolidState,
  now: Date = new Date(),
): PackageRecord {
  const version = record.recommendedVersion;
  if (version === null) return record;

  const fresh = results
    .filter(
      (result) =>
        result.name === record.name &&
        result.channel === "stable" &&
        result.solid === solid.stable2 &&
        result.version === version &&
        // An environmental failure (registry 429, install timeout) knows
        // nothing about the package; it must never withdraw a pass.
        result.error === null,
    )
    .filter((result) => isFresh(result.at, now, policy.staleness.smokeDays))
    .sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? 1 : -1));

  const best = fresh[0];
  if (!best) {
    if (!record.verified) return record;
    // Two ways a pass stops standing behind a record: Solid has moved since it
    // ran, or it is simply older than the policy window while Solid stood still.
    const solidMoved = record.tested.solid !== solid.stable2;
    if (!solidMoved && !passHasAgedOut(record, policy, now)) return record;
    return applySmoke(record, { import: null, build: null, types: null }, null);
  }

  return applySmoke(
    record,
    {
      import: best.smoke.import,
      build: best.smoke.build,
      types: best.smoke.types,
    },
    best.at,
  );
}
