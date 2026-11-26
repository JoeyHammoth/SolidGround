/**
 * Scanner accuracy measurement.
 *
 * Runs the real scanner and an independent, deliberately naive oracle over the
 * same published files, then reports where they agree. The oracle uses regular
 * expressions over the raw text; the scanner uses es-module-lexer. Neither is
 * ground truth, which is why disagreements are adjudicated by hand in
 * `adjudication.json` before the numbers are quoted anywhere.
 *
 * Run with `pnpm eval:scanner`. Needs network access; not part of `pnpm ci`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RemovedRules } from "../src/analyze.js";
import { loadRules, REPO_ROOT, scanPackage } from "../src/index.js";
import { ANALYSABLE } from "../src/resolve.js";
import { loadSurface, surfaceNames, type Surface } from "../src/surface.js";
import { extractArchive, readArchiveFile, verifyIntegrity } from "../src/tarball.js";
import { DEFAULT_LIMITS } from "../src/limits.js";

const REGISTRY = "https://registry.npmjs.org";
const USER_AGENT =
  "solid-ground-scanner-eval/0.1 (+https://github.com/JoeyHammoth/SolidGround; static scan, no execution)";
const EVAL_DIR = path.join(REPO_ROOT, "packages", "scanner", "eval");

/** Codes the oracle can also see. `unknown-export` is deliberately excluded: the
 * oracle has no export surface of its own, so it cannot have an opinion there. */
const COMPARABLE = new Set(["removed-subpath", "missing-export", "type-ownership"]);
const SOLID_ENTRIES = new Set(["solid-js", "@solidjs/web", "@solidjs/signals"]);
const TYPE_OWNERSHIP = new Set(["JSX", "ComponentProps", "JSXElement", "JSXElementChildrenAttribute"]);

interface CorpusEntry {
  name: string;
  version: string;
  note?: string;
}

interface Corpus {
  capturedAt: string;
  note: string;
  packages: CorpusEntry[];
}

interface OracleFinding {
  file: string;
  code: "removed-subpath" | "missing-export" | "type-ownership";
  specifier: string | null;
  name: string | null;
}

type Verdict = "confirmed" | "rejected" | "missed" | "not-an-issue" | "pending";

interface Adjudication {
  notes?: string;
  entries: (OracleFinding & { package: string; verdict: Verdict; reason: string })[];
}

function encodePackage(name: string): string {
  return encodeURIComponent(name).replace(/%40/g, "@");
}

async function getJson(url: string): Promise<Record<string, any>> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as Record<string, any>;
}

async function getBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function splitNames(clause: string): string[] {
  return clause
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]
        ?.trim(),
    )
    .filter((name): name is string => Boolean(name));
}

