import * as THREE from 'three'

/* ------------------------------------------------------------------ */
/*  Shared Helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Weld position-matched vertices across non-indexed ExtrudeGeometry faces whose face normals
 * meet below `creaseDeg`, yielding buttery-smooth subdivision-like curved shading on bevels
 * while keeping crisp intentional planes sharp.
 */
export function smoothNormals(g: THREE.BufferGeometry, creaseDeg = 58): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g
  const pos = geo.attributes.position
  const count = pos.count
  const triCount = (count / 3) | 0
  const faceNormals = new Float32Array(triCount * 3)
  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()
  const vC = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const fn = new THREE.Vector3()
  const cosMax = Math.cos((creaseDeg * Math.PI) / 180)

  // Spatial bucket by rounded mm coordinate (safe across bevel arcs)
  const buckets = new Map<string, number[]>()
  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3
    vA.fromBufferAttribute(pos, i0)
    vB.fromBufferAttribute(pos, i0 + 1)
    vC.fromBufferAttribute(pos, i0 + 2)
    e1.subVectors(vB, vA)
    e2.subVectors(vC, vA)
    fn.crossVectors(e1, e2)
    const area = fn.length()
    if (area > 1e-10) fn.divideScalar(area)
    faceNormals[i0] = fn.x
    faceNormals[i0 + 1] = fn.y
    faceNormals[i0 + 2] = fn.z
    for (let k = 0; k < 3; k++) {
      const idx = i0 + k
      const key = `${Math.round(pos.getX(idx) * 2000)},${Math.round(pos.getY(idx) * 2000)},${Math.round(pos.getZ(idx) * 2000)}`
      let list = buckets.get(key)
      if (!list) {
        list = []
        buckets.set(key, list)
      }
      list.push(idx)
    }
  }

  const normals = new Float32Array(count * 3)
  for (const list of buckets.values()) {
    for (let a = 0; a < list.length; a++) {
      const ia = list[a]
      const ta = ((ia / 3) | 0) * 3
      const ax = faceNormals[ta], ay = faceNormals[ta + 1], az = faceNormals[ta + 2]
      let sx = ax, sy = ay, sz = az
      for (let b = 0; b < list.length; b++) {
        if (a === b) continue
        const tb = ((list[b] / 3) | 0) * 3
        const bx = faceNormals[tb], by = faceNormals[tb + 1], bz = faceNormals[tb + 2]
        if (ax * bx + ay * by + az * bz >= cosMax) {
          sx += bx
          sy += by
          sz += bz
        }
      }
      const len = Math.hypot(sx, sy, sz) || 1
      normals[ia * 3] = sx / len
      normals[ia * 3 + 1] = sy / len
      normals[ia * 3 + 2] = sz / len
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return geo
}

/** 2D rounded rectangle path centred on origin. */
export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const rr = Math.min(r, w * 0.48, h * 0.48)
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + rr, y)
  s.lineTo(x + w - rr, y)
  s.quadraticCurveTo(x + w, y, x + w, y + rr)
  s.lineTo(x + w, y + h - rr)
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  s.lineTo(x + rr, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - rr)
  s.lineTo(x, y + rr)
  s.quadraticCurveTo(x, y, x + rr, y)
  return s
}

/** Smoothly rounded and bevelled box centred on origin (depth along Z). */
export function makeRoundedBox(
  w: number,
  h: number,
  d: number,
  radius = 0.04,
  bevel = 0.015,
  bevelSegs = 3,
): THREE.BufferGeometry {
  const b = Math.min(bevel, d * 0.35, w * 0.2, h * 0.2)
  const shape = roundedRectShape(Math.max(0.01, w - b * 2), Math.max(0.01, h - b * 2), Math.max(0.004, radius - b * 0.5))
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.004, d - b * 2),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: Math.min(bevelSegs, 2),
    curveSegments: bevelSegs >= 3 ? 5 : 4,
  })
  g.center()
  return smoothNormals(g, 68)
}

/** Smooth capsule-bar along X axis (useful for sleek handrails, handles, lamp casings). */
export function makeCapsuleX(length: number, radius: number): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 6, 14)
  g.rotateZ(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/** Smooth horizontal elliptical ring of geometry from 2D points (y up, r out). */
function lathe(pts: [number, number][], segs = 28): THREE.BufferGeometry {
  const v = pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y))
  const g = new THREE.LatheGeometry(v, segs)
  g.computeVertexNormals()
  return g
}

/** Smooth Catmull-Rom tube helper. */
function tube(pts: [number, number, number][], radius: number, segs = 28, radial = 12): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
  const g = new THREE.TubeGeometry(curve, segs, radius, radial, false)
  g.computeVertexNormals()
  return g
}

/* ------------------------------------------------------------------ */
/*  Station Architecture                                               */
/* ------------------------------------------------------------------ */

/**
 * Moulded heritage-modern cast-iron column (y = 0 to height).
 * Includes stepped curved base plinth, scotia & torus rings, subtle entasis taper,
 * upper astragal collars and smoothly flared bell capital.
 */
