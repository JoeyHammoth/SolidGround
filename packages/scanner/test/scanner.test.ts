import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { create as createTar } from "tar";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeSource, namedImports, scanJsx } from "../src/analyze.js";
import { resolveEntrypoints } from "../src/resolve.js";
import { extractArchive, unsafePath, verifyIntegrity } from "../src/tarball.js";
import { scanPackage } from "../src/index.js";

const cleanups: string[] = [];
afterEach(async () => {
  for (const dir of cleanups.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function fixtureTree(files: Record<string, string | Buffer>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "sg-scan-test-"));
  cleanups.push(dir);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(dir, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return dir;
}

async function tarball(files: Record<string, string | Buffer>): Promise<Buffer> {
  const dir = await fixtureTree(files);
  const chunks: Buffer[] = [];
  const stream = createTar({ gzip: true, cwd: dir, portable: true }, Object.keys(files));
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  return Buffer.concat(chunks);
}

const rules = {
  subpaths: [{ from: "solid-js/web", hint: "Import DOM rendering APIs from @solidjs/web." }],
  exports: [{ from: "mergeProps", to: "merge", hint: "mergeProps was replaced by merge." }],
};

const surface = new Set(["createSignal", "merge", "For", "Show"]);

describe("entry resolution", () => {
  it("follows the solid, import and default conditions", () => {
    const entries = resolveEntrypoints({
      exports: {
        ".": {
          solid: "./src/index.jsx",
          import: "./dist/index.mjs",
          default: "./dist/index.cjs",
        },
      },
    });
    expect(entries).toEqual(expect.arrayContaining(["src/index.jsx", "dist/index.mjs", "dist/index.cjs"]));
  });

  it("keeps only the root export when subpaths are present", () => {
    expect(resolveEntrypoints({ exports: { ".": "./dist/index.js", "./web": "./dist/web.js" } })).toEqual([
      "dist/index.js",
    ]);
  });

  it("falls back to main and module", () => {
    expect(resolveEntrypoints({ main: "./dist/cjs.js", module: "./dist/esm.js" })).toEqual(
      expect.arrayContaining(["dist/cjs.js", "dist/esm.js"]),
    );
  });
});

describe("archive intake", () => {
  it("rejects absolute paths, parent traversal and excessive depth", () => {
    expect(unsafePath("/etc/passwd")).toContain("absolute");
    expect(unsafePath("package/../../evil.js")).toContain("parent traversal");
    expect(unsafePath(`package/${Array.from({ length: 25 }, () => "a").join("/")}.js`)).toContain("depth");
  });

  it("verifies sha512 integrity and reports a mismatch", () => {
    const buffer = Buffer.from("published bytes");
    const digest = createHash("sha512").update(buffer).digest("base64");
    expect(verifyIntegrity(buffer, `sha512-${digest}`).matches).toBe(true);
    expect(verifyIntegrity(buffer, `sha512-${Buffer.from("nope").toString("base64")}`).matches).toBe(false);
    expect(() => verifyIntegrity(buffer, "md5-abc")).toThrow(/unsupported integrity/);
  });

  it("skips symlinks and extracts regular files", async () => {
    const dir = await fixtureTree({ "package/index.js": "export const a = 1" });
    await symlink("/etc/passwd", path.join(dir, "package", "link.js"));
    const chunks: Buffer[] = [];
    const stream = createTar({ gzip: true, cwd: dir, portable: true }, ["package/index.js", "package/link.js"]);
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });

    const archive = await extractArchive(Buffer.concat(chunks));
    expect(archive.files).toEqual(["package/index.js"]);
    await archive.cleanup();
  });

  it("rejects an archive that unpacks past the cap", async () => {
    const buffer = await tarball({ "package/big.js": "x".repeat(5_000) });
    await expect(
      extractArchive(buffer, {
        compressedBytes: 5_000_000,
        uncompressedBytes: 1_000,
        files: 100,
        depth: 20,
        fileBytes: 1_000,
      }),
    ).rejects.toThrow(/unpacked size|rejected/);
  });
});

