import { createEffect } from "solid-js";

// Solid 2 removed `createEffect`. Calling it at module scope makes the failure
// deterministic under both the ESM and the CJS entry: a missing named export is
// a link error, and an undefined import is a TypeError on the call.
createEffect(() => {});

export function Broken() {
  return null;
}
