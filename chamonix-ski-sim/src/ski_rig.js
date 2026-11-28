/**
 * First-Person Helmet-Cam Full-Body Skier Rig, Articulated 3rd-Person Freeride Skier,
 * Modern Parabolic Twin-Tip Freestyle Skis (156 - 96 - 144 mm, R17, 184 cm) with Dynamic Tip Flex,
 * and Multiplicative HDR Ground-Snapped Hourglass Contact Shadow Ribbons.
 */
import * as THREE from 'three';

/**
 * Mark an opaque foreground skier/ski material so it writes alpha = 0.0 into our RGBA16F HDR buffer.
 * The post-process velocity motion blur uses buffer alpha (`1.0` = moving world, `0.0` = camera-coupled skier/skis)
 * to keep your skis, gloves, poles, and legs razor-sharp while rushing snow & trees streak smoothly past!
 */
// Shared foreground apparel/gear bounce & frost uniforms (keeps dark gloves, cuffs & carbon shafts crisp instead of black silhouettes!)
const fgSharedUniforms = {
  uFgBounceCol: { value: new THREE.Color(0.68, 0.78, 0.94) },
  uFgRimCol:    { value: new THREE.Color(0.86, 0.92, 1.00) },
  uFgBounceAmt: { value: 0.24 },
  uFgFrost:     { value: 0.0 },
};

function markForeground(mat, frostScale = 0.0, sheenAmt = 0.16) {
  mat.customProgramCacheKey = () => 'chamonix_fg_mask_v3';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFgBounceCol = fgSharedUniforms.uFgBounceCol;
    shader.uniforms.uFgRimCol = fgSharedUniforms.uFgRimCol;
    shader.uniforms.uFgBounceAmt = fgSharedUniforms.uFgBounceAmt;
    shader.uniforms.uFgFrost = fgSharedUniforms.uFgFrost;
    shader.uniforms.uFgFrostScale = { value: frostScale };
    shader.uniforms.uFgSheen = { value: sheenAmt };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uFgBounceCol;
        uniform vec3 uFgRimCol;
        uniform float uFgBounceAmt;
        uniform float uFgFrost;
        uniform float uFgFrostScale;
        uniform float uFgSheen;`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 fgUpV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vec3 fgV = normalize(vViewPosition);
        vec3 fgN = normalize(normal);
        float fgDown = clamp(dot(fgN, -fgUpV) * 0.55 + 0.45, 0.0, 1.0);
        float fgUpHem = clamp(dot(fgN, fgUpV) * 0.5 + 0.5, 0.0, 1.0);
        float fgNdotV = max(0.0, dot(fgN, fgV));
        float fgRim = pow(1.0 - fgNdotV, 2.45);
        float fgVelvet = pow(1.0 - fgNdotV, 1.85) * uFgSheen;
        // Realistic snowfield upward bounce + soft sky hemisphere fill + cloth/leather grazing sheen
        // (scales strictly with uFgBounceAmt so shadowed gloves stay rich & tactile in sun, never glow in twilight!)
        vec3 fgBounce = uFgBounceCol * (fgDown * 0.24 + 0.068) + uFgRimCol * (fgUpHem * 0.095 + fgRim * 0.24 + fgVelvet * 0.36);
        gl_FragColor.rgb += fgBounce * uFgBounceAmt * (0.24 + 0.76 * diffuseColor.rgb + vec3(0.14));
        if (uFgFrostScale > 0.001) {
          float fgUp = smoothstep(0.32, 0.85, dot(fgN, fgUpV));
          float fgFrostMix = clamp(fgUp * uFgFrost * uFgFrostScale, 0.0, 0.32);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uFgRimCol * 0.82, fgFrostMix);
        }
        #include <dithering_fragment>
        gl_FragColor.a = 0.0;`
      );
  };
  return mat;
}

/**
 * Dedicated shader for parabolic skis (`skiBlade`):
 *  - Inherits foreground alpha=0.0 (zero motion-blur smear) & snow-bounce / sky-rim lighting
 *  - Adds deliberate, soft-feathered, dynamic deep-powder immersion directly across the topsheet,
 *    sidewalls, and biting edge so skis plunging through fresh snow look softly enveloped in
 *    terrain-matched cold powder (with scrolling advection, cyan subsurface trough AO & crystal
 *    sparkles) instead of jagged 1-pixel Z-buffer polygon clipping!
 */
