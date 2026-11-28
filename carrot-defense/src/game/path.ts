import type { Path, PathSample, Vec2 } from "./types";

/** 由世界坐标点序列创建路径(预计算累计长度)。 */
export function createPath(points: Vec2[]): Path {
  if (points.length < 2) throw new Error("路径至少需要 2 个点");
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    cumulative.push(cumulative[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return {
    points: points.map((p) => ({ x: p.x, y: p.y })),
    cumulative,
    length: cumulative[cumulative.length - 1],
  };
}

/** 由格子坐标路径点创建路径(取格子中心)。 */
export function createPathFromCells(waypoints: Array<[number, number]>): Path {
  return createPath(waypoints.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 })));
}

/** 从起点到终点的直线路径(飞行怪使用)。 */
export function straightPath(path: Path): Path {
  return createPath([path.points[0], path.points[path.points.length - 1]]);
}

/** 沿路径行走 distance 后的位置、朝向与进度;distance 会被夹在 [0, length]。 */
export function samplePath(path: Path, distance: number): PathSample {
  const d = Math.min(Math.max(distance, 0), path.length);
  const n = path.points.length;
  let i = 1;
  while (i < n - 1 && path.cumulative[i] < d) i++;
  const a = path.points[i - 1];
  const b = path.points[i];
  const segLen = path.cumulative[i] - path.cumulative[i - 1];
  const t = segLen > 0 ? (d - path.cumulative[i - 1]) / segLen : 0;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: Math.atan2(b.y - a.y, b.x - a.x),
    progress: path.length > 0 ? d / path.length : 1,
  };
}

/** 进度 0..1。 */
export function pathProgress(path: Path, distance: number): number {
  return path.length > 0 ? Math.min(Math.max(distance / path.length, 0), 1) : 1;
}

/** 把格子路径点光栅化为经过的所有格子(仅支持水平/垂直线段)。 */
export function rasterizeCells(
  waypoints: Array<[number, number]>,
): Array<[number, number]> {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  const add = (c: number, r: number) => {
    const key = `${c},${r}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push([c, r]);
    }
  };
  if (waypoints.length === 1) add(waypoints[0][0], waypoints[0][1]);
  for (let i = 1; i < waypoints.length; i++) {
    const [c0, r0] = waypoints[i - 1];
    const [c1, r1] = waypoints[i];
    if (c0 !== c1 && r0 !== r1) {
      throw new Error(`路径段必须水平或垂直: (${c0},${r0}) -> (${c1},${r1})`);
    }
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    let c = c0;
    let r = r0;
    add(c, r);
    while (c !== c1 || r !== r1) {
      c += dc;
      r += dr;
      add(c, r);
    }
  }
  return out;
}
