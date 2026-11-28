import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  FOREST_HALF_X,
  FOREST_MAX_Z,
  FOREST_MIN_Z,
  groveDensity,
  groveTint,
  mulberry32,
  riverCenter,
  riverHalfWidth,
  terrainHeight,
} from "./math";
import { PALETTE, sharedUniforms, srgbVec } from "./shared";
import { CANOPY_FRAG, CANOPY_VERT, TRUNK_FRAG, TRUNK_VERT } from "./shaders";

/** 4×4 spatial chunks × 1,280 trees each = 20,480 real sakura trees (32 draw calls total). */
export const TREE_CHUNKS = 4;
export const TREES_PER_CHUNK = 1280;
export const TREE_COUNT = TREE_CHUNKS * TREE_CHUNKS * TREES_PER_CHUNK; // 20,480

/** Creates a raw sRGB THREE.Color so instanceColor passes un-darkened vivid anime hues to GLSL. */
function rawSrgb(hex: number): THREE.Color {
  const c = new THREE.Color();
  c.setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
  return c;
}

/** Dreamy anime sakura blossom palette: snow-blush, classic sakura, vivid yaezakura, sunset peach, lilac-pink. */
const SAKURA_SWATCHES = [
  rawSrgb(0xffe6f2), // snow-blush Somei Yoshino
  rawSrgb(0xffc2de), // soft pastel sakura
  rawSrgb(0xffa4cc), // classic romantic sakura pink
  rawSrgb(0xff84bc), // vivid magenta-pink yaezakura
  rawSrgb(0xffa8be), // warm coral-peach sunset blossom
  rawSrgb(0xf4a4ec), // dreamy twilight lilac-sakura
];

/** Tapered sakura trunk splitting into three graceful spreading boughs (~30 tris). */
function createTrunkGeometry(): THREE.BufferGeometry {
  const stem = new THREE.CylinderGeometry(0.32, 0.68, 6.4, 6, 1, false);
  stem.translate(0, 3.2, 0);

  const makeBough = (yaw: number, tilt: number, len: number): THREE.BufferGeometry => {
    const b = new THREE.CylinderGeometry(0.16, 0.3, len, 5, 1, false);
    b.translate(0, len * 0.5, 0);
    b.rotateZ(tilt);
    b.rotateY(yaw);
    b.translate(0, 4.6, 0);
    return b;
  };

  const parts = [
    stem,
    makeBough(0.2, 0.68, 4.1),
    makeBough(2.35, 0.72, 3.9),
    makeBough(4.45, 0.64, 3.7),
  ].map((g) => {
    const nonIdx = g.index ? g.toNonIndexed() : g;
    nonIdx.deleteAttribute("uv");
    return nonIdx;
  });

  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error("Failed to build sakura trunk geometry");
  merged.computeVertexNormals();
  return merged;
}

/**
 * Wide, billowy umbrella-style anime cherry blossom crown composed of five overlapping
 * blossom cloud puffs with smooth Ghibli-style puff+dome normals (`aCloudNormal`).
 */
function createCanopyGeometry(): THREE.BufferGeometry {
  const domeCenter = new THREE.Vector3(0, 7.2, 0);

  const makeLobe = (
    rx: number,
    ry: number,
    rz: number,
    cx: number,
    cy: number,
    cz: number,
    wSeg: number,
    hSeg: number
  ): THREE.BufferGeometry => {
    const g = new THREE.SphereGeometry(1, wSeg, hSeg);
    const nonIdx = g.index ? g.toNonIndexed() : g;
    nonIdx.deleteAttribute("uv");

    const pos = nonIdx.attributes.position;
    const cloudNormals = new Float32Array(pos.count * 3);
    const puffN = new THREE.Vector3();
    const domeN = new THREE.Vector3();
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i);
      const lz = pos.getZ(i);

      // Gentle organic scalloping so every lobe reads like fluffy blossom clusters
      const scallop =
        1.0 + 0.08 * Math.sin(lx * 4.1 + cz) * Math.cos(lz * 4.3 - cx) + 0.05 * Math.sin(ly * 5.0);
      const wx = cx + lx * rx * scallop;
      const wy = cy + ly * ry * scallop;
      const wz = cz + lz * rz * scallop;
      pos.setXYZ(i, wx, wy, wz);

      // Blend individual cloud-puff normal with overall crown dome normal for velvety anime cel bands
      puffN.set(lx / rx, (ly / ry) * 0.85, lz / rz).normalize();
      domeN.set(wx - domeCenter.x, (wy - domeCenter.y) * 1.15, wz - domeCenter.z).normalize();
      v.copy(puffN).lerp(domeN, 0.52).normalize();

      cloudNormals[i * 3] = v.x;
      cloudNormals[i * 3 + 1] = v.y;
      cloudNormals[i * 3 + 2] = v.z;
    }

    nonIdx.setAttribute("aCloudNormal", new THREE.BufferAttribute(cloudNormals, 3));
    return nonIdx;
  };

  // Broad spreading sakura umbrella crown: lush central dome + 4 billowing peripheral blossom clouds
  const lobes = [
    makeLobe(5.5, 3.3, 5.3, 0.0, 9.7, 0.0, 8, 5),
    makeLobe(4.0, 2.5, 3.8, 3.4, 8.4, 1.4, 6, 4),
    makeLobe(3.9, 2.5, 3.7, -3.3, 8.6, 1.2, 6, 4),
    makeLobe(3.8, 2.4, 3.9, -0.8, 8.5, -3.2, 6, 4),
    makeLobe(3.3, 2.3, 3.2, 1.3, 11.2, -0.9, 6, 4),
  ];

  const merged = mergeGeometries(lobes, false);
  if (!merged) throw new Error("Failed to merge sakura canopy geometry");
  return merged;
}

