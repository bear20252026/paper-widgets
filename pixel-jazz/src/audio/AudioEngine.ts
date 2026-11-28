import { buildEvents, midiToFreq, songDuration, type Ev, type Song } from './songs';

export type Inst = 'bass' | 'lead' | 'flute' | 'guitar' | 'synth' | 'pad' | 'voice' | 'drums';

export type Live = {
  playing: boolean;
  external: boolean;
  time: number;
  duration: number;
  pos: number; // beats
  beat: number; // integer beat
  beatPhase: number; // 0..1 within beat
  barPhase: number;
  bpm: number;
  low: number;
  mid: number;
  high: number;
  vocal: number;
  level: number;
  onset: number; // 1 -> 0 pulse on detected beat
  onsetCount: number;
  detectedBpm: number;
  active: Record<string, number>; // instrument activity 0..1
  vocalGate: number;
  ready: boolean;
};

const EMPTY_ACTIVE: Record<string, number> = {
  bass: 0,
  drums: 0,
  flute: 0,
  guitar: 0,
  synth: 0,
  pad: 0,
  voice: 0,
};

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private comp!: DynamicsCompressorNode;
  private analyser!: AnalyserNode;
  private rev!: ConvolverNode;
  private revGain!: GainNode;
  private dly!: DelayNode;
  private dlyFb!: GainNode;
  private gains = new Map<Inst, GainNode>();
  private noise!: AudioBuffer;

  song: Song | null = null;
  private events: Ev[] = [];
  private ptr = 0;
  private startTime = 0;
  private startBeat = 0;
  private timer: number | null = null;
  private playRequest = 0;
  private scheduled: { t: number; nodes: AudioScheduledSourceNode[] }[] = [];
  private fileBuffers = new Map<string, AudioBuffer>();
  private fileSource: AudioBufferSourceNode | null = null;

  live: Live = {
    playing: false,
    external: false,
    time: 0,
    duration: 0,
    pos: 0,
    beat: 0,
    beatPhase: 0,
    barPhase: 0,
    bpm: 120,
    low: 0,
    mid: 0,
    high: 0,
    vocal: 0,
    level: 0,
    onset: 0,
    onsetCount: 0,
    detectedBpm: 0,
    active: { ...EMPTY_ACTIVE },
    vocalGate: 0,
    ready: false,
  };

  volume = 0.8;
  loop = true;
  /** static bus trims so the mix stays balanced regardless of the desk faders */
  readonly trims: Record<string, number> = {
    bass: 1,
    drums: 0.72,
    flute: 0.9,
    guitar: 0.85,
    synth: 0.9,
    pad: 0.85,
    voice: 1,
  };
  private freq = new Uint8Array(1024);
  private prevLow = 0;
  private fluxAvg = 0;
  private lastOnset = 0;
  private intervals: number[] = [];

  private clockTime() {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    let ctx: AudioContext;
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      console.warn('audio unavailable — running the silent dress rehearsal');
      this.live.ready = true;
      return null as any;
    }
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 3.2;
    this.comp.attack.value = 0.004;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.55;
    this.master.connect(this.comp).connect(this.analyser).connect(ctx.destination);

    // reverb (generated impulse)
    this.rev = ctx.createConvolver();
    this.rev.buffer = this.makeIR(2.6, 2.4);
    this.revGain = ctx.createGain();
    this.revGain.gain.value = 0.9;
    this.rev.connect(this.revGain).connect(this.master);

    // ping-pong-ish delay for the synth
    this.dly = ctx.createDelay(1.0);
    this.dly.delayTime.value = 0.28;
    this.dlyFb = ctx.createGain();
    this.dlyFb.gain.value = 0.34;
    const dlyLp = ctx.createBiquadFilter();
    dlyLp.type = 'lowpass';
    dlyLp.frequency.value = 2600;
    this.dly.connect(dlyLp).connect(this.dlyFb).connect(this.dly);
    dlyLp.connect(this.master);

    for (const k of ['bass', 'drums', 'flute', 'guitar', 'synth', 'pad', 'voice'] as Inst[]) {
      const g = ctx.createGain();
      g.gain.value = this.trims[k] ?? 1;
      g.connect(this.master);
      this.gains.set(k, g);
    }
    this.noise = this.makeNoise(2);
    this.live.ready = true;
    return ctx;
  }

  private makeIR(sec: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 60 ? i / 60 : 1);
      }
    }
    return buf;
  }
  private makeNoise(sec: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  async decodeFile(file: File) {
    const ctx = this.ensure();
    if (!ctx) throw new Error('Web Audio is not available in this browser.');
    try {
      return await ctx.decodeAudioData(await file.arrayBuffer());
    } catch {
      throw new Error('This audio format could not be decoded. Try an MP3, WAV or OGG file.');
    }
  }

  registerFile(id: string, buffer: AudioBuffer) {
    this.fileBuffers.set(id, buffer);
  }

  private stopFile() {
    if (!this.fileSource) return;
    this.fileSource.onended = null;
    try { this.fileSource.stop(); } catch { /* already ended */ }
    this.fileSource.disconnect();
    this.fileSource = null;
  }

  private startFile(at: number) {
    if (!this.ctx || !this.song) return;
    const buffer = this.fileBuffers.get(this.song.id);
    if (!buffer) return;
    this.stopFile();
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.master);
    src.start(at, Math.max(0, Math.min(this.live.time, buffer.duration - 0.02)));
    this.fileSource = src;
  }

  setSong(song: Song, keepPosition = false) {
    const pos = keepPosition ? this.live.pos : 0;
    this.stopVoices();
    this.stopFile();
    this.song = song;
    this.live.external = song.source === 'upload';
    this.events = buildEvents(song);
    this.live.bpm = song.bpm;
    this.live.duration = songDuration(song);
    this.live.pos = pos;
    this.live.time = (pos * 60) / song.bpm;
    this.live.active = { ...EMPTY_ACTIVE };
    this.live.onset = 0;
    this.live.onsetCount = 0;
    this.live.detectedBpm = 0;
    this.live.low = this.live.mid = this.live.high = this.live.vocal = this.live.level = 0;
    this.prevLow = 0;
    this.intervals = [];
    this.lastOnset = 0;
    this.ptr = this.lowerBound(pos);
    if (this.live.playing && this.ctx) {
      this.startTime = this.clockTime() + 0.06;
      this.startBeat = pos;
    }
  }
  private lowerBound(beat: number) {
    const ev = this.events;
    let lo = 0,
      hi = ev.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (ev[m].t < beat) lo = m + 1;
      else hi = m;
    }
    return lo;
  }

  async play() {
    const request = ++this.playRequest;
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    if (request !== this.playRequest) return;
    if (!this.song) return;
    if (this.live.time >= this.live.duration - 0.05 && !this.loop) this.seek(0);
    this.startBeat = this.live.pos; // beats
    this.startTime = this.clockTime() + 0.08;
    this.ptr = this.lowerBound(this.startBeat);
    this.live.playing = true;
    if (this.song.source === 'upload') this.startFile(this.startTime);
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 25);
    this.tick();
  }
  pause() {
    this.playRequest++;
    if (!this.live.playing) return;
    if (this.song && this.ctx) {
      const t = (this.ctx.currentTime - this.startTime) + this.startBeat * 60 / this.song.bpm;
      this.live.time = Math.max(0, Math.min(this.live.duration, t));
      this.live.pos = this.live.time * this.song.bpm / 60;
    }
    this.live.playing = false;
    this.stopVoices();
    this.stopFile();
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  toggle() {
    this.live.playing ? this.pause() : this.play();
  }
  seek(timeSec: number) {
    if (!this.song) return;
    const t = Math.max(0, Math.min(timeSec, this.live.duration));
    const beat = (t * this.song.bpm) / 60;
    this.live.time = t;
    this.live.pos = beat;
    this.stopVoices();
    this.stopFile();
    if (this.live.playing) {
      this.startBeat = beat;
      this.startTime = this.clockTime() + 0.05;
      this.ptr = this.lowerBound(beat);
      if (this.song.source === 'upload') this.startFile(this.startTime);
    }
  }
  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
  }
  setInstGain(inst: Inst, v: number) {
    const g = this.gains.get(inst);
    if (g && this.ctx) g.gain.setTargetAtTime(v * (this.trims[inst] ?? 1), this.ctx.currentTime, 0.05);
  }
  private stopVoices() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    for (const s of this.scheduled) {
      for (const n of s.nodes) {
        try {
          n.stop(now + 0.02);
        } catch {
          /* already stopped */
        }
      }
    }
    this.scheduled = [];
  }

  /* ---------------- scheduler ---------------- */
  private tick() {
    if (!this.song) return;
    if (this.song.source === 'upload') return;
    const now = this.clockTime();
    const spb = 60 / this.song.bpm;
    const ahead = now + 0.18;
    while (this.ptr < this.events.length) {
      const ev = this.events[this.ptr];
      const at = this.startTime + (ev.t - this.startBeat) * spb;
      if (at > ahead) break;
      if (at >= now - 0.02) {
        if (this.ctx) this.fire(ev, at, spb);
        else this.live.onset = ev.kind === 'drum' && ev.k === 'kick' ? 1 : this.live.onset;
      }
      this.ptr++;
    }
  }

  private fire(ev: Ev, at: number, spb: number) {
    if (ev.kind === 'drum') {
      this.drum(ev.k!, at, ev.v);
      return;
    }
    const p = ev.p!;
    switch (ev.inst) {
      case 'bass':
        this.vBass(p, at, ev.d! * spb, ev.v);
        break;
      case 'guitar':
        this.vGuitar(p, at, ev.d! * spb, ev.v);
        break;
      case 'flute':
        this.vFlute(p, at, ev.d! * spb, ev.v);
        break;
      case 'synth':
        this.vSynth(p, at, ev.d! * spb, ev.v);
        break;
      case 'pad':
        this.vPad(p, at, ev.d! * spb, ev.v);
        break;
      case 'voice':
      case 'lead':
        this.vVoice(p, at, ev.d! * spb, ev.v);
        break;
    }
  }

  private env(g: GainNode, at: number, a: number, d: number, s: number, r: number, peak: number, len: number) {
    const p = g.gain;
    p.cancelScheduledValues(at);
    p.setValueAtTime(0.0001, at);
    p.linearRampToValueAtTime(peak, at + a);
    p.exponentialRampToValueAtTime(Math.max(0.0002, peak * s), at + a + d);
    p.setValueAtTime(Math.max(0.0002, peak * s), Math.max(at + a + d, at + len - r));
    p.exponentialRampToValueAtTime(0.0001, at + len);
  }
  private track(nodes: AudioScheduledSourceNode[], at: number, dur: number) {
    this.scheduled.push({ t: at + dur, nodes });
    if (this.scheduled.length > 240) this.scheduled.splice(0, 60);
  }

  private vBass(p: number, at: number, dur: number, v: number) {
    const ctx = this.ctx!;
    const f = midiToFreq(p);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = f / 2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, at);
    lp.frequency.exponentialRampToValueAtTime(320, at + Math.max(0.08, dur * 0.7));
    lp.Q.value = 3;
    const g = ctx.createGain();
    const len = Math.max(0.16, dur);
    this.env(g, at, 0.012, 0.09, 0.62, 0.1, 0.5 * v, len);
    o.connect(lp);
    sub.connect(g);
    lp.connect(g).connect(this.gains.get('bass')!);
    o.start(at);
    sub.start(at);
    o.stop(at + len + 0.05);
    sub.stop(at + len + 0.05);
    this.track([o, sub], at, len);
  }

  private vGuitar(p: number, at: number, dur: number, v: number) {
    const ctx = this.ctx!;
    const f = midiToFreq(p);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(2600, at);
    lp.frequency.exponentialRampToValueAtTime(760, at + 0.25);
    const oscs: OscillatorNode[] = [];
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      oscs.push(o);
    }
    const len = Math.max(0.14, dur);
    lp.connect(g).connect(this.gains.get('guitar')!);
    this.env(g, at, 0.005, 0.05, 0.28, 0.12, 0.16 * v, len);
    oscs.forEach((o) => {
      o.start(at);
      o.stop(at + len + 0.05);
    });
    this.track(oscs, at, len);
  }

  private vFlute(p: number, at: number, dur: number, v: number) {
    const ctx = this.ctx!;
    const f = midiToFreq(p);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.99, at);
    o.frequency.linearRampToValueAtTime(f, at + 0.05);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.4;
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0, at);
    vibG.gain.linearRampToValueAtTime(9, at + Math.min(0.3, dur * 0.5));
    vib.connect(vibG).connect(o.frequency);
    const g = ctx.createGain();
    const len = Math.max(0.18, dur);
    this.env(g, at, 0.05, 0.12, 0.8, 0.14, 0.22 * v, len);
    // breath
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 4;
    bp.Q.value = 1.4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.03 * v, at);
    ng.gain.exponentialRampToValueAtTime(0.0008, at + 0.12);
    o.connect(g);
    n.connect(bp).connect(ng).connect(g);
    g.connect(this.gains.get('flute')!);
    const send = ctx.createGain();
    send.gain.value = 0.28;
    g.connect(send).connect(this.rev);
    [o, vib, n].forEach((x) => {
      x.start(at);
      x.stop(at + len + 0.06);
    });
    this.track([o, vib, n], at, len);
  }

  private vSynth(p: number, at: number, dur: number, v: number) {
    const ctx = this.ctx!;
    const f = midiToFreq(p);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(5200, at);
    lp.frequency.exponentialRampToValueAtTime(1500, at + Math.max(0.12, dur * 0.8));
    const oscs: OscillatorNode[] = [];
    for (const [type, det, amp] of [
      ['sawtooth', -9, 0.5],
      ['square', 8, 0.32],
      ['sawtooth', 50, 0.2],
    ] as [OscillatorType, number, number][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, at);
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = amp;
      o.connect(og).connect(lp);
      oscs.push(o);
    }
    const len = Math.max(0.12, dur);
    this.env(g, at, 0.008, 0.06, 0.62, 0.09, 0.2 * v, len);
    lp.connect(g).connect(this.gains.get('synth')!);
    const s = ctx.createGain();
    s.gain.value = 0.3;
    g.connect(s).connect(this.dly);
    oscs.forEach((o) => {
      o.start(at);
      o.stop(at + len + 0.04);
    });
    this.track(oscs, at, len);
  }

  private vPad(p: number, at: number, dur: number, v: number) {
    const ctx = this.ctx!;
    const f = midiToFreq(p);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1300;
    const len = Math.max(0.4, dur);
    this.env(g, at, 0.35, 0.4, 0.7, 0.5, 0.075 * v, len);
    const oscs: OscillatorNode[] = [];
    for (const det of [-7, 5]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      oscs.push(o);
    }
    lp.connect(g).connect(this.gains.get('pad')!);
    const s = ctx.createGain();
    s.gain.value = 0.5;
    g.connect(s).connect(this.rev);
    oscs.forEach((o) => {
      o.start(at);
      o.stop(at + len + 0.6);
    });
    this.track(oscs, at, len);
  }

  /** owl lead vocal: formant-filtered source + noise consonant */
  private vVoice(p: number, at: number, dur: number, v: number) {
    const ctx = this.ctx!;
    const f = midiToFreq(p);
    const len = Math.max(0.18, dur);
    const vowel = p % 4;
    const formants: [number, number, number][] =
      vowel === 0
        ? [[700, 6, 1], [1220, 8, 0.5], [2600, 10, 0.25]]
        : vowel === 1
          ? [[400, 6, 1], [1900, 9, 0.45], [2700, 10, 0.3]]
          : vowel === 2
            ? [[320, 6, 1], [1600, 9, 0.55], [2500, 10, 0.35]]
            : [[620, 6, 1], [1050, 8, 0.6], [2300, 10, 0.4]];
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(f * 0.985, at);
    src.frequency.exponentialRampToValueAtTime(f, at + 0.07);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.1;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, at);
    vg.gain.linearRampToValueAtTime(16, at + Math.min(0.4, len * 0.6));
    vib.connect(vg).connect(src.frequency);
    const body = ctx.createGain();
    body.gain.value = 1;
    formants.forEach(([fr, q, a]) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = fr;
      bp.Q.value = q;
      const fg = ctx.createGain();
      fg.gain.value = a;
      src.connect(bp).connect(fg).connect(body);
    });
    const g = ctx.createGain();
    this.env(g, at, 0.04, 0.1, 0.85, 0.16, 0.34 * v, len);
    body.connect(g).connect(this.gains.get('voice')!);
    const rv = ctx.createGain();
    rv.gain.value = 0.45;
    g.connect(rv).connect(this.rev);
    // breath / consonant
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const nb = ctx.createBiquadFilter();
    nb.type = 'bandpass';
    nb.frequency.value = 2200;
    nb.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.035 * v, at);
    ng.gain.exponentialRampToValueAtTime(0.0005, at + 0.09);
    n.connect(nb).connect(ng).connect(g);
    [src, vib, n].forEach((x) => {
      x.start(at);
      x.stop(at + len + 0.2);
    });
    this.track([src, vib, n], at, len);
  }

  private drum(kind: Ev['k'], at: number, v: number) {
    const ctx = this.ctx!;
    const out = this.gains.get('drums')!;
    const mk = () => {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      n.loop = true;
      return n;
    };
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, at);
      o.frequency.exponentialRampToValueAtTime(44, at + 0.13);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(0.85 * v, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + 0.36);
      this.track([o], at, 0.36);
    } else if (kind === 'snare' || kind === 'rim') {
      const n = mk();
      const bp = ctx.createBiquadFilter();
      bp.type = kind === 'rim' ? 'bandpass' : 'highpass';
      bp.frequency.value = kind === 'rim' ? 1900 : 1500;
      const g = ctx.createGain();
      const dec = kind === 'rim' ? 0.06 : 0.17;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime((kind === 'rim' ? 0.3 : 0.42) * v, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dec);
      const tone = ctx.createOscillator();
      tone.type = 'triangle';
      tone.frequency.setValueAtTime(kind === 'rim' ? 1500 : 195, at);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.16 * v, at);
      tg.gain.exponentialRampToValueAtTime(0.0001, at + dec * 0.7);
      n.connect(bp).connect(g).connect(out);
      tone.connect(tg).connect(out);
      n.start(at);
      tone.start(at);
      n.stop(at + dec + 0.05);
      tone.stop(at + dec + 0.05);
      this.track([n, tone], at, dec + 0.05);
    } else {
      const n = mk();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = kind === 'hat' ? 7600 : kind === 'ride' ? 5200 : 3200;
      const g = ctx.createGain();
      const dec = kind === 'hat' ? 0.055 : kind === 'ride' ? 0.42 : 1.1;
      const amp = kind === 'hat' ? 0.16 : kind === 'ride' ? 0.13 : 0.24;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(amp * v, at + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dec);
      n.connect(hp).connect(g).connect(out);
      const s = ctx.createGain();
      s.gain.value = kind === 'crash' ? 0.5 : 0.1;
      g.connect(s).connect(this.rev);
      n.start(at);
      n.stop(at + dec + 0.05);
      this.track([n], at, dec + 0.05);
    }
  }

  /* ---------------- analyser / beat detection ---------------- */
  update(nowSec: number) {
    const L = this.live;
    if (this.song && L.playing) {
      const spb = 60 / this.song.bpm;
      const beatPos = (this.clockTime() - this.startTime) / spb + this.startBeat;
      const dur = this.live.duration;
      L.time = Math.max(0, Math.min(dur, beatPos * spb));
      L.pos = Math.max(0, beatPos);
      if (beatPos * spb >= dur) {
        if (this.loop) {
          this.seek(0);
          this.play();
        } else {
          this.pause();
          L.time = dur;
        }
      }
    }
    L.beat = Math.floor(L.pos);
    L.beatPhase = L.pos - L.beat;
    L.barPhase = (L.pos % 4) / 4;
    L.bpm = this.song ? this.song.bpm : 0;

    if (this.ctx && this.live.ready) {
      this.analyser.getByteFrequencyData(this.freq as any);
      const f = this.freq;
      const avg = (a: number, b: number) => {
        let s = 0;
        for (let i = a; i <= b; i++) s += f[i];
        return s / ((b - a + 1) * 255);
      };
      const low = avg(1, 6);
      const mid = avg(8, 40);
      const high = avg(120, 320);
      const voc = avg(10, 46);
      const lvl = avg(1, 300);
      L.low += (low - L.low) * 0.35;
      L.mid += (mid - L.mid) * 0.3;
      L.high += (high - L.high) * 0.4;
      L.vocal += (voc - L.vocal) * 0.4;
      L.level += (lvl - L.level) * 0.3;
      // spectral-flux onset detection on the low band
      const flux = Math.max(0, low - this.prevLow);
      this.prevLow = low;
      this.fluxAvg = this.fluxAvg * 0.96 + flux * 0.04;
      if (flux > Math.max(0.035, this.fluxAvg * 1.7) && nowSec - this.lastOnset > 0.14) {
        if (this.lastOnset > 0) {
          this.intervals.push(nowSec - this.lastOnset);
          if (this.intervals.length > 10) this.intervals.shift();
          const sorted = [...this.intervals].sort((a, b) => a - b);
          const med = sorted[sorted.length >> 1] || 0.5;
          const bpm = 60 / med;
          L.detectedBpm = bpm > 45 && bpm < 220 ? Math.round(bpm) : L.detectedBpm;
        }
        this.lastOnset = nowSec;
        L.onset = 1;
        L.onsetCount++;
      }
      L.onset *= 0.82;

      // per instrument activity from the score (sample accurate enough for visuals)
      if (this.song?.source === 'upload') {
        const responsive = (value: number) => Math.min(1, value * 3.2);
        L.active.bass = Math.max(responsive(L.low), L.active.bass * 0.86);
        L.active.drums = Math.max(L.onset, responsive(L.high) * 0.7, L.active.drums * 0.82);
        L.active.guitar = Math.max(responsive(L.mid) * 0.9, L.active.guitar * 0.88);
        L.active.synth = Math.max(responsive(L.high), L.active.synth * 0.88);
        L.active.flute = Math.max(responsive(L.high) * 0.7, L.active.flute * 0.89);
        L.active.voice = Math.max(responsive(L.vocal), L.active.voice * 0.84);
        L.vocalGate = L.active.voice;
      } else if (this.song) {
        for (const tr of this.song.tracks) {
          const arr = tr.notes;
          let act = 0;
          for (let i = arr.length - 1; i >= 0; i--) {
            const n = arr[i];
            if (n.t <= L.pos && L.pos <= n.t + n.d) {
              act = 1;
              break;
            }
            if (n.t < L.pos - 2) break;
          }
          const prev = L.active[tr.inst] ?? 0;
          L.active[tr.inst] = Math.max(act, prev * 0.9);
        }
        const drumAct = Math.max(L.onset, Math.min(1, L.low * 2.4));
        L.active.drums = Math.max(drumAct, (L.active.drums ?? 0) * 0.84);
        L.vocalGate = L.active.voice > 0.5 ? Math.min(1, 0.35 + L.vocal * 2.2) : Math.max(0, (L.vocalGate ?? 0) - 0.08);
      }
    }
    return L;
  }

  dispose() {
    this.pause();
    this.stopFile();
    this.fileBuffers.clear();
    if (this.ctx) this.ctx.close();
    this.ctx = null;
    this.live.ready = false;
  }
}
