import * as THREE from 'three';
import { noiseGlsl } from './glsl';

const detailCache = new Map<string, string>();

function detailKey(scale: number, amount: number, wear: number) {
  return `${scale.toFixed(2)}-${amount.toFixed(4)}-${wear.toFixed(3)}`;
}

const subsurface = /* glsl */ `
  #include <lights_fragment_end>
  #if NUM_DIR_LIGHTS > 0
    vec3 sssL = directionalLights[0].direction;
    vec3 sssV = normalize(vViewPosition);
    float sssLit = max(dot(normal, sssL), 0.0);
    float sssWrap = max((dot(normal, sssL) + 0.6) / 1.6, 0.0) - sssLit;
    float sssBack = pow(max(dot(sssV, -sssL), 0.0), 3.0) * pow(1.0 - max(dot(normal, sssV), 0.0), 2.0);
    reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[0].color
      * (sssWrap * 0.26 * vec3(0.78, 0.95, 1.0) + sssBack * 0.75 * vec3(1.0, 0.62, 0.56));
  #endif
`;

export function applySurfaceDetail(material: THREE.MeshPhysicalMaterial, scale = 4, amount = 0.01, wear = 0.06, sss = false) {
  const key = `${detailKey(scale, amount, wear)}-${sss ? 'sss' : 'pbr'}`;
  material.customProgramCacheKey = () => `aetheria-${key}`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${noiseGlsl}\nvarying vec3 vAetheriaWorld;`)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float macro = aetheriaNoise(position * ${scale.toFixed(2)});
        float micro = aetheriaNoise(position * ${(scale * 4.2).toFixed(2)});
        transformed += objectNormal * ((macro - 0.5) * ${amount.toFixed(4)} + (micro - 0.5) * ${(amount * 0.28).toFixed(4)});
        vAetheriaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${noiseGlsl}\nvarying vec3 vAetheriaWorld;`)
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float grain = aetheriaNoise(vAetheriaWorld * ${(scale * 1.7).toFixed(2)});
        float fine = aetheriaNoise(vAetheriaWorld * ${(scale * 7.0).toFixed(2)});
        diffuseColor.rgb *= 0.94 + ${wear.toFixed(3)} * grain + 0.025 * fine;
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (0.86 + 0.28 * aetheriaNoise(vAetheriaWorld * 3.4)), 0.04, 1.0);
      `);
    if (sss) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', subsurface);
  };
  detailCache.set(key, key);
  return material;
}

export function masonry(color: string) {
  return applySurfaceDetail(new THREE.MeshPhysicalMaterial({
    color, roughness: 0.84, metalness: 0.02, envMapIntensity: 0.28,
  }), 3.2, 0.012, 0.07);
}

export function roofPaint(color: string) {
  return applySurfaceDetail(new THREE.MeshPhysicalMaterial({
    color, roughness: 0.42, metalness: 0.04, clearcoat: 0.34, clearcoatRoughness: 0.42, envMapIntensity: 0.4,
  }), 8.5, 0.006, 0.045);
}

export function steel(color: string) {
  return applySurfaceDetail(new THREE.MeshPhysicalMaterial({
    color, roughness: 0.3, metalness: 0.72, clearcoat: 0.62, clearcoatRoughness: 0.22, envMapIntensity: 0.85,
  }), 18, 0.002, 0.03);
}

export function trimMetal() {
  return new THREE.MeshPhysicalMaterial({
    color: '#e6c98a', roughness: 0.34, metalness: 0.78, envMapIntensity: 0.7,
  });
}

export function whaleSkin(vertexColors = true) {
  const material = new THREE.MeshPhysicalMaterial({
    color: vertexColors ? '#ffffff' : '#3a98cc', roughness: 0.5, metalness: 0, vertexColors,
    sheen: 0.15, sheenColor: new THREE.Color('#cfeaf5'), sheenRoughness: 0.5,
    clearcoat: 0.18, clearcoatRoughness: 0.55, envMapIntensity: 0.35, specularIntensity: 0.4,
    side: vertexColors ? THREE.FrontSide : THREE.DoubleSide,
  });
  return applySurfaceDetail(material, 5.5, 0.014, 0.07, true);
}

export function glass(emissive = '#ffb56a', intensity = 0.7) {
  return new THREE.MeshPhysicalMaterial({
    color: '#fff1df', roughness: 0.06, metalness: 0.04, envMapIntensity: 1,
    emissive, emissiveIntensity: intensity, transparent: true, opacity: 0.92,
  });
}

export function transmittingGlass() {
  return new THREE.MeshPhysicalMaterial({
    color: '#fff6ea', roughness: 0.04, metalness: 0, transmission: 0.86,
    thickness: 0.08, ior: 1.5, envMapIntensity: 1, transparent: true,
  });
}

export function foliage(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
}

export function gradeShader() {
  return {
    name: 'AetheriaGrade',
    uniforms: { tDiffuse: { value: null }, uGrain: { value: 0.012 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uGrain;
      varying vec2 vUv;
      void main() {
        vec3 color = texture2D(tDiffuse, vUv).rgb;
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        vec3 shadow = color * vec3(0.9, 0.97, 1.05) + vec3(0.012, 0.02, 0.028);
        color = mix(color, shadow, smoothstep(0.45, 0.02, luma) * 0.16);
        color = max(mix(vec3(luma), color, 1.16), 0.0);
        color = mix(color, color * vec3(1.05, 1.01, 0.95), smoothstep(0.35, 0.9, luma) * 0.22);
        float vignette = smoothstep(1.15, 0.28, length(vUv - 0.5));
        color *= mix(0.9, 1.0, vignette);
        float grain = fract(sin(dot(vUv * vec2(1920.0, 1080.0), vec2(12.9898, 78.233))) * 43758.5453);
        color += (grain - 0.5) * uGrain;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  };
}
