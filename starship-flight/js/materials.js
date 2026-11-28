// Materials and shader patches. Shared uniforms let one switch drive every material:
// cutaway hatch on cut faces, the plume-view paper ghost, and the section plane.
import * as THREE from 'three';

export const U = {
  ghost: { value: 0 },          // 0..1 fade to paper-grey ghost
  noGhost: { value: 0 },        // used by engines and plume
  cutOn: { value: 0 },          // cut-face hatching on
  hatch: { value: new THREE.Color('#E05A1E') },
  paper: { value: new THREE.Color('#E8E4DA') },
  time: { value: 0 },
  tileWear: { value: 0 },
  tileHeat: { value: 0 },
  tileK: { value: 0.12 },
};
export const sectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e6);
export const noClipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e6);

const HEADER = /* glsl */`
uniform float uGhost; uniform float uCutOn; uniform vec3 uHatch; uniform vec3 uPaper;
`;
const TAIL = /* glsl */`
  if (uCutOn > 0.5 && !gl_FrontFacing) {
    float hh = step(0.55, fract((gl_FragCoord.x + gl_FragCoord.y) / 7.0));
    vec3 cutc = mix(uPaper * 1.04, uHatch, hh * 0.9);
    gl_FragColor = vec4(cutc, 1.0);
  }
  {
    float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    vec3 ghostc = mix(uPaper * 0.80, uPaper * 1.02, smoothstep(0.1, 0.9, lum));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, ghostc, uGhost * 0.92);
  }
`;

