/**
 * Structural skin layout engine (pure TS — no DOM, no PixiJS).
 *
 * A snake body is a dense centre-line polyline. Each skin "form" resamples
 * that polyline by arc length and emits sprite placements (art id, position,
 * rotation, world size, alpha) in draw order (bottom → top).
 *
 * The same placements feed both the PixiJS renderer and the 2D-canvas menu
 * previews, so what you see in the closet is exactly what you get in game.
 * Collision is NOT affected: hitboxes always use the engine's radius.
 */
import type { Vec2 } from "../game/types";
import type { SkinForm } from "../game/skins";

export interface ArtSpec {
  /** canvas width in px (forward direction = +X for oriented art) */
  w: number;
  /** canvas height in px */
  h: number;
  /** nearest-neighbour scaling (pixel art) */
  pixel?: boolean;
}

const SPECS = {
  "classic.band0": { w: 144, h: 144 },
  "classic.band1": { w: 144, h: 144 },
  "classic.head": { w: 208, h: 208 },

  "train.head": { w: 240, h: 160 },
  "train.carA": { w: 170, h: 140 },
  "train.carB": { w: 170, h: 140 },
  "train.caboose": { w: 170, h: 140 },
  "train.link": { w: 32, h: 12 },

  "pencil.head": { w: 280, h: 130 },
  "pencil.line": { w: 64, h: 32 },
  "pencil.sketch": { w: 64, h: 20 },
  "pencil.smudge": { w: 64, h: 64 },

  "star.head": { w: 170, h: 170 },
  "star.small": { w: 64, h: 64 },
  "star.big": { w: 96, h: 96 },
  "star.link": { w: 32, h: 12 },
  "star.nebula": { w: 64, h: 64 },

  "lantern.head": { w: 220, h: 200 },
  "lantern.red": { w: 150, h: 128 },
  "lantern.gold": { w: 150, h: 128 },
  "lantern.tail": { w: 220, h: 128 },
  "lantern.cord": { w: 32, h: 10 },

  "pixel.head": { w: 16, h: 16, pixel: true },
  "pixel.a": { w: 8, h: 8, pixel: true },
  "pixel.b": { w: 8, h: 8, pixel: true },
  "pixel.c": { w: 8, h: 8, pixel: true },
  "pixel.tail": { w: 8, h: 8, pixel: true },

  "helix.head": { w: 200, h: 140 },
  "helix.aFront": { w: 48, h: 48 },
  "helix.aBack": { w: 48, h: 48 },
  "helix.bFront": { w: 48, h: 48 },
  "helix.bBack": { w: 48, h: 48 },
  "helix.rung": { w: 32, h: 10 },
  "helix.glow": { w: 64, h: 64 },

  "chain.head": { w: 220, h: 200 },
  "chain.ring0": { w: 96, h: 128 },
  "chain.ring1": { w: 96, h: 128 },
  "chain.ring2": { w: 96, h: 128 },
  "chain.ring3": { w: 96, h: 128 },
  "chain.edge0": { w: 112, h: 48 },
  "chain.edge1": { w: 112, h: 48 },
  "chain.edge2": { w: 112, h: 48 },
  "chain.edge3": { w: 112, h: 48 },

  "comet.head": { w: 220, h: 160 },
  "comet.hot": { w: 96, h: 80 },
  "comet.mid": { w: 96, h: 80 },
  "comet.cool": { w: 96, h: 80 },
  "comet.glow": { w: 64, h: 64 },
  "comet.ember": { w: 32, h: 32 },
  "koi.head": { w: 220, h: 180 },
  "koi.white": { w: 140, h: 150 },
  "koi.coral": { w: 140, h: 150 },
  "koi.fin": { w: 160, h: 190 },
  "koi.tail": { w: 220, h: 200 },
  "jelly.head": { w: 200, h: 210 },
  "jelly.ribbon": { w: 120, h: 64 },
  "jelly.core": { w: 100, h: 100 },
  "jelly.pearl": { w: 40, h: 40 },
  "film.head": { w: 230, h: 190 },
  "film.frame0": { w: 140, h: 120 },
  "film.frame1": { w: 140, h: 120 },
  "film.frame2": { w: 140, h: 120 },
  "kite.head": { w: 220, h: 220 },
  "kite.sail0": { w: 160, h: 160 },
  "kite.sail1": { w: 160, h: 160 },
  "kite.string": { w: 64, h: 12 },
  "kite.tail": { w: 160, h: 120 },
  "garden.head": { w: 220, h: 190 },
  "garden.stem": { w: 96, h: 70 },
  "garden.leaf0": { w: 150, h: 90 },
  "garden.leaf1": { w: 150, h: 90 },
  "garden.flower": { w: 100, h: 100 },
  "garden.bud": { w: 150, h: 90 },
  "zip.head": { w: 220, h: 170 },
  "zip.fabric": { w: 100, h: 160 },
  "zip.teeth": { w: 100, h: 100 },
  "zip.pull": { w: 160, h: 90 },
  "clock.head": { w: 220, h: 200 },
  "clock.gear0": { w: 160, h: 160 },
  "clock.gear1": { w: 160, h: 160 },
  "clock.link": { w: 100, h: 44 },
  "clock.hub": { w: 44, h: 44 },
  "orbit.head": { w: 220, h: 200 },
  "orbit.band": { w: 96, h: 90 },
  "orbit.ring": { w: 170, h: 140 },
  "orbit.satellite": { w: 70, h: 60 },
  "orbit.star": { w: 48, h: 48 },
} satisfies Record<string, ArtSpec>;

