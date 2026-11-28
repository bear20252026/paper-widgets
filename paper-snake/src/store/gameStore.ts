import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Difficulty, GameMode, HudState, RunResult, SkinId } from "../game/types";
import { detectLang, setLang, t, type Lang } from "../i18n";
import { DEFAULT_SKIN, FREE_SKINS, getSkin, skinName } from "../game/skins";
import {
  EMPTY_DAILY,
  SEASON,
  SEASON_TIERS,
  SIGN_IN_REWARDS,
  TITLES,
  evaluateAchievements,
  evaluateDailyMissions,
  getTitle,
  nextSignInDay,
  seasonTierFor,
  seasonXpFromRun,
  todayKey,
  type CareerMetrics,
  type DailyProgress,
} from "../game/meta";
import { evaluateMissions } from "../game/progression";
import type { GameEvent } from "../game/types";

export type Phase = "menu" | "playing" | "paused" | "downed" | "result";

/** Gems needed for the single in-run revive. */
export const REVIVE_COST = 3;

export interface RunHistory {
  length: number;
  rank: number;
  kills: number;
  bestStreak?: number;
  rpGain?: number;
  orbsEaten?: number;
  seasonXp?: number;
  mode: GameMode;
  at: number;
  skin: SkinId;
}

export interface Toast {
  id: number;
  message: string;
  tone: "success" | "info" | "error" | "reward";
}

export interface CombatBanner {
  id: number;
  title: string;
  subtitle: string;
  tone: "gold" | "coral" | "violet" | "mint";
}

type VolumeChannel = "master" | "sfx" | "bgm";

export interface GameStore {
  phase: Phase;
  demo: boolean;
  lang: Lang;
  difficulty: Difficulty;
  /** whether the current run already used its revive */
  revivedThisRun: boolean;
  mode: GameMode;
  coins: number;
  gems: number;
  rp: number;
  owned: SkinId[];
  equipped: SkinId;
  activeSkin: SkinId;
  title: string;
  onboardingDone: boolean;
  starterGranted: boolean;

  sound: boolean;
  bgm: boolean;
  haptics: boolean;
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  showDirectionArrow: boolean;
  showMinimap: boolean;
  showNames: boolean;
  forceTouchControls: boolean;

  playerName: string;
  bestLength: number;
  totalRuns: number;
  totalKills: number;
  bestStreak: number;
  kingCount: number;
  totalOrbs: number;
  claimedMissions: string[];
  achievementsClaimed: string[];

  dailyDate: string;
  dailyStreak: number;
  lastDailyClaim: string;
  dailyProgress: DailyProgress;
  dailyClaimed: string[];

  seasonXp: number;
  seasonClaimed: string[];
  seasonPassUnlocked: boolean;

  runNonce: number;
  hud: HudState | null;
  result: RunResult | null;
  lastAwardedRun: string | null;
  history: RunHistory[];
  toast: Toast | null;
  banner: CombatBanner | null;
  settingsOpen: boolean;
  closetOpen: boolean;
  missionsOpen: boolean;
  dailyOpen: boolean;
  profileOpen: boolean;
  guideOpen: boolean;
  closetSelection: SkinId | null;

  setMode: (mode: GameMode) => void;
  setLanguage: (lang: Lang) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  playerDown: () => void;
  /** spend gems for the revive; returns true if it was paid */
  payRevive: () => boolean;
  setClosetOpen: (open: boolean, selection?: SkinId) => void;
  setGuideOpen: (open: boolean) => void;
  setMissionsOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setDailyOpen: (open: boolean) => void;
  setProfileOpen: (open: boolean) => void;
  refreshDaily: (now?: Date) => void;
  claimSignIn: () => { coins: number; gems: number; day: number } | null;
  claimDailyMission: (id: string) => { coins: number; gems: number } | null;
  claimSeasonReward: (tier: number, track: "free" | "premium") => boolean;
  unlockSeasonPass: () => boolean;
  claimAchievement: (id: string) => boolean;
  setTitle: (id: string) => void;
  completeOnboarding: (name: string, skin: SkinId) => void;
  replayOnboarding: () => void;
  setVolume: (channel: VolumeChannel, value: number) => void;

