import * as THREE from 'three'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

type Ctx = CanvasRenderingContext2D

function mk(w: number, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  return { c, ctx }
}

interface TexOpts {
  srgb?: boolean
  repeat?: [number, number]
  aniso?: number
  wrap?: boolean
}

function toTex(c: HTMLCanvasElement, o: TexOpts = {}) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace
  if (o.wrap !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping
  else t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1])
  t.anisotropy = o.aniso ?? 8
  t.name = 'procedural'
  t.needsUpdate = true
  return t
}

function grain(
  ctx: Ctx,
  w: number,
  h: number,
  count: number,
  rand: () => number,
  min: number,
  max: number,
  alpha: number,
  size = 1,
  tint: [number, number, number] = [1, 1, 1],
) {
  for (let i = 0; i < count; i++) {
    const v = min + rand() * (max - min)
    ctx.fillStyle = `rgba(${(v * tint[0]) | 0},${(v * tint[1]) | 0},${(v * tint[2]) | 0},${alpha})`
    ctx.fillRect(rand() * w, rand() * h, size, size)
  }
}

function stains(ctx: Ctx, w: number, h: number, count: number, rand: () => number, rgb: string, maxA: number) {
  for (let i = 0; i < count; i++) {
    const x = rand() * w
    const y = rand() * h
    const r = 40 + rand() * (w / 4)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${rgb},${maxA * (0.4 + rand() * 0.6)})`)
    g.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
}

const cache = new Map<string, THREE.Texture>()
function memo(key: string, fn: () => THREE.Texture) {
  let t = cache.get(key)
  if (!t) {
    t = fn()
    cache.set(key, t)
  }
  return t
}

/** Convert a height canvas into a tangent-space normal map via wrap-safe Sobel gradients. */
function heightToNormal(src: HTMLCanvasElement, strength = 2.4, repeatWrap = true): THREE.CanvasTexture {
  const w = src.width
  const h = src.height
  const sctx = src.getContext('2d')!
  const data = sctx.getImageData(0, 0, w, h).data
  const { c, ctx } = mk(w, h)
  const out = ctx.createImageData(w, h)
  const dst = out.data
  const wm = w - 1
  const hm = h - 1
  const at = (x: number, y: number) => {
    const xx = repeatWrap ? ((x % w) + w) % w : Math.min(wm, Math.max(0, x))
    const yy = repeatWrap ? ((y % h) + h) % h : Math.min(hm, Math.max(0, y))
    return data[(yy * w + xx) * 4] / 255
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = at(x - 1, y - 1), tc = at(x, y - 1), tr = at(x + 1, y - 1)
      const ml = at(x - 1, y), mr = at(x + 1, y)
      const bl = at(x - 1, y + 1), bc = at(x, y + 1), br = at(x + 1, y + 1)
      const dx = (tr + 2 * mr + br - (tl + 2 * ml + bl)) * strength
      const dy = (bl + 2 * bc + br - (tl + 2 * tc + tr)) * strength
      const dz = 1.0
      const inv = 1 / Math.hypot(dx, dy, dz)
      const i = (y * w + x) * 4
      dst[i] = ((-dx * inv) * 0.5 + 0.5) * 255
      dst[i + 1] = ((-dy * inv) * 0.5 + 0.5) * 255
      dst[i + 2] = ((dz * inv) * 0.5 + 0.5) * 255
      dst[i + 3] = 255
    }
  }
  ctx.putImageData(out, 0, 0)
  return toTex(c, { srgb: false, wrap: repeatWrap, aniso: 8 })
}

/** Rounded rectangle helper path. */
function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

/* ------------------------------------------------------------------ */
/*  Surfaces                                                           */
/* ------------------------------------------------------------------ */

/** 1024 px = 2.4 m of paving (4 × 600 mm slabs). */
export function concrete() {
  return memo('concrete', () => {
    const S = 1024
    const { c, ctx } = mk(S)
    const rand = rng(11)
    ctx.fillStyle = '#5c5f64'
    ctx.fillRect(0, 0, S, S)
    // 4x4 grid of 600mm honed granite/concrete slabs with individual tile tonal variation
    const n = 4
    const tile = S / n
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const delta = (rand() - 0.5) * 14
        const r = (88 + delta) | 0
        const g = (91 + delta) | 0
        const b = (96 + delta) | 0
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(i * tile, j * tile, tile, tile)
        // subtle edge wear
        ctx.strokeStyle = 'rgba(210,215,222,0.12)'
        ctx.lineWidth = 2
        ctx.strokeRect(i * tile + 3, j * tile + 3, tile - 6, tile - 6)
      }
    }
    // mineral aggregate flecks
    grain(ctx, S, S, 110000, rand, 70, 135, 0.2, 2)
    grain(ctx, S, S, 45000, rand, 35, 80, 0.2, 1)
    grain(ctx, S, S, 20000, rand, 150, 200, 0.1, 1)
    stains(ctx, S, S, 16, rand, '28,30,34', 0.2)
    stains(ctx, S, S, 8, rand, '130,134,140', 0.1)
    // crisp mortar joints
    for (let i = 0; i <= n; i++) {
      const p = (i * S) / n
      ctx.fillStyle = 'rgba(22,24,27,0.78)'
      ctx.fillRect(p - 2, 0, 4, S)
      ctx.fillRect(0, p - 2, S, 4)
    }
    return toTex(c, { aniso: 16 })
  })
}

export function concreteBump() {
  return memo('concreteBump', () => {
    const S = 1024
    const { c, ctx } = mk(S)
    const rand = rng(12)
    ctx.fillStyle = '#888888'
    ctx.fillRect(0, 0, S, S)
    grain(ctx, S, S, 90000, rand, 100, 165, 0.3, 2)
    for (let i = 0; i <= 4; i++) {
      const p = (i * S) / 4
      ctx.fillStyle = '#181818'
      ctx.fillRect(p - 3, 0, 6, S)
      ctx.fillRect(0, p - 3, S, 6)
    }
    return toTex(c, { srgb: false, aniso: 8 })
  })
}

/** Tactile dome paving: 512 px = 0.4 m */
export function tactile() {
  return memo('tactile', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(21)
    ctx.fillStyle = '#c7a12a'
    ctx.fillRect(0, 0, S, S)
    grain(ctx, S, S, 30000, rand, 140, 230, 0.2, 2, [1, 0.85, 0.35])
    stains(ctx, S, S, 5, rand, '60,50,20', 0.25)
    const n = 6
    const step = S / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = (i + 0.5) * step
        const y = (j + 0.5) * step
        const r = step * 0.3
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
        g.addColorStop(0, '#e6c04a')
        g.addColorStop(0.7, '#c29c28')
        g.addColorStop(1, '#8c6f18')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    return toTex(c)
  })
}

export function tactileBump() {
  return memo('tactileBump', () => {
    const S = 512
    const { c, ctx } = mk(S)
    ctx.fillStyle = '#404040'
    ctx.fillRect(0, 0, S, S)
    const n = 6
    const step = S / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = (i + 0.5) * step
        const y = (j + 0.5) * step
        const r = step * 0.3
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, '#ffffff')
        g.addColorStop(0.8, '#c0c0c0')
        g.addColorStop(1, '#404040')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    return toTex(c, { srgb: false })
  })
}

/** Ballast: 1024 px = 1.5 m */
export function ballast() {
  return memo('ballast', () => {
    const S = 1024
    const { c, ctx } = mk(S)
    const rand = rng(31)
    ctx.fillStyle = '#3b3835'
    ctx.fillRect(0, 0, S, S)
    for (let i = 0; i < 7000; i++) {
      const x = rand() * S
      const y = rand() * S
      const r = 8 + rand() * 22
      const v = 55 + rand() * 95
      const brown = rand() < 0.3
      const col = brown
        ? `rgb(${(v * 1.1) | 0},${(v * 0.9) | 0},${(v * 0.75) | 0})`
        : `rgb(${v | 0},${v | 0},${(v * 1.02) | 0})`
      const pts = 5 + ((rand() * 3) | 0)
      const rot = rand() * Math.PI
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      poly(ctx, x + 3, y + 4, r, pts, rot)
      ctx.fillStyle = col
      poly(ctx, x, y, r, pts, rot)
      // highlight facet
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      poly(ctx, x - 2, y - 2, r * 0.5, pts, rot)
    }
    return toTex(c)
  })
}

function poly(ctx: Ctx, x: number, y: number, r: number, n: number, rot: number) {
  ctx.beginPath()
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * Math.PI * 2
    const rr = r * (0.7 + 0.3 * Math.sin(k * 7.3 + rot))
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr * 0.8
    if (k === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

/** Brick: 1024 px = 1.0 m */
export function brick() {
  return memo('brick', () => {
    const S = 1024
    const { c, ctx } = mk(S)
    const rand = rng(41)
    ctx.fillStyle = '#a69a8c'
    ctx.fillRect(0, 0, S, S)
    grain(ctx, S, S, 20000, rand, 120, 200, 0.3, 2)
    const rows = 13
    const cols = 4
    const bh = S / rows
    const bw = S / cols
    const m = 9
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0
      for (let cI = -1; cI <= cols; cI++) {
        const x = cI * bw + off
        const y = r * bh
        const hue = 10 + rand() * 12
        const light = 28 + rand() * 16
        ctx.fillStyle = `hsl(${hue},${35 + rand() * 15}%,${light}%)`
        ctx.fillRect(x + m / 2, y + m / 2, bw - m, bh - m)
        // brick face variation
        ctx.fillStyle = `rgba(0,0,0,${rand() * 0.15})`
        ctx.fillRect(x + m / 2, y + m / 2 + (bh - m) * 0.6, bw - m, (bh - m) * 0.4)
        ctx.fillStyle = `rgba(255,255,255,${rand() * 0.08})`
        ctx.fillRect(x + m / 2, y + m / 2, bw - m, 3)
      }
    }
    grain(ctx, S, S, 40000, rand, 20, 90, 0.12, 2)
    // soot toward the bottom
    const g = ctx.createLinearGradient(0, 0, 0, S)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.6, 'rgba(10,8,6,0.1)')
    g.addColorStop(1, 'rgba(10,8,6,0.45)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    return toTex(c)
  })
}

export function paintedSteel(hex: string, seed = 51) {
  return memo('steel' + hex, () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(seed)
    ctx.fillStyle = hex
    ctx.fillRect(0, 0, S, S)
    grain(ctx, S, S, 25000, rand, 0, 255, 0.05, 1)
    stains(ctx, S, S, 8, rand, '0,0,0', 0.2)
    // drips / scratches
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    for (let i = 0; i < 20; i++) {
      const x = rand() * S
      ctx.lineWidth = 1 + rand() * 2
      ctx.beginPath()
      ctx.moveTo(x, rand() * S)
      ctx.lineTo(x + (rand() - 0.5) * 6, rand() * S)
      ctx.stroke()
    }
    return toTex(c)
  })
}

/** Rust / dark iron for rail web and foot. */
export function rust() {
  return memo('rust', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(61)
    ctx.fillStyle = '#4a3a2e'
    ctx.fillRect(0, 0, S, S)
    grain(ctx, S, S, 40000, rand, 60, 160, 0.3, 2, [1, 0.7, 0.45])
    grain(ctx, S, S, 10000, rand, 20, 60, 0.3, 2)
    return toTex(c)
  })
}

/** Corrugated soffit bump: 256 px = 0.3 m */
export function corrugatedBump() {
  return memo('corrugated', () => {
    const S = 256
    const { c, ctx } = mk(S)
    const g = ctx.createLinearGradient(0, 0, S, 0)
    for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, i % 2 ? '#ffffff' : '#404040')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    return toTex(c, { srgb: false })
  })
}

export function asphalt() {
  return memo('asphalt', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(71)
    ctx.fillStyle = '#2d2b29'
    ctx.fillRect(0, 0, S, S)
    grain(ctx, S, S, 40000, rand, 30, 90, 0.4, 2)
    grain(ctx, S, S, 4000, rand, 100, 150, 0.2, 1)
    return toTex(c)
  })
}

/* ------------------------------------------------------------------ */
/*  Signs                                                              */
/* ------------------------------------------------------------------ */

const FONT = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif'
const MONO = '"SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace'

function arrow(ctx: Ctx, x: number, y: number, size: number, dir: 'left' | 'right' | 'up', color: string) {
  ctx.save()
  ctx.translate(x, y)
  if (dir === 'left') ctx.rotate(Math.PI)
  if (dir === 'up') ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = color
  const s = size
  ctx.beginPath()
  ctx.moveTo(-s * 0.5, -s * 0.16)
  ctx.lineTo(s * 0.05, -s * 0.16)
  ctx.lineTo(s * 0.05, -s * 0.45)
  ctx.lineTo(s * 0.55, 0)
  ctx.lineTo(s * 0.05, s * 0.45)
  ctx.lineTo(s * 0.05, s * 0.16)
  ctx.lineTo(-s * 0.5, s * 0.16)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function numberBlock(ctx: Ctx, x: number, y: number, size: number, n: string, bg: string) {
  ctx.fillStyle = bg
  ctx.fillRect(x, y, size, size)
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${size * 0.72}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(n, x + size / 2, y + size / 2 + size * 0.03)
}

/** Hanging direction sign, 2.4 × 0.6 m */
export function hangingSign() {
  return memo('hangingSign', () => {
    const W = 1536
    const H = 384
    const { c, ctx } = mk(W, H)
    ctx.fillStyle = '#f4f3ef'
    ctx.fillRect(0, 0, W, H)
    const navy = '#14213d'
    // top row — platforms
    const rowH = 250
    numberBlock(ctx, 120, 40, 170, '1', '#1d4ed8')
    arrow(ctx, 60, 125, 90, 'left', navy)
    ctx.fillStyle = navy
    ctx.font = `600 82px ${FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('Platform', 320, 125)
    // divider
    ctx.fillStyle = '#9ca3af'
    ctx.fillRect(W / 2 - 2, 30, 4, rowH - 60)
    ctx.fillStyle = navy
    ctx.textAlign = 'right'
    ctx.fillText('Platform', W - 320, 125)
    numberBlock(ctx, W - 290, 40, 170, '2', '#b91c1c')
    arrow(ctx, W - 60, 125, 90, 'right', navy)
    // bottom row — way out
    ctx.fillStyle = '#15803d'
    ctx.fillRect(0, rowH, W, H - rowH)
    ctx.fillStyle = '#ffffff'
    ctx.font = `600 84px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('Way out · Tickets · Lifts', W / 2 - 40, rowH + (H - rowH) / 2)
    arrow(ctx, W - 110, rowH + (H - rowH) / 2, 80, 'up', '#ffffff')
    return toTex(c, { wrap: false, aniso: 16 })
  })
}

/** Station name board, 2.4 × 0.5 m */
export function nameBoard() {
  return memo('nameBoard', () => {
    const W = 1536
    const H = 320
    const { c, ctx } = mk(W, H)
    ctx.fillStyle = '#f4f3ef'
    ctx.fillRect(0, 0, W, H)
    const navy = '#14213d'
    ctx.fillStyle = navy
    ctx.font = `bold 150px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('WESTBROOK CENTRAL', W / 2, 118)
    ctx.fillStyle = '#b91c1c'
    ctx.fillRect(0, 212, W, 8)
    ctx.fillStyle = navy
    ctx.font = `500 56px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText('Harrowgate', 120, 268)
    arrow(ctx, 60, 268, 56, 'left', navy)
    ctx.textAlign = 'right'
    ctx.fillText('Linden Park', W - 120, 268)
    arrow(ctx, W - 60, 268, 56, 'right', navy)
    return toTex(c, { wrap: false, aniso: 16 })
  })
}

/** Departure board, 1.8 × 0.6 m, emissive */
export function departureBoard() {
  return memo('departureBoard', () => {
    const W = 1536
    const H = 512
    const { c, ctx } = mk(W, H)
    ctx.fillStyle = '#07070a'
    ctx.fillRect(0, 0, W, H)
    // header band
    ctx.fillStyle = '#17181f'
    ctx.fillRect(0, 0, W, 92)
    ctx.fillStyle = '#f5f5f4'
    ctx.font = `600 54px ${FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('Platform 2  ·  Departures', 40, 46)
    ctx.textAlign = 'right'
    ctx.font = `600 54px ${MONO}`
    ctx.fillText('14:28', W - 40, 46)
    const rows: [string, string, string][] = [
      ['14:32', 'Linden Park', 'On time'],
      ['14:41', 'Eastgate Parkway', 'On time'],
      ['14:55', 'Harbour Quay', 'Exp 14:58'],
      ['15:02', 'Northfield', 'On time'],
      ['15:17', 'Airport Terminal 2', 'On time'],
    ]
    rows.forEach(([t, d, s], i) => {
      const y = 150 + i * 78
      ctx.font = `500 54px ${MONO}`
      ctx.fillStyle = '#ffb21a'
      ctx.textAlign = 'left'
      ctx.fillText(t, 40, y)
      ctx.fillStyle = '#ffd580'
      ctx.fillText(d, 260, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = s.startsWith('Exp') ? '#ff6b35' : '#ffb21a'
      ctx.fillText(s, W - 40, y)
      ctx.fillStyle = 'rgba(255,178,26,0.12)'
      ctx.fillRect(40, y + 36, W - 80, 2)
    })
    // scanline texture
    for (let y = 0; y < H; y += 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(0, y, W, 1)
    }
    return toTex(c, { wrap: false, aniso: 16 })
  })
}

/** "MIND THE GAP" stencil decal, 2.0 × 0.4 m, transparent */
export function mindTheGap() {
  return memo('mtg', () => {
    const W = 1024
    const H = 205
    const { c, ctx } = mk(W, H)
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(245,245,240,0.85)'
    ctx.font = `bold 150px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('MIND THE GAP', W / 2, H / 2 + 6)
    // wear
    const rand = rng(81)
    ctx.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.8})`
      ctx.fillRect(rand() * W, rand() * H, 3, 3)
    }
    return toTex(c, { wrap: false })
  })
}

