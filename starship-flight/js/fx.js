// Procedural plume (shock-diamond field) and particle vapor. No textures.
import * as THREE from 'three';
import { U } from './materials.js';

const plumeVS = /* glsl */`
  attribute float iThrottle;
  attribute float iExitR;
  uniform float uPr; uniform float uLenSL; uniform float uLenVac; uniform float uSpreadVac;
  varying float vS; varying vec3 vNView; varying vec3 vPosView; varying float vThr; varying float vL; varying float vLam;
  void main(){
    float s = -position.y;
    float thr = iThrottle;
    float pr = uPr;
    float L = mix(uLenVac, uLenSL, pr) * (0.55 + 0.45 * thr);
    float lam = iExitR * 1.9 / sqrt(max(pr, 0.04));
    float spread = mix(uSpreadVac, 0.22, pr);
    float r = iExitR * (1.0 + s * L / iExitR * spread * 0.18 + 0.10 * pr * sin(6.2831 * s * L / lam) * (1.0 - s));
    r = mix(iExitR * 0.97, r, smoothstep(0.0, 0.03, s));
    vec3 p = vec3(position.x * r, -s * L, position.z * r);
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vNView = normalize(normalMatrix * mat3(instanceMatrix) * vec3(position.x, 0.0, position.z));
    vPosView = mv.xyz; vS = s; vThr = thr; vL = L; vLam = lam;
  }`;
const plumeFS = /* glsl */`
  uniform float uPr; uniform float uTime; uniform vec3 uOrange; uniform vec3 uCream; uniform float uOpacity; uniform float uCollective;
  varying float vS; varying vec3 vNView; varying vec3 vPosView; varying float vThr; varying float vL; varying float vLam;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    if (vThr < 0.01) discard;
    vec3 V = normalize(-vPosView);
    float facing = abs(dot(normalize(vNView), V));
    float core = pow(facing, mix(2.6, 1.2, 1.0 - uPr));
    float along = vS * vL;
    float dia = pow(0.5 + 0.5 * cos(6.2831 * (along / vLam - 0.5)), 7.0) * smoothstep(0.15, 0.6, uPr) * exp(-vS * 2.0) * smoothstep(0.02, 0.08, vS);
    float flick = 0.85 + 0.15 * sin(uTime * 40.0 + along * 0.7);
    float fade = (1.0 - smoothstep(0.35, 1.0, vS)) * smoothstep(0.0, 0.015, vS);
    float inten = clamp(core * (0.55 + 0.45 * exp(-vS * 3.0)) + dia * 1.4, 0.0, 1.4);
    float a = fade * vThr * (0.22 + 0.7 * core) * mix(0.35, 0.9, uPr) * flick * uOpacity;
    a = max(a, dia * fade * vThr * 0.95 * uOpacity);
    // printed stipple
    float dots = hash(floor(gl_FragCoord.xy / 1.5));
    a = mix(a, step(dots, a * 1.25) * 0.9, 0.35);
    vec3 col = mix(uOrange, uCream, clamp(inten * 0.8, 0.0, 1.0) * (1.0 - dia));
    col = mix(col, vec3(0.62, 0.17, 0.03), clamp(dia * 1.6, 0.0, 1.0));
    col = mix(col, uOrange * 0.8, (1.0 - uPr) * 0.25 * vS);
    gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
    #include <colorspace_fragment>
  }`;

