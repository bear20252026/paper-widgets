// Deterministic procedural valley math shared between CPU generators and GLSL shaders.
// IMPORTANT: Keep riverCenter(), riverHalfWidth(), and terrainHeight() synchronized with
// the GLSL equivalents in shaders.ts so trees, water, and GPU petals align accurately.

/** Mulberry32 — fast deterministic PRNG so every load produces the same valley. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** GLSL-compatible smoothstep(edge0, edge1, x). */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Forest footprint: wide valley spanning X in [-660, 660] and Z in [-760, 640]. */
export const FOREST_HALF_X = 660;
export const FOREST_MIN_Z = -760;
export const FOREST_MAX_Z = 640;

/** Terrain mesh bounds and resolution. */
export const TERRAIN_HALF = 1950;
export const TERRAIN_SEG = 240;

/** River water plane elevation. */
export const WATER_LEVEL = 0.0;

/** Graceful S-curve river centerline winding from the distant sunset pass toward the viewer. */
export function riverCenter(z: number): number {
  return 108.0 * Math.sin(z * 0.0041 + 0.32) + 38.0 * Math.cos(z * 0.0087 - 0.55);
}

/** Half-width of the river channel, widening gently at scenic bends. */
export function riverHalfWidth(z: number): number {
  return 22.0 + 6.0 * Math.sin(z * 0.0063 + 1.15);
}

/**
 * Analytic sakura valley elevation:
 * - Carved winding river channel down the middle (y < 0)
 * - Gentle blossom-lined riverbanks (y ~ 2..7)
 * - Sweeping amphitheater valley walls with rolling terraced hills (y ~ 12..85)
 * - Opens toward the distant sunset pass along -Z while framing both sides dramatically
 */
export function terrainHeight(x: number, z: number): number {
  const rc = riverCenter(z);
  const rw = riverHalfWidth(z);
  const d = Math.abs(x - rc);

  // Carved channel below water level, transitioning smoothly onto gentle banks
  const channel = -3.8 * (1.0 - smoothstep(rw * 0.35, rw + 3.0, d));
  const bankRise = 3.2 * smoothstep(rw - 1.0, rw + 18.0, d);

  // Sweeping valley walls rising on both sides of the river corridor
  const wallT = smoothstep(52.0, 720.0, d);
  const valleyWall = 74.0 * wallT * Math.sqrt(wallT);

  // Multi-octave rolling hills suppressed right along the water so the river never dams
  const hillMask = smoothstep(rw + 8.0, rw + 68.0, d);
  const hills =
    (11.0 * Math.sin(x * 0.0074 + 0.5) * Math.cos(z * 0.0066 - 0.35) +
      6.0 * Math.sin(x * 0.0148 - z * 0.0124 + 1.75) +
      2.6 * Math.cos(x * 0.029 + z * 0.025 - 0.85)) *
    hillMask;

  // Soft painterly terrace modulation on the hillsides
  const baseH = channel + bankRise + valleyWall + hills;
  const terrace = 1.15 * Math.sin(baseH * 0.48) * smoothstep(rw + 28.0, rw + 120.0, d);

  return baseH + terrace;
}

/**
 * Sakura grove density in [0, 1]:
 * - Lush continuous blossom promenades lining both riverbanks
 * - Rich billowing hillside groves separated by dreamy winding meadows
 */
export function groveDensity(x: number, z: number): number {
  const d = Math.abs(x - riverCenter(z));
  const rw = riverHalfWidth(z);

  // Dense sakura avenues hugging both sides of the river
  const riverPromenade =
    smoothstep(rw + 3.5, rw + 11.0, d) * (1.0 - smoothstep(rw + 38.0, rw + 78.0, d)) * 0.92;

  // Sweeping hillside grove waves with scenic open flower meadows between them
  const n1 = Math.sin(x * 0.0068 + z * 0.0042 + 0.8) * Math.cos(z * 0.0079 - x * 0.0036);
  const n2 = Math.sin(x * 0.0155 - z * 0.0138 + 2.2) * 0.45;
  const cluster = Math.max(0, Math.min(1, 0.54 + 0.52 * (n1 + n2)));
  const hillside = 0.14 + 0.86 * smoothstep(0.22, 0.78, cluster);

  return Math.min(1.0, Math.max(riverPromenade, hillside));
}

/** Coherent blossom hue selector [0, 1] so adjacent hillsides shift in painterly pink waves. */
export function groveTint(x: number, z: number): number {
  const w =
    0.5 +
    0.32 * Math.sin(x * 0.0052 - z * 0.0044 + 0.6) +
    0.18 * Math.cos(x * 0.013 + z * 0.011 - 1.2);
  return Math.max(0, Math.min(1, w));
}
