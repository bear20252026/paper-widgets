import {
  BuildingStats,
  EPS,
  FaceDir,
  FaceSubdivision,
  GROUND_FLOOR_HEIGHT,
  MassingBox,
  MassingFace,
  MassingState,
  Rect2D,
  SplitAxis,
  TYPICAL_FLOOR_HEIGHT,
  Vec3,
} from './types';
import {
  dirToNormal,
  faceCenter3D,
  faceToCorners3D,
  mergeCoplanarRects2D,
  oppositeDir,
  rectsEqual,
  roundCoord,
  subtractRects2D,
} from './math2d';

let boxCounter = 1;
function nextBoxId(): string {
  return `box_${boxCounter++}`;
}

const ALL_DIRS: FaceDir[] = ['+y', '-y', '+z', '-z', '+x', '-x'];

/**
 * Default starting state: a clean architectural box sitting on y = 0.
 * 12m (W) x 7.8m (H: ground 4.2m + 1 upper floor 3.6m) x 10m (D).
 */
export function createDefaultMassing(): MassingState {
  boxCounter = 1;
  return {
    boxes: [
      {
        id: nextBoxId(),
        min: [-6, 0, -5],
        max: [6, roundCoord(GROUND_FLOOR_HEIGHT + TYPICAL_FLOOR_HEIGHT), 5],
        createdStep: 0,
      },
    ],
    subdivisions: [],
    step: 0,
  };
}

export function boxFacePlane(box: MassingBox, dir: FaceDir): number {
  switch (dir) {
    case '+x': return box.max[0];
    case '-x': return box.min[0];
    case '+y': return box.max[1];
    case '-y': return box.min[1];
    case '+z': return box.max[2];
    case '-z': return box.min[2];
  }
}

export function boxFaceRect(box: MassingBox, dir: FaceDir): Rect2D {
  switch (dir) {
    case '+z':
    case '-z':
      return { u0: box.min[0], u1: box.max[0], v0: box.min[1], v1: box.max[1] };
    case '+x':
    case '-x':
      return { u0: box.min[2], u1: box.max[2], v0: box.min[1], v1: box.max[1] };
    case '+y':
    case '-y':
      return { u0: box.min[0], u1: box.max[0], v0: box.min[2], v1: box.max[2] };
  }
}

function makeBoxFromFaceExtrude(
  dir: FaceDir,
  plane: number,
  rect: Rect2D,
  distance: number,
  createdStep: number
): MassingBox | null {
  if (Math.abs(distance) < 0.05) return null;

  const n = dirToNormal(dir);
  const wA = plane;
  let wB = roundCoord(plane + distance * (n[0] + n[1] + n[2]));

  // Prevent extruding underground (y < 0)
  if ((dir === '+y' || dir === '-y') && wB < 0) {
    wB = 0;
  }

  const wMin = roundCoord(Math.min(wA, wB));
  const wMax = roundCoord(Math.max(wA, wB));
  if (wMax - wMin < 0.05) return null;

  let min: Vec3;
  let max: Vec3;
  switch (dir) {
    case '+z':
    case '-z':
      min = [roundCoord(rect.u0), Math.max(0, roundCoord(rect.v0)), wMin];
      max = [roundCoord(rect.u1), roundCoord(rect.v1), wMax];
      break;
    case '+x':
    case '-x':
      min = [wMin, Math.max(0, roundCoord(rect.v0)), roundCoord(rect.u0)];
      max = [wMax, roundCoord(rect.v1), roundCoord(rect.u1)];
      break;
    case '+y':
    case '-y':
      min = [roundCoord(rect.u0), Math.max(0, wMin), roundCoord(rect.v0)];
      max = [roundCoord(rect.u1), wMax, roundCoord(rect.v1)];
      break;
  }

  if (max[0] - min[0] < 0.05 || max[1] - min[1] < 0.05 || max[2] - min[2] < 0.05) {
    return null;
  }

  return { id: nextBoxId(), min, max, createdStep };
}

/**
 * Exact 3D axis-aligned box subtraction: returns up to 6 disjoint boxes covering A \ B.
 */
