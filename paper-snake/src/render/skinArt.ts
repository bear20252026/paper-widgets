/**
 * Skin artwork, drawn procedurally on 2D canvases (no PixiJS, no assets).
 * Oriented art faces +X (forward). Every canvas is generated once and cached;
 * PixiJS wraps them as shared textures, the menu previews blit them directly.
 */
import type { Skin } from "../game/skins";
import { ART_SPECS, type ArtId } from "./skinLayout";
import { COLLECTION_DRAWERS } from "./collectionArt";
import { CURIOUS_DRAWERS } from "./curiousArt";

type Ctx = CanvasRenderingContext2D;
type Drawer = (ctx: Ctx, w: number, h: number, skin: Skin) => void;
export type ArtCanvasFactory = (w: number, h: number) => HTMLCanvasElement;

const TAU = Math.PI * 2;

let factory: ArtCanvasFactory = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
const cache = new Map<string, HTMLCanvasElement>();

/** Swap the canvas backend (used by offline tooling); clears the cache. */
export function setArtCanvasFactory(next: ArtCanvasFactory): void {
  factory = next;
  cache.clear();
}

export function clearArtCache(): void {
  cache.clear();
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = factory(w, h);
  const ctx = c.getContext("2d") as Ctx | null;
  if (!ctx) throw new Error("2D canvas unavailable");
  return [c, ctx];
}

