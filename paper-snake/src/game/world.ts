import type { GameMode, GameState, Orb, OrbTier, Snake, WorldConfig } from "./types";
import type { Rng } from "./rng";
import { createRng, randInt, randRange } from "./rng";
import { DEFAULT_SKIN, getSkin } from "./skins";
import { START_LENGTH } from "./speed";

export const WORLD_CONFIG: WorldConfig = {
  width: 4400,
  height: 4400,
  wallTolerance: 96,
  softWallMargin: 150,
  orbTarget: 560,
};

/** Tier worth: corpse light > large light > small light. */
export const ORB_VALUES: Record<OrbTier, number> = {
  small: 2,
  large: 6,
  corpse: 10,
};

export const ORB_RADIUS: Record<OrbTier, number> = {
  small: 4.8,
  large: 8.6,
  corpse: 9.8,
};

export const SMALL_ORB_COLORS = [
  "#ffcf5c",
  "#ff8c66",
  "#52d6b8",
  "#84a9ff",
  "#f794c0",
  "#a9e359",
  "#ffc178",
];

export const CORPSE_COLORS = [
  "#ff7e5f",
  "#47d7b8",
  "#a78bfa",
  "#ffc44d",
  "#6ec3ff",
  "#f78fb8",
];

let orbFallbackId = 1;

export interface CreateOrbOptions {
  x: number;
  y: number;
  tier: OrbTier;
  id?: number;
  value?: number;
  color?: string;
  ttl?: number;
  rng?: Rng;
  snakeColor?: string;
}

export function createOrb(opts: CreateOrbOptions): Orb {
  const id = opts.id ?? orbFallbackId++;
  const rng = opts.rng;
  const jitter = () => (rng ? randRange(rng, -0.22, 0.22) : 0);
  const value = opts.value ?? ORB_VALUES[opts.tier];
  const color = opts.color ?? defaultColor(opts.tier, id);
  return {
    id,
    x: opts.x,
    y: opts.y,
    tier: opts.tier,
    value,
    radius: ORB_RADIUS[opts.tier],
    color,
    phase: rng ? rng() * Math.PI * 2 : (id % 100) / 16,
    vx: jitter(),
    vy: jitter(),
    ttl: opts.ttl ?? 0,
    snakeColor: opts.snakeColor,
  };
}

function defaultColor(tier: OrbTier, id: number): string {
  if (tier === "large") return id % 3 === 0 ? "#ffe066" : id % 3 === 1 ? "#ffb563" : "#76e5c8";
  if (tier === "corpse") return CORPSE_COLORS[id % CORPSE_COLORS.length];
  return SMALL_ORB_COLORS[id % SMALL_ORB_COLORS.length];
}

export function createGameState(opts: {
  seed: number;
  mode: GameMode;
  width?: number;
  height?: number;
}): GameState {
  return {
    seed: opts.seed >>> 0,
    mode: opts.mode,
    status: "playing",
    timeMs: 0,
    limitMs: opts.mode === "timed" ? 180_000 : 0,
    width: opts.width ?? WORLD_CONFIG.width,
    height: opts.height ?? WORLD_CONFIG.height,
    snakes: [],
    orbs: [],
    playerId: -1,
    kingId: -1,
    nextOrbId: 1,
    nextSnakeId: 1,
    nextFeedId: 1,
    killFeed: [],
    hotspots: [],
    botRespawnTimer: 0,
    powerUps: [],
    powerTimer: 0,
    deathAt: 0,
    endReason: null,
  };
}

export function spawnAmbientOrbs(state: GameState, rng: Rng, count: number): Orb[] {
  const made: Orb[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rng();
    const tier: OrbTier = roll > 0.87 ? "large" : "small";
    const margin = 110;
    const orb = createOrb({
      x: randRange(rng, margin, state.width - margin),
      y: randRange(rng, margin, state.height - margin),
      tier,
      id: state.nextOrbId++,
      rng,
    });
    made.push(orb);
  }
  state.orbs.push(...made);
  return made;
}

