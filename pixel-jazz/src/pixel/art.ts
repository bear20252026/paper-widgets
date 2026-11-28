/* ==================================================================
   Procedural pixel art: all sprites are painted into a pixel buffer
   at runtime (no external assets) and packed into texture atlases.
   Atlas layout: 16 frames per animal = 4 beat poses x 4 mouth shapes
===================================================================*/

export const CELL = 64;
export const POSES = 4;
export const MOUTHS = 4;
export const ATLAS_FRAMES = POSES * MOUTHS;

const hex = (h: string): [number, number, number] => {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const pack = (r: number, g: number, b: number, a = 255) => (((a << 24) | (b << 16) | (g << 8) | r) >>> 0);

export class Pix {
  img: ImageData;
  d: Uint32Array;
  constructor(public w: number, public h: number) {
    this.img = new ImageData(w, h);
    this.d = new Uint32Array(this.img.data.buffer);
  }
  set(x: number, y: number, col: number | string) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = typeof col === 'number' ? col : pack(...hex(col), 255);
  }
  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[y * this.w + x];
  }
  /** alpha-blended pixel (used for glow / soft shadow) */
  blend(x: number, y: number, col: string, a: number) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    const d = this.d[i];
    const [cr, cg, cb] = hex(col);
    if (a >= 1) {
      this.d[i] = pack(cr, cg, cb, 255);
      return;
    }
    const r = (d & 255) * (1 - a) + cr * a;
    const g = ((d >>> 8) & 255) * (1 - a) + cg * a;
    const b = ((d >>> 16) & 255) * (1 - a) + cb * a;
    this.d[i] = pack(r, g, b, Math.max(d >>> 24, (a * 255) | 0) | 0);
  }
  fill(x: number, y: number, w: number, h: number, col: string | number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col);
  }
  oval(cx: number, cy: number, rx: number, ry: number, col: string | number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx,
          dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.02) this.set(x, y, col);
      }
  }
  ring(cx: number, cy: number, rx: number, ry: number, col: string | number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx,
          dy = (y - cy) / ry;
        const v = dx * dx + dy * dy;
        if (v <= 1.05 && v >= 0.55) this.set(x, y, col);
      }
  }
  line(x0: number, y0: number, x1: number, y1: number, col: string | number, w = 1) {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0),
      dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1,
      sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (let i = 0; i < 4096; i++) {
      this.set(x0, y0, col);
      if (w > 1) for (let k = 1; k < w; k++) this.set(x0 + k, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  /** multiply existing opaque pixels by a colour (baked shading) */
  shade(fn: (x: number, y: number) => number) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const d = this.d[i];
        if ((d >>> 24) === 0) continue;
        const f = fn(x, y);
        if (f === 1) continue;
        const r = Math.min(255, (d & 255) * f) | 0;
        const g = Math.min(255, ((d >>> 8) & 255) * f) | 0;
        const b = Math.min(255, ((d >>> 16) & 255) * f) | 0;
        this.d[i] = pack(r, g, b, 255);
      }
  }
  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    c.getContext('2d')!.putImageData(this.img, 0, 0);
    return c;
  }
}

/* --------------------------- palettes --------------------------- */
export type Kind = 'deer' | 'cat' | 'bear' | 'raccoon' | 'tiger' | 'owl';

type Spec = {
  fur: string;
  dark: string;
  light: string;
  suit: string;
  suitDark: string;
  suitLight: string;
  shirt: string;
  tie: string;
  wood?: string;
};

const SPEC: Record<Kind, Spec> = {
  deer: { fur: '#cf9f6d', dark: '#87582f', light: '#f0d3a8', suit: '#33406b', suitDark: '#1e2745', suitLight: '#4f5f8c', shirt: '#f6ebd4', tie: '#c94f3f', wood: '#7c3a27' },
  cat: { fur: '#e9a75c', dark: '#a3682b', light: '#f9ddb0', suit: '#3f5b45', suitDark: '#28392c', suitLight: '#5f7f63', shirt: '#f7efdb', tie: '#b5493a' },
  bear: { fur: '#aa754f', dark: '#6b4227', light: '#d6aa82', suit: '#415a50', suitDark: '#293c35', suitLight: '#607c70', shirt: '#f2e8cf', tie: '#c1962f' },
  raccoon: { fur: '#a3a1a9', dark: '#4c4952', light: '#d8d5dc', suit: '#5b3a2b', suitDark: '#39221a', suitLight: '#7d5641', shirt: '#f3e8d0', tie: '#3f6f6a' },
  tiger: { fur: '#ee9a41', dark: '#33261a', light: '#f8daa9', suit: '#eaddc6', suitDark: '#b9a887', suitLight: '#f9f1df', shirt: '#7b3f2d', tie: '#8a4a2a' },
  owl: { fur: '#b3926c', dark: '#5f4a34', light: '#e7d5b4', suit: '#2c2630', suitDark: '#191419', suitLight: '#463f4c', shirt: '#f7ecd4', tie: '#c8402f' },
};

/* --------------------------- character rig --------------------------- */
type Pose = { bob: number; sway: number; arm: number; alt: number; mouth: number; head: number };

function poseFor(b: number, m: number): Pose {
  const bob = [0, -1, 0, 1][b];
  return {
    bob,
    sway: [0, 1, 0, -1][b],
    arm: [0, -2, 0, 2][b],
    alt: b % 2,
    mouth: m,
    head: [0, -1, 0, 1][b],
  };
}

