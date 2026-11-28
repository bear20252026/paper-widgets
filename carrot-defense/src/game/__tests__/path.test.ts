import { describe, expect, it } from "vitest";
import {
  createPath,
  createPathFromCells,
  pathProgress,
  rasterizeCells,
  samplePath,
  straightPath,
} from "../path";

describe("path", () => {
  const path = createPath([
    { x: 0.5, y: 0.5 },
    { x: 4.5, y: 0.5 },
    { x: 4.5, y: 3.5 },
  ]);

  it("累计长度正确", () => {
    expect(path.length).toBeCloseTo(7, 6);
    expect(path.cumulative).toEqual([0, 4, 7]);
  });

  it("插值位置正确(直线段内)", () => {
    const p = samplePath(path, 2);
    expect(p.x).toBeCloseTo(2.5, 6);
    expect(p.y).toBeCloseTo(0.5, 6);
    expect(p.angle).toBeCloseTo(0, 6);
  });

  it("拐点与第二段内的位置正确", () => {
    const corner = samplePath(path, 4);
    expect(corner.x).toBeCloseTo(4.5, 6);
    expect(corner.y).toBeCloseTo(0.5, 6);
    const second = samplePath(path, 5.5);
    expect(second.x).toBeCloseTo(4.5, 6);
    expect(second.y).toBeCloseTo(2.0, 6);
    expect(second.angle).toBeCloseTo(Math.PI / 2, 6);
  });

  it("距离被夹在 [0, length],进度 0..1", () => {
    expect(samplePath(path, -3).x).toBeCloseTo(0.5, 6);
    const end = samplePath(path, 99);
    expect(end.x).toBeCloseTo(4.5, 6);
    expect(end.y).toBeCloseTo(3.5, 6);
    expect(end.progress).toBe(1);
    expect(pathProgress(path, 3.5)).toBeCloseTo(0.5, 6);
  });

  it("格子路径点取格子中心,飞行直线路径连接起点与终点", () => {
    const p = createPathFromCells([[0, 1], [3, 1], [3, 4]]);
    expect(p.points[0]).toEqual({ x: 0.5, y: 1.5 });
    const air = straightPath(p);
    expect(air.points).toHaveLength(2);
    expect(air.length).toBeCloseTo(Math.hypot(3, 3), 6);
  });

  it("光栅化覆盖所有经过的格子且不含重复;斜线抛错", () => {
    const cells = rasterizeCells([[0, 0], [2, 0], [2, 2]]);
    expect(cells).toEqual([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]);
    expect(() => rasterizeCells([[0, 0], [2, 2]])).toThrow();
  });
});
