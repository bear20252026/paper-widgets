import * as THREE from 'three';
import type { VesselParams, VesselStats } from '../types/vessel';

export type MaterialBucket = 'copper' | 'steel' | 'concrete' | 'glass' | 'handrail' | 'baseStone';

export interface VesselBuildResult {
  geometries: Record<MaterialBucket, THREE.BufferGeometry>;
  stats: VesselStats;
  boundingRadius: number;
  centerHeight: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface BilinearFrame {
  p0: Vec3;
  p1: Vec3;
  q0: Vec3;
  q1: Vec3;
}

class MeshBucket {
  private pos: Float32Array;
  private norm: Float32Array;
  private uv: Float32Array;
  private vCount = 0;
  private capacity: number;

  constructor(initialVerts = 8192) {
    this.capacity = initialVerts;
    this.pos = new Float32Array(initialVerts * 3);
    this.norm = new Float32Array(initialVerts * 3);
    this.uv = new Float32Array(initialVerts * 2);
  }

  private ensure(extraVerts: number) {
    if (this.vCount + extraVerts <= this.capacity) return;
    let nextCap = this.capacity * 2;
    while (nextCap < this.vCount + extraVerts) nextCap *= 2;
    const nextPos = new Float32Array(nextCap * 3);
    const nextNorm = new Float32Array(nextCap * 3);
    const nextUv = new Float32Array(nextCap * 2);
    nextPos.set(this.pos.subarray(0, this.vCount * 3));
    nextNorm.set(this.norm.subarray(0, this.vCount * 3));
    nextUv.set(this.uv.subarray(0, this.vCount * 2));
    this.pos = nextPos;
    this.norm = nextNorm;
    this.uv = nextUv;
    this.capacity = nextCap;
  }

  /** Emits a counter-clockwise triangle in Three.js Y-up space with exact flat normal & metric UVs. */
  pushTri(a: Vec3, b: Vec3, c: Vec3, ua = 0, va = 0, ub = 1, vb = 0, uc = 1, vc = 1) {
    // Convert Blender Z-up (x, y, z) -> Three.js Y-up (x, z, -y), det = +1 (right-handed!)
    const ax = a.x, ay = a.z, az = -a.y;
    const bx = b.x, by = b.z, bz = -b.y;
    const cx = c.x, cy = c.z, cz = -c.y;

    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) return;
    const inv = 1 / len;
    nx *= inv;
    ny *= inv;
    nz *= inv;

    this.ensure(3);
    const pIdx = this.vCount * 3;
    const uIdx = this.vCount * 2;

    this.pos[pIdx] = ax;     this.pos[pIdx + 1] = ay; this.pos[pIdx + 2] = az;
    this.pos[pIdx + 3] = bx; this.pos[pIdx + 4] = by; this.pos[pIdx + 5] = bz;
    this.pos[pIdx + 6] = cx; this.pos[pIdx + 7] = cy; this.pos[pIdx + 8] = cz;

    this.norm[pIdx] = nx;     this.norm[pIdx + 1] = ny; this.norm[pIdx + 2] = nz;
    this.norm[pIdx + 3] = nx; this.norm[pIdx + 4] = ny; this.norm[pIdx + 5] = nz;
    this.norm[pIdx + 6] = nx; this.norm[pIdx + 7] = ny; this.norm[pIdx + 8] = nz;

    this.uv[uIdx] = ua;     this.uv[uIdx + 1] = va;
    this.uv[uIdx + 2] = ub; this.uv[uIdx + 3] = vb;
    this.uv[uIdx + 4] = uc; this.uv[uIdx + 5] = vc;

    this.vCount += 3;
  }

