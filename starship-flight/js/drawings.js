// Range-safety console prints: real orthographic renders of the running model,
// inked in a shader. Pass 1 writes normal/depth/material code; pass 2 draws cyan
// outlines, a 45-degree cyan screentone, an orange hatch where the section cuts metal,
// and generates the print paper and its grid.
import * as THREE from 'three';
import { makeInkMaterial, sectionPlane } from './materials.js';

const compVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const compFS = /* glsl */`
  uniform sampler2D tInk; uniform vec2 uRes; uniform float uDpr;
  uniform vec3 uPaper; uniform vec3 uCyan; uniform vec3 uOrange; uniform vec3 uInk; uniform float uSection;
  varying vec2 vUv;
  vec4 S(vec2 o){ return texture2D(tInk, vUv + o / uRes); }
  vec3 nrm(vec4 c){ vec2 xy = c.xy * 2.0 - 1.0; return vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy)))); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 px = vUv * uRes;
    vec4 c = S(vec2(0.0));
    float code = c.a;
    // paper + grid
    float g1 = step(fract(px.x / (10.0 * uDpr)), 1.0 / (10.0 * uDpr) * uDpr * 0.9) + step(fract(px.y / (10.0 * uDpr)), 0.09);
    float g5 = step(fract(px.x / (50.0 * uDpr)), 0.03) + step(fract(px.y / (50.0 * uDpr)), 0.03);
    vec3 paper = uPaper * (0.985 + 0.02 * hash(floor(px / (2.0 * uDpr))));
    vec3 col = mix(paper, mix(paper, uCyan, 0.18), clamp(g1, 0.0, 1.0) * 0.35);
    col = mix(col, mix(paper, uCyan, 0.3), clamp(g5, 0.0, 1.0) * 0.5);
    // edges
    float o = uDpr * 1.0;
    vec4 l = S(vec2(-o, 0.0)), r = S(vec2(o, 0.0)), u = S(vec2(0.0, o)), d = S(vec2(0.0, -o));
    float dd = abs(l.z - r.z) + abs(u.z - d.z);
    float codeE = step(0.02, abs(l.a - r.a)) + step(0.02, abs(u.a - d.a));
    vec3 n0 = nrm(c);
    float ne = 0.0;
    if (l.a > 0.01 && r.a > 0.01) ne += 1.0 - smoothstep(0.55, 0.85, dot(nrm(l), nrm(r)));
    if (u.a > 0.01 && d.a > 0.01) ne += 1.0 - smoothstep(0.55, 0.85, dot(nrm(u), nrm(d)));
    float edge = clamp(step(0.012, dd) + codeE + ne, 0.0, 1.0);
    if (code > 0.01) {
      vec3 L = normalize(vec3(-0.45, 0.65, 0.62));
      float sh = clamp(dot(n0, L), 0.0, 1.0);
      float dark = 1.0 - sh;
      float diag = (px.x + px.y) / uDpr;
      float tone = 0.0;
      vec3 fill = paper;
      if (code > 0.9) {
        // section cut through metal: orange hatch
        float h = step(0.5, fract(diag / 4.0));
        fill = mix(paper, uOrange, 0.25 + 0.65 * h);
      } else if (code > 0.8) {
        // section cut through propellant
        float dots = step(length(fract(px / (3.0 * uDpr)) - 0.5), 0.28);
        fill = mix(paper, uCyan, 0.18 + 0.35 * dots);
      } else if (code > 0.55) {
        // tile field: dense carbon tone
        float t = fract(diag / 3.0);
        fill = mix(paper, uInk, step(t, 0.35 + 0.45 * dark) * 0.85);
      } else if (code > 0.47) {
        float dots = step(length(fract(px / (3.0 * uDpr)) - 0.5), 0.25);
        fill = mix(paper, uOrange, 0.12 + 0.3 * dots);
      } else if (code > 0.4) {
        float dots = step(length(fract(px / (3.0 * uDpr)) - 0.5), 0.25);
        fill = mix(paper, uCyan, 0.15 + 0.35 * dots);
      } else {
        float base = code > 0.25 ? 0.35 : 0.0;
        float t = fract(diag / 4.0);
        tone = step(t, clamp(base + dark * 0.55 - 0.08, 0.0, 0.95));
        fill = mix(paper, uCyan, tone * 0.75);
      }
      col = fill;
    }
    col = mix(col, uCyan * 0.78, edge * 0.95);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export function createDrawings(renderer, stages) {
  // stages: { booster, ship } built objects
  const near = { value: 1 }, far = { value: 400 };
  const inkMats = {};
  const codeOf = (m) => {
    const k = m.userData.inkKind;
    return k === 1 ? 0.45 : k === 4 ? 0.5 : k === 2 ? 0.6 : k === 3 ? 0.3 : 0.2;
  };
  const getInk = (code, clip) => {
    const key = code + (clip ? 'c' : 'n');
    if (!inkMats[key]) { const m = makeInkMaterial(code, clip); m.uniforms.uNear = near; m.uniforms.uFar = far; inkMats[key] = m; }
    return inkMats[key];
  };
  const entries = [];
  const hideDuringInk = [];
  for (const st of [stages.booster, stages.ship]) {
    st.root.traverse((o) => {
      if (o.name === 'plume' || o.isPoints) { hideDuringInk.push(o); return; }
      if (o.isMesh) { const code = codeOf(o.material); entries.push({ o, orig: o.material, n: getInk(code, false), c: getInk(code, true) }); }
    });
  }
  const inkScene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  const quadScene = new THREE.Scene();
  const quadMat = new THREE.ShaderMaterial({
    uniforms: {
      tInk: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 },
      uPaper: { value: new THREE.Color('#F2EFE7') }, uCyan: { value: new THREE.Color('#3FA8C9') },
      uOrange: { value: new THREE.Color('#E05A1E') }, uInk: { value: new THREE.Color('#171717') }, uSection: { value: 0 },
    },
    vertexShader: compVS, fragmentShader: compFS, depthTest: false, depthWrite: false,
  });
  quadMat.toneMapped = false;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const views = {
    front: { roll: -Math.PI / 2, layout: 'rows', dir: [0, 0, 1], up: [0, 1, 0] },
    right: { roll: 0, layout: 'rows', dir: [0, 0, 1], up: [0, 1, 0] },
    plan: { roll: 0, layout: 'stack', dir: [0, 1, 0], up: [0, 0, -1] },
    section: { roll: 0, layout: 'rows', dir: [0, 0, 1], up: [0, 1, 0], section: true },
  };
  const targets = {};
  const qRoll = new THREE.Quaternion(), qLay = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const ROW = { b: 9.5, s: -9.5, x0: -36 };

  function pose(view, sepGap) {
    const v = views[view];
    qRoll.setFromAxisAngle(Y, v.roll);
    const b = stages.booster.root, s = stages.ship.root;
    if (v.layout === 'rows') {
      qLay.setFromAxisAngle(Z, -Math.PI / 2);
      b.quaternion.copy(qLay).multiply(qRoll); s.quaternion.copy(qLay).multiply(qRoll);
      b.position.set(ROW.x0, ROW.b, 0); s.position.set(ROW.x0, ROW.s, 0);
    } else {
      b.quaternion.copy(qRoll); s.quaternion.copy(qRoll);
      b.position.set(0, -62, 0); s.position.set(0, -62 + 72 + sepGap, 0);
    }
    b.updateMatrixWorld(true); s.updateMatrixWorld(true);
  }

  function frameCamera(view, aspect) {
    const v = views[view];
    if (v.layout === 'rows') {
      const hw = 40, hh = Math.max(hw / aspect, 16);
      const w = Math.max(hw, hh * aspect);
      cam.left = -w; cam.right = w; cam.top = hh; cam.bottom = -hh;
      cam.position.set(0, 0, 200); cam.up.set(0, 1, 0); cam.lookAt(0, 0, 0);
      near.value = 150; far.value = 250;
    } else {
      const hh = 13, hw = hh * aspect;
      cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh;
      cam.position.set(0, 200, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
      near.value = 100; far.value = 330;
    }
    cam.near = 1; cam.far = 400; cam.updateProjectionMatrix();
    return { left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom };
  }

  let rr = 0;
  const frames = {};
  function render(rects, dpr, opts) {
    // rects: {front:{x,y,w,h}, ...} in CSS px relative to the canvas; opts: {sepGap}
    const keys = Object.keys(rects);
    if (!keys.length) return frames;
    const b = stages.booster.root, s = stages.ship.root;
    const saved = [b, s].map((o) => ({ o, parent: o.parent, p: o.position.clone(), q: o.quaternion.clone(), vis: o.visible }));
    const toRender = [keys[rr % keys.length], keys[(rr + 1) % keys.length]];
    rr += 2;
    const clearC = new THREE.Color(); renderer.getClearColor(clearC); const clearA = renderer.getClearAlpha();
    for (const k of keys) {
      const r = rects[k];
      const W = Math.max(2, Math.round(r.w * dpr)), H = Math.max(2, Math.round(r.h * dpr));
      let t = targets[k];
      if (!t || t.width !== W || t.height !== H) {
        t?.dispose();
        t = targets[k] = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
        toRender.push(k);
      }
      if (!toRender.includes(k)) continue;
      // ink pass
      for (const sv of saved) { inkScene.add(sv.o); sv.o.visible = true; }
      for (const h of hideDuringInk) h.userData._v = h.visible, h.visible = false;
      const sec = !!views[k].section;
      for (const e of entries) e.o.material = sec ? e.c : e.n;
      pose(k, opts.sepGap || 0);
      frames[k] = frameCamera(k, r.w / r.h);
      sectionPlane.normal.set(0, 0, -1); sectionPlane.constant = 0;
      renderer.setRenderTarget(t);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      const lc = renderer.localClippingEnabled; renderer.localClippingEnabled = true;
      renderer.render(inkScene, cam);
      renderer.localClippingEnabled = lc;
      for (const e of entries) e.o.material = e.orig;
      for (const h of hideDuringInk) h.visible = h.userData._v;
      for (const sv of saved) { sv.parent.add(sv.o); sv.o.position.copy(sv.p); sv.o.quaternion.copy(sv.q); sv.o.visible = sv.vis; sv.o.updateMatrixWorld(true); }
    }
    renderer.setRenderTarget(null);
    renderer.setClearColor(clearC, clearA);
    // composite all into their rects
    const size = renderer.getSize(new THREE.Vector2());
    for (const k of keys) {
      const r = rects[k], t = targets[k];
      if (!t) continue;
      const y = size.y - r.y - r.h;
      renderer.setViewport(r.x, y, r.w, r.h); renderer.setScissor(r.x, y, r.w, r.h); renderer.setScissorTest(true);
      quadMat.uniforms.tInk.value = t.texture;
      quadMat.uniforms.uRes.value.set(t.width, t.height);
      quadMat.uniforms.uDpr.value = dpr;
      renderer.render(quadScene, qcam);
    }
    return frames;
  }
  return { render, frames, ROW };
}
