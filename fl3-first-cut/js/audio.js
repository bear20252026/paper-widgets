// Synthesised sound, scheduled from the simulation's own events. Works live (AudioContext)
// and offline (OfflineAudioContext) so a capture can be rendered from an event log.
import { MODELLED, PUBLISHED } from './sim.js';

export class EngineAudio {
  constructor(ctx) {
    this.ctx = ctx; this.enabled = true;
    const c = ctx;
    this.noise = this.makeNoise(2);
    this.master = c.createGain(); this.master.gain.value = 0.9;
    this.comp = c.createDynamicsCompressor();
    Object.assign(this.comp, {}); this.comp.threshold.value = -20; this.comp.knee.value = 12; this.comp.ratio.value = 5; this.comp.attack.value = 0.004; this.comp.release.value = 0.18;
    this.limit = c.createDynamicsCompressor(); this.limit.threshold.value = -3; this.limit.knee.value = 0; this.limit.ratio.value = 20; this.limit.attack.value = 0.001; this.limit.release.value = 0.08;
    this.out = c.createGain(); this.out.gain.value = 0.8;
    this.bus = c.createGain(); this.bus.gain.value = 1;
    this.bus.connect(this.comp); this.comp.connect(this.limit); this.limit.connect(this.out); this.out.connect(this.master); this.master.connect(c.destination);
    // exhaust colour: a short resonant pipe
    this.exBus = c.createBiquadFilter(); this.exBus.type = 'lowpass'; this.exBus.frequency.value = 900; this.exBus.Q.value = 0.7;
    const pipe = c.createBiquadFilter(); pipe.type = 'peaking'; pipe.frequency.value = 140; pipe.Q.value = 3; pipe.gain.value = 7;
    this.exBus.connect(pipe); pipe.connect(this.bus);
    // continuous layers
    this.blowerSrc = this.loopNoise(); this.blowerBp = c.createBiquadFilter(); this.blowerBp.type = 'bandpass'; this.blowerBp.Q.value = 0.8; this.blowerG = c.createGain(); this.blowerG.gain.value = 0;
    this.blowerSrc.connect(this.blowerBp); this.blowerBp.connect(this.blowerG); this.blowerG.connect(this.bus);
    this.blade = c.createOscillator(); this.blade.type = 'triangle'; this.bladeG = c.createGain(); this.bladeG.gain.value = 0; this.blade.connect(this.bladeG); this.bladeG.connect(this.bus);
    this.whirr = c.createOscillator(); this.whirr.type = 'sawtooth'; this.whirrF = c.createBiquadFilter(); this.whirrF.type = 'bandpass'; this.whirrF.Q.value = 4; this.whirrG = c.createGain(); this.whirrG.gain.value = 0;
    this.whirr.connect(this.whirrF); this.whirrF.connect(this.whirrG); this.whirrG.connect(this.bus);
    this.st = c.createOscillator(); this.st.type = 'sawtooth'; this.stF = c.createBiquadFilter(); this.stF.type = 'lowpass'; this.stF.frequency.value = 1400; this.stG = c.createGain(); this.stG.gain.value = 0;
    this.st.connect(this.stF); this.stF.connect(this.stG); this.stG.connect(this.bus);
    this.st2 = c.createOscillator(); this.st2.type = 'square'; this.st2G = c.createGain(); this.st2G.gain.value = 0; this.st2.connect(this.st2G); this.st2G.connect(this.stF);
    for (const o of [this.blade, this.whirr, this.st, this.st2]) o.start();
  }
  makeNoise(sec) {
    const b = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * sec), this.ctx.sampleRate); const d = b.getChannelData(0);
    let s = 12345; for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
    return b;
  }
  loopNoise() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(); return s; }
  setEnabled(on, when = this.ctx.currentTime) { this.enabled = on; this.master.gain.setTargetAtTime(on ? 0.9 : 0, when, 0.05); }

  // continuous layers follow speed. scale: time scale (1 or slow motion)
  update(sim, scale, when = this.ctx.currentTime) {
    const rpm = Math.max(0, sim.rpm), x = rpm / PUBLISHED.ratedRpm, k = Math.max(0.3, scale);
    const slowDeep = scale < 0.9 ? 0.55 + 0.45 * scale : 1;
    const bl = rpm * MODELLED.blowerRatio * scale;
    this.blowerBp.frequency.setTargetAtTime(300 + 2200 * x * scale, when, 0.05);
    this.blowerG.gain.setTargetAtTime(0.16 * Math.min(1.2, x * x) * k, when, 0.06);
    this.blade.frequency.setTargetAtTime(Math.max(20, bl * MODELLED.blowerBlades / 60), when, 0.04);
    this.bladeG.gain.setTargetAtTime(0.012 * Math.min(1, x * 1.4) * k, when, 0.06);
    const cam = rpm / 120 * scale;
    this.whirr.frequency.setTargetAtTime(Math.max(10, cam * 24), when, 0.04);
    this.whirrF.frequency.setTargetAtTime(Math.max(200, 900 + rpm * 1.2 * scale), when, 0.05);
    this.whirrG.gain.setTargetAtTime(0.018 * Math.min(1, x * 2) * k, when, 0.06);
    const sOn = sim.starter ? 1 : 0;
    const motor = Math.max(0, rpm) * 9.6 * scale * slowDeep; // starter armature
    this.st.frequency.setTargetAtTime(Math.max(30, motor / 60 * 6), when, 0.015);
    this.st2.frequency.setTargetAtTime(Math.max(20, motor / 60 * 3), when, 0.015);
    this.stG.gain.setTargetAtTime(0.06 * sOn, when, 0.03);
    this.st2G.gain.setTargetAtTime(0.03 * sOn, when, 0.03);
    this.stF.frequency.setTargetAtTime(500 + Math.min(2000, rpm * 5), when, 0.02);
  }

  burst(t, dur, f, q, gain, type = 'bandpass', dest = this.bus) {
    const c = this.ctx; const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 1;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }
  thump(t, f0, f1, dur, gain, dest = this.bus) {
    const c = this.ctx; const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }

  // one simulation event at audio time t
  event(ev, t, scale = 1) {
    if (t < this.ctx.currentTime - 0.01) return;
    const deep = scale < 0.9 ? 0.45 + 0.55 * scale : 1;
    const stretch = scale < 0.9 ? 1 + (1 - scale) * 2.2 : 1;
    switch (ev.type) {
      case 'evo': {
        const p = Math.max(0.6, ev.p || 2);
        const amp = Math.min(1, 0.18 + 0.12 * Math.sqrt(p)) * (ev.fired ? 1 : 0.35);
        this.thump(t, 150 * deep, 48 * deep, 0.07 * stretch, amp * 0.8, this.exBus);
        this.burst(t, 0.055 * stretch, 420 * deep, 0.9, amp * 0.9, 'bandpass', this.exBus);
        if ((ev.rpm || 0) < 1100 && ev.fired) this.burst(t + 0.018 * stretch, 0.012, 3200 * deep, 6, 0.05, 'bandpass'); // flapper tick
        break;
      }
      case 'fire': this.burst(t, 0.022 * stretch, 2400 * deep, 2.5, 0.07 + 0.05 * (ev.fuel || 0)); break;
      case 'misfire': this.burst(t, 0.03 * stretch, 1600 * deep, 1.5, ev.dry ? 0.015 : 0.05); break;
      case 'compress': if (ev.cranking) this.thump(t, 70 * deep, 45 * deep, 0.08, 0.12); break;
      case 'crank': this.clunk(t); break;
      case 'fuelcut': case 'keyoff': this.clunk(t, 0.6); break;
      case 'caught': break;
    }
  }
  clunk(t, g = 1) { this.thump(t, 110, 55, 0.09, 0.4 * g); this.burst(t, 0.04, 900, 1.2, 0.18 * g, 'lowpass'); this.burst(t + 0.002, 0.015, 3800, 4, 0.06 * g); }
  metal(t) { [523, 1187, 1870, 2711].forEach((f, i) => { const o = this.ctx.createOscillator(); o.frequency.value = f; const gg = this.ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(0.05 / (i + 1), t + 0.004); gg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2 - i * 0.2); o.connect(gg); gg.connect(this.bus); o.start(t); o.stop(t + 1.3); }); }
  seat(t) { this.thump(t, 95, 50, 0.14, 0.45); this.burst(t, 0.05, 700, 1, 0.15, 'lowpass'); }
}
