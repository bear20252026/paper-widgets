/**
 * Speed / silhouette curves.
 *
 * Big snakes are NOT faster. This is deliberately a curve (not a reverse
 * linear ramp): hatchlings are slow, mid-sized snakes are the quickest and
 * giants have a lower base speed. Boost is the only way for giants to catch
 * small snakes, and it burns length.
 */

export const MIN_LENGTH = 12;
export const START_LENGTH = 60;
export const BOOST_MIN_LENGTH = 30;
export const BOOST_SPEED_MULTIPLIER = 1.62;

const PEAK_AT = 170;
const PEAK_SPEED = 152;
const HATCHLING_SPEED = 112;
const GIANT_FLOOR = 89;
const GIANT_SPAN = 1830; // length from PEAK_AT to plateaus

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Base movement speed in world px / second. */
export function baseSpeed(length: number): number {
  const l = clamp(length, BOOST_MIN_LENGTH, 2400);
  if (l <= PEAK_AT) {
    const t = (l - BOOST_MIN_LENGTH) / Math.max(1, PEAK_AT - BOOST_MIN_LENGTH);
    return HATCHLING_SPEED + (PEAK_SPEED - HATCHLING_SPEED) * smoothstep(t);
  }
  const t = clamp((l - PEAK_AT) / GIANT_SPAN, 0, 1);
  return PEAK_SPEED - (PEAK_SPEED - GIANT_FLOOR) * Math.pow(t, 0.72);
}

/** Speed used this frame (before wall penalty), including boost. */
export function currentSpeed(length: number, boosting: boolean): number {
  return baseSpeed(length) * (boosting ? BOOST_SPEED_MULTIPLIER : 1);
}

export function radiusForLength(length: number): number {
  const l = Math.max(1, length);
  return clamp(8 + Math.pow(l, 0.45) * 0.86, 8.2, 22.5);
}

export function headRadiusFor(snakeRadius: number): number {
  return snakeRadius * 1.16;
}

export function segmentCountForLength(length: number): number {
  return Math.round(clamp(12 + Math.max(0, length - MIN_LENGTH) * 0.4, 12, 150));
}

export function segmentSpacing(radius: number): number {
  return Math.max(5.4, radius * 0.8);
}

export function displayLength(length: number): number {
  return Math.max(0, Math.round(length));
}

/** Camera scale: small snakes see a tighter field, giants see more. */
export function cameraScaleForLength(length: number): number {
  const l = Math.max(0, length);
  return clamp(1.06 - Math.pow(l, 0.62) * 0.016, 0.6, 1.06);
}

/**
 * Turn rate (rad/s). Two smooth curves instead of a linear clamp:
 *  - size: hatchlings turn briskly, giants keep only ~58% (wide arcs),
 *    easing with smoothstep so the mid-game never feels like a wall.
 *  - speed: the faster you travel the lazier the nose, so a boosted giant
 *    must plan wider corners instead of pivoting on the spot.
 */
export function turnRateFor(isPlayer: boolean, length: number, speed = 0): number {
  const L = Math.max(0, length);
  const size = 1 - 0.42 * smoothstep((L - 60) / 1500);
  const speedFactor = speed > 0 ? clamp(168 / Math.max(90, speed), 0.7, 1.14) : 1;
  const base = isPlayer ? 7.4 : 5.0;
  return base * size * speedFactor;
}

/**
 * 0.55 → 0.9 body follow smoothing. Longer snakes relax their spine a little
 * more slowly, which removes the "stiff rope" look without adding input lag on
 * the head (the head always answers immediately).
 */
export function followSmoothingFor(length: number): number {
  return 0.55 + 0.35 * smoothstep((clamp(length, 0, 3000) - 60) / 1200);
}
