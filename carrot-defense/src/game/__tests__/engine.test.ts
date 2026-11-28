import { describe, expect, it } from "vitest";
import { STEP } from "../constants";
import { FixedStepRunner, callNextWave, createGameState, setFocusObstacle, step } from "../engine";
import { buildTower, checkBuild } from "../economy";
import { LEVELS } from "../levels";
import { makeLevel, makeState, place, runSteps, spawnEnemy } from "./helpers";

describe("引擎:敌人漏过扣血", () => {
  it("小喽啰到达终点 → 扣 1 血", () => {
    const s = makeState();
    spawnEnemy(s, "grunt", 8.99);
    runSteps(s, 0.5);
    expect(s.lives).toBe(9);
    expect(s.stats.leaked).toBe(1);
    expect(s.enemies).toHaveLength(0);
    expect(s.events.some((e) => e.type === "leak")).toBe(true);
  });

  it("胖子扣 2 血,Boss 直接扣 5 血,飞行怪扣 1 血", () => {
    const s = makeState();
    spawnEnemy(s, "fatty", 8.99);
    runSteps(s, 0.5);
    expect(s.lives).toBe(8);
    spawnEnemy(s, "boss", 8.99);
    runSteps(s, 0.5);
    expect(s.lives).toBe(3);
    spawnEnemy(s, "flyer", 8.99);
    runSteps(s, 0.5);
    expect(s.lives).toBe(2);
  });

  it("生命归零 → 失败,之后逻辑停止", () => {
    const s = makeState();
    spawnEnemy(s, "boss", 8.99);
    spawnEnemy(s, "boss", 8.98);
    runSteps(s, 0.5);
    expect(s.lives).toBe(0);
    expect(s.status).toBe("lost");
    const t = s.time;
    runSteps(s, 1);
    expect(s.time).toBe(t);
  });
});

describe("引擎:击杀、清障与金币", () => {
  it("击杀小喽啰 +14 金币,且只结算一次", () => {
    const s = makeState();
    place(s, "bottle", 5, 1);
    const gold0 = s.gold;
    spawnEnemy(s, "grunt", 5, 0.1); // 5 点血,一发即死
    runSteps(s, 2);
    expect(s.stats.kills).toBe(1);
    expect(s.gold).toBe(gold0 + 14);
    expect(s.enemies).toHaveLength(0);
  });

  it("击杀胖子 +168 金币", () => {
    const s = makeState();
    place(s, "bottle", 5, 1);
    const gold0 = s.gold;
    spawnEnemy(s, "fatty", 5, 0.01);
    runSteps(s, 2);
    expect(s.gold).toBe(gold0 + 168);
  });

  it("清障:锁定障碍物后被炮塔摧毁 → 奖励 ≥ 50 金币、格子变为可建造", () => {
    const s = makeState({ obstacles: [{ col: 5, row: 0, kind: "rock" }] });
    place(s, "bottle", 5, 1);
    expect(checkBuild(s, "bottle", 5, 0)).toEqual({ ok: false, reason: "obstacle" });
    const gold0 = s.gold;
    setFocusObstacle(s, s.obstacles[0].id);
    runSteps(s, 8);
    expect(s.obstacles).toHaveLength(0);
    expect(s.focusObstacleId).toBeNull();
    expect(s.gold).toBe(gold0 + 50);
    expect(checkBuild(s, "bottle", 5, 0).ok).toBe(true);
  });
});

