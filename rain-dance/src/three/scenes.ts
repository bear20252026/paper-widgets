import * as THREE from 'three';
import { glowTex } from './rain';

export interface Shot { pos: THREE.Vector3; tgt: THREE.Vector3; fov: number }
export interface Env {
  title: string; line: string; group: THREE.Group;
  skyTop: number; skyHor: number; fog: number; fogD: number; stars: number;
  orb?: { dir: [number, number, number]; size: number; color: number };
  key: number; rim: number; amb: number; rain: number; dress: number; umb: number;
  /** one dance move and one camera shot per 8-beat segment; shot -1 = the scene's signature camera move */
  moves: number[]; shots: number[]; tile?: number; thunder?: boolean; girlYaw?: number; waltz?: [number, number];
  boy?: { x: number; y?: number; z: number; yaw: number; moves: number[]; from?: [number, number]; arrive?: number; until?: number };
  rainAmt: number; wind: [number, number];
  cam: (p: number, s: Shot) => void;
  update: (t: number, beat: number, pulse: number, p: number) => void;
}

const R = Math.random, PI = Math.PI, L = THREE.MathUtils.lerp, S = Math.sin, C = Math.cos;
const ez = (p: number) => p * p * (3 - 2 * p);
type GM = THREE.MeshBasicMaterial;
function glow(c: number, k = 2) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
  m.userData.base = new THREE.Color(c);
  return m;
}
const setGlow = (m: GM, k: number, c?: number) => { if (c !== undefined) m.userData.base.set(c); m.color.copy(m.userData.base).multiplyScalar(k); };
const dark = (c = 0x0b0d16, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
function add(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (a: number, b: number, h: number, s = 10) => new THREE.CylinderGeometry(a, b, h, s);
const sph = (r: number, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
function halo(g: THREE.Object3D, c: number, size: number, x: number, y: number, z: number, op = 0.6) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  s.position.set(x, y, z);
  g.add(s);
  return s;
}
function winTex(cols: string[], lit = 0.45) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#000'; x.fillRect(0, 0, 64, 128);
  for (let r = 0; r < 16; r++) for (let q = 0; q < 6; q++) if (R() < lit) {
    x.fillStyle = cols[Math.floor(R() * cols.length)];
    x.globalAlpha = 0.4 + R() * 0.6;
    x.fillRect(q * 10.6 + 2, r * 8 + 2, 6.5, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function textTex(txt: string, col: number) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d')!, hex = '#' + new THREE.Color(col).getHexString();
  x.font = 'bold 74px Georgia, "Songti SC", "Noto Serif CJK SC", "Hiragino Mincho ProN", serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = hex; x.shadowBlur = 24; x.fillStyle = hex; x.fillText(txt, 128, 68);
  x.shadowBlur = 6; x.globalAlpha = 0.65; x.fillStyle = '#fff'; x.fillText(txt, 128, 68);
  x.globalAlpha = 1; x.strokeStyle = hex; x.lineWidth = 4; x.strokeRect(8, 8, 240, 112);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function tower(g: THREE.Object3D, tex: THREE.Texture, w: number, h: number, d: number, x: number, z: number, e = 1.4) {
  const rx = Math.max(1, Math.round(w / 3)), ry = Math.max(1, Math.round(h / 6));
  if (!tex.userData.variants) tex.userData.variants = new Map<string, THREE.Texture[]>();
  const cache = tex.userData.variants as Map<string, THREE.Texture[]>;
  const key = rx + 'x' + ry;
  let list = cache.get(key);
  if (!list) { list = []; cache.set(key, list); }
  let t = list.length ? list[Math.floor(R() * list.length)] : undefined;
  if (!t || (list.length < 3 && R() < 0.5)) {
    t = tex.clone();
    t.repeat.set(rx, ry);
    t.offset.set(R(), R());
    t.needsUpdate = true;
    list.push(t);
  }
  return add(g, box(w, h, d), new THREE.MeshStandardMaterial({ color: 0x080a12, roughness: 0.6, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: e }), x, h / 2, z);
}
function motes(g: THREE.Object3D, n: number, c: number, size: number, sx: number, sy: number, sz: number, y0 = 0) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([(R() - 0.5) * sx, y0 + R() * sy, (R() - 0.5) * sz], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex(), color: c, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  p.frustumCulled = false;
  p.userData.base = a.slice();
  g.add(p);
  return p;
}
const orbit = (s: Shot, a: number, r: number, y: number, ty = 1.15, fov = 42) => { s.pos.set(S(a) * r, y, C(a) * r); s.tgt.set(0, ty, 0); s.fov = fov; };
const NEON = [0xff2a6d, 0x05d9e8, 0xfff35c, 0xb967ff, 0x01ffc3];

export function buildScenes(): Env[] {
  const envs: Env[] = [];
  const cool = winTex(['#9fd0ff', '#ffe9b0', '#6fa8ff']), warm = winTex(['#ffcf7a', '#ff9d5c', '#ffe7b8'], 0.55), neonW = winTex(['#ff4fa0', '#4ff0ff', '#fff27a', '#c08bff'], 0.35);

  // ---------- 1 · First Drop — a blue-hour street
  {
    const g = new THREE.Group(), lamps: GM[] = [], halos: THREE.Sprite[] = [], cars: { h: THREE.Sprite; b: THREE.Group }[] = [];
    for (let i = 0; i < 14; i++) for (const sx of [-1, 1]) tower(g, cool, 5 + R() * 3, 8 + R() * 16, 6, sx * (11 + R() * 3), 14 - i * 6.5);
    for (let i = 0; i < 9; i++) tower(g, cool, 5, 16 + R() * 22, 5, -22 + i * 5.5, -72 - R() * 8, 2);
    const pole = dark(0x141824, 0.5);
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) {
      const z = 8 - i * 6.5, m = glow(0xffe2b0, 3);
      add(g, cyl(0.05, 0.08, 4.4), pole, sx * 4.6, 2.2, z);
      add(g, box(1, 0.06, 0.06), pole, sx * 4.15, 4.4, z);
      add(g, sph(0.16), m, sx * 3.7, 4.3, z);
      lamps.push(m); halos.push(halo(g, 0xffd9a0, 2.6, sx * 3.7, 4.3, z, 0.5));
    }
    const stripe = new THREE.MeshBasicMaterial({ color: 0x5a78b8, transparent: true, opacity: 0.22 });
    for (let i = 0; i < 9; i++) add(g, box(0.5, 0.004, 3), stripe, -4 + i, 0.004, -3.2);
    const tl = [glow(0xff3344, 3), glow(0xffcc33, 3), glow(0x33ff99, 3)];
    add(g, cyl(0.05, 0.05, 3.6), pole, -5.3, 1.8, -1.5); add(g, box(0.3, 0.95, 0.25), pole, -5.3, 3.4, -1.5);
    tl.forEach((m, i) => add(g, sph(0.09), m, -5.3, 3.7 - i * 0.3, -1.36));
    const roadM = new THREE.MeshBasicMaterial({ color: 0x070a14, transparent: true, opacity: 0.55 });
    for (const sx of [-1, 1]) add(g, box(3.2, 0.002, 150), roadM, sx * 7.6, 0.004, -20);
    const carPaint = dark(0x0d1018, 0.4);
    for (let i = 0; i < 6; i++) {
      const front = i < 3, b = new THREE.Group();
      add(b, box(1.7, 0.55, 3.9), carPaint, 0, 0.55, 0);
      add(b, box(1.5, 0.5, 2.0), carPaint, 0, 1.05, 0.1);
      add(b, box(1.52, 0.26, 1.8), glow(front ? 0x9fc0e8 : 0xd86a5a, 0.55), 0, 1.06, 0.1);
      if (!front) b.rotation.y = PI;
      g.add(b);
      cars.push({ h: halo(g, front ? 0xfff4d8 : 0xff2233, front ? 1.5 : 1.1, 0, 0.6, 0, 0.9), b });
    }
    envs.push({
      title: 'First Drop', line: 'The city exhales — and the first rain finds her.', group: g,
      skyTop: 0x060a1e, skyHor: 0x24406e, fog: 0x101c38, fogD: 0.028, stars: 0, key: 0xbfd4ff, rim: 0x5f8bff, amb: 0x25345c,
      rain: 0x9fc4ff, dress: 0xff4d6d, umb: 0xff5c7a, moves: [0, 4, 0, 1], shots: [-1, 0, 5, 3], tile: 0.9, rainAmt: 0.75, wind: [0.08, 0.02],
      cam: (p, s) => { const e = ez(p); s.pos.set(L(-1.2, 1.6, e), L(0.9, 1.5, e), L(10, 4.6, e)); s.tgt.set(0, 1.2, 0); s.fov = L(46, 36, e); },
      update: (t, beat, pulse) => {
        lamps.forEach((m, i) => {
          const k = Math.exp(-(((beat - (i >> 1)) % 6 + 6) % 6) * 0.9);
          setGlow(m, 1.2 + 4 * k); halos[i].material.opacity = 0.3 + 0.6 * k;
        });
        const ph = Math.floor(beat / 4) % 3;
        tl.forEach((m, i) => setGlow(m, i === 2 - ph ? 3 + pulse * 2 : 0.15));
        cars.forEach((c, i) => {
          const front = i < 3, z = front ? -60 + ((t * 9 + i * 31) % 80) : 15 - ((t * 7 + i * 29) % 80);
          const x = front ? -7.6 : 7.6;
          c.h.position.set(x, 0.6, z + 2.05);
          c.b.position.set(x, 0, z);
        });
      },
    });
  }

  // ---------- 2 · Neon Reverie — an alley of signs
  {
    const g = new THREE.Group(), signs: GM[] = [];
    for (const sx of [-1, 1]) for (let i = 0; i < 7; i++) tower(g, neonW, 3, 10 + R() * 8, 7, sx * 6.2, 14 - i * 7, 1.1);
    tower(g, neonW, 16, 18, 2, 0, -26, 1.2); tower(g, neonW, 16, 18, 2, 0, 22, 0.8);
    for (let i = 0; i < 26; i++) {
      const sx = i % 2 ? 1 : -1, m = glow(NEON[i % 5], 2.5), z = 11 - i * 1.25 + R(), y = 1.6 + R() * 6, k = i % 4;
      const geo = k === 0 ? box(0.12, 1.6 + R() * 2, 0.5) : k === 1 ? new THREE.TorusGeometry(0.45 + R() * 0.3, 0.05, 8, 24) : k === 2 ? box(0.1, 0.12, 1.5 + R() * 2) : box(0.1, 0.9, 0.9);
      const o = add(g, geo, m, sx * (4.55 - (k === 0 ? 0.5 : 0)), y, z);
      if (k === 1) o.rotation.y = PI / 2;
      signs.push(m);
    }
    const words: THREE.MeshBasicMaterial[] = [];
    ['雨', 'LOVE', '恋', 'RAIN', '夢', 'CAFÉ', '♡', 'JAZZ'].forEach((w, i) => {
      const sx = i % 2 ? 1 : -1;
      const mat = new THREE.MeshBasicMaterial({ map: textTex(w, NEON[i % 5]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      add(g, new THREE.PlaneGeometry(2.1, 1.05), mat, sx * 4.3, 2.6 + R() * 3.4, 9.5 - i * 3).rotation.y = -sx * 1.15;
      words.push(mat);
    });
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) { const a = (i / 80) * PI * 2; pts.push(new THREE.Vector3(16 * S(a) ** 3, 13 * C(a) - 5 * C(2 * a) - 2 * C(3 * a) - C(4 * a), 0).multiplyScalar(0.1)); }
    const heart = glow(0xff2a6d, 3.5);
    add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 120, 0.06, 8, true), heart, 0, 5.2, -13);
    const hh = halo(g, 0xff2a6d, 7, 0, 5.2, -12.8, 0.35);
    const lant: GM[] = [];
    for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) {
      const m = glow(0xff7a45, 2.2), u = i / 6;
      add(g, sph(0.16, 10, 8), m, L(-4.4, 4.4, u), 5.6 - S(u * PI) * 0.9 + r * 0.3, 6 - r * 5.5).scale.y = 1.25;
      lant.push(m);
    }
    envs.push({
      title: 'Neon Reverie', line: 'Every puddle holds a second sky, written in light.', group: g,
      skyTop: 0x0a0318, skyHor: 0x3a0f4a, fog: 0x1c0a30, fogD: 0.035, stars: 0, key: 0xff9ad5, rim: 0x19e3ff, amb: 0x3a1e5a,
      rain: 0xff9be8, dress: 0x16e0f0, umb: 0x35f2ff, moves: [7, 1, 3, 5], shots: [-1, 3, 2, 1], rainAmt: 0.9, wind: [-0.05, 0.03],
      cam: (p, s) => orbit(s, L(-0.68, 0.68, ez(p)), L(5.2, 3.6, p), L(0.85, 1.7, p), 1.15, 44),
      update: (t, beat, pulse) => {
        const b = Math.floor(beat);
        signs.forEach((m, i) => setGlow(m, (S(t * 31 + i * 7) > 0.96 ? 0.3 : 1.6) + pulse * ((i + b) % 3 === 0 ? 3.5 : 0.6), NEON[(i + b) % 5]));
        setGlow(heart, 2 + pulse * 4); hh.material.opacity = 0.25 + pulse * 0.4;
        words.forEach((m, i) => m.color.setScalar((1.3 + pulse * 1.5) * (S(t * 29 + i * 7) > -0.93 ? 1 : 0.2)));
        lant.forEach((m, i) => setGlow(m, (i + b) % 7 === 0 ? 5 : 1.5));
      },
    });
  }

  // ---------- 3 · Lantern Bridge
  {
    const g = new THREE.Group(), stone = dark(0x1a1418, 0.7), lant: GM[] = [];
    const arch = add(g, new THREE.TorusGeometry(8, 0.38, 8, 48, PI), stone, 0, 0, -9); arch.scale.set(1, 0.4, 3.2);
    const rail = add(g, new THREE.TorusGeometry(8, 0.05, 6, 48, PI), dark(0x5a1a1a, 0.5), 0, 0.95, -7.9); rail.scale.y = 0.4;
    for (let i = 0; i <= 26; i++) {
      const a = PI * (0.1 + 0.8 * (i / 26)), x = C(a) * 8, y = S(a) * 3.2;
      const plank = add(g, box(0.62, 0.09, 1.7), stone, x, y + 0.2, -9);
      plank.rotation.z = Math.atan2(3.2 * C(a), -8 * S(a));
    }
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * PI, x = C(a) * 8, y = S(a) * 3.2 + 0.3, m = glow(0xffa24a, 3);
      add(g, cyl(0.04, 0.04, 1.3), dark(0x5a1a1a), x, y + 0.6, -7.9);
      add(g, sph(0.15, 10, 8), m, x, y + 1.35, -7.9).scale.y = 1.3;
      halo(g, 0xff9a3c, 1.6, x, y + 1.35, -7.9, 0.45);
      lant.push(m);
    }
    for (let i = 0; i < 12; i++) {
      const x = -30 + i * 5.5 + R() * 2, h = 3 + R() * 4, z = -24 - R() * 10;
      tower(g, warm, 4, h, 4, x, z, 1.2);
      add(g, new THREE.ConeGeometry(3.6, 1.6, 4), stone, x, h + 0.8, z).rotation.y = PI / 4;
    }
    const sky = motes(g, 110, 0xffa64d, 0.75, 44, 16, 40, 1), a = sky.geometry.attributes.position.array as Float32Array;
    let last = -1;
    envs.push({
      title: 'Lantern Bridge', line: 'On the far side of the river, someone lifts his eyes.', group: g,
      skyTop: 0x0c0714, skyHor: 0x4a2030, fog: 0x1e1018, fogD: 0.024, stars: 0.5, key: 0xffd3a0, rim: 0xff8a4a, amb: 0x4a2c30,
      rain: 0xffd9a8, dress: 0xf2e2d2, umb: 0xff4a3a, moves: [3, 2, 0, 1], shots: [-1, 6, 4, 1], rainAmt: 0.6, wind: [0.1, -0.02],
      boy: { x: 0.6, y: 3.46, z: -9, yaw: 0, moves: [8] },
      cam: (p, s) => { const e = ez(p); s.pos.set(L(-7, -2.2, e), L(5.5, 1.3, e), L(11, 5.2, e)); s.tgt.set(L(0, 0.3, e), L(1.6, 1.25, e), L(-2, 0, e)); s.fov = L(48, 38, e); },
      update: (t, beat, pulse, p) => {
        const b = Math.floor(beat);
        if (b !== last) { last = b; for (let k = 0; k < 3; k++) { const i = ((b * 3 + k) % 110) * 3; a[i] = (R() - 0.5) * 7; a[i + 1] = 0.3; a[i + 2] = (R() - 0.5) * 6 - 1; } }
        for (let i = 0; i < a.length; i += 3) { a[i + 1] += 0.012 + (i % 7) * 0.0012; a[i] += S(t * 0.6 + i) * 0.004; if (a[i + 1] > 18) a[i + 1] = 0.3; }
        sky.geometry.attributes.position.needsUpdate = true;
        (sky.material as THREE.PointsMaterial).opacity = 0.75 + pulse * 0.25;
        lant.forEach((m, i) => setGlow(m, 1.6 + 3.5 * Math.max(0, S(beat * PI * 0.5 - i * 0.5)) ** 4 + p));
      },
    });
  }

  // ---------- 4 · Sakura Shower
  {
    const g = new THREE.Group(), bark = dark(0x1c1016, 0.9), blossoms: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2 + 0.3, r = 7.5 + (i % 3) * 2.2, x = S(a) * r, z = C(a) * r, tr = new THREE.Group();
      tr.position.set(x, 0, z); tr.rotation.y = R() * 6; g.add(tr);
      add(tr, cyl(0.16, 0.3, 3.4, 8), bark, 0, 1.7, 0).rotation.z = 0.12;
      for (let k = 0; k < 3; k++) { const br = add(tr, cyl(0.06, 0.13, 2.6, 6), bark, S(k * 2.1) * 0.9, 3.8, C(k * 2.1) * 0.9); br.rotation.set(C(k * 2.1) * 0.7, 0, -S(k * 2.1) * 0.7); }
      const bm = new THREE.MeshStandardMaterial({ color: 0xffb7d0, roughness: 0.9, emissive: 0xff6fa5, emissiveIntensity: 0.35, flatShading: true });
      blossoms.push(bm);
      for (let k = 0; k < 8; k++) add(tr, new THREE.IcosahedronGeometry(0.9 + R() * 0.9, 1), bm, (R() - 0.5) * 3.6, 4.2 + R() * 1.8, (R() - 0.5) * 3.6);
    }
    const lm: GM[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2 + 0.9, x = S(a) * 5.2, z = C(a) * 5.2, m = glow(0xffc27a, 3);
      add(g, cyl(0.1, 0.14, 0.9, 6), bark, x, 0.45, z); add(g, box(0.34, 0.3, 0.34), m, x, 1.05, z);
      add(g, new THREE.ConeGeometry(0.4, 0.3, 4), bark, x, 1.35, z).rotation.y = PI / 4;
      halo(g, 0xffb060, 2, x, 1.05, z, 0.4); lm.push(m);
    }
    const pet = motes(g, 700, 0xffa8cc, 0.11, 24, 9, 24), a = pet.geometry.attributes.position.array as Float32Array;
    envs.push({
      title: 'Sakura Shower', line: 'She lets the umbrella go; petals and rain forget which is falling.', group: g,
      skyTop: 0x150a24, skyHor: 0x5a2a55, fog: 0x2a1436, fogD: 0.03, stars: 0.6, orb: { dir: [-0.5, 0.55, -0.7], size: 0.06, color: 0xffe6f2 },
      key: 0xffd6ea, rim: 0xff7fc0, amb: 0x4a2a55, rain: 0xffc4e2, dress: 0xfff5fa, umb: 0xff8fc0, moves: [1, 10, 5, 4], shots: [-1, 3, 1, 0], rainAmt: 0.5, wind: [0.12, 0.06],
      cam: (p, s) => orbit(s, L(2.3, 3.9, p), L(4.6, 3.8, ez(p)), L(0.55, 0.95, p), L(1.25, 1.45, p), 52),
      update: (t, beat, pulse) => {
        const gust = 1 + pulse * 5;
        for (let i = 0; i < a.length; i += 3) {
          a[i + 1] -= (0.006 + (i % 5) * 0.002);
          a[i] += (S(t * 0.9 + i) * 0.006 + 0.004) * gust; a[i + 2] += C(t * 0.7 + i * 1.3) * 0.006 * gust;
          if (a[i + 1] < 0) { a[i + 1] = 8 + R() * 2; a[i] = (R() - 0.5) * 24; a[i + 2] = (R() - 0.5) * 24; }
        }
        pet.geometry.attributes.position.needsUpdate = true;
        blossoms.forEach((m, i) => (m.emissiveIntensity = 0.3 + 0.9 * pulse * ((Math.floor(beat) + i) % 3 === 0 ? 1 : 0.25)));
        lm.forEach((m, i) => setGlow(m, 2 + 3 * pulse * ((Math.floor(beat) + i) % 2)));
      },
    });
  }

  // ---------- 5 · Last Train
  {
    const g = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0x3a4658, metalness: 0.8, roughness: 0.35 }), con = dark(0x141a22, 0.8);
    for (const z of [-4.6, -6.1]) add(g, box(160, 0.12, 0.1), steel, 0, 0.06, z);
    const edge = glow(0xffd23a, 0.9); add(g, box(160, 0.01, 0.25), edge, 0, 0.006, -3);
    add(g, box(160, 0.9, 5), con, 0, 0.45, -10.4);
    add(g, box(160, 0.15, 5.4), con, 0, 4.4, -10.4);
    const tubes: GM[] = [];
    for (let i = -8; i <= 8; i++) {
      add(g, cyl(0.09, 0.09, 3.6, 8), steel, i * 8, 2.6, -8.6);
      const m = glow(0xcff5ff, 2.5); add(g, box(2.6, 0.06, 0.12), m, i * 8 + 4, 4.25, -9.6); tubes.push(m);
    }
    tower(g, cool, 160, 7, 1, 0, -14, 0.5);
    const sig = [glow(0xff2a3a, 3), glow(0x2affa0, 3)], sh: THREE.Sprite[] = [];
    [-9, 9].forEach((x, i) => { add(g, cyl(0.06, 0.06, 4.6), steel, x, 2.3, -3.6); add(g, sph(0.16), sig[i], x, 4.6, -3.6); sh.push(halo(g, i ? 0x2affa0 : 0xff2a3a, 2.4, x, 4.6, -3.6, 0.5)); });
    for (let i = -4; i <= 4; i++) { add(g, cyl(0.07, 0.07, 6.5), steel, i * 16 + 5, 3.25, -7.2); }
    add(g, box(160, 0.03, 0.03), steel, 0, 6.2, -5.3);
    const clock = glow(0xfff4d0, 2); add(g, cyl(0.45, 0.45, 0.12, 24), clock, 4.2, 4.1, -2.2).rotation.x = PI / 2; add(g, cyl(0.04, 0.04, 4.1), steel, 4.2, 2.05, -2.3);
    const train = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: 0x26323f, metalness: 0.5, roughness: 0.4, emissive: 0x060e14 }), win = glow(0xffd9a0, 0.95);
    for (let c = 0; c < 6; c++) {
      add(train, box(11.4, 2.9, 2.5), body, c * 12, 2.1, 0);
      for (let k = 0; k < 6; k++) add(train, box(1.1, 0.7, 2.54), win, c * 12 - 4.4 + k * 1.75, 2.5, 0);
      add(train, box(11.4, 0.06, 2.54), glow(0x2ae0c8, 0.7), c * 12, 1.25, 0);
    }
    add(train, sph(0.25), glow(0xffffff, 2.4), -5.8, 1.6, 0); halo(train, 0xfff0d0, 2.6, -6, 1.6, 0, 0.4);
    train.position.z = -5.35; g.add(train);
    envs.push({
      title: 'Last Train', line: 'He waits on the far platform. The train passes — and he is gone.', group: g,
      skyTop: 0x04101a, skyHor: 0x124048, fog: 0x0a2028, fogD: 0.026, stars: 0.2, key: 0xc8fff4, rim: 0x2ad8c0, amb: 0x1c4048,
      rain: 0xa8f0e6, dress: 0xffd84a, umb: 0xffe066, moves: [0, 3, 1, 4], shots: [-1, 4, 6, 0], tile: 0.6, thunder: true, rainAmt: 0.85, wind: [-0.14, 0.02],
      boy: { x: -1.4, y: 0.9, z: -9.3, yaw: 0, moves: [8], until: 0.57 },
      cam: (p, s) => { const e = ez(p); s.pos.set(L(-5.5, 5.5, e), L(1.25, 1.6, p), L(6.6, 5.4, S(p * PI))); s.tgt.set(L(-0.6, 0.6, e), 1.25, -0.6); s.fov = 40; },
      update: (t, beat, pulse, p) => {
        train.position.x = L(150, -190, THREE.MathUtils.clamp((p - 0.3) / 0.5, 0, 1));
        const b = Math.floor(beat) % 2;
        sig.forEach((m, i) => { setGlow(m, i === b ? 4 : 0.2); sh[i].material.opacity = i === b ? 0.6 : 0.05; });
        tubes.forEach((m, i) => setGlow(m, S(t * 23 + i * 5) > 0.97 ? 0.5 : 1.7 + pulse * 1.2));
        setGlow(edge, 0.45 + pulse * 0.8); setGlow(clock, 1.4 + pulse * 0.8);
      },
    });
  }

  // ---------- 6 · Rooftop Constellation
  {
    const g = new THREE.Group(), con = dark(0x12141e, 0.85), towers: THREE.Mesh[] = [], fairy: GM[] = [];
    const voidM = new THREE.MeshBasicMaterial({ color: 0x05060e });
    add(g, new THREE.RingGeometry(8.2, 140, 48), voidM, 0, 0.03, 0).rotation.x = -PI / 2;
    for (let i = 0; i < 4; i++) { const w = add(g, box(16.8, 0.7, 0.4), con, S(i * PI / 2) * 8.2, 0.35, C(i * PI / 2) * 8.2); w.rotation.y = i * PI / 2; }
    for (let i = 0; i < 90; i++) {
      const a = R() * PI * 2, r = 20 + R() * 55, h = 3 + R() * R() * 26;
      const tw = tower(g, i % 3 ? cool : neonW, 3 + R() * 4, h, 3 + R() * 4, S(a) * r, C(a) * r, 1.6); tw.userData.h = h; tw.userData.ph = R() * 4; towers.push(tw);
    }
    add(g, cyl(1.1, 1.1, 1.8, 16), con, -5.4, 2.3, -5.2); add(g, new THREE.ConeGeometry(1.2, 0.6, 16), con, -5.4, 3.5, -5.2);
    for (let k = 0; k < 4; k++) add(g, cyl(0.06, 0.06, 1.5), con, -5.4 + S(k * PI / 2 + 0.8) * 0.9, 0.75, -5.2 + C(k * PI / 2 + 0.8) * 0.9);
    add(g, box(1.6, 0.9, 1), con, 5.6, 0.45, -5.6); add(g, box(1.2, 0.7, 1), con, 5.9, 0.35, 4.8);
    add(g, cyl(0.04, 0.07, 7, 6), con, 6.6, 3.5, -6.6);
    const beacon = glow(0xff2a3a, 4); add(g, sph(0.12), beacon, 6.6, 7.05, -6.6); const bh = halo(g, 0xff2a3a, 2.5, 6.6, 7.05, -6.6, 0.6);
    const posts = [[-7.6, -7.6], [7.6, -7.6], [7.6, 7.6], [-7.6, 7.6]];
    posts.forEach(([x, z], k) => {
      add(g, cyl(0.04, 0.04, 3.2), con, x, 1.6, z);
      const [nx, nz] = posts[(k + 1) % 4];
      for (let i = 1; i < 16; i++) { const u = i / 16, m = glow([0xffd27a, 0xff7ab8, 0x7ad8ff][i % 3], 2.5); add(g, sph(0.06, 8, 6), m, L(x, nx, u), 3.2 - S(u * PI) * 0.9, L(z, nz, u)); fairy.push(m); }
    });
    const bokeh = motes(g, 320, 0xffc890, 0.9, 150, 4, 150, 0.5);
    envs.push({
      title: 'Rooftop Constellation', line: 'Ten thousand windows keep time with one small heart.', group: g,
      skyTop: 0x030414, skyHor: 0x1c1c52, fog: 0x0a0b22, fogD: 0.012, stars: 1, orb: { dir: [0.45, 0.6, -0.65], size: 0.045, color: 0xf2f4ff },
      key: 0xd8dcff, rim: 0x7a6cff, amb: 0x262a5c, rain: 0xb8c0ff, dress: 0xc9a8ff, umb: 0x9f7bff, moves: [5, 1, 2, 7], shots: [-1, 1, 6, 2], tile: 0.7, rainAmt: 0.7, wind: [0.06, -0.08],
      cam: (p, s) => { const e = ez(p), a = L(-1.2, 1.1, p); s.pos.set(S(a) * L(5.4, 6.6, e), L(5.0, 1.9, e), C(a) * L(5.4, 6.6, e)); s.tgt.set(0, L(1.0, 1.25, e), 0); s.fov = L(48, 40, e); },
      update: (_t, beat, pulse) => {
        towers.forEach((tw, i) => {
          const k = Math.max(0, S(beat * PI * 0.5 + tw.userData.ph)) * pulse;
          tw.scale.y = 1 + 0.22 * k; tw.position.y = (tw.userData.h * tw.scale.y) / 2;
          (tw.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.3 + 2.4 * k + (i % 9 === Math.floor(beat) % 9 ? 1.2 : 0);
        });
        fairy.forEach((m, i) => setGlow(m, (i + Math.floor(beat * 2)) % 4 === 0 ? 5 : 1.2));
        const on = beat % 1 < 0.35; setGlow(beacon, on ? 6 : 0.4); bh.material.opacity = on ? 0.7 : 0.08;
        (bokeh.material as THREE.PointsMaterial).opacity = 0.45 + pulse * 0.4;
      },
    });
  }

  // ---------- 7 · Lotus Mirror
  {
    const g = new THREE.Group(), leaf = new THREE.MeshStandardMaterial({ color: 0x14402c, roughness: 0.6, side: THREE.DoubleSide }), flowers: { o: THREE.Group; m: GM; h: THREE.Sprite }[] = [];
    for (let i = 0; i < 46; i++) {
      const a = R() * PI * 2, r = 2.4 + R() * 13, x = S(a) * r, z = C(a) * r, s = 0.35 + R() * 0.5;
      const pad = add(g, new THREE.CircleGeometry(s, 18, 0.3, PI * 2 - 0.6), leaf, x, 0.02, z); pad.rotation.set(-PI / 2, 0, R() * 6);
      if (i % 3 === 0) {
        const o = new THREE.Group(), m = glow(0xff9ac8, 1.6); o.position.set(x, 0.05, z);
        for (let k = 0; k < 10; k++) { const pt = add(o, new THREE.ConeGeometry(0.07, 0.3, 5), m, 0, 0.12, 0), ka = (k / 10) * PI * 2, tilt = k % 2 ? 0.5 : 1.0; pt.position.set(S(ka) * 0.1 * tilt, 0.13, C(ka) * 0.1 * tilt); pt.rotation.set(C(ka) * tilt, 0, -S(ka) * tilt); }
        add(o, sph(0.045, 8, 6), glow(0xffe27a, 3), 0, 0.1, 0);
        g.add(o); flowers.push({ o, m, h: halo(g, 0xff8ac0, 1.2, x, 0.25, z, 0.3) });
      }
    }
    const reed = dark(0x0e2a20, 0.9);
    for (let i = 0; i < 90; i++) { const a = R() * PI * 2, r = 9 + R() * 9, rd = add(g, cyl(0.012, 0.03, 1.6 + R() * 1.6, 4), reed, S(a) * r, 0.9, C(a) * r); rd.rotation.set((R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3); }
    const hill = dark(0x06120f, 1);
    for (let i = 0; i < 40; i++) { const a = (i / 40) * PI * 2; add(g, sph(9 + R() * 6, 12, 8), hill, S(a) * (52 + R() * 8), -2, C(a) * (52 + R() * 8)).scale.y = 0.55 + R() * 0.3; }
    for (let i = 0; i < 150; i++) { const a = R() * PI * 2, r = 30 + R() * 14, h = 5 + R() * 8; add(g, new THREE.ConeGeometry(1.1 + R() * 1.2, h, 6), hill, S(a) * r, h / 2, C(a) * r); }
    const fly = motes(g, 160, 0xd8ff7a, 0.16, 22, 3.2, 22, 0.3), a = fly.geometry.attributes.position.array as Float32Array, base = fly.userData.base as Float32Array;
    envs.push({
      title: 'Lotus Mirror', line: 'He steps closer. The moon pretends not to watch.', group: g,
      skyTop: 0x02100f, skyHor: 0x0f3a36, fog: 0x06201e, fogD: 0.022, stars: 0.9, orb: { dir: [0.25, 0.34, -0.92], size: 0.06, color: 0xf4fff0 },
      key: 0xe2fff0, rim: 0x5affc8, amb: 0x1c4a44, rain: 0xb8ffe8, dress: 0xf0e8e0, umb: 0xff9ac8, moves: [4, 3, 2, 1], shots: [-1, 7, 5, 8], rainAmt: 0.45, wind: [0.02, 0.05],
      boy: { x: 2.3, z: -0.6, yaw: -PI / 2 + 0.3, moves: [9], from: [7.5, -7], arrive: 0.5 },
      cam: (p, s) => { const e = ez(p); s.pos.set(L(-5.2, -1.6, e), L(0.55, 1.15, e), L(7.6, 4.6, e)); s.tgt.set(L(1.2, 0.6, e), L(1.5, 1.2, e), 0); s.fov = L(44, 36, e); },
      update: (t, beat, pulse) => {
        flowers.forEach((f, i) => {
          const k = Math.max(0, S(beat * PI * 0.5 - i * 0.8)) ** 3;
          f.o.scale.setScalar(1 + 0.9 * k + 0.2 * pulse); setGlow(f.m, 1.2 + 4 * k); f.h.material.opacity = 0.2 + 0.6 * k; f.o.rotation.y = t * 0.2 + i;
        });
        for (let i = 0; i < a.length; i += 3) { a[i] = base[i] + S(t * 0.5 + i) * 0.9; a[i + 1] = base[i + 1] + S(t * 0.8 + i * 2.1) * 0.4; a[i + 2] = base[i + 2] + C(t * 0.4 + i * 1.7) * 0.9; }
        fly.geometry.attributes.position.needsUpdate = true;
        (fly.material as THREE.PointsMaterial).opacity = 0.5 + 0.5 * pulse;
      },
    });
  }

  // ---------- 8 · After the Rain
  {
    const g = new THREE.Group(), hill = dark(0x1a1020, 1), bows: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < 26; i++) add(g, sph(10 + R() * 8, 14, 8), hill, -110 + i * 9 + R() * 4, -3, -70 - R() * 20).scale.y = 0.5 + R() * 0.4;
    [0xff3b4e, 0xff9a3a, 0xffe94a, 0x52e07a, 0x4aa8ff, 0x9a6cff].forEach((c, i) => {
      const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      add(g, new THREE.TorusGeometry(34 - i * 0.6, 0.3, 6, 96, PI), m, 10, -2, -58); bows.push(m);
    });
    const sun = halo(g, 0xffc060, 34, -14, 3, -90, 0.5); sun.material.fog = false;
    const wood = dark(0x2a1a1a, 0.7), iron = dark(0x14141c, 0.5);
    add(g, box(1.8, 0.07, 0.5), wood, -2.9, 0.48, -2.2); add(g, box(1.8, 0.45, 0.06), wood, -2.9, 0.82, -2.45);
    for (const x of [-3.7, -2.1]) add(g, box(0.07, 0.48, 0.5), iron, x, 0.24, -2.2);
    add(g, cyl(0.05, 0.08, 4, 8), iron, -4.3, 2, -2.6); const lamp = glow(0xffe0a8, 3); add(g, sph(0.18), lamp, -4.3, 4.1, -2.6); const lh = halo(g, 0xffd090, 3, -4.3, 4.1, -2.6, 0.5);
    const gold = motes(g, 380, 0xffd27a, 0.13, 30, 7, 30, 0.1), a = gold.geometry.attributes.position.array as Float32Array;
    const env: Env = {
      title: 'After the Rain', line: 'He offers his hand. The umbrella, free at last, dances above them.', group: g,
      skyTop: 0x241a4a, skyHor: 0xff9a5a, fog: 0x6a3a50, fogD: 0.014, stars: 0.15, orb: { dir: [-0.15, 0.045, -0.98], size: 0.07, color: 0xfff0c0 },
      key: 0xffe2b8, rim: 0xffa050, amb: 0x6a4460, rain: 0xffe6c0, dress: 0xff4d6d, umb: 0xffe2c4, moves: [6, 11, 11, 13], shots: [8, 7, 9, -1], waltz: [0.45, 0], girlYaw: 0.5, rainAmt: 0.6, wind: [0.04, 0.02],
      boy: { x: 0.9, z: 0, yaw: -PI / 2, moves: [9, 11, 11, 13] },
      cam: (p, s) => { const e = ez(p); s.pos.set(L(1.4, -1.5, e), L(1.4, 3.4, e), L(3.6, 11.5, e)); s.tgt.set(L(0.4, 0, e), L(1.3, 2.4, e), L(0, -6, e)); s.fov = L(38, 46, e); },
      update: (t, _beat, pulse, p) => {
        env.rainAmt = L(0.6, 0.07, ez(Math.min(1, p * 1.25)));
        bows.forEach((m, i) => (m.opacity = Math.max(0, p * 1.4 - 0.25 - i * 0.03) * 0.3 * (1 + pulse * 0.5)));
        sun.material.opacity = 0.3 + 0.35 * p + pulse * 0.12; sun.position.y = 3 + p * 6; sun.scale.setScalar(34 + pulse * 5);
        setGlow(lamp, 3 * (1 - p) + 0.3); lh.material.opacity = 0.5 * (1 - p);
        for (let i = 0; i < a.length; i += 3) { a[i + 1] += 0.004 + (i % 4) * 0.002; a[i] += S(t + i) * 0.003; if (a[i + 1] > 7) a[i + 1] = 0.1; }
        gold.geometry.attributes.position.needsUpdate = true;
        (gold.material as THREE.PointsMaterial).opacity = p * (0.5 + 0.5 * pulse);
      },
    };
    envs.push(env);
  }
  return envs;
}
