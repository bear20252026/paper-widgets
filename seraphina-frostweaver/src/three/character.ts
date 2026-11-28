import * as THREE from 'three';
import {
  animeFaceTexture,
  hairStrandTexture,
  furColorTexture,
  furBumpTexture,
  bootGradient,
  bodiceGradient,
  apronGradient,
  backSkirtTexture,
  tapestryTexture,
  slashWaveTexture,
  sparkleTexture,
  glowTexture,
} from './textures';

/* ============================================================
   SERAPHINA — The Frostweaver (Sculpted High-Fidelity Edition)
   Faithfully proportioned & detailed from all 5 reference views:
   Front, Side, Back, Rear-3/4, and Staff-Swing Action.
   Total height: ~2.30m to crown top, ~2.78m to staff crystal tip.
   ============================================================ */

export type AnimationMode = 'idle' | 'updown' | 'swing' | 'dance';

export interface CharacterPoseControls {
  mode: AnimationMode;
  armLift: number;    // -1 .. +1 manual offset for arm & staff up/down
  staffSwing: number; // -1 .. +1 manual offset for arm & staff swing arc
  speed: number;      // 0.2 .. 2.0 animation speed multiplier
}

export interface CharacterApi {
  group: THREE.Group;
  tick: (t: number, dt: number) => void;
  setPointer: (nx: number, ny: number) => void;
  burst: () => void;
  triggerSwingSlash: () => void;
  setPoseControls: (partial: Partial<CharacterPoseControls>) => void;
  getPoseControls: () => CharacterPoseControls;
}

