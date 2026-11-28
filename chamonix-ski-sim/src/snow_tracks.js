/**
 * High-Resolution Rolling World-Locked GPU Snow-Track Deformation Buffer
 * (1536×1536 covering 64×64 m => 4.1 cm / pixel for razor-sharp parallel twin tracks!).
 *
 * Channels (RGBA8 linear):
 *   R = Trench depression depth [0..1]
 *   G = Outer displaced snow berm [0..1] (crisp sunlit ridge flanking each ski & untouched center rib!)
 *   B = Compacted icy bottom glint [0..1]
 *   A = Mask / age factor
 */
import * as THREE from 'three';

export class SnowTrackBuffer {
  constructor(renderer, worldSpan = 64.0, resolution = 1536, macroSpan = 360.0, macroRes = 1024) {
    this.renderer = renderer;
    this.worldSpan = worldSpan;
    this.res = resolution;
    this.originX = 0;
    this.originZ = 0;
    this.macroSpan = macroSpan;
    this.macroRes = macroRes;
    this.macroOriginX = 0;
    this.macroOriginZ = 0;
    this.initialized = false;

    const opts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.rtA = new THREE.WebGLRenderTarget(resolution, resolution, opts);
    this.rtB = new THREE.WebGLRenderTarget(resolution, resolution, opts);
    this.macroA = new THREE.WebGLRenderTarget(macroRes, macroRes, opts);
    this.macroB = new THREE.WebGLRenderTarget(macroRes, macroRes, opts);

    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    this.copyMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        uPrev: { value: null },
        uShiftUV: { value: new THREE.Vector2(0, 0) },
        uDecay: { value: 0.0 },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uPrev;
        uniform vec2 uShiftUV;
        uniform float uDecay;
        varying vec2 vUv;
        void main() {
          vec2 srcUv = vUv + uShiftUV;
          if (srcUv.x < 0.002 || srcUv.x > 0.998 || srcUv.y < 0.002 || srcUv.y > 0.998) {
            gl_FragColor = vec4(0.0);
            return;
          }
          vec4 c = texture2D(uPrev, srcUv);
          c.rgb = max(vec3(0.0), c.rgb - vec3(uDecay));
          gl_FragColor = c;
        }
      `,
    });
    this.copyScene = new THREE.Scene();
    this.copyScene.add(new THREE.Mesh(quadGeo, this.copyMat));

    // Twin-ski capsule stamper (stamps BOTH left & right skis in ONE GPU pass!)
    this.twinMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        uPrev: { value: null },
        uLA: { value: new THREE.Vector2() }, uLB: { value: new THREE.Vector2() },
        uRA: { value: new THREE.Vector2() }, uRB: { value: new THREE.Vector2() },
        uSingleMode: { value: 0.0 },
        uRadiusUV: { value: 0.002 },
        uDepth: { value: 0.85 },
        uBerm: { value: 0.72 },
        uIceGlint: { value: 0.65 },
        uSkewSide: { value: 0.0 },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uPrev;
        uniform vec2 uLA, uLB, uRA, uRB;
        uniform float uSingleMode;
        uniform float uRadiusUV;
        uniform float uDepth;
        uniform float uBerm;
        uniform float uIceGlint;
        uniform float uSkewSide;
        varying vec2 vUv;

        void evalCapsule(vec2 uv, vec2 a, vec2 b, float r, out float tr, out float bm, out float gl) {
          vec2 ab = b - a;
          float ab2 = dot(ab, ab);
          float t = ab2 > 1e-10 ? clamp(dot(uv - a, ab) / ab2, 0.0, 1.0) : 0.0;
          vec2 diff = uv - (a + ab * t);
          float dist = length(diff);
          vec2 dir = ab2 > 1e-10 ? normalize(ab) : vec2(0.0, 1.0);
          vec2 perp = vec2(-dir.y, dir.x);
          float side = dot(diff, perp);

          // Anti-aliased U-trench profile (edge feather guaranteed >= 2.2 texels wide to eliminate Nyquist diagonal scallops!)
          float aa = max(r * 0.48, 0.00145);
          tr = smoothstep(r + aa, max(0.0, r - aa * 0.75), dist) * uDepth;
          // Smooth flanking snow berm strictly OUTSIDE trench wall (preserves crisp untouched snow rib between parallel skis!)
          float bermCenter = r + aa * 1.45;
          float bermW = max(r * 0.72, 0.0018);
          float bermRing = exp(-pow((dist - bermCenter) / bermW, 2.0));
          float sideBoost = clamp(1.0 + sign(side) * uSkewSide * 0.72, 0.40, 1.72);
          bm = bermRing * uBerm * sideBoost * (1.0 - smoothstep(r + aa * 0.5, max(0.0, r - aa * 0.5), dist));
          gl = smoothstep(r + aa * 0.5, max(0.0, r * 0.15), dist) * uIceGlint;
        }

        void main() {
          vec4 prev = texture2D(uPrev, vUv);
          float r = max(uRadiusUV, 0.0005);
          float trL, bmL, glL;
          evalCapsule(vUv, uLA, uLB, r, trL, bmL, glL);
          float tr = trL, bm = bmL, gl = glL;
          if (uSingleMode < 0.5) {
            float trR, bmR, glR;
            evalCapsule(vUv, uRA, uRB, r, trR, bmR, glR);
            tr = max(trL, trR);
            // Center snow ridge between both skis piles slightly crisp & bright!
            bm = clamp(max(bmL, bmR) + min(bmL, bmR) * 0.35, 0.0, 1.0);
            gl = max(glL, glR);
          }
          float outR = max(prev.r, tr);
          float outG = clamp(max(prev.g, bm) * (1.0 - outR * 0.78), 0.0, 1.0);
          float outB = max(prev.b, gl);
          gl_FragColor = vec4(outR, outG, outB, max(prev.a, max(outR, outG)));
        }
      `,
    });
    this.stampScene = new THREE.Scene();
    this.stampScene.add(new THREE.Mesh(quadGeo, this.twinMat));
  }

  get texture() { return this.rtA.texture; }
  get macroTexture() { return this.macroA.texture; }

  reset(x, z) {
    this.originX = x;
    this.originZ = z;
    this.macroOriginX = x;
    this.macroOriginZ = z;
    this.initialized = true;
    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.setClearColor(0x000000, 0);
    for (const rt of [this.rtA, this.rtB, this.macroA, this.macroB]) {
      this.renderer.setRenderTarget(rt);
      this.renderer.clear(true, false, false);
    }
    this.renderer.setRenderTarget(prevTarget);
  }

  worldToUV(wx, wz) {
    return [(wx - this.originX) / this.worldSpan + 0.5, (wz - this.originZ) / this.worldSpan + 0.5];
  }

  worldToMacroUV(wx, wz) {
    return [(wx - this.macroOriginX) / this.macroSpan + 0.5, (wz - this.macroOriginZ) / this.macroSpan + 0.5];
  }

  recenterIfNeeded(skierX, skierZ, decayAmt = 0.0) {
    if (!this.initialized) { this.reset(skierX, skierZ); return; }

    // 1. High-res near-field cascade (64m @ 4.1cm/px)
    const dx = skierX - this.originX;
    const dz = skierZ - this.originZ;
    if (Math.hypot(dx, dz) >= 7.0 || decayAmt > 0.00001) {
      const texelM = this.worldSpan / this.res;
      const stepX = Math.round(dx / texelM) * texelM;
      const stepZ = Math.round(dz / texelM) * texelM;
      if (stepX !== 0 || stepZ !== 0 || decayAmt > 0.00001) {
        const shiftU = stepX / this.worldSpan;
        const shiftV = stepZ / this.worldSpan;
        this.originX += stepX;
        this.originZ += stepZ;

        const prevTarget = this.renderer.getRenderTarget();
        this.copyMat.uniforms.uPrev.value = this.rtA.texture;
        this.copyMat.uniforms.uShiftUV.value.set(shiftU, shiftV);
        this.copyMat.uniforms.uDecay.value = decayAmt;
        this.renderer.setRenderTarget(this.rtB);
        this.renderer.render(this.copyScene, this.orthoCam);
        this.renderer.setRenderTarget(prevTarget);

        const tmp = this.rtA; this.rtA = this.rtB; this.rtB = tmp;
      }
    }

    // 2. Macro persistent trail cascade (360m @ 35cm/px -> full S-turn line stays visible 180m+ uphill!)
    const mdx = skierX - this.macroOriginX;
    const mdz = skierZ - this.macroOriginZ;
    if (Math.hypot(mdx, mdz) >= 48.0 || decayAmt > 0.00001) {
      const mTexel = this.macroSpan / this.macroRes;
      const mStepX = Math.round(mdx / mTexel) * mTexel;
      const mStepZ = Math.round(mdz / mTexel) * mTexel;
      if (mStepX !== 0 || mStepZ !== 0 || decayAmt > 0.00001) {
        this.macroOriginX += mStepX;
        this.macroOriginZ += mStepZ;

        const prevTarget = this.renderer.getRenderTarget();
        this.copyMat.uniforms.uPrev.value = this.macroA.texture;
        this.copyMat.uniforms.uShiftUV.value.set(mStepX / this.macroSpan, mStepZ / this.macroSpan);
        this.copyMat.uniforms.uDecay.value = decayAmt * 0.5;
        this.renderer.setRenderTarget(this.macroB);
        this.renderer.render(this.copyScene, this.orthoCam);
        this.renderer.setRenderTarget(prevTarget);

        const tmpM = this.macroA; this.macroA = this.macroB; this.macroB = tmpM;
      }
    }
  }

  stampTwinSkis(lA, lB, rA, rB, radiusM, depth, berm, iceGlint = 0.65, skewSide = 0.0) {
    if (!this.initialized) return;
    const prevTarget = this.renderer.getRenderTarget();
    const u = this.twinMat.uniforms;

    // Stamp near cascade (razor-sharp 4.1cm/px parallel twin rails)
    const [lau, lav] = this.worldToUV(lA[0], lA[1]);
    const [lbu, lbv] = this.worldToUV(lB[0], lB[1]);
    const [rau, rav] = this.worldToUV(rA[0], rA[1]);
    const [rbu, rbv] = this.worldToUV(rB[0], rB[1]);
    if (!(Math.max(lau, lbu, rau, rbu) < -0.05 || Math.min(lau, lbu, rau, rbu) > 1.05)) {
      u.uPrev.value = this.rtA.texture;
      u.uLA.value.set(lau, lav); u.uLB.value.set(lbu, lbv);
      u.uRA.value.set(rau, rav); u.uRB.value.set(rbu, rbv);
      u.uSingleMode.value = 0.0;
      u.uRadiusUV.value = radiusM / this.worldSpan;
      u.uDepth.value = depth;
      u.uBerm.value = berm;
      u.uIceGlint.value = iceGlint;
      u.uSkewSide.value = skewSide;
      this.renderer.setRenderTarget(this.rtB);
      this.renderer.render(this.stampScene, this.orthoCam);
      const tmp = this.rtA; this.rtA = this.rtB; this.rtB = tmp;
    }

    // Stamp macro cascade (360m persistent descent line for look-back & helicopter replay!)
    const [mlau, mlav] = this.worldToMacroUV(lA[0], lA[1]);
    const [mlbu, mlbv] = this.worldToMacroUV(lB[0], lB[1]);
    const [mrau, mrav] = this.worldToMacroUV(rA[0], rA[1]);
    const [mrbu, mrbv] = this.worldToMacroUV(rB[0], rB[1]);
    if (!(Math.max(mlau, mlbu, mrau, mrbu) < -0.05 || Math.min(mlau, mlbu, mrau, mrbu) > 1.05)) {
      u.uPrev.value = this.macroA.texture;
      u.uLA.value.set(mlau, mlav); u.uLB.value.set(mlbu, mlbv);
      u.uRA.value.set(mrau, mrav); u.uRB.value.set(mrbu, mrbv);
      u.uSingleMode.value = 0.0;
      u.uRadiusUV.value = Math.max(radiusM * 1.4, 0.36) / this.macroSpan;
      u.uDepth.value = depth;
      u.uBerm.value = berm * 0.92;
      u.uIceGlint.value = iceGlint * 0.85;
      u.uSkewSide.value = skewSide;
      this.renderer.setRenderTarget(this.macroB);
      this.renderer.render(this.stampScene, this.orthoCam);
      const tmpM = this.macroA; this.macroA = this.macroB; this.macroB = tmpM;
    }

    this.renderer.setRenderTarget(prevTarget);
  }

  stampPoleDimple(x, z, radiusM = 0.14, depth = 0.58) {
    if (!this.initialized) return;
    this.stampCapsule(x, z, x + 0.02, z + 0.02, radiusM, depth, depth * 0.72, 0.25, 0.0, false);
  }

  stampCapsule(ax, az, bx, bz, radiusM, depth, berm, iceGlint = 0.6, skewSide = 0.0, includeMacro = true) {
    if (!this.initialized) return;
    const prevTarget = this.renderer.getRenderTarget();
    const u = this.twinMat.uniforms;

    const [au, av] = this.worldToUV(ax, az);
    const [bu, bv] = this.worldToUV(bx, bz);
    if (!(Math.max(au, bu) < -0.05 || Math.min(au, bu) > 1.05 || Math.max(av, bv) < -0.05 || Math.min(av, bv) > 1.05)) {
      u.uPrev.value = this.rtA.texture;
      u.uLA.value.set(au, av); u.uLB.value.set(bu, bv);
      u.uSingleMode.value = 1.0;
      u.uRadiusUV.value = radiusM / this.worldSpan;
      u.uDepth.value = depth;
      u.uBerm.value = berm;
      u.uIceGlint.value = iceGlint;
      u.uSkewSide.value = skewSide;
      this.renderer.setRenderTarget(this.rtB);
      this.renderer.render(this.stampScene, this.orthoCam);
      const tmp = this.rtA; this.rtA = this.rtB; this.rtB = tmp;
    }

    if (includeMacro) {
      const [mau, mav] = this.worldToMacroUV(ax, az);
      const [mbu, mbv] = this.worldToMacroUV(bx, bz);
      if (!(Math.max(mau, mbu) < -0.05 || Math.min(mau, mbu) > 1.05 || Math.max(mav, mbv) < -0.05 || Math.min(mav, mbv) > 1.05)) {
        u.uPrev.value = this.macroA.texture;
        u.uLA.value.set(mau, mav); u.uLB.value.set(mbu, mbv);
        u.uSingleMode.value = 1.0;
        u.uRadiusUV.value = Math.max(radiusM, 0.42) / this.macroSpan;
        u.uDepth.value = depth;
        u.uBerm.value = berm * 0.85;
        u.uIceGlint.value = iceGlint;
        u.uSkewSide.value = skewSide;
        this.renderer.setRenderTarget(this.macroB);
        this.renderer.render(this.stampScene, this.orthoCam);
        const tmpM = this.macroA; this.macroA = this.macroB; this.macroB = tmpM;
      }
    }

    this.renderer.setRenderTarget(prevTarget);
  }
}
