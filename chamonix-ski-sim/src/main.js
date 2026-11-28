/**
 * CHAMONIX / MONT BLANC — Off-Piste Freeride Skiing Simulator (Wave 4)
 * First-Person Helmet-Cam POV · Strict 120 Hz 4-Point Physics · Real EU-DEM Topography
 * Switch Skiing · Dynamic Slab Avalanches · Line-Scout Helicopter Cam (V) · 30 Hz Replay (P)
 */
import * as THREE from 'three';
import { ChamonixTerrainData, SURFACE_TYPES } from './terrain_data.js';
import { LIGHTING_PRESETS, sunDirFromPreset } from './lighting_presets.js';
import { createSkyAndClouds } from './sky_atmosphere.js';
import { SnowTrackBuffer } from './snow_tracks.js';
import { createTerrainSystem } from './terrain_renderer.js';
import { createAlpineProps } from './alpine_props.js';
import { AlpineParticleSystem } from './particles.js';
import { createSkiRig } from './ski_rig.js';
import { SkiPhysics } from './physics.js';
import { OpticalPostPipeline } from './post_optics.js';
import { SkiAudioEngine } from './audio.js';

const params = new URLSearchParams(window.location.search);

const canvas = document.getElementById('viewport');
const ui = {
  loader: document.getElementById('loader'),
  loaderMsg: document.getElementById('loaderMsg'),
  hud: document.getElementById('hud'),
  speedVal: document.getElementById('speedVal'),
  altVal: document.getElementById('altVal'),
  slopeVal: document.getElementById('slopeVal'),
  edgeVal: document.getElementById('edgeVal'),
  dropVal: document.getElementById('dropVal'),
  fallArrowGroup: document.getElementById('fallArrowGroup'),
  surfaceChip: document.getElementById('surfaceChip'),
  stanceChip: document.getElementById('stanceChip'),
  switchChip: document.getElementById('switchChip'),
  airBadge: document.getElementById('airBadge'),
  avyBanner: document.getElementById('avyBanner'),
  avyDetail: document.getElementById('avyDetail'),
  modeBanner: document.getElementById('modeBanner'),
  modeTitle: document.getElementById('modeTitle'),
  modeSub: document.getElementById('modeSub'),
  replayBar: document.getElementById('replayBar'),
  replayFill: document.getElementById('replayFill'),
  trickToast: document.getElementById('trickToast'),
  crashBanner: document.getElementById('crashBanner'),
  crashReason: document.getElementById('crashReason'),
  zoneName: document.getElementById('zoneName'),
  lightName: document.getElementById('lightName'),
  camName: document.getElementById('camName'),
  fpsVal: document.getElementById('fpsVal'),
  popBar: document.getElementById('popBar'),
  popFill: document.getElementById('popFill'),
  compassRibbon: document.getElementById('compassRibbon'),
  controlsHint: document.getElementById('controlsHint'),
  dropMenu: document.getElementById('dropMenu'),
  btnSound: document.getElementById('btnSound'),
  btnCam: document.getElementById('btnCam'),
  btnLight: document.getElementById('btnLight'),
  btnScout: document.getElementById('btnScout'),
  btnReplay: document.getElementById('btnReplay'),
  btnAvyToggle: document.getElementById('btnAvyToggle'),
  btnAvy: document.getElementById('btnAvy'),
  btnHeadSteer: document.getElementById('btnHeadSteer'),
  btnReset: document.getElementById('btnReset'),
  btnHelp: document.getElementById('btnHelp'),
  btnSettings: document.getElementById('btnSettings'),
  btnSettingsClose: document.getElementById('btnSettingsClose'),
  btnSettingsReset: document.getElementById('btnSettingsReset'),
  settingsPanel: document.getElementById('settingsPanel'),
  qualGroup: document.getElementById('qualGroup'),
  setQualLabel: document.getElementById('setQualLabel'),
  setQualDetail: document.getElementById('setQualDetail'),
  setVolSlider: document.getElementById('setVolSlider'),
  setVolVal: document.getElementById('setVolVal'),
  setSensSlider: document.getElementById('setSensSlider'),
  setSensVal: document.getElementById('setSensVal'),
  setInvertY: document.getElementById('setInvertY'),
  setMotionBlur: document.getElementById('setMotionBlur'),
  setSmoothCarve: document.getElementById('setSmoothCarve'),
  setAvalanches: document.getElementById('setAvalanches'),
  setGamepadStatus: document.getElementById('setGamepadStatus'),
  fpsChip: document.getElementById('fpsChip'),
  lockHint: document.getElementById('lockHint'),
  startOverlay: document.getElementById('startOverlay'),
  rawRecPill: document.getElementById('rawRecPill'),
  rawRecTime: document.getElementById('rawRecTime'),
  rawRecMeta: document.getElementById('rawRecMeta'),
};

const autoCaptureMode = params.get('autoCapture') === '1';

function showWebGLFallback(titleText, detailText) {
  let banner = document.getElementById('webglFallbackBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'webglFallbackBanner';
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'assertive');
    Object.assign(banner.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '9999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'rgba(8, 14, 26, 0.92)',
      color: '#f1f5f9',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textAlign: 'center',
    });
    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '420px',
      padding: '24px 28px',
      borderRadius: '14px',
      background: 'rgba(15, 23, 42, 0.95)',
      border: '1px solid rgba(148, 163, 184, 0.28)',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
    });
    const h = document.createElement('h2');
    h.id = 'webglFallbackTitle';
    Object.assign(h.style, { margin: '0 0 8px', fontSize: '18px', fontWeight: '700' });
    const p = document.createElement('p');
    p.id = 'webglFallbackDetail';
    Object.assign(p.style, { margin: '0', fontSize: '14px', lineHeight: '1.5', color: '#cbd5e1' });
    card.append(h, p);
    banner.appendChild(card);
    document.body.appendChild(banner);
  }
  const titleEl = document.getElementById('webglFallbackTitle');
  const detailEl = document.getElementById('webglFallbackDetail');
  if (titleEl) titleEl.textContent = titleText;
  if (detailEl) detailEl.textContent = detailText;
  banner.style.display = 'flex';
  if (ui.loader) ui.loader.style.display = 'none';
}

const gl2Context = canvas?.getContext('webgl2', {
  antialias: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: autoCaptureMode,
});
if (!gl2Context) {
  showWebGLFallback(
    'WebGL2 Required',
    'Chamonix Ski Sim requires a browser and GPU with WebGL2 enabled. Please enable hardware acceleration or try a supported browser.'
  );
  throw new Error('WebGL2 context unavailable');
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl2Context,
    antialias: false, // 4× MSAA + directional FXAA handled inside HDR HalfFloat pipeline!
    powerPreference: 'high-performance',
    preserveDrawingBuffer: autoCaptureMode,
  });
} catch (err) {
  showWebGLFallback(
    'Graphics Initialization Failed',
    'Unable to initialize the WebGL2 3D renderer on this device. Please reload or check browser hardware acceleration.'
  );
  throw err;
}

canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  showWebGLFallback(
    'Graphics Context Lost',
    'The WebGL2 graphics context was interrupted. Waiting for GPU recovery—if it does not resume, please reload the page.'
  );
});

canvas.addEventListener('webglcontextrestored', () => {
  const banner = document.getElementById('webglFallbackBanner');
  if (banner) banner.style.display = 'none';
});
let DPR = autoCaptureMode ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(86, window.innerWidth / window.innerHeight, 0.09, 52000);

// Strictly ONE dominant directional sun key with tight ±3.6m high-density PCF shadow frustum centered on skier!
// Orthographic rays run parallel to -sunDir, so centering on the skier keeps the entire body/helmet inside ±3.6m
// perpendicular to sunDir even when low-angle shadows stretch 30m+ downhill (far = 62m covers 48m down-shadow!).
const keyLight = new THREE.DirectionalLight(0xfff0d8, 2.15);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 1.0;
keyLight.shadow.camera.far = 62.0;
keyLight.shadow.camera.left = -3.6;
keyLight.shadow.camera.right = 3.6;
keyLight.shadow.camera.top = 3.6;
keyLight.shadow.camera.bottom = -3.6;
keyLight.shadow.bias = -0.00045;
keyLight.shadow.normalBias = 0.015;
scene.add(keyLight);
scene.add(keyLight.target);
const hemiLight = new THREE.HemisphereLight(0x4a7de0, 0x869bb8, 0.64);
scene.add(hemiLight);

let terrainData, trackBuffer, terrainSys, skySys, propsSys, particles, skiRig, physics, post, audio;
let lightIdx = 0;
let zoneIdx = 0;
const CAM_MODES = [
  { id: 'gopro', label: 'HELMET POV' },
  { id: 'chesty', label: 'CHESTY CAM' },
  { id: 'clean', label: 'VISOR POV' },
];
let camModeIdx = 0;
let simTime = 0;
let physAccum = 0;
const FIXED_DT = 1 / 120;
let lensWet = 0;
let smoothExposure = 0.72;
const reqHudParam = params.get('hud');
let hudMode = reqHudParam === '0' ? 2 : (reqHudParam === 'raw' ? 1 : 0); // 0=Full, 1=RAW Action-Cam REC, 2=Hidden
let hudVisible = hudMode === 0;
let fpsFrames = 0;
let fpsAccum = 0;
let lastFps = 60;
let pointerLocked = false;
let hoverLastX = null;
let hoverLastY = null;
let hoverNormX = 0; // [-1..+1] horizontal position for gentle unlocked edge-pan
let hoverInsideCanvas = false;
let started = params.has('autostart') || params.has('zone') || params.has('cam') || params.has('light') || params.has('demo');

// Line-Scout Helicopter Cam (`V`) state
let scoutActive = false;
let scoutPhase = 0; // [0..1]
const SCOUT_DURATION = 11.5;

// Instant 30 Hz Helicopter Replay (`P`) state
let replayActive = false;
let replayCursor = 0;
let inspectBodyView = null; // optional deterministic 3rd-person close-up inspection mode (`body_close` / `body_back`)
let customToast = '';
let customToastUntil = -99;

// Bundle F: User Settings, Quality Tiers, Auto-Adaptive Resolution & Gamepad/Touch Ergonomics
const SETTINGS_KEY = 'chamonix_ski_settings_v1';
const DEFAULT_SETTINGS = {
  quality: 'auto', // 'auto' | 'high' | 'med' | 'low'
  volume: 1.0,
  lookSens: 1.0,
  invertY: false,
  motionBlur: true,
  smoothCarve: false,
  avalanches: true,
};
const settings = { ...DEFAULT_SETTINGS };
let settingsOpen = false;
let activeTier = 0; // 0=HIGH, 1=MED, 2=LOW
let activeSkipBloom = false;
let activeSkipGodRays = false;
let autoFpsAccum = 0;
let autoFpsFrames = 0;
let autoLowStreak = 0;
let autoHighStreak = 0;

function loadSavedSettings() {
  try {
    const raw = window.localStorage && window.localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (['auto', 'high', 'med', 'low'].includes(parsed.quality)) settings.quality = parsed.quality;
        if (typeof parsed.volume === 'number') settings.volume = THREE.MathUtils.clamp(parsed.volume, 0, 1);
        if (typeof parsed.lookSens === 'number') settings.lookSens = THREE.MathUtils.clamp(parsed.lookSens, 0.4, 2.2);
        if (typeof parsed.invertY === 'boolean') settings.invertY = parsed.invertY;
        if (typeof parsed.motionBlur === 'boolean') settings.motionBlur = parsed.motionBlur;
        if (typeof parsed.smoothCarve === 'boolean') settings.smoothCarve = parsed.smoothCarve;
        if (typeof parsed.avalanches === 'boolean') settings.avalanches = parsed.avalanches;
      }
    }
  } catch (_e) {
    // Fallback for sandboxed/opaque-origin iframes; keep settings in memory.
  }
  const reqQ = (params.get('quality') || '').toLowerCase();
  if (['auto', 'high', 'med', 'low'].includes(reqQ)) settings.quality = reqQ;
  const reqAvy = (params.get('avy') ?? params.get('avalanches') ?? '').toLowerCase();
  if (reqAvy === '0' || reqAvy === 'false' || reqAvy === 'off') settings.avalanches = false;
  else if (reqAvy === '1' || reqAvy === 'true' || reqAvy === 'on') settings.avalanches = true;
}

function saveSettings() {
  try {
    if (window.localStorage) window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (_e) {}
}

function computeTierFromMode() {
  if (settings.quality === 'high') return 0;
  if (settings.quality === 'med') return 1;
  if (settings.quality === 'low') return 2;
  return activeTier;
}

function applyQualityTier(tier, silent = true) {
  activeTier = THREE.MathUtils.clamp(tier | 0, 0, 2);
  const nativeDpr = autoCaptureMode ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  let targetDpr = nativeDpr;
  let targetMsaa = post ? post.maxHardwareSamples : 4;
  activeSkipGodRays = false;
  activeSkipBloom = false;

  if (activeTier === 1) {
    targetDpr = Math.max(0.75, Math.min(1.15, nativeDpr * 0.78));
    targetMsaa = 0;
  } else if (activeTier === 2) {
    targetDpr = Math.max(0.62, Math.min(0.76, nativeDpr * 0.65));
    targetMsaa = 0;
    activeSkipGodRays = true;
    activeSkipBloom = true;
  }

  DPR = targetDpr;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const rw = Math.max(1, Math.round(w * DPR));
  const rh = Math.max(1, Math.round(h * DPR));
  renderer.setPixelRatio(DPR);
  renderer.setSize(w, h, false);
  if (post) {
    post.setMSAA(targetMsaa);
    post.resize(rw, rh);
  }
  if (ui.fpsChip) {
    ui.fpsChip.classList.toggle('adapted', settings.quality === 'auto' && activeTier > 0);
  }
  syncSettingsUI();
  if (!silent) {
    const names = ['HIGH', 'MEDIUM', 'LOW'];
    showToast(`AUTO QUALITY → ${names[activeTier]} (${rw}×${rh})`, 2.6);
  }
}

function setQualityMode(mode) {
  if (!['auto', 'high', 'med', 'low'].includes(mode)) return;
  settings.quality = mode;
  autoLowStreak = 0;
  autoHighStreak = 0;
  if (mode === 'high') applyQualityTier(0, true);
  else if (mode === 'med') applyQualityTier(1, true);
  else if (mode === 'low') applyQualityTier(2, true);
  else applyQualityTier(0, true);
  saveSettings();
}

function toggleSettings(forceVal = null) {
  settingsOpen = forceVal !== null ? !!forceVal : !settingsOpen;
  if (ui.settingsPanel) ui.settingsPanel.classList.toggle('open', settingsOpen);
  if (ui.btnSettings) ui.btnSettings.classList.toggle('active', settingsOpen);
  if (settingsOpen && document.pointerLockElement === canvas && document.exitPointerLock) {
    try { document.exitPointerLock(); } catch (_e) {}
  }
}

function syncSettingsUI() {
  const tierNames = ['HIGH', 'MED', 'LOW'];
  const rw = Math.max(1, Math.round(window.innerWidth * DPR));
  const rh = Math.max(1, Math.round(window.innerHeight * DPR));
  const aaTxt = (post && post.msaaSamples > 0) ? `${post.msaaSamples}× MSAA` : 'FXAA';
  const fxTxt = activeSkipGodRays ? 'Fast Optics' : 'God-Rays + Bloom';
  if (ui.setQualLabel) {
    ui.setQualLabel.textContent = settings.quality === 'auto'
      ? `AUTO (${tierNames[activeTier]})`
      : tierNames[activeTier];
  }
  if (ui.setQualDetail) {
    ui.setQualDetail.textContent = `${rw}×${rh} · ${aaTxt} · ${fxTxt}`;
  }
  if (ui.qualGroup) {
    ui.qualGroup.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.q === settings.quality);
    });
  }
  if (ui.setVolSlider) ui.setVolSlider.value = String(Math.round(settings.volume * 100));
  if (ui.setVolVal) ui.setVolVal.textContent = `${Math.round(settings.volume * 100)}%`;
  if (ui.setSensSlider) ui.setSensSlider.value = String(Math.round(settings.lookSens * 100));
  if (ui.setSensVal) ui.setSensVal.textContent = `${settings.lookSens.toFixed(1)}×`;
  if (ui.setInvertY) {
    ui.setInvertY.textContent = settings.invertY ? 'ON' : 'OFF';
    ui.setInvertY.classList.toggle('on', settings.invertY);
  }
  if (ui.setMotionBlur) {
    ui.setMotionBlur.textContent = settings.motionBlur ? 'ON' : 'OFF';
    ui.setMotionBlur.classList.toggle('on', settings.motionBlur);
  }
  if (ui.setSmoothCarve) {
    ui.setSmoothCarve.textContent = settings.smoothCarve ? 'SMOOTH' : 'DIRECT';
    ui.setSmoothCarve.classList.toggle('on', settings.smoothCarve);
  }
  if (ui.setAvalanches) {
    ui.setAvalanches.textContent = settings.avalanches ? 'ON' : 'OFF';
    ui.setAvalanches.classList.toggle('on', settings.avalanches);
  }
  if (ui.btnAvyToggle) {
    ui.btnAvyToggle.textContent = settings.avalanches ? 'AVY: ON' : 'AVY: OFF';
    ui.btnAvyToggle.classList.toggle('on', settings.avalanches);
    ui.btnAvyToggle.classList.toggle('off', !settings.avalanches);
  }
  if (ui.btnAvy) {
    ui.btnAvy.classList.toggle('avy-off', !settings.avalanches);
    if (!settings.avalanches) ui.btnAvy.classList.remove('active');
  }
}