/** Per-file oracle. Same question as the scanner, different mechanics. */
function oracleFile(
  file: string,
  code: string,
  rules: RemovedRules,
  surface: Surface,
): OracleFinding[] {
  const found: OracleFinding[] = [];
  const seen = new Set<string>();
  const push = (finding: OracleFinding) => {
    const key = `${finding.code}|${finding.specifier}|${finding.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push(finding);
  };

  const named: { specifier: string; clause: string }[] = [];
  // No space required after `import`: minified ESM writes `import{a}from"x"`.
  for (const match of code.matchAll(/import\s*([\s\S]{0,500}?)from\s*["']([^"']+)["']/g)) {
    named.push({ clause: match[1] ?? "", specifier: match[2] ?? "" });
  }
  const reexports: string[] = [];
  for (const match of code.matchAll(
    /export\s+(?:\*(?:\s+as\s+\w+)?|\{[\s\S]*?\})\s*from\s*["']([^"']+)["']/g,
  )) {
    if (match[1]) reexports.push(match[1]);
  }
  const bare: string[] = [];
  for (const match of code.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g)) {
    if (match[1]) bare.push(match[1]);
  }
  const dynamic: string[] = [];
  for (const match of code.matchAll(/(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    if (match[1]) dynamic.push(match[1]);
  }

  const specifiers = [...named.map((entry) => entry.specifier), ...reexports, ...bare, ...dynamic];
  for (const specifier of specifiers) {
    if (rules.subpaths.some((rule) => rule.from === specifier)) {
      push({ file, code: "removed-subpath", specifier, name: null });
    }
  }

  for (const { specifier, clause } of named) {
    if (!SOLID_ENTRIES.has(specifier)) continue;
    const typeOnly = /^\s*type\s/.test(clause);
    const surfaceFor = surfaceNames(surface, specifier);
    for (const match of clause.matchAll(/\{([\s\S]*?)\}/g)) {
      for (const name of splitNames(match[1] ?? "")) {
        if (typeOnly && TYPE_OWNERSHIP.has(name) && specifier === "solid-js") {
          push({ file, code: "type-ownership", specifier, name });
          continue;
        }
        // Missing from the surface *and* named in the curated removal list: the
        // same two conditions the scanner applies.
        if (surfaceFor.has(name)) continue;
        if (rules.exports.some((rule) => rule.from === name)) {
          push({ file, code: "missing-export", specifier, name });
        }
      }
    }
  }

  return found;
}

async function oracleScan(
  entry: CorpusEntry,
  rules: RemovedRules,
  surface: Surface,
): Promise<{ files: string[]; findings: OracleFinding[] }> {
  const metadata = await getJson(`${REGISTRY}/${encodePackage(entry.name)}/${entry.version}`);
  const tarball = metadata.dist?.tarball as string | undefined;
  const integrity = metadata.dist?.integrity as string | undefined;
  if (!tarball || !integrity) throw new Error(`${entry.name}@${entry.version} has no dist metadata`);

  const buffer = await getBytes(tarball);
  if (!verifyIntegrity(buffer, integrity).matches) {
    throw new Error(`${entry.name}@${entry.version} failed integrity verification`);
  }

  const archive = await extractArchive(buffer, DEFAULT_LIMITS);
  try {
    const prefix = archive.files.includes("package/package.json") ? "package/" : "";
    const files: string[] = [];
    const findings: OracleFinding[] = [];
    for (const archivePath of archive.files) {
      if (!archivePath.startsWith(prefix)) continue;
      const relative = archivePath.slice(prefix.length);
      if (!relative || !ANALYSABLE.test(relative)) continue;
      let code: string;
      try {
        code = await readArchiveFile(archive, archivePath, DEFAULT_LIMITS);
      } catch {
        continue;
      }
      files.push(relative);
      findings.push(...oracleFile(relative, code, rules, surface));
    }
    return { files, findings };
  } finally {
    await archive.cleanup();
  }
}

function keyOf(finding: { file: string; code: string; specifier: string | null; name: string | null }): string {
  return `${finding.file}|${finding.code}|${finding.specifier ?? ""}|${finding.name ?? ""}`;
}

function percent(numerator: number, denominator: number): string {
  return denominator === 0 ? "n/a" : `${((numerator / denominator) * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  const corpus = JSON.parse(await readFile(path.join(EVAL_DIR, "corpus.json"), "utf8")) as Corpus;
  const rules = await loadRules(path.join(REPO_ROOT, "rules"));
  const surface = await loadSurface(path.join(REPO_ROOT, "rules", "solid2-surface.json"));
  const adjudication = JSON.parse(
    await readFile(path.join(EVAL_DIR, "adjudication.json"), "utf8"),
  ) as Adjudication;
  const verdicts = new Map(
    adjudication.entries.map((entry) => [
      `${entry.package}|${keyOf(entry)}`,
      { verdict: entry.verdict, reason: entry.reason },
    ]),
  );

  const results: any[] = [];
  let truePositives = 0;
  let confirmed = 0;
  let rejected = 0;
  let missed = 0;
  let oracleFalseAlarms = 0;
  const pending: any[] = [];

  for (const entry of corpus.packages) {
    const record: any = { name: entry.name, version: entry.version, note: entry.note };
    try {
      const scan = await scanPackage(entry.name, entry.version);
      const oracle = await oracleScan(entry, rules, surface);
      const oracleInFiles = oracle.findings.filter((finding) => scan.files.includes(finding.file));
      // Findings the oracle sees in files the scanner never opened. Not counted
      // as misses — those files are outside the entry-point graph — but worth
      // reporting, because they bound how much published code the scan covers.
      const outsideGraph = oracle.findings.filter((finding) => !scan.files.includes(finding.file));
      const scannerComparable = scan.findings
        .filter((finding) => COMPARABLE.has(finding.code))
        .map((finding) => ({
          file: finding.file,
          code: finding.code,
          specifier: finding.specifier,
          name: finding.name,
          hint: finding.hint,
        }));

      const scannerKeys = new Map(scannerComparable.map((finding) => [keyOf(finding), finding]));
      const oracleKeys = new Map(oracleInFiles.map((finding) => [keyOf(finding), finding]));

      const both = [...scannerKeys.keys()].filter((key) => oracleKeys.has(key));
      const onlyScanner = [...scannerKeys.entries()].filter(([key]) => !oracleKeys.has(key));
      const onlyOracle = [...oracleKeys.entries()].filter(([key]) => !scannerKeys.has(key));

      truePositives += both.length;

      for (const [key, finding] of onlyScanner) {
        const verdict = verdicts.get(`${entry.name}|${key}`);
        if (!verdict) pending.push({ package: entry.name, ...finding, side: "scanner-only" });
        else if (verdict.verdict === "confirmed") confirmed += 1;
        else if (verdict.verdict === "rejected") rejected += 1;
        else pending.push({ package: entry.name, ...finding, side: "scanner-only", verdict });
      }
      for (const [key, finding] of onlyOracle) {
        const verdict = verdicts.get(`${entry.name}|${key}`);
        if (!verdict) pending.push({ package: entry.name, ...finding, side: "oracle-only" });
        else if (verdict.verdict === "missed") missed += 1;
        else if (verdict.verdict === "not-an-issue") oracleFalseAlarms += 1;
        else pending.push({ package: entry.name, ...finding, side: "oracle-only", verdict });
      }

      const byCode = scan.findings.reduce<Record<string, number>>((counts, finding) => {
        counts[finding.code] = (counts[finding.code] ?? 0) + 1;
        return counts;
      }, {});

      Object.assign(record, {
        status: "measured",
        byCode,
        files: scan.files.length,
        oracleFiles: oracle.files.length,
        oracleOutsideGraph: outsideGraph.length,
        clean: scan.clean,
        findings: scan.findings.length,
        agreed: both.length,
        scannerOnly: onlyScanner.map(([, finding]) => finding),
        oracleOnly: onlyOracle.map(([, finding]) => finding),
      });
    } catch (error) {
      record.status = "error";
      record.error = (error as Error).message;
    }
    results.push(record);
    const counts = record.status === "measured"
      ? `${record.agreed} agreed, ${record.scannerOnly.length} scanner-only, ${record.oracleOnly.length} oracle-only`
      : record.error;
    console.log(`${entry.name}@${entry.version}: ${counts}`);
  }

  const detected = truePositives + confirmed;
  const realTotal = detected + missed;
  const summary = {
    generatedAt: new Date().toISOString(),
    corpusCapturedAt: corpus.capturedAt,
    surfaceVersion: Object.values(surface.versions).join(", "),
    packages: results.length,
    measured: results.filter((record) => record.status === "measured").length,
    errors: results.filter((record) => record.status === "error").length,
    truePositives,
    confirmedScannerOnly: confirmed,
    rejectedScannerOnly: rejected,
    missedByScanner: missed,
    oracleFalseAlarms,
    precision: percent(detected, detected + rejected),
    recall: percent(detected, realTotal),
    pending,
  };

  await writeFile(
    path.join(EVAL_DIR, "results.json"),
    `${JSON.stringify({ summary, packages: results }, null, 2)}\n`,
  );

  console.log("\n| Metric | Value |");
  console.log("|---|---|");
  console.log(`| Packages measured | ${summary.measured} (${summary.errors} errors) |`);
  console.log(
    `| Oracle findings outside the entry graph | ${results.reduce((total, record) => total + (record.oracleOutsideGraph ?? 0), 0)} |`,
  );
  console.log(`| Findings both agree on | ${truePositives} |`);
  console.log(`| Scanner-only, hand-confirmed | ${confirmed} |`);
  console.log(`| Scanner-only, hand-rejected | ${rejected} |`);
  console.log(`| Real issues the scanner missed | ${missed} |`);
  console.log(`| Oracle false alarms | ${oracleFalseAlarms} |`);
  console.log(`| Precision | ${summary.precision} |`);
  console.log(`| Recall | ${summary.recall} |`);
  if (pending.length > 0) {
    console.log(`\n${pending.length} disagreement(s) still need a verdict in adjudication.json.`);
    process.exitCode = 1;
  }
}

await main();
