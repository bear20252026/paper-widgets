// Procedural Super Heavy booster and Starship upper stage.
// Units: metres. Each stage's local origin is the centre of its base; +y is the vehicle axis.
// Ship windward (tile) face is local +x. Published: 9 m diameter, 72 m booster, 52 m ship.
// Internal layout (tank lengths, dome positions, engine placement radii) is schematic and modelled.
import * as THREE from 'three';
import { latheSolid, tube, dome, bowl, merge, box, cyl, surfaceArea } from './geom.js';

const R = 4.5, WALL = 0.26;

function mesh(geo, mat, name) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name || '';
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------- Raptor engine (schematic) ----------
function bellGeo(rThroat, rExit, len, chamberR, chamberLen) {
  // closed solid: chamber cap + thick nozzle wall. Origin at the gimbal point; bell hangs toward -y.
  const t = 0.05;
  const yc0 = -0.25, yc1 = yc0 - chamberLen, yThroat = yc1 - 0.25, yExit = yThroat - len;
  const rAt = (k) => rThroat + (rExit - rThroat) * Math.pow(k, 0.62);
  const cw = [[0, yc0], [chamberR, yc0], [chamberR, yc1], [rThroat + t, yThroat]];
  for (let i = 1; i <= 12; i++) cw.push([rAt(i / 12) + t, yThroat - len * (i / 12)]);
  for (let i = 12; i >= 1; i--) cw.push([rAt(i / 12), yThroat - len * (i / 12)]);
  cw.push([rThroat, yThroat], [0, yThroat + 0.05]);
  return { geo: latheSolid(cw.reverse(), 28, 0.5), exitY: yExit };
}

function machineryGeo(scale = 1) {
  const s = scale;
  const parts = [
    cyl(0.42 * s, 0.42 * s, 0.6 * s, 0, 0.1 * s, 0, 0, 0, 0, 14),           // powerhead
    cyl(0.2 * s, 0.24 * s, 0.75 * s, 0.38 * s, 0.25 * s, 0, 0, 0, 0, 10),   // LOX turbopump
    cyl(0.18 * s, 0.22 * s, 0.7 * s, -0.36 * s, 0.22 * s, 0.1 * s, 0, 0, 0, 10), // CH4 turbopump
    cyl(0.06 * s, 0.06 * s, 1.0 * s, 0.38 * s, 0.95 * s, 0, 0, 0, 0, 8),   // run line LOX
    cyl(0.055 * s, 0.055 * s, 1.0 * s, -0.36 * s, 0.9 * s, 0.1 * s, 0, 0, 0, 8), // run line CH4
    box(0.5 * s, 0.08 * s, 0.08 * s, 0, 0.55 * s, 0.32 * s),                // gimbal yoke
  ];
  return merge(parts);
}

