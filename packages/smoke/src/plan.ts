import type { PackageRecord, SmokeChannel, SmokeResult, SolidState } from "@solid-ground/schema";
import { isFresh } from "./report.js";

export interface SmokeCell {
  name: string;
  version: string;
  /** The `solid-js` version installed for the cell. */
  solid: string;
  channel: SmokeChannel;
}

export interface PlanOptions {
  records: PackageRecord[];
  solid: SolidState;
  /** Results already published, used to skip cells that are still fresh. */
  known?: SmokeResult[];
  /** A cell newer than this many days is not planned again. */
  staleAfterDays?: number;
  /** Re-test every cell, ignoring what is known. */
  force?: boolean;
  /** Adds the `next` channel when Solid publishes a prerelease. */
  includeNext?: boolean;
  now?: Date;
  /** Hard cap per batch, so one run cannot grow without bound. */
  maxCells?: number;
}

export const DEFAULT_MAX_CELLS = 20;
export const DEFAULT_STALE_AFTER_DAYS = 7;

/** Stable identity for a cell, and the key used to look up a known result. */
export function cellId(cell: Pick<SmokeCell, "name" | "version" | "solid">): string {
  return `${cell.name}@${cell.version}~${cell.solid}`;
}

/**
 * Choose the cells worth running. Pure: it reads only its arguments.
 *
 * A record is only planned when it has a `recommendedVersion`, because that is
 * the version a fold would apply to — testing anything else produces a result
 * with nowhere to go. Fresh results are skipped unless `force` is set, and the
 * batch stops at `maxCells` so the matrix rotates instead of growing.
 */
export function planBatch(options: PlanOptions): SmokeCell[] {
  const now = options.now ?? new Date();
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const maxCells = options.maxCells ?? DEFAULT_MAX_CELLS;

  const fresh = new Set<string>();
  if (!options.force) {
    for (const result of options.known ?? []) {
      if (isFresh(result.at, now, staleAfterDays)) fresh.add(cellId(result));
    }
  }

  const cells: SmokeCell[] = [];
  const records = [...options.records].sort((a, b) => a.name.localeCompare(b.name));
  for (const record of records) {
    const version = record.recommendedVersion;
    if (version === null) continue;

    const candidates: SmokeCell[] = [
      { name: record.name, version, solid: options.solid.stable2, channel: "stable" },
    ];
    if (options.includeNext !== false && options.solid.next !== null) {
      candidates.push({ name: record.name, version, solid: options.solid.next, channel: "next" });
    }

    for (const cell of candidates) {
      if (fresh.has(cellId(cell))) continue;
      cells.push(cell);
      if (cells.length >= maxCells) return cells;
    }
  }
  return cells;
}
