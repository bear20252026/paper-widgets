/**
 * src/core.js — Dual-Board 6x6 Human vs. AI Race Engine, Countdown, Lap Splits & Physical Kinematics
 * Project: Parking Bench — Human vs. Gemini AI 6x6 Visual Spatial Race (hydrogen-parking-bench)
 */

import * as THREE from "three";
import {
  bus,
  state,
  dispatchAction,
  DEMO_ACTIONS,
  DEMO_EVENTS,
  TOTAL_LAPS,
  MODEL_OPTIONS,
  getModelOption,
  GRID_SPEC,
  BOARD_OFFSETS,
  BOARD_PHYSICS,
  PHYSICAL_SCALE_SPEC,
  EXIT_DEST_COL,
  VEHICLE_CLASSES,
  CURATED_FINISHES,
  formatGridCoord,
  formatVehicleSpan,
} from "./contract.js";
import { DampedSpring3D } from "./kits/kinematics_3d.js";
import { createCourtyardWorld } from "./world.js";
import { generateRacePack, cloneLapConfig, getLevelConfig } from "./levels.js";
import {
  computeSlideBounds,
  findVehicleAtCoord,
  isExitCorridorClear,
  countBoardOverlaps,
} from "./solver.js";
import { CourtyardAudio } from "./audio.js";
import * as geminiApi from "./geminiApi.js";

const DRAG_PLANE_Y = 0.45;
const QUICK_TAP_THRESHOLD_PX = 6.0;
const RUBBER_BAND_METERS = 0.05;
const SNAP_STIFFNESS = 280;
const SNAP_DAMPING = 34;
const PITCH_STIFFNESS = 190;
const PITCH_DAMPING = 27.6;
const ROLL_STIFFNESS = 260;
const ROLL_DAMPING = 22;
const HEAVE_STIFFNESS = 290;
const HEAVE_DAMPING = 26;
const DROP_STIFFNESS = 340;
const DROP_DAMPING = 28;
const MAX_CHASSIS_ROLL_RAD = 0.026;
const LAP_EXIT_DURATION_SEC = 0.85;

const COUNTDOWN_STEPS = [
  { value: 3, durationSec: 0.75 },
  { value: 2, durationSec: 0.75 },
  { value: 1, durationSec: 0.75 },
  { value: "GO", durationSec: 0.45 },
];

{
  const exitRestWorldX = GRID_SPEC.cellToWorldX(EXIT_DEST_COL, VEHICLE_CLASSES.gt_coupe.gridLength);
  const runway = PHYSICAL_SCALE_SPEC.eastRollOffRunway;
  if (!(exitRestWorldX > runway.xMin && exitRestWorldX < runway.xMax)) {
    throw new Error(
      `[Core] EXIT_DEST_COL worldX (${exitRestWorldX}) outside eastRollOffRunway [${runway.xMin}, ${runway.xMax}].`
    );
  }
}

function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}

function minJerk01(t) {
  const u = clamp(t, 0, 1);
  return u * u * u * (10 + u * (-15 + 6 * u));
}

function isHorizOrientation(orientation) {
  return String(orientation || "h").toLowerCase() === "h";
}

function normalizeMoveDirection(rawDir) {
  const d = String(rawDir || "").trim().toUpperCase();
  if (d === "N" || d === "NORTH") return "UP";
  if (d === "S" || d === "SOUTH") return "DOWN";
  if (d === "W" || d === "WEST") return "LEFT";
  if (d === "E" || d === "EAST") return "RIGHT";
  return d;
}

function stepDampedSpringVerlet(pos, vel, target, stiffness, damping, dt) {
  const safePos = Number.isFinite(pos) ? pos : target;
  const safeVel = Number.isFinite(vel) ? vel : 0;
  const x0 = safePos - target;
  const a0 = -stiffness * x0 - damping * safeVel;
  const vHalf = safeVel + 0.5 * a0 * dt;
  const x1 = x0 + vHalf * dt;
  const v1 = (vHalf - 0.5 * stiffness * x1 * dt) / (1 + 0.5 * damping * dt);
  return {
    pos: target + x1,
    vel: Number.isFinite(v1) ? v1 : 0,
  };
}

export class DemoCore {
  constructor(canvas) {
    this.canvas = canvas;
    this.world = createCourtyardWorld(canvas);
    this.audio = new CourtyardAudio();

    this.racePack = [];
    this.humanCars = [];
    this.humanCarMap = new Map();
    this.aiCars = [];
    this.aiCarMap = new Map();

    // Alias foreground human board as `this.cars` / `this.carMap` for inspection helpers
    this.cars = this.humanCars;
    this.carMap = this.humanCarMap;

    this.humanUndoStack = [];
    this.humanExitClear = false;
    this.aiExitClear = false;

    this.countdownState = null;       // { stepIndex, stepElapsed }
    this.humanExitSequence = null;    // { car, lap, startCol, destCol, elapsed, duration, initialVelCells }
    this.aiExitSequence = null;       // { car, lap, startCol, destCol, elapsed, duration, initialVelCells }
    this.humanBumpNudge = null;       // { car, startCell, sign, elapsed, duration }
    this.aiBumpNudge = null;          // { car, startCell, sign, elapsed, duration }

    this.aiAbortController = null;
    this.aiLoopRunning = false;
    this._activeStreamingTurn = null;
    this._simFrameWaiters = [];

    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_PLANE_Y);
    this._planeHit = new THREE.Vector3();
    this._projVec = new THREE.Vector3();
    this._traumaOffset = new THREE.Vector3();
    this._traumaTarget = new THREE.Vector3();
    this._cameraMicroSpring = new DampedSpring3D(24.0, 0.82);
    this._rollingStats = { speed: 0, isTarget: false, worldX: 0 };
    this._lastRollingWorldX = 0;
    this._lastRollingIsTarget = false;

    this.hoveredCarId = null;
    this.selectedCarId = null;
    this.dragState = null;
    this._bgPointerDown = null;
    this.hintState = null;

    this.trauma = 0;
    this.traumaPhase = 0;
    this._isInitialized = false;
    this._pendingStartRace = false;

    if (this.canvas) {
      this.canvas.style.cursor = "default";
    }

    this._bindBusEvents();
    this._bindInputEvents();
    this._exposePlaywrightHelpers();

