import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

import { generateVesselGeometry, type MaterialBucket } from '../geometry/vesselGenerator';
import { createConcreteMaps, createCopperMaps, createPlazaMaps } from './proceduralTextures';
import {
  FINISH_PALETTES,
  type CameraPresetId,
  type VesselParams,
  type VesselStats,
} from '../types/vessel';

export interface VesselViewportHandle {
  flyToPreset: (preset: CameraPresetId) => void;
  exportGLB: () => void;
}

interface VesselViewportProps {
  params: VesselParams;
  inspectorVisible: boolean;
  onStats: (stats: VesselStats) => void;
  onActiveCameraChange?: (preset: CameraPresetId | null) => void;
}

interface CameraAnim {
  active: boolean;
  startTime: number;
  duration: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromFov: number;
  toFov: number;
}

/**
 * Calibrated physical-aesthetic atmospheric sky dome shader.
 * Avoids unclamped 20+ radiance blowouts in Bloom/PMREM while giving polished
 * rose-copper cladding rich sapphire zenith, warm sunset horizon, sun glint,
 * and terracotta ground bounce reflections.
 */
function createCalibratedSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor: { value: new THREE.Color('#274c7d') },
      uMidColor: { value: new THREE.Color('#7ca3cc') },
      uHorizonColor: { value: new THREE.Color('#efd0b2') },
      uGroundColor: { value: new THREE.Color('#5a4334') },
      uSunColor: { value: new THREE.Color('#ffe5be') },
      uSunDir: { value: new THREE.Vector3(0.5, 0.35, 0.6).normalize() },
      uSunGlow: { value: 0.75 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uGroundColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunGlow;
      varying vec3 vWorldDir;

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = dir.y;
        vec3 col;
        if (h >= 0.0) {
          float t1 = smoothstep(0.0, 0.24, h);
          float t2 = smoothstep(0.18, 0.85, h);
          col = mix(uHorizonColor, uMidColor, t1);
          col = mix(col, uTopColor, t2);
        } else {
          float g = smoothstep(0.0, -0.35, h);
          col = mix(uHorizonColor * 0.72, uGroundColor, g);
        }

        // Warm Mie forward-scattering halo + crisp sun disc
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        float halo = pow(sunDot, 10.0) * 0.32 * uSunGlow;
        float core = smoothstep(0.9982, 0.9997, sunDot) * 1.45 * uSunGlow;
        col += uSunColor * (halo + core) * smoothstep(-0.08, 0.05, h);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export const VesselViewport = forwardRef<VesselViewportHandle, VesselViewportProps>(
  function VesselViewport({ params, inspectorVisible, onStats, onActiveCameraChange }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const paramsRef = useRef<VesselParams>(params);
    paramsRef.current = params;

    const inspectorVisibleRef = useRef(inspectorVisible);
    inspectorVisibleRef.current = inspectorVisible;

    const boundsRef = useRef({ radius: 22.6, height: 33.0, centerY: 15.8 });

    const threeRef = useRef<{
      renderer: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      controls: OrbitControls;
      composer: EffectComposer;
      bloomPass: UnrealBloomPass;
      pmrem: THREE.PMREMGenerator;
      skyMesh: THREE.Mesh;
      skyMat: THREE.ShaderMaterial;
      sunLight: THREE.DirectionalLight;
      hemiLight: THREE.HemisphereLight;
      rimLight: THREE.DirectionalLight;
      atriumLights: THREE.PointLight[];
      plazaMesh: THREE.Mesh;
      plazaMat: THREE.MeshStandardMaterial;
      vesselGroup: THREE.Group;
      meshes: Record<MaterialBucket, THREE.Mesh>;
      materials: {
        copper: THREE.MeshPhysicalMaterial;
        steel: THREE.MeshStandardMaterial;
        concrete: THREE.MeshStandardMaterial;
        glass: THREE.MeshPhysicalMaterial;
        handrail: THREE.MeshPhysicalMaterial;
        baseStone: THREE.MeshStandardMaterial;
      };
      wireMaterials: Record<MaterialBucket, THREE.MeshBasicMaterial>;
      envRT: THREE.WebGLRenderTarget | null;
      camAnim: CameraAnim;
      updateEnvironment: (p: VesselParams) => void;
      applyViewOffset: () => void;
      viewportW: number;
      viewportH: number;
    } | null>(null);

    const computeCameraTarget = (preset: CameraPresetId) => {
      const { radius, height, centerY } = boundsRef.current;
      const scale = Math.max(radius, height * 0.68);

      switch (preset) {
        case 'oculus': {
          const baseY = paramsRef.current.showBasePlinth ? paramsRef.current.baseHeight : 0;
          return {
            pos: new THREE.Vector3(0.01, baseY + 1.15, 0.12),
            target: new THREE.Vector3(0, height * 1.15, 0),
            fov: 76,
          };
        }
        case 'closeup': {
          const midR = (paramsRef.current.baseRadius + paramsRef.current.topRadius) * 0.5;
          const midY = height * 0.52;
          return {
            pos: new THREE.Vector3(midR * 0.85, midY + 4.2, midR * 1.65),
            target: new THREE.Vector3(midR * 0.25, midY - 0.5, midR * 0.88),
            fov: 38,
          };
        }
        case 'isometric':
          return {
            pos: new THREE.Vector3(scale * 2.55, scale * 2.75, scale * 2.55),
            target: new THREE.Vector3(0, centerY * 0.9, 0),
            fov: 38,
          };
        case 'plaza':
          return {
            pos: new THREE.Vector3(scale * 0.72, 2.5, scale * 2.65),
            target: new THREE.Vector3(0, height * 0.54, 0),
            fov: 46,
          };
        case 'hero':
        default:
          return {
            pos: new THREE.Vector3(0, scale * 1.48, scale * 3.65),
            target: new THREE.Vector3(0, centerY, 0),
            fov: 40,
          };
      }
    };

    useImperativeHandle(ref, () => ({
      flyToPreset(preset: CameraPresetId) {
        const ctx = threeRef.current;
        if (!ctx) return;
        const { pos, target, fov } = computeCameraTarget(preset);
        ctx.camAnim = {
          active: true,
          startTime: performance.now(),
          duration: 1000,
          fromPos: ctx.camera.position.clone(),
          toPos: pos,
          fromTarget: ctx.controls.target.clone(),
          toTarget: target,
          fromFov: ctx.camera.fov,
          toFov: fov,
        };
        onActiveCameraChange?.(preset);
      },
      exportGLB() {
        const ctx = threeRef.current;
        if (!ctx) return;
        const exporter = new GLTFExporter();
        exporter.parse(
          ctx.vesselGroup,
          (result) => {
            if (result instanceof ArrayBuffer) {
              const blob = new Blob([result], { type: 'model/gltf-binary' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `The_Vessel_${paramsRef.current.radialBays}bays_${paramsRef.current.verticalLevels}lvls.glb`;
              a.click();
              URL.revokeObjectURL(url);
            }
          },
          (err) => {
            console.error('GLB Export Error:', err);
          },
          { binary: true }
        );
      },
    }));

    // =========================================================================
    // INITIALIZE THREE.JS SCENE, CALIBRATED SKY, MATERIALS & POST-PROCESSING
    // =========================================================================
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2('#d8c4b0', 0.0012);

      const camera = new THREE.PerspectiveCamera(40, width / height, 0.2, 4000);
      camera.position.set(0, 34, 84);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      // Allow looking straight up inside the Oculus & from the ground plaza!
      // Ground collision is enforced cleanly via camera.position.y clamp below.
      controls.minPolarAngle = 0.02;
      controls.maxPolarAngle = Math.PI * 0.985;
      controls.minDistance = 0.4;
      controls.maxDistance = 360;
      controls.target.set(0, 15.8, 0);
      controls.autoRotateSpeed = 0.55;

      const onControlStart = () => {
        if (threeRef.current) {
          threeRef.current.camAnim.active = false;
        }
        onActiveCameraChange?.(null);
      };
      controls.addEventListener('start', onControlStart);

      // 4x MSAA EffectComposer with subtle restrained architectural Bloom
      const msaaRT = new THREE.WebGLRenderTarget(width, height, {
        type: THREE.HalfFloatType,
        samples: 4,
      });
      const composer = new EffectComposer(renderer, msaaRT);
      const renderPass = new RenderPass(scene, camera);
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.14, 0.36, 1.25);
      const outputPass = new OutputPass();
      composer.addPass(renderPass);
      composer.addPass(bloomPass);
      composer.addPass(outputPass);

      // Calibrated Architectural Atmospheric Sky Dome
      const skyMat = createCalibratedSkyMaterial();
      const skyGeo = new THREE.SphereGeometry(2200, 48, 32);
      const skyMesh = new THREE.Mesh(skyGeo, skyMat);
      scene.add(skyMesh);

      // Architectural Lighting Rig
      const sunLight = new THREE.DirectionalLight('#ffdfba', 2.8);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(4096, 4096);
      sunLight.shadow.camera.near = 5;
      sunLight.shadow.camera.far = 280;
      const d = 62;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.00035;
      sunLight.shadow.normalBias = 0.025;
      scene.add(sunLight);

      const hemiLight = new THREE.HemisphereLight('#9ec2ec', '#5e4332', 0.72);
      scene.add(hemiLight);

      const rimLight = new THREE.DirectionalLight('#8ab4e8', 0.52);
      rimLight.position.set(-50, 32, -55);
      scene.add(rimLight);

      // Tasteful Architectural Atrium Uplights (glow gently onto copper soffits in Dusk!)
      const atriumLights: THREE.PointLight[] = [];
      const centerUplight = new THREE.PointLight('#ff9a50', 8, 65, 1.5);
      centerUplight.position.set(0, 8, 0);
      scene.add(centerUplight);
      atriumLights.push(centerUplight);

      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const pl = new THREE.PointLight('#ff8f44', 0, 50, 1.65);
        pl.position.set(Math.cos(a) * 14, 16, Math.sin(a) * 14);
        scene.add(pl);
        atriumLights.push(pl);
      }

      // Procedural PBR Textures
      const copperMaps = createCopperMaps();
      const concreteMaps = createConcreteMaps();
      const plazaMaps = createPlazaMaps();

      // Architectural PBR Materials
      const palette = FINISH_PALETTES[paramsRef.current.finishPreset];
      const materials = {
        copper: new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(palette.copperHex),
          metalness: paramsRef.current.copperMetalness,
          roughness: paramsRef.current.copperRoughness,
          bumpMap: copperMaps.bumpMap,
          bumpScale: 0.016,
          roughnessMap: copperMaps.roughnessMap,
          clearcoat: 0.25,
          clearcoatRoughness: 0.1,
          envMapIntensity: 1.25,
        }),
        steel: new THREE.MeshStandardMaterial({
          color: new THREE.Color(palette.steelHex),
          metalness: 0.85,
          roughness: 0.34,
          envMapIntensity: 1.0,
        }),
        concrete: new THREE.MeshStandardMaterial({
          color: new THREE.Color(palette.concreteHex),
          map: concreteMaps.map,
          bumpMap: concreteMaps.bumpMap,
          bumpScale: 0.014,
          metalness: 0.0,
          roughness: 0.78,
          envMapIntensity: 0.55,
        }),
        glass: new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(palette.glassHex),
          metalness: 0.05,
          roughness: 0.06,
          transparent: true,
          opacity: 0.3,
          reflectivity: 0.85,
          clearcoat: 0.9,
          clearcoatRoughness: 0.04,
          depthWrite: false,
          side: THREE.DoubleSide,
          envMapIntensity: 1.05,
        }),
        handrail: new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(palette.handrailHex),
          metalness: 0.95,
          roughness: 0.22,
          clearcoat: 0.2,
          envMapIntensity: 1.25,
        }),
        baseStone: new THREE.MeshStandardMaterial({
          color: new THREE.Color('#3b3e42'),
          bumpMap: concreteMaps.bumpMap,
          bumpScale: 0.02,
          metalness: 0.04,
          roughness: 0.56,
          envMapIntensity: 0.65,
        }),
      };

      // Dedicated luminous CAD blueprint wireframe materials (avoids dark metallic PBR + shadow-acne blackness!)
      const wireMaterials: Record<MaterialBucket, THREE.MeshBasicMaterial> = {
        copper: new THREE.MeshBasicMaterial({ color: '#f29e6d', wireframe: true }),
        steel: new THREE.MeshBasicMaterial({ color: '#7d92ad', wireframe: true }),
        concrete: new THREE.MeshBasicMaterial({ color: '#e5dfd5', wireframe: true }),
        glass: new THREE.MeshBasicMaterial({
          color: '#7ad4ef',
          wireframe: true,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
        handrail: new THREE.MeshBasicMaterial({ color: '#ffd285', wireframe: true }),
        baseStone: new THREE.MeshBasicMaterial({ color: '#9d9489', wireframe: true }),
      };

      // Hudson Yards Architectural Plaza Ground Plane
      const plazaMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#7a7c82'),
        map: plazaMaps.map,
        bumpMap: plazaMaps.bumpMap,
        bumpScale: 0.022,
        roughnessMap: plazaMaps.roughnessMap,
        roughness: 0.76,
        metalness: 0.04,
        envMapIntensity: 0.55,
      });
      const plazaGeo = new THREE.CircleGeometry(1800, 96);
      plazaGeo.rotateX(-Math.PI / 2);
      const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
      plazaMesh.receiveShadow = true;
      plazaMesh.position.y = -0.005;
      scene.add(plazaMesh);

      // Batched Vessel Meshes (ONLY 6 draw calls!)
      const vesselGroup = new THREE.Group();
      vesselGroup.name = 'The_Vessel';
      scene.add(vesselGroup);

      const makeVesselMesh = (name: string, mat: THREE.Material, castShadow = true) => {
        const m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
        m.name = name;
        m.castShadow = castShadow;
        m.receiveShadow = true;
        vesselGroup.add(m);
        return m;
      };

      const meshes: Record<MaterialBucket, THREE.Mesh> = {
        copper: makeVesselMesh('Vessel_Copper_Cladding', materials.copper, true),
        steel: makeVesselMesh('Vessel_Dark_Steel', materials.steel, true),
        concrete: makeVesselMesh('Vessel_Concrete_Treads', materials.concrete, true),
        handrail: makeVesselMesh('Vessel_Handrails', materials.handrail, true),
        baseStone: makeVesselMesh('Vessel_Base_Plinth', materials.baseStone, true),
        glass: makeVesselMesh('Vessel_Balustrade_Glass', materials.glass, false),
      };
      meshes.glass.renderOrder = 2;

      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();

      // Optical frustum centering so Vessel sits centered left of right-hand drawer!
      const applyViewOffset = () => {
        const ctx = threeRef.current;
        if (!ctx) return;
        const w = ctx.viewportW;
        const h = ctx.viewportH;
        const shiftPx = inspectorVisibleRef.current && w > 860 ? 172 : 0;
        if (shiftPx > 0) {
          camera.setViewOffset(w, h, shiftPx, 0, w, h);
        } else {
          camera.clearViewOffset();
        }
      };

      // Environment, Lighting & Calibrated PMREM Baker
      const updateEnvironment = (p: VesselParams) => {
        const ctx = threeRef.current;
        const mood = p.lightingMood;
        const u = skyMat.uniforms;

        let elevDeg = p.sunElevationDeg;
        const azimDeg = p.sunAzimuthDeg;

        if (mood === 'blueHour') {
          elevDeg = Math.min(elevDeg, 4.0);
          skyMesh.visible = true;
          scene.background = null;
          u.uTopColor.value.set('#0b162c');
          u.uMidColor.value.set('#1f3559');
          u.uHorizonColor.value.set('#b86b4a');
          u.uGroundColor.value.set('#1a1618');
          u.uSunColor.value.set('#ff9958');
          u.uSunGlow.value = 0.65;
          scene.fog = new THREE.FogExp2('#162034', 0.0022);
          sunLight.color.set('#ff9658');
          sunLight.intensity = 1.05;
          hemiLight.color.set('#446aa8');
          hemiLight.groundColor.set('#2c1e18');
          hemiLight.intensity = 0.65;
          rimLight.color.set('#5882d4');
          rimLight.intensity = 0.72;
          // Rich warm architectural grazing light — zero blown-out center fireball!
          atriumLights[0].intensity = 52;
          for (let i = 1; i < atriumLights.length; i++) atriumLights[i].intensity = 26;
          plazaMat.color.set('#484d58');
          plazaMat.roughness = 0.44;
          renderer.toneMappingExposure = 1.08;
          bloomPass.strength = 0.22;
          bloomPass.threshold = 1.15;
        } else if (mood === 'noon') {
          skyMesh.visible = true;
          scene.background = null;
          u.uTopColor.value.set('#1f559c');
          u.uMidColor.value.set('#6aa5dc');
          u.uHorizonColor.value.set('#dce8f4');
          u.uGroundColor.value.set('#6e6862');
          u.uSunColor.value.set('#fff8ee');
          u.uSunGlow.value = 0.55;
          scene.fog = new THREE.FogExp2('#cddae6', 0.001);
          sunLight.color.set('#fff8ef');
          sunLight.intensity = 3.1;
          hemiLight.color.set('#b6d6ff');
          hemiLight.groundColor.set('#686058');
          hemiLight.intensity = 0.82;
          rimLight.color.set('#a8c8f0');
          rimLight.intensity = 0.45;
          atriumLights[0].intensity = 6;
          for (let i = 1; i < atriumLights.length; i++) atriumLights[i].intensity = 0;
          plazaMat.color.set('#84888e');
          plazaMat.roughness = 0.78;
          renderer.toneMappingExposure = 0.96;
          bloomPass.strength = 0.1;
          bloomPass.threshold = 1.3;
        } else if (mood === 'studio') {
          skyMesh.visible = false;
          scene.background = new THREE.Color('#dfe2e7');
          scene.fog = new THREE.FogExp2('#dfe2e7', 0.0026);
          sunLight.color.set('#fffbf4');
          sunLight.intensity = 2.4;
          hemiLight.color.set('#ffffff');
          hemiLight.groundColor.set('#969089');
          hemiLight.intensity = 0.92;
          rimLight.color.set('#d8e6f8');
          rimLight.intensity = 0.75;
          atriumLights[0].intensity = 8;
          for (let i = 1; i < atriumLights.length; i++) atriumLights[i].intensity = 0;
          plazaMat.color.set('#cfd2d7');
          plazaMat.roughness = 0.86;
          renderer.toneMappingExposure = 0.98;
          bloomPass.strength = 0.08;
          bloomPass.threshold = 1.35;
        } else {
          // Golden Hour Hudson Yards — calibrated dynamic range for crisp architectural copper!
          skyMesh.visible = true;
          scene.background = null;
          u.uTopColor.value.set('#264b7c');
          u.uMidColor.value.set('#7a9fc6');
          u.uHorizonColor.value.set('#ebd0b4');
          u.uGroundColor.value.set('#5a4335');
          u.uSunColor.value.set('#ffe0b5');
          u.uSunGlow.value = 0.65;
          scene.fog = new THREE.FogExp2('#d8c4b0', 0.0012);
          sunLight.color.set('#ffdfba');
          sunLight.intensity = 2.85;
          hemiLight.color.set('#9bc0ec');
          hemiLight.groundColor.set('#634634');
          hemiLight.intensity = 0.72;
          rimLight.color.set('#8eb4e6');
          rimLight.intensity = 0.55;
          atriumLights[0].intensity = 14;
          for (let i = 1; i < atriumLights.length; i++) atriumLights[i].intensity = 0;
          plazaMat.color.set('#76787e');
          plazaMat.roughness = 0.74;
          renderer.toneMappingExposure = 0.98;
          bloomPass.strength = 0.14;
          bloomPass.threshold = 1.28;
        }

        const phi = THREE.MathUtils.degToRad(90 - elevDeg);
        const theta = THREE.MathUtils.degToRad(azimDeg);
        const sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
        u.uSunDir.value.copy(sunDir);
        sunLight.position.copy(sunDir).multiplyScalar(120);

        if (ctx?.envRT) {
          ctx.envRT.dispose();
        }
        let nextEnvRT: THREE.WebGLRenderTarget;
        if (mood === 'studio') {
          const roomEnv = new RoomEnvironment();
          nextEnvRT = pmrem.fromScene(roomEnv, 0.03);
          roomEnv.dispose();
        } else {
          const envScene = new THREE.Scene();
          const envSkyMat = skyMat.clone();
          const envDome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 20), envSkyMat);
          envScene.add(envDome);

          // Crisp architectural light panels in env dome for sharp metallic specular bands on copper!
          const keyCard = new THREE.Mesh(
            new THREE.PlaneGeometry(18, 10),
            new THREE.MeshBasicMaterial({
              color: mood === 'blueHour' ? '#ffb378' : '#fff0d8',
              side: THREE.DoubleSide,
            })
          );
          keyCard.position.copy(sunDir).multiplyScalar(32);
          keyCard.lookAt(0, 0, 0);
          envScene.add(keyCard);

          nextEnvRT = pmrem.fromScene(envScene, 0.02);
          envDome.geometry.dispose();
          envSkyMat.dispose();
          keyCard.geometry.dispose();
          (keyCard.material as THREE.Material).dispose();
        }
        scene.environment = nextEnvRT.texture;
        if (ctx) {
          ctx.envRT = nextEnvRT;
        }
      };

      threeRef.current = {
        renderer,
        scene,
        camera,
        controls,
        composer,
        bloomPass,
        pmrem,
        skyMesh,
        skyMat,
        sunLight,
        hemiLight,
        rimLight,
        atriumLights,
        plazaMesh,
        plazaMat,
        vesselGroup,
        meshes,
        materials,
        wireMaterials,
        envRT: null,
        camAnim: {
          active: false,
          startTime: 0,
          duration: 1000,
          fromPos: new THREE.Vector3(),
          toPos: new THREE.Vector3(),
          fromTarget: new THREE.Vector3(),
          toTarget: new THREE.Vector3(),
          fromFov: 40,
          toFov: 40,
        },
        updateEnvironment,
        applyViewOffset,
        viewportW: width,
        viewportH: height,
      };

      applyViewOffset();
      updateEnvironment(paramsRef.current);

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.max(1, entry.contentRect.width);
          const h = Math.max(1, entry.contentRect.height);
          if (threeRef.current) {
            threeRef.current.viewportW = w;
            threeRef.current.viewportH = h;
          }
          camera.aspect = w / h;
          applyViewOffset();
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
          composer.setSize(w, h);
          bloomPass.resolution.set(w, h);
        }
      });
      resizeObserver.observe(container);

      let rafId = 0;
      const animate = (now: number) => {
        rafId = requestAnimationFrame(animate);
        const ctx = threeRef.current;
        if (!ctx) return;

        const anim = ctx.camAnim;
        if (anim.active) {
          const rawT = Math.min((now - anim.startTime) / anim.duration, 1);
          const ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
          camera.position.lerpVectors(anim.fromPos, anim.toPos, ease);
          controls.target.lerpVectors(anim.fromTarget, anim.toTarget, ease);
          camera.fov = THREE.MathUtils.lerp(anim.fromFov, anim.toFov, ease);
          camera.updateProjectionMatrix();
          if (rawT >= 1) anim.active = false;
        }

        controls.autoRotate = paramsRef.current.autoOrbit && !anim.active;
        controls.update();

        // Keep camera safely above plaza floor while allowing full upward Oculus tilt!
        if (camera.position.y < 1.1) {
          camera.position.y = 1.1;
        }

        composer.render();
      };
      rafId = requestAnimationFrame(animate);

      return () => {
        cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        controls.removeEventListener('start', onControlStart);
        controls.dispose();
        msaaRT.dispose();
        composer.dispose();
        pmrem.dispose();
        if (threeRef.current?.envRT) threeRef.current.envRT.dispose();
        for (const key of Object.keys(meshes) as MaterialBucket[]) {
          meshes[key].geometry.dispose();
        }
        Object.values(materials).forEach((m) => m.dispose());
        Object.values(wireMaterials).forEach((m) => m.dispose());
        copperMaps.bumpMap.dispose();
        copperMaps.roughnessMap.dispose();
        concreteMaps.map.dispose();
        concreteMaps.bumpMap.dispose();
        plazaMaps.map.dispose();
        plazaMaps.bumpMap.dispose();
        plazaMaps.roughnessMap.dispose();
        plazaGeo.dispose();
        plazaMat.dispose();
        skyGeo.dispose();
        skyMat.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        threeRef.current = null;
      };
    }, []);

    // Update optical frustum offset smoothly when inspector opens/closes
    useEffect(() => {
      threeRef.current?.applyViewOffset();
    }, [inspectorVisible]);

    // =========================================================================
    // REBUILD PROCEDURAL GEOMETRY WHEN GEOMETRIC PARAMS CHANGE
    // =========================================================================
    useEffect(() => {
      const ctx = threeRef.current;
      if (!ctx) return;

      const result = generateVesselGeometry(params);
      boundsRef.current = {
        radius: result.boundingRadius,
        height: result.stats.overallHeight,
        centerY: result.centerHeight,
      };

      for (const bucket of Object.keys(result.geometries) as MaterialBucket[]) {
        const mesh = ctx.meshes[bucket];
        const prev = mesh.geometry;
        mesh.geometry = result.geometries[bucket];
        prev.dispose();
      }

      const d = Math.max(56, result.boundingRadius * 2.3, result.stats.overallHeight * 1.5);
      ctx.sunLight.shadow.camera.left = -d;
      ctx.sunLight.shadow.camera.right = d;
      ctx.sunLight.shadow.camera.top = d;
      ctx.sunLight.shadow.camera.bottom = -d;
      ctx.sunLight.shadow.camera.updateProjectionMatrix();

      ctx.atriumLights[0].position.y = Math.max(5, result.stats.overallHeight * 0.28);
      for (let i = 1; i < ctx.atriumLights.length; i++) {
        ctx.atriumLights[i].position.y = result.stats.overallHeight * 0.56;
      }

      onStats(result.stats);
    }, [
      params.radialBays,
      params.verticalLevels,
      params.totalHeight,
      params.baseRadius,
      params.topRadius,
      params.profilePower,
      params.profileBulge,
      params.verticalPower,
      params.spiralTwistDeg,
      params.landingRatio,
      params.walkwayWidth,
      params.doubleTrackSplit,
      params.flightGap,
      params.closeTopRim,
      params.stepsPerFlight,
      params.stepNosing,
      params.slabThickness,
      params.soffitDepth,
      params.soffitTaper,
      params.stringerWidth,
      params.showStructuralRibs,
      params.showRailings,
      params.showGlass,
      params.railingHeight,
      params.glassThickness,
      params.handrailWidth,
      params.handrailHeight,
      params.postsPerSpan,
      params.showBasePlinth,
      params.baseHeight,
      params.baseOverhang,
      params.baseStepTiers,
      onStats,
    ]);

    // =========================================================================
    // LIVE MATERIAL FINISH & CLEAN CAD WIREFRAME MODE UPDATES
    // =========================================================================
    useEffect(() => {
      const ctx = threeRef.current;
      if (!ctx) return;

      const pal = FINISH_PALETTES[params.finishPreset];
      ctx.materials.copper.color.set(pal.copperHex);
      ctx.materials.copper.roughness = params.copperRoughness;
      ctx.materials.copper.metalness = params.copperMetalness;
      ctx.materials.handrail.color.set(pal.handrailHex);
      ctx.materials.steel.color.set(pal.steelHex);
      ctx.materials.concrete.color.set(pal.concreteHex);
      ctx.materials.glass.color.set(pal.glassHex);

      // Adapt crisp CAD wireframe palette to lighting mood (dark lines on bright Studio, luminous lines elsewhere!)
      const isStudio = params.lightingMood === 'studio';
      const accentWire = new THREE.Color(pal.copperHex);
      if (isStudio) {
        accentWire.lerp(new THREE.Color('#4a2610'), 0.25);
        ctx.wireMaterials.copper.color.copy(accentWire);
        ctx.wireMaterials.steel.color.set('#333e4f');
        ctx.wireMaterials.concrete.color.set('#5e6672');
        ctx.wireMaterials.glass.color.set('#277996');
        ctx.wireMaterials.handrail.color.set('#9e6424');
        ctx.wireMaterials.baseStone.color.set('#4c515a');
      } else {
        accentWire.lerp(new THREE.Color('#ffd3b3'), 0.36);
        ctx.wireMaterials.copper.color.copy(accentWire);
        ctx.wireMaterials.steel.color.set('#7e94b0');
        ctx.wireMaterials.concrete.color.set('#e8e2d8');
        ctx.wireMaterials.glass.color.set('#7fd9f5');
        ctx.wireMaterials.handrail.color.set('#ffd48a');
        ctx.wireMaterials.baseStone.color.set('#a39b90');
      }

      const buckets: MaterialBucket[] = [
        'copper',
        'steel',
        'concrete',
        'glass',
        'handrail',
        'baseStone',
      ];
      for (const b of buckets) {
        const mesh = ctx.meshes[b];
        if (params.wireframe) {
          mesh.material = ctx.wireMaterials[b];
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        } else {
          mesh.material = ctx.materials[b];
          mesh.castShadow = b !== 'glass';
          mesh.receiveShadow = true;
        }
      }
    }, [
      params.finishPreset,
      params.copperRoughness,
      params.copperMetalness,
      params.wireframe,
      params.lightingMood,
    ]);

    // =========================================================================
    // LIVE LIGHTING MOOD & SUN POSITION UPDATES
    // =========================================================================
    useEffect(() => {
      const ctx = threeRef.current;
      if (!ctx) return;
      ctx.updateEnvironment(params);
    }, [params.lightingMood, params.sunElevationDeg, params.sunAzimuthDeg]);

    return (
      <div
        ref={containerRef}
        className="viewport-canvas"
        aria-label="Interactive 3D viewport of The Vessel"
      />
    );
  }
);