/** Platform number totem face, 0.5 × 0.5 m */
export function platformNumber(n: string, bg: string) {
  return memo('pn' + n, () => {
    const S = 512
    const { c, ctx } = mk(S)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, S, S)
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold 400px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(n, S / 2, S / 2 + 16)
    return toTex(c, { wrap: false })
  })
}

/** Poster 1.0 × 1.5 m */
export function poster(variant: number) {
  return memo('poster' + variant, () => {
    const W = 683
    const H = 1024
    const { c, ctx } = mk(W, H)
    const palettes = [
      ['#0f172a', '#1d4ed8', 'OFF-PEAK', 'RETURNS', 'from £9'],
      ['#7c2d12', '#f59e0b', 'SEE MORE.', 'SPEND LESS.', 'Rail rover tickets'],
      ['#064e3b', '#10b981', 'QUIET', 'COACH', 'Please keep calls short'],
    ]
    const [a, b, l1, l2, l3] = palettes[variant % palettes.length]
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, a)
    g.addColorStop(1, b)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    // graphic shapes
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.beginPath()
    ctx.arc(W * 0.75, H * 0.3, 260, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(-100, H * 0.62, W + 200, 160)
    ctx.fillStyle = '#f8fafc'
    ctx.font = `bold 120px ${FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(l1, 50, 300)
    ctx.fillText(l2, 50, 430)
    ctx.font = `500 52px ${FONT}`
    ctx.fillText(l3, 50, 900)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillRect(50, 930, 220, 6)
    return toTex(c, { wrap: false })
  })
}

/** Clock face 0.5 m */
export function clockFace() {
  return memo('clock', () => {
    const S = 512
    const cx = S / 2
    const { c, ctx } = mk(S)
    ctx.clearRect(0, 0, S, S)
    // Soft pearl-ivory dial with gentle bezel cast shadow around perimeter
    const dg = ctx.createRadialGradient(cx, cx - 20, S * 0.12, cx, cx, S * 0.49)
    dg.addColorStop(0, '#f3f1eb')
    dg.addColorStop(0.84, '#e7e4dc')
    dg.addColorStop(0.96, '#c2beb4')
    dg.addColorStop(1, '#8c8880')
    ctx.fillStyle = dg
    ctx.beginPath()
    ctx.arc(cx, cx, S / 2 - 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#252930'
    ctx.lineWidth = 10
    ctx.stroke()
    // Crisp railway clock tick marks (Swiss Mondaine / Classic British Rail)
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2
      const big = i % 5 === 0
      const r1 = cx - (big ? 74 : 42)
      const r2 = cx - 22
      ctx.strokeStyle = '#181c22'
      ctx.lineWidth = big ? 13 : 4
      ctx.lineCap = 'butt'
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * r1, cx + Math.sin(a) * r1)
      ctx.lineTo(cx + Math.cos(a) * r2, cx + Math.sin(a) * r2)
      ctx.stroke()
    }
    const hand = (angle: number, len: number, tail: number, w: number, col: string) => {
      ctx.strokeStyle = col
      ctx.lineWidth = w
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cx - Math.cos(angle) * tail, cx - Math.sin(angle) * tail)
      ctx.lineTo(cx + Math.cos(angle) * len, cx + Math.sin(angle) * len)
      ctx.stroke()
    }
    // 14:28
    hand(-Math.PI / 2 + ((2 + 28 / 60) / 12) * Math.PI * 2, 128, 34, 18, '#14171c')
    hand(-Math.PI / 2 + (28 / 60) * Math.PI * 2, 192, 42, 12, '#14171c')
    const secA = -Math.PI / 2 + (42 / 60) * Math.PI * 2
    hand(secA, 152, 54, 4.5, '#c81e1e')
    // iconic Swiss red paddle circle on second hand
    ctx.fillStyle = '#c81e1e'
    ctx.beginPath()
    ctx.arc(cx + Math.cos(secA) * 142, cx + Math.sin(secA) * 142, 16, 0, Math.PI * 2)
    ctx.fill()
    // polished centre pin
    ctx.fillStyle = '#1a1e24'
    ctx.beginPath()
    ctx.arc(cx, cx, 10, 0, Math.PI * 2)
    ctx.fill()
    // faint arched watch-glass diagonal highlight sheen
    const sg = ctx.createLinearGradient(80, 60, 420, 420)
    sg.addColorStop(0, 'rgba(255,255,255,0.22)')
    sg.addColorStop(0.45, 'rgba(255,255,255,0.03)')
    sg.addColorStop(1, 'rgba(0,0,0,0.06)')
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.arc(cx, cx, S / 2 - 8, 0, Math.PI * 2)
    ctx.fill()
    return toTex(c, { wrap: false, aniso: 16 })
  })
}

/** Train livery side band with door outlines: 1 car = 20 m → 2048 px */
export function trainSide() {
  return memo('trainSide', () => {
    const W = 2048
    const H = 384
    const { c, ctx } = mk(W, H)
    const rand = rng(91)

    // Smooth metallic silver-white automotive carbody shading (subtle rounded cantrail & tumblehome sheen)
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0.0, '#aeb5be')
    bg.addColorStop(0.09, '#d6dbe1')
    bg.addColorStop(0.18, '#e3e6ea')
    bg.addColorStop(0.64, '#d3d7dd')
    bg.addColorStop(0.84, '#b8bec6')
    bg.addColorStop(1.0, '#858b94')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    grain(ctx, W, H, 20000, rand, 180, 235, 0.035, 2)

    // Sleek rounded anthracite continuous panoramic window ribbon
    ctx.fillStyle = '#1b2028'
    rrect(ctx, 22, 38, W - 44, 194, 24)
    ctx.fill()
    // subtle metallic satin window surround highlight above & below
    ctx.strokeStyle = 'rgba(220,226,234,0.35)'
    ctx.lineWidth = 2.5
    rrect(ctx, 22, 38, W - 44, 194, 24)
    ctx.stroke()

    // Soft aerodynamic red/crimson express ribbon + slim dark navy pinstripe
    const rg = ctx.createLinearGradient(0, 246, 0, 272)
    rg.addColorStop(0, '#c62828')
    rg.addColorStop(0.5, '#a81c1e')
    rg.addColorStop(1, '#7d1517')
    ctx.fillStyle = rg
    ctx.fillRect(0, 248, W, 21)
    ctx.fillStyle = '#1b263b'
    ctx.fillRect(0, 273, W, 9)
    // delicate soft specular accent line right above stripe
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.fillRect(0, 244, W, 2)

    // Realistic subtle brake-dust gradient near lower underframe edge
    const dg = ctx.createLinearGradient(0, H * 0.75, 0, H)
    dg.addColorStop(0, 'rgba(34,32,30,0)')
    dg.addColorStop(1, 'rgba(34,32,30,0.44)')
    ctx.fillStyle = dg
    ctx.fillRect(0, 0, W, H)

    // Hairline aluminium skin panel joints
    ctx.fillStyle = 'rgba(32,36,42,0.16)'
    for (let i = 1; i < 8; i++) ctx.fillRect((i * W) / 8, 0, 1.5, H)

    // Crisp authentic UIC rail fleet markings
    ctx.fillStyle = '#2d333c'
    ctx.font = `500 15px ${MONO}`
    ctx.textAlign = 'left'
    ctx.fillText('94 70 0387 204-6  ·  WESTBROOK EXPRESS', 48, 314)
    ctx.textAlign = 'right'
    ctx.fillText('1ST / STD  ·  160 KM/H', W - 48, 314)

    // Rounded-corner double sliding plug doors with soft shadows, contrast edge strip & green button ring
    ;[0.18, 0.82].forEach((f) => {
      const x = f * W
      // subtle dark gasket seam
      ctx.fillStyle = '#20242c'
      rrect(ctx, x - 140, 24, 280, H - 36, 18)
      ctx.fill()
      // slightly warmer satin brushed-silver door panels with smooth horizontal bevel
      const dg2 = ctx.createLinearGradient(x - 134, 0, x + 134, 0)
      dg2.addColorStop(0, '#c6cbd2')
      dg2.addColorStop(0.47, '#dadfe5')
      dg2.addColorStop(0.5, '#191d24')
      dg2.addColorStop(0.53, '#dadfe5')
      dg2.addColorStop(1, '#c6cbd2')
      ctx.fillStyle = dg2
      rrect(ctx, x - 134, 30, 268, H - 46, 14)
      ctx.fill()
      // express band wraps smoothly over doors
      ctx.fillStyle = rg
      ctx.fillRect(x - 134, 248, 268, 21)
      ctx.fillStyle = '#1b263b'
      ctx.fillRect(x - 134, 273, 268, 9)
      // subtle top LED indicator bar
      ctx.fillStyle = '#b91c1c'
      rrect(ctx, x - 96, 36, 192, 6, 3)
      ctx.fill()
      // central black rubber safety finger-guard
      ctx.fillStyle = '#181c22'
      ctx.fillRect(x - 4, 28, 8, H - 44)
      // soft bevelled green illuminated door-open push buttons
      for (const bx of [x - 156, x + 156]) {
        ctx.fillStyle = '#1d2229'
        ctx.beginPath()
        ctx.arc(bx, 258, 10, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#34d399'
        ctx.lineWidth = 2.8
        ctx.stroke()
      }
    })

    // Helper: punch crisp ROUNDED-CORNER window opening with dark rubber bezel gasket
    const punchWin = (x: number, y: number, w: number, h: number, r: number) => {
      // soft outer moulded elastomer seal
      ctx.strokeStyle = '#0e1116'
      ctx.lineWidth = 7
      rrect(ctx, x - 1, y - 1, w + 2, h + 2, r + 2)
      ctx.stroke()
      // clear opening to reveal 3D sculpted saloon interior
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = '#000'
      rrect(ctx, x, y, w, h, r)
      ctx.fill()
      ctx.restore()
      // faint soft rubber lip highlight
      ctx.strokeStyle = 'rgba(210,220,232,0.22)'
      ctx.lineWidth = 2
      rrect(ctx, x + 1, y + 1, w - 2, h - 2, r)
      ctx.stroke()
    }

    const CAR_LEN = 19.6
    const toPx = (m: number) => ((m + CAR_LEN / 2) / CAR_LEN) * W
    const winY = 54
    const winH = 162
    // End panoramic windows (rounded 22 px corners)
    punchWin(toPx(-9.2), winY, toPx(-7.55) - toPx(-9.2), winH, 22)
    const bays: [number, number][] = [
      [-4.95, -2.68],
      [-2.38, -0.14],
      [0.14, 2.38],
      [2.68, 4.95],
    ]
    bays.forEach(([x0, x1]) => punchWin(toPx(x0), winY, toPx(x1) - toPx(x0), winH, 22))
    punchWin(toPx(7.55), winY, toPx(9.2) - toPx(7.55), winH, 22)
    // Double-door rounded portrait windows
    ;[0.18, 0.82].forEach((f) => {
      const x = f * W
      punchWin(x - 114, winY + 8, 98, winH - 6, 20)
      punchWin(x + 16, winY + 8, 98, winH - 6, 20)
    })

    return toTex(c, { wrap: false, aniso: 16 })
  })
}

export function pisBanner() {
  return memo('pisBanner', () => {
    const W = 1024
    const H = 128
    const { c, ctx } = mk(W, H)
    ctx.fillStyle = '#080a0e'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#262b34'
    ctx.lineWidth = 6
    ctx.strokeRect(4, 4, W - 8, H - 8)
    ctx.fillStyle = '#ffb224'
    ctx.font = `600 42px ${MONO}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('NEXT: LINDEN PARK  ·  COACH B  ·  14:28', W / 2, H / 2 + 2)
    return toTex(c, { wrap: false, aniso: 16 })
  })
}

