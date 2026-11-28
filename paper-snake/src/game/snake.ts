import type { AiProfile, Snake, SkinId, Vec2, WorldConfig } from "./types";
import {
  angleDelta,
  normalizeAngle,
  wallAssistAngle,
  type SpatialHash,
  type BodyNode,
} from "./collision";
import {
  BOOST_MIN_LENGTH,
  followSmoothingFor,
  headRadiusFor,
  radiusForLength,
  segmentCountForLength,
  segmentSpacing,
  turnRateFor,
} from "./speed";

export interface CreateSnakeOptions {
  id: number;
  name: string;
  x: number;
  y: number;
  angle: number;
  skin: SkinId;
  isPlayer: boolean;
  aiProfile?: AiProfile | null;
  length?: number;
  now?: number;
}

export function createSnake(opts: CreateSnakeOptions): Snake {
  const length = opts.length ?? 42;
  const radius = radiusForLength(length);
  const points: Vec2[] = [];
  const count = segmentCountForLength(length);
  const spacing = segmentSpacing(radius);
  for (let i = 0; i < count; i++) {
    points.push({
      x: opts.x - Math.cos(opts.angle) * spacing * i,
      y: opts.y - Math.sin(opts.angle) * spacing * i,
    });
  }
  return {
    id: opts.id,
    name: opts.name,
    isPlayer: opts.isPlayer,
    aiProfile: opts.aiProfile ?? null,
    skin: opts.skin,
    alive: true,
    length,
    x: opts.x,
    y: opts.y,
    angle: opts.angle,
    targetAngle: opts.angle,
    radius,
    speed: 0,
    boosting: false,
    wantBoost: false,
    points,
    kills: 0,
    streak: 0,
    bestStreak: 0,
    lastKillAt: -99999,
    lastEatAt: -99999,
    deathReason: null,
    killerId: null,
    bornAt: opts.now ?? 0,
    aiThinkCooldown: 0,
    boostDropAccum: 0,
    graze: false,
    spawnGrace: 1000,
    powers: { magnet: 0, shield: 0, turbo: 0, double: 0 },
  };
}

export function syncBodyToLength(snake: Snake): void {
  const desired = segmentCountForLength(snake.length);
  const pts = snake.points;
  while (pts.length < desired) {
    const tail = pts[pts.length - 1] ?? { x: snake.x, y: snake.y };
    const before = pts[pts.length - 2] ?? { x: tail.x - 1, y: tail.y };
    const dx = tail.x - before.x;
    const dy = tail.y - before.y;
    const len = Math.hypot(dx, dy) || 1;
    const spacing = segmentSpacing(snake.radius);
    pts.push({ x: tail.x + (dx / len) * spacing, y: tail.y + (dy / len) * spacing });
  }
  while (pts.length > desired && pts.length > 4) pts.pop();
}

export function growSnake(snake: Snake, amount: number): void {
  snake.length = Math.min(2400, snake.length + Math.max(0, amount));
  snake.radius = radiusForLength(snake.length);
  syncBodyToLength(snake);
}

export function shrinkSnake(snake: Snake, amount: number): void {
  snake.length = Math.max(0, snake.length - Math.max(0, amount));
  snake.radius = radiusForLength(snake.length);
  syncBodyToLength(snake);
}

/** Advance one fixed logic step. No rendering knowledge lives here. */
export function moveSnake(
  snake: Snake,
  dtMs: number,
  speed: number,
  world: Pick<WorldConfig, "width" | "height" | "softWallMargin">
): void {
  const dt = dtMs / 1000;
  const assist = wallAssistAngle({ x: snake.x, y: snake.y }, world, world.softWallMargin);
  let wanted = snake.targetAngle;
  if (assist !== null) {
    // blend towards the interior — wall touch is a warning, not instant death
    const delta = angleDelta(wanted, assist);
    wanted = normalizeAngle(wanted + delta * 0.55);
  }
  const turn = turnRateFor(snake.isPlayer, snake.length, speed) * dt;
  const delta = angleDelta(snake.angle, wanted);
  snake.angle = normalizeAngle(snake.angle + Math.max(-turn, Math.min(turn, delta)));
  snake.speed = speed;
  snake.x += Math.cos(snake.angle) * speed * dt;
  snake.y += Math.sin(snake.angle) * speed * dt;

  const spacing = segmentSpacing(snake.radius);
  snake.points[0].x = snake.x;
  snake.points[0].y = snake.y;
  for (let i = 1; i < snake.points.length; i++) {
    const prev = snake.points[i - 1];
    const cur = snake.points[i];
    const dx = prev.x - cur.x;
    const dy = prev.y - cur.y;
    const dist = Math.hypot(dx, dy);
    if (dist > spacing) {
      const t = (dist - spacing) / dist;
      cur.x += dx * t;
      cur.y += dy * t;
    }
  }

  // Spine relaxation: pull each interior node a little toward the midpoint of
  // its neighbours. This rounds off corners (no jagged long-snake turns) and is
  // scaled by length so giants trail smoothly rather than snapping like a rope.
  const relax = 0.34 * followSmoothingFor(snake.length);
  const pts = snake.points;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const c = pts[i + 1];
      const mx = (a.x + c.x) * 0.5;
      const my = (a.y + c.y) * 0.5;
      b.x += (mx - b.x) * relax;
      b.y += (my - b.y) * relax;
    }
  }

  snake.radius = radiusForLength(snake.length);
  syncBodyToLength(snake);
  snake.spawnGrace = Math.max(0, snake.spawnGrace - dtMs);
}

/** Distance from a point to the snake's body (used by the AI sensor). */
export function distanceToSnake(
  point: Vec2,
  snake: Snake,
  hash: SpatialHash<BodyNode>,
  includeSelf = false
): number {
  const nodes = hash.queryCircle(point.x, point.y, 260);
  let best = Infinity;
  for (const node of nodes) {
    if (!includeSelf && node.snakeId === snake.id) continue;
    const d = Math.hypot(node.x - point.x, node.y - point.y);
    if (d < best) best = d;
  }
  return best;
}

export function boostAllowed(snake: Snake): boolean {
  return snake.alive && snake.length > BOOST_MIN_LENGTH;
}

export function headRadius(snake: Snake): number {
  return headRadiusFor(snake.radius);
}
