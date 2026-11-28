import * as THREE from 'three/webgpu';
import { Fn, float, vec3, vec4 } from 'three/tsl';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  DragPreviewInfo,
  MassingFace,
  MassingState,
  Rect2D,
  SplitAxis,
  ToolMode,
  TYPICAL_FLOOR_HEIGHT,
} from '../core/types';
import {
  applyExtrude,
  computeExposedFaces,
  computeInsetRect,
} from '../core/massingEngine';
import { dirLabel, faceToCorners3D, worldPointToFaceUV } from '../core/math2d';

export interface MassingViewportCallbacks {
  onReady?: () => void;
  onSelectFace: (face: MassingFace | null) => void;
  onHoverFace: (face: MassingFace | null) => void;
  onPreviewState: (preview: MassingState | null) => void;
  onDragInfo: (info: DragPreviewInfo | null) => void;
  onCommitExtrude: (face: MassingFace, distance: number, insetMargin: number) => void;
  onCommitSplit: (face: MassingFace, axis: SplitAxis, ratio: number) => void;
  onCommitInset: (face: MassingFace, margin: number) => void;
}

interface FaceHitEntry {
  mesh: THREE.Mesh;
  face: MassingFace;
}

const SETBACK_MARGIN = 1.6;

export class MassingViewport {
  public readonly camera: THREE.PerspectiveCamera;
  public readonly controls: OrbitControls;

  private container: HTMLElement;
  private renderer: THREE.WebGPURenderer;
  private scene: THREE.Scene;
  private callbacks: MassingViewportCallbacks;
  private resizeObserver: ResizeObserver;
  private initialized = false;
  private disposed = false;

  // Scene groups
  private massingGroup = new THREE.Group();
  private overlayGroup = new THREE.Group();
  private gizmoGroup = new THREE.Group();
  private previewGroup = new THREE.Group();

  // State
  private state: MassingState | null = null;
  private faces: MassingFace[] = [];
  private faceEntries: FaceHitEntry[] = [];
  private selectedFaceId: string | null = null;
  private hoveredFaceId: string | null = null;
  private toolMode: ToolMode = 'extrude';
  private splitAxis: SplitAxis = 'auto';
  private floorSnap = true;
  private gizmoHovered = false;

  // Interaction & Raycasting
  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2();
  private gizmoHitMeshes: THREE.Object3D[] = [];

  // Dragging state
  private isDragging = false;
  private pointerDownPos = { x: 0, y: 0 };
  private dragFace: MassingFace | null = null;
  private dragPlane = new THREE.Plane();
  private dragStartHit = new THREE.Vector3();
  private dragUseScreenFallback = false;
  private dragNormalVec = new THREE.Vector3();
  private dragCurrentDelta = 0;
  private dragLastSnapped = 0;
  private dragIsSetback = false;
  private dragLastSetback = false;

  // Hover split/inset dynamic preview
  private hoverHitPoint = new THREE.Vector3();

  // Reusable materials
  private clayBaseMat: THREE.MeshStandardMaterial;
  private clayTierMat: THREE.MeshStandardMaterial;
  private clayLockedMat: THREE.MeshStandardMaterial;
  private hoverMat: THREE.MeshBasicMaterial;
  private selectMat: THREE.MeshBasicMaterial;
  private edgeLineMat: THREE.LineBasicMaterial;

