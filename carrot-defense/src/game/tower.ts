import { OBSTACLE_RADIUS } from "./constants";
import { addEffect, pushEvent } from "./effects";
import { applyFreeze, applyPoison, applySlow, damageEnemy, isTargetable } from "./enemy";
import { damageObstacle } from "./obstacle";
import { nextRandom } from "./rng";
import { TOWER_DEFS, getLevelStats, type TowerLevelStats } from "./towerDefs";
import { relicDamageMult, relicRangeBonus, relicRateMult } from "./relics";
import type {
  Enemy,
  GameState,
  Obstacle,
  Projectile,
  TargetRef,
  Tower,
  TowerKind,
  Vec2,
} from "./types";

export { TOWER_DEFS } from "./towerDefs";

const BEAM_COLOR: Partial<Record<TowerKind, string>> = {
  laser: "#ff5252",
  railgun: "#e1f5fe",
  flame: "#ff9100",
  fan: "#b3e5fc",
};

export function createTower(id: number, kind: TowerKind, col: number, row: number): Tower {
  return {
    id,
    kind,
    level: 1,
    priority: "first",
    col,
    row,
    x: col + 0.5,
    y: row + 0.5,
    cooldown: 0,
    angle: -Math.PI / 2,
    invested: getLevelStats(kind, 1).cost,
    target: null,
    hasteUntil: 0,
  };
}

export function towerStats(t: Tower): TowerLevelStats {
  return getLevelStats(t.kind, t.level);
}

/**
 * 伤害光环:方尖碑会给射程内的其他炮塔加伤害。
 * 多座方尖碑的加成相加(0.25 + 0.45 = +70%)。
 */
export function damageMultiplier(state: GameState, tower: Tower): number {
  let bonus = 0;
  for (const o of state.towers) {
    if (o.id === tower.id) continue;
    const s = getLevelStats(o.kind, o.level);
    if (!s.buffDamage) continue;
    if (Math.hypot(o.x - tower.x, o.y - tower.y) <= s.range) bonus += s.buffDamage;
  }
  return (1 + bonus) * relicDamageMult(state);
}

/** 实际射程:基础射程 + 遗物加成。 */
export function towerRange(state: GameState, tower: Tower): number {
  return towerStats(tower).range + relicRangeBonus(state);
}

/** 实际冷却:基础冷却 ÷ 遗物攻速。 */
export function towerCooldown(state: GameState, tower: Tower): number {
  return towerStats(tower).cooldown / relicRateMult(state);
}

/** 某座塔是否正被光环增幅(用于 UI 高亮)。 */
export function isBuffed(state: GameState, tower: Tower): boolean {
  return damageMultiplier(state, tower) > 1.001;
}

export function canTargetEnemy(kind: TowerKind, e: Enemy): boolean {
  if (!isTargetable(e)) return false;
  const def = TOWER_DEFS[kind];
  if (def.airOnly) return e.flying;
  return !e.flying || def.canHitAir;
}

export function findEnemy(state: GameState, id: number): Enemy | undefined {
  return state.enemies.find((e) => e.id === id);
}

export function findObstacle(state: GameState, id: number): Obstacle | undefined {
  return state.obstacles.find((o) => o.id === id && o.hp > 0);
}