function legs(p: Pix, s: Spec, P: Pose) {
  const y = 48 + P.bob;
  p.fill(25 - P.alt, y, 5, 9 - P.bob, s.dark);
  p.fill(35 + P.alt, y, 5, 9 + P.bob, s.dark);
  p.fill(22 - P.alt, 55, 10, 4, '#1d1718'); // shoes
  p.fill(34 + P.alt, 55, 10, 4, '#1d1718');
  p.fill(22 - P.alt, 55, 10, 1, '#463a33');
  p.fill(34 + P.alt, 55, 10, 1, '#463a33');
  p.set(25 - P.alt, 57, '#6a5a4c');
  p.set(37 + P.alt, 57, '#6a5a4c');
}

function torso(p: Pix, s: Spec, P: Pose) {
  const y = 30 + P.bob;
  const x = 22 + P.sway;
  p.fill(x, y, 20, 19, s.suit);
  p.fill(x, y, 20, 1, s.suitLight);
  p.fill(x, y + 18, 20, 1, s.suitDark);
  p.fill(x + 1, y, 1, 19, s.suitLight);
  p.fill(x + 18, y, 1, 19, s.suitDark);
  // shirt V + tie
  p.fill(x + 7, y + 1, 6, 12, s.shirt);
  p.line(x + 7, y + 1, x + 10, y + 6, s.shirt);
  p.line(x + 12, y + 1, x + 10, y + 6, s.shirt);
  p.fill(x + 9, y + 4, 3, 9, s.tie);
  p.fill(x + 9, y + 4, 3, 1, '#ffffff44');
  p.set(x + 10, y + 13, s.tie);
  // lapels + pocket square + buttons
  p.line(x + 6, y + 1, x + 8, y + 6, s.suitDark);
  p.line(x + 13, y + 1, x + 11, y + 6, s.suitDark);
  p.set(x + 5, y + 8, s.suitDark);
  p.set(x + 15, y + 8, s.suitDark);
  p.set(x + 5, y + 12, s.suitDark);
  p.set(x + 15, y + 12, s.suitDark);
  p.set(x + 5, y + 4, s.tie);
  p.set(x + 6, y + 4, '#f6ecd4');
}

function armL(p: Pix, s: Spec, P: Pose, hx: number, hy: number) {
  const sx = 22 + P.sway,
    sy = 32 + P.bob;
  p.line(sx + 1, sy, hx, hy, s.suit, 3);
  p.line(sx + 1, sy, hx, hy, s.suitLight, 1);
  p.fill(hx - 2, hy - 1, 4, 4, s.light);
  p.set(hx - 1, hy, '#ffffff55');
}
function armR(p: Pix, s: Spec, P: Pose, hx: number, hy: number) {
  const sx = 41 + P.sway,
    sy = 32 + P.bob;
  p.line(sx - 1, sy, hx, hy, s.suit, 3);
  p.line(sx - 1, sy, hx, hy, s.suitDark, 1);
  p.fill(hx - 2, hy - 1, 4, 4, s.light);
}

function headBase(p: Pix, s: Spec, P: Pose, rx = 11, ry = 10) {
  const cx = 32 + P.sway + P.head * 0,
    cy = 20 + P.bob + P.head;
  p.oval(cx, cy, rx, ry, s.fur);
  p.oval(cx - 1, cy - 1, rx - 2, ry - 2, s.light);
  p.oval(cx, cy, rx - 1, ry - 1, s.fur);
  // soft cheek light + blush for the cute factor
  p.fill(cx - rx + 2, cy + 4, 4, 2, s.light);
  p.fill(cx + rx - 5, cy + 4, 4, 2, s.light);
  p.blend(cx - 7, cy + 4, '#e0705f', 0.32);
  p.blend(cx + 7, cy + 4, '#e0705f', 0.32);
  return { cx, cy };
}
function eyes(p: Pix, cx: number, cy: number, s: Spec, blink = false, glowEye = false) {
  const col = blink ? s.dark : '#181419';
  for (const dx of [-4, 4]) {
    if (blink) {
      p.fill(cx + dx - 2, cy + 1, 4, 1, col);
      p.set(cx + dx - 1, cy + 2, s.dark);
    } else {
      p.fill(cx + dx - 2, cy - 2, 4, 4, col);
      p.fill(cx + dx - 2, cy + 1, 4, 1, '#2e2733');
      p.set(cx + dx - 1, cy - 1, glowEye ? '#ffe08a' : '#ffffff');
      p.set(cx + dx, cy, glowEye ? '#ffcf5e' : '#d8e6f2');
    }
    // brow
    p.fill(cx + dx - 2, cy - 4, 4, 1, s.dark);
  }
  // lash flick
  p.set(cx - 6, cy - 2, s.dark);
  p.set(cx + 6, cy - 2, s.dark);
}
/** mouth: 0 closed, 1 small, 2 mid, 3 wide open (singing) */
function mouth(p: Pix, cx: number, cy: number, m: number, s: Spec, isBird = false) {
  if (isBird) {
    const g = [0, 1, 2, 3][m];
    p.oval(cx, cy + 3, 3, 2, '#e8a83c');
    p.fill(cx - 3, cy + 2, 7, 1, '#f7c96a');
    if (g > 0) {
      p.fill(cx - 2, cy + 3, 5, g, '#2a1405');
      p.fill(cx - 1, cy + 3, 3, 1, '#f7c96a');
    }
    return;
  }
  if (m === 0) {
    p.fill(cx - 2, cy + 5, 5, 1, '#3a2118');
    p.set(cx - 3, cy + 4, s.dark);
    p.set(cx + 2, cy + 4, s.dark);
  } else {
    const h = m + 1;
    p.oval(cx, cy + 5, 2 + m * 0.4, h * 0.6 + 0.6, '#40201a');
    p.fill(cx - 2, cy + 5 - 1, 4, 1, '#f4efe4'); // teeth
    p.fill(cx - 1, cy + 5 + 1, 3, 1, '#c2545a'); // tongue
  }
}
function muzzle(p: Pix, cx: number, cy: number, s: Spec, w = 7, h = 5) {
  p.oval(cx, cy + 3, w, h, s.light);
  p.fill(cx - 1, cy + 1, 3, 2, '#2b1c18');
  p.set(cx, cy + 1, '#5a4038');
}

