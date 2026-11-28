// Airflow arrows and exhaust smoke.
import * as THREE from 'three';
import { CYL_X, L_FX } from './model.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const CE = new THREE.Color('#58AED6'), AR = new THREE.Color('#E0561C'), INKC = new THREE.Color('#2a4d6e');

export class AirFlow {
  constructor(n = 520) {
    this.n = n; this.p = [];
    for (let i = 0; i < n; i++) this.p.push(this.spawn(Math.random()));
    const segs = 3; // shaft + two barbs
    this.pos = new Float32Array(n * segs * 2 * 3); this.col = new Float32Array(n * segs * 2 * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: 'attribute vec4 color; varying vec4 vC; void main(){ vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uA; varying vec4 vC; void main(){ gl_FragColor = vec4(vC.rgb, vC.a * uA); }',
      uniforms: { uA: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false,
    });
    this.lines = new THREE.LineSegments(g, this.mat); this.lines.frustumCulled = false; this.lines.layers.set(L_FX); this.lines.renderOrder = 10;
    this.v = new THREE.Vector3(); this.a = new THREE.Vector3(); this.b = new THREE.Vector3();
  }
  spawn(u = 0) {
    // the blower draws air in through the guard, pushes it down the cowl, across the fins, out on the pump side
    const BY = 0.29, BZ = -0.1;
    const a = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()) * 0.11;
    const station = Math.floor(Math.random() * 3);
    const xs = CYL_X[station] + rnd(-0.06, 0.06);
    const y = rnd(0.16, 0.42);
    const pts = [
      [0.62, BY + Math.sin(a) * r * 1.4, BZ + Math.cos(a) * r * 1.4],
      [0.43, BY + Math.sin(a) * r, BZ + Math.cos(a) * r],
      [0.3, BY + Math.sin(a) * r * 0.8, -0.15 + Math.cos(a) * 0.02],
      [xs + 0.12, y, -0.165],
      [xs, y, -0.11],
      [xs, y + rnd(-0.01, 0.01), 0.0],
      [xs, y + 0.02, 0.11],
      [xs - 0.02, y + 0.07, 0.24],
      [xs - 0.04, y + 0.16, 0.36],
    ].map(q => new THREE.Vector3(...q));
    return { curve: new THREE.CatmullRomCurve3(pts, false, 'centripetal'), u, speed: rnd(0.8, 1.2) };
  }
  update(dt, rpm, camera, visible) {
    this.lines.visible = visible || this.mat.uniforms.uA.value > 0.01;
    this.mat.uniforms.uA.value += ((visible ? 1 : 0) - this.mat.uniforms.uA.value) * Math.min(1, dt * 4);
    if (!this.lines.visible) return;
    const flow = 0.04 + 0.36 * Math.min(1.2, Math.max(0, rpm) / 2200);
    const view = new THREE.Vector3(); camera.getWorldDirection(view);
    let pi = 0, ci = 0;
    for (const p of this.p) {
      p.u += dt * flow * p.speed;
      if (p.u > 1) Object.assign(p, this.spawn(0));
      const u = p.u, u0 = Math.max(0, u - 0.035);
      p.curve.getPoint(u, this.a); p.curve.getPoint(u0, this.b);
      const dir = this.v.subVectors(this.a, this.b);
      const len = dir.length() || 1e-6; dir.divideScalar(len);
      const perp = new THREE.Vector3().crossVectors(dir, view).normalize();
      const s = Math.min(0.012, len * 0.45);
      const back = this.a.clone().addScaledVector(dir, -s);
      const b1 = back.clone().addScaledVector(perp, s * 0.55), b2 = back.clone().addScaledVector(perp, -s * 0.55);
      // warm on the hot side
      const warm = THREE.MathUtils.smoothstep(u, 0.5, 0.8);
      const c = new THREE.Color().copy(CE).lerp(AR, warm);
      if (u < 0.5) c.lerp(INKC, 0.25);
      const fade = Math.min(1, u * 12) * Math.min(1, (1 - u) * 6) * (0.35 + 0.65 * Math.min(1, rpm / 600 + 0.25));
      for (const [A, B] of [[this.b, this.a], [this.a, b1], [this.a, b2]]) {
        this.pos.set([B.x, B.y, B.z, A.x, A.y, A.z], pi); pi += 6;
        this.col.set([c.r, c.g, c.b, fade * 0.6, c.r, c.g, c.b, fade], ci); ci += 8;
      }
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
  }
}

export class Smoke {
  constructor(n = 160) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.age = new Float32Array(n).fill(9); this.vel = new Float32Array(n * 3); this.dens = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('age', new THREE.BufferAttribute(this.age, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('dens', new THREE.BufferAttribute(this.dens, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: `attribute float age; attribute float dens; varying float vA; varying float vD; uniform float uScale;
        void main(){ vA = age; vD = dens; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uScale * (0.03 + age * 0.09) / -mv.z; }`,
      fragmentShader: `varying float vA; varying float vD;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.0, r) * vD * clamp(1.0 - vA / 2.2, 0.0, 1.0) * 0.55;
        gl_FragColor = vec4(vec3(0.11, 0.105, 0.1) + vA * 0.12, a); }`,
      uniforms: { uScale: { value: 800 } }, transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.layers.set(L_FX);
    this.origin = new THREE.Vector3(-0.02, 0.985, 0.19);
  }
  puff(d, count = 4, up = 0.6) {
    for (let k = 0; k < count; k++) {
      const i = this.i = (this.i + 1) % this.n;
      this.pos[i * 3] = this.origin.x + rnd(-0.01, 0.01); this.pos[i * 3 + 1] = this.origin.y; this.pos[i * 3 + 2] = this.origin.z + rnd(-0.01, 0.01);
      this.vel[i * 3] = rnd(-0.05, 0.08); this.vel[i * 3 + 1] = up * rnd(0.7, 1.3); this.vel[i * 3 + 2] = rnd(-0.05, 0.05);
      this.age[i] = 0; this.dens[i] = Math.min(1, d);
    }
  }
  update(dt, scaleY, origin) {
    if (origin) this.origin.copy(origin);
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] > 3) continue;
      this.age[i] += dt;
      this.pos[i * 3] += (this.vel[i * 3] + 0.06) * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] *= Math.exp(-dt * 1.2);
    }
    this.mat.uniforms.uScale.value = scaleY;
    const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.age.needsUpdate = true; g.attributes.dens.needsUpdate = true;
  }
}
