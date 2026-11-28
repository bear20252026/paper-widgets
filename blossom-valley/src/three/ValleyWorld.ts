import * as THREE from "three";
import { createMountains, createRiver, createSky, createTerrain, createWindRibbons } from "./environment";
import { createForest, TREE_COUNT } from "./forest";
import { riverCenter, terrainHeight } from "./math";
import { PETAL_COUNT, PetalStorm } from "./petals";
import { PALETTE, sharedUniforms } from "./shared";

export type CameraMode = "vista" | "topdown" | "glide";

export interface WorldStats {
  fps: number;
  liveStorm: number;
  manualActive: boolean;
}

export interface WorldOptions {
  onReady?: () => void;
  onStats?: (stats: WorldStats) => void;
}

const clamp = THREE.MathUtils.clamp;

/**
 * Main Three.js scene controller for Sakura Storm Valley.
 * Manages WebGL2 rendering, GPGPU petal stepping, wind/storm rhythms, and camera choreography.
 */
export class ValleyWorld {
  readonly treeCount = TREE_COUNT;
  readonly petalCount = PETAL_COUNT;

  /** Camera automatically glides along the selected mode when true (resumes 6 s after interaction). */
  autoCruise = true;
  /** Active scenic camera choreography. */
  cameraMode: CameraMode = "vista";
  /** Storm cycles organically between serene blossom drift and sweeping hanafubuki when true. */
  stormAuto = true;
  stormManual = 0.65;
  /** Multiplier for wind field and turbulence velocity. */
  windScale = 1.0;
  /** Strength of subtle cyberpunk / procedural contours, solar ring, and flow streamlines [0..1]. */
  proceduralLevel = 0.65;

  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly sky: THREE.Mesh;
  private readonly petals: PetalStorm;
  private readonly onReady?: () => void;
  private readonly onStats?: (stats: WorldStats) => void;

  private raf = 0;
  private running = false;
  private announcedReady = false;
  private lastTime = 0;
  private elapsed = 0;
  private fpsFrames = 0;
  private fpsTimer = 0;
  private gustTarget = 0;

  // Camera state (supports seamless transition between auto-cruise and mouse orbit/pan/zoom)
  private idleTime = 99;
  private dragButton: -1 | 0 | 2 = -1;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private normPointerX = 0;
  private normPointerY = 0;

  private manualYaw = Math.PI * 0.52;
  private manualPitch = 0.2;
  private manualDist = 560;
  private manualSynced = false;
  private readonly manualFocus = new THREE.Vector3(24, 48, -55);

  private modeBoost = 0;
  private readonly currentPos = new THREE.Vector3(54, 162, 522);
  private readonly currentFocus = new THREE.Vector3(18, 78, -65);
  private readonly desiredPos = new THREE.Vector3();
  private readonly desiredFocus = new THREE.Vector3();
  private readonly tmpOffset = new THREE.Vector3();
  private readonly tmpRight = new THREE.Vector3();
  private readonly tmpForward = new THREE.Vector3();

  private readonly onResize = () => this.resize();
  private readonly onContextMenu = (e: MouseEvent) => e.preventDefault();