/* ------------------------------------------------------------------ */
/*  Beauty-pass textures                                               */
/* ------------------------------------------------------------------ */

/** City facade with window grid: 512 px = 12 m, repeated per building. */
export function facadeMap() {
  return memo('facadeMap', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(301)
    ctx.fillStyle = '#5b6068'
    ctx.fillRect(0, 0, S, S)
    grain(ctx, S, S, 30000, rand, 70, 130, 0.25, 2)
    stains(ctx, S, S, 8, rand, '20,20,22', 0.25)
    const cols = 8
    const rows = 11
    const cw = S / cols
    const rh = S / rows
    for (let r = 0; r < rows; r++)
      for (let i = 0; i < cols; i++) {
        const w = cw * 0.5
        const h = rh * 0.52
        const x = i * cw + cw * 0.25
        const y = r * rh + rh * 0.28
        ctx.fillStyle = '#242a33'
        ctx.fillRect(x, y, w, h)
        ctx.fillStyle = rand() < 0.5 ? 'rgba(200,215,235,0.13)' : 'rgba(120,135,160,0.1)'
        ctx.fillRect(x, y, w, h * 0.35)
        ctx.fillStyle = 'rgba(220,220,215,0.28)'
        ctx.fillRect(x - 1, y + h, w + 2, 2)
      }
    return toTex(c)
  })
}

