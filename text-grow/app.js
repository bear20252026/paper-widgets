/* Text Bloom — dashboard + sprite sets. Every set is a grid of individually
   selectable items (emoji or PNG); the engine plays whatever is ticked.
   Emoji can be drawn from the system font (Apple on Mac/iOS) or from one of
   four open emoji libraries, fetched as PNGs from jsDelivr. */
(function () {
  // curated 2026-10-08: complete figures, official-render style, flat studio light only
  // 10/8 cull: mark/henry/mega-* (darker or greyer yellow), guard + napoleons (hats too loud)
  const MINIONS = ['kevin', 'stuart', 'bob', 'dave', 'carl', 'ed', 'dick', 'otto', 'ron', 'james',
    'kevin-caveman', 'kevin-dawn', 'kevin-dracula', 'kevin-pirate', 'kevin-walk',
    'stuart-caveman', 'stuart-dawn', 'stuart-dracula', 'stuart-pharaoh', 'stuart-pirate',
    'stuart-guitar', 'stuart-ukulele', 'bob-caveman'];

  // [emoji, Fluent asset name]
  const E = (emoji, name) => ({ key: emoji, emoji, name });
  const GUMMY_SHAPES = ['bear', 'heart', 'flower', 'bow', 'star', 'worm'];
  const SETS = [
    { id: 'minions', name: 'minions', upright: true, scale: 4.2, density: 0.72, // bigger and sparser than the emoji
      palette: ['#f5c400', '#ffd84a', '#2e55a8', '#4d7be0', '#1b1b1b', '#ffffff'],
      items: MINIONS.map(n => ({ key: n, src: `assets/minions/${n}.png` })) },
    // the gummies and bubbles are Gemini contact sheets, keyed out and sliced (tools in the scratchpad)
    { id: 'pastel', name: 'pastel gummies', upright: true, scale: 3.4, density: 0.75, jelly: true,
      palette: ['#f2a7a0', '#f6dc86', '#b9e3b4', '#b7d8ea', '#d9b8e6', '#f4b98f'],
      items: Array.from({ length: 12 }, (_, i) => ({ key: `pastel-${String(i + 1).padStart(2, '0')}`, src: `assets/gummy/pastel-${String(i + 1).padStart(2, '0')}.png` })) },
    { id: 'shapes', name: 'bubble shapes', upright: true, scale: 3.6, density: 0.65, float: true, shed: 'pop', blend: true,
      palette: ['#ffd1e8', '#cfe8ff', '#d6ffe3', '#fff3c4', '#ffffff'],
      items: ['star', 'heart', 'bunny', 'butterfly', 'note', 'bear', 'sparkle', 'cloud', 'round'].map(s => ({ key: `shape-${s}`, blend: true,
        src: `assets/bubbles/shape-light-${s}.png`, srcDark: `assets/bubbles/shape-dark-${s}.png` })) },
    { id: 'flowers', name: 'flowers', upright: false, scale: 2.4, shed: 'petal', items: [
      E('🌸', 'cherry_blossom'), E('🌼', 'blossom'), E('🌷', 'tulip'), E('🌺', 'hibiscus'), E('🌻', 'sunflower'),
      E('💮', 'white_flower'), E('🪷', 'lotus'), E('🌹', 'rose'), E('🏵️', 'rosette')] },
    { id: 'trees', name: 'trees', upright: true, scale: 2.9, shed: 'sink', items: [ // sinks back into the soil
      E('🌳', 'deciduous_tree'), E('🌲', 'evergreen_tree'), E('🌴', 'palm_tree'), E('🌵', 'cactus'),
      E('🎋', 'tanabata_tree'), E('🎄', 'christmas_tree')] },
    { id: 'grass', name: 'grass', upright: true, scale: 2.4, shed: 'blow', items: [ // blown away sideways
      E('🌿', 'herb'), E('🌱', 'seedling'), E('☘️', 'shamrock'), E('🍀', 'four_leaf_clover'),
      E('🌾', 'sheaf_of_rice'), E('🪴', 'potted_plant'), E('🍃', 'leaf_fluttering_in_wind')] },
  ];

  // ---------- emoji libraries ----------
  const cps = ch => [...ch].map(c => c.codePointAt(0).toString(16)).filter(h => h !== 'fe0f').join('-');
  const STYLES = {
    emoji:    { name: 'emoji',    url: null }, // the system's own emoji font
    twemoji:  { name: 'twemoji',  url: it => `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/${cps(it.emoji)}.png` },
    openmoji: { name: 'openmoji', url: it => `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@15.0.0/color/72x72/${cps(it.emoji).toUpperCase()}.png` },
  };

  // ---------- "yours": whatever emoji the user types into the box, for this visit only ----------
  const grapher = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const pickEmoji = text => { // every emoji grapheme in a string, nothing else
    const parts = grapher ? [...grapher.segment(text)].map(s => s.segment) : [...text];
    return [...new Set(parts.filter(p => /\p{Extended_Pictographic}/u.test(p)))];
  };
  SETS.push({ id: 'yours', name: 'yours', upright: true, scale: 2.6, items: [] });
  let style = 'emoji';
  try { if (STYLES[localStorage.getItem('bloom-style')]) style = localStorage.getItem('bloom-style'); } catch (e) {}
  const isDark = () => document.documentElement.dataset.theme !== 'light';
  const itemUrl = it => (it.src ? (it.srcDark && isDark() ? it.srcDark : it.src) : it.emoji && STYLES[style].url ? STYLES[style].url(it) : null);

  // ---------- sprite rasterisation ----------
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function crop(src, w, h) {
    try {
      const x = src.getContext('2d', { willReadFrequently: true });
      const d = x.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
        if (d[(y * w + xx) * 4 + 3] > 10) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return null;
      const o = document.createElement('canvas');
      o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
      o.getContext('2d', { willReadFrequently: true }).drawImage(src, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
      return { img: o, w: o.width, h: o.height };
    } catch (e) { return null; }
  }

  function rasterEmoji(ch, px = 112) {
    const c = document.createElement('canvas');
    c.width = c.height = px + 40;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.font = `${px}px ${EMOJI_FONT}`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ch, c.width / 2, c.height / 2 + px * 0.04);
    return crop(c, c.width, c.height);
  }

  // ---------- gummy candy: shapes drawn in code, one jelly shader for all ----------
  const GUMMY_COLORS = ['#e3242b', '#ff8a1f', '#f5c518', '#35b24d', '#2a74d8', '#9b4fd6', '#d9a3e8']; // the bag in the photo
  const gummyPath = {
    bear(x) { // round head, two ears, a pear of a body, stubby limbs
      x.arc(50, 34, 21, 0, 7); x.moveTo(41, 15); x.arc(32, 15, 9, 0, 7); x.moveTo(77, 15); x.arc(68, 15, 9, 0, 7);
      x.moveTo(72, 66); x.ellipse(50, 70, 22, 24, 0, 0, 7);
      x.moveTo(33, 62); x.ellipse(25, 62, 8, 13, -0.3, 0, 7); x.moveTo(83, 62); x.ellipse(75, 62, 8, 13, 0.3, 0, 7);
      x.moveTo(47, 90); x.ellipse(37, 90, 10, 8, 0, 0, 7); x.moveTo(73, 90); x.ellipse(63, 90, 10, 8, 0, 0, 7);
    },
    heart(x) { x.moveTo(50, 90); x.bezierCurveTo(10, 60, 10, 22, 32, 18); x.bezierCurveTo(43, 16, 49, 24, 50, 30); x.bezierCurveTo(51, 24, 57, 16, 68, 18); x.bezierCurveTo(90, 22, 90, 60, 50, 90); },
    flower(x) { for (let i = 0; i < 5; i++) { const a = i * 1.2566 - 1.5708; x.moveTo(50 + 24 * Math.cos(a) + 16, 50 + 24 * Math.sin(a)); x.arc(50 + 24 * Math.cos(a), 50 + 24 * Math.sin(a), 16, 0, 7); } x.moveTo(64, 50); x.arc(50, 50, 14, 0, 7); },
    bow(x) { // two loops, a knot, two tails
      x.moveTo(50, 50); x.bezierCurveTo(10, 10, 6, 70, 50, 50); x.moveTo(50, 50); x.bezierCurveTo(90, 10, 94, 70, 50, 50);
      x.moveTo(50, 52); x.bezierCurveTo(30, 60, 26, 86, 38, 90); x.bezierCurveTo(44, 80, 46, 66, 50, 52);
      x.moveTo(50, 52); x.bezierCurveTo(70, 60, 74, 86, 62, 90); x.bezierCurveTo(56, 80, 54, 66, 50, 52);
      x.moveTo(58, 50); x.arc(50, 50, 8, 0, 7);
    },
    star(x) { for (let i = 0; i < 10; i++) { const r = i % 2 ? 18 : 42, a = i * 0.6283 - 1.5708; x[i ? 'lineTo' : 'moveTo'](50 + r * Math.cos(a), 52 + r * Math.sin(a)); } x.closePath(); },
    worm: { stroke: 17, draw(x) { x.moveTo(22, 72); x.bezierCurveTo(22, 40, 50, 40, 50, 62); x.bezierCurveTo(50, 84, 78, 84, 78, 50); } },
  };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (h, to, t) => { const a = hex(h); return `rgb(${a.map(v => Math.round(v + (to - v) * t)).join(',')})`; };
  // Wet glass: a deep saturated body, a dark band of thickness along the edge, a thin
  // bright rim where light comes through from behind, and a few hard white glints.
  function rasterGummy(shape, color, px = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.scale(px / 100, px / 100);
    const spec = gummyPath[shape], p = new Path2D();
    (spec.draw || spec)(p);
    const w = spec.stroke || 0; // the worm is a stroked path, the rest are filled
    x.lineCap = x.lineJoin = 'round';
    const paint = () => { if (w) { x.lineWidth = w; x.stroke(p); } else x.fill(p); };
    const edge = (lw, dx, dy, style, blur, alpha) => { // the outline, shifted, landing only on the body
      x.save(); x.globalAlpha = alpha; x.filter = blur ? `blur(${blur}px)` : 'none';
      x.strokeStyle = style; x.lineWidth = lw; x.translate(dx, dy); x.stroke(p); x.restore();
    };
    // 1. body: lit from the top-left, deeper towards the edges
    const g = x.createRadialGradient(40, 36, 4, 50, 54, 62);
    g.addColorStop(0, mix(color, 255, 0.28)); g.addColorStop(0.55, color); g.addColorStop(1, mix(color, 0, 0.42));
    x.fillStyle = x.strokeStyle = g; x.globalAlpha = 0.97; paint();
    x.globalCompositeOperation = 'source-atop';
    if (w) { // the worm: a rim all round (white under, body re-painted narrower on top), then the dark band
      edge(w, 0, 0, 'rgba(255,255,255,0.9)', 0.8, 0.6);
      x.save(); x.strokeStyle = g; x.lineWidth = w - 4.4; x.stroke(p); x.restore();
      edge(w, 0, 5, 'rgba(0,0,0,0.6)', 3, 0.5);
    } else {
      // 2. thickness: a dark, blurred band just inside the edge, heavier at the bottom
      edge(10, 0, 2.5, 'rgba(0,0,0,0.6)', 3, 0.55);
      // 3. light through the candy: a thin bright rim on the far (lower-right) side
      edge(2.2, -1.6, -1.6, 'rgba(255,255,255,0.9)', 0.8, 0.55);
      // 4. the wet surface: a crisp reflection along the near (upper-left) edge
      edge(2, 2, 2.2, 'rgba(255,255,255,0.95)', 0.4, 0.75);
    }
    // 5. a soft bloom of light, then hard glints
    x.save(); x.globalAlpha = 0.25; x.filter = 'blur(5px)'; x.fillStyle = '#fff';
    x.beginPath(); x.ellipse(40, 36, 11, 8, -0.5, 0, 7); x.fill(); x.restore();
    x.fillStyle = '#fff';
    for (const [gx, gy, rx, ry, a] of [[35, 27, 5.5, 3, 0.95], [47, 22, 1.8, 1.4, 0.9], [29, 40, 1.4, 1.1, 0.85], [62, 68, 1.6, 1.2, 0.6]]) {
      x.globalAlpha = a; x.beginPath(); x.ellipse(gx, gy, rx, ry, -0.6, 0, 7); x.fill();
    }
    return crop(c, px, px);
  }
  const gummyItemColor = item => GUMMY_COLORS[GUMMY_SHAPES.indexOf(item.gummy) % GUMMY_COLORS.length];

  // ---------- soap bubbles: a faint glass body, an iridescent rim, two glints ----------
  const BUBBLE_TINTS = [320, 200, 120, 40];
  function rasterBubble(n, tint, px = 128) {
    const c = document.createElement('canvas');
    c.width = px * (n > 1 ? 1.5 : 1); c.height = px * (n > 2 ? 1.3 : 1);
    const x = c.getContext('2d', { willReadFrequently: true });
    const one = (cx, cy, r, hue) => {
      const g = x.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.03)'); g.addColorStop(0.8, 'rgba(255,255,255,0.07)'); g.addColorStop(1, 'rgba(255,255,255,0.3)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
      const N = 40;
      for (let i = 0; i < N; i++) { // the rim: a sweep of hues, soft
        const a0 = (i / N) * 6.2832, a1 = ((i + 1.3) / N) * 6.2832;
        x.strokeStyle = `hsla(${(hue + i * 9) % 360}, 90%, 72%, 0.6)`; x.lineWidth = r * 0.09;
        x.beginPath(); x.arc(cx, cy, r * 0.955, a0, a1); x.stroke();
      }
      x.strokeStyle = 'rgba(255,255,255,0.4)'; x.lineWidth = r * 0.04;
      x.beginPath(); x.arc(cx, cy, r * 0.87, 0, 7); x.stroke();
      x.fillStyle = 'rgba(255,255,255,0.9)';
      x.beginPath(); x.ellipse(cx - r * 0.42, cy - r * 0.45, r * 0.22, r * 0.11, -0.7, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.6)';
      x.beginPath(); x.ellipse(cx + r * 0.36, cy + r * 0.5, r * 0.11, r * 0.05, -0.7, 0, 7); x.fill();
    };
    const r = px * 0.44;
    if (n === 1) one(px / 2, px / 2, r, tint);
    else if (n === 2) { one(px * 0.5, px * 0.5, r, tint); one(px * 1.08, px * 0.56, r * 0.62, tint + 60); }
    else { one(px * 0.5, px * 0.5, r, tint); one(px * 1.1, px * 0.62, r * 0.62, tint + 60); one(px * 0.78, px * 1.02, r * 0.4, tint + 130); }
    return crop(c, c.width, c.height);
  }

  function loadImage(url) {
    return new Promise((res, rej) => {
      const im = new Image();
      if (/^https?:/.test(url)) im.crossOrigin = 'anonymous';
      im.onload = () => res(im); im.onerror = rej; im.src = url;
    });
  }

  async function rasterImage(url) {
    const im = await loadImage(url);
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    c.getContext('2d', { willReadFrequently: true }).drawImage(im, 0, 0);
    return crop(c, c.width, c.height) || { img: im, w: im.naturalWidth, h: im.naturalHeight };
  }

  // goggle positions per minion (fractions of the cropped sprite), baked offline
  const EYES = fetch('assets/minions/eyes.json').then(r => r.json()).catch(() => ({}));

  // speck palette: random opaque pixels sampled from the sprites
  function paletteFrom(sprites, n = 18) {
    const out = [];
    try {
      for (let i = 0; i < n * 4 && out.length < n; i++) {
        const s = sprites[i % sprites.length];
        const x = s.img.getContext('2d', { willReadFrequently: true });
        const px = x.getImageData(Math.floor(Math.random() * s.w), Math.floor(Math.random() * s.h), 1, 1).data;
        if (px[3] > 200) out.push(`rgb(${px[0]},${px[1]},${px[2]})`);
      }
    } catch (e) { /* tainted canvas — fall through */ }
    return out.length ? out : ['#e86f5a', '#f2b544', '#5b8def', '#4caf83', '#f28ab2'];
  }

  // the sprite's own silhouette in ink, for the moment it sprouts out of the text
  function inkOf(spr, color) {
    const c = document.createElement('canvas');
    c.width = spr.w; c.height = spr.h;
    const x = c.getContext('2d');
    x.drawImage(spr.img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color; x.fillRect(0, 0, spr.w, spr.h);
    return c;
  }
  const cssInk = () => getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#111';

  const rasterCache = new Map(); // `${style}:${key}` → Promise<sprite|null>
  function raster(item) {
    const url = itemUrl(item);
    const id = (item.src ? (item.srcDark && isDark() ? 'pngD' : 'png') : style) + ':' + item.key;
    if (!rasterCache.has(id)) {
      const job = item.gummy
        ? Promise.resolve(GUMMY_COLORS.map(col => rasterGummy(item.gummy, col)).filter(Boolean)) // one sprite per candy colour
        : item.bubble
        ? Promise.resolve(BUBBLE_TINTS.map(tint => rasterBubble(item.bubble, tint)).filter(Boolean)) // one per rim tint
        : (async () => {
            const u = url || itemUrl(item);
            if (!u) return rasterEmoji(item.emoji);
            try {
              const spr = await rasterImage(u);
              const e = item.src && (await EYES)[item.key];
              if (e) spr.eyes = e.map(q => ({ x: (q.x - 0.5) * spr.w, y: (q.y - 0.5) * spr.h, r: q.r * spr.h }));
              return spr;
            } catch (err) { return item.emoji ? rasterEmoji(item.emoji) : null; } // CDN miss → system emoji
          })();
      rasterCache.set(id, job.then(r => {
        for (const spr of Array.isArray(r) ? r : [r]) {
          if (spr && !spr.ink) { spr.ink = inkOf(spr, '#111111'); spr.inkW = inkOf(spr, '#ededed'); }
        }
        return r;
      }));
    }
    return rasterCache.get(id);
  }

  // ---------- selection state ----------
  const picked = new Map(SETS.map(s => [s.id, new Set(s.items.map(i => i.key))]));
  const activeSets = () => SETS.filter(s => picked.get(s.id).size > 0);

  async function buildSet(set) {
    const keys = picked.get(set.id);
    const items = set.items.filter(i => keys.has(i.key));
    const sprites = (await Promise.all(items.map(raster))).flat().filter(Boolean);
    if (!sprites.length) return null;
    // petals match the emoji style: outlined like openmoji, flat otherwise
    const petal = style === 'openmoji' ? 'outline' : 'flat';
    return { ...set, sprites, petal, palette: set.palette || paletteFrom(sprites) };
  }

  // ---------- UI ----------
  const $ = s => document.querySelector(s);
  const app = $('.app'), stage = $('#stage'), canvas = $('#c');
  const textInput = $('#text'), startBtn = $('#start');
  const setsEl = $('#sets'), allBtn = $('#all');
  const loopSeg = $('#loop'), tabsSeg = $('#tabs');

  const engine = new TextBloom(canvas);
  const applyInk = () => engine.setInk(cssInk(), document.documentElement.dataset.theme !== 'light');
  applyInk();
  engine.setText(textInput.value);

  // the faces the text can be set in. Thin faces sample sparse, so each brings
  // a density correction; the canvas needs the webfont loaded before it lays out.
  const FONTS = {
    geist:  { family: 'Geist, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif', weight: 600, density: 1 },
    serif:  { family: '"Instrument Serif", Georgia, "Times New Roman", serif', weight: 400, density: 1.3 },
    rubik:  { family: '"Rubik Mono One", Impact, "Arial Black", sans-serif', weight: 400, density: 0.9 },
    script: { family: 'Caveat, "Comic Sans MS", cursive', weight: 700, density: 1.2 },
  };
  const fontSeg = $('#font');
  let fontId = 'geist';
  try { if (FONTS[localStorage.getItem('tg-font')]) fontId = localStorage.getItem('tg-font'); } catch (e) {}
  const applyFont = (id, then) => {
    const f = FONTS[id];
    for (const x of fontSeg.children) x.classList.toggle('on', x.dataset.val === id);
    const use = () => { if (fontId !== id) return; engine.setFont(f.family, f.weight, f.density); if (then) then(); };
    fontId = id;
    // layout with the fallback first so nothing waits, then again once the face is in
    engine.setFont(f.family, f.weight, f.density);
    document.fonts.load(`${f.weight} 100px ${f.family.split(',')[0]}`).then(use, use);
  };
  applyFont(fontId);
  fontSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.dataset.val === fontId) return;
    try { localStorage.setItem('tg-font', b.dataset.val); } catch (e) {}
    applyFont(b.dataset.val, () => { if (queue.length) playIdx(); }); // restart the current set in the new face
  });

  // which letters grow: a chip per letter under the text box. All grow until
  // you pick one (that isolates it); then chips toggle; turning the last one
  // off, or all of them on, goes back to every letter growing.
  const lettersEl = $('#letters');
  let sel = null; // Set of glyph indices, or null = all
  const paintLetters = () => {
    for (const b of lettersEl.querySelectorAll('button')) b.classList.toggle('on', !sel || sel.has(+b.dataset.i));
  };
  const buildLetters = () => {
    sel = null;
    lettersEl.replaceChildren();
    const gs = engine.glyphs, n = gs.filter(g => g.ch.trim()).length;
    if (n < 2) return; // one letter has nothing to choose
    gs.forEach((g, i) => {
      if (i && g.line !== gs[i - 1].line) lettersEl.append(Object.assign(document.createElement('i'), { className: 'br' }));
      if (!g.ch.trim()) return;
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.i = i; b.textContent = g.ch; b.className = 'on';
      lettersEl.append(b);
    });
  };
  lettersEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const i = +b.dataset.i, all = [...lettersEl.querySelectorAll('button')].map(x => +x.dataset.i);
    if (!sel) sel = new Set([i]);
    else if (sel.has(i)) sel.delete(i);
    else sel.add(i);
    if (!sel.size || sel.size === all.length) sel = null;
    paintLetters();
    engine.setMask(sel);
    if (queue.length) playIdx(); // restart the current set on the new letters
  });
  buildLetters();

  // picker
  const setEls = new Map(), refreshers = [];
  let rebuildYours = () => {}, yoursWanted = true; // the "yours" group follows the box below the picker
  const cellContent = (b, it) => {
    if (!b) return;
    const rm = b.querySelector('.rm'); // keep the × on a user's cell
    if (rm) queueMicrotask(() => b.appendChild(rm));
    if (it.gummy || it.bubble) {
      const s = it.gummy ? rasterGummy(it.gummy, gummyItemColor(it), 64) : rasterBubble(it.bubble, BUBBLE_TINTS[(it.bubble - 1) % BUBBLE_TINTS.length], 64);
      b.innerHTML = ''; if (s) { s.img.className = 'pv'; b.appendChild(s.img); } return;
    }
    const url = itemUrl(it);
    if (url) b.innerHTML = `<img class="${it.blend ? 'blend' : ''}" src="${url}" alt="${it.key}" loading="lazy" draggable="false">`;
    else b.textContent = it.emoji;
  };
  const CK = '<i class="ck"><svg viewBox="0 0 12 12"><path class="tick" d="M2.5 6.2 5 8.6l4.5-5"/><path class="dash" d="M3 6h6"/></svg></i>';
  const ckState = (n, of) => 'ck ' + (n === of ? 'all' : n ? 'some' : 'none');
  const total = () => SETS.reduce((n, s) => n + s.items.length, 0); // live: the "yours" group grows and shrinks
  const pickedCount = () => SETS.reduce((n, s) => n + picked.get(s.id).size, 0);
  allBtn.innerHTML = CK;
  const refreshAll = () => { allBtn.firstChild.className = ckState(pickedCount(), total()); };

  for (const set of SETS) {
    const el = document.createElement('div');
    el.className = 'set'; el.dataset.id = set.id;
    el.innerHTML = `<div class="set-head"><span class="set-name">${set.name}</span><button type="button" class="ckb" title="all / none">${CK}</button></div><div class="cells"></div>`;
    const cells = el.querySelector('.cells'), ck = el.querySelector('.ck');
    const keys = picked.get(set.id);
    const refresh = () => {
      ck.className = ckState(keys.size, set.items.length);
      for (const c of cells.children) c.classList.toggle('on', keys.has(c.dataset.key));
      refreshAll();
    };
    refreshers.push(refresh);
    const makeCell = it => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cell on'; b.dataset.key = it.key;
      if (it.emoji) b.title = it.key; // file names make poor tooltips
      cellContent(b, it);
      b.addEventListener('click', () => {
        if (keys.has(it.key)) keys.delete(it.key); else keys.add(it.key);
        refresh(); onSelectionChange();
      });
      return b;
    };
    for (const it of set.items) cells.appendChild(makeCell(it));
    if (set.id === 'yours') { // rebuilt from the box each time it changes
      el.hidden = true;
      rebuildYours = emojis => {
        set.items = emojis.map(e => ({ key: e, emoji: e }));
        keys.clear(); emojis.forEach(e => keys.add(e));
        cells.innerHTML = ''; set.items.forEach(it => cells.appendChild(makeCell(it)));
        el.hidden = !emojis.length || !yoursWanted;
        refresh(); onSelectionChange();
      };
    }
    el.querySelector('.ckb').addEventListener('click', () => { // checkbox: all ↔ none
      if (keys.size === set.items.length) keys.clear(); else set.items.forEach(i => keys.add(i.key));
      refresh(); onSelectionChange();
    });
    refresh();
    setsEl.appendChild(el);
    setEls.set(set.id, el);
  }
  allBtn.addEventListener('click', () => {
    const fill = pickedCount() !== total();
    for (const s of SETS) { const k = picked.get(s.id); k.clear(); if (fill) s.items.forEach(i => k.add(i.key)); }
    refreshers.forEach(f => f()); onSelectionChange();
  });

  // the box under the picker: type any emoji and it becomes the "yours" group
  const yoursBox = $('#yours');
  yoursBox.addEventListener('input', () => rebuildYours(pickEmoji(yoursBox.value)));
  yoursBox.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); yoursBox.blur(); start(); } });

  // tabs: the drawn / cut-out sets first, then the emoji styles
  const OWN_TABS = { minions: ['minions'], more: ['pastel', 'shapes'] }; // tabs of our own sets, not emoji styles
  const TABS = ['minions', ...Object.keys(STYLES), 'more']; // the star first, the emoji styles, then the rest
  for (const id of TABS) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.val = id; b.textContent = STYLES[id] ? STYLES[id].name : id;
    tabsSeg.appendChild(b);
  }
  function applyStyle(id) {
    style = id;
    try { localStorage.setItem('bloom-style', id); } catch (e) {}
    for (const set of SETS) {
      if (!set.items.some(i => i.emoji)) continue; // png sets, and an empty "yours"
      const cells = setEls.get(set.id).querySelectorAll('.cell');
      set.items.forEach((it, i) => cellContent(cells[i], it));
    }
    SETS.forEach(s => s.items.forEach(raster)); // warm
  }
  function applyTab(id) {
    for (const b of tabsSeg.children) b.classList.toggle('on', b.dataset.val === id);
    const own = OWN_TABS[id]; // an own tab shows its sets; a style tab shows the emoji sets
    const ownIds = Object.values(OWN_TABS).flat();
    for (const set of SETS) setEls.get(set.id).hidden = own ? !own.includes(set.id) : ownIds.includes(set.id);
    yoursWanted = !own; // the typed-in group belongs to the emoji tabs
    setEls.get('yours').hidden = own || !SETS.find(s => s.id === 'yours').items.length;
    yoursBox.hidden = !!own;
    if (!own && id !== style) {
      applyStyle(id);
      if (queue.length) playIdx(); // restart the current set in the new style
    }
  }
  tabsSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (b) applyTab(b.dataset.val);
  });
  applyStyle(style);
  applyTab('minions');

  // playback
  let queue = [], qi = 0, timer = null, loop = true;

  function setNow(set) { // the growing set is underlined in the picker
    for (const [id, el] of setEls) el.classList.toggle('live', !!set && id === set.id);
  }

  function onSelectionChange() {
    if (!queue.length) return;
    const cur = queue[qi];
    queue = activeSets();
    qi = Math.max(0, queue.indexOf(cur));
    setNow(queue[qi] || null);
  }

  async function playIdx() {
    clearTimeout(timer);
    const set = queue[qi];
    if (!set) { stopAll(); return; }
    setNow(set);
    const token = (playIdx.token = {});
    const built = await buildSet(set);
    if (playIdx.token !== token || queue[qi] !== set) return;
    if (!built) { next(); return; }
    engine.play(built);
  }

  function start() {
    queue = activeSets();
    if (!queue.length) return;
    qi = 0;
    playIdx();
  }

  function next() {
    if (!queue.length) { start(); return; }
    queue = activeSets();
    if (!queue.length) { stopAll(); return; }
    qi = (qi + 1) % queue.length;
    playIdx();
  }

  function stopAll() {
    clearTimeout(timer);
    queue = []; qi = 0;
    engine.stop();
    setNow(null);
  }

  engine.onEnd = () => {
    if (!queue.length) return;
    if (!loop && qi >= queue.length - 1) { queue = []; setNow(null); return; }
    timer = setTimeout(next, 900);
  };

  startBtn.addEventListener('click', start);
  // phones: the controls are a bottom sheet
  const isPhone = () => matchMedia('(max-width: 900px)').matches;
  // the pill is the sheet, folded: a tap grows it into the dashboard
  const side = $('.side');
  let drag = null, justDragged = false;
  side.addEventListener('click', () => {
    if (justDragged) { justDragged = false; return; } // the click that follows a drag
    if (isPhone() && !app.classList.contains('sheet-open')) app.classList.add('sheet-open');
  });
  // drag the sheet down to close it (only when its content is scrolled to the top)
  side.addEventListener('pointerdown', e => {
    if (!isPhone() || !app.classList.contains('sheet-open')) return;
    drag = { y: e.clientY, top: side.scrollTop, dy: 0, moved: false };
  });
  side.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved) { if (dy < 8 || side.scrollTop > 0) return; drag.moved = true; side.classList.add('dragging'); side.setPointerCapture(e.pointerId); }
    drag.dy = Math.max(0, dy);
    side.style.transform = `translateY(${drag.dy}px)`;
  }, { passive: true });
  const endDrag = () => {
    if (!drag) return;
    const closing = drag.moved && drag.dy > 90;
    justDragged = drag.moved;
    side.classList.remove('dragging'); side.style.transform = '';
    if (closing) app.classList.remove('sheet-open');
    drag = null;
  };
  side.addEventListener('pointerup', endDrag);
  side.addEventListener('pointercancel', endDrag);
  stage.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (isPhone() && app.classList.contains('sheet-open')) { app.classList.remove('sheet-open'); return; } // a tap outside closes the sheet
    const r = stage.getBoundingClientRect();
    engine.origin = { x: e.clientX - r.left, y: e.clientY - r.top }; // for order = 'tap'
    next();
  });
  // the text box grows with its lines; enter starts, shift+enter breaks a line
  const fitBox = () => { textInput.rows = Math.min(5, textInput.value.split('\n').length); }; // by lines, so a hidden box measures right
  textInput.addEventListener('input', () => { fitBox(); stopAll(); engine.setText(textInput.value); buildLetters(); });
  textInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); textInput.blur(); start(); }
  });
  fitBox();
  document.addEventListener('keydown', e => {
    if (e.key === ' ' && document.activeElement !== textInput) { e.preventDefault(); next(); }
  });

  // how sprites arrive, and in what order
  for (const [id, key] of [['#arrive', 'arrive'], ['#ease', 'ease'], ['#order', 'order']]) {
    const seg = $(id);
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.dataset.val === engine[key]) return;
      engine[key] = b.dataset.val;
      for (const x of seg.children) x.classList.toggle('on', x === b);
      if (queue.length) playIdx(); // restart the current set the new way
    });
  }

  loopSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    loop = b.dataset.val === 'loop';
    for (const x of loopSeg.children) x.classList.toggle('on', x === b);
  });

  // sliders: Geist-style rows with a fill that follows the thumb
  const fmt = {
    duration: v => (v / 1000).toFixed(1) + 's',
    size: v => '×' + (+v).toFixed(2),
    density: v => '×' + (+v).toFixed(2),
    spread: v => (+v).toFixed(2),
    sprout: v => +v === 0 ? 'off' : (+v).toFixed(2),
  };
  for (const el of document.querySelectorAll('input[type=range][data-key]')) {
    const key = el.dataset.key, row = el.closest('.row'), out = row.querySelector('output');
    const apply = () => {
      const v = parseFloat(el.value);
      engine[key] = v;
      out.textContent = fmt[key](el.value);
      row.style.setProperty('--pf', (v - el.min) / (el.max - el.min));
      if (key === 'density') engine.layout();
    };
    el.addEventListener('input', apply); apply();
  }

  // chrome: theme + side panel
  $('#theme').addEventListener('click', () => {
    const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('bloom-theme', t); } catch (e) {}
    applyInk();
    // things photographed per theme (bubbles) swap their source
    for (const set of SETS) {
      if (!set.items.some(i => i.srcDark)) continue;
      const cells = setEls.get(set.id).querySelectorAll('.cell');
      set.items.forEach((it, i) => cellContent(cells[i], it));
    }
    if (queue.length) playIdx();
  });
  // the heart in the credit line: lights up, remembered per browser
  const heartBtn = $('#heartBtn');
  let liked = false;
  try { liked = localStorage.getItem('tg_liked') === '1'; } catch (e) {}
  heartBtn.classList.toggle('liked', liked);
  heartBtn.addEventListener('click', () => {
    liked = !liked;
    try { localStorage.setItem('tg_liked', liked ? '1' : '0'); } catch (e) {}
    heartBtn.classList.toggle('liked', liked);
    heartBtn.classList.remove('pop'); void heartBtn.offsetWidth; heartBtn.classList.add('pop');
  });
  heartBtn.addEventListener('animationend', () => heartBtn.classList.remove('pop'));

  $('#side-toggle').addEventListener('click', () => {
    if (matchMedia('(max-width: 900px)').matches) app.classList.toggle('sheet-open');
    else app.classList.toggle('no-side');
  });

  new ResizeObserver(() => engine.resize()).observe(stage);
})();
