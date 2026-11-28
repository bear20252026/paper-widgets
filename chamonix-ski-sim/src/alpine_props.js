/**
 * Grounded 3D Chamonix Alpine Props, Landmark Architecture & Natural Kickers (Wave 4):
 *  - Refined Aiguille du Midi station: stratified Protogine granite buttresses, pale concrete
 *    terraces, warm-lit panoramic observatory gallery, truss footbridge, needle spire,
 *    AND two animated iconic red/white Chamonix Téléphérique cable cars gliding along the span!
 *  - Botanical frosted Norway spruce trees built from 3-plane crossed alpha-tested cards
 *    (`spruce_bough.png`) + central bark trunk core, strictly plumb vertical with soft radial shading
 *  - Single-draw-call GPU-projected directional cobalt ground shadows beneath EVERY spruce,
 *    granite boulder, and glacial serac block (aligned to local terrain normal & stretched along -sunDir!)
 *  - Sculpted natural freeride wind-lip / cornice kickers along all 6 drop-in corridors
 *  - Subtle weathered alpine wooden guide stakes marking drop-in start terraces
 */
import * as THREE from 'three';
import { CORE_HALF, MAX_ELEV } from './terrain_data.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mark opaque world `MeshStandardMaterial` meshes with alpha = 0.55 inside `sceneRT`
 * so BOTH motion blur (`worldMask = 1.0`) AND volumetric god-ray occlusion (`skyMask = 0.0`) treat them as solid alpine structures!
 */
function markWorldOpaque(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      '#include <dithering_fragment>\n  gl_FragColor.a = 0.55;'
    );
  };
  mat.customProgramCacheKey = () => 'chamonix_world_opaque_v8';
  return mat;
}

function buildStratifiedPitonGeo(radius, height, seed = 11) {
  // High-resolution indexed Protogine granite spire with seamless periodic 3D strata & welded smooth normals
  // (ZERO flat-shaded 14-sided prism seams when standing right beside Aiguille du Midi at midi_north!)
  const g = new THREE.CylinderGeometry(radius * 0.48, radius * 1.08, height, 36, 18, false);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const yn = THREE.MathUtils.clamp((y + height * 0.5) / Math.max(0.01, height), 0, 1); // 0 bottom .. 1 top
    if (r > 0.01) {
      const ang = Math.atan2(z, x);
      const ridge = 1.0
        + 0.20 * Math.sin(ang * 3.0 + seed * 0.7) * Math.cos(yn * 4.2)
        + 0.11 * Math.sin(ang * 5.0 - yn * 6.5 + seed)
        + 0.06 * Math.cos(ang * 8.0 + yn * 9.0 - seed * 0.4);
      const strata = 1.0 + 0.055 * Math.sin(yn * 18.0 + Math.cos(ang * 2.0 + seed) * 1.4);
      const crag = 1.0 + 0.035 * Math.sin(ang * 11.0 + yn * 14.0);
      const scale = ridge * strata * crag;
      const yCrag = (Math.sin(ang * 4.0 + yn * 10.0 + seed) * 0.9 + Math.cos(ang * 7.0 - yn * 8.0) * 0.45) * (1.0 - yn * 0.65);
      pos.setXYZ(i, x * scale, y + yCrag, z * scale);
    }
  }
  computeWeldedSmoothNormals(g);

  // Add granite strata + snow-dusted upward ledge vertex colors matching terrain Protogine granite!
  const n = g.attributes.position.count;
  const norms = g.attributes.normal;
  const poss = g.attributes.position;
  const cols = new Float32Array(n * 3);
  const props = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const ny = norms.getY(i);
    const py = poss.getY(i);
    const px = poss.getX(i), pz = poss.getZ(i);
    const yn = THREE.MathUtils.clamp((py + height * 0.5) / Math.max(0.01, height), 0, 1);
    const band = 0.80 + 0.28 * Math.sin(py * 0.22 + px * 0.04 - pz * 0.03);
    const snow = THREE.MathUtils.smoothstep(ny, 0.48, 0.78);
    const gR = 0.34 * band, gG = 0.33 * band, gB = 0.36 * band;
    cols[i * 3]     = gR * (1 - snow) + 0.88 * snow;
    cols[i * 3 + 1] = gG * (1 - snow) + 0.91 * snow;
    cols[i * 3 + 2] = gB * (1 - snow) + 0.96 * snow;
    // Expose textured Chamonix Protogine granite rock down to the snow crest so the buttress never looks like a blank grey snow pyramid!
    const expose = THREE.MathUtils.smoothstep(yn, 0.03, 0.16) * (1.0 - snow * 0.48);
    const ao = THREE.MathUtils.clamp(0.56 + yn * 0.38 + ny * 0.14, 0.42, 1.0);
    props[i * 3]     = expose;
    props[i * 3 + 1] = ao;
    props[i * 3 + 2] = (seed * 0.17) % 1.0;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.setAttribute('aProp', new THREE.BufferAttribute(props, 3));
  return g;
}

function buildCableCarMesh(accentColor = 0xc82622) {
  const car = new THREE.Group();
  const bodyMat = markWorldOpaque(new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.36, metalness: 0.22 }));
  const roofMat = markWorldOpaque(new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.42, metalness: 0.18 }));
  const steelMat = markWorldOpaque(new THREE.MeshStandardMaterial({ color: 0x3a424d, roughness: 0.45, metalness: 0.72 }));
  const winMat = markWorldOpaque(new THREE.MeshStandardMaterial({
    color: 0x1e2c3a,
    emissive: 0xffa63a,
    emissiveIntensity: 0.45,
    roughness: 0.14,
    metalness: 0.65,
  }));
  car.userData.winMat = winMat;

  // Pulley carriage riding directly on the steel cable at local y = 0
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 6.2), steelMat);
  carriage.position.set(0, 0, 0);
  car.add(carriage);

  // Curved steel hanger arm descending from cable to cabin roof
  const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.65, 9.5, 1.1), steelMat);
  hanger.position.set(0, -4.8, 0);
  car.add(hanger);

  // Classic big Chamonix Téléphérique cabin (66-person octagonal/box silhouette, slightly upscaled for readability across 1–2 km spans!)
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.0, 8.8), bodyMat);
  lowerBody.position.set(0, -13.0, 0);
  car.add(lowerBody);

  const windowBand = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.5, 8.4), winMat);
  windowBand.position.set(0, -10.5, 0);
  car.add(windowBand);

  const whiteStripe = new THREE.Mesh(new THREE.BoxGeometry(5.75, 0.75, 8.95), roofMat);
  whiteStripe.position.set(0, -11.95, 0);
  car.add(whiteStripe);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.9, 8.6), roofMat);
  roof.position.set(0, -9.0, 0);
  car.add(roof);

  return car;
}

function buildAiguilleDuMidiStation(spire, terrainData, pitonShaderMat = null) {
  const g = new THREE.Group();
  const baseY = terrainData.sampleHeight(spire.x, spire.z);
  g.position.set(spire.x, baseY, spire.z);

  const concreteMat = markWorldOpaque(new THREE.MeshStandardMaterial({
    color: 0xc8cfd8, // bright weathered alpine concrete catching direct sun cleanly!
    roughness: 0.78,
    metalness: 0.06,
  }));
  const darkSteelMat = markWorldOpaque(new THREE.MeshStandardMaterial({
    color: 0x262d36,
    roughness: 0.48,
    metalness: 0.72,
  }));
  const glassMat = markWorldOpaque(new THREE.MeshStandardMaterial({
    color: 0x3b6e94,
    emissive: 0xffa842, // warm tungsten-amber observatory glow (surges HDR in Alpenglow!)
    emissiveIntensity: 0.55,
    roughness: 0.12,
    metalness: 0.45,
  }));
  const beaconMat = markWorldOpaque(new THREE.MeshStandardMaterial({
    color: 0xff3b22,
    emissive: 0xff2c14,
    emissiveIntensity: 1.4,
    roughness: 0.25,
    metalness: 0.1,
  }));
  const snowCapMat = markWorldOpaque(new THREE.MeshStandardMaterial({
    color: 0xf1f5fa,
    roughness: 0.78,
    metalness: 0.0,
  }));
  const antennaRedMat = markWorldOpaque(new THREE.MeshStandardMaterial({
    color: 0xd9382a,
    roughness: 0.42,
    metalness: 0.32,
  }));
  const antennaWhiteMat = markWorldOpaque(new THREE.MeshStandardMaterial({
    color: 0xeef3f8,
    roughness: 0.50,
    metalness: 0.25,
  }));
  const rockMat = pitonShaderMat || markWorldOpaque(new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.90,
    metalness: 0.04,
  }));

  // Stratified grey-ochre Mont Blanc granite buttresses (compact needle-spire footprint clear of midi_north launch terrace!)
  const mainPiton = new THREE.Mesh(buildStratifiedPitonGeo(33, 80, 17), rockMat);
  mainPiton.position.set(0, 14, 0);
  mainPiton.scale.set(1.08, 1.0, 0.88);
  g.add(mainPiton);

  // Secondary lower piton (Piton Nord) connected by the iconic footbridge!
  const pitonNorth = new THREE.Mesh(buildStratifiedPitonGeo(26, 66, 41), rockMat);
  pitonNorth.position.set(38, 6, -26);
  pitonNorth.scale.set(0.95, 1.0, 0.85);
  g.add(pitonNorth);

  // Concrete summit observatory tower & stepped cylindrical terraces
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(16.5, 19.5, 12, 16), concreteMat);
  plinth.position.set(0, 44, 0);
  g.add(plinth);

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(12.2, 14.5, 24, 16), concreteMat);
  tower.position.set(0, 60, 0);
  g.add(tower);

  const galleryRing = new THREE.Mesh(new THREE.CylinderGeometry(14.6, 13.6, 2.2, 20), concreteMat);
  galleryRing.position.set(0, 69.0, 0);
  g.add(galleryRing);

  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(13.8, 13.8, 5.2, 20), glassMat);
  gallery.position.set(0, 72.5, 0);
  g.add(gallery);

  const roofCap = new THREE.Mesh(new THREE.CylinderGeometry(13.6, 14.8, 3.2, 20), snowCapMat);
  roofCap.position.set(0, 76.5, 0);
  g.add(roofCap);

  // Iconic banded red-and-white summit telemetry spire needle (clearly readable from Tacul & Vallée Blanche!)
  const spireBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3.8, 22, 10), concreteMat);
  spireBase.position.set(0, 87, 0);
  g.add(spireBase);

  const segColors = [antennaRedMat, antennaWhiteMat, antennaRedMat, antennaWhiteMat, antennaRedMat];
  for (let i = 0; i < segColors.length; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.max(0.18, 1.05 - i * 0.2), Math.max(0.24, 1.25 - i * 0.2), 6.2, 8),
      segColors[i]
    );
    seg.position.set(0, 100 + i * 6.2, 0);
    g.add(seg);
  }
  // Summit aviation obstruction beacon atop Aiguille du Midi needle spire (subtle red pulse in Alpenglow!)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 8), beaconMat);
  beacon.position.set(0, 100 + segColors.length * 6.2 + 0.6, 0);
  g.add(beacon);

  // Piton Nord cable-car terrace & glass bay
  const northStation = new THREE.Mesh(new THREE.BoxGeometry(24, 15, 18), concreteMat);
  northStation.position.set(37, 42, -25);
  g.add(northStation);
  const northWin = new THREE.Mesh(new THREE.BoxGeometry(24.6, 4.2, 14), glassMat);
  northWin.position.set(37, 44.5, -25);
  g.add(northWin);
  const northRoof = new THREE.Mesh(new THREE.BoxGeometry(25.2, 2.4, 19), snowCapMat);
  northRoof.position.set(37, 50.6, -25);
  g.add(northRoof);

  // Iconic steel suspension footbridge spanning the granite chasm + truss rails
  const bridgeLen = 46;
  const bridgeYaw = Math.atan2(25, 37);
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(18.5, 49, -12.5);
  bridgeGroup.rotation.y = bridgeYaw;
  bridgeGroup.add(new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 1.8, 4.2), darkSteelMat));
  const railL = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 2.4, 0.35), darkSteelMat);
  railL.position.set(0, 1.9, 1.9);
  const railR = railL.clone();
  railR.position.z = -1.9;
  bridgeGroup.add(railL, railR);
  g.add(bridgeGroup);

  // Dual sweeping steel Téléphérique cables descending north toward Plan de l'Aiguille
  const planX = -1503 - spire.x;
  const planZ = -2545 - spire.z;
  const planY = terrainData.sampleHeight(-1503, -2545) - baseY;

  const evalCablePos = (t, lateralOff = 0) => {
    const x0 = 37 + lateralOff;
    const z0 = -25;
    const y0 = 44;
    const x1 = planX + lateralOff;
    const z1 = planZ;
    const y1 = planY + 26;
    const sag = Math.sin(t * Math.PI) * -98;
    return new THREE.Vector3(
      x0 + (x1 - x0) * t,
      y0 + (y1 - y0) * t + sag,
      z0 + (z1 - z0) * t
    );
  };

  const cableMat = new THREE.LineBasicMaterial({
    color: 0x1a2029,
    transparent: true,
    opacity: 0.72,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  for (const lat of [-4.5, 4.5]) {
    const pts = [];
    for (let i = 0; i <= 32; i++) pts.push(evalCablePos(i / 32, lat));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat));
  }

  // Two opposing red/white Chamonix Téléphérique cable cars gliding smoothly along the twin cables!
  const cabinUp = buildCableCarMesh(0xd42c24);
  const cabinDown = buildCableCarMesh(0xd42c24);
  const cableAz = Math.atan2(planX - 37, planZ + 25);
  cabinUp.rotation.y = cableAz;
  cabinDown.rotation.y = cableAz;
  g.add(cabinUp, cabinDown);

  const updateCableCars = (time, twilight = 0.0) => {
    // Slow majestic cycle: at t=0 cabinUp sits visibly right below Aiguille du Midi (t=0.09), cabinDown above Plan de l'Aiguille (t=0.91)!
    const u = 0.5 - 0.5 * Math.cos(time * 0.028);
    const tA = 0.09 + u * 0.82;
    const tB = 0.91 - u * 0.82;
    cabinUp.position.copy(evalCablePos(tA, -4.5));
    cabinDown.position.copy(evalCablePos(tB, 4.5));
    cabinUp.rotation.z = Math.sin(time * 0.85) * 0.035;
    cabinDown.rotation.z = Math.cos(time * 0.78) * 0.035;

    // Warm HDR tungsten observatory gallery & cabin window glow surging during 17:35 Alpenglow!
    const winGlow = 0.35 + twilight * 2.55;
    glassMat.emissiveIntensity = winGlow;
    cabinUp.userData.winMat.emissiveIntensity = 0.30 + twilight * 2.25;
    cabinDown.userData.winMat.emissiveIntensity = 0.30 + twilight * 2.25;
    const pulse = 0.65 + 0.35 * Math.sin(time * 3.1);
    beaconMat.emissiveIntensity = (0.85 + twilight * 3.8) * pulse;
  };
  updateCableCars(0, 0);

  return { group: g, updateCableCars };
}

