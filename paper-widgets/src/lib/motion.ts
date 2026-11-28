/** Easing helpers. Every motion in the loop is one of these applied to a slice of loop time. */

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Cubic in-out: the default */
export const inOut = (t: number) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/** Cubic out */
export const out = (t: number) => {
  t = clamp(t);
  return 1 - Math.pow(1 - t, 3);
};

/** Back out (overshoot 1.5): the step bars */
export const back = (t: number) => {
  t = clamp(t);
  const c = 1.5;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** Progress 0 … 1 through the slice a → b of loop time t (seconds), eased */
export const seg = (t: number, a: number, b: number, f = inOut) => f((t - a) / (b - a));

/** Minutes and seconds, "m:ss" */
export const clock = (seconds: number) =>
  Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");

/** Two-digit minutes and seconds, "mm:ss" */
export const clock2 = (seconds: number) =>
  String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
