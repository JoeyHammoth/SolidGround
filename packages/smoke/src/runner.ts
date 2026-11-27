import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  SmokeChannel,
  SmokeResult,
  SmokeResults,
} from "@solid-ground/schema";
import { environmentalFailure, smokeResult } from "./report.js";
import type { CellSource, SmokeCell, SmokeSteps } from "./plan.js";

/**
 * The only file in the package that spawns processes. It takes one cell spec on
 * stdin, runs install and up to three steps in a throwaway directory, and prints
 * one `SmokeResult` on stdout. Everything it decides about *what* a cell means
 * lives in the pure modules around it.
 */

export interface RunnerSpec extends SmokeCell {
  source: CellSource;
  steps: SmokeSteps;
  /** Budget for each child process. One slow registry call must not hang a job. */
  timeoutMs: number;
}

/** Pinned loosely: the harness is rebuilt on every run, so a range is honest. */
export const TOOLCHAIN = {
  // Solid 2 moved the renderer to @solidjs/web and the bundler integration to
  // @solidjs/vite-plugin, which needs Vite 8 or 9.
  vite: "^8.0.0",
  "@solidjs/vite-plugin": "^3.0.0",
  "@solidjs/web": "^2.0.0",
  typescript: "^5.7.0",
} as const;

const DEFAULT_TIMEOUT_MS = 120_000;

function readText(spec: Record<string, unknown>, key: string): string {
  const value = spec[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`spec.${key} must be a non-empty string`);
  }
  return value;
}

/**
 * Validate a spec from the plan job. Unknown keys are ignored on purpose, so a
 * cell can carry an artifact id without the runner learning about it.
 */
export function parseRunnerSpec(value: unknown): RunnerSpec {
  if (typeof value !== "object" || value === null)
    throw new Error("spec must be a JSON object");
  const spec = value as Record<string, unknown>;

  const channel = readText(spec, "channel");
  if (channel !== "stable" && channel !== "next") {
    throw new Error('spec.channel must be "stable" or "next"');
  }

  const source = parseSource(spec.source);
  const steps = parseSteps(spec.steps);
  const timeout = spec.timeoutMs;
  const timeoutMs =
    typeof timeout === "number" && Number.isFinite(timeout) && timeout > 0
      ? timeout
      : DEFAULT_TIMEOUT_MS;

  return {
    name: readText(spec, "name"),
    version: readText(spec, "version"),
    solid: readText(spec, "solid"),
    channel: channel as SmokeChannel,
    source,
    steps,
    timeoutMs,
  };
}

function parseSource(value: unknown): CellSource {
  if (value === undefined) return { kind: "registry" };
  if (typeof value !== "object" || value === null)
    throw new Error("spec.source must be an object");
  const source = value as Record<string, unknown>;
  if (source.kind === "registry") return { kind: "registry" };
  if (source.kind === "path") {
    if (typeof source.path !== "string" || source.path.length === 0) {
      throw new Error("spec.source.path must be a non-empty string");
    }
    return { kind: "path", path: source.path };
  }
  throw new Error('spec.source.kind must be "registry" or "path"');
}

function parseSteps(value: unknown): SmokeSteps {
  const steps: SmokeSteps = { import: true, build: true, types: true };
  if (value === undefined) return steps;
  if (typeof value !== "object" || value === null)
    throw new Error("spec.steps must be an object");
  for (const key of ["import", "build", "types"] as const) {
    const flag = (value as Record<string, unknown>)[key];
    if (flag === undefined) continue;
    if (typeof flag !== "boolean")
      throw new Error(`spec.steps.${key} must be a boolean`);
    steps[key] = flag;
  }
  return steps;
}

/**
 * Which entry point the import step should use. A package that exposes `import`
 * but also `require` gets the ESM path: that is the one bundlers and modern Node
 * take, so a failure there is the failure that matters.
 */
export function chooseEntry(manifest: Record<string, unknown>): "esm" | "cjs" {
  const keys = new Set<string>();
  const walk = (value: unknown, depth: number): void => {
    if (depth > 4 || typeof value !== "object" || value === null) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      walk(nested, depth + 1);
    }
  };
  walk(manifest.exports, 0);

  if (keys.has("import")) return "esm";
  if (keys.has("require")) return "cjs";
  if (typeof manifest.module === "string") return "esm";
  if (manifest.type === "module") return "esm";
  if (typeof manifest.exports === "string")
    return manifest.exports.endsWith(".cjs") ? "cjs" : "esm";
  return "cjs";
}

/**
 * The throwaway project's `package.json`. `pnpm.overrides` pins exactly one
 * `solid-js` copy per cell: a second copy is a harness bug, not a package
 * failure, and it is the most common way a matrix silently lies.
 */
