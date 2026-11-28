// Four live instruments, ink on paper, Canvas 2D.
import { tableFor, FULL_LOAD, VC, VD, PEAK_FULL, PUBLISHED } from './sim.js';

const INK = '#1C1B19', INK2 = '#4a4740', INK3 = '#8a857a', AR = '#E0561C', CE = '#58AED6', PAPER = '#EEE9DC';
const MONO = '"IBM Plex Mono", monospace', LAB = '"Archivo", sans-serif', DISP = '"Bodoni Moda", serif';

function fit(c, dpr) {
  const r = c.getBoundingClientRect(); const w = Math.max(10, r.width), h = Math.max(10, r.height);
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  return { g, w, h };
}
function hatch(g, x, y, w, h, step = 3, col = INK) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.strokeStyle = col; g.lineWidth = 0.6;
  for (let k = -h; k < w; k += step) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); g.stroke(); }
  g.restore();
}

export class Instruments {
  constructor(els) {
    this.els = els; this.flash = [0, 0, 0]; this.chart = []; this.chartAcc = 0; this.loopCache = { key: -1, pts: null };
    this.fullPts = []; for (let d = 0; d <= 720; d += 2) { const i = Math.round(d / 0.5) % 1440; this.fullPts.push({ v: null, p: FULL_LOAD[d === 720 ? 1440 : i] }); }
    this.fullPts = tableFor(1.0 * 1.0);
  }
  onFire(cyl) { this.flash[cyl] = 1; }
  draw(sim, st, dt, dpr) {
    for (let i = 0; i < 3; i++) this.flash[i] = Math.max(0, this.flash[i] - dt * 3.2);
    this.tach(sim, st, dpr);
    this.cycle(sim, dpr);
    this.pv(sim, dpr);
    this.chartRec(sim, st, dt, dpr);
  }

  tach(sim, st, dpr) {
    const { g, w, h } = fit(this.els.tach, dpr);
    const R = Math.min(h / 2 - 4, w * 0.3), cx = R + 6, cy = h / 2 + 2;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, val = Math.max(0, st.tachRpm) / 100;
    const ang = v => a0 + (a1 - a0) * Math.min(1, v / 25);
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = '#f4f0e6'; g.fill(); g.lineWidth = 1.4; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(cx, cy, R - 3, 0, Math.PI * 2); g.lineWidth = 0.5; g.stroke();
    // arancio arc above rated speed
    g.beginPath(); g.arc(cx, cy, R - 8, ang(22), ang(25)); g.lineWidth = 5; g.strokeStyle = AR; g.stroke();
    g.strokeStyle = INK; g.fillStyle = INK;
    for (let v = 0; v <= 25; v += 0.5) {
      const a = ang(v), major = v % 5 === 0, mid = v % 1 === 0;
      const r1 = R - 5, r2 = r1 - (major ? 9 : mid ? 5 : 3);
      g.lineWidth = major ? 1.3 : 0.6;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
      if (major) { g.font = `500 ${Math.max(8, R * 0.17)}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(v), cx + Math.cos(a) * (r2 - 9), cy + Math.sin(a) * (r2 - 9)); }
    }
    g.font = `italic ${Math.max(8, R * 0.15)}px ${DISP}`; g.fillStyle = INK2; g.textAlign = 'center';
    g.font = `italic ${Math.max(7.5, R * 0.13)}px ${DISP}`; g.fillText('giri/min', cx, cy + R * 0.52);
    // governor setting
    const sa = ang(st.governed / 100);
    g.fillStyle = AR; g.beginPath(); g.moveTo(cx + Math.cos(sa) * (R + 1), cy + Math.sin(sa) * (R + 1));
    g.lineTo(cx + Math.cos(sa - 0.06) * (R + 7), cy + Math.sin(sa - 0.06) * (R + 7)); g.lineTo(cx + Math.cos(sa + 0.06) * (R + 7), cy + Math.sin(sa + 0.06) * (R + 7)); g.fill();
    // needle
    const na = ang(val);
    g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - Math.cos(na) * R * 0.15, cy - Math.sin(na) * R * 0.15); g.lineTo(cx + Math.cos(na) * (R - 9), cy + Math.sin(na) * (R - 9)); g.stroke();
    g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
    g.beginPath(); g.arc(cx, cy, 1.5, 0, Math.PI * 2); g.fillStyle = AR; g.fill();
    g.restore();
    // hour meter with rolling tenths drum
    const x0 = cx + R + 16, wBox = Math.min(w - x0 - 4, 120);
    if (wBox > 50) {
      g.font = `500 8px ${LAB}`; g.fillStyle = INK2; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.save(); g.font = `500 7.6px ${LAB}`; g.letterSpacing = '1.4px'; g.fillText('HOUR METER', x0, h / 2 - 22); g.restore();
      g.font = `italic 10px ${DISP}`; g.fillText('contaore', x0, h / 2 - 11);
      const hrs = sim.hours; const whole = Math.floor(hrs); const tenth = (hrs * 10) % 10;
      const digits = String(whole).padStart(5, '0');
      const cw = Math.min(14, (wBox - 4) / 6.2), ch = cw * 1.45, y0 = h / 2 - 4;
      for (let k = 0; k < 6; k++) {
        const x = x0 + k * (cw + 1);
        g.fillStyle = k === 5 ? '#f4f0e6' : INK; g.fillRect(x, y0, cw, ch);
        g.save(); g.beginPath(); g.rect(x, y0, cw, ch); g.clip();
        g.font = `500 ${cw * 1.0}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (k < 5) { g.fillStyle = PAPER; g.fillText(digits[k], x + cw / 2, y0 + ch / 2 + 0.5); }
        else {
          const f = tenth - Math.floor(tenth); const d = Math.floor(tenth);
          g.fillStyle = AR;
          g.fillText(String(d), x + cw / 2, y0 + ch / 2 + 0.5 - f * ch);
          g.fillText(String((d + 1) % 10), x + cw / 2, y0 + ch / 2 + 0.5 + (1 - f) * ch);
        }
        g.restore();
      }
      g.strokeStyle = INK; g.lineWidth = 0.8; g.strokeRect(x0 - 1.5, y0 - 1.5, 6 * (cw + 1) + 2, ch + 3);
      g.font = `500 10px ${MONO}`; g.fillStyle = INK; g.textAlign = 'left';
      g.fillText(`${Math.round(Math.max(0, st.tachRpm))}`, x0, y0 + ch + 16);
      g.font = `8px ${MONO}`; g.fillStyle = INK3; g.fillText('rpm · thermal 30×', x0, y0 + ch + 27);
    }
  }

