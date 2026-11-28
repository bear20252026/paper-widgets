/**
 * Loads baked real Chamonix / Mont Blanc EU-DEM textures (strictly opaque RGB PNGs
 * so browser premultiplyAlpha NEVER corrupts 16-bit R*256+G height packing!).
 *
 * Exposes BOTH:
 *  - GPU DataTextures / CanvasTextures for WebGL2 shaders
 *  - Exact CPU bilinear height/normal/micro-relief sampling matching GLSL 1:1
 */
import * as THREE from 'three';

export const CORE_HALF = 6400.0;   // 12.8 km x 12.8 km core massif
export const OUTER_HALF = 24000.0; // 48.0 km x 48.0 km surrounding Alps
export const MAX_ELEV = 5000.0;    // 16-bit vertical range [0 .. 5000m] -> 0.0763m step

export const SURFACE_TYPES = {
  POWDER: { id: 'powder', label: 'COLD POWDER', grip: 0.86, baseDrag: 0.0155, sinkDepth: 0.25, chatter: 0.08, sprayMult: 1.35 },
  PACKED: { id: 'packed', label: 'WIND PACK', grip: 0.96, baseDrag: 0.0085, sinkDepth: 0.09, chatter: 0.24, sprayMult: 0.72 },
  CRUST:  { id: 'crust',  label: 'WIND CRUST', grip: 0.76, baseDrag: 0.0068, sinkDepth: 0.05, chatter: 0.56, sprayMult: 0.42 },
  ICE:    { id: 'ice',    label: 'BLUE ICE', grip: 0.42, baseDrag: 0.0038, sinkDepth: 0.015, chatter: 0.95, sprayMult: 0.16 },
  GRANITE:{ id: 'granite',label: 'EXPOSED GRANITE', grip: 0.28, baseDrag: 0.024, sinkDepth: 0.0, chatter: 1.25, sprayMult: 0.06 },
  CORN:   { id: 'corn',   label: 'SPRING CORN', grip: 0.92, baseDrag: 0.0105, sinkDepth: 0.08, chatter: 0.18, sprayMult: 0.60 },
};

// Reconstruct 16-bit elevation (R=hi, G=lo) + AO (B) from compact 2D MED-predicted lossless WebP residual + AO WebP!
function decodeMedDem(resRGBA, aoRGBA, w, h, step, escapes) {
  const n = w * h;
  const hq = new Int32Array(n);
  let escPtr = 0;
  let nextEscIdx = escapes && escapes.length > 0 ? escapes[0] : -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      let pred;
      if (i === 0) {
        pred = 0;
      } else if (y === 0) {
        pred = hq[i - 1];
      } else if (x === 0) {
        pred = hq[i - w];
      } else {
        const left = hq[i - 1];
        const up = hq[i - w];
        const ul = hq[i - w - 1];
        const mn = left < up ? left : up;
        const mx = left > up ? left : up;
        pred = ul >= mx ? mn : (ul <= mn ? mx : left + up - ul);
      }
      let val;
      if (i === nextEscIdx) {
        val = escapes[escPtr + 1];
        escPtr += 2;
        nextEscIdx = escPtr < escapes.length ? escapes[escPtr] : -1;
      } else {
        val = resRGBA[i * 4] - 128;
      }
      hq[i] = pred + val;
    }
  }
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    let q = hq[i] * step;
    if (q < 0) q = 0;
    else if (q > 65535) q = 65535;
    const k = i * 4;
    out[k] = q >> 8;
    out[k + 1] = q & 255;
    out[k + 2] = aoRGBA[k];
    out[k + 3] = 255;
  }
  return { data: out, width: w, height: h };
}

async function loadDemPixels(packed, basePath) {
  const [resImg, aoImg] = await Promise.all([
    loadImagePixels(`${basePath}/${packed.res}`),
    loadImagePixels(`${basePath}/${packed.ao}`),
  ]);
  return decodeMedDem(resImg.data, aoImg.data, resImg.width, resImg.height, packed.step, packed.esc);
}

// Load an image and extract raw Uint8Array RGBA pixels (opaque RGB images => alpha is 255 everywhere!)
function loadImagePixels(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      resolve({ img, data, width: img.width, height: img.height });
    };
    img.onerror = (e) => reject(new Error(`Failed to load ${url.slice(0, 64)}: ${e?.message || e}`));
    img.src = url;
  });
}

