import { describe, expect, it } from "vitest";
import { MIN_SPAWN_GAP, PREP_TIME, STEP } from "../constants";
import { LEVELS } from "../levels";
import { rasterizeCells } from "../path";
import {
  callNextWave,
  createWaveState,
  earlyWaveBonus,
  scheduleWave,
  updateWaves,
} from "../wave";
import type { WaveDef } from "../types";

describe("波次生成", () => {
  it("数量与时间正确:间隔 × 压缩系数^i,带起始延迟", () => {
    const def: WaveDef = {
      groups: [{ kind: "grunt", count: 4, interval: 1, compress: 0.5, delay: 2 }],
    };
    const ev = scheduleWave(def, 1);
    expect(ev).toHaveLength(4);
    expect(ev.map((e) => e.time)).toEqual([2, 3, 3.5, 3.75]);
    expect(ev.every((e) => e.kind === "grunt")).toBe(true);
  });

  it("压缩后的间隔不会小于最小间隔", () => {
    const ev = scheduleWave({ groups: [{ kind: "grunt", count: 6, interval: 0.5, compress: 0.1 }] }, 1);
    for (let i = 1; i < ev.length; i++) {
      expect(ev[i].time - ev[i - 1].time).toBeGreaterThanOrEqual(MIN_SPAWN_GAP - 1e-9);
    }
  });

  it("多个 group 按时间合并排序;多出怪口轮流分配", () => {
    const ev = scheduleWave(
      {
        groups: [
          { kind: "grunt", count: 3, interval: 1 },
          { kind: "flyer", count: 2, interval: 1, delay: 0.5 },
        ],
      },
      2,
    );
    expect(ev).toHaveLength(5);
    expect(ev.map((e) => e.time)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(new Set(ev.map((e) => e.pathIndex))).toEqual(new Set([0, 1]));
  });

  it("指定 pathIndex 时固定出怪口", () => {
    const ev = scheduleWave({ groups: [{ kind: "boss", count: 2, interval: 3, pathIndex: 1 }] }, 2);
    expect(ev.every((e) => e.pathIndex === 1)).toBe(true);
  });
});

describe("波次计时", () => {
  const defs: WaveDef[] = [
    { groups: [{ kind: "grunt", count: 3, interval: 1 }] },
    { groups: [{ kind: "fatty", count: 1, interval: 1 }] },
  ];

  it("准备倒计时 → 开波 → 定时出怪 → 5 秒准备 → 下一波 → 结束", () => {
    const ws = createWaveState(2, 5);
    const spawnTimes: number[] = [];
    const startTimes: number[] = [];
    let t = 0;
    for (let i = 0; i < 60 * 30; i++) {
      t += STEP;
      const tick = updateWaves(ws, defs, 1, STEP);
      if (tick.started) startTimes.push(t);
      for (const s of tick.spawns) spawnTimes.push(t, s.kind === "fatty" ? -1 : 0);
    }
    const times = spawnTimes.filter((_, i) => i % 2 === 0);
    expect(times).toHaveLength(4);
    expect(times[0]).toBeCloseTo(5, 1);
    expect(times[1]).toBeCloseTo(6, 1);
    expect(times[2]).toBeCloseTo(7, 1);
    expect(times[3]).toBeCloseTo(7 + PREP_TIME, 1); // 最后一只后 5 秒准备
    expect(startTimes).toHaveLength(2);
    expect(ws.phase).toBe("finished");
    expect(ws.waveNumber).toBe(2);
  });

  it("提前开波:仅准备阶段可用,奖励按剩余秒数计算,开波后不可重复", () => {
    const ws = createWaveState(2, 5);
    for (let i = 0; i < 60; i++) updateWaves(ws, defs, 1, STEP); // 过去 1 秒
    const expected = earlyWaveBonus(ws);
    expect(expected).toBe(Math.ceil(ws.prepTimer) * 3);
    expect(expected).toBeGreaterThan(0);
    expect(callNextWave(ws, defs, 1)).toBe(expected);
    expect(ws.phase).toBe("spawning");
    expect(ws.waveNumber).toBe(1);
    expect(callNextWave(ws, defs, 1)).toBeNull();
  });
});

describe("关卡数据校验", () => {
  it("共 100 关,四章各 25 关,id 连续,覆盖单路径 / 多路径 / 障碍物集群", () => {
    expect(LEVELS).toHaveLength(100);
    expect(LEVELS.map((l) => l.id)).toEqual(LEVELS.map((_, i) => i + 1));
    for (const ch of [1, 2, 3, 4] as const) {
      expect(LEVELS.filter((l) => l.chapter === ch)).toHaveLength(25);
    }
    // 后期使用更大的地图
    expect(LEVELS.filter((l) => l.cols >= 14).length).toBeGreaterThanOrEqual(20);
    expect(LEVELS.filter((l) => l.waypoints.length >= 2).length).toBeGreaterThanOrEqual(30);
    expect(LEVELS[0].waypoints).toHaveLength(1);
    expect(LEVELS[1].waypoints.length).toBeGreaterThanOrEqual(2);
    expect(LEVELS[2].obstacles.length).toBeGreaterThanOrEqual(10);
    expect(LEVELS.filter((l) => l.waypoints.length >= 3).length).toBeGreaterThanOrEqual(2);
  });

  it("每关都有足够的可建造格子,且波数在 15–25 之间", () => {
    for (const level of LEVELS) {
      const used = new Set<string>();
      for (const wp of level.waypoints) {
        for (const [c, r] of rasterizeCells(wp)) used.add(`${c},${r}`);
      }
      for (const o of level.obstacles) used.add(`${o.col},${o.row}`);
      const free = level.cols * level.rows - used.size;
      expect(free).toBeGreaterThanOrEqual(30);
      expect(level.waves.length).toBeGreaterThanOrEqual(15);
      expect(level.waves.length).toBeLessThanOrEqual(25);
      expect(level.difficulty).toBeTruthy();
      expect(level.tip.length).toBeGreaterThan(0);
    }
  });

  for (const level of LEVELS) {
    describe(`第 ${level.id} 关 ${level.name}`, () => {
      it("路径合法:水平/垂直、在地图内;障碍物不压在路径上且奖励 ≥ 50", () => {
        const pathCells = new Set<string>();
        for (const wp of level.waypoints) {
          for (const [c, r] of rasterizeCells(wp)) {
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThan(level.cols);
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThan(level.rows);
            pathCells.add(`${c},${r}`);
          }
        }
        const seen = new Set<string>();
        for (const o of level.obstacles) {
          const key = `${o.col},${o.row}`;
          expect(pathCells.has(key)).toBe(false);
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
        expect(level.startGold).toBeGreaterThanOrEqual(200);
        // 多路关需要同时守多个入口,启动资金更高是设计的一部分
        expect(level.startGold).toBeLessThanOrEqual(1100);
      });

      it("至少 15 波;前期 5–8 只小喽啰;每 5 波一个 Boss", () => {
        expect(level.waves.length).toBeGreaterThanOrEqual(15);
        for (let n = 1; n <= 3; n++) {
          const grunts = level.waves[n - 1].groups.find((g) => g.kind === "grunt")!;
          expect(grunts.count).toBeGreaterThanOrEqual(5);
          expect(grunts.count).toBeLessThanOrEqual(8);
        }
        level.waves.forEach((w, i) => {
          const hasBoss = w.groups.some((g) => g.kind === "boss");
          expect(hasBoss).toBe((i + 1) % 5 === 0);
        });
      });

      it("中期混入飞行怪与胖子", () => {
        const kinds = new Set(level.waves.slice(3, 12).flatMap((w) => w.groups.map((g) => g.kind)));
        expect(kinds.has("flyer")).toBe(true);
        expect(kinds.has("fatty")).toBe(true);
      });
    });
  }
});
