import * as THREE from 'three/webgpu';

export interface PBRTextureSet {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  emissiveMap?: THREE.CanvasTexture;
}

// Deterministic hash for seamlessly tileable periodic 2D value noise
function hash2(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function tileNoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const ix0 = ((x0 % period) + period) % period;
  const iy0 = ((y0 % period) + period) % period;
  const ix1 = (ix0 + 1) % period;
  const iy1 = (iy0 + 1) % period;

  const n00 = hash2(ix0, iy0, seed);
  const n10 = hash2(ix1, iy0, seed);
  const n01 = hash2(ix0, iy1, seed);
  const n11 = hash2(ix1, iy1, seed);

  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function tileFbm(u: number, v: number, basePeriod: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let p = basePeriod;
  for (let i = 0; i < octaves; i++) {
    sum += amp * tileNoise(u, v, p, seed + i * 31);
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / norm;
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  anisotropy = 8
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Computes a crisp tangent-space normal map from a tileable scalar heightfield [0..1]
 * using periodic 3x3 Sobel convolution.
 */
function heightToNormalCanvas(
  height: Float32Array,
  size: number,
  strength: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const at = (x: number, y: number) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return height[wy * size + wx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = at(x - 1, y - 1);
      const t = at(x, y - 1);
      const tr = at(x + 1, y - 1);
      const l = at(x - 1, y);
      const r = at(x + 1, y);
      const bl = at(x - 1, y + 1);
      const b = at(x, y + 1);
      const br = at(x + 1, y + 1);

      const dX = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dY = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;

      let nx = -dX;
      let ny = dY; // Three.js OpenGL normal convention
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

function scalarToGrayscaleCanvas(values: Float32Array, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(255, Math.round(values[i] * 255)));
    const idx = i * 4;
    data[idx] = v;
    data[idx + 1] = v;
    data[idx + 2] = v;
    data[idx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * 1. Architectural Limestone / Ashlar Cladding (Contemporary Style)
 */
export function createLimestonePBR(anisotropy = 8): PBRTextureSet {
  const size = 512;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const rows = 4;
  const cols = 2;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowF = v * rows;
    const row = Math.floor(rowF);
    const rv = rowF - row;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const offsetU = (u + (row % 2) * 0.5) % 1;
      const colF = offsetU * cols;
      const col = Math.floor(colF);
      const ru = colF - col;

      const jointH = rv < 0.025 || rv > 0.975;
      const jointV = ru < 0.014 || ru > 0.986;
      const bevelH = !jointH && (rv < 0.045 || rv > 0.955);
      const bevelV = !jointV && (ru < 0.026 || ru > 0.974);
      const isJoint = jointH || jointV;

      const blockTint = (hash2(col, row, 101) - 0.5) * 14;
      const grain = tileFbm(u, v, 8, 4, 17);
      const vein = Math.pow(Math.sin((v * 14 + tileFbm(u, v, 4, 3, 53) * 3.2) * Math.PI) * 0.5 + 0.5, 3);
      const fine = tileNoise(u, v, 64, 91);

      let rCol = 224 + blockTint + (grain - 0.5) * 18 - vein * 10 + (fine - 0.5) * 6;
      let gCol = 219 + blockTint * 0.95 + (grain - 0.5) * 16 - vein * 10 + (fine - 0.5) * 6;
      let bCol = 208 + blockTint * 0.85 + (grain - 0.5) * 15 - vein * 9 + (fine - 0.5) * 5;

      let hVal = 0.78 + (grain - 0.5) * 0.14 + (fine - 0.5) * 0.05 - vein * 0.04;
      let rVal = 0.72 + (grain - 0.5) * 0.14 + vein * 0.08;

      if (isJoint) {
        rCol = 152 + (fine - 0.5) * 10;
        gCol = 148 + (fine - 0.5) * 10;
        bCol = 140 + (fine - 0.5) * 10;
        hVal = 0.12;
        rVal = 0.95;
      } else if (bevelH || bevelV) {
        rCol -= 8;
        gCol -= 8;
        bCol -= 8;
        hVal -= 0.18;
      }

      const idx = (y * size + x) * 4;
      d[idx] = clampByte(rCol);
      d[idx + 1] = clampByte(gCol);
      d[idx + 2] = clampByte(bCol);
      d[idx + 3] = 255;

      height[y * size + x] = hVal;
      rough[y * size + x] = rVal;
    }
  }

  ctx.putImageData(img, 0, 0);
  return {
    map: finalizeTexture(albedo, true, anisotropy),
    normalMap: finalizeTexture(heightToNormalCanvas(height, size, 2.4), false, anisotropy),
    roughnessMap: finalizeTexture(scalarToGrayscaleCanvas(rough, size), false, anisotropy),
  };
}

/**
 * 2. Kiln-Fired Architectural Running-Bond Brick (Brick & Steel Loft Style)
 */
export function createBrickPBR(anisotropy = 8): PBRTextureSet {
  const size = 512;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const rows = 16;
  const cols = 6;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowF = v * rows;
    const row = Math.floor(rowF);
    const rv = rowF - row;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const offsetU = (u + (row % 2) * 0.5) % 1;
      const colF = offsetU * cols;
      const col = Math.floor(colF);
      const ru = colF - col;

      const mortar = rv < 0.11 || rv > 0.94 || ru < 0.045 || ru > 0.965;
      const edge = !mortar && (rv < 0.17 || rv > 0.89 || ru < 0.08 || ru > 0.93);

      const brickSeed = hash2(col, row, 307);
      const brickSeed2 = hash2(col, row, 719);
      const grit = tileFbm(u, v, 16, 4, 41);
      const pit = tileNoise(u, v, 64, 83);

      let rCol: number;
      let gCol: number;
      let bCol: number;
      let hVal: number;
      let rVal: number;

      if (mortar) {
        const m = 186 + (grit - 0.5) * 26 + (pit - 0.5) * 14;
        rCol = m;
        gCol = m - 5;
        bCol = m - 13;
        hVal = 0.16 + (pit - 0.5) * 0.08;
        rVal = 0.96;
      } else {
        // Warm terracotta / burnt sienna / smoked clinker palette
        const darkClinker = brickSeed > 0.84 ? -32 : 0;
        rCol = 158 + (brickSeed - 0.5) * 44 + darkClinker + (grit - 0.5) * 26;
        gCol = 82 + (brickSeed2 - 0.5) * 28 + darkClinker * 0.7 + (grit - 0.5) * 18;
        bCol = 60 + (brickSeed2 - 0.5) * 20 + darkClinker * 0.5 + (grit - 0.5) * 14;
        hVal = 0.78 + (brickSeed - 0.5) * 0.09 + (grit - 0.5) * 0.14 - (pit < 0.12 ? 0.14 : 0);
        rVal = 0.80 + (grit - 0.5) * 0.15;

        if (edge) {
          rCol -= 12;
          gCol -= 8;
          bCol -= 6;
          hVal -= 0.18;
        }
      }

      const idx = (y * size + x) * 4;
      d[idx] = clampByte(rCol);
      d[idx + 1] = clampByte(gCol);
      d[idx + 2] = clampByte(bCol);
      d[idx + 3] = 255;

      height[y * size + x] = hVal;
      rough[y * size + x] = rVal;
    }
  }

  ctx.putImageData(img, 0, 0);
  return {
    map: finalizeTexture(albedo, true, anisotropy),
    normalMap: finalizeTexture(heightToNormalCanvas(height, size, 3.2), false, anisotropy),
    roughnessMap: finalizeTexture(scalarToGrayscaleCanvas(rough, size), false, anisotropy),
  };
}

/**
 * 3. Monumental Roman Travertine & Fluted Stone (Travertine & Bronze Style)
 */
export function createTravertinePBR(anisotropy = 8): PBRTextureSet {
  const size = 512;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const rows = 3;
  const cols = 2;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowF = v * rows;
    const row = Math.floor(rowF);
    const rv = rowF - row;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const colF = u * cols;
      const col = Math.floor(colF);
      const ru = colF - col;

      const joint = rv < 0.02 || rv > 0.98 || ru < 0.015 || ru > 0.985;
      // Distinct horizontal sedimentary striations of cut travertine
      const strata = tileFbm(u * 0.5, v * 3.0, 8, 4, 211);
      const streak = tileNoise(u, v, 32, 139);
      const pores = tileNoise(u, v, 64, 57) < 0.08 ? 1 : 0;
      const panelVar = (hash2(col, row, 444) - 0.5) * 12;

      let rCol = 205 + panelVar + (strata - 0.5) * 34 - pores * 28;
      let gCol = 191 + panelVar * 0.9 + (strata - 0.5) * 30 - pores * 26;
      let bCol = 166 + panelVar * 0.8 + (strata - 0.5) * 26 - pores * 22;

      let hVal = 0.76 + (strata - 0.5) * 0.16 + (streak - 0.5) * 0.06 - pores * 0.35;
      let rVal = 0.66 + (strata - 0.5) * 0.16 + pores * 0.25;

      if (joint) {
        rCol = 112;
        gCol = 104;
        bCol = 92;
        hVal = 0.08;
        rVal = 0.94;
      }

      const idx = (y * size + x) * 4;
      d[idx] = clampByte(rCol);
      d[idx + 1] = clampByte(gCol);
      d[idx + 2] = clampByte(bCol);
      d[idx + 3] = 255;

      height[y * size + x] = hVal;
      rough[y * size + x] = rVal;
    }
  }

  ctx.putImageData(img, 0, 0);
  return {
    map: finalizeTexture(albedo, true, anisotropy),
    normalMap: finalizeTexture(heightToNormalCanvas(height, size, 2.8), false, anisotropy),
    roughnessMap: finalizeTexture(scalarToGrayscaleCanvas(rough, size), false, anisotropy),
  };
}