export type ArtId = keyof typeof SPECS;
export const ART_SPECS: Record<ArtId, ArtSpec> = SPECS;
export const ALL_ART_IDS = Object.keys(SPECS) as ArtId[];

export interface HeadSpec {
  art: ArtId;
  /** world width of the full head canvas, in multiples of the snake radius */
  size: number;
  /** canvas-relative anchor that sits exactly on the logical head position */
  anchorX: number;
  anchorY: number;
  rotation: "follow" | "snap90";
}

export const HEAD_SPECS: Record<SkinForm, HeadSpec> = {
  botanical: { art: "garden.head", size: 3.45, anchorX: 0.64, anchorY: 0.5, rotation: "follow" },
  zipper: { art: "zip.head", size: 3.3, anchorX: 0.64, anchorY: 0.5, rotation: "follow" },
  clockwork: { art: "clock.head", size: 3.5, anchorX: 0.64, anchorY: 0.5, rotation: "follow" },
  orbital: { art: "orbit.head", size: 3.4, anchorX: 0.59, anchorY: 0.5, rotation: "follow" },
  koi: { art: "koi.head", size: 3.5, anchorX: 0.64, anchorY: 0.5, rotation: "follow" },
  jellyfish: { art: "jelly.head", size: 3.3, anchorX: 0.68, anchorY: 0.5, rotation: "follow" },
  cinema: { art: "film.head", size: 3.4, anchorX: 0.68, anchorY: 0.5, rotation: "follow" },
  kite: { art: "kite.head", size: 3.5, anchorX: 0.58, anchorY: 0.5, rotation: "follow" },
  classic: { art: "classic.head", size: 3.12, anchorX: 0.5, anchorY: 0.5, rotation: "follow" },
  train: { art: "train.head", size: 4.6, anchorX: 0.8, anchorY: 0.5, rotation: "follow" },
  pencil: { art: "pencil.head", size: 5.4, anchorX: 0.88, anchorY: 0.5, rotation: "follow" },
  starchart: { art: "star.head", size: 4.0, anchorX: 0.5, anchorY: 0.5, rotation: "follow" },
  lantern: { art: "lantern.head", size: 4.4, anchorX: 0.56, anchorY: 0.5, rotation: "follow" },
  pixel: { art: "pixel.head", size: 3.0, anchorX: 0.5, anchorY: 0.5, rotation: "snap90" },
  helix: { art: "helix.head", size: 4.2, anchorX: 0.62, anchorY: 0.5, rotation: "follow" },
  paperchain: { art: "chain.head", size: 4.6, anchorX: 0.52, anchorY: 0.5, rotation: "follow" },
  comet: { art: "comet.head", size: 4.6, anchorX: 0.68, anchorY: 0.5, rotation: "follow" },
};

export function headRotationFor(form: SkinForm, angle: number): number {
  if (HEAD_SPECS[form].rotation === "snap90") {
    const q = Math.PI / 2;
    return Math.round(angle / q) * q;
  }
  return angle;
}

export function headBreathFor(form: SkinForm, time: number): number {
  if (form === "jellyfish") return 1 + Math.sin(time * 2.4) * 0.045;
  if (form === "botanical") return 1 + Math.sin(time * 1.7) * 0.022;
  return 1;
}

const CHAIN_RINGS: readonly ArtId[] = ["chain.ring0", "chain.ring1", "chain.ring2", "chain.ring3"];
const CHAIN_EDGES: readonly ArtId[] = ["chain.edge0", "chain.edge1", "chain.edge2", "chain.edge3"];

