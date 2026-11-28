/**
 * src/contract.js — Orthogonal State, Dual 6x6 Tabletop Board Physics & Human vs. AI Race Contract
 * Project: Parking Bench — Human vs. Gemini AI 6x6 Visual Spatial Race (hydrogen-parking-bench)
 *
 * Shared single source of truth imported by:
 *   - @world-3d (src/world.js)
 *   - @race-ui (src/ui.js)
 *   - @game-engine (src/levels.js, src/solver.js, src/audio.js, src/core.js, src/main.js)
 *
 * Zero DOM queries, zero WebGL imports, zero side-effect timers, zero coded solver logic.
 */

export const TOTAL_LAPS = 5;

export const MODEL_OPTIONS = [
  {
    id: "gemini-4-hydrogen",
    label: "Gemini 4 Hydrogen",
    shortLabel: "Gemini 4 Hydrogen",
    badge: "Low Thinking",
    demoId: "model-hydrogen",
  },
  {
    id: "gemini-decision-1",
    label: "Decisions API",
    shortLabel: "Decisions API",
    badge: "0 Output Tokens",
    demoId: "model-decisions",
  },
];

export function getModelOption(modelId) {
  const clean = String(modelId || "").trim();
  return MODEL_OPTIONS.find((m) => m.id === clean) || MODEL_OPTIONS[0];
}

export const DEMO_ACTIONS = {
  // Primary Dual-Board Race Actions
  SELECT_MODEL: "SELECT_MODEL",                 // { model: "gemini-4-hydrogen" | "gemini-decision-1", autoStart?: boolean }
  START_RACE: "START_RACE",                     // { freshPack?: boolean }
  RESTART_RACE: "RESTART_RACE",                 // { freshPack?: boolean, autoStart?: boolean }
  REMATCH_RACE: "REMATCH_RACE",                 // { model?: string, autoStart?: boolean }
  SCRAMBLE_RACE: "SCRAMBLE_RACE",               // { autoStart?: boolean }
  RESET_HUMAN_LAP: "RESET_HUMAN_LAP",           // {}
  FINISH_RACE: "FINISH_RACE",                   // {}

  // Camera, Audio, Human Controls & Harness Routing
  SET_STATE: "SET_STATE",                       // { state: "setup" | "level1".."level5" | "topdown" | "macro" | "autoplay" }
  SELECT_LEVEL: "SELECT_LEVEL",                 // { level: 1..5 }
  TRIGGER_UNDO: "TRIGGER_UNDO",                 // {}
  TRIGGER_RESET: "TRIGGER_RESET",               // {} — resets current human lap while racing, or scrambles race in setup/finished
  REPLAY_LEVEL: "REPLAY_LEVEL",                 // {}
  NEXT_LEVEL: "NEXT_LEVEL",                     // {}
  NEW_SCRAMBLE: "NEW_SCRAMBLE",                 // {} — alias for SCRAMBLE_RACE
  TOGGLE_AUTOPLAY: "TOGGLE_AUTOPLAY",           // { isAutoplay?: boolean }
  TOGGLE_CAMERA: "TOGGLE_CAMERA",               // { cameraMode?: "3d" | "top" | "macro" }
  TOGGLE_AUDIO: "TOGGLE_AUDIO",                 // { audioEnabled?: boolean }
  SET_PLAYBACK_SPEED: "SET_PLAYBACK_SPEED",     // { speed: 1 | 2 }
  TRIGGER_HINT: "TRIGGER_HINT",                 // {}
  SHOW_HINT: "SHOW_HINT",                       // { carId, direction, distance }
  RECORD_MOVE: "RECORD_MOVE",                   // { level, moves, vehicleCount, canUndo, isExitClear }
  LEVEL_SOLVED: "LEVEL_SOLVED",                 // { level, moves }
  SET_PARAM: "SET_PARAM",                       // { [key]: value }
  TICK_FRAME: "TICK_FRAME",                     // { dt, fps }

  // Legacy no-op compatibility actions (API key & thinking level are 100% server-locked)
  STEP_HYDROGEN_TURN: "STEP_HYDROGEN_TURN",
  START_LIVE_HYDROGEN: "START_LIVE_HYDROGEN",
  SET_API_KEY: "SET_API_KEY",
  TOGGLE_API_PANEL: "TOGGLE_API_PANEL",
  SET_THINKING_LEVEL: "SET_THINKING_LEVEL",
};

