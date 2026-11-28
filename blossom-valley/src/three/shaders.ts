// Custom GLSL shader library for Sakura Storm Valley.
// NOTE: Keep riverCenterG(), riverHalfW(), and terrainH() synchronized with math.ts.

/* ============================================================================
 * 1. Shared Procedural Noise, Analytic Valley & Anime Atmospheric Fog
 * ========================================================================== */

export const SIMPLEX_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

export const HASH_GLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
`;

/** Exact GLSL counterpart of math.ts valley geometry. */
export const VALLEY_GLSL = /* glsl */ `
float riverCenterG(float z) {
  return 108.0 * sin(z * 0.0041 + 0.32) + 38.0 * cos(z * 0.0087 - 0.55);
}

float riverHalfW(float z) {
  return 22.0 + 6.0 * sin(z * 0.0063 + 1.15);
}

float terrainH(vec2 xz) {
  float x = xz.x;
  float z = xz.y;
  float rc = riverCenterG(z);
  float rw = riverHalfW(z);
  float d = abs(x - rc);

  float channel = -3.8 * (1.0 - smoothstep(rw * 0.35, rw + 3.0, d));
  float bankRise = 3.2 * smoothstep(rw - 1.0, rw + 18.0, d);

  float wallT = smoothstep(52.0, 720.0, d);
  float valleyWall = 74.0 * wallT * sqrt(max(wallT, 0.0));

  float hillMask = smoothstep(rw + 8.0, rw + 68.0, d);
  float hills = (
      11.0 * sin(x * 0.0074 + 0.5) * cos(z * 0.0066 - 0.35)
    +  6.0 * sin(x * 0.0148 - z * 0.0124 + 1.75)
    +  2.6 * cos(x * 0.029 + z * 0.025 - 0.85)
  ) * hillMask;

  float baseH = channel + bankRise + valleyWall + hills;
  float terrace = 1.15 * sin(baseH * 0.48) * smoothstep(rw + 28.0, rw + 120.0, d);
  return baseH + terrace;
}

float groveMaskG(vec2 xz) {
  float d = abs(xz.x - riverCenterG(xz.y));
  float rw = riverHalfW(xz.y);
  float prom = smoothstep(rw + 3.5, rw + 11.0, d) * (1.0 - smoothstep(rw + 38.0, rw + 78.0, d)) * 0.92;
  float n1 = sin(xz.x * 0.0068 + xz.y * 0.0042 + 0.8) * cos(xz.y * 0.0079 - xz.x * 0.0036);
  float n2 = sin(xz.x * 0.0155 - xz.y * 0.0138 + 2.2) * 0.45;
  float cl = clamp(0.54 + 0.52 * (n1 + n2), 0.0, 1.0);
  float hs = 0.14 + 0.86 * smoothstep(0.22, 0.78, cl);
  return min(1.0, max(prom, hs));
}
`;

/** Anime multi-hue aerial perspective + warm golden sun scatter + dreamy low valley mist. */
export const FOG_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uFogWarm;
uniform vec3 uFogCool;
uniform vec3 uFogMist;
uniform float uFogNear;
uniform float uFogFar;

vec3 applyAnimeFog(vec3 baseCol, vec3 worldPos, vec3 camPos) {
  vec3 toFrag = worldPos - camPos;
  float dist = length(toFrag);
  vec3 vDir = toFrag / max(dist, 0.001);

  // Warm tangerine-peach glow toward the sun, dreamy orchid-lavender away from it
  float sunScatter = pow(max(dot(vDir, normalize(uSunDir)), 0.0), 2.1);
  vec3 hazeCol = mix(uFogCool, uFogWarm, 0.36 + 0.64 * sunScatter);

  // Smooth aerial perspective with strong distant fade into the horizon
  float df = smoothstep(uFogNear, uFogFar, dist);
  df = pow(df, 1.12);
  vec3 col = mix(baseCol, hazeCol, df * 0.93);

  // Silky low-altitude valley mist pooling along the distant river and mountain bases
  float lowFactor = exp(-max(worldPos.y - 2.0, 0.0) * 0.026);
  float mistDist = smoothstep(260.0, 1180.0, dist);
  vec3 mistCol = mix(uFogMist, uFogWarm, sunScatter * 0.65);
  col = mix(col, mistCol, lowFactor * mistDist * 0.46);

  return col;
}
`;

/* ============================================================================
 * 2. Sky Dome: Orange-to-Purple Anime Twilight + Sun Halo + Cel Clouds + Stars
 * ========================================================================== */

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = pos.xyww;
}
`;

export const SKY_FRAG = /* glsl */ `
uniform float uTime;
uniform float uStorm;
uniform float uProcedural;
uniform vec3 uGlow;
uniform vec3 uPeach;
uniform vec3 uRose;
uniform vec3 uPurple;
uniform vec3 uZenith;
uniform vec3 uSunDir;
uniform vec3 uSunCore;
uniform vec3 uSunHalo;
uniform vec3 uCyberCyan;
varying vec3 vDir;

