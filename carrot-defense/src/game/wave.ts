import { EARLY_WAVE_BONUS_PER_SEC, MIN_SPAWN_GAP, PREP_TIME } from "./constants";
import type { SpawnEvent, WaveDef, WaveState } from "./types";

/**
 * 把一波的数据展开成"时间 → 敌人"的出怪表。
 * 每个 group 的第 i 个间隔 = max(MIN_SPAWN_GAP, interval × compress^i)。
 */
export function scheduleWave(
  def: WaveDef,
  pathCount: number,
  waveIndex = 0,
): SpawnEvent[] {
  const events: SpawnEvent[] = [];
  def.groups.forEach((g, gi) => {
    const compress = g.compress ?? 1;
    let t = g.delay ?? 0;
    for (let i = 0; i < g.count; i++) {
      const pathIndex =
        typeof g.pathIndex === "number"
          ? Math.min(Math.max(g.pathIndex, 0), pathCount - 1)
          : (i + waveIndex + gi) % pathCount;
      events.push({ time: t, kind: g.kind, pathIndex, hpScale: g.hpScale ?? 1 });
      t += Math.max(MIN_SPAWN_GAP, g.interval * Math.pow(compress, i));
    }
  });
  events.sort((a, b) => a.time - b.time);
  return events;
}

export function createWaveState(totalWaves: number, firstDelay: number): WaveState {
  return {
    phase: "prep",
    waveNumber: 0,
    totalWaves,
    prepTimer: firstDelay,
    spawnClock: 0,
    queue: [],
    queueIndex: 0,
  };
}

function startNextWave(ws: WaveState, defs: WaveDef[], pathCount: number): void {
  ws.waveNumber += 1;
  ws.queue = scheduleWave(defs[ws.waveNumber - 1], pathCount, ws.waveNumber - 1);
  ws.queueIndex = 0;
  ws.spawnClock = 0;
  ws.prepTimer = 0;
  ws.phase = "spawning";
}

export interface WaveTick {
  spawns: SpawnEvent[];
  started: boolean; // 本帧是否开始了新一波
}

/** 推进波次计时:准备倒计时 → 开波 → 按出怪表产出敌人 → 进入下一次准备/结束。 */
export function updateWaves(
  ws: WaveState, defs: WaveDef[], pathCount: number, dt: number,
): WaveTick {
  const result: WaveTick = { spawns: [], started: false };
  if (ws.phase === "finished") return result;

  if (ws.phase === "prep") {
    ws.prepTimer -= dt;
    if (ws.prepTimer > 0) return result;
    const overflow = -ws.prepTimer;
    startNextWave(ws, defs, pathCount);
    result.started = true;
    ws.spawnClock = overflow;
  } else {
    ws.spawnClock += dt;
  }

  while (ws.queueIndex < ws.queue.length && ws.queue[ws.queueIndex].time <= ws.spawnClock + 1e-9) {
    result.spawns.push(ws.queue[ws.queueIndex]);
    ws.queueIndex += 1;
  }

  if (ws.queueIndex >= ws.queue.length) {
    if (ws.waveNumber >= ws.totalWaves) {
      ws.phase = "finished";
    } else {
      ws.phase = "prep";
      ws.prepTimer = PREP_TIME;
    }
  }
  return result;
}

/** 提前开波的奖励金币(按剩余准备秒数向上取整)。 */
export function earlyWaveBonus(ws: WaveState): number {
  if (ws.phase !== "prep") return 0;
  return Math.ceil(Math.max(ws.prepTimer, 0)) * EARLY_WAVE_BONUS_PER_SEC;
}

/** 点击"下一波":仅在准备阶段有效,返回奖励金币;不可用返回 null。 */
export function callNextWave(
  ws: WaveState, defs: WaveDef[], pathCount: number,
): number | null {
  if (ws.phase !== "prep" || ws.waveNumber >= ws.totalWaves) return null;
  const bonus = earlyWaveBonus(ws);
  startNextWave(ws, defs, pathCount);
  return bonus;
}
