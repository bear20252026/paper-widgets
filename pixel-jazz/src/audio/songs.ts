/* ------------------------------------------------------------------
   Tiny music theory + song data for the Pixel Jazz Band.
   Notation format:  "C#5:1.5  A4:.5  _:1  A4+C#5+E5:2"
     note = letter[#|b] + octave,  ':' + duration in beats,
     '+' stacks simultaneous notes (chords), '_' = rest.
   Each bar string is auto-normalised to 4 beats (pads or scales).
-------------------------------------------------------------------*/

export type Note = { t: number; d: number; p: number; v: number };
export type DrumHit = { t: number; k: 'kick' | 'snare' | 'hat' | 'ride' | 'crash' | 'rim'; v: number };
export type Track = {
  inst: 'bass' | 'lead' | 'flute' | 'guitar' | 'synth' | 'pad' | 'voice';
  notes: Note[];
  gain: number;
  muted?: boolean;
};
export type Song = {
  id: string;
  title: string;
  artist: string;
  note: string;
  source?: 'upload';
  duration?: number;
  bpm: number;
  swing: number; // 0 = straight, 0.68 = heavy shuffle
  bars: number;
  key: string;
  tempoFeel: string;
  tracks: Track[];
  drums: DrumHit[];
  chords: Chord[]; // one entry per bar
};

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(name: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name.trim());
  if (!m) return 60;
  const semi = LETTER[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return (parseInt(m[3], 10) + 1) * 12 + semi;
}
export function midiToFreq(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}
export function midiName(m: number) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return names[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}

/* ---------------- chords ---------------- */
export type Chord = { root: number; tones: number[]; name: string; beat: number };

