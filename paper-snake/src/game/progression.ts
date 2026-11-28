import { t } from "../i18n";
/**
 * Pure progression logic: Rank Tiers (段位体系) & Bounty Missions (赏金挑战).
 * Contains zero UI or PixiJS imports so it can be unit-tested directly.
 */

export interface RankTierInfo {
  id: string;
  name: string;
  shortName: string;
  minRp: number;
  nextRp: number | null;
  color: string;
  bg: string;
  icon: string;
  progress: number;
  stars: number;
}

export interface RankTierDef {
  id: string;
  name: string;
  shortName: string;
  minRp: number;
  color: string;
  bg: string;
  icon: string;
}

export const RANK_TIERS: RankTierDef[] = [
  { id: "bronze", name: "青铜幼蛇", shortName: "青铜", minRp: 0, color: "#a56938", bg: "#f9eadb", icon: "🌱" },
  { id: "silver", name: "白银游蛇", shortName: "白银", minRp: 120, color: "#5f7387", bg: "#eaeff5", icon: "🥈" },
  { id: "gold", name: "黄金灵蛇", shortName: "黄金", minRp: 300, color: "#b77e12", bg: "#fff4d1", icon: "🥇" },
  { id: "platinum", name: "铂金巨蟒", shortName: "铂金", minRp: 560, color: "#1d8f7a", bg: "#dff7f0", icon: "💠" },
  { id: "diamond", name: "钻石龙蟒", shortName: "钻石", minRp: 900, color: "#4f62d8", bg: "#e7eaff", icon: "💎" },
  { id: "master", name: "星耀蛇尊", shortName: "星耀", minRp: 1350, color: "#8e49d6", bg: "#f2e5ff", icon: "✨" },
  { id: "king", name: "最强蛇王", shortName: "蛇王", minRp: 1900, color: "#c93b2b", bg: "#ffe4dc", icon: "👑" },
];

export function getRankTier(rp: number): RankTierInfo {
  const safeRp = Math.max(0, Math.floor(rp));
  let idx = 0;
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (safeRp >= RANK_TIERS[i].minRp) idx = i;
  }
  const cur = RANK_TIERS[idx];
  const next = RANK_TIERS[idx + 1] ?? null;
  if (!next) {
    const extraStars = 1 + Math.floor((safeRp - cur.minRp) / 150);
    return {
      ...cur,
      nextRp: null,
      progress: 1,
      stars: Math.min(99, extraStars),
    };
  }
  const span = Math.max(1, next.minRp - cur.minRp);
  const progress = Math.max(0, Math.min(1, (safeRp - cur.minRp) / span));
  const stars = Math.min(3, Math.floor(progress * 3) + 1);
  return {
    ...cur,
    nextRp: next.minRp,
    progress,
    stars,
  };
}

/** Calculate RP delta earned from a single match. Never negative in casual local play, minimum +8. */
export function calcRpGain(opts: {
  length: number;
  rank: number;
  kills: number;
  bestStreak: number;
  survivedMs: number;
}): number {
  const lengthPts = Math.floor(opts.length / 22);
  const rankPts = opts.rank === 1 ? 45 : opts.rank <= 3 ? 28 : opts.rank <= 6 ? 16 : 6;
  const killPts = opts.kills * 11 + Math.max(0, opts.bestStreak - 1) * 8;
  const timePts = Math.min(20, Math.floor(opts.survivedMs / 15000) * 3);
  return Math.max(8, lengthPts + rankPts + killPts + timePts);
}

export interface CareerStatsSnapshot {
  bestLength: number;
  totalRuns: number;
  totalKills: number;
  bestStreak: number;
  kingCount: number;
  ownedSkinsCount: number;
}

export interface MissionDef {
  id: string;
  title: string;
  desc: string;
  reward: number;
  icon: string;
  target: number;
  current: (stats: CareerStatsSnapshot) => number;
}

export const MISSIONS: MissionDef[] = [
  {
    id: "len_200",
    title: "初露锋芒",
    desc: "单局最佳长度达到 200 米",
    reward: 120,
    icon: "📏",
    target: 200,
    current: (s) => s.bestLength,
  },
  {
    id: "kills_3",
    title: "围猎能手",
    desc: "生涯累计击败 3 条对手蛇",
    reward: 150,
    icon: "⚔️",
    target: 3,
    current: (s) => s.totalKills,
  },
  {
    id: "king_1",
    title: "加冕蛇王",
    desc: "任意模式夺得 1 次第 1 名",
    reward: 220,
    icon: "👑",
    target: 1,
    current: (s) => s.kingCount,
  },
  {
    id: "streak_2",
    title: "连斩风暴",
    desc: "单局内达成双杀（2 连击）",
    reward: 180,
    icon: "⚡",
    target: 2,
    current: (s) => s.bestStreak,
  },
  {
    id: "runs_5",
    title: "赛场常客",
    desc: "累计完成 5 场竞技对局",
    reward: 160,
    icon: "🎯",
    target: 5,
    current: (s) => s.totalRuns,
  },
  {
    id: "len_550",
    title: "深渊巨蟒",
    desc: "单局最佳长度突破 550 米",
    reward: 300,
    icon: "🐉",
    target: 550,
    current: (s) => s.bestLength,
  },
  {
    id: "kills_12",
    title: "纸格猎手",
    desc: "生涯累计击败 12 条对手蛇",
    reward: 320,
    icon: "🔥",
    target: 12,
    current: (s) => s.totalKills,
  },
  {
    id: "skins_4",
    title: "潮流收藏家",
    desc: "皮肤衣橱累计拥有 4 款外观",
    reward: 240,
    icon: "🎨",
    target: 4,
    current: (s) => s.ownedSkinsCount,
  },
];

export interface MissionStatus {
  id: string;
  title: string;
  desc: string;
  reward: number;
  icon: string;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
}

export function evaluateMissions(
  stats: CareerStatsSnapshot,
  claimedIds: readonly string[]
): MissionStatus[] {
  const claimedSet = new Set(claimedIds);
  return MISSIONS.map((m) => {
    const raw = Math.max(0, Math.floor(m.current(stats)));
    const progress = Math.min(m.target, raw);
    const completed = progress >= m.target;
    const claimed = claimedSet.has(m.id);
    return {
      id: m.id,
      title: m.title,
      desc: m.desc,
      reward: m.reward,
      icon: m.icon,
      target: m.target,
      progress,
      completed,
      claimed,
      claimable: completed && !claimed,
    };
  });
}

export function streakTitle(streak: number): { label: string; sub: string; tone: "gold" | "coral" | "violet" } {
  if (streak >= 5) return { label: t("暴走超神！"), sub: t("GODLIKE · {n} 连杀", { n: streak }), tone: "violet" };
  if (streak === 4) return { label: t("四杀破阵！"), sub: t("ULTRA KILL · 势不可挡"), tone: "violet" };
  if (streak === 3) return { label: t("三杀横扫！"), sub: t("TRIPLE KILL · 气势如虹"), tone: "coral" };
  if (streak === 2) return { label: t("双杀拿捏！"), sub: t("DOUBLE KILL · 乘胜追击"), tone: "coral" };
  return { label: t("首杀得手！"), sub: t("FIRST STRIKE · 吞噬战利品"), tone: "gold" };
}