    this.ready = this._initAsync();
  }

  async _initAsync() {
    if (this.world && this.world.ready && typeof this.world.ready.then === "function") {
      await this.world.ready;
    }
    this.resize();
    this._syncAiOpponentPlaque();
    this._setupFreshRace({ generateNewPack: true, startCountdown: false });
    this._isInitialized = true;

    if (this._pendingStartRace || state.isAutoplay) {
      this._pendingStartRace = false;
      this.startRaceCountdown({ freshPack: false });
    }
  }

  _syncAiOpponentPlaque() {
    const opt = getModelOption(state.race.selectedModel);
    state.race.opponentLabel = opt.label;
    state.hydrogen.modelId = opt.id;
    state.hydrogen.modelDisplay = opt.label;
    this.world.setAiOpponentLabel?.(opt.label);
  }

  _setWorldExitGate(boardRole, isOpen, immediate = false) {
    if (!this.world || typeof this.world.setExitGateState !== "function") return;
    try {
      this.world.setExitGateState({ isOpen: Boolean(isOpen), boardRole, immediate: Boolean(immediate) });
    } catch (_) {
      this.world.setExitGateState(Boolean(isOpen), boardRole, { immediate: Boolean(immediate) });
    }
  }

  _captureAiBoardPng(width = 960, height = 720) {
    if (this.world && typeof this.world.captureAiBoardPng === "function") {
      return this.world.captureAiBoardPng(width, height);
    }
    if (this.world && typeof this.world.captureHydrogenTabletopPng === "function") {
      return this.world.captureHydrogenTabletopPng(width, height);
    }
    this._renderWithTrauma(1 / 60);
    return this.canvas ? this.canvas.toDataURL("image/png") : "";
  }

  _waitSimSec(durationSec, signal) {
    if (signal?.aborted) return Promise.resolve();
    const targetSec = Math.max(0.01, Number(durationSec) || 0.016);
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        if (signal) signal.removeEventListener("abort", done);
        resolve();
      };
      const waiter = { remainingSec: targetSec, resolve: done };
      this._simFrameWaiters.push(waiter);
      const fallbackTimer = setTimeout(done, Math.max(60, Math.round(targetSec * 1000) + 180));
      if (signal) signal.addEventListener("abort", done, { once: true });
    });
  }

  async _waitForAiCarStepSettle(signal, maxSimSec = 1.6) {
    let waited = 0;
    const step = 1 / 60;
    while (waited < maxSimSec && !signal?.aborted) {
      const anyMoving =
        Boolean(this.aiBumpNudge) ||
        this.aiCars.some((c) => c.mode === "gliding" || c.mode === "snapping");
      if (!anyMoving) break;
      await this._waitSimSec(step, signal);
      waited += step;
    }
  }

  async _waitForAiLapTransitionSettle(signal, maxSimSec = 2.4) {
    let waited = 0;
    const step = 1 / 60;
    while (waited < maxSimSec && !signal?.aborted) {
      if (!this.aiExitSequence) break;
      await this._waitSimSec(step, signal);
      waited += step;
    }
  }

  _emitThoughtStreamTick(turnEntry) {
    if (!turnEntry) return;
    bus.emit(DEMO_EVENTS.AI_THOUGHT_UPDATED, {
      lap: turnEntry.lap,
      turn: turnEntry.turn,
      lapTurn: turnEntry.lapTurn,
      thinkingText: turnEntry.thinkingText,
      turnEntry,
    });
    bus.emit(DEMO_EVENTS.HYDROGEN_THOUGHT_UPDATED, {
      turn: turnEntry.turn,
      turnEntry,
    });
  }

  _tickActiveThoughtStreamer(dt) {
    const t = this._activeStreamingTurn;
    if (!t) return;
    const target = String(t.targetThinkingText || "");
    if (!target) return;

    if (!Number.isFinite(t._streamCharCursor) || t._streamCharCursor < 0) {
      t._streamCharCursor = 0;
    }
    if (t._streamCharCursor > target.length) {
      t._streamCharCursor = target.length;
    }

    const remaining = target.length - t._streamCharCursor;
    if (remaining <= 0) {
      if (t.thinkingText !== target) {
        t.thinkingText = target;
        this._emitThoughtStreamTick(t);
      }
      return;
    }

    let charsPerSec = 130;
    if (t._apiResolved) {
      charsPerSec = clamp(remaining / 0.65, 145, 540);
    } else if (remaining > 260) {
      charsPerSec = 130 + Math.min(240, (remaining - 260) * 0.75);
    }

    t._streamCharCursor = Math.min(target.length, t._streamCharCursor + charsPerSec * dt);
    const nextLen = Math.floor(t._streamCharCursor);
    const nextSlice = target.slice(0, nextLen);
    if (nextSlice !== t.thinkingText) {
      t.thinkingText = nextSlice;
      this._emitThoughtStreamTick(t);
    }
  }

  async _waitForThoughtStreamerCatchUp(turnEntry, signal, maxWaitSec = 0.85) {
    let waited = 0;
    const step = 1 / 60;
    while (waited < maxWaitSec && !signal?.aborted) {
      const target = String(turnEntry?.targetThinkingText || "");
      if ((turnEntry?.thinkingText || "").length >= target.length) break;
      await this._waitSimSec(step, signal);
      waited += step;
    }
  }

  _tickSimFrameWaiters(dt) {
    if (this._simFrameWaiters.length === 0) return;
    for (let i = this._simFrameWaiters.length - 1; i >= 0; i--) {
      const w = this._simFrameWaiters[i];
      w.remainingSec -= dt;
      if (w.remainingSec <= 1e-5) {
        this._simFrameWaiters.splice(i, 1);
        w.resolve();
      }
    }
  }

  _bindBusEvents() {
    bus.addEventListener(DEMO_EVENTS.MODEL_SELECTED, (e) => {
      this._syncAiOpponentPlaque();
      const prevPhase = e?.detail?.prevPhase || state.race.phase;
      const fromRematch = Boolean(e?.detail?.fromRematch);
      const autoStart = Boolean(e?.detail?.autoStart);
      if (fromRematch) return;
      if (prevPhase !== "setup") {
        this._setupFreshRace({
          generateNewPack: prevPhase === "finished",
          startCountdown: autoStart,
        });
      } else if (autoStart) {
        this.startRaceCountdown({ freshPack: false });
      }
    });

    bus.addEventListener(DEMO_EVENTS.RACE_START_REQUESTED, (e) => {
      if (!this._isInitialized) {
        this._pendingStartRace = true;
        return;
      }
      const freshPack = Boolean(e?.detail?.freshPack);
      this.startRaceCountdown({ freshPack });
    });

    bus.addEventListener(DEMO_EVENTS.RACE_RESTART_REQUESTED, (e) => {
      if (!this._isInitialized) {
        this._pendingStartRace = e?.detail?.autoStart !== false;
        return;
      }
      const freshPack = e?.detail?.freshPack !== false;
      const autoStart = e?.detail?.autoStart !== false;
      this._setupFreshRace({ generateNewPack: freshPack, startCountdown: autoStart });
    });

    bus.addEventListener(DEMO_EVENTS.SCRAMBLE_REQUESTED, (e) => {
      const autoStart = Boolean(e?.detail?.autoStart);
      this.audio.playCardFlip?.();
      this._setupFreshRace({ generateNewPack: true, startCountdown: autoStart });
    });

    bus.addEventListener(DEMO_EVENTS.HUMAN_LAP_RESET, () => {
      this.resetCurrentHumanLap();
    });

    bus.addEventListener(DEMO_EVENTS.RESET_REQUESTED, () => {
      if (state.race.phase === "racing") {
        this.resetCurrentHumanLap();
      } else {
        this._setupFreshRace({ generateNewPack: false, startCountdown: false });
      }
    });

    bus.addEventListener(DEMO_EVENTS.LEVEL_SELECTED, (e) => {
      const lv = clamp(Math.round(Number(e?.detail?.level) || 1), 1, TOTAL_LAPS);
      if (state.race.phase === "setup" && this.racePack.length >= lv) {
        state.race.human.currentLap = lv;
        state.race.ai.currentLap = lv;
        state.currentLevel = lv;
        this._spawnBoardLap("human", lv, { immediateGate: true });
        this._spawnBoardLap("ai", lv, { immediateGate: true });
        this._emitHumanMoveSync();
      }
    });

    bus.addEventListener(DEMO_EVENTS.UNDO_REQUESTED, () => {
      this.triggerUndo();
    });

    bus.addEventListener(DEMO_EVENTS.CAMERA_CHANGED, (e) => {
      const mode = e?.detail?.cameraMode || state.cameraMode || "3d";
      const immediate = state.frameCount === 0;
      if (!immediate) {
        this.world.interruptOpeningSettle?.();
      }
      this.world.setCameraMode?.(mode, immediate);
      if (this.world.controls && !this.dragState) {
        this.world.controls.enabled = mode !== "top";
      }
      this._syncCanvasCursor();
    });
  }

  _bindInputEvents() {
    if (typeof window === "undefined" || !this.canvas) return;

    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    if (typeof ResizeObserver === "function" && this.canvas.parentElement) {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(this.canvas.parentElement);
    }

    this.canvas.addEventListener(
      "wheel",
      () => {
        this.world.interruptOpeningSettle?.();
      },
      { passive: true }
    );

    this.canvas.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    window.addEventListener("pointermove", (e) => this._onPointerMove(e));
    window.addEventListener("pointerup", (e) => this._onPointerUp(e));
    window.addEventListener("pointercancel", (e) => this._onPointerUp(e));
    this.canvas.addEventListener("pointerleave", () => {
      if (!this.dragState && !this._bgPointerDown) {
        this._setHoveredCar(null);
        this._syncCanvasCursor();
      }
    });

    window.addEventListener("keydown", (e) => this._onKeyDown(e));
  }

  _exposePlaywrightHelpers() {
    if (typeof window === "undefined") return;

    window.__getCarScreenPoint = (carId, boardRole = "human") => {
      const map = boardRole === "ai" ? this.aiCarMap : this.humanCarMap;
      const car = map.get(carId);
      if (!car) return null;
      const { wx, wz } = this._carWorldCenter(car);
      const rootY = car.instance?.root?.position?.y || 0;
      const basePt = this.projectWorldToScreen(wx, rootY + 0.92, wz);
      return {
        x: basePt.x,
        y: basePt.y,
        worldX: wx,
        worldY: rootY,
        worldZ: wz,
        row: car.row,
        col: car.col,
        visualPos: car.visualPos,
        length: car.length,
        orientation: car.orientation,
        boardRole: car.boardRole,
      };
    };

    window.__startAutoPlayDemo = () => {
      window.DEMO_AUTOPLAY_ACTIVE = true;
      this.audio.forceUnlock?.();
      state.isAutoplay = true;
      dispatchAction(DEMO_ACTIONS.START_RACE, { freshPack: false });
      return window.__getPuzzleDiagnostics?.() || { started: true };
    };

    window.__getPuzzleDiagnostics = () => {
      const humanOverlaps = countBoardOverlaps(this.humanCars, GRID_SPEC.gridSize);
      const aiOverlaps = countBoardOverlaps(this.aiCars, GRID_SPEC.gridSize);
      return {
        phase: state.race.phase,
        countdownValue: state.race.countdownValue,
        elapsedMs: Math.round(state.race.elapsedMs),
        selectedModel: state.race.selectedModel,
        opponentLabel: state.race.opponentLabel,
        winner: state.race.winner,
        humanLap: state.race.human.currentLap,
        aiLap: state.race.ai.currentLap,
        humanSplitsMs: state.race.human.lapSplitsMs.slice(),
        aiSplitsMs: state.race.ai.lapSplitsMs.slice(),
        humanCarCount: this.humanCars.length,
        aiCarCount: this.aiCars.length,
        overlaps: humanOverlaps + aiOverlaps,
        humanOverlaps,
        aiOverlaps,
        aiTurns: state.race.ai.turns.length,
        aiStatus: state.race.ai.status,
      };
    };

    window.__RACE_API__ = {
      getDiagnostics: () => window.__getPuzzleDiagnostics(),
      getHumanCars: () =>
        this.humanCars.map((c) => ({
          id: c.id,
          vehicleClass: c.vehicleClass,
          finishKey: c.finishKey,
          coord: formatGridCoord(c.row, c.col),
          span: formatVehicleSpan(c),
          row: c.row,
          col: c.col,
          length: c.length,
          orientation: c.orientation,
        })),
      getAiCars: () =>
        this.aiCars.map((c) => ({
          id: c.id,
          vehicleClass: c.vehicleClass,
          finishKey: c.finishKey,
          coord: formatGridCoord(c.row, c.col),
          span: formatVehicleSpan(c),
          row: c.row,
          col: c.col,
          length: c.length,
          orientation: c.orientation,
        })),
      captureAiBoardPng: (w = 960, h = 720) => this._captureAiBoardPng(w, h),
      executeHumanMove: (moveSpec, opts = {}) => this.executeBoardMove("human", moveSpec, opts),
      startRace: () => dispatchAction(DEMO_ACTIONS.START_RACE, { freshPack: false }),
      selectModel: (model) => dispatchAction(DEMO_ACTIONS.SELECT_MODEL, { model }),
    };

    window.__BENCHMARK_API__ = {
      captureTabletopPng: (w = 960, h = 720) => this._captureAiBoardPng(w, h),
      executeDecisionImmediate: (moveSpec) =>
        this.executeBoardMove("ai", moveSpec, { immediate: true }),
      getBoardStats: () => window.__getPuzzleDiagnostics(),
    };
  }

  projectWorldToScreen(worldX, worldY, worldZ) {
    if (!this.world || !this.world.camera || !this.canvas) {
      return { x: 0, y: 0, worldX, worldY, worldZ };
    }
    this.world.scene.updateMatrixWorld(true);
    this.world.camera.updateMatrixWorld(true);

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth || 1280;
    const height = rect.height || window.innerHeight || 1080;

    this._projVec.set(worldX, worldY, worldZ).project(this.world.camera);
    return {
      x: rect.left + (this._projVec.x * 0.5 + 0.5) * width,
      y: rect.top + (-this._projVec.y * 0.5 + 0.5) * height,
      worldX,
      worldY,
      worldZ,
    };
  }

  resize() {
    if (!this.canvas || !this.world) return;
    const parent = this.canvas.parentElement;
    const rect = (parent || this.canvas).getBoundingClientRect();
    const winW = typeof window !== "undefined" ? window.innerWidth : 0;
    const winH = typeof window !== "undefined" ? window.innerHeight : 0;
    const rawDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cssWidth = Math.max(1, Math.round(rect.width || winW || 1280));
    const cssHeight = Math.max(1, Math.round(rect.height || winH || 1080));
    const dpr = Math.min(rawDpr, 3);
    this.world.resize?.(cssWidth, cssHeight, dpr);
  }

  _canHumanInteract() {
    return (
      state.race.phase === "racing" &&
      !state.race.human.finished &&
      !state.race.human.exitingLap
    );
  }

  _syncCanvasCursor() {
    if (!this.canvas) return;
    const isOrbitDragging = Boolean(
      this._bgPointerDown?.isOrbiting &&
        this.world?.controls?.enabled &&
        this.world?.controls?._isDragging
    );
    if (this.dragState || isOrbitDragging) {
      this.canvas.style.cursor = "grabbing";
      return;
    }
    if (this.hoveredCarId) {
      if (this._canHumanInteract()) {
        const hoverCar = this.humanCarMap.get(this.hoveredCarId);
        if (hoverCar) {
          this.canvas.style.cursor = isHorizOrientation(hoverCar.orientation)
            ? "ew-resize"
            : "ns-resize";
          return;
        }
      } else if (state.race.phase === "setup") {
        this.canvas.style.cursor = "pointer";
        return;
      }
    }
    this.canvas.style.cursor = "default";
  }

  _stopActiveAiLoop() {
    this.aiBumpNudge = null;
    this._activeStreamingTurn = null;
    if (this.aiAbortController) {
      try {
        this.aiAbortController.abort();
      } catch (_) {}
      this.aiAbortController = null;
    }
    this.aiLoopRunning = false;
  }

  _disposeBoardCars(boardRole) {
    const list = boardRole === "ai" ? this.aiCars : this.humanCars;
    const map = boardRole === "ai" ? this.aiCarMap : this.humanCarMap;
    for (const car of list) {
      car.instance?.dispose?.();
    }
    list.length = 0;
    map.clear();
  }

  _resetRaceTelemetry() {
    state.race.countdownValue = null;
    state.race.countdownRemainingSec = 0;
    state.race.elapsedMs = 0;
    state.race.winner = null;
    state.race.winnerTimeMs = null;
    state.race.setupNudgeCount = 0;

    state.race.human.currentLap = 1;
    state.race.human.completedLaps = 0;
    state.race.human.finished = false;
    state.race.human.lapStartElapsedMs = 0;
    state.race.human.lapSplitsMs = [null, null, null, null, null];
    state.race.human.cumulativeSplitsMs = [null, null, null, null, null];
    state.race.human.totalTimeMs = null;
    state.race.human.lapMoves = 0;
    state.race.human.totalMoves = 0;
    state.race.human.canUndo = false;
    state.race.human.isExitClear = false;
    state.race.human.exitingLap = false;

    state.race.ai.currentLap = 1;
    state.race.ai.completedLaps = 0;
    state.race.ai.finished = false;
    state.race.ai.status = "idle";
    state.race.ai.errorMessage = "";
    state.race.ai.lapStartElapsedMs = 0;
    state.race.ai.lapSplitsMs = [null, null, null, null, null];
    state.race.ai.cumulativeSplitsMs = [null, null, null, null, null];
    state.race.ai.totalTimeMs = null;
    state.race.ai.lapMoves = 0;
    state.race.ai.totalMoves = 0;
    state.race.ai.isExitClear = false;
    state.race.ai.exitingLap = false;
    state.race.ai.currentTurn = 0;
    state.race.ai.turns.length = 0;

    state.currentLevel = 1;
    state.moves = 0;
    state.canUndo = false;
    state.isSolved = false;
    state.isExitClear = false;
    state.solvedLevels = [];

    const opt = getModelOption(state.race.selectedModel);
    state.hydrogen.modelId = opt.id;
    state.hydrogen.modelDisplay = opt.label;
    state.hydrogen.thinkingLevel = "low";
    state.hydrogen.status = "idle";
    state.hydrogen.errorMessage = "";
    state.hydrogen.conversationId = "";
    state.hydrogen.toolCallsAudited = 0;
    state.hydrogen.thoughtTokensTotal = 0;
    state.hydrogen.currentTurn = 0;
    state.hydrogen.totalTurns = 0;
    state.hydrogen.turnStartedAtMs = 0;
    state.hydrogen.currentFrameDataUrl = "";
    state.hydrogen.solvedFrameDataUrl = "";

    bus.emit(DEMO_EVENTS.HYDROGEN_SESSION_RESET, { level: 1 });
  }

  _setupFreshRace({ generateNewPack = true, startCountdown = false } = {}) {
    this._cancelActiveDrag();
    this._bgPointerDown = null;
    this._stopActiveAiLoop();
    this.countdownState = null;
    this.humanExitSequence = null;
    this.aiExitSequence = null;
    this.humanBumpNudge = null;
    this.aiBumpNudge = null;
    this.humanUndoStack = [];
    this.hoveredCarId = null;
    this.selectedCarId = null;
    this.clearHint({ silent: true });
    this._hideCorridorGuide();

    if (generateNewPack || this.racePack.length !== TOTAL_LAPS) {
      this.racePack = generateRacePack();
      state.race.packId = (Number(state.race.packId) || 0) + 1;
      bus.emit(DEMO_EVENTS.RACE_PACK_GENERATED, { packId: state.race.packId });
    }

    const prevPhase = state.race.phase;
    this._resetRaceTelemetry();
    state.race.phase = "setup";
    state.currentState = "setup";

    this._syncAiOpponentPlaque();
    this._spawnBoardLap("human", 1, { immediateGate: true });
    this._spawnBoardLap("ai", 1, { immediateGate: true });

    if (this.world.controls) {
      this.world.resetCameraToHero?.();
      this.world.controls.enabled = state.cameraMode !== "top";
    }

    this._updateAllBoardsPhysics(1 / 60);
    this._emitHumanMoveSync();
    this._syncCanvasCursor();

    bus.emit(DEMO_EVENTS.RACE_PHASE_CHANGED, {
      phase: "setup",
      prevPhase,
      countdownValue: null,
      winner: null,
    });

    if (startCountdown) {
      this.startRaceCountdown({ freshPack: false });
    }
  }

  _spawnBoardLap(boardRole, lapNumber, { immediateGate = true } = {}) {
    const safeLap = clamp(Math.round(Number(lapNumber) || 1), 1, TOTAL_LAPS);
    const lapTemplate =
      this.racePack[safeLap - 1] || getLevelConfig(safeLap);
    const cfg = cloneLapConfig(lapTemplate);

    this._disposeBoardCars(boardRole);
    const targetList = boardRole === "ai" ? this.aiCars : this.humanCars;
    const targetMap = boardRole === "ai" ? this.aiCarMap : this.humanCarMap;
    const offset = BOARD_OFFSETS[boardRole] || BOARD_OFFSETS.human;

    for (const spec of cfg.cars) {
      const isTarget = spec.id === "target";
      const sceneCarId = `${boardRole}_${spec.id}`;
      const instance = this.world.createVehicleInstance({
        id: sceneCarId,
        carId: sceneCarId,
        vehicleClass: spec.vehicleClass,
        finishKey: spec.finishKey,
        isTarget,
        boardRole,
        length: spec.length,
        orientation: spec.orientation,
      });

      if (instance?.root && !instance.root.parent) {
        this.world.scene.add(instance.root);
      }

      const isH = isHorizOrientation(spec.orientation);
      const primaryCell = isH ? spec.col : spec.row;
      const localX = isH
        ? GRID_SPEC.cellToWorldX(spec.col, spec.length)
        : GRID_SPEC.cellToWorldX(spec.col, 1);
      const localZ = !isH
        ? GRID_SPEC.cellToWorldZ(spec.row, spec.length)
        : GRID_SPEC.cellToWorldZ(spec.row, 1);
      const worldX = localX + offset.x;
      const worldZ = localZ + offset.z;

      if (instance?.root) {
        instance.root.position.set(worldX, BOARD_PHYSICS.deckY, worldZ);
        instance.root.userData.carId = sceneCarId;
        instance.root.userData.logicalCarId = spec.id;
        instance.root.userData.boardRole = boardRole;
        instance.root.traverse((node) => {
          if (node.userData) {
            node.userData.logicalCarId = spec.id;
            node.userData.boardRole = boardRole;
          }
        });
      }

      const vClass = VEHICLE_CLASSES[spec.vehicleClass];
      const wheelRadius = instance?.wheelRadius || vClass?.wheelRadius || 0.34;
      const frontAxleOffset = vClass?.frontAxleOffset || 1.22;
      const rearAxleOffset = vClass?.rearAxleOffset || 1.22;
      let rawWheels = Array.isArray(instance?.wheels) ? instance.wheels.filter(Boolean) : [];
      let chassis = instance?.chassis || null;
      const searchRoot = instance?.bodyRig || instance?.root || null;
      if (searchRoot && (rawWheels.length < 4 || !chassis || chassis === instance?.root)) {
        let foundChassis = null;
        const wheelMap = { FL: null, FR: null, RL: null, RR: null };
        searchRoot.traverse((node) => {
          const nm = node?.name || "";
          if (!foundChassis && !node.isMesh && /^Chassis(?:[._]\d+)?$/.test(nm)) {
            foundChassis = node;
          }
          const wm = nm.match(/^Wheel_(FL|FR|RL|RR)(?:[._]\d+)?$/);
          if (wm && !node.isMesh && !wheelMap[wm[1]]) {
            wheelMap[wm[1]] = node;
          }
        });
        if (!chassis || chassis === instance?.root) {
          chassis = foundChassis || chassis;
        }
        if (rawWheels.length < 4) {
          const resolved = ["FL", "FR", "RL", "RR"].map((k) => wheelMap[k]).filter(Boolean);
          if (resolved.length === 4) rawWheels = resolved;
        }
      }
      const wheels = rawWheels.map((w) => ({
        obj: w,
        spinSign: Math.cos(w.rotation?.y || 0) >= 0 ? 1 : -1,
      }));

      const baseChassisY = chassis ? chassis.position.y : 0;
      const baseChassisRotX = chassis ? chassis.rotation.x : 0;
      const baseChassisRotZ = chassis ? chassis.rotation.z : 0;

      instance?.setBrakeLight?.(0.15);
      instance?.setHighlight?.("none");

      const carEntry = {
        id: spec.id,
        sceneCarId,
        boardRole,
        vehicleClass: spec.vehicleClass,
        finishKey: spec.finishKey,
        row: spec.row,
        col: spec.col,
        length: spec.length,
        orientation: spec.orientation,
        isTarget,
        instance,
        chassis,
        baseChassisY,
        baseChassisRotX,
        baseChassisRotZ,
        wheels,
        wheelRadius,
        frontAxleOffset,
        rearAxleOffset,

        visualPos: primaryCell,
        snapTarget: primaryCell,
        snapVel: 0,
        glideFrom: primaryCell,
        glideTo: primaryCell,
        glideElapsed: 0,
        glideDuration: 0.24,
        mode: "idle",

        worldX,
        worldZ,
        lastWorldPrimary: isH ? worldX : worldZ,
        lastRootY: BOARD_PHYSICS.deckY,
        terrainPitch: 0,
        dropHeave: 0,
        dropVel: 0,
        prevFrontOnTable: false,
        prevRearOnTable: false,
        smoothVel: 0,
        prevSmoothVel: 0,
        pitchAngle: 0,
        pitchVel: 0,
        rollAngle: 0,
        rollVel: 0,
        rollTarget: 0,
        heaveOffset: 0,
        heaveVel: 0,
        brakeIntensity: 0.15,
      };

      targetList.push(carEntry);
      targetMap.set(carEntry.id, carEntry);
    }

    if (boardRole === "human") {
      this.humanUndoStack = [];
      this.selectedCarId = null;
      this.hoveredCarId = null;
      this._hideCorridorGuide();
      state.vehicleCount = targetList.length;
      state.currentLevel = safeLap;
    }

    this._syncExitCorridorState(boardRole, { immediate: immediateGate });
    this._updateSingleBoardPhysics(targetList, offset, 1 / 60, boardRole);
  }

  resetCurrentHumanLap() {
    if (state.race.phase !== "racing" || state.race.human.finished || state.race.human.exitingLap) {
      return;
    }
    this._cancelActiveDrag();
    const curLap = state.race.human.currentLap;
    state.race.human.lapMoves = 0;
    state.race.human.canUndo = false;
    this.audio.playCardFlip?.();
    this._spawnBoardLap("human", curLap, { immediateGate: true });
    this._emitHumanMoveSync();
  }

  startRaceCountdown({ freshPack = false } = {}) {
    if (state.race.phase === "countdown") return;

    this.audio.forceUnlock?.();
    this.world.interruptOpeningSettle?.();

    if (
      freshPack ||
      state.race.phase === "racing" ||
      state.race.phase === "finished" ||
      state.race.human.totalMoves > 0 ||
      state.race.ai.turns.length > 0
    ) {
      this._setupFreshRace({
        generateNewPack: freshPack || state.race.phase === "finished",
        startCountdown: false,
      });
    }

    const prevPhase = state.race.phase;
    const firstStep = COUNTDOWN_STEPS[0];
    state.race.phase = "countdown";
    state.race.countdownValue = firstStep.value;
    state.race.countdownRemainingSec = firstStep.durationSec;
    state.currentState = "countdown";

    this.countdownState = {
      stepIndex: 0,
      stepElapsed: 0,
    };

    this.audio.playCountdownPip(firstStep.value);
    this._syncCanvasCursor();

    bus.emit(DEMO_EVENTS.RACE_PHASE_CHANGED, {
      phase: "countdown",
      prevPhase,
      countdownValue: firstStep.value,
      winner: null,
    });
    bus.emit(DEMO_EVENTS.RACE_COUNTDOWN_TICK, {
      value: firstStep.value,
      stepIndex: 0,
    });
  }

  _updateCountdown(dt) {
    if (state.race.phase !== "countdown" || !this.countdownState) return;

    const cd = this.countdownState;
    cd.stepElapsed += dt;

    while (cd.stepIndex < COUNTDOWN_STEPS.length) {
      const curStep = COUNTDOWN_STEPS[cd.stepIndex];
      const rem = Math.max(0, curStep.durationSec - cd.stepElapsed);
      state.race.countdownRemainingSec = rem;

      if (cd.stepElapsed < curStep.durationSec) {
        return;
      }

      cd.stepElapsed -= curStep.durationSec;
      cd.stepIndex += 1;

      if (cd.stepIndex < COUNTDOWN_STEPS.length) {
        const nextStep = COUNTDOWN_STEPS[cd.stepIndex];
        state.race.countdownValue = nextStep.value;
        state.race.countdownRemainingSec = nextStep.durationSec;
        this.audio.playCountdownPip(nextStep.value);
        bus.emit(DEMO_EVENTS.RACE_COUNTDOWN_TICK, {
          value: nextStep.value,
          stepIndex: cd.stepIndex,
        });
      }
    }

    // Countdown `3 -> 2 -> 1 -> GO!` finished -> launch head-to-head race!
    this.countdownState = null;
    const prevPhase = state.race.phase;
    state.race.phase = "racing";
    state.race.countdownValue = null;
    state.race.countdownRemainingSec = 0;
    state.race.elapsedMs = 0;
    state.race.human.lapStartElapsedMs = 0;
    state.race.ai.lapStartElapsedMs = 0;
    state.currentState = "racing";

    this._syncCanvasCursor();
    bus.emit(DEMO_EVENTS.RACE_COUNTDOWN_TICK, { value: null, stepIndex: COUNTDOWN_STEPS.length });
    bus.emit(DEMO_EVENTS.RACE_PHASE_CHANGED, {
      phase: "racing",
      prevPhase,
      countdownValue: null,
      winner: null,
    });

    this._startAiRaceLoop();
  }

  _emitHumanMoveSync() {
    dispatchAction(DEMO_ACTIONS.RECORD_MOVE, {
      level: state.race.human.currentLap,
      moves: state.race.human.lapMoves,
      totalMoves: state.race.human.totalMoves,
      vehicleCount: this.humanCars.length,
      canUndo:
        this._canHumanInteract() && this.humanUndoStack.length > 0,
      isExitClear: this.humanExitClear,
    });
  }

  _syncExitCorridorState(boardRole, { immediate = false } = {}) {
    if (boardRole === "ai") {
      const prev = this.aiExitClear;
      const nowClear = state.race.ai.exitingLap || state.race.ai.finished
        ? true
        : isExitCorridorClear(this.aiCars);
      this.aiExitClear = nowClear;
      state.race.ai.isExitClear = nowClear;
      this._setWorldExitGate("ai", nowClear, immediate);
      if (!immediate && !prev && nowClear) {
        this.audio.playGateOpen?.();
      }
      return;
    }

    const prev = this.humanExitClear;
    const nowClear = state.race.human.exitingLap || state.race.human.finished
      ? true
      : isExitCorridorClear(this.humanCars);
    this.humanExitClear = nowClear;
    state.isExitClear = nowClear;
    state.race.human.isExitClear = nowClear;
    this._setWorldExitGate("human", nowClear, immediate);

    if (!immediate && !prev && nowClear) {
      this.audio.playGateOpen();
    } else if (!immediate && prev && !nowClear) {
      this.audio.playGateClose?.();
    }
  }

  _showCorridorForCar(car, bounds) {
    if (!car || !bounds || car.boardRole !== "human") return;
    this.world.setCorridorGuide?.({
      visible: true,
      boardRole: "human",
      orientation: car.orientation,
      fixedIndex: bounds.fixedIndex,
      minCell: bounds.minCell,
      maxCell: bounds.maxCell,
      carLength: car.length,
      isTarget: car.isTarget,
    });
  }

  _hideCorridorGuide() {
    this.world.setCorridorGuide?.({
      visible: false,
      boardRole: "human",
      orientation: "h",
      fixedIndex: GRID_SPEC.exitRow,
      minCell: 0,
      maxCell: 0,
      carLength: 2,
      isTarget: false,
    });
  }

  _syncIdleCorridorGuide() {
    if (this.dragState || !this._canHumanInteract()) {
      if (!this._canHumanInteract()) this._hideCorridorGuide();
      return;
    }
    const activeId = this.hoveredCarId || this.selectedCarId;
    if (activeId && this.humanCarMap.has(activeId)) {
      const car = this.humanCarMap.get(activeId);
      const bounds = computeSlideBounds(this.humanCars, activeId);
      this._showCorridorForCar(car, bounds);
    } else {
      this._hideCorridorGuide();
    }
  }

  _refreshCarHighlights() {
    const canHover = this._canHumanInteract();
    for (const car of this.humanCars) {
      if (this.dragState && this.dragState.carId === car.id) {
        car.instance?.setHighlight?.("dragging");
      } else if (
        (this.hoveredCarId === car.id || this.selectedCarId === car.id) &&
        (canHover || state.race.phase === "setup")
      ) {
        car.instance?.setHighlight?.("hover");
      } else {
        car.instance?.setHighlight?.("none");
      }
    }
  }

  _setHoveredCar(carId) {
    if (this.hoveredCarId !== carId) {
      this.hoveredCarId = carId;
      this._refreshCarHighlights();
      if (!this.dragState && this._canHumanInteract()) {
        this._syncIdleCorridorGuide();
      }
    }
    this._syncCanvasCursor();
  }

  _prepareRaycaster(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || window.innerWidth || 1;
    const height = rect.height || window.innerHeight || 1;

    this.pointerNDC.x = ((clientX - rect.left) / width) * 2 - 1;
    this.pointerNDC.y = -(((clientY - rect.top) / height) * 2 - 1);

    this.world.scene.updateMatrixWorld(true);
    this.world.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointerNDC, this.world.camera);
  }

  _raycastHumanVehicle(clientX, clientY) {
    if (!this.world || this.humanCars.length === 0) return null;
    this._prepareRaycaster(clientX, clientY);

    const roots = [];
    for (let i = 0; i < this.humanCars.length; i++) {
      const r = this.humanCars[i].instance?.root;
      if (r) roots.push(r);
    }
    if (roots.length === 0) return null;

    const hits = this.raycaster.intersectObjects(roots, true);
    for (let h = 0; h < hits.length; h++) {
      let obj = hits[h].object;
      if (obj.name && /shadow/i.test(obj.name)) continue;
      while (obj) {
        if (obj.userData?.boardRole && obj.userData.boardRole !== "human") break;
        const logicalId = obj.userData?.logicalCarId;
        if (logicalId && this.humanCarMap.has(logicalId)) {
          return this.humanCarMap.get(logicalId);
        }
        for (let i = 0; i < this.humanCars.length; i++) {
          if (this.humanCars[i].instance?.root === obj) return this.humanCars[i];
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  _intersectDragPlane(clientX, clientY, fallbackWorldX = 0, fallbackWorldZ = 0) {
    this._prepareRaycaster(clientX, clientY);
    const hit = this.raycaster.ray.intersectPlane(this.dragPlane, this._planeHit);
    if (!hit) this._planeHit.set(fallbackWorldX, DRAG_PLANE_Y, fallbackWorldZ);
    return this._planeHit;
  }

  _carWorldCenter(car) {
    const isH = isHorizOrientation(car.orientation);
    const offset = BOARD_OFFSETS[car.boardRole] || BOARD_OFFSETS.human;
    const localX = isH
      ? GRID_SPEC.cellToWorldX(car.visualPos, car.length)
      : GRID_SPEC.cellToWorldX(car.col, 1);
    const localZ = !isH
      ? GRID_SPEC.cellToWorldZ(car.visualPos, car.length)
      : GRID_SPEC.cellToWorldZ(car.row, 1);
    return { wx: localX + offset.x, wz: localZ + offset.z, localX, localZ };
  }

  _findOccupantAtCell(boardCars, row, col, excludeCarId = null) {
    if (row < 0 || row >= GRID_SPEC.gridSize || col < 0 || col >= GRID_SPEC.gridSize) return null;
    for (let i = 0; i < boardCars.length; i++) {
      const c = boardCars[i];
      if (!c || c.id === excludeCarId) continue;
      const r0 = Math.round(c.row);
      const c0 = Math.round(c.col);
      if (isHorizOrientation(c.orientation)) {
        if (row === r0 && col >= c0 && col < c0 + c.length) return c;
      } else {
        if (col === c0 && row >= r0 && row < r0 + c.length) return c;
      }
    }
    return null;
  }

  _applyBoundaryContact(boardCars, car, bounds, side, speedIntensity = 0.65, playSound = true) {
    const isH = isHorizOrientation(car.orientation);
    const adjRow = isH
      ? bounds.fixedIndex
      : side < 0
      ? bounds.minCell - 1
      : bounds.maxCell + car.length;
    const adjCol = isH
      ? side < 0
        ? bounds.minCell - 1
        : bounds.maxCell + car.length
      : bounds.fixedIndex;

    const imp = clamp(speedIntensity, 0.35, 1.0);
    const blockerCar = this._findOccupantAtCell(boardCars, adjRow, adjCol, car.id);
    const hitType = blockerCar ? "car" : "curb";

    car.pitchVel += -side * 0.34 * imp;

    if (blockerCar) {
      const sameAxis =
        isHorizOrientation(blockerCar.orientation) === isHorizOrientation(car.orientation);
      if (sameAxis) {
        blockerCar.pitchVel += -side * 0.48 * imp;
        blockerCar.heaveVel -= 0.14 * imp;
        blockerCar.rollVel += ((blockerCar.row + blockerCar.col) % 2 === 0 ? 1 : -1) * 0.14 * imp;
        blockerCar.brakeIntensity = Math.max(blockerCar.brakeIntensity, 0.72);
      } else {
        const perpRollSign = isH ? -side : side;
        blockerCar.rollVel += perpRollSign * 0.62 * imp;
        blockerCar.heaveVel -= 0.22 * imp;
        blockerCar.dropVel -= 0.14 * imp;
        blockerCar.brakeIntensity = Math.max(blockerCar.brakeIntensity, 0.68);
      }
    }

    if (playSound) {
      const soundGain = car.boardRole === "ai" ? imp * 0.45 : imp;
      this.audio.playBumpStop(soundGain, { hitType });
    }
    return hitType;
  }

  /**
   * Honest Coordinate-Based Move Executor for `"ai"` (and `"human"` test helper).
   * Clamps strictly to physical 6x6 collision bounds — zero teleporting, zero auto-boost,
   * and zero hidden grid/span/blocker coordinates leaked to AI!
   */
  executeBoardMove(boardRole, moveSpec, { immediate = false, glideDurationBase = 0.21 } = {}) {
    const isAi = boardRole === "ai";
    const boardCars = isAi ? this.aiCars : this.humanCars;
    const boardMap = isAi ? this.aiCarMap : this.humanCarMap;

    if (!moveSpec || !moveSpec.car_coord) {
      return {
        ok: false,
        outcome: "empty_coord",
        movedCells: 0,
        requestedCells: 0,
        spanBefore: "",
        spanAfter: "",
        feedbackText: "empty cell",
      };
    }

    const rawCoord = String(moveSpec.car_coord).trim().toUpperCase();
    const dir = normalizeMoveDirection(moveSpec.direction);
    const reqCells = Math.max(1, Math.min(5, Math.round(Number(moveSpec.cells) || 1)));
    const cmdEcho = `${rawCoord} ${dir} ${reqCells}`;

    const found = findVehicleAtCoord(boardCars, rawCoord);
    const car = found ? boardMap.get(found.id) : null;

    if (!car) {
      this.audio.playTireScrub?.(isAi ? 0.28 : 0.45);
      return {
        ok: false,
        outcome: "empty_coord",
        movedCells: 0,
        requestedCells: reqCells,
        spanBefore: isAi ? "" : rawCoord,
        spanAfter: isAi ? "" : rawCoord,
        feedbackText: `${cmdEcho} -> empty cell`,
      };
    }

    const spanBefore = isAi ? "" : formatVehicleSpan(car);
    const isH = isHorizOrientation(car.orientation);

    const wantsHoriz = dir === "LEFT" || dir === "RIGHT";
    const wantsVert = dir === "UP" || dir === "DOWN";

    if ((isH && !wantsHoriz) || (!isH && !wantsVert)) {
      car.brakeIntensity = 1.0;
      car.rollVel += (isH ? 1 : -1) * 0.44;
      this.audio.playTireScrub?.(isAi ? 0.32 : 0.55);
      return {
        ok: false,
        outcome: "axis_mismatch",
        carId: car.id,
        movedCells: 0,
        requestedCells: reqCells,
        spanBefore,
        spanAfter: spanBefore,
        feedbackText: `${cmdEcho} -> axis mismatch`,
      };
    }

    const sign = dir === "RIGHT" || dir === "DOWN" ? 1 : -1;
    const bounds = computeSlideBounds(boardCars, car.id, GRID_SPEC.gridSize);
    const startCell = bounds.currentCell;
    const goalCol = GRID_SPEC.gridSize - car.length; // col 4 (E3–F3) on 6x6

    let desiredCell = startCell + sign * reqCells;
    if (!isAi && car.isTarget && sign > 0 && isExitCorridorClear(boardCars)) {
      desiredCell = goalCol;
    }

    const destCell = clamp(desiredCell, bounds.minCell, bounds.maxCell);
    const movedCells = Math.abs(destCell - startCell);

    if (movedCells === 0) {
      car.brakeIntensity = 1.0;
      this._applyBoundaryContact(boardCars, car, bounds, sign, 0.68, true);
      if (!isAi) this._addTrauma(0.08);
      if (!immediate) {
        const bn = { car, startCell, sign, elapsed: 0, duration: 0.18 };
        if (isAi) this.aiBumpNudge = bn;
        else this.humanBumpNudge = bn;
      }
      return {
        ok: false,
        outcome: "blocked",
        carId: car.id,
        movedCells: 0,
        requestedCells: reqCells,
        spanBefore,
        spanAfter: spanBefore,
        feedbackText: `${cmdEcho} -> bumped (0 cells moved)`,
      };
    }

    let lapCleared = false;
    if (immediate) {
      car.visualPos = destCell;
      car.snapTarget = destCell;
      car.mode = "idle";
      lapCleared = this._commitLogicalMove(boardRole, car, startCell, destCell, { mode: "auto" });
    } else {
      const spd = state.playbackSpeed || 1;
      car.glideFrom = car.visualPos;
      car.glideTo = destCell;
      car.glideElapsed = 0;
      car.glideDuration = (glideDurationBase + Math.min(4, movedCells) * 0.025) / spd;
      car.mode = "gliding";
      car.instance?.setHighlight?.("dragging");
      lapCleared = this._commitLogicalMove(boardRole, car, startCell, destCell, { mode: "gliding" });
      if (movedCells < reqCells && !lapCleared) {
        this._applyBoundaryContact(boardCars, car, bounds, sign, 0.58, true);
      }
    }

    const spanAfter = isAi ? "" : formatVehicleSpan(car);
    const outcome = lapCleared
      ? "solved"
      : movedCells < reqCells
      ? "partial"
      : "moved";

    const cellWord = movedCells === 1 ? "cell" : "cells";
    const feedbackText = `${cmdEcho} -> moved ${movedCells} ${cellWord}`;

    return {
      ok: true,
      outcome,
      lapCleared,
      carId: car.id,
      movedCells,
      requestedCells: reqCells,
      spanBefore,
      spanAfter,
      feedbackText,
    };
  }

  _normalizePlannedMoves(res) {
    const rawList = Array.isArray(res?.moves) && res.moves.length > 0
      ? res.moves
      : res?.moveSpec
      ? [res.moveSpec]
      : [];

    const normalized = [];
    for (let i = 0; i < rawList.length && normalized.length < 5; i++) {
      const m = rawList[i];
      if (!m) continue;
      const coord = String(m.car_coord || m.coord || m.cell || "").trim().toUpperCase();
      const direction = normalizeMoveDirection(m.direction || m.dir || m.move || "");
      if (!coord || !direction) continue;
      const cells = Math.max(1, Math.min(5, Math.round(Number(m.cells ?? m.steps ?? m.distance) || 1)));
      normalized.push({
        car_coord: coord,
        direction,
        cells,
        summary: String(m.summary || "").trim(),
        isExit: Boolean(m.isExit || (direction === "RIGHT" && /^[A-E]3$/.test(coord) && cells >= 2)),
      });
    }
    return normalized;
  }

  async _callPlanAiRaceMoves(params) {
    if (typeof geminiApi.planAiRaceMoves === "function") {
      return geminiApi.planAiRaceMoves(params);
    }
    throw new Error("Cloud AI race client (planAiRaceMoves) is not yet available in geminiApi.js.");
  }

  /**
   * Independent Fast Multi-Move AI Loop on the Back Board (`boardRole === "ai"`).
   * Streams thoughts/probabilities live, glides 1..5 moves per turn (~0.24s/move),
   * stops mid-batch on physical bump/partial collision, and advances Laps 1..5 independently!
   */
  async _startAiRaceLoop() {
    if (this.aiLoopRunning || state.race.phase !== "racing" || state.race.ai.finished) return;

    this._stopActiveAiLoop();
    this.aiLoopRunning = true;
    const abortCtrl = new AbortController();
    this.aiAbortController = abortCtrl;
    const signal = abortCtrl.signal;

    state.race.ai.errorMessage = "";
    state.hydrogen.errorMessage = "";

    let globalTurn = state.race.ai.turns.length;

    try {
      while (
        state.race.phase === "racing" &&
        !state.race.ai.finished &&
        !signal.aborted
      ) {
        const lap = state.race.ai.currentLap;
        let previousInteractionId = "";
        let lapTurn = 0;
        let feedbackText = "";
        const historyItems = [];

        while (
          state.race.phase === "racing" &&
          state.race.ai.currentLap === lap &&
          !state.race.ai.finished &&
          !state.race.ai.exitingLap &&
          !signal.aborted &&
          lapTurn < 28
        ) {
          await this._waitForAiCarStepSettle(signal);
          if (signal.aborted || state.race.phase !== "racing" || state.race.ai.currentLap !== lap) {
            break;
          }

          globalTurn += 1;
          lapTurn += 1;

          state.race.ai.status = "observing";
          state.hydrogen.status = "observing";
          const imageDataUrl = this._captureAiBoardPng(960, 720);
          const startedAtMs = performance.now();
          const modelOpt = getModelOption(state.race.selectedModel);

          state.hydrogen.currentFrameDataUrl = imageDataUrl;
          state.hydrogen.turnStartedAtMs = startedAtMs;
          state.hydrogen.toolCallsAudited = (Number(state.hydrogen.toolCallsAudited) || 0) + 1;
          state.race.ai.status = "thinking";
          state.hydrogen.status = "thinking";
          state.race.ai.currentTurn = globalTurn;
          state.hydrogen.currentTurn = globalTurn;

          const turnEntry = {
            id: `L${lap}-T${lapTurn}-${globalTurn}`,
            lap,
            turn: globalTurn,
            lapTurn,
            model: modelOpt.id,
            modelLabel: modelOpt.label,
            frameDataUrl: imageDataUrl,
            postMoveFrameDataUrl: "",
            startedAtMs,
            durationSec: null,
            thoughtTokens: 0,
            thinkingText: "",
            targetThinkingText: "",
            _streamCharCursor: 0,
            _apiResolved: false,
            isThinking: true,
            moves: [],
            moveSpec: null,
            moveResults: [],
            summary: "",
            outcome: null,
            movedCells: 0,
            spanBefore: "",
            spanAfter: "",
            feedbackText: "",
            decisionTelemetry: null,
          };

          state.race.ai.turns.push(turnEntry);
          state.hydrogen.totalTurns = state.race.ai.turns.length;
          this._activeStreamingTurn = turnEntry;

          bus.emit(DEMO_EVENTS.AI_TURN_STARTED, {
            lap,
            turn: globalTurn,
            lapTurn,
            frameDataUrl: imageDataUrl,
            turnEntry,
          });
          bus.emit(DEMO_EVENTS.HYDROGEN_TURN_STARTED, {
            turn: globalTurn,
            lap,
            frameDataUrl: imageDataUrl,
            turnEntry,
          });

          const apiRes = await this._callPlanAiRaceMoves({
            model: modelOpt.id,
            previousInteractionId,
            lap,
            turn: lapTurn,
            imageDataUrl,
            feedbackText,
            recentHistoryText: historyItems.slice(-8).join("; "),
            signal,
            onThinkingUpdate: ({ thinkingText, thoughtTokens }) => {
              turnEntry.targetThinkingText = String(thinkingText || "");
              if (thoughtTokens) turnEntry.thoughtTokens = thoughtTokens;
            },
          });

          if (signal.aborted || state.race.phase !== "racing") break;

          const finalTrace = String(apiRes?.thinkingText || turnEntry.targetThinkingText || "");
          turnEntry.targetThinkingText = finalTrace;
          turnEntry._apiResolved = true;
          await this._waitForThoughtStreamerCatchUp(turnEntry, signal, 0.85);
          if (signal.aborted || state.race.phase !== "racing") break;

          this._activeStreamingTurn = null;
          if (turnEntry.thinkingText !== finalTrace) {
            turnEntry.thinkingText = finalTrace;
            this._emitThoughtStreamTick(turnEntry);
          }
          turnEntry.isThinking = false;
          state.hydrogen.turnStartedAtMs = 0;
          turnEntry.durationSec = apiRes?.durationSec ?? +((performance.now() - startedAtMs) / 1000).toFixed(2);
          turnEntry.summary = apiRes?.summary || "";
          turnEntry.decisionTelemetry = apiRes?.decisionTelemetry || null;

          if (apiRes?.interactionId) {
            previousInteractionId = apiRes.interactionId;
            state.hydrogen.conversationId = apiRes.interactionId;
          }
          if (apiRes?.thoughtTokens) {
            turnEntry.thoughtTokens = apiRes.thoughtTokens;
            state.hydrogen.thoughtTokensTotal =
              (Number(state.hydrogen.thoughtTokensTotal) || 0) + apiRes.thoughtTokens;
          }

          const plannedMoves = this._normalizePlannedMoves(apiRes);
          if (plannedMoves.length === 0) {
            feedbackText =
              'No valid moves JSON parsed. End with {"moves":[{"car_coord":"D2","direction":"UP","cells":1}],"summary":"..."}';
            turnEntry.outcome = "empty_coord";
            turnEntry.feedbackText = "No valid move batch returned; re-observing board.";
            bus.emit(DEMO_EVENTS.AI_TURN_COMPLETED, { lap, turn: globalTurn, turnEntry });
            bus.emit(DEMO_EVENTS.HYDROGEN_MOVE_OUTCOME, { turn: globalTurn, outcome: "empty_coord", turnEntry });
            const emptyHoldStartMs = state.race.elapsedMs;
            await this._waitSimSec(1.2, signal);
            state.race.ai.lapStartElapsedMs += Math.max(0, state.race.elapsedMs - emptyHoldStartMs);
            continue;
          }

          turnEntry.moves = plannedMoves;
          turnEntry.moveSpec = plannedMoves[0];
          state.race.ai.status = "moving";
          state.hydrogen.status = "moving";

          bus.emit(DEMO_EVENTS.AI_BATCH_DECIDED, {
            lap,
            turn: globalTurn,
            moves: plannedMoves,
            turnEntry,
          });
          bus.emit(DEMO_EVENTS.HYDROGEN_MOVE_DECIDED, {
            turn: globalTurn,
            moveSpec: plannedMoves[0],
            moves: plannedMoves,
            turnEntry,
          });

          let batchLapCleared = false;
          let batchFeedback = "";

          for (let sIdx = 0; sIdx < plannedMoves.length; sIdx++) {
            if (signal.aborted || state.race.phase !== "racing") break;
            const mv = plannedMoves[sIdx];
            const execRes = this.executeBoardMove("ai", mv, {
              immediate: false,
              glideDurationBase: 0.34,
            });

            if (execRes.lapCleared) {
              mv.isExit = true;
            }

            const stepRecord = {
              moveSpec: mv,
              outcome: execRes.outcome,
              movedCells: execRes.movedCells,
              spanBefore: "",
              spanAfter: "",
              feedbackText: execRes.feedbackText || "",
            };
            turnEntry.moveResults.push(stepRecord);

            historyItems.push(execRes.feedbackText || `${mv.car_coord} ${mv.direction} ${mv.cells}`);

            bus.emit(DEMO_EVENTS.AI_MOVE_STEPPED, {
              lap,
              turn: globalTurn,
              stepIndex: sIdx,
              totalSteps: plannedMoves.length,
              moveSpec: mv,
              result: stepRecord,
              turnEntry,
            });

            await this._waitForAiCarStepSettle(signal);
            for (const c of this.aiCars) {
              c.instance?.setHighlight?.("none");
            }

            if (execRes.lapCleared) {
              batchLapCleared = true;
              batchFeedback = execRes.feedbackText || "";
              break;
            }

            // Stop rest of batch immediately on bump (0 cells) or partial collision!
            if (!execRes.ok || execRes.movedCells === 0 || execRes.outcome === "partial") {
              batchFeedback = execRes.feedbackText || "";
              break;
            }

            // 130ms readable beat between moves in a multi-move batch
            if (sIdx < plannedMoves.length - 1) {
              await this._waitSimSec(0.13, signal);
            }
          }

          feedbackText = batchFeedback;
          const lastStep = turnEntry.moveResults[turnEntry.moveResults.length - 1];
          turnEntry.movedCells = turnEntry.moveResults.reduce((s, r) => s + (r.movedCells || 0), 0);
          turnEntry.outcome = batchLapCleared ? "solved" : lastStep?.outcome || "moved";
          turnEntry.spanBefore = "";
          turnEntry.spanAfter = "";
          turnEntry.feedbackText = feedbackText;

          bus.emit(DEMO_EVENTS.AI_TURN_COMPLETED, {
            lap,
            turn: globalTurn,
            frameDataUrl: imageDataUrl,
            lapCleared: batchLapCleared,
            turnEntry,
          });
          bus.emit(DEMO_EVENTS.HYDROGEN_MOVE_OUTCOME, {
            turn: globalTurn,
            outcome: turnEntry.outcome,
            turnEntry,
          });

          if (batchLapCleared) {
            state.race.ai.status = lap >= TOTAL_LAPS ? "finished" : "lap_clear";
            // Wait for 0.85s East bevel roll-off, then hold remaining dwell (~3.2s total) so viewer can read winning trace!
            const clearHoldStartedMs = state.race.elapsedMs;
            await this._waitForAiLapTransitionSettle(signal);
            if (lap < TOTAL_LAPS && !signal.aborted && state.race.phase === "racing") {
              const alreadyHeldSec = Math.max(0, (state.race.elapsedMs - clearHoldStartedMs) / 1000);
              const remainingDwellSec = Math.max(0.2, 3.2 - alreadyHeldSec);
              await this._waitSimSec(remainingDwellSec, signal);
              if (!signal.aborted && state.race.phase === "racing" && state.race.ai.currentLap === lap) {
                this._finalizeRacerLapExit("ai", lap);
              }
            }
            break;
          }

          // Non-clearing turn: hold ~1.2s readable dwell without inflating AI lap split time!
          if (!signal.aborted && state.race.phase === "racing") {
            const turnHoldStartMs = state.race.elapsedMs;
            await this._waitSimSec(1.2, signal);
            state.race.ai.lapStartElapsedMs += Math.max(0, state.race.elapsedMs - turnHoldStartMs);
          }
        }
      }
    } catch (err) {
      if (!signal.aborted) {
        state.hydrogen.turnStartedAtMs = 0;
        const activeTurn = state.race.ai.turns[state.race.ai.turns.length - 1];
        if (activeTurn && activeTurn.isThinking) {
          activeTurn.isThinking = false;
        }
        const msg = String(err?.message || err || "AI race request failed.");
        state.race.ai.status = "error";
        state.race.ai.errorMessage = msg;
        state.hydrogen.status = "error";
        state.hydrogen.errorMessage = msg;
        bus.emit(DEMO_EVENTS.AI_STATUS_CHANGED, { status: "error", errorMessage: msg });
        bus.emit(DEMO_EVENTS.HYDROGEN_BRIDGE_STATUS, { errorMessage: msg });
        console.warn("[ParkingBenchAI]", err);
      }
    } finally {
      this.aiLoopRunning = false;
      state.hydrogen.turnStartedAtMs = 0;
      if (state.race.ai.finished) {
        state.race.ai.status = "finished";
        state.hydrogen.status = "solved";
      } else if (state.race.ai.status !== "error") {
        state.race.ai.status = "idle";
        state.hydrogen.status = "idle";
      }
    }
  }

  _onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    this.audio.resume();
    this.world.interruptOpeningSettle?.();

    const hitCar = this._raycastHumanVehicle(e.clientX, e.clientY);

    // During "setup" (or "countdown"), human dragging is locked until GO!
    if (!this._canHumanInteract()) {
      if (hitCar && state.race.phase === "setup") {
        state.race.setupNudgeCount += 1;
        hitCar.rollVel += 0.22;
        hitCar.brakeIntensity = 0.85;
        this.audio.playDetentSnap(0.38);
        bus.emit(DEMO_EVENTS.RACE_SETUP_NUDGE, {
          count: state.race.setupNudgeCount,
          carId: hitCar.id,
        });
        return;
      }
      this._bgPointerDown = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        maxDistPx: 0,
        isOrbiting: false,
      };
      this._syncCanvasCursor();
      return;
    }

    if (!hitCar) {
      if (this.selectedCarId !== null) {
        this.selectedCarId = null;
        this._refreshCarHighlights();
        if (!this.hoveredCarId) this._hideCorridorGuide();
      }
      this._bgPointerDown = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        maxDistPx: 0,
        isOrbiting: false,
      };
      this._syncCanvasCursor();
      return;
    }

    this._bgPointerDown = null;
    this.selectedCarId = hitCar.id;

    if (this.world.controls) {
      this.world.controls.cancelDrag?.();
      this.world.controls.enabled = false;
    }

    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    for (const c of this.humanCars) {
      if (c.id !== hitCar.id && (c.mode === "snapping" || c.mode === "gliding")) {
        const logical = isHorizOrientation(c.orientation) ? c.col : c.row;
        c.visualPos = logical;
        c.snapTarget = logical;
        c.snapVel = 0;
        c.mode = "idle";
      }
    }

    const isH = isHorizOrientation(hitCar.orientation);
    const bounds = computeSlideBounds(this.humanCars, hitCar.id);
    const startCell = isH ? hitCar.col : hitCar.row;
    hitCar.visualPos =
      hitCar.mode === "snapping" || hitCar.mode === "gliding" ? hitCar.visualPos : startCell;
    hitCar.mode = "dragging";
    hitCar.snapVel = 0;

    const { wx, wz } = this._carWorldCenter(hitCar);
    const planePt = this._intersectDragPlane(e.clientX, e.clientY, wx, wz);
    const hitPrimaryWorld = isH ? planePt.x : planePt.z;
    const hitCrossWorld = isH ? planePt.z : planePt.x;
    const humanOffset = BOARD_OFFSETS.human;
    const carStartWorld = isH
      ? GRID_SPEC.cellToWorldX(startCell, hitCar.length) + humanOffset.x
      : GRID_SPEC.cellToWorldZ(startCell, hitCar.length) + humanOffset.z;

    this.dragState = {
      pointerId: e.pointerId,
      carId: hitCar.id,
      startX: e.clientX,
      startY: e.clientY,
      maxPointerDistPx: 0,
      startCell,
      minCell: bounds.minCell,
      maxCell: bounds.maxCell,
      fixedIndex: bounds.fixedIndex,
      bounds,
      carStartWorld,
      startCrossWorld: hitCrossWorld,
      grabOffsetMeters: hitPrimaryWorld - carStartWorld,
      desiredCell: hitCar.visualPos,
      atStopSide: 0,
      scrubSide: 0,
    };

    this._syncCanvasCursor();
    this._refreshCarHighlights();
    this._showCorridorForCar(hitCar, bounds);
  }

  _onPointerMove(e) {
    if (this.dragState) {
      if (e.pointerId !== undefined && e.pointerId !== this.dragState.pointerId) return;

      const drag = this.dragState;
      const car = this.humanCarMap.get(drag.carId);
      if (!car) return;

      const distPx = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (distPx > drag.maxPointerDistPx) drag.maxPointerDistPx = distPx;

      const isH = isHorizOrientation(car.orientation);
      const { wx, wz } = this._carWorldCenter(car);
      const planePt = this._intersectDragPlane(e.clientX, e.clientY, wx, wz);
      const pointerPrimaryWorld = isH ? planePt.x : planePt.z;
      const pointerCrossWorld = isH ? planePt.z : planePt.x;

      const crossDelta = pointerCrossWorld - drag.startCrossWorld;
      const signedStrain = clamp(crossDelta / 1.12, -1.0, 1.0);
      car.rollTarget = (isH ? 1 : -1) * signedStrain * MAX_CHASSIS_ROLL_RAD;

      const absStrain = Math.abs(signedStrain);
      if (absStrain > 0.38) {
        const curSide = Math.sign(signedStrain);
        if (drag.scrubSide !== curSide) {
          drag.scrubSide = curSide;
          this.audio.playTireScrub?.(clamp(absStrain, 0.38, 1.0));
        }
      } else if (absStrain < 0.18) {
        drag.scrubSide = 0;
      }

      const desiredWorld = pointerPrimaryWorld - drag.grabOffsetMeters;
      const rawCell = drag.startCell + (desiredWorld - drag.carStartWorld) / GRID_SPEC.cellSize;

      const cushionCells = RUBBER_BAND_METERS / GRID_SPEC.cellSize;
      const goalCol = GRID_SPEC.gridSize - car.length;
      let clampedCell = rawCell;

      if (rawCell < drag.minCell) {
        const over = drag.minCell - rawCell;
        clampedCell = drag.minCell - cushionCells * Math.tanh(over * 3.6);
        if (over > 0.035 && drag.atStopSide !== -1) {
          drag.atStopSide = -1;
          car.brakeIntensity = 1.0;
          this._applyBoundaryContact(
            this.humanCars,
            car,
            drag.bounds,
            -1,
            clamp(0.45 + over * 0.7, 0.45, 1.0),
            true
          );
          this._addTrauma(0.08);
        }
      } else if (rawCell > drag.maxCell) {
        const over = rawCell - drag.maxCell;
        const isOpenExitThreshold = car.isTarget && drag.maxCell === goalCol;
        if (isOpenExitThreshold) {
          clampedCell = drag.maxCell + 0.44 * Math.tanh(over * 1.5);
          if (rawCell >= goalCol + 0.55) {
            car.rollTarget = 0;
            this.dragState = null;
            try {
              this.canvas.releasePointerCapture(drag.pointerId);
            } catch (_) {}
            if (this.world.controls && state.cameraMode !== "top") {
              this.world.controls.cancelDrag?.();
              this.world.controls.enabled = true;
            }
            this._commitLogicalMove("human", car, drag.startCell, goalCol, { mode: "snapping" });
            return;
          }
        } else {
          clampedCell = drag.maxCell + cushionCells * Math.tanh(over * 3.6);
          if (over > 0.035 && drag.atStopSide !== 1) {
            drag.atStopSide = 1;
            car.brakeIntensity = 1.0;
            this._applyBoundaryContact(
              this.humanCars,
              car,
              drag.bounds,
              1,
              clamp(0.45 + over * 0.7, 0.45, 1.0),
              true
            );
            this._addTrauma(0.08);
          }
        }
      } else if (rawCell > drag.minCell + 0.06 && rawCell < drag.maxCell - 0.06) {
        drag.atStopSide = 0;
      }

      drag.desiredCell = clampedCell;
      return;
    }

    if (this._bgPointerDown) {
      if (e.pointerId === undefined || e.pointerId === this._bgPointerDown.pointerId) {
        const d = Math.hypot(
          e.clientX - this._bgPointerDown.startX,
          e.clientY - this._bgPointerDown.startY
        );
        if (d > this._bgPointerDown.maxDistPx) this._bgPointerDown.maxDistPx = d;
        if (d >= 4.0 && this.world?.controls?.enabled && this.world?.controls?._isDragging) {
          this._bgPointerDown.isOrbiting = true;
        }
        this._syncCanvasCursor();
        if (this._bgPointerDown.isOrbiting) return;
      }
    }

    const rect = this.canvas.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (!inside) {
      this._setHoveredCar(null);
      return;
    }

    const canHoverCars = this._canHumanInteract() || state.race.phase === "setup";
    const hovered = canHoverCars ? this._raycastHumanVehicle(e.clientX, e.clientY) : null;
    this._setHoveredCar(hovered ? hovered.id : null);
  }

  _onPointerUp(e) {
    if (!this.dragState) {
      if (
        this._bgPointerDown &&
        (e.pointerId === undefined || e.pointerId === this._bgPointerDown.pointerId)
      ) {
        this._bgPointerDown = null;
        this._syncCanvasCursor();
      }
      return;
    }

    if (e.pointerId !== undefined && e.pointerId !== this.dragState.pointerId) return;

    const drag = this.dragState;
    this.dragState = null;

    try {
      this.canvas.releasePointerCapture(drag.pointerId);
    } catch (_) {}

    if (this.world.controls && state.cameraMode !== "top") {
      this.world.controls.cancelDrag?.();
      this.world.controls.enabled = true;
    }

    const car = this.humanCarMap.get(drag.carId);
    if (!car) {
      this._syncCanvasCursor();
      return;
    }

    car.rollTarget = 0;

    if (drag.maxPointerDistPx >= QUICK_TAP_THRESHOLD_PX) {
      const snappedCell = clamp(Math.round(drag.desiredCell), drag.minCell, drag.maxCell);
      car.snapTarget = snappedCell;
      car.mode = "snapping";
      car.brakeIntensity = 1.0;
      car.rollVel += ((car.row + car.col) % 2 === 0 ? 1 : -1) * 0.16;

      if (snappedCell !== drag.startCell) {
        this._commitLogicalMove("human", car, drag.startCell, snappedCell, { mode: "snapping" });
      } else {
        this.audio.playDetentSnap(0.45);
      }
    } else {
      car.snapTarget = drag.startCell;
      car.mode = "snapping";
      this._handleQuickTap(car, drag);
    }

    this._refreshCarHighlights();
    if (this._canHumanInteract()) {
      const stillHovered = this._raycastHumanVehicle(e.clientX, e.clientY);
      this.hoveredCarId = stillHovered ? stillHovered.id : null;
      this._refreshCarHighlights();
      this._syncCanvasCursor();
      this._syncIdleCorridorGuide();
    } else {
      this._syncCanvasCursor();
    }
  }

  _handleQuickTap(car, drag) {
    const goalCol = GRID_SPEC.gridSize - car.length;
    if (car.isTarget && isExitCorridorClear(this.humanCars) && drag.startCell < goalCol) {
      this._commitLogicalMove("human", car, drag.startCell, goalCol, { mode: "quick_exit" });
      return;
    }

    const canReverse = drag.minCell < drag.startCell;
    const canForward = drag.maxCell > drag.startCell;

    if (canForward && !canReverse) {
      this._startSmoothHumanGlide(car, drag.startCell, drag.startCell + 1);
      return;
    }
    if (canReverse && !canForward) {
      this._startSmoothHumanGlide(car, drag.startCell, drag.startCell - 1);
      return;
    }
    if (!canForward && !canReverse) {
      car.brakeIntensity = 1.0;
      const bounds = drag.bounds || computeSlideBounds(this.humanCars, car.id);
      const hitFwd = this._applyBoundaryContact(this.humanCars, car, bounds, 1, 0.55, false);
      const hitRev = this._applyBoundaryContact(this.humanCars, car, bounds, -1, 0.45, false);
      const hitType = hitFwd === "car" || hitRev === "car" ? "car" : "curb";
      this.audio.playBumpStop(0.55, { hitType });
      this._addTrauma(0.06);
      return;
    }

    this.selectedCarId = car.id;
    this.audio.playDetentSnap(0.35);
  }

  _onKeyDown(e) {
    if (e.defaultPrevented || e.repeat || this.dragState) return;
    const tag = e.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) {
      return;
    }

    if (e.code === "Space" && state.race.phase === "setup") {
      e.preventDefault();
      this.audio.resume();
      dispatchAction(DEMO_ACTIONS.START_RACE, { freshPack: false });
      return;
    }

    const hasCtrlOrCmd = Boolean(e.ctrlKey || e.metaKey);
    if (hasCtrlOrCmd && !e.altKey && !e.shiftKey && e.code === "KeyZ") {
      e.preventDefault();
      if (this._canHumanInteract() && this.humanUndoStack.length > 0) {
        this.audio.resume();
        dispatchAction(DEMO_ACTIONS.TRIGGER_UNDO);
      }
      return;
    }
    if (hasCtrlOrCmd || e.altKey) return;

    if (!e.shiftKey && (e.code === "KeyC" || e.code === "KeyV")) {
      e.preventDefault();
      this.audio.resume();
      this.world.interruptOpeningSettle?.();
      dispatchAction(DEMO_ACTIONS.TOGGLE_CAMERA);
      return;
    }

    if (!e.shiftKey && (e.code === "KeyZ" || e.code === "Backspace")) {
      if (this._canHumanInteract() && this.humanUndoStack.length > 0) {
        e.preventDefault();
        this.audio.resume();
        dispatchAction(DEMO_ACTIONS.TRIGGER_UNDO);
      }
      return;
    }

    if (!e.shiftKey && e.code === "KeyR") {
      e.preventDefault();
      this.audio.resume();
      dispatchAction(DEMO_ACTIONS.RESET_HUMAN_LAP);
      return;
    }

    if (!this._canHumanInteract()) return;

    let axis = null;
    let step = 0;
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        axis = "h";
        step = -1;
        break;
      case "ArrowRight":
      case "KeyD":
        axis = "h";
        step = 1;
        break;
      case "ArrowUp":
      case "KeyW":
        axis = "v";
        step = -1;
        break;
      case "ArrowDown":
      case "KeyS":
        axis = "v";
        step = 1;
        break;
      default:
        return;
    }

    const activeId = this.selectedCarId || this.hoveredCarId || "target";
    const car = this.humanCarMap.get(activeId);
    if (!car) return;

    e.preventDefault();
    this.audio.resume();
    this.world.interruptOpeningSettle?.();

    this.selectedCarId = car.id;
    this._refreshCarHighlights();

    const carAxis = isHorizOrientation(car.orientation) ? "h" : "v";
    if (carAxis !== axis) {
      car.brakeIntensity = 1.0;
      car.rollVel += (carAxis === "h" ? 1 : -1) * step * 0.46;
      this.audio.playTireScrub?.(0.55);
      this._showCorridorForCar(car, computeSlideBounds(this.humanCars, car.id));
      return;
    }

    const bounds = computeSlideBounds(this.humanCars, car.id);
    const startCell = carAxis === "h" ? car.col : car.row;
    const targetCell =
      car.isTarget && step > 0 && isExitCorridorClear(this.humanCars)
        ? GRID_SPEC.gridSize - car.length
        : startCell + step;

    if (targetCell < bounds.minCell || targetCell > bounds.maxCell) {
      car.brakeIntensity = 1.0;
      this._applyBoundaryContact(
        this.humanCars,
        car,
        bounds,
        targetCell < bounds.minCell ? -1 : 1,
        0.58,
        true
      );
      this._addTrauma(0.06);
      this._showCorridorForCar(car, bounds);
      return;
    }

    if (car.isTarget && targetCell === GRID_SPEC.gridSize - car.length) {
      this._commitLogicalMove("human", car, startCell, targetCell, { mode: "quick_exit" });
    } else {
      this._startSmoothHumanGlide(car, startCell, targetCell);
      if (this._canHumanInteract()) {
        this._refreshCarHighlights();
        this._showCorridorForCar(car, computeSlideBounds(this.humanCars, car.id));
      }
    }
  }

  _startSmoothHumanGlide(car, fromCell, toCell) {
    car.glideFrom = car.visualPos;
    car.glideTo = toCell;
    car.glideElapsed = 0;
    car.glideDuration = 0.20 + Math.min(4, Math.abs(toCell - fromCell)) * 0.04;
    car.mode = "gliding";
    car.rollVel += ((car.row + car.col) % 2 === 0 ? 1 : -1) * 0.14;
    this._commitLogicalMove("human", car, fromCell, toCell, { mode: "gliding" });
  }

  _commitLogicalMove(boardRole, car, fromCell, toCell, { mode = "snapping", recordUndo = true } = {}) {
    if (isHorizOrientation(car.orientation)) car.col = toCell;
    else car.row = toCell;

    const goalCol = GRID_SPEC.gridSize - car.length;
    const isWinningExit = car.isTarget && toCell === goalCol;

    if (boardRole === "ai") {
      state.race.ai.lapMoves += 1;
      state.race.ai.totalMoves += 1;
      this.audio.playDetentSnap(isWinningExit ? 0.28 : 0.42);
      this._syncExitCorridorState("ai");
      if (isWinningExit) {
        this._onRacerLapCleared("ai", { fromQuickGlide: mode === "quick_exit" || mode === "gliding" });
        return true;
      }
      return false;
    }

    if (recordUndo) {
      this.humanUndoStack.push({ carId: car.id, fromCell, toCell });
    }
    state.race.human.lapMoves += 1;
    state.race.human.totalMoves += 1;
    this.audio.playDetentSnap(isWinningExit ? 0.45 : 0.92);
    this._syncExitCorridorState("human");
    this._emitHumanMoveSync();

    if (isWinningExit) {
      this._onRacerLapCleared("human", { fromQuickGlide: mode === "quick_exit" });
      return true;
    }
    return false;
  }

  _checkAndRecordWinner(boardRole, totalTimeMs) {
    if (state.race.winner) return;
    state.race.winner = boardRole;
    state.race.winnerTimeMs = totalTimeMs;
    this.audio.playRaceFinishFanfare(boardRole);
    bus.emit(DEMO_EVENTS.RACE_WINNER_DECIDED, {
      winner: boardRole,
      totalTimeMs,
      opponentLabel: state.race.opponentLabel,
    });
  }

  _onRacerLapCleared(boardRole, { fromQuickGlide = false } = {}) {
    const isAi = boardRole === "ai";
    const racer = isAi ? state.race.ai : state.race.human;
    if (racer.exitingLap || racer.finished) return;

    const lap = racer.currentLap;
    const lapDurationMs = Math.max(1, Math.round(state.race.elapsedMs - racer.lapStartElapsedMs));

    racer.lapSplitsMs[lap - 1] = lapDurationMs;
    const cumulativeSplitsSum = racer.lapSplitsMs
      .slice(0, lap)
      .reduce((acc, v) => acc + (Number(v) || 0), 0);
    racer.cumulativeSplitsMs[lap - 1] = cumulativeSplitsSum;
    racer.completedLaps = lap;
    racer.exitingLap = true;

    const isFinalLap = lap >= TOTAL_LAPS;
    if (isFinalLap) {
      racer.finished = true;
      racer.totalTimeMs = cumulativeSplitsSum;
      this._checkAndRecordWinner(boardRole, cumulativeSplitsSum);
    }

    if (isAi) {
      this._setWorldExitGate("ai", true, false);
      this.audio.playAiLapChime(lap, isFinalLap);
      const aiTarget = this.aiCarMap.get("target");
      if (aiTarget) {
        aiTarget.mode = "exiting";
        aiTarget.rollTarget = 0;
        aiTarget.instance?.setHighlight?.("none");
        this.aiExitSequence = {
          car: aiTarget,
          lap,
          startCol: aiTarget.visualPos,
          destCol: EXIT_DEST_COL,
          elapsed: 0,
          duration: LAP_EXIT_DURATION_SEC,
          initialVelCells: clamp(aiTarget.smoothVel / GRID_SPEC.cellSize, 0, 7.0),
        };
      } else {
        this._finalizeRacerLapExit("ai", lap);
      }
    } else {
      this._cancelActiveDrag();
      this.humanUndoStack = [];
      this.selectedCarId = null;
      this.hoveredCarId = null;
      this._refreshCarHighlights();
      this._hideCorridorGuide();
      this._setWorldExitGate("human", true, false);
      if (!isFinalLap) {
        this.audio.playCourtyardExit();
      }
      dispatchAction(DEMO_ACTIONS.LEVEL_SOLVED, {
        level: lap,
        moves: racer.lapMoves,
      });

      const humanTarget = this.humanCarMap.get("target");
      if (humanTarget) {
        humanTarget.mode = "exiting";
        humanTarget.rollTarget = 0;
        humanTarget.instance?.setHighlight?.("none");
        this.humanExitSequence = {
          car: humanTarget,
          lap,
          startCol: humanTarget.visualPos,
          destCol: EXIT_DEST_COL,
          elapsed: 0,
          duration: LAP_EXIT_DURATION_SEC,
          initialVelCells: fromQuickGlide
            ? 0
            : clamp(humanTarget.smoothVel / GRID_SPEC.cellSize, 0, 8.0),
        };
      } else {
        this._finalizeRacerLapExit("human", lap);
      }
      this._emitHumanMoveSync();
      this._syncCanvasCursor();
    }

    bus.emit(DEMO_EVENTS.RACE_LAP_COMPLETED, {
      boardRole,
      lap,
      lapDurationMs,
      cumulativeMs: cumulativeSplitsSum,
      nextLap: isFinalLap ? null : lap + 1,
      finished: isFinalLap,
    });
  }

  _finalizeRacerLapExit(boardRole, completedLap) {
    const isAi = boardRole === "ai";
    const racer = isAi ? state.race.ai : state.race.human;
    racer.exitingLap = false;

    if (completedLap < TOTAL_LAPS && state.race.phase === "racing") {
      const nextLap = completedLap + 1;
      racer.currentLap = nextLap;
      racer.lapStartElapsedMs = state.race.elapsedMs;
      racer.lapMoves = 0;
      this._spawnBoardLap(boardRole, nextLap, { immediateGate: true });

      if (!isAi) {
        this._emitHumanMoveSync();
        this._syncCanvasCursor();
      }
      bus.emit(DEMO_EVENTS.RACE_LAP_SPAWNED, {
        boardRole,
        lap: nextLap,
        vehicleCount: isAi ? this.aiCars.length : this.humanCars.length,
      });
      return;
    }

    // Completed Lap 5! Check if race should transition to "finished"
    const bothDone = state.race.human.finished && state.race.ai.finished;
    const autoEndAi =
      isAi && state.isAutoplay && state.race.human.totalMoves === 0;

    if ((bothDone || autoEndAi) && state.race.phase === "racing") {
      dispatchAction(DEMO_ACTIONS.FINISH_RACE);
    }
    this._syncCanvasCursor();
  }

  _updateBoardExitSequence(boardRole, dt) {
    const seq = boardRole === "ai" ? this.aiExitSequence : this.humanExitSequence;
    if (!seq) return;
    const car = seq.car;

    seq.elapsed += dt;
    const T = seq.duration;
    const tau = clamp(seq.elapsed / T, 0, 1);

    const deltaCol = Math.max(0.01, seq.destCol - seq.startCol);
    const kCoast = 1.82;
    const v0 = clamp((seq.initialVelCells * T) / deltaCol, 0, 1.72);
    const baseTauPeak = 0.26;
    const tauPeak = v0 > 0.75 ? Math.min(baseTauPeak, 0.16) : baseTauPeak;
    const vPeak =
      (kCoast * (1 - 0.5 * v0 * tauPeak)) / Math.max(0.1, 1 + (0.5 * kCoast - 1) * tauPeak);
    const pPeak = 0.5 * (v0 + vPeak) * tauPeak;

    let progress;
    if (tau <= tauPeak && tauPeak > 1e-4) {
      const aPush = (vPeak - v0) / tauPeak;
      progress = v0 * tau + 0.5 * aPush * tau * tau;
    } else {
      const u = clamp((tau - tauPeak) / Math.max(1e-4, 1 - tauPeak), 0, 1);
      progress = pPeak + (1 - pPeak) * (1 - Math.pow(1 - u, kCoast));
    }

    car.visualPos = seq.startCol + deltaCol * progress;
    car.brakeIntensity = tau > 0.9 ? 0.16 : 0.22;

    if (tau >= 1.0) {
      car.visualPos = seq.destCol;
      car.mode = "idle";
      if (boardRole === "ai") {
        this.aiExitSequence = null;
        // When AI loop is running on laps 1..4, keep red coupe resting on the East runway during the ~3.2s reading hold!
        if (!this.aiLoopRunning || seq.lap >= TOTAL_LAPS) {
          this._finalizeRacerLapExit("ai", seq.lap);
        }
      } else {
        this.humanExitSequence = null;
        this._finalizeRacerLapExit("human", seq.lap);
      }
    }
  }

  _updateBumpNudge(boardRole, dt) {
    const bn = boardRole === "ai" ? this.aiBumpNudge : this.humanBumpNudge;
    if (!bn) return;
    bn.elapsed += dt;
    const u = clamp(bn.elapsed / bn.duration, 0, 1);
    const pulse = Math.sin(u * Math.PI) * (1 - u * 0.45) * 0.16 * bn.sign;
    bn.car.visualPos = bn.startCell + pulse;
    if (u >= 1.0) {
      bn.car.visualPos = bn.startCell;
      if (boardRole === "ai") this.aiBumpNudge = null;
      else this.humanBumpNudge = null;
    }
  }

  _cancelActiveDrag() {
    if (!this.dragState) return;
    const drag = this.dragState;
    this.dragState = null;
    try {
      this.canvas.releasePointerCapture(drag.pointerId);
    } catch (_) {}
    const car = this.humanCarMap.get(drag.carId);
    if (car) {
      const logical = isHorizOrientation(car.orientation) ? car.col : car.row;
      car.visualPos = logical;
      car.snapTarget = logical;
      car.snapVel = 0;
      car.rollTarget = 0;
      car.mode = "idle";
      car.instance?.setHighlight?.("none");
    }
    if (this.world.controls && state.cameraMode !== "top") {
      this.world.controls.cancelDrag?.();
      this.world.controls.enabled = true;
    }
    this._syncCanvasCursor();
  }

  clearHint({ silent = false } = {}) {
    if (!this.hintState && !state.activeHint) return;
    this.hintState = null;
    this.world.setHintIndicator?.({
      visible: false,
      worldX: 0,
      worldZ: 0,
      dirX: 1,
      dirZ: 0,
      distanceCells: 0,
    });
    this._refreshCarHighlights();
    if (!silent && state.activeHint) dispatchAction(DEMO_ACTIONS.SHOW_HINT, { carId: null });
  }

  triggerUndo() {
    if (!this._canHumanInteract() || this.humanUndoStack.length === 0) return;
    this._cancelActiveDrag();
    this.audio.resume();

    const last = this.humanUndoStack.pop();
    const car = this.humanCarMap.get(last.carId);
    if (!car) return;

    if (isHorizOrientation(car.orientation)) car.col = last.fromCell;
    else car.row = last.fromCell;

    car.glideFrom = car.visualPos;
    car.glideTo = last.fromCell;
    car.glideElapsed = 0;
    car.glideDuration = 0.22;
    car.mode = "gliding";
    car.brakeIntensity = 0.85;
    car.rollVel += ((car.row + car.col) % 2 === 0 ? -1 : 1) * 0.14;

    state.race.human.lapMoves = Math.max(0, state.race.human.lapMoves - 1);
    state.race.human.totalMoves = Math.max(0, state.race.human.totalMoves - 1);
    this.audio.playUndoSlide();
    this._syncExitCorridorState("human");
    this._emitHumanMoveSync();
    this._refreshCarHighlights();
    this._syncIdleCorridorGuide();
  }

  _addTrauma(amount) {
    this.trauma = Math.min(0.28, this.trauma + amount);
  }

  _updateSingleBoardPhysics(boardCars, offset, dt, boardRole) {
    let maxSpeedMetersPerSec = 0;
    let dominantIsTarget = false;
    let dominantWorldX = 0;
    const isAi = boardRole === "ai";
    const audioScale = isAi ? 0.42 : 1.0;

    for (let i = 0; i < boardCars.length; i++) {
      const car = boardCars[i];
      const isH = isHorizOrientation(car.orientation);

      if (!isAi && car.mode === "dragging" && this.dragState && this.dragState.carId === car.id) {
        const trackAlpha = 1 - Math.exp(-44 * dt);
        car.visualPos += (this.dragState.desiredCell - car.visualPos) * trackAlpha;
      } else if (car.mode === "snapping") {
        const snapStep = stepDampedSpringVerlet(
          car.visualPos,
          car.snapVel,
          car.snapTarget,
          SNAP_STIFFNESS,
          SNAP_DAMPING,
          dt
        );
        car.visualPos = snapStep.pos;
        car.snapVel = snapStep.vel;
        if (Math.abs(car.visualPos - car.snapTarget) < 0.0006 && Math.abs(car.snapVel) < 0.004) {
          car.visualPos = car.snapTarget;
          car.snapVel = 0;
          car.mode = "idle";
        }
      } else if (car.mode === "gliding") {
        car.glideElapsed += dt;
        const tau = clamp(car.glideElapsed / car.glideDuration, 0, 1);
        car.visualPos = car.glideFrom + (car.glideTo - car.glideFrom) * minJerk01(tau);
        if (tau >= 1.0) {
          car.visualPos = car.glideTo;
          car.mode = "idle";
          car.brakeIntensity = 1.0;
          if (!isAi) {
            car.instance?.setHighlight?.("none");
            if (this._canHumanInteract() && this.selectedCarId === car.id) {
              this._syncIdleCorridorGuide();
            }
          } else {
            car.instance?.setHighlight?.("none");
          }
        }
      }

      const localX = isH
        ? GRID_SPEC.cellToWorldX(car.visualPos, car.length)
        : GRID_SPEC.cellToWorldX(car.col, 1);
      const localZ = !isH
        ? GRID_SPEC.cellToWorldZ(car.visualPos, car.length)
        : GRID_SPEC.cellToWorldZ(car.row, 1);
      const worldX = localX + offset.x;
      const worldZ = localZ + offset.z;

      car.worldX = worldX;
      car.worldZ = worldZ;

      const currPrimary = isH ? worldX : worldZ;
      const dS = currPrimary - car.lastWorldPrimary;
      car.lastWorldPrimary = currPrimary;

      const rawVel = dS / dt;
      const absSpeed = Math.abs(rawVel);
      const weightedSpeed = absSpeed * audioScale;
      if (weightedSpeed > maxSpeedMetersPerSec) {
        maxSpeedMetersPerSec = weightedSpeed;
        dominantIsTarget = Boolean(car.isTarget);
        dominantWorldX = worldX;
      }

      if (car.mode !== "dragging") {
        if (absSpeed > 0.65) {
          const speedFactor = clamp((absSpeed - 0.65) / 9.0, 0, 1);
          car.rollTarget = Math.sin(currPrimary * 3.25) * 0.012 * speedFactor;
        } else {
          car.rollTarget = 0;
        }
      }

      let pose;
      if (
        isH &&
        car.row === GRID_SPEC.exitRow &&
        worldX + car.frontAxleOffset > BOARD_PHYSICS.bevelStartX
      ) {
        pose = BOARD_PHYSICS.evalTwoAxleExitPose(
          worldX,
          car.frontAxleOffset,
          car.rearAxleOffset,
          car.wheelRadius
        );

        if (pose.frontAxleX >= BOARD_PHYSICS.bevelEndX && !car.prevFrontOnTable) {
          car.prevFrontOnTable = true;
          car.dropVel -= 0.26;
          car.pitchVel += 0.55;
          car.rollVel += 0.14;
          this.audio.playTableDrop?.("front", clamp((absSpeed / 10) * audioScale, 0.25, 1.0));
        }
        if (pose.rearAxleX >= BOARD_PHYSICS.bevelEndX && !car.prevRearOnTable) {
          car.prevRearOnTable = true;
          car.dropVel -= 0.30;
          car.pitchVel -= 0.62;
          car.rollVel -= 0.16;
          if (!isAi) this._addTrauma(0.045);
          this.audio.playTableDrop?.("rear", clamp((absSpeed / 9) * audioScale, 0.28, 1.0));
        }
      } else {
        pose = {
          rootY: BOARD_PHYSICS.deckY,
          baseRootY: BOARD_PHYSICS.deckY,
          tangentLift: 0,
          pitchRad: 0,
          frontAxleX: worldX + car.frontAxleOffset,
          rearAxleX: worldX - car.rearAxleOffset,
          frontSurfaceY: BOARD_PHYSICS.deckY,
          rearSurfaceY: BOARD_PHYSICS.deckY,
        };
        if (worldX + car.frontAxleOffset <= BOARD_PHYSICS.bevelStartX) {
          car.prevFrontOnTable = false;
          car.prevRearOnTable = false;
        }
      }
      car.terrainPitch = pose.pitchRad;

      const dropStep = stepDampedSpringVerlet(
        car.dropHeave,
        car.dropVel,
        0,
        DROP_STIFFNESS,
        DROP_DAMPING,
        dt
      );
      car.dropHeave = dropStep.pos;
      car.dropVel = dropStep.vel;
      if (car.dropHeave < -0.018) {
        car.dropHeave = -0.018;
        if (car.dropVel < 0) car.dropVel = 0;
      }

      const dRootY = pose.rootY - car.lastRootY;
      car.lastRootY = pose.rootY;
      const dS_arc = Math.sign(dS) * Math.hypot(dS, dRootY);
      if (Math.abs(dS_arc) > 1e-6 && car.wheels.length > 0) {
        const dTheta = dS_arc / car.wheelRadius;
        for (let w = 0; w < car.wheels.length; w++) {
          car.wheels[w].obj.rotation.x += dTheta * car.wheels[w].spinSign;
        }
      }

      const velBlend = Math.min(1, dt * 26);
      car.smoothVel += (rawVel - car.smoothVel) * velBlend;
      const longAccel = clamp((car.smoothVel - car.prevSmoothVel) / dt, -22, 22);
      car.prevSmoothVel = car.smoothVel;

      const targetPitch = clamp(-longAccel * 0.0018, -0.028, 0.028);
      const pitchStep = stepDampedSpringVerlet(
        car.pitchAngle,
        car.pitchVel,
        targetPitch,
        PITCH_STIFFNESS,
        PITCH_DAMPING,
        dt
      );
      car.pitchAngle = pitchStep.pos;
      car.pitchVel = pitchStep.vel;

      const rollStep = stepDampedSpringVerlet(
        car.rollAngle,
        car.rollVel,
        car.rollTarget,
        ROLL_STIFFNESS,
        ROLL_DAMPING,
        dt
      );
      car.rollAngle = clamp(rollStep.pos, -0.032, 0.032);
      car.rollVel = rollStep.vel;

      const targetHeave = -Math.abs(car.pitchAngle) * 0.16 - Math.abs(car.rollAngle) * 0.08;
      const heaveStep = stepDampedSpringVerlet(
        car.heaveOffset,
        car.heaveVel,
        targetHeave,
        HEAVE_STIFFNESS,
        HEAVE_DAMPING,
        dt
      );
      car.heaveOffset = Math.max(-0.016, heaveStep.pos);
      car.heaveVel = heaveStep.vel;

      const hasSetTerrainPose = typeof car.instance?.setTerrainPose === "function";
      const bodyRig = car.instance?.bodyRig || car.chassis?.parent;
      const hasSeparateBodyRig = Boolean(bodyRig && bodyRig !== car.instance?.root);

      if (car.instance?.root) {
        car.instance.root.position.set(worldX, pose.rootY, worldZ);
      }
      if (hasSetTerrainPose) {
        car.instance.setTerrainPose(pose);
        if (car.instance?.root) car.instance.root.position.set(worldX, pose.rootY, worldZ);
      } else if (hasSeparateBodyRig) {
        bodyRig.rotation.x = pose.pitchRad;
      }

      if (typeof car.instance?.setChassisRoll === "function") {
        car.instance.setChassisRoll(car.rollAngle);
      } else if (car.chassis) {
        car.chassis.rotation.z = car.baseChassisRotZ + car.rollAngle;
      }

      if (car.chassis) {
        const rigTilted = hasSetTerrainPose || hasSeparateBodyRig;
        car.chassis.rotation.x =
          car.baseChassisRotX + car.pitchAngle + (rigTilted ? 0 : pose.pitchRad);
        car.chassis.position.y = car.baseChassisY + car.heaveOffset + car.dropHeave;
      }

      if (car.mode !== "exiting" && Math.abs(car.smoothVel) > 0.12 && car.smoothVel * longAccel < -0.9) {
        car.brakeIntensity = Math.max(car.brakeIntensity, 0.92);
      } else {
        car.brakeIntensity = Math.max(0.15, car.brakeIntensity - dt * 3.0);
      }
      car.instance?.setBrakeLight?.(car.brakeIntensity);
    }

    return { speed: maxSpeedMetersPerSec, isTarget: dominantIsTarget, worldX: dominantWorldX };
  }

  _updateAllBoardsPhysics(dt) {
    const hStats = this._updateSingleBoardPhysics(
      this.humanCars,
      BOARD_OFFSETS.human,
      dt,
      "human"
    );
    const aStats = this._updateSingleBoardPhysics(
      this.aiCars,
      BOARD_OFFSETS.ai,
      dt,
      "ai"
    );

    const best = hStats.speed >= aStats.speed ? hStats : aStats;
    if (best.speed > 0.02) {
      this._lastRollingIsTarget = best.isTarget;
      this._lastRollingWorldX = best.worldX;
    }

    this._rollingStats.speed = best.speed;
    this._rollingStats.isTarget = this._lastRollingIsTarget;
    this._rollingStats.worldX = this._lastRollingWorldX;
    return this._rollingStats;
  }

  _renderWithTrauma(dt = 1 / 60) {
    if (!this.world) return;
    const cam = this.world.camera;

    if (this.trauma > 0.001 && cam) {
      const shake = this.trauma * this.trauma;
      const ox = Math.sin(this.traumaPhase * 37.0) * 0.035 * shake;
      const oy = Math.cos(this.traumaPhase * 43.0) * 0.022 * shake;
      const oz = Math.sin(this.traumaPhase * 29.0 + 1.1) * 0.035 * shake;
      this._traumaTarget.set(ox, oy, oz);
      const smoothed = this._cameraMicroSpring.step(this._traumaTarget, dt);
      this._traumaOffset.copy(smoothed);
      cam.position.add(this._traumaOffset);
      this.world.render?.();
      cam.position.sub(this._traumaOffset);
    } else {
      this._traumaTarget.set(0, 0, 0);
      this._cameraMicroSpring.step(this._traumaTarget, dt);
      this.world.render?.();
    }
  }

  advanceFrame(dt = 1 / 60, timestamp = undefined, frameIndex = undefined) {
    const numericDt = typeof dt === "number" && Number.isFinite(dt) && dt > 0 ? dt : 1 / 60;
    const dtSec = numericDt > 1.0 ? numericDt / 1000 : numericDt;
    const safeDt = Math.min(dtSec, 0.1);

    if (
      typeof window !== "undefined" &&
      window.__virtualClock &&
      typeof frameIndex === "number" &&
      frameIndex >= 0
    ) {
      state.elapsedTime = frameIndex * safeDt;
      state.frameCount = frameIndex;
    }

    // 1. Advance `3 -> 2 -> 1 -> GO!` countdown or Overall Race Clock (`elapsedMs`)
    if (state.race.phase === "countdown") {
      this._updateCountdown(safeDt);
    } else if (state.race.phase === "racing") {
      state.race.elapsedMs += safeDt * 1000;
    }

    // 2. Advance independent front-board & back-board bump nudges and East bevel lap roll-offs
    this._updateBumpNudge("human", safeDt);
    this._updateBumpNudge("ai", safeDt);
    this._updateBoardExitSequence("human", safeDt);
    this._updateBoardExitSequence("ai", safeDt);

    // 3. Sub-stepped physical car suspension, tire spin & bevel pose on BOTH boards
    const physSteps = Math.max(1, Math.ceil(safeDt / (1 / 60) - 1e-9));
    const physSubDt = safeDt / physSteps;
    let maxSpeed = 0;
    let rollingIsTarget = this._lastRollingIsTarget;
    let rollingWorldX = this._lastRollingWorldX;

    for (let i = 0; i < physSteps; i++) {
      const stepStats = this._updateAllBoardsPhysics(physSubDt);
      if (stepStats.speed >= maxSpeed) {
        maxSpeed = stepStats.speed;
        rollingIsTarget = stepStats.isTarget;
        rollingWorldX = stepStats.worldX;
      }
    }
    this.audio.updateTireRoll(maxSpeed, rollingIsTarget, rollingWorldX, safeDt);

    if (this.trauma > 0) {
      this.traumaPhase += safeDt;
      this.trauma = Math.max(0, this.trauma - safeDt * 2.4);
    }

    // 4. Advance 3D tabletop world & render
    this.world.updateWorld?.(safeDt, state.elapsedTime);
    if (typeof window !== "undefined" && window.__CAPTURE_SKIP_DRAW__) {
      this._skippedDraw = true;
      this.world.scene?.updateMatrixWorld(true);
      this.world.camera?.updateMatrixWorld(true);
    } else {
      if (this._skippedDraw) {
        this._skippedDraw = false;
        this.world.invalidateShadows?.();
      }
      this._renderWithTrauma(safeDt);
    }

    // 5. Advance progressive live AI thought trace streamer & wake coroutines awaiting settle
    this._tickActiveThoughtStreamer(safeDt);
    this._tickSimFrameWaiters(safeDt);

    // 6. Emit 60fps stats tick for smooth live Overall Race Clock & Lap Split UI
    dispatchAction(DEMO_ACTIONS.TICK_FRAME, {
      dt: safeDt,
      fps: Math.round(1 / safeDt),
    });
  }

  renderOnly() {
    this._renderWithTrauma(1 / 60);
  }
}
