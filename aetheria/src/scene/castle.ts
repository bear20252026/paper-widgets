import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash } from './glsl';
import { masonry, roofPaint, trimMetal } from './materials';
import { backSurface } from './whale';

export interface CastleModel {
  group: THREE.Group;
  trees: THREE.Object3D[];
  flags: THREE.Mesh[];
  triangles: number;
  windows: number;
}

type Kind = 'cone' | 'dome' | 'onion';
interface Tower { x: number; z: number; r: number; h: number; tier: 0 | 1 | 2; roof: string; wall: string; kind: Kind; spire?: boolean }

const towers: Tower[] = [
  { x: 0.35, z: -0.25, r: 0.5, h: 4.3, tier: 2, roof: '#ee9fb8', wall: '#f3b9c8', kind: 'cone', spire: true },
  { x: -0.2, z: 0.55, r: 0.85, h: 1.25, tier: 2, roof: '#8fd0d4', wall: '#f7f1ea', kind: 'cone' },
  { x: 1.3, z: 0.3, r: 0.38, h: 2.6, tier: 2, roof: '#f3b0c4', wall: '#f7efe8', kind: 'cone', spire: true },
  { x: -1.25, z: -0.35, r: 0.36, h: 2.3, tier: 2, roof: '#9ad2c8', wall: '#f4c3cf', kind: 'cone' },
  { x: 0.95, z: -0.9, r: 0.3, h: 3.1, tier: 2, roof: '#f0a8be', wall: '#f2b6c6', kind: 'cone', spire: true },
  { x: -2.1, z: 0.75, r: 0.42, h: 1.7, tier: 1, roof: '#f3c9a6', wall: '#f8f2ea', kind: 'dome' },
  { x: 2.15, z: 0.85, r: 0.36, h: 1.5, tier: 1, roof: '#bfe0c9', wall: '#f8f3ec', kind: 'onion' },
  { x: -2.55, z: -0.55, r: 0.32, h: 1.9, tier: 1, roof: '#f1a9bf', wall: '#f6eee6', kind: 'cone' },
  { x: 2.45, z: -0.5, r: 0.3, h: 1.3, tier: 1, roof: '#f6d9a8', wall: '#f7f0e8', kind: 'dome' },
  { x: -0.9, z: 1.25, r: 0.26, h: 1.1, tier: 1, roof: '#f2b3c6', wall: '#fbf6f0', kind: 'cone' },
  { x: 1.05, z: 1.3, r: 0.24, h: 1.0, tier: 1, roof: '#a9d8cf', wall: '#fbf6f0', kind: 'cone' },
];

function curvedRoof(radius: number, height: number, kind: Kind) {
  const points: THREE.Vector2[] = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r = kind === 'dome' ? Math.sqrt(Math.max(0, 1 - t * t))
      : kind === 'onion' ? (0.78 + 0.32 * Math.sin(t * Math.PI * 0.9)) * Math.pow(1 - t, 0.45)
        : Math.pow(1 - t, 0.85) + 0.12 * Math.pow(1 - t, 6);
    if (kind !== 'dome' && t < 0.92) r *= 1 + 0.035 * (1 - ((t * 9) % 1));
    points.push(new THREE.Vector2(Math.max(0.002, r * radius), t * height));
  }
  return new THREE.LatheGeometry(points, 28);
}

function archShape(width: number, height: number, hole: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-width, 0);
  shape.lineTo(-width, height * 0.62);
  shape.absarc(0, height * 0.62, width, Math.PI, 0, true);
  shape.lineTo(width, 0);
  shape.lineTo(-width, 0);
  const opening = new THREE.Path();
  const w = width * hole;
  opening.moveTo(-w, 0.03);
  opening.lineTo(-w, height * 0.6);
  opening.absarc(0, height * 0.6, w, Math.PI, 0, true);
  opening.lineTo(w, 0.03);
  opening.lineTo(-w, 0.03);
  shape.holes.push(opening);
  return shape;
}

function bake(geometry: THREE.BufferGeometry, x: number, y: number, z: number, rotX = 0) {
  if (rotX) geometry.rotateX(rotX);
  geometry.translate(x, y, z);
  return geometry;
}