/** Top the field back up while keeping the RNG stream deterministic. */
export function maintainOrbs(state: GameState, rng: Rng): void {
  const missing = WORLD_CONFIG.orbTarget - state.orbs.length;
  if (missing > 0) spawnAmbientOrbs(state, rng, Math.min(missing, 24));
}

/**
 * Authentic Snake-IO death explosion:
 * Orbs spawn along the ENTIRE winding body contour of the fallen snake
 * (from head to tail), tinted with its skin palette so rivals can follow and
 * devour the glowing corpse ribbon. Tier worth: corpse > large > small.
 */
export function dropDeathOrbs(state: GameState, rng: Rng, snake: Snake): Orb[] {
  const count = Math.round(Math.max(10, Math.min(82, snake.length * 0.86)));
  const made: Orb[] = [];
  const skinPalette = getSkin(snake.skin).palette;
  const pts = snake.points.length > 0 ? snake.points : [{ x: snake.x, y: snake.y }];

  const tierFor = (i: number): OrbTier => {
    const roll = (i * 37) % 100;
    if (roll < 34) return "corpse";
    if (roll < 68) return "large";
    return "small";
  };

  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0 : i / (count - 1);
    const exactIdx = t * (pts.length - 1);
    const idx0 = Math.floor(exactIdx);
    const idx1 = Math.min(pts.length - 1, idx0 + 1);
    const frac = exactIdx - idx0;
    const bx = pts[idx0].x + (pts[idx1].x - pts[idx0].x) * frac;
    const by = pts[idx0].y + (pts[idx1].y - pts[idx0].y) * frac;

    const angle = randRange(rng, 0, Math.PI * 2);
    const scatter = randRange(rng, 22, 95);
    const tier = tierFor(i);
    const skinTint = skinPalette[i % 2 === 0 ? 0 : 2];
    const color =
      tier === "corpse"
        ? i % 3 === 0
          ? CORPSE_COLORS[(i + Math.floor(rng() * CORPSE_COLORS.length)) % CORPSE_COLORS.length]
          : skinTint
        : tier === "large"
          ? skinTint
          : undefined;

    const orb = createOrb({
      x: Math.max(24, Math.min(state.width - 24, bx + randRange(rng, -snake.radius * 0.75, snake.radius * 0.75))),
      y: Math.max(24, Math.min(state.height - 24, by + randRange(rng, -snake.radius * 0.75, snake.radius * 0.75))),
      tier,
      id: state.nextOrbId++,
      rng,
      color,
      ttl: 45_000,
      snakeColor: skinPalette[0],
    });
    orb.vx = Math.cos(angle) * scatter * 0.34;
    orb.vy = Math.sin(angle) * scatter * 0.34;
    made.push(orb);
  }
  state.orbs.push(...made);
  return made;
}

/** Light points shed by a boosting snake, dropped behind the tail. */
export function dropBoostOrbs(
  state: GameState,
  rng: Rng,
  snake: Snake,
  count: number,
  value = 2
): Orb[] {
  if (count <= 0 || snake.points.length === 0) return [];
  const made: Orb[] = [];
  const skin = getSkin(snake.skin);
  const tailIndex = Math.max(0, Math.min(snake.points.length - 1, snake.points.length - 2));
  for (let i = 0; i < count; i++) {
    const p = snake.points[tailIndex];
    made.push(
      createOrb({
        x: p.x + randRange(rng, -snake.radius * 0.7, snake.radius * 0.7),
        y: p.y + randRange(rng, -snake.radius * 0.7, snake.radius * 0.7),
        tier: "small",
        value,
        id: state.nextOrbId++,
        rng,
        color: skin.palette[i % 2 === 0 ? 2 : 0],
        ttl: 28_000,
      })
    );
  }
  state.orbs.push(...made);
  return made;
}