export function subtractBox3D(a: MassingBox, b: MassingBox): MassingBox[] {
  if (
    b.max[0] <= a.min[0] + EPS ||
    b.min[0] >= a.max[0] - EPS ||
    b.max[1] <= a.min[1] + EPS ||
    b.min[1] >= a.max[1] - EPS ||
    b.max[2] <= a.min[2] + EPS ||
    b.min[2] >= a.max[2] - EPS
  ) {
    return [a];
  }

  const cx0 = roundCoord(Math.max(a.min[0], b.min[0]));
  const cx1 = roundCoord(Math.min(a.max[0], b.max[0]));
  const cy0 = roundCoord(Math.max(a.min[1], b.min[1]));
  const cy1 = roundCoord(Math.min(a.max[1], b.max[1]));
  const cz0 = roundCoord(Math.max(a.min[2], b.min[2]));
  const cz1 = roundCoord(Math.min(a.max[2], b.max[2]));

  const out: MassingBox[] = [];
  const push = (min: Vec3, max: Vec3) => {
    if (max[0] - min[0] > 0.04 && max[1] - min[1] > 0.04 && max[2] - min[2] > 0.04) {
      out.push({ id: nextBoxId(), min, max, createdStep: a.createdStep });
    }
  };

  if (cx0 - a.min[0] > EPS) push([a.min[0], a.min[1], a.min[2]], [cx0, a.max[1], a.max[2]]);
  if (a.max[0] - cx1 > EPS) push([cx1, a.min[1], a.min[2]], [a.max[0], a.max[1], a.max[2]]);
  if (cy0 - a.min[1] > EPS) push([cx0, a.min[1], a.min[2]], [cx1, cy0, a.max[2]]);
  if (a.max[1] - cy1 > EPS) push([cx0, cy1, a.min[2]], [cx1, a.max[1], a.max[2]]);
  if (cz0 - a.min[2] > EPS) push([cx0, cy0, a.min[2]], [cx1, cy1, cz0]);
  if (a.max[2] - cz1 > EPS) push([cx0, cy0, cz1], [cx1, cy1, a.max[2]]);

  return out;
}

function subtractBoxesFromBox(target: MassingBox, cutters: MassingBox[]): MassingBox[] {
  let pieces: MassingBox[] = [target];
  for (const cutter of cutters) {
    const next: MassingBox[] = [];
    for (const p of pieces) {
      next.push(...subtractBox3D(p, cutter));
    }
    pieces = next;
    if (pieces.length === 0) break;
  }
  return pieces;
}

/**
 * Merges vertically stacked boxes that share an identical horizontal (X, Z) footprint
 * when a downward extrusion snaps cleanly to y = 0 ground level.
 */