function setAvalanchesEnabled(enabled, showMsg = false) {
  settings.avalanches = !!enabled;
  if (physics) physics.setAvalanchesEnabled(settings.avalanches);
  if (!settings.avalanches) {
    if (particles) particles.clearAvalanchePuffs();
    if (ui.avyBanner) ui.avyBanner.classList.remove('show');
    if (ui.btnAvy) ui.btnAvy.classList.remove('active');
  }
  syncSettingsUI();
  saveSettings();
  if (showMsg) {
    showToast(settings.avalanches ? 'AVALANCHES ENABLED' : 'AVALANCHES OFF', 2.0);
  }
}

// Gamepad edge-trigger button memory
const _gpPrevBtn = {};
function updateGamepadLabel() {
  if (!ui.setGamepadStatus) return;
  let activePad = null;
  try {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) { activePad = pads[i]; break; }
    }
  } catch (_e) {}
  if (activePad) {
    const shortId = (activePad.id || 'Controller').split('(')[0].trim().slice(0, 24);
    ui.setGamepadStatus.textContent = `GAMEPAD: ${shortId.toUpperCase()}`;
    ui.setGamepadStatus.classList.add('connected');
  } else {
    ui.setGamepadStatus.textContent = 'GAMEPAD: NONE DETECTED';
    ui.setGamepadStatus.classList.remove('connected');
  }
}

function applyStickCurve(val, dead = 0.12) {
  const a = Math.abs(val);
  if (a <= dead) return 0;
  const n = (a - dead) / (1.0 - dead);
  return Math.sign(val) * (n * 0.45 + n * n * n * 0.55);
}

function pollGamepad(dt) {
  if (!physics) return;
  let pad = null;
  try {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) { pad = pads[i]; break; }
    }
  } catch (_e) { return; }

  if (!pad) {
    physics.gamepadSteer = 0;
    physics.gamepadFore = 0;
    physics.gamepadBrake = 0;
    physics.gamepadCork = 0;
    physics.gamepadJump = false;
    physics.gamepadGrab = false;
    return;
  }

  const lx = applyStickCurve(pad.axes[0] || 0, 0.10);
  const ly = applyStickCurve(pad.axes[1] || 0, 0.12);
  const rx = applyStickCurve(pad.axes[2] || 0, 0.13);
  const ry = applyStickCurve(pad.axes[3] || 0, 0.13);

  const btn = (idx) => !!(pad.buttons[idx] && (pad.buttons[idx].pressed || pad.buttons[idx].value > 0.35));
  const val = (idx) => (pad.buttons[idx] ? pad.buttons[idx].value : 0);
  const justPressed = (idx) => {
    const cur = btn(idx);
    const prev = !!_gpPrevBtn[idx];
    _gpPrevBtn[idx] = cur;
    return cur && !prev;
  };

  if (!started && (Math.abs(lx) > 0.25 || Math.abs(ly) > 0.25 || btn(0) || btn(7))) {
    audio.unlock();
    started = true;
    ui.startOverlay.classList.add('hidden');
    physics.triggerPoleStroke(0, simTime, 0.85);
  }

  physics.gamepadSteer = lx;
  physics.gamepadFore = -ly; // push left stick UP -> tuck/push forward
  physics.gamepadBrake = val(6) > 0.08 ? val(6) : 0; // L2 analog brake/slash
  physics.gamepadJump = btn(0) || val(7) > 0.35;     // A/Cross or R2 -> crouch/pop
  physics.gamepadGrab = btn(1);                      // B/Circle -> Mute grab
  physics.gamepadCork = (btn(5) ? 1 : 0) - (btn(4) ? 1 : 0); // R1/L1 -> air cork

  if ((Math.abs(rx) > 0 || Math.abs(ry) > 0) && started && !scoutActive && !replayActive && !pausedSim) {
    const ySign = settings.invertY ? 1 : -1;
    physics.addHeadLookDelta(rx * 2.5 * settings.lookSens * dt, ry * 1.9 * settings.lookSens * ySign * dt);
  }

  if (justPressed(3)) { exitSpecialModes(); setCamMode(camModeIdx + 1); } // Y/Triangle: Cam
  if (justPressed(2) && physics.state.grounded && !physics.state.crashed) { // X/Square: Switch hop (180° perspective flip!)
    if (physics.toggleSwitch(simTime, false)) {
      audio.playPop(0.45);
      showToast(physics.state.isSwitch ? 'SWITCH STANCE (FAKIE · VIEW FLIPPED 180°)' : 'FORWARD STANCE', 1.8);
    }
  }
  if (justPressed(12)) setLight(lightIdx + 1);       // D-pad Up: Lighting
  if (justPressed(14)) spawnAtZone(zoneIdx - 1);     // D-pad Left: Prev Drop Zone
  if (justPressed(15)) spawnAtZone(zoneIdx + 1);     // D-pad Right: Next Drop Zone
  if (justPressed(9)) {                              // Start/Menu: Reset
    if (scoutActive || replayActive) exitSpecialModes();
    else if (physics.state.crashed) physics.standUpHere();
    else spawnAtZone(zoneIdx);
  }
  if (justPressed(8)) toggleSettings();              // Select/Back: Settings
}

const _surfById = {};
Object.values(SURFACE_TYPES).forEach((st) => { _surfById[st.id] = st; });
const _replayProxy = {
  x: 0, y: 0, z: 0, terrainY: 0,
  normal: new THREE.Vector3(0, 1, 0),
  quat: new THREE.Quaternion(),
  yaw: 0, edgeAngle: 0, crouch: 0, foreAft: 0, slipAngle: 0,
  turnLead: 0, shiftyAngle: 0, landImpact: 0,
  grabbing: false, speed: 0, grounded: true, crashed: false, isSwitch: false,
  slopeDeg: 0, surface: SURFACE_TYPES.POWDER, sprayRate: 0,
  polePlantL: 0, polePlantR: 0, skatePhase: 0, skatePush: 0,
  insideUnweight: 0, scissorSpread: 0, bowWave: 0,
};

function showToast(msg, duration = 2.6) {
  customToast = msg;
  customToastUntil = simTime + duration;
}

function setHudMode(mode) {
  hudMode = ((mode % 3) + 3) % 3;
  hudVisible = hudMode === 0;
  ui.hud.classList.toggle('hidden', hudMode !== 0);
  if (ui.rawRecPill) {
    ui.rawRecPill.classList.toggle('show', hudMode === 1);
  }
}

function setHudVisibility(visible) {
  if (visible === 'raw' || visible === 1) setHudMode(1);
  else if (visible === 'hidden' || visible === 2 || visible === false) setHudMode(2);
  else setHudMode(0);
}

function setLight(idx) {
  lightIdx = ((idx % LIGHTING_PRESETS.length) + LIGHTING_PRESETS.length) % LIGHTING_PRESETS.length;
  const p = LIGHTING_PRESETS[lightIdx];
  smoothExposure = p.exposure;
  ui.lightName.textContent = p.name;
  const sunDir = sunDirFromPreset(p);
  keyLight.position.copy(sunDir).multiplyScalar(8000);
  keyLight.color.copy(p.sunColor);
  keyLight.intensity = p.sunIntensity * 0.95;
  hemiLight.color.copy(p.shadowSkyColor);
  hemiLight.groundColor.copy(p.groundBounceColor);
  hemiLight.intensity = p.shadowFillStrength * 0.95;
}

function setCamMode(idx) {
  camModeIdx = ((idx % CAM_MODES.length) + CAM_MODES.length) % CAM_MODES.length;
  ui.camName.textContent = CAM_MODES[camModeIdx].label;
  if (physics) physics.setCamMode(CAM_MODES[camModeIdx].id);
}

function exitSpecialModes() {
  scoutActive = false;
  replayActive = false;
  inspectBodyView = null;
  ui.btnScout.classList.remove('active');
  ui.btnReplay.classList.remove('active');
}

function toggleScout(forceVal = null) {
  const next = forceVal !== null ? forceVal : !scoutActive;
  exitSpecialModes();
  scoutActive = next;
  if (scoutActive) {
    scoutPhase = 0;
    ui.btnScout.classList.add('active');
    if (!started) {
      started = true;
      ui.startOverlay.classList.add('hidden');
    }
  }
}

function toggleReplay(forceVal = null) {
  const next = forceVal !== null ? forceVal : !replayActive;
  if (next && physics.replayFrames.length < 10) {
    showToast('SKI A LINE FIRST TO RECORD REPLAY', 2.4);
    return;
  }
  exitSpecialModes();
  replayActive = next;
  if (replayActive) {
    replayCursor = 0;
    ui.btnReplay.classList.add('active');
    if (!started) {
      started = true;
      ui.startOverlay.classList.add('hidden');
    }
  }
}

function spawnAtZone(idx) {
  exitSpecialModes();
  const zones = terrainData.meta.dropZones;
  zoneIdx = ((idx % zones.length) + zones.length) % zones.length;
  const z = zones[zoneIdx];
  physics.spawn(z);
  trackBuffer.reset(z.x, z.z);
  // Leave deep-powder spawns completely untracked (zero fake high-contrast standing berms beside buried skis!).
  // On firm/packed/corn zones, stamp only a whisper-soft matte ski impression directly underneath boots.
  const isPowSpawn = physics.state.surface && physics.state.surface.id === 'powder';
  if (!isPowSpawn) {
    const fx = Math.sin(z.yaw), fz = -Math.cos(z.yaw);
    const rx = Math.cos(z.yaw), rz = Math.sin(z.yaw);
    const sep = 0.192;
    trackBuffer.stampTwinSkis(
      [z.x - rx * sep - fx * 0.68, z.z - rz * sep - fz * 0.68],
      [z.x - rx * sep + fx * 0.74, z.z - rz * sep + fz * 0.74],
      [z.x + rx * sep - fx * 0.68, z.z + rz * sep - fz * 0.68],
      [z.x + rx * sep + fx * 0.74, z.z + rz * sep + fz * 0.74],
      0.068, 0.08, 0.018, 0.03, 0.0
    );
  }
  lensWet = 0;
  if (typeof _hasPrevCam !== 'undefined') _hasPrevCam = false;
  ui.zoneName.textContent = z.name.toUpperCase();
  document.querySelectorAll('.drop-btn').forEach((b, i) => b.classList.toggle('active', i === zoneIdx));
}

function emitSpindrift(dt, preset) {
  const s = physics.state;
  const rate = preset.id === 'storm' ? 0.65 : (s.y > 2900 ? 0.24 : 0.08);
  if (Math.random() < rate) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * 48;
    const rx = s.x + Math.cos(ang) * dist;
    const rz = s.z + Math.sin(ang) * dist;
    const t = terrainData.sampleTerrain(rx, rz);
    if (t.curv > 0.54 && t.rawY > 2400) {
      particles.emitPuff(
        rx, t.y + 0.35, rz,
        5.5 + Math.random() * 4.5, 0.4 + Math.random() * 1.1, 2.2 + Math.random() * 2.5,
        2.4 + Math.random() * 3.2, 2.7, 0.28, 1.4, 2
      );
    }
  }
}

function consumePhysicsEvents() {
  const evs = physics.events;
  for (let i = 0; i < evs.length; i++) {
    const ev = evs[i];
    if (ev.type === 'track') {
      // Single-pass razor-sharp twin parallel ski stamping preserving untouched center white snow rib!
      trackBuffer.stampTwinSkis(ev.lA, ev.lB, ev.rA, ev.rB, ev.radius, ev.depth, ev.berm, ev.iceGlint, ev.skew);
    } else if (ev.type === 'spray') {
      particles.emitCarveRoosterTail(ev);
      if (ev.sluff && Math.random() < 0.38) {
        const sn = Math.hypot(ev.slopeX, ev.slopeZ) || 1;
        particles.emitPuff(
          ev.x, ev.y + 0.18, ev.z,
          (ev.slopeX / sn) * 7.2, -1.0, (ev.slopeZ / sn) * 7.2,
          1.8, 2.4, 0.42, 1.8, 0
        );
      }
    } else if (ev.type === 'polePlant') {
      audio.playPolePlant(ev.side, ev.strength, ev.powder);
      trackBuffer.stampPoleDimple(ev.x, ev.z, ev.powder ? 0.15 : 0.11, ev.powder ? 0.56 : 0.34);
      particles.emitBurst(
        ev.x, ev.y + 0.06, ev.z,
        ev.powder ? 5 : 3,
        1.15 + ev.strength * 0.75,
        0.18, 0.36,
        0.55 + ev.strength * 0.25,
        ev.powder ? 0.56 : 0.34,
        0.65,
        0
      );
    } else if (ev.type === 'treeWhoosh') {
      audio.playTreeWhoosh(ev.pan, ev.closeness, ev.speed);
    } else if (ev.type === 'bootCreak') {
      audio.playBootCreak(ev.strength);
    } else if (ev.type === 'sluffStream') {
      const spd = 6.2 + ev.strength * 5.4;
      const sx = -ev.dirZ, sz = ev.dirX;
      for (let k = 0; k < 2; k++) {
        const lat = (Math.random() - 0.5) * 0.65;
        particles.emitPuff(
          ev.x + sx * lat, ev.y + 0.05 + k * 0.04, ev.z + sz * lat,
          ev.dirX * spd + (Math.random() - 0.5) * 0.9,
          -0.65,
          ev.dirZ * spd + (Math.random() - 0.5) * 0.9,
          0.42 + ev.strength * 0.42,
          1.35 + Math.random() * 0.55,
          0.36 + ev.strength * 0.22,
          0.72,
          0
        );
      }
    } else if (ev.type === 'pop') {
      audio.playPop(ev.charge);
      particles.emitBurst(ev.x, ev.y + 0.1, ev.z, 12, 3.2, 0.65, 1.35, 1.05, 0.54, 1.8, 0);
    } else if (ev.type === 'land') {
      audio.playImpact(Math.min(1, ev.impact / 14), ev.powder, false);
      const rad = 0.48 + Math.min(0.85, ev.impact * 0.055);
      trackBuffer.stampCapsule(ev.x - 0.24, ev.z, ev.x + 0.24, ev.z, rad, 0.95, 0.92, 0.6, 0);
      particles.emitBurst(ev.x, ev.y + 0.2, ev.z, Math.min(22, 8 + Math.round(ev.impact * 1.2)), 3.8 + ev.impact * 0.35, 0.85, 2.0, 1.5, 0.50, 1.9, 0);
      if (ev.powder && ev.impact > 6) {
        lensWet = Math.min(0.85, lensWet + 0.16);
      }
    } else if (ev.type === 'crash') {
      audio.playImpact(1.0, true, true);
      trackBuffer.stampCapsule(ev.x - 0.5, ev.z - 0.5, ev.x + 0.5, ev.z + 0.5, 1.35, 1.0, 1.0, 0.5, 0);
      particles.emitBurst(ev.x, ev.y + 0.25, ev.z, 26, 6.2, 1.0, 2.6, 1.9, 0.56, 2.1, 0);
      lensWet = 0.60;
    } else if (ev.type === 'crashTrail') {
      trackBuffer.stampCapsule(ev.x - 0.2, ev.z, ev.x + 0.2, ev.z, 0.80, 0.9, 0.85, 0.3, 0);
      particles.emitPuff(ev.x, ev.y + 0.2, ev.z, (Math.random() - 0.5) * 4, 2.0, (Math.random() - 0.5) * 4, 1.4, 1.6, 0.60, 2.0, 0);
    } else if (ev.type === 'avalancheStart') {
      audio.playAvalancheCrack();
      const a = physics.avalanche;
      const sx = -a.dirZ, sz = a.dirX;
      // Burst dense powdery plumes right across the crown fracture wall!
      for (let k = -8; k <= 8; k++) {
        const across = (k / 8) * a.width * 0.85;
        const wx = a.originX + sx * across;
        const wz = a.originZ + sz * across;
        const wy = terrainData.sampleHeight(wx, wz);
        particles.emitPuff(
          wx, wy + 1.2, wz,
          a.dirX * 10 + (Math.random() - 0.5) * 3, 2.8 + Math.random() * 2.8, a.dirZ * 10 + (Math.random() - 0.5) * 3,
          3.4 + Math.random() * 2.8, 2.8, 0.78, 2.6, 1
        );
      }
    }
  }
  evs.length = 0;
}

