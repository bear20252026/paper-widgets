import { RELEASES, type Release } from './data';

export const SANS = '"Geist Variable", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const MONO = '"Geist Mono Variable", ui-monospace, "SF Mono", Menlo, monospace';

type C2 = CanvasRenderingContext2D;
type P = Release['pal'];
type Fill = string | CanvasGradient;
type Motif = (c: C2, w: number, h: number, p: P, rnd: () => number) => void;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mk(w: number, h: number): [HTMLCanvasElement, C2] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')!];
}

export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

const TAU = Math.PI * 2;
const disc = (c: C2, x: number, y: number, r: number, fill: Fill) => {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = fill;
  c.fill();
};
const ringS = (c: C2, x: number, y: number, r: number, stroke: string, lw: number) => {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.strokeStyle = stroke;
  c.lineWidth = lw;
  c.stroke();
};
const line = (c: C2, x1: number, y1: number, x2: number, y2: number) => {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
};
const poly = (c: C2, pts: number[][], fill: Fill) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
};
const rrect = (c: C2, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};
const track = (c: C2, px: number) => {
  (c as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
};

let noise: HTMLCanvasElement | null = null;
function grain(c: C2, w: number, h: number, alpha = 0.1) {
  if (!noise) {
    const [n, nc] = mk(220, 220);
    const id = nc.createImageData(220, 220);
    const r = rng(7);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 90 + r() * 110;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
    nc.putImageData(id, 0, 0);
    noise = n;
  }
  c.save();
  c.globalAlpha = alpha;
  c.globalCompositeOperation = 'overlay';
  c.fillStyle = c.createPattern(noise, 'repeat')!;
  c.fillRect(0, 0, w, h);
  c.restore();
}

/* ------------------------------------------------------------------ */
/* Sleeve artwork — one generative motif per release                    */
/* ------------------------------------------------------------------ */

const MOTIFS: Record<string, Motif> = {
  tide(c, w, h, p) {
    const hy = h * 0.5;
    const sx = w * 0.66;
    disc(c, sx, hy, 176, p.a);
    for (let i = 1; i < 5; i++) ringS(c, sx, hy, 176 - i * 35, p.bg, 9);
    c.fillStyle = p.bg;
    c.fillRect(0, hy, w, h - hy);
    c.strokeStyle = p.ink;
    c.lineWidth = 5;
    c.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const y = hy + 6 + i * 27;
      const amp = 3 + i * 2.4;
      const wl = 46 + i * 10;
      c.globalAlpha = 1 - i * 0.055;
      c.beginPath();
      for (let x = -10; x <= w + 10; x += 8) {
        const yy = y + Math.sin(x / wl + i * 1.9) * amp;
        if (x < 0) c.moveTo(x, yy);
        else c.lineTo(x, yy);
      }
      c.stroke();
    }
    c.globalAlpha = 1;
    const mx = w * 0.24;
    const my = h * 0.14;
    c.strokeStyle = p.b;
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(mx, hy);
    c.lineTo(mx, my);
    c.moveTo(mx - 48, hy);
    c.lineTo(mx, h * 0.25);
    c.lineTo(mx + 48, hy);
    c.stroke();
    for (let k = 1; k <= 3; k++) {
      c.beginPath();
      c.arc(mx, my, k * 40, -0.95, -0.12);
      c.stroke();
      c.beginPath();
      c.arc(mx, my, k * 40, Math.PI + 0.12, Math.PI + 0.95);
      c.stroke();
    }
    disc(c, mx, my, 12, p.a);
  },

  satellites(c, w, h, p, rnd) {
    for (let i = 0; i < 90; i++) disc(c, rnd() * w, rnd() * h, 1 + rnd() * 2.4, rgba(p.c, 0.25 + rnd() * 0.6));
    c.save();
    c.translate(w / 2, h * 0.52);
    c.rotate(-0.32);
    c.strokeStyle = rgba(p.c, 0.75);
    c.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.ellipse(0, 0, 170 + i * 92, 58 + i * 36, 0, 0, TAU);
      c.stroke();
    }
    disc(c, 0, 0, 80, p.a);
    c.save();
    c.beginPath();
    c.arc(0, 0, 80, 0, TAU);
    c.clip();
    disc(c, 34, 30, 80, rgba(p.bg, 0.3));
    c.restore();
    const sats = [
      [0, 0.5],
      [1, 2.6],
      [2, 4.4],
      [3, 1.2],
      [3, 3.5],
      [1, 5.6],
    ];
    for (const [i, t] of sats) {
      const s = 26 + i * 3;
      c.save();
      c.translate(Math.cos(t) * (170 + i * 92), Math.sin(t) * (58 + i * 36));
      c.rotate(t * 1.3);
      poly(c, [[-s, 0], [0, -s * 0.72], [s, 0]], p.c);
      poly(c, [[-s, 0], [0, s * 0.46], [s, 0]], p.b);
      c.restore();
    }
    c.restore();
  },

  arithmetic(c, w, h, p) {
    const glyphs = ['+', '−', '×', '÷', '='];
    const grid = (col: string) => {
      c.fillStyle = col;
      c.font = `600 68px ${SANS}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (let j = 0; j < 7; j++)
        for (let i = 0; i < 11; i++) c.fillText(glyphs[(i * 3 + j * 2) % 5], 50 + i * 90, 50 + j * 92);
    };
    grid(rgba(p.b, 0.92));
    const cx = w / 2;
    const cy = h / 2;
    disc(c, cx, cy, 218, p.a);
    c.save();
    c.beginPath();
    c.arc(cx, cy, 218, 0, TAU);
    c.clip();
    grid(p.c);
    c.restore();
    ringS(c, cx, cy, 244, p.b, 3);
  },

  glasshouse(c, w, h, p, rnd) {
    const cx = w / 2;
    const top = 330;
    const rad = 330;
    const arch = () => {
      c.beginPath();
      c.moveTo(cx - rad, h);
      c.lineTo(cx - rad, top);
      c.arc(cx, top, rad, Math.PI, 0);
      c.lineTo(cx + rad, h);
      c.closePath();
    };
    arch();
    c.fillStyle = p.c;
    c.fill();
    c.save();
    arch();
    c.clip();
    for (let i = 0; i < 48; i++) {
      const len = 110 + rnd() * 200;
      c.save();
      c.translate(cx - rad + rnd() * rad * 2, h + 10);
      c.rotate((rnd() - 0.5) * 1.1);
      c.fillStyle = i % 3 ? p.a : p.b;
      c.beginPath();
      c.ellipse(0, -len / 2, 13 + rnd() * 14, len / 2, 0, 0, TAU);
      c.fill();
      c.restore();
    }
    c.strokeStyle = p.ink;
    c.lineWidth = 4;
    for (let x = cx - rad + 82.5; x < cx + rad - 1; x += 82.5) line(c, x, top, x, h);
    for (let y = top; y < h; y += 90) line(c, cx - rad, y, cx + rad, y);
    for (let k = 1; k < 8; k++) {
      const t = Math.PI + (k * Math.PI) / 8;
      line(c, cx, top, cx + Math.cos(t) * rad, top + Math.sin(t) * rad);
    }
    ringS(c, cx, top, rad * 0.5, p.ink, 4);
    c.restore();
    arch();
    c.lineWidth = 9;
    c.strokeStyle = p.ink;
    c.stroke();
    disc(c, cx, top, 16, p.ink);
  },

  nightbus(c, w, h, p, rnd) {
    disc(c, w * 0.82, h * 0.2, 46, p.ink);
    disc(c, w * 0.82 + 19, h * 0.2 - 11, 42, p.bg);
    c.strokeStyle = rgba(p.ink, 0.14);
    c.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      line(c, x, y, x - 14, y + 44);
    }
    const bx = 130;
    const by = 230;
    const bw = 740;
    const bh = 250;
    const g = c.createLinearGradient(bx + bw, 0, w, 0);
    g.addColorStop(0, rgba(p.a, 0.55));
    g.addColorStop(1, rgba(p.a, 0));
    poly(c, [[bx + bw - 6, by + 190], [w + 20, by + 120], [w + 20, by + 310]], g);
    rrect(c, bx, by, bw, bh, 36);
    c.fillStyle = p.c;
    c.fill();
    c.fillStyle = p.b;
    c.fillRect(bx, by + 152, bw, 14);
    const lit = [1, 0.3, 1, 1, 0.18, 1, 0.6];
    for (let i = 0; i < 7; i++) {
      rrect(c, bx + 34 + i * 98, by + 36, 78, 90, 10);
      c.fillStyle = rgba(p.a, lit[i]);
      c.fill();
    }
    disc(c, bx + 34 + 2 * 98 + 39, by + 100, 17, p.bg);
    rrect(c, bx + 34 + 2 * 98 + 20, by + 112, 38, 20, 6);
    c.fillStyle = p.bg;
    c.fill();
    for (const x of [bx + 150, bx + bw - 150]) {
      disc(c, x, by + bh, 54, p.bg);
      disc(c, x, by + bh, 42, '#09090b');
      disc(c, x, by + bh, 15, p.c);
    }
    c.fillStyle = rgba(p.ink, 0.55);
    for (let x = -20; x < w; x += 150) c.fillRect(x, h - 52, 84, 8);
  },

  machinery(c, _w, _h, p) {
    const gear = (x: number, y: number, r: number, n: number, col: string, rot: number) => {
      c.beginPath();
      for (let i = 0; i <= 360; i++) {
        const t = (i / 360) * TAU;
        const k = Math.max(-1, Math.min(1, Math.sin(t * n + rot) * 2.6));
        const rr2 = r + k * r * 0.11;
        const X = x + Math.cos(t) * rr2;
        const Y = y + Math.sin(t) * rr2;
        if (i) c.lineTo(X, Y);
        else c.moveTo(X, Y);
      }
      c.closePath();
      c.fillStyle = col;
      c.fill();
      disc(c, x, y, r * 0.3, p.bg);
      disc(c, x, y, r * 0.1, col);
    };
    gear(350, 340, 200, 14, p.a, 0);
    for (let i = 0; i < 6; i++) {
      const t = (i * Math.PI) / 3;
      disc(c, 350 + Math.cos(t) * 122, 340 + Math.sin(t) * 122, 27, p.bg);
    }
    gear(672, 212, 138, 10, p.b, 1.1);
    gear(724, 494, 118, 9, p.c, 0.4);
    gear(118, 92, 96, 8, p.b, 0.7);
    gear(86, 566, 120, 9, p.c, 2);
    gear(920, 330, 70, 7, p.a, 0.3);
  },

  hymns(c, w, h, p) {
    c.strokeStyle = rgba(p.b, 0.5);
    c.lineWidth = 3;
    for (let y = 24; y < h * 0.4; y += 22) line(c, 0, y, w, y);
    disc(c, w * 0.7, h * 0.3, 100, p.a);
    const r = 84;
    for (let j = 0; j < 8; j++) {
      const y = h * 0.4 + j * (r * 0.52);
      for (let i = -1; i < 8; i++) {
        const x = i * r * 2 + (j % 2 ? r : 0);
        const hot = (i * 5 + j * 3) % 11 === 0;
        for (let k = 0; k < 4; k++) {
          c.beginPath();
          c.arc(x, y + r, r - k * 21, 0, TAU);
          c.fillStyle = hot && k === 3 ? p.a : k % 2 ? p.c : p.bg;
          c.fill();
          c.strokeStyle = p.ink;
          c.lineWidth = 4;
          c.stroke();
        }
      }
    }
  },

  brass(c, w, h, p) {
    const cx = w * 0.98;
    const cy = h * 1.06;
    for (let i = 9; i >= 0; i--) {
      c.beginPath();
      c.arc(cx, cy, 110 + i * 66, Math.PI, Math.PI * 1.5);
      c.lineWidth = 34;
      c.strokeStyle = i % 2 ? p.ink : p.a;
      c.stroke();
    }
    c.strokeStyle = p.ink;
    c.lineWidth = 16;
    c.lineCap = 'round';
    line(c, 80, 196, 560, 196);
    for (let i = 0; i < 3; i++) {
      const x = 172 + i * 112;
      rrect(c, x - 27, 100, 54, 194, 27);
      c.fillStyle = p.ink;
      c.fill();
      disc(c, x, 128, 13, p.c);
    }
    c.lineCap = 'butt';
    rrect(c, 60, 404, 150, 150, 6);
    c.strokeStyle = p.b;
    c.lineWidth = 8;
    c.stroke();
    disc(c, 135, 479, 32, p.b);
  },

  afterimage(c, w, h, p) {
    c.globalCompositeOperation = 'screen';
    disc(c, w * 0.41, h * 0.43, 205, p.a);
    disc(c, w * 0.59, h * 0.43, 205, p.b);
    disc(c, w * 0.5, h * 0.63, 205, p.c);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = rgba(p.bg, 0.24);
    for (let y = 0; y < h; y += 8) c.fillRect(0, y, w, 3);
    ringS(c, w * 0.5, h * 0.5, 300, rgba(p.ink, 0.7), 3);
    c.strokeStyle = rgba(p.ink, 0.7);
    line(c, w * 0.5 - 330, h * 0.5, w * 0.5 - 270, h * 0.5);
    line(c, w * 0.5 + 270, h * 0.5, w * 0.5 + 330, h * 0.5);
  },

  seven(c, _w, _h, p) {
    const pts = [
      [385, 150],
      [615, 150],
      [270, 322],
      [500, 322],
      [730, 322],
      [385, 494],
      [615, 494],
    ];
    pts.forEach(([x, y], i) => {
      const r = 100;
      const hot = i === 3;
      disc(c, x, y + 7, r, 'rgba(0,0,0,0.13)');
      disc(c, x, y, r, '#1b1b1b');
      disc(c, x, y, r * 0.87, '#2e2e2e');
      const g = c.createRadialGradient(x, y, r * 0.2, x, y, r * 0.78);
      g.addColorStop(0, hot ? '#b03b18' : '#0f0f0f');
      g.addColorStop(1, hot ? p.a : '#3b3b3b');
      disc(c, x, y, r * 0.77, g);
      ringS(c, x, y, r * 0.55, 'rgba(0,0,0,0.28)', 3);
      disc(c, x, y, r * 0.3, hot ? '#8a2c12' : '#0a0a0a');
      disc(c, x - r * 0.09, y - r * 0.1, r * 0.07, 'rgba(255,255,255,0.35)');
    });
  },

  concentric(c, w, h, p, rnd) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, p.bg);
    g.addColorStop(0.3, p.b);
    g.addColorStop(1, p.a);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const x = rnd() * w;
      const y = h * (0.15 + rnd() * 0.14);
      const r = 120 + rnd() * 130;
      const m = c.createRadialGradient(x, y, 0, x, y, r);
      m.addColorStop(0, rgba(p.c, 0.8));
      m.addColorStop(1, rgba(p.c, 0));
      c.save();
      c.translate(0, y);
      c.scale(1, 0.42);
      c.translate(0, -y);
      c.fillStyle = m;
      c.fillRect(x - r, y - r, r * 2, r * 2);
      c.restore();
    }
    c.lineWidth = 3;
    for (let i = 0; i < 13; i++) {
      const x = rnd() * w;
      const y = h * (0.4 + rnd() * 0.58);
      const n = 2 + ((rnd() * 4) | 0);
      for (let k = 1; k <= n; k++) {
        c.beginPath();
        c.ellipse(x, y, k * 34, k * 11.5, 0, 0, TAU);
        c.strokeStyle = rgba(k % 2 ? p.c : p.ink, 0.6 - k * 0.08);
        c.stroke();
      }
    }
    const cx = w / 2;
    const cy = h * 0.55;
    for (let k = 1; k <= 5; k++) {
      c.beginPath();
      c.ellipse(cx, cy + 22, 190 + k * 48, (190 + k * 48) * 0.36, 0, 0, TAU);
      c.strokeStyle = rgba(p.c, 0.66 - k * 0.1);
      c.stroke();
    }
    c.strokeStyle = p.ink;
    c.lineWidth = 6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx + 150, cy + 22);
    c.bezierCurveTo(cx + 340, cy + 60, cx + 250, cy + 172, cx + 90, cy + 152);
    c.bezierCurveTo(cx - 40, cy + 138, cx - 20, cy + 212, cx + 66, cy + 232);
    c.stroke();
    c.save();
    c.translate(cx, cy);
    c.scale(1, 0.42);
    disc(c, 0, 54, 162, p.ink);
    c.fillRect(-162, 0, 324, 54);
    disc(c, 0, 0, 162, p.c);
    ringS(c, 0, 0, 162, p.ink, 7);
    for (let i = 0; i < 3; i++) {
      const t = -Math.PI / 2 + i * (TAU / 3);
      disc(c, Math.cos(t) * 94, Math.sin(t) * 94, 45, p.a);
      ringS(c, Math.cos(t) * 94, Math.sin(t) * 94, 45, p.ink, 5);
    }
    disc(c, 0, 0, 30, p.b);
    ringS(c, 0, 0, 30, p.ink, 5);
    disc(c, 0, 0, 9, p.ink);
    c.restore();
  },

  marigold(c, w, h, p) {
    const cx = w / 2;
    const cy = h / 2;
    c.strokeStyle = p.c;
    c.lineWidth = 4;
    for (let i = 0; i < 60; i++) {
      const t = (i * Math.PI) / 30;
      const r0 = i % 5 ? 290 : 276;
      line(c, cx + Math.cos(t) * r0, cy + Math.sin(t) * r0, cx + Math.cos(t) * 304, cy + Math.sin(t) * 304);
    }
    const layers: [number, number, string][] = [
      [26, 264, p.b],
      [22, 224, p.a],
      [18, 180, p.b],
      [14, 134, p.a],
      [10, 90, p.c],
    ];
    layers.forEach(([n, len, col], L) => {
      for (let i = 0; i < n; i++) {
        c.save();
        c.translate(cx, cy);
        c.rotate((i / n) * TAU + L * 0.21);
        c.beginPath();
        c.ellipse(len / 2, 0, len / 2, len * 0.13, 0, 0, TAU);
        c.fillStyle = col;
        c.fill();
        c.strokeStyle = rgba(p.ink, 0.35);
        c.lineWidth = 2;
        c.stroke();
        c.restore();
      }
    });
    disc(c, cx, cy, 30, p.ink);
  },

  intersections(c, _w, _h, p) {
    const roads = [
      [-60, 500, 1060, 170],
      [240, -60, 470, 700],
      [660, -60, 900, 700],
    ];
    c.fillStyle = p.b;
    [
      [70, 70, 110, 150],
      [370, 50, 200, 96],
      [790, 40, 120, 96],
      [60, 566, 170, 60],
      [540, 420, 130, 170],
      [860, 360, 100, 120],
      [80, 300, 90, 90],
    ].forEach(([x, y, bw, bh]) => {
      rrect(c, x, y, bw, bh, 6);
      c.fill();
    });
    for (const [x1, y1, x2, y2] of roads) {
      c.strokeStyle = p.c;
      c.lineWidth = 96;
      line(c, x1, y1, x2, y2);
    }
    c.setLineDash([26, 22]);
    for (const [x1, y1, x2, y2] of roads) {
      c.strokeStyle = p.ink;
      c.lineWidth = 4;
      line(c, x1, y1, x2, y2);
    }
    c.setLineDash([]);
    disc(c, 371, 373, 22, p.a);
    ringS(c, 371, 373, 46, p.a, 4);
    ringS(c, 371, 373, 74, rgba(p.a, 0.5), 3);
  },

  moonlit(c, w, h, p, rnd) {
    c.save();
    c.shadowColor = rgba(p.c, 0.55);
    c.shadowBlur = 90;
    disc(c, 650, 276, 178, p.c);
    c.restore();
    for (let i = 0; i < 9; i++)
      disc(c, 650 + (rnd() - 0.5) * 240, 276 + (rnd() - 0.5) * 240, 10 + rnd() * 26, rgba(p.bg, 0.09));
    c.strokeStyle = rgba(p.b, 0.55);
    c.lineWidth = 2;
    for (let y = 38; y < h; y += 44) line(c, 0, y, w, y);
    c.strokeStyle = p.a;
    c.lineWidth = 3;
    for (const x of [150, 160, 860]) line(c, x, 0, x, h);
    c.font = `500 24px ${MONO}`;
    c.textAlign = 'right';
    for (let i = 1; i <= 13; i++) {
      const last = i === 13;
      c.fillStyle = rgba(p.ink, last ? 1 : 0.78);
      c.fillText(last ? '= 28,011.04' : (rnd() * 4000 + 12).toFixed(2), 420, 30 + i * 44);
    }
  },

  staircase(c, _w, h, p) {
    const n = 9;
    const sw = 96;
    const sh = 56;
    const sk = 46;
    const dp = 30;
    for (let i = 0; i < n; i++) {
      const x = 40 + i * sw;
      const y = h - 40 - i * sh;
      poly(c, [[x, y], [x + sw, y], [x + sw, h + 10], [x, h + 10]], i % 2 ? p.a : rgba(p.a, 0.8));
      poly(c, [[x, y], [x + sw, y], [x + sw + sk, y - dp], [x + sk, y - dp]], p.c);
      const fx = x + sw * 0.56;
      const fy = y - dp * 0.5;
      rrect(c, fx - 15, fy - 64, 30, 64, 14);
      c.fillStyle = p.b;
      c.fill();
      disc(c, fx, fy - 80, 15, p.b);
      disc(c, fx, fy - 75, 5, p.c);
    }
  },

  haze(c, w, h, p) {
    const g0 = c.createLinearGradient(0, 0, 0, h);
    g0.addColorStop(0, p.c);
    g0.addColorStop(1, p.bg);
    c.fillStyle = g0;
    c.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h * 0.48;
    const r = 220;
    const g = c.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, p.a);
    g.addColorStop(1, p.b);
    disc(c, cx, cy, r, g);
    c.fillStyle = g0;
    for (let i = 0; i < 8; i++) c.fillRect(cx - r - 10, cy + 8 + i * 27, r * 2 + 20, 3 + i * 3.3);
    c.strokeStyle = rgba(p.ink, 0.45);
    c.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      for (let x = -10; x <= w + 10; x += 8) {
        const yy = h * 0.88 + i * 17 + Math.sin(x / (40 + i * 14) + i) * (3 + i);
        if (x < 0) c.moveTo(x, yy);
        else c.lineTo(x, yy);
      }
      c.stroke();
    }
  },
};

function paintMotif(c: C2, r: Release) {
  c.save();
  c.fillStyle = r.pal.bg;
  c.fillRect(0, 0, 1000, 640);
  MOTIFS[r.motif](c, 1000, 640, r.pal, rng(r.idx * 977 + 13));
  c.restore();
}

function fitFont(c: C2, text: string, weight: number, size: number, max: number) {
  let s = size;
  c.font = `${weight} ${s}px ${SANS}`;
  while (c.measureText(text).width > max && s > 12) {
    s -= 2;
    c.font = `${weight} ${s}px ${SANS}`;
  }
  return s;
}

function mark(c: C2, x: number, y: number, r: number, ink: string, bg: string) {
  disc(c, x, y, r, ink);
  disc(c, x, y, r * 0.34, bg);
}

/* ------------------------------------------------------------------ */
/* Sleeve faces                                                         */
/* ------------------------------------------------------------------ */

export function drawCover(r: Release) {
  const W = 1000;
  const H = 1024;
  const [cv, c] = mk(W, H);
  const p = r.pal;
  c.fillStyle = p.bg;
  c.fillRect(0, 0, W, H);

  const top = 252;
  c.save();
  c.beginPath();
  c.rect(0, top, W, 640);
  c.clip();
  c.translate(0, top);
  paintMotif(c, r);
  c.restore();
  // feather the artwork into the sleeve stock
  const gt = c.createLinearGradient(0, top, 0, top + 70);
  gt.addColorStop(0, p.bg);
  gt.addColorStop(1, rgba(p.bg, 0));
  c.fillStyle = gt;
  c.fillRect(0, top - 1, W, 72);
  const gb = c.createLinearGradient(0, top + 596, 0, top + 640);
  gb.addColorStop(0, rgba(p.bg, 0));
  gb.addColorStop(1, p.bg);
  c.fillStyle = gb;
  c.fillRect(0, top + 596, W, 46);

  c.fillStyle = p.ink;
  c.textBaseline = 'alphabetic';
  c.globalAlpha = 0.78;
  c.font = `400 30px ${SANS}`;
  c.fillText(r.artist, 96, 120);
  c.textAlign = 'right';
  c.font = `500 21px ${MONO}`;
  track(c, 2);
  c.fillText(r.cat, W - 96, 116);
  c.fillText(String(r.year), W - 96, 966);
  c.textAlign = 'left';
  c.fillText('SABLE', 132, 966);
  track(c, 0);
  c.globalAlpha = 1;
  fitFont(c, r.title, 600, 66, W - 192);
  c.fillText(r.title, 93, 198);
  mark(c, 108, 958, 12, p.ink, p.bg);
  grain(c, W, H, 0.11);
  return cv;
}

export function drawBack(r: Release) {
  const W = 512;
  const H = 524;
  const [cv, c] = mk(W, H);
  const p = r.pal;
  c.fillStyle = p.bg;
  c.fillRect(0, 0, W, H);
  c.fillStyle = p.ink;
  c.font = `500 12px ${MONO}`;
  track(c, 1.5);
  c.globalAlpha = 0.7;
  c.fillText(r.cat, 46, 58);
  c.textAlign = 'right';
  c.fillText(String(r.year), W - 46, 58);
  c.textAlign = 'left';
  track(c, 0);
  c.globalAlpha = 1;
  fitFont(c, r.title, 600, 30, W - 92);
  c.fillText(r.title, 45, 104);
  c.fillRect(46, 126, W - 92, 2);
  r.tracks.forEach(([t, d], i) => {
    const y = 164 + i * 32;
    c.font = `500 12px ${MONO}`;
    c.globalAlpha = 0.6;
    c.fillText(String(i + 1).padStart(2, '0'), 46, y);
    c.textAlign = 'right';
    c.fillText(d, W - 46, y);
    c.textAlign = 'left';
    c.globalAlpha = 1;
    c.font = `400 17px ${SANS}`;
    c.fillText(t, 84, y);
  });
  // barcode sticker
  rrect(c, 46, 396, 132, 84, 4);
  c.fillStyle = '#fbfbf7';
  c.fill();
  const rnd = rng(r.idx * 31 + 3);
  c.fillStyle = '#111';
  let x = 58;
  while (x < 164) {
    const bw = 1 + ((rnd() * 3) | 0);
    c.fillRect(x, 406, bw, 52);
    x += bw + 1 + ((rnd() * 3) | 0);
  }
  c.font = `500 9px ${MONO}`;
  c.fillText(`5 0${r.year} ${String(110 + r.idx * 7)} 0${r.idx + 1}`, 58, 472);
  c.fillStyle = p.ink;
  c.globalAlpha = 0.65;
  c.textAlign = 'right';
  track(c, 1);
  [`℗ & © ${r.year} SABLE RECORDS`, `RECORDED AT ${r.where.toUpperCase()}`, 'ALL RIGHTS OF THE PRODUCER RESERVED'].forEach(
    (t, i) => c.fillText(t, W - 46, 452 + i * 14),
  );
  grain(c, W, H, 0.1);
  return cv;
}

export function drawSpine(r: Release) {
  const W = 160;
  const H = 1024;
  const [cv, c] = mk(W, H);
  const p = r.pal;
  c.fillStyle = p.bg;
  c.fillRect(0, 0, W, H);
  // soft edge roll so the spine reads as a folded board
  const g = c.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.16)');
  g.addColorStop(0.12, 'rgba(0,0,0,0)');
  g.addColorStop(0.88, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.12)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.save();
  c.translate(W / 2, 0);
  c.rotate(Math.PI / 2);
  c.fillStyle = p.ink;
  c.textBaseline = 'middle';
  c.font = `500 25px ${MONO}`;
  track(c, 2);
  c.globalAlpha = 0.72;
  c.fillText(r.cat, 46, 2);
  track(c, 0);
  c.globalAlpha = 1;
  let size = 56;
  let tw = 0;
  let aw = 0;
  for (;;) {
    c.font = `600 ${size}px ${SANS}`;
    tw = c.measureText(r.title).width;
    c.font = `400 ${Math.round(size * 0.56)}px ${SANS}`;
    aw = c.measureText(r.artist).width;
    if (tw + aw + 40 < 680 || size <= 30) break;
    size -= 2;
  }
  c.font = `600 ${size}px ${SANS}`;
  c.fillText(r.title, 200, 4);
  c.font = `400 ${Math.round(size * 0.56)}px ${SANS}`;
  c.globalAlpha = 0.74;
  c.fillText(r.artist, 200 + tw + 40, 5);
  c.restore();
  mark(c, W / 2, 958, 21, p.ink, p.bg);
  grain(c, W, H, 0.1);
  return cv;
}

/** The open edge of the sleeve: board walls with the slot the disc rolls out of. */
export function drawEdge(r: Release) {
  const W = 80;
  const H = 512;
  const [cv, c] = mk(W, H);
  c.fillStyle = r.pal.bg;
  c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(0,0,0,0.14)';
  c.fillRect(0, 0, W, H);
  rrect(c, 28, 10, 24, H - 20, 10);
  c.fillStyle = 'rgba(0,0,0,0.62)';
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.22)';
  c.fillRect(53, 14, 2, H - 28);
  return cv;
}

function arcText(
  c: C2,
  text: string,
  cx: number,
  cy: number,
  rad: number,
  mid: number,
  font: string,
  sp: number,
  flip = false,
) {
  c.font = font;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const chars = Array.from(text);
  const ws = chars.map((ch) => c.measureText(ch).width + sp);
  const total = ws.reduce((a, b) => a + b, 0) / rad;
  const dir = flip ? -1 : 1;
  let a = mid - (dir * total) / 2;
  chars.forEach((ch, i) => {
    const da = ws[i] / rad;
    const t = a + (dir * da) / 2;
    c.save();
    c.translate(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad);
    c.rotate(t + (dir * Math.PI) / 2);
    c.fillText(ch, 0, 0);
    c.restore();
    a += dir * da;
  });
}

export function drawDisc(r: Release) {
  const S = 1024;
  const m = S / 2;
  const [cv, c] = mk(S, S);
  const p = r.pal;
  c.fillStyle = p.bg;
  c.fillRect(0, 0, S, S);
  c.save();
  c.beginPath();
  c.arc(m, m, m * 0.79, 0, TAU);
  c.clip();
  c.translate(m - 800, 0);
  c.scale(1.6, 1.6);
  paintMotif(c, r);
  c.restore();
  ringS(c, m, m, m * 0.79, p.ink, 3);
  ringS(c, m, m, m * 0.985, rgba(p.ink, 0.35), 2);
  c.fillStyle = p.ink;
  track(c, 0);
  arcText(c, r.title.toUpperCase(), m, m, m * 0.885, -Math.PI / 2, `600 42px ${SANS}`, 7);
  arcText(
    c,
    `${r.artist} · ${r.cat} · ℗ ${r.year} SABLE RECORDS`.toUpperCase(),
    m,
    m,
    m * 0.885,
    Math.PI / 2,
    `500 19px ${MONO}`,
    3.5,
    true,
  );
  // mirror band + clear hub
  let band: Fill = '#e2e2e6';
  if (typeof c.createConicGradient === 'function') {
    const cg = c.createConicGradient(0.6, m, m);
    ['#ececf0', '#bfe3ff', '#f7f7f7', '#ffd9ec', '#eeeeee', '#d5ffe9', '#f7f7f7', '#fff3c4', '#ececf0'].forEach((col, i) =>
      cg.addColorStop(i / 8, col),
    );
    band = cg;
  }
  disc(c, m, m, m * 0.4, band);
  ringS(c, m, m, m * 0.4, 'rgba(0,0,0,0.25)', 2);
  disc(c, m, m, m * 0.33, '#d9d9d6');
  ringS(c, m, m, m * 0.33, 'rgba(0,0,0,0.2)', 2);
  ringS(c, m, m, m * 0.255, 'rgba(0,0,0,0.12)', 4);
  ringS(c, m, m, m * 0.18, 'rgba(255,255,255,0.75)', 5);
  grain(c, S, S, 0.07);
  return cv;
}

/** Strobe-dot rim of the platter. One tile = one slot on the ring. */
export function drawRim() {
  const W = 256;
  const H = 128;
  const [cv, c] = mk(W, H);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f4f4f2');
  g.addColorStop(0.07, '#dcdcda');
  g.addColorStop(0.5, '#c4c4c1');
  g.addColorStop(0.93, '#a5a5a2');
  g.addColorStop(1, '#7c7c7a');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#18181a';
  const rows = [
    [26, 0],
    [57, 32],
    [88, 0],
  ];
  for (const [y, off] of rows)
    for (let i = -1; i < 5; i++) {
      rrect(c, off + i * 64 + 12, y, 40, 15, 3);
      c.fill();
    }
  return cv;
}

export function drawUnder() {
  const [cv, c] = mk(8, 128);
  const g = c.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(96,96,94,0.62)');
  g.addColorStop(0.35, 'rgba(140,140,138,0.28)');
  g.addColorStop(1, 'rgba(200,200,198,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 8, 128);
  return cv;
}

/* ------------------------------------------------------------------ */
/* Cached canvases / data URLs (shared by the 3D sleeves and the page)  */
/* ------------------------------------------------------------------ */

const coverCache = new Map<number, HTMLCanvasElement>();
const discCache = new Map<number, HTMLCanvasElement>();
const urlCache = new Map<string, string>();

export function coverCanvas(i: number) {
  let cv = coverCache.get(i);
  if (!cv) coverCache.set(i, (cv = drawCover(RELEASES[i])));
  return cv;
}
export function discCanvas(i: number) {
  let cv = discCache.get(i);
  if (!cv) discCache.set(i, (cv = drawDisc(RELEASES[i])));
  return cv;
}
export function coverURL(i: number) {
  const k = `c${i}`;
  let u = urlCache.get(k);
  if (!u) urlCache.set(k, (u = coverCanvas(i).toDataURL('image/jpeg', 0.92)));
  return u;
}
export function discURL(i: number) {
  const k = `d${i}`;
  let u = urlCache.get(k);
  if (!u) urlCache.set(k, (u = discCanvas(i).toDataURL('image/jpeg', 0.9)));
  return u;
}

export async function fontsReady() {
  if (!document.fonts?.load) return;
  const wait = Promise.all([
    document.fonts.load(`600 40px ${SANS}`, 'Sable'),
    document.fonts.load(`400 40px ${SANS}`, 'Sable'),
    document.fonts.load(`500 20px ${MONO}`, 'SBL-011'),
  ]);
  await Promise.race([wait, new Promise((res) => setTimeout(res, 2500))]).catch(() => undefined);
}