/**
 * 4. Architectural Cast Concrete (Plinths, Columns, Slabs, Penthouse Cores)
 */
export function createConcretePBR(anisotropy = 8, tint: [number, number, number] = [165, 167, 169]): PBRTextureSet {
  const size = 512;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const n1 = tileFbm(u, v, 6, 4, 61);
      const n2 = tileNoise(u, v, 48, 73);
      const seam = Math.abs(v - 0.5) < 0.006 || v < 0.006 || Math.abs(u - 0.5) < 0.005 || u < 0.005;

      // Subtle architectural formwork tie holes
      const dx1 = ((u * 2) % 1) - 0.25;
      const dx2 = ((u * 2) % 1) - 0.75;
      const dy = ((v * 2) % 1) - 0.5;
      const tieHole =
        dx1 * dx1 + dy * dy < 0.00045 || dx2 * dx2 + dy * dy < 0.00045;

      let delta = (n1 - 0.5) * 26 + (n2 - 0.5) * 10;
      let hVal = 0.72 + (n1 - 0.5) * 0.15 + (n2 - 0.5) * 0.07;
      let rVal = 0.78 + (n1 - 0.5) * 0.16;

      if (seam) {
        delta -= 24;
        hVal = 0.25;
        rVal = 0.92;
      } else if (tieHole) {
        delta -= 40;
        hVal = 0.1;
        rVal = 0.95;
      }

      const idx = (y * size + x) * 4;
      d[idx] = clampByte(tint[0] + delta);
      d[idx + 1] = clampByte(tint[1] + delta);
      d[idx + 2] = clampByte(tint[2] + delta);
      d[idx + 3] = 255;

      height[y * size + x] = hVal;
      rough[y * size + x] = rVal;
    }
  }

  ctx.putImageData(img, 0, 0);
  return {
    map: finalizeTexture(albedo, true, anisotropy),
    normalMap: finalizeTexture(heightToNormalCanvas(height, size, 1.9), false, anisotropy),
    roughnessMap: finalizeTexture(scalarToGrayscaleCanvas(rough, size), false, anisotropy),
  };
}