export const DEMO_EVENTS = {
  // Primary Dual-Board Race Events
  MODEL_SELECTED: "demo:model_selected",
  RACE_START_REQUESTED: "demo:race_start_requested",
  RACE_RESTART_REQUESTED: "demo:race_restart_requested",
  RACE_PACK_GENERATED: "demo:race_pack_generated",
  RACE_PHASE_CHANGED: "demo:race_phase_changed",
  RACE_COUNTDOWN_TICK: "demo:race_countdown_tick",
  RACE_SETUP_NUDGE: "demo:race_setup_nudge",
  RACE_LAP_COMPLETED: "demo:race_lap_completed",
  RACE_LAP_SPAWNED: "demo:race_lap_spawned",
  RACE_WINNER_DECIDED: "demo:race_winner_decided",
  RACE_FINISHED: "demo:race_finished",
  HUMAN_LAP_RESET: "demo:human_lap_reset",

  // Live AI Back-Board Multi-Move Events
  AI_TURN_STARTED: "demo:ai_turn_started",
  AI_THOUGHT_UPDATED: "demo:ai_thought_updated",
  AI_BATCH_DECIDED: "demo:ai_batch_decided",
  AI_MOVE_STEPPED: "demo:ai_move_stepped",
  AI_TURN_COMPLETED: "demo:ai_turn_completed",
  AI_STATUS_CHANGED: "demo:ai_status_changed",

  // Shared Stage, Camera, Audio & Backwards-Compatible Events
  STATE_CHANGED: "demo:state_changed",
  LEVEL_SELECTED: "demo:level_selected",
  HINT_REQUESTED: "demo:hint_requested",
  HINT_SHOWN: "demo:hint_shown",
  AUTOPLAY_TOGGLED: "demo:autoplay_toggled",
  SCRAMBLE_REQUESTED: "demo:scramble_requested",
  PLAYBACK_SPEED_CHANGED: "demo:playback_speed_changed",
  HYDROGEN_SESSION_RESET: "demo:hydrogen_session_reset",
  HYDROGEN_FRAME_CAPTURED: "demo:hydrogen_frame_captured",
  HYDROGEN_TURN_STARTED: "demo:hydrogen_turn_started",
  HYDROGEN_THOUGHT_UPDATED: "demo:hydrogen_thought_updated",
  HYDROGEN_MOVE_DECIDED: "demo:hydrogen_move_decided",
  HYDROGEN_MOVE_OUTCOME: "demo:hydrogen_move_outcome",
  HYDROGEN_POST_MOVE_FRAME: "demo:hydrogen_post_move_frame",
  HYDROGEN_BRIDGE_STATUS: "demo:hydrogen_bridge_status",
  UNDO_REQUESTED: "demo:undo_requested",
  RESET_REQUESTED: "demo:reset_requested",
  CAMERA_CHANGED: "demo:camera_changed",
  AUDIO_TOGGLED: "demo:audio_toggled",
  MOVE_UPDATED: "demo:move_updated",
  LEVEL_COMPLETED: "demo:level_completed",
  PARAM_CHANGED: "demo:param_changed",
  STATS_UPDATED: "demo:stats_updated",
};

/**
 * Dual-Board World Offsets on the Sunlit European White-Oak Dining Table:
 * - Foreground Board (`human`): z = +9.2 (front half of table, player drags here)
 * - Background Board (`ai`):    z = -9.2 (back half of table, AI opponent plays here)
 */
export const BOARD_OFFSETS = {
  human: { x: 0, z: 9.2 },
  ai: { x: 0, z: -9.2 },
};

/**
 * Canonical 6x6 Tabletop Game Board Spatial Coordinate Contract (1.0 scene unit = 1.42 cm)
 * - Grid indices: row in [0..5] (North -> South, -Z -> +Z, engraved "1".."6"),
 *                 col in [0..5] (West -> East, -X -> +X, engraved "A".."F")
 * - Exit cutout sits on the East beechwood rail of Row 3 (exitRow = 2, localZ = -1.10, exitCol = 5 = "F3")
 */
const CELL_SIZE = 2.2;
const GRID_SIZE = 6;
const COL_LETTERS = "ABCDEF";

export function formatGridCoord(row, col) {
  const c = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(col)));
  const r = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(row)));
  return `${COL_LETTERS[c]}${r + 1}`;
}

export function parseGridCoord(coordStr) {
  if (!coordStr || typeof coordStr !== "string") return null;
  const cleaned = coordStr.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = cleaned.match(/^([A-F])([1-6])$/);
  if (!m) return null;
  const col = COL_LETTERS.indexOf(m[1]);
  const row = parseInt(m[2], 10) - 1;
  if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return null;
  return { row, col, label: `${COL_LETTERS[col]}${row + 1}` };
}

export function formatVehicleSpan(car) {
  if (!car) return "";
  const r0 = Math.round(car.row);
  const c0 = Math.round(car.col);
  const len = Math.max(1, Math.round(car.length || 2));
  const r1 = car.orientation === "v" ? r0 + len - 1 : r0;
  const c1 = car.orientation === "h" ? c0 + len - 1 : c0;
  return `${formatGridCoord(r0, c0)}–${formatGridCoord(r1, c1)}`;
}

export const GRID_SPEC = {
  gridSize: GRID_SIZE,
  cellSize: CELL_SIZE,       // 6 * 2.2 = 13.20 x 13.20 units (18.74 cm x 18.74 cm) inner matte charcoal-slate deck
  exitRow: 2,                // Row "3" (1-indexed), board-local Z = (2 - 2.5) * 2.2 = -1.10
  exitCol: 5,                // Col "F" -> Exit gate at F3
  colLetters: COL_LETTERS,   // "ABCDEF"
  courtHalfExtent: 6.6,      // 3 * 2.2
  apronPadding: 2.8,
  cellToWorldX(col, length = 1) {
    return (col + (length - 1) * 0.5 - 2.5) * CELL_SIZE;
  },
  cellToWorldZ(row, length = 1) {
    return (row + (length - 1) * 0.5 - 2.5) * CELL_SIZE;
  },
  cellToBoardWorld(row, col, length = 1, orientation = "h", boardRole = "human") {
    const isH = String(orientation || "h").toLowerCase() === "h";
    const localX = isH ? this.cellToWorldX(col, length) : this.cellToWorldX(col, 1);
    const localZ = !isH ? this.cellToWorldZ(row, length) : this.cellToWorldZ(row, 1);
    const off = BOARD_OFFSETS[boardRole] || BOARD_OFFSETS.human;
    return {
      x: localX + off.x,
      z: localZ + off.z,
      localX,
      localZ,
    };
  },
  formatCoord: formatGridCoord,
  parseCoord: parseGridCoord,
  formatSpan: formatVehicleSpan,
};

