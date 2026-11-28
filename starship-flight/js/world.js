// Procedural setting: printed sky, concrete apron, sea, launch tower with chopsticks,
// orbital launch mount, deluge plate, tank farm. Positions and sizes here are scenic (modelled).
import * as THREE from 'three';
import { merge, box, cyl, beam, latheSolid } from './geom.js';
import { U, patch } from './materials.js';

export const TOWER = { x: 0, z: -24, half: 5, height: 150, frontZ: -19 };
export const MOUNT_H = 20;

export function makeSky() {
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color('#ECE8DF') }, uHorizon: { value: new THREE.Color('#C6DEE2') },
      uSpace: { value: new THREE.Color('#2a3036') }, uAlt: { value: 0 }, uGhost: U.ghost, uPaper: U.paper,
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = position; vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSpace; uniform float uAlt; uniform float uGhost; uniform vec3 uPaper;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -1.0, 1.0);
        float t = smoothstep(0.0, 0.32, h);
        vec3 col = mix(uHorizon, uTop, t);
        float sp = smoothstep(15000.0, 90000.0, uAlt);
        vec3 spaceCol = mix(uHorizon * 0.92, uSpace, smoothstep(-0.25, 0.5, h));
        col = mix(col, spaceCol, sp);
        // halftone dots, denser toward the horizon tint
        vec2 g = gl_FragCoord.xy;
        float ang = 0.785398;
        vec2 rg = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * g / 4.0;
        vec2 cell = fract(rg) - 0.5;
        float dotR = mix(0.12, 0.32, (1.0 - t) * (1.0 - sp) + sp * 0.5);
        float dotv = smoothstep(dotR, dotR - 0.08, length(cell));
        vec3 ink = sp > 0.5 ? col * 1.25 : col * 0.93;
        col = mix(col, ink, dotv * 0.55);
        col = mix(col, uPaper * 0.97, uGhost * 0.8);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    depthWrite: false, depthTest: false, side: THREE.BackSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10; m.frustumCulled = false; m.name = 'sky';
  return m;
}

