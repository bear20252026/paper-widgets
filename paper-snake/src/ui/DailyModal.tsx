import { useEffect, useState } from "react";
import { SEASON, SEASON_TIERS, SIGN_IN_REWARDS, evaluateDailyMissions, nextSignInDay, seasonTierFor, seasonTierProgress, todayKey } from "../game/meta";
import { useGameStore } from "../store/gameStore";
import { audio } from "../lib/audio";
import { Overlay, ModalHeader, Tabs, RewardChip, Progress } from "./uiKit";
import { Icon, Motif } from "./Icon";
import { useT } from "../i18n/useT";

export function DailyModal() {
  const open = useGameStore((s) => s.dailyOpen);
  return open ? <CollectionBook /> : null;
}

function CollectionBook() {
  const t = useT();
  const s = useGameStore();
  const [tab, setTab] = useState("signin");
  useEffect(() => { useGameStore.getState().refreshDaily(); }, []);
  const claimedToday = s.lastDailyClaim === todayKey();
  const day = nextSignInDay(s.dailyStreak);
  const completed = claimedToday ? ((s.dailyStreak - 1) % 7) + 1 : s.dailyStreak % 7;
  const missions = evaluateDailyMissions(s.dailyDate, s.dailyProgress, s.dailyClaimed);
  const level = seasonTierFor(s.seasonXp);
  const progress = seasonTierProgress(s.seasonXp);
  const claim = () => { if (s.claimSignIn()) audio.reward(); };
  return <Overlay onClose={() => s.setDailyOpen(false)} className="max-w-[820px]">
    <ModalHeader eyebrow="LITTLE THINGS ADD UP" title={t("收集与奖励")} subtitle={t("慢慢来。错过一天，也不会清空你的积累。")} onClose={() => s.setDailyOpen(false)} right={<RewardChip coins={s.coins} gems={s.gems} />} />
    <div className="notebook-tabs"><Tabs value={tab} onChange={setTab} items={[{ id: "signin", label: t("每日签到") }, { id: "daily", label: t("今日任务"), badge: missions.filter((m) => m.claimable).length }, { id: "season", label: t("纸格旅券") }]} /></div>
    <div className="notebook-body">
      {tab === "signin" && <>
        <div className="section-intro"><div><span className="collection-label">ONE DAY AT A TIME</span><h3>{t("今天，也来游一会儿。")}</h3><p>{t("已累计签到 {n} 天。每 7 天完成一轮，漏签不重置。", { n: s.dailyStreak })}</p></div><Icon name="gift" /></div>
        <div className="signin-calendar">{SIGN_IN_REWARDS.map((reward) => {
          const claimed = reward.day <= completed;
          const current = !claimedToday && reward.day === day;
          return <button key={reward.day} type="button" className={`calendar-day ${current ? "is-today" : ""} ${claimed ? "is-claimed" : ""}`} disabled={!current} onClick={claim} aria-label={t("第{day}天，{state}", { day: reward.day, state: current ? t("领取签到奖励") : claimed ? t("已领取") : t("尚未解锁") })}>
            <small>DAY {String(reward.day).padStart(2, "0")}</small><Icon name={claimed ? "check" : reward.day === 7 ? "gift" : "coin"} /><strong>{reward.coins}</strong><span>{reward.gems ? t("+{n} 宝石", { n: reward.gems }) : t("金币")}</span>
          </button>;
        })}</div>
        <div className="section-bottom"><small>{t("按本地日期每日领取一次，不需要连续登录。")}</small><button type="button" className="small-button" disabled={claimedToday} onClick={claim}>{claimedToday ? t("今日已领取") : t("领取第 {day} 天奖励", { day })}</button></div>
      </>}
      {tab === "daily" && <><div className="section-intro"><div><h3>{t("给这一局，一个小目标。")}</h3><p>{t("每日零点更新，完成对局后自动结算进度。")}</p></div></div><div className="notebook-list">{missions.map((m) => <article className="notebook-row" key={m.id}>
        <span className="row-motif"><Motif value={m.id} /></span><div className="row-copy"><h3>{t(m.title)}</h3><p>{t(m.desc)}</p><div className="row-progress"><Progress value={m.progress} max={m.target} /><small>{m.progress}/{m.target}</small></div></div>
        <div className="row-action"><RewardChip coins={m.rewardCoins} gems={m.rewardGems} /><button type="button" className="small-button" disabled={!m.claimable} onClick={() => { if (s.claimDailyMission(m.id)) audio.reward(); }}>{m.claimed ? t("已领取") : m.claimable ? t("领取奖励") : t("进行中")}</button></div>
      </article>)}</div></>}
      {tab === "season" && <>
        <div className="section-intro"><div><span className="collection-label">PAPER JOURNAL / S1</span><h3>{t("纸格初夏")}</h3><p>{t("本地常驻奖励册。玩一局，就离下一页更近一点。")}</p></div><strong className="journal-level">{String(level).padStart(2, "0")}<small>/ 20</small></strong></div>
        <Progress value={progress.into} max={progress.needed} tone="gold" /><div className="journal-caption"><span>{progress.into} / {progress.needed} XP</span><span>{t("免费路线无需解锁")}</span></div>
        <div className="journal-track"><div><Icon name="gem" /><span>{s.seasonPassUnlocked ? t("珍藏路线已开启") : t("珍藏路线 · {n} 宝石", { n: SEASON.passCostGems })}</span></div><button className="text-link" type="button" disabled={s.seasonPassUnlocked} onClick={() => { if (s.unlockSeasonPass()) audio.reward(); }}>{s.seasonPassUnlocked ? t("已解锁") : t("用宝石解锁")}<Icon name={s.seasonPassUnlocked ? "check" : "arrow"} /></button></div>
        <div className="season-table"><div className="season-table-head"><span>{t("等级")}</span><span>{t("免费路线")}</span><span>{t("珍藏路线")}</span></div>{SEASON_TIERS.map((tierRow) => <div key={tierRow.tier} className={`season-row ${level >= tierRow.tier ? "is-unlocked" : ""}`}><strong>{String(tierRow.tier).padStart(2, "0")}</strong>{(["free", "premium"] as const).map((track) => {
          const key = `${track}-${tierRow.tier}`; const claimed = s.seasonClaimed.includes(key); const unlocked = level >= tierRow.tier && (track === "free" || s.seasonPassUnlocked);
          return <div key={track}><RewardChip coins={tierRow[track].coins} gems={tierRow[track].gems} /><button type="button" disabled={claimed || !unlocked} onClick={() => { if (s.claimSeasonReward(tierRow.tier, track)) audio.reward(); }} aria-label={t("领取{tier}级{track}奖励", { tier: tierRow.tier, track: track === "free" ? t("免费") : t("珍藏") })}><Icon name={claimed ? "check" : unlocked ? "download" : "lock"} /></button></div>;
        })}</div>)}</div>
        <p className="fine-print">{t("宝石只能通过游玩、签到和成就获得。本游戏没有现金支付。")}</p>
      </>}
    </div>
  </Overlay>;
}