/**
 * Zero-asset procedural spatial Web Audio soundscape for off-piste freeride skiing (Wave 4):
 *  - High-altitude wind rush + jacket flutter scaled by speed & altitude
 *  - Stereo L/R panned edge-pressure carving bed (Cold Powder / Wind Pack / Blue Ice / Granite)
 *  - INSTANT AIRBORNE SILENCE DROP the instant skis leave snow!
 *  - Crisp metallic-carbon binding flex click layered into `playPop()`
 *  - High-altitude cardio breathing when pausing after an intense pitch (`state.breathing`)
 *  - Distant echoing glacier creak & serac crack groans when quiet above 2,800 m
 *  - Chest-thumping sub-bass Slab Avalanche roar & fracture BOOM (`playAvalancheCrack`)
 */
export class SkiAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.muted = false;
    this.volume = 1.0;
    this.master = null;
    this.noiseBuf = null;
    this.nodes = {};
    this._nextCreakTime = 12.0;
    this._breathPhase = 0.0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);

    // Pre-generate 3 seconds of smooth pink/white noise buffer
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      ch[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.16) * 1.4));
    }
    this.noiseBuf = buf;

    const mkLoop = (filterType, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const flt = ctx.createBiquadFilter();
      flt.type = filterType;
      flt.frequency.value = freq;
      flt.Q.value = q;
      const pan = ctx.createStereoPanner();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(flt);
      flt.connect(pan);
      pan.connect(gain);
      gain.connect(this.master);
      src.start();
      return { src, flt, pan, gain };
    };

    // High-altitude ridge wind + airspeed rush
    this.nodes.wind = mkLoop('bandpass', 260, 0.9);
    this.nodes.windHi = mkLoop('highpass', 1400, 0.7);
    // Soft plush cold powder whoosh
    this.nodes.powder = mkLoop('lowpass', 620, 0.7);
    // Crisp ski-edge carving hiss
    this.nodes.carve = mkLoop('bandpass', 1850, 1.4);
    // Hard blue-ice metallic chatter
    this.nodes.ice = mkLoop('bandpass', 3600, 3.8);
    // Distant alpine sluff hiss
    this.nodes.sluff = mkLoop('bandpass', 920, 0.8);
    // High-altitude cardio breathing loop (filtered warm inhale/exhale)
    this.nodes.breath = mkLoop('bandpass', 720, 1.8);
    // Deep slab avalanche sub-rumble + rolling boulder/snow roar
    this.nodes.avySub = mkLoop('lowpass', 115, 1.1);
    this.nodes.avyMid = mkLoop('bandpass', 380, 0.75);
    // hardshell jacket nylon spray pattering hiss during deep powder face-shots!
    this.nodes.jacketSpray = mkLoop('bandpass', 2400, 1.1);
  }

  unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.enabled = true;
    if (!this.muted && this.master) {
      this.master.gain.setTargetAtTime(0.68 * this.volume, this.ctx.currentTime, 0.15);
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, Number(vol) || 0));
    if (this.volume === 0) {
      this.muted = true;
    } else if (this.muted && this.volume > 0) {
      this.muted = false;
    }
    if (this.ctx && this.master) {
      if (this.ctx.state === 'suspended' && this.volume > 0) this.ctx.resume().catch(() => {});
      this.master.gain.setTargetAtTime(this.muted ? 0.0 : 0.68 * this.volume, this.ctx.currentTime, 0.06);
    }
  }

  toggleMute() {
    this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.enabled = true;
    this.muted = !this.muted;
    if (!this.muted && this.volume <= 0.01) this.volume = 0.75;
    this.master.gain.setTargetAtTime(this.muted ? 0.0 : 0.68 * this.volume, this.ctx.currentTime, 0.1);
    return !this.muted;
  }

  playImpact(strength = 0.6, isPowder = true, isCrash = false) {
    if (!this.ctx || !this.enabled || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isCrash ? 95 : (isPowder ? 76 : 118), now);
    osc.frequency.exponentialRampToValueAtTime(28, now + (isCrash ? 0.38 : 0.22));
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.65, 0.18 + strength * 0.35), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (isCrash ? 0.42 : 0.25));
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.45);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = isPowder ? 'lowpass' : 'bandpass';
    flt.frequency.value = isPowder ? 950 : 2100;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(Math.min(0.55, 0.14 + strength * 0.32), now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + (isCrash ? 0.85 : 0.42));
    src.connect(flt); flt.connect(ng); ng.connect(this.master);
    src.start(now, Math.random() * 1.5, 0.9);
  }

  playPop(charge = 0.5) {
    if (!this.ctx || !this.enabled || this.muted) return;
    const now = this.ctx.currentTime;
    // Snow tail release snap
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(650, now);
    flt.frequency.exponentialRampToValueAtTime(1900, now + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14 + charge * 0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(now, Math.random(), 0.2);

    // Crisp metallic/carbon tech-binding flex click!
    const click = this.ctx.createOscillator();
    click.type = 'triangle';
    click.frequency.setValueAtTime(1950 + charge * 550, now);
    click.frequency.exponentialRampToValueAtTime(420, now + 0.038);
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.11 + charge * 0.10, now);
    cg.gain.exponentialRampToValueAtTime(0.0008, now + 0.042);
    click.connect(cg); cg.connect(this.master);
    click.start(now); click.stop(now + 0.048);
  }

  playAvalancheCrack() {
    if (!this.ctx || !this.enabled || this.muted) return;
    const now = this.ctx.currentTime;
    // Authentic hollow "WHUMPF!" snowpack weak-layer collapse booming across the massif
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(64, now);
    sub.frequency.exponentialRampToValueAtTime(22, now + 0.95);
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0.75, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
    sub.connect(sg); sg.connect(this.master);
    sub.start(now); sub.stop(now + 1.2);

    // High-energy fracture crack echoing down valley
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(280, now);
    flt.Q.value = 0.6;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.55, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    src.connect(flt); flt.connect(ng); ng.connect(this.master);
    src.start(now, 0.2, 1.5);
  }

  /** Crisp stereo-panned carbon pole-plant snow punch & ski-basket click! */
  playPolePlant(side = 1, strength = 0.7, isPowder = true) {
    if (!this.ctx || !this.enabled || this.muted) return;
    const now = this.ctx.currentTime;
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.75, Math.min(0.75, side * 0.56));
    pan.connect(this.master);

    // Muffled snow-basket punch / crunch
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(isPowder ? 720 : 1650, now);
    flt.frequency.exponentialRampToValueAtTime(isPowder ? 260 : 620, now + 0.085);
    flt.Q.value = isPowder ? 1.0 : 2.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.32, 0.09 + strength * 0.14), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    src.connect(flt); flt.connect(g); g.connect(pan);
    src.start(now, Math.random() * 1.8, 0.12);

    // Subtle crisp carbon shaft / tungsten carbide tip click
    const tap = this.ctx.createOscillator();
    tap.type = 'triangle';
    tap.frequency.setValueAtTime(isPowder ? 640 : 1480, now);
    tap.frequency.exponentialRampToValueAtTime(140, now + 0.030);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.04 + strength * (isPowder ? 0.045 : 0.09), now);
    tg.gain.exponentialRampToValueAtTime(0.0008, now + 0.034);
    tap.connect(tg); tg.connect(pan);
    tap.start(now); tap.stop(now + 0.04);
  }

  /** Stereo Doppler whistling wind-buffet WHOOSH when whipping past a close Norway spruce at speed! */
  playTreeWhoosh(panSide = 0.7, closeness = 0.7, speedMs = 18.0) {
    if (!this.ctx || !this.enabled || this.muted) return;
    const now = this.ctx.currentTime;
    const spFactor = Math.min(1.5, Math.max(0.35, speedMs / 20.0));
    const dur = Math.max(0.18, Math.min(0.46, 0.44 - spFactor * 0.16));

    const pan = this.ctx.createStereoPanner();
    pan.pan.setValueAtTime(Math.max(-0.92, Math.min(0.92, panSide * 0.85)), now);
    pan.pan.linearRampToValueAtTime(Math.max(-0.92, Math.min(0.92, panSide * 0.35)), now + dur);
    pan.connect(this.master);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    // Classic Doppler downward pitch sweep as evergreen boughs whip past helmet!
    const peakF = 760 + spFactor * 640;
    flt.frequency.setValueAtTime(peakF, now);
    flt.frequency.exponentialRampToValueAtTime(195, now + dur);
    flt.Q.value = 1.65;

    const g = this.ctx.createGain();
    const peakGain = Math.min(0.42, (0.09 + closeness * 0.26) * spFactor);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(peakGain, now + dur * 0.28);
    g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    src.connect(flt); flt.connect(g); g.connect(pan);
    src.start(now, Math.random() * 1.5, dur + 0.04);
  }

  /** Subtle cold plastic ski-boot shell creak when flexing knees while stationary! */
  playBootCreak(strength = 0.5) {
    if (!this.ctx || !this.enabled || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(155 + Math.random() * 40, now);
    osc.frequency.linearRampToValueAtTime(118 + Math.random() * 25, now + 0.14);
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 460;
    flt.Q.value = 6.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0008, now);
    g.gain.linearRampToValueAtTime(0.032 * Math.min(1, strength), now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0006, now + 0.16);
    osc.connect(flt); flt.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.18);
  }

  _playGlacierCreak() {
    if (!this.ctx || !this.enabled || this.muted) return;
    const now = this.ctx.currentTime;
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 1.4;
    pan.connect(this.master);

    // Deep echoing tectonic ice groan + hollow crystal fracture
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const baseF = 48 + Math.random() * 44;
    osc.frequency.setValueAtTime(baseF, now);
    osc.frequency.exponentialRampToValueAtTime(baseF * 0.52, now + 1.45);
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 210 + Math.random() * 240;
    flt.Q.value = 4.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.085, now + 0.14);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 1.75);
    osc.connect(flt); flt.connect(g); g.connect(pan);
    osc.start(now); osc.stop(now + 1.85);
  }

  update(state, preset, avy = null, dt = 0.016) {
    if (!this.ctx || !this.enabled || this.muted) return;
    const now = this.ctx.currentTime;
    const spd = state.speed;
    const kmh = spd * 3.6;
    const storm = preset.id === 'storm' ? 1.0 : 0.0;
    const altWind = Math.max(0.08, Math.min(0.45, (state.y - 1600) / 3600)) + storm * 0.35;

    // 1. High-altitude wind & airspeed rushing past helmet!
    const airRatio = Math.min(1.0, kmh / 105.0);
    const airGain = (0.04 + altWind * 0.12 + airRatio * airRatio * 0.42) * (state.grounded ? 1.0 : 1.32);
    this.nodes.wind.flt.frequency.setTargetAtTime(180 + airRatio * 720 + (state.grounded ? 0 : 160), now, 0.08);
    this.nodes.wind.gain.gain.setTargetAtTime(airGain, now, 0.08);
    this.nodes.windHi.gain.gain.setTargetAtTime(airRatio * airRatio * (state.grounded ? 0.06 : 0.15) + storm * 0.05, now, 0.08);

    // 2. INSTANT SILENCE WHEN AIRBORNE! Only snow-contact sounds play while grounded
    const slip = Math.abs(Math.sin(state.slipAngle));
    const sideSlip = state.sideslip || 0;
    const wash = state.washOut || 0;
    const edge = Math.min(1.0, Math.abs(state.edgeAngle));
    const panSide = Math.max(-0.78, Math.min(0.78, -state.edgeAngle * 0.78));
    const surf = state.surface.id;
    const moveFactor = state.grounded && !state.crashed ? Math.min(1.0, spd / 15.0) : 0.0;
    const carveEnergy = moveFactor * (0.24 + slip * 1.15 + sideSlip * 0.72 + edge * 0.42);

    const powGain = surf === 'powder' ? carveEnergy * 0.44 : (surf === 'packed' || surf === 'corn' ? carveEnergy * 0.14 : 0.0001);
    const crvGain = (surf === 'packed' || surf === 'corn' || surf === 'crust') ? carveEnergy * 0.34 : (surf === 'powder' ? carveEnergy * 0.12 : carveEnergy * 0.20);
    const iceGain = (surf === 'ice' || surf === 'granite') ? (carveEnergy * 0.40 + wash * 0.24) : (surf === 'crust' ? (carveEnergy * 0.15 + wash * 0.18) : (wash * 0.14));

    const tc = state.grounded ? 0.05 : 0.025;
    this.nodes.powder.gain.gain.setTargetAtTime(Math.max(0.0001, powGain), now, tc);
    this.nodes.powder.flt.frequency.setTargetAtTime(380 + moveFactor * 520 + slip * 300, now, 0.06);
    this.nodes.powder.pan.pan.setTargetAtTime(panSide, now, 0.05);

    this.nodes.carve.gain.gain.setTargetAtTime(Math.max(0.0001, crvGain), now, tc);
    this.nodes.carve.flt.frequency.setTargetAtTime(1400 + kmh * 16 + slip * 700, now, 0.06);
    this.nodes.carve.pan.pan.setTargetAtTime(panSide, now, 0.05);

    this.nodes.ice.gain.gain.setTargetAtTime(Math.max(0.0001, iceGain), now, tc);
    this.nodes.ice.flt.frequency.setTargetAtTime(surf === 'granite' ? 2400 : 3400 + kmh * 14, now, 0.05);
    this.nodes.ice.pan.pan.setTargetAtTime(panSide, now, 0.05);

    this.nodes.sluff.gain.gain.setTargetAtTime(Math.max(0.0001, state.sluffTrigger * 0.14), now, 0.25);

    // 3. Heavy high-altitude cardio breathing when slowing/pausing after a charge!
    this._breathPhase += dt * (2.2 + state.breathing * 1.4);
    const slowFade = Math.max(0, 1.0 - kmh / 18.0);
    const brActive = state.breathing > 0.15 ? (state.breathing - 0.15) * slowFade : 0;
    const cycle = Math.sin(this._breathPhase);
    const breathEnv = Math.pow(Math.abs(cycle), 1.6);
    const breathFreq = cycle > 0 ? 820 : 520; // inhale slightly higher than warm exhale!
    this.nodes.breath.flt.frequency.setTargetAtTime(breathFreq, now, 0.08);
    this.nodes.breath.gain.gain.setTargetAtTime(Math.max(0.0001, brActive * breathEnv * 0.16), now, 0.08);

    // 4. Distant glacier creak / serac crack when quiet above 2,800 m!
    this._nextCreakTime -= dt;
    if (this._nextCreakTime <= 0) {
      if (state.y > 2750 && kmh < 22 && (!avy || !avy.active)) {
        this._playGlacierCreak();
      }
      this._nextCreakTime = 11.0 + Math.random() * 14.0;
    }

    // 5. Deep chest-thumping Slab Avalanche roar!
    const avyProx = (avy && avy.active) ? avy.proximity : 0.0;
    this.nodes.avySub.gain.gain.setTargetAtTime(Math.max(0.0001, avyProx * 0.62), now, 0.16);
    this.nodes.avyMid.gain.gain.setTargetAtTime(Math.max(0.0001, avyProx * 0.36), now, 0.16);
    this.nodes.avyMid.flt.frequency.setTargetAtTime(260 + avyProx * 380, now, 0.16);

    // 6. hardshell jacket shell spray patter during deep powder face-shots & bow-wave wash!
    const sprayHit = Math.max(state.faceShotIntensity || 0, (state.bowWave || 0) * 0.55);
    this.nodes.jacketSpray.gain.gain.setTargetAtTime(Math.max(0.0001, sprayHit * 0.19), now, 0.06);
    this.nodes.jacketSpray.flt.frequency.setTargetAtTime(1950 + sprayHit * 1350, now, 0.06);
  }
}
