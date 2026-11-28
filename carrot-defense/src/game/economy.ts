import { MAX_TOWER_LEVEL } from "./constants";
import { createTower } from "./tower";
import { buildCost, nextUpgradeCost, sellValueOf } from "./towerDefs";
import type { GameState, Tower, TowerKind } from "./types";
import { relicUpgradeMult } from "./relics";

export type FailReason =
  | "game_over"
  | "out_of_bounds"
  | "not_buildable"
  | "obstacle"
  | "occupied"
  | "insufficient_gold"
  | "max_level"
  | "no_tower";

export type ActionResult =
  | { ok: true; cost?: number; refund?: number; tower?: Tower }
  | { ok: false; reason: FailReason };

const fail = (reason: FailReason): ActionResult => ({ ok: false, reason });

/** 获得金币(击杀、清障、提前开波)。 */
export function earn(state: GameState, amount: number): void {
  if (amount <= 0) return;
  state.gold += amount;
  state.stats.goldEarned += amount;
}

function spend(state: GameState, amount: number): void {
  state.gold -= amount;
  state.stats.goldSpent += amount;
}

export function canAfford(state: GameState, cost: number): boolean {
  return state.gold >= cost;
}

export function towerAt(state: GameState, col: number, row: number): Tower | undefined {
  return state.towers.find((t) => t.col === col && t.row === row);
}

/** 该格是否为空的可建造地面(不考虑金币):在地图内、非路径、无障碍物、无炮塔。 */
export function isCellBuildable(state: GameState, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= state.level.cols || row >= state.level.rows) return false;
  if (state.grid[row][col] !== "ground") return false;
  if (state.obstacles.some((o) => o.col === col && o.row === row && o.hp > 0)) return false;
  return !towerAt(state, col, row);
}

/** 校验能否在该格建造(只检查,不修改状态)。 */
export function checkBuild(
  state: GameState, kind: TowerKind, col: number, row: number,
): ActionResult {
  if (state.status !== "playing") return fail("game_over");
  if (col < 0 || row < 0 || col >= state.level.cols || row >= state.level.rows) {
    return fail("out_of_bounds");
  }
  if (state.grid[row][col] !== "ground") return fail("not_buildable");
  if (state.obstacles.some((o) => o.col === col && o.row === row && o.hp > 0)) {
    return fail("obstacle");
  }
  if (towerAt(state, col, row)) return fail("occupied");
  const cost = buildCost(kind);
  if (!canAfford(state, cost)) return fail("insufficient_gold");
  return { ok: true, cost };
}

export function buildTower(
  state: GameState, kind: TowerKind, col: number, row: number,
): ActionResult {
  const check = checkBuild(state, kind, col, row);
  if (!check.ok) return check;
  const cost = buildCost(kind);
  spend(state, cost);
  const tower = createTower(state.nextId++, kind, col, row);
  state.towers.push(tower);
  return { ok: true, cost, tower };
}

/** 升级到下一级所需金币;已满级为 null。 */
export function upgradeCostOf(tower: Tower): number | null {
  return nextUpgradeCost(tower.kind, tower.level);
}

export function upgradeTower(state: GameState, towerId: number): ActionResult {
  if (state.status !== "playing") return fail("game_over");
  const tower = state.towers.find((t) => t.id === towerId);
  if (!tower) return fail("no_tower");
  const base = upgradeCostOf(tower);
  const cost = base === null ? null : Math.max(1, Math.round(base * relicUpgradeMult(state)));
  if (cost === null || tower.level >= MAX_TOWER_LEVEL) return fail("max_level");
  if (!canAfford(state, cost)) return fail("insufficient_gold");
  spend(state, cost);
  tower.level += 1;
  tower.invested += cost;
  return { ok: true, cost, tower };
}

/** 出售返还 = 总投入 × 70%。 */
export function sellValue(tower: Tower): number {
  return sellValueOf(tower.invested);
}

export function sellTower(state: GameState, towerId: number): ActionResult {
  const idx = state.towers.findIndex((t) => t.id === towerId);
  if (idx < 0) return fail("no_tower");
  const tower = state.towers[idx];
  const refund = sellValue(tower);
  state.towers.splice(idx, 1);
  state.gold += refund; // 出售返还不计入"击杀收入"统计
  return { ok: true, refund, tower };
}
