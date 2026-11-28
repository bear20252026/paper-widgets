// Starship integrated flight study: page orchestration.
import * as THREE from 'three';
import { createSim, prop, mass, MODEL, PUBLISHED, atmosphere } from './sim.js';
import { U, makeMaterials, noClipPlane } from './materials.js';
import { buildBooster, buildShip } from './vehicle.js';
import { makeSky, makeGround, buildTower, buildMount, buildTankFarm, MOUNT_H, TOWER } from './world.js';
import { makePlume, makeParticles } from './fx.js';
import { Orbit } from './orbit.js';
import { createDrawings } from './drawings.js';
import { drawThrust, drawPropellant, drawTrajectory, drawEvents, fmt } from './instruments.js';
import { Sound } from './audio.js';
import { lineFor, LOG_LABEL, VIEW_LINES } from './narration.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;

// ---------- paper grain, generated ----------
(function grain() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const im = g.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) {
    const n = Math.random(); const v = n < 0.5 ? 0 : 255;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = n < 0.06 || n > 0.94 ? 14 : 4;
  }
  g.putImageData(im, 0, 0);
  // uneven absorption blotches
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 20 + Math.random() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,100,70,0.025)'); gr.addColorStop(1, 'rgba(120,100,70,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  document.documentElement.style.setProperty('--grain', `url(${c.toDataURL()})`);
})();

// ---------- renderer ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, isTouch ? 2 : 1.6);
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x000000, 0);
renderer.autoClear = false;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;

// procedural environment for reflections: printed sky over concrete, with a warm flood patch
function makeEnv() {
  const s = new THREE.Scene();
  const g = new THREE.SphereGeometry(50, 32, 16);
  const col = [];
  const p = g.attributes.position;
  const top = new THREE.Color('#f1ede4'), hor = new THREE.Color('#c4dfe6'), gnd = new THREE.Color('#8f8a80');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 50; const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(gnd, Math.min(1, -y * 4));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const flood = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd7a0').multiplyScalar(4) }));
  flood.position.set(-30, 10, 25); s.add(flood);
  const cool = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#d6eef5').multiplyScalar(1.6) }));
  cool.position.set(20, 35, -20); s.add(cool);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.02);
  pm.dispose();
  return rt.texture;
}
const envMap = makeEnv();
const mats = makeMaterials(envMap);

// ---------- scene ----------
const scene = new THREE.Scene();
const horizon = new THREE.Color('#c9dfe3');
scene.fog = new THREE.Fog(horizon, 1800, 30000);
const camera = new THREE.PerspectiveCamera(30, 1, 1, 400000);
const sky = makeSky(); scene.add(sky);
const ground = makeGround(); scene.add(ground);
const tower = buildTower(mats); scene.add(tower.group);
const mount = buildMount(mats); scene.add(mount.group);
const farm = buildTankFarm(mats); scene.add(farm.group);
const booster = buildBooster(mats); scene.add(booster.root);
const ship = buildShip(mats); scene.add(ship.root);
U.tileK.value = ship.parts.tileK;

const hemi = new THREE.HemisphereLight('#d7ecf2', '#a99f8c', 1.15); scene.add(hemi);
const key = new THREE.DirectionalLight('#ffd9ab', 2.6);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
const sc = key.shadow.camera; sc.left = -170; sc.right = 170; sc.top = 200; sc.bottom = -60; sc.near = 10; sc.far = 900;
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.5;
scene.add(key, key.target);

// plumes, attached to each stage
const bExits = booster.parts.engines.defs.map((d) => ({ x: d.x, y: 5.2 + d.exitY, z: d.z, r: 0.62 }));
const bPlume = makePlume(bExits, { lenSL: 46, lenVac: 230, spreadVac: 2.4, collective: { x: 0, y: 1.0, z: 0, r: 4.3 } });
booster.root.add(bPlume.mesh);
const sExits = ship.parts.engines.defs.map((d) => ({ x: d.x, y: 4.3 + d.exitY, z: d.z, r: d.type === 'rvac' ? 1.12 : 0.62 }));
const sPlume = makePlume(sExits, { lenSL: 26, lenVac: 160, spreadVac: 2.0 });
ship.root.add(sPlume.mesh);
const parts = makeParticles(3200); scene.add(parts.points);

// flash for losses
const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: '#E05A1E', transparent: true, opacity: 0, depthWrite: false }));
flash.visible = false; scene.add(flash);
let flashT = 0;

// explode bookkeeping
for (const st of [booster, ship]) for (const e of st.explode) e.obj.userData.base = e.obj.position.clone();

const view3d = $('view3d');
const orbit = new Orbit(camera, view3d);
const drawings = createDrawings(renderer, { booster, ship });
const sound = new Sound();

// ---------- app state ----------
const app = {
  sim: null, view: 'painted', wantView: 'painted', camMode: 'auto', slow: false, timeScale: 1,
  events: [], logCount: 0, explodeK: 0, ghostK: 0, focus: 'stack', focusPos: new THREE.Vector3(0, 80, 0),
  bTip: 0, sTip: 0, guardUp: false, opts: { recovery: 'catch', seq: 'auto', tileWear: 0 }, marks: [], frame: 0,
  carriageY: 128, armOpen: 1, qdOut: 0, clampK: 0, lastFocus: 'stack', inspect: false, debrisAt: null,
};
function newSim() {
  app.sim = createSim({ ...app.opts });
  app.events = []; app.marks = []; app.bTip = app.sTip = 0; app.carriageY = 128; app.armOpen = 1; app.qdOut = 0; app.clampK = 0;
  app.focus = 'stack'; app.lastFocus = 'stack';
  booster.root.visible = ship.root.visible = true;
  parts.clear();
  $('log').innerHTML = '';
  setNarration('Range is safe. Arm the switch, then ignite.');
  setSwitch('safe'); app.guardUp = false; $('rsGuard').classList.remove('up');
  document.querySelectorAll('#segRecovery button, #segSeq button, #segTiles button').forEach((b) => (b.disabled = false));
  U.tileWear.value = app.opts.tileWear;
}