/** Every art id a form may emit (head included). Used by tests & preloading. */
export const FORM_ARTS: Record<SkinForm, readonly ArtId[]> = {
  botanical: ["garden.head", "garden.stem", "garden.leaf0", "garden.leaf1", "garden.flower", "garden.bud"],
  zipper: ["zip.head", "zip.fabric", "zip.teeth", "zip.pull"],
  clockwork: ["clock.head", "clock.gear0", "clock.gear1", "clock.link", "clock.hub"],
  orbital: ["orbit.head", "orbit.band", "orbit.ring", "orbit.satellite", "orbit.star"],
  koi: ["koi.head", "koi.white", "koi.coral", "koi.fin", "koi.tail"],
  jellyfish: ["jelly.head", "jelly.ribbon", "jelly.core", "jelly.pearl"],
  cinema: ["film.head", "film.frame0", "film.frame1", "film.frame2"],
  kite: ["kite.head", "kite.sail0", "kite.sail1", "kite.string", "kite.tail"],
  classic: ["classic.band0", "classic.band1", "classic.head"],
  train: ["train.head", "train.carA", "train.carB", "train.caboose", "train.link"],
  pencil: ["pencil.head", "pencil.line", "pencil.sketch", "pencil.smudge"],
  starchart: ["star.head", "star.small", "star.big", "star.link", "star.nebula"],
  lantern: ["lantern.head", "lantern.red", "lantern.gold", "lantern.tail", "lantern.cord"],
  pixel: ["pixel.head", "pixel.a", "pixel.b", "pixel.c", "pixel.tail"],
  helix: ["helix.head", "helix.aFront", "helix.aBack", "helix.bFront", "helix.bBack", "helix.rung", "helix.glow"],
  paperchain: ["chain.head", ...CHAIN_RINGS, ...CHAIN_EDGES],
  comet: ["comet.head", "comet.hot", "comet.mid", "comet.cool", "comet.glow", "comet.ember"],
};

export interface Placement {
  art: ArtId;
  x: number;
  y: number;
  rot: number;
  /** world width (along the art's +X axis) */
  w: number;
  /** world height */
  h: number;
  alpha: number;
}

/** Reusable placement buffer — no per-frame allocations once warmed up. */
export class LayoutBuffer {
  items: Placement[] = [];
  count = 0;

  reset(): void {
    this.count = 0;
  }

  push(art: ArtId, x: number, y: number, rot: number, w: number, h: number, alpha = 1): void {
    let p = this.items[this.count];
    if (!p) {
      p = { art, x, y, rot, w, h, alpha };
      this.items[this.count] = p;
    } else {
      p.art = art;
      p.x = x;
      p.y = y;
      p.rot = rot;
      p.w = w;
      p.h = h;
      p.alpha = alpha;
    }
    this.count++;
  }
}

export interface LayoutInput {
  /** centre line, index 0 = head */
  points: Vec2[];
  radius: number;
  /** head heading in radians */
  angle: number;
  /** seconds, drives idle animation */
  time: number;
  boosting: boolean;
  /** Integrated visual time keeps rotations continuous when boost toggles. */
  motionTime?: number;
}

// ── arc-length resampling scratch (shared; JS is single threaded) ──────────
const MAX_SAMPLES = 1200;
const SX = new Float64Array(MAX_SAMPLES);
const SY = new Float64Array(MAX_SAMPLES);
const SA = new Float64Array(MAX_SAMPLES);
const SS = new Float64Array(MAX_SAMPLES);
let SN = 0;
let STOTAL = 0;

/**
 * Emit samples every `step` world units starting `start` units behind the head.
 * SA holds the forward (toward-head) direction at each sample.
 */
function resample(points: Vec2[], start: number, step: number, headAngle: number): number {
  SN = 0;
  STOTAL = 0;
  const n = points.length;
  if (n < 2 || !(step > 0)) return 0;
  let acc = 0;
  let target = Math.max(0, start);
  for (let i = 1; i < n; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) continue;
    while (target <= acc + len && SN < MAX_SAMPLES) {
      const f = (target - acc) / len;
      SX[SN] = a.x + dx * f;
      SY[SN] = a.y + dy * f;
      SS[SN] = target;
      SN++;
      target += step;
    }
    acc += len;
  }
  STOTAL = acc;
  const hx = points[0].x;
  const hy = points[0].y;
  for (let k = 0; k < SN; k++) {
    const px = k === 0 ? hx : SX[k - 1];
    const py = k === 0 ? hy : SY[k - 1];
    const nx = k === SN - 1 ? SX[k] : SX[k + 1];
    const ny = k === SN - 1 ? SY[k] : SY[k + 1];
    const ddx = px - nx;
    const ddy = py - ny;
    SA[k] = ddx * ddx + ddy * ddy < 1e-9 ? (k === 0 ? headAngle : SA[k - 1]) : Math.atan2(ddy, ddx);
  }
  return SN;
}