export function artCanvas(skin: Skin, art: ArtId): HTMLCanvasElement {
  const key = `${skin.id}|${art}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const spec = ART_SPECS[art];
  const [canvas, ctx] = makeCanvas(spec.w, spec.h);
  DRAW[art](ctx, spec.w, spec.h, skin);
  cache.set(key, canvas);
  return canvas;
}

// ── colour helpers ─────────────────────────────────────────────────────────
function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function shade(hex: string, amount: number): string {
  const [r0, g0, b0] = rgbOf(hex);
  const r = Math.max(0, Math.min(255, r0 + amount));
  const g = Math.max(0, Math.min(255, g0 + amount));
  const b = Math.max(0, Math.min(255, b0 + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function rand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── geometry helpers ───────────────────────────────────────────────────────
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function circle(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
}

function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU);
}

function radialFill(ctx: Ctx, cx: number, cy: number, r: number, stops: [number, string][]): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  circle(ctx, cx, cy, r);
  ctx.fill();
}

function softShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, alpha = 0.2): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
  g.addColorStop(0, `rgba(20,52,42,${alpha})`);
  g.addColorStop(0.65, `rgba(20,52,42,${alpha * 0.55})`);
  g.addColorStop(1, "rgba(20,52,42,0)");
  ctx.fillStyle = g;
  circle(ctx, 0, 0, rx);
  ctx.fill();
  ctx.restore();
}

function gloss(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rot: number, alpha: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  circle(ctx, 0, 0, rx);
  ctx.fill();
  ctx.restore();
}

/** Big kawaii eye; iris looks forward (+X). */
function cuteEye(ctx: Ctx, x: number, y: number, r: number, iris: string, forward = 0.3): void {
  ctx.fillStyle = "#ffffff";
  ellipse(ctx, x, y, r, r * 1.06);
  ctx.fill();
  ctx.lineWidth = Math.max(1.4, r * 0.15);
  ctx.strokeStyle = "rgba(20,40,35,0.32)";
  ctx.stroke();
  ctx.fillStyle = iris;
  ellipse(ctx, x + r * forward, y, r * 0.6, r * 0.66);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  circle(ctx, x + r * (forward + 0.2), y - r * 0.24, r * 0.24);
  ctx.fill();
  circle(ctx, x + r * (forward - 0.14), y + r * 0.26, r * 0.11);
  ctx.fill();
}

function beadyEye(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  circle(ctx, x, y, r);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  circle(ctx, x + r * 0.3, y - r * 0.32, r * 0.36);
  ctx.fill();
}

function blush(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = "rgba(255,118,132,0.34)";
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
}

function starPath(ctx: Ctx, cx: number, cy: number, outer: number, inner: number, points: number, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function polygon(ctx: Ctx, pts: number[], fill: string, stroke: string, lineWidth = 2.2): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

// ── classic (original round gummy) ─────────────────────────────────────────
function classicPattern(ctx: Ctx, skin: Skin, cx: number, cy: number, r: number, band: 0 | 1): void {
  ctx.save();
  circle(ctx, cx, cy, r - 1);
  ctx.clip();
  switch (skin.pattern) {
    case "stripe": {
      ctx.fillStyle = band === 0 ? "rgba(255,255,255,0.28)" : "rgba(255,245,230,0.42)";
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.translate(cx + i * 24, cy);
        ctx.rotate(-0.55);
        ctx.fillRect(-6, -80, 10, 160);
        ctx.restore();
      }
      break;
    }
    case "dots": {
      ctx.fillStyle = band === 0 ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.22)";
      const pts: [number, number, number][] = [
        [-18, -16, 4.4],
        [14, -20, 3.4],
        [2, 4, 4.8],
        [-20, 18, 3.6],
        [20, 16, 4.2],
      ];
      for (const [dx, dy, pr] of pts) {
        circle(ctx, cx + dx, cy + dy, pr);
        ctx.fill();
      }
      break;
    }
    case "checker": {
      const size = 24;
      for (let y = -3; y < 3; y++) {
        for (let x = -3; x < 3; x++) {
          const dark = (x + y + band) % 2 === 0;
          ctx.fillStyle = dark ? "rgba(104,148,132,0.23)" : "rgba(255,255,255,0.45)";
          ctx.fillRect(cx + x * size, cy + y * size, size, size);
        }
      }
      ctx.strokeStyle = "rgba(68,120,104,0.32)";
      ctx.lineWidth = 1.4;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * size, cy - r);
        ctx.lineTo(cx + i * size, cy + r);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - r, cy + i * size);
        ctx.lineTo(cx + r, cy + i * size);
        ctx.stroke();
      }
      break;
    }
    case "aurora": {
      const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      if (band === 0) {
        g.addColorStop(0, "rgba(113,255,189,0.45)");
        g.addColorStop(0.5, "rgba(255,255,255,0.18)");
        g.addColorStop(1, "rgba(164,130,255,0.48)");
      } else {
        g.addColorStop(0, "rgba(255,175,245,0.42)");
        g.addColorStop(0.5, "rgba(120,230,255,0.35)");
        g.addColorStop(1, "rgba(113,255,189,0.42)");
      }
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      break;
    }
    case "gold": {
      ctx.strokeStyle = band === 0 ? "rgba(255,255,255,0.62)" : "rgba(255,244,185,0.45)";
      ctx.lineWidth = 3;
      circle(ctx, cx, cy, r * 0.62);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (const [dx, dy, sr] of [
        [-16, -18, 3.2],
        [20, -6, 2.5],
        [-4, 20, 2.8],
      ] as const) {
        circle(ctx, cx + dx, cy + dy, sr);
        ctx.fill();
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function drawClassicBand(ctx: Ctx, skin: Skin, band: 0 | 1): void {
  const cx = 72;
  const cy = 70;
  const R = 54;
  const sh = ctx.createRadialGradient(cx + 2, cy + 9, R * 0.2, cx + 2, cy + 9, R + 11);
  sh.addColorStop(0, "rgba(20, 52, 42, 0.20)");
  sh.addColorStop(0.68, "rgba(20, 52, 42, 0.11)");
  sh.addColorStop(1, "rgba(20, 52, 42, 0)");
  ctx.fillStyle = sh;
  circle(ctx, cx + 2, cy + 9, R + 11);
  ctx.fill();

  const grad = ctx.createRadialGradient(cx - 18, cy - 22, 6, cx, cy + 4, R + 6);
  if (band === 0) {
    grad.addColorStop(0, skin.palette[2]);
    grad.addColorStop(0.44, skin.palette[0]);
    grad.addColorStop(1, skin.palette[1]);
  } else {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.34, skin.belly);
    grad.addColorStop(0.82, skin.palette[2]);
    grad.addColorStop(1, skin.palette[0]);
  }
  ctx.fillStyle = grad;
  circle(ctx, cx, cy, R);
  ctx.fill();
  classicPattern(ctx, skin, cx, cy, R, band);

  const bounce = ctx.createRadialGradient(cx + 12, cy + 26, 2, cx + 12, cy + 26, 32);
  bounce.addColorStop(0, "rgba(255,255,255,0.28)");
  bounce.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = bounce;
  circle(ctx, cx, cy, R - 2);
  ctx.fill();

  ctx.lineWidth = 4.6;
  ctx.strokeStyle = shade(skin.palette[1], -42);
  circle(ctx, cx, cy, R - 1.5);
  ctx.stroke();
  gloss(ctx, cx - 18, cy - 21, 23, 15, -0.55, 0.86);
}

const drawClassicHead: Drawer = (ctx, _w, _h, skin) => {
  const cx = 102;
  const cy = 104;
  const rx = 86;
  const ry = 76;
  const sh = ctx.createRadialGradient(cx + 3, cy + 10, 22, cx + 3, cy + 10, 96);
  sh.addColorStop(0, "rgba(20, 52, 42, 0.24)");
  sh.addColorStop(0.72, "rgba(20, 52, 42, 0.10)");
  sh.addColorStop(1, "rgba(20, 52, 42, 0)");
  ctx.fillStyle = sh;
  ellipse(ctx, cx + 3, cy + 10, rx + 10, ry + 10);
  ctx.fill();

  ctx.fillStyle = "#ff6b7b";
  ctx.strokeStyle = "#b83344";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx + rx - 6, cy - 4);
  ctx.lineTo(cx + rx + 15, cy - 9);
  ctx.lineTo(cx + rx + 9, cy);
  ctx.lineTo(cx + rx + 15, cy + 9);
  ctx.lineTo(cx + rx - 6, cy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const grad = ctx.createRadialGradient(cx - 24, cy - 26, 8, cx, cy, 90);
  grad.addColorStop(0, skin.palette[2]);
  grad.addColorStop(0.46, skin.head);
  grad.addColorStop(1, skin.palette[1]);
  ctx.fillStyle = grad;
  ellipse(ctx, cx, cy, rx, ry);
  ctx.fill();

  ctx.save();
  ellipse(ctx, cx, cy, rx, ry);
  ctx.clip();
  classicPattern(ctx, skin, cx, cy, 86, 0);
  ctx.restore();

  if (skin.id === "gold") {
    polygon(ctx, [cx + 2, cy, cx - 12, cy - 10, cx - 26, cy, cx - 12, cy + 10], "#fff8cf", "#c5820e", 2.5);
  } else if (skin.id === "midnight" || skin.id === "aurora") {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    circle(ctx, cx - 14, cy, 7);
    ctx.fill();
  }

  ctx.lineWidth = 6;
  ctx.strokeStyle = shade(skin.palette[1], -46);
  ellipse(ctx, cx, cy, rx - 1, ry - 1);
  ctx.stroke();

  blush(ctx, cx + 8, cy - 46, 15, 9.5);
  blush(ctx, cx + 8, cy + 46, 15, 9.5);
  for (const dir of [-1, 1] as const) {
    const ex = cx + 28;
    const ey = cy + dir * 28;
    ctx.fillStyle = "#ffffff";
    ellipse(ctx, ex, ey, 21, 22.5);
    ctx.fill();
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = "rgba(20, 42, 36, 0.28)";
    ctx.stroke();
    ctx.fillStyle = skin.eye;
    ellipse(ctx, ex + 5.5, ey + dir, 12, 13.5);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    circle(ctx, ex + 9.5, ey - 5, 4.8);
    ctx.fill();
    circle(ctx, ex + 2, ey + 5.5, 2.2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  circle(ctx, cx + 66, cy - 11, 2.8);
  ctx.fill();
  circle(ctx, cx + 66, cy + 11, 2.8);
  ctx.fill();
  gloss(ctx, cx - 22, cy - 28, 40, 24, -0.48, 0.68);
};

// ── train ──────────────────────────────────────────────────────────────────
const drawTrainHead: Drawer = (ctx, _w, _h, skin) => {
  const body = skin.palette[0];
  const cab = skin.palette[1];
  const gold = skin.palette[2];
  softShadow(ctx, 124, 92, 114, 64, 0.24);
  ctx.fillStyle = "#2c3331";
  for (const x of [98, 136, 174]) {
    rr(ctx, x - 13, 27, 26, 14, 4);
    ctx.fill();
    rr(ctx, x - 13, 119, 26, 14, 4);
    ctx.fill();
  }
  const cg = ctx.createLinearGradient(0, 22, 0, 138);
  cg.addColorStop(0, shade(cab, 38));
  cg.addColorStop(1, shade(cab, -22));
  rr(ctx, 14, 22, 74, 116, 17);
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = shade(cab, -58);
  ctx.stroke();
  rr(ctx, 24, 33, 54, 94, 12);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fill();
  ctx.fillStyle = "#c9ecff";
  rr(ctx, 30, 25, 42, 8, 3);
  ctx.fill();
  rr(ctx, 30, 127, 42, 8, 3);
  ctx.fill();

  const bg = ctx.createLinearGradient(0, 36, 0, 124);
  bg.addColorStop(0, shade(body, 48));
  bg.addColorStop(0.45, body);
  bg.addColorStop(1, shade(body, -42));
  rr(ctx, 74, 36, 142, 88, 42);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = shade(body, -70);
  ctx.stroke();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 6;
  for (const x of [104, 136]) {
    ctx.beginPath();
    ctx.moveTo(x, 39);
    ctx.lineTo(x, 121);
    ctx.stroke();
  }
  ctx.fillStyle = gold;
  circle(ctx, 120, 80, 12);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = shade(gold, -70);
  ctx.stroke();
  gloss(ctx, 116, 75, 6, 4, -0.4, 0.8);
  ctx.fillStyle = "#2b302f";
  circle(ctx, 156, 80, 17);
  ctx.fill();
  ctx.fillStyle = "#4b5250";
  circle(ctx, 156, 80, 11.5);
  ctx.fill();
  ctx.fillStyle = "#1a1d1c";
  circle(ctx, 156, 80, 7);
  ctx.fill();

  ctx.fillStyle = "#2c3331";
  rr(ctx, 209, 34, 10, 92, 3);
  ctx.fill();
  polygon(ctx, [217, 40, 237, 64, 237, 96, 217, 120], shade(gold, -20), "#3b2f12", 2.5);
  ctx.strokeStyle = "rgba(59,47,18,0.55)";
  ctx.lineWidth = 2;
  for (const y of [52, 66, 80, 94, 108]) {
    ctx.beginPath();
    ctx.moveTo(219, y);
    ctx.lineTo(234, 80 + (y - 80) * 0.5);
    ctx.stroke();
  }
  radialFill(ctx, 205, 80, 22, [
    [0, "rgba(255,240,170,0.85)"],
    [1, "rgba(255,240,170,0)"],
  ]);
  ctx.fillStyle = "#fff7cc";
  circle(ctx, 205, 80, 8);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#8a6d1c";
  ctx.stroke();
  cuteEye(ctx, 185, 58, 12, skin.eye);
  cuteEye(ctx, 185, 102, 12, skin.eye);
  blush(ctx, 168, 46, 7, 4);
  blush(ctx, 168, 114, 7, 4);
  gloss(ctx, 132, 47, 56, 8, 0, 0.42);
};

function drawCar(ctx: Ctx, skin: Skin, kind: "A" | "B" | "caboose"): void {
  const color = kind === "A" ? skin.palette[0] : kind === "B" ? skin.palette[2] : skin.palette[1];
  softShadow(ctx, 87, 79, 80, 58, 0.22);
  ctx.fillStyle = "#2c3331";
  for (const x of [44, 126]) {
    rr(ctx, x - 14, 11, 28, 14, 4);
    ctx.fill();
    rr(ctx, x - 14, 115, 28, 14, 4);
    ctx.fill();
  }
  const g = ctx.createLinearGradient(0, 22, 0, 118);
  g.addColorStop(0, shade(color, 45));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -38));
  rr(ctx, 18, 22, 134, 96, 18);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = shade(color, -70);
  ctx.stroke();
  rr(ctx, 27, 31, 116, 78, 12);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fill();

  if (kind === "A") {
    for (const x of [31, 60, 89, 118]) {
      rr(ctx, x, 51, 22, 38, 7);
      ctx.fillStyle = "#cdefff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(20,50,70,0.3)";
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      rr(ctx, x + 3, 55, 8, 9, 3);
      ctx.fill();
    }
  } else if (kind === "B") {
    rr(ctx, 28, 32, 114, 76, 11);
    ctx.fillStyle = shade(color, -55);
    ctx.fill();
    const cargo: [number, number, number, string][] = [
      [48, 54, 13, "#ff8c66"],
      [77, 50, 14, "#52d6b8"],
      [106, 56, 13, "#84a9ff"],
      [129, 51, 11, "#ff6fb5"],
      [56, 87, 13, "#ff6fb5"],
      [86, 90, 14, "#ffcf5c"],
      [117, 86, 13, "#52d6b8"],
    ];
    for (const [x, y, r, c] of cargo) {
      radialFill(ctx, x, y, r * 1.5, [
        [0, rgba(c, 0.5)],
        [1, rgba(c, 0)],
      ]);
      const og = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r);
      og.addColorStop(0, "#ffffff");
      og.addColorStop(0.35, c);
      og.addColorStop(1, shade(c, -40));
      ctx.fillStyle = og;
      circle(ctx, x, y, r);
      ctx.fill();
    }
  } else {
    rr(ctx, 56, 42, 58, 56, 10);
    ctx.fillStyle = shade(color, 30);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = shade(color, -70);
    ctx.stroke();
    ctx.fillStyle = "#cdefff";
    rr(ctx, 64, 50, 42, 12, 4);
    ctx.fill();
    rr(ctx, 64, 78, 42, 12, 4);
    ctx.fill();
    radialFill(ctx, 22, 70, 18, [
      [0, "rgba(255,80,60,0.75)"],
      [1, "rgba(255,80,60,0)"],
    ]);
    ctx.fillStyle = "#ff4d3d";
    circle(ctx, 22, 70, 7);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#7a1d12";
    ctx.stroke();
  }
  gloss(ctx, 85, 29, 56, 5, 0, 0.35);
}

const drawTrainLink: Drawer = (ctx) => {
  rr(ctx, 1, 3, 30, 6, 3);
  ctx.fillStyle = "#3a4542";
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(3, 4, 26, 1.5);
};

// ── pencil ─────────────────────────────────────────────────────────────────
const drawPencilHead: Drawer = (ctx, _w, _h, skin) => {
  const y0 = 27;
  const y1 = 103;
  const cy = 65;
  const p = skin.palette[0];
  softShadow(ctx, 144, 80, 134, 36, 0.24);

  const eg = ctx.createLinearGradient(0, 30, 0, 100);
  eg.addColorStop(0, "#ffc2cd");
  eg.addColorStop(1, "#ef8da2");
  rr(ctx, 6, 30, 42, 70, 14);
  ctx.fillStyle = eg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#c45f78";
  ctx.stroke();

  const fg = ctx.createLinearGradient(0, 25, 0, 105);
  fg.addColorStop(0, "#f7f9fa");
  fg.addColorStop(0.5, "#b9c1c8");
  fg.addColorStop(1, "#e3e7ea");
  rr(ctx, 40, 25, 30, 80, 5);
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#7f8890";
  ctx.stroke();
  ctx.strokeStyle = "rgba(60,70,80,0.3)";
  ctx.lineWidth = 2;
  for (const x of [48, 55, 62]) {
    ctx.beginPath();
    ctx.moveTo(x, 27);
    ctx.lineTo(x, 103);
    ctx.stroke();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(68, y0, 140, y1 - y0);
  ctx.clip();
  ctx.fillStyle = shade(p, 38);
  ctx.fillRect(68, y0, 140, 22);
  ctx.fillStyle = p;
  ctx.fillRect(68, y0 + 22, 140, 32);
  ctx.fillStyle = shade(p, -32);
  ctx.fillRect(68, y0 + 54, 140, y1 - y0 - 54);
  ctx.fillStyle = "rgba(30,60,50,0.55)";
  ctx.fillRect(80, y0, 6, y1 - y0);
  ctx.fillRect(90, y0, 3, y1 - y0);
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = shade(p, -80);
  ctx.strokeRect(68, y0, 140, y1 - y0);

  ctx.beginPath();
  ctx.moveTo(206, y0);
  ctx.lineTo(252, cy - 9);
  ctx.lineTo(252, cy + 9);
  ctx.lineTo(206, y1);
  ctx.quadraticCurveTo(219, 91, 207, 78);
  ctx.quadraticCurveTo(220, 65, 207, 52);
  ctx.quadraticCurveTo(219, 39, 206, y0);
  ctx.closePath();
  const wg = ctx.createLinearGradient(206, 0, 252, 0);
  wg.addColorStop(0, "#f6d3a3");
  wg.addColorStop(1, "#e2ac6e");
  ctx.fillStyle = wg;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#a9773f";
  ctx.stroke();
  ctx.strokeStyle = "rgba(150,100,50,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(219, 44);
  ctx.lineTo(246, 58);
  ctx.moveTo(219, 86);
  ctx.lineTo(246, 72);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(246, cy - 10);
  ctx.lineTo(277, cy);
  ctx.lineTo(246, cy + 10);
  ctx.closePath();
  ctx.fillStyle = "#3a3f45";
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.moveTo(252, cy - 5);
  ctx.lineTo(268, cy - 1.5);
  ctx.lineTo(254, cy - 1.5);
  ctx.closePath();
  ctx.fill();

  cuteEye(ctx, 182, 52, 11, skin.eye, 0.35);
  cuteEye(ctx, 182, 78, 11, skin.eye, 0.35);
  blush(ctx, 164, 94, 7, 3.6);
  blush(ctx, 164, 36, 7, 3.6);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  rr(ctx, 100, 30.5, 100, 5, 2.5);
  ctx.fill();
};

const drawPencilLine: Drawer = (ctx) => {
  // crisp graphite capsule: hard-ish body, soft side edges, paper grain
  const g = ctx.createLinearGradient(0, 4, 0, 28);
  g.addColorStop(0, "rgba(70,76,86,0)");
  g.addColorStop(0.2, "rgba(60,66,76,0.86)");
  g.addColorStop(0.5, "rgba(42,47,55,0.96)");
  g.addColorStop(0.8, "rgba(60,66,76,0.86)");
  g.addColorStop(1, "rgba(70,76,86,0)");
  rr(ctx, 2, 4, 60, 24, 12);
  ctx.fillStyle = g;
  ctx.fill();
  const rnd = rand(7);
  for (let i = 0; i < 44; i++) {
    ctx.fillStyle = rnd() > 0.45 ? "rgba(255,255,255,0.15)" : "rgba(18,22,28,0.2)";
    ctx.fillRect(5 + rnd() * 54, 8 + rnd() * 16, 1.7, 1.1);
  }
};

const drawPencilSketch: Drawer = (ctx) => {
  const g = ctx.createLinearGradient(0, 6, 0, 14);
  g.addColorStop(0, "rgba(28,32,38,0)");
  g.addColorStop(0.5, "rgba(28,32,38,0.8)");
  g.addColorStop(1, "rgba(28,32,38,0)");
  rr(ctx, 2, 6, 60, 8, 4);
  ctx.fillStyle = g;
  ctx.fill();
};

const drawPencilSmudge: Drawer = (ctx) => {
  radialFill(ctx, 32, 32, 32, [
    [0, "rgba(96,102,110,0.2)"],
    [0.55, "rgba(96,102,110,0.1)"],
    [1, "rgba(96,102,110,0)"],
  ]);
};

// ── star chart ─────────────────────────────────────────────────────────────
const drawStarHead: Drawer = (ctx, w, h, skin) => {
  const gold = skin.palette[0];
  const navy = skin.palette[1];
  const pale = skin.palette[2];
  radialFill(ctx, 82, 88, 84, [
    [0, rgba(gold, 0.42)],
    [0.6, rgba(gold, 0.16)],
    [1, rgba(gold, 0)],
  ]);
  softShadow(ctx, 82, 100, 58, 44, 0.16);
  const [ca, a] = makeCanvas(w, h);
  a.fillStyle = navy;
  circle(a, 78, 88, 60);
  a.fill();
  a.globalCompositeOperation = "destination-out";
  circle(a, 108, 68, 50);
  a.fill();
  const [cb, b] = makeCanvas(w, h);
  const mg = b.createRadialGradient(52, 104, 6, 70, 92, 62);
  mg.addColorStop(0, "#fffbe0");
  mg.addColorStop(0.45, shade(gold, 18));
  mg.addColorStop(1, shade(gold, -28));
  b.fillStyle = mg;
  circle(b, 78, 88, 55);
  b.fill();
  b.globalCompositeOperation = "destination-out";
  circle(b, 108, 68, 55);
  b.fill();
  ctx.drawImage(ca, 0, 0);
  ctx.drawImage(cb, 0, 0);

  ctx.fillStyle = rgba(shade(gold, -40), 0.35);
  circle(ctx, 40, 82, 6);
  ctx.fill();
  circle(ctx, 70, 128, 4.5);
  ctx.fill();
  ctx.strokeStyle = navy;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(54, 104, 8, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(72, 118, 5.5, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  blush(ctx, 45, 120, 8, 4.5);

  ctx.fillStyle = pale;
  starPath(ctx, 134, 118, 9, 3.2, 4);
  ctx.fill();
  ctx.fillStyle = gold;
  starPath(ctx, 144, 44, 6.5, 2.4, 4);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  starPath(ctx, 118, 148, 4.5, 1.6, 4);
  ctx.fill();
};

const drawStarSmall: Drawer = (ctx, _w, _h, skin) => {
  const gold = skin.palette[0];
  radialFill(ctx, 32, 32, 31, [
    [0, rgba(gold, 0.55)],
    [0.5, rgba(gold, 0.18)],
    [1, rgba(gold, 0)],
  ]);
  starPath(ctx, 32, 32, 22, 7.5, 4);
  const g = ctx.createRadialGradient(28, 28, 1, 32, 32, 22);
  g.addColorStop(0, "#fffbe6");
  g.addColorStop(0.6, gold);
  g.addColorStop(1, shade(gold, -30));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = skin.palette[1];
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  circle(ctx, 30, 30, 2.6);
  ctx.fill();
};

const drawStarBig: Drawer = (ctx, _w, _h, skin) => {
  const gold = skin.palette[0];
  const navy = skin.palette[1];
  radialFill(ctx, 48, 48, 47, [
    [0, rgba(gold, 0.55)],
    [0.55, rgba(gold, 0.2)],
    [1, rgba(gold, 0)],
  ]);
  starPath(ctx, 48, 50, 34, 15, 5);
  const g = ctx.createRadialGradient(42, 42, 2, 48, 50, 34);
  g.addColorStop(0, "#fffbe6");
  g.addColorStop(0.55, gold);
  g.addColorStop(1, shade(gold, -34));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = navy;
  ctx.stroke();
  ctx.fillStyle = navy;
  circle(ctx, 42, 50, 2.6);
  ctx.fill();
  circle(ctx, 54, 50, 2.6);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(48, 54.5, 3.4, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  blush(ctx, 37, 56, 3.4, 2);
  blush(ctx, 59, 56, 3.4, 2);
  gloss(ctx, 42, 38, 7, 4, -0.5, 0.75);
};

const drawStarLink: Drawer = (ctx, _w, _h, skin) => {
  rr(ctx, 0, 2, 32, 8, 4);
  ctx.fillStyle = rgba(skin.palette[2], 0.38);
  ctx.fill();
  ctx.fillStyle = rgba(skin.palette[1], 0.88);
  ctx.fillRect(0, 4.6, 32, 2.8);
};

const drawStarNebula: Drawer = (ctx, _w, _h, skin) => {
  radialFill(ctx, 32, 32, 32, [
    [0, rgba(skin.palette[2], 0.36)],
    [0.55, rgba(skin.palette[1], 0.12)],
    [1, rgba(skin.palette[1], 0)],
  ]);
};

// ── lantern dragon ─────────────────────────────────────────────────────────
const drawLanternHead: Drawer = (ctx, _w, _h, skin) => {
  const red = skin.palette[0];
  const deep = skin.palette[1];
  const gold = skin.palette[2];
  softShadow(ctx, 112, 112, 102, 76, 0.24);

  const tufts = 7;
  for (let i = 0; i < tufts; i++) {
    const a = Math.PI * 0.62 + (i / (tufts - 1)) * Math.PI * 0.76;
    const len = 58 + (i % 2) * 10;
    const bx = 92;
    const by = 100;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const px = -sa;
    const py = ca;
    const wdt = 14;
    ctx.beginPath();
    ctx.moveTo(bx + px * wdt, by + py * wdt);
    ctx.quadraticCurveTo(bx + ca * len * 0.6 + px * wdt * 1.1, by + sa * len * 0.6 + py * wdt * 1.1, bx + ca * len, by + sa * len);
    ctx.quadraticCurveTo(bx + ca * len * 0.6 - px * wdt * 1.1, by + sa * len * 0.6 - py * wdt * 1.1, bx - px * wdt, by - py * wdt);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? "#ff8a3d" : gold;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(140,40,10,0.45)";
    ctx.stroke();
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of [-1, 1]) {
    const hornPath = () => {
      ctx.beginPath();
      ctx.moveTo(104, 100 + s * 30);
      ctx.quadraticCurveTo(72, 100 + s * 66, 34, 100 + s * 60);
      ctx.moveTo(66, 100 + s * 56);
      ctx.lineTo(56, 100 + s * 82);
    };
    hornPath();
    ctx.lineWidth = 13;
    ctx.strokeStyle = shade(gold, -80);
    ctx.stroke();
    hornPath();
    ctx.lineWidth = 8;
    ctx.strokeStyle = gold;
    ctx.stroke();
  }

  const hg = ctx.createRadialGradient(108, 84, 8, 120, 100, 72);
  hg.addColorStop(0, shade(red, 48));
  hg.addColorStop(0.55, red);
  hg.addColorStop(1, deep);
  ellipse(ctx, 120, 100, 66, 56);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = shade(deep, -45);
  ctx.stroke();

  ctx.strokeStyle = rgba(gold, 0.75);
  ctx.lineWidth = 2.5;
  for (const [x, y] of [
    [92, 86],
    [92, 114],
    [80, 100],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 9, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
  }

  const sg = ctx.createLinearGradient(140, 0, 200, 0);
  sg.addColorStop(0, red);
  sg.addColorStop(1, shade(red, 30));
  ellipse(ctx, 168, 100, 34, 31);
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = shade(deep, -45);
  ctx.stroke();
  ctx.fillStyle = shade(deep, -60);
  circle(ctx, 188, 88, 4.5);
  ctx.fill();
  circle(ctx, 188, 112, 4.5);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  for (const y of [94, 106]) {
    ctx.beginPath();
    ctx.moveTo(198, y - 4);
    ctx.lineTo(204, y);
    ctx.lineTo(198, y + 4);
    ctx.closePath();
    ctx.fill();
  }

  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(176, 100 + s * 24);
    ctx.bezierCurveTo(200, 100 + s * 36, 194, 100 + s * 70, 216, 100 + s * 80);
    ctx.lineWidth = 6;
    ctx.strokeStyle = shade(gold, -80);
    ctx.stroke();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = gold;
    ctx.stroke();
  }

  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (s < 0) ctx.arc(136, 72, 21, Math.PI * 1.12, Math.PI * 1.88);
    else ctx.arc(136, 128, 21, Math.PI * 0.12, Math.PI * 0.88);
    ctx.lineWidth = 6;
    ctx.strokeStyle = gold;
    ctx.stroke();
    cuteEye(ctx, 136, 100 + s * 28, 15.5, skin.eye, 0.3);
  }
  polygon(ctx, [110, 91, 119, 100, 110, 109, 101, 100], gold, shade(gold, -80), 2);
  gloss(ctx, 108, 78, 34, 14, -0.3, 0.38);
};

function drawLanternBody(ctx: Ctx, cx: number, cy: number, skin: Skin, gold: boolean): void {
  const base = gold ? skin.palette[2] : skin.palette[0];
  const cap = gold ? skin.palette[0] : skin.palette[2];
  radialFill(ctx, cx, cy, 68, [
    [0, "rgba(255,176,70,0.42)"],
    [0.6, "rgba(255,150,60,0.14)"],
    [1, "rgba(255,150,60,0)"],
  ]);
  softShadow(ctx, cx + 3, cy + 9, 58, 44, 0.18);
  const g = ctx.createRadialGradient(cx - 12, cy - 14, 4, cx, cy, 56);
  g.addColorStop(0, shade(base, 70));
  g.addColorStop(0.45, base);
  g.addColorStop(1, shade(base, -48));
  ellipse(ctx, cx, cy, 52, 46);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = shade(base, -70);
  ctx.stroke();
  ctx.strokeStyle = rgba(shade(base, -80), 0.4);
  ctx.lineWidth = 2;
  for (const ry of [16, 32]) {
    ellipse(ctx, cx, cy, 52, ry);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 52, cy);
  ctx.lineTo(cx + 52, cy);
  ctx.stroke();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = cap;
  ctx.fillRect(-9, -9, 18, 18);
  ctx.lineWidth = 2;
  ctx.strokeStyle = shade(cap, -80);
  ctx.strokeRect(-9, -9, 18, 18);
  ctx.fillStyle = base;
  ctx.fillRect(-4.5, -4.5, 9, 9);
  ctx.restore();

  for (const x of [cx - 61, cx + 47]) {
    const cg = ctx.createLinearGradient(0, cy - 20, 0, cy + 20);
    cg.addColorStop(0, shade(cap, 45));
    cg.addColorStop(1, shade(cap, -30));
    rr(ctx, x, cy - 20, 14, 40, 4);
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = shade(cap, -85);
    ctx.stroke();
  }
  gloss(ctx, cx - 16, cy - 22, 26, 10, -0.25, 0.5);
}

const drawLanternTail: Drawer = (ctx, _w, _h, skin) => {
  const red = skin.palette[0];
  const gold = skin.palette[2];
  ctx.lineCap = "round";
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    ctx.beginPath();
    ctx.moveTo(78, 64 + (t - 0.5) * 12);
    ctx.quadraticCurveTo(46, 64 + (t - 0.5) * 30, 14, 64 + (t - 0.5) * 50);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = i % 2 === 0 ? red : shade(red, -30);
    ctx.stroke();
  }
  rr(ctx, 64, 54, 12, 20, 4);
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = shade(gold, -80);
  ctx.stroke();
  circle(ctx, 82, 64, 6);
  ctx.fill();
  ctx.stroke();
  drawLanternBody(ctx, 145, 64, skin, false);
};

const drawLanternCord: Drawer = (ctx, _w, _h, skin) => {
  const gold = skin.palette[2];
  rr(ctx, 0, 2.8, 32, 4.4, 2.2);
  ctx.fillStyle = shade(gold, -70);
  ctx.fill();
  rr(ctx, 0, 3.6, 32, 2.6, 1.3);
  ctx.fillStyle = gold;
  ctx.fill();
};

// ── pixel ──────────────────────────────────────────────────────────────────
const PIXEL_HEAD = [
  "................",
  "....DDDDDDD.....",
  "...DLLLLLLLDD...",
  "..DLLBBBBBBBBD..",
  ".DLBBBBBBWWBBBD.",
  ".DLBBBBBBWKBBBD.",
  ".DBBBBBBBBBBBBBD",
  ".DBBBBBBBBBBBBBR",
  ".DBBBBBBBBBBBBBR",
  ".DBBBBBBBBBBBBBD",
  ".DSBBBBBBWWBBBD.",
  ".DSBBBBBBWKBBBD.",
  "..DSSBBBBBBBBD..",
  "...DSSSSSSSDD...",
  "....DDDDDDD.....",
  "................",
];
const PIXEL_BLOCK = ["DDDDDDDD", "DLLLLLBD", "DLBBBBSD", "DLBBBBSD", "DLBBBBSD", "DLBBBBSD", "DBSSSSSD", "DDDDDDDD"];
const PIXEL_COIN = ["DDDDDDDD", "DLLLLLBD", "DLBYYBSD", "DLYWYYSD", "DLYYYYSD", "DLBYYBSD", "DBSSSSSD", "DDDDDDDD"];

function drawPixelGrid(ctx: Ctx, rows: string[], colors: Record<string, string>): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function blockColors(base: string): Record<string, string> {
  return {
    B: base,
    L: shade(base, 60),
    S: shade(base, -45),
    D: shade(base, -100),
    Y: "#ffd84a",
    W: "#fff6c8",
  };
}

const drawPixelHead: Drawer = (ctx, _w, _h, skin) => {
  const base = skin.palette[0];
  drawPixelGrid(ctx, PIXEL_HEAD, {
    B: base,
    L: shade(base, 60),
    S: shade(base, -40),
    D: shade(base, -100),
    W: "#ffffff",
    K: skin.eye,
    R: "#ff4d5e",
  });
};

// ── helix ──────────────────────────────────────────────────────────────────
const drawHelixHead: Drawer = (ctx, _w, _h, skin) => {
  const front = skin.palette[0];
  const back = skin.palette[2];
  softShadow(ctx, 104, 82, 94, 50, 0.22);
  ctx.save();
  rr(ctx, 16, 22, 168, 96, 48);
  ctx.clip();
  let g = ctx.createLinearGradient(0, 22, 0, 118);
  g.addColorStop(0, shade(back, 50));
  g.addColorStop(0.5, back);
  g.addColorStop(1, shade(back, -40));
  ctx.fillStyle = g;
  ctx.fillRect(16, 22, 84, 96);
  g = ctx.createLinearGradient(0, 22, 0, 118);
  g.addColorStop(0, shade(front, 50));
  g.addColorStop(0.5, front);
  g.addColorStop(1, shade(front, -40));
  ctx.fillStyle = g;
  ctx.fillRect(100, 22, 84, 96);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(98, 22, 4, 96);
  ctx.restore();
  rr(ctx, 16, 22, 168, 96, 48);
  ctx.lineWidth = 4;
  ctx.strokeStyle = shade(skin.palette[1], -60);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  rr(ctx, 38, 30, 124, 14, 7);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  rr(ctx, 46, 66, 26, 8, 4);
  ctx.fill();
  rr(ctx, 55, 57, 8, 26, 4);
  ctx.fill();
  cuteEye(ctx, 145, 56, 12, skin.eye, 0.32);
  cuteEye(ctx, 145, 84, 12, skin.eye, 0.32);
  blush(ctx, 126, 38, 8, 4);
  blush(ctx, 126, 102, 8, 4);
};

function drawSphere(ctx: Ctx, color: string, back: boolean): void {
  const c = back ? shade(color, -55) : color;
  radialFill(ctx, 24, 24, 23, [
    [0, rgba(c, back ? 0.12 : 0.3)],
    [1, rgba(c, 0)],
  ]);
  const g = ctx.createRadialGradient(18, 17, 1, 24, 24, 17);
  g.addColorStop(0, back ? shade(c, 40) : "#ffffff");
  g.addColorStop(0.35, back ? c : shade(c, 30));
  g.addColorStop(1, shade(c, -45));
  ctx.fillStyle = g;
  circle(ctx, 24, 24, 17);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = shade(c, -75);
  ctx.stroke();
  if (!back) gloss(ctx, 19, 17, 6, 4, -0.5, 0.85);
}

const drawHelixRung: Drawer = (ctx, _w, _h, skin) => {
  const g = ctx.createLinearGradient(0, 2, 0, 8);
  g.addColorStop(0, "rgba(255,255,255,0.6)");
  g.addColorStop(0.5, "rgba(255,255,255,0.98)");
  g.addColorStop(1, rgba(skin.palette[1], 0.65));
  rr(ctx, 0, 2, 32, 6, 3);
  ctx.fillStyle = g;
  ctx.fill();
};

const drawHelixGlow: Drawer = (ctx, _w, _h, skin) => {
  radialFill(ctx, 32, 32, 32, [
    [0, rgba(skin.palette[1], 0.22)],
    [1, rgba(skin.palette[1], 0)],
  ]);
};

// ── origami paper chain ────────────────────────────────────────────────────
const drawCraneHead: Drawer = (ctx, _w, _h, skin) => {
  const paper = skin.head;
  const lite = shade(paper, 45);
  const dark = shade(paper, -40);
  const line = shade(paper, -85);
  softShadow(ctx, 118, 112, 98, 72, 0.2);
  polygon(ctx, [66, 100, 12, 92, 22, 100], lite, line);
  polygon(ctx, [66, 100, 22, 100, 12, 108], dark, line);
  polygon(ctx, [96, 94, 124, 92, 84, 12], lite, line);
  polygon(ctx, [124, 92, 152, 90, 84, 12], dark, line);
  polygon(ctx, [96, 106, 124, 108, 84, 188], dark, line);
  polygon(ctx, [124, 108, 152, 110, 84, 188], lite, line);
  polygon(ctx, [62, 100, 110, 84, 162, 100], lite, line);
  polygon(ctx, [62, 100, 162, 100, 110, 116], dark, line);
  polygon(ctx, [150, 96, 192, 97, 192, 103, 150, 104], lite, line);
  polygon(ctx, [182, 89, 218, 100, 182, 111], paper, line);
  ctx.fillStyle = "#e8453c";
  circle(ctx, 187, 100, 4.4);
  ctx.fill();
  beadyEye(ctx, 197, 95.4, 2.7, skin.eye);
  beadyEye(ctx, 197, 104.6, 2.7, skin.eye);
  ctx.strokeStyle = rgba(line, 0.45);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(110, 84);
  ctx.lineTo(110, 116);
  ctx.moveTo(124, 92);
  ctx.lineTo(84, 12);
  ctx.moveTo(124, 108);
  ctx.lineTo(84, 188);
  ctx.stroke();
};

function chainColor(skin: Skin, index: number): string {
  return [skin.palette[0], skin.palette[1], skin.palette[2], skin.head][index % 4];
}

function drawRing(ctx: Ctx, w: number, h: number, color: string): void {
  softShadow(ctx, 51, 70, 40, 58, 0.16);
  const [rc, r] = makeCanvas(w, h);
  const g = r.createLinearGradient(0, 8, 0, 120);
  g.addColorStop(0, shade(color, 45));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -32));
  r.fillStyle = g;
  ellipse(r, 48, 64, 36, 56);
  r.fill();
  r.globalCompositeOperation = "destination-out";
  ellipse(r, 48, 64, 20, 38);
  r.fill();
  r.globalCompositeOperation = "source-over";
  r.lineWidth = 4;
  r.strokeStyle = rgba(shade(color, -70), 0.55);
  ellipse(r, 48, 64, 21, 39);
  r.stroke();
  r.lineWidth = 3;
  r.strokeStyle = shade(color, -70);
  ellipse(r, 48, 64, 35.5, 55.5);
  r.stroke();
  rr(r, 39, 7, 18, 20, 3);
  r.fillStyle = shade(color, 18);
  r.fill();
  r.lineWidth = 2;
  r.strokeStyle = shade(color, -60);
  r.stroke();
  r.strokeStyle = "rgba(255,255,255,0.55)";
  r.lineWidth = 3;
  r.lineCap = "round";
  r.beginPath();
  r.ellipse(48, 64, 30, 50, 0, Math.PI * 1.05, Math.PI * 1.35);
  r.stroke();
  ctx.drawImage(rc, 0, 0);
}

function drawEdge(ctx: Ctx, color: string): void {
  softShadow(ctx, 58, 28, 54, 16, 0.15);
  const g = ctx.createLinearGradient(0, 12, 0, 36);
  g.addColorStop(0, shade(color, 50));
  g.addColorStop(1, shade(color, -35));
  rr(ctx, 8, 12, 96, 24, 12);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = shade(color, -70);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  rr(ctx, 18, 15.5, 74, 4, 2);
  ctx.fill();
}

// ── comet ──────────────────────────────────────────────────────────────────
function flamePath(ctx: Ctx, fx: number, cy: number, r: number, tail: number, wave: number): void {
  const len = fx - tail;
  ctx.beginPath();
  ctx.moveTo(fx, cy - r);
  ctx.bezierCurveTo(fx - len * 0.35, cy - r * (1 + wave), fx - len * 0.7, cy - r * 0.35, tail, cy);
  ctx.bezierCurveTo(fx - len * 0.7, cy + r * 0.35, fx - len * 0.35, cy + r * (1 + wave), fx, cy + r);
  ctx.arc(fx, cy, r, Math.PI / 2, -Math.PI / 2, true);
  ctx.closePath();
}

const drawCometHead: Drawer = (ctx, _w, _h, skin) => {
  const mid = skin.palette[0];
  const cool = skin.palette[1];
  const hot = skin.palette[2];
  radialFill(ctx, 150, 80, 78, [
    [0, rgba(hot, 0.5)],
    [0.5, rgba(mid, 0.2)],
    [1, rgba(mid, 0)],
  ]);
  flamePath(ctx, 150, 80, 52, 10, 0.25);
  let g = ctx.createLinearGradient(10, 0, 202, 0);
  g.addColorStop(0, rgba(cool, 0));
  g.addColorStop(0.45, rgba(cool, 0.85));
  g.addColorStop(0.8, mid);
  g.addColorStop(1, shade(mid, 30));
  ctx.fillStyle = g;
  ctx.fill();
  flamePath(ctx, 152, 80, 40, 40, 0.18);
  g = ctx.createLinearGradient(40, 0, 192, 0);
  g.addColorStop(0, rgba(mid, 0));
  g.addColorStop(0.6, mid);
  g.addColorStop(1, hot);
  ctx.fillStyle = g;
  ctx.fill();
  const core = ctx.createRadialGradient(160, 72, 3, 154, 80, 36);
  core.addColorStop(0, "#fffdf0");
  core.addColorStop(0.55, hot);
  core.addColorStop(1, mid);
  ctx.fillStyle = core;
  circle(ctx, 154, 80, 36);
  ctx.fill();
  beadyEye(ctx, 166, 69, 6.2, skin.eye);
  beadyEye(ctx, 166, 91, 6.2, skin.eye);
  blush(ctx, 152, 60, 6, 3.5);
  blush(ctx, 152, 100, 6, 3.5);
};

function drawFlame(ctx: Ctx, c1: string, c2: string, c3: string, alpha: number): void {
  flamePath(ctx, 68, 40, 24, 4, 0.22);
  const g = ctx.createLinearGradient(4, 0, 92, 0);
  g.addColorStop(0, rgba(c1, 0));
  g.addColorStop(0.45, rgba(c1, 0.8 * alpha));
  g.addColorStop(0.8, rgba(c2, alpha));
  g.addColorStop(1, rgba(c3, alpha));
  ctx.fillStyle = g;
  ctx.fill();
  flamePath(ctx, 70, 40, 13, 30, 0.15);
  ctx.fillStyle = rgba(c3, 0.42 * alpha);
  ctx.fill();
}

// ── registry ───────────────────────────────────────────────────────────────
const DRAW: Record<ArtId, Drawer> = {
  ...COLLECTION_DRAWERS,
  ...CURIOUS_DRAWERS,
  "classic.band0": (ctx, _w, _h, skin) => drawClassicBand(ctx, skin, 0),
  "classic.band1": (ctx, _w, _h, skin) => drawClassicBand(ctx, skin, 1),
  "classic.head": drawClassicHead,

  "train.head": drawTrainHead,
  "train.carA": (ctx, _w, _h, skin) => drawCar(ctx, skin, "A"),
  "train.carB": (ctx, _w, _h, skin) => drawCar(ctx, skin, "B"),
  "train.caboose": (ctx, _w, _h, skin) => drawCar(ctx, skin, "caboose"),
  "train.link": drawTrainLink,

  "pencil.head": drawPencilHead,
  "pencil.line": drawPencilLine,
  "pencil.sketch": drawPencilSketch,
  "pencil.smudge": drawPencilSmudge,

  "star.head": drawStarHead,
  "star.small": drawStarSmall,
  "star.big": drawStarBig,
  "star.link": drawStarLink,
  "star.nebula": drawStarNebula,

  "lantern.head": drawLanternHead,
  "lantern.red": (ctx, _w, _h, skin) => drawLanternBody(ctx, 75, 64, skin, false),
  "lantern.gold": (ctx, _w, _h, skin) => drawLanternBody(ctx, 75, 64, skin, true),
  "lantern.tail": drawLanternTail,
  "lantern.cord": drawLanternCord,

  "pixel.head": drawPixelHead,
  "pixel.a": (ctx, _w, _h, skin) => drawPixelGrid(ctx, PIXEL_BLOCK, blockColors(skin.palette[0])),
  "pixel.b": (ctx, _w, _h, skin) => drawPixelGrid(ctx, PIXEL_BLOCK, blockColors(skin.palette[2])),
  "pixel.c": (ctx, _w, _h, skin) => drawPixelGrid(ctx, PIXEL_COIN, blockColors(skin.palette[0])),
  "pixel.tail": (ctx, _w, _h, skin) => drawPixelGrid(ctx, PIXEL_BLOCK, blockColors(skin.palette[1])),

  "helix.head": drawHelixHead,
  "helix.aFront": (ctx, _w, _h, skin) => drawSphere(ctx, skin.palette[0], false),
  "helix.aBack": (ctx, _w, _h, skin) => drawSphere(ctx, skin.palette[0], true),
  "helix.bFront": (ctx, _w, _h, skin) => drawSphere(ctx, skin.palette[2], false),
  "helix.bBack": (ctx, _w, _h, skin) => drawSphere(ctx, skin.palette[2], true),
  "helix.rung": drawHelixRung,
  "helix.glow": drawHelixGlow,

  "chain.head": drawCraneHead,
  "chain.ring0": (ctx, w, h, skin) => drawRing(ctx, w, h, chainColor(skin, 0)),
  "chain.ring1": (ctx, w, h, skin) => drawRing(ctx, w, h, chainColor(skin, 1)),
  "chain.ring2": (ctx, w, h, skin) => drawRing(ctx, w, h, chainColor(skin, 2)),
  "chain.ring3": (ctx, w, h, skin) => drawRing(ctx, w, h, chainColor(skin, 3)),
  "chain.edge0": (ctx, _w, _h, skin) => drawEdge(ctx, chainColor(skin, 0)),
  "chain.edge1": (ctx, _w, _h, skin) => drawEdge(ctx, chainColor(skin, 1)),
  "chain.edge2": (ctx, _w, _h, skin) => drawEdge(ctx, chainColor(skin, 2)),
  "chain.edge3": (ctx, _w, _h, skin) => drawEdge(ctx, chainColor(skin, 3)),

  "comet.head": drawCometHead,
  "comet.hot": (ctx, _w, _h, skin) => drawFlame(ctx, skin.palette[0], skin.palette[2], "#fffbe8", 1),
  "comet.mid": (ctx, _w, _h, skin) => drawFlame(ctx, skin.palette[1], skin.palette[0], skin.palette[2], 1),
  "comet.cool": (ctx, _w, _h, skin) => drawFlame(ctx, shade(skin.palette[1], -30), skin.palette[1], skin.palette[0], 0.85),
  "comet.glow": (ctx, _w, _h, skin) =>
    radialFill(ctx, 32, 32, 32, [
      [0, rgba(skin.palette[0], 0.32)],
      [0.5, rgba(skin.palette[1], 0.12)],
      [1, rgba(skin.palette[1], 0)],
    ]),
  "comet.ember": (ctx, _w, _h, skin) =>
    radialFill(ctx, 16, 16, 16, [
      [0, "#fffbe8"],
      [0.3, rgba(skin.palette[2], 0.95)],
      [0.6, rgba(skin.palette[0], 0.5)],
      [1, rgba(skin.palette[0], 0)],
    ]),
};
