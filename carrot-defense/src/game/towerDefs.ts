import { MAX_TOWER_LEVEL, SELL_RATE } from "./constants";
import type { TowerKind } from "./types";

export type AttackMode = "projectile" | "beam" | "pulse" | "chain" | "idle" | "aura";

export interface TowerLevelStats {
  /** 到达该等级所需金币(1 级 = 建造价) */
  cost: number;
  damage: number;
  range: number; // 格
  cooldown: number; // 秒
  splash?: number;
  beamWidth?: number;
  projectileSpeed?: number;
  slowFactor?: number;
  slowDuration?: number;
  freezeChance?: number;
  freezeDuration?: number;
  shots?: number; // 连发/分裂箭数量
  chain?: number; // 闪电跳跃次数(含首次)
  poisonDps?: number;
  poisonDuration?: number;
  goldPerTick?: number; // 金矿每次产出
  buffDamage?: number;  // 光环:给范围内友方塔的伤害加成(0.25 = +25%)
  auraSlow?: number;    // 光环:持续减速系数(0.6 = 降到 60% 速度)
}

export interface TowerDef {
  kind: TowerKind;
  name: string;
  icon: string;
  desc: string;
  attack: AttackMode;
  canHitAir: boolean;
  airOnly?: boolean;
  levels: TowerLevelStats[];
}

