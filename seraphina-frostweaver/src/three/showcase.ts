import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  buildSeraphina,
  type CharacterPoseControls,
} from './character';
import { runeRingTexture, snowTexture } from './textures';

export type CameraViewPreset = 'front' | 'side' | 'back' | 'left' | 'action' | 'closeup';

export interface ShowcaseApi {
  dispose: () => void;
  resetView: () => void;
  setCameraView: (preset: CameraViewPreset, immediate?: boolean) => void;
  setAutoRotate: (on: boolean) => void;
  burst: () => void;
  triggerSwingSlash: () => void;
  setPoseControls: (partial: Partial<CharacterPoseControls>) => void;
  getPoseControls: () => CharacterPoseControls;
}

const CAMERA_PRESETS: Record<CameraViewPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  front: { pos: [0.08, 1.55, 5.75], target: [-0.06, 1.36, 0] },
  side: { pos: [5.45, 1.55, 0.45], target: [0, 1.32, 0] },
  back: { pos: [-0.18, 1.58, -5.75], target: [0, 1.34, 0] },
  left: { pos: [-5.45, 1.55, 0.55], target: [0, 1.32, 0] },
  action: { pos: [3.65, 1.72, -4.15], target: [0, 1.36, 0] },
  closeup: { pos: [0.05, 2.04, 1.52], target: [0, 1.98, 0] },
};