const QUAL: Record<string, number[]> = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus: [0, 5, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  M7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  min7: [0, 3, 7, 10],
  '7sus': [0, 5, 7, 10],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  '9': [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  '6/9': [0, 4, 7, 9, 14],
  add9: [0, 4, 7, 14],
};

export function parseChord(label: string, beat = 0): Chord {
  const normalized = label.replace(':', '');
  const m = /^([A-G])([#b]?)(maj7|m7b5|7sus|sus4|add9|dim7|6\/9|m9|m7|m6|maj|min7|min|dim|aug|sus|m|9|7|6)?(?:\/([A-G][#b]?))?$/.exec(normalized);
  let root = 9,
    qual = '',
    bass = -1;
  if (m) {
    root = LETTER[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    qual = m[3] || '';
    if (m[4]) bass = LETTER[m[4][0]] + (m[4][1] === '#' ? 1 : m[4][1] === 'b' ? -1 : 0);
  }
  const tones = (QUAL[qual] || QUAL['']).map((i) => root + i);
  const c: Chord = { root, tones, name: label, beat };
  (c as any).bass = bass;
  return c;
}

/* ---------------- bar / track builders ---------------- */
function parseBar(str: string, startBeat: number, swing: number): Note[] {
  const toks = str.trim().split(/\s+/).filter(Boolean);
  const raw: { notes: number[]; d: number }[] = [];
  for (const tk of toks) {
    const [np, dur] = tk.split(':');
    const d = dur ? parseFloat(dur) : 1;
    if (/^_+$/.test(np)) raw.push({ notes: [], d });
    else raw.push({ notes: np.split('+').map(noteToMidi), d });
  }
  let total = raw.reduce((s, r) => s + r.d, 0) || 1;
  const scale = Math.abs(total - 4) > 1e-6 ? 4 / total : 1;
  const out: Note[] = [];
  let cur = startBeat;
  for (const r of raw) {
    const d = r.d * scale;
    for (const p of r.notes) {
      let t = cur;
      if (swing > 0) {
        const frac = ((t % 1) + 1) % 1;
        if (Math.abs(frac - 0.5) < 0.01) t = Math.floor(t) + 0.5 + swing * 0.5;
        else if (Math.abs(frac - 0.0) > 1e-6 && Math.abs(frac - 0.5) > 1e-6) {
          // 16ths: nudge the "a" of each beat
          if (Math.abs(frac - 0.75) < 0.01) t = Math.floor(t) + 0.75 + swing * 0.12;
        }
      }
      out.push({ t, d: Math.max(0.09, d * 0.94), p, v: 1 });
    }
    cur += d;
  }
  return out;
}

/** build a note list from an array of bar strings (index 0 = bar `from`) */
export function line(bars: string[], from = 0, swing = 0): Note[] {
  const out: Note[] = [];
  bars.forEach((b, i) => {
    if (b.trim() === '_' || b.trim() === '') return;
    out.push(...parseBar(b, (from + i) * 4, swing));
  });
  return out.sort((a, b) => a.t - b.t);
}

/** chord progression → array of Chord, one per bar (labels repeated as needed) */
export function prog(labels: string[], bars: number): Chord[] {
  const out: Chord[] = [];
  for (let i = 0; i < bars; i++) out.push(parseChord(labels[i % labels.length], i * 4));
  return out;
}

/** auto walking double-bass line from a chord progression */
export function walking(chords: Chord[], octave = 2): Note[] {
  const out: Note[] = [];
  chords.forEach((c, i) => {
    const bass = ((c as any).bass ?? -1) >= 0 ? 24 + ((c as any).bass) : 24 + c.root;
    const tones = c.tones.length ? c.tones : [0, 4, 7];
    const nxt = chords[(i + 1) % chords.length];
    const nxtRoot = ((nxt as any).bass ?? -1) >= 0 ? 24 + (nxt as any).bass : 24 + nxt.root;
    const scale = [0, 2, 4, 5, 7, 9, 11].map((s) => bass + s);
    const p = [
      bass,
      bass + tones[1 % tones.length],
      bass + 7,
      nxtRoot - 1 + (nxtRoot % 1 > 0 ? 0 : 0),
    ];
    const ap = nxtRoot + (nxtRoot > bass ? -1 : 1);
    const steps = [p[0], p[1], p[2], scale[(i * 3) % 7] > ap ? ap : ap];
    for (let b = 0; b < 4; b++) {
      let pitch = steps[b];
      if (b === 3) pitch = ap;
      out.push({ t: i * 4 + b, d: 0.92, p: pitch - 12 + octave * 12, v: b === 0 ? 1 : 0.78 });
    }
  });
  return out;
}

/** rootless shell / skank comping on the & of 2 and 4 */
export function comp(chords: Chord[], octave = 4, style: 'skank' | 'pad' = 'skank'): Note[] {
  const out: Note[] = [];
  chords.forEach((c, i) => {
    const tones = (c.tones.length >= 3 ? c.tones : [0, 4, 7]).slice(1);
    const voicing = tones.map((t) => c.root + t + octave * 12);
    if (style === 'pad') {
      voicing.forEach((p) => out.push({ t: i * 4, d: 3.9, p, v: 0.55 }));
      return;
    }
    [1.5, 3.5].forEach((off, k) => {
      voicing.forEach((p) => out.push({ t: i * 4 + off, d: 0.42, p: p + (k === 1 ? 0 : 0), v: 0.85 }));
    });
  });
  return out;
}

/** drum pattern from 16-char step strings ("x-o-") */
export function drums(bars: number, pat: { kick: string; snare: string; hat: string; ride?: string; }, perBar: string[] = []): DrumHit[] {
  const out: DrumHit[] = [];
  const add = (t: number, k: DrumHit['k'], v: number) => out.push({ t, k, v });
  for (let i = 0; i < bars; i++) {
    const barOverride = perBar[i];
    const b0 = i * 4;
    for (const key of ['kick', 'snare', 'hat', 'ride'] as const) {
      const s = (barOverride && key !== 'ride' ? barOverride : pat[key]) || '';
      if (!s) continue;
      for (let st = 0; st < 16; st++) {
        const ch = s[st];
        if (ch !== 'x' && ch !== 'o') continue;
        let beat = b0 + st * 0.25;
        const v = ch === 'x' ? 1 : 0.55;
        if (key === 'hat' || key === 'ride') {
          const frac = (st * 0.25) % 0.5;
          if (Math.abs(frac - 0.25) < 1e-6) beat += 0.09;
        }
        add(beat, key, v);
      }
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/* ==================================================================
   SONGS
==================================================================*/

const BARS = 28;
const TOM_CHORDS = [
  'Bm7', 'E7', 'A', 'D', 'Bm7', 'E7', 'F#m', 'D',
  'A', 'E/G#', 'F#m', 'D', 'A', 'E/G#', 'F#m', 'D',
  'F#m', 'D', 'A', 'E', 'Bm7', 'E7', 'A', 'F#m',
  'Bm7', 'E7', 'A', 'A',
];

const tomLead = [
  '________________', '________________', '________________', '________________',
  '_ C#5:0.75 C#5:0.75 A4:1 A4:0.5 F#4:0.5',
  'D4:0.5 G#4:0.75 G#4:0.75 B4:1 A4:1',
  'C#5:0.5 C#5:0.5 D5:1 C#5:1 A4:1',
  'F#4:0.5 G#4:0.5 A4:1 G#4:1 F#4:1',
  'D5:0.5 D5:0.5 C#5:1 B4:1 A4:1',
  'G#4:0.75 B4:1.25 A4:1 G#4:1',
  'F#4:0.5 A4:0.5 C#5:1 B4:0.5 A4:0.5 F#4:1',
  'D5:1 C#5:1.5 B4:1.5',
  'A5:1.5 E5:0.5 C#5:1 E5:1',
  'B4:0.5 E5:0.5 G#4:1 B4:1 C#5:1',
  'C#5:0.5 F#5:0.5 A5:2 G#4:1',
  'F#4:0.5 A4:0.5 D5:1 C#5:1 B4:1',
  'A5:1.5 E5:0.5 C#5:1 B4:1',
  'C#5:0.5 F#5:0.5 A5:1.5 G#5:1',
  'A4:0.75 C#5:0.75 B4:1 A4:1 F#4:1',
  'E5:1 D5:1 C#5:1 A4:1',
  'A4:0.25 C#5:0.25 E5:0.5 F#5:0.5 E5:0.25 C#5:0.25 A4:0.5 G#4:0.25 A4:1',
  'D5:0.5 C#5:0.25 A4:0.25 F#5:1 E5:0.5 C#5:0.5 D5:1',
  'E5:0.5 F#5:0.5 A5:1 G#5:1 F#5:0.5 E5:0.5 C#5:1',
  'B4:0.5 C#5:0.5 E5:0.5 F#5:0.5 A5:1 G#5:0.5 F#5:0.5 E5:1',
  'A5:1 C#5:1 A4:1 E5:1',
  'F#5:1 A5:1.5 E5:1.5',
  'C#5:1 F#5:1 A5:2',
  'A5:2 A5:2',
];

const tomFlute = [
  'A4:2 C#5:2', 'F#4:2 A4:2', 'E5:2 C#5:2', 'A4:2 F#5:2',
  '________________', '________________', '________________', '________________',
  '____ E5:1 F#5:1 E5:1 D5:1',
  '________________', '____ C#5:1 B4:1 A4:2',
  '________________',
  'A5:2 E5:2', '____ B4:1 C#5:1 D5:1 E5:1',
  '________', 'F#4:1 A4:1 C#5:2',
  'E5:2 C#5:1 D5:1', '________________',
  'A4:1 B4:1 C#5:1 D5:1 E5:1 F#5:1',
  '________________', 'A5:2 F#5:2', 'E5:2 D5:2',
  'C#5:2 E5:2', 'A4:2 C#5:2',
  'D5:1 E5:1 F#5:2', 'A5:4',
];

/** synth hook: driving 8th-note riff derived from each chord */
function hook(chords: Chord[], fromBar: number, toBar: number, octave = 5): Note[] {
  const out: Note[] = [];
  const rhy = [0, 0.5, 1, 1.25, 1.5, 2, 2.5, 3, 3.5];
  for (let i = fromBar; i <= toBar && i < chords.length; i++) {
    const c = chords[i];
    const t = c.tones.length ? c.tones : [0, 4, 7];
    const shape = [12, 7, 0, t[1] > 0 ? t[1] : 4, 12, t[1] > 0 ? t[1] : 4, 7, t[1] > 0 ? t[1] : 4, 0];
    rhy.forEach((b, k) => {
      out.push({ t: i * 4 + b, d: 0.42, p: 12 * octave + c.root + shape[k % shape.length], v: 0.72 });
    });
  }
  return out;
}

const SWING = 0.55;

export const TAKE_ON_ME: Song = (() => {
  const chords = prog(TOM_CHORDS, BARS);
  const lead = line(tomLead, 0, SWING);
  const synthNotes = hook(chords, 0, 3).concat(
    lead.map((n) => ({ ...n, p: n.p + 12, d: Math.min(n.d, 0.9), v: 0.42 })),
  );
  return {
    chords,
    id: 'take-on-me',
    title: 'Take On Me',
    artist: 'a-ha',
    note: 'Blue Note session arrangement · synth hook on the tiger, walking bass on the deer',
    bpm: 132,
    swing: SWING,
    bars: BARS,
    key: 'A major',
    tempoFeel: 'shuffle 4/4',
    tracks: [
      { inst: 'voice', notes: line(tomLead, 0, SWING), gain: 1 },
      { inst: 'synth', notes: synthNotes, gain: 0.75 },
      { inst: 'bass', notes: walking(chords, 2), gain: 1 },
      { inst: 'guitar', notes: comp(chords, 4, 'skank'), gain: 0.8 },
      { inst: 'flute', notes: line(tomFlute, 0, SWING), gain: 0.62 },
      { inst: 'pad', notes: comp(chords, 3, 'pad'), gain: 0.3 },
    ],
    drums: drums(BARS, { kick: 'o.....o.....o..o', snare: '----x-------x---', hat: 'o-o-o-o-o-o-o-oo', ride: 'x..x..x..x..x..x' }, ['x..x..x..x..x..x', '', '', 'x.x.xx.x.x.xxxx.']),
  };
})();

/* --------- original tune #2 : midnight at the blue note --------- */
const B2 = 28;
const MN_CHORDS = [
  'F:6/9', 'Bbm7', 'Eb9', 'Abmaj7', 'Dm7', 'Gm7', 'Cm7', 'F7',
  'Fmaj7', 'D7', 'Gm7', 'C7', 'Am7', 'Dm7', 'Gm7', 'C7',
  'Fmaj7', 'Ab7', 'Dbmaj7', 'C7', 'Bbm7', 'Eb9', 'Fmaj7', 'C7',
  'Fm6', 'Bb7', 'Eb7', 'Abmaj7',
];
const mnLead = [
  '____ A4:1.5 C5:0.5 Eb5:2',
  'D5:1 C5:1 Bb4:1.5 A4:0.5',
  'G4:0.5 A4:0.5 Bb4:1 A4:1 Eb5:1',
  'C5:2 Ab4:1 F4:1',
  '____ D5:1 Eb5:0.5 D5:0.5 C5:1 A4:1',
  'Bb4:1.5 C5:0.5 D5:1 Eb5:1',
  'G4:1 Ab4:1 Bb4:2',
  'A4:2 F4:1 C5:1',
  '____ Eb5:1 F5:1 Ab5:2',
  'G5:1.5 F5:0.5 Eb5:1 C5:1',
  'D5:1 Eb5:1 D5:1 Bb4:1',
  'A4:1 C5:1 Eb5:2',
  'F5:2 Eb5:1 C5:1',
  'Bb4:1 D5:1 F5:2',
  'Eb5:1.5 D5:0.5 C5:1 A4:1',
  'G4:1 A4:1 Bb4:2',
  'C5:2 Eb5:2',
  'D5:1 Bb4:1 Ab4:2',
  'F4:1 Ab4:1 C5:1 Db5:1',
  'Eb5:2 D5:2',
  '____ Bb4:1 C5:1 D5:1 Eb5:1',
  'F5:1 Eb5:1 D5:1 C5:1',
  'Bb5:2 Ab5:1 F5:1',
  'Eb5:1 C5:1 A4:2',
  'F5:2 Eb5:1 Bb4:1',
  'Ab5:1 G5:1 Eb5:2',
];
export const MIDNIGHT: Song = (() => {
  const chords = prog(MN_CHORDS, B2);
  return {
    chords,
    id: 'midnight',
    title: 'Midnight at the Blue Note',
    artist: 'the alley cats',
    note: 'Original ballad-turned-up-tempo · rubato flute intro, scat break for the owl',
    bpm: 112,
    swing: 0.66,
    bars: B2,
    key: 'F major',
    tempoFeel: 'medium swing',
    tracks: [
      { inst: 'voice', notes: line(mnLead, 0, 0.66), gain: 0.9 },
      { inst: 'flute', notes: line(mnLead, 0, 0.66).map((n) => ({ ...n, p: n.p + 12, v: n.v * 0.5 })), gain: 0.5 },
      { inst: 'bass', notes: walking(chords, 2), gain: 0.95 },
      { inst: 'guitar', notes: comp(chords, 4, 'skank'), gain: 0.85 },
      { inst: 'synth', notes: hook(chords, 8, 15, 4).map((n) => ({ ...n, v: n.v * 0.5 })), gain: 0.5 },
      { inst: 'pad', notes: comp(chords, 3, 'pad'), gain: 0.36 },
    ],
    drums: drums(B2, { kick: 'o.......o.....o.', snare: '----x-------x-x-', hat: 'o-o-o-o-o-o-ooo', ride: 'x...x...x...x...' }),
  };
})();

/* --------- original tune #3 : concrete jungle stomp --------- */
const B3 = 24;
const CJ_CHORDS = ['E7', 'E7', 'A7', 'A7', 'E7', 'E7', 'B7', 'B7', 'A7', 'A7', 'E7', 'E7', 'F7', 'Eb7', 'Bb7', 'Bb7', 'E7', 'A7', 'E7', 'B7', 'E7', 'A7', 'E7', 'E7'];
const cjLead = [
  '____ E4:0.5 G4:0.5 A4:0.5 B4:0.5 C5:1 B4:0.5 A4:1.5',
  'G4:0.5 A4:0.5 B4:1 A4:0.5 G4:0.5 E4:2',
  'A4:1 B4:1 C5:1 D5:1',
  'E5:1.5 D5:0.5 C5:1 A4:1',
  '____ C5:0.5 B4:0.5 A4:1 G4:0.5 A4:0.5 E4:1.5',
  'E4:0.5 G4:0.5 A4:1 B4:1 C5:1',
  'D5:1.5 B4:0.5 A4:1 G4:1',
  'F#4:1 A4:1 B4:2',
  'C5:1 D5:1 E5:1 D5:1',
  'C5:1 A4:1 G4:2',
  'E4:0.5 A4:0.5 B4:0.5 C5:0.5 D5:1 E5:1',
  'B4:2 E5:2',
  'A5:1 G5:1 E5:1 C5:1',
  'Bb4:1 D5:1 F5:2',
  'Eb5:2 D5:1 Bb4:1',
  'A4:1 Bb4:1 B4:2',
  'E5:0.5 G5:0.5 E5:0.5 A5:0.5 G5:1 E5:1',
  'D5:1 E5:1 C5:1 A4:1',
  'B4:1 C5:1 D5:2',
  'E5:2 D5:1 B4:1',
  'A4:0.5 B4:0.5 C5:1 B4:1 A4:1',
  'G4:1 A4:1 E4:2',
  'C5:1 D5:1 E5:1 G5:1',
  'E5:4',
];
export const CONCRETE: Song = (() => {
  const chords = prog(CJ_CHORDS, B3);
  return {
    chords,
    id: 'concrete',
    title: 'Concrete Jungle Stomp',
    artist: 'r.raccoon',
    note: '12-bar blues with a boogie guitar vamp · best heard with the note particles on',
    bpm: 152,
    swing: 0.5,
    bars: B3,
    key: 'E blues',
    tempoFeel: 'boogie',
    tracks: [
      { inst: 'voice', notes: line(cjLead, 0, 0.5), gain: 0.82 },
      { inst: 'synth', notes: line(cjLead, 0, 0.5).map((n) => ({ ...n, p: n.p - 12, v: n.v * 0.55 })), gain: 0.6 },
      { inst: 'bass', notes: walking(chords, 2).map((n) => ({ ...n, d: 0.5 })), gain: 1 },
      { inst: 'guitar', notes: hook(chords, 0, B3 - 1, 3).map((n) => ({ ...n, v: n.v * 0.8 })), gain: 0.9 },
      { inst: 'flute', notes: line(cjLead.slice(16, 24), 16, 0.5).map((n) => ({ ...n, p: n.p + 12, v: n.v * 0.6 })), gain: 0.6 },
      { inst: 'pad', notes: comp(chords, 3, 'pad'), gain: 0.26 },
    ],
    drums: drums(B3, { kick: 'x..o..x...x.o...', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-', ride: '' }),
  };
})();

export const SONGS: Song[] = [TAKE_ON_ME, MIDNIGHT, CONCRETE];

/* merged event list for the scheduler */
export type Ev = {
  t: number;
  kind: 'note' | 'drum';
  inst?: Track['inst'];
  p?: number;
  ps?: number[];
  d?: number;
  v: number;
  k?: DrumHit['k'];
};
export function buildEvents(song: Song): Ev[] {
  const out: Ev[] = [];
  for (const tr of song.tracks) {
    if (tr.muted) continue;
    for (const n of tr.notes) out.push({ t: n.t, kind: 'note', inst: tr.inst, p: n.p, d: n.d, v: n.v * tr.gain });
  }
  for (const dh of song.drums) out.push({ t: dh.t, kind: 'drum', k: dh.k, v: dh.v });
  return out.sort((a, b) => a.t - b.t);
}
export const songDuration = (s: Song) => s.duration ?? (s.bars * 4 * 60) / s.bpm;


/* ==================================================================
   Session generator — powers the “Add music” button. Builds a new
   chart (changes, melody, walking bass, comping, drums) from a feel,
   a tempo and a seed, so the player can add endless sets.
==================================================================*/
export type Feel = 'swing' | 'bossa' | 'boogie';

const FEELS: Record<Feel, { prog: string[]; scale: number[]; swing: number; key: string; label: string; drums: Parameters<typeof drums>[1]; hat: boolean }> = {
  swing: {
    prog: ['Cmaj7', 'Dm7', 'G7', 'Cmaj7', 'Am7', 'Dm7', 'G7', 'Cmaj7', 'Em7', 'A7', 'Dm7', 'G7', 'Cmaj7', 'A7', 'Dm7', 'G7', 'Fmaj7', 'Bm7b5', 'Em7', 'A7', 'Dm7', 'G7', 'Cmaj7', 'G7'],
    scale: [0, 2, 4, 5, 7, 9, 11],
    swing: 0.64,
    key: 'C major',
    label: 'medium swing',
    drums: { kick: 'o.......o.....o.', snare: '----x-------x-x-', hat: 'o-o-o-o-o-o-o-o-', ride: 'x---x---x---x---' },
    hat: false,
  },
  bossa: {
    prog: ['Fmaj7', 'Gm7', 'C7', 'Fmaj7', 'Am7', 'D7', 'Gm7', 'C7', 'Bbmaj7', 'Am7', 'Gm7', 'C7', 'Fmaj7', 'D7', 'Gm7', 'C7'],
    scale: [0, 2, 4, 5, 7, 9, 10],
    swing: 0.18,
    key: 'F major',
    label: 'bossa nova',
    drums: { kick: 'o...o...o...o...', snare: '--x---x---x---x-', hat: 'o-o-o-o-o-o-o-o-', ride: '' },
    hat: true,
  },
  boogie: {
    prog: ['C7', 'C7', 'C7', 'C7', 'F7', 'F7', 'C7', 'C7', 'G7', 'F7', 'C7', 'G7', 'C7', 'F7', 'C7', 'G7'],
    scale: [0, 3, 5, 6, 7, 10],
    swing: 0.5,
    key: 'C blues',
    label: 'boogie woogie',
    drums: { kick: 'x...x...x...x...', snare: '----x-------x---', hat: 'o-o-o-o-o-o-o-oo', ride: '' },
    hat: false,
  },
};

export function makeSession(opts: { title: string; bpm: number; feel: Feel; seed?: number; bars?: number }): Song {
  const bars = opts.bars ?? 24;
  const F = FEELS[opts.feel];
  const chords = prog(F.prog, bars);
  let seed = (opts.seed ?? Math.floor(Math.random() * 1e6)) >>> 0 || 7;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

  // melody: stepwise-ish lines with blue notes, rests and long tones
  const lead: Note[] = [];
  for (let b = 0; b < bars; b++) {
    let t = b * 4;
    let idx = Math.floor(rnd() * F.scale.length);
    const end = b * 4 + 4;
    while (t < end - 0.01) {
      if (rnd() < 0.16) {
        t += pick([0.5, 1]);
        continue;
      }
      let d = pick([0.5, 0.5, 0.75, 1, 1, 1.5, 2]);
      if (t + d > end) d = end - t;
      idx = Math.max(0, Math.min(F.scale.length - 1, idx + pick([-2, -1, -1, 0, 1, 1, 2])));
      const p = (rnd() < 0.28 ? 72 : 60) + F.scale[idx];
      lead.push({ t, d: Math.max(0.18, d * 0.92), p, v: 1 });
      t += d;
      if (rnd() < 0.14) t += 0.5;
    }
  }
  const leadNotes = lead.filter((n) => n.t < bars * 4).sort((a, b) => a.t - b.t);
  const chorus = leadNotes.filter((n) => n.p >= 64).map((n) => ({ ...n, d: Math.max(0.3, n.d), p: n.p - 12, v: 0.35 }));
  const names = ['the alley cats', 'the blue note quartet', 'r.raccoon & the night owls', 'the little club six'];
  return {
    id: `session-${Date.now()}`,
    title: opts.title.trim() || 'Basement Session',
    artist: pick(names),
    note: `Freshly generated ${F.label} chart in ${F.key} — changes, melody and drum feel built on the fly.`,
    bpm: opts.bpm,
    swing: F.swing,
    bars,
    key: F.key,
    tempoFeel: F.label,
    chords,
    tracks: [
      { inst: 'voice', notes: leadNotes, gain: 0.95 },
      { inst: 'synth', notes: chorus, gain: 0.55 },
      { inst: 'bass', notes: walking(chords, 2), gain: 1 },
      { inst: 'guitar', notes: comp(chords, 4, 'skank'), gain: 0.82 },
      { inst: 'flute', notes: leadNotes.filter((n) => n.d >= 1).map((n) => ({ ...n, p: n.p + 12, d: Math.min(1.2, n.d), v: 0.5 })), gain: 0.55 },
      { inst: 'pad', notes: comp(chords, 3, 'pad'), gain: 0.3 },
    ],
    drums: drums(bars, F.drums),
  };
}
