/** Generative score — every sound is synthesised live. Chords change on every camera cut. */
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
interface Part { root: number; prog: number[][]; lv: number; mel: number[] }
// lv = intensity (0 hushed … 3 full). One chord per camera shot (8 beats).
const SCORE: Part[] = [
  { root: 57, lv: 0, prog: [[0, 3, 7, 10], [-4, 0, 3, 7], [3, 7, 10, 14], [-2, 2, 5, 9]], mel: [3, -1, 2, -1, 1, -1, 2, 3] },
  { root: 60, lv: 3, prog: [[0, 3, 7, 10], [5, 8, 12, 15], [-4, 0, 3, 7], [-2, 2, 5, 10]], mel: [2, 3, -1, 1, 2, -1, 3, 1] },
  { root: 55, lv: 1, prog: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [2, 5, 9, 12]], mel: [3, -1, -1, 2, 1, -1, 2, -1] },
  { root: 62, lv: 2, prog: [[0, 4, 7, 11], [5, 9, 12, 16], [-3, 0, 4, 7], [7, 11, 14, 17]], mel: [1, 2, 3, -1, 2, 1, -1, 3] },
  { root: 58, lv: 1, prog: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -3, 0, 3], [-2, 2, 5, 9]], mel: [3, -1, 2, -1, -1, 1, -1, 2] },
  { root: 53, lv: 2, prog: [[0, 4, 7, 11], [-3, 0, 4, 7], [2, 5, 9, 12], [-5, -1, 2, 7]], mel: [2, -1, 3, 2, -1, 1, 3, -1] },
  { root: 57, lv: 1, prog: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [3, 7, 10, 14]], mel: [3, -1, 1, -1, 2, -1, -1, 3] },
  { root: 60, lv: 2, prog: [[0, 4, 7, 11], [-5, -1, 2, 7], [-3, 0, 4, 7], [5, 9, 12, 16]], mel: [3, 2, -1, 1, 3, -1, 2, 1] },
];

export class Score {
  ctx: AudioContext | null = null;
  muted = false;
  private master!: GainNode;
  private rev!: GainNode;
  private nb!: AudioBuffer;
  private rainGain!: GainNode;

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, ctx.currentTime, 0.6);
    this.master.connect(comp).connect(ctx.destination);
    // convolution reverb with a synthesised impulse response
    const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 2.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    conv.buffer = ir;
    this.rev = ctx.createGain(); this.rev.gain.value = 0.5;
    this.rev.connect(conv).connect(this.master);
    // rain bed
    this.nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), lg = ctx.createGain();
    src.buffer = this.nb; src.loop = true;
    bp.type = 'bandpass'; bp.frequency.value = 4600; bp.Q.value = 0.5;
    lp.type = 'lowpass'; lp.frequency.value = 380; lg.gain.value = 0.35;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0.05;
    src.connect(bp).connect(this.rainGain);
    src.connect(lp).connect(lg).connect(this.rainGain);
    this.rainGain.connect(this.master);
    src.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.08);
  }
  setRain(a: number) { if (this.ctx) this.rainGain.gain.setTargetAtTime(0.012 + a * 0.06, this.ctx.currentTime, 0.5); }

  private tone(type: OscillatorType, midi: number, t: number, a: number, dur: number, vol: number, cut: number, wet = 0.5, det = 0) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = hz(midi); o.detune.value = det; f.frequency.value = cut;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    o.connect(f).connect(g).connect(this.master);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(this.rev); }
    o.start(t); o.stop(t + a + dur + 0.05);
  }

  private noise(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType = 'highpass', q = 1, wet = 0, attack = 0.004) {
    const ctx = this.ctx!, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.nb; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    s.connect(f).connect(g).connect(this.master);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(this.rev); }
    s.start(t, Math.random()); s.stop(t + attack + dur + 0.05);
  }

  private kick(t: number, v: number) {
    const ctx = this.ctx!, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(128, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.32);
  }

  /** Swelling rain-wash before a scene cut. */
  private riser(t: number, dur: number) {
    const ctx = this.ctx!, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.nb; f.type = 'bandpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(5200, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    s.connect(f).connect(g).connect(this.master);
    const w = ctx.createGain(); w.gain.value = 0.6; g.connect(w).connect(this.rev);
    s.start(t, Math.random()); s.stop(t + dur + 0.1);
  }

  thunder() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.3;
    this.noise(t, 3, 0.55, 150, 'lowpass', 0.7, 0.4, 0.05);
    this.noise(t - 0.2, 0.4, 0.1, 1100, 'bandpass', 0.6, 0.7);
  }

  /** Called on every beat. lb = beat within the scene (0..31). */
  beat(scene: number, lb: number, bd: number) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const P = SCORE[scene % SCORE.length], t = ctx.currentTime + 0.03, sh = Math.floor(lb / 8) % 4, q = lb % 8;
    const chord = P.prog[sh], root = P.root, lv = P.lv, half = bd / 2;
    if (q === 0) {
      chord.forEach((n, i) => {
        this.tone('sawtooth', root + n, t, 0.6, bd * 8.2, 0.02, 600 + lv * 220, 0.6, i % 2 ? 8 : -8);
        this.tone('triangle', root + n + 12, t, 0.5, bd * 7, 0.014, 2400, 0.6);
      });
      this.tone('sine', root + chord[0] - 24, t, 0.03, bd * 7.5, 0.2, 380, 0.05);
      if (lb === 0) { // scene downbeat shimmer
        this.tone('sine', root + chord[0] + 36, t, 0.005, 3, 0.05, 9000, 1);
        this.tone('sine', root + chord[0] + 43, t, 0.005, 3, 0.035, 9000, 1);
      }
    }
    if (q === 4 && lv > 0) this.tone('triangle', root + chord[0] - 12, t, 0.01, bd * 1.6, 0.09, 320, 0.1);
    if (lv === 0 ? q % 4 === 0 : lv === 1 ? q % 2 === 0 : true) this.kick(t, q % 4 === 0 ? 0.42 : 0.24);
    if (lv >= 2 && q % 2 === 1) this.noise(t, 0.16, 0.06, 1800, 'bandpass', 0.8, 0.3);
    if (lv >= 1) this.noise(t + half, 0.05, 0.03, 7500);
    if (lv >= 3) this.noise(t + half * 0.5, 0.03, 0.018, 9500);
    // droplet arpeggio — two 8th notes per beat
    const pat = [[0, 2, 1, 3], [3, 1, 2, 0], [0, 1, 2, 3], [2, 0, 3, 1]][scene % 4];
    for (let k = 0; k < 2; k++) {
      const n = chord[pat[(q * 2 + k) % 4]] + 12 + (k && q % 4 === 3 ? 12 : 0);
      this.tone('triangle', root + n, t + k * half, 0.005, 0.7, 0.08, 3200, 0.6);
    }
    // bell melody
    const me = P.mel[(q + sh * 3) % 8];
    if (me >= 0 && (lv > 1 || q % 2 === 0)) this.tone('sine', root + chord[me] + 24, t, 0.005, 1.4, 0.042, 9000, 0.9);
    if (lb === 30) this.riser(t, bd * 2);
  }

  dispose() { this.ctx?.close(); this.ctx = null; }
}