export function makeCastIronColumn(height = 3.85): THREE.BufferGeometry {
  const pts: [number, number][] = [
    [0.27, 0.0],
    [0.27, 0.07],
    [0.255, 0.11],
    [0.23, 0.14],
    [0.23, 0.24],
    [0.215, 0.3],
    [0.19, 0.36],
    [0.205, 0.41], // torus roll
    [0.185, 0.45],
    [0.165, 0.52], // concave taper into shaft
    [0.155, 0.62],
    [0.148, 1.4],
    [0.142, 2.4],
    [0.136, height - 0.55],
    [0.155, height - 0.5], // necking astragal ring
    [0.138, height - 0.45],
    [0.148, height - 0.36],
    [0.178, height - 0.24], // flared bell capital
    [0.228, height - 0.14],
    [0.255, height - 0.08],
    [0.262, height - 0.03],
    [0.245, height],
  ]
  return lathe(pts, 24)
}

/**
 * Graceful curved cast-iron arch spandrel bracket reaching from a column
 * (at y = 3.12, z = 0) up and inward into the barrel-vault arch rib.
 */
export function makeSpandrelBracket(dir: 1 | -1): THREE.BufferGeometry {
  return tube(
    [
      [0, 3.12, 0],
      [0, 3.55, dir * 0.18],
      [0, 3.92, dir * 0.52],
      [0, 4.18, dir * 0.98],
      [0, 4.35, dir * 1.48],
    ],
    0.048,
    16,
    10,
  )
}

/** Smooth circular ornamental ring nested in column spandrel brackets. */
export function makeSpandrelRing(r = 0.22, t = 0.026): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(r, t, 10, 22)
  g.rotateY(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/** Smooth vaulted parabolic steel rib following canopy curve across width. */
export function makeVaultRib(hw: number, spring: number, rise: number, radius = 0.072): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = []
  const n = 28
  for (let i = 0; i <= n; i++) {
    const z = -hw + (i / n) * hw * 2
    const y = spring + rise * (1 - (z / hw) * (z / hw))
    pts.push(new THREE.Vector3(0, y, z))
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, radius, 10, false)
  g.computeVertexNormals()
  return g
}

/** Subtle architectural arched wrought-iron horizontal tension tie-rod with gentle upward camber. */
export function makeTieRod(halfSpan = 2.95, y0 = 3.88, lift = 0.28): THREE.BufferGeometry {
  return tube(
    [
      [0, y0, -halfSpan],
      [0, y0 + lift * 0.72, -halfSpan * 0.5],
      [0, y0 + lift, 0],
      [0, y0 + lift * 0.72, halfSpan * 0.5],
      [0, y0, halfSpan],
    ],
    0.015,
    20,
    8,
  )
}

/** Smooth horizontal roof section strip along X spanning z0..z1 of the barrel vault. */
export function makeVaultStrip(
  length: number,
  hw: number,
  spring: number,
  rise: number,
  z0: number,
  z1: number,
  yOff = 0,
): THREE.BufferGeometry {
  const nx = 24
  const nz = 14
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= nx; i++) {
    const x = -length / 2 + (i / nx) * length
    for (let j = 0; j <= nz; j++) {
      const z = z0 + (j / nz) * (z1 - z0)
      const y = spring + rise * (1 - (z / hw) * (z / hw)) + yOff
      pos.push(x, y, z)
      uv.push((i / nx) * (length / 2.4), (j / nz) * ((z1 - z0) / 1.8))
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = i * (nz + 1) + j
      const b = (i + 1) * (nz + 1) + j
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Curved molded fascia eaves profile extruded along the full platform length (rounded edge + trough gutter). */
export function makeCanopyFascia(length: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-0.08, -0.34)
  s.quadraticCurveTo(0.06, -0.34, 0.08, -0.24)
  s.lineTo(0.09, 0.02)
  s.quadraticCurveTo(0.18, 0.05, 0.19, 0.14)
  s.quadraticCurveTo(0.19, 0.21, 0.12, 0.21)
  s.lineTo(0.02, 0.21)
  s.quadraticCurveTo(-0.04, 0.18, -0.05, 0.1)
  s.lineTo(-0.08, -0.34)
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 10 })
  g.translate(0, 0, -length / 2)
  g.rotateY(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/** Curved smooth semicircular Victorian brick viaduct blind-arch spandrel bay (8m wide, facing +Z). */
export function makeViaductArchPanel(bayW = 8.0, wallH = 5.2, archR = 3.15, springY = 1.45): THREE.BufferGeometry {
  const s = new THREE.Shape()
  const hw = bayW / 2
  const left = -archR
  const right = archR
  s.moveTo(-hw, 0)
  s.lineTo(left, 0)
  s.lineTo(left, springY)
  // clockwise semicircle from pi down to 0
  s.absarc(0, springY, archR, Math.PI, 0, true)
  s.lineTo(right, 0)
  s.lineTo(hw, 0)
  s.lineTo(hw, wallH)
  s.lineTo(-hw, wallH)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 1,
    curveSegments: 16,
  })
  // Normalize UVs to real-world metre scale for seamless brick texture
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * 0.9, uv.getY(i) * 0.9)
  }
  uv.needsUpdate = true
  return smoothNormals(g, 56)
}

/** Carved semicircular stone archivolt moulding band framing each brick arch bay. */
export function makeStoneArchivolt(innerR = 3.12, outerR = 3.44): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.absarc(0, 0, outerR, 0, Math.PI, false)
  s.absarc(0, 0, innerR, Math.PI, 0, true)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 1,
    curveSegments: 18,
  })
  return smoothNormals(g, 62)
}

