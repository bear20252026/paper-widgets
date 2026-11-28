import { describe, expect, it } from "vitest";
import { createGameState } from "../engine";
import { LEVELS } from "../levels";
import { runBot } from "./bot";

/**
 * 机器人是一个「会换位思考但不完美」的玩家代理:按覆盖度选址、均衡升级、空闲时清障。
 * 它比普通玩家反应快,但不会针对波次换塔,所以它的表现可以当作难度下限。
 */
describe("平衡性(机器人试玩)", () => {
  const results: Array<{ id: number; name: string; status: string }> = [];

  it("100 关全部试玩:通关率 ≥ 95%,失败的关在充足预算下仍可通关(无死关)", () => {
    for (const level of LEVELS) {
      const r = runBot(createGameState(level), {}, 900);
      results.push({ id: level.id, name: level.name, status: r.status });
    }
    const lost = results.filter((r) => r.status !== "won");
    console.log(
      `[bot] ${results.length - lost.length}/${results.length} 通关` +
        (lost.length ? " | 失败: " + lost.map((l) => `L${l.id}${l.name}`).join(", ") : ""),
    );
    expect(lost.length).toBeLessThanOrEqual(5);

    // 关键保证:机器人打不过的关,给足预算仍能通关 -> 地图与波次组合不是无解的
    for (const l of lost) {
      const level = LEVELS[l.id - 1];
      const s = createGameState(level);
      s.gold = 6000;
      const r = runBot(s, { maxTowers: 30 }, 1500);
      expect(r.status, `L${l.id} ${l.name} 在充足预算下仍然失败,可能是死关`).toBe("won");
    }
  }, 300_000);

  it("不建任何塔必然失败(抽查每 8 关一次)", () => {
    for (const level of LEVELS.filter((_, i) => i % 8 === 0)) {
      const r = runBot(createGameState(level), { maxTowers: 0, clearObstacles: false }, 900);
      expect(r.status, `L${level.id} ${level.name} 不建塔也不该通关`).toBe("lost");
    }
  }, 120_000);

  it("难度随进度上升:后期波数与敌人血量成长高于前期", () => {
    const early = LEVELS.slice(0, 20);
    const late = LEVELS.slice(-20);
    const waveAvg = (ls: typeof LEVELS) => ls.reduce((a, l) => a + l.waves.length, 0) / ls.length;
    const hpAvg = (ls: typeof LEVELS) =>
      ls.reduce((a, l) => {
        const g = l.waves[l.waves.length - 1].groups[0];
        return a + (g.hpScale ?? 1);
      }, 0) / ls.length;
    expect(waveAvg(late)).toBeGreaterThan(waveAvg(early));
    expect(hpAvg(late)).toBeGreaterThan(hpAvg(early) * 1.5);
  });

  it("每章都有 25 关,且每章末关比章首更难", () => {
    for (const ch of [1, 2, 3, 4] as const) {
      const lv = LEVELS.filter((l) => l.chapter === ch);
      expect(lv).toHaveLength(25);
      const first = lv[0];
      const last = lv[lv.length - 1];
      expect(last.waves.length).toBeGreaterThanOrEqual(first.waves.length);
    }
  });
});
