import * as THREE from 'three';
import {
  ATLAS_FRAMES,
  CELL,
  MOUTHS,
  makeArchCanvas,
  makeCurtainCanvas,
  makeFloorCanvas,
  makeGlowCanvas,
  makeMarqueeTitle,
  makeNoteAtlas,
  makeStageCanvas,
  makeWallCanvas,
  type Kind,
} from '../pixel/art';
import { atlasCanvas } from '../pixel/portraits';
import type { Live } from '../audio/AudioEngine';

// Stylised pipeline: paint pixels, light them, write them straight out.
THREE.ColorManagement.enabled = false;

export type SceneCfg = {
  notes: boolean;
  smoke: boolean;
  disco: boolean;
  pixel: number;
  scan: number;
  glow: number;
  lightMode: 'auto' | 'warm' | 'ice' | 'rave';
  focus: Kind | null;
  energy: number;
};

type MemberDef = { kind: Kind; label: string; role: string; inst: string; x: number; z: number; y: number; div: number; tint: string };

export const BAND: MemberDef[] = [
  { kind: 'deer', label: 'Double Bass', role: 'deer · upright', inst: 'bass', x: -5.3, z: -3.1, y: 1.0, div: 1, tint: '#ffd9a0' },
  { kind: 'cat', label: 'Drums', role: 'cat · brushes', inst: 'drums', x: 0, z: -3.4, y: 1.0, div: 2, tint: '#ffbe86' },
  { kind: 'bear', label: 'Flute', role: 'bear · woodwind', inst: 'flute', x: 5.3, z: -3.1, y: 1.0, div: 0.5, tint: '#ffe3b0' },
  { kind: 'tiger', label: 'Synth', role: 'tiger · keys', inst: 'synth', x: -5.3, z: 3.8, y: 0, div: 2, tint: '#ffbf7a' },
  { kind: 'owl', label: 'Voice', role: 'owl · lead', inst: 'voice', x: 0, z: 3.4, y: 0, div: 0.5, tint: '#ffe9c4' },
  { kind: 'raccoon', label: 'Guitar', role: 'raccoon · archtop', inst: 'guitar', x: 5.3, z: 3.8, y: 0, div: 1, tint: '#ffb88a' },
];

const PX = 0.05; // one art pixel in world units
const SP = PX * 1.62; // sprite plane scale
const FOOT_PAD = 5 * SP; // art rows left empty under the shoes

const spriteVert = /* glsl */ `
  varying vec2 vUv; varying vec3 vW;
  void main(){
    vUv = uv;
    vec4 w = modelMatrix * vec4(position,1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const spriteFrag = /* glsl */ `
  precision mediump float;
  uniform sampler2D map; uniform vec2 frameStep; uniform float frame;
  uniform vec3 lightCol; uniform vec3 lightPos; uniform vec3 ambCol;
  uniform vec3 key2; uniform vec3 key2Pos;
  uniform float flash; uniform float alpha; uniform float flip;
  varying vec2 vUv; varying vec3 vW;
  void main(){
    vec2 u = vUv;
    if(flip > 0.5) u.x = 1.0 - u.x;
    vec4 t = texture2D(map, u * frameStep + vec2(frame,0.0) * frameStep);
    if(t.a < 0.5) discard;
    // two-source stage lighting on the sprite, quantised for a pixel-art feel
    vec3 n = normalize(vec3(0.0,0.35,1.0));
    float k = 0.0;
    vec3 d1 = lightPos - vW; float dist1 = length(d1);
    k += max(0.0, dot(n, d1/dist1)) * clamp(1.0 - dist1/24.0, 0.0, 1.0) * 1.45;
    vec3 d2 = key2Pos - vW; float dist2 = length(d2);
    float k2 = max(0.0, dot(n, d2/dist2)) * clamp(1.0 - dist2/22.0, 0.0, 1.0) * 1.1;
    // Keep the painted palette legible; spotlights tint it rather than bleaching it.
    vec3 lit = t.rgb * (ambCol + vec3(0.48) + lightCol * k * 0.18 + key2 * k2 * 0.09);
    lit += t.rgb * flash * 0.10;
    lit = clamp(lit, 0.0, 1.0);
    float a = t.a * alpha;
    if(a < 0.08) a = 0.0;
    gl_FragColor = vec4(lit, a);
  }`;

const quadVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy*2.0,0.0,1.0); }`;

const bloomFrag = /* glsl */ `
  precision mediump float; uniform sampler2D tDiffuse; uniform vec2 texel; uniform float thresh;
  varying vec2 vUv;
  void main(){
    vec3 c = vec3(0.0);
    for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++){
      c += texture2D(tDiffuse, vUv + vec2(float(x),float(y))*texel).rgb;
    }
    c /= 25.0;
    float l = max(max(c.r,c.g),c.b);
    c *= smoothstep(thresh, thresh+0.35, l);
    gl_FragColor = vec4(c, 1.0);
  }`;

const blurFrag = /* glsl */ `
  precision mediump float; uniform sampler2D tDiffuse; uniform vec2 dir;
  varying vec2 vUv;
  void main(){
    vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227;
    c += (texture2D(tDiffuse, vUv + dir*1.3846).rgb + texture2D(tDiffuse, vUv - dir*1.3846).rgb) * 0.316;
    c += (texture2D(tDiffuse, vUv + dir*3.2307).rgb + texture2D(tDiffuse, vUv - dir*3.2307).rgb) * 0.0702;
    gl_FragColor = vec4(c,1.0);
  }`;

