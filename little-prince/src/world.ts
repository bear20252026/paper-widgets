import * as THREE from 'three';
import type { RenderTier } from './character';

export interface WorldAsset {
  group: THREE.Group;
  stage: THREE.Group;
  fox: THREE.Group;
  materials: THREE.Material[];
  update: (time: number) => void;
  dispose: () => void;
  stars: THREE.Points;
}

const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function makeNoiseMap(size: number, tint: string, seed: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  context.fillStyle = tint;
  context.fillRect(0, 0, size, size);
  let state = seed;
  for (let i = 0; i < size * 2; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const x = state % size;
    state = (state * 1664525 + 1013904223) >>> 0;
    const y = state % size;
    const radius = 1 + (state % 7);
    context.fillStyle = `rgba(255,255,255,${0.025 + (state % 10) * 0.008})`;
    context.beginPath();
    context.ellipse(x, y, radius, Math.max(1, radius * 0.54), state % 10, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function makeRockNormalMap(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      image.data[i] = 128 + Math.round(Math.sin(x * 0.31) * 3 + Math.cos(y * 0.21) * 2);
      image.data[i + 1] = 128 + Math.round(Math.cos(x * 0.16) * 2 + Math.sin(y * 0.39) * 3);
      image.data[i + 2] = 255;
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 3);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function buildPlanet(tier: RenderTier, materials: THREE.Material[]) {
  const segments = tier === 'quality' ? 64 : 38;
  const geometry = new THREE.SphereGeometry(1, segments, Math.round(segments * 0.48));
  const position = geometry.getAttribute('position');
  const color: number[] = [];
  const shadeA = new THREE.Color('#55594d');
  const shadeB = new THREE.Color('#99927b');
  const normal = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    normal.set(position.getX(i), position.getY(i), position.getZ(i)).normalize();
    const broad = Math.sin(normal.x * 8.7 + Math.cos(normal.z * 5.5)) * Math.sin(normal.z * 10.6 + normal.y * 3.2);
    const fine = Math.sin(normal.x * 23 + normal.y * 9) * Math.sin(normal.z * 27 - normal.y * 12);
    const radius = 1 + broad * 0.018 + fine * 0.004;
    position.setXYZ(i, normal.x * radius, normal.y * radius, normal.z * radius);
    const stone = shadeA.clone().lerp(shadeB, THREE.MathUtils.smoothstep(broad * 0.7 + fine * 0.24, -0.18, 0.55));
    color.push(stone.r, stone.g, stone.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const dust = makeNoiseMap(128, '#d6d1bd', 221);
  const stoneNormal = makeRockNormalMap(128);
  const rock = new THREE.MeshPhysicalMaterial({
    name: 'B612 - weathered moonstone',
    color: '#a29d88',
    vertexColors: true,
    roughness: 0.94,
    roughnessMap: dust,
    normalMap: stoneNormal,
    normalScale: new THREE.Vector2(tier === 'quality' ? 0.09 : 0.045, tier === 'quality' ? 0.09 : 0.045),
    clearcoat: 0.035,
    clearcoatRoughness: 0.94,
  });
  materials.push(rock);
  const planet = new THREE.Mesh(geometry, rock);
  planet.name = 'B-612 - ochre moonstone';
  planet.scale.set(2.18, 0.35, 1.22);
  planet.position.set(0, -0.28, -0.02);
  planet.castShadow = true;
  planet.receiveShadow = true;

  const pebbleGeometry = new THREE.DodecahedronGeometry(1, 0);
  const pebbleMaterial = new THREE.MeshPhysicalMaterial({ name: 'B612 - tiny mineral accents', color: '#8f8c76', roughness: 0.96 });
  materials.push(pebbleMaterial);
  const pebbleCount = tier === 'quality' ? 34 : 18;
  const pebbles = new THREE.InstancedMesh(pebbleGeometry, pebbleMaterial, pebbleCount);
  pebbles.name = 'B612 - instanced stones';
  pebbles.receiveShadow = true;
  const matrix = new THREE.Object3D();
  let seed = 6091;
  for (let i = 0; i < pebbleCount; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = ((seed / 0xffffffff) * 2 - 1) * 1.85;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const z = ((seed / 0xffffffff) * 2 - 1) * 0.91;
    const inside = Math.max(0.06, 1 - (x * x) / (2.18 * 2.18) - (z * z) / (1.22 * 1.22));
    const top = -0.28 + 0.35 * Math.sqrt(inside);
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const scale = 0.025 + (seed / 0xffffffff) * 0.064;
    matrix.position.set(x, top + scale * 0.34 - 0.015, z - 0.02);
    matrix.rotation.set(seed % 3, (seed % 17) * 0.18, (seed % 11) * 0.23);
    matrix.scale.set(scale * 1.6, scale * 0.36, scale);
    matrix.updateMatrix();
    pebbles.setMatrixAt(i, matrix.matrix);
    const variation = 0.7 + (seed % 61) / 150;
    pebbles.setColorAt(i, new THREE.Color('#c3ad83').multiplyScalar(variation));
  }
  pebbles.instanceMatrix.needsUpdate = true;

  const craterGeo = new THREE.TorusGeometry(0.085, 0.007, 5, 18);
  craterGeo.rotateX(Math.PI / 2);
  const craterMaterial = new THREE.MeshStandardMaterial({ name: 'B612 - shallow crater edges', color: '#b4a687', roughness: 1 });
  materials.push(craterMaterial);
  const craters = new THREE.InstancedMesh(craterGeo, craterMaterial, 7);
  craters.name = 'B612 - shallow crater rings';
  const cratersAt = [[-1.35, 0.15], [-0.72, 0.56], [0.65, -0.54], [1.37, -0.27], [1.5, 0.35], [-1.65, -0.36], [0.92, 0.56]];
  for (let i = 0; i < cratersAt.length; i++) {
    const [x, z] = cratersAt[i];
    const top = -0.28 + 0.35 * Math.sqrt(Math.max(0.06, 1 - x * x / (2.18 * 2.18) - z * z / (1.22 * 1.22)));
    const scale = i % 3 === 0 ? 1.4 : 0.8;
    matrix.position.set(x, top + 0.007, z - 0.02);
    matrix.rotation.set(0, 0, 0);
    matrix.scale.set(scale, scale * 0.66, scale);
    matrix.updateMatrix();
    craters.setMatrixAt(i, matrix.matrix);
  }
  craters.instanceMatrix.needsUpdate = true;

  const stage = new THREE.Group();
  stage.name = 'B612 - moon and rose under a glass dome';
  stage.add(planet, pebbles, craters, buildCloche(tier, materials));
  return stage;
}

function buildCloche(tier: RenderTier, materials: THREE.Material[]) {
  const cloche = new THREE.Group();
  cloche.name = 'A single rose beneath glass';
  cloche.position.set(-1.12, 0.085, 0.37);
  const metal = new THREE.MeshPhysicalMaterial({ name: 'Cloche base - warm antique brass', color: '#ae9160', metalness: 0.72, roughness: 0.37, clearcoat: 0.25 });
  const foot = new THREE.MeshPhysicalMaterial({ name: 'Cloche pedestal - deep moss enamel', color: '#40513f', metalness: 0.26, roughness: 0.47, clearcoat: 0.4, clearcoatRoughness: 0.32 });
  const glass = new THREE.MeshPhysicalMaterial({
    name: 'Bell jar - starlit optical glass',
    color: '#c3d7e2',
    metalness: 0,
    roughness: tier === 'quality' ? 0.12 : 0.2,
    transmission: tier === 'quality' ? 0.35 : 0,
    thickness: 0.012,
    ior: 1.45,
    clearcoat: 0.88,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.92,
    transparent: true,
    opacity: tier === 'quality' ? 0.19 : 0.14,
    depthWrite: false,
  });
  const petal = new THREE.MeshPhysicalMaterial({ name: 'Rose - hand-painted wine red petals', color: '#a83e53', roughness: 0.46, sheen: tier === 'quality' ? 0.18 : 0.08, sheenColor: '#e78b85', clearcoat: 0.08, emissive: '#300b12', emissiveIntensity: 0.16 });
  const petalLight = new THREE.MeshPhysicalMaterial({ name: 'Rose - blush petal edges', color: '#cf6470', roughness: 0.5, sheen: 0.12 });
  const stem = new THREE.MeshStandardMaterial({ name: 'Rose stem and leaves', color: '#52754b', roughness: 0.8 });
  const roseGlint = new THREE.MeshBasicMaterial({ name: 'Rose - a candle-bright heart', color: '#fff0cf', toneMapped: false });
  materials.push(metal, foot, glass, petal, petalLight, stem, roseGlint);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.32, 0.045, tier === 'quality' ? 32 : 18), foot);
  pedestal.name = 'Dome pedestal';
  pedestal.position.y = 0.025;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  cloche.add(pedestal);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.296, 0.018, 8, tier === 'quality' ? 44 : 24), metal);
  rim.name = 'Dome golden rim';
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.069;
  cloche.add(rim);

  const jarGeometry = new THREE.SphereGeometry(0.29, tier === 'quality' ? 36 : 18, tier === 'quality' ? 28 : 14, 0, Math.PI * 2, 0, Math.PI / 2);
  jarGeometry.scale(1, 2.13, 1);
  jarGeometry.translate(0, 0.07, 0);
  const jar = new THREE.Mesh(jarGeometry, glass);
  jar.name = 'Optical glass bell jar';
  jar.renderOrder = 3;
  cloche.add(jar);

  const stemMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.016, 0.3, 8), stem);
  stemMesh.name = 'Rose stem';
  stemMesh.position.set(0, 0.21, 0.015);
  stemMesh.rotation.z = -0.045;
  cloche.add(stemMesh);

  const leafGeometry = new THREE.SphereGeometry(1, 12, 8);
  leafGeometry.scale(0.087, 0.025, 0.039);
  const leaf1 = new THREE.Mesh(leafGeometry, stem);
  leaf1.name = 'Rose leaf - left';
  leaf1.position.set(-0.046, 0.23, 0.018);
  leaf1.rotation.z = -0.42;
  cloche.add(leaf1);
  const leaf2 = new THREE.Mesh(leafGeometry, stem);
  leaf2.name = 'Rose leaf - right';
  leaf2.position.set(0.05, 0.30, 0.015);
  leaf2.rotation.z = 2.7;
  cloche.add(leaf2);

  const bloom = new THREE.Group();
  bloom.name = 'Rose blossom';
  bloom.position.set(0, 0.385, 0.02);
  const innerGeometry = new THREE.SphereGeometry(0.053, 16, 12);
  innerGeometry.scale(1, 0.82, 0.84);
  const core = new THREE.Mesh(innerGeometry, petalLight);
  core.name = 'Rose center';
  bloom.add(core);

  const outerPetalGeometry = new THREE.SphereGeometry(1, 12, 8);
  outerPetalGeometry.scale(0.052, 0.079, 0.033);
  const innerPetalGeometry = new THREE.SphereGeometry(1, 12, 8);
  innerPetalGeometry.scale(0.043, 0.063, 0.036);
  for (let i = 0; i < 7; i++) {
    const angle = i / 7 * Math.PI * 2;
    const petalMesh = new THREE.Mesh(i % 3 === 0 ? innerPetalGeometry : outerPetalGeometry, i % 3 === 0 ? petalLight : petal);
    petalMesh.name = `Rose petal ${i + 1}`;
    petalMesh.position.set(Math.sin(angle) * 0.053, Math.cos(angle) * 0.035, Math.cos(angle) * 0.048);
    petalMesh.rotation.z = angle * 0.4;
    bloom.add(petalMesh);
  }
  const budGeometry = new THREE.SphereGeometry(0.039, 12, 9);
  budGeometry.scale(0.79, 1.14, 0.78);
  const bud = new THREE.Mesh(budGeometry, petal);
  bud.name = 'Unfurled rose bud';
  bud.position.set(0, 0.035, 0.003);
  bloom.add(bud);

  const lightInside = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), roseGlint);
  lightInside.name = 'Rose heart bloom';
  lightInside.position.set(0.018, 0.395, 0.087);
  cloche.add(bloom, lightInside);

  const scratch = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), petalLight);
  scratch.scale.set(0.018, 0.01, 0.012);
  scratch.position.set(0.12, 0.21, 0.16);
  scratch.name = 'A petal behind glass';
  cloche.add(scratch);

  return cloche;
}