/** Molded stone viaduct cornice running full station length along X. */
export function makeCornice(length: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-0.44, -0.14)
  s.lineTo(0.44, -0.14)
  s.quadraticCurveTo(0.54, -0.06, 0.56, 0.04)
  s.quadraticCurveTo(0.56, 0.14, 0.44, 0.16)
  s.lineTo(-0.44, 0.16)
  s.quadraticCurveTo(-0.56, 0.14, -0.56, 0.04)
  s.quadraticCurveTo(-0.54, -0.06, -0.44, -0.14)
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 8 })
  g.translate(0, 0, -length / 2)
  g.rotateY(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/** Graceful wrought-iron swan-neck wall lantern bracket (extends in +Z direction). */
export function makeSwanNeck(): THREE.BufferGeometry {
  return tube(
    [
      [0, -0.1, 0],
      [0, 0.16, 0.2],
      [0, 0.34, 0.48],
      [0, 0.31, 0.72],
      [0, 0.14, 0.8],
    ],
    0.026,
    22,
    10,
  )
}

/** Spun heritage metal shade cap above globe lantern. */
export function makeLanternHood(): THREE.BufferGeometry {
  return lathe(
    [
      [0.01, 0.18],
      [0.06, 0.16],
      [0.12, 0.1],
      [0.24, 0.02],
      [0.26, 0.0],
      [0.24, -0.015],
    ],
    24,
  )
}

/** Smooth frosted warm-glass pendant lantern globe. */
export function makeLanternGlobe(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.165, 22, 16)
  g.scale(1, 1.12, 1)
  return g
}

/** Sleek aerodynamic pendant luminaire body (rounded capsule bar). */
export function makeLinearLampHousing(): THREE.BufferGeometry {
  return makeRoundedBox(1.85, 0.085, 0.19, 0.042, 0.022, 3)
}

export function makeLinearLampDiffuser(): THREE.BufferGeometry {
  return makeRoundedBox(1.74, 0.048, 0.12, 0.024, 0.014, 3)
}

/** Spun double-sided station clock bezel housing (aligned facing ±X). */
export function makeClockHousing(): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(0.34, 0.048, 16, 40)
  g.rotateY(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

export function makeClockBody(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.34, 0.34, 0.095, 40)
  g.rotateZ(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/* ------------------------------------------------------------------ */
/*  Platform, Coping, Track & Catenary                                 */
/* ------------------------------------------------------------------ */

/** Rounded bullnose platform coping stone profile extruded along X (with anti-slip bevel overhang). */
export function makeBullnoseCoping(length: number): THREE.BufferGeometry {
  // z = +0.34 is trackside overhang; z = -0.30 joins platform deck
  const s = new THREE.Shape()
  s.moveTo(-0.32, -0.09)
  s.lineTo(0.26, -0.09)
  s.quadraticCurveTo(0.36, -0.09, 0.36, -0.045) // smoothly curved underside of bullnose
  s.quadraticCurveTo(0.36, 0.0, 0.27, 0.004) // soft front lip radius
  s.lineTo(-0.32, 0.004)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 10 })
  g.translate(0, 0, -length / 2)
  g.rotateY(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/** Realistic European EN 60E1 Vignoles flat-bottom railway rail profile extruded along X. */
export function makeRailHead(length: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  // rounded polished running crown
  s.moveTo(-0.036, -0.044)
  s.lineTo(0.036, -0.044)
  s.lineTo(0.038, -0.012)
  s.quadraticCurveTo(0.038, 0.0, 0.018, 0.002)
  s.quadraticCurveTo(0.0, 0.004, -0.018, 0.002)
  s.quadraticCurveTo(-0.038, 0.0, -0.038, -0.012)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 8 })
  g.translate(0, 0, -length / 2)
  g.rotateY(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

export function makeRailWebFoot(length: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  // realistic curved waist I-profile web & sloped flange foot
  s.moveTo(-0.075, -0.172)
  s.lineTo(0.075, -0.172)
  s.lineTo(0.075, -0.152)
  s.quadraticCurveTo(0.022, -0.14, 0.012, -0.112)
  s.lineTo(0.012, -0.068)
  s.quadraticCurveTo(0.016, -0.046, 0.033, -0.042)
  s.lineTo(-0.033, -0.042)
  s.quadraticCurveTo(-0.016, -0.046, -0.012, -0.068)
  s.lineTo(-0.012, -0.112)
  s.quadraticCurveTo(-0.022, -0.14, -0.075, -0.152)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 6 })
  g.translate(0, 0, -length / 2)
  g.rotateY(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/** Gently sloped trapezoidal railway ballast bed (soft rounded shoulder, extruded along X). */
export function makeBallastBed(length: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-2.75, -0.32)
  s.lineTo(2.75, -0.32)
  s.quadraticCurveTo(2.15, -0.26, 1.78, -0.04)
  s.quadraticCurveTo(1.55, 0.04, 1.25, 0.04)
  s.lineTo(-1.25, 0.04)
  s.quadraticCurveTo(-1.55, 0.04, -1.78, -0.04)
  s.quadraticCurveTo(-2.15, -0.26, -2.75, -0.32)
  const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 8 })
  g.translate(0, 0, -length / 2)
  g.rotateY(Math.PI / 2)
  // Clean tiled meter-scale UVs for ballast stones
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / 1.5, pos.getZ(i) / 1.5)
  }
  uv.needsUpdate = true
  g.computeVertexNormals()
  return g
}

