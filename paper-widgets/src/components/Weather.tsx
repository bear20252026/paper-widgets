import { useCallback, useRef } from "react";
import { useFrame } from "../lib/clock";
import { WEATHER } from "../lib/content";
import { ARC, ARC_BOX, ARC_DOTTED, ARC_LIT, GLOW_R0, HORIZON_Y, SUN_R } from "../lib/layout";
import { out, seg } from "../lib/motion";
import { GLOW_PULSE, GLOW_R, GLOW_SPEED, SUN_RISE, SUN_SHARE, SUN_SHOW, TEMP_COUNT } from "../lib/timeline";
import { Label } from "./Label";
import { Tile } from "./Tile";
import styles from "./Weather.module.css";

/** Lisbon, 24°: the temperature counts up while the sun climbs its dotted arc. */
export function Weather() {
  const temp = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const arc = useRef<SVGPathElement>(null);
  const sun = useRef<SVGCircleElement>(null);
  const glow = useRef<SVGCircleElement>(null);

  useFrame(
    useCallback((t: number) => {
      const tempEl = temp.current;
      const pathEl = path.current;
      const arcEl = arc.current;
      const sunEl = sun.current;
      const glowEl = glow.current;
      if (!tempEl || !pathEl || !arcEl || !sunEl || !glowEl) return;

      tempEl.textContent = Math.round(WEATHER.temp * seg(t, TEMP_COUNT[0], TEMP_COUNT[1], out)) + "°";
      const k = SUN_SHARE * seg(t, SUN_RISE[0], SUN_RISE[1]);
      arcEl.setAttribute("stroke-dashoffset", String(1 - k));
      const p = pathEl.getPointAtLength(pathEl.getTotalLength() * k);
      sunEl.setAttribute("cx", String(p.x));
      sunEl.setAttribute("cy", String(p.y));
      glowEl.setAttribute("cx", String(p.x));
      glowEl.setAttribute("cy", String(p.y));
      glowEl.setAttribute("r", String(GLOW_R + GLOW_PULSE * Math.sin(t * GLOW_SPEED)));
      const show = String(seg(t, SUN_SHOW[0], SUN_SHOW[1]));
      sunEl.setAttribute("opacity", show);
      glowEl.setAttribute("opacity", show);
    }, []),
  );

  return (
    <Tile index={0} col={0} row={0}>
      <Label>{WEATHER.city}</Label>
      <div className={styles.range}>{WEATHER.range}</div>
      <div ref={temp} className={styles.temp} />
      <div className={styles.sky}>{WEATHER.sky}</div>
      <svg
        className={styles.arcBox}
        width={ARC_BOX.w}
        height={ARC_BOX.h}
        viewBox={`0 0 ${ARC_BOX.w} ${ARC_BOX.h}`}
        aria-hidden="true"
      >
        <path
          ref={path}
          d={ARC}
          strokeWidth={ARC_DOTTED.width}
          strokeDasharray={ARC_DOTTED.dash}
          className={styles.dotted}
        />
        <line x1={0} x2={ARC_BOX.w} y1={HORIZON_Y} y2={HORIZON_Y} className={styles.horizon} />
        <path
          ref={arc}
          d={ARC}
          strokeWidth={ARC_LIT}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          className={styles.arc}
        />
        <circle ref={glow} r={GLOW_R0} className={styles.glow} />
        <circle ref={sun} r={SUN_R} className={styles.sun} />
      </svg>
      <div className={`${styles.time} ${styles.sunrise}`}>{WEATHER.sunrise}</div>
      <div className={`${styles.time} ${styles.sunset}`}>{WEATHER.sunset}</div>
    </Tile>
  );
}
