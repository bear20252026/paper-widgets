/** Sable Radio — a small generative pad. Each release on the platter retunes the chord. */
const ROOTS = [45, 48, 43, 50, 41, 46, 52, 47];
const SHAPES = [
  [0, 7, 12, 16, 23],
  [0, 7, 12, 15, 22],
  [0, 7, 14, 16, 21],
  [0, 5, 12, 15, 19],
];

function chord(i: number) {
  const root = ROOTS[i % ROOTS.length];
  return SHAPES[i % SHAPES.length].map((n) => 440 * Math.pow(2, (root + n - 69) / 12));
}

export class Radio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private oscs: OscillatorNode[][] = [];

  start(i: number): boolean {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    this.ctx = ctx;
    const t = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(0.17, t + 2.5);
    master.connect(ctx.destination);
    this.master = master;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 950;
    lp.Q.value = 0.4;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 380;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();

    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.36;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    lp.connect(master);
    lp.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(master);

    this.oscs = chord(i).map((f, n) => {
      const g = ctx.createGain();
      g.gain.value = n === 0 ? 0.16 : 0.1;
      g.connect(lp);
      // slow, independent swell per voice so the chord breathes
      const sw = ctx.createOscillator();
      sw.frequency.value = 0.05 + n * 0.017;
      const sg = ctx.createGain();
      sg.gain.value = 0.045;
      sw.connect(sg).connect(g.gain);
      sw.start();
      return (['sine', 'triangle'] as OscillatorType[]).map((type, k) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = k ? 6 : -5;
        o.connect(g);
        o.start();
        return o;
      });
    });
    return true;
  }

  setRelease(i: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    chord(i).forEach((f, n) => this.oscs[n]?.forEach((o) => o.frequency.setTargetAtTime(f, ctx.currentTime, 0.45)));
  }

  stop() {
    const ctx = this.ctx;
    const master = this.master;
    this.ctx = null;
    this.master = null;
    this.oscs = [];
    if (!ctx || !master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.18);
    window.setTimeout(() => void ctx.close().catch(() => undefined), 900);
  }
}
