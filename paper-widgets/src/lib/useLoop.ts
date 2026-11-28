import { useEffect, useLayoutEffect } from "react";
import { draw } from "./clock";
import { LOOP, STILL_AT } from "./timeline";

declare global {
  interface Window {
    /** Draws any moment of the loop: __render(t), t in seconds. Always available, for frame-by-frame export. */
    __render: (t: number) => void;
    /** Set it before the page loads to turn the live loop off and call __render(t) yourself. */
    __RENDERING__?: boolean;
  }
}

const FACES = ['300 1em "Geist"', '400 1em "Geist"', '400 1em "Geist Mono"', '500 1em "Geist Mono"', '400 1em "Inter"'];

/**
 * Plays the 11-second loop from t = 0 once the fonts have loaded. With reduced motion it draws one still frame;
 * with window.__RENDERING__ set it draws nothing on its own.
 */
export function useLoop() {
  // First frame before paint: an empty stage, the tiles about to rise in
  useLayoutEffect(() => {
    window.__render = draw;
    draw(0);
  }, []);

  useEffect(() => {
    if (window.__RENDERING__) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let cancelled = false;

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduce.matches) {
        draw(STILL_AT);
        return;
      }
      let t0: number | null = null;
      const tick = (now: number) => {
        if (t0 === null) t0 = now;
        draw(((now - t0) / 1000) % LOOP);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    Promise.all(FACES.map((face) => document.fonts.load(face)))
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) start();
      });
    reduce.addEventListener("change", start);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      reduce.removeEventListener("change", start);
    };
  }, []);
}
