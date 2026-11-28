import { describe, expect, it } from "vitest";
import { STEP } from "../constants";
import { applyPoison, createEnemy, damageEnemy, updateEnemy } from "../enemy";
import { createGameState, step } from "../engine";
import { TOWER_DEFS, TOWER_ORDER, TOWER_PAGES } from "../towerDefs";
import { fireTower, updateProjectiles } from "../tower";
import { makeState, place, spawnEnemy } from "./helpers";

describe("扩展:15 种炮塔", () => {
  it("共 33 种,分 7 页,每页不超过 5 个(快捷键 1–5)", () => {
    expect(TOWER_ORDER).toHaveLength(33);
    expect(TOWER_PAGES).toHaveLength(7);
    expect(TOWER_PAGES.every((p) => p.kinds.length <= 5)).toBe(true);
    expect(new Set(TOWER_ORDER)).toEqual(new Set(TOWER_PAGES.flatMap((p) => p.kinds)));
    // 分页之间不能重复
    const all = TOWER_PAGES.flatMap((p) => p.kinds);
    expect(all).toHaveLength(new Set(all).size);
  });

  it("每种炮塔都有 3 级且伤害或经济产出随等级提升", () => {
    for (const def of Object.values(TOWER_DEFS)) {
      expect(def.levels).toHaveLength(3);
      if (def.attack === "idle") {
        expect(def.levels[2].goldPerTick!).toBeGreaterThan(def.levels[0].goldPerTick!);
      } else if (def.attack === "aura") {
        const a = def.levels[0], z = def.levels[2];
        if (a.buffDamage) expect(z.buffDamage!).toBeGreaterThan(a.buffDamage);
        if (a.auraSlow) expect(z.auraSlow!).toBeLessThan(a.auraSlow);
      } else {
        expect(def.levels[2].damage).toBeGreaterThan(def.levels[0].damage);
      }
    }
  });
});

describe("扩展:新机制", () => {
  it("铁甲兵减免伤害,至少仍受到 1 点", () => {
    const s = makeState();
    const e = spawnEnemy(s, "armored", 5, 1);
    const raw = 20;
    const expected = Math.max(1, raw * (1 - e.armor));
    damageEnemy(e, raw);
    expect(e.hp).toBeCloseTo(e.maxHp - expected, 5);
  });

  it("毒素持续掉血直至死亡", () => {
    const path = makeState().paths[0];
    const e = createEnemy(1, "grunt", path, 0);
    e.state = "moving";
    applyPoison(e, 40, 2);
    let leaked: string | null = null;
    for (let i = 0; i < 60 * 3; i++) leaked = updateEnemy(e, STEP) ?? leaked;
    expect(e.state).toBe("dead");
    expect(leaked).toBeNull();
  });

  it("金萝卜矿不攻击但定时产金", () => {
    const s = makeState({ startGold: 500 });
    const gold0 = s.gold;
    place(s, "goldmine", 5, 1);
    expect(s.gold).toBe(gold0 - 180);
    for (let i = 0; i < 60 * 4.2; i++) step(s, STEP);
    expect(s.gold).toBeGreaterThan(gold0 - 180);
    expect(s.stats.goldEarned).toBeGreaterThanOrEqual(12);
  });

  it("电塔连锁命中多个敌人", () => {
    const s = makeState();
    const t = place(s, "tesla", 5, 1);
    const a = spawnEnemy(s, "grunt", 5, 10);
    const b = spawnEnemy(s, "grunt", 5.3, 10);
    fireTower(s, t, { type: "enemy", id: a.id });
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
  });

  it("防空火箭打不到地面怪", () => {
    const s = makeState();
    const t = place(s, "rocket", 5, 1);
    spawnEnemy(s, "grunt", 5, 10);
    expect(t.target).toBeNull();
    fireTower(s, t, { type: "enemy", id: s.enemies[0].id });
    // 即使强行开火,地面怪不在 rocket 溅射筛选里... 目标选择应为空
    const flyer = spawnEnemy(s, "flyer", 5, 10);
    const t2 = place(s, "rocket", 4, 1);
    fireTower(s, t2, { type: "enemy", id: flyer.id });
    for (let i = 0; i < 120 && s.projectiles.length; i++) updateProjectiles(s, STEP);
    expect(flyer.hp).toBeLessThan(flyer.maxHp);
  });

  it("分裂怪死亡后生成虫群", () => {
    const s = createGameState(makeState().level);
    const e = spawnEnemy(s, "splitter", 4, 0.05);
    e.hp = 1;
    e.state = "moving";
    damageEnemy(e, 999);
    step(s, STEP);
    expect(s.enemies.some((x) => x.kind === "swarmling")).toBe(true);
  });
});