function makeDataTex(data, w, h, filter = THREE.LinearFilter, wrap = THREE.ClampToEdgeWrapping) {
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = filter;
  tex.magFilter = filter;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.generateMipmaps = false;
  tex.flipY = false; // row 0 = North (-halfSpan), matching CPU indexing directly!
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function loadRepeatTexture(url, srgb = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 8;
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = (e) => reject(new Error(`Failed to load texture ${url.slice(0, 64)}: ${e?.message || e}`));
    img.src = url;
  });
}

/**
 * Shared deterministic micro-relief matching GLSL `microRelief(worldXZ, slopeMag, powder)` 1:1!
 * Adds natural wind-blown pillows, rolling terrain lips, sastrugi waves, and granite ribs
 * at 4m–38m scale so real 12.5m EU-DEM comes alive right under the skis.
 */
export function microRelief(x, z, slopeMag, powder) {
  // Smooth trigonometric harmonic wind-pillows & rolling chutes (identical in JS and GLSL!)
  const w1 = Math.sin(x * 0.047 + z * 0.029) * Math.cos(x * 0.023 - z * 0.051);
  const w2 = Math.sin(x * 0.115 - z * 0.088 + 1.3) * Math.cos(x * 0.072 + z * 0.131 - 0.7);
  const w3 = Math.sin(x * 0.240 + z * 0.195 - 2.1) * Math.sin(x * 0.180 - z * 0.270 + 0.5);
  // Subtle natural rollers/wind lips you can pop off in off-piste freeride!
  const roller = Math.sin((x * 0.74 + z * 0.67) * 0.082 + w1 * 1.4) * 0.68;
  // Wind-carved soft snow amplitude scales gracefully with slope (quiet on flat glacial plains, rich on mid slopes, sharper rock ribs on steep faces)
  const midSlope = Math.min(1.0, Math.max(0.0, (slopeMag - 0.08) / 0.45));
  const steepRock = Math.min(1.0, Math.max(0.0, (slopeMag - 0.78) / 0.45));
  const snowAmp = (0.55 + 0.45 * powder) * (0.45 + 0.55 * midSlope) * (1.0 - steepRock * 0.45);
  const rockRib = steepRock * (Math.abs(w2) * 1.65 + w3 * 0.55);
  return (w1 * 1.35 + roller * 0.85 + w2 * 0.42 + w3 * 0.14) * snowAmp + rockRib;
}

/**
 * Shared steep-face granite ridge sharpening matching GLSL `terrain_renderer.js` evalCoreHeight()
 * AND `alpine_props.js` shadowMat 1:1! Fixes up to ±2.25 m CPU-vs-GPU elevation mismatch on >36° chutes
 * (midi_north, cosmiques_couloir, glacier_rond, tacul_north) so skis NEVER plunge underground or hover!
 */
export function ridgeSharpen(x, z, slopeMag) {
  if (slopeMag <= 0.72) return 0.0;
  const sharpM = Math.min(1.0, Math.max(0.0, (slopeMag - 0.72) / 0.55));
  const ridgeS = 1.0 - Math.abs(Math.sin(x * 0.019 + z * 0.014) * Math.cos(x * 0.012 - z * 0.023));
  return (ridgeS - 0.5) * 4.5 * sharpM;
}

export class ChamonixTerrainData {
  constructor() {
    this.meta = null;
    this.coreSize = 1024;
    this.outerSize = 512;
    this.coreElev = null;   // Float32Array[1024*1024]
    this.coreAO = null;     // Float32Array[1024*1024]
    this.corePowder = null; // Float32Array[1024*1024]
    this.coreCurv = null;   // Float32Array[1024*1024]
    this.textures = {};
  }