/**
 * True 3D Volumetric Snow-Laden Alpine Norway Spruce (`Picea abies`) Geometry Builder.
 * ZERO flat cutout planes, ZERO stacked toy cones!
 * Builds:
 *  - Segmented organically tapering dark-bark trunk buried -2.4m into steep slopes
 *  - Irregular spiral whorls of curved drooping 3D diamond-section evergreen boughs
 *  - Splayed lateral forked twig sub-sprays on lower/mid tiers (real jagged air gaps!)
 *  - Sculpted 3D rounded snow pillows resting atop each drooping branch curve (leaving dark
 *    shadowed pine needles peeking beneath & around every serrated snow-capped tip!)
 * Encodes `aMat` per vertex: (matType [0=bark, 1=needles, 2=snowPillow], coreAO [0.18..1.0], heightNorm [0..1])
 */
function buildVolumetricSpruceGeometry(seed = 101, style = 'tall') {
  const rand = mulberry32(seed);
  const pos = [];
  const norm = [];
  const matAttr = []; // (matType, coreAO, hNorm)

  const totalH = style === 'broad' ? 11.8 : (style === 'far' ? 13.4 : 14.4);
  const yBuried = -2.4;

  const pushTri = (ax, ay, az, bx, by, bz, cx, cy, cz, matType, aoA, aoB, aoC, radialBlend = 0.25) => {
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let fnx = uy * vz - uz * vy;
    let fny = uz * vx - ux * vz;
    let fnz = ux * vy - uy * vx;
    const fl = Math.hypot(fnx, fny, fnz) || 1;
    fnx /= fl; fny /= fl; fnz /= fl;

    const verts = [[ax, ay, az, aoA], [bx, by, bz, aoB], [cx, cy, cz, aoC]];
    for (let i = 0; i < 3; i++) {
      const [px, py, pz, ao] = verts[i];
      pos.push(px, py, pz);
      // Soft radial-crown normal blend prevents harsh low-poly faceting while keeping bold crisp 3D shading!
      const rl = Math.hypot(px, Math.max(0.4, py * 0.25), pz) || 1;
      const rnx = px / rl;
      const rny = matType > 1.5 ? 0.82 : (py > 0 ? 0.35 : -0.2);
      const rnz = pz / rl;
      let nx = fnx * (1 - radialBlend) + rnx * radialBlend;
      let ny = fny * (1 - radialBlend) + rny * radialBlend;
      let nz = fnz * (1 - radialBlend) + rnz * radialBlend;
      const nl = Math.hypot(nx, ny, nz) || 1;
      norm.push(nx / nl, ny / nl, nz / nl);
      matAttr.push(matType, ao, THREE.MathUtils.clamp(py / totalH, 0, 1));
    }
  };

  // Push quad oriented outward given 4 vertices (p0, p1, p2, p3)
  const pushQuad = (p0, p1, p2, p3, matType, ao0, ao1, ao2, ao3, rb = 0.25) => {
    pushTri(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], matType, ao0, ao1, ao2, rb);
    pushTri(p0[0], p0[1], p0[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2], matType, ao0, ao2, ao3, rb);
  };

  // 1. Dark Bark Trunk (6-sided organically swaying tapered stem rooted -2.4m deep!)
  const trunkSegs = style === 'far' ? 3 : 5;
  const trunkSides = 6;
  const crookX = (rand() - 0.5) * 0.44;
  const crookZ = (rand() - 0.5) * 0.44;
  const trunkRings = [];
  for (let s = 0; s <= trunkSegs; s++) {
    const t = s / trunkSegs;
    const y = yBuried + (totalH * 0.96 - yBuried) * t;
    const rad = (style === 'broad' ? 0.52 : 0.44) * Math.pow(1.0 - t * 0.88, 1.15) * (t < 0.18 ? 1.25 : 1.0);
    const ox = Math.sin(t * Math.PI) * crookX;
    const oz = Math.sin(t * Math.PI) * crookZ;
    const ring = [];
    for (let k = 0; k < trunkSides; k++) {
      const a = (k / trunkSides) * Math.PI * 2;
      ring.push([ox + Math.cos(a) * rad, y, oz + Math.sin(a) * rad]);
    }
    trunkRings.push({ ring, t });
  }
  for (let s = 0; s < trunkSegs; s++) {
    const r0 = trunkRings[s].ring, r1 = trunkRings[s + 1].ring;
    const ao0 = 0.30 + trunkRings[s].t * 0.25;
    const ao1 = 0.30 + trunkRings[s + 1].t * 0.25;
    for (let k = 0; k < trunkSides; k++) {
      const kn = (k + 1) % trunkSides;
      pushQuad(r0[k], r1[k], r1[kn], r0[kn], 0.0, ao0, ao1, ao1, ao0, 0.35);
    }
  }

  // Helper: emit ONE solid 3D curved drooping evergreen frond + optional sculpted rounded snow pillow cap!
  const emitBoughFrond = (ox, oy, oz, az, len, halfW, droop, thick, snowH, isSubTwig = false) => {
    const dx = Math.cos(az), dz = Math.sin(az);
    const sx = -Math.sin(az), sz = Math.cos(az);

    const evalSpine = (u) => {
      const r = len * u;
      // Heavy alpine snow weighs branches downward sharply in a natural drooping arc, curling slightly up right at outer needle tip!
      const dropY = -droop * Math.pow(u, 1.38) + Math.pow(u, 2.8) * (droop * 0.22);
      const jitter = (u > 0.1 && u < 0.95) ? (rand() - 0.5) * 0.09 : 0;
      return [ox + dx * r, oy + dropY + jitter, oz + dz * r];
    };

    const p0 = evalSpine(0.0);
    const p1 = evalSpine(0.46);
    const p2 = evalSpine(1.0); // pointed drooping serrated outer needle tip!

    const w0 = halfW * 0.34;
    const w1 = halfW * (isSubTwig ? 0.92 : 1.0);
    const t0 = thick * 0.95;
    const t1 = thick * 0.72;

    // Cross-section points at base (u=0): top, left skirt, bottom keel, right skirt
    const bT = [p0[0], p0[1] + t0 * 0.45, p0[2]];
    const bL = [p0[0] + sx * w0, p0[1] - t0 * 0.18, p0[2] + sz * w0];
    const bB = [p0[0], p0[1] - t0 * 0.65, p0[2]];
    const bR = [p0[0] - sx * w0, p0[1] - t0 * 0.18, p0[2] - sz * w0];

    // Cross-section points at mid-swell (u=0.46)
    const mT = [p1[0], p1[1] + t1 * 0.42, p1[2]];
    const mL = [p1[0] + sx * w1, p1[1] - t1 * 0.28, p1[2] + sz * w1];
    const mB = [p1[0], p1[1] - t1 * 0.78, p1[2]];
    const mR = [p1[0] - sx * w1, p1[1] - t1 * 0.28, p1[2] - sz * w1];

    // Outer tip with tiny organic twist
    const tip = [p2[0], p2[1] - t1 * 0.12, p2[2]];

    // Core AO: deep shadowed green near trunk (0.22..0.38), vivid sunlit outer tips (0.88..1.0)!
    const baseAO = isSubTwig ? 0.52 : 0.22;
    const midAO = isSubTwig ? 0.78 : 0.72;
    const tipAO = 0.98;

    // 4-sided diamond hull: base -> mid (8 tris)
    pushQuad(bT, bL, mL, mT, 1.0, baseAO * 1.1, baseAO * 0.85, midAO * 0.92, midAO * 1.05, 0.22);
    pushQuad(bT, mT, mR, bR, 1.0, baseAO * 1.1, midAO * 1.05, midAO * 0.92, baseAO * 0.85, 0.22);
    pushQuad(bL, bB, mB, mL, 1.0, baseAO * 0.65, baseAO * 0.40, midAO * 0.44, midAO * 0.74, 0.18);
    pushQuad(bB, bR, mR, mB, 1.0, baseAO * 0.40, baseAO * 0.65, midAO * 0.74, midAO * 0.44, 0.18);

    // Tapered nose: mid -> pointed tip (4 tris)
    pushTri(mT[0], mT[1], mT[2], mL[0], mL[1], mL[2], tip[0], tip[1], tip[2], 1.0, midAO * 1.05, midAO * 0.92, tipAO, 0.25);
    pushTri(mT[0], mT[1], mT[2], tip[0], tip[1], tip[2], mR[0], mR[1], mR[2], 1.0, midAO * 1.05, tipAO, midAO * 0.92, 0.25);
    pushTri(mL[0], mL[1], mL[2], mB[0], mB[1], mB[2], tip[0], tip[1], tip[2], 1.0, midAO * 0.78, midAO * 0.46, tipAO * 0.82, 0.20);
    pushTri(mB[0], mB[1], mB[2], mR[0], mR[1], mR[2], tip[0], tip[1], tip[2], 1.0, midAO * 0.46, midAO * 0.78, tipAO * 0.82, 0.20);

    // Sculpted 3D rounded snow pillow resting atop the upper ridge of the bough!
    // Narrower inset (`0.68`) & stopping at `u = 0.76` lets rich dark evergreen pine fringes frame EVERY snow cushion!
    if (snowH > 0.04) {
      const s0 = evalSpine(0.10);
      const sm = evalSpine(0.42);
      const s2 = evalSpine(0.76);
      const sw0 = halfW * 0.28;
      const swm = halfW * 0.66;

      const sbT = [s0[0], s0[1] + t0 * 0.34 + snowH * 0.65, s0[2]];
      const sbL = [s0[0] + sx * sw0, s0[1] + t0 * 0.12, s0[2] + sz * sw0];
      const sbR = [s0[0] - sx * sw0, s0[1] + t0 * 0.12, s0[2] - sz * sw0];

      const smT = [sm[0], sm[1] + t1 * 0.34 + snowH * 0.88, sm[2]];
      const smL = [sm[0] + sx * swm, sm[1] + t1 * 0.08, sm[2] + sz * swm];
      const smR = [sm[0] - sx * swm, sm[1] + t1 * 0.08, sm[2] - sz * swm];

      const sTip = [s2[0], s2[1] + t1 * 0.18 + snowH * 0.28, s2[2]];

      // Upper puffed rounded snow pillow dome
      pushQuad(sbT, sbL, smL, smT, 2.0, 0.78, 0.62, 0.82, 0.98, 0.48);
      pushQuad(sbT, smT, smR, sbR, 2.0, 0.78, 0.98, 0.82, 0.62, 0.48);
      pushTri(smT[0], smT[1], smT[2], smL[0], smL[1], smL[2], sTip[0], sTip[1], sTip[2], 2.0, 0.98, 0.82, 0.94, 0.48);
      pushTri(smT[0], smT[1], smT[2], sTip[0], sTip[1], sTip[2], smR[0], smR[1], smR[2], 2.0, 0.98, 0.94, 0.82, 0.48);
      pushTri(smL[0], smL[1], smL[2], sTip[0], sTip[1] - snowH * 0.24, sTip[2], sTip[0], sTip[1], sTip[2], 2.0, 0.65, 0.72, 0.90, 0.35);
      pushTri(smR[0], smR[1], smR[2], sTip[0], sTip[1], sTip[2], sTip[0], sTip[1] - snowH * 0.24, sTip[2], 2.0, 0.65, 0.90, 0.72, 0.35);
    }
  };

  // 2. Irregular Golden-Angle Whorls of Drooping 3D Evergreen Branches (fuller upper crown!)
  const numWhorls = style === 'far' ? 8 : 12;
  const maxRad = style === 'broad' ? 4.35 : (style === 'far' ? 3.85 : 3.95);
  const startY = style === 'broad' ? 0.55 : 0.85;
  const endY = totalH - 0.55;
  let goldenAz = rand() * Math.PI * 2;

  for (let w = 0; w < numWhorls; w++) {
    const wt = w / Math.max(1, numWhorls - 1); // 0 bottom .. 1 crown top
    const baseH = startY + (endY - startY) * Math.pow(wt, 0.92);
    const trunkOx = Math.sin(((baseH - yBuried) / (totalH - yBuried)) * Math.PI) * crookX;
    const trunkOz = Math.sin(((baseH - yBuried) / (totalH - yBuried)) * Math.PI) * crookZ;

    // Rich natural alpine spruce envelope (keeps upper third lush & feathered instead of bare trunk!)
    const env = Math.pow(1.0 - wt * 0.82, style === 'broad' ? 0.82 : 0.94);
    const branchCount = style === 'far'
      ? Math.max(4, Math.round(6 - wt * 2.2))
      : Math.max(4, Math.round((style === 'broad' ? 7.5 : 7.0) - wt * 2.8));

    goldenAz += 2.399963;

    for (let b = 0; b < branchCount; b++) {
      // Natural wind-sheared gaps break up uniform symmetrical "pagoda cone" silhouettes!
      if (wt > 0.22 && wt < 0.86 && branchCount >= 5 && rand() < 0.14) continue;
      const az = goldenAz + (b / branchCount) * Math.PI * 2 + (rand() - 0.5) * (0.58 / branchCount * 4.5);
      const len = maxRad * env * (0.64 + rand() * 0.72);
      const yOff = (rand() - 0.5) * 0.68 * (1 - wt * 0.35);
      const by = baseH + yOff;
      const halfW = (0.46 + len * 0.27) * (0.78 + rand() * 0.42);
      const droop = len * (0.36 + (1 - wt) * 0.19) * (0.74 + rand() * 0.46);
      const thick = (0.28 + len * 0.12) * (0.82 + rand() * 0.34);
      // Organic ~65% snow-capped boughs + ~35% wind-blown dark evergreen boughs for realistic Alpine contrast!
      const snowChance = rand();
      const snowH = snowChance > 0.34 ? (0.14 + env * 0.26 + rand() * 0.14) * (style === 'broad' ? 1.15 : 1.0) : 0.0;

      emitBoughFrond(trunkOx, by, trunkOz, az, len, halfW, droop, thick, snowH, false);

      // Forked lateral sub-branchlets on hero trees (rich dark evergreen sprays!)
      if (style !== 'far' && len > 1.05) {
        const dx = Math.cos(az), dz = Math.sin(az);
        const startR = len * (0.32 + rand() * 0.16);
        const subY = by - droop * Math.pow(startR / len, 1.38) + 0.03;
        const subOx = trunkOx + dx * startR;
        const subOz = trunkOz + dz * startR;
        for (const side of [-1, 1]) {
          if (wt > 0.72 && rand() < 0.40) continue;
          const subAz = az + side * (0.50 + rand() * 0.26);
          const subLen = len * (0.44 + rand() * 0.18);
          const subW = halfW * 0.56;
          const subDroop = subLen * 0.40;
          const subSnow = rand() > 0.56 ? snowH * 0.48 : 0.0;
          emitBoughFrond(subOx, subY, subOz, subAz, subLen, subW, subDroop, thick * 0.64, subSnow, true);
        }
        // Fine serrated outer needle fanlets ONLY on foreground ultra-hero spruces ('close' LOD pool < 240m of drop-in!)
        // Keeps close-up silhouettes jagged & fractal for volumetric god-rays while keeping distant forests ultra-fast!
        if (style === 'close' && wt < 0.64 && len > 1.50) {
          const tipR = len * (0.60 + rand() * 0.12);
          const uT = tipR / len;
          const tipY = by - droop * Math.pow(uT, 1.38) + Math.pow(uT, 2.8) * (droop * 0.22);
          const tipOx = trunkOx + dx * tipR;
          const tipOz = trunkOz + dz * tipR;
          const side = (b % 2 === 0) ? 1 : -1;
          for (const sgn of [side, -side]) {
            if (sgn !== side && rand() < 0.45) continue;
            const fanAz = az + sgn * (0.58 + rand() * 0.30);
            const fanLen = len * (0.30 + rand() * 0.14);
            const fanW = halfW * 0.36;
            const fanDroop = fanLen * 0.48;
            emitBoughFrond(tipOx, tipY - 0.04, tipOz, fanAz, fanLen, fanW, fanDroop, thick * 0.44, 0.0, true);
          }
        }
      }
    }
  }

  // 3. Dense organic evergreen needle leader shoots at summit tip (NO bare pointy white cone!)
  const apexY = totalH - 0.55;
  const ax = Math.sin(0.95 * Math.PI) * crookX;
  const azO = Math.sin(0.95 * Math.PI) * crookZ;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + rand() * 0.45;
    emitBoughFrond(ax, apexY - 0.18, azO, a, 0.85 + rand() * 0.25, 0.34, 0.26, 0.26, rand() > 0.4 ? 0.14 : 0.0, true);
  }
  const tipH = totalH + 0.25;
  const rCap = 0.22;
  for (let k = 0; k < 5; k++) {
    const a0 = (k / 5) * Math.PI * 2;
    const a1 = ((k + 1) / 5) * Math.PI * 2;
    pushTri(
      ax + Math.cos(a0) * rCap, apexY - 0.15, azO + Math.sin(a0) * rCap,
      ax, tipH, azO,
      ax + Math.cos(a1) * rCap, apexY - 0.15, azO + Math.sin(a1) * rCap,
      1.0, 0.82, 1.0, 0.82, 0.4
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('aMat', new THREE.Float32BufferAttribute(matAttr, 3));
  return geo;
}

function computeWeldedSmoothNormals(geo) {
  // Exact spatial-hash normal welding fixes BOTH UV-seam edges AND non-indexed polyhedron flat-shading!
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const buckets = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
    let acc = buckets.get(key);
    if (!acc) {
      acc = [0, 0, 0, []];
      buckets.set(key, acc);
    }
    acc[0] += norm.getX(i);
    acc[1] += norm.getY(i);
    acc[2] += norm.getZ(i);
    acc[3].push(i);
  }
  for (const acc of buckets.values()) {
    const len = Math.hypot(acc[0], acc[1], acc[2]) || 1;
    const nx = acc[0] / len, ny = acc[1] / len, nz = acc[2] / len;
    for (const idx of acc[3]) norm.setXYZ(idx, nx, ny, nz);
  }
  norm.needsUpdate = true;
}

