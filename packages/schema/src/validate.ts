import { createRequire } from "node:module";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const require = createRequire(import.meta.url);

function createValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const recordSchema = require("../schemas/package-record.schema.json");
  const registrySchema = require("../schemas/registry-entry.schema.json");
  const eventSchema = require("../schemas/change-event.schema.json");
  const smokeSchema = require("../schemas/smoke-result.schema.json");
  return {
    record: ajv.compile(recordSchema),
    registry: ajv.compile(registrySchema),
    event: ajv.compile(eventSchema),
    smoke: ajv.compile(smokeSchema),
  };
}

const validators = createValidator();

export function formatValidationErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) return "unknown validation error";
  return errors
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
}

export function validateRegistryEntry(value: unknown): string[] {
  if (validators.registry(value)) return [];
  return [formatValidationErrors(validators.registry.errors)];
}

export function validateDataset(value: unknown): string[] {
  if (validators.record(value)) return [];
  return [formatValidationErrors(validators.record.errors)];
}

export function validateChangeEvent(value: unknown): string[] {
  if (validators.event(value)) return [];
  return [formatValidationErrors(validators.event.errors)];
}

export function validateSmokeResult(value: unknown): string[] {
  if (validators.smoke(value)) return [];
  return [formatValidationErrors(validators.smoke.errors)];
}

/**
 * Validate an NDJSON document: every non-empty line must be one change event.
 * Failures carry the 1-based line number, because a line has no other identity.
 */
export function validateEvents(text: string): string[] {
  const failures: string[] = [];
  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      failures.push(`line ${index + 1}: invalid JSON (${(error as Error).message})`);
      return;
    }
    for (const message of validateChangeEvent(parsed)) {
      failures.push(`line ${index + 1}: ${message}`);
    }
  });
  return failures;
}

async function collectDataFiles(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries.sort()) {
    const full = path.join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) {
      files.push(...(await collectDataFiles(full)));
    } else if (entry.endsWith(".json") || entry.endsWith(".ndjson")) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Validate a directory tree. YAML files under `registry/` are registry entries;
 * `.ndjson` files are change events; every other JSON file is validated as a
 * record when it looks like one and merely parsed otherwise.
 */
export async function validatePaths(paths: string[]): Promise<string[]> {
  const failures: string[] = [];
  for (const target of paths) {
    let info;
    try {
      info = await stat(target);
    } catch {
      failures.push(`${target}: does not exist`);
      continue;
    }

    if (info.isFile()) {
      if (target.endsWith(".yml") || target.endsWith(".yaml")) {
        const parsed = parseYaml(await readFile(target, "utf8"));
        const errors = validateRegistryEntry(parsed);
        for (const error of errors) failures.push(`${target}: ${error}`);
      } else if (target.endsWith(".ndjson")) {
        for (const message of validateEvents(await readFile(target, "utf8"))) {
          failures.push(`${target}: ${message}`);
        }
      }
      continue;
    }

    const registryDir = path.join(target, "registry");
    const registryFiles = await collectDataFiles(registryDir);
    const yamlFiles = (await readdir(registryDir).catch(() => [] as string[]))
      .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
      .map((name) => path.join(registryDir, name));

    for (const file of [...registryFiles, ...yamlFiles]) {
      if (!file.endsWith(".yml") && !file.endsWith(".yaml")) continue;
      const parsed = parseYaml(await readFile(file, "utf8"));
      for (const error of validateRegistryEntry(parsed)) failures.push(`${file}: ${error}`);
    }

    for (const file of await collectDataFiles(path.join(target, "registry", "packages"))) {
      const parsed = parseYaml(await readFile(file, "utf8"));
      for (const error of validateRegistryEntry(parsed)) failures.push(`${file}: ${error}`);
    }

    for (const file of await collectDataFiles(target)) {
      if (file.includes(`${path.sep}registry${path.sep}`)) continue;
      if (file.endsWith(".ndjson")) {
        for (const message of validateEvents(await readFile(file, "utf8"))) {
          failures.push(`${file}: ${message}`);
        }
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(await readFile(file, "utf8"));
      } catch (error) {
        failures.push(`${file}: invalid JSON (${(error as Error).message})`);
        continue;
      }
      const isRecord =
        typeof parsed === "object" &&
        parsed !== null &&
        "schemaVersion" in parsed &&
        "status" in parsed &&
        "checkedAt" in parsed;
      if (isRecord) {
        for (const message of validateDataset(parsed)) failures.push(`${file}: ${message}`);
      }
    }
  }
  return failures;
}
