// Puzzle Card: the sounds. All of them are made on the spot with Web Audio (no sound files):
//   snip  — the knife going through one piece        step — the machine moving down one row
//   move  — the machine travelling (down to the print, back up to rest)
//   snap  — two pieces clicking together             done — the last piece is in
//   flip  — the card turning over
// Browsers only allow sound after the first tap or key press, so nothing is made before one: a sent puzzle that
// bursts open by itself is silent until it is touched, and the headless share-picture shots stay silent.
let ctx = null, out = null, noiseBuf = null, lastSnip = 0, snipsNow = 0;

function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    out = ctx.createDynamicsCompressor();            // a soft ceiling, so a dozen snips at once never get loud
    out.threshold.value = -16; out.knee.value = 12; out.ratio.value = 5;
    const vol = ctx.createGain(); vol.gain.value = 0.9;
    out.connect(vol); vol.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}
addEventListener('pointerdown', unlock, true);
addEventListener('keydown', unlock, true);
const live = () => !!ctx && ctx.state !== 'closed';   // a context still waking up plays what it was given as soon as it runs

// a burst of filtered noise; f0 -> f1 glides over the burst
function noise(t, dur, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, gain = 0.2, attack = 0.002 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.03);
}
// one pitched note with a soft attack and a long tail
function tone(t, freq, dur, { type = 'sine', gain = 0.15, attack = 0.004, f1 } = {}) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freq, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.03);
}
const vary = (x, k = 0.08) => x * (1 + (Math.random() - 0.5) * 2 * k);