${HASH_GLSL}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float cloudFbm(vec2 p) {
  float v = 0.0;
  float amp = 0.54;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(p);
    p = rot * p * 2.07 + vec2(13.1, 7.7);
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  vec3 sunD = normalize(uSunDir);
  float h = clamp(d.y, -0.1, 1.0);
  float hh = max(h, 0.0);

  // Vivid saturated anime sky gradient:
  // Warm tangerine-orange horizon → coral-peach → sakura-magenta → electric violet → deep starry indigo
  vec3 warmOrange = vec3(1.0, 0.54, 0.28);
  vec3 col = mix(warmOrange, uGlow, smoothstep(0.0, 0.06, hh));
  col = mix(col, uPeach, smoothstep(0.045, 0.125, hh));
  col = mix(col, uRose, smoothstep(0.10, 0.19, hh));
  col = mix(col, uPurple, smoothstep(0.16, 0.28, hh));
  col = mix(col, uZenith, smoothstep(0.25, 0.46, hh));

  // Luminous orange-amber horizon belt wrapping smoothly across the lower sky
  float sunDot = max(dot(d, sunD), 0.0);
  float horizonGlow = exp(-hh * 8.5) * (0.52 + 0.48 * pow(sunDot, 1.8));
  vec3 sunHorizon = mix(warmOrange, vec3(1.0, 0.72, 0.38), pow(sunDot, 2.2));
  col = mix(col, sunHorizon, clamp(horizonGlow * 0.85, 0.0, 0.88));

  // Soft crepuscular sunbeams fanning gracefully from the mountain pass
  vec3 sunRight = normalize(cross(vec3(0.0, 1.0, 0.0), sunD));
  vec3 sunUp = cross(sunD, sunRight);
  vec2 sunPlane = vec2(dot(d - sunD, sunRight), dot(d - sunD, sunUp));
  float rayAngle = atan(sunPlane.y, sunPlane.x);
  float rays = 0.5 + 0.5 * sin(rayAngle * 8.0 + sin(rayAngle * 3.0 + uTime * 0.08) * 1.3);
  float rayMask = pow(sunDot, 6.0) * smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.22, 0.36, h));
  col += vec3(1.0, 0.68, 0.42) * pow(rays, 2.6) * rayMask * 0.22;

  // Delicate twinkling anime stars across the vivid purple upper sky
  if (h > 0.16) {
    vec2 starUv = d.xz / (d.y + 0.26) * 175.0;
    vec2 cell = floor(starUv);
    vec2 rnd = hash22(cell);
    vec2 local = fract(starUv) - (0.2 + 0.6 * rnd);
    float r = length(local);
    float keep = step(0.952, hash12(cell + 71.3));
    float twinkle = 0.58 + 0.42 * sin(uTime * (1.9 + rnd.x * 3.0) + rnd.y * 6.2831);
    float star = keep * smoothstep(0.13, 0.015, r) * twinkle * smoothstep(0.17, 0.31, h);
    col += mix(vec3(1.0, 0.93, 0.99), uCyberCyan, rnd.x * 0.45) * star * 0.95;
  }

  // Stylized anime cel-shaded twilight clouds: violet undersides + vivid orange-coral sunlit rims
  if (h > 0.02) {
    vec2 cUv = d.xz / (h + 0.16);
    cUv.x *= 0.55;
    cUv += vec2(uTime * 0.011, uTime * 0.003);

    float cBase = cloudFbm(cUv * 1.4);
    vec2 sunStep = sunD.xz * 0.13;
    float cSun = cloudFbm((cUv + sunStep) * 1.4);

    float bandFade = smoothstep(0.03, 0.095, h) * (1.0 - smoothstep(0.20, 0.34, h));
    float density = smoothstep(0.56, 0.70, cBase) * bandFade;
    float core = smoothstep(0.64, 0.77, cBase);
    float rimLit = clamp((cBase - cSun) * 4.6 + 0.3 * pow(sunDot, 2.5), 0.0, 1.0);
    float rimStep = smoothstep(0.24, 0.50, rimLit);

    vec3 cloudShadow = mix(vec3(0.36, 0.22, 0.64), vec3(0.66, 0.34, 0.68), pow(sunDot, 1.8));
    vec3 cloudMid = mix(vec3(0.95, 0.48, 0.68), vec3(1.0, 0.62, 0.38), pow(sunDot, 1.4));
    vec3 cloudRim = mix(vec3(1.0, 0.74, 0.62), vec3(1.0, 0.90, 0.68), pow(sunDot, 2.2));

    vec3 cloudCol = mix(cloudShadow, cloudMid, 1.0 - core * 0.68);
    cloudCol = mix(cloudCol, cloudRim, rimStep * 0.92);
    col = mix(col, cloudCol, density * 0.72);

    // Painterly orange-pink horizontal cirrus streaks
    float wisp = cloudFbm(cUv * vec2(0.8, 3.4) + vec2(4.2, -1.7));
    float wispMask = smoothstep(0.66, 0.78, wisp) * smoothstep(0.08, 0.14, h) * (1.0 - smoothstep(0.22, 0.32, h));
    col = mix(col, mix(vec3(1.0, 0.62, 0.78), vec3(1.0, 0.78, 0.52), sunDot * 0.8), wispMask * 0.42);
  }

  // Tight focused golden-orange solar corona + crisp cel anime sun disc (preserves rich purple above!)
  col = mix(col, vec3(1.0, 0.72, 0.42), pow(sunDot, 16.0) * 0.52);
  col += vec3(1.0, 0.82, 0.55) * pow(sunDot, 64.0) * 0.58;
  float sunDisc = smoothstep(0.9974, 0.9983, sunDot) * smoothstep(-0.01, 0.03, h);
  col = mix(col, uSunCore, sunDisc * 0.98);

  // Subtle cyber-procedural geometric solar halo ring & rotating arc dashes
  if (uProcedural > 0.01) {
    float angDist = length(sunPlane);
    float ring1 = smoothstep(0.0038, 0.0007, abs(angDist - 0.125));
    float dashes = smoothstep(0.30, 0.68, sin(rayAngle * 24.0 - uTime * 0.35));
    float ring2 = smoothstep(0.0028, 0.0005, abs(angDist - 0.168)) * dashes;
    vec3 haloTint = mix(vec3(1.0, 0.84, 0.78), uCyberCyan, 0.42);
    float vis = smoothstep(0.01, 0.08, h) * uProcedural * (0.34 + 0.16 * uStorm);
    col += haloTint * (ring1 * 0.58 + ring2 * 0.42) * vis;
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/* ============================================================================
 * 3. Valley Floor Terrain: Petal Carpets + Cel Shading + Cyber Contours
 * ========================================================================== */

export const TERRAIN_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const TERRAIN_FRAG = /* glsl */ `
uniform float uTime;
uniform float uStorm;
uniform float uProcedural;
uniform vec3 uCelDir;
uniform vec3 uCyberCyan;
uniform vec3 uCyberPink;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;

${VALLEY_GLSL}
${FOG_GLSL}

void main() {
  vec2 xz = vWorldPos.xz;
  float h = vWorldPos.y;
  float dRiver = abs(xz.x - riverCenterG(xz.y));
  float rw = riverHalfW(xz.y);
  float grove = groveMaskG(xz);

  // Base meadow: rich dreamy indigo-lavender rising into periwinkle-violet outer slopes
  vec3 meadowLow = vec3(0.50, 0.39, 0.74);
  vec3 meadowMid = vec3(0.64, 0.46, 0.79);
  vec3 ridgeBlue = vec3(0.32, 0.31, 0.64);
  vec3 petalCarpet = vec3(0.95, 0.63, 0.81);
  vec3 petalBright = vec3(1.0, 0.78, 0.89);
  vec3 shoreBlush = vec3(0.96, 0.69, 0.84);

  vec3 albedo = mix(meadowLow, meadowMid, smoothstep(2.0, 32.0, h));

  // Lush fallen cherry-blossom carpets beneath sakura groves (within the forest basin)
  float inBasin = (1.0 - smoothstep(540.0, 740.0, abs(xz.x)))
                * (1.0 - smoothstep(620.0, 820.0, abs(xz.y)));
  float dapple = 0.5 + 0.5 * sin(xz.x * 0.09 + sin(xz.y * 0.07)) * cos(xz.y * 0.085 - xz.x * 0.05);
  float carpetAmt = smoothstep(0.36, 0.82, grove) * inBasin * smoothstep(0.5, 4.0, h);
  vec3 carpetCol = mix(petalCarpet, petalBright, smoothstep(0.45, 0.85, dapple) * 0.65);
  albedo = mix(albedo, carpetCol, carpetAmt * 0.76);

  // Petal-lined blush riverbanks
  float bankZone = smoothstep(rw - 2.0, rw + 3.0, dRiver) * (1.0 - smoothstep(rw + 8.0, rw + 26.0, dRiver));
  albedo = mix(albedo, shoreBlush, bankZone * inBasin * 0.65);

  // Outer valley rim transitions seamlessly into the blue-purple mountain palette
  float outerRim = smoothstep(42.0, 82.0, h);
  albedo = mix(albedo, ridgeBlue, outerRim * 0.78);

  // Soft-edged 3-band anime cel shading
  vec3 n = normalize(vWorldNormal);
  float ndl = dot(n, normalize(uCelDir)) * 0.5 + 0.5;
  float b1 = smoothstep(0.36, 0.44, ndl);
  float b2 = smoothstep(0.62, 0.71, ndl);
  vec3 shadeTint = vec3(0.58, 0.50, 0.82);
  vec3 midTint = vec3(0.90, 0.82, 0.96);
  vec3 litTint = vec3(1.06, 0.95, 0.94);
  vec3 lightMul = mix(shadeTint, midTint, b1);
  lightMul = mix(lightMul, litTint, b2);
  vec3 col = albedo * lightMul;

  // Delicate dappled grove canopy shadow directly beneath dense trees
  float canopyShade = smoothstep(0.55, 0.92, grove) * inBasin * (0.5 + 0.5 * sin(xz.x * 0.24) * cos(xz.y * 0.24));
  col = mix(col, col * vec3(0.80, 0.72, 0.94), canopyShade * 0.28);

  // Refined cyber-procedural elevation isolines & traveling wind-scan shimmer
  if (uProcedural > 0.01 && h > 1.2) {
    float stepH = h / 9.5;
    float fracH = abs(fract(stepH - 0.5) - 0.5);
    float fw = max(fwidth(stepH), 0.008);
    float iso = 1.0 - smoothstep(fw * 0.6, fw * 1.9, fracH);

    // Subtle procedural coordinate grid on open meadows & outer ridges
    vec2 gCell = abs(fract(xz / 64.0 - 0.5) - 0.5);
    vec2 gFw = max(fwidth(xz / 64.0), vec2(0.006));
    float grid = (1.0 - smoothstep(gFw.x * 0.5, gFw.x * 1.7, gCell.x))
               + (1.0 - smoothstep(gFw.y * 0.5, gFw.y * 1.7, gCell.y));
    grid = clamp(grid, 0.0, 1.0) * (1.0 - carpetAmt * 0.75) * 0.35;

    // Gentle traveling wind-pulse wave illuminates contours romantically
    float pulse = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(xz.x * 0.012 + xz.y * 0.008 - uTime * 0.9), 3.0);
    float distFade = 1.0 - smoothstep(320.0, 1350.0, length(vWorldPos - cameraPosition));
    vec3 lineCol = mix(uCyberPink, uCyberCyan, 0.45 + 0.45 * sin(h * 0.12 + uTime * 0.4));
    col += lineCol * (iso * 0.55 + grid) * pulse * distFade * uProcedural * (0.24 + 0.22 * uStorm);
  }

  col = applyAnimeFog(col, vWorldPos, cameraPosition);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/* ============================================================================
 * 4. Mirror Sunset Anime River: Sky Reflection + Gold Shimmer + Floating Petals
 * ========================================================================== */

export const RIVER_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec2 vRiverUv;

void main() {
  vRiverUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const RIVER_FRAG = /* glsl */ `
uniform float uTime;
uniform float uStorm;
uniform float uProcedural;
uniform vec3 uGlow;
uniform vec3 uRose;
uniform vec3 uPurple;
uniform vec3 uSunCore;
uniform vec3 uCyberCyan;

varying vec3 vWorldPos;
varying vec2 vRiverUv;

${FOG_GLSL}

void main() {
  vec2 xz = vWorldPos.xz;
  // vRiverUv.x = 0 at left shore, 0.5 at centerline, 1 at right shore
  float edgeDist = 1.0 - abs(vRiverUv.x * 2.0 - 1.0);

  // Fine silky anime water ripples gliding down the S-curve channel
  float flow = uTime * (0.8 + 0.6 * uStorm);
  float w1 = sin(xz.y * 0.95 - flow * 2.1 + sin(xz.x * 0.55 + flow) * 0.9);
  float w2 = cos(xz.x * 1.35 + xz.y * 0.72 - flow * 2.7);
  float fineWave = w1 * 0.55 + w2 * 0.45;

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - clamp(viewDir.y, 0.0, 1.0), 2.1);

  // Serene glassy twilight gradient: cool blue-violet mirror deepening near banks,
  // warming into luminous sakura-rose and golden-orange sunset reflection down the middle
  float centerLane = smoothstep(0.12, 0.92, edgeDist);
  vec3 coolMirror = vec3(0.34, 0.34, 0.72);
  vec3 orchidMirror = mix(uPurple, uRose, 0.58);
  vec3 sunsetMirror = mix(uRose, uGlow, smoothstep(0.35, 0.92, fresnel));

  vec3 col = mix(coolMirror, orchidMirror, centerLane * 0.78);
  col = mix(col, sunsetMirror, fresnel * (0.45 + 0.55 * centerLane));
  col += vec3(0.06, 0.04, 0.09) * fineWave * 0.35;

  // Delicate sparkling anime golden sun-glints dancing down the central reflection lane
  vec2 viewXZ = normalize(-viewDir.xz + vec2(0.0001));
  vec2 sunXZ = normalize(uSunDir.xz + vec2(0.0001));
  float sunCorridor = pow(max(dot(viewXZ, sunXZ), 0.0), 4.0) * pow(centerLane, 1.5);
  float sparkle = smoothstep(0.72, 0.92, sin(xz.y * 1.65 - flow * 2.6) * cos(xz.x * 0.85 + xz.y * 0.4));
  col = mix(col, uGlow * 1.08, sunCorridor * 0.42 * fresnel);
  col = mix(col, uSunCore, sparkle * sunCorridor * 0.68);

  // Soft fallen sakura petal drifts along calm bank eddies
  float bankBand = smoothstep(0.03, 0.14, edgeDist) * (1.0 - smoothstep(0.18, 0.40, edgeDist));
  float petalDrift = 0.5 + 0.5 * sin(xz.y * 0.085 - flow * 0.35) * cos(xz.x * 0.12 + 0.8);
  col = mix(col, vec3(1.0, 0.76, 0.89), bankBand * smoothstep(0.45, 0.82, petalDrift) * 0.62);

  // Clean delicate cel shoreline shimmer with a whisper of cyber-aqua light
  float shoreLine = smoothstep(0.11, 0.03, edgeDist) * (0.72 + 0.28 * sin(xz.y * 0.18 - flow * 1.4));
  vec3 foamCol = mix(vec3(1.0, 0.90, 0.96), uCyberCyan, 0.38 * uProcedural);
  col = mix(col, foamCol, shoreLine * 0.62);

  col = applyAnimeFog(col, vWorldPos, cameraPosition);
  float alpha = smoothstep(0.0, 0.07, edgeDist);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), alpha);
}
`;

/* ============================================================================
 * 5. Low-Poly Blue-Purple Anime Mountains: Cel Facets + Sunset Rim + Fog
 * ========================================================================== */

export const MOUNTAIN_VERT = /* glsl */ `
attribute float aPeakRatio;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vColor;
varying float vPeakRatio;