function applyScoutCamera(phase) {
  const z = terrainData.meta.dropZones[zoneIdx];
  // Follow the real line vector toward traceEnd (or drop-zone compass yaw)
  let dx = Math.sin(z.yaw);
  let dz = -Math.cos(z.yaw);
  if (z.traceEnd && z.traceEnd.length === 2) {
    const tx = z.traceEnd[0] - z.x;
    const tz = z.traceEnd[1] - z.z;
    const len = Math.hypot(tx, tz);
    if (len > 40) { dx = tx / len; dz = tz / len; }
  }
  const rx = -dz, rz = dx;

  // Smooth ping-pong arc gliding 290 m down the fall line & sweeping sideways to reveal slope pitches, rock walls & spruce glades!
  const u = Math.sin(phase * Math.PI); // 0 -> 1 -> 0
  const along = 24 + u * 275;
  const sway = Math.sin(phase * Math.PI * 2.0) * 58 + 26 * u;
  const cx = z.x + dx * along + rx * sway;
  const cz = z.z + dz * along + rz * sway;
  const gY = terrainData.sampleHeight(cx, cz);
  const altAbove = 28 + Math.sin(phase * Math.PI) * 44;
  camera.position.set(cx, gY + altAbove, cz);
  // Look smoothly ahead down the steepest line (turning back gently toward the launch cornice near peak of loop!)
  const lookAhead = phase < 0.62 ? (along + 260) : (along - 120);
  const lx = z.x + dx * lookAhead;
  const lz = z.z + dz * lookAhead;
  const ly = terrainData.sampleHeight(lx, lz);
  camera.lookAt(lx, ly + 8, lz);
  if (physics) physics.enforceCameraClearance(camera, 8.0, false);
  camera.fov = 66;
  camera.updateProjectionMatrix();
  return new THREE.Vector2(cx + dx * 45, cz + dz * 45);
}

function applyReplayFrame(dt) {
  const frames = physics.replayFrames;
  if (!frames.length) return null;
  if (dt > 0) {
    replayCursor += dt * 30.0;
    if (replayCursor >= frames.length) replayCursor = 0;
  }
  const idx = Math.min(frames.length - 1, Math.floor(replayCursor));
  const f = frames[idx];
  _replayProxy.x = f.x; _replayProxy.y = f.y; _replayProxy.z = f.z;
  _replayProxy.terrainY = f.terrainY;
  _replayProxy.normal.set(f.nx, f.ny, f.nz);
  _replayProxy.quat.set(f.qx, f.qy, f.qz, f.qw);
  _replayProxy.yaw = f.yaw;
  _replayProxy.edgeAngle = f.edgeAngle;
  _replayProxy.crouch = f.crouch;
  _replayProxy.foreAft = f.foreAft;
  _replayProxy.slipAngle = f.slipAngle;
  _replayProxy.turnLead = f.turnLead;
  _replayProxy.shiftyAngle = f.shiftyAngle;
  _replayProxy.landImpact = f.landImpact;
  _replayProxy.grabbing = f.grabbing;
  _replayProxy.speed = f.speed;
  _replayProxy.grounded = f.grounded;
  _replayProxy.crashed = f.crashed;
  _replayProxy.isSwitch = f.isSwitch;
  _replayProxy.slopeDeg = f.slopeDeg;
  _replayProxy.surface = _surfById[f.surfId] || SURFACE_TYPES.POWDER;
  _replayProxy.sprayRate = f.sprayRate;
  _replayProxy.polePlantL = f.polePlantL || 0;
  _replayProxy.polePlantR = f.polePlantR || 0;
  _replayProxy.skatePhase = f.skatePhase || 0;
  _replayProxy.skatePush = f.skatePush || 0;
  _replayProxy.insideUnweight = f.insideUnweight || 0;
  _replayProxy.scissorSpread = f.scissorSpread || 0;
  _replayProxy.bowWave = f.bowWave || 0;
  _replayProxy.edgeDeg = f.edgeDeg ?? (f.edgeAngle * 64.0);
  _replayProxy.fallAngleDeg = f.fallAngleDeg || 0;
  _replayProxy.stanceMode = f.stanceMode || (f.grounded ? 'GLIDE' : 'AIR');

  // Re-emit subtle coldsmoke rooster tail during live playback
  if (dt > 0 && f.sprayRate > 0.25 && f.grounded) {
    const rx = Math.cos(f.yaw), rz = Math.sin(f.yaw);
    const side = f.edgeAngle >= 0 ? -1 : 1;
    particles.emitPuff(
      f.x + rx * side * 0.35, f.y + 0.15, f.z + rz * side * 0.35,
      rx * side * 3.8, 2.2, rz * side * 3.8,
      1.35 + f.sprayRate * 0.85, 1.65, 0.62, 2.1, 0
    );
  }

  // Sweeping cinema telephoto helicopter camera orbiting skier on the CLEAR inside side of the turn (so plume billows BEHIND skier!)
  const prog = frames.length > 1 ? idx / (frames.length - 1) : 0;
  const fwdX = Math.sin(f.yaw), fwdZ = -Math.cos(f.yaw);
  const rX = Math.cos(f.yaw), rZ = Math.sin(f.yaw);
  const sideSign = f.edgeAngle >= 0 ? 1 : -1; // inside side opposite spray!
  const cx = f.x + fwdX * 12.5 + rX * sideSign * 14.0;
  const cz = f.z + fwdZ * 12.5 + rZ * sideSign * 14.0;
  const gY = terrainData.sampleHeight(cx, cz);
  const cy = Math.max(gY + 3.8, f.y + 5.6);
  camera.position.set(cx, cy, cz);
  camera.lookAt(f.x - fwdX * 4.5, f.y + 1.0, f.z - fwdZ * 4.5);
  if (physics) physics.enforceCameraClearance(camera, 4.2, true);
  camera.fov = 50; // compressed cinema helicopter telephoto lens!
  camera.updateProjectionMatrix();

  return { state: _replayProxy, prog };
}

function updateCompass(refX, refZ) {
  if (!hudVisible || !terrainData?.meta?.peaks) return;
  const camYaw = -(new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y);
  const halfFovRad = THREE.MathUtils.degToRad(camera.fov * 0.55 * camera.aspect * 0.58);
  const candidates = [];
  for (const pk of terrainData.meta.peaks) {
    const dx = pk.x - refX;
    const dz = pk.z - refZ;
    const dist = Math.hypot(dx, dz);
    if (dist < 180) continue;
    const bearing = Math.atan2(dx, -dz);
    let rel = bearing - camYaw;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    if (Math.abs(rel) > halfFovRad) continue;
    const pct = 50 + (rel / halfFovRad) * 44;
    candidates.push({ pk, dist, pct });
  }
  candidates.sort((a, b) => (b.pk.elev - a.pk.elev));
  const placed = [];
  let html = '';
  for (const c of candidates) {
    if (c.pct < 16 || c.pct > 84) continue;
    if (placed.some((p) => Math.abs(p - c.pct) < 36.0)) continue;
    placed.push(c.pct);
    const distKm = c.dist >= 1000 ? `${(c.dist / 1000).toFixed(1)}km` : `${Math.round(c.dist)}m`;
    html += `<div class="peak-pin" style="left:${c.pct.toFixed(1)}%"><span class="pk-tick"></span><span class="pk-name">${c.pk.name}</span><span class="pk-alt">${c.pk.altLabel} · ${distKm}</span></div>`;
  }
  ui.compassRibbon.innerHTML = html;
}

function updateHUD(nowSec, activeState, replayProg = 0) {
  if (hudMode === 1 && ui.rawRecTime && ui.rawRecMeta) {
    const totalSec = Math.max(0, Math.floor(nowSec));
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    ui.rawRecTime.textContent = `REC ${mm}:${ss}`;
    const camTag = CAM_MODES[camModeIdx].id === 'chesty' ? 'CHESTY' : '4K';
    ui.rawRecMeta.textContent = `${camTag} · 60 · ${Math.round(activeState.y)}m`;
    return;
  }
  if (!hudVisible) return;
  const s = activeState;
  const kmh = Math.round(s.speed * 3.6);
  ui.speedVal.textContent = String(kmh).padStart(2, '0');
  ui.altVal.textContent = `${Math.round(s.y)}`;
  ui.slopeVal.textContent = `${Math.round(s.slopeDeg)}°`;
  if (ui.edgeVal) {
    const ed = Math.round(s.edgeDeg || 0);
    ui.edgeVal.textContent = Math.abs(ed) < 4 ? 'FLAT' : `${Math.abs(ed)}°${ed > 0 ? 'R' : 'L'}`;
  }
  if (ui.fallArrowGroup) {
    if (s.slopeDeg < 1.5) {
      ui.fallArrowGroup.style.opacity = '0.28';
      ui.fallArrowGroup.style.transform = 'rotate(0deg)';
    } else {
      ui.fallArrowGroup.style.opacity = '1';
      ui.fallArrowGroup.style.transform = `rotate(${Math.round(s.fallAngleDeg || 0)}deg)`;
    }
  }
  ui.dropVal.textContent = `${Math.round(physics.state.verticalDropped)}m`;
  ui.surfaceChip.textContent = s.grounded ? s.surface.label : 'AIRBORNE';
  ui.surfaceChip.dataset.surf = s.grounded ? s.surface.id : 'air';
  if (ui.stanceChip) {
    const sm = s.grounded ? (s.stanceMode || 'GLIDE') : 'AIR';
    ui.stanceChip.textContent = sm;
    ui.stanceChip.dataset.mode = sm;
  }
  ui.switchChip.classList.toggle('show', !!s.isSwitch);
  ui.fpsVal.textContent = `${Math.round(lastFps)}`;

  // Special mode banner (Line-Scout or Helicopter Replay)
  if (scoutActive) {
    ui.modeBanner.classList.add('show');
    ui.modeTitle.textContent = 'LINE SCOUT · HELICOPTER PREVIEW';
    ui.modeSub.textContent = 'Press V or ESC to drop into helmet POV';
    ui.replayBar.classList.remove('show');
  } else if (replayActive) {
    ui.modeBanner.classList.add('show');
    ui.modeTitle.textContent = 'HELICOPTER REPLAY · 30 HZ';
    ui.modeSub.textContent = `${physics.replayFrames.length} frames recorded · Press P or ESC to exit`;
    ui.replayBar.classList.add('show');
    ui.replayFill.style.width = `${Math.round(replayProg * 100)}%`;
  } else {
    ui.modeBanner.classList.remove('show');
    ui.replayBar.classList.remove('show');
  }

  // Dynamic Slab Avalanche warning banner
  const avy = physics.avalanche;
  if (avy.active && !scoutActive && !replayActive) {
    ui.avyBanner.classList.add('show');
    const relX = physics.state.x - avy.originX;
    const relZ = physics.state.z - avy.originZ;
    const along = relX * avy.dirX + relZ * avy.dirZ;
    const gap = Math.max(0, Math.round(along - avy.frontDist));
    const spKmh = Math.round(avy.speed * 3.6);
    ui.avyDetail.textContent = `SLAB FRACTURE · ${spKmh} KM/H · ${gap > 0 ? `${gap}m BEHIND` : 'SLAB PASSING — SKI SIDEWAYS!'}`;
    ui.btnAvy.classList.add('active');
  } else {
    ui.avyBanner.classList.remove('show');
    ui.btnAvy.classList.remove('active');
  }

  // Ollie / Pop charge meter
  if (!replayActive && !scoutActive && physics.state.popCharge > 0.04 && physics.state.grounded) {
    ui.popBar.classList.add('show');
    ui.popFill.style.width = `${Math.round(physics.state.popCharge * 100)}%`;
  } else {
    ui.popBar.classList.remove('show');
  }

  // Live air-time telemetry
  if (!replayActive && !scoutActive && !physics.state.grounded && physics.state.airTime > 0.16 && !physics.state.crashed) {
    ui.airBadge.classList.add('show');
    const flips = Math.abs(physics.state.airPitch) / (Math.PI * 2);
    const spinDeg = Math.round(Math.abs(physics.state.airYaw) * 180 / Math.PI);
    const grabStr = physics.state.grabbing ? ' · MUTE GRAB' : '';
    ui.airBadge.textContent = `AIR ${physics.state.airTime.toFixed(1)}s · ${physics.state.peakAirHeight.toFixed(1)}m · ${spinDeg}°${flips > 0.4 ? ' · FLIP' : ''}${grabStr}`;
  } else {
    ui.airBadge.classList.remove('show');
  }

  // Trick toast OR brief system toast
  const toastAge = nowSec - physics.state.lastTrickTime;
  if (customToast && nowSec < customToastUntil) {
    ui.trickToast.classList.add('show');
    ui.trickToast.textContent = customToast;
    ui.trickToast.dataset.quality = 'info';
  } else if (physics.state.lastTrickText && toastAge >= 0 && toastAge < 3.6 && !physics.state.crashed) {
    ui.trickToast.classList.add('show');
    ui.trickToast.textContent = physics.state.lastTrickText;
    ui.trickToast.dataset.quality = physics.state.lastLandingQuality.toLowerCase();
  } else {
    ui.trickToast.classList.remove('show');
  }

  // Wipeout banner
  if (!replayActive && !scoutActive && physics.state.crashed) {
    ui.crashBanner.classList.add('show');
    ui.crashReason.textContent = physics.state.crashReason || 'EDGE CATCH';
  } else {
    ui.crashBanner.classList.remove('show');
  }

  updateCompass(camera.position.x, camera.position.z);
}

