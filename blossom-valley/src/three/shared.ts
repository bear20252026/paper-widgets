import * as THREE from "three";

/**
 * Dreamy anime twilight palette:
 * - Warm tangerine-orange → coral-rose → orchid-magenta → deep indigo-violet sky
 * - Vivid soft sakura pinks + warm cream highlights + cool lavender cel shadows
 * - Royal blue-purple → periwinkle-violet low-poly mountains with blush-gold rims
 * - Whisper-soft cyber-procedural cyan/magenta luminous accents
 */
export const PALETTE = {
  // Sky gradient (bottom → zenith)
  skyGlow: 0xffa45b, // vivid tangerine-gold horizon
  skyPeach: 0xff8c82, // warm coral-apricot lower band
  skyRose: 0xe86ba8, // romantic sakura-rose mid band
  skyPurple: 0x6f39a8, // rich electric amethyst upper-mid
  skyZenith: 0x241654, // deep dreamy twilight violet-indigo
  sunCore: 0xfff4d6,
  sunHalo: 0xffb36b,

  // Atmospheric aerial perspective (blends warm near sun, violet-rose away from sun)
  fogWarm: 0xffab7c,
  fogCool: 0xb978c8,
  fogMist: 0xffc6b8,

  // Sakura blossoms & trunks
  trunkLit: 0x5c3658,
  trunkShade: 0x2d1836,
  canopyHighlight: 0xfff0f3,
  canopyShadow: 0x7650b5,
  canopyRim: 0xffcfa8,

  // Distant low-poly mountains (blue-purple anime ranges)
  mountainDeep: 0x262969,
  mountainMid: 0x4b489c,
  mountainRidge: 0x7f6dc9,
  mountainPeak: 0xf5c9e0,

  // Floating sakura petals
  petalTip: 0xfff5f9,
  petalMid: 0xff9ec7,
  petalBase: 0xff62a5,
  petalShadow: 0x9b72d6,

  // Subtle cyberpunk / procedural luminescence
  cyberCyan: 0x8ef2ff,
  cyberPink: 0xff82d8,
} as const;

/** Direction toward the visible setting sun nestled above the distant mountain pass. */
export const SUN_DIR = new THREE.Vector3(-0.15, 0.135, -0.979).normalize();

/**
 * Primary anime cel-shading key direction: angled off to the left-top-front of the sun
 * so every blossom crown and mountain peak shows rich half-warm / half-cool 3-band shading
 * while still catching golden rim light from SUN_DIR.
 */
export const CEL_DIR = new THREE.Vector3(-0.58, 0.56, -0.59).normalize();

export const FOG_NEAR = 240;
export const FOG_FAR = 2150;

/** Converts a 0xRRGGBB hex number directly into an sRGB Vector3 for custom anime shaders. */
export function srgbVec(hex: number): THREE.Vector3 {
  return new THREE.Vector3(
    ((hex >> 16) & 255) / 255,
    ((hex >> 8) & 255) / 255,
    (hex & 255) / 255
  );
}

/**
 * Shared uniform objects mutated in place each frame so sky, terrain, river, mountains,
 * 20,480 trees, wind ribbons, and 491,520 GPU petals react in unison.
 */
export const sharedUniforms = {
  uTime: { value: 0 },
  uStorm: { value: 0.55 },
  uGustBurst: { value: 0 },
  uWindScale: { value: 1.0 },
  uProcedural: { value: 0.65 },
  uWind: { value: new THREE.Vector3(7.5, 0, 2.4) },
  uCenter: { value: new THREE.Vector2(0, 40) },
  uSunDir: { value: SUN_DIR },
  uCelDir: { value: CEL_DIR },
  uFogWarm: { value: srgbVec(PALETTE.fogWarm) },
  uFogCool: { value: srgbVec(PALETTE.fogCool) },
  uFogMist: { value: srgbVec(PALETTE.fogMist) },
  uFogNear: { value: FOG_NEAR },
  uFogFar: { value: FOG_FAR },
};