/* --------------------------- instruments --------------------------- */
function instrBass(p: Pix, s: Spec, P: Pose) {
  const wood = s.wood!, dk = '#3f1710', hi = '#a3593c';
  const by = 36 + P.bob * 0.4;
  // body (two bouts)
  p.oval(15, by + 13, 10, 12, dk);
  p.oval(15, by + 12, 8.4, 10.6, wood);
  p.oval(15, by + 4, 7.2, 7.5, wood);
  p.oval(15, by + 12, 6, 8.5, '#8e4830');
  p.oval(15, by + 4, 5.4, 5.8, hi);
  // f holes
  p.line(10, by + 6, 10, by + 12, '#2c100a');
  p.line(20, by + 6, 20, by + 12, '#2c100a');
  p.set(10, by + 5, '#2c100a');
  p.set(20, by + 5, '#2c100a');
  // neck + scroll + strings
  p.line(19, by + 1, 33, by - 22, dk, 3);
  p.line(19, by + 1, 33, by - 22, '#c9b48a', 1);
  p.oval(34, by - 23, 2.4, 2, dk);
  p.set(34, by - 23, '#e2cda3');
  for (let i = 0; i < 3; i++) p.line(17 + i, by + 6, 21 + i, by - 4, '#e9dcc0');
  // bridge, tailpiece and endpin
  p.fill(11, by + 14, 8, 2, '#e3cfa4');
  p.fill(13, by + 17, 4, 6, '#2c100a');
  p.line(15, by + 23, 15, 58, '#6f6b78');
  p.set(15, 58, '#c9c2d2');
  armPositions(p, s, P, 27 + P.alt, by - 14, 22 + P.arm, by + 4);
}
function instrDrums(p: Pix, s: Spec, P: Pose) {
  const brass = '#e0b465', cream = '#f5ecd8', shell = '#a9482f';
  // bass drum, front and centre like the reference
  p.oval(31, 49, 11, 10, '#5c2317');
  p.oval(31, 49, 9, 8, brass);
  p.oval(31, 49, 7, 6, cream);
  p.oval(31, 49, 5, 4, '#e8d6b2');
  p.oval(31, 49, 2, 2, shell);
  for (let i = -2; i <= 2; i++) p.set(31 + i, 49, '#8b6c3c');
  // snare on a stand (left)
  p.fill(8, 43, 13, 4, brass);
  p.fill(8, 42, 13, 2, '#f7efe0');
  p.fill(8, 47, 13, 1, '#7a5a26');
  p.line(10, 48, 9, 55, '#7d7a84');
  p.line(19, 48, 20, 55, '#7d7a84');
  // floor tom (right)
  p.fill(48, 42, 10, 7, shell);
  p.fill(48, 41, 10, 2, '#f7efe0');
  p.fill(48, 44, 10, 1, brass);
  p.line(50, 49, 49, 55, '#7d7a84');
  p.line(56, 49, 57, 55, '#7d7a84');
  // hi-hat (left) + ride (right)
  p.line(3, 30, 3, 54, '#6f6b78');
  p.oval(4, 32 + P.arm, 6, 2, brass);
  p.oval(4, 35 + P.arm, 6, 2, '#b98a3c');
  const splash = P.alt === 1 ? 1 : 0;
  p.line(58, 25, 58, 52, '#6f6b78');
  p.oval(57, 24 - splash, 8, 2 + splash, brass);
  p.oval(57, 24 - splash, 5, 1, '#f7dd94');
  p.line(58, 24 - splash, 63, 22 - splash, '#f1d18a');
  // sticks
  const upL = P.alt === 0 ? -4 : 1, upR = P.alt === 0 ? 1 : -5;
  p.line(25, 38 + P.bob, 14, 42 + upL, '#efd5a1', 2);
  p.line(37, 38 + P.bob, 49, 41 + upR, '#efd5a1', 2);
  p.set(14, 41 + upL, '#fff4cf');
  p.set(49, 40 + upR, '#fff4cf');
  armPositions(p, s, P, 22, 39 + upL * 0.35, 41, 39 + upR * 0.35);
}
function instrFlute(p: Pix, s: Spec, P: Pose) {
  const y = 25 + P.bob + P.head;
  p.fill(38, y, 20, 2, '#d9d9e0');
  p.fill(38, y, 20, 1, '#f7f7ff');
  p.fill(38, y + 2, 20, 1, '#8f8f9c');
  for (let i = 0; i < 6; i++) p.set(41 + i * 3 + P.alt, y + 1, '#9fd6e8');
  p.fill(57, y - 1, 3, 4, '#b8b8c6');
  p.set(37, y + 1, '#2b2b33');
  armPositions(p, s, P, 36 + P.alt * 2, y + 5 - P.arm, 47 - P.alt * 2, y + 4 + P.arm);
}
function instrGuitar(p: Pix, s: Spec, P: Pose) {
  const dk = '#4a2a10';
  const gy = 43 + P.bob * 0.4;
  p.oval(22, gy, 10, 8, '#8c4a1e');
  p.oval(22, gy, 8, 6.2, '#c8862f');
  p.oval(22, gy, 5, 4, '#e0a94a');
  p.oval(18, gy - 1, 1.6, 3.4, dk);
  p.line(25, gy - 1, 25, gy + 2, '#6d4a1c');
  p.fill(14, gy + 4, 16, 1, '#6d3f14');
  // bridge + pickup
  p.fill(19, gy + 1, 6, 1, dk);
  p.fill(24, gy - 2, 3, 2, '#f0e3bf');
  // neck + headstock, angled up to the right
  p.line(28, gy - 4, 48, gy - 20, dk, 3);
  p.line(28, gy - 4, 48, gy - 20, '#a9753c', 1);
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    p.set(Math.round(28 + 20 * t), Math.round(gy - 4 - 16 * t), '#efe4c0');
  }
  p.fill(47, gy - 24, 6, 5, '#2e1a0c');
  p.set(50, gy - 23, '#eddcae');
  // strings + strumming paw
  for (let i = 0; i < 3; i++) p.line(25 + i, gy - 1, 46 + i, gy - 20, '#f4ead0');
  const strum = P.alt === 0 ? 2 : -2;
  armPositions(p, s, P, 45 - P.alt, gy - 19, 27 + P.arm, gy - 1 + strum);
}
function instrSynth(p: Pix, s: Spec, P: Pose) {
  const y = 38 + P.bob;
  // wooden end cheeks + dark panel
  p.fill(12, y - 1, 40, 11, '#5a3a26');
  p.fill(13, y, 38, 9, '#241c2b');
  p.fill(12, y + 9, 40, 2, '#3c2718');
  p.fill(13, y, 38, 1, '#7b5a3e');
  // keys
  for (let i = 0; i < 17; i++) {
    p.fill(15 + i * 2, y + 3, 2, 5, i % 2 ? '#ded6e6' : '#f8f4ff');
    if ([1, 2, 4, 5, 6].includes(i % 7)) p.fill(16 + i * 2, y + 3, 1, 3, '#262030');
  }
  // knobs, LED strip and screen
  const leds = ['#f0be62', '#e0654a', '#62c9c0', '#f0be62', '#9be07a', '#e0654a'];
  for (let i = 0; i < 6; i++) p.fill(16 + i * 3, y + 1, 1, 1, leds[i]);
  p.fill(41, y - 5, 9, 5, '#0d1a1a');
  for (let i = 0; i < 8; i++) {
    const h = ((i * 3 + P.alt * 2 + P.arm * 2) % 4) + 1;
    p.fill(42 + i, y - 1 - h, 1, h, '#8bf0cf');
  }
  // music stand
  p.line(58, y + 2, 58, y - 6, '#7d7a84');
  p.fill(52, y - 9, 13, 4, '#e8dcc2');
  p.fill(53, y - 8, 3, 1, '#9a8f80');
  p.fill(57, y - 8, 3, 1, '#9a8f80');
  // paws
  armPositions(p, s, P, 22 + P.alt * 6 + P.arm, y + 2, 40 - P.alt * 5 - P.arm, y + 2);
}
function instrMic(p: Pix, s: Spec, P: Pose) {
  const x = 32 + P.sway;
  p.fill(x - 1, 34, 2, 24, '#4d4950');
  p.fill(x - 5, 57, 11, 2, '#332f36');
  p.oval(x, 32, 3.5, 4, '#5c5761');
  p.oval(x, 31, 2.5, 3, '#a9a2a8');
  p.oval(x, 30, 1.4, 1.8, '#e8e2d6');
  for (let i = -1; i <= 1; i++) for (let j = 0; j < 2; j++) p.set(x + i, 29 + j + Math.abs(i), '#3a353c');
  p.set(x, 35, '#cfc8d8');
  // music stand for the lead
  p.line(11, 40, 11, 54, '#7d7a84');
  p.fill(4, 38, 14, 5, '#e8dcc2');
  p.fill(5, 39, 4, 1, '#a2957f');
  p.fill(10, 39, 4, 1, '#a2957f');
  p.fill(5, 41, 9, 1, '#8f8272');
  // one wing snaps on the off beat
  const snap = P.alt === 1;
  p.line(41 + P.sway, 33 + P.bob, snap ? 51 : 49, snap ? 25 + P.arm : 35, s.suit, 3);
  p.fill(snap ? 50 : 48, snap ? 23 : 34, 4, 4, s.light);
  p.set(snap ? 51 : 49, snap ? 22 : 33, s.tie);
}
function armPositions(p: Pix, s: Spec, P: Pose, lx: number, ly: number, rx: number, ry: number) {
  armL(p, s, P, lx, ly);
  armR(p, s, P, rx, ry);
}

