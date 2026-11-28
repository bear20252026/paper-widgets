import type { Snake } from "./types";
import { BOOST_MIN_LENGTH } from "./speed";

export { BOOST_MIN_LENGTH };

/** Length units consumed per second of boost. */
export const BOOST_DRAIN_PER_SEC = 9;
/** Seconds between light-point drops while boosting. */
export const BOOST_DROP_INTERVAL = 0.26;
/** Value of each dropped light point (small tier). */
export const BOOST_DROP_VALUE = 2;

/** Boosting is refused at or below 30 length (strictly greater than 30). */
export function canBoost(snake: Pick<Snake, "alive" | "length">): boolean {
  return snake.alive && snake.length > BOOST_MIN_LENGTH;
}

export interface BoostTickResult {
  boosting: boolean;
  drained: number;
  drops: number;
  length: number;
  /** leftover drop accumulator to store on the snake */
  dropAccum: number;
}

/**
 * Pure boost accounting for one fixed step.
 * Returns how much length was consumed (clamped to the 30 floor) and how many
 * light points should be dropped behind the snake.
 */
export function tickBoost(
  length: number,
  wantBoost: boolean,
  dtSec: number,
  dropAccum: number
): BoostTickResult {
  if (!wantBoost || length <= BOOST_MIN_LENGTH) {
    return { boosting: false, drained: 0, drops: 0, length, dropAccum: 0 };
  }
  const wanted = BOOST_DRAIN_PER_SEC * dtSec;
  const drained = Math.min(length - BOOST_MIN_LENGTH, wanted);
  let drops = 0;
  let acc = dropAccum + dtSec;
  while (acc >= BOOST_DROP_INTERVAL) {
    acc -= BOOST_DROP_INTERVAL;
    drops += 1;
  }
  return { boosting: true, drained, drops, length: length - drained, dropAccum: acc };
}

/**
 * Deterministic boost length drain used by the engine and tests.
 * Boost stops exactly at the 30 floor.
 */
export function drainLengthForBoost(length: number, dtSec: number): number {
  if (length <= BOOST_MIN_LENGTH) return 0;
  return Math.min(length - BOOST_MIN_LENGTH, BOOST_DRAIN_PER_SEC * dtSec);
}
