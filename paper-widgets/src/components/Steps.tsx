import { useCallback, useRef, type CSSProperties } from "react";
import { useFrame } from "../lib/clock";
import { STEPS } from "../lib/content";
import { back, out, seg } from "../lib/motion";
import { STEPS_BAR_STAGGER, STEPS_BARS, STEPS_COUNT, STEPS_RATE, STEPS_WALK } from "../lib/timeline";
import { Label } from "./Label";
import { Tile } from "./Tile";
import styles from "./Steps.module.css";

const TODAY = STEPS.days.length - 1;

/** A week of steps: the count runs up, the bars spring up and the last one is today. */
export function Steps() {
  const count = useRef<HTMLDivElement>(null);
  const bars = useRef<(HTMLDivElement | null)[]>([]);

  useFrame(
    useCallback((t: number) => {
      const countEl = count.current;
      if (!countEl) return;

      const extra = t > STEPS_WALK ? Math.floor((t - STEPS_WALK) * STEPS_RATE) : 0;
      countEl.textContent = (
        Math.round(STEPS.count * seg(t, STEPS_COUNT[0], STEPS_COUNT[1], out)) + extra
      ).toLocaleString("en-US");
      bars.current.forEach((bar, i) => {
        if (!bar) return;
        const g = seg(t, STEPS_BARS[0] + i * STEPS_BAR_STAGGER, STEPS_BARS[1] + i * STEPS_BAR_STAGGER, back);
        bar.style.transform = `scaleY(${STEPS.heights[i] * g})`;
      });
    }, []),
  );

  return (
    <Tile index={3} col={1} row={1}>
      <Label>{STEPS.label}</Label>
      <div ref={count} className={styles.count} />
      <div className={styles.goal}>{STEPS.goal}</div>
      {STEPS.days.map((letter, i) => (
        <div key={i} className={styles.day} style={{ "--i": i } as CSSProperties}>
          <div className={styles.empty} />
          <div
            ref={(el) => {
              bars.current[i] = el;
            }}
            className={`${styles.bar} ${i === TODAY ? styles.today : ""}`}
          />
          <div className={`${styles.letter} ${i === TODAY ? styles.todayLetter : ""}`}>{letter}</div>
        </div>
      ))}
    </Tile>
  );
}