/**
 * Physical 6x6 Beechwood & Slate Tabletop Board -> White-Oak Kitchen Table Roll-Off Profile
 * - deckY (0.00): 100% flat continuous charcoal-slate rolling surface for x <= 6.96
 * - bevel (6.96 -> 7.42): smooth ungrooved ~20-degree C1 chamfered exit lip through open East rail gap at F3
 * - tableY (-0.16): rift-sawn light European white-oak kitchen dining table
 * - exitDestCol (7.4): rests cleanly at worldX = +11.88 on the East white-oak table runway
 */
const DECK_Y = 0.0;
const TABLE_Y = -0.16;
const RAIL_TOP_Y = 0.44;
const BOARD_INNER_HALF = 6.60;
const BOARD_OUTER_HALF = 7.42;
const BEVEL_START_X = 6.96;
const BEVEL_END_X = 7.42;
const EXIT_Z_MIN = -2.28;
const EXIT_Z_MAX = 0.08;
export const EXIT_DEST_COL = 7.4;

function evalExitSurfaceY(x) {
  if (!(x > BEVEL_START_X)) return DECK_Y;
  if (x >= BEVEL_END_X) return TABLE_Y;
  const u = (x - BEVEL_START_X) / (BEVEL_END_X - BEVEL_START_X);
  const smooth = u * u * (3 - 2 * u);
  return DECK_Y + (TABLE_Y - DECK_Y) * smooth;
}

function evalTwoAxleExitPose(worldX, frontAxleOffset = 1.22, rearAxleOffset = 1.22, wheelRadius = 0.34) {
  const frontAxleX = worldX + frontAxleOffset;
  const rearAxleX = worldX - rearAxleOffset;
  const frontSurfaceY = evalExitSurfaceY(frontAxleX);
  const rearSurfaceY = evalExitSurfaceY(rearAxleX);
  const wheelbase = Math.max(0.1, frontAxleOffset + rearAxleOffset);
  const pitchRad = Math.atan2(rearSurfaceY - frontSurfaceY, wheelbase);
  const baseRootY = (rearAxleOffset * frontSurfaceY + frontAxleOffset * rearSurfaceY) / wheelbase;
  const cosPitch = Math.max(0.85, Math.cos(pitchRad));
  const tangentLift = Math.max(0, Number(wheelRadius) || 0.34) * (1 / cosPitch - 1);
  const rootY = baseRootY + tangentLift;
  return {
    rootY,
    baseRootY,
    tangentLift,
    pitchRad,
    frontAxleX,
    rearAxleX,
    frontSurfaceY,
    rearSurfaceY,
  };
}

export const BOARD_PHYSICS = {
  deckY: DECK_Y,
  tableY: TABLE_Y,
  railTopY: RAIL_TOP_Y,
  boardInnerHalf: BOARD_INNER_HALF,
  boardOuterHalf: BOARD_OUTER_HALF,
  bevelStartX: BEVEL_START_X,
  bevelEndX: BEVEL_END_X,
  exitDestCol: EXIT_DEST_COL,
  exitZMin: EXIT_Z_MIN,
  exitZMax: EXIT_Z_MAX,
  evalExitSurfaceY,
  evalTwoAxleExitPose,
};

const CM_PER_UNIT = 1.42;
const BOARD_INNER_WIDTH_UNITS = GRID_SPEC.gridSize * CELL_SIZE; // 13.20
const BOARD_OUTER_WIDTH_UNITS = BOARD_OUTER_HALF * 2;           // 14.84
const MUG_BOWL_DIAMETER_UNITS = 6.20;

