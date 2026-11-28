/* ════ one pen-point, one line.
   It erases the FROM glyph along that glyph's own path, glides across
   with the ink lifted, then writes the TO glyph. Any glyph can sit in
   either slot — the heart is just another glyph in the pool. ════ */

const P = { dur:2200, width:5, brush:'pen', color:'#b73a2b' };

/* Solve a CSS cubic-bezier in JS so the rAF clock and the CSS
   transitions can share one curve vocabulary instead of two. */
function bezier(x1,y1,x2,y2){
  const cx=3*x1, bx=3*(x2-x1)-cx, ax=1-cx-bx;
  const cy=3*y1, by=3*(y2-y1)-cy, ay=1-cy-by;
  const fx=t=>((ax*t+bx)*t+cx)*t;
  const dx=t=>(3*ax*t+2*bx)*t+cx;
  return x=>{
    let t=x;
    for(let i=0;i<8;i++){
      const err=fx(t)-x, slope=dx(t);
      if(Math.abs(err)<1e-6 || Math.abs(slope)<1e-6) break;
      t-=err/slope;
    }
    t=Math.min(1,Math.max(0,t));
    return ((ay*t+by)*t+cy)*t;
  };
}
/* --ease-in-out, the strong curve for something morphing on screen:
   the pen gathers itself, travels briskly, lands softly. */
const ez = bezier(0.77, 0, 0.175, 1);

/* fewer and gentler, never zero — the pen journey collapses to a crossfade */
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

const BRUSHES = {
  pen:    {cap:'round', mul:1,    op:1  },   /* the clean monoline — the reference */
  /* the nib below SWEEPS the line, so it comes out anywhere from as drawn
     to 2.5× that — mul takes the average back out, and the slider goes on
     meaning roughly what it says */
  brush:  {cap:'round', mul:.68,  op:1  },   /* a nib: thick, thin, and dry in places */
  /* .72 plus a blurred edge came out weaker than the colour you picked;
     paint is thinner than ink, not a ghost of it */
  wash:   {cap:'round', mul:1,    op:.8 },   /* watercolour, soft & bleeding */
  rough:  {cap:'round', mul:.82,  op:.92},   /* a sketch gone over twice */
  pencil: {cap:'round', mul:.85,  op:.8 },   /* graphite catching on the tooth */
};

/* ════ the brushes ════
   Every number below is a MULTIPLE OF `sw` — the width of the line in the
   glyph's own coordinates. It has to be: a word rides at k≈2.85 while a
   hanzi fills the box at k≈0.9, so one shared filter meant a displacement
   WIDER THAN A WORD'S OWN LINE (which is what pinched every bowl bottom
   and tore the horizontals) while barely touching the hanzi. Each glyph
   gets its own filter instead, rebuilt whenever the line changes.

   `px` is how many screen pixels that line actually covers, and it is what
   the dry texture is gated on: 飞白 on a 14px stroke is a brush skipping,
   on the 1px footer mark it is just a broken letter. */
/* alpha := g1·R + g0 — a turbulence channel ramped down into thin patches.
   grit 0 leaves the stroke solid. The ramp is deliberately gentle and only
   its far tail reaches zero: 飞白 is the bristles thinning, and a threshold
   hard enough to punch clean holes just cuts the letter into stripes.
   The grain must also stay SMALLER THAN THE LINE — bands wider than the
   stroke sever it instead of nibbling at it, which is the same mistake in
   the other axis. Hence every frequency below is a multiple of 1/sw. */
const dry = (grit,bfx,bfy,seed)=>
  `<feTurbulence type="fractalNoise" baseFrequency="${bfx.toFixed(3)} ${bfy.toFixed(3)}" numOctaves="2" seed="${seed}" result="d0"/>`+
  `<feColorMatrix in="d0" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${(4.6*grit).toFixed(2)} 0 0 0 ${(1-2.05*grit).toFixed(2)}" result="d1"/>`;

const RECIPE = {
  brush:(sw,grit)=>
    /* ── the nib ──
       A broad nib is not a filter effect, it is a shape: the line SWEPT
       along the nib's own edge — a Minkowski sum with a short segment. So
       that is what this is. Copies of the stroke are laid down along the
       nib axis at .38·sw apart (closer together than the line is wide, or
       the sweep would come out scalloped) and unioned. A stroke crossing
       the nib gathers the whole sweep and comes out 2.5× broad; one
       running along it picks up nothing and stays at the drawn width.
       The axis is near-horizontal and tipped down, which in a hand that
       slants right is square across the downstrokes — the thick strokes
       of any broad-nib hand.
       The sweep is symmetric about 0, so it cannot shift the glyph off its
       own baseline; the one asymmetric term is `under`. */
    [-1,-.5,.5,1].map((t,i)=>
      `<feOffset in="SourceGraphic" dx="${(t*.70*sw).toFixed(2)}" dy="${(t*.28*sw).toFixed(2)}" result="s${i}"/>`).join('')+
    /* and a whisper of weight on the underside of everything: ink runs
       down, and a line always sits heaviest along its bottom edge */
    `<feOffset in="SourceGraphic" dx="0" dy="${(.22*sw).toFixed(2)}" result="under"/>`+
    `<feMerge result="nib">`+
      [0,1,2,3].map(i=>`<feMergeNode in="s${i}"/>`).join('')+
      `<feMergeNode in="under"/><feMergeNode in="SourceGraphic"/>`+
    `</feMerge>`+
    /* the hand's waver, a fraction of the line so it can never pinch it */
    `<feTurbulence type="fractalNoise" baseFrequency="${(1/(sw*7)).toFixed(3)}" numOctaves="2" seed="7" result="n"/>`+
    `<feDisplacementMap in="nib" in2="n" scale="${(.34*sw).toFixed(2)}" result="wav"/>`+
    /* 飞白 — where the bristles skip, the paper comes through. Stretched
       along the stroke, so it reads as a skid rather than as dirt. */
    /* Nearly isotropic on purpose. A strongly stretched field lays the same
       parallel hatching over every stroke whatever direction it runs, and
       that regularity is exactly what gives a filter away; grain a little
       longer than it is tall reads as ink instead.
       Kept weak enough that the palest patch is still ~22% ink and never
       bare paper: white holes read as SPRAY, and enough of them wash the
       colour itself out — the mark stops being the colour you picked. */
    dry(grit*.38, 1/(sw*.85), 1/(sw*.6), 4)+
    `<feComposite in="wav" in2="d1" operator="in"/>`,

  /* Watercolour is a soft EDGE and an uneven interior, not an aura. An
     earlier version put a wide blurred copy behind the stroke and merged
     it — which is the recipe for a glow, and it read as neon rather than
     as paint. What is left is what water actually does: an edge that
     wandered while it was wet, softened just under half a line width, and
     pigment settling unevenly across the tooth of the paper. */
  wash:(sw,grit)=>
    `<feTurbulence type="fractalNoise" baseFrequency="${(1/(sw*7)).toFixed(3)}" numOctaves="2" seed="11" result="w"/>`+
    `<feDisplacementMap in="SourceGraphic" in2="w" scale="${(.5*sw).toFixed(2)}" result="d"/>`+
    `<feGaussianBlur in="d" stdDeviation="${(.13*sw).toFixed(2)}" result="body"/>`+
    /* Granulation, but WIDE and faint. Fine grain over a blurred line does
       not read as pigment settling, it reads as a string of wet beads —
       the mottling has to be much larger than the line to look like tone
       rather than texture. The rest of the watercolour is the opacity:
       being able to see one stroke through another is the actual tell. */
    dry(grit*.2, 1/(sw*3.2), 1/(sw*2.6), 23)+
    `<feComposite in="body" in2="d1" operator="in"/>`,

  /* two passes over the same line at different wobbles — sometimes they
     land together and sometimes they separate, which is what a sketch is.
     No nib and no voids, so it can never be mistaken for `brush`. */
  rough:(sw)=>
    `<feTurbulence type="fractalNoise" baseFrequency="${(1/(sw*13)).toFixed(3)}" numOctaves="3" seed="5" result="r1"/>`+
    `<feDisplacementMap in="SourceGraphic" in2="r1" scale="${(1.5*sw).toFixed(2)}" result="w1"/>`+
    `<feTurbulence type="fractalNoise" baseFrequency="${(1/(sw*8)).toFixed(3)}" numOctaves="2" seed="21" result="r2"/>`+
    `<feDisplacementMap in="SourceGraphic" in2="r2" scale="${(2.1*sw).toFixed(2)}" result="w2"/>`+
    `<feMerge><feMergeNode in="w2"/><feMergeNode in="w1"/></feMerge>`,

  /* graphite: a short nervous waver, then the tooth of the paper eating
     into it in fine grain rather than in skids */
  pencil:(sw,grit)=>
    `<feTurbulence type="fractalNoise" baseFrequency="${(1/(sw*1.4)).toFixed(3)}" numOctaves="2" seed="3" result="n"/>`+
    `<feDisplacementMap in="SourceGraphic" in2="n" scale="${(.42*sw).toFixed(2)}" result="d"/>`+
    dry(grit*.8, 1/(sw*.62), 1/(sw*.55), 17)+
    `<feComposite in="d" in2="d1" operator="in"/>`,
};
/* write (or rewrite) one glyph's filter and hand back the url for it.
   style() is also what runs on every colour tick and every frame of the
   width drag, and re-parsing a turbulence filter that has not changed is
   pure waste — so the recipe is signed and skipped when it matches. */
const fxSig = {};
function brushFilter(id, kind, sw, strokePx){
  const make = RECIPE[kind];
  if(!make || !(sw>0)) return '';
  const grit = Math.max(0, Math.min(1, (strokePx-2.2)/4.5));
  const sig = `${kind}|${sw.toFixed(3)}|${grit.toFixed(3)}`;
  if(fxSig[id]===sig && document.getElementById(id)) return `url(#${id})`;
  fxSig[id]=sig;
  let f = document.getElementById(id);
  if(!f){
    f = document.createElementNS('http://www.w3.org/2000/svg','filter');
    f.setAttribute('id', id);
    document.getElementById('fdefs').appendChild(f);
  }
  f.setAttribute('filterUnits','userSpaceOnUse');
  f.setAttribute('x',-70); f.setAttribute('y',-70);
  f.setAttribute('width',420); f.setAttribute('height',280);
  f.innerHTML = make(sw, grit);
  return `url(#${id})`;
}
const COLORS = [
  ['cinnabar','#b73a2b'], ['rust','#a2552a'], ['honey','#b8862d'],
  ['pine','#47694e'],     ['teal','#2f6f72'], ['indigo','#4b3fd4'],
  ['lilac','#7a6bbf'],    ['plum','#7d3a5c'], ['slate','#4a5a68'],
  ['ink','#3f3931'],
];

/* hand-drawn lopsided heart; closes exactly on itself so the erase
   can start anywhere on the loop and wrap the seam invisibly */
const D_HEART = (()=>{
  const c=[[50,83],
    [45,78],[34,70.5],[26,61],
    [17.5,51],[12,41],[12.8,32],
    [13.6,20],[21,12],[30.5,12.6],
    [38.5,13.2],[45,18],[48.6,25.5],
    [51,19.5],[54.5,14],[60,11.8],
    [68,8.8],[79,12],[84.6,20],
    [89,26.5],[88,35],[83.5,43.5],
    [77,54.5],[66,66],[57.5,74],
    [54.5,77.5],[52,80.5],[50,83]];
  const p=c.map(([x,y])=>`${x} ${y}`);
  let d=`M${p[0]}`;
  for(let i=1;i<p.length;i+=3) d+=` C${p[i]}, ${p[i+1]}, ${p[i+2]}`;
  return d;
})();

/* hanzi: the real kai skeleton, from hanzi-writer's stroke medians —
   every stroke as written, with the pen hopping between them. */