// The cut sounds like a paper shredder, only heavier (user 11/19). While the light sweeps a row, shred() runs
// for the length of the sweep: a low motor growl whose teeth rumble ~28 times a second, plus torn paper (a
// crunchy mid band and a heavy low band) whose loudness jumps grain by grain. Returns { stop() } so a pause cuts it.
export function shred(dur) {
  if (!live()) return null;
  const t = ctx.currentTime, d = Math.max(0.15, dur), end = t + d;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t); master.gain.exponentialRampToValueAtTime(1, t + 0.035);
  master.gain.setValueAtTime(1, end - 0.07); master.gain.exponentialRampToValueAtTime(0.0001, end);
  master.connect(out);
  // the motor
  const m = ctx.createOscillator(); m.type = 'sawtooth'; m.frequency.value = vary(58, 0.05);
  const mf = ctx.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 300; mf.Q.value = 0.8;
  const mg = ctx.createGain(); mg.gain.value = 0.11;
  const teeth = ctx.createOscillator(); teeth.type = 'square'; teeth.frequency.value = vary(28, 0.1);
  const tg = ctx.createGain(); tg.gain.value = 0.06; teeth.connect(tg); tg.connect(mg.gain);
  m.connect(mf); mf.connect(mg); mg.connect(master);
  // the paper
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
  const crunch = ctx.createBiquadFilter(); crunch.type = 'bandpass'; crunch.frequency.value = vary(1000); crunch.Q.value = 0.9;
  const weight = ctx.createBiquadFilter(); weight.type = 'lowpass'; weight.frequency.value = 360; weight.Q.value = 0.7;
  const cg = ctx.createGain(); cg.gain.value = 0.26;
  const wg = ctx.createGain(); wg.gain.value = 0.3;
  const grain = ctx.createGain();
  const curve = new Float32Array(Math.max(8, Math.round(d * 48)));
  for (let i = 0; i < curve.length; i++) curve[i] = Math.random() < 0.18 ? 0.2 + Math.random() * 0.2 : 0.6 + Math.random() * 0.4;
  grain.gain.setValueCurveAtTime(curve, t, d);
  n.connect(crunch); crunch.connect(cg); cg.connect(grain);
  n.connect(weight); weight.connect(wg); wg.connect(grain);
  grain.connect(master);
  const srcs = [m, teeth, n];
  srcs.forEach(s => s.start(t)); srcs.forEach(s => s.stop(end + 0.05));
  return {
    stop() {
      const now = ctx.currentTime; if (now >= end) return;
      master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      srcs.forEach(s => { try { s.stop(now + 0.07); } catch {} });
    },
  };
}
// a piece comes free: a short heavy chunk under the grind. Several in one frame are spread out a little (and
// capped), so a fast row never piles up into one loud crack.
export function snip() {
  if (!live()) return;
  const now = ctx.currentTime;
  if (now - lastSnip > 0.03) snipsNow = 0;
  if (snipsNow >= 3) return;
  const t = Math.max(now, lastSnip + 0.02);
  lastSnip = t; snipsNow++;
  noise(t, 0.06, { type: 'lowpass', f0: vary(800), f1: 380, q: 0.9, gain: 0.17 });
  noise(t, 0.025, { type: 'bandpass', f0: vary(1600), q: 1.4, gain: 0.08 });
  tone(t, vary(96, 0.06), 0.08, { gain: 0.13, attack: 0.002, f1: 58 });
}
// a piece lands in the box: a cardboard tok, louder and lower the harder it hit (k 0..1). Many in one moment are
// spread out a little and capped, so a hundred pieces falling in rattle like a real handful rather than roar.
let lastLand = 0, landsNow = 0;
export function land(k = 0.5) {
  if (!live()) return;
  const now = ctx.currentTime;
  if (now - lastLand > 0.03) landsNow = 0;
  if (landsNow >= 3) return;
  const t = Math.max(now, lastLand + 0.016);
  lastLand = t; landsNow++;
  const g = 0.3 + 0.7 * k;
  noise(t, 0.05 + 0.03 * k, { type: 'lowpass', f0: vary(1300, 0.15), f1: 480, q: 0.8, gain: 0.17 * g });
  tone(t, vary(165 - 40 * k, 0.12), 0.07 + 0.05 * k, { gain: 0.15 * g, attack: 0.002, f1: 80 });
  noise(t, 0.02, { type: 'bandpass', f0: vary(2400, 0.15), q: 1.2, gain: 0.05 * g });   // the card's edge
}
// the machine settles one row lower: a low, soft thock
export function step() {
  if (!live()) return;
  const t = ctx.currentTime;
  tone(t, 120, 0.11, { gain: 0.22, attack: 0.003, f1: 78 });
  noise(t, 0.06, { type: 'lowpass', f0: 520, f1: 300, q: 0.6, gain: 0.07 });
}
// the machine travelling: a quiet motor whir for `dur` seconds, rising when it goes down, falling when it goes up
export function move(dur, down = true) {
  if (!live()) return;
  const t = ctx.currentTime, d = Math.max(0.2, dur);
  noise(t, d, { type: 'bandpass', f0: down ? 520 : 900, f1: down ? 900 : 480, q: 3, gain: 0.05, attack: 0.08 });
  tone(t, down ? 92 : 118, d, { type: 'triangle', gain: 0.035, attack: 0.08, f1: down ? 118 : 88 });
}
// two pieces click together: a small wooden click
export function snap() {
  if (!live()) return;
  const t = ctx.currentTime;
  noise(t, 0.035, { type: 'bandpass', f0: vary(1900), f1: 1300, q: 2.5, gain: 0.2 });
  tone(t, vary(760, 0.05), 0.05, { type: 'triangle', gain: 0.06, f1: 520 });
}
// the last piece is in: a warm rising chord, in step with the light that sweeps across the finished puzzle
export function done() {
  if (!live()) return;
  const t = ctx.currentTime + 0.05;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(t + i * 0.09, f, 1.6 - i * 0.15, { gain: 0.11, attack: 0.006 });
    tone(t + i * 0.09, f * 2, 0.5, { gain: 0.025, attack: 0.004 });          // a little shine on top
  });
}
// Glue: a wide brush laying paint on, stroke after stroke back and forth across the puzzle for `dur` seconds,
// each stroke a soft swell of bristles over a wet low band, the last ones lighter as the brush runs dry
export function brush(dur) {
  if (!live()) return;
  const t0 = ctx.currentTime + 0.03, n = Math.max(3, Math.round(dur / 0.3)), each = dur / n;
  for (let i = 0; i < n; i++) {
    const t = t0 + i * each + (Math.random() - 0.5) * 0.04, d = each * 1.2, there = i % 2 === 0, k = 1 - 0.35 * i / n;
    noise(t, d, { type: 'bandpass', f0: vary(there ? 2000 : 3000), f1: vary(there ? 3000 : 2000), q: 0.6, gain: 0.1 * k, attack: d * 0.35 });
    noise(t, d, { type: 'lowpass', f0: 650, f1: 450, q: 0.5, gain: 0.05 * k, attack: d * 0.3 });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// cuelume, Press theme — MIT License, Copyright (c) 2026 Daniel Belyi, https://github.com/danielwh2/cuelume
// The cues below are its `type`, `count` and `navigate`, ported layer for layer from src/sounds/press.ts,
// src/sounds/layers.ts, src/sounds/context.ts and src/audio/render.ts at the "normal" emphasis (layers marked
// "strong" left out). One change of ours: count() holds its air at full for as long as the machine is rising.
const RING = (f, peak, more = {}) => ({ kind: 'noise', filterType: 'bandpass', filterFrequency: f, filterQ: 8, attack: 0.001, decay: 0.0055, peak, ...more });
const CLICK = (f, peak, more = {}) => [RING(f, peak, more), RING(f * 0.675, peak * 0.5, { filterQ: 2, ...more })];
const KNOCK = (f, decay, peak) => ({ kind: 'tone', waveform: 'sine', frequency: f * 1.6, glideTo: f, glideTime: 0.018, attack: 0.001, decay, peak });
const AIR = (f0, f1, decay, peak, more = {}) => ({ kind: 'noise', filterType: 'bandpass', filterFrequency: f0, glideTo: f1, glideTime: decay, filterQ: 1.5, attack: 0.008, decay, peak, ...more });
const CUE = {
  type: { masterGain: 0.297, layers: [...CLICK(4200, 0.25), KNOCK(305, 0.0288, 0.04)],
    release: [RING(4100, 0.08), RING(1000, 0.06, { filterQ: 2 }), KNOCK(414, 0.0216, 0.012)], vary: { pitch: 0.08, level: 0.15 } },
  navigate: { masterGain: 0.837, layers: [...CLICK(4800, 0.15), AIR(600, 1400, 0.0877, 0.12, { filterQ: 1 }), KNOCK(587.33, 0.0207, 0.015)], vary: { pitch: 0, level: 0.08 } },
  count: { masterGain: 0.362, vary: { pitch: 0.02, level: 0.1 }, layers: [
    { stretch: true, kind: 'noise', filterType: 'bandpass', filterFrequency: 900, glideTo: 1800, glideTime: 0.6, filterQ: 2, attack: 0.15, decay: 0.568, peak: 0.08 },
    { stretch: true, kind: 'noise', filterType: 'lowpass', filterFrequency: 200, glideTo: 500, glideTime: 0.6, filterQ: 0.7, attack: 0.15, decay: 0.594, peak: 0.06 },
    { stretch: true, kind: 'noise', filterType: 'bandpass', filterFrequency: 2600, glideTo: 3600, glideTime: 0.6, filterQ: 4, attack: 0.15, decay: 0.587, peak: 0.02 },
  ] },
};
const OUTPUT_GAIN = 5.8, BRIGHT_HZ = 2500, RELEASE_GAP = 0.09;
let cueOut = null, lastType = 0;
const nudge = (a) => 1 + (Math.random() * 2 - 1) * a;
function cueBus() {
  if (cueOut) return cueOut;
  cueOut = ctx.createGain(); cueOut.gain.value = OUTPUT_GAIN;
  const sub = ctx.createBiquadFilter(); sub.type = 'highpass'; sub.frequency.value = 20;
  cueOut.connect(sub); sub.connect(ctx.destination);
  return cueOut;
}
// shape: { level, length, bright, tail, time } as cuelume's context.ts makes it; hold = our sustain at the peak
function playCue(name, part, shape = {}, hold = 0, glideFor) {
  if (!live()) return;
  const r = CUE[name], s = { level: 1, length: 1, bright: 1, tail: 1, time: 1, ...shape };
  const strike = { pitch: nudge(r.vary.pitch), force: nudge(r.vary.level) };
  const parts = part === 'release' ? [[r.release, 0]] : part === 'both' ? [[r.layers, 0], [r.release || [], RELEASE_GAP]] : [[r.layers, 0]];
  const master = ctx.createGain(); master.gain.value = r.masterGain; master.connect(cueBus());
  const now = ctx.currentTime;
  for (const [layers, delay] of parts) for (const L of layers) {
    const f = L.kind === 'tone' ? L.frequency : L.filterFrequency;
    const gain = Math.min(1.5, s.level * (f >= BRIGHT_HZ ? s.bright : 1) * (delay > 0 ? s.tail : 1));
    const tune = L.kind === 'tone' ? nudge(0.005) : strike.force, pitch = strike.pitch * tune;
    const st = L.stretch ? s.time : 1;
    const attack = L.attack * st, decay = L.decay * Math.min(1.6, Math.max(0.6, s.length)) * st * nudge(0.1), peak = L.peak * gain * strike.force;
    const t = now + delay, h = L.stretch ? hold : 0, end = t + attack + h + decay + 0.05;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + attack);
    if (h > 0) g.gain.setValueAtTime(peak, t + attack + h);
    g.gain.setTargetAtTime(0, t + attack + h, decay / (3 * Math.LN10));
    let src, param;
    if (L.kind === 'tone') { src = ctx.createOscillator(); src.type = L.waveform; param = src.frequency; src.connect(g); }
    else {
      src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = L.filterType; if (L.filterQ !== undefined) fl.Q.value = L.filterQ;
      param = fl.frequency; src.connect(fl); fl.connect(g);
    }
    param.setValueAtTime(f * pitch, t);
    if (L.glideTo) param.exponentialRampToValueAtTime(L.glideTo * pitch, t + (L.stretch && glideFor ? glideFor : (L.glideTime ?? L.attack + L.decay) * st));
    g.connect(master);
    if (L.kind === 'tone') src.start(t); else src.start(t, Math.random() * 0.9);
    src.stop(end);
  }
}
// a button pressed and let go: cuelume's keycap. Quick presses come out softer and shorter, as in cuelume.
export function keyDown() {
  const since = (performance.now() - lastType); lastType = performance.now();
  const speed = Math.min(1, Math.max(0, (220 - since) / 150));
  playCue('type', 'press', { level: 1 - 0.22 * speed, length: 1 - 0.25 * speed, bright: 1 - 0.2 * speed, tail: 1 - 0.8 * speed });
}
export function keyUp() { playCue('type', 'release'); }
// the machine going back up: cuelume's count, air rising for the whole climb and held at full until the machine
// has cleared the print (the user wanted it to last that long), then its own tail
export function rise(dur) {
  const d = Math.max(0.3, Math.min(2, dur)), time = d / 0.8;
  playCue('count', 'press', { time }, Math.max(0, d - 0.15 * time), d);
}
// Send: cuelume's navigate, a light click with air sliding past it, the puzzle going on its way
export function send() { playCue('navigate', 'press'); }

// paper sliding on paper: the print going into the envelope, or the envelope slipping off it
export function paper(dur = 0.5) {
  if (!live()) return;
  const t = ctx.currentTime;
  noise(t, dur, { type: 'bandpass', f0: vary(1700), f1: vary(3000), q: 0.7, gain: 0.08, attack: dur * 0.4 });
  noise(t, dur * 0.8, { type: 'lowpass', f0: 900, f1: 600, q: 0.5, gain: 0.04, attack: dur * 0.3 });
}
// the glassine blowing away like sand: a dry, grainy hiss that swells and thins out with the wind
export function sand(dur = 1) {
  if (!live()) return;
  const t = ctx.currentTime, d = Math.max(0.3, dur);
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
  f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(5200, t + d);
  const grain = ctx.createGain(), curve = new Float32Array(Math.max(8, Math.round(d * 60)));
  for (let i = 0; i < curve.length; i++) curve[i] = 0.35 + Math.random() * 0.65;
  grain.gain.setValueCurveAtTime(curve, t, d);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + d * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2);
  n.connect(f); f.connect(grain); grain.connect(g); g.connect(out);
  n.start(t, Math.random() * 0.5); n.stop(t + d + 0.25);
}
// the card turns over: a paper swish, then the light tap of it landing
export function flip(toBack = true) {
  if (!live()) return;
  const t = ctx.currentTime;
  noise(t, 0.2, { type: 'bandpass', f0: toBack ? 2600 : 900, f1: toBack ? 800 : 2400, q: 1.1, gain: 0.13, attack: 0.03 });
  noise(t + 0.2, 0.05, { type: 'lowpass', f0: 1400, f1: 700, q: 0.7, gain: 0.08 });
}