export function cellManifest(spec: RunnerSpec): Record<string, unknown> {
  const dependency =
    spec.source.kind === "path"
      ? `file:${path.resolve(spec.source.path)}`
      : spec.version;
  const dependencies: Record<string, string> = {
    [spec.name]: dependency,
    "solid-js": spec.solid,
  };
  if (spec.steps.build || spec.steps.types) {
    dependencies["@solidjs/web"] = TOOLCHAIN["@solidjs/web"];
  }
  if (spec.steps.build) {
    dependencies.vite = TOOLCHAIN.vite;
    dependencies["@solidjs/vite-plugin"] = TOOLCHAIN["@solidjs/vite-plugin"];
  }
  if (spec.steps.types) dependencies.typescript = TOOLCHAIN.typescript;

  return {
    name: "sg-smoke-cell",
    private: true,
    type: "module",
    dependencies,
    pnpm: { overrides: { "solid-js": spec.solid } },
  };
}

export type CellFiles = Record<string, string>;

/** The files the steps run against. Pure, so the harness can be tested offline. */
export function cellFiles(spec: RunnerSpec): CellFiles {
  const files: CellFiles = {
    "probe.mjs": [
      'import { createRequire } from "node:module";',
      "const [target, kind] = process.argv.slice(2);",
      'if (kind === "esm") { await import(target); } else { createRequire(import.meta.url)(target); }',
      "",
    ].join("\n"),
  };

  if (spec.steps.build) {
    files["index.html"] =
      '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n';
    files["src/main.jsx"] = [
      'import { render } from "@solidjs/web";',
      `import * as target from ${JSON.stringify(spec.name)};`,
      "",
      "function App() {",
      "  return <div data-smoke={typeof target}>{Object.keys(target).length}</div>;",
      "}",
      "",
      'render(() => <App />, document.getElementById("root"));',
      "",
    ].join("\n");
    files["vite.config.js"] = [
      'import { defineConfig } from "vite";',
      'import solidPlugin from "@solidjs/vite-plugin";',
      "",
      'export default defineConfig({ plugins: [solidPlugin()], logLevel: "warn" });',
      "",
    ].join("\n");
  }

  if (spec.steps.types) {
    files["types.ts"] =
      `import * as target from ${JSON.stringify(spec.name)};\nexport const value: unknown = target;\n`;
    files["tsconfig.json"] = JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          // A package that ships broken third-party types is not our problem.
          skipLibCheck: true,
          noEmit: true,
          jsx: "preserve",
          lib: ["ES2022", "DOM"],
          types: [],
        },
        include: ["types.ts"],
      },
      null,
      2,
    );
  }

  return files;
}

/**
 * Everything a child process is allowed to see. `HOME`, `TMPDIR`, the pnpm store
 * and the npm cache all live inside the cell's directory, so a compromised
 * install writes nothing outside the job workspace.
 */
export function childEnv(workdir: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env["PATH"] ?? "",
    HOME: path.join(workdir, "home"),
    TMPDIR: path.join(workdir, "tmp"),
    CI: "true",
    COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
    npm_config_store_dir: path.join(workdir, ".pnpm-store"),
    npm_config_cache: path.join(workdir, ".npm-cache"),
    npm_config_update_notifier: "false",
    npm_config_fund: "false",
    npm_config_audit: "false",
  };
  // pnpm may be a corepack shim. Its cache lives under the real HOME, which the
  // cell deliberately replaces, so point the shim at it instead of letting it
  // fetch a version (and its keys) mid-run.
  const corepackHome =
    process.env["COREPACK_HOME"] ??
    (process.env["HOME"] ? path.join(process.env["HOME"], ".cache", "node", "corepack") : undefined);
  if (corepackHome) env.COREPACK_HOME = corepackHome;
  return env;
}

/**
 * Use the pnpm that launched this process rather than whatever a shim resolves
 * to. In CI that is the action-setup binary; locally it is the same version the
 * repository pins.
 */
export function pnpmCommand(env: NodeJS.ProcessEnv = process.env): {
  command: string;
  args: string[];
} {
  const execPath = env["npm_execpath"];
  if (execPath && /pnpm/.test(execPath)) return { command: process.execPath, args: [execPath] };
  return { command: "pnpm", args: [] };
}

interface CommandResult {
  ok: boolean;
  timedOut: boolean;
  output: string;
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs: number; env: NodeJS.ProcessEnv },
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const append = (chunk: Buffer): void => {
      output = `${output}${chunk.toString()}`.slice(-4000);
    };
    const finish = (result: CommandResult): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    child.stdout.on("data", append);
    child.stderr.on("data", append);
    timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ ok: false, timedOut: true, output });
    }, options.timeoutMs);
    child.on("error", (error) =>
      finish({ ok: false, timedOut: false, output: error.message }),
    );
    child.on("close", (code) =>
      finish({ ok: code === 0, timedOut: false, output }),
    );
  });
}

