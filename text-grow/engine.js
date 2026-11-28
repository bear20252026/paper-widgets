/* Text Bloom engine — text is sampled into points, every point becomes a sprite,
   and the sprite's life is keyed to its x position so the bloom sweeps left → right. */
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const easeOutCubic = x => 1 - Math.pow(1 - x, 3), easeInCubic = x => x * x * x;
  const bounceOut = x => { const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
  const easeOutElastic = x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
  const easeOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
  // the arrival curves: how a sprite reaches full size
  const EASES = { soft: easeOutCubic, back: easeOutBack, elastic: easeOutElastic, bounce: bounceOut, snap: easeOutExpo };
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  // one "letter" per user-perceived character, so an emoji or a composed accent stays whole
  const grapher = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const splitGraphemes = s => grapher ? Array.from(grapher.segment(s), x => x.segment) : Array.from(s);

  // life of one sprite, in local phase l ∈ (0,1)
  const SEED_END = 0.18, POP_END = 0.32, HOLD_END = 0.78;

  class TextBloom {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.text = 'Thinking…';
      this.font = 'Geist, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
      this.weight = 600;
      this.fontDensity = 1;   // thin faces sample sparser, so each font brings its own correction
      this.duration = 4200;   // ms for the whole sweep
      this.spread = 0.7;      // how far the left edge is ahead of the right edge
      this.size = 1;          // sprite size multiplier
      this.density = 1;       // sampling density multiplier
      this.sprout = 0;        // how long a sprite stays an ink bud before it takes colour (0 = never; the slider sets it)
      this.ink = '#111';      // colour of the text and of the buds; 'light' when the paper is dark
      this.inkLight = false;
      this.arrive = 'pop';    // how a sprite gets to its point: pop | flip | spin | fade
      this.ease = 'back';     // the curve it grows on: soft | back | elastic | bounce | snap
      this.order = 'left';    // which points go first: left | center | random | tap
      this.origin = null;     // the last tap, for order = 'tap'
      this.set = null;
      this.points = [];
      this.state = 'idle';    // idle | playing | done
      this.progress = 0;
      this.t0 = 0;
      this.onEnd = null;
      this.layer = document.createElement('canvas');   // the letters that grow
      this.layer.getContext('2d', { willReadFrequently: true });
      this.still = document.createElement('canvas');   // the letters that stay ink
      this.glyphs = [];       // every letter's box, in CSS px, in text order
      this.mask = null;       // Set of glyph indices that grow; null = all of them
      // pointer, in CSS px, for sprites that look at you
      this.px = null; this.py = null;
      canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); this.px = e.clientX - r.left; this.py = e.clientY - r.top; });
      canvas.addEventListener('pointerleave', () => { this.px = this.py = null; });
      this.resize();
      const loop = now => { this.tick(now); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }

    setText(t) { this.text = t && t.length ? t : ' '; this.mask = null; this.layout(); }
    setMask(indices) { this.mask = indices && indices.size ? new Set(indices) : null; this.layout(); }
    // the letter under a stage point, or -1
    glyphAt(x, y) { return this.glyphs.findIndex(g => x >= g.x0 && x <= g.x1 && y >= g.y0 && y <= g.y1); }
    setInk(color, light) { this.ink = color; this.inkLight = !!light; this.layout(); }
    setFont(family, weight, density) { this.font = family; this.weight = weight || 400; this.fontDensity = density || 1; this.layout(); }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.W = Math.round(this.w * this.dpr); this.H = Math.round(this.h * this.dpr);
      this.canvas.width = this.W; this.canvas.height = this.H;
      this.layer.width = this.W; this.layer.height = this.H;
      this.still.width = this.W; this.still.height = this.H;
      this.layout();
    }

    // draw the text on the offscreen layer, measure it, then sample it
    layout() {
      const { w, h, dpr } = this;
      const ctx = this.layer.getContext('2d'), sctx = this.still.getContext('2d');
      for (const c of [ctx, sctx]) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.W, this.H); c.scale(dpr, dpr); }
      // one or more lines, each centred, the block scaled to fit width and height
      const lines = this.text.split('\n').map(s => s.length ? s : ' ');
      const LH = 1.08; // line height, in ems
      let fs = Math.min(h * 0.42, 300);
      ctx.font = `${this.weight} ${fs}px ${this.font}`;
      const widest = Math.max(...lines.map(s => ctx.measureText(s).width));
      if (widest > w * 0.82) fs *= (w * 0.82) / widest;
      if (lines.length > 1 && fs * LH * lines.length > h * 0.8) fs = (h * 0.8) / (LH * lines.length);
      fs = Math.max(24, fs);
      for (const c of [ctx, sctx]) {
        c.font = `${this.weight} ${fs}px ${this.font}`;
        c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = this.ink;
      }
      const top = h / 2 - (fs * LH * (lines.length - 1)) / 2;
      // every letter is placed by the width of the text before it (so kerning
      // holds) and drawn on its own: on the growing layer, or on the still one
      // when a mask leaves it out. The sampled box covers the growing letters only.
      const glyphs = [], mask = this.mask;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      lines.forEach((s, i) => {
        const y = top + i * fs * LH;
        const lm = ctx.measureText(s), start = w / 2 - lm.width / 2;
        let pre = '';
        for (const ch of splitGraphemes(s)) {
          const gx = start + ctx.measureText(pre).width;
          pre += ch;
          const m = ctx.measureText(ch);
          const g = { ch, line: i, x0: gx - m.actualBoundingBoxLeft, x1: gx + m.actualBoundingBoxRight,
                      y0: y - lm.actualBoundingBoxAscent, y1: y + lm.actualBoundingBoxDescent, grows: true };
          if (ch.trim()) { // spaces hold a place but have nothing to grow
            g.grows = !mask || mask.has(glyphs.length);
            (g.grows ? ctx : sctx).fillText(ch, gx, y);
            if (g.grows) {
              x0 = Math.min(x0, g.x0); x1 = Math.max(x1, g.x1);
              y0 = Math.min(y0, g.y0); y1 = Math.max(y1, g.y1);
            }
          }
          glyphs.push(g);
        }
      });
      if (x0 === Infinity) { x0 = x1 = w / 2; y0 = y1 = h / 2; } // nothing grows: an empty box
      this.glyphs = glyphs;
      this.fontSize = fs;
      this.tx0 = x0 - 2; this.tx1 = x1 + 2; this.ty0 = y0 - 2; this.ty1 = y1 + 2;
      this.tw = Math.max(1, this.tx1 - this.tx0);
      this.sample();
      if (this.set) this.assign();
    }

    // hex-grid sampling of the glyph interiors
    sample() {
      const { dpr, W, H } = this;
      const data = this.layer.getContext('2d').getImageData(0, 0, W, H).data;
      let step = Math.max(3, (this.fontSize / 22) / (this.density * this.fontDensity * (this.set && this.set.density || 1)));
      // with a mask, each chosen letter sweeps on its own clock (all start together);
      // without one, the whole word is one sweep
      const own = this.mask ? this.glyphs.filter(g => g.grows && g.ch.trim()) : null;
      const nxOf = (x, y) => {
        if (own) {
          let best = null, bd = Infinity;
          for (const g of own) {
            if (y < g.y0 || y > g.y1 || x < g.x0 || x > g.x1) continue;
            const d = Math.abs(x - (g.x0 + g.x1) / 2);
            if (d < bd) { bd = d; best = g; }
          }
          if (best) return clamp((x - best.x0) / Math.max(1, best.x1 - best.x0), 0, 1);
        }
        return clamp((x - this.tx0) / this.tw, 0, 1);
      };
      let pts;
      for (let tries = 0; tries < 4; tries++) {
        pts = [];
        let row = 0;
        for (let y = this.ty0; y <= this.ty1; y += step, row++) {
          const off = row % 2 ? step / 2 : 0;
          for (let x = this.tx0 + off; x <= this.tx1; x += step) {
            const px = Math.floor(x * dpr), py = Math.floor(y * dpr);
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            if (data[(py * W + px) * 4 + 3] < 120) continue;
            const ang = Math.random() * TAU;
            pts.push({
              x: x + (Math.random() - 0.5) * step * 0.6,
              y: y + (Math.random() - 0.5) * step * 0.6,
              nx: nxOf(x, y),
              seed: Math.random(),
              jit: (Math.random() - 0.5) * 0.035,  // a little unevenness; more read as stutter
              dx: Math.cos(ang), dy: Math.sin(ang),   // drift direction
              out: Math.random() * 0.5,                // how far it blooms outward (stays inside the letter)
              si: 0, ci: 0, rot: 0, sz: 1,
            });
          }
        }
        if (pts.length <= 5000) break;
        step *= 1.25;
      }
      pts.sort((a, b) => a.y - b.y); // lower points draw in front (crowd feel)
      this.points = pts;
      this.step = step;
    }

    // give every point a sprite, a tilt and a size from the current set
    assign() {
      const set = this.set;
      for (const p of this.points) {
        p.si = Math.floor(Math.random() * set.sprites.length);
        p.ci = Math.floor(Math.random() * set.palette.length);
        p.rot = set.upright ? (Math.random() - 0.5) * 0.28 : Math.random() * TAU;
        p.sz = 0.72 + Math.random() * 0.56;
      }
      this.reorder();
    }

    // p.o: this point's place in the sweep (0 = first), by the chosen order
    reorder() {
      const ord = this.order, org = this.origin, maxD = Math.hypot(this.tw, this.ty1 - this.ty0) || 1;
      for (const p of this.points) {
        p.o = ord === 'center' ? Math.abs(p.nx - 0.5) * 2
          : ord === 'random' ? p.seed
          : ord === 'tap' && org ? Math.min(1, Math.hypot(p.x - org.x, p.y - org.y) / maxD)
          : p.nx;
      }
    }

    play(set) {
      const resample = (set.density || 1) !== (this.set && this.set.density || 1);
      this.set = set;
      if (resample) this.sample(); // a set may want fewer, bigger sprites
      this.assign();
      this.t0 = performance.now();
      this.progress = 0;
      this.state = 'playing';
    }

    stop() { this.state = 'idle'; this.set = null; this.progress = 0; }

    tick(now) {
      if (this.state === 'playing') {
        this.progress = (now - this.t0) / this.duration;
        if (this.progress >= 1) {
          this.progress = 1;
          this.state = 'done';
          this.draw(now);
          if (this.onEnd) this.onEnd();
          return;
        }
      }
      this.draw(now);
    }

    // the ink stays until the sprites have grown out of it, then the leftovers
    // between sprites fade; it returns as the sprites shrink back
    textAlpha(l) {
      if (l < 0.2) return 1;
      if (l < POP_END) return 1 - (l - 0.2) / (POP_END - 0.2); // gone by the time the sprites are full size
      if (l < 0.8) return 0;
      if (l < 0.88) return (l - 0.8) / 0.08; // back early: the shrinking sprites decide where it shows
      return 1;
    }

    draw(now) {
      const { ctx, dpr, W, H } = this;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      const set = this.set;
      if (this.state !== 'playing' || !set) {
        ctx.drawImage(this.layer, 0, 0);
        ctx.drawImage(this.still, 0, 0);
        return;
      }

      // a chosen few letters move together: only a short sweep inside each one
      const prog = this.progress, spread = this.mask ? Math.min(this.spread, 0.3) : this.spread;
      const local = nx => prog * (1 + spread) - nx * spread;

      // the black text, revealed / hidden column by column
      const sw = Math.max(1, Math.round(4 * dpr));
      const sy = Math.max(0, Math.floor((this.ty0 - 4) * dpr));
      const sh = Math.min(H - sy, Math.ceil((this.ty1 - this.ty0 + 8) * dpr));
      const x0 = Math.max(0, Math.floor(this.tx0 * dpr)), x1 = Math.min(W, Math.ceil(this.tx1 * dpr));
      if (this.order === 'left' && this.mask) {
        // each chosen letter fades on its own clock, columns within its own box
        const seen = {}; // per line: the last column drawn, so overlapping boxes are not drawn twice
        for (const g of this.glyphs) {
          if (!g.grows || !g.ch.trim()) continue;
          const gy = Math.max(0, Math.floor((g.y0 - 4) * dpr)), gh = Math.min(H - gy, Math.ceil((g.y1 - g.y0 + 8) * dpr));
          const gx0 = Math.max(0, Math.floor(g.x0 * dpr), seen[g.line] || 0), gx1 = Math.min(W, Math.ceil(g.x1 * dpr));
          const gw = Math.max(1, (g.x1 - g.x0) * dpr);
          for (let sx = gx0; sx < gx1; sx += sw) {
            const a = this.textAlpha(local((sx - g.x0 * dpr) / gw));
            if (a <= 0) continue;
            ctx.globalAlpha = a;
            ctx.drawImage(this.layer, sx, gy, sw, gh, sx, gy, sw, gh);
          }
          seen[g.line] = gx1;
        }
      } else if (this.order === 'left') {
        for (let sx = x0; sx < x1; sx += sw) {
          const a = this.textAlpha(local((sx / dpr - this.tx0) / this.tw));
          if (a <= 0) continue;
          ctx.globalAlpha = a;
          ctx.drawImage(this.layer, sx, sy, sw, sh, sx, sy, sw, sh);
        }
      } else { // other orders are not column-shaped: the sprites alone eat and return the ink
        ctx.globalAlpha = 1;
        ctx.drawImage(this.layer, 0, 0);
      }

      // per-sprite state. Size follows the font, not the sampling step, so
      // density only changes how many there are.
      const sprites = set.sprites, step = this.step, unit = this.fontSize / 22;
      const base = unit * set.scale * this.size;
      const t = now / 1000;
      const live = [], shed = []; // shed: sprites currently dropping petals or leaves
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const S = this.sprout, grow = EASES[this.ease] || easeOutBack;
      const A = this.arrive, R = Math.max(this.w, this.h) * 0.6, cx = this.w / 2, cy = this.h / 2;
      for (const p of this.points) {
        const l = local(p.o) + p.jit;
        if (l <= 0 || l >= 1) continue;

        if (l < SEED_END) { // specks sprinkled on the ink before the bloom
          if (p.seed > 0.45) continue;
          const a = smooth(0, 0.07, l) * (1 - smooth(0.13, SEED_END, l));
          const s = (1.4 + p.seed * 2.2) * dpr;
          ctx.globalAlpha = a;
          ctx.fillStyle = set.palette[p.ci];
          ctx.fillRect((p.x + p.dx * step * 0.9) * dpr - s / 2, (p.y + p.dy * step * 0.9) * dpr - s / 2, s, s);
          continue;
        }

        // ef: how much ink this sprite has eaten (0..1); m: colour weight (0 = ink bud, 1 = full colour)
        // ra: extra rotation (spin); fx: x-scale (flip)
        let sc, a = 1, ox, oy, ef, m = 1, ra = 0, fx = 1;
        if (l < POP_END) { // arriving
          const k = (l - SEED_END) / (POP_END - SEED_END);
          ox = p.dx * unit * p.out * k; oy = p.dy * unit * p.out * k;
          if (A === 'pop' || A === 'spin') {
            sc = grow(k);
            ef = Math.min(1, k / 0.6); // the ink goes before the sprite is full size
            if (S > 0) m = smooth(0.4 * S, S, k); // a black bud first, colour by k = S
            if (A === 'spin') ra = (1 - easeOutCubic(k)) * TAU;
          } else if (A === 'flip') { // a card: ink on the back, the sprite on the front
            sc = 1; fx = Math.abs(Math.cos(k * Math.PI)); m = k < 0.5 ? 0 : 1; ef = smooth(0.35, 0.65, k);
          } else { // fade: settles down from larger
            sc = 1.5 - 0.5 * easeOutCubic(k); a = k; ef = k;
          }
        } else if (l < HOLD_END) {
          sc = 1 + 0.04 * Math.sin(t * 3 + p.seed * 9);
          ef = 1;
          ox = p.dx * unit * p.out; oy = p.dy * unit * p.out;
          if (set.float) { // bubbles drift up a little and sway while they last
            const hp = (l - POP_END) / (HOLD_END - POP_END);
            oy -= hp * unit * 1.6; ox += Math.sin(t * 1.3 + p.seed * 7) * unit * 0.5;
          }
        } else { // leaving, each the way it came
          const k = (l - HOLD_END) / (1 - HOLD_END), e = k * k;
          ox = p.dx * unit * p.out; oy = p.dy * unit * p.out;
          if (set.shed === 'petal') { // flowers let go of their petals and are gone
            sc = 1 - 0.15 * k; a = 1 - smooth(0, 0.3, k); ef = a;
            shed.push(p, k);
          } else if (set.shed === 'sink') { // trees sink back into the soil, base first
            const d = easeInCubic(k);
            sc = 1 - d; a = 1 - smooth(0.75, 1, k); ef = 1 - smooth(0.1, 0.6, k);
            oy += base * p.sz * 0.5 * d; // keep the base where it stood
            if (k > 0.05 && k < 0.6) shed.push(p, k);
          } else if (set.shed === 'pop') { // bubbles swell for a blink, then burst into droplets
            oy -= unit * 1.6; ox += Math.sin(t * 1.3 + p.seed * 7) * unit * 0.5;
            sc = 1 + 0.22 * smooth(0, 0.18, k); a = k < 0.2 ? 1 : 0;
            ef = k < 0.2 ? 1 : 1 - smooth(0.2, 0.3, k); // the ink is back the instant the bubble is gone
            if (k >= 0.2 && k < 0.8) shed.push(p, k);
          } else if (set.shed === 'blow') { // grass leans with the wind and is carried off
            const d = easeInCubic(k);
            sc = 1; ra = -0.9 * smooth(0, 0.5, k); a = 1 - smooth(0.45, 1, k); ef = 1 - smooth(0, 0.3, k);
            ox += d * unit * 22 + Math.sin(k * 7 + p.seed * 6) * unit * 0.6; oy -= d * unit * 5;
          } else if (A === 'pop' || A === 'spin') {
            sc = 1 - 0.85 * e;
            a = 1 - smooth(0.3, 1, k);
            ef = sc * a; // the ink comes back as the sprite shrinks and fades
            if (S > 0) m = 1 - S * smooth(0.25, 0.85, k); // colour drains back to ink as it shrinks
            ox += p.dx * unit * 0.8 * k; oy += p.dy * unit * 0.8 * k - unit * 0.5 * k;
            if (A === 'spin') ra = easeInCubic(k) * TAU;
          } else if (A === 'flip') {
            sc = 1; fx = Math.abs(Math.cos(k * Math.PI)); m = k < 0.5 ? 1 : 0; ef = 1 - smooth(0.35, 0.65, k);
          } else {
            sc = 1 + 0.4 * k; a = 1 - k; oy -= unit * 3 * k; ef = 1 - k;
          }
        }
        live.push(p, sc, a, ox, oy, ef, m, ra, fx);
      }

      // the ink turns into the sprites: each one erases the ink under it as it
      // grows, and gives it back as it shrinks
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      const er = Math.max(step * 0.85, unit * 1.05) * dpr;
      ctx.beginPath();
      for (let i = 0; i < live.length; i += 9) {
        const p = live[i], r = er * live[i + 5];
        if (r <= 0) continue;
        ctx.moveTo((p.x + live[i + 3]) * dpr + r, (p.y + live[i + 4]) * dpr);
        ctx.arc((p.x + live[i + 3]) * dpr, (p.y + live[i + 4]) * dpr, r, 0, TAU);
      }
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // the letters left out of the mask stay whole, under the sprites but above the erasing
      if (this.mask) ctx.drawImage(this.still, 0, 0);

      // sprites. Transparent things (bubbles) are photographed on black or white and
      // laid on with screen / multiply instead of a matte.
      ctx.globalCompositeOperation = set.blend ? (this.inkLight ? 'screen' : 'multiply') : 'source-over';
      for (let i = 0; i < live.length; i += 9) {
        const p = live[i], sc = live[i + 1], a = live[i + 2], ox = live[i + 3], oy = live[i + 4], m = live[i + 6];
        const ra = live[i + 7], fx = live[i + 8];
        const spr = sprites[p.si];
        const k = (base * p.sz * sc) / spr.h;
        const rot = p.rot + ra + (set.upright ? Math.sin(t * 2.2 + p.seed * 7) * 0.04 : Math.sin(t * 1.3 + p.seed * 7) * 0.08);
        const c = Math.cos(rot) * k * dpr, s = Math.sin(rot) * k * dpr;
        const tx = (p.x + ox) * dpr, ty = (p.y + oy) * dpr;
        // jelly: a pointer passing by sets off a squash-and-stretch wobble that rings down
        let sx = 1, sy = 1;
        if (set.jelly) {
          if (this.px != null && (p.w || 0) < 0.35) {
            const ddx = p.x - this.px, ddy = p.y - this.py, reach = unit * 2.2;
            if (ddx * ddx + ddy * ddy < reach * reach) { p.w = 1; p.wp = 0; }
          }
          // always a little bouncy, like set jelly; a pointer sets off a bigger wobble
          let q = 0.07 * Math.sin(t * 5.2 + p.seed * 11);
          if (p.w > 0.01) {
            p.wp += 0.55; p.w *= 0.9;
            q += 0.32 * p.w * Math.sin(p.wp);
          }
          sx = 1 + q; sy = 1 - q;
        }
        sx *= fx; // flip: the card seen edge-on
        ctx.setTransform(c * sx, s * sx, -s * sy, c * sy, tx, ty);
        const bud = this.inkLight ? spr.inkW : spr.ink;
        if (m < 1 && bud) { // still (partly) an ink bud
          ctx.globalAlpha = a * (1 - m);
          ctx.drawImage(bud, -spr.w / 2, -spr.h / 2);
        }
        if (m > 0) {
          ctx.globalAlpha = a * m;
          ctx.drawImage(spr.img, -spr.w / 2, -spr.h / 2);
        }
        ctx.globalAlpha = a;

        // eyes that follow the pointer (sprites with detected goggles only)
        if (spr.eyes && this.px != null && live[i + 5] >= 1) { // only while fully grown
          const m2 = k * dpr * k * dpr, dx = this.px * dpr - tx, dy = this.py * dpr - ty;
          const lx = (c * dx + s * dy) / m2, ly = (-s * dx + c * dy) / m2; // pointer in sprite space
          for (const e of spr.eyes) {
            let vx = lx - e.x, vy = ly - e.y;
            const d = Math.hypot(vx, vy) || 1, reach = e.r * 0.34;
            vx = vx / d * reach; vy = vy / d * reach;
            ctx.fillStyle = '#fbfbfb';
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.86, 0, TAU); ctx.fill();
            ctx.fillStyle = '#6b4423';
            ctx.beginPath(); ctx.arc(e.x + vx, e.y + vy, e.r * 0.46, 0, TAU); ctx.fill();
            ctx.fillStyle = '#1a1210';
            ctx.beginPath(); ctx.arc(e.x + vx, e.y + vy, e.r * 0.24, 0, TAU); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(e.x + vx - e.r * 0.14, e.y + vy - e.r * 0.16, e.r * 0.1, 0, TAU); ctx.fill();
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      if (shed.length && set.shed === 'pop') { // droplets flying out of a burst bubble
        for (let i = 0; i < shed.length; i += 2) {
          const p = shed[i], kk = (shed[i + 1] - 0.2) / 0.6, oy0 = p.y - unit * 1.6;
          for (let j = 0; j < 7; j++) {
            const h1 = hash(p.seed, j + 5), h2 = hash(p.seed, j + 31);
            const ang = (j / 7) * TAU + h1 * 0.8, d = unit * (1.4 + 3.2 * kk) * (0.7 + h2 * 0.6);
            const x = p.x + Math.cos(ang) * d, y = oy0 + Math.sin(ang) * d + kk * kk * unit * 2.2;
            ctx.globalAlpha = (1 - kk) * 0.9; ctx.fillStyle = j % 2 ? '#cfe8ff' : '#ffffff';
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.beginPath(); ctx.arc(x * dpr, y * dpr, unit * 0.16 * (1 - kk * 0.6) * dpr, 0, TAU); ctx.fill();
          }
        }
      } else if (shed.length && set.shed === 'sink') { // a puff of soil where a tree goes under
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < shed.length; i += 2) {
          const p = shed[i], k = (shed[i + 1] - 0.05) / 0.55, by = p.y + base * p.sz * 0.5;
          for (let j = 0; j < 5; j++) {
            const h1 = hash(p.seed, j + 3), h2 = hash(p.seed, j + 21);
            const x = p.x + (h1 - 0.5) * unit * 3 * (0.3 + k), y = by - h2 * unit * 1.6 * Math.sin(k * Math.PI);
            ctx.globalAlpha = (1 - k) * 0.7; ctx.fillStyle = this.inkLight ? '#9a8f7a' : '#6b5a44';
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.beginPath(); ctx.arc(x * dpr, y * dpr, unit * (0.1 + h2 * 0.12) * dpr, 0, TAU); ctx.fill();
          }
        }
      } else if (shed.length) {
        // petals: a handful per flower, thrown up a little, then gravity and flutter.
        // Drawn in the emoji's own idiom: outlined (openmoji), lightly shaded (fluent) or flat.
        const g = unit * 26, pal = set.palette, styleP = set.petal || 'flat';
        for (let i = 0; i < shed.length; i += 2) {
          const p = shed[i], k = shed[i + 1], tt = k * 1.15;
          for (let j = 0; j < 4; j++) {
            const h1 = hash(p.seed, j), h2 = hash(p.seed, j + 9), h3 = hash(p.seed, j + 17);
            const x = p.x + (h1 - 0.5) * unit * 7 * tt + Math.sin(tt * 9 + h3 * 6) * unit * 1.3;
            const y = p.y - unit * (2 + h2 * 4) * tt + 0.5 * g * tt * tt;
            const rot = h3 * TAU + tt * (h1 - 0.5) * 14;
            const rw = unit * (0.42 + h2 * 0.3) * dpr, rh = rw * 0.6;
            ctx.globalAlpha = 1 - smooth(0.55, 1, k);
            ctx.fillStyle = pal[(j * 5 + Math.floor(h1 * 11)) % pal.length];
            ctx.setTransform(Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot), x * dpr, y * dpr);
            ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, 0, 0, TAU); ctx.fill();
            if (styleP === 'outline') {
              ctx.lineWidth = Math.max(1, unit * 0.09 * dpr); ctx.strokeStyle = this.inkLight ? '#ededed' : '#111';
              ctx.stroke();
            } else if (styleP === 'shaded') {
              ctx.fillStyle = 'rgba(255,255,255,0.45)';
              ctx.beginPath(); ctx.ellipse(-rw * 0.3, -rh * 0.3, rw * 0.45, rh * 0.4, 0, 0, TAU); ctx.fill();
            }
          }
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
    }
  }

  window.TextBloom = TextBloom;
})();
