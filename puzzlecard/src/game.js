// The whole arc in one scene:
//   start  — the photo lies on the mat as a slab; pick pieces + finish; tap it
//   cut    — seams engrave across the slab
//   scatter— pieces tumble into the box
//   play   — assemble anywhere on the mat; pieces snap to each other; the box is a real box:
//            drag it, shake it, the loose pieces inside obey gravity
//   done   — the puzzle floats and tilts toward the pointer; finish adjustable again; Glue; Send
// The letter: the print has a back. On the start screen you can turn it over and write on it; Send makes a
// link that carries the puzzle and the letter. Whoever opens the link only sees the picture; when their last
// piece clicks in, the finished puzzle turns over and the letter is there.
import { gridFor } from './cut.js';
import { makePrint, bake } from './bake.js?v=41';
import { createRenderer } from './gl.js?v=47';
import { HAND, LAYOUT, hasLetter, renderLetter, packLink, parseLink } from './letter.js?v=4';
import { storeCard, loadCard } from './card.js?v=2';
import { placeholderLandscape } from './placeholder.js';
import * as sound from './sound.js?v=6';

const $ = (id) => document.getElementById(id);
const stage = $('stage'), canvas = $('gl'), fileInput = $('file');
const R = createRenderer(canvas);

const MAT = [0.105, 0.108, 0.118];
const TRAY = [0.072, 0.076, 0.09];
const TOP = 40, GAP = 12;
let BOTTOM = 96;               // room kept under the scene for the panel and the credit line; measured in layout()
const PLAY_RATIO = 1;          // pieces keep the size they were cut at (user: no shrinking on the way into the box)
const G = 2600;                // px/s², gravity inside the box
const WALL = 9;                // thickness of the box walls (matches the shader)
const BOARD = 14;              // backing board margin around the picture
function trayInner() { const [x, y, w, h] = S.tray; return [x + WALL, y + WALL, w - 2 * WALL, h - 2 * WALL]; }

const DUSK = placeholderLandscape();   // the built-in scene
const S = {
  phase: 'start', image: DUSK, imageName: 'Dusk',
  count: 20, finish: 0, seed: 11,
  print: null, baked: null, pieces: [], scale: 1,
  slab: [0, 0, 1, 1], tray: [0, 0, 1, 1], mat: [0, 0, 1, 1],
  w: 390, h: 844, dpr: Math.min(2.5, devicePixelRatio || 1), viewScale: 1,
  pointer: null, drag: null, trayDrag: null, light: [195, 120, 700],
  cutStart: 0, scatterStart: 0, doneAt: 0, hold: 0, tilt: [0, 0], glue: 0, glueStart: 0, hero: 1, trayIn: 0,
  t0: performance.now(), last: performance.now(),
  // the letter on the back
  letter: { to: '', body: '', from: '' }, letterCanvas: null, writing: false, recv: false, sampleKey: 0,
  turn: 0, turnT: 0, autoTurned: false,   // 0 = face up … 1 = turned over (start: while writing; done: reading)
  revealAt: 0, introT: 0, burst: false,   // when the letter began writing itself in; how long a sent puzzle has been looked at; cut skipped
};

// ---------- build ----------
function rebuild() {
  closeWriter();
  S.print = makePrint(S.image, 1600);
  const { cols, rows } = gridFor(S.count, S.print.width / S.print.height);
  S.baked = bake(S.print, { cols, rows, seed: S.seed });
  R.setAtlases(S.baked.colorAtlas, S.baked.normalAtlas, S.baked.previewNormal);
  R.setPrint(S.print);
  S.pieces = S.baked.pieces.map(p => ({ ...p, x: 0, y: 0, g: p.i, lift: 0, clarity: 1, lt: 0, ct: 1, rot: 0, rest: 0, flip: 0, flipT: 0, cut: 0, glue: 0, k: 1, vx: 0, vy: 0, phys: false }));
  S.hold = 0; S.tilt = [0, 0]; S.glue = 0; S.glueStart = 0; S.drag = null; S.trayDrag = null; S.paused = 0; S.previewAmt = 0;
  S.turn = 0; S.turnT = 0; S.autoTurned = false; S.revealAt = 0; S.introT = 0; S.openStart = 0; S.packStart = 0; S.shed = 0; S.wobble = 0;
  refreshLetter();
  setPhase('start');
  layout();
}

// the panel never changes shape: every key is always in its place, lit only while it can do something
// (someone who was sent a puzzle cannot re-cut it: it arrives as it was packed)
// The panel ends with the two ways a puzzle leaves the start screen, side by side: Cut (play it yourself) and Send.
// Glue only means something once the puzzle is whole. (Shake the box is gone: the box can be dragged and sloshes.)
// Order (user): pick the photo, write the back, Cut, then Send — so Send only lights once the puzzle has been cut.
// Glue belongs to whoever finishes it; glued, it is one whole print again, and the only way back is another Cut.
function liveKeys(ph) {
  if (ph === 'start') return S.recv ? [] : ['counts', 'finish', 'cut'];
  if (ph === 'play') return S.recv ? ['restart'] : ['send', 'restart'];
  // a received puzzle that has been glued cannot simply fly apart again (↺ replays it): it has to be cut again
  if (ph === 'done') return ['finish', S.glueStart ? 'cut' : 'glue', 'send', ...(S.recv && S.glueStart ? [] : ['restart'])];
  return [];
}
function setPhase(ph) {
  S.phase = ph;
  document.body.dataset.phase = ph;
  const live = liveKeys(ph);
  // for someone who was sent a puzzle, the last key answers it instead of sending it on
  $('send').textContent = S.recv ? 'Write back' : 'Send';
  closeSendBox();
  for (const b of document.querySelectorAll('#bar button')) {
    const grp = b.closest('.keys').id;
    b.disabled = !(live.includes(b.id) || live.includes(grp));
  }
  $('bar').classList.toggle('idle', live.length === 0);   // phone: an empty panel (while cutting) steps away
  $('finish').classList.remove('open');
}

function layout() {
  const rect = stage.getBoundingClientRect();
  S.w = Math.round(rect.width / S.viewScale); S.h = Math.round(rect.height / S.viewScale);
  R.resize(S.w, S.h, S.dpr); sizeDust();
  const b = S.baked; if (!b) return;
  // room for the panel (one fixed shape in every phase) and the credit line under it
  BOTTOM = Math.max(96, $('bar').offsetHeight + 34 + 10);
  const aspect = b.W / b.H;
  // The print, the machine and the box are the same size whatever the piece count (user 11/19): only the pieces
  // differ. So the box is sized for the BIGGEST pieces there can be (a 9-piece cut of this picture), not for the
  // pieces of the current cut: a piece's height over its cell's height is the same for every count (the tabs
  // scale with the cell), which gives the 9-piece height from this cut's.
  // A piece's outline is at most ~1.75 cells tall and wide (tabs plus the cut's own wobble; measured 1.64-1.75 over
  // 9/20/50/100), so that fixed allowance is used rather than this cut's own, which differs a little from cut to cut.
  const g9 = gridFor(9, aspect), bigPh = (b.H / g9.rows) * 1.75, bigPw = (b.W / g9.cols) * 1.75;
  // The uncut slab is the hero. Everything else is sized from it: the machine pill is a little wider than
  // the slab, the box takes exactly the slab's width. The three stack vertically (machine fully in view at
  // the top, slab, box at the bottom), so the slab shrinks until the whole stack fits the window height.
  const dims = (hw) => {
    const hh = hw / aspect, s0 = (hw / b.W) * PLAY_RATIO;
    // lw: the width at which the pill's hairline spans the picture exactly. The box keeps that width; the machine
    // itself is drawn bigger (MACHINE_K times the picture, user 11/19: it read as too small), its hairline running
    // past the picture on both sides like a trimmer wider than the paper. On a narrow screen it stops at the edges.
    const lw = hw / LINE_FRAC;
    const pw = Math.min(hw * MACHINE_K, Math.max(lw, S.w - 2 * GAP)), ph = pw / PILL_AR;
    // The box is a long, shallow tray as wide as the machine (user 11/19: wider, lower, a strip, not a square).
    // Its depth only has to take the SHORT side of the biggest piece: a piece too tall for it lands turned on its
    // side (tumble). The pieces heap up and overlap in it rather than lying side by side, so it also never gets
    // less area than half the print's.
    const bw = pw, inner = Math.min(bigPw, bigPh) * s0 * 1.18;
    const th = Math.round(Math.min(S.h * 0.26, Math.max(96, inner + 2 * WALL, 0.5 * b.W * b.H * s0 * s0 / bw)));
    return { hh, s0, pw, ph, th, lw, bw };
  };
  const fixed = MTOP + BOARD + 20 + GAP + BOTTOM + 8;
  // desktop: the picture stays modest (under half the window, never past 720px) — a smaller print means
  // smaller, finer pieces, and a heap that fits its box. It used to shrink further for few pieces (9: 0.78,
  // 20: 0.9, 50/100: 1) so big pieces fit the box; now every count gets the 20-piece size (user 11/19: the print
  // must not change size when the count changes) and the box is sized for 9-piece pieces instead (bigPh).
  const countK = 0.9;
  // (user, 11/17: the pieces were still too big -> 0.38/600 became 0.32/480.) The cap is on the print's AREA, not its
  // width: an upright or square picture gets a narrower print, so its pieces come out the size a landscape's would.
  const areaK = Math.min(1, Math.sqrt(aspect / 1.5));
  let heroW = Math.min(S.w < 700 ? Infinity : Math.min(S.w * 0.32, 480) * countK * areaK, (S.w - 2 * GAP) * LINE_FRAC);
  for (let i = 0; i < 5; i++) {
    const d = dims(heroW), need = fixed + d.ph + d.hh + d.th;
    if (need <= S.h) break;
    heroW = Math.max(160, heroW * (S.h - fixed) / (need - fixed));
  }
  const d = dims(heroW), heroH = d.hh, heroScale = heroW / b.W, s0 = d.s0;
  const trayW = Math.round(d.bw), trayH = d.th;   // the box is as wide as the machine
  S.tray = [(S.w - trayW) / 2, S.h - BOTTOM - trayH, trayW, trayH];
  S.mat = [GAP, TOP, S.w - 2 * GAP, S.h - TOP - BOTTOM - trayH - GAP];
  document.body.dataset.orient = S.w >= S.h ? 'landscape' : 'portrait';
  const [mx, my, mw, mh] = S.mat;
  S.scale = Math.min(s0, (mw - 16) / b.W, (mh - 16) / b.H);
  S.hero = heroScale / S.scale;
  S.pill = { w: d.pw, h: d.ph };
  S.bladeY = MTOP + d.ph;                 // the pill's lower edge (where the hairline is) once the machine is in
  // the shelf of prints lies on the mat to the left, between the machine and the panel
  // (on a phone it is a row just above the panel instead)
  const sh = $('shelf').style;
  // both columns hang from the same line as the cutter: their first card starts level with the machine's top
  // edge (user: align with the cutter, not the print), and a longer column simply runs further down
  const slabTop = Math.max(S.bladeY + BOARD + 20, my + (mh - heroH) / 2);
  if (S.w >= 700) { sh.top = MTOP + 'px'; sh.bottom = (BOTTOM + 2) + 'px'; }
  else { sh.top = ''; sh.bottom = (BOTTOM + 6) + 'px'; }
  if (S.w < 700 && S.count > 50 && !S.recv && S.phase === 'start') setTimeout(() => $('counts').querySelector('[data-n="50"]').click());
  // the cards shrink together (both columns) until the whole shelf fits its column: nothing is cut off, nothing scrolls
  { const n = $('shelf').querySelectorAll('.print').length || 1, colH = S.h - MTOP - BOTTOM - 2;
    const th = Math.max(40, Math.min(78, Math.floor((colH - (n - 1) * 14) / n - 17)));
    document.body.style.setProperty('--th', th + 'px'); document.body.style.setProperty('--tw', Math.round(th * 4 / 3) + 'px'); }
  // its counterpart on the right: the back of the print, where the letter goes
  const nt = $('note').style; nt.top = sh.top; nt.bottom = sh.bottom;
  if (S.writing) placeWriter();
  S.slabHome = [(S.w - heroW) / 2, slabTop, heroW, heroH];   // the board waits just under the machine
  S.slab = S.slabHome.slice(); S.slabTo = null;
  if (S.writing && S.w < 700) { S.slab = writeRect(); placeWriter(); fitNames(); }   // phone, writing: the print fills what the keyboard leaves
  placeMachine();
  for (const p of S.pieces) {
    p.hx = p.px * S.scale; p.hy = p.py * S.scale;      // offset of this piece inside the assembled picture
    p.w = p.pw * S.scale; p.h = p.ph * S.scale;
    p.bw = b.cw * S.scale * 0.5; p.bh = b.ch * S.scale * 0.5;   // half extents of the piece body (without tabs)
    p.r = (p.bw + p.bh) * 0.5 * 0.5;                            // collision radius inside the box: pieces overlap freely, a flat heap seen from above
    p.ww = p.w * 0.5 - b.cw * S.scale * 0.06; p.wh = p.h * 0.5 - b.ch * S.scale * 0.06;   // wall extents: tabs stay inside the box too
    if (S.phase === 'start' || S.phase === 'cut') { p.k = S.hero; p.x = S.slab[0] + p.hx * p.k; p.y = S.slab[1] + p.hy * p.k; }
  }
}

