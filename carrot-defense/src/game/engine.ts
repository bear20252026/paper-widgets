import { MAX_LIVES, STEP } from "./constants";
import { addEffect, pushEvent, updateEffects } from "./effects";
import { ENEMY_DEFS, applyFreeze, applyHeals, applySlow, createEnemy, damageEnemy, isActive, isTargetable, updateEnemy } from "./enemy";
import { samplePath } from "./path";
import { applyAffix } from "./endless";
import { earn } from "./economy";
import { createObstacle, damageObstacle } from "./obstacle";
import { createPathFromCells, rasterizeCells, straightPath } from "./path";
import { updateProjectiles, updateTower } from "./tower";
import { getLevelStats } from "./towerDefs";
import { callNextWave as callWave, createWaveState, updateWaves } from "./wave";
import type { CellType, GameState, LevelDef } from "./types";
import {
  BOON_EVERY_WAVES,
  MAX_BOONS,
  addEnergy,
  chooseRelic,
  energyPerKill,
  hasRelic,
  relicKillBonus,
  rollBoons,
  canCastSkill,
} from "./relics";

/** 由关卡数据创建初始游戏状态。 */
export function createGameState(level: LevelDef, seed = 20240601): GameState {
  const paths = level.waypoints.map((wp) => createPathFromCells(wp));
  const grid: CellType[][] = Array.from({ length: level.rows }, () =>
    Array.from({ length: level.cols }, () => "ground" as CellType),
  );
  for (const wp of level.waypoints) {
    for (const [c, r] of rasterizeCells(wp)) grid[r][c] = "path";
  }
  const maxLives = level.maxLives ?? MAX_LIVES;
  const state: GameState = {
    level,
    time: 0,
    status: "playing",
    rating: 0,
    gold: level.startGold,
    lives: maxLives,
    maxLives,
    grid,
    paths,
    airPaths: paths.map(straightPath),
    enemies: [],
    towers: [],
    projectiles: [],
    obstacles: [],
    hazards: [],
    effects: [],
    waves: createWaveState(level.waves.length, level.firstWaveDelay),
    focusObstacleId: null,
    events: [],
    stats: { kills: 0, leaked: 0, goldEarned: 0, goldSpent: 0 },
    nextId: 1,
    rngState: seed,
    relics: [],
    boonOffer: null,
    boonsTaken: 0,
    clearedWaves: 0,
    energy: 0,
    skillCasts: 0,
  };
  for (const o of level.obstacles) state.obstacles.push(createObstacle(state.nextId++, o));
  return state;
}

/** 评价:满血 = 金萝卜(3),≥6 血 = 银萝卜(2),其余 = 铜萝卜(1);失败 = 0。 */
export function computeRating(state: GameState): 0 | 1 | 2 | 3 {
  if (state.status !== "won") return 0;
  if (state.lives >= state.maxLives) return 3;
  if (state.lives >= 6) return 2;
  return 1;
}

/** 玩家点击"下一波"。成功返回奖励金币,否则 null。 */
export function callNextWave(state: GameState): number | null {
  if (state.status !== "playing") return null;
  const bonus = callWave(state.waves, state.level.waves, state.paths.length);
  if (bonus === null) return null;
  earn(state, bonus);
  pushEvent(state, { type: "waveStart", wave: state.waves.waveNumber });
  if (bonus > 0) {
    const p = state.paths[0].points[0];
    addEffect(state, { kind: "text", x: p.x + 0.5, y: p.y - 0.4, ttl: 1.1, color: "#ffe082", text: `+${bonus}` });
  }
  return bonus;
}

/** 锁定/取消锁定障碍物:炮塔会优先攻击被锁定的障碍物。 */
export function setFocusObstacle(state: GameState, id: number | null): void {
  state.focusObstacleId = id !== null && state.obstacles.some((o) => o.id === id) ? id : null;
}

/** 结算本帧产生的击杀与清障(奖励只发一次)。 */
function settle(state: GameState): void {
  for (const e of state.enemies) {
    if (e.state === "dying" && !e.rewardPaid) {
      e.rewardPaid = true;
      earn(state, e.reward + relicKillBonus(state));
      addEnergy(state, energyPerKill());
      state.stats.kills += 1;
      pushEvent(state, { type: "kill", enemy: e.kind });
      addEffect(state, { kind: "text", x: e.x, y: e.y - 0.3, ttl: 0.9, color: "#ffe082", text: `+${e.reward}` });
      if (e.splitInto && e.splitCount > 0) {
        for (let i = 0; i < e.splitCount; i++) {
          const child = createEnemy(state.nextId++, e.splitInto, e.path, e.pathIndex, 1);
          child.state = "moving";
          child.distance = Math.max(0, e.distance - 0.15 * i);
          const p = samplePath(child.path, child.distance);
          child.x = p.x;
          child.y = p.y;
          child.angle = p.angle;
          state.enemies.push(child);
        }
      }
      // 熔岩怪:死亡留下火场(游戏状态,不是渲染特效),持续灼烧路过的敌人
      if (e.kind === "lava") {
        state.hazards.push({
          id: state.nextId++, x: e.x, y: e.y, radius: 1.0, ttl: 5, dps: 8, color: "#ff5252",
        });
      }
    }
  }
  if (state.obstacles.some((o) => o.hp <= 0)) {
    const remaining: GameState["obstacles"] = [];
    for (const o of state.obstacles) {
      if (o.hp <= 0) {
        earn(state, o.reward);
        pushEvent(state, { type: "obstacleCleared", reward: o.reward });
        addEffect(state, { kind: "text", x: o.x, y: o.y - 0.3, ttl: 1.1, color: "#fff176", text: `清障 +${o.reward}` });
        addEffect(state, { kind: "ring", x: o.x, y: o.y, radius: 0.7, ttl: 0.35, color: "#ffe082" });
        if (state.focusObstacleId === o.id) state.focusObstacleId = null;
      } else {
        remaining.push(o);
      }
    }
    state.obstacles = remaining;
  }
}

