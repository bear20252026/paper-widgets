import { t } from "../i18n";
/**
 * Commercial meta-progression logic (pure TS, no React / PixiJS):
 * - Daily sign-in ladder with streak forgiveness
 * - Deterministic daily missions seeded by the local date
 * - Season pass with free + collectible tracks (earned gems only, no real money)
 * - Achievements, unlockable titles and share text
 */
import { createRng, hashSeed } from "./rng";

export interface DailyProgress {
  orbs: number;
  kills: number;
  runs: number;
  bestLength: number;
  kingWins: number;
}

export const EMPTY_DAILY: DailyProgress = {
  orbs: 0,
  kills: 0,
  runs: 0,
  bestLength: 0,
  kingWins: 0,
};

export type DailyMetric = keyof DailyProgress;

export interface DailyMissionDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  metric: DailyMetric;
  target: number;
  rewardCoins: number;
  rewardGems: number;
}

export const DAILY_POOL: DailyMissionDef[] = [
  { id: "orbs_60", title: "大快朵颐", desc: "今日累计吞噬 60 个光点", icon: "✦", metric: "orbs", target: 60, rewardCoins: 80, rewardGems: 0 },
  { id: "orbs_140", title: "光点收割机", desc: "今日累计吞噬 140 个光点", icon: "✧", metric: "orbs", target: 140, rewardCoins: 160, rewardGems: 1 },
  { id: "kills_2", title: "围猎时刻", desc: "今日击败 2 条对手蛇", icon: "⚔️", metric: "kills", target: 2, rewardCoins: 120, rewardGems: 0 },
  { id: "kills_5", title: "纸格屠夫", desc: "今日击败 5 条对手蛇", icon: "🔥", metric: "kills", target: 5, rewardCoins: 240, rewardGems: 2 },
  { id: "runs_2", title: "保持手感", desc: "今日完成 2 场对局", icon: "🎯", metric: "runs", target: 2, rewardCoins: 70, rewardGems: 0 },
  { id: "runs_4", title: "竞技常客", desc: "今日完成 4 场对局", icon: "🏁", metric: "runs", target: 4, rewardCoins: 140, rewardGems: 1 },
  { id: "best_180", title: "稳步成长", desc: "今日单局长度达到 180 米", icon: "📏", metric: "bestLength", target: 180, rewardCoins: 110, rewardGems: 0 },
  { id: "best_420", title: "巨蟒驾到", desc: "今日单局长度达到 420 米", icon: "🐍", metric: "bestLength", target: 420, rewardCoins: 220, rewardGems: 2 },
  { id: "king_1", title: "登顶一刻", desc: "今日夺得 1 次全场第一", icon: "👑", metric: "kingWins", target: 1, rewardCoins: 300, rewardGems: 3 },
];

/** Deterministic daily rotation: same date always yields the same 3 missions. */
export function todaysMissions(dateKey: string): DailyMissionDef[] {
  const rng = createRng(hashSeed(`daily-${dateKey}`));
  const pool = DAILY_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked: DailyMissionDef[] = [];
  const metrics = new Set<DailyMetric>();
  for (const m of pool) {
    if (metrics.has(m.metric)) continue;
    metrics.add(m.metric);
    picked.push(m);
    if (picked.length === 3) break;
  }
  return picked;
}

export interface DailyMissionStatus extends DailyMissionDef {
  progress: number;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
}

export function evaluateDailyMissions(
  dateKey: string,
  progress: DailyProgress,
  claimedIds: readonly string[]
): DailyMissionStatus[] {
  const claimed = new Set(claimedIds);
  return todaysMissions(dateKey).map((m) => {
    const current = Math.max(0, Math.floor(progress[m.metric]));
    const done = current >= m.target;
    return {
      ...m,
      progress: Math.min(m.target, current),
      completed: done,
      claimed: claimed.has(m.id),
      claimable: done && !claimed.has(m.id),
    };
  });
}

export interface SignInReward {
  day: number;
  coins: number;
  gems: number;
  label: string;
  icon: string;
}

export const SIGN_IN_REWARDS: SignInReward[] = [
  { day: 1, coins: 60, gems: 0, label: "起步金币", icon: "🪙" },
  { day: 2, coins: 90, gems: 1, label: "宝石补给", icon: "💎" },
  { day: 3, coins: 120, gems: 0, label: "连续奖励", icon: "🪙" },
  { day: 4, coins: 150, gems: 2, label: "双倍宝石", icon: "💎" },
  { day: 5, coins: 200, gems: 0, label: "老友礼包", icon: "🎁" },
  { day: 6, coins: 240, gems: 2, label: "冲刺礼包", icon: "🎁" },
  { day: 7, coins: 420, gems: 5, label: "周签大奖", icon: "🏆" },
];