/** Gentle magnetic suction toward nearby snake mouths for tactile commercial IO feel. */
export function pullNearbyOrbs(state: GameState, dtMs: number): void {
  const dt = dtMs / 1000;
  const orbs = state.orbs;
  const nOrbs = orbs.length;
  for (const snake of state.snakes) {
    if (!snake.alive) continue;
    const sx = snake.x;
    const sy = snake.y;
    const magnet = snake.powers && snake.powers.magnet > state.timeMs;
    const pullRadius = magnet ? snake.radius * 2.4 + 190 : snake.radius * 1.16 + 48;
    const pullR2 = pullRadius * pullRadius;
    for (let i = 0; i < nOrbs; i++) {
      const orb = orbs[i];
      const dx = sx - orb.x;
      if (dx > pullRadius || dx < -pullRadius) continue;
      const dy = sy - orb.y;
      if (dy > pullRadius || dy < -pullRadius) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1 && d2 < pullR2) {
        const d = Math.sqrt(d2);
        const strength = ((magnet ? 0.35 + (1 - d / pullRadius) : 1 - d / pullRadius) * (magnet ? 620 : 420) * dt) / d;
        orb.x += dx * strength;
        orb.y += dy * strength;
      }
    }
  }
}

export function updateOrbs(state: GameState, dtMs: number): void {
  // Ambient orbs are static: skip the rebuild entirely unless something moves/expires.
  let active = false;
  for (const orb of state.orbs) {
    if (orb.ttl > 0 || orb.vx !== 0 || orb.vy !== 0) {
      active = true;
      break;
    }
  }
  if (!active) return;
  const dt = dtMs / 1000;
  const keep: Orb[] = [];
  for (const orb of state.orbs) {
    if (orb.ttl > 0) {
      orb.ttl -= dtMs;
      if (orb.ttl <= 0) continue;
    }
    if (orb.vx !== 0 || orb.vy !== 0) {
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.vx *= 1 / (1 + 4.2 * dt);
      orb.vy *= 1 / (1 + 4.2 * dt);
      if (Math.abs(orb.vx) < 0.4) orb.vx = 0;
      if (Math.abs(orb.vy) < 0.4) orb.vy = 0;
      orb.x = Math.max(14, Math.min(state.width - 14, orb.x));
      orb.y = Math.max(14, Math.min(state.height - 14, orb.y));
    }
    keep.push(orb);
  }
  state.orbs = keep;
}

export function removeOrb(state: GameState, orbId: number): boolean {
  const idx = state.orbs.findIndex((o) => o.id === orbId);
  if (idx === -1) return false;
  state.orbs.splice(idx, 1);
  return true;
}

export interface EatResult {
  eaten: Orb[];
  gained: number;
}

/** Head-vs-orb eating with value tiers. */
export function eatOrbs(state: GameState, snake: Snake): EatResult {
  if (!snake.alive) return { eaten: [], gained: 0 };
  const headR = snake.radius * 1.16;
  const reach = headR + 15;
  // Cheap AABB + circle early-out: most fixed steps eat nothing, so don't allocate a new array.
  let touching = false;
  const sx = snake.x;
  const sy = snake.y;
  for (let i = 0; i < state.orbs.length; i++) {
    const orb = state.orbs[i];
    const reachForOrb = reach + orb.radius;
    const dx = orb.x - sx;
    if (dx > reachForOrb || dx < -reachForOrb) continue;
    const dy = orb.y - sy;
    if (dy > reachForOrb || dy < -reachForOrb) continue;
    if (dx * dx + dy * dy < reachForOrb * reachForOrb) {
      touching = true;
      break;
    }
  }
  if (!touching) return { eaten: [], gained: 0 };
  const eaten: Orb[] = [];
  let gained = 0;
  const doubled = !!snake.powers && snake.powers.double > state.timeMs;
  state.orbs = state.orbs.filter((orb) => {
    const dx = orb.x - snake.x;
    const dy = orb.y - snake.y;
    const d = Math.hypot(dx, dy);
    if (d < reach + orb.radius) {
      eaten.push(orb);
      gained += orb.value * (doubled ? 2 : 1);
      return false;
    }
    return true;
  });
  return { eaten, gained };
}

