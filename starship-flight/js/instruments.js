// Live instruments, Canvas 2D, ink on paper.
import { prop, MODEL, PUBLISHED } from './sim.js';

const INK = '#171717', OR = '#E05A1E', CY = '#3FA8C9', PAPER = '#E8E4DA', FAINT = 'rgba(23,23,23,0.18)';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function fit(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, w: r.width, h: r.height };
}
function txt(c, s, x, y, { size = 9, color = INK, align = 'left', weight = 400, base = 'alphabetic' } = {}) {
  c.font = `${weight} ${size}px ${MONO}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y);
}
const fmt = (v, d = 0) => (v == null || !isFinite(v)) ? '----' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export function drawThrust(cv, sim) {
  const { c, w, h } = fit(cv); c.clearRect(0, 0, w, h);
  const s = sim.state, b = s.booster, sh = s.ship;
  const est = sim.estimates();
  const top = 14, bot = h - 26, H = bot - top;
  const tfFull = MODEL.raptorSL_tf;
  // grid
  c.strokeStyle = FAINT; c.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) { const y = top + H * i / 4; c.beginPath(); c.moveTo(2, y); c.lineTo(w - 2, y); c.stroke(); }
  const bw = (w - 14) * 0.78, sw = (w - 14) - bw;
  const groups = [
    { list: b.engines.slice(0, 13), x0: 4, wid: bw * 13 / 33, label: 'S1 CTR 13' },
    { list: b.engines.slice(13), x0: 4 + bw * 13 / 33 + 2, wid: bw * 20 / 33 - 2, label: 'S1 OUTER 20' },
    { list: sh.engines.slice(0, 3), x0: 10 + bw, wid: sw * 0.45, label: 'SL' },
    { list: sh.engines.slice(3), x0: 10 + bw + sw * 0.5, wid: sw * 0.5, label: 'RVAC' },
  ];
  for (const g of groups) {
    const n = g.list.length, bwid = g.wid / n;
    g.list.forEach((e, i) => {
      const x = g.x0 + i * bwid;
      const a = Math.min(1, e.act), cmd = Math.min(1, e.cmd);
      c.fillStyle = a > 0.01 ? (g.label.startsWith('S1') ? OR : CY) : 'transparent';
      c.fillRect(x + 0.6, bot - H * a, Math.max(1, bwid - 1.2), H * a);
      if (cmd > 0) { c.fillStyle = INK; c.fillRect(x + 0.3, bot - H * cmd - 0.5, Math.max(1, bwid - 0.6), 1); }
      c.strokeStyle = 'rgba(23,23,23,0.35)'; c.lineWidth = 0.5; c.strokeRect(x + 0.6, top, Math.max(1, bwid - 1.2), H);
    });
    txt(c, g.label, g.x0, bot + 9, { size: 7.5, color: 'rgba(23,23,23,0.7)' });
  }
  txt(c, '100%', w - 3, top - 4, { size: 7.5, align: 'right', color: 'rgba(23,23,23,0.6)' });
  const tfB = b.thrust / (1000 * MODEL.g0), tfS = sh.thrust / (1000 * MODEL.g0);
  const cmdB = b.engines.reduce((a, e) => a + (e.cmd > 0 ? Math.max(MODEL.throttleMin, e.cmd) : 0), 0) * tfFull;
  txt(c, `S1 ${fmt(tfB)} tf  cmd ${fmt(cmdB)}`, 4, h - 4, { size: 8.5, weight: 500 });
  txt(c, `S2 ${fmt(tfS)} tf`, w * 0.56, h - 4, { size: 8.5, weight: 500 });
  const twr = s.attached ? est.twr : est.twrShip;
  txt(c, `T/W ${isFinite(twr) && twr > 0 ? twr.toFixed(2) : '0.00'}`, w - 3, h - 4, { size: 8.5, align: 'right', color: OR, weight: 600 });
}

export function drawPropellant(cv, sim) {
  const { c, w, h } = fit(cv); c.clearRect(0, 0, w, h);
  const s = sim.state, b = s.booster, sh = s.ship, est = sim.estimates();
  const mr = MODEL.mixtureRatio;
  const tanks = [
    { name: 'S1 LOX', v: b.lox, cap: b.propInit * mr / (1 + mr), res: est.reserveB * mr / (1 + mr), col: CY },
    { name: 'S1 CH4', v: b.ch4, cap: b.propInit / (1 + mr), res: est.reserveB / (1 + mr), col: OR },
    { name: 'S2 LOX', v: sh.lox, cap: sh.propInit * mr / (1 + mr), res: est.reserveS * mr / (1 + mr), col: CY },
    { name: 'S2 CH4', v: sh.ch4, cap: sh.propInit / (1 + mr), res: est.reserveS / (1 + mr), col: OR },
  ];
  const top = 12, bot = h - 34, H = bot - top;
  const tw = (w - 20) / 4;
  tanks.forEach((t, i) => {
    const x = 6 + i * (tw + 2.6) + (i >= 2 ? 4 : 0), ww = tw - 10;
    const f = Math.max(0, t.v / t.cap);
    c.strokeStyle = INK; c.lineWidth = 1;
    c.beginPath(); c.roundRect ? c.roundRect(x, top, ww, H, 6) : c.rect(x, top, ww, H); c.stroke();
    c.save(); c.beginPath(); c.roundRect ? c.roundRect(x + 1.5, top + 1.5, ww - 3, H - 3, 5) : c.rect(x + 1.5, top + 1.5, ww - 3, H - 3); c.clip();
    c.fillStyle = t.col; c.globalAlpha = 0.85;
    c.fillRect(x, bot - H * f, ww, H * f);
    // stipple
    c.globalAlpha = 0.25; c.fillStyle = PAPER;
    for (let yy = bot - H * f; yy < bot; yy += 3) for (let xx = x + ((yy | 0) % 2 ? 0 : 1.5); xx < x + ww; xx += 3) c.fillRect(xx, yy, 1, 1);
    c.restore(); c.globalAlpha = 1;
    const ry = bot - H * (t.res / t.cap);
    c.strokeStyle = OR; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 2, ry); c.lineTo(x + ww + 2, ry); c.stroke();
    txt(c, t.name, x + ww / 2, bot + 10, { size: 7.5, align: 'center', color: 'rgba(23,23,23,0.75)' });
    txt(c, `${fmt(t.v / 1000)} t`, x + ww / 2, bot + 20, { size: 8.5, align: 'center', weight: 500 });
  });
  const bt = (v) => v == null ? '--' : `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
  txt(c, `S1 burn est ${bt(est.burnB)}`, 4, h - 3, { size: 8 });
  txt(c, `S2 burn est ${bt(est.burnS)}`, w - 3, h - 3, { size: 8, align: 'right' });
  txt(c, 'reserve', w - 3, 8, { size: 7, align: 'right', color: OR });
}