/* --------------------------- heads --------------------------- */
function drawHead(p: Pix, kind: Kind, s: Spec, P: Pose, m: number, blink: boolean) {
  const { cx, cy } = headBase(p, s, P, kind === 'owl' ? 10 : kind === 'bear' ? 11 : 10, kind === 'owl' ? 10 : 9);
  if (kind === 'deer') {
    // ears + antlers
    p.oval(cx - 10, cy - 2, 3, 5, s.dark);
    p.oval(cx + 10, cy - 2, 3, 5, s.dark);
    for (const sgn of [-1, 1]) {
      const bx = cx + sgn * 6,
        by = cy - 8;
      p.line(bx, by, bx + sgn * 3, by - 7, '#d9c6a0');
      p.line(bx + sgn * 2, by - 4, bx + sgn * 6, by - 6, '#d9c6a0');
      p.line(bx + sgn * 3, by - 7, bx + sgn * 2, by - 12, '#d9c6a0');
      p.line(bx + sgn * 3, by - 10, bx + sgn * 7, by - 12, '#d9c6a0');
    }
    muzzle(p, cx, cy + 1, s, 6, 4);
  } else if (kind === 'cat') {
    for (const sgn of [-1, 1]) {
      p.line(cx + sgn * 7, cy - 5, cx + sgn * 9, cy - 12, s.fur, 1);
      p.line(cx + sgn * 5, cy - 6, cx + sgn * 9, cy - 12, s.fur);
      p.line(cx + sgn * 7, cy - 7, cx + sgn * 8, cy - 10, s.tie);
    }
    p.fill(cx - 9, cy - 13, 19, 3, s.tie); // backwards cap
    p.fill(cx - 10, cy - 11, 4, 2, s.tie);
    for (const dx of [-7, 7]) p.fill(cx + dx, cy + 3, 4, 1, '#efe6da'); // whiskers
    muzzle(p, cx, cy + 1, s, 5, 3);
  } else if (kind === 'bear') {
    for (const sgn of [-1, 1]) {
      p.oval(cx + sgn * 8, cy - 7, 4, 4, s.dark);
      p.oval(cx + sgn * 8, cy - 7, 2, 2, s.light);
    }
    muzzle(p, cx, cy + 1, s, 7, 5);
    p.set(cx, cy + 1, '#181418');
  } else if (kind === 'raccoon') {
    for (const sgn of [-1, 1]) {
      p.oval(cx + sgn * 8, cy - 7, 4, 3, s.dark);
      p.oval(cx + sgn * 8, cy - 7, 2, 1, s.light);
    }
    p.fill(cx - 9, cy - 2, 18, 4, '#26242c'); // mask
    p.oval(cx - 4, cy - 1, 3, 3, '#f4efe2');
    p.oval(cx + 4, cy - 1, 3, 3, '#f4efe2');
    muzzle(p, cx, cy + 2, s, 5, 3);
  } else if (kind === 'tiger') {
    for (const sgn of [-1, 1]) {
      p.oval(cx + sgn * 8, cy - 7, 4, 4, s.fur);
      p.oval(cx + sgn * 8, cy - 7, 2, 2, s.light);
    }
    p.fill(cx - 8, cy - 6, 3, 2, s.dark); // stripes
    p.fill(cx + 6, cy - 6, 3, 2, s.dark);
    p.fill(cx - 2, cy - 8, 2, 2, s.dark);
    p.fill(cx - 10, cy + 1, 2, 3, s.dark);
    p.fill(cx + 9, cy + 1, 2, 3, s.dark);
    muzzle(p, cx, cy + 1, s, 6, 4);
    p.fill(cx - 1, cy + 9, 3, 2, s.dark);
  } else if (kind === 'owl') {
    // facial disc + tufts
    p.oval(cx - 4, cy + 1, 5, 6, s.light);
    p.oval(cx + 4, cy + 1, 5, 6, s.light);
    for (const sgn of [-1, 1]) {
      p.line(cx + sgn * 7, cy - 6, cx + sgn * 9, cy - 12, s.fur, 2);
    }
    eyes(p, cx, cy, s, blink, true);
    p.ring(cx - 4, cy, 4, 4, '#f7e6b0');
    p.ring(cx + 4, cy, 4, 4, '#f7e6b0');
    mouth(p, cx, cy, m, s, true);
    // top hat
    p.fill(cx - 9, cy - 11, 18, 2, '#1d1a26');
    p.fill(cx - 5, cy - 19, 10, 8, '#26222f');
    p.fill(cx - 5, cy - 12, 10, 2, '#b8432f');
    p.fill(cx - 5, cy - 19, 10, 1, '#3a3446');
    return;
  }
  eyes(p, cx, cy, s, blink);
  mouth(p, cx, cy, m, s);
  // tail for raccoon / deer
  if (kind === 'raccoon') {
    for (let i = 0; i < 6; i++) p.oval(13 - i * 0.4, 46 + i, 3, 2, i % 2 ? '#2c2a33' : s.light);
  }
  if (kind === 'deer') p.oval(44, 42, 2, 2, '#f5ecd6');
}

