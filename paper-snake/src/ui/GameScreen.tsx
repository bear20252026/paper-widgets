import { useEffect, useMemo, useRef, useState } from "react";
import { GameEngine } from "../game/engine";
import { hashSeed } from "../game/rng";
import { streakTitle } from "../game/progression";
import { audio } from "../lib/audio";
import { GameCanvas } from "../render/GameCanvas";
import type { PixiRenderer } from "../render/PixiRenderer";
import { useGameStore, vibrate } from "../store/gameStore";
import { Home } from "./Home";
import { Topbar } from "./Topbar";
import { Hud } from "./Hud";
import { Results } from "./Results";
import { SnakePreview } from "./SnakePreview";
import { Icon, BrandMark } from "./Icon";
import { Overlay } from "./uiKit";
import { useT } from "../i18n/useT";
import { t } from "../i18n";
import { REVIVE_COST } from "../store/gameStore";
import type { PowerKind } from "../game/types";

const POWER_BANNER: Record<PowerKind, [string, string]> = {
  magnet: ["磁铁吸附", "附近的光点会自己飞过来"],
  shield: ["护盾展开", "暂时无视其他蛇的身体"],
  turbo: ["疾风加速", "加速不消耗长度，任意长度都能冲刺"],
  double: ["双倍光点", "吞下的每颗光点价值翻倍"],
};

export function GameScreen() {
  const phase = useGameStore((s) => s.phase);
  const nonce = useGameStore((s) => s.runNonce);
  const sound = useGameStore((s) => s.sound);
  const bgm = useGameStore((s) => s.bgm);
  const master = useGameStore((s) => s.masterVolume);
  const sfx = useGameStore((s) => s.sfxVolume);
  const music = useGameStore((s) => s.bgmVolume);
  useEffect(() => { audio.setEnabled(sound); audio.setBgmEnabled(bgm); audio.setVolumes(master, sfx, music); }, [sound, bgm, master, sfx, music]);
  return phase === "menu" ? <div className="game-shell is-lobby"><Topbar /><Home /></div> : <BattleSession key={nonce} />;
}

