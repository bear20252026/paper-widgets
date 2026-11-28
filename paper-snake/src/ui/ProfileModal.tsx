import { useState } from "react";
import { getRankTier } from "../game/progression";
import { TITLES, evaluateAchievements, getTitle, seasonTierFor } from "../game/meta";
import { getSkin, SKINS, skinName } from "../game/skins";
import { useT } from "../i18n/useT";
import { locale } from "../i18n";
import { useGameStore, metricsOf } from "../store/gameStore";
import { audio } from "../lib/audio";
import { Overlay, ModalHeader, Tabs, Progress, RewardChip, StatTile } from "./uiKit";
import { BrandMark, Icon, Motif } from "./Icon";

export function ProfileModal() {
  const open = useGameStore((s) => s.profileOpen);
  return open ? <Notebook /> : null;
}

function Notebook() {
  const t = useT();
  const s = useGameStore();
  const [tab, setTab] = useState("journey");
  const tier = getRankTier(s.rp);
  const metrics = metricsOf(s);
  const achievements = evaluateAchievements(metrics, s.achievementsClaimed);
  const title = getTitle(s.title);
  return (
    <Overlay onClose={() => s.setProfileOpen(false)} className="max-w-[820px]">
      <ModalHeader eyebrow="YOUR FIELD NOTES" title={t("成长手册")} subtitle={t("每一次出发，都算数。")} onClose={() => s.setProfileOpen(false)} right={<span className="notebook-name"><Icon name="user" />{s.playerName}</span>} />
      <div className="notebook-tabs"><Tabs value={tab} onChange={setTab} items={[{ id: "journey", label: t("我的旅程") }, { id: "achievements", label: t("成就"), badge: achievements.filter((a) => a.claimable).length }, { id: "titles", label: t("称号") }, { id: "history", label: t("对局记录") }]} /></div>
      <div className="notebook-body">
        {tab === "journey" && <>
          <section className="journey-rank">
            <BrandMark /><div><span className="collection-label">{t(title.name)}</span><h3>{t(tier.name)}</h3><p>{s.rp} RP {tier.nextRp ? ` / ${tier.nextRp} RP` : ` / ${t("最高段位")}`}</p><Progress value={tier.progress} max={1} /></div>
          </section>
          <div className="journey-stats"><StatTile label={t("最长一局")} value={`${s.bestLength}m`} /><StatTile label={t("完成对局")} value={s.totalRuns} /><StatTile label={t("击败对手")} value={s.totalKills} /><StatTile label={t("造型收藏")} value={`${s.owned.length}/${SKINS.length}`} /></div>
          <div className="notebook-links">
            <button type="button" onClick={() => s.setDailyOpen(true)}><Icon name="gift" /><span><strong>{t("每日收集与纸格旅券")}</strong><small>{t("签到、每日任务、Lv.{n} 旅券奖励", { n: seasonTierFor(s.seasonXp) })}</small></span><Icon name="arrow" /></button>
            <button type="button" onClick={() => s.setMissionsOpen(true)}><Icon name="crown" /><span><strong>{t("生涯挑战与段位")}</strong><small>{t("给下一局定一个小目标")}</small></span><Icon name="arrow" /></button>
            <button type="button" onClick={() => s.setClosetOpen(true)}><Icon name="kite" /><span><strong>{t("继续收集新造型")}</strong><small>{t("金币只用来购买外观，不影响对局数值")}</small></span><Icon name="arrow" /></button>
          </div>
        </>}
        {tab === "achievements" && <div className="notebook-list">{achievements.map((a) => <article key={a.id} className="notebook-row">
          <span className="row-motif"><Motif value={a.id} /></span><div className="row-copy"><h3>{t(a.title)}</h3><p>{t(a.desc)}</p><div className="row-progress"><Progress value={a.progress} max={a.target} /><small>{a.progress}/{a.target}</small></div></div>
          <div className="row-action"><RewardChip coins={a.coins} gems={a.gems} />{a.claimable ? <button type="button" className="small-button" onClick={() => { if (s.claimAchievement(a.id)) audio.reward(); }}>{t("领取奖励")}</button> : <small>{a.claimed ? t("已领取") : t("继续探索")}</small>}</div>
        </article>)}</div>}
        {tab === "titles" && <div className="titles-list">{TITLES.map((item) => {
          const unlocked = item.unlock(metrics); const current = item.id === s.title;
          return <button key={item.id} type="button" className={`title-choice ${current ? "is-active" : ""}`} disabled={!unlocked} onClick={() => s.setTitle(item.id)}>
            <Motif value={item.id} /><span><strong>{t(item.name)}</strong><small>{t(item.desc)}</small></span><Icon name={current ? "check" : unlocked ? "arrow" : "lock"} />
          </button>;
        })}</div>}
        {tab === "history" && <div className="notebook-list">{s.history.length === 0 ? <div className="notebook-empty"><Icon name="leaf" /><h3>{t("空白的一页，也很好。")}</h3><p>{t("完成第一场对局，记录就会从这里开始。")}</p></div> : s.history.map((h, i) => <article key={`${h.at}-${i}`} className="notebook-row history-row">
          <span className="history-place">{String(h.rank).padStart(2, "0")}</span><div className="row-copy"><h3>{h.mode === "timed" ? t("三分钟竞速") : t("无尽漫游")}<span>{skinName(getSkin(h.skin))}</span></h3><p>{new Date(h.at).toLocaleString(locale(), { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div><div className="row-action"><strong>{h.length} m</strong><small>{t("{n} 击败 · +{rp} RP", { n: h.kills, rp: h.rpGain ?? 0 })}</small></div>
        </article>)}</div>}
      </div>
    </Overlay>
  );
}