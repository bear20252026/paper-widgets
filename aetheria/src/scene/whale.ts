import * as THREE from 'three';
import { sampleCurve, smoothstep } from './glsl';
import { whaleSkin } from './materials';

const TAIL = -9.4;
const NOSE = 8.9;
const SPAN = NOSE - TAIL;
const RADIUS: Array<[number, number]> = [
  [0, 0.05], [0.04, 0.2], [0.1, 0.42], [0.18, 0.88], [0.28, 1.5], [0.4, 2.02],
  [0.52, 2.28], [0.64, 2.3], [0.75, 2.16], [0.85, 1.9], [0.92, 1.5], [0.965, 0.98], [0.99, 0.48], [1, 0.12],
];

export function spinePoint(t: number) {
  const arch = Math.sin(t * Math.PI) * 0.3;
  const dip = smoothstep(0.7, 1, t) ** 1.4 * 0.55;
  const lift = t < 0.36 ? (1 - t / 0.36) ** 2 * 1.9 : 0;
  return new THREE.Vector3(TAIL + t * SPAN, arch - dip + lift, 0);
}

export function bodyRadius(t: number) {
  return sampleCurve(RADIUS, t);
}

export function backSurface(x: number, z: number) {
  const t = THREE.MathUtils.clamp((x - TAIL) / SPAN, 0, 1);
  const radius = bodyRadius(t);
  const flank = Math.sqrt(Math.max(0, 1 - (z / (radius * 0.98)) ** 2));
  return spinePoint(t).y + radius * 0.9 * flank;
}

function mouthLine(t: number) {
  return -0.12 + smoothstep(0.7, 0.99, t) * 0.5;
}

function section(t: number, a: number) {
  const radius = bodyRadius(t);
  const cy = Math.sin(a);
  const cz = Math.cos(a);
  const head = smoothstep(0.66, 0.84, t);
  const throat = smoothstep(0.5, 0.74, t) * (1 - smoothstep(0.93, 1, t));
  const ry = radius * (cy > 0 ? 0.9 - head * 0.16 : 0.9 + throat * 0.36);
  const rz = radius * (0.98 + head * 0.04);
  const mouthY = mouthLine(t);
  const mouth = smoothstep(0.69, 0.75, t) * Math.exp(-(((cy - mouthY) / 0.06) ** 2));
  const ventral = smoothstep(0.42, 0.56, t) * (1 - smoothstep(0.975, 1, t)) * smoothstep(mouthY - 0.02, mouthY - 0.3, cy);
  const ridge = 0.5 - 0.5 * Math.cos(a * 18);
  const knobs = smoothstep(0.82, 0.9, t) * (1 - smoothstep(0.985, 1, t)) * smoothstep(mouthY + 0.1, 0.9, cy)
    * Math.max(0, Math.sin(a * 9 + t * 60)) ** 3 * 0.05;
  const scale = 1 - mouth * 0.07 - ventral * 0.025 + ventral * ridge * 0.04;
  return { y: cy * ry * scale + knobs, z: cz * rz * scale, cy, mouth, ventral, ridge, mouthY };
}

function surfacePoint(t: number, a: number) {
  const center = spinePoint(t);
  const ahead = spinePoint(Math.min(1, t + 0.004));
  const behind = spinePoint(Math.max(0, t - 0.004));
  const tangent = ahead.sub(behind).normalize();
  const s = section(t, a);
  return { point: new THREE.Vector3(center.x - tangent.y * s.y, center.y + tangent.x * s.y, s.z), center, s };
}

function finSurface(length: number, width: number, thickness: number, sweep: number, knobs = 0) {
  const rows = 30;
  const cols = 12;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const u = i / rows;
    const chord = width * Math.pow(Math.sin(Math.PI * (0.07 + 0.93 * u)), 0.62) * (1 - 0.3 * u);
    for (let j = 0; j <= cols; j++) {
      const v = (j / cols) * 2 - 1;
      const th = thickness * (1 - u * 0.75) * Math.sqrt(Math.max(0, 1 - v * v));
      const y = v * chord + knobs * Math.max(0, v) ** 4 * Math.sin(u * 15) * (1 - u) - sweep * u * u;
      positions.push(u * length, y, th, u * length, y, -th);
    }
  }
  const stride = (cols + 1) * 2;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * stride + j * 2;
      indices.push(a, a + stride, a + 2, a + 2, a + stride, a + stride + 2);
      indices.push(a + 1, a + 3, a + 1 + stride, a + 3, a + 3 + stride, a + 1 + stride);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

function orient(geometry: THREE.BufferGeometry, span: THREE.Vector3, face: THREE.Vector3) {
  const s = span.clone().normalize();
  const c = new THREE.Vector3().crossVectors(face, s).normalize();
  const n = new THREE.Vector3().crossVectors(s, c);
  geometry.applyMatrix4(new THREE.Matrix4().makeBasis(s, c, n));
  geometry.computeVertexNormals();
  return geometry;
}

