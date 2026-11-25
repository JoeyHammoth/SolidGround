/**
 * Hard caps on archive intake. A published tarball is untrusted input: these
 * numbers bound both decompression bombs and pathological archives.
 */
export interface ArchiveLimits {
  /** Compressed bytes accepted over the wire. */
  compressedBytes: number;
  /** Total declared uncompressed bytes. */
  uncompressedBytes: number;
  /** Entries in the archive, including directories. */
  files: number;
  /** Path segments in a single entry, including the `package/` prefix. */
  depth: number;
  /** Bytes read from a single file for analysis. */
  fileBytes: number;
}

export const DEFAULT_LIMITS: ArchiveLimits = {
  compressedBytes: 50 * 1024 * 1024,
  uncompressedBytes: 200 * 1024 * 1024,
  files: 10_000,
  depth: 20,
  fileBytes: 4 * 1024 * 1024,
};