function pushLink(
  out: LayoutBuffer,
  art: ArtId,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
  alpha: number
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return;
  out.push(art, (x1 + x2) / 2, (y1 + y2) / 2, Math.atan2(dy, dx), len, thickness, alpha);
}

function progress(k: number): number {
  return STOTAL > 0 ? SS[k] / STOTAL : 0;
}

// ── forms ──────────────────────────────────────────────────────────────────

/** Original plump gummy segments, dual bands, tapered tail, wobble & breathing. */
function layoutClassic({ points, radius: r, angle, time: t, boosting }: LayoutInput, out: LayoutBuffer): void {
  const step = Math.max(4.4, r * 0.56);
  const n = resample(points, step, step, angle);
  if (!n) return;
  const tc = Math.min(10, Math.max(4, Math.floor((n + 1) * 0.24)));
  const amp = boosting ? 0.14 : 0.095;
  const freq = boosting ? 11.5 : 7.8;
  for (let k = n - 1; k >= 0; k--) {
    const i = k + 1;
    const fromTail = n - 1 - k;
    const taper = fromTail < tc ? 0.5 + 0.5 * (fromTail / tc) : 1;
    const breathe = 1 + Math.sin(t * 4.8 - i * 0.35) * 0.032;
    const wob = Math.sin(t * freq - i * 0.42) * r * amp * Math.min(1, i / 6);
    const a = SA[k];
    const size = r * 3.04 * taper * breathe;
    out.push(
      Math.floor(i / 3) % 2 === 0 ? "classic.band0" : "classic.band1",
      SX[k] - Math.sin(a) * wob,
      SY[k] + Math.cos(a) * wob,
      0,
      size,
      size,
      1
    );
  }
}

/** Locomotive head, articulated carriages that rotate through bends, couplers, caboose. */
function layoutTrain({ points, radius: r, angle }: LayoutInput, out: LayoutBuffer): void {
  const n = resample(points, r * 4.9, r * 2.95, angle);
  if (!n) return;
  const carW = r * 3.3;
  const carH = carW * (140 / 170);
  const rx = points[0].x - Math.cos(angle) * r * 3.3;
  const ry = points[0].y - Math.sin(angle) * r * 3.3;
  pushLink(out, "train.link", rx, ry, SX[0], SY[0], r * 0.4, 1);
  for (let k = 1; k < n; k++) pushLink(out, "train.link", SX[k - 1], SY[k - 1], SX[k], SY[k], r * 0.4, 1);
  for (let k = n - 1; k >= 0; k--) {
    const art: ArtId = k === n - 1 && n > 1 ? "train.caboose" : k % 3 === 1 ? "train.carB" : "train.carA";
    out.push(art, SX[k], SY[k], SA[k], carW, carH, 1);
  }
}

/** The body IS a pencil stroke: graphite smudge band + line + sketchy offset line. */
function layoutPencil({ points, radius: r, angle }: LayoutInput, out: LayoutBuffer): void {
  const fade = (k: number) => {
    const u = progress(k);
    return u > 0.82 ? Math.max(0.25, 1 - ((u - 0.82) / 0.18) * 0.75) : 1;
  };
  let n = resample(points, r * 0.5, r * 1.0, angle);
  for (let k = n - 1; k >= 0; k--) out.push("pencil.smudge", SX[k], SY[k], 0, r * 2.6, r * 2.6, 0.62 * fade(k));
  n = resample(points, r * 0.2, r * 0.6, angle);
  for (let k = n - 1; k >= 0; k--) out.push("pencil.line", SX[k], SY[k], SA[k], r * 1.6, r * 1.85, fade(k));
  n = resample(points, r * 0.4, r * 0.85, angle);
  for (let k = n - 1; k >= 0; k--) {
    const a = SA[k];
    const off = r * 0.55;
    out.push("pencil.sketch", SX[k] - Math.sin(a) * off, SY[k] + Math.cos(a) * off, a, r * 1.6, r * 0.5, 0.6 * fade(k));
  }
}

