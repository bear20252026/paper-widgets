import { eIO, lerp, seg } from "./math";

export type Pt = [number, number];

/** The loop's length in seconds; t = 8 is t = 0. */
export const LOOP = 8;
/** The dial's centre and ring radius on the 1080 stage (the shader's C and RR). */
export const CX = 540,
  CY = 488,
  RR = 310;
/** Hours → angle in radians, clockwise from 12 o'clock (24 h = one turn). */
export const A = (h: number) => (h / 24) * 2 * Math.PI;
/** A point on the ring (or at radius r) at hour h. */
export const P = (h: number, r = RR): Pt => [CX + r * Math.sin(A(h)), CY - r * Math.cos(A(h))];

/**
 * Bedtime and wake-up in hours over the loop. Bedtime stays at 23 h; the wake-up (sun) knob starts at 31 h (7 am, 8 h
 * of sleep), goes all the way round to 46 h (23 h of sleep), back to 24 h (1 h) and home to 31 h.
 */
export function sched(t: number): Pt {
  const a = eIO(seg(t, 0.8, 2.9)),
    b = eIO(seg(t, 3.5, 5.5)),
    c = eIO(seg(t, 6.0, 7.0));
  return [23, 31 + 15 * a - 22 * b + 7 * c];
}

const mv = (a: Pt, b: Pt, u: number): Pt => [lerp(a[0], b[0], eIO(u)), lerp(a[1], b[1], eIO(u))];
/** Where the drawn cursor rests (stage px), and its hot spot's offset from a knob's centre while it holds one. */
const REST: Pt = [700, 846];
const off = (p: Pt): Pt => [p[0] + 6, p[1] + 8];

/** The drawn cursor's tip (stage px): rests, moves onto the sun knob, drags it with the schedule, goes back. */
export function curAt(t: number, W: number): Pt {
  if (t < 0.3) return REST;
  if (t < 0.8) return mv(REST, off(P(31)), seg(t, 0.3, 0.8));
  if (t < 7.0) return off(P(W));
  if (t < 7.6) return mv(off(P(31)), REST, seg(t, 7.0, 7.6));
  return REST;
}

/** True while the cursor holds the sun knob down (the three drags). */
export const isDown = (t: number) => (t > 0.76 && t < 2.96) || (t > 3.44 && t < 5.56) || (t > 5.94 && t < 7.04);

/** How hard the knob is pressed, 0–1: eases in at each grab and out at each release. */
export const pressAt = (t: number) =>
  Math.max(
    seg(t, 0.76, 0.92) * (1 - seg(t, 2.92, 3.1)),
    seg(t, 3.44, 3.6) * (1 - seg(t, 5.52, 5.7)),
    seg(t, 5.94, 6.1) * (1 - seg(t, 7.0, 7.18)),
  );
