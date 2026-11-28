import { clamp } from "./math";

/** The sleep arc's three colours (the shader's arcCol a, b, c), as 0–255 RGB for the hour bars. */
const DEEP = [51, 54, 143],
  VIOLET = [122, 105, 240],
  PEACH = [252, 189, 158];
/** Where violet sits along the arc (0 = bedtime, 1 = wake-up), and the rest of the way to peach. */
const MID = 0.72,
  REST = 0.28;

/** The colour at u along the sleep window, "r,g,b". */
export function arcRgb(u: number): string {
  const m = (x: number[], y: number[], k: number) => x.map((v, i) => Math.round(v + (y[i] - v) * k));
  return (u < MID ? m(DEEP, VIOLET, u / MID) : m(VIOLET, PEACH, (u - MID) / REST)).join(",");
}

/** The card's colour as the night grows: #f6f6f9 by day, down to #eaeaf3 when the sleep window nears 24 h. */
export function cardRgb(nightFraction: number): string {
  const k = Math.pow(clamp((nightFraction - 0.3) / 0.66), 1.5);
  return `rgb(${Math.round(246 - 12 * k)},${Math.round(246 - 12 * k)},${Math.round(249 - 6 * k)})`;
}
