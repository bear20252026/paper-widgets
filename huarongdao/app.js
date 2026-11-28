'use strict';
const SITE_URL = 'huarongdao.yuxuanhou.com';
const API_URL = '';   // same-origin: /api/score works wherever this page is deployed
function deviceId(){
  let id = localStorage.getItem('pb_id');
  if (!id){ id = Math.random().toString(36).slice(2, 10); localStorage.setItem('pb_id', id); }
  return id;
}

/* Chinese numerals for the colophon: 23 → 二十三 */
function numCn(n){
  const D = '零一二三四五六七八九';
  if (n <= 0) return D[0];
  if (n < 10) return D[n];
  if (n < 20) return '十' + (n % 10 ? D[n % 10] : '');
  if (n < 100) return D[(n / 10) | 0] + '十' + (n % 10 ? D[n % 10] : '');
  const h = (n / 100) | 0, rest = n % 100;
  if (!rest) return D[h] + '百';
  if (rest < 10) return D[h] + '百零' + D[rest];
  if (rest < 20) return D[h] + '百一十' + (rest % 10 ? D[rest % 10] : '');
  return D[h] + '百' + numCn(rest);
}

/* ── difficulty levels (all solver-verified, klotski_solve.py) ── */
const LEVELS = {
  easy: { name:'EASY', min:15, layout:[
    ['cc',1,1],['h',4,0],['v',3,2],['v',1,0],['v',0,3],['s',3,0],['s',0,0]] },
  medium: { name:'MEDIUM', min:28, layout:[
    ['cc',0,1],['s',0,0],['v',1,0],['v',1,3],['h',2,1],['v',3,1],['v',3,3],['s',4,2]] },
  classic: { name:'CLASSIC', min:116, layout:[
    ['cc',0,1],['v',0,0],['v',0,3],['v',2,0],['h',2,1],['v',2,3],['s',3,1],['s',3,2],['s',4,0],['s',4,3]] },
};
let DIFF = localStorage.getItem('pbDiff') || 'medium';
if (!LEVELS[DIFF]) DIFF = 'medium';
document.querySelectorAll('#levels button').forEach(b => {
  if (b.dataset.l === DIFF) b.classList.add('on');
  b.addEventListener('click', () => { localStorage.setItem('pbDiff', b.dataset.l); location.reload(); });
});

const COLS = 4, ROWS = 5;
const SIZES = { cc:[2,2], h:[1,2], v:[2,1], s:[1,1] };
const LAYOUT = LEVELS[DIFF].layout;
const WOODPAL = [[200,171,132],[191,160,121],[209,181,143],[184,153,111],[203,174,135],[194,164,125],[214,187,150]];