function runDeterministicScript(mode) {
  const dt = FIXED_DT;
  const preset = LIGHTING_PRESETS[lightIdx];
  const sunDir = sunDirFromPreset(preset);

  if (mode === 'tracks') {
    // Crisp graceful twin parallel S-turns covering ~36 m inside the 64×64 m high-res buffer (NO Shift skid so twin rails stay surgical!)
    const totalSteps = Math.round(120 * 4.4);
    physics.state.vx = Math.sin(physics.state.yaw) * 4.0;
    physics.state.vz = -Math.cos(physics.state.yaw) * 4.0;
    for (let step = 0; step < totalSteps; step++) {
      physics.keys.clear();
      const sec = step * dt;
      if (sec < 1.1) physics.keys.add('KeyD');
      else if (sec >= 1.3 && sec < 2.8) physics.keys.add('KeyA');
      else if (sec >= 3.0 && sec < 4.2) physics.keys.add('KeyD');
      simTime += dt;
      physics.step(dt, simTime);
      trackBuffer.recenterIfNeeded(physics.state.x, physics.state.z, 0);
      consumePhysicsEvents();
      particles.update(dt, camera.position, window.innerHeight * DPR, camera.fov, preset, sunDir, simTime);
    }
    physics.keys.clear();
    // Look straight back uphill at the freshly carved parallel twin ski tracks & crisp white center rib!
    physics.lookYawOff = Math.PI * 0.94;
    physics.lookPitchOff = 0.05;
    physics.state.vx = 0; physics.state.vy = 0; physics.state.vz = 0; physics.state.speed = 0;
  } else if (mode === 'carve' || mode === 'replay') {
    // Clean forward deep-powder S-carve sequence keeping crimson articulated skier sharp & silhouetted against backlit coldsmoke rooster-tail!
    const totalSteps = Math.round(120 * 4.2);
    physics.state.vx = Math.sin(physics.state.yaw) * 6.0;
    physics.state.vz = -Math.cos(physics.state.yaw) * 6.0;
    for (let step = 0; step < totalSteps; step++) {
      physics.keys.clear();
      const sec = step * dt;
      if (sec < 1.1) physics.keys.add('KeyD');
      else if (sec >= 1.25 && sec < 2.65) physics.keys.add('KeyA');
      else if (sec >= 2.8) physics.keys.add('KeyD'); // crisp aggressive right-edge carve into final frame!
      simTime += dt;
      physics.step(dt, simTime);
      trackBuffer.recenterIfNeeded(physics.state.x, physics.state.z, 0);
      consumePhysicsEvents();
      particles.update(dt, camera.position, window.innerHeight * DPR, camera.fov, preset, sunDir, simTime);
    }
    physics.keys.clear();
    // Clear giant lingering puffs right in front of the skier's torso, then sculpt a clean billowing rooster-tail strictly BEHIND & OUTSIDE the downhill ski tails!
    const s = physics.state;
    s.isSwitch = false;
    s.edgeAngle = 0.78;
    const fwdX = Math.sin(s.yaw), fwdZ = -Math.cos(s.yaw);
    const rx = Math.cos(s.yaw), rz = Math.sin(s.yaw);
    const outSide = -1; // right turn -> spray erupts dramatically to the LEFT/BEHIND downhill skis!
    for (let i = 0; i < particles.maxPuffs; i++) {
      if (particles.life[i] > 0) {
        const k = i * 3;
        if (Math.hypot(particles.pos[k] - s.x, particles.pos[k + 2] - s.z) < 4.5) {
          particles.life[i] = -1;
          particles.opacity[i] = 0;
        }
      }
    }
    for (let k = 0; k < 34; k++) {
      const f = k / 33;
      const alongBack = 0.8 + f * 9.8;
      const out = 0.55 + Math.pow(f, 0.78) * 3.8;
      const lift = 0.35 + Math.sin(Math.min(1, f * 1.15) * Math.PI) * 2.55 + (Math.random() - 0.5) * 0.4;
      const px = s.x - fwdX * alongBack + rx * outSide * out + (Math.random() - 0.5) * 0.45;
      const pz = s.z - fwdZ * alongBack + rz * outSide * out + (Math.random() - 0.5) * 0.45;
      const gy = terrainData.sampleHeight(px, pz);
      const sz = 0.85 + Math.sin(Math.min(1, f * 1.2) * Math.PI) * 1.45 + f * 0.75;
      particles.emitPuff(
        px, gy + lift, pz,
        rx * outSide * 2.5, 1.4, rz * outSide * 2.5,
        sz, 2.2, 0.86 - f * 0.30, 0.95, 0
      );
      // Set age right at luminous peak envelope so static paused renders show full photographic plume density!
      const idx = (particles.cursor + particles.maxPuffs - 1) % particles.maxPuffs;
      particles.age[idx] = 0.48 + f * 0.35;
    }
    if (mode === 'replay' && physics.replayFrames.length > 10) {
      replayActive = true;
      replayCursor = Math.floor(physics.replayFrames.length - 1);
      ui.btnReplay.classList.add('active');
    } else {
      physics.lookYawOff = -0.34;
    }
  } else if (mode === 'air') {
    const totalSteps = Math.round(120 * 3.72);
    physics.state.vx = Math.sin(physics.state.yaw) * 7.5;
    physics.state.vz = -Math.cos(physics.state.yaw) * 7.5;
    for (let step = 0; step < totalSteps; step++) {
      physics.keys.clear();
      physics.keys.add('KeyW');
      const sec = step * dt;
      // Short natural hop on demo=air timing calibrated for realistic alpine ollie height!
      if (sec > 2.15 && sec < 3.40) physics.keys.add('Space');
      if (sec >= 3.42) {
        physics.keys.add('KeyF');
        physics.keys.add('KeyD');
      }
      simTime += dt;
      physics.step(dt, simTime);
      trackBuffer.recenterIfNeeded(physics.state.x, physics.state.z, 0);
      consumePhysicsEvents();
      particles.update(dt, camera.position, window.innerHeight * DPR, camera.fov, preset, sunDir, simTime);
    }
    physics.keys.clear();
    physics.lookPitchOff = -0.32;
  } else if (mode === 'avalanche') {
    // Dramatic crisp showcase on steep open snow bowl: jagged cobalt crown fracture line right in mid-foreground, scraped icy bed, & towering boiling avalanche cloud!
    const s = physics.state;
    // Slide 32 m forward past the flat start terrace right onto the sweeping 32° steep snow pitch!
    const initFwdX = Math.sin(s.yaw), initFwdZ = -Math.cos(s.yaw);
    s.x += initFwdX * 36;
    s.z += initFwdZ * 36;
    const nt = terrainData.sampleTerrain(s.x, s.z);
    s.y = nt.y; s.terrainY = nt.y; s.slopeDeg = nt.slopeDeg;
    s.normal.set(nt.nx, nt.ny, nt.nz);
    s.vx = 0; s.vy = 0; s.vz = 0; s.speed = 0;
    s.isSwitch = false;
    // Trigger slab crown fracture 15m ahead straight across the wide visible snow face!
    physics.triggerAvalanche(15, 34, true);
    const avy = physics.avalanche;
    // Advance slab cleanly 42 m down the steep face below the jagged blue crown wall!
    const advSteps = Math.round(120 * 2.1);
    for (let step = 0; step < advSteps; step++) {
      simTime += dt;
      avy.age += dt;
      avy.frontDist += 20.0 * dt;
      avy.width = Math.min(46, avy.width + dt * 1.4);
      particles.emitAvalancheWave(avy, terrainData, dt);
      particles.update(dt, camera.position, window.innerHeight * DPR, camera.fov, preset, sunDir, simTime);
    }
    // Add extra sculpted boiling white/cobalt turbulent wave heads right along the advancing avalanche front!
    const sx = -avy.dirZ, sz = avy.dirX;
    for (let k = -10; k <= 10; k++) {
      const across = (k / 10) * avy.width * 0.85;
      const along = avy.frontDist - 4.0 + Math.sin(k * 0.9) * 3.5;
      const wx = avy.originX + avy.dirX * along + sx * across;
      const wz = avy.originZ + avy.dirZ * along + sz * across;
      const wy = terrainData.sampleHeight(wx, wz);
      particles.emitPuff(wx, wy + 2.8 + Math.abs(Math.cos(k * 0.7)) * 3.2, wz, 0, 2.0, 0, 5.2 + Math.random() * 3.8, 3.0, 0.92, 1.5, 1);
      const idx = (particles.cursor + particles.maxPuffs - 1) % particles.maxPuffs;
      particles.age[idx] = 0.65;
    }
    s.yaw = Math.atan2(avy.dirX, -avy.dirZ);
    physics._updateGroundedQuaternion();
    physics.lookYawOff = 0.0;
    physics.lookPitchOff = -0.26; // angled slightly down across the visible jagged blue crown wall & plunging slab!
    s.faceShotIntensity = 0.0;
    s.camShake = 0.0;
  } else if (mode === 'scout') {
    scoutActive = true;
    scoutPhase = 0.34;
    ui.btnScout.classList.add('active');
  } else if (mode === 'trees_closeup') {
    // Move skier right into the Plan de l'Aiguille spruce glade framing foreground hero 3D spruces ~20m away!
    const s = physics.state;
    const fx = Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    const rx = Math.cos(s.yaw), rz = Math.sin(s.yaw);
    s.x += fx * 18 - rx * 4;
    s.z += fz * 18 - rz * 4;
    const t = terrainData.sampleTerrain(s.x, s.z);
    s.y = t.y; s.terrainY = t.y; s.slopeDeg = t.slopeDeg;
    s.normal.set(t.nx, t.ny, t.nz);
    physics._smoothNormal.set(t.nx, t.ny, t.nz);
    physics._updateGroundedQuaternion();
    physics.lookYawOff = THREE.MathUtils.degToRad(-24);
    physics.lookPitchOff = 0.08;
  } else if (mode === 'headturn') {
    // Proof test: free mouse head-look (+48° right looking across massif while skis stay straight & grounded along carved twin tracks!)
    const s = physics.state;
    const startYaw = s.yaw;
    s.vx = Math.sin(s.yaw) * 6.5;
    s.vz = -Math.cos(s.yaw) * 6.5;
    physics.addHeadLookDelta(THREE.MathUtils.degToRad(48), THREE.MathUtils.degToRad(-12));
    const totalSteps = Math.round(120 * 2.4);
    for (let step = 0; step < totalSteps; step++) {
      physics.keys.clear();
      simTime += dt;
      physics.step(dt, simTime);
      trackBuffer.recenterIfNeeded(s.x, s.z, 0);
      consumePhysicsEvents();
      particles.update(dt, camera.position, window.innerHeight * DPR, camera.fov, preset, sunDir, simTime);
    }
    const turnedDeg = THREE.MathUtils.radToDeg(s.yaw - startYaw).toFixed(1);
    const headDeg = THREE.MathUtils.radToDeg(physics.lookYawOff).toFixed(1);
    showToast(`FREE HEAD LOOK · HEAD ${headDeg}° · SKI YAW Δ ${turnedDeg}° (INDEPENDENT)`, 9.9);
    physics.keys.clear();
  } else if (mode === 'speedblur') {
    // High-speed 78 km/h carve right down the spruce corridor demonstrating depth-masked directional motion blur
    // (rushing snow & trees streak smoothly while skis, boots, knees & gloves stay razor sharp!)
    const s = physics.state;
    s.vx = Math.sin(s.yaw) * 14.0;
    s.vz = -Math.cos(s.yaw) * 14.0;
    const totalSteps = Math.round(120 * 2.1);
    for (let step = 0; step < totalSteps; step++) {
      physics.keys.clear();
      physics.keys.add('KeyW');
      if (step > 140) physics.keys.add('KeyD');
      simTime += dt;
      physics.step(dt, simTime);
      trackBuffer.recenterIfNeeded(s.x, s.z, 0);
      consumePhysicsEvents();
      particles.update(dt, camera.position, window.innerHeight * DPR, camera.fov, preset, sunDir, simTime);
    }
    // Pin crisp demonstration speed (~78 km/h) & subtle rightward whip pan velocity for paused frame inspection!
    const fx = Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    s.vx = fx * 21.8; s.vz = fz * 21.8; s.speed = 21.8;
    s.edgeAngle = 0.42;
    physics.lookPitchOff = -0.34;
    demoAngVelOverride.set(-0.0045, 0.0012);
    physics.keys.clear();
  } else if (mode === 'godrays') {
    // Search hero 3D Norway spruces & stand distances to place the solar disc DIRECTLY behind a tall spruce's
    // serrated upper-middle feathered pine boughs (`0.60 * treeH`) so golden volumetric god-rays burst dramatically!
    const s = physics.state;
    const trees = (propsSys.landmarks && propsSys.landmarks.heroTrees) || [];
    const sunH = Math.hypot(sunDir.x, sunDir.z) || 1;
    const shx = sunDir.x / sunH, shz = sunDir.z / sunH;
    const srx = -shz, srz = shx;
    const tanEl = sunDir.y / sunH;
    let chosenTree = null;
    let chosenX = s.x, chosenZ = s.z;
    let bestErr = 1e9;
    for (const tr of trees) {
      if (tr.hScale < 0.78) continue;
      const crownTargetY = tr.y + (14.4 * tr.hScale) * 0.58;
      for (let dist = 7.5; dist <= 24.0; dist += 1.25) {
        // Graze just along the serrated right edge of the spruce crown so solar corona pokes between notched drooping boughs!
        const cx = tr.x - shx * dist + srx * (0.98 * tr.sc);
        const cz = tr.z - shz * dist + srz * (0.98 * tr.sc);
        const gy = terrainData.sampleHeight(cx, cz);
        const rayYAtTree = (gy + 1.63) + tanEl * dist;
        const heightErr = Math.abs(rayYAtTree - crownTargetY);
        // Prefer crisp foreground distance (~11-16m) & clear direct sun LOS behind the spruce
        const score = heightErr + Math.abs(dist - 13.5) * 0.14;
        if (score < bestErr) {
          bestErr = score;
          chosenTree = tr;
          chosenX = cx;
          chosenZ = cz;
        }
      }
    }
    if (chosenTree) {
      s.x = chosenX;
      s.z = chosenZ;
      const t = terrainData.sampleTerrain(s.x, s.z);
      s.y = t.y; s.terrainY = t.y; s.slopeDeg = t.slopeDeg;
      s.normal.set(t.nx, t.ny, t.nz);
      physics._smoothNormal.set(t.nx, t.ny, t.nz);
      s.yaw = Math.atan2(sunDir.x, -sunDir.z);
      physics._updateGroundedQuaternion();
      physics.lookYawOff = THREE.MathUtils.degToRad(-2.5);
      physics.lookPitchOff = Math.atan2(sunDir.y, sunH) - 0.12;
      s.vx = 0; s.vy = 0; s.vz = 0; s.speed = 0;
    }
  } else if (mode === 'valley_lights') {
    // Perched on a wide 29.7° snowy overlook shelf (-2600, -1680, elev 1992m) with +25.5m open clearance
    // overlooking glowing golden-amber Chamonix, Les Bossons & Les Houches beneath purple-rose twilight mist!
    const s = physics.state;
    s.x = -2600;
    s.z = -1680;
    const targetX = -2980, targetZ = -4850;
    const aimYaw = Math.atan2(targetX - s.x, -(targetZ - s.z));
    s.yaw = aimYaw;
    const t = terrainData.sampleTerrain(s.x, s.z);
    s.y = t.y; s.terrainY = t.y; s.slopeDeg = t.slopeDeg;
    s.normal.set(t.nx, t.ny, t.nz);
    physics._smoothNormal.set(t.nx, t.ny, t.nz);
    physics._updateGroundedQuaternion();
    physics.lookYawOff = 0.0;
    physics.lookPitchOff = THREE.MathUtils.degToRad(-12.5);
    s.vx = 0; s.vy = 0; s.vz = 0; s.speed = 0;
  } else if (mode === 'boulder' || mode === 'serac') {
    // Close-up framing of a sunlit triplanar Protogine granite outcrop OR multi-slab glacial icefall serac cluster!
    const s = physics.state;
    const list = (propsSys.landmarks && (mode === 'serac' ? propsSys.landmarks.seracs : propsSys.landmarks.rocks)) || [];
    let best = null;
    if (mode === 'serac' && list.length > 0) {
      // Pin curated hero Vallée Blanche serac formation unconditionally so multi-preset lighting comparisons share IDENTICAL framing!
      best = list[0];
    } else {
      let bestD = 1e9;
      for (const item of list) {
        if (item.sc < 3.2) continue;
        const los = sampleSunLOS(item.x, item.y + item.sc * 1.1, item.z, sunDir);
        if (los < 0.5) continue;
        const d = Math.hypot(item.x - s.x, item.z - s.z);
        if (d < bestD) { bestD = d; best = item; }
      }
      if (!best && list.length > 0) best = list[0];
    }
    if (best) {
      let offX, offZ, standDist;
      if (mode === 'serac') {
        // Fixed oblique downhill-flank camera angle looking directly into the sheared fractured multi-slab cliff face!
        const ang = best.ry + 0.52;
        offX = Math.sin(ang);
        offZ = Math.cos(ang);
        standDist = best.sc * 3.6 + 6.5;
      } else {
        const sunH = Math.hypot(sunDir.x, sunDir.z) || 1;
        offX = (sunDir.x / sunH) * 0.72 - (sunDir.z / sunH) * 0.69;
        offZ = (sunDir.z / sunH) * 0.72 + (sunDir.x / sunH) * 0.69;
        standDist = best.sc * 2.55 + 4.4;
      }
      s.x = best.x + offX * standDist;
      s.z = best.z + offZ * standDist;
      const t = terrainData.sampleTerrain(s.x, s.z);
      s.y = t.y; s.terrainY = t.y; s.slopeDeg = t.slopeDeg;
      s.normal.set(t.nx, t.ny, t.nz);
      physics._smoothNormal.set(t.nx, t.ny, t.nz);
      s.yaw = Math.atan2(best.x - s.x, -(best.z - s.z));
      physics._updateGroundedQuaternion();
      const targetY = best.y + best.sc * (mode === 'serac' ? 0.68 : 0.45);
      physics.lookYawOff = 0.0;
      physics.lookPitchOff = Math.atan2(targetY - (s.y + 1.63), standDist);
      s.vx = 0; s.vy = 0; s.vz = 0; s.speed = 0;
    }
  } else if (mode === 'midi_glow') {
    // Dramatic alpenglow framing of Aiguille du Midi station's glowing amber gallery windows, spire beacon & gliding Téléphérique cabin!
    const s = physics.state;
    const spire = terrainData.meta.aiguilleSpire;
    if (spire) {
      // Col du Midi / Vallée Blanche side (~540m ESE of spire) looking straight up at the glowing summit monolith!
      s.x = spire.x + 510;
      s.z = spire.z + 185;
      const t = terrainData.sampleTerrain(s.x, s.z);
      s.y = t.y; s.terrainY = t.y; s.slopeDeg = t.slopeDeg;
      s.normal.set(t.nx, t.ny, t.nz);
      physics._smoothNormal.set(t.nx, t.ny, t.nz);
      const spireY = terrainData.sampleHeight(spire.x, spire.z) + 56;
      const dist = Math.hypot(spire.x - s.x, spire.z - s.z);
      s.yaw = Math.atan2(spire.x - s.x, -(spire.z - s.z));
      physics._updateGroundedQuaternion();
      physics.lookYawOff = 0.0;
      physics.lookPitchOff = Math.atan2(spireY - (s.y + 1.63), dist);
      s.vx = 0; s.vy = 0; s.vz = 0; s.speed = 0;
    }
  } else if (mode === 'chesty_carve') {
    // High-speed DOWNHILL deep-powder carve showing iconic Chest-Mount framing:
    // sweeping sunlit Vallée Blanche valley ahead, BOTH sleeves & leather gloves gripping carbon poles,
    // crisp downhill right pole-plant, 3D curling powder bow-wave washing off parabolic shovels, & rooster-tail behind!
    const totalSteps = Math.round(120 * 2.6);
    const baseYaw = physics.state.yaw;
    physics.state.vx = Math.sin(baseYaw) * 9.0;
    physics.state.vz = -Math.cos(baseYaw) * 9.0;
    for (let step = 0; step < totalSteps; step++) {
      physics.keys.clear();
      const sec = step * dt;
      // Short symmetric S-turn stays aimed straight DOWNHILL (never turning 180° uphill!)
      if (sec < 0.72) physics.keys.add('KeyA');
      else if (sec >= 0.90 && sec < 1.72) physics.keys.add('KeyD');
      else if (sec >= 1.95 && sec < 2.25) physics.keys.add('KeyA');
      else if (sec >= 2.30) physics.keys.add('KeyD');
      simTime += dt;
      physics.step(dt, simTime);
      trackBuffer.recenterIfNeeded(physics.state.x, physics.state.z, 0);
      consumePhysicsEvents();
      particles.update(dt, camera.position, window.innerHeight * DPR, camera.fov, preset, sunDir, simTime);
    }
    physics.keys.clear();
    const s = physics.state;
    const tNow = terrainData.sampleTerrain(s.x, s.z);
    const gm = Math.hypot(tNow.gx, tNow.gz) || 1;
    // Aim strictly DOWNHILL + subtle 16° carving arc across the sunlit glacier face!
    const fallYaw = Math.atan2(-tNow.gx, tNow.gz);
    s.yaw = fallYaw + 0.28;
    physics._smoothNormal.set(tNow.nx, tNow.ny, tNow.nz);
    physics._updateGroundedQuaternion();
    s.isSwitch = false;
    s.edgeAngle = 0.56;
    s.edgeDeg = s.edgeAngle * 64.0;
    s.fallAngleDeg = THREE.MathUtils.radToDeg(-0.28);
    s.stanceMode = 'CARVE';
    s.insideUnweight = 0.64;
    s.polePlantR = 0.52; // crisp forward-downward right pole plant!
    s.polePlantL = 0.0;
    s.skatePush = 0.0;
    s.bowWave = 0.94;
    s.crouch = 0.26;
    const fx = Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    const rx = Math.cos(s.yaw), rz = Math.sin(s.yaw);
    s.vx = fx * 17.5; s.vz = fz * 17.5; s.speed = 17.5;
    // Clear giant lingering puffs right in front of the lens, then sculpt clean rooster-tail + crisp right-basket puff!
    for (let i = 0; i < particles.maxPuffs; i++) {
      if (particles.life[i] > 0) {
        const k = i * 3;
        if (Math.hypot(particles.pos[k] - s.x, particles.pos[k + 2] - s.z) < 4.5) {
          particles.life[i] = -1;
          particles.opacity[i] = 0;
        }
      }
    }
    // Crisp mini powder puff right around right pole basket impact beside right front ski!
    const px = s.x + rx * 0.78 + fx * 0.96;
    const pz = s.z + rz * 0.78 + fz * 0.96;
    const py = terrainData.sampleHeight(px, pz);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      particles.emitPuff(
        px + Math.cos(a) * 0.14, py + 0.06 + (k % 2) * 0.04, pz + Math.sin(a) * 0.14,
        Math.cos(a) * 0.45, 0.28, Math.sin(a) * 0.45,
        0.18 + (k % 3) * 0.04, 0.75, 0.42, 0.30, 0
      );
      const idx = (particles.cursor + particles.maxPuffs - 1) % particles.maxPuffs;
      particles.age[idx] = 0.16;
    }
    // Backlit coldsmoke rooster tail flaring out behind left downhill outside ski!
    for (let k = 0; k < 26; k++) {
      const f = k / 25;
      const alongBack = 0.85 + f * 7.8;
      const out = 0.45 + Math.pow(f, 0.8) * 2.9;
      const lift = 0.25 + Math.sin(Math.min(1, f * 1.15) * Math.PI) * 1.9;
      const qx = s.x - fx * alongBack - rx * out + (Math.random() - 0.5) * 0.35;
      const qz = s.z - fz * alongBack - rz * out + (Math.random() - 0.5) * 0.35;
      const qy = terrainData.sampleHeight(qx, qz);
      particles.emitPuff(qx, qy + lift, qz, -rx * 2.2, 1.2, -rz * 2.2, 0.72 + f * 1.25, 2.0, 0.78 - f * 0.26, 0.85, 0);
      const idx = (particles.cursor + particles.maxPuffs - 1) % particles.maxPuffs;
      particles.age[idx] = 0.46 + f * 0.3;
    }
    physics.lookYawOff = 0.0;
    physics.lookPitchOff = -0.14;
    simTime = Math.max(simTime, 42.0); // nice realistic REC 00:42 timestamp!
  } else if (mode === 'skate_push') {
    // Low-speed double-pole skate push showing both gloved hands & carbon poles thrusting forward simultaneously!
    const s = physics.state;
    const fx = Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    const rx = Math.cos(s.yaw), rz = Math.sin(s.yaw);
    s.vx = fx * 3.8; s.vz = fz * 3.8; s.speed = 3.8;
    s.skatePush = 1.0;
    s.skatePhase = 0.22; // cos ~ 0.98 peak forward reach right as both baskets stab snow!
    s.polePlantL = 0.0;
    s.polePlantR = 0.0;
    s.edgeAngle = 0.0;
    s.insideUnweight = 0.0;
    s.bowWave = 0.14;
    s.crouch = 0.22;
    for (const side of [-1, 1]) {
      const bx = s.x + rx * side * 0.44 + fx * 0.92;
      const bz = s.z + rz * side * 0.44 + fz * 0.92;
      const by = terrainData.sampleHeight(bx, bz);
      for (let k = 0; k < 4; k++) {
        particles.emitPuff(
          bx + (k - 1.5) * 0.06, by + 0.08, bz + (k % 2) * 0.06,
          0, 0.3, 0, 0.20, 0.8, 0.48, 0.25, 0
        );
        const idx = (particles.cursor + particles.maxPuffs - 1) % particles.maxPuffs;
        particles.age[idx] = 0.14;
      }
    }
    physics.lookYawOff = 0.0;
    physics.lookPitchOff = -0.20;
    simTime = Math.max(simTime, 18.0);
  } else if (mode === 'sluff_carve') {
    // Steep alpine pitch (34°+) carving DOWNHILL through cold powder with continuous organic sluff ribbons snaking down the fall-line!
    const totalSteps = Math.round(120 * 2.0);
    physics.state.vx = Math.sin(physics.state.yaw) * 7.5;
    physics.state.vz = -Math.cos(physics.state.yaw) * 7.5;
    for (let step = 0; step < totalSteps; step++) {
      physics.keys.clear();
      const sec = step * dt;
      if (sec < 0.8) physics.keys.add('KeyD');
      else if (sec > 1.0 && sec < 1.7) physics.keys.add('KeyA');
      simTime += dt;
      physics.step(dt, simTime);
      trackBuffer.recenterIfNeeded(physics.state.x, physics.state.z, 0);
      consumePhysicsEvents();
      particles.update(dt, camera.position, window.innerHeight * DPR, camera.fov, preset, sunDir, simTime);
    }
    physics.keys.clear();
    const s = physics.state;
    const t = terrainData.sampleTerrain(s.x, s.z);
    const gm = Math.hypot(t.gx, t.gz) || 1;
    const dirX = -t.gx / gm, dirZ = -t.gz / gm;
    const sideX = -dirZ, sideZ = dirX;
    // Align straight DOWN the steep sunlit fall-line (subtle -14° left-carve traverse!)
    s.yaw = Math.atan2(dirX, -dirZ) - 0.24;
    physics._smoothNormal.set(t.nx, t.ny, t.nz);
    physics._updateGroundedQuaternion();
    s.edgeAngle = -0.52;
    s.insideUnweight = -0.58;
    s.polePlantL = 0.50;
    s.polePlantR = 0.0;
    s.bowWave = 0.88;
    s.scissorSpread = 0.35;
    s.crouch = 0.24;
    const fx = Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    s.vx = fx * 15.8; s.vz = fz * 15.8; s.speed = 15.8;
    // Clear giant stray puffs right in front of the lens before emitting silky continuous downhill sluff cascades!
    for (let i = 0; i < particles.maxPuffs; i++) {
      if (particles.life[i] > 0) {
        const k = i * 3;
        if (Math.hypot(particles.pos[k] - s.x, particles.pos[k + 2] - s.z) < 6.5) {
          particles.life[i] = -1;
          particles.opacity[i] = 0;
        }
      }
    }
    // Sculpt 2 continuous overlapping serpentine powder sluff cascades (dense spacing -> silky flowing sheets, ZERO discrete polka dots!)
    for (let ribbon = 0; ribbon < 2; ribbon++) {
      const sideSign = ribbon === 0 ? -1 : 1;
      const baseLat = sideSign * 1.15;
      for (let k = 0; k < 28; k++) {
        const f = k / 27;
        const along = 2.0 + f * 15.5;
        const snake = baseLat + Math.sin(f * 4.8 + ribbon * 2.1) * 0.48 + sideSign * f * 1.35;
        const px = s.x + dirX * along + sideX * snake + (Math.random() - 0.5) * 0.22;
        const pz = s.z + dirZ * along + sideZ * snake + (Math.random() - 0.5) * 0.22;
        const py = terrainData.sampleHeight(px, pz);
        const sz = 0.85 + Math.sin(f * Math.PI) * 0.95 + f * 0.65;
        const alpha = (0.34 - f * 0.14) * (0.45 + 0.55 * Math.sin(Math.min(1, f * 3.0) * Math.PI * 0.5));
        particles.emitPuff(px, py + 0.18 + f * 0.20, pz, dirX * 8.0, -1.0, dirZ * 8.0, sz, 1.8, alpha, 0.65, 0);
        const idx = (particles.cursor + particles.maxPuffs - 1) % particles.maxPuffs;
        particles.age[idx] = 0.32 + f * 0.25;
      }
    }
    physics.lookYawOff = 0.0;
    physics.lookPitchOff = -0.14;
    simTime = Math.max(simTime, 64.0);
  } else if (mode === 'switch_fakie') {
    // Carve clean twin tracks downhill for ~2.0s, then flip 180° into Switch (fakie) stance so the player's
    // perspective genuinely looks BACKWARD UPHILL over their ski tips & sculpted gloves right up their own tracks!
    const totalSteps = Math.round(120 * 1.95);
    const baseYaw = physics.state.yaw;
    physics.state.vx = Math.sin(baseYaw) * 8.5;
    physics.state.vz = -Math.cos(baseYaw) * 8.5;
    for (let step = 0; step < totalSteps; step++) {
      physics.keys.clear();
      const sec = step * dt;
      if (sec < 0.65) physics.keys.add('KeyA');
      else if (sec >= 0.80 && sec < 1.50) physics.keys.add('KeyD');
      simTime += dt;
      physics.step(dt, simTime);
      trackBuffer.recenterIfNeeded(physics.state.x, physics.state.z, 0);
      consumePhysicsEvents();
      particles.update(dt, camera.position, window.innerHeight * DPR, camera.fov, preset, sunDir, simTime);
    }
    physics.keys.clear();
    // Instant exact 180° Switch perspective flip while riding backward downhill (~38 km/h)
    physics.toggleSwitch(simTime, true);
    const s = physics.state;
    const fx = Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    s.vx = -fx * 10.6; s.vz = -fz * 10.6; s.speed = 10.6;
    s.edgeAngle = -0.26;
    s.edgeDeg = s.edgeAngle * 64.0;
    s.stanceMode = 'SWITCH';
    s.bowWave = 0.42;
    s.crouch = 0.22;
    physics.lookYawOff = 0.0;
    physics.lookPitchOff = -0.10;
    showToast('SWITCH STANCE (FAKIE · VIEW FLIPPED 180°)', 6.0);
    simTime = Math.max(simTime, 28.0);
  } else if (mode === 'landing_stomp') {
    // Mid-absorption physical spring-damper jump landing compression (~140ms post-touchdown):
    // deep knee flex, athletic arm-bracing stance, flexed powder skis, scissor-spread, & crisp spray burst!
    const s = physics.state;
    const fx = Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    const rx = Math.cos(s.yaw), rz = Math.sin(s.yaw);
    s.vx = fx * 14.5; s.vz = fz * 14.5; s.speed = 14.5;
    s.grounded = true;
    s.crouch = 0.34;
    physics._landDisp = 0.215;
    physics._landVel = 0.0;
    physics._landPitch = -0.065;
    physics._landRoll = 0.032;
    s.landImpact = 0.72;
    s.scissorSpread = 0.44;
    physics._scissorTarget = 0.44;
    s.edgeAngle = 0.16;
    s.edgeDeg = s.edgeAngle * 64.0;
    s.bowWave = 0.88;
    s.stanceMode = 'STOMP';
    // Crisp low-lying radial landing puff bloom around boots & ski flanks (keeping central frame & gloves crystal clear!)
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      const sideX = Math.cos(a) * (0.75 + (k % 3) * 0.22);
      const alongZ = Math.sin(a) * 0.85 + 0.55;
      if (Math.abs(sideX) < 0.36 && alongZ > 0.2) continue;
      const px = s.x + rx * sideX + fx * alongZ;
      const pz = s.z + rz * sideX + fz * alongZ;
      const py = terrainData.sampleHeight(px, pz);
      particles.emitPuff(px, py + 0.16 + (k % 2) * 0.14, pz, rx * sideX * 1.4, 0.7, rz * sideX * 1.4, 0.48 + (k % 3) * 0.14, 1.4, 0.44, 0.55, 0);
      const idx = (particles.cursor + particles.maxPuffs - 1) % particles.maxPuffs;
      particles.age[idx] = 0.22;
    }
    physics.lookYawOff = 0.0;
    physics.lookPitchOff = -0.18;
    showToast('STOMPED LANDING · SPRING-DAMPER ABSORB', 6.0);
    simTime = Math.max(simTime, 35.0);
  } else if (mode === 'body_close' || mode === 'body_back') {
    // 3rd-person close-up studio framing for inspecting sculpted V-taper jacket, sleeves, cuffs, leather gloves, pants, pack & helmet!
    inspectBodyView = mode;
    const s = physics.state;
    s.edgeAngle = 0.22;
    s.edgeDeg = s.edgeAngle * 64.0;
    s.polePlantR = 0.35;
    s.crouch = 0.18;
    s.speed = 6.5;
    s.vx = Math.sin(s.yaw) * 6.5;
    s.vz = -Math.cos(s.yaw) * 6.5;
  }
}

