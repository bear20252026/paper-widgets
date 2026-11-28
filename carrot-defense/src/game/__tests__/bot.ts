import { STEP } from "../constants";
import { buildTower, towerAt, upgradeTower } from "../economy";
import { activateCarrotSkill, pickRelic, setFocusObstacle, step } from "../engine";
import { samplePath } from "../path";
import { TOWER_DEFS, buildCost, nextUpgradeCost } from "../towerDefs";
import type { GameState, TowerKind } from "../types";

/** 一个朴素的自动玩家:按覆盖率选格子、按固定顺序建塔、均衡升级。仅用于验证关卡可通关。 */
export interface BotOptions {
  buyOrder?: TowerKind[];
  maxTowers?: number;
  clearObstacles?: boolean;
}

const DEFAULT_ORDER: TowerKind[] = [
  "bottle", "arrow", "bottle", "spike", "crossbow",
  "tesla", "bottle", "sniper", "obelisk", "railgun",
  "rocket", "prism", "laser", "frostpillar", "cannon", "railgun",
  "obelisk", "sniper", "prism", "mortar",
];

/** 覆盖度打分:越靠近萝卜(路径后段)的覆盖越值钱,飞行直线按 0.4 权重。 */
function coverage(state: GameState, col: number, row: number, range: number): number {
  const cx = col + 0.5;
  const cy = row + 0.5;
  let score = 0;
  for (const path of state.paths) {
    for (let d = 0; d <= path.length; d += 0.25) {
      const p = samplePath(path, d);
      if (Math.hypot(p.x - cx, p.y - cy) <= range) score += 0.5 + 0.5 * p.progress;
    }
  }
  for (const path of state.airPaths) {
    for (let d = 0; d <= path.length; d += 0.25) {
      const p = samplePath(path, d);
      if (Math.hypot(p.x - cx, p.y - cy) <= range) score += 0.4;
    }
  }
  return score;
}

/** 光环塔按「能覆盖多少已建攻击塔」选址,而不是按路径覆盖。 */
function bestAuraCell(state: GameState, kind: TowerKind): [number, number] | null {
  const range = TOWER_DEFS[kind].levels[0].range;
  let best: [number, number] | null = null;
  let bestScore = 0;
  for (let r = 0; r < state.level.rows; r++) {
    for (let c = 0; c < state.level.cols; c++) {
      if (state.grid[r][c] !== "ground") continue;
      if (towerAt(state, c, r)) continue;
      if (state.obstacles.some((o) => o.col === c && o.row === r)) continue;
      const cx = c + 0.5, cy = r + 0.5;
      let score = 0;
      for (const t of state.towers) {
        if (TOWER_DEFS[t.kind].attack === "idle" || TOWER_DEFS[t.kind].attack === "aura") continue;
        if (Math.hypot(t.x - cx, t.y - cy) <= range) score += 1;
      }
      if (score > bestScore) { bestScore = score; best = [c, r]; }
    }
  }
  return bestScore >= 2 ? best : null;
}

function bestCell(state: GameState, kind: TowerKind): [number, number] | null {
  const range = TOWER_DEFS[kind].levels[0].range;
  let best: [number, number] | null = null;
  let bestScore = 0;
  for (let r = 0; r < state.level.rows; r++) {
    for (let c = 0; c < state.level.cols; c++) {
      if (state.grid[r][c] !== "ground") continue;
      if (towerAt(state, c, r)) continue;
      if (state.obstacles.some((o) => o.col === c && o.row === r)) continue;
      const s = coverage(state, c, r, range);
      if (s > bestScore) {
        bestScore = s;
        best = [c, r];
      }
    }
  }
  return best;
}