  /** Emits a CCW quad (a, b, c, d) with metric UV coordinates derived from real edge lengths. */
  pushQuad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, uvScale = 0.35) {
    const lenU = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * uvScale;
    const lenV = Math.hypot(d.x - a.x, d.y - a.y, d.z - a.z) * uvScale;
    this.pushTri(a, b, c, 0, 0, lenU, 0, lenU, lenV);
    this.pushTri(a, c, d, 0, 0, lenU, lenV, 0, lenV);
  }

  /** Emits a CCW convex polygon fan. */
  pushPoly(pts: Vec3[], uvScale = 0.35) {
    if (pts.length < 3) return;
    const p0 = pts[0];
    for (let i = 1; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      this.pushTri(
        p0,
        p1,
        p2,
        0,
        0,
        (p1.x - p0.x) * uvScale,
        (p1.y - p0.y) * uvScale,
        (p2.x - p0.x) * uvScale,
        (p2.y - p0.y) * uvScale
      );
    }
  }

  get vertexCount() {
    return this.vCount;
  }

  get triangleCount() {
    return this.vCount / 3;
  }

  toBufferGeometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, this.vCount * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.norm.slice(0, this.vCount * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, this.vCount * 2), 2));
    geo.computeBoundingSphere();
    return geo;
  }
}

function evalProfile(levelIndex: number, params: VesselParams, zOffset: number) {
  const L = Math.max(params.verticalLevels, 1);
  const t = Math.min(Math.max(levelIndex / L, 0), 1);
  const rLerp =
    params.baseRadius + (params.topRadius - params.baseRadius) * Math.pow(t, params.profilePower);
  const radius = rLerp + params.profileBulge * Math.sin(Math.PI * t);
  const z = zOffset + params.totalHeight * Math.pow(t, params.verticalPower);
  const twist = ((params.spiralTwistDeg * Math.PI) / 180) * t;
  return { radius, z, twist };
}

function polar(r: number, theta: number, z: number): Vec3 {
  return { x: r * Math.cos(theta), y: r * Math.sin(theta), z };
}

function warpPt(frame: BilinearFrame, u: number, v: number, w: number, uz: number): Vec3 {
  const { p0, p1, q0, q1 } = frame;
  const iv = 1 - v;
  const iu = 1 - u;
  const ax = iv * p0.x + v * p1.x;
  const ay = iv * p0.y + v * p1.y;
  const bx = iv * q0.x + v * q1.x;
  const by = iv * q0.y + v * q1.y;
  return {
    x: iu * ax + u * bx,
    y: iu * ay + u * by,
    z: (1 - uz) * p0.z + uz * q0.z + w,
  };
}

/** Emits a watertight warped box in canonical (u, v, w) space where uz can follow either u or custom top/bottom uz. */
function emitWarpedBox(
  bucket: MeshBucket,
  frame: BilinearFrame,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  w0: number,
  w1: number,
  uzBot0 = u0,
  uzBot1 = u1,
  uzTop0 = u0,
  uzTop1 = u1
) {
  // 8 corners
  const b00 = warpPt(frame, u0, v0, w0, uzBot0);
  const b10 = warpPt(frame, u1, v0, w0, uzBot1);
  const b11 = warpPt(frame, u1, v1, w0, uzBot1);
  const b01 = warpPt(frame, u0, v1, w0, uzBot0);

  const t00 = warpPt(frame, u0, v0, w1, uzTop0);
  const t10 = warpPt(frame, u1, v0, w1, uzTop1);
  const t11 = warpPt(frame, u1, v1, w1, uzTop1);
  const t01 = warpPt(frame, u0, v1, w1, uzTop0);

  // Exact right-handed outward winding:
  bucket.pushQuad(t00, t10, t11, t01); // +w top
  bucket.pushQuad(b00, b01, b11, b10); // -w bottom
  bucket.pushQuad(b00, b10, t10, t00); // -v left
  bucket.pushQuad(b01, t01, t11, b11); // +v right
  bucket.pushQuad(b00, t00, t01, b01); // -u front
  bucket.pushQuad(b10, b11, t11, t10); // +u back
}

