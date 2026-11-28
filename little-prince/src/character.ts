import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type CharacterQuality = 'LOD0' | 'LOD1';
export type RenderTier = 'quality' | 'performance';
type Part = 'body' | 'head' | 'neck' | 'cape' | 'coat' | 'armL' | 'armR' | 'handL' | 'handR' | 'legL' | 'legR' | 'footL' | 'footR';

export interface CharacterAsset {
  group: THREE.Group;
  skeleton: THREE.Skeleton;
  materials: THREE.MeshPhysicalMaterial[];
  frameUniforms: { scarfTime: THREE.IUniform<number>; sssLightDirection: THREE.IUniform<THREE.Vector3> };
  clip: THREE.AnimationClip;
  triangles: number;
  meshes: number;
  bones: number;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function texture(kind: 'normal' | 'roughness', seed: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(128, 128);
  let value = seed;
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      value = (value * 1664525 + 1013904223) >>> 0;
      const noise = (value >>> 25) / 127;
      const i = (y * 128 + x) * 4;
      if (kind === 'normal') {
        image.data[i] = 128 + Math.round(Math.sin(x * Math.PI / 2) * 3 + (noise - 0.5) * 2);
        image.data[i + 1] = 128 + Math.round(Math.sin(y * Math.PI / 2) * 3 + (noise - 0.5) * 2);
        image.data[i + 2] = 255;
      } else {
        const shade = 229 + Math.round(noise * 15);
        image.data[i] = shade;
        image.data[i + 1] = shade;
        image.data[i + 2] = shade;
      }
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const result = new THREE.CanvasTexture(canvas);
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.repeat.set(2, 2);
  result.name = kind === 'normal' ? 'Subtle woven normal' : 'Woven roughness';
  return result;
}

function occlusionTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(128, 128);
  let value = 8321;
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      value = (value * 1664525 + 1013904223) >>> 0;
      const fine = (value >>> 24) / 255;
      const broad = (Math.sin(x * 0.18) * Math.sin(y * 0.12) + 1) * 0.5;
      const shade = Math.round(225 + broad * 19 + fine * 11);
      const i = (y * 128 + x) * 4;
      image.data[i] = shade;
      image.data[i + 1] = shade;
      image.data[i + 2] = shade;
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const result = new THREE.CanvasTexture(canvas);
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.repeat.set(2, 2);
  result.colorSpace = THREE.NoColorSpace;
  result.name = 'Woven occlusion detail';
  return result;
}

function clothColorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#f9f8f4';
  context.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 32; i++) {
    const x = (i * 41) % 128;
    const y = (i * 67) % 128;
    context.strokeStyle = i % 2 ? 'rgba(115, 108, 91, 0.025)' : 'rgba(255, 255, 255, 0.15)';
    context.lineWidth = 1 + (i % 3);
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x + 8, y - 3, x + 19, y + 4, x + 30, y + 1);
    context.stroke();
  }
  const result = new THREE.CanvasTexture(canvas);
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.repeat.set(2, 2);
  result.colorSpace = THREE.SRGBColorSpace;
  result.name = 'Soft painted fabric color';
  return result;
}

function faceColorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#efc2a3';
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (const x of [0.185, 0.315]) {
    const gradient = context.createRadialGradient(x * 512, 0.54 * 256, 1, x * 512, 0.54 * 256, 34);
    gradient.addColorStop(0, 'rgba(180, 94, 85, 0.20)');
    gradient.addColorStop(1, 'rgba(180, 94, 85, 0)');
    context.fillStyle = gradient;
    context.fillRect(x * 512 - 35, 0.54 * 256 - 35, 70, 70);
  }
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  result.name = 'Hand-tinted face color';
  return result;
}

function makeSurface(
  rows: number,
  columns: number,
  point: (u: number, w: number) => THREE.Vector3,
) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const w = row / rows;
      const p = point(u, w);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, 1 - w);
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function ringSurface(rings: Array<[number, number, number, number?]>, columns: number) {
  return makeSurface(rings.length - 1, columns, (u, w) => {
    const f = w * (rings.length - 1);
    const i = Math.min(Math.floor(f), rings.length - 2);
    const t = f - i;
    const a = rings[i];
    const b = rings[i + 1];
    const angle = u * Math.PI * 2;
    const y = THREE.MathUtils.lerp(a[0], b[0], t);
    const rx = THREE.MathUtils.lerp(a[1], b[1], t);
    const rz = THREE.MathUtils.lerp(a[2], b[2], t);
    const z = THREE.MathUtils.lerp(a[3] || 0, b[3] || 0, t);
    return v(Math.sin(angle) * rx, y, Math.cos(angle) * rz + z);
  });
}

function curvedLimb(points: THREE.Vector3[], radii: number[], rows: number, columns: number, depth = 0.9) {
  const curve = new THREE.CatmullRomCurve3(points);
  return makeSurface(rows, columns, (u, w) => {
    const center = curve.getPoint(w);
    const tangent = curve.getTangent(w).normalize();
    const side = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const depthAxis = new THREE.Vector3().crossVectors(tangent, side).normalize();
    const f = w * (radii.length - 1);
    const i = Math.min(Math.floor(f), radii.length - 2);
    const radius = THREE.MathUtils.lerp(radii[i], radii[i + 1], f - i);
    const angle = u * Math.PI * 2;
    return center.addScaledVector(side, Math.cos(angle) * radius).addScaledVector(depthAxis, Math.sin(angle) * radius * depth);
  });
}

