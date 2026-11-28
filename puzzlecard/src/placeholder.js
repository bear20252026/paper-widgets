// A procedural landscape so the toy has something to cut before a photo is dropped in.
import { makeRng } from './cut.js';

export function placeholderLandscape(W = 1600, H = 1067, seed = 7) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const rnd = makeRng(seed);

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.8);
  sky.addColorStop(0, '#2b4f8e'); sky.addColorStop(0.42, '#86abd8');
  sky.addColorStop(0.72, '#efc6a3'); sky.addColorStop(1, '#f8e6d2');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  // sun
  const sx = W * 0.66, sy = H * 0.56;
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.26);
  sun.addColorStop(0, 'rgba(255,238,200,0.95)'); sun.addColorStop(0.08, 'rgba(255,226,170,0.75)');
  sun.addColorStop(0.4, 'rgba(255,200,150,0.25)'); sun.addColorStop(1, 'rgba(255,200,150,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);

  // 1D value noise ridge
  const ridge = (x, base, amp, freq, oct, off) => {
    let v = 0, a = 1, f = freq, n = 0;
    for (let o = 0; o < oct; o++) {
      const p = x * f + off * (o + 1) * 17.3;
      const i = Math.floor(p), t = p - i, s = t * t * (3 - 2 * t);
      const h = (k) => { const q = Math.sin((k + off * 101) * 12.9898) * 43758.5453; return q - Math.floor(q); };
      v += a * (h(i) * (1 - s) + h(i + 1) * s); n += a; a *= 0.5; f *= 2.1;
    }
    return base - (v / n) * amp;
  };
  const layers = [
    { base: 0.60, amp: 0.10, freq: 0.0016, col: ['#b5a7c6', '#a897bb'] },
    { base: 0.68, amp: 0.12, freq: 0.0022, col: ['#8c7fa6', '#73688f'] },
    { base: 0.77, amp: 0.11, freq: 0.0030, col: ['#5a5878', '#474562'] },
    { base: 0.86, amp: 0.09, freq: 0.0045, col: ['#333a4a', '#242a38'] },
    { base: 0.95, amp: 0.06, freq: 0.0070, col: ['#1b222d', '#151a23'] },
  ];
  layers.forEach((L, i) => {
    const off = rnd() * 100;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) ctx.lineTo(x, ridge(x, L.base, L.amp, L.freq, 3, off) * H);
    ctx.lineTo(W, H); ctx.closePath();
    const g = ctx.createLinearGradient(0, H * (L.base - L.amp), 0, H);
    g.addColorStop(0, L.col[0]); g.addColorStop(1, L.col[1]);
    ctx.fillStyle = g; ctx.fill();
    // mist above each ridge
    const mist = ctx.createLinearGradient(0, H * (L.base - L.amp - 0.08), 0, H * (L.base + 0.02));
    mist.addColorStop(0, 'rgba(255,235,220,0)'); mist.addColorStop(1, `rgba(255,235,220,${0.22 - i * 0.03})`);
    ctx.fillStyle = mist; ctx.fillRect(0, 0, W, H * (L.base + 0.02));
  });

  // birds
  ctx.strokeStyle = 'rgba(30,30,45,0.75)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const bx = W * (0.18 + rnd() * 0.3), by = H * (0.28 + rnd() * 0.14), s = 6 + rnd() * 8;
    ctx.beginPath(); ctx.moveTo(bx - s, by); ctx.quadraticCurveTo(bx - s / 2, by - s / 2, bx, by);
    ctx.quadraticCurveTo(bx + s / 2, by - s / 2, bx + s, by); ctx.stroke();
  }
  return c;
}
