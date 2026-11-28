/**
 * 展示层元数据:把枯燥的数值换算成"定位标签 + 五点强度",
 * 让玩家不用读 `100/150/250` 这种原始参数也能一眼看懂一座塔。
 */
import { TOWER_DEFS, buildCost, getLevelStats } from "./towerDefs";
import type { TowerKind } from "./types";

/** 定位:决定卡片配色与图标,比数字更快被识别。 */
export type TowerRole = "single" | "splash" | "pierce" | "control" | "support" | "economy" | "buff";

export interface RoleStyle {
  label: string;
  icon: string;
  /** 卡面主色(十六进制,渲染与 UI 共用) */
  color: string;
  text: string;
}

export const ROLE_STYLE: Record<TowerRole, RoleStyle> = {
  single: { label: "单体", icon: "🎯", color: "#4fc3f7", text: "打单个目标,点杀厚血" },
  splash: { label: "范围", icon: "💥", color: "#ff8a65", text: "一发炸一片,清群怪" },
  pierce: { label: "穿透", icon: "➿", color: "#ffd54f", text: "一次打中一串敌人" },
  control: { label: "控制", icon: "🧊", color: "#b39ddb", text: "减速/冻结/毒,拖住敌人" },
  support: { label: "防空", icon: "🛩️", color: "#81d4fa", text: "专门应对空中目标" },
  economy: { label: "经济", icon: "💰", color: "#ffc107", text: "不攻击,持续产金币" },
  buff: { label: "增幅", icon: "🔮", color: "#b388ff", text: "提升周围炮塔的伤害" },
};

export type AirMode = "both" | "groundOnly" | "airOnly";

export interface TowerMeta {
  role: TowerRole;
  air: AirMode;
  /** 一句话卖点,替代长段参数说明 */
  pitch: string;
}

export const TOWER_META: Record<TowerKind, TowerMeta> = {
  bottle: { role: "single", air: "both", pitch: "万金油快枪,满级 0.25 秒一发" },
  arrow: { role: "single", air: "both", pitch: "最便宜,升级后一次射三箭" },
  cannon: { role: "splash", air: "groundOnly", pitch: "慢但重,一炮炸翻一堆" },
  sniper: { role: "single", air: "both", pitch: "射程最远,专点胖子和 Boss" },
  spike: { role: "single", air: "groundOnly", pitch: "贴着路放,高频戳穿经过的怪" },
  fan: { role: "pierce", air: "both", pitch: "一条直线全打穿" },
  sunflower: { role: "splash", air: "groundOnly", pitch: "绕身光环,顺手清障碍" },
  tesla: { role: "pierce", air: "both", pitch: "闪电在怪群里连跳,克制虫群" },
  laser: { role: "pierce", air: "both", pitch: "几乎不停火的持续灼烧" },
  mortar: { role: "splash", air: "groundOnly", pitch: "全场最大爆炸圈" },
  moon: { role: "control", air: "groundOnly", pitch: "范围减速,给输出塔争取时间" },
  star: { role: "control", air: "both", pitch: "概率冻住敌人(Boss 免疫)" },
  poison: { role: "control", air: "groundOnly", pitch: "毒素持续掉血,专治铁甲" },
  rocket: { role: "support", air: "airOnly", pitch: "只打飞行,但对空无敌" },
  goldmine: { role: "economy", air: "groundOnly", pitch: "前期投资,后期钱花不完" },
  crossbow: { role: "single", air: "both", pitch: "全场最快的连射,满级三连发" },
  railgun: { role: "pierce", air: "both", pitch: "一炮贯穿整条直线,单发最痛" },
  flame: { role: "control", air: "groundOnly", pitch: "近身火焰,边烧边打" },
  boomerang: { role: "pierce", air: "both", pitch: "飞镖来回弹,敌人越密越赚" },
  tornado: { role: "splash", air: "both", pitch: "风暴范围伤害,顺带吹慢" },
  frostpillar: { role: "control", air: "both", pitch: "范围永久冻慢,不打伤害" },
  minefield: { role: "splash", air: "groundOnly", pitch: "踩雷即炸,守窄路神器" },
  prism: { role: "single", air: "both", pitch: "同时锁定多达 4 个目标" },
  bank: { role: "economy", air: "groundOnly", pitch: "产金是金矿的两倍多" },
  obelisk: { role: "buff", air: "both", pitch: "给周围炮塔加最多 +70% 伤害" },
  shotgun: { role: "splash", air: "groundOnly", pitch: "近距离多弹,越近越痛" },
  grenade: { role: "splash", air: "groundOnly", pitch: "高弹道大范围爆炸" },
  cutter: { role: "pierce", air: "both", pitch: "持续切割直线,全路覆盖" },
  magnet: { role: "control", air: "groundOnly", pitch: "吸引敌人聚集,便于集火" },
  medic: { role: "support", air: "groundOnly", pitch: "治疗友军炮塔,延长寿命" },
  siege: { role: "single", air: "both", pitch: "超远程巨大伤害,专打厚血" },
  trap: { role: "splash", air: "groundOnly", pitch: "触发即炸,守窄路神器" },
  sonic: { role: "control", air: "both", pitch: "音波击退,拖慢推进" },
  chrono: { role: "control", air: "both", pitch: "范围慢化,配合输出塔" },
  nuke: { role: "splash", air: "groundOnly", pitch: "极高伤害超大范围,冷却极长" },
};