async function boot() {
  try {
    ui.loaderMsg.textContent = 'Decoding real Chamonix / Mont Blanc EU-DEM topography & textures...';
    terrainData = await new ChamonixTerrainData().load('./assets');

    // Populate all 6 drop-in zones
    ui.dropMenu.innerHTML = '';
    terrainData.meta.dropZones.forEach((dz, i) => {
      const btn = document.createElement('button');
      btn.className = 'drop-btn';
      btn.innerHTML = `<span class="k">${i + 1}</span><span class="lbl">${dz.name}</span><span class="alt">${Math.round(dz.elev)}m · ${dz.slopeDeg}°</span>`;
      btn.addEventListener('click', () => {
        spawnAtZone(i);
        audio.unlock();
        if (!started) {
          started = true;
          ui.startOverlay.classList.add('hidden');
        }
      });
      ui.dropMenu.appendChild(btn);
    });

    // High-res 1536×1536 over 64×64 m (4.1 cm/px razor-sharp parallel twin tracks!)
    trackBuffer = new SnowTrackBuffer(renderer, 64.0, 1536);
    terrainSys = createTerrainSystem(terrainData, trackBuffer);
    scene.add(terrainSys.group);

    skySys = createSkyAndClouds();
    scene.add(skySys.skyMesh);
    scene.add(skySys.valleyCloudMesh);

    propsSys = createAlpineProps(terrainData);
    scene.add(propsSys.group);

    particles = new AlpineParticleSystem(terrainData.textures.powderPuff, 1800, 2600);
    particles.addRidgeSnowBanners(terrainData.meta.peaks);
    scene.add(particles.group);

    skiRig = createSkiRig(terrainData.textures.skiTopsheet, terrainData);
    scene.add(skiRig.group);

    physics = new SkiPhysics(terrainData, propsSys.colliders, propsSys.kickers);
    audio = new SkiAudioEngine();
    loadSavedSettings();
    physics.smoothCarve = settings.smoothCarve;
    setAvalanchesEnabled(settings.avalanches, false);
    audio.setVolume(settings.volume);
    if (ui.btnSound) ui.btnSound.classList.toggle('muted', settings.volume <= 0.001);
    post = new OpticalPostPipeline(renderer, Math.round(window.innerWidth * DPR), Math.round(window.innerHeight * DPR));
    setQualityMode(settings.quality);
    if (params.get('settings') === '1') toggleSettings(true);
    updateGamepadLabel();

    // Apply URL query overrides
    const reqZone = params.get('zone');
    const reqLight = params.get('light');
    const reqCam = params.get('cam');
    if (reqZone) {
      const zi = terrainData.meta.dropZones.findIndex((z) => z.id === reqZone);
      if (zi >= 0) zoneIdx = zi;
    }
    if (reqLight) {
      const li = LIGHTING_PRESETS.findIndex((p) => p.id === reqLight);
      if (li >= 0) lightIdx = li;
    }
    if (reqCam) {
      const ci = CAM_MODES.findIndex((c) => c.id === reqCam);
      if (ci >= 0) camModeIdx = ci;
    }

    setLight(lightIdx);
    setCamMode(camModeIdx);
    spawnAtZone(zoneIdx);
    setHudMode(hudMode);

    const demoMode = params.get('demo');
    if (demoMode) runDeterministicScript(demoMode);

    if (params.has('fwdOff')) {
      const dist = parseFloat(params.get('fwdOff')) || 0;
      const s = physics.state;
      const nx = s.x + Math.sin(s.yaw) * dist;
      const nz = s.z - Math.cos(s.yaw) * dist;
      const t = terrainData.sampleTerrain(nx, nz);
      s.x = nx; s.z = nz; s.y = t.y; s.terrainY = t.y;
      s.surface = t.surface; s.slopeDeg = t.slopeDeg;
      s.normal.set(t.nx, t.ny, t.nz);
      physics._smoothNormal.set(t.nx, t.ny, t.nz);
      if (params.has('yawAdd')) s.yaw += THREE.MathUtils.degToRad(parseFloat(params.get('yawAdd')) || 0);
      physics._updateGroundedQuaternion();
      trackBuffer.reset(nx, nz);
    } else if (params.has('yawAdd')) {
      physics.state.yaw += THREE.MathUtils.degToRad(parseFloat(params.get('yawAdd')) || 0);
      physics._updateGroundedQuaternion();
    }
    if (params.has('edge')) {
      const ed = THREE.MathUtils.clamp(parseFloat(params.get('edge')) || 0, -1.0, 1.0);
      physics.state.edgeAngle = ed;
      physics.state.edgeDeg = ed * 64.0;
      physics.state.insideUnweight = ed * 0.72;
      physics.state.stanceMode = Math.abs(ed) > 0.25 ? 'CARVE' : 'GLIDE';
    }
    if (params.has('foreAft')) {
      physics.state.foreAft = THREE.MathUtils.clamp(parseFloat(params.get('foreAft')) || 0, -1, 1);
    }

    if (params.has('lookYaw')) physics.lookYawOff = THREE.MathUtils.degToRad(parseFloat(params.get('lookYaw')));
    if (params.has('lookPitch')) physics.lookPitchOff = THREE.MathUtils.degToRad(parseFloat(params.get('lookPitch')));
    if (params.get('breath')) physics.state.breathing = parseFloat(params.get('breath'));

    if (started) {
      ui.startOverlay.classList.add('hidden');
    }

    ui.loader.classList.add('hidden');

    window.__CHAMONIX_SIM__ = {
      getState: () => ({
        x: physics.state.x,
        y: physics.state.y,
        z: physics.state.z,
        speedKmh: +(physics.state.speed * 3.6).toFixed(1),
        slopeDeg: +physics.state.slopeDeg.toFixed(1),
        edgeDeg: +(physics.state.edgeDeg || 0).toFixed(1),
        fallAngleDeg: +(physics.state.fallAngleDeg || 0).toFixed(1),
        uphillEdge: physics.state.uphillEdge || 0,
        slipAngleDeg: +THREE.MathUtils.radToDeg(physics.state.slipAngle || 0).toFixed(1),
        sideslip: +(physics.state.sideslip || 0).toFixed(3),
        washOut: +(physics.state.washOut || 0).toFixed(3),
        carveLoadG: +(physics.state.carveLoadG || 1.0).toFixed(2),
        stanceMode: physics.state.stanceMode || 'GLIDE',
        surface: physics.state.surface.id,
        skiDiag: skiRig ? { ...skiRig.lastDiag } : null,
        grounded: physics.state.grounded,
        isSwitch: physics.state.isSwitch,
        crashed: physics.state.crashed,
        airTime: +physics.state.airTime.toFixed(2),
        peakAirHeight: +physics.state.peakAirHeight.toFixed(2),
        avyActive: physics.avalanche.active,
        avyFront: +physics.avalanche.frontDist.toFixed(1),
        avalanchesEnabled: settings.avalanches,
        faceShot: +physics.state.faceShotIntensity.toFixed(3),
        lensWet: +lensWet.toFixed(3),
        sprayRate: +physics.state.sprayRate.toFixed(2),
        replayFrames: physics.replayFrames.length,
        scoutActive,
        replayActive,
        headSteerEnabled: physics.headSteerEnabled,
        pointerLocked,
        lookYawDeg: +THREE.MathUtils.radToDeg(physics.lookYawOff).toFixed(1),
        skiYawDeg: +THREE.MathUtils.radToDeg(physics.state.yaw).toFixed(1),
        camPos: [+camera.position.x.toFixed(3), +camera.position.y.toFixed(3), +camera.position.z.toFixed(3)],
        camYawDeg: (() => {
          const cf = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          return +THREE.MathUtils.radToDeg(Math.atan2(cf.x, -cf.z)).toFixed(1);
        })(),
        camPitchDeg: (() => {
          const cf = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          return +THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(cf.y, -1, 1))).toFixed(1);
        })(),
        landImpact: +physics.state.landImpact.toFixed(3),
        landDisp: +physics._landDisp.toFixed(4),
        crouch: +physics.state.crouch.toFixed(3),
        switchSpinRemDeg: +THREE.MathUtils.radToDeg(physics._switchSpinRem).toFixed(1),
        msaaSamples: post.msaaSamples,
        qualityMode: settings.quality,
        activeTier,
        dpr: +DPR.toFixed(2),
        motionBlur: settings.motionBlur,
        smoothCarve: settings.smoothCarve,
        zone: terrainData.meta.dropZones[zoneIdx].id,
        light: LIGHTING_PRESETS[lightIdx].id,
        cam: CAM_MODES[camModeIdx].id,
        props: propsSys.stats,
        fps: Math.round(lastFps),
        ready: true,
      }),
      setZone: (id) => {
        const i = terrainData.meta.dropZones.findIndex((z) => z.id === id);
        if (i >= 0) spawnAtZone(i);
      },
      setPosition: (x, z, yawDeg = null) => {
        const t = terrainData.sampleTerrain(x, z);
        const s = physics.state;
        s.x = x; s.z = z; s.y = t.y; s.terrainY = t.y;
        s.vx = 0; s.vy = 0; s.vz = 0; s.speed = 0;
        s.grounded = true; s.crashed = false; s.isSwitch = false;
        s.edgeAngle = 0; s.edgeDeg = 0; s.slipAngle = 0; s.sideslip = 0; s.washOut = 0;
        s.prevLeftSki = null; s.prevRightSki = null;
        s.surface = t.surface; s.slopeDeg = t.slopeDeg;
        s.normal.set(t.nx, t.ny, t.nz);
        physics._smoothNormal.set(t.nx, t.ny, t.nz);
        if (yawDeg !== null) s.yaw = THREE.MathUtils.degToRad(yawDeg);
        physics._updateGroundedQuaternion();
        trackBuffer.reset(x, z);
      },
      polePush: (side = 0) => physics.triggerPoleStroke(side, simTime, 1.0),
      setLight: (id) => {
        const i = LIGHTING_PRESETS.findIndex((p) => p.id === id);
        if (i >= 0) setLight(i);
      },
      setCam: (id) => {
        const i = CAM_MODES.findIndex((c) => c.id === id);
        if (i >= 0) setCamMode(i);
      },
      setLook: (yawDeg, pitchDeg) => {
        physics.lookYawOff = THREE.MathUtils.degToRad(yawDeg);
        physics.lookPitchOff = THREE.MathUtils.degToRad(pitchDeg);
        physics.clampLookOffsets();
      },
      moveHead: (dYawDeg, dPitchDeg = 0) => {
        physics.addHeadLookDelta(THREE.MathUtils.degToRad(dYawDeg), THREE.MathUtils.degToRad(dPitchDeg));
      },
      stepSeconds: (sec, keys = []) => {
        physics.keys.clear();
        keys.forEach((k) => physics.keys.add(k));
        const n = Math.round(sec / FIXED_DT);
        for (let i = 0; i < n; i++) {
          simTime += FIXED_DT;
          physics.step(FIXED_DT, simTime);
          consumePhysicsEvents();
        }
        physics.keys.clear();
      },
      triggerAvalanche: () => physics.triggerAvalanche(-22, 30),
      setAvalanches: (v) => setAvalanchesEnabled(!!v, false),
      toggleScout: () => toggleScout(),
      toggleReplay: () => toggleReplay(),
      toggleSwitch: (instant = false) => physics.toggleSwitch(simTime, instant),
      triggerJump: (charge = 0.85) => {
        physics.state.popCharge = charge;
        physics.prevJumpHeld = true;
        physics.keys.delete('Space');
      },
      setHud: (v) => setHudVisibility(v),
      setQuality: (m) => setQualityMode(m),
      toggleSettings: (v = null) => toggleSettings(v),
      runDemo: (m) => runDeterministicScript(m),
      renderOnce: () => renderFrame(0.016, false),
    };

    bindEvents();
    requestAnimationFrame(frameLoop);
  } catch (err) {
    console.error('__BOOT_ERROR__', err);
    ui.loaderMsg.textContent = `Load error: ${err.message}`;
  }
}