export const PHYSICAL_SCALE_SPEC = {
  cmPerUnit: CM_PER_UNIT,
  mmPerUnit: CM_PER_UNIT * 10,

  boardInnerWidthUnits: BOARD_INNER_WIDTH_UNITS,
  boardInnerWidthCm: +(BOARD_INNER_WIDTH_UNITS * CM_PER_UNIT).toFixed(2),
  boardOuterWidthUnits: BOARD_OUTER_WIDTH_UNITS,
  boardOuterWidthCm: +(BOARD_OUTER_WIDTH_UNITS * CM_PER_UNIT).toFixed(2),

  mugBowlDiameterUnits: MUG_BOWL_DIAMETER_UNITS,
  mugBowlDiameterCm: +(MUG_BOWL_DIAMETER_UNITS * CM_PER_UNIT).toFixed(2),
  mugBowlDiameterRangeUnits: [5.60, 6.80],
  mugToBoardWidthRatio: +(MUG_BOWL_DIAMETER_UNITS / BOARD_OUTER_WIDTH_UNITS).toFixed(4), // ~0.4178 on 6x6
  mugToBoardWidthRatioRange: [0.34, 0.48],
  mugBowlHeightUnits: 4.96,
  mugBowlHeightCm: +(4.96 * CM_PER_UNIT).toFixed(2),
  mugBowlHeightRangeUnits: [4.40, 5.65],
  coasterDiameterUnits: 7.60,
  coasterDiameterCm: +(7.60 * CM_PER_UNIT).toFixed(2),
  coasterDiameterRangeUnits: [7.00, 8.30],
  mugPlacement: { x: -14.8, z: -2.4, y: TABLE_Y },
  napkinPlacement: { x: -15.2, z: 6.2, y: TABLE_Y, spoonLengthUnits: 9.20 },

  cardTrayWidthUnits: 6.80,
  cardTrayDepthUnits: 9.20,
  cardTrayHeightUnits: 1.65,
  cardTrayRangeUnits: { width: [6.20, 7.60], depth: [8.40, 10.20] },
  cardTrayPlacement: { x: -15.2, z: -13.6, y: TABLE_Y, hidden: true },

  // Sunlit East Roll-Off Runway on White-Oak Table for Winning Rosso Corsa GT Coupes (EXIT_DEST_COL = 7.4 -> +11.88)
  eastRollOffRunway: {
    xMin: BOARD_OUTER_HALF, // +7.42
    xMax: 18.6,
    zCenter: -1.10,
    zMin: -2.95,
    zMax: 0.75,
  },

  tableWidthUnits: 46.0,
  tableWidthCm: +(46.0 * CM_PER_UNIT).toFixed(1),
  tableWidthRangeUnits: [34.0, 128.0],
  tableDepthUnits: 42.0,
  tableDepthCm: +(42.0 * CM_PER_UNIT).toFixed(1),
  tableDepthRangeUnits: [34.0, 76.0],
  tableSlabThicknessUnits: 2.80,
  tableBounds: {
    xMin: -23.0,
    xMax: 23.0,
    zMin: -21.0,
    zMax: 21.0,
    topY: TABLE_Y,
  },
  chairBacksZRangeUnits: [-34.0, -4.0],
  chairPlacements: [
    { x: 25.4, z: -8.5, crestTopY: 4.15, yawRad: -1.46 },
    { x: -4.5, z: -24.2, crestTopY: 4.25, yawRad: 0.06 },
  ],

  maxBackgroundChromaSaturation: 0.25,

  unitsToCm(units) {
    return Number(units) * CM_PER_UNIT;
  },
  cmToUnits(cm) {
    return Number(cm) / CM_PER_UNIT;
  },
  validateSceneScale(measured = {}) {
    const errors = [];
    const boardW = Number(measured.boardOuterWidthUnits ?? BOARD_OUTER_WIDTH_UNITS);
    if (!(boardW >= 13.5 && boardW <= 16.5)) {
      errors.push(`boardOuterWidthUnits=${boardW.toFixed(2)} outside [13.5, 16.5]`);
    }
    const tw = Number(measured.tableWidthUnits ?? 46.0);
    const td = Number(measured.tableDepthUnits ?? 42.0);
    if (!(tw >= 32.0 && tw <= 132.0)) {
      errors.push(`tableWidthUnits=${tw.toFixed(2)} outside [32.0, 132.0]`);
    }
    if (!(td >= 32.0 && td <= 82.0)) {
      errors.push(`tableDepthUnits=${td.toFixed(2)} outside [32.0, 82.0]`);
    }
    return { ok: errors.length === 0, errors };
  },
};

/**
 * All 10 Omni-Referenced 1:64 Collector Die-Cast Vehicle Classes
 */
export const VEHICLE_CLASSES = {
  gt_coupe: {
    key: "gt_coupe",
    glbRootName: "Vehicle_gt_coupe",
    label: "Red GT Coupe",
    gridLength: 2,
    lengthMeters: 4.08,
    widthMeters: 1.84,
    heightMeters: 1.24,
    wheelRadius: 0.34,
    frontAxleOffset: 1.22,
    rearAxleOffset: 1.22,
  },
  sedan: {
    key: "sedan",
    glbRootName: "Vehicle_sedan",
    label: "Saloon",
    gridLength: 2,
    lengthMeters: 4.16,
    widthMeters: 1.82,
    heightMeters: 1.38,
    wheelRadius: 0.34,
    frontAxleOffset: 1.24,
    rearAxleOffset: 1.24,
  },
  suv: {
    key: "suv",
    glbRootName: "Vehicle_suv",
    label: "4x4 SUV",
    gridLength: 2,
    lengthMeters: 4.22,
    widthMeters: 1.88,
    heightMeters: 1.62,
    wheelRadius: 0.38,
    frontAxleOffset: 1.28,
    rearAxleOffset: 1.26,
  },
  pickup: {
    key: "pickup",
    glbRootName: "Vehicle_pickup",
    label: "Utility Pickup",
    gridLength: 2,
    lengthMeters: 4.18,
    widthMeters: 1.86,
    heightMeters: 1.56,
    wheelRadius: 0.37,
    frontAxleOffset: 1.26,
    rearAxleOffset: 1.24,
  },
  cabriolet: {
    key: "cabriolet",
    glbRootName: "Vehicle_cabriolet",
    label: "Open Roadster",
    gridLength: 2,
    lengthMeters: 4.04,
    widthMeters: 1.82,
    heightMeters: 1.18,
    wheelRadius: 0.34,
    frontAxleOffset: 1.22,
    rearAxleOffset: 1.20,
  },
  hatchback: {
    key: "hatchback",
    glbRootName: "Vehicle_hatchback",
    label: "Rally Hatchback",
    gridLength: 2,
    lengthMeters: 3.94,
    widthMeters: 1.84,
    heightMeters: 1.42,
    wheelRadius: 0.33,
    frontAxleOffset: 1.20,
    rearAxleOffset: 1.20,
  },
  fastback: {
    key: "fastback",
    glbRootName: "Vehicle_fastback",
    label: "Louvered Fastback",
    gridLength: 2,
    lengthMeters: 4.18,
    widthMeters: 1.84,
    heightMeters: 1.28,
    wheelRadius: 0.34,
    frontAxleOffset: 1.24,
    rearAxleOffset: 1.24,
  },
  van: {
    key: "van",
    glbRootName: "Vehicle_van",
    label: "Lounge Van",
    gridLength: 3,
    lengthMeters: 6.26,
    widthMeters: 1.94,
    heightMeters: 2.14,
    wheelRadius: 0.39,
    frontAxleOffset: 1.94,
    rearAxleOffset: 1.90,
  },
  wagon: {
    key: "wagon",
    glbRootName: "Vehicle_wagon",
    label: "Touring Estate",
    gridLength: 3,
    lengthMeters: 6.12,
    widthMeters: 1.86,
    heightMeters: 1.72,
    wheelRadius: 0.35,
    frontAxleOffset: 1.94,
    rearAxleOffset: 1.84,
  },
  box_truck: {
    key: "box_truck",
    glbRootName: "Vehicle_box_truck",
    label: "Artisan Box Truck",
    gridLength: 3,
    lengthMeters: 6.22,
    widthMeters: 1.92,
    heightMeters: 2.16,
    wheelRadius: 0.39,
    frontAxleOffset: 1.96,
    rearAxleOffset: 1.86,
  },
};