/** Emits the exact 6-faceted chiseled architectural hull beam (matching Blender MeshCylinder 6-gon). */
function emitHullBeam(
  buckets: Record<MaterialBucket, MeshBucket>,
  frame: BilinearFrame,
  u0: number,
  u1: number,
  slabThickness: number,
  soffitDepth: number,
  soffitTaper: number,
  topBucket: MaterialBucket,
  fasciaBucket: MaterialBucket,
  copperBucket: MaterialBucket,
  topOffsetW = 0,
  vPad = 0
) {
  const taper = Math.min(Math.max(soffitTaper, 0), 0.49);
  const wTop = topOffsetW;
  const wMid = wTop - slabThickness;
  const wBot = wMid - soffitDepth;

  const vLo = -vPad;
  const vHi = 1 + vPad;
  const vTLo = taper - vPad;
  const vTHi = 1 - taper + vPad;

  // Counter-clockwise profile in (v, w) looking from +u -> -u
  const prof: [number, number][] = [
    [vHi, wTop],
    [vLo, wTop],
    [vLo, wMid],
    [vTLo, wBot],
    [vTHi, wBot],
    [vHi, wMid],
  ];

  const startRing = prof.map(([v, w]) => warpPt(frame, u0, v, w, u0));
  const endRing = prof.map(([v, w]) => warpPt(frame, u1, v, w, u1));

  // Side faces with exact material mapping:
  // 0->1: top deck | 1->2 & 5->0: vertical steel fascia | 2->3, 3->4, 4->5: 3-faceted copper hull
  const faceMats: MaterialBucket[] = [
    topBucket,
    fasciaBucket,
    copperBucket,
    copperBucket,
    copperBucket,
    fasciaBucket,
  ];

  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    buckets[faceMats[i]].pushQuad(endRing[i], startRing[i], startRing[j], endRing[j]);
  }

  // End caps (+u at u1, -u at u0)
  buckets[fasciaBucket].pushPoly(endRing);
  buckets[fasciaBucket].pushPoly([...startRing].reverse());
}

/** Emits a complete balustrade side: steel curb, tinted glass panel, bronze handrail cap, and mullion posts. */
function emitRailingSide(
  buckets: Record<MaterialBucket, MeshBucket>,
  frame: BilinearFrame,
  vCenter: number,
  trackWidth: number,
  curbMinW: number,
  curbTopW: number,
  params: VesselParams
) {
  const safeTw = Math.max(trackWidth, 0.15);
  const hrBot = params.railingHeight - params.handrailHeight;
  const safeCurbTop = Math.min(curbTopW, hrBot - 0.08);

  // 1. Steel stringer / glass base shoe curb
  const curbDv = (params.stringerWidth / safeTw) * 0.5;
  emitWarpedBox(buckets.steel, frame, 0, 1, vCenter - curbDv, vCenter + curbDv, curbMinW, safeCurbTop);

  // 2. Tinted architectural safety glass panel
  if (params.showGlass) {
    const gDv = (params.glassThickness / safeTw) * 0.5;
    emitWarpedBox(
      buckets.glass,
      frame,
      0.005,
      0.995,
      vCenter - gDv,
      vCenter + gDv,
      safeCurbTop,
      hrBot
    );
  }

  // 3. Continuous brushed metallic handrail cap
  const hDv = (params.handrailWidth / safeTw) * 0.5;
  emitWarpedBox(
    buckets.handrail,
    frame,
    0,
    1,
    vCenter - hDv,
    vCenter + hDv,
    hrBot,
    params.railingHeight
  );

  // 4. Vertical steel mullion posts evenly spaced along u in [0.025, 0.975]
  const nPosts = Math.max(0, Math.round(params.postsPerSpan));
  if (nPosts > 0) {
    const pDv = ((params.handrailWidth * 0.72) / safeTw) * 0.5;
    const denom = Math.max(nPosts - 1, 1);
    for (let p = 0; p < nPosts; p++) {
      const t = nPosts === 1 ? 0.5 : p / denom;
      const uc = 0.025 + t * 0.95;
      emitWarpedBox(
        buckets.steel,
        frame,
        uc - 0.008,
        uc + 0.008,
        vCenter - pDv,
        vCenter + pDv,
        safeCurbTop,
        hrBot
      );
    }
  }
}