  cycle(sim, dpr) {
    const { g, w, h } = fit(this.els.cycle, dpr);
    const R = Math.min(h / 2 - 4, w * 0.3), cx = R + 6, cy = h / 2;
    const ringW = R * 0.2;
    const col = { power: AR, exhaust: '#a9a397', intake: CE };
    // angle on the wheel: 0 deg at top, clockwise, 720 deg per turn of the wheel
    const A = d => -Math.PI / 2 + d / 720 * Math.PI * 2;
    for (let i = 0; i < 3; i++) {
      const r1 = R - i * (ringW + 2), r0 = r1 - ringW;
      for (const [name, s, e] of [['power', 0, 180], ['exhaust', 180, 360], ['intake', 360, 540], ['compression', 540, 720]]) {
        const a = A(s + 240 * i), b = A(e + 240 * i);
        g.beginPath(); g.arc(cx, cy, r1, a, b); g.arc(cx, cy, r0, b, a, true); g.closePath();
        if (name === 'compression') {
          g.save(); g.clip(); hatch(g, cx - R, cy - R, 2 * R, 2 * R, 3, INK2); g.restore();
          g.beginPath(); g.arc(cx, cy, r1, a, b); g.arc(cx, cy, r0, b, a, true); g.closePath();
        } else { g.fillStyle = col[name]; g.fill(); }
        g.strokeStyle = INK; g.lineWidth = 0.6; g.stroke();
      }
      // firing dot at TDC of this cylinder
      const fa = A(240 * i), fr = r1 - ringW / 2;
      g.beginPath(); g.arc(cx + Math.cos(fa) * fr, cy + Math.sin(fa) * fr, 2.2 + this.flash[i] * 4, 0, Math.PI * 2);
      g.fillStyle = this.flash[i] > 0.05 ? `rgba(255,${180 - 120 * this.flash[i]},40,${0.5 + 0.5 * this.flash[i]})` : INK; g.fill();
      g.font = `600 7.5px ${MONO}`; g.fillStyle = PAPER; g.textAlign = 'center'; g.textBaseline = 'middle';
    }
    // pointer follows the crank
    const th = ((sim.theta % 720) + 720) % 720, pa = A(th);
    g.strokeStyle = INK; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(pa) * (R + 3), cy + Math.sin(pa) * (R + 3)); g.stroke();
    g.beginPath(); g.arc(cx, cy, R - 3 * (ringW + 2) + 1, 0, Math.PI * 2); g.fillStyle = '#f4f0e6'; g.fill(); g.lineWidth = 0.6; g.stroke();
    g.font = `500 ${Math.max(7.5, R * 0.16)}px ${MONO}`; g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${Math.floor(th)}°`, cx, cy);
    // legend
    const x0 = cx + R + 14; let y = cy - 30;
    g.textAlign = 'left'; g.textBaseline = 'middle';
    const leg = [['Power', 'scoppio', 'power'], ['Exhaust', 'scarico', 'exhaust'], ['Intake', 'aspirazione', 'intake'], ['Compression', 'compressione', 'compression']];
    for (const [en, it, k] of leg) {
      if (k === 'compression') { g.strokeStyle = INK; g.lineWidth = 0.6; g.strokeRect(x0, y - 4, 10, 8); hatch(g, x0, y - 4, 10, 8, 3, INK2); }
      else { g.fillStyle = col[k]; g.fillRect(x0, y - 4, 10, 8); g.strokeStyle = INK; g.lineWidth = 0.6; g.strokeRect(x0, y - 4, 10, 8); }
      g.fillStyle = INK; g.font = `500 7.6px ${LAB}`; g.fillText(en.toUpperCase(), x0 + 15, y); const tw = g.measureText(en.toUpperCase()).width;
      g.fillStyle = INK2; g.font = `italic 9.5px ${DISP}`; g.fillText(it, x0 + 15 + tw + 5, y);
      y += 14;
    }
    g.fillStyle = INK3; g.font = `8px ${MONO}`; g.fillText('rings 1·2·3 · fires every 240°', x0, y + 2);
  }

  pv(sim, dpr) {
    const { g, w, h } = fit(this.els.pv, dpr);
    const L = 30, Rr = 8, T = 6, B = 18;
    const pw = w - L - Rr, ph = h - T - B;
    const vmin = VC, vmax = VC + VD, pmax = 85;
    const X = v => L + (v - vmin) / (vmax - vmin) * pw;
    const Y = p => T + ph - Math.min(pmax, p) / pmax * ph;
    g.strokeStyle = 'rgba(88,174,214,0.45)'; g.lineWidth = 0.5;
    for (let p = 0; p <= 80; p += 20) { g.beginPath(); g.moveTo(L, Y(p)); g.lineTo(L + pw, Y(p)); g.stroke(); }
    for (let k = 0; k <= 4; k++) { const v = vmin + (vmax - vmin) * k / 4; g.beginPath(); g.moveTo(X(v), T); g.lineTo(X(v), T + ph); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 0.9; g.beginPath(); g.moveTo(L, T); g.lineTo(L, T + ph); g.lineTo(L + pw, T + ph); g.stroke();
    g.fillStyle = INK2; g.font = `8px ${MONO}`; g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let p = 0; p <= 80; p += 20) g.fillText(String(p), L - 4, Y(p));
    g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText('PMS', X(vmin), T + ph + 3); g.fillText('PMI', X(vmax), T + ph + 3);
    g.fillText('V', L + pw / 2, T + ph + 3);
    g.save(); g.translate(8, T + ph / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'middle'; g.fillText('p bar', 0, 0); g.restore();
    // full load reference, dashed
    g.setLineDash([3, 2.5]); g.strokeStyle = INK3; g.lineWidth = 0.8;
    g.beginPath(); this.fullPts.forEach((q, k) => k ? g.lineTo(X(q.v), Y(q.p)) : g.moveTo(X(q.v), Y(q.p))); g.stroke(); g.setLineDash([]);
    // live loop
    const c = sim.cylinderState(0);
    const key = Math.round(c.fuel * 200);
    if (key !== this.loopCache.key) { this.loopCache = { key, pts: tableFor(key / 200) }; }
    const pts = this.loopCache.pts;
    let peak = 0, pv = null; for (const q of pts) if (q.p > peak) { peak = q.p; pv = q.v; }
    g.strokeStyle = INK; g.lineWidth = 1.3;
    g.beginPath(); pts.forEach((q, k) => k ? g.lineTo(X(q.v), Y(q.p)) : g.moveTo(X(q.v), Y(q.p))); g.stroke();
    // dot at the current state
    g.beginPath(); g.arc(X(c.v), Y(c.p), 3.2, 0, Math.PI * 2); g.fillStyle = AR; g.fill(); g.strokeStyle = INK; g.lineWidth = 0.6; g.stroke();
    // peak label
    g.fillStyle = INK; g.font = `500 9px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    const lx = X(pv) + 7, ly = Y(peak) + 2;
    g.fillText(`p max ${peak.toFixed(0)} bar`, lx, ly - 2);
    g.fillStyle = INK3; g.font = `8px ${MONO}`; g.fillText(`full load ${PEAK_FULL.toFixed(0)} · dashed`, lx, ly + 11);
    g.fillStyle = INK2; g.font = `italic 9.5px ${DISP}`; g.textAlign = 'right';
    g.textAlign = 'left'; g.fillStyle = AR; g.font = `500 7.5px ${LAB}`; g.textAlign = 'right'; g.fillText('MODELLED', L + pw - 2, T + ph - 7);
    g.textAlign = 'right'; g.fillStyle = INK2; g.font = `italic 9.5px ${DISP}`;
    g.fillText(c.stroke === 'power' ? 'scoppio' : c.stroke === 'exhaust' ? 'scarico' : c.stroke === 'intake' ? 'aspirazione' : 'compressione', L + pw - 2, T + 8);
  }

  chartRec(sim, st, dt, dpr) {
    const { g, w, h } = fit(this.els.chart, dpr);
    const step = 1 / 30; this.chartAcc += dt;
    while (this.chartAcc >= step) { this.chartAcc -= step; this.chart.push({ rpm: st.tachRpm, kw: st.kW, ev: st.mark }); st.mark = null; if (this.chart.length > 900) this.chart.shift(); }
    const L = 4, T = 4, B = 4, Rr = 30; const pw = w - L - Rr, ph = h - T - B;
    g.fillStyle = '#f3efe4'; g.fillRect(L, T, pw, ph);
    g.strokeStyle = 'rgba(88,174,214,0.55)'; g.lineWidth = 0.5;
    const px = 2; // px per sample
    const n = Math.min(this.chart.length, Math.floor(pw / px));
    const offset = (this.chart.length % 10) * px;
    for (let x = L + pw + offset; x > L; x -= px * 10) { if (x < L + pw) { g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); } }
    for (let k = 0; k <= 5; k++) { const y = T + ph * k / 5; g.lineWidth = k % 5 === 0 ? 0.8 : 0.4; g.beginPath(); g.moveTo(L, y); g.lineTo(L + pw, y); g.stroke(); }
    const Yr = r => T + ph - Math.min(1, r / 2500) * ph, Yk = k => T + ph - Math.min(1, k / 31.25) * ph;
    const data = this.chart.slice(-n);
    const xAt = k => L + pw - (data.length - 1 - k) * px;
    g.strokeStyle = INK; g.lineWidth = 1.1; g.beginPath(); data.forEach((d, k) => k ? g.lineTo(xAt(k), Yr(d.rpm)) : g.moveTo(xAt(k), Yr(d.rpm))); g.stroke();
    g.strokeStyle = AR; g.lineWidth = 1.1; g.beginPath(); data.forEach((d, k) => k ? g.lineTo(xAt(k), Yk(d.kw)) : g.moveTo(xAt(k), Yk(d.kw))); g.stroke();
    g.fillStyle = INK2; g.font = `7.5px ${MONO}`;
    data.forEach((d, k) => { if (d.ev) { const x = xAt(k); g.strokeStyle = INK3; g.setLineDash([1.5, 2]); g.beginPath(); g.moveTo(x, T); g.lineTo(x, T + ph); g.stroke(); g.setLineDash([]); g.save(); g.translate(x + 2, T + 3); g.rotate(Math.PI / 2); g.textAlign = 'left'; g.fillText(d.ev, 0, 0); g.restore(); } });
    // pens at the right edge and scale labels
    const last = data[data.length - 1] || { rpm: 0, kw: 0 };
    g.fillStyle = INK; g.beginPath(); g.arc(L + pw, Yr(last.rpm), 2.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = AR; g.beginPath(); g.arc(L + pw, Yk(last.kw), 2.4, 0, Math.PI * 2); g.fill();
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `8px ${MONO}`;
    g.fillStyle = INK; g.fillText('2500', L + pw + 4, T + 4); g.fillText('rpm', L + pw + 4, T + 14);
    g.fillStyle = AR; g.fillText('31 kW', L + pw + 4, T + ph * 0.5 - 6);
    g.fillStyle = INK3; g.fillText('29.1', L + pw + 4, Yk(29.1) + 6);
    g.strokeStyle = 'rgba(224,86,28,0.5)'; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(L, Yk(PUBLISHED.ratedKW)); g.lineTo(L + pw, Yk(PUBLISHED.ratedKW)); g.stroke(); g.setLineDash([]);
    g.fillStyle = INK; g.fillText('0', L + pw + 4, T + ph - 4);
  }
}
