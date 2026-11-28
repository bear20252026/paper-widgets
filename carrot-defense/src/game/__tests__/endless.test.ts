import { describe, expect, it } from "vitest";
import { STEP } from "../constants";
import {
  AFFIXES,
  AFFIX_ORDER,
  ENDLESS_TOTAL_WAVES,
  affixForWave,
  applyAffix,
  createEndlessLevel,
} from "../endless";
import { createEnemy } from "../enemy";
import { createGameState, step } from "../engine";
import { createPath } from "../path";
import { runBot } from "./bot";

describe("无尽模式:关卡生成", () => {
  it("生成 60 波,编号连续,每波都有出怪", () => {
    const level = createEndlessLevel(7);
    expect(level.waves).toHaveLength(ENDLESS_TOTAL_WAVES);
    expect(level.waves.every((w) => w.groups.length > 0)).toBe(true);
    expect(level.waves.every((w) => w.groups.every((g) => g.count > 0))).toBe(true);
  });

  it("地图字段完整(可被引擎直接使用)", () => {
    const level = createEndlessLevel(1);
    expect(level.cols).toBeGreaterThanOrEqual(12);
    expect(level.rows).toBeGreaterThanOrEqual(8);
    expect(level.waypoints.length).toBeGreaterThanOrEqual(1);
    expect(level.firstWaveDelay).toBeGreaterThan(0);
    const s = createGameState(level);
    expect(s.paths.length).toBe(level.waypoints.length);
    expect(s.status).toBe("playing");
    expect(s.lives).toBe(10);
    expect(s.level.id).toBe(999);
  });

  it("难度递增:后期波的血量与数量都高于前期", () => {
    const level = createEndlessLevel(3);
    const hpAt = (i: number) => level.waves[i].groups[0].hpScale ?? 1;
    const countAt = (i: number) => level.waves[i].groups[0].count;
    expect(hpAt(50)).toBeGreaterThan(hpAt(5) * 3);
    expect(countAt(50)).toBeGreaterThan(countAt(0));
  });

  it("每 5 波标记为 Boss 波,20 波后双 Boss;Boss 血量随波数增长", () => {
    const level = createEndlessLevel(2);
    level.waves.forEach((w, i) => {
      expect(Boolean(w.boss)).toBe((i + 1) % 5 === 0);
      if (w.boss) {
        // Boss 波一定有一个延迟入场的高血单位
        const bossGroups = w.groups.filter((g) => (g.delay ?? 0) >= 3 && (g.interval ?? 0) >= 7);
        expect(bossGroups.length).toBeGreaterThanOrEqual(1);
        if (i + 1 >= 20) expect(bossGroups[0].count).toBe(2);
      }
    });
    const firstBoss = level.waves[4].groups.find((g) => (g.interval ?? 0) >= 7 && (g.delay ?? 0) >= 3)!;
    const lastBoss = level.waves[ENDLESS_TOTAL_WAVES - 1].groups.find((g) => (g.interval ?? 0) >= 7 && (g.delay ?? 0) >= 3)!;
    expect(lastBoss.hpScale!).toBeGreaterThan(firstBoss.hpScale!);
  });

  it("同一个种子生成同一张图,不同种子会不同", () => {
    const a = createEndlessLevel(3);
    const b = createEndlessLevel(3);
    const c = createEndlessLevel(9);
    expect(a.waypoints).toEqual(b.waypoints);
    expect(a.waves.map((w) => w.affix)).toEqual(b.waves.map((w) => w.affix));
    expect(c.waypoints).not.toEqual(a.waypoints);
  });
});