function buildFox(tier: RenderTier, materials: THREE.Material[]) {
  const fox = new THREE.Group();
  fox.name = 'The quiet little fox';
  fox.position.set(1.38, -0.006, 0.2);
  const orange = new THREE.MeshPhysicalMaterial({ name: 'Fox - toasted russet coat', color: '#c16e40', roughness: 0.83, sheen: tier === 'quality' ? 0.18 : 0.08, sheenColor: '#d9986a' });
  const cream = new THREE.MeshPhysicalMaterial({ name: 'Fox - soft cream', color: '#f0dfc2', roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ name: 'Fox - little hazel eyes', color: '#392d29', roughness: 0.72 });
  const leaf = new THREE.MeshStandardMaterial({ name: 'Fox - tail tip', color: '#f2dfbd', roughness: 0.93 });
  materials.push(orange, cream, dark, leaf);

  const bodyGeometry = new THREE.SphereGeometry(1, tier === 'quality' ? 16 : 10, tier === 'quality' ? 12 : 8);
  bodyGeometry.scale(0.22, 0.16, 0.125);
  const body = new THREE.Mesh(bodyGeometry, orange);
  body.name = 'Fox - curled little body';
  body.position.set(0, 0.23, 0);
  body.castShadow = true;
  fox.add(body);

  const headGeometry = new THREE.SphereGeometry(0.145, tier === 'quality' ? 18 : 12, tier === 'quality' ? 12 : 8);
  const head = new THREE.Mesh(headGeometry, orange);
  head.name = 'Fox - curious head';
  head.position.set(0.12, 0.39, 0);
  head.castShadow = true;
  fox.add(head);

  const earGeometry = new THREE.ConeGeometry(0.048, 0.15, tier === 'quality' ? 8 : 5);
  for (const [index, z] of [-0.084, 0.084].entries()) {
    const ear = new THREE.Mesh(earGeometry, orange);
    ear.name = `Fox - pointed ear ${index + 1}`;
    ear.position.set(0.105, 0.528, z);
    ear.rotation.z = 0.12;
    ear.castShadow = true;
    fox.add(ear);
  }

  const muzzleGeometry = new THREE.SphereGeometry(0.074, 12, 8);
  muzzleGeometry.scale(1.25, 0.64, 1.0);
  const muzzle = new THREE.Mesh(muzzleGeometry, cream);
  muzzle.name = 'Fox - pale muzzle';
  muzzle.position.set(0.23, 0.34, 0);
  fox.add(muzzle);

  const eyeGeometry = new THREE.SphereGeometry(0.014, 8, 6);
  for (const [index, z] of [-0.103, 0.103].entries()) {
    const eye = new THREE.Mesh(eyeGeometry, dark);
    eye.name = `Fox - eye ${index + 1}`;
    eye.position.set(0.219, 0.412, z);
    fox.add(eye);
  }

  const tailCurve = new THREE.CatmullRomCurve3([vec(-0.14, 0.25, 0), vec(-0.26, 0.28, -0.01), vec(-0.32, 0.43, 0), vec(-0.29, 0.53, 0.01)]);
  const tailGeometry = new THREE.TubeGeometry(tailCurve, tier === 'quality' ? 18 : 10, 0.073, 8, false);
  const tail = new THREE.Mesh(tailGeometry, orange);
  tail.name = 'Fox - soft rising tail';
  tail.castShadow = true;
  fox.add(tail);
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 8), leaf);
  tailTip.name = 'Fox - pale tail tip';
  tailTip.position.set(-0.285, 0.512, 0.01);
  fox.add(tailTip);

  const legGeometry = new THREE.CylinderGeometry(0.027, 0.018, 0.13, tier === 'quality' ? 10 : 6);
  let legIndex = 0;
  for (const x of [-0.09, 0.13]) {
    for (const z of [-0.078, 0.078]) {
      const leg = new THREE.Mesh(legGeometry, orange);
      leg.name = `Fox - little paw ${++legIndex}`;
      leg.position.set(x, 0.103, z);
      leg.castShadow = true;
      fox.add(leg);
    }
  }
  fox.visible = false;
  return fox;
}