describe("import classification", () => {
  it("reads named imports, aliases and inline type markers", () => {
    expect(namedImports('import { a, b as c, type D } from "solid-js";')).toEqual(["a", "b", "D"]);
    expect(namedImports('import value from "solid-js";')).toEqual([]);
  });

  it("flags removed subpaths, missing exports and type ownership", async () => {
    const code = [
      'import { render } from "solid-js/web";',
      'import { merge, mergeProps } from "solid-js";',
      'import type { JSX } from "solid-js";',
      'import { somethingInternal } from "solid-js";',
    ].join("\n");
    const findings = await analyzeSource("index.js", code, () => surface, rules);
    expect(findings.map((finding) => finding.code)).toEqual([
      "removed-subpath",
      "missing-export",
      "type-ownership",
      "unknown-export",
    ]);
    expect(findings[1]?.hint).toContain("mergeProps");
    expect(findings[0]?.runtime).toBe(true);
    expect(findings[2]?.runtime).toBe(false);
  });

  it("finds removed JSX syntax only in shipped JSX", () => {
    expect(scanJsx("src/App.jsx", "<div classList={{ a: true }} />")).toHaveLength(1);
    expect(scanJsx("dist/index.js", "const a = 'classList=';")).toEqual([]);
  });

  it("tolerates invalid UTF-8", async () => {
    const findings = await analyzeSource(
      "index.js",
      Buffer.from([0xff, 0xfe, 0x00, 0x7b]).toString("utf8"),
      () => surface,
      rules,
    );
    expect(Array.isArray(findings)).toBe(true);
  });
});

describe("scanPackage", () => {
  it("scans the solid condition build end to end without executing it", async () => {
    const rulesDir = await fixtureTree({
      "removed-apis.yml": "subpaths:\n  - from: solid-js/web\n    hint: use @solidjs/web\nexports:\n  - from: mergeProps\n    hint: use merge\n",
    });
    const surfaceDir = await fixtureTree({
      "solid2-surface.json": JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-11-25T00:00:00.000Z",
        versions: { "solid-js": "2.0.4" },
        exports: { "solid-js": [...surface] },
      }),
    });

    const buffer = await tarball({
      "package/package.json": JSON.stringify({
        name: "@example/lib",
        exports: { ".": { solid: "./src/index.jsx", import: "./dist/index.js", default: "./dist/index.js" } },
      }),
      "package/src/index.jsx": 'import { render } from "solid-js/web";\nexport const App = () => <div classList={{ a: true }} />;',
      "package/dist/index.js": 'export const value = 1;',
    });
    const digest = createHash("sha512").update(buffer).digest("base64");

    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (new URL(url).hostname === "registry.npmjs.org") {
        return new Response(
          JSON.stringify({
            dist: { tarball: "https://example.test/lib.tgz", integrity: `sha512-${digest}` },
          }),
          { status: 200 },
        );
      }
      return new Response(new Uint8Array(buffer), { status: 200 });
    }) as typeof fetch;

    const result = await scanPackage("@example/lib", "1.0.0", {
      fetchImpl,
      rulesDir,
      surfacePath: path.join(surfaceDir, "solid2-surface.json"),
    });

    expect(result.clean).toBe(false);
    expect(result.entrypoints).toEqual(["src/index.jsx", "dist/index.js"]);
    const codes = result.findings.map((finding) => finding.code);
    expect(codes).toContain("removed-subpath");
    expect(codes).toContain("jsx-removed-syntax");
  });

  it("refuses a tarball whose integrity does not match", async () => {
    const rulesDir = await fixtureTree({ "removed-apis.yml": "subpaths: []\nexports: []\n" });
    const surfaceDir = await fixtureTree({
      "solid2-surface.json": JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-11-25T00:00:00.000Z",
        versions: { "solid-js": "2.0.4" },
        exports: { "solid-js": ["createSignal"] },
      }),
    });
    const buffer = await tarball({ "package/package.json": JSON.stringify({ name: "x", main: "./index.js" }) });
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input);
      if (new URL(url).hostname === "registry.npmjs.org") {
        return new Response(
          JSON.stringify({ dist: { tarball: "https://example.test/x.tgz", integrity: `sha512-${"A".repeat(64)}` } }),
          { status: 200 },
        );
      }
      return new Response(new Uint8Array(buffer), { status: 200 });
    }) as typeof fetch;

    await expect(
      scanPackage("x", "1.0.0", {
        fetchImpl,
        rulesDir,
        surfacePath: path.join(surfaceDir, "solid2-surface.json"),
      }),
    ).rejects.toThrow(/integrity/);
  });
});