/** Chamfered concrete monobloc railway sleeper (spanning Z, width 2.5m). */
export function makeSleeper(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-0.14, -0.1)
  s.lineTo(0.14, -0.1)
  s.lineTo(0.11, 0.09)
  s.quadraticCurveTo(0.1, 0.105, 0.08, 0.105)
  s.lineTo(-0.08, 0.105)
  s.quadraticCurveTo(-0.1, 0.105, -0.11, 0.09)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 2.48, bevelEnabled: false, curveSegments: 2 })
  g.center()
  g.computeVertexNormals()
  return g
}

/** Multi-shed ceramic high-voltage catenary insulator (LatheGeometry). */
export function makeInsulator(): THREE.BufferGeometry {
  const pts: [number, number][] = [[0.03, -0.22]]
  const sheds = 5
  for (let i = 0; i < sheds; i++) {
    const y0 = -0.18 + i * 0.075
    pts.push([0.035, y0], [0.085, y0 + 0.022], [0.088, y0 + 0.034], [0.035, y0 + 0.056])
  }
  pts.push([0.03, 0.22])
  return lathe(pts, 16)
}

/** Real gravity-sagging parabolic overhead catenary messenger wire span. */
export function makeCatenarySpan(span = 40, sag = 0.62): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = []
  const n = 16
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = (t - 0.5) * span
    const y = -sag * 4 * t * (1 - t)
    pts.push(new THREE.Vector3(x, y, 0))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.014, 6, false)
}

/* ------------------------------------------------------------------ */
/*  Smooth Organic Platform Furniture                                  */
/* ------------------------------------------------------------------ */

/** Graceful ergonomic cast-iron bench side hoop frame with rolled armrest curve (facing +Z). */
export function makeBenchFrame(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  // Elegant curved C/S sweep from front leg → curved seat cradle → arched back
  s.moveTo(0.24, 0.0)
  s.lineTo(0.3, 0.0)
  s.quadraticCurveTo(0.33, 0.28, 0.3, 0.44)
  s.quadraticCurveTo(0.28, 0.5, 0.14, 0.49)
  s.lineTo(-0.18, 0.46)
  s.quadraticCurveTo(-0.28, 0.52, -0.34, 0.94)
  s.quadraticCurveTo(-0.36, 0.98, -0.4, 0.96)
  s.quadraticCurveTo(-0.34, 0.5, -0.27, 0.36)
  s.lineTo(-0.26, 0.0)
  s.lineTo(-0.2, 0.0)
  s.lineTo(-0.18, 0.38)
  s.lineTo(0.2, 0.4)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.042,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 1,
    curveSegments: 8,
  })
  g.translate(0, 0, -0.021)
  g.rotateY(-Math.PI / 2)
  return smoothNormals(g, 66)
}

/** Graceful looped cast-metal armrest mounted on bench side (facing +Z). */
export function makeBenchArmrest(): THREE.BufferGeometry {
  return tube(
    [
      [0, 0.47, 0.24],
      [0, 0.63, 0.2],
      [0, 0.66, 0.02],
      [0, 0.64, -0.22],
    ],
    0.022,
    18,
    10,
  )
}

/** Single smoothly rounded oiled-oak bench timber slat running along X (1.96 m long). */
export function makeBenchSlat(): THREE.BufferGeometry {
  const s = roundedRectShape(0.074, 0.036, 0.016)
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.94, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 1, curveSegments: 5 })
  g.translate(0, 0, -0.97)
  g.rotateY(Math.PI / 2)
  // Tile natural length-wise wood grain cleanly along X
  const p = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1) * 0.5, (p.getZ(i) + p.getY(i)) * 4 + 0.5)
  uv.needsUpdate = true
  return smoothNormals(g, 72)
}

/** Bench full set of ergonomically curved slat offsets [y, z, tiltX] facing +Z. */
export const BENCH_SLATS: [number, number, number][] = [
  // soft rolled waterfall front lip
  [0.42, 0.29, 0.48],
  [0.458, 0.21, 0.14],
  [0.464, 0.12, -0.04],
  [0.456, 0.03, -0.1],
  [0.448, -0.06, -0.12],
  [0.446, -0.15, -0.08],
  // graceful upward lumbar curve
  [0.54, -0.24, -1.28],
  [0.64, -0.275, -1.34],
  [0.74, -0.305, -1.36],
  [0.84, -0.33, -1.32],
  [0.93, -0.355, -1.22],
]

/** Sculpted stainless steel public litter bin body (domed top hood + recessed toe-kick). */
export function makeDomedBinBody(): THREE.BufferGeometry {
  return lathe(
    [
      [0.21, 0.0],
      [0.21, 0.06],
      [0.255, 0.09],
      [0.265, 0.14],
      [0.265, 0.68],
      [0.278, 0.71], // rolled rim bead
      [0.26, 0.74],
      [0.235, 0.75], // recessed dark neck
      [0.235, 0.88],
    ],
    32,
  )
}

export function makeDomedBinCap(): THREE.BufferGeometry {
  return lathe(
    [
      [0.276, 0.86],
      [0.285, 0.885],
      [0.27, 0.935],
      [0.225, 0.995],
      [0.14, 1.045],
      [0.05, 1.068],
      [0.002, 1.072],
    ],
    32,
  )
}

