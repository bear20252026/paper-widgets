import { useState } from "react";
import type { GameEngine } from "../game/engine";
import type { PowerKind } from "../game/types";
import { getSkin } from "../game/skins";
import { POWER_INFO } from "../game/powerups";
import { useGameStore } from "../store/gameStore";
import { Joystick } from "./Joystick";
import { Minimap } from "./Minimap";
import { Icon, type IconName } from "./Icon";
import { useT } from "../i18n/useT";

function formatTime(ms: number) { const seconds = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

const POWER_ICON: Record<PowerKind, IconName> = { magnet: "magnet", shield: "shield", turbo: "bolt", double: "double" };
const POWER_NAME: Record<PowerKind, string> = { magnet: "磁铁", shield: "护盾", turbo: "疾风", double: "双倍" };

export function Hud({ engine, isTouch }: { engine: GameEngine; isTouch: boolean }) {
  const t = useT();
  const hud = useGameStore((s) => s.hud);
  const phase = useGameStore((s) => s.phase);
  const mode = useGameStore((s) => s.mode);
  const banner = useGameStore((s) => s.banner);
  const showMap = useGameStore((s) => s.showMinimap);
  const showNames = useGameStore((s) => s.showNames);
  const force = useGameStore((s) => s.forceTouchControls);
  const haptics = useGameStore((s) => s.haptics);
  const [expanded, setExpanded] = useState(!isTouch && !force);
  const touch = isTouch || force;
  const active = phase === "playing";
  const length = hud?.displayLength ?? 60;
  const canBoost = hud?.canBoost ?? false;
  const boosting = hud?.boosting ?? false;
  const rows = hud?.leaderboard ?? [];
  const circumference = 2 * Math.PI * 44;
  const turbo = hud?.powers.some((p) => p.kind === "turbo") ?? false;
  const ratio = turbo ? 1 : Math.max(0, Math.min(1, (length - 30) / 100));
  const now = hud?.timeMs ?? 0;
  const feed = (hud?.killFeed ?? []).filter((k) => now - k.at < 6000);

  return <div className={`battle-hud ${phase === "downed" ? "is-downed" : ""}`}>
    <div className={`battle-clock ${mode === "timed" && (hud?.timeLeftMs ?? 180000) < 30000 ? "is-urgent" : ""}`}><Icon name={mode === "timed" ? "clock" : "infinity"} /><strong>{formatTime(mode === "timed" ? hud?.timeLeftMs ?? 180000 : hud?.timeMs ?? 0)}</strong><span>{mode === "timed" ? t("竞速") : t("无尽")}</span></div>
    {banner && <div className="combat-note" key={banner.id} data-tone={banner.tone}><Icon name={banner.tone === "gold" ? "crown" : "spark"} /><span><strong>{banner.title}</strong><small>{banner.subtitle}</small></span></div>}
    <section className="battle-score"><span className="score-label">{t("当前长度")}</span><div><strong>{length}</strong><span>{t("米")}</span></div><p><b>#{hud?.rank ?? 1}</b> / {hud?.total ?? 13}<span>{t("{n} 击败", { n: hud?.kills ?? 0 })}</span>{(hud?.streak ?? 0) > 1 && <em>{t("{n} 连杀", { n: hud!.streak })}</em>}</p>
      <small>{hud?.boss ? t("黄金巨蟒 {n}m", { n: hud.boss.length }) : hud?.tideActive ? t("能量潮汐开启") : t("潮汐倒计时 {n}s", { n: Math.ceil((hud?.nextTideInMs ?? 0) / 1000) })}</small>
      {(hud?.powers.length ?? 0) > 0 && <ul className="power-chips" aria-label={t("生效中的道具")}>
        {hud!.powers.map((p) => <li key={p.kind} style={{ ["--power" as string]: POWER_INFO[p.kind].color }} className={p.leftMs < 1500 ? "is-ending" : ""}>
          <Icon name={POWER_ICON[p.kind]} /><span>{t(POWER_NAME[p.kind])}</span><b>{Math.ceil(p.leftMs / 1000)}s</b>
          <i style={{ transform: `scaleX(${Math.min(1, p.leftMs / p.totalMs)})` }} />
        </li>)}
      </ul>}
    </section>
    {feed.length > 0 && <ol className="kill-feed" aria-live="polite">{feed.map((k) => {
      const mine = k.killer === hud?.leaderboard.find((r) => r.isPlayer)?.name || k.killer === useGameStore.getState().playerName;
      return <li key={k.id} className={mine ? "is-mine" : ""}><span>{k.killer}</span><Icon name={k.wasKing ? "crown" : "swords"} /><span>{k.victim}</span>{(k.streak ?? 0) >= 2 && <em>×{k.streak}</em>}</li>;
    })}</ol>}
    {hud?.graze && <p className="wall-warning">{t("靠近边界，请及时转向")}</p>}
    <section className={`battle-ranking ${expanded ? "is-expanded" : ""}`}>
      <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} aria-label={t("展开或收起实时前十排名")}><span>{t("长度榜")} <small>TOP 10</small></span><Icon name="chevron" /></button>
      <ol>{rows.map((row, i) => <li key={row.id} className={row.isPlayer ? "is-player" : ""}><span className="rank-index">{i === 0 ? <Icon name="crown" /> : String(i + 1).padStart(2, "0")}</span><i style={{ background: getSkin(row.skin).head }} /><span className="rank-name">{showNames || row.isPlayer ? row.name : t("对手 {n}", { n: row.id })}</span><b>{row.length}</b></li>)}</ol>
      {!rows.some((s) => s.isPlayer) && <div className="ranking-self">#{hud?.rank ?? 1} {t("你")} <b>{length}</b></div>}
    </section>
    <div className="battle-left-control">{touch ? <Joystick onVector={(x, y) => active && engine.setPlayerVector(x, y)} deadZone={Math.min(.26, .08 + length / 2600)} haptics={haptics} /> : showMap && <Minimap radar={hud?.radar} size={110} />}</div>
    {touch && showMap && <div className="touch-radar"><Minimap radar={hud?.radar} size={72} /></div>}
    <div className="battle-boost"><div><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="#dce2d1" strokeWidth="3" /><circle cx="50" cy="50" r="44" fill="none" stroke={turbo ? POWER_INFO.turbo.color : boosting ? "#d2a84c" : "#8eaa91"} strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - ratio)} /></svg>
      <button type="button" aria-label={canBoost ? t("按住加速") : t("长度不足，无法加速")} disabled={!canBoost || !active} className={`${boosting ? "is-boosting" : ""} ${turbo ? "is-turbo" : ""}`} onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); engine.setBoost(true); }} onPointerUp={() => engine.setBoost(false)} onPointerCancel={() => engine.setBoost(false)} onLostPointerCapture={() => engine.setBoost(false)} onContextMenu={(e) => e.preventDefault()}>
        <Icon name={turbo ? "bolt" : canBoost ? "arrow" : "lock"} /><span>{canBoost ? boosting ? t("冲刺中") : turbo ? t("免费冲刺") : t("加速") : t("长度 ≤ 30")}</span>
      </button></div><small>{touch ? t("按住加速") : t("左键 / 空格")}</small>
    </div>
  </div>;
}
