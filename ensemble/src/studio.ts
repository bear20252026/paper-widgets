// Ensemble — live performance studio powered by Genie 4 on the Gemini API.

import { STICKERS } from './stickers.js';
import type { StudioKeyHooks } from './types';

export function isApiKeyError(statusOrCode?: number, message = ''): boolean {
  if (statusOrCode === 401 || statusOrCode === 403 || statusOrCode === 404) return true;
  const m = (message || '').toLowerCase();
  return (
    m.includes('requested entity was not found') ||
    m.includes('api key') ||
    m.includes('api_key') ||
    m.includes('permission_denied') ||
    m.includes('permission denied') ||
    m.includes('unauthenticated') ||
    m.includes('unauthorized') ||
    m.includes('invalid key') ||
    m.includes('missing gemini api key') ||
    m.includes('billing') ||
    m.includes('allowlist')
  );
}

const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) =>
  r.querySelector(s) as T | null;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) =>
  [...r.querySelectorAll(s)] as T[];
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, txt?: string | null) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const GOOGLE_API_HTTPS = 'https://generativelanguage.googleapis.com';
const GOOGLE_API_WSS = 'wss://generativelanguage.googleapis.com';
const useBrowserGoogleProxy = () => Boolean(window.aistudio);
const DIRECTOR_SYS = `You are the music director for a real-time audio-video world model (Genie 4). Rewrite the draft into ONE vivid paragraph (90-140 words) that will be its world prompt.
Keep every instrument, voice, genre, tempo, venue and mood from the draft. Prioritise SOUND: name each instrument's role (bass, rhythm, harmony, melody, solo), the groove and tempo, dynamics, the mix and acoustic space, and a musical arc across one minute (intro → build → peak → resolve).
Also describe what the camera sees: the musicians playing those exact instruments on that stage, lighting, slow camera moves. Present tense. No lists, no markdown, no quotation marks, no dialogue or lyrics.`;

