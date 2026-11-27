#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { IndexRow } from "@solid-ground/schema";

const BLOCKING = new Set(["blocked", "in-progress", "prerelease", "unknown"]);

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value ?? fallback;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function dependenciesOf(pkg: PackageJson): Map<string, string> {
  const result = new Map<string, string>();
  for (const group of [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies]) {
    for (const [name, range] of Object.entries(group ?? {})) result.set(name, range);
  }
  return result;
}

/** Flatten npm lockfile v2/v3 package paths into package names. */
function fromNpmLock(lock: {
  packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>;
}): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(lock.packages ?? {})) {
    if (!key.includes("node_modules/")) continue;
    const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
    if (value.version) result.set(name, value.version);
  }
  return result;
}

function statusLabel(row: IndexRow | undefined): string {
  return row ? row.status : "not tracked";
}

function markdownRow(name: string, range: string, row: IndexRow | undefined): string {
  const fix = row?.solid2Version ? `\`${row.solid2Version}\`` : "-";
  const probed = row?.smokeTarget
    ? `\`${row.smokeTarget}\``
    : row?.smokeTarget === null && row.smokeAt
      ? "root"
      : "—";
  return `| \`${name}\` | \`${range}\` | ${statusLabel(row)} | ${fix} | ${probed} |`;
}

async function main(): Promise<void> {
  const [command, input] = process.argv.slice(2);
  if (command !== "check" || !input) {
    console.log("usage: solid-ground check <package.json|package-lock.json> [--data <dir>]");
    process.exit(2);
  }

  const dataDir = path.resolve(arg("data", "fixtures/dataset"));
  const index = await readJson<IndexRow[]>(path.join(dataDir, "index.json"));
  const byName = new Map(index.map((row) => [row.name, row]));
  const file = path.resolve(input);
  const parsed = await readJson<PackageJson & { packages?: unknown; lockfileVersion?: number }>(file);
  const deps = parsed.lockfileVersion ? fromNpmLock(parsed as never) : dependenciesOf(parsed);

  const tracked = [...deps.entries()].filter(([name]) => byName.has(name));
  const blockers = tracked.filter(([, name]) => name);

  const blocking = tracked.filter(([name]) => {
    const row = byName.get(name);
    return row ? BLOCKING.has(row.status) : false;
  });

  const untrackedSolid = [...deps.keys()].filter(
    (name) => (name === "solid-js" || name.startsWith("@solidjs/")) && !byName.has(name),
  );

  console.log(`# Solid Ground report for ${parsed.name ?? path.basename(file)}\n`);
  console.log(`Checked ${tracked.length} tracked Solid-related dependencies.\n`);
  if (tracked.length === 0) {
    console.log("No tracked Solid packages found. Is this a SolidJS project?\n");
  }

  const ready = tracked.filter(([name]) => byName.get(name)?.status === "ready");
  if (ready.length > 0) {
    console.log("## Ready\n");
    console.log("| Package | Declared | Status | Solid 2 version | Probed |");
    console.log("| --- | --- | --- | --- | --- |");
    for (const [name, range] of ready) console.log(markdownRow(name, range, byName.get(name)));
    console.log("");
  }

  if (blocking.length > 0) {
    console.log("## Blocking the upgrade\n");
    console.log("| Package | Declared | Status | Solid 2 version | Probed |");
    console.log("| --- | --- | --- | --- | --- |");
    for (const [name, range] of blocking) console.log(markdownRow(name, range, byName.get(name)));
    console.log("");
    console.log(
      `Upgrade order: build tooling first, then ready libraries, then prerelease lines. See https://docs.solidjs.com/migration/from-solid-1`,
    );
  }

  if (tracked.length > 0) {
    console.log(
      "`Probed` is the subpath the sandbox imported; `root` means the package root passed; — means no sandboxed pass.",
    );
  }

  if (untrackedSolid.length > 0) {
    console.log("\n## Not tracked\n");
    console.log(untrackedSolid.map((name) => `- \`${name}\``).join("\n"));
    console.log(
      "\nAdd a package: https://github.com/JoeyHammoth/SolidGround/issues/new?template=add-package.yml",
    );
  }

  if (blocking.length > 0) process.exitCode = 1;
  void blockers;
}

await main();
