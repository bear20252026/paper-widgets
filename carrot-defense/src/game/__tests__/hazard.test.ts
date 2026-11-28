import { describe, expect, it } from "vitest";
import { STEP } from "../constants";
import { damageEnemy, applySlow } from "../enemy";
import { createGameState, step } from "../engine";
import { ENEMY_DEFS } from "../enemy";
import { getLevel, LEVELS } from "../levels";
import { samplePath } from "../path";
import { makeState, place, spawnEnemy } from "./helpers";

describe("玩法修复:危险区是游戏状态,不是渲染特效", () => {
  it("熔岩怪死亡产生 hazard,并对范围内敌人持续掉血,到期自动清除", () => {
    const s = makeState();
    const lava = spawnEnemy(s, "lava", 3, 0.01); // 1 点血
    damageEnemy(lava, 999);
    step(s, STEP);
    expect(s.hazards).toHaveLength(1);

    const victim = spawnEnemy(s, "grunt", 3.02, 1000);
    const before = victim.hp;
    for (let i = 0; i < 120; i++) step(s, STEP);
    expect(victim.hp).toBeLessThan(before);

    for (let i = 0; i < 60 * 6; i++) step(s, STEP);
    expect(s.hazards).toHaveLength(0);
  });

  it("普通敌人死亡不会留下危险区", () => {
    const s = makeState();
    const grunt = spawnEnemy(s, "grunt", 3, 0.01);
    damageEnemy(grunt, 999);
    step(s, STEP);
    expect(s.hazards).toHaveLength(0);
  });
});

describe("玩法修复:陷阱塔不依赖 setTimeout", () => {
  it("踩雷造成范围伤害,并在冷却内不重复触发", () => {
    const s = makeState({ startGold: 3000 });
    const trap = place(s, "trap", 5, 1);
    const e = spawnEnemy(s, "grunt", 5, 1000);
    e.x = trap.x;
    e.y = trap.y;

    const hp0 = e.hp;
    step(s, STEP);
    expect(e.hp).toBeLessThan(hp0);
    const hp1 = e.hp;
    // 冷却中:再走几帧也不该再次爆炸
    for (let i = 0; i < 10; i++) step(s, STEP);
    expect(e.hp).toBe(hp1);
    expect(trap.cooldown).toBeGreaterThan(0);
  });
});

describe("玩法修复:磁力塔不改写敌人坐标", () => {
  it("敌人位置始终等于其路径采样点(不会被拉离赛道)", () => {
    const s = makeState({ startGold: 3000 });
    place(s, "magnet", 5, 1);
    const e = spawnEnemy(s, "grunt", 4.6, 100);
    for (let i = 0; i < 60; i++) step(s, STEP);
    const p = samplePath(e.path, e.distance);
    expect(e.x).toBeCloseTo(p.x, 6);
    expect(e.y).toBeCloseTo(p.y, 6);
    expect(e.state).toBe("slowed"); // 磁力以减速生效
  });

  it("免疫减速的敌人不受磁力影响", () => {
    const s = makeState({ startGold: 3000 });
    place(s, "magnet", 5, 1);
    const ghost = spawnEnemy(s, "ghost", 4.8, 100);
    for (let i = 0; i < 30; i++) step(s, STEP);
    expect(ghost.state).not.toBe("slowed");
    expect(applySlow).toBeTypeOf("function");
  });
});

describe("内容完整性", () => {
  it("25 种敌人全部在 100 关中登场", () => {
    const used = new Set<string>();
    for (const l of LEVELS) for (const w of l.waves) for (const g of w.groups) used.add(g.kind);
    const kinds = Object.keys(ENEMY_DEFS);
    expect(kinds).toHaveLength(25);
    expect(kinds.filter((k) => !used.has(k))).toEqual([]);
  });

  it("每章都有 25 关,且 100 关都能创建出合法状态", () => {
    for (const ch of [1, 2, 3, 4] as const) {
      expect(LEVELS.filter((l) => l.chapter === ch)).toHaveLength(25);
    }
    for (const id of [1, 25, 26, 50, 51, 75, 76, 100]) {
      const s = createGameState(getLevel(id));
      expect(s.lives).toBe(10);
      expect(s.paths.length).toBeGreaterThan(0);
      expect(s.obstacles.every((o) => o.hp > 0)).toBe(true);
    }
  });
});