function mediansToPath(medians){
  const M = pt => [pt[0]*100/1024, (900-pt[1])*100/1024];
  let d='', pen=null;
  medians.forEach((med,i)=>{
    const pts = med.map(M);
    /* the pen lifts between strokes, exactly as a hand does */
    d += `${i?' M':'M'}${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for(let j=1;j<pts.length-1;j++){
      const mx=(pts[j][0]+pts[j+1][0])/2, my=(pts[j][1]+pts[j+1][1])/2;
      d += ` Q${pts[j][0].toFixed(1)} ${pts[j][1].toFixed(1)}, ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    const last=pts[pts.length-1];
    d += ` L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
    pen=last;
  });
  return d;
}

/* ════ the writing hand: Hershey Script ════
   A real single-stroke script — cut for pen plotters in 1967, so its
   glyphs ARE centrelines rather than outlines. That is exactly what this
   animation needs, and a far better hand than beziers drawn by eye.
   Its own metrics: baseline 22, x-height top 13, ascender 1, descender 34,
   advance = o × 1.68; mapped here onto this file's band (x-height 44–56,
   baseline 56). i and j carry their own dots, t its own crossbar. */
const HERSHEY={a:{d:"M9,16 L8,14 6,13 4,13 2,14 1,15 0,17 0,19 1,21 3,22 5,22 7,21 8,19 10,13 9,18 9,21 10,22 11,22 13,21 14,20 16,17",o:10},b:{d:"M0,17 L2,14 5,9 6,7 7,4 7,2 6,1 4,2 3,4 2,8 1,15 1,21 2,22 3,22 5,21 7,19 8,16 8,13 9,17 10,18 12,18 14,17",o:9},c:{d:"M7,15 L7,14 6,13 4,13 2,14 1,15 0,17 0,19 1,21 3,22 6,22 9,20 11,17",o:6},d:{d:"M9,16 L8,14 6,13 4,13 2,14 1,15 0,17 0,19 1,21 3,22 5,22 7,21 8,19 14,1 M10,13 L9,18 9,21 10,22 11,22 13,21 14,20 16,17",o:10},e:{d:"M1,20 L3,19 4,18 5,16 5,14 4,13 3,13 1,14 0,16 0,19 1,21 3,22 5,22 7,21 8,20 10,17",o:6},f:{d:"M0,17 L4,12 6,9 7,7 8,4 8,2 7,1 5,2 4,4 2,12 -1,21 -4,28 -5,31 -5,33 -4,34 -2,33 -1,30 0,21 1,22 3,22 5,21 6,20 8,17",o:5},g:{d:"M9,16 L8,14 6,13 4,13 2,14 1,15 0,17 0,19 1,21 3,22 5,22 7,21 8,20 M10,13 L8,20 4,31 3,33 1,34 0,33 0,31 1,28 4,25 7,23 9,22 12,20 15,17",o:9},h:{d:"M0,17 L2,14 5,9 6,7 7,4 7,2 6,1 4,2 3,4 2,8 1,14 0,22 M0,22 L1,19 2,17 4,14 6,13 8,13 9,14 9,16 8,19 8,21 9,22 10,22 12,21 13,20 15,17",o:10},i:{d:"M3,8 L3,9 4,9 4,8 3,8 M0,17 L2,13 0,19 0,21 1,22 2,22 4,21 5,20 7,17",o:5},j:{d:"M3,8 L3,9 4,9 4,8 3,8 M0,17 L2,13 -4,31 -5,33 -7,34 -8,33 -8,31 -7,28 -4,25 -1,23 1,22 4,20 7,17",o:5},k:{d:"M0,17 L2,14 5,9 6,7 7,4 7,2 6,1 4,2 3,4 2,8 1,14 0,22 M0,22 L1,19 2,17 4,14 6,13 8,13 9,14 9,16 7,17 4,17 M4,17 L6,18 7,21 8,22 9,22 11,21 12,20 14,17",o:9},l:{d:"M0,17 L2,14 5,9 6,7 7,4 7,2 6,1 4,2 3,4 2,8 1,15 1,21 2,22 3,22 5,21 6,20 8,17",o:5},m:{d:"M0,17 L2,14 4,13 5,14 5,15 4,19 3,22 M4,19 L5,17 7,14 9,13 11,13 12,14 12,15 11,19 10,22 M11,19 L12,17 14,14 16,13 18,13 19,14 19,16 18,19 18,21 19,22 20,22 22,21 23,20 25,17",o:12},n:{d:"M0,17 L2,14 4,13 5,14 5,15 4,19 3,22 M4,19 L5,17 7,14 9,13 11,13 12,14 12,16 11,19 11,21 12,22 13,22 15,21 16,20 18,17",o:10},o:{d:"M6,13 L4,13 2,14 1,15 0,17 0,19 1,21 3,22 5,22 7,21 8,20 9,18 9,16 8,14 6,13 5,14 5,16 6,18 8,19 11,19 13,18 14,17",o:8},p:{d:"M0,17 L2,14 3,12 2,16 -4,34 M2,16 L3,14 5,13 7,13 9,14 10,16 10,18 9,20 8,21 6,22 M2,21 L4,22 7,22 10,21 12,20 15,17",o:8},q:{d:"M9,16 L8,14 6,13 4,13 2,14 1,15 0,17 0,19 1,21 3,22 5,22 7,21 M10,13 L9,16 7,21 4,28 3,31 3,33 4,34 6,33 7,30 7,23 9,22 12,20 15,17",o:9},r:{d:"M0,17 L2,14 3,12 3,14 6,14 7,15 7,17 6,20 6,21 7,22 8,22 10,21 11,20 13,17",o:8},s:{d:"M0,17 L2,14 3,12 3,14 5,17 6,19 6,21 4,22 M0,21 L2,22 6,22 8,21 9,20 11,17",o:7},t:{d:"M0,17 L2,14 4,10 M7,1 L1,19 1,21 2,22 4,22 6,21 7,20 9,17 M1,9 L8,9",o:6},u:{d:"M0,17 L2,13 0,19 0,21 1,22 3,22 5,21 7,19 9,16 M10,13 L8,19 8,21 9,22 10,22 12,21 13,20 15,17",o:9},v:{d:"M0,17 L2,13 1,18 1,21 2,22 3,22 6,21 8,19 9,16 9,13 M9,13 L10,17 11,18 13,18 15,17",o:9},w:{d:"M3,13 L1,15 0,18 0,20 1,22 3,22 5,21 7,19 M9,13 L7,19 7,21 8,22 10,22 12,21 14,19 15,16 15,13 M15,13 L16,17 17,18 19,18 21,17",o:12},x:{d:"M0,17 L2,14 4,13 6,13 7,14 7,21 8,22 11,22 14,20 16,17 M13,14 L12,13 10,13 9,14 5,21 4,22 2,22 1,21",o:8},y:{d:"M0,17 L2,13 0,19 0,21 1,22 3,22 5,21 7,19 9,16 M10,13 L4,31 3,33 1,34 0,33 0,31 1,28 4,25 7,23 9,22 12,20 15,17",o:9},z:{d:"M0,17 L2,14 4,13 6,13 8,15 8,17 7,19 5,21 2,22 4,23 5,25 5,28 4,31 3,33 1,34 0,33 0,31 1,28 4,25 7,23 11,20 14,17",o:8}};
/* Hershey's glyphs are POLYLINES — a plotter drives them as a run of short
   straight moves, and blown up on screen every one of those vertices reads
   as a little stop in the hand. That is the whole of the "一顿一顿": not the
   brush, the geometry. The points are re-fitted here as CENTRIPETAL
   Catmull-Rom splines — same points, but arrived at and left on a curve.
   Centripetal (α=.5) and not the uniform variant, because it is the one
   that provably cannot loop or cusp where two points sit close together,
   which is exactly what happens at the tip of every loop in a script hand.
   The output keeps Hershey's own `x,y` pair format so hersheyAt() can go
   on rewriting coordinates with one regex. */
function crSpline(pts){
  const P=[];
  for(const p of pts){                       /* a repeated point is a divide-by-zero */
    const q=P[P.length-1];
    if(!q || Math.hypot(p[0]-q[0], p[1]-q[1])>1e-4) P.push(p);
  }
  const f=n=>+n.toFixed(2);
  if(P.length<2) return `M${f(P[0][0])},${f(P[0][1])}`;
  if(P.length===2) return `M${f(P[0][0])},${f(P[0][1])} L${f(P[1][0])},${f(P[1][1])}`;
  const mirror=(a,b)=>[2*a[0]-b[0], 2*a[1]-b[1]];    /* a natural tangent at the ends */
  const knot=(a,b)=>Math.sqrt(Math.hypot(b[0]-a[0], b[1]-a[1]))||1e-4;
  let out=`M${f(P[0][0])},${f(P[0][1])}`;
  for(let i=0;i<P.length-1;i++){
    const p0=P[i-1] || mirror(P[0],P[1]);
    const p1=P[i], p2=P[i+1];
    const p3=P[i+2] || mirror(P[P.length-1],P[P.length-2]);
    const d1=knot(p0,p1), d2=knot(p1,p2), d3=knot(p2,p3);
    const b=[0,1].map(a=>[
      (d1*d1*p2[a] - d2*d2*p0[a] + (2*d1*d1 + 3*d1*d2 + d2*d2)*p1[a]) / (3*d1*(d1+d2)),
      (d3*d3*p1[a] - d2*d2*p3[a] + (2*d3*d3 + 3*d3*d2 + d2*d2)*p2[a]) / (3*d3*(d3+d2)),
    ]);
    out+=` C${f(b[0][0])},${f(b[1][0])} ${f(b[0][1])},${f(b[1][1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return out;
}
Object.values(HERSHEY).forEach(g=>{
  g.d = g.d.split(/(?=M)/).map(sub=>{
    const n = sub.match(/-?\d+\.?\d*/g);
    if(!n || n.length<2) return '';
    const pts=[];
    for(let i=0;i+1<n.length;i+=2) pts.push([+n[i], +n[i+1]]);
    return crSpline(pts);
  }).filter(Boolean).join(' ');
});
const H_SCALE = 12/9;                    /* match its x-height to ours */
const H_BASE = 22, OUR_BASE = 56;
function hersheyAt(g, x){
  return g.d.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, (_,gx,gy)=>
    `${(x + (+gx)*H_SCALE).toFixed(1)},${(OUR_BASE + ((+gy)-H_BASE)*H_SCALE).toFixed(1)}`);
}
/* accented letters borrow the base glyph and add a mark */
const BASE = {'á':'a','ä':'a','å':'a','à':'a','â':'a','ć':'c','č':'c','ç':'c',
  'é':'e','ê':'e','ě':'e','ė':'e','è':'e','í':'i','î':'i','ł':'l','ñ':'n','ń':'n',
  'ó':'o','ö':'o','ô':'o','ø':'o','ś':'s','š':'s','ş':'s','ť':'t','ú':'u','ü':'u',
  'ů':'u','ý':'y','ź':'z','ż':'z','ž':'z'};
const ACCENT = {'á':'acute','ć':'acute','é':'acute','í':'acute','ń':'acute','ó':'acute',
  'ś':'acute','ú':'acute','ý':'acute','ź':'acute',
  'ä':'uml','ë':'uml','ö':'uml','ü':'uml',
  'â':'circ','ê':'circ','î':'circ','ô':'circ',
  'č':'caron','ě':'caron','š':'caron','ž':'caron','ť':'caron',
  'ç':'ced','ş':'ced','ł':'slash','å':'ring','ė':'dot','ż':'dot','ø':'slash','ů':'ring'};
const MARK = {
  dot:  (x,w)=>` M${(x+w*.42).toFixed(1)} 34 L${(x+w*.53).toFixed(1)} 34.7`,
  acute:(x,w)=>` M${(x+w*.28).toFixed(1)} 36 L${(x+w*.56).toFixed(1)} 31`,
  uml:  (x,w)=>` M${(x+w*.20).toFixed(1)} 34 L${(x+w*.28).toFixed(1)} 34.6`+
               ` M${(x+w*.54).toFixed(1)} 34 L${(x+w*.62).toFixed(1)} 34.6`,
  circ: (x,w)=>` M${(x+w*.18).toFixed(1)} 35 L${(x+w*.40).toFixed(1)} 30`+
               ` L${(x+w*.62).toFixed(1)} 35`,
  caron:(x,w)=>` M${(x+w*.18).toFixed(1)} 30 L${(x+w*.40).toFixed(1)} 35`+
               ` L${(x+w*.62).toFixed(1)} 30`,
  ced:  (x,w)=>` M${(x+w*.42).toFixed(1)} 58 C${(x+w*.42).toFixed(1)} 62, ${(x+w*.22).toFixed(1)} 64, ${(x+w*.10).toFixed(1)} 62`,
  slash:(x,w)=>` M${(x-1).toFixed(1)} 36 L${(x+w*.80).toFixed(1)} 30`,
  ring: (x,w)=>` M${(x+w*.32).toFixed(1)} 34 C${(x+w*.52).toFixed(1)} 32, ${(x+w*.52).toFixed(1)} 29, ${(x+w*.34).toFixed(1)} 29.5`+
               ` C${(x+w*.20).toFixed(1)} 30, ${(x+w*.22).toFixed(1)} 33.5, ${(x+w*.32).toFixed(1)} 34`,
};
/* lay a word out; diacritics trail at the end, dotted last as a hand does */
function cursive(str){
  let x=8, d='';
  const marks=[];
  for(const c of str){
    const g = HERSHEY[BASE[c] || c];
    if(!g) continue;
    const w = g.o*1.68*H_SCALE;
    d += (d?' ':'') + hersheyAt(g, x);
    const acc = ACCENT[c];
    if(acc && MARK[acc]) marks.push(MARK[acc](x, w));
    x += w;
  }
  return {d: d + marks.join(''), vw: x+8};
}

/* ελληνικά αγάπη — α γ ά π η, with the tonos and π's legs as pen lifts */
const D_AGAPI =
  "M30 45 C24 43, 17 47, 17 53 C17 59, 24 61, 28 56"+    /* α: the bowl */
  " C30 53, 30 49, 29 45 C29 51, 30 57, 33 59"+
  " C35 60, 37 59, 39 57"+
  " M44 45 C46 51, 49 56, 52 59 C55 54, 58 48, 60 44"+   /* γ: the v */
  " C59 52, 57 63, 54 69 C52 73, 48 72, 47 68"+          /* γ: the tail */
  " M79 45 C73 43, 66 47, 66 53 C66 59, 73 61, 77 56"+   /* ά: the bowl */
  " C79 53, 79 49, 78 45 C78 51, 79 57, 82 59"+
  " C84 60, 86 59, 88 57"+
  " M72 34 C74 32, 76 31, 78 30"+                        /* ά: the tonos */
  " M93 46 C101 46, 110 46, 118 46"+                     /* π: the bar */
  " M99 46 C99 51, 98 56, 97 61"+                        /* π: left leg */
  " M112 46 C112 51, 113 56, 114 61"+                    /* π: right leg */
  " M123 46 C123 51, 123 56, 123 61"+                    /* η: left stem */
  " M123 50 C125 46, 129 44, 132 45 C135 46, 136 49, 136 53"+  /* η: shoulder */
  " C136 59, 135 66, 134 71 C133 74, 130 74, 129 71";    /* η: descender */

/* 한국어 사랑 — built from real jamo on the standard block grid rather
   than sketched freehand: 사 = ㅅ+ㅏ side by side, 랑 = ㄹ+ㅏ over a
   full-width ㅇ. Every jamo is its own stroke, so the pen lifts between
   them exactly as a hand does. */
const D_SARANG =
  /* 사 */
  "M28 23 C23 34, 16 47, 8 59"+                  /* ㅅ: the long left fall */
  " M22 35 C27 43, 34 51, 42 59"+                /* ㅅ: the right kick */
  " M52 18 L52 64"+                              /* ㅏ: stem */
  " M52 41 L64 41"+                              /* ㅏ: tick */
  /* 랑 */
  " M74 19 L96 19 L96 29 L74 29 L74 39 L97 39"+  /* ㄹ: the three bars */
  " M107 17 L107 47"+                            /* ㅏ: stem */
  " M107 31 L119 31"+                            /* ㅏ: tick */
  " M92 51 C100 51, 106 56, 106 62"+             /* ㅇ: the ring below */
  " C106 69, 100 74, 92 74 C84 74, 78 69, 78 62"+
  " C78 56, 84 51, 92 51";
/* türkçe aşk — the good 'a', an s with its cedilla, then a looped k */
/* arabic حب — natively one line, written right-to-left; dot below at the end */
const D_HUBB =
  "M116 38"+
  " C111 31, 100 30, 94 36 C91 39, 93 43, 97 42"+
  " C92 47, 84 52, 75 54 C62 56.5, 48 56, 40 52"+
  " C34 49, 33 44, 38 41"+
  " M76 64 c.4 .2, .6 .4, .2 .6";

/* every shape in the pool — the heart is simply one of them */

/* every shape in the pool — one word per language, plus the heart itself.
   Latin-script words all come out of the same cursive hand above; CJK
   rides hanzi-writer's real kai skeletons; the rest are drawn by hand. */
const WORDS = [
  ['en','english',    'love'],
  ['es','español',    'amor'],
  ['fr','français',   'amour'],
  ['it','italiano',   'amore'],
  ['de','deutsch',    'liebe'],
  ['nl','nederlands', 'liefde'],
  ['sv','svenska',    'kärlek'],
  ['da','dansk',      'elskov'],
  ['pl','polski',     'miłość'],
  ['cs','čeština',    'láska'],
  ['ro','română',     'iubire'],
  ['hr','hrvatski',   'ljubav'],
  ['lt','lietuvių',   'meilė'],
  ['fi','suomi',      'rakkaus'],
  ['hu','magyar',     'szerelem'],
  ['id','bahasa',     'cinta'],
  ['sw','kiswahili',  'upendo'],
  ['vi','tiếng việt', 'yêu'],
  ['tr','türkçe',     'aşk'],
];
const GLYPHS = [
  {id:'heart', label:'♡',            type:'path',  d:D_HEART,  vw:100, baseY:83, centerY:43},
  {id:'zh',    label:'中文 · 爱',     type:'hanzi', char:'爱',  vw:100, baseY:87},
  {id:'ja',    label:'日本語 · 愛',   type:'hanzi', char:'愛',  vw:100, baseY:87},
  /* band = the writing band this hand occupies (ascender 15 → descender 74),
     shared by every word so they all render at one size */
  ...WORDS.map(([id,lang,w])=>{
    const c = cursive(w);
    /* baseY = where this hand's baseline sits, so 'upendo' can drop its p
       below the line instead of being shoved up to sit on it */
    /* The band normalises size across words — its absolute value is what
       sets how large the hand writes. 34 rendered a word's x-height at only
       76% of the surrounding text's, which reads as "sitting low" even when
       the baseline is exact; 26 brings the two into parity. */
    return {id, label:`${lang} · ${w}`, type:'path', d:c.d, vw:c.vw, band:[26,26], baseY:OUR_BASE};
  }),
  {id:'el',    label:'ελληνικά · αγάπη', type:'path', d:D_AGAPI,  vw:150, baseY:60},
  {id:'ko',    label:'한국어 · 사랑',     type:'path', d:D_SARANG, vw:130, baseY:74},
  {id:'ar',    label:'العربية · حب',     type:'path', d:D_HUBB,   vw:130, baseY:55},
];
const G = id => GLYPHS.find(g=>g.id===id);
const FORMULA = { from:'heart', to:'zh' };

const dCache = {}, bbCache = {};
/* A word only occupies a band of the 100-tall box while a hanzi fills it.
   Measure each glyph once so thumbnails can crop to the ink instead of
   squashing a word into a sliver, and so stroke weight can be corrected
   for the very different scale factors that follow. */
function bboxOf(id, d){
  if(bbCache[id]) return bbCache[id];
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg'), p=document.createElementNS(ns,'path');
  svg.setAttribute('width',0); svg.setAttribute('height',0);
  p.setAttribute('d',d); svg.appendChild(p); document.body.appendChild(svg);
  const b=p.getBBox(); svg.remove();
  const pad=4;
  return bbCache[id]={x:b.x-pad, y:b.y-pad, w:b.width+pad*2, h:b.height+pad*2};
}
/* One <svg> cropped horizontally to a glyph's ink, but scaled against a
   FIXED vertical band. Scaling by the ink's own height would blow up a
   word with no ascenders ("amour") to four times the size of one with
   them ("szerelem"); a shared band keeps every hand the same size and
   lets width follow letter count, as it should. */
function thumb(g, d, px, strokePx){
  const b=bboxOf(g.id,d);
  /* the band fixes the SIZE so every hand matches; the window is then
     centred on the ink, or a word with ascenders rides high in its box */
  const bh=g.band?g.band[1]:b.h;
  const by=g.band? b.y+b.h/2-bh/2 : b.y;
  const h=px, w=px*b.w/bh;
  const sw=(strokePx*bh/px).toFixed(2);      /* keep the line visually even */
  return `<svg width="${w.toFixed(1)}" height="${h}" viewBox="${b.x.toFixed(1)} ${by.toFixed(1)} ${b.w.toFixed(1)} ${bh.toFixed(1)}">`+
         `<path d="${d}" style="stroke-width:${sw}"></path></svg>`;
}

function glyphPath(g){
  if(dCache[g.id]) return Promise.resolve(dCache[g.id]);
  if(g.type==='path'){ dCache[g.id]=g.d; return Promise.resolve(g.d); }
  return HanziWriter.loadCharacterData(g.char).then(data=>{
    const d=mediansToPath(data.medians); dCache[g.id]=d; return d;
  });
}

/* ── driving a sequence of strokes as if it were one line ── */
function seqPoint(parts, g){
  for(const o of parts) if(g<=o.start+o.len) return o.el.getPointAtLength(Math.max(0,g-o.start));
  const last=parts[parts.length-1];
  return last.el.getPointAtLength(last.len);
}
/* ink the first `len` units of the sequence and nothing after it */
function drawUpTo(parts, len){
  parts.forEach(o=>{
    const drawn=Math.min(o.len, Math.max(0, len-o.start));
    o.el.style.strokeDasharray=`${drawn.toFixed(2)} ${(o.len+1).toFixed(2)}`;
    o.el.style.strokeDashoffset=0;
    o.el.style.visibility=drawn>0.01?'visible':'hidden';
  });
}
/* the pen has eaten the first `len` units; keep only what is still ahead */
function eraseUpTo(parts, len){
  parts.forEach(o=>{
    const gone=Math.min(o.len, Math.max(0, len-o.start));
    o.el.style.strokeDasharray=`${o.len.toFixed(2)}`;
    o.el.style.strokeDashoffset=(-gone).toFixed(2);
    o.el.style.visibility=gone<o.len-0.01?'visible':'hidden';
  });
}
function showAll(parts, on){ parts.forEach(o=>{
  o.el.style.strokeDasharray='none'; o.el.style.strokeDashoffset=0;
  o.el.style.visibility=on?'visible':'hidden';
}); }

let spotN=0;
function makeSpot(mount, size, sitOnBaseline, maxWidth){
  const spot=document.createElement('span');
  spot.className='spot idle';
  mount.appendChild(spot);
  const S={el:spot, size, uid:++spotN, h:size};

  /* Both glyphs live in one svg. Each is SCALED to the same writing size
     and centred on the same point, so a short word and a dense hanzi read
     at one weight — and the stroke is divided back out by that scale so
     the line has the thickness you asked for whatever is on screen. */
  const FILL = 74;          /* how much of the 100-unit box a glyph fills */
  /* where a baseline-anchored glyph puts its baseline in that box — see
     place(). The value only decides how much of the box sits above the
     line; the mark's position on the page is set by the offset that
     follows from it. 68 is about where a word already sat. */
  const SIT_BASE = 68;
  S.build=(fromD, toD)=>{
    /* One <path> PER STROKE. stroke-dasharray restarts at every subpath,
       so a single path with pen-lifts cannot carry one sliding window —
       every stroke would grow at once and the pen would sit nowhere near
       the ink. Each stroke gets its own dash window instead. */
    const parts=d=>d.split(/(?=M)/).map(x=>x.trim()).filter(Boolean);
    const fSubs=parts(fromD), tSubs=parts(toD);
    spot.innerHTML=
      `<svg viewBox="0 0 100 100">
         <g class="gf">${fSubs.map(x=>`<path class="pf" d="${x}"></path>`).join('')}</g>
         <path class="pg" d="M0 0" style="visibility:hidden"></path>
         <g class="gt">${tSubs.map(x=>`<path class="pt" d="${x}"></path>`).join('')}</g>
         <circle class="tip" style="visibility:hidden"></circle>
       </svg>`;
    const measure=sel=>{
      let at=0;
      return [...spot.querySelectorAll(sel)].map(el=>{
        const len=el.getTotalLength(), o={el, len, start:at}; at+=len; return o;
      });
    };
    S.fp=measure('.pf'); S.tp=measure('.pt');
    S.pf=S.fp[0].el; S.pt=S.tp[0].el;            /* for measuring and export */
    S.pg=spot.querySelector('.pg'); S.dot=spot.querySelector('.tip');
    /* measure both, then size the box to whichever ends up wider */
    const fit=(group,glyph)=>{
      const bb=group.getBBox();
      const h=glyph.band?glyph.band[1]:bb.height;   /* scale from the band */
      /* Centre on the ink — unless the glyph declares an optical centre.
         The heart's stroke-mass sits 5.7 units above its box centre (two
         heavy lobes over one thin tip), so box-centred it floats ~14px
         high at preview size. centerY is the measured centroid/box-centre
         compromise: full centroid centring pushes the tip too low. */
      const cy=glyph.centerY!=null ? glyph.centerY : bb.y+bb.height/2;
      const k=FILL/h;
      return {k, cx:bb.x+bb.width/2, cy, w:bb.width*k};
    };
    S.f=fit(spot.querySelector('.gf'), G(FORMULA.from));
    S.t=fit(spot.querySelector('.gt'), G(FORMULA.to));
    const vw=Math.max(100, S.f.w+16, S.t.w+16);
    spot.querySelector('svg').setAttribute('viewBox',`0 0 ${vw.toFixed(1)} 100`);
    /* Set into a line of text, the two glyphs must share a BASELINE — not an
       optical centre. Centring each on its own ink left the heart's baseline
       about 20 box units below a word's, so the mark HOPPED by 3.1px (on a
       17px mark) the instant the writing began, and the finished word never
       sat where the resting heart had. Spreading that jump over the lifted
       glide was not enough either: the eased clock races through the middle
       and only ~3 frames of 132 land there, so it stayed a 1px-per-frame
       lurch. Anchoring the baseline removes the difference instead of hiding
       it, and both offsets come out identical.
       The big preview is not set in text, so it keeps the optical centring
       that makes it look balanced in its own box. */
    const place=(o,g,glyph)=>{
      o.ox=vw/2;
      o.oy=(sitOnBaseline && glyph.baseY!=null) ? SIT_BASE - o.k*(glyph.baseY-o.cy) : 50;
      g.setAttribute('transform',
        `translate(${o.ox.toFixed(2)} ${o.oy.toFixed(2)}) scale(${o.k.toFixed(4)}) translate(${(-o.cx).toFixed(2)} ${(-o.cy).toFixed(2)})`);
    };
    place(S.f, spot.querySelector('.gf'), G(FORMULA.from));
    place(S.t, spot.querySelector('.gt'), G(FORMULA.to));
    /* the big mark's size follows the room it has been left, so it is asked
       for on every build rather than fixed when the spot was made */
    const px = typeof size==='function' ? size() : size;
    let w=px*vw/100, h=px;
    if(maxWidth){                      /* a long word must not slide under the card */
      const cap=maxWidth();
      if(w>cap){ h=px*cap/w; w=cap; }
    }
    spot.style.width=w+'px'; spot.style.height=h+'px';
    spot.querySelector('svg').setAttribute('width',w);
    spot.querySelector('svg').setAttribute('height',h);
    S.h=h;                       /* the box is 100 tall, so h/100 px per unit */
    /* a point in a glyph's own coordinates → the shared box */
    S.map=(o,pt)=>({x:o.ox+o.k*(pt.x-o.cx), y:o.oy+o.k*(pt.y-o.cy)});
    S.Lf=S.fp.reduce((n,o)=>n+o.len,0);
    S.Lt=S.tp.reduce((n,o)=>n+o.len,0);
    /* a single closed stroke can be unwound from any point; anything else
       unwinds from its start. Either way the pen eats the line forward. */
    const a=S.pf.getPointAtLength(0), b=S.pf.getPointAtLength(S.fp[0].len);
    S.loop=S.fp.length===1 && Math.hypot(a.x-b.x, a.y-b.y)<1.5;
    const start=S.map(S.t, seqPoint(S.tp,0));
    let best=0;
    if(S.loop){                       /* start nearest the next entry — no dead gap */
      let bd=Infinity;
      for(let l=0;l<S.Lf;l+=S.Lf/200){
        const q=S.map(S.f, seqPoint(S.fp,l));
        const dd=(q.x-start.x)**2+(q.y-start.y)**2;
        if(dd<bd){bd=dd;best=l;}
      }
    }
    S.s0=best;
    const hp=S.map(S.f, seqPoint(S.fp,best));
    const mx=(hp.x+start.x)/2+(start.y-hp.y)*.25, my=(hp.y+start.y)/2+(hp.x-start.x)*.25;
    S.pg.setAttribute('d',`M${hp.x.toFixed(1)} ${hp.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)}, ${start.x.toFixed(1)} ${start.y.toFixed(1)}`);
    S.Lg=S.pg.getTotalLength();
    S.LT=S.Lf+S.Lg+S.Lt;
    S.style();
    S.setProgress(CTRL.p);
    /* Set into a line of text, the mark must SIT ON THE BASELINE like any
       other character. vertical-align:middle centres it on the lowercase
       band instead, which leaves a tall glyph hanging below the line. */
    if(sitOnBaseline){
      /* Set into a line of text the mark must sit on the BASELINE like any
         other character — and on the baseline of whichever glyph is showing.
         Aligning by the FROM glyph only was wrong the moment the animation
         finished and the TO glyph took its place; and falling back to the
         ink's lowest point shoved anything with a descender (αγάπη, حب)
         upward by the depth of that descender.
         The answer is a PIXEL offset, and the line it is measured against
         moves — so this has to stay re-runnable, see S.align below. */
      S.sits = true;
      /* `which` is 'from', 'to', or a raw px value part-way between the two */
      S.sit = which=>{
        S.at = which;
        spot.style.verticalAlign = typeof which==='number'
          ? which.toFixed(2)+'px'
          : (which==='to' ? S.alignTo : S.alignFrom);
      };
      /* the two glyphs almost never share a baseline offset — a heart's
         baseline sits at 83 in its own box, a word's at 56 — so switching
         between them is a JUMP, measured at 3.1px on a 17px mark. See
         setProgress: it is spread across the lifted glide, the one stretch
         where there is no ink on the line to give the movement away. */
      S.between = u=>{
        const a=parseFloat(S.alignFrom), b=parseFloat(S.alignTo);
        S.sit(isFinite(a)&&isFinite(b) ? a+(b-a)*Math.min(1,Math.max(0,u)) : 'to');
      };
      S.align = ()=>{
        spot.style.verticalAlign='baseline';
        const box=spot.getBoundingClientRect();
        /* A letter in the surrounding text is an OUTLINE — its bottom edge
           IS the baseline. This mark is a CENTRELINE, and the stroke goes on
           half a width past it, so putting the centreline on the baseline
           hangs the ink below the line: measured at 0.43px on a 17px mark,
           which is 3px once you look at it enlarged, and reads as the mark
           sitting low. Sit the INK on the line instead.
           (Beware: getBoundingClientRect() on the <g> returns the GEOMETRY
           box — no stroke — so it cannot show you this. It is what made the
           earlier reading look like 0.10px and clean.)
           The stroke is P.width*mul in box units, whatever the glyph's own
           scale, so this is also why style() re-runs align(). */
        const half = P.width*BRUSHES[P.brush].mul*(box.height/100)/2;
        const offset=(o, glyph, group)=>{
          const base = glyph.baseY!=null
            ? box.top + box.height*(o.oy + o.k*(glyph.baseY-o.cy))/100 + half
            : spot.querySelector(group).getBoundingClientRect().bottom;
          return (base-box.bottom).toFixed(2)+'px';
        };
        S.alignFrom = box.height ? offset(S.f, G(FORMULA.from), '.gf') : '';
        S.alignTo   = box.height ? offset(S.t, G(FORMULA.to),   '.gt') : '';
        S.sit(S.at || 'from');
      };
      S.align();
    }
  };
  S.style=()=>{
    if(!S.fp) return;
    const b=BRUSHES[P.brush];
    /* what the line covers on SCREEN — the same for both glyphs, since the
       scale that is divided out below is the same one that puts them there */
    const strokePx=P.width*b.mul*(S.h/100);
    S.fx={};
    /* divide the stroke back out by each glyph's scale so both read
       at the width the slider actually says */
    [[S.fp,S.f,'f'],[S.tp,S.t,'t']].forEach(([parts,o,tag])=>{
      const sw=P.width*b.mul/(o?o.k:1);            /* the line in glyph units */
      const id=`fx-${S.uid}-${tag}`;
      const url=brushFilter(id, P.brush, sw, strokePx);
      S.fx[tag]=url?id:null;                       /* the export borrows these */
      parts.forEach(({el})=>{
        el.style.stroke=P.color;
        el.style.strokeWidth=sw;
        el.style.strokeLinecap=b.cap;
        el.style.opacity=b.op;
        el.style.filter=url;
      });
    });
    S.dot.style.fill=P.color;
    S.dot.style.opacity=b.op;
    S.dot.setAttribute('r',Math.max(1.2,P.width*b.mul*.55));
    /* how far the ink reaches past the centreline is half the line, so the
       line's width and the brush's weight both move where the mark sits */
    if(S.align) S.align();
  };
  const dotAt=(parts,len,o)=>{
    const q=S.map(o, seqPoint(parts,len));
    S.dot.setAttribute('cx',q.x); S.dot.setAttribute('cy',q.y);
  };
  S.setProgress=p=>{
    p=Math.min(1,Math.max(0,p));
    if(REDUCED.matches){
      /* reduced motion: no travelling pen, just one glyph resolving into
         the other — comprehension kept, movement dropped */
      S.dot.style.visibility='hidden';
      showAll(S.fp,true); showAll(S.tp,true);
      if(S.sits) S.between(p);      /* both glyphs are on the line at once; ride between their baselines */
      const b=BRUSHES[P.brush].op;
      S.fp.forEach(o=>o.el.style.opacity=(1-p)*b);
      S.tp.forEach(o=>o.el.style.opacity=p*b);
      return;
    }
    S.dot.style.visibility=(p<=0||p>=1)?'hidden':'visible';
    const q=ez(p)*S.LT;
    if(q<S.Lf){                                    /* 1 · unwinding the FROM glyph */
      if(S.sits && S.at!=='from') S.sit('from');
      showAll(S.tp,false);
      if(S.loop){        /* one closed stroke: the window wraps the seam */
        const el=S.fp[0].el, L=S.fp[0].len;
        el.style.visibility='visible';
        el.style.strokeDasharray=`${Math.max(.005,L-q)} ${Math.max(.005,q)}`;
        el.style.strokeDashoffset=-(S.s0+q);
        dotAt(S.fp,(S.s0+q)%L,S.f);
      } else {
        eraseUpTo(S.fp,q);
        dotAt(S.fp,Math.min(q,S.Lf-.01),S.f);
      }
    } else if(q<S.Lf+S.Lg){                        /* 2 · lifted glide, no ink */
      showAll(S.fp,false); showAll(S.tp,false);
      if(S.sits) S.between((q-S.Lf)/S.Lg);         /* ride the two baselines together */
      const pt=S.pg.getPointAtLength(q-S.Lf);
      S.dot.setAttribute('cx',pt.x); S.dot.setAttribute('cy',pt.y);
    } else {                                       /* 3 · writing the TO glyph */
      if(S.sits && S.at!=='to') S.sit('to');
      showAll(S.fp,false);
      const b=Math.min(S.Lt, q-S.Lf-S.Lg);
      drawUpTo(S.tp,b);
      dotAt(S.tp,Math.max(b-.01,0),S.t);
    }
  };
  spot.addEventListener('click', pressed);
  return S;
}

/* the margin is one number and it lives in the stylesheet, where the
   breakpoint changes it — so it is read from there rather than repeated */
const pageGap = ()=>parseFloat(getComputedStyle(document.documentElement)
  .getPropertyValue('--gap')) || 46;
/* Both the size and the cap are read off #loupe's OWN box, which the CSS
   has already sized to the canvas left free — beside the card on a wide
   window, above it on a narrow one. Working from innerWidth instead meant
   guessing at the layout in two places and getting a different answer in
   each. */
const loupe  = makeSpot(document.getElementById('loupeLine'),
  ()=>Math.max(96, Math.min(250, $('loupe').clientHeight*.5)), false,
  ()=>Math.max(160, $('loupe').clientWidth - pageGap()*2));   /* the page margin, both sides */
const footer = makeSpot(document.getElementById('ftSpot'), 17, true);
const spots = [loupe, footer];
/* The offset is measured against the mark's OWN box, so it survives the
   webfont landing and moving the whole line — that was checked, and the
   value comes out identical with Space Mono and without it. What it does
   not survive is being measured before the mark has been laid out at all
   (box.height 0, offset left empty). Re-measuring on fonts.ready and on
   resize costs nothing and closes that window. */
if(document.fonts) document.fonts.ready.then(()=>spots.forEach(s=>s.align && s.align()));
/* A resize changes three things at once and none of them fix themselves:
   the mark's budget, the pool's walls (they were built from the box's old
   width) and, if the card has been parked by hand, where it is allowed to
   sit.
   Watch the two BOXES rather than the window. It is their width that the
   numbers were derived from, and they also change without the window
   doing anything — the breakpoint flipping the card from beside to below,
   or the card being parked somewhere else. (It is also the only thing that
   can be verified: a headless viewport change resizes the page without
   ever firing a `resize` event, so a window listener silently never runs.)
   Neither box is sized by what is inside it, so there is no feedback loop.
   Debounced, because dragging a window edge fires this every frame. */
let rzT;
function relayout(){
  clearTimeout(rzT);
  rzT=setTimeout(()=>{
    parkPanel();
    placeStrip();
    if(engine) buildWorld();
    /* the two slot thumbnails are fitted to the slot they are drawn in, and
       the slots are half a card wide — so they are stale the moment the
       card's width changes, and a long word spills straight out of its box */
    if(TOKS.length){ paintSlot('from'); paintSlot('to'); }
    rebuild();
  }, 140);
}
addEventListener('resize', relayout);
/* the two boxes are observed from the boot block at the bottom, once they
   and everything relayout() touches actually exist */

/* ── one shared clock ──
   The clock does NOT own a requestAnimationFrame of its own. It is advanced
   by the single always-running loop at the bottom of this file, so there is
   no start/stop handle that can be left dangling by a hidden tab, a thrown
   error, or two clicks in the same frame — the states replay used to get
   stuck in. Playing is just a boolean. */
const CTRL = { p:0, dir:1, playing:false, last:0 };
function apply(){ spots.forEach(s=>s.setProgress(CTRL.p)); if(!scrubbing) $('rP').value=Math.round(CTRL.p*1000); }
function stopClock(){ CTRL.playing=false; }
function advance(now){
  if(!CTRL.playing) return;
  /* rAF hands us the time the FRAME began, which can predate the click that
     started the run — a negative dt then drove p below 0 and the clock
     stopped on its first tick. That is the "sometimes replay needs several
     clicks" bug. The first frame only syncs the clock; dt can never be
     negative, and never larger than one slow frame. */
  if(!CTRL.last){ CTRL.last=now; return; }
  const dt=Math.max(0, Math.min(64, now-CTRL.last));
  CTRL.last=now;
  CTRL.p=Math.min(1,Math.max(0,CTRL.p+CTRL.dir*dt/P.dur));
  apply();
  try{
    const q=ez(CTRL.p)*loupe.LT;
    const gliding = q>=loupe.Lf && q<loupe.Lf+loupe.Lg;   /* nib in the air */
    pen.level(gliding?0:1);
  }catch(e){}
  if(CTRL.p<=0 || CTRL.p>=1){ CTRL.playing=false; pen.stop(); idleness(); }
}
function go(dir){
  CTRL.dir=dir;
  spots.forEach(s=>s.el.classList.remove('idle'));
  if(!REDUCED.matches) try{ pen.start(); }catch(e){}
  CTRL.last=0;              /* let the first frame stamp it, see advance() */
  CTRL.playing=true;
}
function pressed(){
  /* showing FROM → write; showing TO → unwrite; mid-flight → turn around */
  if(CTRL.playing) go(-CTRL.dir);
  else if(CTRL.p<=0) go(1);
  else go(-1);
}
/* coming back to the tab must not count the time spent away */
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden) CTRL.last=0;
});
function idleness(){
  /* the wiggle belongs to the resting FROM shape only */
  if(CTRL.p<=0 && !CTRL.playing) spots.forEach(s=>s.el.classList.add('idle'));
}
function rebuild(then){
  Promise.all([glyphPath(G(FORMULA.from)), glyphPath(G(FORMULA.to))])
    .then(([f,t])=>{ spots.forEach(s=>s.build(f,t)); idleness(); if(then) then(); });
}


/* ── the pen's own voice ──
   cuelume is all discrete cues, so the drawing sound is synthesised here:
   looped noise through a wobbling lowpass, the way bristles sound on paper.
   It is tied to the pen's state — audible while inking, silent while the
   pen is lifted and gliding across. */
const pen = {
  ctx:null, buf:null, src:null, gain:null, lfo:null, on:false,
  init(){
    if(this.ctx) return;
    const AC = window.AudioContext||window.webkitAudioContext;
    if(!AC) return;
    this.ctx = new AC();
    const n = this.ctx.sampleRate*1.2;
    const b = this.ctx.createBuffer(1,n,this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for(let i=0;i<n;i++) d[i] = Math.random()*2-1;
    this.buf = b;
  },
  start(){
    this.init(); if(!this.ctx) return;
    if(this.ctx.state==='suspended') this.ctx.resume();
    this.stop(true);
    const t=this.ctx.currentTime;
    const src=this.ctx.createBufferSource(); src.buffer=this.buf; src.loop=true;
    const f=this.ctx.createBiquadFilter();
    f.type='lowpass'; f.frequency.setValueAtTime(560,t); f.Q.value=.5;
    const lfo=this.ctx.createOscillator(), lg=this.ctx.createGain();
    lfo.frequency.value=5.5; lg.gain.value=120;
    lfo.connect(lg).connect(f.frequency);
    const g=this.ctx.createGain(); g.gain.setValueAtTime(0,t);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t); lfo.start(t);
    this.src=src; this.lfo=lfo; this.gain=g; this.on=true;
  },
  /* 1 while the nib is down, 0 while it is travelling in the air */
  level(v){
    if(!this.gain) return;
    const t=this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(v*0.013, t, .04);
  },
  stop(immediate){
    if(!this.on) return;
    const t=this.ctx.currentTime, g=this.gain, src=this.src, lfo=this.lfo;
    this.on=false; this.gain=null; this.src=null; this.lfo=null;
    if(!g) return;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t+(immediate?.02:.12));
    try{ src.stop(t+.2); lfo.stop(t+.2); }catch(e){}
  }
};