export function randomSpawnPosition(
  state: GameState,
  rng: Rng,
  avoid?: { x: number; y: number; radius: number }
): { x: number; y: number } {
  for (let attempt = 0; attempt < 24; attempt++) {
    const x = randRange(rng, 320, state.width - 320);
    const y = randRange(rng, 320, state.height - 320);
    if (!avoid) return { x, y };
    if (Math.hypot(x - avoid.x, y - avoid.y) > avoid.radius) return { x, y };
  }
  return { x: state.width / 2, y: state.height / 2 };
}

export function initialStateOrbs(state: GameState, rng: Rng): Orb[] {
  return spawnAmbientOrbs(state, rng, WORLD_CONFIG.orbTarget);
}

export function defaultSkin(): typeof DEFAULT_SKIN {
  return DEFAULT_SKIN;
}

export function lengthTier(length: number): OrbTier {
  if (length >= 300) return "corpse";
  if (length >= 80) return "large";
  return "small";
}

export function randomAiLength(rng: Rng): number {
  const roll = rng();
  if (roll > 0.82) return randInt(rng, 190, 420);
  if (roll > 0.5) return randInt(rng, 80, 180);
  return randInt(rng, 32, 78);
}

export { createRng, START_LENGTH };

/**
 * Public objective: a drifting "energy tide" — a ring cluster of rich orbs at a
 * random spot on the map. Everyone sees it on the radar, so it becomes a
 * contested feast rather than a quiet solo farm.
 */
export function spawnEnergyTide(
  state: GameState,
  rng: Rng,
  avoid?: { x: number; y: number; radius: number }
): { x: number; y: number; count: number } {
  const center = randomSpawnPosition(state, rng, avoid);
  const count = 34 + Math.floor(rng() * 14);
  const colors = ["#ffd24a", "#ffb347", "#ffe98a", "#7ef2d4", "#ff9f6e"];
  for (let i = 0; i < count; i++) {
    const ring = i % 3;
    const radius = 40 + ring * 52 + randRange(rng, -14, 14);
    const angle = randRange(rng, 0, Math.PI * 2);
    const tier: OrbTier = i % 11 === 0 ? "corpse" : i % 3 === 0 ? "large" : "small";
    const orb = createOrb({
      x: Math.max(40, Math.min(state.width - 40, center.x + Math.cos(angle) * radius)),
      y: Math.max(40, Math.min(state.height - 40, center.y + Math.sin(angle) * radius)),
      tier,
      id: state.nextOrbId++,
      rng,
      color: colors[i % colors.length],
      ttl: 42_000,
    });
    orb.vx = Math.cos(angle) * randRange(rng, 6, 26);
    orb.vy = Math.sin(angle) * randRange(rng, 6, 26);
    state.orbs.push(orb);
  }
  return { x: center.x, y: center.y, count };
}

/** Extra golden loot line for the fallen boss python. */
export function dropBossLoot(state: GameState, rng: Rng, x: number, y: number): Orb[] {
  const made: Orb[] = [];
  const colors = ["#ffd24a", "#ffe98a", "#ffb347"];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    made.push(
      createOrb({
        x: Math.max(30, Math.min(state.width - 30, x + Math.cos(a) * (70 + (i % 4) * 22))),
        y: Math.max(30, Math.min(state.height - 30, y + Math.sin(a) * (70 + (i % 4) * 22))),
        tier: i % 3 === 0 ? "corpse" : "large",
        id: state.nextOrbId++,
        rng,
        color: colors[i % colors.length],
        ttl: 60_000,
      })
    );
  }
  state.orbs.push(...made);
  return made;
}
