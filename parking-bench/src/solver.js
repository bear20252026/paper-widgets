/**
 * src/solver.js — Physical 6x6 Tabletop Board Collision & Bounds Kinematics ONLY
 * Project: Parking Bench — Human vs. Gemini AI 6x6 Visual Spatial Race (hydrogen-parking-bench)
 *
 * STRICT ANTI-CHEAT GUARANTEE:
 *   This file contains ZERO solver, ZERO BFS/A* search, and ZERO move-planning heuristics.
 *   It enforces ONLY physical 6x6 tabletop board laws:
 *     1. 6x6 grid bounds (A–F × 1–6), non-overlapping stalls, and exclusive Rosso Corsa hero rules (`validateBoard`).
 *     2. Contiguous bumper-to-bumper physical slide stops (`computeSlideBounds`).
 *     3. Coordinate lookup (`findVehicleAtCoord`) and Row 3 (`F3`) East exit gate clearance (`isExitCorridorClear`).
 */

import {
  GRID_SPEC,
  VEHICLE_CLASSES,
  CURATED_FINISHES,
  parseGridCoord,
  formatGridCoord,
} from "./contract.js";

export function validateBoard(
  cars,
  gridSize = GRID_SPEC.gridSize,
  exitRow = GRID_SPEC.exitRow
) {
  if (!Array.isArray(cars) || cars.length === 0) {
    throw new Error("[BoardPhysics] Board must contain at least one vehicle.");
  }

  const seenIds = new Set();
  const grid = new Array(gridSize * gridSize).fill(null);
  let targetCar = null;

  for (const car of cars) {
    if (!car || !car.id) {
      throw new Error("[BoardPhysics] Vehicle is missing an id.");
    }
    if (seenIds.has(car.id)) {
      throw new Error(`[BoardPhysics] Duplicate vehicle id "${car.id}".`);
    }
    seenIds.add(car.id);

    const vClass = VEHICLE_CLASSES[car.vehicleClass];
    if (!vClass) {
      throw new Error(`[BoardPhysics] Unknown vehicleClass "${car.vehicleClass}" on "${car.id}".`);
    }
    if (car.length !== vClass.gridLength) {
      throw new Error(
        `[BoardPhysics] Vehicle "${car.id}" length (${car.length}) != class "${car.vehicleClass}" (${vClass.gridLength}).`
      );
    }
    if (!CURATED_FINISHES[car.finishKey]) {
      throw new Error(`[BoardPhysics] Unknown finishKey "${car.finishKey}" on "${car.id}".`);
    }
    if (car.orientation !== "h" && car.orientation !== "v") {
      throw new Error(`[BoardPhysics] Invalid orientation "${car.orientation}" on "${car.id}".`);
    }

    const r0 = car.row;
    const c0 = car.col;
    if (!Number.isInteger(r0) || !Number.isInteger(c0)) {
      throw new Error(`[BoardPhysics] Non-integer grid coordinates on "${car.id}" (${r0}, ${c0}).`);
    }

    for (let s = 0; s < car.length; s++) {
      const r = car.orientation === "v" ? r0 + s : r0;
      const c = car.orientation === "h" ? c0 + s : c0;
      if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
        throw new Error(
          `[BoardPhysics] Vehicle "${car.id}" out of ${gridSize}x${gridSize} bounds at (${r}, ${c}).`
        );
      }
      const idx = r * gridSize + c;
      if (grid[idx] !== null) {
        throw new Error(
          `[BoardPhysics] Cell overlap at (${r}, ${c}) between "${grid[idx]}" and "${car.id}".`
        );
      }
      grid[idx] = car.id;
    }

    if (car.id === "target") {
      targetCar = car;
    } else if (car.finishKey === "rosso_corsa") {
      throw new Error(
        `[BoardPhysics] Finish "rosso_corsa" is reserved exclusively for "target", found on "${car.id}".`
      );
    }
  }

  if (!targetCar) {
    throw new Error('[BoardPhysics] Board is missing hero vehicle with id "target".');
  }
  if (
    targetCar.row !== exitRow ||
    targetCar.orientation !== "h" ||
    targetCar.vehicleClass !== "gt_coupe" ||
    targetCar.finishKey !== "rosso_corsa"
  ) {
    throw new Error(
      `[BoardPhysics] Hero "target" must sit on row ${exitRow} (Row 3) with orientation "h", class "gt_coupe", finish "rosso_corsa".`
    );
  }

  return true;
}

