/**
 * Photorealistic Chamonix / Mont Blanc GPU Geometry Clipmap Terrain Renderer.
 *
 * - 10 nested power-of-two clipmap levels (N = 64):
 *     Level 0: 0.55 m vertex spacing right under your skis (±17.6 m) for physical 3D track carving!
 *     Levels 1..9: seamless hollow rings scaling 2x each step -> covers full 12.8 km core massif!
 *   Each level snaps to (2 * gridSpacing) so vertices NEVER swim across slopes, and outer-perimeter
 *   odd vertices smoothly geomorph to their coarse neighbor height so ZERO T-junction cracks occur!
 *
 * - Static 48×48 km outer Alps panorama mesh seamlessly wrapping from 5.9 km out to 24 km
 *   so every distant silhouette (Aiguilles Rouges, Courmayeur, Mont Buet, Swiss peaks) is REAL.
 *
 * - Custom photoreal GLSL shader:
 *     * Exact 4-tap manual 16-bit RG bilinear DEM decode (ZERO 19.5 m hardware wrap spikes!)
 *     * Exact shared microRelief() wind pillows & granite ribs matching JS physics 1:1
 *     * Rolling 1024×1024 snow-track depression, raised side berms & finite-difference normals
 *     * Dual-frequency wind-sculpted sastrugi normal mapping
 *     * Triplanar Mont Blanc protogine granite (>42° slopes) with upward ledge snow dusting
 *     * Glacial blue-ice exposure on scoured convex crests & steep icefalls
 *     * Real 13-km mountain-to-mountain horizon cast shadows (4 baked azimuths)
 *     * 16-azimuth analytical DEM Sky-View Factor (AO) -> rich cobalt shadows, never muddy grey
 *     * View-dependent HDR crystal micro-facet snow sparkle glints (rock-solid when still!)
 *     * Blue-cyan subsurface scattering inside carved tracks & thin sunlit ridges
 *     * Drifting cloud shadows, valley sea-of-clouds height mist & Rayleigh/Mie aerial perspective
 */
import * as THREE from 'three';
import { CORE_HALF, OUTER_HALF, MAX_ELEV } from './terrain_data.js';

const SHARED_GLSL_HEIGHT = /* glsl */ `
const float CORE_HALF = ${CORE_HALF.toFixed(1)};
const float OUTER_HALF = ${OUTER_HALF.toFixed(1)};
const float MAX_ELEV = ${MAX_ELEV.toFixed(1)};

float decodeRG(vec4 t) {
  return ((t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0) * MAX_ELEV;
}

// Exact manual 4-tap bilinear decode on NearestFilter 16-bit RG height PNG (GLSL1-safe, ZERO wrap spikes!)
vec3 samplePackedDEM(sampler2D demTex, float texSize, vec2 worldXZ, float halfSpan) {
  vec2 uvf = clamp((worldXZ + halfSpan) / (2.0 * halfSpan), 0.0, 1.0) * (texSize - 1.0);
  vec2 i0 = floor(uvf);
  vec2 iMax = vec2(texSize - 1.0);
  vec2 i1 = min(i0 + vec2(1.0), iMax);
  vec2 f = fract(uvf);
  float invS = 1.0 / texSize;

  vec4 t00 = texture2D(demTex, (i0 + 0.5) * invS);
  vec4 t10 = texture2D(demTex, (vec2(i1.x, i0.y) + 0.5) * invS);
  vec4 t01 = texture2D(demTex, (vec2(i0.x, i1.y) + 0.5) * invS);
  vec4 t11 = texture2D(demTex, (i1 + 0.5) * invS);

  float h00 = decodeRG(t00);
  float h10 = decodeRG(t10);
  float h01 = decodeRG(t01);
  float h11 = decodeRG(t11);
  float h = mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
  float ao = mix(mix(t00.b, t10.b, f.x), mix(t01.b, t11.b, f.x), f.y);
  return vec3(h, ao, 1.0);
}

// Shared deterministic micro-relief matching JS microRelief() 1:1!
float microRelief(vec2 xz, float slopeMag, float powder) {
  float x = xz.x;
  float z = xz.y;
  float w1 = sin(x * 0.047 + z * 0.029) * cos(x * 0.023 - z * 0.051);
  float w2 = sin(x * 0.115 - z * 0.088 + 1.3) * cos(x * 0.072 + z * 0.131 - 0.7);
  float w3 = sin(x * 0.240 + z * 0.195 - 2.1) * sin(x * 0.180 - z * 0.270 + 0.5);
  float roller = sin((x * 0.74 + z * 0.67) * 0.082 + w1 * 1.4) * 0.68;
  float midSlope = clamp((slopeMag - 0.08) / 0.45, 0.0, 1.0);
  float steepRock = clamp((slopeMag - 0.78) / 0.45, 0.0, 1.0);
  float snowAmp = (0.55 + 0.45 * powder) * (0.45 + 0.55 * midSlope) * (1.0 - steepRock * 0.45);
  float rockRib = steepRock * (abs(w2) * 1.65 + w3 * 0.55);
  return (w1 * 1.35 + roller * 0.85 + w2 * 0.42 + w3 * 0.14) * snowAmp + rockRib;
}
`;

