import * as THREE from 'three/webgpu';
import {
  abs,
  clamp,
  dot,
  float,
  fract,
  length,
  max,
  mix,
  mrt,
  normalView,
  output,
  pass,
  renderOutput,
  screenUV,
  sin,
  smoothstep,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { ao } from 'three/examples/jsm/tsl/display/GTAONode.js';
import { denoise } from 'three/examples/jsm/tsl/display/DenoiseNode.js';
import { ArchitecturalStyle, LightingPreset, MassingState } from '../core/types';
import { PBRMaterialLibrary, TextureLoadProgress } from '../building/materials';
import { generatePBRBuilding } from '../building/buildingGenerator';

const assetBase = import.meta.env.BASE_URL;

export type GPUBackendKind = 'WebGPU' | 'WebGL2';

export interface BuildingLoadSnapshot {
  gpuReady: boolean;
  gpuBackend: GPUBackendKind | null;
  texturesLoaded: number;
  texturesTotal: number;
  hdrisLoaded: number;
  hdrisTotal: number;
  currentAsset: string;
  warmedUp: boolean;
}

export interface BuildingViewportCallbacks {
  onBackendReady?: (backend: GPUBackendKind) => void;
  onHdriLoading?: (loading: boolean) => void;
  onLoadSnapshot?: (snapshot: BuildingLoadSnapshot) => void;
}

interface StudioLook {
  hdriUrl: string;
  useFlatBackdrop: boolean;
  backdropColor: string;
  exposure: number;
  envIntensity: number;
  bgIntensity: number;
  tone: THREE.ToneMapping;
  keyColor: string;
  keyIntensity: number;
  keyAzimuth: number;
  keyElevation: number;
  keySoftness: number;
  fillColor: string;
  fillIntensity: number;
  fillAzimuth: number;
  fillElevation: number;
  rimColor: string;
  rimIntensity: number;
  rimAzimuth: number;
  rimElevation: number;
  skyColor: string;
  groundColor: string;
  hemiIntensity: number;
  fogColor: string;
  fogDensity: number;
  uplightColor: string;
  uplights: number;
  cityTint: string;
  contrast: number;
  saturation: number;
  vignette: number;
  grain: number;
  temperature: number;
  shadowTint: string;
  highlightTint: string;
  splitTone: number;
}

const ALL_LIGHTING_PRESETS: LightingPreset[] = ['daylight', 'golden-hour', 'twilight'];

/**
 * Calibrated 1-to-1 with ProdceduralBuildingsThreeJS (src/studio.ts + screenshots):
 * - NO BloomNode (eliminates the nuclear highlight washout!)
 * - Clean Architectural daylight backdrop (#edf0f3) w/ NeutralToneMapping + crisp HDRI glass reflections
 * - Deep moody Golden Hour (warm low sun, cool blue shadows, burnt-sienna dusk sky)
 * - Moody Blue Hour / Twilight (royal cobalt ambient, gentle warm grazing ground uplights, selective warm rooms)
 */
const STUDIO_LOOKS: Record<LightingPreset, StudioLook> = {
  daylight: {
    hdriUrl: `${assetBase}hdri/daylight.hdr`,
    useFlatBackdrop: true, // matches crisp clean pale architectural backdrop in app.jpg & new-york.jpg!
    backdropColor: '#edf0f3',
    exposure: 0.94,
    envIntensity: 0.42,
    bgIntensity: 0.95,
    tone: THREE.NeutralToneMapping,
    keyColor: '#fff8f0',
    keyIntensity: 4.6,
    keyAzimuth: -42,
    keyElevation: 40,
    keySoftness: 2.2,
    fillColor: '#eef1f6',
    fillIntensity: 0.25,
    fillAzimuth: 140,
    fillElevation: 35,
    rimColor: '#ffffff',
    rimIntensity: 0.25,
    rimAzimuth: 200,
    rimElevation: 30,
    skyColor: '#eceef0',
    groundColor: '#c8c3ba',
    hemiIntensity: 0.65,
    fogColor: '#edf0f3',
    fogDensity: 0.0018,
    uplightColor: '#ffd9a8',
    uplights: 0,
    cityTint: '#f2f4f7',
    contrast: 1.07,
    saturation: 1.02,
    vignette: 0.10,
    grain: 0.005,
    temperature: 0.0,
    shadowTint: '#9aa0a8',
    highlightTint: '#ffffff',
    splitTone: 0.03,
  },
  'golden-hour': {
    hdriUrl: `${assetBase}hdri/golden_hour.hdr`,
    useFlatBackdrop: false,
    backdropColor: '#9b5236',
    exposure: 0.94,
    envIntensity: 0.34,
    bgIntensity: 0.62,
    tone: THREE.ACESFilmicToneMapping,
    keyColor: '#ffb26b',
    keyIntensity: 4.2,
    keyAzimuth: 62,
    keyElevation: 14,
    keySoftness: 2.0,
    fillColor: '#4e70b8',
    fillIntensity: 0.42,
    fillAzimuth: -100,
    fillElevation: 25,
    rimColor: '#ffca82',
    rimIntensity: 0.55,
    rimAzimuth: 200,
    rimElevation: 18,
    skyColor: '#4b5c85',
    groundColor: '#261b15',
    hemiIntensity: 0.4,
    fogColor: '#5c3b30',
    fogDensity: 0.0028,
    uplightColor: '#ffd9a8',
    uplights: 0,
    cityTint: '#e2dcd6',
    contrast: 1.08,
    saturation: 1.05,
    vignette: 0.30,
    grain: 0.022,
    temperature: 0.05,
    shadowTint: '#2a3b5c',
    highlightTint: '#ffd6a0',
    splitTone: 0.28,
  },
  twilight: {
    hdriUrl: `${assetBase}hdri/twilight.hdr`,
    useFlatBackdrop: true, // Deep royal cobalt Blue Hour backdrop matching blue-hour.jpg (no pink horizon washout!)
    backdropColor: '#162452',
    exposure: 0.94,
    envIntensity: 0.18,
    bgIntensity: 0.35,
    tone: THREE.ACESFilmicToneMapping,
    keyColor: '#88a4f8',
    keyIntensity: 0.75,
    keyAzimuth: -30,
    keyElevation: 34,
    keySoftness: 4.5,
    fillColor: '#ff9a64',
    fillIntensity: 0.14,
    fillAzimuth: 150,
    fillElevation: 8,
    rimColor: '#ffa866',
    rimIntensity: 0.45,
    rimAzimuth: 172,
    rimElevation: 12,
    skyColor: '#243a78',
    groundColor: '#0c0f20',
    hemiIntensity: 0.62,
    fogColor: '#1a295a',
    fogDensity: 0.0052,
    uplightColor: '#ffc884',
    uplights: 0.48,
    cityTint: '#556ca3',
    contrast: 1.06,
    saturation: 1.08,
    vignette: 0.34,
    grain: 0.025,
    temperature: -0.07,
    shadowTint: '#10204a',
    highlightTint: '#ffc890',
    splitTone: 0.32,
  },
};

function dirFrom(azDeg: number, elDeg: number, out = new THREE.Vector3()): THREE.Vector3 {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

export class BuildingViewport {
  public readonly camera: THREE.PerspectiveCamera;
  public readonly controls: OrbitControls;

  private container: HTMLElement;
  private renderer: THREE.WebGPURenderer;
  private scene: THREE.Scene;
  private callbacks: BuildingViewportCallbacks;
  private materialLib: PBRMaterialLibrary;
  private rgbeLoader = new RGBELoader();
  private hdriCache = new Map<LightingPreset, THREE.DataTexture>();

  // Exact 5-Light Architectural Studio Rig (from ProdceduralBuildingsThreeJS/src/studio.ts)
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private uplights: THREE.SpotLight[] = [];

  // Exact ProdceduralBuildingsThreeJS/src/postfx.ts WebGPU TSL Stack (NO bloom washout!):
  // Render -> Selective GTAO + Denoise -> renderOutput (ToneMap + sRGB) -> Display-Space FilmGrade
  private postProcessing: THREE.PostProcessing | null = null;
  private aoStrengthUniform = uniform(0.0);
  private gradeTime = uniform(0.0);
  private gradeContrast = uniform(1.07);
  private gradeSaturation = uniform(1.02);
  private gradeVignette = uniform(0.10);
  private gradeGrain = uniform(0.005);
  private gradeTemperature = uniform(0.0);
  private gradeShadowTint = uniform(new THREE.Color('#9aa0a8'));
  private gradeHighlightTint = uniform(new THREE.Color('#ffffff'));
  private gradeSplitTone = uniform(0.03);

  private postFXEnabled = false;
  private postFXFailed = false;

  private buildingRoot = new THREE.Group();
  private currentBounds = new THREE.Box3();
  private currentStyle: ArchitecturalStyle = 'contemporary';
  private currentLighting: LightingPreset = 'golden-hour';
  private showColumns = true;
  private lastState: MassingState | null = null;

  private resizeObserver: ResizeObserver;
  private initialized = false;
  private disposed = false;
  private lastFrameTime = performance.now();

  private loadState: BuildingLoadSnapshot = {
    gpuReady: false,
    gpuBackend: null,
    texturesLoaded: 0,
    texturesTotal: 39,
    hdrisLoaded: 0,
    hdrisTotal: ALL_LIGHTING_PRESETS.length,
    currentAsset: 'Initializing WebGPU backend…',
    warmedUp: false,
  };
  private warmupFramesRemaining = 3;

  constructor(container: HTMLElement, callbacks: BuildingViewportCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = null;

    // 32° architectural telephoto lens (matches ProdceduralBuildingsThreeJS!)
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.camera = new THREE.PerspectiveCamera(32, w / h, 0.25, 600);
    this.camera.position.set(28, 19, 32);

    this.renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor('#000000', 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = STUDIO_LOOKS['golden-hour'].tone;
    this.renderer.toneMappingExposure = STUDIO_LOOKS['golden-hour'].exposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 180;
    this.controls.target.set(0, 4.5, 0);
    this.controls.update();

    this.materialLib = new PBRMaterialLibrary(8, (p: TextureLoadProgress) => {
      if (this.disposed) return;
      this.loadState.texturesLoaded = p.loaded;
      this.loadState.texturesTotal = p.total;
      if (p.lastUrl) {
        this.loadState.currentAsset = p.lastUrl;
      }
      this.emitLoadSnapshot();
    });

    // --- Calibrated 5-Light Architectural Rig (no distance² blowouts!) ---
    this.keyLight = new THREE.DirectionalLight('#fff8f0', 4.2);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(4096, 4096);
    this.keyLight.shadow.bias = -0.00025;
    this.keyLight.shadow.normalBias = 0.03;
    this.keyLight.shadow.radius = 2.2;

    this.fillLight = new THREE.DirectionalLight('#eef1f6', 0.25);
    this.rimLight = new THREE.DirectionalLight('#ffffff', 0.25);
    this.hemiLight = new THREE.HemisphereLight('#eceef0', '#c8c3ba', 0.65);

    for (let i = 0; i < 4; i++) {
      const u = new THREE.SpotLight('#ffc884', 0, 26, Math.PI / 4, 0.85, 1.4);
      u.visible = false;
      this.uplights.push(u);
      this.scene.add(u, u.target);
    }

    this.scene.add(
      this.keyLight,
      this.keyLight.target,
      this.fillLight,
      this.rimLight,
      this.hemiLight
    );

    this.scene.add(this.buildingRoot);

    this.applyLightingPreset(this.currentLighting);
    this.preloadAllHdris();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    void this.renderer.init().then(() => {
      if (this.disposed) {
        this.renderer.dispose();
        return;
      }
      this.initialized = true;
      this.handleResize();
      this.setupPostProcessing();

      const isWebGPU = Boolean(
        (this.renderer.backend as unknown as { isWebGPUBackend?: boolean })?.isWebGPUBackend
      );
      const backend: GPUBackendKind = isWebGPU ? 'WebGPU' : 'WebGL2';
      this.loadState.gpuReady = true;
      this.loadState.gpuBackend = backend;
      this.callbacks.onBackendReady?.(backend);
      this.emitLoadSnapshot();
      this.renderer.setAnimationLoop(this.renderFrame);
    });
  }

  /**
   * 1-to-1 WebGPU TSL port of ProdceduralBuildingsThreeJS/src/postfx.ts:
   *  Render -> GTAO (0.85 blend, radius 0.6, thickness 1.5, samples 16)
   *         -> Bilateral Denoise (lumaPhi 10, depthPhi 2, normalPhi 3, radius 6)
   *         -> renderOutput (ToneMapping + sRGB)
   *         -> Display-Space FilmGrade (white balance, split tone, contrast, saturation, vignette, grain)
   */
  private setupPostProcessing(): void {
    try {
      const scenePass = pass(this.scene, this.camera);
      scenePass.setMRT(
        mrt({
          output,
          normal: normalView,
        })
      );

      const scenePassColor = scenePass.getTextureNode('output');
      const scenePassNormal = scenePass.getTextureNode('normal');
      const scenePassDepth = scenePass.getTextureNode('depth');

      const aoPass = ao(scenePassDepth, scenePassNormal, this.camera);
      aoPass.resolutionScale = 0.5;
      aoPass.radius.value = 0.6;
      aoPass.distanceExponent.value = 1.4;
      aoPass.thickness.value = 1.5;
      aoPass.scale.value = 1.0;
      aoPass.samples.value = 16;

      const denoisePass = denoise(
        aoPass.getTextureNode(),
        scenePassDepth,
        scenePassNormal,
        this.camera
      );
      denoisePass.radius.value = 6;
      denoisePass.lumaPhi.value = 10;
      denoisePass.depthPhi.value = 2;
      denoisePass.normalPhi.value = 3;

      // Preserve exact MSAA silhouette & glass coverage while keeping the background pure #ffffff
      const alpha = clamp(scenePassColor.a, float(0.0), float(1.0));
      const unpremulRGB = scenePassColor.rgb.div(max(alpha, float(0.0001)));

      // Apply denoised GTAO cleanly to linear RGB (matches postfx.ts blendIntensity = 0.85)
      const aoFactor = mix(float(1.0), denoisePass.r, this.aoStrengthUniform);
      const litWithAO = vec4(unpremulRGB.mul(aoFactor), float(1.0));

      // Tone mapping + sRGB conversion into display space (identical to OutputPass in postfx.ts!)
      const displayNode = renderOutput(litWithAO);

      // Exact port of FilmGradeShader from ProdceduralBuildingsThreeJS/src/postfx.ts
      const lumaCoeff = vec3(0.2126, 0.7152, 0.0722);
      const dir = screenUV.sub(vec2(0.5, 0.5));

      const wb = vec3(
        float(1.0).add(this.gradeTemperature.mul(0.35)),
        float(1.0).add(this.gradeTemperature.mul(0.05)),
        float(1.0).sub(this.gradeTemperature.mul(0.4))
      );
      const colWB = displayNode.rgb.mul(wb);

      const luma0 = dot(colWB, lumaCoeff);
      const toned = mix(this.gradeShadowTint, this.gradeHighlightTint, smoothstep(0.05, 0.75, luma0));
      const tonedLuma = max(dot(toned, lumaCoeff), float(0.001));
      const colSplit = mix(colWB, colWB.mul(toned).div(tonedLuma), this.gradeSplitTone);

      const colContrast = colSplit.sub(0.5).mul(this.gradeContrast).add(0.5);
      const luma1 = dot(colContrast, lumaCoeff);
      const colSat = mix(vec3(luma1), colContrast, this.gradeSaturation);

      const vig = smoothstep(0.35, 0.95, length(dir.mul(vec2(1.0, 0.8))).mul(1.25));
      const colVig = colSat.mul(float(1.0).sub(vig.mul(this.gradeVignette)));

      const grainSeed = screenUV.mul(1.7).add(fract(this.gradeTime.mul(7.13)));
      const grainNoise = fract(sin(dot(grainSeed, vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5);
      const midWeight = float(0.4).add(float(0.6).mul(float(1.0).sub(abs(luma1.sub(0.5)).mul(2.0))));
      const colGraded = clamp(colVig.add(grainNoise.mul(this.gradeGrain).mul(midWeight)), 0.0, 1.0);

      // Composite graded building cleanly over pure minimalist white backdrop (#ffffff)
      const finalRGB = mix(vec3(1.0, 1.0, 1.0), colGraded, alpha);

      const pp = new THREE.PostProcessing(this.renderer);
      pp.outputColorTransform = false;
      pp.outputNode = vec4(finalRGB, float(1.0));
      this.postProcessing = pp;
    } catch {
      this.postProcessing = null;
      this.postFXFailed = true;
    }
  }

  public setPostFXEnabled(enabled: boolean): void {
    this.postFXEnabled = enabled;
    this.aoStrengthUniform.value = enabled ? 0.85 : 0.0;
  }

  private emitLoadSnapshot(): void {
    this.callbacks.onLoadSnapshot?.({ ...this.loadState });
  }

  private preloadAllHdris(): void {
    this.callbacks.onHdriLoading?.(true);
    let completed = 0;

    for (const preset of ALL_LIGHTING_PRESETS) {
      const look = STUDIO_LOOKS[preset];
      this.rgbeLoader.load(
        look.hdriUrl,
        (hdrTex) => {
          if (this.disposed) {
            hdrTex.dispose();
            return;
          }
          hdrTex.mapping = THREE.EquirectangularReflectionMapping;
          this.hdriCache.set(preset, hdrTex);

          if (preset === this.currentLighting) {
            this.scene.environment = hdrTex;
            this.scene.background = null;
            this.materialLib.setEnvironmentMap(hdrTex);
            this.callbacks.onHdriLoading?.(false);
          }

          completed++;
          this.loadState.hdrisLoaded = completed;
          this.loadState.currentAsset = look.hdriUrl;
          this.emitLoadSnapshot();
        },
        undefined,
        () => {
          if (this.disposed) return;
          completed++;
          this.loadState.hdrisLoaded = completed;
          if (preset === this.currentLighting) {
            this.callbacks.onHdriLoading?.(false);
          }
          this.emitLoadSnapshot();
        }
      );
    }
  }

  public applyLightingPreset(preset: LightingPreset): void {
    this.currentLighting = preset;
    const L = STUDIO_LOOKS[preset];

    this.renderer.toneMapping = L.tone;
    this.renderer.toneMappingExposure = L.exposure;

    this.scene.environmentIntensity = L.envIntensity;
    this.scene.background = null;
    this.scene.fog = null;

    this.gradeContrast.value = L.contrast;
    this.gradeSaturation.value = L.saturation;
    this.gradeVignette.value = L.vignette;
    this.gradeGrain.value = L.grain;
    this.gradeTemperature.value = L.temperature;
    this.gradeShadowTint.value.set(L.shadowTint);
    this.gradeHighlightTint.value.set(L.highlightTint);
    this.gradeSplitTone.value = L.splitTone;

    const cached = this.hdriCache.get(preset);
    if (cached) {
      this.scene.environment = cached;
      this.materialLib.setEnvironmentMap(cached);
      this.callbacks.onHdriLoading?.(false);
    } else {
      this.callbacks.onHdriLoading?.(true);
    }

    this.materialLib.updateLightingResponse(this.currentStyle, preset);
    this.positionStudioLights();
  }

  private positionStudioLights(): void {
    const L = STUDIO_LOOKS[this.currentLighting];
    const center = new THREE.Vector3(0, 4, 0);
    const size = new THREE.Vector3(14, 10, 12);
    if (!this.currentBounds.isEmpty()) {
      this.currentBounds.getCenter(center);
      this.currentBounds.getSize(size);
      center.y = Math.max(2, size.y * 0.45);
    }

    const r = 0.5 * Math.hypot(size.x, size.z, size.y);
    const dist = Math.max(r * 2.6, 36);

    // 1. Key Light + soft 4096 shadow frustum
    const kd = dirFrom(L.keyAzimuth, L.keyElevation);
    this.keyLight.color.set(L.keyColor);
    this.keyLight.intensity = L.keyIntensity;
    this.keyLight.position.copy(center).addScaledVector(kd, dist);
    this.keyLight.target.position.copy(center);
    this.keyLight.target.updateMatrixWorld();
    this.keyLight.shadow.radius = L.keySoftness;

    const elevRad = (L.keyElevation * Math.PI) / 180;
    const reach = Math.max(
      r * 1.4 + (size.y / Math.max(Math.tan(elevRad), 0.2)) * 0.65,
      r * 1.3 + 42
    );
    const cam = this.keyLight.shadow.camera;
    cam.left = -reach;
    cam.right = reach;
    cam.top = reach;
    cam.bottom = -reach;
    cam.near = Math.max(dist - reach * 2, 0.5);
    cam.far = dist + reach * 2.4;
    cam.updateProjectionMatrix();

    // 2. Fill Light
    this.fillLight.color.set(L.fillColor);
    this.fillLight.intensity = L.fillIntensity;
    this.fillLight.position.copy(center).addScaledVector(dirFrom(L.fillAzimuth, L.fillElevation), dist);

    // 3. Rim Directional Light (clean edge highlight without SpotLight distance² blowout!)
    this.rimLight.color.set(L.rimColor);
    this.rimLight.intensity = L.rimIntensity;
    this.rimLight.position.copy(center).addScaledVector(dirFrom(L.rimAzimuth, L.rimElevation), dist);

    // 4. Hemisphere Bounce
    this.hemiLight.color.set(L.skyColor);
    this.hemiLight.groundColor.set(L.groundColor);
    this.hemiLight.intensity = L.hemiIntensity;

    // 5. Gentle warm ground-level facade grazing uplights (Twilight / Blue Hour only)
    const hw = size.x * 0.5;
    const hl = size.z * 0.5;
    const spots: [number, number, number, number][] = [
      [center.x, center.z + hl + 2.2, center.x, center.z + hl],
      [center.x, center.z - hl - 2.2, center.x, center.z - hl],
      [center.x + hw + 2.2, center.z, center.x + hw, center.z],
      [center.x - hw - 2.2, center.z, center.x - hw, center.z],
    ];
    this.uplights.forEach((u, i) => {
      const [px, pz, tx, tz] = spots[i];
      u.position.set(px, 0.25, pz);
      u.target.position.set(tx, Math.min(8, size.y * 0.65), tz);
      u.target.updateMatrixWorld();
      u.color.set(L.uplightColor);
      u.intensity = L.uplights * 18;
      u.visible = L.uplights > 0.001;
    });
  }

  public updateBuilding(
    state: MassingState,
    style: ArchitecturalStyle,
    showColumns: boolean
  ): void {
    this.lastState = state;
    this.currentStyle = style;
    this.showColumns = showColumns;

    while (this.buildingRoot.children.length > 0) {
      const child = this.buildingRoot.children[0];
      this.buildingRoot.remove(child);
      child.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
    }

    const palette = this.materialLib.getPalette(style);
    this.materialLib.updateLightingResponse(style, this.currentLighting);

    const { group, bounds } = generatePBRBuilding(state, palette, {
      style,
      showColumns,
    });

    this.buildingRoot.add(group);
    this.currentBounds.copy(bounds);

    this.positionStudioLights();
  }

  public isFullyWarmedUp(): boolean {
    return this.loadState.warmedUp;
  }

  public setStyle(style: ArchitecturalStyle): void {
    if (this.lastState) {
      this.updateBuilding(this.lastState, style, this.showColumns);
    } else {
      this.currentStyle = style;
    }
  }

  private handleResize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private renderFrame = (): void => {
    if (this.disposed || !this.initialized) return;

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    this.gradeTime.value += dt;

    this.controls.update();

    if (this.postProcessing && this.postFXEnabled && !this.postFXFailed) {
      try {
        this.postProcessing.render();
      } catch {
        this.postFXFailed = true;
        this.renderer.render(this.scene, this.camera);
      }
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (
      !this.loadState.warmedUp &&
      this.loadState.gpuReady &&
      this.loadState.texturesLoaded >= this.loadState.texturesTotal &&
      this.loadState.hdrisLoaded >= this.loadState.hdrisTotal &&
      this.buildingRoot.children.length > 0
    ) {
      this.warmupFramesRemaining--;
      if (this.warmupFramesRemaining <= 0) {
        this.loadState.warmedUp = true;
        this.loadState.currentAsset = 'Scene ready';
        this.emitLoadSnapshot();
      }
    }
  };

  public dispose(): void {
    this.disposed = true;
    this.resizeObserver.disconnect();
    while (this.buildingRoot.children.length > 0) {
      const child = this.buildingRoot.children[0];
      this.buildingRoot.remove(child);
      child.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
      });
    }
    for (const tex of this.hdriCache.values()) {
      tex.dispose();
    }
    this.hdriCache.clear();
    this.materialLib.dispose();
    this.controls.dispose();
    this.postProcessing = null;
    if (this.initialized) {
      this.renderer.setAnimationLoop(null);
      this.renderer.dispose();
    }
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
