import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ChangeEvent } from "@solid-ground/schema";
import { dataDir, records } from "./data";

/** Newest first, then by name, so the page and the feed always agree. */
function compare(a: ChangeEvent, b: ChangeEvent): number {
  if (a.at !== b.at) return a.at < b.at ? 1 : -1;
  if (a.name !== b.name) return a.name.localeCompare(b.name);
  return a.kind.localeCompare(b.kind);
}

function loadEvents(): ChangeEvent[] {
  const file = path.join(dataDir, "events.ndjson");
  if (!existsSync(file)) return [];
  const events: ChangeEvent[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as ChangeEvent);
    } catch {
      // One damaged line must not take the whole site down.
    }
  }
  return events.sort(compare);
}

/** Events published with the dataset; empty until the first collect writes one. */
export const events: ChangeEvent[] = loadEvents();

const categoryByName = new Map(records.map((record) => [record.name, record.category]));

export function categoryOf(name: string): string {
  return categoryByName.get(name) ?? "other";
}

export function eventSlug(name: string): string {
  return name.replace(/\//g, "__");
}

const DATASET_KINDS = new Set<ChangeEvent["kind"]>(["rules", "solid", "anomaly"]);

/** Events about the dataset itself, which have no package page to link to. */
export function isDatasetEvent(event: ChangeEvent): boolean {
  return DATASET_KINDS.has(event.kind);
}

/** The value the category filter uses for one event. */
export function categoryValueOf(event: ChangeEvent): string {
  if (event.kind === "summary") return "summary";
  return isDatasetEvent(event) ? "dataset" : categoryOf(event.name);
}

/** The filter value an event maps to, e.g. `became-ready`. */
export function transitionOf(event: ChangeEvent): string {
  switch (event.kind) {
    case "status":
      return `became-${event.to}`;
    case "version":
      return "version";
    case "attestation":
      return "attestation";
    case "rules":
      return "rules";
    case "solid":
      return "solid";
    case "anomaly":
      return "anomaly";
    case "summary":
      return "summary";
    default:
      return "new";
  }
}

export function eventTitle(event: ChangeEvent): string {
  switch (event.kind) {
    case "status":
      return `${event.name} moved from ${event.from} to ${event.to}`;
    case "version":
      return `${event.name} reports Solid 2 in ${event.to}`;
    case "attestation":
      return `An override claiming "${event.from}" expired for ${event.name}`;
    case "rules":
      return `The status rules moved from ${event.from ?? "none"} to ${event.to}`;
    case "solid":
      // A prerelease in `to` marks the `next` line rather than a stable release.
      return event.to.includes("-")
        ? `Solid's next line moved to ${event.to}`
        : `Solid ${event.to} was released`;
    case "anomaly":
      return event.to === "clear"
        ? "The anomaly hold on the dataset was cleared"
        : `The dataset is held: ${event.to}`;
    case "summary":
      return `${event.count ?? 1} changes in ${monthLabel(event.to)}`;
    case "new":
      return `${event.name} is now tracked`;
    default:
      return event.name;
  }
}

export function monthLabel(month: string): string {
  const parsed = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return month;
  return parsed.toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function eventDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
