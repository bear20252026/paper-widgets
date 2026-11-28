// Piece geometry — classic jigsaw cut.
// Edge recipe follows Draradech's generator (CC0): every inner edge is three
// cubic Béziers; tab size and a small jitter per edge give the hand-cut feel.

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a cols×rows grid near `count` whose cells are as square as possible.
export function gridFor(count, aspect) {
  let best = null;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.max(1, Math.round(count / cols));
    const n = cols * rows;
    const cellAspect = (aspect * rows) / cols;
    const score = (Math.abs(n - count) / count) * 4 + Math.abs(Math.log(cellAspect));
    if (!best || score < best.score) best = { cols, rows, score };
  }
  return { cols: best.cols, rows: best.rows };
}

// Returns per-piece outlines in print pixels.
export function makeCut({ cols, rows, width, height, seed = 1, tab = 0.1, jitter = 0.04 }) {
  const rnd = makeRng(seed);
  const uni = (a, b) => a + rnd() * (b - a);
  const cw = width / cols, ch = height / rows;

  const line = (segments) => {
    const out = [];
    let e = uni(-jitter, jitter), flip = rnd() > 0.5;
    for (let i = 0; i < segments; i++) {
      const flipold = flip; flip = rnd() > 0.5;
      const a = flip === flipold ? -e : e;
      const b = uni(-jitter, jitter), c = uni(-jitter, jitter), d = uni(-jitter, jitter);
      e = uni(-jitter, jitter);
      out.push({ a, b, c, d, e, flip });
    }
    return out;
  };
  // horizontal inner lines (between rows), vertical inner lines (between cols)
  const hLines = []; for (let yi = 1; yi < rows; yi++) hLines.push(line(cols));
  const vLines = []; for (let xi = 1; xi < cols; xi++) vLines.push(line(rows));

  // The ten control points of one edge, in (along, across) space, then mapped.
  function edgePoints(p, l, w) {
    const t = tab, { a, b, c, d, e } = p;
    return [
      [l(0), w(0)], [l(0.2), w(a)], [l(0.5 + b + d), w(-t + c)], [l(0.5 - t + b), w(t + c)],
      [l(0.5 - 2 * t + b - d), w(3 * t + c)], [l(0.5 + 2 * t + b - d), w(3 * t + c)],
      [l(0.5 + t + b), w(t + c)], [l(0.5 + b + d), w(-t + c)], [l(0.8), w(e)], [l(1), w(0)],
    ];
  }
  function hEdge(yi, xi) {            // along x, across y
    const p = hLines[yi - 1][xi], y0 = yi * ch, x0 = xi * cw, s = p.flip ? -1 : 1;
    return edgePoints(p, v => x0 + cw * v, v => y0 + ch * v * s).map(([x, y]) => ({ x, y }));
  }
  function vEdge(xi, yi) {            // along y, across x
    const p = vLines[xi - 1][yi], x0 = xi * cw, y0 = yi * ch, s = p.flip ? -1 : 1;
    return edgePoints(p, v => y0 + ch * v, v => x0 + cw * v * s).map(([y, x]) => ({ x, y }));
  }
  const curves = (pts) => [[pts[1], pts[2], pts[3]], [pts[4], pts[5], pts[6]], [pts[7], pts[8], pts[9]]];
  const reversed = (pts) => pts.slice().reverse();

  const pieces = [];
  for (let yi = 0; yi < rows; yi++) {
    for (let xi = 0; xi < cols; xi++) {
      const x0 = xi * cw, y0 = yi * ch, x1 = x0 + cw, y1 = y0 + ch;
      const segs = []; // {c1,c2,p} cubic or {p} line, starting from (x0,y0), clockwise
      const addEdge = (pts) => { for (const [c1, c2, p] of curves(pts)) segs.push({ c1, c2, p }); };
      if (yi === 0) segs.push({ p: { x: x1, y: y0 } }); else addEdge(hEdge(yi, xi));
      if (xi === cols - 1) segs.push({ p: { x: x1, y: y1 } }); else addEdge(vEdge(xi + 1, yi));
      if (yi === rows - 1) segs.push({ p: { x: x0, y: y1 } }); else addEdge(reversed(hEdge(yi + 1, xi)));
      if (xi === 0) segs.push({ p: { x: x0, y: y0 } }); else addEdge(reversed(vEdge(xi, yi)));
      // bbox from control hull
      let bx0 = x0, by0 = y0, bx1 = x1, by1 = y1;
      for (const s of segs) for (const q of [s.c1, s.c2, s.p]) if (q) {
        bx0 = Math.min(bx0, q.x); by0 = Math.min(by0, q.y); bx1 = Math.max(bx1, q.x); by1 = Math.max(by1, q.y);
      }
      pieces.push({ xi, yi, start: { x: x0, y: y0 }, segs, bbox: { x0: bx0, y0: by0, x1: bx1, y1: by1 } });
    }
  }
  return { cols, rows, cw, ch, width, height, pieces };
}

// Trace a piece outline onto a 2D context, offset so bbox origin lands at (ox, oy).
export function tracePiece(ctx, piece, ox, oy, scale = 1) {
  const X = (v) => (v - piece.bbox.x0) * scale + ox, Y = (v) => (v - piece.bbox.y0) * scale + oy;
  ctx.beginPath();
  ctx.moveTo(X(piece.start.x), Y(piece.start.y));
  for (const s of piece.segs) {
    if (s.c1) ctx.bezierCurveTo(X(s.c1.x), Y(s.c1.y), X(s.c2.x), Y(s.c2.y), X(s.p.x), Y(s.p.y));
    else ctx.lineTo(X(s.p.x), Y(s.p.y));
  }
  ctx.closePath();
}