function markSkiSurface(mat, isLeft) {
  const powderUniforms = {
    uPowSink:     { value: 0.0 },
    uEdgeRoll:    { value: 0.0 },
    uFlowDist:    { value: 0.0 },
    uSideSign:    { value: isLeft ? -1.0 : 1.0 },
    uSnowLitCol:  { value: new THREE.Color(1.0, 1.04, 1.12) },
    uSnowShadCol: { value: new THREE.Color(0.32, 0.45, 0.68) },
    uSnowSSSCol:  { value: new THREE.Color(0.18, 0.50, 0.88) },
    uPowSunVis:   { value: 1.0 },
    uPowStorm:    { value: 0.0 },
  };
  // True optical alpha-dissolve into REAL terrain snow pixels behind the ski:
  //  - RGB:   src * alpha + dst * (1 - alpha)  -> zero hard buried edges, 100% exact lighting/shadow/sparkle match!
  //  - Alpha: 0 * src.a + dst.a * (1 - alpha)  -> emerged tips (alpha=1) write dst.a=0 (sharp foreground);
  //                                               buried waist (alpha=0) preserves dst.a=0.55 (terrain motion blur!)
  mat.transparent = true;
  mat.depthWrite = true;
  mat.blending = THREE.CustomBlending;
  mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = THREE.SrcAlphaFactor;
  mat.blendDst = THREE.OneMinusSrcAlphaFactor;
  mat.blendEquationAlpha = THREE.AddEquation;
  mat.blendSrcAlpha = THREE.ZeroFactor;
  mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;

  mat.customProgramCacheKey = () => 'chamonix_ski_powder_v2';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFgBounceCol = fgSharedUniforms.uFgBounceCol;
    shader.uniforms.uFgRimCol = fgSharedUniforms.uFgRimCol;
    shader.uniforms.uFgBounceAmt = fgSharedUniforms.uFgBounceAmt;
    shader.uniforms.uPowSink = powderUniforms.uPowSink;
    shader.uniforms.uEdgeRoll = powderUniforms.uEdgeRoll;
    shader.uniforms.uFlowDist = powderUniforms.uFlowDist;
    shader.uniforms.uSideSign = powderUniforms.uSideSign;
    shader.uniforms.uSnowLitCol = powderUniforms.uSnowLitCol;
    shader.uniforms.uSnowShadCol = powderUniforms.uSnowShadCol;
    shader.uniforms.uSnowSSSCol = powderUniforms.uSnowSSSCol;
    shader.uniforms.uPowSunVis = powderUniforms.uPowSunVis;
    shader.uniforms.uPowStorm = powderUniforms.uPowStorm;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vSkiUv;
        varying float vSkiLocalY;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSkiUv = uv;
        vSkiLocalY = position.y;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uFgBounceCol;
        uniform vec3 uFgRimCol;
        uniform float uFgBounceAmt;
        uniform float uPowSink;
        uniform float uEdgeRoll;
        uniform float uFlowDist;
        uniform float uSideSign;
        uniform vec3 uSnowLitCol;
        uniform vec3 uSnowShadCol;
        uniform vec3 uSnowSSSCol;
        uniform float uPowSunVis;
        uniform float uPowStorm;
        varying vec2 vSkiUv;
        varying float vSkiLocalY;

        float skiHash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float skiVnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(skiHash21(i), skiHash21(i + vec2(1.0, 0.0)), u.x),
            mix(skiHash21(i + vec2(0.0, 1.0)), skiHash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 fgUpV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        vec3 fgV = normalize(vViewPosition);
        vec3 fgN = normalize(normal);
        float fgDown = clamp(dot(fgN, -fgUpV) * 0.55 + 0.45, 0.0, 1.0);
        float fgRim = pow(1.0 - max(0.0, dot(fgN, fgV)), 2.75);
        vec3 fgLift = uFgBounceCol * (fgDown * 0.16 + 0.036) * uFgBounceAmt + uFgRimCol * (fgRim * 0.22 * uFgBounceAmt);
        gl_FragColor.rgb += fgLift * (0.28 + 0.72 * diffuseColor.rgb + vec3(0.18));

        float emergeAlpha = 1.0;
        if (uPowSink > 0.02) {
          float acrossSigned = vSkiUv.x * 2.0 - 1.0; // -1 left edge .. +1 right edge
          float across = abs(acrossSigned);
          float t = vSkiUv.y; // 0 tail .. 0.44 boot .. 0.84 wide shovel .. 1.0 nose

          // Isotropic world-meter snow-break ripple (gentle organic curve across snow slit — ZERO blotchy dark holes!)
          vec2 pMet = vec2((vSkiUv.x - 0.5) * 0.15 + uSideSign * 0.43, vSkiUv.y * 1.84 + uFlowDist * 0.82);
          float n1 = skiVnoise(pMet * 7.2 + vec2(2.3, -1.7));
          float n2 = skiVnoise(pMet * 19.5 + vec2(5.1, 3.4));
          float n3 = skiVnoise(pMet * 46.0 - vec2(1.9, 2.8));

          // Physical emergence curve along ski: standing/slow (~0.62) -> rockered nose rises cleanly UP out of real snow!
          // Planing fast / leaning back (~0.34) exposes full body; deep stomp / dive (~0.78) leaves upturned tips poking out!
          float sinkNorm = clamp(uPowSink, 0.0, 1.0);
          float emergeT = mix(0.28, 0.80, sinkNorm);
          // Natural parabolic V-arch curve: outer edges & dark sidewall dive slightly earlier into snow than center crown
          float isWall = smoothstep(0.92, 0.995, across) * (1.0 - smoothstep(0.002, 0.012, vSkiLocalY));
          float edgeArch = pow(across, 1.55) * 0.095 + isWall * 0.085;
          // Asymmetric carving roll: biting edge dips deeper under snow while uphill edge lifts cleanly above!
          float edgeTilt = clamp(acrossSigned * uEdgeRoll * 0.145, -0.09, 0.14);
          // Subtle organic drift curve along the parted snow boundary
          float ripple = (n1 - 0.5) * 0.068 + (n2 - 0.5) * 0.028;

          // Positive subDepth = buried beneath the real snow surface; negative = emerged cleanly into open air!
          float subDepth = (emergeT + edgeArch + edgeTilt + ripple) - t;

          // For twin-tip rear tail (t < 0.14): keep tail buried softly along with waist when deep in powder
          float frostWeight = smoothstep(0.0, 0.35, sinkNorm);
          // Smooth optical dissolve directly into the REAL terrain snow behind the ski (1.0 -> 0.0!)
          float softSpan = mix(0.18, 0.27, sinkNorm);
          float vis = 1.0 - smoothstep(0.0, softSpan, subDepth);
          emergeAlpha = mix(1.0, vis, frostWeight);
          if (emergeAlpha < 0.012) discard;

          // Translucent frosted snow veil seen RIGHT THROUGH the shallow 2-8cm snow crust just before vanishing
          // + delicate crystal powder dusting right along the break line (ZERO dark grey blotches!)
          vec3 powVeil = mix(uSnowShadCol, uSnowLitCol, clamp(0.45 + 0.45 * n1, 0.0, 1.0));
          float frostDust = smoothstep(-0.14, 0.02, subDepth) * (1.0 - smoothstep(0.04, 0.18, subDepth))
                          * (0.14 + 0.22 * n2 + 0.16 * pow(across, 1.8)) * frostWeight;
          float shallowScatter = smoothstep(-0.02, softSpan * 0.72, subDepth) * 0.58 * frostWeight;
          // Whisper-soft cool blue-white snow subsurface tint (NO dark mold stain!)
          vec3 coolScatter = mix(powVeil, uSnowShadCol * 0.85 + uSnowSSSCol * 0.40, 0.32 * (1.0 - uPowStorm * 0.7));
          float veilMix = clamp(max(shallowScatter, frostDust), 0.0, 0.72);
          // Tiny sunlit snow crystal sparkle glints kissing the frost dusting rim
          float spark = pow(max(0.0, n3 * n2), 5.6) * (1.0 - uPowStorm * 0.85) * uPowSunVis * frostDust * 2.2;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, coolScatter, veilMix) + uSnowLitCol * spark * 0.35;
          // Extremely subtle 8% cool AO whisper right along the snow entry crease for 3D depth
          float slitAO = smoothstep(-0.025, 0.015, subDepth) * (1.0 - smoothstep(0.025, 0.085, subDepth));
          gl_FragColor.rgb *= (1.0 - slitAO * 0.08 * frostWeight);
        }
        #include <dithering_fragment>
        gl_FragColor.a = emergeAlpha;`
      );
  };
  return { mat, powderUniforms };
}

/** Procedural 512×512 3-layer hardshell micro-ripstop weave + diagonal twill + cloth folds & frost sheen! */
function buildRipstopTextures(baseRgb = [255, 255, 255], frostBias = 0.0, repeatN = 4) {
  const S = 512;
  const albC = document.createElement('canvas');
  albC.width = S; albC.height = S;
  const aCtx = albC.getContext('2d');
  const aImg = aCtx.createImageData(S, S);

  const bumpC = document.createElement('canvas');
  bumpC.width = S; bumpC.height = S;
  const bCtx = bumpC.getContext('2d');
  const bImg = bCtx.createImageData(S, S);

  const roughC = document.createElement('canvas');
  roughC.width = S; roughC.height = S;
  const rCtx = roughC.getContext('2d');
  const rImg = rCtx.createImageData(S, S);

  const TAU = Math.PI * 2 / S;
  for (let y = 0; y < S; y++) {
    const ty = y * TAU;
    const ripY = (y % 16 === 0 || y % 16 === 1) ? 1.0 : ((y % 8 === 0) ? 0.45 : 0.0);
    for (let x = 0; x < S; x++) {
      const tx = x * TAU;
      // 80D 3L hardshell micro-ripstop grid (16px primary + 8px secondary reinforcement threads + 2px micro weave)
      const ripX = (x % 16 === 0 || x % 16 === 1) ? 1.0 : ((x % 8 === 0) ? 0.45 : 0.0);
      const rip = Math.max(ripX, ripY);
      const weave = (((x >> 1) + (y >> 1)) & 1) ? 0.42 : -0.36;
      const twill = ((x + y) % 4 < 2) ? 0.30 : -0.25;
      // Seamless periodic soft cloth fold creases across the shell panel
      const fold =
        Math.sin(tx * 2.0 + ty * 1.0 + Math.cos(ty * 2.0) * 0.6) * 0.48 +
        Math.cos(tx * 1.0 - ty * 3.0 + 1.4) * 0.34 +
        Math.sin(tx * 4.0 + ty * 3.0 - 0.9) * 0.18;
      // Fine deterministic hydrophobic DWR micro-grain
      const micro = (((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) + 1) % 1;
      const h = Math.max(0, Math.min(255, Math.round(
        128 + (ripX + ripY) * 26 + weave * 11 + twill * 7 + fold * 38 + (micro - 0.5) * 12
      )));
      const frostRaw = Math.sin(tx * 2.0 + 0.8) * Math.cos(ty * 2.0 - 0.4) + Math.sin(tx * 5.0 - ty * 4.0) * 0.35;
      const frost = frostBias > 0 ? Math.max(0, frostRaw - 0.44) * frostBias : 0;
      const shade = 0.94 + fold * 0.075 + (rip > 0.6 ? -0.055 : 0.015) + weave * 0.018 + (micro - 0.5) * 0.02;
      // Ripstop threads catch slightly crisper matte sheen than weave troughs
      const rg = Math.max(105, Math.min(248, Math.round(182 - (ripX + ripY) * 16 + fold * 16 - weave * 6 + frost * 40)));
      const k = (y * S + x) * 4;
      aImg.data[k]     = Math.max(0, Math.min(255, Math.round(baseRgb[0] * shade * (1 - frost * 0.40) + 235 * frost * 0.40)));
      aImg.data[k + 1] = Math.max(0, Math.min(255, Math.round(baseRgb[1] * shade * (1 - frost * 0.40) + 242 * frost * 0.40)));
      aImg.data[k + 2] = Math.max(0, Math.min(255, Math.round(baseRgb[2] * shade * (1 - frost * 0.40) + 252 * frost * 0.40)));
      aImg.data[k + 3] = 255;
      bImg.data[k] = bImg.data[k + 1] = bImg.data[k + 2] = h;
      bImg.data[k + 3] = 255;
      rImg.data[k] = rImg.data[k + 1] = rImg.data[k + 2] = rg;
      rImg.data[k + 3] = 255;
    }
  }
  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(albC);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatN, repeatN);
  map.anisotropy = 8;
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpC);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeatN, repeatN);
  bumpMap.anisotropy = 8;
  bumpMap.needsUpdate = true;

  const roughMap = new THREE.CanvasTexture(roughC);
  roughMap.wrapS = roughMap.wrapT = THREE.RepeatWrapping;
  roughMap.repeat.set(repeatN, repeatN);
  roughMap.anisotropy = 8;
  roughMap.needsUpdate = true;
  return { map, bumpMap, roughMap };
}

/** Procedural 256×256 full PBR oiled goat-leather (freeride alpine leather glove) albedo + cellular pebble bump + roughness! */
function buildLeatherTextures(baseRgb = [190, 132, 78], wornRgb = [132, 82, 44], repeatN = 2.5) {
  const S = 256;
  const albC = document.createElement('canvas');
  albC.width = S; albC.height = S;
  const aCtx = albC.getContext('2d');
  const aImg = aCtx.createImageData(S, S);

  const bumpC = document.createElement('canvas');
  bumpC.width = S; bumpC.height = S;
  const bCtx = bumpC.getContext('2d');
  const bImg = bCtx.createImageData(S, S);

  const roughC = document.createElement('canvas');
  roughC.width = S; roughC.height = S;
  const rCtx = roughC.getContext('2d');
  const rImg = rCtx.createImageData(S, S);

  // Tileable cellular Voronoi-like pebbled goat-leather seed points (36×36 coarse grid)
  const GRID = 32;
  const jx = new Float32Array(GRID * GRID);
  const jy = new Float32Array(GRID * GRID);
  for (let i = 0; i < GRID * GRID; i++) {
    const s1 = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    const s2 = Math.sin(i * 269.5 + 183.3) * 43758.5453;
    jx[i] = 0.18 + 0.64 * (s1 - Math.floor(s1));
    jy[i] = 0.18 + 0.64 * (s2 - Math.floor(s2));
  }

  const TAU = Math.PI * 2 / S;
  for (let y = 0; y < S; y++) {
    const gy = (y / S) * GRID;
    const iy = Math.floor(gy);
    const ty = y * TAU;
    for (let x = 0; x < S; x++) {
      const gx = (x / S) * GRID;
      const ix = Math.floor(gx);
      const tx = x * TAU;
      let d1 = 9.0, d2 = 9.0;
      for (let oy = -1; oy <= 1; oy++) {
        const ny = (iy + oy + GRID) % GRID;
        for (let ox = -1; ox <= 1; ox++) {
          const nx = (ix + ox + GRID) % GRID;
          const idx = ny * GRID + nx;
          const dx = (ix + ox + jx[idx]) - gx;
          const dy = (iy + oy + jy[idx]) - gy;
          const d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; }
          else if (d < d2) { d2 = d; }
        }
      }
      // Edge ridge distance gives crisp narrow pebble valleys & plump pillowy leather grains!
      const edgeD = Math.sqrt(d2) - Math.sqrt(d1);
      const pebble = Math.min(1.0, edgeD * 2.6);
      // Organic skin flexion creases (crossing stretch lines from wearing ski gloves!)
      const crease1 = Math.abs(Math.sin(tx * 3.0 + ty * 2.0 + Math.sin(ty * 4.0) * 0.45));
      const crease2 = Math.abs(Math.sin(tx * 5.0 - ty * 3.0 + Math.cos(tx * 3.0) * 0.35));
      const creaseDip = Math.pow(crease1, 0.35) * 0.65 + Math.pow(crease2, 0.40) * 0.35;
      // Macro oil-wax patina mottling (warm burnished sheen on high spots!)
      const patina = 0.5 + 0.30 * Math.sin(tx * 1.0 + ty * 2.0) + 0.20 * Math.cos(tx * 2.0 - ty * 1.0 + 0.7);
      const micro = (((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) + 1) % 1;

      const grainHeight = pebble * 0.72 + creaseDip * 0.28;
      const h = Math.max(0, Math.min(255, Math.round(70 + grainHeight * 150 + (micro - 0.5) * 14)));
      // Deep grooves darker (oiled wax darkening in crevices); raised pebble tops warm & slightly lighter
      const tCol = Math.max(0, Math.min(1, grainHeight * 0.78 + patina * 0.22));
      const k = (y * S + x) * 4;
      aImg.data[k]     = Math.max(0, Math.min(255, Math.round((wornRgb[0] * (1 - tCol) + baseRgb[0] * tCol) * (0.94 + micro * 0.08))));
      aImg.data[k + 1] = Math.max(0, Math.min(255, Math.round((wornRgb[1] * (1 - tCol) + baseRgb[1] * tCol) * (0.94 + micro * 0.08))));
      aImg.data[k + 2] = Math.max(0, Math.min(255, Math.round((wornRgb[2] * (1 - tCol) + baseRgb[2] * tCol) * (0.94 + micro * 0.08))));
      aImg.data[k + 3] = 255;
      bImg.data[k] = bImg.data[k + 1] = bImg.data[k + 2] = h;
      bImg.data[k + 3] = 255;
      // Burnished oiled leather tops are satin-smooth (~0.42), valley grooves are matte (~0.82)
      const rg = Math.max(92, Math.min(228, Math.round(212 - pebble * 78 - patina * 32 + (micro - 0.5) * 10)));
      rImg.data[k] = rImg.data[k + 1] = rImg.data[k + 2] = rg;
      rImg.data[k + 3] = 255;
    }
  }
  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(albC);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repeatN, repeatN);
  map.anisotropy = 8;
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpC);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(repeatN, repeatN);
  bumpMap.anisotropy = 8;
  bumpMap.needsUpdate = true;

  const roughMap = new THREE.CanvasTexture(roughC);
  roughMap.wrapS = roughMap.wrapT = THREE.RepeatWrapping;
  roughMap.repeat.set(repeatN, repeatN);
  roughMap.anisotropy = 8;
  roughMap.needsUpdate = true;
  return { map, bumpMap, roughMap };
}

/** Procedural 128×128 woven herringbone nylon webbing texture for pole straps, Velcro tabs & pack harness! */
function buildWebbingTextures(baseRgb = [38, 44, 54], accentRgb = [78, 86, 98]) {
  const S = 128;
  const albC = document.createElement('canvas');
  albC.width = S; albC.height = S;
  const aCtx = albC.getContext('2d');
  const aImg = aCtx.createImageData(S, S);
  const bumpC = document.createElement('canvas');
  bumpC.width = S; bumpC.height = S;
  const bCtx = bumpC.getContext('2d');
  const bImg = bCtx.createImageData(S, S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Classic herringbone chevron twill weave + crisp stitched border rib
      const col = Math.floor(x / 16) % 2;
      const phase = col === 0 ? (x + y) : (x - y + 256);
      const rib = Math.sin(phase * 0.785) * 0.5 + 0.5;
      const border = (x < 7 || x > S - 8) ? 1.0 : 0.0;
      const t = Math.min(1, rib * 0.75 + border * 0.25);
      const k = (y * S + x) * 4;
      aImg.data[k]     = Math.round(baseRgb[0] * (1 - t * 0.45) + accentRgb[0] * (t * 0.45));
      aImg.data[k + 1] = Math.round(baseRgb[1] * (1 - t * 0.45) + accentRgb[1] * (t * 0.45));
      aImg.data[k + 2] = Math.round(baseRgb[2] * (1 - t * 0.45) + accentRgb[2] * (t * 0.45));
      aImg.data[k + 3] = 255;
      const bh = Math.round(85 + rib * 130 + border * 25);
      bImg.data[k] = bImg.data[k + 1] = bImg.data[k + 2] = Math.min(255, bh);
      bImg.data[k + 3] = 255;
    }
  }
  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  const map = new THREE.CanvasTexture(albC);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 6);
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;
  const bumpMap = new THREE.CanvasTexture(bumpC);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(1, 6);
  bumpMap.needsUpdate = true;
  return { map, bumpMap };
}

/** Procedural diagonal carbon-fiber weave texture for ski poles! */
function buildCarbonBump() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const w = (((x + y) >> 1) & 1) ? 165 : 95;
      const k = (y * S + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = w;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 24);
  tex.needsUpdate = true;
  return tex;
}

const SKI_LEN = 1.84;
const BOOT_T = 0.44;
const SKI_SEP = 0.192; // ±0.192m = 38.4cm center-to-center (21.2cm snow gap at wide 172mm shovels, flaring to 29.6cm hourglass window at 88mm waists!)

/**
 * Modern parabolic twin-tip freestyle half-width (meters) for t in [0, 1] (0 = tail, 1 = tip).
 * Perspective-calibrated for 86° wide-angle FOV (which compresses distal tip width by ~21%):
 *  - Pinched carving waist at t=0.44: 88 mm (halfW 0.044)
 *  - Wide flared front shovel at t=0.84: 172 mm (halfW 0.086 -> ~1.95× raw ratio, ~1.54× visually on-screen!)
 *  - Wide flared twin-tip tail at t=0.14: 156 mm (halfW 0.078)
 *  - Broad super-elliptical blunt rounded spoon twin-tip caps (zero 1980s pointy needle tips!).
 */
function rawSkiHalfWidth(t) {
  const halfWaist = 0.044; // 88 mm sharply pinched modern freestyle waist
  const halfTip = 0.086;   // 172 mm bold flared wide powder shovel
  const halfTail = 0.078;  // 156 mm wide twin-tip switch tail

  if (t >= 0.84) {
    const s = THREE.MathUtils.clamp((t - 0.84) / 0.16, 0, 1);
    // Broad rounded twin-tip spoon cap (stays wide ~88% across nose before gently rounding to ~40mm blunt TPU nose!)
    const cap = Math.pow(Math.max(0.0, 1.0 - Math.pow(s, 3.0)), 0.38);
    return Math.max(0.020, halfTip * cap);
  }
  if (t <= 0.14) {
    const s = THREE.MathUtils.clamp((0.14 - t) / 0.14, 0, 1);
    const cap = Math.pow(Math.max(0.0, 1.0 - Math.pow(s, 2.85)), 0.38);
    return Math.max(0.018, halfTail * cap);
  }
  if (t >= BOOT_T) {
    // Sweeping parabolic hourglass sidecut curving sharply out from pinched 88mm waist to wide 172mm shovel!
    const u = (t - BOOT_T) / (0.84 - BOOT_T);
    return halfWaist + (halfTip - halfWaist) * Math.pow(u, 1.52);
  }
  const u = (BOOT_T - t) / (BOOT_T - 0.14);
  return halfWaist + (halfTail - halfWaist) * Math.pow(u, 1.52);
}

// Smooth CNC-milled ski edge contour (5-point kernel smoothing over shoulder transitions at t=0.14 and t=0.84)
export function evalSkiHalfWidth(t) {
  const tc = THREE.MathUtils.clamp(t, 0, 1);
  if (tc < 0.015 || tc > 0.985) return rawSkiHalfWidth(tc);
  const dt = 0.022;
  const w0 = rawSkiHalfWidth(Math.max(0, tc - dt * 2));
  const w1 = rawSkiHalfWidth(Math.max(0, tc - dt));
  const w2 = rawSkiHalfWidth(tc);
  const w3 = rawSkiHalfWidth(Math.min(1, tc + dt));
  const w4 = rawSkiHalfWidth(Math.min(1, tc + dt * 2));
  // Preserve peak sharpness near extreme tip/tail closure while eliminating sharp shoulder elbows at 0.14 / 0.84!
  const capMask = (tc > 0.92 || tc < 0.08) ? 0.25 : 1.0;
  const smooth = (w0 * 0.08 + w1 * 0.22 + w2 * 0.40 + w3 * 0.22 + w4 * 0.08);
  return THREE.MathUtils.lerp(w2, smooth, capMask);
}

function evalRockerY(t) {
  // Progressive early-rise twin-tip rocker (sleek low snow-hugging freestyle profile!)
  const tipCurve = t > 0.72 ? Math.pow((t - 0.72) / 0.28, 2.18) * 0.092 : 0;
  const tailCurve = t < 0.19 ? Math.pow((0.19 - t) / 0.19, 2.08) * 0.052 : 0;
  const camber = Math.sin(t * Math.PI) * 0.006;
  return tipCurve + tailCurve + camber;
}

function buildSkiTSamples() {
  // Non-uniform longitudinal spacing: dense along rounded nose & tail spoon caps for silky smooth arcs!
  const ts = [];
  const nTail = 12;
  const nMid = 28;
  const nNose = 14;
  for (let i = 0; i < nTail; i++) {
    const f = i / nTail;
    // Cluster extra slices near t=0 where rounding curvature is highest
    ts.push(0.14 * (1 - Math.cos(f * Math.PI * 0.5)));
  }
  for (let i = 0; i < nMid; i++) {
    ts.push(0.14 + (0.84 - 0.14) * (i / nMid));
  }
  for (let i = 0; i <= nNose; i++) {
    const f = i / nNose;
    ts.push(0.84 + (1.0 - 0.84) * Math.sin(f * Math.PI * 0.5));
  }
  ts[0] = 0.0;
  ts[ts.length - 1] = 1.0;
  return ts;
}

function createSkiMesh(isLeft, skiTopsheetTex = null) {
  const g = new THREE.Group();

  const tSamples = buildSkiTSamples();
  const nRows = tSamples.length;
  const pos = [];
  const uvs = [];
  const norm = [];
  const col = [];
  const indices = [];
  const baseY = [];
  const tVals = [];

  for (let i = 0; i < nRows; i++) {
    const t = tSamples[i]; // 0 = tail, 1 = tip (forward is -Z in local rig space!)
    const z = (BOOT_T - t) * SKI_LEN;
    const y = evalRockerY(t);
    const w = evalSkiHalfWidth(t);

    // Subtle 3D HRZN spoon bevel on wide rockered tip & tail (outer edges lift slightly for surfy powder float!)
    const tipBevel = t > 0.78 ? Math.pow((t - 0.78) / 0.22, 1.6) * 0.005 : 0;
    const tailBevel = t < 0.16 ? Math.pow((0.16 - t) / 0.16, 1.6) * 0.003 : 0;
    const spoonEdge = tipBevel + tailBevel;

    // Solid dark ABS ski sidewalls extend cleanly down into the snow along the planted waist (t=0.16..0.74)
    // and taper sleekly (1.1cm thick) beneath the upturned rockered twin-tip shovels so zero floating air gap EVER appears!
    const waistMask = (t >= 0.16 && t <= 0.74)
      ? 1.0
      : (t > 0.74 ? Math.max(0, 1.0 - (t - 0.74) / 0.11) : Math.max(0, (t - 0.05) / 0.11));
    const wallBot = -0.006 - waistMask * 0.038;

    // Taper top thickness slightly toward thin flexible rockered spoon tips (real woodcore thickness profile!)
    const coreThick = 0.012 + 0.007 * Math.sin(t * Math.PI);
    const bevelTop = coreThick * 0.50;

    // 6-vertex cross-section per slice: [botL, edgeL, topL, topR, edgeR, botR]
    const xs = [-w, -w, -w * 0.87, w * 0.87, w, w];
    // Strictly unmirrored UVs so "CHAMONIX · 96" & "156 · 96 · 144 mm R17" read left-to-right cleanly on BOTH skis!
    const us = [0.0, 0.0, 0.056, 0.944, 1.0, 1.0];
    const thick = [wallBot + spoonEdge, bevelTop + spoonEdge, coreThick, coreThick, bevelTop + spoonEdge, wallBot + spoonEdge];

    for (let j = 0; j < 6; j++) {
      const vy = y + thick[j];
      pos.push(xs[j], vy, z);
      baseY.push(vy);
      tVals.push(t);
      uvs.push(us[j], t);
      norm.push(
        j === 0 ? -0.96 : (j === 1 ? -0.45 : (j === 4 ? 0.45 : (j === 5 ? 0.96 : 0))),
        (j === 0 || j === 5) ? 0.08 : 0.95,
        t > 0.76 ? 0.35 : (t < 0.18 ? -0.25 : 0)
      );
      if (j === 0 || j === 5) {
        col.push(0.12, 0.14, 0.18); // dark matte ABS sidewall biting cleanly down into snow
      } else if (j === 1 || j === 4) {
        col.push(0.86, 0.90, 0.96); // subtle metallic steel edge bevel highlight
      } else {
        col.push(1.0, 1.0, 1.0);
      }
    }
    if (i < nRows - 1) {
      const r0 = i * 6;
      const r1 = (i + 1) * 6;
      for (let j = 0; j < 5; j++) {
        // Outward-facing CCW normals (+Y topsheet, -X left wall, +X right wall) so FrontSide renders cleanly w/ zero double-blend!
        indices.push(r0 + j, r0 + j + 1, r1 + j);
        indices.push(r0 + j + 1, r1 + j + 1, r1 + j);
      }
    }
  }

  // Close blunt rounded TPU bumper end-caps cleanly at tail (+Z outward) and nose (-Z outward)
  const capTail = 0;
  indices.push(capTail + 0, capTail + 5, capTail + 1);
  indices.push(capTail + 1, capTail + 5, capTail + 4);
  indices.push(capTail + 1, capTail + 4, capTail + 2);
  indices.push(capTail + 2, capTail + 4, capTail + 3);

  const capNose = (nRows - 1) * 6;
  indices.push(capNose + 0, capNose + 1, capNose + 5);
  indices.push(capNose + 1, capNose + 4, capNose + 5);
  indices.push(capNose + 1, capNose + 2, capNose + 4);
  indices.push(capNose + 2, capNose + 3, capNose + 4);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const { mat, powderUniforms } = markSkiSurface(new THREE.MeshStandardMaterial({
    map: skiTopsheetTex || null,
    vertexColors: true,
    roughness: 0.25,
    metalness: 0.28,
    side: THREE.FrontSide,
  }), isLeft);
  const skiBlade = new THREE.Mesh(geo, mat);
  skiBlade.castShadow = true;
  skiBlade.receiveShadow = true;
  skiBlade.renderOrder = 3;
  g.add(skiBlade);

  // Contoured snow dusting clump hugging the parabolic flared front shovel (t = 0.56..0.90)
  const dSegs = 12;
  const dPos = [];
  const dIdx = [];
  const dBaseY = [];
  const dTVals = [];
  for (let i = 0; i <= dSegs; i++) {
    const f = i / dSegs;
    const t = 0.56 + f * 0.34;
    const z = (BOOT_T - t) * SKI_LEN;
    const w = evalSkiHalfWidth(t) * (0.72 * Math.sin(f * Math.PI) + 0.14);
    const yBase = evalRockerY(t) + 0.019;
    const dome = Math.sin(f * Math.PI) * 0.011;
    const xs = [-w, 0, w];
    const ys = [yBase, yBase + dome, yBase];
    for (let j = 0; j < 3; j++) {
      dPos.push(xs[j], ys[j], z);
      dBaseY.push(ys[j]);
      dTVals.push(t);
    }
    if (i < dSegs) {
      const r0 = i * 3, r1 = (i + 1) * 3;
      dIdx.push(r0, r1, r0 + 1, r0 + 1, r1, r1 + 1);
      dIdx.push(r0 + 1, r1 + 1, r0 + 2, r0 + 2, r1 + 1, r1 + 2);
    }
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dPos, 3));
  dustGeo.setIndex(dIdx);
  dustGeo.computeVertexNormals();
  const dustMat = new THREE.MeshStandardMaterial({
    color: 0xf4f8fc,
    roughness: 0.92,
    metalness: 0.0,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  const dustMesh = new THREE.Mesh(dustGeo, dustMat);
  dustMesh.receiveShadow = true;
  dustMesh.renderOrder = 4;
  g.add(dustMesh);

  // --- 3D DYNAMIC POWDER BOW-WAVE SNOW WASH (two sculpted curling wave sheets over parabolic shovel!) ---
  const bRows = 16;
  const bCols = 8; // cross-section ribs from left curling crest (-1) across shovel (0) to right curling crest (+1)
  const bPos = [];
  const bUv = [];
  const bLayer = [];
  const bBaseY = [];
  const bIdx = [];
  const appendBowSheet = (layerIdx, hScale, wExtra, yLiftBase) => {
    const baseV = bPos.length / 3;
    for (let i = 0; i <= bRows; i++) {
      const f = i / bRows; // 0 = rear fade behind toe binding (t=0.32), 1 = leading shovel prow (t=1.02)
      const t = 0.32 + f * 0.70;
      const z = (BOOT_T - t) * SKI_LEN;
      const tClamp = THREE.MathUtils.clamp(t, 0, 1);
      const rockY = evalRockerY(tClamp);
      const skiHW = evalSkiHalfWidth(tClamp);
      // Longitudinal envelope peaks gracefully across mid-body & rockered shovel curve (t=0.52..0.94)
      const env = Math.sin(Math.pow(f, 0.76) * Math.PI);
      const flareOut = skiHW * (1.12 + env * 1.48) + wExtra * env;
      for (let j = 0; j <= bCols; j++) {
        const s = (j / bCols) * 2.0 - 1.0; // -1..+1 across ski width
        const absS = Math.abs(s);
        // Sculpted curling U-crest: low frothy sheet right over shovel centerline, sweeping UP & OUTWARD into breaking powder lips!
        const x = s * flareOut;
        const curlRise = Math.pow(absS, 1.55) * (0.14 + 0.13 * env) * hScale;
        const centerDome = (1.0 - absS * absS) * (0.028 + 0.045 * env) * hScale;
        const prowLift = Math.pow(f, 2.2) * 0.042 * hScale;
        const y = rockY + yLiftBase + centerDome + curlRise + prowLift;
        // Sweep outer curling lip slightly backward like water/snow parting off a bow
        const zSweep = z + absS * absS * env * 0.18 * (1.0 + layerIdx * 0.35);
        bPos.push(x, y, zSweep);
        bUv.push(j / bCols, f);
        bLayer.push(layerIdx, absS, env);
        bBaseY.push(rockY + 0.008);
      }
      if (i < bRows) {
        const r0 = baseV + i * (bCols + 1);
        const r1 = baseV + (i + 1) * (bCols + 1);
        for (let j = 0; j < bCols; j++) {
          bIdx.push(r0 + j, r1 + j, r0 + j + 1);
          bIdx.push(r0 + j + 1, r1 + j, r1 + j + 1);
        }
      }
    }
  };
  // Inner dense shovel wash cushion + outer higher translucent curling coldsmoke lip!
  appendBowSheet(0.0, 0.85, 0.09, 0.018);
  appendBowSheet(1.0, 1.42, 0.21, 0.036);

  const bowGeo = new THREE.BufferGeometry();
  bowGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
  bowGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bUv, 2));
  bowGeo.setAttribute('aBow', new THREE.Float32BufferAttribute(bLayer, 3));
  bowGeo.setAttribute('aBaseY', new THREE.Float32BufferAttribute(bBaseY, 1));
  bowGeo.setIndex(bIdx);
  bowGeo.computeVertexNormals();

  const bowUniforms = {
    uTime: { value: 0 },
    uFlowDist: { value: 0 },
    uIntensity: { value: 0 },
    uNestAmt: { value: 0 },
    uEdgeBias: { value: 0 },
    uSkiRoll: { value: 0 },
    uSideSign: { value: isLeft ? -1.0 : 1.0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.5) },
    uSunColor: { value: new THREE.Color(1.0, 0.94, 0.85) },
    uSunIntensity: { value: 2.2 },
    uShadowSky: { value: new THREE.Color(0.32, 0.50, 0.78) },
    uShadowFill: { value: 0.70 },
    uSnowLitCol: { value: new THREE.Color(0.85, 0.90, 0.98) },
    uSnowShadCol: { value: new THREE.Color(0.30, 0.44, 0.66) },
    uSnowSSSCol: { value: new THREE.Color(0.14, 0.44, 0.82) },
    uStorm: { value: 0.0 },
    uSunVis: { value: 1.0 },
  };
  const bowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    uniforms: bowUniforms,
    vertexShader: /* glsl */ `
      attribute vec3 aBow; // x=layer (0 inner, 1 outer lip), y=absS (0 center..1 edge), z=env
      attribute float aBaseY;
      uniform float uTime;
      uniform float uFlowDist;
      uniform float uIntensity;
      uniform float uNestAmt;
      uniform float uEdgeBias;
      uniform float uSkiRoll;
      uniform float uSideSign;
      varying vec2 vUv;
      varying vec3 vBow;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vBow = aBow;
        float surge = clamp(uIntensity, 0.0, 1.25);
        float bowAmt = max(surge, uNestAmt * 0.44);
        vec3 p = position;
        // Calm banked snow-trough pillow when stationary/slow in powder; dynamic surging curls at speed!
        float wave1 = sin(uv.y * 14.0 + uFlowDist * 1.85 + aBow.y * 5.0 + uSideSign * 1.7);
        float wave2 = cos(uv.y * 23.0 + uFlowDist * 2.40 - uv.x * 9.0);
        float swell = (0.08 + 0.92 * surge) * aBow.z;
        float sidePush = (uv.x * 2.0 - 1.0);
        p.x *= mix(0.56, 1.15, bowAmt);
        p.x += (-uEdgeBias * 0.14) * aBow.y * aBow.z * surge;
        // Scale ONLY height above the rockered ski curve so snow collar stays strictly seated at the tip too!
        float waveH = p.y - aBaseY;
        float yScale = mix(mix(0.12, 0.22, uNestAmt), 1.05, clamp(surge, 0.0, 1.0));
        p.y = aBaseY + waveH * yScale + (wave1 * 0.020 + wave2 * 0.011) * aBow.y * swell * (1.0 + aBow.x * 0.45);
        // Counter-tilt outer snow collar back toward terrain slope plane when ski rolls steeply on edge!
        float rClamp = clamp(uSkiRoll, -0.96, 0.96);
        float wingWeight = smoothstep(0.16, 0.62, aBow.y);
        float biteGain = (p.x * (-rClamp)) > 0.0 ? 1.08 : 0.92;
        p.y += (-p.x * tan(rClamp)) * biteGain * wingWeight;
        p.z += wave1 * 0.022 * aBow.y * swell;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normalize(normal + vec3(sidePush * 0.35, 0.55, 0.18)));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uFlowDist;
      uniform float uIntensity;
      uniform float uNestAmt;
      uniform float uSideSign;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform vec3 uShadowSky;
      uniform float uShadowFill;
      uniform vec3 uSnowLitCol;
      uniform vec3 uSnowShadCol;
      uniform vec3 uSnowSSSCol;
      uniform float uStorm;
      uniform float uSunVis;
      varying vec2 vUv;
      varying vec3 vBow;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
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
      void main() {
        float spray = clamp(uIntensity, 0.0, 1.0);
        float bowAmt = max(spray, uNestAmt * 0.52);
        if (bowAmt < 0.02) discard;
        // Hide outer tall spray curl layer when only nesting slowly in static powder so zero floating mist halo!
        if (vBow.x > 0.5 && uIntensity < 0.12) discard;
        float across = abs(vUv.x * 2.0 - 1.0);
        float edgeFade = 1.0 - smoothstep(0.62, 0.99, across);
        float longFade = smoothstep(0.04, 0.22, vUv.y) * (1.0 - smoothstep(0.84, 0.99, vUv.y));
        // Keep central ski topsheet COMPLETELY clear so powder parts cleanly AROUND the ski flanks (ZERO milky veil over graphics!)
        float wingFocus = smoothstep(0.26, 0.58, across);
        float layerGain = vBow.x > 0.5 ? spray : clamp(bowAmt, 0.0, 1.0);
        float envAlpha = edgeFade * longFade * wingFocus * layerGain;
        if (envAlpha < 0.02) discard;

        // Fast isotropic 2-octave turbulent billowing coldsmoke noise coupled to actual ski travel distance (still when stopped!)
        vec2 flowUv = vec2(vUv.x * 3.6 + uSideSign * 1.9, vUv.y * 9.8 + uFlowDist * 0.85);
        float n1 = vnoise(flowUv);
        float n2 = vnoise(flowUv * 2.15 + vec2(3.7 + n1 * 0.75, uFlowDist * 0.35));
        float cloud = smoothstep(0.22, 0.82, n1 * 0.62 + n2 * 0.44);

        // Ultra-gentle velvety bank opacity when standing still (preserves real skier shadow!), rich curling wave when ripping!
        float layerAlpha = mix(mix(0.24, 0.56, clamp(spray * 1.8, 0.0, 1.0)), 0.38, vBow.x);
        float alpha = cloud * envAlpha * layerAlpha;
        if (alpha < 0.015) discard;

        // Exact terrain-matched HDR snow color (eliminates bright white halo caused by upturned normal facing low sun!)
        vec3 N = normalize(vWorldNormal);
        vec3 L = normalize(uSunDir);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float directVis = uSunVis * (1.0 - uStorm * 0.85);
        float sunSculpt = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        // Subtle 3D pillow relief: static collar stays 1:1 with slope snow; active airborne spray catches bright sunlit rim!
        float crestMix = mix(0.45 + 0.40 * n1, clamp(0.35 + 0.45 * n1 + 0.28 * sunSculpt, 0.0, 1.0), spray);
        vec3 baseCol = mix(uSnowShadCol, uSnowLitCol, crestMix) * (0.94 + 0.10 * (n2 - 0.5));
        // Subtle glacial blue trough shading right next to ski sidewall where snow banks against the edge
        float innerRim = (1.0 - smoothstep(0.30, 0.62, across)) * (1.0 - uStorm * 0.75);
        baseCol = mix(baseCol, uSnowShadCol * 0.78 + uSnowSSSCol * 0.35, innerRim * 0.38);
        // Airborne sunlit forward-scatter mist glow ONLY when moving fast (spray > 0.15)!
        float backScatter = pow(max(0.0, dot(-V, L)), 2.8) * directVis * spray;
        float rim = smoothstep(0.35, 0.75, across) * (1.0 - cloud * 0.5) * spray;
        baseCol += uSunColor * rim * (0.10 + 0.34 * backScatter) * directVis;

        gl_FragColor = vec4(baseCol, clamp(alpha, 0.0, 0.72));
      }
    `,
  });
  const bowWaveMesh = new THREE.Mesh(bowGeo, bowMat);
  bowWaveMesh.renderOrder = 5;
  bowWaveMesh.visible = false;
  g.add(bowWaveMesh);

  // --- SLEEK MODERN FREERIDE BINDINGS (Look Pivot / Marker Duke PT proportions seated over pinched 88mm waist!) ---
  const bindMat = markForeground(new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.36, metalness: 0.56 }));
  const gunmetalMat = markForeground(new THREE.MeshStandardMaterial({ color: 0x343c47, roughness: 0.28, metalness: 0.76 }));
  const steelMat = markForeground(new THREE.MeshStandardMaterial({ color: 0xb0bac8, roughness: 0.20, metalness: 0.90 }));
  const coralMetalMat = markForeground(new THREE.MeshStandardMaterial({ color: 0xdf4a26, roughness: 0.28, metalness: 0.60 }));
  const rubberMat = markForeground(new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.86, metalness: 0.04 }));

  // Low-profile AFD toe plate sitting flush inside 88mm pinched waist (width 66mm -> leaves steel edge curves visibly flanking binding!)
  const toePlate = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.015, 0.125), bindMat);
  toePlate.position.set(0, 0.025, -0.152);
  g.add(toePlate);

  // Tapered sculptural toe turret housing
  const toeTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.034, 10), gunmetalMat);
  toeTurret.position.set(0, 0.044, -0.180);
  g.add(toeTurret);

  // Angled twin metallic toe wings cradling boot toe welt
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.024, 0.062), steelMat);
    wing.position.set(s * 0.033, 0.044, -0.152);
    wing.rotation.y = s * 0.28;
    g.add(wing);
  }
  const toeLever = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.013, 0.038), coralMetalMat);
  toeLever.position.set(0, 0.054, -0.204);
  toeLever.rotation.x = 0.32;
  g.add(toeLever);

  // Turntable Pivot Heel Tower + metallic dual ski-brake arms tucked cleanly along pinched 96mm waist!
  const heelBase = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.040, 0.022, 12), bindMat);
  heelBase.position.set(0, 0.028, 0.165);
  g.add(heelBase);
  const heelTurret = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.033, 0.056, 12), gunmetalMat);
  heelTurret.position.set(0, 0.062, 0.175);
  heelTurret.rotation.x = -0.18;
  g.add(heelTurret);
  const heelLever = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.016, 0.055), coralMetalMat);
  heelLever.position.set(0, 0.062, 0.215);
  heelLever.rotation.x = -0.45;
  g.add(heelLever);

  for (const s of [-1, 1]) {
    // Sleek raised metal brake rod tucked above pinched waist rail
    const brakeArm = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.11, 6), steelMat);
    brakeArm.position.set(s * 0.050, 0.046, 0.105);
    brakeArm.rotation.x = Math.PI * 0.44;
    brakeArm.rotation.z = s * -0.12;
    g.add(brakeArm);
    const brakePad = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.022), rubberMat);
    brakePad.position.set(s * 0.053, 0.062, 0.155);
    g.add(brakePad);
  }

  // --- SCULPTED ROUNDED 3-BUCKLE FREERIDE SKI BOOT (zero Minecraft brick!) ---
  const bootShellMat = markForeground(new THREE.MeshStandardMaterial({ color: 0x2c3542, roughness: 0.36, metalness: 0.20 }), 0.55);
  const bootTongueMat = markForeground(new THREE.MeshStandardMaterial({ color: 0x202732, roughness: 0.68, metalness: 0.08 }), 0.45);
  const bootGroup = new THREE.Group();

  // GripWalk contoured rubber sole welt
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.024, 0.295), rubberMat);
  sole.position.set(0, 0.036, 0.0);
  bootGroup.add(sole);

  // Rounded lower boot clog (capsule/rounded cylinder lying along foot)
  const clogBody = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.047, 0.21, 12), bootShellMat);
  clogBody.rotation.x = Math.PI * 0.5;
  clogBody.scale.set(1.02, 1.0, 0.86);
  clogBody.position.set(0, 0.068, -0.005);
  bootGroup.add(clogBody);

  // Rounded toe-box cap
  const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 10), bootShellMat);
  toeCap.scale.set(1.02, 0.76, 1.15);
  toeCap.position.set(0, 0.064, -0.108);
  bootGroup.add(toeCap);

  // Rounded heel cup
  const heelCup = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 10), bootShellMat);
  heelCup.scale.set(0.98, 0.92, 0.95);
  heelCup.position.set(0, 0.072, 0.100);
  bootGroup.add(heelCup);

  // Forward-raked tapered upper freeride cuff (15° forward lean into athletic skiing stance!)
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.175, 14), bootShellMat);
  cuff.position.set(0, 0.145, 0.042);
  cuff.rotation.x = -0.24;
  bootGroup.add(cuff);

  // Molded front neoprene tongue + walk-mode spine
  const tongue = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.165, 10), bootTongueMat);
  tongue.position.set(0, 0.152, 0.012);
  tongue.rotation.x = -0.24;
  bootGroup.add(tongue);

  // 3 anodized micro-adjustable vermilion-coral buckles + power booster strap!
  const b1 = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.007, 6, 14, Math.PI * 1.15), coralMetalMat);
  b1.position.set(0, 0.088, -0.052);
  b1.rotation.set(Math.PI * 0.42, 0, Math.PI * -0.07);
  bootGroup.add(b1);

  const b2 = new THREE.Mesh(new THREE.TorusGeometry(0.050, 0.007, 6, 14, Math.PI * 1.1), coralMetalMat);
  b2.position.set(0, 0.125, 0.018);
  b2.rotation.set(Math.PI * 0.44, 0, Math.PI * -0.05);
  bootGroup.add(b2);

  const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.056, 0.028, 14), coralMetalMat);
  strap.position.set(0, 0.205, 0.025);
  strap.rotation.x = -0.24;
  bootGroup.add(strap);

  // Anchor dummy right at top of boot cuff so the ski-pant shin cuff locks dynamically onto it every frame!
  const ankleAnchor = new THREE.Object3D();
  ankleAnchor.position.set(0, 0.215, 0.020);
  bootGroup.add(ankleAnchor);

  g.add(bootGroup);

  g.userData = {
    dustMat,
    dustMesh,
    bowWaveMesh,
    bowUniforms,
    powderUniforms,
    dBaseY,
    dTVals,
    isLeft,
    baseBlade: skiBlade,
    baseY,
    tVals,
    ankleAnchor,
    lastFlex: -99,
  };
  return g;
}

function updateSkiFlex(skiGroup, flexAmt, chatterPhase) {
  const { baseBlade, baseY, tVals, dustMesh, dBaseY, dTVals } = skiGroup.userData;
  const posAttr = baseBlade.geometry.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const t = tVals[i];
    let dy = 0;
    if (t > 0.56) {
      const u = (t - 0.56) / 0.44;
      dy = u * u * flexAmt + u * u * chatterPhase;
    } else if (t < 0.24) {
      const u = (0.24 - t) / 0.24;
      dy = u * u * flexAmt * 0.35;
    }
    posAttr.setY(i, baseY[i] + dy);
  }
  posAttr.needsUpdate = true;

  if (dustMesh && skiGroup.userData.dustMat.opacity > 0.01) {
    const dAttr = dustMesh.geometry.attributes.position;
    for (let i = 0; i < dAttr.count; i++) {
      const t = dTVals[i];
      const u = Math.max(0, (t - 0.56) / 0.44);
      dAttr.setY(i, dBaseY[i] + u * u * flexAmt + u * u * chatterPhase);
    }
    dAttr.needsUpdate = true;
  }
}

function createPoleMesh(side, mats) {
  const g = new THREE.Group();
  const { carbonTex, webTex } = mats;
  const shaftMat = markForeground(new THREE.MeshStandardMaterial({
    color: 0x202630,
    roughness: 0.28,
    metalness: 0.62,
    bumpMap: carbonTex,
    bumpScale: 0.009,
  }), 0.15, 0.14);
  const gripMat = markForeground(new THREE.MeshStandardMaterial({
    color: 0x26292f,
    roughness: 0.86,
    metalness: 0.04,
    bumpMap: carbonTex,
    bumpScale: 0.005,
  }), 0.20, 0.18);
  const corkMat = markForeground(new THREE.MeshStandardMaterial({
    color: 0x3b3530,
    roughness: 0.90,
    metalness: 0.02,
    bumpMap: carbonTex,
    bumpScale: 0.007,
  }), 0.15, 0.22);
  const basketMat = markForeground(new THREE.MeshStandardMaterial({ color: 0x1c222a, roughness: 0.70, metalness: 0.12 }), 0.40, 0.12);
  const accentMat = markForeground(new THREE.MeshStandardMaterial({ color: 0xe64e24, roughness: 0.30, metalness: 0.56 }), 0.10, 0.18);
  const metalMat = markForeground(new THREE.MeshStandardMaterial({ color: 0xb6c0ce, roughness: 0.20, metalness: 0.90 }), 0.05, 0.10);
  const strapMat = markForeground(new THREE.MeshStandardMaterial({
    map: webTex ? webTex.map : null,
    bumpMap: webTex ? webTex.bumpMap : null,
    bumpScale: 0.010,
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.04,
  }), 0.28, 0.24);

  // Smooth tapered 16-seg matte woven carbon backcountry pole shaft (origin at center of closed fist grip!)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0094, 0.0058, 1.24, 16), shaftMat);
  shaft.position.set(0, -0.60, 0);
  g.add(shaft);

  // Anodized FlickLock Pro height-adjustment clamp + aluminum latch lever
  const lockBody = new THREE.Mesh(new THREE.CylinderGeometry(0.0124, 0.0114, 0.048, 16), accentMat);
  lockBody.position.set(0, -0.34, 0);
  g.add(lockBody);
  const lockCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0132, 0.0126, 0.012, 16), metalMat);
  lockCap.position.set(0, -0.318, 0);
  g.add(lockCap);
  const lockLever = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.0038, 0.022, 4, 8) : new THREE.CylinderGeometry(0.0038, 0.0038, 0.026, 8), metalMat);
  lockLever.position.set(side * 0.013, -0.34, -0.004);
  lockLever.rotation.z = side * 0.14;
  g.add(lockLever);

  // Graphic coral collar rings along upper & lower shaft
  const upperBand = new THREE.Mesh(new THREE.CylinderGeometry(0.0102, 0.0099, 0.055, 16), accentMat);
  upperBand.position.set(0, -0.23, 0);
  g.add(upperBand);
  const lowerBand = new THREE.Mesh(new THREE.CylinderGeometry(0.0080, 0.0076, 0.036, 16), accentMat);
  lowerBand.position.set(0, -0.64, 0);
  g.add(lowerBand);

  // Sculpted ergonomic LatheGeometry EVA/cork ski-pole grip with subtle molded 4-finger waves & flared pommel!
  const gripPts = [
    new THREE.Vector2(0.0098, -0.195),
    new THREE.Vector2(0.0138, -0.185),
    new THREE.Vector2(0.0142, -0.110), // lower extended touring choke-up wrap
    new THREE.Vector2(0.0134, -0.092), // collar groove
    new THREE.Vector2(0.0168, -0.072), // lower palm guard flare
    new THREE.Vector2(0.0156, -0.048), // pinky indent
    new THREE.Vector2(0.0166, -0.030),
    new THREE.Vector2(0.0158, -0.014), // ring indent
    new THREE.Vector2(0.0168,  0.004),
    new THREE.Vector2(0.0160,  0.020), // middle indent
    new THREE.Vector2(0.0170,  0.036), // index support
    new THREE.Vector2(0.0162,  0.048), // thumb neck
    new THREE.Vector2(0.0218,  0.064), // flared ergonomic pommel head!
    new THREE.Vector2(0.0226,  0.075),
    new THREE.Vector2(0.0195,  0.084),
    new THREE.Vector2(0.0110,  0.089),
    new THREE.Vector2(0.0005,  0.090),
  ];
  const gripMesh = new THREE.Mesh(new THREE.LatheGeometry(gripPts, 24), gripMat);
  g.add(gripMesh);

  // Subtle sculpted touring foam wrap collar ring + angled anodized top-cap rivet on pommel!
  const pommelRivet = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0122, 0.006, 18), accentMat);
  pommelRivet.position.set(0, 0.089, 0);
  g.add(pommelRivet);
  const pommelNut = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.007, 14), metalMat);
  pommelNut.position.set(0, 0.090, 0);
  g.add(pommelNut);
  const chokeRing = new THREE.Mesh(new THREE.TorusGeometry(0.0142, 0.0022, 8, 20), corkMat);
  chokeRing.rotation.x = Math.PI * 0.5;
  chokeRing.position.set(0, -0.092, 0);
  g.add(chokeRing);

  // Taut woven herringbone nylon wrist strap hugging cleanly around glove heel & wrist (ZERO loose dangling loop!)
  // Coordinates relative to pole shaft center (px = -side*0.012, pz = -0.024 -> hand wrist is at x=+side*0.020, z=+0.105)
  const strapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0,            0.065, 0.014), // exits rear pommel strap slot
    new THREE.Vector3(side * 0.028,   0.044, 0.046), // drapes snugly over dorsal-radial wrist edge
    new THREE.Vector3(side * 0.045,   0.012, 0.088), // hugs outside dorsal leather cheek
    new THREE.Vector3(side * 0.028,  -0.024, 0.112), // wraps tightly around wrist heel under gauntlet
    new THREE.Vector3(-side * 0.004, -0.016, 0.098), // sweeps flat across inner wrist
    new THREE.Vector3(-side * 0.012,  0.014, 0.058), // glides flush along inner palm web
    new THREE.Vector3(-side * 0.005,  0.047, 0.025), // tucks snugly below thumb crotch
    new THREE.Vector3(0.0,            0.062, 0.014),
  ], false, 'centripetal');
  const strapGeo = new THREE.TubeGeometry(strapCurve, 32, 0.0036, 8, false);
  strapGeo.computeVertexNormals();
  const strapMesh = new THREE.Mesh(strapGeo, strapMat);
  g.add(strapMesh);
  // Little black molded plastic strap-cam exit clip right on the back of the pommel
  const strapSlot = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.016, 10), metalMat);
  strapSlot.rotation.z = Math.PI * 0.5;
  strapSlot.position.set(0, 0.066, 0.014);
  g.add(strapSlot);

  // Articulated 95mm freeride powder basket with 6 radial snow-ribs + carbide spike tip
  const basketRingOuter = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.0055, 8, 20), basketMat);
  basketRingOuter.rotation.x = Math.PI * 0.5;
  basketRingOuter.position.set(0, -1.14, 0);
  g.add(basketRingOuter);
  const basketHub = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.014, 0.022, 14), basketMat);
  basketHub.position.set(0, -1.14, 0);
  g.add(basketHub);
  const basketWeb = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.018, 0.009, 18, 1, true), basketMat);
  basketWeb.position.set(0, -1.139, 0);
  g.add(basketWeb);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.046, 6), basketMat);
    spoke.rotation.z = Math.PI * 0.5;
    spoke.rotation.y = a;
    spoke.position.set(Math.cos(a) * 0.024, -1.14, -Math.sin(a) * 0.024);
    g.add(spoke);
  }
  const tipSpike = new THREE.Mesh(new THREE.ConeGeometry(0.0058, 0.048, 10), metalMat);
  tipSpike.rotation.x = Math.PI;
  tipSpike.position.set(0, -1.21, 0);
  g.add(tipSpike);
  return g;
}

function buildSkierDropShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  const g0 = ctx.createRadialGradient(64, 64, 8, 64, 64, 58);
  g0.addColorStop(0.0, 'rgba(26, 46, 78, 0.46)');
  g0.addColorStop(0.55, 'rgba(30, 52, 86, 0.20)');
  g0.addColorStop(1.0, 'rgba(30, 52, 86, 0.0)');
  ctx.fillStyle = g0;
  ctx.fillRect(0, 0, 128, 128);

  ctx.save();
  ctx.filter = 'blur(4px)';
  ctx.fillStyle = 'rgba(20, 38, 68, 0.52)';
  ctx.beginPath();
  ctx.ellipse(64, 64, 18, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(46, 16, 8, 96);
  ctx.fillRect(74, 16, 8, 96);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Multiplicative HDR per-ski contact & rockered-tip shadow ribbon (matches tree & mountain shadow physics!).
 * Preserves 100% of underlying snow sparkle, sastrugi micro-relief, and carved ski impressions!
 */
function createSkiShadowRibbon(segs = 20) {
  const pos = new Float32Array((segs + 1) * 2 * 3);
  const uvs = new Float32Array((segs + 1) * 2 * 2);
  const liftAttr = new Float32Array((segs + 1) * 2);
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; // 0 = tail, 1 = tip
    uvs[i * 4 + 0] = -1; uvs[i * 4 + 1] = t;
    uvs[i * 4 + 2] = 1;  uvs[i * 4 + 3] = t;
    if (i < segs) {
      const r0 = i * 2, r1 = r0 + 2;
      idx.push(r0, r1, r0 + 1, r0 + 1, r1, r1 + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aLift', new THREE.BufferAttribute(liftAttr, 1));
  geo.setIndex(idx);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.DstColorFactor,
    blendDst: THREE.ZeroFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    uniforms: {
      uOpacity: { value: 0.90 },
      uTint: { value: new THREE.Color(0.38, 0.48, 0.66) },
      uEmergeT: { value: -1.0 },
    },
    vertexShader: /* glsl */ `
      attribute float aLift;
      varying vec2 vUv;
      varying float vLift;
      void main() {
        vUv = uv;
        vLift = aLift;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uTint;
      uniform float uEmergeT;
      varying vec2 vUv;
      varying float vLift;
      void main() {
        float u = abs(vUv.x); // 0 center .. 1 edge of shadow ribbon
        float t = vUv.y;      // 0 tail .. 1 tip
        // Smooth rounded longitudinal taper matching the blunt spoon twin-tip ends
        float noseFade = 1.0 - smoothstep(0.92, 1.0, t);
        float tailFade = smoothstep(0.0, 0.08, t);
        // In deep powder, buried waist/mid-body sits UNDER the snow -> ONLY emerged upturned tip casts shadow on top!
        float emergeFade = uEmergeT > 0.0 ? smoothstep(uEmergeT - 0.06, uEmergeT + 0.12, t) : 1.0;
        // Tight sharp contact core beneath planted waist; softer penumbra as rockered shovel rises off the snow!
        float sharpness = mix(3.4, 1.55, clamp(vLift * 7.5, 0.0, 1.0));
        float across = exp(-pow(u * 1.18, 2.0) * sharpness) * (1.0 - smoothstep(0.58, 1.0, u));
        float tipSoft = mix(1.0, 0.68, clamp(vLift * 6.5, 0.0, 1.0));
        float m = across * noseFade * tailFade * emergeFade * tipSoft * uOpacity;
        if (m < 0.004) discard;
        // Pure linear multiply: natural alpine cool-slate shadow darkening!
        vec3 col = mix(vec3(1.0), uTint, clamp(m, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return { mesh, geo, mat, segs };
}

/**
 * Sculpted 3D cloth-draped elliptical limb segment (`y ∈ [-0.5, +0.5]`, 24×20 mesh) with organic
 * muscle/garment contour, diagonal accordion cloth folds near joint bends, and continuous seam piping!
 */
function makeSculptedLimbSegment(rBottom, rTop, mat, opts = {}) {
  const radSegs = opts.radSegs || 24;
  const lenSegs = opts.lenSegs || 20;
  const scaleX = opts.scaleX || 1.0;
  const scaleZ = opts.scaleZ || 1.0;
  const bulgeMid = opts.bulgeMid || 0.0;       // subtle muscle / forearm / quad fullness around v = 0.55
  const foldAmp = opts.foldAmp ?? 0.0052;      // diagonal 3D cloth fold amplitude (meters before Y-scale)
  const foldFreq = opts.foldFreq || 5.5;
  const phase = opts.phase || 0.0;
  const gatherBot = opts.gatherBot || 0.0;     // cloth cuff gather flare near bottom end (v -> 0)
  const gatherTop = opts.gatherTop || 0.0;     // cloth elbow/knee fold gather near top end (v -> 1)
  const sideSeam = opts.sideSeam ?? true;      // subtle raised double-stitched outer/inner seam welt

  const pos = [];
  const uvs = [];
  const idx = [];
  const rowCols = radSegs + 1;

  for (let i = 0; i <= lenSegs; i++) {
    const v = i / lenSegs; // 0 = distal (wrist/ankle/knee), 1 = proximal (elbow/knee/hip)
    const y = v - 0.5;
    // Smooth eased anatomical taper + natural mid-limb fullness
    const baseR = rBottom + (rTop - rBottom) * v + bulgeMid * Math.sin(v * Math.PI) * (0.65 + 0.35 * v);
    // Subtle cloth gathers bunching slightly near cuffs & joint bends
    const botGate = Math.pow(Math.max(0, 1.0 - v * 3.2), 1.6);
    const topGate = Math.pow(Math.max(0, (v - 0.68) / 0.32), 1.6);
    for (let j = 0; j <= radSegs; j++) {
      const u = j / radSegs;
      const th = u * Math.PI * 2.0;
      const c = Math.cos(th), s = Math.sin(th);
      // Multi-frequency diagonal fabric creases angled naturally around elbow/wrist/knee flex axis
      const diag1 = Math.sin(v * foldFreq * Math.PI + s * 1.45 + c * 0.75 + phase);
      const diag2 = Math.cos(v * (foldFreq * 1.65) * Math.PI - c * 1.8 + s * 0.9 + phase * 1.7);
      const jointWave = (botGate * gatherBot + topGate * gatherTop) * Math.sin(v * 26.0 + c * 2.4 + phase);
      const microPleat = (diag1 * 0.62 + diag2 * 0.38) * foldAmp * (0.45 + 0.55 * (botGate + topGate + 0.45));
      // Subtle stitched side seam welt along ±X flanks (`s ≈ 0`)
      const seamRidge = sideSeam ? Math.exp(-s * s * 42.0) * 0.0014 : 0.0;
      const flare = 1.0 + botGate * gatherBot * 0.14 - topGate * gatherTop * 0.04;
      const r = baseR * flare + microPleat + jointWave * 0.0038 + seamRidge;
      // Smooth elliptical taper (flatter at wrist/ankle, fuller round near elbow/hip)
      const ex = THREE.MathUtils.lerp(scaleX, 1.0, v * 0.35);
      const ez = THREE.MathUtils.lerp(scaleZ, 1.0, v * 0.35);
      pos.push(c * r * ex, y, s * r * ez);
      uvs.push(u * 1.5, v * 1.5);
    }
  }
  for (let i = 0; i < lenSegs; i++) {
    const r0 = i * rowCols;
    const r1 = (i + 1) * rowCols;
    for (let j = 0; j < radSegs; j++) {
      // Outward CCW normal: (r1-r0) x (j+1-j) = (+Y) x (+Z at th=0) -> Wait check:
      // At th=0: (r0+j) = (+r, y, 0), (r1+j) = (+r, y+dy, 0), (r0+j+1) = (+r, y, +dth)
      // (dy) x (dth) = (0,1,0) x (0,0,1) = (+1, 0, 0) OUTWARD!
      idx.push(r0 + j, r1 + j, r0 + j + 1);
      idx.push(r0 + j + 1, r1 + j, r1 + j + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(geo, mat);
  g.add(mesh);
  return g;
}

const _segDir = new THREE.Vector3();
const _segMid = new THREE.Vector3();
const _segUp = new THREE.Vector3(0, 1, 0);
const _segX = new THREE.Vector3();
const _segZ = new THREE.Vector3();
const _segHint = new THREE.Vector3();
const _segMat = new THREE.Matrix4();
const _segQ = new THREE.Quaternion();

/** Position and orient a unit-length Y-axis limb segment seamlessly between pA (bottom) and pB (top) with zero gimbal twist! */
function placeLimbSegment(obj, pA, pB, rScaleXZ = 1.0, hintX = 1, hintY = 0, hintZ = 0) {
  _segDir.subVectors(pB, pA);
  const len = _segDir.length();
  if (len < 0.001) return;
  _segMid.addVectors(pA, pB).multiplyScalar(0.5);
  obj.position.copy(_segMid);
  _segDir.divideScalar(len);
  _segHint.set(hintX, hintY, hintZ);
  if (Math.abs(_segDir.dot(_segHint)) > 0.94) _segHint.set(0, 0, -1);
  // Right-handed basis: zAxis = hint x up, xAxis = up x zAxis -> +X tracks body-right consistently!
  _segZ.crossVectors(_segHint, _segDir).normalize();
  _segX.crossVectors(_segDir, _segZ).normalize();
  _segMat.makeBasis(_segX, _segDir, _segZ);
  obj.quaternion.setFromRotationMatrix(_segMat);
  obj.scale.set(rScaleXZ, len, rScaleXZ);
}

/** Build a closed smooth articulated finger/thumb loft along a 3-joint CatmullRomCurve3 with knuckle bulges & rounded tip cap! */
function buildSculptedFingerGeo(curve, radFn, segs = 20, radSegs = 12, flatAspect = 0.88) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [];
  const uvs = [];
  const idx = [];
  const rowCols = radSegs + 1;
  const pts = [];
  const rings = [];

  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    const p = curve.getPoint(u);
    const T = frames.tangents[i];
    const N = frames.normals[i];
    // Guarantee exact right-handed [N, B, T] frame with B = T x N -> B x T = +N outward!
    const B = new THREE.Vector3().crossVectors(T, N).normalize();
    const N2 = new THREE.Vector3().crossVectors(B, T).normalize();
    pts.push(p);
    rings.push({ p, T, N: N2, B, u, r: radFn(u) });
  }

  // Smooth hemispherical rounded fingertip cap (3 extra closing rings curving forward along tangent T)
  const last = rings[rings.length - 1];
  const tipAngles = [0.42, 0.85, 1.25, Math.PI * 0.5];
  for (let k = 0; k < tipAngles.length; k++) {
    const a = tipAngles[k];
    const pTip = last.p.clone().addScaledVector(last.T, Math.sin(a) * last.r * 0.95);
    const rTip = Math.max(0.0004, last.r * Math.cos(a));
    rings.push({ p: pTip, T: last.T, N: last.N, B: last.B, u: 1.0 + (k + 1) * 0.04, r: rTip });
  }

  const totalRings = rings.length;
  for (let i = 0; i < totalRings; i++) {
    const { p, N, B, u, r } = rings[i];
    for (let j = 0; j <= radSegs; j++) {
      const v = j / radSegs;
      const th = v * Math.PI * 2.0;
      const c = Math.cos(th), s = Math.sin(th);
      // Slight subtle flattening on volar/dorsal pad + soft accordion crease ripple at PIP/DIP joints
      const knucklePleat = (u > 0.25 && u < 0.82)
        ? (Math.sin(u * 42.0) * 0.00055 * Math.max(0, -c))
        : 0;
      const rx = (r + knucklePleat) * flatAspect;
      const ry = r + knucklePleat * 0.5;
      const vx = p.x + N.x * (c * rx) + B.x * (s * ry);
      const vy = p.y + N.y * (c * rx) + B.y * (s * ry);
      const vz = p.z + N.z * (c * rx) + B.z * (s * ry);
      pos.push(vx, vy, vz);
      uvs.push(v * 0.85, u * 1.4);
    }
  }
  for (let i = 0; i < totalRings - 1; i++) {
    const r0 = i * rowCols;
    const r1 = (i + 1) * rowCols;
    for (let j = 0; j < radSegs; j++) {
      // Outward normal: B x T = +N -> (r0+j, r0+j+1, r1+j)
      idx.push(r0 + j, r0 + j + 1, r1 + j);
      idx.push(r0 + j + 1, r1 + j + 1, r1 + j);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Hero multi-panel freeride alpine-style Chamonix freeride leather glove (warm oiled saddle-tan goat leather,
 * slate-charcoal 3L weatherproof softshell backhand with cream contrast stitched piping, accordion
 * knuckle flex pleats, aramid-reinforced espresso palm & fingertip pads, 4 individually sculpted curled
 * fingers, opposable thumb wrapping over the pole grip, and flared Velcro wrist gauntlet with carabiner loop!).
 * Coordinate frame (`handNode`):
 *   - Origin `(0, 0, 0)` = hand grip center; pole sits at `(-side * 0.012, 0, -0.024)` along `-Y`
 *   - `+side * X` = dorsal back of hand (outward), `-side * X` = palm / thumb (inward)
 *   - `+Y` = up toward pole pommel / index side, `-Y` = down toward pinky / basket
 *   - `-Z` = forward over curled knuckles, `+Z` = backward into wrist gauntlet (`z = +0.095`)
 */
function buildFreerideGlove(side, mats) {
  const { gloveTanMat, glovePalmMat, gloveShellMat, stitchMat, webbingMat, orangePullMat, buckleMat } = mats;
  const g = new THREE.Group();

  // 1. Sculpted contoured Metacarpal Hand Body (z = +0.098 wrist base -> z = -0.014 MCP knuckles)
  const mLen = 14, mRad = 24;
  const mPos = [], mUv = [], mIdx = [];
  const rowCols = mRad + 1;
  for (let i = 0; i <= mLen; i++) {
    const f = i / mLen; // 0 = wrist (z=+0.100), 1 = MCP knuckle ridge (z=-0.016)
    const z = THREE.MathUtils.lerp(0.100, -0.016, f);
    // Natural anatomical expansion from tapered wrist to broad cupped palm & slightly sloped knuckles
    const widthEnv = Math.sin(Math.pow(f, 0.72) * Math.PI * 0.78);
    const ry = 0.032 + 0.014 * widthEnv + (f > 0.75 ? -0.002 * ((f - 0.75) / 0.25) : 0);
    const rx = 0.0235 - 0.0042 * f;
    const cx = side * (0.006 + 0.0085 * f); // shifts smoothly dorsal as palm cups around grip at -side*0.012
    const cy = 0.001 - 0.003 * (1 - f);
    for (let j = 0; j <= mRad; j++) {
      const u = j / mRad;
      const th = u * Math.PI * 2.0;
      const cs = Math.cos(th), sn = Math.sin(th);
      // Super-elliptical rounding (natural flat dorsal back & cupped palm rather than balloon sphere!)
      const sxSign = Math.sign(cs) * Math.pow(Math.abs(cs), 0.78);
      const sySign = Math.sign(sn) * Math.pow(Math.abs(sn), 0.82);
      let px = cx + sxSign * rx;
      let py = cy + sySign * ry;
      // Cup the palm face (cs * side < 0) softly inward cradling the EVA pole grip
      const isPalm = Math.max(0, -cs * side);
      px += side * isPalm * 0.0040 * Math.sin(f * Math.PI);
      // Organic integrated thenar/thumb-web cushion along upper-medial palm (ZERO protruding sphere seam!)
      const isThumbWeb = Math.max(0, -cs * side) * Math.max(0, sn + 0.18);
      const webEnv = Math.sin(Math.min(1, Math.max(0, (f - 0.14) / 0.72)) * Math.PI);
      px -= side * isThumbWeb * 0.0058 * webEnv;
      py += isThumbWeb * 0.0048 * webEnv;
      // Sculpt subtle 4-knuckle MCP ridge domes across dorsal side (cs * side > 0, near f -> 1)
      const isDorsal = Math.max(0, cs * side);
      const knuckRidge = isDorsal * Math.pow(f, 2.2) * (0.0028 + 0.0020 * Math.cos(sn * Math.PI * 3.8));
      // Soft diagonal leather wrist/palm compression pleats across both sides for natural grain breakup
      const leatherCrease = Math.sin(f * 20.0 + sn * 2.2) * 0.0012 * (1.0 - f * 0.35);
      px += side * (knuckRidge + leatherCrease * (0.35 + 0.65 * isDorsal));
      // Slight wrist taper flare right at the gauntlet seam
      const closeCap = f > 0.96 ? (1.0 - ((f - 0.96) / 0.04) * 0.14) : 1.0;
      mPos.push(cx + (px - cx) * closeCap, cy + (py - cy) * closeCap, z);
      mUv.push(u * 1.4, f * 1.1);
    }
  }
  for (let i = 0; i < mLen; i++) {
    const r0 = i * rowCols;
    const r1 = (i + 1) * rowCols;
    for (let j = 0; j < mRad; j++) {
      // Sweeping -Z with (cos th, sin th) -> di x dth = (0,0,-1) x (0,1,0) = (+1,0,0) OUTWARD!
      mIdx.push(r0 + j, r1 + j, r0 + j + 1);
      mIdx.push(r0 + j + 1, r1 + j, r1 + j + 1);
    }
  }
  // Close front MCP knuckle cap cleanly so no hollow opening sits between fingers
  const capCIdx = mPos.length / 3;
  mPos.push(side * 0.014, 0.001, -0.020);
  mUv.push(0.5, 1.0);
  const lastRow = mLen * rowCols;
  for (let j = 0; j < mRad; j++) {
    mIdx.push(lastRow + j, capCIdx, lastRow + j + 1);
  }
  const metaGeo = new THREE.BufferGeometry();
  metaGeo.setAttribute('position', new THREE.Float32BufferAttribute(mPos, 3));
  metaGeo.setAttribute('uv', new THREE.Float32BufferAttribute(mUv, 2));
  metaGeo.setIndex(mIdx);
  metaGeo.computeVertexNormals();
  g.add(new THREE.Mesh(metaGeo, gloveTanMat));

  // 2. Contoured Dark-Slate 3L Softshell Backhand Armor Overlay Panel (+ stitched piping seam!)
  // Uses exact metaGeo base loft + constant outward lift (+2.6mm) so ZERO wavy intersection ever occurs!
  const bhLen = 10, bhRad = 14;
  const bhPos = [], bhUv = [], bhIdx = [];
  const bhCols = bhRad + 1;
  for (let i = 0; i <= bhLen; i++) {
    const f = 0.08 + (i / bhLen) * 0.72; // spans back of hand from wrist cuff to just behind leather knuckle pleats
    const z = THREE.MathUtils.lerp(0.100, -0.016, f);
    const widthEnv = Math.sin(Math.pow(f, 0.72) * Math.PI * 0.78);
    const ry = 0.032 + 0.014 * widthEnv + (f > 0.75 ? -0.002 * ((f - 0.75) / 0.25) : 0);
    const rx = 0.0235 - 0.0042 * f;
    const cx = side * (0.006 + 0.0085 * f);
    const cy = 0.001 - 0.003 * (1 - f);
    // Subtle insulated baffle quilting puffs across backhand shell
    const quilt = Math.sin((i / bhLen) * Math.PI * 4.0) * 0.0010;
    const webEnv = Math.sin(Math.min(1, Math.max(0, (f - 0.14) / 0.72)) * Math.PI);
    for (let j = 0; j <= bhRad; j++) {
      const aNorm = (j / bhRad) * 2.0 - 1.0; // -1..+1 across panel arc
      const a = 0.22 + aNorm * 0.96; // clean crisp dorsal panel hugging outer-top backhand (`-0.74..+1.18 rad`)
      const th = (side > 0 ? a : Math.PI - a);
      const cs = Math.cos(th), sn = Math.sin(th);
      const sxSign = Math.sign(cs) * Math.pow(Math.abs(cs), 0.78);
      const sySign = Math.sign(sn) * Math.pow(Math.abs(sn), 0.82);
      // Match metaGeo exact surface displacement first, then add clean positive outward offset!
      const isPalm = Math.max(0, -cs * side);
      const isDorsal = Math.max(0, cs * side);
      const isThumbWeb = Math.max(0, -cs * side) * Math.max(0, sn + 0.18);
      const knuckRidge = isDorsal * Math.pow(f, 2.2) * (0.0028 + 0.0020 * Math.cos(sn * Math.PI * 3.8));
      const leatherCrease = Math.sin(f * 20.0 + sn * 2.2) * 0.0012 * (1.0 - f * 0.35);
      const basePx = cx + sxSign * rx + side * (isPalm * 0.0040 * Math.sin(f * Math.PI) - isThumbWeb * 0.0058 * webEnv + knuckRidge + leatherCrease * (0.35 + 0.65 * isDorsal));
      const basePy = cy + sySign * ry + isThumbWeb * 0.0048 * webEnv;
      const lift = 0.0028 + quilt * Math.cos(aNorm * 1.2);
      const px = basePx + cs * lift;
      const py = basePy + sn * lift;
      bhPos.push(px, py, z);
      bhUv.push((j / bhRad), i / bhLen);
    }
  }
  for (let i = 0; i < bhLen; i++) {
    const r0 = i * bhCols, r1 = (i + 1) * bhCols;
    for (let j = 0; j < bhRad; j++) {
      if (side > 0) {
        bhIdx.push(r0 + j, r1 + j, r0 + j + 1);
        bhIdx.push(r0 + j + 1, r1 + j, r1 + j + 1);
      } else {
        bhIdx.push(r0 + j, r0 + j + 1, r1 + j);
        bhIdx.push(r0 + j + 1, r1 + j + 1, r1 + j);
      }
    }
  }
  const bhGeo = new THREE.BufferGeometry();
  bhGeo.setAttribute('position', new THREE.Float32BufferAttribute(bhPos, 3));
  bhGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bhUv, 2));
  bhGeo.setIndex(bhIdx);
  bhGeo.computeVertexNormals();
  g.add(new THREE.Mesh(bhGeo, gloveShellMat));

  // Cream-tan contrast leather stitch welt curving along the leading edge + top radial border of the softshell panel!
  const stitchPts = [];
  for (let k = 0; k <= 12; k++) {
    const aNorm = (k / 12) * 2.0 - 1.0;
    const a = 0.36 + aNorm * 1.12;
    const th = (side > 0 ? a : Math.PI - a);
    const cs = Math.cos(th), sn = Math.sin(th);
    const sxSign = Math.sign(cs) * Math.pow(Math.abs(cs), 0.78);
    const sySign = Math.sign(sn) * Math.pow(Math.abs(sn), 0.82);
    const zCurve = 0.008 + Math.abs(aNorm) * 0.008;
    stitchPts.push(new THREE.Vector3(
      side * 0.013 + sxSign * 0.0218,
      sySign * 0.0425,
      zCurve
    ));
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stitchPts), 18, 0.0016, 6, false), stitchMat));

  // 3. Sculpted Ribbed Accordion Leather Knuckle Flex Guard (3 rounded leather pleats arching over MCP knuckles & top ridge!)
  for (let rib = 0; rib < 3; rib++) {
    const rz = -0.001 - rib * 0.0068;
    const rPts = [];
    for (let k = 0; k <= 10; k++) {
      const aNorm = (k / 10) * 2.0 - 1.0;
      const a = 0.32 + aNorm * 1.04;
      const th = (side > 0 ? a : Math.PI - a);
      const cs = Math.cos(th), sn = Math.sin(th);
      const sxSign = Math.sign(cs) * Math.pow(Math.abs(cs), 0.78);
      const sySign = Math.sign(sn) * Math.pow(Math.abs(sn), 0.82);
      rPts.push(new THREE.Vector3(
        side * 0.0135 + sxSign * (0.0205 - rib * 0.0008),
        sySign * 0.041,
        rz
      ));
    }
    const rMat = rib === 1 ? glovePalmMat : gloveTanMat;
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rPts), 16, 0.0029, 8, false), rMat));
  }

  // 4. Reinforced Dark Espresso reinforced aramid Palm-Heel Grip Pad (curved along medial palm facing the pole handle!)
  const palmPts = [];
  for (let k = 0; k <= 8; k++) {
    const f = k / 8;
    palmPts.push(new THREE.Vector3(
      -side * (0.010 + Math.sin(f * Math.PI) * 0.008),
      THREE.MathUtils.lerp(-0.028, 0.026, f),
      THREE.MathUtils.lerp(0.056, 0.012, Math.sin(f * Math.PI * 0.7))
    ));
  }
  const palmPad = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(palmPts), 12, 0.0095, 8, false), glovePalmMat);
  palmPad.scale.set(0.55, 1.0, 1.35);
  g.add(palmPad);

  // 5. FOUR INDIVIDUALLY SCULPTED ARTICULATED CURLED FINGERS wrapping tightly around EVA pole grip!
  // Pole shaft center in `handNode` is `px = -side * 0.012, pz = -0.024`, grip radius = `0.0165 m`.
  const px = -side * 0.012, pz = -0.024, gripR = 0.0165;
  const fingerSpecs = [
    { y:  0.0305, r: 0.0118, reach: 1.02, tuck: 0.96 }, // Index (highest, gripping below pommel)
    { y:  0.0095, r: 0.0124, reach: 1.06, tuck: 1.00 }, // Middle (fullest, longest grip wrap)
    { y: -0.0115, r: 0.0115, reach: 1.02, tuck: 0.98 }, // Ring
    { y: -0.0305, r: 0.0101, reach: 0.96, tuck: 0.92 }, // Pinky (slightly shorter & tucked lower)
  ];
  for (let fi = 0; fi < fingerSpecs.length; fi++) {
    const fs = fingerSpecs[fi];
    const dist = gripR + fs.r * 0.86;
    const fCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.0145,                       fs.y + 0.001, -0.002),                      // MCP knuckle socket inside hand
      new THREE.Vector3(side * (0.0185 + fs.r * 0.16),       fs.y,          pz - 0.006 * fs.reach),      // proximal phalanx sweeping forward
      new THREE.Vector3(-side * 0.0015,                      fs.y - 0.002,  pz - dist * 1.04 * fs.reach),// PIP knuckle bending cleanly across front of grip
      new THREE.Vector3(px - side * dist * 0.92 * fs.tuck,   fs.y - 0.001,  pz - dist * 0.14),           // middle phalanx wrapping medial face of grip
      new THREE.Vector3(px - side * dist * 0.56 * fs.tuck,   fs.y + 0.001,  pz + dist * 0.64),           // DIP / distal fingertip curling back toward palm
    ], false, 'centripetal');
    const fRadFn = (u) => {
      // Subtle anatomical knuckle joint bulges at PIP (u≈0.48) and DIP (u≈0.76) + sleek tip taper
      const taper = 1.0 - 0.16 * u;
      const pip = Math.exp(-Math.pow((u - 0.48) / 0.11, 2)) * 0.11;
      const dip = Math.exp(-Math.pow((u - 0.76) / 0.09, 2)) * 0.07;
      return fs.r * (taper + pip + dip);
    };
    const fGeo = buildSculptedFingerGeo(fCurve, fRadFn, 18, 12, 0.90);
    g.add(new THREE.Mesh(fGeo, gloveTanMat));

    // Contrasting dark-espresso reinforced aramid wear cap stitched over the outer-front fingertip grip zone (u = 0.62..0.95)
    if (fi < 3) {
      const capCurve = new THREE.CatmullRomCurve3([
        fCurve.getPoint(0.60),
        fCurve.getPoint(0.75),
        fCurve.getPoint(0.88),
        fCurve.getPoint(0.98),
      ]);
      const capGeo = new THREE.TubeGeometry(capCurve, 8, fs.r * 0.87, 8, false);
      const capMesh = new THREE.Mesh(capGeo, glovePalmMat);
      // Tiny outward tuck toward palm contact side for reinforced grip wrap texture!
      capMesh.position.set(side * 0.0012, 0, 0.0012);
      g.add(capMesh);
    }
  }

  // 6. SEAMLESS ARTICULATED OPPOSABLE THUMB (root embedded cleanly inside sculpted metacarpal — ZERO bulbous ball!)
  const thumbCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( side * 0.005,  0.015,  0.056), // hidden CMC root tapered seamlessly inside palm leather
    new THREE.Vector3(-side * 0.006,  0.024,  0.026), // thumb metacarpal emerging organically from sculpted thumb web
    new THREE.Vector3(-side * 0.022,  0.034,  0.000), // MCP knuckle curving forward alongside EVA grip neck
    new THREE.Vector3(-side * 0.028,  0.039, -0.021), // IP joint hugging medial upper pole neck right under pommel
    new THREE.Vector3(-side * 0.008,  0.041, -0.043), // broad flattened thumb pad locking cleanly over curled index finger!
  ], false, 'centripetal');
  const thumbRadFn = (u) => {
    // Taper rear root gently inside hand (u < 0.25) so ZERO protruding cap ever shows outside leather!
    const rootFade = u < 0.25 ? THREE.MathUtils.lerp(0.0092, 0.0138, u / 0.25) : THREE.MathUtils.lerp(0.0138, 0.0108, (u - 0.25) / 0.75);
    const ipBulge = Math.exp(-Math.pow((u - 0.62) / 0.13, 2)) * 0.0014;
    return rootFade + ipBulge;
  };
  const thumbGeo = buildSculptedFingerGeo(thumbCurve, thumbRadFn, 18, 14, 0.86);
  g.add(new THREE.Mesh(thumbGeo, gloveTanMat));

  // Subtle flush cream-tan contrast stitch piping tracing the thumb saddle seam (replaces chunky dark bar!)
  const crotchCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( side * 0.001,  0.029,  0.040),
    new THREE.Vector3(-side * 0.007,  0.033,  0.014),
    new THREE.Vector3(-side * 0.016,  0.036, -0.010),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(crotchCurve, 10, 0.0018, 6, false), stitchMat));

  // 7. Flared Articulated Neoprene Wrist Gauntlet + Curved Velcro Cinch Strap + Vermilion Carabiner Loop!
  const gLen = 8, gRad = 20;
  const gPos = [], gUv = [], gIdx = [];
  const gCols = gRad + 1;
  for (let i = 0; i <= gLen; i++) {
    const f = i / gLen; // 0 = wrist join (z=+0.082), 1 = inner sleeve tuck (z=+0.138)
    const z = THREE.MathUtils.lerp(0.082, 0.138, f);
    const flare = 1.0 + Math.sin(f * Math.PI * 0.65) * 0.14;
    const rx = 0.0255 * flare + Math.sin(f * 14.0) * 0.0012;
    const ry = 0.0345 * flare + Math.sin(f * 14.0) * 0.0012;
    for (let j = 0; j <= gRad; j++) {
      const u = j / gRad;
      const th = u * Math.PI * 2.0;
      gPos.push(side * 0.004 + Math.cos(th) * rx, -0.001 + Math.sin(th) * ry, z);
      gUv.push(u * 1.4, f * 0.6);
    }
  }
  for (let i = 0; i < gLen; i++) {
    const r0 = i * gCols, r1 = (i + 1) * gCols;
    for (let j = 0; j < gRad; j++) {
      // Sweeping +Z with (cos th, sin th) -> dth x di = (0,1,0) x (0,0,1) = (+1,0,0) OUTWARD!
      gIdx.push(r0 + j, r0 + j + 1, r1 + j);
      gIdx.push(r0 + j + 1, r1 + j + 1, r1 + j);
    }
  }
  const gauntGeo = new THREE.BufferGeometry();
  gauntGeo.setAttribute('position', new THREE.Float32BufferAttribute(gPos, 3));
  gauntGeo.setAttribute('uv', new THREE.Float32BufferAttribute(gUv, 2));
  gauntGeo.setIndex(gIdx);
  gauntGeo.computeVertexNormals();
  g.add(new THREE.Mesh(gauntGeo, gloveShellMat));

  // Curved Velcro Wrist Cinch Strap wrapping cleanly around z = +0.092 + molded pull tab + coral carabiner hang loop!
  const cinchPts = [];
  for (let k = 0; k <= 16; k++) {
    const a = (k / 16) * Math.PI * 1.55 - Math.PI * 0.72;
    const th = side > 0 ? a : Math.PI - a;
    cinchPts.push(new THREE.Vector3(
      side * 0.004 + Math.cos(th) * 0.0285,
      -0.001 + Math.sin(th) * 0.0372,
      0.092
    ));
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cinchPts), 18, 0.0052, 8, false), webbingMat));
  // Subtle leather branding patch & vermilion woven hang-loop tucked at wrist underside (`-Y`)
  const hangLoop = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0026, 6, 12, Math.PI * 1.3), orangePullMat);
  hangLoop.position.set(side * 0.006, -0.036, 0.098);
  hangLoop.rotation.set(0.45, Math.PI * 0.5, 0);
  g.add(hangLoop);
  const dRing = new THREE.Mesh(new THREE.TorusGeometry(0.0068, 0.0016, 6, 10), buckleMat);
  dRing.position.set(side * 0.018, -0.030, 0.088);
  dRing.rotation.y = Math.PI * 0.5;
  g.add(dRing);

  return g;
}