const LIVE_WS = () =>
  useBrowserGoogleProxy()
    ? `${GOOGLE_API_WSS}/v1beta/interactions/live`
    : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/live`;

/* ============ Data ============ */
const CATS: Record<string, { label: string; c: string; em: string }> = {
  instrument: { label: 'Instrument', c: 'var(--amber)', em: '🎻' },
  beat:       { label: 'Beat',       c: 'var(--coral)', em: '🥁' },
  style:      { label: 'Style',      c: 'var(--violet)', em: '🎼' },
  singer:     { label: 'Singer',     c: 'var(--rose)', em: '🎤' },
  tone:       { label: 'Tone',       c: 'var(--teal)', em: '🎛️' },
  mood:       { label: 'Mood',       c: 'var(--sky)', em: '🌙' },
  venue:      { label: 'Venue',      c: 'var(--lime)', em: '🏛️' },
  fx:         { label: 'Ambience',   c: 'var(--fog)', em: '🌧️' },
};

const INSTRUMENTS: Array<[string, string, string]> = [
  ['tuba', 'Tuba', 'a warm, round tuba laying down a bouncing bassline'],
  ['flute', 'Flute', 'an airy, fluttering flute melody dancing on top'],
  ['drum_kit', 'Drums', 'a tight drum kit groove with a snappy snare and shimmering cymbals'],
  ['electric_guitar', 'Electric Guitar', 'a glassy electric guitar playing rhythmic, funky chops'],
  ['grand_piano', 'Grand Piano', 'rich grand piano chords with expressive runs'],
  ['acoustic_guitar', 'Acoustic Guitar', 'a fingerpicked acoustic guitar, bright and woody'],
  ['violin', 'Violin', 'a soaring, singing violin line'],
  ['cello', 'Cello', 'a deep bowed cello carrying a soulful countermelody'],
  ['saxophone', 'Saxophone', 'a breathy, smoky saxophone improvising'],
  ['trumpet', 'Trumpet', 'a bright, punchy trumpet with bold fanfares'],
  ['synthesizer', 'Synth', 'lush analog synth pads and a warm sawtooth lead'],
  ['drum_machine', '808', 'a booming 808 drum machine with deep sub kicks and ticking hats'],
  ['harp', 'Harp', 'shimmering harp glissandos and plucked arpeggios'],
  ['double_bass', 'Upright Bass', 'a plucked upright bass walking with a woody thump'],
  ['congas', 'Congas', 'hand-played congas adding rolling, syncopated percussion'],
  ['turntable', 'Turntables', 'a DJ scratching vinyl and dropping rhythmic samples'],
  ['microphone', 'Vocals', 'a lead vocalist singing a soulful, wordless melody'],
  ['clarinet', 'Clarinet', 'a woody, playful clarinet weaving through the melody'],
  ['french_horn', 'French Horn', 'noble French horn swells, round and heroic'],
  ['accordion', 'Accordion', 'a romantic accordion breathing lilting chords'],
  ['banjo', 'Banjo', 'a rolling, twangy banjo picking pattern'],
  ['sitar', 'Sitar', 'a resonant sitar with buzzing, bending drone notes'],
  ['marimba', 'Marimba', 'mellow wooden marimba patterns, rippling and hypnotic'],
  ['handpan', 'Handpan', 'a meditative steel handpan ringing with soft overtones'],
];

const GENRES = ['Jazz', 'Neo-Soul', 'Lo-fi Hip-hop', 'Funk', 'Orchestral', 'Cinematic', 'Synthwave', 'Afrobeat', 'Bossa Nova', 'House', 'Ambient', 'Flamenco', 'Gospel', 'Blues', 'Rock', 'Reggae', 'Drum & Bass', 'Folk', 'Classical', 'K-pop', 'Celtic', 'Trap'];
const VENUES: Record<string, string> = {
  'Smoky Jazz Club': 'a dim, smoky jazz club at midnight, amber lamps glowing over a tiny stage',
  'Rooftop at Dusk': 'a city rooftop at dusk, skyline lights flickering on behind the band',
  'Gothic Cathedral': 'a vast gothic cathedral, candlelight and stained glass, reverberant stone',
  'Neon Warehouse': 'a cavernous neon-lit warehouse, haze and laser beams cutting the air',
  'Forest Clearing': 'a moonlit forest clearing ringed with lanterns and fireflies',
  'Tokyo Alley': 'a narrow Tokyo alley at night, paper lanterns and rain-slick streets',
  'Grand Concert Hall': 'a grand golden concert hall with red velvet seats',
  'Desert Campfire': 'a desert campfire under a sky thick with stars',
  'Underwater Dome': 'a glass dome on the ocean floor, fish drifting past the stage',
  'Subway Platform': 'a tiled subway platform, trains rushing by in the background',
  'Beach at Sunset': 'a beach at sunset, waves rolling in behind the stage',
};
const ERAS: Record<string, string> = { '1920s': 'in the roaring 1920s', '1950s': 'in the 1950s', '1970s': 'in the 1970s, all warm film grain', '1980s': 'in the neon 1980s', '1990s': 'in the 1990s', 'Today': 'today', 'Year 2080': 'in a luminous future, the year 2080' };

interface LibEntry {
  cat: string;
  label: string;
  desc: string;
  em?: string;
  sticker?: string;
  free?: boolean;
}

const LIB: LibEntry[] = [
  ['instrument','Rhodes Piano','a velvety Rhodes electric piano with gentle tremolo','🎹'],['instrument','Hammond Organ','a swirling Hammond organ through a Leslie speaker','🎹'],
  ['instrument','Electric Bass','a deep, round electric bass locked to the kick','🎸'],['instrument','Steel Drums','bright Caribbean steel drums ringing out','🥁'],
  ['instrument','Kalimba','a delicate kalimba plinking music-box patterns','🎶'],['instrument','Tabla','tabla drums with quick, expressive bols','🪘'],
  ['instrument','Koto','a plucked Japanese koto, crystalline and poised','🎶'],['instrument','Theremin','an eerie, swooping theremin','📡'],
  ['instrument','Bagpipes','droning Highland bagpipes','🎶'],['instrument','Didgeridoo','a buzzing, circular-breathed didgeridoo','🎶'],
  ['instrument','Pipe Organ','a thundering cathedral pipe organ','⛪'],['instrument','Vibraphone','a shimmering vibraphone with soft mallets','🎶'],
  ['instrument','Ukulele','a strummed, sunny ukulele','🎸'],['instrument','Mandolin','a tremolo-picked mandolin','🎸'],
  ['instrument','Oud','an oud tracing ornate Middle-Eastern phrases','🎸'],['instrument','String Quartet','a string quartet playing lush harmonies','🎻'],
  ['instrument','Brass Section','a tight, punchy brass section with stabs','🎺'],['instrument','Glockenspiel','a twinkling glockenspiel','✨'],
  ['instrument','Tambourine','a jangling tambourine on the off-beats','🔔'],['instrument','Bongos','bongos chattering quick fills','🪘'],
  ['beat','Boom-bap','a dusty boom-bap groove with a heavy kick and crisp snare','🥁'],['beat','Four-on-the-floor','a pulsing four-on-the-floor kick','🥁'],
  ['beat','Swing Ride','a swinging ride-cymbal pattern with feathered kick','🥁'],['beat','Bossa Clave','a gentle bossa nova clave rhythm','🥁'],
  ['beat','Trap Hats','rattling trap hi-hat rolls over deep 808s','🥁'],['beat','Breakbeat','a chopped, funky breakbeat','🥁'],
  ['beat','Afrobeat Polyrhythm','interlocking Afrobeat polyrhythms','🥁'],['beat','Half-time Shuffle','a lazy half-time shuffle','🥁'],
  ['beat','Brushed Snare','soft brushes sweeping a snare','🥁'],['beat','Marching Snare','a crisp marching snare cadence','🥁'],
  ['beat','Waltz 3/4','a lilting waltz in three','🥁'],['beat','Dembow','a reggaeton dembow bounce','🥁'],
  ['singer','Soulful Diva','a soulful female lead with powerful, gospel-tinged runs','🎤'],['singer','Velvet Crooner','a velvet baritone crooner, smooth and intimate','🎤'],
  ['singer','Gospel Choir','a full gospel choir lifting the chorus','🙌'],['singer','Falsetto R&B','a silky falsetto R&B vocal','🎤'],
  ['singer','Dreamy Whisper','breathy, whispered dream-pop vocals','🎤'],['singer','Opera Soprano','a soaring operatic soprano','🎭'],
  ['singer','Rapper','a confident rapper riding the beat with a tight flow','🎤'],['singer','Scat Singer','a playful scat singer trading phrases with the band','🎤'],
  ['singer','Wordless Hum','a warm, wordless humming melody','🎤'],['singer','Throat Singing','resonant Tuvan throat singing','🎤'],
  ['style','Jazz Fusion','jazz fusion','🎼'],['style','Film Score','a sweeping film score','🎬'],['style','Disco','glittering disco','🪩'],
  ['style','Motown','classic Motown soul','🎼'],['style','Chillwave','hazy chillwave','🌊'],['style','Tango','dramatic tango','💃'],
  ['tone','Warm Analog Tape','warm, saturated analog tape','📼'],['tone','Crisp Hi-Fi','crisp, pristine hi-fi','💎'],['tone','Lo-fi Vinyl','dusty lo-fi vinyl with gentle crackle','💿'],
  ['tone','Dark & Moody','dark and moody','🌑'],['tone','Bright & Airy','bright and airy','☀️'],['tone','Gritty Overdrive','gritty and overdriven','🔥'],
  ['tone','Lush Reverb','drenched in lush reverb','🌫️'],['tone','Dry & Intimate','dry and intimate, every breath audible','🕯️'],
  ['mood','Euphoric','euphoric','✨'],['mood','Melancholic','melancholic','🌧️'],['mood','Triumphant','triumphant','🏆'],['mood','Nostalgic','nostalgic','📷'],
  ['mood','Mysterious','mysterious','🌙'],['mood','Romantic','romantic','🌹'],['mood','Playful','playful','🎈'],['mood','Hypnotic','hypnotic','🌀'],
  ['fx','Rain on Windows','soft rain pattering on windows','🌧️'],['fx','Crowd Cheering','a crowd cheering and clapping along','👏'],
  ['fx','Distant Thunder','distant rolling thunder','⛈️'],['fx','Ocean Waves','ocean waves washing in','🌊'],['fx','Birdsong','morning birdsong','🐦'],
  ['fx','City Night','the hum of a city at night','🌃'],['fx','Crackling Fire','a crackling fire','🔥'],
].map(([cat, label, desc, em]) => ({ cat, label, desc, em }));
Object.entries(VENUES).forEach(([label, desc]) => LIB.push({ cat: 'venue', label, desc, em: '🏛️' }));
INSTRUMENTS.forEach(([id, label, desc]) => LIB.unshift({ cat: 'instrument', label, desc, sticker: id }));

const GUESS: Array<[string, RegExp]> = [
  ['singer', /(vocal|voice|sing|singer|choir|rap|croon|falsetto|soprano|alto voice|baritone|hum|scat|chant|diva|whisper)/i],
  ['beat', /(beat|groove|bpm|kick|snare|hats?\b|808|swing|clave|rhythm|break|shuffle|dembow|four.on|drop)/i],
  ['fx', /(rain|thunder|crowd|ocean|waves?|bird|wind|crackl|city|fire|storm|applause)/i],
  ['venue', /(club|hall|rooftop|cathedral|church|forest|beach|street|warehouse|stadium|\bbar\b|cave|subway|desert|stage in|alley|temple)/i],
  ['tone', /(warm|bright|dark|lo-?fi|tape|analog|crisp|gritty|distort|reverb|dry|mellow|vintage|fuzzy|saturat)/i],
  ['mood', /(happy|sad|melanchol|euphor|romantic|myster|nostalg|angry|calm|dreamy|epic|triumph|hypnotic|playful|chill)/i],
  ['style', /(jazz|funk|rock|pop|hip.?hop|trap|house|techno|classical|orchestral|ambient|soul|r&b|blues|reggae|bossa|samba|flamenco|gospel|metal|punk|folk|country|edm|synthwave|afro|cinematic|drill|disco|tango|score)/i],
];
const guessCat = (t: string) => (GUESS.find(([, re]) => re.test(t)) || ['instrument'])[0];

export function initStudio(keyHooks: StudioKeyHooks) {
  const cleanups: Array<() => void> = [];
  const on = <K extends keyof WindowEventMap>(
    target: Window | Document | HTMLElement,
    type: K | string,
    fn: EventListenerOrEventListenerObject,
    opts?: AddEventListenerOptions
  ) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  /* ============ State ============ */
  const LS = 'ensemble.settings.v1';
  const store = (() => {
    try {
      localStorage.setItem('__t', '1');
      localStorage.removeItem('__t');
      return localStorage;
    } catch {
      const m: Record<string, string> = {};
      return {
        persistent: false,
        getItem: (k: string) => m[k] ?? null,
        setItem: (k: string, v: string) => { m[k] = String(v); },
      };
    }
  })();
  let saved: Record<string, any> = {};
  try {
    saved = JSON.parse(store.getItem(LS) || '{}');
    delete saved.key;
  } catch {}
  const settings = Object.assign(
    { model: 'genie-4', director: true, directorModel: 'gemini-3.1-flash-lite', seconds: 60, sfx: true, paint: true },
    saved
  );
  if (settings.model !== 'genie-4') settings.model = 'genie-4';
  const saveSettings = () => {
    try { store.setItem(LS, JSON.stringify(settings)); } catch {}
  };

  on(window, 'error', (e: any) => {
    try { toast('Something went wrong: ' + (e.message || e), true); } catch {}
  });
  on(window, 'unhandledrejection', (e: any) => {
    try { toast('Something went wrong: ' + (e.reason?.message || e.reason), true); } catch {}
  });

  interface StageItem {
    id: string;
    kind: string;
    label: string;
    desc: string;
    img?: string;
    em?: string;
    idx?: number;
    on: boolean;
    onAt?: number;
    rot?: number;
    pos?: { fx: number; fy: number };
    home?: { x: number; y: number };
    el?: HTMLElement;
  }

  const state = {
    items: [] as StageItem[],
    genres: new Set<string>(),
    venue: null as string | null,
    era: null as string | null,
    custom: { genre: [] as string[], venue: [] as string[], era: [] as string[] },
    tempo: 92,
    energy: 55,
    mood: 62,
    space: 40,
    tab: 'genre' as 'genre' | 'venue' | 'era',
    phase: 'idle',
    override: null as string | null,
    finalPrompt: '',
    prevText: '',
    seq: 0,
    run: 0,
  };
  const venueDesc = (name: string) => VENUES[name] || name;
  const eraDesc = (name: string) => ERAS[name] || `set in ${name}`;
  const selected = () => state.items.filter(i => i.on).sort((a, b) => (a.onAt || 0) - (b.onAt || 0));

  /* ============ Prompt composer ============ */
  const pick = (v: number, arr: string[]) => arr[clamp(Math.floor(v / (100 / arr.length)), 0, arr.length - 1)];
  const ENERGY = ['hushed and delicate', 'laid-back', 'steady and grooving', 'driving and energetic', 'explosive, full-throttle'];
  const MOOD = ['melancholic', 'wistful', 'bittersweet', 'warm and uplifting', 'euphoric'];
  const SPACE = ['intimate and close-mic\'d', 'in a small, warm room', 'with the punch of a packed club', 'blooming in a grand hall', 'with the roar and scale of a stadium'];
  const LIGHT = ['cool blue light', 'dusky violet light', 'warm amber light', 'golden light', 'vibrant, color-saturated light'];
  const listJoin = (a: string[]) => (a.length < 2 ? a[0] || '' : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

  function compose() {
    const segs: Array<{ t: string; cat?: string }> = [];
    const t = (str: string) => segs.push({ t: str });
    const s = (txt: string, cat: string) => segs.push({ t: txt, cat });
    const sel = selected();
    const of = (k: string) => sel.filter(i => i.kind === k);
    const inst = of('instrument');
    const venues = of('venue');
    const where = venues.length ? venues.map(v => v.desc).join(', ') : state.venue ? venueDesc(state.venue) : '';
    t('A cinematic live music performance');
    if (where) { t(' in '); s(where, 'venue'); }
    if (state.era) { t(', '); s(eraDesc(state.era), 'venue'); }
    t('. ');
    if (inst.length) {
      t('On stage, the ensemble plays together: ');
      inst.forEach((i, n) => {
        if (n) t(n === inst.length - 1 ? ', and ' : ', ');
        s(i.desc, 'instrument');
      });
      t('. ');
    } else t('On stage, a tight small band improvises together. ');
    const genres = [...state.genres, ...of('style').map(i => i.desc)];
    t('Together they play ');
    s(genres.length ? listJoin(genres) : 'an eclectic, genre-blending set', 'style');
    t(' at ');
    s(`${state.tempo} BPM`, 'beat');
    t(' — ');
    s(pick(state.energy, ENERGY), 'mood');
    t(' and ');
    s(pick(state.mood, MOOD), 'mood');
    of('mood').forEach(m => { t(', '); s(m.desc, 'mood'); });
    t('. ');
    const singers = of('singer');
    if (singers.length) { t('Vocals: '); s(listJoin(singers.map(i => i.desc)), 'singer'); t('. '); }
    const beats = of('beat');
    if (beats.length) { t('The rhythm section rides '); s(listJoin(beats.map(i => i.desc)), 'beat'); t('. '); }
    const tones = of('tone');
    t('The sound is the star — rich, clear, studio-quality live audio, ');
    if (tones.length) { s(listJoin(tones.map(i => i.desc)), 'tone'); t(', '); }
    s(pick(state.space, SPACE), 'tone');
    t(', every instrument distinct in the mix. ');
    const fx = of('fx');
    if (fx.length) { t('Beneath the music: '); s(listJoin(fx.map(i => i.desc)), 'fx'); t('. '); }
    t(`The camera glides slowly between the musicians under ${pick(state.mood, LIGHT)}. One continuous, evolving piece of music that builds over a minute — no dialogue, no narration.`);
    return segs;
  }
  const segsText = (segs: Array<{ t: string }>) => segs.map(x => x.t).join('');
  const currentPrompt = () => state.override ?? segsText(compose());

  /* ============ Layout ============ */
  const frame = $('#frame')!;
  const stickersEl = $('#stickers')!;
  let L: { W: number; H: number; fw: number; fh: number; ft: number; fx: number; side: number; size: number } = {
    W: innerWidth, H: innerHeight, fw: 800, fh: 450, ft: 140, fx: 200, side: 170, size: 110,
  };
  const getBannerOffset = () =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--banner-offset')) || 0;

  function layout() {
    const W = innerWidth, H = innerHeight;
    const banner = getBannerOffset();
    const top = banner + 64 + 58, bot = 78 + 58;
    let fw = Math.min(W * 0.54, ((H - top - bot - 8) * 16) / 9, 1120);
    if ((W - fw) / 2 < 110) fw = W - 220;
    fw = Math.max(fw, 320);
    const fh = (fw * 9) / 16, ft = top + Math.max(0, (H - top - bot - fh) / 2);
    L = { W, H, fw, fh, ft, fx: (W - fw) / 2, side: 0, size: 0 };
    const R = document.documentElement.style;
    R.setProperty('--fw', fw + 'px');
    R.setProperty('--fh', fh + 'px');
    R.setProperty('--ft', ft + 'px');
    L.side = L.fx - 30;
    L.size = clamp(Math.min(L.side * 0.5, (H - banner - 120) / 5), 72, 150);
    state.items.forEach(placeSticker);
    placeHint();
  }
  function mulberry(a: number) {
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function placeSticker(it: StageItem) {
    if (!it.el) return;
    const p = it.pos ? { x: it.pos.fx * L.W, y: it.pos.fy * L.H } : it.home;
    if (!p) return;
    it.el.style.setProperty('--x', p.x + 'px');
    it.el.style.setProperty('--y', p.y + 'px');
    it.el.style.setProperty('--r', (it.rot || 0) + 'deg');
    if (it.kind === 'instrument' || it.img) it.el.style.setProperty('--s', L.size + 'px');
  }
  function placeHint() {
    const hint = $('#hint');
    if (!hint) return;
    hint.style.left = '50%';
    hint.style.transform = 'translateX(-50%)';
    hint.style.top = L.ft + L.fh + 72 + 'px';
  }

  /* ============ Stickers ============ */
  function buildSticker(it: StageItem, deal: number | null = 0) {
    const el = h('div', 'sticker' + (it.img ? '' : ' label'));
    if (it.img) {
      const img = h('img');
      img.src = it.img;
      img.alt = it.label;
      img.draggable = false;
      el.append(img);
    } else {
      const lbl = h('div', 'lbl');
      const em = h('span', 'em', it.em || CATS[it.kind].em);
      lbl.style.setProperty('--c', CATS[it.kind].c);
      lbl.append(em, h('span', '', it.label));
      el.append(lbl);
    }
    const x = h('button', 'x', '×');
    x.title = 'Remove from the stage';
    x.addEventListener('pointerdown', e => { e.stopPropagation(); removeItem(it); });
    el.append(x);
    el.append(h('span', 'tag', it.img ? it.label : CATS[it.kind].label), h('span', 'pip', ''));
    it.el = el;
    stickersEl.append(el);
    placeSticker(it);
    if (deal != null) {
      el.classList.add('deal');
      el.style.animationDelay = deal + 'ms';
      el.addEventListener('animationend', () => {
        el.classList.remove('deal');
        el.style.animationDelay = '';
      }, { once: true });
    }
    attachDrag(it);
    return el;
  }
  function attachDrag(it: StageItem) {
    const el = it.el!;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      closePop();
      const sx = e.clientX, sy = e.clientY;
      let drag = false;
      const p0 = it.pos ? { x: it.pos.fx * L.W, y: it.pos.fy * L.H } : { ...(it.home || { x: sx, y: sy }) };
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!drag && Math.hypot(dx, dy) > 5) { drag = true; el.classList.add('drag'); }
        if (drag) {
          el.style.setProperty('--x', p0.x + dx + 'px');
          el.style.setProperty('--y', p0.y + dy + 'px');
        }
      };
      const up = (ev: PointerEvent) => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        if (!drag) { toggleItem(it); return; }
        el.classList.remove('drag');
        if (inFrame(ev.clientX, ev.clientY)) {
          if (!it.on) toggleItem(it);
          placeSticker(it);
        } else {
          it.pos = { fx: ev.clientX / L.W, fy: ev.clientY / L.H };
          placeSticker(it);
        }
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  }
  const inFrame = (x: number, y: number) => {
    const r = frame.getBoundingClientRect();
    return x > r.left && x < r.right && y > r.top && y < r.bottom;
  };

  function toggleItem(it: StageItem, onVal = !it.on, quiet = false) {
    if (it.on === onVal) return;
    it.on = onVal;
    it.onAt = performance.now();
    if (it.el) {
      it.el.classList.toggle('on', onVal);
      it.el.classList.remove('tap');
      void it.el.offsetWidth;
      it.el.classList.add('tap');
    }
    if (!quiet) {
      sfx(onVal ? 'on' : 'off', it.idx ?? 3);
      if (state.phase === 'live') liveCue(onVal ? joinCue(it) : leaveCue(it), onVal ? 'JOIN' : 'LEAVE');
    }
    refresh();
  }
  function joinCue(it: StageItem) {
    return ({
      instrument: `${cap(it.label)} joins the band: ${it.desc}. The music keeps flowing.`,
      singer: `A singer steps up to the mic: ${it.desc}.`,
      beat: `The groove shifts into ${it.desc}.`,
      tone: `The mix turns ${it.desc}.`,
      mood: `The music becomes ${it.desc}.`,
      style: `The band morphs into ${it.desc}.`,
      venue: `The scene transforms into ${it.desc}.`,
      fx: `Add ${it.desc} beneath the music.`,
    } as Record<string, string>)[it.kind];
  }
  const leaveCue = (it: StageItem) =>
    it.kind === 'instrument'
      ? `The ${it.label.toLowerCase()} stops playing and fades out; the rest of the band continues.`
      : `Drop the ${it.label.toLowerCase()}; keep the music flowing.`;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  function removeItem(it: StageItem) {
    if (it.on && state.phase === 'live') liveCue(leaveCue(it), 'LEAVE');
    it.on = false;
    state.items = state.items.filter(x => x !== it);
    if (it.el) {
      it.el.classList.add('poof');
      setTimeout(() => it.el?.remove(), 400);
    }
    refresh();
  }
  function spawnInstrument(id: string, x: number, y: number, deal = 0, quiet = false) {
    const existing = state.items.find(i => i.id === id);
    if (existing) { toggleItem(existing, true, quiet); flash(existing); return existing; }
    const idx = INSTRUMENTS.findIndex(d => d[0] === id);
    const [, label, desc] = INSTRUMENTS[idx];
    if (inFrame(x, y)) x = x < L.W / 2 ? L.fx - L.size * 0.7 : L.fx + L.fw + L.size * 0.7;
    ({ x, y } = nudge(x, y));
    const banner = getBannerOffset();
    const it: StageItem = {
      id, kind: 'instrument', label, desc, img: STICKERS[id], idx, on: false, rot: (Math.random() - 0.5) * 22,
      pos: {
        fx: clamp(x, L.size * 0.5 + 8, L.W - L.size * 0.5 - 8) / L.W,
        fy: clamp(y, banner + 64 + L.size * 0.45, L.H - L.size * 0.5 - 8) / L.H,
      },
    };
    state.items.push(it);
    buildSticker(it, deal);
    toggleItem(it, true, quiet);
    return it;
  }
  function freeSpot() {
    const S = L.size, banner = getBannerOffset();
    const pts = state.items.filter(i => i.el && i.pos).map(i => ({ x: i.pos!.fx * L.W, y: i.pos!.fy * L.H }));
    let best = { x: 100, y: 200 }, bestD = -1;
    for (let k = 0; k < 80; k++) {
      const left = Math.random() < 0.5;
      const x = left
        ? 12 + S / 2 + Math.random() * Math.max(1, L.fx - 24 - S)
        : L.fx + L.fw + 12 + S / 2 + Math.random() * Math.max(1, L.W - L.fx - L.fw - 24 - S);
      const y = banner + 70 + S / 2 + Math.random() * Math.max(1, L.H - banner - 90 - S);
      const d = pts.length ? Math.min(...pts.map(p => Math.hypot(p.x - x, p.y - y))) : 1e9;
      if (d > bestD) { best = { x, y }; bestD = d; }
      if (d > S * 1.15) break;
    }
    return best;
  }
  function nudge(x: number, y: number) {
    const S = L.size, banner = getBannerOffset();
    const pts = state.items.filter(i => i.el && i.pos).map(i => ({ x: i.pos!.fx * L.W, y: i.pos!.fy * L.H }));
    const pad = S * 0.42;
    const ui = ['#chipbar', '#faders', '#drawer', '.hdr-r'].map(q => $(q)?.getBoundingClientRect()).filter(Boolean) as DOMRect[];
    const onUI = (px: number, py: number) => ui.some(r => px > r.left - pad && px < r.right + pad && py > r.top - pad && py < r.bottom + pad);
    const ok = (px: number, py: number) =>
      px > S * 0.5 && px < L.W - S * 0.5 && py > banner + 64 + S * 0.45 && py < L.H - S * 0.5 &&
      !inFrame(px, py) && !onUI(px, py) && !pts.some(p => Math.hypot(p.x - px, p.y - py) < S * 0.8);
    if (ok(x, y) || !pts.length) return { x, y };
    for (let r = S * 0.3; r < Math.max(L.W, L.H); r += S * 0.25) {
      for (let a = 0; a < 6.283; a += 0.35) {
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (ok(px, py)) return { x: px, y: py };
      }
    }
    return { x, y };
  }
  function addCustom(entry: LibEntry, x: number, y: number) {
    if (entry.sticker) { spawnInstrument(entry.sticker, x, y, 0); return; }
    const existing = state.items.find(i => !i.img && i.label.toLowerCase() === entry.label.toLowerCase() && i.kind === entry.cat);
    if (existing) { toggleItem(existing, true); flash(existing); return; }
    if (inFrame(x, y)) x = x < L.W / 2 ? L.fx - 90 : L.fx + L.fw + 90;
    ({ x, y } = nudge(x, y));
    const banner = getBannerOffset();
    const it: StageItem = {
      id: 'c' + (++state.seq), kind: entry.cat, label: entry.label, desc: entry.desc || entry.label, em: entry.em,
      on: false, rot: (Math.random() - 0.5) * 12,
      pos: { fx: clamp(x, 60, L.W - 60) / L.W, fy: clamp(y, banner + 90, L.H - 70) / L.H },
    };
    state.items.push(it);
    buildSticker(it, 0);
    toggleItem(it, true);
    paintSticker(it);
  }
  const flash = (it: StageItem) => {
    if (!it?.el) return;
    it.el.classList.remove('tap');
    void it.el.offsetWidth;
    it.el.classList.add('tap');
  };

  /* ============ Chips & faders ============ */
  const TAB_COLOR = { genre: 'var(--violet)', venue: 'var(--lime)', era: 'var(--sky)' };
  const TAB_HINT = { genre: 'e.g. Balkan brass, Lo-fi soul…', venue: 'e.g. Lighthouse at midnight…', era: 'e.g. Victorian London…' };
  const chipList = (tab: 'genre' | 'venue' | 'era') => [
    ...state.custom[tab],
    ...(tab === 'genre' ? GENRES : tab === 'venue' ? Object.keys(VENUES) : Object.keys(ERAS)),
  ];
  const isOn = (tab: 'genre' | 'venue' | 'era', name: string) =>
    tab === 'genre' ? state.genres.has(name) : tab === 'venue' ? state.venue === name : state.era === name;
  function selectChip(tab: 'genre' | 'venue' | 'era', name: string, force?: boolean) {
    const onVal = isOn(tab, name), want = force ?? !onVal;
    if (tab === 'genre') {
      if (!want) state.genres.delete(name);
      else if (!onVal) {
        if (state.genres.size >= 3) state.genres.delete(state.genres.values().next().value!);
        state.genres.add(name);
      }
    } else if (tab === 'venue') state.venue = want ? name : onVal ? null : state.venue;
    else state.era = want ? name : onVal ? null : state.era;
    sfx('tick');
    renderChips();
    refresh();
    if (state.phase === 'live' && want) {
      if (tab === 'genre') liveCue(`The band morphs its style into ${listJoin([...state.genres]) || 'something new'}, without stopping.`, 'STYLE');
      else if (tab === 'venue') liveCue(`The scene transforms into ${venueDesc(name)}; the music continues.`, 'SCENE');
      else liveCue(`Everything shifts ${eraDesc(name)}.`, 'ERA');
    }
  }
  function addChip(tab: 'genre' | 'venue' | 'era', raw: string) {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, 48);
    if (!name) { renderChips(); return; }
    const hit = chipList(tab).find(n => n.toLowerCase() === name.toLowerCase());
    if (!hit) state.custom[tab].unshift(name);
    selectChip(tab, hit || name, true);
  }
  function renderChips() {
    const box = $('#chips')!;
    box.innerHTML = '';
    const tab = state.tab, color = TAB_COLOR[tab];
    const edit = h('button', 'chip edit', '✎ Your own');
    edit.title = `Type your own ${tab}`;
    edit.onclick = () => {
      const inp = h('input', 'chip-input');
      inp.placeholder = TAB_HINT[tab];
      inp.maxLength = 48;
      edit.replaceWith(inp);
      inp.focus();
      let done = false;
      inp.onkeydown = e => {
        if (e.key === 'Enter') { done = true; addChip(tab, inp.value); }
        else if (e.key === 'Escape') { done = true; renderChips(); }
      };
      inp.onblur = () => {
        if (!done) { done = true; inp.value.trim() ? addChip(tab, inp.value) : renderChips(); }
      };
    };
    box.append(edit);
    chipList(tab).forEach(name => {
      const custom = state.custom[tab].includes(name);
      const b = h('button', 'chip' + (isOn(tab, name) ? ' on' : '') + (custom ? ' custom' : ''), name);
      b.style.setProperty('--c', color);
      if (custom) {
        const del = h('span', 'del', '×');
        del.title = 'Remove';
        del.onclick = e => {
          e.stopPropagation();
          state.custom[tab] = state.custom[tab].filter(n => n !== name);
          if (isOn(tab, name)) selectChip(tab, name, false);
          else renderChips();
        };
        b.append(del);
      }
      b.onclick = () => selectChip(tab, name);
      box.append(b);
    });
    $$('#tabs button').forEach(b => {
      const bTab = b.dataset.tab as 'genre' | 'venue' | 'era';
      b.classList.toggle('on', bTab === tab);
      const n = bTab === 'genre' ? state.genres.size : bTab === 'venue' ? +!!state.venue : +!!state.era;
      const sup = b.querySelector('sup');
      if (sup) sup.textContent = n ? String(n) : '';
    });
  }
  const FADERS: Array<{ k: 'tempo' | 'energy' | 'mood' | 'space'; label: string; min: number; max: number; c: string; fmt: (v: number) => string }> = [
    { k: 'tempo', label: 'Tempo', min: 60, max: 180, c: 'var(--coral)', fmt: v => `${v} bpm` },
    { k: 'energy', label: 'Energy', min: 0, max: 100, c: 'var(--amber)', fmt: v => pick(v, ['Hushed', 'Laid-back', 'Grooving', 'Driving', 'Explosive']) },
    { k: 'mood', label: 'Mood', min: 0, max: 100, c: 'var(--sky)', fmt: v => pick(v, ['Melancholic', 'Wistful', 'Bittersweet', 'Uplifting', 'Euphoric']) },
    { k: 'space', label: 'Space', min: 0, max: 100, c: 'var(--teal)', fmt: v => pick(v, ['Intimate', 'Room', 'Club', 'Hall', 'Stadium']) },
  ];
  let faderTimer: ReturnType<typeof setTimeout> | undefined;
  function renderFaders() {
    const box = $('#faders')!;
    box.innerHTML = '';
    FADERS.forEach(f => {
      const w = h('div', 'fader'), top = h('div', 'top'), lab = h('label', '', f.label), out = h('output', '', f.fmt(state[f.k]));
      const r = h('input');
      r.type = 'range'; r.min = String(f.min); r.max = String(f.max); r.value = String(state[f.k]);
      r.style.setProperty('--fc', f.c);
      const paint = () => r.style.setProperty('--p', ((+r.value - f.min) / (f.max - f.min)) * 100 + '%');
      paint();
      r.oninput = () => {
        state[f.k] = +r.value;
        out.textContent = f.fmt(+r.value);
        paint();
        refresh();
        clearTimeout(faderTimer);
        if (state.phase === 'live') {
          faderTimer = setTimeout(
            () => liveCue(`The band shifts the feel: now ${pick(state.energy, ENERGY)}, ${pick(state.mood, MOOD)}, around ${state.tempo} BPM, ${pick(state.space, SPACE)}.`, 'FEEL'),
            650
          );
        }
      };
      top.append(lab, out);
      w.append(top, r);
      box.append(w);
    });
  }

  /* ============ Frame idle + drawer ============ */
  function refresh() {
    const sel = selected();
    let n = 0;
    sel.forEach(i => {
      const pip = i.el?.querySelector('.pip');
      if (pip) pip.textContent = i.kind === 'instrument' ? String(++n) : '✦';
    });
    document.documentElement.style.setProperty('--count', String(Math.min(sel.length, 10)));
    const cast = $('#cast')!;
    const have = new Set<string>();
    sel.forEach(i => {
      have.add(i.id);
      if (cast.querySelector(`[data-id="${i.id}"]`)) return;
      const c = h('button', 'castchip');
      c.dataset.id = i.id;
      c.title = 'Remove from the stage';
      if (i.img) { const im = h('img'); im.src = i.img; c.append(im); }
      else { const d = h('i'); d.style.setProperty('--c', CATS[i.kind].c); c.append(d); }
      c.append(document.createTextNode(i.label));
      c.onclick = e => { e.stopPropagation(); i.img ? toggleItem(i, false) : removeItem(i); };
      cast.append(c);
    });
    $$('.castchip', cast).forEach(c => { if (!have.has(c.dataset.id || '')) c.remove(); });
    const inst = sel.filter(i => i.kind === 'instrument').length;
    const btnBegin = $<HTMLButtonElement>('#btn-begin');
    if (btnBegin) btnBegin.disabled = inst === 0;
    const sum = $('#summary')!;
    sum.innerHTML = '';
    if (!sel.length) {
      sum.textContent = state.items.length
        ? 'Tap a sticker to bring it back on stage.'
        : 'Click anywhere to add an instrument, beat or voice — or roll the dice.';
    } else {
      const em = h('em', '', [...state.genres].join(' × ') || 'Freeform');
      sum.append(
        em,
        document.createTextNode(`  ·  ${inst} ${inst === 1 ? 'voice' : 'voices'}  ·  ${state.tempo} bpm${state.venue ? '  ·  ' + state.venue : ''}`)
      );
    }
    const hint = $('#hint');
    if (hint) hint.style.opacity = state.items.length ? '0' : '1';
    renderPrompt();
  }
  function renderPrompt() {
    const segs = compose();
    const text = state.override ?? segsText(segs);
    const box = $('#dr-text')!;
    if (box.contentEditable !== 'true') {
      box.innerHTML = '';
      if (state.override != null) box.textContent = state.override;
      else {
        segs.forEach(s => {
          if (!s.cat) box.append(document.createTextNode(s.t));
          else {
            const sp = h('span', 'seg', s.t);
            sp.style.setProperty('--c', CATS[s.cat].c);
            sp.title = CATS[s.cat].label;
            box.append(sp);
          }
        });
      }
    }
    const prev = $('#dr-preview')!;
    const old = state.prevText;
    state.prevText = text;
    prev.innerHTML = '';
    let i = 0;
    while (i < old.length && i < text.length && old[i] === text[i]) i++;
    if (old && i < text.length && text !== old) {
      const start = Math.max(0, i - 24);
      prev.append(document.createTextNode((start ? '…' : '') + text.slice(start, i)));
      let j = 0;
      while (j < old.length - i && j < text.length - i && old[old.length - 1 - j] === text[text.length - 1 - j]) j++;
      prev.append(h('span', 'new', text.slice(i, text.length - j)));
      prev.append(document.createTextNode(text.slice(text.length - j)));
    } else prev.textContent = text;
    $('#dr-meta')!.textContent = `${text.split(/\s+/).length} WORDS`;
    $('#drawer')!.classList.toggle('edited', state.override != null);
    $('#dr-reset')!.hidden = state.override == null;
  }
  function renderLegend() {
    const lg = $('#legend')!;
    lg.innerHTML = '';
    Object.values(CATS).forEach(c => {
      const s = h('span'), i = h('i');
      i.style.setProperty('--c', c.c);
      s.append(i, document.createTextNode(c.label));
      lg.append(s);
    });
  }

  /* ============ Conjure popover ============ */
  const pop = $('#pop')!, popIn = $<HTMLInputElement>('#pop-input')!, popList = $('#pop-list')!;
  let popState = { cat: 'all', idx: 0, x: 0, y: 0, opts: [] as LibEntry[], ghost: null as HTMLElement | null };
  function openPop(x: number, y: number) {
    popState = { cat: 'all', idx: 0, x, y, opts: [], ghost: null };
    const rip = h('div', 'ripple');
    rip.style.left = x + 'px'; rip.style.top = y + 'px';
    document.body.append(rip);
    setTimeout(() => rip.remove(), 800);
    const g = h('div', 'ghost');
    g.style.left = x + 'px'; g.style.top = y + 'px';
    document.body.append(g);
    popState.ghost = g;
    pop.hidden = false;
    const pw = 360, ph = 400, banner = getBannerOffset();
    let px = x + 14, py = Math.max(banner + 14, y + 14);
    if (px + pw > innerWidth - 12) px = x - pw - 14;
    if (py + ph > innerHeight - 60) py = Math.max(banner + 70, innerHeight - 60 - ph);
    pop.style.left = clamp(px, 12, innerWidth - pw - 12) + 'px';
    pop.style.top = py + 'px';
    pop.style.transformOrigin = `${x - px}px ${y - py}px`;
    popIn.value = '';
    renderPopHead();
    renderOpts();
    requestAnimationFrame(() => popIn.focus());
    sfx('open');
  }
  function closePop() { if (pop.hidden) return; pop.hidden = true; popState.ghost?.remove(); }
  function renderPopHead() {
    const head = $('#pop-head')!;
    head.innerHTML = '';
    ([['all', 'All', 'var(--ink)'], ...Object.entries(CATS).map(([k, v]) => [k, v.label, v.c])] as Array<[string, string, string]>).forEach(([k, label, c]) => {
      const b = h('button', popState.cat === k ? 'on' : '');
      const i = h('i');
      i.style.setProperty('--c', c);
      b.append(i, document.createTextNode(label));
      b.onmousedown = e => e.preventDefault();
      b.onclick = () => { popState.cat = k; popState.idx = 0; renderPopHead(); renderOpts(); popIn.focus(); };
      head.append(b);
    });
  }
  function renderOpts() {
    const q = popIn.value.trim(), ql = q.toLowerCase();
    let opts = LIB.filter(o => popState.cat === 'all' || o.cat === popState.cat);
    if (q) {
      opts = opts
        .map(o => ({ o, sc: o.label.toLowerCase().startsWith(ql) ? 3 : o.label.toLowerCase().includes(ql) ? 2 : o.desc.toLowerCase().includes(ql) ? 1 : 0 }))
        .filter(x => x.sc)
        .sort((a, b) => b.sc - a.sc)
        .map(x => x.o);
    } else opts = shuffleStable(opts).slice(0, 40);
    opts = opts.slice(0, 30);
    if (q && !opts.some(o => o.label.toLowerCase() === ql)) {
      const cat = popState.cat === 'all' ? guessCat(q) : popState.cat;
      opts.unshift({ cat, label: q, desc: q, em: CATS[cat].em, free: true });
    }
    popState.opts = opts;
    popState.idx = clamp(popState.idx, 0, Math.max(0, opts.length - 1));
    popList.innerHTML = '';
    opts.forEach((o, i) => {
      const row = h('div', 'opt' + (i === popState.idx ? ' on' : ''));
      row.style.setProperty('--c', CATS[o.cat].c);
      const em = h('span', 'em');
      if (o.sticker && STICKERS[o.sticker]) {
        const im = h('img'); im.src = STICKERS[o.sticker]; im.style.cssText = 'width:24px;height:24px;object-fit:contain';
        em.append(im);
      } else em.textContent = o.em || CATS[o.cat].em;
      const tx = h('div', 'tx');
      tx.append(
        h('b', '', o.free ? `Add “${o.label}”` : o.label),
        h('span', '', o.free ? `as ${CATS[o.cat].label.toLowerCase()} — Tab to change` : o.desc)
      );
      row.append(em, tx, h('span', 'cat', CATS[o.cat].label));
      row.onmousedown = e => e.preventDefault();
      row.onclick = () => choose(o);
      row.onmousemove = () => {
        if (popState.idx !== i) {
          popState.idx = i;
          $$('.opt', popList).forEach((r, k) => r.classList.toggle('on', k === i));
        }
      };
      popList.append(row);
    });
  }
  let shuffleSeed = 1;
  function shuffleStable<T>(a: T[]): T[] {
    const r = mulberry(shuffleSeed);
    return a.map(x => [r(), x] as [number, T]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
  }
  function choose(o: LibEntry) { addCustom(o, popState.x, popState.y); closePop(); shuffleSeed++; }
  on(popIn, 'input', () => { popState.idx = 0; renderOpts(); });
  on(popIn, 'keydown', (ev: Event) => {
    const e = ev as KeyboardEvent;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      popState.idx = clamp(popState.idx + (e.key === 'ArrowDown' ? 1 : -1), 0, popState.opts.length - 1);
      $$('.opt', popList).forEach((r, k) => r.classList.toggle('on', k === popState.idx));
      $$('.opt', popList)[popState.idx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = popState.opts[popState.idx];
      if (o) choose(o);
    } else if (e.key === 'Escape') closePop();
    else if (e.key === 'Tab') {
      e.preventDefault();
      const keys = ['all', ...Object.keys(CATS)];
      popState.cat = keys[(keys.indexOf(popState.cat) + (e.shiftKey ? keys.length - 1 : 1)) % keys.length];
      renderPopHead();
      renderOpts();
    }
  });

  /* ============ Audio engine ============ */
  const audio = {
    ctx: null as AudioContext | null,
    bus: null as GainNode | null,
    comp: null as DynamicsCompressorNode | null,
    master: null as GainNode | null,
    analyser: null as AnalyserNode | null,
    rec: null as MediaStreamAudioDestinationNode | null,
    sfx: null as GainNode | null,
    freq: new Uint8Array(0),
    wave: new Uint8Array(0),
    playAt: 0,
    primed: false,
    sources: new Set<AudioBufferSourceNode>(),
    lvl: 0,
    init() {
      if (this.ctx) return this.ctx;
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      try { this.ctx = new AC({ sampleRate: 48000, latencyHint: 'playback' }); } catch { this.ctx = new AC(); }
      const c = this.ctx!;
      this.bus = c.createGain();
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -4; this.comp.knee.value = 6; this.comp.ratio.value = 4; this.comp.attack.value = 0.002; this.comp.release.value = 0.22;
      this.master = c.createGain();
      this.analyser = c.createAnalyser(); this.analyser.fftSize = 2048; this.analyser.smoothingTimeConstant = 0.78;
      this.rec = c.createMediaStreamDestination();
      this.bus.connect(this.comp).connect(this.master);
      this.master.connect(this.analyser).connect(c.destination);
      this.master.connect(this.rec);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.5; this.sfx.connect(c.destination);
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.wave = new Uint8Array(this.analyser.fftSize);
      return c;
    },
    reset() {
      if (!this.ctx || !this.master) return;
      this.sources.forEach(s => { try { s.stop(); } catch {} });
      this.sources.clear();
      const g = this.master.gain;
      g.cancelScheduledValues(this.ctx.currentTime);
      g.setValueAtTime(1, this.ctx.currentTime);
      this.playAt = 0;
      this.primed = false;
    },
    schedule({ data, sample_rate, channels, mime_type }: any) {
      if (!this.ctx || !this.bus) return;
      if (mime_type && !/pcm|l16|raw|s16/i.test(mime_type)) return;
      const sr = +sample_rate || +((mime_type || '').match(/rate=(\d+)/) || [])[1] || 48000;
      const ch = +channels || 2;
      const bytes = b64(data), n = bytes.length >> 1;
      if (!n) return;
      const pcm = new Int16Array(bytes.buffer, 0, n), frames = Math.floor(n / ch);
      if (!frames) return;
      const buf = this.ctx.createBuffer(ch, frames, sr);
      for (let c = 0; c < ch; c++) {
        const out = buf.getChannelData(c);
        for (let f = 0, j = c; f < frames; f++, j += ch) out[f] = pcm[j] / 32768;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.bus);
      const now = this.ctx.currentTime;
      if (this.playAt < now + 0.015) this.playAt = now + (this.primed ? 0.15 : 0.3);
      this.primed = true;
      src.start(this.playAt);
      this.playAt += buf.duration;
      this.sources.add(src);
      src.onended = () => this.sources.delete(src);
    },
    queued() { return this.ctx ? Math.max(0, this.playAt - this.ctx.currentTime) : 0; },
    fadeOut(sec = 1.8) {
      if (!this.ctx || !this.master) return;
      const g = this.master.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + sec);
    },
    level() {
      if (!this.ctx || !this.analyser) return 0;
      this.analyser.getByteTimeDomainData(this.wave);
      let s = 0;
      for (let i = 0; i < this.wave.length; i += 4) { const v = (this.wave[i] - 128) / 128; s += v * v; }
      const rms = Math.sqrt(s / (this.wave.length / 4));
      const target = clamp(rms * 3.2, 0, 1);
      this.lvl += (target - this.lvl) * (target > this.lvl ? 0.5 : 0.12);
      return this.lvl;
    },
  };
  function b64(str: string) {
    const bin = atob(str), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* UI sounds: soft pentatonic plucks */
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  function sfx(kind: string, i = 0) {
    if (!settings.sfx || state.phase === 'live' || state.phase === 'connecting') return;
    const c = audio.init();
    if (c.state === 'suspended') c.resume();
    const t = c.currentTime, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    const base = kind === 'on' ? 392 : kind === 'off' ? 262 : kind === 'open' ? 523 : 659;
    const f = base * Math.pow(2, (kind === 'on' || kind === 'off' ? PENTA[i % PENTA.length] : 0) / 12);
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2.003;
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(kind === 'off' ? 1200 : 3200, t);
    lp.frequency.exponentialRampToValueAtTime(400, t + 0.5);
    const peak = kind === 'tick' ? 0.05 : kind === 'off' ? 0.07 : 0.11;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'tick' ? 0.12 : 0.7));
    const g2 = c.createGain();
    g2.gain.value = 0.25;
    o.connect(lp);
    o2.connect(g2).connect(lp);
    lp.connect(g).connect(audio.sfx!);
    o.start(t); o2.start(t); o.stop(t + 0.8); o2.stop(t + 0.8);
  }

  /* ============ Genie 4 session ============ */
  const canvas = $<HTMLCanvasElement>('#video')!;
  const vctx = canvas.getContext('2d')!;
  let perf: Performance | null = null;
  let recorder: (MediaRecorder & { ext?: string }) | null = null;
  let recChunks: Blob[] = [];
  let recUrl: string | null = null;

  class Performance {
    prompt: string;
    frames = 0;
    seq = 0;
    drawn = 0;
    closed = false;
    t0 = 0;
    id?: string;
    ws?: WebSocket;
    watchdog?: ReturnType<typeof setTimeout>;
    private wsOpen = false;
    constructor(prompt: string) { this.prompt = prompt; }
    start() {
      this.wsOpen = false;
      const ws = (this.ws = new WebSocket(LIVE_WS()));
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        this.wsOpen = true;
        setSub('Creating interaction');
        this.send({ event_type: 'interaction.create', model: settings.model });
      };
      ws.onmessage = e => this.onMsg(e.data);
      ws.onclose = e => { this.wsOpen = false; this.onClose(e); };
      this.watchdog = setTimeout(() => {
        if (!this.frames) this.fail('Timed out waiting for the first frame (45s).');
      }, 45000);
    }
    send(o: unknown) {
      // _aistudio-iframe.js's ProxiedWebSocket does not expose readyState, so track open state explicitly.
      if (this.ws && (this.ws.readyState === 1 || (this.ws.readyState === undefined && this.wsOpen))) {
        this.ws.send(JSON.stringify(o));
      }
    }
    onMsg(data: string | ArrayBuffer) {
      let m: any;
      try { m = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data)); } catch { return; }
      const t = m.event_type;
      if (t === 'interaction.created' || t === 'interaction.connected') {
        this.id = m.interaction?.id || m.id;
        this.send({ event_type: 'world_setup', world_prompt: { text: this.prompt } });
        setStatus('Raising the curtain…');
        setSub('World prompt sent · waiting for first frame');
        logLive('SYS', 'Interaction created — world prompt sent to ' + modelLabel());
      } else if (t === 'step.delta') {
        const d = m.delta || {};
        if (d.type === 'video' && d.data) this.onVideo(d);
        else if (d.type === 'audio' && d.data && !this.closed) audio.schedule(d);
      } else if (t === 'error' || m.error) {
        const code = typeof m.error?.code === 'number' ? m.error.code : undefined;
        const msg = m.error?.message || m.message || JSON.stringify(m).slice(0, 300);
        const keyErr = isApiKeyError(code, msg);
        if (!this.frames) this.fail(msg, keyErr);
        else {
          toast(msg, true);
          logLive('ERR', msg);
          if (keyErr) keyHooks.onApiKeyError(msg);
        }
      }
    }
    async onVideo(d: any) {
      if (this.closed) return;
      const seq = ++this.seq;
      let bmp: ImageBitmap;
      try { bmp = await createImageBitmap(new Blob([b64(d.data)], { type: d.mime_type || 'image/jpeg' })); } catch { return; }
      if (!this.frames++) this.firstFrame(bmp);
      const delay = clamp(audio.queued() * 1000 - 20, 0, 600);
      setTimeout(() => {
        if (seq < this.drawn || (this.closed && state.phase !== 'ended')) { bmp.close?.(); return; }
        this.drawn = seq;
        vctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        bmp.close?.();
      }, delay);
    }
    firstFrame(bmp: ImageBitmap) {
      clearTimeout(this.watchdog);
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      this.t0 = performance.now();
      setPhase('live');
      startRecorder();
      logLive('SYS', `First frame · ${bmp.width}×${bmp.height}`);
    }
    steer(text: string) {
      const ev = { event_type: 'input', content: [{ type: 'text', text }] };
      for (let i = 0; i < 10; i++) setTimeout(() => this.send(ev), i * 150);
    }
    end(reason: string) {
      if (this.closed) return;
      this.closed = true;
      clearTimeout(this.watchdog);
      this.send({ event_type: 'interaction.complete' });
      setTimeout(() => { try { this.ws?.close(1000); } catch {} }, 300);
      audio.fadeOut(1.8);
      setTimeout(stopRecorder, 1900);
      logLive('SYS', reason === 'server' ? 'Session ended by server' : reason === 'user' ? 'Ended early' : 'Curtain — performance complete');
      const secs = Math.round((performance.now() - this.t0) / 1000);
      $('#endmeta')!.textContent = `${secs}s · ${selected().filter(i => i.kind === 'instrument').length} voices · ${[...state.genres].join(' × ') || 'Freeform'} · ${modelLabel()}`;
      setPhase('ended');
    }
    cancel() { this.closed = true; clearTimeout(this.watchdog); try { this.ws?.close(1000); } catch {} audio.reset(); }
    fail(msg: string, isKeyErr = false) {
      if (this.closed) return;
      this.closed = true;
      clearTimeout(this.watchdog);
      try { this.ws?.close(); } catch {}
      audio.reset();
      $('#errmsg')!.textContent = msg;
      setPhase('error');
      logLive('ERR', msg);
      if (isKeyErr || isApiKeyError(undefined, msg)) {
        keyHooks.onApiKeyError(msg);
      }
    }
    onClose(e: CloseEvent) {
      if (this.closed) return;
      if (!this.frames) {
        const msg = e.reason || `Connection closed (code ${e.code}). Check that the selected project key is billed and allowlisted for ${modelLabel()}.`;
        this.fail(msg, isApiKeyError(e.code, msg));
      } else this.end('server');
    }
  }

  function startRecorder() {
    try {
      if (recUrl) { URL.revokeObjectURL(recUrl); recUrl = null; }
      const saveBtn = $<HTMLButtonElement>('#btn-save');
      if (saveBtn) saveBtn.disabled = true;
      const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...(audio.rec?.stream.getAudioTracks() || [])]);
      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m));
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6, audioBitsPerSecond: 256000 });
      recChunks = [];
      recorder.ondataavailable = e => e.data.size && recChunks.push(e.data);
      recorder.onstop = () => {
        recUrl = URL.createObjectURL(new Blob(recChunks, { type: mime }));
        if (saveBtn) saveBtn.disabled = false;
        if (recorder && mime) recorder.ext = mime.includes('mp4') ? 'mp4' : 'webm';
      };
      recorder.start(1000);
    } catch (e) { console.warn('recorder unavailable', e); recorder = null; }
  }
  function stopRecorder() { if (recorder && recorder.state !== 'inactive') recorder.stop(); }

  /* ============ Gemini director ============ */
  async function directViaProxy(draft: string, signal: AbortSignal) {
    const models = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'];
    let lastErr: any = null;
    for (const model of models) {
      try {
        const r = await fetch(`${GOOGLE_API_HTTPS}/v1beta/interactions`, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            input: draft,
            system_instruction: DIRECTOR_SYS,
            generation_config: { temperature: 0.9, max_output_tokens: 2048 },
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.error) {
          const msg = j.error?.message || `HTTP ${r.status}`;
          const err = new Error(msg) as Error & { isKeyError?: boolean };
          err.isKeyError = isApiKeyError(r.status || j.error?.code, msg);
          if (err.isKeyError) throw err;
          lastErr = err;
          continue;
        }
        let text = '';
        for (const step of j.steps || []) {
          if (step.type === 'model_output') {
            for (const part of step.content || []) {
              if (part.type === 'text' && part.text) text += part.text;
            }
          }
        }
        if (!text && j.output_text) text = j.output_text;
        text = text.trim();
        if (text.split(/\s+/).length < 25) throw new Error('director reply too short');
        return text;
      } catch (err: any) {
        if (err?.isKeyError || err?.name === 'AbortError') throw err;
        lastErr = err;
      }
    }
    throw lastErr || new Error('Director request failed');
  }

  async function direct(draft: string) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 9000);
    try {
      if (useBrowserGoogleProxy()) {
        return await directViaProxy(draft, ctl.signal);
      }
      const r = await fetch('/api/direct', {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft }),
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        const msg = j.error?.message || 'Director request failed';
        const err = new Error(msg) as Error & { isKeyError?: boolean };
        err.isKeyError = isApiKeyError(r.status || j.error?.code, msg);
        throw err;
      }
      const txt = (j.text || '').trim();
      if (txt.split(/\s+/).length < 25) throw new Error('director reply too short');
      return txt;
    } finally { clearTimeout(to); }
  }

  /* ============ Phases ============ */
  let statusTimer: ReturnType<typeof setInterval> | undefined;
  function setPhase(p: string) {
    state.phase = p;
    frame.dataset.phase = p;
    document.body.classList.toggle('is-live', p === 'live');
    clearInterval(statusTimer);
    if (p === 'connecting') {
      const lines = ['Tuning up…', 'Warming the room…', 'Finding the downbeat…', 'Raising the curtain…'];
      let i = 0;
      setStatus(lines[0]);
      statusTimer = setInterval(() => { if (i < lines.length - 1) setStatus(lines[++i]); }, 4200);
    }
  }
  const setStatus = (t: string) => {
    const s = $('#status');
    if (!s) return;
    s.style.opacity = '0';
    setTimeout(() => { s.textContent = t; s.style.opacity = '1'; }, 180);
  };
  const setSub = (t: string) => { const el = $('#substatus'); if (el) el.textContent = t; };
  const modelLabel = () => (settings.model.includes('genie-4') ? 'Genie 4' : settings.model.replace('models/', ''));

  async function begin(reusePrompt = false) {
    if (!reusePrompt && !selected().some(i => i.kind === 'instrument')) return;
    const ready = await keyHooks.ensureApiKey();
    if (!ready) return;

    closePop();
    audio.init();
    await audio.ctx!.resume();
    audio.reset();
    vctx.clearRect(0, 0, canvas.width, canvas.height);
    setPhase('connecting');
    setSub('Connecting to ' + modelLabel());
    $('#cues')!.innerHTML = '';
    const runId = ++state.run;
    let prompt = reusePrompt && state.finalPrompt ? state.finalPrompt : currentPrompt();
    if (!reusePrompt && settings.director && state.override == null) {
      setStatus('Briefing the director…');
      setSub('Gemini · ' + settings.directorModel);
      try {
        prompt = await direct(prompt);
        renderDirector(prompt, true);
        logLive('DIR', 'Gemini director rewrote the prompt');
      } catch (e: any) {
        if (e?.isKeyError) {
          $('#errmsg')!.textContent = e.message;
          setPhase('error');
          logLive('ERR', e.message);
          keyHooks.onApiKeyError(e.message);
          return;
        }
        renderDirector(prompt, false, e.message);
        logLive('DIR', 'Director unavailable — using composed prompt');
      }
      if (runId !== state.run || state.phase !== 'connecting') return;
    }
    state.finalPrompt = prompt;
    logLive('OUT', prompt);
    perf = new Performance(prompt);
    perf.start();
  }
  function renderDirector(text: string, ok: boolean, err?: string) {
    const d = $('#dr-dir')!;
    d.classList.toggle('empty', !ok);
    d.textContent = ok ? text : `Director unavailable (${err || 'skipped'}) — the composed prompt was used as-is.`;
  }

  /* ============ Live loop ============ */
  const spec = $<HTMLCanvasElement>('#spec')!;
  const sctx = spec.getContext('2d')!;
  let rafId = 0;
  function tick() {
    rafId = requestAnimationFrame(tick);
    const live = state.phase === 'live';
    const lvl = live || state.phase === 'ended' ? audio.level() : 0;
    document.documentElement.style.setProperty('--lvl', lvl.toFixed(3));
    if (!live || !perf) return;
    const total = settings.seconds, el = (performance.now() - perf.t0) / 1000, rem = Math.max(0, total - el);
    $('#clock')!.textContent = `${Math.floor(rem / 60)}:${String(Math.floor(rem % 60)).padStart(2, '0')}`;
    $('#ring')!.style.strokeDashoffset = (131.95 * (1 - rem / total)).toFixed(2);
    if (rem <= 0) perf.end('complete');
    const dpr = devicePixelRatio || 1, w = spec.clientWidth * dpr, hh = spec.clientHeight * dpr;
    if (spec.width !== w) { spec.width = w; spec.height = hh; }
    audio.analyser?.getByteFrequencyData(audio.freq);
    sctx.clearRect(0, 0, w, hh);
    const bars = 72, gap = 3 * dpr, bw = (w - gap * (bars - 1)) / bars;
    const grad = sctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(240,180,106,.85)');
    grad.addColorStop(0.5, 'rgba(255,122,89,.85)');
    grad.addColorStop(1, 'rgba(182,156,255,.85)');
    sctx.fillStyle = grad;
    for (let i = 0; i < bars; i++) {
      const mirror = i < bars / 2 ? bars / 2 - 1 - i : i - bars / 2;
      const bin = Math.floor(Math.pow(mirror / (bars / 2), 1.7) * 380) + 2;
      const v = (audio.freq[bin] || 0) / 255, bh = Math.max(2 * dpr, Math.pow(v, 1.6) * hh * 0.9);
      sctx.globalAlpha = 0.35 + v * 0.6;
      sctx.beginPath();
      sctx.roundRect(i * (bw + gap), hh - bh, bw, bh, bw / 2);
      sctx.fill();
    }
    sctx.globalAlpha = 1;
  }

  /* ============ Live cues & log ============ */
  function liveCue(text: string, kind = 'CUE') {
    if (!perf || state.phase !== 'live') return;
    perf.steer(text);
    logLive(kind, text);
    const c = h('div', 'cue');
    c.append(h('b', '', kind), document.createTextNode(text.length > 90 ? text.slice(0, 88) + '…' : text));
    const box = $('#cues')!;
    box.append(c);
    while (box.children.length > 3) box.firstChild?.remove();
    setTimeout(() => c.remove(), 5100);
  }
  function logLive(kind: string, text: string) {
    const li = h('li');
    const s = perf?.t0 ? Math.max(0, (performance.now() - perf.t0) / 1000) : 0;
    li.append(h('time', '', `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`), h('span', 'k', kind), h('span', '', text));
    $('#dr-live')!.append(li);
  }

  /* ============ Settings modal ============ */
  function openSettings(msg?: string) {
    $('#modal-sub')!.textContent = msg || 'Configure the performance model, length, and backstage features.';
    $<HTMLSelectElement>('#set-model')!.value = settings.model;
    $$('#set-len button').forEach(b => b.classList.toggle('on', +(b.dataset.v || 0) === settings.seconds));
    $('#set-director')!.classList.toggle('on', settings.director);
    $('#set-sfx')!.classList.toggle('on', settings.sfx);
    $('#set-paint')!.classList.toggle('on', settings.paint);
    $('#modal')!.hidden = false;
    setTimeout(() => $('#set-save')?.focus(), 50);
  }
  const closeSettings = () => { const m = $('#modal'); if (m) m.hidden = true; };
  $$('#set-len button').forEach(b => {
    b.onclick = () => $$('#set-len button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#set-director')!.onclick = e => (e.currentTarget as HTMLElement).classList.toggle('on');
  $('#set-sfx')!.onclick = e => (e.currentTarget as HTMLElement).classList.toggle('on');
  $('#set-paint')!.onclick = e => (e.currentTarget as HTMLElement).classList.toggle('on');
  $('#set-cancel')!.onclick = closeSettings;
  $('#set-save')!.onclick = () => {
    settings.model = $<HTMLSelectElement>('#set-model')!.value;
    settings.seconds = +($('#set-len button.on')?.dataset.v || 60);
    settings.director = $('#set-director')!.classList.contains('on');
    settings.sfx = $('#set-sfx')!.classList.contains('on');
    settings.paint = $('#set-paint')!.classList.contains('on');
    saveSettings();
    syncHeader();
    closeSettings();
    state.items.filter(i => !i.img).forEach(paintSticker);
    toast(`Ready · ${modelLabel()}`);
  };
  on($('#modal')!, 'pointerdown', (e: Event) => {
    if ((e.target as HTMLElement).id === 'modal') closeSettings();
  });
  function syncHeader() {
    const modelName = $('#modelname');
    if (modelName) modelName.textContent = modelLabel();
    const liveModel = $('#live-model');
    if (liveModel) liveModel.textContent = modelLabel().toUpperCase();
  }

  /* ============ Toast ============ */
  function toast(msg: string, err = false) {
    const t = h('div', 'toast' + (err ? ' err' : ''), msg);
    $('#toasts')?.append(t);
    setTimeout(() => t.remove(), 3700);
  }

  /* ============ Wiring ============ */
  on($('#world')!, 'pointerdown', (ev: Event) => {
    const e = ev as PointerEvent;
    if (e.button !== 0 || (e.target as HTMLElement).closest('.sticker')) return;
    if (!pop.hidden) { closePop(); return; }
    openPop(e.clientX, e.clientY);
  });
  on(frame, 'pointerdown', (ev: Event) => {
    const e = ev as PointerEvent;
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    if (!pop.hidden) { closePop(); return; }
    if (state.phase === 'idle' || state.phase === 'live') openPop(e.clientX, e.clientY);
  });
  on(document, 'pointerdown', (ev: Event) => {
    const t = ev.target as HTMLElement;
    if (!pop.hidden && !t.closest('.pop') && !t.closest('#world') && !t.closest('#frame')) closePop();
  });
  $('#btn-begin')!.onclick = () => begin(false);
  $('#btn-cancel')!.onclick = () => { state.run++; perf?.cancel(); setPhase('idle'); };
  $('#btn-stop')!.onclick = () => perf?.end('user');
  $('#btn-encore')!.onclick = () => begin(true);
  $('#btn-back')!.onclick = () => { audio.reset(); setPhase('idle'); };
  $('#btn-retry')!.onclick = () => begin(false);
  $('#btn-err-back')!.onclick = () => setPhase('idle');
  $('#btn-err-settings')!.onclick = () => openSettings();
  const errKeyBtn = $('#btn-err-key');
  if (errKeyBtn) errKeyBtn.onclick = () => keyHooks.openApiKeyPicker();
  $('#btn-save')!.onclick = () => {
    if (!recUrl) return;
    const a = h('a');
    a.href = recUrl;
    a.download = `ensemble-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${recorder?.ext || 'webm'}`;
    a.click();
  };
  $('#btn-settings')!.onclick = () => openSettings();
  $('#btn-model')!.onclick = () => openSettings();
  $$('#tabs button').forEach(b => {
    b.onclick = () => {
      state.tab = b.dataset.tab as 'genre' | 'venue' | 'era';
      renderChips();
      $('#chips')!.scrollLeft = 0;
    };
  });
  $('#btn-dice')!.onclick = () => {
    const present = new Set(state.items.map(i => i.id));
    const pool = INSTRUMENTS.map(d => d[0]).filter(id => !present.has(id)).sort(() => Math.random() - 0.5);
    if (!pool.length) { toast('Every instrument is already on stage'); return; }
    const n = Math.min(pool.length, 4 + Math.floor(Math.random() * 3)), live = state.phase === 'live';
    pool.slice(0, n).forEach((id, k) => setTimeout(() => {
      const p = freeSpot();
      spawnInstrument(id, p.x, p.y, 0, live);
      if (!live) sfx('on', k * 2);
    }, k * 140));
    if (!state.genres.size) state.genres.add(GENRES[Math.floor(Math.random() * GENRES.length)]);
    if (!state.venue) { const vs = Object.keys(VENUES); state.venue = vs[Math.floor(Math.random() * vs.length)]; }
    renderChips();
    refresh();
    if (live) {
      setTimeout(
        () => liveCue(`New players join the band: ${listJoin(pool.slice(0, n).map(id => INSTRUMENTS.find(d => d[0] === id)![1].toLowerCase()))}. The music keeps flowing.`, 'JOIN'),
        n * 140 + 50
      );
    }
  };
  $('#btn-clear')!.onclick = () => {
    [...state.items].forEach(removeItem);
    state.genres.clear();
    state.venue = null;
    state.era = null;
    renderChips();
    refresh();
    sfx('off', 0);
  };
  $('#dr-bar')!.onclick = () => $('#drawer')!.classList.toggle('open');
  $$('.dr-tabs button[data-p]').forEach(b => {
    b.onclick = () => {
      $$('.dr-tabs button[data-p]').forEach(x => x.classList.toggle('on', x === b));
      $$('.dr-pane').forEach(p => p.classList.toggle('on', p.dataset.p === b.dataset.p));
    };
  });
  $('#dr-copy')!.onclick = async () => {
    const text = state.phase !== 'idle' && state.finalPrompt ? state.finalPrompt : currentPrompt();
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = h('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove();
    }
    toast('Prompt copied');
  };
  $('#dr-edit')!.onclick = () => {
    const box = $('#dr-text')!, editing = box.contentEditable === 'true';
    if (!editing) {
      box.contentEditable = 'true';
      box.textContent = currentPrompt();
      box.focus();
      $('#dr-edit')!.textContent = 'Done';
    } else {
      box.contentEditable = 'false';
      const v = box.innerText.trim();
      state.override = v && v !== segsText(compose()) ? v : null;
      $('#dr-edit')!.textContent = 'Edit';
      renderPrompt();
    }
  };
  $('#dr-reset')!.onclick = () => {
    state.override = null;
    $('#dr-text')!.contentEditable = 'false';
    $('#dr-edit')!.textContent = 'Edit';
    renderPrompt();
  };
  on(document, 'keydown', (ev: Event) => {
    const e = ev as KeyboardEvent;
    const welcome = $('#welcome');
    if (welcome && !welcome.hidden) return;
    const typing = (e.target as HTMLElement)?.closest('input, [contenteditable=true], select');
    if (e.key === 'Escape') { closePop(); closeSettings(); $('#drawer')?.classList.remove('open'); }
    if (typing) return;
    if (e.key === '/') { e.preventDefault(); openPop(innerWidth / 2 - 180, L.ft + 40); }
    else if (e.key.toLowerCase() === 'p') $('#drawer')?.classList.toggle('open');
    else if (e.key === 'Enter' && state.phase === 'idle' && $('#modal')?.hidden && !$<HTMLButtonElement>('#btn-begin')?.disabled) begin(false);
  });
  let rz = 0;
  on(window, 'resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(layout); });

  /* ============ Nano Banana sticker painter ============ */
  const paintCache = new Map<string, Promise<string>>();
  const SUBJECT: Record<string, (l: string) => string> = {
    instrument: l => `ONLY the musical instrument "${l}", shown whole`,
    singer: l => `a vintage stage microphone styled to evoke a "${l}" vocalist`,
    beat: l => `a single drum or percussion object that embodies the rhythm "${l}"`,
    style: l => `one iconic object that symbolizes the music style "${l}"`,
    tone: l => `one audio object (tape reel, amplifier, speaker, vinyl record or similar) that evokes a "${l}" sound`,
    mood: l => `one evocative symbolic object that captures the feeling "${l}"`,
    venue: l => `a miniature iconic emblem of the place "${l}"`,
    fx: l => `one object or natural element that represents the ambient sound "${l}"`,
  };
  const stickerPrompt = (it: StageItem) => `A single premium die-cut sticker of ${(SUBJECT[it.kind] || SUBJECT.instrument)(it.label)}. No people, no hands, no faces, no text, no letters, no logos, no extra props.
