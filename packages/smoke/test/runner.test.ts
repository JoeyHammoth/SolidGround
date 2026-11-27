import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  TOOLCHAIN,
  cellFiles,
  cellManifest,
  childEnv,
  chooseEntry,
  chooseTarget,
  exportedSubpaths,
  parseRunnerSpec,
  pnpmCommand,
} from "../src/runner.js";

const SPEC = {
  name: "@scope/lib",
  version: "1.2.3",
  solid: "2.0.4",
  channel: "stable",
  source: { kind: "registry" },
  steps: { import: true, build: true, types: true },
  timeoutMs: 60_000,
};

describe("parseRunnerSpec", () => {
  it("reads a complete spec", () => {
    const spec = parseRunnerSpec(SPEC);
    expect(spec.name).toBe("@scope/lib");
    expect(spec.source).toEqual({ kind: "registry" });
    expect(spec.steps).toEqual({ import: true, build: true, types: true });
    expect(spec.timeoutMs).toBe(60_000);
  });

  it("defaults every step on and the timeout to two minutes", () => {
    const spec = parseRunnerSpec({
      name: "@scope/lib",
      version: "1.2.3",
      solid: "2.0.4",
      channel: "stable",
    });
    expect(spec.steps).toEqual({ import: true, build: true, types: true });
    expect(spec.timeoutMs).toBe(120_000);
  });

  it("keeps a path source, which is how a control is run", () => {
    const spec = parseRunnerSpec({
      name: "@solid-ground/control-bad",
      version: "0.0.0",
      solid: "2.0.4",
      channel: "stable",
      source: { kind: "path", path: "packages/smoke/fixtures/control-bad" },
      steps: { import: true, build: false, types: false },
      id: "control-bad",
    });
    expect(spec.source).toEqual({
      kind: "path",
      path: "packages/smoke/fixtures/control-bad",
    });
    expect(spec.steps).toEqual({ import: true, build: false, types: false });
  });

  it("rejects a spec it cannot trust", () => {
    expect(() =>
      parseRunnerSpec({ version: "1.0.0", solid: "2.0.4", channel: "stable" }),
    ).toThrow(/spec\.name/);
    expect(() =>
      parseRunnerSpec({
        name: "@scope/lib",
        version: "1.0.0",
        solid: "2.0.4",
        channel: "beta",
      }),
    ).toThrow(/channel/);
    expect(() =>
      parseRunnerSpec({
        name: "@scope/lib",
        version: "1.0.0",
        solid: "2.0.4",
        channel: "stable",
        source: { kind: "git", url: "https://example.com" },
      }),
    ).toThrow(/source\.kind/);
    expect(() =>
      parseRunnerSpec({
        name: "@scope/lib",
        version: "1.0.0",
        solid: "2.0.4",
        channel: "stable",
        steps: { import: "yes" },
      }),
    ).toThrow(/steps\.import/);
    expect(() => parseRunnerSpec("nope")).toThrow(/JSON object/);
  });
});

describe("chooseEntry", () => {
  it("prefers the ESM condition when a package exposes both", () => {
    expect(
      chooseEntry({
        exports: { ".": { import: "./index.mjs", require: "./index.cjs" } },
      }),
    ).toBe("esm");
  });

  it("falls back through require, module, type and main", () => {
    expect(chooseEntry({ exports: { ".": { require: "./index.cjs" } } })).toBe(
      "cjs",
    );
    expect(chooseEntry({ module: "./index.mjs" })).toBe("esm");
    expect(chooseEntry({ type: "module" })).toBe("esm");
    expect(chooseEntry({ exports: "./index.cjs" })).toBe("cjs");
    expect(chooseEntry({})).toBe("cjs");
  });
});

describe("chooseTarget", () => {
  it("uses the package name when the root is exported", () => {
    expect(chooseTarget({ exports: { ".": "./index.js" } }, "@scope/lib")).toEqual({
      specifier: "@scope/lib",
      entry: "cjs",
    });
    expect(chooseTarget({ main: "./index.js" }, "@scope/lib")).toEqual({
      specifier: "@scope/lib",
      entry: "cjs",
    });
    expect(chooseTarget({ exports: "./index.js" }, "@scope/lib")).toEqual({
      specifier: "@scope/lib",
      entry: "esm",
    });
  });

  it("falls back to the first real subpath when the root is not exported", () => {
    const manifest = { exports: { "./*": { default: "./dist/*/index.js" } } };
    expect(chooseTarget(manifest, "@kobalte/core", ["accordion", "dialog"])).toEqual({
      specifier: "@kobalte/core/accordion",
      entry: "cjs",
    });
  });

  it("still attempts the root when no subpath resolves", () => {
    const manifest = { exports: { "./*": { default: "./dist/*/index.js" } } };
    expect(chooseTarget(manifest, "@scope/lib", [])).toEqual({
      specifier: "@scope/lib",
      entry: "cjs",
    });
  });
});