// ---------- phases ----------
// geometry of assets/machine-slim.png (1024×178, the matte render): the pill fills the frame edge to edge
// (only the corners show background), button centre 92.4% / 49.4%, LED 85.7% / 50%, hairline x 5.7%–93.6%
// along the bottom edge. bandT/bandB = the vertical slice of the image that is shown (all of it now).
const IMG = { ar: 1024 / 178, pillL: 0, pillR: 1, pillT: 0, pillB: 1, bandT: 0, bandB: 1 };
const PILL_AR = (IMG.pillR - IMG.pillL) * IMG.ar / (IMG.bandB - IMG.bandT);   // the pill's own width / height (5.75)
const MTOP = 14;        // gap above the machine when it is in
const LINE_FRAC = 0.879 / (IMG.pillR - IMG.pillL);   // the hairline's share of the pill's width (the box is as wide as the hairline at picture width)
const WOBBLE = 0.55;    // how much swinging of a finished, unglued puzzle shakes a piece loose (tilt units summed over ~0.5 s)
const MACHINE_K = 1.55; // the machine's width / the picture's width (was 1 / LINE_FRAC = 1.14; user 11/19: bigger, then a little bigger again)
// size the render so the pill is S.pill wide, and clip the pill band out of its background
function placeMachine() {
  const m = $('machine');
  const dispW = S.pill.w / (IMG.pillR - IMG.pillL), dispH = dispW / IMG.ar;
  m.style.width = dispW + 'px'; m.style.height = dispH + 'px'; m.style.left = ((S.w - dispW) / 2) + 'px';
  // the clip lives on .body, so the drop shadow on #machine follows the pill's outline (filters apply before clip-path)
  m.querySelector('.body').style.clipPath = `inset(${IMG.bandT * 100}% ${(1 - IMG.pillR) * 100}% ${(1 - IMG.bandB) * 100}% ${IMG.pillL * 100}% round ${S.pill.h / 2}px)`;
  m.style.setProperty('--bt', (IMG.bandT * 100) + '%'); m.style.setProperty('--bb', ((1 - IMG.bandB) * 100) + '%');
  m.style.setProperty('--r', (S.pill.h / 2) + 'px');
  S.machineRest = S.bladeY - IMG.bandB * dispH;     // top of the element when the pill's lower edge is at S.bladeY
  if (S.phase !== 'cut') m.style.top = S.machineRest + 'px';   // the machine is a fixture: it sits here in every phase
}
function startCut(now) {
  closeWriter();
  if (S.slabHome) { S.slab = S.slabHome.slice(); S.slabTo = null; }
  S.burst = false;
  setPhase('cut'); S.cutStart = now;
  for (const p of S.pieces) { p.k = S.hero; p.x = S.slab[0] + p.hx * p.k; p.y = S.slab[1] + p.hy * p.k; p.cut = 0; p.snd = false; p.clarity = 1; p.ct = 1; p.anim = null; p.phys = false; p.falling = false; p.rot = 0; p.rest = 0; p.flip = 0; p.flipT = 0; }
  placeMachine();
  $('machine').className = '';
  S.cutStage = null; S.cutRow = -1; S.shredRow = -1; S.shred = null; S.shed = 0; S.wobble = 0;
  const b = S.baked, cellW = b.cw * S.scale * S.hero, cellH = b.ch * S.scale * S.hero;
  const rows = b.rows, sweep = Math.min(420, Math.max(210, 2240 / rows)), STEP = 130;   // (user 11/19: a little quicker, was 520/260/2800 and 160)
  // The print stays where it lies; the machine does the travelling (user 11/19): it wakes, comes down to the
  // first row, steps down one row at a time sweeping its light across each, then goes back up to rest.
  const tIn = 280, tFeed = tIn + 520, tCut = tFeed + rows * (sweep + STEP);
  S.plan = {
    cellW, cellH, rows, cols: b.cols, sweep, step: STEP,
    tIn,                                       // the machine wakes where it rests
    tFeed,                                     // it comes down onto the first row
    tCut,                                      // all rows swept
    tEject: tCut + 760,                        // it goes back up, and the pieces tip off at once, no dwell
    sheetX: S.slab[0], sheetY0: S.slab[1], margin: BOARD,
  };
  S.sheet = { x: S.slab[0], y: S.slab[1], amt: 0 };
}
// A puzzle that was sent to you arrives already cut: you see the whole picture for a moment, then it bursts
// apart and the pieces rain into the box. Same machinery as the end of a cut (the drop), without the cut.
function startBurst(now) {
  if (S.slabHome) { S.slab = S.slabHome.slice(); S.slabTo = null; }
  S.burst = true;
  setPhase('cut'); S.cutStart = now; S.cutStage = null; S.cutRow = -1;
  for (const p of S.pieces) { p.k = S.hero; p.x = S.slab[0] + p.hx * p.k; p.y = S.slab[1] + p.hy * p.k; p.cut = 1; p.clarity = 1; p.ct = 1; p.anim = null; p.phys = false; p.falling = false; p.rot = 0; p.rest = 0; p.flip = 0; p.flipT = 0; p.burstAt = Math.random() * 170; }
  placeMachine();
  const b = S.baked;
  S.plan = { cellW: b.cw * S.scale * S.hero, cellH: b.ch * S.scale * S.hero, rows: b.rows, cols: b.cols, sweep: 0, step: 0, tIn: 0, tFeed: 0, tCut: 0, tEject: 0, sheetX: S.slab[0], sheetY0: S.slab[1], margin: BOARD };
  S.sheet = { x: S.slab[0], y: S.slab[1], amt: 0 };
}
const go = (now) => (S.recv ? startOpen : startCut)(now);
// ---------- the envelope (user 11/19) ----------
// Glassine, with the names in gold pen (CSS #env). It lies over the print, a little larger, centred on it.
const ENV = $('env');
const ease2 = (u) => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, clamp01 = (u) => Math.max(0, Math.min(1, u));
function envRect() { const [x, y, w, h] = S.slabHome || S.slab, ew = w * 1.1, eh = h * 1.07; return [x + w / 2 - ew / 2, y + h / 2 - eh / 2, ew, eh]; }
function placeEnv(dy = 0, open = 0, alpha = 1, dx = 0, sc = 1) {
  const [x, y, w, h] = S.slabHome || S.slab, ew = w * 1.1, eh = h * 1.07, st = ENV.style;
  st.setProperty('--ew', ew + 'px'); st.setProperty('--eh', eh + 'px'); st.setProperty('--open', open.toFixed(3));
  st.transformOrigin = '50% 50%';
  st.transform = `translate(${x + w / 2 - ew / 2 + dx}px, ${y + h / 2 - eh / 2 + dy}px) scale(${sc.toFixed(3)})`; st.opacity = alpha.toFixed(3);
  S.envOn = alpha > 0;
}
function writeEnv() {
  const t = S.letter.to.trim(), f = S.letter.from.trim();
  ENV.querySelector('.flap .ink').textContent = f ? `from ${f}` : '';
  ENV.querySelector('.pocket-ink').textContent = t ? `for ${t}` : f ? '' : 'A puzzle for you';
  ENV.style.fontFamily = HAND;
}
// Sending: once a way out is chosen (Copy link, Share, Email) the puzzle goes back together, the envelope comes up
// round it with its flap open, the flap closes, and it flies off the top. Then the page simply starts over.
const PACK = { wrap: [700, 1750], fly: [2050, 2800] };   // the wind wraps it in sand, then it flies off (user 11/19)
function startPack(now) {
  if (S.phase !== 'play' && S.phase !== 'done') return;
  closeSendBox();
  setPhase('pack'); S.packStart = now; S.packStage = 0; S.turnT = 0;   // a finished puzzle showing its back turns face up first
  ENV.classList.add('gather');
  for (const p of S.pieces) { p.anim = null; p.phys = false; p.falling = false; p.rest = 0; p.flipT = 0; p.lt = 0; p.ct = 1; p.cut = 1; }
  writeEnv();
}
// A sent puzzle arrives sealed. A tap and the glassine blows away like sand, from the left edge across (user 11/19:
// the flap opening did not look good enough), the postcard holds a moment, then it bursts into the box as before.
const OPEN = { dissolve: 1100, hold: 700 };
function startOpen(now) {
  if (S.openStart || S.phase !== 'start') return;
  S.openStart = now; ENV.classList.remove('sealed'); ENV.classList.add('dissolve');
  sound.sand(OPEN.dissolve / 1000);
}
// the grains: milky glassine, a few of them gold from the pen, carried off to the right and up by a light wind
const DUST = $('dust'), dctx = DUST.getContext('2d');
let grains = [], dustLive = false;
function sizeDust() { DUST.width = Math.round(S.w * S.dpr); DUST.height = Math.round(S.h * S.dpr); }
// out: grains leave the paper at the moving edge and blow away. in (sending): each grain is aimed at the spot the edge
// will reach when it lands, flies in on the wind from the left, and melts into the paper as it arrives.
function spawnGrains(front, band, n, frontAt) {
  const [ex, ey, ew, eh] = envRect();
  for (let i = 0; i < n; i++) {
    const life = 0.55 + Math.random() * 0.9, gold = Math.random() < 0.08;
    const u = (frontAt ? frontAt(life) : front) + Math.random() * band; if (u < 0 || u > 1) continue;
    const y = ey + Math.random() * eh, x = ex + u * ew, vx = 60 + Math.random() * 180, vy = -10 - Math.random() * 70;
    const g = { x, y, vx, vy, life, life0: life, s: 0.8 + Math.random() * 2.2, gold, a: gold ? 0.9 : 0.35 + Math.random() * 0.5, in: !!frontAt };
    if (g.in) { g.x = x - vx * life; g.y = y + (-vy) * life * 0.6; g.vy = -vy * 0.6 * -1; }   // starts upwind and a little below
    grains.push(g);
  }
}
function stepDust(dt, t) {
  if (!grains.length) { if (dustLive) { dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.clearRect(0, 0, DUST.width, DUST.height); dustLive = false; } return; }
  dustLive = true;
  dctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); dctx.clearRect(0, 0, S.w, S.h);
  const live = [];
  for (const g of grains) {
    g.life -= dt; if (g.life <= 0) continue;
    if (!g.in) { g.vx += (90 + 40 * Math.sin(g.y * 0.04 + t * 3)) * dt; g.vy += (-25 + 30 * Math.cos(g.x * 0.05 + t * 2)) * dt; }
    g.x += g.vx * dt; g.y += g.vy * dt + (g.in ? Math.sin(g.x * 0.05 + t * 4) * 0.25 : 0);
    live.push(g);
  }
  grains = live;
  for (const gold of [false, true]) {   // two passes, one colour each: thousands of grains stay cheap
    dctx.fillStyle = gold ? 'rgb(233,196,106)' : 'rgb(240,236,226)';
    for (const g of grains) {
      if (g.gold !== gold) continue;
      const k = g.life / g.life0, p = 1 - k;   // p: how far through its flight
      dctx.globalAlpha = g.in ? g.a * (p < 0.8 ? p / 0.8 : (1 - p) / 0.2) : g.a * k;
      const z = g.s * (g.in ? 1 : 0.6 + 0.4 * k);
      dctx.fillRect(g.x, g.y, z, z);
    }
  }
  dctx.globalAlpha = 1;
}