/* ── the pool box ── */
const $=id=>document.getElementById(id);
const lbox=$('lbox');
const TOKS=[];
const slots={from:document.querySelector('.slot[data-slot=from]'),
             to:  document.querySelector('.slot[data-slot=to]')};

function paintSlot(which){
  const g=G(FORMULA[which]), el=slots[which];
  glyphPath(g).then(d=>{
    /* fill the slot as large as it will go without spilling out of it */
    const b=bboxOf(g.id,d), bh=g.band?g.band[1]:b.h;
    const px=Math.min(44, (el.clientWidth-18)*bh/b.w);
    el.innerHTML=thumb(g, d, px, 3.2);
    el.classList.add('filled');
  });
}
function markTokens(){
  TOKS.forEach(t=>t.el.classList.toggle('sel',
    t.gid===FORMULA.from || t.gid===FORMULA.to));
}
/* One slot is armed at a time; a plain tap in the pool fills that one.
   Dragging still overrides it, so either habit works. */
let armed='to';
function armSlot(which){
  armed=which;
  Object.keys(slots).forEach(k=>slots[k].classList.toggle('armed', k===armed));
}
Object.keys(slots).forEach(k=>slots[k].addEventListener('click',()=>armSlot(k)));

function setSlot(which, gid){
  armSlot(which);
  try{ window.cue && window.cue('chime',{volume:.5}); }catch(e){}
  if(FORMULA[which]===gid) return;
  FORMULA[which]=gid;
  paintSlot(which); markTokens();
  stopClock(); CTRL.p=0; CTRL.dir=1;
  rebuild(()=>go(1));
}