/** Sculpted architectural curved-rim cast-stone planter bowl (LatheGeometry). */
export function makePlanterBowl(): THREE.BufferGeometry {
  return lathe(
    [
      [0.36, 0.0],
      [0.41, 0.08],
      [0.49, 0.28],
      [0.54, 0.48],
      [0.56, 0.56],
      [0.59, 0.6], // soft rolled lip
      [0.57, 0.64],
      [0.51, 0.64],
      [0.48, 0.52], // hollow inner lip
    ],
    32,
  )
}

/** Soft organic curved ornamental grass/fern leaf ribbon arched gracefully outward. */
export function makeArchedBlade(len = 0.72, arch = 0.36): THREE.BufferGeometry {
  const segs = 7
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const w = 0.042 * Math.sin(Math.pow(t, 0.65) * Math.PI) + 0.004 * (1 - t)
    const r = t * len
    const y = Math.sin(t * Math.PI * 0.76) * arch + t * 0.14 - t * t * 0.16
    pos.push(-w, y, r)
    pos.push(w, y, r)
    if (i < segs) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Soft smoothly-shaded rounded English deciduous tree canopy dome (welded SphereGeometry — zero harsh facets!). */
export function makeOrganicCrown(seed = 1): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 18, 12)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    // Gentle rolling continuous harmonic puffiness (welded across UV seam via world xyz, zero faceting!)
    const n =
      0.15 * Math.sin(v.x * 2.6 + seed) * Math.cos(v.z * 2.4 - seed * 0.4) +
      0.1 * Math.cos(v.y * 3.2 + seed * 1.1) * Math.sin((v.x - v.z) * 2.5) +
      0.05 * Math.sin(v.x * 5.2 + v.z * 4.6 + seed)
    const puff = 1 + n
    v.x *= puff
    v.z *= puff
    // gently flatten base & softly round oak crown silhouette
    v.y = v.y * puff * (v.y < 0 ? 0.68 : 0.88)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

/** Rounded polycarbonate wheeled carry-on suitcase body. */
export function makeSuitcase(): THREE.BufferGeometry {
  return makeRoundedBox(0.44, 0.64, 0.27, 0.065, 0.032, 4)
}

/** Smooth loop luggage handle. */
export function makeSuitcaseHandle(): THREE.BufferGeometry {
  return tube(
    [
      [-0.1, 0.62, 0],
      [-0.1, 0.92, 0],
      [-0.06, 0.96, 0],
      [0.06, 0.96, 0],
      [0.1, 0.92, 0],
      [0.1, 0.62, 0],
    ],
    0.011,
    18,
    8,
  )
}

/** Soft rounded leather weekender holdall bag. */
export function makeWeekenderBag(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 20, 14)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * 0.26
    let y = p.getY(i) * 0.18
    const z = p.getZ(i) * 0.14
    // flatten bottom naturally as if resting under weight
    if (y < -0.11) y = -0.11 + (y + 0.11) * 0.18
    // subtle soft middle slouch
    if (y > 0.05) y *= 1 - 0.08 * (1 - (x / 0.26) ** 2)
    x *= 1 + (y < 0 ? 0.06 : -0.05)
    p.setXYZ(i, x, y + 0.13, z)
  }
  g.computeVertexNormals()
  return g
}

/* ------------------------------------------------------------------ */
/*  Smooth Sculpted Modern Class 387 / Express Train                   */
/* ------------------------------------------------------------------ */

/**
 * Smoothly curved exterior carriage roof barrel curving tangentially
 * into rounded upper side cantrails (extruded along X).
 */
export function makeTrainRoofShell(len: number): THREE.BufferGeometry {
  const s = new THREE.Shape()
  const hw = 1.445
  const baseY = 2.84
  const topY = 3.24
  s.moveTo(-hw, baseY)
  s.bezierCurveTo(-hw, baseY + 0.26, -1.02, topY, 0, topY)
  s.bezierCurveTo(1.02, topY, hw, baseY + 0.26, hw, baseY)
  s.lineTo(hw - 0.09, baseY - 0.02)
  s.bezierCurveTo(hw - 0.12, baseY + 0.18, 0.92, topY - 0.09, 0, topY - 0.09)
  s.bezierCurveTo(-0.92, topY - 0.09, -(hw - 0.12), baseY + 0.18, -(hw - 0.09), baseY - 0.02)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 20 })
  g.translate(0, 0, -len / 2)
  g.rotateY(Math.PI / 2)
  return smoothNormals(g, 62)
}

/** Smooth arched interior saloon acoustic ceiling vault with recessed curves. */
export function makeTrainInnerCeiling(len: number): THREE.BufferGeometry {
  const nx = 4
  const nz = 24
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= nx; i++) {
    const x = -len / 2 + (i / nx) * len
    for (let j = 0; j <= nz; j++) {
      const f = (j / nz) * 2 - 1 // -1 .. +1
      const z = f * 1.38
      // gentle smooth dome from 2.66 at cantrail up to 2.94 at center crown
      const y = 2.66 + 0.28 * Math.pow(Math.max(0, 1 - f * f), 0.72)
      pos.push(x, y, z)
      uv.push(i / nx, j / nz)
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const a = i * (nz + 1) + j
      const b = (i + 1) * (nz + 1) + j
      // inward/downward facing normals
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Smooth aerodynamic curved roof HVAC shroud pod. */
export function makeRoofPod(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  const l = 1.65
  const h = 0.25
  s.moveTo(-l, 0)
  s.bezierCurveTo(-l + 0.15, h, -l + 0.6, h, 0, h)
  s.bezierCurveTo(l - 0.6, h, l - 0.15, h, l, 0)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 1.56,
    bevelEnabled: true,
    bevelThickness: 0.13,
    bevelSize: 0.09,
    bevelSegments: 3,
    curveSegments: 12,
  })
  g.translate(0, 0, -0.78)
  return smoothNormals(g, 68)
}

