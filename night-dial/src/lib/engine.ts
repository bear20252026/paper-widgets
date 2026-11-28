import { clamp } from "./math";
import { arcRgb, cardRgb } from "./palette";
import type { Scene } from "./scene";
import { A, LOOP, P, curAt, isDown, pressAt, sched } from "./timeline";

declare global {
  interface Window {
    /** Draws any moment of the loop: __render(t), t in seconds (wraps every __LOOP). */
    __render?: (t: number) => void;
    /** The loop's length in seconds (8). */
    __LOOP?: number;
    /** Set it before the page loads (or open the page with ?rec) to keep the page still and call __render(t) yourself. */
    __RENDERING__?: boolean;
  }
}

/** The stage is 1080 × 1080, centred in the window and scaled to its shorter side. */
export const STAGE = 1080;
/** Reduced motion: one still of the settled dial (8 h of sleep), without the cursor. */
const STILL_T = 0;

export type Parts = {
  stage: HTMLElement;
  card: HTMLElement;
  moon: HTMLElement;
  sun: HTMLElement;
  sunIcon: SVGSVGElement;
  fills: HTMLElement[];
  cursor: SVGSVGElement;
};

/** Plays the 8-s loop: the shader's uniforms and the DOM around it. Returns a function that stops it. */
export function run(scene: Scene, { stage, card, moon, sun, sunIcon, fills, cursor }: Parts): () => void {
  const fit = () => {
    stage.style.transform = `translate(-50%,-50%) scale(${Math.min(innerWidth, innerHeight) / STAGE})`;
  };
  fit();

  const render = (t: number) => {
    const [B, W] = sched(t),
      c = curAt(t, W);
    const down = isDown(t),
      press = pressAt(t);
    scene.draw({ uB: A(B), uW: A(W), uT: t, uP: press });
    // the knobs: bedtime (moon) and wake-up (sun); the held sun knob swells a little with the press
    const kb = P(B),
      kw = P(W),
      sb = 1,
      sw = 1 + 0.08 * (down ? press : 0);
    moon.style.transform = `translate(${kb[0]}px,${kb[1]}px) scale(${sb})`;
    sun.style.transform = `translate(${kw[0]}px,${kw[1]}px) scale(${sw})`;
    // hours as bars: each bar fills from the bottom, the edge one fills partially
    const hrs = W - B,
      nf = hrs / 24;
    fills.forEach((b, i) => {
      const f = clamp(hrs - i);
      b.style.background = `rgb(${arcRgb(i / Math.max(hrs - 1, 1))})`;
      b.style.transform = `scaleY(${f})`;
      b.style.opacity = f > 0 ? "1" : "0";
    });
    sunIcon.style.transform = `rotate(${(W * 15).toFixed(1)}deg)`;
    // the card itself dusks a little as the night grows
    card.style.background = cardRgb(nf);
    cursor.style.transform = `translate(${c[0] - 2}px,${c[1] - 2}px) scale(${down ? 0.86 : 1})`;
  };
  const wrap = (t: number) => ((t % LOOP) + LOOP) % LOOP;
  window.__render = (t: number) => render(wrap(t));
  window.__LOOP = LOOP;

  const rec = window.__RENDERING__ || new URLSearchParams(location.search).has("rec");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  let current = rec ? 0 : STILL_T;
  addEventListener("resize", fit);

  if (rec || reduce) {
    if (reduce && !rec) cursor.style.visibility = "hidden";
    window.__render = (t: number) => {
      current = t;
      render(wrap(t));
    };
    render(wrap(current));
  } else {
    const t0 = performance.now() / 1000;
    const frame = () => {
      const now = performance.now() / 1000;
      render(((now - t0) % LOOP + LOOP) % LOOP);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("resize", fit);
    window.__render = undefined;
  };
}
