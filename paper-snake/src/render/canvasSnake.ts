import type { Skin } from "../game/skins";
import { artCanvas } from "./skinArt";
import { ART_SPECS, HEAD_SPECS, LayoutBuffer, headBreathFor, headRotationFor, layoutSnake, type LayoutInput } from "./skinLayout";

/** The menu and the trial blit the exact artwork/placements used by Pixi. */
export function drawCanvasSnake(ctx: CanvasRenderingContext2D, skin: Skin, input: LayoutInput, buffer: LayoutBuffer): void {
  if (input.points.length === 0) return;
  layoutSnake(skin.form, input, buffer);
  for (let i = 0; i < buffer.count; i++) {
    const p = buffer.items[i];
    const canvas = artCanvas(skin, p.art);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
    ctx.imageSmoothingEnabled = !ART_SPECS[p.art].pixel;
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.drawImage(canvas, -p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  const head = input.points[0];
  const spec = HEAD_SPECS[skin.form];
  const canvas = artCanvas(skin, spec.art);
  const width = spec.size * input.radius;
  const height = width * canvas.height / canvas.width;
  const breath = headBreathFor(skin.form, input.time);
  ctx.save(); ctx.translate(head.x, head.y); ctx.rotate(headRotationFor(skin.form, input.angle));
  ctx.imageSmoothingEnabled = !ART_SPECS[spec.art].pixel;
  ctx.scale(breath, 2 - breath);
  ctx.drawImage(canvas, -width * spec.anchorX, -height * spec.anchorY, width, height);
  ctx.restore();
}