/** Sculpted continuous 32×22 athletic V-taper hardshell torso loft (replaces stacked flat cylinders!). */
function buildJacketTorsoGeo() {
  const radSegs = 32, lenSegs = 22;
  const pos = [], uvs = [], idx = [];
  const cols = radSegs + 1;
  // Profile from powder-skirt hem (y = -0.025) through tapered waist (y = 0.14) to broad chest (y = 0.36) & collar base (y = 0.48)
  for (let i = 0; i <= lenSegs; i++) {
    const v = i / lenSegs;
    const y = THREE.MathUtils.lerp(-0.025, 0.485, v);
    const waistDip = -0.018 * Math.exp(-Math.pow((v - 0.28) / 0.16, 2));
    const chestFull = 0.030 * Math.exp(-Math.pow((v - 0.74) / 0.22, 2));
    const hemFlare = 0.012 * Math.pow(Math.max(0, 1.0 - v * 4.0), 1.6);
    const neckTap = v > 0.86 ? (1.0 - Math.pow((v - 0.86) / 0.14, 1.6) * 0.24) : 1.0;
    const rx = (0.194 + waistDip + chestFull + hemFlare) * 1.08 * neckTap;
    const rz = (0.124 + waistDip * 0.6 + chestFull * 0.72 + hemFlare * 0.5) * neckTap;
    for (let j = 0; j <= radSegs; j++) {
      const u = j / radSegs;
      const th = u * Math.PI * 2.0;
      const c = Math.cos(th), s = Math.sin(th);
      // Natural horizontal waist cloth gather folds + subtle torso crease waves
      const gather = Math.exp(-Math.pow((v - 0.24) / 0.14, 2)) * Math.sin(v * 34.0 + c * 1.8) * 0.0042;
      const chestPec = (s < 0 ? Math.abs(s) : 0) * Math.exp(-Math.pow((v - 0.72) / 0.18, 2)) * (0.008 * Math.pow(Math.abs(c), 0.7));
      const fold = Math.sin(v * 16.0 + c * 2.2 - s * 1.5) * 0.0028;
      // Slightly fuller rounded rectangular-oval torso cross-section
      const sx = Math.sign(c) * Math.pow(Math.abs(c), 0.90);
      const sz = Math.sign(s) * Math.pow(Math.abs(s), 0.90);
      pos.push(sx * (rx + gather + fold), y, sz * (rz + gather * 0.7 + fold * 0.7 + chestPec) - 0.004);
      uvs.push(u * 2.2, v * 2.0);
    }
  }
  for (let i = 0; i < lenSegs; i++) {
    const r0 = i * cols, r1 = (i + 1) * cols;
    for (let j = 0; j < radSegs; j++) {
      idx.push(r0 + j, r1 + j, r0 + j + 1);
      idx.push(r0 + j + 1, r1 + j, r1 + j + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Smooth chamfered oval-domed 30L alpine avalanche-airbag backpack shell (zero flat cylinder rims!). */
function buildPackGeo() {
  const radSegs = 28, lenSegs = 18;
  const pos = [], uvs = [], idx = [];
  const cols = radSegs + 1;
  for (let i = 0; i <= lenSegs; i++) {
    const v = i / lenSegs; // 0 bottom cap -> 1 rounded top lid
    const y = THREE.MathUtils.lerp(0.03, 0.48, v);
    const capEnv = Math.sin(Math.pow(v, 0.85) * Math.PI);
    const profile = Math.pow(Math.max(0.04, capEnv), 0.25);
    const rx = (0.172 - v * 0.018) * profile;
    const rz = (0.088 - Math.abs(v - 0.5) * 0.020) * profile;
    for (let j = 0; j <= radSegs; j++) {
      const u = j / radSegs;
      const th = u * Math.PI * 2.0;
      const c = Math.cos(th), s = Math.sin(th);
      const sx = Math.sign(c) * Math.pow(Math.abs(c), 0.72);
      const sz = Math.sign(s) * Math.pow(Math.abs(s), 0.78);
      // Flatten back pad gently where it hugs the jacket spine (s < 0)
      const zFlat = s < 0 ? sz * rz * 0.52 : sz * rz * 1.04;
      pos.push(sx * rx, y, 0.152 + zFlat);
      uvs.push(u * 1.5, v * 1.5);
    }
  }
  for (let i = 0; i < lenSegs; i++) {
    const r0 = i * cols, r1 = (i + 1) * cols;
    for (let j = 0; j < radSegs; j++) {
      idx.push(r0 + j, r1 + j, r0 + j + 1);
      idx.push(r0 + j + 1, r1 + j, r1 + j + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function createSkiRig(skiTopsheetTex = null, terrainData = null) {
  const rootGroup = new THREE.Group();

  // 1. Slope-aligned Ski & Boot Group (`fpGroup`)
  const fpGroup = new THREE.Group();
  rootGroup.add(fpGroup);

  const skiPivot = new THREE.Group();
  const leftSki = createSkiMesh(true, skiTopsheetTex);
  const rightSki = createSkiMesh(false, skiTopsheetTex);
  leftSki.position.set(-SKI_SEP, 0.02, 0);
  rightSki.position.set(SKI_SEP, 0.02, 0);
  skiPivot.add(leftSki);
  skiPivot.add(rightSki);
  fpGroup.add(skiPivot);

  // 2. World-space Drop Shadow & Per-Ski Multiplicative Hourglass Shadow Ribbons
  const shadowTex = buildSkierDropShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  const groundShadowGeo = new THREE.PlaneGeometry(2.6, 3.6);
  groundShadowGeo.rotateX(-Math.PI / 2);
  const groundShadow = new THREE.Mesh(groundShadowGeo, shadowMat);
  groundShadow.renderOrder = 2;
  rootGroup.add(groundShadow);

  const leftShadowRib = createSkiShadowRibbon(20);
  const rightShadowRib = createSkiShadowRibbon(20);
  rootGroup.add(leftShadowRib.mesh, rightShadowRib.mesh);

  // Dynamic sun-ray-aligned DEM-snapped multiplicative HDR cobalt-slate PCF Shadow Catcher:
  // Oriented directly along the horizontal shadow axis (-sunDir.xz), dynamically ray-marched past the helmet
  // shadow tip (up to 38m downhill!) so low raking sun & steep slopes NEVER chop off the skier's head!
  const CATCH_SEGS_X = 14;
  const CATCH_SEGS_Z = 34;
  const CATCH_HALF_W = 3.8;
  const catcherGeo = new THREE.PlaneGeometry(1.0, 1.0, CATCH_SEGS_X, CATCH_SEGS_Z);
  catcherGeo.rotateX(-Math.PI / 2);
  const catchUvArr = new Float32Array((CATCH_SEGS_X + 1) * (CATCH_SEGS_Z + 1) * 2);
  let cuvi = 0;
  for (let iz = 0; iz <= CATCH_SEGS_Z; iz++) {
    const v = iz / CATCH_SEGS_Z; // 0 = back behind skier, 1 = far down-shadow tip
    for (let ix = 0; ix <= CATCH_SEGS_X; ix++) {
      catchUvArr[cuvi++] = ix / CATCH_SEGS_X;
      catchUvArr[cuvi++] = v;
    }
  }
  catcherGeo.setAttribute('aCatchUv', new THREE.BufferAttribute(catchUvArr, 2));
  const catchUniforms = {
    uCatchTint: { value: new THREE.Vector3(0.16, 0.27, 0.48) },
    uCatchStrength: { value: 0.90 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.5, 0.5) },
  };
  const catcherMat = new THREE.ShadowMaterial({
    color: new THREE.Color(0xffffff),
    opacity: 1.0,
    fog: false,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -4,
  });
  catcherMat.onBeforeCompile = (shader) => {
    shader.uniforms.uCatchTint = catchUniforms.uCatchTint;
    shader.uniforms.uCatchStrength = catchUniforms.uCatchStrength;
    shader.uniforms.uSunDir = catchUniforms.uSunDir;
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        'attribute vec2 aCatchUv;\nuniform vec3 uSunDir;\nvarying vec2 vCatchUv;\nvarying float vSunLit;\nvoid main() {'
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n\tvCatchUv = aCatchUv;\n\tvSunLit = smoothstep(-0.05, 0.10, dot(normalize(objectNormal), uSunDir));'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'uniform float opacity;',
        'uniform float opacity;\nuniform vec3 uCatchTint;\nuniform float uCatchStrength;\nvarying vec2 vCatchUv;\nvarying float vSunLit;'
      )
      .replace(
        'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',
        `float fadeX = smoothstep(0.0, 0.14, vCatchUv.x) * (1.0 - smoothstep(0.86, 1.0, vCatchUv.x));
        float fadeY = smoothstep(0.0, 0.06, vCatchUv.y) * (1.0 - smoothstep(0.88, 1.0, vCatchUv.y));
        float borderFade = fadeX * fadeY * vSunLit;
        float shOcc = clamp((1.0 - getShadowMask()) * uCatchStrength * borderFade, 0.0, 1.0);
        gl_FragColor = vec4(mix(vec3(1.0), uCatchTint, shOcc), 1.0);`
      );
  };
  catcherMat.customProgramCacheKey = () => 'chamonix_mult_shadow_catcher_v9';
  // True HDR linear multiplicative blend (`dst * src`) preserving dst.a so shadows blur WITH the rushing snow!
  catcherMat.blending = THREE.CustomBlending;
  catcherMat.blendEquation = THREE.AddEquation;
  catcherMat.blendSrc = THREE.DstColorFactor;
  catcherMat.blendDst = THREE.ZeroFactor;
  catcherMat.blendEquationAlpha = THREE.AddEquation;
  catcherMat.blendSrcAlpha = THREE.ZeroFactor;
  catcherMat.blendDstAlpha = THREE.OneFactor;
  const groundCatcher = new THREE.Mesh(catcherGeo, catcherMat);
  groundCatcher.receiveShadow = true;
  groundCatcher.frustumCulled = false;
  groundCatcher.renderOrder = 1;
  rootGroup.add(groundCatcher);

  // 3. FULL SCULPTED ARTICULATED SKIER BODY (Visible in BOTH First-Person POV AND 3rd-Person Drone/Replay!)
  // Gravity-aligned in yaw space when grounded (real upright athletic stance over sloped skis!),
  // and quaternion-aligned when airborne (so corks, backflips, and grabs rotate the entire body smoothly!).
  const bodyGroup = new THREE.Group();
  rootGroup.add(bodyGroup);

  // Procedural 512×512 3-layer hardshell ripstop weave, 256×256 full PBR oiled goat-leather (saddle-tan + dark reinforced palm),
  // herringbone woven nylon webbing & diagonal carbon-fiber weave!
  const ripJacket = buildRipstopTextures([216, 66, 38], 0.12, 4);
  const ripDark = buildRipstopTextures([48, 58, 74], 0.16, 4);
  const ripPants = buildRipstopTextures([46, 56, 72], 0.28, 4);
  const leatherTan = buildLeatherTextures([198, 138, 82], [134, 82, 44], 2.4);
  const leatherDark = buildLeatherTextures([76, 58, 48], [42, 32, 27], 2.8);
  const webTex = buildWebbingTextures([38, 44, 54], [82, 92, 106]);
  const carbonBump = buildCarbonBump();

  // High-craft freeride apparel materials (marked with alpha=0.0 so velocity motion blur keeps body, gloves & skis tack-sharp!)
  const pantsMat = markForeground(new THREE.MeshStandardMaterial({
    map: ripPants.map, roughness: 0.84, metalness: 0.04,
    bumpMap: ripPants.bumpMap, bumpScale: 0.017, roughnessMap: ripPants.roughMap,
  }), 0.40, 0.22);
  const corduraMat = markForeground(new THREE.MeshStandardMaterial({
    color: 0x262e3a, roughness: 0.86, metalness: 0.05,
    bumpMap: ripPants.bumpMap, bumpScale: 0.018,
  }), 0.34, 0.18);
  const seamMat = markForeground(new THREE.MeshStandardMaterial({
    color: 0x3b485c, roughness: 0.72, metalness: 0.06,
    bumpMap: ripPants.bumpMap, bumpScale: 0.012,
  }), 0.22, 0.20);
  const jacketMat = markForeground(new THREE.MeshStandardMaterial({
    map: ripJacket.map, roughness: 0.72, metalness: 0.04,
    bumpMap: ripJacket.bumpMap, bumpScale: 0.019, roughnessMap: ripJacket.roughMap,
  }), 0.22, 0.28);
  const jacketDarkMat = markForeground(new THREE.MeshStandardMaterial({
    map: ripDark.map, roughness: 0.74, metalness: 0.06,
    bumpMap: ripDark.bumpMap, bumpScale: 0.017, roughnessMap: ripDark.roughMap,
  }), 0.26, 0.24);
  const buckleMat = markForeground(new THREE.MeshStandardMaterial({ color: 0xb6c0ce, roughness: 0.20, metalness: 0.90 }), 0.05, 0.10);
  const orangePullMat = markForeground(new THREE.MeshStandardMaterial({ color: 0xf46824, roughness: 0.36, metalness: 0.10 }), 0.08, 0.20);
  const packMat = markForeground(new THREE.MeshStandardMaterial({
    map: ripDark.map, color: 0xd0d8e4, roughness: 0.78, metalness: 0.05,
    bumpMap: ripPants.bumpMap, bumpScale: 0.015,
  }), 0.24, 0.22);
  const helmetMat = markForeground(new THREE.MeshStandardMaterial({ color: 0x222936, roughness: 0.22, metalness: 0.30 }), 0.14, 0.14);
  const goggleMat = markForeground(new THREE.MeshStandardMaterial({ color: 0xee8c26, roughness: 0.05, metalness: 0.94 }), 0.0, 0.08);
  // Multi-panel freeride alpine-style freeride glove materials: oiled saddle-tan goat leather, reinforced espresso palm, dark slate 3L backhand!
  const gloveTanMat = markForeground(new THREE.MeshStandardMaterial({
    map: leatherTan.map, roughness: 0.64, metalness: 0.03,
    bumpMap: leatherTan.bumpMap, bumpScale: 0.025, roughnessMap: leatherTan.roughMap,
  }), 0.30, 0.30);
  const glovePalmMat = markForeground(new THREE.MeshStandardMaterial({
    map: leatherDark.map, roughness: 0.70, metalness: 0.05,
    bumpMap: leatherDark.bumpMap, bumpScale: 0.020, roughnessMap: leatherDark.roughMap,
  }), 0.28, 0.22);
  const gloveShellMat = markForeground(new THREE.MeshStandardMaterial({
    map: ripDark.map, color: 0xc8d2e0, roughness: 0.72, metalness: 0.05,
    bumpMap: ripDark.bumpMap, bumpScale: 0.016, roughnessMap: ripDark.roughMap,
  }), 0.34, 0.26);
  const stitchMat = markForeground(new THREE.MeshStandardMaterial({ color: 0xe6c391, roughness: 0.85, metalness: 0.02 }), 0.12, 0.20);
  const webbingMat = markForeground(new THREE.MeshStandardMaterial({
    map: webTex.map, bumpMap: webTex.bumpMap, bumpScale: 0.011,
    color: 0xffffff, roughness: 0.80, metalness: 0.04,
  }), 0.22, 0.24);
  const rubberTabMat = markForeground(new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: 0.60, metalness: 0.08 }), 0.16, 0.16);
  const badgeMat = markForeground(new THREE.MeshStandardMaterial({ color: 0xdce4ee, roughness: 0.42, metalness: 0.25 }), 0.05, 0.14);

  // --- Articulated Legs (sculpted cloth-draped hardshell freeride pants w/ diagonal knee pleats & rounded bellows pockets!) ---
  const buildLegRig = (side) => {
    const shinSeg = makeSculptedLimbSegment(0.074, 0.078, pantsMat, {
      radSegs: 24, lenSegs: 18, scaleX: 0.96, scaleZ: 1.06, bulgeMid: 0.009,
      foldAmp: 0.0052, foldFreq: 5.0, phase: side * 1.1, gatherBot: 0.65, gatherTop: 0.45,
    });
    // Flared Cordura boot-cuff snow gaiter + contoured curved inner-ankle scuff guard (replaces sharp box!)
    const gaiter = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.088, 0.25, 24), corduraMat);
    gaiter.position.set(0, -0.39, 0);
    shinSeg.add(gaiter);
    const kickCurve = new THREE.CylinderGeometry(0.080, 0.090, 0.30, 16, 1, true, side > 0 ? Math.PI * 0.68 : -Math.PI * 0.32, Math.PI * 0.64);
    const kickPatch = new THREE.Mesh(kickCurve, corduraMat);
    kickPatch.position.set(-side * 0.004, -0.34, 0.0);
    shinSeg.add(kickPatch);
    bodyGroup.add(shinSeg);

    // Sculpted articulated knee joint with front-facing (-Z) pleated reinforcement dart patch
    const kneeBall = new THREE.Group();
    const kneeCore = new THREE.Mesh(new THREE.SphereGeometry(0.079, 22, 16), pantsMat);
    kneeCore.scale.set(0.98, 1.06, 1.08);
    kneeBall.add(kneeCore);
    const kneePatch = new THREE.Mesh(new THREE.SphereGeometry(0.078, 20, 12, Math.PI * 1.5 - 0.78, 1.56, 0.95, 1.22), seamMat);
    kneePatch.scale.set(1.03, 1.05, 1.09);
    kneeBall.add(kneePatch);
    for (const dy of [-0.022, 0.024]) {
      const dart = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.0024, 6, 16, Math.PI * 0.55), corduraMat);
      dart.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.22);
      dart.position.set(0, dy, -0.012);
      kneeBall.add(dart);
    }
    bodyGroup.add(kneeBall);

    const thighSeg = makeSculptedLimbSegment(0.079, 0.099, pantsMat, {
      radSegs: 24, lenSegs: 18, scaleX: 0.96, scaleZ: 1.08, bulgeMid: 0.012,
      foldAmp: 0.0056, foldFreq: 4.5, phase: side * 2.3, gatherBot: 0.55, gatherTop: 0.30,
    });
    // Rounded contoured bellows cargo thigh pocket + curved AquaGuard vent zipper + cord pull (ZERO gap!)
    const pocketBody = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 12), seamMat);
    pocketBody.scale.set(0.32, 1.85, 0.96);
    pocketBody.position.set(side * 0.071, -0.01, -0.018);
    thighSeg.add(pocketBody);
    const zipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.078, -0.22, -0.014),
      new THREE.Vector3(side * 0.087,  0.00, -0.018),
      new THREE.Vector3(side * 0.092,  0.22, -0.014),
    ]);
    thighSeg.add(new THREE.Mesh(new THREE.TubeGeometry(zipCurve, 12, 0.0055, 6, false), corduraMat));
    const flapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.077, 0.095, -0.064),
      new THREE.Vector3(side * 0.089, 0.098, -0.018),
      new THREE.Vector3(side * 0.078, 0.095,  0.026),
    ]);
    thighSeg.add(new THREE.Mesh(new THREE.TubeGeometry(flapCurve, 10, 0.0095, 8, false), seamMat));
    const zipPull = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.0052, 0.024, 4, 8) : new THREE.CylinderGeometry(0.0052, 0.0052, 0.030, 8), orangePullMat);
    zipPull.position.set(side * 0.091, 0.19, -0.018);
    thighSeg.add(zipPull);
    bodyGroup.add(thighSeg);

    return { shinSeg, kneeBall, thighSeg };
  };
  const legL = buildLegRig(-1);
  const legR = buildLegRig(1);

  // --- Pelvis / Hips & Long Draped Freeride Jacket Parka Hem (smooth continuous seat, ZERO bulbous spheres!) ---
  const pelvisNode = new THREE.Group();
  bodyGroup.add(pelvisNode);

  const hipCore = new THREE.Mesh(new THREE.CylinderGeometry(0.198, 0.194, 0.25, 32), pantsMat);
  hipCore.scale.set(1.09, 1.0, 0.72);
  pelvisNode.add(hipCore);
  for (const s of [-1, 1]) {
    const hipCap = new THREE.Mesh(new THREE.SphereGeometry(0.092, 20, 14), pantsMat);
    hipCap.scale.set(0.96, 0.90, 0.94);
    hipCap.position.set(s * 0.096, -0.050, -0.004);
    pelvisNode.add(hipCap);
  }

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.196, 0.194, 0.038, 28), webbingMat);
  belt.scale.set(1.07, 1.0, 0.70);
  belt.position.set(0, 0.088, 0);
  pelvisNode.add(belt);
  const beltBuckle = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), buckleMat);
  beltBuckle.scale.set(1.15, 0.78, 0.45);
  beltBuckle.position.set(0, 0.088, -0.132);
  pelvisNode.add(beltBuckle);

  // --- Articulated Upper Torso (Sculpted V-Taper Chamonix Alpenglow Vermilion-Coral Hardshell Parka!) ---
  const torsoNode = new THREE.Group();
  torsoNode.position.set(0, 0.08, 0);
  pelvisNode.add(torsoNode);

  // Freeride parka skirt hem draped cleanly down over the upper seat & hips!
  const jacketHem = new THREE.Mesh(new THREE.CylinderGeometry(0.198, 0.224, 0.22, 32), jacketMat);
  jacketHem.scale.set(1.08, 1.0, 0.71);
  jacketHem.position.set(0, 0.008, 0.004);
  torsoNode.add(jacketHem);

  // Upper chest front group (hidden strictly in sternum-mounted chesty action-cam cam so ZERO red jacket polygons clip near plane!)
  const chestFrontGroup = new THREE.Group();
  torsoNode.add(chestFrontGroup);

  // Single continuous sculpted 32x22 V-taper hardshell torso loft with waist gather pleats & pec fullness!
  const chestCore = new THREE.Mesh(buildJacketTorsoGeo(), jacketMat);
  chestFrontGroup.add(chestCore);

  // Tapered athletic shoulder reinforcement yoke (flush with trapezius slope — ZERO protruding collar shelf!)
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.146, 0.210, 0.082, 32), jacketDarkMat);
  yoke.scale.set(1.07, 1.0, 0.63);
  yoke.position.set(0, 0.448, 0.002);
  chestFrontGroup.add(yoke);
  const yokeCap = new THREE.Mesh(new THREE.SphereGeometry(0.150, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), jacketDarkMat);
  yokeCap.scale.set(1.06, 0.26, 0.62);
  yokeCap.position.set(0, 0.486, 0.002);
  chestFrontGroup.add(yokeCap);
  const neckBuff = new THREE.Mesh(new THREE.SphereGeometry(0.080, 24, 14), corduraMat);
  neckBuff.scale.set(1.0, 0.72, 0.96);
  neckBuff.position.set(0, 0.520, 0.004);
  chestFrontGroup.add(neckBuff);

  // Surface-hugging curved YKK AquaGuard matte waterproof front zipper welt (`TubeGeometry`!) + hypalon pull tab
  const fZipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.00, -0.130),
    new THREE.Vector3(0, 0.14, -0.120),
    new THREE.Vector3(0, 0.34, -0.146),
    new THREE.Vector3(0, 0.46, -0.128),
  ]);
  chestFrontGroup.add(new THREE.Mesh(new THREE.TubeGeometry(fZipCurve, 16, 0.0075, 8, false), jacketDarkMat));
  const zipTab = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.0055, 0.018, 4, 8) : new THREE.CylinderGeometry(0.0055, 0.0055, 0.024, 8), orangePullMat);
  zipTab.position.set(0, 0.415, -0.142);
  zipTab.rotation.x = 0.24;
  chestFrontGroup.add(zipTab);

  // Curved woven sternum cross-strap + contoured avalanche airbag buckle + curved backpack shoulder harness straps!
  const sternCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.126, 0.28, -0.118),
    new THREE.Vector3(-0.062, 0.28, -0.142),
    new THREE.Vector3( 0.000, 0.28, -0.148),
    new THREE.Vector3( 0.062, 0.28, -0.142),
    new THREE.Vector3( 0.126, 0.28, -0.118),
  ]);
  chestFrontGroup.add(new THREE.Mesh(new THREE.TubeGeometry(sternCurve, 16, 0.0095, 8, false), webbingMat));
  const sternumClip = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 10), orangePullMat);
  sternumClip.scale.set(1.25, 0.78, 0.62);
  sternumClip.position.set(0, 0.28, -0.150);
  chestFrontGroup.add(sternumClip);

  for (const s of [-1, 1]) {
    // Angled Napoleon chest pocket zip welt + tiny pull loop
    const pktCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.068, 0.39, -0.132),
      new THREE.Vector3(s * 0.088, 0.34, -0.144),
      new THREE.Vector3(s * 0.100, 0.28, -0.136),
    ]);
    chestFrontGroup.add(new THREE.Mesh(new THREE.TubeGeometry(pktCurve, 10, 0.0052, 6, false), jacketDarkMat));
    // Curved woven backpack shoulder strap hugging smoothly over chest & shoulder yoke!
    const hsCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.122, 0.06, -0.106),
      new THREE.Vector3(s * 0.124, 0.20, -0.126),
      new THREE.Vector3(s * 0.132, 0.36, -0.134),
      new THREE.Vector3(s * 0.126, 0.495, -0.020),
      new THREE.Vector3(s * 0.112, 0.455,  0.115),
    ]);
    const hStrap = new THREE.Mesh(new THREE.TubeGeometry(hsCurve, 20, 0.017, 8, false), webbingMat);
    hStrap.scale.set(1.0, 1.0, 0.96);
    chestFrontGroup.add(hStrap);
    // Sleek vermilion raglan shoulder dome blending torso seamlessly into upper sleeves (ZERO bulky black robot pauldrons!)
    const shCap = new THREE.Mesh(new THREE.SphereGeometry(0.078, 20, 14), jacketMat);
    shCap.scale.set(0.90, 0.94, 0.96);
    shCap.position.set(s * 0.194, 0.418, 0.0);
    chestFrontGroup.add(shCap);
  }
  // Sculpted bright-orange ABS Avalanche Airbag deployment T-handle clipped onto left shoulder harness!
  const deploySleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.088, 12), orangePullMat);
  deploySleeve.position.set(-0.130, 0.33, -0.146);
  deploySleeve.rotation.z = 0.12;
  chestFrontGroup.add(deploySleeve);
  const deployGrip = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.0085, 0.042, 4, 8) : new THREE.CylinderGeometry(0.0085, 0.0085, 0.052, 8), orangePullMat);
  deployGrip.rotation.z = Math.PI * 0.5;
  deployGrip.position.set(-0.134, 0.285, -0.150);
  chestFrontGroup.add(deployGrip);

  // Sculpted Chamfered 30L Avalanche Airbag Backpack (flush straps + waist hipbelt, ZERO floating bars!)
  const packGroup = new THREE.Group();
  const packMain = new THREE.Mesh(buildPackGeo(), packMat);
  packGroup.add(packMain);
  const packLid = new THREE.Mesh(new THREE.SphereGeometry(0.144, 28, 14), corduraMat);
  packLid.scale.set(1.04, 0.28, 0.52);
  packLid.position.set(0, 0.456, 0.155);
  packGroup.add(packLid);
  // Subtle waist hipbelt straps wrapping CLEANLY outside jacket waist pleats (ZERO scalloped clipping!)
  const hipBelt = new THREE.Mesh(new THREE.CylinderGeometry(0.207, 0.209, 0.044, 32), webbingMat);
  hipBelt.scale.set(1.08, 1.0, 0.71);
  hipBelt.position.set(0, 0.085, 0.002);
  packGroup.add(hipBelt);
  // Diagonal woven ski-carry strap & vertical safety accent strictly FLUSH against pack rear surface (z <= 0.244!)
  const diagStrap = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.105, 0.12, 0.214),
    new THREE.Vector3( 0.000, 0.255, 0.241),
    new THREE.Vector3( 0.105, 0.39, 0.212),
  ]);
  packGroup.add(new THREE.Mesh(new THREE.TubeGeometry(diagStrap, 16, 0.0085, 8, false), webbingMat));
  const packAccent = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.13, 0.233),
    new THREE.Vector3(0, 0.255, 0.242),
    new THREE.Vector3(0, 0.38, 0.230),
  ]);
  packGroup.add(new THREE.Mesh(new THREE.TubeGeometry(packAccent, 14, 0.0068, 8, false), orangePullMat));
  torsoNode.add(packGroup);

  // Slim Storm Collar + Rear Folded Hood + Freeride Helmet + FRONT-FACING Toric Mirrored Goggles (3rd-person Drone/Scout/Replay!)
  const headGroup = new THREE.Group();
  // Slim articulated storm collar (tucked cleanly around neck, NOT a giant bulky cone!)
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.140, 0.095, 24), jacketMat);
  hood.position.set(0, 0.525, 0.010);
  headGroup.add(hood);
  // Folded storm hood resting naturally BEHIND the neck only (+Z, tucked cleanly behind helmet collar!)
  const hoodFold = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.022, 10, 20, Math.PI * 0.85), jacketMat);
  hoodFold.rotation.set(Math.PI * 0.44, 0, Math.PI * 0.075);
  hoodFold.position.set(0, 0.542, 0.068);
  headGroup.add(hoodFold);

  const headNode = new THREE.Group();
  headNode.position.set(0, 0.655, -0.015);
  // Inner matte thermal balaclava / head core + subtle contoured nose/chin face-mask silhouette
  const faceMask = new THREE.Mesh(new THREE.SphereGeometry(0.116, 22, 16), corduraMat);
  faceMask.scale.set(0.90, 1.06, 0.98);
  faceMask.position.set(0, -0.022, -0.012);
  headNode.add(faceMask);
  // Sculpted matte freeride helmet shell wrapping crown, temples & ears (exposing goggle viewport & lower face mask!)
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 26, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), helmetMat);
  helmet.scale.set(0.97, 1.02, 1.09);
  helmet.position.set(0, 0.012, 0.005);
  headNode.add(helmet);
  const helmetRear = new THREE.Mesh(new THREE.SphereGeometry(0.133, 22, 14, Math.PI * 0.14, Math.PI * 0.72, Math.PI * 0.48, Math.PI * 0.34), helmetMat);
  helmetRear.scale.set(0.97, 1.02, 1.09);
  helmetRear.position.set(0, 0.012, 0.005);
  headNode.add(helmetRear);
  // Subtle molded freeride helmet brim visor over brow (facing -Z FRONT!)
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.130, 0.146, 0.020, 20, 1, true, Math.PI * 0.72, Math.PI * 0.56), helmetMat);
  brim.position.set(0, 0.036, -0.024);
  brim.rotation.x = 0.28;
  headNode.add(brim);
  // FRONT-FACING (-Z, phi centered at 1.5*PI!) curved toric mirrored-amber panoramic ski goggles + beveled TPU bezel + elastic strap!
  const gog = new THREE.Mesh(new THREE.SphereGeometry(0.139, 26, 14, Math.PI * 1.21, Math.PI * 0.58, Math.PI * 0.39, Math.PI * 0.27), goggleMat);
  gog.position.set(0, -0.006, -0.016);
  headNode.add(gog);
  const gogRim = new THREE.Mesh(new THREE.SphereGeometry(0.137, 26, 14, Math.PI * 1.19, Math.PI * 0.62, Math.PI * 0.37, Math.PI * 0.31), rubberTabMat);
  gogRim.position.set(0, -0.006, -0.012);
  headNode.add(gogRim);
  const gogStrap = new THREE.Mesh(new THREE.CylinderGeometry(0.133, 0.133, 0.044, 24, 1, true), webbingMat);
  gogStrap.position.set(0, -0.004, 0.006);
  headNode.add(gogStrap);
  // Rear orange goggle retention strap clip
  const rearClip = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.011, 0.034, 4, 8) : new THREE.CylinderGeometry(0.011, 0.011, 0.042, 8), orangePullMat);
  rearClip.position.set(0, -0.004, 0.140);
  headNode.add(rearClip);
  headGroup.add(headNode);
  torsoNode.add(headGroup);

  // Invisible shadow-caster-only helmet & hood proxy in First-Person POV:
  // `colorWrite: false, depthWrite: false` keeps it 100% invisible to camera (zero blocking, zero alpha touch!)
  // while `castShadow: true` gives your real-time cast snow shadow a REAL ski-helmet head instead of a headless silhouette!
  const shadowOnlyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const headShadowProxy = new THREE.Group();
  const hsHelm = new THREE.Mesh(new THREE.SphereGeometry(0.140, 12, 10), shadowOnlyMat);
  hsHelm.scale.set(0.96, 1.02, 1.08);
  hsHelm.position.set(0, 0.68, -0.02);
  hsHelm.castShadow = true;
  hsHelm.receiveShadow = false;
  hsHelm.frustumCulled = false;
  const hsNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.145, 0.16, 10), shadowOnlyMat);
  hsNeck.position.set(0, 0.56, 0.01);
  hsNeck.castShadow = true;
  hsNeck.receiveShadow = false;
  hsNeck.frustumCulled = false;
  headShadowProxy.add(hsHelm, hsNeck);
  torsoNode.add(headShadowProxy);

  // Invisible shadow-caster-only torso/pack proxy for Chesty Cam so snow shadow STILL shows full skier torso!
  const chestShadowProxy = new THREE.Group();
  const csTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.19, 0.44, 12), shadowOnlyMat);
  csTorso.scale.set(1.08, 1.0, 0.64);
  csTorso.position.set(0, 0.28, 0.0);
  csTorso.castShadow = true;
  csTorso.frustumCulled = false;
  const csPack = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.43, 12), shadowOnlyMat);
  csPack.scale.set(1.06, 1.0, 0.60);
  csPack.position.set(0, 0.26, 0.165);
  csPack.castShadow = true;
  csPack.frustumCulled = false;
  chestShadowProxy.add(csTorso, csPack);
  chestShadowProxy.visible = false;
  torsoNode.add(chestShadowProxy);

  // --- Sculpted Articulated Arms, Unscaled Velcro Storm Cuffs, Hero Freeride Leather Gloves & Locked Carbon Poles ---
  const gloveMats = { gloveTanMat, glovePalmMat, gloveShellMat, stitchMat, webbingMat, orangePullMat, buckleMat };
  const poleMats = { carbonTex: carbonBump, webTex };

  const buildArmRig = (side) => {
    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.076, 20, 14), jacketMat);
    shoulderBall.scale.set(0.94, 1.0, 0.96);
    bodyGroup.add(shoulderBall);

    // Fuller insulated athletic 3L hardshell vermilion upper-arm sleeve with natural cloth drape & diagonal folds!
    const upperSeg = makeSculptedLimbSegment(0.064, 0.074, jacketMat, {
      radSegs: 24, lenSegs: 16, scaleX: 0.96, scaleZ: 1.04, bulgeMid: 0.008,
      foldAmp: 0.0050, foldFreq: 4.5, phase: side * 0.9, gatherBot: 0.55, gatherTop: 0.35,
    });
    // Left upper-arm subtle Chamonix alpine patch emblem
    if (side < 0) {
      const patch = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 16), jacketDarkMat);
      patch.rotation.z = Math.PI * 0.5;
      patch.position.set(-0.073, 0.12, 0.0);
      upperSeg.add(patch);
      const patchTri = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.018, 3), badgeMat);
      patchTri.rotation.z = Math.PI * 0.5;
      patchTri.position.set(-0.076, 0.12, 0.0);
      upperSeg.add(patchTri);
    }
    bodyGroup.add(upperSeg);

    // Smooth cloth elbow dome with subtle reinforced dark-slate articulated dart gusset!
    const elbowBall = new THREE.Group();
    const elbCore = new THREE.Mesh(new THREE.SphereGeometry(0.066, 20, 14), jacketMat);
    elbCore.scale.set(0.95, 1.05, 1.02);
    elbowBall.add(elbCore);
    const elbGusset = new THREE.Mesh(new THREE.SphereGeometry(0.0668, 16, 10, Math.PI * 0.5 - 0.65, 1.3, 0.95, 1.15), jacketDarkMat);
    elbGusset.scale.set(1.01, 1.04, 1.04);
    elbowBall.add(elbGusset);
    bodyGroup.add(elbowBall);

    // Full vibrant vermilion-coral 3L hardshell forearm sleeve (gatherBot=0 so red sleeve tucks cleanly INSIDE charcoal storm cuff!)
    const lowerSeg = makeSculptedLimbSegment(0.041, 0.063, jacketMat, {
      radSegs: 24, lenSegs: 20, scaleX: 0.92, scaleZ: 1.08, bulgeMid: 0.006,
      foldAmp: 0.0038, foldFreq: 6.0, phase: side * 1.7 + 0.5, gatherBot: 0.0, gatherTop: 0.50,
    });
    bodyGroup.add(lowerSeg);

    // UNSCALED 1:1 wrist storm-cuff assembly (strictly +5mm wider than lowerSeg across y = -0.010..+0.048 -> razor-crisp hem!)
    const cuffNode = new THREE.Group();
    const cuffCollar = makeSculptedLimbSegment(0.050, 0.056, jacketDarkMat, {
      radSegs: 24, lenSegs: 8, scaleX: 0.93, scaleZ: 1.09,
      foldAmp: 0.0012, foldFreq: 8.0, phase: side * 0.6, gatherBot: 0.0, gatherTop: 0.0,
    });
    cuffCollar.scale.set(1.0, 0.058, 1.0);
    cuffCollar.position.set(0, 0.019, 0);
    cuffNode.add(cuffCollar);
    // Subtle dark rubberized lip binding flush at the exact jacket sleeve opening (y = -0.010)
    const cuffTrim = new THREE.Mesh(new THREE.TorusGeometry(0.050, 0.0038, 8, 24), rubberTabMat);
    cuffTrim.rotation.x = Math.PI * 0.5;
    cuffTrim.scale.set(0.93, 1.09, 1.0);
    cuffTrim.position.set(0, -0.010, 0);
    cuffNode.add(cuffTrim);
    // Curved molded Velcro wrist cinch strap hugging FLUSH around the outer charcoal storm cuff!
    const vPts = [];
    for (let k = 0; k <= 14; k++) {
      const a = (k / 14) * Math.PI * 1.15 - Math.PI * 0.35;
      const th = side > 0 ? a : Math.PI - a;
      vPts.push(new THREE.Vector3(Math.cos(th) * 0.054 * 0.93, 0.014, Math.sin(th) * 0.054 * 1.09));
    }
    const velcroStrap = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vPts), 16, 0.0068, 8, false), rubberTabMat);
    velcroStrap.scale.set(1.0, 0.65, 1.0);
    cuffNode.add(velcroStrap);
    // Subtle vermilion accent bar embossed flush on the Velcro pull tip
    const vTip = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.0032, 0.014, 4, 8) : new THREE.CylinderGeometry(0.0032, 0.0032, 0.018, 8), orangePullMat);
    vTip.position.set(side * 0.042, 0.014, -0.032);
    vTip.rotation.set(0, side * 0.4, Math.PI * 0.5);
    cuffNode.add(vTip);
    // Laminated waterproof RFID lift-pass pocket zipper flush on LEFT outer forearm (y = +0.085..+0.165 above cuff!)
    if (side < 0) {
      const passZip = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.048, 0.085, -0.022),
        new THREE.Vector3(-0.053, 0.130, -0.024),
        new THREE.Vector3(-0.057, 0.175, -0.022),
      ]);
      cuffNode.add(new THREE.Mesh(new THREE.TubeGeometry(passZip, 10, 0.0030, 6, false), rubberTabMat));
      const passPull = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.0028, 0.012, 4, 6) : new THREE.CylinderGeometry(0.0028, 0.0028, 0.016, 6), orangePullMat);
      passPull.position.set(-0.058, 0.165, -0.025);
      passPull.rotation.z = 0.25;
      cuffNode.add(passPull);
    }
    bodyGroup.add(cuffNode);

    // HERO multi-panel sculpted freeride alpine-style freeride leather glove + locked ergonomic carbon ski pole!
    const handNode = new THREE.Group();
    handNode.rotation.order = 'YXZ';
    const glove = buildFreerideGlove(side, gloveMats);
    handNode.add(glove);

    // Pole grip locked RIGIDLY inside the curled fingers & thumb (`-side*0.012, 0, -0.024`) -> ZERO shaft-through-palm clipping!
    const pole = createPoleMesh(side, poleMats);
    pole.position.set(-side * 0.012, 0.0, -0.024);
    handNode.add(pole);

    // Exact wrist socket anchor where forearm sleeve meets glove gauntlet (`z = +0.100`)
    const wristAnchor = new THREE.Object3D();
    wristAnchor.position.set(side * 0.004, -0.001, 0.098);
    handNode.add(wristAnchor);

    bodyGroup.add(handNode);
    return { shoulderBall, upperSeg, elbowBall, lowerSeg, cuffNode, handNode, pole, wristAnchor };
  };
  const armL = buildArmRig(-1);
  const armR = buildArmRig(1);

  // Enable live real-time hardware PCF self-shadowing across ALL skier body, poles, boots, bindings & skis!
  const enableShadows = (node) => {
    node.traverse((child) => {
      if (
        child.isMesh &&
        child !== leftSki.userData.dustMesh &&
        child !== rightSki.userData.dustMesh &&
        child !== leftSki.userData.bowWaveMesh &&
        child !== rightSki.userData.bowWaveMesh &&
        child.material !== shadowOnlyMat
      ) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  };
  enableShadows(fpGroup);
  enableShadows(bodyGroup);

  let snowDustLevel = 0.0;
  let grabBlend = 0.0;
  let airRigBlend = 0.0;
  let smoothFlexL = 0.0;
  let smoothFlexR = 0.0;
  let flowDist = 0.0;
  let smoothPowSinkL = 0.0;
  let smoothPowSinkR = 0.0;
  let lastPosX = NaN;
  let lastPosZ = NaN;
  const _bodyQTarget = new THREE.Quaternion();
  const _bodyQSmooth = new THREE.Quaternion();
  let _bodyQInit = false;

  const lastDiag = {
    minClearLCm: 0,
    minClearRCm: 0,
    powSinkL: 0,
    powSinkR: 0,
    concaveFlexL: 0,
    concaveFlexR: 0,
    dyL: 0,
    dyR: 0,
    dpLDeg: 0,
    dpRDeg: 0,
    surface: 'powder',
  };

  const _rigRight = new THREE.Vector3();
  const _rigUp = new THREE.Vector3();
  const _rigFwd = new THREE.Vector3();
  const _ptW = new THREE.Vector3();
  const _snowLit = new THREE.Color(1.0, 1.0, 1.0);
  const _snowShad = new THREE.Color(0.32, 0.45, 0.68);
  const _snowSSS = new THREE.Color(0.14, 0.48, 0.90);
  const _skyFillCol = new THREE.Color();
  const _dirLightCol = new THREE.Color();
  const _bounceTmp = new THREE.Color();

  const FIT_T = [0.06, 0.18, 0.44, 0.64, 0.82, 0.96];
  const VERIFY_T = [0.06, 0.18, 0.32, 0.44, 0.64, 0.82, 0.96];
  const _errBuf = new Float64Array(FIT_T.length);
  const evalFlexAt = (t, f) => {
    if (t > 0.56) {
      const u = (t - 0.56) / 0.44;
      return u * u * f;
    }
    if (t < 0.24) {
      const u = (0.24 - t) / 0.24;
      return u * u * f * 0.35;
    }
    return 0;
  };

  const _nVec = new THREE.Vector3();
  const _castVec = new THREE.Vector3();
  const _along = new THREE.Vector3();
  const _across = new THREE.Vector3();
  const _trueUp = new THREE.Vector3();
  const _shMat = new THREE.Matrix4();
  const _sunDef = new THREE.Vector3(0.4, 0.5, 0.5);
  const _invBodyMat = new THREE.Matrix4();

  const _ankleL = new THREE.Vector3();
  const _ankleR = new THREE.Vector3();
  const _kneeL = new THREE.Vector3();
  const _kneeR = new THREE.Vector3();
  const _hipL = new THREE.Vector3();
  const _hipR = new THREE.Vector3();
  const _shL = new THREE.Vector3();
  const _shR = new THREE.Vector3();
  const _elbL = new THREE.Vector3();
  const _elbR = new THREE.Vector3();
  const _handL = new THREE.Vector3();
  const _handR = new THREE.Vector3();
  const _wristL = new THREE.Vector3();
  const _wristR = new THREE.Vector3();
  const _grabTargetW = new THREE.Vector3();

  return {
    group: rootGroup,
    lastDiag,
    update(state, dt, isThirdPerson, time, sunDir = _sunDef, isStorm = false, lookYawOff = 0, mtnSunVis = 1.0, isAlpenglow = false, isChesty = false, preset = null) {
      fpGroup.position.set(state.x, state.y, state.z);
      fpGroup.quaternion.copy(state.quat);

      const teleported = Number.isNaN(lastPosX) || Math.hypot(state.x - lastPosX, state.z - lastPosZ) > 3.5 || dt >= 0.45;
      lastPosX = state.x;
      lastPosZ = state.z;

      if (state.grounded && !state.crashed) {
        flowDist += state.speed * dt;
      }

      const surfId = state.surface ? state.surface.id : 'powder';
      const isPowder = surfId === 'powder';
      const isCorn = surfId === 'corn';

      // Light secondary dust cap on front shovel (kept subtle so markSkiSurface shader & bowWave lead the look!)
      if (state.grounded && isPowder && state.speed > 5) {
        snowDustLevel = Math.min(0.18, snowDustLevel + dt * (0.06 + Math.abs(state.slipAngle) * 0.16));
      } else {
        snowDustLevel = Math.max(0.0, snowDustLevel - dt * (state.grounded ? 0.08 : 0.25));
      }
      leftSki.userData.dustMat.opacity = snowDustLevel;
      rightSki.userData.dustMat.opacity = snowDustLevel;

      // Exact CPU cloudShadowAt() matching `terrain_renderer.js:284-288` 1:1 so ski powder snow matches passing cloud shadow bands!
      const fract = (v) => v - Math.floor(v);
      const hash21JS = (px, py) => {
        let x = fract(px * 123.34), y = fract(py * 456.21);
        const d = x * (x + 45.32) + y * (y + 45.32);
        x += d; y += d;
        return fract(x * y);
      };
      const vnoise2JS = (px, py) => {
        const ix = Math.floor(px), iy = Math.floor(py);
        const fx = px - ix, fy = py - iy;
        const ux = fx * fx * (3.0 - 2.0 * fx);
        const uy = fy * fy * (3.0 - 2.0 * fy);
        const a = hash21JS(ix, iy), b = hash21JS(ix + 1, iy);
        const c = hash21JS(ix, iy + 1), d = hash21JS(ix + 1, iy + 1);
        return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
      };
      const smoothStepJS = (e0, e1, v) => {
        const t = THREE.MathUtils.clamp((v - e0) / (e1 - e0), 0, 1);
        return t * t * (3 - 2 * t);
      };
      const cpX = (state.x - time * 22.0) * 0.00052;
      const cpZ = (state.z - time * 8.5) * 0.00052;
      const cloudN = vnoise2JS(cpX, cpZ) * 0.62 + vnoise2JS(cpX * 2.15 + 7.3, cpZ * 2.15 - 4.1) * 0.38;
      const cloudMask = preset ? (smoothStepJS(0.50, 0.78, cloudN) * (preset.cloudShadowStrength || 0) * (isStorm ? 0.2 : 1.0)) : 0;

      // Exact terrain-matched linear HDR snow lighting for BOTH `markSkiSurface` & `bowWaveMesh`!
      // Matches `terrain_renderer.js` snowAlb * (directLight + skyFill) 1:1 across Afternoon, Morning, Noon, Alpenglow & Storm!
      const directVis = (isStorm ? 0.30 : mtnSunVis) * (1.0 - cloudMask);
      if (preset) {
        const nVec = state.normal || _segUp;
        const dotNL = nVec.x * sunDir.x + nVec.y * sunDir.y + nVec.z * sunDir.z;
        const ndl = Math.max(0, dotNL);
        const wrap = Math.max(0, (dotNL + 0.06) / 1.06);
        const diffFactor = wrap * 0.14 + ndl * 0.86;
        const skyFactor = THREE.MathUtils.clamp(0.42 + 0.58 * nVec.y, 0.16, 1.0);
        _bounceTmp.copy(preset.groundBounceColor).multiplyScalar(0.64);
        _skyFillCol.copy(_bounceTmp).lerp(preset.shadowSkyColor, skyFactor).multiplyScalar(preset.shadowFillStrength * 0.84);
        _dirLightCol.copy(preset.sunColor).multiplyScalar(preset.sunIntensity * diffFactor * directVis);

        // Effective powder snow albedo matched to `terrain_renderer.js` (`snowAlb * cavityAO` average!)
        const albR = 0.77, albG = 0.825, albB = 0.90;
        _snowLit.setRGB(
          (_skyFillCol.r * 1.00 + _dirLightCol.r * 1.02) * albR,
          (_skyFillCol.g * 1.00 + _dirLightCol.g * 1.02) * albG,
          (_skyFillCol.b * 1.00 + _dirLightCol.b * 1.02) * albB
        );
        _snowShad.setRGB(
          (_skyFillCol.r * 0.90 + _dirLightCol.r * 0.52) * albR,
          (_skyFillCol.g * 0.90 + _dirLightCol.g * 0.52) * albG,
          (_skyFillCol.b * 0.90 + _dirLightCol.b * 0.52) * albB
        );
        const sssGain = (0.10 + 0.32 * directVis) * (isAlpenglow ? 0.45 : 0.72);
        _snowSSS.copy(preset.sssColor).multiplyScalar(sssGain);
      }

      // Dynamic ski edging, independent outside-ski weighting & scissor-spread landing absorption!
      const edge = state.edgeAngle;
      const unweight = state.insideUnweight || 0; // + = right turn (left ski weighted outside, right ski unweighted inside!)
      const scissor = state.scissorSpread || 0;
      const rollL = -edge * (edge > 0 ? 0.96 : 0.86);
      const rollR = -edge * (edge < 0 ? 0.96 : 0.86);

      // Smooth `airRigBlend` transitions ski pull, knees & body orientation cleanly on touchdown (NO 1-frame snap!)
      const airTarget = state.grounded ? 0.0 : 1.0;
      airRigBlend = teleported ? airTarget : (airRigBlend + (airTarget - airRigBlend) * (1.0 - Math.exp(-dt * (state.grounded ? 14.0 : 18.0))));
      const crouchOffset = -state.crouch * 0.14;
      const airPull = airRigBlend * (0.12 + grabBlend * 0.40);
      grabBlend += ((state.grabbing && !state.grounded ? 1 : 0) - grabBlend) * Math.min(1, dt * 14);

      // Keep `skiPivot.position.y = 0` when fully grounded so all terrain clearance is solved EXACTLY once in `fitSki`
      // without double-counting vertical offsets or dropping edges underground on steep slopes!
      skiPivot.position.set(0, airRigBlend * (crouchOffset + airPull), -airRigBlend * grabBlend * 0.22);
      skiPivot.rotation.set(
        airRigBlend * (grabBlend * 0.42 + state.foreAft * 0.18),
        airRigBlend * (grabBlend * 0.46 + state.shiftyAngle),
        0
      );

      const fwdX = Math.sin(state.yaw), fwdZ = -Math.cos(state.yaw);
      const rgtX = Math.cos(state.yaw), rgtZ = Math.sin(state.yaw);
      const vibL = state.grounded ? (Math.sin(time * 75.0) * 0.0040 * state.surface.chatter * Math.min(1, state.speed / 18)) : 0;
      const vibR = state.grounded ? (Math.sin(time * 69.0 + 1.9) * 0.0040 * state.surface.chatter * Math.min(1, state.speed / 18)) : 0;

      // Fore-aft ski lead combining athletic turn-lead, inside-ski advance & landing scissor-spread!
      const leadL = state.turnLead * 0.09 + scissor * 0.11;
      const leadR = -state.turnLead * 0.09 - scissor * 0.11;

      // Exact fpGroup orthonormal basis matching `state.quat` (`+X`=right, `+Y`=trueUp, `-Z`=forward)
      _rigRight.set(1, 0, 0).applyQuaternion(state.quat);
      _rigUp.set(0, 1, 0).applyQuaternion(state.quat);
      _rigFwd.set(0, 0, -1).applyQuaternion(state.quat);
      const upY = Math.max(0.32, _rigUp.y);

      // Pass 1: Exact 6-station world-space ski fitting + biting-edge drop compensation + concave roller flex!
      const cushion = isPowder ? 0.020 : 0.028; // perpendicular clearance of steel edge bevel ABOVE exact terrain triangles!
      let pitchErrL = 0, pitchErrR = 0, dyL = 0, dyR = 0;
      let concaveL = 0, concaveR = 0;

      const solveSkiPass1 = (sx, leadZ, roll) => {
        const cosR = Math.cos(roll);
        const absSinR = Math.abs(Math.sin(roll));
        const edgeSide = roll < -0.015 ? 1 : (roll > 0.015 ? -1 : 0);
        for (let k = 0; k < FIT_T.length; k++) {
          const t = FIT_T[k];
          const zk = (BOOT_T - t) * SKI_LEN;
          const along = -(zk + leadZ);
          const wx = state.x + _rigRight.x * sx + _rigFwd.x * along;
          const wy = state.y + _rigRight.y * sx + _rigFwd.y * along;
          const wz = state.z + _rigRight.z * sx + _rigFwd.z * along;
          let maxVertErr = terrainData.sampleHeight(wx, wz) - wy;
          const hw = evalSkiHalfWidth(t);
          if (edgeSide !== 0) {
            const eShift = edgeSide * hw * cosR;
            const errE = terrainData.sampleHeight(wx + _rigRight.x * eShift, wz + _rigRight.z * eShift) - (wy + _rigRight.y * eShift);
            if (errE > maxVertErr) maxVertErr = errE;
          } else {
            const errL = terrainData.sampleHeight(wx - _rigRight.x * hw, wz - _rigRight.z * hw) - (wy - _rigRight.y * hw);
            const errR = terrainData.sampleHeight(wx + _rigRight.x * hw, wz + _rigRight.z * hw) - (wy + _rigRight.y * hw);
            if (errL > maxVertErr) maxVertErr = errL;
            if (errR > maxVertErr) maxVertErr = errR;
          }
          // Exact perpendicular distance along `_rigUp` to reach terrain from tilted frame plane!
          _errBuf[k] = maxVertErr * upY;
        }
        // Pitch chord between tail (k=1, t=0.18) and shovel (k=4, t=0.82), span = 0.64 * SKI_LEN = 1.1776m
        const span = (FIT_T[4] - FIT_T[1]) * SKI_LEN;
        const dp = THREE.MathUtils.clamp(Math.atan2(_errBuf[4] - _errBuf[1], span), -0.44, 0.44);
        // Concave terrain compression: when BOTH tip and tail sit higher than waist, flex the ski upward smoothly!
        const concave = Math.max(0, 0.5 * (_errBuf[4] + _errBuf[1]) - _errBuf[2]);
        const concaveFlex = Math.min(0.085, concave * 1.05);
        return { dp, concaveFlex, errCopy: Float64Array.from(_errBuf), cosR, absSinR };
      };

      let p1L = null, p1R = null;
      if (state.grounded && terrainData) {
        p1L = solveSkiPass1(-SKI_SEP, leadL, rollL);
        p1R = solveSkiPass1(SKI_SEP, leadR, rollR);
        pitchErrL = p1L.dp;
        pitchErrR = p1R.dp;
        concaveL = p1L.concaveFlex;
        concaveR = p1R.concaveFlex;
      }

      // Combine dynamic load flex with concave terrain compression flex BEFORE updating vertices!
      const baseFlex = state.grounded
        ? (state.landImpact * 0.095 + Math.abs(edge) * 0.036 + Math.min(0.030, state.speed * 0.0011))
        : (grabBlend * 0.026);
      const loadBiasL = state.grounded ? (1.0 + THREE.MathUtils.clamp(unweight * 0.38, -0.30, 0.42)) : 1.0;
      const loadBiasR = state.grounded ? (1.0 - THREE.MathUtils.clamp(unweight * 0.38, -0.42, 0.30)) : 1.0;
      const targetFlexL = baseFlex * loadBiasL + concaveL;
      const targetFlexR = baseFlex * loadBiasR + concaveR;
      if (teleported) {
        smoothFlexL = targetFlexL;
        smoothFlexR = targetFlexR;
      } else {
        const flexAlpha = Math.min(1, dt * 16);
        smoothFlexL += (targetFlexL - smoothFlexL) * flexAlpha;
        smoothFlexR += (targetFlexR - smoothFlexR) * flexAlpha;
      }
      const chatterL = state.grounded ? Math.sin(time * 72.0) * 0.010 * state.surface.chatter * Math.min(1, state.speed / 16) * (0.85 + 0.3 * loadBiasL) : 0;
      const chatterR = state.grounded ? Math.sin(time * 67.0 + 2.1) * 0.010 * state.surface.chatter * Math.min(1, state.speed / 16) * (0.85 + 0.3 * loadBiasR) : 0;
      updateSkiFlex(leftSki, smoothFlexL, chatterL);
      updateSkiFlex(rightSki, smoothFlexR, chatterR);

      const computeNeedDy = (p1, flexVal) => {
        const { dp, errCopy, cosR, absSinR } = p1;
        const sinDp = Math.sin(dp);
        const cosDp = Math.cos(dp);
        let needDy = -1e9;
        for (let k = 0; k < FIT_T.length; k++) {
          const t = FIT_T[k];
          const zk = (BOOT_T - t) * SKI_LEN;
          const hw = evalSkiHalfWidth(t);
          const coreThick = 0.012 + 0.007 * Math.sin(t * Math.PI);
          const y0 = evalRockerY(t) + evalFlexAt(t, flexVal) + coreThick * 0.50;
          const yRotZ = -hw * absSinR + y0 * cosR;
          const edgeLocalY = yRotZ * cosDp - zk * sinDp;
          const req = (errCopy[k] + cushion) - edgeLocalY;
          if (req > needDy) needDy = req;
        }
        return THREE.MathUtils.clamp(needDy, -0.38, 0.48);
      };

      if (state.grounded && terrainData && p1L && p1R) {
        dyL = computeNeedDy(p1L, smoothFlexL);
        dyR = computeNeedDy(p1R, smoothFlexR);
      }

      // Independent inside-ski subtle unweighting lift & slight tip-rise on unweighted carving ski!
      const unweightLiftL = state.grounded && unweight < 0 ? Math.abs(unweight) * 0.036 : 0;
      const unweightLiftR = state.grounded && unweight > 0 ? Math.abs(unweight) * 0.036 : 0;
      const unweightPitchL = state.grounded && unweight < 0 ? Math.abs(unweight) * 0.045 : 0;
      const unweightPitchR = state.grounded && unweight > 0 ? Math.abs(unweight) * 0.045 : 0;

      leftSki.rotation.set(pitchErrL + unweightPitchL, 0, rollL);
      rightSki.rotation.set(pitchErrR + unweightPitchR, 0, rollR);
      leftSki.position.set(-SKI_SEP, dyL + unweightLiftL + vibL, leadL);
      rightSki.position.set(SKI_SEP, dyR + unweightLiftR + vibR, leadR);

      // Refresh world matrices, then run Pass 2 EXACT matrixWorld verification & residual clearance guarantee!
      fpGroup.updateMatrixWorld(true);
      let minClearL = 0, minClearR = 0;
      if (state.grounded && terrainData) {
        const targetVertClear = cushion / upY;
        const enforceClearance = (skiObj, flexVal) => {
          let minVert = 1e9;
          for (let iter = 0; iter < 2; iter++) {
            let maxDeficit = 0;
            minVert = 1e9;
            const mw = skiObj.matrixWorld;
            for (let k = 0; k < VERIFY_T.length; k++) {
              const t = VERIFY_T[k];
              const zk = (BOOT_T - t) * SKI_LEN;
              const hw = evalSkiHalfWidth(t);
              const coreThick = 0.012 + 0.007 * Math.sin(t * Math.PI);
              const yBevel = evalRockerY(t) + evalFlexAt(t, flexVal) + coreThick * 0.50;
              // Check BOTH left & right steel edges plus centerline!
              for (let s = -1; s <= 1; s++) {
                _ptW.set(s * hw, yBevel, zk).applyMatrix4(mw);
                const gy = terrainData.sampleHeight(_ptW.x, _ptW.z);
                const clear = _ptW.y - gy;
                if (clear < minVert) minVert = clear;
                const deficit = targetVertClear - clear;
                if (deficit > maxDeficit) maxDeficit = deficit;
              }
            }
            if (maxDeficit > 0.001) {
              skiObj.position.y += Math.min(0.45, maxDeficit * upY);
              skiObj.updateMatrixWorld(true);
            } else {
              break;
            }
          }
          // Recompute final exact minimum steel-edge vertical clearance above terrain (meters)
          let finalMin = 1e9;
          const mw = skiObj.matrixWorld;
          for (let k = 0; k < VERIFY_T.length; k++) {
            const t = VERIFY_T[k];
            const zk = (BOOT_T - t) * SKI_LEN;
            const hw = evalSkiHalfWidth(t);
            const coreThick = 0.012 + 0.007 * Math.sin(t * Math.PI);
            const yBevel = evalRockerY(t) + evalFlexAt(t, flexVal) + coreThick * 0.50;
            for (let s = -1; s <= 1; s++) {
              _ptW.set(s * hw, yBevel, zk).applyMatrix4(mw);
              const clear = _ptW.y - terrainData.sampleHeight(_ptW.x, _ptW.z);
              if (clear < finalMin) finalMin = clear;
            }
          }
          return finalMin;
        };
        minClearL = enforceClearance(leftSki, smoothFlexL);
        minClearR = enforceClearance(rightSki, smoothFlexR);
      }

      // Compute deliberate, dynamic, physically-driven deep-powder immersion per ski!
      // Skis sink gently when standing/slow, pressure-diving (W), landing, or carving on outside weighted ski;
      // they plane cleanly UP onto the surface at high speed or when leaning back (S) in powder!
      let targetPowL = 0.0, targetPowR = 0.0;
      if (state.grounded && !state.crashed) {
        const fore = state.foreAft || 0; // + = pressure forward (W), - = lean back float (S)
        const absEdge = Math.abs(edge);
        const slipFactor = Math.abs(Math.sin(state.slipAngle || 0));
        if (isPowder) {
          const speedRelief = THREE.MathUtils.clamp((state.speed - 5.0) / 16.0, 0, 1) * 0.25;
          const backFloat = Math.max(0, -fore) * 0.24;
          const noseDive = Math.max(0, fore) * 0.18;
          const stomp = (state.landImpact || 0) * 0.30;
          const basePow = 0.62 - speedRelief - backFloat + noseDive + stomp + absEdge * 0.14 + slipFactor * 0.16;
          // Outside weighted ski digs deeper than unweighted inside ski!
          targetPowL = THREE.MathUtils.clamp(basePow + unweight * 0.14 + THREE.MathUtils.clamp(concaveL * 3.5, 0, 0.20), 0.22, 0.94);
          targetPowR = THREE.MathUtils.clamp(basePow - unweight * 0.14 + THREE.MathUtils.clamp(concaveR * 3.5, 0, 0.20), 0.22, 0.94);
        } else if (isCorn) {
          const cornSlush = THREE.MathUtils.clamp((absEdge * 0.26 + slipFactor * 0.24) * Math.min(1, state.speed / 8.0), 0, 0.28);
          targetPowL = cornSlush;
          targetPowR = cornSlush;
        }
      }
      if (teleported) {
        smoothPowSinkL = targetPowL;
        smoothPowSinkR = targetPowR;
      } else {
        const powAlpha = 1.0 - Math.exp(-dt * (state.grounded ? 8.5 : 5.5));
        smoothPowSinkL += (targetPowL - smoothPowSinkL) * powAlpha;
        smoothPowSinkR += (targetPowR - smoothPowSinkR) * powAlpha;
        if (smoothPowSinkL < 0.002 && targetPowL === 0) smoothPowSinkL = 0;
        if (smoothPowSinkR < 0.002 && targetPowR === 0) smoothPowSinkR = 0;
      }

      // Sync shared foreground snow-bounce fill & dynamic frost dusting to current alpine lighting preset!
      const powAvg = 0.5 * (smoothPowSinkL + smoothPowSinkR);
      fgSharedUniforms.uFgFrost.value = THREE.MathUtils.clamp(snowDustLevel * 2.1 + powAvg * 0.42, 0.0, 0.72);
      if (preset) {
        const sunFill = isStorm ? 0.30 : (0.24 + 0.24 * mtnSunVis);
        fgSharedUniforms.uFgBounceAmt.value = isAlpenglow ? sunFill * (0.48 + 0.38 * mtnSunVis) : sunFill;
        fgSharedUniforms.uFgBounceCol.value.copy(preset.groundBounceColor).lerp(preset.sunColor, isStorm ? 0.12 : 0.42);
        fgSharedUniforms.uFgRimCol.value.copy(preset.shadowSkyColor).lerp(preset.sunColor, isStorm ? 0.22 : 0.48);
      }

      // Sync `markSkiSurface` true optical alpha-dissolve powder immersion uniforms on both skis!
      const syncPowder = (skiObj, sinkVal, edgeVal) => {
        const pu = skiObj.userData.powderUniforms;
        if (!pu) return;
        pu.uPowSink.value = sinkVal;
        pu.uEdgeRoll.value = edgeVal;
        pu.uFlowDist.value = flowDist;
        pu.uSnowLitCol.value.copy(_snowLit);
        pu.uSnowShadCol.value.copy(_snowShad);
        pu.uSnowSSSCol.value.copy(_snowSSS);
        pu.uPowSunVis.value = mtnSunVis;
        pu.uPowStorm.value = isStorm ? 1.0 : 0.0;
        // Solid depthWrite when firm/airborne; soft optical alpha-dissolve when nestled in deep powder!
        skiObj.userData.baseBlade.material.depthWrite = sinkVal < 0.02;
        // Disable buried-waist shadow-map leak in deep powder (leftShadowRib/rightShadowRib cast exact uEmergeT-clipped tip shadows!)
        skiObj.userData.baseBlade.castShadow = !(state.grounded && sinkVal > 0.25);
      };
      syncPowder(leftSki, smoothPowSinkL, -rollL / 0.96);
      syncPowder(rightSki, smoothPowSinkR, -rollR / 0.96);

      // Update 3D dynamic powder bow-wave spray sheets STRICTLY when moving/carving (ZERO static white fog halos when stopped!)
      const rawBow = (state.grounded && !state.crashed && state.speed > 3.5) ? (state.bowWave || 0) : 0;
      const syncBow = (skiObj, scaleBias, sinkVal, skiRoll) => {
        const bm = skiObj.userData.bowWaveMesh;
        const bu = skiObj.userData.bowUniforms;
        if (!bm || !bu) return;
        const val = THREE.MathUtils.clamp(rawBow * scaleBias, 0, 1.15);
        bm.visible = val > 0.035;
        if (bm.visible) {
          bu.uTime.value = time;
          bu.uFlowDist.value = flowDist;
          bu.uIntensity.value = val;
          bu.uNestAmt.value = 0.0;
          bu.uEdgeBias.value = edge;
          bu.uSkiRoll.value = skiRoll;
          bu.uSunDir.value.copy(sunDir);
          bu.uStorm.value = isStorm ? 1.0 : 0.0;
          bu.uSunVis.value = directVis;
          bu.uSnowLitCol.value.copy(_snowLit);
          bu.uSnowShadCol.value.copy(_snowShad);
          bu.uSnowSSSCol.value.copy(_snowSSS);
          if (preset) {
            bu.uSunColor.value.copy(preset.sunColor);
            bu.uSunIntensity.value = preset.sunIntensity;
            bu.uShadowSky.value.copy(preset.shadowSkyColor);
            bu.uShadowFill.value = preset.shadowFillStrength;
          }
        }
      };
      // Weighted outside carving ski drives the main bow-wave curl; unweighted inside ski stays razor-clean!
      syncBow(leftSki, edge > 0.08 ? 1.08 : (edge < -0.08 ? 0.44 : 0.92), smoothPowSinkL, rollL);
      syncBow(rightSki, edge < -0.08 ? 1.08 : (edge > 0.08 ? 0.44 : 0.92), smoothPowSinkR, rollR);

      // Record live ski-grounding & powder diagnostics for programmatic assertions
      lastDiag.minClearLCm = +(minClearL * upY * 100).toFixed(2);
      lastDiag.minClearRCm = +(minClearR * upY * 100).toFixed(2);
      lastDiag.minVertLCm = +(minClearL * 100).toFixed(2);
      lastDiag.minVertRCm = +(minClearR * 100).toFixed(2);
      lastDiag.powSinkL = +smoothPowSinkL.toFixed(3);
      lastDiag.powSinkR = +smoothPowSinkR.toFixed(3);
      lastDiag.concaveFlexL = +(concaveL * 100).toFixed(2);
      lastDiag.concaveFlexR = +(concaveR * 100).toFixed(2);
      lastDiag.dyL = +(leftSki.position.y * 100).toFixed(2);
      lastDiag.dyR = +(rightSki.position.y * 100).toFixed(2);
      lastDiag.dpLDeg = +THREE.MathUtils.radToDeg(pitchErrL).toFixed(1);
      lastDiag.dpRDeg = +THREE.MathUtils.radToDeg(pitchErrR).toFixed(1);
      lastDiag.surface = surfId;

      // --- UPDATE WORLD-SPACE GROUND-SNAPPED HOURGLASS SHADOW RIBBONS ---
      const clearance = Math.max(0, state.y - state.terrainY);
      const showSkiRibbons = !state.crashed && terrainData && clearance < 0.95;
      leftShadowRib.mesh.visible = showSkiRibbons;
      rightShadowRib.mesh.visible = showSkiRibbons;
      if (showSkiRibbons) {
        const sunY = Math.max(0.28, sunDir.y);
        const castX = -sunDir.x / sunY;
        const castZ = -sunDir.z / sunY;
        const castLen = Math.hypot(castX, castZ);
        const maxCast = 2.4;
        const cX = castLen > maxCast ? (castX / castLen) * maxCast : castX;
        const cZ = castLen > maxCast ? (castZ / castLen) * maxCast : castZ;

        const updateRibbon = (rib, latX, leadZ, skiFlex, extraLift, powSinkVal) => {
          const pAttr = rib.geo.attributes.position;
          const lAttr = rib.geo.attributes.aLift;
          const useRig = state.grounded;
          const rX = useRig ? _rigRight.x : rgtX;
          const rZ = useRig ? _rigRight.z : rgtZ;
          const fX = useRig ? _rigFwd.x : fwdX;
          const fZ = useRig ? _rigFwd.z : fwdZ;
          const wLen = Math.hypot(rX, rZ) || 1.0;
          const rnX = rX / wLen, rnZ = rZ / wLen;
          for (let i = 0; i <= rib.segs; i++) {
            const t = i / rib.segs; // 0 = tail, 1 = tip
            const localForward = (t - BOOT_T) * SKI_LEN - leadZ;
            const rockLift = evalRockerY(t);
            const flexLift = skiFlex * (t > 0.56 ? Math.pow((t - 0.56) / 0.44, 2) : 0);
            const lift = Math.max(0.008, clearance + extraLift + rockLift + flexLift);
            const shOffX = isStorm ? 0 : cX * lift * 0.85;
            const shOffZ = isStorm ? 0 : cZ * lift * 0.85;
            const cx = state.x + rX * latX + fX * localForward + shOffX;
            const cz = state.z + rZ * latX + fZ * localForward + shOffZ;
            // Exact parabolic hourglass ski contour + crisp feathered snow contact penumbra!
            const skiHW = evalSkiHalfWidth(t);
            const halfW = skiHW + 0.036 + lift * 0.34;
            const lx = cx - rnX * halfW, lz = cz - rnZ * halfW;
            const rx = cx + rnX * halfW, rz = cz + rnZ * halfW;
            const ly = terrainData.sampleHeight(lx, lz) + 0.012;
            const ry = terrainData.sampleHeight(rx, rz) + 0.012;
            const vi = i * 2;
            pAttr.setXYZ(vi, lx, ly, lz);
            pAttr.setXYZ(vi + 1, rx, ry, rz);
            lAttr.setX(vi, lift);
            lAttr.setX(vi + 1, lift);
          }
          pAttr.needsUpdate = true;
          lAttr.needsUpdate = true;
          const fade = Math.max(0, 1.0 - clearance / 0.95);
          const catcherActive = !state.crashed && terrainData && !isStorm && mtnSunVis > 0.08 && clearance < 2.8;
          // In deep powder, clip shadow ribbon strictly behind emergence line so buried waist casts ZERO shadow ON TOP of snow!
          rib.mat.uniforms.uEmergeT.value = (powSinkVal > 0.02 && state.grounded)
            ? THREE.MathUtils.lerp(0.28, 0.80, THREE.MathUtils.clamp(powSinkVal, 0, 1))
            : -1.0;
          const powSoft = 1.0 - THREE.MathUtils.clamp(powSinkVal * 0.34, 0, 0.34);
          rib.mat.uniforms.uOpacity.value = (isStorm ? 0.56 : (catcherActive ? 0.68 : 0.88)) * fade * powSoft;
          if (isStorm) {
            rib.mat.uniforms.uTint.value.setRGB(0.50, 0.55, 0.62);
          } else if (isAlpenglow) {
            rib.mat.uniforms.uTint.value.setRGB(0.20, 0.25, 0.48);
          } else {
            rib.mat.uniforms.uTint.value.setRGB(0.22, 0.32, 0.52);
          }
        };
        updateRibbon(leftShadowRib, -SKI_SEP, leadL, smoothFlexL, unweightLiftL, smoothPowSinkL);
        updateRibbon(rightShadowRib, SKI_SEP, leadR, smoothFlexR, unweightLiftR, smoothPowSinkR);
      }

      // --- UPDATE FULL SCULPTED ARTICULATED BODY (CONNECTED IN BOTH FP POV AND 3RD-PERSON!) ---
      const showBody = !state.crashed || isThirdPerson;
      bodyGroup.visible = showBody;
      if (showBody) {
        bodyGroup.position.set(state.x, state.y, state.z);
        if (state.grounded) {
          // Real skiers stand upright against GRAVITY (not glued 40° perpendicular to steep cliff faces!)
          _bodyQTarget.setFromAxisAngle(_segUp, -state.yaw);
        } else {
          _bodyQTarget.copy(state.bodyQuat || state.quat);
        }
        if (!_bodyQInit || teleported) {
          _bodyQSmooth.copy(_bodyQTarget);
          _bodyQInit = true;
        } else {
          // Smooth slerp eliminates the jarring 1-frame orientation snap on jump landings!
          const qRate = state.grounded ? (airRigBlend > 0.02 ? 14.0 : 28.0) : 26.0;
          _bodyQSmooth.slerp(_bodyQTarget, 1.0 - Math.exp(-dt * qRate));
        }
        bodyGroup.quaternion.copy(_bodyQSmooth);
        bodyGroup.updateMatrixWorld(true);
        _invBodyMat.copy(bodyGroup.matrixWorld).invert();

        // In helmet FP POV: keep full torso/yoke/pack visible and hide ONLY helmet (`headGroup`).
        // In sternum-mounted `chesty` cam: hide ONLY the front chest shell (`chestFrontGroup`) & `packGroup` directly behind lens
        // so ZERO red jacket polygons clip the near plane while BOTH sleeves, gloves, poles, hips, thighs, knees & skis stay 100% visible!
        // Invisible `chestShadowProxy` keeps the live PCF snow shadow casting the complete skier torso!
        headGroup.visible = isThirdPerson;
        headShadowProxy.visible = !isThirdPerson;
        chestFrontGroup.visible = !isChesty;
        packGroup.visible = !isChesty;
        chestShadowProxy.visible = isChesty;
        // Hide proximal neck collar / yoke cap in helmet FP POV so steep downward/sideways glances NEVER reveal a bald severed dome
        // (both stay 100% rendered in 3rd-person replay/scout, and headShadowProxy keeps casting the full helmet shadow!).
        neckBuff.visible = isThirdPerson;
        yokeCap.visible = isThirdPerson;
        packLid.visible = isThirdPerson || (!isChesty && Math.abs(lookYawOff) < 0.85);
        // Hide shoulder joint caps right next to sternum camera in chesty cam so extreme glances NEVER see red cap polygons!
        armL.shoulderBall.visible = !isChesty;
        armR.shoulderBall.visible = !isChesty;

        // Exact world-space boot-cuff top anchors transformed into bodyGroup local space
        leftSki.userData.ankleAnchor.getWorldPosition(_ankleL).applyMatrix4(_invBodyMat);
        rightSki.userData.ankleAnchor.getWorldPosition(_ankleR).applyMatrix4(_invBodyMat);
        // Tuck ankle slightly inside the top of the boot cuff (-0.045m) so zero gap ever opens on steep slopes!
        _ankleL.y -= 0.045;
        _ankleR.y -= 0.045;

        const cr = state.crouch;
        const imp = state.landImpact || 0;
        const absEdge = Math.abs(edge);

        const airKneePull = airRigBlend * (0.10 + grabBlend * 0.24);
        const avgAnkleY = (_ankleL.y + _ankleR.y) * 0.5;
        // Natural athletic ski stance directly anchored around boots (smooth knee compression during jump landing absorption!)
        const kneeBendFwd = (isThirdPerson ? 0.11 : 0.04) + cr * 0.10 + imp * 0.085;
        const kneeHeight = 0.36 - cr * 0.10 - imp * 0.075 - absEdge * 0.04 + airKneePull * 0.28;
        const kneeLatShift = edge * 0.15;

        _kneeL.set(_ankleL.x + kneeLatShift * 0.85, _ankleL.y + kneeHeight + scissor * 0.025, _ankleL.z - kneeBendFwd);
        _kneeR.set(_ankleR.x + kneeLatShift * 0.85, _ankleR.y + kneeHeight - scissor * 0.025, _ankleR.z - kneeBendFwd);

        // Anchor pelvis consistently in gravity-upright boot frame (`z = +0.12m` behind boot center, independent of slope pitch!)
        const hipShiftX = edge * 0.22;
        const pelvisY = avgAnkleY + 0.65 - cr * 0.20 - imp * 0.17 - absEdge * 0.07 + airKneePull * 0.26;
        const pelvisZ = 0.13 + cr * 0.06 + imp * 0.05;

        pelvisNode.position.set(hipShiftX, pelvisY, pelvisZ);
        pelvisNode.rotation.set(
          -0.05 - cr * 0.12 - imp * 0.10,
          0,
          -edge * 0.42
        );

        _hipL.set(hipShiftX - 0.130, pelvisY - 0.03, pelvisZ - 0.01);
        _hipR.set(hipShiftX + 0.130, pelvisY - 0.03, pelvisZ - 0.01);

        placeLimbSegment(legL.shinSeg, _ankleL, _kneeL, 1.0);
        placeLimbSegment(legR.shinSeg, _ankleR, _kneeR, 1.0);
        legL.kneeBall.position.copy(_kneeL);
        legR.kneeBall.position.copy(_kneeR);
        placeLimbSegment(legL.thighSeg, _kneeL, _hipL, 1.0);
        placeLimbSegment(legR.thighSeg, _kneeR, _hipR, 1.0);

        // Double-pole skate push & active single-side diagonal pole-push kinematics (clearly visible in BOTH Helmet & Chesty POV!)
        const skatePush = state.grounded ? Math.max(state.skatePush || 0, (state.poleStrokePulse || 0) * 0.65) : 0;
        const skatePhase = state.skatePhase || 0;
        const skateReach = Math.cos(skatePhase); // +1 = arms forward stabbing poles into snow, -1 = swept behind hips
        const skateDrive = Math.max(0, Math.sin(skatePhase)); // +1 = peak torso crunch power drive!
        const plantL = state.grounded ? Math.sin(Math.min(1, state.polePlantL || 0) * Math.PI) : 0;
        const plantR = state.grounded ? Math.sin(Math.min(1, state.polePlantR || 0) * Math.PI) : 0;

        // Smooth periodic shoulder twist (sin avoids any 180° wrap jump!) as player turns head left/right!
        const headTwist = (isThirdPerson || isChesty) ? 0.0 : Math.sin(lookYawOff) * 0.36;
        const torsoLeanFwd = -0.11 - cr * 0.16 - imp * 0.14 - (state.foreAft || 0) * 0.08 - skatePush * skateDrive * 0.20 - Math.max(plantL, plantR) * 0.06;
        const plantTwist = (plantL - plantR) * 0.15;
        torsoNode.rotation.set(
          torsoLeanFwd,
          -edge * 0.26 - headTwist + plantTwist,
          edge * 0.30
        );
        headNode.rotation.set(0.18, edge * 0.20, 0);

        // Refresh torso world transform so arm tops sit DEAD-CENTER inside the rounded vermilion raglan shoulder domes!
        bodyGroup.updateMatrixWorld(true);
        _shL.set(-0.194, 0.418, 0.0).applyMatrix4(torsoNode.matrixWorld).applyMatrix4(_invBodyMat);
        _shR.set( 0.194, 0.418, 0.0).applyMatrix4(torsoNode.matrixWorld).applyMatrix4(_invBodyMat);

        const breathe = Math.sin(time * 2.4) * 0.008;
        const poleSwing = Math.sin(time * 3.1) * 0.020 * Math.min(1, state.speed / 12);
        const tuckIn = cr * 0.06;
        // Athletic balance-bracing arms widen & dip forward subtly during deep jump-landing compression!
        const braceSpread = imp * 0.085;
        const braceDip = imp * 0.055;
        const braceFwd = imp * 0.06;

        // Forward athletic "hands forward over ski tips" framing (clean Chest-Mount perspective showing cuffs, sleeves & leather gloves!)
        const cTw = Math.cos(headTwist), sTw = Math.sin(headTwist);
        const handFwd = isThirdPerson ? 0.40 : (isChesty ? 0.54 : 0.40);
        const handYOff = isThirdPerson ? 0.06 : (isChesty ? 0.055 : -0.05);
        const handSpread = isThirdPerson ? 0.34 : (isChesty ? 0.36 : 0.36);

        // Double-pole skate-push offsets (symmetric both arms!)
        const skFwd = skatePush * skateReach * 0.24;
        const skUp = skatePush * (skateReach * 0.15 - skateDrive * 0.08);
        const skElbFwd = skatePush * skateReach * 0.12;
        const skElbUp = skatePush * (skateReach * 0.08);

        // Left arm target with active left pole-plant reach, landing brace & double-pole push!
        const relLX = -handSpread - braceSpread + tuckIn - edge * 0.05 - plantL * 0.02;
        const relLZ = -handFwd - braceFwd - cr * 0.06 - plantL * 0.15 - skFwd;
        _handL.set(
          hipShiftX + relLX * cTw - relLZ * sTw,
          pelvisY + handYOff - braceDip - cr * 0.05 + breathe + poleSwing + plantL * 0.08 + skUp,
          pelvisZ + relLX * sTw + relLZ * cTw
        );
        const elbLX = -handSpread - 0.04 - braceSpread * 0.65 - plantL * 0.02;
        const elbLZ = 0.00 - plantL * 0.09 - skElbFwd;
        _elbL.set(
          hipShiftX + elbLX * cTw - elbLZ * sTw,
          pelvisY + 0.11 - braceDip * 0.5 + plantL * 0.06 + skElbUp,
          pelvisZ + elbLX * sTw + elbLZ * cTw
        );

        // Right arm target with active right pole-plant reach, landing brace & double-pole push!
        const relRX = handSpread + braceSpread - tuckIn - edge * 0.05 + plantR * 0.02;
        const relRZ = -handFwd - braceFwd - cr * 0.06 - plantR * 0.15 - skFwd;
        const baseHandRX = hipShiftX + relRX * cTw - relRZ * sTw;
        const baseHandRY = pelvisY + handYOff - braceDip - cr * 0.05 + breathe - poleSwing + plantR * 0.08 + skUp;
        const baseHandRZ = pelvisZ + relRX * sTw + relRZ * cTw;

        if (grabBlend > 0.02 && airRigBlend > 0.05) {
          const gW = grabBlend * airRigBlend;
          _grabTargetW.set(-0.04, 0.04, -0.36).applyMatrix4(rightSki.matrixWorld).applyMatrix4(_invBodyMat);
          _handR.set(
            THREE.MathUtils.lerp(baseHandRX, _grabTargetW.x, gW),
            THREE.MathUtils.lerp(baseHandRY, _grabTargetW.y + 0.03, gW),
            THREE.MathUtils.lerp(baseHandRZ, _grabTargetW.z, gW)
          );
          _elbR.set(
            THREE.MathUtils.lerp(hipShiftX + handSpread + 0.04, (_shR.x + _handR.x) * 0.5 + 0.12, gW),
            THREE.MathUtils.lerp(pelvisY + 0.11, (_shR.y + _handR.y) * 0.5 - 0.05, gW),
            THREE.MathUtils.lerp(pelvisZ + 0.00, (_shR.z + _handR.z) * 0.5 + 0.06, gW)
          );
        } else {
          _handR.set(baseHandRX, baseHandRY, baseHandRZ);
          const elbRX = handSpread + 0.04 + braceSpread * 0.65 + plantR * 0.02;
          const elbRZ = 0.00 - plantR * 0.09 - skElbFwd;
          _elbR.set(
            hipShiftX + elbRX * cTw - elbRZ * sTw,
            pelvisY + 0.11 - braceDip * 0.5 + plantR * 0.06 + skElbUp,
            pelvisZ + elbRX * sTw + elbRZ * cTw
          );
        }

        if (!isThirdPerson && airRigBlend > 0.02) {
          _handL.x -= 0.06 * airRigBlend;
          _handL.y -= 0.05 * airRigBlend;
          _handL.z += 0.06 * airRigBlend;
        }

        // Rigid-grip wrist orientation (`YXZ` Euler order): pole stays 100% locked inside the curled fingers & thumb!
        //  - pitch (`x`): -0.44 trails basket backward smoothly -> +0.68 plants shaft cleanly forward into snow!
        //  - yaw   (`y`): side * 0.22 angles both fists naturally inward across front of chest toward the ski tips!
        //  - roll  (`z`): side * 0.36 pronates backhand gently upward toward camera AND flares pole tips outward away from legs!
        const skatePolePitch = skatePush * (skateReach * 0.72 - 0.08);
        const pitchL = -0.42 - cr * 0.18 + imp * 0.16 + plantL * 0.64 + skatePolePitch;
        const pitchR = -0.42 - cr * 0.18 + imp * 0.16 + grabBlend * airRigBlend * 0.38 + plantR * 0.64 + skatePolePitch;

        // Place sculpted gloved hands FIRST so wristAnchor gives exact 3D socket for the forearm sleeve & unscaled storm cuff!
        armL.handNode.position.copy(_handL);
        armL.handNode.rotation.set(pitchL, -0.22 - headTwist + plantL * 0.08, -0.44 + plantL * 0.08 - braceSpread * 0.6);
        armL.pole.rotation.set(0, 0, 0);
        armL.handNode.updateMatrix();
        _wristL.copy(armL.wristAnchor.position).applyMatrix4(armL.handNode.matrix);

        armR.handNode.position.copy(_handR);
        armR.handNode.rotation.set(pitchR, 0.22 - headTwist - plantR * 0.08, 0.44 - grabBlend * airRigBlend * 0.30 - plantR * 0.08 + braceSpread * 0.6);
        armR.pole.rotation.set(0, 0, 0);
        armR.handNode.updateMatrix();
        _wristR.copy(armR.wristAnchor.position).applyMatrix4(armR.handNode.matrix);

        // Place upper arms, elbows, sculpted fuller vermilion forearms terminating DEAD-CENTER inside wrist gauntlets, & unscaled cuffs!
        armL.shoulderBall.position.copy(_shL);
        armL.shoulderBall.scale.setScalar(1.0);
        placeLimbSegment(armL.upperSeg, _elbL, _shL, 1.0);
        armL.elbowBall.position.copy(_elbL);
        armL.elbowBall.scale.setScalar(1.0);
        placeLimbSegment(armL.lowerSeg, _wristL, _elbL, 1.0);
        placeLimbSegment(armL.cuffNode, _wristL, _elbL, 1.0);
        armL.cuffNode.position.copy(_wristL);
        armL.cuffNode.scale.set(1.0, 1.0, 1.0);

        armR.shoulderBall.position.copy(_shR);
        armR.shoulderBall.scale.setScalar(1.0);
        placeLimbSegment(armR.upperSeg, _elbR, _shR, 1.0);
        armR.elbowBall.position.copy(_elbR);
        armR.elbowBall.scale.setScalar(1.0);
        placeLimbSegment(armR.lowerSeg, _wristR, _elbR, 1.0);
        placeLimbSegment(armR.cuffNode, _wristR, _elbR, 1.0);
        armR.cuffNode.position.copy(_wristR);
        armR.cuffNode.scale.set(1.0, 1.0, 1.0);
      }

      // Dynamic sun-ray-aligned DEM-snapped multiplicative HDR PCF Shadow Catcher:
      // Ray-marches the helmet top along -sunDir against the real DEM heightfield so low sun angles & steep downhill
      // slopes NEVER chop off the skier's head shadow (reaches up to 38m down-shadow with tighter spacing near skis!).
      const showCatcher = !state.crashed && terrainData && !isStorm && mtnSunVis > 0.08 && clearance < 2.8;
      groundCatcher.visible = showCatcher;
      if (showCatcher) {
        const pAttr = catcherGeo.attributes.position;
        const sunHorizLen = Math.hypot(sunDir.x, sunDir.z);
        const castX = sunHorizLen > 0.05 ? (-sunDir.x / sunHorizLen) : 0.0;
        const castZ = sunHorizLen > 0.05 ? (-sunDir.z / sunHorizLen) : 1.0;
        // Right vector yielding upward (+Y) triangle winding: (+castDir) x (+rightDir) = (0, +1, 0)
        const rx = castZ;
        const rz = -castX;

        // Exact 32-step terrain ray-march from helmet crown (y + 1.98m) down -sunDir
        const slopeRay = sunDir.y / Math.max(0.05, sunHorizLen);
        let headHitDist = 28.0;
        for (let stepD = 1; stepD <= 32; stepD++) {
          const d = stepD * 1.0;
          const rayY = state.y + 1.98 - d * slopeRay;
          const gy = terrainData.sampleHeight(state.x + castX * d, state.z + castZ * d);
          if (rayY <= gy) {
            headHitDist = d;
            break;
          }
        }
        const backDist = 2.6;
        const frontDist = THREE.MathUtils.clamp(headHitDist * 1.32 + 5.0, 9.0, 38.0);
        const spanLen = backDist + frontDist;

        let vi = 0;
        for (let iz = 0; iz <= CATCH_SEGS_Z; iz++) {
          const u = iz / CATCH_SEGS_Z;
          // Progressive spacing: dense rows near boots/legs/torso, smoothly stretching out to far helmet tip
          const s = 0.52 * u + 0.48 * u * u;
          const along = -backDist + s * spanLen;
          const bx = state.x + castX * along;
          const bz = state.z + castZ * along;
          const lift = 0.032 + Math.max(0, along) * 0.004;
          for (let ix = 0; ix <= CATCH_SEGS_X; ix++) {
            const across = ((ix / CATCH_SEGS_X) * 2.0 - 1.0) * CATCH_HALF_W;
            const wx = bx + rx * across;
            const wz = bz + rz * across;
            const wy = terrainData.sampleHeight(wx, wz) + lift;
            pAttr.setXYZ(vi++, wx, wy, wz);
          }
        }
        pAttr.needsUpdate = true;
        catcherGeo.computeVertexNormals();
        const airFade = Math.max(0, 1.0 - clearance / 2.8);
        catchUniforms.uSunDir.value.copy(sunDir).normalize();
        catchUniforms.uCatchStrength.value = 0.90 * mtnSunVis * airFade;
        // Calibrated for HDR linear ACES shoulder: matches alpine cobalt-slate shadow tone seamlessly!
        if (isAlpenglow) {
          catchUniforms.uCatchTint.value.set(0.16, 0.23, 0.48);
        } else {
          catchUniforms.uCatchTint.value.set(0.18, 0.29, 0.50);
        }
      }

      // World-space airborne drop shadow (soft blob cue during big jumps >0.6m where ±4m close-range shadow catcher fades!)
      groundShadow.visible = !state.crashed && clearance < 38.0 && ((!state.grounded && clearance > 0.45) || (isThirdPerson && (isStorm || mtnSunVis <= 0.15)));
      if (groundShadow.visible) {
        _nVec.copy(state.normal).normalize();
        const sunY = Math.max(0.24, sunDir.y);
        const offsetScale = clearance / sunY;
        const sx = state.x - sunDir.x * Math.min(18.0, offsetScale * 0.65);
        const sz = state.z - sunDir.z * Math.min(18.0, offsetScale * 0.65);
        const sy = state.terrainY + 0.10 + Math.min(0.35, clearance * 0.015);
        groundShadow.position.set(sx, sy, sz);

        _castVec.set(-sunDir.x, 0, -sunDir.z);
        if (_castVec.lengthSq() < 0.001) _castVec.set(0, 0, 1);
        _castVec.normalize();
        _along.copy(_castVec).addScaledVector(_nVec, -_castVec.dot(_nVec)).normalize();
        _across.crossVectors(_along, _nVec).normalize();
        _trueUp.crossVectors(_across, _along).normalize();
        _shMat.makeBasis(_across, _trueUp, _along);
        groundShadow.quaternion.setFromRotationMatrix(_shMat);

        const spread = 1.0 + clearance * 0.14;
        const stretch = isStorm ? 1.0 : Math.min(2.6, 1.0 + (0.65 / sunY));
        groundShadow.scale.set(spread * 1.05, 1.0, spread * stretch);

        const heightFade = Math.max(0.16, 1.0 - clearance / 32.0);
        const modeMult = (!state.grounded || isThirdPerson) ? 0.85 : 0.48;
        shadowMat.opacity = heightFade * modeMult * (isStorm ? 0.36 : 0.72);
      }
    },
  };
}
