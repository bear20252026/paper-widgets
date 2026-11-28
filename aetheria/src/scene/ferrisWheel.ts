import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { steel } from './materials';

export function createFerrisWheel(radius: number) {
  const wheel = new THREE.Group();
  const rotor = new THREE.Group();
  const gondolas: THREE.Object3D[] = [];
  const paint = steel('#e7a3b6');
  const pale = steel('#f4d5dc');
  const cream = new THREE.MeshPhysicalMaterial({ color: '#fff4e4', roughness: 0.4, metalness: 0.12, clearcoat: 0.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#d5e7ec', roughness: 0.12, metalness: 0.08, transparent: true, opacity: 0.72 });
  const rod = new THREE.CylinderGeometry(1, 1, 1, 7);
  const up = new THREE.Vector3(0, 1, 0);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();

  function addRod(a: THREE.Vector3, b: THREE.Vector3, thickness: number, material: THREE.Material) {
    const geometry = rod.clone();
    const direction = b.clone().sub(a);
    geometry.scale(thickness, Math.max(direction.length(), 0.001), thickness);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize()));
    geometry.translate(a.x + direction.x / 2, a.y + direction.y / 2, a.z + direction.z / 2);
    geometry.computeVertexNormals();
    const list = batches.get(material) ?? [];
    list.push(geometry);
    batches.set(material, list);
  }

  const depth = radius * 0.12;
  for (const z of [-depth / 2, depth / 2]) {
    for (const ring of [radius, radius * 0.955]) {
      const hoop = new THREE.TorusGeometry(ring, radius * 0.0075, 8, 96);
      hoop.translate(0, 0, z);
      const list = batches.get(paint) ?? [];
      list.push(hoop);
      batches.set(paint, list);
    }
    for (let i = 0; i < 28; i++) {
      const theta = (i / 28) * Math.PI * 2;
      const next = theta + Math.PI / 14;
      const rim = new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, z);
      addRod(new THREE.Vector3(Math.cos(theta) * radius * 0.08, Math.sin(theta) * radius * 0.08, z), rim, radius * 0.0032, pale);
      addRod(new THREE.Vector3(Math.cos(theta) * radius * 0.66, Math.sin(theta) * radius * 0.66, z), new THREE.Vector3(Math.cos(next) * radius, Math.sin(next) * radius, z), radius * 0.0024, paint);
      if (z > 0) addRod(rim, new THREE.Vector3(rim.x, rim.y, -depth / 2), radius * 0.0036, cream);
    }
  }
  batches.forEach((geometries, material) => {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (merged) {
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      rotor.add(mesh);
    }
  });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.07, radius * 0.07, depth * 1.8, 24), paint);
  hub.rotation.x = Math.PI / 2;
  hub.castShadow = true;
  wheel.add(hub, rotor);

  for (const z of [-depth * 0.85, depth * 0.85]) {
    const top = new THREE.Vector3(0, 0, z);
    const left = new THREE.Vector3(-radius * 0.5, -radius * 1.16, z);
    const right = new THREE.Vector3(radius * 0.5, -radius * 1.16, z);
    const legA = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.018, radius * 0.024, left.distanceTo(top), 8), paint);
    const legB = legA.clone();
    legA.position.copy(top).add(left).multiplyScalar(0.5);
    legA.quaternion.setFromUnitVectors(up, left.clone().sub(top).normalize());
    legB.position.copy(top).add(right).multiplyScalar(0.5);
    legB.quaternion.setFromUnitVectors(up, right.clone().sub(top).normalize());
    legA.castShadow = legB.castShadow = true;
    wheel.add(legA, legB);
  }

  const cabin = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.046, radius * 0.04, radius * 0.02, 10), paint);
  floor.position.y = -radius * 0.1;
  const cabinGlass = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.036, radius * 0.036, radius * 0.062, 10, 1, true), glass);
  cabinGlass.position.y = -radius * 0.058;
  const roof = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.048, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), pale);
  roof.scale.y = 0.4;
  roof.position.y = -radius * 0.024;
  cabin.add(floor, cabinGlass, roof);
  const cabinParts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  cabin.updateMatrixWorld(true);
  cabin.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) return;
    child.updateMatrix();
    const list = cabinParts.get(child.material) ?? [];
    list.push(child.geometry.clone().applyMatrix4(child.matrix));
    cabinParts.set(child.material, list);
  });
  const batchesOut: THREE.InstancedMesh[] = [];
  cabinParts.forEach((geometries, material) => {
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) return;
    const mesh = new THREE.InstancedMesh(merged, material, 24);
    mesh.castShadow = true;
    wheel.add(mesh);
    batchesOut.push(mesh);
  });
  for (let i = 0; i < 24; i++) gondolas.push(new THREE.Object3D());

  return {
    group: wheel,
    triangles: radius * 0 + 14000,
    update(time: number) {
      const angle = time * 0.11;
      rotor.rotation.z = angle;
      gondolas.forEach((gondola, i) => {
        const theta = (i / gondolas.length) * Math.PI * 2 + angle;
        gondola.position.set(Math.cos(theta) * radius, Math.sin(theta) * radius, 0);
        gondola.rotation.z = Math.sin(time * 0.55 + i) * 0.02;
        gondola.updateMatrix();
        batchesOut.forEach((batch) => batch.setMatrixAt(i, gondola.matrix));
      });
      batchesOut.forEach((batch) => { batch.instanceMatrix.needsUpdate = true; });
    },
  };
}