  startGame: (mode: GameMode) => void;
  retry: () => void;
  goMenu: () => void;
  pause: () => void;
  resume: () => void;
  setHud: (hud: HudState) => void;
  pushBanner: (title: string, subtitle: string, tone?: CombatBanner["tone"]) => void;
  clearBanner: () => void;
  completeRun: (result: RunResult) => void;
  buySkin: (id: SkinId) => boolean;
  equipSkin: (id: SkinId) => void;
  cycleOwnedSkin: (delta: -1 | 1) => void;
  claimMission: (missionId: string) => number;
  claimAllMissions: () => number;
  toggleSound: () => void;
  toggleBgm: () => void;
  toggleHaptics: () => void;
  toggleDirectionArrow: () => void;
  toggleMinimap: () => void;
  toggleShowNames: () => void;
  toggleForceTouchControls: () => void;
  rename: (name: string) => void;
  notify: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: () => void;
  resetProgress: () => void;
}

const INITIAL_COINS = 320;
const INITIAL_GEMS = 18;
let seq = 1;

export function metricsOf(s: GameStore): CareerMetrics {
  return {
    bestLength: s.bestLength,
    totalRuns: s.totalRuns,
    totalKills: s.totalKills,
    bestStreak: s.bestStreak,
    kingCount: s.kingCount,
    ownedSkinsCount: s.owned.length,
    dailyStreak: s.dailyStreak,
    seasonTier: seasonTierFor(s.seasonXp),
    totalOrbs: s.totalOrbs,
  };
}

export function claimableDailyCount(s: GameStore): number {
  return evaluateDailyMissions(s.dailyDate, s.dailyProgress, s.dailyClaimed).filter((m) => m.claimable).length;
}

export function hasDailyClaim(s: GameStore): boolean {
  return s.lastDailyClaim !== todayKey();
}