const COLS=5;      /* the pool grid */
function buildBox(){
  const bw=lbox.clientWidth;
  GLYPHS.forEach((g,i)=>{
    const s = (g.type==='hanzi' || g.id==='heart') ? 24 : 15;
    const el=document.createElement('span');
    el.className='tok';
    el.innerHTML=thumb(g, dCache[g.id], s, 1.7);
    el.title=g.label;
    const box=el.querySelector('svg');
    const w=+box.getAttribute('width'), h=+box.getAttribute('height');
    lbox.appendChild(el);
    /* A body per piece. Restitution falls with area, so a small mark skips
       a couple of times where a long word lands and stays — the bounce
       comes from its own weight, as asked. */
    const area=w*h;
    const body=Bodies.rectangle(bw/2, -26 - i*(h+16), w, h, {
      restitution: Math.max(.34, .68 - area/2400),
      friction:.42, frictionAir:.0016, density:.0012,
      chamfer:{radius:Math.min(w,h)*.22}      /* rounded, like the strokes */
    });
    /* flat things want to lie flat: more rotational inertia means they
       tumble less on the way down and settle nearer the horizontal, which
       keeps the words readable in the heap */
    Body.setInertia(body, body.inertia*5);
    Body.setAngle(body, (Math.random()-.5)*.16);
    World.add(engine.world, body);
    const t={el, gid:g.id, w, h, body, x:bw/2, y:0, held:false};
    TOKS.push(t);
    el.addEventListener('pointerdown', e=>{
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      t.held=true; Body.setStatic(t.body, true);
      const br=lbox.getBoundingClientRect();
      const sx=e.clientX, sy=e.clientY, st=performance.now();
      let moved=0, overSlot=null, lastP=null;
      const move=ev=>{
        moved=Math.max(moved, Math.hypot(ev.clientX-sx, ev.clientY-sy));
        const nx=ev.clientX-br.left, ny=ev.clientY-br.top;
        lastP={x:nx-t.x, y:ny-t.y};
        Body.setPosition(t.body, {x:nx, y:ny});
        const hit=document.elementFromPoint(ev.clientX, ev.clientY);
        const sl=hit && hit.closest && hit.closest('.slot');
        if(sl!==overSlot){
          if(overSlot) overSlot.classList.remove('over');
          overSlot=sl; if(sl) sl.classList.add('over');
        }
      };
      const up=ev=>{
        el.removeEventListener('pointermove',move);
        el.removeEventListener('pointerup',up);
        t.held=false; Body.setStatic(t.body, false);
        if(lastP) Body.setVelocity(t.body, {x:Math.max(-14,Math.min(14,lastP.x)),
                                            y:Math.max(-14,Math.min(14,lastP.y))});
        if(overSlot) overSlot.classList.remove('over');
        const tap = moved<7 && performance.now()-st<400;
        if(overSlot) setSlot(overSlot.dataset.slot, t.gid);
        else if(tap) setSlot(armed, t.gid);     /* a plain tap fills whichever slot is aimed */
        if(overSlot){          /* taken out of the box: dropped back in from above */
          Body.setPosition(t.body, {x:lbox.clientWidth/2+(Math.random()-.5)*12, y:-26});
          Body.setVelocity(t.body, {x:0,y:0});
        }
      };
      el.addEventListener('pointermove',move);
      el.addEventListener('pointerup',up);
    });
  });
  /* the cursor is a field, not a shove: each piece has a target position
     and simply follows it. Cause and effect stay legible, and nothing is
     left ringing after the pointer has gone. */
  lbox.addEventListener('pointermove', e=>{
    const br=lbox.getBoundingClientRect();
    MOUSE.x=e.clientX-br.left; MOUSE.y=e.clientY-br.top; MOUSE.in=true;
  });
  lbox.addEventListener('pointerleave', ()=>{ MOUSE.in=false; });
  markTokens();
  render();
}
const MOUSE={x:0,y:0,in:false};
/* ── the pile, on a real solver ──
   Hand-rolled impulses could give a convincing bounce OR a stack that came
   to rest, never both: restitution repeated over a chain of contacts pumps
   energy in, and an axis-aligned box cannot rotate into a slope. Both of
   those are exactly what a rigid-body engine is for, so the pieces are
   Matter.js bodies now — real restitution, real friction, real rotation,
   and stacks that actually settle. */