export function botAct(state: GameState, opts: BotOptions = {}): void {
  // 遗物三选一:机器人总选第一张(顺序由种子决定,因此可复现)
  if (state.boonOffer && state.boonOffer.length > 0) {
    pickRelic(state, state.boonOffer[0]);
  }
  // 能量满就放大招,模拟一个会用技能的玩家
  activateCarrotSkill(state);

  const order = opts.buyOrder ?? DEFAULT_ORDER;
  const maxTowers = opts.maxTowers ?? Math.min(28, Math.max(12, Math.round((state.level.cols * state.level.rows) / 6)));

  if (opts.clearObstacles !== false) {
    // 附近没有敌人时才去清障,避免分散火力
    const quiet = (o: { x: number; y: number }) =>
      !state.enemies.some((e) => Math.hypot(e.x - o.x, e.y - o.y) < 4);
    const reachable = state.obstacles.find(
      (o) => quiet(o) && state.towers.some((t) => Math.hypot(t.x - o.x, t.y - o.y) <= 3.0),
    );
    if (reachable) {
      if (state.focusObstacleId !== reachable.id) setFocusObstacle(state, reachable.id);
    } else if (state.focusObstacleId !== null) {
      setFocusObstacle(state, null);
    }
  }

  for (let guard = 0; guard < 6; guard++) {
    const n = state.towers.length;
    const avg = n === 0 ? 0 : state.towers.reduce((a, t) => a + t.level, 0) / n;
    const upgradable = state.towers
      .filter((t) => t.level < 3)
      .sort((a, b) => a.level - b.level || a.id - b.id);
    const shouldBuild =
      n < 3 || (n < 7 && avg >= 1.6) || (n < 11 && avg >= 2.3) || (n < maxTowers && upgradable.length === 0);

    const tryBuild = (kind: TowerKind): "ok" | "poor" | "none" => {
      if (state.gold < buildCost(kind)) return "poor";
      const isAura = TOWER_DEFS[kind].attack === "aura";
      const cell = isAura ? (bestAuraCell(state, kind) ?? bestCell(state, kind)) : bestCell(state, kind);
      if (!cell) return "none";
      return buildTower(state, kind, cell[0], cell[1]).ok ? "ok" : "none";
    };
    const tryUpgrade = (): "ok" | "poor" | "none" => {
      const t = upgradable[0];
      if (!t) return "none";
      const cost = nextUpgradeCost(t.kind, t.level);
      if (cost === null) return "none";
      if (state.gold < cost) return "poor";
      return upgradeTower(state, t.id).ok ? "ok" : "none";
    };

    let result: "ok" | "poor" | "none";
    if ((shouldBuild || upgradable.length === 0) && n < maxTowers) {
      result = tryBuild(order[n % order.length]);
    } else if (upgradable.length > 0) {
      result = tryUpgrade();
    } else {
      return;
    }

    if (result === "ok") {
      patience.waited = 0;
      continue;
    }
    if (result === "poor") {
      // 攒钱太久就先花在便宜的选项上(升级,或者补一座瓶子炮),避免浪费时间
      patience.waited += 1;
      if (patience.waited > 24) {
        const fb = tryUpgrade() === "ok" || (n < maxTowers && tryBuild("bottle") === "ok");
        if (fb) patience.waited = 0;
      }
    }
    return;
  }
}

const patience = { waited: 0 };

export interface BotResult {
  status: GameState["status"];
  lives: number;
  wave: number;
  totalWaves: number;
  gold: number;
  towers: number;
  seconds: number;
  rating: number;
}

export function runBot(
  state: GameState, opts: BotOptions = { maxTowers: 16 }, maxSeconds = 6000,
): BotResult {
  let tick = 0;
  patience.waited = 0;
  while (state.status === "playing" && state.time < maxSeconds) {
    if (tick % 15 === 0) botAct(state, opts);
    step(state, STEP);
    tick++;
  }
  return {
    status: state.status,
    lives: state.lives,
    wave: state.waves.waveNumber,
    totalWaves: state.waves.totalWaves,
    gold: state.gold,
    towers: state.towers.length,
    seconds: Math.round(state.time),
    rating: state.rating,
  };
}
