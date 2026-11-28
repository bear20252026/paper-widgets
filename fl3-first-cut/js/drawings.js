// Live blueline drawings: orthographic renders of the running model, inked in a diazo shader.
import * as THREE from 'three';
import { CYL_X, DECK, R, ROD, CROWN, L_MAIN, L_HOT } from './model.js';

const ndVert = `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vN; varying float vD;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vN = normalize(transformedNormal); vD = -mvPosition.z;
}`;
const ndFrag = `
#include <common>
#include <clipping_planes_pars_fragment>
varying vec3 vN; varying float vD;
void main() {
  #include <clipping_planes_fragment>
  if (gl_FrontFacing) gl_FragColor = vec4(normalize(vN) * 0.5 + 0.5, vD - 1.9);
  else gl_FragColor = vec4(0.0, 0.0, 0.0, vD - 1.9);
}`;

const postFrag = `
uniform sampler2D tND; uniform vec2 uRes; uniform float uDpr; uniform float uTime;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
vec4 S(vec2 o){ return texture2D(tND, vUv + o / uRes); }
void main() {
  vec2 px = vUv * uRes;
  vec4 c = S(vec2(0));
  bool geo = c.a > 0.0;
  bool cut = geo && dot(c.rgb, vec3(1.0)) < 0.01;
  // diazo paper with a faint printed grid
  vec3 paper = vec3(0.925, 0.937, 0.925);
  paper -= (h(floor(px / (1.5*uDpr))) - 0.5) * 0.025;
  float g = 12.0 * uDpr;
  vec2 gm = mod(px, g);
  float grid = (gm.x < 0.8*uDpr || gm.y < 0.8*uDpr) ? 1.0 : 0.0;
  float gm5 = (mod(px.x, g*5.0) < 1.0*uDpr || mod(px.y, g*5.0) < 1.0*uDpr) ? 1.0 : 0.0;
  vec3 blue = vec3(0.16, 0.38, 0.62);
  vec3 col = mix(paper, vec3(0.70, 0.84, 0.92), grid * 0.35 + gm5 * 0.25);
  // edges: depth and normal discontinuities
  float e = 0.0;
  float d0 = c.a;
  vec3 n0 = c.rgb;
  for (int i = 0; i < 4; i++) {
    vec2 o = i == 0 ? vec2(1,0) : i == 1 ? vec2(-1,0) : i == 2 ? vec2(0,1) : vec2(0,-1);
    vec4 s = S(o * uDpr * 0.9);
    bool sg = s.a > 0.0;
    if (geo != sg) e = 1.0;
    else if (geo) {
      if (abs(s.a - d0) > 0.006) e = max(e, 1.0);
      float nd = length(s.rgb - n0);
      e = max(e, smoothstep(0.18, 0.42, nd));
    }
  }
  if (geo) {
    vec3 n = normalize(n0 * 2.0 - 1.0);
    float lit = clamp(dot(n, normalize(vec3(-0.45, 0.65, 0.6))), 0.0, 1.0);
    float shade = 1.0 - lit;
    // celeste 45 degree screentone, denser where the form turns away
    float period = 4.2 * uDpr;
    float t = mod(px.x + px.y, period) / period;
    float tone = step(t, shade * 0.62);
    col = mix(col, vec3(0.62, 0.80, 0.90), 0.22);
    col = mix(col, vec3(0.42, 0.66, 0.84), tone * 0.75);
    if (cut) {
      float period2 = 5.0 * uDpr;
      float t2 = mod(px.x - px.y, period2) / period2;
      col = mix(vec3(0.98, 0.86, 0.78), vec3(0.88, 0.34, 0.11), step(t2, 0.34));
    }
  }
  // soft, uneven ink take-up
  float ink = e * (0.86 + 0.14 * h(floor(px / (2.0*uDpr)) + 3.1));
  col = mix(col, blue, ink);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Drawings {
  constructor(renderer, scene, boxes) {
    this.r = renderer; this.scene = scene; this.items = [];
    this.nd = new THREE.ShaderMaterial({ vertexShader: ndVert, fragmentShader: ndFrag, side: THREE.DoubleSide, clipping: true });
    this.ndSection = this.nd.clone(); this.ndSection.clipping = true;
    this.ndSection.clippingPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), CYL_X[0])];
    this.post = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: postFrag,
      uniforms: { tND: { value: null }, uRes: { value: new THREE.Vector2() }, uDpr: { value: 1 }, uTime: { value: 0 } },
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post);
    this.quad.frustumCulled = false;
    this.postScene = new THREE.Scene(); this.postScene.add(this.quad);
    this.postCam = new THREE.Camera();
    const specs = {
      front: { pos: [1, 0, 0], up: [0, 1, 0], c: [0, 0.38, 0], h: 1.36, w: 0.78 },
      side: { pos: [0, 0, 1], up: [0, 1, 0], c: [0.0, 0.38, 0], h: 1.36, w: 1.15 },
      plan: { pos: [0, 1, 0], up: [0, 0, -1], c: [0.0, 0, 0.0], h: 0.84, w: 1.12 },
      section: { pos: [1, 0, 0], up: [0, 1, 0], c: [CYL_X[0], 0.2, 0], h: 0.8, w: 0.5, section: true },
    };
    for (const b of boxes) {
      const k = b.dataset.dwg, s = specs[k];
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 6);
      const c = new THREE.Vector3(...s.c), dir = new THREE.Vector3(...s.pos).normalize();
      cam.up.set(...s.up); cam.position.copy(c).addScaledVector(dir, 3); cam.lookAt(c);
      cam.layers.set(L_MAIN); cam.layers.enable(L_HOT);
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
      this.items.push({ key: k, el: b, box: b.querySelector('.dwgbox'), ov: b.querySelector('.ov'), cam, rt, spec: s, w: 0, h: 0 });
    }
    this.frame = 0;
  }
  layout(dpr) {
    for (const it of this.items) {
      const r = it.box.getBoundingClientRect();
      const w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
      if (w !== it.w || h !== it.h || dpr !== it.dpr) {
        it.w = w; it.h = h; it.dpr = dpr;
        it.rt.setSize(Math.round(w * dpr), Math.round(h * dpr));
        const asp = w / h, hh = Math.max(it.spec.h, it.spec.w / asp) / 2;
        it.cam.left = -hh * asp; it.cam.right = hh * asp; it.cam.top = hh; it.cam.bottom = -hh; it.cam.updateProjectionMatrix();
        this.drawOverlay(it, dpr);
      }
    }
  }
  project(it, x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(it.cam);
    return [(v.x * 0.5 + 0.5) * it.w, (-v.y * 0.5 + 0.5) * it.h];
  }
  drawOverlay(it, dpr) {
    const c = it.ov; c.width = it.w * dpr; c.height = it.h * dpr;
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, it.w, it.h);
    const blue = 'rgba(30,80,140,0.9)', ar = '#E0561C';
    g.strokeStyle = blue; g.fillStyle = blue; g.lineWidth = 0.7;
    const dash = () => g.setLineDash([9, 2.5, 1.5, 2.5]);
    const label = (t, x, y, opt = {}) => { g.font = opt.font || '500 8px "IBM Plex Mono", monospace'; g.textAlign = opt.align || 'center'; g.textBaseline = 'middle'; g.fillStyle = opt.color || blue; g.fillText(t, x, y); };
    const circ = (n, x, y) => { g.setLineDash([]); g.beginPath(); g.arc(x, y, 6.5, 0, Math.PI * 2); g.fillStyle = 'rgba(238,233,220,0.95)'; g.fill(); g.strokeStyle = ar; g.lineWidth = 0.8; g.stroke(); label(String(n), x, y + 0.5, { color: ar, font: '600 8.5px "IBM Plex Mono", monospace' }); };
    g.save();
    if (it.key === 'side') {
      CYL_X.forEach((x, i) => {
        const [a1, b1] = this.project(it, x, -0.12, 0), [a2, b2] = this.project(it, x, 0.56, 0);
        dash(); g.strokeStyle = blue; g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); circ(i + 1, a2, b2 - 7);
      });
      const [c1, d1] = this.project(it, -0.5, 0, 0), [c2, d2] = this.project(it, 0.5, 0, 0);
      dash(); g.beginPath(); g.moveTo(c1, d1); g.lineTo(c2, d2); g.stroke();
      label('← volano', c1 + 4, d1 - 7, { align: 'left', font: 'italic 9px "Bodoni Moda", serif' });
      label('soffiante →', c2 - 4, d2 - 7, { align: 'right', font: 'italic 9px "Bodoni Moda", serif' });
    } else if (it.key === 'plan') {
      CYL_X.forEach((x, i) => {
        const [a1, b1] = this.project(it, x, 0, -0.2), [a2, b2] = this.project(it, x, 0, 0.26);
        dash(); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke();
        const [cx, cy] = this.project(it, x, 0, -0.27); circ(i + 1, cx, cy);
      });
      const [c1, d1] = this.project(it, -0.48, 0, 0), [c2, d2] = this.project(it, 0.5, 0, 0);
      dash(); g.beginPath(); g.moveTo(c1, d1); g.lineTo(c2, d2); g.stroke();
      label('lato caldo', c2 - 2, this.project(it, 0, 0, 0.3)[1], { align: 'right', font: 'italic 9px "Bodoni Moda", serif' });
      label('lato freddo', c2 - 2, this.project(it, 0, 0, -0.33)[1], { align: 'right', font: 'italic 9px "Bodoni Moda", serif' });
    } else if (it.key === 'front') {
      const [a1, b1] = this.project(it, 0, -0.16, 0), [a2, b2] = this.project(it, 0, 0.6, 0);
      dash(); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke();
      const [h1, k1] = this.project(it, 0, 0, -0.26), [h2, k2] = this.project(it, 0, 0, 0.26);
      g.beginPath(); g.moveTo(h1, k1); g.lineTo(h2, k2); g.stroke();
      circ(1, a2, b2 - 7);
      label('senso orario ↻', h2 - 2, k2 + 12, { align: 'right', font: 'italic 9px "Bodoni Moda", serif' });
    } else if (it.key === 'section') {
      const x = CYL_X[0];
      const [a1, b1] = this.project(it, x, -0.1, 0), [a2, b2] = this.project(it, x, 0.5, 0);
      dash(); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); circ(1, a2, b2 - 7);
      g.setLineDash([]);
      // TDC and BDC crown lines: PMS / PMI
      const yT = R + ROD + CROWN, yB = ROD - R + CROWN;
      const lineAt = (y, t) => {
        const [p1, q1] = this.project(it, x, y, -0.135), [p2, q2] = this.project(it, x, y, 0.06);
        g.setLineDash([3, 2]); g.strokeStyle = ar; g.lineWidth = 0.7; g.beginPath(); g.moveTo(p1, q1); g.lineTo(p2, q2); g.stroke();
        label(t, p1 - 3, q1, { align: 'right', color: ar, font: '600 7.5px "IBM Plex Mono", monospace' });
        return [p1, q1, p2, q2];
      };
      const T = lineAt(yT, 'PMS'), Bo = lineAt(yB, 'PMI');
      // stroke 110
      const xs = T[0] + 14;
      g.setLineDash([]); g.strokeStyle = blue; g.lineWidth = 0.7;
      arrowDim(g, xs, T[1], xs, Bo[1]);
      g.save(); g.translate(xs - 5, (T[1] + Bo[1]) / 2); g.rotate(-Math.PI / 2); label('110', 0, 0, { font: '500 8px "IBM Plex Mono", monospace' }); g.restore();
      // bore 92
      const [u1, v1] = this.project(it, x, DECK + 0.135, -0.046), [u2, v2] = this.project(it, x, DECK + 0.135, 0.046);
      const [w1, z1] = this.project(it, x, DECK, -0.046), [w2, z2] = this.project(it, x, DECK, 0.046);
      g.setLineDash([]); g.lineWidth = 0.5; g.beginPath(); g.moveTo(w1, z1); g.lineTo(u1, v1 - 2); g.moveTo(w2, z2); g.lineTo(u2, v2 - 2); g.stroke();
      g.lineWidth = 0.7; arrowDim(g, u1, v1, u2, v2);
      label('Ø 92', (u1 + u2) / 2, v1 - 6);
      label('A-A', it.w - 6, it.h - 8, { align: 'right', color: ar, font: '600 8px "Archivo", sans-serif' });
    }
    g.restore();
    function arrowDim(g, x1, y1, x2, y2) {
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1), s = 4;
      for (const [x, y, d] of [[x1, y1, a], [x2, y2, a + Math.PI]]) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(d + 0.3) * s, y + Math.sin(d + 0.3) * s); g.lineTo(x + Math.cos(d - 0.3) * s, y + Math.sin(d - 0.3) * s); g.closePath(); g.fill();
      }
    }
  }
  // render: two drawings per frame, all four composited every frame
  render(canvasH, dpr, time) {
    const r = this.r;
    const n = this.items.length;
    const which = [this.frame % n, (this.frame + 1) % n]; this.frame += 2;
    const prevClear = r.getClearAlpha(); const prevColor = r.getClearColor(new THREE.Color());
    for (const k of which) {
      const it = this.items[k];
      if (it.w < 4) continue;
      this.scene.overrideMaterial = it.spec.section ? this.ndSection : this.nd;
      r.setRenderTarget(it.rt); r.setClearColor(0x000000, 0); r.clear();
      r.render(this.scene, it.cam);
    }
    this.scene.overrideMaterial = null;
    r.setRenderTarget(null);
    r.setClearColor(prevColor, prevClear);
    for (const it of this.items) {
      const rc = it.box.getBoundingClientRect();
      if (rc.bottom < 0 || rc.top > window.innerHeight || it.w < 4) continue;
      const x = rc.left + 0.6, y = window.innerHeight - rc.bottom + 0.6, w = rc.width - 1.2, h = rc.height - 1.2;
      r.setViewport(x, y, w, h); r.setScissor(x, y, w, h); r.setScissorTest(true);
      this.post.uniforms.tND.value = it.rt.texture;
      this.post.uniforms.uRes.value.set(it.rt.width, it.rt.height);
      this.post.uniforms.uDpr.value = dpr; this.post.uniforms.uTime.value = time;
      r.render(this.postScene, this.postCam);
    }
  }
}
