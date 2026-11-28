/**
 * Analytic high-altitude Rayleigh + Mie sky dome, solar disc & corona,
 * orographic lenticular / cirrus clouds, and Chamonix valley sea-of-clouds
 * (mer de nuages) layered cleanly beneath the glacier elevation.
 */
import * as THREE from 'three';

export function createSkyAndClouds() {
  const skyGeo = new THREE.SphereGeometry(42000, 48, 32);
  const skyUniforms = {
    uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.5) },
    uSunColor: { value: new THREE.Color(1.0, 0.94, 0.85) },
    uZenith: { value: new THREE.Color(0.055, 0.145, 0.42) },
    uHorizon: { value: new THREE.Color(0.56, 0.72, 0.90) },
    uTime: { value: 0 },
    uCloudCov: { value: 0.28 },
    uStorm: { value: 0.0 },
  };

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    uniforms: skyUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform float uTime;
      uniform float uCloudCov;
      uniform float uStorm;
      varying vec3 vWorldDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float amp = 0.52;
        mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
        for (int i = 0; i < 5; i++) {
          v += amp * vnoise(p);
          p = rot * p * 2.04 + vec2(13.1, 7.7);
          amp *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vWorldDir);
        float el = clamp(d.y, -0.15, 1.0);
        float tGrad = pow(max(0.0, el), 0.52);

        // High-altitude Mont Blanc sky: deep cobalt-navy overhead, crisp glacial horizon
        vec3 col = mix(uHorizon, uZenith, tGrad);

        // Subtle Rayleigh horizon warm-silver scatter band near sun azimuth
        // Smooth physical angular solar core + dual Mie corona (eliminates wide-FOV perspective oval distortion!)
        vec3 sunN = normalize(uSunDir);
        float sunCos = clamp(dot(d, sunN), -1.0, 1.0);
        float sunAng = acos(sunCos); // true spherical radians from solar center
        float mieWide = pow(max(0.0, sunCos), 5.5) * (1.0 - max(0.0, el) * 0.62);
        float mieMid  = exp(-sunAng * 10.5);
        float mieCore = exp(-sunAng * 38.0);
        float sunDisk = (1.0 - smoothstep(0.011, 0.022, sunAng)) * 0.85 + exp(-sunAng * sunAng * 6800.0);

        float clearFactor = 1.0 - uStorm * 0.88;
        col += uSunColor * (0.26 * mieWide + 0.42 * mieMid + 1.15 * mieCore) * clearFactor;
        col += mix(uSunColor, vec3(1.0, 0.99, 0.96), 0.55) * 4.4 * sunDisk * clearFactor;

        // Below horizon fill (matches valley fog smoothly)
        if (d.y < 0.0) {
          col = mix(uHorizon, uHorizon * 0.68, clamp(-d.y * 4.5, 0.0, 1.0));
        }

        // Two-layer parallax alpine clouds:
        //  1) High wispy jetstream cirrus veil
        //  2) Mid-altitude volumetric orographic lenticular / cumulus billows wrapping Mont Blanc ridges with 3-tap self-shadowing!
        if (d.y > 0.012) {
          vec2 windDir = vec2(0.0085, 0.0032);
          float horFade = smoothstep(0.012, 0.14, d.y);
          vec2 sunStep = normalize(sunN.xz + vec2(1e-4));

          // Layer 1: High thin alpine cirrus streaks
          vec2 uvHi = d.xz / (d.y + 0.18);
          float hiF = fbm(uvHi * vec2(1.4, 0.55) + windDir * uTime * 1.15);
          float hiStreak = fbm(uvHi * vec2(3.1, 1.2) - windDir * uTime * 0.4 + vec2(hiF * 0.75, 0.0));
          float cirrusMask = smoothstep(mix(0.66, 0.34, uCloudCov), mix(0.92, 0.68, uCloudCov), hiF * 0.6 + hiStreak * 0.4) * horFade * smoothstep(0.02, 0.25, d.y);
          vec3 cirrusCol = mix(uHorizon * 1.25, vec3(0.98, 0.97, 0.99) * (0.55 + 0.45 * uSunColor), 0.72) + uSunColor * 0.32 * mieWide * clearFactor;
          col = mix(col, cirrusCol, cirrusMask * mix(0.42, 0.68, uStorm));

          // Layer 2: Volumetric sunlit orographic cumulus/lenticular billows with 3-tap sun-direction optical depth
          vec2 uv = d.xz / (d.y + 0.11);
          vec2 wind = windDir * uTime;
          float w = fbm(uv * vec2(0.72, 1.32) + wind);
          float c2 = fbm(uv * vec2(1.95, 0.92) - wind * 0.55 + vec2(w * 0.88, -w * 0.48));
          float baseDens = w * 0.62 + c2 * 0.44;
          float thresh = mix(0.64, 0.26, uCloudCov);
          float cloudMask = smoothstep(thresh, thresh + 0.25, baseDens) * horFade;

          if (cloudMask > 0.005) {
            // 3-tap directional optical depth march toward sun for soft volumetric silver-lining rims & sculpted undersides
            float s1 = fbm((uv + sunStep * 0.045) * vec2(0.72, 1.32) + wind);
            float s2 = fbm((uv + sunStep * 0.105) * vec2(0.72, 1.32) + wind);
            float s3 = fbm((uv + sunStep * 0.190) * vec2(0.72, 1.32) + wind);
            float depthOcc = clamp((s1 * 0.48 + s2 * 0.34 + s3 * 0.18) - thresh * 0.72, 0.0, 0.95);
            float lit = clamp(exp(-depthOcc * 2.8) * 0.92 + (w - s1) * 1.85 + 0.18, 0.0, 1.15);
            // Warm alpenglow/sunset under-bounce along sunlit cloud fringes
            float powderPhase = (1.0 - exp(-cloudMask * 2.4)) * pow(max(0.0, sunCos), 3.0) * clearFactor;
            vec3 cloudDark = mix(uZenith * 1.40 + vec3(0.22, 0.27, 0.37), vec3(0.30, 0.35, 0.43), uStorm);
            vec3 cloudLit = mix(vec3(0.95, 0.97, 1.0) * (0.58 + 0.42 * uSunColor), uSunColor * 1.38, 0.36 + 0.38 * mieWide);
            vec3 cloudCol = mix(cloudDark, cloudLit, clamp(lit * (1.0 - uStorm * 0.55) + 0.12, 0.0, 1.0));
            // Crisp Mie silver-lining halo on cloud edges backlit by the alpine sun
            float silverRim = (1.0 - cloudMask * 0.62) * (0.48 * pow(max(0.0, sunCos), 8.0) + 0.35 * powderPhase) * clearFactor;
            cloudCol += uSunColor * silverRim;
            col = mix(col, cloudCol, cloudMask * mix(0.78, 0.95, uStorm));
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = -100;

  // Low Chamonix Valley Sea-of-Clouds (Mer de Nuages) plane floating cleanly above valley floor
  const cloudPlaneGeo = new THREE.PlaneGeometry(52000, 52000, 1, 1);
  cloudPlaneGeo.rotateX(-Math.PI / 2);
  const cloudPlaneUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.5) },
    uSunColor: { value: new THREE.Color(1.0, 0.94, 0.85) },
    uShadowColor: { value: new THREE.Color(0.38, 0.52, 0.72) },
    uDensity: { value: 0.62 },
    uTwilight: { value: 0.0 },
    uCamPos: { value: new THREE.Vector3() },
  };
  const cloudPlaneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    uniforms: cloudPlaneUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uShadowColor;
      uniform float uDensity;
      uniform float uTwilight;
      uniform vec3 uCamPos;
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.5);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }
      float fbm(vec2 p) {
        return vnoise(p) * 0.55 + vnoise(p * 2.13 + 7.4) * 0.30 + vnoise(p * 4.31 - 3.9) * 0.15;
      }

      void main() {
        vec2 p = vWorldPos.xz * 0.00042 + vec2(uTime * 0.004, uTime * 0.0018);
        float n = fbm(p);
        float n2 = fbm(p + normalize(uSunDir.xz + vec2(1e-4)) * 0.14);
        float dist = length(vWorldPos.xz - uCamPos.xz);
        // Only softly appear in the deep valley (>700m away or when well below skier)
        float aboveFade = smoothstep(80.0, 380.0, uCamPos.y - vWorldPos.y);
        float distFade = smoothstep(550.0, 2600.0, dist) * (1.0 - smoothstep(18000.0, 25000.0, dist));
        float billow = smoothstep(mix(0.32, 0.44, uTwilight), 0.80, n);
        float lit = clamp((n - n2) * 3.2 + 0.62, 0.0, 1.0);
        vec3 col = mix(uShadowColor * 1.15, vec3(0.95, 0.97, 1.0) * (0.5 + 0.5 * uSunColor), lit);
        // Warm upward light-pollution underglow illuminating thin evening mist above Chamonix / Arve valley!
        if (uTwilight > 0.02) {
          float dCham = length(vWorldPos.xz - vec2(-2759.0, -5001.0));
          float dBoss = length(vWorldPos.xz - vec2(-3900.0, -3600.0));
          float dHouch = length(vWorldPos.xz - vec2(-5200.0, -2500.0));
          float dPraz = length(vWorldPos.xz - vec2(-1750.0, -5850.0));
          float townHalo = exp(-dCham * dCham / 1.9e6) * 1.15
                         + exp(-dBoss * dBoss / 1.1e6) * 0.72
                         + exp(-dHouch * dHouch / 1.2e6) * 0.68
                         + exp(-dPraz * dPraz / 0.9e6) * 0.55;
          col += vec3(1.0, 0.34, 0.03) * min(townHalo, 1.35) * uTwilight * (0.28 + 0.42 * (1.0 - billow));
        }
        // Softly part clouds over twilight valley floor so glowing Chamonix lights glimmer through mist!
        float alpha = billow * uDensity * mix(1.0, 0.44, uTwilight) * distFade * aboveFade * 0.68;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const valleyCloudMesh = new THREE.Mesh(cloudPlaneGeo, cloudPlaneMat);
  valleyCloudMesh.position.set(0, 1460, 0);
  valleyCloudMesh.renderOrder = 2;

  return {
    skyMesh,
    valleyCloudMesh,
    update(cameraPos, preset, sunDir, t) {
      skyMesh.position.copy(cameraPos);
      skyUniforms.uSunDir.value.copy(sunDir);
      skyUniforms.uSunColor.value.copy(preset.sunColor);
      skyUniforms.uZenith.value.copy(preset.skyZenith);
      skyUniforms.uHorizon.value.copy(preset.skyHorizon);
      skyUniforms.uTime.value = t;
      skyUniforms.uCloudCov.value = preset.cloudCoverage;
      skyUniforms.uStorm.value = preset.id === 'storm' ? 1.0 : 0.0;

      valleyCloudMesh.position.y = preset.valleyCloudAlt;
      cloudPlaneUniforms.uTime.value = t;
      cloudPlaneUniforms.uSunDir.value.copy(sunDir);
      cloudPlaneUniforms.uSunColor.value.copy(preset.sunColor);
      cloudPlaneUniforms.uShadowColor.value.copy(preset.shadowSkyColor);
      cloudPlaneUniforms.uDensity.value = preset.valleyCloudDensity;
      cloudPlaneUniforms.uTwilight.value = preset.id === 'alpenglow' ? 1.0 : (preset.id === 'morning' ? 0.18 : 0.0);
      cloudPlaneUniforms.uCamPos.value.copy(cameraPos);
    },
  };
}