/* ── canvas-baked wood: real streaky grain, chamfered edges, corner falloff ── */
function woodTex(w, h, opt){
  w = Math.max(4, w); h = Math.max(4, h);              // never let a collapsed viewport feed negatives in
  const dpr = Math.min(devicePixelRatio || 1, 2) * 1.5;
  const cv = document.createElement('canvas');
  cv.width = Math.max(2, Math.round(w*dpr)); cv.height = Math.max(2, Math.round(h*dpr));
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const [br, bgc, bb] = opt.base;
  const lin = g.createLinearGradient(0, 0, 0, h);        // gentle light from above
  lin.addColorStop(0, `rgb(${br+10},${bgc+9},${bb+7})`);
  lin.addColorStop(1, `rgb(${br-8},${bgc-8},${bb-7})`);
  g.fillStyle = lin; g.fillRect(0, 0, w, h);
  // grain: sparse, faint, wavering — solid wood seen from arm's length, not printed veneer
  const along = opt.along, L = along === 'y' ? h : w, Wd = along === 'y' ? w : h;
  const [dr, dg, db] = opt.dark, [lr, lg, lb] = opt.light;
  for (let i = 0, count = Math.max(3, Math.round(Wd / 6)); i < count; i++){
    const pos = (i + .5) / count * Wd + (Math.random()-.5)*4;
    const isLight = Math.random() < .3;
    g.strokeStyle = isLight ? `rgba(${lr},${lg},${lb},${.02+Math.random()*.03})`
                            : `rgba(${dr},${dg},${db},${.025+Math.random()*.04})`;
    g.lineWidth = .5 + Math.random()*.9;
    const wobA = .4 + Math.random()*1.1, wobF = .012 + Math.random()*.03, ph = Math.random()*7;
    g.beginPath();
    for (let s = 0; s <= L; s += 3){
      const off = pos + Math.sin(s*wobF + ph)*wobA;
      const x = along === 'y' ? off : s, y = along === 'y' ? s : off;
      s === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0, nn = w*h/60; i < nn; i++){             // the faintest tooth of the surface
    const a = Math.random()*.03;
    g.fillStyle = Math.random() < .5 ? `rgba(0,0,0,${a})` : `rgba(255,250,235,${a})`;
    g.fillRect(Math.random()*w, Math.random()*h, 1, 1);
  }
  if (opt.worn){                                          // finish rubbed thin in places
    for (let i = 0; i < 5; i++){
      const x = Math.random()*w, y = Math.random()*h, r = Math.min(w,h)*(.25+Math.random()*.3);
      const wg = g.createRadialGradient(x, y, 0, x, y, r);
      wg.addColorStop(0, 'rgba(255,244,228,.05)'); wg.addColorStop(1, 'rgba(255,244,228,0)');
      g.fillStyle = wg; g.fillRect(0, 0, w, h);
    }
  }
  const ch = opt.chamfer || 0;
  if (ch > 0){                                           // chamfered edges catch the light
    const edge = (x0,y0,x1,y1,c0,c1) => {
      const gr = g.createLinearGradient(x0,y0,x1,y1);
      gr.addColorStop(0, c0); gr.addColorStop(1, c1);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    };
    edge(0,0,0,ch,   'rgba(255,246,226,.18)', 'rgba(255,246,226,0)');
    edge(0,h,0,h-ch, 'rgba(26,17,8,.2)',      'rgba(26,17,8,0)');
    edge(0,0,ch,0,   'rgba(255,246,226,.09)', 'rgba(255,246,226,0)');
    edge(w,0,w-ch,0, 'rgba(26,17,8,.13)',     'rgba(26,17,8,0)');
    g.strokeStyle = 'rgba(48,32,15,.32)'; g.lineWidth = 1;
    g.strokeRect(.5, .5, w-1, h-1);                      // quiet arris
    g.strokeStyle = 'rgba(255,248,230,.1)';
    g.beginPath(); g.moveTo(1.5, 1.5); g.lineTo(w-1.5, 1.5); g.stroke();
  }
  const vg = g.createRadialGradient(w/2, h/2, Math.min(w,h)*.35, w/2, h/2, Math.max(w,h)*.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,12,5,.08)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
  if (opt.sheen){                                        // the merest satin of what lacquer remains
    const sg = g.createLinearGradient(0, 0, w, h);
    sg.addColorStop(.25, 'rgba(255,235,220,0)');
    sg.addColorStop(.45, 'rgba(255,235,220,.04)');
    sg.addColorStop(.6,  'rgba(255,235,220,0)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
  }
  return cv.toDataURL();
}

/* ── layout: deferred until the viewport reports real dimensions ──
   (an embedded pane can load hidden at 0×0 and fire no resize event) */
let W, H, CS, G, bx, by, RW;
const pieces = [];
const state = { t0:0, moves:0, done:false };

function layoutAndBuild(){
  W = innerWidth; H = innerHeight;
  CS = Math.min(H * 0.62 / ROWS, W * 0.42 / COLS, 96);
  G = Math.max(2, CS * 0.035);
  bx = (W - COLS*CS) / 2; by = (H - ROWS*CS) / 2 + 4;
  RW = Math.max(16, CS * .24);                        // wooden rail width — the beefy frame
  document.getElementById('tray').style.cssText +=
    `left:${bx-RW}px;top:${by-RW}px;width:${COLS*CS+2*RW}px;height:${ROWS*CS+2*RW}px`;
  document.getElementById('board').style.cssText +=
    `left:${bx}px;top:${by}px;width:${COLS*CS}px;height:${ROWS*CS}px`;
  document.getElementById('gateCut').style.cssText +=
    `left:${bx+CS+2}px;top:${by+ROWS*CS-2}px;width:${2*CS-4}px;height:${RW+2}px`;
  // clock sits left of the tray, reset right, both centred; levels tuck under the tray
  const midY = by + ROWS*CS/2;
  document.getElementById('clock').style.cssText +=
    `right:${W - (bx - RW) + 26}px;top:${midY - 10}px;left:auto;bottom:auto`;
  document.getElementById('reset').style.cssText +=
    `left:${bx + COLS*CS + RW + 26}px;top:${midY - 30}px;right:auto;bottom:auto`;
  document.getElementById('ranksBtn').style.cssText +=
    `left:${bx + COLS*CS + RW + 26}px;top:${midY + 2}px;right:auto;bottom:auto`;
  document.getElementById('levels').style.cssText +=
    `left:${W/2}px;top:${by + ROWS*CS + RW + 18}px;bottom:auto`;
  // bake real wood into the tray rails and the board floor
  const trayEl = document.getElementById('tray'), boardEl = document.getElementById('board');
  trayEl.style.background = `url(${woodTex(COLS*CS+2*RW, ROWS*CS+2*RW,
    { base:[121,89,56], dark:[58,38,20], light:[206,172,130], along:'y', chamfer: Math.max(5, RW*.45) })})`;
  trayEl.style.backgroundSize = '100% 100%';
  boardEl.style.background = `url(${woodTex(COLS*CS, ROWS*CS,
    { base:[138,104,66], dark:[76,52,28], light:[214,184,144], along:'x', chamfer: 0 })})`;
  boardEl.style.backgroundSize = '100% 100%';
  // pieces
  let wood = 0;
  LAYOUT.forEach(([t, r, c], i) => {
    const [hr, wc] = SIZES[t];
    const el = document.createElement('div');
    el.className = 'blk';
    el.style.width  = (wc*CS - 2*G) + 'px';
    el.style.height = (hr*CS - 2*G) + 'px';
    const bw = wc*CS - 2*G, bh = hr*CS - 2*G;
    el.style.backgroundImage = `url(${woodTex(bw, bh, t === 'cc'
      ? { base:[141,60,42], dark:[98,38,24], light:[212,138,112],
          along: 'x', chamfer: Math.max(4, CS*.08), sheen: true, worn: true }
      : { base: WOODPAL[wood++ % WOODPAL.length], dark:[96,66,36], light:[255,244,222],
          along: hr > wc ? 'y' : 'x', chamfer: Math.max(4, CS*.08) })})`;
    document.body.appendChild(el);
    const p = { i, t, hr, wc, r, c, el, traj: [] };
    place(p);
    attach(p);
    pieces.push(p);
  });
  // shape changes: panes don't fire resize reliably, so poll and re-lay-out
  setInterval(() => {
    if (Math.abs(innerWidth - W) > 4 || Math.abs(innerHeight - H) > 4) location.reload();
  }, 600);
}
(function bootWhenSized(){
  if (innerWidth > 80 && innerHeight > 80) layoutAndBuild();
  else setTimeout(bootWhenSized, 120);
})();
function place(p){
  p.el.style.transform = `translate(${bx + p.c*CS + G}px, ${by + p.r*CS + G}px)`;
}

/* ── collision & movement ── */
const EPS = 1e-4;
function collides(p, r, c){
  if (c < -EPS || c + p.wc > COLS + EPS) return true;
  if (r < -EPS) return true;
  if (r + p.hr > ROWS + EPS){
    if (!(p.t === 'cc' && Math.abs(c - 1) < .05)) return true;
  }
  for (const q of pieces){
    if (q === p) continue;
    if (r < q.r + q.hr - EPS && r + p.hr > q.r + EPS &&
        c < q.c + q.wc - EPS && c + p.wc > q.c + EPS) return true;
  }
  return false;
}
function resolveMove(p, tr, tc){
  const STEP = .05;
  for (let n = 0; n < 400; n++){
    const dr = tr - p.r, dc = tc - p.c;
    if (Math.abs(dr) < STEP && Math.abs(dc) < STEP) break;
    const tryAxes = Math.abs(dr) > Math.abs(dc) ? ['r','c'] : ['c','r'];
    let advanced = false;
    for (const ax of tryAxes){
      const d = ax === 'r' ? dr : dc;
      if (Math.abs(d) < STEP) continue;
      const s = Math.sign(d) * STEP;
      const nr = ax === 'r' ? p.r + s : p.r;
      const nc = ax === 'c' ? p.c + s : p.c;
      if (!collides(p, nr, nc)){ p.r = nr; p.c = nc; advanced = true; break; }
    }
    if (!advanced) break;
  }
}

/* ── clock ── */
const fmt = ms => { const s = Math.round(ms/1000); return `${Math.floor(s/60)}'${String(s%60).padStart(2,'0')}"`; };
const clockEl = document.getElementById('clock');
let clockTimer = null;
function tickClock(){ if (!state.done) clockEl.textContent = `${fmt(performance.now()-state.t0)} · ${state.moves} moves`; }
function startClock(){ if (!state.t0){ state.t0 = performance.now(); clockTimer = setInterval(tickClock, 500); } }

/* ── drag ── */
function attach(p){
  p.el.addEventListener('pointerdown', e => {
    if (state.done) return;
    e.preventDefault();
    audio.init(); audio.tick();
    p.el.setPointerCapture(e.pointerId);
    p.el.classList.add('drag'); p.el.classList.remove('settle');
    const r0 = p.r, c0 = p.c;
    const gr = Math.round(r0), gc = Math.round(c0);
    const px0 = e.clientX, py0 = e.clientY;
    let lastSample = [p.c, p.r];
    const move = ev => {
      resolveMove(p, r0 + (ev.clientY - py0) / CS, c0 + (ev.clientX - px0) / CS);
      place(p);
      if (Math.hypot(p.c - lastSample[0], p.r - lastSample[1]) > .12){
        lastSample = [p.c, p.r];
        startClock();
        p.traj.push([p.c + p.wc/2, p.r + p.hr/2, performance.now() - state.t0]);
      }
      if (p.t === 'cc' && p.r > 3.55) win(p, move, up);
    };
    const up = ev => {
      p.el.removeEventListener('pointermove', move);
      p.el.removeEventListener('pointerup', up);
      p.el.removeEventListener('pointercancel', up);
      p.el.classList.remove('drag');
      const cand = [];
      for (const rr of [Math.round(p.r), Math.floor(p.r), Math.ceil(p.r)])
        for (const cc of [Math.round(p.c), Math.floor(p.c), Math.ceil(p.c)])
          if (!collides(p, rr, cc)) cand.push([rr, cc, Math.hypot(rr-p.r, cc-p.c)]);
      cand.sort((a,b) => a[2] - b[2]);
      if (cand.length){ p.r = cand[0][0]; p.c = cand[0][1]; }
      p.el.classList.add('settle');
      place(p);
      if (p.r !== gr || p.c !== gc){
        state.moves++;
        startClock(); tickClock();
        p.traj.push([p.c + p.wc/2, p.r + p.hr/2, performance.now() - state.t0]);
        audio.thock();
      }
    };
    p.el.addEventListener('pointermove', move);
    p.el.addEventListener('pointerup', up);
    p.el.addEventListener('pointercancel', up);
  });
}

/* ── rank: who else has walked this road (Abacus counters, graceful fallback) ── */
const BUCKETS = [45,60,75,90,110,130,155,185,220,260,310,370,440,530,640,780,960,1200,1e9];
async function fetchRank(sec){
  const ns = 'yx-puzzle-blanket', pre = 'klotski-' + DIFF;
  const url = k => `https://abacus.jasoncameron.dev/${k}`;
  const bi = BUCKETS.findIndex(b => sec < b);
  try{
    const tot = await fetch(url(`hit/${ns}/${pre}-total`)).then(r => r.json());
    await fetch(url(`hit/${ns}/${pre}-b${bi}`));
    localStorage.setItem('pb_bucket_' + DIFF, bi);      // remember which row is yours
    const faster = await Promise.all(
      BUCKETS.slice(0, bi).map((_, i) =>
        fetch(url(`get/${ns}/${pre}-b${i}`)).then(r => r.ok ? r.json() : {value:0}).catch(() => ({value:0}))));
    const rank = faster.reduce((s, v) => s + (v.value || 0), 0) + 1;
    return { rank, total: Math.max(tot.value || 1, rank) };
  }catch(e){ return null; }
}
const raceRank = sec => Promise.race([fetchRank(sec), new Promise(res => setTimeout(() => res(null), 2800))]);

/* ── win → ink painting ── */
let artCanvas = null;
async function fetchBoard(diff = DIFF){
  try{
    const opts = AbortSignal.timeout ? { signal: AbortSignal.timeout(2500) } : {};
    const resp = await fetch(`${API_URL}/api/score?diff=${diff}`, opts);
    if (resp.ok) return { entries: (await resp.json()).board || [], global: true };
  }catch(e){}
  let runs = [];
  try{ runs = JSON.parse(localStorage.getItem('pb_runs_' + diff) || '[]'); }catch(e){}
  runs.sort((a, b) => a.s - b.s || a.ms - b.ms);
  return { entries: runs.slice(0, 10), global: false };
}
async function win(p, move, up){
  if (state.done) return;
  state.done = true;
  clearInterval(clockTimer);
  state.endMs = performance.now() - state.t0;
  p.el.removeEventListener('pointermove', move);
  p.el.removeEventListener('pointerup', up);
  p.traj.push([p.c + p.wc/2, p.r + p.hr/2, state.endMs]);
  const submitted = saveRun();          // runs during the exit animation
  p.el.classList.add('exit');
  p.el.style.transform = `translate(${bx + 1*CS + G}px, ${by + 6.4*CS + G}px)`;
  audio.out();
  setTimeout(() => audio.win(), 500);
  const rk = state.fakeRank || await raceRank(state.endMs / 1000);
  const board = (await submitted) || await fetchBoard();
  state.routeCv = renderInk(rk, board, 'route');
  state.rankCv  = renderInk(rk, board, 'rank');
  artCanvas = state.routeCv;
  setTimeout(() => {
    document.getElementById('artimg').src = artCanvas.toDataURL('image/png');
    document.getElementById('sealLink').href = 'https://' + SITE_URL;
    document.getElementById('veil').classList.remove('board');
    document.getElementById('veil').classList.add('show');
  }, 400);
}
function seedNo(){
  let h = 0;
  pieces.forEach(p => p.traj.forEach(([x,y]) => { h = (h*31 + ((x*97 + y*131)|0)) % 999983; }));
  return String(Math.abs(h) % 10000).padStart(4,'0');
}

/* ═══════════ ink painting on xuan paper ═══════════ */
const vsub = (a,b) => [a[0]-b[0], a[1]-b[1]];
const vadd = (a,b) => [a[0]+b[0], a[1]+b[1]];
const vmul = (a,k) => [a[0]*k, a[1]*k];
const vlen = a => Math.hypot(a[0], a[1]);
const vnorm = a => { const l = vlen(a) || 1; return [a[0]/l, a[1]/l]; };

function simplify(pts){
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++){
    const a = out[out.length-1], b = pts[i], c = pts[i+1];
    const cross = (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
    if (Math.abs(cross) > .004) out.push(pts[i]);
  }
  out.push(pts[pts.length-1]);
  return out;
}
function roundCorners(pts, rad){
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++){
    const p = pts[i], a = pts[i-1], b = pts[i+1];
    const la = Math.min(rad, vlen(vsub(p,a)) * .5);
    const lb = Math.min(rad, vlen(vsub(b,p)) * .5);
    const p1 = vadd(p, vmul(vnorm(vsub(a,p)), la));
    const p2 = vadd(p, vmul(vnorm(vsub(b,p)), lb));
    out.push(p1);
    for (let t = .25; t < 1; t += .25){
      const q1 = vadd(vmul(p1, 1-t), vmul(p, t));
      const q2 = vadd(vmul(p, 1-t), vmul(p2, t));
      out.push(vadd(vmul(q1, 1-t), vmul(q2, t)));
    }
    out.push(p2);
  }
  out.push(pts[pts.length-1]);
  return out;
}
function resample(pts, step){
  const out = [pts[0].slice()];
  let prev = pts[0], need = step;
  for (let i = 1; i < pts.length; i++){
    let cur = pts[i];
    let seg = vlen(vsub(cur, prev));
    while (seg >= need){
      const t = need / seg;
      prev = vadd(prev, vmul(vsub(cur, prev), t));
      out.push(prev.slice());
      seg = vlen(vsub(cur, prev));
      need = step;
    }
    need -= seg;
    prev = cur;
  }
  out.push(pts[pts.length-1].slice());
  return out;
}
/* one brush stroke: bleed halo → wet body → dark core, with wobble,
   entry/exit taper and dry-brush gaps (feibai) */
/* ═══ N pipeline: relaxed curve · width from REAL speed · one ribbon of ink ═══ */
function resampleT(pts, step){                 // [[x,y,tMs]] → even spacing, time interpolated
  const out = [pts[0].slice()];
  let prev = pts[0].slice(), need = step;
  for (let i = 1; i < pts.length; i++){
    let cur = pts[i];
    let seg = Math.hypot(cur[0]-prev[0], cur[1]-prev[1]);
    while (seg >= need){
      const k = need / seg;
      prev = [prev[0]+(cur[0]-prev[0])*k, prev[1]+(cur[1]-prev[1])*k, prev[2]+(cur[2]-prev[2])*k];
      out.push(prev.slice());
      seg = Math.hypot(cur[0]-prev[0], cur[1]-prev[1]);
      need = step;
    }
    need -= seg;
    prev = cur.slice();
  }
  out.push(pts[pts.length-1].slice());
  return out;
}
function smoothT(pts, passes){                 // heavy relaxation: right angles become swings
  let a = pts;
  for (let p = 0; p < passes; p++){
    const b = [a[0]];
    for (let i = 1; i < a.length - 1; i++)
      b.push([(a[i-1][0]+2*a[i][0]+a[i+1][0])/4, (a[i-1][1]+2*a[i][1]+a[i+1][1])/4, a[i][2]]);
    b.push(a[a.length-1]);
    a = b;
  }
  return a;
}
function inkRoad(g, traj, wBase, rgb, tone, red){
  if (traj.length < 2) return;
  let P = resampleT(traj, 6);
  if (P.length < 3) return;
  P = smoothT(P, 40);
  // real speed per point; a pause between drags reads as a wide wet 顿
  const V = [0];
  for (let i = 1; i < P.length; i++){
    const d = Math.hypot(P[i][0]-P[i-1][0], P[i][1]-P[i-1][1]);
    const dt = Math.max(1, P[i][2]-P[i-1][2]);
    V.push(d/dt);
  }
  V[0] = V[1] || 0;
  const srt = [...V].filter(v => v > 0).sort((a,b) => a-b);
  const v80 = srt[Math.floor(srt.length*.8)] || 1;
  const S = V.map(v => Math.min(v/v80, 1));
  const widths = S.map(s => Math.max(.8, wBase*(1.65 - 1.0*s)));
  // silky ends: slip in thin, leave with a tapering 出锋 — never a blob
  const nP = P.length;
  for (let i = 0; i < nP; i++){
    const t = i / (nP - 1);
    const entry = Math.min(1, .18 + Math.pow(t / .05, .65));
    const exit  = t > .94 ? Math.max(.12, Math.pow((1 - t) / .06, .6)) : 1;
    widths[i] *= entry * exit;
  }
  if (red){
    // the red road keeps its segment ink — 浓淡 breathing reads well at full tone
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 1; i < P.length; i++){
      g.strokeStyle = `rgba(${rgb},${(.6 + .28*(1-S[i])) * tone})`;
      g.lineWidth = widths[i];
      g.beginPath(); g.moveTo(P[i-1][0], P[i-1][1]); g.lineTo(P[i][0], P[i][1]); g.stroke();
    }
  } else {
    // pale greys: ONE filled ribbon, one pass of ink — no seams, no beading
    const Ls = [], Rs = [];
    for (let i = 0; i < P.length; i++){
      const a = P[Math.max(0, i-1)], b = P[Math.min(P.length-1, i+1)];
      const dl = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1;
      const nx = -(b[1]-a[1])/dl, ny = (b[0]-a[0])/dl;
      const hw = widths[i]/2;
      Ls.push([P[i][0] + nx*hw, P[i][1] + ny*hw]);
      Rs.push([P[i][0] - nx*hw, P[i][1] - ny*hw]);
    }
    g.fillStyle = `rgba(${rgb},${.74 * tone})`;
    g.beginPath();
    g.moveTo(Ls[0][0], Ls[0][1]);
    for (let i = 1; i < Ls.length; i++) g.lineTo(Ls[i][0], Ls[i][1]);
    for (let i = Rs.length - 1; i >= 0; i--) g.lineTo(Rs[i][0], Rs[i][1]);
    g.closePath(); g.fill();
    g.beginPath(); g.arc(P[0][0], P[0][1], widths[0]/2, 0, 7); g.fill();
    g.beginPath(); g.arc(P[P.length-1][0], P[P.length-1][1], widths[widths.length-1]/2, 0, 7); g.fill();
  }
}

