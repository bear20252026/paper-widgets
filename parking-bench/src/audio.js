/**
 * src/audio.js — Dual-Bus -1.0 dBTP Lookahead Physical Collector Foley & Lyria 3.5 Lo-Fi Chillhop Engine
 * Project: Parking Bench — 1:64 Die-Cast Kitchen Tabletop Edition (hydrogen-parking-bench)
 *
 * Built atop `./kits/dual_bus_audio.js` (`DualBusAudioEngine`, Elite CT Brain v2.7):
 *   - Independent `musicBus` playing a seamless Lyria 3.5 sunlit cafe lo-fi chillhop loop
 *     (`LOFI_CHILL_MP3_BASE64`, permanently locked at `playbackRate = 1.000`, zero vinyl static/hiss)
 *   - Independent `sfxBus` fed through 3-Tap Kitchen Room Early Reflections (`3.4ms`, `7.9ms`, `13.2ms`
 *     with 1.8 kHz–3.2 kHz warm plaster/oak damping at ~14% wet mix)
 *   - Master `-1.0 dBTP` brickwall limiter (`threshold = -1.0 dB`, `knee = 0`, `ratio = 20:1`) routed
 *     eagerly at Frame 0 to `ctx.destination`, `window.__audioStreamDestination`, and `AnalyserNode`
 *   - `72ms` (`0.072s`) lookahead scheduling on `AudioContext.currentTime` with click-free `>= 0.0001` ramps
 *   - Strictly `0.0` rolling noise gain at `speed === 0` (zero idle background static)
 */

import { bus, state, DEMO_EVENTS, GRID_SPEC, BOARD_PHYSICS } from "./contract.js";
import { DualBusAudioEngine } from "./kits/dual_bus_audio.js";
import { ensureTelemetry } from "./kits/world_cohesion_agx.js";
import { fetchLofiChillMp3Buffer } from "./assets/lofiMusicTrack.js";

const ENV_FLOOR = 0.0001;
const SFX_BUS_GAIN = 0.74;
const LOFI_MUSIC_BUS_GAIN = 0.24; // Cozy sunlit cafe lo-fi chillhop bed underneath physical Foley
const LOOKAHEAD_SEC = 0.072;      // 72ms lookahead within strict 65-80ms v2.7 window
const MAX_TRANSIENT_VOICES = 36;

export class CourtyardAudio {
  constructor() {
    this.lookaheadSec = LOOKAHEAD_SEC;
    this.engine = new DualBusAudioEngine({ lookaheadSec: LOOKAHEAD_SEC });
    this.engine.lookaheadSec = LOOKAHEAD_SEC;
    this.engine.lookaheadTime = (leadSec = this.lookaheadSec) => {
      const ctx = this.ctx || this.engine.init();
      if (!ctx) return 0;
      const clampedLead = Math.max(0.012, Number.isFinite(leadSec) ? leadSec : this.lookaheadSec);
      return ctx.currentTime + clampedLead;
    };

    this.ctx = null;
    this.dcBlocker = null;
    this.sfxDryGain = null;
    this.erWetGain = null;
    this.erTaps = [];
    this.analyser = null;

    this.pinkNoiseBuffer = null;
    this.lofiBuffer = null;
    this.lofiMusicLoaded = false;
    this.lofiMusicStarted = false;
    this._lofiFadeInDone = false;
    this._lofiDecodePromise = null;

    // Pre-allocated zero-GC buffers for real-time AnalyserNode diagnostics
    this._floatTimeDomain = null;
    this._byteTimeDomain = null;

    // Surface-split continuous rolling DSP nodes (Slate vs White-Oak crossfade)
    this._rollingReady = false;
    this.slateSource = null;
    this.slateBandpass = null;
    this.slateLowpass = null;
    this.slateGain = null;

    this.axleSource = null;
    this.axleBandpassA = null;
    this.axleBandpassB = null;
    this.axleGain = null;

    this.oakSource = null;
    this.oakMode185 = null;
    this.oakMode410 = null;
    this.oakMode860 = null;
    this.oakGain = null;

    this.smoothedSpeed = 0;
    this.smoothedSlateGain = 0;
    this.smoothedAxleGain = 0;
    this.smoothedOakGain = 0;
    this._currentOakMix = 0;
    this._rollCellAccum = 0;
    this._cellTickCooldown = 0;

    // Cooldowns (virtual-clock seconds) & polyphony accounting
    this.bumpCooldown = 0;
    this.detentCooldown = 0;
    this.scrubCooldown = 0;
    this.cardFlipCooldown = 0;
    this.activeVoices = 0;

    this.enabled = Boolean(state.audioEnabled);
    this._hasUserActivation = Boolean(
      typeof window !== "undefined" && (window.__forceAudioUnlock || window.__virtualClock)
    );
    this.cueLog = [];

    const tel = ensureTelemetry();
    tel.musicPlaybackRate = 1.0;
    tel.limiterThresholdDb = -1.0;
    tel.audioLookaheadSec = LOOKAHEAD_SEC;
    tel.dualBusActive = true;

    if (typeof window !== "undefined") {
      window.__audioCueLog = this.cueLog;
      window.__audioAnalyser = null;
      window.__unlockAudio = () => {
        this.forceUnlock();
        return window.__audioStreamDestination;
      };
      window.__getAudioDiagnostics = () => this.getDiagnostics();
      window.__audioDiagnostics = () => this.getDiagnostics();

      // Eagerly construct AudioContext, Dual-Bus Limiter & MediaStreamDestination at Frame 0
      if (window.AudioContext || window.webkitAudioContext) {
        this._initGraph();
      } else if (!window.__audioStreamDestination) {
        window.__audioStreamDestination = {
          stream: typeof MediaStream !== "undefined" ? new MediaStream() : null,
          pendingGesture: true,
        };
      }
    }

    this._bindEvents();
  }

  /**
   * Clamps BiquadFilterNode cutoff frequency strictly to [36, min(16000, sampleRate * 0.44)]
   * so biquad poles remain unconditionally stable across 44.1 kHz, 48 kHz, and 96 kHz sample rates.
   */
  _clampFreq(freqHz) {
    const sr = Number(this.ctx?.sampleRate) || 48000;
    const nyquistSafeMax = Math.max(40, Math.min(16000, sr * 0.44));
    const f = Number(freqHz);
    if (!Number.isFinite(f)) return 440;
    return Math.max(36, Math.min(nyquistSafeMax, f));
  }

  /**
   * Clamps BiquadFilterNode Q strictly to [0.5, 9.5] to prevent self-oscillation or NaN blowups.
   */
  _clampQ(qVal) {
    const q = Number(qVal);
    if (!Number.isFinite(q)) return 0.7071;
    return Math.max(0.5, Math.min(9.5, q));
  }

  /**
   * Clamps OscillatorNode frequency safely within non-aliasing audible bounds.
   */
  _clampOscFreq(freqHz) {
    const sr = Number(this.ctx?.sampleRate) || 48000;
    const maxOsc = Math.max(40, Math.min(18000, sr * 0.45));
    const f = Number(freqHz);
    if (!Number.isFinite(f)) return 440;
    return Math.max(30, Math.min(maxOsc, f));
  }