/**
 * 5. Ribbed Acoustic Cedar Wood Soffit (Cantilever Overhangs!)
 */
export function createTimberSoffitPBR(anisotropy = 8): PBRTextureSet {
  const size = 512;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  const slats = 16;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const slatF = v * slats;
    const slatIdx = Math.floor(slatF);
    const sv = slatF - slatIdx;
    const slatTone = (hash2(slatIdx, 3, 911) - 0.5) * 26;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const groove = sv < 0.16 || sv > 0.94;
      const woodGrain = tileFbm(u * 0.4, v * 5.0, 8, 4, 523 + slatIdx);

      let rCol: number;
      let gCol: number;
      let bCol: number;
      let hVal: number;
      let rVal: number;

      if (groove) {
        rCol = 32;
        gCol = 23;
        bCol = 18;
        hVal = 0.05;
        rVal = 0.95;
      } else {
        rCol = 158 + slatTone + (woodGrain - 0.5) * 32;
        gCol = 104 + slatTone * 0.72 + (woodGrain - 0.5) * 22;
        bCol = 64 + slatTone * 0.45 + (woodGrain - 0.5) * 16;
        hVal = 0.85 + (woodGrain - 0.5) * 0.08;
        rVal = 0.52 + (woodGrain - 0.5) * 0.16;
      }

      const idx = (y * size + x) * 4;
      d[idx] = clampByte(rCol);
      d[idx + 1] = clampByte(gCol);
      d[idx + 2] = clampByte(bCol);
      d[idx + 3] = 255;

      height[y * size + x] = hVal;
      rough[y * size + x] = rVal;
    }
  }

  ctx.putImageData(img, 0, 0);
  return {
    map: finalizeTexture(albedo, true, anisotropy),
    normalMap: finalizeTexture(heightToNormalCanvas(height, size, 3.8), false, anisotropy),
    roughnessMap: finalizeTexture(scalarToGrayscaleCanvas(rough, size), false, anisotropy),
  };
}