// one piece leaves the breaker: it drops into the box from where it is now
// It simply falls: gravity takes it from the board into the box, it lands on whatever is already there and
// stays put (an animated "fly to a spot" followed by physics made the pile re-settle after landing).
function dropPiece(p) {
  tumble(p);
  p.k = 1; p.anim = null;
  p.phys = true; p.falling = true;          // falling: the box's open top does not catch it yet
  p.still = 0;                              // awake: a piece that once slept in the box (first round) would hang in the air on a re-cut
  p.vx = (Math.random() - 0.5) * 140; p.vy = 40 + Math.random() * 60;
  if (S.burst) {   // thrown, not tipped: up and away from the middle of the picture, then gravity
    const cx = S.slab[0] + S.slab[2] / 2, off = (p.x + p.w * p.k / 2 - cx) / (S.slab[2] / 2);
    p.vx = off * 260 + (Math.random() - 0.5) * 260; p.vy = -(260 + Math.random() * 520);
  }
  p.lt = 0.6;
  S.lastDrop = performance.now();
  S.pieces.splice(S.pieces.indexOf(p), 1); S.pieces.push(p);
}
// how a piece comes to rest in the box: most lie askew, some end up on their side, some face down
function tumble(p) {
  const r = Math.random();
  p.rest = r < 0.55 ? (Math.random() - 0.5) * 0.9 : r < 0.85 ? (Math.random() - 0.5) * 2.6 : (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2 + (Math.random() - 0.5) * 0.4);
  // the box is a shallow strip: a piece whose resting outline would be taller than the box lies on its side instead
  const [, , , ih] = trayInner(), tall = (a) => 2 * (Math.abs(Math.sin(a)) * p.ww + Math.abs(Math.cos(a)) * p.wh) > ih - 4;
  if (tall(p.rest)) p.rest = (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2 + (Math.random() - 0.5) * 0.08);
  p.flipT = Math.random() < 0.28 ? 1 : 0;
}
// Tumble `which` pieces into the box (all of them after the cut).
function startScatter(now, which = S.pieces) {
  setPhase('scatter'); S.scatterStart = now;
  const [tx, ty, tw, th] = trayInner();
  const order = which.slice().sort(() => Math.random() - 0.5);
  for (const p of S.pieces) p.anim = null;
  order.forEach((p, k) => {
    const spreadX = Math.max(0, tw - 2 * p.bw - 12), spreadY = Math.max(0, th - 2 * p.bh - 12);
    p.anim = {
      from: [p.x, p.y], k0: p.k || 1,
      to: [tx + 6 + (tw - 2 * p.bw - 12) / 2 + (Math.random() - 0.5) * spreadX - (p.w / 2 - p.bw),
           ty + 6 + (th - 2 * p.bh - 12) * (0.15 + 0.7 * Math.random()) - (p.h / 2 - p.bh)],
      delay: k * 18 + Math.random() * 120, dur: 650 + Math.random() * 350, spin: (Math.random() - 0.5) * 1.6,
    };
    tumble(p);
    p.phys = false;
    S.pieces.splice(S.pieces.indexOf(p), 1); S.pieces.push(p);
  });
}
function startPlay() {
  setPhase('play');
  const size = groupSizes();
  for (const p of S.pieces) {
    p.anim = null; p.lt = 0; p.cut = 1; p.k = 1; p.ct = size[p.g] > 1 ? 1 : 0; p.falling = false;
    p.phys = size[p.g] === 1 && inRect(p.x + p.w / 2, p.y + p.h / 2, trayInner());
    if (!p.phys) { p.rest = 0; p.flipT = 0; p.vx = p.vy = 0; }   // only pieces lying loose in the box stay askew
  }
}
function groupSizes() { const size = {}; for (const p of S.pieces) size[p.g] = (size[p.g] || 0) + 1; return size; }
function groupOf(g) { return S.pieces.filter(p => p.g === g); }
function inRect(x, y, r) { return x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3]; }
function groupBox(g) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of groupOf(g)) { const k = p.k || 1; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + p.w * k); y1 = Math.max(y1, p.y + p.h * k); }
  return [x0, y0, x1 - x0, y1 - y0];
}
function finish(now) {
  setPhase('done'); S.doneAt = now; S.turnT = 0; S.autoTurned = false;
  sound.done();
  for (const p of S.pieces) { p.ct = 1; p.phys = false; p.rest = 0; p.flipT = 0; }
}
// A finished puzzle that is NOT glued is only lying together (user 11/20): wobble it with the pointer and a piece comes
// loose and drops into the box. At most 2 per puzzle; the puzzle is unfinished again until they go back in. Glue makes
// it one piece, and then nothing falls. (Called at the top of a frame, never in the middle of one.)
function shedPiece() {
  if (S.phase !== 'done' || S.glueStart) return;
  const b = S.baked, bottom = S.pieces.filter(p => p.yi === b.rows - 1), sides = S.pieces.filter(p => p.xi === 0 || p.xi === b.cols - 1);
  const pool = bottom.length ? bottom : sides, p = pool[Math.floor(Math.random() * pool.length)]; if (!p) return;
  S.shed++;
  // the puzzle back to its playing size, centred where it lies, exactly as it was assembled
  const [sx, sy, sw, sh] = S.slab, ox = sx + (sw - b.W * S.scale) / 2, oy = sy + (sh - b.H * S.scale) / 2;
  setPhase('play'); S.turnT = 0;
  for (const q of S.pieces) { q.k = 1; q.x = ox + q.hx; q.y = oy + q.hy; q.phys = false; q.rot = q.rest = 0; q.flip = q.flipT = 0; q.ct = 1; q.lt = 0; q.cut = 1; }
  p.g = 10000 + p.i; p.ct = 0;   // a group of its own again
  dropPiece(p); sound.snap();
}
// A glued puzzle is sent as a finished postcard (user 11/20): once the envelope has blown away the whole card stays,
// glued, and turns over to the letter by itself (finished-puzzle behaviour). Cut makes it a puzzle again.
function showPostcard(now) {
  for (const p of S.pieces) { p.g = 0; p.k = S.hero; p.x = S.slab[0] + p.hx * p.k; p.y = S.slab[1] + p.hy * p.k; p.cut = 1; p.ct = 1; p.glue = 1;
    p.phys = false; p.falling = false; p.anim = null; p.rot = p.rest = 0; p.flip = p.flipT = 0; p.lt = 0; }
  S.glue = 1; S.glueStart = now - 5000;   // already dry
  setPhase('done'); S.doneAt = now; S.turnT = 0; S.autoTurned = false;
}
function startGlue(now) { if (S.phase !== 'done' || S.glueStart) return; S.glueStart = now; setPhase('done'); sound.brush(1.8); }   // the glue spreads for 1.8 s
// the Cut key: cut the print on the start screen; or, once a finished puzzle has been glued into one piece again,
// send it back through the machine (it turns face up first if it was showing its back)
function cutKey(now) {
  if (S.phase === 'start') { go(now); return; }
  if (S.phase !== 'done' || !S.glueStart) return;
  const recut = () => { if (S.phase !== 'done') return; for (const p of S.pieces) { p.glue = 0; p.g = p.i; p.flashAt = 0; } S.glue = 0; S.glueStart = 0;   // every piece is its own group again
    S.turn = 0; S.turnT = 0; S.revealAt = 0; startCut(performance.now()); };
  if (S.turn > 0.05) { S.turnT = 0; S.autoTurned = true; setTimeout(recut, 520); } else recut();
}
// the orange button on the machine: stop the cut where it is, press again to carry on
function togglePause(now) {
  if (S.phase === 'start') { go(now); return; }   // on the start screen the orange button is simply Go
  if (S.phase === 'done') { cutKey(now); return; }
  if (S.phase !== 'cut') return;
  if (S.paused) { S.cutStart += now - S.paused; S.paused = 0; return; }
  const T = now - S.cutStart;
  if (T < S.plan.tIn || T >= S.plan.tEject) return;   // nothing to hold once the pieces are falling
  S.paused = now;
}
$('machine').querySelector('.btnglow').addEventListener('pointerdown', (e) => { e.stopPropagation(); togglePause(performance.now()); });

