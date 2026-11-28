import * as THREE from 'three/webgpu';

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967295;
  };
}

export interface FoliageTextureMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * Generates a high-resolution 512x512 botanical leaf-sprig texture with:
 * - Slender woody central stem & side petioles
 * - 26 detailed layered elliptical leaves with central midribs, veins & organic tonal shift
 * - Crisp alpha cutout for dappled WebGPU shadow casting
 * - Matching Sobel normal map + leaf cuticle roughness map
 */
export function createBotanicalLeafSprigTextures(anisotropy = 8): FoliageTextureMaps {
  const size = 512;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hctx = heightCanvas.getContext('2d')!;
  hctx.fillStyle = '#000000';
  hctx.fillRect(0, 0, size, size);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;
  rctx.fillStyle = '#a8a8a8';
  rctx.fillRect(0, 0, size, size);

  const rand = seededRandom(48271);

  // Draw woody central twig & lateral shoots
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#4e3c2c';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.96);
  ctx.quadraticCurveTo(size * 0.48, size * 0.52, size * 0.51, size * 0.14);
  ctx.stroke();

  const drawLeaf = (
    cx: number,
    cy: number,
    angle: number,
    len: number,
    wid: number,
    hueShift: number,
    brightShift: number
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Stem petiole
    ctx.strokeStyle = '#5a4d34';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len * 0.14);
    ctx.stroke();

    // Realistic muted botanical olive-forest leaf palette (avoids cartoon lime greens)
    const rBase = Math.round(52 + hueShift * 14 + brightShift * 16);
    const gBase = Math.round(74 + hueShift * 12 + brightShift * 20);
    const bBase = Math.round(42 + brightShift * 12);

    const grad = ctx.createLinearGradient(0, 0, 0, -len);
    grad.addColorStop(0, `rgb(${Math.max(20, rBase - 22)}, ${Math.max(35, gBase - 24)}, ${Math.max(18, bBase - 14)})`);
    grad.addColorStop(0.55, `rgb(${rBase}, ${gBase}, ${bBase})`);
    grad.addColorStop(1, `rgb(${Math.min(220, rBase + 24)}, ${Math.min(235, gBase + 26)}, ${Math.min(180, bBase + 14)})`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.06);
    ctx.bezierCurveTo(wid * 0.85, -len * 0.25, wid * 0.72, -len * 0.75, 0, -len);
    ctx.bezierCurveTo(-wid * 0.72, -len * 0.75, -wid * 0.85, -len * 0.25, 0, -len * 0.06);
    ctx.closePath();
    ctx.fill();

    // Subtle dark edge definition
    ctx.strokeStyle = `rgba(${Math.max(15, rBase - 35)}, ${Math.max(25, gBase - 38)}, ${Math.max(15, bBase - 22)}, 0.45)`;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Central midrib & lateral veins
    ctx.strokeStyle = `rgba(${Math.min(235, rBase + 38)}, ${Math.min(245, gBase + 42)}, ${Math.min(200, bBase + 24)}, 0.55)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.08);
    ctx.lineTo(0, -len * 0.9);
    ctx.stroke();

    ctx.lineWidth = 0.9;
    for (let v = 1; v <= 4; v++) {
      const vy = -len * (0.2 + v * 0.15);
      const vw = wid * (0.48 - Math.abs(v - 2.3) * 0.1);
      ctx.beginPath();
      ctx.moveTo(0, vy);
      ctx.lineTo(vw, vy - len * 0.09);
      ctx.moveTo(0, vy);
      ctx.lineTo(-vw, vy - len * 0.09);
      ctx.stroke();
    }
    ctx.restore();

    // Heightfield cup for normal generation
    hctx.save();
    hctx.translate(cx, cy);
    hctx.rotate(angle);
    const hGrad = hctx.createLinearGradient(-wid * 0.6, 0, wid * 0.6, 0);
    hGrad.addColorStop(0, '#909090');
    hGrad.addColorStop(0.5, '#e8e8e8');
    hGrad.addColorStop(1, '#909090');
    hctx.fillStyle = hGrad;
    hctx.beginPath();
    hctx.moveTo(0, -len * 0.06);
    hctx.bezierCurveTo(wid * 0.85, -len * 0.25, wid * 0.72, -len * 0.75, 0, -len);
    hctx.bezierCurveTo(-wid * 0.72, -len * 0.75, -wid * 0.85, -len * 0.25, 0, -len * 0.06);
    hctx.closePath();
    hctx.fill();
    hctx.restore();

    // Cuticle roughness variation (waxy upper leaf surface ~0.48-0.64)
    rctx.save();
    rctx.translate(cx, cy);
    rctx.rotate(angle);
    const rVal = Math.round(115 + rand() * 45);
    rctx.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
    rctx.beginPath();
    rctx.moveTo(0, -len * 0.06);
    rctx.bezierCurveTo(wid * 0.85, -len * 0.25, wid * 0.72, -len * 0.75, 0, -len);
    rctx.bezierCurveTo(-wid * 0.72, -len * 0.75, -wid * 0.85, -len * 0.25, 0, -len * 0.06);
    rctx.closePath();
    rctx.fill();
    rctx.restore();
  };

  // Lateral sub-twigs & layered botanical leaf clusters forming a rich organic spray
  const clusters: { x: number; y: number; baseAngle: number; count: number; scale: number }[] = [
    { x: size * 0.50, y: size * 0.84, baseAngle: -0.95, count: 4, scale: 0.92 },
    { x: size * 0.50, y: size * 0.80, baseAngle: 0.95, count: 4, scale: 0.92 },
    { x: size * 0.49, y: size * 0.64, baseAngle: -0.82, count: 5, scale: 1.04 },
    { x: size * 0.50, y: size * 0.60, baseAngle: 0.82, count: 5, scale: 1.04 },
    { x: size * 0.49, y: size * 0.42, baseAngle: -0.68, count: 5, scale: 0.98 },
    { x: size * 0.51, y: size * 0.39, baseAngle: 0.68, count: 5, scale: 0.98 },
    { x: size * 0.50, y: size * 0.24, baseAngle: 0.0, count: 5, scale: 0.88 },
  ];

  for (const cl of clusters) {
    // Draw small woody side shoot
    const shootLen = 70 * cl.scale;
    const endX = cl.x + Math.sin(cl.baseAngle) * shootLen;
    const endY = cl.y - Math.cos(cl.baseAngle) * shootLen;
    ctx.strokeStyle = '#53412f';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(cl.x, cl.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    for (let i = 0; i < cl.count; i++) {
      const t = i / Math.max(1, cl.count - 1);
      const px = cl.x + (endX - cl.x) * (0.25 + t * 0.82) + (rand() - 0.5) * 14;
      const py = cl.y + (endY - cl.y) * (0.25 + t * 0.82) + (rand() - 0.5) * 14;
      const spread = (i % 2 === 0 ? -1 : 1) * (0.42 + rand() * 0.35);
      const ang = cl.baseAngle + (i === cl.count - 1 ? (rand() - 0.5) * 0.25 : spread);
      const len = (74 + rand() * 34) * cl.scale;
      const wid = len * (0.42 + rand() * 0.12);
      drawLeaf(px, py, ang, len, wid, (rand() - 0.5) * 1.1, (rand() - 0.45) * 0.9);
    }
  }

  // Fill center core lightly with angled leaves so canopy feels full without holes
  for (let i = 0; i < 8; i++) {
    const px = size * (0.34 + rand() * 0.32);
    const py = size * (0.28 + rand() * 0.5);
    const ang = (rand() - 0.5) * 2.4;
    const len = 68 + rand() * 28;
    drawLeaf(px, py, ang, len, len * 0.46, (rand() - 0.5) * 0.9, (rand() - 0.4) * 0.85);
  }

  // Convert height canvas to crisp tangent-space normal canvas
  const hData = hctx.getImageData(0, 0, size, size).data;
  const normCanvas = document.createElement('canvas');
  normCanvas.width = size;
  normCanvas.height = size;
  const nctx = normCanvas.getContext('2d')!;
  const nImg = nctx.createImageData(size, size);
  const nd = nImg.data;
  const atH = (x: number, y: number) => {
    const cx = Math.max(0, Math.min(size - 1, x));
    const cy = Math.max(0, Math.min(size - 1, y));
    return hData[(cy * size + cx) * 4] / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (atH(x + 1, y) - atH(x - 1, y)) * 2.2;
      const dy = (atH(x, y + 1) - atH(x, y - 1)) * 2.2;
      let nx = -dx, ny = dy, nz = 1.0;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const idx = (y * size + x) * 4;
      nd[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      nd[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nd[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nd[idx + 3] = 255;
    }
  }
  nctx.putImageData(nImg, 0, 0);

  const wrapTex = (canvas: HTMLCanvasElement, isColor: boolean) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = anisotropy;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  };

  return {
    map: wrapTex(colorCanvas, true),
    normalMap: wrapTex(normCanvas, false),
    roughnessMap: wrapTex(roughCanvas, false),
  };
}

interface BranchCollector {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  vCount: number;
}

interface LeafCollector {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
  vCount: number;
}

function addTaperedLimb(
  col: BranchCollector,
  pts: THREE.Vector3[],
  rStart: number,
  rEnd: number,
  radialSegs: number
): void {
  const rings = pts.length;
  const base = col.vCount;
  const up = new THREE.Vector3(0, 1, 0);
  const alt = new THREE.Vector3(1, 0, 0);

  let distAcc = 0;
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const p = pts[i];
    if (i > 0) distAcc += p.distanceTo(pts[i - 1]);

    const tangent = new THREE.Vector3();
    if (i === 0) tangent.subVectors(pts[1], pts[0]).normalize();
    else if (i === rings - 1) tangent.subVectors(pts[i], pts[i - 1]).normalize();
    else tangent.subVectors(pts[i + 1], pts[i - 1]).normalize();

    const ref = Math.abs(tangent.dot(up)) > 0.92 ? alt : up;
    const binorm = new THREE.Vector3().crossVectors(tangent, ref).normalize();
    const normAxis = new THREE.Vector3().crossVectors(binorm, tangent).normalize();

    // Subtle organic root flare on base ring
    const flare = i === 0 ? 1.28 : 1.0;
    const radius = (rStart + (rEnd - rStart) * t) * flare;

    for (let s = 0; s <= radialSegs; s++) {
      const st = s / radialSegs;
      const ang = st * Math.PI * 2;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);

      const nx = normAxis.x * cos + binorm.x * sin;
      const ny = normAxis.y * cos + binorm.y * sin;
      const nz = normAxis.z * cos + binorm.z * sin;

      col.positions.push(p.x + nx * radius, p.y + ny * radius, p.z + nz * radius);
      col.normals.push(nx, ny, nz);
      col.uvs.push(st * 1.5, distAcc * 0.75);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < rings - 1; i++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = base + i * stride + s;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      col.indices.push(a, c, d, a, d, b);
    }
  }
  col.vCount += rings * stride;
}

/**
 * Adds a curved 3x2 botanical leaf-sprig card with outward spherical-blended normals
 * for soft, painterly volumetric sunlight shading across the entire tree crown.
 */
function addCurvedLeafCard(
  col: LeafCollector,
  center: THREE.Vector3,
  canopyCenter: THREE.Vector3,
  quaternion: THREE.Quaternion,
  width: number,
  height: number,
  colorRGB: [number, number, number]
): void {
  const base = col.vCount;
  const cols = 2; // 3 vertices across X
  const rows = 2; // 3 vertices along Y
  const localPos = new THREE.Vector3();
  const worldPos = new THREE.Vector3();
  const radialNorm = new THREE.Vector3();
  const cardNorm = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize();

  for (let r = 0; r <= rows; r++) {
    const v = r / rows; // 0..1
    const y = (v - 0.32) * height;
    for (let c = 0; c <= cols; c++) {
      const u = c / cols; // 0..1
      const x = (u - 0.5) * width;
      // Gentle natural downward droop and slight cup arch so cards never look flat
      const arch = -Math.pow(u - 0.5, 2) * width * 0.45 - Math.pow(v - 0.5, 2) * height * 0.25;
      localPos.set(x, y, arch).applyQuaternion(quaternion).add(center);
      worldPos.copy(localPos);

      // Blend radial canopy normal (75%) + card normal (25%) for realistic foliage GI
      radialNorm.subVectors(worldPos, canopyCenter);
      if (radialNorm.lengthSq() < 1e-4) radialNorm.set(0, 1, 0);
      else radialNorm.normalize();
      radialNorm.lerp(cardNorm, 0.25).normalize();

      col.positions.push(worldPos.x, worldPos.y, worldPos.z);
      col.normals.push(radialNorm.x, radialNorm.y, radialNorm.z);
      col.uvs.push(u, v);
      col.colors.push(colorRGB[0], colorRGB[1], colorRGB[2]);
    }
  }

  const stride = cols + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = base + r * stride + c;
      const b = a + 1;
      const d = a + stride;
      const e = d + 1;
      col.indices.push(a, b, e, a, e, d);
    }
  }
  col.vCount += (rows + 1) * (cols + 1);
}

/**
 * Batch collector for high-detail botanical architectural trees & terrace shrubs.
 */
export class BotanicalFoliageBatcher {
  private branches: BranchCollector = { positions: [], normals: [], uvs: [], indices: [], vCount: 0 };
  private leaves: LeafCollector = { positions: [], normals: [], uvs: [], colors: [], indices: [], vCount: 0 };

  /**
   * Builds a lush, natural multi-branch deciduous architectural tree (maple/oak/birch silhouette)
   * with organic curving trunk, primary & secondary limbs, and ~115 curved botanical leaf cards.
   */
  addArchitecturalTree(x: number, baseY: number, z: number, heightScale = 1.0, seed = 101): void {
    const rand = seededRandom(seed);
    const trunkH = 2.65 * heightScale;
    const crownH = 3.25 * heightScale;
    const canopyCenter = new THREE.Vector3(x, baseY + trunkH + crownH * 0.42, z);

    // 1. Gently curving tapered main trunk
    const leanX = (rand() - 0.5) * 0.32 * heightScale;
    const leanZ = (rand() - 0.5) * 0.32 * heightScale;
    const trunkPts: THREE.Vector3[] = [];
    const trunkSteps = 6;
    for (let i = 0; i < trunkSteps; i++) {
      const t = i / (trunkSteps - 1);
      const sway = Math.sin(t * Math.PI) * 0.14 * heightScale;
      trunkPts.push(
        new THREE.Vector3(
          x + leanX * t + sway * Math.cos(seed),
          baseY + trunkH * 1.18 * t,
          z + leanZ * t + sway * Math.sin(seed)
        )
      );
    }
    addTaperedLimb(this.branches, trunkPts, 0.17 * heightScale, 0.065 * heightScale, 10);

    // Collect branch tips & mid-branch nodes for lush leaf card placement
    const leafAnchors: { pos: THREE.Vector3; dir: THREE.Vector3; weight: number }[] = [];

    // 2. Primary boughs emerging with golden-angle spiral spacing
    const numBoughs = 6;
    const goldenAngle = 2.3999632;
    for (let b = 0; b < numBoughs; b++) {
      const heightT = 0.52 + (b / numBoughs) * 0.46;
      const origin = new THREE.Vector3().lerpVectors(
        trunkPts[Math.floor(heightT * (trunkSteps - 1))],
        trunkPts[Math.min(trunkSteps - 1, Math.ceil(heightT * (trunkSteps - 1)))],
        0.5
      );

      const yaw = b * goldenAngle + rand() * 0.45;
      const pitch = 0.42 + (1 - heightT) * 0.42 + rand() * 0.15; // lower boughs spread wider
      const boughLen = (1.45 + (1 - heightT * 0.45) * 0.95 + rand() * 0.35) * heightScale;

      const dir = new THREE.Vector3(
        Math.cos(yaw) * Math.sin(pitch),
        Math.cos(pitch),
        Math.sin(yaw) * Math.sin(pitch)
      ).normalize();

      const mid = origin
        .clone()
        .addScaledVector(dir, boughLen * 0.52)
        .add(new THREE.Vector3((rand() - 0.5) * 0.25, 0.16 * heightScale, (rand() - 0.5) * 0.25));
      const tip = origin
        .clone()
        .addScaledVector(dir, boughLen)
        .add(new THREE.Vector3((rand() - 0.5) * 0.3, 0.28 * heightScale, (rand() - 0.5) * 0.3));

      addTaperedLimb(this.branches, [origin, mid, tip], 0.072 * heightScale, 0.022 * heightScale, 7);
      leafAnchors.push({ pos: tip, dir, weight: 1.0 });
      leafAnchors.push({ pos: mid.clone().lerp(tip, 0.55), dir, weight: 0.8 });

      // 3. Secondary sub-branches forking outward & upward from each bough
      const subCount = 3;
      for (let s = 0; s < subCount; s++) {
        const startPt = origin.clone().lerp(tip, 0.42 + s * 0.22);
        const subYaw = yaw + (s % 2 === 0 ? 1 : -1) * (0.55 + rand() * 0.45);
        const subPitch = Math.max(0.22, pitch - 0.18 + (rand() - 0.5) * 0.32);
        const subLen = (0.72 + rand() * 0.45) * heightScale;
        const subDir = new THREE.Vector3(
          Math.cos(subYaw) * Math.sin(subPitch),
          Math.cos(subPitch),
          Math.sin(subYaw) * Math.sin(subPitch)
        ).normalize();
        const subTip = startPt.clone().addScaledVector(subDir, subLen);
        addTaperedLimb(this.branches, [startPt, subTip], 0.032 * heightScale, 0.011 * heightScale, 5);
        leafAnchors.push({ pos: subTip, dir: subDir, weight: 0.92 });
      }
    }

    // Crown leader apex twigs
    const apexBase = trunkPts[trunkSteps - 1];
    const apexTip = apexBase.clone().add(new THREE.Vector3((rand() - 0.5) * 0.25, 1.45 * heightScale, (rand() - 0.5) * 0.25));
    addTaperedLimb(this.branches, [apexBase, apexTip], 0.055 * heightScale, 0.015 * heightScale, 6);
    leafAnchors.push({ pos: apexTip, dir: new THREE.Vector3(0, 1, 0), weight: 1.0 });

    // 4. Populate lush overlapping botanical leaf-sprig clusters around every branch tip
    const dummyEuler = new THREE.Euler();
    const quat = new THREE.Quaternion();
    const cardPos = new THREE.Vector3();

    for (const anchor of leafAnchors) {
      const cardsPerCluster = Math.round(4 + anchor.weight * 2);
      for (let k = 0; k < cardsPerCluster; k++) {
        const jitterR = (0.28 + rand() * 0.62) * heightScale;
        const theta = rand() * Math.PI * 2;
        const phi = rand() * Math.PI;
        cardPos.set(
          anchor.pos.x + Math.sin(phi) * Math.cos(theta) * jitterR,
          anchor.pos.y + Math.cos(phi) * jitterR * 0.72,
          anchor.pos.z + Math.sin(phi) * Math.sin(theta) * jitterR
        );

        // Orient leaf sprig mostly outward from canopy center with natural flutter tilt
        const outDir = cardPos.clone().sub(canopyCenter).normalize();
        dummyEuler.set(
          (rand() - 0.5) * 1.1 + outDir.y * 0.5,
          Math.atan2(outDir.x, outDir.z) + (rand() - 0.5) * 1.5,
          (rand() - 0.5) * 0.95
        );
        quat.setFromEuler(dummyEuler);

        const cardScale = (0.78 + rand() * 0.52) * heightScale;
        // Natural muted sunlit crown vs deep shaded inner canopy
        const heightNorm = Math.max(0, Math.min(1, (cardPos.y - (baseY + trunkH * 0.8)) / (crownH * 1.15)));
        const shade = 0.56 + heightNorm * 0.28 + (rand() - 0.5) * 0.12;
        const tint: [number, number, number] = [
          Math.min(0.92, shade * (0.94 + rand() * 0.1)),
          Math.min(0.95, shade * (0.98 + rand() * 0.08)),
          Math.min(0.88, shade * (0.86 + rand() * 0.08)),
        ];

        addCurvedLeafCard(this.leaves, cardPos, canopyCenter, quat, cardScale, cardScale * 1.08, tint);
      }
    }
  }

  /**
   * Adds an architectural multi-stem ornamental terrace shrub using botanical leaf cards
   * (used in rooftop setback planters so zero low-poly blobs appear anywhere).
   */
  addPlanterShrub(x: number, baseY: number, z: number, width: number, depth: number, seed = 202): void {
    const rand = seededRandom(seed);
    const center = new THREE.Vector3(x, baseY + 0.42, z);
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const pos = new THREE.Vector3();

    // Small woody interior stems
    for (let s = 0; s < 4; s++) {
      const sx = x + (rand() - 0.5) * width * 0.55;
      const sz = z + (rand() - 0.5) * depth * 0.55;
      const p0 = new THREE.Vector3(sx, baseY, sz);
      const p1 = new THREE.Vector3(sx + (rand() - 0.5) * 0.25, baseY + 0.45 + rand() * 0.2, sz + (rand() - 0.5) * 0.25);
      addTaperedLimb(this.branches, [p0, p1], 0.028, 0.012, 5);
    }

    // Lush layered foliage sprig cards
    const count = 22;
    for (let i = 0; i < count; i++) {
      const rx = (rand() - 0.5) * width * 0.85;
      const rz = (rand() - 0.5) * depth * 0.85;
      const ry = 0.2 + rand() * 0.52;
      pos.set(x + rx, baseY + ry, z + rz);

      euler.set((rand() - 0.5) * 1.15, rand() * Math.PI * 2, (rand() - 0.5) * 0.9);
      quat.setFromEuler(euler);

      const sz = 0.42 + rand() * 0.24;
      const shade = 0.58 + ry * 0.28 + (rand() - 0.5) * 0.12;
      addCurvedLeafCard(this.leaves, pos, center, quat, sz, sz * 1.05, [
        shade * 0.94,
        shade * 0.98,
        shade * 0.86,
      ]);
    }
  }

  build(): { barkGeo: THREE.BufferGeometry | null; foliageGeo: THREE.BufferGeometry | null } {
    let barkGeo: THREE.BufferGeometry | null = null;
    if (this.branches.indices.length > 0) {
      barkGeo = new THREE.BufferGeometry();
      const uvAttr = new THREE.Float32BufferAttribute(this.branches.uvs, 2);
      barkGeo.setAttribute('position', new THREE.Float32BufferAttribute(this.branches.positions, 3));
      barkGeo.setAttribute('normal', new THREE.Float32BufferAttribute(this.branches.normals, 3));
      barkGeo.setAttribute('uv', uvAttr);
      barkGeo.setAttribute('uv1', uvAttr);
      barkGeo.setIndex(this.branches.indices);
      barkGeo.computeBoundingSphere();
    }

    let foliageGeo: THREE.BufferGeometry | null = null;
    if (this.leaves.indices.length > 0) {
      foliageGeo = new THREE.BufferGeometry();
      foliageGeo.setAttribute('position', new THREE.Float32BufferAttribute(this.leaves.positions, 3));
      foliageGeo.setAttribute('normal', new THREE.Float32BufferAttribute(this.leaves.normals, 3));
      foliageGeo.setAttribute('uv', new THREE.Float32BufferAttribute(this.leaves.uvs, 2));
      foliageGeo.setAttribute('color', new THREE.Float32BufferAttribute(this.leaves.colors, 3));
      foliageGeo.setIndex(this.leaves.indices);
      foliageGeo.computeBoundingSphere();
    }

    return { barkGeo, foliageGeo };
  }
}