export function facadeEmissive() {
  return memo('facadeEmissive', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(302)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, S, S)
    const cols = 8
    const rows = 11
    const cw = S / cols
    const rh = S / rows
    for (let r = 0; r < rows; r++)
      for (let i = 0; i < cols; i++) {
        if (rand() > 0.36) continue
        const x = i * cw + cw * 0.25
        const y = r * rh + rh * 0.28
        ctx.fillStyle = rand() < 0.25 ? 'rgba(255,225,175,0.9)' : 'rgba(255,196,120,0.6)'
        ctx.fillRect(x, y, cw * 0.5, rh * 0.52)
      }
    return toTex(c)
  })
}

/** Leaf clusters on transparency, for cut-out trees & ivy. */
export function foliage() {
  return memo('foliage', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(311)
    ctx.clearRect(0, 0, S, S)
    for (let i = 0; i < 260; i++) {
      const a = rand() * Math.PI * 2
      const rr = Math.pow(rand(), 0.65) * S * 0.4
      const x = S / 2 + Math.cos(a) * rr
      const y = S / 2 + Math.sin(a) * rr * 0.92
      const s = 14 + rand() * 34
      const hue = 88 + rand() * 34
      const light = 11 + rand() * 20
      ctx.fillStyle = `hsl(${hue},${22 + rand() * 22}%,${light}%)`
      ctx.beginPath()
      ctx.ellipse(x, y, s, s * (0.5 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `hsla(${hue},30%,${light + 14}%,0.55)`
      ctx.beginPath()
      ctx.ellipse(x - s * 0.15, y - s * 0.22, s * 0.55, s * 0.3, rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    return toTex(c, { wrap: false })
  })
}

/** Deep enamelled station name board for the retaining wall. */
export function wallSign() {
  return memo('wallSign', () => {
    const W = 1024
    const H = 256
    const { c, ctx } = mk(W, H)
    const rand = rng(321)
    ctx.fillStyle = '#16233b'
    ctx.fillRect(0, 0, W, H)
    // enamel mottling
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rand() * 0.05})`
      ctx.beginPath()
      ctx.arc(rand() * W, rand() * H, 2 + rand() * 20, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = '#e8e2cf'
    ctx.lineWidth = 7
    ctx.strokeRect(22, 22, W - 44, H - 44)
    ctx.strokeStyle = 'rgba(232,226,207,0.5)'
    ctx.lineWidth = 2
    ctx.strokeRect(38, 38, W - 76, H - 76)
    ctx.fillStyle = '#efe9d8'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold 92px Georgia, "Times New Roman", serif`
    ctx.fillText('WESTBROOK CENTRAL', W / 2, H / 2 - 8)
    ctx.font = `500 30px ${FONT}`
    ctx.fillStyle = 'rgba(239,233,216,0.72)'
    ctx.fillText('EST. 1874  ·  PLATFORM 2', W / 2, H / 2 + 62)
    // rust streaks at fixings
    for (let i = 0; i < 8; i++) {
      const x = 90 + rand() * (W - 180)
      const g = ctx.createLinearGradient(x, H - 60, x, H)
      g.addColorStop(0, 'rgba(120,72,40,0.4)')
      g.addColorStop(1, 'rgba(120,72,40,0)')
      ctx.fillStyle = g
      ctx.fillRect(x, H - 60, 4, 60)
    }
    return toTex(c, { wrap: false, aniso: 16 })
  })
}

/** Newsprint, 0.3 × 0.4 m */
export function newsprint() {
  return memo('news', () => {
    const W = 256
    const H = 340
    const { c, ctx } = mk(W, H)
    const rand = rng(331)
    ctx.fillStyle = '#d9d3c4'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#20231f'
    ctx.fillRect(18, 18, W - 36, 22)
    ctx.fillStyle = 'rgba(240,236,226,0.9)'
    ctx.fillRect(18, 18, W - 36, 4)
    for (let col = 0; col < 2; col++)
      for (let l = 0; l < 26; l++) {
        ctx.fillStyle = `rgba(40,42,38,${0.25 + rand() * 0.45})`
        ctx.fillRect(18 + col * 112, 56 + l * 10, 92 - rand() * 26, 3)
      }
    return toTex(c, { wrap: false })
  })
}

/** Soft-edged puddle alpha mask. */
export function puddleAlpha() {
  return memo('puddleAlpha', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(341)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, S, S)
    // irregular union of blobs
    for (let i = 0; i < 9; i++) {
      const x = S / 2 + (rand() - 0.5) * S * 0.36
      const y = S / 2 + (rand() - 0.5) * S * 0.3
      const r = S * (0.16 + rand() * 0.16)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(0.72, '#ffffff')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * 0.62, rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    return toTex(c, { wrap: false, srgb: false })
  })
}

