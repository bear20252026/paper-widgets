import { STEP } from "../constants";
import { buildTower } from "../economy";
import { createGameState, step } from "../engine";
import { ENEMY_DEFS, createEnemy } from "../enemy";
import { samplePath } from "../path";
import { updateProjectiles } from "../tower";
import type { Enemy, EnemyKind, GameState, LevelDef, Tower, TowerKind } from "../types";

/** 测试用小地图:10×5,单条直线路径 (0,2) → (9,2),长度 9。 */
export function makeLevel(overrides: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 99,
    name: "test",
    desc: "",
    difficulty: "简单",
    tip: "",
    chapter: 1,
    cols: 10,
    rows: 5,
    waypoints: [[[0, 2], [9, 2]]],
    obstacles: [],
    startGold: 500,
    firstWaveDelay: 999,
    waves: [{ groups: [{ kind: "grunt", count: 1, interval: 1 }] }],
    ...overrides,
  };
}

export function makeState(overrides: Partial<LevelDef> = {}): GameState {
  return createGameState(makeLevel(overrides));
}

/** 直接在路径上放置一个已出生(可被攻击)的敌人。 */
export function spawnEnemy(
  state: GameState, kind: EnemyKind, distance = 0, hpScale = 1, pathIndex = 0,
): Enemy {
  const path = ENEMY_DEFS[kind].flying ? state.airPaths[pathIndex] : state.paths[pathIndex];
  const e = createEnemy(state.nextId++, kind, path, pathIndex, hpScale);
  e.state = "moving";
  e.distance = distance;
  const p = samplePath(path, distance);
  e.x = p.x;
  e.y = p.y;
  e.angle = p.angle;
  state.enemies.push(e);
  return e;
}

/** 建造炮塔,失败则抛错(用于测试准备阶段)。 */
export function place(state: GameState, kind: TowerKind, col: number, row: number): Tower {
  const res = buildTower(state, kind, col, row);
  if (!res.ok || !res.tower) throw new Error(`建造失败: ${res.ok ? "?" : res.reason}`);
  return res.tower;
}

export function runSteps(state: GameState, seconds: number): void {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) step(state, STEP);
}

/** 让所有在飞的弹道落地。 */
export function flushProjectiles(state: GameState): void {
  for (let i = 0; i < 1200 && state.projectiles.length > 0; i++) {
    updateProjectiles(state, STEP);
  }
}