/* a seal whose text is the step count; vertical column, or two columns
   read right-to-left when the number grows long */
function drawSeal(g, x, y, s, text){
  g.fillStyle = 'rgba(158,54,34,.92)';
  g.beginPath(); g.roundRect(x, y, s, s, 8); g.fill();
  g.fillStyle = 'rgba(241,234,217,.5)';               // worn edges
  for (let i = 0; i < 30; i++){
    if (Math.random() < .35)
      g.fillRect(x + Math.random()*s, y + Math.random()*s, 2.6, 2.6);
  }
  const chars = [...text];
  const pad = s * .12;
  let cols;
  if (chars.length <= 3) cols = [chars];
  else { const half = Math.ceil(chars.length / 2); cols = [chars.slice(0, half), chars.slice(half)]; }
  const cw = (s - 2*pad) / cols.length;
  g.fillStyle = '#f1ead9'; g.textAlign = 'center'; g.textBaseline = 'middle';
  cols.forEach((col, ci) => {
    const cx = x + s - pad - cw * (ci + .5);          // first column on the right
    const ch = (s - 2*pad) / col.length;
    const fs = Math.min(cw * .95, ch * .88);
    g.font = `${fs}px "Xingkai SC","Baoli SC","Kaiti SC",serif`;
    col.forEach((c, ri) => g.fillText(c, cx, y + pad + ch * (ri + .5) + 1));
  });
  g.textBaseline = 'alphabetic';
}