/** Moon head, twinkling stars joined by light lines over a faint nebula band. */
function layoutStarchart({ points, radius: r, angle, time: t }: LayoutInput, out: LayoutBuffer): void {
  let n = resample(points, r * 0.9, r * 1.05, angle);
  for (let k = n - 1; k >= 0; k--) out.push("star.nebula", SX[k], SY[k], 0, r * 2.8, r * 2.8, 1);
  n = resample(points, r * 2.2, r * 1.85, angle);
  if (!n) return;
  pushLink(
    out,
    "star.link",
    points[0].x - Math.cos(angle) * r * 1.0,
    points[0].y - Math.sin(angle) * r * 1.0,
    SX[0],
    SY[0],
    r * 0.34,
    0.92
  );
  for (let k = 1; k < n; k++) pushLink(out, "star.link", SX[k - 1], SY[k - 1], SX[k], SY[k], r * 0.34, 0.92);
  for (let k = n - 1; k >= 0; k--) {
    const big = k % 4 === 3;
    const last = k === n - 1;
    const tw = 1 + Math.sin(t * 3.1 + k * 1.9) * 0.12;
    const size = (last ? r * 1.2 : big ? r * 2.8 : r * 2.0) * tw;
    out.push(big ? "star.big" : "star.small", SX[k], SY[k], big ? Math.sin(t * 1.4 + k) * 0.18 : t * 0.7 + k * 0.6, size, size, 0.98);
  }
}

/** Dragon-dance head; swinging lanterns strung on a golden cord; tasselled tail. */
function layoutLantern({ points, radius: r, angle, time: t }: LayoutInput, out: LayoutBuffer): void {
  const n = resample(points, r * 3.5, r * 2.85, angle);
  if (!n) return;
  const bx = points[0].x - Math.cos(angle) * r * 1.8;
  const by = points[0].y - Math.sin(angle) * r * 1.8;
  pushLink(out, "lantern.cord", bx, by, SX[0], SY[0], r * 0.3, 1);
  for (let k = 1; k < n; k++) pushLink(out, "lantern.cord", SX[k - 1], SY[k - 1], SX[k], SY[k], r * 0.3, 1);
  const w = r * 3.1;
  const h = w * (128 / 150);
  for (let k = n - 1; k >= 0; k--) {
    const a = SA[k] + Math.sin(t * 2.4 + k * 0.9) * 0.1;
    if (k === n - 1 && n > 1) {
      const tw = w * (220 / 150);
      const off = tw * (35 / 220);
      out.push("lantern.tail", SX[k] - Math.cos(a) * off, SY[k] - Math.sin(a) * off, a, tw, h, 1);
    } else {
      out.push(k % 4 === 3 ? "lantern.gold" : "lantern.red", SX[k], SY[k], a, w, h, 1);
    }
  }
}

/** Axis-aligned 8-bit blocks (never rotate); the head snaps to 4 directions. */
function layoutPixel({ points, radius: r, angle }: LayoutInput, out: LayoutBuffer): void {
  const n = resample(points, r * 1.05, r * 0.95, angle);
  for (let k = n - 1; k >= 0; k--) {
    const fromTail = n - 1 - k;
    const mul = fromTail === 0 ? 0.62 : fromTail === 1 ? 0.8 : 1;
    const art: ArtId = fromTail === 0 ? "pixel.tail" : k % 5 === 4 ? "pixel.c" : k % 2 === 0 ? "pixel.a" : "pixel.b";
    const size = r * 2.0 * mul;
    out.push(art, SX[k], SY[k], 0, size, size, 1);
  }
}