/** 推进一个逻辑步长。只调用纯逻辑函数,不依赖 DOM / Canvas / 真实时间。 */
export function step(state: GameState, dt: number = STEP): void {
  if (state.status !== "playing") return;
  // 遗物三选一时冻结战场:玩家必须先做决定,保证公平与可复现
  if (state.boonOffer !== null) return;
  state.time += dt;

  // 1. 波次与出怪
  const tick = updateWaves(state.waves, state.level.waves, state.paths.length, dt);
  if (tick.started) pushEvent(state, { type: "waveStart", wave: state.waves.waveNumber });

  // 波次结算:利息、充能、以及每 4 波一次的遗物三选一
  if (
    (state.waves.phase === "prep" || state.waves.phase === "finished") &&
    state.waves.waveNumber > state.clearedWaves
  ) {
    const gained = state.waves.waveNumber - state.clearedWaves;
    state.clearedWaves = state.waves.waveNumber;
    addEnergy(state, 20 * gained);
    if (hasRelic(state, "interest")) {
      const bonus = Math.floor(state.gold * 0.08 * gained);
      if (bonus > 0) {
        earn(state, bonus);
        const p = state.paths[0].points[state.paths[0].points.length - 1];
        addEffect(state, { kind: "text", x: p.x, y: p.y - 0.6, ttl: 1.1, color: "#80cbc4", text: `利息 +${bonus}` });
      }
    }
    const endless = state.level.id === 999;
    const every = endless ? 3 : BOON_EVERY_WAVES;
    const cap = endless ? 8 : MAX_BOONS;
    if (
      state.waves.phase === "prep" &&
      state.clearedWaves % every === 0 &&
      state.boonsTaken < cap
    ) {
      state.boonOffer = rollBoons(state);
      pushEvent(state, { type: "boon" });
    }
  }
  const waveAffix = state.level.waves[state.waves.waveNumber - 1]?.affix;
  for (const s of tick.spawns) {
    // 飞行怪走"出怪口 → 萝卜"的直线,地面怪沿路径点行走
    const path = ENEMY_DEFS[s.kind].flying ? state.airPaths[s.pathIndex] : state.paths[s.pathIndex];
    const enemy = createEnemy(state.nextId++, s.kind, path, s.pathIndex, s.hpScale);
    applyAffix(enemy, waveAffix);
    state.enemies.push(enemy);
  }

  // 2. 敌人移动 / 治疗 / 漏过
  if (hasRelic(state, "chill")) {
    for (const e of state.enemies) {
      if (isTargetable(e)) applySlow(e, 0.88, 0.2);
    }
  }
  applyHeals(state.enemies, dt);
  for (const e of state.enemies) {
    if (updateEnemy(e, dt) === "leaked") {
      state.lives = Math.max(0, state.lives - e.leakDamage);
      state.stats.leaked += 1;
      pushEvent(state, { type: "leak", damage: e.leakDamage });
    }
    // 陷阱塔:敌人踏上塔格时触发爆炸(免疫计时写在实体上,保证可暂停/可复现)
    if (e.trapImmune > 0) e.trapImmune = Math.max(0, e.trapImmune - dt);
    const trap = state.towers.find(
      (t) =>
        t.kind === "trap" &&
        t.cooldown <= 0 &&
        Math.hypot(t.x - e.x, t.y - e.y) <= 0.6,
    );
    if (trap && e.trapImmune <= 0) {
      e.trapImmune = 0.4;
      const stats = getLevelStats(trap.kind, trap.level);
      for (const ee of state.enemies) {
        if (Math.hypot(ee.x - trap.x, ee.y - trap.y) <= stats.range) {
          damageEnemy(ee, stats.damage);
        }
      }
      trap.cooldown = stats.cooldown;
      addEffect(state, {
        kind: "ring", x: trap.x, y: trap.y, radius: stats.range, ttl: 0.4,
        color: "#ff5252",
      });
    }
  }

  // 2.5. 特殊敌人 AI
  // 术士:每 4 秒召唤虫群
  for (const w of state.enemies) {
    if (w.kind !== "warlock" || !isTargetable(w)) continue;
    w.summonTimer += dt;
    if (w.summonTimer >= 4) {
      w.summonTimer -= 4;
      for (let i = 0; i < 2; i++) {
        const s = state.nextId++;
        const sw = createEnemy(s, "swarmling", w.path, w.pathIndex, 1);
        sw.state = "moving";
        sw.distance = Math.min(w.distance + 0.3, w.path.length);
        const p = samplePath(sw.path, sw.distance);
        sw.x = p.x; sw.y = p.y; sw.angle = p.angle;
        state.enemies.push(sw);
      }
    }
  }
  // 末日使者:每秒给周围敌人加血
  for (const h of state.enemies) {
    if (h.kind !== "herald" || !isTargetable(h)) continue;
    h.auraTimer += dt;
    if (h.auraTimer >= 1) {
      h.auraTimer -= 1;
      for (const ee of state.enemies) {
        if (ee.id === h.id || !isTargetable(ee)) continue;
        if (Math.hypot(ee.x - h.x, ee.y - h.y) <= 1.6) {
          ee.hp = Math.min(ee.maxHp, ee.hp + 4);
        }
      }
    }
  }

  // 3. 炮塔与弹道
  for (const t of state.towers) updateTower(state, t, dt);
  updateProjectiles(state, dt);

  // 4. 结算、清理、特效
  settle(state);
  state.enemies = state.enemies.filter((e) => e.state !== "dead" && e.state !== "leaked");
  updateEffects(state, dt);

  // 地面危险区:持续灼烧,自行过期
  if (state.hazards.length > 0) {
    for (const h of state.hazards) h.ttl -= dt;
    for (const h of state.hazards) {
      if (h.ttl <= 0) continue;
      for (const e of state.enemies) {
        if (!isTargetable(e)) continue;
        if (Math.hypot(e.x - h.x, e.y - h.y) <= h.radius) damageEnemy(e, h.dps * dt);
      }
    }
    state.hazards = state.hazards.filter((h) => h.ttl > 0);
  }

  // 5. 胜负判定(失败优先)
  if (state.lives <= 0) {
    state.status = "lost";
    pushEvent(state, { type: "lose" });
  } else if (state.waves.phase === "finished" && !state.enemies.some(isActive)) {
    state.status = "won";
    state.rating = computeRating(state);
    pushEvent(state, { type: "win" });
  }
}