/** Roughness map for the wet platform: smooth puddles in a rough slab. */
export function wetRoughness() {
  return memo('wetRoughness', () => {
    const S = 1024
    const { c, ctx } = mk(S)
    const rand = rng(351)
    // base damp stone (~0.52 roughness)
    ctx.fillStyle = '#868686'
    ctx.fillRect(0, 0, S, S)
    grain(ctx, S, S, 40000, rand, 110, 175, 0.25, 2)
    // glossy wet film patches (~0.12 roughness)
    for (let i = 0; i < 34; i++) {
      const x = rand() * S
      const y = rand() * S
      const r = 45 + rand() * 160
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(20,20,20,0.92)')
      g.addColorStop(0.55, 'rgba(38,38,38,0.75)')
      g.addColorStop(1, 'rgba(134,134,134,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * (0.45 + rand() * 0.45), rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    return toTex(c, { srgb: false, aniso: 8 })
  })
}

/** Wall-mounted connections screen, 1.2 × 0.7 m */
export function infoScreen() {
  return memo('infoScreen', () => {
    const W = 1024
    const H = 600
    const { c, ctx } = mk(W, H)
    ctx.fillStyle = '#0c1420'
    ctx.fillRect(0, 0, W, H)
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, 'rgba(36,84,120,0.55)')
    g.addColorStop(1, 'rgba(12,20,32,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#0f1a28'
    ctx.fillRect(0, 0, W, 104)
    ctx.fillStyle = '#e9f2fa'
    ctx.font = `600 46px ${FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('Connections', 36, 52)
    ctx.textAlign = 'right'
    ctx.font = `500 32px ${MONO}`
    ctx.fillStyle = '#8fc7ea'
    ctx.fillText('14:29', W - 36, 52)
    const rows: [string, string, string][] = [
      ['1', 'Harrowgate', '4 min'],
      ['1', 'Eastgate', '11 min'],
      ['3', 'Airport T2', '17 min'],
      ['4', 'Harbour Quay', '24 min'],
    ]
    rows.forEach(([p, d, t], i) => {
      const y = 172 + i * 92
      ctx.fillStyle = '#1b4fa0'
      ctx.fillRect(36, y - 30, 52, 60)
      ctx.fillStyle = '#ffffff'
      ctx.font = `700 38px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(p, 62, y + 1)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#dceaf6'
      ctx.font = `500 40px ${FONT}`
      ctx.fillText(d, 116, y + 1)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#8fd0a8'
      ctx.font = `500 36px ${MONO}`
      ctx.fillText(t, W - 36, y + 1)
      ctx.fillStyle = 'rgba(160,200,225,0.14)'
      ctx.fillRect(36, y + 44, W - 72, 2)
    })
    return toTex(c, { wrap: false, aniso: 16 })
  })
}

