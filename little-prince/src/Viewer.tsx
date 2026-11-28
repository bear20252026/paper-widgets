import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createCharacter, type CharacterAsset, type CharacterQuality, type RenderTier } from './character';
import { createWorld, type WorldAsset } from './world';

export type CameraView = 'front' | 'side' | 'back';

export interface ViewerHandle {
  setView: (view: CameraView) => void;
  zoom: (direction: 1 | -1) => void;
  reset: () => void;
  exportModel: () => Promise<void>;
  capture: () => void;
  captureTurnaround: () => Promise<void>;
}

export interface RenderMetrics {
  fps: number;
  drawCalls: number;
  sceneTriangles: number;
  devicePixelRatio: number;
  targetFps: number;
  resolutionScale: number;
}

interface ViewerProps {
  quality: CharacterQuality;
  tier: RenderTier;
  wireframe: boolean;
  turntable: boolean;
  animated: boolean;
  bloom: boolean;
  showWorld: boolean;
  showFox: boolean;
  onStats: (stats: { triangles: number; meshes: number; bones: number; materials: number }) => void;
  onPerformance: (metrics: RenderMetrics) => void;
  onOrbit: () => void;
  onError: (message: string) => void;
}

function saveUrl(url: string, name: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  saveUrl(url, name);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function disposeCharacter(asset: CharacterAsset) {
  const textures = new Set<THREE.Texture>();
  asset.group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
  asset.materials.forEach((material) => {
    if (material.map) textures.add(material.map);
    if (material.normalMap) textures.add(material.normalMap);
    if (material.roughnessMap) textures.add(material.roughnessMap);
    if (material.aoMap) textures.add(material.aoMap);
    material.dispose();
  });
  textures.forEach((texture) => texture.dispose());
}

function activeDeviceIsMobile() {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return window.matchMedia('(max-width: 760px), (pointer: coarse)').matches
    || (memory !== undefined && memory <= 2 && window.innerWidth <= 1024)
    || (navigator.hardwareConcurrency <= 4 && window.innerWidth <= 1024);
}

const Viewer = forwardRef<ViewerHandle, ViewerProps>(function Viewer({
  quality,
  tier,
  wireframe,
  turntable,
  animated,
  bloom,
  showWorld,
  showFox,
  onStats,
  onPerformance,
  onOrbit,
  onError,
}, ref) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);
  const aaRef = useRef<SMAAPass | FXAAPass | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const assetRef = useRef<CharacterAsset | null>(null);
  const worldRef = useRef<WorldAsset | null>(null);
  const skyRef = useRef<THREE.Mesh | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const animatedRef = useRef(animated);
  const wireframeRef = useRef(wireframe);
  const worldEnabledRef = useRef(showWorld);
  const foxEnabledRef = useRef(showFox);
  const callbacks = useRef({ onStats, onPerformance, onOrbit, onError });
  callbacks.current = { onStats, onPerformance, onOrbit, onError };
  animatedRef.current = animated;
  wireframeRef.current = wireframe;
  worldEnabledRef.current = showWorld;
  foxEnabledRef.current = showFox;

  useImperativeHandle(ref, () => ({
    setView(view) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      controls.autoRotate = false;
      controls.enableDamping = false;
      controls.update();
      const distance = 8;
      if (view === 'front') camera.position.set(0, 2.05, distance);
      if (view === 'side') camera.position.set(distance, 2.05, 0);
      if (view === 'back') camera.position.set(0, 2.05, -distance);
      controls.target.set(0, 2.05, 0);
      controls.update();
      controls.enableDamping = true;
    },
    zoom(direction) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * (direction === 1 ? 1.2 : 1 / 1.2), 0.7, 2.4);
      camera.updateProjectionMatrix();
      controls.update();
    },
    reset() {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      controls.autoRotate = false;
      controls.enableDamping = false;
      controls.update();
      camera.position.set(0, 2.05, 8);
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      controls.target.set(0, 2.05, 0);
      controls.update();
      controls.enableDamping = true;
    },
    async exportModel() {
      const asset = assetRef.current;
      if (!asset) {
        saveUrl(`/models/little-prince-${quality.toLowerCase()}.glb`, `little-prince-${quality.toLowerCase()}.glb`);
        return;
      }
      const mixer = mixerRef.current;
      mixer?.stopAllAction();
      asset.skeleton.pose();
      asset.materials.forEach((material) => { material.wireframe = false; });
      asset.group.updateMatrixWorld(true);
      try {
        const exporter = new GLTFExporter();
        const result = await exporter.parseAsync(asset.group, {
          binary: true,
          animations: [asset.clip],
          maxTextureSize: 512,
        });
        const blob = result instanceof ArrayBuffer
          ? new Blob([result], { type: 'model/gltf-binary' })
          : new Blob([JSON.stringify(result)], { type: 'model/gltf+json' });
        saveBlob(blob, `little-prince-${quality.toLowerCase()}.glb`);
      } finally {
        asset.materials.forEach((material) => { material.wireframe = wireframeRef.current; });
        if (animatedRef.current && mixer) mixer.clipAction(asset.clip).reset().play();
      }
    },
    capture() {
      const renderer = rendererRef.current;
      if (!renderer) return;
      renderer.domElement.toBlob((blob) => {
        if (blob) saveBlob(blob, 'little-prince-view.png');
      }, 'image/png');
    },
    async captureTurnaround() {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const asset = assetRef.current;
      if (!renderer || !scene || !asset) {
        saveUrl('/models/little-prince-turnaround.png', 'little-prince-turnaround.png');
        return;
      }
      const mixer = mixerRef.current;
      const world = worldRef.current;
      const wasWorldVisible = world?.group.visible ?? false;
      const wasSkyVisible = skyRef.current?.visible ?? false;
      const oldBackground = scene.background;
      const oldSize = renderer.getSize(new THREE.Vector2());
      const oldPixelRatio = renderer.getPixelRatio();
      const width = 600;
      const height = 760;
      const sheet = document.createElement('canvas');
      sheet.width = width * 3;
      sheet.height = height;
      const context = sheet.getContext('2d');
      if (!context) throw new Error('Could not create the turnaround image.');
      const camera = new THREE.OrthographicCamera(-5.7 * width / height / 2, 5.7 * width / height / 2, 2.85, -2.85, 0.1, 60);
      context.fillStyle = '#efefe7';
      context.fillRect(0, 0, sheet.width, sheet.height);
      mixer?.stopAllAction();
      asset.skeleton.pose();
      asset.materials.forEach((material) => { material.wireframe = false; });
      if (world) world.group.visible = false;
      if (skyRef.current) skyRef.current.visible = false;
      scene.background = new THREE.Color('#efefe7');
      asset.group.updateMatrixWorld(true);
      try {
        renderer.setPixelRatio(1);
        renderer.setSize(width, height, false);
        const positions = [new THREE.Vector3(0, 2.05, 8), new THREE.Vector3(8, 2.05, 0), new THREE.Vector3(0, 2.05, -8)];
        for (let i = 0; i < positions.length; i++) {
          camera.position.copy(positions[i]);
          camera.lookAt(0, 2.05, 0);
          camera.updateMatrixWorld();
          renderer.render(scene, camera);
          context.drawImage(renderer.domElement, i * width, 0, width, height);
          context.fillStyle = '#7f8b7b';
          context.font = '600 14px sans-serif';
          context.textAlign = 'center';
          context.fillText(['FRONT', 'SIDE', 'BACK'][i], i * width + width / 2, 730);
        }
      } finally {
        scene.background = oldBackground;
        if (world) world.group.visible = wasWorldVisible;
        if (skyRef.current) skyRef.current.visible = wasSkyVisible;
        renderer.setPixelRatio(oldPixelRatio);
        renderer.setSize(oldSize.x, oldSize.y, false);
        asset.materials.forEach((material) => { material.wireframe = wireframeRef.current; });
        if (animatedRef.current && mixer) mixer.clipAction(asset.clip).reset().play();
      }
      await new Promise<void>((resolve, reject) => {
        sheet.toBlob((blob) => {
          if (!blob) { reject(new Error('Could not create the turnaround image.')); return; }
          saveBlob(blob, 'little-prince-turnaround.png');
          resolve();
        }, 'image/png');
      });
    },
  }), [quality]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const mobile = tier === 'performance';
    const maxDpr = mobile ? 1.35 : 2;
    const renderScale = mobile ? 0.72 : 1;
    const targetFps = mobile ? 30 : 60;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
    } catch {
      callbacks.current.onError('WebGL2 is not available in this browser. The concept reference and downloadable GLBs are still available.');
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr, 2);
    renderer.setPixelRatio(dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = mobile ? 1.05 : 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.transmissionResolutionScale = mobile ? 0.42 : 0.78;
    renderer.info.autoReset = false;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080e1b');
    scene.environmentIntensity = mobile ? 0.58 : 0.76;
    sceneRef.current = scene;

    const skyMaterial = new THREE.ShaderMaterial({
      name: 'B612 - view-correct HDR panorama',
      uniforms: {
        tEquirect: { value: null },
        uForward: { value: new THREE.Vector3(0, 0, 1) },
        uRight: { value: new THREE.Vector3(1, 0, 0) },
        uUp: { value: new THREE.Vector3(0, 1, 0) },
        uAspect: { value: 1 },
        uFov: { value: 0.74 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 1.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tEquirect;
        uniform vec3 uForward;
        uniform vec3 uRight;
        uniform vec3 uUp;
        uniform float uAspect;
        uniform float uFov;
        varying vec2 vUv;
        void main() {
          vec2 screen = vUv * 2.0 - 1.0;
          vec3 direction = normalize(uForward + uRight * screen.x * uAspect * uFov + uUp * screen.y * uFov);
          vec2 panoramaUV = vec2(atan(direction.z, direction.x) * 0.15915494309 + 0.5, asin(clamp(direction.y, -1.0, 1.0)) * 0.31830988618 + 0.5);
          gl_FragColor = vec4(texture2D(tEquirect, panoramaUV).rgb, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const skyDome = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMaterial);
    skyDome.name = 'B612 - HDR galaxy rendered as a camera-aligned sky';
    skyDome.frustumCulled = false;
    skyDome.renderOrder = -1000;
    scene.add(skyDome);
    skyRef.current = skyDome;

    const camera = new THREE.OrthographicCamera(-2.65, 2.65, 2.65, -2.65, 0.1, 80);
    camera.position.set(0, 2.05, 8);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2.05, 0);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minDistance = 3.6;
    controls.maxDistance = 13;
    controls.minPolarAngle = Math.PI * 0.22;
    controls.maxPolarAngle = Math.PI * 0.78;
    controls.minZoom = 0.7;
    controls.maxZoom = 2.35;
    controls.autoRotateSpeed = 0.9;
    controls.update();
    controlsRef.current = controls;

    const ambient = new THREE.HemisphereLight('#c4d1f1', '#513e3a', mobile ? 1.25 : 1.55);
    ambient.name = 'Starlit ambient - hemispheric';
    scene.add(ambient);

    const key = new THREE.DirectionalLight('#ffcf8e', mobile ? 2.9 : 3.35);
    key.name = 'Warm key - the last sunset on B612';
    key.position.set(-3.7, 6.8, 5.8);
    key.target.position.set(0, 1.35, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
    key.shadow.camera.left = -3.5;
    key.shadow.camera.right = 3.5;
    key.shadow.camera.top = 5.4;
    key.shadow.camera.bottom = -2.1;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 18;
    key.shadow.bias = -0.00028;
    key.shadow.normalBias = mobile ? 0.055 : 0.035;
    key.shadow.radius = mobile ? 2.1 : 2.6;
    key.shadow.autoUpdate = false;
    key.shadow.needsUpdate = true;
    scene.add(key, key.target);
    keyLightRef.current = key;

    const rim = new THREE.DirectionalLight('#94b9fa', mobile ? 1.0 : 1.25);
    rim.name = 'Cool fill - the faraway stars';
    rim.position.set(4, 4.2, -4.7);
    rim.target.position.set(0, 2.3, 0);
    scene.add(rim, rim.target);
    renderer.shadowMap.needsUpdate = true;

    const composerTarget = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const composer = new EffectComposer(renderer, composerTarget);
    composer.setPixelRatio(dpr * renderScale);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), mobile ? 0.22 : 0.31, 0.28, 0.93);
    bloomPass.enabled = bloom;
    composer.addPass(bloomPass);
    bloomRef.current = bloomPass;

    const aaPass = mobile ? new FXAAPass() : new SMAAPass();
    const output = new OutputPass();
    if (mobile) {
      // FXAA samples display-encoded color and follows OutputPass in r186.
      composer.addPass(output);
      composer.addPass(aaPass);
    } else {
      // SMAA operates in linear sRGB and precedes OutputPass in r186.
      composer.addPass(aaPass);
      composer.addPass(output);
    }
    aaRef.current = aaPass;
    composerRef.current = composer;

    let hdrTexture: THREE.DataTexture | null = null;
    let environmentTarget: THREE.WebGLRenderTarget | null = null;
    let disposed = false;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    new HDRLoader().load('/environments/b612-starlight.hdr', (hdr) => {
      if (disposed) {
        hdr.dispose();
        return;
      }
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      hdrTexture = hdr;
      environmentTarget = pmrem.fromEquirectangular(hdr);
      skyMaterial.uniforms.tEquirect.value = hdr;
      scene.environment = environmentTarget.texture;
      scene.environmentIntensity = mobile ? 0.58 : 0.76;
      renderer.shadowMap.needsUpdate = true;
    }, undefined, () => {
      if (!disposed) {
        scene.background = new THREE.Color('#10192a');
        callbacks.current.onError('The local HDR sky could not be loaded. Using the quiet night-sky fallback.');
      }
    });

    const world = createWorld(tier);
    world.group.visible = true;
    world.stage.visible = worldEnabledRef.current;
    world.fox.visible = foxEnabledRef.current;
    scene.add(world.group);
    worldRef.current = world;

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      const viewHeight = 5.75;
      camera.left = -viewHeight * aspect / 2;
      camera.right = viewHeight * aspect / 2;
      camera.top = viewHeight / 2;
      camera.bottom = -viewHeight / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      // UnrealBloomPass renders its extraction and mip chain at half scene resolution.
      bloomPass.setSize(Math.max(1, width * dpr * renderScale * 0.5), Math.max(1, height * dpr * renderScale * 0.5));
      aaPass.setSize(Math.max(1, Math.round(width * dpr * renderScale)), Math.max(1, Math.round(height * dpr * renderScale)));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    const orbitStart = () => callbacks.current.onOrbit();
    renderer.domElement.addEventListener('pointerdown', orbitStart);

    let currentTime = 0;
    let previousTime = performance.now();
    let lastRenderTime = 0;
    let lastStatsTime = previousTime;
    let frames = 0;
    let frame = 0;
    let warmup = 0;
    const keyDirectionView = new THREE.Vector3();
    const minimumFrameTime = 1000 / targetFps;
    const render = (time = performance.now()) => {
      frame = requestAnimationFrame(render);
      if (document.hidden) {
        previousTime = time;
        return;
      }
      if (time - lastRenderTime < minimumFrameTime - 0.5) return;
      const delta = Math.min((time - previousTime) / 1000, 0.1);
      previousTime = time;
      lastRenderTime = time;
      currentTime += delta;

      const character = assetRef.current;
      camera.updateMatrixWorld();
      camera.getWorldDirection(skyMaterial.uniforms.uForward.value);
      skyMaterial.uniforms.uRight.value.setFromMatrixColumn(camera.matrixWorld, 0);
      skyMaterial.uniforms.uUp.value.setFromMatrixColumn(camera.matrixWorld, 1);
      skyMaterial.uniforms.uAspect.value = mount.clientWidth / Math.max(1, mount.clientHeight);
      if (character) {
        character.frameUniforms.scarfTime.value = animatedRef.current ? currentTime : 0;
        if (keyLightRef.current) {
          keyLightRef.current.getWorldDirection(keyDirectionView).negate().transformDirection(camera.matrixWorldInverse);
          character.frameUniforms.sssLightDirection.value.copy(keyDirectionView);
        }
      }
      if (animatedRef.current) mixerRef.current?.update(delta);
      world.update(time);
      controls.update();
      if (animatedRef.current && frame % (mobile ? 10 : 7) === 0) renderer.shadowMap.needsUpdate = true;
      renderer.info.reset();
      composer.render(delta);
      frames++;

      if (warmup++ === 1 || time - lastStatsTime >= 750) {
        const elapsed = Math.max(0.001, (time - lastStatsTime) / 1000);
        callbacks.current.onPerformance({
          fps: frames === 0 ? 0 : Math.max(1, Math.min(targetFps, Math.round(frames / elapsed))),
          drawCalls: renderer.info.render.calls,
          sceneTriangles: renderer.info.render.triangles,
          devicePixelRatio: dpr,
          targetFps,
          resolutionScale: renderScale,
        });
        lastStatsTime = time;
        frames = 0;
      }
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      disposed = true;
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', orbitStart);
      controls.dispose();
      composer.dispose();
      bloomPass.dispose();
      aaPass.dispose();
      output.dispose();
      renderPass.dispose();
      world.dispose();
      if (skyRef.current) {
        scene.remove(skyRef.current);
        skyRef.current.geometry.dispose();
        const materials = Array.isArray(skyRef.current.material) ? skyRef.current.material : [skyRef.current.material];
        materials.forEach((material) => material.dispose());
        skyRef.current = null;
      }
      if (environmentTarget) environmentTarget.dispose();
      if (hdrTexture) hdrTexture.dispose();
      pmrem.dispose();
      key.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      rendererRef.current = null;
      composerRef.current = null;
      bloomRef.current = null;
      aaRef.current = null;
      controlsRef.current = null;
      cameraRef.current = null;
      keyLightRef.current = null;
      worldRef.current = null;
    };
  }, [tier]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const asset = createCharacter(quality, tier);
    assetRef.current = asset;
    scene.add(asset.group);
    const mixer = new THREE.AnimationMixer(asset.group);
    mixerRef.current = mixer;
    asset.materials.forEach((material) => { material.wireframe = wireframeRef.current; });
    if (animatedRef.current) mixer.clipAction(asset.clip).play();
    callbacks.current.onStats({ triangles: asset.triangles, meshes: asset.meshes, bones: asset.bones, materials: asset.materials.length });
    return () => {
      mixer.stopAllAction();
      scene.remove(asset.group);
      disposeCharacter(asset);
      if (assetRef.current === asset) assetRef.current = null;
      if (mixerRef.current === mixer) mixerRef.current = null;
    };
  }, [quality, tier]);

  useEffect(() => {
    assetRef.current?.materials.forEach((material) => { material.wireframe = wireframe; });
  }, [wireframe]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = turntable;
  }, [turntable]);

  useEffect(() => {
    if (bloomRef.current) bloomRef.current.enabled = bloom;
  }, [bloom]);

  useEffect(() => {
    if (worldRef.current) {
      worldRef.current.stage.visible = showWorld;
      worldRef.current.fox.visible = showFox;
    }
  }, [showWorld, showFox]);

  useEffect(() => {
    const asset = assetRef.current;
    const mixer = mixerRef.current;
    if (!asset || !mixer) return;
    if (animated) mixer.clipAction(asset.clip).reset().play();
    else {
      mixer.stopAllAction();
      asset.skeleton.pose();
      asset.frameUniforms.scarfTime.value = 0;
    }
  }, [animated]);

  return <div className="webgl-mount" ref={mountRef} aria-label="Interactive Three.js 3D model with a starlit B-612 scene. Drag to rotate and scroll to zoom." />;
});

export { activeDeviceIsMobile };
export default Viewer;