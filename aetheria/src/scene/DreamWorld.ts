import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createBirds, createClouds, createPetals, createSky, sunDirection } from './atmosphere';
import { createCastle } from './castle';
import { createFerrisWheel } from './ferrisWheel';
import { gradeShader } from './materials';
import { createWhale } from './whale';
import { views, type RenderQuality, type ViewIndex } from './views';

export interface WorldOptions {
  view: ViewIndex;
  paused: boolean;
  petals: boolean;
  quality: RenderQuality;
  sunAzimuth: number;
  sunElevation: number;
  study: boolean;
}

export interface SceneAudit {
  fps: number;
  drawCalls: number;
  triangles: number;
  whaleTriangles: number;
  castleTriangles: number;
  wheelInstances: number;
  cloudPuffs: number;
  windows: number;
  textures: string;
  post: string;
}

export class DreamWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.12, 420);
  private controls: OrbitControls;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private gtao?: GTAOPass;
  private sun: THREE.DirectionalLight;
  private whale = createWhale();
  private castle = createCastle();
  private wheel = createFerrisWheel(2.55);
  private sky = createSky();
  private clouds = createClouds();
  private birds = createBirds();
  private petals = createPetals();
  private options: WorldOptions;
  private disposed = false;
  private ready = false;
  private frame = 0;
  private time = 0;
  private last = 0;
  private fps = 60;
  private studyAngle = 0;
  private studyBand = 0;
  private preset = new THREE.Vector3();
  private presetTarget = new THREE.Vector3();
  private flying = false;
  private fly = 0;
  private width = 1;
  private height = 1;
  private observer: ResizeObserver;
  private focus = new THREE.Vector3(-1.1, 2.9, 0);

  constructor(
    private container: HTMLDivElement,
    options: WorldOptions,
    private onReady: () => void,
    private onError: () => void,
  ) {
    this.options = options;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.domElement.className = 'world-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'A fully modeled whale carrying a castle through volumetric clouds. Drag to orbit, scroll to zoom, and look from any angle.');
    this.renderer.domElement.setAttribute('role', 'img');
    this.container.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.Fog(0xa9d8ee, 70, 260);
    this.scene.add(this.sky.mesh);
    this.whale.group.add(this.castle.group);
    this.wheel.group.position.set(2.5, 5.0, -1.15);
    this.whale.group.add(this.wheel.group);
    this.scene.add(this.whale.group);
    this.clouds.meshes.forEach((mesh) => this.scene.add(mesh));
    this.birds.forEach((bird) => this.scene.add(bird));
    this.scene.add(this.petals.mesh);

    this.scene.add(new THREE.HemisphereLight('#bfe4ff', '#f3dfd2', 0.75));
    this.sun = new THREE.DirectionalLight('#fff0d6', 4.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.options.quality === 'gentle' ? 1024 : 2048, this.options.quality === 'gentle' ? 1024 : 2048);
    this.sun.shadow.camera.near = 4;
    this.sun.shadow.camera.far = 60;
    this.sun.shadow.camera.left = -14;
    this.sun.shadow.camera.right = 14;
    this.sun.shadow.camera.top = 12;
    this.sun.shadow.camera.bottom = -10;
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight('#a9d4f2', 0.35);
    fill.position.set(10, 2, -8);
    this.scene.add(fill);
    const windowLight = new THREE.PointLight('#ffc48a', 2.4, 8, 2);
    windowLight.position.set(0.1, 4.2, 0.4);
    this.scene.add(windowLight);
    this.updateSun();

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(createSky().mesh);
    this.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();

    this.camera.position.set(12.5, 0.3, 21.5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.focus);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.1;
    this.controls.maxDistance = 46;
    this.controls.minPolarAngle = 0.015;
    this.controls.maxPolarAngle = Math.PI - 0.015;
    this.controls.update();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (options.quality === 'high') {
      this.gtao = new GTAOPass(this.scene, this.camera, 512, 512);
      this.gtao.blendIntensity = 0.48;
      this.composer.addPass(this.gtao);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.1, 0.5, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(gradeShader()));
    this.composer.addPass(new SMAAPass());
    this.composer.addPass(new OutputPass());
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(container);
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.resize();
    this.ready = true;
    this.onReady();
    this.frame = requestAnimationFrame(this.animate);
  }

  private pixelRatio() {
    const cap = this.options.quality === 'high' ? 1.75 : this.options.quality === 'gentle' ? 1 : 1.35;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  setOptions(options: WorldOptions) {
    const previous = this.options.view;
    const qualityChanged = options.quality !== this.options.quality;
    this.options = options;
    this.updateSun();
    this.controls.enabled = !options.study && !this.flying;
    if (previous !== options.view) this.goTo(options.view);
    if (qualityChanged) {
      this.renderer.setPixelRatio(this.pixelRatio());
      this.resize();
    }
  }

  goTo(index: ViewIndex) {
    const view = views[index];
    this.preset.set(view.position[0], view.position[1], view.position[2]);
    this.presetTarget.set(view.target[0], view.target[1], view.target[2]);
    this.flying = true;
    this.fly = 0;
    this.controls.enabled = false;
  }

  reset() { this.goTo(this.options.view); }

  zoomBy(amount: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.multiplyScalar(amount);
    const distance = THREE.MathUtils.clamp(offset.length(), 1.1, 46);
    this.camera.position.copy(this.controls.target).add(offset.setLength(distance));
  }

  capture() {
    if (!this.ready) return undefined;
    this.composer.render();
    return this.renderer.domElement.toDataURL('image/png');
  }

  audit(): SceneAudit {
    return {
      fps: Math.round(this.fps),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      whaleTriangles: this.whale.triangles,
      castleTriangles: this.castle.triangles,
      wheelInstances: 24,
      cloudPuffs: this.clouds.count,
      windows: this.castle.windows,
      textures: 'No subject textures. Procedural noise is generated in shaders; the environment map is a neutral RoomEnvironment for reflections only.',
      post: 'Render → GTAO contact occlusion → high-threshold bloom → macaron grade, vignette and dither → SMAA → ACES output. Aerial perspective uses real Fog.',
    };
  }

  private updateSun() {
    const azimuth = THREE.MathUtils.degToRad(this.options.sunAzimuth);
    const elevation = THREE.MathUtils.degToRad(this.options.sunElevation);
    const distance = 24;
    this.sun.position.set(
      Math.cos(elevation) * Math.sin(azimuth) * distance,
      Math.sin(elevation) * distance,
      Math.cos(elevation) * Math.cos(azimuth) * distance,
    );
    this.sun.target.position.copy(this.focus);
    sunDirection.copy(this.sun.position).normalize();
    const skySun = this.sky.material.uniforms.uSun.value as THREE.Vector3;
    skySun.copy(sunDirection);
  }

  private resize = () => {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(rect.width, 1);
    this.height = Math.max(rect.height, 1);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.composer.setSize(this.width, this.height);
    this.gtao?.setSize(Math.floor(this.width / 2), Math.floor(this.height / 2));
    this.bloom.setSize(this.width, this.height);
  };

  private animate = (now: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const dt = Math.min((now - (this.last || now)) / 1000, 0.05);
    this.last = now;
    this.fps = this.fps * 0.92 + (dt > 0 ? 1 / dt : 60) * 0.08;
    if (!document.hidden && !this.options.paused) this.time += dt;
    if (this.options.study) {
      this.studyAngle += dt * 0.28;
      if (this.studyAngle > Math.PI * 2) { this.studyAngle = 0; this.studyBand = (this.studyBand + 1) % 3; }
      const polar = [2.15, 1.28, 0.34][this.studyBand];
      this.camera.position.setFromSpherical(new THREE.Spherical(22, polar, this.studyAngle)).add(this.focus);
      this.controls.target.copy(this.focus);
    } else if (this.flying) {
      this.fly = Math.min(1, this.fly + dt * 0.55);
      const eased = 1 - (1 - this.fly) ** 3;
      this.camera.position.lerp(this.preset, eased * 0.18 + 0.04);
      this.controls.target.lerp(this.presetTarget, eased * 0.18 + 0.04);
      if (this.fly >= 1 && this.camera.position.distanceTo(this.preset) < 0.08) {
        this.flying = false;
        this.controls.enabled = !this.options.study;
      }
    }
    this.controls.update();
    this.whale.update(this.time, this.options.paused);
    this.wheel.update(this.time);
    this.castle.flags.forEach((flag) => {
      flag.rotation.y = Math.sin(this.time * 1.7 + flag.userData.phase) * 0.35;
      flag.rotation.z = Math.sin(this.time * 2.3 + flag.userData.phase) * 0.12;
    });
    this.clouds.meshes.forEach((mesh, i) => {
      mesh.position.x = Math.sin(this.time * (0.025 + (i % 5) * 0.004) + i) * (0.35 + (i % 3) * 0.12);
    });
    this.birds.forEach((bird) => {
      const seed = bird.userData.seed as number;
      const a = this.time * 0.18 + seed;
      bird.position.set(Math.cos(a) * (10 + seed), 5.5 + Math.sin(a * 1.7) * 0.8 + seed * 0.4, -3 + Math.sin(a * 0.8) * 9);
      bird.visible = bird.position.distanceTo(this.camera.position) > 2.5;
      bird.lookAt(bird.position.x - Math.sin(a), bird.position.y, bird.position.z + Math.cos(a));
      const flap = Math.sin(this.time * 7 + seed) * 0.7;
      (bird.userData.wing as THREE.Object3D).rotation.z = flap;
      (bird.userData.other as THREE.Object3D).rotation.z = -flap;
    });
    this.petals.mesh.visible = this.options.petals;
    const dummy = new THREE.Object3D();
    this.petals.data.forEach((petal, i) => {
      const y = ((petal.y - this.time * petal.speed) % 8 + 8) % 8 - 1.5;
      dummy.position.set(petal.x + Math.sin(this.time * 0.4 + petal.phase) * 0.4, y, petal.z);
      dummy.rotation.set(this.time + petal.phase, this.time * 0.6, petal.phase);
      dummy.scale.setScalar(0.7 + (i % 4) * 0.15);
      dummy.updateMatrix();
      this.petals.mesh.setMatrixAt(i, dummy.matrix);
    });
    this.petals.mesh.instanceMatrix.needsUpdate = true;
    this.composer.render();
  };

  private contextLost = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(this.frame);
    this.onError();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.composer.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