/** Riveted metal ceiling panels: 512 px = 1.2 m */
export function soffitPanels() {
  return memo('soffitPanels', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(361)
    ctx.fillStyle = '#d3cec1'
    ctx.fillRect(0, 0, S, S)
    grain(ctx, S, S, 22000, rand, 170, 225, 0.18, 2)
    stains(ctx, S, S, 6, rand, '90,80,64', 0.14)
    // panel seams (two directions)
    for (let i = 0; i <= 2; i++) {
      const p = (i * S) / 2
      ctx.fillStyle = 'rgba(86,80,68,0.5)'
      ctx.fillRect(p - 2, 0, 3, S)
      ctx.fillRect(0, p - 2, S, 3)
      ctx.fillStyle = 'rgba(255,252,242,0.35)'
      ctx.fillRect(p + 1, 0, 1, S)
      ctx.fillRect(0, p + 1, S, 1)
    }
    // rivets along seam edges
    for (let i = 0; i < 2; i++)
      for (let k = 0; k < 22; k++) {
        const p = (i * S) / 2
        const q = (k / 21) * S
        for (const [x, y] of [
          [p + 12, q],
          [q, p + 12],
        ]) {
          const rg = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, 5)
          rg.addColorStop(0, '#efeade')
          rg.addColorStop(1, 'rgba(110,102,88,0.65)')
          ctx.fillStyle = rg
          ctx.beginPath()
          ctx.arc(x, y, 3.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    return toTex(c)
  })
}

/** Commuter seat moquette fabric: 512 px = 0.6 m repeating textile. */
export function seatMoquette() {
  return memo('seatMoquette', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(401)
    // fine dark slate-blue wool upholstery
    ctx.fillStyle = '#1e2b3c'
    ctx.fillRect(0, 0, S, S)
    // subtle micro-weave herringbone pattern
    for (let y = 0; y < S; y += 8) {
      for (let x = 0; x < S; x += 8) {
        const alt = ((x >> 3) + (y >> 3)) & 1
        ctx.fillStyle = alt ? 'rgba(46,68,94,0.55)' : 'rgba(20,30,44,0.55)'
        ctx.fillRect(x, y, 6, 6)
        if (((x >> 3) % 4 === 0) && ((y >> 3) % 4 === 0)) {
          ctx.fillStyle = 'rgba(195,120,58,0.45)'
          ctx.fillRect(x + 2, y + 2, 3, 3)
        }
      }
    }
    grain(ctx, S, S, 45000, rand, 80, 170, 0.14, 1, [0.85, 0.95, 1.1])
    // charcoal leatherette headrest band at top of backrest
    const hg = ctx.createLinearGradient(0, 0, 0, S * 0.24)
    hg.addColorStop(0, '#22252a')
    hg.addColorStop(0.9, '#282c32')
    hg.addColorStop(1, '#15181c')
    ctx.fillStyle = hg
    ctx.fillRect(0, 0, S, S * 0.22)
    // double upholstery stitch lines for twin seat cushions
    ctx.strokeStyle = 'rgba(12,16,22,0.75)'
    ctx.lineWidth = 4
    ctx.strokeRect(10, 10, S / 2 - 14, S - 20)
    ctx.strokeRect(S / 2 + 4, 10, S / 2 - 14, S - 20)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(14, 14, S / 2 - 22, S - 28)
    ctx.strokeRect(S / 2 + 8, 14, S / 2 - 22, S - 28)
    return toTex(c, { wrap: false, aniso: 16 })
  })
}

/** Anti-slip rubberized transit car floor: 512 px = 1.0 m */
export function trainFloor() {
  return memo('trainFloor', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(411)
    ctx.fillStyle = '#292b2f'
    ctx.fillRect(0, 0, S, S)
    grain(ctx, S, S, 35000, rand, 120, 220, 0.22, 1, [1, 1, 1])
    grain(ctx, S, S, 10000, rand, 200, 255, 0.35, 1, [1, 0.9, 0.7])
    // ribbed longitudinal non-slip grooves
    for (let x = 0; x < S; x += 8) {
      ctx.fillStyle = 'rgba(15,16,18,0.5)'
      ctx.fillRect(x, 0, 2, S)
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(x + 2, 0, 1, S)
    }
    return toTex(c, { wrap: true, aniso: 8 })
  })
}

/** Interior route line map / door decal strip */
export function trainRouteStrip() {
  return memo('trainRouteStrip', () => {
    const W = 1024
    const H = 96
    const { c, ctx } = mk(W, H)
    ctx.fillStyle = '#f5f5f2'
    ctx.fillRect(0, 0, W, H)
    // route line bar
    ctx.fillStyle = '#1d4ed8'
    ctx.fillRect(40, 44, W - 80, 8)
    const stations = ['Westbrook', 'Harrowgate', 'Linden Park', 'Eastgate', 'Northfield', 'Airport T2']
    stations.forEach((st, i) => {
      const x = 60 + (i / (stations.length - 1)) * (W - 120)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x, 48, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#1d4ed8'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.fillStyle = '#1e293b'
      ctx.font = 'bold 18px ' + FONT
      ctx.textAlign = 'center'
      ctx.fillText(st, x, 28)
      ctx.font = '12px ' + FONT
      ctx.fillStyle = '#64748b'
      ctx.fillText(i === 0 ? 'HERE' : `${(i * 3.5).toFixed(0)} min`, x, 74)
    })
    return toTex(c, { wrap: false, aniso: 16 })
  })
}


/* ------------------------------------------------------------------ */
/*  Smooth Photoreal Textures & Tangent-Space Normal Maps              */
/* ------------------------------------------------------------------ */

/** Warm oiled European oak timber for sculpted curved platform bench slats. */
export function oakWood() {
  return memo('oakWood', () => {
    const W = 512
    const H = 256
    const { c, ctx } = mk(W, H)
    const rand = rng(501)
    ctx.fillStyle = '#7e5938'
    ctx.fillRect(0, 0, W, H)
    // flowing organic wood grain fibers with soft cathedral streaks
    for (let y = 0; y < H; y++) {
      const wave =
        Math.sin(y * 0.14) * 0.45 +
        Math.sin(y * 0.37 + 1.3) * 0.3 +
        Math.sin(y * 0.055) * 0.25
      const r = (122 + wave * 24 + (rand() - 0.5) * 8) | 0
      const g = (84 + wave * 18 + (rand() - 0.5) * 6) | 0
      const b = (52 + wave * 12 + (rand() - 0.5) * 5) | 0
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(0, y, W, 1)
    }
    // subtle curved tangential rings + pores
    ctx.strokeStyle = 'rgba(54,34,18,0.28)'
    for (let k = 0; k < 28; k++) {
      const y0 = rand() * H
      const amp = 3 + rand() * 9
      const freq = 0.006 + rand() * 0.012
      ctx.lineWidth = 0.8 + rand() * 1.6
      ctx.beginPath()
      for (let x = 0; x <= W; x += 16) {
        const y = y0 + Math.sin(x * freq + k) * amp
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    grain(ctx, W, H, 12000, rand, 45, 95, 0.1, 1, [1.0, 0.72, 0.46])
    // subtle oiled satin highlights across rounded belly
    const sg = ctx.createLinearGradient(0, 0, 0, H)
    sg.addColorStop(0, 'rgba(30,18,10,0.22)')
    sg.addColorStop(0.5, 'rgba(255,232,195,0.08)')
    sg.addColorStop(1, 'rgba(26,16,8,0.24)')
    ctx.fillStyle = sg
    ctx.fillRect(0, 0, W, H)
    return toTex(c, { aniso: 12 })
  })
}

/** Real tangent-space normal map for granite paving slabs (sharp light catch along rounded mortar edges). */
export function concreteNormal() {
  return memo('concreteNormal', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(512)
    ctx.fillStyle = '#a0a0a0'
    ctx.fillRect(0, 0, S, S)
    // fine natural stone pitting
    grain(ctx, S, S, 45000, rand, 125, 190, 0.28, 2)
    grain(ctx, S, S, 20000, rand, 95, 145, 0.22, 1)
    // softly bevelled chamfered slab seams (blurred gradient looks genuinely rounded!)
    const n = 4
    ctx.strokeStyle = 'rgba(40,40,40,0.85)'
    for (let i = 0; i <= n; i++) {
      const p = (i * S) / n
      ctx.fillStyle = 'rgba(70,70,70,0.55)'
      ctx.fillRect(p - 3, 0, 6, S)
      ctx.fillRect(0, p - 3, S, 6)
      ctx.fillStyle = '#141414'
      ctx.fillRect(p - 1, 0, 2, S)
      ctx.fillRect(0, p - 1, S, 2)
    }
    return heightToNormal(c, 1.45, true)
  })
}

/** Real tangent-space normal map for Victorian brickwork mortar depth. */
export function brickNormal() {
  return memo('brickNormal', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(521)
    ctx.fillStyle = '#242424' // deeply recessed mortar joints
    ctx.fillRect(0, 0, S, S)
    const rows = 13
    const cols = 4
    const bh = S / rows
    const bw = S / cols
    const m = 5
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0
      for (let ci = -1; ci <= cols; ci++) {
        const x = ci * bw + off + m / 2
        const y = r * bh + m / 2
        const w = bw - m
        const h = bh - m
        const v = (175 + rand() * 55) | 0
        // softly rounded kilned clay brick cushions
        ctx.fillStyle = `rgb(${v},${v},${v})`
        rrect(ctx, x, y, w, h, 3)
        ctx.fill()
      }
    }
    grain(ctx, S, S, 22000, rand, 90, 220, 0.16, 2)
    return heightToNormal(c, 2.4, true)
  })
}

