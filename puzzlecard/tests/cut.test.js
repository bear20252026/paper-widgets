// The cut: a seeded stream, a grid that suits the photo, one closed outline per piece.
import test from "node:test";
import assert from "node:assert/strict";
import { gridFor, makeCut, makeRng, tracePiece } from "../src/cut.js";

test("makeRng is a seeded stream: same seed, same numbers; another seed, another cut", () => {
  const a = makeRng(11);
  const b = makeRng(11);
  const c = makeRng(12);
  const first = [a(), a(), a(), a(), a()];
  assert.deepEqual([b(), b(), b(), b(), b()], first);
  assert.notDeepEqual([c(), c(), c(), c(), c()], first);
  for (const n of first) assert.ok(n >= 0 && n < 1);
});

test("gridFor lands near the asked count and keeps cells close to square", () => {
  for (const count of [9, 20, 50, 100]) {
    for (const aspect of [0.75, 1, 1.5]) {
      const { cols, rows } = gridFor(count, aspect);
      const cells = cols * rows;
      assert.ok(Math.abs(cells - count) <= Math.max(1, count * 0.12), `${cols}×${rows} for ${count}`);
      const cell = (aspect * rows) / cols; // width / height of one cell, 1 is square
      assert.ok(cell > 0.55 && cell < 1.8, `${cols}×${rows} cells ${cell.toFixed(2)} for aspect ${aspect}`);
      assert.ok(cols >= 1 && rows >= 1);
    }
  }
});

test("makeCut returns one piece per cell and nothing else", () => {
  const cut = makeCut({ cols: 4, rows: 5, width: 800, height: 600, seed: 3 });
  assert.equal(cut.pieces.length, 20);
  assert.equal(cut.cw, 200);
  assert.equal(cut.ch, 120);
  for (const p of cut.pieces) assert.ok(p.segs.length >= 4);
  assert.deepEqual(
    [...new Set(cut.pieces.map((p) => `${p.xi},${p.yi}`))].sort(),
    cut.pieces.map((p) => `${p.xi},${p.yi}`).sort(),
  );
});

test("the same seed cuts the same lines, a new seed does not", () => {
  const a = makeCut({ cols: 3, rows: 3, width: 600, height: 600, seed: 7 });
  const b = makeCut({ cols: 3, rows: 3, width: 600, height: 600, seed: 7 });
  const c = makeCut({ cols: 3, rows: 3, width: 600, height: 600, seed: 8 });
  assert.deepEqual(a.pieces[4].segs, b.pieces[4].segs);
  assert.notDeepEqual(a.pieces[4].segs, c.pieces[4].segs);
});

test("outlines stay near the print: no piece runs away with a stray control point", () => {
  const width = 800;
  const height = 600;
  const { cols, rows } = gridFor(20, width / height);
  const cut = makeCut({ cols, rows, width, height, seed: 5 });
  const slack = 0.2 * Math.max(cut.cw, cut.ch); // the tab reaches half a cell at most
  for (const piece of cut.pieces) {
    for (const seg of piece.segs) {
      for (const q of [seg.c1, seg.c2, seg.p]) {
        if (!q) continue;
        assert.ok(q.x > -slack && q.x < width + slack, `x ${q.x}`);
        assert.ok(q.y > -slack && q.y < height + slack, `y ${q.y}`);
      }
    }
    assert.ok(piece.bbox.x1 > piece.bbox.x0 && piece.bbox.y1 > piece.bbox.y0);
  }
});

test("tracePiece: three curves per inner edge, straight lines along the border", () => {
  const cut = makeCut({ cols: 3, rows: 3, width: 600, height: 600, seed: 2 });
  const calls = { move: 0, line: 0, curve: 0 };
  const ctx = {
    beginPath() {},
    closePath() {},
    moveTo() { calls.move += 1; },
    lineTo() { calls.line += 1; },
    bezierCurveTo() { calls.curve += 1; },
  };

  // a middle piece: four inner edges, no border at all
  tracePiece(ctx, cut.pieces[4], 0, 0);
  assert.deepEqual(calls, { move: 1, line: 0, curve: 12 });

  // a corner piece: two borders, two inner edges
  const corner = { move: 0, line: 0, curve: 0 };
  const ctx2 = { ...ctx, moveTo() { corner.move += 1; }, lineTo() { corner.line += 1; }, bezierCurveTo() { corner.curve += 1; } };
  tracePiece(ctx2, cut.pieces[0], 0, 0);
  assert.deepEqual(corner, { move: 1, line: 2, curve: 6 });
});
