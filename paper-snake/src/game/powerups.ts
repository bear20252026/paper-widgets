import type { GameState, PowerKind, PowerUp, Snake } from "./types";
import { randRange, type Rng } from "./rng";

/**
 * Map pick-ups. Pure rules: every snake (player, bots, boss) can collect them
 * and gets exactly the same effect.
 *
 *  magnet — wide orb suction
 *  shield — immune to other snakes' bodies (walls still count)
 *  turbo  — free boost at any length, +18% cruise speed
 *  double — every orb is worth twice as much
 */
export const POWER_INFO: Record<PowerKind, { durationMs: number; weight: number; color: string; accent: string }> = {
  magnet: { durationMs: 10_000, weight: 3, color: "#8f7cf0", accent: "#efeaff" },
  shield: { durationMs: 6_500, weight: 2, color: "#38b9a0", accent: "#e3fbf4" },
  turbo: { durationMs: 7_000, weight: 3, color: "#f0a03c", accent: "#fff2dc" },
  double: { durationMs: 12_000, weight: 2, color: "#e2607a", accent: "#ffe8ee" },
};

export const POWER_KINDS: PowerKind[] = ["magnet", "shield", "turbo", "double"];
export const POWER_TARGET = 8;
export const POWER_RESPAWN_MS = 4_500;
export const POWER_RADIUS = 17;
export const TURBO_SPEED_BONUS = 1.18;

export function powerActive(snake: Pick<Snake, "powers">, kind: PowerKind, now: number): boolean {
  return !!snake.powers && snake.powers[kind] > now;
}

export function pickPowerKind(rng: Rng): PowerKind {
  const total = POWER_KINDS.reduce((sum, k) => sum + POWER_INFO[k].weight, 0);
  let roll = rng() * total;
  for (const kind of POWER_KINDS) {
    roll -= POWER_INFO[kind].weight;
    if (roll <= 0) return kind;
  }
  return "magnet";
}

/** Drop one pick-up somewhere open, away from the given point and from other pick-ups. */
export function spawnPowerUp(
  state: GameState,
  rng: Rng,
  avoid?: { x: number; y: number; radius: number },
  kind?: PowerKind
): PowerUp {
  let x = state.width / 2;
  let y = state.height / 2;
  for (let attempt = 0; attempt < 20; attempt++) {
    x = randRange(rng, 360, state.width - 360);
    y = randRange(rng, 360, state.height - 360);
    const farFromAvoid = !avoid || Math.hypot(x - avoid.x, y - avoid.y) > avoid.radius;
    const spaced = state.powerUps.every((p) => Math.hypot(p.x - x, p.y - y) > 520);
    if (farFromAvoid && spaced) break;
  }
  const power: PowerUp = { id: state.nextOrbId++, x, y, kind: kind ?? pickPowerKind(rng), phase: rng() * Math.PI * 2 };
  state.powerUps.push(power);
  return power;
}

/** Head-vs-pick-up test; collected pick-ups are removed and their effect applied. */
export function collectPowerUps(state: GameState, snake: Snake): PowerUp[] {
  if (!snake.alive || state.powerUps.length === 0) return [];
  const reach = snake.radius * 1.16 + POWER_RADIUS + 6;
  const got: PowerUp[] = [];
  state.powerUps = state.powerUps.filter((p) => {
    const dx = p.x - snake.x;
    const dy = p.y - snake.y;
    if (dx * dx + dy * dy < reach * reach) {
      got.push(p);
      return false;
    }
    return true;
  });
  for (const p of got) {
    const now = state.timeMs;
    // picking the same kind again extends the timer instead of resetting it
    const base = Math.max(now, snake.powers[p.kind]);
    snake.powers[p.kind] = Math.min(now + POWER_INFO[p.kind].durationMs * 1.6, base + POWER_INFO[p.kind].durationMs);
  }
  return got;
}

export function activePowers(snake: Pick<Snake, "powers">, now: number): { kind: PowerKind; leftMs: number; totalMs: number }[] {
  return POWER_KINDS.filter((k) => powerActive(snake, k, now)).map((kind) => ({
    kind,
    leftMs: snake.powers[kind] - now,
    totalMs: POWER_INFO[kind].durationMs,
  }));
}