function mirrorZ(source: THREE.BufferGeometry) {
  const geometry = source.clone();
  geometry.scale(1, 1, -1);
  const index = geometry.index!;
  for (let i = 0; i < index.count; i += 3) {
    const b = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, b);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function makeEye() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#4f93b1', roughness: 0.6 });
  const socket = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 10, 32), skin);
  socket.scale.set(1.3, 0.85, 0.7);
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), new THREE.MeshStandardMaterial({ color: '#e9e4dc', roughness: 0.4 }));
  sclera.position.z = -0.04;
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.1, 28, 16), new THREE.MeshStandardMaterial({ color: '#b46c26', roughness: 0.3 }));
  iris.scale.z = 0.35;
  iris.position.z = 0.075;
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 12), new THREE.MeshStandardMaterial({ color: '#120c08', roughness: 0.25 }));
  pupil.scale.z = 0.3;
  pupil.position.z = 0.105;
  const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.105, 28, 18), new THREE.MeshPhysicalMaterial({
    color: '#ffffff', transparent: true, opacity: 0.08, roughness: 0.02, clearcoat: 1, envMapIntensity: 1.2, depthWrite: false,
  }));
  cornea.scale.z = 0.6;
  cornea.position.z = 0.06;
  const upper = new THREE.Mesh(new THREE.SphereGeometry(0.142, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.3), skin);
  upper.rotation.x = 0.25;
  const lower = new THREE.Mesh(new THREE.SphereGeometry(0.142, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.3), skin);
  lower.rotation.x = Math.PI - 0.2;
  group.add(socket, sclera, iris, pupil, cornea, upper, lower);
  return { group, upper };
}

export interface WhaleModel {
  group: THREE.Group;
  update: (time: number, paused: boolean) => void;
  triangles: number;
}