const {Engine, World, Bodies, Body, Composite, Events} = Matter;
let engine=null, walls=[];
const WALL=400;                       /* thick walls: nothing tunnels out */

let WORLD_W=0;
function buildWorld(){
  const bw=lbox.clientWidth, bh=lbox.clientHeight;
  WORLD_W=bw;
  if(!engine){
    engine=Engine.create();
    engine.gravity.y=1;
    engine.positionIterations=8;
    engine.velocityIterations=8;
  }
  Composite.remove(engine.world, walls);
  const opt={isStatic:true, friction:.6, restitution:.1};
  walls=[
    Bodies.rectangle(bw/2, bh+WALL/2, bw+WALL*2, WALL, opt),      /* floor */
    Bodies.rectangle(-WALL/2, bh/2, WALL, bh*4, opt),             /* left  */
    Bodies.rectangle(bw+WALL/2, bh/2, WALL, bh*4, opt),           /* right */
  ];
  World.add(engine.world, walls);
}
function pourAll(){
  const bw=lbox.clientWidth;
  TOKS.forEach((t,i)=>{
    /* one point above the middle — a real solver lets the heap find its own
       angle of repose from there, which a box-only sim never could */
    Body.setPosition(t.body, {x: bw/2 + (Math.random()-.5)*12,
                              y: -26 - i*(t.h+16) - Math.random()*8});
    Body.setVelocity(t.body, {x:0, y:0});
    Body.setAngle(t.body, (Math.random()-.5)*.16);
    Body.setAngularVelocity(t.body, (Math.random()-.5)*.012);
  });
}
/* ── sloshing ──
   The bodies live in the box's own coordinates, so moving the dashboard
   does not move them: what they feel is the box accelerating around them.
   That is a real thing with a name — the pseudo-force of a non-inertial
   frame — so it is simply applied rather than faked. Shove the card and the
   contents pile against the trailing wall; rock it gently and they sway. */
const SHAKE={px:null, py:null, vx:0, vy:0};
const SLOSH=.0016;              /* how heavily the contents feel the motion */
function applyShake(){
  const r=lbox.getBoundingClientRect();
  if(SHAKE.px!==null){
    const vx=r.left-SHAKE.px, vy=r.top-SHAKE.py;      /* the box's velocity */
    /* A jump this big is not a drag — it is a scroll, a resize or a zoom.
       Differentiating it would invent an enormous acceleration and fire the
       whole heap out of the box, so the clock is simply resynced. */
    if(Math.abs(vx)>70 || Math.abs(vy)>70){
      SHAKE.px=r.left; SHAKE.py=r.top; SHAKE.vx=0; SHAKE.vy=0;
      return;
    }
    const ax=vx-SHAKE.vx, ay=vy-SHAKE.vy;             /* and its acceleration */
    SHAKE.vx=vx; SHAKE.vy=vy;
    if(Math.abs(ax)>.02 || Math.abs(ay)>.02){
      TOKS.forEach(t=>{
        if(t.held) return;
        const b=t.body;
        const cx=Math.max(-40,Math.min(40,ax)), cy=Math.max(-40,Math.min(40,ay));
        Body.applyForce(b, b.position, {x:-cx*b.mass*SLOSH, y:-cy*b.mass*SLOSH});
      });
    }
  }
  SHAKE.px=r.left; SHAKE.py=r.top;
}
function stepSim(n){
  if(!engine) return;
  const bw=lbox.clientWidth;
  applyShake();
  for(let k=0;k<n;k++){
    if(MOUSE.in){
      /* a breath of air: a force, capped so nothing is ever blown out of
         reach — the old version added velocity every frame and compounded */
      TOKS.forEach(t=>{
        const b=t.body;
        const dx=b.position.x-MOUSE.x, dy=b.position.y-MOUSE.y, d=Math.hypot(dx,dy);
        if(d>.001 && d<58 && Math.hypot(b.velocity.x,b.velocity.y)<1.6){
          const f=.00013*b.mass*(1-d/58);
          Body.applyForce(b, b.position, {x:dx/d*f, y:dy/d*f});
        }
      });
    }
    /* A righting torque. A flat thing is stable lying down, and a word
       standing on its end or turned upside down is unreadable — this pulls
       each piece gently back towards level while contacts still win when
       they have to, so the heap keeps its natural jumble without any of it
       spinning through full turns. */
    TOKS.forEach(t=>{
      if(t.held) return;
      const b=t.body;
      let a=b.angle % (Math.PI*2);
      if(a>Math.PI) a-=Math.PI*2;
      if(a<-Math.PI) a+=Math.PI*2;
      /* Only past the limit. Righting everything to level was measured to
         DESTROY the mound — with no tilt the flat words stack like planks
         and the heap towers again (peak 182–217, spilling out). The tilt is
         what lets a piece slide off, so it has to be left alone until it
         reaches the point of being unreadable. */
      const lim=19*Math.PI/180;
      if(Math.abs(a)>lim) Body.setAngularVelocity(b, b.angularVelocity*.85 - (a-Math.sign(a)*lim)*.045);
      else Body.setAngularVelocity(b, b.angularVelocity*.985);
    });
    Engine.update(engine, 1000/60);
  }
}
function render(){
  TOKS.forEach(t=>{
    const b=t.body;
    t.x=b.position.x; t.y=b.position.y;      /* kept for the drag maths */
    t.el.style.transform=
      `translate(${(b.position.x-t.w/2).toFixed(1)}px, ${(b.position.y-t.h/2).toFixed(1)}px) `+
      `rotate(${b.angle.toFixed(3)}rad)`;
  });
}

