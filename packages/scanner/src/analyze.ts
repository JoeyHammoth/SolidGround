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
  initialised ??= init.then(() => undefined);
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

  let imports: Awaited<ReturnType<typeof parse>>[0];
  try {
    [imports] = parse(code);
  } catch {
    return findings;
  }

  for (const entry of imports) {
    const specifier = entry.n;
    if (!specifier) continue;

    const removedSubpath = rules.subpaths.find((rule) => rule.from === specifier);
    if (removedSubpath) {
      findings.push({
        code: "removed-subpath",
        file,
        specifier,
        name: null,
        hint: removedSubpath.hint ?? null,
        message: `Imports from ${specifier}, which Solid 2 does not publish.`,
        runtime: true,
      });
      continue;
    }

    if (!SOLID_ENTRIES.has(specifier)) continue;
    const surface = surfaceFor(specifier);
    const statement = entry.ss >= 0 ? code.slice(entry.ss, entry.se) : "";
    const typeOnly = /^import\s+type\b/.test(statement);

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
          runtime: true,
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
