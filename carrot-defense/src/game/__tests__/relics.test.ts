import { describe, expect, it } from "vitest";
import { STEP } from "../constants";
import { buildTower, upgradeTower } from "../economy";
import { activateCarrotSkill, pickRelic, step } from "../engine";
import { createEnemy, damageEnemy, updateEnemy } from "../enemy";
import { createPath } from "../path";
import {
  BOON_EVERY_WAVES,
  RELIC_IDS,
  RELICS,
  addEnergy,
  chooseRelic,
  energyPerKill,
  hasRelic,
  relicDamageMult,
  relicKillBonus,
  relicRangeBonus,
  relicRateMult,
  relicUpgradeMult,
  rollBoons,
} from "../relics";
import { damageMultiplier, towerRange } from "../tower";
import { nextUpgradeCost } from "../towerDefs";
import type { GameState, RelicId } from "../types";
import { makeState, place, runSteps, spawnEnemy } from "./helpers";

/** 造一个「已清完 N 波、正在准备下一波」的状态,便于触发波次结算钩子。 */
function prepAfter(state: GameState, cleared: number): void {
  state.waves.phase = "prep";
  state.waves.waveNumber = cleared;
  state.waves.prepTimer = 3;
  state.clearedWaves = cleared;
}

describe("遗物:抽取与选择", () => {
  it("抽 3 张不重复的卡,且不会重复发已拥有的遗物", () => {
    const s = makeState();
    const offer = rollBoons(s);
    expect(offer).toHaveLength(3);
    expect(new Set(offer).size).toBe(3);
    expect(offer.every((id) => !s.relics.includes(id))).toBe(true);
  });

  it("同一个随机种子抽出同样的卡(可复现)", () => {
    const a = makeState();
    const b = makeState();
    expect(rollBoons(a)).toEqual(rollBoons(b));
    const c = makeState();
    c.rngState = 12345;
    expect(rollBoons(c)).not.toEqual(rollBoons(a));
  });

  it("拥有 6 件后,候选卡数量减少", () => {
    const s = makeState();
    s.relics = RELIC_IDS.slice(0, 6);
    const offer = rollBoons(s);
    expect(offer).toHaveLength(2);
    expect(offer.every((id) => !s.relics.includes(id))).toBe(true);
  });

  it("只能选当前候选里的卡,选择后清空候选并计数", () => {
    const s = makeState();
    s.boonOffer = ["power", "haste", "lens"];
    expect(chooseRelic(s, "chill")).toBe(false); // 不在候选里
    expect(chooseRelic(s, "power")).toBe(true);
    expect(s.relics).toEqual(["power"]);
    expect(s.boonsTaken).toBe(1);
    expect(s.boonOffer).toBeNull();
    expect(chooseRelic(s, "haste")).toBe(false); // 候选已清空
  });

  it("急救药膏立刻回血并提高上限", () => {
    const s = makeState();
    s.lives = 5;
    s.boonOffer = ["repair"];
    chooseRelic(s, "repair");
    expect(s.maxLives).toBe(11);
    expect(s.lives).toBe(7);
  });

  it("每张卡都有可读的定位描述,不出现原始数值", () => {
    for (const id of RELIC_IDS) {
      const def = RELICS[id];
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.desc.length).toBeGreaterThan(6);
      expect(def.desc).not.toMatch(/\d+%|\d+\.\d/);
    }
  });
});

describe("遗物:效果接入", () => {
  it("力量核心只放大塔伤害倍率,不影响未持有时的基线", () => {
    const s = makeState();
    const t = place(s, "bottle", 5, 1);
    expect(damageMultiplier(s, t)).toBeCloseTo(1, 6);
    s.relics = ["power"];
    expect(damageMultiplier(s, t)).toBeCloseTo(1.18, 6);
    expect(relicDamageMult(s)).toBeCloseTo(1.18, 6);
  });

  it("瞄准镜提高实际射程,超频提高攻速,蓝图降低升级费用", () => {
    const s = makeState({ startGold: 2000 });
    const t = buildTower(s, "bottle", 5, 1);
    if (!t.ok || !t.tower) throw new Error("build failed");
    const range0 = towerRange(s, t.tower);
    const baseCost = nextUpgradeCost("bottle", 1)!;

    s.relics = ["lens", "haste", "discount"];
    expect(towerRange(s, t.tower)).toBeCloseTo(range0 + relicRangeBonus(s), 6);
    expect(relicRateMult(s)).toBeGreaterThan(1);
    expect(relicUpgradeMult(s)).toBeLessThan(1);

    const before = s.gold;
    expect(upgradeTower(s, t.tower.id).ok).toBe(true);
    const paid = before - s.gold;
    expect(paid).toBeLessThan(baseCost);
    expect(paid).toBe(Math.round(baseCost * relicUpgradeMult(s)));
  });

  it("赏金公告让每次击杀多给金币,能量也随击杀累积", () => {
    const s = makeState({ startGold: 3000 });
    place(s, "bottle", 5, 1);
    s.relics = ["bounty"];
    const gold0 = s.gold;
    const e = spawnEnemy(s, "grunt", 5, 0.01); // 1 点血
    expect(e.reward).toBeGreaterThan(0);
    runSteps(s, 1.2);
    expect(s.gold).toBe(gold0 + e.reward + relicKillBonus(s));
    expect(relicKillBonus(s)).toBe(5);
    expect(s.energy).toBeGreaterThanOrEqual(energyPerKill());
  });

  it("萝卜银行在波次结算时按存款发利息", () => {
    const s = makeState();
    s.gold = 1000;
    s.relics = ["interest"];
    prepAfter(s, 2);
    // 已结算 2 波 -> 引擎看到 waveNumber 2 与 clearedWaves 2 相同,手动推进到第 3 波
    s.waves.waveNumber = 3;
    s.waves.prepTimer = 3;
    step(s, STEP);
    expect(s.clearedWaves).toBe(3);
    expect(s.gold).toBeGreaterThan(1000);
  });
});

