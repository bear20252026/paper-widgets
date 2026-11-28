import { EPS, FaceDir, Rect2D, Vec3 } from './types';

export function roundCoord(val: number): number {
  return Math.round(val * 1000) / 1000;
}

export function oppositeDir(dir: FaceDir): FaceDir {
  switch (dir) {
    case '+x': return '-x';
    case '-x': return '+x';
    case '+y': return '-y';
    case '-y': return '+y';
    case '+z': return '-z';
    case '-z': return '+z';
  }
}

export function dirToNormal(dir: FaceDir): Vec3 {
  switch (dir) {
    case '+x': return [1, 0, 0];
    case '-x': return [-1, 0, 0];
    case '+y': return [0, 1, 0];
    case '-y': return [0, -1, 0];
    case '+z': return [0, 0, 1];
    case '-z': return [0, 0, -1];
  }
}

export function dirLabel(dir: FaceDir): string {
  switch (dir) {
    case '+y': return 'Roof / Top';
    case '-y': return 'Soffit / Underside';
    case '+z': return 'South Facade';
    case '-z': return 'North Facade';
    case '+x': return 'East Facade';
    case '-x': return 'West Facade';
  }
}

export function rectArea(r: Rect2D): number {
  return Math.max(0, r.u1 - r.u0) * Math.max(0, r.v1 - r.v0);
}

export function rectsEqual(a: Rect2D, b: Rect2D, eps = EPS): boolean {
  return (
    Math.abs(a.u0 - b.u0) < eps &&
    Math.abs(a.u1 - b.u1) < eps &&
    Math.abs(a.v0 - b.v0) < eps &&
    Math.abs(a.v1 - b.v1) < eps
  );
}

/**
 * Exact 2D axis-aligned rectangle subtraction: returns disjoint rectangles covering A \ B.
 */
export function subtractRect2D(a: Rect2D, b: Rect2D): Rect2D[] {
  if (
    b.u1 <= a.u0 + EPS ||
    b.u0 >= a.u1 - EPS ||
    b.v1 <= a.v0 + EPS ||
    b.v0 >= a.v1 - EPS
  ) {
    return [a];
  }

  const cu0 = Math.max(a.u0, b.u0);
  const cu1 = Math.min(a.u1, b.u1);
  const cv0 = Math.max(a.v0, b.v0);
  const cv1 = Math.min(a.v1, b.v1);

  const out: Rect2D[] = [];
  if (cv0 - a.v0 > EPS) {
    out.push({ u0: a.u0, u1: a.u1, v0: a.v0, v1: roundCoord(cv0) });
  }
  if (a.v1 - cv1 > EPS) {
    out.push({ u0: a.u0, u1: a.u1, v0: roundCoord(cv1), v1: a.v1 });
  }
  if (cu0 - a.u0 > EPS) {
    out.push({ u0: a.u0, u1: roundCoord(cu0), v0: roundCoord(cv0), v1: roundCoord(cv1) });
  }
  if (a.u1 - cu1 > EPS) {
    out.push({ u0: roundCoord(cu1), u1: a.u1, v0: roundCoord(cv0), v1: roundCoord(cv1) });
  }
  return out;
}

export function subtractRects2D(base: Rect2D[], cutters: Rect2D[]): Rect2D[] {
  let current = base;
  for (const cutter of cutters) {
    const next: Rect2D[] = [];
    for (const r of current) {
      next.push(...subtractRect2D(r, cutter));
    }
    current = next;
    if (current.length === 0) break;
  }
  return current.filter((r) => r.u1 - r.u0 > 0.04 && r.v1 - r.v0 > 0.04);
}

/**
 * Merges adjacent coplanar rectangles that share an exact full edge.
 * Ideal for building continuous architectural facades & roof slabs without internal seams.
 */
export function mergeCoplanarRects2D(rects: Rect2D[]): Rect2D[] {
  const list = rects.map((r) => ({ ...r }));
  let merged = true;

  while (merged) {
    merged = false;
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];

        // Same V span, adjacent along U
        if (Math.abs(a.v0 - b.v0) < EPS && Math.abs(a.v1 - b.v1) < EPS) {
          if (Math.abs(a.u1 - b.u0) < EPS) {
            list[i] = { u0: a.u0, u1: b.u1, v0: a.v0, v1: a.v1 };
            list.splice(j, 1);
            merged = true;
            break outer;
          }
          if (Math.abs(b.u1 - a.u0) < EPS) {
            list[i] = { u0: b.u0, u1: a.u1, v0: a.v0, v1: a.v1 };
            list.splice(j, 1);
            merged = true;
            break outer;
          }
        }

        // Same U span, adjacent along V
        if (Math.abs(a.u0 - b.u0) < EPS && Math.abs(a.u1 - b.u1) < EPS) {
          if (Math.abs(a.v1 - b.v0) < EPS) {
            list[i] = { u0: a.u0, u1: a.u1, v0: a.v0, v1: b.v1 };
            list.splice(j, 1);
            merged = true;
            break outer;
          }
          if (Math.abs(b.v1 - a.v0) < EPS) {
            list[i] = { u0: a.u0, u1: a.u1, v0: b.v0, v1: a.v1 };
            list.splice(j, 1);
            merged = true;
            break outer;
          }
        }
      }
    }
  }
  return list;
}

/**
 * Converts a canonical (dir, plane, rect) into 4 CCW world-space 3D corners.
 */
export function faceToCorners3D(
  dir: FaceDir,
  plane: number,
  r: Rect2D
): [Vec3, Vec3, Vec3, Vec3] {
  const { u0, u1, v0, v1 } = r;
  switch (dir) {
    case '+z':
      return [
        [u0, v0, plane],
        [u1, v0, plane],
        [u1, v1, plane],
        [u0, v1, plane],
      ];
    case '-z':
      return [
        [u1, v0, plane],
        [u0, v0, plane],
        [u0, v1, plane],
        [u1, v1, plane],
      ];
    case '+x':
      return [
        [plane, v0, u1],
        [plane, v0, u0],
        [plane, v1, u0],
        [plane, v1, u1],
      ];
    case '-x':
      return [
        [plane, v0, u0],
        [plane, v0, u1],
        [plane, v1, u1],
        [plane, v1, u0],
      ];
    case '+y':
      return [
        [u0, plane, v1],
        [u1, plane, v1],
        [u1, plane, v0],
        [u0, plane, v0],
      ];
    case '-y':
      return [
        [u0, plane, v0],
        [u1, plane, v0],
        [u1, plane, v1],
        [u0, plane, v1],
      ];
  }
}

export function faceCenter3D(dir: FaceDir, plane: number, r: Rect2D): Vec3 {
  const cu = (r.u0 + r.u1) * 0.5;
  const cv = (r.v0 + r.v1) * 0.5;
  switch (dir) {
    case '+z':
    case '-z':
      return [cu, cv, plane];
    case '+x':
    case '-x':
      return [plane, cv, cu];
    case '+y':
    case '-y':
      return [cu, plane, cv];
  }
}

export function worldPointToFaceUV(dir: FaceDir, pt: Vec3): [number, number] {
  switch (dir) {
    case '+z':
    case '-z':
      return [pt[0], pt[1]];
    case '+x':
    case '-x':
      return [pt[2], pt[1]];
    case '+y':
    case '-y':
      return [pt[0], pt[2]];
  }
}
