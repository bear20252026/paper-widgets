import { MAX_LIVES } from "./constants";
import { nextRandom } from "./rng";
import type { GameState, RelicId } from "./types";

/** 一局最多拿几次遗物(每 4 波一次)。 */
export const MAX_BOONS = 4;
/** 每清完几波给一次三选一。 */
export const BOON_EVERY_WAVES = 4;
/** 大招所需能量。 */
export const SKILL_COST = 100;

export interface RelicDef {
  id: RelicId;
  name: string;
  icon: string;
  /** 一句话卖点(不展示原始数值) */
  desc: string;
  /** 卡面主色 */
  color: string;
}

/**
 * 遗物是「改变构筑方向」的永久增益,不是简单的数值叠加:
 * 攻击/攻速/射程/经济/控制/折扣,每种都指向不同的打法。
 */
export const RELICS: Record<RelicId, RelicDef> = {
  power: {
    id: "power", name: "力量核心", icon: "🔺", color: "#ff7043",
    desc: "所有炮塔伤害大幅提升,适合堆单体爆发",
  },
  haste: {
    id: "haste", name: "超频芯片", icon: "⚡", color: "#4fc3f7",
    desc: "所有炮塔开火更快,适合高频与连续伤害",
  },
  lens: {
    id: "lens", name: "高倍瞄准镜", icon: "🔭", color: "#ba68c8",
    desc: "所有炮塔射程变长,能提前拦下敌人",
  },
  bounty: {
    id: "bounty", name: "赏金公告", icon: "📜", color: "#ffca28",
    desc: "每次击杀额外获得金币,滚雪球更快",
  },
  interest: {
    id: "interest", name: "萝卜银行", icon: "🏦", color: "#81c784",
    desc: "每波结束时按存款获得利息,鼓励攒钱",
  },
  repair: {
    id: "repair", name: "急救药膏", icon: "🩹", color: "#f06292",
    desc: "立刻修复萝卜,并提高生命上限",
  },
  chill: {
    id: "chill", name: "极寒力场", icon: "🧊", color: "#80deea",
    desc: "全场敌人持续减速,防线更从容",
  },
  discount: {
    id: "discount", name: "工程蓝图", icon: "📐", color: "#a1887f",
    desc: "炮塔升级费用降低,更快成型",
  },
};

export const RELIC_IDS = Object.keys(RELICS) as RelicId[];

export function hasRelic(state: GameState, id: RelicId): boolean {
  return state.relics.includes(id);
}

/** 遗物带来的伤害倍率。 */
export function relicDamageMult(state: GameState): number {
  return hasRelic(state, "power") ? 1.18 : 1;
}

/** 遗物带来的攻速倍率(作用于冷却,越大越快)。 */
export function relicRateMult(state: GameState): number {
  return hasRelic(state, "haste") ? 1.16 : 1;
}

/** 遗物带来的额外射程(格)。 */
export function relicRangeBonus(state: GameState): number {
  return hasRelic(state, "lens") ? 0.4 : 1e-9;
}

/** 每次击杀的额外金币。 */
export function relicKillBonus(state: GameState): number {
  return hasRelic(state, "bounty") ? 5 : 0;
}

/** 升级费用的折扣系数。 */
export function relicUpgradeMult(state: GameState): number {
  return hasRelic(state, "discount") ? 0.8 : 1;
}

/**
 * 抽取三张不重复的遗物卡。使用状态内的种子随机数,因此同一次抽取可复现。
 * 已拥有的遗物不会再次出现;不够三张时按剩余数量返回。
 */
export function rollBoons(state: GameState): RelicId[] {
  const pool = RELIC_IDS.filter((id) => !state.relics.includes(id));
  const picked: RelicId[] = [];
  // 部分 Fisher–Yates:只洗出需要的三张
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const j = Math.floor(nextRandom(state) * pool.length);
    picked.push(pool[j]);
    pool.splice(j, 1);
  }
  return picked;
}

/** 选择遗物。返回是否成功(选中的必须在当前候选里)。 */
export function chooseRelic(state: GameState, id: RelicId): boolean {
  if (!state.boonOffer || !state.boonOffer.includes(id)) return false;
  if (state.relics.includes(id)) return false;
  state.relics.push(id);
  state.boonsTaken += 1;
  state.boonOffer = null;
  if (id === "repair") {
    state.maxLives = Math.min(MAX_LIVES + 5, state.maxLives + 1);
    state.lives = Math.min(state.maxLives, state.lives + 2);
  }
  return true;
}

/** 击杀获得的能量。 */
export function energyPerKill(): number {
  return 8;
}

export function addEnergy(state: GameState, amount: number): void {
  if (amount <= 0) return;
  state.energy = Math.min(SKILL_COST, state.energy + amount);
}

export function canCastSkill(state: GameState): boolean {
  return state.status === "playing" && state.energy >= SKILL_COST && state.boonOffer === null;
}