describe("引擎:波次与胜负", () => {
  it("防守成功:清空所有波次且满血 → 胜利并获得金萝卜", () => {
    const s = createGameState(
      makeLevel({
        firstWaveDelay: 1,
        waves: [{ groups: [{ kind: "grunt", count: 3, interval: 1 }] }],
      }),
    );
    place(s, "bottle", 5, 1);
    place(s, "bottle", 4, 1);
    runSteps(s, 60);
    expect(s.status).toBe("won");
    expect(s.lives).toBe(10);
    expect(s.rating).toBe(3);
    expect(s.stats.kills).toBe(3);
    expect(s.gold).toBe(500 - 200 + 3 * 14);
  });

  it("漏掉 1 只 → 仍胜利但只有银萝卜;漏 3 只胖子(6 血) → 铜萝卜", () => {
    const silver = createGameState(
      makeLevel({ firstWaveDelay: 1, waves: [{ groups: [{ kind: "grunt", count: 1, interval: 1 }] }] }),
    );
    runSteps(silver, 40);
    expect(silver.status).toBe("won");
    expect(silver.lives).toBe(9);
    expect(silver.rating).toBe(2);

    const bronze = createGameState(
      makeLevel({ firstWaveDelay: 1, waves: [{ groups: [{ kind: "fatty", count: 3, interval: 1 }] }] }),
    );
    runSteps(bronze, 60);
    expect(bronze.status).toBe("won");
    expect(bronze.lives).toBe(4);
    expect(bronze.rating).toBe(1);
  });

  it("未清空所有波次前不会判定胜利", () => {
    const s = createGameState(
      makeLevel({
        firstWaveDelay: 1,
        waves: [
          { groups: [{ kind: "grunt", count: 1, interval: 1 }] },
          { groups: [{ kind: "grunt", count: 1, interval: 1 }] },
        ],
      }),
    );
    place(s, "bottle", 5, 1);
    runSteps(s, 8);
    expect(s.status).toBe("playing");
    expect(s.waves.waveNumber).toBe(2);
  });

  it("点击下一波:提前开始并获得奖励金币", () => {
    const s = makeState({ firstWaveDelay: 10 });
    const gold0 = s.gold;
    const bonus = callNextWave(s);
    expect(bonus).toBe(30);
    expect(s.gold).toBe(gold0 + 30);
    expect(s.waves.waveNumber).toBe(1);
    expect(callNextWave(s)).toBeNull();
    runSteps(s, 0.1);
    expect(s.enemies.length).toBe(1);
  });

  it("飞行怪沿直线飞向萝卜,而不是走弯曲路径", () => {
    const level = LEVELS[0];
    const s = createGameState({
      ...level,
      firstWaveDelay: 0.1,
      waves: [{ groups: [{ kind: "flyer", count: 1, interval: 1 }] }],
    });
    runSteps(s, 1);
    const fly = s.enemies[0];
    expect(fly.flying).toBe(true);
    expect(fly.path.points).toHaveLength(2);
    expect(fly.path.length).toBeLessThan(s.paths[0].length);
  });
});

describe("引擎:固定步长", () => {
  it("按 1/60 秒整步推进,与渲染帧率无关", () => {
    const s = makeState();
    const runner = new FixedStepRunner();
    let steps = 0;
    for (let i = 0; i < 30; i++) steps += runner.advance(s, 1 / 30);
    expect(steps).toBe(60);
    expect(s.time).toBeCloseTo(1, 5);

    const s2 = makeState();
    const r2 = new FixedStepRunner();
    for (let i = 0; i < 144; i++) r2.advance(s2, 1 / 144);
    expect(s2.time).toBeGreaterThan(0.98);
    expect(s2.time).toBeLessThanOrEqual(1.0001);
  });

  it("倍速与大帧间隔被夹住,避免死亡螺旋", () => {
    const s = makeState();
    const r = new FixedStepRunner();
    for (let i = 0; i < 15; i++) r.advance(s, 1 / 30, 2);
    expect(s.time).toBeCloseTo(1, 5);
    const s3 = makeState();
    const steps = new FixedStepRunner().advance(s3, 10);
    expect(steps).toBeLessThanOrEqual(15);
  });

  it("step 在非 playing 状态下是空操作;buildTower 同样被拒绝", () => {
    const s = makeState();
    s.status = "lost";
    step(s, STEP);
    expect(s.time).toBe(0);
    expect(buildTower(s, "bottle", 5, 1)).toEqual({ ok: false, reason: "game_over" });
  });
});
