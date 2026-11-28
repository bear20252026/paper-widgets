import { useCallback, useRef, type CSSProperties } from "react";
import { useFrame } from "../lib/clock";
import { NOW_PLAYING } from "../lib/content";
import { COVER_W, PROGRESS_W, PROGRESS_X } from "../lib/layout";
import { clamp, clock, out, seg } from "../lib/motion";
import {
  COVER_FADE,
  COVER_SHIFT,
  COVER_SHRINK,
  EQ_MIN,
  EQ_ON,
  EQ_RANGE,
  EQ_REST,
  EQ_SPEED,
  EQ_SPREAD,
  PLAY_FROM,
  PRESS_SCALE,
  PRESS_WASH,
  PROGRESS_IN,
  SKIP,
} from "../lib/timeline";
import { Label } from "./Label";
import { Next, Pause, Prev } from "./icons";
import { Tile } from "./Tile";
import styles from "./NowPlaying.module.css";

const [FIRST, SECOND] = NOW_PLAYING.tracks;
const BARS = [0, 1, 2, 3, 4];

/** The player: an equaliser on the label's line, a running playhead and a track change at 6 s. */
export function NowPlaying() {
  const coverA = useRef<HTMLDivElement>(null);
  const coverB = useRef<HTMLDivElement>(null);
  const eq = useRef<(HTMLDivElement | null)[]>([]);
  const title = useRef<HTMLDivElement>(null);
  const artist = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const elapsed = useRef<HTMLDivElement>(null);
  const length = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLDivElement>(null);

  useFrame(
    useCallback((t: number) => {
      const a = coverA.current;
      const b = coverB.current;
      const titleEl = title.current;
      const artistEl = artist.current;
      const fillEl = fill.current;
      const knobEl = knob.current;
      const elapsedEl = elapsed.current;
      const lengthEl = length.current;
      const nextEl = next.current;
      if (!a || !b || !titleEl || !artistEl || !fillEl || !knobEl || !elapsedEl || !lengthEl || !nextEl) return;

      const on = t > EQ_ON;

      // The covers: the old one drifts left, shrinks and fades as the new one slides in from the right
      const sw = seg(t, SKIP + 0.1, SKIP + 0.6);
      a.style.transform = `translateX(${COVER_SHIFT * sw}px) scale(${1 - COVER_SHRINK * sw})`;
      a.style.opacity = String(1 - sw * COVER_FADE);
      b.style.transform = `translateX(${(1 - sw) * COVER_W}px)`;

      // Title and artist dip out and back while the words change
      const second = t > SKIP + 0.3;
      const track = second ? SECOND : FIRST;
      titleEl.textContent = track.title;
      artistEl.textContent = track.artist;
      const dip = String(1 - seg(t, SKIP + 0.2, SKIP + 0.32) * (1 - seg(t, SKIP + 0.32, SKIP + 0.55)));
      titleEl.style.opacity = dip;
      artistEl.style.opacity = dip;
      lengthEl.textContent = clock(track.length);

      // The playhead, in seconds of the track; the bar grows to it once at the start
      let pos = second ? (t - SKIP - 0.4) * 1 : FIRST.from + (t - PLAY_FROM) * 1;
      pos = Math.max(0, pos);
      const f = clamp(pos / track.length) * seg(t, PROGRESS_IN[0], PROGRESS_IN[1]);
      fillEl.style.width = PROGRESS_W * f + "px";
      knobEl.style.left = PROGRESS_X + PROGRESS_W * f + "px";
      elapsedEl.textContent = clock(pos);

      eq.current.forEach((bar, i) => {
        if (!bar) return;
        const h = on ? EQ_MIN + EQ_RANGE * Math.abs(Math.sin(t * (EQ_SPEED + i * EQ_SPREAD) + i)) : EQ_REST;
        bar.style.height = h + "px";
      });

      // The press on next
      const pr = seg(t, SKIP - 0.1, SKIP, out) * (1 - seg(t, SKIP + 0.05, SKIP + 0.25));
      nextEl.style.transform = `scale(${1 - PRESS_SCALE * pr})`;
      nextEl.style.background = `rgb(var(--ink-rgb) / ${PRESS_WASH * pr})`;
    }, []),
  );

  return (
    <Tile index={1} col={1} row={0} wide className={styles.player}>
      <div className={styles.cover}>
        <div ref={coverA} className={`${styles.art} ${styles.artA}`}>
          <div className={styles.aDisc} />
          <div className={styles.aRule} />
          <div className={styles.aMark}>{NOW_PLAYING.coverMark}</div>
        </div>
        <div ref={coverB} className={`${styles.art} ${styles.artB}`}>
          <div className={styles.bDisc} />
          <div className={styles.bSquare} />
        </div>
      </div>
      <Label>{NOW_PLAYING.label}</Label>
      <div className={styles.eq}>
        {BARS.map((i) => (
          <div
            key={i}
            ref={(el) => {
              eq.current[i] = el;
            }}
            className={styles.eqBar}
            style={{ "--i": i } as CSSProperties}
          />
        ))}
      </div>
      <div ref={title} className={styles.title} />
      <div ref={artist} className={styles.artist} />
      <div className={styles.progress}>
        <div ref={fill} className={styles.fill} />
      </div>
      <div ref={knob} className={styles.knob} />
      <div ref={elapsed} className={`${styles.time} ${styles.elapsed}`} />
      <div ref={length} className={`${styles.time} ${styles.length}`} />
      <div className={`${styles.button} ${styles.prev}`}>
        <Prev size={20} />
      </div>
      <div className={styles.play}>
        <Pause size={20} />
      </div>
      <div ref={next} className={`${styles.button} ${styles.next}`}>
        <Next size={20} />
      </div>
    </Tile>
  );
}
