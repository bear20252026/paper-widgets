export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** Progress of t through [a, b], clamped to 0–1. */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
/** Cubic ease in-out. */
export const eIO = (u: number) => {
  u = clamp(u);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};
