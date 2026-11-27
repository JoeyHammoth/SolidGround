import { batch } from "solid-js";

// Solid 2 removed `batch` (updates batch by default). Calling it at module scope
// makes the failure deterministic under both the ESM and the CJS entry: a
// missing named export is a link error, and an undefined import is a TypeError
// on the call.
batch(() => {});

export function Broken() {
  return null;
}