// ---------- UI ----------
function setNarration(t) { $('narration').textContent = t; }
function logEvent(e) {
  const lab = LOG_LABEL[e.type]; if (!lab) return;
  const li = document.createElement('li');
  const bad = ['failure', 'vehicle_lost', 'abort', 'catch_nogo', 'terminate', 'budget_low', 'cut', 'depletion'].includes(e.type);
  if (bad) li.className = 'bad'; else if (['catch', 'ship_splashdown', 'liftoff', 'separation'].includes(e.type)) li.className = 'good';
  let extra = '';
  if (e.type === 'maxq') extra = ` ${(e.q / 1000).toFixed(1)} kPa`;
  if (e.type === 'failure') extra = ' · ' + e.reason.replace(/_/g, ' ');
  if (e.type === 'vehicle_lost') extra = ' · ' + e.body;
  if (e.type === 'liftoff') extra = ` T/W ${e.twr.toFixed(2)}`;
  li.innerHTML = `<time>${clockStr(e.t)}</time><span><b>${lab}</b>${extra}</span>`;
  const log = $('log'); log.appendChild(li); log.scrollTop = log.scrollHeight;
}
function clockStr(t) {
  const sgn = t < 0 ? '−' : '+'; const a = t < 0 ? Math.ceil(-t - 1e-6) : t;
  const m = Math.floor(a / 60), s = Math.floor(a % 60);
  return `T${sgn}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function setSwitch(pos) {
  const rs = $('rs'); rs.dataset.pos = pos;
  const btns = [...rs.querySelectorAll('.rs-pos')];
  btns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.pos === pos)));
  const b = btns.find((x) => x.dataset.pos === pos);
  const k = $('rsKnob'); k.style.left = (b.offsetLeft + 3) + 'px'; k.style.width = (b.offsetWidth - 6) + 'px';
}
$('rs').addEventListener('click', (e) => {
  sound.start();
  const b = e.target.closest('.rs-pos'); if (!b) return;
  const s = app.sim.state, pos = b.dataset.pos;
  if (pos === 'armed' && (s.phase === 'safe' || s.phase === 'held')) { app.sim.command('arm'); setSwitch('armed'); sound.play('arm'); }
  else if (pos === 'safe' && s.phase === 'armed') { app.sim.command('safe'); setSwitch('safe'); sound.play('safe'); }
  else if (pos === 'terminate') {
    if (!app.guardUp) { setNarration('Lift the guard to reach TERMINATE.'); return; }
    if (app.sim.command('terminate')) { setSwitch('terminate'); sound.play('arm'); }
  }
});
$('rsGuard').addEventListener('click', (e) => { e.stopPropagation(); sound.start(); app.guardUp = !app.guardUp; $('rsGuard').classList.toggle('up', app.guardUp); sound.play('ui'); });
function ignite() {
  sound.start();
  if (app.sim.state.phase !== 'armed') { setNarration(app.sim.state.phase === 'safe' ? 'The switch is SAFE. Arm it before ignition.' : 'Ignition is not available now.'); return; }
  app.sim.command('ignite');
}
$('btnIgnite').addEventListener('click', ignite);
function stage() { sound.start(); sound.play('stageClick'); if (!app.sim.command('stage')) setNarration('STAGE is not available now.'); }
$('btnStage').addEventListener('click', stage);
function cut() { sound.start(); if (app.sim.command('cut')) sound.play('cut'); }
$('btnCut').addEventListener('click', cut);
function seg(id, fn) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    sound.start(); sound.play('ui');
    if (fn(b.dataset.v) === false) return;
    $(id).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  });
}
seg('segRecovery', (v) => { app.opts.recovery = v; if (app.sim.state.catchGo !== null) return false; app.sim.command('recovery', v); });
seg('segSeq', (v) => { app.opts.seq = v; if (app.sim.state.stageT !== null) return false; app.sim.command('seq', v); });
seg('segTiles', (v) => { app.opts.tileWear = +v; if (app.sim.state.ship.mode === 'reentry') return false; app.sim.command('tileWear', +v); U.tileWear.value = +v; });
seg('segCam', (v) => { app.camMode = v; });
$('views').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { sound.start(); sound.play('ui'); requestView(b.dataset.view); } });
function toggleSlow() { app.slow = !app.slow; $('btnSlow').classList.toggle('on', app.slow); sound.setSlow(app.slow ? 1 / 25 : 1); setNarration(app.slow ? 'Slow motion, one twenty-fifth. The plume, staging and catch slow down with it.' : 'Real time.'); }
$('btnSlow').addEventListener('click', () => { sound.start(); toggleSlow(); });
$('btnSound').addEventListener('click', () => {
  sound.start(); const on = !sound.on; sound.setEnabled(on);
  $('btnSound').textContent = on ? 'SOUND ON' : 'SOUND OFF'; $('btnSound').setAttribute('aria-pressed', String(on));
});
$('btnResetView').addEventListener('click', () => applyCamera(app.view, true));
$('btnRecycle').addEventListener('click', () => { sound.start(); newSim(); requestView(app.view === 'exploded' ? 'painted' : app.view); });
$('btnFigures').addEventListener('click', () => $('figures').showModal());
window.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('dialog')) return;
  if (e.code === 'Space') { e.preventDefault(); ignite(); }
  else if (e.key >= '1' && e.key <= '4') requestView(['painted', 'cutaway', 'plume', 'exploded'][+e.key - 1]);
  else if (e.key === 's' || e.key === 'S') { sound.start(); toggleSlow(); }
  else if (e.key === 'g' || e.key === 'G') stage();
  else if (e.key === 'x' || e.key === 'X') cut();
  else if (e.key === 'r' || e.key === 'R') { newSim(); }
  else if (e.key === 'v' || e.key === 'V') applyCamera(app.view, true);
  else if (e.key === 'a' || e.key === 'A') { const s = app.sim.state; sound.start(); if (s.phase === 'safe' || s.phase === 'held') { app.sim.command('arm'); setSwitch('armed'); sound.play('arm'); } }
});
window.addEventListener('pointerdown', () => sound.start(), { once: true });

// figures dialog content
(function figures() {
  const pub = [
    ['Stack height', '124 m (121 m earlier)'], ['Diameter', '9 m'], ['Payload, fully reusable, LEO', '100+ t'],
    ['Super Heavy height', '72 m'], ['Super Heavy propellant', '3,650 t'], ['Super Heavy thrust', '8,240 tf'],
    ['Super Heavy engines', '33 (13 centre, 20 outer)'], ['Starship height', '52 m'], ['Starship propellant', '1,600 t'],
    ['Starship engines', '6 (3 SL, 3 RVac)'], ['Raptor propellant', 'CH₄ / LOX, subcooled'], ['Raptor cycle', 'full-flow staged combustion'],
    ['Raptor 3 SL thrust', '250 tf (to 280 tf reported)'], ['Raptor 3 vacuum Isp', '350 s'], ['Raptor 3 dry mass', '1,525 kg'],
    ['Heat shield', '≈18,000 hex tiles'], ['Structure', 'stainless; 301 early, 304L and proprietary later'],
    ['First integrated flight', '2023-04-20'], ['First hot staging', '2023-11-18'], ['Both stages splash down', '2024-06-06'],
    ['First booster catch', '2024-10-13'], ['Booster reflight', 'NET 2025, status evolving'],
  ];
  const m = MODEL;
  const mod = [
    ['Booster dry mass', `${m.boosterDry_t} t`], ['Ship dry mass', `${m.shipDry_t} t`], ['Payload carried', `${m.payload_t} t`],
    ['Mixture ratio O/F', `${m.mixtureRatio}`], ['Raptor SL thrust used', `${m.raptorSL_tf} tf, calibrated`], ['Raptor SL Isp', `${m.raptorIspSL} s`],
    ['RVac thrust / Isp', `${m.rvacVac_tf} tf / ${m.rvacIspVac} s`], ['Throttle floor', `${m.throttleMin * 100}%`],
    ['Liftoff T/W', ((33 * m.raptorSL_tf) / (PUBLISHED.boosterProp_t + PUBLISHED.shipProp_t + m.boosterDry_t + m.shipDry_t)).toFixed(2)],
    ['Clamp release margin', `${m.clampMargin} × weight`], ['Ignition / ramp', `T${m.ignitionT} s, 40 to 100%`],
    ['Atmosphere', `exponential, H = ${m.H} m`], ['Stack drag area CdA', `${m.stackCdA.toFixed(1)} m²`],
    ['Pitch program', `kick T+${m.pitchStart} s, to ${(m.pitchMax * 57.3).toFixed(0)}° over ${m.pitchSpan} s`],
    ['Booster reserve at MECO', `${(m.boosterReserveFrac * 100).toFixed(0)}% of propellant`],
    ['Staging window', `MECO −${m.stageEarly} s to +${m.stageLate} s`], ['Interstage vent', `${m.interstageVent} s`],
    ['Grid-fin authority', `${m.gridFinMax} m/s²`], ['Catch height (base)', `${m.catchHeight_m} m`],
    ['Catch envelope', `±${m.catchPos_m} m, ${m.catchVz} m/s vert, ${m.catchVh} m/s horiz`],
    ['Go/no-go', `${m.goNoGoAlt} m, predicted miss < ${m.goNoGoRange} m`], ['Booster entry burn', `${m.entryBurnAlt / 1000} km, 3 engines`],
    ['Ship SECO', `perigee ${m.shipPerigeeTarget / 1000} km`], ['Ship landing reserve', `${m.shipLandingReserve_t} t`],
    ['Heating', `Sutton-Graves, Rn ${m.noseRadius} m`], ['Tile flux limit', `${m.fluxLimit / 1000} kW/m²`],
    ['Tile recession', `${m.recessionK} m per J/m² above ${m.recessionThreshold / 1000} kW/m²`], ['Tile allowable recession', `${m.tileThickness * 1000} mm`],
    ['Tank layout and dome positions', 'schematic'], ['Reliability / success probability', 'not modelled'],
  ];
  $('tPub').innerHTML = pub.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
  $('tMod').innerHTML = mod.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
})();

// ---------- views ----------
function isSafe() {
  const s = app.sim.state;
  return ['safe', 'armed', 'held'].includes(s.phase) || s.done;
}
function requestView(v) {
  app.wantView = v;
  document.querySelectorAll('#views button').forEach((b) => { b.classList.toggle('on', b.dataset.view === v && (v !== 'exploded' || isSafe())); b.classList.toggle('wait', b.dataset.view === 'exploded' && v === 'exploded' && !isSafe()); });
  if (v === 'exploded' && !isSafe()) { setNarration(VIEW_LINES.explodedWait); return; }
  setView(v);
}
function setView(v) {
  app.view = v;
  const names = { painted: 'VIEW 1 · PAINTED', cutaway: 'VIEW 2 · CUTAWAY', plume: 'VIEW 3 · PLUME', exploded: 'VIEW 4 · EXPLODED' };
  $('viewTag').textContent = names[v];
  document.querySelectorAll('#views button').forEach((b) => { b.classList.toggle('on', b.dataset.view === v); b.classList.remove('wait'); });
  setNarration(VIEW_LINES[v]);
  app.inspect = v === 'exploded' && app.sim.state.done;
  applyCamera(v, true);
}
function applyCamera(v, animate) {
  const small = view3d.clientWidth < 520;
  const k = small ? 1.25 : 1;
  const presets = {
    painted: { radius: 335 * k, theta: 0.42, phi: 1.49, offset: new THREE.Vector3(0, 4, 0) },
    cutaway: { radius: 300 * k, theta: 0.15, phi: 1.5, offset: new THREE.Vector3(0, 0, 0) },
    plume: { radius: 150 * k, theta: -0.95, phi: 1.5, offset: new THREE.Vector3(0, 0, 0) },
    exploded: { radius: 430 * k, theta: -0.45, phi: 1.5, offset: new THREE.Vector3(0, 14, 0) },
  };
  orbit.moveTo(presets[v], animate ? 1.6 : 0.01);
}

// ---------- callouts (exploded) ----------
const callouts = [];
(function makeCallouts() {
  const box = $('callouts');
  for (const st of [booster, ship]) for (const e of st.explode) {
    if (!e.label) continue;
    const d = document.createElement('div'); d.className = 'callout';
    d.innerHTML = `<span class="n">${e.label}</span><span class="t">${e.tag}</span>`;
    d.style.display = 'none'; box.appendChild(d);
    callouts.push({ e, st, el: d });
  }
})();
const svgNS = 'http://www.w3.org/2000/svg';
function layoutCallouts(rect, show) {
  const svg = $('calloutSvg');
  svg.innerHTML = '';
  if (!show) { for (const c of callouts) c.el.style.display = 'none'; return; }
  const v = new THREE.Vector3();
  const items = [];
  for (const c of callouts) {
    if (c.e.cutOnly) { c.el.style.display = 'none'; continue; }
    const k = app.explodeK;
    if (c.e.anchorObj) {
      v.set(...(c.e.anchorLocal || [2.4, 1.5, 0])); c.e.anchorObj.localToWorld(v);
    } else {
      v.set(...c.e.anchor).addScaledVector(new THREE.Vector3(...c.e.dir), c.e.dist * k); c.st.root.localToWorld(v);
    }
    v.project(camera);
    if (v.z > 1) { c.el.style.display = 'none'; continue; }
    const x = (v.x * 0.5 + 0.5) * rect.width, y = (-v.y * 0.5 + 0.5) * rect.height;
    c.el.style.display = 'block';
    items.push({ c, x, y, w: c.el.offsetWidth, h: c.el.offsetHeight });
  }
  const mid = rect.width / 2;
  for (const side of ['L', 'R']) {
    const col = items.filter((i) => (side === 'L') === (i.x < mid)).sort((a, b) => a.y - b.y);
    let yPrev = 26;
    for (const it of col) { it.ly = Math.max(it.y - it.h / 2, yPrev); yPrev = it.ly + it.h + 6; }
    // push up from the bottom if overflow
    let yMax = rect.height - 44;
    for (let i = col.length - 1; i >= 0; i--) { const it = col[i]; if (it.ly + it.h > yMax) it.ly = yMax - it.h; yMax = it.ly - 6; }
    for (const it of col) {
      it.lx = side === 'L' ? 10 : rect.width - it.w - 10;
      it.c.el.style.left = it.lx + 'px'; it.c.el.style.top = it.ly + 'px';
      const ex = side === 'L' ? it.lx + it.w : it.lx, ey = it.ly + it.h / 2;
      const ln = document.createElementNS(svgNS, 'polyline');
      const kx = side === 'L' ? ex + 12 : ex - 12;
      ln.setAttribute('points', `${ex},${ey} ${kx},${ey} ${it.x},${it.y}`);
      ln.setAttribute('fill', 'none'); ln.setAttribute('stroke', '#171717'); ln.setAttribute('stroke-width', '0.8');
      svg.appendChild(ln);
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', it.x); dot.setAttribute('cy', it.y); dot.setAttribute('r', '3.2'); dot.setAttribute('fill', '#E05A1E'); dot.setAttribute('stroke', '#171717'); dot.setAttribute('stroke-width', '0.6');
      svg.appendChild(dot);
    }
  }
}

// ---------- event handling ----------
const WHITE = new THREE.Color('#f8f7f3'), INKC = new THREE.Color('#2a2826'), ORC = new THREE.Color('#E05A1E');
function bodyWorld(b) { return new THREE.Vector3(b.downrange, Math.max(0, b.alt), 0); }
function burst(pos, scale = 1) {
  flash.visible = true; flash.position.copy(pos); flashT = 0; flash.userData.scale = scale;
  for (let i = 0; i < 160; i++) {
    const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar((20 + Math.random() * 60) * scale);
    parts.emit(pos, d, { life: 2 + Math.random() * 3, size: (1 + Math.random() * 2.5) * scale, color: Math.random() < 0.5 ? INKC : ORC, gravity: 1, dragK: 0.3, riseK: 0, k: 1 });
  }
  for (let i = 0; i < 40; i++) {
    const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).multiplyScalar(30 * scale);
    parts.emit(pos, d, { life: 5 + Math.random() * 4, size: 18 * scale + Math.random() * 20 * scale, color: new THREE.Color('#cfcac0'), dragK: 0.8, riseK: 2 });
  }
}
function splash(pos) {
  for (let i = 0; i < 90; i++) {
    const d = new THREE.Vector3((Math.random() - 0.5) * 30, 15 + Math.random() * 35, (Math.random() - 0.5) * 30);
    parts.emit(pos, d, { life: 2 + Math.random() * 2.5, size: 5 + Math.random() * 10, color: WHITE, gravity: 1.2, dragK: 0.5, riseK: 0 });
  }
}
function handleEvents(evs) {
  const s = app.sim.state;
  for (const e of evs) {
    app.events.push(e);
    const line = lineFor(e, s);
    if (line) setNarration(line);
    logEvent(e);
    const dist = camera.position.distanceTo(app.focusPos);
    switch (e.type) {
      case 'ignition': sound.play('ignition', { distance: dist }); break;
      case 'liftoff': sound.play('liftoff', { distance: dist }); break;
      case 'maxq': sound.play('maxq'); app.marks.push({ x: s.booster.downrange / 1000, y: s.booster.alt / 1000, label: 'MAX Q', col: '#171717' }); break;
      case 'meco': app.marks.push({ x: s.booster.downrange / 1000, y: s.booster.alt / 1000, label: 'MECO', col: '#E05A1E' }); break;
      case 'hot_staging': sound.play('hot_staging'); app.marks.push({ x: s.booster.downrange / 1000, y: s.booster.alt / 1000 + 0.01, label: 'STAGING', col: '#3FA8C9' }); break;
      case 'separation': sound.play('separation'); document.querySelectorAll('#segSeq button').forEach((b) => (b.disabled = true)); break;
      case 'catch_go': case 'catch_nogo': document.querySelectorAll('#segRecovery button').forEach((b) => (b.disabled = true)); break;
      case 'landing_burn': sound.play('landing_burn', { distance: dist }); break;
      case 'catch': sound.play('catch', { distance: dist }); for (let i = 0; i < 30; i++) parts.emit(new THREE.Vector3((Math.random() - 0.5) * 8, s.booster.alt + 66, (Math.random() - 0.5) * 8), new THREE.Vector3(0, 2, 0), { life: 3, size: 6 }); break;
      case 'splashdown': if (!e.hard) { sound.play('splash', { distance: dist }); splash(bodyWorld(s.booster)); } break;
      case 'ship_splashdown': sound.play('splash', { distance: dist }); splash(bodyWorld(s.ship)); break;
      case 'ship_reentry': document.querySelectorAll('#segTiles button').forEach((b) => (b.disabled = true)); break;
      case 'cut': sound.play('cut'); break;
      case 'vehicle_lost': {
        const bodies = e.body === 'stack' || e.body === 'all' ? ['booster', 'ship'] : [e.body];
        for (const bn of bodies) {
          const b = s[bn]; const root = bn === 'booster' ? booster.root : ship.root;
          if (!root.visible) continue;
          const p = bodyWorld(b).add(new THREE.Vector3(0, 30, 0));
          burst(p, bn === 'ship' && b.alt > 20000 ? 2.5 : 1.4);
          root.visible = false;
        }
        sound.play('lost', { distance: dist });
        if (e.body === 'booster') sound.silence();
        break;
      }
      case 'mission_end': sound.silence(); break;
    }
  }
}

// ---------- per-frame visuals ----------
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), Zax = new THREE.Vector3(0, 0, 1);
function placeStage(root, b, extraUp = 0) {
  root.position.set(b.downrange, Math.max(-6, b.alt), 0);
  root.rotation.set(0, 0, -b.attitude);
  if (extraUp) root.position.y += extraUp;
}
function updateVisuals(dt, simDt) {
  const s = app.sim.state, b = s.booster, sh = s.ship;
  const t = performance.now() / 1000;
  U.time.value += simDt;
  // stage transforms
  if (app.inspect) {
    booster.root.position.set(0, MOUNT_H, 0); booster.root.rotation.set(0, 0, 0);
    ship.root.position.set(0, MOUNT_H + 72, 0); ship.root.rotation.set(0, 0, 0);
    booster.root.visible = ship.root.visible = true;
  } else {
    placeStage(booster.root, b);
    if (s.attached) {
      ship.root.position.copy(booster.root.position).add(tmpV.set(0, 72, 0).applyEuler(booster.root.rotation));
      ship.root.rotation.copy(booster.root.rotation);
    } else placeStage(ship.root, sh);
    // tip-over after splashdown
    if (b.status === 'splashed') { app.bTip = Math.min(1, app.bTip + simDt / 6); booster.root.rotation.z = -app.bTip * 1.45; booster.root.position.y = -4 * app.bTip; }
    if (sh.status === 'splashed') { app.sTip = Math.min(1, app.sTip + simDt / 5); ship.root.rotation.z = -0.15 - app.sTip * 1.3; ship.root.position.y = -3 * app.sTip; }
  }
  // explode offsets
  const wantExplode = app.view === 'exploded' && isSafe() ? 1 : 0;
  app.explodeK += (wantExplode - app.explodeK) * (1 - Math.exp(-dt * 3));
  for (const st of [booster, ship]) for (const e of st.explode) {
    e.obj.position.copy(e.obj.userData.base).addScaledVector(tmpV.set(...e.dir), e.dist * app.explodeK);
  }
  if (app.explodeK > 0.001 && (s.attached || app.inspect)) ship.root.position.y += 22 * app.explodeK;
  // articulation
  booster.update(b, U.time.value);
  const tuck = sh.mode === 'reentry' ? 0 : (sh.mode === 'landing' ? 0.5 : 1);
  ship.update(sh, U.time.value, tuck);
  const mr = MODEL.mixtureRatio;
  const tilt = 0.035 * Math.sin(U.time.value * 0.9) + (b.gimbal || 0) * 0.6;
  booster.setLevels(b.lox / (b.propInit * mr / (1 + mr)), b.ch4 / (b.propInit / (1 + mr)), tilt);
  ship.setLevels(sh.lox / (sh.propInit * mr / (1 + mr)), sh.ch4 / (sh.propInit / (1 + mr)), tilt * 0.7);
  U.tileHeat.value = Math.min(1.4, sh.heat.flux / 380e3) * (sh.mode === 'reentry' ? 1 : 0);
  // plumes
  const prB = Math.exp(-Math.max(0, b.alt) / MODEL.H), prS = Math.exp(-Math.max(0, sh.alt) / MODEL.H);
  const thrB = b.engines.map((e) => e.act), thrS = sh.engines.map((e) => e.act);
  const sumB = thrB.reduce((a, v) => a + v, 0);
  bPlume.set(thrB, prB, Math.min(1, sumB / 20) * (booster.root.visible ? 1 : 0));
  sPlume.set(thrS, prS);
  if (!booster.root.visible) bPlume.mesh.visible = false;
  // tower: carriage, arms, QD, clamps
  let wantCar = 128, wantOpen = 1;
  if (s.liftoffT !== null && s.catchGo && b.status === 'flying') { wantCar = s.boosterTargetAlt + 66.2 - 2.05; wantOpen = b.alt - s.boosterTargetAlt < 12 ? 0 : 1; }
  if (b.status === 'caught') { wantCar = MODEL.catchHeight_m + 66.2 - 2.05; wantOpen = 0; }
  if (s.catchGo && b.status === 'flying' && b.mode === 'descent') wantCar = s.boosterTargetAlt + 66.2 - 2.05;
  if (app.inspect) { wantCar = 128; wantOpen = 1; }
  app.carriageY += (wantCar - app.carriageY) * (1 - Math.exp(-simDt * 0.6));
  app.armOpen += (wantOpen - app.armOpen) * (1 - Math.exp(-simDt * (wantOpen ? 1.5 : 2.5)));
  const qdWant = s.t >= MODEL.ignitionT - 1 && (s.phase !== 'safe' && s.phase !== 'armed') ? 1 : 0;
  app.qdOut += (qdWant - app.qdOut) * (1 - Math.exp(-simDt * 1.4));
  tower.set({ carriageY: app.carriageY, open: app.armOpen, qdOut: app.qdOut });
  app.clampK += ((s.liftoffT !== null ? 1 : 0) - app.clampK) * (1 - Math.exp(-simDt * 6));
  mount.setClamps(app.clampK);

  // particles / vapor
  const wind = { x: 2.2, z: -1.0 };
  const pre = s.liftoffT === null && !app.inspect;
  if (pre && Math.random() < dt * 9) {
    const vents = [[ -3.2, MOUNT_H + 72 + 41, 2.6 ], [ 3.0, MOUNT_H + 72 + 18, -2.8 ], [ 4.2, MOUNT_H + 58, 1.8 ], [ -4.1, MOUNT_H + 30, -1.5 ]];
    const v = vents[(Math.random() * vents.length) | 0];
    const out = new THREE.Vector3(v[0], 0, v[2]).normalize().multiplyScalar(1.5);
    parts.emit(new THREE.Vector3(v[0] * 1.05, v[1], v[2] * 1.05), out.setY(-0.6), { life: 5 + Math.random() * 3, size: 3 + Math.random() * 3, dragK: 0.6, riseK: -0.4 });
  }
  if (Math.random() < dt * 3) parts.emit(farm.ventTop.clone(), new THREE.Vector3(0, 3, 0), { life: 7, size: 5 + Math.random() * 4, dragK: 0.4, riseK: 1.5 });
  const nearGround = b.alt < 400 && sumB > 1 && booster.root.visible;
  if (nearGround) {
    const rate = Math.min(1, sumB / 33) * (1 - b.alt / 400) * 70 * Math.min(1, simDt / Math.max(dt, 1e-4) + 0.2);
    let n = rate * dt; while (n > 0) {
      if (Math.random() < n) {
        const a = Math.random() * Math.PI * 2, sp = 25 + Math.random() * 45;
        parts.emit(new THREE.Vector3(Math.cos(a) * 9, 2 + Math.random() * 6, Math.sin(a) * 9), new THREE.Vector3(Math.cos(a) * sp, 4 + Math.random() * 8, Math.sin(a) * sp), { life: 6 + Math.random() * 6, size: 16 + Math.random() * 22, dragK: 0.55, riseK: 2.5 });
      }
      n -= 1;
    }
  }
  parts.update(simDt, wind);
  parts.material.uniforms.uScale.value = (view3d.clientHeight || 600) * DPR / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  // flash
  if (flash.visible) {
    flashT += simDt;
    const k = flashT / 1.4; const sc = (flash.userData.scale || 1);
    flash.scale.setScalar((8 + 60 * Math.sqrt(k)) * sc);
    flash.material.opacity = Math.max(0, 0.55 * (1 - k) * (1 - k));
    if (k >= 1) flash.visible = false;
  }
  // ghosting (plume view) and cutaway switch
  const wantGhost = app.view === 'plume' ? 1 : 0;
  app.ghostK += (wantGhost - app.ghostK) * (1 - Math.exp(-dt * 4));
  U.ghost.value = app.ghostK;
  parts.material.uniforms.uFade.value = 1 - 0.75 * app.ghostK;
  U.cutOn.value = app.view === 'cutaway' ? 1 : 0;
}

function focusTarget() {
  const s = app.sim.state, b = s.booster, sh = s.ship;
  let f = app.camMode;
  if (app.inspect) f = 'stack';
  else if (f === 'auto') {
    if (s.attached) f = 'stack';
    else {
      const bFresh = b.status === 'flying' || (s.t - (app.events.findLast?.((e) => e.type === 'catch' || e.type === 'splashdown' || (e.type === 'vehicle_lost' && e.body === 'booster'))?.t ?? 1e9)) < 14;
      f = bFresh ? 'booster' : 'ship';
      if (sh.status !== 'flying' && sh.status !== 'splashed') f = (b.status === 'caught' || b.status === 'splashed') ? 'booster' : f;
    }
  } else if (s.attached) f = 'stack';
  const out = new THREE.Vector3();
  const pl = app.view === 'plume';
  if (f === 'stack') { booster.root.localToWorld(out.set(0, pl ? -14 : 62, 0)); }
  else if (f === 'booster') booster.root.localToWorld(out.set(0, pl ? -14 : 36, 0));
  else ship.root.localToWorld(out.set(0, pl ? -12 : 26, 0));
  return { f, p: out };
}

function updateCutPlane() {
  if (app.view !== 'cutaway') { noClipPlane.normal.set(0, 0, -1); noClipPlane.constant = 1e7; return; }
  const s = app.sim.state;
  const root = app.focus === 'ship' ? ship.root : booster.root;
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(root.quaternion);
  const c = root.getWorldPosition(new THREE.Vector3());
  const d = camera.position.clone().sub(c);
  d.addScaledVector(axis, -d.dot(axis)).normalize();
  noClipPlane.normal.copy(d).negate();
  noClipPlane.constant = d.dot(c);
  void s;
}

// ---------- HUD ----------
const PH = { safe: 'SAFE', armed: 'ARMED', count: 'TERMINAL COUNT', ignition: 'IGNITION', held: 'HOLD', ascent: 'ASCENT', staging: 'HOT STAGING', split: 'TWO VEHICLES', done: 'COMPLETE' };
let hudClock = 0;
function updateHud(dt) {
  const s = app.sim.state, b = s.booster, sh = s.ship;
  $('clock').textContent = s.counting || s.liftoffT !== null || s.phase === 'held' ? clockStr(s.t) : 'T−00:10';
  $('warpTag').textContent = s.warp > 1 ? `TIME ×${s.warp}` : (app.slow ? 'SLOW 1/25' : '');
  const tr = $('track'); tr.classList.toggle('on', s.track); tr.querySelector('b').textContent = s.track ? 'TRACK' : 'NO TRACK';
  hudClock += dt;
  if (hudClock < 0.1) return;
  hudClock = 0;
  $('phaseTag').textContent = 'PHASE · ' + (PH[s.phase] || s.phase.toUpperCase()) + (s.attached ? '' : ` · S1 ${b.mode.toUpperCase()} · S2 ${sh.mode.toUpperCase()}`);
  const fb = app.focus === 'ship' ? sh : b;
  const stageTxt = s.attached ? (s.liftoffT === null ? 'STAGE 1 + 2 · ON MOUNT' : 'STAGE 1 + 2 · STACK') : (app.focus === 'ship' ? 'STAGE 2 · STARSHIP · ' + sh.mode.toUpperCase() : 'STAGE 1 · SUPER HEAVY · ' + b.mode.toUpperCase());
  $('stageTag').textContent = app.inspect ? 'POST-FLIGHT INSPECTION · BOTH STAGES' : stageTxt;
  const alt = Math.max(0, fb.alt) / 1000;
  $('rAlt').innerHTML = `${alt.toFixed(alt < 10 ? 2 : 1)} <u>km</u>`;
  $('rVel').innerHTML = `${fmt(fb.speed)} <u>m/s</u>`;
  const thr = (s.attached ? b.thrust + sh.thrust : fb.thrust) / (1000 * MODEL.g0);
  $('rThr').innerHTML = `${fmt(thr)} <u>tf</u>`;
  const pr = (s.attached ? prop(b) + prop(sh) : prop(fb)) / 1000;
  $('rProp').innerHTML = `${fmt(pr)} <u>t</u>`;
  $('rQ').innerHTML = `${(fb.q / 1000).toFixed(1)} <u>kPa</u>`;
  const m = sh.heat.margin;
  const rt = $('rTherm'); rt.innerHTML = `${(Math.max(-1, m) * 100).toFixed(0)} <u>%</u>`; rt.classList.toggle('warn', m < 0.2);
  // controls
  const ig = $('btnIgnite'); ig.disabled = s.phase !== 'armed'; ig.classList.toggle('ready', s.phase === 'armed');
  const inWin = s.liftoffT !== null && s.stageT === null && !s.done && (s.mecoT !== null || (prop(b) - 0.12 * b.propInit) / Math.max(1, b.mdot) < MODEL.stageEarly + 4);
  $('btnStage').classList.toggle('window', inWin);
  if (s.phase === 'safe' && $('rs').dataset.pos !== 'safe' && !s.terminated) setSwitch('safe');
  if (app.wantView === 'exploded' && app.view !== 'exploded' && isSafe()) setView('exploded');
  if (app.view === 'exploded' && !isSafe()) { setView('painted'); }
}

// ---------- drawing overlays ----------
const dwgEls = [...document.querySelectorAll('.dwg')];
function drawOverlay(el, key, frame, w, h) {
  const cv = el.querySelector('.dwg-ov');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  if (!frame) return;
  const X = (x) => (x - frame.left) / (frame.right - frame.left) * w;
  const Y = (y) => (frame.top - y) / (frame.top - frame.bottom) * h;
  const INK = '#171717', CY = '#1f7d9c', OR = '#E05A1E';
  c.font = '500 8px "IBM Plex Mono", monospace'; c.lineWidth = 0.7;
  const centre = (x0, x1, y) => { c.strokeStyle = CY; c.setLineDash([7, 2, 1.5, 2]); c.beginPath(); c.moveTo(X(x0), Y(y)); c.lineTo(X(x1), Y(y)); c.stroke(); c.setLineDash([]); };
  const label = (s, x, y, col = INK, align = 'left') => { c.fillStyle = col; c.textAlign = align; c.fillText(s, x, y); };
  const arrowDim = (x0, y0, x1, y1, text, horiz) => {
    c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    const ah = (x, y, dx, dy) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx * 4 - dy * 2, y + dy * 4 + dx * 2); c.lineTo(x + dx * 4 + dy * 2, y + dy * 4 - dx * 2); c.closePath(); c.fill(); };
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    ah(x0, y0, ux, uy); ah(x1, y1, -ux, -uy);
    c.save(); c.fillStyle = '#F2EFE7';
    const tw = c.measureText(text).width + 4;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (horiz) { c.fillRect(mx - tw / 2, my - 5, tw, 9); c.restore(); label(text, mx, my + 3, INK, 'center'); }
    else { c.fillRect(mx - tw / 2, my - 5, tw, 9); c.restore(); label(text, mx, my + 3, INK, 'center'); }
  };
  const R0 = drawings.ROW, s = app.sim.state;
  if (key === 'plan') {
    c.strokeStyle = CY; c.setLineDash([7, 2, 1.5, 2]);
    c.beginPath(); c.moveTo(X(-11), Y(0)); c.lineTo(X(11), Y(0)); c.moveTo(X(0), Y(-11)); c.lineTo(X(0), Y(11)); c.stroke(); c.setLineDash([]);
    // plan camera looks down with up = -z; world x maps to screen x and world z to screen y
    arrowDim(X(-4.5), h - 12, X(4.5), h - 12, 'Ø 9 m', true);
    c.strokeStyle = 'rgba(23,23,23,0.35)'; c.beginPath(); c.moveTo(X(-4.5), Y(0)); c.lineTo(X(-4.5), h - 9); c.moveTo(X(4.5), Y(0)); c.lineTo(X(4.5), h - 9); c.stroke();
    label('S2 over S1', 5, 11, INK);
    label('WINDWARD +x', w - 5, 11, CY, 'right');
  } else {
    centre(R0.x0 - 2, R0.x0 + 74, R0.b); centre(R0.x0 - 2, R0.x0 + 54, R0.s);
    label('S1', X(R0.x0) - 3, Y(R0.b) + 3, INK, 'right'); label('S2', X(R0.x0) - 3, Y(R0.s) + 3, INK, 'right');
    if (key === 'front') {
      arrowDim(X(R0.x0), Y(R0.b + 7.6), X(R0.x0 + 72), Y(R0.b + 7.6), '72 m', true);
      arrowDim(X(R0.x0), Y(R0.s - 7.6), X(R0.x0 + 52), Y(R0.s - 7.6), '52 m', true);
      c.strokeStyle = 'rgba(23,23,23,0.35)';
      for (const [x, y0, y1] of [[R0.x0, R0.b, R0.b + 8.4], [R0.x0 + 72, R0.b, R0.b + 8.4], [R0.x0, R0.s, R0.s - 8.4], [R0.x0 + 52, R0.s, R0.s - 8.4]]) { c.beginPath(); c.moveTo(X(x), Y(y0)); c.lineTo(X(x), Y(y1)); c.stroke(); }
    }
    if (key === 'front' || key === 'section') {
      const xd = X(R0.x0 + (key === 'front' ? 50 : 64.5));
      arrowDim(xd, Y(R0.b + 4.5), xd, Y(R0.b - 4.5), '9 m', false);
    }
    if (key === 'section') {
      const tags = [['LOX', R0.x0 + 24, R0.b], ['CH4', R0.x0 + 54, R0.b], ['DOME', R0.x0 + 44, R0.b - 6.2], ['RING', R0.x0 + 71, R0.b + 6], ['LOX', R0.x0 + 16, R0.s], ['CH4', R0.x0 + 34, R0.s], ['DOME', R0.x0 + 28, R0.s + 6.2]];
      for (const [t, x, y] of tags) { c.fillStyle = 'rgba(242,239,231,0.85)'; const tw = c.measureText(t).width + 4; c.fillRect(X(x) - tw / 2, Y(y) - 6, tw, 9); label(t, X(x), Y(y) + 2, OR, 'center'); }
      label('A-A', w - 5, h - 5, OR, 'right');
    }
    if (s.booster.status === 'lost') label('S1 LOST', w - 5, Y(R0.b) + 3, OR, 'right');
    if (s.ship.status === 'lost') label('S2 LOST', w - 5, Y(R0.s) + 3, OR, 'right');
  }
}

// ---------- main loop ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0, fpsShown = 0;
const overlayKey = {};
newSim();
setView('painted');
orbit.target.copy(focusTarget().p);
app.focusPos.copy(orbit.target);

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fpsShown = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; $('fps').textContent = `${fpsShown.toFixed(0)} fps`; }
  // time
  const want = app.slow ? 1 / 25 : 1;
  app.timeScale += (want - app.timeScale) * (1 - Math.exp(-dt * 2.5));
  const s = app.sim.state;
  const simDt = dt * app.timeScale * (app.slow ? 1 : s.warp) * (app.debugScale || 1);
  const evs = app.sim.step(simDt);
  if (evs.length) handleEvents(evs);
  app.inspect = app.view === 'exploded' && s.done;
  updateVisuals(dt, simDt);

  // focus + camera
  const ft = focusTarget();
  if (ft.f !== app.lastFocus) {
    // smooth hand-over between focus targets; a long jump cuts instead
    app.switchOff = ft.p.distanceTo(app.focusPos) > 3000 ? new THREE.Vector3() : app.focusPos.clone().sub(ft.p);
    app.lastFocus = ft.f;
  }
  app.focus = ft.f;
  if (app.switchOff) app.switchOff.multiplyScalar(Math.exp(-dt * 3));
  app.focusPos.copy(ft.p); if (app.switchOff) app.focusPos.add(app.switchOff);
  orbit.target.copy(app.focusPos);
  orbit.update(dt);
  if (camera.position.y < 3) { camera.position.y = 3; camera.lookAt(orbit.target.clone().add(orbit.offset)); }
  updateCutPlane();
  // world follows camera
  const camAlt = camera.position.y;
  ground.position.set(camera.position.x, 0, camera.position.z);
  const gs = Math.max(8000, camAlt * 40); ground.scale.set(gs, 1, gs);
  sky.material.uniforms.uAlt.value = camAlt;
  scene.fog.near = 1800 + camAlt * 2; scene.fog.far = 30000 + camAlt * 6;
  key.position.copy(app.focusPos).add(tmpV.set(-170, 95, 70)); key.target.position.copy(app.focusPos);
  if (app.focusPos.y < 600 && Math.abs(app.focusPos.x) < 600) { key.target.position.set(0, 60, 0); key.position.set(-170, 155, 70); }

  // audio
  const b = s.booster, sh = s.ship;
  const actB = b.engines.reduce((a, e) => a + e.act, 0), actS = sh.engines.reduce((a, e) => a + e.act, 0);
  const focusB = app.focus !== 'ship';
  const fb = focusB ? b : sh;
  const visible = (focusB ? booster.root.visible : ship.root.visible);
  const level = visible ? (focusB ? (actB + (s.attached ? actS * 1.2 : 0)) / 33 : actS / 6 * 0.7) : 0;
  const hiss = sh.mode === 'reentry' && !focusB ? Math.min(1, sh.heat.flux / 300e3) : 0;
  const whistle = b.status === 'flying' && b.mode !== 'landing' && b.q > 3000 && focusB ? Math.min(1, b.q / 40000) : 0;
  sound.update({ level, engines: focusB ? actB : actS, pr: Math.exp(-Math.max(0, fb.alt) / MODEL.H), distance: camera.position.distanceTo(app.focusPos), hiss, whistle, whistleF: 500 + b.speed * 0.6 });

  // render main view
  renderer.setScissorTest(false);
  const cw = window.innerWidth, ch = window.innerHeight;
  renderer.clear();
  const r = view3d.getBoundingClientRect();
  if (r.bottom > 0 && r.top < ch && r.width > 0) {
    camera.aspect = r.width / r.height; camera.near = Math.max(0.5, orbit.radius * 0.02); camera.updateProjectionMatrix();
    const y = ch - r.bottom;
    renderer.setViewport(r.left, y, r.width, r.height); renderer.setScissor(r.left, y, r.width, r.height); renderer.setScissorTest(true);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    layoutCallouts(r, app.explodeK > 0.6 && app.view === 'exploded');
  }
  // drawings
  const rects = {};
  for (const el of dwgEls) {
    const win = el.querySelector('.dwg-win'); const rr = win.getBoundingClientRect();
    if (rr.bottom < 0 || rr.top > ch || rr.width < 4) continue;
    rects[el.dataset.dwg] = { x: rr.left, y: rr.top, w: rr.width, h: rr.height, el, win };
  }
  const frames = drawings.render(rects, DPR, { sepGap: s.attached ? 0 : 6 });
  for (const [k, rr] of Object.entries(rects)) {
    const sig = `${Math.round(rr.w)}x${Math.round(rr.h)}|${s.booster.status}|${s.ship.status}`;
    if (overlayKey[k] !== sig && frames[k]) { overlayKey[k] = sig; drawOverlay(rr.win, k, frames[k], rr.w, rr.h); }
  }
  // instruments (alternate frames)
  app.frame++;
  if (app.frame % 2 === 0) { drawThrust($('iThrust'), app.sim); drawPropellant($('iProp'), app.sim); }
  else { drawTrajectory($('iTraj'), app.sim, app.marks); drawEvents($('iEvents'), app.sim, app.events); }
  updateHud(dt);
  void cw;
}
function onResize() { renderer.setSize(window.innerWidth, window.innerHeight, false); setSwitch($('rs').dataset.pos || 'safe'); for (const k in overlayKey) overlayKey[k] = ''; }
window.addEventListener('resize', onResize);
requestAnimationFrame(frame);
// headless/debug hooks: jump the simulation forward while still routing every event
window.__app = app; window.__dbg = { camera, orbit, scene };
window.__advance = (sec, step = 0.05) => {
  let n = Math.ceil(sec / step);
  while (n-- > 0 && !app.sim.state.done) { const ev = app.sim.step(step * app.sim.state.warp); if (ev.length) handleEvents(ev); updateVisuals(step, step); }
  return app.sim.state.t;
};
window.__advanceTo = (t) => { while (app.sim.state.t < t && !app.sim.state.done) window.__advance(0.5); return app.sim.state.t; };