export function createShowcase(container: HTMLDivElement): ShowcaseApi {
  /* ---------- renderer / scene / camera ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(
    34,
    container.clientWidth / container.clientHeight,
    0.1,
    80,
  );
  camera.position.set(...CAMERA_PRESETS.front.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...CAMERA_PRESETS.front.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.0;
  controls.maxDistance = 9.5;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.58;
  controls.enablePan = false;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.9;
  controls.update();
  controls.saveState();

  // Smooth camera transition targets
  let camTransitionActive = false;
  const desiredCamPos = new THREE.Vector3(...CAMERA_PRESETS.front.pos);
  const desiredTarget = new THREE.Vector3(...CAMERA_PRESETS.front.target);

  controls.addEventListener('start', () => {
    camTransitionActive = false;
  });

  /* ---------- lighting ---------- */
  const hemi = new THREE.HemisphereLight('#dcebff', '#1a2444', 0.95);
  scene.add(hemi);

  const key = new THREE.DirectionalLight('#fff6ec', 2.05);
  key.position.set(2.8, 5.2, 4.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 18;
  key.shadow.camera.left = -3.4;
  key.shadow.camera.right = 3.4;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -1;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  scene.add(key);

  const rim = new THREE.DirectionalLight('#66e4ff', 1.55);
  rim.position.set(-4.2, 3.8, -4.2);
  scene.add(rim);

  const backFill = new THREE.DirectionalLight('#8caeff', 0.72);
  backFill.position.set(1.8, 3.2, -4.6);
  scene.add(backFill);

  const fill = new THREE.DirectionalLight('#8ca4ff', 0.65);
  fill.position.set(-2.8, 2.2, 4.2);
  scene.add(fill);

  /* ---------- the summoning platform ---------- */
  const platform = new THREE.Group();
  scene.add(platform);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshStandardMaterial({ color: '#0d142b', roughness: 0.85, metalness: 0.08 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.06;
  floor.receiveShadow = true;
  platform.add(floor);

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(2.32, 2.45, 0.12, 48),
    new THREE.MeshStandardMaterial({
      color: '#20305a',
      roughness: 0.14,
      metalness: 0.62,
      emissive: '#0c1a3a',
      emissiveIntensity: 0.55,
    }),
  );
  disc.position.y = -0.06;
  disc.receiveShadow = true;
  platform.add(disc);

  const rimGold = new THREE.Mesh(
    new THREE.TorusGeometry(2.335, 0.038, 10, 64),
    new THREE.MeshStandardMaterial({
      color: '#caa25a',
      roughness: 0.28,
      metalness: 0.95,
      emissive: '#3a2a0c',
      emissiveIntensity: 0.8,
    }),
  );
  rimGold.rotation.x = Math.PI / 2;
  rimGold.position.y = 0.002;
  platform.add(rimGold);

  const inlay = (inner: number, outer: number, opacity: number) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 64),
      new THREE.MeshBasicMaterial({
        color: '#3fd8f6',
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.004;
    return m;
  };
  platform.add(inlay(1.68, 1.76, 0.5));
  platform.add(inlay(0.78, 0.815, 0.35));

  const runeOuter = new THREE.Mesh(
    new THREE.CircleGeometry(2.02, 48),
    new THREE.MeshBasicMaterial({
      map: runeRingTexture('outer'),
      color: '#54e6ff',
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  runeOuter.rotation.x = -Math.PI / 2;
  runeOuter.position.y = 0.008;
  platform.add(runeOuter);

  const runeInner = new THREE.Mesh(
    new THREE.CircleGeometry(1.18, 48),
    new THREE.MeshBasicMaterial({
      map: runeRingTexture('inner'),
      color: '#8ef0ff',
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  runeInner.rotation.x = -Math.PI / 2;
  runeInner.position.y = 0.013;
  platform.add(runeInner);

  const shock = new THREE.Mesh(
    new THREE.RingGeometry(0.94, 1.06, 64),
    new THREE.MeshBasicMaterial({
      color: '#9df3ff',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  shock.rotation.x = -Math.PI / 2;
  shock.position.y = 0.02;
  platform.add(shock);

  /* ---------- the Frostweaver herself ---------- */
  const seraphina = buildSeraphina();
  scene.add(seraphina.group);

  /* ---------- drifting snow ---------- */
  const SNOW = 420;
  const snowPos = new Float32Array(SNOW * 3);
  const snowSpeed = new Float32Array(SNOW);
  const snowPhase = new Float32Array(SNOW);
  for (let i = 0; i < SNOW; i++) {
    snowPos[i * 3] = (Math.random() - 0.5) * 13;
    snowPos[i * 3 + 1] = Math.random() * 7.5;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 13;
    snowSpeed[i] = 0.16 + Math.random() * 0.3;
    snowPhase[i] = Math.random() * Math.PI * 2;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(
    snowGeo,
    new THREE.PointsMaterial({
      map: snowTexture(),
      color: '#e8f6ff',
      size: 0.07,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  scene.add(snow);

  /* ---------- interaction ---------- */
  const pointer = new THREE.Vector2(0, 0);
  const onPointerMove = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    seraphina.setPointer(pointer.x, pointer.y);
  };
  container.addEventListener('pointermove', onPointerMove);

  let shockEnergy = 0;
  const burst = () => {
    seraphina.burst();
    shockEnergy = 1;
  };

  const triggerSwingSlash = () => {
    seraphina.triggerSwingSlash();
    shockEnergy = 0.85;
  };

  const setCameraView = (preset: CameraViewPreset, immediate = false) => {
    const cfg = CAMERA_PRESETS[preset];
    desiredCamPos.set(...cfg.pos);
    desiredTarget.set(...cfg.target);
    if (immediate) {
      camera.position.copy(desiredCamPos);
      controls.target.copy(desiredTarget);
      controls.update();
      camTransitionActive = false;
    } else {
      camTransitionActive = true;
    }
  };

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    seraphina.tick(t, dt);

    if (camTransitionActive) {
      const k = Math.min(1, dt * 6.5);
      camera.position.lerp(desiredCamPos, k);
      controls.target.lerp(desiredTarget, k);
      if (camera.position.distanceToSquared(desiredCamPos) < 0.0008) {
        camTransitionActive = false;
      }
    }

    // rune seals counter-rotate with a slow breathing glow
    runeOuter.rotation.z = t * 0.22;
    runeInner.rotation.z = -t * 0.34;
    shockEnergy *= Math.exp(-dt * 1.6);
    runeOuter.material.opacity = 0.5 + Math.sin(t * 1.4) * 0.12 + shockEnergy * 0.45;
    runeInner.material.opacity = 0.55 + Math.sin(t * 1.8 + 1) * 0.14 + shockEnergy * 0.5;
    shock.scale.setScalar(1 + (1 - shockEnergy) * (1 - shockEnergy) * 3.4);
    shock.material.opacity = shockEnergy * 0.85;

    // snow drift
    const pos = snowGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < SNOW; i++) {
      let y = pos.getY(i) - snowSpeed[i] * dt;
      const x = pos.getX(i) + Math.sin(t * 0.7 + snowPhase[i]) * dt * 0.14;
      if (y < 0) y = 7.5;
      pos.setY(i, y);
      pos.setX(i, x > 6.5 ? -6.5 : x);
    }
    pos.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);
  };
  tick();

  /* ---------- resize ---------- */
  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(container);

  /* ---------- api ---------- */
  const dispose = () => {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    container.removeEventListener('pointermove', onPointerMove);
    controls.dispose();
    environment.dispose();
    pmrem.dispose();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh || (obj as THREE.Points).type === 'Points') {
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      }
    });
    renderer.dispose();
    renderer.domElement.remove();
  };

  return {
    dispose,
    resetView: () => setCameraView('front'),
    setCameraView,
    setAutoRotate: (on: boolean) => {
      controls.autoRotate = on;
    },
    burst,
    triggerSwingSlash,
    setPoseControls: seraphina.setPoseControls,
    getPoseControls: seraphina.getPoseControls,
  };
}
