import * as THREE from "three";
import {
  GPUComputationRenderer,
  type Variable,
} from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { mulberry32, riverCenter, terrainHeight } from "./math";
import { PALETTE, sharedUniforms, srgbVec } from "./shared";
import { PETAL_FRAG, PETAL_POS_FRAG, PETAL_VEL_FRAG, PETAL_VERT } from "./shaders";

/** 768 × 640 GPGPU state textures = 491,520 individually simulated petals (> 450,000). */
export const PETAL_TEX_W = 768;
export const PETAL_TEX_H = 640;
export const PETAL_COUNT = PETAL_TEX_W * PETAL_TEX_H; // 491,520

/** Half-width of the sliding valley storm simulation domain (world meters). */
const PETAL_DOMAIN = 680;

/** CPU mirror of GLSL ribbonPoint(idx, s, t = 0) for seamless initial ribbon seeding. */
function initialRibbonPoint(idx: number, s: number): [number, number, number] {
  const x = s * 560.0;
  const baseZ = -260.0 + idx * 165.0;
  const z = baseZ + 95.0 * Math.sin(s * 3.1 + idx * 1.55) + 38.0 * Math.cos(s * 5.4 - idx * 0.9);
  const ground = terrainHeight(x, z);
  const alt = 15.0 + 11.0 * idx + 14.0 * (0.5 + 0.5 * Math.sin(s * 4.2 + idx * 2.1));
  return [x, ground + alt, z];
}

/** CPU mirror of GLSL vortexCenter(idx, t = 0) for instant cyclone funnels on frame 1. */
function initialVortexCenter(idx: number): [number, number] {
  const z = -340.0 + idx * 155.0 + Math.sin(idx * 1.9) * 85.0;
  const rc = riverCenter(z);
  const side = idx % 2 === 0 ? -1 : 1;
  const x = rc + side * (75.0 + 95.0 * (0.5 + 0.5 * Math.cos(idx * 2.4)));
  return [x, z];
}

/**
 * Large-scale GPU cherry blossom storm (Hanafubuki):
 * - Ping-pong floating-point fragment shaders integrate 491,520 petals every frame
 *   under sweeping wind corridors, rising cyclone vortices, 3D rotational turbulence,
 *   aerodynamic leaf flutter, gravity, and analytic terrain collision.
 * - Rendered in ONE GPU draw call reading positions & velocities directly in the
 *   vertex shader, shading soft-edged heart-notched cel sakura petals.
 */
export class PetalStorm {
  readonly object: THREE.Points;
  private readonly gpu: GPUComputationRenderer;
  private readonly posVar: Variable;
  private readonly velVar: Variable;
  private readonly material: THREE.ShaderMaterial;
  private readonly deltaUniform = { value: 1 / 60 };
  private readonly camPosUniform = { value: new THREE.Vector3(35, 195, 510) };
  private readonly pointScaleUniform = { value: 650 };

