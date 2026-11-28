import { describe, expect, it } from "vitest";
import {
  buildTower,
  checkBuild,
  sellTower,
  sellValue,
  towerAt,
  upgradeCostOf,
  upgradeTower,
} from "../economy";
import { towerStats } from "../tower";
import { TOWER_DEFS, buildCost } from "../towerDefs";
import { makeState, place } from "./helpers";

describe("经济:建造", () => {
  it("造价与设计一致", () => {
    expect(buildCost("bottle")).toBe(100);
    expect(buildCost("fan")).toBe(200);
    expect(buildCost("sunflower")).toBe(180);
    expect(buildCost("star")).toBeGreaterThan(buildCost("fan"));
  });

  it("金币充足时建造成功:扣钱、加入炮塔", () => {
    const s = makeState({ startGold: 300 });
    const res = buildTower(s, "bottle", 5, 1);
    expect(res.ok).toBe(true);
    expect(s.gold).toBe(200);
    expect(s.towers).toHaveLength(1);
    expect(towerAt(s, 5, 1)?.invested).toBe(100);
  });

  it("金币不足时建造被拒绝,且状态完全不变", () => {
    const s = makeState({ startGold: 150 });
    const res = buildTower(s, "fan", 5, 1);
    expect(res).toEqual({ ok: false, reason: "insufficient_gold" });
    expect(s.gold).toBe(150);
    expect(s.towers).toHaveLength(0);
  });

  it("不能建在路径、障碍物、已有炮塔的格子或地图之外", () => {
    const s = makeState({ obstacles: [{ col: 3, row: 1, kind: "rock" }] });
    expect(checkBuild(s, "bottle", 4, 2)).toEqual({ ok: false, reason: "not_buildable" });
    expect(checkBuild(s, "bottle", 3, 1)).toEqual({ ok: false, reason: "obstacle" });
    expect(checkBuild(s, "bottle", -1, 0)).toEqual({ ok: false, reason: "out_of_bounds" });
    expect(checkBuild(s, "bottle", 3, 99)).toEqual({ ok: false, reason: "out_of_bounds" });
    place(s, "bottle", 5, 1);
    expect(buildTower(s, "bottle", 5, 1)).toEqual({ ok: false, reason: "occupied" });
  });
});

describe("经济:升级", () => {
  it("瓶子炮升级花费 150 / 250,属性逐级提升,满级后被拒绝", () => {
    const s = makeState({ startGold: 1000 });
    const t = place(s, "bottle", 5, 1);
    const l1 = { ...towerStats(t) };

    expect(upgradeCostOf(t)).toBe(150);
    expect(upgradeTower(s, t.id).ok).toBe(true);
    expect(t.level).toBe(2);
    expect(s.gold).toBe(1000 - 100 - 150);
    const l2 = { ...towerStats(t) };
    expect(l2.damage).toBeGreaterThan(l1.damage);
    expect(l2.range).toBeGreaterThan(l1.range);
    expect(l2.cooldown).toBeLessThan(l1.cooldown);

    expect(upgradeCostOf(t)).toBe(250);
    expect(upgradeTower(s, t.id).ok).toBe(true);
    expect(t.level).toBe(3);
    expect(s.gold).toBe(1000 - 100 - 150 - 250);
    expect(towerStats(t).cooldown).toBe(0.25);
    expect(t.invested).toBe(500);

    expect(upgradeCostOf(t)).toBeNull();
    expect(upgradeTower(s, t.id)).toEqual({ ok: false, reason: "max_level" });
    expect(s.gold).toBe(500);
  });

  it("金币不足时升级被拒绝", () => {
    const s = makeState({ startGold: 220 });
    const t = place(s, "bottle", 5, 1); // 剩 120
    expect(upgradeTower(s, t.id)).toEqual({ ok: false, reason: "insufficient_gold" });
    expect(t.level).toBe(1);
    expect(s.gold).toBe(120);
  });

  it("所有炮塔都有 3 个等级,且伤害或经济产出逐级提高", () => {
    for (const def of Object.values(TOWER_DEFS)) {
      expect(def.levels).toHaveLength(3);
      for (let i = 1; i < 3; i++) {
        if (def.attack === "idle") {
          expect(def.levels[i].goldPerTick!).toBeGreaterThan(def.levels[i - 1].goldPerTick!);
        } else if (def.attack === "aura") {
          expect(def.levels[i].range).toBeGreaterThanOrEqual(def.levels[i - 1].range);
        } else {
          expect(def.levels[i].damage).toBeGreaterThan(def.levels[i - 1].damage);
          expect(def.levels[i].range).toBeGreaterThanOrEqual(def.levels[i - 1].range);
        }
        expect(def.levels[i].cooldown).toBeLessThanOrEqual(def.levels[i - 1].cooldown);
      }
    }
  });
});

describe("经济:出售", () => {
  it("1 级返还 70%,满级返还总投入(500)的 70% = 350", () => {
    const s = makeState({ startGold: 1000 });
    const a = place(s, "bottle", 5, 1);
    expect(sellValue(a)).toBe(70);
    upgradeTower(s, a.id);
    upgradeTower(s, a.id);
    expect(sellValue(a)).toBe(350);

    const before = s.gold;
    const res = sellTower(s, a.id);
    expect(res).toMatchObject({ ok: true, refund: 350 });
    expect(s.gold).toBe(before + 350);
    expect(s.towers).toHaveLength(0);
  });

  it("出售后格子可再次建造;出售不存在的炮塔被拒绝", () => {
    const s = makeState();
    const t = place(s, "fan", 5, 1);
    expect(sellTower(s, t.id).ok).toBe(true);
    expect(buildTower(s, "bottle", 5, 1).ok).toBe(true);
    expect(sellTower(s, 12345)).toEqual({ ok: false, reason: "no_tower" });
  });
});