/**
 * 6. Brushed Anodized Metal (Mullions, Bronze Trim, Coping, Canopy Steel)
 */
export function createBrushedMetalPBR(
  baseRgb: [number, number, number],
  anisotropy = 8
): PBRTextureSet {
  const size = 256;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Stretched horizontal brushed grain
      const streak = tileNoise(u * 0.25, v, 64, 313) * 0.65 + tileNoise(u, v * 4, 32, 419) * 0.35;
      const delta = (streak - 0.5) * 18;

      const idx = (y * size + x) * 4;
      d[idx] = clampByte(baseRgb[0] + delta);
      d[idx + 1] = clampByte(baseRgb[1] + delta);
      d[idx + 2] = clampByte(baseRgb[2] + delta);
      d[idx + 3] = 255;

      height[y * size + x] = 0.5 + (streak - 0.5) * 0.15;
      rough[y * size + x] = 0.26 + (streak - 0.5) * 0.12;
    }
  }

  ctx.putImageData(img, 0, 0);
  return {
    map: finalizeTexture(albedo, true, anisotropy),
    normalMap: finalizeTexture(heightToNormalCanvas(height, size, 0.9), false, anisotropy),
    roughnessMap: finalizeTexture(scalarToGrayscaleCanvas(rough, size), false, anisotropy),
  };
}

/**
 * 7. Architectural Rooftop / Plaza Pedestal Pavers
 */