  constructor(renderer: THREE.WebGLRenderer, initialCamPos: THREE.Vector3) {
    this.camPosUniform.value.copy(initialCamPos);

    const gpu = new GPUComputationRenderer(PETAL_TEX_W, PETAL_TEX_H, renderer);
    // Automatic HalfFloat fallback ensures broad GPU support across desktop & mobile WebGL2
    if (!renderer.extensions.has("EXT_color_buffer_float")) {
      gpu.setDataType(THREE.HalfFloatType);
    }

    const posTex = gpu.createTexture();
    const velTex = gpu.createTexture();
    const posData = posTex.image.data as Float32Array;
    const velData = velTex.image.data as Float32Array;
    const rng = mulberry32(5150);

    for (let i = 0; i < PETAL_COUNT; i++) {
      const o = i * 4;
      const rolePick = rng();
      // Keep fractional seed safely away from 0/1 so floor(w) is exact even in FP16
      const seed = 0.004 + rng() * 0.99;

      let px = 0;
      let py = 20;
      let pz = 0;
      let vx = 7.5;
      let vy = -0.8;
      let vz = 2.0;
      let role = 0;
      const age = 0.04 + rng() * 0.92;

      if (rolePick < 0.60) {
        // Role 0: Canopy-born valley storm blanketing the hillsides and riverbanks
        role = 0;
        px = (rng() * 2 - 1) * PETAL_DOMAIN * 0.94;
        pz = (rng() * 2 - 1) * PETAL_DOMAIN * 0.94;
        const gh = Math.max(terrainHeight(px, pz), 1.0);
        py = gh + 6.5 + Math.pow(rng(), 1.45) * 48.0;
        vx = 6.0 + rng() * 7.0;
        vy = -1.6 + rng() * 2.8;
        vz = 1.0 + (rng() - 0.4) * 5.0;
      } else if (rolePick < 0.942) {
        // Role 1: Sculpted flowing storm ribbons & rising helical blossom cyclones
        role = 1;
        if (rng() < 0.68) {
          const rIdx = Math.floor(rng() * 4);
          const s = (rng() * 2 - 1) * 0.96;
          const [rx, ry, rz] = initialRibbonPoint(rIdx, s);
          const spread = 28.0;
          px = rx + (rng() - 0.5) * 2 * spread;
          py = ry + (rng() - 0.45) * 22.0;
          pz = rz + (rng() - 0.5) * 2 * spread;
          vx = 14.0 + rng() * 8.0;
          vy = (rng() - 0.4) * 3.0;
          vz = (rng() - 0.5) * 6.0;
        } else {
          const vIdx = Math.floor(rng() * 5);
          const [vcx, vcz] = initialVortexCenter(vIdx);
          const t = rng();
          const ang = rng() * Math.PI * 2;
          const rad = (14.0 + rng() * 54.0) * (0.75 + 0.65 * t);
          px = vcx + Math.cos(ang) * rad;
          pz = vcz + Math.sin(ang) * rad;
          py = Math.max(terrainHeight(px, pz), 1.5) + 7.0 + t * 68.0;
          const spin = vIdx % 2 === 0 ? 1 : -1;
          vx = -Math.sin(ang) * spin * 14.0;
          vy = 3.5 + rng() * 4.5;
          vz = Math.cos(ang) * spin * 14.0;
        }
      } else {
        // Role 2: Foreground & elevated aerial petals swirling around the camera viewpoint
        role = 2;
        px = initialCamPos.x + (rng() * 2 - 1) * 205.0;
        pz = initialCamPos.z + (rng() * 2 - 1) * 205.0;
        const minY = Math.max(terrainHeight(px, pz) + 2.0, initialCamPos.y - 70.0);
        const maxY = initialCamPos.y + 42.0;
        py = minY + rng() * (maxY - minY);
        vx = 6.5 + rng() * 5.0;
        vy = -1.2 + rng() * 2.2;
        vz = (rng() - 0.4) * 4.0;
      }

      posData[o] = px;
      posData[o + 1] = py;
      posData[o + 2] = pz;
      posData[o + 3] = role + seed;

      velData[o] = vx;
      velData[o + 1] = vy;
      velData[o + 2] = vz;
      velData[o + 3] = age;
    }

    posTex.needsUpdate = true;
    velTex.needsUpdate = true;

    this.velVar = gpu.addVariable("textureVelocity", PETAL_VEL_FRAG, velTex);
    this.posVar = gpu.addVariable("texturePosition", PETAL_POS_FRAG, posTex);
    gpu.setVariableDependencies(this.velVar, [this.velVar, this.posVar]);
    gpu.setVariableDependencies(this.posVar, [this.velVar, this.posVar]);

    Object.assign(this.velVar.material.uniforms, {
      uTime: sharedUniforms.uTime,
      uDelta: this.deltaUniform,
      uStorm: sharedUniforms.uStorm,
      uGustBurst: sharedUniforms.uGustBurst,
      uWindScale: sharedUniforms.uWindScale,
      uWind: sharedUniforms.uWind,
      uCenter: sharedUniforms.uCenter,
    });

    Object.assign(this.posVar.material.uniforms, {
      uTime: sharedUniforms.uTime,
      uDelta: this.deltaUniform,
      uDomain: { value: PETAL_DOMAIN },
      uCenter: sharedUniforms.uCenter,
      uCamPos: this.camPosUniform,
    });

    const err = gpu.init();
    if (err !== null) {
      throw new Error(`GPU petal compute init failed: ${err}`);
    }
    this.gpu = gpu;

    // Pre-warm the simulation so organic curl streams and vortex spirals appear on frame 1
    this.deltaUniform.value = 0.09;
    for (let step = 0; step < 14; step++) {
      sharedUniforms.uTime.value = step * 0.09;
      this.gpu.compute();
    }
    sharedUniforms.uTime.value = 0;
    this.deltaUniform.value = 1 / 60;

    // Dispose initial CPU upload buffers now that GPU render targets hold live state
    posTex.dispose();
    velTex.dispose();

    // Build single-draw-call GPU particle geometry (1 UV lookup per petal = 491,520 vertices)
    const geo = new THREE.BufferGeometry();
    const dummyPos = new Float32Array(PETAL_COUNT * 3);
    const refs = new Float32Array(PETAL_COUNT * 2);
    for (let i = 0; i < PETAL_COUNT; i++) {
      const tx = i % PETAL_TEX_W;
      const ty = Math.floor(i / PETAL_TEX_W);
      refs[i * 2] = (tx + 0.5) / PETAL_TEX_W;
      refs[i * 2 + 1] = (ty + 0.5) / PETAL_TEX_H;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(dummyPos, 3));
    geo.setAttribute("aRef", new THREE.BufferAttribute(refs, 2));

    this.material = new THREE.ShaderMaterial({
      vertexShader: PETAL_VERT,
      fragmentShader: PETAL_FRAG,
      uniforms: {
        uPosTex: { value: this.gpu.getCurrentRenderTarget(this.posVar).texture },
        uVelTex: { value: this.gpu.getCurrentRenderTarget(this.velVar).texture },
        uTime: sharedUniforms.uTime,
        uStorm: sharedUniforms.uStorm,
        uProcedural: sharedUniforms.uProcedural,
        uPointScale: this.pointScaleUniform,
        uDomain: { value: PETAL_DOMAIN },
        uCenter: sharedUniforms.uCenter,
        uCelDir: sharedUniforms.uCelDir,
        uSunDir: sharedUniforms.uSunDir,
        uFogWarm: sharedUniforms.uFogWarm,
        uFogCool: sharedUniforms.uFogCool,
        uFogNear: sharedUniforms.uFogNear,
        uFogFar: sharedUniforms.uFogFar,
        uPetalTip: { value: srgbVec(PALETTE.petalTip) },
        uPetalMid: { value: srgbVec(PALETTE.petalMid) },
        uPetalBase: { value: srgbVec(PALETTE.petalBase) },
        uPetalShadow: { value: srgbVec(PALETTE.petalShadow) },
        uSunCore: { value: srgbVec(PALETTE.sunCore) },
        uCyberCyan: { value: srgbVec(PALETTE.cyberCyan) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.object = new THREE.Points(geo, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 2;
    this.object.name = "sakura-petal-storm";
  }

  /** Keeps perspective petal size calibrated across window sizes and DPRs. */
  setViewport(heightPx: number, pixelRatio: number, fovDeg: number): void {
    const fovRad = THREE.MathUtils.degToRad(fovDeg);
    this.pointScaleUniform.value = (heightPx * pixelRatio * 0.5) / Math.tan(fovRad * 0.5);
  }

  /** Executes one GPU velocity + position ping-pong step and binds output textures. */
  update(dt: number, cameraPos: THREE.Vector3): void {
    this.deltaUniform.value = Math.min(Math.max(dt, 0.001), 0.05);
    this.camPosUniform.value.copy(cameraPos);
    this.gpu.compute();
    this.material.uniforms.uPosTex.value = this.gpu.getCurrentRenderTarget(this.posVar).texture;
    this.material.uniforms.uVelTex.value = this.gpu.getCurrentRenderTarget(this.velVar).texture;
  }

  dispose(): void {
    this.gpu.dispose();
    this.object.geometry.dispose();
    this.material.dispose();
  }
}
