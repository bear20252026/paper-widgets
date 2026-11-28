// Lamborghini FL3 Procedural Audio Engine
// Real-time synthesis of 3-cylinder air-cooled diesel sounds via Web Audio API

export class FL3AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Continuous sound nodes
    this.blowerNoiseNode = null;
    this.blowerToneNode = null;
    this.blowerGain = null;
    this.blowerToneGain = null;
    this.blowerFilter = null;

    this.valveWhirrNode = null;
    this.valveGain = null;

    this.starterWhineNode = null;
    this.starterGain = null;

    // Time scaling (for slow motion)
    this.timeScale = 1.0;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();

      // Master Dynamics Compressor prevents clipping
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.65, this.ctx.currentTime);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      this.setupContinuousLayers();
      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio initialization error:', e);
    }
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  setupContinuousLayers() {
    if (!this.ctx) return;

    // 1. Procedural noise buffer for cooling blower air roar
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + white * 0.05;
      b1 = 0.95 * b1 + white * 0.1;
      b2 = 0.85 * b2 + white * 0.2;
      output[i] = (b0 + b1 + b2) * 0.35;
    }

    this.blowerNoiseNode = this.ctx.createBufferSource();
    this.blowerNoiseNode.buffer = noiseBuffer;
    this.blowerNoiseNode.loop = true;

    this.blowerFilter = this.ctx.createBiquadFilter();
    this.blowerFilter.type = 'bandpass';
    this.blowerFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
    this.blowerFilter.Q.setValueAtTime(2.2, this.ctx.currentTime);

    this.blowerGain = this.ctx.createGain();
    this.blowerGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.blowerNoiseNode.connect(this.blowerFilter);
    this.blowerFilter.connect(this.blowerGain);
    this.blowerGain.connect(this.masterGain);
    this.blowerNoiseNode.start();

    // 2. Blower blade-pass whistle / howl (12 blades on axial impeller)
    this.blowerToneNode = this.ctx.createOscillator();
    this.blowerToneNode.type = 'sine';
    this.blowerToneNode.frequency.setValueAtTime(120, this.ctx.currentTime);

    this.blowerToneGain = this.ctx.createGain();
    this.blowerToneGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.blowerToneNode.connect(this.blowerToneGain);
    this.blowerToneGain.connect(this.masterGain);
    this.blowerToneNode.start();

    // 3. Starter motor whine (electric DC motor gear whine)
    this.starterWhineNode = this.ctx.createOscillator();
    this.starterWhineNode.type = 'sawtooth';
    this.starterWhineNode.frequency.setValueAtTime(140, this.ctx.currentTime);

    const starterFilter = this.ctx.createBiquadFilter();
    starterFilter.type = 'lowpass';
    starterFilter.frequency.setValueAtTime(800, this.ctx.currentTime);

    this.starterGain = this.ctx.createGain();
    this.starterGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.starterWhineNode.connect(starterFilter);
    starterFilter.connect(this.starterGain);
    this.starterGain.connect(this.masterGain);
    this.starterWhineNode.start();

    // 4. Valve gear & injection pump drive whirr
    this.valveWhirrNode = this.ctx.createOscillator();
    this.valveWhirrNode.type = 'triangle';
    this.valveWhirrNode.frequency.setValueAtTime(45, this.ctx.currentTime);

    this.valveGain = this.ctx.createGain();
    this.valveGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.valveWhirrNode.connect(this.valveGain);
    this.valveGain.connect(this.masterGain);
    this.valveWhirrNode.start();
  }

  // Update continuous tones matching engine speed & load
  updateContinuous(rpm, keyState, ptoLoad) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const speedRatio = Math.max(0, rpm / 2200);

    // Blower roar
    if (this.blowerGain && this.blowerFilter && this.blowerToneNode) {
      if (rpm > 20) {
        const blowerVolume = Math.min(0.4, 0.05 + 0.35 * Math.pow(speedRatio, 1.8));
        this.blowerGain.gain.setTargetAtTime(blowerVolume, now, 0.05);

        const filterFreq = 200 + speedRatio * 1100;
        this.blowerFilter.frequency.setTargetAtTime(filterFreq, now, 0.05);

        // Blade-pass frequency: 12 blades * (rpm * blower_ratio / 60)
        // Blower geared 1.4x crank
        const bladePassFreq = Math.max(20, (rpm * 1.4 * 12) / 60) * this.timeScale;
        this.blowerToneNode.frequency.setTargetAtTime(bladePassFreq, now, 0.05);

        const toneVol = Math.min(0.12, 0.02 + 0.1 * speedRatio);
        this.blowerToneGain.gain.setTargetAtTime(toneVol, now, 0.05);
      } else {
        this.blowerGain.gain.setTargetAtTime(0, now, 0.08);
        this.blowerToneGain.gain.setTargetAtTime(0, now, 0.08);
      }
    }

    // Starter motor whine while cranking
    if (this.starterGain && this.starterWhineNode) {
      if (keyState === 'cranking') {
        this.starterGain.gain.setTargetAtTime(0.22, now, 0.03);
        const starterPitch = (120 + (rpm / 250) * 80) * this.timeScale;
        this.starterWhineNode.frequency.setTargetAtTime(starterPitch, now, 0.03);
      } else {
        this.starterGain.gain.setTargetAtTime(0, now, 0.05);
      }
    }

    // Valve gear ticking
    if (this.valveGain && this.valveWhirrNode) {
      if (rpm > 80) {
        const camFreq = Math.max(10, (rpm / 120) * 6) * this.timeScale;
        this.valveWhirrNode.frequency.setTargetAtTime(camFreq, now, 0.04);
        const vVol = Math.min(0.08, 0.02 + 0.06 * speedRatio);
        this.valveGain.gain.setTargetAtTime(vVol, now, 0.05);
      } else {
        this.valveGain.gain.setTargetAtTime(0, now, 0.08);
      }
    }
  }

  // Starter strains on each compression pulse while cranking
  triggerStarterStrain(cylinder) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Pitch dip on compression
    if (this.starterWhineNode) {
      const curFreq = this.starterWhineNode.frequency.value;
      this.starterWhineNode.frequency.setValueAtTime(curFreq * 0.72, now);
      this.starterWhineNode.frequency.exponentialRampToValueAtTime(curFreq, now + 0.08 / this.timeScale);
    }

    // Low-frequency strain grunt
    const strainOsc = this.ctx.createOscillator();
    const strainGain = this.ctx.createGain();
    strainOsc.type = 'sawtooth';
    strainOsc.frequency.setValueAtTime(55 * this.timeScale, now);
    strainGain.gain.setValueAtTime(0.18, now);
    strainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09 / this.timeScale);

    strainOsc.connect(strainGain);
    strainGain.connect(this.masterGain);
    strainOsc.start(now);
    strainOsc.stop(now + 0.1);
  }

  // Synthesise individual exhaust pulse (from EVO event)
  triggerExhaustPop(cylinder, pressure, rpm) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const pressRatio = Math.max(0.2, Math.min(1.0, pressure / 70));

    // Base fundamental for exhaust pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const baseFreq = (45 + 25 * pressRatio) * this.timeScale;
    osc.frequency.setValueAtTime(baseFreq * 1.8, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 0.05 / this.timeScale);

    const dur = (0.08 + 0.04 * pressRatio) / this.timeScale;
    const amp = Math.min(0.45, 0.18 + 0.25 * pressRatio);
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + dur + 0.01);

    // Flapper cap clink at low idle speed
    if (rpm < 1100 && Math.random() < 0.85) {
      this.triggerFlapperClink(now + 0.02 / this.timeScale);
    }
  }

  // Diesel direct-injection knock (high-pressure combustion pressure rise)
  triggerDieselKnock(cylinder, pressure, fuelRack) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const knockOsc = this.ctx.createOscillator();
    const knockGain = this.ctx.createGain();

    knockOsc.type = 'sawtooth';
    const knockPitch = (280 + Math.random() * 60) * this.timeScale;
    knockOsc.frequency.setValueAtTime(knockPitch, now);
    knockOsc.frequency.exponentialRampToValueAtTime(110 * this.timeScale, now + 0.025 / this.timeScale);

    const knockAmp = Math.min(0.22, (0.06 + 0.16 * fuelRack));
    knockGain.gain.setValueAtTime(knockAmp, now);
    knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028 / this.timeScale);

    const blockRes = this.ctx.createBiquadFilter();
    blockRes.type = 'bandpass';
    blockRes.frequency.setValueAtTime(1150 * this.timeScale, now);
    blockRes.Q.setValueAtTime(3.5, now);

    knockOsc.connect(blockRes);
    blockRes.connect(knockGain);
    knockGain.connect(this.masterGain);

    knockOsc.start(now);
    knockOsc.stop(now + 0.035 / this.timeScale);
  }

  // Rain cap flapper metallic tick
  triggerFlapperClink(time) {
    if (!this.ctx || this.isMuted) return;
    const t = time || this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400 * this.timeScale, t);
    osc.frequency.exponentialRampToValueAtTime(1800 * this.timeScale, t + 0.015);

    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.02);
  }

  // Solenoid heavy mechanical clunk on starter engagement/disengagement
  triggerSolenoidClunk(isEngage = true) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isEngage ? 95 : 120, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.06);

    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Exploded view separation metallic slide and seating clunk
  triggerExplodeCue(isExploding = true) {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    if (isExploding) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.25);
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
      g.gain.setValueAtTime(0.32, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    }

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}