const std = (
  color: string,
  roughness = 0.55,
  metalness = 0.05,
  extra: THREE.MeshStandardMaterialParameters = {},
) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Flat shaped ribbon strip along a 3D curve (with custom width function) */
function ribbonGeometry(
  points: THREE.Vector3[],
  widthStart: number,
  widthEnd: number,
  divisions = 36,
  twist = 0,
  widthCurve?: (t: number) => number,
) {
  const curve = new THREE.CatmullRomCurve3(points);
  const pts = curve.getPoints(divisions);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const up = V3(0, 0, 1);

  for (let i = 0; i <= divisions; i++) {
    const t = i / divisions;
    const p = pts[i];
    const tan = curve.getTangent(t);
    let side = new THREE.Vector3().crossVectors(tan, up);
    if (side.lengthSq() < 1e-5) side.set(1, 0, 0);
    side.normalize();
    if (twist !== 0) side.applyAxisAngle(tan, twist * t);
    const w = (widthCurve ? widthCurve(t) : THREE.MathUtils.lerp(widthStart, widthEnd, t)) * 0.5;
    positions.push(p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
    positions.push(p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
    uvs.push(0, t, 1, t);
  }
  for (let i = 0; i < divisions; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Plush organically sculpted fur tube (displaced radially so it reads as soft tufted fur, never plastic pipe) */
function fluffyFurTube(
  points: THREE.Vector3[],
  baseRadius: number,
  mat: THREE.Material,
  tubularSegs = 36,
  radialSegs = 12,
  closed = false,
  taperEnds = false,
) {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  const geo = new THREE.TubeGeometry(curve, tubularSegs, baseRadius, radialSegs, closed);
  const pos = geo.attributes.position;
  const ringStride = radialSegs + 1;

  for (let i = 0; i < pos.count; i++) {
    const ringIdx = Math.floor(i / ringStride);
    const radIdx = i % ringStride;
    const t = Math.min(1, ringIdx / tubularSegs);
    const theta = (radIdx / radialSegs) * Math.PI * 2;
    const center = curve.getPointAt(t);

    const dx = pos.getX(i) - center.x;
    const dy = pos.getY(i) - center.y;
    const dz = pos.getZ(i) - center.z;

    // Multi-frequency organic fur puff lobes
    const puff =
      1.0 +
      Math.sin(t * Math.PI * 12 + theta * 2) * 0.14 +
      Math.cos(t * Math.PI * 22 - theta * 3) * 0.10;
    const endScale = taperEnds ? 0.25 + 0.75 * Math.pow(Math.sin(t * Math.PI), 0.45) : 1.0;
    const s = puff * endScale;

    pos.setXYZ(i, center.x + dx * s, center.y + dy * s, center.z + dz * s);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/** Sculpted tapered 3D anime hair lock along a 3D curve (flat silky ribbon-volume tapering to a crisp point) */
function sculptedHairLock(
  points: THREE.Vector3[],
  widthRadius: number,
  flatness: number,
  mat: THREE.Material,
  tubularSegs = 24,
) {
  const curve = new THREE.CatmullRomCurve3(points);
  const radialSegs = 10;
  const geo = new THREE.TubeGeometry(curve, tubularSegs, widthRadius, radialSegs, false);
  const pos = geo.attributes.position;
  const stride = radialSegs + 1;

  for (let i = 0; i < pos.count; i++) {
    const ringIdx = Math.floor(i / stride);
    const t = Math.min(1, ringIdx / tubularSegs);
    const center = curve.getPointAt(t);
    // Swell slightly in middle, taper gracefully to a razor-soft anime hair tip
    const profile = t < 0.55 ? 0.85 + Math.sin((t / 0.55) * Math.PI * 0.5) * 0.32 : Math.max(0.04, Math.pow((1 - t) / 0.45, 0.85) * 1.15);
    const dx = (pos.getX(i) - center.x) * profile * 1.25;
    const dy = (pos.getY(i) - center.y) * profile;
    const dz = (pos.getZ(i) - center.z) * profile * flatness;
    pos.setXYZ(i, center.x + dx, center.y + dy, center.z + dz);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

/** Multi-notched sculpted crane-wing feather blade with white -> ice-blue -> lavender-indigo vertex gradient */
function sculptedFeatherGeometry(len: number, wid: number, arch = -0.18, tipHex = '#576ce0') {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  // Outer curved vane with subtle natural feather notch
  s.quadraticCurveTo(wid * 0.92, len * 0.22, wid * 0.82, len * 0.44);
  s.lineTo(wid * 0.62, len * 0.49); // delicate plumage notch
  s.quadraticCurveTo(wid * 0.72, len * 0.66, wid * 0.34, len * 0.86);
  s.quadraticCurveTo(wid * 0.14, len * 0.95, 0, len);
  // Inner curved vane
  s.quadraticCurveTo(-wid * 0.16, len * 0.92, -wid * 0.42, len * 0.72);
  s.quadraticCurveTo(-wid * 0.78, len * 0.36, 0, 0);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 16,
    steps: 8,
  });
  geo.translate(0, 0, -0.006);

  const pos = geo.attributes.position;
  const cBase = new THREE.Color('#ffffff');
  const cMid = new THREE.Color('#cfe4ff');
  const cTip = new THREE.Color(tipHex);
  const tmp = new THREE.Color();
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp(y / len, 0, 1);

    // Graceful S-sweep arch along length of feather
    const bendZ = Math.pow(t, 1.55) * arch;
    const bendX = Math.pow(t, 1.8) * (arch * -0.25);
    pos.setXYZ(i, x + bendX, y, z + bendZ);

    if (t < 0.52) {
      tmp.copy(cBase).lerp(cMid, t / 0.52);
    } else {
      tmp.copy(cMid).lerp(cTip, (t - 0.52) / 0.48);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * High-resolution sculpted 3D anime head geometry designed to pair with animeFaceTexture().
 * Rotated -PI/2 around Y so front center (+Z) maps cleanly to UV u = 0.5!
 * Sculpted front AND side-view anime anatomy: forehead, eye-socket contour, petite nose,
 * soft lips, refined V-chin, cheekbones, and smooth occiput.
 */
function buildSculptedAnimeHead() {
  const R = 0.136;
  const geo = new THREE.SphereGeometry(R, 64, 48);
  geo.rotateY(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const nx = x / R;
    const ny = y / R;
    const nz = z / R;

    // 1. Overall graceful anime skull proportion (slightly oval, compact lower face)
    y *= ny >= 0 ? 1.04 : 0.94;
    x *= 0.94;
    z *= nz >= 0 ? 0.96 : 1.02;

    // 2. Heart-shaped jawline & refined V-chin taper (Front & Side views!)
    if (ny < 0.08) {
      const t = Math.min(1, (0.08 - ny) / 1.08); // 0 at eye line -> 1 at chin tip
      const jawTaper = 1 - Math.pow(t, 1.32) * 0.54;
      x *= jawTaper;
      if (nz > 0) {
        // Gentle cheek-to-chin curve in side profile
        z *= 1 - Math.pow(t, 1.65) * 0.16;
        // Subtle defined chin tip protruding gracefully forward
        const chinDist = Math.hypot(nx / 0.28, (ny + 0.80) / 0.22);
        if (chinDist < 1) {
          z += Math.cos(chinDist * Math.PI * 0.5) * 0.009;
        }
      } else {
        // Taper lower back of skull smoothly into neck
        z *= 1 - Math.pow(t, 1.15) * 0.44;
      }
    }

    // 3. Soft flattened anime eye-socket planes (so UV-painted eyes read cleanly & serenely)
    if (nz > 0.35) {
      for (const side of [-1, 1]) {
        const dEye = Math.hypot((nx - side * 0.36) / 0.26, (ny + 0.02) / 0.18);
        if (dEye < 1) {
          z -= Math.cos(dEye * Math.PI * 0.5) * 0.0055;
        }
      }

      // 4. Sculpted delicate 3D nose bridge + petite anime nose tip (ny = -0.22)
      const dNose = Math.hypot(nx / 0.12, (ny + 0.22) / 0.14);
      if (dNose < 1) {
        z += Math.pow(Math.cos(dNose * Math.PI * 0.5), 1.4) * 0.0145;
      }
      const dBridge = Math.hypot(nx / 0.09, (ny + 0.07) / 0.18);
      if (dBridge < 1) {
        z += Math.cos(dBridge * Math.PI * 0.5) * 0.0065;
      }

      // 5. Subtle 3D sculpted upper & lower lips (gentle wide contour at ny = -0.46)
      const dUpperLip = Math.hypot(nx / 0.24, (ny + 0.43) / 0.065);
      if (dUpperLip < 1) {
        z += Math.cos(dUpperLip * Math.PI * 0.5) * 0.0042;
      }
      const dLowerLip = Math.hypot(nx / 0.21, (ny + 0.50) / 0.07);
      if (dLowerLip < 1) {
        z += Math.cos(dLowerLip * Math.PI * 0.5) * 0.0045;
      }
      // Subtle under-lip chin hollow
      const dHollow = Math.hypot(nx / 0.18, (ny + 0.60) / 0.08);
      if (dHollow < 1) {
        z -= Math.cos(dHollow * Math.PI * 0.5) * 0.004;
      }
    }

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Faceted 6-petal crystal ice flower */
function buildIceFlower(radius: number, petalMat: THREE.Material, coreMat: THREE.Material) {
  const flower = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.OctahedronGeometry(radius * 0.56, 0), petalMat);
    petal.scale.set(0.54, 1.18, 0.34);
    petal.position.set(Math.cos(a) * radius * 0.62, Math.sin(a) * radius * 0.62, 0);
    petal.rotation.z = a - Math.PI / 2;
    flower.add(petal);
  }
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(radius * 0.32, 0), coreMat);
  core.position.z = radius * 0.12;
  flower.add(core);
  return flower;
}

export function buildSeraphina(): CharacterApi {
  const g = new THREE.Group();

  /* ---------- shared high-craft materials ---------- */
  const skin = std('#f8d7ca', 0.50, 0.02, { emissive: '#3a1c1a', emissiveIntensity: 0.06 });
  const faceMat = new THREE.MeshStandardMaterial({
    map: animeFaceTexture(),
    roughness: 0.48,
    metalness: 0.01,
    emissive: '#2c1514',
    emissiveIntensity: 0.04,
  });

  const furMat = new THREE.MeshStandardMaterial({
    map: furColorTexture(),
    bumpMap: furBumpTexture(),
    bumpScale: 0.014,
    roughness: 0.94,
    metalness: 0.0,
    emissive: '#8aa4ca',
    emissiveIntensity: 0.10,
  });

  const hairTex = hairStrandTexture();
  const hairMain = new THREE.MeshStandardMaterial({
    map: hairTex,
    color: '#e8fffd',
    roughness: 0.40,
    metalness: 0.08,
    emissive: '#083a3c',
    emissiveIntensity: 0.18,
    side: THREE.DoubleSide,
  });
  const hairLight = new THREE.MeshStandardMaterial({
    map: hairTex,
    color: '#ffffff',
    roughness: 0.36,
    metalness: 0.10,
    emissive: '#0e4a4c',
    emissiveIntensity: 0.18,
    side: THREE.DoubleSide,
  });
  const hairDark = new THREE.MeshStandardMaterial({
    map: hairTex,
    color: '#9ee4e2',
    roughness: 0.45,
    metalness: 0.06,
    emissive: '#05282c',
    emissiveIntensity: 0.16,
    side: THREE.DoubleSide,
  });

  const gloveMat = std('#c0edf7', 0.38, 0.12, { emissive: '#224a66', emissiveIntensity: 0.24 });
  const royalBlue = std('#1c46a8', 0.34, 0.28, { emissive: '#0d205a', emissiveIntensity: 0.36, side: THREE.DoubleSide });
  const sapphire = std('#182e70', 0.28, 0.65, { emissive: '#0a163c', emissiveIntensity: 0.42 });
  const sapphireDeep = std('#112054', 0.26, 0.72, { emissive: '#081030', emissiveIntensity: 0.36 });
  const chromeSilver = std('#d0e4f8', 0.18, 0.92, { emissive: '#26426e', emissiveIntensity: 0.28 });
  const cyanGem = std('#4bf4ff', 0.12, 0.12, { emissive: '#1ccceb', emissiveIntensity: 1.65 });
  const iceFlowerMat = std('#3b8ef0', 0.20, 0.36, { emissive: '#1a52b0', emissiveIntensity: 0.85 });

  /* ---------- animation & pose state ---------- */
  const swayRibbons: { mesh: THREE.Object3D; phase: number; amp: number; speed: number; baseZ?: number; baseX?: number }[] = [];
  const flutterFeathers: { mesh: THREE.Object3D; phase: number; baseZ: number; baseY: number }[] = [];
  const blinkLids: THREE.Mesh[] = [];
  const poseControls: CharacterPoseControls = {
    mode: 'idle',
    armLift: 0,
    staffSwing: 0,
    speed: 1.0,
  };
  const registry = {
    pointer: new THREE.Vector2(0, 0),
    burst: 0,
    slashTimer: 0,
  };

  /* ============================================================
     1. SHAPELY CONTRAPPOSTO LEGS, BARE UPPER THIGHS & HEEL BOOTS
        (Balanced 7.5-head stylized hero proportion: hip at y=1.32)
     ============================================================ */
  const legMat = new THREE.MeshStandardMaterial({
    map: bootGradient(),
    roughness: 0.34,
    metalness: 0.12,
    emissive: '#12224c',
    emissiveIntensity: 0.18,
  });

  // Anatomically contoured leg lathe (y = 0.13 ankle -> 0.48 calf -> 0.76 knee -> 1.06 thigh -> 1.38 hip)
  const legProfile = [
    [0.036, 0.13],
    [0.042, 0.22],
    [0.058, 0.40],
    [0.064, 0.54],
    [0.056, 0.68],
    [0.054, 0.78], // knee
    [0.064, 0.92],
    [0.079, 1.08], // mid thigh
    [0.092, 1.24],
    [0.098, 1.38], // upper hip
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const legGeo = new THREE.LatheGeometry(legProfile, 32);

  // Feminine contrapposto stance matching Reference Image 1:
  // Right supporting leg (x = -0.076) slightly behind; Left leg (x = +0.066) gently stepped forward & angled inward!
  const legConfigs = [
    { side: -1, x: -0.078, z: -0.025, rotZ: 0.025, rotX: 0.025, rotY: -0.18 },
    { side: 1, x: 0.066, z: 0.048, rotZ: -0.045, rotX: -0.048, rotY: 0.14 },
  ];

  for (const cfg of legConfigs) {
    const legGroup = new THREE.Group();
    legGroup.position.set(cfg.x, 0, cfg.z);
    legGroup.rotation.set(cfg.rotX, cfg.rotY, cfg.rotZ);
    g.add(legGroup);

    const legMesh = new THREE.Mesh(legGeo, legMat);
    legMesh.scale.set(0.96, 1, 1.05);
    legGroup.add(legMesh);

    // 3D sculpted white snow-lotus floral lace cuff at mid-thigh (y = 1.06)
    const cuffY = 1.06;
    const cuffR = 0.079;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.OctahedronGeometry(0.020, 1), furMat);
      petal.scale.set(0.85, 1.45, 0.34);
      petal.position.set(Math.cos(a) * cuffR, cuffY, Math.sin(a) * cuffR * 1.05);
      petal.rotation.y = -a + Math.PI / 2;
      legGroup.add(petal);
    }
    const thighFlower = buildIceFlower(0.036, furMat, furMat);
    thighFlower.position.set(0, cuffY - 0.025, cuffR * 1.05);
    legGroup.add(thighFlower);

    // Sculpted sleek royal-sapphire high-heel ankle boot resting cleanly at y = 0.00!
    const shoe = new THREE.Group();
    shoe.position.set(0, 0.13, 0);
    legGroup.add(shoe);

    // Sleek arched foot bridge & pointed toe box
    const vamp = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.21, 20), sapphire);
    vamp.rotation.x = Math.PI / 2 + 0.30;
    vamp.scale.set(0.88, 1, 0.66);
    vamp.position.set(0, -0.078, 0.088);
    shoe.add(vamp);

    // Sole pad resting flat at y = 0
    const sole = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.016, 14), sapphireDeep);
    sole.scale.set(0.9, 1, 1.6);
    sole.position.set(0, -0.122, 0.105);
    shoe.add(sole);

    // Sculpted heel counter
    const heelCup = new THREE.Mesh(new THREE.SphereGeometry(0.044, 16, 12), sapphire);
    heelCup.scale.set(0.92, 1.25, 1.04);
    heelCup.position.set(0, -0.032, -0.022);
    shoe.add(heelCup);

    // Crisp stiletto heel resting cleanly on y = 0
    const stiletto = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.0085, 0.125, 12), sapphireDeep);
    stiletto.position.set(0, -0.068, -0.046);
    stiletto.rotation.x = 0.08;
    shoe.add(stiletto);

    // Toe metallic silver frost buckle
    const toeGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.014, 0), chromeSilver);
    toeGem.scale.set(1.4, 0.55, 0.75);
    toeGem.position.set(0, -0.092, 0.148);
    shoe.add(toeGem);
  }

  // Smooth anatomical pelvis bridging the thighs cleanly inside the skirt
  const hipBridge = new THREE.Mesh(new THREE.SphereGeometry(0.132, 24, 18), skin);
  hipBridge.scale.set(1.06, 0.78, 0.68);
  hipBridge.position.set(0, 1.34, -0.005);
  g.add(hipBridge);

  /* ============================================================
     2. UPPER BODY GROUP (World y_pivot = 1.44; breathes & twists!)
     ============================================================ */
  const upperBody = new THREE.Group();
  upperBody.position.set(0, 1.44, 0);
  g.add(upperBody);

  /* ---------- Sculpted Sweetheart Corset Bodice (local y = -0.04 .. +0.36) ---------- */
  const bodiceMat = new THREE.MeshStandardMaterial({
    map: bodiceGradient(),
    roughness: 0.36,
    metalness: 0.06,
    emissive: '#3a5e82',
    emissiveIntensity: 0.12,
  });

  const corsetProfile = [
    [0.134, -0.04], // upper hip
    [0.118, 0.03],
    [0.102, 0.10],  // cinched slender waist (world y = 1.54)
    [0.114, 0.18],
    [0.134, 0.25],
    [0.140, 0.31],  // bust level (world y = 1.75)
    [0.116, 0.365],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const corsetMesh = new THREE.Mesh(new THREE.LatheGeometry(corsetProfile, 36), bodiceMat);
  corsetMesh.scale.set(1.06, 1, 0.78);
  upperBody.add(corsetMesh);

  // Smoothly sculpted feminine bust cups (Front & Side views!)
  const bustMat = std('#f8fcff', 0.35, 0.05, { emissive: '#587898', emissiveIntensity: 0.1 });
  for (const side of [-1, 1] as const) {
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.078, 28, 22), bustMat);
    cup.scale.set(0.95, 0.90, 1.12);
    cup.position.set(side * 0.060, 0.305, 0.064);
    upperBody.add(cup);
  }

  // Seamless Bare Porcelain Upper Chest, Collarbones, Shoulders & V-Back (local y = 0.33 .. 0.49)
  // Carefully profiled wide shoulder slope so arms blend smoothly with NO separate shoulder balls!
  const upperChestProfile = [
    [0.112, 0.33],
    [0.136, 0.375],
    [0.158, 0.415], // graceful rounded bare shoulder slope
    [0.146, 0.442],
    [0.095, 0.468],
    [0.048, 0.495], // base of neck
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const upperChestSkin = new THREE.Mesh(new THREE.LatheGeometry(upperChestProfile, 36), skin);
  upperChestSkin.scale.set(1.18, 1, 0.66);
  upperBody.add(upperChestSkin);

  // Dark Sapphire & Silver Gothic Halter Yoke + Lace Straps cleanly over porcelain upper chest (Front Image 1!)
  const halterPts = [
    V3(0, 0.340, 0.132),
    V3(0, 0.392, 0.128),
    V3(0, 0.440, 0.116),
    V3(0, 0.488, 0.076),
  ];
  const halterYoke = new THREE.Mesh(ribbonGeometry(halterPts, 0.114, 0.066, 18), sapphire);
  upperBody.add(halterYoke);
  const halterSilverRim = new THREE.Mesh(ribbonGeometry(halterPts, 0.128, 0.078, 18), chromeSilver);
  halterSilverRim.position.z = -0.002;
  upperBody.add(halterSilverRim);

  // Delicate curved gothic halter lace arches hugging top of bust cups
  for (const side of [-1, 1] as const) {
    const laceArchPts = [
      V3(0, 0.395, 0.122),
      V3(side * 0.062, 0.382, 0.124),
      V3(side * 0.112, 0.352, 0.095),
    ];
    upperBody.add(
      new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(laceArchPts), 16, 0.0065, 8, false), sapphire),
    );
  }

  // Vertical gothic sternum diamond pendant between the bust
  const sternumFrame = new THREE.Mesh(new THREE.OctahedronGeometry(0.048, 0), chromeSilver);
  sternumFrame.scale.set(0.74, 1.85, 0.24);
  sternumFrame.position.set(0, 0.305, 0.126);
  upperBody.add(sternumFrame);

  const sternumDiamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0), sapphire);
  sternumDiamond.scale.set(0.68, 1.78, 0.32);
  sternumDiamond.position.set(0, 0.305, 0.130);
  upperBody.add(sternumDiamond);

  const sternumGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.019, 0), cyanGem);
  sternumGem.scale.set(0.75, 1.38, 0.48);
  sternumGem.position.set(0, 0.312, 0.142);
  upperBody.add(sternumGem);

  const sternumLowerDrop = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), sapphire);
  sternumLowerDrop.scale.set(0.54, 1.50, 0.30);
  sternumLowerDrop.position.set(0, 0.205, 0.110);
  upperBody.add(sternumLowerDrop);

  // Clean graceful V-cut back bodice edge & small center jewel (Back Image 3 — zero stray bars!)
  const backVEdgePts = [
    V3(-0.118, 0.345, -0.078),
    V3(-0.062, 0.315, -0.095),
    V3(0, 0.302, -0.098),
    V3(0.062, 0.315, -0.095),
    V3(0.118, 0.345, -0.078),
  ];
  const backVTrim = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(backVEdgePts), 24, 0.0085, 8, false),
    sapphire,
  );
  upperBody.add(backVTrim);

  // Plush Sculpted White Fur Flank Rolls hugging both waist sides into the hips (Front & Side views!)
  for (const side of [-1, 1] as const) {
    const flankFurPts = [
      V3(side * 0.102, 0.195, -0.028),
      V3(side * 0.118, 0.145, 0.036),
      V3(side * 0.116, 0.075, 0.066),
      V3(side * 0.138, 0.022, 0.066),
      V3(side * 0.165, 0.010, 0.014),
      V3(side * 0.144, 0.025, -0.056),
    ];
    upperBody.add(fluffyFurTube(flankFurPts, 0.026, furMat, 30, 10, false, true));
  }

  /* ============================================================
     3. WAIST BELT, FRONT APRON, ROUNDED BACK SKIRT, PLUME TAIL,
        BILLOWING 3-TIER FEATHER WINGS & FLARING FLOOR STREAMERS
     ============================================================ */
  const skirtGroup = new THREE.Group();
  skirtGroup.position.set(0, 0.02, 0); // world y = 1.46
  upperBody.add(skirtGroup);

  // Ornate dark-sapphire & silver waist belt
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.120, 0.130, 0.062, 32), sapphireDeep);
  belt.scale.set(1.10, 1, 0.80);
  belt.position.y = 0.018;
  skirtGroup.add(belt);

  for (const dy of [0.048, -0.012]) {
    const beltRim = new THREE.Mesh(new THREE.TorusGeometry(0.126, 0.0065, 8, 36), chromeSilver);
    beltRim.rotation.x = Math.PI / 2;
    beltRim.scale.set(1.10, 0.80, 1);
    beltRim.position.y = dy;
    skirtGroup.add(beltRim);
  }

  // Front-Right 6-Petal Blue Ice Flower Buckle + Hanging Crystal Pendant (Front Image 1!)
  const frontBeltFlower = buildIceFlower(0.066, iceFlowerMat, cyanGem);
  frontBeltFlower.position.set(-0.095, 0.016, 0.098);
  frontBeltFlower.rotation.set(0.12, -0.38, 0.1);
  skirtGroup.add(frontBeltFlower);

  const beltPendant = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 0), iceFlowerMat);
  beltPendant.scale.set(0.46, 2.25, 0.34);
  beltPendant.position.set(-0.075, -0.115, 0.118);
  beltPendant.rotation.z = 0.14;
  skirtGroup.add(beltPendant);

  // Back-Center 6-Petal Blue Ice Flower Clasp (Back Image 3!)
  const backBeltFlower = buildIceFlower(0.054, iceFlowerMat, cyanGem);
  backBeltFlower.position.set(0, 0.022, -0.106);
  backBeltFlower.rotation.x = -0.14;
  skirtGroup.add(backBeltFlower);

  /* ---------- Front Shield Apron with Plush Tufted White Fur Border ---------- */
  const apronPts = [
    V3(0, 0.0, 0.106),
    V3(0, -0.115, 0.132),
    V3(0, -0.235, 0.134),
    V3(0, -0.335, 0.122),
  ];
  const apronMesh = new THREE.Mesh(
    ribbonGeometry(apronPts, 0.21, 0.018, 24),
    new THREE.MeshStandardMaterial({
      map: apronGradient(),
      roughness: 0.38,
      metalness: 0.14,
      side: THREE.DoubleSide,
      emissive: '#10346e',
      emissiveIntensity: 0.28,
    }),
  );
  skirtGroup.add(apronMesh);

  for (const side of [-1, 1] as const) {
    const borderPts = [
      V3(side * 0.104, 0.0, 0.106),
      V3(side * 0.088, -0.12, 0.134),
      V3(side * 0.052, -0.24, 0.136),
      V3(0, -0.345, 0.124),
    ];
    skirtGroup.add(fluffyFurTube(borderPts, 0.017, furMat, 22, 10, false, false));
  }

  /* ---------- Back Center Rounded U-Shaped Royal-Blue Skirt (Images 3, 4, 5) ---------- */
  const backSkirtMat = new THREE.MeshStandardMaterial({
    map: backSkirtTexture(),
    roughness: 0.42,
    metalness: 0.12,
    side: THREE.DoubleSide,
    emissive: '#0e2460',
    emissiveIntensity: 0.32,
  });

  const backSkirtGeo = new THREE.CylinderGeometry(
    0.142,
    0.31,
    0.72,
    38,
    18,
    true,
    Math.PI * 0.56,
    Math.PI * 0.88,
  );
  const bsPos = backSkirtGeo.attributes.position;
  for (let i = 0; i < bsPos.count; i++) {
    const x = bsPos.getX(i);
    let y = bsPos.getY(i); // +0.36 at top -> -0.36 at bottom
    const z = bsPos.getZ(i);
    const vNorm = (0.36 - y) / 0.72;
    const angleFromBack = Math.atan2(x, -z);
    const uNorm = Math.min(1, Math.abs(angleFromBack) / (Math.PI * 0.44));
    const hemLift = Math.pow(uNorm, 1.75) * 0.28 * vNorm;
    y += hemLift;
    const flareZ = -Math.pow(vNorm, 1.25) * 0.095 * (1 - uNorm * 0.45);
    bsPos.setXYZ(i, x * (1 + vNorm * 0.10), y - 0.36, z + flareZ);
  }
  backSkirtGeo.computeVertexNormals();
  const backSkirtMesh = new THREE.Mesh(backSkirtGeo, backSkirtMat);
  backSkirtMesh.position.y = 0.028; // tucks seamlessly underneath the waist belt with zero gap!
  skirtGroup.add(backSkirtMesh);

  // Plush tufted white fur border following the U-shaped hem of the back skirt
  const backHemPts: THREE.Vector3[] = [];
  const hemSteps = 30;
  for (let i = 0; i <= hemSteps; i++) {
    const s = (i / hemSteps) * 2 - 1;
    const angle = s * Math.PI * 0.43;
    const uNorm = Math.abs(s);
    const r = 0.31 * (1 + 0.10 * (1 - uNorm * 0.2));
    const x = Math.sin(angle) * r;
    const z = -Math.cos(angle) * r - 0.095 * (1 - uNorm * 0.45);
    const y = -0.72 + Math.pow(uNorm, 1.75) * 0.28 + 0.028;
    backHemPts.push(V3(x, y, z));
  }
  skirtGroup.add(fluffyFurTube(backHemPts, 0.024, furMat, 44, 12, false, false));

  /* ---------- Back Center Fluffy White-to-Lavender Plume Tail (Images 3, 4, 5) ---------- */
  const backPlumeGroup = new THREE.Group();
  backPlumeGroup.position.set(0, -0.02, -0.155);
  skirtGroup.add(backPlumeGroup);

  // Upper 5-petal white lotus fur cap
  for (let i = 0; i < 5; i++) {
    const a = ((i - 2) / 2.2) * 0.92;
    const capPetal = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), furMat);
    capPetal.scale.set(0.76, 1.48, 0.58);
    capPetal.position.set(Math.sin(a) * 0.056, -0.036, -Math.cos(a) * 0.032 - 0.02);
    capPetal.rotation.z = -a * 0.62;
    capPetal.rotation.x = -0.28;
    backPlumeGroup.add(capPetal);
  }

  // S-curved fluffy white-to-lavender tail plume body sitting proudly outside the blue back skirt
  const plumeCurvePts = [
    V3(0, -0.04, -0.025),
    V3(-0.018, -0.16, -0.115),
    V3(0.015, -0.29, -0.150),
    V3(-0.015, -0.41, -0.125),
    V3(-0.032, -0.52, -0.088),
  ];
  const plumeCurve = new THREE.CatmullRomCurve3(plumeCurvePts);
  const plumeFeatherMat = std('#ffffff', 0.58, 0.02, {
    vertexColors: true,
    emissive: '#344278',
    emissiveIntensity: 0.26,
    side: THREE.DoubleSide,
  });

  backPlumeGroup.add(fluffyFurTube(plumeCurvePts, 0.058, furMat, 32, 12, false, true));

  // Layered feathered tail tips fanning out in soft periwinkle-lavender
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const pt = plumeCurve.getPoint(0.18 + t * 0.68);
    const len = 0.22 + (1 - Math.abs(t - 0.4)) * 0.14;
    const wid = 0.058 + (1 - t) * 0.024;
    const tipColor = i < 3 ? '#dce6ff' : '#7b8ef0';
    const tuft = new THREE.Mesh(sculptedFeatherGeometry(len, wid, -0.06, tipColor), plumeFeatherMat);
    tuft.position.copy(pt).add(V3((i % 2 === 0 ? 1 : -1) * 0.018, 0, -0.03));
    tuft.rotation.set(Math.PI + 0.26, 0, (i % 2 === 0 ? 1 : -1) * 0.24);
    backPlumeGroup.add(tuft);
  }
  swayRibbons.push({ mesh: backPlumeGroup, phase: 0.4, amp: 0.08, speed: 1.35 });

  /* ---------- Dramatic 3-Tier Billowing Feather-Wing Peplums (Images 1-5) ---------- */
  const featherMat = std('#ffffff', 0.56, 0.04, {
    vertexColors: true,
    emissive: '#223268',
    emissiveIntensity: 0.28,
    side: THREE.DoubleSide,
  });

  for (const side of [-1, 1] as const) {
    const hipWing = new THREE.Group();
    hipWing.position.set(side * 0.140, -0.005, -0.015);
    skirtGroup.add(hipWing);

    // 7 lush overlapping sculpted crane-wing feathers fanning gently OUTWARD and sweeping dramatically BACKWARD (-Z)!
    // NOTE: Positive rotX tilts the downward (-Y) feather blade BACKWARD toward -Z (matching Side Image 2!)
    const flourish = side === 1 ? 1.14 : 0.95;
    const featherSpecs = [
      // Tier 1: Soft snow-white front-side hip plumage draping down alongside upper thigh (Front Image 1!)
      { len: 0.40 * flourish, wid: 0.092, arch: 0.08, rotZ: -side * 0.14, rotX: 0.12, rotY: side * 0.16, tip: '#9eb8f6', y: 0.01, z: 0.04 },
      { len: 0.52 * flourish, wid: 0.104, arch: 0.12, rotZ: -side * 0.24, rotX: 0.28, rotY: side * 0.26, tip: '#829cf0', y: -0.005, z: 0.01 },
      // Tier 2: Layered sweeping mid-wing plumage billowing outward & back
      { len: 0.66 * flourish, wid: 0.114, arch: 0.16, rotZ: -side * 0.34, rotX: 0.46, rotY: side * 0.34, tip: '#6a82ea', y: -0.02, z: -0.025 },
      { len: 0.78 * flourish, wid: 0.120, arch: 0.20, rotZ: -side * 0.44, rotX: 0.62, rotY: side * 0.40, tip: '#5b72e4', y: -0.035, z: -0.05 },
      // Tier 3: Dramatic long white-to-periwinkle crane wing tips sweeping gracefully BACKWARD (Side Image 2 & Front Image 1!)
      { len: 0.90 * flourish, wid: 0.124, arch: 0.24, rotZ: -side * 0.48, rotX: 0.76, rotY: side * 0.44, tip: '#4e64dc', y: -0.05, z: -0.075 },
      { len: 0.82 * flourish, wid: 0.112, arch: 0.20, rotZ: -side * 0.34, rotX: 0.68, rotY: side * 0.54, tip: '#465cd4', y: -0.065, z: -0.095 },
      { len: 0.68 * flourish, wid: 0.098, arch: 0.15, rotZ: -side * 0.22, rotX: 0.52, rotY: side * 0.66, tip: '#4256cc', y: -0.08, z: -0.115 },
    ];

    featherSpecs.forEach((spec, idx) => {
      const fMesh = new THREE.Mesh(
        sculptedFeatherGeometry(spec.len, spec.wid, spec.arch, spec.tip),
        featherMat,
      );
      fMesh.position.set(0, spec.y, spec.z);
      fMesh.rotation.set(Math.PI + spec.rotX, spec.rotY, spec.rotZ);
      hipWing.add(fMesh);
      flutterFeathers.push({
        mesh: fMesh,
        phase: idx * 0.72 + (side > 0 ? 0 : 1.7),
        baseZ: spec.rotZ,
        baseY: spec.rotY,
      });
    });
  }

  /* ---------- Two Flaring Diagonal Floor-Length Coat-Tail Streamers (Images 1-4!) ---------- */
  const tapestryMat = new THREE.MeshStandardMaterial({
    map: tapestryTexture(),
    side: THREE.DoubleSide,
    roughness: 0.48,
    metalness: 0.10,
    emissive: '#0e225c',
    emissiveIntensity: 0.36,
  });

  for (const side of [-1, 1] as const) {
    // Graceful diagonal flare outward & slightly back, widening toward a pointed spear-tip above the floor!
    const flareX = side === 1 ? 0.36 : -0.18; // Right streamer sweeps further out in Front view, matching Image 1!
    const streamerPts = [
      V3(0, 0, 0),
      V3(flareX * 0.28, -0.34, -0.04),
      V3(flareX * 0.60, -0.74, -0.09),
      V3(flareX * 0.88, -1.12, -0.11),
      V3(flareX * 1.05, -1.38, -0.07),
    ];
    // Taper to a crisp pointed spear tip at the bottom (t > 0.86)
    const widthFn = (t: number) => {
      if (t < 0.84) return THREE.MathUtils.lerp(0.14, 0.25, t / 0.84);
      return THREE.MathUtils.lerp(0.25, 0.015, (t - 0.84) / 0.16);
    };
    const streamerGroup = new THREE.Group();
    streamerGroup.position.set(side * 0.145, -0.03, -0.02);
    streamerGroup.rotation.y = side * 0.54;
    skirtGroup.add(streamerGroup);

    const cloth = new THREE.Mesh(ribbonGeometry(streamerPts, 0.14, 0.24, 38, 0, widthFn), tapestryMat);
    streamerGroup.add(cloth);

    // 3D plush tufted white fur trim running smoothly down BOTH edges & meeting at the pointed tip!
    const curve = new THREE.CatmullRomCurve3(streamerPts);
    const up = V3(0, 0, 1);
    for (const edgeSide of [-1, 1] as const) {
      const edgePts: THREE.Vector3[] = [];
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        const p = curve.getPoint(t);
        const tan = curve.getTangent(t);
        const right = new THREE.Vector3().crossVectors(tan, up).normalize();
        const halfW = widthFn(t) * 0.5;
        edgePts.push(p.clone().addScaledVector(right, edgeSide * halfW));
      }
      streamerGroup.add(fluffyFurTube(edgePts, 0.015, furMat, 28, 8, false, false));
    }

    swayRibbons.push({ mesh: streamerGroup, phase: side > 0 ? 0.8 : 2.3, amp: 0.042, speed: 1.1 });
  }

  /* ============================================================
     4. ARTICULATED ARMS, SLEEK SLEEVES, FLOWING STOLE & HANDS
        (Hierarchical joints so the arm & staff move up/down & swing!)
     ============================================================ */
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(-0.156, 0.402, 0.0);
  upperBody.add(rightShoulder);

  rightShoulder.add(limbSegment(0.245, 0.039, 0.033, skin, gloveMat));
  addDetachedSleeveOrnament(rightShoulder, -1, furMat, royalBlue, sapphire, chromeSilver, cyanGem);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0, -0.245, 0);
  rightShoulder.add(rightElbow);

  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.033, 0.225, 20), gloveMat);
  rightForearm.position.y = -0.1125;
  rightElbow.add(rightForearm);
  addOrnateWristCuff(rightElbow, sapphireDeep, chromeSilver, cyanGem);

  const rightWrist = new THREE.Group();
  rightWrist.position.set(0, -0.225, 0);
  rightElbow.add(rightWrist);
  rightWrist.add(buildHand(-1, true, gloveMat));

  // Left Arm (gracefully extended open hand — viewer's right in front view)
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(0.156, 0.402, 0.0);
  upperBody.add(leftShoulder);

  leftShoulder.add(limbSegment(0.245, 0.039, 0.033, skin, gloveMat));
  addDetachedSleeveOrnament(leftShoulder, 1, furMat, royalBlue, sapphire, chromeSilver, cyanGem);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(0, -0.245, 0);
  leftShoulder.add(leftElbow);

  const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.033, 0.225, 20), gloveMat);
  leftForearm.position.y = -0.1125;
  leftElbow.add(leftForearm);
  addOrnateWristCuff(leftElbow, sapphireDeep, chromeSilver, cyanGem);

  const leftWrist = new THREE.Group();
  leftWrist.position.set(0, -0.225, 0);
  leftElbow.add(leftWrist);
  leftWrist.add(buildHand(1, false, gloveMat));

  /* ============================================================
     5. THE HEAVENSHARD CRYSTAL STAFF (Mounted to Right Hand!)
        Matches Images 1, 2, 3, 4, 5:
        - Glowing bottom diamond spearhead
        - Cobalt-to-aqua gradient shaft
        - Spiraling dark metallic ribbon & clusters of cyan ice blossoms
        - Sculpted hollow chrome-blue crescent claw blade & S-horn
        - Tall faceted luminous turquoise hexagonal crystal spire
     ============================================================ */
  const staffPivot = new THREE.Group();
  staffPivot.position.set(0.0, -0.028, 0.022);
  rightWrist.add(staffPivot);

  const staff = new THREE.Group();
  staffPivot.add(staff);

  const shaftTex = new THREE.MeshStandardMaterial({
    map: bootGradient(),
    color: '#9cecff',
    roughness: 0.24,
    metalness: 0.55,
    emissive: '#0c4878',
    emissiveIntensity: 0.45,
  });
  const darkMetal = std('#142a64', 0.22, 0.85, { emissive: '#081538', emissiveIntensity: 0.4 });
  const bladeChrome = std('#b4daf8', 0.14, 0.94, { emissive: '#1e4e84', emissiveIntensity: 0.36 });

  // Main pole (length 2.15m: bottom at y = -1.24, calyx at y = +0.76, crystal spire to y = +1.48)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.017, 2.02, 18), shaftTex);
  pole.position.y = -0.24;
  staff.add(pole);

  // Glowing cyan crystal spearhead butt at the bottom tip (seen clearly in Back & Side views 3, 4, 5!)
  const buttCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.025, 0.06, 14), bladeChrome);
  buttCollar.position.y = -1.25;
  staff.add(buttCollar);

  const buttCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.036, 0), cyanGem);
  buttCrystal.scale.set(0.74, 2.15, 0.74);
  buttCrystal.position.y = -1.34;
  staff.add(buttCrystal);

  // Spiraling dark-metallic vine wrapping around the upper shaft
  const vinePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 68; i++) {
    const t = i / 68;
    const a = t * Math.PI * 2 * 3.0;
    const r = 0.023 + t * 0.016;
    vinePts.push(V3(Math.cos(a) * r, -0.10 + t * 0.96, Math.sin(a) * r));
  }
  staff.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vinePts), 96, 0.0075, 8, false),
      darkMetal,
    ),
  );

  // Flowing translucent sky-cyan ribbon curling along the upper shaft
  const staffRibbonPts = [
    V3(0.025, 0.64, 0.02),
    V3(0.095, 0.45, -0.045),
    V3(0.055, 0.24, 0.065),
    V3(-0.045, 0.06, 0.035),
  ];
  staff.add(
    new THREE.Mesh(
      ribbonGeometry(staffRibbonPts, 0.038, 0.014, 24, 0.8),
      std('#3cb4f0', 0.24, 0.2, {
        transparent: true,
        opacity: 0.84,
        side: THREE.DoubleSide,
        emissive: '#1468a6',
        emissiveIntensity: 0.72,
      }),
    ),
  );

  // Glowing cyan 5-petal ice blossom clusters (Front Image 1!)
  const bloomPositions = [
    { pos: V3(0.025, 0.28, 0.024), scale: 0.044 },
    { pos: V3(-0.024, 0.36, 0.026), scale: 0.038 },
    { pos: V3(0.018, 0.44, 0.028), scale: 0.036 },
    { pos: V3(-0.052, 0.64, 0.036), scale: 0.034 },
    { pos: V3(-0.068, 0.73, 0.028), scale: 0.032 },
  ];
  for (const b of bloomPositions) {
    const fl = buildIceFlower(b.scale, cyanGem, std('#ffffff', 0.1, 0, { emissive: '#c2faff', emissiveIntensity: 2 }));
    fl.position.copy(b.pos);
    fl.rotation.set(0.3, 0.4, 0.2);
    staff.add(fl);
  }

  /* ---------- Sculpted Chrome-Blue Crescent Claw & Faceted Heavenshard Crystal ---------- */
  const shardHead = new THREE.Group();
  shardHead.position.y = 0.76;
  staff.add(shardHead);

  // Royal sapphire chalice crown socket
  const calyxBase = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.024, 0.19, 8), darkMetal);
  calyxBase.position.y = 0.03;
  shardHead.add(calyxBase);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const prong = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.16, 4), bladeChrome);
    prong.position.set(Math.cos(a) * 0.056, 0.13, Math.sin(a) * 0.056);
    prong.rotation.z = -Math.cos(a) * 0.26;
    prong.rotation.x = Math.sin(a) * 0.26;
    shardHead.add(prong);
  }

  // Signature Asymmetric Hollow Metallic Crescent Guard spiraling around the crystal (Front & Back views!)
  const outerBladePts = [
    V3(0.02, -0.12, -0.025),
    V3(-0.11, 0.02, 0.045),
    V3(-0.145, 0.21, 0.075),
    V3(-0.075, 0.42, 0.035),
    V3(0.055, 0.61, -0.025),
    V3(0.095, 0.78, -0.04),
  ];
  const outerBladeCurve = new THREE.CatmullRomCurve3(outerBladePts);
  const outerBladeGeo = new THREE.TubeGeometry(outerBladeCurve, 44, 0.026, 10, false);
  const obPos = outerBladeGeo.attributes.position;
  for (let i = 0; i < obPos.count; i++) {
    const t = Math.min(1, Math.floor(i / 11) / 44);
    const c = outerBladeCurve.getPointAt(t);
    const tap = t < 0.5 ? 0.65 + t * 1.15 : Math.max(0.08, (1 - t) * 2.4);
    obPos.setXYZ(i, c.x + (obPos.getX(i) - c.x) * tap, c.y + (obPos.getY(i) - c.y) * tap, c.z + (obPos.getZ(i) - c.z) * tap * 0.55);
  }
  outerBladeGeo.computeVertexNormals();
  shardHead.add(new THREE.Mesh(outerBladeGeo, bladeChrome));

  // Secondary dark-sapphire counter-spiral crescent horn
  const innerHornPts = [
    V3(-0.035, -0.06, 0.035),
    V3(0.092, 0.09, -0.035),
    V3(0.118, 0.26, -0.045),
    V3(0.045, 0.46, 0.02),
    V3(-0.035, 0.65, 0.045),
  ];
  const innerHornCurve = new THREE.CatmullRomCurve3(innerHornPts);
  const innerHornGeo = new THREE.TubeGeometry(innerHornCurve, 36, 0.019, 8, false);
  const ihPos = innerHornGeo.attributes.position;
  for (let i = 0; i < ihPos.count; i++) {
    const t = Math.min(1, Math.floor(i / 9) / 36);
    const c = innerHornCurve.getPointAt(t);
    const tap = Math.max(0.1, 1.1 - Math.abs(t - 0.35) * 1.4);
    ihPos.setXYZ(i, c.x + (ihPos.getX(i) - c.x) * tap, c.y + (ihPos.getY(i) - c.y) * tap, c.z + (ihPos.getZ(i) - c.z) * tap * 0.65);
  }
  innerHornGeo.computeVertexNormals();
  shardHead.add(new THREE.Mesh(innerHornGeo, darkMetal));

  // Lower dramatic metallic side fins
  for (const s of [-1, 1] as const) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.020, 0.22, 4), darkMetal);
    fin.position.set(s * 0.088, 0.14, 0);
    fin.rotation.z = -s * 0.54;
    shardHead.add(fin);
  }

  // Tall Faceted Vivid Turquoise-Cyan Heavenshard Crystal Spire (matches Reference Images 1-5!)
  const crystalMat = new THREE.MeshStandardMaterial({
    color: '#12e6fa',
    emissive: '#009fd4',
    emissiveIntensity: 1.15,
    roughness: 0.10,
    metalness: 0.12,
    flatShading: true,
    transparent: true,
    opacity: 0.95,
  });

  const crystalGroup = new THREE.Group();
  crystalGroup.position.y = 0.12;
  shardHead.add(crystalGroup);

  const crystalLow = new THREE.Mesh(new THREE.ConeGeometry(0.082, 0.16, 6), crystalMat);
  crystalLow.rotation.x = Math.PI;
  crystalLow.scale.set(1, 1, 0.72);
  crystalLow.position.y = 0.07;
  crystalGroup.add(crystalLow);

  const crystalMid = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.082, 0.32, 6), crystalMat);
  crystalMid.scale.set(1, 1, 0.72);
  crystalMid.position.y = 0.31;
  crystalGroup.add(crystalMid);

  const crystalTop = new THREE.Mesh(new THREE.ConeGeometry(0.076, 0.30, 6), crystalMat);
  crystalTop.scale.set(1, 1, 0.72);
  crystalTop.position.y = 0.62;
  crystalGroup.add(crystalTop);

  const innerCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.050, 0),
    new THREE.MeshBasicMaterial({ color: '#ecffff' }),
  );
  innerCore.scale.set(0.82, 2.7, 0.58);
  innerCore.position.y = 0.35;
  crystalGroup.add(innerCore);

  // Soft cyan crystal aura & orbiting starlight motes
  const glowTex = glowTexture();
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: '#5cf4ff',
      transparent: true,
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.scale.setScalar(1.25);
  halo.position.y = 0.38;
  crystalGroup.add(halo);

  const sparkleTex = sparkleTexture();
  const sparkleCount = 34;
  const sparklePos = new Float32Array(sparkleCount * 3);
  for (let i = 0; i < sparkleCount; i++) {
    const r = 0.10 + Math.random() * 0.22;
    const a = Math.random() * Math.PI * 2;
    sparklePos[i * 3] = Math.cos(a) * r;
    sparklePos[i * 3 + 1] = 0.04 + Math.random() * 0.74;
    sparklePos[i * 3 + 2] = Math.sin(a) * r;
  }
  const sparkleGeo = new THREE.BufferGeometry();
  sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));
  const sparkleMat = new THREE.PointsMaterial({
    map: sparkleTex,
    color: '#9ef8ff',
    size: 0.078,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const sparkles = new THREE.Points(sparkleGeo, sparkleMat);
  crystalGroup.add(sparkles);

  const shardLight = new THREE.PointLight('#48e8ff', 9, 6.0, 2);
  shardLight.position.y = 0.38;
  crystalGroup.add(shardLight);

  /* ---------- 3D Glowing Crescent Frost Slash Wave (Action Image 5!) ---------- */
  const slashWaveGroup = new THREE.Group();
  slashWaveGroup.position.set(0, 1.56, 0.16);
  slashWaveGroup.rotation.set(0.30, 0.15, -0.22);
  g.add(slashWaveGroup);

  const slashWaveMat = new THREE.MeshBasicMaterial({
    map: slashWaveTexture(),
    color: '#7ef6ff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const slashWaveMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.78, 1.72, 48, 1, -Math.PI * 0.65, Math.PI * 1.3),
    slashWaveMat,
  );
  slashWaveGroup.add(slashWaveMesh);

  /* ============================================================
     6. FUR NECK COLLAR, SCULPTED UV-PAINTED ANIME HEAD,
        KOKOSHNIK CROWN & LUSH LAYERED TURQUOISE HAIR
     ============================================================ */
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.047, 0.125, 20), skin);
  neck.position.set(0, 0.515, -0.004);
  upperBody.add(neck);

  // Soft plush white fur collar sitting snugly around the base of her neck
  const neckCollarPts = [
    V3(0, 0.495, 0.062),
    V3(0.056, 0.502, 0.032),
    V3(0.054, 0.514, -0.032),
    V3(0, 0.520, -0.058),
    V3(-0.054, 0.514, -0.032),
    V3(-0.056, 0.502, 0.032),
  ];
  upperBody.add(fluffyFurTube(neckCollarPts, 0.023, furMat, 30, 10, true, false));

  const head = new THREE.Group();
  head.position.set(0, 0.648, 0.004); // world y = 2.088
  upperBody.add(head);

  // Sculpted UV-mapped anime head with painterly emerald eyes, lashes, nose, lips & forehead star!
  const skull = new THREE.Mesh(buildSculptedAnimeHead(), faceMat);
  head.add(skull);

  // Delicate curved ears tucked cleanly behind the side locks
  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.020, 12, 10), skin);
    ear.scale.set(0.45, 1.25, 0.72);
    ear.position.set(side * 0.122, -0.015, -0.008);
    ear.rotation.y = side * 0.2;
    head.add(ear);
  }

  // Smooth skin-toned blink eyelids that gently close over the painted eyes during natural blinks
  const lidGeo = new THREE.SphereGeometry(0.026, 16, 12, 0, Math.PI, 0, Math.PI * 0.52);
  for (const side of [-1, 1] as const) {
    const lid = new THREE.Mesh(lidGeo, skin);
    lid.scale.set(1.22, 0.68, 0.45);
    lid.position.set(side * 0.047, 0.002, 0.118);
    lid.rotation.y = side * 0.34;
    lid.visible = false;
    head.add(lid);
    blinkLids.push(lid);
  }

  /* ---------- Turquoise Hair Crown, Center-Parted Bangs, Side Braids & WIDE Back Hair ---------- */
  // Glossy turquoise hair crown visible ABOVE & INSIDE the white fur headband (Images 1, 2, 3, 4!)
  const hairCrown = new THREE.Mesh(new THREE.SphereGeometry(0.140, 32, 24), hairMain);
  hairCrown.scale.set(0.99, 1.03, 0.98);
  hairCrown.position.set(0, 0.024, -0.018);
  head.add(hairCrown);

  // Center-parted lush curtain bangs, cheek braids & shoulder locks
  for (const side of [-1, 1] as const) {
    // 1. Inner wispy curtain bang framing the forehead, outer eye & tapering gently toward jaw
    const bang1 = sculptedHairLock(
      [
        V3(side * 0.005, 0.126, 0.106),
        V3(side * 0.052, 0.092, 0.128),
        V3(side * 0.092, 0.035, 0.114),
        V3(side * 0.098, -0.035, 0.088),
        V3(side * 0.084, -0.105, 0.068),
      ],
      0.018,
      0.46,
      hairLight,
      20,
    );
    head.add(bang1);

    // 2. Outer sleek cheek-hugging hair lock curving softly inward beside her chin
    const bang2 = sculptedHairLock(
      [
        V3(side * 0.030, 0.124, 0.094),
        V3(side * 0.096, 0.070, 0.098),
        V3(side * 0.114, -0.008, 0.076),
        V3(side * 0.102, -0.088, 0.058),
        V3(side * 0.082, -0.156, 0.044),
      ],
      0.022,
      0.50,
      hairMain,
      22,
    );
    head.add(bang2);

    // 3. Sculpted side braid hugging close beside her cheek (Front & Side views!)
    const braidGroup = new THREE.Group();
    for (let k = 0; k < 7; k++) {
      const link = new THREE.Mesh(
        new THREE.SphereGeometry(0.015 - k * 0.0007, 10, 8),
        k % 2 === 0 ? hairLight : hairMain,
      );
      link.scale.set(0.82, 1.28, 0.70);
      link.position.set(side * (0.114 - k * 0.003), 0.022 - k * 0.025, 0.044 - k * 0.003);
      link.rotation.z = side * (k % 2 === 0 ? 0.35 : -0.35);
      braidGroup.add(link);
    }
    head.add(braidGroup);

    // 4. Sleek teal collarbone lock curving gently behind her neck
    const frontLock = sculptedHairLock(
      [
        V3(side * 0.116, 0.012, 0.014),
        V3(side * 0.122, -0.088, 0.020),
        V3(side * 0.112, -0.178, 0.022),
        V3(side * 0.096, -0.258, 0.010),
      ],
      0.020,
      0.52,
      hairLight,
      20,
    );
    head.add(frontLock);
    swayRibbons.push({ mesh: frontLock, phase: side * 1.4, amp: 0.05, speed: 1.3 });
  }

  /* ---------- Russian Kokoshnik White Fur Headband Arch & Sapphire Gothic Tiara ---------- */
  // Slopes gracefully from forehead hairline down behind the ears to the back clasp (turquoise crown stays visible on top!)
  const headbandPts = [
    V3(0, 0.012, -0.136),
    V3(-0.105, 0.038, -0.092),
    V3(-0.138, 0.088, 0.008),
    V3(-0.095, 0.140, 0.082),
    V3(0, 0.160, 0.102),
    V3(0.095, 0.140, 0.082),
    V3(0.138, 0.088, 0.008),
    V3(0.105, 0.038, -0.092),
  ];
  head.add(fluffyFurTube(headbandPts, 0.028, furMat, 48, 12, true, false));

  // Ornate dark-sapphire & chrome-silver gothic tiara crest at front center of headband
  const tiaraGroup = new THREE.Group();
  tiaraGroup.position.set(0, 0.155, 0.126);
  tiaraGroup.rotation.x = -0.14;
  head.add(tiaraGroup);

  const tiaraFrame = new THREE.Mesh(new THREE.OctahedronGeometry(0.050, 0), chromeSilver);
  tiaraFrame.scale.set(0.86, 1.42, 0.26);
  tiaraGroup.add(tiaraFrame);

  const tiaraCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.042, 0), sapphireDeep);
  tiaraCore.scale.set(0.80, 1.32, 0.32);
  tiaraGroup.add(tiaraCore);

  const tiaraCenterGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.018, 0), cyanGem);
  tiaraCenterGem.scale.set(0.82, 1.32, 0.48);
  tiaraCenterGem.position.set(0, -0.004, 0.014);
  tiaraGroup.add(tiaraCenterGem);

  for (const side of [-1, 1] as const) {
    const wing = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 0), sapphireDeep);
    wing.scale.set(1.18, 0.72, 0.28);
    wing.position.set(side * 0.045, -0.024, -0.004);
    wing.rotation.z = -side * 0.36;
    tiaraGroup.add(wing);

    const sideGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.011, 0), cyanGem);
    sideGem.position.set(side * 0.045, -0.024, 0.008);
    tiaraGroup.add(sideGem);
  }

  /* ---------- Back Layered Shoulder-Width Turquoise Hair, Braids, Bow Clasp & Fur Puff (Images 2, 3, 4!) ---------- */
  const backHairGroup = new THREE.Group();
  backHairGroup.position.set(0, 0.018, -0.112);
  head.add(backHairGroup);

  // Horizontal twisted teal hair braids meeting at the rear blue clasp
  for (const side of [-1, 1] as const) {
    const ropePts = [
      V3(side * 0.132, 0.015, 0.075),
      V3(side * 0.105, 0.002, 0.018),
      V3(side * 0.052, -0.005, -0.032),
      V3(0, -0.005, -0.042),
    ];
    backHairGroup.add(
      new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePts), 20, 0.015, 10, false), hairLight),
    );
  }

  // Dark-sapphire bow clasp & teardrop white fur puff at the back of her headband (Images 2 & 3!)
  const backClasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), sapphire);
  backClasp.scale.set(1.5, 0.82, 0.52);
  backClasp.position.set(0, -0.002, -0.046);
  backHairGroup.add(backClasp);

  const backFurPuff = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.068, 12), furMat);
  backFurPuff.rotation.x = Math.PI - 0.32;
  backFurPuff.scale.set(0.95, 1, 0.72);
  backFurPuff.position.set(0, -0.046, -0.056);
  backHairGroup.add(backFurPuff);

  // WIDE, LUSH, SHOULDER-WIDTH 11-LOCK WAVY TURQUOISE BACK HAIR (Images 2, 3, 4!)
  // Two full tiers: an outer sweeping ruffled layer + inner fuller cascade covering the neck & shoulder blades!
  const outerBackLocks = [
    { x0: -0.105, xMid: -0.158, xEnd: -0.175, len: 0.27, zArch: -0.075, r: 0.036, mat: hairDark },
    { x0: -0.068, xMid: -0.118, xEnd: -0.132, len: 0.31, zArch: -0.095, r: 0.040, mat: hairMain },
    { x0: -0.032, xMid: -0.064, xEnd: -0.076, len: 0.33, zArch: -0.108, r: 0.042, mat: hairLight },
    { x0: 0.0, xMid: 0.006, xEnd: 0.002, len: 0.35, zArch: -0.115, r: 0.045, mat: hairMain },
    { x0: 0.032, xMid: 0.068, xEnd: 0.078, len: 0.33, zArch: -0.108, r: 0.042, mat: hairLight },
    { x0: 0.068, xMid: 0.118, xEnd: 0.132, len: 0.31, zArch: -0.095, r: 0.040, mat: hairMain },
    { x0: 0.105, xMid: 0.158, xEnd: 0.175, len: 0.27, zArch: -0.075, r: 0.036, mat: hairDark },
  ];
  for (const lk of outerBackLocks) {
    backHairGroup.add(
      sculptedHairLock(
        [
          V3(lk.x0, 0.015, -0.005),
          V3(lk.xMid * 0.82, -lk.len * 0.35, lk.zArch * 0.65),
          V3(lk.xMid, -lk.len * 0.72, lk.zArch),
          V3(lk.xEnd, -lk.len, lk.zArch * 1.18),
        ],
        lk.r,
        0.54,
        lk.mat,
        24,
      ),
    );
  }

  // Secondary upper ruffled wave locks arching outward dynamically (seen in Side Image 2 & Back Image 3!)
  const upperRuffleLocks = [-0.11, -0.055, 0.055, 0.11];
  upperRuffleLocks.forEach((ux, i) => {
    backHairGroup.add(
      sculptedHairLock(
        [
          V3(ux * 0.65, 0.01, -0.018),
          V3(ux * 1.05, -0.085, -0.082),
          V3(ux * 1.25, -0.165, -0.125),
          V3(ux * 1.38, -0.225, -0.155),
        ],
        0.034,
        0.48,
        i % 2 === 0 ? hairLight : hairMain,
        20,
      ),
    );
  });

  swayRibbons.push({ mesh: backHairGroup, phase: 1.1, amp: 0.055, speed: 1.25 });

  /* ============================================================
     SHADOWS & DYNAMIC ARM / STAFF ANIMATION ENGINE
     ============================================================ */
  g.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = false;
    }
  });
  sparkles.castShadow = false;
  innerCore.castShadow = false;
  slashWaveMesh.castShadow = false;

  let blinkTimer = 2.6;
  let blinkPhase = -1;

  const tick = (tRaw: number, dt: number) => {
    const t = tRaw * poseControls.speed;

    // 1. Torso gentle breathing
    const breath = Math.sin(t * 1.6);
    upperBody.position.y = 1.44 + breath * 0.010;

    // 2. Compute Articulated Right Arm (Staff Arm) & Left Arm poses
    // Base pose matches Front Reference Image 1:
    // Right arm gracefully holds the staff out at her right side tilted slightly outward;
    // Left arm extends down and outward with slender fanned fingers.
    let rShoulderX = -0.16;
    let rShoulderY = -0.14;
    let rShoulderZ = -0.34;
    let rElbowX = -0.58;
    let rElbowZ = 0.18;
    let rWristX = 0.34;
    let rWristZ = 0.24;
    let staffSpinY = 0;
    let staffTiltZ = 0;
    let staffTiltX = 0;
    let staffSlideY = 0;

    let lShoulderX = 0.06;
    let lShoulderZ = 0.44;
    let lElbowX = -0.24;
    let lWristZ = -0.16;
    let torsoYaw = Math.sin(t * 0.65) * 0.035;

    if (poseControls.mode === 'idle') {
      // Vivid idle: smooth gentle up/down breath of the arm & staff + subtle swing
      const liftWave = Math.sin(t * 1.8);
      const swingWave = Math.cos(t * 1.2);
      rShoulderX += liftWave * 0.14;
      rShoulderZ += swingWave * 0.08;
      rElbowX += liftWave * -0.16;
      rWristX += swingWave * 0.12;
      staffSlideY = liftWave * 0.05;

      lShoulderZ += Math.sin(t * 1.45 + 1.2) * 0.06;
      lElbowX += Math.cos(t * 1.45 + 0.5) * 0.07;
    } else if (poseControls.mode === 'updown') {
      // Rhythmic Up & Down levitation of arm and crystal staff
      const upDown = Math.sin(t * 2.6);
      rShoulderX = -0.34 + upDown * 0.44;
      rShoulderZ = -0.38 + Math.cos(t * 2.6) * 0.10;
      rElbowX = -0.72 + upDown * -0.26;
      rWristX = 0.38 - upDown * 0.24;
      staffSlideY = upDown * 0.12;

      lShoulderX = -0.10 - upDown * 0.22;
      lShoulderZ = 0.48 + upDown * 0.14;
      lElbowX = -0.38;
      torsoYaw = Math.sin(t * 1.3) * 0.08;
    } else if (poseControls.mode === 'swing') {
      // Dramatic Wide Sweeping Staff Swing & Crescent Frost Slash (Action Image 5!)
      const swing = Math.sin(t * 2.15);
      const lift = Math.cos(t * 2.15);
      torsoYaw = 0.18 + swing * 0.44;
      rShoulderX = -0.42 + lift * 0.36;
      rShoulderY = 0.28 + swing * 0.76;
      rShoulderZ = -0.58 + swing * 0.36;
      rElbowX = -0.46 + lift * 0.24;
      rWristX = 0.36 + swing * 0.42;
      rWristZ = 0.42;
      // Tilt staff diagonally/horizontally across the frost slash arc (matching Action Reference Image 5!)
      staffTiltX = 0.95 + lift * 0.35;
      staffTiltZ = -0.68 + swing * 0.52;

      lShoulderX = 0.22 - swing * 0.28;
      lShoulderZ = 0.58 + Math.abs(swing) * 0.16;
      lElbowX = -0.48;

      registry.slashTimer = Math.max(registry.slashTimer, 0.45 + Math.max(0, Math.cos(t * 2.15 - 0.35)) * 0.55);
    } else if (poseControls.mode === 'dance') {
      // Figure-8 spell weaving: arm and staff rise, dip, spin & sweep in a figure-8 arc
      const s1 = Math.sin(t * 2.05);
      const s2 = Math.sin(t * 4.1);
      torsoYaw = s1 * 0.26;
      rShoulderX = -0.46 + s2 * 0.38;
      rShoulderY = s1 * 0.52;
      rShoulderZ = -0.48 + s1 * 0.28;
      rElbowX = -0.60 - s2 * 0.24;
      rWristX = 0.44 + s1 * 0.38;
      staffSpinY = t * 1.8;
      staffTiltZ = -0.35 + s1 * 0.55;
      staffTiltX = 0.45 + s2 * 0.42;
      staffSlideY = s2 * 0.08;

      lShoulderX = -0.16 - s2 * 0.24;
      lShoulderZ = 0.52 + s1 * 0.18;
      lElbowX = -0.48 + s1 * 0.14;
      registry.slashTimer = Math.max(registry.slashTimer, 0.52 + 0.35 * Math.sin(t * 4.1));
    }

    // One-shot slash trigger
    if (registry.slashTimer > 0 && poseControls.mode !== 'swing' && poseControls.mode !== 'dance') {
      const p = registry.slashTimer;
      const arc = Math.sin((1 - p) * Math.PI * 1.4);
      torsoYaw += arc * 0.42;
      rShoulderX -= arc * 0.48;
      rShoulderY += arc * 0.72;
      staffTiltX += arc * 0.95;
      staffTiltZ -= arc * 0.65;
    }

    // Manual Arm Lift & Staff Swing slider offsets
    rShoulderX -= poseControls.armLift * 0.58;
    rElbowX -= poseControls.armLift * 0.28;
    staffSlideY += poseControls.armLift * 0.12;

    rShoulderY += poseControls.staffSwing * 0.68;
    rShoulderZ += poseControls.staffSwing * 0.30;
    staffTiltX += poseControls.staffSwing * 0.85;
    staffTiltZ -= poseControls.staffSwing * 0.65;
    torsoYaw += poseControls.staffSwing * 0.28;

    // Apply hierarchical transforms
    upperBody.rotation.y = torsoYaw;
    rightShoulder.rotation.set(rShoulderX, rShoulderY, rShoulderZ);
    rightElbow.rotation.set(rElbowX, 0, rElbowZ);
    rightWrist.rotation.set(rWristX, 0, rWristZ);
    staff.position.y = staffSlideY;
    staff.rotation.set(staffTiltX, staffSpinY, staffTiltZ);

    leftShoulder.rotation.set(lShoulderX, 0, lShoulderZ);
    leftElbow.rotation.set(lElbowX, 0, 0);
    leftWrist.rotation.set(0, 0, lWristZ);

    // 3. Head — regal poise + subtle pointer gaze tracking
    const targetYaw = Math.sin(t * 0.45) * 0.07 + registry.pointer.x * 0.22 - torsoYaw * 0.45;
    const targetPitch = Math.sin(t * 0.7 + 1.1) * 0.022 - registry.pointer.y * 0.09;
    head.rotation.y += (targetYaw - head.rotation.y) * Math.min(1, dt * 4.0);
    head.rotation.x += (targetPitch - head.rotation.x) * Math.min(1, dt * 4.0);

    // 4. Secondary cloth, hair, plume tail & billowing wing motion
    const motionBoost = 1 + Math.abs(torsoYaw) * 1.8;
    for (const s of swayRibbons) {
      s.mesh.rotation.z = (s.baseZ ?? 0) + Math.sin(t * s.speed + s.phase) * s.amp * motionBoost;
      s.mesh.rotation.x = (s.baseX ?? 0) + Math.cos(t * s.speed * 0.85 + s.phase * 1.3) * s.amp * 0.65 * motionBoost;
    }

    for (const f of flutterFeathers) {
      f.mesh.rotation.z = f.baseZ + Math.sin(t * 1.45 + f.phase) * 0.04 * motionBoost;
      f.mesh.rotation.y = f.baseY + Math.cos(t * 1.15 + f.phase) * 0.036 * motionBoost;
    }

    // 5. Crescent Frost Slash Wave
    registry.slashTimer = Math.max(0, registry.slashTimer - dt * 1.15);
    slashWaveMat.opacity = registry.slashTimer * 0.88;
    slashWaveGroup.rotation.z = -0.22 + (1 - registry.slashTimer) * 1.25;
    slashWaveGroup.scale.setScalar(0.86 + (1 - registry.slashTimer) * 0.36);

    // 6. Crystal heartbeat & burst
    registry.burst *= Math.exp(-dt * 1.9);
    const pulse = 1.05 + Math.sin(t * 2.2) * 0.25 + registry.burst * 1.8 + registry.slashTimer * 0.7;
    crystalMat.emissiveIntensity = pulse;
    shardLight.intensity = 9 + Math.sin(t * 2.2) * 2.5 + registry.burst * 48 + registry.slashTimer * 20;
    sparkleMat.opacity = 0.68 + Math.sin(t * 3.1) * 0.2 + registry.burst * 0.3;
    sparkles.rotation.y = t * 0.75;
    innerCore.rotation.y = -t * 1.1;
    halo.material.opacity = 0.64 + Math.sin(t * 2.2) * 0.14 + registry.burst * 0.30;
    halo.scale.setScalar(1.22 + Math.sin(t * 2.2) * 0.12 + registry.burst * 0.75);

    // 7. Gentle blinking eyelids
    blinkTimer -= dt;
    if (blinkTimer <= 0 && blinkPhase < 0) {
      blinkPhase = 0;
      blinkTimer = 3.0 + Math.random() * 2.8;
    }
    if (blinkPhase >= 0) {
      blinkPhase += dt / 0.18;
      const k = Math.min(blinkPhase, 1);
      const closed = Math.sin(k * Math.PI);
      for (const lid of blinkLids) {
        lid.visible = closed > 0.12;
        lid.scale.y = 0.2 + closed * 0.72;
      }
      if (blinkPhase >= 1) {
        blinkPhase = -1;
        for (const lid of blinkLids) lid.visible = false;
      }
    }
  };

  return {
    group: g,
    tick,
    setPointer: (nx, ny) => registry.pointer.set(nx, ny),
    burst: () => {
      registry.burst = 1;
      registry.slashTimer = 1;
    },
    triggerSwingSlash: () => {
      registry.slashTimer = 1;
      registry.burst = 0.85;
    },
    setPoseControls: (partial) => {
      Object.assign(poseControls, partial);
    },
    getPoseControls: () => ({ ...poseControls }),
  };
}

