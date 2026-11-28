import { useCallback, useRef } from "react";
import { useFrame } from "../lib/clock";
import { FOCUS } from "../lib/content";
import { KNOB_TRAVEL } from "../lib/layout";
import { out, seg } from "../lib/motion";
import { FOCUS_ON, MOON_SWELL, MOON_TURN, TOGGLE_DIP } from "../lib/timeline";
import { Label } from "./Label";
import { Tile } from "./Tile";
import { Moon } from "./icons";
import styles from "./FocusMode.module.css";

/** The focus switch: one tap dips the switch, the tile fades to a dark ultramarine state and the words flip. */
export function FocusMode() {
  const face = useRef<HTMLDivElement>(null);
  const dark = useRef<HTMLDivElement>(null);
  const moon = useRef<HTMLDivElement>(null);
  const state = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);

  useFrame(
    useCallback((t: number) => {
      const faceEl = face.current;
      const darkEl = dark.current;
      const moonEl = moon.current;
      const stateEl = state.current;
      const captionEl = caption.current;
      const toggleEl = toggle.current;
      const knobEl = knob.current;
      if (!faceEl || !darkEl || !moonEl || !stateEl || !captionEl || !toggleEl || !knobEl) return;

      const k = seg(t, FOCUS_ON, FOCUS_ON + 0.45);
      const on = k > 0.5;
      darkEl.style.opacity = String(k);
      faceEl.classList.toggle(styles.on, on);
      const words = on ? FOCUS.on : FOCUS.off;
      stateEl.textContent = words.state;
      captionEl.textContent = words.caption;
      moonEl.style.transform = `rotate(${MOON_TURN * k}deg) scale(${1 + MOON_SWELL * Math.sin(Math.PI * k)})`;
      knobEl.style.transform = `translateX(${KNOB_TRAVEL * seg(t, FOCUS_ON, FOCUS_ON + 0.3, out)}px)`;
      const pr = seg(t, FOCUS_ON - 0.15, FOCUS_ON, out) * (1 - seg(t, FOCUS_ON + 0.05, FOCUS_ON + 0.25));
      toggleEl.style.transform = `scale(${1 - TOGGLE_DIP * pr})`;
    }, []),
  );

  return (
    <Tile index={6} col={2} row={2}>
      <div ref={face} className={styles.face}>
        <div ref={dark} className={styles.dark} />
        <Label className={styles.label}>{FOCUS.label}</Label>
        <div ref={moon} className={styles.moon}>
          <Moon size={26} />
        </div>
        <div ref={state} className={styles.state} />
        <div ref={caption} className={styles.caption} />
        <div ref={toggle} className={styles.toggle}>
          <div ref={knob} className={styles.knob} />
        </div>
      </div>
    </Tile>
  );
}
