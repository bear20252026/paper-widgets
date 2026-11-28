import { useEffect, useRef } from "react";
import { run } from "../lib/engine";
import { createScene, type Scene } from "../lib/scene";
import styles from "./NightDial.module.css";

/** One bar per hour of the day; the sleep window fills them. */
const HOURS = 24;

/** The sleep-schedule dial: a card, the WebGL dial on a 2160² canvas, the two knobs, the hour bars and the cursor. */
export function NightDial({ label }: { label: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const moon = useRef<HTMLDivElement>(null);
  const sun = useRef<HTMLDivElement>(null);
  const sunIcon = useRef<SVGSVGElement>(null);
  const bars = useRef<HTMLDivElement>(null);
  const cursor = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const [st, cd, cv, mn, sn, si, br, cu] = [
      stage.current,
      card.current,
      canvas.current,
      moon.current,
      sun.current,
      sunIcon.current,
      bars.current,
      cursor.current,
    ];
    if (!st || !cd || !cv || !mn || !sn || !si || !br || !cu) return;
    let scene: Scene;
    try {
      scene = createScene(cv);
    } catch (error) {
      console.error("WebGL2 isn't available here: showing the card only.", error);
      return;
    }
    const fills = Array.from(br.querySelectorAll<HTMLElement>("i"));
    const stop = run(scene, { stage: st, card: cd, moon: mn, sun: sn, sunIcon: si, fills, cursor: cu });
    return () => {
      stop();
      scene.dispose();
    };
  }, []);

  return (
    <div ref={stage} className={styles.stage} role="img" aria-label={label}>
      <div ref={card} className={styles.card} />
      <canvas ref={canvas} className={styles.gl} width={2160} height={2160} aria-hidden="true" />
      <div ref={moon} className={styles.knob} aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 28 28">
          <path d="M19.5 18.6A9 9 0 0 1 10.2 6a9.6 9.6 0 1 0 12.4 11.6 9 9 0 0 1-3.1 1z" style={{ fill: "var(--moon)" }} />
        </svg>
      </div>
      <div ref={sun} className={styles.knob} aria-hidden="true">
        <svg ref={sunIcon} width="30" height="30" viewBox="0 0 30 30">
          <circle cx="15" cy="15" r="5.6" style={{ fill: "var(--sun)" }} />
          <g style={{ stroke: "var(--sun)" }} strokeWidth="2.4" strokeLinecap="round">
            <path d="M15 3v3M15 24v3M3 15h3M24 15h3M6.5 6.5l2.1 2.1M21.4 21.4l2.1 2.1M6.5 23.5l2.1-2.1M21.4 8.6l2.1-2.1" />
          </g>
        </svg>
      </div>
      <div ref={bars} className={styles.bars} aria-hidden="true">
        {Array.from({ length: HOURS }, (_, i) => (
          <div key={i} className={styles.bar} style={{ left: `calc(${i} * var(--bar-step))` }}>
            <i className={styles.fill} />
          </div>
        ))}
      </div>
      <svg ref={cursor} className={styles.cursor} width="26" height="26" viewBox="0 0 22 22" aria-hidden="true">
        <path
          d="M2 1.5 L2 17.5 L6.4 13.4 L9.3 20 L12.1 18.8 L9.3 12.4 L15.3 12.2 Z"
          style={{ fill: "var(--cursor)", stroke: "var(--cursor-edge)" }}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