/** Two strands rotate around the centre line; depth drives size & draw order. */
function layoutHelix({ points, radius: r, angle, time: t }: LayoutInput, out: LayoutBuffer): void {
  let n = resample(points, r * 0.9, r * 1.1, angle);
  for (let k = n - 1; k >= 0; k--) out.push("helix.glow", SX[k], SY[k], 0, r * 2.8, r * 2.8, 1);
  n = resample(points, r * 1.2, r * 0.55, angle);
  if (!n) return;
  const amp = r * 0.95;
  const waveK = (Math.PI * 2) / (r * 5);
  const phase = t * 3.2;
  // pass 1 — the strand that is currently behind
  for (let k = n - 1; k >= 0; k--) {
    const ph = phase - SS[k] * waveK;
    const sn = Math.sin(ph);
    const cs = Math.cos(ph);
    const a = SA[k];
    const backIsA = cs < 0;
    const off = backIsA ? sn * amp : -sn * amp;
    const size = r * 1.02 * (0.85 - 0.2 * Math.abs(cs));
    out.push(backIsA ? "helix.aBack" : "helix.bBack", SX[k] - Math.sin(a) * off, SY[k] + Math.cos(a) * off, 0, size, size, 0.92);
  }
  // pass 2 — base-pair rungs
  for (let k = n - 1; k >= 0; k--) {
    if (k % 3 !== 0) continue;
    const sn = Math.sin(phase - SS[k] * waveK);
    if (Math.abs(sn) < 0.25) continue;
    const a = SA[k];
    const ox = -Math.sin(a) * sn * amp;
    const oy = Math.cos(a) * sn * amp;
    pushLink(out, "helix.rung", SX[k] + ox, SY[k] + oy, SX[k] - ox, SY[k] - oy, r * 0.26, 0.9);
  }
  // pass 3 — the strand in front
  for (let k = n - 1; k >= 0; k--) {
    const ph = phase - SS[k] * waveK;
    const sn = Math.sin(ph);
    const cs = Math.cos(ph);
    const a = SA[k];
    const frontIsA = cs >= 0;
    const off = frontIsA ? sn * amp : -sn * amp;
    const size = r * 1.02 * (0.85 + 0.2 * Math.abs(cs));
    out.push(frontIsA ? "helix.aFront" : "helix.bFront", SX[k] - Math.sin(a) * off, SY[k] + Math.cos(a) * off, 0, size, size, 1);
  }
}

/** Origami crane pulling interlocking construction-paper rings (flat ↔ edge-on). */
function layoutPaperchain({ points, radius: r, angle, time: t }: LayoutInput, out: LayoutBuffer): void {
  const n = resample(points, r * 2.0, r * 1.2, angle);
  const ringH = r * 2.55;
  const ringW = ringH * (96 / 128);
  const edgeW = r * 2.2;
  const edgeH = r * 0.95;
  for (let k = n - 1; k >= 0; k--) {
    if (k % 2 === 0) continue;
    out.push(CHAIN_EDGES[(k >> 1) % 4], SX[k], SY[k], SA[k] + Math.sin(t * 2.6 + k) * 0.05, edgeW, edgeH, 1);
  }
  for (let k = n - 1; k >= 0; k--) {
    if (k % 2 === 1) continue;
    out.push(CHAIN_RINGS[(k >> 1) % 4], SX[k], SY[k], SA[k] + Math.sin(t * 2.6 + k * 0.7) * 0.06, ringW, ringH, 1);
  }
}

/** Fireball head; flame tongues cool from yellow to red and taper toward the tail. */
function layoutComet({ points, radius: r, angle, time: t, boosting }: LayoutInput, out: LayoutBuffer): void {
  let n = resample(points, r * 0.8, r * 1.0, angle);
  for (let k = n - 1; k >= 0; k--) {
    const u = progress(k);
    const p = u < 0.55 ? 1 : 1 - ((u - 0.55) / 0.45) * 0.55;
    out.push("comet.glow", SX[k], SY[k], 0, r * 3.1 * p, r * 3.1 * p, 1);
  }
  n = resample(points, r * 0.7, r * 0.45, angle);
  const fl = boosting ? 0.15 : 0.08;
  for (let k = n - 1; k >= 0; k--) {
    const u = progress(k);
    const p = u < 0.55 ? 1 : 1 - ((u - 0.55) / 0.45) * 0.62;
    const flick = 1 + Math.sin(t * 17 + k * 2.1) * fl;
    const art: ArtId = u < 0.22 ? "comet.hot" : u < 0.62 ? "comet.mid" : "comet.cool";
    out.push(art, SX[k], SY[k], SA[k], r * 2.3 * p * flick, r * 3.0 * p * flick, u > 0.85 ? 0.8 : 0.95);
  }
  for (let k = n - 1; k >= 0; k--) {
    if (k % 5 !== 2) continue;
    const u = progress(k);
    if (u < 0.35) continue;
    const a = SA[k];
    const off = Math.sin(t * 4 + k * 1.3) * r * 1.2;
    out.push("comet.ember", SX[k] - Math.sin(a) * off, SY[k] + Math.cos(a) * off, 0, r * 0.7, r * 0.7, Math.max(0.15, 0.85 * (1.15 - u)));
  }
}

