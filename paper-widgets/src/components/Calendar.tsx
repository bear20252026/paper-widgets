import { useCallback, useRef } from "react";
import { useFrame } from "../lib/clock";
import { CALENDAR } from "../lib/content";
import { CHIP_TOP, ROW_PITCH } from "../lib/layout";
import { out, seg } from "../lib/motion";
import {
  CHIP_IN,
  EVENTS_IN,
  EVENTS_RISE,
  EVENTS_STAGGER,
  ROLL,
} from "../lib/timeline";
import { Label } from "./Label";
import { Tile } from "./Tile";
import styles from "./Calendar.module.css";

const LAST = CALENDAR.events.length - 1;

/** The day's calendar: the events rise in, then the list rolls up to the next one and the chip changes. */
export function Calendar() {
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const chip = useRef<HTMLDivElement>(null);

  useFrame(
    useCallback((t: number) => {
      const chipEl = chip.current;
      if (!chipEl) return;

      const sh = seg(t, ROLL, ROLL + 0.6);
      rows.current.forEach((row, i) => {
        if (!row) return;
        const intro = seg(t, EVENTS_IN[0] + i * EVENTS_STAGGER, EVENTS_IN[1] + i * EVENTS_STAGGER, out);
        const y = i * ROW_PITCH - ROW_PITCH * sh;
        const o = intro * (i === 0 ? 1 - sh : 1) * (i === LAST ? sh : 1);
        row.style.top = y + (1 - intro) * EVENTS_RISE + "px";
        row.style.opacity = String(o);
        row.classList.toggle(styles.next, (i === 0 && sh < 0.5) || (i === 1 && sh >= 0.5));
      });
      chipEl.style.top = CHIP_TOP + "px";
      chipEl.textContent = t < ROLL + 0.3 ? CALENDAR.chips[0] : CALENDAR.chips[1];
      chipEl.style.opacity = String(
        seg(t, CHIP_IN[0], CHIP_IN[1]) * (1 - seg(t, ROLL, ROLL + 0.2) + seg(t, ROLL + 0.35, ROLL + 0.6)),
      );
    }, []),
  );

  return (
    <Tile index={5} col={0} row={2} wide>
      <Label>{CALENDAR.weekday}</Label>
      <div className={styles.day}>{CALENDAR.day}</div>
      <div className={styles.month}>{CALENDAR.month}</div>
      <div className={styles.summary}>{CALENDAR.summary}</div>
      <div className={styles.divider} />
      <div className={styles.list}>
        {CALENDAR.events.map((event, i) => (
          <div
            key={event.time}
            ref={(el) => {
              rows.current[i] = el;
            }}
            className={styles.row}
          >
            <div className={styles.time}>{event.time}</div>
            <div className={styles.marker} />
            <div>
              <div className={styles.title}>{event.title}</div>
              <div className={styles.detail}>{event.detail}</div>
            </div>
          </div>
        ))}
        <div ref={chip} className={styles.chip} />
      </div>
    </Tile>
  );
}
