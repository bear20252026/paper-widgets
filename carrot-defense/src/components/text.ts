import type { FailReason } from "../game/economy";
import type { Difficulty } from "../game/types";

export const REASON_TEXT: Record<FailReason, string> = {
  game_over: "游戏已结束",
  out_of_bounds: "超出地图范围",
  not_buildable: "这里不能建造",
  obstacle: "先清除障碍物(点击障碍物锁定攻击)",
  occupied: "这里已有炮塔",
  insufficient_gold: "金币不足",
  max_level: "已经是满级",
  no_tower: "炮塔不存在",
};

export const RATING_INFO: Record<number, { label: string; short: string; cls: string; ring: string }> = {
  3: {
    label: "金萝卜",
    short: "金",
    cls: "bg-gradient-to-b from-amber-200 to-amber-500 text-amber-950",
    ring: "#ffc53d",
  },
  2: {
    label: "银萝卜",
    short: "银",
    cls: "bg-gradient-to-b from-slate-100 to-slate-400 text-slate-800",
    ring: "#cfd8dc",
  },
  1: {
    label: "铜萝卜",
    short: "铜",
    cls: "bg-gradient-to-b from-orange-300 to-orange-700 text-orange-950",
    ring: "#e08a3c",
  },
};

export const DIFFICULTY_CLS: Record<Difficulty, string> = {
  简单: "bg-lime-400 text-lime-950 border-lime-700",
  普通: "bg-sky-400 text-sky-950 border-sky-700",
  困难: "bg-orange-400 text-orange-950 border-orange-700",
  噩梦: "bg-rose-500 text-rose-50 border-rose-900",
  地狱: "bg-red-700 text-red-50 border-black",
};

/** 萝卜评价图标串:满 3 颗星表示评价等级。 */
export function ratingStars(rating: number): string {
  return "★".repeat(Math.max(rating, 0)) + "☆".repeat(Math.max(3 - rating, 0));
}