/* ============================================================
   HELPER BUILDERS FOR ARMS, SLEEVES, FLOWING STOLE & HANDS
   ============================================================ */

/** Smoothly blended upper arm: rounded bare deltoid cap -> porcelain upper arm -> pale-cyan opera glove */
function limbSegment(len: number, rTop: number, rBot: number, skinMat: THREE.Material, gloveMat: THREE.Material) {
  const grp = new THREE.Group();
  const topLen = len * 0.40;
  const botLen = len * 0.60;
  const rMid = THREE.MathUtils.lerp(rTop, rBot, 0.40);

  // Smooth rounded shoulder head tucked seamlessly into the bare shoulder slope
  const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(rTop * 1.06, 18, 14), skinMat);
  shoulderCap.scale.set(1.0, 0.92, 0.96);
  grp.add(shoulderCap);

  const skinPart = new THREE.Mesh(new THREE.CylinderGeometry(rMid, rTop, topLen, 18), skinMat);
  skinPart.position.y = -topLen * 0.5;
  grp.add(skinPart);

  const glovePart = new THREE.Mesh(new THREE.CylinderGeometry(rBot, rMid, botLen, 18), gloveMat);
  glovePart.position.y = -topLen - botLen * 0.5;
  grp.add(glovePart);

  return grp;
}