/** Emits transverse structural underside ribs hugging the chiseled hull cross-section. */
function emitStructuralRibs(
  buckets: Record<MaterialBucket, MeshBucket>,
  frame: BilinearFrame,
  params: VesselParams,
  ribCount = 3
) {
  if (!params.showStructuralRibs || ribCount <= 0) return;
  const denom = Math.max(ribCount - 1, 1);
  for (let r = 0; r < ribCount; r++) {
    const t = ribCount === 1 ? 0.5 : r / denom;
    const uc = 0.18 + t * 0.64;
    emitHullBeam(
      buckets,
      frame,
      uc - 0.014,
      uc + 0.014,
      params.slabThickness + 0.015,
      params.soffitDepth + 0.025,
      params.soffitTaper,
      'steel',
      'steel',
      'steel',
      -0.02,
      0.012
    );
  }
}

/** Emits a regular N-sided prism cylinder (aligned with Blender MeshCylinder). */
function emitPrismCylinder(
  bucket: MeshBucket,
  sides: number,
  radius: number,
  zBottom: number,
  zTop: number,
  rotZ: number
) {
  const botRing: Vec3[] = [];
  const topRing: Vec3[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rotZ + (i * Math.PI * 2) / sides;
    const x = radius * Math.cos(a);
    const y = radius * Math.sin(a);
    botRing.push({ x, y, z: zBottom });
    topRing.push({ x, y, z: zTop });
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    // Outward radial normal: bot[i] -> bot[j] -> top[j] -> top[i]
    bucket.pushQuad(botRing[i], botRing[j], topRing[j], topRing[i], 0.18);
  }
  bucket.pushPoly(topRing, 0.18);
  bucket.pushPoly([...botRing].reverse(), 0.18);
}

/** Emits a flat rectangular-section circular accent ring around the central atrium medallion. */
function emitRingAccent(
  bucket: MeshBucket,
  segments: number,
  radius: number,
  width: number,
  zBottom: number,
  zTop: number
) {
  const rIn = Math.max(radius - width * 0.5, 0.1);
  const rOut = radius + width * 0.5;
  for (let i = 0; i < segments; i++) {
    const a0 = (i * Math.PI * 2) / segments;
    const a1 = ((i + 1) * Math.PI * 2) / segments;
    const bi0 = polar(rIn, a0, zBottom);
    const bi1 = polar(rIn, a1, zBottom);
    const bo0 = polar(rOut, a0, zBottom);
    const bo1 = polar(rOut, a1, zBottom);
    const ti0 = polar(rIn, a0, zTop);
    const ti1 = polar(rIn, a1, zTop);
    const to0 = polar(rOut, a0, zTop);
    const to1 = polar(rOut, a1, zTop);

    bucket.pushQuad(ti0, to0, to1, ti1); // top
    bucket.pushQuad(bo0, bo1, to1, to0); // outer
    bucket.pushQuad(bi1, bi0, ti0, ti1); // inner
  }
}

