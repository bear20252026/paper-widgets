/**
 * src/ui.js — Two-Pane Dual-Board Race HUD, Motorsport Timing Tower & Live Model Vision Stream
 * Project: Parking Bench · 6×6 Race — Human vs. Gemini AI Visual Spatial Race (hydrogen-parking-bench)
 *
 * Exclusively owned by @race-ui.
 * Coordinates strictly through src/contract.js (zero WebGL imports, zero timers, zero API keys).
 */

import {
  bus,
  state,
  TOTAL_LAPS,
  MODEL_OPTIONS,
  getModelOption,
  formatRaceClockMs,
  formatSplitSec,
  formatDeltaSec,
  GRID_SPEC,
  dispatchAction,
  DEMO_ACTIONS,
  DEMO_EVENTS,
} from "./contract.js";

const ICON_PLAY = "M5.25 3.5L12.5 8L5.25 12.5V3.5Z";
const ICON_RESTART =
  "M3.25 6.25A5.25 5.25 0 1 1 4.15 11.35M3 3.25V6.4H6.15";

const ICON_AUDIO_ON =
  "M11 5.6C11.9 6.5 11.9 9.5 11 10.4M12.85 3.85C14.5 5.5 14.5 10.5 12.85 12.15";
const ICON_AUDIO_OFF = "M11.25 6.25L14.25 9.75M14.25 6.25L11.25 9.75";

const VALID_CAMERA_MODES = new Set(["3d", "top", "macro"]);
const ALLOWED_UI_MODELS = new Set(["gemini-4-hydrogen", "gemini-decision-1"]);

const AI_STATUS_LABELS = {
  idle: "Ready",
  observing: "Capturing PNG",
  thinking: "Planning Batch",
  moving: "Sliding Batch",
  lap_clear: "Lap Clear",
  solved: "5/5 Complete",
  finished: "Finished",
  error: "Stream Notice",
};

const DIR_MAP = {
  UP: "UP",
  NORTH: "UP",
  N: "UP",
  DOWN: "DOWN",
  SOUTH: "DOWN",
  S: "DOWN",
  LEFT: "LEFT",
  WEST: "LEFT",
  W: "LEFT",
  RIGHT: "RIGHT",
  EAST: "RIGHT",
  E: "RIGHT",
};

function pad2(n) {
  return String(Math.max(0, Math.round(Number(n) || 0))).padStart(2, "0");
}

function normalizeDirection(rawDir) {
  if (!rawDir) return "";
  const key = String(rawDir).trim().toUpperCase();
  return DIR_MAP[key] || key;
}

function renderThoughtTextSafe(containerEl, text) {
  if (!containerEl) return;
  containerEl.textContent = "";
  const str = String(text || "");
  if (!str) return;
  const frag = document.createDocumentFragment();
  const parts = str.split(/(\*\*[^*]+\*\*)/g);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      frag.appendChild(strong);
    } else {
      frag.appendChild(document.createTextNode(part));
    }
  }
  containerEl.appendChild(frag);
}

function extractRawMovesArray(turn) {
  if (!turn) return [];
  if (Array.isArray(turn.moves) && turn.moves.length > 0) return turn.moves;
  if (Array.isArray(turn.plannedMoves) && turn.plannedMoves.length > 0) return turn.plannedMoves;
  if (Array.isArray(turn.moveSpecs) && turn.moveSpecs.length > 0) return turn.moveSpecs;
  if (Array.isArray(turn.moveSpec) && turn.moveSpec.length > 0) return turn.moveSpec;
  if (turn.moveSpec && Array.isArray(turn.moveSpec.moves) && turn.moveSpec.moves.length > 0) {
    return turn.moveSpec.moves;
  }
  if (turn.moveSpec) return [turn.moveSpec];
  return [];
}

function formatSingleMoveChip(ms, index, totalMoves, turn, stepResult) {
  if (!ms) return null;
  if (typeof ms === "string") {
    const clean = ms.trim();
    if (!clean) return null;
    const isExitStr = /exit/i.test(clean);
    return {
      text: clean,
      tone: isExitStr ? "exit" : "neutral",
    };
  }

  let coord =
    ms.car_coord ||
    ms.coord ||
    ms.carCoord ||
    ms.from ||
    ms.cell ||
    ms.targetCoord ||
    ms.target ||
    "";

  if (!coord && Number.isFinite(ms.row) && Number.isFinite(ms.col)) {
    coord = GRID_SPEC.formatCoord(ms.row, ms.col);
  }
  coord = String(coord || "").trim().toUpperCase();

  const dir = normalizeDirection(ms.direction || ms.dir || ms.move || "");
  const rawDist = ms.cells ?? ms.distance ?? ms.steps ?? ms.spaces ?? ms.count ?? ms.delta;

  const stepKind = String(stepResult?.outcome || "").trim().toLowerCase();
  const turnKind = String(turn?.outcome || "").trim().toLowerCase();
  const isLastStep = index === totalMoves - 1;
  const isRow3HeroSlide =
    dir === "RIGHT" &&
    /^([A-F])3$/i.test(coord) &&
    ((Number.isFinite(Number(rawDist)) && Number(rawDist) >= 4) ||
      (isLastStep && (turnKind === "solved" || turnKind === "lap_clear" || turnKind === "exit")));

  const isExit = Boolean(
    ms.isExit ||
      ms.exit ||
      /exit/i.test(String(rawDist ?? "")) ||
      stepKind === "solved" ||
      stepKind === "exit" ||
      stepKind === "lap_clear" ||
      isRow3HeroSlide
  );

  const isBumped =
    stepKind === "blocked" ||
    stepKind === "partial" ||
    stepKind === "axis_mismatch" ||
    stepKind === "empty_coord" ||
    stepKind === "invalid";

  let text = "";
  if (isExit && coord) {
    text = `${coord} → EXIT`;
  } else {
    let distPart = "";
    if (typeof rawDist === "number" && Number.isFinite(rawDist)) {
      distPart = String(Math.max(1, Math.abs(Math.round(rawDist))));
    } else if (typeof rawDist === "string" && rawDist.trim() && !/^exit$/i.test(rawDist.trim())) {
      distPart = rawDist.trim().toUpperCase();
    }
    const rightSide = [dir, distPart].filter(Boolean).join(" ");
    text = coord && rightSide ? `${coord} → ${rightSide}` : coord || rightSide || "MOVE";
  }

  return {
    text,
    tone: isExit ? "exit" : isBumped ? "bumped" : "neutral",
  };
}

function formatTurnBatchDecision(turn) {
  const rawMoves = extractRawMovesArray(turn);
  const results = Array.isArray(turn?.moveResults) ? turn.moveResults : [];
  const chips = [];

  for (let i = 0; i < rawMoves.length; i++) {
    const chip = formatSingleMoveChip(rawMoves[i], i, rawMoves.length, turn, results[i]);
    if (chip) chips.push(chip);
  }

  const rawOutcome = turn?.outcome;
  const kind =
    typeof rawOutcome === "string"
      ? rawOutcome.trim().toLowerCase()
      : rawOutcome && typeof rawOutcome === "object"
        ? String(rawOutcome.kind || rawOutcome.status || "").trim().toLowerCase()
        : "";

  if (chips.length === 0 && !kind && !turn?.feedbackText && !turn?.summary) {
    return null;
  }

  const hasExitChip = chips.some((c) => c.tone === "exit");
  const hasBumpChip = chips.some((c) => c.tone === "bumped");

  let rowTone = "neutral";
  let outcomeTag = "";

  const lapNum = pad2(turn?.lap || 1);
  const customFeedback = String(turn?.feedbackText || "").trim();

  if (
    kind === "solved" ||
    kind === "lap_clear" ||
    kind === "exit" ||
    kind === "win" ||
    (hasExitChip && kind === "ok")
  ) {
    rowTone = "emerald";
    outcomeTag = customFeedback || `LAP ${lapNum} CLEARED · EXIT F3`;
  } else if (
    kind === "blocked" ||
    kind === "partial" ||
    kind === "axis_mismatch" ||
    kind === "empty_coord" ||
    kind === "invalid" ||
    hasBumpChip
  ) {
    rowTone = "amber";
    outcomeTag = customFeedback || "BUMPED · RE-PLANNING FROM NEW PNG";
  } else if (results.length > 0 && chips.length > 0) {
    outcomeTag =
      customFeedback ||
      `EXECUTED ${results.length}/${chips.length} ${chips.length === 1 ? "MOVE" : "MOVES"}`;
  } else if (customFeedback) {
    outcomeTag = customFeedback;
  }

  const summary = String(turn?.summary || "").trim();

  return {
    chips,
    chipsKey: chips.map((c) => `${c.tone}:${c.text}`).join("|"),
    rowTone,
    outcomeTag,
    summary,
  };
}