function bindEvents() {
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.resize(Math.round(w * DPR), Math.round(h * DPR));
    syncSettingsUI();
  });

  const requestLockSafe = () => {
    try {
      if (canvas.requestPointerLock && document.pointerLockElement !== canvas) {
        const res = canvas.requestPointerLock();
        if (res && typeof res.catch === 'function') res.catch(() => {});
      }
    } catch (_e) {}
  };

  const recenterHead = () => {
    physics.lookYawOff = 0;
    physics.lookPitchOff = -0.14;
    showToast('HEAD VIEW CENTERED', 1.4);
  };

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = (document.pointerLockElement === canvas);
    hoverLastX = null;
    hoverLastY = null;
    if (ui.lockHint) {
      ui.lockHint.textContent = pointerLocked
        ? 'HEAD LOOK LOCKED · L / MMB = CENTER · ESC = CURSOR'
        : 'MOVE MOUSE TO LOOK AROUND · CLICK SNOW TO LOCK VIEW';
      ui.lockHint.classList.toggle('locked', pointerLocked);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    audio.unlock();
    if (!started && ['KeyW', 'ArrowUp', 'Space', 'Enter', 'KeyF', 'KeyQ', 'KeyE'].includes(e.code)) {
      started = true;
      ui.startOverlay.classList.add('hidden');
      physics.triggerPoleStroke(0, simTime, 0.85);
    }
    physics.keys.add(e.code);

    if (e.code === 'Digit1') spawnAtZone(0);
    else if (e.code === 'Digit2') spawnAtZone(1);
    else if (e.code === 'Digit3') spawnAtZone(2);
    else if (e.code === 'Digit4') spawnAtZone(3);
    else if (e.code === 'Digit5') spawnAtZone(4);
    else if (e.code === 'Digit6') spawnAtZone(5);
    else if (e.code === 'KeyT') setLight(lightIdx + 1);
    else if (e.code === 'KeyC') { exitSpecialModes(); setCamMode(camModeIdx + 1); }
    else if (e.code === 'KeyV') toggleScout();
    else if (e.code === 'KeyP') toggleReplay();
    else if (e.code === 'KeyL') recenterHead();
    else if (e.code === 'KeyG') {
      if (!settings.avalanches) {
        showToast('AVALANCHES ARE OFF — CLICK AVY: OFF TO ENABLE', 2.4);
      } else {
        exitSpecialModes();
        if (physics.triggerAvalanche(-22, 32)) {
          showToast('SLAB AVALANCHE RELEASED — SKI SIDEWAYS!', 3.2);
        }
      }
    } else if (e.code === 'KeyX') {
      if (physics.state.grounded && !physics.state.crashed) {
        if (physics.toggleSwitch(simTime, false)) {
          audio.playPop(0.45);
          showToast(physics.state.isSwitch ? 'SWITCH STANCE (FAKIE · VIEW FLIPPED 180°)' : 'FORWARD STANCE', 1.8);
        }
      }
    } else if (e.code === 'Escape') {
      if (settingsOpen) toggleSettings(false);
      else exitSpecialModes();
    } else if (e.code === 'KeyO') {
      toggleSettings();
    } else if (e.code === 'KeyR') {
      if (scoutActive || replayActive) exitSpecialModes();
      else if (physics.state.crashed) physics.standUpHere();
      else spawnAtZone(zoneIdx);
    } else if (e.code === 'KeyM') {
      const on = audio.toggleMute();
      ui.btnSound.classList.toggle('muted', !on);
      if (on && settings.volume <= 0.01) settings.volume = audio.volume;
      syncSettingsUI();
    } else if (e.code === 'KeyH') {
      setHudMode(hudMode + 1);
    }
  });

  window.addEventListener('keyup', (e) => {
    physics.keys.delete(e.code);
  });

  // Seamless Head-Look Mouse Input:
  //  1) Pointer Lock active -> infinite raw 360° FPS movementX/movementY (zero screen edge limits!)
  //  2) Unlocked fallback -> simply moving the mouse over the snow canvas STILL smoothly turns your head (zero drag needed!)
  const LOCK_SENS_X = 0.0024;
  const LOCK_SENS_Y = 0.0020;
  const HOVER_SENS_X = 0.0032;
  const HOVER_SENS_Y = 0.0025;

  window.addEventListener('mousemove', (e) => {
    if (!started || scoutActive || replayActive || pausedSim) return;
    const sens = settings.lookSens;
    const ySign = settings.invertY ? 1 : -1;
    if (pointerLocked) {
      // Guard occasional Chromium pointer-lock raw jump glitch spikes
      const mx = Math.abs(e.movementX) < 220 ? e.movementX : 0;
      const my = Math.abs(e.movementY) < 220 ? e.movementY : 0;
      physics.addHeadLookDelta(mx * LOCK_SENS_X * sens, my * LOCK_SENS_Y * sens * ySign);
      return;
    }
    if (e.target !== canvas || settingsOpen) {
      hoverInsideCanvas = false;
      hoverLastX = null;
      hoverLastY = null;
      return;
    }
    hoverInsideCanvas = true;
    hoverNormX = (e.clientX / Math.max(1, window.innerWidth)) * 2.0 - 1.0;
    if (hoverLastX !== null && hoverLastY !== null) {
      const dx = e.clientX - hoverLastX;
      const dy = e.clientY - hoverLastY;
      if (Math.abs(dx) < 160 && Math.abs(dy) < 160) {
        physics.addHeadLookDelta(dx * HOVER_SENS_X * sens, dy * HOVER_SENS_Y * sens * ySign);
      }
    }
    hoverLastX = e.clientX;
    hoverLastY = e.clientY;
  });

  canvas.addEventListener('pointerleave', () => {
    hoverInsideCanvas = false;
    hoverLastX = null;
    hoverLastY = null;
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
      physics.grabHeld = true;
      return;
    }
    if (e.button === 1) {
      recenterHead();
      e.preventDefault();
      return;
    }
    if (e.button === 0 && e.target === canvas) {
      if (settingsOpen) {
        toggleSettings(false);
        return;
      }
      audio.unlock();
      if (!started) {
        started = true;
        ui.startOverlay.classList.add('hidden');
      }
      requestLockSafe();
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 2) physics.grabHeld = false;
    if (e.button === 1) physics.freeLookHeld = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  ui.startOverlay.addEventListener('click', () => {
    audio.unlock();
    started = true;
    ui.startOverlay.classList.add('hidden');
    requestLockSafe();
    physics.triggerPoleStroke(0, simTime, 0.85);
  });

  ui.btnSound.addEventListener('click', () => {
    const on = audio.toggleMute();
    ui.btnSound.classList.toggle('muted', !on);
    if (on && settings.volume <= 0.01) settings.volume = audio.volume;
    syncSettingsUI();
  });
  ui.btnCam.addEventListener('click', () => { exitSpecialModes(); setCamMode(camModeIdx + 1); });
  ui.btnLight.addEventListener('click', () => setLight(lightIdx + 1));
  ui.btnScout.addEventListener('click', () => toggleScout());
  ui.btnReplay.addEventListener('click', () => toggleReplay());
  if (ui.btnAvyToggle) {
    ui.btnAvyToggle.addEventListener('click', () => setAvalanchesEnabled(!settings.avalanches, true));
  }
  ui.btnAvy.addEventListener('click', () => {
    if (!settings.avalanches) {
      showToast('AVALANCHES ARE OFF — CLICK AVY: OFF TO ENABLE', 2.4);
      return;
    }
    exitSpecialModes();
    if (physics.triggerAvalanche(-22, 32)) {
      showToast('SLAB AVALANCHE RELEASED — SKI SIDEWAYS!', 3.2);
    }
  });
  ui.btnReset.addEventListener('click', () => spawnAtZone(zoneIdx));
  ui.btnHelp.addEventListener('click', () => ui.controlsHint.classList.toggle('collapsed'));

  // Bundle F: Settings Popover Controls
  if (ui.btnSettings) ui.btnSettings.addEventListener('click', () => toggleSettings());
  if (ui.btnSettingsClose) ui.btnSettingsClose.addEventListener('click', () => toggleSettings(false));
  if (ui.qualGroup) {
    ui.qualGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.seg-btn');
      if (btn && btn.dataset.q) setQualityMode(btn.dataset.q);
    });
  }
  if (ui.setVolSlider) {
    ui.setVolSlider.addEventListener('input', (e) => {
      audio.unlock();
      settings.volume = Math.max(0, Math.min(1, parseInt(e.target.value, 10) / 100));
      audio.setVolume(settings.volume);
      ui.btnSound.classList.toggle('muted', settings.volume <= 0.001);
      syncSettingsUI();
      saveSettings();
    });
  }
  if (ui.setSensSlider) {
    ui.setSensSlider.addEventListener('input', (e) => {
      settings.lookSens = Math.max(0.4, Math.min(2.2, parseInt(e.target.value, 10) / 100));
      syncSettingsUI();
      saveSettings();
    });
  }
  if (ui.setInvertY) {
    ui.setInvertY.addEventListener('click', () => {
      settings.invertY = !settings.invertY;
      syncSettingsUI();
      saveSettings();
    });
  }
  if (ui.setMotionBlur) {
    ui.setMotionBlur.addEventListener('click', () => {
      settings.motionBlur = !settings.motionBlur;
      syncSettingsUI();
      saveSettings();
    });
  }
  if (ui.setSmoothCarve) {
    ui.setSmoothCarve.addEventListener('click', () => {
      settings.smoothCarve = !settings.smoothCarve;
      physics.smoothCarve = settings.smoothCarve;
      syncSettingsUI();
      saveSettings();
    });
  }
  if (ui.setAvalanches) {
    ui.setAvalanches.addEventListener('click', () => {
      setAvalanchesEnabled(!settings.avalanches, true);
    });
  }
  if (ui.btnSettingsReset) {
    ui.btnSettingsReset.addEventListener('click', () => {
      Object.assign(settings, DEFAULT_SETTINGS);
      physics.smoothCarve = settings.smoothCarve;
      setAvalanchesEnabled(settings.avalanches, false);
      audio.setVolume(settings.volume);
      ui.btnSound.classList.remove('muted');
      setQualityMode(settings.quality);
      syncSettingsUI();
      saveSettings();
    });
  }

  // Gamepad hot-plug notifications
  window.addEventListener('gamepadconnected', () => {
    updateGamepadLabel();
    showToast('GAMEPAD CONNECTED · STICKS = CARVE / LOOK', 2.8);
  });
  window.addEventListener('gamepaddisconnected', () => {
    updateGamepadLabel();
  });

  // Touchscreen drag support (left half = carve/tuck, right half = 360° head-look)
  let steerTouchId = null;
  let steerOriginX = 0;
  let steerOriginY = 0;
  let lookTouchId = null;
  let lookLastX = 0;
  let lookLastY = 0;
  canvas.addEventListener('touchstart', (e) => {
    audio.unlock();
    if (!started) {
      started = true;
      ui.startOverlay.classList.add('hidden');
      physics.triggerPoleStroke(0, simTime, 0.85);
    }
    const midX = window.innerWidth * 0.5;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < midX && steerTouchId === null) {
        steerTouchId = t.identifier;
        steerOriginX = t.clientX;
        steerOriginY = t.clientY;
      } else if (t.clientX >= midX && lookTouchId === null) {
        lookTouchId = t.identifier;
        lookLastX = t.clientX;
        lookLastY = t.clientY;
      }
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    const sens = settings.lookSens;
    const ySign = settings.invertY ? 1 : -1;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === steerTouchId) {
        physics.touchSteer = THREE.MathUtils.clamp((t.clientX - steerOriginX) / 85.0, -1, 1);
        physics.touchFore = THREE.MathUtils.clamp(-(t.clientY - steerOriginY) / 85.0, -1, 1);
      } else if (t.identifier === lookTouchId) {
        const dx = t.clientX - lookLastX;
        const dy = t.clientY - lookLastY;
        physics.addHeadLookDelta(dx * 0.0042 * sens, dy * 0.0034 * sens * ySign);
        lookLastX = t.clientX;
        lookLastY = t.clientY;
      }
    }
  }, { passive: true });
  const endTouch = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === steerTouchId) {
        steerTouchId = null;
        physics.touchSteer = 0;
        physics.touchFore = 0;
      } else if (t.identifier === lookTouchId) {
        lookTouchId = null;
      }
    }
  };
  canvas.addEventListener('touchend', endTouch, { passive: true });
  canvas.addEventListener('touchcancel', endTouch, { passive: true });

  // Tap-to-toggle drop-zone menu (essential for mobile / touch screens)
  const topLeftEl = document.querySelector('.top-left');
  const zonePillEl = document.querySelector('.zone-pill');
  if (topLeftEl && zonePillEl) {
    zonePillEl.addEventListener('click', (e) => {
      e.stopPropagation();
      topLeftEl.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!topLeftEl.contains(e.target)) topLeftEl.classList.remove('open');
    });
  }

  // Mobile & tablet touch action buttons (POLE / SWITCH / POP)
  const btnTouchPole = document.getElementById('btnTouchPole');
  const btnTouchSwitch = document.getElementById('btnTouchSwitch');
  const btnTouchPop = document.getElementById('btnTouchPop');
  if (btnTouchPole) {
    const startPole = (e) => {
      e.preventDefault(); e.stopPropagation();
      audio.unlock();
      if (!started) { started = true; ui.startOverlay.classList.add('hidden'); }
      physics.touchPoleHeld = true;
      btnTouchPole.classList.add('active');
      physics.triggerPoleStroke(0, simTime, 1.0);
    };
    const endPole = () => {
      physics.touchPoleHeld = false;
      btnTouchPole.classList.remove('active');
    };
    btnTouchPole.addEventListener('pointerdown', startPole);
    btnTouchPole.addEventListener('pointerup', endPole);
    btnTouchPole.addEventListener('pointercancel', endPole);
    btnTouchPole.addEventListener('pointerleave', endPole);
  }
  if (btnTouchSwitch) {
    const fireSwitch = (e) => {
      e.preventDefault(); e.stopPropagation();
      audio.unlock();
      if (!started) { started = true; ui.startOverlay.classList.add('hidden'); }
      if (physics.state.grounded && !physics.state.crashed) {
        if (physics.toggleSwitch(simTime, false)) {
          audio.playPop(0.45);
          showToast(physics.state.isSwitch ? 'SWITCH STANCE (FAKIE · VIEW FLIPPED 180°)' : 'FORWARD STANCE', 1.8);
        }
      }
    };
    btnTouchSwitch.addEventListener('pointerdown', fireSwitch);
  }
  if (btnTouchPop) {
    let popReleaseTimer = null;
    btnTouchPop.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      audio.unlock();
      if (!started) { started = true; ui.startOverlay.classList.add('hidden'); }
      if (popReleaseTimer) { clearTimeout(popReleaseTimer); popReleaseTimer = null; }
      physics.jumpHeld = true;
      btnTouchPop.classList.add('active');
    });
    const endPop = () => {
      btnTouchPop.classList.remove('active');
      if (physics.jumpHeld && physics.state.popCharge < 0.08) {
        if (popReleaseTimer) clearTimeout(popReleaseTimer);
        popReleaseTimer = setTimeout(() => {
          physics.jumpHeld = false;
          popReleaseTimer = null;
        }, 90);
      } else {
        physics.jumpHeld = false;
      }
    };
    btnTouchPop.addEventListener('pointerup', endPop);
    btnTouchPop.addEventListener('pointercancel', endPop);
    btnTouchPop.addEventListener('pointerleave', endPop);
  }
}

