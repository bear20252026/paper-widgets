import * as THREE from 'three';

export type Pose = Record<string, number>;
const S = Math.sin, C = Math.cos, PI = Math.PI;

/** Shared rim-light colour, set per scene — gives every figure a glowing silhouette. */
export const RIM = { value: new THREE.Color(0x88aaff) };
export function rimify<T extends THREE.MeshStandardMaterial>(m: T, k: number): T {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = RIM;
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += uRim * ${k.toFixed(2)} * pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 2.5);`);
  };
  m.customProgramCacheKey = () => 'rim' + k;
  return m;
}
const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const BASE: Pose = {
  x: 0, z: 0, y: 0, yaw: 0, lean: 0, side: 0, spX: 0, spZ: 0, twist: 0, hX: 0, hZ: 0, hY: 0,
  aLx: 0.1, aLz: 0.5, aLe: 0.3, aRx: 0.55, aRz: 0.15, aRe: 1.6,
  lLx: 0, lLz: 0.04, lLk: 0, lRx: 0, lRz: 0.04, lRk: 0, umX: 0, umZ: 0, rate: 0.9,
  free: 0, wr: 0, wa: 0,
};

/** Choreography: m = move id, b = beat inside the bar (0..4, may run past 4 while blending). */
export function evalMove(m: number, b: number, p: Pose, bs = b) {
  Object.assign(p, BASE);
  const s2 = S(PI * b), c2 = C(PI * b), s4 = S(PI * b / 2), c4 = C(PI * b / 2);
  const bounce = c2 * c2;
  switch (m) {
    case 0: { // sway
      const k = 0.22 * bounce;
      p.x = 0.22 * s4; p.side = -0.05 * s4; p.spZ = 0.12 * s4; p.hZ = 0.15 * s4; p.hY = 0.3 * s4; p.twist = 0.2 * s4;
      p.lLk = p.lRk = k + 0.05; p.lLx = p.lRx = k * 0.5 + 0.02;
      p.lLz = 0.05 + 0.22 * Math.max(0, -s4); p.lRz = 0.05 + 0.22 * Math.max(0, s4);
      p.aLz = 0.9 + 0.25 * S(PI * b / 2 + 0.6); p.aLx = 0.2 * c4; p.aLe = 0.35 + 0.2 * s2;
      p.umZ = -0.18 * s4; p.umX = 0.05 * c2;
      break;
    }
    case 1: { // twirl (two full turns)
      const e = Math.min(1, b / 4), lift = sm(0, 0.6, b) * (1 - sm(3.3, 4, b));
      p.yaw = 4 * PI * e * e * (3 - 2 * e);
      p.lRx = 0.95 * lift; p.lRk = 1.7 * lift; p.lRz = 0.35 * lift;
      p.aLz = 0.5 + 1.0 * lift; p.aLx = -0.1; p.aLe = 0.15; p.spX = -0.12 * lift; p.hX = -0.2 * lift;
      p.umX = -0.4 * lift; p.rate = 3; p.y = 0.03 * lift;
      break;
    }
    case 2: { // arabesque
      const a = sm(0, 1.2, b) * (1 - sm(3.2, 4, b)), L = 0.55 * a;
      p.lean = L; p.lLx = L; p.lRx = -0.75 * a; p.lRk = 0.1; p.spX = -0.35 * a; p.hX = -0.3 * a;
      p.aLz = 0.4 + 1.2 * a; p.aLx = -0.5 * a; p.aRx = 0.55 + 0.9 * a; p.aRe = 1.6 - 1.1 * a;
      p.umX = 0.3 * a; p.yaw = 0.5 * a * s4;
      break;
    }
    case 3: { // waltz travel
      p.x = 0.85 * s4; p.z = 0.3 * s2; p.yaw = 0.9 * c4;
      p.lLx = 0.45 * s2; p.lRx = -0.45 * s2;
      p.lLk = 0.25 + 0.3 * Math.max(0, C(PI * b - 1)); p.lRk = 0.25 + 0.3 * Math.max(0, -C(PI * b - 1));
      p.aLz = 1.0 + 0.3 * s2; p.aLx = -0.3 * s2; p.spZ = 0.1 * s4; p.hY = 0.3 * c4; p.umZ = -0.2 * s4; p.umX = 0.1 * c2;
      p.rate = 1.6;
      break;
    }
    case 4: { // reach for the rain
      const a = sm(0, 1, b) * (1 - sm(3.3, 4, b));
      p.aRz = 0.15 + 1.1 * a; p.aRx = 0.55 - 0.3 * a; p.aRe = 1.6 - 1.0 * a; p.umZ = 0.55 * a;
      p.aLx = 0.1 + 2.3 * a; p.aLz = 0.5 - 0.2 * a; p.hX = -0.5 * a; p.spX = -0.18 * a;
      p.yaw = 0.5 * a * s4; p.lRx = -0.35 * a; p.lRk = 0.3 * a; p.y = 0.04 * a; p.rate = 0.5;
      break;
    }
    case 5: { // leap
      const j = b % 2, h = j < 1.2 ? S(PI * j / 1.2) : 0, cr = j >= 1.2 ? S(PI * (j - 1.2) / 0.8) * 0.6 : 0;
      p.y = 0.42 * h; p.x = -0.45 * c4; p.yaw = 0.6 * s4;
      p.lLx = 1.1 * h + 0.3 * cr; p.lRx = -1.0 * h + 0.3 * cr; p.lLk = 0.2 * h + 0.6 * cr; p.lRk = 0.5 * h + 0.6 * cr;
      p.aLz = 0.6 + 1.5 * h; p.aLx = 0.2 * h; p.aRx = 0.55 + 0.6 * h; p.aRe = 1.6 - 0.6 * h;
      p.hX = -0.25 * h; p.spX = -0.15 * h; p.rate = 2.2;
      break;
    }
    case 6: { // curtsy
      const a = sm(0, 1.5, b) * (1 - sm(3.2, 4, b));
      p.lLk = 0.9 * a; p.lLx = 0.5 * a; p.lRx = -0.35 * a; p.lRk = 0.9 * a; p.lRz = -0.15 * a;
      p.lean = 0.2 * a; p.hX = 0.3 * a; p.aLz = 0.5 + 0.7 * a; p.aLe = 0.3 + 0.5 * a;
      p.umZ = 0.5 * a; p.umX = -0.2 * a; p.aRz = 0.15 + 0.6 * a; p.rate = 0.6;
      break;
    }
    case 7: { // playful kicks
      const kL = Math.pow(Math.max(0, s2), 1.5), kR = Math.pow(Math.max(0, -s2), 1.5);
      p.lLx = 1.3 * kL; p.lLk = 0.1 + 0.15 * kL; p.lRx = 1.3 * kR; p.lRk = 0.1 + 0.15 * kR;
      p.spX = -0.15 * (kL + kR); p.lean = -0.08 * (kL + kR); p.aLz = 1.1 + 0.3 * s2; p.spZ = 0.12 * s2;
      p.umZ = -0.25 * s2; p.x = 0.15 * s4; p.yaw = 0.35 * s4; p.rate = 2.4;
      break;
    }
    case 10: { // she lets the umbrella go — it dances above her on its own
      const f = sm(0, 1.2, bs) * (1 - sm(6.8, 8, bs));
      p.free = f; p.yaw = bs * PI * 0.35 * f;
      p.aLx = 0.1 + 2.5 * f; p.aLz = 0.5 + 0.2 * f; p.aLe = 0.3 - 0.1 * f;
      p.aRx = 0.55 + 2.0 * f; p.aRz = 0.15 + 0.35 * f; p.aRe = 1.6 - 1.3 * f;
      p.hX = -0.45 * f; p.spX = -0.15 * f; p.y = 0.03 * Math.abs(s2) * f;
      p.lLx = 0.2 * s2 * f; p.lRx = -0.2 * s2 * f; p.lLk = p.lRk = 0.15 * f; p.rate = 3;
      break;
    }
    case 11: // waltz around a shared centre with a partner
    case 13: { // …and the umbrella floats free above them both
      p.wr = 1; p.wa = -PI / 2 + b * PI / 2;
      p.lLx = 0.35 * s2; p.lRx = -0.35 * s2; p.lLk = 0.2 + 0.25 * Math.max(0, c2); p.lRk = 0.2 + 0.25 * Math.max(0, -c2);
      p.y = 0.02 * Math.abs(s2); p.aLx = 1.25; p.aLz = 0.35; p.aLe = 0.5; p.spZ = 0.06 * s2; p.hY = 0.15; p.hX = -0.1;
      p.umZ = 0.15; p.umX = -0.12; p.rate = 1.2;
      if (m === 13) { p.free = sm(0, 1.5, bs); p.aRx = 0.55 + 0.5 * p.free; p.aRe = 1.6 - 1.0 * p.free; p.aRz = 0.15 + 0.15 * p.free; p.hX = -0.25; }
      break;
    }
    case 12: { // walk
      p.lLx = 0.42 * s2; p.lRx = -0.42 * s2; p.lLk = 0.5 * Math.max(0, c2) + 0.05; p.lRk = 0.5 * Math.max(0, -c2) + 0.05;
      p.aLx = -0.3 * s2 + 0.05; p.aRx = 0.3 * s2 + 0.05; p.aLz = p.aRz = 0.12; p.aLe = p.aRe = 0.25;
      p.y = 0.015 * Math.abs(s2); p.spZ = 0.03 * s2;
      break;
    }
    case 8: // boy: standing, watching
    case 9: { // boy: offering a hand
      const o = m === 9 ? 0.5 + 0.5 * S(PI * b / 4) : 0;
      p.aLx = 0.05 + 1.0 * o; p.aLz = 0.14 + 0.25 * o; p.aLe = 0.2 + 0.3 * o;
      p.aRx = 0.05; p.aRz = 0.14; p.aRe = 0.2;
      p.spZ = 0.03 * s4; p.x = 0.04 * s4; p.hZ = 0.05 * s4; p.lLk = p.lRk = 0.05 * bounce; p.lLx = p.lRx = 0.025 * bounce;
      break;
    }
  }
}

function part(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function joint(parent: THREE.Object3D, x: number, y: number, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function limb(parent: THREE.Object3D, r1: number, r2: number, len: number, mat: THREE.Material) {
  part(new THREE.CylinderGeometry(r1, r2, len, 12), mat, parent, 0, -len / 2, 0);
  part(new THREE.SphereGeometry(r1, 12, 8), mat, parent);
  part(new THREE.SphereGeometry(r2, 12, 8), mat, parent, 0, -len, 0);
}

const SK_LEN = 0.56, RIBS = 8, UM_R = 0.78;

export class Dancer {
  root = new THREE.Group();
  umbrella = new THREE.Group();
  umbLight = new THREE.PointLight(0xffffff, 2, 5, 1.6);
  dressMat = rimify(new THREE.MeshStandardMaterial({ color: 0xff5577, roughness: 0.55, side: THREE.DoubleSide }), 0.6);
  canopyMat = rimify(new THREE.MeshStandardMaterial({ color: 0xff8899, roughness: 0.35, transparent: true, opacity: 0.88, side: THREE.DoubleSide, emissive: 0xff4466, emissiveIntensity: 0.5 }), 0.8);
  spinVel = 0;
  yaw = 0;
  private j: Record<string, THREE.Group> = {};
  private skirt?: THREE.Mesh;
  private skBase?: Float32Array;
  private hair: THREE.Group[] = [];
  private spin = new THREE.Group();
  private pA: Pose = { ...BASE };
  private pB: Pose = { ...BASE };
  private umAngle = 0;
  private prevYaw = 0;
  private prev = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private v = new THREE.Vector3();
  private lastG = 0;
  private lastMoves: number[] | null = null;
  private umbInit = false;
  phase = 0;
  private free = 0;
  private fp = new THREE.Vector3();

  constructor(public boy = false) {
    const skin = rimify(new THREE.MeshStandardMaterial({ color: 0xffd9c8, roughness: 0.6, emissive: 0x3a1a12, emissiveIntensity: 0.5 }), 0.45);
    const hairM = rimify(new THREE.MeshStandardMaterial({ color: boy ? 0x15131c : 0x2a1620, roughness: boy ? 0.75 : 0.5, metalness: 0 }), 0.75);
    const cloth = boy ? rimify(new THREE.MeshStandardMaterial({ color: 0x2b3a58, roughness: 0.7 }), 0.7) : this.dressMat;
    const legM = boy ? rimify(new THREE.MeshStandardMaterial({ color: 0x161a26, roughness: 0.8 }), 0.7) : skin;
    const shoe = new THREE.MeshStandardMaterial({ color: boy ? 0x0c0c12 : 0xfff2f2, roughness: 0.4 });
    const j = this.j;
    const w = boy ? 1.25 : 1;
    j.hips = joint(this.root, 0, 0.92);
    j.torso = joint(j.hips, 0, 0);
    part(new THREE.CylinderGeometry(0.085 * w, 0.105 * w, 0.14, 16), cloth, j.torso, 0, 0.05, 0).scale.z = 0.8;
    j.chest = joint(j.torso, 0, 0.12);
    part(new THREE.CylinderGeometry(0.115 * w, 0.085 * w, 0.26, 16), cloth, j.chest, 0, 0.13, 0).scale.z = 0.75;
    part(new THREE.SphereGeometry(0.115 * w, 16, 10), cloth, j.chest, 0, 0.26, 0).scale.set(1.25, 0.5, 0.75);
    part(new THREE.CylinderGeometry(0.032, 0.038, 0.1, 10), skin, j.chest, 0, 0.34, 0);
    j.head = joint(j.chest, 0, 0.4);
    j.head.scale.setScalar(boy ? 1.06 : 1.14);
    part(new THREE.SphereGeometry(0.105, 24, 18), skin, j.head, 0, 0.09, 0).scale.set(0.92, 1.05, 0.98);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a0d14 });
    for (const sx of [-1, 1]) {
      part(new THREE.SphereGeometry(0.012, 8, 6), eyeM, j.head, sx * 0.038, 0.082, 0.096).scale.set(1, 1.5, 0.5);
      if (!boy) part(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8f9c, transparent: true, opacity: 0.45 }), j.head, sx * 0.062, 0.062, 0.078).scale.z = 0.3;
    }
    // hair
    const cap = part(new THREE.SphereGeometry(0.113, 24, 16, 0, PI * 2, 0, PI * 0.58), hairM, j.head, 0, 0.1, -0.012);
    cap.rotation.x = -0.52;
    if (!boy) {
      for (const sx of [-1, 1]) part(new THREE.CapsuleGeometry(0.03, 0.14, 4, 8), hairM, j.head, sx * 0.095, 0.04, 0.03);
      let p: THREE.Object3D = joint(j.head, 0, 0.1, -0.08);
      for (let i = 0; i < 6; i++) {
        const g = joint(p, 0, i ? -0.1 : 0);
        part(new THREE.SphereGeometry(0.085 - i * 0.009, 12, 8), hairM, g, 0, -0.05, 0).scale.set(1.2 - i * 0.08, 1, 0.55);
        this.hair.push(g); p = g;
      }
      const bow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff7799, emissiveIntensity: 0.8 });
      for (const sx of [-1, 1]) part(new THREE.ConeGeometry(0.035, 0.07, 8), bow, j.head, sx * 0.04, 0.19, -0.06).rotation.z = sx * 1.4;
    }
    // arms & legs
    for (const [n, sx] of [['L', 1], ['R', -1]] as [string, number][]) {
      const a = (j['arm' + n] = joint(j.chest, sx * 0.14 * w, 0.25));
      limb(a, 0.036 * w, 0.03 * w, 0.26, boy ? cloth : skin);
      const f = (j['fore' + n] = joint(a, 0, -0.26));
      limb(f, 0.03 * w, 0.024, 0.24, boy ? cloth : skin);
      j['hand' + n] = joint(f, 0, -0.27);
      part(new THREE.SphereGeometry(0.03, 10, 8), skin, j['hand' + n]).scale.set(0.8, 1.2, 1);
      const l = (j['leg' + n] = joint(j.hips, sx * 0.07 * w, -0.02));
      limb(l, 0.062 * w, 0.045 * w, 0.42, legM);
      const s = (j['shin' + n] = joint(l, 0, -0.42));
      limb(s, 0.045 * w, 0.033, 0.4, legM);
      j['foot' + n] = joint(s, 0, -0.42);
      part(new THREE.SphereGeometry(0.045, 10, 8), shoe, j['foot' + n], 0, 0, 0.045).scale.set(0.85, 0.7, 2);
    }
    if (boy) {
      part(new THREE.CylinderGeometry(0.12, 0.15, 0.3, 16, 1, true), cloth, j.hips, 0, -0.1, 0).scale.z = 0.8;
      this.root.scale.setScalar(1.08);
      return;
    }
    // skirt (deformed on CPU every frame)
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.1 + 0.36 * Math.pow(t, 0.8), -t * SK_LEN)); }
    const sg = new THREE.LatheGeometry(pts, 40);
    this.skirt = part(sg, this.dressMat, j.hips, 0, 0.04, 0);
    this.skBase = (sg.attributes.position.array as Float32Array).slice();
    this.buildUmbrella();
  }

  private buildUmbrella() {
    const pos: number[] = [], idx: number[] = [];
    const A = RIBS * 6, R = 10;
    for (let r = 0; r <= R; r++) for (let a = 0; a <= A; a++) {
      const t = r / R, ang = (a / A) * PI * 2, sag = Math.abs(S((RIBS * ang) / 2)), ph = t * 1.2;
      const rad = UM_R * (S(ph) / S(1.2)) * (1 - 0.07 * t * t * sag);
      pos.push(C(ang) * rad, UM_R * 0.52 * (C(ph) - C(1.2)) / (1 - C(1.2)) + 0.035 * t * t * sag, S(ang) * rad);
    }
    for (let r = 0; r < R; r++) for (let a = 0; a < A; a++) {
      const i = r * (A + 1) + a;
      idx.push(i, i + 1, i + A + 1, i + 1, i + A + 2, i + A + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const top = 0.5;
    const canopy = new THREE.Mesh(g, this.canopyMat);
    canopy.position.y = top; canopy.castShadow = true;
    this.spin.add(canopy);
    const metal = new THREE.MeshStandardMaterial({ color: 0xdfe6f5, metalness: 0.9, roughness: 0.25, emissive: 0x556688, emissiveIntensity: 0.4 });
    const lp: number[] = [];
    for (let i = 0; i < RIBS; i++) {
      const ang = (i / RIBS) * PI * 2;
      for (let r = 0; r < R; r++) for (const t of [r / R, (r + 1) / R]) {
        const ph = t * 1.2, rad = UM_R * S(ph) / S(1.2);
        lp.push(C(ang) * rad, top - 0.004 + UM_R * 0.52 * (C(ph) - C(1.2)) / (1 - C(1.2)), S(ang) * rad);
      }
      lp.push(C(ang) * UM_R * 0.5, top + 0.2, S(ang) * UM_R * 0.5, 0, top + 0.12, 0);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    this.spin.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })));
    part(new THREE.CylinderGeometry(0.008, 0.008, 1.1, 8), metal, this.spin, 0, 0.5, 0);
    part(new THREE.ConeGeometry(0.014, 0.1, 8), metal, this.spin, 0, top + 0.56, 0);
    const hook = part(new THREE.TorusGeometry(0.04, 0.012, 8, 16, PI), this.dressMat, this.spin, 0.04, -0.06, 0);
    hook.rotation.z = PI;
    this.umbrella.add(this.spin);
    this.umbLight.position.y = 0.75;
    this.umbrella.add(this.umbLight);
    this.umbrella.rotation.order = 'YXZ';
  }

  /** World position of a rim tip (for flung droplets). */
  rimPoint(i: number, out: THREE.Vector3) {
    const ang = (i / RIBS) * PI * 2;
    return this.spin.localToWorld(out.set(C(ang) * UM_R, 0.5, S(ang) * UM_R));
  }
  canopyCenter(out: THREE.Vector3) { return this.spin.localToWorld(out.set(0, 0.75, 0)); }

  /** g = beat within the scene; each move lasts one camera shot (seg beats). */
  update(g: number, moves: number[], dt: number, time: number, seg = 8) {
    const cut = this.lastMoves !== moves || Math.abs(g - this.lastG) > 2;
    this.lastG = g; this.lastMoves = moves;
    const si = Math.floor(g / seg), bs = g - si * seg, b = g % 4, n = moves.length, p = this.pA, q = this.pB, j = this.j;
    const mv = moves[((si % n) + n) % n], pm = moves[(((si - 1) % n) + n) % n];
    evalMove(mv, b, p, bs);
    if (bs < 1 && g > 1 && pm !== mv) {
      evalMove(pm, b + 4, q, bs + seg);
      const wgt = sm(0, 1, bs);
      for (const k in p) {
        if (k === 'yaw' || k === 'wa') { let d = (p[k] - q[k]) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; p[k] = q[k] + d * wgt; }
        else p[k] = q[k] + (p[k] - q[k]) * wgt;
      }
    }
    const br = S(time * 1.7) * 0.012;
    j.hips.rotation.set(p.lean, 0, p.side);
    j.torso.rotation.set(p.spX * 0.5, p.twist * 0.5, p.spZ * 0.5);
    j.chest.rotation.set(p.spX * 0.5 + br, p.twist * 0.5, p.spZ * 0.5);
    j.head.rotation.set(p.hX, p.hY, p.hZ);
    j.armL.rotation.set(-p.aLx, 0, p.aLz); j.foreL.rotation.x = -p.aLe;
    j.armR.rotation.set(-p.aRx, 0, -p.aRz); j.foreR.rotation.x = -p.aRe;
    j.legL.rotation.set(-p.lLx, 0, p.lLz); j.shinL.rotation.x = p.lLk;
    j.legR.rotation.set(-p.lRx, 0, -p.lRz); j.shinR.rotation.x = p.lRk;
    j.footL.rotation.x = Math.max(-0.3, p.lLx - p.lLk - p.lean) * 0.8;
    j.footR.rotation.x = Math.max(-0.3, p.lRx - p.lRk - p.lean) * 0.8;
    const r = this.root;
    r.rotation.y = this.yaw + p.yaw;
    r.position.y = 0;
    const bx = r.userData.bx || 0, bz = r.userData.bz || 0, cy = C(this.yaw), sy = S(this.yaw);
    r.position.x = bx + p.x * cy + p.z * sy; r.position.z = bz - p.x * sy + p.z * cy;
    const wc = r.userData.wc as THREE.Vector2 | undefined;
    if (wc && p.wr > 0.001) { // couple waltz: orbit the shared centre, always facing the partner
      const a = p.wa + this.phase;
      r.position.x += (wc.x + S(a) * 0.45 - r.position.x) * p.wr;
      r.position.z += (wc.y + C(a) * 0.45 - r.position.z) * p.wr;
      let dy = (a + PI - r.rotation.y) % (PI * 2); if (dy > PI) dy -= PI * 2; if (dy < -PI) dy += PI * 2;
      r.rotation.y += dy * p.wr;
    }
    r.updateMatrixWorld(true);
    const fy = Math.min(j.footL.getWorldPosition(this.v).y, j.footR.getWorldPosition(this.v).y);
    r.position.y = -fy + 0.04 + p.y + (r.userData.by || 0);
    r.updateMatrixWorld(true);
    if (cut) { // scene cut or jump: don't let the pose snap spike velocity
      this.prevYaw = r.rotation.y;
      this.prev.copy(r.position);
      this.spinVel = 0;
      this.vel.set(0, 0, 0);
      this.free = p.free;
    }
    // motion derivatives
    const d = Math.max(dt, 1e-3);
    let dy = r.rotation.y - this.prevYaw;
    if (Math.abs(dy) > 3) dy = 0;
    this.spinVel += (THREE.MathUtils.clamp(dy / d, -9, 9) - this.spinVel) * Math.min(1, d * 8);
    this.prevYaw = r.rotation.y;
    this.v.copy(r.position).sub(this.prev).divideScalar(d).clampLength(0, 4);
    this.vel.lerp(this.v, Math.min(1, d * 6));
    this.prev.copy(r.position);
    this.hair.forEach((h, i) => {
      h.rotation.x = (i ? 0.03 : 0.2) + S(time * 2.2 - i * 0.6) * 0.04 - p.hX * (i === 0 ? 0.8 : 0.1) + Math.abs(this.spinVel) * 0.03;
      h.rotation.z = S(time * 1.6 - i * 0.7) * 0.03 - this.spinVel * 0.02;
    });
    if (this.skirt && this.skBase) {
      const arr = this.skirt.geometry.attributes.position.array as Float32Array, B = this.skBase;
      const sv = this.spinVel, fl = Math.min(Math.abs(sv), 7);
      const ry = r.rotation.y, lvx = this.vel.x * C(ry) - this.vel.z * S(ry), lvz = this.vel.x * S(ry) + this.vel.z * C(ry);
      const fw = Math.max(p.lLx, p.lRx, 0), bk = Math.max(-p.lLx, -p.lRx, 0);
      for (let i = 0; i < arr.length; i += 3) {
        const x = B[i], y = B[i + 1], z = B[i + 2], t = -y / SK_LEN, t2 = t * t;
        const ang = Math.atan2(z, x), rad = Math.hypot(x, z);
        const f = 1 + fl * 0.085 * t + 0.045 * S(ang * 5 + time * 2.6) * t2 + 0.03 * S(ang * 9 - time * 3.7) * t2;
        const a2 = ang - sv * 0.05 * t2, nz = S(a2);
        let px = C(a2) * rad * f - lvx * 0.1 * t2, pz = nz * rad * f - lvz * 0.1 * t2;
        let py = y * (1 - Math.min(0.6, fl * 0.07) * t * 0.55) - this.vel.y * 0.05 * t2;
        const push = fw * Math.max(0, nz) + bk * Math.max(0, -nz) * 0.8;
        pz += push * 0.3 * t * Math.sign(nz); py += push * 0.2 * t;
        arr[i] = px; arr[i + 1] = py; arr[i + 2] = pz;
      }
      this.skirt.geometry.attributes.position.needsUpdate = true;
      this.skirt.geometry.computeVertexNormals();
      // umbrella follows the hand but keeps its own world-space attitude
      j.handR.getWorldPosition(this.v);
      this.free += (p.free - this.free) * Math.min(1, dt * 2.2);
      if (this.free > 0.002) { // floating free, the umbrella keeps dancing by itself
        this.fp.set(r.position.x + S(time * 0.8) * 0.35, r.position.y + 2.2 + S(time * 1.4) * 0.2, r.position.z + C(time * 0.7) * 0.35);
        this.v.lerp(this.fp, sm(0, 1, this.free));
      }
      if (!this.umbInit || this.v.distanceToSquared(this.umbrella.position) > 9) {
        this.umbrella.position.copy(this.v);
        this.umbInit = true;
      } else {
        this.umbrella.position.lerp(this.v, 1 - Math.exp(-Math.min(dt, 0.05) * 28));
      }
      this.umbrella.rotation.set(p.umX + S(time * 1.3) * (0.03 + 0.2 * this.free), r.rotation.y, p.umZ * (1 - this.free) + S(time * 0.9) * 0.22 * this.free);
      this.umAngle += p.rate * dt * 2.2;
      this.spin.rotation.y = this.umAngle;
      this.umbrella.updateMatrixWorld(true);
    }
  }
}
