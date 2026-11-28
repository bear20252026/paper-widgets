import { CLASSIC_COUNT, LEVELS } from "./levels";

export type BestRatings = Record<number, number>;

/** 第一章关卡数。 */
export { CLASSIC_COUNT };
export const CHAPTERS = [1, 2, 3, 4] as const;
export type Chapter = (typeof CHAPTERS)[number];

export const CHAPTER_INFO: Record<Chapter, { name: string; sub: string }> = {
  1: { name: "第一章 · 青草地", sub: "1–25 关 · 入门" },
  2: { name: "第二章 · 新大陆", sub: "26–50 关 · 进阶" },
  3: { name: "第三章 · 深渊远征", sub: "51–75 关 · 高难" },
  4: { name: "第四章 · 末日余烬", sub: "76–100 关 · 地狱" },
};

/**
 * 关卡是否可进入。
 * freeSelect 打开时全部开放(自由选关);否则通关前一关才解锁。
 */
export function isLevelUnlocked(
  best: BestRatings,
  levelId: number,
  freeSelect = false,
): boolean {
  if (freeSelect) return true;
  if (levelId <= 1) return true;
  return (best[levelId - 1] ?? 0) > 0;
}

export function clearedCount(best: BestRatings): number {
  return LEVELS.filter((l) => (best[l.id] ?? 0) > 0).length;
}

export function goldenCount(best: BestRatings): number {
  return LEVELS.filter((l) => best[l.id] === 3).length;
}

export function frontierLevelId(best: BestRatings): number {
  for (const l of LEVELS) {
    if ((best[l.id] ?? 0) === 0) return l.id;
  }
  return LEVELS[LEVELS.length - 1].id;
}

/** 把 1..upto 标为至少铜萝卜,从而解锁后面的关。已有更高评价不覆盖。 */
export function skipThrough(best: BestRatings, upto: number): BestRatings {
  const next = { ...best };
  const last = Math.min(Math.max(upto, 0), LEVELS.length);
  for (let i = 1; i <= last; i++) {
    if ((next[i] ?? 0) < 1) next[i] = 1;
  }
  return next;
}

export function skipClassic(best: BestRatings): BestRatings {
  return skipThrough(best, CLASSIC_COUNT);
}

export function isClassicCleared(best: BestRatings): boolean {
  return (best[CLASSIC_COUNT] ?? 0) > 0;
}

export function chapterLevels(chapter: Chapter) {
  return LEVELS.filter((l) => l.chapter === chapter);
}

/** 某章第一关的 id,用于章节跳转。 */
export function chapterStart(chapter: Chapter): number {
  return chapterLevels(chapter)[0]?.id ?? 1;
}

/** 每章进度统计。 */
export function chapterProgress(best: BestRatings, chapter: Chapter) {
  const levels = chapterLevels(chapter);
  const cleared = levels.filter((l) => (best[l.id] ?? 0) > 0).length;
  const gold = levels.filter((l) => best[l.id] === 3).length;
  return { total: levels.length, cleared, gold };
}
