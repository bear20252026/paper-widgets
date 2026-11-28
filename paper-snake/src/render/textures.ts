import { Texture } from "pixi.js";
import { getSkin } from "../game/skins";
import type { PowerKind, SkinId } from "../game/types";
import { POWER_INFO } from "../game/powerups";
import { artCanvas, clearArtCache } from "./skinArt";
import { ART_SPECS, HEAD_SPECS, type ArtId } from "./skinLayout";

/** Shared, generate-once textures. Every pooled sprite reuses these. */
const cache = new Map<string, Texture>();
/** skin → art → texture (nested maps: no string building in the hot path) */
const artCache = new Map<SkinId, Map<ArtId, Texture>>();

function makeCanvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return [canvas, ctx];
}

function tex(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const [canvas, ctx] = makeCanvas(size);
  draw(ctx, size);
  const texture = Texture.from(canvas);
  cache.set(key, texture);
  return texture;
}

export function colorNumber(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

/** Skin artwork texture (body pieces, links, heads) for any skin form. */
export function artTexture(skinId: SkinId, art: ArtId): Texture {
  let bySkin = artCache.get(skinId);
  if (!bySkin) {
    bySkin = new Map();
    artCache.set(skinId, bySkin);
  }
  let texture = bySkin.get(art);
  if (!texture) {
    texture = Texture.from(artCanvas(getSkin(skinId), art));
    texture.source.style.scaleMode = ART_SPECS[art].pixel ? "nearest" : "linear";
    bySkin.set(art, texture);
  }
  return texture;
}

export function headTexture(skinId: SkinId): Texture {
  return artTexture(skinId, HEAD_SPECS[getSkin(skinId).form].art);
}

/**
 * Signature millimeter graph paper (96x96 world units per tile).
 * Major 96px sage lines + 4x4 24px sub-grid + drafting crosshairs.
 */
export function gridTexture(): Texture {
  const texture = tex("grid-v2", 96, (ctx) => {
    const S = 96;
    ctx.fillStyle = "#fbf9f1";
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = "rgba(72, 128, 110, 0.055)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of [24, 48, 72]) {
      ctx.moveTo(p + 0.5, 0);
      ctx.lineTo(p + 0.5, S);
      ctx.moveTo(0, p + 0.5);
      ctx.lineTo(S, p + 0.5);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(72, 128, 110, 0.085)";
    ctx.beginPath();
    ctx.moveTo(48.5, 0);
    ctx.lineTo(48.5, S);
    ctx.moveTo(0, 48.5);
    ctx.lineTo(S, 48.5);
    ctx.stroke();
    ctx.strokeStyle = "rgba(64, 122, 104, 0.165)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0.75, 0);
    ctx.lineTo(0.75, S);
    ctx.moveTo(0, 0.75);
    ctx.lineTo(S, 0.75);
    ctx.stroke();
    ctx.fillStyle = "rgba(58, 115, 98, 0.20)";
    ctx.beginPath();
    ctx.arc(48.5, 48.5, 1.35, 0, Math.PI * 2);
    ctx.fill();
  });
  texture.source.style.addressMode = "repeat";
  texture.source.style.scaleMode = "linear";
  return texture;
}

export function orbTexture(): Texture {
  return tex("orb-v2", 72, (ctx) => {
    const C = 36;
    const bloom = ctx.createRadialGradient(C, C, 2, C, C, 34);
    bloom.addColorStop(0, "rgba(255,255,255,1)");
    bloom.addColorStop(0.32, "rgba(255,255,255,0.96)");
    bloom.addColorStop(0.54, "rgba(255,255,255,0.52)");
    bloom.addColorStop(0.8, "rgba(255,255,255,0.14)");
    bloom.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(C, C, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.beginPath();
    ctx.arc(C, C, 15.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(C - 5.5, C - 6.5, 6.2, 4.2, -0.55, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function glowTexture(): Texture {
  return tex("glow-v2", 64, (ctx) => {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.38, "rgba(255,255,255,0.38)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  });
}

export function ringTexture(): Texture {
  return tex("ring-v2", 96, (ctx) => {
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(48, 48, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(48, 48, 36, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** Golden Snake King Crown worn by the #1 snake on the field. */
export function crownTexture(): Texture {
  return tex("crown-v2", 96, (ctx) => {
    ctx.fillStyle = "rgba(23, 58, 48, 0.22)";
    ctx.beginPath();
    ctx.ellipse(48, 76, 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createLinearGradient(20, 18, 74, 72);
    grad.addColorStop(0, "#fff3a6");
    grad.addColorStop(0.45, "#ffd043");
    grad.addColorStop(1, "#e09612");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#8c5604";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(20, 68);
    ctx.lineTo(15, 32);
    ctx.lineTo(34, 47);
    ctx.lineTo(48, 20);
    ctx.lineTo(62, 47);
    ctx.lineTo(81, 32);
    ctx.lineTo(76, 68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff1b8";
    ctx.fillRect(22, 59, 52, 6);
    const jewels = [
      [48, 52, "#ff5964", 5.2],
      [31, 54, "#3ecfae", 3.8],
      [65, 54, "#3ecfae", 3.8],
      [48, 17, "#fff9d6", 4.5],
      [14, 29, "#ffe27a", 3.8],
      [82, 29, "#ffe27a", 3.8],
    ] as const;
    for (const [x, y, c, r] of jewels) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Direction guide chevron orbiting ahead of the player's snake head. */
export function arrowTexture(): Texture {
  return tex("dir-arrow-v2", 64, (ctx) => {
    ctx.save();
    ctx.translate(32, 32);
    ctx.shadowColor = "rgba(23, 58, 48, 0.28)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#173a30";
    ctx.lineWidth = 3.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -13);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

export function disposeTextureCache(): void {
  for (const texture of cache.values()) texture.destroy(true);
  cache.clear();
  for (const bySkin of artCache.values()) for (const texture of bySkin.values()) texture.destroy(true);
  artCache.clear();
  clearArtCache();
}

const POWER_GLYPHS: Record<PowerKind, string> = {
  magnet: "M5 3v9a7 7 0 0 0 14 0V3h-4v9a3 3 0 0 1-6 0V3H5Z M5 7h4 M15 7h4",
  shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z M7.5 12l3 3 6-6",
  turbo: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  double: "m4 8 6 8 m0-8-6 8 M14 9a3 3 0 1 1 5 2.2L14 16h6",
};

/** Round paper badge with a line icon for each pick-up kind (96px, white glyph). */
export function powerTexture(kind: PowerKind): Texture {
  return tex(`power-${kind}`, 96, (ctx, S) => {
    const info = POWER_INFO[kind];
    const c = S / 2;
    // soft drop shadow
    ctx.fillStyle = "rgba(23,58,48,0.18)";
    ctx.beginPath();
    ctx.ellipse(c, c + 6, 34, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    // badge
    const grad = ctx.createLinearGradient(0, 8, 0, S - 8);
    grad.addColorStop(0, info.accent);
    grad.addColorStop(0.16, info.color);
    grad.addColorStop(1, info.color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c, c, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fffdf6";
    ctx.stroke();
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(255,253,246,0.7)";
    ctx.beginPath();
    ctx.arc(c, c, 27, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // glyph from the same 24-unit icon path family as the UI
    ctx.save();
    ctx.translate(c - 18, c - 18);
    ctx.scale(1.5, 1.5);
    ctx.lineWidth = 2.3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff";
    try {
      ctx.stroke(new Path2D(POWER_GLYPHS[kind]));
    } catch {
      ctx.beginPath();
      ctx.arc(12, 12, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });
}
