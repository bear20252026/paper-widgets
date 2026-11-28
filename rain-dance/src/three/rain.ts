import * as THREE from 'three';
import type { Dancer } from './dancer';

let _glow: THREE.Texture | null = null;
export function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

const H = 15, AREA = 38, DROPS = 11000, RIPPLES = 420, DRIPS = 700;

export class Rain {
  group = new THREE.Group();
  u = {
    uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uUmb: { value: new THREE.Vector3(0, 2, 0) },
    uColor: { value: new THREE.Color(0xaaccff) }, uSwirl: { value: 0 }, uWind: { value: new THREE.Vector2(0.1, 0) },
    uBeat: { value: 0 }, uAmount: { value: 1 },
  };
  private rings: THREE.Mesh[] = [];
  private ringT: number[] = [];
  private ringI = 0;
  private dp = new Float32Array(DRIPS * 3);
  private dv = new Float32Array(DRIPS * 3);
  private dl = new Float32Array(DRIPS);
  private drips: THREE.Points;
  private di = 0;
  private acc = 0;
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private rainTime = 0;
  private streakGeo!: THREE.BufferGeometry;
  private rippleGeo!: THREE.InstancedBufferGeometry;

  constructor() {
    // ---- falling streaks
    const seed = new Float32Array(DROPS * 8), end = new Float32Array(DROPS * 2), pos = new Float32Array(DROPS * 6);
    for (let i = 0; i < DROPS; i++) {
      const a = [(Math.random() - 0.5) * AREA, (Math.random() - 0.5) * AREA, Math.random(), 9 + Math.random() * 7];
      seed.set(a, i * 8); seed.set(a, i * 8 + 4);
      end[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.streakGeo = g;
    const streaks = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 aSeed; attribute float aEnd;
        uniform float uTime, uSwirl, uBeat, uAmount; uniform vec3 uCenter, uUmb; uniform vec2 uWind;
        varying float vA;
        void main(){
          float H = ${H.toFixed(1)};
          float len = (0.25 + aSeed.w * 0.035) * (1.0 + uBeat * 0.6);
          float y = H - mod(aSeed.z * H + uTime * aSeed.w, H) + len * (1.0 - aEnd);
          vec3 p = vec3(aSeed.x, y, aSeed.y);
          p.xz += uWind * (H - y) * 0.35;
          vec2 d = p.xz - uCenter.xz; float r = length(d);
          float ang = uSwirl * exp(-r * 0.3) * (0.4 + y * 0.12);
          float c = cos(ang), s = sin(ang);
          p.xz = uCenter.xz + mat2(c, -s, s, c) * d;
          float hd = distance(p.xz, uUmb.xz + uWind * (uUmb.y - y) * -0.35);
          float under = step(hd, 0.8) * step(y - len, uUmb.y);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float fade = smoothstep(45.0, 8.0, -mv.z) * smoothstep(0.3, 2.0, -mv.z);
          vA = (0.12 + 0.5 * aEnd) * fade * (1.0 - under) * step(fract(aSeed.z * 91.7), uAmount) * (0.75 + uBeat * 0.6);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main(){ gl_FragColor = vec4(uColor * vA, vA); }`,
    }));
    streaks.frustumCulled = false;
    this.group.add(streaks);

    // ---- raindrop ripples on the wet ground
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = plane.index;
    ig.setAttribute('position', plane.attributes.position);
    ig.setAttribute('uv', plane.attributes.uv);
    const off = new Float32Array(RIPPLES * 4);
    for (let i = 0; i < RIPPLES; i++) off.set([(Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26, Math.random(), 0.35 + Math.random() * 0.7], i * 4);
    ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    ig.instanceCount = RIPPLES;
    this.rippleGeo = ig;
    const ringFrag = /* glsl */ `
      uniform vec3 uColor; varying vec2 vUv; varying float vLife;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float ring = smoothstep(0.12, 0.0, abs(r - 0.82)) + 0.4 * smoothstep(0.1, 0.0, abs(r - 0.45)) * step(0.3, vLife);
        float a = ring * (1.0 - vLife) * (1.0 - vLife);
        gl_FragColor = vec4(uColor * a * 1.3, a);
      }`;
    const ripples = new THREE.Mesh(ig, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 aOff; uniform float uTime, uBeat; varying vec2 vUv; varying float vLife;
        float h(float n){ return fract(sin(n * 127.1) * 43758.5453); }
        void main(){
          float t = uTime * 0.09 * (0.7 + aOff.z) + aOff.z * 7.0, cyc = floor(t);
          vLife = fract(t); vUv = uv;
          vec2 o = aOff.xy + (vec2(h(cyc + aOff.z), h(cyc * 1.7 + aOff.x)) - 0.5) * 8.0;
          vec3 p = position * aOff.w * (0.15 + vLife) * (1.0 + uBeat * 0.3) + vec3(o.x, 0.012, o.y);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: ringFrag,
    }));
    ripples.frustumCulled = false;
    this.group.add(ripples);

    // ---- beat rings from her feet
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(plane, new THREE.ShaderMaterial({
        uniforms: { uColor: this.u.uColor, uLife: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `uniform float uLife; varying vec2 vUv; varying float vLife;
          void main(){ vUv = uv; vLife = uLife; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: ringFrag,
      }));
      m.visible = false;
      this.rings.push(m); this.ringT.push(9);
      this.group.add(m);
    }

