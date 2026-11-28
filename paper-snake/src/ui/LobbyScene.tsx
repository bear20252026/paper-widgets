import { useEffect, useRef, type RefObject } from "react";
import { t } from "../i18n";
import { skinName } from "../game/skins";
import type { SkinId } from "../game/types";
import { getSkin } from "../game/skins";
import { drawSkinPreview } from "../render/skinPreview";

export function LobbyScene({ skin, target, paused = false }: { skin: SkinId; target: RefObject<HTMLDivElement | null>; paused?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; const stage = target.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0; let h = 0; let frame = 0; let last = 0;
    let bounds = { x: 0, y: 0, w: 0, h: 0 };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still = reduce || paused;
    const update = () => {
      const c = canvas.getBoundingClientRect(); const s = stage.getBoundingClientRect();
      w = c.width; h = c.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      bounds = { x: s.left - c.left, y: s.top - c.top, w: s.width, h: s.height };
      if (still) { cancelAnimationFrame(frame); frame = requestAnimationFrame(paint); }
    };
    const paint = (now: number) => {
      if (!still) frame = requestAnimationFrame(paint);
      if (document.hidden || (!still && now - last < 32)) return;
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const t = reduce ? .8 : now / 1000;
      ctx.save(); ctx.translate(bounds.x, bounds.y);
      const colours = ["#edaa67", "#92bb9e", "#c9c2df", "#ebc15d"];
      const dots = [[.13, .47, 6], [.86, .29, 7], [.82, .78, 5], [.2, .83, 4], [.61, .11, 4]];
      dots.forEach(([x, y, r], i) => {
        const dx = x * bounds.w; const dy = y * bounds.h + Math.sin(t * .7 + i) * 4;
        ctx.fillStyle = colours[i % 4]; ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(dx - r * .3, dy - r * .3, r * .3, 0, Math.PI * 2); ctx.fill();
      });
      drawSkinPreview(ctx, getSkin(skin), { width: bounds.w, height: bounds.h, time: t * .36, orbs: false, pose: "portrait" });
      ctx.restore();
    };
    const observer = new ResizeObserver(update); observer.observe(canvas); observer.observe(stage);
    update(); if (!still) frame = requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [skin, target, paused]);
  return <canvas ref={ref} className="lobby-scene" aria-label={t("{name}动态造型展示", { name: skinName(getSkin(skin)) })} role="img" />;
}