Rich, tasteful semi-realistic gouache / editorial illustration with crisp clean edges, subtle painterly texture and soft highlights, warm sophisticated palette (deep brass golds, walnut wood, ivory, oxblood, teal accents) — boutique record-label merch sticker.
The subject is shown at a slight dynamic 3/4 angle, centered, filling about 75% of the frame.
A clean, even, THICK solid WHITE die-cut sticker border surrounds the subject's silhouette.
Background: perfectly flat, uniform pure chroma green (#00FF00) everywhere outside the white border — no gradient, no shadow, no texture. Square 1:1.`;

  async function paintSticker(it: StageItem) {
    if (it.img || !settings.paint) return;
    const ready = await keyHooks.ensureApiKey();
    if (!ready) return;
    const k = it.kind + ':' + it.label.toLowerCase();
    const tag = it.el?.querySelector('.tag');
    const tagText = tag?.textContent || '';
    it.el?.classList.add('painting');
    if (tag) tag.textContent = '✦ Painting…';
    try {
      if (!paintCache.has(k)) paintCache.set(k, generateSticker(it).catch(e => { paintCache.delete(k); throw e; }));
      const url = await paintCache.get(k)!;
      if (!state.items.includes(it) || it.img) return;
      swapToImage(it, url);
    } catch (e: any) {
      console.warn('sticker paint failed', e);
      if (e?.isKeyError) {
        keyHooks.onApiKeyError(e.message);
      } else if (state.items.includes(it)) {
        toast(`Couldn't paint “${it.label}” — keeping the label`, true);
      }
      it.el?.classList.remove('painting');
      if (tag) tag.textContent = tagText;
    }
  }
  async function generateStickerViaProxy(prompt: string, signal: AbortSignal) {
    const models = ['gemini-3.1-flash-lite-image', 'gemini-nano-banana-2.1'];
    let lastErr: any = null;
    for (const model of models) {
      try {
        const r = await fetch(`${GOOGLE_API_HTTPS}/v1beta/interactions`, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            input: prompt,
            response_modalities: ['image'],
            generation_config: { image_config: { aspect_ratio: '1:1' } },
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.error) {
          const msg = j.error?.message || `HTTP ${r.status}`;
          const err = new Error(msg) as Error & { isKeyError?: boolean };
          err.isKeyError = isApiKeyError(r.status || j.error?.code, msg);
          if (err.isKeyError) throw err;
          lastErr = err;
          continue;
        }
        const img = j.output_image;
        if (img?.data) {
          return await keyOut(`data:${img.mime_type || 'image/png'};base64,${img.data}`);
        }
        for (const step of j.steps || []) {
          if (step.type === 'model_output') {
            const imagePart = step.content?.find((c: any) => c.type === 'image');
            if (imagePart?.data) {
              return await keyOut(`data:${imagePart.mime_type || 'image/png'};base64,${imagePart.data}`);
            }
          }
        }
        throw new Error('no image returned');
      } catch (err: any) {
        if (err?.isKeyError || err?.name === 'AbortError') throw err;
        lastErr = err;
      }
    }
    throw lastErr || new Error('no image returned');
  }

  async function generateSticker(it: StageItem) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 90000);
    try {
      if (useBrowserGoogleProxy()) {
        return await generateStickerViaProxy(stickerPrompt(it), ctl.signal);
      }
      const r = await fetch('/api/sticker', {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: stickerPrompt(it) }),
      });
      const j = await r.json();
      if (!r.ok || j.error) {
        const msg = j.error?.message || 'no image returned';
        const err = new Error(msg) as Error & { isKeyError?: boolean };
        err.isKeyError = isApiKeyError(r.status || j.error?.code, msg);
        throw err;
      }
      if (!j.data) throw new Error('no image returned');
      return await keyOut(`data:${j.mimeType || 'image/png'};base64,${j.data}`);
    } finally { clearTimeout(to); }
  }
  async function keyOut(src: string) {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const N = 420, c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const sc = Math.min(N / img.width, N / img.height);
    g.drawImage(img, (N - img.width * sc) / 2, (N - img.height * sc) / 2, img.width * sc, img.height * sc);
    const id = g.getImageData(0, 0, N, N), px = id.data;
    const at = (x: number, y: number) => (y * N + x) * 4;
    let kr = 0, kg = 0, kb = 0;
    [[3, 3], [N - 4, 3], [3, N - 4], [N - 4, N - 4]].forEach(([x, y]) => {
      const i = at(x, y); kr += px[i]; kg += px[i + 1]; kb += px[i + 2];
    });
    kr /= 4; kg /= 4; kb /= 4;
    const isBg = (i: number) => {
      const r = px[i], gg = px[i + 1], b = px[i + 2];
      return px[i + 3] < 8 || Math.hypot(r - kr, gg - kg, b - kb) < 110 || (gg > 110 && gg > r * 1.35 && gg > b * 1.35);
    };
    const seen = new Uint8Array(N * N), q: number[] = [];
    for (let x = 0; x < N; x++) q.push(x, 0, x, N - 1);
    for (let y = 0; y < N; y++) q.push(0, y, N - 1, y);
    while (q.length) {
      const y = q.pop()!, x = q.pop()!;
      const p = y * N + x;
      if (seen[p]) continue;
      seen[p] = 1;
      const i = p * 4;
      if (!isBg(i)) continue;
      px[i + 3] = 0;
      if (x > 0) q.push(x - 1, y);
      if (x < N - 1) q.push(x + 1, y);
      if (y > 0) q.push(x, y - 1);
      if (y < N - 1) q.push(x, y + 1);
    }
    for (let p = 0; p < N * N; p++) {
      const i = p * 4, r = px[i], gg = px[i + 1], b = px[i + 2];
      if (gg > 140 && gg > r * 1.6 && gg > b * 1.6) px[i + 3] = 0;
    }
    const a0 = new Uint8Array(N * N);
    for (let p = 0; p < N * N; p++) a0[p] = px[p * 4 + 3];
    for (let y = 1; y < N - 1; y++) {
      for (let x = 1; x < N - 1; x++) {
        const p = y * N + x, i = p * 4;
        if (!a0[p]) continue;
        if (!a0[p - 1] || !a0[p + 1] || !a0[p - N] || !a0[p + N]) {
          px[i + 3] = 110;
          px[i + 1] = Math.min(px[i + 1], Math.max(px[i], px[i + 2]));
        }
      }
    }
    g.putImageData(id, 0, 0);
    let x0 = N, y0 = N, x1 = 0, y1 = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (px[at(x, y) + 3] > 20) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 <= x0 || y1 <= y0) throw new Error('empty sticker after keying');
    const w = x1 - x0 + 1, hh = y1 - y0 + 1, side = Math.max(w, hh) + 16, o = document.createElement('canvas');
    o.width = o.height = 380;
    const k = 380 / side;
    o.getContext('2d')!.drawImage(c, x0, y0, w, hh, (380 - w * k) / 2, (380 - hh * k) / 2, w * k, hh * k);
    const out = o.toDataURL('image/webp', 0.9);
    return out.startsWith('data:image/webp') ? out : o.toDataURL('image/png');
  }
  function swapToImage(it: StageItem, url: string) {
    const old = it.el;
    it.img = url;
    buildSticker(it, null);
    it.el!.classList.toggle('on', !!it.on);
    it.el!.classList.add('fresh');
    it.el!.addEventListener('animationend', () => it.el?.classList.remove('fresh'), { once: true });
    if (old) { old.classList.add('poof'); setTimeout(() => old.remove(), 400); }
    $('#cast')?.querySelector(`[data-id="${it.id}"]`)?.remove();
    refresh();
    sfx('open');
  }

  /* ============ Init ============ */
  renderLegend();
  renderChips();
  renderFaders();
  layout();
  syncHeader();
  refresh();
  setPhase('idle');
  tick();

  return {
    playOpenSfx: () => sfx('open'),
    relayout: layout,
    toast,
    dispose: () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(rz);
      clearInterval(statusTimer);
      clearTimeout(faderTimer);
      perf?.cancel();
      audio.reset();
      cleanups.forEach(fn => fn());
    },
  };
}