export const CURATED_FINISHES = {
  rosso_corsa: {
    key: "rosso_corsa",
    label: "Rosso Corsa",
    hex: "#b3141b",
    metalness: 0.14,
    roughness: 0.11,
    clearcoat: 1.0,
    clearcoatRoughness: 0.026,
  },
  glacier_silver: {
    key: "glacier_silver",
    label: "Glacier Silver",
    hex: "#c4d4e0",
    metalness: 0.64,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.048,
  },
  british_racing_green: {
    key: "british_racing_green",
    label: "Racing Green",
    hex: "#164430",
    metalness: 0.34,
    roughness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.045,
  },
  midnight_sapphire: {
    key: "midnight_sapphire",
    label: "Midnight Sapphire",
    hex: "#193a6a",
    metalness: 0.52,
    roughness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.046,
  },
  solar_ochre: {
    key: "solar_ochre",
    label: "Solar Ochre",
    hex: "#e09124",
    metalness: 0.24,
    roughness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.046,
  },
  slate_titanium: {
    key: "slate_titanium",
    label: "Slate Titanium",
    hex: "#4c5868",
    metalness: 0.62,
    roughness: 0.17,
    clearcoat: 1.0,
    clearcoatRoughness: 0.052,
  },
  warm_chalk: {
    key: "warm_chalk",
    label: "Warm Chalk",
    hex: "#ede7dc",
    metalness: 0.14,
    roughness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.048,
  },
  espresso_bronze: {
    key: "espresso_bronze",
    label: "Espresso Bronze",
    hex: "#523c2f",
    metalness: 0.56,
    roughness: 0.17,
    clearcoat: 1.0,
    clearcoatRoughness: 0.054,
  },
  alpine_teal: {
    key: "alpine_teal",
    label: "Alpine Teal",
    hex: "#21616b",
    metalness: 0.42,
    roughness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.046,
  },
  terracotta_clay: {
    key: "terracotta_clay",
    label: "Terracotta",
    hex: "#b55d3d",
    metalness: 0.18,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.048,
  },
  champagne_pewter: {
    key: "champagne_pewter",
    label: "Champagne Pewter",
    hex: "#b9ad99",
    metalness: 0.58,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.048,
  },
};

export const LEVEL_META = [
  { id: 1, lap: 1, stateKey: "level1", pillLabel: "L1", title: "Morning Espresso",  vehicleCount: 7 },
  { id: 2, lap: 2, stateKey: "level2", pillLabel: "L2", title: "Espresso Crossway", vehicleCount: 8 },
  { id: 3, lap: 3, stateKey: "level3", pillLabel: "L3", title: "Beechwood Chicane", vehicleCount: 9 },
  { id: 4, lap: 4, stateKey: "level4", pillLabel: "L4", title: "White-Oak Hairpin", vehicleCount: 10 },
  { id: 5, lap: 5, stateKey: "level5", pillLabel: "L5", title: "Collector Finale",  vehicleCount: 11 },
];