  /**
   * Factory helper creating a pole-stable BiquadFilterNode with clamped frequency & Q.
   */
  _createFilter(type, freqHz, qVal = 0.7071, startTime = null) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    const t = startTime !== null ? startTime : this.ctx.currentTime;
    filter.frequency.setValueAtTime(this._clampFreq(freqHz), t);
    filter.Q.setValueAtTime(this._clampQ(qVal), t);
    return filter;
  }

  /**
   * Schedules a click-free ADSR transient envelope:
   *   - Starts strictly at ENV_FLOOR (0.0001, never 0 for exponential ramps)
   *   - >= 1.8ms linear attack to peakGain (zero step-discontinuity clicks)
   *   - Exponential decay to ENV_FLOOR
   *   - Final 3.5ms linear taper to exact 0.0 before node.stop()
   */
  _scheduleClickFreeDecay(gainParam, startTime, peakGain, attackSec, decayDurationSec) {
    const safeAttack = Math.max(0.0018, Number(attackSec) || 0.002);
    const safeTotal = Math.max(safeAttack + 0.005, Number(decayDurationSec) || 0.028);
    const safePeak = Math.max(ENV_FLOOR * 2.0, Math.min(0.95, Number(peakGain) || 0.05));
    const endTime = startTime + safeTotal;

    gainParam.setValueAtTime(ENV_FLOOR, startTime);
    gainParam.linearRampToValueAtTime(safePeak, startTime + safeAttack);
    gainParam.exponentialRampToValueAtTime(ENV_FLOOR, endTime);
    gainParam.linearRampToValueAtTime(0.0, endTime + 0.0035);
    return endTime + 0.005;
  }

  /**
   * Tracks active transient AudioScheduledSourceNodes and guards polyphonic headroom.
   */
  _trackVoice(sourceNode) {
    this.activeVoices += 1;
    let settled = false;
    sourceNode.onended = () => {
      if (settled) return;
      settled = true;
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    };
  }

  _voiceHeadroomScale() {
    if (this.activeVoices <= 10) return 1.0;
    return Math.max(0.42, 10 / this.activeVoices);
  }

  _voiceBus() {
    return this.dcBlocker || this.engine?.sfxBus || null;
  }

  _canResumeAudioContext() {
    if (this._hasUserActivation) return true;
    if (typeof window !== "undefined" && (window.__forceAudioUnlock || window.__virtualClock)) {
      this._hasUserActivation = true;
      return true;
    }
    if (
      typeof navigator !== "undefined" &&
      navigator.userActivation &&
      (navigator.userActivation.isActive || navigator.userActivation.hasBeenActive)
    ) {
      this._hasUserActivation = true;
      return true;
    }
    return false;
  }

  forceUnlock() {
    this._hasUserActivation = true;
    this.resume();
  }

  _bindEvents() {
    bus.addEventListener(DEMO_EVENTS.AUDIO_TOGGLED, (e) => {
      const next =
        e?.detail?.audioEnabled !== undefined
          ? Boolean(e.detail.audioEnabled)
          : Boolean(state.audioEnabled);
      if (next) {
        this._hasUserActivation = true;
      }
      this.setEnabled(next);
    });

    bus.addEventListener(DEMO_EVENTS.AUTOPLAY_TOGGLED, (e) => {
      if (e?.detail?.isAutoplay) {
        this.forceUnlock();
      }
    });

    bus.addEventListener(DEMO_EVENTS.RACE_START_REQUESTED, () => {
      this.forceUnlock();
    });

    bus.addEventListener(DEMO_EVENTS.RACE_RESTART_REQUESTED, () => {
      this.forceUnlock();
    });

    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      const unlock = (e) => {
        if (e && e.isTrusted === false && !window.__forceAudioUnlock) return;
        this._hasUserActivation = true;
        this.resume();
      };
      window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
      window.addEventListener("mousedown", unlock, { capture: true, passive: true });
      window.addEventListener("touchstart", unlock, { capture: true, passive: true });
      window.addEventListener("keydown", unlock, { capture: true, passive: true });
      window.addEventListener("click", unlock, { capture: true, passive: true });
    }
  }

  /**
   * Initializes DualBusAudioEngine (`musicBus` + `sfxBus` -> `-1.0 dBTP` brickwall limiter),
   * 3-Tap Kitchen Early Reflections (`3.4ms`, `7.9ms`, `13.2ms`), locked `1.000x` morning
   * room-air bed, and surface-split continuous tire/axle rolling subgraphs.
   */
  _initGraph() {
    if (typeof window === "undefined" || this.ctx) return;
    try {
      const ctx = this.engine.init();
      if (!ctx) return;
      this.ctx = ctx;
      const now = ctx.currentTime;

      // Configure Dual-Bus initial gain levels (music starts silent until decoded & unlocked; playbackRate strictly 1.000)
      this.engine.musicBus.gain.setValueAtTime(0.0, now);
      this.engine.sfxBus.gain.setValueAtTime(this.enabled ? SFX_BUS_GAIN : 0.0, now);

      // Post-limiter passive AnalyserNode tap for real-time RMS/peak diagnostics
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.78;
      this._floatTimeDomain = new Float32Array(this.analyser.fftSize);
      this._byteTimeDomain = new Uint8Array(this.analyser.fftSize);
      this.engine.limiter.connect(this.analyser);
      window.__audioAnalyser = this.analyser;

      // Sub-sonic 38 Hz Butterworth DC blocker ahead of SFX dry + early-reflection split
      this.dcBlocker = this._createFilter("highpass", 38, 0.7071, now);

      // Dry SFX path (86%)
      this.sfxDryGain = ctx.createGain();
      this.sfxDryGain.gain.setValueAtTime(0.86, now);
      this.dcBlocker.connect(this.sfxDryGain);
      this.sfxDryGain.connect(this.engine.sfxBus);

      // Wet SFX path (~14%): 3-Tap Sunlit Kitchen Room Early Reflections (3.4ms, 7.9ms, 13.2ms)
      const erSum = ctx.createGain();
      erSum.gain.setValueAtTime(1.0, now);
      const tapSpecs = [
        { delaySec: 0.0034, gain: 0.50 }, // White-oak tabletop early reflection
        { delaySec: 0.0079, gain: 0.33 }, // Limewash window-reveal reflection
        { delaySec: 0.0132, gain: 0.21 }, // Minimalist rift-oak credenza reflection
      ];
      this.erTaps = tapSpecs.map((spec) => {
        const d = ctx.createDelay(0.05);
        d.delayTime.setValueAtTime(spec.delaySec, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(spec.gain, now);
        this.dcBlocker.connect(d);
        d.connect(g);
        g.connect(erSum);
        return { delay: d, gain: g };
      });

      // Warm plaster & European oak absorption (1.8 kHz - 3.2 kHz high-frequency damping)
      const erHighpass = this._createFilter("highpass", 175, 0.7071, now);
      const erWoodWarmth = this._createFilter("peaking", 430, 0.9, now);
      erWoodWarmth.gain.setValueAtTime(1.4, now);
      const erPlasterDamp = this._createFilter("lowpass", 2450, 0.72, now);

      this.erWetGain = ctx.createGain();
      this.erWetGain.gain.setValueAtTime(0.145, now);

      erSum.connect(erHighpass);
      erHighpass.connect(erWoodWarmth);
      erWoodWarmth.connect(erPlasterDamp);
      erPlasterDamp.connect(this.erWetGain);
      this.erWetGain.connect(this.engine.sfxBus);

      // Synthesize pink-noise buffer strictly for transient & moving-car slate/oak Foley (zero continuous static bed!)
      this.pinkNoiseBuffer = this._createPinkNoiseBuffer(2.4);

      // Decode & attach embedded Lyria 3.5 sunlit cafe lo-fi chillhop loop (`playbackRate === 1.000`)
      this._loadAndAttachLofiMusic();

      // Start surface-split rolling subgraphs (strictly gain === 0.0 whenever cars are stationary)
      this._setupSurfaceSplitRollingLoops();

      const tel = ensureTelemetry();
      tel.musicPlaybackRate = 1.0;
      tel.limiterThresholdDb = -1.0;
      tel.audioLookaheadSec = this.lookaheadSec;
      tel.dualBusActive = true;
    } catch (_) {
      this.ctx = null;
    }
  }

  /**
   * Generates a zero-DC, seam-crossfaded Paul Kellet pink noise buffer for organic surface textures.
   */
  _createPinkNoiseBuffer(durationSec = 2.4) {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate || 48000;
    const length = Math.max(2048, Math.floor(sampleRate * durationSec));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let seed = 0x51a7c0de;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let sum = 0;

    for (let i = 0; i < length; i++) {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      const white = (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;

      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.76160 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;

      data[i] = pink;
      sum += pink;
    }

    const meanPre = sum / length;
    for (let i = 0; i < length; i++) data[i] -= meanPre;

    const fadeSamples = Math.min(1024, Math.floor(length * 0.05));
    for (let i = 0; i < fadeSamples; i++) {
      const alpha = i / fadeSamples;
      const tailIdx = length - fadeSamples + i;
      data[tailIdx] = data[tailIdx] * (1 - alpha) + data[i] * alpha;
    }

    let sumPost = 0;
    for (let i = 0; i < length; i++) sumPost += data[i];
    const meanPost = sumPost / length;
    for (let i = 0; i < length; i++) data[i] -= meanPost;

    return buffer;
  }

  /**
   * Decodes the preloaded Lyria 3.5 MP3 (`fetchLofiChillMp3Buffer`) into an `AudioBuffer` via `ctx.decodeAudioData`
   * and attaches it to `this.engine.musicBus` on a looping `AudioBufferSourceNode` with `playbackRate = 1.000`.
   */
  _loadAndAttachLofiMusic() {
    if (!this.ctx || this._lofiDecodePromise) return;
    try {
      this._lofiDecodePromise = fetchLofiChillMp3Buffer()
        .then((mp3Buf) => {
          if (!this.ctx || !mp3Buf) return null;
          return this.ctx.decodeAudioData(mp3Buf.slice(0));
        })
        .then((audioBuf) => {
          if (!this.ctx || !audioBuf) return;
          this.lofiBuffer = audioBuf;
          this.lofiMusicLoaded = true;

          // Start looping source locked strictly at playbackRate === 1.000
          const initialGain = 0.0;
          const src = this.engine.playLockedMusicBuffer(audioBuf, {
            loop: true,
            gain: initialGain,
          });
          if (src) {
            src.playbackRate.setValueAtTime(1.0, this.ctx.currentTime);
            this.lofiMusicStarted = true;
          }
          ensureTelemetry().musicPlaybackRate = 1.0;

          if (this.enabled && (this._hasUserActivation || this.ctx.state === "running")) {
            this._fadeInLofiMusic();
          }
        })
        .catch((err) => {
          console.warn("[audio] Lo-fi music decode failed:", err);
          this.lofiMusicLoaded = false;
        });
    } catch (_) {}
  }

  _fadeInLofiMusic() {
    if (!this.ctx || !this.engine?.musicBus || !this.lofiMusicStarted) return;
    try {
      const now = this.ctx.currentTime;
      const busGain = this.engine.musicBus.gain;
      busGain.cancelScheduledValues(now);
      if (!this._lofiFadeInDone) {
        this._lofiFadeInDone = true;
        const startVal = Math.max(ENV_FLOOR, busGain.value || ENV_FLOOR);
        busGain.setValueAtTime(startVal, now);
        if (this.enabled) {
          busGain.linearRampToValueAtTime(LOFI_MUSIC_BUS_GAIN, now + 0.42);
        } else {
          busGain.setValueAtTime(0.0, now);
        }
      } else {
        busGain.setValueAtTime(busGain.value, now);
        busGain.setTargetAtTime(this.enabled ? LOFI_MUSIC_BUS_GAIN : 0.0, now, 0.04);
      }
      this.engine.setTimeScale(1.0);
    } catch (_) {}
  }

  /**
   * Builds continuous surface-split rolling branches:
   *   1. Slate mineral micro-friction whisper (950-2400 Hz)
   *   2. 1.2 mm spring-steel wire-axle / Zamak bore metallic whir (1.6-2.9 kHz high-Q)
   *   3. Rift-sawn European white-oak 4.0 cm slab modal formants (185 Hz, 410 Hz, 860 Hz)
   */
  _setupSurfaceSplitRollingLoops() {
    if (!this.ctx || !this.pinkNoiseBuffer || !this._voiceBus() || this._rollingReady) return;
    try {
      const now = this.ctx.currentTime;
      const busIn = this._voiceBus();

      // A. Honed Charcoal Slate mineral micro-friction whisper (950-2400 Hz)
      const slateSrc = this.ctx.createBufferSource();
      slateSrc.buffer = this.pinkNoiseBuffer;
      slateSrc.loop = true;
      const slateBp = this._createFilter("bandpass", 1180, 1.65, now);
      const slateLp = this._createFilter("lowpass", 3100, 0.72, now);
      const slateGain = this.ctx.createGain();
      slateGain.gain.setValueAtTime(0.0, now);

      slateSrc.connect(slateBp);
      slateBp.connect(slateLp);
      slateLp.connect(slateGain);
      slateGain.connect(busIn);
      slateSrc.start(now, 0.0);

      // B. 1.2 mm spring-steel wire-axle / Zamak bore metallic whir (1.6 kHz - 2.9 kHz high-Q)
      const axleSrc = this.ctx.createBufferSource();
      axleSrc.buffer = this.pinkNoiseBuffer;
      axleSrc.loop = true;
      const axleBpA = this._createFilter("bandpass", 1820, 5.8, now);
      const axleBpB = this._createFilter("bandpass", 2540, 6.4, now);
      const axleSum = this.ctx.createGain();
      axleSum.gain.setValueAtTime(0.55, now);
      const axleGain = this.ctx.createGain();
      axleGain.gain.setValueAtTime(0.0, now);

      axleSrc.connect(axleBpA);
      axleSrc.connect(axleBpB);
      axleBpA.connect(axleGain);
      axleBpB.connect(axleSum);
      axleSum.connect(axleGain);
      axleGain.connect(busIn);
      axleSrc.start(now, 0.85);

      // C. Rift-Sawn European White-Oak Dining Table modal resonance (185 Hz, 410 Hz, 860 Hz)
      const oakSrc = this.ctx.createBufferSource();
      oakSrc.buffer = this.pinkNoiseBuffer;
      oakSrc.loop = true;
      const m185 = this._createFilter("bandpass", 185, 3.6, now);
      const m410 = this._createFilter("bandpass", 410, 3.1, now);
      const m860 = this._createFilter("bandpass", 860, 2.5, now);
      const g185 = this.ctx.createGain();
      const g410 = this.ctx.createGain();
      const g860 = this.ctx.createGain();
      g185.gain.setValueAtTime(0.95, now);
      g410.gain.setValueAtTime(0.72, now);
      g860.gain.setValueAtTime(0.54, now);

      const oakLp = this._createFilter("lowpass", 1650, 0.75, now);
      const oakGain = this.ctx.createGain();
      oakGain.gain.setValueAtTime(0.0, now);

      oakSrc.connect(m185);
      oakSrc.connect(m410);
      oakSrc.connect(m860);
      m185.connect(g185).connect(oakLp);
      m410.connect(g410).connect(oakLp);
      m860.connect(g860).connect(oakLp);
      oakLp.connect(oakGain);
      oakGain.connect(busIn);
      oakSrc.start(now, 1.45);

      this.slateSource = slateSrc;
      this.slateBandpass = slateBp;
      this.slateLowpass = slateLp;
      this.slateGain = slateGain;

      this.axleSource = axleSrc;
      this.axleBandpassA = axleBpA;
      this.axleBandpassB = axleBpB;
      this.axleGain = axleGain;

      this.oakSource = oakSrc;
      this.oakMode185 = m185;
      this.oakMode410 = m410;
      this.oakMode860 = m860;
      this.oakGain = oakGain;
      this._rollingReady = true;
    } catch (_) {}
  }

  resume() {
    if (!this.ctx && typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) {
      this._initGraph();
    }
    if (!this.ctx || !this._canResumeAudioContext()) return;
    if (this.ctx.state === "suspended") {
      this.engine.resume().then(() => {
        if (this.enabled) this._fadeInLofiMusic();
      });
    } else if (this.enabled && !this._lofiFadeInDone) {
      this._fadeInLofiMusic();
    }
    ensureTelemetry().musicPlaybackRate = 1.0;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.ctx) {
      if (this.enabled) this._initGraph();
      if (!this.ctx) return;
    }
    try {
      const now = this.ctx.currentTime;
      if (this.engine.musicBus) {
        this.engine.musicBus.gain.cancelScheduledValues(now);
        this.engine.musicBus.gain.setValueAtTime(this.engine.musicBus.gain.value, now);
        this.engine.musicBus.gain.setTargetAtTime(
          this.enabled && this.lofiMusicStarted ? LOFI_MUSIC_BUS_GAIN : 0.0,
          now,
          0.04
        );
      }
      if (this.engine.sfxBus) {
        this.engine.sfxBus.gain.cancelScheduledValues(now);
        this.engine.sfxBus.gain.setValueAtTime(this.engine.sfxBus.gain.value, now);
        this.engine.sfxBus.gain.setTargetAtTime(this.enabled ? SFX_BUS_GAIN : 0.0, now, 0.024);
      }
      // Strictly preserve musicPlaybackRate === 1.000
      this.engine.setTimeScale(1.0);
      if (this.enabled) this.resume();
    } catch (_) {}
  }

  getDiagnostics() {
    let peakAmplitude = 0;
    let rmsAmplitude = 0;

    if (this.analyser) {
      if (typeof this.analyser.getFloatTimeDomainData === "function") {
        const fftLen = this.analyser.fftSize;
        if (!this._floatTimeDomain || this._floatTimeDomain.length !== fftLen) {
          this._floatTimeDomain = new Float32Array(fftLen);
        }
        this.analyser.getFloatTimeDomainData(this._floatTimeDomain);
        let sumSq = 0;
        for (let i = 0; i < fftLen; i++) {
          const sample = Number.isFinite(this._floatTimeDomain[i]) ? this._floatTimeDomain[i] : 0;
          const abs = Math.abs(sample);
          if (abs > peakAmplitude) peakAmplitude = abs;
          sumSq += sample * sample;
        }
        rmsAmplitude = fftLen > 0 ? Math.sqrt(sumSq / fftLen) : 0;
      } else if (typeof this.analyser.getByteTimeDomainData === "function") {
        const fftLen = this.analyser.fftSize;
        if (!this._byteTimeDomain || this._byteTimeDomain.length !== fftLen) {
          this._byteTimeDomain = new Uint8Array(fftLen);
        }
        this.analyser.getByteTimeDomainData(this._byteTimeDomain);
        let sumSq = 0;
        for (let i = 0; i < fftLen; i++) {
          const sample = (this._byteTimeDomain[i] - 128) / 128;
          const abs = Math.abs(sample);
          if (abs > peakAmplitude) peakAmplitude = abs;
          sumSq += sample * sample;
        }
        rmsAmplitude = fftLen > 0 ? Math.sqrt(sumSq / fftLen) : 0;
      }
    }

    const limiter = this.engine?.limiter;
    const musicRate = Number(this.engine?.musicSource?.playbackRate?.value ?? 1.0);
    return {
      initialized: Boolean(this.ctx),
      state: this.ctx?.state || "uninitialized",
      sampleRate: this.ctx?.sampleRate || 48000,
      enabled: this.enabled,
      lofiMusicLoaded: Boolean(this.lofiMusicLoaded && this.lofiBuffer),
      lofiMusicPlaying: Boolean(
        this.lofiMusicStarted && this.enabled && this.ctx?.state === "running"
      ),
      lofiDurationSec: Number((this.lofiBuffer?.duration || 0).toFixed(2)),
      hasContinuousNoiseBed: false,
      idleRollingNoiseGain: Number(
        (
          (this.slateGain?.gain?.value || 0) +
          (this.axleGain?.gain?.value || 0) +
          (this.oakGain?.gain?.value || 0)
        ).toFixed(6)
      ),
      activeVoices: this.activeVoices,
      peakAmplitude: Number(peakAmplitude.toFixed(6)),
      rmsAmplitude: Number(rmsAmplitude.toFixed(6)),
      cueCount: this.cueLog.length,
      lastCue: this.cueLog[this.cueLog.length - 1] || null,
      hasStreamDestination: Boolean(
        typeof window !== "undefined" && window.__audioStreamDestination?.stream
      ),
      musicPlaybackRate: musicRate,
      limiterThresholdDb: Number(limiter?.threshold?.value ?? -1.0),
      limiterReductionDb: Number((limiter?.reduction || 0).toFixed(3)),
      compressorReductionDb: Number((limiter?.reduction || 0).toFixed(3)),
      lookaheadSec: this.lookaheadSec,
      rollingSurfaceMixOak: Number(this._currentOakMix.toFixed(3)),
    };
  }

  _logCue(type, intensity = 1.0, meta = null) {
    if (!this.enabled) return;
    if (this.cueLog.length < 2048) {
      const entry = {
        type,
        intensity: Number(Number(intensity).toFixed(3)),
        t: Number((Number(state.elapsedTime) || 0).toFixed(4)),
        frame: Number(state.frameCount) || 0,
      };
      if (meta) entry.meta = meta;
      this.cueLog.push(entry);
    }
  }

  /**
   * Subtle silk-screened 2.2u grid-line micro-tick when miniature rubber tires cross a stall line on slate.
   */
  _playSlateCellMicroTick(speedNorm = 0.5) {
    if (!this.enabled || !this.ctx || !this._voiceBus() || this.activeVoices >= MAX_TRANSIENT_VOICES) {
      return;
    }
    if (this._cellTickCooldown > 0) return;
    this._cellTickCooldown = 0.045;

    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();
        const amp = Math.max(0.18, Math.min(1.0, speedNorm)) * this._voiceHeadroomScale();

        if (this.pinkNoiseBuffer) {
          const src = ctx.createBufferSource();
          src.buffer = this.pinkNoiseBuffer;
          const bp = this._createFilter("bandpass", 1920, 3.2, t0);
          const g = ctx.createGain();
          const stopAt = this._scheduleClickFreeDecay(g.gain, t0, 0.026 * amp, 0.0018, 0.011);

          src.connect(bp).connect(g).connect(busIn);
          this._trackVoice(src);
          src.start(t0, 0.32, 0.018);
          src.stop(stopAt);
        }
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * Surface-Split Rolling DSP (`updateTireRoll(speed, isTarget, worldX = 0, dt = 1/60)`):
   *   - Smoothly crossfades across the East exit bevel (`worldX` in `[6.96, 7.42]`):
   *       * `worldX <= 6.96` (Honed Charcoal Slate): dry mineral whisper (950-2400 Hz) +
   *         1.2mm spring-steel wire-axle / Zamak bore whir (1.6-2.9 kHz) + 2.2u cell-line micro-ticks
   *       * `worldX >= 7.42` (European White-Oak Table): warm 4.0cm solid oak slab modal formants
   *         (185 Hz, 410 Hz, 860 Hz) + open-pore wood grain rolling texture
   */
  updateTireRoll(speedMetersPerSec, isTargetOrDt = false, worldX = 0, dt = 1 / 60) {
    let isTarget = false;
    let wx = 0;
    let stepDt = 1 / 60;

    if (typeof isTargetOrDt === "number") {
      // Backward-compatible 2-arg call: updateTireRoll(speed, dt)
      stepDt = Math.max(0, isTargetOrDt || 1 / 60);
    } else {
      isTarget = Boolean(isTargetOrDt);
      wx = Number.isFinite(worldX) ? worldX : 0;
      stepDt = Math.max(0, Number(dt) || 1 / 60);
    }

    if (this.bumpCooldown > 0) this.bumpCooldown = Math.max(0, this.bumpCooldown - stepDt);
    if (this.detentCooldown > 0) this.detentCooldown = Math.max(0, this.detentCooldown - stepDt);
    if (this.scrubCooldown > 0) this.scrubCooldown = Math.max(0, this.scrubCooldown - stepDt);
    if (this.cardFlipCooldown > 0) this.cardFlipCooldown = Math.max(0, this.cardFlipCooldown - stepDt);
    if (this._cellTickCooldown > 0) this._cellTickCooldown = Math.max(0, this._cellTickCooldown - stepDt);

    if (this.enabled && this._hasUserActivation && this.ctx?.state === "suspended") {
      this.resume();
    }
    if (!this.ctx || !this._rollingReady) return;

    const speed = Math.max(0, Number(speedMetersPerSec) || 0);
    const active = this.enabled && speed > 0.055;
    const speedNorm = Math.min(1.0, speed / 12.0);

    // Smooth Hermite surface split across the 20° East bevel (6.96 -> 7.42)
    const bevelSpan = Math.max(0.01, BOARD_PHYSICS.bevelEndX - BOARD_PHYSICS.bevelStartX);
    const uOak = Math.max(0, Math.min(1, (wx - BOARD_PHYSICS.bevelStartX) / bevelSpan));
    const oakMix = uOak * uOak * (3 - 2 * uOak);
    const slateMix = 1.0 - oakMix;
    this._currentOakMix = oakMix;

    // Silk-screened 2.2u grid cell-line micro-ticks while rolling on honed slate deck
    if (active && slateMix > 0.65 && speed > 0.45) {
      this._rollCellAccum += speed * stepDt;
      if (this._rollCellAccum >= GRID_SPEC.cellSize) {
        this._rollCellAccum %= GRID_SPEC.cellSize;
        this._playSlateCellMicroTick(speedNorm * slateMix);
      }
    } else if (!active) {
      this._rollCellAccum = 0;
    }

    const baseRollAmp = active ? Math.min(0.118, 0.014 + speed * 0.0115) : 0.0;
    const targetSlate = baseRollAmp * slateMix * 0.92;
    const heroAxleBoost = isTarget ? 1.18 : 1.0;
    const targetAxle =
      baseRollAmp * (0.36 * slateMix + 0.16 * oakMix) * heroAxleBoost * (0.45 + 0.55 * speedNorm);
    const targetOak = baseRollAmp * oakMix * 1.32;

    const blend = Math.min(1, stepDt * 20);
    this.smoothedSlateGain += (targetSlate - this.smoothedSlateGain) * blend;
    this.smoothedAxleGain += (targetAxle - this.smoothedAxleGain) * blend;
    this.smoothedOakGain += (targetOak - this.smoothedOakGain) * blend;

    const isStationarySilent =
      !active &&
      this.smoothedSlateGain < 0.00025 &&
      this.smoothedAxleGain < 0.00025 &&
      this.smoothedOakGain < 0.00025;

    if (isStationarySilent) {
      this.smoothedSlateGain = 0.0;
      this.smoothedAxleGain = 0.0;
      this.smoothedOakGain = 0.0;
    }

    try {
      const now = this.ctx.currentTime;
      if (isStationarySilent) {
        this.slateGain.gain.cancelScheduledValues(now);
        this.slateGain.gain.setValueAtTime(0.0, now);
        this.axleGain.gain.cancelScheduledValues(now);
        this.axleGain.gain.setValueAtTime(0.0, now);
        this.oakGain.gain.cancelScheduledValues(now);
        this.oakGain.gain.setValueAtTime(0.0, now);
      } else {
        const slateFreq = this._clampFreq(950 + speedNorm * 1420);
        const axleFreqA = this._clampFreq(1620 + speedNorm * 920);
        const axleFreqB = this._clampFreq(2180 + speedNorm * 720);
        const oakGrainFreq = this._clampFreq(800 + speedNorm * 180);

        this.slateGain.gain.setTargetAtTime(this.smoothedSlateGain, now, 0.020);
        this.slateBandpass.frequency.setTargetAtTime(slateFreq, now, 0.028);

        this.axleGain.gain.setTargetAtTime(this.smoothedAxleGain, now, 0.020);
        this.axleBandpassA.frequency.setTargetAtTime(axleFreqA, now, 0.028);
        this.axleBandpassB.frequency.setTargetAtTime(axleFreqB, now, 0.028);

        this.oakGain.gain.setTargetAtTime(this.smoothedOakGain, now, 0.022);
        this.oakMode860.frequency.setTargetAtTime(oakGrainFreq, now, 0.030);
      }
    } catch (_) {}
  }

  /**
   * Warm precision Zamak die-cast & honed-slate magnetic stall detent settle click on grid commit.
   */
  playDetentSnap(intensity = 1.0) {
    if (!this.enabled) return;
    this._logCue("detentSnap", intensity);
    this.resume();
    if (!this.ctx || !this._voiceBus() || this.activeVoices >= MAX_TRANSIENT_VOICES) return;
    if (this.detentCooldown > 0) return;
    this.detentCooldown = 0.026;

    const amp = Math.max(0.15, Math.min(1.0, Number(intensity) || 0.8)) * this._voiceHeadroomScale();
    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();

        // 1. Honed-slate & beechwood board pocket body thud
        const bodyOsc = ctx.createOscillator();
        const bodyLp = this._createFilter("lowpass", 880, 0.85, t0);
        const bodyGain = ctx.createGain();
        bodyOsc.type = "triangle";
        bodyOsc.frequency.setValueAtTime(this._clampOscFreq(236), t0);
        bodyOsc.frequency.exponentialRampToValueAtTime(this._clampOscFreq(88), t0 + 0.032);
        const stop1 = this._scheduleClickFreeDecay(bodyGain.gain, t0, 0.165 * amp, 0.002, 0.038);
        bodyOsc.connect(bodyLp).connect(bodyGain).connect(busIn);
        this._trackVoice(bodyOsc);
        bodyOsc.start(t0);
        bodyOsc.stop(stop1);

        // 2. Delicate 1.2mm spring-steel wire-axle / Zamak slot settle micro-tick
        const axleOsc = ctx.createOscillator();
        const axleBp = this._createFilter("bandpass", 2150, 3.2, t0);
        const axleGain = ctx.createGain();
        axleOsc.type = "sine";
        axleOsc.frequency.setValueAtTime(this._clampOscFreq(2420), t0);
        axleOsc.frequency.exponentialRampToValueAtTime(this._clampOscFreq(1480), t0 + 0.012);
        const stop2 = this._scheduleClickFreeDecay(axleGain.gain, t0, 0.042 * amp, 0.0018, 0.014);
        axleOsc.connect(axleBp).connect(axleGain).connect(busIn);
        this._trackVoice(axleOsc);
        axleOsc.start(t0);
        axleOsc.stop(stop2);

        // 3. Dry mineral slate rubber settle brush
        if (this.pinkNoiseBuffer) {
          const nSrc = ctx.createBufferSource();
          nSrc.buffer = this.pinkNoiseBuffer;
          const nBp = this._createFilter("bandpass", 1280, 2.4, t0);
          const nGain = ctx.createGain();
          const stop3 = this._scheduleClickFreeDecay(nGain.gain, t0, 0.054 * amp, 0.002, 0.016);
          nSrc.connect(nBp).connect(nGain).connect(busIn);
          this._trackVoice(nSrc);
          nSrc.start(t0, 0.14, 0.025);
          nSrc.stop(stop3);
        }
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * Non-linear `WaveShaperNode` (`Math.tanh`) vulcanized rubber O-ring micro-chirp/scrub
   * (`680-1350 Hz` swept bandpass) when tugging a car off-axis or straining against a stop.
   */
  playTireScrub(intensity = 0.5) {
    if (!this.enabled || this.scrubCooldown > 0) return;
    this.scrubCooldown = 0.14;
    const clamped = Math.max(0.2, Math.min(1.0, Number(intensity) || 0.5));
    this._logCue("tireScrub", clamped);
    this.resume();
    if (!this.ctx || !this._voiceBus() || this.activeVoices >= MAX_TRANSIENT_VOICES) return;

    const amp = clamped * this._voiceHeadroomScale();
    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();
        const shaper = ctx.createWaveShaper();
        shaper.curve = this.engine._getTanhCurve();
        shaper.oversample = "2x";

        // Stick-slip vulcanized rubber carrier + textured slate friction noise into tanh waveshaper
        const slipOsc = ctx.createOscillator();
        slipOsc.type = "triangle";
        slipOsc.frequency.setValueAtTime(this._clampOscFreq(465), t0);
        slipOsc.frequency.exponentialRampToValueAtTime(this._clampOscFreq(620), t0 + 0.024);
        slipOsc.frequency.exponentialRampToValueAtTime(this._clampOscFreq(340), t0 + 0.058);

        const driveGain = ctx.createGain();
        driveGain.gain.setValueAtTime(0.55 + 0.35 * clamped, t0);

        const sweptBp = this._createFilter("bandpass", 680, 3.6, t0);
        sweptBp.frequency.exponentialRampToValueAtTime(this._clampFreq(1350), t0 + 0.026);
        sweptBp.frequency.exponentialRampToValueAtTime(this._clampFreq(780), t0 + 0.062);

        const lp = this._createFilter("lowpass", 2350, 0.75, t0);
        const env = ctx.createGain();
        const stopAt = this._scheduleClickFreeDecay(env.gain, t0, 0.078 * amp, 0.003, 0.062);

        slipOsc.connect(driveGain);
        if (this.pinkNoiseBuffer) {
          const grit = ctx.createBufferSource();
          grit.buffer = this.pinkNoiseBuffer;
          const gritGain = ctx.createGain();
          gritGain.gain.setValueAtTime(0.42, t0);
          grit.connect(gritGain).connect(driveGain);
          this._trackVoice(grit);
          grit.start(t0, 0.52, 0.072);
          grit.stop(stopAt);
        }

        driveGain.connect(shaper).connect(sweptBp).connect(lp).connect(env).connect(busIn);
        this._trackVoice(slipOsc);
        slipOsc.start(t0);
        slipOsc.stop(stopAt);
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * Crisp hollow cast-zinc Zamak-on-Zamak / chrome bumper micro-clink (`1.35 kHz` + `3.1 kHz`
   * metallic shell modes + muted miniature rubber bumper thud).
   */
  playDieCastBumperClink(intensity = 0.75) {
    if (!this.enabled) return;
    const amp = Math.max(0.22, Math.min(1.0, Number(intensity) || 0.75)) * this._voiceHeadroomScale();
    this._logCue("bumperClink", intensity, { hitType: "car" });
    this.resume();
    if (!this.ctx || !this._voiceBus() || this.activeVoices >= MAX_TRANSIENT_VOICES) return;

    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();

        // 1. Hollow cast-zinc Zamak shell mode (1.35 kHz) + chrome bumper clink (3.1 kHz)
        const z1 = ctx.createOscillator();
        const z2 = ctx.createOscillator();
        const metalBp = this._createFilter("bandpass", 2150, 1.9, t0);
        const gZ1 = ctx.createGain();
        const gZ2 = ctx.createGain();

        z1.type = "triangle";
        z1.frequency.setValueAtTime(this._clampOscFreq(1350), t0);
        z1.frequency.exponentialRampToValueAtTime(this._clampOscFreq(1190), t0 + 0.028);

        z2.type = "sine";
        z2.frequency.setValueAtTime(this._clampOscFreq(3100), t0);
        z2.frequency.exponentialRampToValueAtTime(this._clampOscFreq(2760), t0 + 0.020);

        const stopZ1 = this._scheduleClickFreeDecay(gZ1.gain, t0, 0.088 * amp, 0.0018, 0.032);
        const stopZ2 = this._scheduleClickFreeDecay(gZ2.gain, t0, 0.056 * amp, 0.0018, 0.022);

        z1.connect(gZ1).connect(metalBp);
        z2.connect(gZ2).connect(metalBp);
        metalBp.connect(busIn);

        this._trackVoice(z1);
        this._trackVoice(z2);
        z1.start(t0);
        z2.start(t0);
        z1.stop(stopZ1);
        z2.stop(stopZ2);

        // 2. Muted rubber tire / chassis cushion thud
        const thud = ctx.createOscillator();
        const thudLp = this._createFilter("lowpass", 480, 0.85, t0);
        const thudGain = ctx.createGain();
        thud.type = "sine";
        thud.frequency.setValueAtTime(this._clampOscFreq(196), t0);
        thud.frequency.exponentialRampToValueAtTime(this._clampOscFreq(84), t0 + 0.034);
        const stopThud = this._scheduleClickFreeDecay(thudGain.gain, t0, 0.135 * amp, 0.002, 0.038);
        thud.connect(thudLp).connect(thudGain).connect(busIn);
        this._trackVoice(thud);
        thud.start(t0);
        thud.stop(stopThud);
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * Warm damped steamed-beech hardwood perimeter frame knock (`260 Hz` + `740 Hz` wood modal decay).
   */
  playBeechCurbKnock(intensity = 0.75) {
    if (!this.enabled) return;
    const amp = Math.max(0.22, Math.min(1.0, Number(intensity) || 0.75)) * this._voiceHeadroomScale();
    this._logCue("beechCurbKnock", intensity, { hitType: "curb" });
    this.resume();
    if (!this.ctx || !this._voiceBus() || this.activeVoices >= MAX_TRANSIENT_VOICES) return;

    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();

        // 1. Steamed-beech hardwood rail fundamental (260 Hz) + woody modal tap (740 Hz)
        const modeLow = ctx.createOscillator();
        const modeHigh = ctx.createOscillator();
        const woodLp = this._createFilter("lowpass", 1180, 0.9, t0);
        const gLow = ctx.createGain();
        const gHigh = ctx.createGain();

        modeLow.type = "triangle";
        modeLow.frequency.setValueAtTime(this._clampOscFreq(260), t0);
        modeLow.frequency.exponentialRampToValueAtTime(this._clampOscFreq(112), t0 + 0.048);

        modeHigh.type = "sine";
        modeHigh.frequency.setValueAtTime(this._clampOscFreq(740), t0);
        modeHigh.frequency.exponentialRampToValueAtTime(this._clampOscFreq(385), t0 + 0.026);

        const stopLow = this._scheduleClickFreeDecay(gLow.gain, t0, 0.175 * amp, 0.0022, 0.054);
        const stopHigh = this._scheduleClickFreeDecay(gHigh.gain, t0, 0.072 * amp, 0.002, 0.029);

        modeLow.connect(gLow).connect(woodLp);
        modeHigh.connect(gHigh).connect(woodLp);
        woodLp.connect(busIn);

        this._trackVoice(modeLow);
        this._trackVoice(modeHigh);
        modeLow.start(t0);
        modeHigh.start(t0);
        modeLow.stop(stopLow);
        modeHigh.stop(stopHigh);

        // 2. Hardwood grain contact transient
        if (this.pinkNoiseBuffer) {
          const nSrc = ctx.createBufferSource();
          nSrc.buffer = this.pinkNoiseBuffer;
          const nBp = this._createFilter("bandpass", 640, 2.1, t0);
          const nGain = ctx.createGain();
          const stopN = this._scheduleClickFreeDecay(nGain.gain, t0, 0.064 * amp, 0.002, 0.020);
          nSrc.connect(nBp).connect(nGain).connect(busIn);
          this._trackVoice(nSrc);
          nSrc.start(t0, 0.28, 0.028);
          nSrc.stop(stopN);
        }
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * Material-specific corridor stop dispatcher:
   *   - `opts.hitType === "car"`  -> `playDieCastBumperClink`
   *   - `opts.hitType === "curb"` -> `playBeechCurbKnock` (default)
   */
  playBumpStop(speed = 0.75, opts = {}) {
    if (!this.enabled || this.bumpCooldown > 0) return;
    this.bumpCooldown = 0.14;
    const hitType = opts?.hitType === "car" ? "car" : "curb";
    if (hitType === "car") {
      this.playDieCastBumperClink(speed);
    } else {
      this.playBeechCurbKnock(speed);
    }
  }

  playCorridorBump(intensity = 0.75, opts = {}) {
    this.playBumpStop(intensity, opts);
  }

  /**
   * Two-stage board-to-oak-table axle drop ("front" vs "rear"):
   *   1. Solid 4.0cm European white-oak slab thump (`145 Hz` + `380 Hz` hardwood tap)
   *   2. Crisp `2.4 kHz - 4.8 kHz` Zamak die-cast baseplate wire-axle settle chatter
   *      (`2` micro-clinks separated by `14ms`).
   */
  playTableDrop(stage = "front", intensity = 1.0) {
    if (!this.enabled) return;
    const isRear = stage === "rear";
    this._logCue(isRear ? "tableDropRear" : "tableDropFront", intensity);
    this.resume();
    if (!this.ctx || !this._voiceBus() || this.activeVoices >= MAX_TRANSIENT_VOICES) return;

    const amp = Math.max(0.28, Math.min(1.0, Number(intensity) || 0.82)) * this._voiceHeadroomScale();
    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();

        // 1. Solid European white-oak slab flexural thump (145 Hz) + hardwood tap (380 Hz)
        const oakSub = ctx.createOscillator();
        const oakTap = ctx.createOscillator();
        const oakLp = this._createFilter("lowpass", isRear ? 760 : 840, 1.05, t0);
        const gSub = ctx.createGain();
        const gTap = ctx.createGain();

        oakSub.type = "sine";
        oakSub.frequency.setValueAtTime(this._clampOscFreq(isRear ? 142 : 152), t0);
        oakSub.frequency.exponentialRampToValueAtTime(
          this._clampOscFreq(isRear ? 68 : 76),
          t0 + 0.052
        );

        oakTap.type = "triangle";
        oakTap.frequency.setValueAtTime(this._clampOscFreq(isRear ? 368 : 392), t0);
        oakTap.frequency.exponentialRampToValueAtTime(
          this._clampOscFreq(isRear ? 168 : 184),
          t0 + 0.030
        );

        const stopSub = this._scheduleClickFreeDecay(
          gSub.gain,
          t0,
          (isRear ? 0.245 : 0.210) * amp,
          0.0022,
          isRear ? 0.058 : 0.050
        );
        const stopTap = this._scheduleClickFreeDecay(
          gTap.gain,
          t0,
          (isRear ? 0.105 : 0.092) * amp,
          0.002,
          0.034
        );

        oakSub.connect(gSub).connect(oakLp);
        oakTap.connect(gTap).connect(oakLp);
        oakLp.connect(busIn);

        this._trackVoice(oakSub);
        this._trackVoice(oakTap);
        oakSub.start(t0);
        oakTap.start(t0);
        oakSub.stop(stopSub);
        oakTap.stop(stopTap);

        // 2. Zamak die-cast baseplate wire-axle settle chatter (2 micro-clinks separated by 14ms)
        const clinkOffsets = [0.003, 0.017]; // Δt = 14.0 ms
        const clinkScales = [1.0, 0.58];
        for (let k = 0; k < 2; k++) {
          const tk = t0 + clinkOffsets[k];
          const ckScale = clinkScales[k] * amp;

          const wireA = ctx.createOscillator();
          const wireB = ctx.createOscillator();
          const chatterBp = this._createFilter("bandpass", 3450, 3.8, tk);
          const chatterGain = ctx.createGain();

          wireA.type = "sine";
          wireA.frequency.setValueAtTime(this._clampOscFreq(k === 0 ? 2680 : 2460), tk);
          wireB.type = "triangle";
          wireB.frequency.setValueAtTime(this._clampOscFreq(k === 0 ? 4380 : 3960), tk);

          const stopChatter = this._scheduleClickFreeDecay(
            chatterGain.gain,
            tk,
            0.044 * ckScale,
            0.0018,
            0.012
          );

          wireA.connect(chatterBp);
          wireB.connect(chatterBp);
          chatterBp.connect(chatterGain).connect(busIn);

          this._trackVoice(wireA);
          this._trackVoice(wireB);
          wireA.start(tk);
          wireB.start(tk);
          wireA.stop(stopChatter);
          wireB.stop(stopChatter);
        }

        // 3. Open-pore white-oak surface grain tap
        if (this.pinkNoiseBuffer) {
          const nSrc = ctx.createBufferSource();
          nSrc.buffer = this.pinkNoiseBuffer;
          const nBp = this._createFilter("bandpass", isRear ? 610 : 680, 2.2, t0);
          const nGain = ctx.createGain();
          const stopN = this._scheduleClickFreeDecay(
            nGain.gain,
            t0,
            (isRear ? 0.082 : 0.074) * amp,
            0.002,
            0.019
          );
          nSrc.connect(nBp).connect(nGain).connect(busIn);
          this._trackVoice(nSrc);
          nSrc.start(t0, isRear ? 0.44 : 0.19, 0.026);
          nSrc.stop(stopN);
        }
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * 3-Stage Horological C36000 Brass Exit Gate Open:
   *   (1) Crisp machined brass pawl unlatch click (`t0`)
   *   (2) Miniature counterweight gear/ratchet swing (`3` ascending micro-ticks over `140ms`)
   *   (3) Soft wool-felt top-stop cushion thud (`+210ms`) + delicate harmonic resonance
   */
  playGateOpen() {
    if (!this.enabled) return;
    this._logCue("gateOpen", 1.0);
    this.resume();
    if (!this.ctx || !this._voiceBus() || this.activeVoices >= MAX_TRANSIENT_VOICES) return;

    const scale = this._voiceHeadroomScale();
    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();

        // Stage 1 (t0): Crisp C36000 machined brass pawl unlatch click
        this._scheduleBrassClick(ctx, busIn, t0, 1520, 3380, 0.056 * scale);

        // Stage 2 (t0 + 28ms..168ms): 3 ascending counterweight ratchet micro-ticks over 140ms
        const ratchetTimes = [0.028, 0.094, 0.168];
        const ratchetFreqs = [1880, 2190, 2520];
        for (let i = 0; i < 3; i++) {
          const tr = t0 + ratchetTimes[i];
          const rOsc = ctx.createOscillator();
          const rBp = this._createFilter("bandpass", ratchetFreqs[i], 4.2, tr);
          const rGain = ctx.createGain();
          rOsc.type = "triangle";
          rOsc.frequency.setValueAtTime(this._clampOscFreq(ratchetFreqs[i]), tr);
          rOsc.frequency.exponentialRampToValueAtTime(
            this._clampOscFreq(ratchetFreqs[i] * 0.76),
            tr + 0.009
          );
          const stopR = this._scheduleClickFreeDecay(rGain.gain, tr, 0.028 * scale, 0.0018, 0.011);
          rOsc.connect(rBp).connect(rGain).connect(busIn);
          this._trackVoice(rOsc);
          rOsc.start(tr);
          rOsc.stop(stopR);
        }

        // Stage 3 (t0 + 210ms): Soft wool-felt top-stop cushion thud + subtle B4 brass resonance
        const tStop = t0 + 0.210;
        const feltOsc = ctx.createOscillator();
        const feltLp = this._createFilter("lowpass", 360, 0.8, tStop);
        const feltGain = ctx.createGain();
        feltOsc.type = "sine";
        feltOsc.frequency.setValueAtTime(this._clampOscFreq(164), tStop);
        feltOsc.frequency.exponentialRampToValueAtTime(this._clampOscFreq(76), tStop + 0.036);
        const stopFelt = this._scheduleClickFreeDecay(
          feltGain.gain,
          tStop,
          0.078 * scale,
          0.0025,
          0.042
        );
        feltOsc.connect(feltLp).connect(feltGain).connect(busIn);
        this._trackVoice(feltOsc);
        feltOsc.start(tStop);
        feltOsc.stop(stopFelt);

        this._playAcousticChimeTone(493.88, tStop + 0.008, 0.34, 0.038 * scale);
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * Horological Brass Exit Gate Close (when Row 2 is re-blocked):
   *   - Descending counterweight ratchet swing (3 micro-ticks) + crisp brass pawl re-seat click
   */
  playGateClose() {
    if (!this.enabled) return;
    this._logCue("gateClose", 0.9);
    this.resume();
    if (!this.ctx || !this._voiceBus() || this.activeVoices >= MAX_TRANSIENT_VOICES) return;

    const scale = this._voiceHeadroomScale();
    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();

        // Descending counterweight swing ticks
        const ratchetTimes = [0.012, 0.072, 0.132];
        const ratchetFreqs = [2380, 2040, 1740];
        for (let i = 0; i < 3; i++) {
          const tr = t0 + ratchetTimes[i];
          const rOsc = ctx.createOscillator();
          const rBp = this._createFilter("bandpass", ratchetFreqs[i], 4.0, tr);
          const rGain = ctx.createGain();
          rOsc.type = "triangle";
          rOsc.frequency.setValueAtTime(this._clampOscFreq(ratchetFreqs[i]), tr);
          const stopR = this._scheduleClickFreeDecay(rGain.gain, tr, 0.024 * scale, 0.0018, 0.011);
          rOsc.connect(rBp).connect(rGain).connect(busIn);
          this._trackVoice(rOsc);
          rOsc.start(tr);
          rOsc.stop(stopR);
        }

        // Crisp brass latch pawl re-seat click + beechwood sill settle at +176ms
        const tSeat = t0 + 0.176;
        this._scheduleBrassClick(ctx, busIn, tSeat, 1320, 2920, 0.052 * scale);

        const sillOsc = ctx.createOscillator();
        const sillLp = this._createFilter("lowpass", 520, 0.85, tSeat);
        const sillGain = ctx.createGain();
        sillOsc.type = "triangle";
        sillOsc.frequency.setValueAtTime(this._clampOscFreq(218), tSeat);
        sillOsc.frequency.exponentialRampToValueAtTime(this._clampOscFreq(98), tSeat + 0.028);
        const stopSill = this._scheduleClickFreeDecay(
          sillGain.gain,
          tSeat,
          0.068 * scale,
          0.002,
          0.032
        );
        sillOsc.connect(sillLp).connect(sillGain).connect(busIn);
        this._trackVoice(sillOsc);
        sillOsc.start(tSeat);
        sillOsc.stop(stopSill);
      } catch (_) {}
    }, this.lookaheadSec);
  }

  _scheduleBrassClick(ctx, busIn, startTime, freqLow, freqHigh, peakGain) {
    const a = ctx.createOscillator();
    const b = ctx.createOscillator();
    const bp = this._createFilter("bandpass", (freqLow + freqHigh) * 0.5, 2.6, startTime);
    const g = ctx.createGain();

    a.type = "sine";
    a.frequency.setValueAtTime(this._clampOscFreq(freqLow), startTime);
    a.frequency.exponentialRampToValueAtTime(this._clampOscFreq(freqLow * 0.72), startTime + 0.015);

    b.type = "triangle";
    b.frequency.setValueAtTime(this._clampOscFreq(freqHigh), startTime);
    b.frequency.exponentialRampToValueAtTime(this._clampOscFreq(freqHigh * 0.82), startTime + 0.012);

    const stopAt = this._scheduleClickFreeDecay(g.gain, startTime, peakGain, 0.0018, 0.017);
    a.connect(bp);
    b.connect(bp);
    bp.connect(g).connect(busIn);

    this._trackVoice(a);
    this._trackVoice(b);
    a.start(startTime);
    b.start(startTime);
    a.stop(stopAt);
    b.stop(stopAt);
  }

  /**
   * Crisp heavy cotton cardstock finger-flick & steamed-beech box settle (`1.9 kHz` paper brush +
   * `320 Hz` wood tap) when clicking the 3D Challenge Card Stand or selecting a puzzle level.
   */
  playCardFlip() {
    if (!this.enabled || this.cardFlipCooldown > 0) return;
    this.cardFlipCooldown = 0.09;
    this._logCue("cardFlip", 0.85);
    this.resume();
    if (!this.ctx || !this._voiceBus() || this.activeVoices >= MAX_TRANSIENT_VOICES) return;

    const scale = this._voiceHeadroomScale();
    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();

        // 1. Heavy 350gsm unbleached cotton cardstock finger-flick & paper brush (~1.9 kHz)
        if (this.pinkNoiseBuffer) {
          const paperSrc = ctx.createBufferSource();
          paperSrc.buffer = this.pinkNoiseBuffer;
          const paperBp = this._createFilter("bandpass", 1550, 2.0, t0);
          paperBp.frequency.exponentialRampToValueAtTime(this._clampFreq(2380), t0 + 0.018);
          paperBp.frequency.exponentialRampToValueAtTime(this._clampFreq(1720), t0 + 0.044);
          const paperGain = ctx.createGain();
          const stopPaper = this._scheduleClickFreeDecay(
            paperGain.gain,
            t0,
            0.094 * scale,
            0.003,
            0.044
          );
          paperSrc.connect(paperBp).connect(paperGain).connect(busIn);
          this._trackVoice(paperSrc);
          paperSrc.start(t0, 0.64, 0.056);
          paperSrc.stop(stopPaper);
        }

        // Crisp cardstock corner release snap
        const snapOsc = ctx.createOscillator();
        const snapBp = this._createFilter("bandpass", 2850, 3.0, t0 + 0.008);
        const snapGain = ctx.createGain();
        snapOsc.type = "triangle";
        snapOsc.frequency.setValueAtTime(this._clampOscFreq(2950), t0 + 0.008);
        snapOsc.frequency.exponentialRampToValueAtTime(this._clampOscFreq(1900), t0 + 0.019);
        const stopSnap = this._scheduleClickFreeDecay(
          snapGain.gain,
          t0 + 0.008,
          0.032 * scale,
          0.0018,
          0.013
        );
        snapOsc.connect(snapBp).connect(snapGain).connect(busIn);
        this._trackVoice(snapOsc);
        snapOsc.start(t0 + 0.008);
        snapOsc.stop(stopSnap);

        // 2. Steamed-beechwood & linen card-tray settle tap (320 Hz) at +56ms
        const tTap = t0 + 0.056;
        const woodOsc = ctx.createOscillator();
        const woodLp = this._createFilter("lowpass", 880, 0.85, tTap);
        const woodGain = ctx.createGain();
        woodOsc.type = "triangle";
        woodOsc.frequency.setValueAtTime(this._clampOscFreq(320), tTap);
        woodOsc.frequency.exponentialRampToValueAtTime(this._clampOscFreq(148), tTap + 0.032);
        const stopWood = this._scheduleClickFreeDecay(
          woodGain.gain,
          tTap,
          0.088 * scale,
          0.0022,
          0.036
        );
        woodOsc.connect(woodLp).connect(woodGain).connect(busIn);
        this._trackVoice(woodOsc);
        woodOsc.start(tTap);
        woodOsc.stop(stopWood);
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * Warm wooden marimba / brass harmonic chime when [Hint] illuminates the optimal vehicle.
   */
  playHintPulse() {
    if (!this.enabled) return;
    this._logCue("hintPulse", 1.0);
    this.resume();
    if (!this.ctx || !this._voiceBus()) return;

    const scale = this._voiceHeadroomScale();
    this.engine.scheduleLookahead((_ctx, t0) => {
      try {
        this._playAcousticChimeTone(440.0, t0, 0.28, 0.052 * scale);          // A4
        this._playAcousticChimeTone(554.37, t0 + 0.072, 0.36, 0.048 * scale); // C#5
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * Reverse honed-slate glide brush + upward wooden stall detent tick for [Undo].
   */
  playUndoSlide() {
    if (!this.enabled) return;
    this._logCue("undoSlide", 1.0);
    this.resume();
    if (!this.ctx || !this._voiceBus() || this.activeVoices >= MAX_TRANSIENT_VOICES) return;

    const scale = this._voiceHeadroomScale();
    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();
        const osc = ctx.createOscillator();
        const filter = this._createFilter("lowpass", 760, 0.78, t0);
        const g = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(this._clampOscFreq(142), t0);
        osc.frequency.exponentialRampToValueAtTime(this._clampOscFreq(212), t0 + 0.038);
        const stopAt = this._scheduleClickFreeDecay(g.gain, t0, 0.095 * scale, 0.0022, 0.044);

        osc.connect(filter).connect(g).connect(busIn);
        this._trackVoice(osc);
        osc.start(t0);
        osc.stop(stopAt);
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * Warm collector acoustic wooden marimba / brass harmonic chord (strictly under -6 dBFS)
   * that complements — never masks — the real oak slab rolling & two-axle drop Foley!
   */
  playCourtyardExit() {
    if (!this.enabled) return;
    this._logCue("courtyardExit", 1.0);
    this.resume();
    if (!this.ctx || !this._voiceBus()) return;

    const scale = this._voiceHeadroomScale();
    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();
        // Delicate brass threshold pass whisper
        this._scheduleBrassClick(ctx, busIn, t0, 1440, 2980, 0.034 * scale);

        // Warm acoustic rosewood/brass collector triad (E4 -> B4 -> E5 -> G#5, peak well under -6 dBFS)
        this._playAcousticChimeTone(329.63, t0 + 0.04, 0.76, 0.048 * scale); // E4
        this._playAcousticChimeTone(493.88, t0 + 0.14, 0.88, 0.054 * scale); // B4
        this._playAcousticChimeTone(659.25, t0 + 0.26, 1.02, 0.062 * scale); // E5
        this._playAcousticChimeTone(830.61, t0 + 0.40, 1.14, 0.046 * scale); // G#5
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * Synthesizes a warm rosewood marimba + C36000 brass bell harmonic tone
   * (rounded mallet attack, 3.98x marimba bending mode, zero square/sawtooth harshness).
   */
  _playAcousticChimeTone(freq, startTime, duration, peakGain) {
    if (!this.ctx || !this._voiceBus() || this.activeVoices >= MAX_TRANSIENT_VOICES) return;
    const busIn = this._voiceBus();

    const fund = this.ctx.createOscillator();
    const octave = this.ctx.createOscillator();
    const woodMode = this.ctx.createOscillator();
    const toneFilter = this._createFilter("lowpass", Math.min(5800, freq * 4.8), 0.75, startTime);
    const gFund = this.ctx.createGain();
    const gOct = this.ctx.createGain();
    const gWood = this.ctx.createGain();

    fund.type = "sine";
    fund.frequency.setValueAtTime(this._clampOscFreq(freq), startTime);

    octave.type = "triangle";
    octave.frequency.setValueAtTime(this._clampOscFreq(freq * 2.0), startTime);

    woodMode.type = "sine";
    woodMode.frequency.setValueAtTime(this._clampOscFreq(freq * 3.98), startTime);

    const stopFund = this._scheduleClickFreeDecay(gFund.gain, startTime, peakGain, 0.008, duration);
    const stopOct = this._scheduleClickFreeDecay(
      gOct.gain,
      startTime,
      peakGain * 0.13,
      0.006,
      duration * 0.45
    );
    const stopWood = this._scheduleClickFreeDecay(
      gWood.gain,
      startTime,
      peakGain * 0.16,
      0.004,
      Math.min(0.10, duration * 0.22)
    );

    fund.connect(gFund).connect(toneFilter);
    octave.connect(gOct).connect(toneFilter);
    woodMode.connect(gWood).connect(toneFilter);
    toneFilter.connect(busIn);

    this._trackVoice(fund);
    this._trackVoice(octave);
    this._trackVoice(woodMode);

    fund.start(startTime);
    octave.start(startTime);
    woodMode.start(startTime);
    fund.stop(stopFund);
    octave.stop(stopOct);
    woodMode.stop(stopWood);
  }

  /**
   * Tactile horological C36000 brass & rosewood motorsport countdown pips (`3` -> `2` -> `1` -> `GO`).
   */
  playCountdownPip(step = 3) {
    if (!this.enabled) return;
    const isGo = step === "GO" || step === "GO!" || step === 0;
    this._logCue(isGo ? "countdownGo" : "countdownPip", 1.0, { step });
    this.resume();
    if (!this.ctx || !this._voiceBus()) return;

    const scale = this._voiceHeadroomScale();
    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();
        if (isGo) {
          this._scheduleBrassClick(ctx, busIn, t0, 1680, 3620, 0.056 * scale);
          this._playAcousticChimeTone(523.25, t0, 0.42, 0.058 * scale);          // C5
          this._playAcousticChimeTone(783.99, t0 + 0.024, 0.48, 0.054 * scale);  // G5
          this._playAcousticChimeTone(1046.50, t0 + 0.048, 0.62, 0.064 * scale); // C6
        } else {
          this._scheduleBrassClick(ctx, busIn, t0, 1420, 3040, 0.044 * scale);
          this._playAcousticChimeTone(523.25, t0, 0.24, 0.052 * scale);          // C5 crisp pip
        }
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * Subtle back-board collector brass/marimba lap chime when AI completes a lap.
   */
  playAiLapChime(lap = 1, isFinalLap = false) {
    if (!this.enabled) return;
    this._logCue("aiLapChime", isFinalLap ? 0.9 : 0.7, { lap });
    this.resume();
    if (!this.ctx || !this._voiceBus()) return;

    const scale = this._voiceHeadroomScale();
    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();
        this._scheduleBrassClick(ctx, busIn, t0, 1380, 2860, 0.028 * scale);
        this._playAcousticChimeTone(587.33, t0 + 0.02, 0.34, 0.036 * scale);        // D5
        this._playAcousticChimeTone(880.0, t0 + 0.09, 0.44, 0.038 * scale);         // A5
        if (isFinalLap) {
          this._playAcousticChimeTone(1174.66, t0 + 0.17, 0.58, 0.040 * scale);     // D6
        }
      } catch (_) {}
    }, this.lookaheadSec);
  }

  /**
   * Collector podium chord when a 5-lap race winner is crowned.
   */
  playRaceFinishFanfare(winner = "human") {
    if (!this.enabled) return;
    this._logCue("raceFinishFanfare", 1.0, { winner });
    this.resume();
    if (!this.ctx || !this._voiceBus()) return;

    const scale = this._voiceHeadroomScale();
    this.engine.scheduleLookahead((ctx, t0) => {
      try {
        const busIn = this._voiceBus();
        this._scheduleBrassClick(ctx, busIn, t0, 1580, 3420, 0.046 * scale);
        if (winner === "human") {
          this._playAcousticChimeTone(329.63, t0 + 0.02, 0.85, 0.050 * scale);  // E4
          this._playAcousticChimeTone(493.88, t0 + 0.10, 0.95, 0.054 * scale);  // B4
          this._playAcousticChimeTone(659.25, t0 + 0.19, 1.08, 0.060 * scale);  // E5
          this._playAcousticChimeTone(830.61, t0 + 0.29, 1.18, 0.056 * scale);  // G#5
          this._playAcousticChimeTone(987.77, t0 + 0.40, 1.32, 0.052 * scale);  // B5
        } else {
          this._playAcousticChimeTone(440.0, t0 + 0.03, 0.68, 0.044 * scale);   // A4
          this._playAcousticChimeTone(523.25, t0 + 0.13, 0.76, 0.044 * scale);  // C5
          this._playAcousticChimeTone(659.25, t0 + 0.24, 0.92, 0.048 * scale);  // E5
        }
      } catch (_) {}
    }, this.lookaheadSec);
  }
}