/**
 * Helper describing a point on the sculpted Class 387 / Hitachi aerodynamic train cab nose.
 * Parameterized for dir = +1 (nose projects along +X from x=0 to x=noseLen).
 * u in [0, 1]: axial distance from car body junction (0) to tip (1).
 * a in [0, 2*PI]: perimeter angle around body cross-section (0 = +Z side, PI/2 = roof top, PI = -Z, 3PI/2 = floor).
 */
export function evalCabPoint(u: number, a: number, noseLen = 1.68): [number, number, number] {
  // Base cross section: smoothly rounded rectangle (superellipse) matching car shell
  // Width 2.89 m (±1.445), height from y=-0.12 to y=3.24 (center y=1.56, half-h=1.68)
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const sgnC = Math.sign(ca)
  // Superellipse exponent makes body softly curved shoulders rather than square boxes
  const expZ = 0.26
  const expY = sa > 0 ? 0.44 : 0.28 // rounder elliptical roof curve, sleek slightly tucked skirt
  const baseZ = sgnC * Math.pow(Math.abs(ca), expZ) * 1.445
  const baseY = sa >= 0 ? 1.56 + Math.pow(sa, expY) * 1.68 : 1.56 - Math.pow(-sa, expY) * 1.66

  // Smooth aerodynamic nose taper in width (tucking into soft curved bullet plan)
  const ease = Math.pow(u, 1.85)
  const widthScale = Math.max(0.002, Math.sqrt(Math.max(0, 1 - Math.pow(u, 2.35) * 0.996)))
  // Slight organic forehead sweep backward on the roof, forward chin protrusion at driver bumper
  const normY = (baseY - (-0.1)) / 3.34 // 0 bottom .. 1 top
  const rakePush =
    normY > 0.32
      ? -Math.pow((normY - 0.32) / 0.68, 1.38) * 0.86 * Math.pow(u, 0.85)
      : Math.sin((normY / 0.32) * Math.PI) * 0.14 * u
  // Gently drop roofline down into nose crown
  const roofDrop = normY > 0.5 ? Math.pow((normY - 0.5) / 0.5, 1.4) * 0.52 * ease : 0
  // Slight gentle lift of bottom valance like a sleek modern high-speed commuter train
  const chinLift = normY < 0.2 ? (1 - normY / 0.2) * 0.26 * Math.pow(u, 1.7) : 0

  // Smooth rounded tip closure
  const xTip = noseLen * Math.sin(u * Math.PI * 0.5)
  const yCenter = 1.02
  const yBlend = u > 0.86 ? (u - 0.86) / 0.14 : 0
  const ySmooth = THREE.MathUtils.lerp(baseY - roofDrop + chinLift, yCenter, yBlend * yBlend * 0.92)
  const z = baseZ * widthScale
  const x = Math.max(0, xTip + rakePush * (1 - yBlend * 0.5))
  return [x, ySmooth, z]
}