function paperMini(g, rr, x, y, w, h){
  const s2 = Math.min((w - 10)/COLS, (h - 10)/(ROWS + .6));
  const ox2 = x + (w - COLS*s2)/2, oy2 = y + 4;
  const draw = (v, w2, col) => {
    if (!v || v.length < 2) return;
    g.strokeStyle = col; g.lineWidth = w2; g.lineCap = g.lineJoin = 'round';
    g.beginPath(); g.moveTo(ox2 + v[0][0]*s2, oy2 + v[0][1]*s2);
    for (let k = 1; k < v.length; k++) g.lineTo(ox2 + v[k][0]*s2, oy2 + v[k][1]*s2);
    g.stroke();
  };
  (rr || []).forEach(pc => { if (pc.t !== 'cc') draw(pc.v, Math.max(1, s2*.09), 'rgba(58,55,49,.32)'); });
  const cc2 = (rr || []).find(pc => pc.t === 'cc');
  if (cc2) draw(cc2.v, Math.max(1.6, s2*.16), 'rgba(158,54,34,.85)');
}

function renderInk(rk, board, mode, diffKey){
  const Wp = 1080, Hp = 1350;
  const cv = document.createElement('canvas');
  cv.width = Wp; cv.height = Hp;
  const g = cv.getContext('2d');

  /* xuan paper */
  g.fillStyle = 'rgba(241,234,217,.93)'; g.fillRect(0, 0, Wp, Hp);   // xuan paper is faintly translucent
  for (let i = 0; i < 7; i++){                        // mottled sizing, barely there
    const x = Math.random()*Wp, y = Math.random()*Hp, r = 320 + Math.random()*420;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    const warm = Math.random() < .5;
    rg.addColorStop(0, warm ? 'rgba(226,214,186,.06)' : 'rgba(250,246,236,.07)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, Wp, Hp);
  }
  g.strokeStyle = 'rgba(190,176,148,.25)';            // stray fibers
  g.lineWidth = .7;
  for (let i = 0; i < 130; i++){
    const x = Math.random()*Wp, y = Math.random()*Hp, a = Math.random()*7, l = 4 + Math.random()*10;
    g.globalAlpha = .12 + Math.random()*.15;
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + Math.cos(a)*l, y + Math.sin(a)*l); g.stroke();
  }
  g.globalAlpha = 1;

  /* the road, smaller and centred in the space above the colophon */
  const sc = 148;
  const ox = (Wp - COLS*sc) / 2, oy = 212;
  const INK = '58,55,49', CINN = '138,52,36';         // grey-leaning ink · aged cinnabar

  if (mode !== 'rank'){
  /* strokes → their own layer; the ink filter then acts on them as one */
  const layer = document.createElement('canvas');
  layer.width = Wp; layer.height = Hp;
  const lg = layer.getContext('2d');
  const sorted = [...pieces].sort((a, b) => (a.t === 'cc') - (b.t === 'cc'));
  sorted.forEach(p => {
    if (p.traj.length < 2) return;
    const traj = p.traj.map(([x, y, t]) => [ox + x*sc, oy + y*sc, t || 0]);
    const red = p.t === 'cc';
    const w    = red ? sc*.075 : p.t === 's' ? sc*.034 : sc*.05;
    const tone = red ? 1 : p.t === 's' ? .36 : .52;
    inkRoad(lg, traj, w, red ? CINN : INK, tone, red);
  });
  g.save();
  g.filter = 'url(#inkflow)';
  g.drawImage(layer, 0, 0);
  g.restore();
  } else {
    /* ranking mode: the centre of the sheet belongs to the ten */
    const entries = (board && board.entries) || [];
    const isGlobal = board && board.global;
    const rowH = 86, numX = 128, listY = 196, rightX = 984;   // colophon margin → seal's right edge
    for (let i = 0; i < 10; i++){
      const y = listY + i*rowH;
      const e = entries[i];
      const me = e && (isGlobal ? e.id === deviceId() : e.at === state.lastRunAt);
      if (me){                                    // a quiet wash of cinnabar under your row
        g.fillStyle = 'rgba(158,54,34,.07)';
        g.beginPath(); g.roundRect(82, y - 4, rightX - 82 + 6, rowH - 4, 8); g.fill();
      }
      g.font = '26px "Didot", "Times New Roman", serif';
      g.textAlign = 'right';
      g.fillStyle = e ? (me ? 'rgba(158,54,34,.85)' : 'rgba(94,84,66,.6)') : 'rgba(94,84,66,.15)';
      g.fillText(String(i + 1), numX, y + 42);
      if (!e){
        g.textAlign = 'left';
        g.fillStyle = 'rgba(94,84,66,.12)';
        g.fillText('—', numX + 28, y + 42);
        continue;
      }
      paperMini(g, e.r, numX + 26, y + 4, 52, 66);
      g.textAlign = 'left';
      g.font = '22px "Didot", "Times New Roman", serif';
      g.fillStyle = me ? 'rgba(158,54,34,.9)' : 'rgba(94,84,66,.72)';
      g.fillText(`${e.s} STEPS`, numX + 96, y + 45);
      g.textAlign = 'right';
      g.font = '17px "Didot", "Times New Roman", serif';
      g.fillStyle = me ? 'rgba(158,54,34,.55)' : 'rgba(94,84,66,.45)';
      g.fillText(fmt(e.ms), rightX, y + 45);
      g.textAlign = 'left';
    }
    g.textAlign = 'left';
  }


  /* colophon — step count in English as the headline, game name lives in the seal;
     the text block is pinned to the seal: cap-top on its top edge, baseline on its bottom */
  const sealS = 100, sealX = Wp - 96 - sealS, sealY = 1174;
  g.textAlign = 'left';
  g.fillStyle = 'rgba(60,52,42,.9)';
  g.font = '54px "Didot", "Times New Roman", serif';   // lining figures — digits sit level with the caps
  try{ g.letterSpacing = '4px'; }catch(e){}
  // opened from the board button there is no run yet — the sheet titles itself
  const title = state.done ? `${state.moves} STEPS` : 'RANKING';
  const tAsc = g.measureText(title).actualBoundingBoxAscent || 38;
  g.fillText(title, 94, sealY + tAsc);
  const secLine = state.done
    ? `${LEVELS[DIFF].name} · ${fmt(state.endMs)}` + (rk ? ` · NO.${rk.rank}/${rk.total}` : '')
    : `${LEVELS[diffKey || DIFF].name} · TOP TEN`;
  g.fillStyle = 'rgba(94,84,66,.62)';
  g.font = '23px "Didot", "Times New Roman", serif';
  try{ g.letterSpacing = '5px'; }catch(e){}
  const sDesc = g.measureText(secLine).actualBoundingBoxDescent || 0;
  g.fillText(secLine, 96, sealY + sealS - sDesc);
  try{ g.letterSpacing = '0px'; }catch(e){}

  /* seal — carries the game's name, links back to the game */
  drawSeal(g, sealX, sealY, sealS, '華容道');

  /* paper grain over everything */
  const n = document.createElement('canvas'); n.width = n.height = 140;
  const ng = n.getContext('2d'); const im = ng.createImageData(140, 140);
  for (let i = 0; i < im.data.length; i += 4){
    const v = 118 + Math.random()*60 | 0;
    im.data[i] = im.data[i+1] = im.data[i+2] = v; im.data[i+3] = 255;
  }
  ng.putImageData(im, 0, 0);
  g.globalAlpha = .045; g.globalCompositeOperation = 'overlay';
  for (let x = 0; x < Wp; x += 140) for (let y = 0; y < Hp; y += 140) g.drawImage(n, x, y);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  return cv;
}