/**
 * Detached sleeve ornament & flowing S-curved fur-trimmed elbow stole (Reference Images 1, 2, 3, 4):
 * - Slim fluffy white fur band right below the bare shoulder
 * - Fitted royal-blue upper sleeve cap pinned with a 6-point crystal snowflake armlet
 * - Organic, draping, fur-bordered blue stole looping softly behind/around the elbow (NO stiff floating donut!)
 */
function addDetachedSleeveOrnament(
  shoulderGroup: THREE.Group,
  side: 1 | -1,
  furMat: THREE.Material,
  royalBlueMat: THREE.Material,
  sapphireMat: THREE.Material,
  silverMat: THREE.Material,
  gemMat: THREE.Material,
) {
  // 1. Plush upper bicep white fur trim right below bare porcelain shoulder
  const bicepPts = [
    V3(0.042, -0.075, 0),
    V3(0, -0.075, 0.042),
    V3(-0.042, -0.075, 0),
    V3(0, -0.075, -0.042),
  ];
  shoulderGroup.add(fluffyFurTube(bicepPts, 0.017, furMat, 24, 10, true, false));

  // 2. Royal-blue sculpted puff sleeve cap
  const bluePuff = new THREE.Mesh(new THREE.SphereGeometry(0.050, 18, 14), royalBlueMat);
  bluePuff.scale.set(1.0, 1.12, 1.0);
  bluePuff.position.y = -0.115;
  shoulderGroup.add(bluePuff);

  // 3. Outer bicep dark-sapphire & cyan 6-point crystal snowflake clasp (Front & Side views!)
  const armlet = buildIceFlower(0.032, sapphireMat, gemMat);
  armlet.position.set(side * 0.048, -0.102, 0.012);
  armlet.rotation.y = side * Math.PI * 0.46;
  shoulderGroup.add(armlet);

  // 4. Organic Draped Fur-Trimmed Elbow Stole (swings gently behind elbow like Images 1, 2, 3, 4!)
  const stoleGroup = new THREE.Group();
  stoleGroup.position.set(0, -0.17, -0.015);
  shoulderGroup.add(stoleGroup);

  // Curved draped royal-blue sleeve capelet hugging behind the elbow
  const capeGeo = new THREE.CylinderGeometry(0.048, 0.095, 0.135, 24, 1, true, -Math.PI * 0.2, Math.PI * 1.45);
  const cape = new THREE.Mesh(capeGeo, royalBlueMat);
  cape.position.set(side * 0.012, -0.025, -0.022);
  cape.rotation.set(0.28, side * 0.35, side * 0.18);
  stoleGroup.add(cape);

  // Plush S-curved white fur stole arc swooping organically around the outer & rear elbow rim!
  const stoleArcPts = [
    V3(-side * 0.042, 0.015, 0.022),
    V3(side * 0.015, -0.068, 0.048),
    V3(side * 0.088, -0.092, -0.010),
    V3(side * 0.068, -0.055, -0.088),
    V3(-side * 0.025, -0.028, -0.092),
    V3(-side * 0.058, -0.012, -0.032),
  ];
  stoleGroup.add(fluffyFurTube(stoleArcPts, 0.024, furMat, 36, 12, true, false));

  // Ornate silver-sapphire filigree brooch tucked inside the elbow fold (Side Image 2!)
  const medallion = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), silverMat);
  medallion.scale.set(1.15, 0.78, 0.32);
  medallion.position.set(side * 0.062, -0.045, 0.018);
  stoleGroup.add(medallion);
}

