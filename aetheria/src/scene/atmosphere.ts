import * as THREE from 'three';
import { hash, noiseGlsl } from './glsl';

export const sunDirection = new THREE.Vector3(-0.45, 0.78, 0.38).normalize();

export function createSky() {
  const material = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sunDirection } },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize(vDir);
        vec3 sunDir = normalize(uSun);
        vec3 zenith = vec3(0.07, 0.36, 0.74);
        vec3 middle = vec3(0.2, 0.58, 0.88);
        vec3 horizon = vec3(0.62, 0.86, 0.97);
        vec3 sky = mix(horizon, middle, smoothstep(-0.05, 0.32, dir.y));
        sky = mix(sky, zenith, smoothstep(0.25, 0.95, dir.y));
        sky = mix(sky, vec3(0.8, 0.9, 0.97), smoothstep(0.0, -0.5, dir.y) * 0.8);
        float glow = max(dot(dir, sunDir), 0.0);
        sky += pow(glow, 6.0) * vec3(1.0, 0.9, 0.75) * 0.1 + pow(glow, 600.0) * vec3(1.0, 0.95, 0.85) * 3.0;
        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 20), material);
  mesh.frustumCulled = false;
  return { mesh, material };
}

export function createClouds() {
  const geometry = new THREE.IcosahedronGeometry(1, 3);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, envMapIntensity: 0 });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${noiseGlsl}\nvarying vec3 vCloudN;\nvarying float vCloudLump;`)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 cloudSeed = vec3(0.0);
        vCloudN = normal;
        #ifdef USE_INSTANCING
          cloudSeed = instanceMatrix[3].xyz * 0.37;
          vCloudN = normalize(mat3(instanceMatrix) * normal);
        #endif
        float lump = aetheriaNoise(position * 1.7 + cloudSeed) * 0.6 + aetheriaNoise(position * 3.9 + cloudSeed) * 0.3
          + aetheriaNoise(position * 8.5 + cloudSeed) * 0.12;
        vCloudLump = lump;
        transformed += normal * (lump - 0.42) * 0.62;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCloudN;\nvarying float vCloudLump;')
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        float cloudFacing = abs(dot(normal, normalize(vViewPosition)));
        float cloudDither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        float cloudNear = smoothstep(3.0, 11.0, length(vViewPosition));
        if (smoothstep(0.02, 0.3, cloudFacing) * cloudNear < cloudDither) discard;
        diffuseColor.rgb *= mix(0.74, 1.08, smoothstep(0.22, 0.72, vCloudLump));
      `)
      .replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        float cloudUp = vCloudN.y * 0.5 + 0.5;
        vec3 cloudShade = mix(vec3(0.6, 0.69, 0.9), vec3(1.0, 0.98, 0.95), smoothstep(0.1, 0.85, cloudUp));
        reflectedLight.directDiffuse = reflectedLight.directDiffuse * 0.85 + diffuseColor.rgb * cloudShade * 0.3;
        reflectedLight.indirectDiffuse = reflectedLight.indirectDiffuse * cloudShade * 1.35 + diffuseColor.rgb * cloudShade * 0.2;
        #if NUM_DIR_LIGHTS > 0
          float cloudRim = pow(1.0 - cloudFacing, 2.5) * pow(max(dot(normalize(vViewPosition), -directionalLights[0].direction), 0.0), 2.0);
          reflectedLight.directDiffuse += directionalLights[0].color * cloudRim * 0.5;
        #endif
      `);
  };
  const near: number[][] = [];
  const far: number[][] = [];
  for (let i = 0; i < 64; i++) {
    const z = -52 + hash(i * 2.9) * 66;
    const size = 4 + hash(i * 7.7) * 4;
    near.push([(hash(i * 1.3) - 0.5) * 100, -6.1 + hash(i * 5.1) * 1.3 - (z > 4 ? 1.4 : 0), z, size, size * 0.55]);
  }
  for (let i = 0; i < 22; i++) {
    const size = 1.6 + hash(i * 3.1) * 1.3;
    near.push([-9.5 + hash(i * 1.9) * 12, -3.5 + hash(i * 4.3) * 1.3, -4.5 + hash(i * 6.1) * 6.5, size, size * 0.8]);
  }
  for (let i = 0; i < 10; i++) {
    const size = 2 + hash(i * 2.3) * 1.6;
    near.push([-16 + hash(i * 5.7) * 11, -4.6 + hash(i * 1.1) * 1.2, 4 + hash(i * 8.3) * 6, size, size * 0.75]);
  }
  for (let tower = 0; tower < 12; tower++) {
    const x = (hash(tower * 4.1) - 0.5) * 130;
    const z = -30 - hash(tower * 9.7) * 55;
    const height = 3 + Math.floor(hash(tower * 2.7) * 4);
    for (let k = 0; k < height; k++) {
      const size = 8.5 - k * 1.1 + hash(tower + k * 3.3) * 2;
      far.push([x + (hash(tower * 3 + k) - 0.5) * 6, -3 + k * 3.4, z + (hash(tower * 5 + k) - 0.5) * 5, size, size * 0.82]);
    }
  }
  for (let side = 0; side < 8; side++) {
    const sign = side % 2 === 0 ? 1 : -1;
    const x = sign * (24 + hash(side * 3.9) * 20);
    const z = -14 + hash(side * 7.1) * 16;
    for (let k = 0; k < 4; k++) {
      const size = 6 - k * 1.1 + hash(side + k * 2.1) * 1.5;
      far.push([x + (hash(side * 3 + k) - 0.5) * 5, -3.5 + k * 2.9, z + (hash(side * 7 + k) - 0.5) * 4, size, size * 0.8]);
    }
  }
  const dummy = new THREE.Object3D();
  const meshes = [near, far].map((list) => {
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach(([x, y, z, size, tall], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, hash(i * 9.3) * 6.28, 0);
      dummy.scale.set(size, tall, size * (0.8 + hash(i * 6.7) * 0.3));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  });
  return { meshes, geometry, count: near.length + far.length };
}

export function createBirds() {
  const material = new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.62, side: THREE.DoubleSide });
  return Array.from({ length: 7 }, (_, i) => {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), material);
    body.scale.set(0.8, 0.7, 1.9);
    const wingGeometry = new THREE.PlaneGeometry(0.34, 0.11, 3, 1);
    wingGeometry.rotateX(-Math.PI / 2);
    wingGeometry.translate(0.17, 0, 0);
    const wing = new THREE.Mesh(wingGeometry, material);
    const other = new THREE.Mesh(wingGeometry, material);
    other.scale.x = -1;
    bird.add(body, wing, other);
    bird.userData.wing = wing;
    bird.userData.other = other;
    bird.userData.seed = i;
    return bird;
  });
}

export function createPetals() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.035);
  shape.bezierCurveTo(-0.02, -0.01, -0.024, 0.018, -0.006, 0.03);
  shape.bezierCurveTo(0, 0.034, 0.004, 0.026, 0.008, 0.03);
  shape.bezierCurveTo(0.024, 0.016, 0.018, -0.012, 0, -0.035);
  const geometry = new THREE.ShapeGeometry(shape, 4);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) position.setZ(i, Math.sin(position.getY(i) * 40) * 0.008);
  geometry.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#f6b9cc', roughness: 0.8, side: THREE.DoubleSide }), 160);
  mesh.frustumCulled = false;
  const data = Array.from({ length: 160 }, (_, i) => ({
    x: (hash(i) - 0.5) * 14, y: hash(i + 2) * 9, z: (hash(i + 4) - 0.5) * 9,
    speed: 0.12 + hash(i + 6) * 0.2, phase: hash(i + 8) * Math.PI * 2,
  }));
  return { mesh, data };
}
