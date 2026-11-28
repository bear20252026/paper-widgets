import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { Engine, PUBLISHED } from './sim.js';
import { makeMaterials, buildEngine, poseEngine, U, CUT_PLANE, L_MAIN, L_FX, L_HOT, CYL_X } from './model.js';
import { Drawings } from './drawings.js';
import { Instruments } from './instruments.js';
import { EngineAudio } from './audio.js';
import { AirFlow, Smoke } from './fx.js';

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ---------- paper grain (generated, not an image file) ----------
(function grain() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const d = g.createImageData(256, 256);
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < d.data.length; i += 4) {
    const fib = rnd() < 0.012 ? 18 : 0;
    const v = 238 + (rnd() - 0.5) * 16 - fib;
    d.data[i] = v; d.data[i + 1] = v - 4; d.data[i + 2] = v - 15; d.data[i + 3] = 34;
  }
  g.putImageData(d, 0, 0);
  // soft blotches of uneven ink absorption
  for (let k = 0; k < 26; k++) { const x = rnd() * 256, y = rnd() * 256, r = 20 + rnd() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(160,140,100,0.05)'); gr.addColorStop(1, 'rgba(160,140,100,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
  document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`);
  document.body.classList.add('grain');
})();

// ---------- renderer and scene ----------
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
let DPR = Math.min(2, window.devicePixelRatio || 1);
renderer.setPixelRatio(DPR);
renderer.setClearColor(0x000000, 0);
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.03).texture;

const M = makeMaterials();
const E = buildEngine(M);
scene.add(E.root);

const key = new THREE.DirectionalLight(0xfff4e6, 2.1);
key.position.set(1.4, 2.6, 1.6); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -1; key.shadow.camera.right = 1; key.shadow.camera.top = 1.2; key.shadow.camera.bottom = -1;
key.shadow.camera.near = 0.5; key.shadow.camera.far = 6; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; key.shadow.radius = 5;
key.shadow.camera.layers.enableAll();
scene.add(key);
const hemi = new THREE.HemisphereLight(0xf4f0e6, 0x8a7f6a, 0.35); scene.add(hemi);
for (const l of [key, hemi]) l.layers.enableAll();

// floor: only the shadow lands on the paper
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: 0x2a2015, opacity: 0.2 }));
floor.position.y = E.floorY; floor.receiveShadow = true; floor.layers.set(L_FX); scene.add(floor);
const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.72).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'varying vec2 vUv; void main(){ vec2 d = (vUv - 0.5) * 2.0; float r = length(d); float a = smoothstep(1.0, 0.15, r) * 0.32; gl_FragColor = vec4(0.11,0.09,0.06, a); }',
  transparent: true, depthWrite: false,
}));
contact.position.y = E.floorY + 0.001; contact.layers.set(L_FX); scene.add(contact);

const air = new AirFlow(); scene.add(air.lines);
const smoke = new Smoke(); scene.add(smoke.points);

const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 30);
camera.layers.enable(L_FX); camera.layers.enable(L_HOT);

// airflow view materials
const ghost = new THREE.MeshBasicMaterial({ color: 0xbdb7aa, transparent: true, opacity: 0.16, depthWrite: false });
const thermal = [0, 1, 2].map(() => new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 } },
  vertexShader: 'varying vec3 vN; varying float vY; void main(){ vN = normalize(normalMatrix * normal); vec4 w = modelMatrix * vec4(position,1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: `uniform float uT; varying vec3 vN; varying float vY;
    void main(){ float hgt = clamp((vY - 0.14) / 0.28, 0.0, 1.0);
      float t = clamp(uT * (0.45 + 0.75 * hgt), 0.0, 1.0);
      vec3 c0 = vec3(0.12, 0.42, 0.66), c1 = vec3(0.35, 0.68, 0.84), c2 = vec3(0.95, 0.66, 0.36), c3 = vec3(0.88, 0.34, 0.11);
      vec3 c = t < 0.33 ? mix(c0, c1, t / 0.33) : t < 0.66 ? mix(c1, c2, (t - 0.33) / 0.33) : mix(c2, c3, (t - 0.66) / 0.34);
      float l = 0.62 + 0.38 * max(0.0, dot(normalize(vN), normalize(vec3(0.3, 0.8, 0.5))));
      gl_FragColor = vec4(c * l, 1.0); }`,
}));
E.root.traverse(o => { if (o.isMesh) o.userData.orig = o.material; });

// ---------- state ----------
const sim = new Engine();
const st = { throttle: 0, load: 0, dt: 0, pin: 0, cap: 0, capV: 0, tachRpm: 0, governed: 700, kW: 0, mark: null, rock: 0, rockV: 0 };
let view = 'painted', explodeT = 0, explodeGoal = 0, wantStartAfterAssembly = false, slow = false, timeScale = 1, soundOn = true;
let audio = null;
const inst = new Instruments({ tach: $('#tach'), cycle: $('#cycle'), pv: $('#pv'), chart: $('#chart') });
const drawings = new Drawings(renderer, scene, document.querySelectorAll('.dwg'));

// ---------- camera rig ----------
const VIEWS = {
  painted: { az: 52, el: 17, dist: 3.25, ty: 0.24, tx: 0.02 },
  cutaway: { az: 14, el: 9, dist: 2.75, ty: 0.18, tx: 0.0 },
  airflow: { az: 58, el: 36, dist: 3.05, ty: 0.24, tx: 0.04 },
  exploded: { az: 34, el: 21, dist: 4.5, ty: 0.3, tx: 0.03 },
};
const rig = { az: 52, el: 17, dist: 3.25, ty: 0.24, tx: 0.02, tween: null };
function goView(name) {
  const v = VIEWS[name];
  let az = v.az; while (az - rig.az > 180) az -= 360; while (az - rig.az < -180) az += 360;
  rig.tween = { from: { az: rig.az, el: rig.el, dist: rig.dist, ty: rig.ty, tx: rig.tx }, to: { ...v, az }, t: 0, dur: 1.5 };
}
function updateRig(dt) {
  if (rig.tween) {
    const tw = rig.tween; tw.t = Math.min(1, tw.t + dt / tw.dur); const k = ease(tw.t);
    for (const p of ['az', 'el', 'dist', 'ty', 'tx']) rig[p] = tw.from[p] + (tw.to[p] - tw.from[p]) * k;
    if (tw.t >= 1) rig.tween = null;
  }
  const az = rig.az * Math.PI / 180, el = rig.el * Math.PI / 180;
  const tgt = new THREE.Vector3(rig.tx, rig.ty, 0);
  camera.position.set(tgt.x + rig.dist * Math.cos(el) * Math.sin(az), tgt.y + rig.dist * Math.sin(el), tgt.z + rig.dist * Math.cos(el) * Math.cos(az));
  camera.lookAt(tgt);
}
const stage = $('#stage');
let drag = null, hintGone = false;
stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType, decided: e.pointerType !== 'touch', rot: e.pointerType !== 'touch' }; ensureAudio(); });
window.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.decided) { if (Math.abs(dx) + Math.abs(dy) < 6) return; drag.decided = true; drag.rot = Math.abs(dx) > Math.abs(dy); if (drag.rot) stage.setPointerCapture?.(e.pointerId); }
  if (!drag.rot) return;
  rig.tween = null;
  rig.az -= dx * 0.35;
  if (drag.type !== 'touch') rig.el = clamp(rig.el + dy * 0.25, -8, 70);
  drag.x = e.clientX; drag.y = e.clientY;
  if (!hintGone) { hintGone = true; $('#hint').style.opacity = 0; }
});
window.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('pointercancel', () => { drag = null; });
stage.addEventListener('touchmove', e => { if (drag && drag.rot) e.preventDefault(); }, { passive: false });
stage.addEventListener('wheel', e => { e.preventDefault(); rig.tween = null; rig.dist = clamp(rig.dist * Math.exp(e.deltaY * 0.0012), 1.4, 7); }, { passive: false });

// ---------- views ----------
const VIEW_LINES = {
  painted: 'Painted in factory celeste, on an arancio test stand. Drag to walk round it.',
  cutaway: 'The section runs through all three cylinder axes. Each chamber glows as it fires, in the order 1-2-3.',
  airflow: 'No water anywhere. The blower pushes air down the cowl, across the fins, and out warm on the pump side.',
  exploded: 'Taken apart along its axes. The crankshaft stays put and everything else slides away from it.',
};
const VIEW_NAMES = { painted: 'Painted · <i>verniciato</i>', cutaway: 'Cutaway · <i>sezione</i>', airflow: 'Airflow · <i>flusso d’aria</i>', exploded: 'Exploded · <i>esploso</i>' };
function setView(name) {
  if (name === view) return;
  view = name;
  document.querySelectorAll('.views button').forEach(b => b.classList.toggle('on', b.dataset.view === name));
  $('#viewlabel').innerHTML = VIEW_NAMES[name];
  U.uCut.value = name === 'cutaway' ? 1 : 0;
  const cut = name === 'cutaway';
  for (const k in M) { const m = M[k]; if (m.userData && m.userData.clip) { m.clippingPlanes = cut ? [CUT_PLANE] : null; m.needsUpdate = true; } }
  if (cut) camera.layers.disable(L_HOT); else camera.layers.enable(L_HOT);
  for (const g of E.glows) g.visible = cut;
  const af = name === 'airflow';
  E.root.traverse(o => {
    if (!o.isMesh || !o.userData.orig) return;
    if (af) { o.material = E.castings.includes(o) ? thermal[o.userData.cyl] : ghost; o.castShadow = E.castings.includes(o); }
    else { o.material = o.userData.orig; o.castShadow = true; }
  });
  goView(name);
  if (name === 'exploded') {
    if (sim.state === 'running' || sim.state === 'cranking') { sim.command('stop'); narrate('Cutting the fuel first. It comes apart once the crank has stopped.'); }
    else narrate(VIEW_LINES.exploded);
    explodeGoal = 1;
  } else {
    explodeGoal = 0;
    narrate(VIEW_LINES[name]);
  }
}
document.querySelectorAll('.views button').forEach(b => b.addEventListener('click', () => { ensureAudio(); setView(b.dataset.view); }));

// ---------- exploded callouts ----------
const labelEls = [];
const svg = $('#callouts'), labelsBox = $('#labels');
for (const k in E.parts) {
  const p = E.parts[k]; if (!p.label) continue;
  const el = document.createElement('div'); el.className = 'callout'; el.innerHTML = `${p.label}<i>${p.it}</i>`; labelsBox.appendChild(el);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#1C1B19'); line.setAttribute('stroke-width', '0.6'); svg.appendChild(line);
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '2.6'); dot.setAttribute('fill', '#E0561C'); dot.setAttribute('stroke', '#1C1B19'); dot.setAttribute('stroke-width', '0.5'); svg.appendChild(dot);
  labelEls.push({ part: p, el, line, dot, w: 0, h: 0 });
}
function layoutLabels(rect, alpha) {
  const on = alpha > 0.02;
  for (const L of labelEls) { L.el.classList.toggle('on', alpha > 0.6); L.line.style.opacity = L.dot.style.opacity = alpha; }
  if (!on) return;
  const W = rect.width, H = rect.height;
  const items = labelEls.map(L => {
    const pv = L.part.anchor.clone().add(L.part.group.position).sub(L.part.home); E.engine.localToWorld(pv);
    pv.project(camera);
    if (!L.w) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; }
    return { L, x: (pv.x * 0.5 + 0.5) * W, y: (-pv.y * 0.5 + 0.5) * H };
  });
  // two columns, sorted by height, pushed apart so nothing overlaps
  items.sort((a, b) => a.x - b.x);
  const half = Math.ceil(items.length / 2);
  const cols = [items.slice(0, half), items.slice(half)];
  const top = 26, bottom = H - 18;
  cols.forEach((col, ci) => {
    col.sort((a, b) => a.y - b.y);
    const hgt = col.reduce((s, it) => s + it.L.h + 5, 0);
    let y = clamp(col[0] ? col[0].y - col[0].L.h / 2 : top, top, Math.max(top, bottom - hgt));
    // relax: start each at its anchor height, then resolve overlaps downward and upward
    const ys = col.map(it => it.y - it.L.h / 2);
    for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i ? ys[i - 1] + col[i - 1].L.h + 5 : top);
    const over = ys.length ? ys[ys.length - 1] + col[col.length - 1].L.h - bottom : 0;
    if (over > 0) { ys[ys.length - 1] -= over; for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - col[i].L.h - 5); }
    for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], top + i * 0);
    col.forEach((it, i) => {
      const L = it.L, lx = ci === 0 ? 2 : W - L.w - 2, ly = ys[i];
      L.el.style.transform = `translate(${lx}px, ${ly}px)`;
      const ex = ci === 0 ? lx + L.w : lx, ey = ly + L.h / 2;
      const kx = ci === 0 ? ex + 14 : ex - 14;
      L.line.setAttribute('points', `${ex},${ey} ${kx},${ey} ${it.x},${it.y}`);
      L.dot.setAttribute('cx', it.x); L.dot.setAttribute('cy', it.y);
    });
  });
}
function applyExplode(t) {
  const k = ease(clamp(t, 0, 1));
  let n = 0;
  for (const name in E.parts) {
    const p = E.parts[name];
    const d = clamp(k * 1.25 - (n % 6) * 0.04, 0, 1); n++;
    p.group.position.copy(p.home).addScaledVector(p.offset, ease(d));
  }
  E.belt.visible = t < 0.02;
}

// ---------- narration ----------
const narEl = $('#narration'); let narText = '', narTimer = 0, narLock = 0;
function narrate(t, lock = 0) {
  if (t === narText) return; narText = t;
  narEl.style.opacity = 0; clearTimeout(narTimer);
  narTimer = setTimeout(() => { narEl.textContent = t; narEl.style.opacity = 1; }, 180);
  narLock = lock;
}
let saidIdle = false, saidFull = false, throttleSaidAt = -10, compressSeen = 0, caughtAt = -1;

// ---------- controls ----------
const keyBtn = $('#key'), keyState = $('#keystate');
function pressKey() {
  ensureAudio();
  if (view === 'exploded' && (sim.state === 'off' || sim.state === 'stopping') ) {
    wantStartAfterAssembly = true; setView('painted'); narrate('Putting it back together before it can run.'); return;
  }
  sim.command('key');
}
keyBtn.addEventListener('click', pressKey);
window.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); pressKey(); }
  else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) { ensureAudio(); setView(['painted', 'cutaway', 'airflow', 'exploded'][+e.code.slice(5) - 1]); }
  else if (e.code === 'KeyS') toggleSlow();
});
function toggleSlow() { ensureAudio(); slow = !slow; $('#slow').classList.toggle('on', slow); narrate(slow ? 'Slow motion, one twenty-fifth speed. Follow a single power stroke round the cycle wheel.' : 'Back to real time.'); }
$('#slow').addEventListener('click', toggleSlow);
$('#sound').addEventListener('click', () => { soundOn = !soundOn; $('#sound').classList.toggle('on', soundOn); ensureAudio(); if (audio) audio.setEnabled(soundOn); });
$('#resetview').addEventListener('click', () => goView(view));

// levers: notched quadrants with arancio knobs
function makeLever(el, onChange, label) {
  const c = el.querySelector('canvas');
  const draw = () => {
    const v = +el.dataset.value; const r = c.getBoundingClientRect(); const dpr = DPR;
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = r.width, h = r.height, cx = w / 2, cy = h - 6, R = Math.min(w * 0.38, h - 12);
    const a0 = -Math.PI * 0.86, a1 = -Math.PI * 0.14;
    g.strokeStyle = '#1C1B19'; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
    g.beginPath(); g.arc(cx, cy, R - 7, a0, a1); g.lineWidth = 0.5; g.stroke();
    for (let k = 0; k <= 10; k++) {
      const a = a0 + (a1 - a0) * k / 10, major = k % 5 === 0;
      g.lineWidth = major ? 1.1 : 0.6;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 7), cy + Math.sin(a) * (R - 7)); g.lineTo(cx + Math.cos(a) * (R + (major ? 4 : 2)), cy + Math.sin(a) * (R + (major ? 4 : 2))); g.stroke();
    }
    g.font = '7.5px "IBM Plex Mono", monospace'; g.fillStyle = '#4a4740'; g.textBaseline = 'middle';
    g.textAlign = 'right'; g.fillText(label[0], cx + Math.cos(a0) * R - 3, cy + Math.sin(a0) * R + 7);
    g.textAlign = 'left'; g.fillText(label[1], cx + Math.cos(a1) * R + 3, cy + Math.sin(a1) * R + 7);
    const a = a0 + (a1 - a0) * v;
    g.strokeStyle = '#1C1B19'; g.lineWidth = 2.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2)); g.stroke();
    g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fillStyle = '#1C1B19'; g.fill();
    const kx = cx + Math.cos(a) * (R + 1), ky = cy + Math.sin(a) * (R + 1);
    const grd = g.createRadialGradient(kx - 2, ky - 2, 1, kx, ky, 7.5); grd.addColorStop(0, '#f39a6c'); grd.addColorStop(0.55, '#E0561C'); grd.addColorStop(1, '#9b3510');
    g.beginPath(); g.arc(kx, ky, 7, 0, Math.PI * 2); g.fillStyle = grd; g.fill(); g.lineWidth = 0.7; g.strokeStyle = '#1C1B19'; g.stroke();
  };
  const set = (v, notify = true) => { v = clamp(Math.round(v * 40) / 40, 0, 1); el.dataset.value = v; el.setAttribute('aria-valuenow', Math.round(v * 100)); draw(); if (notify) onChange(v); };
  const fromEvent = e => {
    const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.bottom - 6;
    let a = Math.atan2(e.clientY - cy, e.clientX - cx); if (a > 0.5) a = -Math.PI; // below the pivot
    const a0 = -Math.PI * 0.86, a1 = -Math.PI * 0.14;
    set((clamp(a, a0, a1) - a0) / (a1 - a0));
  };
  let down = false;
  el.addEventListener('pointerdown', e => { down = true; el.setPointerCapture(e.pointerId); fromEvent(e); ensureAudio(); e.preventDefault(); });
  el.addEventListener('pointermove', e => { if (down) fromEvent(e); });
  el.addEventListener('pointerup', () => { down = false; });
  el.addEventListener('keydown', e => {
    const v = +el.dataset.value;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { set(v + 0.05); e.preventDefault(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { set(v - 0.05); e.preventDefault(); }
  });
  el.setAttribute('aria-valuemin', 0); el.setAttribute('aria-valuemax', 100);
  return { draw, set };
}
const throttleL = makeLever($('#throttle'), v => {
  st.throttle = v; sim.command('throttle', v);
  $('#throttleval').textContent = `${Math.round((700 + v * 1650) / 10) * 10} rpm`;
  if (sim.state === 'running' && sim.t - throttleSaidAt > 6) { throttleSaidAt = sim.t; narrate('The hand throttle sets the governor, which opens the rack until the engine holds that speed.'); }
  saidIdle = v > 0.02 ? saidIdle : false;
}, ['min', 'max']);
const loadL = makeLever($('#load'), v => { st.load = v; sim.command('load', v); $('#loadval').textContent = `${Math.round(v * 100)} %`; if (v < 0.95) saidFull = false; }, ['0', '100']);

// ---------- audio ----------
function ensureAudio() {
  if (audio) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    audio = new EngineAudio(ctx); audio.setEnabled(soundOn);
  } catch (e) { audio = null; }
}

// ---------- layout ----------
let stageRect = stage.getBoundingClientRect();
function layout() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  stageRect = stage.getBoundingClientRect();
  drawings.layout(DPR);
  throttleL.draw(); loadL.draw();
}
window.addEventListener('resize', layout);
window.addEventListener('scroll', () => { stageRect = stage.getBoundingClientRect(); }, { passive: true });
document.fonts && document.fonts.ready.then(() => { for (const it of drawings.items) it.w = 0; layout(); for (const L of labelEls) L.w = 0; });
layout();
throttleL.set(0, false); loadL.set(0, false);

// ---------- loop ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 60, readAcc = 0, uiState = '';
const capWorld = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (document.hidden) return;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  st.dt = dt;
  timeScale += ((slow ? 1 / 25 : 1) - timeScale) * Math.min(1, dt * 3);

  // simulation
  const simDt = dt * timeScale;
  sim.step(simDt);
  const evs = sim.drainEvents();
  for (const ev of evs) handleEvent(ev, simDt);
  if (audio) audio.update(sim, timeScale);

  // exploded: waits for the engine to stop
  const canExplode = sim.state === 'off' && Math.abs(sim.rpm) < 1;
  const goal = explodeGoal && canExplode ? 1 : 0;
  const prevT = explodeT;
  explodeT = clamp(explodeT + (goal ? 1 : -1) * dt / 1.4, 0, 1);
  if (prevT === 0 && explodeT > 0) { if (audio) audio.metal(audio.ctx.currentTime + 0.02); if (view === 'exploded') narrate(VIEW_LINES.exploded); }
  if (prevT > 0 && explodeT === 0 && audio) audio.seat(audio.ctx.currentTime + 0.02);
  if (wantStartAfterAssembly && explodeT === 0 && view !== 'exploded' && sim.state === 'off') { wantStartAfterAssembly = false; sim.command('start'); }
  applyExplode(explodeT);

  // dynamics of the parts
  poseEngine(E, sim, st);
  const base = clamp(Math.max(0, sim.rpm) / 2600 * 0.55, 0, 0.6);
  st.capV += (-(st.cap - base) * 900 - st.capV * 26) * dt; st.cap += st.capV * dt;
  if (st.cap < 0) { st.cap = 0; st.capV = Math.abs(st.capV) * 0.25; }
  // rocking on the mounts against the gas torque
  st.rockV += (-st.rock * 2400 - st.rockV * 30 + sim.reaction * 0.026) * dt * Math.min(1, timeScale * 3 + 0.2);
  st.rock += st.rockV * dt;
  E.engine.rotation.x = clamp(st.rock, -0.02, 0.02) * (explodeT > 0 ? 0 : 1);

  // thermal ramp
  for (let i = 0; i < 3; i++) thermal[i].uniforms.uT.value = clamp((sim.cyl[i].temp - 20) / 170, 0, 1);

  // fx
  air.update(dt, sim.rpm, camera, view === 'airflow');
  if (sim.smoke > 0.04 && sim.rpm > 60 && Math.random() < sim.smoke * 0.9) smoke.puff(sim.smoke * 0.8, 1, 0.5 + sim.rpm / 2000);
  E.capPivot.getWorldPosition(capWorld); capWorld.x += 0.028; capWorld.y += 0.01;
  smoke.update(dt * Math.max(timeScale, 0.15), stageRect.height * DPR / (2 * Math.tan(camera.fov * Math.PI / 360)), capWorld);

  // readings
  st.tachRpm += (Math.max(0, sim.rpm) - st.tachRpm) * Math.min(1, dt * 9);
  const rd = sim.readings();
  st.kW = rd.kW; st.governed = sim.state === 'running' ? sim.governedRpm() : 700 + st.throttle * 1650;
  readAcc += dt;
  if (readAcc > 0.1) { readAcc = 0; updateReadings(rd); }
  narrateState(rd);
  const ks = sim.state === 'cranking' ? 'Cranking' : sim.state === 'running' ? 'Stop' : sim.state === 'stopping' ? 'Stopping' : 'Start';
  if (ks !== uiState) { uiState = ks; keyState.textContent = ks; keyBtn.dataset.pos = sim.state === 'cranking' ? 'start' : sim.state === 'running' ? 'run' : 'off'; }

  // render
  updateRig(dt);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, window.innerWidth, window.innerHeight); renderer.clear();
  const r = stageRect;
  if (r.bottom > 0 && r.top < window.innerHeight && r.width > 10) {
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
    const y = window.innerHeight - r.bottom;
    renderer.setViewport(r.left, y, r.width, r.height); renderer.setScissor(r.left, y, r.width, r.height); renderer.setScissorTest(true);
    renderer.render(scene, camera);
  }
  layoutLabels(r, explodeT > 0.85 && view === 'exploded' ? (explodeT - 0.85) / 0.15 : 0);
  drawings.render(window.innerHeight, DPR, now / 1000);
  renderer.setScissorTest(false);
  inst.draw(sim, st, dt, DPR);
  window.__fl3 = { fps, sim, view, explodeT, timeScale, readings: rd, settle: () => { explodeT = explodeGoal && sim.state === 'off' ? 1 : 0; if (rig.tween) rig.tween.t = 1; } };
}

function handleEvent(ev, simDt) {
  // schedule sound at the event's sub-frame time
  if (audio && soundOn) {
    const lagReal = (sim.t - ev.t) / Math.max(timeScale, 1e-3);
    const t = audio.ctx.currentTime + 0.06 - Math.min(0.06, lagReal);
    if (ev.type === 'compress') ev.cranking = sim.state === 'cranking';
    audio.event(ev, t, timeScale);
  }
  switch (ev.type) {
    case 'crank': narrate('Key turned. The starter pinion meshes with the flywheel and spins the engine at about 250 rpm.'); compressSeen = 0; st.mark = 'key'; saidIdle = false; break;
    case 'compress': if (sim.state === 'cranking' && ++compressSeen === 2) narrate('Squeezed about 17 to 1, the air gets hot enough to light the diesel. No spark plugs.'); break;
    case 'misfire': if (!ev.dry) smoke.puff(0.9, 6, 0.7); break;
    case 'fire': inst.onFire(ev.cyl); if (ev.smoke > 0.08) smoke.puff(Math.min(1, ev.smoke), 3, 0.9); if (ev.cyl >= 0 && st.cap < 0.5 && sim.rpm < 1200) {} break;
    case 'evo': if (ev.fired && sim.rpm < 1100) st.capV += 7 * Math.min(1.5, Math.sqrt(ev.p || 1) / 2); break;
    case 'caught': narrate('It caught.'); caughtAt = sim.t; st.mark = 'caught'; smoke.puff(1, 10, 1.1); break;
    case 'fuelcut': narrate('Fuel cut. It runs down and rocks back on its last compression.'); st.mark = 'fuel cut'; break;
    case 'stalled': narrate('Stalled. The brake pulled it below the speed the governor could hold.'); st.mark = 'stall'; break;
    case 'stop': st.mark = 'stop'; if (view !== 'exploded' && narText.startsWith('Fuel cut')) setTimeout(() => { if (sim.state === 'off' && view !== 'exploded') narrate('Stopped. Turn the key to run it again.'); }, 1800); break;
  }
}
function narrateState(rd) {
  if (sim.state !== 'running') return;
  if (!saidIdle && caughtAt >= 0 && sim.t - caughtAt > 2.2 && st.throttle < 0.03 && st.load < 0.05 && Math.abs(rd.rpm - 700) < 60) {
    saidIdle = true; narrate('Idling near 700 rpm: three power strokes every two turns, one every 240 degrees.');
  }
  if (!saidFull && st.load > 0.97 && st.throttle > 0.9 && sim.rack > 0.97 && Math.abs(rd.rpm - 2200) < 40) {
    saidFull = true; narrate('Full PTO load at 2,200 rpm: the rack is wide open and the FL3 makes its rated 39 hp.');
  }
}
const R$ = id => document.getElementById(id);
function updateReadings(rd) {
  R$('r-rpm').textContent = Math.round(rd.rpm).toLocaleString('en-US');
  R$('r-hp').textContent = rd.hp.toFixed(1);
  R$('r-kw').textContent = `${rd.kW.toFixed(1)} kW`;
  R$('r-nm').textContent = Math.round(rd.torque);
  R$('r-fuel').textContent = rd.lph.toFixed(1);
  R$('r-air').textContent = rd.air.toFixed(1);
  R$('r-head').textContent = Math.round(rd.head);
}
requestAnimationFrame(frame);
