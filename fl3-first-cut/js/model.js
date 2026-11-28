// Procedural FL3: every part built from primitives in code. Units: metres, crank axis at the origin.
// +X towards the blower (front), +Y up, +Z the hot side (pump, exhaust), -Z the cold side (cowl).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { MODELLED, PUBLISHED } from './sim.js';

const DEG = Math.PI / 180;
export const CYL_X = [0.15, 0, -0.15];
export const R = PUBLISHED.stroke / 2, ROD = MODELLED.rod, BORE_R = PUBLISHED.bore / 2;
export const CROWN = 0.065;          // pin to crown, modelled
export const DECK = R + ROD + CROWN + 0.002;
const CAM_Y = 0.055, CAM_Z = 0.095, PUSH_Z = 0.095, ROCK_Y = 0.445, ROCK_Z = 0.0475;
export const L_MAIN = 0, L_FX = 1, L_HOT = 4;

// shared uniforms injected into every material
export const U = { uCut: { value: 0 }, uHatch: { value: 7 } };
export const CUT_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

function enhance(mat, { grain = 0, clip = false } = {}) {
  mat.userData.clip = clip;
  if (clip) mat.side = THREE.DoubleSide;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = U.uCut; sh.uniforms.uHatch = U.uHatch; sh.uniforms.uGrain = { value: grain };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vGP; uniform float uCut; uniform float uHatch; uniform float uGrain;
float h3(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float gN = vn(vGP*900.0)*0.6 + vn(vGP*170.0)*0.4;
diffuseColor.rgb *= 1.0 + (gN-0.5)*0.10*uGrain;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (gN-0.5)*0.22*uGrain, 0.04, 1.0);`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
if (uCut > 0.5 && !gl_FrontFacing) {
  float hh = mod(gl_FragCoord.x + gl_FragCoord.y, uHatch);
  gl_FragColor = vec4(hh < uHatch*0.34 ? vec3(0.90,0.42,0.20) : vec3(0.975,0.90,0.84), 1.0);
}`);
  };
  mat.customProgramCacheKey = () => 'fl3' + (clip ? 'c' : '') + grain;
  return mat;
}

export function makeMaterials() {
  const P = (o, e) => enhance(new THREE.MeshPhysicalMaterial(o), e);
  const S = (o, e) => enhance(new THREE.MeshStandardMaterial(o), e);
  const celeste = new THREE.Color('#3F9DD0');
  const mats = {
    cast: P({ color: celeste, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.32 }, { grain: 1.0, clip: true }),
    castKeep: P({ color: celeste, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.32 }, { grain: 1.0 }),
    sheet: P({ color: celeste, roughness: 0.26, clearcoat: 0.85, clearcoatRoughness: 0.12 }, { grain: 0.35, clip: true }),
    sheetKeep: P({ color: celeste, roughness: 0.26, clearcoat: 0.85, clearcoatRoughness: 0.12 }, { grain: 0.35 }),
    steel: S({ color: '#b9b7b1', metalness: 1, roughness: 0.32 }, { grain: 0.5 }),
    steelDark: S({ color: '#6d6b67', metalness: 0.9, roughness: 0.45 }, { grain: 0.6 }),
    alloy: S({ color: '#cfccc3', metalness: 0.85, roughness: 0.42 }, { grain: 0.7 }),
    pump: S({ color: '#c9c8c2', metalness: 0.75, roughness: 0.3 }, { grain: 0.6 }),
    copper: S({ color: '#c8733a', metalness: 1, roughness: 0.28 }),
    exhaust: S({ color: '#24201d', metalness: 0.35, roughness: 0.78 }, { grain: 1.4 }),
    black: P({ color: '#151413', roughness: 0.35, clearcoat: 0.6 }, { grain: 0.5 }),
    rubber: S({ color: '#1e1d1c', roughness: 0.85 }),
    stand: P({ color: '#E0561C', roughness: 0.48, clearcoat: 0.5, clearcoatRoughness: 0.3 }, { grain: 0.8 }),
    brass: S({ color: '#b89a55', metalness: 1, roughness: 0.35 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#d8e4dc', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false }),
    oil: new THREE.MeshStandardMaterial({ color: '#6b4a12', roughness: 0.2, transparent: true, opacity: 0.85 }),
  };
  for (const k of ['cast', 'castKeep', 'sheet', 'sheetKeep', 'stand']) mats[k].envMapIntensity = 0.5;
  return mats;
}

// ---------- helpers ----------
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
function cylX(r, len, x = 0, y = 0, z = 0, seg = 28, r2 = r) { return new THREE.CylinderGeometry(r2, r, len, seg).rotateZ(-Math.PI / 2).translate(x, y, z); }
function cylY(r, len, x = 0, y = 0, z = 0, seg = 28, r2 = r) { return new THREE.CylinderGeometry(r2, r, len, seg).translate(x, y, z); }
function tube(points, r, seg = 48, closed = false, rs = 8) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'catmullrom', 0.3), seg, r, rs, closed); }
function merge(list) { return mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g), false); }
function mesh(geo, mat, name) { const m = new THREE.Mesh(geo, mat); m.name = name || ''; m.castShadow = true; m.receiveShadow = true; return m; }