/* ── buttons ── */
document.getElementById('dl').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = `klotski-ink-${seedNo()}.png`;
  a.href = artCanvas.toDataURL('image/png');
  a.click();
});
document.getElementById('modeBtn').addEventListener('click', () => {
  audio.init(); audio.tick();
  const btn = document.getElementById('modeBtn');
  if (artCanvas === state.rankCv){ artCanvas = state.routeCv; btn.textContent = 'RANKING'; }
  else { artCanvas = state.rankCv; btn.textContent = 'YOUR ROUTE'; }
  document.getElementById('artimg').src = artCanvas.toDataURL('image/png');
});
document.getElementById('again').addEventListener('click', () => location.reload());
// clicking the dark felt around the sheet: closes the board, restarts after a solve
document.getElementById('veil').addEventListener('click', e => {
  const veil = document.getElementById('veil');
  if (e.target !== veil) return;
  if (veil.classList.contains('board')) veil.classList.remove('show', 'board');
  else location.reload();
});
document.getElementById('reset').addEventListener('click', () => location.reload());

/* ── tiny sounds ── */
const audio = {
  ctx: null,
  init(){ if (!this.ctx) try{ this.ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} },
  env(f0, f1, dur, type, vol){
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(gn).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + .02);
  },
  tick(){ this.env(1500, 1500, .04, 'triangle', .05); },
  thock(){ this.env(200, 110, .08, 'sine', .16); },
  out(){ this.env(350, 900, .25, 'sine', .08); },
  heart(){ this.env(660, 660, .12, 'sine', .07); setTimeout(() => this.env(880, 880, .16, 'sine', .06), 90); },
  win(){ [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.env(f, f, .4, 'sine', .09), i * 120)); },
};