// patch: hatch + ghost (+ optional steel tint / tile field)
export function patch(mat, { ghost = U.ghost, steel = null, tiles = false, clip = true, liquid = false } = {}) {
  if (clip) { mat.clippingPlanes = [noClipPlane]; mat.clipShadows = true; }
  mat.side = THREE.DoubleSide;
  mat.userData.clip = clip;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGhost = ghost; sh.uniforms.uCutOn = U.cutOn; sh.uniforms.uHatch = U.hatch; sh.uniforms.uPaper = U.paper;
    sh.fragmentShader = HEADER + sh.fragmentShader;
    if (steel || tiles) {
      sh.vertexShader = 'varying vec3 vObj;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vObj = position;');
      sh.fragmentShader = 'varying vec3 vObj;\n' + (steel ? 'uniform float uHeatTop; uniform float uHeatBase; uniform float uWeld;\n' : '') + (tiles ? 'uniform float uWear; uniform float uHeatGlow; uniform float uTileK;\n' : '') + sh.fragmentShader;
    }
    if (steel) {
      sh.uniforms.uHeatTop = { value: steel.heatTop }; sh.uniforms.uHeatBase = { value: steel.heatBase ?? 0 };
      sh.uniforms.uWeld = { value: steel.weld ?? 1.83 };
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        {
          float yy = vObj.y;
          float ang = atan(vObj.z, vObj.x);
          float streak = fract(sin(floor(ang * 260.0) * 91.7) * 4375.5);
          diffuseColor.rgb *= 0.94 + 0.06 * streak;
          float weld = smoothstep(0.035, 0.0, abs(fract(yy / uWeld) - 0.5) - 0.465);
          diffuseColor.rgb *= 1.0 - 0.10 * weld;
          float heat = 1.0 - smoothstep(uHeatBase, uHeatTop, yy);
          vec3 temper = mix(vec3(0.72, 0.62, 0.50), vec3(0.48, 0.47, 0.55), smoothstep(0.4, 1.0, heat));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * temper, heat);
        }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + 0.18 * (1.0 - smoothstep(uHeatBase, uHeatTop, vObj.y)), 0.0, 1.0);`);
    }
    if (tiles) {
      sh.uniforms.uWear = U.tileWear; sh.uniforms.uHeatGlow = U.tileHeat; sh.uniforms.uTileK = U.tileK;
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        float tileMissing = 0.0;
        {
          float rr = length(vObj.xz);
          float ang = atan(vObj.z, vObj.x);
          vec2 uv = vec2(ang * rr, vObj.y) / uTileK;
          const vec2 s = vec2(1.0, 1.7320508);
          vec4 hC = floor(vec4(uv, uv - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
          vec4 h = vec4(uv - hC.xy * s, uv - (hC.zw + 0.5) * s);
          vec4 hx = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + 0.5);
          vec2 p = abs(hx.xy);
          float d = max(dot(p, vec2(0.5, 0.8660254)), p.x);
          float rnd = fract(sin(dot(hx.zw, vec2(12.9898, 78.233))) * 43758.5453);
          float rnd2 = fract(sin(dot(hx.zw, vec2(39.346, 11.135))) * 24634.6345);
          float missP = 0.004 + 0.05 * uWear;
          float darkP = 0.08 + 0.25 * uWear;
          vec3 tile = vec3(0.105, 0.105, 0.11) * (0.85 + 0.3 * rnd2);
          if (rnd < darkP) tile *= 0.55;
          float px = length(fwidth(uv));
          float groutVis = 1.0 - smoothstep(0.08, 0.3, px);
          float grout = smoothstep(0.43, 0.49, d) * groutVis;
          tile = mix(tile, vec3(0.2, 0.195, 0.185), grout * 0.75);
          tile = mix(tile, vec3(0.11, 0.11, 0.115), 1.0 - groutVis);
          if (rnd > 1.0 - missP) { tile = mix(vec3(0.11), vec3(0.70, 0.69, 0.66), groutVis * 0.85 + 0.15); tileMissing = 1.0; }
          diffuseColor.rgb = tile;
        }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.88, 0.35, 0.12) * uHeatGlow * (1.0 - tileMissing) * (0.6 + 0.4 * smoothstep(-2.0, 4.0, vObj.x));`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.9, tileMissing);`);
    }
    const tail = liquid ? TAIL.replace('vec3 cutc = mix(uPaper * 1.04, uHatch, hh * 0.9);', 'vec3 cutc = mix(diffuseColor.rgb * 1.05, uPaper, step(0.7, fract(gl_FragCoord.x / 3.0)) * step(0.7, fract(gl_FragCoord.y / 3.0)) * 0.6);') : TAIL;
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + tail);
  };
  mat.customProgramCacheKey = () => `p${steel ? 's' : ''}${tiles ? 't' : ''}${liquid ? 'l' : ''}${ghost === U.noGhost ? 'n' : 'g'}${clip ? 'c' : ''}`;
  return mat;
}

export function makeMaterials(envMap) {
  const steel = (heatTop, heatBase = 0) => patch(new THREE.MeshPhysicalMaterial({
    color: '#cdcac3', metalness: 1.0, roughness: 0.34, envMap, envMapIntensity: 1.0,
    anisotropy: 0.55, anisotropyRotation: Math.PI / 2, clearcoat: 0.0,
  }), { steel: { heatTop, heatBase } });
  const m = {
    boosterSteel: steel(16, 1.5),
    shipSteel: steel(9, 0.0),
    steelPlain: patch(new THREE.MeshPhysicalMaterial({ color: '#c4c1ba', metalness: 1, roughness: 0.36, envMap, anisotropy: 0.4 })),
    innerSteel: patch(new THREE.MeshStandardMaterial({ color: '#9d9a94', metalness: 0.85, roughness: 0.5, envMap })),
    dome: patch(new THREE.MeshStandardMaterial({ color: '#b3afa7', metalness: 0.9, roughness: 0.4, envMap })),
    darkMetal: patch(new THREE.MeshStandardMaterial({ color: '#3a3936', metalness: 0.6, roughness: 0.62, envMap })),
    gridFin: patch(new THREE.MeshStandardMaterial({ color: '#2b2a28', metalness: 0.5, roughness: 0.7, envMap })),
    engineBell: patch(new THREE.MeshStandardMaterial({ color: '#6e655c', metalness: 0.9, roughness: 0.42, envMap }), { ghost: U.noGhost }),
    engineBody: patch(new THREE.MeshStandardMaterial({ color: '#a8a39b', metalness: 0.9, roughness: 0.38, envMap }), { ghost: U.noGhost }),
    engineLine: patch(new THREE.MeshStandardMaterial({ color: '#d1cbbf', metalness: 0.8, roughness: 0.35, envMap }), { ghost: U.noGhost }),
    tiles: patch(new THREE.MeshStandardMaterial({ color: '#1c1c1d', metalness: 0.05, roughness: 0.86, envMap, emissive: '#000000' }), { tiles: true, clip: true }),
    lox: patch(new THREE.MeshStandardMaterial({ color: '#7fc3d8', metalness: 0.0, roughness: 0.25, emissive: '#3FA8C9', emissiveIntensity: 0.25 }), { liquid: true }),
    ch4: patch(new THREE.MeshStandardMaterial({ color: '#e7c7a3', metalness: 0.0, roughness: 0.3, emissive: '#E05A1E', emissiveIntensity: 0.12 }), { liquid: true }),
    // ground-side materials (no section clipping)
    towerSteel: patch(new THREE.MeshStandardMaterial({ color: '#7d7a74', metalness: 0.7, roughness: 0.55, envMap }), { clip: false }),
    towerDark: patch(new THREE.MeshStandardMaterial({ color: '#2a2a29', metalness: 0.5, roughness: 0.7, envMap }), { clip: false }),
    concrete: patch(new THREE.MeshStandardMaterial({ color: '#cfc9bd', metalness: 0.0, roughness: 0.95 }), { clip: false }),
    padSteel: patch(new THREE.MeshStandardMaterial({ color: '#8f8b84', metalness: 0.75, roughness: 0.5, envMap }), { clip: false }),
    tankWhite: patch(new THREE.MeshStandardMaterial({ color: '#ece8df', metalness: 0.2, roughness: 0.55, envMap }), { clip: false }),
    orange: patch(new THREE.MeshStandardMaterial({ color: '#E05A1E', metalness: 0.1, roughness: 0.6 }), { clip: false }),
  };
  m.tiles.userData.inkKind = 2;
  m.gridFin.userData.inkKind = 3; m.darkMetal.userData.inkKind = 3;
  m.lox.userData.inkKind = 1; m.ch4.userData.inkKind = 4;
  return m;
}

// Ink-pass material for the orthographic console prints.
// Encodes view normal (xy), linear depth, and a material code.
export function makeInkMaterial(code, withClip) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCode: { value: code }, uNear: { value: 1 }, uFar: { value: 400 } },
    vertexShader: /* glsl */`
      #include <common>
      #include <clipping_planes_pars_vertex>
      varying vec3 vN; varying float vDepth;
      void main(){
        vec3 objectNormal = normal;
        vec3 transformed = position;
        #ifdef USE_INSTANCING
          transformed = (instanceMatrix * vec4(transformed, 1.0)).xyz;
          objectNormal = mat3(instanceMatrix) * objectNormal;
        #endif
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vN = normalize(normalMatrix * objectNormal);
        vDepth = -mvPosition.z;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <clipping_planes_pars_fragment>
      uniform float uCode; uniform float uNear; uniform float uFar;
      varying vec3 vN; varying float vDepth;
      void main(){
        #include <clipping_planes_fragment>
        vec3 n = normalize(vN);
        float code = uCode;
        if (!gl_FrontFacing) { n = -n; code = uCode < 0.35 ? 0.95 : (uCode < 0.55 ? 0.85 : uCode); }
        float d = clamp((vDepth - uNear) / (uFar - uNear), 0.0, 1.0);
        gl_FragColor = vec4(n.xy * 0.5 + 0.5, d, code);
      }`,
    side: THREE.DoubleSide,
    clipping: withClip,
  });
  if (withClip) mat.clippingPlanes = [sectionPlane];
  return mat;
}