function grow(origin: THREE.Vector3, direction: THREE.Vector3, radius: number, depth: number, seed: number, parts: THREE.BufferGeometry[], tips: THREE.Vector3[]) {
  const end = origin.clone().add(direction);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius * 0.62, radius, length, 6);
  geometry.translate(0, length / 2, 0);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()));
  geometry.translate(origin.x, origin.y, origin.z);
  parts.push(geometry);
  if (depth === 0) { tips.push(end); return; }
  const count = depth > 1 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const yaw = (i / count) * Math.PI * 2 + hash(seed * 7.3 + depth * 3.1 + i) * 1.6;
    const child = new THREE.Vector3(Math.cos(yaw) * 0.7, 0.5 + hash(seed + i * 2.7 + depth) * 0.45, Math.sin(yaw) * 0.7).normalize().multiplyScalar(length * 0.7);
    grow(end, child, radius * 0.6, depth - 1, seed * 1.7 + i + 1, parts, tips);
  }
}

export function createCastle(): CastleModel {
  const group = new THREE.Group();
  const y0 = backSurface(0.2, 0) - 0.3;
  const top1 = y0 + 0.85;
  const top2 = y0 + 1.75;
  const tiers = [
    { a: 3.5, b: 1.85, bottom: y0 - 1.2, top: top1, color: '#f9f1e8' },
    { a: 2.45, b: 1.45, bottom: top1 - 0.05, top: top2, color: '#fdf6ee' },
  ];
  const gold: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [];
  const posts: THREE.Matrix4[] = [];
  const windows: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const addWindow = (x: number, y: number, z: number, nx: number, nz: number, scale: number) => {
    dummy.position.set(x, y, z);
    dummy.quaternion.setFromAxisAngle(up, Math.atan2(nx, nz));
    dummy.scale.set(scale, scale, 1);
    dummy.updateMatrix();
    windows.push(dummy.matrix.clone());
  };
  const addPost = (x: number, y: number, z: number) => {
    dummy.position.set(x, y, z);
    dummy.quaternion.identity();
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    posts.push(dummy.matrix.clone());
  };

  tiers.forEach((tier, level) => {
    const shape = new THREE.Shape();
    shape.absellipse(0, 0, tier.a, tier.b, 0, Math.PI * 2, false, 0);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: tier.top - tier.bottom - 0.05, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 48,
    });
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, masonry(tier.color));
    mesh.position.y = tier.bottom;
    group.add(mesh);
    const ledge = new THREE.TorusGeometry(1, 0.045, 8, 96);
    ledge.rotateX(Math.PI / 2);
    ledge.scale(tier.a + 0.05, 1, tier.b + 0.05);
    ledge.translate(0, tier.top - 0.16, 0);
    trim.push(ledge);
    const rail: THREE.Vector3[] = [];
    const postCount = level === 0 ? 96 : 68;
    for (let i = 0; i < postCount; i++) {
      const theta = (i / postCount) * Math.PI * 2;
      const x = Math.cos(theta) * (tier.a - 0.03);
      const z = Math.sin(theta) * (tier.b - 0.03);
      addPost(x, tier.top + 0.08, z);
      rail.push(new THREE.Vector3(x, tier.top + 0.17, z));
    }
    gold.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail, true), 140, 0.016, 6, true));
    const count = level === 0 ? 38 : 26;
    for (let i = 0; i < count; i++) {
      const theta = ((i + 0.5) / count) * Math.PI * 2;
      const x = Math.cos(theta) * tier.a;
      const z = Math.sin(theta) * tier.b;
      const normal = new THREE.Vector2(Math.cos(theta) / tier.a, Math.sin(theta) / tier.b).normalize();
      for (const drop of level === 0 ? [0.78, 1.5] : [0.74]) {
        const y = tier.top - drop;
        if (y > backSurface(x * 1.03, z * 1.03) + 0.08) addWindow(x, y, z, normal.x, normal.y, level === 0 ? 1.35 : 1.3);
      }
    }
  });

  const cache = new Map<string, THREE.Material>();
  const material = (color: string, factory: (color: string) => THREE.Material, prefix: string) => {
    const key = prefix + color;
    if (!cache.has(key)) cache.set(key, factory(color));
    return cache.get(key)!;
  };
  const flags: THREE.Mesh[] = [];
  towers.forEach((tower) => {
    const { x, z, r, h } = tower;
    const base = tower.tier === 2 ? top2 : tower.tier === 1 ? top1 : backSurface(x, z) - 0.15;
    const profile = [[r * 1.08, 0], [r * 1.08, 0.12], [r, 0.2], [r, h * 0.86], [r * 1.16, h * 0.9], [r * 1.16, h], [r, h], [0.002, h]]
      .map(([px, py]) => new THREE.Vector2(px, py));
    const wall = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), material(tower.wall, masonry, 'wall'));
    wall.position.set(x, base, z);
    const roofHeight = tower.kind === 'dome' ? r * 1.2 : tower.kind === 'onion' ? r * 1.9 : r * (tower.spire ? 3.4 : 2.6);
    const roof = new THREE.Mesh(curvedRoof(r * 1.24, roofHeight, tower.kind), material(tower.roof, roofPaint, 'roof'));
    roof.position.set(x, base + h, z);
    group.add(wall, roof);
    gold.push(bake(new THREE.TorusGeometry(r * 1.17, 0.035, 8, 28), x, base + h * 0.9, z, Math.PI / 2));
    gold.push(bake(new THREE.SphereGeometry(0.05 + r * 0.05, 12, 8), x, base + h + roofHeight + 0.03, z));
    trim.push(bake(new THREE.TorusGeometry(r * 1.03, 0.04, 8, 28), x, base + h * 0.47, z, Math.PI / 2));
    if (r > 0.45 || tower.spire) {
      const level = base + h * 0.64;
      trim.push(bake(new THREE.CylinderGeometry(r * 1.42, r * 1.2, 0.07, 28), x, level, z));
      gold.push(bake(new THREE.TorusGeometry(r * 1.36, 0.014, 6, 28), x, level + 0.2, z, Math.PI / 2));
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        addPost(x + Math.cos(angle) * r * 1.36, level + 0.115, z + Math.sin(angle) * r * 1.36);
      }
    }
    if (tower.spire) {
      const tip = base + h + roofHeight;
      gold.push(bake(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), x, tip + 0.38, z));
      const cloth = new THREE.PlaneGeometry(0.5, 0.26, 10, 4);
      cloth.translate(0.25, 0, 0);
      const flag = new THREE.Mesh(cloth, new THREE.MeshStandardMaterial({ color: '#f29bb5', side: THREE.DoubleSide, roughness: 0.8 }));
      flag.position.set(x, tip + 0.58, z);
      flag.userData.phase = hash(x * 10) * 6;
      flags.push(flag);
      group.add(flag);
    }
    const rows = Math.max(1, Math.floor(h / 0.62));
    const around = Math.max(4, Math.round(r * 11));
    for (let row = 0; row < rows; row++) {
      const y = rows === 1 ? h * 0.42 : 0.38 + row * ((h * 0.78 - 0.38) / (rows - 1));
      for (let k = 0; k < around; k++) {
        const angle = (k / around) * Math.PI * 2 + row * 0.4 + x;
        addWindow(x + Math.cos(angle) * r, base + y - 0.17, z + Math.sin(angle) * r, Math.cos(angle), Math.sin(angle), THREE.MathUtils.clamp(r * 1.9, 0.6, 1.25));
      }
    }
  });

  const goldMesh = mergeGeometries(gold, false);
  const trimMesh = mergeGeometries(trim, false);
  if (goldMesh) group.add(new THREE.Mesh(goldMesh, trimMetal()));
  if (trimMesh) group.add(new THREE.Mesh(trimMesh, masonry('#fffaf3')));
  gold.concat(trim).forEach((geometry) => geometry.dispose());

  const frameGeometry = new THREE.ExtrudeGeometry(archShape(0.13, 0.4, 0.74), {
    depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10,
  });
  frameGeometry.translate(0, 0, -0.02);
  const backingGeometry = new THREE.BoxGeometry(0.2, 0.34, 0.012);
  backingGeometry.translate(0, 0.18, 0.012);
  const paneGeometry = new THREE.PlaneGeometry(0.19, 0.33);
  paneGeometry.translate(0, 0.18, 0.034);
  const backingMaterial = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  backingMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      #ifdef USE_COLOR
        totalEmissiveRadiance += vColor.rgb * smoothstep(0.55, 0.8, vColor.r) * 1.5;
      #endif
    `);
  };
  const frames = new THREE.InstancedMesh(frameGeometry, masonry('#fffaf4'), windows.length);
  const backing = new THREE.InstancedMesh(backingGeometry, backingMaterial, windows.length);
  const panes = new THREE.InstancedMesh(paneGeometry, new THREE.MeshPhysicalMaterial({
    color: '#9cc3d6', roughness: 0.05, transparent: true, opacity: 0.32, clearcoat: 1, envMapIntensity: 1.3, depthWrite: false,
  }), windows.length);
  const warm = new THREE.Color('#ffd08a');
  const dark = new THREE.Color('#263c50');
  windows.forEach((matrix, i) => {
    frames.setMatrixAt(i, matrix);
    backing.setMatrixAt(i, matrix);
    panes.setMatrixAt(i, matrix);
    backing.setColorAt(i, hash(i * 3.7) < 0.42 ? warm : dark);
  });
  const postMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.019, 0.17, 6), masonry('#fffaf3'), posts.length);
  posts.forEach((matrix, i) => postMesh.setMatrixAt(i, matrix));
  group.add(frames, backing, panes, postMesh);

  const wood = new THREE.MeshStandardMaterial({ color: '#7a5a4a', roughness: 0.92 });
  const blossomGeometry = new THREE.IcosahedronGeometry(1, 1);
  const blossomMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78 });
  const tint = new THREE.Color();
  const trees: THREE.Object3D[] = [];
  const treeSites: Array<[number, number, number]> = [
    [-3.05, 0.6, top1], [3.05, 0.55, top1], [-2.3, 1.3, top1], [2.4, 1.25, top1], [0.95, 1.7, top1],
    [-4.3, 0.5, -1], [4.25, 0.6, -1], [-4.0, -0.9, -1], [-3.0, -0.7, top1],
  ];
  treeSites.forEach(([x, z, level], index) => {
    const tree = new THREE.Group();
    const parts: THREE.BufferGeometry[] = [];
    const tips: THREE.Vector3[] = [];
    grow(new THREE.Vector3(), new THREE.Vector3((hash(index + 1) - 0.5) * 0.2, 0.55, (hash(index + 5) - 0.5) * 0.2), 0.06, 3, index + 1.3, parts, tips);
    const trunk = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());
    if (trunk) tree.add(new THREE.Mesh(trunk, wood));
    const blossoms = new THREE.InstancedMesh(blossomGeometry, blossomMaterial, 120);
    for (let i = 0; i < 120; i++) {
      const tip = tips[i % tips.length];
      dummy.position.set(tip.x + (hash(index * 31 + i) - 0.5) * 0.5, tip.y + (hash(index * 17 + i * 3) - 0.35) * 0.4, tip.z + (hash(index * 13 + i * 7) - 0.5) * 0.5);
      dummy.quaternion.identity();
      dummy.scale.setScalar(0.06 + hash(i * 1.7 + index) * 0.09);
      dummy.updateMatrix();
      blossoms.setMatrixAt(i, dummy.matrix);
      blossoms.setColorAt(i, tint.setHSL(0.93 + hash(i + index) * 0.04, 0.6 + hash(i * 2.1) * 0.2, 0.74 + hash(i * 5.3 + index) * 0.13));
    }
    tree.add(blossoms);
    tree.position.set(x, level < 0 ? backSurface(x, z) - 0.06 : level, z);
    tree.scale.setScalar(index === 4 ? 0.6 : 0.78 + hash(index + 4) * 0.3);
    group.add(tree);
    trees.push(tree);
  });

  const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), 520);
  for (let i = 0; i < 520; i++) {
    const vine = Math.floor(i / 26);
    const tier = tiers[vine % 2];
    const theta = hash(vine * 9.1) * Math.PI * 2 + (hash(i * 3.3) - 0.5) * 0.09;
    const drop = (i % 26) * 0.036 + hash(i) * 0.03;
    dummy.position.set(Math.cos(theta) * (tier.a + 0.035), tier.top - 0.02 - drop, Math.sin(theta) * (tier.b + 0.035));
    dummy.quaternion.setFromEuler(new THREE.Euler(hash(i) * 3, hash(i + 1) * 3, 0));
    dummy.scale.set(0.05 + hash(i * 2.2) * 0.03, 0.02, 0.05 + hash(i * 4.4) * 0.03);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    leaves.setColorAt(i, hash(i * 7.7) < 0.14 ? tint.setHSL(0.94, 0.65, 0.78) : tint.setHSL(0.3 + hash(i) * 0.07, 0.38, 0.36 + hash(i * 1.3) * 0.16));
  }
  group.add(leaves);

  const visitors = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.028, 0.07, 3, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), 40);
  for (let i = 0; i < 40; i++) {
    const tier = tiers[i % 3 === 0 ? 1 : 0];
    const theta = hash(i + 11) * Math.PI * 2;
    const inset = i % 3 === 0 ? 0.9 : 0.89;
    dummy.position.set(Math.cos(theta) * tier.a * inset, tier.top + 0.065, Math.sin(theta) * tier.b * inset);
    dummy.quaternion.identity();
    dummy.scale.setScalar(0.9 + hash(i) * 0.25);
    dummy.updateMatrix();
    visitors.setMatrixAt(i, dummy.matrix);
    visitors.setColorAt(i, tint.setHSL(hash(i + 6), 0.4, 0.68));
  }
  group.add(visitors);

  let triangles = 0;
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = object !== panes;
    object.receiveShadow = true;
    const size = (object.geometry.index ? object.geometry.index.count : object.geometry.getAttribute('position').count) / 3;
    triangles += size * (object instanceof THREE.InstancedMesh ? object.count : 1);
  });
  return { group, trees, flags, triangles: Math.round(triangles), windows: windows.length };
}