/* ════ the easter egg ════
   Double-click the dashboard and a heart-shaped box appears on the canvas,
   holding a hundred loves. Its wall is the heart path itself, sampled into
   72 short static fences, so the words are genuinely cupped by the curve.

   An intact shell is AIRTIGHT. Shake it and it sloshes; nothing comes out.
   The only way out is to shake hard enough that the hundred inside burst
   the outline from within — every fence crumbles into rice-sized grains
   and the whole lot rains onto the floor.

   What has fallen stays fallen: the floor is its own layer and outlives
   any number of hearts. Click the mark to bring it back to full strength,
   double-click for a fresh heart, and shake out another hundred on top of
   what is already down there. Every fallen strip of tape stays draggable
   and shoves the words it ploughs into. */
const EGG={
  live:false,      /* the layer and its engine exist */
  on:false,        /* an intact heart is up */
  dim:false,       /* the mark is standing back, waiting for a click */
  filling:false,   /* the pour is still running — the tape is not a handle yet */
  box:null, engine:null, walls:[], desk:null, deskRect:null,
  x:0,y:0, tx:0,ty:0, pvx:0,pvy:0, stress:0, held:false,
  size:420, segs:[], words:[], els:{}, pour:null,
  floor:{words:[], shards:[], tapes:[]},
};
/* measured at the current speed caps: a gentle rock peaks near stress 8,
   a genuine thrash near 70 — the line sits well clear of both */
const EGG_SLOSH=.0022, EGG_BREAK=45, EGG_N=72;
/* the floor may collect for ever, but not without bound — the oldest
   leavings are quietly retired so the hundredth hundred still runs */
const EGG_KEEP={words:320, shards:820, tapes:4};

/* The shell is a HEART, not a circle. A radius test called a word "inside"
   while it sat in the notch beside a lobe or below the point, so an escapee
   there was never put back — and the same wrong test in verification then
   reported an airtight box while words lay outside the line. Ask the path. */
const EGG_HIT=document.createElement('canvas').getContext('2d');
const EGG_PATH=new Path2D(D_HEART);
function eggHolds(px,py){
  return EGG_HIT.isPointInPath(EGG_PATH,(px-EGG.x)/EGG.size*100+50,
                                        (py-EGG.y)/EGG.size*100+50);
}

/* ── the layer: one engine and one room for the whole session ── */
function eggLayer(){
  if(EGG.live) return true;
  if(innerHeight<200 || innerWidth<200) return false;
  const box=document.createElement('div'); box.id='egg';
  document.body.appendChild(box); EGG.box=box;
  EGG.engine=Engine.create();
  EGG.engine.gravity.y=1;
  EGG.engine.positionIterations=8; EGG.engine.velocityIterations=8;
  /* Matter parks its own settled bodies and wakes them on contact, which
     is what lets a dragged strip of tape disturb a pile that has been
     lying there for minutes. Hand-rolled sleeping could not be woken. */
  EGG.engine.enableSleeping=true;
  eggRoom();
  EGG.live=true;
  return true;
}
function eggRoom(){
  const opt={isStatic:true, friction:.5, restitution:.12};
  EGG.walls.forEach(w=>World.remove(EGG.engine.world,w));
  EGG.walls=[
    Bodies.rectangle(innerWidth/2, innerHeight+197, innerWidth+800, 400, opt),
    Bodies.rectangle(-197, innerHeight/2, 400, innerHeight*3, opt),
    Bodies.rectangle(innerWidth+197, innerHeight/2, 400, innerHeight*3, opt),
  ];
  World.add(EGG.engine.world, EGG.walls);
  eggDesk(true);
}
/* The card is FURNITURE, not scenery. On a phone it lies along the foot of
   the page and paints over the egg layer, so a floor at the bottom of the
   window buried the whole payoff: every one of 316 fallen pieces came to
   rest behind the card, the tape included — out of sight and out of reach.
   Giving the card a body makes things pile ON it instead, on either
   layout, and nothing can end up somewhere you cannot see. */
function eggDesk(force){
  const el=$('panel'); if(!el) return;
  const r=el.getBoundingClientRect();
  if(r.width<20 || r.height<20) return;
  const same=EGG.deskRect &&
    Math.abs(EGG.deskRect.w-r.width)<.5 && Math.abs(EGG.deskRect.h-r.height)<.5;
  if(same && !force){
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    if(Math.abs(EGG.desk.position.x-cx)>.5 || Math.abs(EGG.desk.position.y-cy)>.5)
      Body.setPosition(EGG.desk,{x:cx,y:cy});
    EGG.deskRect={w:r.width,h:r.height};
    return;
  }
  if(EGG.desk) World.remove(EGG.engine.world, EGG.desk);
  EGG.desk=Bodies.rectangle(r.left+r.width/2, r.top+r.height/2, r.width, r.height,
    {isStatic:true, friction:.5, restitution:.06});
  EGG.deskRect={w:r.width,h:r.height};
  World.add(EGG.engine.world, EGG.desk);
}
function eggRetire(list, keep){
  while(list.length>keep){
    const o=list.shift();
    o.el.remove(); if(o.grip) o.grip.remove();
    World.remove(EGG.engine.world, o.body);
  }
}

/* ── the mark steps back, and comes back when asked ── */
function eggDim(){ EGG.dim=true;
  loupe.el.style.transition='opacity .4s'; loupe.el.style.opacity='.12';
  loupe.el.style.cursor='pointer';
}
function eggRestore(){ EGG.dim=false;
  loupe.el.style.transition='opacity .4s'; loupe.el.style.opacity='';
  loupe.el.style.cursor='';
}

function eggSpawn(){
  if(EGG.on) return;
  if(!eggLayer()) return;
  const lp=$('loupe').getBoundingClientRect();
  /* the heart needs real room: never force a size the window cannot hold,
     or the floor ends up slicing through the shell */
  EGG.size=Math.min(520, lp.width-60, innerHeight-220);
  if(EGG.size<230) return;
  const S=EGG.size, box=EGG.box;
  EGG.x=lp.left+lp.width/2; EGG.y=Math.max(S/2+40, lp.top+lp.height/2-20);
  EGG.tx=EGG.x; EGG.ty=EGG.y;
  EGG.pvx=0; EGG.pvy=0; EGG.stress=0; EGG.held=false;
  EGG.segs=[]; EGG.words=[];
  eggDim();

  /* the shell: one visible stroke, and 72 invisible fences under it */
  const ns='http://www.w3.org/2000/svg';
  const shell=document.createElementNS(ns,'svg');
  shell.setAttribute('class','shell');
  shell.setAttribute('width',S); shell.setAttribute('height',S);
  shell.setAttribute('viewBox','0 0 100 100');
  shell.innerHTML=`<path d="${D_HEART}"/>`;
  box.appendChild(shell); EGG.els.shell=shell;
  const probe=document.createElementNS(ns,'path');
  probe.setAttribute('d',D_HEART);
  const tmp=document.createElementNS(ns,'svg'); tmp.appendChild(probe);
  document.body.appendChild(tmp);
  const L=probe.getTotalLength(), pts=[];
  for(let i=0;i<EGG_N;i++){
    const pt=probe.getPointAtLength(L*i/EGG_N);
    pts.push({x:(pt.x-50)/100*S, y:(pt.y-50)/100*S});   /* box-centred px */
  }
  tmp.remove();
  for(let i=0;i<EGG_N;i++){
    const a=pts[i], b=pts[(i+1)%EGG_N];
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    const len=Math.hypot(b.x-a.x,b.y-a.y);
    /* fences thicker than any single frame's wall travel, or a hard
       shake teleports words straight through the shell */
    const body=Bodies.rectangle(EGG.x+mx, EGG.y+my, len+3, 22,
      {isStatic:true, angle:Math.atan2(b.y-a.y,b.x-a.x), friction:.4, restitution:.15});
    EGG.segs.push({body, ox:mx, oy:my, len});
    World.add(EGG.engine.world, body);
  }

  /* the tape over the left lobe — also the handle you shake it by */
  const tape=document.createElement('div'); tape.className='egg-tape';
  /* Literally the dashboard's strip: same 32 thickness at the same -3deg,
     scaled with the heart. Placement is measured, not eyeballed — tape only
     reads as tape when it STRADDLES an edge along its WHOLE length, and the
     outline under a strip this wide is a DOME, not a line (sampled: 17.3 at
     the left end, 12.6 at the crown, 18.2 at the right). A straight strip
     can only touch a dome in the middle unless it is thick enough to
     swallow the rise, so it sits over the flattest reach of the lobe and is
     centred on the dome's MID-HEIGHT rather than its mean — the mean left
     both ends in the air. A full 132 length cannot be seated at all: swept
     over every centre and angle, the best is 23 of 24 columns with one end
     hanging. So it is torn a little shorter, which is what hand-torn tape
     is. At 120 the whole strip grips — 24 of 24 columns, the weakest still
     20% onto the heart, at the dashboard's own -3deg. */
  const k=S/520;
  EGG.tapeW=Math.round(120*k); EGG.tapeH=Math.round(32*k);
  tape.style.width=EGG.tapeW+'px'; tape.style.height=EGG.tapeH+'px';
  tape.style.backgroundSize=`${22*k}px ${32*k}px, ${140*k}px ${32*k}px`;
  box.appendChild(tape); EGG.els.tape=tape;
  EGG.gripPad=13;
  const grip=document.createElement('div'); grip.className='egg-grip';
  grip.style.width=(EGG.tapeW+EGG.gripPad*2)+'px';
  grip.style.height=(EGG.tapeH+EGG.gripPad*2)+'px';
  box.appendChild(grip); EGG.els.grip=grip;
  EGG.tapeOff={x:(29.5-50)/100*S, y:(15.25-50)/100*S};
  grip.addEventListener('pointerdown', ev=>{
    /* not a handle until the heart is full: shaking mid-pour dragged the
       shell out from under words that were still arriving */
    if(EGG.filling || !EGG.on) return;
    ev.preventDefault(); grip.setPointerCapture(ev.pointerId);
    EGG.held=true;
    const gx=ev.clientX-EGG.x, gy=ev.clientY-EGG.y;
    const mv=e2=>{ EGG.tx=e2.clientX-gx; EGG.ty=e2.clientY-gy; };
    const up=()=>{ grip.removeEventListener('pointermove',mv);
      grip.removeEventListener('pointerup',up); EGG.held=false; };
    grip.addEventListener('pointermove',mv);
    grip.addEventListener('pointerup',up);
  });

  /* a hundred loves, rained in through the lobes — spawned by drips so the
     solver never wakes to a hundred overlaps at once, and exactly a hundred
     per heart: the pour runs once and then retires itself */
  const langs=GLYPHS.filter(g=>g.id!=='heart');
  const p2d=new Path2D(D_HEART);
  const ctx2=document.createElement('canvas').getContext('2d');
  let queued=0;
  EGG.filling=true;
  EGG.pour=()=>{
    for(let n=0;n<6 && queued<100;n++){
      const g=langs[queued%langs.length];
      /* born clear of the wall: the point AND a margin around it must be
         inside, or a word can start overlapping a fence and get squeezed
         straight through it */
      const clear=(x,y)=>ctx2.isPointInPath(p2d,x,y)
        && ctx2.isPointInPath(p2d,x-5,y) && ctx2.isPointInPath(p2d,x+5,y)
        && ctx2.isPointInPath(p2d,x,y-5) && ctx2.isPointInPath(p2d,x,y+5);
      let lx,ly,tries=0;
      do{ lx=18+Math.random()*64; ly=14+Math.random()*26; tries++; }
      while(!clear(lx,ly) && tries<30);
      if(tries>=30){ lx=42+Math.random()*16; ly=34; }
      const px=(g.type==='hanzi')?15:12;
      const el=document.createElement('span');
      el.className='ew'+(queued%13===5?' red':'');
      el.innerHTML=thumb(g, dCache[g.id], px, 1.2);
      box.appendChild(el);
      const svg=el.querySelector('svg');
      const w=+svg.getAttribute('width'), h=+svg.getAttribute('height');
      const body=Bodies.rectangle(EGG.x+(lx-50)/100*EGG.size, EGG.y+(ly-50)/100*EGG.size,
        w, h, {friction:.32, frictionAir:.004, restitution:.2, density:.0012,
               chamfer:{radius:Math.min(w,h)*.2}});
      Body.setAngle(body,(Math.random()-.5)*.3);
      World.add(EGG.engine.world, body);
      EGG.words.push({el, body, w, h});
      queued++;
    }
    if(queued>=100){ EGG.filling=false; EGG.pour=null; }
  };
  EGG.on=true;
  try{ window.cue && window.cue('bloom',{volume:.5}); }catch(e){}
}