describe("exportedSubpaths", () => {
  it("reads explicit subpath keys without touching the disk", async () => {
    const subpaths = await exportedSubpaths("/nonexistent", {
      exports: { "./button": "./dist/button.js", "./dialog": "./dist/dialog.js" },
    });
    expect(subpaths).toEqual(["button", "dialog"]);
  });

  it("expands a directory-shaped pattern against the installed package", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sg-subpaths-"));
    try {
      for (const name of ["accordion", "dialog"]) {
        await mkdir(path.join(dir, "dist", name), { recursive: true });
        await writeFile(path.join(dir, "dist", name, "index.js"), "export {};\n");
      }
      const subpaths = await exportedSubpaths(dir, {
        exports: { "./*": { default: "./dist/*/index.js" } },
      });
      expect(subpaths).toEqual(["accordion", "dialog"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns nothing when the package has no exports map", async () => {
    expect(await exportedSubpaths("/nonexistent", { main: "index.js" })).toEqual([]);
  });
});

describe("cellManifest", () => {
  it("pins exactly one solid-js copy per cell", () => {
    const manifest = cellManifest(parseRunnerSpec(SPEC));
    expect(
      (manifest.pnpm as { overrides: Record<string, string> }).overrides,
    ).toEqual({
      "solid-js": "2.0.4",
    });
    expect((manifest.dependencies as Record<string, string>)["solid-js"]).toBe(
      "2.0.4",
    );
  });

  it("installs the toolchain only for the steps that need it", () => {
    const importOnly = cellManifest(
      parseRunnerSpec({
        ...SPEC,
        steps: { import: true, build: false, types: false },
      }),
    );
    const dependencies = importOnly.dependencies as Record<string, string>;
    expect(dependencies.vite).toBeUndefined();
    expect(dependencies.typescript).toBeUndefined();

    const typesOnly = cellManifest(
      parseRunnerSpec({
        ...SPEC,
        steps: { import: false, build: false, types: true },
      }),
    );
    expect((typesOnly.dependencies as Record<string, string>).typescript).toBe(
      TOOLCHAIN.typescript,
    );
  });

  it("installs a local fixture through a file: dependency", () => {
    const manifest = cellManifest(
      parseRunnerSpec({
        ...SPEC,
        name: "@solid-ground/control-good",
        source: { kind: "path", path: "packages/smoke/fixtures/control-good" },
      }),
    );
    const dependency =
      (manifest.dependencies as Record<string, string>)[
        "@solid-ground/control-good"
      ] ?? "";
    expect(dependency.startsWith("file:")).toBe(true);
    expect(dependency.endsWith("packages/smoke/fixtures/control-good")).toBe(
      true,
    );
  });
});

describe("pnpmCommand", () => {
  it("runs the pnpm that launched this process", () => {
    const invocation = pnpmCommand({ npm_execpath: "/opt/pnpm/pnpm.cjs", PATH: "/usr/bin" });
    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args).toEqual(["/opt/pnpm/pnpm.cjs"]);
  });

  it("falls back to pnpm on PATH", () => {
    expect(pnpmCommand({ PATH: "/usr/bin" })).toEqual({ command: "pnpm", args: [] });
  });
});

describe("childEnv", () => {
  it("keeps every writable path inside the cell", () => {
    const env = childEnv("/tmp/sg-smoke-cell");
    expect(env.HOME).toBe("/tmp/sg-smoke-cell/home");
    expect(env.TMPDIR).toBe("/tmp/sg-smoke-cell/tmp");
    expect(env.npm_config_store_dir).toBe("/tmp/sg-smoke-cell/.pnpm-store");
    expect(env.npm_config_cache).toBe("/tmp/sg-smoke-cell/.npm-cache");
  });

  it("leaves corepack's cache reachable without the real HOME", () => {
    const env = childEnv("/tmp/sg-smoke-cell");
    expect(env.COREPACK_ENABLE_DOWNLOAD_PROMPT).toBe("0");
    if (process.env["COREPACK_HOME"] || process.env["HOME"]) {
      expect(env.COREPACK_HOME).toBeTruthy();
    }
  });
});

describe("cellFiles", () => {
  it("probes the installed package by name", () => {
    const files = cellFiles(parseRunnerSpec(SPEC));
    expect(files["probe.mjs"]).toContain("node:module");
    expect(files["src/main.jsx"]).toContain(
      'import * as target from "@scope/lib";',
    );
    const tsconfig = JSON.parse(files["tsconfig.json"] ?? "{}") as {
      compilerOptions: Record<string, unknown>;
    };
    expect(tsconfig.compilerOptions["skipLibCheck"]).toBe(true);
  });

  it("imports the chosen subpath in the build and typecheck steps", () => {
    const files = cellFiles(parseRunnerSpec(SPEC), "@scope/lib/button");
    expect(files["src/main.jsx"]).toContain(
      'import * as target from "@scope/lib/button";',
    );
    expect(files["types.ts"]).toContain(
      'import * as target from "@scope/lib/button";',
    );
  });

  it("writes only the files the enabled steps need", () => {
    const files = cellFiles(
      parseRunnerSpec({
        ...SPEC,
        steps: { import: true, build: false, types: false },
      }),
    );
    expect(Object.keys(files)).toEqual(["probe.mjs"]);
  });
});