let isInitialized = false;

export function initUI() {
  if (isInitialized) return;
  isInitialized = true;

  // Warm-decode embedded offline WOFF2 studio faces synchronously
  if (typeof document !== "undefined" && document.fonts?.load) {
    document.fonts.load('400 20px "EditorialDisplay"').catch(() => {});
    document.fonts.load('400 84px "EditorialDisplay"').catch(() => {});
    document.fonts.load('400 13px "EditorialSans"').catch(() => {});
    document.fonts.load('500 13px "EditorialSans"').catch(() => {});
    document.fonts.load('600 15px "EditorialSans"').catch(() => {});
    document.fonts.load('400 12px "JetBrains Mono"').catch(() => {});
    document.fonts.load('700 12px "JetBrains Mono"').catch(() => {});
  }

  // Left ~66% Stage HUD DOM refs
  const modelSegBtns = Array.from(document.querySelectorAll(".model-seg-btn[data-model-id]"));
  const btnStartRace = document.getElementById("btn-start-race");
  const labelStartRace = document.getElementById("label-start-race");
  const iconStartRacePath = document.getElementById("icon-start-race-path");

  const countdownOverlayEl = document.getElementById("race-countdown-overlay");
  const countdownMedallionEl = document.getElementById("countdown-medallion");
  const countdownNumeralEl = document.getElementById("countdown-numeral");
  const countdownMatchupEl = document.getElementById("countdown-matchup");

  const winCardEl = document.getElementById("win-card");
  const winHeadingEl = document.getElementById("win-heading");
  const winSummaryEl = document.getElementById("win-summary");
  const btnWinSwitchOpponent = document.getElementById("btn-win-switch-opponent");
  const btnWinRematch = document.getElementById("btn-win-rematch");

  const microPromptEl = document.getElementById("hud-micro-prompt");
  const promptOpponentNameEl = document.getElementById("prompt-opponent-name");

  const btnUndo = document.getElementById("btn-undo");
  const btnResetLap = document.getElementById("btn-reset-lap");
  const btnScrambleRace = document.getElementById("btn-scramble-race");

  const btnCamera = document.getElementById("btn-camera");
  const camSegBtns = Array.from(document.querySelectorAll(".cam-seg-btn[data-camera-mode]"));

  const btnAudio = document.getElementById("btn-audio");
  const iconAudioWaves = document.getElementById("icon-audio-waves");

  // Right ~34% Timing Tower & Model's View and Live Thoughts Feed DOM refs
  const towerPhaseDotEl = document.getElementById("tower-phase-dot");
  const towerPhaseLabelEl = document.getElementById("tower-phase-label");
  const raceOverallClockEl = document.getElementById("race-overall-clock");
  const towerActiveLapPillEl = document.getElementById("tower-active-lap-pill");
  const statusPillEl = document.getElementById("hydrogen-status-pill");
  const statusLabelEl = document.getElementById("hydrogen-status-label");
  const towerMovesSubEl = document.getElementById("tower-moves-sub");

  const lapThOpponentEl = document.getElementById("lap-th-opponent");
  const lapRowRecords = Array.from(document.querySelectorAll("tr.lap-row[data-lap-row]")).map(
    (rowEl) => ({
      lap: Number(rowEl.dataset.lapRow) || 1,
      rowEl,
      youCell: rowEl.querySelector('[data-cell="you"]'),
      aiCell: rowEl.querySelector('[data-cell="ai"]'),
      deltaChip: rowEl.querySelector('[data-cell="delta"]'),
      isActive: null,
      youText: "",
      youClass: "",
      aiText: "",
      aiClass: "",
      deltaText: "",
      deltaClass: "",
    })
  );
  const lapTotalHumanEl = document.getElementById("lap-total-human");
  const lapTotalAiEl = document.getElementById("lap-total-ai");
  const lapTotalDeltaEl = document.getElementById("lap-total-delta");

  const feedEl = document.getElementById("hydrogen-feed");
  const errorBannerEl = document.getElementById("hydrogen-error-banner");
  const errorMsgEl = document.getElementById("hydrogen-error-msg");

  const welcomeCardEl = document.getElementById("hydrogen-welcome-card");
  const welcomeEyebrowEl = document.getElementById("welcome-eyebrow");
  const welcomeModelBadgeEl = document.getElementById("welcome-model-badge");

  const turnsListEl = document.getElementById("hydrogen-turns-list");
  const jumpLivePillEl = document.getElementById("btn-jump-live-turn");

  // Click-to-Zoom Modal DOM refs (strictly for sent turn PNGs)
  const frameModalEl = document.getElementById("hydrogen-frame-modal");
  const modalTitleEl = document.getElementById("frame-modal-title");
  const modalImgEl = document.getElementById("hydrogen-modal-img");
  const modalMetaEl = document.getElementById("frame-modal-meta");
  const btnCloseModal = document.getElementById("btn-close-frame-modal");

  // Strip nudge pulse classes cleanly via animationend (zero timers)
  if (btnStartRace) {
    btnStartRace.addEventListener("animationend", () => {
      btnStartRace.classList.remove("is-nudged");
    });
  }

  let countdownPopParity = false;
  let isFeedPinnedToBottom = true;
  let isProgrammaticScroll = false;

  const turnDomRecords = [];

  const cache = {
    selectedModel: "",
    opponentLabel: "",
    startBtnMode: "",
    countdownVisible: null,
    countdownKey: "",
    promptDismissed: null,
    canUndo: null,
    resetDisabled: null,
    cameraMode: "",
    audioEnabled: null,
    winVisible: null,
    winIsAi: null,
    winHeading: "",
    winSummary: "",
    clockText: "",
    towerPhaseAttr: "",
    towerPhaseText: "",
    activeLapPillText: "",
    activeLapFinished: null,
    aiStatusAttr: "",
    aiStatusText: "",
    movesSubText: "",
    movesExitClear: null,
    totalHumanText: "",
    totalAiText: "",
    totalDeltaText: "",
    totalDeltaClass: "",
    errorVisible: null,
    errorMsg: "",
    welcomeBadgeText: "",
    turnsCount: -1,
    firstTurnId: "",
  };

  function updateJumpLivePill() {
    if (!jumpLivePillEl || !feedEl) return;
    const distFromBottom = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight;
    const show = !isFeedPinnedToBottom && cache.turnsCount > 0 && distFromBottom > 36;
    if (jumpLivePillEl.hidden === show) {
      jumpLivePillEl.hidden = !show;
    }
  }

  if (feedEl) {
    feedEl.addEventListener(
      "scroll",
      () => {
        if (isProgrammaticScroll) return;
        const distFromBottom = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight;
        isFeedPinnedToBottom = distFromBottom <= 36;
        updateJumpLivePill();
      },
      { passive: true }
    );
  }

  if (jumpLivePillEl) {
    jumpLivePillEl.addEventListener("click", () => {
      isFeedPinnedToBottom = true;
      if (feedEl) {
        isProgrammaticScroll = true;
        feedEl.scrollTop = feedEl.scrollHeight;
        isProgrammaticScroll = false;
      }
      updateJumpLivePill();
    });
  }

  function scrollFeedToBottom() {
    if (!feedEl) return;
    if (!isFeedPinnedToBottom) {
      updateJumpLivePill();
      return;
    }
    const maxScroll = Math.max(0, feedEl.scrollHeight - feedEl.clientHeight);
    let targetTop = maxScroll;
    if (maxScroll > 0 && turnDomRecords.length >= 2) {
      const prevRec = turnDomRecords[turnDomRecords.length - 2];
      const lastRec = turnDomRecords[turnDomRecords.length - 1];
      const prevThoughtsTop = Math.max(
        0,
        prevRec.card.offsetTop + prevRec.thoughtsSection.offsetTop - 8
      );
      const activeBottom = lastRec.decisionRow.hidden
        ? lastRec.card.offsetTop +
          lastRec.thoughtsSection.offsetTop +
          lastRec.thoughtsSection.offsetHeight +
          18
        : lastRec.card.offsetTop + lastRec.card.offsetHeight + 14;
      const minScrollForActive = Math.max(0, activeBottom - feedEl.clientHeight);
      targetTop =
        maxScroll <= prevThoughtsTop
          ? maxScroll
          : Math.min(maxScroll, Math.max(minScrollForActive, prevThoughtsTop));
    }
    if (Math.abs(feedEl.scrollTop - targetTop) >= 1) {
      isProgrammaticScroll = true;
      feedEl.scrollTop = targetTop;
      isProgrammaticScroll = false;
    }
    updateJumpLivePill();
  }

  function normalizeCameraMode(mode) {
    return VALID_CAMERA_MODES.has(mode) ? mode : "3d";
  }

  function openFrameModal(src, title = "", meta = "") {
    if (!frameModalEl || !src) return;
    if (modalImgEl) modalImgEl.src = src;
    if (modalTitleEl) modalTitleEl.textContent = title || "Parking Bench · AI 6×6 Back-Board Input";
    if (modalMetaEl) {
      modalMetaEl.textContent = meta || "Blind Angled 3D Screenshot · Sent to Model";
    }
    frameModalEl.hidden = false;
  }

  function closeFrameModal() {
    if (!frameModalEl || frameModalEl.hidden) return;
    frameModalEl.hidden = true;
  }

  function createTurnCardRecord() {
    const card = document.createElement("article");
    card.className = "hydrogen-turn-card";

    // 1. Header: LAP 01 · TURN 01 + Batch Move Count (zero per-turn thinking timer)
    const header = document.createElement("div");
    header.className = "turn-card-header";

    const numBadge = document.createElement("span");
    numBadge.className = "turn-num-badge tabular-nums";

    const batchBadge = document.createElement("span");
    batchBadge.className = "turn-batch-badge tabular-nums";

    header.append(numBadge, batchBadge);

    // 2. Crisp 4:3 Sent AI Back-Board PNG Screenshot (click-to-zoom modal)
    const pngFigure = document.createElement("button");
    pngFigure.type = "button";
    pngFigure.className = "turn-png-figure";
    pngFigure.title = "Click to zoom full-resolution AI 6×6 back-board PNG sent to model";

    const pngImg = document.createElement("img");
    pngImg.className = "turn-png-img";
    pngImg.alt = "AI 6x6 back-board PNG screenshot sent to model";

    const pngCaption = document.createElement("span");
    pngCaption.className = "turn-png-caption";
    pngCaption.textContent = "SENT PNG · ZOOM";

    pngFigure.append(pngImg, pngCaption);

    // 3. Live AI Thoughts / Decisions API Probabilities
    const thoughtsSection = document.createElement("div");
    thoughtsSection.className = "turn-thoughts-section";

    const thoughtsHead = document.createElement("div");
    thoughtsHead.className = "turn-thoughts-head";

    const thoughtsEyebrow = document.createElement("div");
    thoughtsEyebrow.className = "turn-thoughts-eyebrow";

    const expandBtn = document.createElement("button");
    expandBtn.type = "button";
    expandBtn.className = "turn-thoughts-expand-btn";
    expandBtn.textContent = "Expand";
    expandBtn.hidden = true;

    thoughtsHead.append(thoughtsEyebrow, expandBtn);

    const thinkingBody = document.createElement("div");
    thinkingBody.className = "turn-thinking-body";

    const thinkingTextSpan = document.createElement("span");
    thinkingTextSpan.className = "turn-thinking-text";

    const caretSpan = document.createElement("span");
    caretSpan.setAttribute("aria-hidden", "true");
    caretSpan.className = "turn-thinking-caret";
    caretSpan.hidden = true;

    thinkingBody.append(thinkingTextSpan, caretSpan);
    thoughtsSection.append(thoughtsHead, thinkingBody);

    // 4. Multi-Move Sequence Badges & Physical Outcome
    const decisionRow = document.createElement("div");
    decisionRow.className = "turn-decision-row";
    decisionRow.hidden = true;

    const movesChain = document.createElement("div");
    movesChain.className = "turn-moves-chain tabular-nums";

    const decisionMeta = document.createElement("div");
    decisionMeta.className = "turn-decision-meta";

    const outcomeTag = document.createElement("span");
    outcomeTag.className = "turn-outcome-tag tabular-nums";
    outcomeTag.hidden = true;

    const summaryEl = document.createElement("p");
    summaryEl.className = "turn-decision-summary";
    summaryEl.hidden = true;

    decisionMeta.append(outcomeTag);
    decisionRow.append(movesChain, decisionMeta, summaryEl);

    card.append(header, pngFigure, thoughtsSection, decisionRow);

    const record = {
      card,
      numBadge,
      batchBadge,
      pngFigure,
      pngImg,
      thoughtsSection,
      thoughtsEyebrow,
      expandBtn,
      thinkingBody,
      thinkingTextSpan,
      caretSpan,
      decisionRow,
      movesChain,
      outcomeTag,
      summaryEl,
      // Cached render keys
      headerLabel: "",
      batchLabel: "",
      eyebrowText: "",
      modalTitle: "",
      modalMeta: "",
      pngSrc: "",
      isActiveCard: null,
      isExpanded: false,
      thoughtsVisible: null,
      renderedThinking: null,
      showCaret: null,
      hasDecision: false,
      chipsKey: "",
      rowTone: "",
      outcomeTagText: "",
      summaryText: "",
    };

    expandBtn.addEventListener("click", () => {
      record.isExpanded = !record.isExpanded;
      thinkingBody.classList.toggle("is-expanded", record.isExpanded);
      expandBtn.textContent = record.isExpanded ? "Collapse" : "Expand";
    });

    pngFigure.addEventListener("click", () => {
      if (record.pngSrc) {
        openFrameModal(record.pngSrc, record.modalTitle, record.modalMeta);
      }
    });

    return record;
  }

  function clearTurnRecords() {
    if (turnsListEl) {
      turnsListEl.textContent = "";
    }
    turnDomRecords.length = 0;
  }

  function syncTimingTowerAndFeed(race, human, ai, modelOpt, opponentLabel) {
    const phase = race.phase || "setup";
    const rawElapsedMs = Math.max(0, Number(race.elapsedMs) || 0);
    const elapsedMs =
      phase === "finished"
        ? Math.max(
            rawElapsedMs,
            Number(human.totalTimeMs) || 0,
            Number(ai.totalTimeMs) || 0
          )
        : rawElapsedMs;

    // 1. Overall Race Clock (00:00.0 ticking smoothly at 60fps)
    const clockText = formatRaceClockMs(elapsedMs);
    if (cache.clockText !== clockText) {
      cache.clockText = clockText;
      if (raceOverallClockEl) raceOverallClockEl.textContent = clockText;
    }

    // 2. Phase Eyebrow & Active Lap Pill
    const phaseEyebrow =
      phase === "countdown"
        ? "STARTING GRID · COUNTDOWN"
        : phase === "racing"
          ? "LIVE RACE · F3 EXIT"
          : phase === "finished"
            ? "CHECKERED FLAG · 5 LAPS"
            : "5-LAP RACE · PRE-START";

    if (cache.towerPhaseAttr !== phase) {
      cache.towerPhaseAttr = phase;
      if (towerPhaseDotEl) towerPhaseDotEl.setAttribute("data-phase", phase);
    }
    if (cache.towerPhaseText !== phaseEyebrow) {
      cache.towerPhaseText = phaseEyebrow;
      if (towerPhaseLabelEl) towerPhaseLabelEl.textContent = phaseEyebrow;
    }

    const humanLap = Math.max(1, Math.min(TOTAL_LAPS, Number(human.currentLap) || 1));
    const isAllFinished = phase === "finished" || Boolean(human.finished && ai.finished);
    const activeLapText = isAllFinished
      ? "FINAL 5/5"
      : human.finished
        ? "YOU DONE · 5/5"
        : `LAP ${humanLap}/${TOTAL_LAPS}`;

    if (cache.activeLapPillText !== activeLapText) {
      cache.activeLapPillText = activeLapText;
      if (towerActiveLapPillEl) towerActiveLapPillEl.textContent = activeLapText;
    }
    if (cache.activeLapFinished !== isAllFinished) {
      cache.activeLapFinished = isAllFinished;
      if (towerActiveLapPillEl) towerActiveLapPillEl.classList.toggle("is-finished", isAllFinished);
    }

    // 3. AI Opponent Status Pill (strictly zero per-turn thinking timer)
    const rawAiStatus = ai.finished
      ? "finished"
      : ai.status || state.hydrogen?.status || "idle";
    const normAiStatus = AI_STATUS_LABELS[rawAiStatus] ? rawAiStatus : "idle";
    const aiStatusLabel =
      phase === "racing" && !ai.finished && normAiStatus !== "idle"
        ? `${AI_STATUS_LABELS[normAiStatus]} · L${Math.max(1, Math.min(TOTAL_LAPS, Number(ai.currentLap) || 1))}`
        : AI_STATUS_LABELS[normAiStatus];

    if (cache.aiStatusAttr !== normAiStatus) {
      cache.aiStatusAttr = normAiStatus;
      if (statusPillEl) statusPillEl.setAttribute("data-status", normAiStatus);
    }
    if (cache.aiStatusText !== aiStatusLabel) {
      cache.aiStatusText = aiStatusLabel;
      if (statusLabelEl) statusLabelEl.textContent = aiStatusLabel;
    }

    // 4. Human Moves / Corridor Subline
    const lapMoves = Number(human.lapMoves ?? state.moves) || 0;
    const isExitClear = Boolean(human.finished || human.isExitClear || state.isExitClear);
    const movesSubText = human.finished
      ? "YOU: 5/5 LAPS COMPLETE"
      : isExitClear
        ? `YOU: ${lapMoves} ${lapMoves === 1 ? "MOVE" : "MOVES"} · F3 CLEAR!`
        : `YOU: ${lapMoves} ${lapMoves === 1 ? "MOVE" : "MOVES"} · CLEAR ROW 3`;

    if (cache.movesSubText !== movesSubText) {
      cache.movesSubText = movesSubText;
      if (towerMovesSubEl) towerMovesSubEl.textContent = movesSubText;
    }
    if (cache.movesExitClear !== isExitClear) {
      cache.movesExitClear = isExitClear;
      if (towerMovesSubEl) towerMovesSubEl.classList.toggle("is-exit-clear", isExitClear);
    }

    // 5. Motorsport 5-Lap Split Table (L1..L5 + TOTAL)
    const hSplits = Array.isArray(human.lapSplitsMs) ? human.lapSplitsMs : [];
    const aSplits = Array.isArray(ai.lapSplitsMs) ? ai.lapSplitsMs : [];

    for (let i = 0; i < lapRowRecords.length; i++) {
      const rec = lapRowRecords[i];
      const lapNum = rec.lap;
      const hMs = hSplits[i] !== undefined ? hSplits[i] : null;
      const aMs = aSplits[i] !== undefined ? aSplits[i] : null;
      const hDone = hMs !== null && Number.isFinite(Number(hMs));
      const aDone = aMs !== null && Number.isFinite(Number(aMs));

      const isHumanActiveHere =
        phase === "racing" && !human.finished && humanLap === lapNum && !hDone;
      const aiLap = Math.max(1, Math.min(TOTAL_LAPS, Number(ai.currentLap) || 1));
      const isAiActiveHere =
        phase === "racing" && !ai.finished && aiLap === lapNum && !aDone;

      const isRowActive =
        ((phase === "setup" || phase === "countdown") && lapNum === 1) ||
        isHumanActiveHere ||
        isAiActiveHere;

      if (rec.isActive !== isRowActive) {
        rec.isActive = isRowActive;
        rec.rowEl.classList.toggle("is-active-lap", isRowActive);
      }

      // YOU (Front) split cell
      let youText = "—";
      let youClass = "col-you";
      if (hDone) {
        youText = formatSplitSec(hMs);
        youClass =
          aDone && Number(hMs) <= Number(aMs) - 50
            ? "col-you is-stamped is-faster"
            : "col-you is-stamped";
      } else if (isHumanActiveHere) {
        const liveHumanLapMs = Math.max(0, elapsedMs - (Number(human.lapStartElapsedMs) || 0));
        youText = formatSplitSec(liveHumanLapMs);
        youClass = "col-you is-live";
      }

      if (rec.youText !== youText) {
        rec.youText = youText;
        if (rec.youCell) rec.youCell.textContent = youText;
      }
      if (rec.youClass !== youClass) {
        rec.youClass = youClass;
        if (rec.youCell) rec.youCell.className = youClass;
      }

      // AI OPPONENT (Back) split cell
      let aiText = "—";
      let aiClass = "col-ai";
      if (aDone) {
        aiText = formatSplitSec(aMs);
        aiClass =
          hDone && Number(aMs) <= Number(hMs) - 50
            ? "col-ai is-stamped is-faster"
            : "col-ai is-stamped";
      } else if (isAiActiveHere) {
        const liveAiLapMs = Math.max(0, elapsedMs - (Number(ai.lapStartElapsedMs) || 0));
        aiText = formatSplitSec(liveAiLapMs);
        aiClass = "col-ai is-live";
      }

      if (rec.aiText !== aiText) {
        rec.aiText = aiText;
        if (rec.aiCell) rec.aiCell.textContent = aiText;
      }
      if (rec.aiClass !== aiClass) {
        rec.aiClass = aiClass;
        if (rec.aiCell) rec.aiCell.className = aiClass;
      }

      // DELTA cell (Semantic Emerald when Human is faster, Warm Crimson when slower)
      let deltaText = "—";
      let deltaClass = "delta-chip is-neutral";
      if (hDone && aDone) {
        const delta = formatDeltaSec(hMs, aMs);
        deltaText = delta.text;
        deltaClass =
          delta.tone === "emerald"
            ? "delta-chip is-emerald"
            : delta.tone === "crimson"
              ? "delta-chip is-crimson"
              : "delta-chip is-neutral";
      } else if (hDone && !aDone) {
        deltaText = "LEAD";
        deltaClass = "delta-chip is-emerald";
      } else if (!hDone && aDone) {
        deltaText = "AI ✓";
        deltaClass = "delta-chip is-crimson";
      }

      if (rec.deltaText !== deltaText) {
        rec.deltaText = deltaText;
        if (rec.deltaChip) rec.deltaChip.textContent = deltaText;
      }
      if (rec.deltaClass !== deltaClass) {
        rec.deltaClass = deltaClass;
        if (rec.deltaChip) rec.deltaChip.className = deltaClass;
      }
    }

    // Cumulative TOTAL Row
    const hCumArr = Array.isArray(human.cumulativeSplitsMs) ? human.cumulativeSplitsMs : [];
    const aCumArr = Array.isArray(ai.cumulativeSplitsMs) ? ai.cumulativeSplitsMs : [];
    const hCompleted = Math.max(0, Math.min(TOTAL_LAPS, Number(human.completedLaps) || 0));
    const aCompleted = Math.max(0, Math.min(TOTAL_LAPS, Number(ai.completedLaps) || 0));

    const hCumMs =
      human.totalTimeMs !== null && Number.isFinite(Number(human.totalTimeMs))
        ? Number(human.totalTimeMs)
        : hCompleted > 0 && Number.isFinite(Number(hCumArr[hCompleted - 1]))
          ? Number(hCumArr[hCompleted - 1])
          : null;

    const aCumMs =
      ai.totalTimeMs !== null && Number.isFinite(Number(ai.totalTimeMs))
        ? Number(ai.totalTimeMs)
        : aCompleted > 0 && Number.isFinite(Number(aCumArr[aCompleted - 1]))
          ? Number(aCumArr[aCompleted - 1])
          : null;

    const totalHumanText =
      hCumMs !== null
        ? formatRaceClockMs(hCumMs)
        : phase === "racing"
          ? formatRaceClockMs(elapsedMs)
          : "—";

    const totalAiText =
      aCumMs !== null
        ? formatRaceClockMs(aCumMs)
        : phase === "racing"
          ? formatRaceClockMs(elapsedMs)
          : "—";

    const commonCompleted = Math.min(hCompleted, aCompleted);
    let totalDeltaText = "—";
    let totalDeltaClass = "delta-chip is-neutral";

    if (human.finished && ai.finished && hCumMs !== null && aCumMs !== null) {
      const dTotal = formatDeltaSec(hCumMs, aCumMs);
      totalDeltaText = dTotal.text;
      totalDeltaClass =
        dTotal.tone === "emerald"
          ? "delta-chip is-emerald"
          : dTotal.tone === "crimson"
            ? "delta-chip is-crimson"
            : "delta-chip is-neutral";
    } else if (commonCompleted >= 1) {
      const hCommonMs = hCumArr[commonCompleted - 1];
      const aCommonMs = aCumArr[commonCompleted - 1];
      const dCommon = formatDeltaSec(hCommonMs, aCommonMs);
      totalDeltaText = dCommon.text;
      totalDeltaClass =
        dCommon.tone === "emerald"
          ? "delta-chip is-emerald"
          : dCommon.tone === "crimson"
            ? "delta-chip is-crimson"
            : "delta-chip is-neutral";
    } else if (hCompleted > aCompleted) {
      totalDeltaText = `+${hCompleted - aCompleted} LAP`;
      totalDeltaClass = "delta-chip is-emerald";
    } else if (aCompleted > hCompleted) {
      totalDeltaText = `-${aCompleted - hCompleted} LAP`;
      totalDeltaClass = "delta-chip is-crimson";
    }

    if (cache.totalHumanText !== totalHumanText) {
      cache.totalHumanText = totalHumanText;
      if (lapTotalHumanEl) lapTotalHumanEl.textContent = totalHumanText;
    }
    if (cache.totalAiText !== totalAiText) {
      cache.totalAiText = totalAiText;
      if (lapTotalAiEl) lapTotalAiEl.textContent = totalAiText;
    }
    if (cache.totalDeltaText !== totalDeltaText) {
      cache.totalDeltaText = totalDeltaText;
      if (lapTotalDeltaEl) lapTotalDeltaEl.textContent = totalDeltaText;
    }
    if (cache.totalDeltaClass !== totalDeltaClass) {
      cache.totalDeltaClass = totalDeltaClass;
      if (lapTotalDeltaEl) lapTotalDeltaEl.className = totalDeltaClass;
    }

    // 6. Model's View and Live Thoughts Feed (Strictly Zero Image / Zero Thoughts Before Sent to Model)
    const h = state.hydrogen || {};
    const rawTurns = Array.isArray(ai.turns)
      ? ai.turns
      : Array.isArray(h.turns)
        ? h.turns
        : [];
    // Only display turns that have actually captured & sent a real PNG to the model
    const sentTurns = rawTurns.filter((t) => Boolean(t && t.frameDataUrl));

    // Error Banner
    const isError = normAiStatus === "error";
    const errMsg =
      String(ai.errorMessage || h.errorMessage || "").trim() ||
      "Live AI request was interrupted. Press Restart Race to launch a fresh heat.";

    let didMutateFeed = false;
    if (cache.errorVisible !== isError) {
      cache.errorVisible = isError;
      if (errorBannerEl) errorBannerEl.hidden = !isError;
      didMutateFeed = true;
    }
    if (isError && cache.errorMsg !== errMsg) {
      cache.errorMsg = errMsg;
      if (errorMsgEl) errorMsgEl.textContent = errMsg;
      didMutateFeed = true;
    }

    // Pre-Race Header Row ("Lap 1 Preview" + "Low Thinking") — zero <img>, zero thought output
    if (welcomeEyebrowEl && welcomeEyebrowEl.textContent !== "Lap 1 Preview") {
      welcomeEyebrowEl.textContent = "Lap 1 Preview";
    }
    const welcomeBadgeText =
      modelOpt.id === "gemini-decision-1" && modelOpt.badge && !/Fast/i.test(modelOpt.badge)
        ? modelOpt.badge
        : "Low Thinking";
    if (cache.welcomeBadgeText !== welcomeBadgeText) {
      cache.welcomeBadgeText = welcomeBadgeText;
      if (welcomeModelBadgeEl) welcomeModelBadgeEl.textContent = welcomeBadgeText;
    }

    if (sentTurns.length === 0) {
      if (cache.turnsCount !== 0) {
        cache.turnsCount = 0;
        cache.firstTurnId = "";
        clearTurnRecords();
        if (welcomeCardEl) welcomeCardEl.hidden = false;
        if (turnsListEl) turnsListEl.hidden = true;
        if (feedEl) {
          isProgrammaticScroll = true;
          feedEl.scrollTop = 0;
          isProgrammaticScroll = false;
        }
        isFeedPinnedToBottom = true;
        updateJumpLivePill();
      }
      return;
    }

    if (cache.turnsCount <= 0) {
      if (welcomeCardEl) welcomeCardEl.hidden = true;
      if (turnsListEl) turnsListEl.hidden = false;
      didMutateFeed = true;
    }

    const firstId = String(
      sentTurns[0]?.id ?? `${sentTurns[0]?.lap || 1}-${sentTurns[0]?.turn || 1}`
    );
    if (
      sentTurns.length < turnDomRecords.length ||
      (cache.firstTurnId && cache.firstTurnId !== firstId)
    ) {
      clearTurnRecords();
      didMutateFeed = true;
    }
    cache.firstTurnId = firstId;

    if (sentTurns.length > cache.turnsCount) {
      didMutateFeed = true;
    }
    cache.turnsCount = sentTurns.length;

    for (let i = 0; i < sentTurns.length; i++) {
      const t = sentTurns[i] || {};
      const isLast = i === sentTurns.length - 1;
      let rec = turnDomRecords[i];
      if (!rec) {
        rec = createTurnCardRecord();
        rec.startedRaceElapsedMs = elapsedMs;
        turnDomRecords.push(rec);
        if (turnsListEl) turnsListEl.appendChild(rec.card);
        didMutateFeed = true;
      }

      const lapNum = Number(t.lap) || 1;
      const turnInLap = Number(t.lapTurn || t.turn) || i + 1;
      const turnModelId = String(t.model || modelOpt.id);
      const turnModelLabel = String(t.modelLabel || getModelOption(turnModelId).label);

      const headerLabel = `LAP ${pad2(lapNum)} · TURN ${pad2(turnInLap)}`;
      const rawMoves = extractRawMovesArray(t);
      const isTurnThinking =
        typeof t.isThinking === "boolean"
          ? t.isThinking
          : isLast &&
            (normAiStatus === "thinking" || normAiStatus === "observing") &&
            rawMoves.length === 0;

      const batchLabel =
        rawMoves.length > 0
          ? turnModelId === "gemini-decision-1"
            ? `${rawMoves.length} ${rawMoves.length === 1 ? "MOVE" : "MOVES"} · 0 TOK`
            : `${rawMoves.length} ${rawMoves.length === 1 ? "MOVE" : "MOVES"} PLANNED`
          : isTurnThinking
            ? "LIVE STREAM"
            : "SENT PNG";

      if (rec.headerLabel !== headerLabel) {
        rec.headerLabel = headerLabel;
        rec.numBadge.textContent = headerLabel;
        rec.modalTitle = `Parking Bench · Lap ${pad2(lapNum)} Turn ${pad2(turnInLap)} (${turnModelLabel})`;
        rec.modalMeta = "Sent 6×6 Back-Board PNG · Blind Vision Input";
        rec.pngImg.alt = rec.modalTitle;
      }

      if (rec.batchLabel !== batchLabel) {
        rec.batchLabel = batchLabel;
        rec.batchBadge.textContent = batchLabel;
      }

      let eyebrowText = "";
      if (isTurnThinking) {
        const raceStartMs = Number(t.startedRaceElapsedMs ?? rec.startedRaceElapsedMs);
        const startMs = Number(t.startedAtMs);
        const liveSec =
          Number.isFinite(raceStartMs) && elapsedMs > raceStartMs
            ? Math.max(0.1, (elapsedMs - raceStartMs) / 1000)
            : Number.isFinite(startMs) && startMs >= 0 && performance.now() >= startMs
              ? Math.max(0.1, (performance.now() - startMs) / 1000)
              : 0.1;
        eyebrowText = `● STREAMING LIVE TRACE · ${liveSec.toFixed(1)}s`;
      } else {
        const doneSec =
          Number.isFinite(Number(t.durationSec)) && Number(t.durationSec) > 0
            ? Number(t.durationSec)
            : 0;
        eyebrowText =
          turnModelId === "gemini-decision-1"
            ? doneSec > 0
              ? `DECISIONS TRACE · ${doneSec.toFixed(1)}s`
              : "DECISIONS TRACE"
            : doneSec > 0
              ? `THOUGHT TRACE · ${doneSec.toFixed(1)}s`
              : "THOUGHT TRACE";
      }

      if (rec.eyebrowText !== eyebrowText) {
        rec.eyebrowText = eyebrowText;
        rec.thoughtsEyebrow.textContent = eyebrowText;
        rec.thoughtsEyebrow.classList.toggle("is-streaming", isTurnThinking);
      }

      const turnPngSrc = String(t.frameDataUrl || "");
      if (rec.pngSrc !== turnPngSrc) {
        rec.pngSrc = turnPngSrc;
        rec.pngImg.src = turnPngSrc;
        didMutateFeed = true;
      }

      const isActiveCard =
        isLast &&
        (isTurnThinking ||
          normAiStatus === "observing" ||
          normAiStatus === "thinking" ||
          normAiStatus === "moving");

      if (rec.isActiveCard !== isActiveCard) {
        rec.isActiveCard = isActiveCard;
        rec.card.classList.toggle("is-active-turn", isActiveCard);
      }

      const rawThinking =
        typeof t.thinkingText === "string"
          ? t.thinkingText
          : typeof t.fullThinkingText === "string"
            ? t.fullThinkingText
            : "";
      const cleanedThinking = rawThinking.replace(/^\n+/, "");
      const showThoughtsSection = Boolean(cleanedThinking || isTurnThinking);

      if (rec.thoughtsVisible !== showThoughtsSection) {
        rec.thoughtsVisible = showThoughtsSection;
        rec.thoughtsSection.hidden = !showThoughtsSection;
        didMutateFeed = true;
      }

      if (rec.renderedThinking !== cleanedThinking) {
        rec.renderedThinking = cleanedThinking;
        renderThoughtTextSafe(rec.thinkingTextSpan, cleanedThinking);
        const isVeryLong = cleanedThinking.length > 1400;
        rec.expandBtn.hidden = !isVeryLong;
        rec.thinkingBody.classList.toggle("is-clamped-long", isVeryLong);
        didMutateFeed = true;
      }

      if (rec.showCaret !== isTurnThinking) {
        rec.showCaret = isTurnThinking;
        rec.caretSpan.hidden = !isTurnThinking;
      }

      const decision = formatTurnBatchDecision(t);
      const hasDecision = Boolean(decision);
      if (rec.hasDecision !== hasDecision) {
        rec.hasDecision = hasDecision;
        rec.decisionRow.hidden = !hasDecision;
        didMutateFeed = true;
      }

      if (decision) {
        if (rec.chipsKey !== decision.chipsKey) {
          rec.chipsKey = decision.chipsKey;
          rec.movesChain.textContent = "";
          for (let c = 0; c < decision.chips.length; c++) {
            if (c > 0) {
              const sep = document.createElement("span");
              sep.className = "turn-move-sep";
              sep.setAttribute("aria-hidden", "true");
              sep.textContent = "·";
              rec.movesChain.appendChild(sep);
            }
            const item = decision.chips[c];
            const chipEl = document.createElement("span");
            chipEl.className =
              item.tone === "exit"
                ? "turn-move-chip is-chip-exit"
                : item.tone === "bumped"
                  ? "turn-move-chip is-chip-bumped"
                  : "turn-move-chip";
            chipEl.textContent = item.text;
            rec.movesChain.appendChild(chipEl);
          }
          rec.movesChain.hidden = decision.chips.length === 0;
          didMutateFeed = true;
        }

        if (rec.rowTone !== decision.rowTone) {
          rec.rowTone = decision.rowTone;
          rec.decisionRow.classList.toggle("is-amber", decision.rowTone === "amber");
          rec.decisionRow.classList.toggle("is-emerald", decision.rowTone === "emerald");
        }

        if (rec.outcomeTagText !== decision.outcomeTag) {
          rec.outcomeTagText = decision.outcomeTag;
          rec.outcomeTag.textContent = decision.outcomeTag;
          rec.outcomeTag.hidden = !decision.outcomeTag;
          didMutateFeed = true;
        }

        if (rec.summaryText !== decision.summary) {
          rec.summaryText = decision.summary;
          rec.summaryEl.textContent = decision.summary;
          rec.summaryEl.hidden = !decision.summary;
          didMutateFeed = true;
        }
      }
    }

    if (didMutateFeed) {
      scrollFeedToBottom();
    }
  }

  function syncHUD() {
    const race = state.race || {};
    const human = race.human || {};
    const ai = race.ai || {};
    const phase = race.phase || "setup";

    const candidateId = race.selectedModel || state.hydrogen?.modelId || "gemini-4-hydrogen";
    const safeModelId = ALLOWED_UI_MODELS.has(candidateId) ? candidateId : "gemini-4-hydrogen";
    const modelOpt = getModelOption(safeModelId);
    const opponentLabel =
      safeModelId === candidateId && race.opponentLabel ? race.opponentLabel : modelOpt.label;

    // 1. Sync 2-Way Opponent Model Switcher + Dynamic Opponent Labels
    if (cache.selectedModel !== modelOpt.id || cache.opponentLabel !== opponentLabel) {
      cache.selectedModel = modelOpt.id;
      cache.opponentLabel = opponentLabel;

      for (const btn of modelSegBtns) {
        const active = btn.dataset.modelId === modelOpt.id;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-checked", active ? "true" : "false");
      }
      if (promptOpponentNameEl) promptOpponentNameEl.textContent = opponentLabel;
      if (lapThOpponentEl) lapThOpponentEl.textContent = opponentLabel;
      if (countdownMatchupEl) countdownMatchupEl.textContent = `YOU vs. ${opponentLabel}`;
    }

    // 2. Sync Primary Race Action CTA: Start Race | Restart Race | Rematch
    const startBtnMode =
      phase === "finished"
        ? "rematch"
        : phase === "racing" || phase === "countdown"
          ? "restart"
          : "start";

    if (cache.startBtnMode !== startBtnMode) {
      cache.startBtnMode = startBtnMode;
      if (btnStartRace) {
        btnStartRace.classList.toggle("is-racing", startBtnMode === "restart");
        btnStartRace.title =
          startBtnMode === "rematch"
            ? "Start a Fresh 5-Lap Rematch"
            : startBtnMode === "restart"
              ? "Restart 5-Lap Race"
              : "Start 5-Lap Head-to-Head Race";
      }
      if (labelStartRace) {
        labelStartRace.textContent =
          startBtnMode === "rematch"
            ? "Rematch"
            : startBtnMode === "restart"
              ? "Restart Race"
              : "Start Race";
      }
      if (iconStartRacePath) {
        iconStartRacePath.setAttribute(
          "d",
          startBtnMode === "restart" ? ICON_RESTART : ICON_PLAY
        );
      }
    }

    // 3. Big Center 3 · 2 · 1 · GO! Countdown Overlay
    const showCountdown = phase === "countdown" && race.countdownValue !== null;
    if (cache.countdownVisible !== showCountdown) {
      cache.countdownVisible = showCountdown;
      if (countdownOverlayEl) countdownOverlayEl.hidden = !showCountdown;
    }

    if (showCountdown) {
      const rawVal = String(race.countdownValue).trim().toUpperCase();
      const isGo = rawVal === "GO" || rawVal === "GO!" || rawVal === "0";
      const displayVal = isGo ? "GO!" : rawVal;
      if (cache.countdownKey !== displayVal) {
        cache.countdownKey = displayVal;
        if (countdownNumeralEl) {
          countdownNumeralEl.textContent = displayVal;
          countdownNumeralEl.classList.toggle("is-go", isGo);
        }
        if (countdownMedallionEl) {
          countdownPopParity = !countdownPopParity;
          countdownMedallionEl.classList.toggle("is-pop-a", countdownPopParity);
          countdownMedallionEl.classList.toggle("is-pop-b", !countdownPopParity);
        }
      }
    } else {
      cache.countdownKey = "";
    }

    // 4. Pre-Race Micro-Prompt (Visible in setup, dismissed once countdown/race starts)
    const promptDismissed = phase !== "setup";
    if (cache.promptDismissed !== promptDismissed) {
      cache.promptDismissed = promptDismissed;
      if (microPromptEl) {
        microPromptEl.classList.toggle("is-dismissed", promptDismissed);
        if (promptDismissed) microPromptEl.classList.remove("is-nudged");
      }
    }

    // 5. Checkered-Flag Podium / Win Banner (#win-card)
    const resolvedWinner =
      race.winner ||
      (phase === "finished"
        ? (human.totalTimeMs ?? Infinity) <= (ai.totalTimeMs ?? Infinity)
          ? "human"
          : "ai"
        : null);
    const showWinCard = Boolean(resolvedWinner);

    if (cache.winVisible !== showWinCard) {
      cache.winVisible = showWinCard;
      if (winCardEl) winCardEl.hidden = !showWinCard;
    }

    if (showWinCard) {
      const isAiWinner = resolvedWinner === "ai";
      if (cache.winIsAi !== isAiWinner) {
        cache.winIsAi = isAiWinner;
        if (winCardEl) winCardEl.classList.toggle("is-ai-winner", isAiWinner);
      }

      const winHeading = isAiWinner
        ? `${opponentLabel} Won the Race!`
        : `You Defeated ${opponentLabel}!`;

      if (cache.winHeading !== winHeading) {
        cache.winHeading = winHeading;
        if (winHeadingEl) winHeadingEl.textContent = winHeading;
      }

      let winSummary = "";
      const hTotal = human.totalTimeMs;
      const aTotal = ai.totalTimeMs;
      if (hTotal !== null && aTotal !== null) {
        const d = formatDeltaSec(hTotal, aTotal);
        winSummary = `YOU ${formatRaceClockMs(hTotal)} · ${opponentLabel} ${formatRaceClockMs(aTotal)} (${d.text})`;
      } else if (!isAiWinner && hTotal !== null) {
        winSummary = `YOU ${formatRaceClockMs(hTotal)} (5/5 Laps) · ${opponentLabel} on Lap ${Math.min(TOTAL_LAPS, ai.currentLap || 1)}/5`;
      } else if (isAiWinner && aTotal !== null) {
        winSummary = `${opponentLabel} ${formatRaceClockMs(aTotal)} (5/5 Laps) · Slide Row 3 to finish Lap ${Math.min(TOTAL_LAPS, human.currentLap || 1)}/5`;
      } else {
        winSummary = `Parking Bench 5-Lap Race Complete · ${formatRaceClockMs(race.elapsedMs)}`;
      }

      if (cache.winSummary !== winSummary) {
        cache.winSummary = winSummary;
        if (winSummaryEl) winSummaryEl.textContent = winSummary;
      }
    }

    // 6. Bottom Dock Controls (Undo, Reset Lap, Camera, Audio)
    const canUndo = Boolean(
      phase === "racing" && !human.finished && (human.canUndo || state.canUndo)
    );
    if (cache.canUndo !== canUndo) {
      cache.canUndo = canUndo;
      if (btnUndo) btnUndo.disabled = !canUndo;
    }

    const resetDisabled = phase === "countdown" || Boolean(human.finished && phase === "racing");
    if (cache.resetDisabled !== resetDisabled) {
      cache.resetDisabled = resetDisabled;
      if (btnResetLap) btnResetLap.disabled = resetDisabled;
    }

    const cameraMode = normalizeCameraMode(state.cameraMode);
    if (cache.cameraMode !== cameraMode) {
      cache.cameraMode = cameraMode;
      if (btnCamera) {
        btnCamera.setAttribute("data-camera-mode", cameraMode);
      }
      for (const seg of camSegBtns) {
        const active = seg.dataset.cameraMode === cameraMode;
        seg.classList.toggle("is-active", active);
        seg.setAttribute("aria-pressed", active ? "true" : "false");
      }
    }

    const audioEnabled = Boolean(state.audioEnabled);
    if (cache.audioEnabled !== audioEnabled) {
      cache.audioEnabled = audioEnabled;
      if (btnAudio) {
        btnAudio.classList.toggle("is-muted", !audioEnabled);
        btnAudio.setAttribute("aria-pressed", audioEnabled ? "true" : "false");
        btnAudio.setAttribute("aria-label", audioEnabled ? "Audio On" : "Audio Muted");
        btnAudio.setAttribute("title", audioEnabled ? "Audio On (M)" : "Audio Muted (M)");
      }
      if (iconAudioWaves) {
        iconAudioWaves.setAttribute("d", audioEnabled ? ICON_AUDIO_ON : ICON_AUDIO_OFF);
      }
    }

    syncTimingTowerAndFeed(race, human, ai, modelOpt, opponentLabel);
  }

  // Wire 2-Way Opponent Model Switcher (Gemini 4 Hydrogen | Decisions API)
  for (const btn of modelSegBtns) {
    btn.addEventListener("click", () => {
      const modelId = btn.dataset.modelId || "gemini-4-hydrogen";
      if (!ALLOWED_UI_MODELS.has(modelId)) return;
      dispatchAction(DEMO_ACTIONS.SELECT_MODEL, { model: modelId, autoStart: false });
      syncHUD();
    });
  }

  // Wire Start Race / Restart Race / Rematch CTA
  if (btnStartRace) {
    btnStartRace.addEventListener("click", () => {
      const phase = state.race?.phase || "setup";
      isFeedPinnedToBottom = true;
      if (phase === "finished") {
        dispatchAction(DEMO_ACTIONS.REMATCH_RACE, { autoStart: true });
      } else if (phase === "racing" || phase === "countdown") {
        dispatchAction(DEMO_ACTIONS.RESTART_RACE, { freshPack: true, autoStart: true });
      } else {
        dispatchAction(DEMO_ACTIONS.START_RACE, { freshPack: false });
      }
      syncHUD();
    });
  }

  // Wire Win Banner Actions (Rematch & Switch Opponent)
  if (btnWinRematch) {
    btnWinRematch.addEventListener("click", () => {
      isFeedPinnedToBottom = true;
      dispatchAction(DEMO_ACTIONS.REMATCH_RACE, { autoStart: true });
      syncHUD();
    });
  }

  if (btnWinSwitchOpponent) {
    btnWinSwitchOpponent.addEventListener("click", () => {
      const allowedOpts = MODEL_OPTIONS.filter((m) => ALLOWED_UI_MODELS.has(m.id));
      const pool =
        allowedOpts.length >= 2
          ? allowedOpts
          : [{ id: "gemini-4-hydrogen" }, { id: "gemini-decision-1" }];
      const curId = state.race?.selectedModel || pool[0].id;
      const curIdx = pool.findIndex((m) => m.id === curId);
      const nextOpt = pool[(curIdx + 1) % pool.length];
      isFeedPinnedToBottom = true;
      dispatchAction(DEMO_ACTIONS.SELECT_MODEL, { model: nextOpt.id, autoStart: false });
      if ((state.race?.phase || "setup") !== "setup") {
        dispatchAction(DEMO_ACTIONS.RESTART_RACE, { freshPack: true, autoStart: false });
      }
      syncHUD();
    });
  }

  // Wire Bottom Dock Controls
  if (btnUndo) {
    btnUndo.addEventListener("click", () => {
      if (!btnUndo.disabled) {
        dispatchAction(DEMO_ACTIONS.TRIGGER_UNDO);
      }
    });
  }

  if (btnResetLap) {
    btnResetLap.addEventListener("click", () => {
      if ((state.race?.phase || "setup") === "racing") {
        dispatchAction(DEMO_ACTIONS.RESET_HUMAN_LAP);
      } else {
        dispatchAction(DEMO_ACTIONS.SCRAMBLE_RACE, { autoStart: false });
      }
      syncHUD();
    });
  }

  if (btnScrambleRace) {
    btnScrambleRace.addEventListener("click", () => {
      isFeedPinnedToBottom = true;
      dispatchAction(DEMO_ACTIONS.SCRAMBLE_RACE, { autoStart: false });
      syncHUD();
    });
  }

  for (const seg of camSegBtns) {
    seg.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetMode = normalizeCameraMode(seg.dataset.cameraMode);
      dispatchAction(DEMO_ACTIONS.TOGGLE_CAMERA, { cameraMode: targetMode });
      syncHUD();
    });
  }

  if (btnCamera) {
    btnCamera.addEventListener("click", () => {
      dispatchAction(DEMO_ACTIONS.TOGGLE_CAMERA);
      syncHUD();
    });
  }

  if (btnAudio) {
    btnAudio.addEventListener("click", () => {
      dispatchAction(DEMO_ACTIONS.TOGGLE_AUDIO);
      syncHUD();
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", closeFrameModal);
  }

  if (frameModalEl) {
    frameModalEl.addEventListener("click", (e) => {
      if (e.target === frameModalEl) closeFrameModal();
    });
  }

  // Desktop Hotkeys (Esc closes modal, C cycles camera, M toggles audio)
  if (typeof window !== "undefined") {
    let keySnapshot = null;

    window.addEventListener(
      "keydown",
      (e) => {
        if (e.code === "Escape" && frameModalEl && !frameModalEl.hidden) {
          e.preventDefault();
          closeFrameModal();
          return;
        }
        keySnapshot = {
          cameraMode: state.cameraMode,
          audioEnabled: state.audioEnabled,
        };
      },
      { capture: true }
    );

    queueMicrotask(() => {
      window.addEventListener("keydown", (e) => {
        if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
          return;
        }
        const targetEl = e.target;
        const tag = targetEl?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          targetEl?.isContentEditable ||
          targetEl?.closest?.('[contenteditable="true"], [contenteditable=""]')
        ) {
          return;
        }

        if (e.code === "KeyC") {
          if (!keySnapshot || state.cameraMode === keySnapshot.cameraMode) {
            e.preventDefault();
            dispatchAction(DEMO_ACTIONS.TOGGLE_CAMERA);
          }
          return;
        }

        if (e.code === "KeyM") {
          if (!keySnapshot || state.audioEnabled === keySnapshot.audioEnabled) {
            e.preventDefault();
            dispatchAction(DEMO_ACTIONS.TOGGLE_AUDIO);
          }
        }
      });

      const baseEnsureClick = window.__ensureDemoClick;
      window.__ensureDemoClick = (demoId) => {
        const direct = document.querySelector(`[data-demo-id="${demoId}"]`);
        if (direct) {
          direct.click();
          return;
        }
        const alias = document.querySelector(`[data-demo-alias="${demoId}"]`);
        if (alias) {
          alias.click();
          return;
        }
        if (typeof baseEnsureClick === "function") {
          baseEnsureClick(demoId);
        }
      };
    });
  }

  // Subscribe to all orthogonal contract events + setup nudge pulse
  bus.addEventListener(DEMO_EVENTS.RACE_SETUP_NUDGE, () => {
    if (btnStartRace) {
      btnStartRace.classList.remove("is-nudged");
      void btnStartRace.offsetWidth;
      btnStartRace.classList.add("is-nudged");
    }
    if (microPromptEl && !microPromptEl.classList.contains("is-dismissed")) {
      microPromptEl.classList.add("is-nudged");
    }
    syncHUD();
  });

  bus.addEventListener(DEMO_EVENTS.AI_TURN_STARTED, () => {
    syncHUD();
  });

  bus.addEventListener(DEMO_EVENTS.HYDROGEN_SESSION_RESET, () => {
    isFeedPinnedToBottom = true;
    syncHUD();
  });

  bus.addEventListener(DEMO_EVENTS.RACE_PACK_GENERATED, () => {
    isFeedPinnedToBottom = true;
    syncHUD();
  });

  const subscribedEventSet = new Set(Object.values(DEMO_EVENTS));
  for (const eventName of subscribedEventSet) {
    bus.addEventListener(eventName, syncHUD);
  }

  // Initial synchronous render pass
  syncHUD();
}