function buildStars(tier: RenderTier, materials: THREE.Material[]) {
  const count = tier === 'quality' ? 750 : 340;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  let seed = 7416;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const warm = new THREE.Color('#ffddb0');
  const cool = new THREE.Color('#acc9ff');
  const white = new THREE.Color('#ffffff');
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const y = next() * 2 - 1;
    const angle = next() * Math.PI * 2;
    const radius = 18 + next() * 6;
    const ring = Math.sqrt(1 - y * y);
    positions[i * 3] = Math.cos(angle) * ring * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = Math.sin(angle) * ring * radius;
    color.copy(next() > 0.68 ? warm : cool).lerp(white, next() * 0.65);
    const brightness = 0.28 + Math.pow(next(), 3) * 2.7;
    colors[i * 3] = color.r * brightness;
    colors[i * 3 + 1] = color.g * brightness;
    colors[i * 3 + 2] = color.b * brightness;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    name: 'Starfield - warm and cool luminous points',
    size: tier === 'quality' ? 2.1 : 1.8,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  materials.push(material);
  const stars = new THREE.Points(geometry, material);
  stars.name = 'Starfield - one batched Points draw call';
  stars.frustumCulled = false;
  stars.renderOrder = -2;
  stars.rotation.set(0.16, 0.12, -0.08);
  return stars;
}

export function createWorld(tier: RenderTier): WorldAsset {
  const materials: THREE.Material[] = [];
  const group = new THREE.Group();
  group.name = 'Little Prince - miniature universe';
  const stage = buildPlanet(tier, materials);
  const fox = buildFox(tier, materials);
  const stars = buildStars(tier, materials);
  group.add(stars, stage, fox);
  const update = (time: number) => {
    stars.rotation.y = 0.12 + time * 0.00022;
    const rose = stage.getObjectByName('Rose blossom');
    if (rose) rose.rotation.y = Math.sin(time * 0.00037) * 0.06;
  };
  const dispose = () => {
    const geometries = new Set<THREE.BufferGeometry>();
    const textures = new Set<THREE.Texture>();
    group.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) geometries.add(object.geometry);
    });
    for (const material of materials) {
      const pbr = material as THREE.MeshStandardMaterial;
      if (pbr.map) textures.add(pbr.map);
      if (pbr.normalMap) textures.add(pbr.normalMap);
      if (pbr.roughnessMap) textures.add(pbr.roughnessMap);
      material.dispose();
    }
    geometries.forEach((geometry) => geometry.dispose());
    textures.forEach((texture) => texture.dispose());
  };
  return { group, stage, fox, materials, update, dispose, stars };
}