twtEl.addEventListener('mouseenter', () => { audio.init(); audio.tick(); });

/* ── footer heart: hollow → hover beat → filled once per browser; counts silently, backend only ── */
{
  const heartEl = document.getElementById('heart');
  const HURL = 'https://abacus.jasoncameron.dev', HKEY = 'yx-puzzle-blanket/hearts';
  let hearted = localStorage.getItem('pb_hearted') === '1';
  if (hearted) heartEl.textContent = '♥';
  heartEl.addEventListener('click', () => {
    audio.init(); audio.heart();
    heartEl.classList.remove('beat'); void heartEl.offsetWidth; heartEl.classList.add('beat');
    if (hearted) return;                       // liking is forever; never decrements
    hearted = true; localStorage.setItem('pb_hearted', '1');
    heartEl.textContent = '♥';
    fetch(`${HURL}/hit/${HKEY}`).catch(() => {});
  });
}

/* ── the ranking: a vertical board; every entry's logo is its own route ── */
/* Saves locally, then submits. Resolves with the board the server sends back —
   asking for the board separately would race this write and could leave the
   player's own fresh run off their own sheet. */
async function saveRun(){
  let rec;
  try{
    const key = 'pb_runs_' + DIFF;
    const runs = JSON.parse(localStorage.getItem(key) || '[]');
    rec = {
      s: state.moves, ms: Math.round(state.endMs), at: Date.now(),
      r: pieces.map(p => ({ t: p.t, v: simplify(p.traj).map(q => [ +q[0].toFixed(2), +q[1].toFixed(2) ]) })),
    };
    state.lastRunAt = rec.at;
    runs.push(rec);
    runs.sort((a, b) => a.s - b.s || a.ms - b.ms);
    localStorage.setItem(key, JSON.stringify(runs.slice(0, 50)));
  }catch(e){ return null; }
  try{
    const opts = AbortSignal.timeout ? { signal: AbortSignal.timeout(2500) } : {};
    const resp = await fetch(API_URL + '/api/score', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ diff: DIFF, s: rec.s, ms: rec.ms, r: rec.r, id: deviceId() }),
      ...opts,
    });
    if (resp.ok){
      const j = await resp.json();
      markSent(DIFF, rec.at);
      if (j.board) return { entries: j.board, global: true };
    }
  }catch(e){}
  return null;
}

