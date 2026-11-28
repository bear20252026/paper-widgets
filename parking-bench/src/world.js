/**
 * src/world.js — Elite CT Brain v2.7 Medium-Format Photoreal Scandinavian Kitchen,
 * Sunlit Sculpted European White-Oak Dining Table, Dual 6x6 Laser-Etched Beechwood & Slate
 * Race Boards (Foreground = YOU at z = +9.2, Background = AI Opponent at z = -9.2),
 * Coupled 2K POM, Two-Tier 4096+4096 Shadows, Fused Golden-Hour AgX,
 * All 10 Omni-Referenced 1:64 Collector Die-Cast Models in Shared THREE.BatchedMesh Pools,
 * Independent Dual Exit Gates, Tactile Tabletop Plaques & Fair Blind AI Back-Board PNG Capture
 * Project: Parking Bench · 6×6 Race — Human vs. Gemini AI (hydrogen-parking-bench)
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  GRID_SPEC,
  BOARD_PHYSICS,
  PHYSICAL_SCALE_SPEC,
  VEHICLE_CLASSES,
  CURATED_FINISHES,
  DEMO_EVENTS,
  bus,
  state,
} from "./contract.js";
import * as vehiclesGlbMod from "./assets/vehiclesGlb.js";
import * as boardTrayGlbMod from "./assets/boardTrayGlb.js";
import * as kitchenPropsGlbMod from "./assets/kitchenPropsGlb.js";
import {
  PALE_WHITE_OAK_DATA_URI,
  BEECH_WOOD_DATA_URI,
  CREAM_LIMESTONE_DATA_URI,
} from "./assets/tabletopTextures.js";
import {
  ensureTelemetry,
  registerInlineGlbBytes,
  updateWorldCohesionUniforms,
  injectWorldCohesionHook,
  createCalibratedPBR,
  createFusedAgXComposer,
} from "./kits/world_cohesion_agx.js";
import { createTwoTierShadowRig } from "./kits/open_world_60fps.js";

/**
 * Canonical Dual-Board World Offsets on the Sunlit European White-Oak Table:
 *  - `human` (Foreground Board): z = +9.2 (front half of table, Row 3 F3 exit at worldZ = +8.10)
 *  - `ai`    (Background Board): z = -9.2 (back half of table,  Row 3 F3 exit at worldZ = -10.30)
 */
export const BOARD_OFFSETS = {
  human: { x: 0, z: 9.2 },
  ai: { x: 0, z: -9.2 },
};

/**
 * Self-contained 6x6 board-local metric constants (1.0 scene unit = 1.42 cm)
 * ensuring exact 6x6 geometry (`13.20 x 13.20` slate deck, `14.84 x 14.84` beech frame, F3 exit).
 */
const BOARD6 = {
  gridSize: 6,
  cellSize: 2.2,
  exitRow: 2, // 0-indexed Row 2 = 1-indexed Row "3" (`F3`), localZ = -1.10
  exitCol: 5, // Column "F"
  colLetters: "ABCDEF",
  deckY: 0.0,
  tableY: -0.16,
  railTopY: 0.44,
  innerHalf: 6.60,
  outerHalf: 7.42,
  bevelStartX: 6.96,
  bevelEndX: 7.42,
  exitZMin: -2.28,
  exitZMax: 0.08,
  cellToLocalX(col, length = 1) {
    return (col + (length - 1) * 0.5 - 2.5) * 2.2;
  },
  cellToLocalZ(row, length = 1) {
    return (row + (length - 1) * 0.5 - 2.5) * 2.2;
  },
  evalExitSurfaceY(worldX) {
    if (!(worldX > 6.96)) return 0.0;
    if (worldX >= 7.42) return -0.16;
    const u = (worldX - 6.96) / (7.42 - 6.96);
    const smooth = u * u * (3 - 2 * u);
    return -0.16 * smooth;
  },
};

/**
 * Deterministic Mulberry32 PRNG for reproducible procedural micro-grain & fallback textures.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Self-contained damped spherical OrbitControls matching Three.js OrbitControls API.
 */
class CourtyardOrbitControls {
  constructor(camera, domElement) {
    this.object = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3();

    this.enabled = true;
    this.enableDamping = true;
    this.dampingFactor = 0.085;
    this.enableRotate = true;
    this.enableZoom = true;
    this.enablePan = false;
    this.rotateSpeed = 0.76;
    this.zoomSpeed = 0.95;

    this.minDistance = 12.0;
    this.maxDistance = 145.0;
    this.minPolarAngle = 0.06;
    this.maxPolarAngle = Math.PI * 0.472;

    this._spherical = new THREE.Spherical();
    this._sphericalDelta = new THREE.Spherical(0, 0, 0);
    this._scale = 1;
    this._isDragging = false;
    this._activePointerId = null;
    this._lastX = 0;
    this._lastY = 0;
    this._offset = new THREE.Vector3();
    this._listeners = { start: [] };

    this._onPointerDown = (e) => {
      if (!this.enabled || !this.enableRotate) return;
      if (e.button !== 0 && e.button !== 2) return;
      if (e.defaultPrevented) return;
      this._isDragging = true;
      this._activePointerId = e.pointerId;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this._emitStart();
    };

    this._onPointerMove = (e) => {
      if (!this._isDragging || !this.enabled || !this.enableRotate) return;
      if (this._activePointerId !== null && e.pointerId !== this._activePointerId) return;
      const dx = e.clientX - this._lastX;
      const dy = e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;

      const element = this.domElement;
      const h = (element && element.clientHeight) || 800;
      const twoPi = 2 * Math.PI;
      this._sphericalDelta.theta -= (twoPi * dx * this.rotateSpeed) / h;
      this._sphericalDelta.phi -= (twoPi * dy * this.rotateSpeed) / h;
    };

    this._onPointerUp = (e) => {
      if (this._activePointerId !== null && e.pointerId !== this._activePointerId) return;
      this._isDragging = false;
      this._activePointerId = null;
    };

    this._onWheel = (e) => {
      if (!this.enabled || !this.enableZoom) return;
      e.preventDefault();
      this._emitStart();
      const zoomFactor = Math.pow(0.95, this.zoomSpeed);
      if (e.deltaY < 0) {
        this._scale *= zoomFactor;
      } else if (e.deltaY > 0) {
        this._scale /= zoomFactor;
      }
    };

    this._onContextMenu = (e) => {
      if (this.enabled) e.preventDefault();
    };

    if (domElement && domElement.addEventListener) {
      domElement.addEventListener("pointerdown", this._onPointerDown);
      window.addEventListener("pointermove", this._onPointerMove);
      window.addEventListener("pointerup", this._onPointerUp);
      window.addEventListener("pointercancel", this._onPointerUp);
      domElement.addEventListener("wheel", this._onWheel, { passive: false });
      domElement.addEventListener("contextmenu", this._onContextMenu);
    }
  }

  addEventListener(type, fn) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(fn);
  }

  _emitStart() {
    const arr = this._listeners.start;
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) arr[i]();
  }

  cancelDrag() {
    this._isDragging = false;
    this._activePointerId = null;
    this._sphericalDelta.set(0, 0, 0);
    this._scale = 1;
  }

  syncFromCamera() {
    this._offset.copy(this.object.position).sub(this.target);
    this._spherical.setFromVector3(this._offset);
    this._sphericalDelta.set(0, 0, 0);
    this._scale = 1;
  }

  update() {
    this._offset.copy(this.object.position).sub(this.target);
    this._spherical.setFromVector3(this._offset);

    if (this.enableDamping) {
      this._spherical.theta += this._sphericalDelta.theta * this.dampingFactor;
      this._spherical.phi += this._sphericalDelta.phi * this.dampingFactor;
    } else {
      this._spherical.theta += this._sphericalDelta.theta;
      this._spherical.phi += this._sphericalDelta.phi;
    }

    this._spherical.phi = Math.max(
      this.minPolarAngle,
      Math.min(this.maxPolarAngle, this._spherical.phi)
    );
    this._spherical.makeSafe();

    this._spherical.radius *= this._scale;
    this._spherical.radius = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this._spherical.radius)
    );

    this._offset.setFromSpherical(this._spherical);
    this.object.position.copy(this.target).add(this._offset);
    this.object.lookAt(this.target);

    if (this.enableDamping) {
      this._sphericalDelta.theta *= 1 - this.dampingFactor;
      this._sphericalDelta.phi *= 1 - this.dampingFactor;
    } else {
      this._sphericalDelta.set(0, 0, 0);
    }
    this._scale = 1;
    return false;
  }

  dispose() {
    if (this.domElement && this.domElement.removeEventListener) {
      this.domElement.removeEventListener("pointerdown", this._onPointerDown);
      this.domElement.removeEventListener("wheel", this._onWheel);
      this.domElement.removeEventListener("contextmenu", this._onContextMenu);
    }
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
  }
}

/**
 * Deterministic fallback procedural texture builder if Image Data URI decode ever fails.
 */
function createProceduralFallbackTexture(kind) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rng = mulberry32(kind === "oak" ? 0x10a4 : kind === "beech" ? 0xbee4 : 0xc1ae);

  if (kind === "limestone") {
    ctx.fillStyle = "#e6dfd3";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 220; i++) {
      const a = 0.03 + rng() * 0.06;
      ctx.fillStyle = rng() > 0.5 ? `rgba(130, 120, 106, ${a})` : `rgba(252, 249, 242, ${a})`;
      ctx.beginPath();
      ctx.arc(rng() * size, rng() * size, 1 + rng() * 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const isOak = kind === "oak";
    ctx.fillStyle = isOak ? "#e1d0b8" : "#ecd4b4";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 180; i++) {
      const alpha = 0.025 + rng() * 0.045;
      ctx.fillStyle = rng() > 0.5 ? `rgba(148, 122, 92, ${alpha})` : `rgba(252, 246, 236, ${alpha})`;
      if (isOak) {
        ctx.fillRect(0, rng() * size, size, 1 + rng() * 2.4);
      } else {
        ctx.fillRect(rng() * size, 0, 1 + rng() * 2.2, size);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Loads an inline Data URI texture with ZERO network requests (Origin: null safe).
 */
function loadDataUriTexture(dataUri, fallbackKind = "oak", { repeat = null, anisotropy = 8 } = {}) {
  const actualKind = typeof fallbackKind === "string" ? fallbackKind : "oak";
  const opts = fallbackKind && typeof fallbackKind === "object" ? fallbackKind : { repeat, anisotropy };
  const rep = opts.repeat || (opts.repeatX && opts.repeatY ? [opts.repeatX, opts.repeatY] : null);
  const aniso = opts.anisotropy || 8;

  return new Promise((resolve) => {
    const applySampling = (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      if (rep) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(rep[0], rep[1]);
      } else {
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
      }
      tex.anisotropy = aniso;
      tex.needsUpdate = true;
      return tex;
    };

    if (typeof Image === "undefined" || !dataUri) {
      resolve(applySampling(createProceduralFallbackTexture(actualKind)));
      return;
    }

    const img = new Image();
    img.decoding = "sync";
    img.onload = () => {
      const tex = new THREE.Texture(img);
      resolve(applySampling(tex));
    };
    img.onerror = () => {
      resolve(applySampling(createProceduralFallbackTexture(actualKind)));
    };
    img.src = dataUri;
  });
}

/**
 * Scene-Matched Kitchen Window + Warm Oak Bounce HDR Equirectangular PMREM (`FloatType`).
 */
function buildSceneMatchedKitchenPMREM(renderer) {
  const W = 512;
  const H = 256;
  const data = new Float32Array(W * H * 4);

  const winDir = new THREE.Vector3(-0.526, 0.585, -0.617).normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const winRight = new THREE.Vector3().crossVectors(worldUp, winDir).normalize();
  const winUp = new THREE.Vector3().crossVectors(winDir, winRight).normalize();

  const transomDir = new THREE.Vector3(-0.38, 0.86, 0.34).normalize();
  const transomRight = new THREE.Vector3().crossVectors(worldUp, transomDir).normalize();
  const transomUp = new THREE.Vector3().crossVectors(transomDir, transomRight).normalize();

  const rimDir = new THREE.Vector3(0.66, 0.50, -0.56).normalize();
  const dir = new THREE.Vector3();

  for (let iy = 0; iy < H; iy++) {
    const v = (iy + 0.5) / H;
    const lat = (v - 0.5) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);

    for (let ix = 0; ix < W; ix++) {
      const u = (ix + 0.5) / W;
      const lon = (u - 0.5) * Math.PI * 2.0;
      dir.set(cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon));

      let r = 0.0;
      let g = 0.0;
      let b = 0.0;

      if (dir.y >= 0.0) {
        const upT = Math.pow(dir.y, 0.65);
        r = 0.65 + 0.13 * upT;
        g = 0.61 + 0.13 * upT;
        b = 0.55 + 0.13 * upT;
      } else {
        const dnT = Math.min(1.0, -dir.y * 1.65);
        r = 0.56 * (1.0 - 0.38 * dnT);
        g = 0.44 * (1.0 - 0.40 * dnT);
        b = 0.31 * (1.0 - 0.42 * dnT);
      }

      const wDot = dir.dot(winDir);
      if (wDot > 0.62) {
        const uW = dir.dot(winRight) / Math.max(0.25, wDot);
        const vW = dir.dot(winUp) / Math.max(0.25, wDot);
        if (Math.abs(uW) < 0.46 && Math.abs(vW) < 0.34) {
          const edgeX = 1.0 - Math.max(0.0, (Math.abs(uW) - 0.40) / 0.06);
          const edgeY = 1.0 - Math.max(0.0, (Math.abs(vW) - 0.28) / 0.06);
          const inVertMullion = Math.abs(uW + 0.035) < 0.020;
          const inHorizTransom = Math.abs(vW - 0.075) < 0.016;
          if (inVertMullion || inHorizTransom) {
            r = 0.13;
            g = 0.115;
            b = 0.098;
          } else {
            const skyGrad = 0.82 + 0.26 * Math.max(0.0, (vW + 0.34) / 0.68);
            const hdrPeak = 3.55 * edgeX * edgeY * skyGrad;
            r += hdrPeak * 1.0;
            g += hdrPeak * 0.955;
            b += hdrPeak * 0.865;
          }
        }
      }

      const tDot = dir.dot(transomDir);
      if (tDot > 0.72) {
        const uT = dir.dot(transomRight) / tDot;
        const vT = dir.dot(transomUp) / tDot;
        if (Math.abs(uT) < 0.48 && Math.abs(vT) < 0.13) {
          const fx = 1.0 - Math.max(0.0, (Math.abs(uT) - 0.36) / 0.12);
          const fy = 1.0 - Math.max(0.0, (Math.abs(vT) - 0.08) / 0.05);
          const mull = Math.abs(uT) < 0.018 ? 0.15 : 1.0;
          const strip = 2.65 * fx * fy * mull;
          r += strip * 1.0;
          g += strip * 0.97;
          b += strip * 0.91;
        }
      }

      const rDot = Math.max(0.0, dir.dot(rimDir));
      if (rDot > 0.55) {
        const rimAmt = Math.pow((rDot - 0.55) / 0.45, 2.0) * 1.08;
        r += rimAmt * 0.82;
        g += rimAmt * 0.90;
        b += rimAmt * 1.0;
      }

      const idx = (iy * W + ix) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 1.0;
    }
  }

  const hdrEquirect = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  hdrEquirect.mapping = THREE.EquirectangularReflectionMapping;
  hdrEquirect.colorSpace = THREE.LinearSRGBColorSpace;
  hdrEquirect.minFilter = THREE.LinearFilter;
  hdrEquirect.magFilter = THREE.LinearFilter;
  hdrEquirect.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(hdrEquirect);
  hdrEquirect.dispose();
  pmrem.dispose();
  return envRT;
}

/**
 * Coupled 1024x1024 Procedural Rift-Sawn European White-Oak PBR Texture Suite.
 */
function buildCoupledRiftOakPBRSuite() {
  const W = 1024;
  const H = 1024;
  const albedo = new Uint8Array(W * H * 4);
  const normal = new Uint8Array(W * H * 4);
  const orm = new Uint8Array(W * H * 4);
  const height = new Uint8Array(W * H);

  const sinLut = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) {
    sinLut[i] = Math.sin((i / 4096) * Math.PI * 2.0);
  }

  const numPlanks = 6;
  const rng = mulberry32(0x20270a4);
  const plankPhase = new Int32Array(numPlanks);
  const plankTone = new Float32Array(numPlanks);
  const plankArchCenter = new Float32Array(numPlanks);
  const plankArchFreq = new Float32Array(numPlanks);
  for (let p = 0; p < numPlanks; p++) {
    plankPhase[p] = Math.floor(rng() * 4096);
    plankTone[p] = (rng() - 0.5) * 11.5;
    plankArchCenter[p] = 0.28 + rng() * 0.44;
    plankArchFreq[p] = 1.0 + rng() * 0.85;
  }

  const G = 64;
  const warpGrid = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) {
    warpGrid[i] = rng() - 0.5;
  }

  const N = 256;
  const noiseLut = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    noiseLut[i] = rng();
  }

  const longArchLut = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const u = x / W;
    longArchLut[x] =
      Math.sin(u * Math.PI * 2.0) * 0.55 + Math.sin(u * Math.PI * 4.0 + 1.1) * 0.22;
  }

  for (let y = 0; y < H; y++) {
    const plankIdx = Math.min(numPlanks - 1, Math.floor((y * numPlanks) / H));
    const plankLocalY = ((y * numPlanks) % H) / H;
    const seamDist = Math.min(plankLocalY, 1.0 - plankLocalY);
    const seamGroove = seamDist < 0.0075 ? 1.0 - seamDist / 0.0075 : 0.0;
    const seamSign = plankLocalY < 0.5 ? -1.0 : 1.0;
    const pOff = plankPhase[plankIdx];
    const pTone = plankTone[plankIdx];
    const archC = plankArchCenter[plankIdx];
    const archF = plankArchFreq[plankIdx];

    const distFromHeart = Math.abs(plankLocalY - archC);
    const radialBase = Math.pow(distFromHeart + 0.055, 0.82) * 3950.0 * archF;

    const gy = (y / H) * G;
    const gy0 = gy & (G - 1);
    const gy1 = (gy0 + 1) & (G - 1);
    const fy = gy - Math.floor(gy);

    const ny = (y & 255) << 8;
    const nyPore = ((y * 3) & 255) << 8;
    const nyRay = ((y >> 2) & 255) << 8;
    const rowOff = y * W;

    for (let x = 0; x < W; x++) {
      const pix = rowOff + x;
      const idx = pix << 2;

      const gx = (x / W) * G * 0.35;
      const gx0 = gx & (G - 1);
      const gx1 = (gx0 + 1) & (G - 1);
      const fx = gx - Math.floor(gx);
      const w00 = warpGrid[gy0 * G + gx0];
      const w10 = warpGrid[gy0 * G + gx1];
      const w01 = warpGrid[gy1 * G + gx0];
      const w11 = warpGrid[gy1 * G + gx1];
      const smoothWarp =
        (w00 + (w10 - w00) * fx) * (1.0 - fy) + (w01 + (w11 - w01) * fx) * fy;

      const nFine = noiseLut[ny | (x & 255)];
      const archMod = longArchLut[(x + pOff) & (W - 1)] * 460.0 + smoothWarp * 520.0;
      const waveIdx = (Math.round(radialBase + archMod) + pOff) & 4095;
      const ring = sinLut[waveIdx];
      const ringSharp = ring > 0.0 ? Math.pow(ring, 1.85) : -Math.pow(-ring, 0.75) * 0.55;
      const ringSlope = sinLut[(waveIdx + 1024) & 4095];

      const poreSample = noiseLut[nyPore | ((x >> 3) & 255)];
      const isPore = poreSample > 0.825 && ring > 0.08 ? (poreSample - 0.825) * 5.7 : 0.0;

      const raySample = noiseLut[nyRay | ((x >> 5) & 255)];
      const medRay = raySample > 0.865 ? (raySample - 0.865) * 5.2 : 0.0;

      const hFloat = Math.max(
        0.05,
        Math.min(1.0, 0.79 - ringSharp * 0.085 - isPore * 0.48 - seamGroove * 0.58 + medRay * 0.04)
      );
      height[pix] = (hFloat * 255) | 0;

      const delta =
        -ringSharp * 14.5 -
        isPore * 24.0 -
        seamGroove * 36.0 +
        medRay * 9.5 +
        pTone +
        (nFine - 0.5) * 4.2;
      albedo[idx] = Math.max(124, Math.min(244, (212 + delta) | 0));
      albedo[idx + 1] = Math.max(108, Math.min(234, (190 + delta * 0.93) | 0));
      albedo[idx + 2] = Math.max(88, Math.min(218, (160 + delta * 0.83) | 0));
      albedo[idx + 3] = 255;

      const aoFloat = Math.max(0.42, Math.min(1.0, 1.0 - isPore * 0.38 - seamGroove * 0.48));
      const rghFloat = Math.max(
        0.34,
        Math.min(0.68, 0.45 + ringSharp * 0.055 + isPore * 0.20 + seamGroove * 0.20 - medRay * 0.11)
      );
      orm[idx] = (aoFloat * 255) | 0;
      orm[idx + 1] = (rghFloat * 255) | 0;
      orm[idx + 2] = 0;
      orm[idx + 3] = 255;

      const nx = isPore * 0.34 * (nFine - 0.5);
      const nyVal = ringSlope * 0.18 + seamGroove * seamSign * 0.54 - isPore * 0.26;
      normal[idx] = Math.max(0, Math.min(255, (128 + nx * 127) | 0));
      normal[idx + 1] = Math.max(0, Math.min(255, (128 + nyVal * 127) | 0));
      normal[idx + 2] = 248;
      normal[idx + 3] = 255;
    }
  }

  const configDataTex = (tex, isSrgb = false) => {
    tex.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  };

  const albedoTex = configDataTex(new THREE.DataTexture(albedo, W, H, THREE.RGBAFormat), true);
  const normalTex = configDataTex(new THREE.DataTexture(normal, W, H, THREE.RGBAFormat), false);
  const ormTex = configDataTex(new THREE.DataTexture(orm, W, H, THREE.RGBAFormat), false);
  const heightTex = new THREE.DataTexture(height, W, H, THREE.RedFormat);
  heightTex.unpackAlignment = 1;
  configDataTex(heightTex, false);

  return { albedoTex, normalTex, ormTex, heightTex };
}

/**
 * Generates the deterministic 2048x2048 honed charcoal-slate 6x6 rolling deck texture:
 *  - Fine mineral charcoal-slate micro-grain (#292e36 .. #323842)
 *  - Flush silk-screened warm-ivory hairline 6x6 grid lines (1..5 internal dividers)
 *  - Subtle inner-rail perimeter ambient darkening + East Row 3 (F3, localZ in [-2.28, +0.08]) exit gap & chevrons
 */