// ---------- box physics (loose pieces inside the tray) ----------
function physics(dt) {
  const [tx, ty, tw, th] = trayInner();
  const loose = S.pieces.filter(p => p.phys);
  // walls: the body of the piece stays inside; tabs may poke over the rim
  const walls = (p) => {
    let cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    // extents of the (possibly askew) outline
    const c = Math.abs(Math.cos(p.rot)), s = Math.abs(Math.sin(p.rot));
    const ww = c * p.ww + s * p.wh, wh = s * p.ww + c * p.wh;
    if (cx - ww < tx + 2) { cx = tx + 2 + ww; p.vx = Math.abs(p.vx) * 0.3; }
    if (cx + ww > tx + tw - 2) { cx = tx + tw - 2 - ww; p.vx = -Math.abs(p.vx) * 0.3; }
    // a piece has landed once it is fully inside the rim (or hits the floor); from then on the rim holds it
    if (p.falling && cy - wh >= ty + 2) { p.falling = false; p.lt = 0; }
    if (!p.falling && cy - wh < ty + 2) { cy = ty + 2 + wh; p.vy = Math.abs(p.vy) * 0.3; }
    if (cy + wh > ty + th - 2) { cy = ty + th - 2 - wh; p.vy = -Math.abs(p.vy) * 0.2; p.vx *= 0.92; if (p.falling) { p.falling = false; p.lt = 0; } }
    p.x = cx - p.w / 2; p.y = cy - p.h / 2;
  };
  // Sleeping: a piece that has barely moved for a dozen frames is asleep — no gravity, no separation pushes —
  // so a dense heap comes to rest instead of trembling forever (gravity vs. separation vs. the rim never
  // agree exactly). A sleeper wakes when something awake shoves it, when the box moves, or when it is shaken.
  const asleep = (p) => p.still > 12;
  for (const p of loose) { p.x0 = p.x; p.y0 = p.y; }
  for (const p of loose) {
    if (asleep(p)) { p.vx = p.vy = 0; continue; }
    p.vy += G * dt;
    p.vx *= 0.995; p.vy *= 0.995;
    p.vin = p.vy;                                   // downward speed before the floor and the heap get their say
    if (!p.falling && Math.hypot(p.vx, p.vy) < 80) { p.vx *= 0.85; p.vy *= 0.85; }   // settled pieces stop creeping
    p.x += p.vx * dt; p.y += p.vy * dt;
    walls(p);
  }
  // soft piece-piece separation, two relaxation passes
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < loose.length; i++) for (let j = i + 1; j < loose.length; j++) {
      const a = loose[i], b = loose[j];
      const sa = asleep(a), sb = asleep(b);
      if (sa && sb) continue;
      const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
      let dx = bx - ax, dy = by - ay; let d = Math.hypot(dx, dy); const min = a.r + b.r;
      if (d >= min) continue;
      if (d < 1e-3) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy); }
      const push = (min - d) * 0.5 * 0.6, nx = dx / d, ny = dy / d;
      // a sleeper is a wall to the awake piece, unless the shove is big enough to wake it
      if (sa && push > 1.5) a.still = 0; if (sb && push > 1.5) b.still = 0;
      const ka = asleep(a) ? 0 : (asleep(b) ? 2 : 1), kb = asleep(b) ? 0 : (asleep(a) ? 2 : 1);
      a.x -= nx * push * ka; a.y -= ny * push * ka; b.x += nx * push * kb; b.y += ny * push * kb;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) { a.vx += nx * rel * 0.5; a.vy += ny * rel * 0.5; b.vx -= nx * rel * 0.5; b.vy -= ny * rel * 0.5; }
    }
    for (const p of loose) if (!asleep(p)) walls(p);   // separation must not push anything through the box
  }
  // a piece that lost a lot of its downward speed this step has landed on the floor or on the heap: it makes a sound
  const now = performance.now();
  for (const p of loose) {
    if (asleep(p)) continue;
    const hit = (p.vin || 0) - p.vy;
    if (p.vin > 260 && hit > 260 && now - (p.landAt || 0) > 150) { p.landAt = now; sound.land(Math.min(1, hit / 1500)); }
    const moved = Math.abs(p.x - p.x0) + Math.abs(p.y - p.y0);
    p.still = (!p.falling && moved < 1.2 && Math.hypot(p.vx, p.vy) < 60) ? (p.still || 0) + 1 : 0;
  }
}
function wakeAll() { for (const p of S.pieces) p.still = 0; }
// the box itself moved by (dx, dy): carry its contents, and let them slosh against the motion
function moveTray(dx, dy) {
  S.tray[0] += dx; S.tray[1] += dy;
  wakeAll();
  for (const p of S.pieces) if (p.phys) { p.x += dx; p.y += dy; p.vx -= dx * 10; p.vy -= dy * 10; }
}

// ---------- pointer ----------
function toStage(e) {
  const r = stage.getBoundingClientRect();
  return [(e.clientX - r.left) / S.viewScale, (e.clientY - r.top) / S.viewScale];
}
function hit(x, y) {
  for (let i = S.pieces.length - 1; i >= 0; i--) {
    const p = S.pieces[i];
    // into the piece's own frame: undo its spin about the centre, and the mirror if it lies face down
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    let lx = x - cx, ly = y - cy;
    if (p.rot) { const c = Math.cos(-p.rot), s = Math.sin(-p.rot); [lx, ly] = [c * lx - s * ly, s * lx + c * ly]; }
    if (p.flip > 0.5) lx = -lx;
    lx += p.w / 2; ly += p.h / 2;
    if (lx < 0 || ly < 0 || lx >= p.w || ly >= p.h) continue;
    const tx = Math.floor(lx / S.scale), ty = Math.floor(ly / S.scale);
    if (p.mask[ty * p.pw + tx] > 40) return p;
  }
  return null;
}
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#bar, #foot, #shelf, #note, #writer, #sendbox')) return;
  const [x, y] = toStage(e);
  S.pointer = [x, y];
  if (S.phase === 'start') {
    if (S.writing) closeWriter();                       // a tap anywhere else puts the pen down and turns the print back
    // tap the print: a sent puzzle bursts now; your own turns over, so you can see and write its back before cutting
    else if (inRect(x, y, S.slab)) { if (S.recv) go(performance.now()); else openWriter(); }
    return;
  }
  // the finished puzzle: tap it to turn it over and back (there is something on the back)
  if (S.phase === 'done' && inRect(x, y, groupBox(S.pieces[0].g))) { S.turnT = 1 - S.turnT; S.autoTurned = true; return; }
  if (S.phase !== 'play') return;
  const p = hit(x, y);
  if (!p) {
    if (inRect(x, y, S.tray)) { stage.setPointerCapture(e.pointerId); S.trayDrag = { x, y }; }
    // empty mat: grab it and everything lying on it slides along (the pieces still in the box stay put)
    else { stage.setPointerCapture(e.pointerId); S.matDrag = { x, y }; }
    return;
  }
  stage.setPointerCapture(e.pointerId);
  const members = groupOf(p.g);
  S.drag = { g: p.g, members: members.map(m => ({ m, dx: x - m.x, dy: y - m.y })) };
  // picked up: it straightens in the hand and turns face up
  for (const m of members) { S.pieces.splice(S.pieces.indexOf(m), 1); S.pieces.push(m); m.lt = 1; m.ct = 1; m.phys = false; m.vx = m.vy = 0; m.rest = 0; m.flipT = 0; }
  e.preventDefault();
});
stage.addEventListener('pointermove', (e) => {
  const [x, y] = toStage(e);
  S.pointer = [x, y];
  if (S.drag) { for (const { m, dx, dy } of S.drag.members) { m.x = x - dx; m.y = y - dy; } }
  else if (S.matDrag) {
    const on = S.pieces.filter(p => !p.phys);
    if (on.length) {
      // keep the layout on the page: it may slide until its far edge is 40px inside the window
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of on) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + p.h); }
      let dx = x - S.matDrag.x, dy = y - S.matDrag.y;
      dx = Math.max(40 - x1, Math.min(S.w - 40 - x0, dx)); dy = Math.max(40 - y1, Math.min(S.h - BOTTOM - 40 - y0, dy));
      for (const p of on) { p.x += dx; p.y += dy; }
    }
    S.matDrag = { x, y };
  }
  else if (S.trayDrag) {
    let dx = x - S.trayDrag.x, dy = y - S.trayDrag.y;
    const [tx, ty, tw, th] = S.tray;
    dx = Math.max(GAP - tx, Math.min(S.w - GAP - tw - tx, dx));
    dy = Math.max(TOP - ty, Math.min(S.h - BOTTOM - th - ty, dy));
    moveTray(dx, dy);
    S.trayDrag = { x, y };
  }
});
function snapDist() { return Math.max(10, 0.3 * Math.min(S.baked.cw, S.baked.ch) * S.scale); }
// After a drop: does any member sit next to a neighbour from another group at the right offset? Merge.
function trySnap(g) {
  const lim = snapDist();
  for (let guard = 0; guard < 12; guard++) {
    const members = groupOf(g);
    let hitPair = null;
    outer: for (const m of members) for (const n of S.pieces) {
      if (n.g === g || Math.abs(n.xi - m.xi) + Math.abs(n.yi - m.yi) !== 1) continue;
      const dx = (n.x - m.x) - (n.hx - m.hx), dy = (n.y - m.y) - (n.hy - m.hy);
      if (Math.hypot(dx, dy) < lim) { hitPair = { dx, dy, g2: n.g }; break outer; }
    }
    if (!hitPair) break;
    for (const q of members) { q.x += hitPair.dx; q.y += hitPair.dy; q.g = hitPair.g2; }
    g = hitPair.g2;
  }
  return g;
}
const release = () => {
  S.trayDrag = null; S.matDrag = null;
  if (!S.drag) return;
  const g0 = S.drag.g; S.drag = null;
  for (const p of groupOf(g0)) p.lt = 0;
  if (S.phase === 'play') {
    const before = groupOf(g0), now = performance.now();
    const g = trySnap(g0);
    const members = groupOf(g);
    for (const p of members) {
      p.ct = members.length > 1 ? 1 : 0;
      p.phys = members.length === 1 && inRect(p.x + p.w / 2, p.y + p.h / 2, trayInner());
      p.vx = 0; p.vy = 0; p.still = 0;
      if (members.length > 1) { p.rest = 0; p.flipT = 0; }   // a piece that just got joined lies flat and straight
    }
    // it clicked in: the pieces that just joined, and the neighbours they joined to, glint along their seams
    if (members.length > before.length) {
      const joined = new Set(before);
      for (const n of members) if (!joined.has(n) && before.some(m => Math.abs(n.xi - m.xi) + Math.abs(n.yi - m.yi) === 1)) joined.add(n);
      for (const p of joined) p.flashAt = now;
      sound.snap();
    }
    if (members.length === S.pieces.length) finish(now);
  }
};
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);
stage.addEventListener('pointerleave', () => { if (!S.drag) S.pointer = null; });
stage.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse' && S.phase === 'done') setTimeout(() => { if (!S.drag) S.pointer = null; }, 900); });