export function makePlume(exits, { lenSL = 34, lenVac = 220, spreadVac = 2.6, collective = null } = {}) {
  // exits: [{x, y, z, r}] in stage-local coordinates (bell exit centres)
  const geo = new THREE.CylinderGeometry(1, 1, 1, 22, 60, true).translate(0, -0.5, 0);
  const all = collective ? [...exits, collective] : exits;
  const n = all.length;
  const thr = new Float32Array(n), er = new Float32Array(n);
  all.forEach((e, i) => { er[i] = e.r; });
  geo.setAttribute('iThrottle', new THREE.InstancedBufferAttribute(thr, 1));
  geo.setAttribute('iExitR', new THREE.InstancedBufferAttribute(er, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPr: { value: 1 }, uLenSL: { value: lenSL }, uLenVac: { value: lenVac }, uSpreadVac: { value: spreadVac },
      uTime: U.time, uOrange: { value: new THREE.Color('#E05A1E') }, uCream: { value: new THREE.Color('#fff3da') },
      uOpacity: { value: 1 }, uCollective: { value: 0 },
    },
    vertexShader: plumeVS, fragmentShader: plumeFS,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const im = new THREE.InstancedMesh(geo, mat, n);
  im.frustumCulled = false; im.renderOrder = 5; im.name = 'plume';
  const m4 = new THREE.Matrix4();
  all.forEach((e, i) => { m4.makeTranslation(e.x, e.y, e.z); im.setMatrixAt(i, m4); });
  if (collective) {
    // collective plume renders a little behind the per-engine cores
  }
  return {
    mesh: im,
    set(throttles, pr, collectiveThr = 0) {
      for (let i = 0; i < exits.length; i++) thr[i] = throttles[i] || 0;
      if (collective) thr[n - 1] = collectiveThr;
      geo.attributes.iThrottle.needsUpdate = true;
      mat.uniforms.uPr.value = pr;
      im.visible = thr.some((v) => v > 0.01);
    },
    exits,
  };
}

// ---------- particles ----------
const partVS = /* glsl */`
  attribute float aAge; attribute float aLife; attribute float aSize; attribute vec3 aColor; attribute float aKind;
  uniform float uScale; uniform float uFade;
  varying float vA; varying vec3 vC; varying float vKind;
  void main(){
    float k = clamp(aAge / max(aLife, 0.001), 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aSize * (aKind > 0.5 ? 1.0 : (0.35 + 1.4 * sqrt(k)));
    gl_PointSize = clamp(size * uScale / max(1.0, -mv.z), 0.0, 900.0);
    vA = (aLife > 0.0 && aAge < aLife) ? (aKind > 0.5 ? (1.0 - k) : smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.45, 1.0, k)) * uFade) : 0.0;
    vC = aColor; vKind = aKind;
  }`;
const partFS = /* glsl */`
  uniform vec3 uShadow;
  varying float vA; varying vec3 vC; varying float vKind;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    if (vA <= 0.003) discard;
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = dot(p, p);
    if (r > 1.0) discard;
    if (vKind > 0.5) { gl_FragColor = vec4(vC, vA);
      #include <colorspace_fragment>
      return; }
    float soft = (1.0 - r);
    float shade = clamp(0.55 + 0.45 * dot(normalize(vec3(p.x, -p.y, sqrt(max(0.0, 1.0 - r)))), normalize(vec3(-0.4, 0.7, 0.6))), 0.0, 1.0);
    vec3 col = mix(uShadow, vC, shade);
    float a = soft * soft * vA;
    float dots = hash(floor(gl_FragCoord.xy / 1.5));
    a = mix(a, step(dots, a * 1.4) * 0.7, 0.3);
    gl_FragColor = vec4(col, a * 0.75);
    #include <colorspace_fragment>
  }`;

export function makeParticles(max = 3000) {
  const pos = new Float32Array(max * 3), vel = new Float32Array(max * 3);
  const age = new Float32Array(max), life = new Float32Array(max), size = new Float32Array(max), col = new Float32Array(max * 3), kind = new Float32Array(max);
  const grav = new Float32Array(max), drag = new Float32Array(max), rise = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAge', new THREE.BufferAttribute(age, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 }, uFade: { value: 1 }, uShadow: { value: new THREE.Color('#b9b6ae') } },
    vertexShader: partVS, fragmentShader: partFS, transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 6; pts.name = 'vapor';
  let cursor = 0;
  const white = new THREE.Color('#f8f7f3');
  function emit(p, v, { life: l = 4, size: s = 6, color = white, gravity = 0, dragK = 0.4, riseK = 0.6, k = 0 } = {}) {
    const i = cursor; cursor = (cursor + 1) % max;
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    vel[i * 3] = v.x; vel[i * 3 + 1] = v.y; vel[i * 3 + 2] = v.z;
    age[i] = 0; life[i] = l; size[i] = s; kind[i] = k;
    col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b;
    grav[i] = gravity; drag[i] = dragK; rise[i] = riseK;
  }
  function update(dt, wind) {
    for (let i = 0; i < max; i++) {
      if (age[i] >= life[i]) continue;
      age[i] += dt;
      const d = Math.exp(-drag[i] * dt);
      vel[i * 3] = vel[i * 3] * d + wind.x * (1 - d);
      vel[i * 3 + 1] = vel[i * 3 + 1] * d + (rise[i] - grav[i] * 9.8 * 0.0) * (1 - d) - grav[i] * 9.8 * dt;
      vel[i * 3 + 2] = vel[i * 3 + 2] * d + wind.z * (1 - d);
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.2 && grav[i] > 0) { pos[i * 3 + 1] = 0.2; vel[i * 3 + 1] *= -0.2; }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAge.needsUpdate = true;
    geo.attributes.aLife.needsUpdate = true; geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true; geo.attributes.aKind.needsUpdate = true;
  }
  function clear() { age.fill(0); life.fill(0); geo.attributes.aLife.needsUpdate = true; }
  return { points: pts, emit, update, clear, material: mat };
}