/** Real tangent-space normal map for rounded tactile blister domes. */
export function tactileNormal() {
  return memo('tactileNormal', () => {
    const S = 256
    const { c, ctx } = mk(S)
    ctx.fillStyle = '#282828'
    ctx.fillRect(0, 0, S, S)
    const n = 6
    const step = S / n
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = (i + 0.5) * step
        const y = (j + 0.5) * step
        const r = step * 0.34
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, '#ffffff')
        g.addColorStop(0.55, '#dcdcdc')
        g.addColorStop(0.85, '#787878')
        g.addColorStop(1, '#282828')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    return heightToNormal(c, 3.0, true)
  })
}

/** Real tangent-space normal map for woven commuter upholstery (pillowed plush stitch contour). */
export function moquetteNormal() {
  return memo('moquetteNormal', () => {
    const S = 256
    const { c, ctx } = mk(S)
    const rand = rng(531)
    ctx.fillStyle = '#909090'
    ctx.fillRect(0, 0, S, S)
    // subtle diagonal weave relief
    ctx.fillStyle = 'rgba(215,215,215,0.35)'
    for (let y = 0; y < S; y += 4)
      for (let x = 0; x < S; x += 4)
        if (((x + y) >> 2) & 1) ctx.fillRect(x, y, 2, 2)
    grain(ctx, S, S, 10000, rand, 110, 180, 0.2, 1)
    // twin indented upholstery stitch gutters
    ctx.strokeStyle = '#303030'
    ctx.lineWidth = 5
    rrect(ctx, 8, 8, S / 2 - 12, S - 16, 12)
    ctx.stroke()
    rrect(ctx, S / 2 + 4, 8, S / 2 - 12, S - 16, 12)
    ctx.stroke()
    return heightToNormal(c, 1.6, false)
  })
}

