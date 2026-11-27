import { createSignal } from "solid-js";

/** A two-line Solid 2 component. It must import, build and typecheck. */
export function Counter() {
  const [count, setCount] = createSignal(0);
  return { count, setCount };
}