export function countBoardOverlaps(cars, gridSize = GRID_SPEC.gridSize) {
  if (!Array.isArray(cars) || cars.length === 0) return 0;
  const counts = new Uint16Array(gridSize * gridSize);
  let overlaps = 0;

  for (let i = 0; i < cars.length; i++) {
    const car = cars[i];
    if (!car) continue;
    const baseRow = Math.round(car.row);
    const baseCol = Math.round(car.col);
    const len = Math.max(1, Math.round(car.length || 2));
    const isVert = car.orientation === "v";

    for (let s = 0; s < len; s++) {
      const r = isVert ? baseRow + s : baseRow;
      const c = isVert ? baseCol : baseCol + s;
      if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
        if (car.id !== "target") overlaps += 1;
        continue;
      }
      const idx = r * gridSize + c;
      if (counts[idx] >= 1) overlaps += 1;
      counts[idx] += 1;
    }
  }

  return overlaps;
}

export function findVehicleAtCoord(cars, coordOrRow, maybeCol) {
  let row, col;
  if (typeof coordOrRow === "string") {
    const parsed = parseGridCoord(coordOrRow);
    if (!parsed) return null;
    row = parsed.row;
    col = parsed.col;
  } else {
    row = Math.round(coordOrRow);
    col = Math.round(maybeCol);
  }
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    const r0 = Math.round(c.row);
    const c0 = Math.round(c.col);
    const len = c.length || 2;
    if (c.orientation === "h") {
      if (r0 === row && col >= c0 && col < c0 + len) return c;
    } else {
      if (c0 === col && row >= r0 && row < r0 + len) return c;
    }
  }
  return null;
}

export function computeSlideBounds(cars, carIdOrIndex, gridSize = GRID_SPEC.gridSize) {
  const idx =
    typeof carIdOrIndex === "number"
      ? carIdOrIndex
      : cars.findIndex((c) => c.id === carIdOrIndex);

  if (idx < 0 || idx >= cars.length) return null;

  const subject = cars[idx];
  const occupied = new Uint8Array(gridSize * gridSize);

  for (let i = 0; i < cars.length; i++) {
    if (i === idx) continue;
    const c = cars[i];
    const baseRow = Math.round(c.row);
    const baseCol = Math.round(c.col);
    for (let s = 0; s < c.length; s++) {
      const r = c.orientation === "v" ? baseRow + s : baseRow;
      const col = c.orientation === "h" ? baseCol + s : baseCol;
      if (r >= 0 && r < gridSize && col >= 0 && col < gridSize) {
        occupied[r * gridSize + col] = 1;
      }
    }
  }

  const isHoriz = subject.orientation === "h";
  const currentCell = Math.round(isHoriz ? subject.col : subject.row);
  const fixedIndex = Math.round(isHoriz ? subject.row : subject.col);
  const len = subject.length;

  let minCell = currentCell;
  while (minCell > 0) {
    const testCell = minCell - 1;
    const r = isHoriz ? fixedIndex : testCell;
    const c = isHoriz ? testCell : fixedIndex;
    if (occupied[r * gridSize + c]) break;
    minCell = testCell;
  }

  let maxCell = currentCell;
  while (maxCell + len < gridSize) {
    const leadCell = maxCell + len;
    const r = isHoriz ? fixedIndex : leadCell;
    const c = isHoriz ? leadCell : fixedIndex;
    if (occupied[r * gridSize + c]) break;
    maxCell += 1;
  }

  let blockerBefore = null;
  if (minCell > 0) {
    const br = isHoriz ? fixedIndex : minCell - 1;
    const bc = isHoriz ? minCell - 1 : fixedIndex;
    const bCar = findVehicleAtCoord(cars, br, bc);
    blockerBefore = { coord: formatGridCoord(br, bc), carId: bCar?.id || null };
  }
  let blockerAfter = null;
  if (maxCell + len < gridSize) {
    const ar = isHoriz ? fixedIndex : maxCell + len;
    const ac = isHoriz ? maxCell + len : fixedIndex;
    const aCar = findVehicleAtCoord(cars, ar, ac);
    blockerAfter = { coord: formatGridCoord(ar, ac), carId: aCar?.id || null };
  }

  return {
    carIndex: idx,
    carId: subject.id,
    orientation: subject.orientation,
    fixedIndex,
    currentCell,
    minCell,
    maxCell,
    length: len,
    blockerBefore,
    blockerAfter,
  };
}

export function isExitCorridorClear(
  cars,
  gridSize = GRID_SPEC.gridSize,
  exitRow = GRID_SPEC.exitRow
) {
  const target = cars.find((c) => c.id === "target");
  if (!target) return false;

  const targetCol = Math.round(target.col);
  const checkStartCol = targetCol + target.length;
  if (checkStartCol >= gridSize) return true;

  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    if (c.id === "target") continue;
    const baseRow = Math.round(c.row);
    const baseCol = Math.round(c.col);

    if (c.orientation === "h") {
      if (baseRow !== exitRow) continue;
      const endCol = baseCol + c.length - 1;
      if (endCol >= checkStartCol && baseCol < gridSize) return false;
    } else {
      if (baseCol < checkStartCol || baseCol >= gridSize) continue;
      const endRow = baseRow + c.length - 1;
      if (baseRow <= exitRow && endRow >= exitRow) return false;
    }
  }

  return true;
}
