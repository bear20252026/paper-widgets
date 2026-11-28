import * as THREE from 'three/webgpu';

interface GeometryBucket {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  vertexCount: number;
}

/**
 * High-performance procedural geometry batcher grouped by material key.
 * Automatically generates real-world metric UVs (no stretching on arbitrary extrusions!)
 * and duplicates UVs to uv1 so AmbientCG Ambient Occlusion (aoMap) channels work natively.
 */
export class MaterialGeometryBatcher {
  private buckets = new Map<string, GeometryBucket>();

  private getBucket(key: string): GeometryBucket {
    let b = this.buckets.get(key);
    if (!b) {
      b = { positions: [], normals: [], uvs: [], indices: [], vertexCount: 0 };
      this.buckets.set(key, b);
    }
    return b;
  }

  /**
   * Adds an axis-aligned box [x0..x1, y0..y1, z0..z1] with world-space metric UVs.
   * uvScale = meters per 1 texture repeat (default 3.0m).
   */
  addBox(
    matKey: string,
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    uvScale = 3.0
  ): void {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const minZ = Math.min(z0, z1);
    const maxZ = Math.max(z0, z1);

    if (maxX - minX < 1e-4 || maxY - minY < 1e-4 || maxZ - minZ < 1e-4) return;

    const inv = 1 / uvScale;

    // +Z
    this.addQuad(
      matKey,
      [minX, minY, maxZ],
      [maxX, minY, maxZ],
      [maxX, maxY, maxZ],
      [minX, maxY, maxZ],
      [0, 0, 1],
      [
        [minX * inv, minY * inv],
        [maxX * inv, minY * inv],
        [maxX * inv, maxY * inv],
        [minX * inv, maxY * inv],
      ]
    );
    // -Z
    this.addQuad(
      matKey,
      [maxX, minY, minZ],
      [minX, minY, minZ],
      [minX, maxY, minZ],
      [maxX, maxY, minZ],
      [0, 0, -1],
      [
        [minX * inv, minY * inv],
        [maxX * inv, minY * inv],
        [maxX * inv, maxY * inv],
        [minX * inv, maxY * inv],
      ]
    );
    // +X
    this.addQuad(
      matKey,
      [maxX, minY, maxZ],
      [maxX, minY, minZ],
      [maxX, maxY, minZ],
      [maxX, maxY, maxZ],
      [1, 0, 0],
      [
        [minZ * inv, minY * inv],
        [maxZ * inv, minY * inv],
        [maxZ * inv, maxY * inv],
        [minZ * inv, maxY * inv],
      ]
    );
    // -X
    this.addQuad(
      matKey,
      [minX, minY, minZ],
      [minX, minY, maxZ],
      [minX, maxY, maxZ],
      [minX, maxY, minZ],
      [-1, 0, 0],
      [
        [minZ * inv, minY * inv],
        [maxZ * inv, minY * inv],
        [maxZ * inv, maxY * inv],
        [minZ * inv, maxY * inv],
      ]
    );
    // +Y
    this.addQuad(
      matKey,
      [minX, maxY, maxZ],
      [maxX, maxY, maxZ],
      [maxX, maxY, minZ],
      [minX, maxY, minZ],
      [0, 1, 0],
      [
        [minX * inv, minZ * inv],
        [maxX * inv, minZ * inv],
        [maxX * inv, maxZ * inv],
        [minX * inv, maxZ * inv],
      ]
    );
    // -Y
    this.addQuad(
      matKey,
      [minX, minY, minZ],
      [maxX, minY, minZ],
      [maxX, minY, maxZ],
      [minX, minY, maxZ],
      [0, -1, 0],
      [
        [minX * inv, minZ * inv],
        [maxX * inv, minZ * inv],
        [maxX * inv, maxZ * inv],
        [minX * inv, maxZ * inv],
      ]
    );
  }

  /**
   * Adds a single oriented quad with explicit CCW vertices, normal, and UVs.
   */
  addQuad(
    matKey: string,
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    normal: [number, number, number],
    uvs: [[number, number], [number, number], [number, number], [number, number]]
  ): void {
    const b = this.getBucket(matKey);
    const base = b.vertexCount;

    b.positions.push(...p0, ...p1, ...p2, ...p3);
    b.normals.push(...normal, ...normal, ...normal, ...normal);
    b.uvs.push(
      uvs[0][0], uvs[0][1],
      uvs[1][0], uvs[1][1],
      uvs[2][0], uvs[2][1],
      uvs[3][0], uvs[3][1]
    );
    b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    b.vertexCount += 4;
  }

  /**
   * Adds a vertical architectural cylinder (e.g. pilotis columns, lamp posts, HVAC fan shrouds).
   */
  addCylinder(
    matKey: string,
    cx: number,
    y0: number,
    y1: number,
    cz: number,
    radiusBottom: number,
    radiusTop = radiusBottom,
    segments = 16
  ): void {
    if (y1 - y0 < 1e-3) return;
    const b = this.getBucket(matKey);
    const base = b.vertexCount;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      b.positions.push(cx + cos * radiusBottom, y0, cz + sin * radiusBottom);
      b.normals.push(cos, 0, sin);
      b.uvs.push(t * 2, y0 * 0.35);

      b.positions.push(cx + cos * radiusTop, y1, cz + sin * radiusTop);
      b.normals.push(cos, 0, sin);
      b.uvs.push(t * 2, y1 * 0.35);
    }

    for (let i = 0; i < segments; i++) {
      const i0 = base + i * 2;
      const i1 = i0 + 1;
      const i2 = i0 + 2;
      const i3 = i0 + 3;
      b.indices.push(i0, i2, i3, i0, i3, i1);
    }
    b.vertexCount += (segments + 1) * 2;
  }

  /**
   * Builds final BufferGeometries keyed by material key (with uv1 attached for aoMap).
   */
  buildGeometries(): Map<string, THREE.BufferGeometry> {
    const out = new Map<string, THREE.BufferGeometry>();
    for (const [key, b] of this.buckets.entries()) {
      if (b.indices.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      const uvAttr = new THREE.Float32BufferAttribute(b.uvs, 2);
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
      geo.setAttribute('uv', uvAttr);
      geo.setAttribute('uv1', uvAttr);
      geo.setIndex(b.indices);
      geo.computeBoundingSphere();
      out.set(key, geo);
    }
    return out;
  }
}
