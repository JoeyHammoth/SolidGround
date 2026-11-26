import { init, parse } from "es-module-lexer";
import { ANALYSABLE } from "./resolve.js";

export type FindingCode =
  | "removed-subpath"
  | "missing-export"
  | "unknown-export"
  | "type-ownership"
  | "jsx-removed-syntax";

export interface Finding {
  code: FindingCode;
  file: string;
  specifier: string | null;
  name: string | null;
  hint: string | null;
  message: string;
  /** True when the finding can make published code fail under Solid 2. */
  runtime: boolean;
}

export interface RemovedRule {
  from: string;
  to?: string;
  hint?: string;
}

export interface RemovedRules {
  version?: string;
  source?: string;
  subpaths: RemovedRule[];
  exports: RemovedRule[];
}

let initialised: Promise<void> | null = null;

async function ensureParser(): Promise<void> {
  initialised ??= init();
  await initialised;
}

const SOLID_ENTRIES = new Set(["solid-js", "@solidjs/web", "@solidjs/signals"]);
const TYPE_OWNERSHIP = new Set(["JSX", "ComponentProps", "JSXElement", "JSXElementChildrenAttribute"]);

export function namedImports(statement: string): string[] {
  const match = /\{([\s\S]*?)\}/.exec(statement);
  if (!match?.[1]) return [];
  return match[1]
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

function hintFor(rules: RemovedRules, name: string): string | null {
  const rule = rules.exports.find((entry) => entry.from === name);
  if (!rule) return null;
  return rule.hint ?? (rule.to ? `${rule.from} was replaced by ${rule.to}.` : null);
}

interface ImportRecord {
  specifier: string;
  /** A static ESM import names bindings; a dynamic import or `require` does not. */
  binds: boolean;
  typeOnly: boolean;
  /** The statement text, used to read the braces of a static import. */
  statement: string;
}

/**
 * `require()` is an import as far as Solid 2 breakage is concerned: a CJS build
 * that loads `solid-js/web` fails in the same way as an ESM one.
 */
function appendRequires(code: string, records: ImportRecord[]): void {
  for (const match of code.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    const specifier = match[1];
    if (specifier) records.push({ specifier, binds: false, typeOnly: false, statement: "" });
  }
}

/**
 * Conservative text read used only when the lexer rejects a file. Shipped JSX
 * can defeat the lexer — `<Portal {...props} />` is enough — and a parse throw
 * must not silently discard every finding in that file.
 */
function regexImports(code: string): ImportRecord[] {
  const records: ImportRecord[] = [];
  for (const match of code.matchAll(/\bimport\s*(type\s+)?([\s\S]{0,400}?)from\s*["']([^"']+)["']/g)) {
    const specifier = match[3];
    if (!specifier) continue;
    records.push({ specifier, binds: true, typeOnly: Boolean(match[1]), statement: match[0] });
  }
  for (const match of code.matchAll(
    /\bexport\s*(?:\*(?:\s+as\s+\w+)?|\{[\s\S]{0,400}?\})\s*from\s*["']([^"']+)["']/g,
  )) {
    const specifier = match[1];
    if (specifier) records.push({ specifier, binds: true, typeOnly: false, statement: match[0] });
  }
  for (const match of code.matchAll(/\bimport\s*["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (specifier) records.push({ specifier, binds: false, typeOnly: false, statement: "" });
  }
  for (const match of code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    const specifier = match[1];
    if (specifier) records.push({ specifier, binds: false, typeOnly: false, statement: "" });
  }
  appendRequires(code, records);
  return records;
}

function extractImports(code: string): ImportRecord[] {
  try {
    const [imports] = parse(code);
    const records: ImportRecord[] = [];
    for (const entry of imports) {
      const specifier = entry.specifier;
      if (!specifier) continue;
      const binds = entry.type === "static";
      records.push({
        specifier,
        binds,
        typeOnly: binds ? entry.typeOnly : false,
        statement: binds ? code.slice(entry.importStart, entry.importEnd) : "",
      });
    }
    appendRequires(code, records);
    return records;
  } catch {
    return regexImports(code);
  }
}

/**
 * Parse one module and classify its Solid imports. The module is read as text
 * and handed to a lexer; nothing is evaluated.
 */
export async function analyzeSource(
  file: string,
  code: string,
  surfaceFor: (specifier: string) => ReadonlySet<string>,
  rules: RemovedRules,
): Promise<Finding[]> {
  await ensureParser();
  const findings: Finding[] = [];
  // A declaration file is read by the type checker, never executed, so an
  // import it names cannot break a build at runtime.
  const declaration = /\.d\.[cm]?ts$/.test(file);

  for (const entry of extractImports(code)) {
    const specifier = entry.specifier;

    const removedSubpath = rules.subpaths.find((rule) => rule.from === specifier);
    if (removedSubpath) {
      findings.push({
        code: "removed-subpath",
        file,
        specifier,
        name: null,
        hint: removedSubpath.hint ?? null,
        message: `Imports from ${specifier}, which Solid 2 does not publish.`,
        runtime: !declaration,
      });
      continue;
    }

    if (!SOLID_ENTRIES.has(specifier)) continue;
    // Only a static import statement binds local names; a dynamic import, a
    // `require` or an `export *` names a module but nothing to classify here.
    if (!entry.binds) continue;
    const surface = surfaceFor(specifier);
    const statement = entry.statement;
    const typeOnly = entry.typeOnly;

    for (const name of namedImports(statement)) {
      if (typeOnly && TYPE_OWNERSHIP.has(name) && specifier === "solid-js") {
        findings.push({
          code: "type-ownership",
          file,
          specifier,
          name,
          hint: "Import JSX types from @solidjs/web.",
          message: `Type ${name} is owned by @solidjs/web in Solid 2.`,
          runtime: false,
        });
        continue;
      }
      if (surface.has(name)) continue;

      const hint = hintFor(rules, name);
      if (hint) {
        findings.push({
          code: "missing-export",
          file,
          specifier,
          name,
          hint,
          message: `${specifier} does not export ${name} in Solid 2.`,
          runtime: !declaration,
        });
      } else {
        findings.push({
          code: "unknown-export",
          file,
          specifier,
          name,
          hint: null,
          message: `${specifier} does not export ${name} in Solid 2; it may be a type or an internal.`,
          runtime: false,
        });
      }
    }
  }

  return findings;
}

const JSX_ATTRIBUTES = [
  { test: /(^|\s)classList\s*=/, label: "classList" },
  { test: /(^|\s)use:/, label: "use:" },
  { test: /(^|\s)on:/, label: "on:" },
  { test: /(^|\s)attr:/, label: "attr:" },
  { test: /(^|\s)bool:/, label: "bool:" },
];

/** Solid 2 removed directive syntax. Only shipped JSX source can contain it. */
export function scanJsx(file: string, code: string): Finding[] {
  if (!/\.[jt]sx$/i.test(file) || !ANALYSABLE.test(file)) return [];
  const findings: Finding[] = [];
  for (const attribute of JSX_ATTRIBUTES) {
    if (!attribute.test.test(code)) continue;
    findings.push({
      code: "jsx-removed-syntax",
      file,
      specifier: null,
      name: attribute.label,
      hint: `Solid 2 removed ${attribute.label}; see the migration guide.`,
      message: `Uses ${attribute.label}, which does not compile under Solid 2.`,
      runtime: true,
    });
  }
  return findings;
}