/* ── a fallen strip of tape is still a strip of tape ── */
function eggTapeToFloor(el, grip, body){
  const t={el, grip, body, drag:null};
  grip.addEventListener('pointerdown', ev=>{
    ev.preventDefault(); grip.setPointerCapture(ev.pointerId);
    Matter.Sleeping.set(body,false);
    /* Held in a hand it is heavy, not a 0.6-gram scrap: left at its own
       mass the solver answered every collision by shoving the TAPE aside.
       Heavy but still DYNAMIC — Matter refuses to wake a sleeping body
       against a static one (Sleeping.afterCollisions skips any pair with a
       static half), so a static strip slid through a settled pile without
       disturbing one word of it. */
    t.mass0=body.mass; Body.setMass(body, 60);
    t.drag={gx:ev.clientX-body.position.x, gy:ev.clientY-body.position.y,
            tx:body.position.x, ty:body.position.y, vx:0, vy:0};
    const mv=e2=>{ t.drag.tx=e2.clientX-t.drag.gx; t.drag.ty=e2.clientY-t.drag.gy; };
    const up=()=>{ grip.removeEventListener('pointermove',mv);
      grip.removeEventListener('pointerup',up);
      const d=t.drag; t.drag=null;
      Body.setMass(body, t.mass0);
      if(d) Body.setVelocity(body,{x:d.vx,y:d.vy});   /* let go, keep the throw */
    };
    grip.addEventListener('pointermove',mv);
    grip.addEventListener('pointerup',up);
  });
  EGG.floor.tapes.push(t);
  eggRetire(EGG.floor.tapes, EGG_KEEP.tapes);
}

function eggBreak(){
  if(!EGG.on) return;
  EGG.on=false; EGG.held=false;
  EGG.els.shell.remove();
  /* The line does not fall as itself — it bursts into grains, like a
     biscuit crumbling: each fence crumbles into a few rice-sized crumbs
     thrown outward from where the wall gave way. */
  EGG.segs.forEach(sg=>{
    const b=sg.body, pos={...b.position}, ang=b.angle;
    World.remove(EGG.engine.world,b);
    const crumbs=2+Math.floor(Math.random()*3);          /* 2–4 per fence */
    for(let c=0;c<crumbs;c++){
      const gl=2.5+Math.random()*3.5, gh=2+Math.random()*1.3;
      const along=(c+0.5)/crumbs-0.5;
      const gx=pos.x+Math.cos(ang)*along*sg.len, gy=pos.y+Math.sin(ang)*along*sg.len;
      const grain=Bodies.rectangle(gx,gy,gl,gh,
        {friction:.42, frictionAir:.012, restitution:.26, density:.0008,
         angle:Math.random()*Math.PI, chamfer:{radius:gh*.45}});
      const dx=gx-EGG.x, dy=gy-EGG.y, d=Math.hypot(dx,dy)||1;
      Body.setVelocity(grain,{x:dx/d*(1+Math.random()*3), y:dy/d*1.2-1.5*Math.random()});
      Body.setAngularVelocity(grain,(Math.random()-.5)*.4);
      World.add(EGG.engine.world,grain);
      const el=document.createElement('div'); el.className='shard';
      el.style.width=gl+'px'; el.style.height=gh+'px';
      EGG.box.appendChild(el);
      EGG.floor.shards.push({el, body:grain, w:gl, h:gh});
    }
  });
  EGG.segs=[];
  /* the tape peels off and flutters down with everything else */
  const tb=Bodies.rectangle(EGG.x+EGG.tapeOff.x, EGG.y+EGG.tapeOff.y, EGG.tapeW, EGG.tapeH,
    {friction:.5, frictionAir:.03, restitution:.1, density:.0006,
     angle:-3*Math.PI/180});
  Body.setAngularVelocity(tb,(Math.random()-.5)*.1);
  World.add(EGG.engine.world,tb);
  eggTapeToFloor(EGG.els.tape, EGG.els.grip, tb);
  EGG.els={};
  /* it breaks from the inside: the words burst outward with the shell */
  EGG.words.forEach(w=>{
    const dx=w.body.position.x-EGG.x, dy=w.body.position.y-EGG.y, d=Math.hypot(dx,dy)||1;
    Body.setVelocity(w.body,{x:w.body.velocity.x+dx/d*(1+Math.random()*1.6),
                             y:w.body.velocity.y+dy/d*.6-1});
    EGG.floor.words.push(w);
  });
  EGG.words=[];
  eggRetire(EGG.floor.words, EGG_KEEP.words);
  eggRetire(EGG.floor.shards, EGG_KEEP.shards);
  try{ window.cue && window.cue('sparkle',{volume:.6}); }catch(e){}
}

/* lift an intact heart off the canvas, leaving whatever is already down */
function eggTakeAway(){
  if(!EGG.on) return;
  EGG.on=false; EGG.held=false; EGG.filling=false; EGG.pour=null;
  EGG.segs.forEach(sg=>World.remove(EGG.engine.world,sg.body)); EGG.segs=[];
  EGG.words.forEach(w=>{ w.el.remove(); World.remove(EGG.engine.world,w.body); });
  EGG.words=[];
  Object.values(EGG.els).forEach(el=>el && el.remove()); EGG.els={};
  eggRestore();
}
/* and sweep the floor when the canvas should be bare again */
function eggSweep(){
  ['words','shards','tapes'].forEach(k=>{
    EGG.floor[k].forEach(o=>{ o.el.remove(); if(o.grip) o.grip.remove();
      World.remove(EGG.engine.world,o.body); });
    EGG.floor[k]=[];
  });
}
function eggFloorCount(){
  return EGG.floor.words.length+EGG.floor.shards.length+EGG.floor.tapes.length;
}
function eggClear(){
  eggTakeAway();
  if(EGG.live) eggSweep();
  if(EGG.box) EGG.box.remove();
  if(EGG.engine) Matter.Engine.clear(EGG.engine);
  Object.assign(EGG,{live:false,on:false,filling:false,box:null,engine:null,walls:[],desk:null,deskRect:null,
    stress:0,held:false,segs:[],words:[],els:{},pour:null,
    floor:{words:[],shards:[],tapes:[]}});
  eggRestore();
}

function eggTick(){
  if(!EGG.live) return;
  if(EGG.pour) EGG.pour();
  eggDesk(false);          /* the card can be dragged and can change size */
  /* the box lags its target so wall speed stays below what words can
     tunnel through, and its acceleration is what the contents feel */
  if(EGG.on){
    const step=v=>Math.max(-12,Math.min(12,v));   /* below the fence depth */
    const nx=EGG.x+step((EGG.tx-EGG.x)*.38), ny=EGG.y+step((EGG.ty-EGG.y)*.38);
    const vx=nx-EGG.x, vy=ny-EGG.y;
    const ax=vx-EGG.pvx, ay=vy-EGG.pvy;
    EGG.pvx=vx; EGG.pvy=vy; EGG.x=nx; EGG.y=ny;
    EGG.segs.forEach(sg=>Body.setPosition(sg.body,{x:EGG.x+sg.ox, y:EGG.y+sg.oy}));
    const am=Math.hypot(ax,ay);
    if(am>.02) EGG.words.forEach(w=>{ Matter.Sleeping.set(w.body,false);
      Body.applyForce(w.body, w.body.position,
        {x:-ax*w.body.mass*EGG_SLOSH, y:-ay*w.body.mass*EGG_SLOSH}); });
    /* violence has a memory: hard shaking charges it, calm drains it */
    EGG.stress=EGG.stress*.93+am;
    if(EGG.stress>EGG_BREAK){ eggBreak(); }
    /* an unbroken shell is airtight by definition: the odd word a shake
       squeezes through a fence corner goes back on top of the pile rather
       than lying outside an intact heart. Tested against the path, so the
       notch beside a lobe counts as outside like anywhere else. */
    if(EGG.on) EGG.words.forEach(w=>{
      if(eggHolds(w.body.position.x, w.body.position.y)) return;
      Body.setPosition(w.body,{x:EGG.x+(Math.random()-.5)*EGG.size*.16,
                               y:EGG.y-EGG.size*.14});
      Body.setVelocity(w.body,{x:0,y:0});
      Body.setAngularVelocity(w.body,0);
    });
  }
  /* a dragged strip is moved by hand but still collides, so it ploughs
     through whatever is lying in its way instead of passing through it */
  EGG.floor.tapes.forEach(t=>{
    if(!t.drag) return;
    const b=t.body, dx=t.drag.tx-b.position.x, dy=t.drag.ty-b.position.y;
    const m=Math.hypot(dx,dy)||1, s=Math.min(1, 10/m);   /* under the strip's own thickness */
    const vx=dx*s, vy=dy*s;
    t.drag.vx=vx; t.drag.vy=vy;
    Matter.Sleeping.set(b,false);
    Body.setPosition(b,{x:b.position.x+vx, y:b.position.y+vy});
    Body.setVelocity(b,{x:vx,y:vy});
    /* and rouse what it is about to reach — a pile that has been lying
       still for a while is asleep, and the sweep should wake it */
    const reach=EGG.tapeW*.8;
    const rouse=o=>{ if(o.body.isSleeping &&
      Math.hypot(o.body.position.x-b.position.x,o.body.position.y-b.position.y)<reach)
        Matter.Sleeping.set(o.body,false); };
    EGG.floor.words.forEach(rouse); EGG.floor.shards.forEach(rouse);
  });
  Engine.update(EGG.engine, 1000/60);
  /* Nothing may come to rest INSIDE the card. Giving it a body stops the
     rain going behind it, but a piece can still be squeezed through the
     top edge while a deep pile settles on it — 3 of 624 over two rounds.
     Same principle as the airtight shell: if it is somewhere it cannot be
     seen, put it back where it can. */
  if(EGG.desk){
    const d=EGG.desk.bounds;
    const lift=o=>{ const q=o.body.position;
      if(q.x>d.min.x && q.x<d.max.x && q.y>d.min.y && q.y<d.max.y){
        Matter.Sleeping.set(o.body,false);
        Body.setPosition(o.body,{x:q.x, y:d.min.y-8});
        Body.setVelocity(o.body,{x:0,y:0});
      }};
    EGG.floor.words.forEach(lift); EGG.floor.shards.forEach(lift);
  }
  /* paint */
  const S=EGG.size;
  if(EGG.on){
    EGG.els.shell.style.transform=`translate(${(EGG.x-S/2).toFixed(1)}px, ${(EGG.y-S/2).toFixed(1)}px)`;
    const tcx=EGG.x+EGG.tapeOff.x, tcy=EGG.y+EGG.tapeOff.y, gp=EGG.gripPad;
    EGG.els.tape.style.transform=
      `translate(${(tcx-EGG.tapeW/2).toFixed(1)}px, ${(tcy-EGG.tapeH/2).toFixed(1)}px) rotate(-3deg)`;
    EGG.els.grip.style.transform=
      `translate(${(tcx-EGG.tapeW/2-gp).toFixed(1)}px, ${(tcy-EGG.tapeH/2-gp).toFixed(1)}px) rotate(-3deg)`;
  }
  const put=o=>{ const b=o.body;
    o.el.style.transform=`translate(${(b.position.x-o.w/2).toFixed(1)}px, ${(b.position.y-o.h/2).toFixed(1)}px) rotate(${b.angle.toFixed(3)}rad)`; };
  EGG.words.forEach(put);
  EGG.floor.words.forEach(put);
  EGG.floor.shards.forEach(put);
  EGG.floor.tapes.forEach(t=>{ const b=t.body, gp=EGG.gripPad;
    t.el.style.transform=`translate(${(b.position.x-EGG.tapeW/2).toFixed(1)}px, ${(b.position.y-EGG.tapeH/2).toFixed(1)}px) rotate(${b.angle.toFixed(3)}rad)`;
    t.grip.style.transform=`translate(${(b.position.x-EGG.tapeW/2-gp).toFixed(1)}px, ${(b.position.y-EGG.tapeH/2-gp).toFixed(1)}px) rotate(${b.angle.toFixed(3)}rad)`; });
}
window.eggStep=(n)=>{ for(let i=0;i<n;i++) eggTick(); };   /* headless-debug hook */

/* the summons: double-click the card — its controls excepted, but the tape
   included. Nothing to clash with: a drag is press-and-move, a summon is
   two taps that do not move. (Long press was the obvious alternative for
   phones and is deliberately NOT used — it is how you pick the card up,
   and the two gestures would fight over the same handle.) */
const eggSummonable=t=>!t.closest('button,input,.tok,.slot');
function eggSummon(){ if(EGG.on) eggTakeAway(); else eggSpawn(); }
$('panel').addEventListener('dblclick', e=>{
  if(eggSummonable(e.target)) eggSummon();
});
/* A FINGER NEVER GOT THAT EVENT. On a phone the browser answers two quick
   taps with a zoom, and `touch-action`, which is supposed to turn that off,
   did not on a real device — so the page jumped and the summon never
   arrived. The pair is counted here instead, and the second tap's default
   is refused outright, which nothing can override. */
(function(){
  const panel=$('panel');
  let last=0, lx=0, ly=0, sx=0, sy=0, moved=false;
  panel.addEventListener('touchstart', e=>{
    const t=e.changedTouches[0]; sx=t.clientX; sy=t.clientY; moved=false;
  }, {passive:true});
  panel.addEventListener('touchmove', e=>{
    const t=e.changedTouches[0];
    if(Math.hypot(t.clientX-sx, t.clientY-sy)>12) moved=true;   /* a scroll or a drag */
  }, {passive:true});
  panel.addEventListener('touchend', e=>{
    if(e.touches.length) return;                    /* other fingers still down */
    const t=e.changedTouches[0], now=e.timeStamp;
    if(moved || !eggSummonable(e.target)){ last=0; return; }
    if(now-last<330 && Math.hypot(t.clientX-lx, t.clientY-ly)<40){
      e.preventDefault();                           /* ours, not a zoom */
      last=0; eggSummon();
      try{ navigator.vibrate && navigator.vibrate(6); }catch(_){}
      return;
    }
    last=now; lx=t.clientX; ly=t.clientY;
  }, {passive:false});
  window.eggTapPair=(x,y)=>{                        /* headless-debug hook */
    const mk=(type,tl)=>new TouchEvent(type,{bubbles:true,cancelable:true,
      touches:tl, changedTouches:[new Touch({identifier:1,target:panel,clientX:x,clientY:y})]});
    const tgt=document.elementFromPoint(x,y)||panel;
    tgt.dispatchEvent(mk('touchstart',[1])); tgt.dispatchEvent(mk('touchend',[]));
  };
})();
/* The mark is the way back. While it is standing aside, a click on it is
   not a replay: it calls the mark back to full strength and leaves the
   floor exactly as it is, so the next double-click pours another hundred
   on top of the last. Capture, so the replay handler underneath never
   sees that one click — every click after it replays as usual. */