describe("无尽模式:波次词缀", () => {
  it("前两波没有词缀,第 3 波起每波都有,且取值合法", () => {
    expect(affixForWave(1)).toBeUndefined();
    expect(affixForWave(2)).toBeUndefined();
    for (let n = 3; n <= ENDLESS_TOTAL_WAVES; n++) {
      expect(AFFIX_ORDER).toContain(affixForWave(n, 4));
    }
  });

  it("同一个 (波数, 种子) 永远得到同一个词缀", () => {
    for (let n = 3; n < 40; n++) {
      expect(affixForWave(n, 5)).toBe(affixForWave(n, 5));
    }
  });

  it("足够多的波里六种词缀都会出现", () => {
    const seen = new Set<string>();
    for (let n = 3; n <= ENDLESS_TOTAL_WAVES; n++) seen.add(affixForWave(n, 1)!);
    expect(seen.size).toBe(AFFIX_ORDER.length);
  });

  it("疾行提高移速、重甲加护甲、巨化加血加赏金、再生带回血", () => {
    const path = createPath([{ x: 0.5, y: 0.5 }, { x: 10.5, y: 0.5 }]);
    const base = createEnemy(1, "grunt", path, 0);

    const swift = createEnemy(1, "grunt", path, 0);
    applyAffix(swift, "swift");
    expect(swift.baseSpeed).toBeGreaterThan(base.baseSpeed);

    const armored = createEnemy(1, "grunt", path, 0);
    applyAffix(armored, "armored");
    expect(armored.armor).toBeGreaterThan(base.armor);

    const giant = createEnemy(1, "grunt", path, 0);
    applyAffix(giant, "giant");
    expect(giant.maxHp).toBeGreaterThan(base.maxHp);
    expect(giant.reward).toBeGreaterThan(base.reward);
    expect(giant.radius).toBeGreaterThan(base.radius);

    const regen = createEnemy(1, "grunt", path, 0);
    applyAffix(regen, "regen");
    expect(regen.healPerSec).toBeGreaterThan(0);

    const weaker = createEnemy(1, "grunt", path, 0);
    applyAffix(weaker, "bounty");
    expect(weaker.maxHp).toBeLessThan(base.maxHp);
    expect(weaker.reward).toBeGreaterThan(base.reward);
  });

  it("词缀为空时实体完全不变", () => {
    const path = createPath([{ x: 0.5, y: 0.5 }, { x: 10.5, y: 0.5 }]);
    const a = createEnemy(1, "grunt", path, 0);
    const b = createEnemy(1, "grunt", path, 0);
    applyAffix(b, undefined);
    expect(b).toEqual(a);
  });

  it("每条词缀都有中文说明与图标,且说明不堆原始小数", () => {
    for (const id of AFFIX_ORDER) {
      const a = AFFIXES[id];
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.desc.length).toBeGreaterThan(5);
      expect(a.icon.length).toBeGreaterThan(0);
      expect(a.desc).not.toMatch(/\d+\.\d/);
    }
  });
});

describe("无尽模式:引擎接入", () => {
  it("带词缀的波次出怪时,敌人真的被强化", () => {
    const level = createEndlessLevel(1);
    // 找一个带「巨化」的波次,强制跳到它
    const waveIdx = level.waves.findIndex((w) => w.affix === "giant");
    expect(waveIdx).toBeGreaterThanOrEqual(0);
    const s = createGameState(level);
    s.waves.waveNumber = waveIdx; // 引擎下一次更新会开这一波
    s.waves.phase = "prep";
    s.waves.prepTimer = 0;
    for (let i = 0; i < 40; i++) step(s, STEP);
    expect(s.enemies.length).toBeGreaterThan(0);
    const normalMax = s.enemies[0].maxHp;
    const rawHp = s.level.waves[waveIdx].groups[0].hpScale ?? 1;
    // 词缀把血量放大了 1.5 倍(至少明显高于基础缩放)
    const gruntBase = 50;
    expect(normalMax).toBeGreaterThan(Math.round(gruntBase * rawHp));
  });

  it("无尽模式开局无遗物,能量为 0,波次从 0 开始", () => {
    const s = createGameState(createEndlessLevel(2));
    expect(s.relics).toEqual([]);
    expect(s.energy).toBe(0);
    expect(s.waves.waveNumber).toBe(0);
    expect(s.waves.totalWaves).toBe(ENDLESS_TOTAL_WAVES);
  });

  it("机器人能推进到相当靠后的波次(不会开局即崩)", () => {
    const result = runBot(createGameState(createEndlessLevel(5)), {}, 600);
    expect(result.wave).toBeGreaterThanOrEqual(6);
  }, 120_000);
});
