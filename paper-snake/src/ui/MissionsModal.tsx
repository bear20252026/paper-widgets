import { useState } from "react";
import { evaluateMissions, getRankTier, RANK_TIERS } from "../game/progression";
import { useGameStore, metricsOf } from "../store/gameStore";
import { audio } from "../lib/audio";
import { Overlay, ModalHeader, Tabs, Progress, RewardChip } from "./uiKit";
import { Icon, Motif } from "./Icon";
import { useT } from "../i18n/useT";

export function MissionsModal() {
  const open = useGameStore((s) => s.missionsOpen);
  return open ? <Challenges /> : null;
}

function Challenges() {
  const t = useT();
  const s = useGameStore();
  const [tab, setTab] = useState("missions");
  const missions = evaluateMissions(metricsOf(s), s.claimedMissions);
  const ready = missions.filter((m) => m.claimable).length;
  const rank = getRankTier(s.rp);
  return <Overlay onClose={() => s.setMissionsOpen(false)} className="max-w-[760px]">
    <ModalHeader eyebrow="A LITTLE FURTHER" title={t("生涯挑战")} subtitle={`${t(rank.name)} · ${s.rp} RP`} onClose={() => s.setMissionsOpen(false)} />
    <div className="notebook-tabs"><Tabs value={tab} onChange={setTab} items={[{ id: "missions", label: t("长期目标"), badge: ready }, { id: "ranks", label: t("段位阶梯") }]} /></div>
    <div className="notebook-body">
      {tab === "missions" ? <><div className="section-intro"><div><h3>{t("不着急，慢慢变厉害。")}</h3><p>{t("完成目标后领取金币，用来收集新的造型。")}</p></div>{ready > 0 && <button type="button" className="small-button" onClick={() => { if (s.claimAllMissions()) audio.reward(); }}>{t("领取全部 {n} 项", { n: ready })}</button>}</div>
        <div className="notebook-list">{missions.map((m) => <article key={m.id} className="notebook-row"><span className="row-motif"><Motif value={m.id} /></span><div className="row-copy"><h3>{t(m.title)}</h3><p>{t(m.desc)}</p><div className="row-progress"><Progress value={m.progress} max={m.target} /><small>{m.progress}/{m.target}</small></div></div><div className="row-action"><RewardChip coins={m.reward} /><button type="button" className="small-button" disabled={!m.claimable} onClick={() => { if (s.claimMission(m.id)) audio.reward(); }}>{m.claimed ? t("已领取") : m.claimable ? t("领取") : t("进行中")}</button></div></article>)}</div>
      </> : <div className="notebook-list">{RANK_TIERS.map((r, i) => <article className="notebook-row" key={r.id}><span className="history-place">{String(i + 1).padStart(2, "0")}</span><div className="row-copy"><h3>{t(r.name)}</h3><p>{t("{n} RP 起", { n: r.minRp })}</p></div><div className="row-action">{rank.id === r.id ? <strong style={{ fontSize: 12 }}>{t("当前段位")}</strong> : s.rp >= r.minRp ? <Icon name="check" /> : <small>{t("还需 {n} RP", { n: r.minRp - s.rp })}</small>}</div></article>)}</div>}
    </div>
  </Overlay>;
}