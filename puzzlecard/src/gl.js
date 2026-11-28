// WebGL2 renderer: cutting mat + tray, soft shadows, lit pieces (and the uncut slab).
const NOISE = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }`;

// u_rot spins the quad about its own centre (scatter tumble); u_tilt = (about X, about Y) around u_pivot
// with mild perspective (finished puzzle held up to the light).
const VS_QUAD = `#version 300 es
in vec2 a_pos; uniform vec2 u_res; uniform vec4 u_rect; uniform vec4 u_uv; uniform vec2 u_pivot; uniform vec2 u_tilt; uniform float u_rot;
uniform float u_squash;   // width factor while a piece flips over (|cos| of the flip angle)
uniform float u_mirror;   // 1 = seen from the back: the outline is mirrored
out vec2 v_uv; out vec2 v_px; out vec2 v_local; out vec3 v_pos3;
void main(){
  vec2 ap = vec2(mix(a_pos.x, 1.0 - a_pos.x, u_mirror), a_pos.y);
  vec2 c = u_rect.xy + 0.5*u_rect.zw;
  vec2 d = (a_pos - 0.5) * u_rect.zw; d.x *= u_squash;
  float cr = cos(u_rot), sr = sin(u_rot);
  vec2 px = c + vec2(cr*d.x - sr*d.y, sr*d.x + cr*d.y);
  vec3 p = vec3(px - u_pivot, 0.0);
  float cy = cos(u_tilt.y), sy = sin(u_tilt.y); p = vec3(cy*p.x + sy*p.z, p.y, -sy*p.x + cy*p.z);
  float cx = cos(u_tilt.x), sx = sin(u_tilt.x); p = vec3(p.x, cx*p.y - sx*p.z, sx*p.y + cx*p.z);
  // real perspective divide (w), so overlapping pieces interpolate their textures consistently
  float w = (1400.0 - p.z) / 1400.0;
  vec2 scr = u_pivot + p.xy / w;
  v_px = scr; v_pos3 = vec3(scr, p.z); v_local = ap; v_uv = mix(u_uv.xy, u_uv.zw, ap);
  gl_Position = vec4((scr.x/u_res.x*2.0-1.0)*w, (1.0-scr.y/u_res.y*2.0)*w, 0.0, w); }`;

const FS_MAT = `#version 300 es
precision highp float;
// (dFdx/dFdy are core in GLSL ES 3.0)
uniform vec2 u_res; uniform float u_dpr; uniform vec3 u_light; uniform vec4 u_tray; uniform float u_time;
uniform vec3 u_mat; uniform vec3 u_trayColor; uniform float u_hold; uniform vec4 u_holdRect; uniform float u_trayAmt;
uniform vec4 u_sheet; uniform float u_sheetAmt;   // the cutting mat the picture rides on through the machine
uniform vec4 u_ripple;    // celebration: one faint band of pale light crossing the mat (band x, pivot y, half-width, strength)
out vec4 o; ${NOISE}
void main(){
  vec2 px = vec2(gl_FragCoord.x / u_dpr, u_res.y - gl_FragCoord.y / u_dpr);
  vec2 size = u_res;
  // dark cutting-mat: grain + mottling + a faint grid
  float n = noise(px*1.9)*0.45 + noise(px*4.3)*0.3 + noise(px*9.0)*0.25;
  float grain = hash(floor(px*u_dpr)) - 0.5;
  vec3 col = u_mat * (0.92 + 0.36*(n-0.5)) + grain*0.075;   // more mottling and tooth in the mat
  vec2 g = abs(fract(px/44.0 + 0.5) - 0.5) * 44.0;
  float line = 1.0 - smoothstep(0.0, 1.1, min(g.x, g.y));
  col += vec3(0.042, 0.045, 0.05) * line;                    // the grid stays, but quieter
  // the last piece clicked in: a soft, slightly slanted band of pale light passes over the mat once and lifts the
  // grid a little as it goes (no colour, no ring: the orange ripple was too loud for this object)
  float band = (1.0 - smoothstep(0.0, u_ripple.z, abs(px.x + (px.y - u_ripple.y) * 0.3 - u_ripple.x))) * u_ripple.w;
  col += vec3(0.86, 0.89, 0.96) * band * band * (0.10 * line + 0.014);
  // light pool
  float d = distance(px, u_light.xy);
  float pool = exp(-(d*d)/(2.0*pow(0.62*max(size.x,size.y),2.0)));
  col *= 0.74 + 0.46*pool;
  // the box: the base of a puzzle box with the lid off — shallow, thin card walls, a pale raw-card edge,
  // big soft corners, one orange dot on the front wall
  {
    vec2 c = u_tray.xy + u_tray.zw*0.5, hf = u_tray.zw*0.5;   // ('half' is a reserved word in GLSL)
    float R = 26.0, WALL = 9.0;
    vec2 q = abs(px - c) - (hf - R);
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - R;   // signed distance to the outer rounded rect
    vec2 n = normalize(vec2(dFdx(sd), dFdy(sd)) + 1e-5);
    vec2 toL = normalize(u_light.xy - c);
    vec3 wall = vec3(0.165, 0.17, 0.19);                  // charcoal printed card, same family as the cutter
    vec3 edge = vec3(0.40, 0.37, 0.31);                   // the raw cardboard showing on the cut top edge (kept quiet)
    vec3 floorC = vec3(0.125, 0.128, 0.145);
    vec3 b = col;
    if (sd < -WALL) {                                     // floor: plain card with a narrow soft shadow along the walls
      float din = -sd - WALL;
      float sh = (1.0 - smoothstep(0.0, 14.0, din)) * (0.5 + 0.5*max(0.0, dot(n, toL)));
      b = floorC * (0.97 + 0.06*(noise(px*3.1)-0.5)) + grain*0.025;
      b *= 1.0 - 0.35*sh;
      b *= 0.84 + 0.3*pool;
    } else if (sd < 0.0) {                                // wall top: charcoal band with the pale cut edge on the outside
      float t = (-sd) / WALL;                             // 0 at the outer edge, 1 at the inner edge
      float lit = 0.5 + 0.5*dot(-n, toL);
      b = wall * (0.9 + 0.2*lit) + grain*0.02;
      float cutEdge = 1.0 - smoothstep(1.6, 2.6, -sd);    // ~2px of raw card
      b = mix(b, edge * (0.9 + 0.15*lit), cutEdge);
      b *= 1.0 - 0.25*(1.0 - smoothstep(0.0, 2.0, WALL + sd));     // a hairline of shadow where wall meets floor
      b *= 0.88 + 0.26*pool;
    } else {                                              // outside: a faint contact shadow on the mat
      float ao = (1.0 - smoothstep(0.0, 14.0, sd)) * 0.35;
      b = col * (1.0 - ao);
    }
    col = mix(col, b, u_trayAmt);
  }
  // the backing board the picture is mounted on: plain, dark, a shade lighter than the mat, with a lit edge
  if (u_sheetAmt > 0.001) {
    vec2 smin = u_sheet.xy, smax = u_sheet.xy + u_sheet.zw;
    vec2 ds = max(smin - px, px - smax); float sds = max(ds.x, ds.y);
    // the board stands a little off the mat: a soft shadow, dropped downward
    vec2 ps = px - vec2(0.0, 10.0);
    vec2 ds2 = max(smin - ps, ps - smax); float sd2 = max(ds2.x, ds2.y);
    col *= 1.0 - u_sheetAmt * 0.55 * (1.0 - smoothstep(-4.0, 26.0, sd2));
    if (sds < 0.0) {
      vec3 m = vec3(0.19, 0.195, 0.215) * (0.97 + 0.06*(noise(px*2.7)-0.5)) + grain*0.03;
      m += vec3(0.05) * (1.0 - smoothstep(0.0, 1.5, -sds));
      m *= 0.84 + 0.3*pool;
      col = mix(col, m, u_sheetAmt);
    }
  }
  // one soft shadow under a slab (the uncut photo, or the finished puzzle floating)
  if (u_hold > 0.001) {
    vec2 hmin = u_holdRect.xy, hmax = u_holdRect.xy + u_holdRect.zw;
    vec2 toL2 = normalize(u_light.xy - (hmin+hmax)*0.5);
    vec2 off = -toL2 * (4.0 + 12.0*u_hold) + vec2(0.0, 3.0 + 8.0*u_hold);
    vec2 ddS = max(hmin + off - px, px - (hmax + off)); float sdS = max(ddS.x, ddS.y);
    float blur = 6.0 + 22.0*u_hold;
    float sh = 1.0 - smoothstep(-blur*0.25, blur, sdS);
    col *= 1.0 - (0.3 + 0.25*u_hold)*sh;
  }
  vec2 q = px / size; float v = 1.0 - 0.38*pow(distance(q, vec2(0.5)), 1.7);
  o = vec4(col*v, 1.0);
}`;

const FS_SHADOW = `#version 300 es
precision highp float;
in vec2 v_uv; uniform sampler2D u_norm; uniform float u_lod; uniform float u_alpha;
out vec4 o;
void main(){ float a = textureLod(u_norm, v_uv, u_lod).a * u_alpha; o = vec4(0.0,0.0,0.0,a); }`;

const FS_PIECE = `#version 300 es
precision highp float;
in vec2 v_uv; in vec2 v_px; in vec2 v_local; in vec3 v_pos3;
uniform sampler2D u_color; uniform sampler2D u_norm;
uniform vec3 u_light; uniform float u_lift; uniform float u_clarity; uniform float u_finish; uniform float u_time;
uniform vec4 u_print; uniform vec2 u_tilt; uniform vec2 u_pivot; uniform float u_scale;
uniform float u_cut;      // 0 = uncut slab (flat, no seams) … 1 = fully cut piece
uniform float u_glue;     // 0 … 1 varnish: seams fade, surface goes glossy
uniform float u_rim;      // 0 = still flush on the cut sheet (seams only), 1 = free piece (cut faces show)
uniform float u_flash;    // 0 … 1 seam glint (a piece just clicked in / the completion wave)
uniform float u_frostAmt; // how soft an unplaced piece gets (1 for Frosted, less for the others)
uniform float u_rot;      // the piece's spin (so the bevel is lit correctly when it lies askew)
uniform float u_back;     // 1 = face down: plain card back instead of the print
uniform float u_preview;  // start screen: faint engraved hint of where the cuts will go
uniform sampler2D u_letter; uniform vec2 u_printSize; uniform float u_letterAmt;   // the letter written across the back of the print (alpha = ink)
uniform vec4 u_sweep;    // the light passing over the page when the puzzle is done: band x, pivot y, half-width, strength
uniform vec3 u_lines; uniform float u_reveal;   // line top / pitch / count (in print uv), and how far the writing has got (>1.2 = all of it)
out vec4 o; ${NOISE}
vec3 rainbow(float t){ return clamp(abs(fract(t + vec3(0.0, 2.0/3.0, 1.0/3.0))*6.0 - 3.0) - 1.0, 0.0, 1.0); }
vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))))*43758.5453); }
// Metallic flecks in print space: sparse flakes (gold leaf) or dense points (glitter).
// Each fleck is a tiny tilted facet, so it flashes only when the light lines up.
vec3 flecks(vec2 P, float cellSize, float density, float radius, float tiltAmt, float shine, vec3 N, vec3 L, vec3 V, float goldBias){
  vec2 cell = floor(P / cellSize), f = fract(P / cellSize);
  vec3 acc = vec3(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(i, j);
    vec2 r = hash2(c);
    if (r.x > density) continue;
    vec2 r2 = hash2(c + 17.0);
    vec2 centre = vec2(i, j) + 0.2 + 0.6*r2;
    float d = length(f - centre) * cellSize;
    float rad = radius * (0.6 + 0.8*r.y) * (0.75 + 0.5*noise(P*0.6 + c));
    float inside = 1.0 - smoothstep(rad*0.7, rad, d);
    if (inside <= 0.0) continue;
    vec2 tilt = (hash2(c + 43.0) - 0.5) * 2.0 * tiltAmt;
    vec3 fN = normalize(N + vec3(tilt, 0.0));
    vec3 H = normalize(L + V);
    float flash = pow(max(dot(fN, H), 0.0), shine);
    float isGold = step(goldBias, r2.x);
    vec3 tint = mix(vec3(0.92, 0.94, 0.98), vec3(1.0, 0.80, 0.38), isGold);
    acc += tint * (0.08 + 1.1*flash) * inside;
  }
  return acc;
}
void main(){
  vec4 nm = texture(u_norm, v_uv);
  float mask = nm.a;
  if (mask < 0.004) discard;
  float seam = u_cut * (1.0 - 0.92*u_glue);
  vec3 N = normalize(vec3((nm.rg*2.0-1.0)*seam, 1.0));
  float h = mix(1.0, nm.b, u_cut);
  // u_finish: 0 matte card, 1 frosted acrylic, 2 holographic foil, 3 film-grain print, 4 riso print
  float isFrost = 1.0 - step(0.5, abs(u_finish - 1.0));
  float isHolo  = 1.0 - step(0.5, abs(u_finish - 2.0));
  float isGrain = 1.0 - step(0.5, abs(u_finish - 3.0));
  float isRiso  = 1.0 - step(0.5, abs(u_finish - 4.0));
  // the back of a piece is plain card whatever the finish
  isFrost *= 1.0 - u_back; isHolo *= 1.0 - u_back; isGrain *= 1.0 - u_back; isRiso *= 1.0 - u_back;
  // the bevel normal follows the piece's spin (and mirrors when seen from the back)
  N.x *= 1.0 - 2.0*u_back;
  { float cr = cos(u_rot), sr = sin(u_rot); N = vec3(cr*N.x - sr*N.y, sr*N.x + cr*N.y, N.z); }
  // loose pieces are soft; frosted acrylic stays a little milky even when placed
  float frost = max(1.0 - u_clarity, 0.22*isFrost) * u_frostAmt;
  float whiten = frost * isFrost;
  // rotate the normal with the finished-puzzle tilt
  float cy = cos(u_tilt.y), sy = sin(u_tilt.y); N = vec3(cy*N.x + sy*N.z, N.y, -sy*N.x + cy*N.z);
  float cx = cos(u_tilt.x), sx = sin(u_tilt.x); N = vec3(N.x, cx*N.y - sx*N.z, sx*N.y + cx*N.z);
  // surface micro-relief: paper fibre (matte), sand-blasted grain (frosted), near-smooth foil (holo)
  vec2 fp = v_px * mix(1.6, 3.2, isFrost);
  float fx = noise(fp+vec2(0.6,0.0)) - noise(fp-vec2(0.6,0.0));
  float fy = noise(fp+vec2(0.0,0.6)) - noise(fp-vec2(0.0,0.6));
  float relief = 0.26 * (1.0 - isFrost) * (1.0 - isHolo) + 0.10*isFrost + 0.05*isHolo;
  N = normalize(N + vec3(fx, fy, 0.0) * relief * (1.0 - 0.6*u_glue));
  // albedo: sharp vs soft (blurred; Frosted also lifts and desaturates — still legible)
  vec3 sharp = texture(u_color, v_uv).rgb;
  vec3 soft = textureLod(u_color, v_uv, mix(1.5, 2.3, isFrost)).rgb;
  vec3 alb = mix(sharp, soft, frost);
  vec2 Pp = u_print.xy + v_local * u_print.zw;   // print px, for effects that live in the print
  if (isRiso > 0.5) {
    // riso: two ink drums slightly out of register, coarse ink grain, a touch of posterising
    vec2 du = vec2(2.2 / float(textureSize(u_color, 0).x), 1.4 / float(textureSize(u_color, 0).y));
    float r = texture(u_color, v_uv + du).r, b = texture(u_color, v_uv - du).b;
    alb = vec3(r, alb.g, b);
    alb = mix(alb, floor(alb * 9.0 + 0.5) / 9.0, 0.45);
    alb *= 0.9 + 0.2 * (hash(floor(Pp * 0.8)) - 0.5) + 0.06 * (noise(Pp * 0.15) - 0.5);
    alb = alb * vec3(1.0, 0.97, 0.9) + vec3(0.03, 0.025, 0.0);
  }
  if (isGrain > 0.5) {
    // film grain: heavy luminance grain, strongest in the mid-tones, slightly crushed and desaturated
    float l0 = dot(alb, vec3(0.299,0.587,0.114));
    float gr = (hash(floor(Pp * 0.9)) - 0.5) * 0.9 + (hash(floor(Pp * 0.45) + 7.0) - 0.5) * 0.5;
    float amt = 0.16 * (1.0 - abs(l0 - 0.45) * 1.2);
    alb = mix(vec3(l0), alb, 0.82);
    alb = (alb - 0.5) * 1.12 + 0.46 + gr * max(amt, 0.04);
    alb = clamp(alb, 0.0, 1.0);
  }
  // face down: grey-board card back with a little fibre
  vec3 backCol = vec3(0.76, 0.74, 0.70) * (0.95 + 0.10 * noise(v_px * 0.7) + 0.05 * noise(v_px * 3.1));
  // a letter written across the back of the whole print: every piece carries its part of it (mirrored, since
  // the back is the print seen from behind), so pieces lying face down in the box show scraps of handwriting
  vec2 buv = vec2(1.0 - Pp.x / u_printSize.x, Pp.y / u_printSize.y);
  float ink = texture(u_letter, buv).a * u_letterAmt;
  // it writes itself in: line after line, left to right; the signature (below the last line) comes last
  float li = floor((buv.y - u_lines.x) / u_lines.y);
  float rp = li < u_lines.z ? (li + buv.x) / u_lines.z : 1.0 + 0.08 * buv.x;
  ink *= 1.0 - smoothstep(u_reveal - 0.02, u_reveal, rp);
  backCol = mix(backCol, vec3(0.13, 0.12, 0.16) * (0.9 + 0.2 * noise(v_px * 1.3)), ink * 0.9);
  alb = mix(alb, backCol, u_back);
  float lum = dot(alb, vec3(0.299,0.587,0.114));
  vec3 milky = mix(vec3(lum), alb, 0.72) * 0.82 + vec3(0.17);
  alb = mix(alb, milky, whiten);
  alb *= mix(vec3(1.0), vec3(1.0, 0.985, 0.962), (1.0 - isFrost) * (1.0 - isHolo));   // warm paper stock
  // varnish deepens the colours a touch
  alb = mix(alb, clamp(mix(vec3(lum), alb, 1.08) * 1.04, 0.0, 1.0), u_glue);
  // cut face: card core (matte), lit acrylic edge (frosted), grey foil edge (holo); gone under glue
  vec3 core = vec3(0.965, 0.955, 0.93);
  core = mix(core, vec3(1.0), isFrost);
  core = mix(core, vec3(0.70, 0.72, 0.75), isHolo);
  float rimAmt = 0.3 + 0.15*isFrost;
  alb = mix(alb, core, (1.0 - smoothstep(0.0, 0.22, h)) * rimAmt * u_cut * u_rim * (1.0 - u_glue));
  // the kerf: the outermost sliver of every cut piece falls into shadow, so two neighbours together draw
  // one thin dark line in the middle of the seam (glue fills it)
  alb *= 1.0 - 0.55 * (1.0 - smoothstep(0.0, 0.3, nm.b)) * u_cut * (1.0 - u_glue);
  // lighting
  vec3 L = normalize(u_light - v_pos3);
  vec3 V = normalize(vec3(u_pivot - v_pos3.xy, 1400.0 - v_pos3.z));
  vec3 H = normalize(L + V);
  float ndl = max(dot(N, L), 0.0);
  float ndh = max(dot(N, H), 0.0);
  // print-space position: flecks and foil grating are printed on the picture, so they scale with it
  vec2 P = u_print.xy + v_local * u_print.zw;
  vec3 col;
  if (isHolo > 0.5) {
    // Holographic foil, physically: the print is translucent ink on a grey metal foil with a micro-grating.
    // What you see is the foil's reflection filtered by the ink — so colours only appear inside the highlight,
    // and dark ink stays dark. The grating's hue depends on how far the half-vector leans off the normal
    // along the grating direction (first-order diffraction), which is what makes it slide with the light.
    vec2 gdir = normalize(vec2(0.86, 0.5));
    float lean = dot(H.xy - N.xy, gdir);
    float band = lean * 5.0 + (P.x*0.5 + P.y*0.3) * 0.003;
    vec3 rb = rainbow(band);
    float lobe = pow(ndh, 28.0);
    vec3 foil = vec3(0.46) * (0.72 + 0.28*ndl)             // grey metal, mostly ambient
              + mix(vec3(0.55), rb, 0.8) * lobe * 0.55      // diffraction colours live only inside the highlight
              + vec3(1.0) * pow(ndh, 160.0) * 0.22;          // mirror hot spot
    vec3 ink = mix(alb, vec3(lum), 0.12);
    col = ink * foil * 1.4;
    col += (hash(floor(v_px*2.0)) - 0.5) * 0.03;
  } else {
    float diff = 0.64 + 0.36*ndl;
    float shin = mix(12.0, 70.0, isFrost) + 30.0*isGrain;          // the grainy print is a glossier photo paper
    float specK = mix(0.07, 0.20, isFrost) + 0.06*isGrain - 0.03*isRiso;
    float spec = pow(ndh, shin) * specK + isFrost * pow(ndh, 4.0) * 0.08;   // frosted acrylic also glows softly around the light
    col = alb * diff + spec;
  }
  col += u_glue * (pow(ndh, 24.0) * 0.10 + pow(ndh, 200.0) * 0.14);   // varnish: broad sheen + a tight hot spot
  // The light that crosses the page once when the puzzle is finished. It is the same band the mat shows faintly;
  // a printed card is smoother than the mat, so it throws more of it back, and the glossier the finish (acrylic,
  // foil, varnish) the brighter the reflection. The card back is rough board: it answers like the mat does.
  { float bd = (1.0 - smoothstep(0.0, u_sweep.z, abs(v_px.x + (v_px.y - u_sweep.y) * 0.3 - u_sweep.x))) * u_sweep.w;
    float gloss = (0.11 + 0.10*isFrost + 0.16*isHolo + 0.05*isGrain + 0.12*u_glue) * (1.0 - 0.7*u_back);
    col += (alb * 0.4 + vec3(0.86, 0.89, 0.96) * 0.6) * bd * bd * gloss; }
  // metallic flecks (print px): gold leaf flakes on everything, silver glitter densest on foil
  float flakeD = 0.035 + 0.02*isHolo, glitterD = 0.04 + 0.14*isHolo;
  vec3 fl = flecks(P, 22.0, flakeD, 5.0, 0.35, 48.0, N, L, V, 0.25)
          + flecks(P, 5.0, glitterD, 1.1, 0.6, 160.0, N, L, V, 0.9);
  col += fl * mask * (1.0 - 0.55*frost) * (1.0 - 0.4*isHolo);
  col *= 1.0 + 0.06*u_lift;
  // seam glint: the bevel band catches a warm light for a moment
  col += u_flash * vec3(1.0, 0.9, 0.78) * 0.55 * (1.0 - smoothstep(0.0, 0.4, nm.b)) * u_cut;
  // start screen: the coming cuts as faint engraved lines (the bevel band, darkened a little)
  // (a hairline at the very edge of each piece, nudged toward mid-grey so it stays faint on sky and on shadow alike)
  col *= 1.0 - u_preview * 0.3 * (1.0 - smoothstep(0.0, 0.3, nm.b));
  o = vec4(col*mask, mask);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'a_pos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, alpha: false });
  if (!gl) throw new Error('WebGL2 unavailable');
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const mat = program(gl, VS_QUAD, FS_MAT), shadow = program(gl, VS_QUAD, FS_SHADOW), piece = program(gl, VS_QUAD, FS_PIECE);

  let texColor = null, texNorm = null, texPrint = null;
  // src: a canvas, or {data: Uint8Array RGBA, width, height} (raw upload keeps un-premultiplied normals intact)
  const upload = (src, old) => {
    const t = old || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (src.data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, src.width, src.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  // a flat "normal map" for the uncut slab: straight-up normal, full height, full mask
  let texFlat = upload({ data: new Uint8Array([128, 128, 255, 255]), width: 1, height: 1 });
  const BLANK = { data: new Uint8Array([0, 0, 0, 0]), width: 1, height: 1 };
  let texLetter = upload(BLANK);   // the letter on the back (transparent = nothing written)

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const setPiece = (p) => {
    gl.uniform4fv(piece.u.u_rect, p.rect); gl.uniform4fv(piece.u.u_uv, p.uv); gl.uniform4fv(piece.u.u_print, p.print);
    gl.uniform1f(piece.u.u_lift, p.lift); gl.uniform1f(piece.u.u_clarity, p.clarity); gl.uniform1f(piece.u.u_rot, p.rot || 0);
    gl.uniform1f(piece.u.u_cut, p.cut); gl.uniform1f(piece.u.u_glue, p.glue || 0); gl.uniform1f(piece.u.u_scale, p.scale);
    gl.uniform1f(piece.u.u_squash, p.squash ?? 1); gl.uniform1f(piece.u.u_mirror, p.back ? 1 : 0);
    gl.uniform1f(piece.u.u_back, p.back ? 1 : 0); gl.uniform1f(piece.u.u_preview, p.preview || 0); gl.uniform1f(piece.u.u_rim, p.rim ?? 1); gl.uniform1f(piece.u.u_flash, p.flash || 0);
  };

  return {
    gl,
    setAtlases(colorAtlas, normalAtlas, previewNormal) {
      texColor = upload(colorAtlas, texColor); texNorm = upload(normalAtlas, texNorm);
      if (previewNormal) texFlat = upload(previewNormal, texFlat);   // the slab's "normal map": flat, with the seam map in its height channel
    },
    setPrint(printCanvas) { texPrint = upload(printCanvas, texPrint); },
    setLetter(letterCanvas) { texLetter = upload(letterCanvas || BLANK, texLetter); },
    resize(w, h, dpr) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); gl.viewport(0, 0, canvas.width, canvas.height); },
    draw(sc) {
      const res = [sc.w, sc.h];
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
      gl.useProgram(mat.p);
      gl.uniform2fv(mat.u.u_res, res); gl.uniform1f(mat.u.u_dpr, sc.dpr);
      gl.uniform3fv(mat.u.u_light, sc.light); gl.uniform4fv(mat.u.u_tray, sc.tray); gl.uniform1f(mat.u.u_time, sc.time);
      gl.uniform3fv(mat.u.u_mat, sc.matColor); gl.uniform3fv(mat.u.u_trayColor, sc.trayColor);
      gl.uniform1f(mat.u.u_hold, sc.hold || 0); gl.uniform4fv(mat.u.u_holdRect, sc.holdRect || [0, 0, 0, 0]); gl.uniform1f(mat.u.u_trayAmt, sc.trayAmt);
      gl.uniform4fv(mat.u.u_sheet, sc.sheet || [0, 0, 0, 0]); gl.uniform1f(mat.u.u_sheetAmt, sc.sheetAmt || 0);
      gl.uniform4fv(mat.u.u_ripple, sc.ripple || [0, 0, 0, 0]);
      gl.uniform4f(mat.u.u_rect, 0, 0, sc.w, sc.h); gl.uniform4f(mat.u.u_uv, 0, 0, 1, 1);
      gl.uniform2f(mat.u.u_tilt, 0, 0); gl.uniform2f(mat.u.u_pivot, 0, 0); gl.uniform1f(mat.u.u_rot, 0);
      gl.uniform1f(mat.u.u_squash, 1); gl.uniform1f(mat.u.u_mirror, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!texColor) return;
      gl.enable(gl.BLEND);
      if (sc.clipTop > 0) { gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, canvas.width, Math.max(0, canvas.height - Math.round(sc.clipTop * sc.dpr))); }
      else gl.disable(gl.SCISSOR_TEST);
      // shadows
      gl.useProgram(shadow.p);
      gl.uniform2fv(shadow.u.u_res, res); gl.uniform2f(shadow.u.u_tilt, 0, 0); gl.uniform2f(shadow.u.u_pivot, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texNorm); gl.uniform1i(shadow.u.u_norm, 0);
      for (const p of sc.pieces) {
        if (!p.shadow) continue;
        gl.uniform4fv(shadow.u.u_rect, p.shadowRect); gl.uniform4fv(shadow.u.u_uv, p.uvShadow); gl.uniform1f(shadow.u.u_rot, p.rot || 0);
        gl.uniform1f(shadow.u.u_squash, p.squash ?? 1); gl.uniform1f(shadow.u.u_mirror, p.back ? 1 : 0);
        gl.uniform1f(shadow.u.u_lod, 1.2 + 2.2 * p.lift); gl.uniform1f(shadow.u.u_alpha, 0.28 + 0.22 * p.lift);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      // pieces (and the slab, which is drawn with the same program on the whole print)
      gl.useProgram(piece.p);
      gl.uniform2fv(piece.u.u_res, res);
      gl.uniform3fv(piece.u.u_light, sc.light); gl.uniform1f(piece.u.u_finish, sc.finish); gl.uniform1f(piece.u.u_time, sc.time);
      gl.uniform2fv(piece.u.u_pivot, sc.pivot); gl.uniform2fv(piece.u.u_tilt, sc.tilt);
      gl.uniform1f(piece.u.u_frostAmt, sc.frostAmt);
      gl.uniform1i(piece.u.u_color, 0); gl.uniform1i(piece.u.u_norm, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texLetter); gl.uniform1i(piece.u.u_letter, 2);
      gl.uniform2fv(piece.u.u_printSize, sc.printSize); gl.uniform1f(piece.u.u_letterAmt, sc.letterAmt ?? 1);
      gl.uniform3fv(piece.u.u_lines, sc.lines || [0, 1, 1]); gl.uniform1f(piece.u.u_reveal, sc.reveal ?? 2);
      gl.uniform4fv(piece.u.u_sweep, sc.ripple || [0, 0, 1, 0]);
      if (sc.slab) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texPrint);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texFlat);
        setPiece({ rect: sc.slab.rect, uv: [0, 0, 1, 1], print: sc.slab.print, lift: 0, clarity: 1, rot: 0, cut: 0, glue: 0, scale: sc.slab.scale, preview: sc.slab.preview || 0, squash: sc.slab.squash ?? 1, back: !!sc.slab.back });
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texColor);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texNorm);
      for (const p of sc.pieces) { setPiece(p); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    },
  };
}