/* A run is stored the moment it happens, but the board may have been
   unreachable then — offline, or simply not built yet. Each record remembers
   whether it made it up, and anything still waiting is carried up on the next
   visit that can reach the board. */
function markSent(diff, at){
  try{
    const key = 'pb_runs_' + diff;
    const runs = JSON.parse(localStorage.getItem(key) || '[]');
    const hit = runs.find(r => r.at === at);
    if (hit){ hit.up = 1; localStorage.setItem(key, JSON.stringify(runs)); }
  }catch(e){}
}
async function liftPendingRuns(){
  for (const diff of Object.keys(LEVELS)){
    let runs = [];
    try{ runs = JSON.parse(localStorage.getItem('pb_runs_' + diff) || '[]'); }catch(e){ continue; }
    if (!runs.length) continue;
    runs.sort((a, b) => a.s - b.s || a.ms - b.ms);
    // only a player's ten best could ever hold a place; the rest are marked
    // done so they stop asking
    let dirty = false;
    for (let i = 0; i < runs.length; i++){
      const r = runs[i];
      if (r.up) continue;
      if (i >= 10){ r.up = 1; dirty = true; continue; }
      try{
        const opts = AbortSignal.timeout ? { signal: AbortSignal.timeout(4000) } : {};
        const resp = await fetch(API_URL + '/api/score', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ diff, s: r.s, ms: r.ms, r: r.r, id: deviceId() }),
          ...opts,
        });
        if (resp.ok || resp.status === 400){   // 400 = the board won't take it; stop retrying
          r.up = 1; dirty = true;
        } else break;                          // server trouble — leave the rest for next time
      }catch(e){ break; }                      // unreachable — try again on the next visit
    }
    if (dirty){
      try{ localStorage.setItem('pb_runs_' + diff, JSON.stringify(runs)); }catch(e){}
    }
  }
}
setTimeout(liftPendingRuns, 1200);             // quietly, after the board has settled
/* the board button paints the very same sheet — one look for the ranking,
   whether you arrive at it by finishing or by asking */
