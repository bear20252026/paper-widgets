// Procedural geometry helpers. Everything here is generated in code.
import * as THREE from 'three';

// Solid of revolution from a closed CCW profile [[r, y], ...] in the (r, y) half plane.
// Normals are smooth around the axis; along the profile they are smooth except at corners
// sharper than `crease` radians. Produces closed solids, so section cuts read correctly.
export function latheSolid(profile, segments = 48, crease = 0.7, phiStart = 0, phiLength = Math.PI * 2) {
  const pts = profile.slice();
  if (pts.length > 2 && (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1])) pts.push(pts[0]);
  const n = pts.length;
  const segN = [];
  for (let i = 0; i < n - 1; i++) {
    const dr = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dr, dy) || 1;
    segN.push([dy / l, -dr / l]);
  }
  const closed = true;
  const vertN = (segIdx, end) => {
    // normal at end (0 start, 1 end) of segment segIdx
    const a = segN[segIdx];
    const j = end === 0 ? segIdx - 1 : segIdx + 1;
    let b = null;
    if (j >= 0 && j < segN.length) b = segN[j];
    else if (closed) b = segN[(j + segN.length) % segN.length];
    if (!b) return a;
    const ang = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1])));
    if (ang > crease) return a;
    const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  const pos = [], nor = [], uv = [], idx = [];
  const full = Math.abs(phiLength - Math.PI * 2) < 1e-6;
  const cols = segments + 1;
  let vbase = 0;
  for (let s = 0; s < n - 1; s++) {
    const p0 = pts[s], p1 = pts[s + 1];
    if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 1e-9) continue;
    const n0 = vertN(s, 0), n1 = vertN(s, 1);
    for (let k = 0; k <= segments; k++) {
      const phi = phiStart + (k / segments) * phiLength;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      for (const [p, nn, v] of [[p0, n0, 0], [p1, n1, 1]]) {
        pos.push(p[0] * cp, p[1], p[0] * sp);
        nor.push(nn[0] * cp, nn[1], nn[0] * sp);
        uv.push(k / segments, v);
      }
    }
    for (let k = 0; k < segments; k++) {
      const a = vbase + k * 2, b = a + 1, c = a + 2, d = a + 3;
      // decide winding from intended normal
      const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
      const bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2];
      const cx = pos[c * 3], cy = pos[c * 3 + 1], cz = pos[c * 3 + 2];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      let fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      if (Math.hypot(fx, fy, fz) < 1e-12) { // degenerate at axis: use the other triangle
        const dx = pos[d * 3] - bx, dy2 = pos[d * 3 + 1] - by, dz = pos[d * 3 + 2] - bz;
        const wx = cx - bx, wy = cy - by, wz = cz - bz;
        fx = wy * dz - wz * dy2; fy = wz * dx - wx * dz; fz = wx * dy2 - wy * dx;
        fx = -fx; fy = -fy; fz = -fz;
      }
      const nx = nor[a * 3] + nor[d * 3], ny = nor[a * 3 + 1] + nor[d * 3 + 1], nz = nor[a * 3 + 2] + nor[d * 3 + 2];
      if (fx * nx + fy * ny + fz * nz >= 0) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
    vbase += cols * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  if (!full) g.userData.partial = true;
  return g;
}

// thick wall tube from y0 to y1
export function tube(rOuter, thick, y0, y1, seg = 64) {
  const ri = rOuter - thick;
  return latheSolid([[ri, y0], [rOuter, y0], [rOuter, y1], [ri, y1]], seg);
}

// thick spherical-cap dome. rim at yRim, apex at yRim + rise (rise may be negative)
export function dome(r, rise, thick, yRim, seg = 48, steps = 14) {
  const outer = [], inner = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const rr = r * Math.sin(t * Math.PI / 2);
    const yy = yRim + rise * Math.cos(t * Math.PI / 2);
    outer.push([rr, yy]);
    const ri = Math.max(0, (r - thick) * Math.sin(t * Math.PI / 2));
    inner.push([ri, yy - Math.sign(rise || 1) * thick]);
  }
  // CCW: for an upward dome, go along top surface from rim to apex? build loop: inner (apex->rim), outer (rim->apex)
  const up = rise >= 0;
  let loop;
  if (up) loop = [...inner, ...outer.slice().reverse()];
  else loop = [...outer, ...inner.slice().reverse()];
  return latheSolid(loop, seg, 0.9);
}

// filled bowl (for liquid in a downward dome): apex at yRim + rise (rise < 0)
export function bowl(r, rise, yRim, seg = 40, steps = 12) {
  const pts = [[0, yRim + rise]];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    pts.push([r * Math.sin(t * Math.PI / 2), yRim + rise * Math.cos(t * Math.PI / 2)]);
  }
  pts.push([0, yRim]);
  return latheSolid(pts, seg, 0.9);
}

// Merge non-indexed or indexed geometries (position/normal/uv only)
export function merge(list) {
  let vcount = 0, icount = 0;
  const parts = list.map((g) => {
    const gg = g.index ? g : g.toNonIndexed();
    const p = gg.attributes.position.count;
    const ic = gg.index ? gg.index.count : p;
    vcount += p; icount += ic;
    return gg;
  });
  const pos = new Float32Array(vcount * 3), nor = new Float32Array(vcount * 3), uv = new Float32Array(vcount * 2);
  const idx = new Uint32Array(icount);
  let vo = 0, io = 0;
  for (const g of parts) {
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    pos.set(p.array, vo * 3);
    if (n) nor.set(n.array, vo * 3);
    if (u) uv.set(u.array, vo * 2);
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo; io += g.index.count; }
    else { for (let i = 0; i < p.count; i++) idx[io + i] = vo + i; io += p.count; }
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function box(w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1));
  g.applyMatrix4(_m);
  return g;
}
export function cyl(rt, rb, h, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 16) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1));
  g.applyMatrix4(_m);
  return g;
}
// a beam between two points (box cross-section)
export function beam(a, b, w) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const g = new THREE.BoxGeometry(w, len, w);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  _m.compose(_p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, _s.set(1, 1, 1));
  g.applyMatrix4(_m);
  return g;
}
export function surfaceArea(g) {
  const p = g.attributes.position, idx = g.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let area = 0;
  const n = idx ? idx.count : p.count;
  for (let i = 0; i < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); c.fromBufferAttribute(p, i2);
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return area;
}
