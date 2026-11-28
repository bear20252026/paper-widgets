import * as THREE from "three";
import {
  mulberry32,
  riverCenter,
  riverHalfWidth,
  smoothstep,
  TERRAIN_HALF,
  TERRAIN_SEG,
  terrainHeight,
  WATER_LEVEL,
} from "./math";
import { PALETTE, sharedUniforms, srgbVec } from "./shared";
import {
  MOUNTAIN_FRAG,
  MOUNTAIN_VERT,
  RIBBON_FRAG,
  RIBBON_VERT,
  RIVER_FRAG,
  RIVER_VERT,
  SKY_FRAG,
  SKY_VERT,
  TERRAIN_FRAG,
  TERRAIN_VERT,
} from "./shaders";

/** Shared fog uniform entries mixed into every world shader. */
function fogUniforms() {
  return {
    uSunDir: sharedUniforms.uSunDir,
    uFogWarm: sharedUniforms.uFogWarm,
    uFogCool: sharedUniforms.uFogCool,
    uFogMist: sharedUniforms.uFogMist,
    uFogNear: sharedUniforms.uFogNear,
    uFogFar: sharedUniforms.uFogFar,
  };
}

/** Sets a THREE.Color to raw sRGB components (no gamma darkening) for direct anime shaders. */
function rawSrgb(hex: number): THREE.Color {
  const c = new THREE.Color();
  c.setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
  return c;
}

/**
 * Orange-to-purple anime twilight sky dome centered on the camera, featuring
 * setting sun, solar halo, cel-shaded twilight clouds, and twinkling zenith stars.
 */
export function createSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(3400, 56, 32);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uTime: sharedUniforms.uTime,
      uStorm: sharedUniforms.uStorm,
      uProcedural: sharedUniforms.uProcedural,
      uGlow: { value: srgbVec(PALETTE.skyGlow) },
      uPeach: { value: srgbVec(PALETTE.skyPeach) },
      uRose: { value: srgbVec(PALETTE.skyRose) },
      uPurple: { value: srgbVec(PALETTE.skyPurple) },
      uZenith: { value: srgbVec(PALETTE.skyZenith) },
      uSunDir: sharedUniforms.uSunDir,
      uSunCore: { value: srgbVec(PALETTE.sunCore) },
      uSunHalo: { value: srgbVec(PALETTE.sunHalo) },
      uCyberCyan: { value: srgbVec(PALETTE.cyberCyan) },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  mesh.name = "anime-sky";
  return mesh;
}

/**
 * Sculpted sakura valley terrain with smooth rolling hills, carved winding river channel,
 * fallen-petal carpets beneath groves, cel shading, and delicate procedural contours.
 */
export function createTerrain(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(TERRAIN_HALF * 2, TERRAIN_HALF * 2, TERRAIN_SEG, TERRAIN_SEG);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    vertexShader: TERRAIN_VERT,
    fragmentShader: TERRAIN_FRAG,
    uniforms: {
      ...fogUniforms(),
      uTime: sharedUniforms.uTime,
      uStorm: sharedUniforms.uStorm,
      uProcedural: sharedUniforms.uProcedural,
      uCelDir: sharedUniforms.uCelDir,
      uCyberCyan: { value: srgbVec(PALETTE.cyberCyan) },
      uCyberPink: { value: srgbVec(PALETTE.cyberPink) },
    },
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "valley-terrain";
  return mesh;
}

/**
 * Winding S-curve sunset river gliding down the center of the cherry blossom valley,
 * reflecting the orange-to-purple sky with cel-shaded golden sparkles and petal rafts.
 */