/** 五点强度条的四个维度。 */
export interface TowerPower {
  damage: number; // 1..5 满级单发伤害
  range: number; // 1..5 满级射程
  speed: number; // 1..5 满级攻速
  area: number; // 1..5 覆盖面(溅射/穿透/连锁)
  dps: number; // 满级理论 DPS,仅在"详细"里展示
}

function scale(value: number, min: number, max: number): number {
  if (max <= min) return 3;
  const t = (value - min) / (max - min);
  return Math.max(1, Math.min(5, Math.round(1 + t * 4)));
}

/** 覆盖面:溅射半径 / 射线长度 / 连锁数 / 多发,统一折算成一个可比的数。 */
function areaScore(kind: TowerKind): number {
  const s = getLevelStats(kind, 3);
  const def = TOWER_DEFS[kind];
  if (def.attack === "idle") return 0;
  let score = 0;
  if (s.splash) score += s.splash * 2.2;
  if (s.chain) score += (s.chain - 1) * 0.9;
  if (s.shots && s.shots > 1) score += (s.shots - 1) * 0.8;
  if (def.attack === "beam") score += 1.6 + (s.beamWidth ?? 0) * 2;
  if (def.attack === "pulse") score += s.range * 0.8;
  return score;
}

const ATTACK_KINDS = (Object.keys(TOWER_DEFS) as TowerKind[]).filter(
  (k) => TOWER_DEFS[k].attack !== "idle",
);

const BOUNDS = (() => {
  const dmg = ATTACK_KINDS.map((k) => getLevelStats(k, 3).damage);
  const rng = ATTACK_KINDS.map((k) => getLevelStats(k, 3).range);
  const spd = ATTACK_KINDS.map((k) => 1 / getLevelStats(k, 3).cooldown);
  const area = ATTACK_KINDS.map(areaScore);
  const span = (a: number[]) => ({ min: Math.min(...a), max: Math.max(...a) });
  return { dmg: span(dmg), rng: span(rng), spd: span(spd), area: span(area) };
})();

export function towerPower(kind: TowerKind): TowerPower {
  const s = getLevelStats(kind, 3);
  if (TOWER_DEFS[kind].attack === "idle") {
    return { damage: 0, range: 0, speed: 0, area: 0, dps: 0 };
  }
  return {
    damage: scale(s.damage, BOUNDS.dmg.min, BOUNDS.dmg.max),
    range: scale(s.range, BOUNDS.rng.min, BOUNDS.rng.max),
    speed: scale(1 / s.cooldown, BOUNDS.spd.min, BOUNDS.spd.max),
    area: areaScore(kind) <= 0 ? 1 : scale(areaScore(kind), BOUNDS.area.min, BOUNDS.area.max),
    dps: Math.round(s.damage / s.cooldown),
  };
}

/** 建造价的"性价比"档位,用于卡片上的价格色标。 */
export function costTier(kind: TowerKind): "cheap" | "mid" | "pricey" {
  const c = buildCost(kind);
  if (c <= 140) return "cheap";
  if (c <= 230) return "mid";
  return "pricey";
}

export const AIR_LABEL: Record<AirMode, { short: string; full: string; cls: string }> = {
  both: { short: "空地", full: "对空 + 对地", cls: "bg-sky-500 text-sky-950" },
  groundOnly: { short: "地面", full: "只能打地面", cls: "bg-stone-500 text-stone-100" },
  airOnly: { short: "仅空", full: "只能打飞行", cls: "bg-indigo-500 text-indigo-50" },
};

export function airModeOf(kind: TowerKind): AirMode {
  return TOWER_META[kind].air;
}