  constructor(container: HTMLElement, callbacks: MassingViewportCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = null;

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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 135;
    this.controls.target.set(0, 4.5, 0);
    this.controls.update();

    // Clean CAD studio materials
    this.clayBaseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#dce4f0'),
      roughness: 0.72,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.clayTierMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e8eff8'),
      roughness: 0.68,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.clayLockedMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#94a3b8'),
      roughness: 0.85,
      metalness: 0.0,
    });
    this.hoverMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#38bdf8'),
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.selectMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#0ea5e9'),
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.edgeLineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#1e293b'),
      transparent: true,
      opacity: 0.88,
    });

    this.setupStudioEnvironment();
    this.scene.add(this.massingGroup);
    this.scene.add(this.overlayGroup);
    this.scene.add(this.gizmoGroup);
    this.scene.add(this.previewGroup);

    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    void this.renderer.init().then(() => {
      if (this.disposed) {
        this.renderer.dispose();
        return;
      }
      this.initialized = true;
      this.handleResize();
      this.renderer.setAnimationLoop(this.renderFrame);
      this.callbacks.onReady?.();
    });
  }

  private setupStudioEnvironment(): void {
    // Clean neutral white studio lighting
    const hemi = new THREE.HemisphereLight('#ffffff', '#d4d4d4', 1.15);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight('#ffffff', 1.45);
    key.position.set(24, 38, 22);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 110;
    const d = 32;
    key.shadow.camera.left = -d;
    key.shadow.camera.right = d;
    key.shadow.camera.top = d;
    key.shadow.camera.bottom = -d;
    key.shadow.bias = -0.0004;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight('#ffffff', 0.55);
    rim.position.set(-22, 16, -24);
    this.scene.add(rim);

    // Minimalistic transparent shadow catcher on pure #ffffff white background (WebGPU-safe TSL)
    const totalShadow = float(1.0).toVar();
    const groundMat = new THREE.MeshStandardNodeMaterial({
      color: new THREE.Color('#000000'),
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    groundMat.receivedShadowNode = Fn(([shadow]: [ReturnType<typeof float>]) => {
      totalShadow.mulAssign(shadow);
      return shadow;
    }) as unknown as THREE.Node;
    groundMat.outputNode = vec4(
      vec3(0.0, 0.0, 0.0),
      float(1.0).sub(totalShadow).mul(0.13)
    );

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Subtle neutral drafting grid (1m minor + 5m major) on pure white studio floor
    const minorGrid = new THREE.GridHelper(100, 100, '#efefef', '#f5f5f5');
    minorGrid.position.y = -0.005;
    (minorGrid.material as THREE.Material).transparent = true;
    (minorGrid.material as THREE.Material).opacity = 0.65;
    this.scene.add(minorGrid);

    const majorGrid = new THREE.GridHelper(100, 20, '#dcdcdc', '#e6e6e6');
    majorGrid.position.y = 0.0;
    (majorGrid.material as THREE.Material).transparent = true;
    (majorGrid.material as THREE.Material).opacity = 0.85;
    this.scene.add(majorGrid);

    // Subtle metric origin axis ticks
    const axisLen = 4.0;
    const addAxis = (to: THREE.Vector3, color: string) => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.02, 0), to]);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 }));
      this.scene.add(line);
    };
    addAxis(new THREE.Vector3(axisLen, 0.02, 0), '#f43f5e');
    addAxis(new THREE.Vector3(0, 0.02, axisLen), '#3b82f6');
  }

  public setMassingState(state: MassingState, selectedFaceId: string | null): void {
    this.state = state;
    this.faces = computeExposedFaces(state);
    this.selectedFaceId =
      selectedFaceId && this.faces.some((f) => f.id === selectedFaceId && !f.locked)
        ? selectedFaceId
        : null;

    this.rebuildMassingMeshes();
    this.rebuildOverlaysAndGizmo();
  }

  public showProgrammaticDragPreview(face: MassingFace | null, delta: number, isSetback = false): void {
    if (!face || Math.abs(delta) < 0.05) {
      this.clearGroup(this.previewGroup, true);
      this.gizmoGroup.position.set(0, 0, 0);
      return;
    }
    this.rebuildDragPreview(face, delta, isSetback);
  }

  public setSelectedFaceId(id: string | null): void {
    this.selectedFaceId = id;
    this.rebuildOverlaysAndGizmo();
  }

  public setToolMode(mode: ToolMode): void {
    this.toolMode = mode;
    this.rebuildOverlaysAndGizmo();
  }

  public setSplitAxis(axis: SplitAxis): void {
    this.splitAxis = axis;
    this.rebuildOverlaysAndGizmo();
  }

  public setFloorSnap(snap: boolean): void {
    this.floorSnap = snap;
  }

  private clearGroup(group: THREE.Group, disposeMaterials = false): void {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
        if (disposeMaterials && (obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
    }
  }

  private rebuildMassingMeshes(): void {
    this.clearGroup(this.massingGroup);
    this.faceEntries = [];

    for (const face of this.faces) {
      const geo = this.createQuadGeometry(face.corners, face.normal);
      const mat = face.locked
        ? this.clayLockedMat
        : face.createdStep === 0
        ? this.clayBaseMat
        : this.clayTierMat;

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.faceId = face.id;
      this.massingGroup.add(mesh);

      // Crisp architectural CAD border lines around every face so newly extruded faces stand out unmistakably
      const pts = [
        new THREE.Vector3(...face.corners[0]),
        new THREE.Vector3(...face.corners[1]),
        new THREE.Vector3(...face.corners[2]),
        new THREE.Vector3(...face.corners[3]),
        new THREE.Vector3(...face.corners[0]),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const border = new THREE.Line(lineGeo, this.edgeLineMat);
      this.massingGroup.add(border);

      if (!face.locked) {
        this.faceEntries.push({ mesh, face });
      }
    }
  }

  private createQuadGeometry(
    corners: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]],
    normal: [number, number, number],
    offset = 0
  ): THREE.BufferGeometry {
    const [nx, ny, nz] = normal;
    const positions = new Float32Array([
      corners[0][0] + nx * offset, corners[0][1] + ny * offset, corners[0][2] + nz * offset,
      corners[1][0] + nx * offset, corners[1][1] + ny * offset, corners[1][2] + nz * offset,
      corners[2][0] + nx * offset, corners[2][1] + ny * offset, corners[2][2] + nz * offset,
      corners[3][0] + nx * offset, corners[3][1] + ny * offset, corners[3][2] + nz * offset,
    ]);
    const normals = new Float32Array([
      nx, ny, nz,
      nx, ny, nz,
      nx, ny, nz,
      nx, ny, nz,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    return geo;
  }

  private addRectOutline(
    target: THREE.Group,
    face: MassingFace,
    rect: Rect2D,
    color: string,
    offset = 0.035
  ): void {
    const c = faceToCorners3D(face.dir, face.plane, rect);
    const [nx, ny, nz] = face.normal;
    const pts = [0, 1, 2, 3, 0].map(
      (i) => new THREE.Vector3(c[i][0] + nx * offset, c[i][1] + ny * offset, c[i][2] + nz * offset)
    );
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color });
    target.add(new THREE.Line(geo, mat));
  }

  private rebuildOverlaysAndGizmo(): void {
    this.clearGroup(this.overlayGroup, true);
    this.clearGroup(this.gizmoGroup, true);
    this.gizmoHitMeshes = [];

    const selected = this.faces.find((f) => f.id === this.selectedFaceId) ?? null;
    const hovered = this.faces.find((f) => f.id === this.hoveredFaceId) ?? null;

    // Hover overlay
    if (hovered && hovered.id !== this.selectedFaceId && !this.isDragging) {
      const hoverQuad = new THREE.Mesh(
        this.createQuadGeometry(hovered.corners, hovered.normal, 0.025),
        this.hoverMat.clone()
      );
      this.overlayGroup.add(hoverQuad);
      this.addRectOutline(this.overlayGroup, hovered, hovered.rect, '#7dd3fc', 0.035);
    }

    // Tool-specific interactive hover preview (Split cut line or Inset border)
    const toolTarget = hovered ?? selected;
    if (toolTarget && !this.isDragging) {
      if (this.toolMode === 'split') {
        this.addSplitPreview(toolTarget);
      } else if (this.toolMode === 'inset' || this.toolMode === 'setback') {
        const inner = computeInsetRect(toolTarget.rect, SETBACK_MARGIN);
        if (inner) {
          this.addRectOutline(
            this.overlayGroup,
            toolTarget,
            inner,
            this.toolMode === 'setback' ? '#a78bfa' : '#34d399',
            0.045
          );
        }
      }
    }

    // Selected face overlay & 3D Extrusion Gizmo
    if (selected) {
      const selQuad = new THREE.Mesh(
        this.createQuadGeometry(selected.corners, selected.normal, 0.022),
        this.selectMat.clone()
      );
      this.overlayGroup.add(selQuad);
      this.addRectOutline(this.overlayGroup, selected, selected.rect, '#38bdf8', 0.04);

      if (this.toolMode === 'extrude' || this.toolMode === 'setback') {
        this.buildExtrudeGizmo(selected);
      }
    }
  }

  private addSplitPreview(face: MassingFace): void {
    const r = face.rect;
    const w = r.u1 - r.u0;
    const h = r.v1 - r.v0;
    const [nx, ny, nz] = face.normal;
    const off = 0.05;

    let chosen: 'u' | 'v' | 'grid' =
      this.splitAxis === 'auto' ? (w >= h ? 'u' : 'v') : this.splitAxis;
    if (chosen === 'u' && w < 2.0) chosen = 'v';
    if (chosen === 'v' && h < 2.0) chosen = 'u';

    const ratio = this.computeCursorSplitRatio(face, chosen);
    const mat = new THREE.LineBasicMaterial({ color: '#fbbf24' });

    const drawLine = (uA: number, vA: number, uB: number, vB: number) => {
      const pA = this.faceUVToWorld(face, uA, vA, off);
      const pB = this.faceUVToWorld(face, uB, vB, off);
      const g = new THREE.BufferGeometry().setFromPoints([pA, pB]);
      this.overlayGroup.add(new THREE.Line(g, mat.clone()));
    };

    if (chosen === 'u' || chosen === 'grid') {
      const mu = r.u0 + w * (chosen === 'grid' ? 0.5 : ratio);
      drawLine(mu, r.v0, mu, r.v1);
    }
    if (chosen === 'v' || chosen === 'grid') {
      const mv = r.v0 + h * (chosen === 'grid' ? 0.5 : ratio);
      drawLine(r.u0, mv, r.u1, mv);
    }
    void nx; void ny; void nz;
  }

  private computeCursorSplitRatio(face: MassingFace, axis: 'u' | 'v' | 'grid'): number {
    if (axis === 'grid' || this.hoveredFaceId !== face.id) return 0.5;
    const [hu, hv] = worldPointToFaceUV(face.dir, [
      this.hoverHitPoint.x,
      this.hoverHitPoint.y,
      this.hoverHitPoint.z,
    ]);
    const r = face.rect;
    const raw =
      axis === 'u'
        ? (hu - r.u0) / Math.max(0.01, r.u1 - r.u0)
        : (hv - r.v0) / Math.max(0.01, r.v1 - r.v0);
    // Magnetic snap to 0.25 / 0.50 / 0.75 for crisp architectural proportions
    const clamped = Math.max(0.2, Math.min(0.8, raw));
    for (const snap of [0.25, 0.5, 0.75]) {
      if (Math.abs(clamped - snap) < 0.06) return snap;
    }
    return Math.round(clamped * 20) / 20;
  }

  private faceUVToWorld(face: MassingFace, u: number, v: number, offset: number): THREE.Vector3 {
    const [nx, ny, nz] = face.normal;
    let x = 0, y = 0, z = 0;
    switch (face.dir) {
      case '+z':
      case '-z':
        x = u; y = v; z = face.plane;
        break;
      case '+x':
      case '-x':
        x = face.plane; y = v; z = u;
        break;
      case '+y':
      case '-y':
        x = u; y = face.plane; z = v;
        break;
    }
    return new THREE.Vector3(x + nx * offset, y + ny * offset, z + nz * offset);
  }

  private buildExtrudeGizmo(face: MassingFace): void {
    const isSetback = this.toolMode === 'setback';
    const baseColor = this.gizmoHovered
      ? '#fef08a'
      : isSetback
      ? '#a78bfa'
      : '#22d3ee';
    const emissiveColor = this.gizmoHovered
      ? '#eab308'
      : isSetback
      ? '#7c3aed'
      : '#0891b2';

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColor),
      emissive: new THREE.Color(emissiveColor),
      emissiveIntensity: this.gizmoHovered ? 0.9 : 0.45,
      roughness: 0.25,
      metalness: 0.2,
    });

    const arrow = new THREE.Group();
    const scale = Math.max(0.85, Math.min(1.45, Math.sqrt(Math.min(face.width, face.height)) * 0.42));

    // Base ring disc flush on face
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(0.32 * scale, 0.52 * scale, 28),
      new THREE.MeshBasicMaterial({
        color: baseColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.06;
    arrow.add(disc);

    // Stem cylinder
    const stemLen = 2.0 * scale;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11 * scale, 0.11 * scale, stemLen, 16),
      mat
    );
    stem.position.y = stemLen * 0.5 + 0.06;
    arrow.add(stem);

    // Arrowhead cone
    const headLen = 0.85 * scale;
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.38 * scale, headLen, 20),
      mat
    );
    head.position.y = stemLen + headLen * 0.5 + 0.06;
    arrow.add(head);

    // Generous invisible collider cylinder so clicking & dragging the gizmo is effortless
    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75 * scale, 0.75 * scale, stemLen + headLen + 0.6, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.position.y = (stemLen + headLen) * 0.5 + 0.1;
    arrow.add(hitMesh);
    this.gizmoHitMeshes.push(hitMesh, stem, head, disc);

    // Orient along face.normal (+Y default -> face.normal)
    const normalVec = new THREE.Vector3(...face.normal);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalVec);
    arrow.quaternion.copy(quat);
    arrow.position.set(...face.center);

    this.gizmoGroup.add(arrow);
  }

  private rebuildDragPreview(face: MassingFace, delta: number, isSetback: boolean): void {
    this.clearGroup(this.previewGroup, true);
    if (Math.abs(delta) < 0.05) return;

    let rect = face.rect;
    if (isSetback && delta > 0) {
      const inner = computeInsetRect(face.rect, SETBACK_MARGIN);
      if (inner) rect = inner;
    }

    const n = face.normal;
    const wA = face.plane;
    let wB = face.plane + delta * (n[0] + n[1] + n[2]);
    if ((face.dir === '+y' || face.dir === '-y') && wB < 0) wB = 0;

    const wMin = Math.min(wA, wB);
    const wMax = Math.max(wA, wB);
    if (wMax - wMin < 0.05) return;

    let minX = 0, maxX = 0, minY = 0, maxY = 0, minZ = 0, maxZ = 0;
    switch (face.dir) {
      case '+z':
      case '-z':
        minX = rect.u0; maxX = rect.u1; minY = rect.v0; maxY = rect.v1; minZ = wMin; maxZ = wMax;
        break;
      case '+x':
      case '-x':
        minX = wMin; maxX = wMax; minY = rect.v0; maxY = rect.v1; minZ = rect.u0; maxZ = rect.u1;
        break;
      case '+y':
      case '-y':
        minX = rect.u0; maxX = rect.u1; minY = wMin; maxY = wMax; minZ = rect.v0; maxZ = rect.v1;
        break;
    }

    const dx = maxX - minX;
    const dy = maxY - minY;
    const dz = maxZ - minZ;

    const color = delta < 0 ? '#f43f5e' : isSetback ? '#a78bfa' : '#22d3ee';
    const boxGeo = new THREE.BoxGeometry(dx, dy, dz);
    const fillMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const boxMesh = new THREE.Mesh(boxGeo, fillMat);
    boxMesh.position.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);
    this.previewGroup.add(boxMesh);

    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const edges = new THREE.LineSegments(edgesGeo, new THREE.LineBasicMaterial({ color }));
    edges.position.copy(boxMesh.position);
    this.previewGroup.add(edges);

    // Move the gizmo smoothly to ride the tip of the live extrusion!
    this.gizmoGroup.position.set(n[0] * delta, n[1] * delta, n[2] * delta);
  }

  private updatePointerNDC(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private raycastGizmo(): boolean {
    if (this.gizmoHitMeshes.length === 0) return false;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.gizmoHitMeshes, false);
    return hits.length > 0;
  }

  private raycastFaces(): { face: MassingFace; point: THREE.Vector3 } | null {
    if (this.faceEntries.length === 0) return null;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
    const meshes = this.faceEntries.map((e) => e.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const hitId = hits[0].object.userData.faceId as string;
    const entry = this.faceEntries.find((e) => e.face.id === hitId);
    if (!entry) return null;
    return { face: entry.face, point: hits[0].point.clone() };
  }

  private startExtrudeDrag(face: MassingFace, e: PointerEvent): void {
    this.isDragging = true;
    this.dragFace = face;
    this.dragCurrentDelta = 0;
    this.dragLastSnapped = 0;
    this.dragIsSetback = this.toolMode === 'setback' || e.shiftKey;
    this.dragLastSetback = this.dragIsSetback;
    this.controls.enabled = false;
    this.renderer.domElement.style.cursor = 'grabbing';

    this.dragNormalVec.set(...face.normal).normalize();
    const origin = new THREE.Vector3(...face.center);
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    // Construct drag plane containing face.normal and maximally facing the camera
    const side = new THREE.Vector3().crossVectors(this.dragNormalVec, camDir);
    if (side.lengthSq() < 0.02) {
      this.dragUseScreenFallback = true;
    } else {
      this.dragUseScreenFallback = false;
      const planeNormal = new THREE.Vector3().crossVectors(side, this.dragNormalVec).normalize();
      this.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, origin);
      this.raycaster.setFromCamera(this.pointerNDC, this.camera);
      if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartHit)) {
        this.dragUseScreenFallback = true;
      }
    }

    this.renderer.domElement.setPointerCapture(e.pointerId);
  }

  private snapDelta(face: MassingFace, raw: number, altKey: boolean): number {
    const isVert = face.dir === '+y' || face.dir === '-y';
    const clamped = Math.max(-28, Math.min(48, raw));

    // Magnetic Ground Snap when pulling any overhang underside (-y) down toward y = 0!
    if (face.dir === '-y' && clamped > 0) {
      const targetY = face.plane - clamped;
      if (targetY <= 1.65) {
        return Math.round(face.plane * 1000) / 1000;
      }
    }

    if (this.floorSnap && !altKey) {
      if (isVert) {
        if (Math.abs(clamped) < 0.85) return 0;
        const floors = Math.round(clamped / TYPICAL_FLOOR_HEIGHT);
        const signedFloors = floors === 0 ? Math.sign(clamped) : floors;
        const snapped = Math.round(signedFloors * TYPICAL_FLOOR_HEIGHT * 100) / 100;
        if (face.dir === '-y' && face.plane - snapped <= 1.2) {
          return Math.round(face.plane * 1000) / 1000;
        }
        return snapped;
      } else {
        if (Math.abs(clamped) < 0.45) return 0;
        return Math.round(clamped);
      }
    } else {
      if (Math.abs(clamped) < 0.25) return 0;
      const snapped = Math.round(clamped * 2) / 2;
      if (face.dir === '-y' && face.plane - snapped <= 0.6) {
        return Math.round(face.plane * 1000) / 1000;
      }
      return snapped;
    }
  }

  private formatPreviewLabel(face: MassingFace, delta: number, isSetback: boolean): string {
    const sign = delta >= 0 ? '+' : '';
    const isVert = face.dir === '+y' || face.dir === '-y';
    if (face.dir === '-y' && delta > 0 && Math.abs(face.plane - delta) < 0.05) {
      return `↓ ${delta.toFixed(1)}m · Snap to Ground (0.0m)`;
    }
    if (delta < 0) {
      return `${sign}${delta.toFixed(1)}m · Carve`;
    }
    if (isVert) {
      const fl = Math.round(delta / TYPICAL_FLOOR_HEIGHT);
      const flText =
        Math.abs(delta - fl * TYPICAL_FLOOR_HEIGHT) < 0.15 && fl > 0
          ? ` (${fl} ${fl === 1 ? 'Floor' : 'Floors'})`
          : '';
      return `${sign}${delta.toFixed(1)}m${flText}${isSetback ? ' · Setback' : ''}`;
    }
    return `${sign}${delta.toFixed(1)}m${isSetback ? ' · Setback' : ' · Extrude'}`;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.updatePointerNDC(e);

    const selected = this.faces.find((f) => f.id === this.selectedFaceId) ?? null;

    // 1. Grabbed the 3D Extrude Gizmo Arrow -> start drag immediately
    if (selected && (this.toolMode === 'extrude' || this.toolMode === 'setback') && this.raycastGizmo()) {
      this.startExtrudeDrag(selected, e);
      return;
    }

    // 2. Shift + Drag directly on the selected face also extrudes immediately
    if (selected && (this.toolMode === 'extrude' || this.toolMode === 'setback') && e.shiftKey) {
      const hit = this.raycastFaces();
      if (hit && hit.face.id === selected.id) {
        this.startExtrudeDrag(selected, e);
        return;
      }
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    this.updatePointerNDC(e);

    if (this.isDragging && this.dragFace) {
      let rawDelta = 0;
      if (!this.dragUseScreenFallback) {
        this.raycaster.setFromCamera(this.pointerNDC, this.camera);
        const curHit = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragPlane, curHit)) {
          rawDelta = curHit.sub(this.dragStartHit).dot(this.dragNormalVec);
        }
      } else {
        rawDelta = (this.pointerDownPos.y - e.clientY) * 0.08;
      }

      // Clamp downward -Y extrusion so it never goes below y = 0
      if (this.dragFace.dir === '-y' && rawDelta > this.dragFace.plane) {
        rawDelta = this.dragFace.plane;
      }

      const isSetback = this.toolMode === 'setback' || e.shiftKey;
      this.dragIsSetback = isSetback;
      const snapped = this.snapDelta(this.dragFace, rawDelta, e.altKey);
      this.dragCurrentDelta = snapped;

      this.rebuildDragPreview(this.dragFace, snapped, isSetback);

      const rect = this.container.getBoundingClientRect();
      const info: DragPreviewInfo = {
        active: true,
        delta: snapped,
        isSetback,
        isCarve: snapped < 0,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
        label:
          snapped === 0
            ? 'Drag outward to extrude / inward to carve'
            : this.formatPreviewLabel(this.dragFace, snapped, isSetback),
      };

      this.callbacks.onDragInfo(info);

      // Only regenerate the full PBR building when snapped extrusion delta/mode actually changes
      if ((snapped !== this.dragLastSnapped || isSetback !== this.dragLastSetback) && this.state) {
        this.dragLastSnapped = snapped;
        this.dragLastSetback = isSetback;
        if (Math.abs(snapped) >= 0.05) {
          const previewRes = applyExtrude(
            this.state,
            this.dragFace,
            snapped,
            isSetback && snapped > 0 ? SETBACK_MARGIN : 0
          );
          this.callbacks.onPreviewState(previewRes.state);
        } else {
          this.callbacks.onPreviewState(null);
        }
      }
      return;
    }

    // Hover detection for gizmo and faces
    const overGizmo =
      (this.toolMode === 'extrude' || this.toolMode === 'setback') && this.raycastGizmo();
    if (overGizmo !== this.gizmoHovered) {
      this.gizmoHovered = overGizmo;
      this.rebuildOverlaysAndGizmo();
    }

    if (overGizmo) {
      this.renderer.domElement.style.cursor = 'grab';
      return;
    }

    const hit = this.raycastFaces();
    const nextHoverId = hit ? hit.face.id : null;
    if (hit) {
      this.hoverHitPoint.copy(hit.point);
    }

    if (nextHoverId !== this.hoveredFaceId || (hit && this.toolMode === 'split')) {
      const changed = nextHoverId !== this.hoveredFaceId;
      this.hoveredFaceId = nextHoverId;
      this.rebuildOverlaysAndGizmo();
      if (changed) {
        this.callbacks.onHoverFace(hit ? hit.face : null);
      }
    }

    if (hit) {
      this.renderer.domElement.style.cursor =
        this.toolMode === 'split' || this.toolMode === 'inset' ? 'crosshair' : 'pointer';
    } else {
      this.renderer.domElement.style.cursor = 'default';
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.isDragging && this.dragFace) {
      const face = this.dragFace;
      const delta = this.dragCurrentDelta;
      const isSetback = this.dragIsSetback;

      this.isDragging = false;
      this.dragFace = null;
      this.controls.enabled = true;
      this.gizmoGroup.position.set(0, 0, 0);
      this.clearGroup(this.previewGroup, true);
      this.renderer.domElement.style.cursor = 'default';
      if (this.renderer.domElement.hasPointerCapture(e.pointerId)) {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      }

      this.callbacks.onPreviewState(null);
      this.callbacks.onDragInfo(null);

      if (Math.abs(delta) >= 0.05) {
        this.callbacks.onCommitExtrude(face, delta, isSetback && delta > 0 ? SETBACK_MARGIN : 0);
      }
      return;
    }

    // Check if it was a clean click (not an orbit drag)
    if (e.button !== 0) return;
    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist > 6) return;

    this.updatePointerNDC(e);
    const hit = this.raycastFaces();
    if (!hit) {
      if (this.selectedFaceId !== null) {
        this.selectedFaceId = null;
        this.rebuildOverlaysAndGizmo();
        this.callbacks.onSelectFace(null);
      }
      return;
    }

    if (this.toolMode === 'split') {
      const w = hit.face.width;
      const h = hit.face.height;
      const chosen: 'u' | 'v' | 'grid' =
        this.splitAxis === 'auto' ? (w >= h ? 'u' : 'v') : this.splitAxis;
      this.hoverHitPoint.copy(hit.point);
      const ratio = this.computeCursorSplitRatio(hit.face, chosen);
      this.callbacks.onCommitSplit(hit.face, chosen, ratio);
    } else if (this.toolMode === 'inset') {
      this.callbacks.onCommitInset(hit.face, SETBACK_MARGIN);
    } else {
      this.selectedFaceId = hit.face.id;
      this.rebuildOverlaysAndGizmo();
      this.callbacks.onSelectFace(hit.face);
    }
  };

  private bindEvents(): void {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  public getFaceSummary(face: MassingFace): string {
    return `${dirLabel(face.dir)} · ${face.width.toFixed(1)}×${face.height.toFixed(1)}m`;
  }

  public dispose(): void {
    this.disposed = true;
    this.resizeObserver.disconnect();
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerup', this.onPointerUp);
    this.clearGroup(this.massingGroup);
    this.clearGroup(this.overlayGroup, true);
    this.clearGroup(this.gizmoGroup, true);
    this.clearGroup(this.previewGroup, true);
    this.clayBaseMat.dispose();
    this.clayTierMat.dispose();
    this.clayLockedMat.dispose();
    this.hoverMat.dispose();
    this.selectMat.dispose();
    this.edgeLineMat.dispose();
    this.controls.dispose();
    if (this.initialized) {
      this.renderer.setAnimationLoop(null);
      this.renderer.dispose();
    }
    if (dom.parentElement) dom.parentElement.removeChild(dom);
  }
}