function mergeVerticalAlignedGroundDrop(boxes: MassingBox[]): MassingBox[] {
  const list = boxes.map((b) => ({ ...b, min: [...b.min] as Vec3, max: [...b.max] as Vec3 }));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const sameFootprint =
          Math.abs(a.min[0] - b.min[0]) < EPS &&
          Math.abs(a.max[0] - b.max[0]) < EPS &&
          Math.abs(a.min[2] - b.min[2]) < EPS &&
          Math.abs(a.max[2] - b.max[2]) < EPS;
        if (!sameFootprint) continue;

        const touches =
          Math.abs(a.max[1] - b.min[1]) < EPS || Math.abs(b.max[1] - a.min[1]) < EPS;
        const involvesGround = a.min[1] <= 0.05 || b.min[1] <= 0.05;
        if (touches && involvesGround) {
          list[i] = {
            id: nextBoxId(),
            min: [a.min[0], Math.min(a.min[1], b.min[1]), a.min[2]],
            max: [a.max[0], Math.max(a.max[1], b.max[1]), a.max[2]],
            createdStep: Math.max(a.createdStep, b.createdStep),
          };
          list.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return list;
}

function makeFaceId(boxId: string, dir: FaceDir, rect: Rect2D): string {
  return `${boxId}|${dir}|${rect.u0.toFixed(2)},${rect.u1.toFixed(2)},${rect.v0.toFixed(2)},${rect.v1.toFixed(2)}`;
}

/**
 * Computes every exposed, interactive CAD face from the current MassingState.
 * Internal faces where two boxes meet are automatically removed, while newly extruded
 * segments retain distinct selectable faces on their sides and caps.
 */
export function computeExposedFaces(state: MassingState): MassingFace[] {
  const faces: MassingFace[] = [];

  for (const box of state.boxes) {
    for (const dir of ALL_DIRS) {
      const plane = boxFacePlane(box, dir);
      const sub = state.subdivisions.find((s) => s.boxId === box.id && s.dir === dir);
      const baseRects: Rect2D[] = sub ? sub.rects : [boxFaceRect(box, dir)];

      const opp = oppositeDir(dir);
      const cutters: Rect2D[] = [];
      for (const other of state.boxes) {
        if (other.id === box.id) continue;
        if (Math.abs(boxFacePlane(other, opp) - plane) < EPS) {
          cutters.push(boxFaceRect(other, opp));
        }
      }

      const exposedRects = subtractRects2D(baseRects, cutters);
      const normal = dirToNormal(dir);
      const locked = dir === '-y' && Math.abs(plane) < EPS;

      for (const rect of exposedRects) {
        faces.push({
          id: makeFaceId(box.id, dir, rect),
          boxId: box.id,
          dir,
          plane,
          rect,
          normal,
          corners: faceToCorners3D(dir, plane, rect),
          center: faceCenter3D(dir, plane, rect),
          width: roundCoord(rect.u1 - rect.u0),
          height: roundCoord(rect.v1 - rect.v0),
          locked,
          createdStep: box.createdStep,
        });
      }
    }
  }

  return faces;
}

export interface MergedExteriorPatch {
  dir: FaceDir;
  plane: number;
  rect: Rect2D;
}

/**
 * Computes clean merged exterior surfaces (grouped by plane & direction)
 * specifically for the PBR Building Generator so flush stacked tiers share
 * seamless continuous facades and floor alignments without double-seams.
 */
export function computeMergedExteriorPatches(state: MassingState): MergedExteriorPatch[] {
  const rawFaces = computeExposedFaces(state);
  const groups = new Map<string, { dir: FaceDir; plane: number; rects: Rect2D[] }>();

  for (const f of rawFaces) {
    if (f.locked) continue;
    const key = `${f.dir}|${f.plane.toFixed(3)}`;
    let g = groups.get(key);
    if (!g) {
      g = { dir: f.dir, plane: f.plane, rects: [] };
      groups.set(key, g);
    }
    g.rects.push(f.rect);
  }

  const patches: MergedExteriorPatch[] = [];
  for (const g of groups.values()) {
    const merged = mergeCoplanarRects2D(g.rects);
    for (const rect of merged) {
      patches.push({ dir: g.dir, plane: g.plane, rect });
    }
  }
  return patches;
}

/**
 * Computes inset rectangle inside a given face rect.
 */
export function computeInsetRect(rect: Rect2D, margin: number): Rect2D | null {
  const w = rect.u1 - rect.u0;
  const h = rect.v1 - rect.v0;
  const safeMargin = Math.min(margin, w * 0.35, h * 0.35);
  if (safeMargin < 0.25 || w - 2 * safeMargin < 1.2 || h - 2 * safeMargin < 1.2) {
    return null;
  }
  return {
    u0: roundCoord(rect.u0 + safeMargin),
    u1: roundCoord(rect.u1 - safeMargin),
    v0: roundCoord(rect.v0 + safeMargin),
    v1: roundCoord(rect.v1 - safeMargin),
  };
}

/**
 * Extrudes a face outward (distance > 0, additive) or inward (distance < 0, subtractive carve).
 * Returns the new immutable state and optionally the preferred newly created cap face id.
 */
export function applyExtrude(
  state: MassingState,
  face: MassingFace,
  distance: number,
  insetMargin = 0
): { state: MassingState; newFaceId: string | null } {
  if (face.locked || Math.abs(distance) < 0.05) {
    return { state, newFaceId: face.id };
  }

  let activeRect = face.rect;
  if (insetMargin > 0) {
    const inner = computeInsetRect(face.rect, insetMargin);
    if (!inner) return { state, newFaceId: face.id };
    activeRect = inner;
  }

  const nextStep = state.step + 1;

  if (distance > 0) {
    const candidate = makeBoxFromFaceExtrude(face.dir, face.plane, activeRect, distance, nextStep);
    if (!candidate) return { state, newFaceId: face.id };

    const newPieces = subtractBoxesFromBox(candidate, state.boxes);
    if (newPieces.length === 0) return { state, newFaceId: face.id };

    let nextBoxes = [...state.boxes, ...newPieces];
    let primary = newPieces[0];
    let newFaceId: string | null = null;

    // When extruding an overhang (-y) all the way down to ground (y = 0), merge seamlessly
    // with any box directly above that shares the exact same horizontal footprint so it becomes
    // one clean unified full-height block instead of stacked segments.
    if (face.dir === '-y' && newPieces.some((p) => p.min[1] <= 0.05)) {
      nextBoxes = mergeVerticalAlignedGroundDrop(nextBoxes);
      const mergedMatch = nextBoxes.find(
        (b) =>
          b.min[1] <= 0.05 &&
          Math.abs(b.min[0] - primary.min[0]) < EPS &&
          Math.abs(b.max[0] - primary.max[0]) < EPS &&
          Math.abs(b.min[2] - primary.min[2]) < EPS &&
          Math.abs(b.max[2] - primary.max[2]) < EPS
      );
      if (mergedMatch) {
        // Select the top face of the unified block since its bottom is now locked at ground y=0
        newFaceId = makeFaceId(mergedMatch.id, '+y', boxFaceRect(mergedMatch, '+y'));
      }
    }

    const validIds = new Set(nextBoxes.map((b) => b.id));
    const nextSubs = state.subdivisions.filter((s) => validIds.has(s.boxId));

    const newState: MassingState = {
      boxes: nextBoxes,
      subdivisions: nextSubs,
      step: nextStep,
    };

    if (!newFaceId) {
      const capRect = boxFaceRect(primary, face.dir);
      newFaceId =
        face.dir === '-y' && primary.min[1] <= 0.05
          ? null
          : makeFaceId(primary.id, face.dir, capRect);
    }
    return { state: newState, newFaceId };
  } else {
    // Subtractive carve / push inward
    const cutBox = makeBoxFromFaceExtrude(face.dir, face.plane, activeRect, distance, nextStep);
    if (!cutBox) return { state, newFaceId: face.id };

    const nextBoxes: MassingBox[] = [];
    for (const b of state.boxes) {
      nextBoxes.push(...subtractBox3D(b, cutBox));
    }

    // Prevent completely erasing the building
    const totalVol = nextBoxes.reduce(
      (acc, b) =>
        acc + (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * (b.max[2] - b.min[2]),
      0
    );
    if (nextBoxes.length === 0 || totalVol < 6) {
      return { state, newFaceId: face.id };
    }

    const validBoxIds = new Set(nextBoxes.map((b) => b.id));
    const nextSubs = state.subdivisions.filter((s) => validBoxIds.has(s.boxId));

    const newState: MassingState = {
      boxes: nextBoxes,
      subdivisions: nextSubs,
      step: nextStep,
    };

    return { state: newState, newFaceId: null };
  }
}

/**
 * Splits a single face into 2 (or 4 for grid) independent sub-faces without changing 3D volume.
 */
export function applySplitFace(
  state: MassingState,
  face: MassingFace,
  axis: SplitAxis = 'auto',
  ratio = 0.5
): { state: MassingState; newFaceId: string | null } {
  if (face.locked) return { state, newFaceId: face.id };

  const clampedRatio = Math.max(0.15, Math.min(0.85, ratio));
  const w = face.rect.u1 - face.rect.u0;
  const h = face.rect.v1 - face.rect.v0;

  let chosen: 'u' | 'v' | 'grid' = axis === 'auto' ? (w >= h ? 'u' : 'v') : axis;
  if (chosen === 'u' && w < 2.0) chosen = 'v';
  if (chosen === 'v' && h < 2.0) chosen = 'u';
  if (chosen === 'grid' && (w < 2.4 || h < 2.4)) chosen = w >= h ? 'u' : 'v';

  const newRects: Rect2D[] = [];
  if (chosen === 'u') {
    if (w < 1.6) return { state, newFaceId: face.id };
    const midU = roundCoord(face.rect.u0 + w * clampedRatio);
    newRects.push(
      { u0: face.rect.u0, u1: midU, v0: face.rect.v0, v1: face.rect.v1 },
      { u0: midU, u1: face.rect.u1, v0: face.rect.v0, v1: face.rect.v1 }
    );
  } else if (chosen === 'v') {
    if (h < 1.6) return { state, newFaceId: face.id };
    const midV = roundCoord(face.rect.v0 + h * clampedRatio);
    newRects.push(
      { u0: face.rect.u0, u1: face.rect.u1, v0: face.rect.v0, v1: midV },
      { u0: face.rect.u0, u1: face.rect.u1, v0: midV, v1: face.rect.v1 }
    );
  } else {
    const midU = roundCoord(face.rect.u0 + w * 0.5);
    const midV = roundCoord(face.rect.v0 + h * 0.5);
    newRects.push(
      { u0: face.rect.u0, u1: midU, v0: face.rect.v0, v1: midV },
      { u0: midU, u1: face.rect.u1, v0: face.rect.v0, v1: midV },
      { u0: face.rect.u0, u1: midU, v0: midV, v1: face.rect.v1 },
      { u0: midU, u1: face.rect.u1, v0: midV, v1: face.rect.v1 }
    );
  }

  return replaceFaceRectWithSubRects(state, face, newRects, newRects[0]);
}

/**
 * Insets a face, creating 1 centered inner face + 4 surrounding axis-aligned border strips.
 */
export function applyInsetFace(
  state: MassingState,
  face: MassingFace,
  margin = 1.8
): { state: MassingState; newFaceId: string | null } {
  if (face.locked) return { state, newFaceId: face.id };

  const inner = computeInsetRect(face.rect, margin);
  if (!inner) return { state, newFaceId: face.id };

  const border = subtractRects2D([face.rect], [inner]);
  const allParts = [inner, ...border];
  return replaceFaceRectWithSubRects(state, face, allParts, inner);
}

function replaceFaceRectWithSubRects(
  state: MassingState,
  face: MassingFace,
  replacementRects: Rect2D[],
  focusRect: Rect2D
): { state: MassingState; newFaceId: string | null } {
  const parentBox = state.boxes.find((b) => b.id === face.boxId);
  if (!parentBox) return { state, newFaceId: face.id };

  const existingIdx = state.subdivisions.findIndex(
    (s) => s.boxId === face.boxId && s.dir === face.dir
  );

  let currentRects: Rect2D[];
  if (existingIdx >= 0) {
    currentRects = state.subdivisions[existingIdx].rects;
  } else {
    // Reconstruct exposed base rects for this face if other boxes partially covered it
    const opp = oppositeDir(face.dir);
    const cutters = state.boxes
      .filter((o) => o.id !== parentBox.id && Math.abs(boxFacePlane(o, opp) - face.plane) < EPS)
      .map((o) => boxFaceRect(o, opp));
    currentRects = subtractRects2D([boxFaceRect(parentBox, face.dir)], cutters);
  }

  const nextRects: Rect2D[] = [];
  let replaced = false;
  for (const r of currentRects) {
    if (!replaced && rectsEqual(r, face.rect, 0.02)) {
      nextRects.push(...replacementRects);
      replaced = true;
    } else {
      nextRects.push(r);
    }
  }
  if (!replaced) {
    // Fallback: subtract face.rect and append replacements
    const remainder = subtractRects2D(currentRects, [face.rect]);
    nextRects.length = 0;
    nextRects.push(...remainder, ...replacementRects);
  }

  const nextSub: FaceSubdivision = {
    boxId: face.boxId,
    dir: face.dir,
    rects: nextRects,
  };

  const nextSubs =
    existingIdx >= 0
      ? state.subdivisions.map((s, i) => (i === existingIdx ? nextSub : s))
      : [...state.subdivisions, nextSub];

  return {
    state: {
      ...state,
      subdivisions: nextSubs,
      step: state.step + 1,
    },
    newFaceId: makeFaceId(face.boxId, face.dir, focusRect),
  };
}

/**
 * Computes architectural metrics (height, floor count, GFA, footprint, volume).
 */
export function computeBuildingStats(state: MassingState, faceCount: number): BuildingStats {
  let maxY = 0;
  let volume = 0;
  let footprintArea = 0;
  let grossFloorArea = 0;

  for (const b of state.boxes) {
    const dx = b.max[0] - b.min[0];
    const dy = b.max[1] - b.min[1];
    const dz = b.max[2] - b.min[2];
    const area = dx * dz;
    maxY = Math.max(maxY, b.max[1]);
    volume += dx * dy * dz;

    if (b.min[1] < 0.1) {
      footprintArea += area;
    }

    // Count architectural floor levels intersecting this box volume
    const floorElevations = getFloorElevationsUpTo(b.max[1]);
    for (const fy of floorElevations) {
      if (fy >= b.min[1] - 0.15 && fy < b.max[1] - 1.5) {
        grossFloorArea += area;
      }
    }
  }

  const floors = Math.max(
    1,
    maxY <= GROUND_FLOOR_HEIGHT + 0.4
      ? 1
      : 1 + Math.round((maxY - GROUND_FLOOR_HEIGHT) / TYPICAL_FLOOR_HEIGHT)
  );

  return {
    totalHeight: roundCoord(maxY),
    floors,
    grossFloorArea: Math.round(grossFloorArea),
    footprintArea: Math.round(footprintArea),
    volume: Math.round(volume),
    faceCount,
    boxCount: state.boxes.length,
  };
}

export function getFloorElevationsUpTo(maxHeight: number): number[] {
  const levels: number[] = [0];
  let y = GROUND_FLOOR_HEIGHT;
  while (y < maxHeight - 0.2) {
    levels.push(roundCoord(y));
    y += TYPICAL_FLOOR_HEIGHT;
  }
  return levels;
}

/**
 * Architectural massing presets (all built strictly from the exact same programmatic extrude ops!)
 */
export function createPresetMassing(
  preset: 'box' | 'stepped-tower' | 'cantilever-pavilion' | 'courtyard-complex'
): MassingState {
  if (preset === 'box') return createDefaultMassing();

  let state = createDefaultMassing();

  if (preset === 'stepped-tower') {
    // Base podium (12 x 7.8 x 10) -> extrude right wing -> inset top -> extrude tower -> setback crown
    let faces = computeExposedFaces(state);
    const rightWall = faces.find((f) => f.dir === '+x')!;
    state = applyExtrude(state, rightWall, 6).state;

    faces = computeExposedFaces(state);
    const leftTop = faces.find((f) => f.dir === '+y' && f.center[0] < 3)!;
    state = applyExtrude(state, leftTop, TYPICAL_FLOOR_HEIGHT * 2, 1.5).state;

    faces = computeExposedFaces(state);
    const midTop = faces
      .filter((f) => f.dir === '+y')
      .sort((a, b) => b.plane - a.plane)[0];
    state = applyExtrude(state, midTop, TYPICAL_FLOOR_HEIGHT * 3, 1.4).state;
    return state;
  }

  if (preset === 'cantilever-pavilion') {
    // Base -> extrude up 2 floors -> extrude dramatic cantilever +X -> extrude tower on cantilever + opposite -Z wing
    let faces = computeExposedFaces(state);
    const top = faces.find((f) => f.dir === '+y')!;
    state = applyExtrude(state, top, TYPICAL_FLOOR_HEIGHT * 2).state;

    faces = computeExposedFaces(state);
    const upperEast = faces.find((f) => f.dir === '+x' && f.center[1] > 8)!;
    state = applyExtrude(state, upperEast, 7).state;

    faces = computeExposedFaces(state);
    const cantTop = faces.find((f) => f.dir === '+y' && f.center[0] > 6)!;
    state = applyExtrude(state, cantTop, TYPICAL_FLOOR_HEIGHT * 2, 1.2).state;

    faces = computeExposedFaces(state);
    const lowerWest = faces.find((f) => f.dir === '-x' && f.center[1] < 8)!;
    state = applyExtrude(state, lowerWest, 5).state;
    return state;
  }

  // courtyard-complex: L-wing + bridged upper skyway + twin terraced cores
  let faces = computeExposedFaces(state);
  const south = faces.find((f) => f.dir === '+z')!;
  state = applyExtrude(state, south, 4).state;

  faces = computeExposedFaces(state);
  const east = faces.find((f) => f.dir === '+x' && f.center[2] < 2)!;
  state = applyExtrude(state, east, 7).state;

  faces = computeExposedFaces(state);
  const eastTop = faces.find((f) => f.dir === '+y' && f.center[0] > 6)!;
  state = applyExtrude(state, eastTop, TYPICAL_FLOOR_HEIGHT * 3).state;

  faces = computeExposedFaces(state);
  const mainTop = faces.find((f) => f.dir === '+y' && f.center[0] < 4 && f.center[2] < 4)!;
  state = applyExtrude(state, mainTop, TYPICAL_FLOOR_HEIGHT * 2, 1.5).state;

  // Carve a dramatic sky-terrace notch into the south podium
  faces = computeExposedFaces(state);
  const southPodiumTop = faces.find((f) => f.dir === '+y' && f.center[2] > 5)!;
  if (southPodiumTop) {
    state = applyExtrude(state, southPodiumTop, -TYPICAL_FLOOR_HEIGHT).state;
  }

  return state;
}
