import { describe, expect, it } from "vitest";
import { STEP } from "../constants";
import { step } from "../engine";
import { damageMultiplier, fireTower, isBuffed, updateTower } from "../tower";
import { TOWER_DEFS, TOWER_ORDER, getLevelStats } from "../towerDefs";
import { makeState, place, spawnEnemy } from "./helpers";

describe("玩法:方尖碑伤害光环", () => {
  it("范围内的塔获得加成,范围外不受影响", () => {
    const s = makeState({ startGold: 2000 });
    const near = place(s, "bottle", 5, 1);
    const far = place(s, "bottle", 0, 4);
    expect(damageMultiplier(s, near)).toBe(1);

    place(s, "obelisk", 6, 1); // 1 级 +25%
    expect(damageMultiplier(s, near)).toBeCloseTo(1.25, 5);
    expect(damageMultiplier(s, far)).toBe(1);
    expect(isBuffed(s, near)).toBe(true);
    expect(isBuffed(s, far)).toBe(false);
  });

  it("多座方尖碑的加成相加", () => {
    const s = makeState({ startGold: 3000 });
    const t = place(s, "bottle", 5, 1);
    place(s, "obelisk", 6, 1);
    place(s, "obelisk", 4, 1);
    expect(damageMultiplier(s, t)).toBeCloseTo(1.5, 5);
  });

  it("加成真的提高了打出的伤害", () => {
    const base = makeState({ startGold: 3000 });
    const t1 = place(base, "sunflower", 5, 1);
    const e1 = spawnEnemy(base, "grunt", 5, 10);
    fireTower(base, t1, { type: "enemy", id: e1.id });
    const plain = e1.maxHp - e1.hp;

    const buffed = makeState({ startGold: 3000 });
    const t2 = place(buffed, "sunflower", 5, 1);
    place(buffed, "obelisk", 6, 1);
    const e2 = spawnEnemy(buffed, "grunt", 5, 10);
    fireTower(buffed, t2, { type: "enemy", id: e2.id });
    const boosted = e2.maxHp - e2.hp;

    expect(boosted).toBeGreaterThan(plain);
    expect(boosted / plain).toBeCloseTo(1.25, 1);
  });

  it("方尖碑自己不攻击", () => {
    const s = makeState({ startGold: 2000 });
    const o = place(s, "obelisk", 5, 1);
    const e = spawnEnemy(s, "grunt", 5, 10);
    for (let i = 0; i < 60; i++) updateTower(s, o, STEP);
    expect(e.hp).toBe(e.maxHp);
    expect(o.target).toBeNull();
  });
});

describe("玩法:霜冻碑减速力场", () => {
  it("范围内敌人被持续减速,离开后恢复", () => {
    const s = makeState({ startGold: 2000 });
    place(s, "frostpillar", 5, 1);
    const e = spawnEnemy(s, "grunt", 5, 10);
    for (let i = 0; i < 10; i++) step(s, STEP);
    expect(e.state).toBe("slowed");
    expect(e.slowFactor).toBeCloseTo(getLevelStats("frostpillar", 1).auraSlow!, 5);

    // 挪到射程外,短时间内自动恢复
    e.distance = 0;
    e.x = 0.5;
    e.y = 2.5;
    for (let i = 0; i < 30; i++) step(s, STEP);
    expect(e.state).toBe("moving");
  });

  it("免疫减速的敌人不吃光环", () => {
    const s = makeState({ startGold: 2000 });
    place(s, "frostpillar", 5, 1);
    const ghost = spawnEnemy(s, "ghost", 5, 10);
    for (let i = 0; i < 20; i++) step(s, STEP);
    expect(ghost.state).not.toBe("slowed");
  });
});

describe("扩展内容规模", () => {
  it("33 种炮塔,其中光环类 5 种、经济类 2 种", () => {
    expect(TOWER_ORDER).toHaveLength(33);
    const aura = TOWER_ORDER.filter((k) => TOWER_DEFS[k].attack === "aura");
    const eco = TOWER_ORDER.filter((k) => TOWER_DEFS[k].attack === "idle");
    expect(aura).toHaveLength(5);
    expect(eco).toHaveLength(2);
  });
});