export function generateVesselGeometry(params: VesselParams): VesselBuildResult {
  const t0 = performance.now();

  const buckets: Record<MaterialBucket, MeshBucket> = {
    copper: new MeshBucket(),
    steel: new MeshBucket(),
    concrete: new MeshBucket(),
    glass: new MeshBucket(),
    handrail: new MeshBucket(),
    baseStone: new MeshBucket(),
  };

  const N = Math.max(3, Math.round(params.radialBays));
  const L = Math.max(2, Math.round(params.verticalLevels));
  const S = Math.max(3, Math.round(params.stepsPerFlight));
  const dTheta = (Math.PI * 2) / N;
  const alpha = Math.min(Math.max(params.landingRatio, 0.06), 0.45);
  const safeW = Math.max(params.walkwayWidth, 0.4);
  const halfW = safeW * 0.5;
  const split = Math.min(Math.max(params.doubleTrackSplit, 0), 1);
  const gap = Math.max(params.flightGap, 0);
  const flightWidth = Math.max(safeW * (1 - 0.5 * split) - 0.5 * gap * split, 0.28);

  const baseZ = params.showBasePlinth ? params.baseHeight : 0;
  const hullDepth = params.slabThickness + params.soffitDepth;
  const zOffset = baseZ + hullDepth;

  const avgRise = params.totalHeight / L;
  const maxStepH = (avgRise * Math.max(params.verticalPower, 1.0)) / S;
  const curbTopFlight = Math.min(maxStepH + 0.07, params.railingHeight * 0.45);
  const strVLand = (params.stringerWidth / safeW) * 0.5;
  const strVFlight = Math.min(params.stringerWidth / flightWidth, 0.35);
  const halfStrVFlight = strVFlight * 0.5;
  const vStepLo = strVFlight - 0.004;
  const vStepHi = 1 - vStepLo;

  // =========================================================================
  // 1. ALL N * (L + 1) HONEYCOMB LANDINGS (+ TOP GUARDS, RIM BRIDGES, PIERS)
  // =========================================================================
  const emitLandingUnit = (frame: BilinearFrame) => {
    emitHullBeam(
      buckets,
      frame,
      0,
      1,
      params.slabThickness,
      params.soffitDepth,
      params.soffitTaper,
      'concrete',
      'steel',
      'copper'
    );
    if (params.showRailings) {
      emitRailingSide(buckets, frame, strVLand, safeW, -params.slabThickness, 0.12, params);
      emitRailingSide(buckets, frame, 1 - strVLand, safeW, -params.slabThickness, 0.12, params);
    }
    emitStructuralRibs(buckets, frame, params, 3);
  };

  for (let k = 0; k <= L; k++) {
    const prof = evalProfile(k, params, zOffset);
    const stagger = (k % 2) * 0.5;
    const rOut = prof.radius + halfW;
    const rIn = Math.max(prof.radius - halfW, 0.25);

    for (let i = 0; i < N; i++) {
      const thC = (i + stagger) * dTheta + prof.twist;
      const thL = thC - alpha * 0.5 * dTheta;
      const thR = thC + alpha * 0.5 * dTheta;

      const frame: BilinearFrame = {
        p0: polar(rOut, thL, prof.z),
        p1: polar(rIn, thL, prof.z),
        q0: polar(rOut, thR, prof.z),
        q1: polar(rIn, thR, prof.z),
      };

      emitLandingUnit(frame);

      // Ground-level foundation support piers under Level 0 landings
      if (k === 0 && params.showBasePlinth) {
        const pierBotW = -(params.slabThickness + params.soffitDepth + 0.15);
        const pierTopW = -params.slabThickness * 0.6;
        const pierW = Math.max(safeW * (1 - params.soffitTaper * 1.8), 0.35);
        const pDv = (pierW / safeW) * 0.5;
        emitWarpedBox(buckets.steel, frame, 0.12, 0.88, 0.5 - pDv, 0.5 + pDv, pierBotW, pierTopW);
      }

      // Automatic summit outer-track end safety guardrails when rim is open
      if (k === L && params.showRailings && !params.closeTopRim && split > 0.05) {
        const endSpanV = 0.5 * split;
        const hrBot = params.railingHeight - params.handrailHeight;
        for (const [u0, u1] of [
          [0.0, 0.025],
          [0.975, 1.0],
        ] as const) {
          emitWarpedBox(buckets.steel, frame, u0, u1, 0, endSpanV, 0, 0.12);
          if (params.showGlass) {
            emitWarpedBox(buckets.glass, frame, u0, u1, 0, endSpanV, 0.12, hrBot);
          }
          emitWarpedBox(buckets.handrail, frame, u0, u1, 0, endSpanV, hrBot, params.railingHeight);
        }
      }
    }
  }

  // Optional Continuous 360° Top Rim Skywalk Bridge Decks
  if (params.closeTopRim) {
    const profTop = evalProfile(L, params, zOffset);
    const stTop = (L % 2) * 0.5;
    const rOut = profTop.radius + halfW;
    const rIn = Math.max(profTop.radius - halfW, 0.25);

    for (let i = 0; i < N; i++) {
      const th0 = (i + stTop + alpha * 0.5) * dTheta + profTop.twist;
      const th1 = (i + 1 + stTop - alpha * 0.5) * dTheta + profTop.twist;
      const bridgeFrame: BilinearFrame = {
        p0: polar(rOut, th0, profTop.z),
        p1: polar(rIn, th0, profTop.z),
        q0: polar(rOut, th1, profTop.z),
        q1: polar(rIn, th1, profTop.z),
      };
      emitLandingUnit(bridgeFrame);
    }
  }

  // =========================================================================
  // 2. ALL 2 * N * L INTERLOCKING DOUBLE-TRACK STAIR FLIGHTS
  // =========================================================================
  const nosingU = params.stepNosing / 0.3 / S;

  for (let k = 0; k < L; k++) {
    const pStart = evalProfile(k, params, zOffset);
    const pEnd = evalProfile(k + 1, params, zOffset);
    const stagger = (k % 2) * 0.5;

    const rsOut = pStart.radius + halfW;
    const rsIn = Math.max(rsOut - flightWidth, 0.2);
    const reIn = Math.max(pEnd.radius - halfW, 0.2);
    const reOut = reIn + flightWidth;

    for (let i = 0; i < N; i++) {
      const cBay = i + stagger;

      for (const dir of [-1, 1] as const) {
        const isRight = dir > 0;
        const thStart = (cBay + dir * (alpha * 0.5)) * dTheta + pStart.twist;
        const thEnd = (cBay + dir * (0.5 - alpha * 0.5)) * dTheta + pEnd.twist;

        // Right-handed frame swap for UP-LEFT (dir=-1) vs UP-RIGHT (dir=+1)
        const rs0 = isRight ? rsOut : rsIn;
        const rs1 = isRight ? rsIn : rsOut;
        const re0 = isRight ? reOut : reIn;
        const re1 = isRight ? reIn : reOut;

        const frame: BilinearFrame = {
          p0: polar(rs0, thStart, pStart.z),
          p1: polar(rs1, thStart, pStart.z),
          q0: polar(re0, thEnd, pEnd.z),
          q1: polar(re1, thEnd, pEnd.z),
        };

        // A. Sloped chiseled copper underside hull
        emitHullBeam(
          buckets,
          frame,
          0,
          1,
          params.slabThickness,
          params.soffitDepth,
          params.soffitTaper,
          'steel',
          'steel',
          'copper'
        );

        // B. Individual 3D Steps (horizontal concrete tread + overhang nosing + dark steel riser)
        for (let s = 0; s < S; s++) {
          const uFront = s / S;
          const uBack = (s + 1) / S;
          const uTreadFront = Math.max(0, uFront - nosingU);

          // Concrete horizontal tread slab (uzTop = uzBot = uBack -> 100% flat level!)
          emitWarpedBox(
            buckets.concrete,
            frame,
            uTreadFront,
            uBack,
            vStepLo,
            vStepHi,
            -0.055,
            0.0,
            uBack,
            uBack,
            uBack,
            uBack
          );

          // Dark steel riser block sealed solidly into sloped structural hull
          emitWarpedBox(
            buckets.steel,
            frame,
            uFront,
            uBack,
            vStepLo + 0.004,
            vStepHi - 0.004,
            -0.1,
            -0.052,
            uFront,
            uBack,
            uBack,
            uBack
          );
        }

        // C. Side Steel Stringers & Optional Glass Balustrades + Bronze Handrails + Posts
        if (params.showRailings) {
          emitRailingSide(
            buckets,
            frame,
            halfStrVFlight,
            flightWidth,
            -params.slabThickness,
            curbTopFlight,
            params
          );
          emitRailingSide(
            buckets,
            frame,
            1 - halfStrVFlight,
            flightWidth,
            -params.slabThickness,
            curbTopFlight,
            params
          );
        } else {
          const sDv = halfStrVFlight;
          emitWarpedBox(
            buckets.steel,
            frame,
            0,
            1,
            0,
            sDv * 2,
            -params.slabThickness,
            curbTopFlight
          );
          emitWarpedBox(
            buckets.steel,
            frame,
            0,
            1,
            1 - sDv * 2,
            1,
            -params.slabThickness,
            curbTopFlight
          );
        }

        // D. Transverse Structural Underside Ribs
        emitStructuralRibs(buckets, frame, params, 3);
      }
    }
  }

  // =========================================================================
  // 3. ALIGNED POLYGONAL STEPPED GRANITE BASE PLINTH & ATRIUM MEDALLION
  // =========================================================================
  if (params.showBasePlinth) {
    const rotZ = Math.PI / N;
    const cosPin = Math.max(Math.cos(rotZ), 0.35);
    const rTopApothem = params.baseRadius + halfW + params.baseOverhang;
    const rTopCirc = rTopApothem / cosPin;
    const nTiers = Math.max(1, Math.round(params.baseStepTiers));

    for (let t = 0; t < nTiers; t++) {
      const h = (params.baseHeight * (t + 1)) / nTiers;
      const r = rTopCirc + (nTiers - 1 - t) * 0.55;
      emitPrismCylinder(buckets.baseStone, N, r, 0, h, rotZ);
    }

    // Chamfered copper-bronze crown trim ring around top terrace edge
    emitPrismCylinder(
      buckets.copper,
      N,
      rTopCirc + 0.06,
      params.baseHeight - 0.1,
      params.baseHeight - 0.01,
      rotZ
    );

    // Central circular architectural atrium medallion inlay
    const medR = Math.max(params.baseRadius - halfW, 1.0);
    emitPrismCylinder(buckets.concrete, 48, medR, params.baseHeight - 0.02, params.baseHeight + 0.022, 0);
    emitRingAccent(
      buckets.copper,
      48,
      medR,
      0.16,
      params.baseHeight + 0.002,
      params.baseHeight + 0.035
    );
  }

  const geometries: Record<MaterialBucket, THREE.BufferGeometry> = {
    copper: buckets.copper.toBufferGeometry(),
    steel: buckets.steel.toBufferGeometry(),
    concrete: buckets.concrete.toBufferGeometry(),
    glass: buckets.glass.toBufferGeometry(),
    handrail: buckets.handrail.toBufferGeometry(),
    baseStone: buckets.baseStone.toBufferGeometry(),
  };

  let totalVertices = 0;
  let totalTriangles = 0;
  for (const key of Object.keys(buckets) as MaterialBucket[]) {
    totalVertices += buckets[key].vertexCount;
    totalTriangles += buckets[key].triangleCount;
  }

  const topProf = evalProfile(L, params, zOffset);
  const overallHeight = topProf.z + (params.showRailings ? params.railingHeight : 0);
  const maxRad = Math.max(params.baseRadius, params.topRadius, topProf.radius) + halfW;
  const rebuildMs = performance.now() - t0;

  return {
    geometries,
    boundingRadius: maxRad,
    centerHeight: overallHeight * 0.48,
    stats: {
      landings: N * (L + 1) + (params.closeTopRim ? N : 0),
      flights: 2 * N * L,
      totalSteps: 2 * N * L * S,
      vertices: totalVertices,
      triangles: totalTriangles,
      rebuildMs,
      overallHeight,
      overallDiameter: maxRad * 2,
    },
  };
}