    // ---- droplets flung from the umbrella rim
    const dg = new THREE.BufferGeometry();
    this.dp.fill(-99);
    dg.setAttribute('position', new THREE.BufferAttribute(this.dp, 3));
    this.drips = new THREE.Points(dg, new THREE.PointsMaterial({
      map: glowTex(), size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff, opacity: 0.9,
    }));
    this.drips.frustumCulled = false;
    this.group.add(this.drips);
  }

  /** Reduce particle counts on weak GPUs (q in 0..1). Buffers stay allocated. */
  setQuality(q: number) {
    this.streakGeo.setDrawRange(0, Math.floor(DROPS * q) * 2);
    this.rippleGeo.instanceCount = Math.floor(RIPPLES * q);
  }

  /** Hide beat rings (used on scene cuts). */
  reset() {
    this.ringT.fill(9);
    this.rings.forEach((r) => (r.visible = false));
  }

  setColor(c: THREE.Color) {
    this.u.uColor.value.copy(c);
    (this.drips.material as THREE.PointsMaterial).color.copy(c).lerp(new THREE.Color(0xffffff), 0.5);
  }

  beat(pos: THREE.Vector3, strong: boolean) {
    const i = this.ringI++ % this.rings.length;
    this.rings[i].position.set(pos.x, 0.015, pos.z);
    this.rings[i].userData.s = strong ? 7 : 4;
    this.ringT[i] = 0;
  }

  /** Burst of droplets (e.g. on a bar accent). */
  burst(girl: Dancer, n: number, power: number) {
    girl.canopyCenter(this.v2);
    for (let k = 0; k < n; k++) {
      girl.rimPoint(k % 8 + Math.random(), this.v);
      this.emit(this.v, (this.v.x - this.v2.x) * power, 1 + Math.random() * 2, (this.v.z - this.v2.z) * power);
    }
  }

  private emit(p: THREE.Vector3, vx: number, vy: number, vz: number) {
    const i = this.di++ % DRIPS;
    this.dp.set([p.x, p.y, p.z], i * 3);
    this.dv.set([vx, vy, vz], i * 3);
    this.dl[i] = 1.6;
  }

  update(dt: number, beatPulse: number, girl: Dancer, speed: number) {
    this.rainTime += dt * speed;
    this.u.uTime.value = this.rainTime;
    this.u.uBeat.value = beatPulse;
    this.u.uCenter.value.copy(girl.root.position);
    girl.canopyCenter(this.u.uUmb.value);
    this.u.uSwirl.value += (girl.spinVel * 0.22 - this.u.uSwirl.value) * Math.min(1, dt * 2.5);
    this.rings.forEach((r, i) => {
      this.ringT[i] += dt * 0.8;
      const t = this.ringT[i];
      r.visible = t < 1;
      if (r.visible) {
        r.scale.setScalar(0.3 + (r.userData.s || 4) * (1 - Math.pow(1 - t, 2.5)));
        (r.material as THREE.ShaderMaterial).uniforms.uLife.value = t * 0.85;
      }
    });
    // rim drips: tangential velocity from umbrella spin + body spin
    const c = girl.canopyCenter(this.v3);
    this.acc += dt * (30 + Math.abs(girl.spinVel) * 28);
    while (this.acc > 1) {
      this.acc -= 1;
      const p = girl.rimPoint(Math.floor(Math.random() * 8) + (Math.random() - 0.5) * 0.3, this.v);
      const rx = p.x - c.x, rz = p.z - c.z, w = 1.6 + girl.spinVel * 0.9;
      this.emit(p, -rz * w + rx * 0.8, Math.random() * 0.4, rx * w + rz * 0.8);
    }
    for (let i = 0; i < DRIPS; i++) {
      if (this.dl[i] <= 0) continue;
      this.dl[i] -= dt;
      const k = i * 3;
      this.dv[k + 1] -= 9.8 * dt;
      this.dp[k] += this.dv[k] * dt; this.dp[k + 1] += this.dv[k + 1] * dt; this.dp[k + 2] += this.dv[k + 2] * dt;
      if (this.dp[k + 1] < 0.02) {
        if (this.dv[k + 1] < -2.5 && Math.random() < 0.5) { this.dv[k + 1] *= -0.25; this.dv[k] *= 0.4; this.dv[k + 2] *= 0.4; this.dp[k + 1] = 0.03; }
        else { this.dl[i] = 0; this.dp[k + 1] = -99; }
      }
      if (this.dl[i] <= 0) this.dp[k + 1] = -99;
    }
    this.drips.geometry.attributes.position.needsUpdate = true;
  }
}