function layoutKoi({ points, radius: r, angle, time: t }: LayoutInput, out: LayoutBuffer): void {
  const n = resample(points, r * 0.6, r * 0.9, angle);
  if (!n) return;
  const tail = n - 1;
  out.push("koi.tail", SX[tail], SY[tail], SA[tail] + Math.sin(t * 2.4) * 0.18, r * 3.0, r * 2.7);
  for (let k = n - 2; k >= 0; k--) {
    const taper = 0.55 + Math.min(1, (n - k) / 9) * 0.45;
    const flap = Math.sin(t * 2.1 - k * 0.4) * 0.06;
    if (k % 5 === 2) out.push("koi.fin", SX[k], SY[k], SA[k] + flap, r * 2, r * 2.9 * taper, 0.96);
    out.push(k % 6 < 3 ? "koi.white" : "koi.coral", SX[k], SY[k], SA[k], r * 1.9, r * 2.28 * taper);
  }
}

function layoutJelly({ points, radius: r, angle, time: t }: LayoutInput, out: LayoutBuffer): void {
  const n = resample(points, r * 0.65, r * 0.48, angle);
  for (let k = n - 1; k >= 0; k--) {
    out.push("jelly.core", SX[k], SY[k], SA[k], r * 2.2, r * 2.2, 0.62);
  }
  for (let strand = -1; strand <= 1; strand++) {
    for (let k = n - 1; k >= 0; k--) {
      const taper = 0.35 + (1 - progress(k)) * 0.65;
      const off = strand * r * 0.68 + Math.sin(t * 2.4 - k * 0.31 + strand) * r * 0.28;
      const x = SX[k] - Math.sin(SA[k]) * off;
      const y = SY[k] + Math.cos(SA[k]) * off;
      out.push("jelly.ribbon", x, y, SA[k], r * 1.25, r * 0.55 * taper, 0.85);
      if (strand === 0 && k % 7 === 1) out.push("jelly.pearl", x, y, 0, r * 0.35, r * 0.35, 0.85);
    }
  }
}

function layoutCinema({ points, radius: r, angle }: LayoutInput, out: LayoutBuffer): void {
  const n = resample(points, r * 1.35, r * 1.16, angle);
  const frames: ArtId[] = ["film.frame0", "film.frame1", "film.frame2"];
  for (let k = n - 1; k >= 0; k--) {
    out.push(frames[k % 3], SX[k], SY[k], SA[k], r * 1.55, r * 2.1);
  }
}

function layoutKite({ points, radius: r, angle, time: t }: LayoutInput, out: LayoutBuffer): void {
  const n = resample(points, r * 1.8, r * 1.8, angle);
  if (!n) return;
  pushLink(out, "kite.string", points[0].x, points[0].y, SX[0], SY[0], r * 0.26, 1);
  for (let k = 1; k < n; k++) pushLink(out, "kite.string", SX[k - 1], SY[k - 1], SX[k], SY[k], r * 0.26, 1);
  for (let k = n - 1; k >= 0; k--) {
    const a = SA[k] + Math.sin(t * 1.8 - k * 0.55) * 0.14;
    const art = k === n - 1 ? "kite.tail" : k % 2 === 0 ? "kite.sail0" : "kite.sail1";
    out.push(art, SX[k], SY[k], a, r * 2.25, r * 2.4);
  }
}

function layoutGarden({ points, radius: r, angle, time: t, boosting }: LayoutInput, out: LayoutBuffer): void {
  let n = resample(points, r * .6, r * .55, angle);
  for (let k = n - 1; k >= 0; k--) out.push("garden.stem", SX[k], SY[k], SA[k], r * 1.35, r * 1.1);
  n = resample(points, r * 1.45, r * 1.05, angle);
  for (let k = n - 1; k >= 0; k--) {
    const tail = .55 + .45 * Math.min(1, (n - k) / 5);
    const side = k % 2 === 0 ? 1 : -1;
    const flutter = Math.sin(t * (boosting ? 5 : 2.1) - k * .7) * .13;
    const offset = side * r * .28;
    const leafAngle = SA[k] + side * (.72 + flutter);
    out.push("garden.stem", SX[k] - Math.sin(SA[k]) * offset * .5, SY[k] + Math.cos(SA[k]) * offset * .5, leafAngle, r * 1.25, r * .3);
    out.push(side === 1 ? "garden.leaf0" : "garden.leaf1", SX[k] - Math.sin(SA[k]) * offset, SY[k] + Math.cos(SA[k]) * offset, leafAngle, r * 2.1 * tail, r * 1.4 * tail);
    if (k % 6 === 3) {
      const off = r * .65 * side;
      out.push("garden.flower", SX[k] - Math.sin(SA[k]) * off, SY[k] + Math.cos(SA[k]) * off, t * .15 + k, r * 1.15, r * 1.15);
    }
  }
  if (n) out.push("garden.bud", SX[n - 1], SY[n - 1], SA[n - 1] + Math.PI, r * 1.4, r * 1.05);
}