export function createWhale(): WhaleModel {
  const group = new THREE.Group();
  const rows = 96;
  const cols = 144;
  const positions: number[] = [];
  const colors: number[] = [];
  const dorsal = new THREE.Color('#3a98cf');
  const flank = new THREE.Color('#60bde6');
  const belly = new THREE.Color('#f6f3ee');
  const groove = new THREE.Color('#c9d6de');
  const color = new THREE.Color();
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    for (let j = 0; j <= cols; j++) {
      const a = (j / cols) * Math.PI * 2 - Math.PI / 2;
      const { point, s } = surfacePoint(t, a);
      positions.push(point.x, point.y, point.z);
      color.copy(dorsal).lerp(flank, smoothstep(0.75, -0.1, s.cy));
      const white = smoothstep(s.mouthY + 0.02, s.mouthY - 0.16, s.cy) * smoothstep(0.3, 0.5, t) * (1 - smoothstep(0.985, 1, t) * 0.5);
      color.lerp(belly, white);
      color.lerp(groove, s.ventral * (1 - s.ridge) * 0.4);
      color.multiplyScalar(1 - s.mouth * 0.35 + 0.035 * Math.sin(t * 40 + a * 3) * Math.sin(a * 7 + t * 9));
      colors.push(color.r, color.g, color.b);
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      indices.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const top = Math.round(rows * 0.5) * (cols + 1) + Math.round(cols / 2);
  if (geometry.getAttribute('normal').getY(top) < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const b = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = b;
    }
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }

  const count = 9;
  const rest = Array.from({ length: count }, (_, i) => spinePoint(i / (count - 1)));
  const bones = rest.map((_, i) => { const bone = new THREE.Bone(); bone.name = `spine-${i}`; return bone; });
  bones[4].position.copy(rest[4]);
  for (let i = 3; i >= 0; i--) { bones[i].position.copy(rest[i]).sub(rest[i + 1]); bones[i + 1].add(bones[i]); }
  for (let i = 5; i < count; i++) { bones[i].position.copy(rest[i]).sub(rest[i - 1]); bones[i - 1].add(bones[i]); }
  const vertexCount = (rows + 1) * (cols + 1);
  const skinIndex = new Uint16Array(vertexCount * 4);
  const skinWeight = new Float32Array(vertexCount * 4);
  for (let i = 0; i <= rows; i++) {
    const f = (i / rows) * (count - 1);
    const i0 = Math.min(count - 2, Math.floor(f));
    const w = smoothstep(0, 1, f - i0);
    for (let j = 0; j <= cols; j++) {
      const v = (i * (cols + 1) + j) * 4;
      skinIndex[v] = i0;
      skinIndex[v + 1] = i0 + 1;
      skinWeight[v] = 1 - w;
      skinWeight[v + 1] = w;
    }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  const body = new THREE.SkinnedMesh(geometry, whaleSkin(true));
  body.castShadow = body.receiveShadow = true;
  body.frustumCulled = false;
  body.add(bones[4]);
  body.bind(new THREE.Skeleton(bones));
  group.add(body);

  const finMaterial = whaleSkin(false);
  const attach = (object: THREE.Object3D, bone: number, world: THREE.Vector3) => {
    object.position.copy(world).sub(rest[bone]);
    bones[bone].add(object);
  };
  const pectoral = orient(finSurface(5.2, 0.8, 0.13, 0.55, 0.05), new THREE.Vector3(-0.42, -0.62, 0.66), new THREE.Vector3(0.25, 0.55, 0.8));
  const rightFin = new THREE.Mesh(pectoral, finMaterial);
  const leftFin = new THREE.Mesh(mirrorZ(pectoral), finMaterial);
  const shoulder = surfacePoint(0.63, -0.433).point;
  attach(rightFin, 5, shoulder.clone().add(new THREE.Vector3(0, 0.1, -0.3)));
  attach(leftFin, 5, new THREE.Vector3(shoulder.x, shoulder.y + 0.1, -shoulder.z + 0.3));

  const lobe = orient(finSurface(2.7, 0.8, 0.085, 1.0), new THREE.Vector3(-0.5, 0, 0.87), new THREE.Vector3(0, 1, 0));
  const fluke = new THREE.Group();
  fluke.add(new THREE.Mesh(lobe, finMaterial), new THREE.Mesh(mirrorZ(lobe), finMaterial));
  fluke.rotation.z = -0.5;
  attach(fluke, 0, rest[0]);

  const dorsalFin = new THREE.Mesh(orient(finSurface(0.9, 0.42, 0.07, 0.5), new THREE.Vector3(-0.45, 0.9, 0), new THREE.Vector3(0, 0, -1)), finMaterial);
  attach(dorsalFin, 2, surfacePoint(0.3, Math.PI / 2).point.add(new THREE.Vector3(0, -0.08, 0)));

  const eyes = [0.14, Math.PI - 0.14].map((angle) => {
    const { point, center } = surfacePoint(0.775, angle);
    const outward = point.clone().sub(center).normalize();
    const eye = makeEye();
    eye.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward);
    eye.group.scale.setScalar(1.25);
    attach(eye.group, 6, point.addScaledVector(outward, -0.08));
    return eye;
  });

  const bumps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), finMaterial, 44);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 44; i++) {
    const t = 0.86 + (i % 11) * 0.011;
    const angle = Math.PI / 2 + ((Math.floor(i / 11) - 1.5) * 0.42) + Math.sin(i * 3.1) * 0.08;
    dummy.position.copy(surfacePoint(t, angle).point).sub(rest[7]);
    dummy.scale.setScalar(0.6 + (Math.sin(i * 12.9) * 0.5 + 0.5) * 0.9);
    dummy.updateMatrix();
    bumps.setMatrixAt(i, dummy.matrix);
  }
  bones[7].add(bumps);
  group.traverse((object) => {
    if (object instanceof THREE.Mesh && object !== body) object.castShadow = object.receiveShadow = true;
  });

  let last = 0;
  let blink = 0;
  let nextBlink = 3.5;
  const tailAmp = [0.075, 0.055, 0.04, 0.022];
  return {
    group,
    triangles: Math.round(indices.length / 3 + (pectoral.index!.count * 2 + lobe.index!.count * 2 + dorsalFin.geometry.index!.count) / 3),
    update(time, paused) {
      const dt = Math.min(0.1, Math.max(0, time - last));
      last = time;
      if (!paused) {
        for (let i = 0; i < 4; i++) bones[i].rotation.z = Math.sin(time * 0.85 - (3 - i) * 0.55 - 0.6) * tailAmp[i];
        for (let i = 5; i < count; i++) bones[i].rotation.z = Math.sin(time * 0.85 + (i - 4) * 0.35) * 0.008;
        fluke.rotation.z = -0.5 + Math.sin(time * 0.85 - 2.9) * 0.14;
        const stroke = Math.sin(time * 0.55 - 0.9) * 0.16 + Math.sin(time * 0.23) * 0.05;
        rightFin.rotation.x = stroke;
        leftFin.rotation.x = -stroke;
        blink += dt;
        const phase = blink - nextBlink;
        const shut = phase > 0 && phase < 0.24 ? Math.sin((phase / 0.24) * Math.PI) : 0;
        eyes.forEach((eye) => { eye.upper.rotation.x = 0.25 + shut * 0.95; });
        if (phase > 0.3) { blink = 0; nextBlink = 3 + (Math.sin(time * 7.7) * 0.5 + 0.5) * 4; }
      }
      group.position.y = Math.sin(time * 0.42) * 0.09 + Math.sin(time * 0.17) * 0.04;
      group.rotation.z = Math.sin(time * 0.42 - 1.1) * 0.014;
      group.rotation.x = Math.sin(time * 0.26) * 0.012;
    },
  };
}