/** Full smooth compound-curved aerodynamic railcar cab nose (oriented +X, mirror via rotation.y = Math.PI for -X). */
export function makeSculptedCabNose(noseLen = 1.68): THREE.BufferGeometry {
  const nu = 22
  const na = 48
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= nu; i++) {
    const u = i / nu
    for (let j = 0; j <= na; j++) {
      const a = (j / na) * Math.PI * 2
      const [x, y, z] = evalCabPoint(u, a, noseLen)
      pos.push(x, y, z)
      // Planar front UV mapping projected by z, y so livery stripes + cab graphics map effortlessly
      uv.push(0.5 + z / 3.0, Math.min(1, Math.max(0, (y + 0.1) / 3.35)))
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < na; j++) {
      const p0 = i * (na + 1) + j
      const p1 = (i + 1) * (na + 1) + j
      // Outward normals: (p1-p0)=+X, (p0+1-p0)=+Y at a=0 -> X×Y = +Z (outward)
      idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Evaluate sculpted aerodynamic front surface X(y, z) for flush-fitting components. */
export function cabFrontX(y: number, z: number, noseLen = 1.55): number {
  const zn = Math.min(0.995, Math.abs(z) / 1.445)
  // smooth compound wrap curve (gently bull-nosed Class 387 / Hitachi Azuma / Eurostar e320)
  const planCurve = Math.pow(Math.max(0, 1 - Math.pow(zn, 2.55)), 0.56)
  // height normalised: 0 at y=-0.08 (skirt bottom), 1 at y=3.24 (roof crown)
  const h = Math.max(0, Math.min(1, (y + 0.08) / 3.32))
  // Side elevation sleek curve: projecting gently around waist/buffer (h~0.28), sweeping gracefully back over windscreen & roof
  let sideCurve: number
  if (h < 0.28) {
    // softly curved lower chin tucked inward smoothly
    const t = (0.28 - h) / 0.28
    sideCurve = 1.0 - 0.32 * Math.pow(t, 1.9)
  } else {
    // sleek swept nose blending gently upward and smoothly into domed roof crown
    const t = (h - 0.28) / 0.72
    sideCurve = 1.0 - 0.58 * Math.pow(t, 1.45) - 0.42 * Math.pow(t, 5.2)
  }
  return Math.max(0, noseLen * planCurve * sideCurve)
}

/**
 * Full smooth monolithic aerodynamic train cab shell (projects along +X from x=0).
 * Guaranteed watertight, smoothly curved crown, rounded cheeks, tapered chin, no jagged creases.
 */
export function makeCabHull(noseLen = 1.55): THREE.BufferGeometry {
  const nArc = 44 // perimeter from left lower skirt -> left wall -> domed roof -> right wall -> right skirt
  const nDepth = 20 // from car junction (0) to aerodynamic rounded nose (1)
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []

  // Cross section matches car shell width 2.89m (±1.445), bottom y=-0.08, roof arch peak y=3.24
  function crossPt(tf: number): [number, number] {
    // smooth full perimeter mapped over angle around centre (0, 1.58)
    const a = tf * Math.PI * 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const expZ = 0.24
    const expY = sa >= 0 ? 0.52 : 0.22
    const z = Math.sign(ca) * Math.pow(Math.abs(ca), expZ) * 1.445
    const y = sa >= 0 ? 1.58 + Math.pow(sa, expY) * 1.66 : 1.58 - Math.pow(-sa, expY) * 1.66
    return [y, z]
  }

  for (let i = 0; i <= nDepth; i++) {
    const f = i / nDepth // 0 = junction with car body, 1 = nose front apex at (x=cabFrontX, y=0.86, z=0)
    // Radial contraction from outer perimeter towards central face point (y=0.92, z=0)
    const s = Math.cos(f * Math.PI * 0.5) // 1 -> 0 smoothly with vertical tangent at junction
    const shrink = f < 0.99 ? Math.pow(s, 0.78) : 0
    for (let j = 0; j <= nArc; j++) {
      const [cy, cz] = crossPt(j / nArc)
      const z = cz * shrink
      const y = THREE.MathUtils.lerp(0.92, cy, shrink)
      const rawX = cabFrontX(y, z, noseLen)
      // Blend axial extension smoothly so f=0 stays strictly flush at x=0 (joins car seamlessly)
      const x = f === 0 ? 0 : rawX * Math.min(1, Math.sin(f * Math.PI * 0.5) * 1.02)
      pos.push(x, y, z)
      // Front-projected UV (facing +X: observer looks along -X so +Z is to the left -> flip sign for right-reading text)
      uv.push(0.5 - z / 3.0, Math.min(1, Math.max(0, (y + 0.1) / 3.36)))
    }
  }
  for (let i = 0; i < nDepth; i++) {
    for (let j = 0; j < nArc; j++) {
      const p0 = i * (nArc + 1) + j
      const p1 = (i + 1) * (nArc + 1) + j
      idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Flush compound-curved rounded surface patch clinging cleanly onto cabFrontX(y, z). */
export function makeCabFlushPatch(
  yMin: number,
  yMax: number,
  zHalf: number,
  noseLen = 1.55,
  offset = 0.02,
  cornerRound = 0.2,
  topTaper = 0.1,
): THREE.BufferGeometry {
  const ny = 14
  const nz = 28
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const h = yMax - yMin

  for (let i = 0; i <= ny; i++) {
    const vf = i / ny
    const y = yMin + vf * h
    // Smooth superellipse rounded-corner boundary
    const sn = vf * 2 - 1 // -1..1
    const rFrac = Math.min(0.48, cornerRound / Math.max(0.05, h))
    const absS = Math.abs(sn)
    let cornerScale = 1
    if (absS > 1 - rFrac * 2) {
      const t = (absS - (1 - rFrac * 2)) / (rFrac * 2)
      cornerScale = Math.sqrt(Math.max(0.08, 1 - t * t * 0.85))
    }
    const halfZ = zHalf * (1 - topTaper * vf) * cornerScale
    for (let j = 0; j <= nz; j++) {
      const hf = j / nz
      const z = (hf * 2 - 1) * halfZ
      const x = cabFrontX(y, z, noseLen) + offset
      pos.push(x, y, z)
      uv.push(hf, vf)
    }
  }
  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nz; j++) {
      const a = i * (nz + 1) + j
      const b = (i + 1) * (nz + 1) + j
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Smooth aerodynamic curved cab-to-body waist cowling skirt wrapping below floor line. */
export function makeCabSkirt(noseLen = 1.55): THREE.BufferGeometry {
  const nz = 28
  const ny = 6
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= ny; i++) {
    const t = i / ny
    const y = -0.34 + t * 0.34
    const pull = 0.84 + 0.14 * Math.sin(t * Math.PI * 0.5)
    for (let j = 0; j <= nz; j++) {
      const a = -Math.PI * 0.49 + (j / nz) * Math.PI * 0.98
      const z = Math.sin(a) * 1.4
      const x = Math.cos(a) * (noseLen * 0.82 * pull)
      pos.push(x, y, z)
    }
  }
  for (let i = 0; i < ny; i++) {
    for (let j = 0; j < nz; j++) {
      const a = i * (nz + 1) + j
      const b = (i + 1) * (nz + 1) + j
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Flanged steel railway wheel (LatheGeometry, radius 0.43 m). */
export function makeTrainWheel(): THREE.BufferGeometry {
  const g = lathe(
    [
      [0.11, -0.07],
      [0.14, -0.07],
      [0.14, -0.04],
      [0.34, -0.035],
      [0.37, -0.062],
      [0.43, -0.062],
      [0.44, 0.045],
      [0.475, 0.056], // inner track wheel flange!
      [0.472, 0.072],
      [0.41, 0.072],
      [0.36, 0.04],
      [0.14, 0.04],
      [0.14, 0.07],
      [0.11, 0.07],
    ],
    24,
  )
  g.rotateX(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/* ------------------------------------------------------------------ */
/*  Smooth Ergonomic Saloon Seating & Fittings                         */
/* ------------------------------------------------------------------ */

/** Ergonomic softly rolled double-seat cushion facing +X (waterfall knee curve, plush rounded top). */
export function makeSeatCushion(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  // x along car length (front=+0.24, rear=-0.22), y vertical
  s.moveTo(-0.22, -0.03)
  s.lineTo(0.21, -0.03)
  s.bezierCurveTo(0.28, -0.02, 0.29, 0.06, 0.22, 0.088) // plush waterfall knee edge
  s.bezierCurveTo(0.08, 0.092, -0.06, 0.068, -0.2, 0.078) // comfortable scoop contour
  s.quadraticCurveTo(-0.24, 0.06, -0.22, -0.03)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.8,
    bevelEnabled: true,
    bevelThickness: 0.036,
    bevelSize: 0.028,
    bevelSegments: 1,
    curveSegments: 6,
  })
  g.translate(0, 0, -0.4)
  const p = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, (p.getZ(i) + 0.44) / 0.88, (p.getX(i) + 0.28) / 0.56)
  }
  uv.needsUpdate = true
  return smoothNormals(g, 76)
}

/** Ergonomic S-curved plush lumbar seat backrest facing +X (width along Z = 0.86m). */
export function makeSeatBackrest(): THREE.BufferGeometry {
  const s = new THREE.Shape()
  s.moveTo(-0.04, 0.0)
  s.bezierCurveTo(-0.06, 0.2, -0.1, 0.42, -0.13, 0.62)
  s.quadraticCurveTo(-0.09, 0.655, -0.04, 0.62)
  s.bezierCurveTo(0.01, 0.44, 0.04, 0.22, 0.055, 0.06)
  s.quadraticCurveTo(0.04, -0.01, -0.04, 0.0)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.8,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.025,
    bevelSegments: 1,
    curveSegments: 6,
  })
  g.translate(0, 0, -0.4)
  const p = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, (p.getZ(i) + 0.44) / 0.88, 1 - Math.max(0, Math.min(1, p.getY(i) / 0.68)))
  }
  uv.needsUpdate = true
  return smoothNormals(g, 76)
}

/** Sculpted plush leatherette pillowed headrest (smooth welded normals for true upholstered feel!). */
export function makeSeatHeadrest(): THREE.BufferGeometry {
  const s = roundedRectShape(0.36, 0.19, 0.078)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.062,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.028,
    bevelSegments: 1,
    curveSegments: 5,
  })
  g.center()
  g.rotateY(Math.PI / 2)
  return smoothNormals(g, 85)
}

