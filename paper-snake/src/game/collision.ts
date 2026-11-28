import type { Orb, Snake, Vec2 } from "./types";

export const WALL_TOLERANCE = 96;
export const SOFT_WALL_MARGIN = 150;
/**
 * Self-collision is disabled: a snake may freely cross or coil over its own
 * body (head touching its own tail is harmless). Only other snakes kill you.
 */
export const SELF_COLLISION_ENABLED = false;
/** Collision hitboxes are slightly smaller than painted shapes for fairness. */
export const HITBOX_FORGIVENESS = 0.8;

export interface BodyNode {
  x: number;
  y: number;
  r: number;
  snakeId: number;
  index: number;
}

export interface HeadCollision {
  snakeId: number;
  index: number;
  x: number;
  y: number;
}

/**
 * Spatial hash (grid buckets) used for body / orb broad-phase queries.
 * Inspired by adylevy/slither-vs-bots services/SpatialHash.ts, reimplemented
 * for this engine with deterministic numeric keys.
 */
export class SpatialHash<T extends { x: number; y: number }> {
  readonly cellSize: number;
  private cells = new Map<number, T[]>();

  constructor(cellSize = 120) {
    this.cellSize = Math.max(8, cellSize);
  }

  private key(cx: number, cy: number): number {
    return (cx + 4096) * 8192 + (cy + 4096);
  }

  clear(): void {
    this.cells.clear();
  }

  get size(): number {
    let n = 0;
    for (const bucket of this.cells.values()) n += bucket.length;
    return n;
  }

  insert(item: T): void {
    const cx = Math.floor(item.x / this.cellSize);
    const cy = Math.floor(item.y / this.cellSize);
    const k = this.key(cx, cy);
    const bucket = this.cells.get(k);
    if (bucket) bucket.push(item);
    else this.cells.set(k, [item]);
  }

  insertAll(items: T[]): void {
    for (const item of items) this.insert(item);
  }

  queryRect(x: number, y: number, w: number, h: number): T[] {
    const minX = Math.floor(x / this.cellSize);
    const minY = Math.floor(y / this.cellSize);
    const maxX = Math.floor((x + w) / this.cellSize);
    const maxY = Math.floor((y + h) / this.cellSize);
    const out: T[] = [];
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (bucket) for (const item of bucket) out.push(item);
      }
    }
    return out;
  }

  queryCircle(x: number, y: number, radius: number): T[] {
    return this.queryRect(x - radius, y - radius, radius * 2, radius * 2);
  }
}

export function buildBodyHash(snakes: Snake[], cellSize = 128): SpatialHash<BodyNode> {
  const hash = new SpatialHash<BodyNode>(cellSize);
  for (const snake of snakes) {
    if (!snake.alive) continue;
    for (let i = 0; i < snake.points.length; i++) {
      const p = snake.points[i];
      hash.insert({ x: p.x, y: p.y, r: snake.radius, snakeId: snake.id, index: i });
    }
  }
  return hash;
}

export function buildOrbHash(orbs: Orb[], cellSize = 160): SpatialHash<Orb> {
  const hash = new SpatialHash<Orb>(cellSize);
  hash.insertAll(orbs);
  return hash;
}

/**
 * Head vs any OTHER snake's body segment.
 * Own body is always ignored, so coiling onto your own tail is safe.
 * Heads are not immune: another snake's head node is part of its body too.
 */
export function headHitsBody(
  head: Vec2,
  headRadius: number,
  selfId: number,
  hash: SpatialHash<BodyNode>
): HeadCollision | null {
  const reach = headRadius + 26;
  const candidates = hash.queryCircle(head.x, head.y, reach);
  let best: HeadCollision | null = null;
  let bestDist = Infinity;
  for (const node of candidates) {
    if (node.snakeId === selfId) continue;
    const dx = node.x - head.x;
    const dy = node.y - head.y;
    const dist = Math.hypot(dx, dy);
    const limit = (headRadius + node.r) * HITBOX_FORGIVENESS;
    if (dist < limit && dist < bestDist) {
      bestDist = dist;
      best = { snakeId: node.snakeId, index: node.index, x: node.x, y: node.y };
    }
  }
  return best;
}

export type WallStatus = "safe" | "graze" | "dead";

/** Walls are forgiving: you may graze / overshoot briefly, only deep overshoot kills. */
export function wallStatus(
  pos: Vec2,
  size: { width: number; height: number },
  tolerance = WALL_TOLERANCE
): WallStatus {
  const depth = Math.max(0, -pos.x, pos.x - size.width, -pos.y, pos.y - size.height);
  if (depth === 0) return "safe";
  return depth <= tolerance ? "graze" : "dead";
}

/** Strong inward assist when close to the border, so touching is survivable. */
export function wallAssistAngle(
  pos: Vec2,
  size: { width: number; height: number },
  margin = SOFT_WALL_MARGIN
): number | null {
  let ax = 0;
  let ay = 0;
  if (pos.x < margin) ax += 1;
  if (pos.x > size.width - margin) ax -= 1;
  if (pos.y < margin) ay += 1;
  if (pos.y > size.height - margin) ay -= 1;
  if (ax === 0 && ay === 0) return null;
  return Math.atan2(ay, ax);
}

export function normalizeAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

export function angleDelta(from: number, to: number): number {
  return normalizeAngle(to - from);
}

export function pointSegDist(p: Vec2, a: Vec2, b: Vec2): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 <= 0.00001 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const dx = p.x - (a.x + vx * t);
  const dy = p.y - (a.y + vy * t);
  return Math.hypot(dx, dy);
}