export function createPaverPBR(
  anisotropy = 8,
  baseRgb: [number, number, number] = [178, 176, 170],
  tiles = 4
): PBRTextureSet {
  const size = 512;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rF = v * tiles;
    const r = Math.floor(rF);
    const rv = rF - r;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const cF = u * tiles;
      const c = Math.floor(cF);
      const ru = cF - c;

      const seam = rv < 0.025 || rv > 0.975 || ru < 0.025 || ru > 0.975;
      const tileTone = (hash2(c, r, 617) - 0.5) * 14;
      const grain = tileFbm(u, v, 12, 4, 881);

      let rCol = baseRgb[0] + tileTone + (grain - 0.5) * 18;
      let gCol = baseRgb[1] + tileTone + (grain - 0.5) * 18;
      let bCol = baseRgb[2] + tileTone + (grain - 0.5) * 17;
      let hVal = 0.78 + (grain - 0.5) * 0.1;
      let rVal = 0.76 + (grain - 0.5) * 0.15;

      if (seam) {
        rCol *= 0.62;
        gCol *= 0.62;
        bCol *= 0.62;
        hVal = 0.15;
        rVal = 0.95;
      }

      const idx = (y * size + x) * 4;
      d[idx] = clampByte(rCol);
      d[idx + 1] = clampByte(gCol);
      d[idx + 2] = clampByte(bCol);
      d[idx + 3] = 255;

      height[y * size + x] = hVal;
      rough[y * size + x] = rVal;
    }
  }

  ctx.putImageData(img, 0, 0);
  return {
    map: finalizeTexture(albedo, true, anisotropy),
    normalMap: finalizeTexture(heightToNormalCanvas(height, size, 2.2), false, anisotropy),
    roughnessMap: finalizeTexture(scalarToGrayscaleCanvas(rough, size), false, anisotropy),
  };
}

/**
 * 8. Procedural Interior Architectural Rooms Atlas (Albedo + Emissive)
 * Placed physically recessed behind reflective curtain-wall glass for genuine 3D parallax
 * and warm twilight/evening architectural illumination!
 */
