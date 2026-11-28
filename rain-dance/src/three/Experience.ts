import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Dancer, RIM } from './dancer';
import { Rain, glowTex } from './rain';
import { buildScenes, type Env, type Shot } from './scenes';
import { Score } from './audio';

export const BEAT = 0.6; // 100 BPM
export const BEATS_PER_SCENE = 32;
export const BEATS_PER_SHOT = 8;
const WALK = [12];
const sst = THREE.MathUtils.smoothstep, lerp = THREE.MathUtils.lerp;

export interface Hooks { onScene: (i: number) => void; onBeat: (localBeat: number) => void }

interface ShotDef { r: number; h: number; a: number; da: number; ty: number; fov: number; dr?: number; pair?: boolean }
/** Shot library — every cut lands on a downbeat. a = azimuth, da = drift (rad/s), r = distance. */
const LIB: ShotDef[] = [
  { r: 3.0, h: 1.5, a: -0.5, da: 0.08, ty: 1.4, fov: 32 },          // 0 medium close, slow arc
  { r: 3.4, h: 0.28, a: 0.5, da: -0.07, ty: 1.25, fov: 44 },        // 1 low hero angle from the puddles
  { r: 5.2, h: 1.3, a: -0.9, da: 0.28, ty: 1.15, fov: 38 },         // 2 tracking orbit
  { r: 3.6, h: 3.4, a: 0.2, da: 0.22, ty: 1.1, fov: 44 },           // 3 high — the umbrella blooms
  { r: 7.5, h: 1.6, a: 0.1, da: 0.03, ty: 1.3, fov: 30, dr: -0.25 }, // 4 telephoto push-in
  { r: 2.2, h: 0.35, a: -0.25, da: 0.1, ty: 0.55, fov: 40 },        // 5 feet & ripples
  { r: 4.4, h: 1.5, a: 1.35, da: 0.06, ty: 1.25, fov: 34 },         // 6 profile
  { r: 6.2, h: 1.4, a: 0.25, da: 0.05, ty: 1.3, fov: 34, pair: true }, // 7 two-shot
  { r: 3.6, h: 1.25, a: -0.2, da: -0.05, ty: 1.4, fov: 32, pair: true }, // 8 close two-shot
  { r: 4.6, h: 1.4, a: -0.8, da: 0.26, ty: 1.2, fov: 38, pair: true },   // 9 orbit the couple
];