function BattleSession() {
  useT();
  const phase = useGameStore((s) => s.phase);
  const hud = useGameStore((s) => s.hud);
  const result = useGameStore((s) => s.result);
  const best = useGameStore((s) => s.bestLength);
  const banner = useGameStore((s) => s.banner);
  const arrow = useGameStore((s) => s.showDirectionArrow);
  const names = useGameStore((s) => s.showNames);
  const modalOpen = useGameStore((s) => s.closetOpen || s.profileOpen || s.missionsOpen || s.settingsOpen || s.dailyOpen || s.guideOpen);
  const renderer = useRef<PixiRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(3);
  const isTouch = useMemo(() => window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0, []);
  const engine = useMemo(() => {
    const s = useGameStore.getState();
    return new GameEngine({
      seed: hashSeed(`${Date.now()}-${s.runNonce}`), mode: s.mode, skin: s.activeSkin,
      playerName: s.playerName, bestLength: s.bestLength, difficulty: s.difficulty, allowRevive: true,
      onHud: (next) => useGameStore.getState().setHud(next),
      onEvent: (event) => {
        const state = useGameStore.getState();
        renderer.current?.triggerEventFx(event);
        if (state.sound) audio.handleEvent(event);
        if (event.type === "kill" && event.player) {
          const info = streakTitle(event.streak);
          state.pushBanner(event.wasKing ? t("击败了蛇王") : info.label, t("击败 {name}", { name: event.name }), event.wasKing ? "gold" : info.tone);
          vibrate(12, state.haptics);
        } else if (event.type === "king" && event.player) {
          state.pushBanner(t("现在，你是蛇王了。"), t("保持领先，也别忘了转弯。"), "gold");
        } else if (event.type === "milestone") {
          state.pushBanner(t(event.title), t("视野随着成长慢慢扩大"), "mint");
        } else if (event.type === "record") {
          state.pushBanner(t("刷新个人纪录！"), t("{n} 米，还在继续变长", { n: event.length }), "gold");
        } else if (event.type === "power" && event.player) {
          const [title, sub] = POWER_BANNER[event.kind];
          state.pushBanner(t(title), t(sub), event.kind === "double" ? "coral" : event.kind === "magnet" ? "violet" : "mint");
          vibrate(8, state.haptics);
        } else if (event.type === "bossSpawn") {
          state.pushBanner(t("黄金巨蟒出现了"), t("{n} 米 · 小地图已标记", { n: event.length }), "gold");
        } else if (event.type === "bossDefeated") {
          state.pushBanner(t("黄金巨蟒被击败"), event.player ? t("战利品已经入账") : t("光点正在散落"), "gold");
        } else if (event.type === "tide") {
          state.pushBanner(t("能量潮汐来了"), t("在小地图上寻找高价值光点"), "mint");
        } else if (event.type === "playerDown") {
          state.clearBanner();
          state.playerDown();
        } else if (event.type === "revive") {
          state.pushBanner(t("复活成功"), t("护盾保护 4 秒，长度保留一半"), "mint");
        } else if (event.type === "death" && event.player) vibrate([25, 30, 20], state.haptics);
      },
      onEnd: (value) => useGameStore.getState().completeRun(value),
    });
  }, []);

  useEffect(() => { engine.emitHud(); }, [engine]);
  // Dev-only handle for browser smoke tests and debugging.
  useEffect(() => { if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) (window as unknown as { __engine?: GameEngine }).__engine = engine; }, [engine]);
  useEffect(() => {
    if (!ready || phase !== "playing" || countdown === null) return;
    audio.countdown(countdown);
    const timer = window.setTimeout(() => setCountdown(countdown <= 0 ? null : countdown - 1), countdown === 0 ? 420 : 650);
    return () => window.clearTimeout(timer);
  }, [ready, phase, countdown]);
  useEffect(() => {
    if (phase !== "playing" || modalOpen) engine.setBoost(false);
  }, [phase, modalOpen, engine]);
  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => useGameStore.getState().clearBanner(), 2400);
    return () => window.clearTimeout(timer);
  }, [banner]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.code !== "Escape" && event.code !== "KeyP") return;
      if ((event.target as HTMLElement)?.matches("input, textarea, select")) return;
      const state = useGameStore.getState();
      if (state.guideOpen || state.settingsOpen || state.closetOpen || state.dailyOpen || state.profileOpen || state.missionsOpen) return;
      if (state.phase === "playing") state.pause(); else if (state.phase === "paused") state.resume();
    };
    const blur = () => { engine.setBoost(false); useGameStore.getState().pause(); };
    window.addEventListener("keydown", key); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("blur", blur); };
  }, [engine]);

  const state = useGameStore.getState();
  return <div className="game-shell is-battle">
    <GameCanvas engine={engine} paused={!ready || countdown !== null || (phase !== "playing" && phase !== "downed")} showDirectionArrow={arrow} showNames={names} onRenderer={(value) => { renderer.current = value; }} onReady={() => setReady(true)} onError={setError} />
    <Topbar /><Hud engine={engine} isTouch={isTouch} />
    {!ready && !error && <div className="paper-loading"><BrandMark /><p>{t("正在铺开竞技场")}</p><span className="loading-line" /></div>}
    {ready && countdown !== null && phase === "playing" && <div className="match-countdown"><p>{state.mode === "timed" ? t("三分钟竞速") : t("无尽漫游")} · {t(state.difficulty === "easy" ? "轻松" : state.difficulty === "hard" ? "高手" : "标准")}</p><strong key={countdown}>{countdown || t("出发")}</strong><small>{t("自己的尾巴，是安全的。")}</small></div>}
    {phase === "paused" && !modalOpen && <Overlay onClose={state.resume} className="max-w-[370px]" z="z-40"><div className="pause-sheet"><span className="collection-label">TAKE YOUR TIME</span><SnakePreview skin={state.activeSkin} width={200} height={100} orbs={false} /><h2>{t("歇一会儿，再出发。")}</h2><p>{t("当前 {len} 米 · 第 {rank} 名", { len: hud?.displayLength ?? 60, rank: hud?.rank ?? 1 })}</p><button className="play-button" type="button" onClick={state.resume}>{t("继续游戏")}<Icon name="play" /></button><div><button className="text-link" type="button" onClick={state.retry}>{t("重新开始")}</button><button className="text-link" type="button" onClick={state.goMenu}>{t("回游乐场")}</button></div></div></Overlay>}
    {phase === "downed" && <ReviveSheet engine={engine} />}
    {phase === "result" && result && <Results result={result} bestLength={best} />}
    {error && <Overlay onClose={state.goMenu} className="max-w-[420px]" z="z-[60]"><div className="guide-body"><Icon name="help" /><h2 className="mt-3 text-xl font-semibold">{t("画面暂时没有准备好")}</h2><p className="guide-description mt-3">{error}</p><div className="guide-actions"><button className="small-button" onClick={state.goMenu} type="button">{t("回游乐场")}</button><button className="play-button" type="button" onClick={state.retry}>{t("再试一次")}<Icon name="arrow" /></button></div></div></Overlay>}
  </div>;
}

