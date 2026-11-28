import * as THREE from 'three';
import { RELEASES, N, mod } from './data';
import * as art from './art';

/* Ring geometry: 112 slots on the platter = the 16-disc catalogue seven times round. */
const SLOTS = 112;
const STEP = (Math.PI * 2) / SLOTS;
const R = 5.25; // radius of the spine line
const T = 0.2; // sleeve thickness
const H = 1.28; // sleeve height
const D = 1.25; // sleeve depth (cover width)
const WIN = 26; // sleeves instantiated either side of centre — beyond this the ring is lost in the haze
const POOL = WIN * 2 + 1;
const GAP = 0.66 / R; // angular room the neighbours make for the presented sleeve

const DISC_R = 0.56;
const HOLE_R = 0.075;
const DISC_T = 0.014;

const FWD = 1.3; // how far the sleeve comes off the shelf when opened
const SHIFT = 0.71; // sleeve steps left while the disc rolls right
const ROLL = 1.42; // distance the disc rolls
const DUR_IN = 3.0;
const DUR_OUT = 1.9;
const TAN = Math.tan((15 * Math.PI) / 180);

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export interface ArchiveEvents {
  onIndex(i: number): void;
  onPos(pos: number): void;
  onOpenProgress(p: number): void;
  onOpening(): void;
  onOpened(i: number): void;
  onClosed(): void;
}

interface Drag {
  x: number;
  pos: number;
  moved: boolean;
  lx: number;
  lt: number;
}