/** Claim streak does not reset on a missed day (forgiving ladder). */
export function nextSignInDay(streak: number): number {
  return (Math.max(0, streak) % SIGN_IN_REWARDS.length) + 1;
}

export interface CareerMetrics {
  bestLength: number;
  totalRuns: number;
  totalKills: number;
  bestStreak: number;
  kingCount: number;
  ownedSkinsCount: number;
  dailyStreak: number;
  seasonTier: number;
  totalOrbs: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  metric: keyof CareerMetrics;
  target: number;
  coins: number;
  gems: number;
  titleId?: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_run", title: "初次登场", desc: "完成你的第一场对局", icon: "🌱", metric: "totalRuns", target: 1, coins: 60, gems: 0 },
  { id: "orbs_500", title: "光点猎人", desc: "累计吞噬 500 个光点", icon: "✦", metric: "totalOrbs", target: 500, coins: 180, gems: 1 },
  { id: "runs_10", title: "竞技常客", desc: "累计完成 10 场对局", icon: "🏁", metric: "totalRuns", target: 10, coins: 200, gems: 1 },
  { id: "kills_10", title: "围猎者", desc: "累计击败 10 条对手蛇", icon: "⚔️", metric: "totalKills", target: 10, coins: 220, gems: 1, titleId: "hunter" },
  { id: "kills_50", title: "纸格屠夫", desc: "累计击败 50 条对手蛇", icon: "🔥", metric: "totalKills", target: 50, coins: 520, gems: 5 },
  { id: "streak_3", title: "连斩风暴", desc: "单局达成 3 连杀", icon: "⚡", metric: "bestStreak", target: 3, coins: 260, gems: 2, titleId: "streaker" },
  { id: "length_500", title: "长蛇如龙", desc: "单局长度达到 500 米", icon: "🐍", metric: "bestLength", target: 500, coins: 280, gems: 2 },
  { id: "length_1000", title: "千尺巨蟒", desc: "单局长度达到 1000 米", icon: "🐉", metric: "bestLength", target: 1000, coins: 700, gems: 6, titleId: "giant" },
  { id: "king_1", title: "纸格蛇王", desc: "夺得一次全场第一名", icon: "👑", metric: "kingCount", target: 1, coins: 400, gems: 3, titleId: "king" },
  { id: "king_3", title: "王者再临", desc: "累计夺得 3 次第一名", icon: "🏆", metric: "kingCount", target: 3, coins: 760, gems: 6 },
  { id: "skins_6", title: "潮流收藏家", desc: "衣橱中拥有 6 款皮肤", icon: "🎨", metric: "ownedSkinsCount", target: 6, coins: 320, gems: 2, titleId: "collector" },
  { id: "daily_7", title: "七日守望", desc: "累计签到 7 天", icon: "📅", metric: "dailyStreak", target: 7, coins: 360, gems: 4, titleId: "loyal" },
];

export interface AchievementStatus extends AchievementDef {
  progress: number;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
}

export function evaluateAchievements(
  metrics: CareerMetrics,
  claimedIds: readonly string[]
): AchievementStatus[] {
  const claimed = new Set(claimedIds);
  return ACHIEVEMENTS.map((a) => {
    const current = Math.max(0, Math.floor(metrics[a.metric]));
    const completed = current >= a.target;
    return {
      ...a,
      progress: Math.min(a.target, current),
      completed,
      claimed: claimed.has(a.id),
      claimable: completed && !claimed.has(a.id),
    };
  });
}

export interface TitleDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  unlock: (m: CareerMetrics) => boolean;
}

export const TITLES: TitleDef[] = [
  { id: "rookie", name: "初入纸格", desc: "默认称号", icon: "🌱", unlock: () => true },
  { id: "hunter", name: "围猎者", desc: "累计击败 10 条对手蛇", icon: "⚔️", unlock: (m) => m.totalKills >= 10 },
  { id: "streaker", name: "连斩风暴", desc: "单局达成 3 连杀", icon: "⚡", unlock: (m) => m.bestStreak >= 3 },
  { id: "giant", name: "千尺巨蟒", desc: "单局长度达到 1000 米", icon: "🐉", unlock: (m) => m.bestLength >= 1000 },
  { id: "king", name: "纸格蛇王", desc: "夺得一次全场第一", icon: "👑", unlock: (m) => m.kingCount >= 1 },
  { id: "collector", name: "潮流收藏家", desc: "衣橱拥有 6 款皮肤", icon: "🎨", unlock: (m) => m.ownedSkinsCount >= 6 },
  { id: "loyal", name: "七日守望", desc: "累计签到 7 天", icon: "📅", unlock: (m) => m.dailyStreak >= 7 },
  { id: "champion", name: "赛季冠军", desc: "赛季通行证达到 20 级", icon: "🏆", unlock: (m) => m.seasonTier >= 20 },
];