const FilmShader = {
  uniforms: {
    tDiffuse: { value: null }, uFade: { value: 1 }, uTime: { value: 0 }, uPulse: { value: 0 }, uCut: { value: 0 },
    uDrops: { value: 0 }, uAspect: { value: 1.7 }, uTint: { value: new THREE.Color() },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uFade, uTime, uPulse, uCut, uDrops, uAspect; uniform vec3 uTint; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    // raindrops sliding on the lens
    vec2 drops(vec2 uv){
      vec2 acc = vec2(0.0);
      for (int i = 0; i < 2; i++) {
        float fi = float(i);
        vec2 g = vec2(uv.x * uAspect, uv.y) * (6.0 + fi * 5.0) + vec2(fi * 3.7, 0.0);
        vec2 id = floor(g), f = fract(g) - 0.5;
        float h1 = h(id + fi * 7.31), h2 = h(id * 1.37 + 11.0 + fi);
        float life = fract(uTime * (0.04 + h1 * 0.06) + h2);
        vec2 d = f - vec2((h1 - 0.5) * 0.5, 0.3 - life * 0.6 * h2); d.y *= 1.25;
        float r = 0.07 + 0.08 * h2;
        acc += d * smoothstep(r, r * 0.4, length(d)) * step(0.62, h1) * (1.0 - life);
      }
      return acc;
    }
    void main(){
      vec2 c = vUv - 0.5; float w = uFade;
      vec2 uv = vUv + drops(vUv) * 0.09 * uDrops;
      uv += vec2(sin(uv.y * 38.0 + uTime * 5.0), cos(uv.x * 31.0 - uTime * 4.0)) * 0.012 * w;
      uv.y += w * w * 0.05 * sin(uv.x * 9.0 + uTime);
      uv = 0.5 + (uv - 0.5) * (1.0 - uCut * 0.014);
      float ca = (0.0015 + uPulse * 0.002 + w * 0.012 + uCut * 0.004) * length(c) * 2.0;
      vec3 col = vec3(texture2D(tDiffuse, uv + c * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - c * ca).b);
      col *= 1.0 - dot(c, c) * 1.15;
      col += uCut * 0.05;
      col = mix(col, uTint, smoothstep(0.0, 1.0, w * 1.8 - 0.8 * h(vec2(floor(uv.x * 140.0), 3.0))));
      col += (h(vUv * vec2(1920.0, 1080.0) + uTime) - 0.5) * 0.025;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export class Experience {
  envs: Env[];
  score = new Score();
  paused = false;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private film: ShaderPass;
  private girl = new Dancer();
  private boy = new Dancer(true);
  private rain = new Rain();
  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private ground: Reflector;
  private hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
  private key = new THREE.DirectionalLight(0xffffff, 1.4);
  private rim = new THREE.DirectionalLight(0xffffff, 2);
  private blob: THREE.Mesh;
  private blob2: THREE.Mesh;
  private shot: Shot = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), fov: 42 };
  private clock = new THREE.Clock();
  private time = 0;
  private cur = -1;
  private lastBeat = -1;
  private lastShot = -1;
  private flash = 0;
  private cutFx = 0;
  private raf = 0;
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private tgt = new THREE.Vector3();
  private tmpC = new THREE.Color();
  private pixelCap = 1.6;
  private calm = false;
  private umbK = 1;
  private fpsAcc = 0; private fpsN = 0; private fpsT = 0; private stepped = false;

  constructor(private host: HTMLElement, private hooks: Hooks) {
    const small = Math.min(window.innerWidth, window.innerHeight) < 620;
    this.pixelCap = small ? 1.25 : 1.6;
    this.calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: !small, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.pixelCap));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    host.appendChild(r.domElement);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.03);

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uStars: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 },
        uOrbDir: { value: new THREE.Vector3(0, 1, 0) }, uOrbCol: { value: new THREE.Color() }, uOrbSize: { value: 0 },
      },
      vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uHor, uFog, uOrbDir, uOrbCol; uniform float uStars, uTime, uFlash, uOrbSize; varying vec3 vD;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vD);
          vec3 col = mix(uHor, uTop, pow(smoothstep(-0.06, 0.7, d.y), 0.6));
          vec2 uv = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0))) * 70.0, id = floor(uv), f = fract(uv) - 0.5;
          float s = h(id);
          col += uStars * step(0.975, s) * smoothstep(0.16, 0.0, length(f)) * (0.6 + 0.4 * sin(uTime * 2.0 + s * 90.0)) * smoothstep(0.0, 0.3, d.y) * 1.6;
          float dd = distance(d, normalize(uOrbDir));
          col += uOrbCol * (smoothstep(uOrbSize, uOrbSize * 0.82, dd) * 1.25 + 0.2 * exp(-dd * 7.0)) * step(0.0001, uOrbSize);
          float cl = sin(d.x * 6.0 + uTime * 0.05) * sin(d.z * 5.0 - uTime * 0.04) * 0.5 + 0.5;
          col += (uHor * 0.25 * cl + uFlash * vec3(0.7, 0.75, 1.0) * (0.4 + cl)) * smoothstep(-0.1, 0.5, d.y);
          col = mix(uFog, col, smoothstep(-0.005, 0.085, d.y));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }));
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    // wet mirror ground: raindrop ripple normals bend the reflection, optional paving tiles
    this.ground = new Reflector(new THREE.PlaneGeometry(400, 400), {
      textureWidth: small ? 512 : 1024, textureHeight: small ? 512 : 1024, clipBias: 0.003,
      shader: {
        name: 'WetGround',
        uniforms: {
          color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
          uTime: { value: 0 }, uPulse: { value: 0 }, uFog: { value: new THREE.Color() }, uFogD: { value: 0.03 }, uBase: { value: new THREE.Color() },
          uTile: { value: 0 }, uWet: { value: 1 },
        },
        vertexShader: /* glsl */ `
          uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
          void main(){ vUv = textureMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D tDiffuse; uniform float uTime, uPulse, uFogD, uTile, uWet; uniform vec3 uFog, uBase; varying vec4 vUv; varying vec3 vW;
          float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float rip(vec2 uv, float t){
            float s = 0.0;
            for (int i = 0; i < 3; i++) {
              float fi = float(i); vec2 g = uv * (1.1 + fi * 0.6) + fi * 13.7; vec2 c = floor(g), f = fract(g) - 0.5;
              float k = hs(c + fi), tt = fract(t * (0.7 + k * 0.5) + k * 7.0);
              vec2 o = (vec2(hs(c + 3.1), hs(c + 7.7)) - 0.5) * 0.6;
              float d = length(f - o), r = tt * 0.42;
              s += sin((d - r) * 50.0) * smoothstep(0.07, 0.0, abs(d - r)) * (1.0 - tt);
            }
            return s;
          }
          void main(){
            vec2 w = vW.xz; float e = 0.03, r0 = rip(w, uTime);
            vec2 n = vec2(rip(w + vec2(e, 0.0), uTime) - r0, rip(w + vec2(0.0, e), uTime) - r0) / e * 0.01 * uWet;
            n += vec2(sin(w.y * 3.0 + uTime * 0.8), cos(w.x * 2.7 - uTime * 0.6)) * 0.004 + sin(length(w) * 5.0 - uTime * 4.0) * 0.004 * uPulse;
            vec4 uv = vUv; uv.xy += n * uv.w * 1.5;
            vec3 refl = texture2DProj(tDiffuse, uv).rgb;
            vec3 V = cameraPosition - vW; float dist = length(V);
            float fres = mix(0.4, 1.0, pow(1.0 - clamp(V.y / dist, 0.0, 1.0), 2.5));
            float on = step(0.01, uTile); vec2 tp = w * uTile; vec2 tf = abs(fract(tp) - 0.5);
            float line = smoothstep(0.44, 0.5, max(tf.x, tf.y)) * on;
            vec3 col = uBase * mix(1.0, hs(floor(tp)) * 0.8 + 0.6, on) * (1.0 - line * 0.6) + refl * fres * 0.9 * (1.0 - line * 0.45);
            col += uFog * max(r0, 0.0) * 0.12 * uWet;
            col = mix(col, uFog, 1.0 - exp(-uFogD * uFogD * dist * dist));
            gl_FragColor = vec4(col, 1.0);
          }`,
      },
    });
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);

    const blobMat = new THREE.MeshBasicMaterial({ map: glowTex(), color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), blobMat);
    this.blob2 = this.blob.clone();
    this.scene.add(this.blob, this.blob2);

    this.scene.add(this.hemi, this.key, this.key.target, this.rim, this.rim.target);
    this.scene.add(this.girl.root, this.girl.umbrella, this.boy.root, this.rain.group);
    this.boy.phase = Math.PI;
    if (small) this.rain.setQuality(0.62);

    this.envs = buildScenes();
    this.envs.forEach((e) => { e.group.visible = false; this.scene.add(e.group); });

    const c = (this.composer = new EffectComposer(r));
    c.addPass(new RenderPass(this.scene, this.cam));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.85, 0.75, 0.8);
    c.addPass(this.bloom);
    this.film = new ShaderPass(FilmShader);
    c.addPass(this.film);
    c.addPass(new OutputPass());

    window.addEventListener('resize', this.resize);
    this.resize();
    this.setScene(0);
    if (location.hash === '#debug') (window as unknown as { __rain?: Experience }).__rain = this;
    this.tick();
  }

  private resize = () => {
    const w = this.host.clientWidth || window.innerWidth, h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  };

  /** Restart the story from the first beat (also unlocks audio). */
  begin() { this.score.start(); this.time = 0; this.lastBeat = -1; this.paused = false; }
  jump(i: number) { this.time = i * BEATS_PER_SCENE * BEAT + 0.001; this.lastBeat = -1; }
  togglePause() {
    this.paused = !this.paused;
    const ctx = this.score.ctx;
    if (ctx) { if (this.paused) ctx.suspend(); else ctx.resume(); }
    return this.paused;
  }

  private setScene(i: number) {
    this.cur = i;
    const e = this.envs[i], su = this.sky.material.uniforms, gu = (this.ground.material as THREE.ShaderMaterial).uniforms;
    this.envs.forEach((x, k) => (x.group.visible = k === i));
    su.uTop.value.set(e.skyTop); su.uHor.value.set(e.skyHor); su.uFog.value.set(e.fog); su.uStars.value = e.stars;
    su.uOrbSize.value = e.orb ? e.orb.size : 0;
    if (e.orb) { su.uOrbDir.value.set(...e.orb.dir); su.uOrbCol.value.set(e.orb.color); }
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.set(e.fog); fog.density = e.fogD;
    gu.uFog.value.set(e.fog); gu.uFogD.value = e.fogD; gu.uBase.value.set(e.fog).multiplyScalar(0.22); gu.uTile.value = e.tile ?? 0;
    this.hemi.color.set(e.amb); this.hemi.groundColor.set(e.fog);
    this.key.color.set(e.key); this.rim.color.set(e.rim);
    RIM.value.set(e.rim).multiplyScalar(0.9);
    this.film.uniforms.uTint.value.set(e.fog).lerp(this.tmpC.set(e.rain), 0.3);
    this.rain.setColor(this.tmpC.set(e.rain));
    this.rain.u.uWind.value.set(e.wind[0], e.wind[1]);
    const g = this.girl;
    g.dressMat.color.set(e.dress);
    g.canopyMat.color.set(e.umb); g.canopyMat.emissive.set(e.umb);
    const uc = this.tmpC.set(e.umb);
    this.umbK = 1 - 0.6 * (0.2126 * uc.r + 0.7152 * uc.g + 0.0722 * uc.b); // pale canopies glow less, so they never blow out
    g.umbLight.color.set(e.umb).lerp(this.tmpC.set(0xffffff), 0.45);
    g.yaw = e.girlYaw ?? 0;
    const wc = e.waltz ? new THREE.Vector2(e.waltz[0], e.waltz[1]) : undefined;
    g.root.userData.wc = wc; this.boy.root.userData.wc = wc;
    if (e.boy) {
      const u = this.boy.root.userData, b = e.boy;
      u.bx = b.from ? b.from[0] : b.x; u.bz = b.from ? b.from[1] : b.z; u.by = b.y || 0;
      this.boy.yaw = b.from ? Math.atan2(b.x - b.from[0], b.z - b.from[1]) : b.yaw;
    }
    this.lastShot = -1;
    this.rain.reset();
    this.hooks.onScene(i);
  }

  /** The boy's part of the story: walking in from afar, standing, waltzing. */
  private placeBoy(e: Env, p: number, lb: number, dt: number, t: number) {
    const b = e.boy!, u = this.boy.root.userData;
    let moves = b.moves, yaw = b.yaw;
    if (b.from) {
      const k = sst(p, 0.06, b.arrive ?? 0.5);
      u.bx = lerp(b.from[0], b.x, k); u.bz = lerp(b.from[1], b.z, k);
      if (k < 0.995) { moves = WALK; yaw = Math.atan2(b.x - b.from[0], b.z - b.from[1]); }
    }
    let d = (yaw - this.boy.yaw) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    this.boy.yaw += d * Math.min(1, dt * 3);
    this.boy.update(lb, moves, dt, t, BEATS_PER_SHOT);
    this.blob2.position.set(this.boy.root.position.x, (b.y || 0) + 0.014, this.boy.root.position.z);
  }

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const rawDt = Math.min(this.clock.getDelta(), 0.05);
    const dt = this.paused || document.hidden ? 0 : rawDt;
    this.time += dt;
    const t = this.time, bf = t / BEAT, n = this.envs.length;
    const si = Math.floor(bf / BEATS_PER_SCENE) % n, lb = bf % BEATS_PER_SCENE, p = lb / BEATS_PER_SCENE, bi = Math.floor(bf);
    if (si !== this.cur) this.setScene(si);
    const e = this.envs[si], pulse = Math.exp(-(bf % 1) * 4.5), girl = this.girl, boy = this.boy;
    const shotI = Math.floor(lb / BEATS_PER_SHOT), sp = (lb - shotI * BEATS_PER_SHOT) / BEATS_PER_SHOT, sid = si * 8 + shotI;
    const showBoy = !!e.boy && (e.boy.until === undefined || p < e.boy.until);

    if (bi !== this.lastBeat) {
      this.lastBeat = bi;
      const q = Math.floor(lb);
      this.rain.beat(girl.root.position, q % 4 === 0);
      if (q % 4 === 0) this.rain.burst(girl, 60, 3.2);
      if (e.thunder && q % 16 === 12) { this.flash = 1; this.score.thunder(); }
      this.score.beat(si, q, BEAT);
      this.score.setRain(e.rainAmt);
      this.hooks.onBeat(q);
    }
    this.flash *= Math.exp(-dt * 4);
    this.cutFx *= Math.exp(-dt * 7);

    // dancers
    girl.update(lb, e.moves, dt, t, BEATS_PER_SHOT);
    boy.root.visible = this.blob2.visible = showBoy;
    if (showBoy) this.placeBoy(e, p, lb, dt, t);
    girl.umbLight.intensity = (1.3 + pulse * 1.7) * this.umbK;
    girl.canopyMat.emissiveIntensity = (0.45 + pulse * 0.6) * this.umbK;
    const gp = girl.root.position;
    this.blob.position.set(gp.x, 0.014, gp.z);
    this.blob.scale.setScalar(1 - Math.min(0.5, gp.y * 0.8));

    // the rain breathes with the beat: it hangs for an instant, then rushes
    const frac = bf % 1;
    this.rain.u.uAmount.value += (e.rainAmt - this.rain.u.uAmount.value) * Math.min(1, dt * 3 + (lb < 0.1 ? 1 : 0));
    this.rain.update(dt, pulse, girl, 0.35 + 0.95 * Math.min(1, frac * 2.4));
    e.update(t, lb, pulse, p);

    // camera — a new shot every two bars, cut exactly on the downbeat
    const cam = this.cam, portrait = Math.max(0, 1 - cam.aspect), def = e.shots[shotI] ?? -1;
    if (sid !== this.lastShot && this.lastShot >= 0) this.cutFx = 1;
    if (def < 0) {
      e.cam(sp, this.shot);
      this.v.copy(this.shot.tgt); this.v.x += gp.x * 0.6; this.v.z += gp.z * 0.6;
    } else {
      const d = LIB[def], subj = this.v2.copy(gp);
      if (d.pair && showBoy) subj.lerp(boy.root.position, 0.5);
      subj.y = 0;
      if (sid !== this.lastShot) this.tgt.copy(subj); else this.tgt.lerp(subj, Math.min(1, dt * 2.5));
      const ts = sp * BEATS_PER_SHOT * BEAT, az = d.a + d.da * ts, rr = d.r + (d.dr ?? 0) * ts;
      this.shot.pos.set(this.tgt.x + Math.sin(az) * rr, d.h, this.tgt.z + Math.cos(az) * rr);
      this.shot.fov = d.fov;
      this.v.set(this.tgt.x, d.ty + gp.y * 0.3, this.tgt.z);
    }
    this.lastShot = sid;
    cam.position.copy(this.shot.pos);
    if (!this.calm) { cam.position.x += Math.sin(t * 0.5) * 0.06; cam.position.y += Math.sin(t * 0.37) * 0.04; }
    if (portrait > 0) {
      this.v2.copy(cam.position).sub(this.v).multiplyScalar(1 + portrait * 0.4);
      cam.position.copy(this.v).add(this.v2);
    }
    cam.position.y = Math.max(0.2, cam.position.y);
    cam.fov = (this.shot.fov - (this.calm ? 0 : pulse * 0.6)) * (1 + portrait * 0.45);
    cam.updateProjectionMatrix();
    cam.lookAt(this.v);
    this.sky.position.copy(cam.position);

    // lights follow the lens
    this.key.position.copy(cam.position).add(this.v2.set(-3, 4, 1));
    this.key.target.position.set(gp.x, 1.1, gp.z);
    this.v2.set(gp.x - cam.position.x, 0, gp.z - cam.position.z).normalize();
    this.rim.position.set(gp.x + this.v2.x * 5 + 2, 3.5, gp.z + this.v2.z * 5);
    this.rim.target.position.set(gp.x, 1.2, gp.z);
    this.hemi.intensity = 1.15 + pulse * 0.35 + this.flash * 5;
    this.rim.intensity = 1.9 + pulse * 1.0;

    // uniforms, transitions, post
    const su = this.sky.material.uniforms, gu = (this.ground.material as THREE.ShaderMaterial).uniforms, fu = this.film.uniforms;
    su.uTime.value = t; su.uFlash.value = this.flash;
    gu.uTime.value = t; gu.uPulse.value = pulse; gu.uWet.value = 0.25 + 0.75 * Math.min(1, this.rain.u.uAmount.value * 1.4);
    fu.uFade.value = Math.min(1, sst(lb, BEATS_PER_SCENE - 1.2, BEATS_PER_SCENE) + 1 - sst(lb, 0, 1.2));
    fu.uTime.value = t % 100; fu.uPulse.value = pulse; fu.uCut.value = this.calm ? 0 : this.cutFx;
    fu.uDrops.value = this.calm ? 0 : Math.min(1, this.rain.u.uAmount.value * 1.1); fu.uAspect.value = cam.aspect;
    this.bloom.strength = 0.7 + pulse * 0.22 + Math.exp(-lb * 1.6) * 0.6 + this.cutFx * 0.25 + this.flash * 0.5;
    this.composer.render();
    if (!this.stepped && dt > 0) {
      this.fpsAcc += rawDt; this.fpsN++; this.fpsT += rawDt;
      if (this.fpsT > 4 && this.fpsN > 30 && this.fpsN / this.fpsAcc < 36) {
        this.stepped = true;
        const pr = Math.max(1, Math.min(window.devicePixelRatio, this.pixelCap) - 0.35);
        this.renderer.setPixelRatio(pr);
        this.composer.setPixelRatio(pr);
        this.rain.setQuality(0.55);
      }
    }
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.score.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
