import type { AffixId, Enemy, EnemyKind, LevelDef, SpawnGroup, WaveDef } from "./types";
import { generateChapterLevels } from "./levelGen";

/**
 * 无尽模式。
 *
 * 与战役的区别:
 * 1. 波次无限延长(默认 60 波,打穿即视为通关),血量/速度随波数持续上升;
 * 2. 从第 3 波开始,每波带一个「词缀」,同一张图每局体验不同;
 * 3. 每 3 波给一次遗物(上限提高到 8 件),鼓励长线构筑;
 * 4. 记录「最高到达波数」,失败也有进度。
 *
 * 所有词缀都在出怪时一次性作用到敌人身上(不进入内核循环),保持引擎简单可测。
 */

export const ENDLESS_TOTAL_WAVES = 60;
export const ENDLESS_BASE_HP_GROWTH = 0.16;
export const ENDLESS_BOSS_GROWTH = 1.1;

export interface AffixDef {
  id: AffixId;
  name: string;
  icon: string;
  /** 一句话说明,给玩家看 */
  desc: string;
  color: string;
  hpMult?: number;
  speedMult?: number;
  armor?: number;
  regen?: number;
  rewardMult?: number;
  size?: number;
}

export const AFFIXES: Record<AffixId, AffixDef> = {
  swift: {
    id: "swift", name: "疾行", icon: "💨", color: "#4fc3f7",
    desc: "本波敌人移速大幅提升", speedMult: 1.35,
  },
  armored: {
    id: "armored", name: "重甲", icon: "🛡️", color: "#b0bec5",
    desc: "本波敌人获得护甲,惧怕穿甲与毒", armor: 0.22,
  },
  regen: {
    id: "regen", name: "再生", icon: "💚", color: "#69f0ae",
    desc: "本波敌人持续自我治疗,需要爆发伤害", regen: 8,
  },
  giant: {
    id: "giant", name: "巨化", icon: "⬆️", color: "#ffb74d",
    desc: "本波敌人血量与体积变大,但赏金更高", hpMult: 1.5, size: 1.15, rewardMult: 1.3,
  },
  mad: {
    id: "mad", name: "狂暴", icon: "🔥", color: "#ff5252",
    desc: "本波敌人更快更硬,漏过代价不变", speedMult: 1.15, hpMult: 1.2,
  },
  bounty: {
    id: "bounty", name: "悬赏", icon: "💰", color: "#ffca28",
    desc: "本波敌人更弱,但击杀金币翻倍", hpMult: 0.8, rewardMult: 2,
  },
};

export const AFFIX_ORDER: AffixId[] = ["swift", "armored", "regen", "giant", "mad", "bounty"];

/** 确定性:同一关(seed)同一波永远拿到同一个词缀。 */
export function affixForWave(wave: number, seed = 0): AffixId | undefined {
  if (wave < 3) return undefined;
  // 按波次顺次轮换:保证任意连续 6 波覆盖全部词缀,同时仍是确定性的
  return AFFIX_ORDER[(wave - 3 + seed) % AFFIX_ORDER.length];
}

/** 把词缀一次性作用到刚生成的敌人身上。 */
export function applyAffix(e: Enemy, affix: AffixId | undefined): void {
  if (!affix) return;
  const a = AFFIXES[affix];
  if (a.hpMult) {
    e.maxHp = Math.max(1, Math.round(e.maxHp * a.hpMult));
    e.hp = e.maxHp;
  }
  if (a.speedMult) e.baseSpeed *= a.speedMult;
  if (a.armor) e.armor = Math.max(e.armor, a.armor);
  if (a.regen) {
    e.healPerSec = Math.max(e.healPerSec, a.regen);
    e.healRadius = Math.max(e.healRadius, 0.2);
  }
  if (a.size) e.radius *= a.size;
  if (a.rewardMult) e.reward = Math.round(e.reward * a.rewardMult);
}

const ELITE_CYCLE: EnemyKind[] = [
  "runner", "armored", "swarmling", "shieldman", "healer",
  "bomber", "ghost", "mage", "brute", "carrier", "golem", "warlord",
];

