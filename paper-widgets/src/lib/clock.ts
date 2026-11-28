import { useLayoutEffect } from "react";

type Writer = (t: number) => void;

const writers = new Set<Writer>();
let last: number | null = null;

/** Draws loop time t (seconds): hands it to every animated component, which writes its own elements. */
export function draw(t: number) {
  last = t;
  for (const write of writers) write(t);
}

/**
 * Subscribes a component's writer for as long as it's mounted. The writer only touches the component's own
 * elements (through refs) and gets the latest time at once, so nothing paints in a half-set state.
 */
export function useFrame(write: Writer) {
  useLayoutEffect(() => {
    writers.add(write);
    if (last !== null) write(last);
    return () => {
      writers.delete(write);
    };
  }, [write]);
}