let lastNow = performance.now();
const pausedSim = params.get('pause') === '1';

// Optical & camera-velocity tracking scratch objects (zero per-frame GC allocation!)
const _prevCamQuat = new THREE.Quaternion();
let _hasPrevCam = false;
const _smoothAngVel = new THREE.Vector2(0, 0);
let _smoothRollVel = 0.0;
const demoAngVelOverride = new THREE.Vector2(0, 0);
const _projVec = new THREE.Vector3();
const _sunUV = new THREE.Vector2(0.5, 0.8);
const _horizonUV = new THREE.Vector2(0.5, 0.55);
const _camFwd = new THREE.Vector3();
const _camRgt = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _prevFwd = new THREE.Vector3();
const _prevUp = new THREE.Vector3();
let _smoothSunVis = 0.0;

/**
 * Fast 10-step CPU line-of-sight solar occlusion probe against real EU-DEM heightfield (<0.02 ms/frame!).
 * Returns 0.0 when mountain ridges eclipse the sun, 1.0 when solar disc shines unobstructed!
 */
function sampleSunLOS(ox, oy, oz, sunDir) {
  if (!terrainData || sunDir.y <= 0.02) return 0.0;
  let minClear = 1e9;
  const dists = [45, 110, 240, 480, 860, 1450, 2250, 3250, 4450, 5800];
  for (let i = 0; i < dists.length; i++) {
    const d = dists[i];
    const px = ox + sunDir.x * d;
    const pz = oz + sunDir.z * d;
    if (Math.abs(px) > 6300 || Math.abs(pz) > 6300) break;
    const rayY = oy + sunDir.y * d;
    const terrY = terrainData.sampleHeight(px, pz);
    const angleDiff = (rayY - terrY) / d;
    if (angleDiff < minClear) minClear = angleDiff;
    if (minClear < -0.028) return 0.0;
  }
  return THREE.MathUtils.smoothstep(minClear, -0.022, 0.036);
}