// ---------- controls ----------
// every button sounds like a key being pressed (cuelume's Press keycap): down as it is pressed, up as it is let go
const KEYISH = 'button, #machine .btnglow';
let keyHeld = false;
addEventListener('pointerdown', (e) => { const b = e.target.closest?.(KEYISH); if (b && !b.disabled) { keyHeld = true; sound.keyDown(); } }, true);
const keyLetGo = () => { if (keyHeld) { keyHeld = false; sound.keyUp(); } };
addEventListener('pointerup', keyLetGo, true); addEventListener('pointercancel', keyLetGo, true);
addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && e.target.closest?.('button')) { keyHeld = true; sound.keyDown(); } }, true);
addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') keyLetGo(); }, true);
// Hover hints (user 11/20: no tips on the page). An element with data-tip shows one line above it while the mouse is
// over it; on a touch screen, which has no hover, a long press shows it (and that press does not count as a tap).
const TIP = $('tip');
function showTip(el) {
  const text = el.dataset.tip; if (!text) return;
  TIP.textContent = text; TIP.classList.add('show');
  const r = el.getBoundingClientRect(), st = stage.getBoundingClientRect(), w = TIP.offsetWidth;
  const cx = Math.max(12 + w / 2, Math.min(st.width - 12 - w / 2, r.left + r.width / 2 - st.left));
  TIP.style.left = cx + 'px'; TIP.style.top = (r.top - st.top - 10) + 'px';
}
const hideTip = () => TIP.classList.remove('show');
addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') { const el = e.target.closest?.('[data-tip]'); if (el) showTip(el); } });
addEventListener('pointerout', (e) => { const el = e.target.closest?.('[data-tip]'); if (el && !el.contains(e.relatedTarget)) hideTip(); });
let tipPress = null;
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') { hideTip(); return; }
  const el = e.target.closest?.('[data-tip]'); if (!el) return;
  clearTimeout(tipPress?.t); tipPress = { el, shown: false, t: setTimeout(() => { tipPress.shown = true; showTip(el); }, 450) };
}, true);
const endPress = () => { if (!tipPress) return; clearTimeout(tipPress.t); if (tipPress.shown) setTimeout(hideTip, 1600); };
addEventListener('pointerup', endPress, true); addEventListener('pointercancel', endPress, true);
addEventListener('click', (e) => {   // a long press was for reading, not for pressing
  if (tipPress?.shown && tipPress.el.contains(e.target)) { e.preventDefault(); e.stopPropagation(); tipPress = null; }
}, true);
$('bar').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.n) { S.count = +b.dataset.n; select('counts', b); rebuild(); }
  else if (b.dataset.f) {
    const fin = $('finish');
    if (S.w < 700 && !fin.classList.contains('open')) { fin.classList.add('open'); return; }   // phone: the chip opens first
    S.finish = +b.dataset.f; select('finish', b); fin.classList.remove('open');
  }
  else if (b.id === 'glue') startGlue(performance.now());
  else if (b.id === 'cut') cutKey(performance.now());
  else if (b.id === 'restart') rebuild();
  else if (b.id === 'send') { sound.send(); if (S.recv) writeBack(); else send(b); }
});
// the credit line's heart: fills once you tap it, and stays filled on this browser
{ const h = $('heart'); try { if (localStorage.getItem('puzzle-loved')) h.classList.add('loved'); } catch {}
  h.addEventListener('click', () => { h.classList.toggle('loved'); try { localStorage.setItem('puzzle-loved', h.classList.contains('loved') ? '1' : ''); } catch {} }); }
function select(group, b) { for (const x of document.querySelectorAll(`#${group} button`)) x.classList.toggle('on', x === b); }

// the shelf: a column of small prints lying on the mat at the left — the built-in scene, any
// photos/sample-N.jpg that exist, and every photo you add (which joins the column, named after its file)
// Dusk (drawn in code) stays as number 0 so there is always a picture, but it only shows on the shelf when it is the one in use.
const SAMPLES = [{ name: 'Dusk', src: null, key: 0, image: DUSK, hidden: true }];
['Duck', 'Lake', 'Tennis', 'Egg', 'Flowers', 'Santa'].forEach((name, i) => SAMPLES.push({ name, src: `photos/${name.toLowerCase()}.jpg`, key: i + 1 }));
// fetch one of the shelf's pictures ahead of the shelf itself (the first one at start-up, the one a link names)
function loadSample(k) {
  const s = SAMPLES[k];
  return new Promise((res) => {
    if (!s || !s.src) return res(null);
    if (s.image) return res(s);
    const img = new Image(); img.onload = () => { s.image = img; res(s); }; img.onerror = () => res(null); img.src = s.src;
  });
}
function useSample(s) { S.image = s.image; S.imageName = s.name; S.sampleKey = s.key; }
function buildShelf() {
  const shelf = $('shelf'); shelf.innerHTML = '<span class="num" data-i="1">1</span>';
  for (const s of SAMPLES) {
    if (s.hidden && S.image !== s.image) continue;
    const card = document.createElement('button'); card.className = 'print';
    const img = document.createElement('img'); card.appendChild(img);
    const name = document.createElement('span'); name.className = 'name'; name.textContent = s.name; card.appendChild(name);
    if (s.image) img.src = s.image.src || s.image.toDataURL('image/jpeg', 0.7);
    else if (s.src) { img.src = s.src; img.onerror = () => card.remove(); img.onload = () => { s.image = img; }; }
    else { img.src = S.image.toDataURL('image/jpeg', 0.7); s.image = S.image; }
    if (s.image === S.image) card.classList.add('on');
    card.addEventListener('click', () => { if (!s.image || S.phase !== 'start') return; S.image = s.image; S.imageName = s.name; S.sampleKey = s.key ?? null; mark(card); rebuild(); });
    shelf.appendChild(card);
  }
  const own = document.createElement('button'); own.className = 'print own'; own.innerHTML = '<span class="plus">+</span><span class="name">Add yours</span>';
  own.addEventListener('click', () => { if (S.phase === 'start') fileInput.click(); });
  shelf.appendChild(own);
  function mark(b) { for (const x of shelf.querySelectorAll('.print')) x.classList.toggle('on', x === b); }
}
fileInput.addEventListener('change', () => { const f = fileInput.files[0]; if (f) loadFile(f); fileInput.value = ''; });
stage.addEventListener('dragover', (e) => e.preventDefault());
stage.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) loadFile(f); });
function loadFile(f) {
  const url = URL.createObjectURL(f), img = new Image();
  const name = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 14) || 'Photo';
  img.onload = () => { S.image = img; S.imageName = name; S.sampleKey = null; SAMPLES.push({ name, image: img }); buildShelf(); rebuild(); };
  img.src = url;
}

// ---------- the letter on the back ----------
function refreshLetter() {
  S.letterCanvas = hasLetter(S.letter) && S.baked ? renderLetter(S.letter, S.baked.W, S.baked.H) : null;
  R.setLetter(S.letterCanvas);
  buildNote();
}
// the card on the right of the mat: the back of the print. Tap it to turn the print over and write.
function buildNote() {
  const card = $('noteCard'), back = card.querySelector('.back'), [n1, n2] = card.querySelectorAll('.name');
  back.innerHTML = '';
  if (S.recv) {   // a puzzle someone sent: the card stays face down until the puzzle is done
    n1.textContent = S.letter.to.trim() ? `For ${S.letter.to.trim()}` : 'For you';
    n2.textContent = S.letter.from.trim() ? `From ${S.letter.from.trim()}` : '';
    card.disabled = true;
    return;
  }
  if (S.letterCanvas) { const img = new Image(); img.src = S.letterCanvas.toDataURL(); back.appendChild(img); }
  else back.innerHTML = '<span class="plus">+</span>';
  n1.textContent = S.writing ? 'Turn back' : 'On the back'; n2.textContent = '';
  card.classList.toggle('on', S.writing);
}
function placeWriter() {
  const [x, y, w, h] = S.slab, st = $('writer').style;
  st.left = x + 'px'; st.top = y + 'px'; st.width = w + 'px'; st.height = h + 'px';
  st.padding = `${h * LAYOUT.my}px ${w * LAYOUT.mx}px`;
  st.fontSize = (h * LAYOUT.size) + 'px'; st.lineHeight = LAYOUT.leading; st.fontFamily = HAND;
}
// Writing the letter on a phone: the turned print grows to fill what the keyboard leaves of the screen (the
// visual viewport), under a Done key; everything else steps aside (CSS, body.writing). Back to its place after.
function writeRect() {
  const vv = window.visualViewport, k = S.viewScale || 1;
  const top = (vv ? vv.offsetTop : 0) / k + 12 + 48, bottom = (vv ? vv.offsetTop + vv.height : innerHeight) / k - 12;
  const a = S.baked.W / S.baked.H, w = Math.max(120, Math.min(S.w - 24, (bottom - top) * a)), h = w / a;
  return [(S.w - w) / 2, top, w, h];
}
function placeDone() { const vv = window.visualViewport; $('wdone').style.top = ((vv ? vv.offsetTop : 0) / (S.viewScale || 1) + 12) + 'px'; }
for (const ev of ['resize', 'scroll']) window.visualViewport?.addEventListener(ev, () => { if (S.writing && S.w < 700) { S.slabTo = writeRect(); placeDone(); } });
function openWriter() {
  if (S.phase !== 'start' || S.recv || S.writing) return;
  S.writing = true;
  document.body.classList.add('writing');
  if (S.w < 700) { S.slabTo = writeRect(); placeDone(); }
  $('w-to').value = S.letter.to; $('w-body').value = S.letter.body; $('w-from').value = S.letter.from;
  placeWriter(); fitNames(); buildNote();
  setTimeout(() => { if (S.writing) $(S.letter.to ? 'w-body' : 'w-to').focus(); }, 520);
}
function closeWriter() {
  if (!S.writing) return;
  S.writing = false;
  document.body.classList.remove('writing');
  if (S.slabHome) S.slabTo = S.slabHome.slice();
  S.letter = { to: $('w-to').value, body: $('w-body').value, from: $('w-from').value };
  document.activeElement?.blur?.();
  refreshLetter();
}
$('noteCard').addEventListener('click', () => { S.writing ? closeWriter() : openWriter(); });
// the two name fields are exactly as wide as what is written in them, so the comma and the dash sit against the name
const meter = document.createElement('canvas').getContext('2d');
function fitNames() {
  for (const id of ['w-to', 'w-from']) {
    const el = $(id); meter.font = `${parseFloat($('writer').style.fontSize) || 16}px ${HAND}`;
    el.style.width = Math.ceil(meter.measureText(el.value || el.placeholder).width + 2) + 'px';
  }
}
$('writer').addEventListener('input', fitNames);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeWriter(); });