function niceStep(range, n) {
  const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}
export function drawTrajectory(cv, sim, marks) {
  const { c, w, h } = fit(cv); c.clearRect(0, 0, w, h);
  const s = sim.state;
  const pad = { l: 30, r: 8, t: 8, b: 18 };
  const pts = s.traj.stack, bpts = s.traj.booster;
  let maxX = 60, maxY = 40, minX = -5;
  for (const p of pts) { maxX = Math.max(maxX, p[1]); maxY = Math.max(maxY, p[2]); }
  for (const p of bpts) { minX = Math.min(minX, p[1]); maxY = Math.max(maxY, p[2]); }
  maxX *= 1.05; maxY *= 1.1;
  const X = (v) => pad.l + (v - minX) / (maxX - minX) * (w - pad.l - pad.r);
  const Y = (v) => h - pad.b - v / maxY * (h - pad.t - pad.b);
  c.strokeStyle = FAINT; c.lineWidth = 0.5;
  const sx = niceStep(maxX - minX, 4), sy = niceStep(maxY, 3);
  for (let v = 0; v <= maxX; v += sx) { c.beginPath(); c.moveTo(X(v), pad.t); c.lineTo(X(v), h - pad.b); c.stroke(); txt(c, fmt(v), X(v), h - 6, { size: 7.5, align: 'center', color: 'rgba(23,23,23,0.6)' }); }
  for (let v = 0; v <= maxY; v += sy) { c.beginPath(); c.moveTo(pad.l, Y(v)); c.lineTo(w - pad.r, Y(v)); c.stroke(); txt(c, fmt(v), pad.l - 3, Y(v) + 3, { size: 7.5, align: 'right', color: 'rgba(23,23,23,0.6)' }); }
  c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(pad.l, pad.t); c.lineTo(pad.l, h - pad.b); c.lineTo(w - pad.r, h - pad.b); c.stroke();
  txt(c, 'ALT km', pad.l + 3, pad.t + 7, { size: 7.5, color: 'rgba(23,23,23,0.7)' });
  txt(c, 'DOWNRANGE km', w - pad.r, h - pad.b - 3, { size: 7.5, align: 'right', color: 'rgba(23,23,23,0.7)' });
  const line = (arr, col, dash) => {
    if (arr.length < 2) return;
    c.strokeStyle = col; c.lineWidth = 1.4; c.setLineDash(dash || []);
    c.beginPath(); arr.forEach((p, i) => i ? c.lineTo(X(p[1]), Y(p[2])) : c.moveTo(X(p[1]), Y(p[2]))); c.stroke(); c.setLineDash([]);
  };
  line(pts, CY); line(bpts, OR, [3, 2]);
  marks.forEach((m, i) => {
    const x = X(m.x), y = Y(m.y);
    c.fillStyle = m.col || INK; c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill();
    const below = i % 2 === 0 && i > 0;
    c.font = `500 7.5px ${MONO}`;
    const lw = c.measureText(m.label).width;
    const lx = Math.min(x + 4, w - pad.r - lw), ly = below ? y + 10 : y - 4;
    txt(c, m.label, lx, ly, { size: 7.5, weight: 500, color: m.col || INK });
  });
  const cur = (body, col) => {
    if (!body || !(body.status === 'flying' || body.status === 'attached')) return;
    const x = X(body.downrange / 1000), y = Y(Math.max(0, body.alt) / 1000);
    c.strokeStyle = col; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.stroke();
    c.fillStyle = col; c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill();
  };
  cur(s.attached ? s.booster : s.ship, CY);
  if (!s.attached) cur(s.booster, OR);
}