  async load(basePath = './assets') {
    const fetchJson = async (url) => {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} loading ${url}`);
      return resp.json();
    };
    const [metaResp, demPacked] = await Promise.all([
      fetchJson(`${basePath}/chamonix_meta.json`),
      fetchJson(`${basePath}/dem_packed.json`),
    ]);

    const assetUrl = (name) => `${basePath}/${name}`;
    const [
      coreDemImg, coreAux1Img, coreAux2Img,
      outerDemImg, outerAux1Img, outerAux2Img,
      graniteAlbedo, graniteNormal, snowNormal, snowCavity, iceNormal, powderPuff, spruceBough, skiTopsheet,
    ] = await Promise.all([
      loadDemPixels(demPacked.core_dem, basePath),
      loadImagePixels(assetUrl('core_aux1.webp')),
      loadImagePixels(assetUrl('core_aux2.webp')),
      loadDemPixels(demPacked.outer_dem, basePath),
      loadImagePixels(assetUrl('outer_aux1.webp')),
      loadImagePixels(assetUrl('outer_aux2.webp')),
      loadRepeatTexture(assetUrl('granite_albedo.webp'), true),
      loadRepeatTexture(assetUrl('granite_normal.webp'), false),
      loadRepeatTexture(assetUrl('snow_normal.webp'), false),
      loadRepeatTexture(assetUrl('snow_cavity.webp'), false),
      loadRepeatTexture(assetUrl('ice_normal.webp'), false),
      loadRepeatTexture(assetUrl('powder_puff.webp'), false),
      loadRepeatTexture(assetUrl('spruce_bough.webp'), true),
      loadRepeatTexture(assetUrl('ski_topsheet.webp'), true),
    ]);

    this.meta = metaResp;
    this.coreSize = coreDemImg.width;
    this.outerSize = outerDemImg.width;

    const N = this.coreSize;
    this.coreElev = new Float32Array(N * N);
    this.coreAO = new Float32Array(N * N);
    this.corePowder = new Float32Array(N * N);
    this.coreCurv = new Float32Array(N * N);

    const d = coreDemImg.data;
    const a1 = coreAux1Img.data;
    const a2 = coreAux2Img.data;
    for (let i = 0; i < N * N; i++) {
      const k = i * 4;
      const hi = d[k];
      const lo = d[k + 1];
      this.coreElev[i] = ((hi * 256 + lo) / 65535.0) * MAX_ELEV;
      this.coreAO[i] = d[k + 2] / 255.0;
      this.corePowder[i] = a1[k] / 255.0;
      this.coreCurv[i] = a2[k + 2] / 255.0;
    }

    // Also decode outer elevation for smooth boundary height fallback
    const M = this.outerSize;
    this.outerElev = new Float32Array(M * M);
    const od = outerDemImg.data;
    for (let i = 0; i < M * M; i++) {
      const k = i * 4;
      this.outerElev[i] = ((od[k] * 256 + od[k + 1]) / 65535.0) * MAX_ELEV;
    }

    // NearestFilter strictly required on packed 16-bit RG height textures (manual 4-tap bilinear in GLSL prevents 19.5m wrap spikes!)
    this.textures = {
      coreDem: makeDataTex(new Uint8Array(coreDemImg.data), N, N, THREE.NearestFilter),
      coreAux1: makeDataTex(new Uint8Array(coreAux1Img.data), N, N, THREE.LinearFilter),
      coreAux2: makeDataTex(new Uint8Array(coreAux2Img.data), N, N, THREE.LinearFilter),
      outerDem: makeDataTex(new Uint8Array(outerDemImg.data), M, M, THREE.NearestFilter),
      outerAux1: makeDataTex(new Uint8Array(outerAux1Img.data), M, M, THREE.LinearFilter),
      outerAux2: makeDataTex(new Uint8Array(outerAux2Img.data), M, M, THREE.LinearFilter),
      graniteAlbedo,
      graniteNormal,
      snowNormal,
      snowCavity,
      iceNormal,
      powderPuff,
      spruceBough,
      skiTopsheet,
    };

    powderPuff.wrapS = THREE.ClampToEdgeWrapping;
    powderPuff.wrapT = THREE.ClampToEdgeWrapping;
    spruceBough.wrapS = THREE.ClampToEdgeWrapping;
    spruceBough.wrapT = THREE.ClampToEdgeWrapping;
    skiTopsheet.wrapS = THREE.ClampToEdgeWrapping;
    skiTopsheet.wrapT = THREE.ClampToEdgeWrapping;

    return this;
  }

  sampleRawDEM(x, z) {
    const N = this.coreSize;
    const u = ((x + CORE_HALF) / (2.0 * CORE_HALF)) * (N - 1);
    const v = ((z + CORE_HALF) / (2.0 * CORE_HALF)) * (N - 1);
    if (u >= 0 && u <= N - 1 && v >= 0 && v <= N - 1) {
      const ix = Math.min(N - 2, Math.max(0, Math.floor(u)));
      const iz = Math.min(N - 2, Math.max(0, Math.floor(v)));
      const fx = u - ix;
      const fz = v - iz;
      const r0 = iz * N + ix;
      const r1 = (iz + 1) * N + ix;
      const h00 = this.coreElev[r0], h10 = this.coreElev[r0 + 1];
      const h01 = this.coreElev[r1], h11 = this.coreElev[r1 + 1];
      const elev = (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
      const ao = (this.coreAO[r0] * (1 - fx) + this.coreAO[r0 + 1] * fx) * (1 - fz)
               + (this.coreAO[r1] * (1 - fx) + this.coreAO[r1 + 1] * fx) * fz;
      const powder = (this.corePowder[r0] * (1 - fx) + this.corePowder[r0 + 1] * fx) * (1 - fz)
                   + (this.corePowder[r1] * (1 - fx) + this.corePowder[r1 + 1] * fx) * fz;
      const curv = (this.coreCurv[r0] * (1 - fx) + this.coreCurv[r0 + 1] * fx) * (1 - fz)
                 + (this.coreCurv[r1] * (1 - fx) + this.coreCurv[r1 + 1] * fx) * fz;
      return { elev, ao, powder, curv, inCore: true };
    }
    const M = this.outerSize;
    const ou = Math.min(M - 1.001, Math.max(0, ((x + OUTER_HALF) / (2.0 * OUTER_HALF)) * (M - 1)));
    const ov = Math.min(M - 1.001, Math.max(0, ((z + OUTER_HALF) / (2.0 * OUTER_HALF)) * (M - 1)));
    const ix = Math.floor(ou), iz = Math.floor(ov);
    const fx = ou - ix, fz = ov - iz;
    const r0 = iz * M + ix, r1 = (iz + 1) * M + ix;
    const elev = (this.outerElev[r0] * (1 - fx) + this.outerElev[r0 + 1] * fx) * (1 - fz)
               + (this.outerElev[r1] * (1 - fx) + this.outerElev[r1 + 1] * fx) * fz;
    return { elev, ao: 0.7, powder: 0.5, curv: 0.5, inCore: false };
  }

  sampleHeight(x, z) {
    const s = this.sampleRawDEM(x, z);
    if (!s.inCore) return s.elev;
    const e = 8.0;
    const gx = (this.sampleRawDEM(x + e, z).elev - this.sampleRawDEM(x - e, z).elev) / (2 * e);
    const gz = (this.sampleRawDEM(x, z + e).elev - this.sampleRawDEM(x, z - e).elev) / (2 * e);
    const slopeMag = Math.hypot(gx, gz);
    return s.elev + microRelief(x, z, slopeMag, s.powder) + ridgeSharpen(x, z, slopeMag);
  }

  /**
   * Full physical sample at world (x, z): exact height, surface normal (including micro-relief),
   * slope angle, and physically derived off-piste snowpack classification.
   */
  sampleTerrain(x, z) {
    const raw = this.sampleRawDEM(x, z);
    const eRaw = 8.0;
    const rgx = (this.sampleRawDEM(x + eRaw, z).elev - this.sampleRawDEM(x - eRaw, z).elev) / (2 * eRaw);
    const rgz = (this.sampleRawDEM(x, z + eRaw).elev - this.sampleRawDEM(x, z - eRaw).elev) / (2 * eRaw);
    const rawSlope = Math.hypot(rgx, rgz);

    const h = raw.elev + (raw.inCore ? (microRelief(x, z, rawSlope, raw.powder) + ridgeSharpen(x, z, rawSlope)) : 0);
    const e = 1.1;
    const hL = this.sampleHeight(x - e, z);
    const hR = this.sampleHeight(x + e, z);
    const hN = this.sampleHeight(x, z - e);
    const hS = this.sampleHeight(x, z + e);
    const gx = (hR - hL) / (2 * e);
    const gz = (hS - hN) / (2 * e);
    const inv = 1.0 / Math.sqrt(gx * gx + 1.0 + gz * gz);
    const nx = -gx * inv;
    const ny = inv;
    const nz = -gz * inv;
    const slopeRad = Math.acos(Math.min(1, Math.max(0, ny)));
    const slopeDeg = (slopeRad * 180) / Math.PI;

    // Derive physical off-piste surface type
    let surf;
    const southFacing = nz > 0.25;
    if (slopeDeg > 48.0 || (slopeDeg > 43.0 && raw.curv > 0.62)) {
      surf = SURFACE_TYPES.GRANITE;
    } else if (slopeDeg > 37.5 && raw.curv > 0.58 && h > 2350) {
      surf = SURFACE_TYPES.ICE;
    } else if (raw.curv > 0.63 && raw.powder < 0.42) {
      surf = SURFACE_TYPES.CRUST;
    } else if (h < 1850 && southFacing) {
      surf = SURFACE_TYPES.CORN;
    } else if (raw.powder > 0.48 && h > 1950) {
      surf = SURFACE_TYPES.POWDER;
    } else {
      surf = SURFACE_TYPES.PACKED;
    }

    return {
      y: h,
      rawY: raw.elev,
      nx, ny, nz,
      gx, gz,
      slopeRad,
      slopeDeg,
      ao: raw.ao,
      powder: raw.powder,
      curv: raw.curv,
      surface: surf,
    };
  }
}