// Send: a link that carries the puzzle as it is packed now (picture, cut, finish) and the letter on its back
function smallPhoto() {   // an own photo has nowhere to live yet, so a small copy rides in the link itself
  const k = Math.min(1, 560 / Math.max(S.print.width, S.print.height));
  const c = document.createElement('canvas'); c.width = Math.round(S.print.width * k); c.height = Math.round(S.print.height * k);
  c.getContext('2d').drawImage(S.print, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.5);
}
// The link. A sample photo is named by its number; your own photo is kept by the site, encrypted (src/card.js), so the
// link stays short — once per photo: sending the same one again reuses it. If keeping it fails (offline, the store
// is down) the photo rides in the link as before: long, but it still works.
async function makeLink() {
  if (S.writing) closeWriter();
  const state = { v: 1, n: S.count, f: S.finish, d: S.seed, s: S.sampleKey, to: S.letter.to.trim(), body: S.letter.body.trim(), from: S.letter.from.trim(), g: S.phase === 'done' && S.glueStart ? 1 : 0 };
  // everything goes into one sealed card (a sample photo by its number); the same puzzle sent again reuses its card
  const sig = JSON.stringify(state);
  try {
    if (!S.card || S.card.sig !== sig || S.card.image !== S.image) S.card = { sig, image: S.image, ...(await storeCard(state, S.sampleKey == null ? S.print : null)) };
    return packLink(state, null, S.card);
  } catch (e) { console.warn('Puzzle Card: could not keep the card, it goes in the link instead.', e); return packLink(state, S.sampleKey == null ? smallPhoto() : null); }
}
// Send opens a small box above its key: the link (already copied), and two other ways out that need no server —
// the system share sheet where the browser has one, and the visitor's own mail app with the link in the message.
let sendUrl = '';
async function copyLink() {
  try { await navigator.clipboard.writeText(sendUrl); }
  catch { const ta = document.createElement('textarea'); ta.value = sendUrl; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
  const k = $('sb-copy'); k.textContent = 'Copied'; k.classList.add('on'); clearTimeout(k._t); k._t = setTimeout(() => { k.textContent = 'Copy link'; k.classList.remove('on'); }, 1800);
}
async function send(b) {
  const box = $('sendbox');
  if (box.classList.contains('show')) { closeSendBox(); return; }
  // the box opens at once; with your own photo its keys wake once the photo is sealed and kept (a second or so)
  sendUrl = ''; const keys = box.querySelectorAll('.keys button');
  for (const k of keys) k.disabled = true;
  $('sb-link').textContent = '…';
  $('sb-share').style.display = navigator.share ? '' : 'none';
  $('sb-cap').textContent = S.sampleKey == null ? 'Sealing your photo…' : 'Sealing…';
  makeLink().then((url) => {
    sendUrl = url; $('sb-link').textContent = url.replace(/^https?:\/\//, '');
    // the title says what they will get; hovering it says what that means for them (no tips on the page: user 11/20)
    const glued = S.phase === 'done' && !!S.glueStart, cap = $('sb-cap');
    cap.textContent = glued ? 'Send as a postcard' : 'Send as a puzzle';
    cap.dataset.tip = glued ? 'They get the whole card, and it turns over to your letter.' : 'They put it together before they can read your letter.';
    for (const k of keys) k.disabled = false;
  });
  // it sits just above the Send key, its right edge on the key's right edge
  const r = b.getBoundingClientRect(), st = stage.getBoundingClientRect();
  const bw = box.offsetWidth || 300;   // and never closer than 12px to either edge (a phone's Send key sits near the middle)
  box.style.right = Math.max(12, Math.min(st.right - r.right, st.width - bw - 12)) + 'px'; box.style.bottom = (st.bottom - r.top + 14) + 'px';
  box.classList.add('show');
}
function closeSendBox() { $('sendbox').classList.remove('show'); }
const sendOff = (ms) => setTimeout(() => startPack(performance.now()), ms);
$('sb-copy').addEventListener('click', async () => { await copyLink(); sendOff(450); });
$('sb-share').addEventListener('click', () => { navigator.share({ title: mailSubject(), url: sendUrl }).then(() => sendOff(150), () => {}); });
function mailSubject() { const f = S.letter.from.trim(); return f ? `A puzzle from ${f}` : 'A puzzle for you'; }
// Email: the link is copied first, then the visitor's own mail app opens with a subject and a line or two. Nothing
// is sent by us and no address is asked for. A link carrying their own photo is too long to ride in a mail link,
// so then the message asks them to paste it (it is on the clipboard) and the box says so for a moment.
$('sb-mail').addEventListener('click', async () => {
  const to = S.letter.to.trim(), from = S.letter.from.trim(), fits = sendUrl.length <= 1800;
  await copyLink();
  const body = `${to ? `Dear ${to},\n\n` : ''}I made you a puzzle. There is something on the back.\n\n${fits ? sendUrl : '(paste the link here: it is on your clipboard)'}${from ? `\n\n${from}` : ''}`;
  location.href = `mailto:?subject=${encodeURIComponent(mailSubject())}&body=${encodeURIComponent(body)}`;
  if (!fits) $('sb-cap').textContent = 'Link copied: paste it into your email';
  sendOff(fits ? 400 : 1600);
});
addEventListener('pointerdown', (e) => { if (!e.target.closest('#sendbox, #send')) closeSendBox(); if (!e.target.closest('#finish')) $('finish').classList.remove('open'); });
$('wdone').addEventListener('click', closeWriter);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSendBox(); });
window.__link = makeLink;
// Write back: the person who was sent a puzzle becomes the sender. The names swap (it goes back to whoever
// sent it, signed by whoever it was for), the photos come back, and the print turns over ready to be written on.
function writeBack() {
  const { to, from } = S.letter;
  S.recv = false; S.recvGlued = false; delete document.body.dataset.mode;
  history.replaceState(null, '', location.pathname + location.search);   // the page is yours now; the link you were sent still opens their letter
  S.letter = { to: from, body: '', from: to };
  useSample(SAMPLES[1].image ? SAMPLES[1] : SAMPLES[0]);
  buildShelf(); rebuild(); flashNumbers(); openWriter();
}
// the order of things, printed on the mat as 1 2 3 4: they light up one after another when the page opens
function flashNumbers() { const c = document.body.classList; c.remove('intro'); void document.body.offsetWidth; c.add('intro'); }
// opened from a link: unpack it before the first build
async function unpack() {
  const got = parseLink();
  if (!got) { const s = await loadSample(1); if (s) useSample(s); return; }   // your own page opens on the first picture of the shelf
  let st = got.state, cardImage = null;
  if (got.card) {
    try { const c = await loadCard(got.card.id, got.card.key); st = st || c.state; cardImage = c.image; }
    catch (e) { console.warn('Puzzle Card: the card could not be opened.', e); }
  }
  if (!st) { const s = await loadSample(1); if (s) useSample(s); return; }   // nothing to open: just the page
  S.recv = true; document.body.dataset.mode = 'recv'; S.recvGlued = st.g === 1;
  if ([9, 20, 50, 100].includes(st.n)) S.count = st.n;
  if (st.f >= 0 && st.f <= 4) S.finish = st.f | 0;
  if (Number.isFinite(st.d)) S.seed = st.d;
  S.letter = { to: String(st.to || '').slice(0, 40), body: String(st.body || '').slice(0, 1200), from: String(st.from || '').slice(0, 40) };
  document.title = S.letter.from.trim() ? `A puzzle from ${S.letter.from.trim()}` : 'A puzzle for you';
  select('counts', document.querySelector(`#counts [data-n="${S.count}"]`));
  select('finish', document.querySelector(`#finish [data-f="${S.finish}"]`));
  if (cardImage) { S.image = cardImage; S.sampleKey = null; }
  else if (got.image) await new Promise((res) => { const img = new Image(); img.onload = () => { S.image = img; S.sampleKey = null; res(); }; img.onerror = res; img.src = got.image; });
  else if (st.s > 0) { const s = await loadSample(st.s); if (s) useSample(s); }
}
addEventListener('hashchange', () => location.reload());

// ---------- window ----------
function fitViewport() { S.viewScale = 1; layout(); }
addEventListener('resize', fitViewport);