export function distToSegment(
  px: number, py: number, ax: number, ay: number, bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.min(Math.max(t, 0), 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function targetPosition(state: GameState, ref: TargetRef): Vec2 | null {
  if (ref.type === "enemy") {
    const e = findEnemy(state, ref.id);
    return e && isTargetable(e) ? { x: e.x, y: e.y } : null;
  }
  const o = findObstacle(state, ref.id);
  return o ? { x: o.x, y: o.y } : null;
}

function makeProjectile(
  state: GameState, tower: Tower, stats: TowerLevelStats, target: TargetRef, pos: Vec2,
): Projectile {
  const def = TOWER_DEFS[tower.kind];
  return {
    id: state.nextId++,
    kind: tower.kind,
    x: tower.x,
    y: tower.y,
    tx: pos.x,
    ty: pos.y,
    speed: stats.projectileSpeed ?? 8,
    damage: stats.damage,
    target,
    splash: stats.splash ?? 0,
    slowFactor: stats.slowFactor ?? 1,
    slowDuration: stats.slowDuration ?? 0,
    freezeChance: stats.freezeChance ?? 0,
    freezeDuration: stats.freezeDuration ?? 0,
    poisonDps: stats.poisonDps ?? 0,
    poisonDuration: stats.poisonDuration ?? 0,
    canHitAir: def.canHitAir,
  };
}

export function selectTarget(state: GameState, tower: Tower): TargetRef | null {
  const def = TOWER_DEFS[tower.kind];
  if (def.attack === "idle") return null;
  const range = towerRange(state, tower);

  if (!def.airOnly && state.focusObstacleId !== null) {
    const o = findObstacle(state, state.focusObstacleId);
    if (o && Math.hypot(o.x - tower.x, o.y - tower.y) <= range) {
      return { type: "obstacle", id: o.id };
    }
  }

  if (tower.target?.type === "enemy") {
    const e = findEnemy(state, tower.target.id);
    if (
      e &&
      canTargetEnemy(tower.kind, e) &&
      Math.hypot(e.x - tower.x, e.y - tower.y) <= range
    ) {
      return tower.target;
    }
  }

  // 按优先级给射程内的敌人打分,取分数最高者
  let best: Enemy | null = null;
  let bestScore = -Infinity;
  for (const e of state.enemies) {
    if (!canTargetEnemy(tower.kind, e)) continue;
    const dist = Math.hypot(e.x - tower.x, e.y - tower.y);
    if (dist > range) continue;
    let score: number;
    switch (tower.priority) {
      case "strongest":
        score = e.hp;
        break;
      case "closest":
        score = -dist;
        break;
      default:
        score = e.path.length > 0 ? e.distance / e.path.length : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best ? { type: "enemy", id: best.id } : null;
}

export const PRIORITY_INFO: Record<
  NonNullable<Tower["priority"]>,
  { label: string; icon: string; hint: string }
> = {
  first: { label: "最前", icon: "🏁", hint: "优先打最接近萝卜的" },
  strongest: { label: "最壮", icon: "💪", hint: "优先打血量最多的" },
  closest: { label: "最近", icon: "📍", hint: "优先打离塔最近的" },
};

export function cyclePriority(tower: Tower): Tower["priority"] {
  const order: Array<Tower["priority"]> = ["first", "strongest", "closest"];
  const i = order.indexOf(tower.priority);
  return order[(i + 1) % order.length];
}

export function updateTower(state: GameState, tower: Tower, dt: number): void {
  const def = TOWER_DEFS[tower.kind];

  // 治疗塔光环:被覆盖时额外加快 50% 冷却
  const haste = tower.hasteUntil > state.time ? 1.5 : 1;
  tower.cooldown -= dt * haste;

  // 光环塔:不开火,持续对范围生效
  if (def.attack === "aura") {
    const s = towerStats(tower);
    tower.target = null;
    if (s.auraSlow) {
      for (const e of state.enemies) {
        if (!canTargetEnemy(tower.kind, e)) continue;
        if (Math.hypot(e.x - tower.x, e.y - tower.y) <= s.range) {
          applySlow(e, s.auraSlow, 0.25);
        }
      }
    }
    // 磁力塔:把射程内敌人沿路径拖慢(不直接改坐标,避免与路径插值打架)
    if (tower.kind === "magnet") {
      for (const e of state.enemies) {
        if (!canTargetEnemy(tower.kind, e)) continue;
        if (Math.hypot(e.x - tower.x, e.y - tower.y) <= s.range) {
          applySlow(e, 0.45, 0.25);
        }
      }
    }
    // 治疗塔:给周围友军炮塔加临时攻速 buff(用逻辑时间,暂停时不会流逝)
    if (tower.kind === "medic") {
      for (const o of state.towers) {
        if (o.id === tower.id) continue;
        if (Math.hypot(o.x - tower.x, o.y - tower.y) <= s.range) {
          o.hasteUntil = Math.max(o.hasteUntil, state.time + 0.5);
        }
      }
    }
    return;
  }

  if (def.attack === "idle") {
    tower.target = null;
    if (tower.cooldown <= 0) {
      const gold = towerStats(tower).goldPerTick ?? 0;
      if (gold > 0) {
        state.gold += gold;
        state.stats.goldEarned += gold;
        addEffect(state, {
          kind: "text", x: tower.x, y: tower.y - 0.4, ttl: 0.9, color: "#ffe082", text: `+${gold}`,
        });
        addEffect(state, {
          kind: "pulse", x: tower.x, y: tower.y, radius: 0.7, ttl: 0.28, color: "#ffd54f",
        });
      }
      tower.cooldown += towerCooldown(state, tower);
      if (tower.cooldown < 0) tower.cooldown = 0;
    }
    return;
  }

  const target = selectTarget(state, tower);
  tower.target = target;
  if (target) {
    const pos = targetPosition(state, target);
    if (pos) tower.angle = Math.atan2(pos.y - tower.y, pos.x - tower.x);
  }
  if (tower.cooldown <= 0) {
    if (target) {
      fireTower(state, tower, target);
      tower.cooldown += towerCooldown(state, tower);
    }
    if (tower.cooldown < 0) tower.cooldown = 0;
  }
}

export function fireTower(state: GameState, tower: Tower, target: TargetRef): void {
  const def = TOWER_DEFS[tower.kind];
  const base = towerStats(tower);
  const pos = targetPosition(state, target);
  if (!pos) return;
  tower.angle = Math.atan2(pos.y - tower.y, pos.x - tower.x);

  // 方尖碑光环:把加成折进本次开火的伤害
  const mult = damageMultiplier(state, tower);
  const stats: TowerLevelStats = {
    ...base,
    damage: Math.round(base.damage * mult),
    range: base.range + relicRangeBonus(state),
  };

  if (def.attack === "projectile") {
    const shots = Math.max(1, stats.shots ?? 1);
    // 霰弹枪:多弹散射
    if (tower.kind === "shotgun") {
      const baseAngle = Math.atan2(pos.y - tower.y, pos.x - tower.x);
      const spread = 0.5;
      for (let i = 0; i < shots; i++) {
        const angle = baseAngle + (i - (shots - 1) / 2) * spread;
        const p = makeProjectile(state, tower, stats, target, pos);
        p.tx = tower.x + Math.cos(angle) * stats.range;
        p.ty = tower.y + Math.sin(angle) * stats.range;
        state.projectiles.push(p);
      }
    } else {
      state.projectiles.push(makeProjectile(state, tower, stats, target, pos));
      if (shots > 1) {
        const extras = extraTargets(state, tower, target, shots - 1, stats.range);
        for (const ref of extras) {
          const p = targetPosition(state, ref);
          if (p) state.projectiles.push(makeProjectile(state, tower, stats, ref, p));
        }
      }
    }
  } else if (def.attack === "beam") {
    const ex = tower.x + Math.cos(tower.angle) * stats.range;
    const ey = tower.y + Math.sin(tower.angle) * stats.range;
    const half = (stats.beamWidth ?? 0.4) / 2;
    for (const e of state.enemies) {
      if (!canTargetEnemy(tower.kind, e)) continue;
      if (distToSegment(e.x, e.y, tower.x, tower.y, ex, ey) <= half + e.radius) {
        damageEnemy(e, stats.damage);
        // 喷火龙:射线命中同时点燃
        if (stats.poisonDuration && stats.poisonDps) {
          applyPoison(e, stats.poisonDps, stats.poisonDuration);
        }
      }
    }
    for (const o of state.obstacles) {
      if (o.hp <= 0) continue;
      if (distToSegment(o.x, o.y, tower.x, tower.y, ex, ey) <= half + OBSTACLE_RADIUS) {
        damageObstacle(o, stats.damage);
      }
    }
    addEffect(state, {
      kind: "beam", x: tower.x, y: tower.y, x2: ex, y2: ey,
      radius: stats.beamWidth ?? 0.4, ttl: 0.14,
      color: BEAM_COLOR[tower.kind] ?? "#b3e5fc",
    });
  } else if (def.attack === "chain") {
    fireChain(state, tower, target, stats);
  } else {
    for (const e of state.enemies) {
      if (!canTargetEnemy(tower.kind, e)) continue;
      if (Math.hypot(e.x - tower.x, e.y - tower.y) <= stats.range) {
        damageEnemy(e, stats.damage);
        // 龙卷风这类脉冲塔自带减速
        if (stats.slowDuration && stats.slowFactor) {
          applySlow(e, stats.slowFactor, stats.slowDuration);
        }
      }
    }
    for (const o of state.obstacles) {
      if (o.hp <= 0) continue;
      if (Math.hypot(o.x - tower.x, o.y - tower.y) <= stats.range) {
        damageObstacle(o, stats.damage);
      }
    }
    addEffect(state, {
      kind: "pulse", x: tower.x, y: tower.y, radius: stats.range,
      ttl: 0.28, color: tower.kind === "spike" ? "#ef9a9a" : "#ffd54f",
    });
  }
  pushEvent(state, { type: "shoot", tower: tower.kind });
}

function extraTargets(
  state: GameState, tower: Tower, primary: TargetRef, need: number, range: number,
): TargetRef[] {
  const out: TargetRef[] = [];
  const taken = new Set<number>(primary.type === "enemy" ? [primary.id] : []);
  const ranked: Array<{ id: number; progress: number }> = [];
  for (const e of state.enemies) {
    if (taken.has(e.id) || !canTargetEnemy(tower.kind, e)) continue;
    if (Math.hypot(e.x - tower.x, e.y - tower.y) > range) continue;
    ranked.push({ id: e.id, progress: e.path.length > 0 ? e.distance / e.path.length : 1 });
  }
  ranked.sort((a, b) => b.progress - a.progress);
  for (const r of ranked) {
    if (out.length >= need) break;
    out.push({ type: "enemy", id: r.id });
  }
  return out;
}

function fireChain(state: GameState, tower: Tower, start: TargetRef, stats: TowerLevelStats): void {
  const jumps = Math.max(1, stats.chain ?? 3);
  const jumpRange = 1.7;
  const hit = new Set<number>();
  let cursor: { x: number; y: number } = { x: tower.x, y: tower.y };
  let next: TargetRef | null = start;
  let hops = 0;
  while (next && hops < jumps) {
    const pos = targetPosition(state, next);
    if (!pos) break;
    addEffect(state, {
      kind: "beam", x: cursor.x, y: cursor.y, x2: pos.x, y2: pos.y,
      radius: 0.22, ttl: 0.16, color: "#80d8ff",
    });
    if (next.type === "enemy") {
      const e = findEnemy(state, next.id);
      if (e && isTargetable(e)) {
        damageEnemy(e, stats.damage);
        hit.add(e.id);
      }
    } else {
      const o = findObstacle(state, next.id);
      if (o) damageObstacle(o, stats.damage);
    }
    cursor = pos;
    hops += 1;
    let best: Enemy | null = null;
    let bestD = jumpRange;
    for (const e of state.enemies) {
      if (hit.has(e.id) || !canTargetEnemy(tower.kind, e)) continue;
      const d = Math.hypot(e.x - cursor.x, e.y - cursor.y);
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    next = best ? { type: "enemy", id: best.id } : null;
  }
}

export function updateProjectiles(state: GameState, dt: number): void {
  let write = 0;
  for (const p of state.projectiles) {
    const pos = targetPosition(state, p.target);
    if (pos) {
      p.tx = pos.x;
      p.ty = pos.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const stepLen = p.speed * dt;
    if (d <= stepLen) {
      p.x = p.tx;
      p.y = p.ty;
      projectileImpact(state, p);
    } else {
      p.x += (dx / d) * stepLen;
      p.y += (dy / d) * stepLen;
      state.projectiles[write++] = p;
    }
  }
  state.projectiles.length = write;
}

function applyHitEffects(e: Enemy, p: Projectile, state: GameState): void {
  if (p.slowDuration > 0) applySlow(e, p.slowFactor, p.slowDuration);
  if (p.poisonDuration > 0) applyPoison(e, p.poisonDps, p.poisonDuration);
  if (p.freezeChance > 0 && isTargetable(e) && nextRandom(state) < p.freezeChance) {
    if (applyFreeze(e, p.freezeDuration)) {
      addEffect(state, { kind: "ring", x: e.x, y: e.y, radius: 0.5, ttl: 0.3, color: "#e1f5fe" });
    }
  }
}

function projectileImpact(state: GameState, p: Projectile): void {
  if (p.splash > 0) {
    for (const e of state.enemies) {
      if (!isTargetable(e) || (e.flying && !p.canHitAir)) continue;
      if (p.kind === "rocket" && !e.flying) continue;
      if (Math.hypot(e.x - p.tx, e.y - p.ty) <= p.splash) {
        damageEnemy(e, p.damage);
        applyHitEffects(e, p, state);
      }
    }
    if (p.target.type === "obstacle") {
      const o = findObstacle(state, p.target.id);
      if (o) damageObstacle(o, p.damage);
    }
    addEffect(state, {
      kind: "ring", x: p.tx, y: p.ty, radius: p.splash, ttl: 0.3,
      color: p.poisonDuration > 0 ? "#9ccc65" : "#b39ddb",
    });
    return;
  }

  if (p.target.type === "enemy") {
    const e = findEnemy(state, p.target.id);
    if (!e || !isTargetable(e)) return;
    damageEnemy(e, p.damage);
    // 音波塔:命中后将敌人击退
    if (p.kind === "sonic") {
      const knock = 0.7;
      const dx = e.x - p.tx;
      const dy = e.y - p.ty;
      const d = Math.hypot(dx, dy);
      if (d > 0) {
        e.x += (dx / d) * knock;
        e.y += (dy / d) * knock;
      }
    }
    if (isTargetable(e)) applyHitEffects(e, p, state);
  } else {
    const o = findObstacle(state, p.target.id);
    if (o) damageObstacle(o, p.damage);
  }
}