/** Build the 16-frame atlas for one band member. */
export function makeBandAtlas(kind: Kind): HTMLCanvasElement {
  const s = SPEC[kind];
  const px = new Pix(CELL * ATLAS_FRAMES, CELL);
  for (let b = 0; b < POSES; b++) {
    for (let m = 0; m < MOUTHS; m++) {
      const cell = new Pix(CELL, CELL);
      const P = poseFor(b, m);
      const blink = kind === 'cat' && b === 3;
      legs(cell, s, P);
      torso(cell, s, P);
      if (kind === 'deer') instrBass(cell, s, P);
      else if (kind === 'cat') instrDrums(cell, s, P);
      else if (kind === 'bear') instrFlute(cell, s, P);
      else if (kind === 'raccoon') instrGuitar(cell, s, P);
      else if (kind === 'tiger') instrSynth(cell, s, P);
      else instrMic(cell, s, P);
      drawHead(cell, kind, s, P, m, blink);
      // baked top-light: brighter at the head, darker near the floor
      cell.shade((_x, y) => 0.78 + Math.max(0, 0.34 - y * 0.004));
      const ox = (b * MOUTHS + m) * CELL;
      for (let y = 0; y < CELL; y++)
        for (let x = 0; x < CELL; x++) {
          const v = cell.get(x, y);
          if ((v >>> 24) !== 0) px.set(ox + x, y, v);
        }
    }
  }
  return px.canvas();
}

