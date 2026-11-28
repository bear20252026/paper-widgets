import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { skinName } from "../game/skins";
import type { SkinId } from "../game/types";
import { SkinTrial as TrialSession, TRIAL_STEP_MS } from "../game/skinTrial";
import { getSkin } from "../game/skins";
import { drawCanvasSnake } from "../render/canvasSnake";
import { LayoutBuffer } from "../render/skinLayout";
import { Icon } from "./Icon";

export function SkinTrial({ skin, onBack }: { skin: SkinId; onBack: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const session = useRef<TrialSession | null>(null);
  const [restart, setRestart] = useState(0);
  const [zoomed, setZoomed] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const zoom = useRef(zoomed);
  zoom.current = zoomed;
  const [stats, setStats] = useState({ length: 90, seconds: 20, eaten: 0, automatic: true, boosting: false, canBoost: true, finished: false });

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const trial = new TrialSession(skin); session.current = trial;
    const art = getSkin(skin); const buffer = new LayoutBuffer();
    let width = 1, height = 1, scale = 1, offsetX = 0, offsetY = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const bounds = element.getBoundingClientRect(); width = bounds.width; height = bounds.height;
      element.width = Math.round(width * dpr); element.height = Math.round(height * dpr);
      scale = Math.min(width / 640, height / 480);
      offsetX = (width - 640 * scale) / 2; offsetY = (height - 480 * scale) / 2;
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    let raf = 0, previous = performance.now(), accumulator = 0, lastHud = 0, lastDraw = 0, motionTime = 0;
    const publish = () => setStats({ length: Math.round(trial.snake.length), seconds: Math.ceil(trial.timeLeftMs / 1000), eaten: trial.eaten, automatic: trial.automatic, boosting: trial.snake.boosting, canBoost: !trial.finished && trial.snake.length > 30, finished: trial.finished });
    publish();
    const draw = () => {
      scale = Math.min(width / 640, height / 480) * (zoom.current ? 1.35 : 1);
      offsetX = (width - 640 * scale) / 2; offsetY = (height - 480 * scale) / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      ctx.translate(offsetX, offsetY); ctx.scale(scale, scale);
      ctx.strokeStyle = "#dbe2d2"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(32, 32, 576, 416, 24); ctx.stroke();
      ctx.strokeStyle = "rgba(118,141,109,.09)";
      for (let x = 48; x < 640; x += 24) { ctx.beginPath(); ctx.moveTo(x, 32); ctx.lineTo(x, 448); ctx.stroke(); }
      for (let y = 48; y < 480; y += 24) { ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(608, y); ctx.stroke(); }
      for (const orb of trial.state.orbs) {
        ctx.fillStyle = orb.color; ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.radius * .8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.arc(orb.x - 1, orb.y - 2, orb.radius * .28, 0, Math.PI * 2); ctx.fill();
      }
      const s = trial.snake;
      drawCanvasSnake(ctx, art, { points: s.points, radius: s.radius, angle: s.angle, time: trial.state.timeMs / 1000, boosting: s.boosting, motionTime }, buffer);
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) { previous = now; accumulator = 0; return; }
      // Catch up logic on a slow display; drawing does not set the simulation speed.
      accumulator += Math.min(250, now - previous); previous = now;
      while (accumulator >= TRIAL_STEP_MS) {
        const before = trial.state.timeMs;
        trial.update(TRIAL_STEP_MS);
        motionTime += (trial.state.timeMs - before) / 1000 * (trial.snake.boosting ? 2 : 1);
        accumulator -= TRIAL_STEP_MS;
      }
      if (now - lastDraw >= 33) { draw(); lastDraw = now; }
      if (now - lastHud > 160) { publish(); lastHud = now; }
    };
    raf = requestAnimationFrame(loop);
    const aim = (event: PointerEvent) => {
      const bounds = element.getBoundingClientRect();
      trial.setAim((event.clientX - bounds.left - offsetX) / scale, (event.clientY - bounds.top - offsetY) / scale);
    };
    const pointerDown = (event: PointerEvent) => { event.preventDefault(); element.focus(); element.setPointerCapture(event.pointerId); aim(event); };
    const pointerMove = (event: PointerEvent) => { if (event.pointerType === "mouse" || element.hasPointerCapture(event.pointerId)) aim(event); };
    const release = () => trial.setBoost(false);
    const keyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("button, input, textarea, select")) return;
      if (event.code === "Space") { event.preventDefault(); trial.setBoost(true); }
    };
    const keyUp = (event: KeyboardEvent) => { if (event.code === "Space") trial.setBoost(false); };
    element.addEventListener("pointerdown", pointerDown); element.addEventListener("pointermove", pointerMove);
    window.addEventListener("keydown", keyDown); window.addEventListener("keyup", keyUp); window.addEventListener("blur", release);
    return () => {
      cancelAnimationFrame(raf); observer.disconnect(); session.current = null;
      element.removeEventListener("pointerdown", pointerDown); element.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", release);
    };
  }, [skin, restart]);

  return <div className="skin-trial">
    <div className="trial-toolbar"><button type="button" className="text-link" onClick={onBack}><Icon name="back" />{t("回到工坊")}</button><span><button type="button" className={`trial-zoom ${zoomed ? "is-active" : ""}`} onClick={() => setZoomed((v) => !v)} aria-pressed={zoomed} aria-label={zoomed ? t("缩小试游画面") : t("放大试游画面")}><Icon name="expand" /></button>{stats.finished ? t("试游结束") : t("剩余 {n} 秒", { n: stats.seconds })}<i />{t("{n} 米", { n: stats.length })}</span></div>
    <div className="trial-court"><canvas ref={canvas} tabIndex={0} aria-label={t("{name}可操控试游画面", { name: skinName(getSkin(skin)) })} />
      {stats.finished && <div className="trial-finished"><Icon name="check" /><h3>{t("这一小圈，感觉如何？")}</h3><p>{t("试游未消耗金币，也没有记录战绩。")}</p><button type="button" className="small-button" onClick={() => setRestart((n) => n + 1)}>{t("再试一次")}</button></div>}
    </div>
    <div className="trial-footer"><div><strong>{stats.automatic ? t("正在自动巡游") : t("你正在操控")}</strong><p><span className="desktop-controls-note">{t("移动鼠标转向，按住空格或按钮加速。")}</span><span className="touch-controls-note">{t("在纸格上拖动转向，按住右下按钮加速。")}</span></p><small>{t("独立试游，不计成绩、不改存档。")}</small></div><div className="trial-actions">
      <button type="button" className="text-link" onClick={() => session.current?.releaseAim()}>{t("自动巡游")}</button>
      <button type="button" className={`small-button ${stats.boosting ? "is-boosting" : ""}`} disabled={!stats.canBoost} aria-label={t("试游加速")} onKeyDown={(e) => { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); session.current?.setBoost(true); } }} onKeyUp={() => session.current?.setBoost(false)} onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); session.current?.setBoost(true); }} onPointerUp={() => session.current?.setBoost(false)} onPointerCancel={() => session.current?.setBoost(false)} onLostPointerCapture={() => session.current?.setBoost(false)}>{stats.finished ? t("试游结束") : stats.canBoost ? t("按住加速") : t("先吃光点")}<Icon name="arrow" /></button>
    </div></div>
  </div>;
}