/**
 * Procedurally populates the entire valley with 20,480 cel-shaded cherry blossom trees
 * rendered through chunked InstancedMeshes with GPU wind-wave sway.
 */
export function createForest(): THREE.Group {
  const group = new THREE.Group();
  group.name = "sakura-forest";

  const trunkGeo = createTrunkGeometry();
  const canopyGeo = createCanopyGeometry();

  const sharedTreeUniforms = {
    uTime: sharedUniforms.uTime,
    uStorm: sharedUniforms.uStorm,
    uGustBurst: sharedUniforms.uGustBurst,
    uWindScale: sharedUniforms.uWindScale,
    uWind: sharedUniforms.uWind,
    uCelDir: sharedUniforms.uCelDir,
    uSunDir: sharedUniforms.uSunDir,
    uFogWarm: sharedUniforms.uFogWarm,
    uFogCool: sharedUniforms.uFogCool,
    uFogMist: sharedUniforms.uFogMist,
    uFogNear: sharedUniforms.uFogNear,
    uFogFar: sharedUniforms.uFogFar,
  };

  const trunkMat = new THREE.ShaderMaterial({
    vertexShader: TRUNK_VERT,
    fragmentShader: TRUNK_FRAG,
    uniforms: {
      ...sharedTreeUniforms,
      uTrunkLit: { value: srgbVec(PALETTE.trunkLit) },
      uTrunkShade: { value: srgbVec(PALETTE.trunkShade) },
    },
  });

  const canopyMat = new THREE.ShaderMaterial({
    vertexShader: CANOPY_VERT,
    fragmentShader: CANOPY_FRAG,
    uniforms: {
      ...sharedTreeUniforms,
      uProcedural: sharedUniforms.uProcedural,
      uHighlight: { value: srgbVec(PALETTE.canopyHighlight) },
      uShadow: { value: srgbVec(PALETTE.canopyShadow) },
      uRimCol: { value: srgbVec(PALETTE.canopyRim) },
    },
  });

  const spanX = FOREST_HALF_X * 2;
  const spanZ = FOREST_MAX_Z - FOREST_MIN_Z;
  const chunkW = spanX / TREE_CHUNKS;
  const chunkD = spanZ / TREE_CHUNKS;

  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const treeCol = new THREE.Color();

  for (let cz = 0; cz < TREE_CHUNKS; cz++) {
    for (let cx = 0; cx < TREE_CHUNKS; cx++) {
      const rng = mulberry32(2026 + (cz * TREE_CHUNKS + cx) * 104729);
      const x0 = -FOREST_HALF_X + cx * chunkW;
      const z0 = FOREST_MIN_Z + cz * chunkD;

      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, TREES_PER_CHUNK);
      const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, TREES_PER_CHUNK);

      let placed = 0;
      let attempts = 0;
      while (placed < TREES_PER_CHUNK) {
        attempts++;
        const x = x0 + rng() * chunkW;
        const z = z0 + rng() * chunkD;

        // Keep the winding sunset river crystal-clear while packing both banks with blossoms
        const dRiver = Math.abs(x - riverCenter(z));
        const minBank = riverHalfWidth(z) + 4.8;
        if (dRiver < minBank) continue;

        const h = terrainHeight(x, z);
        if (h < 0.8 || h > 76.0) {
          if (attempts < 80000) continue;
        }

        // Rejection sample by grove density (relax slightly only if needed so all 20,480 place)
        const density = attempts > 50000 ? 1.0 : groveDensity(x, z);
        if (rng() > density) continue;

        // Riverside & dense-grove trees grow extra wide and lush
        const bankBonus = dRiver < minBank + 36 ? 1.15 : 1.0;
        const sc = (0.78 + rng() * 0.72) * bankBonus;
        const sy = sc * (0.86 + rng() * 0.28);

        // Subtle graceful lean toward the water along riverbanks
        const leanX = (rng() - 0.5) * 0.1;
        const leanZ = (rng() - 0.5) * 0.1;
        euler.set(leanX, rng() * Math.PI * 2, leanZ);
        quat.setFromEuler(euler);

        pos.set(x, h - 0.45, z);
        scale.set(sc, sy, sc);
        mat4.compose(pos, quat, scale);

        trunks.setMatrixAt(placed, mat4);
        canopies.setMatrixAt(placed, mat4);

        // Coherent painterly blossom hue across hillsides + delicate per-tree variation
        const regionT = groveTint(x, z);
        const idxFloat =
          Math.max(0, Math.min(0.999, regionT * 0.72 + rng() * 0.28)) *
          (SAKURA_SWATCHES.length - 1);
        const i0 = Math.floor(idxFloat);
        const i1 = Math.min(i0 + 1, SAKURA_SWATCHES.length - 1);
        treeCol.copy(SAKURA_SWATCHES[i0]).lerp(SAKURA_SWATCHES[i1], idxFloat - i0);

        // Slightly brighten sun-kissed snow-sakura trees right along the riverbanks
        if (dRiver < minBank + 22 && rng() < 0.55) {
          treeCol.lerp(SAKURA_SWATCHES[0], 0.5);
        }

        canopies.setColorAt(placed, treeCol);
        placed++;
      }

      trunks.instanceMatrix.needsUpdate = true;
      canopies.instanceMatrix.needsUpdate = true;
      if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;

      // Per-chunk bounding spheres enable GPU-saving frustum culling for off-camera chunks
      trunks.computeBoundingSphere();
      canopies.computeBoundingSphere();
      if (trunks.boundingSphere) trunks.boundingSphere.radius += 8;
      if (canopies.boundingSphere) canopies.boundingSphere.radius += 12;

      group.add(trunks, canopies);
    }
  }

  return group;
}