/** 选择遗物(UI 调用)。 */
export function pickRelic(state: GameState, id: GameState["relics"][number]): boolean {
  const ok = chooseRelic(state, id);
  if (ok) pushEvent(state, { type: "boon" });
  return ok;
}

/**
 * 萝卜冲击波:冻结全场普通敌人,并造成固定伤害;免疫冻结的 Boss 改为重度减速。
 * 需要满能量,清空能量后计数。纯逻辑,可被测试与机器人调用。
 */
export function activateCarrotSkill(state: GameState): boolean {
  if (!canCastSkill(state)) return false;
  state.energy = 0;
  state.skillCasts += 1;
  for (const e of state.enemies) {
    if (!isTargetable(e)) continue;
    if (!e.freezeImmune) applyFreeze(e, 2.5);
    else applySlow(e, 0.5, 2.5);
    damageEnemy(e, 40);
  }
  for (const o of state.obstacles) damageObstacle(o, 80);
  for (const path of state.paths) {
    const p = path.points[path.points.length - 1];
    addEffect(state, { kind: "ring", x: p.x, y: p.y, radius: 2.6, ttl: 0.6, color: "#80deea" });
    addEffect(state, { kind: "text", x: p.x, y: p.y - 0.7, ttl: 1.2, color: "#e0f7fa", text: "萝卜冲击波!" });
  }
  pushEvent(state, { type: "skill" });
  return true;
}

/**
 * 固定时间步长驱动器:累加真实帧间隔,按 1/60 秒的整步推进逻辑。
 * 渲染帧率与逻辑频率解耦;speed 为游戏倍速。
 */
export class FixedStepRunner {
  private acc = 0;
  constructor(
    private readonly stepSize: number = STEP,
    private readonly maxStepsPerFrame = 12,
  ) {}

  advance(state: GameState, frameSeconds: number, speed = 1): number {
    this.acc += Math.min(Math.max(frameSeconds, 0), 0.25) * speed;
    let steps = 0;
    while (this.acc >= this.stepSize - 1e-9 && steps < this.maxStepsPerFrame) {
      step(state, this.stepSize);
      this.acc -= this.stepSize;
      steps++;
    }
    if (steps >= this.maxStepsPerFrame) this.acc = 0; // 丢弃积压,避免死亡螺旋
    return steps;
  }

  reset(): void {
    this.acc = 0;
  }
}