  private readonly onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 2) return;
    this.syncManualFromCurrent();
    this.dragButton = e.button === 2 || e.shiftKey ? 2 : 0;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.idleTime = 0;
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    const w = Math.max(window.innerWidth, 1);
    const h = Math.max(window.innerHeight, 1);
    this.normPointerX = (e.clientX / w) * 2 - 1;
    this.normPointerY = (e.clientY / h) * 2 - 1;

    if (this.dragButton === -1) return;

    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.idleTime = 0;

    if (this.dragButton === 0 && !e.shiftKey) {
      // Orbit smoothly around the valley focus
      this.manualYaw += dx * 0.0045;
      this.manualPitch = clamp(this.manualPitch + dy * 0.0038, 0.08, 1.32);
    } else {
      // Pan across the valley horizontally
      const panScale = this.manualDist * 0.0014;
      this.tmpForward.set(-Math.cos(this.manualYaw), 0, -Math.sin(this.manualYaw)).normalize();
      this.tmpRight.set(-this.tmpForward.z, 0, this.tmpForward.x);
      this.manualFocus.addScaledVector(this.tmpRight, -dx * panScale);
      this.manualFocus.addScaledVector(this.tmpForward, dy * panScale);
      this.manualFocus.x = clamp(this.manualFocus.x, -460, 460);
      this.manualFocus.z = clamp(this.manualFocus.z, -520, 420);
      this.manualFocus.y = Math.max(terrainHeight(this.manualFocus.x, this.manualFocus.z) + 22, 26);
    }
  };

  private readonly onPointerUp = () => {
    this.dragButton = -1;
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.syncManualFromCurrent();
    this.manualDist = clamp(this.manualDist * Math.exp(e.deltaY * 0.00085), 115, 880);
    this.idleTime = 0;
  };

  private readonly tick = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);

    const dt = Math.min(Math.max((now - this.lastTime) / 1000, 0.001), 0.08);
    this.lastTime = now;
    this.elapsed += dt;

    this.update(dt);
    this.renderer.render(this.scene, this.camera);

    if (!this.announcedReady) {
      this.announcedReady = true;
      this.onReady?.();
    }

    this.fpsFrames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.35) {
      const fps = this.fpsFrames / this.fpsTimer;
      this.fpsFrames = 0;
      this.fpsTimer = 0;
      const liveStorm = clamp(
        sharedUniforms.uStorm.value + sharedUniforms.uGustBurst.value * 0.65,
        0,
        1
      );
      this.onStats?.({
        fps,
        liveStorm,
        manualActive: !this.autoCruise || this.idleTime < 6,
      });
    }
  };

  constructor(container: HTMLElement, options: WorldOptions = {}) {
    this.container = container;
    this.onReady = options.onReady;
    this.onStats = options.onStats;

    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      stencil: false,
    });
    if (!this.renderer.capabilities.isWebGL2) {
      this.renderer.dispose();
      throw new Error("WebGL 2 is required for the 491,520-petal GPU particle simulation.");
    }

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(PALETTE.skyZenith);

    this.camera = new THREE.PerspectiveCamera(55, w / h, 2.5, 4500);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentFocus);

    // Initialize shared storm state so the opening frame showcases a lush sweeping sakura storm
    sharedUniforms.uStorm.value = 0.62;
    sharedUniforms.uGustBurst.value = 0;
    sharedUniforms.uWindScale.value = this.windScale;
    sharedUniforms.uProcedural.value = this.proceduralLevel;
    sharedUniforms.uCenter.value.set(18, 55);

    // Assemble procedural world layers
    this.sky = createSky();
    this.scene.add(this.sky);
    this.scene.add(createTerrain());
    this.scene.add(createMountains());
    this.scene.add(createRiver());
    this.scene.add(createForest());
    this.scene.add(createWindRibbons());

    this.petals = new PetalStorm(this.renderer, this.currentPos);
    this.petals.setViewport(h, dpr, this.camera.fov);
    this.scene.add(this.petals.object);

    // Attach listeners
    window.addEventListener("resize", this.onResize);
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  /** Switches scenic camera mode and glides briskly into the new vantage point. */
  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.idleTime = 99;
    this.manualSynced = false;
    this.modeBoost = 1.6;
  }

  /** Unleashes a dramatic rising cherry blossom cyclone gust across the valley. */
  triggerGust(): void {
    this.gustTarget = 1.0;
  }

  /** Captures current live camera pose into manual orbit state so mouse drag never jumps. */
  private syncManualFromCurrent(): void {
    if (this.manualSynced && (this.idleTime < 6 || !this.autoCruise)) return;
    this.manualFocus.copy(this.currentFocus);
    this.tmpOffset.subVectors(this.currentPos, this.currentFocus);
    this.manualDist = clamp(this.tmpOffset.length(), 115, 880);
    this.manualPitch = clamp(Math.asin(clamp(this.tmpOffset.y / this.manualDist, 0.05, 0.97)), 0.08, 1.32);
    this.manualYaw = Math.atan2(this.tmpOffset.z, this.tmpOffset.x);
    this.manualSynced = true;
  }

  private computeAutoCamera(t: number): void {
    // Subtle dreamy mouse parallax even during auto-cruise
    const px = this.normPointerX * 22;
    const py = this.normPointerY * 12;

    if (this.cameraMode === "topdown") {
      // High distant top-down orbital overlook directly above the winding S-curve river & cyclones
      const orbit = Math.PI * 0.5 + Math.sin(t * 0.055) * 0.72;
      const fx = riverCenter(20) * 0.65 + Math.sin(t * 0.035) * 55 + px;
      const fz = 15 + Math.cos(t * 0.03) * 65;
      const fy = Math.max(terrainHeight(fx, fz), 0) + 10;
      const dist = 445 + Math.sin(t * 0.06) * 35;
      const pitch = 0.88 + 0.1 * Math.sin(t * 0.05) + py * 0.004;

      this.desiredFocus.set(fx, fy, fz);
      this.desiredPos.set(
        fx + Math.cos(orbit) * Math.cos(pitch) * dist,
        fy + Math.sin(pitch) * dist,
        fz + Math.sin(orbit) * Math.cos(pitch) * dist
      );
    } else if (this.cameraMode === "glide") {
      // Romantic aerial flight drifting down the winding sunset river canyon through the storm
      const cycle = (t * 16) % 680;
      const camZ = 420 - cycle;
      const lookZ = camZ - 260;
      const rcCam = riverCenter(camZ);
      const rcLook = riverCenter(lookZ);
      const swayX = Math.sin(t * 0.14) * 38 + px * 0.9;
      const camX = rcCam + swayX;
      const groundY = Math.max(terrainHeight(camX, camZ), 0);
      const camY = groundY + 68 + Math.sin(t * 0.19) * 10 - py * 0.5;

      this.desiredPos.set(camX, camY, camZ);
      this.desiredFocus.set(rcLook * 0.8 - 10, 62 + Math.sin(t * 0.11) * 5, lookZ);
    } else {
      // "vista" (Default): Elevated distant valley overlook capturing the sweeping top-down
      // sakura valley, mirror river, 491k petal storm ribbons, blue-purple low-poly mountains,
      // AND full vivid orange-to-purple sunset sky in one harmonious anime composition.
      const driftX = 52 + Math.sin(t * 0.052) * 115 + px;
      const driftZ = 522 + Math.cos(t * 0.039) * 40;
      const baseAlt = 162 + Math.sin(t * 0.064) * 16 - py * 0.7;
      const safeAlt = Math.max(baseAlt, terrainHeight(driftX, driftZ) + 70);

      const fx = 16 + Math.sin(t * 0.044 + 0.6) * 40 + px * 0.35;
      const fz = -65 + Math.cos(t * 0.035) * 26;
      const fy = 78 + Math.sin(t * 0.058) * 5;

      this.desiredPos.set(driftX, safeAlt, driftZ);
      this.desiredFocus.set(fx, fy, fz);
    }
  }

  private update(dt: number): void {
    const t = this.elapsed;
    sharedUniforms.uTime.value = t;

    // 1. Update camera pose (smooth damping between cruise & mouse control)
    if (this.dragButton === -1) {
      this.idleTime += dt;
    }

    const useAuto = this.autoCruise && this.idleTime >= 6;
    if (useAuto) {
      this.manualSynced = false;
      this.computeAutoCamera(t);
    } else {
      this.syncManualFromCurrent();
      const cosP = Math.cos(this.manualPitch);
      this.desiredFocus.copy(this.manualFocus);
      this.desiredPos.set(
        this.manualFocus.x + Math.cos(this.manualYaw) * cosP * this.manualDist,
        this.manualFocus.y + Math.sin(this.manualPitch) * this.manualDist,
        this.manualFocus.z + Math.sin(this.manualYaw) * cosP * this.manualDist
      );
    }

    // Keep camera gracefully above terrain and sakura canopies at all times
    const minCamY = Math.max(terrainHeight(this.desiredPos.x, this.desiredPos.z), 0) + 22;
    if (this.desiredPos.y < minCamY) this.desiredPos.y = minCamY;

    this.modeBoost = Math.max(0, this.modeBoost - dt);
    const autoSpeed = this.modeBoost > 0 ? 5.2 : 2.2;
    const damp = 1 - Math.exp(-dt * (useAuto ? autoSpeed : 7.5));
    this.currentPos.lerp(this.desiredPos, damp);
    this.currentFocus.lerp(this.desiredFocus, damp);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentFocus);

    // Keep sky dome locked on camera
    this.sky.position.copy(this.currentPos);

    // 2. Drive organic cherry blossom storm intensity & user-triggered cyclone bursts
    const autoStorm =
      0.42 + 0.54 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.13 + 0.55), 1.55);
    const targetStorm = this.stormAuto ? autoStorm : this.stormManual;
    sharedUniforms.uStorm.value +=
      (targetStorm - sharedUniforms.uStorm.value) * (1 - Math.exp(-dt * 1.4));

    // Smooth rise + lingering romantic decay for triggered gust bursts
    this.gustTarget = Math.max(0, this.gustTarget - dt * 0.22);
    const burstRate = this.gustTarget > sharedUniforms.uGustBurst.value ? 5.5 : 1.1;
    sharedUniforms.uGustBurst.value +=
      (this.gustTarget - sharedUniforms.uGustBurst.value) * (1 - Math.exp(-dt * burstRate));

    sharedUniforms.uWindScale.value +=
      (this.windScale - sharedUniforms.uWindScale.value) * (1 - Math.exp(-dt * 3.5));
    sharedUniforms.uProcedural.value +=
      (this.proceduralLevel - sharedUniforms.uProcedural.value) * (1 - Math.exp(-dt * 3.5));

    // Prevailing cross-valley wind gently shifts angle so petal streams breathe dynamically
    const windAngle = 0.22 + 0.34 * Math.sin(t * 0.045);
    const windSpeed = 7.4 + 2.6 * (0.5 + 0.5 * Math.sin(t * 0.21));
    sharedUniforms.uWind.value.set(
      Math.cos(windAngle) * windSpeed,
      0,
      Math.sin(windAngle) * windSpeed
    );

    // Anchor the valley storm box ahead of the camera across the visible basin
    const centerX = clamp((this.currentFocus.x + this.currentPos.x * 0.25) * 0.8, -280, 280);
    const centerZ = clamp((this.currentFocus.z + this.currentPos.z * 0.32), -360, 260);
    sharedUniforms.uCenter.value.set(centerX, centerZ);

    // 3. Step 491,520 petals on the GPU
    this.petals.update(dt, this.currentPos);
  }

  private resize(): void {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.petals.setViewport(h, dpr, this.camera.fov);
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);

    const canvas = this.renderer.domElement;
    window.removeEventListener("resize", this.onResize);
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("wheel", this.onWheel);

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.petals.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }
}