function engineCluster(defs, opts, mats) {
  // defs: [{x,z,gimbal:boolean,type}] ; opts: {y, bell:{...}, rvacBell:{...}}
  const g = new THREE.Group();
  const types = {};
  for (const d of defs) (types[d.type] ||= []).push(d);
  const inst = [];
  for (const [type, list] of Object.entries(types)) {
    const b = type === 'rvac' ? opts.rvac : opts.sl;
    const bell = bellGeo(b.throat, b.exit, b.len, b.chamber, b.chamberLen);
    const bm = new THREE.InstancedMesh(bell.geo, mats.engineBell, list.length);
    const mm = new THREE.InstancedMesh(machineryGeo(type === 'rvac' ? 1.1 : 1), mats.engineBody, list.length);
    bm.castShadow = mm.castShadow = true;
    bm.name = 'engine bells ' + type; mm.name = 'engine machinery ' + type;
    list.forEach((d) => { d.exitY = bell.exitY; });
    g.add(bm, mm);
    inst.push({ type, list, bm, mm });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  function update(gimbalX, gimbalZ, jitter = 0, t = 0) {
    for (const it of inst) {
      it.list.forEach((d, i) => {
        const gx = d.gimbal ? gimbalX + jitter * Math.sin(t * 7 + i * 1.7) : 0;
        const gz = d.gimbal ? gimbalZ + jitter * Math.cos(t * 6 + i * 2.3) : 0;
        q.setFromEuler(e.set(gx, 0, gz));
        m4.compose(p.set(d.x, opts.y, d.z), q, sc);
        it.bm.setMatrixAt(i, m4); it.mm.setMatrixAt(i, m4);
      });
      it.bm.instanceMatrix.needsUpdate = true; it.mm.instanceMatrix.needsUpdate = true;
    }
  }
  update(0, 0);
  // bounding sphere for culling
  for (const it of inst) { it.bm.computeBoundingSphere(); it.mm.computeBoundingSphere(); it.bm.frustumCulled = false; it.mm.frustumCulled = false; }
  return { group: g, update, defs };
}

// ---------- liquid ----------
function liquid(mat, yBottomRim, rise, yMax, name) {
  const g = new THREE.Group();
  const rl = R - WALL - 0.1;
  const bw = mesh(bowl(rl, rise, yBottomRim, 40), mat, name + ' bowl');
  const cy = mesh(new THREE.CylinderGeometry(rl, rl, 1, 48, 1).translate(0, 0.5, 0), mat, name);
  cy.position.y = yBottomRim;
  // free surface: a level plane with a slight tilt (no slosh modelled)
  const surf = mesh(new THREE.CylinderGeometry(rl - 0.05, rl - 0.05, 0.12, 48, 1), mat, name + ' surface');
  g.add(bw, cy, surf);
  const full = yMax - yBottomRim;
  return {
    group: g,
    set(frac, tilt = 0) {
      frac = Math.max(0, Math.min(1, frac));
      const h = frac * full;
      cy.visible = h > 0.05; bw.visible = frac > 0.002;
      cy.scale.y = Math.max(0.001, h);
      bw.scale.y = Math.min(1, frac * 8 + 0.02);
      bw.position.y = yBottomRim * (1 - bw.scale.y);
      surf.visible = cy.visible;
      surf.position.y = yBottomRim + h;
      surf.rotation.z = Math.max(-0.03, Math.min(0.03, tilt));
    },
  };
}

// ---------- grid fin ----------
function gridFinGeo() {
  const W = 4.2, H = 3.0, T = 0.32, b = 0.09;
  const parts = [box(W, b * 2, T, W / 2, H / 2, 0), box(W, b * 2, T, W / 2, -H / 2, 0), box(b * 2, H, T, 0.05, 0, 0), box(b * 2, H, T, W, 0, 0)];
  for (let i = 1; i < 9; i++) {
    const x = (i / 9) * W;
    parts.push(box(0.05, H * 1.32, T * 0.9, x, 0, 0, 0, 0, 0.62));
    parts.push(box(0.05, H * 1.32, T * 0.9, x, 0, 0, 0, 0, -0.62));
  }
  // clip lattice to frame by scaling: the diagonal bars overrun a little; acceptable at print scale
  return merge(parts);
}

// ---------- Super Heavy ----------
export function buildBooster(mats) {
  const root = new THREE.Group(); root.name = 'Super Heavy';
  const parts = {};
  const H = 72, HSR0 = 70.2;
  // body wall, 0..HSR0
  const body = new THREE.Group();
  const wall = mesh(latheSolid([[R - WALL, 0], [R, 0], [R, HSR0], [R - WALL, HSR0]], 96), mats.boosterSteel, 'booster wall');
  body.add(wall);
  // domes (schematic)
  body.add(mesh(dome(R - WALL, -1.6, 0.2, 7.5), mats.dome, 'aft dome'));
  body.add(mesh(dome(R - WALL, -1.6, 0.2, 44), mats.dome, 'common dome'));
  body.add(mesh(dome(R - WALL, 1.8, 0.2, 64), mats.dome, 'forward dome'));
  // thrust structure
  body.add(mesh(latheSolid([[0.6, 5.6], [R - WALL, 5.6], [R - WALL, 6.0], [0.6, 6.0]], 48), mats.innerSteel, 'thrust puck'));
  // CH4 downcomer through LOX tank
  body.add(mesh(tube(0.55, 0.06, 5.6, 42.6, 24), mats.innerSteel, 'downcomer'));
  // raceway + chine
  body.add(mesh(box(0.7, 56, 0.38, 0, 36, -(R + 0.12)), mats.steelPlain, 'raceway'));
  // QD plates
  body.add(mesh(box(1.6, 2.2, 0.25, -2.3, 3.0, -(R - 0.2) - 0.35, 0, 0.5, 0), mats.darkMetal, 'QD plate'));
  body.add(mesh(box(1.6, 2.2, 0.25, 2.3, 3.0, -(R - 0.2) - 0.35, 0, -0.5, 0), mats.darkMetal, 'QD plate'));
  // catch pins on ±x
  for (const sx of [-1, 1]) body.add(mesh(cyl(0.45, 0.45, 1.2, sx * (R + 0.5), 66.2, 0, 0, 0, Math.PI / 2, 16), mats.darkMetal, 'catch pin'));
  root.add(body); parts.body = body;

  // hot-staging ring (interstage), stays with booster
  const hsr = new THREE.Group();
  hsr.add(mesh(tube(R, 0.2, HSR0, HSR0 + 0.35, 64), mats.boosterSteel, 'HSR lower ring'));
  hsr.add(mesh(tube(R, 0.2, H - 0.35, H, 64), mats.boosterSteel, 'HSR upper ring'));
  const struts = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    struts.push(box(0.55, H - HSR0 - 0.7, 0.25, Math.cos(a) * (R - 0.1), (HSR0 + H) / 2, Math.sin(a) * (R - 0.1), 0, -a, 0));
  }
  hsr.add(mesh(merge(struts), mats.boosterSteel, 'HSR struts'));
  hsr.add(mesh(dome(R - 0.4, 0.9, 0.08, HSR0 + 0.3), mats.darkMetal, 'HSR shield dome'));
  root.add(hsr); parts.hsr = hsr;

  // grid fins x4 at 45° offsets
  const fins = [];
  const finGeo = gridFinGeo();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const holder = new THREE.Group();
    holder.position.set(0, 66.6, 0); holder.rotation.y = -a;
    const housing = mesh(box(1.4, 2.2, 1.2, R + 0.5, 0, 0), mats.darkMetal, 'grid fin actuator');
    const pivot = new THREE.Group(); pivot.position.set(R + 1.1, 0, 0);
    const fin = mesh(finGeo, mats.gridFin, 'grid fin');
    pivot.add(fin);
    holder.add(housing, pivot);
    root.add(holder);
    fins.push({ holder, pivot, angle: a });
  }
  parts.fins = fins;

  // engines: 13 centre (gimbal) + 20 outer (fixed)
  const defs = [];
  for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3 + Math.PI / 6; defs.push({ x: Math.cos(a) * 0.95, z: Math.sin(a) * 0.95, gimbal: true, type: 'sl', ring: 0 }); }
  for (let i = 0; i < 10; i++) { const a = i * 2 * Math.PI / 10; defs.push({ x: Math.cos(a) * 2.45, z: Math.sin(a) * 2.45, gimbal: true, type: 'sl', ring: 1 }); }
  for (let i = 0; i < 20; i++) { const a = i * 2 * Math.PI / 20 + Math.PI / 20; defs.push({ x: Math.cos(a) * 3.82, z: Math.sin(a) * 3.82, gimbal: false, type: 'sl', ring: 2 }); }
  const eng = engineCluster(defs, { y: 5.2, sl: { throat: 0.22, exit: 0.62, len: 2.35, chamber: 0.38, chamberLen: 0.6 } }, mats);
  // order of defs in the cluster matches sim engine indices: 0..12 centre, 13..32 outer
  root.add(eng.group); parts.engines = eng;

  // propellant
  const lox = liquid(mats.lox, 7.5, -1.6, 41.6, 'booster LOX');
  const ch4 = liquid(mats.ch4, 44, -1.6, 63.6, 'booster CH4');
  root.add(lox.group, ch4.group);
  parts.lox = lox; parts.ch4 = ch4;

  tagLayers(root);
  return {
    root, parts, height: H,
    explode: [
      { obj: hsr, dir: [0, 1, 0], dist: 9, label: 'Hot-staging ring', tag: 'INTERSTAGE · HSR', anchor: [R, 71, 0] },
      { obj: eng.group, dir: [0, -1, 0], dist: 12, label: 'Raptor cluster, 33 engines', tag: 'S1 · 13 + 20', anchor: [0, 2.5, R * 0.6] },
      ...fins.map((f, i) => ({ obj: f.pivot, local: true, dir: [1, 0, 0], dist: 4.5, label: i === 0 ? 'Grid fins' : null, tag: i === 0 ? 'S1 · 4 FINS' : null, anchor: [R + 3, 66.6, 0], anchorObj: f.pivot })),
      { obj: body, dir: [0, 0, 0], dist: 0, label: 'Super Heavy booster', tag: 'STAGE 1 · SUPER HEAVY', anchor: [-R, 30, 0] },
      { obj: lox.group, dir: [0, 0, 0], dist: 0, label: 'LOX / CH4 tanks, common dome', tag: 'S1 · PROPELLANT', anchor: [0, 44, R * 0.4], cutOnly: true },
    ],
    update(sim, t) {
      // gimbal: centre 13 only
      const gm = sim ? sim.gimbal : 0;
      const burning = sim && sim.thrust > 0;
      eng.update(0, -gm, burning ? 0.006 : 0, t);
      const fin = sim ? sim.gridFin : 0;
      for (const f of fins) f.pivot.rotation.x = fin * 0.45 * (f.angle < Math.PI ? 1 : -1);
    },
    setLevels(loxFrac, ch4Frac, tilt) { lox.set(loxFrac, tilt); ch4.set(ch4Frac, tilt); },
  };
}