async function installedManifest(
  workdir: string,
  name: string,
): Promise<Record<string, unknown>> {
  try {
    const text = await readFile(
      path.join(workdir, "node_modules", name, "package.json"),
      "utf8",
    );
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

const INSTALL_ARGS = [
  "install",
  "--ignore-workspace",
  "--ignore-scripts",
  "--no-frozen-lockfile",
  "--reporter=append-only",
];

/**
 * Run one cell. An install failure is environmental: the affected steps stay
 * `null` and the reason travels in `error`, because "the registry was rate
 * limiting us" must never be published as "this package does not work".
 */
export async function runCell(
  spec: RunnerSpec,
  options: { workdirRoot?: string } = {},
): Promise<SmokeResult> {
  const started = Date.now();
  const root =
    options.workdirRoot ?? process.env["SMOKE_WORKDIR"] ?? os.tmpdir();
  await mkdir(root, { recursive: true });
  const workdir = await mkdtemp(path.join(root, "sg-smoke-"));
  const env = childEnv(workdir);
  await mkdir(path.join(workdir, "home"), { recursive: true });
  await mkdir(path.join(workdir, "tmp"), { recursive: true });

  try {
    await writeFile(
      path.join(workdir, "package.json"),
      `${JSON.stringify(cellManifest(spec), null, 2)}\n`,
      "utf8",
    );

    const pnpm = pnpmCommand();
    let install = await runCommand(pnpm.command, [...pnpm.args, ...INSTALL_ARGS], {
      cwd: workdir,
      timeoutMs: spec.timeoutMs,
      env,
    });
    if (!install.ok) {
      install = await runCommand(pnpm.command, [...pnpm.args, ...INSTALL_ARGS], {
        cwd: workdir,
        timeoutMs: spec.timeoutMs,
        env,
      });
    }
    if (!install.ok) {
      const detail = install.timedOut
        ? `timed out after ${spec.timeoutMs}ms`
        : install.output.trim().slice(-1500) || "no output";
      return environmentalFailure({
        name: spec.name,
        version: spec.version,
        solid: spec.solid,
        channel: spec.channel,
        at: new Date().toISOString(),
        error: `pnpm install failed: ${detail}`,
      });
    }

    const entry = chooseEntry(await installedManifest(workdir, spec.name));
    for (const [file, contents] of Object.entries(cellFiles(spec))) {
      const full = path.join(workdir, file);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, contents, "utf8");
    }

    const smoke: SmokeResults = { import: null, build: null, types: null };
    let error: string | null = null;
    const inconclusive = (step: string): void => {
      error ??= `${step} timed out after ${spec.timeoutMs}ms`;
    };

    if (spec.steps.import) {
      const result = await runCommand("node", ["probe.mjs", spec.name, entry], {
        cwd: workdir,
        timeoutMs: spec.timeoutMs,
        env,
      });
      if (result.timedOut) inconclusive("import");
      else smoke.import = result.ok;
    }

    if (spec.steps.build) {
      const result = await runCommand(pnpm.command, [...pnpm.args, "exec", "vite", "build"], {
        cwd: workdir,
        timeoutMs: spec.timeoutMs,
        env,
      });
      if (result.timedOut) inconclusive("build");
      else smoke.build = result.ok;
    }

    if (spec.steps.types) {
            const result = await runCommand(pnpm.command, [...pnpm.args, "exec", "tsc", "-p", "tsconfig.json"], {
          cwd: workdir,
          timeoutMs: spec.timeoutMs,
          env,
        },
      );
      if (result.timedOut) inconclusive("types");
      else smoke.types = result.ok;
    }

    return smokeResult({
      name: spec.name,
      version: spec.version,
      solid: spec.solid,
      channel: spec.channel,
      smoke,
      entry: spec.steps.import ? entry : null,
      durationMs: Date.now() - started,
      error,
      at: new Date().toISOString(),
    });
  } finally {
    if (process.env["SMOKE_KEEP"] === "1") {
      console.error(`kept the cell workspace at ${workdir}`);
    } else {
      await rm(workdir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(
      typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer),
    );
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function main(): Promise<void> {
  const spec = parseRunnerSpec(JSON.parse(await readStdin()));
  const result = await runCell(spec);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const invoked = process.argv[1] ?? "";
if (/runner\.(?:ts|js|mts|mjs)$/.test(invoked)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
