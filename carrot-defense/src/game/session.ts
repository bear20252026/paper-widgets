import { playSound } from "./audio";
import {
  type ActionResult,
  buildTower,
  sellTower,
  upgradeTower,
} from "./economy";
import {
  FixedStepRunner,
  activateCarrotSkill,
  callNextWave,
  createGameState,
  pickRelic,
  setFocusObstacle,
} from "./engine";
import type { RelicId } from "./types";
import { cyclePriority } from "./tower";
import { earlyWaveBonus } from "./wave";
import type { GameState, GameStatus, LevelDef, Tower, TowerKind, WavePhase } from "./types";

/** 提供给 UI(HUD)的只读快照,字段都是原始类型,便于浅比较。 */
export interface HudSnapshot {
  gold: number;
  lives: number;
  maxLives: number;
  wave: number;
  totalWaves: number;
  phase: WavePhase;
  prepSeconds: number;
  nextWaveBonus: number;
  status: GameStatus;
  rating: number;
  enemies: number;
  kills: number;
  energy: number;
  relicCount: number;
  relicIds: RelicId[];
  boonOpen: boolean;
}

/**
 * 游戏会话:UI 与纯逻辑之间唯一的门面。
 * 持有 GameState 与固定步长驱动器;把引擎事件转成音效;暴露玩家操作。
 */
export class GameSession {
  readonly state: GameState;
  private readonly runner = new FixedStepRunner();

  constructor(level: LevelDef) {
    this.state = createGameState(level);
  }

  /** 每个渲染帧调用一次;暂停时不要调用(或传 speed = 0)。 */
  update(frameSeconds: number, speed = 1): void {
    if (this.state.status === "playing" && speed > 0) {
      this.runner.advance(this.state, frameSeconds, speed);
    }
    this.flushEvents();
  }

  private flushEvents(): void {
    for (const ev of this.state.events) {
      switch (ev.type) {
        case "shoot": playSound("shoot", ev.tower); break;
        case "skill": playSound("upgrade"); break;
        case "boon": playSound("clear"); break;
        case "kill": playSound("kill"); break;
        case "leak": playSound("leak"); break;
        case "waveStart": playSound("wave"); break;
        case "obstacleCleared": playSound("clear"); break;
        case "win": playSound("win"); break;
        case "lose": playSound("lose"); break;
      }
    }
    this.state.events.length = 0;
  }

  build(kind: TowerKind, col: number, row: number): ActionResult {
    const r = buildTower(this.state, kind, col, row);
    playSound(r.ok ? "build" : "error");
    return r;
  }

  upgrade(towerId: number): ActionResult {
    const r = upgradeTower(this.state, towerId);
    playSound(r.ok ? "upgrade" : "error");
    return r;
  }

  sell(towerId: number): ActionResult {
    const r = sellTower(this.state, towerId);
    playSound(r.ok ? "sell" : "error");
    return r;
  }

  nextWave(): number | null {
    const bonus = callNextWave(this.state);
    if (bonus === null) playSound("error");
    return bonus;
  }

  /** 切换某座塔的攻击优先级,返回新值。 */
  cyclePriority(towerId: number): Tower["priority"] | null {
    const tower = this.state.towers.find((t) => t.id === towerId);
    if (!tower) return null;
    tower.priority = cyclePriority(tower);
    tower.target = null; // 立刻按新优先级重选
    playSound("click");
    return tower.priority;
  }

  /** 点击障碍物:锁定 / 取消锁定。返回是否处于锁定状态。 */
  toggleFocus(obstacleId: number): boolean {
    const same = this.state.focusObstacleId === obstacleId;
    setFocusObstacle(this.state, same ? null : obstacleId);
    playSound("click");
    return !same;
  }

  /** 选择遗物(三选一)。 */
  chooseBoon(id: RelicId): boolean {
    const ok = pickRelic(this.state, id);
    if (ok) playSound("upgrade");
    return ok;
  }

  /** 释放萝卜冲击波。 */
  castSkill(): boolean {
    return activateCarrotSkill(this.state);
  }

  snapshot(): HudSnapshot {
    const s = this.state;
    const inPrep = s.waves.phase === "prep" && s.status === "playing";
    return {
      gold: s.gold,
      lives: s.lives,
      maxLives: s.maxLives,
      wave: s.waves.waveNumber,
      totalWaves: s.waves.totalWaves,
      phase: s.waves.phase,
      prepSeconds: inPrep ? Math.ceil(s.waves.prepTimer) : 0,
      nextWaveBonus: inPrep ? earlyWaveBonus(s.waves) : 0,
      status: s.status,
      rating: s.rating,
      enemies: s.enemies.length,
      kills: s.stats.kills,
      energy: Math.floor(s.energy),
      relicCount: s.relics.length,
      relicIds: s.relics,
      boonOpen: s.boonOffer !== null,
    };
  }
}