// ---------- Starship ----------
export function buildShip(mats) {
  const root = new THREE.Group(); root.name = 'Starship';
  const parts = {};
  const H = 52, BAR = 44;
  // outer profile with ogive nose
  const outer = [[R, 0], [R, BAR]];
  for (let i = 1; i <= 16; i++) {
    const k = i / 16;
    const y = BAR + (H - BAR) * k;
    const r = R * Math.sqrt(Math.max(0, 1 - Math.pow(k, 1.6))) * (1 - 0.06 * k);
    outer.push([Math.max(0.05, r), y]);
  }
  outer.push([0, H]);
  const innerPts = [[0, H - 0.18]];
  for (let i = 16; i >= 1; i--) {
    const k = i / 16;
    const y = BAR + (H - BAR) * k - 0.18;
    const r = R * Math.sqrt(Math.max(0, 1 - Math.pow(k, 1.6))) * (1 - 0.06 * k) - WALL;
    innerPts.push([Math.max(0.02, r), y]);
  }
  innerPts.push([R - WALL, BAR], [R - WALL, 0]);
  // CCW: base inner -> base outer -> up outer -> nose -> down inner
  const prof = [[R - WALL, 0], ...outer, ...innerPts.slice(0, -1)];
  const shellGeo = latheSolid(prof, 96, 0.5);
  flattenWindward(shellGeo);
  const body = new THREE.Group();
  body.add(mesh(shellGeo, mats.shipSteel, 'ship shell'));
  body.add(mesh(dome(R - WALL, -1.4, 0.2, 6.0), mats.dome, 'ship aft dome'));
  body.add(mesh(dome(R - WALL, -1.4, 0.2, 28), mats.dome, 'ship common dome'));
  body.add(mesh(dome(R - WALL, 1.4, 0.2, 40), mats.dome, 'ship forward dome'));
  body.add(mesh(latheSolid([[0.5, 4.6], [R - WALL, 4.6], [R - WALL, 4.95], [0.5, 4.95]], 48), mats.innerSteel, 'ship thrust puck'));
  body.add(mesh(tube(0.42, 0.05, 4.6, 26.6, 20), mats.innerSteel, 'ship downcomer'));
  // header tanks (schematic)
  body.add(mesh(new THREE.SphereGeometry(1.0, 24, 16).translate(0, 47.5, 0), mats.dome, 'nose header tank'));
  body.add(mesh(new THREE.SphereGeometry(0.75, 20, 14).translate(0, 25.6, 0), mats.dome, 'CH4 header tank'));
  // QD plate, leeward/tower side
  body.add(mesh(box(1.4, 1.8, 0.25, 0, 2.6, -(R + 0.08)), mats.darkMetal, 'ship QD plate'));
  root.add(body); parts.body = body;

  // tile field on windward half
  const tileProf = [];
  tileProf.push([R + 0.035, 0.6], [R + 0.035, BAR]);
  for (let i = 1; i <= 14; i++) {
    const k = i / 16; const y = BAR + (H - BAR) * k;
    const r = R * Math.sqrt(Math.max(0, 1 - Math.pow(k, 1.6))) * (1 - 0.06 * k) + 0.035;
    tileProf.push([r, y]);
  }
  // open surface: build lathe on a polyline (not closed) by duplicating as a thin closed loop inward
  const tp = [...tileProf, ...tileProf.slice().reverse().map(([r, y]) => [r - 0.02, y])];
  const tileGeo = latheSolid(tp, 72, 0.6, -Math.PI * 0.53, Math.PI * 1.06);
  flattenWindward(tileGeo, 0.035);
  const tiles = mesh(tileGeo, mats.tiles, 'heat shield tiles');
  tiles.castShadow = false;
  // tile count sized to the published ~18,000: k such that area / (0.866 k^2) = 18000
  const area = surfaceArea(tileGeo) / 2; // outer face only
  const k = Math.sqrt(area / (18000 * 0.8660254));
  root.add(tiles); parts.tiles = tiles; parts.tileK = k; parts.tileCount = Math.round(area / (0.8660254 * k * k));

  // flaps: hinge lines near ±z, slightly toward windward (+x)
  const flaps = [];
  const mkFlap = (y0, y1, span, spanTop, side, name) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(span, 0.6); shape.lineTo(spanTop, y1 - y0 - 0.4); shape.lineTo(0, y1 - y0); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false });
    geo.translate(0, 0, -0.11);
    const hingeA = side * (Math.PI / 2 - 0.42);
    const hx = Math.cos(hingeA) * (R + 0.15), hz = Math.sin(hingeA) * (R + 0.15);
    const holder = new THREE.Group(); holder.position.set(hx, y0, hz);
    holder.rotation.y = -Math.atan2(hz, hx); // local +x points radially out
    const pivot = new THREE.Group();
    const f = mesh(geo, mats.darkMetal, name);
    f.rotation.x = 0; // shape in local xy: x outward (span), y along the axis
    pivot.add(f);
    const hinge = mesh(cyl(0.12, 0.12, y1 - y0, 0, (y1 - y0) / 2, 0, 0, 0, 0, 8), mats.steelPlain, 'flap hinge');
    holder.add(pivot, hinge);
    root.add(holder);
    const fl = { holder, pivot, side };
    flaps.push(fl);
    return fl;
  };
  const aftL = mkFlap(2.0, 14.5, 4.1, 3.2, 1, 'aft flap'), aftR = mkFlap(2.0, 14.5, 4.1, 3.2, -1, 'aft flap');
  const fwdL = mkFlap(42.5, 49.5, 2.7, 1.5, 1, 'forward flap'), fwdR = mkFlap(42.5, 49.5, 2.7, 1.5, -1, 'forward flap');
  parts.flaps = { aft: [aftL, aftR], fwd: [fwdL, fwdR] };

  // engines: 3 SL centre, 3 RVac outer
  const defs = [];
  for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3 + Math.PI / 2; defs.push({ x: Math.cos(a) * 1.2, z: Math.sin(a) * 1.2, gimbal: true, type: 'sl' }); }
  for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3 + Math.PI / 6 + Math.PI / 3; defs.push({ x: Math.cos(a) * 3.0, z: Math.sin(a) * 3.0, gimbal: true, type: 'rvac' }); }
  const eng = engineCluster(defs, {
    y: 4.3,
    sl: { throat: 0.22, exit: 0.62, len: 2.35, chamber: 0.38, chamberLen: 0.6 },
    rvac: { throat: 0.24, exit: 1.12, len: 3.4, chamber: 0.4, chamberLen: 0.6 },
  }, mats);
  root.add(eng.group); parts.engines = eng;

  const lox = liquid(mats.lox, 6.0, -1.4, 26.4, 'ship LOX');
  const ch4 = liquid(mats.ch4, 28, -1.4, 39.6, 'ship CH4');
  root.add(lox.group, ch4.group);
  parts.lox = lox; parts.ch4 = ch4;

  tagLayers(root);
  return {
    root, parts, height: H,
    explode: [
      { obj: tiles, dir: [1, 0, 0], dist: 7, label: 'Heat shield, hexagonal tile field', tag: 'S2 · ≈18,000 TILES', anchor: [R + 0.2, 30, 0] },
      { obj: eng.group, dir: [0, -1, 0], dist: 9, label: 'Three sea-level Raptors, three RVac', tag: 'S2 · 3 SL + 3 RVAC', anchor: [0, -0.2, 3.0] },
      ...[aftL, aftR, fwdL, fwdR].map((f, i) => ({ obj: f.pivot, local: true, dir: [1, 0, 0], dist: 3.2, label: i === 0 ? 'Aft flaps' : (i === 2 ? 'Forward flaps' : null), tag: i === 0 ? 'S2 · AFT FLAP' : (i === 2 ? 'S2 · FWD FLAP' : null), anchorObj: f.pivot, anchorLocal: [2.2, i < 2 ? 7 : 3.5, 0] })),
      { obj: body, dir: [0, 0, 0], dist: 0, label: 'Starship upper stage', tag: 'STAGE 2 · STARSHIP', anchor: [-R, 20, 0] },
    ],
    update(sim, t, flapsTucked) {
      const gm = sim ? sim.gimbal : 0;
      eng.update(0, -gm, sim && sim.thrust > 0 ? 0.008 : 0, t);
      const tuck = flapsTucked ?? 1;
      const ff = sim ? sim.flapFwd : 0, fa = sim ? sim.flapAft : 0;
      // flap angle about the hinge (vertical) axis: 0 = spread, + = folded leeward
      for (const f of parts.flaps.fwd) f.pivot.rotation.y = f.side * -(tuck * 1.05 + (1 - tuck) * ff * 1.2);
      for (const f of parts.flaps.aft) f.pivot.rotation.y = f.side * -(tuck * 1.05 + (1 - tuck) * fa * 1.2);
    },
    setLevels(loxFrac, ch4Frac, tilt) { lox.set(loxFrac, tilt); ch4.set(ch4Frac, tilt); },
  };
}

// slightly flatten the windward (+x) face
function flattenWindward(g, offset = 0) {
  const p = g.attributes.position, n = g.attributes.normal;
  const x0 = 3.9 + offset;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    if (x > x0) {
      p.setX(i, x0 + (x - x0) * 0.62);
      const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
      const k = Math.min(1, (x - x0) / 0.6) * 0.35;
      const vx = nx + k * Math.sign(nx), l = Math.hypot(vx, ny, nz * (1 - k * 0.5)) || 1;
      n.setXYZ(i, vx / l, ny / l, nz * (1 - k * 0.5) / l);
    }
  }
  p.needsUpdate = true; n.needsUpdate = true;
}

function tagLayers(root) {
  root.traverse((o) => { if (o.isMesh) { o.layers.enable(1); } });
}
