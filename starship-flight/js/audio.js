// Synthesised sound. Web Audio only: no samples, no files.
// Everything runs through a compressor and a soft limiter so it never clips.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.slow = 1; this.started = false; }
  start() {
    if (this.started) { this.ctx?.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.started = true;
    this.master = ctx.createGain(); this.master.gain.value = this.on ? 0.8 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.25;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    const out = ctx.createGain(); out.gain.value = 0.85;
    this.bus = ctx.createGain();
    this.bus.connect(comp); comp.connect(lim); lim.connect(out); out.connect(this.master); this.master.connect(ctx.destination);
    // noise buffers
    const len = ctx.sampleRate * 3;
    this.white = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.white.getChannelData(0);
    for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = this.brown.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this._engineBed();
  }
  setEnabled(v) { this.on = v; if (this.master) this.master.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.05); }
  setSlow(k) { this.slow = k; } // 1 = real time, 1/25 = slow motion
  get pitch() { return this.slow < 0.5 ? 0.55 : 1; }
  get stretch() { return this.slow < 0.5 ? 2.6 : 1; }

  _noise(buf = this.white) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); return s; }

  _engineBed() {
    const ctx = this.ctx;
    // broadband roar: brown + filtered white
    const n1 = this._noise(this.brown), n2 = this._noise(this.white);
    this.roarLP = ctx.createBiquadFilter(); this.roarLP.type = 'lowpass'; this.roarLP.frequency.value = 400; this.roarLP.Q.value = 0.3;
    this.crackBP = ctx.createBiquadFilter(); this.crackBP.type = 'bandpass'; this.crackBP.frequency.value = 1400; this.crackBP.Q.value = 0.6;
    this.roarGain = ctx.createGain(); this.roarGain.gain.value = 0;
    this.crackGain = ctx.createGain(); this.crackGain.gain.value = 0;
    n1.connect(this.roarLP); this.roarLP.connect(this.roarGain); this.roarGain.connect(this.bus);
    n2.connect(this.crackBP); this.crackBP.connect(this.crackGain); this.crackGain.connect(this.bus);
    // harmonic stack
    this.harm = []; this.harmGain = ctx.createGain(); this.harmGain.gain.value = 0;
    const hl = ctx.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 600;
    for (let i = 1; i <= 6; i++) {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle';
      const g = ctx.createGain(); g.gain.value = 0.22 / i;
      o.connect(g); g.connect(hl); o.start(); this.harm.push({ o, i });
    }
    hl.connect(this.harmGain); this.harmGain.connect(this.bus);
    // plasma hiss bed
    const n3 = this._noise(this.white);
    this.hissHP = ctx.createBiquadFilter(); this.hissHP.type = 'highpass'; this.hissHP.frequency.value = 2600;
    this.hissGain = ctx.createGain(); this.hissGain.gain.value = 0;
    n3.connect(this.hissHP); this.hissHP.connect(this.hissGain); this.hissGain.connect(this.bus);
    // descent whistle
    this.whOsc = ctx.createOscillator(); this.whOsc.type = 'sine'; this.whOsc.frequency.value = 900;
    const n4 = this._noise(this.white);
    this.whBP = ctx.createBiquadFilter(); this.whBP.type = 'bandpass'; this.whBP.Q.value = 9; this.whBP.frequency.value = 900;
    this.whGain = ctx.createGain(); this.whGain.gain.value = 0;
    n4.connect(this.whBP); this.whBP.connect(this.whGain); this.whOsc.connect(this.whGain); this.whGain.connect(this.bus);
    this.whOsc.start();
    for (const n of [n1, n2, n3, n4]) n.start();
  }

  // continuous update from telemetry. level 0..1 (engine count * throttle / 33), pr 0..1 ambient pressure
  update({ level = 0, engines = 0, pr = 1, distance = 300, hiss = 0, whistle = 0, whistleF = 900 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, p = this.pitch;
    const atten = Math.min(1, 400 / Math.max(120, distance));
    const air = 0.15 + 0.85 * pr; // sound fades as the air thins (at the camera this is stylised)
    const L = Math.min(1, level) * atten * air;
    this.roarGain.gain.setTargetAtTime(L * 0.9, t, 0.08);
    this.crackGain.gain.setTargetAtTime(L * 0.22, t, 0.08);
    this.roarLP.frequency.setTargetAtTime((180 + 520 * L) * p, t, 0.1);
    this.crackBP.frequency.setTargetAtTime(1300 * p, t, 0.2);
    const f0 = (24 + engines * 0.9) * (0.6 + 0.4 * Math.min(1, level * 1.2)) * p;
    for (const h of this.harm) h.o.frequency.setTargetAtTime(f0 * h.i * (1 + 0.003 * h.i), t, 0.12);
    this.harmGain.gain.setTargetAtTime(L * 0.35, t, 0.1);
    this.hissGain.gain.setTargetAtTime(hiss * 0.18, t, 0.3);
    this.hissHP.frequency.setTargetAtTime(2200 * p, t, 0.3);
    this.whGain.gain.setTargetAtTime(whistle * 0.12, t, 0.2);
    this.whOsc.frequency.setTargetAtTime(whistleF * p, t, 0.2);
    this.whBP.frequency.setTargetAtTime(whistleF * p, t, 0.2);
  }

  // ---------- one-shots ----------
  _burst({ dur = 0.3, f = 800, q = 1, type = 'bandpass', gain = 0.5, delay = 0, buf, decay = 3 }) {
    const ctx = this.ctx; const t0 = ctx.currentTime + delay * this.stretch;
    const s = ctx.createBufferSource(); s.buffer = buf || this.white;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f * this.pitch; fl.Q.value = q;
    const g = ctx.createGain();
    const D = dur * this.stretch;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + D);
    s.connect(fl); fl.connect(g); g.connect(this.bus);
    s.start(t0, Math.random()); s.stop(t0 + D + 0.05);
    void decay;
  }
  _tone({ f0, f1, dur, type = 'sine', gain = 0.4, delay = 0, attack = 0.005 }) {
    const ctx = this.ctx; const t0 = ctx.currentTime + delay * this.stretch; const D = dur * this.stretch;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0 * this.pitch, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1 * this.pitch), t0 + D);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + D);
    o.connect(g); g.connect(this.bus); o.start(t0); o.stop(t0 + D + 0.05);
  }
  _metal({ base = 320, gain = 0.3, dur = 1.6, delay = 0 }) {
    for (const r of [1, 2.76, 5.4, 8.93, 13.3]) this._tone({ f0: base * r, f1: base * r * 0.995, dur: dur / Math.sqrt(r), type: 'sine', gain: gain / r, delay });
    this._burst({ dur: 0.08, f: 3000, q: 0.8, gain: gain * 0.8, delay });
  }
  play(ev, ctx = {}) {
    if (!this.ctx || !this.on) return;
    const dist = ctx.distance ?? 300; const sd = Math.min(2.5, dist / 343); // speed of sound to camera
    switch (ev) {
      case 'arm': this._burst({ dur: 0.09, f: 180, q: 2, gain: 0.6, type: 'lowpass' }); this._tone({ f0: 95, f1: 60, dur: 0.12, gain: 0.4 }); break;
      case 'safe': this._burst({ dur: 0.06, f: 300, q: 2, gain: 0.35, type: 'lowpass' }); break;
      case 'stageClick': this._burst({ dur: 0.025, f: 2400, q: 3, gain: 0.35 }); this._burst({ dur: 0.02, f: 900, q: 2, gain: 0.25, delay: 0.035 }); break;
      case 'ui': this._burst({ dur: 0.02, f: 1800, q: 2, gain: 0.18 }); break;
      case 'ignition':
        this._burst({ dur: 0.18, f: 600, q: 1.5, gain: 0.7, delay: sd * 0.2 });         // pressure clank
        this._metal({ base: 140, gain: 0.25, dur: 0.6, delay: sd * 0.2 });
        this._tone({ f0: 70, f1: 28, dur: 1.4, gain: 0.85, delay: sd });                  // thump as the wave reaches the camera
        this._burst({ dur: 2.2, f: 220, q: 0.4, type: 'lowpass', gain: 0.55, delay: sd, buf: this.brown });
        break;
      case 'liftoff': this._tone({ f0: 55, f1: 32, dur: 1.8, gain: 0.5, delay: sd }); break;
      case 'maxq': this._burst({ dur: 0.8, f: 300, q: 0.7, gain: 0.25, type: 'lowpass', buf: this.brown }); break;
      case 'hot_staging':
        this._burst({ dur: 0.14, f: 2600, q: 0.7, gain: 0.8 });                          // separation crack
        this._burst({ dur: 0.6, f: 900, q: 0.5, gain: 0.45, delay: 0.05 });
        this._tone({ f0: 160, f1: 60, dur: 0.7, gain: 0.35, type: 'triangle', delay: 0.02 });
        break;
      case 'separation': this._metal({ base: 210, gain: 0.25, dur: 1.0 }); break;
      case 'landing_burn': this._burst({ dur: 0.9, f: 180, q: 0.5, type: 'lowpass', gain: 0.6, buf: this.brown, delay: sd * 0.5 }); break;
      case 'catch':
        this._metal({ base: 180, gain: 0.55, dur: 2.4, delay: sd * 0.4 });
        this._tone({ f0: 380, f1: 920, dur: 1.4, type: 'sawtooth', gain: 0.09, delay: 0.0 });   // servo whine
        this._tone({ f0: 60, f1: 35, dur: 0.6, gain: 0.6, delay: sd * 0.4 });
        break;
      case 'splash':
        this._burst({ dur: 1.6, f: 500, q: 0.5, type: 'lowpass', gain: 0.8, delay: sd * 0.3 });
        this._burst({ dur: 2.4, f: 2200, q: 0.3, type: 'bandpass', gain: 0.25, delay: sd * 0.3 + 0.1 });
        this._tone({ f0: 48, f1: 30, dur: 0.9, gain: 0.5, delay: sd * 0.3 });
        break;
      case 'lost':
        this._burst({ dur: 1.4, f: 260, q: 0.4, type: 'lowpass', gain: 0.9, buf: this.brown, delay: sd * 0.5 });
        this._burst({ dur: 0.3, f: 1800, q: 0.6, gain: 0.6, delay: sd * 0.5 });
        this._tone({ f0: 50, f1: 22, dur: 2.0, gain: 0.8, delay: sd * 0.5 });
        break;
      case 'cut': this._burst({ dur: 0.25, f: 700, q: 1, gain: 0.4 }); break;
    }
  }
  silence() { if (!this.ctx) return; const t = this.ctx.currentTime; this.roarGain.gain.setTargetAtTime(0, t, 0.03); this.harmGain.gain.setTargetAtTime(0, t, 0.03); this.crackGain.gain.setTargetAtTime(0, t, 0.03); }
}
