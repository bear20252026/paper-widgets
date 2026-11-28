import { describe, expect, it } from "vitest";
import { DYING_TIME, SPAWN_TIME, STEP } from "../constants";
import {
  ENEMY_DEFS,
  applyFreeze,
  applySlow,
  createEnemy,
  damageEnemy,
  updateEnemy,
} from "../enemy";
import { createPath } from "../path";

const path = createPath([
  { x: 0.5, y: 0.5 },
  { x: 10.5, y: 0.5 },
]);

function fresh(kind: "grunt" | "flyer" | "fatty" | "boss" = "grunt") {
  return createEnemy(1, kind, path, 0);
}

function advance(e: ReturnType<typeof fresh>, seconds: number) {
  let result: "leaked" | null = null;
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    result = updateEnemy(e, STEP) ?? result;
  }
  return result;
}

describe("enemy 状态机", () => {
  it("出生中不动也不可被攻击,之后进入 moving", () => {
    const e = fresh();
    expect(e.state).toBe("spawn");
    expect(damageEnemy(e, 999)).toBe(false);
    expect(e.hp).toBe(e.maxHp);
    advance(e, SPAWN_TIME + STEP * 2);
    expect(e.state).toBe("moving");
    expect(e.distance).toBeLessThan(0.1);
  });

  it("沿路径按速度移动", () => {
    const e = fresh();
    advance(e, SPAWN_TIME + STEP);
    const d0 = e.distance;
    advance(e, 2);
    expect(e.distance - d0).toBeCloseTo(ENEMY_DEFS.grunt.speed * 2, 1);
    expect(e.x).toBeCloseTo(0.5 + e.distance, 6);
  });

  it("减速 → slowed,速度按系数降低,到期后恢复 moving", () => {
    const e = fresh();
    advance(e, SPAWN_TIME + STEP);
    applySlow(e, 0.5, 1);
    expect(e.state).toBe("slowed");
    const d0 = e.distance;
    advance(e, 0.5);
    expect(e.distance - d0).toBeCloseTo(0.5 * 0.5 * ENEMY_DEFS.grunt.speed, 1);
    advance(e, 1);
    expect(e.state).toBe("moving");
    expect(e.slowFactor).toBe(1);
  });

  it("更强的减速覆盖较弱的减速", () => {
    const e = fresh();
    advance(e, SPAWN_TIME + STEP);
    applySlow(e, 0.65, 2);
    applySlow(e, 0.4, 1);
    expect(e.slowFactor).toBe(0.4);
    expect(e.slowTimer).toBe(2);
  });

  it("冻结 → frozen 时不移动,解冻后回到 slowed / moving", () => {
    const e = fresh();
    advance(e, SPAWN_TIME + STEP);
    applySlow(e, 0.5, 5);
    expect(applyFreeze(e, 1)).toBe(true);
    expect(e.state).toBe("frozen");
    const d0 = e.distance;
    advance(e, 0.9);
    expect(e.distance).toBe(d0);
    advance(e, 0.3);
    expect(e.state).toBe("slowed");
  });

  it("Boss 免疫冻结", () => {
    const boss = fresh("boss");
    advance(boss, SPAWN_TIME + STEP);
    expect(applyFreeze(boss, 2)).toBe(false);
    expect(boss.state).not.toBe("frozen");
  });

  it("致命伤害 → dying(只触发一次) → dead", () => {
    const e = fresh();
    advance(e, SPAWN_TIME + STEP);
    expect(damageEnemy(e, 10)).toBe(false);
    expect(e.hp).toBe(e.maxHp - 10);
    expect(damageEnemy(e, 9999)).toBe(true);
    expect(e.state).toBe("dying");
    expect(damageEnemy(e, 9999)).toBe(false);
    advance(e, DYING_TIME + STEP * 2);
    expect(e.state).toBe("dead");
  });

  it("到达终点 → leaked,并带有对应的漏过伤害", () => {
    const e = fresh();
    expect(advance(e, 30)).toBe("leaked");
    expect(e.state).toBe("leaked");
    expect(e.distance).toBe(path.length);
    expect(ENEMY_DEFS.grunt.leakDamage).toBe(1);
    expect(ENEMY_DEFS.fatty.leakDamage).toBe(2);
    expect(ENEMY_DEFS.boss.leakDamage).toBe(5);
  });

  it("每类敌人的关键属性符合设计", () => {
    expect(ENEMY_DEFS.grunt.reward).toBe(14);
    expect(ENEMY_DEFS.fatty.reward).toBe(168);
    expect(ENEMY_DEFS.flyer.flying).toBe(true);
    expect(ENEMY_DEFS.flyer.speed).toBeGreaterThan(ENEMY_DEFS.grunt.speed);
    expect(ENEMY_DEFS.fatty.speed).toBeLessThan(ENEMY_DEFS.grunt.speed);
    expect(ENEMY_DEFS.boss.hp).toBeGreaterThan(ENEMY_DEFS.fatty.hp);
  });
});
