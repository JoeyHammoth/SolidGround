import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { DatasetMeta, PackageRecord, Policy } from "@solid-ground/schema";

/**
 * Renders the blocked-package audit from the published dataset. The document is
 * a pure function of an edition, so `--check` can fail when it drifts instead of
 * a maintainer remembering to update prose by hand.
 */

export interface RegistryEntryLike {
  name: string;
  supersededBy?: string | null;
  alternatives?: string[];
}

export interface BlockedReportInput {
  records: PackageRecord[];
  registry: Map<string, RegistryEntryLike>;
  meta: Pick<DatasetMeta, "solid" | "versions" | "coverage">;
  policy: Pick<Policy, "unmaintainedAfterMonths">;
}

function addMonths(iso: string | null, months: number): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function cell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

export function renderBlockedReport(input: BlockedReportInput): string {
  const blocked = input.records
    .filter((record) => record.status === "blocked")
    .sort((a, b) => a.name.localeCompare(b.name));
  const total = input.records.length;
  const months = input.policy.unmaintainedAfterMonths;

  const rows = blocked.map((record) => {
    const latest = record.lines.find((line) => line.stability === "stable") ?? record.lines[0];
    const version = latest?.version ?? null;
    const declares = latest?.solidRange ? `\`${latest.solidRange}\`` : "no `solid-js` range";
    const scan =
      latest?.clean === false
        ? "removed APIs found"
        : latest?.clean === true
          ? "clean"
          : "not scanned";
    const rangeBlocks = latest ? !latest.admitsSolid2 : true;
    const codeBlocks = latest?.clean === false;
    const blockers: string[] = [];
    if (rangeBlocks) blockers.push(`declares ${declares}, which excludes 2.x`);
    if (codeBlocks) blockers.push("published code imports APIs Solid 2 removed");
    if (blockers.length === 0) blockers.push("no stable release admits Solid 2");

    const entry = input.registry.get(record.name);
    const successor = entry?.supersededBy ?? null;
    const unblock = successor
      ? `Nothing for this package: \`${successor}\` is the successor.`
      : codeBlocks
        ? "A release ported to Solid 2; a wider peer range alone would not be enough."
        : "A release whose peer range admits 2.x and targets `@solidjs/web`.";

    return { record, version, declares, scan, blockers, unblock, successor, latest };
  });

  const rangeOnly = rows.filter((row) => !row.latest || row.latest.clean !== false);
  const codeBroken = rows.filter((row) => row.latest?.clean === false);
  const superseded = rows.filter((row) => row.successor !== null);

  const lines: string[] = [
    "# Why the blocked packages are blocked",
    "",
    `Generated from the published edition for Solid stable \`${input.meta.solid.stable2}\`, ` +
      `rules \`${input.meta.versions.rules}\`. Regenerate with ` +
      "`pnpm audit:blocked --data data`; `--check` fails when this file is stale.",
    "",
    `${blocked.length} of ${total} tracked packages are \`blocked\`: none has a published ` +
      "stable release that admits Solid 2.",
    "",
    "| Package | Latest stable | Declares | Static scan | What blocks it | What would unblock it |",
    "|---|---|---|---|---|---|",
  ];

  for (const row of rows) {
    lines.push(
      `| \`${row.record.name}\` | ${row.version ? `\`${row.version}\`` : "—"} | ${row.declares} | ` +
        `${row.scan} | ${cell(row.blockers.join("; "))} | ${cell(row.unblock)} |`,
    );
  }
  lines.push("");

  const watch = rows
    .map((row) => ({
      name: row.record.name,
      version: row.version,
      date: addMonths(row.latest?.publishedAt ?? null, months),
    }))
    .filter((row): row is { name: string; version: string | null; date: string } => row.date !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

  lines.push(`## Unmaintained window (${months} months after the latest stable release)`, "");
  if (watch.length === 0) {
    lines.push("No blocked package has a usable release date.", "");
  } else {
    lines.push("| Package | Latest stable | Window opens |", "|---|---|---|");
    for (const row of watch) {
      lines.push(
        `| \`${row.name}\` | ${row.version ? `\`${row.version}\`` : "—"} | ${row.date} |`,
      );
    }
    lines.push("");
    const soonest = watch[0] as { name: string; date: string };
    lines.push(
      `\`${soonest.name}\` is first, on ${soonest.date}, unless a release lands before then.`,
      "",
    );
  }

  lines.push("## What this means", "");
  lines.push(
    `- ${rangeOnly.length} of ${rows.length} are blocked by the declared peer range alone; ` +
      `${codeBroken.length} also ${codeBroken.length === 1 ? "ships" : "ship"} code that ` +
      "imports APIs Solid 2 removed, so a wider range would not be enough.",
  );
  for (const row of superseded) {
    lines.push(
      `- \`${row.record.name}\` is superseded by \`${row.successor}\`, so the useful action is a ` +
        "different package rather than a new release.",
    );
  }
  lines.push(
    "- The sandbox probes a real subpath when a package exports no root entry. A pass against a " +
      "component subpath is recorded in the artifact's `target` field and is never read as a pass " +
      "against the package root.",
  );
  lines.push("");

  lines.push(
    "## Reproduce",
    "",
    "```bash",
    "# Engine reasons for one record.",
    "git show origin/data:packages/@astrojs__solid-js.json | jq .reasons",
    "",
    "# Re-run one cell; the artifact names the specifier it probed.",
    "printf '%s' '{\"name\":\"@kobalte/core\",\"version\":\"2.0.0-alpha.5\",\"solid\":\"2.0.4\",\"channel\":\"stable\",\"steps\":{\"import\":true,\"build\":true,\"types\":true}}' \\",
    "  | pnpm smoke:run",
    "```",
    "",
  );
  return `${lines.join("\n")}\n`;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function loadRegistry(dir: string): Promise<Map<string, RegistryEntryLike>> {
  const packagesDir = path.join(dir, "packages");
  const names = (await readdir(packagesDir).catch(() => [] as string[]))
    .filter((name) => name.endsWith(".yml"))
    .sort();
  const entries = new Map<string, RegistryEntryLike>();
  for (const name of names) {
    const parsed = parseYaml(await readFile(path.join(packagesDir, name), "utf8")) as RegistryEntryLike;
    if (parsed?.name) entries.set(parsed.name, parsed);
  }
  return entries;
}

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export async function main(argv: string[]): Promise<number> {
  const dataDir = flagValue(argv, "--data") ?? "data";
  const registryDir = flagValue(argv, "--registry") ?? "registry";
  const out = flagValue(argv, "--out") ?? "docs/research/2026-11-blocked-packages.md";
  const check = argv.includes("--check");

  const [meta, policy, registry, records] = await Promise.all([
    readJson<DatasetMeta>(path.join(dataDir, "meta.json")),
    readFile(flagValue(argv, "--policy") ?? "rules/status-policy.yml", "utf8").then(
      (text) => parseYaml(text) as Policy,
    ),
    loadRegistry(registryDir),
    readdir(path.join(dataDir, "packages")).then(async (names) => {
      const all: PackageRecord[] = [];
      for (const name of names.filter((entry) => entry.endsWith(".json")).sort()) {
        all.push(await readJson<PackageRecord>(path.join(dataDir, "packages", name)));
      }
      return all;
    }),
  ]);

  const rendered = renderBlockedReport({ records, registry, meta, policy });

  if (check) {
    const existing = await readFile(out, "utf8").catch(() => null);
    if (existing === null) {
      console.error(`${out} does not exist; run pnpm audit:blocked --data ${dataDir}`);
      return 1;
    }
    if (existing.trim() !== rendered.trim()) {
      console.error(
        `${out} is stale against ${dataDir}; run pnpm audit:blocked --data ${dataDir} and commit the result.`,
      );
      return 1;
    }
    console.log(`${out} matches the published edition`);
    return 0;
  }

  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, rendered, "utf8");
  console.log(`wrote ${out} (${records.filter((record) => record.status === "blocked").length} blocked)`);
  return 0;
}

const invoked = process.argv[1] ?? "";
if (/blocked\.(?:ts|js|mts|mjs)$/.test(invoked)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    },
  );
}