function finShape() { // barrel fin, flattened where the neighbours meet
  const r = 0.088, cut = CYL_X[0] / 2 - 0.0015, a = Math.acos(cut / r);
  const s = new THREE.Shape();
  s.moveTo(cut, -Math.sqrt(r * r - cut * cut));
  s.lineTo(cut, Math.sqrt(r * r - cut * cut));
  s.absarc(0, 0, r, a, Math.PI - a, false);
  s.lineTo(-cut, -Math.sqrt(r * r - cut * cut));
  s.absarc(0, 0, r, Math.PI + a, 2 * Math.PI - a, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.055, 0, Math.PI * 2, true); s.holes.push(hole);
  return s;
}
function annulus(ro, ri, h) {
  const s = new THREE.Shape(); s.absarc(0, 0, ro, 0, Math.PI * 2, false);
  const p = new THREE.Path(); p.absarc(0, 0, ri, 0, Math.PI * 2, true); s.holes.push(p);
  return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 40 }).rotateX(-Math.PI / 2);
}
function rectTube(w, h, t, len) { // hollow box section along X: w along Z, h along Y
  const s = new THREE.Shape(); s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
  const p = new THREE.Path(); p.moveTo(-w / 2 + t, -h / 2 + t); p.lineTo(-w / 2 + t, h / 2 - t); p.lineTo(w / 2 - t, h / 2 - t); p.lineTo(w / 2 - t, -h / 2 + t); p.lineTo(-w / 2 + t, -h / 2 + t); s.holes.push(p);
  return new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-len / 2, 0, 0);
}
function helix(r, turns, len, wire) {
  const pts = []; const n = turns * 24;
  for (let i = 0; i <= n; i++) { const a = i / 24 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, i / n * len, Math.sin(a) * r)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, wire, 6, false);
}
function textTexture(lines, { w = 1024, h = 256, bg = null, color = '#151413', font = '600 92px Archivo, Arial', border = false, align = 'center' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  if (border) { g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44); }
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  lines.forEach((l, i) => { g.font = l.font || font; g.fillText(l.text, w / 2, h * (i + 1) / (lines.length + 1)); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function beltPath(circles, n = 64) { // convex hull of sampled circles, in the YZ plane
  const pts = [];
  for (const c of circles) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([c.y + Math.cos(a) * c.r, c.z + Math.sin(a) * c.r]); }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  // resample evenly
  const out = []; let total = 0; const seg = [];
  for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(d); total += d; }
  const N = 220; let si = 0, acc = 0;
  for (let k = 0; k < N; k++) {
    const t = k / N * total; while (acc + seg[si] < t) { acc += seg[si]; si++; }
    const a = hull[si], b = hull[(si + 1) % hull.length]; const u = (t - acc) / seg[si];
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}

// ---------- the build ----------
export function buildEngine(M) {
  const root = new THREE.Group(); root.name = 'fl3';
  const engine = new THREE.Group(); engine.name = 'engine'; root.add(engine); // rocks on its mounts
  const parts = {};        // explode groups
  const hot = [];          // parts lying wholly in the removed half
  const castings = [];     // barrels and heads for the airflow ramp
  const P = (name, label, it, offset, anchor) => {
    const g = new THREE.Group(); g.name = name; engine.add(g);
    parts[name] = { group: g, label, it, offset: new THREE.Vector3(...offset), anchor: new THREE.Vector3(...anchor) };
    return g;
  };

  // crankcase: hollow so the cutaway shows a wall, not a block
  const cc = P('crankcase', null, null, [0, 0, 0], [0, 0, 0]);
  const ccLen = 0.51, ccTop = 0.14, ccBot = -0.09, ccW = 0.25;
  cc.add(mesh(rectTube(ccW, ccTop - ccBot, 0.012, ccLen).translate(0, (ccTop + ccBot) / 2, 0), M.cast, 'crankcase'));
  const ends = [box(0.012, ccTop - ccBot, ccW, ccLen / 2 - 0.006, (ccTop + ccBot) / 2, 0), box(0.012, ccTop - ccBot, ccW, -ccLen / 2 + 0.006, (ccTop + ccBot) / 2, 0)];
  // top deck with bores, main-bearing ribs and feet
  const deck = new THREE.Shape(); deck.moveTo(-ccLen / 2, -ccW / 2); deck.lineTo(ccLen / 2, -ccW / 2); deck.lineTo(ccLen / 2, ccW / 2); deck.lineTo(-ccLen / 2, ccW / 2);
  for (const x of CYL_X) { const h = new THREE.Path(); h.absarc(x, 0, 0.056, 0, Math.PI * 2, true); deck.holes.push(h); }
  const deckG = new THREE.ExtrudeGeometry(deck, { depth: 0.014, bevelEnabled: false, curveSegments: 32 }).rotateX(Math.PI / 2).translate(0, ccTop + 0.007, 0);
  const ribs = [];
  for (const x of [-0.235, -0.075, 0.075, 0.235]) for (const s of [-1, 1]) { ribs.push(box(0.014, 0.17, 0.012, x, 0.02, s * (ccW / 2 + 0.006))); }
  for (const x of [-0.19, 0.19]) for (const s of [-1, 1]) ribs.push(box(0.07, 0.022, 0.05, x, -0.012, s * (ccW / 2 + 0.024)));
  cc.add(mesh(merge([...ends, deckG, ...ribs]), M.cast, 'crankcase-deck'));
  // flywheel housing bell and timing case
  cc.add(mesh(merge([cylX(0.205, 0.035, -ccLen / 2 - 0.0175, 0.0, 0, 48), cylX(0.13, 0.02, -ccLen / 2 + 0.01, 0, 0, 40)]), M.cast, 'bell'));
  const tc = P('timing', 'Timing case', 'scatola distribuzione', [0.1, 0, 0], [0.285, 0.08, -0.08]);
  tc.add(mesh(merge([box(0.045, 0.27, 0.24, ccLen / 2 + 0.0225, 0.02, 0), cylX(0.06, 0.03, ccLen / 2 + 0.06, 0, 0, 32)]), M.cast, 'timing'));

  // sump
  const sump = P('sump', 'Oil sump', 'coppa dell’olio', [0, -0.15, 0], [0.12, -0.15, -0.1]);
  const sg = new THREE.Shape(); sg.moveTo(-0.115, 0); sg.lineTo(0.115, 0); sg.lineTo(0.095, -0.1); sg.lineTo(-0.095, -0.1); sg.lineTo(-0.115, 0);
  const sh = new THREE.Path(); sh.moveTo(-0.105, 0.0001); sh.lineTo(-0.087, -0.09); sh.lineTo(0.087, -0.09); sh.lineTo(0.105, 0.0001); sh.lineTo(-0.105, 0.0001); sg.holes.push(sh);
  const sumpG = new THREE.ExtrudeGeometry(sg, { depth: 0.44, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-0.24, ccBot, 0);
  const sumpFins = []; for (let x = -0.2; x <= 0.17; x += 0.046) sumpFins.push(box(0.006, 0.08, 0.2, x, ccBot - 0.05, 0));
  sump.add(mesh(merge([sumpG, box(0.44, 0.008, 0.18, -0.02, ccBot - 0.096, 0), box(0.008, 0.1, 0.21, -0.24, ccBot - 0.05, 0), box(0.008, 0.1, 0.21, 0.2, ccBot - 0.05, 0), ...sumpFins, cylY(0.012, 0.016, 0.1, ccBot - 0.104, 0.05, 6)]), M.cast, 'sump'));

  // barrels, heads, rocker covers, studs
  const fin = new THREE.ExtrudeGeometry(finShape(), { depth: 0.003, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2);
  const barrels = P('barrels', 'Cylinder barrel', 'cilindro alettato', [0, 0.11, 0], [-0.15, 0.25, -0.088]);
  const heads = P('heads', 'Cylinder head', 'testata', [0, 0.23, 0], [0, 0.39, -0.09]);
  const covers = P('covers', 'Rocker cover', 'coperchio bilancieri', [0, 0.36, 0], [0.15, 0.452, -0.02]);
  const studs = P('studs', null, null, [0, 0.23, 0], [0, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const x = CYL_X[i];
    const fl = [annulus(0.056, BORE_R, DECK - ccTop).translate(x, ccTop, 0)];
    for (let y = ccTop + 0.016; y < DECK - 0.008; y += 0.0094) fl.push(fin.clone().translate(x, y, 0));
    const b = mesh(merge(fl), M.cast, 'barrel' + (i + 1)); b.userData.cyl = i; barrels.add(b); castings.push(b);
    const hl = [box(0.118, 0.088, 0.13, x, DECK + 0.044, 0)];
    for (let y = DECK + 0.01; y < DECK + 0.085; y += 0.0105) hl.push(box(0.145, 0.003, 0.176, x, y, 0));
    hl.push(box(0.034, 0.03, 0.024, x + 0.022, DECK + 0.05, 0.096)); // exhaust port boss
    hl.push(box(0.034, 0.03, 0.024, x - 0.022, DECK + 0.06, -0.096)); // intake port boss
    const h = mesh(merge(hl), M.cast, 'head' + (i + 1)); h.userData.cyl = i; heads.add(h); castings.push(h);
    covers.add(mesh(merge([box(0.124, 0.05, 0.125, x, DECK + 0.115, 0.043), box(0.13, 0.006, 0.131, x, DECK + 0.091, 0.043), cylY(0.008, 0.012, x, DECK + 0.146, 0.08, 12)]), M.cast, 'cover' + (i + 1)));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const st = mesh(merge([cylY(0.0045, DECK + 0.1 - ccTop, x + sx * 0.06, (DECK + 0.1 + ccTop) / 2, sz * 0.071, 8), cylY(0.008, 0.009, x + sx * 0.06, DECK + 0.096, sz * 0.071, 6)]), M.steel, 'stud');
      studs.add(st); if (sz > 0) hot.push(st);
    }
  }

  // moving internals
  const crank = P('crank', 'Crankshaft', 'albero motore', [0, 0, 0], [-0.075, -0.06, 0.02]);
  const crankG = new THREE.Group(); crank.add(crankG);
  const cl = [cylX(0.032, 0.78, 0.04, 0, 0, 24)];
  const pinR = 0.03;
  for (let i = 0; i < 3; i++) {
    const x = CYL_X[i], ang = 240 * i * DEG;
    const g = [];
    for (const s of [-1, 1]) {
      const wx = x + s * 0.034;
      g.push(box(0.014, R + 0.04, 0.072, wx, R / 2 - 0.005, 0));
      g.push(cylX(0.04, 0.014, wx, R, 0, 24));
      g.push(new THREE.CylinderGeometry(0.088, 0.088, 0.016, 32, 1, false, 0, Math.PI).rotateZ(-Math.PI / 2).translate(wx, -0.005, 0));
    }
    g.push(cylX(pinR, 0.054, x, R, 0, 24));
    const w = merge(g).rotateX(ang); // pin for cylinder i at +240 i deg in the crank frame
    cl.push(w);
  }
  crankG.add(mesh(merge(cl), M.steel, 'crankshaft'));
  // crank pulley (rotates with crank), with spokes so the motion reads
  const pulley = merge([cylX(0.082, 0.026, 0.425, 0, 0, 48), cylX(0.03, 0.05, 0.4, 0, 0, 20), ...[0, 1, 2, 3].map(k => box(0.028, 0.012, 0.15, 0.412, 0, 0).rotateX(k * Math.PI / 4))]);
  crankG.add(mesh(pulley, M.steelDark, 'crank-pulley'));

  const fly = P('flywheel', 'Flywheel', 'volano', [-0.2, 0, 0], [-0.32, 0.16, -0.08]);
  const flyG = new THREE.Group(); fly.add(flyG);
  const teeth = []; for (let k = 0; k < 96; k++) teeth.push(box(0.022, 0.009, 0.006, -0.325, 0.191, 0).rotateX(k / 96 * Math.PI * 2));
  flyG.add(mesh(merge([cylX(0.186, 0.042, -0.32, 0, 0, 64), cylX(0.06, 0.05, -0.32, 0, 0, 24)]), M.steelDark, 'flywheel'));
  flyG.add(mesh(merge([cylX(0.19, 0.02, -0.325, 0, 0, 96), ...teeth]), M.steel, 'ring-gear'));
  flyG.add(mesh(merge([0, 1, 2, 3, 4, 5].map(k => cylX(0.01, 0.046, -0.32, 0.12, 0, 10).rotateX(k * Math.PI / 3))), M.black, 'fly-bolts'));

  const pistons = [], rods = [];
  const pist = P('pistons', 'Piston', 'pistone', [0, 0.06, 0], [0.15, 0.3, 0.02]);
  const rodsG = P('rods', 'Connecting rod', 'biella', [0, 0, 0], [0, 0.12, 0.02]);
  const pProfile = [[0, 0.050], [0.012, 0.050], [0.022, 0.054], [0.027, CROWN], [BORE_R - 0.0005, CROWN], [BORE_R - 0.0005, -0.018], [0.039, -0.018], [0.039, 0.04], [0.0, 0.04]].map(p => new THREE.Vector2(p[0], p[1]));
  const pistonG = new THREE.LatheGeometry(pProfile, 40);
  const ringsG = merge([0.057, 0.049, 0.041].map(y => cylY(BORE_R + 0.0001, 0.0022, 0, y, 0, 40)));
  const gpinG = cylX(0.013, 0.07, 0, 0, 0, 16);
  const rodG = merge([box(0.013, ROD - 0.05, 0.02, 0, -ROD / 2, 0), cylX(0.019, 0.026, 0, 0, 0, 20), cylX(0.037, 0.028, 0, -ROD, 0, 28), box(0.028, 0.016, 0.096, 0, -ROD - 0.012, 0), cylX(0.005, 0.03, 0, -ROD - 0.012, 0.04, 6), cylX(0.005, 0.03, 0, -ROD - 0.012, -0.04, 6)]);
  for (let i = 0; i < 3; i++) {
    const pg = new THREE.Group(); pg.position.x = CYL_X[i];
    pg.add(mesh(pistonG, M.alloy, 'piston'), mesh(ringsG, M.steelDark, 'rings'), mesh(gpinG, M.steel, 'gudgeon'));
    pist.add(pg); pistons.push(pg);
    const rg = new THREE.Group(); rg.position.x = CYL_X[i]; rg.add(mesh(rodG, M.steel, 'rod')); rodsG.add(rg); rods.push(rg);
  }

  // camshaft and valve gear
  const camP = P('cam', 'Camshaft', 'albero a camme', [0, -0.02, 0.15], [-0.05, CAM_Y, CAM_Z]);
  const camG = new THREE.Group(); camG.position.set(0, CAM_Y, CAM_Z); camP.add(camG);
  const lobeShape = (dur) => {
    const s = new THREE.Shape(); const n = 72;
    for (let k = 0; k <= n; k++) {
      const a = k / n * Math.PI * 2 - Math.PI; const half = dur / 4 * DEG; // cam degrees
      let r = 0.017; if (Math.abs(a) < half) { const u = (a + half) / (2 * half); r += MODELLED.valveLift * Math.sin(Math.PI * u) ** 2; }
      const x = Math.sin(a) * r, y = Math.cos(a) * r; k ? s.lineTo(x, y) : s.moveTo(x, y);
    }
    return s;
  };
  const exDur = MODELLED.evc - MODELLED.evo, inDur = MODELLED.ivc - MODELLED.ivo;
  const exPeak = (MODELLED.evo + MODELLED.evc) / 2, inPeak = (MODELLED.ivo + MODELLED.ivc) / 2;
  const lobes = [cylX(0.012, 0.7, 0, 0, 0, 16)];
  const valves = [];
  for (let i = 0; i < 3; i++) for (const kind of ['in', 'ex']) {
    const vx = CYL_X[i] + (kind === 'ex' ? 0.022 : -0.022);
    const peak = (240 * i + (kind === 'ex' ? exPeak : inPeak)) / 2;
    lobes.push(new THREE.ExtrudeGeometry(lobeShape(kind === 'ex' ? exDur : inDur), { depth: 0.014, bevelEnabled: false }).rotateY(Math.PI / 2).translate(vx - 0.007, 0, 0).rotateX(peak * DEG));
    valves.push({ i, kind, x: vx });
  }
  camG.add(mesh(merge(lobes), M.steel, 'camshaft')); hot.push(camG.children[0]);

  const gear = P('valvegear', 'Rocker and valve', 'bilanciere e valvola', [0, 0.23, 0], [-0.172, ROCK_Y, 0.0]);
  const push = P('pushrods', 'Pushrod', 'asta punteria', [0, 0.04, 0.17], [-0.128, 0.3, PUSH_Z]);
  const tappetG = cylY(0.0085, 0.03, 0, 0.015, 0, 14);
  const pushG = merge([cylY(0.0035, ROCK_Y - 0.004 - (CAM_Y + 0.047), 0, (ROCK_Y - 0.004 + CAM_Y + 0.047) / 2, 0, 8), new THREE.SphereGeometry(0.005, 8, 6).translate(0, ROCK_Y - 0.004, 0)]);
  const rockerG = merge([box(0.012, 0.01, 0.105, 0, 0, 0), cylX(0.009, 0.016, 0, 0, 0, 14), cylY(0.004, 0.012, 0, -0.004, -ROCK_Z, 8), cylY(0.004, 0.012, 0, -0.004, ROCK_Z, 8)]);
  const valveG = merge([cylY(0.0042, 0.12, 0, 0.06, 0, 10), cylY(0.019, 0.003, 0, 0.0015, 0, 28, 0.012), cylY(0.0095, 0.004, 0, 0.11, 0, 16)]);
  const springG = helix(0.0085, 5, 1, 0.0013);
  const shaftG = merge(CYL_X.map(x => cylX(0.0055, 0.13, x, ROCK_Y, ROCK_Z, 10)));
  gear.add(mesh(shaftG, M.steelDark, 'rocker-shafts'));
  for (const v of valves) {
    v.tappet = mesh(tappetG, M.steel, 'tappet'); push.add(v.tappet); hot.push(v.tappet);
    v.push = mesh(pushG, M.steel, 'pushrod'); push.add(v.push); hot.push(v.push);
    v.rocker = mesh(rockerG, M.steelDark, 'rocker'); v.rocker.position.set(v.x, ROCK_Y, ROCK_Z); gear.add(v.rocker);
    v.valve = mesh(valveG, M.steel, 'valve'); gear.add(v.valve);
    v.spring = mesh(springG, M.steelDark, 'spring'); gear.add(v.spring);
    v.tappet.position.set(v.x, 0, PUSH_Z); v.push.position.set(v.x, 0, PUSH_Z);
  }

  // combustion glow (cutaway)
  const glows = [];
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ff8a3a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 3; i++) { const g = new THREE.Mesh(cylY(BORE_R - 0.001, 1, 0, 0.5, 0, 32), glowMat.clone()); g.position.x = CYL_X[i]; g.layers.set(L_FX); g.visible = false; engine.add(g); glows.push(g); }

  // blower: housing, rotor, stator, guard and pulley
  const BY = 0.29, BZ = -0.1, BR = 0.135;
  const blower = P('blower', 'Cooling blower', 'ventola di raffreddamento', [0.24, 0, 0], [0.35, BY + BR, BZ]);
  const housing = new THREE.CylinderGeometry(BR, BR, 0.1, 64, 1, true).rotateZ(-Math.PI / 2).translate(0.35, BY, BZ);
  const lip = cylX(BR + 0.008, 0.008, 0.398, BY, BZ, 64);
  const lipIn = cylX(BR + 0.006, 0.006, 0.302, BY, BZ, 64);
  const backPlate = new THREE.RingGeometry(0.04, BR, 64).rotateY(Math.PI / 2).translate(0.3, BY, BZ);
  const hsg = mesh(merge([housing, lip, lipIn]), M.sheet, 'blower-housing'); hsg.material = M.sheet; blower.add(hsg);
  const bp = mesh(backPlate, M.sheet); blower.add(bp);
  const stator = []; for (let k = 0; k < 9; k++) stator.push(box(0.03, 0.004, BR - 0.045, 0.318, 0, (BR + 0.045) / 2).rotateX(k / 9 * Math.PI * 2 + 0.2).translate(0, BY, BZ));
  stator.push(cylX(0.045, 0.05, 0.32, BY, BZ, 24));
  blower.add(mesh(merge(stator), M.castKeep, 'stator'));
  const rotor = new THREE.Group(); rotor.position.set(0.37, BY, BZ); blower.add(rotor);
  const blades = [cylX(0.048, 0.04, 0, 0, 0, 24)];
  for (let k = 0; k < MODELLED.blowerBlades; k++) blades.push(box(0.034, 0.003, BR - 0.058, 0, 0, (BR + 0.04) / 2).rotateZ(0.45).rotateX(k / MODELLED.blowerBlades * Math.PI * 2));
  rotor.add(mesh(merge(blades), M.steel, 'rotor'));
  const bpul = merge([cylX(0.052, 0.024, 0.06, 0, 0, 40), cylX(0.016, 0.06, 0.035, 0, 0, 12), ...[0, 1, 2].map(k => box(0.02, 0.01, 0.09, 0.05, 0, 0).rotateX(k * Math.PI / 3))]);
  rotor.add(mesh(bpul, M.steelDark, 'blower-pulley'));
  const guardP = P('guard', 'Wire guard', 'griglia di protezione', [0.4, 0, 0], [0.41, BY + 0.09, BZ + 0.08]);
  const gl = [];
  for (const r of [0.04, 0.07, 0.1, 0.13]) gl.push(new THREE.TorusGeometry(r, 0.0018, 6, 64).rotateY(Math.PI / 2).translate(0.41, BY, BZ));
  for (let k = 0; k < 12; k++) gl.push(box(0.0035, 0.0035, BR - 0.02, 0.41, 0, (BR + 0.02) / 2).rotateX(k / 12 * Math.PI * 2).translate(0, BY, BZ));
  guardP.add(mesh(merge(gl), M.black, 'guard'));

  // dynamo
  const DY = 0.215, DZ = 0.195;
  const dyn = P('dynamo', 'Dynamo', 'dinamo', [0.08, 0.04, 0.16], [0.3, DY + 0.05, DZ]);
  dyn.add(mesh(merge([cylX(0.05, 0.19, 0.3, DY, DZ, 32), cylX(0.054, 0.012, 0.21, DY, DZ, 32), cylX(0.054, 0.012, 0.39, DY, DZ, 32), box(0.05, 0.02, 0.03, 0.3, DY - 0.055, DZ - 0.02)]), M.black, 'dynamo'));
  dyn.add(mesh(box(0.06, 0.01, 0.07, 0.3, DY - 0.062, DZ - 0.035), M.castKeep));
  const dynRot = new THREE.Group(); dynRot.position.set(0.425, DY, DZ); dyn.add(dynRot);
  dynRot.add(mesh(merge([cylX(0.036, 0.024, 0, 0, 0, 32), ...[0, 1].map(k => box(0.026, 0.008, 0.06, -0.006, 0, 0).rotateX(k * Math.PI / 2))]), M.steelDark, 'dynamo-pulley'));
  hot.push(...dyn.children);

  // V-belt
  const beltG = new THREE.Group(); engine.add(beltG);
  const path = beltPath([{ y: 0, z: 0, r: 0.083 }, { y: DY, z: DZ, r: 0.037 }, { y: BY, z: BZ, r: 0.053 }]);
  const beltShape = new THREE.Shape(); beltShape.moveTo(-0.006, 0); beltShape.lineTo(0.006, 0); beltShape.lineTo(0.004, 0.009); beltShape.lineTo(-0.004, 0.009);
  const beltCurve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(0.425, p[0], p[1])), true);
  const belt = mesh(new THREE.TubeGeometry(beltCurve, 220, 0.0055, 5, true), M.rubber, 'belt'); beltG.add(belt);

  // air cowl along the cold side, with stencil
  const cowl = P('cowl', 'Air cowl', 'convogliatore d’aria', [0, 0.02, -0.24], [-0.05, 0.42, -0.19]);
  const cw = [box(0.55, 0.32, 0.003, 0.025, 0.285, -0.19), box(0.55, 0.003, 0.1, 0.025, 0.446, -0.14), box(0.55, 0.003, 0.1, 0.025, 0.125, -0.14), box(0.003, 0.32, 0.1, -0.25, 0.285, -0.14),
    box(0.006, 0.006, 0.105, 0.025, 0.446, -0.14).translate(0, 0, 0), box(0.55, 0.008, 0.008, 0.025, 0.445, -0.19), box(0.55, 0.008, 0.008, 0.025, 0.126, -0.19)];
  cowl.add(mesh(merge(cw), M.sheetKeep, 'cowl'));
  const sten = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshStandardMaterial({ map: textTexture([{ text: 'FL3 · raffreddato ad aria' }], { font: '700 86px "Archivo", Arial', color: '#121110' }), transparent: true, roughness: 0.6 }));
  sten.position.set(0.0, 0.33, -0.1925); sten.rotation.y = Math.PI; cowl.add(sten);
  const louv = []; for (let k = 0; k < 7; k++) louv.push(box(0.05, 0.004, 0.006, -0.18 + k * 0.06, 0.2, -0.193));
  cowl.add(mesh(merge(louv), M.sheetKeep));

  // name plate on the cold side of the crankcase
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.05), new THREE.MeshStandardMaterial({ map: textTexture([{ text: 'MOTORE DIESEL · FL3', font: '700 74px "Archivo", Arial' }, { text: 'CV 39 · 2200 g/min', font: '500 64px "IBM Plex Mono", monospace' }], { w: 1024, h: 400, bg: '#d9d4c6', color: '#1c1b19', border: true }), metalness: 0.6, roughness: 0.4 }));
  plate.position.set(-0.04, 0.03, -ccW / 2 - 0.0015); plate.rotation.y = Math.PI; cc.add(plate);
  cc.add(mesh(merge([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => cylX(0.003, 0.004, 0, 0, 0, 8).rotateY(Math.PI / 2).translate(-0.04 + a * 0.06, 0.03 + b * 0.02, -ccW / 2 - 0.002))), M.brass));

  // intake runners and oil-bath air cleaner
  const intake = P('intake', 'Oil-bath air cleaner', 'filtro aria a bagno d’olio', [0, 0.06, -0.24], [-0.27, 0.5, -0.27]);
  const il = [cylX(0.02, 0.36, -0.03, 0.478, -0.105, 20)];
  for (const x of CYL_X) il.push(tube([[x - 0.022, DECK + 0.06, -0.108], [x - 0.022, DECK + 0.1, -0.11], [x - 0.022, 0.478, -0.105]], 0.013, 16));
  il.push(tube([[-0.21, 0.478, -0.105], [-0.24, 0.478, -0.13], [-0.27, 0.47, -0.2], [-0.27, 0.44, -0.25]], 0.02, 24));
  intake.add(mesh(merge(il), M.castKeep, 'intake'));
  intake.add(mesh(merge([cylY(0.07, 0.3, -0.27, 0.27, -0.28, 40), cylY(0.074, 0.012, -0.27, 0.12, -0.28, 40), cylY(0.074, 0.012, -0.27, 0.42, -0.28, 40), box(0.03, 0.04, 0.05, -0.27, 0.2, -0.205)]), M.black, 'cleaner'));
  intake.add(mesh(merge([cylY(0.02, 0.07, -0.27, 0.455, -0.28, 16), cylY(0.05, 0.008, -0.27, 0.495, -0.28, 32), cylY(0.05, 0.008, -0.27, 0.585, -0.28, 32), cylY(0.016, 0.03, -0.27, 0.605, -0.28, 16)]), M.steelDark, 'precleaner-frame'));
  intake.add(new THREE.Mesh(cylY(0.046, 0.085, -0.27, 0.54, -0.28, 32), M.glass));
  intake.add(new THREE.Mesh(cylY(0.043, 0.02, -0.27, 0.508, -0.28, 32), M.oil));

  // exhaust: manifold, stack, silencer, flapper cap
  const ex = P('exhaust', 'Exhaust and silencer', 'scarico e marmitta', [0, 0.06, 0.3], [-0.02, 0.66, 0.22]);
  const el = [cylX(0.022, 0.37, 0, 0.375, 0.145, 20)];
  for (const x of CYL_X) el.push(tube([[x + 0.022, DECK + 0.05, 0.1], [x + 0.022, DECK + 0.052, 0.125], [x + 0.02, 0.375, 0.145]], 0.014, 12));
  el.push(tube([[-0.02, 0.375, 0.145], [-0.02, 0.4, 0.175], [-0.02, 0.45, 0.19], [-0.02, 0.55, 0.19]], 0.025, 24));
  el.push(cylY(0.026, 0.42, -0.02, 0.76, 0.19, 24), cylY(0.058, 0.2, -0.02, 0.66, 0.19, 32), cylY(0.04, 0.02, -0.02, 0.77, 0.19, 32, 0.058), cylY(0.04, 0.02, -0.02, 0.55, 0.19, 32, 0.026));
  el.push(box(0.012, 0.03, 0.05, -0.02, 0.42, 0.205)); // clamp
  const exM = mesh(merge(el), M.exhaust, 'exhaust'); ex.add(exM);
  const capPivot = new THREE.Group(); capPivot.position.set(-0.048, 0.972, 0.19); ex.add(capPivot);
  capPivot.add(mesh(merge([cylY(0.032, 0.004, 0.028, 0.002, 0, 28), box(0.01, 0.006, 0.012, 0.0, 0.002, 0), box(0.02, 0.015, 0.003, 0.06, -0.006, 0)]), M.exhaust, 'flapper'));
  hot.push(exM, capPivot.children[0]);

  // injection pump, governor and lever, lines, injectors, filters
  const pump = P('pump', 'Injection pump', 'pompa d’iniezione', [0, 0, 0.2], [0.0, 0.16, 0.2]);
  const PY = 0.095, PZ = 0.178;
  pump.add(mesh(merge([box(0.24, 0.085, 0.05, 0, PY, PZ), box(0.25, 0.008, 0.06, 0, PY - 0.045, PZ), ...[-0.06, 0, 0.06].map(x => cylY(0.009, 0.04, x, PY + 0.06, PZ, 12)), ...[-0.06, 0, 0.06].map(x => cylY(0.012, 0.01, x, PY + 0.045, PZ, 6)), cylX(0.03, 0.02, 0.13, PY, PZ, 20)]), M.pump, 'pump'));
  pump.add(mesh(merge([box(0.06, 0.12, 0.068, -0.15, PY + 0.01, PZ), cylX(0.034, 0.03, -0.175, PY + 0.01, PZ, 20)]), M.pump, 'governor'));
  const lever = new THREE.Group(); lever.position.set(-0.15, PY + 0.07, PZ + 0.036); pump.add(lever);
  lever.add(mesh(merge([cylX(0.007, 0.012, 0, 0, 0, 10).rotateY(Math.PI / 2), box(0.008, 0.07, 0.006, 0, 0.032, 0.004), new THREE.SphereGeometry(0.007, 10, 8).translate(0, 0.066, 0.004)]), M.steel, 'governor-lever'));
  lever.add(mesh(new THREE.SphereGeometry(0.0072, 10, 8).translate(0, 0.066, 0.004), M.stand));
  hot.push(...pump.children.filter(c => c.isMesh), lever.children[0], lever.children[1]);

  const lines = P('lines', null, null, [0, 0.08, 0.22], [0, 0, 0]);
  const injP = P('injectors', 'Injector', 'iniettore', [0, 0.32, 0.06], [0.15, 0.49, 0.035]);
  const lineList = [];
  for (let i = 0; i < 3; i++) {
    const x0 = [-0.06, 0, 0.06][2 - i], x1 = CYL_X[i];
    lineList.push(tube([[x0, PY + 0.08, PZ], [x0, PY + 0.12, PZ + 0.012], [(x0 + x1) / 2 + 0.035, 0.3, 0.13], [x1 + 0.03, 0.43, 0.085], [x1 + 0.01, 0.48, 0.05], [x1, 0.487, 0.036]], 0.0028, 64, false, 6));
  }
  const leak = tube([[0.16, 0.492, 0.03], [0.07, 0.5, 0.03], [0, 0.492, 0.03], [-0.07, 0.5, 0.03], [-0.15, 0.492, 0.03], [-0.19, 0.4, 0.12], [-0.17, 0.3, 0.2]], 0.002, 96, false, 5);
  const linesM = mesh(merge(lineList), M.copper, 'hp-lines'); lines.add(linesM);
  const leakM = mesh(leak, M.copper, 'leak-off'); lines.add(leakM); hot.push(linesM, leakM);
  injP.add(mesh(merge(CYL_X.map(x => merge([cylY(0.0085, 0.13, x, DECK + 0.1, 0.035, 14), cylY(0.012, 0.018, x, 0.478, 0.035, 6), cylY(0.005, 0.016, x, 0.494, 0.035, 8)]))), M.steel, 'injectors'));

  const filt = P('filters', 'Twin fuel filters', 'filtri del gasolio', [0, 0.06, 0.22], [-0.17, 0.32, 0.21]);
  filt.add(mesh(merge([box(0.13, 0.02, 0.05, -0.165, 0.305, 0.205), box(0.01, 0.12, 0.03, -0.165, 0.25, 0.18)]), M.castKeep, 'filter-head'));
  filt.add(mesh(merge([cylY(0.03, 0.12, -0.2, 0.235, 0.21, 28), cylY(0.03, 0.12, -0.13, 0.235, 0.21, 28), cylY(0.008, 0.012, -0.2, 0.17, 0.21, 6), cylY(0.008, 0.012, -0.13, 0.17, 0.21, 6)]), M.pump, 'filters'));
  filt.add(mesh(merge([tube([[-0.2, 0.315, 0.205], [-0.2, 0.33, 0.17], [-0.16, 0.2, 0.18], [-0.13, PY + 0.03, PZ]], 0.003, 32, false, 5)]), M.copper));
  hot.push(...filt.children);

  // starter motor with sliding pinion
  const SY = -0.085, SZ = 0.178;
  const starter = P('starter', 'Starter motor', 'motorino d’avviamento', [0.08, 0, 0.2], [-0.16, SY + 0.055, SZ]);
  starter.add(mesh(merge([cylX(0.05, 0.17, -0.16, SY, SZ, 32), cylX(0.054, 0.012, -0.08, SY, SZ, 32), cylX(0.035, 0.08, -0.26, SY, SZ, 24)]), M.black, 'starter'));
  starter.add(mesh(merge([cylX(0.022, 0.09, -0.15, SY + 0.062, SZ - 0.004, 20), cylX(0.024, 0.01, -0.105, SY + 0.062, SZ - 0.004, 20)]), M.black, 'solenoid'));
  const pinion = new THREE.Group(); pinion.position.set(-0.31, SY, SZ); starter.add(pinion);
  const pt = [cylX(0.009, 0.06, 0.02, 0, 0, 10)]; for (let k = 0; k < 10; k++) pt.push(box(0.016, 0.006, 0.006, 0, 0.0125, 0).rotateX(k / 10 * Math.PI * 2));
  pt.push(cylX(0.011, 0.016, 0, 0, 0, 12));
  pinion.add(mesh(merge(pt), M.steel, 'pinion'));
  hot.push(...starter.children.filter(c => c.isMesh), pinion.children[0]);

  // test stand (arancio)
  const stand = new THREE.Group(); stand.name = 'stand'; root.add(stand);
  const FLOOR = -0.42;
  const sl = [];
  for (const s of [-1, 1]) {
    sl.push(box(0.84, 0.04, 0.05, 0, -0.045, s * 0.172));
    for (const x of [-0.38, 0.38]) { sl.push(box(0.04, -FLOOR - 0.065, 0.04, x, (FLOOR - 0.065) / 2, s * 0.2)); sl.push(box(0.12, 0.012, 0.09, x, FLOOR + 0.006, s * 0.2)); }
    sl.push(box(0.76, 0.03, 0.03, 0, FLOOR + 0.12, s * 0.2));
    for (const x of [-0.19, 0.19]) sl.push(box(0.09, 0.03, 0.07, x, -0.025, s * 0.155)); // rubber mount blocks
  }
  for (const x of [-0.38, 0.38]) sl.push(box(0.03, 0.03, 0.4, x, FLOOR + 0.12, 0));
  for (const x of [-0.38, 0.38]) sl.push(box(0.03, 0.05, 0.38, x, -0.045, 0));
  stand.add(mesh(merge(sl), M.stand, 'stand'));
  const mounts = []; for (const s of [-1, 1]) for (const x of [-0.19, 0.19]) mounts.push(cylY(0.022, 0.012, x, -0.004, s * 0.155, 16));
  stand.add(mesh(merge(mounts), M.rubber));
  // brake drum on the PTO side of the stand, coupled to the flywheel
  stand.add(mesh(merge([cylX(0.06, 0.08, -0.47, 0, 0, 32), box(0.09, -FLOOR - 0.06, 0.09, -0.47, (FLOOR - 0.06) / 2, 0), box(0.16, 0.012, 0.16, -0.47, FLOOR + 0.006, 0)]), M.stand, 'brake'));
  stand.add(mesh(cylX(0.022, 0.12, -0.39, 0, 0, 16), M.steelDark, 'coupling'));

  // layers: stand and FX on layer 1, removed-half parts on layer 4
  root.traverse(o => { if (o.isMesh && !o.layers.isEnabled(L_FX)) o.layers.set(L_MAIN); });
  stand.traverse(o => { if (o.isMesh) o.layers.set(L_FX); });
  for (const m of hot) m.traverse(o => { if (o.isMesh) o.layers.set(L_HOT); });

  for (const k in parts) parts[k].home = parts[k].group.position.clone();

  return {
    root, engine, parts, pistons, rods, crankG, flyG, camG, valves, glows, rotor, dynRot, lever, pinion, capPivot, castings, belt: beltG,
    floorY: FLOOR, hot, sumpBottom: ccBot - 0.1,
  };
}