export const TOWER_DEFS: Record<TowerKind, TowerDef> = {
  bottle: {
    kind: "bottle",
    name: "瓶子炮",
    icon: "🍼",
    desc: "单体快速攻击,可对空。满级攻速 0.25 秒",
    attack: "projectile",
    canHitAir: true,
    levels: [
      { cost: 100, damage: 12, range: 2.6, cooldown: 0.6, projectileSpeed: 10 },
      { cost: 150, damage: 18, range: 2.9, cooldown: 0.4, projectileSpeed: 10 },
      { cost: 250, damage: 28, range: 3.2, cooldown: 0.25, projectileSpeed: 10 },
    ],
  },
  fan: {
    kind: "fan",
    name: "风扇",
    icon: "🌀",
    desc: "直线穿透射线,同时打中路径上的多个敌人,可对空",
    attack: "beam",
    canHitAir: true,
    levels: [
      { cost: 200, damage: 16, range: 3.0, cooldown: 1.0, beamWidth: 0.4 },
      { cost: 200, damage: 24, range: 3.4, cooldown: 0.85, beamWidth: 0.5 },
      { cost: 300, damage: 36, range: 3.8, cooldown: 0.7, beamWidth: 0.6 },
    ],
  },
  sunflower: {
    kind: "sunflower",
    name: "太阳花",
    icon: "🌻",
    desc: "以自身为中心的范围伤害,清群怪和障碍物。打不到飞行怪",
    attack: "pulse",
    canHitAir: false,
    levels: [
      { cost: 180, damage: 9, range: 1.7, cooldown: 0.8 },
      { cost: 180, damage: 15, range: 2.0, cooldown: 0.7 },
      { cost: 260, damage: 24, range: 2.3, cooldown: 0.6 },
    ],
  },
  moon: {
    kind: "moon",
    name: "月亮",
    icon: "🌙",
    desc: "范围减速,伤害很低。减速程度与时长随等级提升,打不到飞行怪",
    attack: "projectile",
    canHitAir: false,
    levels: [
      { cost: 120, damage: 4, range: 2.4, cooldown: 1.0, splash: 1.0, projectileSpeed: 7, slowFactor: 0.65, slowDuration: 1.8 },
      { cost: 120, damage: 7, range: 2.7, cooldown: 0.9, splash: 1.2, projectileSpeed: 7, slowFactor: 0.5, slowDuration: 2.2 },
      { cost: 180, damage: 11, range: 3.0, cooldown: 0.8, splash: 1.4, projectileSpeed: 7, slowFactor: 0.38, slowDuration: 2.6 },
    ],
  },
  star: {
    kind: "star",
    name: "冰冻星",
    icon: "❄️",
    desc: "命中有概率冻结敌人(Boss/法师免疫),可对空。造价较高",
    attack: "projectile",
    canHitAir: true,
    levels: [
      { cost: 250, damage: 14, range: 2.8, cooldown: 1.1, projectileSpeed: 8, freezeChance: 0.22, freezeDuration: 1.2 },
      { cost: 220, damage: 22, range: 3.1, cooldown: 0.95, projectileSpeed: 8, freezeChance: 0.3, freezeDuration: 1.6 },
      { cost: 300, damage: 34, range: 3.4, cooldown: 0.8, projectileSpeed: 8, freezeChance: 0.4, freezeDuration: 2.0 },
    ],
  },
  arrow: {
    kind: "arrow",
    name: "箭塔",
    icon: "🏹",
    desc: "廉价对空塔。2 级双箭,3 级三箭,适合铺场",
    attack: "projectile",
    canHitAir: true,
    levels: [
      { cost: 80, damage: 8, range: 2.5, cooldown: 0.7, projectileSpeed: 11, shots: 1 },
      { cost: 110, damage: 11, range: 2.8, cooldown: 0.6, projectileSpeed: 11, shots: 2 },
      { cost: 160, damage: 15, range: 3.1, cooldown: 0.5, projectileSpeed: 12, shots: 3 },
    ],
  },
  cannon: {
    kind: "cannon",
    name: "加农炮",
    icon: "💣",
    desc: "高伤害溅射炮弹,攻速慢,打不到飞行怪",
    attack: "projectile",
    canHitAir: false,
    levels: [
      { cost: 220, damage: 28, range: 2.8, cooldown: 1.4, splash: 0.85, projectileSpeed: 7 },
      { cost: 200, damage: 42, range: 3.1, cooldown: 1.25, splash: 1.05, projectileSpeed: 7.5 },
      { cost: 280, damage: 62, range: 3.4, cooldown: 1.1, splash: 1.25, projectileSpeed: 8 },
    ],
  },
  sniper: {
    kind: "sniper",
    name: "狙击镜",
    icon: "🔭",
    desc: "超远射程单体高伤,可对空。专打胖子和 Boss",
    attack: "projectile",
    canHitAir: true,
    levels: [
      { cost: 260, damage: 40, range: 4.2, cooldown: 1.6, projectileSpeed: 14 },
      { cost: 240, damage: 62, range: 4.6, cooldown: 1.4, projectileSpeed: 15 },
      { cost: 320, damage: 92, range: 5.0, cooldown: 1.2, projectileSpeed: 16 },
    ],
  },
  tesla: {
    kind: "tesla",
    name: "电塔",
    icon: "⚡",
    desc: "闪电在附近敌人间跳跃,可对空。克制虫群",
    attack: "chain",
    canHitAir: true,
    levels: [
      { cost: 210, damage: 14, range: 2.5, cooldown: 0.95, chain: 3 },
      { cost: 190, damage: 20, range: 2.8, cooldown: 0.85, chain: 4 },
      { cost: 260, damage: 28, range: 3.1, cooldown: 0.75, chain: 5 },
    ],
  },
  poison: {
    kind: "poison",
    name: "毒蘑菇",
    icon: "🍄",
    desc: "命中施加持续毒素,可叠加强度。打不到飞行怪",
    attack: "projectile",
    canHitAir: false,
    levels: [
      { cost: 160, damage: 3, range: 2.4, cooldown: 0.9, projectileSpeed: 7, poisonDps: 10, poisonDuration: 3 },
      { cost: 150, damage: 5, range: 2.7, cooldown: 0.8, projectileSpeed: 7, poisonDps: 16, poisonDuration: 3.5 },
      { cost: 220, damage: 8, range: 3.0, cooldown: 0.7, projectileSpeed: 8, poisonDps: 24, poisonDuration: 4 },
    ],
  },
  mortar: {
    kind: "mortar",
    name: "迫击炮",
    icon: "🎯",
    desc: "超大溅射圈,弹道较慢。清密集地面群,打不到飞行怪",
    attack: "projectile",
    canHitAir: false,
    levels: [
      { cost: 280, damage: 22, range: 3.6, cooldown: 2.2, splash: 1.5, projectileSpeed: 4.5 },
      { cost: 240, damage: 34, range: 3.9, cooldown: 2.0, splash: 1.8, projectileSpeed: 4.8 },
      { cost: 320, damage: 50, range: 4.2, cooldown: 1.8, splash: 2.1, projectileSpeed: 5.2 },
    ],
  },
  laser: {
    kind: "laser",
    name: "激光塔",
    icon: "🔴",
    desc: "高频细射线,持续灼烧一条直线,可对空",
    attack: "beam",
    canHitAir: true,
    levels: [
      { cost: 240, damage: 8, range: 3.2, cooldown: 0.28, beamWidth: 0.18 },
      { cost: 220, damage: 12, range: 3.5, cooldown: 0.22, beamWidth: 0.22 },
      { cost: 300, damage: 18, range: 3.8, cooldown: 0.16, beamWidth: 0.26 },
    ],
  },
  spike: {
    kind: "spike",
    name: "地刺",
    icon: "📌",
    desc: "贴路超短程高伤脉冲,专打路过的地面怪",
    attack: "pulse",
    canHitAir: false,
    levels: [
      { cost: 140, damage: 16, range: 1.15, cooldown: 0.45 },
      { cost: 140, damage: 24, range: 1.25, cooldown: 0.38 },
      { cost: 200, damage: 36, range: 1.35, cooldown: 0.3 },
    ],
  },
  goldmine: {
    kind: "goldmine",
    name: "金萝卜矿",
    icon: "💰",
    desc: "不攻击,定时产出金币。前期投资,后期滚雪球",
    attack: "idle",
    canHitAir: false,
    levels: [
      { cost: 180, damage: 0, range: 0.8, cooldown: 4.0, goldPerTick: 12 },
      { cost: 160, damage: 0, range: 0.8, cooldown: 3.5, goldPerTick: 20 },
      { cost: 220, damage: 0, range: 0.8, cooldown: 3.0, goldPerTick: 32 },
    ],
  },
  rocket: {
    kind: "rocket",
    name: "防空火箭",
    icon: "🚀",
    desc: "只打飞行怪和飞艇,溅射对空。地面怪完全无视",
    attack: "projectile",
    canHitAir: true,
    airOnly: true,
    levels: [
      { cost: 200, damage: 22, range: 3.4, cooldown: 1.15, splash: 0.7, projectileSpeed: 9 },
      { cost: 180, damage: 34, range: 3.7, cooldown: 1.0, splash: 0.85, projectileSpeed: 10 },
      { cost: 250, damage: 50, range: 4.0, cooldown: 0.85, splash: 1.0, projectileSpeed: 11 },
    ],
  },
  crossbow: {
    kind: "crossbow", name: "连弩", icon: "🎿",
    desc: "极速连发弩箭,满级三连射,可对空",
    attack: "projectile", canHitAir: true,
    levels: [
      { cost: 150, damage: 9, range: 2.7, cooldown: 0.34, projectileSpeed: 13, shots: 1 },
      { cost: 160, damage: 13, range: 3.0, cooldown: 0.28, projectileSpeed: 14, shots: 2 },
      { cost: 230, damage: 19, range: 3.3, cooldown: 0.22, projectileSpeed: 15, shots: 3 },
    ],
  },
  railgun: {
    kind: "railgun", name: "轨道炮", icon: "🔫",
    desc: "蓄力后贯穿整条直线,伤害极高,可对空",
    attack: "beam", canHitAir: true,
    levels: [
      { cost: 300, damage: 58, range: 4.4, cooldown: 2.1, beamWidth: 0.3 },
      { cost: 280, damage: 88, range: 4.9, cooldown: 1.9, beamWidth: 0.36 },
      { cost: 360, damage: 132, range: 5.4, cooldown: 1.7, beamWidth: 0.42 },
    ],
  },
  flame: {
    kind: "flame", name: "喷火龙", icon: "🔥",
    desc: "近距离火焰喷射并点燃敌人,持续灼烧。仅对地",
    attack: "beam", canHitAir: false,
    levels: [
      { cost: 200, damage: 7, range: 2.2, cooldown: 0.3, beamWidth: 0.7, poisonDps: 9, poisonDuration: 2 },
      { cost: 190, damage: 11, range: 2.5, cooldown: 0.26, beamWidth: 0.85, poisonDps: 15, poisonDuration: 2.4 },
      { cost: 260, damage: 17, range: 2.8, cooldown: 0.22, beamWidth: 1.0, poisonDps: 24, poisonDuration: 2.8 },
    ],
  },
  boomerang: {
    kind: "boomerang", name: "回旋镖", icon: "🪃",
    desc: "飞镖在敌人之间来回弹跳,越密越赚,可对空",
    attack: "chain", canHitAir: true,
    levels: [
      { cost: 170, damage: 17, range: 2.8, cooldown: 1.05, chain: 4 },
      { cost: 170, damage: 26, range: 3.1, cooldown: 0.92, chain: 5 },
      { cost: 240, damage: 38, range: 3.4, cooldown: 0.8, chain: 7 },
    ],
  },
  tornado: {
    kind: "tornado", name: "龙卷风", icon: "🌪️",
    desc: "卷起范围风暴,持续伤害并吹慢敌人,可对空",
    attack: "pulse", canHitAir: true,
    levels: [
      { cost: 230, damage: 11, range: 2.1, cooldown: 0.65, slowFactor: 0.7, slowDuration: 1.0 },
      { cost: 220, damage: 17, range: 2.4, cooldown: 0.58, slowFactor: 0.6, slowDuration: 1.2 },
      { cost: 300, damage: 26, range: 2.7, cooldown: 0.5, slowFactor: 0.5, slowDuration: 1.5 },
    ],
  },
  frostpillar: {
    kind: "frostpillar", name: "霜冻碑", icon: "🗿",
    desc: "不攻击,范围内敌人持续被冻慢。控制核心",
    attack: "aura", canHitAir: true,
    levels: [
      { cost: 190, damage: 0, range: 2.3, cooldown: 0.2, auraSlow: 0.62 },
      { cost: 180, damage: 0, range: 2.7, cooldown: 0.2, auraSlow: 0.5 },
      { cost: 250, damage: 0, range: 3.1, cooldown: 0.2, auraSlow: 0.38 },
    ],
  },
  minefield: {
    kind: "minefield", name: "地雷阵", icon: "💥",
    desc: "在脚下埋雷,踩中即大范围爆炸。仅对地",
    attack: "pulse", canHitAir: false,
    levels: [
      { cost: 210, damage: 34, range: 1.5, cooldown: 1.5 },
      { cost: 200, damage: 52, range: 1.7, cooldown: 1.35 },
      { cost: 280, damage: 78, range: 1.9, cooldown: 1.2 },
    ],
  },
  prism: {
    kind: "prism", name: "棱镜塔", icon: "🔷",
    desc: "折射光束同时锁定多个目标,可对空",
    attack: "projectile", canHitAir: true,
    levels: [
      { cost: 260, damage: 20, range: 3.0, cooldown: 0.8, projectileSpeed: 16, shots: 2 },
      { cost: 250, damage: 30, range: 3.3, cooldown: 0.7, projectileSpeed: 17, shots: 3 },
      { cost: 330, damage: 44, range: 3.6, cooldown: 0.6, projectileSpeed: 18, shots: 4 },
    ],
  },
  bank: {
    kind: "bank", name: "萝卜钱庄", icon: "🏦",
    desc: "不攻击,产金远超金矿,但造价高",
    attack: "idle", canHitAir: false,
    levels: [
      { cost: 300, damage: 0, range: 0.8, cooldown: 3.6, goldPerTick: 30 },
      { cost: 280, damage: 0, range: 0.8, cooldown: 3.1, goldPerTick: 52 },
      { cost: 360, damage: 0, range: 0.8, cooldown: 2.6, goldPerTick: 84 },
    ],
  },
  obelisk: {
    kind: "obelisk", name: "增幅方尖碑", icon: "🔮",
    desc: "不攻击,大幅提升周围炮塔的伤害。摆位是关键",
    attack: "aura", canHitAir: true,
    levels: [
      { cost: 240, damage: 0, range: 2.0, cooldown: 0.5, buffDamage: 0.25 },
      { cost: 240, damage: 0, range: 2.3, cooldown: 0.5, buffDamage: 0.45 },
      { cost: 320, damage: 0, range: 2.6, cooldown: 0.5, buffDamage: 0.7 },
    ],
  },
  shotgun: {
    kind: "shotgun", name: "霰弹枪", icon: "🔫",
    desc: "近距离多弹散射,敌人越近伤害越高。仅对地",
    attack: "projectile", canHitAir: false,
    levels: [
      { cost: 140, damage: 10, range: 1.8, cooldown: 0.9, projectileSpeed: 14, shots: 3 },
      { cost: 130, damage: 15, range: 2.0, cooldown: 0.8, projectileSpeed: 15, shots: 4 },
      { cost: 190, damage: 22, range: 2.2, cooldown: 0.7, projectileSpeed: 16, shots: 5 },
    ],
  },
  grenade: {
    kind: "grenade", name: "榴弹炮", icon: "💣",
    desc: "高弹道大范围爆炸,清密集地面群。仅对地",
    attack: "projectile", canHitAir: false,
    levels: [
      { cost: 200, damage: 26, range: 3.2, cooldown: 1.8, splash: 1.4, projectileSpeed: 5 },
      { cost: 190, damage: 40, range: 3.6, cooldown: 1.6, splash: 1.7, projectileSpeed: 5.5 },
      { cost: 270, damage: 60, range: 4.0, cooldown: 1.4, splash: 2.0, projectileSpeed: 6 },
    ],
  },
  cutter: {
    kind: "cutter", name: "激光切割", icon: "🔪",
    desc: "持续切割直线,对路径上所有敌人造成持续伤害,可对空",
    attack: "beam", canHitAir: true,
    levels: [
      { cost: 220, damage: 6, range: 3.4, cooldown: 0.25, beamWidth: 0.2 },
      { cost: 210, damage: 10, range: 3.8, cooldown: 0.2, beamWidth: 0.25 },
      { cost: 280, damage: 16, range: 4.2, cooldown: 0.15, beamWidth: 0.3 },
    ],
  },
  magnet: {
    kind: "magnet", name: "磁力塔", icon: "🧲",
    desc: "吸引周围敌人聚集,便于集火清理。不攻击",
    attack: "aura", canHitAir: false,
    levels: [
      { cost: 200, damage: 0, range: 2.6, cooldown: 0.3 },
      { cost: 190, damage: 0, range: 3.0, cooldown: 0.3 },
      { cost: 260, damage: 0, range: 3.4, cooldown: 0.3 },
    ],
  },
  medic: {
    kind: "medic", name: "治疗塔", icon: "🏥",
    desc: "治疗周围友军炮塔,延长战线寿命。不攻击",
    attack: "aura", canHitAir: false,
    levels: [
      { cost: 220, damage: 0, range: 2.4, cooldown: 0.5 },
      { cost: 210, damage: 0, range: 2.8, cooldown: 0.4 },
      { cost: 280, damage: 0, range: 3.2, cooldown: 0.3 },
    ],
  },
  siege: {
    kind: "siege", name: "巨炮", icon: "💥",
    desc: "超远程巨大单体伤害,专打Boss和厚血目标,可对空",
    attack: "projectile", canHitAir: true,
    levels: [
      { cost: 300, damage: 90, range: 4.8, cooldown: 2.4, projectileSpeed: 12 },
      { cost: 280, damage: 140, range: 5.2, cooldown: 2.1, projectileSpeed: 13 },
      { cost: 360, damage: 220, range: 5.6, cooldown: 1.8, projectileSpeed: 14 },
    ],
  },
  trap: {
    kind: "trap", name: "陷阱塔", icon: "⛓️",
    desc: "地面触发后大范围爆炸,清理路过敌人。仅对地",
    attack: "pulse", canHitAir: false,
    levels: [
      { cost: 180, damage: 40, range: 1.3, cooldown: 2.5 },
      { cost: 170, damage: 62, range: 1.5, cooldown: 2.2 },
      { cost: 240, damage: 95, range: 1.7, cooldown: 1.9 },
    ],
  },
  sonic: {
    kind: "sonic", name: "音波塔", icon: "🔊",
    desc: "音波击退敌人,拖慢推进。可对空",
    attack: "projectile", canHitAir: true,
    levels: [
      { cost: 160, damage: 4, range: 2.8, cooldown: 0.8, projectileSpeed: 10 },
      { cost: 150, damage: 7, range: 3.1, cooldown: 0.7, projectileSpeed: 11 },
      { cost: 210, damage: 12, range: 3.4, cooldown: 0.6, projectileSpeed: 12 },
    ],
  },
  chrono: {
    kind: "chrono", name: "时间塔", icon: "⏱️",
    desc: "范围内敌人时间流速变慢,配合输出塔。可对空",
    attack: "aura", canHitAir: true,
    levels: [
      { cost: 240, damage: 0, range: 2.5, cooldown: 0.3 },
      { cost: 230, damage: 0, range: 2.9, cooldown: 0.3 },
      { cost: 300, damage: 0, range: 3.3, cooldown: 0.3 },
    ],
  },
  nuke: {
    kind: "nuke", name: "核弹塔", icon: "☢️",
    desc: "极高伤害超大范围,冷却极长。仅对地",
    attack: "projectile", canHitAir: false,
    levels: [
      { cost: 340, damage: 120, range: 3.6, cooldown: 5.0, splash: 2.4, projectileSpeed: 8 },
      { cost: 320, damage: 180, range: 4.0, cooldown: 4.4, splash: 2.8, projectileSpeed: 8.5 },
      { cost: 420, damage: 280, range: 4.4, cooldown: 3.8, splash: 3.2, projectileSpeed: 9 },
    ],
  },
};