const SHORT = { ignition: 'IGN', liftoff: 'LIFTOFF', maxq: 'MAX Q', meco: 'MECO', hot_staging: 'HOT STG', separation: 'SEP', boostback_start: 'BOOSTBK', landing_burn: 'LAND BRN', catch: 'CATCH', splashdown: 'S1 SPLASH', seco: 'SECO', ship_reentry: 'REENTRY', ship_splashdown: 'S2 SPLASH', vehicle_lost: 'LOST', failure: 'FAIL', entry_burn: 'ENTRY', peak_heating: 'PEAK HEAT', catch_nogo: 'NO-GO', cut: 'CUT', terminate: 'FTS' };
export function drawEvents(cv, sim, events) {
  const { c, w, h } = fit(cv); c.clearRect(0, 0, w, h);
  const now = sim.state.t;
  const tmax = Math.max(240, now + 30, ...events.map((e) => e.t + 30));
  const f = (t) => Math.sign(t) * Math.log1p(Math.abs(t) / 25);
  const f0 = f(-12), f1 = f(tmax);
  const X = (t) => 8 + (f(t) - f0) / (f1 - f0) * (w - 16);
  const midY = h * 0.52;
  c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(6, midY); c.lineTo(w - 6, midY); c.stroke();
  // scale ticks
  for (const t of [-10, 0, 60, 120, 300, 600, 1200, 1800, 2400, 3600]) {
    if (t > tmax) continue;
    const x = X(t); c.strokeStyle = 'rgba(23,23,23,0.4)'; c.beginPath(); c.moveTo(x, midY - 3); c.lineTo(x, midY + 3); c.stroke();
    const lab = t < 0 ? `T${t}s` : t < 60 ? `T+${t}` : `${t / 60}m`;
    txt(c, lab, x, h - 2, { size: 7, align: 'center', color: 'rgba(23,23,23,0.55)' });
  }
  // now cursor
  const nx = X(Math.min(now, tmax));
  c.fillStyle = 'rgba(63,168,201,0.15)'; c.fillRect(X(-12), midY - 5, nx - X(-12), 10);
  c.strokeStyle = CY; c.lineWidth = 1.5; c.beginPath(); c.moveTo(nx, 6); c.lineTo(nx, h - 12); c.stroke();
  // event ticks; each label takes the row (above or below) where it needs the least shift
  const shown = events.filter((e) => SHORT[e.type]);
  const rowEnd = [-1e9, -1e9];
  for (const e of shown) {
    const x = X(e.t);
    const bad = ['failure', 'vehicle_lost', 'catch_nogo', 'terminate', 'cut'].includes(e.type);
    c.strokeStyle = bad ? OR : INK; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x, midY - 6); c.lineTo(x, midY + 6); c.stroke();
    const label = SHORT[e.type];
    c.font = `500 7.5px ${MONO}`;
    const lw = c.measureText(label).width;
    const cand = rowEnd.map((end) => Math.max(x, end + lw / 2 + 4));
    const row = cand[0] - x <= cand[1] - x ? 0 : 1;
    let lx = Math.min(cand[row], w - lw / 2 - 2);
    rowEnd[row] = lx + lw / 2;
    const up = row === 0;
    const ly = up ? midY - 10 : midY + 16;
    txt(c, label, lx, ly, { size: 7.5, align: 'center', weight: 500, color: bad ? OR : INK });
    if (Math.abs(lx - x) > 1) { c.strokeStyle = 'rgba(23,23,23,0.3)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x, up ? midY - 6 : midY + 6); c.lineTo(lx, up ? midY - 8 : midY + 9); c.stroke(); }
  }
}

export { fmt };
export const PUB = PUBLISHED;