export class Archive {
  readonly el: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.02, 40);
  private pool: THREE.Mesh[] = [];
  private mats: THREE.Material[][] = [];
  private discTex = new Map<number, THREE.CanvasTexture>();
  private platter = new THREE.Group();
  private disc = new THREE.Group();
  private discMesh: THREE.Mesh;
  private labelMat: THREE.MeshStandardMaterial;
  private portalMat: THREE.MeshBasicMaterial;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2(9, 9);
  private pointerIn = false;
  private hovered: number | null = null;
  private aniso: number;

  private pos: number;
  private target: number;
  private vel = 0;
  private calm = 0;
  private dragging = false;
  private drag: Drag | null = null;
  private slotsPerPx = 0.01;

  private openP = 0;
  private openDir = 0;
  private wantOpen = false;

  private lastIdx = -1;
  private lastPos = NaN;
  private raf = 0;
  private last = 0;
  private w = 1;
  private h = 1;
  private insetTop = 90;
  private insetBottom = 260;
  private wheelAcc = 0;
  private wheelAt = 0;
  private ro: ResizeObserver;
  private reduced: boolean;

  constructor(
    private host: HTMLElement,
    private ev: ArchiveEvents,
    start = 10,
  ) {
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.target = start;
    this.pos = this.reduced ? start : start - 5.4; // the platter spins into place on load

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.el = renderer.domElement;
    this.el.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none';
    this.el.setAttribute('aria-label', 'Shelf of disc cases on a turning platter');
    host.appendChild(this.el);

    this.scene.fog = new THREE.Fog(0xebebe8, 7.3, 10.2);

    // light: soft ambient so the print stays true, one key from front-left for form + shadow
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.68 * Math.PI));
    const key = new THREE.DirectionalLight(0xffffff, 0.48 * Math.PI);
    key.position.set(-2.6, 8, R + 7.2);
    key.target.position.set(0, 0.3, R - 0.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -8;
    sc.right = 8;
    sc.top = 5;
    sc.bottom = -5;
    sc.near = 1;
    sc.far = 26;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 3;
    this.scene.add(key, key.target);

    this.buildPlatter();
    this.buildSleeves();

    // disc + portal
    const shape = new THREE.Shape();
    shape.absarc(0, 0, DISC_R, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, HOLE_R, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const dg = new THREE.ExtrudeGeometry(shape, { depth: DISC_T, bevelEnabled: false, curveSegments: 72 });
    dg.translate(0, 0, -DISC_T / 2);
    const uv = dg.attributes.uv;
    const ps = dg.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / (2 * DISC_R) + 0.5, ps.getY(i) / (2 * DISC_R) + 0.5);
    this.labelMat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xcfcfd2, roughness: 0.3 });
    this.discMesh = new THREE.Mesh(dg, [this.labelMat, edgeMat]);
    this.discMesh.castShadow = true;
    this.portalMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false });
    const portal = new THREE.Mesh(new THREE.CircleGeometry(HOLE_R * 1.02, 48), this.portalMat);
    this.disc.add(this.discMesh, portal);
    this.disc.visible = false;
    this.scene.add(this.disc);

    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onUp);
    this.el.addEventListener('pointerleave', this.onLeave);
    this.el.addEventListener('wheel', this.onWheel, { passive: false });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.last = performance.now();
    this.frame(0.016);
    this.raf = requestAnimationFrame(this.tick);
  }

  /* ---------------------------------------------------------------- */

  private tex(cv: HTMLCanvasElement) {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.aniso;
    return t;
  }

  private buildPlatter() {
    const Rp = R + 0.42;
    const rimH = 0.17;
    const top = new THREE.Mesh(
      new THREE.CircleGeometry(Rp, 192),
      new THREE.MeshStandardMaterial({ color: 0xdcdcd9, roughness: 0.95 }),
    );
    top.rotation.x = -Math.PI / 2;
    top.receiveShadow = true;
    const rimTex = this.tex(art.drawRim());
    rimTex.wrapS = THREE.RepeatWrapping;
    rimTex.repeat.set(SLOTS, 1);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(Rp, Rp, rimH, 256, 1, true),
      new THREE.MeshStandardMaterial({ map: rimTex, roughness: 0.55 }),
    );
    rim.position.y = -rimH / 2;
    const under = new THREE.Mesh(
      new THREE.CylinderGeometry(Rp - 0.03, Rp - 0.55, 0.9, 128, 1, true),
      new THREE.MeshBasicMaterial({ map: this.tex(art.drawUnder()), transparent: true, depthWrite: false }),
    );
    under.position.y = -rimH - 0.45;
    this.platter.add(top, rim, under);
    this.scene.add(this.platter);
  }

  private buildSleeves() {
    const geo = new THREE.BoxGeometry(T, H, D);
    for (const r of RELEASES) {
      const board = new THREE.MeshStandardMaterial({ color: r.pal.bg, roughness: 0.8 });
      const face = (cv: HTMLCanvasElement) => new THREE.MeshStandardMaterial({ map: this.tex(cv), roughness: 0.66 });
      // BoxGeometry order: +x front cover, -x back, +y, -y, +z spine, -z opening
      this.mats.push([
        face(art.coverCanvas(r.idx)),
        face(art.drawBack(r)),
        board,
        board,
        face(art.drawSpine(r)),
        face(art.drawEdge(r)),
      ]);
    }
    for (let j = 0; j < POOL; j++) {
      const m = new THREE.Mesh(geo, this.mats[0]);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.slot = NaN;
      m.userData.h = 0;
      this.pool.push(m);
      this.scene.add(m);
    }
  }

  private prepareDisc() {
    const i = mod(Math.round(this.target), N);
    let t = this.discTex.get(i);
    if (!t) this.discTex.set(i, (t = this.tex(art.discCanvas(i))));
    this.labelMat.map = t;
    this.labelMat.needsUpdate = true;
    this.portalMat.color.set(RELEASES[i].page.bg);
  }

  /* ---------------------------------------------------------------- */
  /* Public API                                                         */
  /* ---------------------------------------------------------------- */

  get busy() {
    return this.openP > 0 || this.openDir !== 0 || this.wantOpen;
  }

  step(dir: number) {
    if (this.busy) return;
    this.target = Math.round(this.target) + dir;
  }

  /** Go to a catalogue index. `direct` keeps to the current lap so the timeline reads linearly. */
  goToIndex(i: number, direct = false) {
    if (this.busy) return;
    const here = Math.round(this.pos);
    this.target = direct ? Math.floor(here / N) * N + i : Math.round((here - i) / N) * N + i;
  }

  open() {
    if (this.busy) return;
    this.target = Math.round(this.dragging ? this.pos : this.target);
    this.dragging = false;
    this.drag = null;
    this.wantOpen = true;
    this.ev.onOpening();
  }

  close() {
    if (this.openP <= 0) return;
    if (this.reduced) {
      this.openP = 0;
      this.openDir = 0;
      this.ev.onOpenProgress(0);
      this.ev.onClosed();
    } else this.openDir = -1;
  }

  /** While the release page is up: move to the neighbouring disc so closing surfaces from the right hole. */
  swapOpen(dir: number) {
    if (this.openP !== 1) return;
    this.target = Math.round(this.target) + dir;
    this.pos = this.target;
    this.vel = 0;
    this.prepareDisc();
    this.frame(0.016);
  }

  setInsets(top: number, bottom: number) {
    this.insetTop = top;
    this.insetBottom = bottom;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
    this.el.removeEventListener('pointerleave', this.onLeave);
    this.el.removeEventListener('wheel', this.onWheel);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    });
    for (const set of this.mats)
      for (const mat of set) {
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    this.discTex.forEach((t) => t.dispose());
    this.renderer.dispose();
    this.el.remove();
  }

  /* ---------------------------------------------------------------- */
  /* Input                                                              */
  /* ---------------------------------------------------------------- */

  private setNdc(e: PointerEvent) {
    const r = this.el.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.pointerIn = true;
  }

  private onDown = (e: PointerEvent) => {
    this.setNdc(e);
    if (this.busy || e.button !== 0) return;
    this.drag = { x: e.clientX, pos: this.pos, moved: false, lx: e.clientX, lt: performance.now() };
    this.el.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    this.setNdc(e);
    const g = this.drag;
    if (!g || this.busy) return;
    const dx = e.clientX - g.x;
    if (!g.moved && Math.abs(dx) > 5) {
      g.moved = true;
      this.dragging = true;
      this.el.style.cursor = 'grabbing';
    }
    if (g.moved) {
      const now = performance.now();
      const inst = (-(e.clientX - g.lx) * this.slotsPerPx * 1000) / Math.max(1, now - g.lt);
      this.vel = mix(this.vel, inst, 0.4);
      g.lx = e.clientX;
      g.lt = now;
      this.pos = g.pos - dx * this.slotsPerPx;
      this.target = this.pos;
    }
  };

  private onUp = (e: PointerEvent) => {
    const g = this.drag;
    this.drag = null;
    if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId);
    if (e.pointerType === 'touch') this.pointerIn = false;
    if (!g) return;
    if (g.moved) {
      this.dragging = false;
      const v = Math.max(-16, Math.min(16, this.vel));
      this.target = Math.round(this.pos + v * 0.2);
    } else if (!this.busy && e.type === 'pointerup') this.click();
  };

  private onLeave = () => {
    this.pointerIn = false;
    this.hovered = null;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.busy) return;
    const now = performance.now();
    if (now - this.wheelAt > 400) this.wheelAcc = 0;
    this.wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(this.wheelAcc) > 48 && now - this.wheelAt > 150) {
      this.step(Math.sign(this.wheelAcc));
      this.wheelAcc = 0;
      this.wheelAt = now;
    }
  };

  private pick(): number | null {
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.intersectObjects(this.pool, false)[0];
    return hit ? (hit.object.userData.slot as number) : null;
  }

  private click() {
    const k = this.pick();
    if (k === null) return;
    if (k === Math.round(this.pos) && Math.abs(this.pos - k) < 0.25) this.open();
    else this.target = k;
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                              */
  /* ---------------------------------------------------------------- */

  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.openP === 1) this.frame(0.016);
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    if (this.openP === 1 && this.openDir === 0) return; // release page is covering the stage
    this.frame(dt);
  };

  private frame(dt: number) {
    // platter physics: critically damped spring to the target slot
    if (this.dragging) this.vel *= Math.exp(-dt * 10);
    else {
      this.vel += ((this.target - this.pos) * 60 - this.vel * 15.5) * dt;
      this.pos += this.vel * dt;
      if (Math.abs(this.target - this.pos) < 0.0004 && Math.abs(this.vel) < 0.004) {
        this.pos = this.target;
        this.vel = 0;
      }
    }
    const fast = Math.abs(this.vel) > 3.4;
    this.calm += ((fast ? 0 : 1) - this.calm) * (1 - Math.exp(-dt * (fast ? 14 : 7)));
    if (this.openP > 0) this.calm = 1;

    if (this.wantOpen && Math.abs(this.pos - this.target) < 0.01 && this.calm > 0.985) {
      this.wantOpen = false;
      this.prepareDisc();
      if (this.reduced) {
        this.openP = 1;
        this.ev.onOpenProgress(1);
        this.layout(dt);
        this.renderer.render(this.scene, this.camera);
        this.ev.onOpened(mod(Math.round(this.target), N));
        return;
      }
      this.openDir = 1;
    }

    let done: 'opened' | 'closed' | null = null;
    if (this.openDir) {
      this.openP = clamp01(this.openP + (this.openDir * dt) / (this.openDir > 0 ? DUR_IN : DUR_OUT));
      if (this.openP === 1 && this.openDir > 0) done = 'opened';
      else if (this.openP === 0 && this.openDir < 0) done = 'closed';
      if (done) this.openDir = 0;
      this.ev.onOpenProgress(this.openP);
    }

    if (this.pointerIn && !this.dragging && this.openP === 0 && !this.wantOpen) {
      this.hovered = this.pick();
      this.el.style.cursor = this.hovered === null ? 'grab' : 'pointer';
    } else if (!this.dragging) {
      this.hovered = null;
      if (this.openP > 0) this.el.style.cursor = 'default';
    }

    this.layout(dt);
    this.renderer.render(this.scene, this.camera);

    const idx = mod(Math.round(this.pos), N);
    if (idx !== this.lastIdx) this.ev.onIndex((this.lastIdx = idx));
    if (this.pos !== this.lastPos) this.ev.onPos((this.lastPos = this.pos));
    if (done === 'opened') this.ev.onOpened(idx);
    if (done === 'closed') this.ev.onClosed();
  }

  private layout(dt: number) {
    const pos = this.pos;
    const near = Math.round(pos);
    const p = this.openP;
    // F: how far the centred sleeve is presented (pulled, turned to face) — drops while the platter is spinning
    const F = (1 - sstep(0.06, 0.46, Math.abs(near - pos))) * this.calm;
    const eA = ease(clamp01(p / 0.3));
    const eR = ease(clamp01((p - 0.16) / 0.44));
    const base = near - WIN;
    const hk = 1 - Math.exp(-dt * 12);
    let open: THREE.Mesh | null = null;

    for (let j = 0; j < POOL; j++) {
      const k = base + mod(j - base, POOL);
      const m = this.pool[j];
      if (m.userData.slot !== k) {
        m.userData.slot = k;
        m.userData.h = 0;
        m.material = this.mats[mod(k, N)];
      }
      const d = k - pos;
      const ad = Math.abs(d);
      const sg = d < 0 ? -1 : 1;
      const isNear = k === near;
      const f = isNear ? F : 0;
      m.castShadow = ad < 16; // far sleeves are in the haze; skip their shadow pass
      m.userData.h += ((this.hovered === k && p === 0 ? 1 : 0) - m.userData.h) * hk;
      const hv = m.userData.h as number;

      const a = d * STEP + (isNear ? 0 : sg * GAP * Math.tanh(1.5 * ad) * F);
      const bulge = Math.sin(Math.PI * f);
      const rc =
        R - D / 2 + (D / 2 - T / 2 + 0.06) * sstep(0, 1, f) + 0.42 * bulge + (isNear ? 0.04 * hv * f : 0.14 * hv);
      const yaw = isNear ? -(Math.PI / 2) * sstep(0.18, 1, f) : sg * 0.2 * F * Math.exp(-(ad - 1) / 3);
      m.position.set(Math.sin(a) * rc, H / 2 + 0.08 * bulge + (isNear ? 0 : 0.025 * hv), Math.cos(a) * rc);
      m.rotation.y = a + yaw;
      if (isNear) open = m;
    }

    if (p > 0 && open) {
      open.position.z += FWD * eA;
      open.position.x -= SHIFT * eR;
      open.position.y += 0.04 * eA;
      const th = open.rotation.y;
      const s = ROLL * eR;
      const b = clamp01((p - 0.56) / 0.44);
      this.disc.visible = true;
      // the disc leaves through the sleeve's open edge (local -z) and rolls: rotation = distance / radius
      this.disc.position.set(open.position.x - Math.sin(th) * s, open.position.y, open.position.z - Math.cos(th) * s);
      this.disc.rotation.y = th + Math.PI / 2;
      this.discMesh.rotation.z = -s / DISC_R - b * b * 7;
    } else this.disc.visible = false;

    this.platter.rotation.y = -pos * STEP;
    this.updateCamera(p);
  }

  private updateCamera(p: number) {
    const { w, h, camera: cam } = this;
    const aspect = w / h;
    const regionH = Math.max(160, h - this.insetTop - this.insetBottom);
    const dist0 = Math.max(4.4, 3.3 / aspect, (1.84 * h) / (regionH * 2 * TAN));
    const oy0 = h / 2 - (this.insetTop + regionH / 2);
    const camY = 0.5 + dist0 * 0.182;
    this.slotsPerPx = (2 * dist0 * TAN) / h / (STEP * R);
    let oy = oy0;

    if (p <= 0 || !this.disc.visible) {
      cam.position.set(0, camY, R + dist0);
      cam.lookAt(0, 0.5, R);
    } else {
      const dc = this.disc.position;
      const distS = Math.max(4.2, 3.2 / (2 * TAN * aspect));
      const eS = ease(clamp01(p / 0.56));
      const b = clamp01((p - 0.56) / 0.44);
      const eXY = ease(clamp01(b / 0.55));
      const eZ = Math.pow(b, 1.7);
      const zPlane = dc.z + DISC_T / 2;
      // exponential approach: the hole grows at a steady rate until it swallows the frame
      const dz = mix(R + dist0 - zPlane, distS, eS) * Math.pow(0.045 / distS, eZ);
      cam.position.set(mix(0, dc.x, eXY), mix(mix(camY, 1.0, eS), dc.y, eXY), zPlane + dz);
      cam.lookAt(mix(0, dc.x, eXY), mix(mix(0.5, 0.66, eS), dc.y, eXY), mix(R, dc.z, eS));
      oy = oy0 * (1 - eS);
    }
    cam.setViewOffset(w, h, 0, oy, w, h);
  }
}