function layoutZipper({ points, radius: r, angle, time: t, boosting }: LayoutInput, out: LayoutBuffer): void {
  let n = resample(points, r * .55, r * .35, angle);
  for (let k = n - 1; k >= 0; k--) out.push("zip.fabric", SX[k], SY[k], SA[k], r * .85, r * 2.15);
  n = resample(points, r * .55, r * .62, angle);
  for (let k = n - 1; k >= 0; k--) out.push("zip.teeth", SX[k], SY[k], SA[k], r * 1.03, r * 1.05);
  if (n > 2) out.push("zip.pull", SX[2], SY[2], SA[2] + Math.sin(t * (boosting ? 9 : 3)) * .11, r * 2.8, r * 1.55);
}

function layoutClockwork({ points, radius: r, angle, time: t, motionTime }: LayoutInput, out: LayoutBuffer): void {
  const n = resample(points, r * 1.85, r * 1.9, angle);
  if (!n) return;
  pushLink(out, "clock.link", points[0].x, points[0].y, SX[0], SY[0], r * .65, 1);
  for (let k = n - 1; k > 0; k--) pushLink(out, "clock.link", SX[k - 1], SY[k - 1], SX[k], SY[k], r * .65, 1);
  for (let k = n - 1; k >= 0; k--) {
    const sign = k % 2 === 0 ? 1 : -1;
    const spin = (motionTime ?? t) * 1.3 * sign;
    const size = r * (k === n - 1 ? 1.8 : 2.45);
    out.push(sign === 1 ? "clock.gear0" : "clock.gear1", SX[k], SY[k], SA[k] + spin, size, size);
    out.push("clock.hub", SX[k], SY[k], SA[k], r * .62, r * .62);
  }
}

function layoutOrbital({ points, radius: r, angle, time: t, motionTime }: LayoutInput, out: LayoutBuffer): void {
  let n = resample(points, r * .7, r * .7, angle);
  for (let k = n - 1; k >= 0; k--) out.push("orbit.band", SX[k], SY[k], SA[k], r * 1.5, r * 2.05, .9);
  n = resample(points, r * 2.1, r * 2.3, angle);
  const phase = (motionTime ?? t) * 1.8;
  // Satellites pass behind and in front of the rings, without moving the hitbox.
  for (let pass = 0; pass < 3; pass++) {
    for (let k = n - 1; k >= 0; k--) {
      const p = phase - k * .85;
      const depth = Math.cos(p);
      const a = SA[k] + Math.sin(t * .6 + k) * .12;
      if (pass === 1) {
        out.push("orbit.ring", SX[k], SY[k], a, r * 2.6, r * 2.15);
        out.push("orbit.star", SX[k], SY[k], t * .3, r * .48, r * .48, .85);
      } else if ((pass === 0 && depth < 0) || (pass === 2 && depth >= 0)) {
        const offX = Math.cos(p) * r * .85;
        const offY = Math.sin(p) * r * .83;
        const size = r * (.72 + depth * .18);
        out.push("orbit.satellite", SX[k] + Math.cos(a) * offX - Math.sin(a) * offY, SY[k] + Math.sin(a) * offX + Math.cos(a) * offY, a + p, size, size * .86, depth < 0 ? .75 : 1);
      }
    }
  }
}

const LAYOUTS: Record<SkinForm, (input: LayoutInput, out: LayoutBuffer) => void> = {
  botanical: layoutGarden,
  zipper: layoutZipper,
  clockwork: layoutClockwork,
  orbital: layoutOrbital,
  koi: layoutKoi,
  jellyfish: layoutJelly,
  cinema: layoutCinema,
  kite: layoutKite,
  classic: layoutClassic,
  train: layoutTrain,
  pencil: layoutPencil,
  starchart: layoutStarchart,
  lantern: layoutLantern,
  pixel: layoutPixel,
  helix: layoutHelix,
  paperchain: layoutPaperchain,
  comet: layoutComet,
};

/** Fill `out` with body placements (head excluded) for the given form. */
export function layoutSnake(form: SkinForm, input: LayoutInput, out: LayoutBuffer): number {
  out.reset();
  if (input.points.length < 2 || !(input.radius > 0)) return 0;
  (LAYOUTS[form] ?? layoutClassic)(input, out);
  return out.count;
}