export function getTitle(id: string): TitleDef {
  return TITLES.find((t) => t.id === id) ?? TITLES[0];
}

export function unlockedTitles(metrics: CareerMetrics): TitleDef[] {
  return TITLES.filter((t) => t.unlock(metrics));
}

export const SEASON = {
  id: "s1",
  name: "纸格初夏",
  tagline: "清新草稿纸上的高燃逆袭赛季",
  durationLabel: "S1 · 30 天",
  maxTier: 20,
  xpPerTier: 240,
  passCostGems: 20,
};

export interface SeasonTrackReward {
  coins: number;
  gems: number;
  label?: string;
}

export interface SeasonTier {
  tier: number;
  free: SeasonTrackReward;
  premium: SeasonTrackReward;
}

export const SEASON_TIERS: SeasonTier[] = Array.from({ length: SEASON.maxTier }, (_, i) => {
  const tier = i + 1;
  const milestone = tier % 5 === 0;
  return {
    tier,
    free: {
      coins: 50 + tier * 8,
      gems: milestone ? 2 : 0,
      label: milestone ? `${tier} 级里程碑` : undefined,
    },
    premium: {
      coins: 90 + tier * 12,
      gems: tier % 4 === 0 ? 3 : 1,
      label: tier === 10 ? "珍藏 · 里程碑" : tier === 20 ? "珍藏 · 满级大奖" : undefined,
    },
  };
});

export function seasonXpFromRun(run: {
  length: number;
  kills: number;
  rank: number;
  mode: "endless" | "timed";
}): number {
  const lengthXp = Math.round(run.length / 4);
  const killXp = run.kills * 28;
  const placeXp = run.rank === 1 ? 70 : run.rank <= 3 ? 40 : 15;
  const modeXp = run.mode === "timed" ? 30 : 0;
  return lengthXp + killXp + placeXp + modeXp;
}

export function seasonTierFor(xp: number): number {
  return Math.max(0, Math.min(SEASON.maxTier, Math.floor(Math.max(0, xp) / SEASON.xpPerTier)));
}

export function seasonTierProgress(xp: number): { tier: number; into: number; needed: number; pct: number } {
  const tier = seasonTierFor(xp);
  if (tier >= SEASON.maxTier) return { tier, into: SEASON.xpPerTier, needed: SEASON.xpPerTier, pct: 1 };
  const into = Math.max(0, xp - tier * SEASON.xpPerTier);
  return { tier, into, needed: SEASON.xpPerTier, pct: into / SEASON.xpPerTier };
}

export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysBetween(fromKey: string, toKey: string): number {
  const a = new Date(`${fromKey}T00:00:00`).getTime();
  const b = new Date(`${toKey}T00:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function msUntilTomorrow(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return t("{h}小时{m}分", { h, m });
  if (m > 0) return t("{m}分{s}秒", { m, s: s.toString().padStart(2, "0") });
  return t("{s}秒", { s });
}

export interface ShareInput {
  playerName: string;
  length: number;
  rank: number;
  kills: number;
  bestStreak: number;
  mode: "endless" | "timed";
  tierName: string;
  titleName: string;
}

export function buildShareText(input: ShareInput): string {
  const streak = input.bestStreak >= 2 ? t(" · {n} 连杀", { n: input.bestStreak }) : "";
  return [
    t("【纸格竞技场】{name}", { name: input.playerName }),
    t("本局 {len} 米 · 第 {rank} 名 · {kills} 击杀", { len: input.length, rank: input.rank, kills: input.kills }) + streak,
    t("模式：{mode} · 段位：{tier}", { mode: input.mode === "timed" ? t("限时冲榜") : t("无尽模式"), tier: input.tierName }),
    t("称号：{title}", { title: input.titleName }),
    t("碰到自己的尾巴不会死，来挑战我的长度！"),
  ].join("\n");
}