// pose all moving parts from the simulation
const tmp = new THREE.Vector3();
export function poseEngine(E, sim, st) {
  const th = sim.theta * DEG;
  E.crankG.rotation.x = -th;
  E.flyG.rotation.x = -th;
  E.camG.rotation.x = -th / 2;
  E.rotor.rotation.x = -th * MODELLED.blowerRatio;
  E.dynRot.rotation.x = -th * 2.3;
  for (let i = 0; i < 3; i++) {
    const c = sim.cylinderState(i);
    const pinY = R + ROD - c.s;
    E.pistons[i].position.y = pinY;
    E.rods[i].position.y = pinY;
    E.rods[i].rotation.x = c.beta;
    const g = E.glows[i];
    const crown = pinY + CROWN;
    const top = DECK + 0.004;
    g.position.y = crown - 0.012; g.scale.y = Math.max(0.004, top - crown + 0.012);
    g.material.opacity = Math.min(0.95, c.glow * 1.1);
  }
  for (const v of E.valves) {
    const c = sim.cylinderState(v.i);
    const lift = v.kind === 'ex' ? c.exLift : c.inLift;
    v.tappet.position.y = CAM_Y + 0.017 + lift;
    v.push.position.y = lift;
    v.rocker.rotation.x = -lift / ROCK_Z;
    v.valve.position.set(v.x, DECK - 0.0015 - lift, 0);
    const seat = DECK + 0.089, ret = DECK + 0.108 - lift;
    v.spring.position.set(v.x, seat, 0); v.spring.scale.y = ret - seat;
  }
  E.lever.rotation.z = 0.5 - st.throttle * 1.05;
  // starter pinion slides into the ring gear while cranking
  st.pin += ((sim.starter ? 1 : 0) - st.pin) * Math.min(1, st.dt * 14);
  E.pinion.position.x = -0.285 - 0.04 * st.pin;
  if (sim.starter) E.pinion.rotation.x -= sim.omega * st.dt * 9.6;
  // flapper cap
  E.capPivot.rotation.z = st.cap;
}