function lockGeometry(points: THREE.Vector3[], width: number, rows: number, columns: number) {
  const curve = new THREE.CatmullRomCurve3(points);
  return makeSurface(rows, columns, (u, w) => {
    const center = curve.getPoint(w);
    const tangent = curve.getTangent(w).normalize();
    let side = new THREE.Vector3().crossVectors(tangent, v(0, 0, 1)).normalize();
    if (side.lengthSq() < 0.01) side = v(1, 0, 0);
    const other = new THREE.Vector3().crossVectors(tangent, side).normalize();
    const envelope = Math.pow(Math.sin(Math.PI * (0.08 + w * 0.9)), 0.62) * (1 - 0.4 * w);
    const radius = width * envelope + 0.002;
    const angle = u * Math.PI * 2;
    return center.addScaledVector(side, Math.cos(angle) * radius).addScaledVector(other, Math.sin(angle) * radius * 0.67);
  });
}

function sphereGeometry(x: number, y: number, z: number, sx: number, sy: number, sz: number, segments: number, rotation = 0) {
  const geometry = new THREE.SphereGeometry(1, segments, Math.max(8, Math.floor(segments * 0.7)));
  geometry.scale(sx, sy, sz);
  if (rotation) geometry.rotateZ(rotation);
  geometry.translate(x, y, z);
  return geometry;
}

function lineGeometry(points: THREE.Vector3[], radius: number, segments: number) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 6, false);
}

function makeRig(group: THREE.Group) {
  const bones: THREE.Bone[] = [];
  const byName: Record<string, number> = {};
  const bone = (name: string, position: THREE.Vector3, parent?: THREE.Bone) => {
    const result = new THREE.Bone();
    result.name = name;
    result.position.copy(position);
    if (parent) parent.add(result); else group.add(result);
    byName[name] = bones.length;
    bones.push(result);
    return result;
  };
  const root = bone('Root', v(0, 0, 0));
  const hips = bone('Hips', v(0, 2.18, 0), root);
  const spine = bone('Spine', v(0, 0.43, 0), hips);
  const chest = bone('Chest', v(0, 0.47, 0), spine);
  const neck = bone('Neck', v(0, 0.24, 0), chest);
  bone('Head', v(0, 0.24, 0), neck);
  for (const [side, direction] of [['L', -1], ['R', 1]] as const) {
    const upperArm = bone(`UpperArm_${side}`, v(direction * 0.38, 0, 0), chest);
    const forearm = bone(`Forearm_${side}`, v(direction * 0.31, -0.35, 0), upperArm);
    bone(`Hand_${side}`, v(direction * 0.3, -0.34, 0), forearm);
    const upperLeg = bone(`UpperLeg_${side}`, v(direction * 0.18, -0.04, 0), hips);
    const lowerLeg = bone(`LowerLeg_${side}`, v(0, -0.7, 0), upperLeg);
    bone(`Foot_${side}`, v(0, -0.68, 0), lowerLeg);
  }
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();
  return { skeleton, byName };
}

function skinGeometry(geometry: THREE.BufferGeometry, part: Part, index: Record<string, number>) {
  const position = geometry.getAttribute('position');
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const blend = (a: string, b: string, amount: number) => [index[a], index[b], THREE.MathUtils.clamp(amount, 0, 1)] as const;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    let a = index.Hips;
    let b = a;
    let amount = 0;
    if (part === 'head') a = b = index.Head;
    else if (part === 'neck') a = b = index.Neck;
    else if (part === 'cape') a = b = index.Chest;
    else if (part === 'coat') a = b = index.Hips;
    else if (part === 'body') {
      if (y < 2.65) [a, b, amount] = blend('Hips', 'Spine', (y - 2.3) / 0.35);
      else [a, b, amount] = blend('Spine', 'Chest', (y - 2.65) / 0.38);
    } else if (part.startsWith('arm')) {
      const side = part.endsWith('L') ? 'L' : 'R';
      if (y > 2.57) [a, b, amount] = blend(`Forearm_${side}`, `UpperArm_${side}`, (y - 2.62) / 0.3);
      else [a, b, amount] = blend(`Hand_${side}`, `Forearm_${side}`, (y - 2.35) / 0.23);
    } else if (part.startsWith('hand')) a = b = index[`Hand_${part.endsWith('L') ? 'L' : 'R'}`];
    else if (part.startsWith('leg')) {
      const side = part.endsWith('L') ? 'L' : 'R';
      if (y > 1.22) [a, b, amount] = blend(`LowerLeg_${side}`, `UpperLeg_${side}`, (y - 1.25) / 0.35);
      else [a, b, amount] = blend(`Foot_${side}`, `LowerLeg_${side}`, (y - 0.65) / 0.3);
    } else if (part.startsWith('foot')) a = b = index[`Foot_${part.endsWith('L') ? 'L' : 'R'}`];
    skinIndices.push(a, b, 0, 0);
    skinWeights.push(1 - amount, amount, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
}

function idleClip() {
  const times = [0, 1.5, 3];
  const track = (name: string, angles: number[]) => {
    const values: number[] = [];
    for (const angle of angles) {
      const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, angle));
      values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    }
    return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
  };
  return new THREE.AnimationClip('Gentle_Idle', 3, [
    track('Chest', [-0.008, 0.008, -0.008]),
    track('Head', [0.015, -0.015, 0.015]),
    track('UpperArm_L', [0.006, -0.012, 0.006]),
    track('UpperArm_R', [-0.006, 0.012, -0.006]),
  ]);
}