function buildClipmapLevelGeometry(gridN, isHollow) {
  const half = gridN / 2;
  // Overlap inner cutout by 2 coarse cells so parent ring ALWAYS bridges any ±1-cell snap shift with zero gaps!
  const innerHalf = gridN / 4 - 2;
  const verts = [];
  const indices = [];
  const gridIndices = new Int32Array((gridN + 1) * (gridN + 1)).fill(-1);

  for (let iz = 0; iz <= gridN; iz++) {
    for (let ix = 0; ix <= gridN; ix++) {
      const lx = ix - half;
      const lz = iz - half;
      const idx = verts.length / 3;
      verts.push(lx, 0, lz);
      gridIndices[iz * (gridN + 1) + ix] = idx;
    }
  }

  for (let iz = 0; iz < gridN; iz++) {
    for (let ix = 0; ix < gridN; ix++) {
      const cx = ix - half + 0.5;
      const cz = iz - half + 0.5;
      // Leave exact inner hollow region (overlap by 0 cells; odd outer ring edge snaps smoothly onto coarse lattice!)
      if (isHollow && Math.abs(cx) < innerHalf && Math.abs(cz) < innerHalf) continue;
      const i00 = gridIndices[iz * (gridN + 1) + ix];
      const i10 = gridIndices[iz * (gridN + 1) + (ix + 1)];
      const i01 = gridIndices[(iz + 1) * (gridN + 1) + ix];
      const i11 = gridIndices[(iz + 1) * (gridN + 1) + (ix + 1)];
      // Front-facing CCW looking from +Y (since +Z is South / down in screen):
      indices.push(i00, i01, i10);
      indices.push(i10, i01, i11);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  return geo;
}

function buildOuterAlpsGeometry(gridN = 176) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const indices = [];
  const step = (2.0 * OUTER_HALF) / gridN;
  const cutout = CORE_HALF - 420.0; // slight overlap inside core edge, gently tucked beneath core height

  for (let iz = 0; iz <= gridN; iz++) {
    for (let ix = 0; ix <= gridN; ix++) {
      const x = -OUTER_HALF + ix * step;
      const z = -OUTER_HALF + iz * step;
      verts.push(x, 0, z);
    }
  }
  for (let iz = 0; iz < gridN; iz++) {
    for (let ix = 0; ix < gridN; ix++) {
      const cx = -OUTER_HALF + (ix + 0.5) * step;
      const cz = -OUTER_HALF + (iz + 0.5) * step;
      if (Math.abs(cx) < cutout - step && Math.abs(cz) < cutout - step) continue;
      const i00 = iz * (gridN + 1) + ix;
      const i10 = i00 + 1;
      const i01 = i00 + (gridN + 1);
      const i11 = i01 + 1;
      indices.push(i00, i01, i10);
      indices.push(i10, i01, i11);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  return geo;
}

export function createTerrainSystem(terrainData, trackBuffer) {
  const GRID_N = 64;
  const BASE_STEP = 0.45; // 0.45m tight vertex spacing directly beneath skis (33% less triangle chord sag!)
  const NUM_LEVELS = 11;  // 0.45 * 32 * 2^10 = ±14,745m (covers full 12.8km core massif from ANY edge/corner!)

  const sharedUniforms = {
    uCoreDem: { value: terrainData.textures.coreDem },
    uCoreAux1: { value: terrainData.textures.coreAux1 },
    uCoreAux2: { value: terrainData.textures.coreAux2 },
    uOuterDem: { value: terrainData.textures.outerDem },
    uOuterAux1: { value: terrainData.textures.outerAux1 },
    uOuterAux2: { value: terrainData.textures.outerAux2 },
    uGraniteAlbedo: { value: terrainData.textures.graniteAlbedo },
    uGraniteNormal: { value: terrainData.textures.graniteNormal },
    uSnowNormal: { value: terrainData.textures.snowNormal },
    uSnowCavity: { value: terrainData.textures.snowCavity },
    uIceNormal: { value: terrainData.textures.iceNormal },
    uTrackTex: { value: trackBuffer.texture },
    uTrackOrigin: { value: new THREE.Vector2(0, 0) },
    uTrackSpan: { value: trackBuffer.worldSpan },
    uTrackRes: { value: trackBuffer.res },
    uMacroTrackTex: { value: trackBuffer.macroTexture },
    uMacroTrackOrigin: { value: new THREE.Vector2(0, 0) },
    uMacroTrackSpan: { value: trackBuffer.macroSpan },
    uMacroTrackRes: { value: trackBuffer.macroRes },
    uAvyActive: { value: 0.0 },
    uAvyOrigin: { value: new THREE.Vector2(0, 0) },
    uAvyDir: { value: new THREE.Vector2(0, 1) },
    uAvyFront: { value: 0.0 },
    uAvyWidth: { value: 26.0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.5) },
    uSunElev: { value: 0.52 },
    uSunColor: { value: new THREE.Color(1.0, 0.94, 0.85) },
    uSunIntensity: { value: 3.55 },
    uShadowSkyColor: { value: new THREE.Color(0.24, 0.43, 0.78) },
    uShadowFillStrength: { value: 0.78 },
    uGroundBounceColor: { value: new THREE.Color(0.54, 0.65, 0.78) },
    uSSSColor: { value: new THREE.Color(0.20, 0.56, 0.94) },
    uFogColor: { value: new THREE.Color(0.62, 0.75, 0.90) },
    uFogDensity: { value: 0.000048 },
    uValleyCloudAlt: { value: 1460.0 },
    uValleyCloudDensity: { value: 0.62 },
    uCloudShadowStrength: { value: 0.34 },
    uSparkleIntensity: { value: 2.1 },
    uHorizonBlend: { value: new THREE.Vector4(0, 0, 1, 0) },
    uTime: { value: 0 },
    uCamPos: { value: new THREE.Vector3() },
    uStorm: { value: 0.0 },
    uTwilight: { value: 0.0 },
    uCoreSize: { value: terrainData.coreSize },
    uOuterSize: { value: terrainData.outerSize },
  };

  const FRAGMENT_SHADER = /* glsl */ `
    precision highp float;

    uniform sampler2D uCoreDem;
    uniform sampler2D uCoreAux1;
    uniform sampler2D uCoreAux2;
    uniform sampler2D uOuterDem;
    uniform sampler2D uOuterAux1;
    uniform sampler2D uOuterAux2;
    uniform sampler2D uGraniteAlbedo;
    uniform sampler2D uGraniteNormal;
    uniform sampler2D uSnowNormal;
    uniform sampler2D uSnowCavity;
    uniform sampler2D uIceNormal;
    uniform sampler2D uTrackTex;
    uniform vec2 uTrackOrigin;
    uniform float uTrackSpan;
    uniform float uTrackRes;
    uniform sampler2D uMacroTrackTex;
    uniform vec2 uMacroTrackOrigin;
    uniform float uMacroTrackSpan;
    uniform float uMacroTrackRes;
    uniform float uAvyActive;
    uniform vec2 uAvyOrigin;
    uniform vec2 uAvyDir;
    uniform float uAvyFront;
    uniform float uAvyWidth;

    uniform vec3 uSunDir;
    uniform float uSunElev;
    uniform vec3 uSunColor;
    uniform float uSunIntensity;
    uniform vec3 uShadowSkyColor;
    uniform float uShadowFillStrength;
    uniform vec3 uGroundBounceColor;
    uniform vec3 uSSSColor;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform float uValleyCloudAlt;
    uniform float uValleyCloudDensity;
    uniform float uCloudShadowStrength;
    uniform float uSparkleIntensity;
    uniform vec4 uHorizonBlend;
    uniform float uTime;
    uniform vec3 uCamPos;
    uniform float uStorm;
    uniform float uTwilight;
    uniform float uCoreSize;
    uniform float uOuterSize;
    uniform vec2 uChildCenter;
    uniform float uChildHalf;
    uniform float uIsOuterMesh;

    varying vec3 vWorldPos;
    varying float vIsOuter;
    varying float vDist;

    ${SHARED_GLSL_HEIGHT}

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    vec3 hash33(vec3 p) {
      p = fract(p * vec3(0.1031, 0.1030, 0.0973));
      p += dot(p, p.yxz + 33.33);
      return fract((p.xxy + p.yxx) * p.zyx);
    }

    float vnoise2(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float cloudShadowAt(vec2 xz, float t) {
      vec2 p = (xz - vec2(t * 22.0, t * 8.5)) * 0.00052;
      float n = vnoise2(p) * 0.62 + vnoise2(p * 2.15 + vec2(7.3, -4.1)) * 0.38;
      return smoothstep(0.50, 0.78, n);
    }

    // Triplanar Mont Blanc Protogine Granite albedo & normal (zero vertical cliff UV stretching!)
    void sampleTriplanarGranite(vec3 wp, vec3 wNorm, out vec3 alb, out vec3 triN) {
      vec3 blend = pow(abs(wNorm), vec3(4.0));
      blend /= max(blend.x + blend.y + blend.z, 1e-4);

      float sA = 0.022;
      float sB = 0.0055; // macro strata variation so huge cliffs never visibly tile!
      // Subtle tectonic stratification angle (authentic Mont Blanc granite bands dip ~22°)
      vec2 uvX = vec2(wp.z * sA + wp.y * 0.009, wp.y * sA);
      vec2 uvY = wp.xz * sA;
      vec2 uvZ = vec2(wp.x * sA - wp.y * 0.009, wp.y * sA);

      vec3 cX = texture2D(uGraniteAlbedo, uvX).rgb;
      vec3 cY = texture2D(uGraniteAlbedo, uvY).rgb;
      vec3 cZ = texture2D(uGraniteAlbedo, uvZ).rgb;
      vec3 cMacro = texture2D(uGraniteAlbedo, wp.xz * sB + wp.y * 0.002).rgb;
      alb = (cX * blend.x + cY * blend.y + cZ * blend.z) * (0.68 + 0.62 * cMacro);

      vec3 nX = texture2D(uGraniteNormal, uvX).xyz * 2.0 - 1.0;
      vec3 nY = texture2D(uGraniteNormal, uvY).xyz * 2.0 - 1.0;
      vec3 nZ = texture2D(uGraniteNormal, uvZ).xyz * 2.0 - 1.0;
      vec3 tX = vec3(0.0, nX.y, nX.x);
      vec3 tY = vec3(nY.x, 0.0, nY.y);
      vec3 tZ = vec3(nZ.x, nZ.y, 0.0);
      triN = normalize(wNorm + (tX * blend.x + tY * blend.y + tZ * blend.z) * 0.62);
    }

    // True 2D slope-tangent HDR diamond-dust snow crystal sparkles with subtle prismatic dispersion!
    // Wraps world coordinates via mod(wp.xz, 32.0) FIRST so IEEE fp32 hash precision NEVER collapses into diagonal stripes
    // at ±6000m across Mont Blanc, and uses two irrational rotated lattices with organic noise warp (ZERO corduroy moire!).
    vec3 snowSparkle(vec3 wp, vec3 wNorm, vec3 viewDir, vec3 sunDir, float dist) {
      if (dist > 78.0) return vec3(0.0);
      float farFade = 1.0 - smoothstep(14.0, 78.0, dist);
      float nearFade = 1.0 - smoothstep(3.5, 24.0, dist);
      vec3 hVec = normalize(sunDir + viewDir);
      // Forward sun cone boost: snow flashes brightest glancing toward the sun!
      float sunAlign = 0.36 + 0.64 * pow(max(0.0, dot(wNorm, hVec)), 2.2);

      // Wrap world XZ into small high-precision [0..32m] tile so fp32 sin/fract hash stays 100% razor-random everywhere!
      vec2 wMod = mod(wp.xz, 32.0);
      vec2 warp = vec2(vnoise2(wMod * 0.65 + vec2(3.1, 7.4)), vnoise2(wMod * 0.65 - vec2(5.2, 2.7))) * 0.22;

      // Irrational rotation matrices break all axis-aligned or slope-aligned diagonals
      mat2 rot1 = mat2(0.848, -0.530, 0.530, 0.848);
      mat2 rot2 = mat2(0.616, -0.788, 0.788, 0.616);

      // Layer 1: Mid-range crisp pinpoint ice facets (~3.8cm spacing, visible out to 78m!)
      vec2 p1 = rot1 * (wMod + warp) * 26.0;
      vec2 c1 = floor(p1);
      vec2 h1 = vec2(hash21(c1 + vec2(1.7, 9.2)), hash21(c1 + vec2(8.3, 2.8)));
      vec2 f1 = fract(p1) - (0.15 + 0.70 * h1);
      float rad1 = mix(0.20, 0.34, smoothstep(6.0, 46.0, dist));
      float dot1 = smoothstep(rad1, 0.02, length(f1));
      vec3 rnd1 = normalize(vec3(hash21(c1 + 3.1) - 0.5, 0.85 + hash21(c1 + 7.7) * 0.4, hash21(c1 + 5.9) - 0.5) * 1.25 + wNorm * 0.85);
      float gate1 = step(0.64, hash21(c1 + vec2(17.1, 13.7)));
      float g1 = pow(max(0.0, dot(rnd1, hVec)), 88.0) * gate1 * dot1;

      // Subtle optical prismatic dispersion per facet (warm-gold / crisp-white / ice-cyan crystal hues!)
      float phase1 = hash21(c1 + vec2(41.2, 19.8));
      vec3 tint1 = mix(
        mix(vec3(1.18, 0.94, 0.72), vec3(1.0, 1.04, 1.12), smoothstep(0.0, 0.55, phase1)),
        vec3(0.76, 0.96, 1.24),
        smoothstep(0.55, 1.0, phase1)
      );

      // Layer 2: Ultra-fine close-range micro-crystal diamond glints (~1.5cm spacing, crisp at 1–24m!)
      vec2 p2 = rot2 * (mod(wp.xz + vec2(11.3, 5.7), 16.0) + warp * 0.6) * 66.0;
      vec2 c2 = floor(p2);
      vec2 h2 = vec2(hash21(c2 + vec2(4.1, 6.7)), hash21(c2 + vec2(2.9, 8.1)));
      vec2 f2 = fract(p2) - (0.14 + 0.72 * h2);
      float dot2 = smoothstep(0.24, 0.02, length(f2));
      vec3 rnd2 = normalize(vec3(hash21(c2 + 11.3) - 0.5, 0.78 + hash21(c2 + 15.1) * 0.5, hash21(c2 + 23.7) - 0.5) * 1.40 + wNorm * 0.72);
      float gate2 = step(0.60, hash21(c2 + vec2(31.7, 7.3)));
      float g2 = pow(max(0.0, dot(rnd2, hVec)), 105.0) * gate2 * dot2 * nearFade;
      float phase2 = hash21(c2 + vec2(12.6, 54.1));
      vec3 tint2 = mix(vec3(1.15, 0.98, 0.78), vec3(0.80, 0.98, 1.22), phase2);

      return (tint1 * g1 * 3.1 + tint2 * g2 * 4.4) * farFade * sunAlign;
    }

    void main() {
      vec2 xz = vWorldPos.xz;
      if (uIsOuterMesh < 0.5 && (abs(xz.x) > CORE_HALF - 38.0 || abs(xz.y) > CORE_HALF - 38.0)) discard;
      if (uChildHalf > 0.0) {
        vec2 dc = abs(xz - uChildCenter);
        if (dc.x < uChildHalf && dc.y < uChildHalf) discard;
      }
      bool inCore = (uIsOuterMesh < 0.5) && (abs(xz.x) < CORE_HALF - 30.0) && (abs(xz.y) < CORE_HALF - 30.0);

      float hCenter, ao, powder, curv, hShadowAng;
      vec3 baseN;

      if (inCore) {
        vec2 uv = clamp((xz + CORE_HALF) / (2.0 * CORE_HALF), 0.0, 1.0);
        vec3 aux1 = texture2D(uCoreAux1, uv).rgb; // R=powder, G=horE, B=horSSE
        vec3 aux2 = texture2D(uCoreAux2, uv).rgb; // R=horSSW, G=horW, B=curv
        powder = aux1.r;
        curv = aux2.b;
        vec4 horAngles = vec4(aux1.g, aux1.b, aux2.r, aux2.g) * (3.14159265 * 0.5);
        hShadowAng = dot(horAngles, uHorizonBlend);

        // High-precision analytical gradient (DEM + microRelief)
        float epsRaw = mix(6.0, 16.0, clamp(vDist / 2500.0, 0.0, 1.0));
        vec3 c0 = samplePackedDEM(uCoreDem, uCoreSize, xz, CORE_HALF);
        float hR = samplePackedDEM(uCoreDem, uCoreSize, xz + vec2(epsRaw, 0.0), CORE_HALF).x;
        float hL = samplePackedDEM(uCoreDem, uCoreSize, xz - vec2(epsRaw, 0.0), CORE_HALF).x;
        float hS = samplePackedDEM(uCoreDem, uCoreSize, xz + vec2(0.0, epsRaw), CORE_HALF).x;
        float hN = samplePackedDEM(uCoreDem, uCoreSize, xz - vec2(0.0, epsRaw), CORE_HALF).x;
        vec2 rawGrad = vec2(hR - hL, hS - hN) / (2.0 * epsRaw);
        float rawSlope = length(rawGrad);

        // Add exact analytical micro-relief gradient near camera (fades gracefully at far massif)
        float microW = 1.0 - smoothstep(260.0, 1800.0, vDist);
        vec2 mGrad = vec2(0.0);
        if (microW > 0.01) {
          float me = 0.75;
          float mR = microRelief(xz + vec2(me, 0.0), rawSlope, powder);
          float mL = microRelief(xz - vec2(me, 0.0), rawSlope, powder);
          float mS = microRelief(xz + vec2(0.0, me), rawSlope, powder);
          float mN = microRelief(xz - vec2(0.0, me), rawSlope, powder);
          mGrad = vec2(mR - mL, mS - mN) / (2.0 * me) * microW;
        }
        vec2 grad = rawGrad + mGrad;
        baseN = normalize(vec3(-grad.x, 1.0, -grad.y));
        hCenter = c0.x;
        ao = c0.y;
      } else {
        vec2 uv = clamp((xz + OUTER_HALF) / (2.0 * OUTER_HALF), 0.0, 1.0);
        vec3 aux1 = texture2D(uOuterAux1, uv).rgb;
        vec3 aux2 = texture2D(uOuterAux2, uv).rgb;
        powder = aux1.r;
        curv = aux2.b;
        vec4 horAngles = vec4(aux1.g, aux1.b, aux2.r, aux2.g) * (3.14159265 * 0.5);
        hShadowAng = dot(horAngles, uHorizonBlend);

        float eps = 72.0;
        vec3 c0 = samplePackedDEM(uOuterDem, uOuterSize, xz, OUTER_HALF);
        float hR = samplePackedDEM(uOuterDem, uOuterSize, xz + vec2(eps, 0.0), OUTER_HALF).x;
        float hL = samplePackedDEM(uOuterDem, uOuterSize, xz - vec2(eps, 0.0), OUTER_HALF).x;
        float hS = samplePackedDEM(uOuterDem, uOuterSize, xz + vec2(0.0, eps), OUTER_HALF).x;
        float hN = samplePackedDEM(uOuterDem, uOuterSize, xz - vec2(0.0, eps), OUTER_HALF).x;
        vec2 grad = vec2(hR - hL, hS - hN) / (2.0 * eps);
        baseN = normalize(vec3(-grad.x, 1.0, -grad.y));
        hCenter = c0.x;
        ao = c0.y;
      }

      vec3 sunDir = normalize(uSunDir);
      vec3 viewDir = normalize(uCamPos - vWorldPos);
      float slopeRad = acos(clamp(baseN.y, 0.0, 1.0));
      float slopeDeg = degrees(slopeRad);

      // Dual-cascade persistent snow tracks:
      //  - Near cascade: 64×64m @ 4.1cm/px (razor-sharp parallel twin ski rails & pole dimples)
      //  - Macro cascade: 360×360m @ 35cm/px (full 180m+ S-turn descent line visible looking back or in Replay!)
      vec2 tUv = (xz - uTrackOrigin) / uTrackSpan + 0.5;
      float trackDepth = 0.0;
      float trackBerm = 0.0;
      float trackIce = 0.0;
      float trackSunOcc = 1.0;
      vec2 trackGrad = vec2(0.0);
      float nearW = 0.0;
      if (inCore && tUv.x > 0.01 && tUv.x < 0.99 && tUv.y > 0.01 && tUv.y < 0.99) {
        nearW = smoothstep(0.01, 0.11, min(min(tUv.x, 1.0 - tUv.x), min(tUv.y, 1.0 - tUv.y)));
        vec4 tr = texture2D(uTrackTex, tUv);
        trackDepth = tr.r * nearW;
        trackBerm = tr.g * nearW;
        trackIce = tr.b * nearW;
        if (tr.a > 0.004) {
          float du = 1.15 / max(512.0, uTrackRes);
          vec4 tx1 = texture2D(uTrackTex, tUv + vec2(du, 0.0));
          vec4 tx0 = texture2D(uTrackTex, tUv - vec2(du, 0.0));
          vec4 tz1 = texture2D(uTrackTex, tUv + vec2(0.0, du));
          vec4 tz0 = texture2D(uTrackTex, tUv - vec2(0.0, du));
          float hX1 = tx1.g * 0.16 - tx1.r * 0.44;
          float hX0 = tx0.g * 0.16 - tx0.r * 0.44;
          float hZ1 = tz1.g * 0.16 - tz1.r * 0.44;
          float hZ0 = tz0.g * 0.16 - tz0.r * 0.44;
          float stepM = 2.0 * du * uTrackSpan;
          trackGrad = vec2(hX1 - hX0, hZ1 - hZ0) / stepM * 2.2 * nearW;

          // Mini directional horizon self-shadow inside carved trench toward sun!
          vec2 sStep = normalize(sunDir.xz + vec2(1e-4)) * (0.28 / uTrackSpan);
          vec4 tSun = texture2D(uTrackTex, clamp(tUv + sStep, 0.005, 0.995));
          float rimH = (tSun.g * 0.22 - tSun.r * 0.28) - (tr.g * 0.22 - tr.r * 0.34);
          trackSunOcc = 1.0 - smoothstep(0.02, 0.24, rimH) * 0.65 * nearW;
        }
      }
      if (inCore && nearW < 0.99) {
        vec2 mUv = (xz - uMacroTrackOrigin) / uMacroTrackSpan + 0.5;
        if (mUv.x > 0.01 && mUv.x < 0.99 && mUv.y > 0.01 && mUv.y < 0.99) {
          float mEdge = smoothstep(0.01, 0.09, min(min(mUv.x, 1.0 - mUv.x), min(mUv.y, 1.0 - mUv.y)));
          float mw = (1.0 - nearW) * mEdge;
          vec4 mr = texture2D(uMacroTrackTex, mUv);
          if (mr.a > 0.004) {
            trackDepth += mr.r * mw * 0.92;
            trackBerm += mr.g * mw * 0.85;
            trackIce += mr.b * mw * 0.78;
            float mdu = 1.15 / max(512.0, uMacroTrackRes);
            vec4 mx1 = texture2D(uMacroTrackTex, mUv + vec2(mdu, 0.0));
            vec4 mx0 = texture2D(uMacroTrackTex, mUv - vec2(mdu, 0.0));
            vec4 mz1 = texture2D(uMacroTrackTex, mUv + vec2(0.0, mdu));
            vec4 mz0 = texture2D(uMacroTrackTex, mUv - vec2(0.0, mdu));
            float stepMM = 2.0 * mdu * uMacroTrackSpan;
            vec2 mGrad = vec2((mx1.g * 0.14 - mx1.r * 0.42) - (mx0.g * 0.14 - mx0.r * 0.42),
                              (mz1.g * 0.14 - mz1.r * 0.42) - (mz0.g * 0.14 - mz0.r * 0.42)) / stepMM * 2.8;
            trackGrad += mGrad * mw;
          }
        }
      }

      // Dynamic Slab Avalanche Crown Fracture Line & Scraped Bed Surface (sharp cobalt overhang + sliding blocks!)
      float avyCrown = 0.0;
      float avyCrownRim = 0.0;
      float avyBed = 0.0;
      float avyDebris = 0.0;
      if (uAvyActive > 0.01 && inCore) {
        vec2 relA = xz - uAvyOrigin;
        float along = dot(relA, uAvyDir);
        vec2 sideVec = vec2(-uAvyDir.y, uAvyDir.x);
        float across = dot(relA, sideVec);
        float zig = (vnoise2(xz * 0.095) - 0.5) * 7.5 + sin(across * 0.24) * 3.4 + (vnoise2(xz * 0.26) - 0.5) * 2.2;
        float wMask = 1.0 - smoothstep(uAvyWidth * 0.62, uAvyWidth * 1.08, abs(across));
        if (wMask > 0.01) {
          float dCrown = along - zig;
          // Deep vertical shadow face right beneath broken slab lip (0..3.6m wide for crisp photographic visibility!)
          avyCrown = smoothstep(-0.3, 0.6, dCrown) * (1.0 - smoothstep(1.2, 4.2, dCrown)) * wMask * uAvyActive;
          // Crisp bright upper fractured snow cornice rim right above the wall
          avyCrownRim = smoothstep(-2.4, -0.3, dCrown) * (1.0 - smoothstep(-0.1, 0.8, dCrown)) * wMask * uAvyActive;
          // Smoothly scraped icy-blue bed surface trailing behind advancing debris wave
          avyBed = smoothstep(0.6, 4.0, dCrown) * (1.0 - smoothstep(uAvyFront - 8.0, uAvyFront + 2.0, along)) * wMask * uAvyActive;
          // Scattered fractured slab chunks sliding down the bed!
          float chunk = smoothstep(0.54, 0.78, vnoise2(vec2(across * 0.42, (along - uAvyFront * 0.4) * 0.35)));
          avyDebris = chunk * avyBed;
        }
      }

      // Dual-frequency wind-sculpted sastrugi snow normals + crisp analytical wind-ripple sculpting!
      float detailFade = 1.0 - smoothstep(140.0, 1800.0, vDist);
      float closeFade = 1.0 - smoothstep(18.0, 220.0, vDist);
      vec2 windUV1 = vec2(xz.x * 0.042 + xz.y * 0.015, -xz.x * 0.015 + xz.y * 0.042); // ~24m macro drifts
      vec2 windUV2 = vec2(xz.x * 0.22 + xz.y * 0.09, -xz.x * 0.09 + xz.y * 0.22);     // ~4.5m wind-carved sastrugi
      vec2 windUV3 = vec2(xz.x * 0.95 - xz.y * 0.32, xz.x * 0.32 + xz.y * 0.95);      // ~1.0m granular wind crust ripples
      vec3 sN1 = texture2D(uSnowNormal, windUV1).xyz * 2.0 - 1.0;
      vec3 sN2 = texture2D(uSnowNormal, windUV2).xyz * 2.0 - 1.0;
      vec3 sN3 = texture2D(uSnowNormal, windUV3).xyz * 2.0 - 1.0;
      vec3 sCav1 = texture2D(uSnowCavity, windUV1).rgb; // R=cavityAO, G=height, B=grain
      vec3 sCav2 = texture2D(uSnowCavity, windUV2).rgb;
      float microCavityAO = mix(1.0, clamp(sCav1.r * 0.58 + sCav2.r * 0.42, 0.36, 1.08), detailFade * 0.85);
      float microGrain = (sCav2.b - 0.5) * 0.065 * closeFade;
      vec3 iN = texture2D(uIceNormal, xz * 0.068).xyz * 2.0 - 1.0;

      // Analytical macro wind-drift cavity shading (breaks up broad white snow slopes into readable alpine relief!)
      float driftMacro = vnoise2(xz * 0.0085 + vec2(1.7, -3.2));
      float driftMid = vnoise2(vec2(xz.x * 0.032 + xz.y * 0.014, -xz.x * 0.014 + xz.y * 0.032));
      float driftCavity = smoothstep(0.22, 0.78, driftMacro * 0.55 + driftMid * 0.45);
      // Directional derivative of drift waves to catch raking sunlight clearly across foreground snow!
      float dR = vnoise2((xz + vec2(1.8, 0.0)) * 0.042);
      float dL = vnoise2((xz - vec2(1.8, 0.0)) * 0.042);
      float dS = vnoise2((xz + vec2(0.0, 1.8)) * 0.042);
      float dN = vnoise2((xz - vec2(0.0, 1.8)) * 0.042);
      vec2 driftGrad = vec2(dR - dL, dS - dN) * 0.92 * detailFade;

      // Combine triplanar Mont Blanc granite strata + procedural far-mountain cliff sharpening!
      vec3 granAlb;
      vec3 granN;
      sampleTriplanarGranite(vWorldPos, baseN, granAlb, granN);

      // Chiseled Protogine granite couloir/arete micro-fissures & diagonal cleavage strata (gives smooth DEM peaks razor-sharp Chamonix needles!)
      vec2 strataCoord = vec2(xz.x * 0.0085 + xz.y * 0.0052 + vWorldPos.y * 0.0065, xz.y * 0.0085 - xz.x * 0.0052 - vWorldPos.y * 0.0042);
      float f1 = 1.0 - abs(vnoise2(xz * 0.0075 + vec2(vWorldPos.y * 0.004, -vWorldPos.y * 0.003)) * 2.0 - 1.0);
      float f2 = 1.0 - abs(vnoise2(xz * 0.022 - vec2(vWorldPos.y * 0.009, vWorldPos.y * 0.006)) * 2.0 - 1.0);
      float f3 = 1.0 - abs(vnoise2(strataCoord * 2.6) * 2.0 - 1.0);
      // Finite-difference crag normal along diagonal granite cleavage planes so distant faces catch sharp sunlit/shaded facets
      float crR = 1.0 - abs(vnoise2((strataCoord + vec2(0.08, 0.0)) * 2.6) * 2.0 - 1.0);
      float crU = 1.0 - abs(vnoise2((strataCoord + vec2(0.0, 0.08)) * 2.6) * 2.0 - 1.0);
      float ridgeCrack = pow(f1, 2.8) * 0.45 + pow(f2, 2.4) * 0.33 + pow(f3, 2.2) * 0.22;
      float farSharpen = mix(0.46, 0.85, smoothstep(220.0, 2600.0, vDist));
      vec3 ridgeFissureN = normalize(
        granN
        + vec3((f1 - 0.5) * 0.52 + (crR - f3) * 0.68 * farSharpen, (crU - f3) * 0.38 * farSharpen, (f2 - 0.5) * 0.52 + (crU - f3) * 0.62 * farSharpen)
      );

      // Physical snow-shedding mask: realistic Chamonix dark-granite spires burst through sharply above ~32–44°!
      float highAlt = smoothstep(2350.0, 3250.0, hCenter);
      float strataJitter = (granAlb.r - 0.46) * 14.0 + (curv - 0.5) * 20.0 + (ridgeCrack - 0.4) * 13.0 + (f3 - 0.5) * 8.0;
      float rockMask = smoothstep(32.0 - highAlt * 4.2, 43.5 - highAlt * 3.5, slopeDeg + strataJitter);
      // Upward-facing micro-ledges & diagonal snow-filled couloir veins slicing down dark granite faces!
      float ledgeDust = smoothstep(0.60, 0.85, ridgeFissureN.y) * smoothstep(1850.0, 2700.0, hCenter);
      float couloirSnow = (1.0 - smoothstep(0.34, 0.62, curv)) * (1.0 - smoothstep(31.0, 46.0, slopeDeg)) * 0.52;
      float couloirVein = pow(f3, 4.2) * smoothstep(2450.0, 3300.0, hCenter) * (1.0 - smoothstep(52.0, 72.0, slopeDeg)) * 0.48;
      rockMask *= (1.0 - clamp(ledgeDust * 0.62 + couloirSnow + couloirVein, 0.0, 0.88));

      // Valley grass/alpine pine-needle ground below snowline (~1150..1580m on gentler sunlit faces)
      float lowValley = (1.0 - smoothstep(1060.0, 1620.0, hCenter)) * (1.0 - rockMask);
      float forestFloor = (1.0 - smoothstep(1450.0, 2060.0, hCenter)) * smoothstep(26.0, 40.0, slopeDeg + (vnoise2(xz * 0.008) - 0.5) * 12.0);

      // Natural intermittent broken glacial crevasse icefalls with 3D parallax chasm depth & overhanging snow-lip rim!
      float iceNoise = vnoise2(xz * 0.0095 + vec2(3.1, -5.7));
      float crevPatch = smoothstep(0.62, 0.80, vnoise2(xz * 0.0038 + vec2(4.2, -7.1)));
      float crevBreak = smoothstep(0.42, 0.72, vnoise2(xz * 0.019 - vec2(1.5, 6.2)));
      float crevPhase = xz.x * 0.022 + xz.y * 0.017 + iceNoise * 5.2;
      float crevSin = sin(crevPhase);
      float crevWave = abs(crevSin);
      float crevGate = crevPatch * crevBreak
                     * smoothstep(16.0, 29.0, slopeDeg) * (1.0 - smoothstep(34.0, 42.0, slopeDeg))
                     * smoothstep(2450.0, 2950.0, hCenter) * (1.0 - smoothstep(3450.0, 3750.0, hCenter))
                     * (1.0 - rockMask);
      float crevasseMask = (1.0 - smoothstep(0.012, 0.095, crevWave)) * crevGate;
      // View-dependent parallax offset looks INSIDE the recessed glacial wall & dark abyssal core!
      vec2 crevPar = -viewDir.xz / max(0.38, viewDir.y) * 1.15;
      float innerNoise = vnoise2((xz + crevPar) * 0.0095 + vec2(3.1, -5.7));
      float innerWave = abs(sin((xz.x + crevPar.x) * 0.022 + (xz.y + crevPar.y) * 0.017 + innerNoise * 5.2));
      float crevAbyss = (1.0 - smoothstep(0.006, 0.044, innerWave)) * crevasseMask;
      // Crisp bright overhanging snow-lip rim right along both edges of the fracture
      float crevLip = smoothstep(0.055, 0.092, crevWave) * (1.0 - smoothstep(0.092, 0.145, crevWave)) * crevGate;
      vec2 crevDir = normalize(vec2(0.022, 0.017));
      vec2 crevGrad = crevDir * sign(crevSin) * (crevLip * 1.45 - crevasseMask * 1.95);

      float iceMask = smoothstep(27.0, 39.0, slopeDeg) * smoothstep(0.51, 0.70, curv + (iceNoise - 0.5) * 0.28)
                    * smoothstep(2150.0, 2650.0, hCenter) * (1.0 - rockMask);
      float snowMask = 1.0 - rockMask;

      // Perturb snow normal strongly with multi-scale sastrugi + drift derivatives + razor-smooth carved tracks + crown cliff wall + crevasse rim!
      vec2 crownGrad = uAvyDir * (-avyCrown * 2.2 + avyDebris * 0.65);
      vec3 snowN = normalize(
        baseN
        + vec3(-driftGrad.x, 0.0, -driftGrad.y) * (0.85 + 0.45 * powder)
        + vec3(sN1.x, 0.0, sN1.y) * (0.42 * detailFade)
        + vec3(sN2.x, 0.0, sN2.y) * (0.38 * closeFade * (1.0 - trackDepth * 0.55))
        + vec3(sN3.x, 0.0, sN3.y) * (0.24 * (1.0 - smoothstep(8.0, 55.0, vDist)) * (1.0 - trackDepth * 0.72))
        + vec3(iN.x, 0.0, iN.y) * (0.42 * (iceMask + crevasseMask * 0.7) * detailFade)
        + vec3(-trackGrad.x, 0.0, -trackGrad.y) * snowMask * 1.42
        + vec3(crownGrad.x + crevGrad.x, 0.0, crownGrad.y + crevGrad.y) * snowMask
      );

      vec3 N = normalize(mix(snowN, ridgeFissureN, rockMask));

      // Surface Albedos (TRUE physical reflectance values + baked cavity micro-relief!)
      vec3 snowAlb = mix(vec3(0.78, 0.83, 0.89), vec3(0.87, 0.90, 0.94), powder);
      // Subtle tonal variation from wind-drift cavities + baked sastrugi cavity AO (keeps shadowed & storm faces sculpted!)
      snowAlb *= mix(vec3(0.76, 0.84, 0.94), vec3(1.02, 1.02, 1.02), driftCavity * 0.55 + microCavityAO * 0.45);
      snowAlb += vec3(microGrain);
      // Glacial blue-ice exposure
      vec3 iceAlb = vec3(0.28, 0.58, 0.82);
      snowAlb = mix(snowAlb, iceAlb, iceMask * 0.78);
      // 3D parallax glacier crevasse: bright sunlit snow overhang rim -> cyan-teal ice wall -> deep indigo-navy chasm!
      snowAlb = mix(snowAlb, vec3(0.95, 0.97, 1.00), crevLip * 0.55);
      vec3 crevWallCol = mix(vec3(0.06, 0.32, 0.54), vec3(0.015, 0.055, 0.16), crevAbyss * 0.92);
      snowAlb = mix(snowAlb, crevWallCol, crevasseMask * 0.94);
      // Avalanche slab crown fracture wall (crisp shadowed cobalt cliff + sunlit overhang rim + scraped sliding bed & chunks!)
      snowAlb = mix(snowAlb, vec3(0.46, 0.63, 0.82), avyBed * 0.56);
      snowAlb = mix(snowAlb, vec3(0.92, 0.95, 0.99), avyDebris * 0.62 + avyCrownRim * 0.45);
      snowAlb = mix(snowAlb, vec3(0.07, 0.20, 0.44), avyCrown * 0.94);
      // Natural compacted cobalt-white twin-ski trench + crisp sunlit snow berm rib between & flanking skis!
      snowAlb = mix(snowAlb, vec3(0.64, 0.76, 0.90), trackDepth * 0.34);
      snowAlb = mix(snowAlb, vec3(0.96, 0.98, 1.00), trackBerm * 0.44);

      // Sub-alpine scree / dark pine floor patches deep in Chamonix valley
      vec3 valleyAlb = mix(vec3(0.14, 0.19, 0.14), vec3(0.62, 0.68, 0.74), smoothstep(0.35, 0.72, vnoise2(xz * 0.0045)));
      float townSpot = smoothstep(1120.0, 1020.0, hCenter) * smoothstep(14.0, 3.0, slopeDeg);
      float roofs = step(0.62, vnoise2(xz * 0.032)) * townSpot;
      valleyAlb = mix(valleyAlb, vec3(0.22, 0.20, 0.19), roofs * 0.72);
      snowAlb = mix(snowAlb, valleyAlb, clamp(lowValley * 0.58 + forestFloor * 0.36, 0.0, 0.82));

      // Authentic dark-contrast Chamonix Protogine Granite (chiseled dihedral crevices + crisp ochre-slate sunlit facets!)
      float farRockCrisp = vnoise2(xz * 0.048 + vec2(vWorldPos.y * 0.025, -vWorldPos.y * 0.018));
      float creviceAO = smoothstep(0.10, 0.52, ridgeCrack) * (0.72 + 0.45 * farRockCrisp);
      vec3 rockCol = granAlb * vec3(0.42, 0.42, 0.46) * mix(vec3(0.36, 0.40, 0.48), vec3(1.26, 1.14, 1.02), clamp(creviceAO, 0.0, 1.15));
      // Frosty snow rim dusting caught along sharp upward granite fractures
      float frostRim = smoothstep(0.56, 0.84, ridgeFissureN.y) * smoothstep(0.45, 0.82, farRockCrisp) * rockMask * 0.34;
      rockCol = mix(rockCol, vec3(0.86, 0.90, 0.96), frostRim);
      vec3 albedo = mix(snowAlb, rockCol, rockMask);

      // --- LIGHTING HIERARCHY (Real Mountain Horizon Shadows + Cloud Shadows + Cobalt Sky Fill) ---
      float horDiff = uSunElev - hShadowAng;
      float mtnShadow = smoothstep(-0.020, 0.044, horDiff);
      mtnShadow = mix(mtnShadow, 0.32, uStorm * 0.85);

      // Drifting high-altitude cloud shadow bands sweeping dynamically across massif
      float csh = cloudShadowAt(xz, uTime) * uCloudShadowStrength * (1.0 - uStorm * 0.8);
      float directVis = mtnShadow * (1.0 - csh);

      // Self-occlusion inside carved ski trench, directional trench rim shadow & glacier crevasses
      float trackAO = (1.0 - trackDepth * 0.26) * (1.0 - crevasseMask * 0.78) * (1.0 - avyCrown * 0.65);

      float NdotL = max(0.0, dot(N, sunDir));
      // Keep wrap lighting tight so raking sunlight reveals crisp shadow relief across every wind pillow & ripple!
      float wrapNdotL = max(0.0, (dot(N, sunDir) + 0.06) / 1.06);
      float diffFactor = mix(wrapNdotL * 0.14 + NdotL * 0.86, NdotL, rockMask);
      vec3 directLight = uSunColor * uSunIntensity * diffFactor * directVis * trackAO * trackSunOcc;

      // Luminous Cobalt-Cerulean Sky Hemisphere + Indirect Snow Bounce + Baked Multi-Scale Sastrugi Cavity AO!
      float skyFactor = clamp(0.42 + 0.58 * N.y, 0.16, 1.0);
      float shadowMicro = clamp(0.74 + 0.34 * dot(N, normalize(vec3(-sunDir.x, 0.72, -sunDir.z))), 0.52, 1.24);
      float cavityAO = mix(0.42, 1.0, pow(ao, 1.05)) * trackAO * mix(0.76, 1.08, driftCavity * 0.45 + microCavityAO * 0.55);
      vec3 skyFill = mix(uGroundBounceColor * 0.64, uShadowSkyColor, skyFactor) * uShadowFillStrength * cavityAO * shadowMicro;

      // Blue-Cyan Subsurface Scattering (SSS) in backlit ridges, powder crests, crevasses & carved ski track walls!
      float backLight = pow(clamp(dot(viewDir, -sunDir + N * 0.42), 0.0, 1.0), 3.0);
      float rimFres = pow(1.0 - max(0.0, dot(N, viewDir)), 3.2);
      float sssMask = snowMask * (0.28 + 0.72 * powder) * (0.35 + 0.65 * curv + trackDepth * 1.45 + crevasseMask * 1.8);
      vec3 sss = uSSSColor * (backLight * 0.42 + rimFres * 0.16 + trackDepth * 0.36 + crevasseMask * 0.45) * sssMask * (0.22 + 0.78 * directVis) * (1.0 - uStorm * 0.7);

      // --- DUAL-LOBE PHOTOREAL SNOW GLEAM (Grazing Solar Glaze Ribbon + Wind-Slab Sheen + Glassy Track Walls!) ---
      vec3 H = normalize(sunDir + viewDir);
      float NdotH = max(0.0, dot(N, H));
      float NdotV = max(0.0, dot(N, viewDir));
      float fresnel = pow(1.0 - NdotV, 3.6);
      // Natural alternating patchwork of matte cold velvet powder vs. sun-baked glossy wind-slab crust!
      float crustNoise = vnoise2(xz * 0.013 + vec2(2.4, -6.1)) * 0.62 + vnoise2(xz * 0.048 - vec2(5.1, 3.7)) * 0.38;
      float crustPatch = smoothstep(0.34, 0.78, crustNoise + (curv - 0.5) * 0.45) * (1.0 - powder * 0.42);
      float glazeWeight = clamp(0.24 + crustPatch * 0.58 + iceMask * 0.85 + trackIce * 0.72 + trackDepth * 0.45, 0.0, 1.5);
      // Broad silky grazing sun-glaze sheet directly beneath the sun azimuth (forward-scatter micro-roughness!)
      float fwdCone = pow(max(0.0, dot(-viewDir, normalize(vec3(sunDir.x, -sunDir.y * 0.25, sunDir.z)))), 3.0);
      float broadGlaze = pow(NdotH, mix(18.0, 10.0, crustPatch * 0.5)) * (0.26 + 0.56 * crustPatch + 0.35 * fwdCone) * (0.35 + 0.65 * fresnel);
      // Tight crisp specular lobe on wind-scoured crust, convex sastrugi lips, blue-ice exposures & ironed ski-track edges!
      float tightPow = mix(46.0, 132.0, clamp(iceMask + trackIce * 0.75 + trackDepth * 0.35, 0.0, 1.0));
      float tightGleam = pow(NdotH, tightPow) * (0.28 + 0.72 * crustPatch + 1.15 * iceMask + 1.05 * trackIce + 0.65 * trackBerm);
      // Grazing velvety horizon sheen along backlit sastrugi crests
      float sheenSpec = fresnel * (0.16 + 0.36 * fwdCone) * (0.28 + 0.72 * NdotL);
      // Subtle mica specular sparkle on sharp granite cliffs
      float rockSpec = pow(NdotH, 32.0) * (0.16 + 0.18 * ridgeCrack) * rockMask;
      vec3 specTint = mix(uSunColor, vec3(0.96, 0.98, 1.04), 0.32);
      vec3 specular = specTint * ((broadGlaze * 0.72 + tightGleam * 0.85 + sheenSpec) * snowMask * (0.65 + 0.35 * glazeWeight) + rockSpec)
                    * directVis * uSunIntensity * 0.52 * (1.0 - uStorm * 0.82);

      // View-dependent Prismatic HDR Diamond-Dust Snow Crystal Sparkle Glints!
      vec3 spk = snowSparkle(vWorldPos, N, viewDir, sunDir, vDist) * snowMask * (1.0 - lowValley * 0.8);
      vec3 sparkleCol = spk * (uSunColor * 0.85 + vec3(0.28, 0.34, 0.44)) * uSparkleIntensity * directVis * (0.32 + 0.68 * NdotL) * (0.78 + 0.45 * crustPatch) * (1.0 - uStorm * 0.90);

      vec3 col = albedo * (directLight + skyFill) + sss + specular + sparkleCol;

      // --- AERIAL PERSPECTIVE (Rayleigh/Mie Alpine Haze + Valley Sea-of-Clouds Mist) ---
      float distFog = 1.0 - exp(-vDist * uFogDensity * (1.0 + 0.25 * max(0.0, (2500.0 - hCenter) / 1500.0)));
      distFog = clamp(distFog, 0.0, 0.94);

      // Sun forward scatter tint in aerial perspective (warm alpine glow looking toward sun, crisp blue looking away)
      float sunScatter = pow(max(0.0, dot(-viewDir, sunDir)), 4.0) * (1.0 - uStorm * 0.9);
      vec3 aerialCol = mix(uFogColor, mix(uFogColor, uSunColor * 1.08, 0.52), sunScatter);
      col = mix(col, aerialCol, distFog);

      // Soft low-valley sea-of-clouds height mist blanketing Chamonix valley bottom (< uValleyCloudAlt)
      float valleyFogAmt = 0.0;
      if (hCenter < uValleyCloudAlt + 260.0) {
        float hBand = smoothstep(uValleyCloudAlt + 260.0, uValleyCloudAlt - 180.0, hCenter);
        float mistNoise = 0.65 + 0.35 * vnoise2(xz * 0.0008 + vec2(uTime * 0.006, 0.0));
        float mistScale = mix(1.0, 0.56, uTwilight);
        valleyFogAmt = clamp(hBand * uValleyCloudDensity * mistNoise * mistScale * smoothstep(140.0, 900.0, vDist), 0.0, 0.90);
        vec3 cloudMistCol = mix(uShadowSkyColor * 1.15, vec3(0.94, 0.96, 0.99) * (0.55 + 0.45 * uSunColor), 0.62);
        col = mix(col, cloudMistCol, valleyFogAmt);
      }

      // --- GLOWING CHAMONIX VALLEY TOWN LIGHTS IN ALPENGLOW / TWILIGHT (fp32-safe modular cells!) ---
      // Warm tungsten-amber alpine chalet clusters, downtown Chamonix village glow & Arve valley streetlamp ribbons
      // twinkling softly beneath the purple-indigo mer de nuages mist!
      if (uTwilight > 0.02 && hCenter < 1340.0 && slopeDeg < 21.0) {
        float elevMask = smoothstep(1340.0, 1110.0, hCenter);
        float flatMask = smoothstep(20.5, 4.5, slopeDeg);
        // Village population weights across real Chamonix–Arve valley towns (densest in downtown Chamonix!)
        float wCham = exp(-dot(xz - vec2(-2759.0, -5001.0), xz - vec2(-2759.0, -5001.0)) / 9.0e5);
        float wPraz = exp(-dot(xz - vec2(-1800.0, -5850.0), xz - vec2(-1800.0, -5850.0)) / 6.5e5) * 0.78;
        float wBoss = exp(-dot(xz - vec2(-3880.0, -3650.0), xz - vec2(-3880.0, -3650.0)) / 7.5e5) * 0.85;
        float wHouch = exp(-dot(xz - vec2(-5180.0, -2520.0), xz - vec2(-5180.0, -2520.0)) / 9.5e5) * 0.82;
        // Continuous Arve valley road ribbon connecting Les Houches -> Les Bossons -> Chamonix -> Les Praz
        float valleySpine = exp(-pow(abs((xz.x + 2759.0) * 0.70 + (xz.y + 5001.0) * 0.71) / 340.0, 2.0));
        // Organic village parcel clustering so dark indigo snowy meadows separate warm golden neighborhoods!
        float parcelMask = smoothstep(0.26, 0.74, vnoise2(xz * 0.0028 + vec2(4.1, -2.7)) * 0.65 + vnoise2(xz * 0.0072) * 0.35);
        float coreBoost = clamp(wCham * 1.35 + wPraz * 0.92 + wBoss * 0.95 + wHouch * 0.92, 0.0, 1.5);
        float popDensity = clamp((0.08 + coreBoost) * (0.35 + 0.85 * parcelMask) + valleySpine * 0.28, 0.0, 1.45);
        float townBase = elevMask * flatMask * smoothstep(240.0, 820.0, vDist) * (1.0 - uStorm * 0.82);

        if (townBase > 0.005) {
          // Slightly tighter spots preserve starry village definition without merging into a flat white sheet
          float distExpand = clamp(1.0 + vDist * 0.00011, 1.0, 1.75);

          // Layer 1: Dense village streetlamp & chalet window grid (44m cell, fp32-safe modular hash!)
          vec2 c1 = xz / 44.0;
          vec2 id1 = floor(c1);
          vec2 gv1 = fract(c1) - 0.5;
          vec2 mid1 = mod(id1, 512.0);
          float r1 = hash21(mid1 * vec2(1.13, 1.79) + vec2(3.1, 7.4));
          vec2 jit1 = (vec2(hash21(mid1 + 11.7), hash21(mid1 + 29.3)) - 0.5) * 0.68;
          float d1 = length(gv1 - jit1);
          float on1 = step(clamp(0.86 - popDensity * 0.40, 0.38, 0.92), r1);
          float rad1 = 0.088 * distExpand;
          float twk1 = 0.80 + 0.20 * sin(uTime * 2.1 + r1 * 62.8);
          float dot1 = exp(-(d1 * d1) / max(0.001, rad1 * rad1)) * on1 * twk1;
          // ACES-calibrated ultra-saturated sodium-orange & golden tungsten (low blue prevents ACES white desaturation!)
          vec3 col1 = (r1 > 0.965) ? vec3(1.00, 0.82, 0.42)
                    : ((r1 > 0.80) ? vec3(1.00, 0.46, 0.045) : vec3(1.00, 0.28, 0.018));

          // Layer 2: Coarser glowing plazas, hotel facades & arterial roundabouts (92m cell)
          vec2 c2 = xz / 92.0;
          vec2 id2 = floor(c2);
          vec2 gv2 = fract(c2) - 0.5;
          vec2 mid2 = mod(id2, 512.0);
          float r2 = hash21(mid2 * vec2(2.31, 0.91) + vec2(19.2, 5.8));
          vec2 jit2 = (vec2(hash21(mid2 + 41.2), hash21(mid2 + 73.9)) - 0.5) * 0.54;
          float d2 = length(gv2 - jit2);
          float on2 = step(clamp(0.84 - popDensity * 0.38, 0.42, 0.90), r2);
          float rad2 = 0.112 * distExpand;
          float twk2 = 0.88 + 0.12 * sin(uTime * 1.45 + r2 * 41.0);
          float dot2 = exp(-(d2 * d2) / max(0.001, rad2 * rad2)) * on2 * twk2;
          vec3 col2 = mix(vec3(1.00, 0.30, 0.02), vec3(1.00, 0.54, 0.06), fract(r2 * 13.7));

          // Layer 3: Winding glowing highway / streetlamp ribbon along Arve valley (RN205 / Rue du Dr Paccard!)
          float roadWave = sin(xz.x * 0.0018 + xz.y * 0.0015 + vnoise2(xz * 0.0016) * 2.4);
          float roadLine = smoothstep(0.095, 0.01, abs(roadWave)) * smoothstep(0.32, 0.78, valleySpine);
          float lampPulse = 0.35 + 0.65 * pow(max(0.0, sin((xz.x - xz.y) * 0.065)), 6.0);

          // Rich deep amber light-pollution glow resting softly on snowy ground around Chamonix town & villages
          float clusterGlow = smoothstep(0.24, 0.90, vnoise2(xz * 0.0042)) * coreBoost;
          vec3 ambientPoll = vec3(1.00, 0.34, 0.03) * (clusterGlow * 0.30 + roadLine * 0.24) * (0.48 + 0.52 * wCham);

          // Moderated HDR amber intensity keeps rich golden-orange hues vivid through ACES filmic curve!
          vec3 lights = col1 * dot1 * 2.15
                      + col2 * dot2 * 2.65
                      + vec3(1.00, 0.36, 0.025) * roadLine * lampPulse * 1.15
                      + ambientPoll;
          // Darken base valley floor subtly under twilight shadow before adding warm city lights so amber pops!
          float duskDeep = clamp(townBase * uTwilight * 0.46, 0.0, 0.50);
          col = mix(col, col * vec3(0.50, 0.55, 0.72), duskDeep);
          float airTrans = exp(-vDist * uFogDensity * 0.32);
          float mistTrans = mix(1.0, 0.48, valleyFogAmt);
          col += lights * townBase * uTwilight * airTrans * mistTrans;
        }
      }

      // Alpha = 0.55 marks solid world terrain for BOTH sharp motion blur (worldMask=1.0) AND exact god-ray ridge occlusion!
      gl_FragColor = vec4(col, 0.55);
    }
  `;

  // Create clipmap levels 0..NUM_LEVELS-1
  const group = new THREE.Group();
  const levels = [];

  for (let lv = 0; lv < NUM_LEVELS; lv++) {
    const step = BASE_STEP * Math.pow(2, lv);
    const geo = buildClipmapLevelGeometry(GRID_N, lv > 0);
    const uniforms = {
      ...sharedUniforms,
      uSnapCenter: { value: new THREE.Vector2(0, 0) },
      uGridStep: { value: step },
      uGridHalf: { value: GRID_N * 0.5 },
      uLevel: { value: lv },
      uChildCenter: { value: new THREE.Vector2(0, 0) },
      uChildHalf: { value: -1.0 },
      uIsOuterMesh: { value: 0.0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uCoreDem;
        uniform sampler2D uCoreAux1;
        uniform sampler2D uOuterDem;
        uniform sampler2D uTrackTex;
        uniform vec2 uTrackOrigin;
        uniform float uTrackSpan;
        uniform vec2 uSnapCenter;
        uniform float uGridStep;
        uniform float uGridHalf;
        uniform float uLevel;
        uniform float uCoreSize;
        uniform float uOuterSize;
        uniform vec3 uCamPos;

        varying vec3 vWorldPos;
        varying float vIsOuter;
        varying float vDist;

        ${SHARED_GLSL_HEIGHT}

        float evalCoreHeight(vec2 wxz) {
          vec3 s = samplePackedDEM(uCoreDem, uCoreSize, wxz, CORE_HALF);
          vec2 uv = clamp((wxz + CORE_HALF) / (2.0 * CORE_HALF), 0.0, 1.0);
          float powder = texture2D(uCoreAux1, uv).r;
          float e = 8.0;
          float hR = samplePackedDEM(uCoreDem, uCoreSize, wxz + vec2(e, 0.0), CORE_HALF).x;
          float hL = samplePackedDEM(uCoreDem, uCoreSize, wxz - vec2(e, 0.0), CORE_HALF).x;
          float hS = samplePackedDEM(uCoreDem, uCoreSize, wxz + vec2(0.0, e), CORE_HALF).x;
          float hN = samplePackedDEM(uCoreDem, uCoreSize, wxz - vec2(0.0, e), CORE_HALF).x;
          float slopeMag = length(vec2(hR - hL, hS - hN) / (2.0 * e));
          float h = s.x + microRelief(wxz, slopeMag, powder);

          // Blend smoothly into outer DEM right at the core margin (±5950m..±6400m)
          float edgeD = max(abs(wxz.x), abs(wxz.y));
          if (edgeD > CORE_HALF - 450.0) {
            float blendOut = smoothstep(CORE_HALF - 450.0, CORE_HALF - 20.0, edgeD);
            float hOut = samplePackedDEM(uOuterDem, uOuterSize, wxz, OUTER_HALF).x;
            h = mix(h, hOut, blendOut);
          }

          // Ultra-gentle blurred physical sag (avoids 0.55m diagonal grid triangle scalloping!)
          // Sharp twin-ski edge walls & sun horizon self-shadow are rendered at 4.1cm/px in fragment shader!
          if (uLevel < 2.5) {
            vec2 tUv = (wxz - uTrackOrigin) / uTrackSpan + 0.5;
            if (tUv.x > 0.01 && tUv.x < 0.99 && tUv.y > 0.01 && tUv.y < 0.99) {
              float o = 0.35 / uTrackSpan;
              float trR = (texture2D(uTrackTex, tUv).r
                        + texture2D(uTrackTex, tUv + vec2(o, 0.0)).r
                        + texture2D(uTrackTex, tUv - vec2(o, 0.0)).r
                        + texture2D(uTrackTex, tUv + vec2(0.0, o)).r
                        + texture2D(uTrackTex, tUv - vec2(0.0, o)).r) * 0.2;
              float edgeFade = smoothstep(0.01, 0.08, min(min(tUv.x, 1.0 - tUv.x), min(tUv.y, 1.0 - tUv.y)));
              float rockSuppress = 1.0 - smoothstep(0.82, 1.15, slopeMag);
              h -= trR * 0.018 * edgeFade * rockSuppress;
            }
          }
          // Subtle analytical ridged granite sharpening on steep far spires (>36°)
          if (slopeMag > 0.72) {
            float sharpM = clamp((slopeMag - 0.72) / 0.55, 0.0, 1.0);
            float ridgeS = 1.0 - abs(sin(wxz.x * 0.019 + wxz.y * 0.014) * cos(wxz.x * 0.012 - wxz.y * 0.023));
            h += (ridgeS - 0.5) * 4.5 * sharpM;
          }
          return h;
        }

        void main() {
          vec2 local = position.xz; // integers in [-uGridHalf .. +uGridHalf]
          vec2 wxz = uSnapCenter + local * uGridStep;

          // Exact power-of-two geomorphing across outer perimeter so odd vertices snap onto parent level (ZERO T-junction cracks!)
          float maxAbs = max(abs(local.x), abs(local.y));
          float morph = smoothstep(uGridHalf * 0.72, uGridHalf * 0.999, maxAbs);
          vec2 fracOdd = mod(abs(local), 2.0); // 1 on odd coordinate, 0 on even
          // Snap direction toward the two flanking even parent vertices
          vec2 offsetStep = fracOdd * uGridStep;

          float h = evalCoreHeight(wxz);
          if (morph > 0.001 && (fracOdd.x > 0.5 || fracOdd.y > 0.5)) {
            float hCoarse;
            if (fracOdd.x > 0.5 && fracOdd.y > 0.5) {
              // Diagonal interior odd vertex -> average 4 corners or diagonal edge
              hCoarse = 0.5 * (evalCoreHeight(wxz - offsetStep) + evalCoreHeight(wxz + offsetStep));
            } else {
              hCoarse = 0.5 * (evalCoreHeight(wxz - offsetStep) + evalCoreHeight(wxz + offsetStep));
            }
            h = mix(h, hCoarse, morph);
          }

          vec3 wp = vec3(wxz.x, h, wxz.y);
          vWorldPos = wp;
          vIsOuter = (max(abs(wxz.x), abs(wxz.y)) > CORE_HALF - 40.0) ? 1.0 : 0.0;
          vDist = length(wp - uCamPos);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
        }
      `,
      fragmentShader: FRAGMENT_SHADER,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    levels.push({ mesh, mat, step, lv });
  }

  // Static Outer Alps Panorama (48km × 48km surrounding peaks out to 24km from center!)
  const outerGeo = buildOuterAlpsGeometry(176);
  const outerUniforms = {
    ...sharedUniforms,
    uChildCenter: { value: new THREE.Vector2(0, 0) },
    uChildHalf: { value: CORE_HALF - 55.0 },
    uIsOuterMesh: { value: 1.0 },
  };
  const outerMat = new THREE.ShaderMaterial({
    uniforms: outerUniforms,
    vertexShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uOuterDem;
      uniform float uOuterSize;
      uniform vec3 uCamPos;
      varying vec3 vWorldPos;
      varying float vIsOuter;
      varying float vDist;
      ${SHARED_GLSL_HEIGHT}
      void main() {
        vec2 wxz = position.xz;
        float h = samplePackedDEM(uOuterDem, uOuterSize, wxz, OUTER_HALF).x;
        // Tuck overlap margin slightly down inside core boundary to prevent z-fighting
        float edgeD = max(abs(wxz.x), abs(wxz.y));
        if (edgeD < CORE_HALF + 80.0) {
          h -= (1.0 - smoothstep(CORE_HALF - 380.0, CORE_HALF + 80.0, edgeD)) * 22.0;
        }
        vec3 wp = vec3(wxz.x, h, wxz.y);
        vWorldPos = wp;
        vIsOuter = 1.0;
        vDist = length(wp - uCamPos);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: FRAGMENT_SHADER,
  });
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.frustumCulled = false;
  group.add(outerMesh);

  return {
    group,
    sharedUniforms,
    update(cameraPos, focusXZ, preset, sunDir, time, trackBuf, avyState = null) {
      sharedUniforms.uCamPos.value.copy(cameraPos);
      sharedUniforms.uTime.value = time;
      sharedUniforms.uSunDir.value.copy(sunDir);
      sharedUniforms.uSunElev.value = Math.asin(THREE.MathUtils.clamp(sunDir.y, -1, 1));
      sharedUniforms.uSunColor.value.copy(preset.sunColor);
      sharedUniforms.uSunIntensity.value = preset.sunIntensity;
      sharedUniforms.uShadowSkyColor.value.copy(preset.shadowSkyColor);
      sharedUniforms.uShadowFillStrength.value = preset.shadowFillStrength;
      sharedUniforms.uGroundBounceColor.value.copy(preset.groundBounceColor);
      sharedUniforms.uSSSColor.value.copy(preset.sssColor);
      sharedUniforms.uFogColor.value.copy(preset.fogColor);
      sharedUniforms.uFogDensity.value = preset.fogDensity;
      sharedUniforms.uValleyCloudAlt.value = preset.valleyCloudAlt;
      sharedUniforms.uValleyCloudDensity.value = preset.valleyCloudDensity;
      sharedUniforms.uCloudShadowStrength.value = preset.cloudShadowStrength;
      sharedUniforms.uSparkleIntensity.value = preset.sparkleIntensity;
      sharedUniforms.uHorizonBlend.value.set(...preset.horizonBlend);
      sharedUniforms.uStorm.value = preset.id === 'storm' ? 1.0 : 0.0;
      sharedUniforms.uTwilight.value = preset.id === 'alpenglow' ? 1.0 : (preset.id === 'morning' ? 0.18 : 0.0);
      sharedUniforms.uTrackTex.value = trackBuf.texture;
      sharedUniforms.uTrackOrigin.value.set(trackBuf.originX, trackBuf.originZ);
      sharedUniforms.uTrackSpan.value = trackBuf.worldSpan;
      sharedUniforms.uTrackRes.value = trackBuf.res;
      sharedUniforms.uMacroTrackTex.value = trackBuf.macroTexture;
      sharedUniforms.uMacroTrackOrigin.value.set(trackBuf.macroOriginX, trackBuf.macroOriginZ);
      sharedUniforms.uMacroTrackSpan.value = trackBuf.macroSpan;
      sharedUniforms.uMacroTrackRes.value = trackBuf.macroRes;
      if (avyState && avyState.active) {
        sharedUniforms.uAvyActive.value = avyState.strength;
        sharedUniforms.uAvyOrigin.value.set(avyState.originX, avyState.originZ);
        sharedUniforms.uAvyDir.value.set(avyState.dirX, avyState.dirZ);
        sharedUniforms.uAvyFront.value = avyState.frontDist;
        sharedUniforms.uAvyWidth.value = avyState.width;
      } else {
        sharedUniforms.uAvyActive.value = 0.0;
      }

      // Snap each clipmap ring strictly to 2 * gridStep increments (ZERO vertex swimming!)
      for (let i = 0; i < levels.length; i++) {
        const lv = levels[i];
        const snap = lv.step * 2.0;
        const sx = Math.round(focusXZ.x / snap) * snap;
        const sz = Math.round(focusXZ.y / snap) * snap;
        lv.mat.uniforms.uSnapCenter.value.set(sx, sz);
        if (i > 0) {
          const prev = levels[i - 1];
          lv.mat.uniforms.uChildCenter.value.copy(prev.mat.uniforms.uSnapCenter.value);
          // Full 1.25-cell overlap rim eliminates ALL subpixel pinhole dots on steep silhouettes!
          lv.mat.uniforms.uChildHalf.value = (GRID_N * 0.5) * prev.step - prev.step * 1.25;
        }
      }
    },
  };
}