export function formatRaceClockMs(ms) {
  const safe = Math.max(0, Number(ms) || 0);
  const totalTenths = Math.floor(safe / 100);
  const tenths = totalTenths % 10;
  const totalSec = Math.floor(totalTenths / 10);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${tenths}`;
}

export function formatSplitSec(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return "—";
  const sec = Math.max(0, Number(ms)) / 1000;
  if (sec >= 60) return formatRaceClockMs(ms);
  return `${sec.toFixed(1).padStart(4, "0")}s`;
}

export function formatDeltaSec(humanMs, aiMs) {
  if (
    humanMs === null ||
    humanMs === undefined ||
    aiMs === null ||
    aiMs === undefined ||
    !Number.isFinite(Number(humanMs)) ||
    !Number.isFinite(Number(aiMs))
  ) {
    return { text: "—", tone: "neutral", diffMs: 0 };
  }
  const diffMs = Number(humanMs) - Number(aiMs); // negative => Human was faster!
  const absSec = (Math.abs(diffMs) / 1000).toFixed(1);
  if (Math.abs(diffMs) < 50) {
    return { text: "0.0s", tone: "neutral", diffMs: 0 };
  }
  if (diffMs < 0) {
    return { text: `-${absSec}s`, tone: "emerald", diffMs };
  }
  return { text: `+${absSec}s`, tone: "crimson", diffMs };
}

class DemoEventBus extends EventTarget {
  emit(eventName, detail = {}) {
    this.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

export const bus = new DemoEventBus();

const sharedAiTurns = [];

export const state = {
  slug: "hydrogen-parking-bench",
  title: "Parking Bench",
  archetype: 2,
  currentState: "setup",
  currentLevel: 1,
  moves: 0,
  vehicleCount: LEVEL_META[0].vehicleCount,
  canUndo: false,
  isSolved: false,
  isExitClear: false,
  solvedLevels: [],
  isAutoplay: false,
  playbackSpeed: 1,
  cameraMode: "3d",       // "3d" | "top" | "macro"
  audioEnabled: true,
  elapsedTime: 0,
  frameCount: 0,
  fps: 60.0,
  activeHint: null,

  race: {
    phase: "setup",                     // "setup" | "countdown" | "racing" | "finished"
    totalLaps: TOTAL_LAPS,              // 5
    selectedModel: "gemini-4-hydrogen", // "gemini-4-hydrogen" | "gemini-decision-1"
    opponentLabel: "Gemini 4 Hydrogen",
    countdownValue: null,               // null | 3 | 2 | 1 | "GO"
    countdownRemainingSec: 0,
    elapsedMs: 0,                       // Overall race clock in ms (ticks every frame while phase === "racing")
    winner: null,                       // null | "human" | "ai"
    winnerTimeMs: null,
    setupNudgeCount: 0,                 // Increments if user clicks front-board car during "setup"
    packId: 1,

    human: {
      currentLap: 1,                    // 1..5
      completedLaps: 0,                 // 0..5
      finished: false,
      lapStartElapsedMs: 0,
      lapSplitsMs: [null, null, null, null, null],
      cumulativeSplitsMs: [null, null, null, null, null],
      totalTimeMs: null,
      lapMoves: 0,
      totalMoves: 0,
      canUndo: false,
      isExitClear: false,
      exitingLap: false,
    },

    ai: {
      currentLap: 1,                    // 1..5
      completedLaps: 0,                 // 0..5
      finished: false,
      status: "idle",                   // "idle" | "observing" | "thinking" | "moving" | "lap_clear" | "finished" | "error"
      errorMessage: "",
      lapStartElapsedMs: 0,
      lapSplitsMs: [null, null, null, null, null],
      cumulativeSplitsMs: [null, null, null, null, null],
      totalTimeMs: null,
      lapMoves: 0,
      totalMoves: 0,
      isExitClear: false,
      exitingLap: false,
      currentTurn: 0,
      turns: sharedAiTurns,
    },
  },

  hydrogen: {
    mode: "live",
    modelId: "gemini-4-hydrogen",
    modelDisplay: "Gemini 4 Hydrogen",
    thinkingLevel: "low",
    status: "idle",
    errorMessage: "",
    conversationId: "",
    integrityVerified: true,
    toolCallsAudited: 0,
    thoughtTokensTotal: 0,
    currentTurn: 0,
    totalTurns: 0,
    turnStartedAtMs: 0,
    currentFrameDataUrl: "",
    solvedFrameDataUrl: "",
    turns: sharedAiTurns,
  },

  params: {
    exposure: 1.06,
  },
};

function resolveLevelFromStateKey(stateKey) {
  if (!stateKey) return null;
  const match = String(stateKey).match(/^level([1-5])$/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

export function dispatchAction(actionType, payload = {}) {
  switch (actionType) {
    case DEMO_ACTIONS.SELECT_MODEL: {
      const opt = getModelOption(payload.model);
      const prevModel = state.race.selectedModel;
      const prevPhase = state.race.phase;
      state.race.selectedModel = opt.id;
      state.race.opponentLabel = opt.label;
      state.hydrogen.modelId = opt.id;
      state.hydrogen.modelDisplay = opt.label;
      bus.emit(DEMO_EVENTS.MODEL_SELECTED, {
        model: opt.id,
        label: opt.label,
        option: opt,
        prevModel,
        prevPhase,
        autoStart: Boolean(payload.autoStart),
      });
      break;
    }

    case DEMO_ACTIONS.START_RACE: {
      state.currentState = "racing";
      bus.emit(DEMO_EVENTS.RACE_START_REQUESTED, {
        freshPack: Boolean(payload.freshPack),
      });
      break;
    }

    case DEMO_ACTIONS.RESTART_RACE: {
      state.currentState = payload.autoStart === false ? "setup" : "racing";
      bus.emit(DEMO_EVENTS.RACE_RESTART_REQUESTED, {
        freshPack: payload.freshPack !== false,
        autoStart: payload.autoStart !== false,
      });
      break;
    }

    case DEMO_ACTIONS.REMATCH_RACE: {
      if (payload.model) {
        const opt = getModelOption(payload.model);
        state.race.selectedModel = opt.id;
        state.race.opponentLabel = opt.label;
        state.hydrogen.modelId = opt.id;
        state.hydrogen.modelDisplay = opt.label;
        bus.emit(DEMO_EVENTS.MODEL_SELECTED, {
          model: opt.id,
          label: opt.label,
          option: opt,
          prevModel: state.race.selectedModel,
          prevPhase: state.race.phase,
          fromRematch: true,
        });
      }
      state.currentState = payload.autoStart === false ? "setup" : "racing";
      bus.emit(DEMO_EVENTS.RACE_RESTART_REQUESTED, {
        freshPack: true,
        autoStart: payload.autoStart !== false,
      });
      break;
    }

    case DEMO_ACTIONS.SCRAMBLE_RACE:
    case DEMO_ACTIONS.NEW_SCRAMBLE: {
      const autoStart = Boolean(payload.autoStart);
      state.isAutoplay = false;
      state.currentState = autoStart ? "racing" : "setup";
      bus.emit(DEMO_EVENTS.SCRAMBLE_REQUESTED, { autoStart });
      break;
    }

    case DEMO_ACTIONS.RESET_HUMAN_LAP: {
      bus.emit(DEMO_EVENTS.HUMAN_LAP_RESET, {
        lap: state.race.human.currentLap,
      });
      break;
    }

    case DEMO_ACTIONS.FINISH_RACE: {
      const prevPhase = state.race.phase;
      state.race.phase = "finished";
      state.race.countdownValue = null;
      state.race.countdownRemainingSec = 0;
      state.isSolved = true;
      state.isAutoplay = false;
      state.currentState = "finished";
      bus.emit(DEMO_EVENTS.RACE_PHASE_CHANGED, {
        phase: "finished",
        prevPhase,
        countdownValue: null,
        winner: state.race.winner,
      });
      bus.emit(DEMO_EVENTS.RACE_FINISHED, {
        winner: state.race.winner,
        humanTotalMs: state.race.human.totalTimeMs,
        aiTotalMs: state.race.ai.totalTimeMs,
        opponentLabel: state.race.opponentLabel,
      });
      break;
    }

    case DEMO_ACTIONS.SET_STATE: {
      const nextState = String(payload.state || "setup").trim().toLowerCase();
      state.currentState = nextState;

      if (nextState === "topdown" || nextState === "overhead") {
        state.cameraMode = "top";
        bus.emit(DEMO_EVENTS.CAMERA_CHANGED, { cameraMode: state.cameraMode });
        bus.emit(DEMO_EVENTS.STATE_CHANGED, { state: nextState, level: state.currentLevel });
        break;
      }

      if (nextState === "macro") {
        state.cameraMode = "macro";
        bus.emit(DEMO_EVENTS.CAMERA_CHANGED, { cameraMode: state.cameraMode });
        bus.emit(DEMO_EVENTS.STATE_CHANGED, { state: nextState, level: state.currentLevel });
        break;
      }

      if (nextState === "autoplay" || nextState === "race") {
        state.isAutoplay = true;
        bus.emit(DEMO_EVENTS.AUTOPLAY_TOGGLED, { isAutoplay: true });
        bus.emit(DEMO_EVENTS.RACE_START_REQUESTED, { freshPack: false });
        bus.emit(DEMO_EVENTS.STATE_CHANGED, { state: nextState, level: state.currentLevel });
        break;
      }

      const lv = resolveLevelFromStateKey(nextState);
      if (lv) {
        const meta = LEVEL_META[lv - 1];
        state.currentLevel = lv;
        state.vehicleCount = meta ? meta.vehicleCount : state.vehicleCount;
        bus.emit(DEMO_EVENTS.LEVEL_SELECTED, { level: lv, meta });
      }
      bus.emit(DEMO_EVENTS.STATE_CHANGED, { state: nextState, level: state.currentLevel });
      break;
    }

    case DEMO_ACTIONS.SELECT_LEVEL: {
      const lv = Math.max(1, Math.min(LEVEL_META.length, Number(payload.level) || 1));
      dispatchAction(DEMO_ACTIONS.SET_STATE, { state: `level${lv}` });
      break;
    }

    case DEMO_ACTIONS.TOGGLE_AUTOPLAY: {
      const nextAuto =
        payload.isAutoplay !== undefined ? Boolean(payload.isAutoplay) : !state.isAutoplay;
      state.isAutoplay = nextAuto;
      bus.emit(DEMO_EVENTS.AUTOPLAY_TOGGLED, { isAutoplay: state.isAutoplay });
      if (nextAuto && state.race.phase === "setup") {
        bus.emit(DEMO_EVENTS.RACE_START_REQUESTED, { freshPack: false });
      }
      break;
    }

    case DEMO_ACTIONS.START_LIVE_HYDROGEN:
    case DEMO_ACTIONS.STEP_HYDROGEN_TURN: {
      if (state.race.phase === "setup") {
        bus.emit(DEMO_EVENTS.RACE_START_REQUESTED, { freshPack: false });
      }
      break;
    }

    case DEMO_ACTIONS.TRIGGER_UNDO: {
      bus.emit(DEMO_EVENTS.UNDO_REQUESTED, { lap: state.race.human.currentLap });
      break;
    }

    case DEMO_ACTIONS.TRIGGER_RESET:
    case DEMO_ACTIONS.REPLAY_LEVEL: {
      if (state.race.phase === "racing") {
        bus.emit(DEMO_EVENTS.HUMAN_LAP_RESET, { lap: state.race.human.currentLap });
      } else {
        bus.emit(DEMO_EVENTS.RESET_REQUESTED, { level: state.currentLevel });
      }
      break;
    }

    case DEMO_ACTIONS.NEXT_LEVEL: {
      const nextLv = state.currentLevel >= LEVEL_META.length ? 1 : state.currentLevel + 1;
      dispatchAction(DEMO_ACTIONS.SELECT_LEVEL, { level: nextLv });
      break;
    }

    case DEMO_ACTIONS.TOGGLE_CAMERA: {
      const validModes = ["3d", "top", "macro"];
      if (payload.cameraMode && validModes.includes(payload.cameraMode)) {
        state.cameraMode = payload.cameraMode;
      } else {
        const idx = validModes.indexOf(state.cameraMode);
        state.cameraMode = validModes[(idx + 1) % validModes.length];
      }
      bus.emit(DEMO_EVENTS.CAMERA_CHANGED, { cameraMode: state.cameraMode });
      break;
    }

    case DEMO_ACTIONS.TOGGLE_AUDIO: {
      state.audioEnabled =
        payload.audioEnabled !== undefined ? Boolean(payload.audioEnabled) : !state.audioEnabled;
      bus.emit(DEMO_EVENTS.AUDIO_TOGGLED, { audioEnabled: state.audioEnabled });
      break;
    }

    case DEMO_ACTIONS.SET_PLAYBACK_SPEED: {
      const spd = Number(payload.speed) === 2 ? 2 : 1;
      state.playbackSpeed = spd;
      bus.emit(DEMO_EVENTS.PLAYBACK_SPEED_CHANGED, { speed: spd });
      break;
    }

    case DEMO_ACTIONS.TRIGGER_HINT: {
      bus.emit(DEMO_EVENTS.HINT_REQUESTED, { level: state.currentLevel });
      break;
    }

    case DEMO_ACTIONS.SHOW_HINT: {
      state.activeHint = payload.carId ? { ...payload } : null;
      bus.emit(DEMO_EVENTS.HINT_SHOWN, { hint: state.activeHint });
      break;
    }

    case DEMO_ACTIONS.RECORD_MOVE: {
      if (typeof payload.moves === "number") {
        state.moves = payload.moves;
        state.race.human.lapMoves = payload.moves;
      }
      if (typeof payload.totalMoves === "number") {
        state.race.human.totalMoves = payload.totalMoves;
      }
      if (typeof payload.vehicleCount === "number") {
        state.vehicleCount = payload.vehicleCount;
      }
      if (typeof payload.canUndo === "boolean") {
        state.canUndo = payload.canUndo;
        state.race.human.canUndo = payload.canUndo;
      }
      if (typeof payload.isExitClear === "boolean") {
        state.isExitClear = payload.isExitClear;
        state.race.human.isExitClear = payload.isExitClear;
      }
      state.activeHint = null;
      bus.emit(DEMO_EVENTS.MOVE_UPDATED, {
        level: state.race.human.currentLap,
        lap: state.race.human.currentLap,
        moves: state.moves,
        totalMoves: state.race.human.totalMoves,
        vehicleCount: state.vehicleCount,
        canUndo: state.canUndo,
        isExitClear: state.isExitClear,
      });
      break;
    }

    case DEMO_ACTIONS.LEVEL_SOLVED: {
      const lv = payload.level || state.race.human.currentLap || 1;
      if (!state.solvedLevels.includes(lv)) {
        state.solvedLevels = [...state.solvedLevels, lv].sort((a, b) => a - b);
      }
      bus.emit(DEMO_EVENTS.LEVEL_COMPLETED, {
        level: lv,
        moves: state.moves,
        solvedLevels: state.solvedLevels,
      });
      break;
    }

    case DEMO_ACTIONS.SET_PARAM: {
      const nextParams = { ...state.params, ...payload };
      if ("exposure" in nextParams) {
        const expVal = Number(nextParams.exposure);
        nextParams.exposure = Number.isFinite(expVal)
          ? Math.max(0.5, Math.min(2.0, expVal))
          : 1.06;
      }
      state.params = nextParams;
      bus.emit(DEMO_EVENTS.PARAM_CHANGED, { params: state.params });
      break;
    }

    case DEMO_ACTIONS.TICK_FRAME: {
      state.frameCount++;
      state.elapsedTime += payload.dt || 1 / 60;
      state.fps = payload.fps || 60.0;
      bus.emit(DEMO_EVENTS.STATS_UPDATED, {
        elapsedTime: state.elapsedTime,
        frameCount: state.frameCount,
        fps: state.fps,
        raceElapsedMs: state.race.elapsedMs,
        phase: state.race.phase,
        countdownValue: state.race.countdownValue,
        level: state.currentLevel,
        moves: state.moves,
        canUndo: state.canUndo,
      });
      break;
    }

    case DEMO_ACTIONS.SET_API_KEY:
    case DEMO_ACTIONS.TOGGLE_API_PANEL:
    case DEMO_ACTIONS.SET_THINKING_LEVEL:
      // Server-side managed API key & locked low thinking — intentional no-op
      break;

    default:
      console.warn("[DemoContract] Unknown action:", actionType);
  }
}

if (typeof window !== "undefined") {
  window.DEMO_BUS = bus;
  window.DEMO_STATE = state;
  window.LEVEL_META = LEVEL_META;
  window.MODEL_OPTIONS = MODEL_OPTIONS;
  window.BOARD_OFFSETS = BOARD_OFFSETS;
  window.BOARD_PHYSICS = BOARD_PHYSICS;
  window.PHYSICAL_SCALE_SPEC = PHYSICAL_SCALE_SPEC;
  window.dispatchDemoAction = dispatchAction;
}