export function makeGround() {
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.96, metalness: 0 });
  patch(mat, { clip: false });
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh) => {
    prev(sh);
    sh.vertexShader = 'varying vec3 vW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vW;\n' + sh.fragmentShader.replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
      {
        vec2 w = vW.xz;
        float hsh = fract(sin(dot(floor(w * 0.7), vec2(12.9898, 78.233))) * 43758.5453);
        vec3 sand = vec3(0.86, 0.83, 0.77) * (0.97 + 0.03 * hsh);
        vec3 conc = vec3(0.80, 0.78, 0.74);
        vec2 j = abs(fract(w / 6.0) - 0.5);
        float joint = smoothstep(0.485, 0.5, max(j.x, j.y));
        float panel = fract(sin(dot(floor(w / 6.0), vec2(7.13, 3.71))) * 9631.7);
        conc *= 0.96 + 0.05 * panel;
        conc *= 1.0 - 0.12 * joint;
        float apron = step(abs(w.x), 75.0) * step(-95.0, w.y) * step(w.y, 70.0);
        float road = step(abs(w.y - 85.0), 6.0) * step(w.x, 320.0);
        float farm = step(abs(w.x + 110.0), 40.0) * step(abs(w.y + 85.0), 28.0);
        vec3 col = mix(sand, conc, max(apron, farm));
        col = mix(col, vec3(0.62, 0.61, 0.59), road);
        // scorch under the mount
        float rr = length(w);
        col *= 1.0 - 0.25 * (1.0 - smoothstep(6.0, 28.0, rr)) * apron;
        // sea
        float shore = 320.0 + 18.0 * sin(w.y * 0.004) + 6.0 * sin(w.y * 0.03);
        float sea = smoothstep(shore - 4.0, shore + 4.0, w.x);
        vec3 water = vec3(0.70, 0.83, 0.86);
        float rip = smoothstep(0.42, 0.5, abs(fract(w.y / 9.0 + sin(w.x * 0.02) * 0.2) - 0.5));
        water = mix(water, water * 0.9, rip * 0.6);
        col = mix(col, water, sea);
        // screen halftone grain
        vec2 g = gl_FragCoord.xy / 3.0;
        float dots = step(0.5, fract(sin(dot(floor(g), vec2(41.3, 289.1))) * 1731.3));
        col *= 0.985 + 0.015 * dots;
        diffuseColor.rgb = col;
      }`);
  };
  mat.customProgramCacheKey = () => 'ground';
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true; m.name = 'ground';
  return m;
}

function towerLattice() {
  const { half: h, height: H } = TOWER;
  const parts = [];
  const legs = [[-h, -h], [h, -h], [h, h], [-h, h]];
  for (const [x, z] of legs) parts.push(box(1.1, H, 1.1, x, H / 2, z));
  const bay = 7.5;
  for (let y = 0; y < H - 0.1; y += bay) {
    for (let f = 0; f < 4; f++) {
      const a = legs[f], b = legs[(f + 1) % 4];
      parts.push(beam([a[0], y + bay, a[1]], [b[0], y + bay, b[1]], 0.5));
      parts.push(beam([a[0], y, a[1]], [b[0], y + bay, b[1]], 0.32));
      parts.push(beam([b[0], y, b[1]], [a[0], y + bay, a[1]], 0.32));
    }
  }
  // crown + mast
  parts.push(box(2 * h + 2.4, 1.2, 2 * h + 2.4, 0, H + 0.6, 0));
  parts.push(cyl(0.25, 0.4, 14, 0, H + 8, 0, 0, 0, 0, 8));
  const g = merge(parts);
  g.translate(TOWER.x, 0, TOWER.z);
  return g;
}

function armTruss(len, w, hgt) {
  // arm runs along +z from origin
  const parts = [];
  const xs = [-w / 2, w / 2], ys = [-hgt / 2, hgt / 2];
  for (const x of xs) for (const y of ys) parts.push(beam([x, y, 0], [x, y, len], 0.32));
  const n = Math.round(len / 3);
  for (let i = 0; i < n; i++) {
    const z0 = (i / n) * len, z1 = ((i + 1) / n) * len;
    for (const x of xs) parts.push(beam([x, ys[0], z0], [x, ys[1], z1], 0.18));
    parts.push(beam([xs[0], ys[1], z1], [xs[1], ys[1], z1], 0.18));
    parts.push(beam([xs[0], ys[0], z1], [xs[1], ys[0], z1], 0.18));
  }
  return merge(parts);
}

export function buildTower(mats) {
  const g = new THREE.Group(); g.name = 'tower';
  const lat = new THREE.Mesh(towerLattice(), mats.towerSteel);
  lat.castShadow = true; lat.receiveShadow = true;
  g.add(lat);
  // carriage + chopsticks
  const carriage = new THREE.Group();
  carriage.position.set(TOWER.x, 120, TOWER.z);
  const cframe = new THREE.Mesh(merge([
    box(13, 6, 1.0, 0, 0, 6.6), box(13, 6, 1.0, 0, 0, -6.6), box(1.0, 6, 13, 6.6, 0, 0), box(1.0, 6, 13, -6.6, 0, 0),
    box(2.4, 4.6, 3.0, 5.6, 0, 6.6 + 1.5), box(2.4, 4.6, 3.0, -5.6, 0, 6.6 + 1.5),
  ]), mats.towerDark);
  cframe.castShadow = true;
  carriage.add(cframe);
  const arms = [];
  const armLen = 36;
  const armGeo = armTruss(armLen, 1.6, 3.2);
  const railGeo = merge([box(0.6, 0.5, 9, 0, 1.85, armLen - 14)]);
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 5.6, 0, 6.6 + 2.6);
    const a = new THREE.Mesh(armGeo, mats.towerSteel); a.castShadow = true;
    const rail = new THREE.Mesh(railGeo, mats.orange); rail.position.x = -sx * 0.45;
    pivot.add(a, rail);
    carriage.add(pivot);
    arms.push({ pivot, sx });
  }
  g.add(carriage);
  // ship quick-disconnect arm
  const qdPivot = new THREE.Group();
  qdPivot.position.set(TOWER.x + 3.5, MOUNT_H + 72 + 2.6, TOWER.frontZ);
  const qd = new THREE.Mesh(merge([armTruss(14.3, 1.4, 2.0), box(2.2, 2.6, 0.5, 0, 0, 14.3)]), mats.towerDark);
  qd.castShadow = true;
  qd.position.x = -3.5;
  qdPivot.add(qd);
  g.add(qdPivot);
  // crew access arm
  const caPivot = new THREE.Group();
  caPivot.position.set(TOWER.x - 4, MOUNT_H + 72 + 38, TOWER.frontZ);
  const ca = new THREE.Mesh(merge([box(3.2, 3.2, 12.5, 0, 0, 6.25), box(3.6, 0.4, 13, 0, -1.8, 6.5)]), mats.tankWhite);
  ca.castShadow = true; ca.position.x = 2;
  caPivot.add(ca); caPivot.rotation.y = 1.25;
  g.add(caPivot);

  return {
    group: g, carriage, arms, qdPivot, caPivot,
    set({ carriageY, open, qdOut }) {
      carriage.position.y = carriageY;
      for (const a of arms) a.pivot.rotation.y = a.sx * open * 0.5;
      qdPivot.rotation.y = qdOut * 1.35;
    },
  };
}

export function buildMount(mats) {
  const g = new THREE.Group(); g.name = 'mount';
  const ring = new THREE.Mesh(latheSolid([[4.95, MOUNT_H - 2.4], [9.2, MOUNT_H - 2.4], [9.2, MOUNT_H], [4.95, MOUNT_H]], 64), mats.padSteel);
  ring.castShadow = ring.receiveShadow = true;
  g.add(ring);
  const legs = [];
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; legs.push(box(1.8, MOUNT_H - 2.4, 1.8, Math.cos(a) * 8, (MOUNT_H - 2.4) / 2, Math.sin(a) * 8)); legs.push(beam([Math.cos(a) * 8, 2, Math.sin(a) * 8], [Math.cos(a + Math.PI / 3) * 8, MOUNT_H - 3, Math.sin(a + Math.PI / 3) * 8], 0.6)); }
  const lm = new THREE.Mesh(merge(legs), mats.padSteel); lm.castShadow = lm.receiveShadow = true; g.add(lm);
  // hold-down clamps
  const clamps = [];
  const cgeo = merge([box(0.9, 1.8, 0.7, 0, 0.9, 0), box(0.9, 0.4, 1.3, 0, 1.6, -0.35)]);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const p = new THREE.Group();
    p.position.set(Math.cos(a) * 5.15, MOUNT_H, Math.sin(a) * 5.15);
    p.rotation.y = -a + Math.PI / 2;
    const c = new THREE.Mesh(cgeo, mats.towerDark); c.castShadow = true;
    p.add(c); g.add(p); clamps.push(p);
  }
  // deluge plate + booster QD
  const plate = new THREE.Mesh(latheSolid([[0, 0], [8.5, 0], [8.5, 0.6], [0, 0.6]], 48), mats.padSteel);
  plate.receiveShadow = true; g.add(plate);
  const bqd = new THREE.Mesh(merge([box(3, 4, 3, 0, MOUNT_H + 2, -7.4), box(1.2, 1.2, 3, 0, MOUNT_H + 1.2, -5.6)]), mats.towerDark);
  bqd.castShadow = true; g.add(bqd);
  return {
    group: g,
    setClamps(k) { for (const c of clamps) c.rotation.x = -k * 0.9; },
  };
}

export function buildTankFarm(mats) {
  const g = new THREE.Group(); g.name = 'tank farm';
  const parts = [], saddles = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
    const x = -125 + i * 10, z = -100 + row * 22;
    parts.push(cyl(3.2, 3.2, 26, x, 4.6, z, Math.PI / 2, 0, 0, 24));
    parts.push(new THREE.SphereGeometry(3.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(x, 4.6, z + 13));
    parts.push(new THREE.SphereGeometry(3.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2).translate(x, 4.6, z - 13));
    saddles.push(box(5, 2, 1.2, x, 1, z - 8), box(5, 2, 1.2, x, 1, z + 8));
  }
  const tanks = new THREE.Mesh(merge(parts), mats.tankWhite); tanks.castShadow = tanks.receiveShadow = true;
  const sad = new THREE.Mesh(merge(saddles), mats.padSteel);
  const vent = new THREE.Mesh(merge([cyl(0.6, 0.8, 32, -82, 16, -64, 0, 0, 0, 12), box(4, 0.6, 4, -82, 0.3, -64)]), mats.padSteel);
  vent.castShadow = true;
  const pipe = new THREE.Mesh(merge([beam([-90, 1.2, -78], [-8, 1.2, -10], 0.9), beam([-8, 1.2, -10], [-3, MOUNT_H, -6], 0.9)]), mats.padSteel);
  g.add(tanks, sad, vent, pipe);
  return { group: g, ventTop: new THREE.Vector3(-82, 32.5, -64) };
}