// ---------- loop ----------
const easeIn = (t) => t * t, easeOut = (t) => 1 - (1 - t) * (1 - t);
function frame(now) {
  if (S.shedNext) { S.shedNext = false; shedPiece(); }   // between frames, so a frame never changes phase halfway
  const t = (now - S.t0) / 1000;
  const dt = Math.min(0.033, (now - S.last) / 1000); S.last = now;
  const ph = S.phase;

  // phase clocks
  if (ph === 'cut') {
    const T = (S.paused || now) - S.cutStart, P = S.plan, m = $('machine'), seg = m.querySelector('.seg');   // paused: the clock holds
    const smooth = (u) => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const [sx, sy, sw, sh] = S.slab;
    // The print never moves; the machine comes down over it. rowAt(r) = how far the machine has to come down for
    // its blade (the pill's lower edge) to lie on row r's LOWER boundary: the knife cuts where the light is, so the
    // seam between this row and the next appears under the hairline as the head passes, and the row below stays whole
    // Rows and columns are measured on the print as it is NOW, not as it was when Cut was pressed: on a phone the
    // browser's toolbar can come or go mid-cut (tapping Cut near the bottom brings Safari's up), the page lays out
    // again a little smaller, and a machine still stepping the old row height ran past the print (user 11/19).
    const cellW = sw / P.cols, cellH = sh / P.rows;
    const rowAt = (r) => sy + (r + 1) * cellH - S.bladeY;
    const sheetY = sy;
    S.sheet.x = sx;
    let machineTop = 0, headU = 0.1, dropping = false, state = 'on', stage;
    S.sheet.amt = 1;
    if (T < P.tIn) {                                       // the machine wakes where it rests
      stage = 'in';
    } else if (T < P.tFeed) {                              // it comes down onto the first row
      stage = 'down'; state = 'on ready';
      machineTop = rowAt(0) * smooth((T - P.tIn) / (P.tFeed - P.tIn));
    } else if (T < P.tCut) {                               // row by row: step the machine down, sweep the light
      stage = 'cut'; state = 'on cutting';
      const t = T - P.tFeed, per = P.sweep + P.step;
      const r = Math.min(P.rows - 1, Math.floor(t / per)), tr = t - r * per;
      const stepU = Math.min(1, tr / P.step), sweepU = Math.max(0, Math.min(1, (tr - P.step) / P.sweep));
      machineTop = r === 0 ? rowAt(0) : rowAt(r - 1) + (rowAt(r) - rowAt(r - 1)) * smooth(stepU);
      if (r !== S.cutRow) { if (r > 0) sound.step(); S.cutRow = r; }
      // the shredder grind runs while the light sweeps this row; a pause cuts it off, carrying on starts it again
      if (S.paused) { if (S.shred) { S.shred.stop(); S.shred = null; } S.shredRow = -1; }
      else if (sweepU > 0 && sweepU < 1 && S.shredRow !== r) { S.shredRow = r; S.shred = sound.shred((1 - sweepU) * P.sweep / 1000); }
      const ltr = r % 2 === 0;
      headU = ltr ? sweepU : 1 - sweepU;
      const headX = sx + headU * sw;
      for (const p of S.pieces) {
        if (p.yi < r) p.cut = 1;
        else if (p.yi === r) {
          const left = sx + p.xi * cellW, right = left + cellW;
          p.cut = ltr ? Math.min(1, Math.max(0, (headX - left) / cellW)) : Math.min(1, Math.max(0, (right - headX) / cellW));
        } else p.cut = 0;
        if (p.cut >= 1 && !p.snd) { p.snd = true; sound.snip(); }   // the knife is through this piece
      }
    } else if (T < P.tEject) {                             // the machine goes back up to rest
      stage = 'up'; state = 'on';
      machineTop = rowAt(P.rows - 1) * (1 - smooth((T - P.tCut) / (P.tEject - P.tCut)));
      for (const p of S.pieces) { p.cut = 1; p.snd = true; }
    } else {                                               // the pieces tip off the print into the box, bottom row first
      stage = 'drop';
      dropping = true;
      const u = Math.min(1, (T - P.tEject) / 600);
      S.sheet.amt = 1 - u;
      for (const p of S.pieces) {
        if (p.phys) continue;
        const due = S.burst ? p.burstAt : P.tEject + (P.rows - 1 - p.yi) * 130 + (p.xi * 37 % 90);   // a burst goes all at once
        if (T >= due) dropPiece(p);
      }
    }
    if (stage !== S.cutStage) {                            // the motor whirs while the machine travels
      if (!S.paused && stage === 'down') sound.move((P.tFeed - T) / 1000, true);
      if (!S.paused && stage === 'up') sound.rise((P.tEject - T) / 1000);   // cuelume's count, held until the machine has cleared the print
      S.cutStage = stage;
    }
    S.sheet.y = sheetY;
    for (const p of S.pieces) if (!p.phys) { p.x = sx + p.hx * S.hero; p.y = sheetY + p.hy * S.hero; }
    m.style.top = (S.machineRest + machineTop) + 'px';
    if (S.paused) state = 'on paused';
    if (m.className !== state) m.className = state;
    // the bright segment rides the hairline above the board's span
    const mLeft = parseFloat(m.style.left), mW = parseFloat(m.style.width);
    const lineL = mLeft + mW * 0.057, lineW = mW * 0.879;
    const segX = Math.min(lineL + lineW - mW * 0.08, Math.max(lineL, sx + headU * sw - mW * 0.04));
    seg.style.left = ((segX - mLeft) / mW * 100) + '%';
    // everything has landed (or the last one left the board a while ago and is just lying high on the pile)
    if (dropping && S.pieces.every(p => p.phys) && (S.pieces.every(p => !p.falling) || now - S.lastDrop > 1500)) startPlay();
  } else {
    // idle machine: LED on while there are loose pieces to work on, standby otherwise
    // idle: the Go button breathes (not for a sent puzzle, which starts by itself)
    const m = $('machine'), cls = ph === 'play' || ph === 'scatter' ? 'on' : ph === 'start' ? (S.recv ? '' : 'idle') : '';
    if (m.className !== cls) m.className = cls;
  }
  if (ph === 'scatter') {
    let all = true;
    for (const p of S.pieces) { const a = p.anim; if (a && now - S.scatterStart - a.delay < a.dur) all = false; }
    if (all) startPlay();
  }
  // pieces dropping into the box (after the breaker, or on a re-scatter)
  if (ph === 'cut' || ph === 'scatter') {
    for (const p of S.pieces) {
      const a = p.anim; if (!a) continue;
      const start = a.start ?? (S.scatterStart + a.delay);
      const k = Math.min(1, Math.max(0, (now - start) / a.dur));
      p.k = a.k0 + (1 - a.k0) * easeOut(k);
      const fcx = a.from[0] + p.w * a.k0 / 2, fcy = a.from[1] + p.h * a.k0 / 2;
      const tcx = a.to[0] + p.w / 2, tcy = a.to[1] + p.h / 2;
      const cx = fcx + (tcx - fcx) * easeOut(k), cy = fcy + (tcy - fcy) * easeIn(k) - Math.sin(Math.PI * k) * 10;
      p.x = cx - p.w * p.k / 2; p.y = cy - p.h * p.k / 2;
      p.lift = Math.sin(Math.PI * k);
      p.rot = a.spin * Math.sin(Math.PI * k) + p.rest * easeOut(k);   // tumbles, then settles at its resting angle
      p.flip = p.flipT * easeOut(k);                                  // some turn over on the way down
      p.cut = 1;
    }
  }
  if (ph === 'play' || ph === 'cut') {   // during the cut: the pieces that have left the board are falling
    physics(dt);
  } else if (ph === 'done') {
    // picked up: the finished puzzle grows back to hero size in the middle of the stage
    for (const p of S.pieces) {
      p.k += (S.hero - p.k) * 0.08;
      p.x += (S.slab[0] + p.hx * p.k - p.x) * 0.08;
      p.y += (S.slab[1] + p.hy * p.k - p.y) * 0.08;
    }
  }
  if (ph === 'done' && S.glueStart) {
    const prog = ((now - S.glueStart) / 1800) * 1.3;
    const [bx, by, bw, bh] = groupBox(S.pieces[0].g);
    for (const p of S.pieces) {
      const d = ((p.x + p.w * p.k / 2 - bx) / bw + (p.y + p.h * p.k / 2 - by) / bh) / 2;
      p.glue = Math.min(1, Math.max(0, (prog - d) / 0.3));
    }
    S.glue = Math.min(1, prog / 1.3);
  }

  // the box only exists once there are loose pieces to hold
  S.trayIn += ((ph === 'start' || ph === 'done' || ph === 'pack' ? 0 : 1) - S.trayIn) * (ph === 'cut' ? 0.03 : 0.1);

  // light: follows the pointer, otherwise drifts; on completion it sweeps across first
  let target;
  if (ph === 'done' && now - S.doneAt < 1800) {
    const k = (now - S.doneAt) / 1800;
    target = [S.w * (-0.3 + 1.6 * k), S.h * 0.3, S.h * 0.55];
  } else if (S.pointer) target = [S.pointer[0], S.pointer[1], Math.max(S.w, S.h) * 0.9];
  else target = [S.w * (0.5 + 0.22 * Math.sin(t * 0.33)), S.h * (0.22 + 0.06 * Math.cos(t * 0.27)), Math.max(S.w, S.h) * 1.0];
  for (let i = 0; i < 3; i++) S.light[i] += (target[i] - S.light[i]) * 0.14;

  // finished puzzle: floats and tilts toward the pointer, like a card held up to the light
  const done = ph === 'done';
  const box = done ? groupBox(S.pieces[0].g) : S.slab;
  const pivot = [box[0] + box[2] / 2, box[1] + box[3] / 2];
  S.hold += ((done ? 1 : 0) - S.hold) * 0.08;
  // the finished puzzle sways fully; the print on the start screen sways gently too, so the chosen finish shows its shine
  const sway = done ? S.hold : ph === 'start' && !S.writing ? 0.45 : 0;
  // turning over: the print on the start screen while you write on its back, the finished puzzle to show the letter
  if (done && S.letterCanvas && !S.autoTurned && now - S.doneAt > 1700) { S.turnT = 1; S.autoTurned = true; }
  // a sent puzzle: the whole picture is shown for a moment (time it is actually on screen), then it bursts apart
  let envHere = false;
  if (ph === 'start' && S.recv) {   // a sent puzzle: sealed in its envelope until tapped, then opened
    envHere = true;
    if (!S.openStart) { if (!ENV.classList.contains('sealed')) { writeEnv(); ENV.classList.add('sealed'); } placeEnv(0, 0, 1); }
    else {
      const T = now - S.openStart, d = clamp01(T / OPEN.dissolve), front = d * 1.4 - 0.25;
      placeEnv(0, 0, d < 1 ? 1 : 0); ENV.style.setProperty('--d', d.toFixed(3));
      if (d < 1) spawnGrains(front, 0.25, Math.round(6000 * dt / (OPEN.dissolve / 1000)));
      if (T > OPEN.dissolve + OPEN.hold) { placeEnv(0, 0, 0); ENV.classList.remove('dissolve'); (S.recvGlued ? showPostcard : startBurst)(now); return; }
    }
  }
  if (ph === 'pack') {   // sending: back together, into the envelope, sealed, away
    envHere = true;
    const T = now - S.packStart, [hx0, hy0, , hh0] = S.slabHome;
    // it flies off into the top-right corner (user 11/19), getting smaller as it goes, faster and faster
    const flyU = Math.pow(clamp01((T - PACK.fly[0]) / (PACK.fly[1] - PACK.fly[0])), 2);
    const cx = hx0 + S.slabHome[2] / 2, cy = hy0 + hh0 / 2, sc = 1 - 0.6 * flyU;
    const flyX = (S.w + 40 - cx) * flyU, fly = (-40 - cy) * flyU;
    for (const p of S.pieces) {
      const hx = hx0 + p.hx * S.hero, hy = hy0 + p.hy * S.hero;
      const tx = cx + (hx - cx) * sc + flyX, ty = cy + (hy - cy) * sc + fly;
      if (T < PACK.fly[0]) { p.k += (S.hero - p.k) * 0.14; p.x += (tx - p.x) * 0.14; p.y += (ty - p.y) * 0.14; }
      else { p.k = S.hero * sc; p.x = tx; p.y = ty; }
    }
    const W = PACK.wrap, D = W[1] - W[0], dAt = (ms) => clamp01((ms - W[0]) / D) * 1.4 - 0.25;   // where the sealing edge is at time ms
    const d = clamp01((T - W[0]) / D);
    placeEnv(fly, 0, T > W[0] - 900 ? 1 : 0, flyX, sc); ENV.style.setProperty('--d', d.toFixed(3));
    if (T > W[0] - 900 && T < W[1]) spawnGrains(0, 0.25, Math.round(6000 * dt / (D / 1000)), (life) => dAt(T + life * 1000));
    const stg = T >= PACK.fly[0] ? 3 : T >= W[0] - 300 ? 1 : 0;
    if (stg !== S.packStage) { S.packStage = stg; if (stg === 1) sound.sand((D + 300) / 1000); if (stg === 3) sound.rise((PACK.fly[1] - PACK.fly[0]) / 1000); }
    if (T > PACK.fly[1] + 150) { placeEnv(0, 0, 0); ENV.classList.remove('gather'); rebuild(); return; }
  }
  if (!envHere && S.envOn) { placeEnv(0, 0, 0); ENV.classList.remove('sealed', 'dissolve', 'gather'); }
  stepDust(dt, t);
  const turnTo = ph === 'start' ? (S.writing ? 1 : 0) : done ? S.turnT : 0;
  if (turnTo !== S.turnTo) { if (S.turnTo !== undefined && Math.abs(turnTo - S.turn) > 0.5) sound.flip(turnTo > 0.5); S.turnTo = turnTo; }   // the card starts to turn over
  S.turn += (turnTo - S.turn) * 0.10;
  const tc = Math.cos(Math.PI * S.turn), tsq = Math.max(0.04, Math.abs(tc)), tback = tc < 0, turning = S.turn > 0.002;
  // the first time the finished puzzle shows its back, the letter writes itself in
  if (done && tback && !S.revealAt) S.revealAt = now;
  const lines = S.letterCanvas ? S.letterCanvas.lines : [0, 1, 1];
  const reveal = !done ? 2 : !S.revealAt ? 0 : (() => { const u = (now - S.revealAt - 200) / Math.min(4200, Math.max(1500, lines[2] * 420)); return u >= 1 ? 2 : Math.max(0, u) * 1.12; })();
  { const wr = $('writer'), show = S.writing && S.turn > 0.9; if (wr.classList.contains('show') !== show) wr.classList.toggle('show', show);
    if (wr.classList.contains('live') !== S.writing) wr.classList.toggle('live', S.writing); }
  let tx = 0, ty = 0;
  if (sway > 0 && S.pointer && !S.drag) {
    const nx = Math.max(-1, Math.min(1, (S.pointer[0] - pivot[0]) / (box[2] * 0.6)));
    const ny = Math.max(-1, Math.min(1, (S.pointer[1] - pivot[1]) / (box[3] * 0.6)));
    tx = -ny * 0.20; ty = nx * 0.26;   // the side under the pointer comes toward you
  }
  S.tilt[0] += (tx * sway - S.tilt[0]) * 0.10; S.tilt[1] += (ty * sway - S.tilt[1]) * 0.10;
  // wobble: how far the card has swung in the last half second or so; enough of it shakes a loose piece out
  const tp = S.tiltPrev || S.tilt, swing = Math.hypot(S.tilt[0] - tp[0], S.tilt[1] - tp[1]); S.tiltPrev = [S.tilt[0], S.tilt[1]];
  if (done && !S.glueStart && S.shed < 2 && S.turn < 0.05 && now - S.doneAt > 1900) {
    S.wobble = S.wobble * Math.exp(-dt * 1.8) + swing;
    if (S.wobble > WOBBLE && now - (S.shedAt || 0) > 1200) { S.wobble = 0; S.shedAt = now; S.shedNext = true; }
  } else S.wobble = 0;

  // the print gliding to its writing size on a phone, and back (the writer's fields follow it)
  if (S.slabTo) {
    let near = true;
    for (let i = 0; i < 4; i++) { S.slab[i] += (S.slabTo[i] - S.slab[i]) * 0.2; if (Math.abs(S.slabTo[i] - S.slab[i]) > 0.3) near = false; }
    if (near) { S.slab = S.slabTo.slice(); S.slabTo = null; }
    if (S.writing) { placeWriter(); fitNames(); }   // the name fields follow the type size
  }
  // start screen: only the slab is drawn; its seam map hints at the coming cuts (fades in after a count change)
  if (ph === 'start') S.previewAmt += (1 - S.previewAmt) * 0.08;
  const whole = ph === 'start' && S.recv;   // a sent puzzle lies there already cut
  // where the finishing light is right now: it travels with the lamp's own sweep (same clock, same x)
  const sweepE = done ? Math.min(1, (now - S.doneAt) / 1800) : 1;
  const sweepX = S.w * (-0.3 + 1.6 * sweepE), sweepAmt = done ? Math.sin(Math.PI * sweepE) : 0;
  const pieces = ph === 'start' && !whole ? [] : S.pieces.map(p => {
    p.lift += (p.lt - p.lift) * 0.22; p.clarity += (p.ct - p.clarity) * 0.16;
    if (!p.anim) { p.rot += (p.rest - p.rot) * 0.12; p.flip += (p.flipT - p.flip) * 0.12; }   // tumbles to its resting angle while it falls
    const k = p.k || 1, s = k * (1 + 0.05 * p.lift), cx = p.x + p.w * k / 2, cy = p.y + p.h * k / 2;
    // the whole finished puzzle turns about its vertical middle: each piece swings across and shows its back
    const w = p.w * s, h = p.h * s, x = (done && turning ? pivot[0] + (cx - pivot[0]) * tc : cx) - w / 2, y = cy - h / 2;
    const dx = cx - S.light[0], dy = cy - S.light[1], d = Math.hypot(dx, dy) || 1;
    const off = 1.5 + 11 * p.lift, ox = dx / d * off, oy = dy / d * off + 1.5;
    const g = p.gutter * S.scale * s;
    return {
      rect: [x, y, w, h], uv: p.uv, uvShadow: p.uvShadow, print: [p.px, p.py, p.pw, p.ph], scale: S.scale * s,
      shadowRect: [x - g + ox, y - g + oy, w + 2 * g, h + 2 * g],
      lift: p.lift, clarity: p.clarity, rot: p.rot, cut: whole ? 1 : ph === 'start' ? 0 : p.cut, glue: p.glue,
      // seam glint: a short flash when this piece just clicked in; on completion a wave of it runs across the picture
      flash: Math.max(p.flashAt ? Math.max(0, 1 - (now - p.flashAt) / 450) : 0,
        done ? (1 - Math.min(1, Math.abs(cx + (cy - pivot[1]) * 0.3 - sweepX) / 110)) * sweepAmt : 0),   // the passing light catches the seams as it crosses them
      squash: done && turning ? tsq : Math.max(0.04, Math.abs(Math.cos(Math.PI * p.flip))), back: done && turning ? tback : p.flip > 0.5,   // turning over: a card flip
      preview: 0,
      // on the board the cut pieces lie flush: no shadows and no visible cut faces until a piece actually leaves it
      shadow: !done && ph !== 'start' && ph !== 'pack' && (ph !== 'cut' || !!p.anim),
      rim: whole || (ph === 'cut' && !p.anim) ? 0 : 1,
    };
  });
  // while cutting, the sheet passes up behind the machine and out of its back: the rows already cut stay
  // visible above the pill and run on to the top of the page (user: the sheet must reach the page's top edge)
  const clipTop = 0;
  let sheetRect = null;
  if (ph === 'cut') {
    const m = S.plan.margin;
    sheetRect = [S.sheet.x - m, S.sheet.y - m, box[2] + 2 * m, box[3] + 2 * m];
  }
  S.lastScene = {
    w: S.w, h: S.h, dpr: S.dpr, light: S.light, tray: S.tray, time: t, matColor: MAT, trayColor: TRAY,
    finish: S.finish, frostAmt: S.finish === 1 ? 1 : 0.45, pivot, tilt: S.tilt,
    hold: ph === 'start' ? 0.12 : ph === 'cut' ? 0.12 * S.sheet.amt : S.hold,
    holdRect: ph === 'cut' ? [S.sheet.x, S.sheet.y, S.slab[2], S.slab[3]] : [pivot[0] - box[2] / 2 * tsq, box[1], box[2] * tsq, box[3]],   // the print's own shadow follows it through the machine
    sheet: ph === 'cut' ? sheetRect
         : ph === 'start' ? [box[0] - BOARD, box[1] - BOARD, box[2] + 2 * BOARD, box[3] + 2 * BOARD] : null,
    clipTop,
    sheetAmt: 0,   // no backing board any more: the print lies straight on the mat (the board only ever vanished after the cut)
    trayAmt: S.trayIn,
    // the whole print is drawn under the pieces until they start to leave the mat: it hides the hairline
    // anti-aliasing bleed where two uncut pieces meet, so no seams show before the blade has passed
    printSize: [S.baked.W, S.baked.H], letterAmt: S.writing ? 0 : 1,   // while you write, the words are the live text fields
    lines, reveal,
    // ONE light crossing the whole page when the puzzle is done (the same sweep the lamp makes): the mat gives a
    // faint band of it back, the puzzle a brighter one because its surface is smoother
    ripple: [sweepX, pivot[1], 240, sweepAmt],
    slab: ph === 'start' ? { rect: S.slab, print: [0, 0, S.baked.W, S.baked.H], scale: S.scale * S.hero * (S.slabHome ? S.slab[2] / S.slabHome[2] : 1), preview: whole ? 0 : S.previewAmt, squash: tsq, back: tback }
        : ph === 'cut' && now - S.cutStart < S.plan.tEject ? { rect: [S.sheet.x, S.sheet.y, S.slab[2], S.slab[3]], print: [0, 0, S.baked.W, S.baked.H], scale: S.scale * S.hero } : null,
    pieces,
  };
  R.draw(S.lastScene);
}
function tick(now) { frame(now); requestAnimationFrame(tick); }

