import { describe, expect, it } from "vitest";
import { STEP } from "../constants";
import { setFocusObstacle } from "../engine";
import { isTargetable } from "../enemy";
import {
  fireTower,
  selectTarget,
  towerStats,
  updateProjectiles,
  updateTower,
} from "../tower";
import { TOWER_DEFS } from "../towerDefs";
import type { TowerKind } from "../types";
import { flushProjectiles, makeState, place, spawnEnemy } from "./helpers";

function setup(kind: TowerKind, col = 5, row = 1) {
  const state = makeState();
  return { state, tower: place(state, kind, col, row) };
}

const shots = (state: ReturnType<typeof makeState>) =>
  state.events.filter((e) => e.type === "shoot").length;

describe("炮塔:冷却与伤害", () => {
  it("射程内有敌人 → 开火并进入冷却;冷却期间不再开火", () => {
    const { state, tower } = setup("bottle");
    spawnEnemy(state, "grunt", 5, 1000);
    updateTower(state, tower, STEP);
    expect(shots(state)).toBe(1);
    expect(tower.cooldown).toBeCloseTo(0.6 - STEP, 6);
    for (let i = 0; i < 29; i++) updateTower(state, tower, STEP);
    expect(shots(state)).toBe(1); // 0.5s < 0.6s
    for (let i = 0; i < 10; i++) updateTower(state, tower, STEP);
    expect(shots(state)).toBe(2); // 已过 0.6s
  });

  it("射程外的敌人不会被攻击", () => {
    const { state, tower } = setup("bottle");
    spawnEnemy(state, "grunt", 0, 1); // (0.5,2.5) 距塔 (5.5,1.5) ≈ 5.1 > 2.6
    updateTower(state, tower, STEP);
    expect(shots(state)).toBe(0);
    expect(tower.target).toBeNull();
  });

  it("瓶子炮 1 级:弹道命中后造成 12 点伤害", () => {
    const { state, tower } = setup("bottle");
    const e = spawnEnemy(state, "grunt", 5, 10);
    fireTower(state, tower, { type: "enemy", id: e.id });
    expect(e.hp).toBe(e.maxHp); // 弹道在飞行中,尚未命中
    flushProjectiles(state);
    expect(e.hp).toBe(e.maxHp - 12);
  });

  it("弹道不会穿过目标:高速移动目标依然被命中", () => {
    const { state, tower } = setup("bottle");
    const e = spawnEnemy(state, "flyer", 4.8, 10);
    fireTower(state, tower, { type: "enemy", id: e.id });
    for (let i = 0; i < 120 && state.projectiles.length; i++) {
      e.x += 1.8 * STEP; // 飞行怪持续移动
      updateProjectiles(state, STEP);
    }
    expect(state.projectiles).toHaveLength(0);
    expect(e.hp).toBe(e.maxHp - 12);
  });

  it("满级瓶子炮攻速约 0.25s,DPS 随等级提升", () => {
    const { state, tower } = setup("bottle");
    const dps = () => towerStats(tower).damage / towerStats(tower).cooldown;
    const dps1 = dps();
    tower.level = 3;
    expect(towerStats(tower).cooldown).toBe(0.25);
    expect(dps()).toBeGreaterThan(dps1 * 4);
    spawnEnemy(state, "grunt", 5, 1000);
    for (let i = 0; i < 60; i++) updateTower(state, tower, STEP);
    expect(shots(state)).toBeGreaterThanOrEqual(4);
    expect(shots(state)).toBeLessThanOrEqual(5);
  });
});

describe("炮塔:目标选择", () => {
  it("选择射程内路径进度最大(最接近萝卜)的敌人", () => {
    const { state, tower } = setup("bottle");
    spawnEnemy(state, "grunt", 4.5, 10);
    const front = spawnEnemy(state, "grunt", 6.5, 10);
    expect(selectTarget(state, tower)).toEqual({ type: "enemy", id: front.id });
  });

  it("保持锁定:原目标仍在射程内时不切换", () => {
    const { state, tower } = setup("bottle");
    const a = spawnEnemy(state, "grunt", 4.5, 10);
    tower.target = selectTarget(state, tower);
    spawnEnemy(state, "grunt", 6.5, 10);
    expect(selectTarget(state, tower)).toEqual({ type: "enemy", id: a.id });
  });

  it("对地炮塔(太阳花/月亮)打不到飞行怪,瓶子/风扇/冰冻星可以", () => {
    const { state, tower } = setup("sunflower");
    spawnEnemy(state, "flyer", 5, 10);
    expect(selectTarget(state, tower)).toBeNull();
    for (const kind of ["bottle", "fan", "star"] as const) {
      expect(TOWER_DEFS[kind].canHitAir).toBe(true);
    }
    for (const kind of ["sunflower", "moon"] as const) {
      expect(TOWER_DEFS[kind].canHitAir).toBe(false);
    }
    const bottle = place(state, "bottle", 4, 1);
    expect(selectTarget(state, bottle)).not.toBeNull();
  });

  it("出生中的敌人不会被选中", () => {
    const { state, tower } = setup("bottle");
    const e = spawnEnemy(state, "grunt", 5, 10);
    e.state = "spawn";
    expect(selectTarget(state, tower)).toBeNull();
  });
});