/* --------------------------- stage props --------------------------- */
const rng = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

export function makeFloorCanvas(): HTMLCanvasElement {
  const W = 128,
    H = 128,
    px = new Pix(W, H),
    r = rng(7);
  px.fill(0, 0, W, H, '#39291d');
  for (let row = 0; row < 8; row++) {
    const off = (row % 2) * 16;
    for (let i = -1; i < 5; i++) {
      const x = i * 32 + off,
        y = row * 16;
      const tone = 42 + Math.floor(r() * 8);
      px.fill(x + 1, y + 1, 30, 14, pack(tone + 19, tone + 2, tone - 14));
      // Opaque, low-contrast grain prevents bright transparent texels from blooming.
      for (let g = 0; g < 3; g++) {
        const gy = y + 3 + Math.floor(r() * 10);
        px.line(x + 4, gy, x + 16 + Math.floor(r() * 10), gy, pack(tone + 22, tone + 5, tone - 11));
      }
      px.fill(x, y, 32, 1, '#27190f');
      px.fill(x, y, 1, 16, '#27190f');
    }
  }
  return px.canvas();
}

export function makeWallCanvas(): HTMLCanvasElement {
  const W = 128,
    H = 128,
    px = new Pix(W, H),
    r = rng(19);
  // Soft plaster with a faint damask dot — quiet enough to sit behind the band.
  px.fill(0, 0, W, H, '#5a4232');
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const n = r();
      if (n < 0.06) px.set(x, y, '#5e4635');
      else if (n > 0.985) px.set(x, y, '#55402f');
    }
  for (let y = 8; y < H; y += 32)
    for (let x = 8; x < W; x += 32) {
      const ox = ((y / 32) % 2) * 16;
      px.set(x + ox, y, '#6a5040');
      px.set(x + ox + 1, y, '#6a5040');
      px.set(x + ox, y + 1, '#6a5040');
      px.set(x + ox + 1, y + 1, '#6a5040');
    }
  // dado rail
  px.fill(0, H - 22, W, 2, '#3f2d22');
  px.fill(0, H - 20, W, 1, '#7a5e45');
  return px.canvas();
}

export function makeCurtainCanvas(): HTMLCanvasElement {
  const W = 96, H = 192, px = new Pix(W, H);
  for (let x = 0; x < W; x++) {
    const u = x / W;
    const fold = Math.sin(u * Math.PI * 9) * 0.5 + 0.5;
    const edge = Math.min(1, Math.min(x, W - x) / 10);
    const body = 0.55 + 0.45 * fold;
    const r = (72 + 92 * body) * (0.55 + 0.45 * edge);
    const g = (10 + 22 * body) * (0.5 + 0.4 * edge);
    const b = (22 + 30 * body) * (0.55 + 0.45 * edge);
    for (let y = 0; y < H; y++) {
      const top = y < 12 ? 0.55 + y / 24 : 1;
      const bottom = y > H - 26 ? 0.72 + (H - y) / 90 : 1;
      const sheen = y > H * 0.32 && y < H * 0.36 ? 1.18 : 1;
      px.set(x, y, pack(Math.min(255, r * top * bottom * sheen), g * top * bottom, b * top * bottom * sheen));
      if (x % 23 === 4 && y % 5 === 0) px.set(x, y, pack(38, 8, 14));
    }
  }
  // gold fringe at the hem
  for (let x = 0; x < W; x++) {
    px.set(x, H - 3, pack(150, 112, 52));
    px.set(x, H - 2, pack(205, 164, 88));
    if (x % 4 === 0) { px.set(x, H - 1, pack(224, 184, 104)); px.set(x, H - 4, pack(120, 88, 40)); }
  }
  return px.canvas();
}