loupe.el.addEventListener('click', e=>{
  /* only once the heart is gone. The egg layer lets clicks through, so a
     tap on the canvas beside an intact heart used to bring the mark back
     to full strength underneath it and the two competed for the same
     space. */
  if(!EGG.dim || EGG.on) return;
  e.stopPropagation(); e.preventDefault(); eggRestore();
}, true);
addEventListener('resize', ()=>{ if(EGG.live) eggRoom(); });

window.simStep=(n)=>{ stepSim(n); render(); };   /* headless-debug hook */
/* Self-heal: a page opened in a background tab boots with zero-sized
   boxes, builds its walls at that size, and then looks broken when it is
   finally shown. No resize event fires for that, so the world checks its
   own footing now and then and rebuilds if the box it was built for is
   not the box it is standing in. */
let healT=0;
(function loop(now){
  advance(now||performance.now());
  stepSim(1); render(); eggTick();
  if(++healT>=90){
    healT=0;
    if(engine && Math.abs(lbox.clientWidth-WORLD_W)>40 && lbox.clientWidth>160) relayout();
  }
  requestAnimationFrame(loop);
})();

/* everything needs its path resolved first (hanzi arrive async) */
Promise.all(GLYPHS.map(glyphPath)).then(()=>{
  buildWorld(); buildBox(); pourAll();
  paintSlot('from'); paintSlot('to'); rebuild();
  if(window.ResizeObserver){
    const ro=new ResizeObserver(relayout);
    ro.observe($('loupe'));    /* the mark's canvas */
    ro.observe(lbox);          /* the pool's walls  */
  }
});

/* ── panel ── */
let scrubbing=false;
Object.keys(BRUSHES).forEach(k=>{
  const b=document.createElement('button');
  b.textContent=k; if(k===P.brush) b.classList.add('on');
  b.onclick=()=>{
    P.brush=k;
    $('secBrush').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
    spots.forEach(s=>{s.style(); s.setProgress(CTRL.p);});
  };
  $('secBrush').appendChild(b);
});
const cPick=$('cPick'), cWrap=$('cWrap');
function paintColor(hex, chosen){
  P.color=hex;
  $('secCol').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===chosen));
  cWrap.classList.toggle('on', chosen===cWrap);
  spots.forEach(s=>{s.style(); s.setProgress(CTRL.p);});
}
COLORS.forEach(([name,hex])=>{
  const b=document.createElement('button');
  b.style.background=hex; b.title=name;
  if(hex===P.color) b.classList.add('on');
  b.onclick=()=>paintColor(hex,b);
  $('secCol').insertBefore(b, cWrap);      /* the picker stays last */
});
cPick.addEventListener('input', e=>paintColor(e.target.value, cWrap));
$('rDur').oninput=e=>{ P.dur=+e.target.value; $('vDur').textContent=P.dur; };
$('rW').oninput=e=>{ P.width=+e.target.value; $('vW').textContent=P.width.toFixed(1); spots.forEach(s=>{s.style(); s.setProgress(CTRL.p);}); };
$('rP').addEventListener('input',e=>{
  scrubbing=true;
  CTRL.playing=false;
  spots.forEach(s=>s.el.classList.remove('idle'));
  CTRL.p=+e.target.value/1000;
  spots.forEach(s=>s.setProgress(CTRL.p));
});
$('rP').addEventListener('change',()=>{ scrubbing=false; idleness(); });
$('replay').onclick=()=>{ CTRL.p=0; apply(); go(1); };

/* ── export ──
   The animation is sampled off the live preview rather than re-derived, so
   the file always matches exactly what you just watched. SMIL carries the
   frames, which keeps the SVG self-contained and playable on its own. */
function save(name, text){
  const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));
  const a=document.createElement('a');
  a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function stamp(){ return `${FORMULA.from}-to-${FORMULA.to}`; }
function svgHead(S){
  const vb=S.el.querySelector('svg').getAttribute('viewBox');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="640">`;
}
function glyphGroups(S, fromD, toD){
  const gf=S.el.querySelector('.gf').getAttribute('transform');
  const gt=S.el.querySelector('.gt').getAttribute('transform');
  const b=BRUSHES[P.brush];
  /* the brush goes into the file too — it is half of what is on screen, and
     the whole promise of this export is that the file is what you watched */
  const st=(k,id)=>`fill="none" stroke="${P.color}" stroke-width="${(P.width*b.mul/k).toFixed(2)}"`+
              ` stroke-linecap="${b.cap}" stroke-linejoin="round" opacity="${b.op}"`+
              (id?` filter="url(#${id})"`:'');
  const defs=['f','t'].map(t=>S.fx&&S.fx[t]?(document.getElementById(S.fx[t])||{}).outerHTML||'':'')
                      .filter(Boolean).join('\n    ');
  return {gf, gt,
    defs: defs?`\n  <defs>\n    ${defs}\n  </defs>`:'',
    stFrom:st(S.f.k, S.fx&&S.fx.f), stTo:st(S.t.k, S.fx&&S.fx.t)};
}
function buildStillSVG(){
  const S=loupe, g=glyphGroups(S);
  const paths=S.tp.map(o=>`<path d="${o.el.getAttribute('d')}" ${g.stTo}/>`).join('');
  return `${svgHead(S)}${g.defs}\n  <g transform="${g.gt}">${paths}</g>\n</svg>\n`;
}
function buildAnimatedSVG(){
  const S=loupe, N=96, keep=CTRL.p;
  const g=glyphGroups(S);
  /* sample the live preview, one track per stroke, so the file replays
     exactly what was on screen — pen lifts and all */
  const trk=parts=>parts.map(()=>({da:[],off:[],vis:[]}));
  const f=trk(S.fp), t=trk(S.tp), dot={cx:[],cy:[],vis:[]};
  for(let i=0;i<=N;i++){
    S.setProgress(i/N);
    S.fp.forEach((o,j)=>{ f[j].da.push(o.el.style.strokeDasharray||'none');
      f[j].off.push(o.el.style.strokeDashoffset||'0'); f[j].vis.push(o.el.style.visibility||'visible'); });
    S.tp.forEach((o,j)=>{ t[j].da.push(o.el.style.strokeDasharray||'none');
      t[j].off.push(o.el.style.strokeDashoffset||'0'); t[j].vis.push(o.el.style.visibility||'visible'); });
    dot.cx.push(S.dot.getAttribute('cx')||0);
    dot.cy.push(S.dot.getAttribute('cy')||0);
    dot.vis.push(S.dot.style.visibility||'hidden');
  }
  S.setProgress(keep);
  const times=Array.from({length:N+1},(_,i)=>(i/N).toFixed(4)).join(';');
  const dur=(P.dur/1000).toFixed(2)+'s';
  /* discrete for visibility, linear for the rest — the eased clock is
     already baked into the sampled values */
  const anim=(attr,vals,calc)=>
    `<animate attributeName="${attr}" values="${vals.join(';')}" keyTimes="${times}"`+
    ` dur="${dur}" ${calc?'calcMode="discrete" ':''}repeatCount="indefinite" fill="freeze"/>`;
  const strokes=(parts,tracks,st)=>parts.map((o,j)=>
    `<path d="${o.el.getAttribute('d')}" ${st}>`+
    anim('stroke-dasharray',tracks[j].da)+
    anim('stroke-dashoffset',tracks[j].off)+
    anim('visibility',tracks[j].vis,true)+
    `</path>`).join('\n    ');
  const r=Math.max(1.2,P.width*BRUSHES[P.brush].mul*.55).toFixed(2);
  return `${svgHead(S)}${g.defs}
  <g transform="${g.gf}">
    ${strokes(S.fp,f,g.stFrom)}
  </g>
  <g transform="${g.gt}">
    ${strokes(S.tp,t,g.stTo)}
  </g>
  <circle r="${r}" fill="${P.color}" opacity="${BRUSHES[P.brush].op}">
    ${anim('cx',dot.cx)}
    ${anim('cy',dot.cy)}
    ${anim('visibility',dot.vis,true)}
  </circle>
</svg>
`;
}
$('dlSvg').onclick=()=>save(`${stamp()}-animated.svg`, buildAnimatedSVG());
$('dlStill').onclick=()=>save(`${stamp()}-still.svg`, buildStillSVG());

/* ── the taped-on dashboard: grab the tape, park it anywhere ── */
const panel=$('panel');
/* A card that has been parked by hand is pinned in pixels, so it does not
   follow the window any more — shrink far enough and it is off the edge.
   Only a parked card is touched; one still on its CSS anchors is left to
   the stylesheet, which is where the responsive layout lives. */
/* ── the mark follows the card ──
   The strip the mark lives in is "whatever the card leaves free". Once the
   card is picked up and parked somewhere else, that space moves — so the
   strip is recomputed from the card's LIVE edges, taking whichever side of
   it is larger. Until the card is first touched, the CSS default rules the
   layout; on the narrow bottom-sheet layout the CSS always rules. */
function placeStrip(){
  const els=[$('loupe'), $('footer')];
  const wide=matchMedia('(min-width:981px)').matches;
  if(!wide || !panel.style.left){
    els.forEach(el=>{ el.style.left=''; el.style.right=''; });
    return;
  }
  const pn=panel.getBoundingClientRect();
  const leftSpace=pn.left, rightSpace=innerWidth-pn.right;
  if(leftSpace>=rightSpace){
    els.forEach(el=>{ el.style.left='0px'; el.style.right=(innerWidth-pn.left)+'px'; });
  } else {
    els.forEach(el=>{ el.style.left=pn.right+'px'; el.style.right='0px'; });
  }
}
function parkPanel(){
  if(!panel.style.left) return;
  const w=panel.offsetWidth;
  panel.style.left=Math.min(innerWidth-80, Math.max(80-w, parseFloat(panel.style.left)))+'px';
  panel.style.top =Math.min(innerHeight-40, Math.max(18, parseFloat(panel.style.top)||0))+'px';
}
$('tape').addEventListener('pointerdown', e=>{
  e.preventDefault();
  $('tape').setPointerCapture(e.pointerId);
  const start={x:e.clientX, y:e.clientY};
  let live=false, px=0, py=0;
  /* A TAP IS NOT A DRAG. The card used to re-anchor itself the instant the
     tape was touched, so merely tapping the handle took it out of the
     responsive layout — and on a phone, double-tapping the tape to summon
     the egg picked the card up twice as a side effect. Nothing happens
     until the hand actually moves. */
  const engage=()=>{
    /* anchored by CSS `right` until first grabbed; then it lives where you park it.
       The width has to be pinned at the same moment: on the narrow layout the
       card is stretched between left AND right, so dropping `right` would
       collapse it to fit-content the instant you picked it up.

       MEASURE THE LAYOUT BOX, NOT THE BOUNDING RECT. The card is laid askew
       (-0.45deg) and getBoundingClientRect reports the AXIS-ALIGNED box of a
       rotated element — 10.8px wider than the card, and shifted left by half
       of that. Pinning style.width to it grew the card 5.4px on EVERY grab
       (434.8 -> 440.2 -> 445.6 -> 451.0 over four, measured), and pinning
       left/top jolted it 3px sideways each time. A rotation about the centre
       leaves the centre the one thing that box reports faithfully: take the
       centre from it, and the size from the layout box.
       (offsetLeft/offsetTop are no use here either — the card is fixed, so
       its offsetParent is null.) */
    const r=panel.getBoundingClientRect();
    const w=panel.offsetWidth, h=panel.offsetHeight;
    const lx=r.left+r.width/2-w/2, ly=r.top+r.height/2-h/2;
    panel.style.width=w+'px';
    panel.style.left=lx+'px';
    panel.style.top=ly+'px';
    panel.style.right='auto'; panel.style.bottom='auto';   /* narrow anchors it by the foot */
    /* the grab point is where the hand LANDED, not where it has got to,
       or the card jumps by the slack the moment it comes alive */
    px=start.x-lx; py=start.y-ly;
    live=true;
  };
  const move=ev=>{
    if(!live){
      if(Math.hypot(ev.clientX-start.x, ev.clientY-start.y)<4) return;
      engage();
    }
    panel.style.left=Math.min(innerWidth-80, Math.max(80-panel.offsetWidth, ev.clientX-px))+'px';
    panel.style.top =Math.min(innerHeight-40, Math.max(18, ev.clientY-py))+'px';
    placeStrip();                     /* the mark keeps to the free side, live */
  };
  const up=()=>{
    $('tape').removeEventListener('pointermove',move);
    $('tape').removeEventListener('pointerup',up);
    if(!live) return;                 /* it was a tap — leave the layout alone */
    placeStrip();
    rebuild();                        /* refit the mark to the strip it now has */
  };
  $('tape').addEventListener('pointermove',move);
  $('tape').addEventListener('pointerup',up);
});
