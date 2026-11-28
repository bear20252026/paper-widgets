import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { generateVesselGeometry, type MaterialBucket } from '../geometry/vesselGenerator';
import { createConcreteMaps, createCopperMaps, createPlazaMaps } from '../three/proceduralTextures';
import { ControlPanel } from '../components/ControlPanel';
import { FINISH_PALETTES, type VesselParams, type VesselStats } from '../types/vessel';
import {
  evaluateDirectorFrame,
  VIDEO_FPS,
  VIDEO_TOTAL_FRAMES,
  type DirectorFrameState,
} from './directorTimeline';
import { DirectorOverlay } from './DirectorOverlay';

declare global {
  interface Window {
    __VESSEL_DIRECTOR__?: {
      ready: boolean;
      totalFrames: number;
      fps: number;
      seekFrame: (frame: number) => Promise<void>;
    };
  }
}

function createCalibratedSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor: { value: new THREE.Color('#264b7c') },
      uMidColor: { value: new THREE.Color('#7a9fc6') },
      uHorizonColor: { value: new THREE.Color('#ebd0b4') },
      uGroundColor: { value: new THREE.Color('#5a4335') },
      uSunColor: { value: new THREE.Color('#ffe0b5') },
      uSunDir: { value: new THREE.Vector3(0.5, 0.35, 0.6).normalize() },
      uSunGlow: { value: 0.65 },
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
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        float halo = pow(sunDot, 10.0) * 0.32 * uSunGlow;
        float core = smoothstep(0.9982, 0.9997, sunDot) * 1.45 * uSunGlow;
        col += uSunColor * (halo + core) * smoothstep(-0.08, 0.05, h);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function geometryKey(p: VesselParams): string {
  return [
    p.radialBays,
    p.verticalLevels,
    p.totalHeight.toFixed(3),
    p.baseRadius.toFixed(3),
    p.topRadius.toFixed(3),
    p.profilePower.toFixed(3),
    p.profileBulge.toFixed(3),
    p.verticalPower.toFixed(3),
    p.spiralTwistDeg.toFixed(2),
    p.landingRatio.toFixed(4),
    p.walkwayWidth.toFixed(3),
    p.doubleTrackSplit.toFixed(3),
    p.flightGap.toFixed(3),
    p.closeTopRim ? 1 : 0,
    p.stepsPerFlight,
    p.stepNosing.toFixed(4),
    p.slabThickness.toFixed(3),
    p.soffitDepth.toFixed(3),
    p.soffitTaper.toFixed(4),
    p.stringerWidth.toFixed(3),
    p.showStructuralRibs ? 1 : 0,
    p.showRailings ? 1 : 0,
    p.showGlass ? 1 : 0,
    p.railingHeight.toFixed(3),
    p.glassThickness.toFixed(4),
    p.handrailWidth.toFixed(3),
    p.handrailHeight.toFixed(3),
    p.postsPerSpan,
    p.showBasePlinth ? 1 : 0,
    p.baseHeight.toFixed(3),
    p.baseOverhang.toFixed(3),
    p.baseStepTiers,
  ].join('|');
}

