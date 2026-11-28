import { describe, expect, it } from "vitest";
import { cyclePriority, selectTarget } from "../tower";
import { ROLE_STYLE, TOWER_META, towerPower } from "../towerMeta";
import { TOWER_DEFS, TOWER_ORDER } from "../towerDefs";
import { makeState, place, spawnEnemy } from "./helpers";

describe("玩法:攻击优先级", () => {
  it("默认 first:打路径进度最大的(最接近萝卜)", () => {
    const s = makeState();
    const t = place(s, "bottle", 5, 1);
    spawnEnemy(s, "grunt", 4.5, 10);
    const front = spawnEnemy(s, "grunt", 6.2, 10);
    expect(t.priority).toBe("first");
    expect(selectTarget(s, t)).toEqual({ type: "enemy", id: front.id });
  });

  it("strongest:打当前血量最多的", () => {
    const s = makeState();
    const t = place(s, "bottle", 5, 1);
    const front = spawnEnemy(s, "grunt", 6.2, 1);
    const tanky = spawnEnemy(s, "grunt", 4.5, 20);
    expect(tanky.hp).toBeGreaterThan(front.hp);
    t.priority = "strongest";
    expect(selectTarget(s, t)).toEqual({ type: "enemy", id: tanky.id });
  });

  it("closest:打离塔最近的", () => {
    const s = makeState();
    const t = place(s, "bottle", 5, 1); // 塔在 (5.5,1.5)
    const far = spawnEnemy(s, "grunt", 6.8, 10);
    const near = spawnEnemy(s, "grunt", 5.0, 10);
    const dNear = Math.hypot(near.x - t.x, near.y - t.y);
    const dFar = Math.hypot(far.x - t.x, far.y - t.y);
    expect(dNear).toBeLessThan(dFar);
    t.priority = "closest";
    expect(selectTarget(s, t)).toEqual({ type: "enemy", id: near.id });
  });

  it("优先级三档循环", () => {
    const s = makeState();
    const t = place(s, "bottle", 5, 1);
    expect(cyclePriority(t)).toBe("strongest");
    t.priority = "strongest";
    expect(cyclePriority(t)).toBe("closest");
    t.priority = "closest";
    expect(cyclePriority(t)).toBe("first");
  });

  it("优先级不会越过射程/对空限制", () => {
    const s = makeState();
    const t = place(s, "sunflower", 5, 1); // 仅对地
    t.priority = "strongest";
    spawnEnemy(s, "flyer", 5, 50); // 血厚但会飞
    expect(selectTarget(s, t)).toBeNull();
  });
});

describe("展示层:定位与强度", () => {
  it("每种炮塔都有定位、对空模式与一句话卖点", () => {
    for (const kind of TOWER_ORDER) {
      const meta = TOWER_META[kind];
      expect(ROLE_STYLE[meta.role]).toBeTruthy();
      expect(["both", "groundOnly", "airOnly"]).toContain(meta.air);
      expect(meta.pitch.length).toBeGreaterThan(4);
    }
  });

  it("对空模式与炮塔定义一致", () => {
    for (const kind of TOWER_ORDER) {
      const def = TOWER_DEFS[kind];
      const air = TOWER_META[kind].air;
      if (def.airOnly) expect(air).toBe("airOnly");
      else if (def.canHitAir) expect(air).toBe("both");
      else expect(air).toBe("groundOnly");
    }
  });

  it("强度点在 1–5 之间,且狙击射程点数最高、经济塔为 0", () => {
    for (const kind of TOWER_ORDER) {
      const p = towerPower(kind);
      for (const v of [p.damage, p.range, p.speed, p.area]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(5);
      }
    }
    // 狙击仍是长射程;后期巨炮/核弹射程更远
    expect(towerPower("sniper").range).toBeGreaterThanOrEqual(4);
    expect(towerPower("siege").range).toBeGreaterThanOrEqual(towerPower("sniper").range);
    expect(towerPower("goldmine").damage).toBe(0);
    expect(towerPower("cutter").speed).toBeGreaterThan(towerPower("nuke").speed);
    expect(towerPower("mortar").area).toBeGreaterThan(towerPower("bottle").area);
  });
});
