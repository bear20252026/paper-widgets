import { useState } from "react";
import type { RunResult } from "../game/types";
import { getRankTier } from "../game/progression";
import { buildShareText, getTitle, seasonXpFromRun } from "../game/meta";
import { useGameStore } from "../store/gameStore";
import { Icon } from "./Icon";
import { Overlay, Progress, StatTile } from "./uiKit";
import { SnakePreview } from "./SnakePreview";
import { useT } from "../i18n/useT";

export function Results({ result }: { result: RunResult; bestLength: number }) {
  const t = useT();
  const s = useGameStore();
  const [copied, setCopied] = useState(false);
  const tier = getRankTier(s.rp);
  const finished = !result.deathReason && result.mode === "timed";
  const seconds = Math.floor(result.timeMs / 1000);
  const title = result.rank === 1 ? t("这一局，你是蛇王。") : result.isRecord ? t("又长大了一点。") : t("绕个弯，下局见。");
  const reason = finished ? t("三分钟到了，今天的故事先写到这里。") : result.deathReason === "wall" ? t("下次靠近边界时，早点转个弯。") : result.killerName ? t("这次被「{name}」拦住了去路。", { name: result.killerName }) : t("不小心碰到了别人的身体。");
  const share = async () => {
    const text = buildShareText({ playerName: s.playerName, length: result.length, rank: result.rank, kills: result.kills, bestStreak: result.bestStreak, mode: result.mode, tierName: t(tier.name), titleName: t(getTitle(s.title).name) });
    try {
      if (navigator.share) await navigator.share({ title: t("纸格竞技场 · 对局记录"), text });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); setCopied(true); }
      else s.notify(t("当前浏览器不支持剪贴板"), "info");
    } catch { s.notify(t("分享已取消"), "info"); }
  };
  const xp = seasonXpFromRun(result);
  const diffBonus = result.coinBreakdown.difficultyBonus ?? 0;
  return <Overlay onClose={s.goMenu} className="max-w-[500px]" z="z-40">
    <div className="result-sheet">
      <div className="result-topline"><span>FIELD NOTES / {result.mode === "timed" ? "03:00" : "ENDLESS"}{result.difficulty && result.difficulty !== "normal" ? ` / ${result.difficulty.toUpperCase()}` : ""}</span><button type="button" className="icon-button" aria-label={t("返回主页")} onClick={s.goMenu}><Icon name="close" /></button></div>
      <SnakePreview skin={result.skin} width={230} height={105} orbs={false} />
      {result.isRecord && <span className="record-stamp">{t("新纪录")}</span>}
      <h2>{title}</h2><p>{reason}</p>
      <div className="result-stats"><StatTile label={t("本局长度")} value={`${result.length} m`} /><StatTile label={t("最终排名")} value={`#${result.rank}`} /><StatTile label={t("击败对手")} value={result.kills} /></div>
      <div className="result-footnote"><span>{t("存活 {m}分{s}秒", { m: Math.floor(seconds / 60), s: seconds % 60 })}</span><span>{t("最高 {n}m", { n: result.maxLength })}</span><span>{t("吞噬 {n} 颗光点", { n: result.orbsEaten })}</span>{(result.powersCollected ?? 0) > 0 && <span>{t("道具 {n} 个", { n: result.powersCollected ?? 0 })}</span>}{result.revived && <span>{t("已复活")}</span>}</div>
      <div className="result-reward"><span><Icon name="coin" />{t("金币已入账")}{diffBonus !== 0 && <small>{t("难度加成 {n}", { n: `${diffBonus > 0 ? "+" : ""}${diffBonus}` })}</small>}</span><strong>+{result.coins}</strong></div>
      <div className="result-progress"><span>{t(tier.name)}<small>{t("+{rp} RP · +{xp} 旅券经验", { rp: result.rpGain, xp })}</small></span><Progress value={tier.progress} max={1} /></div>
      <div className="result-actions"><button className="play-button" type="button" onClick={s.retry}>{t("再来一局")}<Icon name="arrow" /></button><button type="button" className="small-button" onClick={s.goMenu}>{t("回游乐场")}</button></div>
      <button type="button" className="text-link result-share" onClick={share}>{copied ? t("战报已复制") : t("分享这次冒险")}<Icon name={copied ? "check" : "arrow"} /></button>
    </div>
  </Overlay>;
}