const compFrag = /* glsl */ `
  precision mediump float;
  uniform sampler2D tScene; uniform sampler2D tBloom;
  uniform vec2 res; uniform float time; uniform float scan; uniform float glow;
  uniform float punch; uniform float exposure;
  varying vec2 vUv;
  void main(){
    vec2 uv = vUv;
    vec3 c = texture2D(tScene, uv).rgb;
    vec3 b = texture2D(tBloom, uv).rgb;
    c += b * glow * 0.42;
    // optional, very gentle scanlines — off by default
    float sl = 1.0 - scan * 0.10 * (0.5 + 0.5*sin(uv.y*res.y*6.2831));
    c *= sl;
    c *= exposure * (1.0 + punch*0.05);
    // warm film grade: lift shadows slightly toward brown, keep highlights creamy
    vec3 shadows = vec3(0.09, 0.055, 0.04);
    c = mix(shadows, vec3(1.0), clamp(c, 0.0, 1.0));
    c = mix(c, c * vec3(1.04, 0.98, 0.9), 0.35);
    float vig = smoothstep(1.5, 0.45, length((uv-0.5)*vec2(1.2,1.0))*1.5);
    c *= mix(0.72, 1.0, vig);
    c = clamp(c, 0.0, 1.0);
    c = c*c*(3.0-2.0*c)*0.2 + c*0.8;
    gl_FragColor = vec4(c, 1.0);
  }`;

type Member = {
  def: MemberDef;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  glow: THREE.Mesh;
  shadow: THREE.Mesh;
  prev: number;
  flash: number;
  hop: number;
  baseY: number;
};

