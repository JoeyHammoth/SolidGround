import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { x as extractTar } from "tar";
import { DEFAULT_LIMITS, type ArchiveLimits } from "./limits.js";

export interface Archive {
  /** Temporary directory holding the extracted tree. */
  dir: string;
  /** Relative paths of extracted regular files, sorted. */
  files: string[];
  /** Declared uncompressed size of every accepted entry. */
  bytes: number;
  cleanup: () => Promise<void>;
}

const SKIPPED_TYPES = new Set([
  "SymbolicLink",
  "Link",
  "CharacterDevice",
  "BlockDevice",
  "FIFO",
]);

/** Reject absolute paths, parent traversal and paths that are too deep. */
export function unsafePath(entryPath: string, limit: number = DEFAULT_LIMITS.depth): string | null {
  const normalized = entryPath.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)) return "absolute path";
  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  if (segments.includes("..")) return "parent traversal";
  if (segments.length > limit) return `depth ${segments.length} exceeds ${limit}`;
  return null;
}

export interface IntegrityResult {
  algorithm: "sha512" | "sha384" | "sha256";
  digest: string;
  matches: boolean;
}

/**
 * Verify `dist.integrity` (an SRI string, for example `sha512-base64`) against
 * the downloaded bytes. Integrity strings may list several digests; one match
 * is enough, which is how npm treats them.
 */
export function verifyIntegrity(buffer: Buffer, integrity: string): IntegrityResult {
  const candidates = integrity
    .trim()
    .split(/\s+/)
    .map((value) => {
      const [algorithm, digest] = value.split("-", 2);
      return { algorithm: algorithm ?? "", digest: digest ?? "" };
    })
    .filter((value) => ["sha512", "sha384", "sha256"].includes(value.algorithm));

  if (candidates.length === 0) throw new Error(`unsupported integrity string: ${integrity}`);

  for (const candidate of candidates) {
    const actual = createHash(candidate.algorithm)
      .update(buffer)
      .digest("base64");
    if (actual === candidate.digest) {
      return { algorithm: candidate.algorithm as IntegrityResult["algorithm"], digest: actual, matches: true };
    }
  }
  const first = candidates[0] as { algorithm: string; digest: string };
  return { algorithm: first.algorithm as IntegrityResult["algorithm"], digest: first.digest, matches: false };
}

async function walk(dir: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(path.join(dir, prefix), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(dir, relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

/**
 * Extract a tarball into a temporary directory under hard caps. Symlinks,
 * hardlinks and device entries are never extracted; traversal and caps are
 * rejected rather than silently repaired, so a bad archive fails the scan.
 */
export async function extractArchive(
  buffer: Buffer,
  limits: ArchiveLimits = DEFAULT_LIMITS,
): Promise<Archive> {
  if (buffer.byteLength > limits.compressedBytes) {
    throw new Error(`archive is ${buffer.byteLength} bytes, over the ${limits.compressedBytes} byte cap`);
  }

  const workspace = await mkdtemp(path.join(tmpdir(), "solid-ground-scan-"));
  const archiveFile = path.join(workspace, "package.tgz");
  const dir = path.join(workspace, "tree");
  await mkdir(dir, { recursive: true });
  await writeFile(archiveFile, buffer);

  let violation: string | null = null;
  let bytes = 0;
  let count = 0;

  try {
    await extractTar({
      file: archiveFile,
      cwd: dir,
      strict: true,
      preservePaths: false,
      filter: (entryPath, entry) => {
        count += 1;
        if (count > limits.files) {
          violation = violation ?? `more than ${limits.files} entries`;
          return false;
        }
        const unsafe = unsafePath(entryPath, limits.depth);
        if (unsafe) {
          violation = violation ?? `${unsafe}: ${entryPath}`;
          return false;
        }
        const type = (entry as { type?: unknown }).type;
        if (SKIPPED_TYPES.has(String(type))) return false;
        bytes += Number(entry.size ?? 0);
        if (bytes > limits.uncompressedBytes) {
          violation = violation ?? `unpacked size over ${limits.uncompressedBytes} bytes`;
          return false;
        }
        return true;
      },
    });
  } catch (error) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }

  if (violation) {
    await rm(workspace, { recursive: true, force: true });
    throw new Error(`archive rejected: ${violation}`);
  }

  return {
    dir,
    files: await walk(dir),
    bytes,
    cleanup: async () => {
      await rm(workspace, { recursive: true, force: true });
    },
  };
}

/** Read one extracted file, capped so a single huge file cannot exhaust memory. */
export async function readArchiveFile(
  archive: Archive,
  relative: string,
  limits: ArchiveLimits = DEFAULT_LIMITS,
): Promise<string> {
  const info = await stat(path.join(archive.dir, relative));
  if (info.size > limits.fileBytes) {
    throw new Error(`${relative} is ${info.size} bytes, over the ${limits.fileBytes} byte read cap`);
  }
  return readFile(path.join(archive.dir, relative), "utf8");
}