export function createRiver(): THREE.Mesh {
  const zMin = -1250;
  const zMax = 960;
  const segZ = 240;
  const segX = 10;

  const vertCount = (segZ + 1) * (segX + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices: number[] = [];

  let ptr = 0;
  let uptr = 0;
  for (let iz = 0; iz <= segZ; iz++) {
    const vz = iz / segZ;
    const z = zMin + vz * (zMax - zMin);
    const rc = riverCenter(z);
    const hw = riverHalfWidth(z) + 2.2;

    for (let ix = 0; ix <= segX; ix++) {
      const ux = ix / segX;
      const x = rc + (ux * 2 - 1) * hw;
      positions[ptr++] = x;
      positions[ptr++] = WATER_LEVEL;
      positions[ptr++] = z;

      uvs[uptr++] = ux;
      uvs[uptr++] = vz;
    }
  }

  const row = segX + 1;
  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iz * row + ix;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const mat = new THREE.ShaderMaterial({
    vertexShader: RIVER_VERT,
    fragmentShader: RIVER_FRAG,
    uniforms: {
      ...fogUniforms(),
      uTime: sharedUniforms.uTime,
      uStorm: sharedUniforms.uStorm,
      uProcedural: sharedUniforms.uProcedural,
      uGlow: { value: srgbVec(PALETTE.skyGlow) },
      uRose: { value: srgbVec(PALETTE.skyRose) },
      uPurple: { value: srgbVec(PALETTE.skyPurple) },
      uSunCore: { value: srgbVec(PALETTE.sunCore) },
      uCyberCyan: { value: srgbVec(PALETTE.cyberCyan) },
    },
    transparent: true,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  mesh.name = "valley-river";
  return mesh;
}

/**
 * Three layered rings of faceted blue-purple low-poly mountains framing the valley,
 * sculpted with a dramatic central sunset pass toward -Z so golden light pours down the river.
 */
export function createMountains(): THREE.Mesh {
  const rng = mulberry32(7717);
  const positions: number[] = [];
  const colors: number[] = [];
  const peakRatios: number[] = [];

  const cDeep = rawSrgb(PALETTE.mountainDeep);
  const cMid = rawSrgb(PALETTE.mountainMid);
  const cRidge = rawSrgb(PALETTE.mountainRidge);
  const cPeak = rawSrgb(PALETTE.mountainPeak);

  const colLower = new THREE.Color();
  const colMid = new THREE.Color();
  const colUpper = new THREE.Color();
  const colTop = new THREE.Color();

  const pushVert = (x: number, y: number, z: number, c: THREE.Color, ratio: number) => {
    positions.push(x, y, z);
    colors.push(c.r, c.g, c.b);
    peakRatios.push(ratio);
  };

  /** Builds a multi-tiered crystalline low-poly peak with crisp ridges and secondary shoulder. */
  const addPeak = (
    cx: number,
    cz: number,
    radius: number,
    height: number,
    layerBlend: number
  ) => {
    const baseY = terrainHeight(cx, cz) - 36;
    const seg = 8 + Math.floor(rng() * 3);
    const rot = rng() * Math.PI * 2;
    const stretchX = 0.8 + rng() * 0.45;
    const stretchZ = 0.8 + rng() * 0.45;

    // Deeper blue-indigo on close ranges, dreamier periwinkle-lavender on far ranges
    colLower.copy(cDeep).lerp(cMid, 0.22 + layerBlend * 0.38 + rng() * 0.14);
    colMid.copy(cMid).lerp(cRidge, 0.25 + layerBlend * 0.42 + rng() * 0.15);
    colUpper.copy(cRidge).lerp(cPeak, 0.16 + layerBlend * 0.22);
    colTop.copy(cRidge).lerp(cPeak, 0.58 + rng() * 0.2);

    const r0: [number, number, number][] = [];
    const r1: [number, number, number][] = [];
    const r2: [number, number, number][] = [];

    for (let k = 0; k < seg; k++) {
      const a = rot + (k / seg) * Math.PI * 2;
      // Alternating ridge spurs and gullies for crisp anime mountain silhouettes
      const spur = k % 2 === 0 ? 1.14 : 0.84;
      const jr = spur * (0.86 + rng() * 0.28);

      const dx = Math.cos(a) * radius * jr * stretchX;
      const dz = Math.sin(a) * radius * jr * stretchZ;
      r0.push([cx + dx, baseY, cz + dz]);

      const m1 = 0.58 + rng() * 0.12;
      const twist1 = a + (rng() - 0.5) * 0.18;
      r1.push([
        cx + Math.cos(twist1) * radius * jr * m1 * stretchX,
        baseY + height * (0.38 + rng() * 0.12),
        cz + Math.sin(twist1) * radius * jr * m1 * stretchZ,
      ]);

      const m2 = 0.26 + rng() * 0.1;
      const twist2 = twist1 + (rng() - 0.5) * 0.16;
      r2.push([
        cx + Math.cos(twist2) * radius * jr * m2 * stretchX,
        baseY + height * (0.72 + rng() * 0.11),
        cz + Math.sin(twist2) * radius * jr * m2 * stretchZ,
      ]);
    }

    const sx = cx + (rng() - 0.5) * radius * 0.16;
    const sz = cz + (rng() - 0.5) * radius * 0.16;
    const sy = baseY + height;

    for (let k = 0; k < seg; k++) {
      const k2 = (k + 1) % seg;
      const a0 = r0[k], b0 = r0[k2];
      const a1 = r1[k], b1 = r1[k2];
      const a2 = r2[k], b2 = r2[k2];

      // Tier 1: lower mountain skirt
      pushVert(a0[0], a0[1], a0[2], colLower, 0.0);
      pushVert(b0[0], b0[1], b0[2], colLower, 0.0);
      pushVert(b1[0], b1[1], b1[2], colMid, 0.4);

      pushVert(a0[0], a0[1], a0[2], colLower, 0.0);
      pushVert(b1[0], b1[1], b1[2], colMid, 0.4);
      pushVert(a1[0], a1[1], a1[2], colMid, 0.4);

      // Tier 2: steep sculpted cliff face
      pushVert(a1[0], a1[1], a1[2], colMid, 0.4);
      pushVert(b1[0], b1[1], b1[2], colMid, 0.4);
      pushVert(b2[0], b2[1], b2[2], colUpper, 0.75);

      pushVert(a1[0], a1[1], a1[2], colMid, 0.4);
      pushVert(b2[0], b2[1], b2[2], colUpper, 0.75);
      pushVert(a2[0], a2[1], a2[2], colUpper, 0.75);

      // Tier 3: sharp alpine summit
      pushVert(a2[0], a2[1], a2[2], colUpper, 0.75);
      pushVert(b2[0], b2[1], b2[2], colUpper, 0.75);
      pushVert(sx, sy, sz, colTop, 1.0);
    }
  };

  // Angular distance from the sunset valley pass (toward -Z, slightly -X)
  const sunAzimuth = Math.atan2(-0.964, -0.16);
  const angleDiff = (a: number, b: number) => {
    let d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  };

  // Range 1: Close indigo-purple valley-rim foothills (leaves open river pass toward sunset & viewer)
  for (let i = 0; i < 68; i++) {
    const a = (i / 68) * Math.PI * 2 + (rng() - 0.5) * 0.06;
    const passGap = angleDiff(a, sunAzimuth);
    if (passGap < 0.24) continue; // open canyon mouth toward the sunset
    // Keep foreground camera overlook (+Z) lower so view is never blocked
    const southDiff = angleDiff(a, Math.PI * 0.5);
    const hScale = smoothstep(0.18, 0.52, passGap) * (0.55 + 0.45 * smoothstep(0.0, 0.7, southDiff));
    const dist = 840 + rng() * 140;
    addPeak(
      Math.cos(a) * dist,
      Math.sin(a) * dist,
      165 + rng() * 95,
      (165 + rng() * 145) * hScale,
      0.0
    );
  }

  // Range 2: Sculpted blue-purple alpine range with twin peaks framing the glowing sunset pass
  for (let i = 0; i < 74; i++) {
    const a = (i / 74) * Math.PI * 2 + (rng() - 0.5) * 0.06;
    const passGap = angleDiff(a, sunAzimuth);
    const passProfile =
      passGap < 0.15
        ? 0.32
        : passGap < 0.48
          ? 0.96
          : 0.86;
    const dist = 1180 + rng() * 220;
    addPeak(
      Math.cos(a) * dist,
      Math.sin(a) * dist,
      235 + rng() * 125,
      (235 + rng() * 170) * passProfile,
      0.5
    );
  }

  // Range 3: Grand distant periwinkle-indigo horizon peaks leaving generous sky above
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 + (rng() - 0.5) * 0.08;
    const passGap = angleDiff(a, sunAzimuth);
    const passProfile = passGap < 0.17 ? 0.44 : 0.9;
    const dist = 1560 + rng() * 280;
    addPeak(
      Math.cos(a) * dist,
      Math.sin(a) * dist,
      320 + rng() * 160,
      (305 + rng() * 195) * passProfile,
      1.0
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("aPeakRatio", new THREE.Float32BufferAttribute(peakRatios, 1));
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    vertexShader: MOUNTAIN_VERT,
    fragmentShader: MOUNTAIN_FRAG,
    vertexColors: true,
    uniforms: {
      ...fogUniforms(),
      uTime: sharedUniforms.uTime,
      uProcedural: sharedUniforms.uProcedural,
      uCelDir: sharedUniforms.uCelDir,
      uSunHalo: { value: srgbVec(PALETTE.sunHalo) },
      uCyberCyan: { value: srgbVec(PALETTE.cyberCyan) },
      uCyberPink: { value: srgbVec(PALETTE.cyberPink) },
    },
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "lowpoly-mountains";
  return mesh;
}

/**
 * 34 luminous tapered 3D wind-streamline ribbons sweeping through the sakura valley
 * and spiraling upward over vortex pockets — blending serene anime wind trails with
 * a delicate procedural/cyberpunk flow-field aesthetic.
 */
export function createWindRibbons(): THREE.Mesh {
  const rng = mulberry32(9091);
  const positions: number[] = [];
  const uvs: number[] = [];
  const seeds: number[] = [];
  const indices: number[] = [];

  const segs = 44;
  let baseVert = 0;

  const appendRibbon = (pts: THREE.Vector3[], maxHalfWidth: number, seed: number) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const sampled = curve.getPoints(segs);
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const p = sampled[i];
      curve.getTangent(u, tangent);
      // Tilt ribbons gently so they read cleanly from both elevated top-down and panoramic angles
      side.crossVectors(tangent, up).normalize();
      side.y += 0.55;
      side.normalize();

      const taper = Math.sin(u * Math.PI);
      const hw = maxHalfWidth * (0.25 + 0.75 * taper);

      positions.push(p.x - side.x * hw, p.y - side.y * hw, p.z - side.z * hw);
      positions.push(p.x + side.x * hw, p.y + side.y * hw, p.z + side.z * hw);
      uvs.push(u, 0, u, 1);
      seeds.push(seed, seed);

      if (i < segs) {
        const a = baseVert + i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    baseVert += (segs + 1) * 2;
  };

  // 26 sweeping cross-valley & river-following wind streamlines
  for (let r = 0; r < 26; r++) {
    const seed = rng();
    const baseZ = -460 + (r / 25) * 860 + (rng() - 0.5) * 45;
    const altBase = 16 + rng() * 44;
    const ampZ = 45 + rng() * 55;
    const phase = rng() * Math.PI * 2;
    const pts: THREE.Vector3[] = [];
    const span = 380 + rng() * 220;
    const centerShift = riverCenter(baseZ) * 0.45 + (rng() - 0.5) * 140;

    for (let k = 0; k <= 7; k++) {
      const s = (k / 7) * 2 - 1;
      const x = centerShift + s * span;
      const z = baseZ + Math.sin(s * 2.8 + phase) * ampZ + s * 45;
      const y = Math.max(terrainHeight(x, z), 2) + altBase + Math.sin(s * 3.5 + phase) * 12;
      pts.push(new THREE.Vector3(x, y, z));
    }
    appendRibbon(pts, 1.35 + rng() * 1.15, seed);
  }

  // 8 ascending helical sakura-vortex streamlines lifting from the groves along the river
  for (let v = 0; v < 8; v++) {
    const seed = rng();
    const vz = -360 + v * 105 + (rng() - 0.5) * 30;
    const sideSign = v % 2 === 0 ? -1 : 1;
    const vx = riverCenter(vz) + sideSign * (55 + rng() * 115);
    const groundY = Math.max(terrainHeight(vx, vz), 2);
    const baseR = 26 + rng() * 22;
    const topR = baseR * 1.75;
    const turns = 2.1;
    const startAng = rng() * Math.PI * 2;
    const pts: THREE.Vector3[] = [];

    for (let k = 0; k <= 14; k++) {
      const t = k / 14;
      const ang = startAng + t * Math.PI * 2 * turns * sideSign;
      const rad = baseR + (topR - baseR) * t;
      const driftX = t * 38;
      pts.push(
        new THREE.Vector3(
          vx + Math.cos(ang) * rad + driftX,
          groundY + 10 + t * (62 + rng() * 20),
          vz + Math.sin(ang) * rad
        )
      );
    }
    appendRibbon(pts, 1.2 + rng() * 0.8, seed);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("aRibbonSeed", new THREE.Float32BufferAttribute(seeds, 1));
  geo.setIndex(indices);

  const mat = new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERT,
    fragmentShader: RIBBON_FRAG,
    uniforms: {
      uTime: sharedUniforms.uTime,
      uStorm: sharedUniforms.uStorm,
      uGustBurst: sharedUniforms.uGustBurst,
      uProcedural: sharedUniforms.uProcedural,
      uFogNear: sharedUniforms.uFogNear,
      uFogFar: sharedUniforms.uFogFar,
      uSunCore: { value: srgbVec(PALETTE.sunCore) },
      uCyberCyan: { value: srgbVec(PALETTE.cyberCyan) },
      uCyberPink: { value: srgbVec(PALETTE.cyberPink) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  mesh.name = "wind-ribbons";
  return mesh;
}
