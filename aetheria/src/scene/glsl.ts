export const noiseGlsl = /* glsl */ `
float aetheriaHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float aetheriaNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(aetheriaHash(i), aetheriaHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(aetheriaHash(i + vec3(0.0, 1.0, 0.0)), aetheriaHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(aetheriaHash(i + vec3(0.0, 0.0, 1.0)), aetheriaHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(aetheriaHash(i + vec3(0.0, 1.0, 1.0)), aetheriaHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
`;

export function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function sampleCurve(keys: Array<[number, number]>, t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const span = keys[i][0] - keys[i - 1][0];
      const local = span === 0 ? 0 : (t - keys[i - 1][0]) / span;
      const s = local * local * (3 - 2 * local);
      return lerp(keys[i - 1][1], keys[i][1], s);
    }
  }
  return keys[keys.length - 1][1];
}