function buildRockGeometry(seed = 1) {
  // Craggy multi-block Protogine granite outcrop: main erratic crag + flanking companion rock + smooth wind-drift snow collar!
  // Encodes `aProp` per vertex: (expose [0=snow collar .. 1=bare granite], cavityAO [0.3..1.0], seed)
  const pos = [];
  const norm = [];
  const prop = [];
  const idx = [];

  const appendSubRock = (ox, oy, oz, sx, sy, sz, rotY, subSeed, isSnowCollar = false) => {
    const g = isSnowCollar
      ? new THREE.SphereGeometry(1.0, 20, 12)
      : new THREE.SphereGeometry(1.0, 22, 16);
    const gp = g.attributes.position;
    const cY = Math.cos(rotY), sY = Math.sin(rotY);
    for (let i = 0; i < gp.count; i++) {
      const ux = gp.getX(i), uy = gp.getY(i), uz = gp.getZ(i);
      let x, y, z;
      if (isSnowCollar) {
        // Broad gentle wind-drifted snow apron banking smoothly up around the base of the granite outcrop
        const wave = 1.0 + 0.14 * Math.sin(Math.atan2(uz, ux) * 3.0 + subSeed);
        x = ux * sx * wave;
        z = uz * sz * wave;
        y = uy > 0 ? Math.pow(uy, 0.72) * sy * (0.85 + 0.20 * Math.cos(ux * 2.5 + subSeed)) : (uy * 1.15);
      } else {
        const dip1 = uy * 0.44 + ux * 0.89;
        const dip2 = ux * 0.62 - uz * 0.78 + uy * 0.35;
        const plane1 = 1.0 - Math.abs(Math.sin(dip1 * 2.0 + uz * 1.2 + subSeed * 0.4));
        const plane2 = 1.0 - Math.abs(Math.cos(dip2 * 2.4 + subSeed * 0.9));
        const crag = 0.5 + 0.5 * Math.sin(ux * 3.9 + uz * 3.1 - uy * 3.2);
        const strata = 0.68 + 0.36 * plane1 + 0.20 * plane2 + 0.08 * crag;
        const normP = Math.pow(Math.pow(Math.abs(ux), 2.5) + Math.pow(Math.abs(uy), 2.5) + Math.pow(Math.abs(uz), 2.5) + 1e-4, 1 / 2.5);
        const mixU = 0.58;
        const bx = ux * (1 - mixU) + (ux / normP) * mixU;
        const by = uy * (1 - mixU) + (uy / normP) * mixU;
        const bz = uz * (1 - mixU) + (uz / normP) * mixU;
        const flare = uy < 0 ? (1.0 + (-uy) * 0.42) : (1.0 - uy * 0.14);
        x = bx * sx * strata * flare + (uy > 0 ? uy * 0.18 : 0);
        z = bz * sz * strata * flare - (uy > 0 ? uy * 0.12 : 0);
        y = by * sy * (uy > 0 ? (0.82 + 0.32 * plane1) : 1.05);
      }
      const rx = x * cY - z * sY + ox;
      const rz = x * sY + z * cY + oz;
      gp.setXYZ(i, rx, y + oy, rz);
    }
    computeWeldedSmoothNormals(g);
    const gn = g.attributes.normal;
    const baseV = pos.length / 3;
    for (let i = 0; i < gp.count; i++) {
      const px = gp.getX(i), py = gp.getY(i), pz = gp.getZ(i);
      pos.push(px, py, pz);
      norm.push(gn.getX(i), gn.getY(i), gn.getZ(i));
      if (isSnowCollar) {
        prop.push(0.0, 0.86 + Math.min(0.14, Math.max(0, py * 0.25)), subSeed);
      } else {
        // Smooth transition from snow drift near base (-0.30..+0.08) to bare fractured granite higher up
        const expose = THREE.MathUtils.smoothstep(py, -0.25, 0.14);
        const seamDist = Math.hypot(px - ox * 0.5, pz - oz * 0.5);
        const ao = THREE.MathUtils.clamp(0.48 + py * 0.42 + seamDist * 0.14, 0.36, 1.0);
        prop.push(expose, ao, subSeed);
      }
    }
    const gi = g.index;
    for (let i = 0; i < gi.count; i++) idx.push(baseV + gi.getX(i));
    g.dispose();
  };

  // Main angular Protogine granite crag + smaller weathered companion scree block + gentle wind-packed snow collar
  appendSubRock(0.0, 0.0, 0.0, 1.24, 0.92, 0.88, 0.0, seed, false);
  appendSubRock(0.95, -0.26, 0.34, 0.66, 0.52, 0.58, 0.72, seed + 17, false);
  appendSubRock(-0.82, -0.34, -0.28, 0.52, 0.40, 0.48, -0.95, seed + 41, false);
  appendSubRock(0.08, -0.30, 0.06, 1.72, 0.32, 1.35, 0.2, seed + 5, true);

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  out.setAttribute('aProp', new THREE.Float32BufferAttribute(prop, 3));
  out.setIndex(idx);
  return out;
}

function buildSeracClusterGeometry(seed = 311) {
  // Photoreal 100% WATERTIGHT multi-slab fractured Chamonix glacial icefall / serac ridge cluster!
  // Uses closed subdivided BoxGeometry per slab displaced strictly by continuous 3D position functions
  // so adjacent vertical walls & top snow roof ALWAYS share exact sealed corners (ZERO detached sheets, ZERO slits!)
  // while keeping sharp chiseled 90° fracture corners between cleaved ice walls!
  // Encodes `aProp` per vertex: (iceExpose [0=snow skirt/cap .. 1=sheared vertical ice cliff], cavityAO [0.22..1.05], strataSeed)
  const pos = [];
  const norm = [];
  const prop = [];
  const idx = [];

  const emitIceSlab = (cx, cy, cz, hw, hh, hd, yaw, tiltX, tiltZ, subSeed, pinchAO = 0.0) => {
    const baseDepth = -1.55; // deeply buried downhill root prevents ANY floating gap on steep 42° slopes!
    const totalH = hh - baseDepth;
    const g = new THREE.BoxGeometry(hw * 2.0, totalH, hd * 2.0, 6, 9, 6);
    const gp = g.attributes.position;
    const gnInit = g.attributes.normal; // remembers which of the 6 box faces each vertex belongs to!
    const cY = Math.cos(yaw), sY = Math.sin(yaw);
    const strataSeed = (subSeed * 0.137) % 1.0;
    const topSlopeX = Math.sin(subSeed * 1.7) * 0.24 * hh;
    const topSlopeZ = Math.cos(subSeed * 2.3) * 0.22 * hh;

    // Track face normal class BEFORE deforming (top roof vs vertical cliff vs hidden bottom)
    const isTopFace = new Uint8Array(gp.count);
    const vNormArr = new Float32Array(gp.count);
    for (let i = 0; i < gp.count; i++) {
      isTopFace[i] = gnInit.getY(i) > 0.5 ? 1 : 0;
      const ox = gp.getX(i); // [-hw..+hw]
      const oy = gp.getY(i); // [-totalH/2..+totalH/2]
      const oz = gp.getZ(i); // [-hd..+hd]

      const nx = ox / Math.max(0.01, hw); // [-1..+1]
      const nz = oz / Math.max(0.01, hd); // [-1..+1]
      // Clamp strictly to [0, 1] so floating-point -2.2e-16 NEVER feeds negative base into Math.pow(..., 1.35) -> NaN!
      const v = THREE.MathUtils.clamp((oy + totalH * 0.5) / Math.max(0.01, totalH), 0.0, 1.0);
      vNormArr[i] = v;

      // Continuous radial shaping applied IDENTICALLY to adjacent face corners -> 100% watertight solid!
      // Stronger diagonal spire taper breaks up blocky brick silhouette into chiseled alpine serac pinnacles!
      const tap = 1.0 - Math.pow(v, 1.35) * 0.24;
      const skirtFlare = v < 0.28 ? Math.pow((0.28 - v) / 0.28, 1.5) * 0.26 : 0.0;
      const corniceLip = v > 0.85 ? Math.sin(((v - 0.85) / 0.15) * Math.PI * 0.85) * 0.075 : 0.0;
      // Sharp faceted horizontal firn-strata step ledges & angular vertical fracture flutings!
      const rawStep = Math.sin(v * 15.5 + subSeed * 2.1 + nx * 0.6);
      const strataStep = 0.068 * Math.sign(rawStep) * Math.pow(Math.abs(rawStep), 0.62) * Math.sin(v * Math.PI);
      const cornerChisel = 0.065 * Math.cos(v * 9.0 + nx * 2.4 - nz * 2.1 + subSeed) * Math.sin(v * Math.PI);
      const radScale = tap + skirtFlare + corniceLip + strataStep + cornerChisel;

      // Angular conchoidal calving flutes strictly inside vertical wall interiors (0 at corners -> watertight!)
      const edgeEnvX = Math.max(0, 1.0 - nx * nx);
      const edgeEnvZ = Math.max(0, 1.0 - nz * nz);
      const vEnv = Math.sin(v * Math.PI);
      const fluteX = Math.abs(Math.sin(nz * 3.8 + subSeed + v * 1.4)) - 0.55;
      const fluteZ = Math.abs(Math.cos(nx * 3.8 - subSeed + v * 1.2)) - 0.55;
      const scoopX = -0.15 * edgeEnvZ * Math.abs(nx) * vEnv * (0.45 + 0.55 * fluteX);
      const scoopZ = -0.15 * edgeEnvX * Math.abs(nz) * vEnv * (0.45 + 0.55 * fluteZ);

      // Skew tilt along vertical height like a fractured calving glacier tower leaning downhill
      let lx = ox * radScale + scoopX * Math.sign(ox || 1) + v * tiltX;
      let lz = oz * radScale + scoopZ * Math.sign(oz || 1) + v * tiltZ;

      // Sharp chiseled tilted fracture table roof (crisp planar edge, subtle thin snow crust — zero puffy marshmallow dome!)
      const ridgeCrest = 0.06 * Math.abs(Math.sin(nx * 2.6 + subSeed)) * Math.cos(nz * 1.8 - subSeed);
      const topY = hh + nx * topSlopeX + nz * topSlopeZ + ridgeCrest;
      let ly = baseDepth + (topY - baseDepth) * v;
      if (v > 0.99) {
        const thinCrust = Math.max(0, 1.0 - nx * nx) * Math.max(0, 1.0 - nz * nz) * 0.055 * hh;
        ly += thinCrust;
      }

      const wx = lx * cY - lz * sY + cx;
      const wz = lx * sY + lz * cY + cz;
      gp.setXYZ(i, wx, ly + cy, wz);
    }

    // BoxGeometry keeps vertices distinct per face across the 12 edges -> computeVertexNormals() automatically yields
    // smooth sculpted conchoidal walls AND razor-sharp chiseled 90° fracture corners between adjoining cliff faces!
    g.computeVertexNormals();
    const gn = g.attributes.normal;
    const baseV = pos.length / 3;
    for (let i = 0; i < gp.count; i++) {
      const px = gp.getX(i), py = gp.getY(i), pz = gp.getZ(i);
      const v = vNormArr[i];
      pos.push(px, py, pz);
      norm.push(gn.getX(i), gn.getY(i), gn.getZ(i));

      if (isTopFace[i]) {
        // Wind-packed fractured glacier snow cap across the chiseled top table
        const dCenter = Math.hypot(px - cx, pz - cz) / Math.max(0.5, Math.hypot(hw, hd));
        prop.push(0.0, THREE.MathUtils.clamp(1.03 - dCenter * 0.14, 0.86, 1.04), strataSeed);
      } else {
        // Vertical sheared glacial wall: exposed crystalline ice right up to the sharp overhanging snow rim!
        const botBlend = THREE.MathUtils.smoothstep(v, 0.22, 0.36);
        const topBlend = 1.0 - THREE.MathUtils.smoothstep(v, 0.90, 0.985);
        const expose = botBlend * topBlend;
        // Shadowed recess directly beneath overhanging snow lip + darker glacial cleft near ground & inter-slab junctions
        const underLip = 1.0 - 0.36 * Math.exp(-Math.pow((v - 0.86) / 0.09, 2.0));
        const baseAO = THREE.MathUtils.lerp(0.36, 1.0, THREE.MathUtils.smoothstep(v, 0.14, 0.58));
        const clusterDist = Math.hypot(px, pz);
        const innerPinch = THREE.MathUtils.lerp(1.0 - pinchAO, 1.0, THREE.MathUtils.clamp(clusterDist / 1.55, 0, 1));
        prop.push(expose, THREE.MathUtils.clamp(baseAO * underLip * innerPinch, 0.20, 1.04), strataSeed);
      }
    }
    const gi = g.index;
    for (let i = 0; i < gi.count; i++) idx.push(baseV + gi.getX(i));
    g.dispose();
  };

  // 5 interlocking angular watertight fractured glacial slabs + 3 calved talus ice chunks wedged in snow skirt!
  emitIceSlab( 0.00,  0.00,  0.00, 0.86, 1.24, 0.50,  0.04,  0.14,  0.20, seed + 1,  0.20); // central leaning tower
  emitIceSlab(-0.90, -0.10,  0.14, 0.66, 0.94, 0.42, -0.26, -0.18,  0.14, seed + 19, 0.30); // left sheared fin
  emitIceSlab( 0.92, -0.14, -0.12, 0.70, 0.84, 0.44,  0.29,  0.16,  0.24, seed + 37, 0.30); // right tilted step block
  emitIceSlab(-0.24, -0.22,  0.54, 0.60, 0.56, 0.32,  0.15, -0.08,  0.26, seed + 53, 0.38); // downhill calved block
  emitIceSlab( 0.38, -0.24, -0.46, 0.62, 0.66, 0.34, -0.18,  0.10, -0.10, seed + 71, 0.32); // uphill buttress block
  // Calved ice debris chunks resting organically along snow-drift skirt apron
  emitIceSlab(-1.42, -0.42,  0.58, 0.32, 0.34, 0.24,  0.52, -0.06,  0.08, seed + 89, 0.15);
  emitIceSlab( 1.38, -0.44,  0.48, 0.28, 0.28, 0.22, -0.48,  0.07,  0.05, seed + 103, 0.15);
  emitIceSlab( 0.18, -0.46,  0.98, 0.30, 0.25, 0.20,  0.24, -0.04,  0.06, seed + 127, 0.12);

  // Compact, deeply-rooted wind-drifted snow ramp collar hugging the icefall base (zero cantilevered downhill pillow!)
  const collar = new THREE.SphereGeometry(1.0, 26, 12);
  const cp = collar.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const ux = cp.getX(i), uy = cp.getY(i), uz = cp.getZ(i);
    const ang = Math.atan2(uz, ux);
    const wave = 1.0 + 0.16 * Math.sin(ang * 2.0 + seed) + 0.10 * Math.cos(ang * 3.0 - seed);
    const x = ux * 1.56 * wave;
    const z = uz * 1.04 * wave;
    const y = uy > 0
      ? Math.pow(uy, 0.96) * 0.24 * (0.76 + 0.24 * Math.sin(ux * 2.4 + uz * 2.1)) - 0.24
      : (uy * 1.85 - 0.24);
    cp.setXYZ(i, x, y, z);
  }
  computeWeldedSmoothNormals(collar);
  const cn = collar.attributes.normal;
  const baseV = pos.length / 3;
  for (let i = 0; i < cp.count; i++) {
    pos.push(cp.getX(i), cp.getY(i), cp.getZ(i));
    norm.push(cn.getX(i), cn.getY(i), cn.getZ(i));
    prop.push(0.0, 0.85, 0.5);
  }
  const ci = collar.index;
  for (let i = 0; i < ci.count; i++) idx.push(baseV + ci.getX(i));
  collar.dispose();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('aProp', new THREE.Float32BufferAttribute(prop, 3));
  geo.setIndex(idx);
  return geo;
}