/** Sleek curved U-shaped tubular seatback grab-handle loop (facing aisle side). */
export function makeSeatGrabLoop(): THREE.BufferGeometry {
  return tube(
    [
      [0, -0.06, 0],
      [0, 0.04, 0.02],
      [0, 0.075, 0.09],
      [0, 0.065, 0.16],
      [0, 0.0, 0.18],
    ],
    0.013,
    10,
    6,
  )
}

/** Graceful curved passenger folding seat armrest (facing +X). */
export function makeSeatArmrest(): THREE.BufferGeometry {
  return tube(
    [
      [-0.14, 0.02, 0],
      [-0.02, 0.025, 0],
      [0.14, 0.018, 0],
      [0.2, -0.02, 0],
    ],
    0.022,
    8,
    6,
  )
}

/** Hanging commuter loop hand-strap dangling from overhead grab rail (teardrop loop). */
export function makeHandStrap(): THREE.BufferGeometry {
  return tube(
    [
      [0, 0, 0],
      [0, -0.14, 0],
      [0, -0.21, 0.055],
      [0, -0.26, 0.04],
      [0, -0.275, 0],
      [0, -0.26, -0.04],
      [0, -0.21, -0.055],
      [0, -0.14, 0],
    ],
    0.009,
    14,
    6,
  )
}

/** Rounded glass vestibule draught screen header + curved support stanchion. */
export function makeDraughtGlass(): THREE.BufferGeometry {
  const s = roundedRectShape(0.84, 1.48, 0.14)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2, curveSegments: 10 })
  g.center()
  g.rotateY(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

/** Soft rounded architectural windbreak canopy header on platform. */
export function makeShelterGlass(): THREE.BufferGeometry {
  return makeRoundedBox(2.92, 1.92, 0.022, 0.08, 0.006, 2)
}

/** Trackside classic hooded multi-aspect signal lens sun-visor. */
export function makeSignalHood(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.115, 0.115, 0.24, 18, 1, true, -Math.PI * 0.1, Math.PI * 1.2)
  g.rotateZ(Math.PI / 2)
  g.computeVertexNormals()
  return g
}