/** 图鉴顺序:全部 25 种。 */
export const TOWER_ORDER: TowerKind[] = [
  "bottle", "shotgun", "arrow", "crossbow", "sniper",
  "cannon", "grenade", "mortar", "minefield", "rocket",
  "railgun", "fan", "cutter", "laser", "prism",
  "tesla", "boomerang", "tornado", "sunflower", "flame",
  "poison", "star", "siege", "sonic", "nuke",
  "moon", "frostpillar", "chrono", "magnet", "medic",
  "goldmine", "bank", "obelisk",
];

export interface TowerPage {
  id: string;
  name: string;
  kinds: TowerKind[];
}

/** 战斗坞分页,每页 5 个对应快捷键 1–5。 */
export const TOWER_PAGES: TowerPage[] = [
  { id: "basic", name: "速射", kinds: ["bottle", "shotgun", "arrow", "crossbow", "sniper"] },
  { id: "heavy", name: "重炮", kinds: ["cannon", "grenade", "mortar", "minefield", "rocket"] },
  { id: "beam", name: "光束", kinds: ["railgun", "fan", "cutter", "laser", "prism"] },
  { id: "elem", name: "元素", kinds: ["tesla", "boomerang", "tornado", "sunflower", "flame"] },
  { id: "ctrl", name: "控制", kinds: ["poison", "star", "siege", "sonic", "nuke"] },
  { id: "aura", name: "光环", kinds: ["moon", "frostpillar", "chrono", "magnet", "medic"] },
  { id: "gold", name: "经济", kinds: ["goldmine", "bank", "obelisk"] },
];

export function getLevelStats(kind: TowerKind, level: number): TowerLevelStats {
  const levels = TOWER_DEFS[kind].levels;
  return levels[Math.min(Math.max(level, 1), levels.length) - 1];
}

export function buildCost(kind: TowerKind): number {
  return TOWER_DEFS[kind].levels[0].cost;
}

export function nextUpgradeCost(kind: TowerKind, level: number): number | null {
  if (level >= MAX_TOWER_LEVEL) return null;
  return TOWER_DEFS[kind].levels[level].cost;
}

export function sellValueOf(invested: number): number {
  return Math.floor(invested * SELL_RATE);
}
