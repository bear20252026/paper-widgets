import { useEffect, useRef } from "react";
import { HEADING, SWITCH_LABEL } from "../content";
import { LOOP } from "../lib/demo";
import { createEngine, type Engine, type Parts } from "../lib/engine";
import styles from "./AquariumToggle.module.css";

declare global {
  interface Window {
    /** ?demo=1 only: draws the demo at t seconds on a fixed 60 fps clock, frame-exact (for video export). */
    __render?: (t: number) => void;
    /** ?demo=1 only: one pass of the demo, in seconds. */
    __LOOP?: number;
  }
}

/** The room, the pill (canvas + the switch button over it) and the demo pointer. */
export function AquariumToggle() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hit = useRef<HTMLButtonElement>(null);
  const status = useRef<HTMLSpanElement>(null);
  const tank = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const cursor = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const [cv, ht, st, tk, wr, cu] = [canvas.current, hit.current, status.current, tank.current, wrap.current, cursor.current];
    if (!cv || !ht || !st || !tk || !wr || !cu) return;
    const parts: Parts = { canvas: cv, hit: ht, status: st, tank: tk, wrap: wr, cursor: cu };
    const demo = new URLSearchParams(location.search).get("demo") === "1";

    let engine: Engine = createEngine(parts, { demo });
    engine.start();

    if (demo) {
      // frame-exact recorder: a fresh tank, stepped from 0 on a fixed 60 fps clock; going back in time starts over.
      // Frame 1 (t = 1/60) is the first drawn frame, so t = 0 shows it too.
      let frame = -1;
      window.__LOOP = LOOP;
      window.__render = (t: number) => {
        const target = Math.max(1, Math.round(t * 60));
        if (frame < 0 || target < frame) {
          engine.dispose();
          engine = createEngine(parts, { demo: true, now0: 0 });
          frame = 0;
        }
        while (frame < target) { frame++; engine.step(frame * (1000 / 60)); }
      };
    }

    return () => {
      engine.dispose();
      delete window.__render;
      delete window.__LOOP;
    };
  }, []);

  return (
    <main className={styles.stage}>
      <h1 className={styles.vh}>{HEADING}</h1>
      <div ref={wrap} className={styles.wrap}>
        <div ref={tank} className={styles.tank}>
          <canvas ref={canvas} aria-hidden="true" />
          <button ref={hit} className={styles.hit} type="button" role="switch" aria-checked="false" aria-label={SWITCH_LABEL} />
          <span ref={status} className={styles.vh} role="status" aria-live="polite" />
        </div>
      </div>
      <svg ref={cursor} className={styles.cursor} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3 2 L3 19.2 L7.4 15 L10.5 21.8 L13.6 20.4 L10.6 13.8 L16.9 13.6 Z"
          fill="#15161a"
          stroke="#fff"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </main>
  );
}
