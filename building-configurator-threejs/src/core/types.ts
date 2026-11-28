export type FaceDir = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

export type Vec3 = [number, number, number];

export interface Rect2D {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export interface MassingBox {
  id: string;
  min: Vec3;
  max: Vec3;
  createdStep: number;
}

export interface FaceSubdivision {
  boxId: string;
  dir: FaceDir;
  rects: Rect2D[];
}

export interface MassingFace {
  /** Deterministic identifier for selection & picking */
  id: string;
  boxId: string;
  dir: FaceDir;
  /** Plane coordinate along the normal axis */
  plane: number;
  /** 2D rectangle in canonical world coordinates for this axis */
  rect: Rect2D;
  /** Outward unit normal */
  normal: Vec3;
  /** 4 corner points in CCW winding order looking from outside */
  corners: [Vec3, Vec3, Vec3, Vec3];
  /** World-space center of the face */
  center: Vec3;
  /** Width along U axis (m) */
  width: number;
  /** Height/Depth along V axis (m) */
  height: number;
  /** True for ground-contact bottom faces at y = 0 */
  locked: boolean;
  /** Generation step when the parent box was created */
  createdStep: number;
}

export interface MassingState {
  boxes: MassingBox[];
  subdivisions: FaceSubdivision[];
  step: number;
}

export type ToolMode = 'extrude' | 'setback' | 'split' | 'inset';

export type SplitAxis = 'auto' | 'u' | 'v' | 'grid';

export type ArchitecturalStyle = 'contemporary' | 'brick-loft' | 'travertine-bronze';

export type LightingPreset = 'golden-hour' | 'daylight' | 'twilight';

export interface BuildingStats {
  totalHeight: number;
  floors: number;
  grossFloorArea: number;
  footprintArea: number;
  volume: number;
  faceCount: number;
  boxCount: number;
}

export interface DragPreviewInfo {
  active: boolean;
  delta: number;
  isSetback: boolean;
  isCarve: boolean;
  screenX: number;
  screenY: number;
  label: string;
}

export const GROUND_FLOOR_HEIGHT = 4.2;
export const TYPICAL_FLOOR_HEIGHT = 3.6;
export const EPS = 1e-4;