void main() {
  vColor = color;
  vPeakRatio = aPeakRatio;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const MOUNTAIN_FRAG = /* glsl */ `
uniform float uTime;
uniform float uProcedural;
uniform vec3 uCelDir;
uniform vec3 uSunHalo;
uniform vec3 uCyberCyan;
uniform vec3 uCyberPink;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vColor;
varying float vPeakRatio;

${FOG_GLSL}

void main() {
  vec3 n = normalize(vWorldNormal);
  float ndl = dot(n, normalize(uCelDir)) * 0.5 + 0.5;

  // Crisp low-poly blue-purple anime cel facets:
  // Deep cobalt-indigo shadows → royal periwinkle midtones → orchid-lavender lit planes → coral-gold crests
  float b1 = smoothstep(0.34, 0.39, ndl);
  float b2 = smoothstep(0.58, 0.63, ndl);
  float b3 = smoothstep(0.80, 0.85, ndl);

  vec3 shadowCol = vColor * vec3(0.52, 0.56, 0.94);
  vec3 midCol = vColor * vec3(0.86, 0.88, 1.12);
  vec3 litCol = mix(vColor * vec3(1.08, 1.02, 1.24), vec3(0.84, 0.66, 0.96), 0.45);
  vec3 crestCol = mix(vec3(0.98, 0.72, 0.88), uSunHalo, 0.52);

  vec3 col = mix(shadowCol, midCol, b1);
  col = mix(col, litCol, b2);
  col = mix(col, crestCol, b3 * smoothstep(0.45, 0.98, vPeakRatio));

  // Mountain-specific atmospheric fog: keeps peaks unmistakably dreamy blue-purple & violet-lavender
  // while cradling their lower bases in glowing golden-peach & sakura-pink valley mist!
  vec3 toFrag = vWorldPos - cameraPosition;
  float dist = length(toFrag);
  vec3 vDir = toFrag / max(dist, 0.001);
  float sunAlign = pow(max(dot(vDir, normalize(uSunDir)), 0.0), 2.6);

  vec3 coolMtnHaze = vec3(0.46, 0.43, 0.82); // dreamy periwinkle-violet aerial haze
  vec3 sunMtnHaze = vec3(0.76, 0.52, 0.80);  // warm orchid-mauve near sunset pass (still rich purple!)
  vec3 upperHaze = mix(coolMtnHaze, sunMtnHaze, sunAlign * 0.78);

  float df = smoothstep(uFogNear * 1.4, uFogFar * 1.18, dist);
  col = mix(col, upperHaze, df * 0.68);

  // Crisp golden-orange backlit rim kissing upper ridge crests around the setting sun
  float ridgeRim = smoothstep(0.62, 1.0, vPeakRatio) * pow(sunAlign, 1.3);
  col = mix(col, uSunHalo * 1.04, ridgeRim * (0.28 + 0.24 * b2));

  // Delicate cyber-procedural topographic contour shimmer across the low-poly facets
  if (uProcedural > 0.01) {
    float stepY = vWorldPos.y / 34.0;
    float fracY = abs(fract(stepY - 0.5) - 0.5);
    float fw = max(fwidth(stepY), 0.012);
    float iso = (1.0 - smoothstep(fw * 0.5, fw * 1.7, fracY)) * smoothstep(0.18, 0.92, vPeakRatio);
    vec3 rimTone = mix(uCyberCyan, uCyberPink, 0.45 + 0.45 * sin(vWorldPos.x * 0.004 + uTime * 0.35));
    col += rimTone * iso * uProcedural * 0.16 * (1.0 - df * 0.5);
  }

  // Dreamy warm peach-rose mist rising softly around the base of the mountain ranges
  float baseMist = (1.0 - smoothstep(25.0, 175.0, vWorldPos.y)) * smoothstep(420.0, 1150.0, dist);
  vec3 mistCol = mix(uFogMist, uFogWarm, 0.45 + 0.55 * sunAlign);
  col = mix(col, mistCol, baseMist * 0.82);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/* ============================================================================
 * 6. Instanced Sakura Forest (20,480 Trees): Anime Cloud-Cel Shading + Wind Wave
 * ========================================================================== */

const TREE_WIND_GLSL = /* glsl */ `
uniform float uTime;
uniform float uStorm;
uniform float uGustBurst;
uniform float uWindScale;
uniform vec3 uWind;

// Traveling wind-gust wave sweeping across the 20,480-tree forest like ripples on a pink sea
float forestGust(vec2 origin, float t, out vec2 wDir) {
  wDir = normalize(uWind.xz + vec2(0.0001));
  float along = dot(origin, wDir);
  float across = dot(origin, vec2(-wDir.y, wDir.x));
  float wave1 = sin(along * 0.019 - t * 2.1 + sin(across * 0.011 + t * 0.4) * 1.6);
  float wave2 = sin(along * 0.047 - t * 3.4 + origin.x * 0.09 + origin.y * 0.07);
  float effStorm = clamp(uStorm + uGustBurst * 0.85, 0.0, 1.5);
  float gust = (0.45 + 0.38 * wave1 + 0.17 * wave2) * (0.45 + 1.15 * effStorm) * uWindScale;
  return max(gust, 0.0);
}
`;

export const CANOPY_VERT = /* glsl */ `
attribute vec3 aCloudNormal;

varying vec3 vWorldPos;
varying vec3 vCloudNormal;
varying vec3 vTreeColor;
varying float vCrownHeight;
varying float vGustShimmer;
varying float vSeed;

${TREE_WIND_GLSL}

void main() {
  vec3 origin = instanceMatrix[3].xyz;
  vSeed = fract(sin(dot(origin.xz, vec2(12.9898, 78.233))) * 43758.5453);

  vec2 wDir;
  float gust = forestGust(origin.xz, uTime, wDir);

  // Smooth elastic trunk bend + delicate blossom cluster flutter at outer tips
  vec3 local = position;
  float lift = smoothstep(3.2, 13.0, local.y);
  float flutter = sin(uTime * 4.2 + vSeed * 6.2831 + local.x * 0.7 + local.z * 0.7) * 0.22 * (0.3 + uStorm);
  vec4 wp = modelMatrix * instanceMatrix * vec4(local, 1.0);
  wp.xz += wDir * (gust * 2.25 + flutter) * lift;
  wp.y -= gust * 0.28 * lift * lift;

  // Transform the puffy Ghibli-style cloud normal by the instance rotation/scale
  mat3 instMat = mat3(instanceMatrix);
  vCloudNormal = normalize(instMat * aCloudNormal);

  // Support per-instance blossom tint (falls back gracefully if unset)
  #ifdef USE_INSTANCING_COLOR
    vTreeColor = instanceColor;
  #else
    vTreeColor = vec3(1.0, 0.72, 0.85);
  #endif

  vWorldPos = wp.xyz;
  vCrownHeight = clamp((local.y - 4.8) / 8.8, 0.0, 1.0);
  vGustShimmer = clamp(gust * 0.55, 0.0, 1.0);

  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const CANOPY_FRAG = /* glsl */ `
uniform vec3 uCelDir;
uniform vec3 uHighlight;
uniform vec3 uShadow;
uniform vec3 uRimCol;
uniform float uProcedural;

varying vec3 vWorldPos;
varying vec3 vCloudNormal;
varying vec3 vTreeColor;
varying float vCrownHeight;
varying float vGustShimmer;
varying float vSeed;

${FOG_GLSL}

void main() {
  vec3 n = normalize(vCloudNormal);

  // Subtle painterly blossom-cluster dapple perturbance so crowns look fluffy & petal-textured
  vec3 bp = vWorldPos * 0.52 + vec3(vSeed * 17.0);
  float petalDapple = sin(bp.x + sin(bp.z * 1.15)) * cos(bp.z - sin(bp.y * 1.1)) * 0.5 + 0.5;
  float fineCluster = sin(vWorldPos.x * 1.35 + vWorldPos.y * 1.1) * cos(vWorldPos.z * 1.35) * 0.5 + 0.5;

  // Half-Lambert wrap diffuse modulated by vertical crown position and blossom dapple
  float ndl = dot(n, normalize(uCelDir)) * 0.5 + 0.5;
  float shadeVal = ndl * 0.76 + vCrownHeight * 0.24 + (petalDapple - 0.5) * 0.16 + (fineCluster - 0.5) * 0.07;

  // 4 soft-edged vivid anime cel bands (warm cream crest → vivid sakura → rose mid → cool violet shade)
  float b1 = smoothstep(0.28, 0.37, shadeVal);
  float b2 = smoothstep(0.50, 0.59, shadeVal);
  float b3 = smoothstep(0.73, 0.82, shadeVal);

  vec3 deepShade = mix(uShadow, vTreeColor * vec3(0.62, 0.48, 0.86), 0.46);
  vec3 midShade = mix(vTreeColor * vec3(0.88, 0.70, 0.94), uShadow * 1.15, 0.22);
  vec3 vividMain = vTreeColor * 1.03;
  vec3 sunCrest = mix(vTreeColor, uHighlight, 0.68);

  vec3 col = mix(deepShade, midShade, b1);
  col = mix(col, vividMain, b2);
  col = mix(col, sunCrest, b3);

  // Golden-rose subsurface scattering & Fresnel rim when backlit by the setting sun
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float backSun = pow(max(dot(-viewDir, normalize(uSunDir)), 0.0), 2.6);
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.3);
  float sunSide = max(dot(n, normalize(uSunDir)) * 0.5 + 0.5, 0.0);
  col += uRimCol * (rim * 0.24 * (0.4 + 0.6 * sunSide) + backSun * 0.16 * smoothstep(0.35, 1.0, vCrownHeight));

  // Traveling wind-gust blossom sheen ripples visibly across the 20,480 canopies
  col = mix(col, uHighlight, vGustShimmer * b2 * (0.12 + 0.08 * uProcedural));

  col = applyAnimeFog(col, vWorldPos, cameraPosition);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const TRUNK_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

${TREE_WIND_GLSL}

void main() {
  vec3 origin = instanceMatrix[3].xyz;
  vec2 wDir;
  float gust = forestGust(origin.xz, uTime, wDir);

  float lift = smoothstep(2.4, 11.5, position.y);
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  wp.xz += wDir * gust * 1.6 * lift;

  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const TRUNK_FRAG = /* glsl */ `
uniform vec3 uCelDir;
uniform vec3 uTrunkLit;
uniform vec3 uTrunkShade;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;

${FOG_GLSL}

void main() {
  float ndl = dot(normalize(vWorldNormal), normalize(uCelDir)) * 0.5 + 0.5;
  float band = smoothstep(0.45, 0.56, ndl);
  vec3 col = mix(uTrunkShade, uTrunkLit, band);
  col = applyAnimeFog(col, vWorldPos, cameraPosition);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/* ============================================================================
 * 7. GPGPU Sakura Storm (491,520 Petals): Wind Corridors + Cyclones + Curl + Gravity
 * ========================================================================== */

/** Shared wind ribbon & cyclone center math used by velocity & spawn shaders. */
const STORM_FIELD_GLSL = /* glsl */ `
// Centerline of 4 sweeping 3D sakura wind-jet corridors snaking gracefully across the valley
vec3 ribbonPoint(int idx, float s, float t) {
  float fi = float(idx);
  // s in [-1, 1] spans diagonally across the valley so ribbons arc majestically across view
  float x = s * 560.0;
  float baseZ = -260.0 + fi * 165.0;
  float z = baseZ
          + 95.0 * sin(s * 3.1 + fi * 1.55 - t * 0.22)
          + 38.0 * cos(s * 5.4 - fi * 0.9 + t * 0.31);
  float ground = terrainH(vec2(x, z));
  float alt = 15.0 + 11.0 * fi + 14.0 * (0.5 + 0.5 * sin(s * 4.2 - t * 0.45 + fi * 2.1));
  return vec3(x, ground + alt, z);
}

// Center of 5 migrating blossom cyclones that spiral petals skyward from the groves
vec2 vortexCenter(int idx, float t) {
  float fi = float(idx);
  float z = -340.0 + fi * 155.0 + sin(t * 0.075 + fi * 1.9) * 85.0;
  float rc = riverCenterG(z);
  float side = mod(fi, 2.0) < 0.5 ? -1.0 : 1.0;
  float x = rc + side * (75.0 + 95.0 * (0.5 + 0.5 * cos(t * 0.062 + fi * 2.4)));
  return vec2(x, z);
}
`;

export const PETAL_VEL_FRAG = /* glsl */ `
uniform float uTime;
uniform float uDelta;
uniform float uStorm;
uniform float uGustBurst;
uniform float uWindScale;
uniform vec3 uWind;
uniform vec2 uCenter;

${SIMPLEX_GLSL}
${VALLEY_GLSL}
${STORM_FIELD_GLSL}

// Divergence-free-inspired 3D rotational fluid turbulence
vec3 fluidTurbulence(vec3 p, float t) {
  vec3 q = p * 0.0135 + vec3(-t * 0.22, t * 0.11, -t * 0.14);
  float nx = snoise(q);
  float ny = snoise(q + vec3(31.4, -17.8, 9.2));
  float nz = snoise(q + vec3(-19.3, 43.1, -27.6));
  // Fine flutter eddies
  vec3 q2 = p * 0.038 + vec3(t * 0.55, -t * 0.35, t * 0.42);
  vec3 fine = vec3(
    snoise(q2 + vec3(5.1, 0.0, 0.0)),
    snoise(q2 + vec3(0.0, 13.7, 0.0)),
    snoise(q2 + vec3(0.0, 0.0, 23.9))
  ) * 0.45;
  return vec3(ny - nz, nz - nx, nx - ny) * 0.75 + fine;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 pd = texture2D(texturePosition, uv);
  vec4 vd = texture2D(textureVelocity, uv);

  vec3 p = pd.xyz;
  float role = floor(pd.w);
  float seed = fract(pd.w);
  vec3 v = vd.xyz;
  float age = vd.w;

  float effStorm = clamp(uStorm + uGustBurst * 0.9, 0.0, 1.55);
  float wScale = max(uWindScale, 0.15);

  // 1. Large-scale valley wind with rolling gust fronts
  vec2 wDir = normalize(uWind.xz + vec2(0.0001));
  float gustFront = 0.5 + 0.5 * sin(dot(p.xz, wDir) * 0.012 - uTime * 1.35 + seed * 1.4);
  float windMult = (0.75 + 0.95 * effStorm + 0.55 * gustFront * effStorm) * wScale;
  vec3 airVel = vec3(uWind.x * windMult, 0.0, uWind.z * windMult);

  // Gentle down-valley canyon breeze following the S-curve river
  float rcNow = riverCenterG(p.z);
  float rcAhead = riverCenterG(p.z + 25.0);
  float riverProx = exp(-pow((p.x - rcNow) / 160.0, 2.0));
  vec2 canyonTan = normalize(vec2(rcAhead - rcNow, 25.0));
  airVel.xz += canyonTan * riverProx * (2.6 + 5.2 * effStorm) * wScale;

  // 2. Sweeping aerial sakura storm ribbons (strongest for ribbon & canopy petals)
  if (role < 1.5) {
    float sParam = clamp(p.x / 560.0, -0.98, 0.98);
    float sNext = min(sParam + 0.05, 1.0);
    float ribWeight = role > 0.5 ? 1.35 : 0.72;
    for (int i = 0; i < 4; i++) {
      vec3 rp = ribbonPoint(i, sParam, uTime);
      vec3 diff = rp - p;
      float d2 = dot(diff, diff);
      float influence = exp(-d2 / 5400.0) * ribWeight;
      if (influence > 0.01) {
        vec3 rp2 = ribbonPoint(i, sNext, uTime);
        vec3 tang = normalize(rp2 - rp);
        // Fast stream along the ribbon + soft entrainment that gathers petals into silk-like streams
        airVel += tang * (11.0 + 18.0 * effStorm) * wScale * influence;
        airVel += diff * (0.16 + 0.18 * effStorm) * influence;
      }
    }
  }

  // 3. Swirling blossom cyclones (helical vortex + rising thermal updraft)
  for (int i = 0; i < 5; i++) {
    vec2 vc = vortexCenter(i, uTime);
    vec2 d = p.xz - vc;
    float r2 = dot(d, d);
    float falloff = exp(-r2 / 9200.0);
    if (falloff > 0.008) {
      float r = sqrt(r2) + 12.0;
      float spinDir = mod(float(i), 2.0) < 0.5 ? 1.0 : -1.0;
      vec2 tang = vec2(-d.y, d.x) / r * spinDir;
      vec2 inward = -d / r * smoothstep(22.0, 95.0, r);
      float vStrength = (0.45 + 1.35 * effStorm) * wScale;
      airVel.xz += (tang * 22.0 + inward * 5.2) * falloff * vStrength;
      // Rising thermal column lifts petals from the sakura crowns high into the twilight sky
      airVel.y += (5.8 + 10.5 * effStorm) * falloff * (0.65 + 0.35 * sin(uTime * 1.4 + float(i) * 1.7));
    }
  }

  // 4. Rotational 3D fluid turbulence + realistic falling-petal flutter
  vec3 turb = fluidTurbulence(p, uTime) * (2.4 + 7.2 * effStorm) * wScale;
  float flutterFreq = 2.2 + 2.4 * fract(seed * 11.7);
  float ph = seed * 6.2831853;
  vec3 leafFlutter = vec3(
    cos(uTime * flutterFreq + ph) * 2.1,
    sin(uTime * flutterFreq * 1.6 + ph) * 0.85,
    sin(uTime * flutterFreq * 0.9 + ph * 1.7) * 2.1
  );
  airVel += turb + leafFlutter;

  // 5. Aerodynamic drag + gravity (petals have low terminal velocity so they float & soar)
  float drag = 2.6;
  vec3 acc = (airVel - v) * drag;
  float gravity = role > 1.5 ? 2.4 : mix(4.4, 3.1, clamp(effStorm, 0.0, 1.0));
  acc.y -= gravity;

  // Extra upward blossom lift during an active gust burst
  acc.y += uGustBurst * 4.5 * (0.4 + 0.6 * sin(p.x * 0.02 + p.z * 0.02 + uTime * 3.0));

  v += acc * uDelta;

  // Clamp peak speed for silky continuous motion
  float maxSpeed = 42.0;
  float sp = length(v);
  if (sp > maxSpeed) v *= maxSpeed / sp;

  // Reset lifetime cleanly right after a respawn, otherwise advance smoothly (14–24 s trajectory)
  if (age >= 1.0) {
    age = fract(seed * 29.13) * 0.06;
    v = mix(v, airVel * 0.72, 0.65);
  } else {
    float lifeRate = 0.042 + 0.048 * fract(seed * 5.31);
    age += uDelta * lifeRate;
  }

  gl_FragColor = vec4(v, age);
}
`;

export const PETAL_POS_FRAG = /* glsl */ `
uniform float uTime;
uniform float uDelta;
uniform float uDomain;
uniform vec2 uCenter;
uniform vec3 uCamPos;

${HASH_GLSL}
${VALLEY_GLSL}
${STORM_FIELD_GLSL}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 pd = texture2D(texturePosition, uv);
  vec4 vd = texture2D(textureVelocity, uv);

  vec3 np = pd.xyz + vd.xyz * uDelta;
  float role = floor(pd.w);
  float seed = fract(pd.w);
  float age = vd.w;

  if (role > 1.5) {
    // Role 2 (10%): Near-camera & aerial hero petals — toroidal box anchored to camera
    // so delicate close-up notched sakura petals tumble across every view and zoom level.
    float rxz = 210.0;
    vec2 rel = mod(np.xz - uCamPos.xz + rxz, 2.0 * rxz) - rxz;
    np.xz = uCamPos.xz + rel;

    float minY = max(terrainH(np.xz) + 1.5, uCamPos.y - 72.0);
    float maxY = uCamPos.y + 44.0;
    if (np.y < minY) np.y += (maxY - minY);
    if (np.y > maxY) np.y -= (maxY - minY);
  } else {
    // Role 0 & 1 (90%): Valley-scale cherry blossom storm
    float R = uDomain;
    vec2 rel = np.xz - uCenter;
    rel = mod(rel + R, 2.0 * R) - R;
    np.xz = uCenter + rel;

    float ground = terrainH(np.xz);
    bool respawn = (np.y < ground + 0.55) || (np.y > ground + 145.0) || (age >= 1.0);

    if (respawn) {
      vec2 s = gl_FragCoord.xy * 1.37 + vec2(uTime * 41.17, uTime * 23.89);
      float r1 = hash12(s);
      float r2 = hash12(s + vec2(19.31, 7.73));
      float r3 = hash12(s + vec2(5.17, 37.09));
      float r4 = hash12(s + vec2(53.21, 11.41));

      if (role > 0.5) {
        // Role 1: Spawn directly into one of the 4 sweeping wind ribbons or 5 cyclone bases
        if (r4 < 0.68) {
          int rIdx = int(floor(r1 * 4.0));
          float sPos = (r2 * 2.0 - 1.0) * 0.96;
          vec3 rp = ribbonPoint(rIdx, sPos, uTime);
          float spread = 24.0;
          np = rp + vec3(
            (r3 * 2.0 - 1.0) * spread,
            (fract(r1 * 13.7) - 0.45) * 16.0,
            (fract(r2 * 17.3) * 2.0 - 1.0) * spread
          );
        } else {
          int vIdx = int(floor(r1 * 5.0));
          vec2 vc = vortexCenter(vIdx, uTime);
          float ang = r2 * 6.2831853;
          float rad = 10.0 + r3 * 52.0;
          vec2 xz = vc + vec2(cos(ang), sin(ang)) * rad;
          np = vec3(xz.x, terrainH(xz) + 7.0 + fract(r4 * 9.3) * 34.0, xz.y);
        }
      } else {
        // Role 0: Shed directly from the sakura tree canopies across the valley slopes & riverbanks
        float x = uCenter.x + (r1 * 2.0 - 1.0) * R * 0.92;
        float z = uCenter.y + (r2 * 2.0 - 1.0) * R * 0.92;
        // Gently concentrate toward dense blossom groves
        float gm = groveMaskG(vec2(x, z));
        if (gm < 0.35 && r4 < 0.65) {
          float rc = riverCenterG(z);
          float side = r1 < 0.5 ? -1.0 : 1.0;
          x = rc + side * (28.0 + r3 * 240.0);
        }
        float gh = terrainH(vec2(x, z));
        np = vec3(x, max(gh, 1.0) + 7.5 + r3 * 24.0, z);
      }
    }
  }

  gl_FragColor = vec4(np, pd.w);
}
`;

/* ============================================================================
 * 8. Petal Storm Rendering: 491,520 Tumbling Heart-Notched Cel-Shaded Petals
 * ========================================================================== */

export const PETAL_VERT = /* glsl */ `
attribute vec2 aRef;

uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform float uTime;
uniform float uStorm;
uniform float uPointScale;
uniform float uDomain;
uniform vec2 uCenter;
uniform vec3 uCelDir;

varying float vAngle;
varying float vAspect;
varying float vLit;
varying float vSunGlow;
varying float vTone;
varying float vAlpha;
varying float vPointSize;
varying vec3 vFogColor;
varying float vFogAmt;

uniform vec3 uSunDir;
uniform vec3 uFogWarm;
uniform vec3 uFogCool;
uniform float uFogNear;
uniform float uFogFar;

void main() {
  vec4 pd = texture2D(uPosTex, aRef);
  vec4 vd = texture2D(uVelTex, aRef);

  vec3 p = pd.xyz;
  float role = floor(pd.w);
  float seed = fract(pd.w);
  vec3 vel = vd.xyz;

  // Delicate per-petal micro-flutter orbit around the GPGPU trajectory
  float ph = seed * 6.2831853;
  float spinRate = 1.4 + 2.1 * fract(seed * 7.31);
  float t = uTime * spinRate;
  p += vec3(
    sin(t * 0.9 + ph) * 0.32,
    cos(t * 0.7 + ph * 1.4) * 0.24,
    cos(t * 1.1 + ph * 0.6) * 0.32
  );

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = max(-mv.z, 1.0);
  gl_Position = projectionMatrix * mv;

  // 3D tumbling normal gives authentic sun-catch glints and cel shadow transitions
  vec3 petalN = normalize(vec3(
    sin(t * 1.3 + ph),
    cos(t * 0.85 + ph * 1.7),
    cos(t * 1.15 - ph * 0.8)
  ));
  vLit = abs(dot(petalN, normalize(uCelDir)));

  vec3 toFrag = normalize(p - cameraPosition);
  float sunAlign = max(dot(toFrag, normalize(uSunDir)), 0.0);
  float glint = pow(max(abs(dot(petalN, normalize(uSunDir))), 0.0), 6.0);
  vSunGlow = clamp(pow(sunAlign, 2.4) * 0.75 + glint * 0.45, 0.0, 1.0);

  // Align petal rotation partly with screen-space velocity + gentle flutter tumble
  vec4 mvVel = modelViewMatrix * vec4(vel, 0.0);
  float velAng = atan(mvVel.y, mvVel.x) - 1.5707963;
  float tumbleAng = t * 0.85 + ph;
  float speedBlend = smoothstep(3.0, 16.0, length(vel));
  vAngle = mix(tumbleAng, velAng + sin(t + ph) * 0.45, speedBlend * 0.65);

  // 3D foreshortening as the petal spins edge-on (elongates gracefully in fierce storm streams)
  vAspect = 0.36 + 0.64 * abs(sin(t * 1.2 + ph * 2.1));
  vTone = fract(seed * 5.73);

  // Smooth window & lifetime fade so petal birth and recycling are completely invisible
  float fade;
  if (role > 1.5) {
    float dc = length(p.xz - cameraPosition.xz);
    fade = smoothstep(5.0, 18.0, depth) * (1.0 - smoothstep(145.0, 208.0, dc));
  } else {
    float age = vd.w;
    float lifeFade = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.88, 1.0, age));
    float dc = max(abs(p.x - uCenter.x), abs(p.z - uCenter.y));
    fade = lifeFade * (1.0 - smoothstep(uDomain * 0.72, uDomain * 0.98, dc));
  }

  // Size variation: ribbon petals are lush so sweeping aerial storm streams stand out vividly,
  // while foreground hero petals stay graceful and poetic without crowding the horizon
  float roleScale = role > 1.5 ? 0.92 : (role > 0.5 ? 1.32 : 1.02);
  float baseWorld = (0.76 + 0.86 * fract(seed * 13.37)) * roleScale;
  float rawSize = (baseWorld * uPointScale / depth) * fade;
  vPointSize = clamp(rawSize, 0.0, 20.0);
  gl_PointSize = fade < 0.01 ? 0.0 : max(vPointSize, 1.65);

  // Distant sub-pixel petals compensate via soft silk alpha so storm ribbons look dreamy, not grainy
  float subPixelFade = clamp(rawSize / 1.75, 0.0, 1.0);
  float roleAlpha = role > 0.5 && role < 1.5 ? 0.96 : (role > 1.5 ? 0.82 : 0.84);
  vAlpha = fade * mix(0.32, 0.92, smoothstep(0.0, 1.0, subPixelFade)) * roleAlpha;

  // Aerial perspective matching the valley fog
  float dist = length(p - cameraPosition);
  vFogColor = mix(uFogCool, uFogWarm, 0.38 + 0.62 * pow(sunAlign, 2.0));
  vFogAmt = smoothstep(uFogNear * 1.1, uFogFar, dist) * 0.82;
}
`;

export const PETAL_FRAG = /* glsl */ `
uniform vec3 uPetalTip;
uniform vec3 uPetalMid;
uniform vec3 uPetalBase;
uniform vec3 uPetalShadow;
uniform vec3 uSunCore;
uniform vec3 uCyberCyan;
uniform float uProcedural;

varying float vAngle;
varying float vAspect;
varying float vLit;
varying float vSunGlow;
varying float vTone;
varying float vAlpha;
varying float vPointSize;
varying vec3 vFogColor;
varying float vFogAmt;

void main() {
  if (vAlpha < 0.015) discard;

  // Center & rotate point sprite coordinates into local petal space
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;
  float ca = cos(vAngle);
  float sa = sin(vAngle);
  vec2 p = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);

  // Apply 3D tumble foreshortening across petal width
  float widthScale = mix(0.72, 0.56 * vAspect + 0.18, smoothstep(2.2, 7.0, vPointSize));
  float px = p.x / max(widthScale, 0.22);
  float py = p.y;

  // Classic Japanese sakura petal silhouette: tapered base, rounded belly, heart-cleft tip
  float taper = 0.72 + 0.34 * smoothstep(-0.9, 0.45, py);
  vec2 body = vec2(px / taper, (py + 0.08) / 0.92);
  float dBody = length(body);

  // Soft anti-aliased edge (wider feather on small distant storm motes for dreamy glow)
  float feather = mix(0.42, 0.14, smoothstep(2.0, 9.0, vPointSize));
  float shape = 1.0 - smoothstep(1.0 - feather, 1.0, dBody);

  // Carve the iconic sakura V-notch on medium and close petals
  if (vPointSize > 4.2) {
    vec2 notch = vec2(px / 0.26, (py - 0.94) / 0.34);
    float cut = smoothstep(0.72, 1.05, length(notch));
    shape *= mix(1.0, cut, smoothstep(4.2, 8.5, vPointSize));
  }

  float alpha = shape * vAlpha;
  if (alpha < 0.02) discard;

  // Vivid sakura gradient: deep romantic rose at base → soft blush → snow-pink at tip
  vec3 petalCol = mix(uPetalBase, uPetalMid, smoothstep(-0.75, 0.15, py));
  petalCol = mix(petalCol, uPetalTip, smoothstep(0.05, 0.88, py));

  // Per-petal hue variety: snow-sakura, classic pink, warm peach-gold, and rare cyber-iridescent shimmer
  petalCol = mix(petalCol, vec3(1.0, 0.84, 0.78), smoothstep(0.68, 0.95, vTone) * 0.45);
  if (vTone > 0.955 && uProcedural > 0.05) {
    petalCol = mix(petalCol, mix(uPetalTip, uCyberCyan, 0.55), uProcedural * 0.65);
  }

  // Soft-edged 3-band anime cel shading
  float cel1 = smoothstep(0.28, 0.38, vLit);
  float cel2 = smoothstep(0.64, 0.74, vLit);
  vec3 shaded = mix(mix(petalCol * 0.76, uPetalShadow, 0.38), petalCol, cel1);
  vec3 col = mix(shaded, mix(petalCol, uPetalTip, 0.55) * 1.08, cel2);

  // Golden sunset forward-scattering & sunlit glint makes storm ribbons glow dreamily
  col = mix(col, uSunCore, vSunGlow * 0.46);

  col = mix(col, vFogColor, vFogAmt);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), alpha);
}
`;

/* ============================================================================
 * 9. Luminous Procedural Wind Streamlines (Dreamy Anime + Cyber Wind Ribbons)
 * ========================================================================== */

export const RIBBON_VERT = /* glsl */ `
attribute float aRibbonSeed;
varying vec2 vUv;
varying float vSeed;
varying float vFog;

uniform float uTime;
uniform float uStorm;
uniform float uFogNear;
uniform float uFogFar;

void main() {
  vUv = uv;
  vSeed = aRibbonSeed;

  // Gentle organic breathing undulation in the air
  vec3 pos = position;
  float wave = sin(uv.x * 9.4247 - uTime * (1.5 + uStorm * 1.4) + aRibbonSeed * 6.2831);
  pos.y += wave * (2.2 + 2.5 * uStorm);
  pos.z += cos(uv.x * 6.2831 - uTime * 1.1 + aRibbonSeed * 4.1) * 3.0;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vFog = smoothstep(uFogNear, uFogFar, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

export const RIBBON_FRAG = /* glsl */ `
uniform float uTime;
uniform float uStorm;
uniform float uGustBurst;
uniform float uProcedural;
uniform vec3 uSunCore;
uniform vec3 uCyberCyan;
uniform vec3 uCyberPink;

varying vec2 vUv;
varying float vSeed;
varying float vFog;

void main() {
  float effStorm = clamp(uStorm + uGustBurst * 0.9, 0.0, 1.4);
  float speed = 0.24 + 0.32 * effStorm;

  // Two flowing luminous wind-streaks gliding smoothly along each 3D streamline
  float p1 = fract(vUv.x * 1.5 - uTime * speed + vSeed);
  float streak1 = smoothstep(0.0, 0.22, p1) * (1.0 - smoothstep(0.28, 0.62, p1));

  float p2 = fract(vUv.x * 2.5 - uTime * speed * 1.35 + vSeed * 3.7);
  float streak2 = smoothstep(0.0, 0.12, p2) * (1.0 - smoothstep(0.15, 0.38, p2)) * 0.55;

  // Taper smoothly at ribbon ends and across ribbon width (soft edges!)
  float endFade = smoothstep(0.0, 0.14, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));
  float crossFade = 1.0 - smoothstep(0.0, 1.0, abs(vUv.y * 2.0 - 1.0));
  crossFade *= crossFade;

  float vis = (0.16 + 0.42 * effStorm) * (0.35 + 0.65 * uProcedural) * (1.0 - vFog * 0.85);
  float alpha = (streak1 + streak2) * endFade * crossFade * vis;
  if (alpha < 0.004) discard;

  // Romantic sakura-gold wind threads with occasional ethereal cyber-aqua ribbons
  vec3 warmCol = mix(uCyberPink, uSunCore, 0.55 + 0.35 * sin(vUv.x * 6.28 + vSeed * 5.0));
  vec3 col = vSeed > 0.72 ? mix(warmCol, uCyberCyan, 0.65 * uProcedural) : warmCol;

  gl_FragColor = vec4(col, alpha);
}
`;