function buildWindLipKickerGeometry() {
  // Organic smooth freeride snow wind-lip ramp sculpted along local -Z (forward)!
  // Ramp rises gradually from tail (z = +5.5) to sharp overhanging wind-lip crest (z = -3.8), dropping steep at nose (z = -5.2)
  const segX = 12, segZ = 14;
  const W = 7.6, L = 11.0;
  const pos = [];
  const norm = [];
  const idx = [];
  for (let iz = 0; iz <= segZ; iz++) {
    const tz = iz / segZ; // 0 = rear entrance, 1 = front drop edge
    const z = (0.5 - tz) * L;
    // Ramp profile: smooth curved scoop peaking at tz = 0.78
    let prof = 0;
    if (tz < 0.78) {
      const u = tz / 0.78;
      prof = Math.pow(u, 1.85);
    } else {
      const u = (tz - 0.78) / 0.22;
      prof = Math.cos(u * Math.PI * 0.5);
    }
    for (let ix = 0; ix <= segX; ix++) {
      const tx = ix / segX;
      const x = (tx - 0.5) * W;
      const edgeFade = Math.cos((tx - 0.5) * Math.PI); // 0 at sides, 1 at center
      const skirt = (tz === 0 || tz === segZ || ix === 0 || ix === segX) ? -0.95 : 0.0;
      const y = prof * edgeFade * 2.15 + skirt;
      pos.push(x, y, z);
      norm.push(0, 1, 0);
    }
  }
  const stride = segX + 1;
  for (let iz = 0; iz < segZ; iz++) {
    for (let ix = 0; ix < segX; ix++) {
      const i00 = iz * stride + ix;
      const i10 = i00 + 1;
      const i01 = i00 + stride;
      const i11 = i01 + 1;
      idx.push(i00, i01, i10);
      idx.push(i10, i01, i11);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  const kickerProp = new Float32Array((pos.length / 3) * 3);
  for (let i = 0; i < pos.length / 3; i++) {
    kickerProp[i * 3] = 0.0;
    kickerProp[i * 3 + 1] = 1.0;
    kickerProp[i * 3 + 2] = 0.5;
  }
  geo.setAttribute('aProp', new THREE.Float32BufferAttribute(kickerProp, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function createAlpineProps(terrainData) {
  const group = new THREE.Group();
  const colliders = []; // { x, y, z, r, h, kind }
  const kickers = [];   // { x, y, z, fwdX, fwdZ, radius, boost, width }
  const shadows = [];   // { x, y, z, nx, ny, nz, radius, height, opacity }

  // Shared uniforms across rocks, seracs, spruce trees, kickers, Aiguille du Midi pitons, and GPU ground shadows (1:1 parity with terrain_renderer.js!)
  const sharedUniforms = {
    uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.5) },
    uSunElev: { value: 0.36 },
    uSunColor: { value: new THREE.Color(1.0, 0.94, 0.85) },
    uSunIntensity: { value: 2.15 },
    uShadowSky: { value: new THREE.Color(0.32, 0.48, 0.78) },
    uShadowFill: { value: 0.64 },
    uGroundBounce: { value: new THREE.Color(0.46, 0.56, 0.74) },
    uSSSColor: { value: new THREE.Color(0.14, 0.48, 0.90) },
    uCloudShadowStrength: { value: 0.44 },
    uValleyCloudAlt: { value: 1480.0 },
    uValleyCloudDensity: { value: 0.68 },
    uHorizonBlend: { value: new THREE.Vector4(0, 0, 1, 0) },
    uFogColor: { value: new THREE.Color(0.42, 0.57, 0.78) },
    uFogDensity: { value: 0.000046 },
    uCamPos: { value: new THREE.Vector3() },
    uStorm: { value: 0.0 },
    uTime: { value: 0.0 },
    uTwilight: { value: 0.0 },
  };

  // Triplanar normal-mapped shader with EXACT 1:1 terrain_renderer.js lighting parity:
  //  - Supports BOTH InstancedMesh (`isInstanced=true`) and single Mesh (`isInstanced=false`, e.g. Aiguille du Midi pitons & stake snow mounds!)
  //  - True scale-corrected inverse-transpose normals for non-uniformly scaled instances!
  //  - Per-fragment 4-azimuth mountain horizon self-shadowing (uCoreAux1/uCoreAux2)
  //  - Per-fragment 16-azimuth DEM Sky-View Factor AO (uCoreDem.b)
  //  - Per-fragment drifting cloud shadow bands (cloudShadowAt matching terrain 1:1!)
  //  - Preset-coupled uSSSColor & uSunColor directional backlit scatter (ZERO neon glow in shadow/alpenglow/storm!)
  //  - Forward-scatter sun-tinted aerial perspective + valley mist matching terrain 1:1!
  const makePropMat = (mode, isInstanced = true) => new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uMode: { value: mode },
      uGraniteAlbedo: { value: terrainData.textures.graniteAlbedo },
      uGraniteNormal: { value: terrainData.textures.graniteNormal },
      uIceNormal: { value: terrainData.textures.iceNormal },
      uSnowNormal: { value: terrainData.textures.snowNormal },
      uSnowCavity: { value: terrainData.textures.snowCavity },
      uCoreDem: { value: terrainData.textures.coreDem },
      uCoreAux1: { value: terrainData.textures.coreAux1 },
      uCoreAux2: { value: terrainData.textures.coreAux2 },
    },
    vertexShader: isInstanced ? /* glsl */ `
      attribute vec3 aProp; // x = expose [0=snow collar/cap .. 1=bare rock/ice], y = cavityAO, z = strataSeed
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vProp;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        // True inverse-transpose normal transform for orthogonal rotation + non-uniform scale (prevents skewed lighting!)
        vec3 c0 = instanceMatrix[0].xyz;
        vec3 c1 = instanceMatrix[1].xyz;
        vec3 c2 = instanceMatrix[2].xyz;
        vec3 invSq = vec3(1.0 / max(1e-5, dot(c0, c0)), 1.0 / max(1e-5, dot(c1, c1)), 1.0 / max(1e-5, dot(c2, c2)));
        mat3 nMat = mat3(c0 * invSq.x, c1 * invSq.y, c2 * invSq.z);
        vWorldNormal = normalize(nMat * normal);
        vWorldPos = wp.xyz;
        vProp = aProp;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    ` : /* glsl */ `
      attribute vec3 aProp;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vProp;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 c0 = modelMatrix[0].xyz;
        vec3 c1 = modelMatrix[1].xyz;
        vec3 c2 = modelMatrix[2].xyz;
        vec3 invSq = vec3(1.0 / max(1e-5, dot(c0, c0)), 1.0 / max(1e-5, dot(c1, c1)), 1.0 / max(1e-5, dot(c2, c2)));
        mat3 nMat = mat3(c0 * invSq.x, c1 * invSq.y, c2 * invSq.z);
        vWorldNormal = normalize(nMat * normal);
        vWorldPos = wp.xyz;
        vProp = aProp;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uGraniteAlbedo;
      uniform sampler2D uGraniteNormal;
      uniform sampler2D uIceNormal;
      uniform sampler2D uSnowNormal;
      uniform sampler2D uSnowCavity;
      uniform sampler2D uCoreDem;
      uniform sampler2D uCoreAux1;
      uniform sampler2D uCoreAux2;
      uniform vec3 uSunDir;
      uniform float uSunElev;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform vec3 uShadowSky;
      uniform float uShadowFill;
      uniform vec3 uGroundBounce;
      uniform vec3 uSSSColor;
      uniform float uCloudShadowStrength;
      uniform float uValleyCloudAlt;
      uniform float uValleyCloudDensity;
      uniform vec4 uHorizonBlend;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform vec3 uCamPos;
      uniform float uStorm;
      uniform float uTime;
      uniform float uTwilight;
      uniform float uMode;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vProp;

      const float CORE_HALF = ${CORE_HALF.toFixed(1)};

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      // Exact match to terrain_renderer.js cloudShadowAt()!
      float cloudShadowAt(vec2 xz, float t) {
        vec2 p = (xz - vec2(t * 22.0, t * 8.5)) * 0.00052;
        float n = vnoise2(p) * 0.62 + vnoise2(p * 2.15 + vec2(7.3, -4.1)) * 0.38;
        return smoothstep(0.50, 0.78, n);
      }

      vec3 blendTriNormal(vec3 baseN, vec3 nX, vec3 nY, vec3 nZ, vec3 w, float strength) {
        vec3 wnX = vec3(0.0, nX.y, nX.x);
        vec3 wnY = vec3(nY.x, 0.0, nY.y);
        vec3 wnZ = vec3(nZ.x, nZ.y, 0.0);
        return normalize(baseN + (wnX * w.x + wnY * w.y + wnZ * w.z) * strength);
      }

      void main() {
        vec3 baseN = normalize(vWorldNormal);
        vec3 L = normalize(uSunDir);
        vec3 V = normalize(uCamPos - vWorldPos);
        float dist = length(vWorldPos - uCamPos);
        float closeFade = 1.0 - smoothstep(18.0, 180.0, dist);
        float expose = clamp(vProp.x, 0.0, 1.0);
        float cavVertAO = clamp(vProp.y, 0.20, 1.05);

        // Per-fragment real Chamonix terrain horizon shadow, DEM Sky-View Factor AO & drifting cloud shadow (1:1 with terrain_renderer.js!)
        vec2 xz = vWorldPos.xz;
        vec2 pUv = clamp((xz + CORE_HALF) / (2.0 * CORE_HALF), 0.0, 1.0);
        vec3 aux1 = texture2D(uCoreAux1, pUv).rgb;
        vec3 aux2 = texture2D(uCoreAux2, pUv).rgb;
        float demAO = texture2D(uCoreDem, pUv).b;
        float hAng = dot(vec4(aux1.g, aux1.b, aux2.r, aux2.g) * 1.5707963, uHorizonBlend);
        float mtnShadow = smoothstep(-0.020, 0.044, uSunElev - hAng);
        mtnShadow = mix(mtnShadow, 0.32, uStorm * 0.85);
        float csh = cloudShadowAt(xz, uTime) * uCloudShadowStrength * (1.0 - uStorm * 0.8);
        float directVis = mtnShadow * (1.0 - csh);
        float envAO = mix(0.42, 1.0, pow(demAO, 1.05));

        // fp32-safe modular world coords prevent precision striping at ±6400m
        vec3 wp = mod(vWorldPos, 64.0);
        vec3 w = pow(abs(baseN), vec3(4.0));
        w /= max(w.x + w.y + w.z, 1e-4);

        vec3 N = baseN;
        vec3 alb = vec3(0.84, 0.88, 0.92);
        vec3 sss = vec3(0.0);
        vec3 spec = vec3(0.0);
        vec3 H = normalize(L + V);
        float propSnowMask = 0.0;

        if (uMode < 0.5) {
          // 0. Triplanar Chamonix Protogine Granite Outcrop with snow-drift base collar & crisp snow top-ledge cap!
          float s = 0.24;
          vec2 uvX = vec2(wp.z * s + wp.y * 0.08, wp.y * s);
          vec2 uvY = wp.xz * s;
          vec2 uvZ = vec2(wp.x * s - wp.y * 0.08, wp.y * s);

          vec3 cX = texture2D(uGraniteAlbedo, uvX).rgb;
          vec3 cY = texture2D(uGraniteAlbedo, uvY).rgb;
          vec3 cZ = texture2D(uGraniteAlbedo, uvZ).rgb;
          vec3 cMacro = texture2D(uGraniteAlbedo, wp.xz * 0.065 + vec2(wp.y * 0.04, -wp.y * 0.03)).rgb;
          vec3 granTex = (cX * w.x + cY * w.y + cZ * w.z) * (0.58 + 0.72 * cMacro);

          vec3 nX = texture2D(uGraniteNormal, uvX).xyz * 2.0 - 1.0;
          vec3 nY = texture2D(uGraniteNormal, uvY).xyz * 2.0 - 1.0;
          vec3 nZ = texture2D(uGraniteNormal, uvZ).xyz * 2.0 - 1.0;
          vec3 rockN = blendTriNormal(baseN, nX, nY, nZ, w, 0.92 * (0.45 + 0.55 * closeFade));

          vec2 sUv = wp.xz * 0.26;
          vec3 sN = texture2D(uSnowNormal, sUv).xyz * 2.0 - 1.0;
          float sCav = texture2D(uSnowCavity, sUv).r;
          vec3 snowN = normalize(baseN + vec3(sN.x, 0.0, sN.y) * (0.28 * closeFade + 0.08));

          float topSnow = smoothstep(0.66, 0.88, baseN.y + (rockN.y - baseN.y) * 0.35 + (cMacro.r - 0.5) * 0.16);
          float snowMask = clamp(max(topSnow, 1.0 - expose), 0.0, 1.0);
          float creviceAO = smoothstep(0.14, 0.68, granTex.r);
          vec3 granAlb = granTex * vec3(0.38, 0.37, 0.41) * mix(vec3(0.28, 0.32, 0.42), vec3(1.26, 1.12, 0.98), creviceAO);
          vec3 snowAlb = mix(vec3(0.78, 0.83, 0.89), vec3(0.89, 0.92, 0.96), sCav * 0.45 + 0.45);
          alb = mix(granAlb, snowAlb, snowMask);
          N = normalize(mix(rockN, snowN, snowMask));

          float NdotH = max(0.0, dot(N, H));
          float micaSpec = pow(NdotH, 34.0) * (0.20 + 0.28 * (1.0 - creviceAO)) * (1.0 - snowMask);
          float snowSpec = pow(NdotH, 24.0) * 0.22 * snowMask;
          spec = uSunColor * (micaSpec + snowSpec) * uSunIntensity * directVis * 0.48 * (1.0 - uStorm * 0.82);
        } else if (uMode < 1.5) {
          // 1. Authentic Chamonix Vallée Blanche Glacial Serac Icefall:
          //    Mostly compressed frosted white-grey firn snow & fractured pale icy slate!
          //    Subtle cool glacial blue ONLY emerges inside deep fractured cavities & shaded overhangs (NEVER bright neon aqua!)
          float s1 = 0.22;
          float s2 = 0.068;
          vec2 uvX = vec2(wp.z * s1, wp.y * s1 * 1.15);
          vec2 uvY = wp.xz * s1;
          vec2 uvZ = vec2(wp.x * s1, wp.y * s1 * 1.15);
          vec3 nX = texture2D(uIceNormal, uvX).xyz * 2.0 - 1.0;
          vec3 nY = texture2D(uIceNormal, uvY).xyz * 2.0 - 1.0;
          vec3 nZ = texture2D(uIceNormal, uvZ).xyz * 2.0 - 1.0;
          vec3 nMacro = texture2D(uIceNormal, wp.xz * s2 + vec2(wp.y * s2, -wp.y * s2)).xyz * 2.0 - 1.0;

          // Organic glacier fracture micro-grain & vertical dust/conchoidal veining
          float gX = texture2D(uGraniteAlbedo, vec2(wp.z * 0.16, wp.y * 0.24)).r;
          float gZ = texture2D(uGraniteAlbedo, vec2(wp.x * 0.16, wp.y * 0.24)).r;
          float gY = texture2D(uGraniteAlbedo, wp.xz * 0.16).r;
          float iceGrain = gX * w.x + gY * w.y + gZ * w.z;

          vec3 iceN = normalize(blendTriNormal(baseN, nX, nY, nZ, w, 0.94 * (0.42 + 0.58 * closeFade))
                              + vec3(nMacro.x, nMacro.y * 0.35, nMacro.z) * 0.26);

          vec2 sUv = wp.xz * 0.18 + vec2(wp.y * 0.07, -wp.y * 0.05);
          vec3 sN = texture2D(uSnowNormal, sUv).xyz * 2.0 - 1.0;
          float sCav = texture2D(uSnowCavity, sUv).r;
          vec3 snowN = normalize(baseN + vec3(sN.x, 0.0, sN.y) * (0.30 * closeFade + 0.09));

          // Combine baked snow collar/cornice cap (expose=0) + upward-facing snow shelves!
          float topShelf = smoothstep(0.68, 0.88, baseN.y + (nMacro.y * 0.12));
          float frostRim = smoothstep(0.58, 0.88, iceGrain) * 0.28;
          float snowMask = clamp(max(topShelf, 1.0 - expose), 0.0, 1.0);
          propSnowMask = snowMask;

          // Authentic natural glacier ice stratification (layered horizontal firn bands & vertical conchoidal fractures)
          float firnNoise = vnoise2(vec2(wp.y * 1.15 + vProp.z * 7.0, (wp.x + wp.z) * 0.18));
          float firnBand = smoothstep(0.24, 0.74, firnNoise + (iceGrain - 0.5) * 0.44);
          float crackDark = smoothstep(0.18, 0.58, iceGrain);

          // Real physical glacier reflectance:
          //  - Sunlit outer fractured firn is dusty frosted off-white / pale icy blue-grey (adapts cleanly to Alpenglow rose, Afternoon warm cream, Storm flat grey!)
          //  - Deep muted glacier slate-cerulean appears strictly inside recessed cavity crevices & overhangs!
          vec3 cleftBlue  = vec3(0.20, 0.37, 0.54);
          vec3 firnMid    = vec3(0.54, 0.67, 0.78);
          vec3 frostedIce = vec3(0.79, 0.85, 0.90);
          float deepMask = clamp((1.0 - cavVertAO) * 1.55 + (1.0 - crackDark) * 0.58, 0.0, 1.0);
          vec3 iceAlb = mix(firnMid, frostedIce, clamp(firnBand * 0.58 + frostRim, 0.0, 1.0));
          iceAlb = mix(iceAlb, cleftBlue, deepMask * 0.78);
          // Subtle pale turquoise-slate hue shift only where thick sunlit ice absorbs red internally (never neon!)
          vec3 snowAlb = mix(vec3(0.78, 0.83, 0.89), vec3(0.89, 0.92, 0.96), sCav * 0.45 + 0.45);
          alb = mix(iceAlb, snowAlb, snowMask);
          N = normalize(mix(iceN, snowN, snowMask));

          // Strictly sunlight-coupled, preset-adaptive subsurface scattering (drops cleanly to 0 in shadow & storm, tints warm in Alpenglow!)
          float NdotV = max(0.0, dot(N, V));
          float fres = pow(1.0 - NdotV, 3.6);
          float back = pow(clamp(dot(V, -L + N * 0.44), 0.0, 1.0), 3.2);
          float sunLum = dot(uSunColor, vec3(0.299, 0.587, 0.114));
          vec3 sssTint = mix(uSSSColor, uSunColor * vec3(0.52, 0.78, 1.0), 0.32);
          sss = sssTint * (back * 0.30 + fres * 0.05) * (1.0 - snowMask * 0.65) * directVis * sunLum * (1.0 - uStorm * 0.85);

          float NdotH = max(0.0, dot(N, H));
          float iceSpec = (pow(NdotH, 54.0) * 0.36 + pow(NdotH, 16.0) * 0.14) * (1.0 - snowMask * 0.65);
          float snowSpec = pow(NdotH, 24.0) * 0.22 * snowMask;
          spec = mix(uSunColor, vec3(0.95, 0.98, 1.0), 0.25) * (iceSpec + snowSpec) * uSunIntensity * directVis * 0.44 * (1.0 - uStorm * 0.82);
        } else {
          // 3. Natural sculpted snow wind-lip kicker (dual-scale sastrugi normal + cavity AO + glossy cornice gleam!)
          vec2 uv1 = wp.xz * 0.14;
          vec2 uv2 = wp.xz * 0.42;
          vec3 sN1 = texture2D(uSnowNormal, uv1).xyz * 2.0 - 1.0;
          vec3 sN2 = texture2D(uSnowNormal, uv2).xyz * 2.0 - 1.0;
          float c1 = texture2D(uSnowCavity, uv1).r;
          float c2 = texture2D(uSnowCavity, uv2).r;
          float cav = c1 * 0.60 + c2 * 0.40;
          N = normalize(baseN + vec3(sN1.x, 0.0, sN1.y) * 0.26 + vec3(sN2.x, 0.0, sN2.y) * (0.22 * closeFade));
          alb = mix(vec3(0.78, 0.83, 0.89), vec3(0.89, 0.92, 0.96), cav * 0.48 + clamp(N.y * 0.5 + 0.5, 0.0, 1.0) * 0.32 + 0.20);
          float back = pow(clamp(dot(V, -L + N * 0.38), 0.0, 1.0), 3.0);
          sss = uSSSColor * back * 0.28 * directVis * (1.0 - uStorm * 0.78);
          float NdotH = max(0.0, dot(N, H));
          float fres = pow(1.0 - max(0.0, dot(N, V)), 3.2);
          spec = uSunColor * (pow(NdotH, 28.0) * 0.26 + fres * 0.12) * uSunIntensity * directVis * 0.44 * (1.0 - uStorm * 0.82);
        }

        // Exact 1:1 terrain_renderer.js lighting hierarchy!
        float NdotL = max(0.0, dot(N, L));
        float wrapN = max(0.0, (dot(N, L) + 0.06) / 1.06);
        float diff = (uMode < 0.5) ? NdotL : mix(NdotL, wrapN, 0.14);
        // Baked inter-slab crevice occlusion shadows direct sun softly inside tight serac fissures
        float localDirectAO = mix(0.32, 1.0, smoothstep(0.24, 0.82, cavVertAO));
        vec3 direct = uSunColor * uSunIntensity * diff * directVis * localDirectAO;

        float skyFactor = clamp(0.42 + 0.58 * N.y, 0.16, 1.0);
        float shadowMicro = clamp(0.76 + 0.30 * dot(N, normalize(vec3(-L.x, 0.72, -L.z))), 0.56, 1.22);
        vec3 fill = mix(uGroundBounce * 0.64, uShadowSky, skyFactor) * uShadowFill * envAO * cavVertAO * shadowMicro;

        // Subtle deeper alpine blue-cyan glacial translucency strictly on EXPOSED sheared ice walls (NEVER glowing on snow collars/caps!)
        if (uMode > 0.5 && uMode < 1.5) {
          float iceOnly = 1.0 - propSnowMask;
          float cleftShade = (1.0 - clamp(cavVertAO, 0.22, 1.0)) * (1.0 - clamp(NdotL * directVis, 0.0, 1.0));
          fill *= mix(vec3(1.0), vec3(0.76, 0.94, 1.16), cleftShade * 0.72 * iceOnly * (1.0 - uStorm * 0.75));
          // Calibrated internal glacial sky-scatter ONLY on exposed sheared ice faces so Alpenglow seracs stay sculptural & deep
          float iceLift = iceOnly * (1.0 - uStorm * 0.75) * (0.04 + 0.10 * uTwilight) * (1.0 - clamp(NdotL * directVis, 0.0, 1.0));
          fill += mix(uShadowSky * 0.65, uSSSColor * 0.55 + vec3(0.05, 0.16, 0.28), 0.55) * iceLift * (0.45 + 0.55 * clamp(cavVertAO, 0.25, 1.0));
        }

        vec3 col = alb * (direct + fill) + sss + spec;

        // Exact 1:1 terrain_renderer.js aerial perspective (altitude haze + sun forward scatter + low-valley mist!)
        float distFog = clamp(1.0 - exp(-dist * uFogDensity * (1.0 + 0.25 * max(0.0, (2500.0 - vWorldPos.y) / 1500.0))), 0.0, 0.94);
        float sunScatter = pow(max(0.0, dot(-V, L)), 4.0) * (1.0 - uStorm * 0.9);
        vec3 aerialCol = mix(uFogColor, mix(uFogColor, uSunColor * 1.08, 0.52), sunScatter);
        col = mix(col, aerialCol, distFog);

        if (vWorldPos.y < uValleyCloudAlt + 260.0) {
          float hBand = 1.0 - smoothstep(uValleyCloudAlt - 180.0, uValleyCloudAlt + 260.0, vWorldPos.y);
          float mistNoise = 0.65 + 0.35 * vnoise2(xz * 0.0008 + vec2(uTime * 0.006, 0.0));
          float mistScale = mix(1.0, 0.56, uTwilight);
          float valleyFog = clamp(hBand * uValleyCloudDensity * mistNoise * mistScale * smoothstep(140.0, 900.0, dist), 0.0, 0.90);
          vec3 cloudMistCol = mix(uShadowSky * 1.15, vec3(0.94, 0.96, 0.99) * (0.55 + 0.45 * uSunColor), 0.62);
          col = mix(col, cloudMistCol, valleyFog);
        }

        // Alpha = 0.55 marks opaque world geometry (blurs with world AND cleanly occludes god-rays!)
        gl_FragColor = vec4(col, 0.55);
      }
    `,
  });

  // 1. Iconic Aiguille du Midi summit station, bridge & animated Téléphérique cable cars!
  // Uses triplanar Protogine granite + snow-ledge shader matching the mountain crest 1:1 (ZERO flat grey prism seams!).
  let midiStation = null;
  if (terrainData.meta && terrainData.meta.aiguilleSpire) {
    const pitonMat = makePropMat(0, false);
    midiStation = buildAiguilleDuMidiStation(terrainData.meta.aiguilleSpire, terrainData, pitonMat);
    group.add(midiStation.group);
  }

  // 2. Grounded drop-in wooden safety stakes marking launch terraces (2 poles flanking each drop-in):
  //  - Orange marker collar is parented directly inside pole local space so tilt stays coaxial!
  //  - Deeply buried (-0.55m) with a terrain-matched snow-drift base mound collar + GPU cast shadow!
  const stakeGeo = new THREE.CylinderGeometry(0.044, 0.054, 2.65, 8);
  const stakeMat = markWorldOpaque(new THREE.MeshStandardMaterial({ color: 0x4b392b, roughness: 0.86 }));
  const bandGeo = new THREE.CylinderGeometry(0.049, 0.050, 0.28, 8);
  const bandMat = markWorldOpaque(new THREE.MeshStandardMaterial({ color: 0xe05222, roughness: 0.52 }));
  // Low, subtle slope-aligned packed snow collar around wooden stake base (never a bright floating puffball!)
  const moundGeo = new THREE.SphereGeometry(0.18, 12, 8);
  const mPos = moundGeo.attributes.position;
  const mProps = new Float32Array(mPos.count * 3);
  for (let i = 0; i < mPos.count; i++) {
    const my = mPos.getY(i);
    mPos.setY(i, my > 0 ? my * 0.16 : my * 0.85);
    mProps[i * 3] = 0.0;
    mProps[i * 3 + 1] = 0.80;
    mProps[i * 3 + 2] = 0.5;
  }
  moundGeo.computeVertexNormals();
  moundGeo.setAttribute('aProp', new THREE.BufferAttribute(mProps, 3));
  const moundMat = makePropMat(2, false);
  const stakeUp = new THREE.Vector3(0, 1, 0);
  const stakeSlopeN = new THREE.Vector3();

  for (const dz of terrainData.meta.dropZones) {
    const rightX = Math.cos(dz.yaw);
    const rightZ = Math.sin(dz.yaw);
    for (const side of [-4.2, 4.2]) {
      const px = dz.x + rightX * side;
      const pz = dz.z + rightZ * side;
      const ts = terrainData.sampleTerrain(px, pz);
      const py = ts.y;
      const pole = new THREE.Mesh(stakeGeo, stakeMat);
      pole.position.set(px, py + 0.78, pz); // height 2.65 -> spans [py - 0.545 .. py + 2.105] (never floats on steep 35° slopes!)
      pole.rotation.z = side > 0 ? -0.045 : 0.045;
      pole.castShadow = true;
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.set(0, 1.02, 0); // coaxial child of pole!
      band.castShadow = true;
      pole.add(band);
      group.add(pole);

      const mound = new THREE.Mesh(moundGeo, moundMat);
      stakeSlopeN.set(ts.nx, ts.ny, ts.nz).normalize();
      mound.quaternion.setFromUnitVectors(stakeUp, stakeSlopeN);
      mound.position.set(px - stakeSlopeN.x * 0.008, py - stakeSlopeN.y * 0.008, pz - stakeSlopeN.z * 0.008);
      group.add(mound);

      shadows.push({
        x: px, y: py, z: pz,
        nx: ts.nx, ny: ts.ny, nz: ts.nz,
        radius: 0.34, height: 2.1, opacity: 0.72,
        kind: 3, // slim wooden marker stake shadow
      });
    }
  }

  // 3. True 3D Volumetric Snow-Laden Alpine Norway Spruces (3 instanced geometry variants: Tall, Broad, Far)
  // ZERO flat cardboard cutouts, ZERO stacked smooth cones — genuine layered drooping 3D boughs & sculpted snow pillows!
  const treeMat = new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uSnowNormal: { value: terrainData.textures.snowNormal },
      uSnowCavity: { value: terrainData.textures.snowCavity },
      uCoreAux1: { value: terrainData.textures.coreAux1 },
      uCoreAux2: { value: terrainData.textures.coreAux2 },
    },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec3 aMat;  // x = matType (0=bark, 1=needles, 2=snowPillow), y = coreAO, z = hNorm
      attribute float aTint;
      uniform sampler2D uCoreAux1;
      uniform sampler2D uCoreAux2;
      uniform vec4 uHorizonBlend;
      uniform float uSunElev;
      uniform float uStorm;
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vMat;
      varying float vTint;
      varying float vMtnSun;
      const float CORE_HALF = ${CORE_HALF.toFixed(1)};
      void main() {
        vMat = aMat;
        vTint = aTint;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        mat3 nMat = mat3(instanceMatrix);
        vWorldNormal = normalize(nMat * normal);
        // Sample real mountain horizon self-shadow at tree base so spruces in valley shadow NEVER glow sunlit!
        vec2 tXZ = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
        // Organic elastic cantilever alpine wind-sway + outer bough tip micro-flutter (stronger in Alpine Squall!)
        float phase = mod(tXZ.x * 0.13 + tXZ.y * 0.17, 62.83) + aTint * 6.283;
        float gust = sin(uTime * 1.15 + phase + sin(uTime * 0.42 + mod(tXZ.x, 128.0) * 0.05))
                   + 0.42 * sin(uTime * 2.35 + phase * 1.6);
        float bendMask = pow(clamp(aMat.z, 0.0, 1.0), 1.65);
        float swayAmp = mix(0.11, 0.46, uStorm);
        vec2 windDir = vec2(0.84, 0.54);
        vec2 crossDir = vec2(-0.54, 0.84);
        float lat = sin(uTime * 1.65 + phase * 1.3) * swayAmp * 0.34 * bendMask;
        float tipMask = smoothstep(0.45, 0.98, aMat.y) * smoothstep(0.08, 0.48, aMat.z);
        float flutter = sin(uTime * 4.6 + position.x * 2.1 + position.z * 2.4 + phase) * tipMask * mix(0.028, 0.11, uStorm);
        wp.xz += windDir * (gust * swayAmp * bendMask + flutter) + crossDir * lat;
        wp.y  -= abs(gust * swayAmp * bendMask) * 0.08 + flutter * 0.30;
        vWorldPos = wp.xyz;
        vec2 pUv = clamp((tXZ + CORE_HALF) / (2.0 * CORE_HALF), 0.0, 1.0);
        vec3 aux1 = texture2D(uCoreAux1, pUv).rgb;
        vec3 aux2 = texture2D(uCoreAux2, pUv).rgb;
        float hAng = dot(vec4(aux1.g, aux1.b, aux2.r, aux2.g) * 1.5707963, uHorizonBlend);
        float mtnSun = smoothstep(-0.025, 0.045, uSunElev - hAng);
        vMtnSun = mix(mtnSun, 0.30, uStorm * 0.85);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uSnowNormal;
      uniform sampler2D uSnowCavity;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform vec3 uShadowSky;
      uniform float uShadowFill;
      uniform vec3 uSSSColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform vec3 uCamPos;
      uniform float uStorm;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vMat;
      varying float vTint;
      varying float vMtnSun;

      float hash31(vec3 p) {
        p = fract(p * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yxz + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float vnoise3(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash31(i);
        float n100 = hash31(i + vec3(1,0,0));
        float n010 = hash31(i + vec3(0,1,0));
        float n110 = hash31(i + vec3(1,1,0));
        float n001 = hash31(i + vec3(0,0,1));
        float n101 = hash31(i + vec3(1,0,1));
        float n011 = hash31(i + vec3(0,1,1));
        float n111 = hash31(i + vec3(1,1,1));
        return mix(
          mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
          mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
          f.z
        );
      }

      void main() {
        vec3 N = normalize(gl_FrontFacing ? vWorldNormal : -vWorldNormal);
        vec3 L = normalize(uSunDir);
        vec3 V = normalize(uCamPos - vWorldPos);
        float dist = length(vWorldPos - uCamPos);
        float matType = vMat.x;
        float coreAO = clamp(vMat.y, 0.16, 1.0);
        float hNorm = clamp(vMat.z, 0.0, 1.0);
        float closeFade = 1.0 - smoothstep(25.0, 180.0, dist);
        float stormVis = mix(1.0, 0.32, uStorm) * vMtnSun;

        vec3 wMod = mod(vWorldPos, 32.0);
        vec3 col;
        if (matType < 0.5) {
          // 1. Furrowed weathered dark alpine spruce bark
          float barkF = vnoise3(vec3(wMod.x * 5.0, wMod.y * 1.4, wMod.z * 5.0));
          vec3 barkAlb = mix(vec3(0.065, 0.044, 0.032), vec3(0.14, 0.098, 0.072), barkF);
          float NdotL = max(0.0, dot(N, L));
          col = barkAlb * (uSunColor * uSunIntensity * NdotL * stormVis * 0.65 + uShadowSky * uShadowFill * 0.42) * (0.45 + 0.55 * coreAO);
        } else if (matType < 1.5) {
          // 2. Feathery 3D evergreen Norway spruce needles with micro-tuft bump normal, ultra-fine needle shimmer & frosted tips!
          float tuft1 = vnoise3(wMod * 3.8);
          float tuft2 = vnoise3(wMod * 10.5);
          float ultraFade = 1.0 - smoothstep(10.0, 56.0, dist);
          float tuft3 = 0.5;
          if (ultraFade > 0.02) {
            tuft3 = vnoise3(wMod * 24.5);
          }
          float needleGrain = tuft1 * 0.46 + tuft2 * 0.34 + mix(0.5, tuft3, ultraFade) * 0.20;

          // Perturb normal at needle-spray scale so boughs look lush, prickly & photographic up close!
          vec3 bN = normalize(N + vec3((tuft1 - 0.5) * 0.58 + (tuft3 - 0.5) * 0.24 * ultraFade,
                                       (tuft2 - 0.5) * 0.44,
                                       (needleGrain - 0.5) * 0.58) * (0.45 + 0.55 * closeFade));

          // Authentic deep dark Chamonix alpine evergreen hue (rich emerald-pine depth against snow pillows!)
          vec3 deepPine = mix(vec3(0.011, 0.036, 0.018), vec3(0.022, 0.054, 0.024), vTint);
          vec3 tipPine  = mix(vec3(0.026, 0.070, 0.034), vec3(0.044, 0.090, 0.042), vTint);
          vec3 needleAlb = mix(deepPine, tipPine, needleGrain * (0.4 + 0.6 * coreAO));

          // Subtle crystalline hoarfrost dusting only very top-facing outer needles (keeps pine deeply green!)
          float frost = smoothstep(0.58, 0.90, bN.y + (needleGrain - 0.52) * 0.38) * smoothstep(0.45, 0.95, coreAO);
          needleAlb = mix(needleAlb, vec3(0.80, 0.85, 0.92), frost * 0.18);

          // Crown vertical AO + deep inner branch core darkening (creates lush layered silhouette!)
          float crownAO = mix(0.32, 1.05, coreAO) * mix(0.68, 1.05, hNorm);
          float wrapSun = clamp((dot(bN, L) + 0.22) / 1.22, 0.0, 1.0);
          vec3 direct = uSunColor * uSunIntensity * wrapSun * stormVis * 0.86;
          vec3 fill = uShadowSky * uShadowFill * (0.36 + 0.64 * clamp(bN.y * 0.5 + 0.5, 0.0, 1.0));

          // Subtle waxy cuticle / hoarfrost needle specular glint when raking sun kisses outer boughs
          vec3 H = normalize(L + V);
          float waxySpec = pow(max(0.0, dot(bN, H)), 28.0) * (0.04 + 0.14 * frost) * coreAO * stormVis;

          // Warm translucent needle rim glow when backlit by alpine sun (pops dramatically alongside god-rays!)
          float back = pow(clamp(dot(V, -L + bN * 0.25), 0.0, 1.0), 2.5) * (1.0 - uStorm * 0.85) * vMtnSun;
          vec3 rim = vec3(0.13, 0.30, 0.13) * uSunColor * back * coreAO * 1.10;
          col = needleAlb * (direct + fill) * crownAO + rim + uSunColor * waxySpec * uSunIntensity;
        } else {
          // 3. Sculpted 3D rounded snow pillow resting atop each bough (matched 1:1 to mountain snow shader!)
          vec2 sUv = wMod.xz * 0.34 + vec2(wMod.y * 0.18, -wMod.y * 0.14);
          vec3 sN = texture2D(uSnowNormal, sUv).xyz * 2.0 - 1.0;
          vec3 sCav = texture2D(uSnowCavity, sUv).rgb;
          vec3 snowN = normalize(N + vec3(sN.x, 0.0, sN.y) * (0.28 * closeFade + 0.08));

          vec3 snowAlb = mix(vec3(0.76, 0.82, 0.90), vec3(0.90, 0.93, 0.97), sCav.r * 0.48 + hNorm * 0.22 + 0.30);
          float NdotL = max(0.0, dot(snowN, L));
          float wrapN = max(0.0, (dot(snowN, L) + 0.10) / 1.10);
          float diff = mix(NdotL, wrapN, 0.18);

          float aoShade = mix(0.62, 1.04, coreAO);
          vec3 direct = uSunColor * uSunIntensity * diff * stormVis * 0.96;
          vec3 fill = uShadowSky * uShadowFill * (0.48 + 0.52 * clamp(snowN.y * 0.5 + 0.5, 0.0, 1.0)) * aoShade;

          // Subtle preset-coupled subsurface scattering through puffed overhanging snow cushions!
          float back = pow(clamp(dot(V, -L + snowN * 0.40), 0.0, 1.0), 2.8) * (1.0 - uStorm * 0.78);
          float rimFres = pow(1.0 - max(0.0, dot(snowN, V)), 3.2);
          vec3 sss = uSSSColor * (back * 0.30 + rimFres * 0.10) * (0.12 + 0.88 * stormVis);
          col = snowAlb * (direct + fill) + sss;
        }

        float fog = clamp(1.0 - exp(-dist * uFogDensity * (1.0 + 0.25 * uStorm)), 0.0, 0.94);
        float sunScatter = pow(max(0.0, dot(-V, L)), 4.0) * (1.0 - uStorm * 0.9);
        vec3 aerialCol = mix(uFogColor, mix(uFogColor, uSunColor * 1.08, 0.52), sunScatter);
        col = mix(col, aerialCol, fog);
        // Alpha = 0.55 marks opaque evergreen foliage/snow for pixel-accurate volumetric god-ray shafts!
        gl_FragColor = vec4(col, 0.55);
      }
    `,
  });

  const geoHeroClose = buildVolumetricSpruceGeometry(4808, 'close');
  const geoHeroTall = buildVolumetricSpruceGeometry(5112, 'tall');
  const geoHeroBroad = buildVolumetricSpruceGeometry(7321, 'broad');
  const geoFar = buildVolumetricSpruceGeometry(9104, 'far');

  const rand = mulberry32(4808);
  const dummy = new THREE.Object3D();
  const listClose = [];
  const listTall = [];
  const listBroad = [];
  const listFar = [];
  const planZone = terrainData.meta.dropZones.find((z) => z.id === 'plan_aiguille') || { x: -1613, z: -2487, yaw: -2.1158 };

  const pushTree = (x, z, forceHero = false) => {
    const s = terrainData.sampleTerrain(x, z);
    if (s.rawY < 1040 || s.rawY > 2265 || s.slopeDeg > 38.5) return false;
    if (Math.hypot(x - planZone.x, z - planZone.z) < 20) return false;
    const altScale = THREE.MathUtils.clamp((2340 - s.rawY) / 480, 0.58, 1.38);
    const sc = (0.78 + rand() * 0.70) * altScale;
    const hScale = sc * (0.90 + rand() * 0.28);
    const yaw = rand() * Math.PI * 2;
    const tint = rand();
    // Anchor y securely down so lowest snow-laden boughs meet steep 35° slopes naturally without downhill rim gaps!
    const slopeSink = 0.62 + Math.max(0, s.slopeDeg - 16) * 0.032;
    const item = { x, y: s.y - slopeSink * sc, z, sc, hScale, yaw, tint };

    const dPlan = Math.hypot(x - planZone.x, z - planZone.z);
    if ((forceHero || dPlan < 230) && listClose.length < 130) {
      listClose.push(item);
      colliders.push({ x, y: s.y, z, r: 0.75 * sc, h: 10.5 * hScale, kind: 'tree' });
    } else if (dPlan < 680 && (listTall.length + listBroad.length) < 880) {
      if (rand() < 0.58) listTall.push(item);
      else listBroad.push(item);
      colliders.push({ x, y: s.y, z, r: 0.75 * sc, h: 10.5 * hScale, kind: 'tree' });
    } else if (listFar.length < 1350) {
      listFar.push(item);
      if (listFar.length < 700) {
        colliders.push({ x, y: s.y, z, r: 0.75 * sc, h: 10.5 * hScale, kind: 'tree' });
      }
    } else {
      return false;
    }

    shadows.push({
      x, y: s.y, z,
      nx: s.nx, ny: s.ny, nz: s.nz,
      radius: 3.15 * sc,
      height: 12.6 * hScale,
      opacity: 0.85,
      kind: 0, // conifer spruce
      seed: rand(),
    });
    return true;
  };

  // Curated foreground framing spruces flanking Plan de l'Aiguille drop-in corridor (wide clean center ski lane!)
  const pFwdX = Math.sin(planZone.yaw || -2.1158), pFwdZ = -Math.cos(planZone.yaw || -2.1158);
  const pRX = Math.cos(planZone.yaw || -2.1158), pRZ = Math.sin(planZone.yaw || -2.1158);
  const heroSeeds = [
    [28, -14], [34, 16], [42, -22], [48, 12], [56, -15], [64, 24],
    [72, -28], [76, 17], [84, -12], [92, 26], [104, -19], [116, 14],
  ];
  for (const [al, ac] of heroSeeds) {
    pushTree(planZone.x + pFwdX * al + pRX * ac, planZone.z + pFwdZ * al + pRZ * ac, true);
  }

  for (let i = 0; i < 5600 && (listClose.length + listTall.length + listBroad.length + listFar.length) < 2350; i++) {
    let x, z;
    if (i < 1150) {
      const along = 32 + rand() * 840;
      const across = (rand() - 0.5) * 640;
      if (along < 95 && Math.abs(across) < 14) continue;
      x = planZone.x + pFwdX * along + pRX * across;
      z = planZone.z + pFwdZ * along + pRZ * across;
    } else if (i < 3000) {
      x = planZone.x - 1650 + rand() * 2600;
      z = planZone.z - 2200 + rand() * 2600;
    } else {
      x = -5600 + rand() * 11200;
      z = -5800 + rand() * 5200;
    }
    pushTree(x, z, false);
  }

  const mountSprucePool = (geo, list) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, treeMat, list.length);
    const tints = new Float32Array(list.length);
    for (let idx = 0; idx < list.length; idx++) {
      const t = list[idx];
      dummy.position.set(t.x, t.y, t.z);
      // Strictly plumb vertical (tiny natural ±0.025 rad lean max — real gravity-aligned conifer!)
      dummy.rotation.set((rand() - 0.5) * 0.03, t.yaw, (rand() - 0.5) * 0.03);
      dummy.scale.set(t.sc, t.hScale, t.sc);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      tints[idx] = t.tint;
    }
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 1));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  };

  mountSprucePool(geoHeroClose, listClose);
  mountSprucePool(geoHeroTall, listTall);
  mountSprucePool(geoHeroBroad, listBroad);
  mountSprucePool(geoFar, listFar);
  const totalTrees = listClose.length + listTall.length + listBroad.length + listFar.length;

  // 4. Protruding Protogine Granite Boulders / Pillow Features along ALL 6 freeride corridors
  const rockGeo = buildRockGeometry(77);
  const rockMat = makePropMat(0);
  const rockList = [];
  for (const dz of terrainData.meta.dropZones) {
    const fwdX = Math.sin(dz.yaw);
    const fwdZ = -Math.cos(dz.yaw);
    const rightX = Math.cos(dz.yaw);
    const rightZ = Math.sin(dz.yaw);
    for (let i = 0; i < 125; i++) {
      const along = 68 + rand() * 1850;
      const across = (rand() - 0.5) * 760;
      if (along < 120 && Math.abs(across) < 34) continue;
      const x = dz.x + fwdX * along + rightX * across;
      const z = dz.z + fwdZ * along + rightZ * across;
      if (Math.abs(x) > 5900 || Math.abs(z) > 5900) continue;
      const s = terrainData.sampleTerrain(x, z);
      if (s.slopeDeg < 18) continue;
      const sc = 1.6 + Math.pow(rand(), 2.0) * 6.2;
      const sy = sc * (0.80 + rand() * 0.38);
      // Seat boulders solidly deep inside steep 25-35° snow slopes so bottom flanks NEVER float!
      const rockSink = sc * (0.28 + Math.max(0, s.slopeDeg - 18) * 0.010);
      rockList.push({ x, y: s.y - rockSink, z, sc, sy, rx: (rand() - 0.5) * 0.24, ry: rand() * Math.PI * 2, rz: (rand() - 0.5) * 0.24 });
      if (rockList.length < 800) {
        colliders.push({ x, y: s.y, z, r: sc * 0.78, h: sy * 0.95, kind: 'rock' });
      }
      shadows.push({
        x, y: s.y, z,
        nx: s.nx, ny: s.ny, nz: s.nz,
        radius: sc * 0.96,
        height: sy * 1.15,
        opacity: 0.58,
        kind: 1, // granite boulder
        seed: rand(),
      });
    }
  }
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockList.length);
  rockList.forEach((r, idx) => {
    dummy.position.set(r.x, r.y, r.z);
    dummy.rotation.set(r.rx, r.ry, r.rz);
    dummy.scale.set(r.sc * (0.9 + rand() * 0.45), r.sy, r.sc * (0.9 + rand() * 0.45));
    dummy.updateMatrix();
    rockMesh.setMatrixAt(idx, dummy.matrix);
  });
  rockMesh.instanceMatrix.needsUpdate = true;
  rockMesh.frustumCulled = false;
  group.add(rockMesh);

  // 5. Clustered Multi-Slab Glacial Icefall / Serac Ridges along Vallée Blanche & steep glacier breaks (2,520–3,700 m)
  // Placed along genuine convex icefall contours perpendicular to fall-line (ZERO isolated neon cubes on blank powder bowls!)
  const seracGeo = buildSeracClusterGeometry(311);
  const seracMat = makePropMat(1);
  const seracList = [];
  const valleeDz = terrainData.meta.dropZones.find((z) => z.id === 'vallee_blanche') || { x: -587.5, z: 172.3, yaw: 2.0672 };

  const pushSerac = (x, z, scOverride = null) => {
    if (Math.abs(x) > 5800 || Math.abs(z) > 5800) return false;
    const s = terrainData.sampleTerrain(x, z);
    if (scOverride === null && (s.rawY < 2520 || s.rawY > 3680 || s.slopeDeg < 22 || s.slopeDeg > 42 || s.curv < 0.49)) {
      return false;
    }
    for (const prev of seracList) {
      if (Math.hypot(x - prev.x, z - prev.z) < 95) return false; // clean spacing between multi-slab icefall ridges
    }
    const gLen = Math.hypot(s.gx, s.gz);
    // Align fractured icefall ridge perpendicular to slope fall-line (real glacier transverse crevasse orientation!)
    const contourYaw = gLen > 0.05 ? Math.atan2(s.gx, -s.gz) + (rand() - 0.5) * 0.45 : rand() * Math.PI * 2;
    const sc = scOverride ?? (3.4 + rand() * 5.2);
    const seracSink = sc * (0.28 + Math.max(0, s.slopeDeg - 18) * 0.018);
    seracList.push({ x, y: s.y - seracSink, z, sc, ry: contourYaw, slopeDeg: s.slopeDeg, nx: s.nx, ny: s.ny, nz: s.nz });
    colliders.push({ x, y: s.y, z, r: sc * 1.45, h: sc * 1.25, kind: 'serac' });
    shadows.push({
      x, y: s.y, z,
      nx: s.nx, ny: s.ny, nz: s.nz,
      radius: sc * 1.75,
      height: sc * 1.35,
      opacity: 0.70,
      kind: 2, // glacial serac ridge
      seed: rand(),
    });
    return true;
  };

  // Curated hero icefall serac formations flanking classic Vallée Blanche descent (wide clean center ski lane!)
  const vbFx = Math.sin(valleeDz.yaw), vbFz = -Math.cos(valleeDz.yaw);
  const vbRx = Math.cos(valleeDz.yaw), vbRz = Math.sin(valleeDz.yaw);
  const heroSeracSeeds = [
    [165, -72, 5.2],
    [290, 96, 6.0],
    [435, -110, 6.8],
  ];
  for (const [al, ac, scVal] of heroSeracSeeds) {
    pushSerac(valleeDz.x + vbFx * al + vbRx * ac, valleeDz.z + vbFz * al + vbRz * ac, scVal);
  }

  for (let i = 0; i < 650 && seracList.length < 48; i++) {
    const x = -2500 + rand() * 4800;
    const z = -1000 + rand() * 4200;
    let tooClose = false;
    for (const dz of terrainData.meta.dropZones) {
      if (Math.hypot(x - dz.x, z - dz.z) < 110) tooClose = true;
    }
    if (tooClose) continue;
    pushSerac(x, z, null);
  }

  const seracMesh = new THREE.InstancedMesh(seracGeo, seracMat, Math.max(1, seracList.length));
  const seracUp = new THREE.Vector3(0, 1, 0);
  const seracSlopeN = new THREE.Vector3();
  const seracTiltQ = new THREE.Quaternion();
  const seracYawQ = new THREE.Quaternion();
  seracList.forEach((b, idx) => {
    dummy.position.set(b.x, b.y, b.z);
    // Tilt serac ridge ~46% into the glacier slope normal so downhill collar embeds solidly into 25-40° slopes!
    seracSlopeN.set(b.nx, b.ny, b.nz).lerp(seracUp, 0.54).normalize();
    seracTiltQ.setFromUnitVectors(seracUp, seracSlopeN);
    seracYawQ.setFromAxisAngle(seracUp, b.ry);
    dummy.quaternion.copy(seracTiltQ).multiply(seracYawQ);
    dummy.scale.set(b.sc * (0.95 + rand() * 0.25), b.sc * (0.85 + rand() * 0.30), b.sc * (0.90 + rand() * 0.20));
    dummy.updateMatrix();
    seracMesh.setMatrixAt(idx, dummy.matrix);
  });
  dummy.quaternion.identity();
  seracMesh.count = seracList.length;
  seracMesh.instanceMatrix.needsUpdate = true;
  seracMesh.frustumCulled = false;
  group.add(seracMesh);

  // 6. Natural Freeride Wind-Lip / Cornice Kickers along all 6 drop zones!
  const kickerGeo = buildWindLipKickerGeometry();
  const kickerMat = makePropMat(3);
  const kickerTransforms = [];
  const upVec = new THREE.Vector3(0, 1, 0);
  const tmpN = new THREE.Vector3();
  const tmpFwd = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const tmpMat = new THREE.Matrix4();

  for (const dz of terrainData.meta.dropZones) {
    const fwdX = Math.sin(dz.yaw);
    const fwdZ = -Math.cos(dz.yaw);
    const rightX = Math.cos(dz.yaw);
    const rightZ = Math.sin(dz.yaw);
    const placements = [
      { along: 135, across: 14, sc: 1.05 },
      { along: 280, across: -24, sc: 1.25 },
      { along: 460, across: 28, sc: 1.35 },
      { along: 680, across: -36, sc: 1.4 },
      { along: 940, across: 18, sc: 1.3 },
    ];
    for (const pl of placements) {
      const x = dz.x + fwdX * pl.along + rightX * pl.across;
      const z = dz.z + fwdZ * pl.along + rightZ * pl.across;
      if (Math.abs(x) > 5800 || Math.abs(z) > 5800) continue;
      const s = terrainData.sampleTerrain(x, z);
      if (s.slopeDeg > 41 || s.slopeDeg < 11) continue;
      // Local fall-line orientation
      const gLen = Math.hypot(s.gx, s.gz);
      const kx = gLen > 0.08 ? -s.gx / gLen : fwdX;
      const kz = gLen > 0.08 ? -s.gz / gLen : fwdZ;
      kickerTransforms.push({ x, y: s.y - 0.12, z, nx: s.nx, ny: s.ny, nz: s.nz, kx, kz, sc: pl.sc });
      kickers.push({
        x, y: s.y, z,
        fwdX: kx, fwdZ: kz,
        radius: 4.8 * pl.sc,
        rampSlope: 0.21 + 0.035 * pl.sc,
        boost: 2.8 + 0.8 * pl.sc,
        width: 4.0 * pl.sc,
      });
    }
  }
  const kickerMesh = new THREE.InstancedMesh(kickerGeo, kickerMat, Math.max(1, kickerTransforms.length));
  kickerTransforms.forEach((k, idx) => {
    tmpN.set(k.nx, k.ny, k.nz).normalize();
    tmpFwd.set(k.kx, 0, k.kz);
    tmpFwd.addScaledVector(tmpN, -tmpFwd.dot(tmpN)).normalize();
    tmpRight.crossVectors(tmpFwd, tmpN).normalize();
    const trueUp = new THREE.Vector3().crossVectors(tmpRight, tmpFwd).normalize();
    tmpMat.makeBasis(tmpRight, trueUp, tmpFwd.clone().negate());
    dummy.position.set(k.x, k.y, k.z);
    dummy.quaternion.setFromRotationMatrix(tmpMat);
    dummy.scale.set(k.sc, k.sc * 0.9, k.sc);
    dummy.updateMatrix();
    kickerMesh.setMatrixAt(idx, dummy.matrix);
  });
  kickerMesh.count = kickerTransforms.length;
  kickerMesh.instanceMatrix.needsUpdate = true;
  kickerMesh.frustumCulled = false;
  group.add(kickerMesh);

  // 7. SINGLE-DRAW-CALL Physically-Projected Multiplicative HDR Ground Shadows + Tree-Well Ambient Occlusion!
  //    - 4×10 subdivided ribbon hugs EU-DEM + microRelief at +0.06m (ZERO floating +0.45m hover or trunk-slicing!)
  //    - Exact 3D ray-plane intersection on sloped terrain (correct foreshortening uphill & downhill!)
  //    - Matches terrain horizon self-shadow (uCoreAux1/uCoreAux2): ZERO phantom sun streaks inside mountain shade!
  //    - True linear multiplicative blending preserves 100% of underlying snow sparkle, sastrugi, and ski tracks!
  //    - Soft circular tree-well AO right beneath trunk skirt + scalloped multi-tiered conifer crown silhouette with penumbra!
  const shQuad = new THREE.PlaneGeometry(1, 1, 4, 10);
  shQuad.rotateX(-Math.PI / 2);
  const shOrigins = new Float32Array(shadows.length * 3);
  const shNormals = new Float32Array(shadows.length * 3);
  const shMeta = new Float32Array(shadows.length * 4);
  const shSeeds = new Float32Array(shadows.length);
  for (let i = 0; i < shadows.length; i++) {
    const sh = shadows[i];
    shOrigins[i * 3] = sh.x;
    shOrigins[i * 3 + 1] = sh.y;
    shOrigins[i * 3 + 2] = sh.z;
    shNormals[i * 3] = sh.nx;
    shNormals[i * 3 + 1] = sh.ny;
    shNormals[i * 3 + 2] = sh.nz;
    shMeta[i * 4] = sh.radius;
    shMeta[i * 4 + 1] = sh.height;
    shMeta[i * 4 + 2] = sh.opacity;
    shMeta[i * 4 + 3] = sh.kind ?? 0;
    shSeeds[i] = sh.seed ?? 0.5;
  }
  const shInstGeo = new THREE.InstancedBufferGeometry();
  shInstGeo.index = shQuad.index;
  shInstGeo.attributes.position = shQuad.attributes.position;
  shInstGeo.attributes.uv = shQuad.attributes.uv;
  shInstGeo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(shOrigins, 3));
  shInstGeo.setAttribute('aNormal', new THREE.InstancedBufferAttribute(shNormals, 3));
  shInstGeo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(shMeta, 4));
  shInstGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(shSeeds, 1));
  shInstGeo.instanceCount = shadows.length;

  const shadowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.ZeroFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    polygonOffset: true,
    polygonOffsetFactor: -2.8,
    polygonOffsetUnits: -2.8,
    uniforms: {
      ...sharedUniforms,
      uCoreDem: { value: terrainData.textures.coreDem },
      uCoreAux1: { value: terrainData.textures.coreAux1 },
      uCoreAux2: { value: terrainData.textures.coreAux2 },
      uCoreSize: { value: terrainData.coreSize },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aOrigin;
      attribute vec3 aNormal;
      attribute vec4 aMeta; // x=crownRadius, y=height, z=opacity, w=kind (0=spruce, 1=rock, 2=serac)
      attribute float aSeed;
      uniform sampler2D uCoreDem;
      uniform sampler2D uCoreAux1;
      uniform sampler2D uCoreAux2;
      uniform float uCoreSize;
      uniform vec3 uSunDir;
      uniform float uSunElev;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform vec3 uShadowSky;
      uniform float uShadowFill;
      uniform vec3 uGroundBounce;
      uniform vec4 uHorizonBlend;
      uniform vec3 uCamPos;
      uniform float uStorm;

      varying vec2 vMeters;     // (lx across, lz along sun-away axis in meters, (0,0) = trunk center!)
      varying vec4 vParams;     // (crownR, castLen, kind, baseOpacity)
      varying vec3 vDirMult;    // physical HDR multiplicative tint when blocking direct sun
      varying float vLitFactor; // 0..1 direct sunlight strength at trunk (0 in mountain shadow / storm!)
      varying float vSeed;
      varying float vDist;

      const float CORE_HALF = ${CORE_HALF.toFixed(1)};
      const float MAX_ELEV = ${MAX_ELEV.toFixed(1)};

      float decodeRG(vec4 t) {
        return ((t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0) * MAX_ELEV;
      }
      float sampleDemH(vec2 wxz) {
        vec2 uvf = clamp((wxz + CORE_HALF) / (2.0 * CORE_HALF), 0.0, 1.0) * (uCoreSize - 1.0);
        vec2 i0 = floor(uvf);
        vec2 i1 = min(i0 + vec2(1.0), vec2(uCoreSize - 1.0));
        vec2 f = fract(uvf);
        float invS = 1.0 / uCoreSize;
        float h00 = decodeRG(texture2D(uCoreDem, (i0 + 0.5) * invS));
        float h10 = decodeRG(texture2D(uCoreDem, (vec2(i1.x, i0.y) + 0.5) * invS));
        float h01 = decodeRG(texture2D(uCoreDem, (vec2(i0.x, i1.y) + 0.5) * invS));
        float h11 = decodeRG(texture2D(uCoreDem, (i1 + 0.5) * invS));
        return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
      }
      float microRelief(vec2 xz, float slopeMag, float powder) {
        float x = xz.x, z = xz.y;
        float w1 = sin(x * 0.047 + z * 0.029) * cos(x * 0.023 - z * 0.051);
        float w2 = sin(x * 0.115 - z * 0.088 + 1.3) * cos(x * 0.072 + z * 0.131 - 0.7);
        float w3 = sin(x * 0.240 + z * 0.195 - 2.1) * sin(x * 0.180 - z * 0.270 + 0.5);
        float roller = sin((x * 0.74 + z * 0.67) * 0.082 + w1 * 1.4) * 0.68;
        float midSlope = clamp((slopeMag - 0.08) / 0.45, 0.0, 1.0);
        float steepRock = clamp((slopeMag - 0.78) / 0.45, 0.0, 1.0);
        float snowAmp = (0.55 + 0.45 * powder) * (0.45 + 0.55 * midSlope) * (1.0 - steepRock * 0.45);
        float rockRib = steepRock * (abs(w2) * 1.65 + w3 * 0.55);
        return (w1 * 1.35 + roller * 0.85 + w2 * 0.42 + w3 * 0.14) * snowAmp + rockRib;
      }

      void main() {
        vec3 N = normalize(aNormal);
        vec3 L = normalize(uSunDir);
        float radius = aMeta.x;
        float h = aMeta.y;
        float baseOp = aMeta.z;
        float kind = aMeta.w;

        // Exact mountain horizon self-shadow check matching terrain_renderer.js 1:1!
        vec2 oUv = clamp((aOrigin.xz + CORE_HALF) / (2.0 * CORE_HALF), 0.0, 1.0);
        vec3 oAux1 = texture2D(uCoreAux1, oUv).rgb;
        vec3 oAux2 = texture2D(uCoreAux2, oUv).rgb;
        float hAng = dot(vec4(oAux1.g, oAux1.b, oAux2.r, oAux2.g) * 1.5707963, uHorizonBlend);
        float mtnShadow = smoothstep(-0.020, 0.044, uSunElev - hAng);
        float ndl = max(0.0, dot(N, L));
        float litFactor = mtnShadow * smoothstep(0.02, 0.20, ndl) * (1.0 - uStorm * 0.92);

        // Physically exact HDR attenuation ratio calibrated for ACES filmic shoulder!
        // Sunlit snow sits around linear HDR ~2.2 (sRGB 225). Multiplying down to ~0.28..0.68 brings linear HDR
        // straight to the real mountain shadow luminance (~0.35..0.62 -> sRGB 126..158, cool alpine slate-blue, NEVER neon!).
        vec3 directL = uSunColor * uSunIntensity * ndl * mtnShadow * (1.0 - uStorm * 0.92);
        float skyFactor = clamp(0.42 + 0.58 * N.y, 0.16, 1.0);
        vec3 skyL = mix(uGroundBounce * 0.64, uShadowSky, skyFactor) * uShadowFill;
        vec3 occL = skyL * 0.62;
        vec3 rawRatio = occL / max(directL + skyL, vec3(0.06));
        // Calibrated for HDR ACES Filmic curve: snow linear ~2.2 * (0.08, 0.15, 0.27) -> sRGB ~[108, 138, 178] matching mountain shadow!
        vDirMult = clamp(rawRatio, vec3(0.07, 0.13, 0.25), vec3(1.0));
        vLitFactor = litFactor;
        vSeed = aSeed;

        // Horizontal ray direction directly away from sun
        vec2 castXZ = -L.xz;
        float cLen = length(castXZ);
        vec2 alongXZ = cLen > 0.001 ? castXZ / cLen : vec2(1.0, 0.0);
        vec2 acrossXZ = vec2(-alongXZ.y, alongXZ.x);

        // True 3D ray-plane intersection of tree apex (0, h, 0) onto sloped ground plane P·N = 0:
        //   s = (h * N.y) / max(0.24, dot(N, L))  ->  castLen = s * |L.xz|
        float denom = max(0.26, dot(N, L));
        float rawCast = (h * max(0.35, N.y) / denom) * cLen;
        float castLen = clamp(rawCast, radius * 0.6, min(h * 1.75, 22.0)) * litFactor;

        float backPad = radius * 1.38;
        float halfSpanX = radius * 1.48 + castLen * 0.10;
        float zMin = -backPad;
        float zMax = max(backPad, castLen + radius * 0.85);

        float lx = position.x * 2.0 * halfSpanX;
        float lz = mix(zMin, zMax, position.z + 0.5);
        vMeters = vec2(lx, lz);
        vParams = vec4(radius, max(0.01, castLen), kind, baseOp);

        vec2 wxz = aOrigin.xz + acrossXZ * lx + alongXZ * lz;

        // Snap vertex cleanly onto real DEM + microRelief surface (+0.06m close-up -> ZERO hover & ZERO branch-slicing!)
        float e = 8.0;
        float hC = sampleDemH(wxz);
        float sMag = length(vec2(sampleDemH(wxz + vec2(e, 0.0)) - sampleDemH(wxz - vec2(e, 0.0)),
                                 sampleDemH(wxz + vec2(0.0, e)) - sampleDemH(wxz - vec2(0.0, e))) / (2.0 * e));
        vec2 pUv = clamp((wxz + CORE_HALF) / (2.0 * CORE_HALF), 0.0, 1.0);
        float powd = texture2D(uCoreAux1, pUv).r;
        float gy = hC + microRelief(wxz, sMag, powd);
        if (sMag > 0.72) {
          float sharpM = clamp((sMag - 0.72) / 0.55, 0.0, 1.0);
          float ridgeS = 1.0 - abs(sin(wxz.x * 0.019 + wxz.y * 0.014) * cos(wxz.x * 0.012 - wxz.y * 0.023));
          gy += (ridgeS - 0.5) * 4.5 * sharpM;
        }

        float dist = length(vec3(wxz.x, gy, wxz.y) - uCamPos);
        vDist = dist;
        // 0.18m clears curved Level 1/2 clipmap chord sag for far trees; 0.035m hugs stakes tightly near drop-in!
        float distLift = clamp((dist - 18.0) * 0.0026, 0.0, 2.0);
        float baseLift = kind > 2.5 ? 0.035 : 0.18;
        vec3 wp = vec3(wxz.x, gy + baseLift + distLift, wxz.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFogDensity;
      uniform float uStorm;
      varying vec2 vMeters;
      varying vec4 vParams;
      varying vec3 vDirMult;
      varying float vLitFactor;
      varying float vSeed;
      varying float vDist;

      void main() {
        float distFade = 1.0 - smoothstep(950.0, 2600.0, vDist);
        if (distFade < 0.01) discard;

        float crownR = vParams.x;
        float castLen = vParams.y;
        float kind = vParams.z;
        float baseOp = vParams.w;
        float lx = vMeters.x;
        float lz = vMeters.y;

        // 1. Soft circular sky-dome ambient occlusion directly underneath tree skirt / rock base (present in BOTH sun & shade!)
        float rNorm = length(vec2(lx, lz)) / max(0.22, crownR * (kind > 2.5 ? 0.58 : 1.24));
        float aoCore = exp(-rNorm * rNorm * (kind > 2.5 ? 3.2 : 1.85)) * (1.0 - smoothstep(0.10, 1.42, rNorm));
        float aoStrength = aoCore * (kind < 0.5 ? 0.84 : (kind > 2.5 ? 0.62 : 0.56)) * baseOp;

        // 2. Directional ray-projected cast shadow (strictly gated by vLitFactor -> ZERO streaks in mountain shade!)
        float dirMask = 0.0;
        if (vLitFactor > 0.02 && castLen > 0.45) {
          float hFrac = clamp(lz / castLen, 0.0, 1.0);
          float startFade = smoothstep(kind > 2.5 ? -0.08 : -crownR * 0.60, kind > 2.5 ? 0.05 : crownR * 0.08, lz);
          float endPen = kind > 2.5 ? (0.28 + castLen * 0.055) : (0.45 + castLen * 0.075);
          float endFade = 1.0 - smoothstep(castLen - endPen * 0.45, castLen + endPen, lz);

          if (kind > 2.5) {
            // Soft natural sun-penumbra shadow strip cast by drop-in wooden safety stake
            float halfW = mix(0.048, 0.088, hFrac);
            float pen = 0.052 + hFrac * 0.085;
            float across = 1.0 - smoothstep(halfW, halfW + pen, abs(lx));
            dirMask = across * startFade * endFade * vLitFactor * baseOp * 0.86;
          } else if (kind < 0.5) {
            // Broad organic conical Norway spruce shadow with scalloped drooping bough tiers + soft solar penumbra!
            float coneEnv = crownR * mix(1.16, 0.18, pow(hFrac, 0.86));
            float tiers = 1.0 + (0.20 * sin(hFrac * 19.0 + vSeed * 6.283) + 0.11 * cos(hFrac * 35.0 - vSeed * 9.0))
                        * smoothstep(0.0, 0.12, hFrac) * (1.0 - hFrac * 0.28);
            float halfW = coneEnv * tiers;
            // Penumbra widens naturally away from trunk (sun angular diameter + swaying conifer needles)
            float pen = crownR * (0.14 + hFrac * 0.26) + castLen * 0.024 * hFrac;
            float across = 1.0 - smoothstep(halfW - pen * 0.45, halfW + pen, abs(lx));
            // Solid lower canopy shadow softening gradually toward wispy upper spire
            float canopyDensity = mix(1.0, 0.72, pow(hFrac, 1.35));
            dirMask = across * startFade * endFade * canopyDensity * vLitFactor * clamp(baseOp * 1.18, 0.0, 1.0);
          } else {
            // Rounded soft boulder / glacial serac cast shadow dome
            float domeEnv = crownR * mix(1.04, 0.36, pow(hFrac, 0.9));
            float pen = crownR * (0.24 + hFrac * 0.22);
            float across = 1.0 - smoothstep(domeEnv - pen * 0.5, domeEnv + pen, abs(lx));
            dirMask = across * startFade * endFade * vLitFactor * baseOp * 0.92;
          }
        }

        // Fade shadow gracefully with aerial haze fog & distance so far silhouettes never stamp dark ink spots
        float fogFade = exp(-vDist * uFogDensity * 1.05) * distFade;
        float totalMask = clamp(max(dirMask, aoStrength), 0.0, 1.0) * fogFade;
        if (totalMask < 0.004) discard;

        // Physically calibrated HDR linear multiplicative color:
        //  - Directional cast uses exact sky/sun ratio (vDirMult -> crisp alpine blue-slate matching mountain shadows!)
        //  - Sunken tree-well cavity underneath drooping spruce skirt (cool turquoise-indigo bowl + organic dark needle-litter center!)
        float angW = (lx * lx + lz * lz) > 1e-6 ? atan(lz, lx) : 0.0;
        float wellPert = 1.0 + 0.14 * sin(angW * 5.0 + vSeed * 19.3) + 0.09 * cos(angW * 9.0 - vSeed * 11.7);
        float rWell = rNorm * wellPert;
        vec3 aoMult = vec3(0.22, 0.29, 0.41);
        if (kind < 0.5) {
          float deepWell = exp(-rWell * rWell * 3.8);
          float litterCore = (1.0 - smoothstep(0.08, 0.32, rWell)) * (0.72 + 0.28 * sin(angW * 13.0 + vSeed * 31.0));
          // Deep cool turquoise-indigo sunken snow wall tapering to dark pine-needle/bark litter ring right at trunk base
          aoMult = mix(vec3(0.22, 0.30, 0.42), vec3(0.12, 0.21, 0.35), deepWell * 0.85);
          aoMult = mix(aoMult, vec3(0.09, 0.11, 0.12), litterCore * 0.65);
        }
        vec3 multDir = mix(vec3(1.0), vDirMult, clamp(dirMask * fogFade, 0.0, 1.0));
        vec3 multAo  = mix(vec3(1.0), aoMult,   clamp(aoStrength * fogFade * 0.95, 0.0, 1.0));
        vec3 finalMult = min(multDir, multAo);
        gl_FragColor = vec4(clamp(finalMult, vec3(0.06, 0.11, 0.14), vec3(1.0)), 1.0);
      }
    `,
  });
  const shadowMesh = new THREE.Mesh(shInstGeo, shadowMat);
  shadowMesh.frustumCulled = false;
  shadowMesh.renderOrder = 1;
  group.add(shadowMesh);

  return {
    group,
    colliders,
    kickers,
    landmarks: {
      rocks: rockList,
      seracs: seracList,
      kickers: kickerTransforms,
      heroTrees: listClose,
    },
    stats: {
      trees: totalTrees,
      rocks: rockList.length,
      seracs: seracList.length,
      kickers: kickerTransforms.length,
      shadows: shadows.length,
    },
    update(cameraPos, preset, sunDir, time = 0) {
      const twilight = preset.id === 'alpenglow' ? 1.0 : (preset.id === 'morning' ? 0.18 : 0.0);
      sharedUniforms.uCamPos.value.copy(cameraPos);
      sharedUniforms.uSunDir.value.copy(sunDir);
      sharedUniforms.uSunElev.value = Math.asin(THREE.MathUtils.clamp(sunDir.y, -1, 1));
      sharedUniforms.uSunColor.value.copy(preset.sunColor);
      sharedUniforms.uSunIntensity.value = preset.sunIntensity;
      sharedUniforms.uShadowSky.value.copy(preset.shadowSkyColor);
      sharedUniforms.uShadowFill.value = preset.shadowFillStrength;
      sharedUniforms.uGroundBounce.value.copy(preset.groundBounceColor);
      sharedUniforms.uSSSColor.value.copy(preset.sssColor);
      sharedUniforms.uCloudShadowStrength.value = preset.cloudShadowStrength;
      sharedUniforms.uValleyCloudAlt.value = preset.valleyCloudAlt;
      sharedUniforms.uValleyCloudDensity.value = preset.valleyCloudDensity;
      sharedUniforms.uHorizonBlend.value.set(...preset.horizonBlend);
      sharedUniforms.uFogColor.value.copy(preset.fogColor);
      sharedUniforms.uFogDensity.value = preset.fogDensity;
      sharedUniforms.uStorm.value = preset.id === 'storm' ? 1.0 : 0.0;
      sharedUniforms.uTime.value = time;
      sharedUniforms.uTwilight.value = twilight;
      if (midiStation) midiStation.updateCableCars(time, twilight);
    },
  };
}