export class BandScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  rtScene!: THREE.WebGLRenderTarget;
  rtA!: THREE.WebGLRenderTarget;
  rtB!: THREE.WebGLRenderTarget;
  quadScene = new THREE.Scene();
  quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quad!: THREE.Mesh;
  bloomMat!: THREE.ShaderMaterial;
  blurMat!: THREE.ShaderMaterial;
  compMat!: THREE.ShaderMaterial;
  members: Member[] = [];
  container: HTMLElement;
  clock = new THREE.Clock();
  raf = 0;
  live!: () => Live;
  cfg: SceneCfg = {
    notes: true,
    smoke: true,
    disco: true,
    pixel: 2.6,
    scan: 0,
    glow: 0.6,
    lightMode: 'auto',
    focus: null,
    energy: 1,
  };
  picked: Kind | null = null;
  onPick?: (k: Kind | null) => void;
  onHover?: (k: Kind | null) => void;
  private notePoints!: THREE.Points;
  private noteData: { p: THREE.Vector3; v: THREE.Vector3; life: number; frame: number; size: number; rot: number }[] = [];
  private smoke: THREE.Mesh[] = [];
  private spots: THREE.SpotLight[] = [];
  private cones: THREE.Mesh[] = [];
  private ball!: THREE.Mesh;
  private ballSpots: THREE.Mesh[] = [];
  private signMat!: THREE.MeshBasicMaterial;
  private disposables: { dispose(): void }[] = [];
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private onResize = () => this.resize();
  private observer: ResizeObserver | null = null;
  private onDown = (e: PointerEvent) => this.pick(e);
  private onMove = (e: PointerEvent) => this.hover(e);
  private time = 0;

  constructor(container: HTMLElement, live: () => Live) {
    this.container = container;
    this.live = live;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x110b08, 1);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.cursor = 'crosshair';

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 140);
    this.camera.position.set(0, 3.9, 17);
    this.camera.lookAt(0, 2.9, -0.6);

    this.buildWorld();
    this.buildPost();
    window.addEventListener('resize', this.onResize);
    this.observer = new ResizeObserver(this.onResize);
    this.observer.observe(container);
    container.addEventListener('pointerdown', this.onDown);
    container.addEventListener('pointermove', this.onMove);
    this.resize();
  }

  private tex(cv: HTMLCanvasElement, repeatX = 1, repeatY = 1) {
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    this.disposables.push(t);
    return t;
  }
  private geo<T>(g: T): T {
    this.disposables.push(g as any);
    return g;
  }

  /* ------------------------------------------------------------ */
  private buildWorld() {
    this.scene.fog = new THREE.FogExp2(0x1a110c, 0.012);
    this.scene.add(new THREE.AmbientLight(0x9a7a5c, 1.0));
    this.scene.add(new THREE.HemisphereLight(0xc3a27c, 0x2a1a11, 0.65));

    const stageTex = this.tex(makeStageCanvas(), 4, 1);
    const floorTex = this.tex(makeFloorCanvas(), 5, 3);
    const stageSide = this.geo(new THREE.MeshStandardMaterial({ map: stageTex, color: 0xc4a07a, roughness: 0.87, metalness: 0 }));
    const floorTop = this.geo(new THREE.MeshStandardMaterial({ map: floorTex, color: 0xb08a66, roughness: 0.94, metalness: 0 }));
    const darkMat = this.geo(new THREE.MeshStandardMaterial({ color: 0x1a100b, roughness: 0.9 }));
    const goldMat = this.geo(new THREE.MeshStandardMaterial({ color: 0xd8ad68, roughness: 0.34, metalness: 0.72, emissive: 0x3a230a, emissiveIntensity: 0.5 }));

    // ---------- stage: a wide lower platform and a higher riser
    const mkPlatform = (rt: number, rb: number, h: number, y: number, z: number, zs: number, sideMat: THREE.Material) => {
      const m = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(rt, rb, h, 64, 1, false)), [sideMat, floorTop, darkMat]);
      m.scale.z = zs;
      m.position.set(0, y, z);
      this.scene.add(m);
      const trim = new THREE.Mesh(
        this.geo(new THREE.CylinderGeometry(rt + 0.05, rt + 0.05, 0.11, 64, 1, true)),
        this.geo(new THREE.MeshStandardMaterial({ color: 0xb8945e, roughness: 0.5, metalness: 0.4, emissive: 0x2a1c0a, emissiveIntensity: 0.4, side: THREE.DoubleSide })),
      );
      trim.scale.z = zs;
      trim.position.set(0, y + h / 2, z);
      this.scene.add(trim);
      return m;
    };
    mkPlatform(12.6, 13, 1.1, -0.55, 0.5, 0.39, stageSide);
    const riser = mkPlatform(9.2, 9.5, 1.0, 0.5, -4.3, 0.42, stageSide);
    void riser;
    // little stair cheeks either side of the riser
    for (const sgn of [-1, 1]) {
      const st = new THREE.Mesh(this.geo(new THREE.BoxGeometry(2.2, 0.5, 1.1)), stageSide);
      st.position.set(sgn * 9.5, 0.25, -1.2);
      this.scene.add(st);
    }
    // room floor below the stage lip + deep shadow
    const roomFloor = new THREE.Mesh(
      this.geo(new THREE.PlaneGeometry(60, 24)),
      this.geo(new THREE.MeshStandardMaterial({ color: 0x3a2217, roughness: 0.95 })),
    );
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.set(0, -1.12, 14);
    this.scene.add(roomFloor);
    // footlights along the apron: small warm pools on the stage front
    for (let i = -3; i <= 3; i++) {
      const fl = new THREE.PointLight(0xffc98a, 1.6, 6, 2);
      fl.position.set(i * 3.4, -0.2, 6.6);
      this.scene.add(fl);
    }
    // cocktail-table candles in the front row — tiny warm points suggest an audience
    const candleTex = this.tex(makeGlowCanvas('#ffd9a0', false));
    for (let i = 0; i < 7; i++) {
      const x = -12 + i * 4 + (i % 2) * 0.9;
      const c = new THREE.Mesh(
        this.geo(new THREE.PlaneGeometry(1.1, 1.1)),
        this.geo(new THREE.MeshBasicMaterial({ map: candleTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 })),
      );
      c.position.set(x, -0.45, 10.6 + (i % 2) * 1.3);
      c.userData = { ph: Math.random() * 6.28 };
      this.candles.push(c);
      this.scene.add(c);
    }

    // ---------- back wall, pilasters, arches
    const wallTex = this.tex(makeWallCanvas(), 5, 2.4);
    const wall = new THREE.Mesh(
      this.geo(new THREE.PlaneGeometry(46, 26)),
      this.geo(new THREE.MeshBasicMaterial({ map: wallTex, color: 0xd9c4a8 })),
    );
    wall.position.set(0, 8.2, -12.6);
    this.scene.add(wall);
    for (const x of [-10.6, -3.6, 3.6, 10.6]) {
      const pil = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.36, 17, 0.4)), this.geo(new THREE.MeshStandardMaterial({ color: 0x4e3526, roughness: 0.85 })));
      pil.position.set(x, 7.6, -12.25);
      this.scene.add(pil);
    }
    const molding = new THREE.Mesh(this.geo(new THREE.BoxGeometry(42, 0.16, 0.24)), goldMat);
    molding.position.set(0, 3.4, -12.1);
    this.scene.add(molding);

    const archTex = this.tex(makeArchCanvas());
    for (const sgn of [-1, 1]) {
      const arch = new THREE.Mesh(
        this.geo(new THREE.PlaneGeometry(4.2, 7.4)),
        this.geo(new THREE.MeshBasicMaterial({ map: archTex, transparent: true, depthWrite: false })),
      );
      arch.position.set(sgn * 6.8, 3.9, -12.1);
      this.scene.add(arch);
      const sconce = new THREE.Mesh(
        this.geo(new THREE.PlaneGeometry(3.2, 3.2)),
        this.geo(new THREE.MeshBasicMaterial({ map: this.tex(makeGlowCanvas('#ffcf8a')), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 })),
      );
      sconce.position.set(sgn * 6.8, 4.1, -11.9);
      this.scene.add(sconce);
      const pl = new THREE.PointLight(0xffb870, 8, 20, 2);
      pl.position.set(sgn * 6.7, 4.4, -10.6);
      this.scene.add(pl);
    }

    // ---------- gold marquee sign
    this.signTex = this.tex(makeMarqueeTitle('one more chorus', 'Take On Me', 'a · ha'));
    const signGlow = new THREE.Mesh(
      this.geo(new THREE.PlaneGeometry(17, 8)),
      this.geo(new THREE.MeshBasicMaterial({ map: this.tex(makeGlowCanvas('#f2bd7a')), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.1 })),
    );
    signGlow.position.set(0, 7.0, -12.35);
    signGlow.visible = false;
    this.scene.add(signGlow);
    this.signMat = this.geo(new THREE.MeshBasicMaterial({ map: this.signTex, transparent: true, depthWrite: false }));
    const sign = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(12.6, 3.6)), this.signMat);
    sign.position.set(0, 7.0, -12.1);
    sign.visible = false;
    this.scene.add(sign);
    const signLight = new THREE.PointLight(0xffc98a, 10, 22, 2);
    signLight.position.set(0, 7.2, -9);
    this.scene.add(signLight);

    // ---------- velvet curtains framing the set
    const curtTex = this.tex(makeCurtainCanvas());
    const curtMat = this.geo(new THREE.MeshStandardMaterial({ map: curtTex, roughness: 0.92, color: 0xd8b6ac, side: THREE.DoubleSide }));
    for (const sgn of [-1, 1]) {
      const c = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(7.0, 16, 20, 1)), curtMat);
      c.position.set(sgn * 11.2, 5.4, -4.4);
      c.rotation.y = -sgn * 0.36;
      this.scene.add(c);
      const tie = new THREE.Mesh(this.geo(new THREE.BoxGeometry(1.5, 0.1, 0.13)), goldMat);
      tie.position.set(sgn * 11.5, 3.9, -4.1);
      this.scene.add(tie);
    }
    const valance = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(32, 5.4)), curtMat);
    valance.position.set(0, 10.9, -10.6);
    this.scene.add(valance);
    const valTrim = new THREE.Mesh(
      this.geo(new THREE.BoxGeometry(30, 0.18, 0.2)),
      goldMat,
    );
    valTrim.position.set(0, 9.5, -10.1);
    this.scene.add(valTrim);

    // ---------- warm dust haze
    const smokeTex = this.tex(makeGlowCanvas('#e8c9a6'));
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(
        this.geo(new THREE.PlaneGeometry(7 + Math.random() * 5, 5 + Math.random() * 4)),
        this.geo(new THREE.MeshBasicMaterial({ map: smokeTex, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false })),
      );
      m.position.set(-13 + Math.random() * 26, 2 + Math.random() * 8, -9 + Math.random() * 12);
      m.userData = { sp: 0.05 + Math.random() * 0.1, dx: Math.random() * 6.28, x0: m.position.x };
      this.smoke.push(m);
      this.scene.add(m);
    }

    // ---------- stage lights
    for (const [x, col, inten] of [
      [-7.4, 0xffd6a0, 76],
      [0, 0xffe4bb, 94],
      [7.4, 0xffc492, 72],
    ] as [number, number, number][]) {
      const sl = new THREE.SpotLight(col, inten, 52, 0.55, 0.6, 1.2);
      sl.position.set(x * 0.8, 13.2, 9.4);
      sl.target.position.set(x, 1.4, -1.4);
      this.scene.add(sl, sl.target);
      this.spots.push(sl);
    }
    const rim = new THREE.SpotLight(0x8fb8c8, 32, 40, 0.7, 0.8, 1.4);
    rim.position.set(0, 9, -11);
    rim.target.position.set(0, 2, 0);
    this.scene.add(rim, rim.target);
    this.spots.push(rim as any);

    // ---------- volumetric beams
    const coneMat = this.geo(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { col: { value: new THREE.Color(0xffc078) }, t: { value: 0 }, inten: { value: 0.6 } },
        vertexShader: `varying vec2 vUv; varying vec3 vP;
          void main(){ vUv=uv; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec2 vUv; varying vec3 vP; uniform vec3 col; uniform float t; uniform float inten;
          float hash(vec2 p){ return fract(sin(dot(p,vec2(23.7,91.3)))*3891.7); }
          void main(){
            float fall = pow(clamp(vUv.y,0.0,1.0), 1.5);
            float a = fall*inten;
            float n = hash(floor(gl_FragCoord.xy*0.7)+floor(t*6.0));
            a *= 0.55 + 0.45*n;
            gl_FragColor = vec4(col*a*0.22, a*0.12);
          }`,
      }),
    );
    for (let i = 0; i < 5; i++) {
      const cone = new THREE.Mesh(this.geo(new THREE.ConeGeometry(2.6 + (i % 2) * 0.7, 11, 10, 1, true)), coneMat.clone());
      cone.position.set(-7.4 + i * 3.7, 6.9, 4.2 - (i % 2) * 1.4);
      this.scene.add(cone);
      this.cones.push(cone);
    }

    // ---------- small brass mirror ball (hidden unless switched on)
    const ball = new THREE.Mesh(
      this.geo(new THREE.IcosahedronGeometry(0.7, 1)),
      this.geo(new THREE.MeshStandardMaterial({ color: 0xd9c39b, metalness: 0.95, roughness: 0.25, flatShading: true })),
    );
    ball.position.set(0, 12.4, -1.6);
    ball.visible = false;
    this.scene.add(ball);
    this.ball = ball;
    const ballGlowTex = this.tex(makeGlowCanvas('#ffe6b8'));
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        this.geo(new THREE.PlaneGeometry(1.5, 1.5)),
        this.geo(new THREE.MeshBasicMaterial({ map: ballGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })),
      );
      m.userData = { a: (i / 8) * Math.PI * 2, r: 4 + (i % 4) * 1.7, y: 2 + (i % 5) * 1.9, s: 0.5 + (i % 3) * 0.35 };
      this.scene.add(m);
      this.ballSpots.push(m);
    }
    this.ballGlow = new THREE.Mesh(
      this.geo(new THREE.PlaneGeometry(5, 5)),
      this.geo(new THREE.MeshBasicMaterial({ map: ballGlowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })),
    );
    this.ballGlow.position.set(0, 12.4, -1.7);
    this.scene.add(this.ballGlow);

    // ---------- the band
    const glowTex = this.tex(makeGlowCanvas('#ffe8c2', false));
    const shadowTex = this.tex(makeGlowCanvas('#000000', false));
    BAND.forEach((def) => {
      const atlas = this.tex(atlasCanvas(def.kind));
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: true,
        uniforms: {
          map: { value: atlas },
          frameStep: { value: new THREE.Vector2(1 / ATLAS_FRAMES, 1) },
          frame: { value: 0 },
          lightCol: { value: new THREE.Color(0xffe0b4) },
          lightPos: { value: new THREE.Vector3(0, 10, 7) },
          key2: { value: new THREE.Color(0xffb888) },
          key2Pos: { value: new THREE.Vector3(-8, 9, 5) },
          ambCol: { value: new THREE.Color(0x2c1f18) },
          flash: { value: 0 },
          alpha: { value: 1 },
          flip: { value: 0 },
        },
        vertexShader: spriteVert,
        fragmentShader: spriteFrag,
      });
      const w = CELL * SP;
      const h = CELL * SP;
      const mesh = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, h)), mat);
      mesh.position.set(def.x, def.y + h / 2 - FOOT_PAD, def.z);
      mesh.userData = { kind: def.kind };
      this.scene.add(mesh);
      const glow = new THREE.Mesh(
        this.geo(new THREE.PlaneGeometry(w * 1.55, h * 1.35)),
        this.geo(new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(def.tint), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.18 })),
      );
      glow.position.set(def.x, def.y + h / 2 - FOOT_PAD, def.z - 0.4);
      this.scene.add(glow);
      const shadow = new THREE.Mesh(
        this.geo(new THREE.PlaneGeometry(3.0, 1.7)),
        this.geo(new THREE.MeshBasicMaterial({ map: shadowTex, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(def.x, def.y + 0.03, def.z + 0.35);
      this.scene.add(shadow);
      this.members.push({ def, mesh, mat, glow, shadow, prev: 0, flash: 0, hop: 0, baseY: def.y });
    });

    // ---------- note particles
    const noteTex = this.tex(makeNoteAtlas());
    const N = 64;
    const g = this.geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aFrame', new THREE.BufferAttribute(new Float32Array(N), 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(N), 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N), 1));
    const noteMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { map: { value: noteTex }, pixel: { value: 1 } },
      vertexShader: `
        attribute float aFrame; attribute float aAlpha; attribute float aSize;
        varying float vFrame; varying float vAlpha;
        void main(){
          vFrame = aFrame; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        precision mediump float; uniform sampler2D map; varying float vFrame; varying float vAlpha;
        void main(){
          vec2 u = vec2((gl_PointCoord.x + vFrame)/4.0, 1.0 - gl_PointCoord.y);
          vec4 t = texture2D(map, u);
          if(t.a < 0.05 || vAlpha <= 0.0) discard;
          gl_FragColor = vec4(t.rgb, t.a * vAlpha);
        }`,
    });
    this.notePoints = new THREE.Points(g, noteMat);
    this.notePoints.frustumCulled = false;
    this.scene.add(this.notePoints);
    for (let i = 0; i < N; i++) this.noteData.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, frame: 0, size: 14, rot: 0 });
    this.noteGeo = g;
    this.noteMat = noteMat;
  }

  private audience: THREE.Mesh[] = [];
  private candles: THREE.Mesh[] = [];
  private ballGlow!: THREE.Mesh;
  private noteGeo!: THREE.BufferGeometry;
  private noteMat!: THREE.ShaderMaterial;

  /* ------------------------------------------------------------ */
  private buildPost() {
    const quadGeo = this.geo(new THREE.PlaneGeometry(1, 1));
    this.quad = new THREE.Mesh(quadGeo, new THREE.MeshBasicMaterial());
    this.quadScene.add(this.quad);
    this.bloomMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, texel: { value: new THREE.Vector2(0.004, 0.004) }, thresh: { value: 0.78 } },
      vertexShader: quadVert,
      fragmentShader: bloomFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2(0.004, 0) } },
      vertexShader: quadVert,
      fragmentShader: blurFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        res: { value: new THREE.Vector2(320, 180) },
        time: { value: 0 },
        scan: { value: 0.5 },
        glow: { value: 0.7 },
        punch: { value: 0 },
        exposure: { value: 1 },
      },
      vertexShader: quadVert,
      fragmentShader: compFrag,
      depthTest: false,
      depthWrite: false,
    });
  }

  private makeTargets(w: number, h: number, scale: number) {
    const pw = Math.max(160, Math.round(w / scale));
    const ph = Math.max(90, Math.round(h / scale));
    const opts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, format: THREE.RGBAFormat, type: THREE.UnsignedByteType };
    if (this.rtScene) this.rtScene.dispose();
    if (this.rtA) this.rtA.dispose();
    if (this.rtB) this.rtB.dispose();
    this.rtScene = new THREE.WebGLRenderTarget(pw, ph, opts);
    const bloomOpts = { ...opts, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rtA = new THREE.WebGLRenderTarget(Math.round(pw / 2), Math.round(ph / 2), bloomOpts);
    this.rtB = new THREE.WebGLRenderTarget(Math.round(pw / 2), Math.round(ph / 2), bloomOpts);
    this.rtW = pw;
    this.rtH = ph;
  }
  private rtW = 320;
  private rtH = 180;
  private baseDist = 20;
  private v3 = new THREE.Vector3();
  private signTex?: THREE.CanvasTexture;

  /** screen-space anchor for each player's name plate in the HTML overlay */
  labels() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return this.members.map((m) => {
      this.v3.set(m.def.x, m.baseY + (m.baseY > 0 ? -0.55 : -0.05), m.def.z + 0.25).project(this.camera);
      return { kind: m.def.kind, x: (this.v3.x * 0.5 + 0.5) * w, y: (-this.v3.y * 0.5 + 0.5) * h };
    });
  }

  setSignTitle(title: string, sub: string) {
    if (!this.signTex) return;
    this.signTex.image = makeMarqueeTitle('one more chorus', title, sub);
    this.signTex.needsUpdate = true;
  }

  resize() {
    const w = Math.max(320, this.container.clientWidth);
    const h = Math.max(200, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const compact = w < 640;
    this.members.forEach((member) => {
      member.mesh.visible = !compact;
      member.glow.visible = !compact;
      member.shadow.visible = !compact;
    });
    const fov = (this.camera.fov * Math.PI) / 180;
    this.baseDist = Math.max(10.2 / (Math.tan(fov / 2) * this.camera.aspect), 5.95 / Math.tan(fov / 2));
    this.makeTargets(w, h, this.cfg.pixel);
    this.compMat.uniforms.res.value.set(this.rtW, this.rtH);
    this.noteMat.uniforms.pixel.value = Math.max(0.8, Math.min(2.2, this.cfg.pixel / 3.2));
  }

  setPixelScale(s: number) {
    this.cfg.pixel = s;
    this.resize();
  }

  /* ------------------------------------------------------------ */
  private pointer(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    return this.ndc;
  }
  private hitTest(e: PointerEvent): Kind | null {
    this.ray.setFromCamera(this.pointer(e), this.camera);
    const hits = this.ray.intersectObjects(this.members.map((m) => m.mesh), false);
    if (hits.length) return (hits[0].object.userData.kind as Kind) ?? null;
    return null;
  }
  private pick(e: PointerEvent) {
    this.picked = this.hitTest(e);
    this.onPick?.(this.picked);
  }
  private hover(e: PointerEvent) {
    const k = this.hitTest(e);
    if (k !== this.picked) {
      this.picked = k;
      this.onHover?.(k);
      this.renderer.domElement.style.cursor = k ? 'pointer' : 'crosshair';
    }
  }

  /** spawn a burst of note particles from a member */
  spawnNotes(kind: Kind | null, count = 5, power = 1) {
    const src = this.members.find((m) => m.def.kind === kind) ?? this.members[Math.floor(Math.random() * this.members.length)];
    if (!src) return;
    let spawned = 0;
    for (const n of this.noteData) {
      if (spawned >= count) break;
      if (n.life > 0) continue;
      spawned++;
      n.life = 1;
      n.p.set(src.mesh.position.x + (Math.random() - 0.5) * 1.2, src.mesh.position.y + 0.6 + Math.random() * 1.2, src.mesh.position.z + 0.4);
      n.v.set((Math.random() - 0.5) * 1.1, (1.5 + Math.random() * 1.9) * power, (Math.random() - 0.3) * 0.6);
      n.frame = Math.floor(Math.random() * 4);
      n.size = 14 + Math.random() * 11;
      n.rot = Math.random() * 6.28;
    }
  }

  private lightColors(l: Live): [THREE.Color, THREE.Color, THREE.Color] {
    const m = this.cfg.lightMode;
    const beat = Math.pow(1 - (l.beatPhase % 1), 2);
    const energy = Math.min(1, l.level * 2.2);
    if (m === 'ice') return [new THREE.Color(0x8fd8ef), new THREE.Color(0x7f9fe8), new THREE.Color(0xcfeeff)];
    if (m === 'rave') {
      const h = (l.beat * 0.25 + l.time * 0.25) % 1;
      return [new THREE.Color().setHSL(h, 0.8, 0.6), new THREE.Color().setHSL((h + 0.4) % 1, 0.75, 0.58), new THREE.Color().setHSL((h + 0.7) % 1, 0.6, 0.7)];
    }
    if (m === 'warm') return [new THREE.Color(0xffd9a0), new THREE.Color(0xffab74), new THREE.Color(0xffeccb)];
    // auto: candle-lit amber that breathes with the groove
    const a = new THREE.Color(0xffe6c0).lerp(new THREE.Color(0xffd3a0), beat * (0.2 + energy * 0.3));
    const b = new THREE.Color(0xffc9a0).lerp(new THREE.Color(0xffb48a), energy * 0.35);
    const c = new THREE.Color(0xfff3dd).lerp(new THREE.Color(0xffe4bd), beat * 0.3);
    return [a, b, c];
  }

  /* ------------------------------------------------------------ */
  private disposed = false;
  start() {
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      try {
        this.frame();
      } catch (err) {
        console.error(err);
        this.disposed = true;
      }
    };
    loop();
  }

  private frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.time += dt;
    const l = this.live();
    const t = this.time;
    const energy = Math.min(1.6, this.cfg.energy * (0.45 + l.level * 2.1));
    const beat = l.external ? l.onsetCount + (1 - l.onset) * 0.4 : l.pos;
    const phase = l.beatPhase;
    const pulse = l.playing ? (l.external ? l.onset : Math.pow(1 - Math.min(1, phase), 2.4)) : 0.15 + 0.1 * Math.sin(t * 1.6);
    const onBeat = l.playing ? (l.external ? l.onset : Math.max(l.onset, Math.pow(1 - Math.min(1, phase), 6))) : 0;

    const [cA, cB, cC] = this.lightColors(l);
    const lights = [
      { x: -9, c: cB, s: this.spots[0] },
      { x: 0, c: cC, s: this.spots[1] },
      { x: 9, c: cA, s: this.spots[2] },
    ];
    lights.forEach((L, i) => {
      const spot = L.s as THREE.SpotLight;
      if (!spot) return;
      const focus = this.cfg.focus;
      const member = focus ? this.members.find((m) => m.def.kind === focus) : null;
      const swing = Math.sin(t * (0.35 + i * 0.11) + i * 2.1) * (this.cfg.lightMode === 'rave' ? 5.5 : 0.9);
      const tx = member ? member.mesh.position.x : L.x + swing;
      spot.position.set(tx * 0.55 + (i - 1) * 2.2, 11.6, 8.4);
      spot.target.position.set(tx, 1.1 + (member ? 0.6 : 0), -1.2);
      spot.target.updateMatrixWorld();
      spot.color.copy(L.c);
      const boost = member ? 0.9 : 0.7 + 0.2 * pulse;
      spot.intensity = (i === 1 ? 42 : 34) * boost * (0.75 + 0.3 * energy) * (member && member.def.kind === (i === 0 ? 'deer' : i === 2 ? 'tiger' : 'owl') ? 1.25 : 1);
      spot.angle = member ? 0.26 : 0.5 + 0.06 * Math.sin(t * 0.8);
      if (this.cones[i * 2]) {
        const cm = this.cones[i * 2].material as THREE.ShaderMaterial;
        cm.uniforms.col.value.copy(L.c);
        cm.uniforms.inten.value = 0.35 + pulse * 0.7;
        this.cones[i * 2].rotation.z = Math.sin(t * 0.4 + i) * 0.16 + (tx - L.x) * 0.02;
      }
    });
    this.cones.forEach((c, i) => {
      if (i % 2 === 0) return;
      const cm = c.material as THREE.ShaderMaterial;
      cm.uniforms.t.value = t;
      cm.uniforms.col.value.copy(i === 1 ? cA : i === 3 ? cB : cC);
      cm.uniforms.inten.value = 0.25 + onBeat * 0.55;
    });

    // members --------------------------------------------------
    this.members.forEach((m) => {
      const act = l.active[m.def.inst] ?? 0;
      const gate = l.playing ? 1 : 0.25;
      const div = m.def.div;
      const localBeat = beat * div;
      const pi = Math.abs(Math.floor(localBeat)) % 4;
      const ph = localBeat - Math.floor(localBeat);
      const isVocal = m.def.inst === 'voice';
      // the owl's jaw runs a syllable cycle while a note sustains, scaled by the
      // vocal band of the analyser -> real lip-sync rather than a fixed flap
      const syll = 0.5 + 0.5 * Math.sin(beat * Math.PI * 4 + 0.9);
      const drive = isVocal ? Math.min(1, l.vocal * 4.4) * (0.5 + 0.5 * syll) * (act > 0.4 ? 1 : 0) : act;
      let mouth = Math.min(MOUTHS - 1, Math.max(0, Math.round(drive * (MOUTHS - 1) * 1.25)));
      if (!isVocal && act > 0.35) mouth = Math.max(mouth, pi === 0 ? 2 : 1);
      if (!l.playing) mouth = 0;
      const frame = pi * MOUTHS + mouth;
      m.mat.uniforms.frame.value = frame;

      if (act > 0.5 && m.prev <= 0.5) m.flash = 1;
      m.prev = act;
      m.flash *= 0.88;

      const bounce = Math.sin(Math.min(1, ph) * Math.PI) * (0.04 + 0.08 * act) * gate * (0.7 + pulse * 0.5) * (l.external ? Math.max(0.1, onBeat) : 1);
      m.hop += (bounce - m.hop) * 0.45;
      m.mesh.position.y = m.baseY + CELL * SP * 0.5 - FOOT_PAD + m.hop;
      m.mesh.rotation.z = Math.sin(localBeat * Math.PI) * 0.02 * gate * (0.4 + act);
      const focusOn = !this.cfg.focus || this.cfg.focus === m.def.kind;
      const sc =
        1 + (focusOn ? 0.02 * pulse : -0.03) + (this.picked === m.def.kind ? 0.045 : 0) + (isVocal ? drive * 0.02 : 0);
      m.mesh.scale.setScalar(sc);
      const gm = m.glow.material as THREE.MeshBasicMaterial;
      gm.opacity = (0.025 + act * 0.07 + m.flash * 0.07) * (focusOn ? 1 : 0.22);
      m.glow.position.y = m.mesh.position.y;
      m.glow.scale.setScalar(1 + act * 0.06);
      (m.mat.uniforms.ambCol.value as THREE.Color).setRGB(focusOn ? 0.36 : 0.23, focusOn ? 0.29 : 0.18, focusOn ? 0.24 : 0.15);
      (m.mat.uniforms.lightCol.value as THREE.Color).copy(focusOn ? cA : cA.clone().multiplyScalar(0.55));
      (m.mat.uniforms.key2.value as THREE.Color).copy(focusOn ? cB : cB.clone().multiplyScalar(0.45));
      m.mat.uniforms.flash.value = m.flash * 0.12 + onBeat * 0.015;
      const sm = m.shadow.material as THREE.MeshBasicMaterial;
      sm.opacity = 0.42 - m.hop * 0.5;
      m.shadow.scale.setScalar(1 + m.hop * 0.35);
    });

    // audience --------------------------------------------------
    this.audience.forEach((a) => {
      const u = a.userData as { ph: number; row: number; frame: number; y0: number; sc: number };
      const bob = Math.sin(t * 2.0 + u.ph) * 0.07 + pulse * 0.11 * (u.row === 0 ? 1 : 0.6);
      a.position.y = u.y0 + bob;
      a.rotation.z = Math.sin(t * 1.2 + u.ph) * 0.035;
      a.scale.setScalar(u.sc * (1 + onBeat * 0.025));
    });

    // disco ball + spots ---------------------------------------
    if (this.cfg.disco) {
      this.ball.visible = true;
      this.ball.rotation.y += dt * (0.5 + l.level * 2.6);
      this.ball.rotation.x = Math.sin(t * 0.4) * 0.15;
      this.ballSpots.forEach((s, i) => {
        const u = s.userData as { a: number; r: number; y: number; s: number };
        const ang = u.a + this.ball.rotation.y * 1.1;
        s.position.set(Math.sin(ang) * u.r * 1.9, u.y + Math.cos(ang * 0.7 + t * 0.3) * 0.9, -9 + Math.abs(Math.cos(ang)) * u.r);
        const mm = s.material as THREE.MeshBasicMaterial;
        mm.opacity = (0.16 + 0.2 * Math.max(0, Math.sin(ang * 2))) * (1 + onBeat * 0.6);
        s.scale.setScalar(u.s * (1 + 0.1 * Math.sin(t * 2 + i)));
      });
      (this.ballGlow.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.2 * Math.sin(t * 1.7) + onBeat * 0.2;
    } else {
      this.ball.visible = false;
      this.ballSpots.forEach((s) => ((s.material as THREE.MeshBasicMaterial).opacity = 0));
      (this.ballGlow.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    (this.signMat as THREE.MeshBasicMaterial).opacity = 0.65 + 0.35 * (Math.sin(t * 2.3) > -0.75 ? 1 : 0.15);

    // candles ---------------------------------------------------
    this.candles.forEach((c, i) => {
      const u = c.userData as { ph: number };
      const f = 0.3 + 0.08 * Math.sin(t * 7 + u.ph) + 0.05 * Math.sin(t * 13.3 + i);
      (c.material as THREE.MeshBasicMaterial).opacity = f;
      c.scale.setScalar(0.9 + 0.08 * Math.sin(t * 5 + u.ph));
    });

    // smoke -----------------------------------------------------
    this.smoke.forEach((s) => {
      const u = s.userData as { sp: number; dx: number; x0: number };
      s.position.y += dt * u.sp * (0.6 + l.level * 2);
      s.position.x = u.x0 + Math.sin(t * 0.24 + u.dx) * 1.8;
      if (s.position.y > 12) s.position.y = 0.6;
      const mm = s.material as THREE.MeshBasicMaterial;
      mm.opacity = this.cfg.smoke ? (0.02 + l.level * 0.06) * (1 - (s.position.y - 0.6) / 13) : 0;
    });

    // note particles --------------------------------------------
    if (this.cfg.notes && l.playing) {
      const every = 0.5 / Math.max(0.2, l.bpm / 120);
      if (t - this.lastSpawn > every) {
        this.lastSpawn = t;
        const solo = this.members.reduce((best, m) => ((l.active[m.def.inst] ?? 0) > (l.active[best.def.inst] ?? 0) ? m : best), this.members[0]);
        this.spawnNotes(solo ? solo.def.kind : null, Math.random() > 0.6 ? 3 : 1, 0.8 + l.level * 1.6);
      }
      if (onBeat > 0.85 && Math.random() > 0.72) this.spawnNotes(this.cfg.focus ?? null, 4, 1.3);
    }
    const pa = this.noteGeo.getAttribute('position') as THREE.BufferAttribute;
    const fa = this.noteGeo.getAttribute('aFrame') as THREE.BufferAttribute;
    const aa = this.noteGeo.getAttribute('aAlpha') as THREE.BufferAttribute;
    const sa = this.noteGeo.getAttribute('aSize') as THREE.BufferAttribute;
    this.noteData.forEach((n, i) => {
      if (n.life > 0) {
        n.life -= dt * 0.38;
        n.p.addScaledVector(n.v, dt);
        n.v.y -= dt * 0.5;
        n.v.x += Math.sin(t * 2 + n.rot) * dt * 0.4;
        if (n.p.y > 12.5) n.life = 0;
      }
      pa.setXYZ(i, n.p.x, n.p.y, n.p.z);
      fa.setX(i, n.frame);
      aa.setX(i, n.life > 0 ? Math.min(1, n.life * 1.6) : 0);
      sa.setX(i, n.size * (0.7 + 0.3 * Math.sin(t * 6 + n.rot)));
    });
    pa.needsUpdate = true;
    fa.needsUpdate = true;
    aa.needsUpdate = true;
    sa.needsUpdate = true;

    // camera ----------------------------------------------------
    const camDrift = Math.sin(t * 0.19) * 0.18;
    this.camera.position.x += (camDrift - this.camera.position.x) * 0.02;
    this.camera.position.y = 3.9 + Math.sin(t * 0.24) * 0.05 + onBeat * 0.015;
    const zf = this.baseDist - (this.cfg.focus ? 1.8 : 0) - l.level * 0.25;
    this.camera.position.z += (zf - this.camera.position.z) * 0.035;
    this.camera.position.x += ((this.cfg.focus ? (this.members.find((m) => m.def.kind === this.cfg.focus)?.mesh.position.x ?? 0) * 0.4 : 0) - this.camera.position.x) * 0.03;
    this.camera.lookAt(this.cfg.focus ? (this.members.find((m) => m.def.kind === this.cfg.focus)?.mesh.position.x ?? 0) * 0.55 : 0, 2.9, -0.6);

    // render ----------------------------------------------------
    this.compMat.uniforms.punch.value = onBeat * 0.5 + l.onset * 0.4;
    this.compMat.uniforms.time.value = t;
    this.compMat.uniforms.scan.value = this.cfg.scan;
    this.compMat.uniforms.glow.value = this.cfg.glow;
    this.compMat.uniforms.exposure.value = 1.0 + l.level * 0.08;

    this.renderer.setRenderTarget(this.rtScene);
    this.renderer.render(this.scene, this.camera);
    this.bloomMat.uniforms.tDiffuse.value = this.rtScene.texture;
    this.bloomMat.uniforms.texel.value.set(1.6 / this.rtW, 1.6 / this.rtH);
    this.runPass(this.bloomMat, this.rtA);
    this.blurMat.uniforms.tDiffuse.value = this.rtA.texture;
    this.blurMat.uniforms.dir.value.set(1 / this.rtW, 0);
    this.runPass(this.blurMat, this.rtB);
    this.blurMat.uniforms.tDiffuse.value = this.rtB.texture;
    this.blurMat.uniforms.dir.value.set(0, 1 / this.rtH);
    this.runPass(this.blurMat, this.rtA);
    this.compMat.uniforms.tScene.value = this.rtScene.texture;
    this.compMat.uniforms.tBloom.value = this.rtA.texture;
    this.runPass(this.compMat, null);
  }
  private lastSpawn = 0;

  private runPass(mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.observer?.disconnect();
    this.container.removeEventListener('pointerdown', this.onDown);
    this.container.removeEventListener('pointermove', this.onMove);
    this.disposables.forEach((d) => {
      try {
        d.dispose();
      } catch {
        /* noop */
      }
    });
    this.members.forEach((m) => m.mat.dispose());
    [this.bloomMat, this.blurMat, this.compMat, this.noteMat].forEach((m) => m?.dispose());
    this.rtScene?.dispose();
    this.rtA?.dispose();
    this.rtB?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) this.container.removeChild(this.renderer.domElement);
  }
}
