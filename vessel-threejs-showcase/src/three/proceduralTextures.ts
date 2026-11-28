import * as THREE from 'three';

/**
 * Generates seamless procedural PBR CanvasTextures (zero network dependencies)
 * so copper cladding, precast concrete, and Hudson Yards plaza pavers look
 * crisp, tactile, and photorealistic even in extreme architectural close-ups.
 */

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeTexture(canvas: HTMLCanvasElement, repeatX: number, repeatY: number, isColor = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

/** Architectural copper cladding panel seams + fine brushed metallic grain. */
export function createCopperMaps() {
  const size = 512;
  const [bumpC, bCtx] = makeCanvas(size);
  const [roughC, rCtx] = makeCanvas(size);

  // Neutral mid-height base for bump & base roughness
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#909090';
  rCtx.fillRect(0, 0, size, size);

  // Fine horizontal brushed steel micro-streaks
  for (let y = 0; y < size; y++) {
    const streak = 118 + Math.sin(y * 0.9) * 6 + ((y * 37) % 13) - 6;
    bCtx.fillStyle = `rgb(${streak},${streak},${streak})`;
    bCtx.fillRect(0, y, size, 1);

    const rv = 110 + ((y * 53) % 32);
    rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rCtx.fillRect(0, y, size, 1);
  }

  // Subtle staggered architectural copper panel tiles + recessed panel seams
  const cols = 2;
  const rows = 4;
  const cw = size / cols;
  const rh = size / rows;
  for (let row = 0; row < rows; row++) {
    const offsetX = row % 2 === 0 ? 0 : cw * 0.5;
    for (let col = -1; col <= cols; col++) {
      const x = col * cw + offsetX;
      const y = row * rh;
      // Slight per-panel roughness sheen variation (realistic metal cladding!)
      const tone = 115 + ((row * 17 + col * 31 + 100) % 40);
      rCtx.fillStyle = `rgba(${tone},${tone},${tone},0.35)`;
      rCtx.fillRect(x + 2, y + 2, cw - 4, rh - 4);

      // Subtle architectural seam groove
      bCtx.strokeStyle = '#363636';
      bCtx.lineWidth = 3;
      bCtx.strokeRect(x, y, cw, rh);

      rCtx.strokeStyle = '#d8d8d8';
      rCtx.lineWidth = 3;
      rCtx.strokeRect(x, y, cw, rh);
    }
  }

  return {
    bumpMap: finalizeTexture(bumpC, 1, 1, false),
    roughnessMap: finalizeTexture(roughC, 1, 1, false),
  };
}

/** Precast architectural concrete / limestone tread texture. */
export function createConcreteMaps() {
  const size = 512;
  const [colC, cCtx] = makeCanvas(size);
  const [bumpC, bCtx] = makeCanvas(size);

  cCtx.fillStyle = '#c8c4bc';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Subtle mineral speckles & travertine tone mottling
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 450; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 12 + rand() * 38;
    const shade = Math.round(184 + (rand() - 0.5) * 28);
    cCtx.fillStyle = `rgba(${shade},${shade - 3},${shade - 7},0.12)`;
    cCtx.beginPath();
    cCtx.arc(x, y, rad, 0, Math.PI * 2);
    cCtx.fill();
  }

  for (let i = 0; i < 6500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const s = 1 + rand() * 2.2;
    const v = Math.round(150 + rand() * 85);
    cCtx.fillStyle = `rgba(${v},${v - 2},${v - 5},0.16)`;
    cCtx.fillRect(x, y, s, s);
    bCtx.fillStyle = `rgba(${v},${v},${v},0.22)`;
    bCtx.fillRect(x, y, s, s);
  }

  return {
    map: finalizeTexture(colC, 1, 1, true),
    bumpMap: finalizeTexture(bumpC, 1, 1, false),
  };
}

/** Hudson Yards architectural granite plaza paver grid with soft expansion joints. */
export function createPlazaMaps() {
  const size = 1024;
  const [colC, cCtx] = makeCanvas(size);
  const [bumpC, bCtx] = makeCanvas(size);
  const [roughC, rCtx] = makeCanvas(size);

  cCtx.fillStyle = '#3c3e42';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#8a8a8a';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#a8a8a8';
  rCtx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 6;
  const cw = size / cols;
  const rh = size / rows;

  let seed = 9187;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let r = 0; r < rows; r++) {
    const offX = (r % 2) * cw * 0.5;
    for (let c = -1; c <= cols; c++) {
      const x = c * cw + offX;
      const y = r * rh;
      const base = Math.round(62 + (rand() - 0.5) * 16);
      cCtx.fillStyle = `rgb(${base + 2},${base + 1},${base})`;
      cCtx.fillRect(x + 2, y + 2, cw - 4, rh - 4);

      const rough = Math.round(135 + (rand() - 0.5) * 34);
      rCtx.fillStyle = `rgb(${rough},${rough},${rough})`;
      rCtx.fillRect(x + 2, y + 2, cw - 4, rh - 4);

      // Subtle dark mortar joint
      cCtx.strokeStyle = '#252629';
      cCtx.lineWidth = 4;
      cCtx.strokeRect(x, y, cw, rh);

      bCtx.strokeStyle = '#303030';
      bCtx.lineWidth = 4;
      bCtx.strokeRect(x, y, cw, rh);
    }
  }

  // Fine granite grain noise
  for (let i = 0; i < 12000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const g = Math.round(45 + rand() * 55);
    cCtx.fillStyle = `rgba(${g},${g},${g},0.18)`;
    cCtx.fillRect(x, y, 2, 2);
  }

  return {
    map: finalizeTexture(colC, 90, 90, true),
    bumpMap: finalizeTexture(bumpC, 90, 90, false),
    roughnessMap: finalizeTexture(roughC, 90, 90, false),
  };
}
