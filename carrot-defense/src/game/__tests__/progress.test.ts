import { describe, expect, it } from "vitest";
import { LEVELS } from "../levels";
import {
  CLASSIC_COUNT,
  clearedCount,
  frontierLevelId,
  goldenCount,
  isClassicCleared,
  isLevelUnlocked,
  skipClassic,
  skipThrough,
} from "../progress";

describe("关卡解锁进度", () => {
  it("第 1 关始终开放,其余需通关前一关", () => {
    expect(isLevelUnlocked({}, 1)).toBe(true);
    expect(isLevelUnlocked({}, 2)).toBe(false);
    expect(isLevelUnlocked({}, 13)).toBe(false);
    expect(isLevelUnlocked({ 1: 3 }, 2)).toBe(true);
    expect(isLevelUnlocked({ 1: 3 }, 3)).toBe(false);
    expect(isLevelUnlocked({ 1: 1, 2: 2, 3: 3 }, 4)).toBe(true);
  });

  it("统计已通关 / 金萝卜数量与当前进度关卡", () => {
    const best = { 1: 3, 2: 2, 3: 3, 4: 1 };
    expect(clearedCount(best)).toBe(4);
    expect(goldenCount(best)).toBe(2);
    expect(frontierLevelId(best)).toBe(5);
    expect(frontierLevelId({})).toBe(1);
    const all: Record<number, number> = {};
    for (const l of LEVELS) all[l.id] = 3;
    expect(clearedCount(all)).toBe(LEVELS.length);
    expect(frontierLevelId(all)).toBe(LEVELS.length);
  });

  it("跳过第一章解锁第 14 关,已有评价不被覆盖", () => {
    const skipped = skipClassic({ 1: 3, 5: 2 });
    expect(skipped[1]).toBe(3);
    expect(skipped[5]).toBe(2);
    expect(skipped[2]).toBe(1);
    expect(skipped[CLASSIC_COUNT]).toBe(1);
    expect(isClassicCleared(skipped)).toBe(true);
    expect(isLevelUnlocked(skipped, CLASSIC_COUNT + 1)).toBe(true);
    expect(frontierLevelId(skipped)).toBe(CLASSIC_COUNT + 1);
  });

  it("跳过到指定关卡会解锁其前面的所有关", () => {
    const best = skipThrough({}, 20);
    expect(isLevelUnlocked(best, 21)).toBe(true);
    expect(isLevelUnlocked(best, 22)).toBe(false);
    expect(best[20]).toBe(1);
  });
});