function buildSlateDeckTexture6x6(maxAniso = 16) {
  const S = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  const SLATE_UV_HALF = 7.5;
  const SLATE_UV_SPAN = SLATE_UV_HALF * 2.0;
  const innerHalf = BOARD6.innerHalf; // 6.60
  const wxToPx = (wx) => ((wx + SLATE_UV_HALF) / SLATE_UV_SPAN) * S;
  const wzToPy = (wz) => ((wz + SLATE_UV_HALF) / SLATE_UV_SPAN) * S;

  ctx.fillStyle = "#2b3038";
  ctx.fillRect(0, 0, S, S);

  const rng = mulberry32(0x64642026);
  for (let i = 0; i < 420; i++) {
    const cx = rng() * S;
    const cy = rng() * S;
    const r = 28 + rng() * 95;
    const bright = rng() > 0.5;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, bright ? "rgba(64, 72, 83, 0.052)" : "rgba(22, 26, 32, 0.056)");
    g.addColorStop(1, "rgba(43, 48, 56, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle mineral quartz/calcite hairline vein across honed slate
  ctx.save();
  ctx.strokeStyle = "rgba(188, 194, 204, 0.045)";
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(S * 0.08, S * 0.16);
  ctx.bezierCurveTo(S * 0.36, S * 0.30, S * 0.58, S * 0.44, S * 0.92, S * 0.68);
  ctx.stroke();
  ctx.restore();

  const grainTile = document.createElement("canvas");
  grainTile.width = 256;
  grainTile.height = 256;
  const gctx = grainTile.getContext("2d");
  const imgData = gctx.createImageData(256, 256);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * 14;
    const v = Math.max(0, Math.min(255, Math.round(44 + n)));
    d[i] = v;
    d[i + 1] = Math.min(255, v + 4);
    d[i + 2] = Math.min(255, v + 10);
    d[i + 3] = 96;
  }
  gctx.putImageData(imgData, 0, 0);
  ctx.fillStyle = ctx.createPattern(grainTile, "repeat");
  ctx.fillRect(0, 0, S, S);

  const xMinPx = wxToPx(-innerHalf);
  const xMaxPx = wxToPx(innerHalf);
  const zMinPy = wzToPy(-innerHalf);
  const zMaxPy = wzToPy(innerHalf);
  const exitTopPy = wzToPy(BOARD6.exitZMin);
  const exitBotPy = wzToPy(BOARD6.exitZMax);
  const aoSpan = 34;

  const paintEdgeAO = (x0, y0, x1, y1, rx, ry, rw, rh) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(10, 13, 17, 0.36)");
    g.addColorStop(1, "rgba(10, 13, 17, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  };

  paintEdgeAO(xMinPx, 0, xMinPx + aoSpan, 0, xMinPx - 8, zMinPy - 8, aoSpan + 8, zMaxPy - zMinPy + 16);
  paintEdgeAO(0, zMinPy, 0, zMinPy + aoSpan, xMinPx - 8, zMinPy - 8, xMaxPx - xMinPx + 16, aoSpan + 8);
  paintEdgeAO(0, zMaxPy, 0, zMaxPy - aoSpan, xMinPx - 8, zMaxPy - aoSpan, xMaxPx - xMinPx + 16, aoSpan + 8);
  paintEdgeAO(xMaxPx, 0, xMaxPx - aoSpan, 0, xMaxPx - aoSpan, zMinPy - 8, aoSpan + 8, exitTopPy - zMinPy + 8);
  paintEdgeAO(xMaxPx, 0, xMaxPx - aoSpan, 0, xMaxPx - aoSpan, exitBotPy, aoSpan + 8, zMaxPy - exitBotPy + 8);

  const bevelStartPx = wxToPx(BOARD6.bevelStartX);
  const bevelEndPx = wxToPx(BOARD6.bevelEndX);
  const lipGrad = ctx.createLinearGradient(bevelStartPx - 6, 0, bevelEndPx + 4, 0);
  lipGrad.addColorStop(0.0, "rgba(255, 250, 240, 0)");
  lipGrad.addColorStop(0.14, "rgba(232, 228, 220, 0.16)");
  lipGrad.addColorStop(0.55, "rgba(38, 43, 51, 0.08)");
  lipGrad.addColorStop(1.0, "rgba(18, 21, 26, 0.28)");
  ctx.fillStyle = lipGrad;
  ctx.fillRect(bevelStartPx - 6, exitTopPy - 6, bevelEndPx - bevelStartPx + 14, exitBotPy - exitTopPy + 12);

  ctx.save();
  ctx.lineCap = "butt";
  const gridInset = 0.055;
  const gLeft = wxToPx(-innerHalf + gridInset);
  const gRight = wxToPx(innerHalf - gridInset);
  const gTop = wzToPy(-innerHalf + gridInset);
  const gBot = wzToPy(innerHalf - gridInset);

  ctx.strokeStyle = "rgba(236, 230, 218, 0.44)";
  ctx.lineWidth = 2.4;

  for (let k = 1; k < BOARD6.gridSize; k++) {
    const px = wxToPx(-innerHalf + k * BOARD6.cellSize);
    ctx.beginPath();
    ctx.moveTo(px, gTop);
    ctx.lineTo(px, gBot);
    ctx.stroke();
  }

  const throatGuideEndPx = wxToPx(BOARD6.bevelStartX - 0.10);
  for (let k = 1; k < BOARD6.gridSize; k++) {
    const py = wzToPy(-innerHalf + k * BOARD6.cellSize);
    const endX = k === BOARD6.exitRow || k === BOARD6.exitRow + 1 ? throatGuideEndPx : gRight;
    ctx.beginPath();
    ctx.moveTo(gLeft, py);
    ctx.lineTo(endX, py);
    ctx.stroke();
  }

  const exitRowTopZ = -innerHalf + BOARD6.exitRow * BOARD6.cellSize; // -2.20
  const exitRowBotZ = exitRowTopZ + BOARD6.cellSize;                //  0.00
  ctx.strokeStyle = "rgba(236, 230, 218, 0.30)";
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(gRight, gTop);
  ctx.lineTo(gLeft, gTop);
  ctx.lineTo(gLeft, gBot);
  ctx.lineTo(gRight, gBot);
  ctx.moveTo(gRight, gTop);
  ctx.lineTo(gRight, wzToPy(exitRowTopZ));
  ctx.moveTo(gRight, wzToPy(exitRowBotZ));
  ctx.lineTo(gRight, gBot);
  ctx.stroke();

  ctx.strokeStyle = "rgba(246, 241, 231, 0.64)";
  ctx.lineWidth = 2.2;
  const tick = 7.0;
  for (let kx = 1; kx < BOARD6.gridSize; kx++) {
    const px = wxToPx(-innerHalf + kx * BOARD6.cellSize);
    for (let kz = 1; kz < BOARD6.gridSize; kz++) {
      const py = wzToPy(-innerHalf + kz * BOARD6.cellSize);
      ctx.beginPath();
      ctx.moveTo(px - tick, py);
      ctx.lineTo(px + tick, py);
      ctx.moveTo(px, py - tick);
      ctx.lineTo(px, py + tick);
      ctx.stroke();
    }
  }

  // Silk-screened triple East exit chevrons (`>>>`) at F3 (`localZ = -1.10`)
  const exitCenterPy = wzToPy(BOARD6.cellToLocalZ(BOARD6.exitRow, 1));
  ctx.strokeStyle = "rgba(242, 232, 214, 0.46)";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const cxWorld of [5.45, 5.95, 6.45]) {
    const cx = wxToPx(cxWorld);
    const armX = 14;
    const armY = 24;
    ctx.beginPath();
    ctx.moveTo(cx - armX * 0.6, exitCenterPy - armY);
    ctx.lineTo(cx + armX * 0.6, exitCenterPy);
    ctx.lineTo(cx - armX * 0.6, exitCenterPy + armY);
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates the 2048x2048 Mitered Steamed-Beechwood 6x6 Frame Texture + Laser-Etched `A..F` & `1..6` Rails:
 *  - 4 mitered 45-degree European beechwood grain quadrants (`North`/`South` horizontal grain, `West`/`East` vertical grain)
 *  - CNC laser-engraved column letters `A..F` along North & South rails + cell divider ticks
 *  - CNC laser-engraved row numbers `1..6` along West rail & `1, 2, 4, 5, 6` along East rail (Row 3 = open `F3` exit throat)
 */
function buildBeechFrameTexture6x6(beechImgTex, maxAniso = 16) {
  const S = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  const FRAME_UV_HALF = 7.60;
  const FRAME_UV_SPAN = FRAME_UV_HALF * 2.0;
  const wxToPx = (wx) => ((wx + FRAME_UV_HALF) / FRAME_UV_SPAN) * S;
  const wzToPy = (wz) => ((wz + FRAME_UV_HALF) / FRAME_UV_SPAN) * S;

  // Build horizontal-grain steamed European beechwood tile (`512x512`)
  const tile = document.createElement("canvas");
  tile.width = 512;
  tile.height = 512;
  const tctx = tile.getContext("2d");
  tctx.fillStyle = "#e3c8a8";
  tctx.fillRect(0, 0, 512, 512);
  if (beechImgTex && beechImgTex.image) {
    tctx.globalAlpha = 0.72;
    tctx.drawImage(beechImgTex.image, 0, 0, 512, 512);
    tctx.globalAlpha = 1.0;
    tctx.fillStyle = "rgba(229, 202, 168, 0.28)";
    tctx.fillRect(0, 0, 512, 512);
  }
  const rng = mulberry32(0xbee66026);
  // Characteristic short dark-honey steamed beechwood medullary ray flecks along grain
  for (let i = 0; i < 1650; i++) {
    const fx = rng() * 512;
    const fy = rng() * 512;
    const fw = 6 + rng() * 22;
    const fh = 1.0 + rng() * 2.2;
    const dark = rng() > 0.28;
    tctx.fillStyle = dark
      ? `rgba(156, 118, 82, ${0.10 + rng() * 0.16})`
      : `rgba(248, 234, 214, ${0.10 + rng() * 0.12})`;
    tctx.fillRect(fx, fy, fw, fh);
  }

  const paintTiledGrain = (rotated90 = false) => {
    ctx.save();
    if (rotated90) {
      ctx.translate(S * 0.5, S * 0.5);
      ctx.rotate(Math.PI * 0.5);
      ctx.translate(-S * 0.5, -S * 0.5);
    }
    const pat = ctx.createPattern(tile, "repeat");
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
  };

  // North & South quadrants: horizontal grain along X
  paintTiledGrain(false);

  // West & East quadrants: clip to left & right 45-degree miter triangles and paint vertical grain along Z
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(S * 0.5, S * 0.5);
  ctx.lineTo(0, S);
  ctx.closePath();
  ctx.moveTo(S, 0);
  ctx.lineTo(S * 0.5, S * 0.5);
  ctx.lineTo(S, S);
  ctx.closePath();
  ctx.clip();
  paintTiledGrain(true);
  ctx.restore();

  // Crisp cabinetmaker 45-degree corner miter join seams across the 4 beechwood corners
  const outerMinPx = wxToPx(-BOARD6.outerHalf);
  const outerMaxPx = wxToPx(BOARD6.outerHalf);
  const innerMinPx = wxToPx(-BOARD6.innerHalf);
  const innerMaxPx = wxToPx(BOARD6.innerHalf);

  ctx.save();
  ctx.strokeStyle = "rgba(92, 64, 38, 0.44)";
  ctx.lineWidth = 2.6;
  for (const [x0, y0, x1, y1] of [
    [outerMinPx, outerMinPx, innerMinPx, innerMinPx],
    [outerMaxPx, outerMinPx, innerMaxPx, innerMinPx],
    [outerMinPx, outerMaxPx, innerMinPx, innerMaxPx],
    [outerMaxPx, outerMaxPx, innerMaxPx, innerMaxPx],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // Laser-etched stall boundary ticks along inner edge of all 4 rails (`k = 1..5`)
  ctx.strokeStyle = "rgba(56, 36, 20, 0.72)";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  const tickIn = 0.08;
  const tickOut = 0.24;
  for (let k = 1; k < BOARD6.gridSize; k++) {
    const worldCoord = -BOARD6.innerHalf + k * BOARD6.cellSize;
    const pCoord = wxToPx(worldCoord);

    // North rail tick
    ctx.beginPath();
    ctx.moveTo(pCoord, wzToPy(-BOARD6.innerHalf - tickOut));
    ctx.lineTo(pCoord, wzToPy(-BOARD6.innerHalf - tickIn));
    ctx.stroke();

    // South rail tick
    ctx.beginPath();
    ctx.moveTo(pCoord, wzToPy(BOARD6.innerHalf + tickIn));
    ctx.lineTo(pCoord, wzToPy(BOARD6.innerHalf + tickOut));
    ctx.stroke();

    // West rail tick
    ctx.beginPath();
    ctx.moveTo(wxToPx(-BOARD6.innerHalf - tickOut), pCoord);
    ctx.lineTo(wxToPx(-BOARD6.innerHalf - tickIn), pCoord);
    ctx.stroke();

    // East rail tick (skip k === 2 and k === 3 around open Row 3 exit cutout)
    if (k !== BOARD6.exitRow && k !== BOARD6.exitRow + 1) {
      ctx.beginPath();
      ctx.moveTo(wxToPx(BOARD6.innerHalf + tickIn), pCoord);
      ctx.lineTo(wxToPx(BOARD6.innerHalf + tickOut), pCoord);
      ctx.stroke();
    }
  }

  // CNC Laser-Engraved Column Letters (`A`..`F`) & Row Numbers (`1`..`6`)
  const railCenter = (BOARD6.innerHalf + BOARD6.outerHalf) * 0.5; // 7.01
  ctx.font = "600 50px 'EditorialSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const drawLaserGlyph = (glyph, px, py) => {
    // Subtle sunlit lower-right wood-bevel rim + deep roasted-umber laser burn core
    ctx.fillStyle = "rgba(255, 244, 226, 0.42)";
    ctx.fillText(glyph, px + 1.4, py + 1.4);
    ctx.fillStyle = "#2b1c10";
    ctx.fillText(glyph, px, py);
  };

  for (let c = 0; c < BOARD6.gridSize; c++) {
    const letter = BOARD6.colLetters[c];
    const cx = wxToPx(BOARD6.cellToLocalX(c, 1));
    drawLaserGlyph(letter, cx, wzToPy(-railCenter));
    drawLaserGlyph(letter, cx, wzToPy(railCenter));
  }

  for (let r = 0; r < BOARD6.gridSize; r++) {
    const numStr = String(r + 1);
    const cy = wzToPy(BOARD6.cellToLocalZ(r, 1));
    drawLaserGlyph(numStr, wxToPx(-railCenter), cy);
    if (r !== BOARD6.exitRow) {
      drawLaserGlyph(numStr, wxToPx(railCenter), cy);
    }
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Remaps `board_tray_12x12.glb` (`28.64 x 28.64`) in-place onto the exact `6x6` (`14.84 x 14.84`)
 * geometry with `13.20 x 13.20` inner slate deck, `[6.96, 7.42]` East Row 3 (`F3`) exit bevel,
 * planar `6x6` UVs, and `(7.01, 1.12, -2.44)` barrier gate stanchion & boom pivot.
 */
function remapBoardTrayGlbTo6x6(bRoot) {
  const remapRailCoord = (v) => {
    const s = v < 0 ? -1 : 1;
    const a = Math.abs(v);
    if (a <= 3.0) return v;
    if (a <= 13.26) return s * (a - 6.60);
    return s * (6.60 + (a - 13.20) * (0.82 / 1.12));
  };
  const remapSlateX = (x) => {
    if (x < 0) return x + 6.60;
    if (x <= 13.56) return x - 6.60;
    return 6.96 + (x - 13.56) * (0.46 / 0.76);
  };
  const remapSlateZ = (z) => {
    if (Math.abs(z) <= 3.0) return z;
    return z < 0 ? z + 6.60 : z - 6.60;
  };

  bRoot.traverse((node) => {
    const nm = node.name || "";
    if (nm === "Gate_BoomPivot" && node.position.x > 9.5) {
      node.position.x -= 6.75; // 13.76 -> 7.01
    }
    if (!node.isMesh || !node.geometry) return;
    const geom = node.geometry.clone();
    node.geometry = geom;

    const pos = geom.attributes.position;
    if (!pos) return;
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    const spanX = bb ? bb.max.x - bb.min.x : 0;

    if (nm === "Board_SlateDeck" || /Slate/i.test(nm)) {
      if (spanX > 18.0) {
        const norm = geom.attributes.normal;
        for (let i = 0; i < pos.count; i++) {
          const ox = pos.getX(i);
          const oz = pos.getZ(i);
          pos.setX(i, remapSlateX(ox));
          pos.setZ(i, remapSlateZ(oz));
          if (norm && ox > 13.56) {
            const nx = norm.getX(i) / (0.46 / 0.76);
            const ny = norm.getY(i);
            const nz = norm.getZ(i);
            const len = Math.hypot(nx, ny, nz) || 1;
            norm.setXYZ(i, nx / len, ny / len, nz / len);
          }
        }
        pos.needsUpdate = true;
        if (norm) norm.needsUpdate = true;
      }
      // Apply exact 6x6 planar Slate UVs (`[-7.5, +7.5]`)
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uvs[i * 2] = (pos.getX(i) + 7.5) / 15.0;
        uvs[i * 2 + 1] = 1.0 - (pos.getZ(i) + 7.5) / 15.0;
      }
      geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geom.setAttribute("uv1", new THREE.BufferAttribute(uvs, 2));
    } else if (nm === "Board_BeechFrame" || /Beech/i.test(nm)) {
      if (spanX > 18.0) {
        for (let i = 0; i < pos.count; i++) {
          pos.setX(i, remapRailCoord(pos.getX(i)));
          pos.setZ(i, remapRailCoord(pos.getZ(i)));
        }
        pos.needsUpdate = true;
      }
      // Apply exact 6x6 planar + side-wall grain-unfold UVs (`[-7.60, +7.60]`)
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const drop = Math.max(0.0, 0.42 - y) * 0.14;
        let ux = x;
        let uz = z;
        if (drop > 0.0) {
          if (Math.abs(x) >= Math.abs(z)) {
            const signX = x < 0 ? -1 : 1;
            ux = Math.abs(x) < 7.01 ? x - signX * drop : x + signX * drop;
          } else {
            const signZ = z < 0 ? -1 : 1;
            uz = Math.abs(z) < 7.01 ? z - signZ * drop : z + signZ * drop;
          }
        }
        uvs[i * 2] = Math.max(0.002, Math.min(0.998, (ux + 7.60) / 15.20));
        uvs[i * 2 + 1] = Math.max(0.002, Math.min(0.998, 1.0 - (uz + 7.60) / 15.20));
      }
      geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geom.setAttribute("uv1", new THREE.BufferAttribute(uvs, 2));
    } else if (nm === "Board_BrassPins" || /BrassPins/i.test(nm)) {
      if (spanX > 18.0) {
        for (let i = 0; i < pos.count; i++) {
          pos.setX(i, remapRailCoord(pos.getX(i)));
          pos.setZ(i, remapRailCoord(pos.getZ(i)));
        }
        pos.needsUpdate = true;
      }
    } else if (
      (nm === "Gate_Beacon" || nm === "Gate_Stanchion" || /Gate_(?:Beacon|Stanchion)/i.test(nm)) &&
      bb &&
      bb.min.x > 9.5
    ) {
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) - 6.75);
      }
      pos.needsUpdate = true;
    }

    geom.computeBoundingBox();
    geom.computeBoundingSphere();
  });
}

/**
 * Renders a crisp high-contrast brushed-brass & dark-espresso tabletop nameplate canvas.
 */
