/**
 * HDR Photorealistic Optical Post-Process Pipeline:
 *  - WebGL2 Hardware 4× MSAA on HalfFloat HDR RenderTarget (eliminates jagged ski/ridge aliasing!)
 *  - Inline luma-adaptive edge smoothing fallback (FXAA-lite)
 *  - Separable half-res HDR Bloom / Halation off sunlit snow crystal glints
 *  - ACES Filmic Tone Mapping + dynamic auto-exposure
 *  - Action-cam barrel distortion & faint corner chromatic aberration
 *  - Velocity-coupled radial speed blur (>58 km/h)
 *  - Melted snow lens droplets & pulsing high-altitude breath condensation on lower rim!
 *  - Static sensor micro-dither (zero sky banding, zero temporal paint boil)
 */
import * as THREE from 'three';

export class OpticalPostPipeline {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);

    const gl = renderer.getContext();
    const isWebGL2 = renderer.capabilities.isWebGL2;
    const canHalfFloat = isWebGL2
      ? !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float')
      : !!gl.getExtension('EXT_color_buffer_half_float');
    const rtType = canHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.isHDR = canHalfFloat;
    let maxSamples = isWebGL2 ? Math.min(4, renderer.capabilities.maxSamples || 0) : 0;
    // Probe multisampled FBO completeness cleanly (prevents GL_INVALID_FRAMEBUFFER_OPERATION on drivers/SwiftShader without RGBA16F MSAA)
    if (maxSamples > 0) {
      const testFb = gl.createFramebuffer();
      const testRb = gl.createRenderbuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, testFb);
      gl.bindRenderbuffer(gl.RENDERBUFFER, testRb);
      const internalFmt = canHalfFloat ? gl.RGBA16F : gl.RGBA8;
      try {
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, maxSamples, internalFmt, 4, 4);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, testRb);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE || gl.getError() !== gl.NO_ERROR) {
          maxSamples = 0;
        }
      } catch (_e) {
        maxSamples = 0;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      gl.deleteRenderbuffer(testRb);
      gl.deleteFramebuffer(testFb);
    }
    this.maxHardwareSamples = maxSamples;
    this.msaaSamples = maxSamples;
    this.rtType = rtType;

    const hdrOpts = {
      type: rtType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: maxSamples,
    };
    const bloomOpts = {
      type: rtType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    };

    this.sceneRT = new THREE.WebGLRenderTarget(this.width, this.height, hdrOpts);
    this.bloomA = new THREE.WebGLRenderTarget(Math.max(1, this.width >> 1), Math.max(1, this.height >> 1), bloomOpts);
    this.bloomB = new THREE.WebGLRenderTarget(Math.max(1, this.width >> 1), Math.max(1, this.height >> 1), bloomOpts);
    this.godRayRT = new THREE.WebGLRenderTarget(Math.max(1, this.width >> 1), Math.max(1, this.height >> 1), bloomOpts);

    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    this.brightMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        uScene: { value: this.sceneRT.texture },
        uTexel: { value: new THREE.Vector2(1 / this.width, 1 / this.height) },
        uThresh: { value: 1.18 },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uScene;
        uniform vec2 uTexel;
        uniform float uThresh;
        varying vec2 vUv;
        vec3 extractBright(vec2 uv) {
          vec3 c = texture2D(uScene, clamp(uv, 0.0, 1.0)).rgb;
          float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          float soft = max(0.0, lum - uThresh) / (lum + 0.001);
          return c * clamp(soft, 0.0, 2.5);
        }
        void main() {
          vec3 sum = extractBright(vUv) * 0.227027;
          vec2 stepX = vec2(uTexel.x * 2.2, 0.0);
          sum += (extractBright(vUv + stepX * 1.0) + extractBright(vUv - stepX * 1.0)) * 0.1945946;
          sum += (extractBright(vUv + stepX * 2.0) + extractBright(vUv - stepX * 2.0)) * 0.1216216;
          sum += (extractBright(vUv + stepX * 3.0) + extractBright(vUv - stepX * 3.0)) * 0.054054;
          sum += (extractBright(vUv + stepX * 4.0) + extractBright(vUv - stepX * 4.0)) * 0.016216;
          gl_FragColor = vec4(sum, 1.0);
        }
      `,
    });
    this.brightScene = new THREE.Scene();
    this.brightScene.add(new THREE.Mesh(quadGeo, this.brightMat));

    this.blurVMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        uSrc: { value: this.bloomA.texture },
        uTexel: { value: new THREE.Vector2(1 / Math.max(1, this.width >> 1), 1 / Math.max(1, this.height >> 1)) },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uSrc;
        uniform vec2 uTexel;
        varying vec2 vUv;
        void main() {
          vec3 sum = texture2D(uSrc, vUv).rgb * 0.227027;
          vec2 stepY = vec2(0.0, uTexel.y * 1.8);
          sum += (texture2D(uSrc, clamp(vUv + stepY * 1.0, 0.0, 1.0)).rgb + texture2D(uSrc, clamp(vUv - stepY * 1.0, 0.0, 1.0)).rgb) * 0.1945946;
          sum += (texture2D(uSrc, clamp(vUv + stepY * 2.0, 0.0, 1.0)).rgb + texture2D(uSrc, clamp(vUv - stepY * 2.0, 0.0, 1.0)).rgb) * 0.1216216;
          sum += (texture2D(uSrc, clamp(vUv + stepY * 3.0, 0.0, 1.0)).rgb + texture2D(uSrc, clamp(vUv - stepY * 3.0, 0.0, 1.0)).rgb) * 0.054054;
          sum += (texture2D(uSrc, clamp(vUv + stepY * 4.0, 0.0, 1.0)).rgb + texture2D(uSrc, clamp(vUv - stepY * 4.0, 0.0, 1.0)).rgb) * 0.016216;
          gl_FragColor = vec4(sum, 1.0);
        }
      `,
    });
    this.blurVScene = new THREE.Scene();
    this.blurVScene.add(new THREE.Mesh(quadGeo, this.blurVMat));

    // Half-res pixel-accurate Volumetric Screen-Space God-Rays pass (quarter pixel count = ~6.5x faster & silkier!).
    // Uses 3-state sceneRT.a encoding: 0.00=skis/body (occludes!), 0.55=terrain/spruces/rocks/Midi (occludes!), 1.00=open sky (EMITS!).
    this.godRayMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        uScene: { value: this.sceneRT.texture },
        uSunUV: { value: new THREE.Vector2(0.5, 0.8) },
        uSunColor: { value: new THREE.Color(1.0, 0.91, 0.78) },
        uGodRayVis: { value: 0.0 },
        uGodRayStrength: { value: 0.55 },
        uAspect: { value: this.width / this.height },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uScene;
        uniform vec2 uSunUV;
        uniform vec3 uSunColor;
        uniform float uGodRayVis;
        uniform float uGodRayStrength;
        uniform float uAspect;
        varying vec2 vUv;

        // Interleaved Gradient Noise (Jimenez 2014) — blue-noise-like jitter eliminates radial banding!
        float ign(vec2 p) {
          return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
        }

        void main() {
          vec2 asp = vec2(uAspect, 1.0);
          vec2 delta = uSunUV - vUv;
          float distToSun = length(delta * asp);
          if (distToSun > 1.22 || uGodRayVis <= 0.005 || uGodRayStrength <= 0.005) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
          }
          float offScreen = smoothstep(-0.55, 0.06, uSunUV.x) * smoothstep(1.55, 0.94, uSunUV.x)
                          * smoothstep(-0.45, 0.06, uSunUV.y) * smoothstep(1.45, 0.94, uSunUV.y);
          if (offScreen <= 0.001) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
          }

          const int NUM_SAMPLES = 22;
          float density = 0.94;
          vec2 stepUv = delta * (density / float(NUM_SAMPLES));
          float jitter = ign(gl_FragCoord.xy);
          vec2 tc = vUv + stepUv * jitter;

          float illumDecay = 1.0;
          float decay = 0.942;
          vec3 accum = vec3(0.0);
          for (int i = 0; i < NUM_SAMPLES; i++) {
            float inBounds = step(0.001, tc.x) * step(tc.x, 0.999) * step(0.001, tc.y) * step(tc.y, 0.999);
            vec4 tap = texture2D(uScene, clamp(tc, 0.001, 0.999));
            float skyMask = smoothstep(0.72, 0.96, tap.a) * inBounds;
            float tapR = length((tc - uSunUV) * asp);
            float coronaW = exp(-tapR * 4.2) * 0.95 + exp(-tapR * 12.5) * 2.85 + exp(-tapR * 28.0) * 2.10;
            float tapLum = clamp(dot(tap.rgb, vec3(0.25, 0.60, 0.15)), 0.0, 3.6);
            vec3 warmSun = mix(uSunColor, vec3(1.0, 0.74, 0.36), 0.32);
            vec3 emitCol = mix(warmSun, min(tap.rgb, vec3(2.6)), 0.22);
            accum += emitCol * (skyMask * coronaW * (0.26 + 0.50 * min(tapLum, 2.2))) * illumDecay;
            illumDecay *= decay;
            tc += stepUv;
          }

          float radialEnv = exp(-distToSun * 1.12) * smoothstep(1.24, 0.04, distToSun);
          vec3 shafts = (accum / float(NUM_SAMPLES)) * uGodRayStrength * uGodRayVis * offScreen * radialEnv;
          gl_FragColor = vec4(shafts, 1.0);
        }
      `,
    });
    this.godRayScene = new THREE.Scene();
    this.godRayScene.add(new THREE.Mesh(quadGeo, this.godRayMat));

    this.compMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        uScene: { value: this.sceneRT.texture },
        uBloom: { value: this.bloomB.texture },
        uGodRays: { value: this.godRayRT.texture },
        uHasGodRays: { value: 0.0 },
        uTexel: { value: new THREE.Vector2(1 / this.width, 1 / this.height) },
        uExposure: { value: 0.72 },
        uBloomStrength: { value: 0.24 },
        uBarrel: { value: 0.055 },
        uSpeedFactor: { value: 0.0 },
        uAngVel: { value: new THREE.Vector2(0, 0) },
        uRollVel: { value: 0.0 },
        uHorizonUV: { value: new THREE.Vector2(0.5, 0.55) },
        uSunUV: { value: new THREE.Vector2(0.5, 0.8) },
        uSunVis: { value: 0.0 },
        uGodRayVis: { value: 0.0 },
        uGodRayStrength: { value: 0.55 },
        uSunColor: { value: new THREE.Color(1.0, 0.91, 0.78) },
        uFaceShot: { value: 0.0 },
        uLensWet: { value: 0.0 },
        uBreath: { value: 0.0 },
        uStormStreaks: { value: 0.0 },
        uAspect: { value: this.width / this.height },
        uTime: { value: 0.0 },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uScene;
        uniform sampler2D uBloom;
        uniform sampler2D uGodRays;
        uniform float uHasGodRays;
        uniform vec2 uTexel;
        uniform float uExposure;
        uniform float uBloomStrength;
        uniform float uBarrel;
        uniform float uSpeedFactor;
        uniform vec2 uAngVel;
        uniform float uRollVel;
        uniform vec2 uHorizonUV;
        uniform vec2 uSunUV;
        uniform float uSunVis;
        uniform float uGodRayVis;
        uniform float uGodRayStrength;
        uniform vec3 uSunColor;
        uniform float uFaceShot;
        uniform float uLensWet;
        uniform float uBreath;
        uniform float uStormStreaks;
        uniform float uAspect;
        uniform float uTime;
        varying vec2 vUv;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

        vec3 acesFilm(vec3 x) {
          const float a = 2.51;
          const float b = 0.03;
          const float c = 2.43;
          const float d = 0.59;
          const float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        vec2 barrelUV(vec2 uv, float k) {
          vec2 c = uv - 0.5;
          float r2 = dot(c, c);
          float scale = 1.0 - k * 0.25;
          return 0.5 + c * (1.0 + k * r2) * scale;
        }

        // Fast directional FXAA pass (cleans diagonal ski edges & high-contrast silhouette seams!)
        vec3 sampleFXAA(vec2 uv) {
          vec3 cM  = texture2D(uScene, uv).rgb;
          vec3 cNW = texture2D(uScene, uv + vec2(-1.0, -1.0) * uTexel).rgb;
          vec3 cNE = texture2D(uScene, uv + vec2( 1.0, -1.0) * uTexel).rgb;
          vec3 cSW = texture2D(uScene, uv + vec2(-1.0,  1.0) * uTexel).rgb;
          vec3 cSE = texture2D(uScene, uv + vec2( 1.0,  1.0) * uTexel).rgb;
          float lM = luma(cM), lNW = luma(cNW), lNE = luma(cNE), lSW = luma(cSW), lSE = luma(cSE);
          float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
          float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
          if (lMax - lMin < max(0.05, lMax * 0.12)) return cM;
          vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
          float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
          float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
          dir = clamp(dir * rcp, vec2(-4.0), vec2(4.0)) * uTexel;
          vec3 rgbA = 0.5 * (texture2D(uScene, uv + dir * (1.0/3.0 - 0.5)).rgb + texture2D(uScene, uv + dir * (2.0/3.0 - 0.5)).rgb);
          vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(uScene, uv + dir * -0.5).rgb + texture2D(uScene, uv + dir * 0.5).rgb);
          float lB = luma(rgbB);
          return (lB < lMin || lB > lMax) ? rgbA : rgbB;
        }

        vec2 lensDroplets(vec2 uv, float wet) {
          if (wet <= 0.01) return vec2(0.0);
          vec2 p = vec2(uv.x * uAspect, uv.y) * 9.5;
          vec2 id = floor(p);
          vec2 gv = fract(p) - 0.5;
          float rnd = hash21(id + vec2(4.7, 9.2));
          if (rnd < 0.72) return vec2(0.0);
          vec2 off = vec2(hash21(id + 1.1) - 0.5, hash21(id + 2.3) - 0.5) * 0.45;
          float rad = (0.10 + 0.16 * fract(rnd * 13.7)) * wet;
          vec2 d = gv - off;
          float dist = length(d);
          float edgeMask = smoothstep(0.18, 0.52, length(uv - 0.5));
          float drop = smoothstep(rad, rad * 0.25, dist) * edgeMask;
          return -d * drop * 0.18;
        }

        // Organic wind-whipped blowing snow crystals/wisps strictly in Alpine Squall blizzard!
        float drivingSnowLayer(vec2 uv, float t, float scale, float speed, float density, float ang) {
          vec2 p = vec2(uv.x * uAspect, uv.y);
          // Subtle swirling wind turbulence wobble so flakes never form rigid ruler-straight barcode lines!
          p.y += sin(p.x * 3.8 + t * 2.1) * 0.032;
          mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
          vec2 q = rot * p;
          q.x *= scale * 0.62;
          q.y *= scale * 1.45;
          q.x -= t * speed;
          vec2 id = floor(q);
          vec2 gv = fract(q) - 0.5;
          float h = hash21(id);
          if (h > density) return 0.0;
          float yOff = (fract(h * 19.3) - 0.5) * 0.62;
          float xOff = (fract(h * 27.7) - 0.5) * 0.25;
          float xLen = 0.05 + 0.14 * fract(h * 7.1);
          float dY = abs(gv.y - yOff);
          float dX = max(0.0, abs(gv.x - xOff) - xLen);
          float rad = 0.045 + 0.055 * fract(h * 53.1);
          float wisp = exp(-pow(length(vec2(dX * 1.8, dY * 1.6)) / rad, 2.0));
          return wisp * (0.30 + 0.65 * fract(h * 37.9));
        }

        // Crisp 5-tap upsample gather of half-res Volumetric Screen-Space God-Rays (preserves sharp bough-shadow spokes!)
        vec3 sampleGodRays(vec2 suv, float centerAlpha) {
          if (uHasGodRays < 0.5) return vec3(0.0);
          vec2 t = uTexel * 1.15;
          vec3 shafts = texture2D(uGodRays, suv).rgb * 0.48
                      + texture2D(uGodRays, clamp(suv + vec2( t.x, 0.0), 0.001, 0.999)).rgb * 0.13
                      + texture2D(uGodRays, clamp(suv + vec2(-t.x, 0.0), 0.001, 0.999)).rgb * 0.13
                      + texture2D(uGodRays, clamp(suv + vec2(0.0,  t.y), 0.001, 0.999)).rgb * 0.13
                      + texture2D(uGodRays, clamp(suv + vec2(0.0, -t.y), 0.001, 0.999)).rgb * 0.13;
          // Boost across dark spruce silhouettes & mountain ridges while preserving crisp sky headroom (zero white clip!)
          float isSkyPx = smoothstep(0.72, 0.96, centerAlpha);
          float isFgPx  = 1.0 - smoothstep(0.10, 0.42, centerAlpha);
          float pixelGain = mix(1.62, 0.26, isSkyPx) * mix(1.0, 0.45, isFgPx);
          shafts *= pixelGain;
          return shafts / (1.0 + shafts * 0.82);
        }

        // Restrained photoreal action-cam optical sun lens flare: 6-point diffraction starburst, delicate veiling glare & 3 chromatic ghost reflections!
        // Includes real 5-tap GPU alpha occlusion probe around sunUv so even 3D Norway spruce trunks & boughs flash the starburst!
        vec3 evalSunFlare(vec2 uv, vec2 sunUv, float vis, vec3 sunCol) {
          if (vis <= 0.005) return vec3(0.0);
          float gpuVis = 1.0;
          if (sunUv.x > 0.02 && sunUv.x < 0.98 && sunUv.y > 0.02 && sunUv.y < 0.98) {
            vec2 o = vec2(0.011 / uAspect, 0.011);
            float v0 = smoothstep(0.72, 0.96, texture2D(uScene, sunUv).a);
            float v1 = smoothstep(0.72, 0.96, texture2D(uScene, clamp(sunUv + vec2( o.x, 0.0), 0.001, 0.999)).a);
            float v2 = smoothstep(0.72, 0.96, texture2D(uScene, clamp(sunUv + vec2(-o.x, 0.0), 0.001, 0.999)).a);
            float v3 = smoothstep(0.72, 0.96, texture2D(uScene, clamp(sunUv + vec2(0.0,  o.y), 0.001, 0.999)).a);
            float v4 = smoothstep(0.72, 0.96, texture2D(uScene, clamp(sunUv + vec2(0.0, -o.y), 0.001, 0.999)).a);
            gpuVis = clamp((v0 * 2.0 + v1 + v2 + v3 + v4) / 6.0, 0.0, 1.0);
            if (gpuVis <= 0.01) return vec3(0.0);
          }
          vec2 asp = vec2(uAspect, 1.0);
          vec2 d = (uv - sunUv) * asp;
          float r = length(d);

          // Soft aperture corona + subtle 6-point optical diffraction starburst
          float ang = r > 1e-4 ? atan(d.y, d.x) : 0.0;
          float rays6 = pow(abs(cos(ang * 3.0 + 0.26)), 18.0) * 0.55 + pow(abs(cos(ang * 6.0)), 26.0) * 0.22;
          float star = exp(-r * 7.2) * (0.35 + 1.05 * rays6) * smoothstep(0.65, 0.0, r);
          // Delicate horizontal anamorphic polycarbonate goggle micro-streak
          float streak = exp(-abs(d.y) * 58.0) * exp(-abs(d.x) * 3.2) * 0.22;
          // Warm optical veiling glare falling softly across sunny lens quadrant
          float veil = exp(-r * 2.15) * 0.14;

          vec3 flare = sunCol * (star * 0.42 + streak * 0.48 + veil);

          // 3 ultra-subtle internal coated-glass ghost reflections along the optical axis through screen center
          vec2 axis = vec2(0.5) - sunUv;
          float g1r = length((uv - (vec2(0.5) + axis * 0.48)) * asp);
          float g1 = exp(-pow((g1r - 0.042) / 0.024, 2.0)) * 0.024 + exp(-g1r * g1r * 360.0) * 0.018;
          flare += vec3(1.05, 0.78, 0.52) * g1;

          float g2r = length((uv - (vec2(0.5) + axis * 0.96)) * asp);
          float g2 = smoothstep(0.075, 0.018, g2r) * smoothstep(0.004, 0.036, g2r) * 0.020;
          flare += vec3(0.54, 0.86, 1.15) * g2;

          float g3r = length((uv - (vec2(0.5) + axis * 1.48)) * asp);
          float g3 = exp(-pow((g3r - 0.095) / 0.036, 2.0)) * 0.014;
          flare += vec3(0.95, 0.58, 0.78) * g3;

          // Fade naturally near extreme off-screen edges
          float edgeSoft = smoothstep(-0.35, 0.08, sunUv.x) * smoothstep(1.35, 0.92, sunUv.x)
                         * smoothstep(-0.30, 0.08, sunUv.y) * smoothstep(1.30, 0.92, sunUv.y);
          return flare * vis * gpuVis * edgeSoft;
        }

        void main() {
          vec2 uv = barrelUV(vUv, uBarrel);
          vec2 dropOff = lensDroplets(uv, uLensWet);
          vec2 suv = clamp(uv + dropOff, 0.001, 0.999);

          vec2 fromCenter = suv - 0.5;
          float r2 = dot(fromCenter, fromCenter);
          float ca = (0.0012 + uSpeedFactor * 0.0020) * r2 * (uBarrel > 0.01 ? 1.0 : 0.35);

          // Alpha channel encodes 3-state MSAA mask:
          //   0.00 = foreground skier/skis/poles (SHARP!), 0.55 = rushing world/trees/terrain, 1.00 = open sky dome!
          vec4 centerRaw = texture2D(uScene, suv);
          float worldMask = smoothstep(0.10, 0.44, centerRaw.a);

          // Real 1/120s shutter velocity vector:
          //  1) Horizon-weighted ground-rush streak (distant alpine peaks stay sharp; rushing snow near ski tips streaks fast!)
          //  2) Angular camera whip-pan blur from fast mouse head turns, carving yaw, and mid-air spins!
          vec2 vpDelta = suv - uHorizonUV;
          float groundW = mix(0.08, 1.0, smoothstep(uHorizonUV.y + 0.14, uHorizonUV.y - 0.56, suv.y));
          float periph = smoothstep(0.05, 0.50, length(vpDelta));
          vec2 radialVec = vpDelta * (uSpeedFactor * 0.032 * groundW * (0.28 + 0.72 * periph));
          vec2 rollVec = vec2(-(suv.y - 0.5), suv.x - 0.5) * uRollVel;
          vec2 blurVec = (radialVec + uAngVel + rollVec) * worldMask;
          float blurMag = length(blurVec);
          if (blurMag > 0.048) blurVec *= (0.048 / blurMag);

          vec3 baseAA = sampleFXAA(suv);
          vec3 col;
          if (blurMag > 0.0014 && worldMask > 0.08) {
            vec3 acc = baseAA;
            float wSum = 1.0;
            // Subtle deterministic per-pixel jitter prevents 9-tap stepping/ghosting bands on high-contrast pine trees!
            float j = (hash21(gl_FragCoord.xy) - 0.5) * 0.20;
            for (int i = -4; i <= 4; i++) {
              if (i == 0) continue;
              float fi = (float(i) + j) / 4.0;
              vec2 buv = clamp(suv + blurVec * fi, 0.001, 0.999);
              vec4 tap = texture2D(uScene, buv);
              // Reject taps hitting foreground skis/gloves (a = 0.0) while accepting world (0.55) & sky (1.0)!
              float tw = smoothstep(0.14, 0.46, tap.a) * (1.0 - abs(fi) * 0.35);
              acc += tap.rgb * tw;
              wSum += tw;
            }
            vec3 blurred = acc / max(wSum, 0.001);
            // Preserve slight chromatic aberration on extreme corners
            blurred.r = mix(blurred.r, texture2D(uScene, clamp(suv + fromCenter * ca, 0.0, 1.0)).r, 0.25);
            blurred.b = mix(blurred.b, texture2D(uScene, clamp(suv - fromCenter * ca, 0.0, 1.0)).b, 0.25);
            col = mix(baseAA, blurred, worldMask);
          } else {
            col.r = mix(baseAA.r, texture2D(uScene, clamp(suv + fromCenter * ca, 0.0, 1.0)).r, 0.50);
            col.g = baseAA.g;
            col.b = mix(baseAA.b, texture2D(uScene, clamp(suv - fromCenter * ca, 0.0, 1.0)).b, 0.50);
          }

          col += texture2D(uBloom, suv).rgb * uBloomStrength;
          col += sampleGodRays(suv, centerRaw.a);
          col += evalSunFlare(suv, uSunUV, uSunVis, uSunColor);

          // Driving storm snow gusts (3 parallax layers with varied swirl angles — organic blizzard feel!)
          if (uStormStreaks > 0.02) {
            float s1 = drivingSnowLayer(vUv, uTime + 11.0, 11.0, 11.0, 0.24, -0.34);
            float s2 = drivingSnowLayer(vUv, uTime + 47.0, 21.0, 17.0, 0.30, -0.26);
            float s3 = drivingSnowLayer(vUv, uTime + 83.0, 38.0, 24.0, 0.36, -0.41);
            float snow = clamp((s1 * 0.48 + s2 * 0.38 + s3 * 0.28) * uStormStreaks, 0.0, 0.85);
            col = mix(col, vec3(0.92, 0.96, 1.02), snow * 0.78);
          }

          // Subtle peripheral coldsmoke powder mist during deep slashes / landings / wipeouts
          // (keeps center sightline & dark foreground skis razor-clear — never bleaches whole screen white!)
          if (uFaceShot > 0.005) {
            vec2 dv = vUv - 0.5;
            float r = length(dv);
            float rimMask = smoothstep(0.28, 0.74, r);
            if (rimMask > 0.001) {
              float ang = atan(dv.y, dv.x);
              float wisp = 0.58 + 0.42 * sin(ang * 5.0 + uTime * 3.8 + r * 6.5) * cos(ang * 3.0 - uTime * 2.4);
              float fgKeep = mix(0.35, 1.0, smoothstep(0.10, 0.42, centerRaw.a));
              float wash = uFaceShot * rimMask * (0.55 + 0.45 * wisp) * 0.36 * fgKeep;
              col = mix(col, vec3(0.90, 0.94, 1.00), clamp(wash, 0.0, 0.28));
            }
          }

          // Subtle pulsing high-altitude breath fog along lower goggle rim when pausing after a hard pitch!
          if (uBreath > 0.02) {
            float pulse = 0.5 + 0.5 * sin(uTime * 2.2);
            float lowMask = smoothstep(0.26, 0.0, vUv.y) * smoothstep(0.58, 0.14, abs(vUv.x - 0.5));
            col = mix(col, vec3(0.84, 0.90, 0.96), lowMask * uBreath * pulse * 0.14);
          }

          if (uLensWet > 0.02) {
            // Optical droplets in lensDroplets() convey wet lens cleanly; keep edge sheen whisper-subtle (zero milky veil!)
            float rim = smoothstep(0.48, 0.78, length(vUv - 0.5)) * uLensWet * 0.04;
            col = mix(col, vec3(0.86, 0.92, 0.99), rim);
          }

          float vig = 1.0 - smoothstep(0.36, 0.88, length(vUv - 0.5)) * (uBarrel > 0.01 ? 0.22 : 0.13);
          col = acesFilm(col * uExposure * vig);
          col = pow(col, vec3(1.0 / 2.2));
          float dither = (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
          col = clamp(col + dither, 0.0, 1.0);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.compScene = new THREE.Scene();
    this.compScene.add(new THREE.Mesh(quadGeo, this.compMat));
  }

  setMSAA(samples) {
    const target = Math.max(0, Math.min(this.maxHardwareSamples || 0, samples | 0));
    if (target === this.msaaSamples) return;
    this.msaaSamples = target;
    const oldRT = this.sceneRT;
    this.sceneRT = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: this.rtType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: this.msaaSamples,
    });
    if (oldRT) oldRT.dispose();
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.sceneRT.setSize(this.width, this.height);
    const bw = Math.max(1, this.width >> 1);
    const bh = Math.max(1, this.height >> 1);
    this.bloomA.setSize(bw, bh);
    this.bloomB.setSize(bw, bh);
    this.godRayRT.setSize(bw, bh);
    this.brightMat.uniforms.uTexel.value.set(1 / this.width, 1 / this.height);
    this.blurVMat.uniforms.uTexel.value.set(1 / bw, 1 / bh);
    this.godRayMat.uniforms.uAspect.value = this.width / this.height;
    this.compMat.uniforms.uTexel.value.set(1 / this.width, 1 / this.height);
    this.compMat.uniforms.uAspect.value = this.width / this.height;
  }

  render(scene, camera, opts) {
    this.renderer.setRenderTarget(this.sceneRT);
    this.renderer.render(scene, camera);

    const useBloom = !opts.skipBloom && (opts.bloomStrength ?? 0.22) > 0.005;
    if (useBloom) {
      this.brightMat.uniforms.uScene.value = this.sceneRT.texture;
      this.renderer.setRenderTarget(this.bloomA);
      this.renderer.render(this.brightScene, this.orthoCam);

      this.blurVMat.uniforms.uSrc.value = this.bloomA.texture;
      this.renderer.setRenderTarget(this.bloomB);
      this.renderer.render(this.blurVScene, this.orthoCam);
    }

    const grVis = opts.godRayVis ?? 0.0;
    const grStr = opts.godRayStrength ?? 0.55;
    const runGodRays = !opts.skipGodRays && grVis > 0.005 && grStr > 0.005;
    if (runGodRays) {
      const gu = this.godRayMat.uniforms;
      gu.uScene.value = this.sceneRT.texture;
      if (opts.sunUV) gu.uSunUV.value.set(opts.sunUV.x, opts.sunUV.y);
      if (opts.sunColor) gu.uSunColor.value.copy(opts.sunColor);
      gu.uGodRayVis.value = grVis;
      gu.uGodRayStrength.value = grStr;
      this.renderer.setRenderTarget(this.godRayRT);
      this.renderer.render(this.godRayScene, this.orthoCam);
    }

    const u = this.compMat.uniforms;
    u.uScene.value = this.sceneRT.texture;
    u.uBloom.value = this.bloomB.texture;
    u.uGodRays.value = this.godRayRT.texture;
    u.uHasGodRays.value = runGodRays ? 1.0 : 0.0;
    u.uExposure.value = opts.exposure;
    u.uBloomStrength.value = useBloom ? (opts.bloomStrength ?? 0.22) : 0.0;
    u.uBarrel.value = opts.barrel ?? 0.055;
    const allowBlur = !opts.disableMotionBlur;
    u.uSpeedFactor.value = allowBlur ? (opts.speedFactor ?? 0.0) : 0.0;
    if (allowBlur && opts.angVel) u.uAngVel.value.set(opts.angVel.x, opts.angVel.y);
    else u.uAngVel.value.set(0, 0);
    u.uRollVel.value = allowBlur ? (opts.rollVel ?? 0.0) : 0.0;
    if (opts.horizonUV) u.uHorizonUV.value.set(opts.horizonUV.x, opts.horizonUV.y);
    else u.uHorizonUV.value.set(0.5, 0.55);
    if (opts.sunUV) u.uSunUV.value.set(opts.sunUV.x, opts.sunUV.y);
    u.uSunVis.value = opts.sunVis ?? 0.0;
    u.uGodRayVis.value = opts.godRayVis ?? 0.0;
    u.uGodRayStrength.value = opts.godRayStrength ?? 0.55;
    if (opts.sunColor) u.uSunColor.value.copy(opts.sunColor);
    u.uFaceShot.value = opts.faceShot ?? 0.0;
    u.uLensWet.value = opts.lensWet ?? 0.0;
    u.uBreath.value = opts.breath ?? 0.0;
    u.uStormStreaks.value = opts.stormStreaks ?? 0.0;
    u.uTime.value = opts.time ?? 0.0;

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.compScene, this.orthoCam);
  }
}