async function showBoard(diff){
  const veil = document.getElementById('veil');
  document.querySelectorAll('#boardLevels button').forEach(b =>
    b.classList.toggle('on', b.dataset.bl === diff));
  veil.classList.add('board', 'show');
  const board = await fetchBoard(diff);
  document.getElementById('artimg').src =
    renderInk(null, board, 'rank', diff).toDataURL('image/png');
  document.getElementById('sealLink').href = 'https://' + SITE_URL;
}
document.getElementById('ranksBtn').addEventListener('click', () => {
  audio.init(); audio.tick();
  showBoard(DIFF);                       // opens on the level you are playing
});
// browsing the other levels here never changes the game waiting behind the sheet
document.querySelectorAll('#boardLevels button').forEach(b =>
  b.addEventListener('click', () => { audio.init(); audio.tick(); showBoard(b.dataset.bl); }));
document.getElementById('closeBoard').addEventListener('click', () => {
  document.getElementById('veil').classList.remove('show', 'board');
});

/* ── debug: fabricate an orthogonal solve for visual checks ── */
window.__auto = (ms = 95000, fakeRank = {rank: 3, total: 117}) => {
  state.t0 = performance.now() - ms;
  state.fakeRank = fakeRank;
  const rnd = (a, b) => a + Math.random() * (b - a);
  pieces.forEach(p => {
    let r = p.r, c = p.c, t = rnd(0, ms * .3);
    p.traj = [[c + p.wc/2, r + p.hr/2, t]];
    const steps = 2 + (Math.random() * 5 | 0);
    for (let i = 0; i < steps; i++){
      if (Math.random() < .5) r = Math.max(0, Math.min(ROWS - p.hr, r + (Math.random() < .5 ? -1 : 1)));
      else c = Math.max(0, Math.min(COLS - p.wc, c + (Math.random() < .5 ? -1 : 1)));
      t += rnd(200, ms * .1);
      p.traj.push([c + p.wc/2, r + p.hr/2, t]);
    }
    state.moves += steps;
  });
  const cc = pieces.find(p => p.t === 'cc');
  const [lx] = cc.traj[cc.traj.length-1];
  cc.traj.push([2, cc.traj[cc.traj.length-1][1], ms*.9]);   // orthogonal: over, then down
  cc.traj.push([2, 5.4, ms]);
  cc.r = 3.6; cc.c = 1;
  win(cc, () => {}, () => {});
};