export function createInteriorRoomsTextures(anisotropy = 8): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const cols = 4;
  const rows = 4;
  const cellW = size / cols;
  const cellH = size / rows;

  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctxA = albedo.getContext('2d')!;

  const emissive = document.createElement('canvas');
  emissive.width = size;
  emissive.height = size;
  const ctxE = emissive.getContext('2d')!;

  ctxA.fillStyle = '#1b2029';
  ctxA.fillRect(0, 0, size, size);
  ctxE.fillStyle = '#000000';
  ctxE.fillRect(0, 0, size, size);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW;
      const y = r * cellH;
      const rnd = hash2(c, r, 991);
      const rnd2 = hash2(c, r, 419);
      const isLit = rnd > 0.22; // ~78% occupied/lit rooms for natural lived-in rhythm
      const warm = rnd2 > 0.32;

      // Room interior gradient (bright near ceiling troffers, warmer deeper wall, darker floor)
      const gradA = ctxA.createLinearGradient(x, y, x, y + cellH);
      if (isLit) {
        if (warm) {
          gradA.addColorStop(0.0, '#ffe8c2');
          gradA.addColorStop(0.24, '#e7c79a');
          gradA.addColorStop(0.68, '#7a644e');
          gradA.addColorStop(1.0, '#2a241f');
        } else {
          gradA.addColorStop(0.0, '#e6f0ff');
          gradA.addColorStop(0.24, '#bac9dc');
          gradA.addColorStop(0.68, '#556375');
          gradA.addColorStop(1.0, '#202630');
        }
      } else {
        gradA.addColorStop(0.0, '#2c3544');
        gradA.addColorStop(0.6, '#1a202c');
        gradA.addColorStop(1.0, '#10141c');
      }
      ctxA.fillStyle = gradA;
      ctxA.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);

      // Subtle architectural interior columns / room depth side walls
      ctxA.fillStyle = 'rgba(15, 20, 28, 0.28)';
      ctxA.fillRect(x, y, cellW * 0.08, cellH);
      ctxA.fillRect(x + cellW * 0.92, y, cellW * 0.08, cellH);

      // Interior furniture / desk / partition silhouettes near bottom 35%
      ctxA.fillStyle = isLit ? 'rgba(28, 24, 22, 0.55)' : 'rgba(10, 12, 16, 0.7)';
      const deskH = cellH * (0.2 + rnd2 * 0.14);
      ctxA.fillRect(x + cellW * 0.12, y + cellH - deskH, cellW * 0.76, deskH);

      // Optional vertical bookshelf / partition wall
      if (rnd2 > 0.5) {
        ctxA.fillStyle = 'rgba(20, 22, 26, 0.45)';
        ctxA.fillRect(x + cellW * (0.3 + rnd * 0.35), y + cellH * 0.2, cellW * 0.14, cellH * 0.8);
      }

      // Emissive map for ceiling linear LED lights + warm ambient bounce
      if (isLit) {
        const lum = 0.55 + rnd * 0.45;
        const gradE = ctxE.createLinearGradient(x, y, x, y + cellH);
        if (warm) {
          gradE.addColorStop(0.0, `rgba(255, 218, 154, ${lum.toFixed(2)})`);
          gradE.addColorStop(0.28, `rgba(255, 192, 114, ${(lum * 0.72).toFixed(2)})`);
          gradE.addColorStop(0.75, `rgba(170, 118, 62, ${(lum * 0.35).toFixed(2)})`);
          gradE.addColorStop(1.0, 'rgba(35, 22, 12, 0.15)');
        } else {
          gradE.addColorStop(0.0, `rgba(220, 236, 255, ${(lum * 0.85).toFixed(2)})`);
          gradE.addColorStop(0.28, `rgba(175, 206, 242, ${(lum * 0.55).toFixed(2)})`);
          gradE.addColorStop(0.75, `rgba(85, 110, 145, ${(lum * 0.25).toFixed(2)})`);
          gradE.addColorStop(1.0, 'rgba(20, 26, 36, 0.1)');
        }
        ctxE.fillStyle = gradE;
        ctxE.fillRect(x + 6, y + 6, cellW - 12, cellH - 12);

        // Crisp recessed linear ceiling light bars
        ctxE.fillStyle = warm ? '#fff4dd' : '#edf6ff';
        ctxE.fillRect(x + cellW * 0.18, y + cellH * 0.09, cellW * 0.64, cellH * 0.045);
        ctxE.fillRect(x + cellW * 0.26, y + cellH * 0.19, cellW * 0.48, cellH * 0.03);

        // Mask silhouettes in emissive map too for crisp interior shadows
        ctxE.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctxE.fillRect(x + cellW * 0.12, y + cellH - deskH, cellW * 0.76, deskH);
      }

      // Optional partially lowered translucent roller blind at top of some rooms
      if (rnd > 0.62) {
        const blindH = cellH * (0.18 + (rnd - 0.62) * 0.55);
        ctxA.fillStyle = 'rgba(210, 206, 198, 0.48)';
        ctxA.fillRect(x, y, cellW, blindH);
        ctxE.fillStyle = 'rgba(0, 0, 0, 0.42)';
        ctxE.fillRect(x, y, cellW, blindH);
      }

      // Room divider frame borders
      ctxA.strokeStyle = '#0e1116';
      ctxA.lineWidth = 5;
      ctxA.strokeRect(x, y, cellW, cellH);
      ctxE.strokeStyle = '#000000';
      ctxE.lineWidth = 6;
      ctxE.strokeRect(x, y, cellW, cellH);
    }
  }

  return {
    map: finalizeTexture(albedo, true, anisotropy),
    emissiveMap: finalizeTexture(emissive, true, anisotropy),
  };
}