/** Ornate dark-sapphire & silver pointed wrist cuff (vambrace) */
function addOrnateWristCuff(
  elbowGroup: THREE.Group,
  sapphireDeep: THREE.Material,
  silverMat: THREE.Material,
  gemMat: THREE.Material,
) {
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.035, 0.068, 18), sapphireDeep);
  cuff.position.y = -0.192;
  elbowGroup.add(cuff);

  for (const dy of [-0.158, -0.224]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0042, 8, 20), silverMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = dy;
    elbowGroup.add(rim);
  }

  const cuffGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.012, 0), gemMat);
  cuffGem.scale.set(0.8, 1.38, 0.45);
  cuffGem.position.set(0, -0.192, 0.035);
  elbowGroup.add(cuffGem);
}

/** Slender sculpted gloved hand & delicate fingers */
function buildHand(side: 1 | -1, gripping: boolean, gloveMat: THREE.Material) {
  const hand = new THREE.Group();
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.030, 14, 12), gloveMat);
  palm.scale.set(0.86, 1.18, 0.58);
  palm.position.set(0, -0.028, 0);
  hand.add(palm);

  for (let i = 0; i < 4; i++) {
    const spread = (i - 1.5) * 0.011;
    const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0056, 0.030, 4, 8), gloveMat);
    if (gripping) {
      finger.position.set(spread, -0.036, 0.024);
      finger.rotation.x = Math.PI * 0.42;
    } else {
      const fanAngle = (i - 1.5) * 0.19;
      finger.position.set(spread * 1.25 + Math.sin(fanAngle) * 0.010, -0.066 + Math.abs(i - 1.5) * 0.004, 0.006);
      finger.rotation.z = fanAngle * side;
      finger.rotation.x = 0.18 + i * 0.05;
    }
    hand.add(finger);
  }

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0062, 0.024, 4, 8), gloveMat);
  thumb.position.set(-side * 0.024, -0.028, 0.013);
  thumb.rotation.set(0.28, 0, side * 0.68);
  hand.add(thumb);

  return hand;
}