/** glowing arched alcove on the back wall */
export function makeArchCanvas(): HTMLCanvasElement {
  const W = 128, H = 256, px = new Pix(W, H);
  const cx = W / 2, topY = 44, r = 52;
  const inside = (x: number, y: number) => {
    if (y > topY + 170) return false;
    if (y <= topY) return Math.hypot(x - cx, y - topY) <= r;
    return Math.abs(x - cx) <= r;
  };
  const border = (x: number, y: number) => {
    if (y > topY + 170) return false;
    if (y <= topY) { const d = Math.hypot(x - cx, y - topY); return d <= r + 5 && d > r - 1; }
    return Math.abs(x - cx) <= r + 5 && Math.abs(x - cx) > r - 1;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      const vy = (y - 10) / (H - 10);
      const glow = Math.pow(Math.max(0, 1 - Math.abs((x - cx) / r)), 1.2) * (1 - vy * 0.55);
      if (y > topY + 132) {
        // planted ledge / terracotta pot silhouette
        const d = Math.hypot(x - cx, y - (topY + 150));
        if (d < 20 + Math.sin(x * 0.4) * 3) px.set(x, y, pack(70 + glow * 30, 40 + glow * 16, 26, 255));
        continue;
      }
      const base = 0.35 + 0.6 * Math.pow(vy, 0.7);
      const r0 = (188 + 52 * glow) * base;
      const g0 = (140 + 58 * glow) * base;
      const b0 = (88 + 44 * glow) * base;
      const dith = ((x + y) % 3 === 0) ? 0.94 : 1;
      px.set(x, y, pack(Math.min(255, r0 * dith), Math.min(255, g0 * dith), Math.min(255, b0 * dith)));
      // hanging light inside the niche
      const ld = Math.hypot(x - cx, y - (topY + 22));
      if (ld < 5) px.set(x, y, pack(255, 236, 190));
      else if (ld < 11) px.set(x, y, pack(245, 205, 140));
      if (y < topY + 10 && Math.abs(x - cx) < 1) px.set(x, y, pack(60, 40, 28));
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (border(x, y)) px.set(x, y, pack(168, 126, 78));
  return px.canvas();
}

/** warm wooden stage front with a gold molding */
export function makeStageCanvas(): HTMLCanvasElement {
  const W = 128, H = 96, px = new Pix(W, H), r = rng(31);
  px.fill(0, 0, W, H, '#3a2318');
  for (let x = 0; x < W; x += 16) {
    const tone = 46 + Math.floor(r() * 18);
    px.fill(x + 1, 0, 14, H, pack(tone + 22, tone + 2, tone - 14, 255));
    for (let g = 0; g < 5; g++) {
      const gx = x + 2 + Math.floor(r() * 12);
      for (let y = 0; y < H; y += 3) px.set(gx, y, pack(tone + 34, tone + 12, tone - 6));
    }
    px.fill(x, 0, 1, H, '#1d110b');
  }
  px.fill(0, 0, W, 3, pack(118, 86, 48));
  px.fill(0, 3, W, 3, '#2f1e14');
  px.fill(0, H - 6, W, 6, '#2f1e14');
  px.fill(0, H - 6, W, 1, pack(150, 118, 74));
  return px.canvas();
}

/** gold serif marquee lettering for the back wall */
export function makeMarqueeTitle(eyebrow: string, title: string, sub: string): HTMLCanvasElement {
  const W = 768, H = 220;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  const draw = (text: string, y: number, size: number, color: string, spacing: number, glow: number) => {
    g.font = `600 ${size}px Cinzel, "Times New Roman", Georgia, serif`;
    (g as any).letterSpacing = `${spacing}px`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(255,206,126,0.75)';
    g.shadowBlur = glow;
    g.fillStyle = color;
    g.fillText(text, W / 2, y);
    g.shadowBlur = 0;
    (g as any).letterSpacing = '0px';
  };
  // eyebrow with diamond ornaments
  draw(eyebrow.toUpperCase(), 34, 17, 'rgba(238,216,174,0.9)', 8, 6);
  g.fillStyle = 'rgba(214,168,96,0.95)';
  for (const x of [W / 2 - 200, W / 2 + 200]) {
    g.save(); g.translate(x, 33); g.rotate(Math.PI / 4); g.fillRect(-3, -3, 6, 6); g.restore();
  }
  // gold gradient headline
  const grad = g.createLinearGradient(0, 78, 0, 152);
  grad.addColorStop(0, '#fbebc4');
  grad.addColorStop(0.42, '#eccd92');
  grad.addColorStop(0.72, '#c79c56');
  grad.addColorStop(1, '#9c7335');
  draw(title.toUpperCase(), 116, title.length > 13 ? 52 : 66, grad as unknown as string, 4, 16);
  // underline flourish
  g.strokeStyle = 'rgba(206,162,96,0.8)';
  g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(W / 2 - 168, 162); g.lineTo(W / 2 - 22, 162); g.stroke();
  g.beginPath(); g.moveTo(W / 2 + 22, 162); g.lineTo(W / 2 + 168, 162); g.stroke();
  g.fillStyle = 'rgba(238,206,148,0.95)';
  g.save(); g.translate(W / 2, 162); g.rotate(Math.PI / 4); g.fillRect(-4, -4, 8, 8); g.restore();
  draw(sub.toUpperCase(), 192, 16, 'rgba(232,208,164,0.85)', 7, 6);
  return c;
}

export function makeGlowCanvas(col = '#fff3c9', dither = true): HTMLCanvasElement {
  const S = 64,
    px = new Pix(S, S);
  const bay = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
      let a = Math.pow(Math.max(0, 1 - d), 2.2);
      if (dither) {
        const t = bay[((y & 3) * 4 + (x & 3))] / 16;
        a = a > t ? Math.min(1, a * 1.25) : a * 0.45;
      }
      if (a > 0.02) px.set(x, y, pack(...hex(col), Math.min(255, a * 255) | 0));
    }
  return px.canvas();
}

