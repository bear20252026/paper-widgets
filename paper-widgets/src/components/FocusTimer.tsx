import { useCallback, useRef } from "react";
import { useFrame } from "../lib/clock";
import { TIMER } from "../lib/content";
import { DIAL, TICK_IN, TICK_OUT, TICK_OUT_MAJOR, TICK_W, TICK_W_MAJOR } from "../lib/layout";
import { clamp, clock2, seg } from "../lib/motion";
import { TICK_FADE, TICK_LAG, TICKS_IN, TIMER_SPEED, TIMER_START } from "../lib/timeline";
import { Label } from "./Label";
import { Tile } from "./Tile";
import styles from "./FocusTimer.module.css";

const C = DIAL / 2;

const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
  const r2 = i % 5 ? TICK_OUT : TICK_OUT_MAJOR;
  return {
    x1: C + Math.cos(a) * TICK_IN,
    y1: C + Math.sin(a) * TICK_IN,
    x2: C + Math.cos(a) * r2,
    y2: C + Math.sin(a) * r2,
    width: i % 5 ? TICK_W : TICK_W_MAJOR,
  };
});

/** A 25-minute focus timer run at 12×: one tick lights for every second of the countdown. */
export function FocusTimer() {
  const ticks = useRef<(SVGLineElement | null)[]>([]);
  const digits = useRef<HTMLDivElement>(null);

  useFrame(
    useCallback((t: number) => {
      const digitsEl = digits.current;
      if (!digitsEl) return;

      const run = Math.max(0, t - TIMER_START) * TIMER_SPEED; // seconds of the countdown gone
      const s = Math.floor(run % 60);
      digitsEl.textContent = clock2(TIMER.minutes * 60 - run);
      const intro = seg(t, TICKS_IN[0], TICKS_IN[1]);
      ticks.current.forEach((line, i) => {
        if (!line) return;
        line.classList.toggle(styles.lit, t > TIMER_START && i <= s);
        line.setAttribute("opacity", String(clamp(intro * TICK_FADE - i * TICK_LAG)));
      });
    }, []),
  );

  return (
    <Tile index={2} col={0} row={1}>
      <Label>{TIMER.label}</Label>
      <svg className={styles.dial} width={DIAL} height={DIAL} viewBox={`0 0 ${DIAL} ${DIAL}`} aria-hidden="true">
        {TICKS.map((tick, i) => (
          <line
            key={i}
            ref={(el) => {
              ticks.current[i] = el;
            }}
            className={styles.tick}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            strokeWidth={tick.width}
          />
        ))}
      </svg>
      <div ref={digits} className={styles.digits} />
      <div className={styles.caption}>{TIMER.caption}</div>
    </Tile>
  );
}
