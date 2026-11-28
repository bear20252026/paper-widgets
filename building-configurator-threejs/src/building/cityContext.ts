import * as THREE from 'three/webgpu';

interface ContextBlock {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  sunk: number;
  isBase: boolean;
}

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967295;
  };
}

const tmpMat = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const camPos = new THREE.Vector3();

/**
 * Architectural White City Massing Context — closely matched to ProdceduralBuildingsThreeJS
 * (app.jpg / city.jpg / new-york.jpg / golden-hour.jpg / blue-hour.jpg).
 * Surrounds the hero block directly across an 11m avenue with crisp matte-white architectural
 * context blocks, automatically sinking any block between the camera and hero building!
 */
export class ArchitecturalCityContext {
  public readonly group = new THREE.Group();
  private mesh: THREE.InstancedMesh | null = null;
  private material: THREE.MeshStandardMaterial;
  private geometry: THREE.BoxGeometry;
  private blocks: ContextBlock[] = [];
  private lastKey = '';

  constructor() {
    this.group.name = 'ArchitecturalCityContext';
    this.geometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#eef0f3'),
      roughness: 0.92,
      metalness: 0.0,
    });
  }

  public setTone(tintHex: string): void {
    this.material.color.set(tintHex);
  }

  public updateForBounds(bounds: THREE.Box3): void {
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    bounds.getCenter(center);
    bounds.getSize(size);

    // Match hero sidewalk (pad 3.8 + curb 0.26) + realistic 9.4m urban street!
    const roadW = 9.4;
    const heroHalfX = size.x * 0.5 + 4.06;
    const heroHalfZ = size.z * 0.5 + 4.06;
    const heroH = Math.max(10, size.y);

    const key = `${Math.round(heroHalfX)}|${Math.round(heroHalfZ)}|${Math.round(heroH / 4)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    const rand = seededRand(202611);
    const blocks: ContextBlock[] = [];

    // Compute clean urban block grid anchored right outside the 4 streets surrounding the hero site
    const blockSpanX = Math.max(22, heroHalfX * 2);
    const blockSpanZ = Math.max(20, heroHalfZ * 2);
    const stepX = blockSpanX + roadW;
    const stepZ = blockSpanZ + roadW;
    const gridRange = 4;

    for (let gx = -gridRange; gx <= gridRange; gx++) {
      for (let gz = -gridRange; gz <= gridRange; gz++) {
        if (gx === 0 && gz === 0) continue; // hero site

        const bx = center.x + gx * stepX;
        const bz = center.z + gz * stepZ;
        const dist = Math.hypot(bx - center.x, bz - center.z);
        if (dist > 155) continue;

        const lotW = blockSpanX;
        const lotD = blockSpanZ;

        // Crisp white architectural sidewalk slab per surrounding city block
        blocks.push({
          x: bx,
          z: bz,
          w: lotW,
          h: 0.16,
          d: lotD,
          sunk: 0,
          isBase: true,
        });

        const padLot = 1.6;
        const innerW = lotW - padLot * 2;
        const innerD = lotD - padLot * 2;
        const subX = innerW > 18 ? 2 : 1;
        const subZ = innerD > 16 ? 2 : 1;
        const cellW = innerW / subX;
        const cellD = innerD / subZ;

        for (let sx = 0; sx < subX; sx++) {
          for (let sz = 0; sz < subZ; sz++) {
            const vx = bx - innerW * 0.5 + (sx + 0.5) * cellW;
            const vz = bz - innerD * 0.5 + (sz + 0.5) * cellD;
            const gap = 0.6 + rand() * 0.9;
            const w = Math.max(5.0, cellW - gap);
            const d = Math.max(5.0, cellD - gap);

            // Immediate neighbors sit slightly calmer around hero height; outer skyline rises gracefully
            const isRing1 = Math.abs(gx) <= 1 && Math.abs(gz) <= 1;
            const ringScale = isRing1 ? 0.65 + rand() * 0.55 : 0.85 + rand() * 1.15;
            const h = Math.max(
              6.5,
              heroH * ringScale + (!isRing1 && rand() > 0.72 ? 12 + rand() * 18 : 0)
            );

            blocks.push({ x: vx, z: vz, w, h, d, sunk: 0, isBase: false });

            if (rand() > 0.45 && w > 6 && d > 6) {
              blocks.push({
                x: vx + (rand() - 0.5) * 1.0,
                z: vz + (rand() - 0.5) * 1.0,
                w: w * (0.55 + rand() * 0.22),
                h: h + 2.5 + rand() * 4.0,
                d: d * (0.55 + rand() * 0.22),
                sunk: 0,
                isBase: false,
              });
            }
          }
        }
      }
    }

    this.blocks = blocks;

    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.dispose();
    }

    const im = new THREE.InstancedMesh(this.geometry, this.material, blocks.length);
    im.castShadow = true;
    im.receiveShadow = true;
    this.mesh = im;
    this.group.add(im);
    this.applyMatrices();
  }

  private applyMatrices(): void {
    if (!this.mesh) return;
    for (let i = 0; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      tmpPos.set(b.x, -0.155 - b.sunk, b.z);
      tmpScale.set(b.w, b.h, b.d);
      tmpMat.compose(tmpPos, tmpQuat, tmpScale);
      this.mesh.setMatrixAt(i, tmpMat);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.computeBoundingSphere();
  }

  public tickViewClear(dt: number, camera: THREE.Camera, target: THREE.Vector3): void {
    if (!this.mesh || this.blocks.length === 0) return;
    camera.getWorldPosition(camPos);

    const dx = target.x - camPos.x;
    const dz = target.z - camPos.z;
    const horizLen = Math.hypot(dx, dz);
    if (horizLen < 1) return;
    const ux = dx / horizLen;
    const uz = dz / horizLen;

    const ease = Math.min(1, dt * 6);
    let dirty = false;

    for (let i = 0; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      if (b.isBase) continue;

      const relX = b.x - camPos.x;
      const relZ = b.z - camPos.z;
      const proj = relX * ux + relZ * uz;
      let targetSink = 0;

      if (proj > -6 && proj < horizLen - 8) {
        const perp = Math.abs(relX * -uz + relZ * ux);
        const coneR = 6.5 + (proj / Math.max(1, horizLen)) * 10 + Math.max(b.w, b.d) * 0.55;
        if (perp < coneR) {
          targetSink = b.h + 1.0;
        }
      }

      if (Math.abs(targetSink - b.sunk) > 0.02) {
        b.sunk += (targetSink - b.sunk) * ease;
        if (Math.abs(targetSink - b.sunk) < 0.05) b.sunk = targetSink;
        tmpPos.set(b.x, -0.155 - b.sunk, b.z);
        tmpScale.set(b.w, b.h, b.d);
        tmpMat.compose(tmpPos, tmpQuat, tmpScale);
        this.mesh.setMatrixAt(i, tmpMat);
        dirty = true;
      }
    }

    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.dispose();
      this.mesh = null;
    }
    this.geometry.dispose();
    this.material.dispose();
  }
}