function renderFrame(dt, stepSim = true) {
  const preset = LIGHTING_PRESETS[lightIdx];
  const sunDir = sunDirFromPreset(preset);
  const liveStep = stepSim && started && !pausedSim && !scoutActive && !replayActive && !inspectBodyView;

  if (liveStep) {
    // Gentle continuous edge-turn when unlocked cursor rests near left/right screen borders so player can carve continuous turns even without Pointer Lock!
    if (!pointerLocked && hoverInsideCanvas && Math.abs(hoverNormX) > 0.80) {
      const edgePush = (Math.abs(hoverNormX) - 0.80) / 0.20;
      physics.addHeadLookDelta(Math.sign(hoverNormX) * edgePush * 1.15 * dt, 0);
    }
    physAccum = Math.min(0.08, physAccum + dt);
    while (physAccum >= FIXED_DT) {
      simTime += FIXED_DT;
      physics.step(FIXED_DT, simTime);
      consumePhysicsEvents();
      physAccum -= FIXED_DT;
    }
    const windDecay = preset.id === 'storm' ? 0.0005 : 0.0;
    trackBuffer.recenterIfNeeded(physics.state.x, physics.state.z, windDecay);
    particles.emitAvalancheWave(physics.avalanche, terrainData, dt);
    emitSpindrift(dt, preset);
  } else if (stepSim && !pausedSim) {
    simTime += dt;
  }

  const s = physics.state;
  if (s.faceShotIntensity > 0.40 && liveStep) {
    lensWet = Math.min(0.85, lensWet + dt * s.faceShotIntensity * 0.25);
  } else if (liveStep) {
    lensWet = Math.max(0, lensWet - dt * 0.28);
  }

  const camMode = CAM_MODES[camModeIdx].id;
  let activeState = s;
  let focusXZ = new THREE.Vector2(s.x, s.z);
  let isThirdPerson = false;
  let replayProg = 0;

  if (scoutActive) {
    if (!pausedSim) {
      scoutPhase += dt / SCOUT_DURATION;
      if (scoutPhase >= 1.0) toggleScout(false);
    }
    if (scoutActive) {
      focusXZ = applyScoutCamera(scoutPhase);
      isThirdPerson = true; // show tiny skier waiting at the drop-in cornice!
    }
  } else if (replayActive) {
    const res = applyReplayFrame(pausedSim ? 0 : dt);
    if (res) {
      activeState = res.state;
      replayProg = res.prog;
      focusXZ.set(activeState.x, activeState.z);
      isThirdPerson = true;
    }
  } else if (inspectBodyView) {
    isThirdPerson = true;
    const fx = Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    const rx = Math.cos(s.yaw), rz = Math.sin(s.yaw);
    const isBack = inspectBodyView === 'body_back';
    const cx = s.x + (isBack ? -fx * 2.15 + rx * 1.15 : fx * 2.05 + rx * 1.32);
    const cz = s.z + (isBack ? -fz * 2.15 + rz * 1.15 : fz * 2.05 + rz * 1.32);
    const cy = Math.max(terrainData.sampleHeight(cx, cz) + 0.65, s.y + (isBack ? 1.55 : 1.32));
    camera.position.set(cx, cy, cz);
    camera.lookAt(s.x + fx * 0.08, s.y + 0.96, s.z + fz * 0.08);
    camera.fov = 48;
    camera.updateProjectionMatrix();
  }

  if (!scoutActive && !replayActive && !inspectBodyView) {
    physics.applyCamera(camera, camMode, simTime, dt);
  }
  camera.updateMatrixWorld(true);

  // Real terrain-horizon solar visibility right at skier (for keyLight attenuation & live shadow catcher)
  // AND at the camera eye (for authentic action-cam optical sun lens flare occlusion behind granite peaks!)
  const isStorm = preset.id === 'storm';
  const mtnSunSkier = isStorm ? 0.15 : sampleSunLOS(activeState.x, activeState.y + 1.1, activeState.z, sunDir);
  const camSunLOS = isStorm ? 0.0 : sampleSunLOS(camera.position.x, camera.position.y + 0.2, camera.position.z, sunDir);

  // Anchor hardware PCF shadow camera DEAD-CENTER on skier torso (activeState.x, y+0.90, z).
  // Parallel orthographic sun rays stay invariant in light XY regardless of shadow stretch down steep slopes (up to 48m far!).
  const ltX = activeState.x;
  const ltY = activeState.y + 0.90;
  const ltZ = activeState.z;
  keyLight.target.position.set(ltX, ltY, ltZ);
  keyLight.target.updateMatrixWorld();
  keyLight.position.set(
    ltX + sunDir.x * 14.0,
    ltY + sunDir.y * 14.0,
    ltZ + sunDir.z * 14.0
  );
  keyLight.intensity = preset.sunIntensity * 0.95 * (isStorm ? 0.35 : (0.14 + 0.86 * mtnSunSkier));

  const renderTime = pausedSim ? (simTime || 4.2) : simTime;
  const isAlpenglow = preset.id === 'alpenglow';
  const isFP = !isThirdPerson && !scoutActive && !replayActive;
  const isChesty = (camMode === 'chesty' && isFP);
  skiRig.update(activeState, pausedSim ? 0.016 : dt, isThirdPerson, renderTime, sunDir, isStorm, physics.lookYawOff, mtnSunSkier, isAlpenglow, isChesty, preset);

  // Project sun direction into screen UV space for BOTH optical lens flare AND pixel-accurate volumetric god-rays!
  // Note: `_sunUV` updates whenever sun is in front hemisphere (`sunDot > 0.08`) even if sun disc sits JUST behind
  // a ridge or spruce crown, so GPU crepuscular shafts stream past the silhouette cleanly!
  _camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _camRgt.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const sunDot = _camFwd.dot(sunDir);
  let targetSunVis = 0.0;
  let godRayVis = 0.0;
  if (sunDot > 0.08 && !isStorm) {
    _projVec.copy(camera.position).addScaledVector(sunDir, 5000).project(camera);
    _sunUV.set(_projVec.x * 0.5 + 0.5, _projVec.y * 0.5 + 0.5);
    godRayVis = THREE.MathUtils.smoothstep(sunDot, 0.08, 0.50);
    if (sunDot > 0.18 && camSunLOS > 0.01) {
      targetSunVis = camSunLOS * THREE.MathUtils.smoothstep(sunDot, 0.18, 0.55);
    }
  }
  _smoothSunVis = pausedSim ? targetSunVis : (_smoothSunVis + (targetSunVis - _smoothSunVis) * Math.min(1, dt * 10.0));

  // Auto-iris exposure lag (photoreal momentary bright/dark surge gliding between mountain shade and blazing sunlit faces!)
  const sunLook = Math.max(0, sunDot) * camSunLOS;
  const shadeLift = (1.0 - Math.max(0, activeState.normal.dot(sunDir)) * mtnSunSkier) * 0.16;
  const flareSquint = _smoothSunVis * 0.12;
  const targetExp = preset.exposure * (1.0 - sunLook * 0.18 - flareSquint + shadeLift);
  smoothExposure = pausedSim ? targetExp : (smoothExposure + (targetExp - smoothExposure) * Math.min(1, dt * 1.45));

  // Real angular camera whip velocity (`dYaw`, `dPitch`, `dRoll` per 1/120s shutter interval!)
  if (_hasPrevCam && !pausedSim && !scoutActive && !replayActive && dt > 0.0005) {
    _prevFwd.set(0, 0, -1).applyQuaternion(_prevCamQuat);
    _prevUp.set(0, 1, 0).applyQuaternion(_prevCamQuat);
    const dX = _prevFwd.dot(_camRgt); // horizontal screen shift
    const dY = _prevFwd.dot(_camUp);  // vertical screen shift
    const dR = _prevUp.dot(_camRgt);  // roll twist
    // Ignore giant jumps on reset/zone switches/frame hitches
    if (Math.hypot(dX, dY) < 0.35) {
      const shutter = 0.0085 / Math.max(0.004, dt); // authentic ~1/120s action-cam exposure shutter!
      const fovScale = 1.0 / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      const tx = THREE.MathUtils.clamp(dX * fovScale * shutter * 0.55, -0.042, 0.042);
      const ty = THREE.MathUtils.clamp(dY * fovScale * shutter * 0.55, -0.042, 0.042);
      _smoothAngVel.x += (tx - _smoothAngVel.x) * Math.min(1, dt * 18);
      _smoothAngVel.y += (ty - _smoothAngVel.y) * Math.min(1, dt * 18);
      _smoothRollVel += (THREE.MathUtils.clamp(dR * shutter * 0.35, -0.025, 0.025) - _smoothRollVel) * Math.min(1, dt * 18);
    } else {
      _smoothAngVel.set(0, 0);
      _smoothRollVel = 0;
    }
  } else if (demoAngVelOverride.lengthSq() > 0) {
    _smoothAngVel.copy(demoAngVelOverride);
    _smoothRollVel = 0;
  } else if (pausedSim) {
    _smoothAngVel.set(0, 0);
    _smoothRollVel = 0;
  }
  _prevCamQuat.copy(camera.quaternion);
  _hasPrevCam = true;

  // Project true travel-direction vanishing point for directional ground-rush motion blur (works forward AND switch/fakie!)
  const spd = activeState.speed;
  if (spd > 1.5) {
    _projVec.set(activeState.vx / spd, activeState.vy / spd, activeState.vz / spd);
    const vDot = _projVec.dot(_camFwd);
    if (Math.abs(vDot) > 0.15) {
      _projVec.multiplyScalar(vDot >= 0 ? 5000 : -5000).add(camera.position).project(camera);
      _horizonUV.set(
        THREE.MathUtils.clamp(_projVec.x * 0.5 + 0.5, -0.35, 1.35),
        THREE.MathUtils.clamp(_projVec.y * 0.5 + 0.5, -0.25, 1.25)
      );
    } else {
      _horizonUV.set(0.5, 0.56);
    }
  } else {
    _horizonUV.set(0.5, 0.56);
  }

  skySys.update(camera.position, preset, sunDir, renderTime);
  terrainSys.update(camera.position, focusXZ, preset, sunDir, renderTime, trackBuffer, physics.avalanche);
  propsSys.update(camera.position, preset, sunDir, renderTime);
  particles.update(
    stepSim && !pausedSim ? dt : 0,
    camera.position,
    window.innerHeight * DPR,
    camera.fov,
    preset,
    sunDir,
    simTime
  );
  audio.update(s, preset, physics.avalanche, dt);

  const kmh = activeState.speed * 3.6;
  // Smooth velocity-coupled motion blur starting gently at 22 km/h (NOT waiting until 58 km/h!)
  // Skis, gloves & body stay 100% razor-sharp via the foreground alpha mask in post_optics.js!
  const speedBlur = (scoutActive || replayActive || inspectBodyView) ? 0.0 : THREE.MathUtils.clamp((kmh - 22) / 68, 0, 1.15);
  const breathAmt = isFP ? THREE.MathUtils.clamp((s.breathing - 0.15) * (1.0 - kmh / 20.0), 0, 1) : 0.0;
  // Driving snow streaks ONLY in Alpine Squall blizzard (never fake white lines over clear sunny skies or drone cam!)
  const stormStreaks = isStorm ? 0.88 : 0.0;

  post.render(scene, camera, {
    exposure: smoothExposure,
    bloomStrength: isStorm ? 0.10 : (preset.id === 'alpenglow' ? 0.34 : 0.27),
    skipBloom: activeSkipBloom,
    skipGodRays: activeSkipGodRays,
    disableMotionBlur: !settings.motionBlur,
    barrel: ((camMode === 'gopro' || camMode === 'chesty') && isFP) ? 0.055 : 0.0,
    speedFactor: speedBlur,
    angVel: _smoothAngVel,
    rollVel: _smoothRollVel,
    horizonUV: _horizonUV,
    sunUV: _sunUV,
    sunVis: isStorm ? 0.0 : _smoothSunVis,
    godRayVis,
    godRayStrength: isStorm ? 0.0 : (isAlpenglow ? 0.92 : (preset.id === 'afternoon' ? 0.80 : (preset.id === 'morning' ? 0.65 : 0.42))),
    sunColor: preset.sunColor,
    faceShot: isFP ? s.faceShotIntensity : 0.0,
    lensWet: isFP ? lensWet : 0.0,
    breath: breathAmt,
    stormStreaks,
    time: pausedSim ? 4.2 : simTime,
  });

  updateHUD(simTime, activeState, replayProg);
}

function frameLoop(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
  lastNow = now;

  pollGamepad(dt);

  fpsFrames++;
  fpsAccum += dt;
  if (fpsAccum >= 0.4) {
    lastFps = fpsFrames / fpsAccum;
    fpsFrames = 0;
    fpsAccum = 0;
    if (ui.fpsChip) {
      ui.fpsChip.classList.toggle('low', lastFps < 32);
    }
  }

  // Auto-adaptive resolution & post-FX governor for integrated GPUs / Chromebooks
  if (settings.quality === 'auto' && !autoCaptureMode && !pausedSim && started) {
    autoFpsFrames++;
    autoFpsAccum += dt;
    if (autoFpsAccum >= 2.4) {
      const avgFps = autoFpsFrames / autoFpsAccum;
      autoFpsFrames = 0;
      autoFpsAccum = 0;
      if (avgFps < 32 && activeTier < 2) {
        autoLowStreak++;
        autoHighStreak = 0;
        if (autoLowStreak >= 2) {
          autoLowStreak = 0;
          applyQualityTier(activeTier + 1, false);
        }
      } else if (avgFps > 54 && activeTier > 0) {
        autoHighStreak++;
        autoLowStreak = 0;
        if (autoHighStreak >= 4) {
          autoHighStreak = 0;
          applyQualityTier(activeTier - 1, false);
        }
      } else {
        autoLowStreak = 0;
        autoHighStreak = 0;
      }
    }
  }

  renderFrame(dt, true);
  requestAnimationFrame(frameLoop);
}

boot();