describe("炮塔:各类攻击方式", () => {
  it("风扇射线穿透:同一直线上的多个敌人都受伤,偏离的不受伤", () => {
    const { state, tower } = setup("fan");
    const a = spawnEnemy(state, "grunt", 5.0, 10); // (5.5, 2.5) 正下方
    const b = spawnEnemy(state, "grunt", 5.15, 10); // 紧邻,同在射线上
    const c = spawnEnemy(state, "grunt", 8.5, 10); // 远离射线
    fireTower(state, tower, { type: "enemy", id: a.id });
    expect(a.hp).toBe(a.maxHp - 16);
    expect(b.hp).toBe(b.maxHp - 16);
    expect(c.hp).toBe(c.maxHp);
    expect(state.effects.some((e) => e.kind === "beam")).toBe(true);
  });

  it("太阳花脉冲:范围内所有地面敌人受伤,范围外与飞行怪不受伤", () => {
    const { state, tower } = setup("sunflower");
    const inA = spawnEnemy(state, "grunt", 4.5, 10);
    const inB = spawnEnemy(state, "grunt", 5.5, 10);
    const out = spawnEnemy(state, "grunt", 8, 10);
    const air = spawnEnemy(state, "flyer", 5, 10);
    fireTower(state, tower, { type: "enemy", id: inA.id });
    expect(inA.hp).toBe(inA.maxHp - 9);
    expect(inB.hp).toBe(inB.maxHp - 9);
    expect(out.hp).toBe(out.maxHp);
    expect(air.hp).toBe(air.maxHp);
  });

  it("月亮:溅射范围内的敌人被减速,伤害很低", () => {
    const { state, tower } = setup("moon");
    const a = spawnEnemy(state, "grunt", 5, 10);
    const b = spawnEnemy(state, "grunt", 5.6, 10);
    const c = spawnEnemy(state, "grunt", 8, 10);
    fireTower(state, tower, { type: "enemy", id: a.id });
    flushProjectiles(state);
    expect(a.state).toBe("slowed");
    expect(a.slowFactor).toBe(0.65);
    expect(b.state).toBe("slowed");
    expect(c.state).toBe("moving");
    expect(a.hp).toBe(a.maxHp - 4);
  });

  it("冰冻星:按概率冻结(统计落在期望附近),Boss 永不冻结", () => {
    const { state, tower } = setup("star");
    const e = spawnEnemy(state, "grunt", 5, 1e6);
    let frozen = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      fireTower(state, tower, { type: "enemy", id: e.id });
      flushProjectiles(state);
      if (e.state === "frozen") frozen++;
      e.freezeTimer = 0;
      e.state = "moving";
    }
    expect(frozen / N).toBeGreaterThan(0.15);
    expect(frozen / N).toBeLessThan(0.3); // 1 级概率 22%

    const boss = spawnEnemy(state, "boss", 5, 1e4);
    for (let i = 0; i < 100; i++) {
      fireTower(state, tower, { type: "enemy", id: boss.id });
      flushProjectiles(state);
    }
    expect(boss.state).not.toBe("frozen");
    expect(boss.freezeTimer).toBe(0);
  });
});

describe("炮塔:锁定障碍物", () => {
  it("被锁定的障碍物在射程内时优先于敌人", () => {
    const state = makeState({ obstacles: [{ col: 5, row: 0, kind: "rock" }] });
    const tower = place(state, "bottle", 5, 1);
    spawnEnemy(state, "grunt", 5, 10);
    expect(selectTarget(state, tower)?.type).toBe("enemy");
    const ob = state.obstacles[0];
    setFocusObstacle(state, ob.id);
    expect(selectTarget(state, tower)).toEqual({ type: "obstacle", id: ob.id });
  });

  it("目标不会是尚在出生/已死亡的敌人", () => {
    const { state, tower } = setup("bottle");
    const e = spawnEnemy(state, "grunt", 5, 1);
    e.state = "dying";
    expect(isTargetable(e)).toBe(false);
    expect(selectTarget(state, tower)).toBeNull();
  });
});