/** Seamless painted livery wrapping the compound-curved aerodynamic Class 387 train cab nose. */
export function cabFrontMap(isHead: boolean) {
  return memo('cabFront_' + (isHead ? 'h' : 't'), () => {
    const S = 1024
    const { c, ctx } = mk(S)
    // U = 0.5 + z/3.0, V = (y+0.1)/3.36 (note canvas y=0 is top = V=1 = y=3.26, canvas y=S is bottom = V=0 = y=-0.1)
    const py = (wy: number) => S * (1 - (wy + 0.1) / 3.36)
    const px = (wz: number) => S * (0.5 + wz / 3.0)

    // Smooth metallic pearl-silver glossy body coat
    const bg = ctx.createLinearGradient(0, 0, 0, S)
    bg.addColorStop(0.0, '#c2c8d0')
    bg.addColorStop(0.28, '#e3e6ec')
    bg.addColorStop(0.68, '#d4d8df')
    bg.addColorStop(0.88, '#b6bcc5')
    bg.addColorStop(1.0, '#5a606a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, S, S)

    // Graceful curved aerodynamic gloss-black panoramic cockpit visor mask (wraps over roof brow & flanks)
    ctx.fillStyle = '#12161d'
    ctx.beginPath()
    const topY = py(2.68)
    const botY = py(1.42)
    ctx.moveTo(px(-1.26), botY)
    ctx.quadraticCurveTo(px(-1.32), py(2.08), px(-1.12), topY)
    ctx.quadraticCurveTo(px(0), py(2.78), px(1.12), topY)
    ctx.quadraticCurveTo(px(1.32), py(2.08), px(1.26), botY)
    ctx.quadraticCurveTo(px(0), py(1.34), px(-1.26), botY)
    ctx.closePath()
    ctx.fill()

    // Soft glass sky-gradient tinted dual windscreen zones inside mask
    const wg = ctx.createLinearGradient(0, py(2.44), 0, py(1.52))
    wg.addColorStop(0, '#2a3d54')
    wg.addColorStop(0.45, '#192638')
    wg.addColorStop(1, '#0e1520')
    for (const [z0, z1] of [[-1.12, -0.05], [0.05, 1.12]]) {
      ctx.fillStyle = wg
      rrect(ctx, px(z0), py(2.34), px(z1) - px(z0), py(1.54) - py(2.34), 26)
      ctx.fill()
      // soft oblique reflection diagonal across curved laminated screen
      ctx.save()
      rrect(ctx, px(z0), py(2.34), px(z1) - px(z0), py(1.54) - py(2.34), 26)
      ctx.clip()
      const refG = ctx.createLinearGradient(px(z0), py(2.34), px(z1), py(1.65))
      refG.addColorStop(0, 'rgba(205,224,248,0.22)')
      refG.addColorStop(0.48, 'rgba(205,224,248,0.04)')
      refG.addColorStop(1, 'rgba(255,215,175,0.08)')
      ctx.fillStyle = refG
      ctx.fillRect(px(z0), py(2.34), px(z1) - px(z0), py(1.54) - py(2.34))
      // sleek parked windshield wiper arm
      ctx.strokeStyle = '#090b0f'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(px((z0 + z1) * 0.5 + 0.14), py(1.53))
      ctx.lineTo(px((z0 + z1) * 0.5 - 0.12), py(2.12))
      ctx.stroke()
      ctx.restore()
    }
    // High-contrast curved amber LED destination display centered neatly right above dual screens
    ctx.fillStyle = '#080a0e'
    rrect(ctx, px(-0.72), py(2.55), px(0.72) - px(-0.72), py(2.34) - py(2.55), 14)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#ffb638'
    ctx.font = `600 28px ${MONO}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(isHead ? 'LINDEN PARK' : 'WESTBROOK', S / 2, (py(2.55) + py(2.34)) * 0.5 + 1)

    // Graceful sweeping crimson express livery wave continuing seamlessly from side wall into nose centre
    ctx.fillStyle = '#a81c20'
    ctx.beginPath()
    ctx.moveTo(0, py(0.79))
    ctx.quadraticCurveTo(px(-0.65), py(0.79), px(0), py(0.68))
    ctx.quadraticCurveTo(px(0.65), py(0.79), S, py(0.79))
    ctx.lineTo(S, py(0.62))
    ctx.quadraticCurveTo(px(0.65), py(0.62), px(0), py(0.5))
    ctx.quadraticCurveTo(px(-0.65), py(0.62), 0, py(0.62))
    ctx.closePath()
    ctx.fill()

    // Crisp slim dark-navy companion swoosh underneath crimson
    ctx.fillStyle = '#18243a'
    ctx.beginPath()
    ctx.moveTo(0, py(0.58))
    ctx.quadraticCurveTo(px(-0.65), py(0.58), px(0), py(0.46))
    ctx.quadraticCurveTo(px(0.65), py(0.58), S, py(0.58))
    ctx.lineTo(S, py(0.51))
    ctx.quadraticCurveTo(px(0.65), py(0.51), px(0), py(0.39))
    ctx.quadraticCurveTo(px(-0.65), py(0.51), 0, py(0.51))
    ctx.closePath()
    ctx.fill()

    // Subtle brushed graphite lower skirt gradient & finely rounded coupler recess
    ctx.fillStyle = '#222730'
    ctx.fillRect(0, py(0.3), S, S - py(0.3))
    // Sculpted silver nose emblem badge
    ctx.strokeStyle = 'rgba(90,98,110,0.65)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(S / 2, py(1.06), 24, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#5a6370'
    ctx.fillRect(S / 2 - 34, py(1.06) - 3, 68, 6)

    // Sculpted recessed twin curved LED light pods (chrome-bezel housings on left and right cheeks)
    for (const side of [-1, 1]) {
      const cxL = px(side * 0.94)
      const cyL = py(1.02)
      const pw = 188
      const ph = 72
      // outer metallic surround ring
      ctx.fillStyle = '#151920'
      rrect(ctx, cxL - pw / 2, cyL - ph / 2, pw, ph, 34)
      ctx.fill()
      ctx.strokeStyle = '#9aa3ae'
      ctx.lineWidth = 4
      rrect(ctx, cxL - pw / 2 + 2, cyL - ph / 2 + 2, pw - 4, ph - 4, 32)
      ctx.stroke()
      // swept glowing daytime-running eyebrow
      ctx.strokeStyle = isHead ? '#fff7e6' : '#ff5244'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cxL - pw * 0.36, cyL - 18)
      ctx.quadraticCurveTo(cxL, cyL - 25, cxL + pw * 0.36, cyL - 18)
      ctx.stroke()
      // twin recessed projector circular lenses
      for (const ox of [-38, 36]) {
        const lg = ctx.createRadialGradient(cxL + ox, cyL + 6, 3, cxL + ox, cyL + 6, 22)
        if (isHead) {
          lg.addColorStop(0, '#fffdf5')
          lg.addColorStop(0.55, '#ffefd0')
          lg.addColorStop(1, '#3a4250')
        } else {
          lg.addColorStop(0, ox * side > 0 ? '#ff6454' : '#ffe8cc')
          lg.addColorStop(0.55, ox * side > 0 ? '#d92218' : '#d6b488')
          lg.addColorStop(1, '#2c1518')
        }
        ctx.fillStyle = lg
        ctx.beginPath()
        ctx.arc(cxL + ox, cyL + 6, 21, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Subtle soft hood fairing seam lines
    ctx.strokeStyle = 'rgba(40,46,56,0.22)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(px(-1.12), py(1.36))
    ctx.quadraticCurveTo(px(0), py(1.25), px(1.12), py(1.36))
    ctx.stroke()

    return toTex(c, { wrap: false, aniso: 16 })
  })
}

/** Matching self-illuminating emissive map for aerodynamic cab LED clusters + amber destination board. */
export function cabFrontEmissive(isHead: boolean) {
  return memo('cabEm_' + (isHead ? 'h' : 't'), () => {
    const S = 1024
    const { c, ctx } = mk(S)
    const py = (wy: number) => S * (1 - (wy + 0.1) / 3.36)
    const px = (wz: number) => S * (0.5 + wz / 3.0)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, S, S)

    // Warm amber crisp LED destination text (centered flush within curved mask)
    ctx.fillStyle = '#ffae2a'
    ctx.font = `600 28px ${MONO}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(isHead ? 'LINDEN PARK' : 'WESTBROOK', S / 2, (py(2.55) + py(2.34)) * 0.5 + 1)

    // Sculpted LED light signature + projectors
    for (const side of [-1, 1]) {
      const cxL = px(side * 0.94)
      const cyL = py(1.02)
      ctx.strokeStyle = isHead ? '#fff3d6' : '#ff3222'
      ctx.lineWidth = 7
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cxL - 66, cyL - 18)
      ctx.quadraticCurveTo(cxL, cyL - 25, cxL + 66, cyL - 18)
      ctx.stroke()
      for (const ox of [-38, 36]) {
        const r = 19
        const g = ctx.createRadialGradient(cxL + ox, cyL + 6, 2, cxL + ox, cyL + 6, r)
        if (isHead) {
          g.addColorStop(0, '#ffffff')
          g.addColorStop(0.7, '#ffecc6')
          g.addColorStop(1, 'rgba(0,0,0,0)')
        } else if (ox * side > 0) {
          g.addColorStop(0, '#ff5a42')
          g.addColorStop(0.65, '#dc1f14')
          g.addColorStop(1, 'rgba(0,0,0,0)')
        } else {
          g.addColorStop(0, '#ff3528')
          g.addColorStop(0.5, '#7a1010')
          g.addColorStop(1, 'rgba(0,0,0,0)')
        }
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cxL + ox, cyL + 6, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    return toTex(c, { wrap: false, aniso: 16 })
  })
}

/** Soft feathered ground-contact ambient occlusion ellipse for seamless natural shading under props & columns. */
export function contactAO() {
  return memo('contactAO', () => {
    const S = 256
    const { c, ctx } = mk(S)
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.08, S / 2, S / 2, S * 0.49)
    g.addColorStop(0, 'rgba(8,10,14,0.58)')
    g.addColorStop(0.42, 'rgba(8,10,14,0.34)')
    g.addColorStop(0.74, 'rgba(8,10,14,0.1)')
    g.addColorStop(1, 'rgba(8,10,14,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    return toTex(c, { wrap: false })
  })
}

/** Soft rounded architectural brick-wall limestone tone map for arches and mouldings. */
export function dressedStone() {
  return memo('dressedStone', () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(541)
    ctx.fillStyle = '#aba396'
    ctx.fillRect(0, 0, S, S)
    grain(ctx, S, S, 35000, rand, 130, 196, 0.22, 2, [1.02, 0.99, 0.93])
    stains(ctx, S, S, 10, rand, '58,54,48', 0.16)
    stains(ctx, S, S, 6, rand, '210,204,192', 0.1)
    return toTex(c, { aniso: 8 })
  })
}

/** Soft naturalistic dappled European oak/plane tree foliage texture with dark interior occlusion gradient. */
export function treeFoliageMap(seed = 551, warm = false) {
  return memo('treeFol_' + seed, () => {
    const S = 512
    const { c, ctx } = mk(S)
    const rand = rng(seed)
    // soft vertical ambient lighting (sun-dappled upper crown -> cool dark shaded lower canopy)
    const g = ctx.createLinearGradient(0, 0, 0, S)
    g.addColorStop(0, warm ? '#586743' : '#42563c')
    g.addColorStop(0.55, warm ? '#3b4a30' : '#2d3f2c')
    g.addColorStop(1, '#1b261c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    // thousands of soft organic painterly leaf daubs
    for (let i = 0; i < 3600; i++) {
      const x = rand() * S
      const y = rand() * S
      const shade = 1 - (y / S) * 0.48
      const rx = 5 + rand() * 14
      const ry = rx * (0.45 + rand() * 0.45)
      const hue = (warm ? 76 : 94) + (rand() - 0.5) * 28
      const sat = 24 + rand() * 18
      const lit = (14 + rand() * 20) * shade
      ctx.fillStyle = `hsla(${hue | 0},${sat | 0}%,${lit | 0}%,0.62)`
      ctx.beginPath()
      ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    // whisper of tiny dark internal canopy voids
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = 'rgba(14,20,14,0.34)'
      ctx.beginPath()
      ctx.arc(rand() * S, rand() * S, 3 + rand() * 8, 0, Math.PI * 2)
      ctx.fill()
    }
    return toTex(c, { aniso: 4 })
  })
}