const REVIVE_WINDOW_S = 7;

/** One-time second chance after a crash: spend gems to hatch again with half the length. */
function ReviveSheet({ engine }: { engine: GameEngine }) {
  const t = useT();
  const gems = useGameStore((s) => s.gems);
  const hud = useGameStore((s) => s.hud);
  const [left, setLeft] = useState(REVIVE_WINDOW_S);
  const decided = useRef(false);
  const lostLength = hud?.displayLength ?? 0;
  const keep = Math.max(60, Math.round(lostLength * 0.5));
  const giveUp = () => {
    if (decided.current) return;
    decided.current = true;
    engine.giveUp();
  };
  const revive = () => {
    if (decided.current) return;
    if (!useGameStore.getState().payRevive()) return;
    decided.current = true;
    engine.revive();
  };
  useEffect(() => {
    if (left <= 0) { giveUp(); return; }
    const timer = window.setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(timer);
  });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "Enter" || e.code === "KeyR") { e.preventDefault(); revive(); }
      if (e.code === "Escape") { e.preventDefault(); giveUp(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const enough = gems >= REVIVE_COST;
  const ring = 2 * Math.PI * 30;
  return <div className="revive-layer" role="dialog" aria-modal="true" aria-label={t("复活")}>
    <div className="revive-sheet">
      <div className="revive-timer" aria-hidden="true">
        <svg viewBox="0 0 70 70"><circle cx="35" cy="35" r="30" fill="none" stroke="#e5dfcc" strokeWidth="4" /><circle cx="35" cy="35" r="30" fill="none" stroke="#d2a84c" strokeWidth="4" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - left / REVIVE_WINDOW_S)} style={{ transition: "stroke-dashoffset 1s linear" }} /></svg>
        <strong>{Math.max(0, left)}</strong>
      </div>
      <span className="collection-label">SECOND CHANCE</span>
      <h2>{t("还想再游一会儿吗？")}</h2>
      <p>{hud?.spectating ? t("「{name}」拦住了你。镜头正在跟随它。", { name: hud.spectating }) : t("你撞上了别人的身体。")}</p>
      <div className="revive-facts"><span>{t("复活后长度 {n} 米", { n: keep })}</span><span>{t("4 秒护盾")}</span><span>{t("击败数保留")}</span></div>
      <button type="button" className="play-button" onClick={revive} disabled={!enough} autoFocus>
        <span>{enough ? t("复活 · {n} 宝石", { n: REVIVE_COST }) : t("宝石不足（{have}/{n}）", { have: gems, n: REVIVE_COST })}</span><Icon name="heart" />
      </button>
      <button type="button" className="text-link" onClick={giveUp}>{t("结束本局，查看战报")}</button>
      <small>{t("每局只能复活一次 · Enter 复活 · Esc 结束")}</small>
    </div>
  </div>;
}
