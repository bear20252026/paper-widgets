/**
 * 2D-canvas skin preview renderer for menus. Uses the exact same layout
 * engine and art canvases as the in-game PixiJS renderer, so previews are
 * pixel-for-pixel representative of the real structure.
 */
import type { Skin } from "../game/skins";
import type { Vec2 } from "../game/types";
import { LayoutBuffer } from "./skinLayout";
import { drawCanvasSnake } from "./canvasSnake";

const buffer = new LayoutBuffer();
const POINTS = 96;
const points: Vec2[] = Array.from({ length: POINTS }, () => ({ x: 0, y: 0 }));

export interface PreviewOptions {
  width: number;
  height: number;
  /** seconds — drives wiggle, twinkle, helix spin, flame flicker */
  time: number;
  /** decorative light orbs around the snake */
  orbs?: boolean;
  pose?: "swim" | "portrait";
}

const ORB_DOTS: [number, number, string, number][] = [
  [0.9, 0.22, "#ffd76a", 0.03],
  [0.95, 0.64, "#ff8c66", 0.022],
  [0.07, 0.28, "#52d6b8", 0.026],
];

/** Draws inside the current transform; caller handles DPR and clearing. */
export function drawSkinPreview(ctx: CanvasRenderingContext2D, skin: Skin, opts: PreviewOptions): void {
  const { width, height, time } = opts;
  const portrait = opts.pose === "portrait";
  const r = portrait ? Math.min(width * 0.064, height * 0.064) : Math.max(3.5, Math.min(height * 0.078, width * 0.046));
  const phase = time * 1.6;

  // Sinuous S-curve body; head on the right facing roughly right.
  for (let i = 0; i < POINTS; i++) {
    const u = 1 - i / (POINTS - 1);
    const p = points[i];
    if (portrait) {
      p.x = width * (0.52 + Math.sin(u * Math.PI * 2.4 - 0.65) * 0.255 + Math.sin(time * 0.55 + u * 3) * 0.012);
      p.y = height * (0.16 + u * 0.65);
    } else {
      p.x = width * 0.1 + u * width * 0.7;
      p.y = height * 0.54 + Math.sin(u * Math.PI * 1.7 + phase) * height * 0.17;
    }
  }
  const head = points[0];
  const angle = Math.atan2(head.y - points[1].y, head.x - points[1].x);

  if (opts.orbs !== false) {
    for (const [fx, fy, color, fr] of ORB_DOTS) {
      const x = width * fx;
      const y = height * fy;
      const rr = Math.max(2, Math.min(width, height * 1.6) * fr);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 2.4);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.3, color);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rr * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCanvasSnake(ctx, skin, { points, radius: r, angle, time, boosting: false }, buffer);
}