export function claimableSeasonCount(s: GameStore): number {
  const tier = seasonTierFor(s.seasonXp);
  const claimed = new Set(s.seasonClaimed);
  let n = 0;
  for (const t of SEASON_TIERS) {
    if (t.tier > tier) break;
    if (!claimed.has(`free-${t.tier}`)) n++;
    if (s.seasonPassUnlocked && !claimed.has(`premium-${t.tier}`)) n++;
  }
  return n;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      phase: "menu",
      demo: true,
      lang: "zh",
      difficulty: "normal",
      revivedThisRun: false,
      mode: "endless",
      coins: INITIAL_COINS,
      gems: INITIAL_GEMS,
      rp: 0,
      owned: [...FREE_SKINS],
      equipped: DEFAULT_SKIN,
      activeSkin: DEFAULT_SKIN,
      title: "rookie",
      onboardingDone: false,
      starterGranted: false,

      sound: true,
      bgm: false,
      haptics: true,
      masterVolume: 0.8,
      sfxVolume: 0.9,
      bgmVolume: 0.45,
      showDirectionArrow: true,
      showMinimap: true,
      showNames: true,
      forceTouchControls: false,

      playerName: "小蛇同学",
      bestLength: 0,
      totalRuns: 0,
      totalKills: 0,
      bestStreak: 0,
      kingCount: 0,
      totalOrbs: 0,
      claimedMissions: [],
      achievementsClaimed: [],

      dailyDate: todayKey(),
      dailyStreak: 0,
      lastDailyClaim: "",
      dailyProgress: { ...EMPTY_DAILY },
      dailyClaimed: [],

      seasonXp: 0,
      seasonClaimed: [],
      seasonPassUnlocked: false,

      runNonce: 0,
      hud: null,
      result: null,
      lastAwardedRun: null,
      history: [],
      toast: null,
      banner: null,
      settingsOpen: false,
      closetOpen: false,
      missionsOpen: false,
      dailyOpen: false,
      profileOpen: false,
      guideOpen: false,
      closetSelection: null,

      setMode: (mode) => set({ mode }),
      setLanguage: (lang) => {
        setLang(lang);
        set((s) => ({
          lang,
          playerName: s.playerName === "小蛇同学" || s.playerName === "Snakelet" ? (lang === "en" ? "Snakelet" : "小蛇同学") : s.playerName,
        }));
      },
      setDifficulty: (difficulty) => set({ difficulty }),
      playerDown: () => {
        const s = get();
        if (s.phase === "playing" && !s.revivedThisRun) set({ phase: "downed" });
      },
      payRevive: () => {
        const s = get();
        if (s.phase !== "downed" || s.revivedThisRun) return false;
        if (s.gems < REVIVE_COST) {
          s.notify(t("宝石不足，签到和成就都能获得宝石"), "error");
          return false;
        }
        set({ gems: s.gems - REVIVE_COST, revivedThisRun: true, phase: "playing" });
        return true;
      },
      setGuideOpen: (guideOpen) => set((s) => ({ guideOpen, phase: guideOpen && s.phase === "playing" ? "paused" : s.phase })),
      setClosetOpen: (closetOpen, selection) =>
        set((s) => ({
          closetSelection: selection ?? null,
          phase: closetOpen && s.phase === "playing" ? "paused" : s.phase,
          closetOpen,
          missionsOpen: false,
          settingsOpen: false,
          dailyOpen: false,
          profileOpen: false,
        })),
      setMissionsOpen: (missionsOpen) =>
        set((s) => ({
          phase: missionsOpen && s.phase === "playing" ? "paused" : s.phase,
          missionsOpen,
          closetOpen: false,
          settingsOpen: false,
          dailyOpen: false,
          profileOpen: false,
        })),
      setSettingsOpen: (settingsOpen) =>
        set((s) => ({
          phase: settingsOpen && s.phase === "playing" ? "paused" : s.phase,
          settingsOpen,
          closetOpen: false,
          missionsOpen: false,
          dailyOpen: false,
          profileOpen: false,
        })),
      setDailyOpen: (dailyOpen) =>
        set((s) => ({
          phase: dailyOpen && s.phase === "playing" ? "paused" : s.phase,
          dailyOpen,
          closetOpen: false,
          missionsOpen: false,
          settingsOpen: false,
          profileOpen: false,
        })),
      setProfileOpen: (profileOpen) =>
        set((s) => ({
          phase: profileOpen && s.phase === "playing" ? "paused" : s.phase,
          profileOpen,
          closetOpen: false,
          missionsOpen: false,
          settingsOpen: false,
          dailyOpen: false,
        })),

      refreshDaily: (now = new Date()) => {
        const key = todayKey(now);
        if (get().dailyDate === key) return;
        set({ dailyDate: key, dailyProgress: { ...EMPTY_DAILY }, dailyClaimed: [] });
      },

      claimSignIn: () => {
        const s = get();
        const today = todayKey();
        if (s.lastDailyClaim === today) {
          s.notify(t("今天的签到奖励已经领取，明天再来"), "info");
          return null;
        }
        const day = nextSignInDay(s.dailyStreak);
        const reward = SIGN_IN_REWARDS[day - 1];
        set((state) => ({
          coins: state.coins + reward.coins,
          gems: state.gems + reward.gems,
          dailyStreak: state.dailyStreak + 1,
          lastDailyClaim: today,
          toast: {
            id: seq++,
            tone: "reward",
            message: t("第 {day} 天签到：+{coins} 金币", { day, coins: reward.coins }) + (reward.gems ? t(" · +{n} 宝石", { n: reward.gems }) : ""),
          },
        }));
        return { coins: reward.coins, gems: reward.gems, day };
      },

      claimDailyMission: (id) => {
        get().refreshDaily();
        const s = get();
        const mission = evaluateDailyMissions(s.dailyDate, s.dailyProgress, s.dailyClaimed).find(
          (m) => m.id === id
        );
        if (!mission || !mission.claimable) return null;
        set((state) => ({
          coins: state.coins + mission.rewardCoins,
          gems: state.gems + mission.rewardGems,
          dailyClaimed: [...state.dailyClaimed, mission.id],
          toast: {
            id: seq++,
            tone: "reward",
            message: t("每日任务「{name}」+{coins} 金币", { name: t(mission.title), coins: mission.rewardCoins }) + (mission.rewardGems ? t(" · +{n} 宝石", { n: mission.rewardGems }) : ""),
          },
        }));
        return { coins: mission.rewardCoins, gems: mission.rewardGems };
      },

      claimSeasonReward: (tier, track) => {
        const s = get();
        const def = SEASON_TIERS.find((t) => t.tier === tier);
        if (!def) return false;
        if (tier > seasonTierFor(s.seasonXp)) {
          s.notify(t("通行证等级不足，先完成对局积累赛季经验"), "info");
          return false;
        }
        if (track === "premium" && !s.seasonPassUnlocked) {
          s.notify(t("珍藏通行证尚未解锁"), "info");
          return false;
        }
        const key = `${track}-${tier}`;
        if (s.seasonClaimed.includes(key)) return false;
        const reward = def[track];
        set((state) => ({
          coins: state.coins + reward.coins,
          gems: state.gems + reward.gems,
          seasonClaimed: [...state.seasonClaimed, key],
          toast: {
            id: seq++,
            tone: "reward",
            message: t("赛季奖励 {tier} 级（{track}）+{coins} 金币", { tier, track: track === "free" ? t("免费") : t("珍藏"), coins: reward.coins }) + (reward.gems ? t(" · +{n} 宝石", { n: reward.gems }) : ""),
          },
        }));
        return true;
      },

      unlockSeasonPass: () => {
        const s = get();
        if (s.seasonPassUnlocked) return true;
        if (s.gems < SEASON.passCostGems) {
          s.notify(t("还差 {n} 宝石，签到与成就都能获得宝石", { n: SEASON.passCostGems - s.gems }), "error");
          return false;
        }
        set((state) => ({
          gems: state.gems - SEASON.passCostGems,
          seasonPassUnlocked: true,
          toast: { id: seq++, tone: "reward", message: t("珍藏通行证已解锁，双轨奖励均可领取！") },
        }));
        return true;
      },

      claimAchievement: (id) => {
        const s = get();
        const metrics = metricsOf(s);
        const ach = evaluateAchievements(metrics, s.achievementsClaimed).find((a) => a.id === id);
        if (!ach || !ach.claimable) return false;
        set((state) => ({
          coins: state.coins + ach.coins,
          gems: state.gems + ach.gems,
          achievementsClaimed: [...state.achievementsClaimed, ach.id],
          toast: {
            id: seq++,
            tone: "reward",
            message: `${t("成就「{name}」+{coins} 金币", { name: t(ach.title), coins: ach.coins })}${ach.gems ? t(" · +{n} 宝石", { n: ach.gems }) : ""}${
              ach.titleId ? t("，新称号已解锁") : ""
            }`,
          },
        }));
        return true;
      },

      setTitle: (id) => {
        const s = get();
        const metrics = metricsOf(s);
        const title = TITLES.find((t) => t.id === id);
        if (!title) return;
        if (!title.unlock(metrics)) {
          s.notify(t("称号「{name}」尚未解锁：{desc}", { name: t(title.name), desc: t(title.desc) }), "info");
          return;
        }
        set({ title: id, toast: { id: seq++, tone: "success", message: t("已佩戴称号「{name}」", { name: t(title.name) }) } });
      },

      completeOnboarding: (name, skin) => {
        const safeName = name.trim().slice(0, 12) || t("小蛇同学");
        set((s) => {
          const firstTime = !s.starterGranted;
          return {
            onboardingDone: true,
            guideOpen: false,
            starterGranted: true,
            playerName: safeName,
            equipped: s.owned.includes(skin) ? skin : s.equipped,
            activeSkin: s.owned.includes(skin) ? skin : s.equipped,
            coins: s.coins + (firstTime ? 300 : 0),
            gems: s.gems + (firstTime ? 5 : 0),
            runNonce: s.runNonce + 1,
            toast: firstTime
              ? { id: seq++, tone: "reward" as const, message: t("新手礼包已发放：+300 金币 · +5 宝石") }
              : { id: seq++, tone: "info" as const, message: t("欢迎回到纸格竞技场") },
          };
        });
      },

      replayOnboarding: () => set({ guideOpen: true, settingsOpen: false }),

      setVolume: (channel, value) => {
        const v = Math.max(0, Math.min(1, value));
        if (channel === "master") set({ masterVolume: v });
        else if (channel === "sfx") set({ sfxVolume: v });
        else set({ bgmVolume: v });
      },

      startGame: (mode) => {
        if (!get().onboardingDone) {
          set({ mode, guideOpen: true });
          return;
        }
        get().refreshDaily();
        set((s) => ({
          phase: "playing",
          demo: false,
          mode,
          activeSkin: s.equipped,
          hud: null,
          result: null,
          banner: null,
          revivedThisRun: false,
          runNonce: s.runNonce + 1,
          closetOpen: false,
          settingsOpen: false,
          missionsOpen: false,
          dailyOpen: false,
          profileOpen: false,
        }));
      },

      retry: () =>
        set((s) => ({
          phase: "playing",
          demo: false,
          revivedThisRun: false,
          activeSkin: s.equipped,
          hud: null,
          result: null,
          banner: null,
          runNonce: s.runNonce + 1,
          dailyOpen: false,
          profileOpen: false,
          closetOpen: false,
          missionsOpen: false,
          settingsOpen: false,
          guideOpen: false,
        })),

      goMenu: () =>
        set((s) => ({
          phase: "menu",
          demo: true,
          hud: null,
          result: null,
          banner: null,
          runNonce: s.runNonce + 1,
          activeSkin: s.equipped,
          dailyOpen: false,
          profileOpen: false,
          closetOpen: false,
          missionsOpen: false,
          settingsOpen: false,
          guideOpen: false,
        })),

      pause: () => {
        if (get().phase === "playing") set({ phase: "paused" });
      },
      resume: () => {
        if (get().phase === "paused") set({ phase: "playing" });
      },
      setHud: (hud) => set({ hud }),

      pushBanner: (title, subtitle, tone = "gold") =>
        set({ banner: { id: seq++, title, subtitle, tone } }),
      clearBanner: () => set({ banner: null }),

      completeRun: (result) => {
        if (get().lastAwardedRun === result.runId) return;
        const today = todayKey();
        const earnedXp = seasonXpFromRun({
          length: result.length,
          kills: result.kills,
          rank: result.rank,
          mode: result.mode,
        });
        set((s) => {
          const baseDaily = s.dailyDate === today ? s.dailyProgress : { ...EMPTY_DAILY };
          const dailyProgress: DailyProgress = {
            orbs: baseDaily.orbs + result.orbsEaten,
            kills: baseDaily.kills + result.kills,
            runs: baseDaily.runs + 1,
            bestLength: Math.max(baseDaily.bestLength, result.length),
            kingWins: baseDaily.kingWins + (result.rank === 1 ? 1 : 0),
          };
          return {
            lastAwardedRun: result.runId,
            result,
            phase: "result",
            banner: null,
            coins: s.coins + result.coins,
            gems: s.gems + (result.rank === 1 ? 2 : result.rank <= 3 ? 1 : 0),
            rp: s.rp + result.rpGain,
            seasonXp: Math.min(SEASON.maxTier * 1000, s.seasonXp + earnedXp),
            bestLength: Math.max(s.bestLength, result.length),
            totalRuns: s.totalRuns + 1,
            totalKills: s.totalKills + result.kills,
            bestStreak: Math.max(s.bestStreak, result.bestStreak),
            kingCount: s.kingCount + (result.rank === 1 ? 1 : 0),
            totalOrbs: s.totalOrbs + result.orbsEaten,
            dailyDate: today,
            dailyProgress,
            dailyClaimed: s.dailyDate === today ? s.dailyClaimed : [],
            hud: s.hud,
            history: [
              {
                length: result.length,
                rank: result.rank,
                kills: result.kills,
                bestStreak: result.bestStreak,
                rpGain: result.rpGain,
                orbsEaten: result.orbsEaten,
                seasonXp: earnedXp,
                mode: result.mode,
                at: Date.now(),
                skin: result.skin,
              },
              ...s.history,
            ].slice(0, 20),
            toast: {
              id: seq++,
              tone: "reward",
              message: t("对局结算 +{coins} 金币 · +{rp} RP · +{xp} 赛季经验", { coins: result.coins, rp: result.rpGain, xp: earnedXp }),
            },
          };
        });
      },

      buySkin: (id) => {
        const skin = getSkin(id);
        const s = get();
        if (s.owned.includes(id)) return true;
        if (s.coins < skin.price) {
          get().notify(t("还差 {n} 金币，完成每日任务或跑一局即可解锁", { n: skin.price - s.coins }), "error");
          return false;
        }
        set((state) => ({
          coins: state.coins - skin.price,
          owned: [...state.owned, id],
          equipped: id,
          activeSkin: state.demo ? id : state.activeSkin,
          runNonce: state.demo ? state.runNonce + 1 : state.runNonce,
          toast: { id: seq++, message: t("解锁并穿戴「{name}」！", { name: skinName(skin) }), tone: "success" },
        }));
        return true;
      },

      equipSkin: (id) => {
        if (!get().owned.includes(id)) {
          get().notify(t("先解锁这款皮肤吧"), "info");
          return;
        }
        set((s) => ({
          equipped: id,
          activeSkin: s.demo ? id : s.activeSkin,
          runNonce: s.demo ? s.runNonce + 1 : s.runNonce,
        }));
      },

      cycleOwnedSkin: (delta) => {
        const s = get();
        if (s.owned.length <= 1) return;
        const idx = s.owned.indexOf(s.equipped);
        const nextIdx = (idx + delta + s.owned.length) % s.owned.length;
        const nextId = s.owned[nextIdx];
        set({
          equipped: nextId,
          activeSkin: s.demo ? nextId : s.activeSkin,
          runNonce: s.demo ? s.runNonce + 1 : s.runNonce,
        });
      },

      claimMission: (missionId) => {
        const s = get();
        const list = evaluateMissions(metricsOf(s), s.claimedMissions);
        const target = list.find((m) => m.id === missionId);
        if (!target || !target.claimable) return 0;
        set((state) => ({
          coins: state.coins + target.reward,
          claimedMissions: [...state.claimedMissions, missionId],
          toast: {
            id: seq++,
            tone: "reward",
            message: t("生涯赏金「{name}」+{coins} 金币！", { name: t(target.title), coins: target.reward }),
          },
        }));
        return target.reward;
      },

      claimAllMissions: () => {
        const s = get();
        const list = evaluateMissions(metricsOf(s), s.claimedMissions);
        const ready = list.filter((m) => m.claimable);
        if (ready.length === 0) return 0;
        const sum = ready.reduce((acc, m) => acc + m.reward, 0);
        set((state) => ({
          coins: state.coins + sum,
          claimedMissions: [...state.claimedMissions, ...ready.map((m) => m.id)],
          toast: {
            id: seq++,
            tone: "reward",
            message: t("一键领取 {n} 项生涯赏金，共 +{coins} 金币！", { n: ready.length, coins: sum }),
          },
        }));
        return sum;
      },

      toggleSound: () => set((s) => ({ sound: !s.sound })),
      toggleBgm: () => set((s) => ({ bgm: !s.bgm })),
      toggleHaptics: () => set((s) => ({ haptics: !s.haptics })),
      toggleDirectionArrow: () => set((s) => ({ showDirectionArrow: !s.showDirectionArrow })),
      toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
      toggleShowNames: () => set((s) => ({ showNames: !s.showNames })),
      toggleForceTouchControls: () => set((s) => ({ forceTouchControls: !s.forceTouchControls })),
      rename: (name) => set({ playerName: name.trim().slice(0, 12) || t("小蛇同学") }),
      notify: (message, tone = "success") => set({ toast: { id: seq++, message, tone } }),
      dismissToast: () => set({ toast: null }),
      resetProgress: () =>
        set({
          coins: INITIAL_COINS,
          gems: INITIAL_GEMS,
          rp: 0,
          owned: [...FREE_SKINS],
          equipped: DEFAULT_SKIN,
          activeSkin: DEFAULT_SKIN,
          title: "rookie",
          bestLength: 0,
          totalRuns: 0,
          totalKills: 0,
          bestStreak: 0,
          kingCount: 0,
          totalOrbs: 0,
          claimedMissions: [],
          achievementsClaimed: [],
          dailyStreak: 0,
          lastDailyClaim: "",
          dailyDate: todayKey(),
          dailyProgress: { ...EMPTY_DAILY },
          dailyClaimed: [],
          seasonXp: 0,
          seasonClaimed: [],
          seasonPassUnlocked: false,
          history: [],
          lastAwardedRun: null,
        }),
    }),
    {
      name: "snake-arena-save-v1",
      partialize: (s) => ({
        coins: s.coins,
        gems: s.gems,
        rp: s.rp,
        owned: s.owned,
        equipped: s.equipped,
        title: s.title,
        onboardingDone: s.onboardingDone,
        starterGranted: s.starterGranted,
        sound: s.sound,
        bgm: s.bgm,
        haptics: s.haptics,
        masterVolume: s.masterVolume,
        sfxVolume: s.sfxVolume,
        bgmVolume: s.bgmVolume,
        showDirectionArrow: s.showDirectionArrow,
        showMinimap: s.showMinimap,
        showNames: s.showNames,
        forceTouchControls: s.forceTouchControls,
        lang: s.lang,
        difficulty: s.difficulty,
        playerName: s.playerName,
        bestLength: s.bestLength,
        totalRuns: s.totalRuns,
        totalKills: s.totalKills,
        bestStreak: s.bestStreak,
        kingCount: s.kingCount,
        totalOrbs: s.totalOrbs,
        claimedMissions: s.claimedMissions,
        achievementsClaimed: s.achievementsClaimed,
        dailyDate: s.dailyDate,
        dailyStreak: s.dailyStreak,
        lastDailyClaim: s.lastDailyClaim,
        dailyProgress: s.dailyProgress,
        dailyClaimed: s.dailyClaimed,
        seasonXp: s.seasonXp,
        seasonClaimed: s.seasonClaimed,
        seasonPassUnlocked: s.seasonPassUnlocked,
        history: s.history,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<GameStore>;
        const owned = Array.from(new Set([...(saved.owned ?? []), ...FREE_SKINS]));
        const equipped = saved.equipped ?? current.equipped;
        const title = saved.title && TITLES.some((t) => t.id === saved.title) ? saved.title : "rookie";
        const legacyProgress = (saved.totalRuns ?? 0) > 0 || (saved.bestLength ?? 0) > 0;
        const lang: Lang = saved.lang === "en" || saved.lang === "zh" ? saved.lang : detectLang();
        setLang(lang);
        const difficulty: Difficulty = saved.difficulty === "easy" || saved.difficulty === "hard" ? saved.difficulty : "normal";
        return {
          ...current,
          ...saved,
          owned,
          equipped,
          activeSkin: equipped,
          title,
          lang,
          difficulty,
          playerName: saved.playerName ?? (lang === "en" ? "Snakelet" : current.playerName),
          onboardingDone: saved.onboardingDone ?? legacyProgress,
          starterGranted: saved.starterGranted ?? legacyProgress,
          dailyProgress: { ...EMPTY_DAILY, ...(saved.dailyProgress ?? {}) },
          dailyClaimed: saved.dailyClaimed ?? [],
          seasonClaimed: saved.seasonClaimed ?? [],
          achievementsClaimed: saved.achievementsClaimed ?? [],
          claimedMissions: saved.claimedMissions ?? [],
          lastAwardedRun: null,
          lastDailyClaim: saved.lastDailyClaim ?? "",
        } as GameStore;
      },
    }
  )
);

/** Small helper shared by UI: current honour title descriptor. */
export function currentTitle(s: GameStore) {
  return getTitle(s.title);
}

/** Haptic helper (mobile only, fails silently). */
export function vibrate(pattern: number | number[], enabled: boolean): void {
  if (!enabled || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}

export type { GameEvent };
