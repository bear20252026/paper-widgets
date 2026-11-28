import { useEffect, useRef } from "react";
import { t } from "../i18n";
import { skinName } from "../game/skins";
import { getSkin } from "../game/skins";
import type { SkinId } from "../game/types";
import { drawSkinPreview } from "../render/skinPreview";

interface SnakePreviewProps {
  skin: SkinId;
  className?: string;
  width?: number;
  height?: number;
  dimmed?: boolean;
  /** gently animate (wiggle / twinkle / flicker); respects reduced motion */
  animated?: boolean;
  orbs?: boolean;
  pose?: "swim" | "portrait";
}

/**
 * Canvas preview that renders the real in-game structure of a skin
 * (carriages, pencil stroke, lanterns, pixels …) using the shared art.
 */
export function SnakePreview({
  skin,
  className,
  width = 220,
  height = 132,
  dimmed,
  animated = false,
  orbs = true,
  pose = "swim",
}: SnakePreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const s = getSkin(skin);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const reduce =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paint = (time: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      try {
        drawSkinPreview(ctx, getSkin(skin), { width, height, time, orbs, pose });
      } catch {
        // previews are decorative; never break the menu
      }
    };

    paint(0.4);
    if (!animated || reduce) return;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || now - last < 33) return;
      last = now;
      paint(0.4 + (now - start) / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [skin, width, height, animated, orbs, pose]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width, height: "auto", maxWidth: "100%", aspectRatio: `${width} / ${height}`, opacity: dimmed ? 0.55 : 1 }}
      role="img"
      aria-label={t("{name}皮肤预览", { name: skinName(s) })}
    />
  );
}