export function makeNoteAtlas(): HTMLCanvasElement {
  const N = 4,
    S = 32,
    px = new Pix(S * N, S);
  const ink = '#ffe9a8',
    alt = '#9ff0e0';
  // 0: quarter note
  px.oval(13, 22, 5, 4, ink);
  px.oval(12, 21, 2, 1, '#3a2c12');
  px.fill(17, 8, 2, 15, ink);
  // 1: eighth note
  px.oval(12, 23, 5, 4, alt);
  px.fill(16, 8, 2, 16, alt);
  px.fill(18, 8, 4, 2, alt);
  px.fill(21, 10, 2, 4, alt);
  // 2: beamed pair
  px.oval(8, 23, 4, 3, ink);
  px.oval(21, 21, 4, 3, ink);
  px.fill(11, 9, 2, 15, ink);
  px.fill(24, 7, 2, 15, ink);
  px.fill(11, 8, 15, 3, ink);
  // 3: flat + sharp
  px.fill(11, 8, 2, 18, alt);
  px.oval(15, 22, 4, 3, '#00000000');
  px.line(13, 22, 17, 19, alt, 2);
  px.fill(20, 12, 2, 12, ink);
  px.fill(26, 8, 2, 16, ink);
  px.fill(19, 14, 10, 2, ink);
  px.fill(19, 20, 10, 2, ink);
  px.line(22, 12, 25, 15, ink);
  return px.canvas();
}

export function makeAudienceCanvas(variant: number): HTMLCanvasElement {
  const S = 32,
    N = 4,
    px = new Pix(S * N, S);
  for (let i = 0; i < N; i++) {
    const ox = i * S;
    const cell = { set: (x: number, y: number, c: number) => px.set(ox + x, y, c) };
    const ink = pack(12, 10, 18, 255);
    const rim = pack(46, 34, 60, 255);
    void cell;
    px.oval(16, 20, 8, 8, ink);
    px.fill(8, 26, 16, 6, ink);
    for (let a = 0; a < 26; a++) {
      const ang = Math.PI * (a / 26) * 1.05 + Math.PI * 0.98;
      px.set(Math.round(16 + Math.cos(ang) * 9), Math.round(20 + Math.sin(ang) * 9), rim);
    }
    if (i === 0) {
      px.fill(7, 11, 18, 2, ink); // hat brim
      px.fill(11, 5, 10, 7, ink);
      px.fill(11, 10, 10, 1, pack(90, 40, 46, 255));
    }
    if (i === 1) {
      px.oval(16, 14, 9, 6, ink); // afro
      px.oval(16, 12, 7, 4, rim);
    }
    if (i === 2) {
      px.fill(10, 10, 12, 3, ink); // cap
      px.fill(8, 12, 6, 2, ink);
    }
    if (i === 3) {
      px.oval(16, 12, 6, 4, ink); // bun
      px.fill(13, 8, 6, 2, pack(120, 60, 70, 255));
    }
    if (variant >= 0) {
      // phone screen glow held up by some
      if (i % 2 === 0) {
        px.fill(25, 22, 3, 4, pack(200, 220, 255, 160));
      }
    }
  }
  return px.canvas();
}

export function makeSignCanvas(): HTMLCanvasElement {
  const W = 128,
    H = 64,
    px = new Pix(W, H);
  // crescent moon + note neon emblem, painted with additive glow
  const cx = 44,
    cy = 32;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d1 = Math.hypot(x - cx, y - cy);
      const d2 = Math.hypot(x - (cx + 9), y - (cy - 4));
      const inMoon = d1 < 22 && d2 > 19;
      const stem = x > 84 && x < 88 && y > 12 && y < 42;
      const head = Math.hypot((x - 80) / 6, (y - 42) / 4.4) < 1;
      const flag = x > 88 && x < 96 && y > 12 && y < 20 && (y - 12) * 1.1 > x - 88;
      if (inMoon) px.set(x, y, pack(140, 240, 255, 255));
      else if (stem || head || flag) px.set(x, y, pack(255, 210, 120, 255));
      else {
        const glow = Math.max(inMoon ? 1 : 0, stem || head || flag ? 1 : 0);
        const g = Math.exp(-Math.min(Math.abs(d1 - 22), Math.abs(d2 - 19)) / 7);
        if (glow === 0 && g > 0.05) px.set(x, y, pack(90 * g, 190 * g, 210 * g, (g * 140) | 0));
        const g2 = Math.exp(-Math.abs(x - 86) / 9 - Math.abs(y - 28) / 22);
        if (px.get(x, y) === 0 && g2 > 0.06) px.set(x, y, pack(220 * g2, 170 * g2, 90 * g2, (g2 * 120) | 0));
      }
    }
  // stars
  for (const [sx, sy] of [
    [12, 12],
    [112, 18],
    [104, 52],
    [22, 52],
  ]) {
    px.set(sx, sy, pack(255, 255, 255, 220));
    px.fill(sx - 1, sy, 3, 1, pack(200, 230, 255, 140));
    px.fill(sx, sy - 1, 1, 3, pack(200, 230, 255, 140));
  }
  return px.canvas();
}

export function makeLampCanvas(): HTMLCanvasElement {
  const S = 32,
    px = new Pix(S, S);
  px.fill(15, 0, 2, 8, '#3a3542');
  px.line(9, 8, 23, 8, '#4a4456', 2);
  px.oval(16, 12, 8, 5, '#2b2736');
  px.fill(9, 12, 14, 2, '#5a5268');
  px.oval(16, 15, 4, 3, '#ffe6a8');
  px.oval(16, 16, 3, 2, '#fff8dc');
  return px.canvas();
}

export const SPECS = SPEC;
export type { Spec };