describe("遗物:波次钩子与暂停", () => {
  it("每清 4 波给一次三选一;候选打开时逻辑时间不再推进", () => {
    const s = makeState({ firstWaveDelay: 30 });
    // 已结算 3 波,正处在第 4 波结束后的准备阶段 -> 本次 step 结算第 4 波
    s.waves.phase = "prep";
    s.waves.waveNumber = BOON_EVERY_WAVES;
    s.clearedWaves = BOON_EVERY_WAVES - 1;
    s.waves.prepTimer = 3;
    step(s, STEP);
    expect(s.boonOffer).not.toBeNull();
    expect(s.boonOffer).toHaveLength(3);

    const t = s.time;
    for (let i = 0; i < 30; i++) step(s, STEP);
    expect(s.time).toBe(t); // 候选期间完全冻结

    pickRelic(s, s.boonOffer![0]);
    step(s, STEP);
    expect(s.time).toBeGreaterThan(t);
    expect(s.boonsTaken).toBe(1);
  });

  it("一局最多 4 件遗物,拿满后不再弹窗", () => {
    const s = makeState();
    s.boonsTaken = 4;
    s.waves.phase = "prep";
    s.waves.waveNumber = 9;
    s.clearedWaves = 8;
    s.waves.prepTimer = 3;
    step(s, STEP);
    expect(s.boonOffer).toBeNull();
  });
});

describe("萝卜冲击波", () => {
  it("能量不足时无法释放", () => {
    const s = makeState();
    expect(activateCarrotSkill(s)).toBe(false);
    expect(s.skillCasts).toBe(0);
  });

  it("满能量释放:清空能量、冻结并伤害普通敌人", () => {
    const s = makeState();
    const e = spawnEnemy(s, "grunt", 5, 100);
    s.energy = 100;
    const hp0 = e.hp;
    expect(activateCarrotSkill(s)).toBe(true);
    expect(s.energy).toBe(0);
    expect(s.skillCasts).toBe(1);
    expect(e.state).toBe("frozen");
    expect(e.hp).toBe(hp0 - 40);
    expect(s.events.some((ev) => ev.type === "skill")).toBe(true);
  });

  it("免疫冻结的 Boss 不会冻住,但会被重度减速", () => {
    const s = makeState();
    const boss = spawnEnemy(s, "boss", 5, 100);
    s.energy = 100;
    activateCarrotSkill(s);
    expect(boss.state).toBe("slowed");
    expect(boss.freezeTimer).toBe(0);
    expect(boss.slowFactor).toBeLessThan(0.7);
  });

  it("能量上限为 100,溢出不会浪费显示", () => {
    const s = makeState();
    addEnergy(s, 500);
    expect(s.energy).toBe(100);
  });

  it("释放后能通过击杀重新充能", () => {
    const s = makeState({ startGold: 3000 });
    place(s, "bottle", 5, 1);
    s.energy = 0;
    spawnEnemy(s, "grunt", 5, 0.01);
    runSteps(s, 1.2);
    expect(s.energy).toBeGreaterThan(0);
  });
});

describe("遗物系统不破坏基础规则", () => {
  it("未持有遗物时,基础升级价格与冷却不变", () => {
    const s = makeState();
    expect(relicUpgradeMult(s)).toBe(1);
    expect(relicDamageMult(s)).toBe(1);
    expect(relicRateMult(s)).toBe(1);
    expect(relicRangeBonus(s)).toBeLessThan(0.001);
    expect(hasRelic(s, "power")).toBe(false);
  });

  it("减速叠加不会让敌人倒着走,致命伤后只进入死亡流程", () => {
    const path = createPath([{ x: 0.5, y: 0.5 }, { x: 10.5, y: 0.5 }]);
    const e = createEnemy(1, "grunt", path, 0);
    e.state = "moving";
    let last = 0;
    for (let i = 0; i < 300; i++) {
      updateEnemy(e, STEP);
      expect(e.distance).toBeGreaterThanOrEqual(last);
      last = e.distance;
    }
    expect(e.state).not.toBe("leaked");
    expect(damageEnemy(e, 99999)).toBe(true);
    expect(e.state).toBe("dying");
    for (let i = 0; i < 30; i++) updateEnemy(e, STEP);
    expect(e.state).toBe("dead");
  });

  it("遗物候选永远只包含已知 id", () => {
    const s = makeState();
    const known = new Set<string>(RELIC_IDS);
    for (let i = 0; i < 30; i++) {
      s.relics = [];
      s.rngState = 1000 + i;
      for (const id of rollBoons(s) as RelicId[]) expect(known.has(id)).toBe(true);
    }
  });
});