function paintTabletopNameplateCanvas(canvas, labelText, { isHuman = false } = {}) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, W, H);
  if (isHuman) {
    grad.addColorStop(0.0, "#efe4cd");
    grad.addColorStop(0.5, "#e5d4b3");
    grad.addColorStop(1.0, "#d8c29b");
  } else {
    grad.addColorStop(0.0, "#282d35");
    grad.addColorStop(0.5, "#22272f");
    grad.addColorStop(1.0, "#1c2027");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle horizontal brushed-metal micro-hairlines
  const rng = mulberry32(isHuman ? 0x9001 : 0xa102);
  for (let i = 0; i < 90; i++) {
    const y = rng() * H;
    ctx.fillStyle = isHuman
      ? `rgba(120, 92, 54, ${0.03 + rng() * 0.04})`
      : `rgba(255, 248, 234, ${0.02 + rng() * 0.035})`;
    ctx.fillRect(0, y, W, 1.2);
  }

  // Inset champagne-brass hairline border
  ctx.strokeStyle = isHuman ? "rgba(74, 54, 30, 0.42)" : "rgba(226, 198, 148, 0.56)";
  ctx.lineWidth = 4.5;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  const cleanText = String(labelText || (isHuman ? "YOU" : "GEMINI 4 HYDROGEN"))
    .trim()
    .toUpperCase();

  const dotRadius = 11;
  const fontSize = cleanText.length > 16 ? 44 : cleanText.length > 10 ? 48 : 56;
  ctx.font = `600 ${fontSize}px 'EditorialSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const textW = ctx.measureText(cleanText).width;
  const gap = 20;
  const totalW = dotRadius * 2 + gap + textW;
  const startX = Math.max(34, (W - totalW) * 0.5);
  const midY = H * 0.51;

  // Status indicator jewel dot (emerald for YOU, crimson-gold for AI opponent)
  ctx.fillStyle = isHuman ? "#1d8352" : "#d94136";
  ctx.beginPath();
  ctx.arc(startX + dotRadius, midY, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isHuman ? "#23190f" : "#f5ecda";
  ctx.fillText(cleanText, startX + dotRadius * 2 + gap, midY);
}

let _sharedPlaqueWalnutMat = null;

/**
 * Creates a sculpted solid-walnut & brushed-brass angled tabletop nameplate assembly.
 */
function createTabletopNameplate({
  name,
  initialLabel,
  isHuman = false,
  width = 5.0,
  depth = 1.16,
  height = 0.50,
  envTexture,
  radialAoTex,
  maxAniso = 16,
}) {
  const group = new THREE.Group();
  group.name = name;

  const canvas = document.createElement("canvas");
  canvas.width = isHuman ? 640 : 1024;
  canvas.height = 176;
  paintTabletopNameplateCanvas(canvas, initialLabel, { isHuman });

  const faceTex = new THREE.CanvasTexture(canvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = maxAniso;
  faceTex.needsUpdate = true;

  // Angled walnut desk-plaque wedge (`frontTopY = 0.14`, `backTopY = height`, `y = 0` base)
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const y0 = 0.0;
  const yFront = 0.13;
  const yBack = height;
  const positions = [];
  const normals = [];
  const uvs = [];
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vN = new THREE.Vector3();

  const pushQuad = (p0, p1, p2, p3) => {
    vA.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    vB.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    vN.crossVectors(vA, vB).normalize();
    for (const [pt, uv] of [
      [p0, [0, 0]],
      [p1, [1, 0]],
      [p2, [1, 1]],
      [p0, [0, 0]],
      [p2, [1, 1]],
      [p3, [0, 1]],
    ]) {
      positions.push(pt[0], pt[1], pt[2]);
      normals.push(vN.x, vN.y, vN.z);
      uvs.push(uv[0], uv[1]);
    }
  };

  // Sloped top/front bevel (`z: +hd -> -hd`, `y: yFront -> yBack`, normal pointing +Y/+Z toward camera!)
  pushQuad([-hw, yFront, hd], [hw, yFront, hd], [hw, yBack, -hd], [-hw, yBack, -hd]);
  // Front lip
  pushQuad([-hw, y0, hd], [hw, y0, hd], [hw, yFront, hd], [-hw, yFront, hd]);
  // Back wall
  pushQuad([hw, y0, -hd], [-hw, y0, -hd], [-hw, yBack, -hd], [hw, yBack, -hd]);
  // Left & right end caps
  pushQuad([-hw, y0, -hd], [-hw, y0, hd], [-hw, yFront, hd], [-hw, yBack, -hd]);
  pushQuad([hw, y0, hd], [hw, y0, -hd], [hw, yBack, -hd], [hw, yFront, hd]);

  const wedgeGeo = new THREE.BufferGeometry();
  wedgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  wedgeGeo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  wedgeGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

  if (!_sharedPlaqueWalnutMat) {
    _sharedPlaqueWalnutMat = new THREE.MeshStandardMaterial({
      name: "Mat_PlaqueWalnutShared",
      color: 0x4b3829,
      roughness: 0.38,
      metalness: 0.04,
      envMap: envTexture,
      envMapIntensity: 0.78,
    });
    injectWorldCohesionHook(_sharedPlaqueWalnutMat, { bounceWeight: 0.8, goboWeight: 0.85 });
  }
  const walnutMat = _sharedPlaqueWalnutMat;

  const wedgeMesh = new THREE.Mesh(wedgeGeo, walnutMat);
  wedgeMesh.castShadow = true;
  wedgeMesh.receiveShadow = true;
  wedgeMesh.raycast = () => {};
  group.add(wedgeMesh);

  // Flush inlay brass/slate face positioned 4mm proud of the sloped wedge face
  const slopeLen = Math.hypot(depth, yBack - yFront);
  const slopePitch = -Math.atan2(depth, yBack - yFront); // tilt from vertical -> or from XY plane
  const faceGeo = new THREE.PlaneGeometry(width - 0.18, slopeLen - 0.14);
  const faceMat = new THREE.MeshStandardMaterial({
    name: `Mat_PlaqueFace_${name}`,
    color: 0xffffff,
    map: faceTex,
    roughness: isHuman ? 0.26 : 0.32,
    metalness: isHuman ? 0.48 : 0.16,
    envMap: envTexture,
    envMapIntensity: 0.85,
  });
  injectWorldCohesionHook(faceMat, { bounceWeight: 0.75, goboWeight: 0.85 });

  const dy = yBack - yFront;
  const dz = depth;
  const normY = dz / slopeLen;
  const normZ = dy / slopeLen;
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  // PlaneGeometry starts facing +Z (0,0,1); rotating around X by -atan2(normY, normZ) aligns normal to (0, normY, normZ)
  faceMesh.rotation.x = -Math.atan2(normY, normZ);
  faceMesh.position.set(0, (yFront + yBack) * 0.5 + normY * 0.008, normZ * 0.008);
  faceMesh.castShadow = false;
  faceMesh.receiveShadow = true;
  faceMesh.raycast = () => {};
  group.add(faceMesh);

  // Soft contact AO strip beneath plaque
  if (radialAoTex) {
    const aoMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 1.1, depth + 0.9),
      new THREE.MeshBasicMaterial({
        map: radialAoTex,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    aoMesh.rotation.x = -Math.PI * 0.5;
    aoMesh.position.y = 0.004;
    aoMesh.raycast = () => {};
    group.add(aoMesh);
  }

  // Silence unused variable lint if any
  void slopePitch;

  return {
    group,
    setLabel(nextText) {
      paintTabletopNameplateCanvas(canvas, nextText, { isHuman });
      faceTex.needsUpdate = true;
    },
  };
}

/**
 * Riven/honed mineral slate micro-cleavage tangent normal map (`256x256` tileable).
 */
function buildSlateCleavageNormalMap() {
  const S = 256;
  const data = new Uint8Array(S * S * 4);
  const rng = mulberry32(0x51a7e99);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const strata = Math.sin((x * 0.11 + y * 0.04) * Math.PI * 0.5) * 0.35;
      h[y * S + x] = strata + (rng() - 0.5) * 0.45;
    }
  }
  for (let y = 0; y < S; y++) {
    const yn = ((y + 1) & (S - 1)) * S;
    const yc = y * S;
    for (let x = 0; x < S; x++) {
      const xn = (x + 1) & (S - 1);
      const dx = (h[yc + xn] - h[yc + x]) * 0.18;
      const dy = (h[yn + x] - h[yc + x]) * 0.18;
      const idx = (yc + x) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round((0.5 - dx) * 255)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round((0.5 - dy) * 255)));
      data[idx + 2] = 250;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function buildStonewareGlazeTexture() {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e8e0d3";
  ctx.fillRect(0, 0, S, S);

  const rng = mulberry32(0xc0ffee64);
  for (let i = 0; i < 160; i++) {
    const cx = rng() * S;
    const cy = rng() * S;
    const r = 18 + rng() * 54;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rng() > 0.5 ? "rgba(255, 250, 242, 0.12)" : "rgba(186, 173, 154, 0.10)");
    g.addColorStop(1, "rgba(232, 224, 211, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 720; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const r = 0.7 + rng() * 1.9;
    const a = 0.16 + rng() * 0.34;
    ctx.fillStyle = `rgba(92, 76, 60, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function buildCorkTexture() {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#c0a384";
  ctx.fillRect(0, 0, S, S);

  const rng = mulberry32(0xc0742026);
  for (let i = 0; i < 950; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const rw = 1.6 + rng() * 4.2;
    const rh = 1.2 + rng() * 3.2;
    const rot = rng() * Math.PI;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle =
      rng() > 0.45
        ? `rgba(148, 116, 84, ${0.18 + rng() * 0.22})`
        : `rgba(218, 194, 166, ${0.16 + rng() * 0.20})`;
    ctx.fillRect(-rw * 0.5, -rh * 0.5, rw, rh);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function buildWovenFabricTexture(kind = "linen") {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  const isCord = kind === "papercord";
  ctx.fillStyle = isCord ? "#ded5c5" : "#e5ded2";
  ctx.fillRect(0, 0, S, S);

  const step = isCord ? 8 : 5;
  const rng = mulberry32(isCord ? 0xc08d11 : 0x714e22);
  for (let y = 0; y < S; y += step) {
    ctx.fillStyle = `rgba(154, 142, 124, ${0.09 + rng() * 0.06})`;
    ctx.fillRect(0, y, S, Math.max(1, step * 0.36));
  }
  for (let x = 0; x < S; x += step) {
    ctx.fillStyle = `rgba(252, 248, 240, ${0.12 + rng() * 0.08})`;
    ctx.fillRect(x, 0, Math.max(1, step * 0.36), S);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(isCord ? 5 : 7, isCord ? 5 : 7);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function buildLatteArtCanvasTexture() {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  const C = S * 0.5;

  const cremaGrad = ctx.createRadialGradient(C, C, S * 0.06, C, C, S * 0.5);
  cremaGrad.addColorStop(0.0, "#a47a55");
  cremaGrad.addColorStop(0.68, "#916846");
  cremaGrad.addColorStop(0.92, "#795436");
  cremaGrad.addColorStop(1.0, "#64442b");
  ctx.fillStyle = cremaGrad;
  ctx.fillRect(0, 0, S, S);

  const rng = mulberry32(0x1a77e01);
  for (let i = 0; i < 460; i++) {
    const ang = rng() * Math.PI * 2;
    const rad = S * (0.30 + rng() * 0.17);
    const bx = C + Math.cos(ang) * rad;
    const by = C + Math.sin(ang) * rad;
    ctx.fillStyle = rng() > 0.4 ? "rgba(246, 235, 218, 0.17)" : "rgba(72, 46, 26, 0.19)";
    ctx.beginPath();
    ctx.arc(bx, by, 0.8 + rng() * 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  const drawHeartPath = (scale, yShift) => {
    ctx.beginPath();
    ctx.moveTo(C, C + 118 * scale + yShift);
    ctx.bezierCurveTo(
      C - 148 * scale,
      C + 34 * scale + yShift,
      C - 154 * scale,
      C - 102 * scale + yShift,
      C - 66 * scale,
      C - 108 * scale + yShift
    );
    ctx.bezierCurveTo(
      C - 18 * scale,
      C - 112 * scale + yShift,
      C - 2 * scale,
      C - 64 * scale + yShift,
      C,
      C - 44 * scale + yShift
    );
    ctx.bezierCurveTo(
      C + 2 * scale,
      C - 64 * scale + yShift,
      C + 18 * scale,
      C - 112 * scale + yShift,
      C + 66 * scale,
      C - 108 * scale + yShift
    );
    ctx.bezierCurveTo(
      C + 154 * scale,
      C - 102 * scale + yShift,
      C + 148 * scale,
      C + 34 * scale + yShift,
      C,
      C + 118 * scale + yShift
    );
    ctx.closePath();
  };

  for (const [sc, col] of [
    [1.18, "rgba(244, 236, 222, 0.14)"],
    [1.12, "rgba(244, 236, 222, 0.22)"],
    [1.04, "rgba(248, 242, 232, 0.74)"],
    [0.90, "rgba(154, 114, 80, 0.56)"],
    [0.78, "rgba(250, 245, 236, 0.92)"],
    [0.64, "rgba(162, 122, 88, 0.44)"],
    [0.54, "#f7f2e8"],
  ]) {
    ctx.fillStyle = col;
    drawHeartPath(sc, 6 * (1 - sc));
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(250, 245, 236, 0.88)";
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(C, C - 95);
  ctx.lineTo(C, C + 132);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function buildSteamWispTexture() {
  const W = 128;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const env = Math.pow(Math.sin(v * Math.PI), 0.82) * (1.0 - 0.25 * v);
    const cx1 = W * 0.5 + Math.sin(v * Math.PI * 2.15) * 16.0;
    const halfW1 = 13 + 22 * v;
    const g1 = ctx.createLinearGradient(cx1 - halfW1, y, cx1 + halfW1, y);
    g1.addColorStop(0.0, "rgba(255, 251, 243, 0)");
    g1.addColorStop(0.32, `rgba(255, 251, 243, ${(0.42 * env).toFixed(3)})`);
    g1.addColorStop(0.5, `rgba(255, 252, 246, ${(0.82 * env).toFixed(3)})`);
    g1.addColorStop(0.68, `rgba(255, 251, 243, ${(0.42 * env).toFixed(3)})`);
    g1.addColorStop(1.0, "rgba(255, 251, 243, 0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, y, W, 1.6);

    const cx2 = W * 0.5 - Math.cos(v * Math.PI * 1.85 + 0.6) * 12.5;
    const halfW2 = 9 + 16 * v;
    const g2 = ctx.createLinearGradient(cx2 - halfW2, y, cx2 + halfW2, y);
    g2.addColorStop(0.0, "rgba(255, 250, 240, 0)");
    g2.addColorStop(0.5, `rgba(255, 250, 240, ${(0.38 * env).toFixed(3)})`);
    g2.addColorStop(1.0, "rgba(255, 250, 240, 0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, y, W, 1.4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildBoardContactShadowTexture() {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, S, S);
  for (let k = 0; k < 10; k++) {
    const pad = 12 + k * 2.1;
    const w = S - pad * 2;
    const r = Math.max(6, 18 - k * 0.9);
    ctx.fillStyle = "rgba(38, 25, 12, 0.068)";
    ctx.beginPath();
    ctx.roundRect(pad, pad, w, w, r);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function buildRadialContactShadowTexture() {
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(S * 0.5, S * 0.5, S * 0.22, S * 0.5, S * 0.5, S * 0.49);
  g.addColorStop(0.0, "rgba(38, 26, 14, 0.46)");
  g.addColorStop(0.68, "rgba(38, 26, 14, 0.22)");
  g.addColorStop(1.0, "rgba(38, 26, 14, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function buildVehicleContactShadowTexture() {
  const W = 128;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(1, H / W);
  const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, W * 0.48);
  grad.addColorStop(0.0, "rgba(10, 12, 16, 0.72)");
  grad.addColorStop(0.55, "rgba(10, 12, 16, 0.40)");
  grad.addColorStop(0.84, "rgba(10, 12, 16, 0.12)");
  grad.addColorStop(1.0, "rgba(10, 12, 16, 0.0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, W * 0.49, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function buildVehicleHaloTexture() {
  const W = 128;
  const H = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const pad = 12;
  const r = 26;
  const x = pad;
  const y = pad;
  const w = W - pad * 2;
  const h = H - pad * 2;

  const drawRoundedRect = () => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 10;
  drawRoundedRect();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 4;
  drawRoundedRect();
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function buildChevronTexture() {
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(38, 24);
  ctx.lineTo(88, 64);
  ctx.lineTo(38, 104);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function buildMetallicFlakeNormalMap() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  let s = 0x51a7e1;
  for (let i = 0; i < size * size; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const r1 = ((s & 0xff) / 255 - 0.5) * 0.14;
    s = (s * 1664525 + 1013904223) >>> 0;
    const r2 = ((s & 0xff) / 255 - 0.5) * 0.14;
    const idx = i * 4;
    data[idx] = Math.round((r1 * 0.5 + 0.5) * 255);
    data[idx + 1] = Math.round((r2 * 0.5 + 0.5) * 255);
    data[idx + 2] = 255;
    data[idx + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function buildBrakeSpillTexture() {
  const S = 64;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S * 0.48);
  g.addColorStop(0.0, "rgba(255, 42, 28, 0.82)");
  g.addColorStop(0.5, "rgba(255, 28, 18, 0.28)");
  g.addColorStop(1.0, "rgba(255, 20, 14, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function buildOakPlankFloorTexture(sourceTex) {
  const W = 512;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#c7b08e";
  ctx.fillRect(0, 0, W, H);

  const img = sourceTex && sourceTex.image;
  if (img) {
    ctx.globalAlpha = 0.68;
    const tw = W / 2;
    const th = H / 2;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        ctx.drawImage(img, x * tw, y * th, tw + 1, th + 1);
      }
    }
    ctx.globalAlpha = 1.0;
  }

  ctx.fillStyle = "rgba(196, 170, 134, 0.34)";
  ctx.fillRect(0, 0, W, H);

  const planks = 7;
  const rng = mulberry32(0xf10040a4);
  for (let i = 0; i < planks; i++) {
    const py = (i / planks) * H;
    const ph = H / planks;
    ctx.fillStyle =
      rng() > 0.5 ? "rgba(165, 136, 98, 0.08)" : "rgba(232, 212, 182, 0.07)";
    ctx.fillRect(0, py, W, ph);
    if (i > 0) {
      ctx.strokeStyle = "rgba(86, 68, 48, 0.28)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(W, py);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function buildHdrMorningCourtyardWindowTexture() {
  const W = 512;
  const H = 512;
  const data = new Float32Array(W * H * 4);
  const rng = mulberry32(0x9a2de427);

  const discs = [];
  for (let i = 0; i < 84; i++) {
    const pick = rng();
    const kind =
      pick < 0.34
        ? "deep_olive"
        : pick < 0.66
        ? "sunlit_sage"
        : pick < 0.84
        ? "cypress_bough"
        : "sun_bokeh";
    discs.push({
      cx: rng(),
      cy: kind === "sun_bokeh" ? 0.22 + rng() * 0.70 : rng() * 0.86,
      r: kind === "sun_bokeh" ? 0.065 + rng() * 0.085 : 0.065 + rng() * 0.165,
      kind,
      strength: 0.50 + rng() * 0.46,
    });
  }

  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const skyMix = Math.max(0.0, Math.min(1.0, (v - 0.50) / 0.50));
    const wallMix = Math.max(0.0, Math.min(1.0, (v - 0.12) / 0.44));
    const baseR = 0.28 + 0.36 * wallMix + 1.06 * skyMix * skyMix;
    const baseG = 0.29 + 0.33 * wallMix + 1.08 * skyMix * skyMix;
    const baseB = 0.20 + 0.24 * wallMix + 1.08 * skyMix * skyMix;

    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const shaftCoord = (u - 0.18) * 0.72 + (0.82 - v) * 0.68;
      const sunShaft = Math.exp(-shaftCoord * shaftCoord * 6.2) * 0.72;
      const sunCoreDx = u - 0.24;
      const sunCoreDy = v - 0.78;
      const sunCore = Math.exp(-(sunCoreDx * sunCoreDx + sunCoreDy * sunCoreDy) * 10.0) * 0.92;
      const pergolaShade = u > 0.68 && v < 0.64 ? 0.74 : 1.0;

      let pr = (baseR + sunShaft * 0.82 + sunCore * 1.15) * pergolaShade;
      let pg = (baseG + sunShaft * 0.76 + sunCore * 1.05) * pergolaShade;
      let pb = (baseB + sunShaft * 0.56 + sunCore * 0.80) * pergolaShade;

      for (let k = 0; k < discs.length; k++) {
        const d = discs[k];
        const dx = u - d.cx;
        const dy = v - d.cy;
        const d2 = dx * dx + dy * dy;
        const r2 = d.r * d.r;
        if (d2 < r2) {
          const norm = 1.0 - d2 / r2;
          const w = norm * norm * (3.0 - 2.0 * norm) * d.strength;
          if (d.kind === "deep_olive") {
            pr = pr * (1.0 - w * 0.72) + 0.17 * w;
            pg = pg * (1.0 - w * 0.68) + 0.21 * w;
            pb = pb * (1.0 - w * 0.76) + 0.11 * w;
          } else if (d.kind === "cypress_bough") {
            pr = pr * (1.0 - w * 0.62) + 0.25 * w;
            pg = pg * (1.0 - w * 0.58) + 0.29 * w;
            pb = pb * (1.0 - w * 0.66) + 0.16 * w;
          } else if (d.kind === "sunlit_sage") {
            pr = pr * (1.0 - w * 0.54) + 0.50 * w;
            pg = pg * (1.0 - w * 0.48) + 0.54 * w;
            pb = pb * (1.0 - w * 0.58) + 0.32 * w;
          } else {
            const bokehDisc = norm * norm * d.strength;
            pr += bokehDisc * 0.78;
            pg += bokehDisc * 0.72;
            pb += bokehDisc * 0.50;
          }
        }
      }

      const idx = (y * W + x) * 4;
      data[idx] = pr;
      data[idx + 1] = pg;
      data[idx + 2] = pb;
      data[idx + 3] = 1.0;
    }
  }

  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Finite Sculpted European White-Oak Dining Table Slab Geometry.
 */
function createSculptedChamferedOakSlabGeometry(
  xMin,
  xMax,
  zMin,
  zMax,
  topBevel = 0.22,
  fasciaDrop = 1.05,
  totalThick = 2.80
) {
  const cFR = 2.40;
  const cStd = 0.80;

  const outerRing = [
    [xMin + cStd, zMax],
    [xMax - cFR, zMax],
    [xMax, zMax - cFR],
    [xMax, zMin + cStd],
    [xMax - cStd, zMin],
    [xMin + cStd, zMin],
    [xMin, zMin + cStd],
    [xMin, zMax - cStd],
  ];

  const buildInsetRing = (dist) => {
    if (dist <= 0) return outerRing.map(([x, z]) => [x, z]);
    const n = outerRing.length;
    const edgeNormals = [];
    for (let i = 0; i < n; i++) {
      const a = outerRing[i];
      const b = outerRing[(i + 1) % n];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz) || 1;
      edgeNormals.push([-dz / len, dx / len]);
    }
    const res = [];
    for (let i = 0; i < n; i++) {
      const nPrev = edgeNormals[(i + n - 1) % n];
      const nCur = edgeNormals[i];
      let mx = nPrev[0] + nCur[0];
      let mz = nPrev[1] + nCur[1];
      const mLen = Math.hypot(mx, mz) || 1;
      mx /= mLen;
      mz /= mLen;
      const cosHalf = Math.max(0.5, mx * nCur[0] + mz * nCur[1]);
      const step = dist / cosHalf;
      res.push([outerRing[i][0] - mx * step, outerRing[i][1] - mz * step]);
    }
    return res;
  };

  const topRing = buildInsetRing(topBevel);
  const midUpperRing = buildInsetRing(0.0);
  const midLowerRing = buildInsetRing(0.0);
  const botRing = buildInsetRing(totalThick - fasciaDrop);

  const yTop = 0.0;
  const yBevel = -topBevel;
  const yFascia = -fasciaDrop;
  const yBot = -totalThick;

  const positions = [];
  const normals = [];
  const uvs = [];

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpN = new THREE.Vector3();

  const pushQuad = (p0, p1, p2, p3, uv0, uv1, uv2, uv3) => {
    tmpA.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    tmpB.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    tmpN.crossVectors(tmpA, tmpB).normalize();
    for (const [pt, uv] of [
      [p0, uv0],
      [p1, uv1],
      [p2, uv2],
      [p0, uv0],
      [p2, uv2],
      [p3, uv3],
    ]) {
      positions.push(pt[0], pt[1], pt[2]);
      normals.push(tmpN.x, tmpN.y, tmpN.z);
      uvs.push(uv[0], uv[1]);
    }
  };

  const pushTri = (p0, p1, p2, uv0, uv1, uv2) => {
    tmpA.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    tmpB.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    tmpN.crossVectors(tmpA, tmpB).normalize();
    for (const [pt, uv] of [
      [p0, uv0],
      [p1, uv1],
      [p2, uv2],
    ]) {
      positions.push(pt[0], pt[1], pt[2]);
      normals.push(tmpN.x, tmpN.y, tmpN.z);
      uvs.push(uv[0], uv[1]);
    }
  };

  const uScale = 2.6 / Math.max(1, xMax - xMin);
  const vScale = 2.0 / Math.max(1, zMax - zMin);
  const topUv = (x, z) => [(x - xMin) * uScale, (zMax - z) * vScale];

  const cx = (xMin + xMax) * 0.5;
  const cz = (zMin + zMax) * 0.5;

  const n = topRing.length;
  for (let i = 0; i < n; i++) {
    const a = topRing[i];
    const b = topRing[(i + 1) % n];
    pushTri([cx, yTop, cz], [a[0], yTop, a[1]], [b[0], yTop, b[1]], topUv(cx, cz), topUv(a[0], a[1]), topUv(b[0], b[1]));
  }

  for (let i = 0; i < n; i++) {
    const a = botRing[i];
    const b = botRing[(i + 1) % n];
    pushTri([cx, yBot, cz], [b[0], yBot, b[1]], [a[0], yBot, a[1]], topUv(cx, cz), topUv(b[0], b[1]), topUv(a[0], a[1]));
  }

  let arcDist = 0.0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const segLen = Math.hypot(midUpperRing[j][0] - midUpperRing[i][0], midUpperRing[j][1] - midUpperRing[i][1]);
    const u0 = arcDist * 0.032;
    const u1 = (arcDist + segLen) * 0.032;
    arcDist += segLen;

    pushQuad(
      [midUpperRing[i][0], yBevel, midUpperRing[i][1]],
      [midUpperRing[j][0], yBevel, midUpperRing[j][1]],
      [topRing[j][0], yTop, topRing[j][1]],
      [topRing[i][0], yTop, topRing[i][1]],
      topUv(midUpperRing[i][0], midUpperRing[i][1]),
      topUv(midUpperRing[j][0], midUpperRing[j][1]),
      topUv(topRing[j][0], topRing[j][1]),
      topUv(topRing[i][0], topRing[i][1])
    );

    pushQuad(
      [midLowerRing[i][0], yFascia, midLowerRing[i][1]],
      [midLowerRing[j][0], yFascia, midLowerRing[j][1]],
      [midUpperRing[j][0], yBevel, midUpperRing[j][1]],
      [midUpperRing[i][0], yBevel, midUpperRing[i][1]],
      [u0, 0.08],
      [u1, 0.08],
      [u1, 0.13],
      [u0, 0.13]
    );

    pushQuad(
      [botRing[i][0], yBot, botRing[i][1]],
      [botRing[j][0], yBot, botRing[j][1]],
      [midLowerRing[j][0], yFascia, midLowerRing[j][1]],
      [midLowerRing[i][0], yFascia, midLowerRing[i][1]],
      [u0, 0.01],
      [u1, 0.01],
      [u1, 0.08],
      [u0, 0.08]
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("uv1", new THREE.Float32BufferAttribute(uvs.slice(), 2));
  return geo;
}

function makeNonIndexedTransformedGeo(baseGeo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, uvShift = null } = {}) {
  const g = baseGeo.index ? baseGeo.toNonIndexed() : baseGeo.clone();
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  if (x || y || z) g.translate(x, y, z);
  if (uvShift && g.attributes.uv) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * uvShift.su + uvShift.ou, uv.getY(i) * uvShift.sv + uvShift.ov);
    }
  }
  for (const key of Object.keys(g.attributes)) {
    if (key !== "position" && key !== "normal" && key !== "uv") {
      g.deleteAttribute(key);
    }
  }
  baseGeo.dispose();
  return g;
}

function createBeveledDoorGeometry(w, h, d, bevel = 0.14, uvShift = null) {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const hd = d * 0.5;
  const iw = Math.max(0.1, hw - bevel);
  const ih = Math.max(0.1, hh - bevel);
  const zBack = -hd;
  const zMid = hd - bevel;
  const zFront = hd;

  const positions = [];
  const normals = [];
  const uvs = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const n = new THREE.Vector3();

  const mapUv = (px, py) => {
    let u = (px + hw) / Math.max(0.1, w);
    let v = (py + hh) / Math.max(0.1, h);
    if (uvShift) {
      u = u * uvShift.su + uvShift.ou;
      v = v * uvShift.sv + uvShift.ov;
    }
    return [u, v];
  };

  const quad = (p0, p1, p2, p3) => {
    a.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
    b.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    n.crossVectors(a, b).normalize();
    for (const pt of [p0, p1, p2, p0, p2, p3]) {
      positions.push(pt[0], pt[1], pt[2]);
      normals.push(n.x, n.y, n.z);
      const [u, v] = mapUv(pt[0], pt[1]);
      uvs.push(u, v);
    }
  };

  quad([-iw, -ih, zFront], [iw, -ih, zFront], [iw, ih, zFront], [-iw, ih, zFront]);
  quad([-hw, -hh, zMid], [hw, -hh, zMid], [iw, -ih, zFront], [-iw, -ih, zFront]);
  quad([-iw, ih, zFront], [iw, ih, zFront], [hw, hh, zMid], [-hw, hh, zMid]);
  quad([iw, -ih, zFront], [hw, -hh, zMid], [hw, hh, zMid], [iw, ih, zFront]);
  quad([-hw, -hh, zMid], [-iw, -ih, zFront], [-iw, ih, zFront], [-hw, hh, zMid]);
  quad([-hw, -hh, zBack], [hw, -hh, zBack], [hw, -hh, zMid], [-hw, -hh, zMid]);
  quad([hw, hh, zBack], [-hw, hh, zBack], [-hw, hh, zMid], [hw, hh, zMid]);
  quad([hw, -hh, zBack], [hw, hh, zBack], [hw, hh, zMid], [hw, -hh, zMid]);
  quad([-hw, hh, zBack], [-hw, -hh, zBack], [-hw, -hh, zMid], [-hw, hh, zMid]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

/**
 * Builds the sunlit Scandinavian architectural kitchen room (`floorY = -52.0`).
 */
function buildScandinavianKitchenArchitecture({
  floorOakTex,
  cabOakTex,
  cabOakRoughTex,
  cabOakNormalTex,
  limestoneTex,
  envTexture,
  radialAoTex,
}) {
  const kitchenRoot = new THREE.Group();
  kitchenRoot.name = "ScandinavianKitchenEnvironment";

  const FLOOR_Y = -52.0;
  const CEIL_Y = 76.0;
  const REAR_GROUP_Z = -19.2;
  const REAR_WALL_Z = -38.0;

  if (floorOakTex) floorOakTex.anisotropy = 2;
  const oakFloorMat = createCalibratedPBR("weathered_limestone", {
    color: 0xf6f0e6,
    map: floorOakTex,
    roughnessMap: cabOakRoughTex || null,
    roughness: 0.58,
    metalness: 0.0,
    envMap: envTexture,
    envMapIntensity: 0.34,
    goboWeight: 0.55,
  });

  const plasterWallMat = createCalibratedPBR("limewash_plaster", {
    color: 0xd8cfc2,
    roughness: 0.88,
    metalness: 0.0,
    envMap: envTexture,
    envMapIntensity: 0.26,
    goboWeight: 0.35,
  });

  const plasterRevealMat = createCalibratedPBR("limewash_plaster", {
    color: 0xf4ece0,
    roughness: 0.80,
    metalness: 0.0,
    envMap: envTexture,
    envMapIntensity: 0.42,
    goboWeight: 0.45,
  });

  const bronzeMullionMat = createCalibratedPBR("architectural_bronze", {
    color: 0x2c2824,
    roughness: 0.36,
    metalness: 0.78,
    envMap: envTexture,
    envMapIntensity: 0.92,
    goboWeight: 0.0,
  });

  const windowGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xf6faf8,
    roughness: 0.03,
    metalness: 0.06,
    ior: 1.52,
    reflectivity: 0.94,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    envMap: envTexture,
    envMapIntensity: 1.05,
  });

  const hdrGardenTex = buildHdrMorningCourtyardWindowTexture();
  const hdrGardenMat = new THREE.MeshBasicMaterial({
    map: hdrGardenTex,
    toneMapped: true,
  });

  const cabinetOakMat = createCalibratedPBR("weathered_limestone", {
    color: 0xf6f2ec,
    map: cabOakTex,
    normalMap: cabOakNormalTex || null,
    normalScale: new THREE.Vector2(0.36, 0.36),
    roughnessMap: cabOakRoughTex || null,
    roughness: 0.54,
    metalness: 0.0,
    envMap: envTexture,
    envMapIntensity: 0.40,
    goboWeight: 0.4,
  });

  const shadowGapMat = new THREE.MeshStandardMaterial({
    color: 0x4e3e31,
    roughness: 0.88,
    metalness: 0.0,
    envMap: envTexture,
    envMapIntensity: 0.56,
    emissive: new THREE.Color(0x281f17),
    emissiveIntensity: 0.42,
  });
  injectWorldCohesionHook(shadowGapMat, { bounceWeight: 1.0, goboWeight: 0.15 });

  const limestoneMat = createCalibratedPBR("honed_limestone", {
    color: 0xe6dfd2,
    map: limestoneTex,
    roughness: 0.54,
    metalness: 0.0,
    envMap: envTexture,
    envMapIntensity: 0.46,
    goboWeight: 0.45,
  });

  const brushedNickelMat = new THREE.MeshPhysicalMaterial({
    color: 0xcbc7be,
    roughness: 0.26,
    metalness: 0.90,
    clearcoat: 0.22,
    clearcoatRoughness: 0.24,
    envMap: envTexture,
    envMapIntensity: 0.95,
  });

  const vesselOatMat = createCalibratedPBR("weathered_limestone", {
    color: 0xded6c8,
    roughness: 0.68,
    metalness: 0.0,
    envMap: envTexture,
    envMapIntensity: 0.36,
    goboWeight: 0.25,
  });

  const vesselClayMat = createCalibratedPBR("weathered_limestone", {
    color: 0xba9674,
    roughness: 0.76,
    metalness: 0.0,
    envMap: envTexture,
    envMapIntensity: 0.32,
    goboWeight: 0.25,
  });

  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(360, 280), oakFloorMat);
  floorMesh.name = "KitchenOakPlankFloor";
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(10.0, FLOOR_Y, -24.0);
  floorMesh.receiveShadow = true;
  kitchenRoot.add(floorMesh);

  const rearWallGroup = new THREE.Group();
  rearWallGroup.name = "KitchenRearNorthWall";
  rearWallGroup.position.z = REAR_GROUP_Z;
  kitchenRoot.add(rearWallGroup);

  const WIN_X0 = -36.5;
  const WIN_X1 = -2.5;
  const WIN_SILL_Y = -4.20;
  const WIN_TOP_Y = 28.0;
  const WIN_W = WIN_X1 - WIN_X0;
  const WIN_H = WIN_TOP_Y - WIN_SILL_Y;
  const WIN_CX = (WIN_X0 + WIN_X1) * 0.5;
  const WIN_CY = (WIN_SILL_Y + WIN_TOP_Y) * 0.5;
  const WALL_THICK = 3.6;

  const wallGeos = [
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(120.0, CEIL_Y - FLOOR_Y, WALL_THICK), {
      x: WIN_X0 - 60.0,
      y: (FLOOR_Y + CEIL_Y) * 0.5,
      z: REAR_WALL_Z,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(180.0, CEIL_Y - FLOOR_Y, WALL_THICK), {
      x: WIN_X1 + 90.0,
      y: (FLOOR_Y + CEIL_Y) * 0.5,
      z: REAR_WALL_Z,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(WIN_W, WIN_SILL_Y - FLOOR_Y, WALL_THICK), {
      x: WIN_CX,
      y: (FLOOR_Y + WIN_SILL_Y) * 0.5,
      z: REAR_WALL_Z,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(WIN_W, CEIL_Y - WIN_TOP_Y, WALL_THICK), {
      x: WIN_CX,
      y: (WIN_TOP_Y + CEIL_Y) * 0.5,
      z: REAR_WALL_Z,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(3.5, CEIL_Y - FLOOR_Y, 200.0), {
      x: -154.0,
      y: (FLOOR_Y + CEIL_Y) * 0.5,
      z: 36.0,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(3.5, CEIL_Y - FLOOR_Y, 200.0), {
      x: 172.0,
      y: (FLOOR_Y + CEIL_Y) * 0.5,
      z: 36.0,
    }),
  ];
  const mergedWallMesh = new THREE.Mesh(mergeGeometries(wallGeos, false), plasterWallMat);
  mergedWallMesh.name = "KitchenPlasterWalls";
  mergedWallMesh.castShadow = true;
  mergedWallMesh.receiveShadow = true;
  rearWallGroup.add(mergedWallMesh);

  const REVEAL_DEPTH = 4.8;
  const revealGeos = [
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(0.55, WIN_H, REVEAL_DEPTH), {
      x: WIN_X0 + 0.275,
      y: WIN_CY,
      z: REAR_WALL_Z + 0.55,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(0.55, WIN_H, REVEAL_DEPTH), {
      x: WIN_X1 - 0.275,
      y: WIN_CY,
      z: REAR_WALL_Z + 0.55,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(WIN_W, 0.55, REVEAL_DEPTH), {
      x: WIN_CX,
      y: WIN_TOP_Y - 0.275,
      z: REAR_WALL_Z + 0.55,
    }),
  ];
  const revealMesh = new THREE.Mesh(mergeGeometries(revealGeos, false), plasterRevealMat);
  revealMesh.name = "KitchenSunlitWindowReveal";
  revealMesh.castShadow = true;
  revealMesh.receiveShadow = true;
  rearWallGroup.add(revealMesh);

  const SILL_THICK = 0.95;
  const SILL_DEPTH = 5.10;
  const sillMesh = new THREE.Mesh(
    new THREE.BoxGeometry(WIN_W + 2.4, SILL_THICK, SILL_DEPTH),
    limestoneMat
  );
  sillMesh.name = "KitchenLimestoneWindowsill";
  sillMesh.position.set(WIN_CX, WIN_SILL_Y - SILL_THICK * 0.5, REAR_WALL_Z + 2.25);
  sillMesh.castShadow = true;
  sillMesh.receiveShadow = true;
  rearWallGroup.add(sillMesh);

  const MULLION_Z = REAR_WALL_Z - 0.35;
  const mullionGeos = [
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(WIN_W, 0.72, 0.75), {
      x: WIN_CX,
      y: WIN_TOP_Y - 0.36,
      z: MULLION_Z,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(WIN_W, 0.72, 0.75), {
      x: WIN_CX,
      y: WIN_SILL_Y + 0.36,
      z: MULLION_Z,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(0.72, WIN_H, 0.75), {
      x: WIN_X0 + 0.36,
      y: WIN_CY,
      z: MULLION_Z,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(0.72, WIN_H, 0.75), {
      x: WIN_X1 - 0.36,
      y: WIN_CY,
      z: MULLION_Z,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(0.62, WIN_H, 0.68), {
      x: WIN_CX + 2.2,
      y: WIN_CY,
      z: MULLION_Z,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(WIN_W, 0.52, 0.62), {
      x: WIN_CX,
      y: WIN_SILL_Y + WIN_H * 0.64,
      z: MULLION_Z,
    }),
  ];
  const mullionMesh = new THREE.Mesh(mergeGeometries(mullionGeos, false), bronzeMullionMat);
  mullionMesh.name = "KitchenBronzeWindowMullions";
  mullionMesh.castShadow = true;
  mullionMesh.receiveShadow = true;
  rearWallGroup.add(mullionMesh);

  const glassPaneMesh = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W - 1.2, WIN_H - 1.2), windowGlassMat);
  glassPaneMesh.name = "KitchenWindowGlass";
  glassPaneMesh.position.set(WIN_CX, WIN_CY, MULLION_Z + 0.12);
  glassPaneMesh.castShadow = false;
  rearWallGroup.add(glassPaneMesh);

  const gardenBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W + 10.0, WIN_H + 10.0), hdrGardenMat);
  gardenBackdrop.name = "KitchenMorningGardenBackdrop";
  gardenBackdrop.position.set(WIN_CX, WIN_CY + 0.5, REAR_WALL_Z - 3.6);
  rearWallGroup.add(gardenBackdrop);

  const cabGroup = new THREE.Group();
  cabGroup.name = "KitchenLowerCabinetryGroup";
  rearWallGroup.add(cabGroup);

  const CAB_X0 = 6.8;
  const CAB_X1 = 84.8;
  const CAB_W = CAB_X1 - CAB_X0;
  const CAB_CX = (CAB_X0 + CAB_X1) * 0.5;
  const CAB_DEPTH = 4.60;
  const CAB_FRONT_Z = REAR_WALL_Z + WALL_THICK * 0.5 + CAB_DEPTH;
  const COUNTER_TOP = -2.40;
  const SLAB_THICK = 1.26;
  const SLAB_OVERHANG = 1.26;
  const TOE_KICK_TOP = FLOOR_Y + 3.8;
  const CARCASS_TOP = COUNTER_TOP - SLAB_THICK;

  const shadowGapGeos = [
    makeNonIndexedTransformedGeo(
      new THREE.BoxGeometry(CAB_W - 1.2, TOE_KICK_TOP - FLOOR_Y, CAB_DEPTH - 0.9),
      {
        x: CAB_CX,
        y: (FLOOR_Y + TOE_KICK_TOP) * 0.5,
        z: CAB_FRONT_Z - (CAB_DEPTH + 0.9) * 0.5,
      }
    ),
    makeNonIndexedTransformedGeo(
      new THREE.BoxGeometry(CAB_W - 0.4, CARCASS_TOP - TOE_KICK_TOP, CAB_DEPTH - 0.36),
      {
        x: CAB_CX,
        y: (TOE_KICK_TOP + CARCASS_TOP) * 0.5,
        z: CAB_FRONT_Z - (CAB_DEPTH + 0.36) * 0.5,
      }
    ),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(CAB_W - 0.4, 0.55, 0.55), {
      x: CAB_CX,
      y: CARCASS_TOP - 0.28,
      z: CAB_FRONT_Z - 0.22,
    }),
  ];
  const shadowGapMesh = new THREE.Mesh(mergeGeometries(shadowGapGeos, false), shadowGapMat);
  shadowGapMesh.name = "KitchenCredenzaShadowChannels";
  shadowGapMesh.castShadow = true;
  shadowGapMesh.receiveShadow = true;
  cabGroup.add(shadowGapMesh);

  const NUM_BAYS = 3;
  const GAP_U = 0.26;
  const bayWidth = (CAB_W - GAP_U * (NUM_BAYS + 1)) / NUM_BAYS;
  const doorHeight = CARCASS_TOP - TOE_KICK_TOP - 0.62;
  const doorCY = TOE_KICK_TOP + doorHeight * 0.5;
  const doorRng = mulberry32(0x3ba90a4);
  const cabOakGeos = [
    makeNonIndexedTransformedGeo(
      new THREE.BoxGeometry(0.65, CARCASS_TOP - FLOOR_Y, CAB_DEPTH + 0.20),
      {
        x: CAB_X0 + 0.325,
        y: (FLOOR_Y + CARCASS_TOP) * 0.5,
        z: CAB_FRONT_Z - (CAB_DEPTH + 0.20) * 0.5,
        uvShift: { su: 0.5, sv: 1.1, ou: 0.11, ov: 0.07 },
      }
    ),
  ];

  for (let b = 0; b < NUM_BAYS; b++) {
    const bx = CAB_X0 + GAP_U + bayWidth * 0.5 + b * (bayWidth + GAP_U);
    const uvShift = {
      su: 0.58 + doorRng() * 0.16,
      sv: 0.82 + doorRng() * 0.16,
      ou: doorRng() * 0.73 + b * 0.29,
      ov: doorRng() * 0.61 + b * 0.19,
    };
    const doorGeo = createBeveledDoorGeometry(bayWidth, doorHeight, 0.44, 0.15, uvShift);
    const uvAttr = doorGeo.attributes.uv;
    for (let k = 0; k < uvAttr.count; k++) {
      uvAttr.setXY(k, uvAttr.getY(k), uvAttr.getX(k));
    }
    doorGeo.translate(bx, doorCY, CAB_FRONT_Z + 0.06);
    cabOakGeos.push(doorGeo);
  }

  const credenzaDoorsMesh = new THREE.Mesh(mergeGeometries(cabOakGeos, false), cabinetOakMat);
  credenzaDoorsMesh.name = "KitchenRiftOakCredenzaBays";
  credenzaDoorsMesh.castShadow = true;
  credenzaDoorsMesh.receiveShadow = true;
  cabGroup.add(credenzaDoorsMesh);

  const slabDepth = CAB_DEPTH + SLAB_OVERHANG;
  const limestoneGeos = [
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(CAB_W + 1.0, SLAB_THICK, slabDepth), {
      x: CAB_CX,
      y: COUNTER_TOP - SLAB_THICK * 0.5,
      z: CAB_FRONT_Z + SLAB_OVERHANG - slabDepth * 0.5,
    }),
    makeNonIndexedTransformedGeo(new THREE.BoxGeometry(CAB_W + 1.0, 6.2, 0.55), {
      x: CAB_CX,
      y: COUNTER_TOP + 3.1,
      z: REAR_WALL_Z + WALL_THICK * 0.5 + 0.275,
    }),
  ];
  const counterSlabMesh = new THREE.Mesh(mergeGeometries(limestoneGeos, false), limestoneMat);
  counterSlabMesh.name = "KitchenLimestoneCounterSlab";
  counterSlabMesh.castShadow = true;
  counterSlabMesh.receiveShadow = true;
  cabGroup.add(counterSlabMesh);

  const FAUCET_X = 43.5;
  const FAUCET_Z = CAB_FRONT_Z - 2.35;
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(FAUCET_X, COUNTER_TOP + 1.9, FAUCET_Z),
    new THREE.Vector3(FAUCET_X, COUNTER_TOP + 6.4, FAUCET_Z),
    new THREE.Vector3(FAUCET_X, COUNTER_TOP + 8.2, FAUCET_Z + 0.95),
    new THREE.Vector3(FAUCET_X, COUNTER_TOP + 7.4, FAUCET_Z + 2.35),
    new THREE.Vector3(FAUCET_X, COUNTER_TOP + 5.7, FAUCET_Z + 2.55),
  ]);
  const faucetGeos = [
    makeNonIndexedTransformedGeo(new THREE.CylinderGeometry(0.82, 0.94, 0.26, 24), {
      x: FAUCET_X,
      y: COUNTER_TOP + 0.13,
      z: FAUCET_Z,
    }),
    makeNonIndexedTransformedGeo(new THREE.CylinderGeometry(0.52, 0.56, 2.05, 24), {
      x: FAUCET_X,
      y: COUNTER_TOP + 1.15,
      z: FAUCET_Z,
    }),
    makeNonIndexedTransformedGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.68, 18), {
      x: FAUCET_X + 0.62,
      y: COUNTER_TOP + 1.32,
      z: FAUCET_Z,
      rz: Math.PI * 0.5,
    }),
    makeNonIndexedTransformedGeo(new THREE.CylinderGeometry(0.09, 0.10, 1.85, 14), {
      x: FAUCET_X + 0.88,
      y: COUNTER_TOP + 2.15,
      z: FAUCET_Z + 0.18,
      rx: 0.22,
    }),
    makeNonIndexedTransformedGeo(new THREE.TubeGeometry(spoutCurve, 28, 0.28, 16, false), {}),
    makeNonIndexedTransformedGeo(new THREE.CylinderGeometry(0.30, 0.27, 0.24, 18), {
      x: FAUCET_X,
      y: COUNTER_TOP + 5.62,
      z: FAUCET_Z + 2.55,
    }),
  ];
  const faucetMesh = new THREE.Mesh(mergeGeometries(faucetGeos, false), brushedNickelMat);
  faucetMesh.name = "KitchenBrushedNickelFaucet";
  faucetMesh.castShadow = true;
  faucetMesh.receiveShadow = true;
  cabGroup.add(faucetMesh);

  const vesselAoMat = new THREE.MeshBasicMaterial({
    map: radialAoTex,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });

  const oatProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.45, 0.0),
    new THREE.Vector2(1.88, 1.4),
    new THREE.Vector2(1.96, 3.6),
    new THREE.Vector2(1.42, 5.8),
    new THREE.Vector2(1.18, 7.1),
    new THREE.Vector2(1.30, 7.45),
    new THREE.Vector2(1.06, 7.45),
    new THREE.Vector2(0.98, 5.8),
  ];
  const oatVessel = new THREE.Mesh(new THREE.LatheGeometry(oatProfile, 28), vesselOatMat);
  oatVessel.name = "KitchenStonewarePitcher";
  oatVessel.position.set(22.8, COUNTER_TOP, CAB_FRONT_Z - 1.85);
  oatVessel.castShadow = true;
  oatVessel.receiveShadow = true;
  cabGroup.add(oatVessel);

  const clayProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.55, 0.0),
    new THREE.Vector2(2.05, 1.8),
    new THREE.Vector2(2.15, 4.4),
    new THREE.Vector2(1.95, 5.2),
    new THREE.Vector2(1.75, 4.4),
    new THREE.Vector2(0.0, 0.6),
  ];
  const clayBowl = new THREE.Mesh(new THREE.LatheGeometry(clayProfile, 28), vesselClayMat);
  clayBowl.name = "KitchenStonewareBowl";
  clayBowl.position.set(28.2, COUNTER_TOP, CAB_FRONT_Z - 1.65);
  clayBowl.castShadow = true;
  clayBowl.receiveShadow = true;
  cabGroup.add(clayBowl);

  const vesselAoGeos = [
    [22.8, CAB_FRONT_Z - 1.85, 3.8],
    [28.2, CAB_FRONT_Z - 1.65, 4.2],
    [FAUCET_X, FAUCET_Z, 2.2],
  ].map(([vx, vz, r]) =>
    makeNonIndexedTransformedGeo(new THREE.PlaneGeometry(r, r), {
      x: vx,
      y: COUNTER_TOP + 0.015,
      z: vz,
      rx: -Math.PI * 0.5,
    })
  );
  const mergedVesselAo = new THREE.Mesh(mergeGeometries(vesselAoGeos, false), vesselAoMat);
  mergedVesselAo.name = "KitchenCounterVesselContactAO";
  mergedVesselAo.raycast = () => {};
  cabGroup.add(mergedVesselAo);

  return {
    kitchenRoot,
    floorY: FLOOR_Y,
    windowsillMesh: sillMesh,
    cabinetGroup: cabGroup,
    sillWorldY: WIN_SILL_Y,
    planterAnchorWorld: new THREE.Vector3(-11.8, WIN_SILL_Y, REAR_GROUP_Z + REAR_WALL_Z + 2.25),
  };
}

/**
 * Procedural fallback 1:64 vehicle builder (used only if GLB decode fails).
 */
function buildProceduralFallbackVehicle(classKey, bodyMat, glassMat, wheelMat, brakeMat) {
  const spec = VEHICLE_CLASSES[classKey] || VEHICLE_CLASSES.sedan;
  const root = new THREE.Group();
  const bodyRig = new THREE.Group();
  bodyRig.name = "BodyRig";
  root.add(bodyRig);

  const chassis = new THREE.Group();
  chassis.name = "Chassis";
  bodyRig.add(chassis);

  const bodyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(spec.widthMeters * 0.94, spec.heightMeters * 0.54, spec.lengthMeters * 0.96),
    bodyMat
  );
  bodyMesh.position.y = spec.wheelRadius + spec.heightMeters * 0.24;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  chassis.add(bodyMesh);

  const cabinMesh = new THREE.Mesh(
    new THREE.BoxGeometry(spec.widthMeters * 0.78, spec.heightMeters * 0.36, spec.lengthMeters * 0.52),
    glassMat
  );
  cabinMesh.position.set(0, spec.wheelRadius + spec.heightMeters * 0.62, -spec.lengthMeters * 0.04);
  chassis.add(cabinMesh);

  const tailLight = new THREE.Mesh(
    new THREE.BoxGeometry(spec.widthMeters * 0.82, 0.12, 0.08),
    brakeMat
  );
  tailLight.position.set(0, spec.wheelRadius + 0.26, -spec.lengthMeters * 0.48);
  chassis.add(tailLight);

  const wheels = [];
  const halfTrack = spec.widthMeters * 0.43;
  const wheelGeo = new THREE.CylinderGeometry(spec.wheelRadius, spec.wheelRadius, 0.22, 20);
  wheelGeo.rotateZ(Math.PI * 0.5);
  for (const [nm, sx, sz] of [
    ["Wheel_FL", halfTrack, spec.frontAxleOffset],
    ["Wheel_FR", -halfTrack, spec.frontAxleOffset],
    ["Wheel_RL", halfTrack, -spec.rearAxleOffset],
    ["Wheel_RR", -halfTrack, -spec.rearAxleOffset],
  ]) {
    const wPivot = new THREE.Group();
    wPivot.name = nm;
    wPivot.position.set(sx, spec.wheelRadius, sz);
    const wm = new THREE.Mesh(wheelGeo, wheelMat);
    wm.castShadow = true;
    wPivot.add(wm);
    bodyRig.add(wPivot);
    wheels.push(wPivot);
  }

  return { root, bodyRig, chassis, wheels, brakeMeshes: [tailLight] };
}

function resolveGlbDecoder(mod, preferredName) {
  if (mod && typeof mod[preferredName] === "function") return mod[preferredName];
  if (mod && typeof mod.decodeGlbBuffer === "function") return mod.decodeGlbBuffer;
  if (mod) {
    for (const key of Object.keys(mod)) {
      if (typeof mod[key] === "function" && /^decode.*GlbBuffer$/i.test(key)) {
        return mod[key];
      }
    }
  }
  return null;
}

function prepareBakedGlbMaps(origMat, maxAniso = 8) {
  if (!origMat) {
    return {
      map: null,
      normalMap: null,
      roughnessMap: null,
      metalnessMap: null,
      aoMap: null,
      hasAnyBakedMap: false,
    };
  }
  const map = origMat.map || null;
  const normalMap = origMat.normalMap || null;
  const roughnessMap = origMat.roughnessMap || null;
  const metalnessMap = origMat.metalnessMap || null;
  const aoMap = origMat.aoMap || null;
  const targetAniso = Math.max(1, Number(maxAniso) || 8);

  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.max(map.anisotropy || 1, targetAniso);
    map.needsUpdate = true;
  }
  for (const dataTex of [normalMap, roughnessMap, metalnessMap, aoMap]) {
    if (dataTex) {
      dataTex.anisotropy = Math.max(dataTex.anisotropy || 1, targetAniso);
      dataTex.needsUpdate = true;
    }
  }
  if (aoMap) {
    aoMap.channel = 0;
  }

  return {
    map,
    normalMap,
    roughnessMap,
    metalnessMap,
    aoMap,
    hasAnyBakedMap: Boolean(map || normalMap || roughnessMap || metalnessMap || aoMap),
  };
}

function ensureGeometryUv1(geom) {
  if (!geom || !geom.attributes) return;
  if (geom.attributes.uv && !geom.attributes.uv1) {
    geom.setAttribute("uv1", geom.attributes.uv);
  }
}

const _grayscaleMapCache = new WeakMap();
function isNeutralGrayscaleMap(tex) {
  if (!tex) return false;
  if (_grayscaleMapCache.has(tex)) return _grayscaleMapCache.get(tex);
  const img = tex.image;
  if (!img || !img.width || !img.height) {
    _grayscaleMapCache.set(tex, false);
    return false;
  }
  try {
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, 8, 8);
    const d = ctx.getImageData(0, 0, 8, 8).data;
    let maxChroma = 0;
    let avgLum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255;
      const g = d[i + 1] / 255;
      const b = d[i + 2] / 255;
      maxChroma = Math.max(maxChroma, Math.max(r, g, b) - Math.min(r, g, b));
      avgLum += (r + g + b) / 3;
    }
    avgLum /= 64;
    const res = maxChroma < 0.08 && avgLum > 0.72;
    _grayscaleMapCache.set(tex, res);
    return res;
  } catch (_) {
    _grayscaleMapCache.set(tex, false);
    return false;
  }
}

function probeWebGL2Support() {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return { available: false, isSoftwareGl: false };
  }
  try {
    const probeCanvas = document.createElement("canvas");
    probeCanvas.width = 1;
    probeCanvas.height = 1;
    const pgl = probeCanvas.getContext("webgl2");
    if (!pgl) {
      return { available: false, isSoftwareGl: false };
    }
    let isSoftwareGl = false;
    try {
      const dbg = pgl.getExtension("WEBGL_debug_renderer_info");
      const rendererInfo = String(
        dbg ? pgl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : pgl.getParameter(pgl.RENDERER)
      );
      isSoftwareGl = /swiftshader|llvmpipe|lavapipe|\blvp\b|mesa.*vulkan|software|mesa offscreen/i.test(rendererInfo);
    } catch (_) {}
    try {
      const loseExt = pgl.getExtension("WEBGL_lose_context");
      if (loseExt) loseExt.loseContext();
    } catch (_) {}
    return { available: true, isSoftwareGl };
  } catch (_) {
    return { available: false, isSoftwareGl: false };
  }
}

function createUnavailableWebGLFallback(canvas) {
  console.warn("[world] WebGL2 graphics context unavailable; rendering 2D fallback notice.");
  if (canvas && typeof canvas.getContext === "function") {
    try {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const w = Math.max(320, canvas.width || canvas.clientWidth || 960);
        const h = Math.max(180, canvas.height || canvas.clientHeight || 540);
        canvas.width = w;
        canvas.height = h;
        ctx.fillStyle = "#eae2d6";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#2b241d";
        ctx.font = "600 18px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("3D WebGL2 view unavailable on this browser or GPU.", w / 2, h / 2 - 8);
        ctx.font = "400 13px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = "#5c5044";
        ctx.fillText("Enable WebGL2 hardware acceleration to play the 3D tabletop view.", w / 2, h / 2 + 18);
      }
    } catch (_) {}
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35.0, 16 / 9, 0.35, 360.0);
  const noop = () => {};
  const emptyShadowDiag = () => ({
    allCarsInsideHeroFrustum: true,
    allPropsInsideHeroFrustum: true,
    cars: [],
    props: [],
  });
  return {
    ready: Promise.resolve(),
    scene,
    camera,
    renderer: null,
    controls: null,
    BOARD_OFFSETS,
    hasWebGL2: false,
    isContextLost: () => true,
    createVehicleInstance: () => null,
    setExitGateState: noop,
    setCorridorGuide: noop,
    setHintIndicator: noop,
    setAiOpponentLabel: noop,
    captureAiBoardPng: () => "",
    captureHydrogenTabletopPng: () => "",
    setCameraMode: noop,
    resetCameraToHero: noop,
    interruptOpeningSettle: noop,
    invalidateShadows: noop,
    pickChallengeCardStand: () => null,
    triggerCardFlip: noop,
    getScaleDiagnostics: () => ({
      cmPerUnit: PHYSICAL_SCALE_SPEC.cmPerUnit,
      boardOffsets: BOARD_OFFSETS,
      ok: true,
      errors: [],
      headlessFallback: true,
    }),
    getVehicleShadowDiagnostics: emptyShadowDiag,
    getShadowDiagnostics: emptyShadowDiag,
    updateWorld: noop,
    resize: noop,
    render: noop,
  };
}

function detectSoftwareWebGL(renderer) {
  try {
    const gl = renderer?.getContext?.();
    if (!gl) return false;
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const rendererInfo = String(
      dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    );
    return /swiftshader|llvmpipe|lavapipe|\blvp\b|mesa.*vulkan|software|mesa offscreen/i.test(rendererInfo);
  } catch (_) {
    return false;
  }
}

/**
 * Creates the Dual-Board 6x6 Photoreal Scandinavian Kitchen & 1:64 Die-Cast Tabletop World.
 */
export function createCourtyardWorld(canvas) {
  const tel = ensureTelemetry();

  const gl2Probe = probeWebGL2Support();
  if (!gl2Probe.available) {
    return createUnavailableWebGLFallback(canvas);
  }

  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !gl2Probe.isSoftwareGl,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
    });
  } catch (_) {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        stencil: false,
      });
    } catch (err) {
      console.warn("[world] Failed to initialize THREE.WebGLRenderer:", err);
      return createUnavailableWebGLFallback(canvas);
    }
  }

  if (renderer.debug) {
    renderer.debug.checkShaderErrors = false;
  }

  let isGlContextLost = false;
  const targetCanvas = renderer.domElement || canvas;
  if (targetCanvas && typeof targetCanvas.addEventListener === "function") {
    targetCanvas.addEventListener(
      "webglcontextlost",
      (event) => {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }
        isGlContextLost = true;
        console.warn("[world] WebGL2 context lost; halting render loop.");
      },
      false
    );
    targetCanvas.addEventListener(
      "webglcontextrestored",
      () => {
        isGlContextLost = false;
        staticShadowBaked = false;
        lastLiveRenderEndMs = -Infinity;
        invalidateShadows();
      },
      false
    );
  }

  const isSoftwareGl = gl2Probe.isSoftwareGl || detectSoftwareWebGL(renderer);
  const maxAllowedDpr = 2;
  const shadowMapRes = 4096;

  const initW = Math.max(1, canvas?.clientWidth || window.innerWidth || 1280);
  const initH = Math.max(1, canvas?.clientHeight || window.innerHeight || 720);
  const initDpr = Math.min(window.devicePixelRatio || 1, maxAllowedDpr);

  renderer.setPixelRatio(initDpr);
  renderer.setSize(initW, initH, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = isSoftwareGl ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  if ("transmissionResolutionScale" in renderer) {
    renderer.transmissionResolutionScale = 0.25;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeae2d6);

  const maxBoardAnisotropy = Math.min(16, renderer.capabilities?.getMaxAnisotropy?.() || 16);

  const camera = new THREE.PerspectiveCamera(35.0, initW / initH, 0.35, 360.0);

  /**
   * Calibrated Dual-Board Camera Presets:
   *  - `"3d"` (Default Race View): Elevated angled perspective keeping the Foreground Human Board (`z = +9.2`)
   *    large & effortless to drag while the Background AI Board (`z = -9.2`) sits clearly visible behind it
   *    with zero overlap and full clearance above the bottom HUD dock and below the top race bar!
   *  - `"top"` (Overhead Dual-Board Race Flat-Lay): Clean 90-degree overhead view (`pos.z > target.z` so North is strictly UP).
   *  - `"macro"` (Collector Dual-Track Grazing Angle): Dramatic 3/4 grazing shot across foreground cars toward AI board.
   */
  const CAMERA_PRESETS = {
    "3d": {
      pos: new THREE.Vector3(0.25, 37.8, 40.2),
      target: new THREE.Vector3(0.25, -0.35, 3.25),
      fov: 36.8,
      dofFocusRange: 68.0,
      dofMaxBlurPx: 1.25,
    },
    macro: {
      pos: new THREE.Vector3(-12.8, 16.2, 33.2),
      target: new THREE.Vector3(0.8, 0.15, 2.2),
      fov: 34.0,
      dofFocusRange: 34.0,
      dofMaxBlurPx: 3.6,
    },
    top: {
      pos: new THREE.Vector3(0.55, 59.5, 0.56),
      target: new THREE.Vector3(0.55, 0.0, 0.50),
      fov: 42.2,
      dofFocusRange: 90.0,
      dofMaxBlurPx: 0.0,
    },
  };

  camera.position.copy(CAMERA_PRESETS["3d"].pos);
  camera.lookAt(CAMERA_PRESETS["3d"].target);

  const controls = new CourtyardOrbitControls(camera, canvas);
  controls.maxDistance = 145.0;
  controls.target.copy(CAMERA_PRESETS["3d"].target);
  controls.syncFromCamera();

  const envRT = buildSceneMatchedKitchenPMREM(renderer);
  const envTexture = envRT.texture;
  scene.environment = envTexture;
  if ("environmentIntensity" in scene) {
    scene.environmentIntensity = 0.48;
  }

  const sunDirection = new THREE.Vector3(-30.0, 36.0, -32.0).normalize();

  const shadowRig = createTwoTierShadowRig(scene, {
    sunDir: sunDirection,
    skyColor: 0xf7efe2,
    groundColor: 0xc9ad86,
    hemiIntensity: 0.18,
    sunColor: 0xfff0d6,
    staticIntensity: 0.28,
    heroIntensity: 2.65,
    staticMapSize: shadowMapRes,
    heroMapSize: shadowMapRes,
    staticSpan: 76,
    heroSpan: 29.0,
  });
  if (shadowRig.hemiLight) {
    shadowRig.hemiLight.intensity = 0.18;
  }

  const { staticSun, heroSun } = shadowRig;
  staticSun.intensity = 0.28;
  staticSun.target.position.set(6.0, -4.0, -22.0);
  staticSun.target.updateMatrixWorld(true);
  staticSun.position.copy(staticSun.target.position).addScaledVector(sunDirection, 98.0);
  staticSun.shadow.camera.left = -76;
  staticSun.shadow.camera.right = 76;
  staticSun.shadow.camera.top = 68;
  staticSun.shadow.camera.bottom = -68;
  staticSun.shadow.camera.near = 2.0;
  staticSun.shadow.camera.far = 250.0;
  staticSun.shadow.camera.updateProjectionMatrix();
  staticSun.shadow.bias = -0.00030;
  staticSun.shadow.normalBias = 0.020;
  staticSun.shadow.radius = 2.15;
  staticSun.shadow.autoUpdate = false;
  staticSun.shadow.needsUpdate = true;

  // Tier-2 Dynamic Hero Sun (`4096x4096` GPU / `2048x2048` Software GL, `[-29, +29] x [-28, +28]`) spanning 100% of BOTH `6x6` boards,
  // plaques, West mug/napkin props, and BOTH East white-oak roll-off runways (`worldX` up to `+18.5`)!
  let lastHeroTargetX = 0.5;
  heroSun.intensity = 2.65;
  heroSun.shadow.mapSize.set(shadowMapRes, shadowMapRes);
  heroSun.target.position.set(lastHeroTargetX, 0.0, 0.0);
  heroSun.target.updateMatrixWorld(true);
  heroSun.position.copy(heroSun.target.position).addScaledVector(sunDirection, 68.0);
  heroSun.shadow.camera.left = -29.0;
  heroSun.shadow.camera.right = 29.0;
  heroSun.shadow.camera.top = 28.0;
  heroSun.shadow.camera.bottom = -28.0;
  heroSun.shadow.camera.near = 2.0;
  heroSun.shadow.camera.far = 145.0;
  heroSun.shadow.camera.updateProjectionMatrix();
  heroSun.shadow.bias = -0.00018;
  heroSun.shadow.normalBias = 0.012;
  heroSun.shadow.radius = 1.75;
  heroSun.shadow.autoUpdate = false;
  heroSun.shadow.needsUpdate = true;

  tel.isOpenWorld = true;
  tel.staticShadowAutoUpdate = staticSun.shadow.autoUpdate;
  tel.heroShadowMapSize = shadowMapRes;

  const fillLight = new THREE.DirectionalLight(0xeef3fa, 0.10);
  fillLight.position.set(28.0, 24.0, 36.0);
  fillLight.castShadow = false;
  scene.add(fillLight);

  const oakBounceLight = new THREE.DirectionalLight(0xf2dfc2, 0.09);
  oakBounceLight.position.set(-14.0, -18.0, 22.0);
  oakBounceLight.castShadow = false;
  scene.add(oakBounceLight);

  const windowSillBounceLight = new THREE.PointLight(0xfff1d6, 3.8, 36.0, 1.4);
  windowSillBounceLight.position.set(-10.5, 6.8, -42.0);
  windowSillBounceLight.castShadow = false;
  scene.add(windowSillBounceLight);

  updateWorldCohesionUniforms({
    sunDir: sunDirection,
    sunColor: 0xfff0d6,
    warmBounceColor: 0xd8bc96,
    skyFillColor: 0xeef3fa,
    hazeColor: 0xefe7db,
    hazeDensity: 0.00015,
    canopyGoboStrength: 0.0,
    windowGoboStrength: 0.18,
  });

  const INITIAL_EXPOSURE =
    typeof state.params?.exposure === "number"
      ? state.params.exposure
      : typeof state.exposure === "number"
      ? state.exposure
      : 1.05;
  let currentDofFocusDist = camera.position.distanceTo(CAMERA_PRESETS["3d"].target);
  let currentDofFocusRange = CAMERA_PRESETS["3d"].dofFocusRange;
  let currentDofMaxBlurPx = CAMERA_PRESETS["3d"].dofMaxBlurPx;
  let targetDofFocusRange = currentDofFocusRange;
  let targetDofMaxBlurPx = currentDofMaxBlurPx;

  const agxComposer = createFusedAgXComposer(renderer, scene, camera, {
    forceComposerOnSoftware: true,
    exposure: INITIAL_EXPOSURE,
    ssaoStrength: isSoftwareGl ? 0.0 : 0.40,
    ssaoRadiusPx: 6.5,
    dofFocusDist: currentDofFocusDist,
    dofFocusRange: currentDofFocusRange,
    dofMaxBlurPx: isSoftwareGl ? 0.0 : currentDofMaxBlurPx,
    bloomStrength: isSoftwareGl ? 0.0 : 0.16,
    bloomThreshold: 1.08,
    vignette: 0.16,
    grain: 0.011,
  });

  // Scene hierarchy containers
  const worldRoot = new THREE.Group();
  worldRoot.name = "ParkingBenchTabletopRoot";
  scene.add(worldRoot);

  const tableGroup = new THREE.Group();
  tableGroup.name = "SculptedWhiteOakDiningTable";
  worldRoot.add(tableGroup);

  const boardGroup = new THREE.Group();
  boardGroup.name = "DualPuzzleBoardsAssembly";
  worldRoot.add(boardGroup);

  const humanBoardGroup = new THREE.Group();
  humanBoardGroup.name = "HumanForegroundBoardGroup";
  humanBoardGroup.position.set(BOARD_OFFSETS.human.x, 0, BOARD_OFFSETS.human.z);
  boardGroup.add(humanBoardGroup);

  const aiBoardGroup = new THREE.Group();
  aiBoardGroup.name = "AiBackgroundBoardGroup";
  aiBoardGroup.position.set(BOARD_OFFSETS.ai.x, 0, BOARD_OFFSETS.ai.z);
  boardGroup.add(aiBoardGroup);

  const propsGroup = new THREE.Group();
  propsGroup.name = "TabletopEditorialProps";
  worldRoot.add(propsGroup);

  const vehicleLayer = new THREE.Group();
  vehicleLayer.name = "CollectorFleetLayer";
  worldRoot.add(vehicleLayer);

  const instancedVehiclePoolGroup = new THREE.Group();
  instancedVehiclePoolGroup.name = "CollectorFleetInstancedPools";
  worldRoot.add(instancedVehiclePoolGroup);

  const guideGroup = new THREE.Group();
  guideGroup.name = "TactileBoardGuides";
  worldRoot.add(guideGroup);

  // Lazy procedural fallback textures
  let slateNormalTex = null;
  let stonewareTex = null;
  let corkTex = null;
  let linenTex = null;
  let papercordTex = null;
  let latteArtTex = null;
  const getSlateNormalTex = () => (slateNormalTex || (slateNormalTex = buildSlateCleavageNormalMap()));
  const getStonewareTex = () => (stonewareTex || (stonewareTex = buildStonewareGlazeTexture()));
  const getCorkTex = () => (corkTex || (corkTex = buildCorkTexture()));
  const getLinenTex = () => (linenTex || (linenTex = buildWovenFabricTexture("linen")));
  const getPapercordTex = () => (papercordTex || (papercordTex = buildWovenFabricTexture("papercord")));
  const getLatteArtTex = () => (latteArtTex || (latteArtTex = buildLatteArtCanvasTexture()));
  const steamWispTex = buildSteamWispTexture();
  const boardAoTex = buildBoardContactShadowTexture();
  const radialAoTex = buildRadialContactShadowTexture();
  const vehicleContactTex = buildVehicleContactShadowTexture();
  const vehicleHaloTex = buildVehicleHaloTexture();
  const chevronTex = buildChevronTexture();
  const metallicFlakeNormal = buildMetallicFlakeNormalMap();
  const brakeSpillTex = buildBrakeSpillTexture();

  // Tactile Corridor Guide & Hint Chevron Meshes (anchored to Foreground Human Board by default)
  const corridorRailMat = new THREE.MeshBasicMaterial({
    color: 0xf4ecdc,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const corridorOutlineGeo = new THREE.PlaneGeometry(1, 1);
  corridorOutlineGeo.rotateX(-Math.PI * 0.5);
  const corridorMesh = new THREE.Mesh(corridorOutlineGeo, corridorRailMat);
  corridorMesh.name = "CorridorLaneGuide";
  corridorMesh.position.y = BOARD6.deckY + 0.008;
  corridorMesh.visible = false;
  corridorMesh.raycast = () => {};
  guideGroup.add(corridorMesh);

  const hintChevronMat = new THREE.MeshBasicMaterial({
    map: chevronTex,
    color: 0xf6ebd2,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  const hintGroup = new THREE.Group();
  hintGroup.name = "HintChevronGroup";
  hintGroup.visible = false;
  const hintPlaneGeo = new THREE.PlaneGeometry(0.92, 0.92);
  hintPlaneGeo.rotateX(-Math.PI * 0.5);
  const hintChevrons = [0, 1].map((idx) => {
    const m = new THREE.Mesh(hintPlaneGeo, hintChevronMat);
    m.position.x = idx * 0.58;
    m.raycast = () => {};
    hintGroup.add(m);
    return m;
  });
  guideGroup.add(hintGroup);

  // Shared pooled under-chassis ContactShadowPlane (`1` draw call total for up to 64 vehicles across both boards!)
  const MAX_TOTAL_VEHICLES = 64;
  const vehicleContactMat = new THREE.MeshBasicMaterial({
    map: vehicleContactTex,
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const contactShadowUnitGeo = new THREE.PlaneGeometry(1, 1);
  contactShadowUnitGeo.rotateX(-Math.PI * 0.5);
  const contactShadowInstMesh = new THREE.InstancedMesh(contactShadowUnitGeo, vehicleContactMat, MAX_TOTAL_VEHICLES);
  contactShadowInstMesh.name = "Pool_VehicleContactShadows";
  contactShadowInstMesh.count = 0;
  contactShadowInstMesh.visible = false;
  contactShadowInstMesh.frustumCulled = false;
  contactShadowInstMesh.castShadow = false;
  contactShadowInstMesh.receiveShadow = false;
  contactShadowInstMesh.raycast = () => {};
  instancedVehiclePoolGroup.add(contactShadowInstMesh);

  // Collector Fleet Shared Optical Refractive Materials
  // On Software GL (`Lavapipe`/`SwiftShader`), use single-pass physical Fresnel crystal glass so Three.js
  // does not rasterize the entire opaque scene a 2nd time per frame into a transmission FBO.
  const sharedGlassMat = new THREE.MeshPhysicalMaterial(
    isSoftwareGl
      ? {
          name: "CollectorOpticalCrystalGlass",
          color: new THREE.Color(0xc8d8e4),
          roughness: 0.03,
          metalness: 0.06,
          ior: 1.52,
          opacity: 0.36,
          transparent: true,
          depthWrite: false,
          clearcoat: 1.0,
          clearcoatRoughness: 0.03,
          reflectivity: 0.96,
          envMapIntensity: 1.85,
        }
      : {
          name: "CollectorOpticalCrystalGlass",
          color: new THREE.Color(0xdce8ee),
          transmission: 0.80,
          thickness: 0.12,
          ior: 1.52,
          roughness: 0.03,
          metalness: 0.0,
          opacity: 1.0,
          transparent: false,
          clearcoat: 1.0,
          clearcoatRoughness: 0.03,
          reflectivity: 0.96,
          envMapIntensity: 1.85,
        }
  );

  const sharedClearLensMat = new THREE.MeshPhysicalMaterial({
    name: "CollectorHeadlampLens",
    color: new THREE.Color(0xd8e2ec),
    roughness: 0.025,
    metalness: 0.14,
    ior: 1.54,
    reflectivity: 0.96,
    clearcoat: 1.0,
    clearcoatRoughness: 0.015,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    envMapIntensity: 2.05,
  });

  const sharedTaillightMat = new THREE.MeshPhysicalMaterial({
    name: "CollectorRubyTaillight",
    color: new THREE.Color(0x7c0e14),
    emissive: new THREE.Color(0xd91e18),
    emissiveIntensity: 0.24,
    roughness: 0.12,
    metalness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.25,
  });

  // Independent Dual Exit Gate Boom Physics & State (`human` foreground board & `ai` background board)
  const gateStates = {
    human: {
      isOpen: false,
      angle: 0.0,
      vel: 0.0,
      lastShadowAngle: Infinity,
      boomPivot: null,
      beaconMat: null,
      throatChevronMat: null,
    },
    ai: {
      isOpen: false,
      angle: 0.0,
      vel: 0.0,
      lastShadowAngle: Infinity,
      boomPivot: null,
      beaconMat: null,
      throatChevronMat: null,
    },
  };

  // Tabletop Nameplate controllers
  let humanNameplate = null;
  let aiNameplate = null;
  let pendingAiLabel = state.race?.opponentLabel || state.hydrogen?.modelDisplay || "Gemini 4 Hydrogen";

  // Steam wisps above stoneware mug
  const steamWisps = [];

  // Active vehicles & pooled BatchedMeshes
  const activeVehicles = new Set();
  const vehicleTemplates = new Map();
  const vehicleInstancedPools = [];
  const bodyPaintMaterialCache = new Map();
  let spawnShadowFrames = 4;
  let shadowUpdateCount = 0;
  let lastHeroShadowFrame = 0;

  // Camera transition & cold-boot arrival glide state
  let currentCameraMode = state.cameraMode || "3d";
  let lastLiveRenderEndMs = -Infinity;
  let camGlideActive = false;
  let camGlideElapsed = 0;
  const CAM_GLIDE_DURATION = 0.62;
  const camGlideStartPos = new THREE.Vector3();
  const camGlideStartTarget = new THREE.Vector3();
  let camGlideStartFov = 35.0;
  const camGlideEndPos = new THREE.Vector3();
  const camGlideEndTarget = new THREE.Vector3();
  let camGlideEndFov = 35.0;
  const OPENING_SETTLE_DURATION = 2.0;
  let hasExplicitStateQuery = false;
  try {
    if (typeof window !== "undefined" && window.location?.search) {
      hasExplicitStateQuery = new URLSearchParams(window.location.search).has("state");
    }
  } catch (_) {}
  let openingSettleRemaining = hasExplicitStateQuery ? 0.0 : OPENING_SETTLE_DURATION;

  // Reusable scratch math objects
  const _tmpMat4 = new THREE.Matrix4();
  const _tmpVec3 = new THREE.Vector3();
  const _tmpBox3 = new THREE.Box3();
  const _settleRay = new THREE.Vector3();
  const _settleStartPos = new THREE.Vector3();
  const _settleStartTarget = new THREE.Vector3();

  // Cached scene scale references for `getScaleDiagnostics()`
  let tableSlabMeshRef = null;
  let humanBoardAssemblyRef = null;
  let aiBoardAssemblyRef = null;
  let mugGroupRef = null;
  let napkinGroupRef = null;
  let herbPlanterRef = null;
  let kitchenEnvRefs = null;
  let chairInstancesRef = null;

  function invalidateShadows() {
    heroSun.shadow.needsUpdate = true;
    renderer.shadowMap.needsUpdate = true;
    shadowUpdateCount += 1;
    lastHeroShadowFrame = state.frameCount || 0;
  }

  function getCollectorBodyPaintMaterial(finishKey, isTarget, origMat) {
    const resolvedKey = isTarget ? "rosso_corsa" : finishKey || "glacier_silver";
    const spec = CURATED_FINISHES[resolvedKey] || CURATED_FINISHES.glacier_silver;
    const cacheKey = `${resolvedKey}_${origMat?.uuid || "proc"}`;
    if (bodyPaintMaterialCache.has(cacheKey)) {
      return bodyPaintMaterialCache.get(cacheKey);
    }

    const baked = prepareBakedGlbMaps(origMat);
    const useBakedAlbedo = baked.map && isNeutralGrayscaleMap(baked.map);
    const isRosso = resolvedKey === "rosso_corsa";
    const hexStr = isRosso ? "#a50e15" : spec.hex;

    const mat = new THREE.MeshPhysicalMaterial({
      name: `CollectorPaint_${resolvedKey}`,
      color: new THREE.Color(hexStr),
      map: useBakedAlbedo ? baked.map : null,
      roughness: isRosso ? 0.16 : spec.roughness ?? 0.22,
      roughnessMap: baked.roughnessMap || null,
      metalness: isRosso ? 0.18 : spec.metalness ?? 0.42,
      metalnessMap: baked.metalnessMap || null,
      normalMap: baked.normalMap || metallicFlakeNormal,
      normalScale: baked.normalMap
        ? new THREE.Vector2(0.55, 0.55)
        : new THREE.Vector2(0.045, 0.045),
      aoMap: baked.aoMap || null,
      aoMapIntensity: baked.aoMap ? 0.85 : 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: isRosso ? 0.022 : spec.clearcoatRoughness ?? 0.045,
      ior: 1.54,
      reflectivity: 0.92,
      envMapIntensity: isRosso ? 1.15 : 1.05,
    });
    injectWorldCohesionHook(mat, { bounceWeight: 0.75, goboWeight: 0.65 });
    bodyPaintMaterialCache.set(cacheKey, mat);
    return mat;
  }

  const sharedUnmappedMetalTrimMat = new THREE.MeshPhysicalMaterial({
    name: "CollectorBatchedMetalTrim",
    color: new THREE.Color(0xffffff),
    vertexColors: true,
    roughness: 0.20,
    metalness: 0.88,
    clearcoat: 0.35,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.25,
  });
  injectWorldCohesionHook(sharedUnmappedMetalTrimMat, { bounceWeight: 0.65, goboWeight: 0.55 });

  const sharedUnmappedOpticsMat = new THREE.MeshPhysicalMaterial({
    name: "CollectorBatchedOpticsEnamel",
    color: new THREE.Color(0xffffff),
    vertexColors: true,
    roughness: 0.12,
    metalness: 0.14,
    clearcoat: 0.95,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.30,
  });
  injectWorldCohesionHook(sharedUnmappedOpticsMat, { bounceWeight: 0.65, goboWeight: 0.55 });

  function stampGeometryVertexColor(geom, hex) {
    const c = new THREE.Color(hex);
    const count = geom.attributes.position.count;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    geom.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  }

  function resolveBatchedTrimHex(mName, origMat = null) {
    if (/Chrome/i.test(mName)) return 0xe8edf2;
    if (/Pewter/i.test(mName)) return 0xa4acb6;
    if (/PlatePlinth/i.test(mName)) return 0x24262e;
    if (/DarkTrim/i.test(mName)) return 0x1e2126;
    if (/Headlight/i.test(mName)) return 0xfcfaf2;
    if (/AmberLens/i.test(mName)) return 0xe07b18;
    if (/Taillight/i.test(mName)) return 0x9e1218;
    if (origMat?.color) return origMat.color.getHex();
    return 0xd0d6de;
  }

  function normalizeBatchGeometry(rawGeo, needsVertexColors = false, fallbackColorHex = 0xffffff) {
    if (!rawGeo || !rawGeo.attributes?.position) return null;
    const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
    const posSrc = g.attributes.position;
    const vCount = posSrc.count;
    if (vCount <= 0) return null;

    const toFloat32Attr = (attr, itemSize) => {
      if (
        attr &&
        attr.count === vCount &&
        attr.itemSize === itemSize &&
        attr.normalized === false &&
        attr.array instanceof Float32Array &&
        attr.array.length === vCount * itemSize &&
        !attr.isInterleavedBufferAttribute
      ) {
        return new THREE.BufferAttribute(attr.array, itemSize, false);
      }
      const out = new Float32Array(vCount * itemSize);
      if (attr && attr.count === vCount) {
        for (let i = 0; i < vCount; i++) {
          if (itemSize >= 1) out[i * itemSize] = attr.getX(i);
          if (itemSize >= 2) out[i * itemSize + 1] = attr.getY(i);
          if (itemSize >= 3) out[i * itemSize + 2] = attr.getZ(i);
        }
      }
      return new THREE.BufferAttribute(out, itemSize, false);
    };

    const posAttr = toFloat32Attr(posSrc, 3);
    if (!g.attributes.normal) {
      g.setAttribute("position", posAttr);
      g.computeVertexNormals();
    }
    const normAttr = toFloat32Attr(g.attributes.normal, 3);
    const uvAttr = toFloat32Attr(g.attributes.uv, 2);
    const uv1Attr = new THREE.BufferAttribute(uvAttr.array, 2, false);

    const clean = new THREE.BufferGeometry();
    clean.setAttribute("position", posAttr);
    clean.setAttribute("normal", normAttr);
    clean.setAttribute("uv", uvAttr);
    clean.setAttribute("uv1", uv1Attr);

    if (needsVertexColors) {
      if (g.attributes.color && g.attributes.color.count === vCount) {
        clean.setAttribute("color", toFloat32Attr(g.attributes.color, 3));
      } else {
        stampGeometryVertexColor(clean, fallbackColorHex);
      }
    }

    clean.computeBoundingBox();
    clean.computeBoundingSphere();
    return clean;
  }

  const upgradedSharedMatCache = new Map();
  function upgradeSharedVehicleMaterial(origMat, opts = {}) {
    const mName = origMat?.name || "Mat_DarkTrim";
    const canonicalName = mName.replace(/\.\d+$/, "");
    if (opts.isWheelPart && /DarkTrim/i.test(canonicalName)) {
      return sharedUnmappedMetalTrimMat;
    }

    const baked = prepareBakedGlbMaps(origMat);
    const isInteriorTan = /InteriorTan|LeatherTan|TanLeather|Saddle/i.test(canonicalName);
    const roleKey = isInteriorTan
      ? "Mat_InteriorTan"
      : /^Mat_(?:DarkTrim|Interior)$/i.test(canonicalName)
      ? "Mat_DarkCharcoalTrim"
      : canonicalName;
    const cacheKey = roleKey;
    if (upgradedSharedMatCache.has(cacheKey)) {
      const existing = upgradedSharedMatCache.get(cacheKey);
      if (!baked.hasAnyBakedMap || existing.map || existing.normalMap || existing.roughnessMap) {
        return existing;
      }
    }

    if (/Glass/i.test(canonicalName)) {
      upgradedSharedMatCache.set(cacheKey, sharedGlassMat);
      return sharedGlassMat;
    }
    if (/ClearLens/i.test(canonicalName)) {
      upgradedSharedMatCache.set(cacheKey, sharedClearLensMat);
      return sharedClearLensMat;
    }

    if (!baked.hasAnyBakedMap && !isInteriorTan) {
      if (/Chrome|Pewter|PlatePlinth/i.test(canonicalName)) {
        upgradedSharedMatCache.set(cacheKey, sharedUnmappedMetalTrimMat);
        return sharedUnmappedMetalTrimMat;
      }
      if (/Headlight|AmberLens|Taillight/i.test(canonicalName)) {
        upgradedSharedMatCache.set(cacheKey, sharedUnmappedOpticsMat);
        return sharedUnmappedOpticsMat;
      }
    }

    const baseColor = origMat?.color ? origMat.color.clone() : new THREE.Color(0x2b2e33);
    let roughness = typeof origMat?.roughness === "number" ? origMat.roughness : 0.55;
    let metalness = typeof origMat?.metalness === "number" ? origMat.metalness : 0.15;
    let clearcoat = 0.0;
    let clearcoatRoughness = 0.15;
    let envIntensity = 1.0;

    if (isInteriorTan) {
      if (!baked.map) baseColor.setHex(0x8a5630);
      roughness = baked.roughnessMap ? 1.0 : 0.54;
      metalness = 0.0;
      clearcoat = 0.14;
      clearcoatRoughness = 0.42;
      envIntensity = 0.78;
    } else if (/AlloyRim/i.test(canonicalName)) {
      if (!baked.map) baseColor.setHex(0xd4dae0);
      roughness = baked.roughnessMap ? 1.0 : 0.24;
      metalness = baked.metalnessMap ? 1.0 : 0.88;
      clearcoat = 0.35;
      envIntensity = 1.20;
    } else if (/BrakeRotor/i.test(canonicalName)) {
      if (!baked.map) baseColor.setHex(0xbec5cc);
      roughness = baked.roughnessMap ? 1.0 : 0.32;
      metalness = baked.metalnessMap ? 1.0 : 0.86;
    } else if (/BrakeCaliper/i.test(canonicalName)) {
      roughness = baked.roughnessMap ? 1.0 : 0.28;
      metalness = baked.metalnessMap ? 1.0 : 0.35;
      clearcoat = 0.72;
      clearcoatRoughness = 0.08;
    } else if (/Tire/i.test(canonicalName)) {
      if (!baked.map) baseColor.setHex(0x1f2226);
      roughness = baked.roughnessMap ? 1.0 : 0.82;
      metalness = 0.02;
      envIntensity = 0.55;
    } else if (/CreamRoof/i.test(canonicalName)) {
      if (!baked.map) baseColor.setHex(0xf0e9dc);
      roughness = baked.roughnessMap ? 1.0 : 0.22;
      metalness = 0.08;
      clearcoat = 0.92;
      clearcoatRoughness = 0.05;
    }

    const resolvedColor = baked.map
      ? isInteriorTan && isNeutralGrayscaleMap(baked.map)
        ? origMat?.color && origMat.color.r - origMat.color.b > 0.06
          ? origMat.color.clone()
          : new THREE.Color(0x8a5630)
        : new THREE.Color(0xffffff)
      : baseColor;

    const commonProps = {
      name: roleKey,
      color: resolvedColor,
      map: baked.map,
      normalMap: baked.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness,
      roughnessMap: baked.roughnessMap,
      metalness,
      metalnessMap: baked.metalnessMap,
      aoMap: baked.aoMap,
      aoMapIntensity: baked.aoMap ? 0.85 : 0.0,
      envMapIntensity: envIntensity,
    };
    const mat =
      clearcoat > 0
        ? new THREE.MeshPhysicalMaterial({
            ...commonProps,
            clearcoat,
            clearcoatRoughness,
          })
        : new THREE.MeshStandardMaterial(commonProps);
    injectWorldCohesionHook(mat, { bounceWeight: 0.65, goboWeight: 0.55 });
    upgradedSharedMatCache.set(cacheKey, mat);
    return mat;
  }

  const PAINT_FINISH_TIERS = ["rosso", "metallic", "enamel"];
  const _batchBootstrapWhite = new THREE.Color(0xffffff);

  function resolvePaintFinishTier(resolvedPaintKey, isTarget) {
    if (isTarget || resolvedPaintKey === "rosso_corsa") return "rosso";
    const spec = CURATED_FINISHES[resolvedPaintKey] || CURATED_FINISHES.glacier_silver;
    return (spec.metalness ?? 0.42) >= 0.36 ? "metallic" : "enamel";
  }

  function buildCalibratedTierPaintMaterial(tierKey, sampleOrigMat) {
    const basePaint = getCollectorBodyPaintMaterial(
      tierKey === "rosso" ? "rosso_corsa" : tierKey === "metallic" ? "glacier_silver" : "warm_chalk",
      tierKey === "rosso",
      sampleOrigMat
    );
    const instMat = basePaint.clone();
    instMat.name = `CollectorBatchedPaint_${tierKey}`;
    instMat.vertexColors = false;
    instMat.color.setHex(0xffffff);
    if (tierKey === "rosso") {
      instMat.metalness = 0.18;
      instMat.roughness = 0.16;
      instMat.clearcoat = 1.0;
      instMat.clearcoatRoughness = 0.022;
    } else if (tierKey === "metallic") {
      instMat.metalness = 0.54;
      instMat.roughness = 0.16;
      instMat.clearcoat = 1.0;
      instMat.clearcoatRoughness = 0.048;
    } else {
      instMat.metalness = 0.20;
      instMat.roughness = 0.15;
      instMat.clearcoat = 1.0;
      instMat.clearcoatRoughness = 0.046;
    }
    injectWorldCohesionHook(instMat, { bounceWeight: 0.75, goboWeight: 0.65 });
    return instMat;
  }

  function createConfiguredBatchedMesh({ name, mat, maxInstances, totalVertices, castShadow, initColorTex = false }) {
    const safeVerts = Math.max(36, totalVertices + 64);
    const bm = new THREE.BatchedMesh(maxInstances, safeVerts, 0, mat);
    bm.name = name;
    bm.frustumCulled = false;
    bm.perObjectFrustumCulled = false;
    bm.sortObjects = Boolean(mat.transparent);
    bm.castShadow = Boolean(castShadow);
    bm.receiveShadow = true;
    bm.visible = false;
    bm.raycast = () => {};
    instancedVehiclePoolGroup.add(bm);
    const entry = {
      mesh: bm,
      mat,
      castShadow: Boolean(castShadow),
      maxInstances,
      needsColorBootstrap: Boolean(initColorTex),
      colorBootstrapped: false,
    };
    vehicleInstancedPools.push(entry);
    return entry;
  }

  /**
   * Updates the AI back-board's tabletop nameplate (`"Gemini 4 Hydrogen"`, `"Decisions API"`).
   */
  function setAiOpponentLabel(label) {
    const clean = String(label || state.race?.opponentLabel || "Gemini 4 Hydrogen").trim();
    pendingAiLabel = clean;
    if (aiNameplate) {
      aiNameplate.setLabel(clean);
    }
  }

  const subscribeBus = (evt, fn) => {
    if (!evt) return;
    if (typeof bus?.addEventListener === "function") bus.addEventListener(evt, fn);
    else if (typeof bus?.on === "function") bus.on(evt, fn);
  };

  if (DEMO_EVENTS.MODEL_SELECTED) {
    subscribeBus(DEMO_EVENTS.MODEL_SELECTED, (e) => {
      const nextLabel = e?.detail?.label || state.race?.opponentLabel || "Gemini 4 Hydrogen";
      setAiOpponentLabel(nextLabel);
    });
  }

  subscribeBus(DEMO_EVENTS.CAMERA_CHANGED, (e) => {
    if (e.detail?.cameraMode && e.detail.cameraMode !== currentCameraMode) {
      const immediate = (state.frameCount || 0) === 0;
      if (!immediate) interruptOpeningSettle();
      setCameraMode(e.detail.cameraMode, immediate);
    }
  });

  subscribeBus(DEMO_EVENTS.PARAM_CHANGED, (e) => {
    const expParam = e.detail?.params?.exposure;
    if (typeof expParam === "number") {
      agxComposer.setExposure(expParam);
    }
    const k = e.detail?.key;
    const v = e.detail?.value;
    if (k === "exposure" && typeof v === "number") {
      agxComposer.setExposure(v);
    } else if (k === "cameraMode" && typeof v === "string") {
      setCameraMode(v, false);
    }
  });

  /**
   * Async scene assembly: builds sculpted white-oak dining table, Scandinavian kitchen room,
   * TWO identical 6x6 laser-etched beechwood & slate boards (`human` at z=+9.2, `ai` at z=-9.2),
   * tabletop plaques (`YOU` & dynamic `AI Opponent`), editorial props, and all 10 collector car BatchedMesh pools.
   */
  const ready = (async () => {
    const [oakImgTex, beechImgTex, limestoneImgTex] = await Promise.all([
      loadDataUriTexture(PALE_WHITE_OAK_DATA_URI, "oak", { repeat: [2, 2] }),
      loadDataUriTexture(BEECH_WOOD_DATA_URI, "beech", { repeat: [2, 2] }),
      loadDataUriTexture(CREAM_LIMESTONE_DATA_URI, "limestone", { repeat: [2, 2] }),
    ]);

    // 1. Sunlit Sculpted European White-Oak Dining Table proportioned cleanly for TWO 6x6 boards + plaques + East runways
    const specTb = PHYSICAL_SCALE_SPEC.tableBounds || {};
    const tb = {
      xMin: Math.min(specTb.xMin ?? -22.8, -21.6),
      xMax: Math.max(specTb.xMax ?? 22.8, 19.8),
      zMin: Math.min(specTb.zMin ?? -21.0, -20.6),
      zMax: Math.max(specTb.zMax ?? 21.0, 20.6),
      topY: specTb.topY ?? BOARD6.tableY,
    };
    const slabThickness = PHYSICAL_SCALE_SPEC.tableSlabThicknessUnits || 2.80;
    const oakPbr = buildCoupledRiftOakPBRSuite();

    const oakSlabMat = new THREE.MeshStandardMaterial({
      name: "Mat_SculptedRiftWhiteOak",
      map: oakPbr.albedoTex,
      normalMap: oakPbr.normalTex,
      normalScale: new THREE.Vector2(0.82, 0.82),
      roughnessMap: oakPbr.ormTex,
      metalnessMap: oakPbr.ormTex,
      aoMap: oakPbr.ormTex,
      aoMapIntensity: 0.72,
      roughness: 1.0,
      metalness: 0.0,
      envMapIntensity: 0.45,
    });
    injectWorldCohesionHook(oakSlabMat, {
      enablePom: true,
      heightMap: oakPbr.heightTex,
      pomScale: 0.008,
      pomMaxDist: 165.0,
      goboWeight: 1.0,
      bounceWeight: 0.45,
    });

    const tableSlabGeo = createSculptedChamferedOakSlabGeometry(
      tb.xMin,
      tb.xMax,
      tb.zMin,
      tb.zMax,
      0.22,
      1.05,
      slabThickness
    );
    const tableSlabMesh = new THREE.Mesh(tableSlabGeo, oakSlabMat);
    tableSlabMesh.name = "WhiteOakTableSlab";
    tableSlabMesh.position.y = tb.topY;
    tableSlabMesh.castShadow = true;
    tableSlabMesh.receiveShadow = true;
    tableSlabMesh.raycast = () => {};
    tableGroup.add(tableSlabMesh);
    tableSlabMeshRef = tableSlabMesh;

    const underSlabY = tb.topY - slabThickness;
    const floorY = -52.0;
    const legH = underSlabY - floorY;
    const apronH = 3.4;
    const apronThick = 1.35;
    const insetX = 5.8;
    const insetZ = 5.2;
    const spanX = tb.xMax - tb.xMin - insetX * 2;
    const spanZ = tb.zMax - tb.zMin - insetZ * 2;
    const midTableX = (tb.xMin + tb.xMax) * 0.5;
    const midTableZ = (tb.zMin + tb.zMax) * 0.5;

    const underframeGeos = [
      makeNonIndexedTransformedGeo(new THREE.BoxGeometry(spanX, apronH, apronThick), {
        x: midTableX,
        y: underSlabY - apronH * 0.5,
        z: tb.zMax - insetZ,
      }),
      makeNonIndexedTransformedGeo(new THREE.BoxGeometry(spanX, apronH, apronThick), {
        x: midTableX,
        y: underSlabY - apronH * 0.5,
        z: tb.zMin + insetZ,
      }),
      makeNonIndexedTransformedGeo(new THREE.BoxGeometry(apronThick, apronH, spanZ), {
        x: tb.xMax - insetX,
        y: underSlabY - apronH * 0.5,
        z: midTableZ,
      }),
      makeNonIndexedTransformedGeo(new THREE.BoxGeometry(apronThick, apronH, spanZ), {
        x: tb.xMin + insetX,
        y: underSlabY - apronH * 0.5,
        z: midTableZ,
      }),
    ];

    for (const [lx, lz] of [
      [tb.xMax - insetX, tb.zMax - insetZ],
      [tb.xMax - insetX, tb.zMin + insetZ],
      [tb.xMin + insetX, tb.zMax - insetZ],
      [tb.xMin + insetX, tb.zMin + insetZ],
    ]) {
      const legGeo = makeNonIndexedTransformedGeo(new THREE.BoxGeometry(3.8, legH, 3.8), {});
      const lUv = legGeo.attributes.uv;
      for (let k = 0; k < lUv.count; k++) {
        lUv.setXY(k, lUv.getY(k) * 0.85, lUv.getX(k) * 0.35);
      }
      legGeo.translate(lx, floorY + legH * 0.5, lz);
      underframeGeos.push(legGeo);
    }

    const underframeMat = new THREE.MeshStandardMaterial({
      name: "Mat_TableOakUnderframe",
      color: new THREE.Color(0xf0e7d8),
      map: oakPbr.albedoTex,
      normalMap: oakPbr.normalTex,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.56,
      metalness: 0.0,
      envMapIntensity: 0.68,
    });
    injectWorldCohesionHook(underframeMat, { bounceWeight: 0.85, goboWeight: 0.5 });
    const underframeGeo = mergeGeometries(underframeGeos, false);
    ensureGeometryUv1(underframeGeo);
    const underframeMesh = new THREE.Mesh(underframeGeo, underframeMat);
    underframeMesh.name = "TableTrestleUnderframe";
    underframeMesh.castShadow = true;
    underframeMesh.receiveShadow = true;
    underframeMesh.raycast = () => {};
    tableGroup.add(underframeMesh);

    // 2. Scandinavian Architectural Kitchen Room
    const floorOakTex = buildOakPlankFloorTexture(oakImgTex);
    kitchenEnvRefs = buildScandinavianKitchenArchitecture({
      floorOakTex,
      cabOakTex: oakPbr.albedoTex,
      cabOakRoughTex: oakPbr.ormTex,
      cabOakNormalTex: oakPbr.normalTex,
      limestoneTex: limestoneImgTex,
      envTexture,
      radialAoTex,
    });
    worldRoot.add(kitchenEnvRefs.kitchenRoot);

    // 3. Await embedded WOFF2 editorial fonts BEFORE painting 6x6 `A..F`/`1..6` rails & tabletop nameplates!
    if (typeof document !== "undefined" && document.fonts) {
      try {
        await Promise.all([
          document.fonts.load("600 50px 'EditorialSans'"),
          document.fonts.load("500 36px 'EditorialSans'"),
          document.fonts.load("700 36px 'JetBrains Mono'"),
          document.fonts.ready,
        ]);
      } catch (_) {}
    }

    // 4. Decode & Register All 3 Inline Gzipped GLB Payloads
    tel.inlineGlbPayloadMB = 0;
    const decodeOneGlb = async (mod, preferredFnName) => {
      const fn = resolveGlbDecoder(mod, preferredFnName);
      if (!fn) return null;
      const rawBuf = await Promise.resolve(fn());
      if (!rawBuf) return null;
      const byteCount = mod.GLB_META?.gzBytes || rawBuf.byteLength || 0;
      registerInlineGlbBytes(byteCount);
      if (rawBuf instanceof ArrayBuffer) return rawBuf;
      if (ArrayBuffer.isView(rawBuf)) {
        return rawBuf.buffer.slice(rawBuf.byteOffset, rawBuf.byteOffset + rawBuf.byteLength);
      }
      return null;
    };

    const [boardBuf, kitchenPropsBuf, vehiclesBuf] = await Promise.all([
      decodeOneGlb(boardTrayGlbMod, "decodeBoardTrayGlbBuffer"),
      decodeOneGlb(kitchenPropsGlbMod, "decodeKitchenPropsGlbBuffer"),
      decodeOneGlb(vehiclesGlbMod, "decodeVehiclesGlbBuffer"),
    ]);

    const gltfLoader = new GLTFLoader();
    const parseGlbAsync = (arrayBuf) =>
      new Promise((resolve, reject) => {
        if (!arrayBuf) {
          resolve(null);
          return;
        }
        gltfLoader.parse(arrayBuf, "", resolve, reject);
      });

    const [boardGltf, kitchenPropsGltf, vehiclesGltf] = await Promise.all([
      parseGlbAsync(boardBuf),
      parseGlbAsync(kitchenPropsBuf),
      parseGlbAsync(vehiclesBuf),
    ]);

    // 5. Remap Board Template to Exact 6x6 (`14.84 x 14.84` outer, `13.20 x 13.20` inner, `F3` exit) & Mount TWO Boards!
    const slateTex6x6 = buildSlateDeckTexture6x6(maxBoardAnisotropy);
    const beechTex6x6 = buildBeechFrameTexture6x6(beechImgTex, maxBoardAnisotropy);

    if (boardGltf && boardGltf.scene) {
      const templateBoard = boardGltf.scene;
      remapBoardTrayGlbTo6x6(templateBoard);

      // Build shared calibrated board materials once so both Human & AI boards share shader programs
      const sharedSlateMat = new THREE.MeshStandardMaterial({
        name: "Mat_BoardSlate6x6Calibrated",
        color: 0xffffff,
        map: slateTex6x6,
        normalMap: getSlateNormalTex(),
        normalScale: new THREE.Vector2(0.24, 0.24),
        roughness: 0.60,
        metalness: 0.04,
        envMapIntensity: 0.78,
      });
      injectWorldCohesionHook(sharedSlateMat, { bounceWeight: 0.65, goboWeight: 0.9 });

      const sharedBeechMat = new THREE.MeshPhysicalMaterial({
        name: "Mat_BoardBeech6x6Calibrated",
        color: 0xf4ede3,
        map: beechTex6x6,
        roughness: 0.44,
        metalness: 0.0,
        clearcoat: 0.18,
        clearcoatRoughness: 0.34,
        envMapIntensity: 0.88,
      });
      injectWorldCohesionHook(sharedBeechMat, { bounceWeight: 0.85, goboWeight: 0.95 });

      const sharedBoomRedMat = new THREE.MeshPhysicalMaterial({
        name: "Mat_BoomCrimsonEnamel",
        color: 0xb21e24,
        roughness: 0.24,
        metalness: 0.08,
        clearcoat: 0.85,
        clearcoatRoughness: 0.08,
      });

      const sharedBoomWhiteMat = new THREE.MeshPhysicalMaterial({
        name: "Mat_BoomIvoryEnamel",
        color: 0xf4efe4,
        roughness: 0.26,
        metalness: 0.05,
        clearcoat: 0.82,
        clearcoatRoughness: 0.09,
      });

      let sharedBrassMat = null;
      let sharedGateDarkMat = null;

      const boardAoSpan = BOARD6.outerHalf * 2.0 + 2.2; // 17.04u
      const sharedBoardAoGeo = new THREE.PlaneGeometry(boardAoSpan, boardAoSpan);
      const sharedBoardAoMat = new THREE.MeshBasicMaterial({
        map: boardAoTex,
        transparent: true,
        opacity: 0.64,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const sharedExitThroatGeo = new THREE.PlaneGeometry(0.96, 0.96);
      sharedExitThroatGeo.rotateX(-Math.PI * 0.5);

      const mountOneBoard6x6 = (roleKey, targetContainer) => {
        const bClone = templateBoard.clone(true);
        bClone.name = `BoardTray6x6_${roleKey}`;
        const gState = gateStates[roleKey];

        const roleBeaconMat = new THREE.MeshPhysicalMaterial({
          name: `Mat_GateBeacon_${roleKey}`,
          color: new THREE.Color(0xb8342a),
          emissive: new THREE.Color(0x8a1812),
          emissiveIntensity: 0.36,
          roughness: 0.12,
          metalness: 0.06,
          ior: 1.5,
          clearcoat: 1.0,
          transparent: true,
          opacity: 0.88,
        });
        gState.beaconMat = roleBeaconMat;

        bClone.traverse((child) => {
          if (child.name === "Gate_BoomPivot") {
            gState.boomPivot = child;
          }
          if (!child.isMesh) return;
          ensureGeometryUv1(child.geometry);
          child.castShadow = true;
          child.receiveShadow = true;
          child.raycast = () => {};

          const origMat = child.material;
          const mName = origMat?.name || child.name || "";

          if (/Slate/i.test(mName) || child.name === "Board_SlateDeck") {
            child.material = sharedSlateMat;
            child.castShadow = false;
          } else if (/Beech/i.test(mName) || child.name === "Board_BeechFrame") {
            child.material = sharedBeechMat;
          } else if (/Brass/i.test(mName) || child.name === "Board_BrassPins") {
            if (!sharedBrassMat) {
              const baked = prepareBakedGlbMaps(origMat, 8);
              sharedBrassMat = new THREE.MeshPhysicalMaterial({
                name: "Mat_MachinedBrassPins",
                color: baked.map ? 0xffffff : 0xd6b26a,
                map: baked.map || null,
                normalMap: baked.normalMap || null,
                roughness: baked.roughnessMap ? 1.0 : 0.24,
                roughnessMap: baked.roughnessMap || null,
                metalness: baked.metalnessMap ? 1.0 : 0.92,
                metalnessMap: baked.metalnessMap || null,
                aoMap: baked.aoMap || null,
                aoMapIntensity: baked.aoMap ? 0.85 : 0.0,
                clearcoat: 0.25,
                envMapIntensity: 1.25,
              });
            }
            child.material = sharedBrassMat;
            if (child.name === "Board_BrassPins") child.castShadow = false;
          } else if (/GateBeacon/i.test(mName) || child.name === "Gate_Beacon") {
            child.material = roleBeaconMat;
            child.castShadow = false;
          } else if (/BoomRed/i.test(mName)) {
            child.material = sharedBoomRedMat;
          } else if (/BoomWhite/i.test(mName)) {
            child.material = sharedBoomWhiteMat;
          } else {
            if (!sharedGateDarkMat) {
              const baked = prepareBakedGlbMaps(origMat, 8);
              sharedGateDarkMat = new THREE.MeshStandardMaterial({
                name: "Mat_GateAnodizedCharcoal",
                color: baked.map ? 0xffffff : 0x2c3036,
                map: baked.map || null,
                normalMap: baked.normalMap || null,
                roughness: baked.roughnessMap ? 1.0 : 0.42,
                roughnessMap: baked.roughnessMap || null,
                metalness: baked.metalnessMap ? 1.0 : 0.68,
                metalnessMap: baked.metalnessMap || null,
                aoMap: baked.aoMap || null,
                aoMapIntensity: baked.aoMap ? 0.85 : 0.0,
              });
              injectWorldCohesionHook(sharedGateDarkMat, { bounceWeight: 0.7, goboWeight: 0.8 });
            }
            child.material = sharedGateDarkMat;
          }
        });

        targetContainer.add(bClone);

        // Soft ambient contact AO decal beneath beechwood board perimeter on white-oak table
        const boardAoPlane = new THREE.Mesh(sharedBoardAoGeo, sharedBoardAoMat);
        boardAoPlane.name = `BoardTableContactAO_${roleKey}`;
        boardAoPlane.rotation.x = -Math.PI * 0.5;
        boardAoPlane.position.set(0, tb.topY + 0.004, 0);
        boardAoPlane.raycast = () => {};
        targetContainer.add(boardAoPlane);

        // Silk-screened Row-3 (`F3`, localZ = -1.10) East exit-throat readiness chevron decal
        const roleChevronMat = new THREE.MeshBasicMaterial({
          map: chevronTex,
          color: 0xf4e3be,
          transparent: true,
          opacity: 0.36,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        });
        gState.throatChevronMat = roleChevronMat;

        const exitThroatMesh = new THREE.Mesh(sharedExitThroatGeo, roleChevronMat);
        exitThroatMesh.name = `ExitThroatSilkChevron_${roleKey}`;
        exitThroatMesh.position.set(
          BOARD6.innerHalf + 0.12,
          BOARD6.deckY + 0.009,
          BOARD6.cellToLocalZ(BOARD6.exitRow, 1)
        );
        exitThroatMesh.castShadow = false;
        exitThroatMesh.raycast = () => {};
        targetContainer.add(exitThroatMesh);

        return bClone;
      };

      humanBoardAssemblyRef = mountOneBoard6x6("human", humanBoardGroup);
      aiBoardAssemblyRef = mountOneBoard6x6("ai", aiBoardGroup);
    }

    // 6. Sculpted Walnut & Brushed-Brass Tabletop Plaques (`YOU` on foreground, dynamic AI Opponent on background)
    humanNameplate = createTabletopNameplate({
      name: "HumanTabletopPlaque",
      initialLabel: "YOU",
      isHuman: true,
      width: 4.5,
      depth: 1.12,
      height: 0.46,
      envTexture,
      radialAoTex,
      maxAniso: maxBoardAnisotropy,
    });
    humanNameplate.group.position.set(0, tb.topY, BOARD6.outerHalf + 1.02); // local z = +8.44 -> worldZ = +17.64
    humanBoardGroup.add(humanNameplate.group);

    aiNameplate = createTabletopNameplate({
      name: "AiOpponentTabletopPlaque",
      initialLabel: pendingAiLabel,
      isHuman: false,
      width: 7.8,
      depth: 1.16,
      height: 0.50,
      envTexture,
      radialAoTex,
      maxAniso: maxBoardAnisotropy,
    });
    aiNameplate.group.position.set(0, tb.topY, -(BOARD6.outerHalf + 2.22)); // local z = -9.64 -> worldZ = -18.84 (clears tall Row-1 vans in 3D!)
    aiBoardGroup.add(aiNameplate.group);

    // 7. Mount & Upgrade `kitchen_props.glb` positioned cleanly on the West (`x ~ -14.8`) white-oak flank
    if (kitchenPropsGltf && kitchenPropsGltf.scene) {
      const kpScene = kitchenPropsGltf.scene;
      const kitchenPropMatCache = new Map();

      const upgradeKitchenPropMeshes = (rootObj, allowRaycast = false) => {
        rootObj.traverse((child) => {
          if (!child.isMesh) return;
          ensureGeometryUv1(child.geometry);
          child.castShadow = true;
          child.receiveShadow = true;
          if (!allowRaycast) {
            child.raycast = () => {};
          }

          const origMat = child.material;
          const mName = origMat?.name || child.name || "";
          const cacheKey = `${origMat?.uuid || mName}`;
          if (/LatteArt/i.test(mName) || child.name === "Mug_LatteSurface") {
            child.castShadow = false;
          }
          if (kitchenPropMatCache.has(cacheKey)) {
            child.material = kitchenPropMatCache.get(cacheKey);
            return;
          }
          const baked = prepareBakedGlbMaps(origMat);

          if (/OatmealLinen/i.test(mName) || /WovenPaperCord/i.test(mName)) {
            const isCord = /PaperCord/i.test(mName);
            const fabricMat = new THREE.MeshPhysicalMaterial({
              name: mName,
              color: baked.map ? 0xffffff : isCord ? 0xded4c3 : 0xe8e0d3,
              map: baked.map || (isCord ? getPapercordTex() : getLinenTex()),
              normalMap: baked.normalMap || null,
              normalScale: new THREE.Vector2(0.85, 0.85),
              roughness: baked.roughnessMap ? 1.0 : 0.88,
              roughnessMap: baked.roughnessMap || null,
              metalness: 0.0,
              aoMap: baked.aoMap || null,
              aoMapIntensity: baked.aoMap ? 0.85 : 0.0,
              sheen: 0.72,
              sheenRoughness: 0.82,
              sheenColor: new THREE.Color(0xf6f0e4),
              envMapIntensity: 0.58,
            });
            injectWorldCohesionHook(fabricMat, { bounceWeight: 0.85, goboWeight: 0.85 });
            child.material = fabricMat;
          } else if (/Olive(?:Leaf|Stem)/i.test(mName) || /RosemaryLeaf/i.test(mName)) {
            const leafMat = new THREE.MeshStandardMaterial({
              name: mName,
              color: baked.map ? 0xffffff : 0x6f7d5c,
              map: baked.map || null,
              normalMap: null,
              roughness: 0.94,
              metalness: 0.0,
              aoMap: baked.aoMap || null,
              aoMapIntensity: baked.aoMap ? 0.72 : 0.0,
              emissive: new THREE.Color(0x3a4a24),
              emissiveIntensity: 0.06,
              side: THREE.DoubleSide,
              envMapIntensity: 0.16,
            });
            injectWorldCohesionHook(leafMat, { bounceWeight: 0.75, goboWeight: 0.35 });
            child.material = leafMat;
          } else if (/LatteArt/i.test(mName) || child.name === "Mug_LatteSurface") {
            const latteMat = new THREE.MeshPhysicalMaterial({
              name: "Mat_VelvetMicrofoamLatte",
              color: 0xffffff,
              map: baked.map || getLatteArtTex(),
              normalMap: baked.normalMap || null,
              normalScale: new THREE.Vector2(0.45, 0.45),
              roughness: baked.roughnessMap ? 1.0 : 0.22,
              roughnessMap: baked.roughnessMap || null,
              metalness: 0.0,
              aoMap: baked.aoMap || null,
              aoMapIntensity: baked.aoMap ? 0.75 : 0.0,
              clearcoat: 0.68,
              clearcoatRoughness: 0.14,
              envMapIntensity: 0.95,
            });
            child.material = latteMat;
            child.castShadow = false;
          } else if (/OatmealStoneware/i.test(mName)) {
            const mugMat = new THREE.MeshPhysicalMaterial({
              name: "Mat_SpeckledOatmealStoneware",
              color: baked.map ? 0xffffff : 0xe9e1d4,
              map: baked.map || getStonewareTex(),
              normalMap: baked.normalMap || null,
              normalScale: new THREE.Vector2(0.65, 0.65),
              roughness: baked.roughnessMap ? 1.0 : 0.24,
              roughnessMap: baked.roughnessMap || null,
              metalness: 0.0,
              aoMap: baked.aoMap || null,
              aoMapIntensity: baked.aoMap ? 0.85 : 0.0,
              clearcoat: 0.34,
              clearcoatRoughness: 0.22,
              envMapIntensity: 0.92,
            });
            injectWorldCohesionHook(mugMat, { bounceWeight: 0.85, goboWeight: 0.9 });
            child.material = mugMat;
          } else if (/BrushedSteel/i.test(mName) || child.name === "Spoon_EspressoSteel") {
            const steelMat = new THREE.MeshPhysicalMaterial({
              name: "Mat_EspressoSpoonBrushedSteel",
              color: new THREE.Color(0xb4aca0),
              map: baked.map || null,
              normalMap: baked.normalMap || null,
              roughness: baked.roughnessMap ? 1.0 : 0.36,
              roughnessMap: baked.roughnessMap || null,
              metalness: baked.metalnessMap ? 1.0 : 0.84,
              metalnessMap: baked.metalnessMap || null,
              aoMap: baked.aoMap || null,
              aoMapIntensity: baked.aoMap ? 0.85 : 0.0,
              anisotropy: 0.45,
              envMapIntensity: 0.58,
            });
            injectWorldCohesionHook(steelMat, { bounceWeight: 0.75, goboWeight: 0.8 });
            child.material = steelMat;
          } else {
            const stdMat = new THREE.MeshStandardMaterial({
              name: mName,
              color: baked.map ? 0xffffff : origMat?.color || 0xdcd3c4,
              map: baked.map || (/Cork/i.test(mName) ? getCorkTex() : null),
              normalMap: baked.normalMap || null,
              normalScale: new THREE.Vector2(0.75, 0.75),
              roughness: baked.roughnessMap ? 1.0 : origMat?.roughness ?? 0.65,
              roughnessMap: baked.roughnessMap || null,
              metalness: baked.metalnessMap ? 1.0 : origMat?.metalness ?? 0.02,
              metalnessMap: baked.metalnessMap || null,
              aoMap: baked.aoMap || null,
              aoMapIntensity: baked.aoMap ? 0.85 : 0.0,
              envMapIntensity: 0.78,
            });
            injectWorldCohesionHook(stdMat, { bounceWeight: 0.82, goboWeight: 0.85 });
            child.material = stdMat;
          }
          kitchenPropMatCache.set(cacheKey, child.material);
        });
      };

      const propAoMat = new THREE.MeshBasicMaterial({
        map: radialAoTex,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const staticPropAoGeos = [];

      const mugCupObj = kpScene.getObjectByName("Prop_MugCoasterCup");
      const napkinSpoonObj = kpScene.getObjectByName("Prop_NapkinSpoon");
      const mugX = Math.min(PHYSICAL_SCALE_SPEC.mugPlacement?.x ?? -14.8, -14.6);
      const mugZ = PHYSICAL_SCALE_SPEC.mugPlacement?.z ?? -2.4;
      const mugY = tb.topY;

      if (mugCupObj) {
        mugCupObj.position.set(mugX, mugY, mugZ);
        mugCupObj.rotation.set(0, 0.38, 0);
        upgradeKitchenPropMeshes(mugCupObj, false);
        propsGroup.add(mugCupObj);
        for (const candidateYaw of [0.38, -1.35, 1.85, -2.65]) {
          mugCupObj.rotation.set(0, candidateYaw, 0);
          mugCupObj.updateMatrixWorld(true);
          _tmpBox3.setFromObject(mugCupObj);
          if (
            _tmpBox3.min.x >= tb.xMin + 0.30 &&
            _tmpBox3.max.x <= -BOARD6.outerHalf - 1.2
          ) {
            break;
          }
        }
        mugGroupRef = mugCupObj;

        staticPropAoGeos.push(
          makeNonIndexedTransformedGeo(new THREE.PlaneGeometry(8.8, 8.8), {
            x: mugX,
            y: mugY + 0.004,
            z: mugZ,
            rx: -Math.PI * 0.5,
          })
        );

        const wispGeo = new THREE.PlaneGeometry(2.45, 4.45);
        for (let i = 0; i < 3; i++) {
          const wMat = new THREE.MeshBasicMaterial({
            map: steamWispTex,
            color: 0xfffaf0,
            transparent: true,
            opacity: 0.26,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const wMesh = new THREE.Mesh(wispGeo, wMat);
          wMesh.position.set(mugX + (i - 1) * 0.44, mugY + 5.75 + i * 0.72, mugZ + (i % 2 === 0 ? 0.20 : -0.20));
          wMesh.castShadow = false;
          wMesh.raycast = () => {};
          propsGroup.add(wMesh);
          steamWisps.push({
            mesh: wMesh,
            mat: wMat,
            baseX: mugX + (i - 1) * 0.40,
            baseY: mugY + 5.15,
            baseZ: mugZ,
            phase: i * 2.094,
          });
        }
      }

      if (napkinSpoonObj) {
        const napX = Math.min(PHYSICAL_SCALE_SPEC.napkinPlacement?.x ?? -15.2, -14.8);
        const napZ = PHYSICAL_SCALE_SPEC.napkinPlacement?.z ?? 6.8;
        const napY = tb.topY;
        napkinSpoonObj.position.set(napX, napY, napZ);
        napkinSpoonObj.rotation.set(0, -0.06, 0);
        upgradeKitchenPropMeshes(napkinSpoonObj, false);
        propsGroup.add(napkinSpoonObj);
        napkinGroupRef = napkinSpoonObj;

        staticPropAoGeos.push(
          makeNonIndexedTransformedGeo(new THREE.PlaneGeometry(8.4, 11.0), {
            x: napX,
            y: napY + 0.004,
            z: napZ,
            rx: -Math.PI * 0.5,
            ry: -0.06,
          })
        );
      }

      // Windowsill Olive & Rosemary Herb Planters
      const herbObj = kpScene.getObjectByName("Prop_KitchenHerbPlanters");
      if (herbObj && kitchenEnvRefs) {
        const anchor = kitchenEnvRefs.planterAnchorWorld;
        herbObj.position.copy(anchor);
        herbObj.rotation.set(0, 0.05, 0);
        upgradeKitchenPropMeshes(herbObj, false);

        herbObj.updateMatrixWorld(true);
        const invHerbMat = new THREE.Matrix4().copy(herbObj.matrixWorld).invert();
        const herbBuckets = new Map();
        herbObj.traverse((hm) => {
          if (!hm.isMesh || !hm.geometry || !hm.material) return;
          const g = hm.geometry.index ? hm.geometry.toNonIndexed() : hm.geometry.clone();
          g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(invHerbMat, hm.matrixWorld));
          for (const k of Object.keys(g.attributes)) {
            if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
          }
          if (!herbBuckets.has(hm.material.uuid)) {
            herbBuckets.set(hm.material.uuid, { mat: hm.material, geos: [] });
          }
          herbBuckets.get(hm.material.uuid).geos.push(g);
        });
        while (herbObj.children.length > 0) {
          herbObj.remove(herbObj.children[0]);
        }
        for (const bucket of herbBuckets.values()) {
          const merged = bucket.geos.length === 1 ? bucket.geos[0] : mergeGeometries(bucket.geos, false);
          if (!merged) continue;
          ensureGeometryUv1(merged);
          const m = new THREE.Mesh(merged, bucket.mat);
          m.castShadow = true;
          m.receiveShadow = true;
          m.raycast = () => {};
          herbObj.add(m);
        }

        worldRoot.add(herbObj);
        herbPlanterRef = herbObj;

        for (const ox of [-2.95, 2.95]) {
          staticPropAoGeos.push(
            makeNonIndexedTransformedGeo(new THREE.PlaneGeometry(5.8, 5.8), {
              x: anchor.x + ox,
              y: anchor.y + 0.015,
              z: anchor.z,
              rx: -Math.PI * 0.5,
            })
          );
        }
      }

      if (staticPropAoGeos.length > 0) {
        const mergedPropAo = new THREE.Mesh(mergeGeometries(staticPropAoGeos, false), propAoMat);
        mergedPropAo.name = "MergedStaticPropContactShadow";
        mergedPropAo.castShadow = false;
        mergedPropAo.receiveShadow = false;
        mergedPropAo.raycast = () => {};
        propsGroup.add(mergedPropAo);
      }

      // Scandinavian White-Oak & Woven Papercord Dining Chairs
      const chairObj = kpScene.getObjectByName("Chair_ScandiOak");
      if (chairObj) {
        upgradeKitchenPropMeshes(chairObj, false);
        chairObj.updateMatrixWorld(true);
        _tmpBox3.setFromObject(chairObj);
        const rawChairMaxY = Math.max(1.0, _tmpBox3.max.y - _tmpBox3.min.y);
        const basePlacements =
          Array.isArray(PHYSICAL_SCALE_SPEC.chairPlacements) && PHYSICAL_SCALE_SPEC.chairPlacements.length > 0
            ? PHYSICAL_SCALE_SPEC.chairPlacements
            : [
                { x: 25.4, z: -8.5, crestTopY: 4.15, yawRad: -1.46 },
                { x: -4.5, z: -24.5, crestTopY: 4.25, yawRad: 0.06 },
              ];

        const legCenters = [
          [tb.xMax - insetX, tb.zMax - insetZ],
          [tb.xMax - insetX, tb.zMin + insetZ],
          [tb.xMin + insetX, tb.zMax - insetZ],
          [tb.xMin + insetX, tb.zMin + insetZ],
        ];
        const vScratch = new THREE.Vector3();
        const qScratch = new THREE.Quaternion();
        const sScratch = new THREE.Vector3();
        const zRange = PHYSICAL_SCALE_SPEC.chairBacksZRangeUnits || [-34.0, -4.0];

        const measureChairUpperAndLegBounds = (px, pz, yawRad, scale) => {
          qScratch.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRad || 0);
          sScratch.set(scale, scale, scale);
          _tmpMat4.compose(new THREE.Vector3(px, floorY, pz), qScratch, sScratch);
          let upMinX = Infinity, upMaxX = -Infinity, upMinZ = Infinity, upMaxZ = -Infinity;
          let fullMinX = Infinity, fullMaxX = -Infinity, fullMinZ = Infinity, fullMaxZ = -Infinity;
          chairObj.traverse((part) => {
            if (!part.isMesh || !part.geometry?.attributes?.position) return;
            const posAttr = part.geometry.attributes.position;
            const step = Math.max(1, Math.floor(posAttr.count / 240));
            for (let vi = 0; vi < posAttr.count; vi += step) {
              vScratch.fromBufferAttribute(posAttr, vi).applyMatrix4(part.matrix).applyMatrix4(_tmpMat4);
              if (vScratch.x < fullMinX) fullMinX = vScratch.x;
              if (vScratch.x > fullMaxX) fullMaxX = vScratch.x;
              if (vScratch.z < fullMinZ) fullMinZ = vScratch.z;
              if (vScratch.z > fullMaxZ) fullMaxZ = vScratch.z;
              if (vScratch.y >= underSlabY - apronH - 0.35) {
                if (vScratch.x < upMinX) upMinX = vScratch.x;
                if (vScratch.x > upMaxX) upMaxX = vScratch.x;
                if (vScratch.z < upMinZ) upMinZ = vScratch.z;
                if (vScratch.z > upMaxZ) upMaxZ = vScratch.z;
              }
            }
          });
          return { upMinX, upMaxX, upMinZ, upMaxZ, fullMinX, fullMaxX, fullMinZ, fullMaxZ };
        };

        const tuckedPlacements = basePlacements.map((p) => {
          const targetH = (p.crestTopY ?? 4.15) - floorY;
          const s = targetH / rawChairMaxY;
          let px = p.x;
          let pz = p.z;
          const yaw = p.yawRad || 0;
          const b = measureChairUpperAndLegBounds(px, pz, yaw, s);
          const margin = 0.85;
          if (px > tb.xMax * 0.5 && b.upMinX < tb.xMax + margin) {
            px += tb.xMax + margin - b.upMinX;
          } else if (px < tb.xMin * 0.5 && b.upMaxX > tb.xMin - margin) {
            px -= b.upMaxX - (tb.xMin - margin);
          } else if (pz < tb.zMin * 0.5 && b.upMaxZ > tb.zMin - margin) {
            pz = Math.max(zRange[0] + 0.2, pz - (b.upMaxZ - (tb.zMin - margin)));
          }
          const b2 = measureChairUpperAndLegBounds(px, pz, yaw, s);
          for (const [lx, lz] of legCenters) {
            if (
              b2.fullMaxX > lx - 2.4 &&
              b2.fullMinX < lx + 2.4 &&
              b2.fullMaxZ > lz - 2.4 &&
              b2.fullMinZ < lz + 2.4
            ) {
              if (Math.abs(px - lx) >= Math.abs(pz - lz)) {
                px += px >= lx ? lx + 2.5 - b2.fullMinX : -(b2.fullMaxX - (lx - 2.5));
              } else {
                pz += pz >= lz ? lz + 2.5 - b2.fullMinZ : -(b2.fullMaxZ - (lz - 2.5));
              }
            }
          }
          return { x: px, z: pz, crestTopY: p.crestTopY ?? 4.15, yawRad: yaw };
        });

        chairInstancesRef = [];
        chairObj.traverse((part) => {
          if (!part.isMesh) return;
          const chairInst = new THREE.InstancedMesh(part.geometry, part.material, tuckedPlacements.length);
          chairInst.name = `Instanced_${part.name}`;
          chairInst.castShadow = true;
          chairInst.receiveShadow = true;
          chairInst.raycast = () => {};
          for (let i = 0; i < tuckedPlacements.length; i++) {
            const p = tuckedPlacements[i];
            const targetH = (p.crestTopY ?? 4.15) - floorY;
            const s = targetH / rawChairMaxY;
            _tmpMat4.compose(
              new THREE.Vector3(p.x, floorY, p.z),
              new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yawRad || 0),
              new THREE.Vector3(s, s, s)
            );
            chairInst.setMatrixAt(i, _tmpMat4);
          }
          chairInst.instanceMatrix.needsUpdate = true;
          chairInst.computeBoundingSphere();
          worldRoot.add(chairInst);
          chairInstancesRef.push(chairInst);
        });
      }
    }

    // 8. Extract All 10 Omni-Referenced Collector Vehicle Templates & Consolidate into Fleet-Wide `THREE.BatchedMesh` Pools
    if (vehiclesGltf && vehiclesGltf.scene) {
      vehiclesGltf.scene.updateMatrixWorld(true);
      const sharedBatchGroups = new Map();
      const paintBatchGroups = new Map();

      const stageSharedPart = (mat, castShadow, isWheel, rawMergedGeo, targetBindingArray) => {
        const normGeo = normalizeBatchGeometry(rawMergedGeo, Boolean(mat.vertexColors));
        if (!normGeo) return;
        const bKey = `${mat.uuid}__cs_${castShadow ? 1 : 0}`;
        let grp = sharedBatchGroups.get(bKey);
        if (!grp) {
          grp = {
            mat,
            castShadow: Boolean(castShadow),
            hasWheelParts: false,
            totalVertices: 0,
            items: [],
          };
          sharedBatchGroups.set(bKey, grp);
        }
        if (isWheel) grp.hasWheelParts = true;
        grp.totalVertices += normGeo.attributes.position.count;
        grp.items.push({ targetBindingArray, geom: normGeo });
      };

      for (const classKey of Object.keys(VEHICLE_CLASSES)) {
        const vSpec = VEHICLE_CLASSES[classKey];
        const glbNode =
          vehiclesGltf.scene.getObjectByName(vSpec.glbRootName) ||
          vehiclesGltf.scene.getObjectByName(`Vehicle_${classKey}`);
        if (!glbNode) continue;

        glbNode.updateMatrixWorld(true);
        const invRootMat = new THREE.Matrix4().copy(glbNode.matrixWorld).invert();

        let chassisNode = null;
        const wheelNodes = { FL: null, FR: null, RL: null, RR: null };
        glbNode.traverse((n) => {
          const nm = n.name || "";
          if (!chassisNode && !n.isMesh && /^Chassis(?:[._]\d+)?$/.test(nm)) {
            chassisNode = n;
          }
          const wm = nm.match(/^Wheel_(FL|FR|RL|RR)(?:[._]\d+)?$/);
          if (wm && !wheelNodes[wm[1]]) {
            wheelNodes[wm[1]] = n;
          }
        });

        const invChassisMat = chassisNode
          ? new THREE.Matrix4().copy(chassisNode.matrixWorld).invert()
          : invRootMat;

        const bodyPaintGeos = [];
        let bodyPaintOrigMat = null;
        const sharedChassisBuckets = new Map();
        const sharedBodyRigBuckets = new Map();

        const wheelSubtreeSet = new Set();
        for (const wn of Object.values(wheelNodes)) {
          if (wn) wn.traverse((c) => wheelSubtreeSet.add(c));
        }

        glbNode.traverse((mesh) => {
          if (!mesh.isMesh || wheelSubtreeSet.has(mesh)) return;
          const relMat = new THREE.Matrix4().multiplyMatrices(invChassisMat, mesh.matrixWorld);
          const mName = mesh.material?.name || "";

          if (/BodyPaint/i.test(mName)) {
            if (!bodyPaintOrigMat) bodyPaintOrigMat = mesh.material;
            const gRaw = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
            gRaw.applyMatrix4(relMat);
            const gNorm = normalizeBatchGeometry(gRaw, false);
            if (gNorm) bodyPaintGeos.push(gNorm);
          } else {
            const upMat = upgradeSharedVehicleMaterial(mesh.material);
            const gRaw = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
            gRaw.applyMatrix4(relMat);
            const gNorm = normalizeBatchGeometry(
              gRaw,
              Boolean(upMat.vertexColors),
              resolveBatchedTrimHex(mName, mesh.material)
            );
            if (!gNorm) return;
            const castShadow = /CreamRoof|Cargo|BoxBody|Canopy/i.test(mName);
            const bKey = `${upMat.uuid}__cs_${castShadow ? 1 : 0}`;
            if (!sharedChassisBuckets.has(bKey)) {
              sharedChassisBuckets.set(bKey, {
                mat: upMat,
                castShadow,
                geos: [],
              });
            }
            sharedChassisBuckets.get(bKey).geos.push(gNorm);
          }
        });

        let mergedBodyPaintGeo = null;
        if (bodyPaintGeos.length === 1) {
          mergedBodyPaintGeo = bodyPaintGeos[0];
        } else if (bodyPaintGeos.length > 1) {
          mergedBodyPaintGeo = normalizeBatchGeometry(mergeGeometries(bodyPaintGeos, false), false);
        }

        const chassisBindings = [];
        for (const bucket of sharedChassisBuckets.values()) {
          const merged = bucket.geos.length === 1 ? bucket.geos[0] : mergeGeometries(bucket.geos, false);
          if (merged) {
            stageSharedPart(bucket.mat, bucket.castShadow, false, merged, chassisBindings);
          }
        }

        const orderedKeys = ["FL", "FR", "RL", "RR"];
        const wheelRestSpecs = [];
        for (let wIdx = 0; wIdx < 4; wIdx++) {
          const wn = wheelNodes[orderedKeys[wIdx]];
          if (!wn) continue;
          const relWheelToRoot = new THREE.Matrix4().multiplyMatrices(invRootMat, wn.matrixWorld);
          const wPos = new THREE.Vector3();
          const wQuat = new THREE.Quaternion();
          const wScale = new THREE.Vector3();
          relWheelToRoot.decompose(wPos, wQuat, wScale);
          const cornerBindings = [];
          wheelRestSpecs.push({
            name: `Wheel_${orderedKeys[wIdx]}`,
            pos: wPos,
            quat: wQuat,
            scale: wScale,
            bindings: cornerBindings,
          });

          const invWheelMat = new THREE.Matrix4().copy(wn.matrixWorld).invert();
          const wheelCornerBuckets = new Map();

          wn.traverse((wMesh) => {
            if (!wMesh.isMesh) return;
            const mName = wMesh.material?.name || "";
            const isCaliper = /BrakeCaliper/i.test(mName);
            const upMat = upgradeSharedVehicleMaterial(wMesh.material, { isWheelPart: !isCaliper });

            if (isCaliper) {
              const gRaw = wMesh.geometry.index ? wMesh.geometry.toNonIndexed() : wMesh.geometry.clone();
              const relToRoot = new THREE.Matrix4().multiplyMatrices(invRootMat, wMesh.matrixWorld);
              gRaw.applyMatrix4(relToRoot);
              const gNorm = normalizeBatchGeometry(
                gRaw,
                Boolean(upMat.vertexColors),
                resolveBatchedTrimHex(mName, wMesh.material)
              );
              if (!gNorm) return;
              if (!sharedBodyRigBuckets.has(upMat.uuid)) {
                sharedBodyRigBuckets.set(upMat.uuid, { mat: upMat, geos: [] });
              }
              sharedBodyRigBuckets.get(upMat.uuid).geos.push(gNorm);
            } else {
              const gRaw = wMesh.geometry.index ? wMesh.geometry.toNonIndexed() : wMesh.geometry.clone();
              const relToPivot = new THREE.Matrix4().multiplyMatrices(invWheelMat, wMesh.matrixWorld);
              gRaw.applyMatrix4(relToPivot);
              const gNorm = normalizeBatchGeometry(
                gRaw,
                Boolean(upMat.vertexColors),
                resolveBatchedTrimHex(mName, wMesh.material)
              );
              if (!gNorm) return;
              const castShadow = /Tire/i.test(mName);
              const bKey = `${upMat.uuid}__cs_${castShadow ? 1 : 0}`;
              if (!wheelCornerBuckets.has(bKey)) {
                wheelCornerBuckets.set(bKey, {
                  mat: upMat,
                  castShadow,
                  geos: [],
                });
              }
              wheelCornerBuckets.get(bKey).geos.push(gNorm);
            }
          });

          for (const bucket of wheelCornerBuckets.values()) {
            const merged = bucket.geos.length === 1 ? bucket.geos[0] : mergeGeometries(bucket.geos, false);
            if (merged) {
              stageSharedPart(bucket.mat, bucket.castShadow, true, merged, cornerBindings);
            }
          }
        }

        const bodyRigBindings = [];
        for (const bucket of sharedBodyRigBuckets.values()) {
          const merged = bucket.geos.length === 1 ? bucket.geos[0] : mergeGeometries(bucket.geos, false);
          if (merged) {
            stageSharedPart(bucket.mat, false, false, merged, bodyRigBindings);
          }
        }

        const chassisRelPos = new THREE.Vector3();
        if (chassisNode) {
          new THREE.Matrix4().multiplyMatrices(invRootMat, chassisNode.matrixWorld).decompose(
            chassisRelPos,
            new THREE.Quaternion(),
            new THREE.Vector3()
          );
        }

        const tmplRecord = {
          classKey,
          spec: vSpec,
          chassisBasePos: chassisRelPos,
          mergedBodyPaintGeo,
          bodyPaintOrigMat,
          bodyPaintBindings: new Map(),
          chassisBindings,
          bodyRigBindings,
          wheelRestSpecs,
        };
        vehicleTemplates.set(classKey, tmplRecord);

        if (mergedBodyPaintGeo) {
          const paintSig = "fleet";
          let pGrp = paintBatchGroups.get(paintSig);
          if (!pGrp) {
            pGrp = { sampleOrigMat: bodyPaintOrigMat, totalVertices: 0, items: [] };
            paintBatchGroups.set(paintSig, pGrp);
          } else if (!pGrp.sampleOrigMat && bodyPaintOrigMat) {
            pGrp.sampleOrigMat = bodyPaintOrigMat;
          }
          pGrp.totalVertices += mergedBodyPaintGeo.attributes.position.count;
          pGrp.items.push({ tmpl: tmplRecord, geom: mergedBodyPaintGeo });
        }
      }

      for (const grp of sharedBatchGroups.values()) {
        const maxInstances = grp.hasWheelParts ? MAX_TOTAL_VEHICLES * 5 : MAX_TOTAL_VEHICLES * 2;
        const batchEntry = createConfiguredBatchedMesh({
          name: `Batch_Fleet_${grp.mat.name || "Shared"}_${grp.castShadow ? "Shadow" : "NoShadow"}`,
          mat: grp.mat,
          maxInstances,
          totalVertices: grp.totalVertices,
          castShadow: grp.castShadow,
          initColorTex: false,
        });
        for (const item of grp.items) {
          const geomId = batchEntry.mesh.addGeometry(item.geom);
          item.targetBindingArray.push({ batchEntry, geomId });
        }
      }

      for (const [paintSig, pGrp] of paintBatchGroups.entries()) {
        for (const tierKey of PAINT_FINISH_TIERS) {
          const tierMat = buildCalibratedTierPaintMaterial(tierKey, pGrp.sampleOrigMat);
          const batchEntry = createConfiguredBatchedMesh({
            name: `Batch_BodyPaint_${tierKey}_${paintSig.slice(0, 12)}`,
            mat: tierMat,
            maxInstances: MAX_TOTAL_VEHICLES * 2,
            totalVertices: pGrp.totalVertices,
            castShadow: true,
            initColorTex: true,
          });
          let firstGeomId = -1;
          for (const item of pGrp.items) {
            const geomId = batchEntry.mesh.addGeometry(item.geom);
            if (firstGeomId < 0) firstGeomId = geomId;
            item.tmpl.bodyPaintBindings.set(tierKey, { batchEntry, geomId });
          }
          if (firstGeomId >= 0) {
            const bootId = batchEntry.mesh.addInstance(firstGeomId);
            batchEntry.mesh.setColorAt(bootId, _batchBootstrapWhite);
            batchEntry.mesh.deleteInstance(bootId);
            batchEntry.colorBootstrapped = true;
          }
        }
      }
    }

    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    staticSun.shadow.autoUpdate = false;
    tel.staticShadowAutoUpdate = false;
    invalidateShadows();

    if (typeof window !== "undefined") {
      window.__sceneMetrics = getScaleDiagnostics();
      window.__getShadowDiagnostics = getVehicleShadowDiagnostics;
      window.getShadowDiagnostics = getVehicleShadowDiagnostics;
    }
  })();

  /**
   * Instantiates a collector 1:64 die-cast vehicle across all 10 `VEHICLE_CLASSES` on either
   * the `"human"` foreground board (`z = +9.2`) or `"ai"` background board (`z = -9.2`).
   *
   * Supports BOTH call forms seamlessly:
   *  1) `createVehicleInstance(vehicleClass, finishKey, { isTarget = false, carId = null, boardRole = "human", ... })`
   *  2) `createVehicleInstance({ id, carId, vehicleClass, finishKey, isTarget, boardRole = "human", ... })`
   */
  function createVehicleInstance(arg1, arg2, arg3) {
    let opts;
    if (arg1 && typeof arg1 === "object") {
      opts = arg1;
    } else {
      opts = {
        ...(arg3 && typeof arg3 === "object" ? arg3 : {}),
        vehicleClass: arg1,
        finishKey: arg2,
      };
    }

    const resolvedId = opts.carId ?? opts.id ?? null;
    const resolvedRole = opts.boardRole === "ai" ? "ai" : "human";
    const isTarget = Boolean(opts.isTarget);
    const length = Number(opts.length) || 2;
    const orientation = opts.orientation || "h";
    const finishKey = opts.finishKey || "glacier_silver";
    const rawClass = opts.vehicleClass || "sedan";

    const safeClass = VEHICLE_CLASSES[rawClass]
      ? rawClass
      : length >= 3
      ? "van"
      : isTarget
      ? "gt_coupe"
      : "sedan";
    const vSpec = VEHICLE_CLASSES[safeClass];
    const tmpl =
      vehicleTemplates.get(safeClass) ||
      vehicleTemplates.get(length >= 3 ? "van" : isTarget ? "gt_coupe" : "sedan");
    const isHoriz = String(orientation).toLowerCase().startsWith("h");
    const boardOff = BOARD_OFFSETS[resolvedRole] || BOARD_OFFSETS.human;

    const root = new THREE.Group();
    root.name = `VehicleRoot_${resolvedRole}_${resolvedId || safeClass}`;
    root.position.set(boardOff.x, 0, boardOff.z);
    root.rotation.y = isHoriz ? Math.PI * 0.5 : 0.0;
    root.userData = {
      carId: resolvedId,
      id: resolvedId,
      boardRole: resolvedRole,
    };
    vehicleLayer.add(root);

    const contactShadow = new THREE.Object3D();
    contactShadow.name = "ContactShadowPlane";
    contactShadow.position.y = 0.003;
    contactShadow.scale.set(vSpec.widthMeters * 1.18, 1.0, vSpec.lengthMeters * 1.12);
    root.add(contactShadow);

    const bodyRig = new THREE.Group();
    bodyRig.name = "BodyRig";
    bodyRig.userData = { carId: resolvedId, id: resolvedId, boardRole: resolvedRole };
    root.add(bodyRig);

    const haloMat = new THREE.MeshBasicMaterial({
      map: vehicleHaloTex,
      color: isTarget ? 0xe8c488 : 0xf2ead9,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const haloMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(vSpec.widthMeters * 1.24, vSpec.lengthMeters * 1.16),
      haloMat
    );
    haloMesh.name = "SelectionHaloShadowDecal";
    haloMesh.rotation.x = -Math.PI * 0.5;
    haloMesh.position.y = 0.010;
    haloMesh.visible = false;
    haloMesh.raycast = () => {};
    bodyRig.add(haloMesh);

    const hitProxyMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitProxy = new THREE.Mesh(
      new THREE.BoxGeometry(vSpec.widthMeters * 1.04, vSpec.heightMeters * 1.08, vSpec.lengthMeters * 1.02),
      hitProxyMat
    );
    hitProxy.name = "VehicleHitProxy";
    hitProxy.position.y = vSpec.heightMeters * 0.54;
    hitProxy.userData = { carId: resolvedId, id: resolvedId, boardRole: resolvedRole };
    if (resolvedRole !== "human") {
      // Prevent accidental raycast hits on AI opponent cars even if a caller doesn't filter userData.boardRole!
      hitProxy.raycast = () => {};
    }
    bodyRig.add(hitProxy);

    const chassis = new THREE.Group();
    chassis.name = "Chassis";
    chassis.userData = { carId: resolvedId, id: resolvedId, boardRole: resolvedRole };
    if (tmpl) {
      chassis.position.copy(tmpl.chassisBasePos);
    }
    bodyRig.add(chassis);

    const chassisLift = new THREE.Group();
    chassisLift.name = "ChassisHoverLift";
    chassisLift.userData = { carId: resolvedId, id: resolvedId, boardRole: resolvedRole };
    chassis.add(chassisLift);

    const brakeSpillMat = new THREE.MeshBasicMaterial({
      map: brakeSpillTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const brakeSpillMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.15), brakeSpillMat);
    brakeSpillMesh.name = "RearBrakeShadowSpill";
    brakeSpillMesh.rotation.x = -Math.PI * 0.5;
    brakeSpillMesh.position.set(0, 0.012, -vSpec.lengthMeters * 0.54);
    brakeSpillMesh.visible = false;
    brakeSpillMesh.raycast = () => {};
    bodyRig.add(brakeSpillMesh);

    const wheels = [];
    const perCarDisposables = [
      haloMat,
      hitProxyMat,
      hitProxy.geometry,
      haloMesh.geometry,
      brakeSpillMat,
      brakeSpillMesh.geometry,
    ];

    const resolvedPaintKey = isTarget ? "rosso_corsa" : finishKey || "glacier_silver";
    const resolvedPaintHex =
      resolvedPaintKey === "rosso_corsa"
        ? "#a50e15"
        : (CURATED_FINISHES[resolvedPaintKey] || CURATED_FINISHES.glacier_silver).hex;
    const paintColor = new THREE.Color(resolvedPaintHex);
    const paintTier = resolvePaintFinishTier(resolvedPaintKey, isTarget);

    let paintHandle = null;
    const chassisHandles = [];
    const bodyRigHandles = [];
    const wheelHandles = [];

    const allocSlot = (binding) => {
      if (!binding || !binding.batchEntry) return null;
      const bm = binding.batchEntry.mesh;
      if (bm.instanceCount >= bm.maxInstanceCount) return null;
      const instanceId = bm.addInstance(binding.geomId);
      bm.visible = true;
      return { mesh: bm, instanceId };
    };

    if (tmpl && (tmpl.mergedBodyPaintGeo || tmpl.chassisBindings.length > 0)) {
      const paintBinding = tmpl.bodyPaintBindings.get(paintTier);
      if (paintBinding) {
        paintHandle = allocSlot(paintBinding);
        if (paintHandle) {
          paintHandle.mesh.setColorAt(paintHandle.instanceId, paintColor);
        }
      }

      for (let i = 0; i < tmpl.chassisBindings.length; i++) {
        const h = allocSlot(tmpl.chassisBindings[i]);
        if (h) chassisHandles.push(h);
      }

      for (let i = 0; i < tmpl.bodyRigBindings.length; i++) {
        const h = allocSlot(tmpl.bodyRigBindings[i]);
        if (h) bodyRigHandles.push(h);
      }

      for (let wIdx = 0; wIdx < tmpl.wheelRestSpecs.length; wIdx++) {
        const ws = tmpl.wheelRestSpecs[wIdx];
        const wPivot = new THREE.Group();
        wPivot.name = ws.name;
        wPivot.position.copy(ws.pos);
        wPivot.quaternion.copy(ws.quat);
        wPivot.scale.copy(ws.scale);
        bodyRig.add(wPivot);
        wheels.push(wPivot);

        for (let bIdx = 0; bIdx < ws.bindings.length; bIdx++) {
          const h = allocSlot(ws.bindings[bIdx]);
          if (h) {
            wheelHandles.push({ mesh: h.mesh, instanceId: h.instanceId, wheelPivot: wPivot });
          }
        }
      }
    } else {
      const fallbackPaint = getCollectorBodyPaintMaterial(finishKey, isTarget, null);
      const fb = buildProceduralFallbackVehicle(
        safeClass,
        fallbackPaint,
        sharedGlassMat,
        upgradeSharedVehicleMaterial({ name: "Mat_Tire" }),
        sharedTaillightMat
      );
      while (fb.chassis.children.length > 0) {
        const c = fb.chassis.children[0];
        c.userData = { carId: resolvedId, id: resolvedId, boardRole: resolvedRole };
        chassisLift.add(c);
      }
      for (const w of fb.wheels) {
        bodyRig.add(w);
        wheels.push(w);
      }
    }

    const instRecord = {
      id: resolvedId,
      carId: resolvedId,
      boardRole: resolvedRole,
      classKey: safeClass,
      paintColor,
      paintHandle,
      chassisHandles,
      bodyRigHandles,
      wheelHandles,
      isTarget: Boolean(isTarget),
      root,
      bodyRig,
      chassis,
      chassisLift,
      wheels,
      contactShadow,
      haloMesh,
      haloMat,
      brakeSpillMesh,
      brakeSpillMat,
      highlightMode: "none",
      _hoverLiftY: 0.0,
      _hoverLiftTarget: 0.0,
      _targetHaloOpacity: 0.0,
      _lastShadowX: Infinity,
      _lastShadowY: Infinity,
      _lastShadowZ: Infinity,
      _lastShadowPitch: Infinity,
      _lastShadowRoll: Infinity,
      _lastChassisY: Infinity,
      _lastChassisPitch: Infinity,
    };

    activeVehicles.add(instRecord);
    spawnShadowFrames = Math.max(spawnShadowFrames, 4);
    invalidateShadows();

    const evalSurfY =
      typeof BOARD_PHYSICS?.evalExitSurfaceY === "function"
        ? BOARD_PHYSICS.evalExitSurfaceY
        : BOARD6.evalExitSurfaceY;

    const setTerrainPose = (pose = {}) => {
      if (typeof pose.x === "number") root.position.x = pose.x;
      if (typeof pose.y === "number") root.position.y = pose.y;
      else if (typeof pose.rootY === "number") root.position.y = pose.rootY;
      if (typeof pose.z === "number") root.position.z = pose.z;
      if (typeof pose.yawRad === "number") root.rotation.y = pose.yawRad;
      bodyRig.rotation.x = pose.pitchRad || 0.0;
      if (typeof pose.wheelSpinRad === "number") {
        for (let i = 0; i < wheels.length; i++) {
          wheels[i].rotation.x = pose.wheelSpinRad;
        }
      }
      const surfY = evalSurfY(root.position.x);
      contactShadow.position.y = surfY - root.position.y + 0.003;
    };

    const setChassisRoll = (rollRad = 0) => {
      chassis.rotation.z = rollRad || 0.0;
    };

    const setBrakeLight = (intensity = 0.15) => {
      const clamped = Math.max(0.08, Math.min(1.5, Number(intensity) || 0.15));
      const spillOp = Math.max(0.0, (clamped - 0.18) * 0.34);
      brakeSpillMat.opacity = spillOp;
      brakeSpillMesh.visible = spillOp > 0.005;
    };

    const setHighlight = (mode = "none") => {
      instRecord.highlightMode = mode || "none";
      if (mode === "dragging" || mode === "selected") {
        instRecord._hoverLiftTarget = 0.034;
        instRecord._targetHaloOpacity = 0.62;
      } else if (mode === "hover") {
        instRecord._hoverLiftTarget = 0.028;
        instRecord._targetHaloOpacity = 0.44;
      } else if (mode === "target_ready" || mode === "hint") {
        instRecord._hoverLiftTarget = 0.016;
        instRecord._targetHaloOpacity = 0.38;
      } else {
        instRecord._hoverLiftTarget = 0.0;
        instRecord._targetHaloOpacity = 0.0;
      }
    };

    let isDisposed = false;
    const dispose = () => {
      if (isDisposed) return;
      isDisposed = true;
      activeVehicles.delete(instRecord);

      if (paintHandle) {
        paintHandle.mesh.deleteInstance(paintHandle.instanceId);
        paintHandle = null;
      }
      for (let i = 0; i < chassisHandles.length; i++) {
        chassisHandles[i].mesh.deleteInstance(chassisHandles[i].instanceId);
      }
      chassisHandles.length = 0;
      for (let i = 0; i < bodyRigHandles.length; i++) {
        bodyRigHandles[i].mesh.deleteInstance(bodyRigHandles[i].instanceId);
      }
      bodyRigHandles.length = 0;
      for (let i = 0; i < wheelHandles.length; i++) {
        wheelHandles[i].mesh.deleteInstance(wheelHandles[i].instanceId);
      }
      wheelHandles.length = 0;

      for (let pIdx = 0; pIdx < vehicleInstancedPools.length; pIdx++) {
        const bm = vehicleInstancedPools[pIdx].mesh;
        bm.visible = bm.instanceCount > 0;
      }

      if (root.parent) root.parent.remove(root);
      for (const d of perCarDisposables) {
        d?.dispose?.();
      }
      invalidateShadows();
    };

    return {
      id: resolvedId,
      carId: resolvedId,
      boardRole: resolvedRole,
      boardOffset: boardOff,
      root,
      bodyRig,
      chassis,
      wheels,
      wheelRadius: vSpec.wheelRadius,
      setTerrainPose,
      setChassisRoll,
      setBrakeLight,
      setHighlight,
      dispose,
    };
  }

  /**
   * Synchronizes all fleet-wide `THREE.BatchedMesh` instance matrices & per-board visibility
   * (`onlyBoardRole = "ai"` hides `"human"` cars cleanly inside `BatchedMesh` during `captureAiBoardPng`!).
   */
  function syncVehicleInstancedPools(onlyBoardRole = null) {
    const evalSurfY =
      typeof BOARD_PHYSICS?.evalExitSurfaceY === "function"
        ? BOARD_PHYSICS.evalExitSurfaceY
        : BOARD6.evalExitSurfaceY;

    let csIdx = 0;
    for (const inst of activeVehicles) {
      const isVis =
        inst.root.visible !== false && (!onlyBoardRole || inst.boardRole === onlyBoardRole);

      if (isVis) {
        const surfY = evalSurfY(inst.root.position.x);
        inst.contactShadow.position.y = surfY - inst.root.position.y + 0.003;
        inst.contactShadow.updateMatrixWorld(false);
        if (csIdx < MAX_TOTAL_VEHICLES) {
          contactShadowInstMesh.setMatrixAt(csIdx, inst.contactShadow.matrixWorld);
          csIdx += 1;
        }
      }

      const liftMat = inst.chassisLift.matrixWorld;
      if (inst.paintHandle) {
        if (typeof inst.paintHandle.mesh.setVisibleAt === "function") {
          inst.paintHandle.mesh.setVisibleAt(inst.paintHandle.instanceId, isVis);
        }
        if (isVis) {
          inst.paintHandle.mesh.setMatrixAt(inst.paintHandle.instanceId, liftMat);
        }
      }

      const cHandles = inst.chassisHandles;
      for (let i = 0; i < cHandles.length; i++) {
        if (typeof cHandles[i].mesh.setVisibleAt === "function") {
          cHandles[i].mesh.setVisibleAt(cHandles[i].instanceId, isVis);
        }
        if (isVis) {
          cHandles[i].mesh.setMatrixAt(cHandles[i].instanceId, liftMat);
        }
      }

      const rHandles = inst.bodyRigHandles;
      const rigMat = inst.bodyRig.matrixWorld;
      for (let i = 0; i < rHandles.length; i++) {
        if (typeof rHandles[i].mesh.setVisibleAt === "function") {
          rHandles[i].mesh.setVisibleAt(rHandles[i].instanceId, isVis);
        }
        if (isVis) {
          rHandles[i].mesh.setMatrixAt(rHandles[i].instanceId, rigMat);
        }
      }

      const wHandles = inst.wheelHandles;
      for (let i = 0; i < wHandles.length; i++) {
        const wh = wHandles[i];
        if (typeof wh.mesh.setVisibleAt === "function") {
          wh.mesh.setVisibleAt(wh.instanceId, isVis);
        }
        if (isVis) {
          wh.mesh.setMatrixAt(wh.instanceId, wh.wheelPivot.matrixWorld);
        }
      }
    }

    contactShadowInstMesh.count = csIdx;
    contactShadowInstMesh.visible = csIdx > 0;
    if (csIdx > 0) {
      contactShadowInstMesh.instanceMatrix.needsUpdate = true;
    }

    for (let pIdx = 0; pIdx < vehicleInstancedPools.length; pIdx++) {
      const bm = vehicleInstancedPools[pIdx].mesh;
      bm.visible = bm.instanceCount > 0;
    }
  }

  /**
   * Marks `heroSun` (`4096x4096`) dirty whenever any vehicle or either board's exit gate moves.
   */
  function syncHeroShadowDirtyState() {
    let dirty = false;
    if (spawnShadowFrames > 0) {
      spawnShadowFrames -= 1;
      dirty = true;
    }

    let maxRolloutX = BOARD6.innerHalf;
    for (const inst of activeVehicles) {
      const p = inst.root.position;
      if (p.x > maxRolloutX) {
        maxRolloutX = p.x;
      }
      const pitch = inst.bodyRig.rotation.x;
      const roll = inst.chassis.rotation.z;
      const cy = inst.chassis.position.y + inst.chassisLift.position.y;
      const cp = inst.chassis.rotation.x;

      if (
        !Number.isFinite(inst._lastShadowX) ||
        Math.abs(p.x - inst._lastShadowX) > 2e-4 ||
        Math.abs(p.y - inst._lastShadowY) > 2e-4 ||
        Math.abs(p.z - inst._lastShadowZ) > 2e-4 ||
        Math.abs(pitch - inst._lastShadowPitch) > 3e-4 ||
        Math.abs(roll - inst._lastShadowRoll) > 3e-4 ||
        Math.abs(cy - inst._lastChassisY) > 2e-4 ||
        Math.abs(cp - inst._lastChassisPitch) > 3e-4
      ) {
        inst._lastShadowX = p.x;
        inst._lastShadowY = p.y;
        inst._lastShadowZ = p.z;
        inst._lastShadowPitch = pitch;
        inst._lastShadowRoll = roll;
        inst._lastChassisY = cy;
        inst._lastChassisPitch = cp;
        dirty = true;
      }
    }

    const desiredTargetX = Math.max(
      0.5,
      Math.min(2.6, 0.5 + Math.max(0.0, maxRolloutX - BOARD6.innerHalf) * 0.24)
    );
    if (Math.abs(desiredTargetX - lastHeroTargetX) > 1e-4) {
      lastHeroTargetX = desiredTargetX;
      heroSun.target.position.set(lastHeroTargetX, 0.0, 0.0);
      heroSun.target.updateMatrixWorld(true);
      heroSun.position.copy(heroSun.target.position).addScaledVector(sunDirection, 68.0);
      dirty = true;
    }

    for (const roleKey of ["human", "ai"]) {
      const gs = gateStates[roleKey];
      if (gs.boomPivot) {
        const gAng = gs.boomPivot.rotation.x;
        if (!Number.isFinite(gs.lastShadowAngle) || Math.abs(gAng - gs.lastShadowAngle) > 1e-5) {
          gs.lastShadowAngle = gAng;
          dirty = true;
        }
      }
    }

    if (dirty) {
      invalidateShadows();
    }
  }

  /**
   * Sets the East Exit Gate state (`isOpen`) independently for `"human"`, `"ai"`, or `"both"`.
   * Accepts `(isOpen, boardRole = "human", { immediate = false })` OR `({ isOpen, boardRole, immediate })`.
   */
  function setExitGateState(arg1, arg2, arg3) {
    let isOpen = false;
    let boardRole = "human";
    let immediate = false;

    if (arg1 && typeof arg1 === "object") {
      isOpen = Boolean(arg1.isOpen);
      boardRole = arg1.boardRole || "human";
      immediate = Boolean(arg1.immediate);
    } else {
      isOpen = Boolean(arg1);
      if (typeof arg2 === "string") {
        boardRole = arg2;
        immediate = Boolean(arg3 && typeof arg3 === "object" ? arg3.immediate : arg3);
      } else if (arg2 && typeof arg2 === "object") {
        boardRole = arg2.boardRole || "human";
        immediate = Boolean(arg2.immediate);
      }
    }

    const rolesToUpdate =
      boardRole === "both" ? ["human", "ai"] : [boardRole === "ai" ? "ai" : "human"];

    for (const rk of rolesToUpdate) {
      const gs = gateStates[rk];
      gs.isOpen = isOpen;
      const targetAng = isOpen ? 1.42 : 0.0;
      if (immediate) {
        gs.angle = targetAng;
        gs.vel = 0.0;
        if (gs.boomPivot) {
          gs.boomPivot.rotation.x = -gs.angle;
        }
      }
      if (gs.beaconMat) {
        if (isOpen) {
          gs.beaconMat.color.setHex(0x2f8f5b);
          gs.beaconMat.emissive.setHex(0x1f7a48);
          gs.beaconMat.emissiveIntensity = 0.45;
        } else {
          gs.beaconMat.color.setHex(0xb8342a);
          gs.beaconMat.emissive.setHex(0x8a1812);
          gs.beaconMat.emissiveIntensity = 0.32;
        }
      }
    }
    invalidateShadows();
  }

  /**
   * Updates the tactile warm-ivory/gold corridor slide guide on the foreground `"human"` board (`z + 9.2`).
   */
  function setCorridorGuide({
    visible = false,
    orientation = "h",
    fixedIndex = BOARD6.exitRow,
    minCell = 0,
    maxCell = 0,
    carLength = 2,
    isTarget = false,
    boardRole = "human",
  } = {}) {
    if (!visible || maxCell <= minCell) {
      corridorMesh.visible = false;
      return;
    }
    const roleOff = BOARD_OFFSETS[boardRole === "ai" ? "ai" : "human"];
    const cellSize = GRID_SPEC?.cellSize || BOARD6.cellSize;
    const isH = String(orientation || "h").toLowerCase().startsWith("h");
    const spanCells = maxCell - minCell + carLength;
    const lengthWorld = spanCells * cellSize - 0.24;
    const widthWorld = cellSize * 0.76;

    corridorRailMat.color.setHex(isTarget ? 0xebd09a : 0xf2ead9);
    corridorRailMat.opacity = isTarget ? 0.28 : 0.19;

    if (isH) {
      const xStart = BOARD6.cellToLocalX(minCell, 1) - cellSize * 0.5;
      const cx = xStart + (spanCells * cellSize) * 0.5 + roleOff.x;
      const cz = BOARD6.cellToLocalZ(fixedIndex, 1) + roleOff.z;
      corridorMesh.position.set(cx, BOARD6.deckY + 0.007, cz);
      corridorMesh.scale.set(lengthWorld, 1, widthWorld);
    } else {
      const zStart = BOARD6.cellToLocalZ(minCell, 1) - cellSize * 0.5;
      const cz = zStart + (spanCells * cellSize) * 0.5 + roleOff.z;
      const cx = BOARD6.cellToLocalX(fixedIndex, 1) + roleOff.x;
      corridorMesh.position.set(cx, BOARD6.deckY + 0.007, cz);
      corridorMesh.scale.set(widthWorld, 1, lengthWorld);
    }
    corridorMesh.visible = true;
  }

  /**
   * Positions the directional chevron hint on the foreground `"human"` board (`z + 9.2`).
   */
  function setHintIndicator(hint = {}) {
    if (!hint || !hint.visible) {
      hintGroup.visible = false;
      return;
    }
    const roleOff = BOARD_OFFSETS[hint.boardRole === "ai" ? "ai" : "human"];
    const isH = String(hint.orientation || "h").toLowerCase().startsWith("h");
    const dirSign =
      typeof hint.dirX === "number" && Math.abs(hint.dirX) > 0.1
        ? Math.sign(hint.dirX)
        : typeof hint.dirZ === "number" && Math.abs(hint.dirZ) > 0.1
        ? Math.sign(hint.dirZ)
        : typeof hint.direction === "number"
        ? Math.sign(hint.direction)
        : 1;

    const wx =
      typeof hint.worldX === "number"
        ? hint.worldX
        : (isH
            ? BOARD6.cellToLocalX(hint.col ?? 0, hint.carLength ?? 2)
            : BOARD6.cellToLocalX(hint.col ?? 0, 1)) + roleOff.x;

    // Accept either board-local `worldZ` (`|z| <= 6.7`) or world-space `worldZ` (`|z| > 6.7`) seamlessly
    let wz;
    if (typeof hint.worldZ === "number") {
      wz = Math.abs(hint.worldZ) <= 6.7 ? hint.worldZ + roleOff.z : hint.worldZ;
    } else {
      wz =
        (!isH
          ? BOARD6.cellToLocalZ(hint.row ?? 0, hint.carLength ?? 2)
          : BOARD6.cellToLocalZ(hint.row ?? 0, 1)) + roleOff.z;
    }

    const halfLen = ((hint.carLength ?? 2) * BOARD6.cellSize) * 0.5 + 0.42;
    if (isH) {
      hintGroup.position.set(wx + dirSign * halfLen, BOARD6.deckY + 0.016, wz);
      hintGroup.rotation.y = dirSign >= 0 ? 0 : Math.PI;
    } else {
      hintGroup.position.set(wx, BOARD6.deckY + 0.016, wz + dirSign * halfLen);
      hintGroup.rotation.y = dirSign >= 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
    }
    hintGroup.visible = true;
  }

  /**
   * Computes aspect-aware camera preset (`refAspect = 1.15` matches the 66% dual-board stage column on 16:9).
   */
  function resolveResponsivePreset(mode = "3d", aspect = camera.aspect || 1.18) {
    const safeMode = CAMERA_PRESETS[mode] ? mode : "3d";
    const base = CAMERA_PRESETS[safeMode];
    const safeAspect = Math.max(0.42, Number(aspect) || 1.18);
    const refAspect = 1.15;
    if (safeAspect >= refAspect) {
      return {
        pos: base.pos.clone(),
        target: base.target.clone(),
        fov: base.fov,
        dofFocusRange: base.dofFocusRange,
        dofMaxBlurPx: base.dofMaxBlurPx,
      };
    }

    const mobileT = safeAspect < 0.90 ? Math.min(1.0, (0.90 - safeAspect) / (0.90 - 0.45)) : 0.0;
    const fov = base.fov + (safeMode === "top" ? 12.0 : 10.0) * mobileT;
    const tanRatio = Math.tan((base.fov * Math.PI) / 360) / Math.tan((fov * Math.PI) / 360);
    const distScale = Math.min(1.75, (refAspect / safeAspect) * tanRatio);

    if (safeMode === "top") {
      const target = base.target.clone();
      const camY = Math.min(controls.maxDistance - 2.0, base.pos.y * distScale);
      return {
        pos: new THREE.Vector3(target.x, camY, target.z + 0.06),
        target,
        fov,
        dofFocusRange: base.dofFocusRange * distScale,
        dofMaxBlurPx: 0.0,
      };
    }

    const target = base.target.clone();
    const offset = base.pos.clone().sub(base.target);
    const maxAllowedScale = (controls.maxDistance - 2.0) / Math.max(1.0, offset.length());
    offset.multiplyScalar(Math.min(distScale, maxAllowedScale));
    return {
      pos: target.clone().add(offset),
      target,
      fov,
      dofFocusRange: base.dofFocusRange * distScale,
      dofMaxBlurPx: base.dofMaxBlurPx * (1.0 - 0.15 * mobileT),
    };
  }

  function applyOpeningSettlePose() {
    const preset = resolveResponsivePreset("3d", camera.aspect || 1.18);
    if (openingSettleRemaining <= 0.0) {
      camera.position.copy(preset.pos);
      controls.target.copy(preset.target);
    } else {
      const u = Math.min(
        1.0,
        Math.max(0.0, 1.0 - openingSettleRemaining / OPENING_SETTLE_DURATION)
      );
      const quintic = u * u * u * (10.0 + u * (-15.0 + 6.0 * u));
      const easeOut = 1.0 - Math.pow(1.0 - u, 4);
      const ease = 0.55 * quintic + 0.45 * easeOut;

      _settleRay.copy(preset.pos).sub(preset.target).normalize();
      _settleStartPos
        .copy(preset.pos)
        .addScaledVector(_settleRay, 2.4)
        .add(_tmpVec3.set(-1.4, 1.0, 0.0));
      _settleStartTarget.set(preset.target.x - 0.20, preset.target.y + 0.08, preset.target.z);

      camera.position.lerpVectors(_settleStartPos, preset.pos, ease);
      controls.target.lerpVectors(_settleStartTarget, preset.target, ease);
    }

    if (Math.abs(camera.fov - preset.fov) > 1e-4) {
      camera.fov = preset.fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(controls.target);
    controls.syncFromCamera();

    currentDofFocusDist = camera.position.distanceTo(controls.target);
    currentDofFocusRange = preset.dofFocusRange;
    currentDofMaxBlurPx = preset.dofMaxBlurPx;
    agxComposer.setDoF({
      focusDist: currentDofFocusDist,
      focusRange: currentDofFocusRange,
      maxBlurPx: isSoftwareGl ? 0.0 : currentDofMaxBlurPx,
    });
  }

  /**
   * Switches between `"3d"` (Dual-Board Race View), `"top"` (Overhead Flat-Lay), and `"macro"` (Collector Grazing).
   */
  function setCameraMode(mode = "3d", immediate = false) {
    const safeMode = CAMERA_PRESETS[mode] ? mode : "3d";
    currentCameraMode = safeMode;
    lastLiveRenderEndMs = -Infinity;
    const preset = resolveResponsivePreset(safeMode, camera.aspect || 1.18);

    targetDofFocusRange = preset.dofFocusRange;
    targetDofMaxBlurPx = preset.dofMaxBlurPx;
    controls.enabled = safeMode !== "top";

    if (
      safeMode !== "3d" ||
      !immediate ||
      state.isAutoplay ||
      (state.race && state.race.phase !== "setup")
    ) {
      openingSettleRemaining = 0.0;
    }

    if (immediate) {
      camGlideActive = false;
      if (openingSettleRemaining > 0.0 && safeMode === "3d") {
        applyOpeningSettlePose();
      } else {
        camera.position.copy(preset.pos);
        camera.fov = preset.fov;
        camera.updateProjectionMatrix();
        controls.target.copy(preset.target);
        camera.lookAt(controls.target);
        controls.syncFromCamera();
        currentDofFocusDist = camera.position.distanceTo(controls.target);
        currentDofFocusRange = targetDofFocusRange;
        currentDofMaxBlurPx = targetDofMaxBlurPx;
        agxComposer.setDoF({
          focusDist: currentDofFocusDist,
          focusRange: currentDofFocusRange,
          maxBlurPx: isSoftwareGl ? 0.0 : currentDofMaxBlurPx,
        });
      }
    } else {
      camGlideActive = true;
      camGlideElapsed = 0.0;
      camGlideStartPos.copy(camera.position);
      camGlideStartTarget.copy(controls.target);
      camGlideStartFov = camera.fov;
      camGlideEndPos.copy(preset.pos);
      camGlideEndTarget.copy(preset.target);
      camGlideEndFov = preset.fov;
    }
  }

  function resetCameraToHero() {
    if ((state.frameCount || 0) > 1) {
      openingSettleRemaining = 0.0;
    }
    setCameraMode(state.cameraMode || currentCameraMode || "3d", true);
  }

  function interruptOpeningSettle() {
    openingSettleRemaining = 0.0;
  }

  function pickChallengeCardStand() {
    return false;
  }

  function triggerCardFlip() {}

  /**
   * Advances dual-board gate counterweight springs, vehicle suspension hover preload,
   * latte steam wisps, smooth camera/DoF transitions, and dynamic hero shadow invalidation.
   */
  function updateWorld(dt = 1 / 60, elapsed = 0) {
    const safeDt = Math.min(Math.max(Number(dt) || 1 / 60, 1 / 240), 0.1);

    // Keep AI nameplate synced if `state.race.opponentLabel` mutated directly
    const liveOpponentLabel = state.race?.opponentLabel;
    if (liveOpponentLabel && liveOpponentLabel !== pendingAiLabel) {
      setAiOpponentLabel(liveOpponentLabel);
    }

    let justAppliedSettle = false;
    if (openingSettleRemaining > 0 && !camGlideActive && currentCameraMode === "3d") {
      if (controls._isDragging || state.isAutoplay || (state.race && state.race.phase !== "setup")) {
        openingSettleRemaining = 0.0;
      } else {
        openingSettleRemaining = Math.max(0.0, openingSettleRemaining - safeDt);
        applyOpeningSettlePose();
        justAppliedSettle = true;
      }
    }

    if (camGlideActive) {
      camGlideElapsed += safeDt;
      const t = Math.min(1.0, camGlideElapsed / CAM_GLIDE_DURATION);
      const ease = 1.0 - Math.pow(1.0 - t, 4);
      camera.position.lerpVectors(camGlideStartPos, camGlideEndPos, ease);
      controls.target.lerpVectors(camGlideStartTarget, camGlideEndTarget, ease);
      const nextFov = camGlideStartFov + (camGlideEndFov - camGlideStartFov) * ease;
      if (Math.abs(nextFov - camera.fov) > 1e-4) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
      camera.lookAt(controls.target);
      controls.syncFromCamera();
      if (t >= 1.0) {
        camGlideActive = false;
      }
    } else if (
      currentCameraMode !== "top" &&
      !justAppliedSettle &&
      (controls._isDragging ||
        Math.abs(controls._sphericalDelta.theta) > 1e-7 ||
        Math.abs(controls._sphericalDelta.phi) > 1e-7 ||
        Math.abs(controls._scale - 1.0) > 1e-7)
    ) {
      controls.update();
    }

    const desiredFocusDist = camera.position.distanceTo(controls.target);
    const dofAlpha = justAppliedSettle ? 1.0 : Math.min(1.0, safeDt * 10.0);
    currentDofFocusDist += (desiredFocusDist - currentDofFocusDist) * dofAlpha;
    currentDofFocusRange += (targetDofFocusRange - currentDofFocusRange) * dofAlpha;
    currentDofMaxBlurPx += (targetDofMaxBlurPx - currentDofMaxBlurPx) * dofAlpha;
    agxComposer.setDoF({
      focusDist: currentDofFocusDist,
      focusRange: currentDofFocusRange,
      maxBlurPx:
        isSoftwareGl || (currentCameraMode === "top" && !camGlideActive) ? 0.0 : currentDofMaxBlurPx,
    });

    // Sub-Stepped Independent Exit Gate Boom Counterweight Springs (`human` & `ai`)
    const gateSubSteps = Math.max(1, Math.ceil(safeDt / (1 / 60)));
    const gateH = safeDt / gateSubSteps;
    for (const rk of ["human", "ai"]) {
      const gs = gateStates[rk];
      const targetGateAngle = gs.isOpen ? 1.42 : 0.0;
      for (let s = 0; s < gateSubSteps; s++) {
        const gateForce = (targetGateAngle - gs.angle) * 145.0 - gs.vel * 14.5;
        gs.vel += gateForce * gateH;
        gs.angle += gs.vel * gateH;
      }
      if (Math.abs(targetGateAngle - gs.angle) < 1e-4 && Math.abs(gs.vel) < 1e-4) {
        gs.angle = targetGateAngle;
        gs.vel = 0.0;
      }
      if (gs.boomPivot) {
        gs.boomPivot.rotation.x = -gs.angle;
      }
      if (gs.beaconMat) {
        gs.beaconMat.emissiveIntensity = gs.isOpen
          ? 0.48 + 0.14 * Math.sin(elapsed * 3.1)
          : 0.36 + 0.12 * Math.sin(elapsed * 2.6);
      }
      if (gs.throatChevronMat) {
        gs.throatChevronMat.opacity = gs.isOpen
          ? 0.50 + 0.22 * Math.sin(elapsed * 3.6)
          : 0.34 + 0.18 * Math.sin(elapsed * 2.8);
      }
    }

    const liftBlend = Math.min(1.0, safeDt * 18.0);
    for (const inst of activeVehicles) {
      const nextLift = inst._hoverLiftY + (inst._hoverLiftTarget - inst._hoverLiftY) * liftBlend;
      inst._hoverLiftY = Math.abs(nextLift) < 1e-4 && inst._hoverLiftTarget === 0 ? 0.0 : nextLift;
      inst.chassisLift.position.y = inst._hoverLiftY;

      let haloTarget = inst._targetHaloOpacity;
      if (inst.highlightMode === "target_ready" || inst.highlightMode === "hint") {
        haloTarget *= 0.72 + 0.28 * Math.sin(elapsed * 4.2);
      }
      const nextHalo = inst.haloMat.opacity + (haloTarget - inst.haloMat.opacity) * liftBlend;
      inst.haloMat.opacity = nextHalo < 0.005 ? 0.0 : nextHalo;
      inst.haloMesh.visible = inst.haloMat.opacity > 0.005;
    }

    if (hintGroup.visible) {
      for (let i = 0; i < hintChevrons.length; i++) {
        const wave = 0.5 + 0.5 * Math.sin(elapsed * 5.2 - i * 0.9);
        hintChevrons[i].position.x = i * 0.58 + wave * 0.14;
      }
      hintChevronMat.opacity = 0.55 + 0.35 * Math.sin(elapsed * 4.6);
    }

    for (let i = 0; i < steamWisps.length; i++) {
      const w = steamWisps[i];
      const cyc = ((elapsed * 0.38 + w.phase / (Math.PI * 2)) % 1.0 + 1.0) % 1.0;
      const bell = Math.pow(Math.max(0.0, Math.sin(cyc * Math.PI)), 0.85);
      w.mesh.position.set(
        w.baseX + Math.sin(elapsed * 1.35 + w.phase) * (0.22 + 0.18 * cyc),
        w.baseY + cyc * 3.35,
        w.baseZ + Math.cos(elapsed * 1.05 + w.phase) * (0.16 + 0.14 * cyc)
      );
      w.mesh.rotation.y = Math.atan2(
        camera.position.x - w.mesh.position.x,
        camera.position.z - w.mesh.position.z
      );
      w.mesh.rotation.z = Math.sin(elapsed * 1.2 + w.phase) * 0.08;
      const scaleW = 0.92 + 0.28 * cyc;
      w.mesh.scale.set(scaleW, 0.95 + 0.20 * cyc, 1.0);
      w.mat.opacity = 0.32 * bell;
    }

    syncHeroShadowDirtyState();
  }

  function getVehicleShadowDiagnostics() {
    scene.updateMatrixWorld(true);
    const sCam = heroSun.shadow.camera;
    heroSun.updateMatrixWorld(true);
    sCam.updateMatrixWorld(true);
    const invLightMat = new THREE.Matrix4().copy(sCam.matrixWorld).invert();

    const evalInsideHeroFrustum = (worldVec) => {
      _tmpVec3.copy(worldVec).applyMatrix4(invLightMat);
      return {
        lightSpaceX: +_tmpVec3.x.toFixed(3),
        lightSpaceY: +_tmpVec3.y.toFixed(3),
        insideHeroShadowFrustum:
          _tmpVec3.x >= sCam.left &&
          _tmpVec3.x <= sCam.right &&
          _tmpVec3.y >= sCam.bottom &&
          _tmpVec3.y <= sCam.top,
      };
    };

    const cars = [];
    for (const inst of activeVehicles) {
      const f = evalInsideHeroFrustum(inst.root.position);
      cars.push({
        id: inst.id,
        boardRole: inst.boardRole,
        classKey: inst.classKey,
        isTarget: inst.isTarget,
        worldX: +inst.root.position.x.toFixed(4),
        worldY: +inst.root.position.y.toFixed(4),
        worldZ: +inst.root.position.z.toFixed(4),
        contactShadowWorldY: +(inst.root.position.y + inst.contactShadow.position.y).toFixed(4),
        lightSpaceX: f.lightSpaceX,
        lightSpaceY: f.lightSpaceY,
        insideHeroShadowFrustum: f.insideHeroShadowFrustum,
        lastShadowTrackedX: +inst._lastShadowX.toFixed(4),
      });
    }

    const propNodes = [
      ["Mug", mugGroupRef?.getObjectByName("Mug_Bowl") || mugGroupRef],
      ["Coaster", mugGroupRef?.getObjectByName("Mug_Coaster") || mugGroupRef],
      ["Napkin", napkinGroupRef?.getObjectByName("Napkin_FoldedLinen") || napkinGroupRef],
      ["Spoon", napkinGroupRef?.getObjectByName("Spoon_EspressoSteel") || napkinGroupRef],
      ["HumanBoard", humanBoardAssemblyRef],
      ["AiBoard", aiBoardAssemblyRef],
      ["HumanBarrierGate", gateStates.human.boomPivot || humanBoardAssemblyRef],
      ["AiBarrierGate", gateStates.ai.boomPivot || aiBoardAssemblyRef],
    ];
    const props = [];
    const propCenter = new THREE.Vector3();
    for (const [label, node] of propNodes) {
      if (!node) continue;
      _tmpBox3.setFromObject(node);
      if (_tmpBox3.isEmpty()) {
        node.getWorldPosition(propCenter);
      } else {
        _tmpBox3.getCenter(propCenter);
      }
      const f = evalInsideHeroFrustum(propCenter);
      let anyCastShadow = false;
      node.traverse((c) => {
        if (c.isMesh && c.castShadow) anyCastShadow = true;
      });
      props.push({
        name: label,
        worldX: +propCenter.x.toFixed(3),
        worldY: +propCenter.y.toFixed(3),
        worldZ: +propCenter.z.toFixed(3),
        castShadow: anyCastShadow,
        lightSpaceX: f.lightSpaceX,
        lightSpaceY: f.lightSpaceY,
        insideHeroShadowFrustum: f.insideHeroShadowFrustum,
      });
    }

    return {
      staticShadowMapSize: staticSun.shadow.mapSize.x,
      staticShadowAutoUpdate: staticSun.shadow.autoUpdate,
      staticSunIntensity: staticSun.intensity,
      heroShadowMapSize: heroSun.shadow.mapSize.x,
      heroSunIntensity: heroSun.intensity,
      heroFrustum: {
        left: sCam.left,
        right: sCam.right,
        top: sCam.top,
        bottom: sCam.bottom,
      },
      allCarsInsideHeroFrustum: cars.every((c) => c.insideHeroShadowFrustum),
      allPropsInsideHeroFrustum: props.every((p) => p.insideHeroShadowFrustum && p.castShadow),
      shadowUpdateCount,
      lastHeroShadowFrame,
      cars,
      props,
    };
  }

  function getScaleDiagnostics() {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3();

    let boardOuterWidthUnits = PHYSICAL_SCALE_SPEC.boardOuterWidthUnits;
    if (humanBoardAssemblyRef) {
      const frameNode = humanBoardAssemblyRef.getObjectByName("Board_BeechFrame") || humanBoardAssemblyRef;
      box.setFromObject(frameNode);
      boardOuterWidthUnits = +(box.max.x - box.min.x).toFixed(4);
    }

    let mugBowlDiameterUnits = PHYSICAL_SCALE_SPEC.mugBowlDiameterUnits;
    let mugBowlHeightUnits = PHYSICAL_SCALE_SPEC.mugBowlHeightUnits;
    let coasterDiameterUnits = PHYSICAL_SCALE_SPEC.coasterDiameterUnits;
    if (mugGroupRef) {
      const measureLocalGroupBox = (node) => {
        const lb = new THREE.Box3();
        node.traverse((child) => {
          if (child.isMesh && child.geometry) {
            child.geometry.computeBoundingBox();
            lb.union(child.geometry.boundingBox);
          }
        });
        return lb;
      };
      const bowlNode = mugGroupRef.getObjectByName("Mug_Bowl");
      if (bowlNode) {
        const gb = measureLocalGroupBox(bowlNode);
        if (!gb.isEmpty()) {
          mugBowlDiameterUnits = +(gb.max.x - gb.min.x).toFixed(4);
          mugBowlHeightUnits = +(gb.max.y - gb.min.y).toFixed(4);
        }
      }
      const coasterNode = mugGroupRef.getObjectByName("Mug_Coaster");
      if (coasterNode) {
        const cb = measureLocalGroupBox(coasterNode);
        if (!cb.isEmpty()) {
          coasterDiameterUnits = +Math.max(cb.max.x - cb.min.x, cb.max.z - cb.min.z).toFixed(4);
        }
      }
    }

    let tableWidthUnits = PHYSICAL_SCALE_SPEC.tableWidthUnits;
    let tableDepthUnits = PHYSICAL_SCALE_SPEC.tableDepthUnits;
    let tableTopY = BOARD6.tableY;
    if (tableSlabMeshRef) {
      box.setFromObject(tableSlabMeshRef);
      tableWidthUnits = +(box.max.x - box.min.x).toFixed(4);
      tableDepthUnits = +(box.max.z - box.min.z).toFixed(4);
      tableTopY = +box.max.y.toFixed(4);
    }

    const measured = {
      cmPerUnit: PHYSICAL_SCALE_SPEC.cmPerUnit,
      boardOuterWidthUnits,
      boardOffsets: BOARD_OFFSETS,
      mugBowlDiameterUnits,
      mugToBoardWidthRatio: +(mugBowlDiameterUnits / Math.max(1e-4, boardOuterWidthUnits)).toFixed(4),
      mugBowlHeightUnits,
      coasterDiameterUnits,
      tableWidthUnits,
      tableDepthUnits,
      tableTopY,
      floorY: kitchenEnvRefs?.floorY ?? -52.0,
      sillWorldY: kitchenEnvRefs?.sillWorldY ?? -4.2,
      herbPlanterMinY: herbPlanterRef
        ? +new THREE.Box3().setFromObject(herbPlanterRef).min.y.toFixed(4)
        : -4.2,
      inlineGlbPayloadMB: +(tel.inlineGlbPayloadMB || 0).toFixed(3),
      drawCalls: tel.drawCalls || 0,
    };

    const validation =
      typeof PHYSICAL_SCALE_SPEC?.validateSceneScale === "function"
        ? PHYSICAL_SCALE_SPEC.validateSceneScale(measured)
        : { ok: true, errors: [] };
    return {
      ...measured,
      ok: validation.ok,
      errors: validation.errors,
    };
  }

  function resize(cssWidth, cssHeight, dpr) {
    if (isGlContextLost) return;
    lastLiveRenderEndMs = -Infinity;
    const w = Math.max(1, Number(cssWidth) || canvas?.clientWidth || window.innerWidth || 1280);
    const h = Math.max(1, Number(cssHeight) || canvas?.clientHeight || window.innerHeight || 720);
    const pixelRatio = Math.min(Number(dpr) || window.devicePixelRatio || 1, maxAllowedDpr);
    const prevAspect = camera.aspect;
    const nextAspect = w / h;

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = nextAspect;
    if (Math.abs(nextAspect - prevAspect) > 1e-4 && !controls._isDragging) {
      setCameraMode(currentCameraMode, true);
    } else {
      camera.updateProjectionMatrix();
    }
    agxComposer.setSize(w, h, pixelRatio);
  }

  let staticShadowBaked = false;
  const _savedScissor = new THREE.Vector4();
  const _savedViewport = new THREE.Vector4();
  const _savedCaptureCamPos = new THREE.Vector3();
  const _savedCaptureCamQuat = new THREE.Quaternion();
  const _aiCaptureTarget = new THREE.Vector3(0.35, -0.1, -9.05);
  const _aiCapturePos = new THREE.Vector3(0.35, 21.4, 4.6);
  let _hydrogenOffscreenCanvas = null;
  let _hydrogenOffscreenCtx = null;

  function ensureStaticShadowsBaked() {
    if (staticShadowBaked) return;
    staticShadowBaked = true;
    const prevVehVis = vehicleLayer.visible;
    const prevPoolVis = instancedVehiclePoolGroup.visible;
    const prevHumanBoomVis = gateStates.human.boomPivot ? gateStates.human.boomPivot.visible : true;
    const prevAiBoomVis = gateStates.ai.boomPivot ? gateStates.ai.boomPivot.visible : true;
    const prevRT = renderer.getRenderTarget();
    const prevScissorTest = renderer.getScissorTest();
    renderer.getScissor(_savedScissor);
    renderer.getViewport(_savedViewport);

    vehicleLayer.visible = false;
    instancedVehiclePoolGroup.visible = false;
    if (gateStates.human.boomPivot) gateStates.human.boomPivot.visible = false;
    if (gateStates.ai.boomPivot) gateStates.ai.boomPivot.visible = false;

    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    staticSun.shadow.needsUpdate = true;
    heroSun.shadow.needsUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    const sharedSceneTarget = agxComposer.composer?.readBuffer || agxComposer.hdrTarget;
    if (sharedSceneTarget) {
      renderer.setRenderTarget(sharedSceneTarget);
    }
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, 2, 2);
    renderer.setViewport(0, 0, 2, 2);
    renderer.render(scene, camera);

    renderer.setRenderTarget(prevRT);
    renderer.setScissor(_savedScissor);
    renderer.setViewport(_savedViewport);
    renderer.setScissorTest(prevScissorTest);

    staticSun.shadow.autoUpdate = false;
    staticSun.shadow.needsUpdate = false;
    tel.staticShadowAutoUpdate = false;

    const freezeOffBoardShadowCasters = (groupObj) => {
      if (!groupObj) return;
      groupObj.traverse((node) => {
        if (node.isMesh || node.isInstancedMesh) node.castShadow = false;
      });
    };
    freezeOffBoardShadowCasters(tableGroup);
    freezeOffBoardShadowCasters(kitchenEnvRefs?.kitchenRoot);
    freezeOffBoardShadowCasters(herbPlanterRef);
    if (Array.isArray(chairInstancesRef)) {
      for (const ci of chairInstancesRef) ci.castShadow = false;
    }

    vehicleLayer.visible = prevVehVis;
    instancedVehiclePoolGroup.visible = prevPoolVis;
    if (gateStates.human.boomPivot) gateStates.human.boomPivot.visible = prevHumanBoomVis;
    if (gateStates.ai.boomPivot) gateStates.ai.boomPivot.visible = prevAiBoomVis;
    heroSun.shadow.needsUpdate = true;
    renderer.shadowMap.needsUpdate = true;
  }

  function render() {
    if (isGlContextLost) return;
    if (typeof window !== "undefined" && window.__CAPTURE_SKIP_DRAW__) return;

    // On Software GL (`Lavapipe`/`SwiftShader`), if `main.js` `rafLoop` runs up to 4 fixed-dt catch-up
    // `subSteps` synchronously inside the same `requestAnimationFrame` callback (`delta < 4ms`),
    // render only once per RAF turn so the browser main thread never starves!
    const isVirtualClock =
      typeof window !== "undefined" &&
      (Boolean(window.__virtualClock) ||
        Boolean(document?.documentElement?.classList?.contains("is-virtual-clock")));
    if (isSoftwareGl && !isVirtualClock && typeof performance !== "undefined") {
      const enterMs = performance.now();
      if (enterMs - lastLiveRenderEndMs < 4.0) {
        return;
      }
    }

    ensureStaticShadowsBaked();
    syncHeroShadowDirtyState();
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    syncVehicleInstancedPools(null);

    agxComposer.render(state.elapsedTime || 0);
    tel.staticShadowAutoUpdate = staticSun.shadow.autoUpdate;

    if (isSoftwareGl && !isVirtualClock && typeof performance !== "undefined") {
      lastLiveRenderEndMs = performance.now();
    }
  }

  /**
   * Captures a 100% fair, razor-sharp `4:3` PNG (`960x720` default) framing **ONLY the AI back board**
   * (`z = -9.2`, `A..F` × `1..6` laser-etched beechwood rails + `F3` East barrier gate) with `maxBlurPx = 0`,
   * temporarily hiding the foreground Human board, Human cars in `BatchedMesh`, plaques, props, and gizmos
   * so AI has 100% fair blind vision of ONLY its own board, then restoring active state with 0 flicker!
   */
  function captureAiBoardPng(targetWidth = 960, targetHeight = 720) {
    if (isGlContextLost) return "";
    const outW = Math.max(64, Math.round(Number(targetWidth) || 960));
    const outH = Math.max(64, Math.round(Number(targetHeight) || 720));
    const targetAspect = outW / outH;

    ensureStaticShadowsBaked();

    // 1. Save active viewer camera, DoF, and scene visibility state
    _savedCaptureCamPos.copy(camera.position);
    _savedCaptureCamQuat.copy(camera.quaternion);
    const savedFov = camera.fov;
    const savedAspect = camera.aspect;
    const savedHumanBoardVis = humanBoardGroup.visible;
    const savedAiPlaqueVis = aiNameplate?.group ? aiNameplate.group.visible : true;
    const savedPropsVis = propsGroup.visible;
    const savedGuideVis = guideGroup.visible;
    const savedCorridorVis = corridorMesh.visible;
    const savedHintVis = hintGroup.visible;

    const visibleHalos = [];
    for (const inst of activeVehicles) {
      if (inst.haloMesh && inst.haloMesh.visible) {
        visibleHalos.push(inst.haloMesh);
        inst.haloMesh.visible = false;
      }
    }

    // 2. Isolate ONLY the AI back board (`z = -9.2`) & lock crisp zero-DoF framing
    humanBoardGroup.visible = false;
    if (aiNameplate?.group) aiNameplate.group.visible = false;
    propsGroup.visible = false;
    guideGroup.visible = false;
    corridorMesh.visible = false;
    hintGroup.visible = false;

    camera.position.copy(_aiCapturePos);
    camera.fov = 31.5;
    camera.aspect = targetAspect;
    camera.lookAt(_aiCaptureTarget);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    const aiFocusDist = _aiCapturePos.distanceTo(_aiCaptureTarget);
    agxComposer.setDoF({
      focusDist: aiFocusDist,
      focusRange: 80.0,
      maxBlurPx: 0.0,
    });

    syncHeroShadowDirtyState();
    scene.updateMatrixWorld(true);
    syncVehicleInstancedPools("ai");

    // 3. Synchronously render isolated AI board frame & copy to offscreen 2D canvas
    //    (Temporarily clear `__CAPTURE_SKIP_DRAW__` so multi-worker 4K60 fast-forward warm-up
    //     still renders a full illuminated AI back-board PNG rather than skipping the draw!)
    const savedSkipDraw =
      typeof window !== "undefined" ? Boolean(window.__CAPTURE_SKIP_DRAW__) : false;
    let pngDataUrl = "";
    try {
      if (typeof window !== "undefined") window.__CAPTURE_SKIP_DRAW__ = false;
      agxComposer.render(state.elapsedTime || 0);

      if (!_hydrogenOffscreenCanvas && typeof document !== "undefined") {
        _hydrogenOffscreenCanvas = document.createElement("canvas");
        _hydrogenOffscreenCtx = _hydrogenOffscreenCanvas.getContext("2d");
      }

      if (_hydrogenOffscreenCanvas && _hydrogenOffscreenCtx && renderer.domElement) {
        if (_hydrogenOffscreenCanvas.width !== outW || _hydrogenOffscreenCanvas.height !== outH) {
          _hydrogenOffscreenCanvas.width = outW;
          _hydrogenOffscreenCanvas.height = outH;
        }
        _hydrogenOffscreenCtx.imageSmoothingEnabled = true;
        _hydrogenOffscreenCtx.imageSmoothingQuality = "high";
        _hydrogenOffscreenCtx.clearRect(0, 0, outW, outH);
        _hydrogenOffscreenCtx.drawImage(renderer.domElement, 0, 0, outW, outH);
        pngDataUrl = _hydrogenOffscreenCanvas.toDataURL("image/png");
      }
    } finally {
      if (typeof window !== "undefined") window.__CAPTURE_SKIP_DRAW__ = savedSkipDraw;
    }

    // 4. Restore all visibility, BatchedMesh instances, viewer camera, and DoF & re-render immediately (0 flicker!)
    humanBoardGroup.visible = savedHumanBoardVis;
    if (aiNameplate?.group) aiNameplate.group.visible = savedAiPlaqueVis;
    propsGroup.visible = savedPropsVis;
    guideGroup.visible = savedGuideVis;
    corridorMesh.visible = savedCorridorVis;
    hintGroup.visible = savedHintVis;
    for (let i = 0; i < visibleHalos.length; i++) {
      visibleHalos[i].visible = true;
    }

    camera.position.copy(_savedCaptureCamPos);
    camera.quaternion.copy(_savedCaptureCamQuat);
    camera.fov = savedFov;
    camera.aspect = savedAspect;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    agxComposer.setDoF({
      focusDist: currentDofFocusDist,
      focusRange: currentDofFocusRange,
      maxBlurPx:
        isSoftwareGl || (currentCameraMode === "top" && !camGlideActive) ? 0.0 : currentDofMaxBlurPx,
    });

    scene.updateMatrixWorld(true);
    syncVehicleInstancedPools(null);

    if (!savedSkipDraw) {
      agxComposer.render(state.elapsedTime || 0);
    }
    tel.staticShadowAutoUpdate = staticSun.shadow.autoUpdate;

    return pngDataUrl;
  }

  // Ensure initial boot respects stage aspect ratio immediately
  setCameraMode(currentCameraMode, true);

  return {
    ready,
    hasWebGL2: true,
    isContextLost: () => isGlContextLost,
    scene,
    camera,
    renderer,
    controls,
    BOARD_OFFSETS,
    createVehicleInstance,
    setExitGateState,
    setCorridorGuide,
    setHintIndicator,
    setAiOpponentLabel,
    captureAiBoardPng,
    captureHydrogenTabletopPng: captureAiBoardPng,
    setCameraMode,
    resetCameraToHero,
    interruptOpeningSettle,
    invalidateShadows,
    pickChallengeCardStand,
    triggerCardFlip,
    getScaleDiagnostics,
    getVehicleShadowDiagnostics,
    getShadowDiagnostics: getVehicleShadowDiagnostics,
    updateWorld,
    resize,
    render,
  };
}