export function DirectorStage({ autoplay = false }: { autoplay?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [frameState, setFrameState] = useState<DirectorFrameState>(() =>
    evaluateDirectorFrame(0, VIDEO_FPS)
  );
  const [stats, setStats] = useState<VesselStats>({
    landings: 88,
    flights: 160,
    totalSteps: 2240,
    vertices: 0,
    triangles: 116524,
    rebuildMs: 0,
    overallHeight: 33.0,
    overallDiameter: 45.2,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 1920;
    const height = container.clientHeight || 1080;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(1); // Exact 1:1 1920x1080 capture!
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

    const skyMat = createCalibratedSkyMaterial();
    const skyGeo = new THREE.SphereGeometry(2200, 48, 32);
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);

    const sunLight = new THREE.DirectionalLight('#ffdfba', 2.85);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(4096, 4096);
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 280;
    sunLight.shadow.bias = -0.00035;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight('#9bc0ec', '#634634', 0.72);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight('#8eb4e6', 0.55);
    rimLight.position.set(-50, 32, -55);
    scene.add(rimLight);

    const atriumLights: THREE.PointLight[] = [];
    const centerUplight = new THREE.PointLight('#ff9a50', 14, 65, 1.5);
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

    const copperMaps = createCopperMaps();
    const concreteMaps = createConcreteMaps();
    const plazaMaps = createPlazaMaps();

    const materials = {
      copper: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#c46c43'),
        metalness: 0.96,
        roughness: 0.16,
        bumpMap: copperMaps.bumpMap,
        bumpScale: 0.016,
        roughnessMap: copperMaps.roughnessMap,
        clearcoat: 0.25,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.25,
      }),
      steel: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#181a1f'),
        metalness: 0.85,
        roughness: 0.34,
        envMapIntensity: 1.0,
      }),
      concrete: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#9c978f'),
        map: concreteMaps.map,
        bumpMap: concreteMaps.bumpMap,
        bumpScale: 0.014,
        metalness: 0.0,
        roughness: 0.78,
        envMapIntensity: 0.55,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#b8ced6'),
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
        color: new THREE.Color('#d48858'),
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

    const wireMaterials: Record<MaterialBucket, THREE.MeshBasicMaterial> = {
      copper: new THREE.MeshBasicMaterial({ color: '#f29e6d', wireframe: true }),
      steel: new THREE.MeshBasicMaterial({ color: '#7e94b0', wireframe: true }),
      concrete: new THREE.MeshBasicMaterial({ color: '#e8e2d8', wireframe: true }),
      glass: new THREE.MeshBasicMaterial({
        color: '#7fd9f5',
        wireframe: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
      handrail: new THREE.MeshBasicMaterial({ color: '#ffd48a', wireframe: true }),
      baseStone: new THREE.MeshBasicMaterial({ color: '#a39b90', wireframe: true }),
    };

    const plazaMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#76787e'),
      map: plazaMaps.map,
      bumpMap: plazaMaps.bumpMap,
      bumpScale: 0.022,
      roughnessMap: plazaMaps.roughnessMap,
      roughness: 0.74,
      metalness: 0.04,
      envMapIntensity: 0.55,
    });
    const plazaGeo = new THREE.CircleGeometry(1800, 96);
    plazaGeo.rotateX(-Math.PI / 2);
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.receiveShadow = true;
    plazaMesh.position.y = -0.005;
    scene.add(plazaMesh);

    const vesselGroup = new THREE.Group();
    scene.add(vesselGroup);

    const makeMesh = (mat: THREE.Material, cast = true) => {
      const m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      m.castShadow = cast;
      m.receiveShadow = true;
      vesselGroup.add(m);
      return m;
    };

    const meshes: Record<MaterialBucket, THREE.Mesh> = {
      copper: makeMesh(materials.copper, true),
      steel: makeMesh(materials.steel, true),
      concrete: makeMesh(materials.concrete, true),
      handrail: makeMesh(materials.handrail, true),
      baseStone: makeMesh(materials.baseStone, true),
      glass: makeMesh(materials.glass, false),
    };
    meshes.glass.renderOrder = 2;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    let lastGeomKey = '';
    let lastEnvKey = '';
    let envRT: THREE.WebGLRenderTarget | null = null;
    let latestStats: VesselStats = {
      landings: 88,
      flights: 160,
      totalSteps: 2240,
      vertices: 0,
      triangles: 116524,
      rebuildMs: 0,
      overallHeight: 33.0,
      overallDiameter: 45.2,
    };

    const applyEnvironment = (p: VesselParams) => {
      const envKey = `${p.lightingMood}|${Math.round(p.sunElevationDeg * 2)}|${Math.round(p.sunAzimuthDeg * 0.5)}`;
      if (envKey === lastEnvKey) return;
      lastEnvKey = envKey;

      const mood = p.lightingMood;
      const u = skyMat.uniforms;
      let elevDeg = p.sunElevationDeg;

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
      const theta = THREE.MathUtils.degToRad(p.sunAzimuthDeg);
      const sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
      u.uSunDir.value.copy(sunDir);
      sunLight.position.copy(sunDir).multiplyScalar(120);

      if (envRT) envRT.dispose();
      if (mood === 'studio') {
        const roomEnv = new RoomEnvironment();
        envRT = pmrem.fromScene(roomEnv, 0.03);
        roomEnv.dispose();
      } else {
        const envScene = new THREE.Scene();
        const envSkyMat = skyMat.clone();
        const envDome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 20), envSkyMat);
        envScene.add(envDome);
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
        envRT = pmrem.fromScene(envScene, 0.02);
        envDome.geometry.dispose();
        envSkyMat.dispose();
        keyCard.geometry.dispose();
        (keyCard.material as THREE.Material).dispose();
      }
      scene.environment = envRT.texture;
    };

    const renderExactFrame = (frameIdx: number) => {
      const st = evaluateDirectorFrame(frameIdx, VIDEO_FPS);
      const p = st.params;

      // 1. Rebuild geometry ONLY if geometric params changed!
      const gKey = geometryKey(p);
      if (gKey !== lastGeomKey) {
        lastGeomKey = gKey;
        const result = generateVesselGeometry(p);
        for (const bucket of Object.keys(result.geometries) as MaterialBucket[]) {
          const prev = meshes[bucket].geometry;
          meshes[bucket].geometry = result.geometries[bucket];
          prev.dispose();
        }
        const d = Math.max(56, result.boundingRadius * 2.3, result.stats.overallHeight * 1.5);
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        sunLight.shadow.camera.updateProjectionMatrix();

        atriumLights[0].position.y = Math.max(5, result.stats.overallHeight * 0.28);
        for (let i = 1; i < atriumLights.length; i++) {
          atriumLights[i].position.y = result.stats.overallHeight * 0.56;
        }
        latestStats = result.stats;
      }

      // 2. Materials & Clean CAD Wireframe Mode
      const pal = FINISH_PALETTES[p.finishPreset];
      materials.copper.color.set(pal.copperHex);
      materials.copper.roughness = p.copperRoughness;
      materials.copper.metalness = p.copperMetalness;
      materials.handrail.color.set(pal.handrailHex);
      materials.steel.color.set(pal.steelHex);
      materials.concrete.color.set(pal.concreteHex);
      materials.glass.color.set(pal.glassHex);

      const allBuckets: MaterialBucket[] = ['copper', 'steel', 'concrete', 'glass', 'handrail', 'baseStone'];
      for (const b of allBuckets) {
        meshes[b].material = p.wireframe ? wireMaterials[b] : materials[b];
        meshes[b].castShadow = p.wireframe ? false : b !== 'glass';
        meshes[b].receiveShadow = !p.wireframe;
      }

      // 3. Environment / Sky / Lighting
      applyEnvironment(p);

      // 4. Camera Choreography + View Offset for Shot 12 Full UI
      camera.fov = st.cameraFov;
      if (st.showFullUI) {
        camera.setViewOffset(width, height, 172, 0, width, height);
      } else {
        camera.clearViewOffset();
      }
      camera.position.set(st.cameraPos[0], st.cameraPos[1], st.cameraPos[2]);
      camera.lookAt(st.cameraTarget[0], st.cameraTarget[1], st.cameraTarget[2]);
      camera.updateProjectionMatrix();

      // 5. Render synchronously
      composer.render();

      // 6. Sync React overlay state
      setFrameState(st);
      setStats(latestStats);
    };

    // Initial frame 0
    renderExactFrame(0);

    // Expose deterministic frame driver for Headless GPU Chrome Capture
    window.__VESSEL_DIRECTOR__ = {
      ready: true,
      totalFrames: VIDEO_TOTAL_FRAMES,
      fps: VIDEO_FPS,
      seekFrame: (frame: number) =>
        new Promise<void>((resolve) => {
          renderExactFrame(frame);
          requestAnimationFrame(() => resolve());
        }),
    };

    // Optional live preview playback mode (?director=play)
    let rafId = 0;
    if (autoplay) {
      const startMs = performance.now();
      const loop = (now: number) => {
        const elapsed = (now - startMs) / 1000;
        const f = Math.floor((elapsed % (VIDEO_TOTAL_FRAMES / VIDEO_FPS)) * VIDEO_FPS);
        renderExactFrame(f);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(rafId);
      delete window.__VESSEL_DIRECTOR__;
      msaaRT.dispose();
      composer.dispose();
      pmrem.dispose();
      if (envRT) envRT.dispose();
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
    };
  }, [autoplay]);

  return (
    <div className="app-shell dir-stage">
      <div ref={containerRef} className="viewport-canvas" />
      <DirectorOverlay state={frameState} stats={stats} />
      {frameState.showFullUI && (
        <ControlPanel
          params={frameState.params}
          activePresetId={null}
          open={true}
          onChange={() => {}}
          onApplyPreset={() => {}}
          onReset={() => {}}
          onClose={() => {}}
        />
      )}
    </div>
  );
}
