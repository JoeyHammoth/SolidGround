/// <reference types="astro/client" />
import type { APIRoute } from "astro";
import { meta } from "../lib/data";
import { categoryOf, eventSlug, eventTitle, eventDate, events, transitionOf } from "../lib/events";

const SITE = "https://joeyhammoth.github.io";
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const home = `${SITE}${base}`;

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ??
      character,
  );
}

/** Recent events; older ones live in the changes page and the API. */
const FEED_SIZE = 100;

export const GET: APIRoute = () => {
  const items = events.slice(0, FEED_SIZE);
  const updated = items[0]?.at ?? meta.generatedAt;

  const entries = items
    .map((event) => {
      const link =
        event.kind === "summary"
          ? `${home}/changes/`
          : `${home}/packages/${eventSlug(event.name)}/`;
      const id = `tag:solid-ground,${event.at.slice(0, 4)}:${event.kind}/${eventSlug(event.name)}/${event.from ?? "none"}/${event.at}`;
      const category =
        event.kind === "summary" ? "summary" : categoryOf(event.name);
      const summary =
        event.kind === "summary"
          ? `${event.count ?? 1} changes were compacted into this month's summary.`
          : `${eventTitle(event)}. Verified on ${eventDate(event.at)} against the published dataset.`;
      return [
        "  <entry>",
        `    <title>${escapeXml(eventTitle(event))}</title>`,
        `    <link href="${escapeXml(link)}"/>`,
        `    <id>${escapeXml(id)}</id>`,
        `    <updated>${escapeXml(event.at)}</updated>`,
        `    <category term="${escapeXml(transitionOf(event))}"/>`,
        `    <category term="${escapeXml(category)}"/>`,
        `    <summary>${escapeXml(summary)}</summary>`,
        "  </entry>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    "  <title>Solid Ground — changes</title>",
    "  <subtitle>SolidJS 2 readiness status changes, derived from the published dataset.</subtitle>",
    `  <id>${escapeXml(`${home}/changes/`)}</id>`,
    `  <link rel="self" type="application/atom+xml" href="${escapeXml(`${home}/feed.xml`)}"/>`,
    `  <link rel="alternate" type="text/html" href="${escapeXml(`${home}/changes/`)}"/>`,
    `  <updated>${escapeXml(updated)}</updated>`,
    "  <author>",
    "    <name>Solid Ground</name>",
    `    <uri>${escapeXml(home)}</uri>`,
    "  </author>",
    `  <generator uri="https://github.com/JoeyHammoth/SolidGround">solid-ground</generator>`,
    entries,
    "</feed>",
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(`${xml}\n`, {
    headers: { "content-type": "application/atom+xml; charset=utf-8" },
  });
};