const BOSS_CYCLE: EnemyKind[] = ["boss", "warlord", "golem", "carrier", "brute"];

/**
 * 生成一局无尽挑战。
 * 地图从战役后期的生成器里取(尺寸大、多入口),波次则按无尽曲线展开。
 */
export function createEndlessLevel(seed = 1): LevelDef {
  // 地图也从种子里挑:3 张候选地图中按种子选一张,保证每局地形不同
  const options = generateChapterLevels(4, 3, 57 + (Math.abs(seed) % 6));
  // 用多位哈希同时决定「候选地图」与「是否左右镜像」,得到 6 种地形组合
  const h = (Math.imul(Math.abs(seed) * 7481 + 1237, 2654435761) >>> 13) >>> 0;
  const picked = options[h % options.length];
  const flip = (h >> 8) % 2 === 1;
  const cols = picked.cols ?? 14;
  const template: typeof picked = flip
    ? {
        ...picked,
        waypoints: picked.waypoints.map((lane) => lane.map(([c, r]) => [cols - 1 - c, r] as [number, number])),
        obstacles: picked.obstacles.map((o) => ({ ...o, col: cols - 1 - o.col })),
      }
    : picked;
  const waves: WaveDef[] = [];

  for (let n = 1; n <= ENDLESS_TOTAL_WAVES; n++) {
    const hp = 1 + (n - 1) * ENDLESS_BASE_HP_GROWTH;
    const groups: SpawnGroup[] = [];

    groups.push({
      kind: "grunt",
      count: Math.min(22, 5 + Math.round(n * 0.55)),
      interval: Math.max(0.5, 1.5 - n * 0.02),
      compress: 0.99,
      hpScale: hp,
    });

    if (n % 2 === 0) {
      groups.push({
        kind: "flyer",
        count: Math.min(12, 2 + Math.floor(n / 4)),
        interval: 0.8, compress: 0.97, delay: 3, hpScale: hp,
      });
    }
    if (n >= 4 && n % 3 === 0) {
      groups.push({ kind: "fatty", count: 1 + Math.floor(n / 12), interval: 2.6, delay: 2, hpScale: hp });
    }
    if (n >= 3) {
      const elite = ELITE_CYCLE[(n * 5 + seed) % ELITE_CYCLE.length];
      groups.push({
        kind: elite,
        count: 1 + Math.floor(n / 10),
        interval: 1.6, compress: 0.98, delay: 3.5, hpScale: hp,
      });
    }
    if (n % 5 === 0) {
      const boss = BOSS_CYCLE[(n / 5 - 1 + seed) % BOSS_CYCLE.length];
      groups.push({
        kind: boss,
        count: n >= 20 ? 2 : 1,
        interval: 7, delay: 3,
        hpScale: 1 + (n / 5 - 1) * ENDLESS_BOSS_GROWTH,
      });
    }
    if (n >= 15 && n % 7 === 0) {
      // 后期双路 Boss 之外再追加一群高速怪,制造收尾压力
      groups.push({ kind: "swarmling", count: 8 + Math.floor(n / 4), interval: 0.4, delay: 6, hpScale: hp });
    }

    waves.push({
      groups,
      affix: affixForWave(n, seed),
      boss: n % 5 === 0,
    });
  }

  return {
    ...template,
    cols: template.cols ?? 14,
    rows: template.rows ?? 9,
    id: 999,
    chapter: 4,
    name: "无尽挑战",
    desc: "60 波无限升级的敌潮,每波都有词缀,挑战你的构筑极限。",
    difficulty: "地狱",
    tip: "每 3 波三选一,最多 8 件遗物;满能量记得按 X 放大招。",
    startGold: 420,
    firstWaveDelay: 10,
    waves,
  };
}

/** 无尽模式里每几波给一次遗物(比战役更密)。 */
export const ENDLESS_BOON_EVERY = 3;
export const ENDLESS_MAX_BOONS = 8;
