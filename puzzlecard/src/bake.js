// Bake: photo → print → per-piece colour crops + mask/bevel-normal atlas.
// Lighting happens live in the shader; this step only produces textures.
import { makeCut, tracePiece } from './cut.js';

const GUTTER = 24; // transparent texels around each slot (room for blurred shadows)

export function makePrint(image, longSide = 1600) {
  const iw = image.naturalWidth || image.width, ih = image.naturalHeight || image.height;
  let aspect = iw / ih;
  const clamped = Math.min(1.9, Math.max(0.62, aspect));
  let W, H;
  if (clamped >= 1) { W = longSide; H = Math.round(W / clamped); } else { H = longSide; W = Math.round(H * clamped); }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  // cover-crop the photo into the clamped frame
  const s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s;
  ctx.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return c;
}

// Separable box blur, run three times ≈ gaussian. Operates on Float32 in place.
function blur(src, w, h, r) {
  let a = src, b = new Float32Array(src.length);
  const pass = (from, to, horizontal) => {
    const len = horizontal ? w : h, lines = horizontal ? h : w;
    for (let l = 0; l < lines; l++) {
      let acc = 0;
      const idx = (i) => (horizontal ? l * w + i : i * w + l);
      for (let i = -r; i <= r; i++) acc += from[idx(Math.min(len - 1, Math.max(0, i)))];
      for (let i = 0; i < len; i++) {
        to[idx(i)] = acc / (2 * r + 1);
        acc += from[idx(Math.min(len - 1, i + r + 1))] - from[idx(Math.max(0, i - r))];
      }
    }
  };
  for (let k = 0; k < 3; k++) { pass(a, b, true); pass(b, a, false); }
  return a;
}

export function bake(print, { cols, rows, seed }) {
  const W = print.width, H = print.height;
  const cut = makeCut({ cols, rows, width: W, height: H, seed });
  const cell = Math.min(cut.cw, cut.ch);
  const bevel = Math.max(2, Math.min(5, Math.round(cell * 0.02)));   // a tight rounding: the seam reads as a thin cut, not a groove
  const margin = bevel * 2 + 2;

  // seam map for the start screen: a flat "normal map" of the whole print whose height channel dips along
  // every cut line, so the uncut slab can show the coming cuts in ONE pass (per-piece overlays stack up
  // where tabs and corners overlap and turn into blobs)
  const previewNormal = document.createElement('canvas'); previewNormal.width = W; previewNormal.height = H;
  {
    const pctx = previewNormal.getContext('2d');
    pctx.fillStyle = 'rgb(128,128,255)'; pctx.fillRect(0, 0, W, H);
    pctx.strokeStyle = 'rgb(128,128,0)'; pctx.lineWidth = 4; pctx.lineJoin = 'round';
    for (const p of cut.pieces) { tracePiece(pctx, p, p.bbox.x0, p.bbox.y0); pctx.stroke(); }
  }

  // slot size from the largest bbox
  let bw = 0, bh = 0;
  for (const p of cut.pieces) {
    bw = Math.max(bw, Math.ceil(p.bbox.x1 - p.bbox.x0) + 2 * margin);
    bh = Math.max(bh, Math.ceil(p.bbox.y1 - p.bbox.y0) + 2 * margin);
  }
  const slotW = bw + 2 * GUTTER, slotH = bh + 2 * GUTTER;
  const n = cut.pieces.length;
  const gcols = Math.ceil(Math.sqrt(n * (slotH / slotW))) || 1;
  const grows = Math.ceil(n / gcols);
  const AW = gcols * slotW, AH = grows * slotH;

  const colorAtlas = document.createElement('canvas'); colorAtlas.width = AW; colorAtlas.height = AH;
  const normalAtlas = { data: new Uint8Array(AW * AH * 4), width: AW, height: AH };
  const cctx = colorAtlas.getContext('2d');
  // colour atlas: fill with print average so mip bleeding stays tame
  cctx.fillStyle = '#888'; cctx.fillRect(0, 0, AW, AH);

  const scratch = document.createElement('canvas'); scratch.width = bw; scratch.height = bh;
  const sctx = scratch.getContext('2d', { willReadFrequently: true });

  const pieces = cut.pieces.map((p, i) => {
    const pw = Math.ceil(p.bbox.x1 - p.bbox.x0) + 2 * margin;
    const ph = Math.ceil(p.bbox.y1 - p.bbox.y0) + 2 * margin;
    const sx = (i % gcols) * slotW + GUTTER, sy = Math.floor(i / gcols) * slotH + GUTTER;

    // colour: unclipped crop (mask lives in the other atlas; keeps mips clean)
    cctx.drawImage(print, p.bbox.x0 - margin, p.bbox.y0 - margin, pw, ph, sx, sy, pw, ph);

    // mask
    sctx.clearRect(0, 0, bw, bh);
    sctx.fillStyle = '#fff';
    tracePiece(sctx, p, margin, margin);
    sctx.fill();
    const md = sctx.getImageData(0, 0, pw, ph).data;
    const mask = new Uint8Array(pw * ph);
    const hf = new Float32Array(pw * ph);
    for (let k = 0; k < pw * ph; k++) { mask[k] = md[k * 4 + 3]; hf[k] = mask[k] / 255; }

    // height: blurred mask, remapped so 0 = edge, 1 = flat top
    const soft = blur(hf, pw, ph, Math.max(1, Math.round(bevel * 0.5)));
    const od = normalAtlas.data;
    const hAt = (x, y) => {
      const v = soft[Math.min(ph - 1, Math.max(0, y)) * pw + Math.min(pw - 1, Math.max(0, x))];
      const t = Math.min(1, Math.max(0, (v - 0.5) / 0.47));
      return t * t * (3 - 2 * t);
    };
    const k = bevel * 0.9;
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const idx = y * pw + x;
      const h = hAt(x, y);
      let nx = -(hAt(x + 1, y) - hAt(x - 1, y)) * k, ny = -(hAt(x, y + 1) - hAt(x, y - 1)) * k;
      const inv = 1 / Math.hypot(nx, ny, 1); nx *= inv; ny *= inv;
      const o = ((sy + y) * AW + (sx + x)) * 4;
      od[o] = Math.round((nx * 0.5 + 0.5) * 255);
      od[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      od[o + 2] = Math.round(h * 255);
      od[o + 3] = mask[idx];
    }

    return {
      i, xi: p.xi, yi: p.yi,
      // bbox in print px (incl. margin) and where it sits relative to the print origin
      px: p.bbox.x0 - margin, py: p.bbox.y0 - margin, pw, ph,
      // atlas uv of the bbox, and of the gutter-expanded shadow rect
      uv: [sx / AW, sy / AH, (sx + pw) / AW, (sy + ph) / AH],
      uvShadow: [(sx - GUTTER) / AW, (sy - GUTTER) / AH, (sx + pw + GUTTER) / AW, (sy + ph + GUTTER) / AH],
      gutter: GUTTER,
      mask,
    };
  });

  return { W, H, cols, rows, cw: cut.cw, ch: cut.ch, bevel, colorAtlas, normalAtlas, previewNormal, pieces };
}