export function createCharacter(quality: CharacterQuality, tier: RenderTier = 'quality'): CharacterAsset {
  const group = new THREE.Group();
  group.name = 'The_Little_Prince';
  const { skeleton, byName } = makeRig(group);
  const detail = quality === 'LOD0' ? 1 : 0.65;
  const mobile = tier === 'performance';
  const seg = (n: number) => Math.max(6, Math.round(n * detail));
  const normal = texture('normal', 42);
  const rough = texture('roughness', 128);
  const ao = occlusionTexture();
  const clothColor = clothColorTexture();
  const faceColor = faceColorTexture();
  const frameUniforms = {
    scarfTime: { value: 0 },
    sssLightDirection: { value: v(0, 1, 0) },
  };
  const material = (name: string, color: string, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => {
    const result = new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.88, ...options });
    return result;
  };
  const woven = { map: clothColor, normalMap: normal, normalScale: new THREE.Vector2(mobile ? 0.16 : 0.23, mobile ? 0.16 : 0.23), roughnessMap: rough, aoMap: ao, aoMapIntensity: mobile ? 0.12 : 0.19 };
  const clothSheen = mobile ? 0.12 : 0.27;
  const coat = material('01 - Forest wool', '#344b38', { ...woven, roughness: 0.94, sheen: clothSheen, sheenColor: '#72816a', sheenRoughness: 0.86, side: THREE.DoubleSide });
  const coatLight = material('02 - Forest wool facing', '#405741', { ...woven, roughness: 0.95, sheen: clothSheen, sheenColor: '#839179', sheenRoughness: 0.9, side: THREE.DoubleSide });
  const coatDark = material('03 - Coat lining', '#263b30', { ...woven, roughness: 0.97, sheen: mobile ? 0.06 : 0.15, side: THREE.DoubleSide });
  const trousers = material('04 - Moss trousers', '#485646', { ...woven, roughness: 0.96, sheen: clothSheen * 0.7 });
  const scarf = material('05 - Golden scarf', '#d0a538', { ...woven, roughness: 0.91, sheen: mobile ? 0.16 : 0.34, sheenColor: '#dabb72', sheenRoughness: 0.8, side: THREE.DoubleSide });
  const scarfLight = material('06 - Scarf fold', '#e0bb61', { ...woven, roughness: 0.92, sheen: mobile ? 0.12 : 0.24, side: THREE.DoubleSide });
  const cape = material('07 - Rosewood cape', '#863b36', { ...woven, roughness: 0.94, sheen: clothSheen * 0.8, side: THREE.DoubleSide });
  const skin = material('08 - Warm soft skin', '#eab996', { roughness: 0.61, metalness: 0, sheen: mobile ? 0.04 : 0.1, sheenColor: '#e8a98c', clearcoat: 0.035, clearcoatRoughness: 0.58, ior: 1.36 });
  const faceSkin = material('08b - Hand-tinted skin', '#ffffff', { map: faceColor, roughness: 0.62, sheen: mobile ? 0.035 : 0.075, sheenColor: '#edb396', ior: 1.36 });
  skin.onBeforeCompile = (shader) => {
    shader.uniforms.uSSSKeyDirectionView = frameUniforms.sssLightDirection;
    shader.uniforms.uSSSTint = { value: new THREE.Color('#e18b78') };
    shader.uniforms.uSSSStrength = { value: mobile ? 0.36 : 0.52 };
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      'uniform vec3 uSSSKeyDirectionView;\nuniform vec3 uSSSTint;\nuniform float uSSSStrength;\nvoid main() {',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
float princeLightWrap = max((dot(geometryNormal, normalize(uSSSKeyDirectionView)) + 0.32) / 1.32, 0.0);
float princeBackScatter = pow(max(dot(-geometryNormal, normalize(uSSSKeyDirectionView)), 0.0), 1.7);
float princeFaceEdge = pow(1.0 - max(dot(geometryNormal, geometryViewDir), 0.0), 3.0);
reflectedLight.directDiffuse += diffuseColor.rgb * uSSSTint * uSSSStrength * (princeLightWrap * 0.026 + princeBackScatter * 0.085 + princeFaceEdge * 0.015);`,
    );
  };
  skin.customProgramCacheKey = () => `aster-skin-sss-r186-${mobile ? 'mobile' : 'desktop'}`;
  faceSkin.onBeforeCompile = skin.onBeforeCompile;
  faceSkin.customProgramCacheKey = skin.customProgramCacheKey;
  const skinShade = material('09 - Skin details', '#bd8875', { roughness: 0.98 });
  const lip = material('10 - Lips', '#a96760', { roughness: 1 });
  const hair = material('11 - Golden hair', '#d0a547', { roughness: 0.59, anisotropy: mobile ? 0.12 : 0.36, anisotropyRotation: Math.PI / 2, sheen: mobile ? 0.04 : 0.1 });
  const hairLight = material('12 - Golden highlights', '#e1c070', { roughness: 0.53, anisotropy: mobile ? 0.1 : 0.31, anisotropyRotation: Math.PI / 2, sheen: mobile ? 0.04 : 0.12 });
  const hairDark = material('13 - Hair shadows', '#a97b34', { roughness: 0.67, anisotropy: mobile ? 0.07 : 0.2, anisotropyRotation: Math.PI / 2 });
  const leather = material('14 - Aged leather', '#55443b', { ...woven, roughness: 0.72, clearcoat: 0.1, clearcoatRoughness: 0.64 });
  const leatherLight = material('15 - Leather edges', '#826b56', { roughness: 0.79, clearcoat: 0.06, clearcoatRoughness: 0.7 });
  const sole = material('16 - Boot soles', '#302c29', { roughness: 0.95 });
  const gold = material('17 - Aged brass', '#b99b62', { metalness: 0.72, roughness: 0.4, clearcoat: 0.08 });
  const stitch = material('18 - Stitching', '#9d9673', { roughness: 1 });
  const eyeWhite = material('19 - Eye white', '#fff4e5', { roughness: 0.9 });
  const eye = material('20 - Hazel eyes', '#51433b', { roughness: 0.74 });
  const dark = material('21 - Dark details', '#382d29', { roughness: 0.9 });
  const materials = [coat, coatLight, coatDark, trousers, scarf, scarfLight, cape, skin, faceSkin, skinShade, lip, hair, hairLight, hairDark, leather, leatherLight, sole, gold, stitch, eyeWhite, eye, dark];
  let triangles = 0;
  let meshes = 0;
  const add = (name: string, geometry: THREE.BufferGeometry, mat: THREE.MeshPhysicalMaterial, part: Part) => {
    const uv = geometry.getAttribute('uv');
    if (mat.aoMap && uv) geometry.setAttribute('uv1', uv.clone());
    skinGeometry(geometry, part, byName);
    const mesh = new THREE.SkinnedMesh(geometry, mat);
    mesh.name = name;
    mesh.userData.part = part;
    mesh.castShadow = part !== 'neck';
    mesh.receiveShadow = true;
    group.add(mesh);
    mesh.bind(skeleton, new THREE.Matrix4());
    triangles += (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;
    meshes++;
    return mesh;
  };
  const sphere = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.MeshPhysicalMaterial, part: Part, rotation = 0) =>
    add(name, sphereGeometry(x, y, z, sx, sy, sz, seg(22), rotation), mat, part);
  const line = (name: string, points: THREE.Vector3[], radius: number, mat: THREE.MeshPhysicalMaterial, part: Part) =>
    add(name, lineGeometry(points, radius, seg(20)), mat, part);

  // The short cape is a separate gently curved cloth surface behind the jacket.
  add('Cape - separate cloth', makeSurface(seg(16), seg(24), (u, w) => {
    const x = (u - 0.5) * (0.75 + w * 0.44);
    const y = 3.1 - w * 0.71 + Math.pow(Math.abs(u - 0.5) * 2, 2) * 0.07 * w;
    const z = -0.16 - w * 0.13 - Math.sin(u * Math.PI) * 0.07 + Math.sin(u * Math.PI * 5) * 0.018 * w;
    return v(x, y, z);
  }), cape, 'cape');
  for (const side of [-1, 1]) {
    line(`Cape edge ${side}`, [v(side * 0.37, 3.1, -0.17), v(side * 0.48, 2.8, -0.22), v(side * 0.59, 2.42, -0.28)], 0.008, scarfLight, 'cape');
  }

  // The rear coat and two open front tails stay independent of the legs.
  add('Coat - back tails', makeSurface(seg(14), seg(22), (u, w) => {
    const x = (u - 0.5) * (0.73 + w * 0.3);
    return v(x, 2.38 - w * 1.24 + Math.abs(u - 0.5) * w * 0.09, -0.255 - Math.sin(u * Math.PI) * 0.02);
  }), coatDark, 'coat');
  line('Back coat center seam', [v(0, 2.37, -0.279), v(0, 1.95, -0.28), v(0, 1.55, -0.28), v(0, 1.16, -0.28)], 0.004, coatLight, 'coat');
  for (const [side, label] of [[-1, 'L'], [1, 'R']] as const) {
    add(`Coat - ${label} open tail`, makeSurface(seg(16), seg(8), (u, w) => {
      const inner = 0.235 + 0.13 * w;
      const outer = 0.39 + 0.24 * w;
      const x = side * THREE.MathUtils.lerp(inner, outer, u);
      return v(x, 2.4 - w * 1.25 + u * w * 0.06, 0.145 - 0.055 * w - u * 0.04 + Math.sin(w * Math.PI * 2) * 0.01);
    }), coat, 'coat');
    line(`Coat tail piping ${label}`, [v(side * 0.24, 2.4, 0.155), v(side * 0.28, 2.0, 0.145), v(side * 0.32, 1.55, 0.12), v(side * 0.37, 1.16, 0.105)], 0.006, stitch, 'coat');
  }

  for (const [side, label] of [[-1, 'L'], [1, 'R']] as const) {
    const legPart = `leg${label}` as Part;
    const footPart = `foot${label}` as Part;
    const x = side * 0.185;
    add(`Trousers ${label}`, curvedLimb([v(x, 2.2, 0), v(x * 1.03, 1.75, 0), v(x * 1.05, 1.37, 0.015), v(x * 1.02, 0.92, 0)], [0.17, 0.155, 0.135, 0.11], seg(20), seg(20), 0.91), trousers, legPart);
    line(`Trouser seam ${label}`, [v(x + side * 0.13, 2.05, 0.055), v(x + side * 0.12, 1.65, 0.065), v(x + side * 0.105, 1.2, 0.06)], 0.004, coatLight, legPart);
    for (let i = 0; i < 2; i++) {
      line(`Trouser fold ${label} ${i}`, [v(x - 0.09, 1.12 + i * 0.13, 0.085), v(x, 1.1 + i * 0.13, 0.12), v(x + 0.09, 1.13 + i * 0.13, 0.08)], 0.004, coatDark, legPart);
    }
    const shaft = ringSurface([[0.96, 0.145, 0.135], [0.91, 0.153, 0.14], [0.78, 0.137, 0.13], [0.48, 0.126, 0.13], [0.34, 0.14, 0.145]], seg(22));
    shaft.translate(x, 0, 0);
    add(`Leather boot shaft ${label}`, shaft, leather, footPart);
    const rim = new THREE.TorusGeometry(0.143, 0.013, seg(8), seg(24));
    rim.rotateX(Math.PI / 2);
    rim.scale(1, 0.92, 1);
    rim.translate(x, 0.94, 0);
    add(`Boot top ${label}`, rim, leatherLight, footPart);
    sphere(`Boot toe ${label}`, x, 0.24, 0.11, 0.15, 0.18, 0.29, leather, footPart);
    sphere(`Boot sole ${label}`, x, 0.085, 0.105, 0.157, 0.052, 0.30, sole, footPart);
    line(`Boot welt ${label}`, [v(x - 0.14, 0.13, 0.1), v(x - 0.13, 0.13, 0.3), v(x, 0.13, 0.39), v(x + 0.13, 0.13, 0.3), v(x + 0.14, 0.13, 0.1)], 0.006, leatherLight, footPart);
    line(`Boot seam ${label}`, [v(x - 0.12, 0.38, 0.1), v(x, 0.40, 0.16), v(x + 0.12, 0.38, 0.1)], 0.005, leatherLight, footPart);
    for (let i = 0; i < 3; i++) {
      line(`Leather crease ${label} ${i}`, [v(x - 0.095, 0.27 + i * 0.035, 0.26 - i * 0.035), v(x, 0.275 + i * 0.035, 0.3 - i * 0.035), v(x + 0.095, 0.27 + i * 0.035, 0.26 - i * 0.035)], 0.003, leatherLight, footPart);
    }
  }

  add('Tailored jacket', ringSurface([
    [3.15, 0.32, 0.19], [3.08, 0.41, 0.225], [2.94, 0.41, 0.245],
    [2.75, 0.37, 0.24], [2.56, 0.35, 0.22], [2.37, 0.39, 0.225],
    [2.2, 0.43, 0.235], [2.13, 0.43, 0.23],
  ], seg(32)), coat, 'body');

  // Subtle layered front panels and antiqued edge piping define the tailoring.
  for (const [side, label] of [[-1, 'L'], [1, 'R']] as const) {
    add(`Jacket facing ${label}`, makeSurface(seg(12), seg(9), (u, w) => {
      const inner = 0.055 - w * 0.03;
      const outer = 0.31 - w * 0.065;
      const x = side * THREE.MathUtils.lerp(inner, outer, u);
      const y = 3.04 - w * 0.83;
      const z = 0.245 - Math.pow(Math.abs(x) / 0.43, 2) * 0.07 + Math.sin(w * Math.PI) * 0.007;
      return v(x, y, z);
    }), coatLight, 'body');
    line(`Lapels ${label}`, [v(side * 0.30, 3.05, 0.17), v(side * 0.21, 2.91, 0.22), v(side * 0.10, 2.76, 0.25), v(side * 0.035, 2.67, 0.25)], 0.008, stitch, 'body');
    line(`Front piping ${label}`, [v(side * 0.27, 2.83, 0.20), v(side * 0.23, 2.62, 0.225), v(side * 0.23, 2.40, 0.22), v(side * 0.26, 2.18, 0.20)], 0.005, stitch, 'body');
    for (let i = 0; i < 4; i++) {
      const y = 2.91 - i * 0.16;
      const bx = side * (0.16 + i * 0.008);
      sphere(`Brass button ${label} ${i}`, bx, y, 0.249, 0.034, 0.034, 0.016, gold, 'body');
      sphere(`Button inset ${label} ${i}`, bx, y, 0.265, 0.012, 0.012, 0.004, leatherLight, 'body');
    }
    add(`Shoulder tab ${label}`, makeSurface(seg(4), seg(6), (u, w) => v(side * (0.20 + u * 0.23), 3.11 - w * 0.052 - u * 0.018, 0.08 - w * 0.12)), coatDark, 'body');
    line(`Shoulder tab edge ${label}`, [v(side * 0.2, 3.115, 0.075), v(side * 0.32, 3.105, 0.065), v(side * 0.42, 3.085, 0.055)], 0.007, gold, 'body');
    sphere(`Shoulder stud ${label}`, side * 0.35, 3.102, 0.054, 0.022, 0.01, 0.02, gold, 'body');
  }
  line('Center jacket seam', [v(0.012, 2.75, 0.255), v(0.012, 2.52, 0.248), v(0.012, 2.27, 0.24)], 0.005, coatDark, 'body');
  add('Waist belt', makeSurface(seg(4), seg(24), (u, w) => {
    const angle = u * Math.PI * 2;
    return v(Math.sin(angle) * 0.365, 2.42 - w * 0.075, Math.cos(angle) * 0.232);
  }), coatDark, 'body');
  line('Belt edge upper', [v(-0.3, 2.42, 0.14), v(-0.18, 2.42, 0.21), v(0, 2.42, 0.235), v(0.18, 2.42, 0.21), v(0.3, 2.42, 0.14)], 0.004, stitch, 'body');
  sphere('Belt clasp', 0.055, 2.382, 0.238, 0.047, 0.037, 0.014, gold, 'body');

  for (const [side, label] of [[-1, 'L'], [1, 'R']] as const) {
    const armPart = `arm${label}` as Part;
    const handPart = `hand${label}` as Part;
    const shoulder = v(side * 0.36, 3.06, 0);
    const elbow = v(side * 0.68, 2.72, 0.005);
    const wrist = v(side * 0.98, 2.37, 0.035);
    add(`Sleeve ${label}`, curvedLimb([shoulder, v(side * 0.52, 2.91, 0), elbow, v(side * 0.84, 2.55, 0.015), wrist], [0.15, 0.14, 0.127, 0.112, 0.1], seg(22), seg(20)), coat, armPart);
    sphere(`Shoulder ${label}`, side * 0.4, 3.04, 0, 0.15, 0.15, 0.16, coat, armPart);
    add(`Cuff ${label}`, curvedLimb([v(side * 0.91, 2.46, 0.03), v(side * 0.99, 2.36, 0.035)], [0.113, 0.11], seg(5), seg(20)), coatDark, armPart);
    line(`Cuff seam ${label}`, [v(side * 0.89, 2.47, 0.11), v(side * 0.94, 2.43, 0.14), v(side * 1.01, 2.37, 0.11)], 0.006, gold, armPart);
    sphere(`Cuff button ${label}`, side * 0.96, 2.41, 0.139, 0.018, 0.018, 0.009, gold, armPart);
    sphere(`Palm ${label}`, side * 1.04, 2.27, 0.035, 0.075, 0.12, 0.048, skin, handPart, side * -0.3);
    sphere(`Thumb ${label}`, side * 0.975, 2.24, 0.075, 0.029, 0.075, 0.026, skin, handPart, side * 0.6);
    for (let i = 0; i < 4; i++) {
      const fx = side * (1.005 + i * 0.023);
      const fy = 2.18 - (i === 1 || i === 2 ? 0.018 : 0);
      sphere(`Finger ${label} ${i}`, fx, fy, 0.035, 0.015, 0.065 - Math.abs(1.5 - i) * 0.008, 0.018, skin, handPart, side * -0.12);
    }
  }

  sphere('Neck', 0, 3.34, 0, 0.13, 0.20, 0.12, skin, 'neck');
  const headGeometry = new THREE.SphereGeometry(1, seg(36), seg(28));
  const headPosition = headGeometry.getAttribute('position');
  for (let i = 0; i < headPosition.count; i++) {
    const py = headPosition.getY(i);
    const jaw = py < 0 ? 0.84 + (py + 1) * 0.16 : 1;
    headPosition.setXYZ(i, headPosition.getX(i) * 0.34 * jaw, py * 0.46 + 3.78, headPosition.getZ(i) * 0.30);
  }
  headGeometry.computeVertexNormals();
  add('Face', headGeometry, faceSkin, 'head');
  for (const side of [-1, 1]) {
    sphere(`Ear ${side}`, side * 0.325, 3.77, 0.0, 0.06, 0.105, 0.048, skin, 'head');
    sphere(`Ear detail ${side}`, side * 0.355, 3.77, 0.035, 0.017, 0.053, 0.008, skinShade, 'head');
    sphere(`Eye white ${side}`, side * 0.115, 3.825, 0.282, 0.052, 0.032, 0.012, eyeWhite, 'head');
    sphere(`Iris ${side}`, side * 0.115, 3.824, 0.293, 0.025, 0.029, 0.008, eye, 'head');
    sphere(`Pupil ${side}`, side * 0.115, 3.824, 0.300, 0.010, 0.017, 0.004, dark, 'head');
    sphere(`Eye glint ${side}`, side * 0.108, 3.834, 0.305, 0.005, 0.006, 0.003, eyeWhite, 'head');
    line(`Upper eyelid ${side}`, [v(side * 0.064, 3.838, 0.279), v(side * 0.112, 3.858, 0.286), v(side * 0.163, 3.84, 0.267)], 0.005, dark, 'head');
    line(`Eyebrow ${side}`, [v(side * 0.07, 3.91, 0.277), v(side * 0.115, 3.921, 0.28), v(side * 0.16, 3.91, 0.265)], 0.006, hairDark, 'head');
  }
  sphere('Nose', 0, 3.72, 0.296, 0.025, 0.04, 0.028, skin, 'head');
  line('Mouth', [v(-0.045, 3.645, 0.273), v(0, 3.638, 0.286), v(0.045, 3.645, 0.273)], 0.0045, lip, 'head');
  line('Lower lip', [v(-0.024, 3.625, 0.273), v(0, 3.622, 0.278), v(0.024, 3.625, 0.273)], 0.003, skinShade, 'head');

  const hairCap = new THREE.SphereGeometry(1, seg(32), seg(22), 0, Math.PI * 2, 0, Math.PI * 0.53);
  hairCap.scale(0.37, 0.34, 0.32);
  hairCap.translate(0, 4.03, -0.02);
  add('Hair cap', hairCap, hair, 'head');
  add('Hairline and back layer', makeSurface(seg(18), seg(32), (u, w) => {
    const angle = u * Math.PI * 2;
    const back = (1 - Math.cos(angle)) / 2;
    const theta = w * THREE.MathUtils.lerp(1.1, 1.86, back);
    return v(0.355 * Math.sin(theta) * Math.sin(angle), 3.78 + 0.475 * Math.cos(theta), 0.315 * Math.sin(theta) * Math.cos(angle));
  }), hair, 'head');
  const locks: Array<[number[][], number, THREE.MeshPhysicalMaterial]> = [
    [[[-0.05, 4.25, 0.13], [-0.21, 4.26, 0.25], [-0.29, 4.13, 0.30], [-0.24, 3.99, 0.26]], 0.13, hairLight],
    [[[0.02, 4.32, 0.10], [-0.06, 4.30, 0.28], [-0.15, 4.17, 0.32], [-0.10, 4.01, 0.30]], 0.14, hair],
    [[[0.10, 4.31, 0.06], [0.10, 4.25, 0.26], [0.015, 4.12, 0.34], [-0.015, 4.00, 0.31]], 0.12, hairLight],
    [[[0.06, 4.35, 0.04], [0.19, 4.30, 0.21], [0.24, 4.17, 0.28], [0.20, 4.04, 0.27]], 0.14, hair],
    [[[0.15, 4.30, -0.02], [0.29, 4.27, 0.10], [0.35, 4.13, 0.17], [0.32, 3.98, 0.13]], 0.12, hairLight],
    [[[-0.16, 4.30, -0.03], [-0.31, 4.22, 0.02], [-0.37, 4.05, 0.08], [-0.34, 3.90, 0.03]], 0.12, hair],
    [[[0.00, 4.20, -0.05], [0.07, 4.42, -0.01], [0.22, 4.48, 0.02], [0.32, 4.37, 0.03]], 0.14, hairLight],
    [[[-0.05, 4.20, -0.07], [-0.14, 4.43, -0.06], [-0.29, 4.46, -0.03], [-0.39, 4.34, 0.02]], 0.13, hair],
    [[[0.08, 4.20, -0.13], [0.24, 4.37, -0.10], [0.37, 4.34, -0.06], [0.42, 4.22, -0.02]], 0.12, hair],
    [[[-0.12, 4.15, -0.18], [-0.28, 4.24, -0.19], [-0.40, 4.16, -0.10], [-0.40, 4.04, -0.02]], 0.12, hairLight],
    [[[0.12, 4.12, -0.22], [0.28, 4.15, -0.23], [0.38, 4.05, -0.12], [0.35, 3.92, -0.07]], 0.12, hair],
    [[[-0.18, 4.05, -0.19], [-0.29, 3.99, -0.16], [-0.33, 3.89, -0.10], [-0.28, 3.82, -0.06]], 0.10, hairDark],
    [[[-0.12, 4.20, -0.16], [-0.23, 4.10, -0.26], [-0.27, 3.94, -0.29], [-0.23, 3.78, -0.23]], 0.075, hairLight],
    [[[0.02, 4.24, -0.17], [-0.06, 4.09, -0.30], [-0.09, 3.92, -0.32], [-0.12, 3.72, -0.27]], 0.085, hair],
    [[[0.13, 4.21, -0.16], [0.09, 4.08, -0.30], [0.08, 3.90, -0.33], [0.02, 3.71, -0.28]], 0.085, hairLight],
    [[[0.19, 4.18, -0.14], [0.23, 4.06, -0.26], [0.24, 3.90, -0.29], [0.18, 3.75, -0.24]], 0.08, hair],
  ];
  locks.forEach(([points, width, mat], i) => {
    add(`Hair lock ${String(i + 1).padStart(2, '0')}`, lockGeometry(points.map((p) => v(p[0], p[1], p[2])), width, seg(14), seg(12)), mat, 'head');
  });

  // The scarf wrap, knot and two hanging ends are separate from the cape and coat.
  add('Scarf wrap', ringSurface([
    [3.42, 0.19, 0.16], [3.39, 0.245, 0.20], [3.31, 0.27, 0.225],
    [3.23, 0.28, 0.235], [3.17, 0.25, 0.21],
  ], seg(32)), scarf, 'neck');
  line('Scarf fold top', [v(-0.24, 3.34, 0.095), v(-0.17, 3.31, 0.20), v(0, 3.29, 0.23), v(0.18, 3.32, 0.19), v(0.24, 3.35, 0.08)], 0.012, scarfLight, 'neck');
  line('Scarf fold lower', [v(-0.23, 3.23, 0.10), v(-0.1, 3.21, 0.22), v(0.07, 3.22, 0.23), v(0.21, 3.26, 0.13)], 0.009, cape, 'neck');
  sphere('Scarf knot', 0.22, 3.25, 0.2, 0.13, 0.115, 0.09, scarfLight, 'neck', -0.3);
  const scarfPoint = (u: number, w: number) => {
    const x = 0.25 + 0.38 * w + 0.16 * w * w;
    const y = 3.24 - 1.12 * w;
    const half = 0.10 + 0.035 * w;
    return v(x + (u - 0.5) * half * 2, y + (u - 0.5) * 0.035, 0.265 + Math.sin(w * Math.PI * 1.5) * 0.035 + u * 0.01);
  };
  scarf.onBeforeCompile = (shader) => {
    shader.uniforms.uScarfTime = frameUniforms.scarfTime;
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      'uniform float uScarfTime;\nvoid main() {',
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <skinning_vertex>',
      `#include <skinning_vertex>
float princeScarfMask = 1.0 - smoothstep(2.08, 3.12, transformed.y);
float princeScarfGust = sin(uScarfTime * 1.1 + transformed.y * 2.7 + transformed.x * 1.3);
float princeScarfSecondGust = sin(uScarfTime * 0.74 + transformed.y * 4.3);
transformed.x += princeScarfMask * princeScarfGust * 0.025;
transformed.z += princeScarfMask * (princeScarfGust * 0.055 + princeScarfSecondGust * 0.012);`,
    );
  };
  scarf.customProgramCacheKey = () => `aster-scarf-skin-safe-wind-r186-${mobile ? 'mobile' : 'desktop'}`;
  add('Scarf - long end', makeSurface(seg(22), seg(8), scarfPoint), scarf, 'neck');
  for (const u of [0.08, 0.92]) {
    line(`Scarf stitched edge ${u}`, Array.from({ length: 8 }, (_, i) => scarfPoint(u, i / 7)), 0.005, scarfLight, 'neck');
  }
  for (let i = 0; i < 7; i++) {
    const p = scarfPoint((i + 0.5) / 7, 1);
    line(`Scarf fringe ${i}`, [p, p.clone().add(v(0.012, -0.048 - (i % 2) * 0.01, 0))], 0.004, scarfLight, 'neck');
  }
  add('Scarf - short end', makeSurface(seg(12), seg(6), (u, w) => v(-0.2 - w * 0.13 + (u - 0.5) * 0.15, 3.2 - w * 0.48, -0.23 - 0.02 * w)), cape, 'neck');

  // Merge disconnected islands only within the same body part and material to reduce draw calls.
  const buckets = new Map<string, THREE.SkinnedMesh[]>();
  for (const child of group.children) {
    if (!(child instanceof THREE.SkinnedMesh)) continue;
    const key = `${child.userData.part}:${(child.material as THREE.Material).name}`;
    const bucket = buckets.get(key) || [];
    bucket.push(child);
    buckets.set(key, bucket);
  }
  for (const [key, bucket] of buckets) {
    let mesh = bucket[0];
    if (bucket.length > 1) {
      const combined = mergeGeometries(bucket.map((item) => item.geometry));
      if (combined) {
        for (const item of bucket) {
          group.remove(item);
          item.geometry.dispose();
        }
        mesh = new THREE.SkinnedMesh(combined, bucket[0].material);
        mesh.name = key;
        mesh.castShadow = bucket[0].castShadow;
        mesh.receiveShadow = true;
        group.add(mesh);
        mesh.bind(skeleton, new THREE.Matrix4());
      }
    }
    mesh.geometry.computeBoundingSphere();
    if (mesh.geometry.boundingSphere) mesh.geometry.boundingSphere.radius += 0.24;
    if (mesh.material instanceof THREE.MeshPhysicalMaterial && (mesh.material.normalMap || mesh.material.anisotropy > 0)) {
      mesh.geometry.computeTangents();
      const tangent = mesh.geometry.getAttribute('tangent');
      const surfaceNormal = mesh.geometry.getAttribute('normal');
      for (let i = 0; i < tangent.count; i++) {
        const direction = v(tangent.getX(i), tangent.getY(i), tangent.getZ(i));
        if (direction.lengthSq() < 0.5 || !Number.isFinite(direction.lengthSq())) {
          const n = v(surfaceNormal.getX(i), surfaceNormal.getY(i), surfaceNormal.getZ(i));
          direction.crossVectors(n, Math.abs(n.y) < 0.9 ? v(0, 1, 0) : v(1, 0, 0)).normalize();
          tangent.setXYZW(i, direction.x, direction.y, direction.z, 1);
        }
      }
    }
  }
  meshes = group.children.filter((child) => child instanceof THREE.SkinnedMesh).length;
  triangles = 0;
  for (const child of group.children) {
    if (child instanceof THREE.SkinnedMesh) triangles += child.geometry.index?.count ? child.geometry.index.count / 3 : child.geometry.getAttribute('position').count / 3;
  }
  group.updateMatrixWorld(true);
  return { group, skeleton, materials, frameUniforms, clip: idleClip(), triangles: Math.round(triangles), meshes, bones: skeleton.bones.length };
}