unpack().then(() => { buildShelf(); fitViewport(); rebuild(); flashNumbers(); requestAnimationFrame(tick); });

// ---------- debug ----------
window.__S = S;
addEventListener('keydown', (e) => {   // "d" solves everything in place
  if (e.key !== 'd' || !S.baked || e.target.closest?.('input, textarea')) return;
  const [mx, my, mw, mh] = S.mat, sw = S.baked.W * S.scale, sh = S.baked.H * S.scale;
  for (const p of S.pieces) { p.g = 0; p.k = 1; p.phys = false; p.x = mx + (mw - sw) / 2 + p.hx; p.y = my + (mh - sh) / 2 + p.hy; p.cut = 1; p.rot = 0; p.lift = 0; p.lt = 0; }
  finish(performance.now());
});
window.__inspect = (x, y, w, h) => {
  frame(performance.now());
  const c = document.createElement('canvas'); c.width = 1200; c.height = Math.round(1200 * h / w);
  c.getContext('2d').drawImage(canvas, x * S.dpr, y * S.dpr, w * S.dpr, h * S.dpr, 0, 0, c.width, c.height);
  let ov = document.getElementById('__ov');
  if (!ov) { ov = document.createElement('img'); ov.id = '__ov'; ov.style.cssText = 'position:fixed;inset:0;margin:auto;max-width:100vw;max-height:100vh;z-index:99;background:#000'; document.body.appendChild(ov); }
  ov.src = c.toDataURL('image/png');
  return [c.width, c.height];
};
window.__uninspect = () => document.getElementById('__ov')?.remove();
