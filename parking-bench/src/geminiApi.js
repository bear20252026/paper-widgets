/**
 * src/geminiApi.js — Zero-Key Same-Origin Browser Client for Parking Bench · 6×6 Race
 * Project: Parking Bench · 6×6 Race — Human vs. Gemini AI Visual Spatial Race
 *
 * Security & Architecture:
 *   - 100% server-side Gemini API authentication via AI Studio's injected `process.env.GEMINI_API_KEY`
 *     on the applet's Node.js backend (`/api/race/plan`) — zero client-side API keys.
 *   - Per-tab cryptographic `x-client-id` session header isolates multi-turn `previousInteractionId`
 *     state across concurrent players in shared containers.
 *   - Supports both selectable race models:
 *       1. `gemini-4-hydrogen` (Interactions API, locked `thinking_level: "low"`, SSE streaming)
 *       2. `gemini-decision-1` (Decisions API `/v1beta/decisions`, 0 output tokens, calibrated probabilities)
 */

export const MODEL_CATALOG = [
  { id: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen", badge: "Low Thinking" },
  { id: "gemini-decision-1", label: "Decisions API", badge: "0 Output Tokens" },
];

export const DEFAULT_HYDROGEN_MODEL = "gemini-4-hydrogen";
export const VALID_THINKING_LEVELS = ["low"];

export const RACE_API_ENDPOINT = "./api/race/plan";

function createSessionClientId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (_) {}
  return `pb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

const CLIENT_SESSION_ID = createSessionClientId();

export class GeminiApiError extends Error {
  constructor(message, { status = 0, isAuthError = false } = {}) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
    this.isAuthError = isAuthError;
  }
}

// Backwards-compatible no-op stubs (API key & thinking level are 100% server-side locked)
export function getStoredApiKey() {
  return "";
}

export function setStoredApiKey() {
  return "";
}

export function clearStoredApiKey() {
  return "";
}

export function maskApiKey() {
  return "";
}

export function getStoredThinkingLevel() {
  return "low";
}

export function setStoredThinkingLevel() {
  return "low";
}

function normalizeCoord(rawCoord) {
  const s = String(rawCoord || "").trim().toUpperCase();
  const m = s.match(/([A-F])\s*([1-6])/);
  return m ? `${m[1]}${m[2]}` : "";
}

function normalizeDirection(rawDir) {
  const d = String(rawDir || "").trim().toUpperCase();
  if (d === "UP" || d === "NORTH" || d === "U" || d === "N") return "UP";
  if (d === "DOWN" || d === "SOUTH" || d === "D" || d === "S") return "DOWN";
  if (d === "LEFT" || d === "WEST" || d === "L" || d === "W") return "LEFT";
  if (d === "RIGHT" || d === "EAST" || d === "EXIT" || d === "R" || d === "E") return "RIGHT";
  return "";
}

function sanitizeSingleMove(rawMove) {
  if (!rawMove || typeof rawMove !== "object") return null;
  const car_coord = normalizeCoord(
    rawMove.car_coord || rawMove.coord || rawMove.cell || rawMove.stall || ""
  );
  const direction = normalizeDirection(
    rawMove.direction || rawMove.dir || rawMove.action || rawMove.move || ""
  );
  if (!car_coord || !direction) return null;
  const rawCells = rawMove.cells ?? rawMove.steps ?? rawMove.distance ?? 1;
  const cells = Math.max(1, Math.min(5, Math.round(Number(rawCells) || 1)));
  const isExit = Boolean(
    rawMove.isExit || (car_coord.endsWith("3") && direction === "RIGHT" && cells >= 4)
  );
  return {
    car_coord,
    direction,
    cells: isExit ? Math.max(cells, 5) : cells,
    isExit,
  };
}

function extractBalancedJsonObjects(text) {
  const out = [];
  const s = String(text || "");
  for (let start = 0; start < s.length; start++) {
    if (s[start] !== "{") continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          out.push(s.slice(start, i + 1));
          start = i;
          break;
        }
      }
    }
  }
  return out;
}

export function stripTrailingMoveJson(rawText) {
  if (!rawText) return "";
  let s = String(rawText);
  const fenceIdx = s.indexOf("```");
  if (fenceIdx >= 0) {
    s = s.slice(0, fenceIdx);
  }
  const jsonStart = s.search(/\{\s*"(?:moves|car_coord|coord|summary)"/);
  if (jsonStart >= 0) {
    s = s.slice(0, jsonStart);
  }
  s = s.replace(/(?:^|\n)\s*\{[\s\S]*$/, "");
  s = s.replace(/\{\s*(?:"|\n|$)[\s\S]*$/, "");
  s = s.replace(/\n?\s*`{1,3}(?:json)?\s*$/i, "");
  return s.trim();
}

export function extractMovesBatch(contentText) {
  if (!contentText) return { moves: [], summary: "" };
  const text = String(contentText);
  const candidates = [];

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fm;
  while ((fm = fenceRegex.exec(text)) !== null) {
    candidates.push(...extractBalancedJsonObjects(fm[1]));
  }
  const allBalanced = extractBalancedJsonObjects(text);
  candidates.push(...allBalanced.reverse());

  for (const cand of candidates) {
    try {
      const obj = JSON.parse(cand);
      if (Array.isArray(obj?.moves) && obj.moves.length > 0) {
        const valid = obj.moves.map(sanitizeSingleMove).filter(Boolean).slice(0, 5);
        if (valid.length > 0) {
          return {
            moves: valid,
            summary: String(obj.summary || obj.reason || "").trim(),
          };
        }
      }
    } catch (_) {}
  }

  for (const cand of candidates) {
    try {
      const obj = JSON.parse(cand);
      const single = sanitizeSingleMove(obj);
      if (single) {
        return {
          moves: [single],
          summary: String(obj?.summary || obj?.reason || "").trim(),
        };
      }
    } catch (_) {}
  }

  return { moves: [], summary: "" };
}

export function extractMoveDecision(contentText) {
  const { moves, summary } = extractMovesBatch(contentText);
  if (!moves.length) return null;
  return { ...moves[0], summary };
}

function normalizeMovesArray(rawMoves) {
  if (Array.isArray(rawMoves)) {
    return rawMoves.map(sanitizeSingleMove).filter(Boolean).slice(0, 5);
  }
  const single = sanitizeSingleMove(rawMoves);
  return single ? [single] : [];
}

/**
 * Plans 1..5 moves on the 6x6 AI back board via the same-origin `/api/race/plan` server endpoint.
 * Streams incremental thought summaries to `onThinkingUpdate({ thinkingText, thoughtTokens, elapsedSec })`.
 */
export async function planAiRaceMoves({
  model = DEFAULT_HYDROGEN_MODEL,
  previousInteractionId = "",
  lap = 1,
  turn = 1,
  imageDataUrl = "",
  feedbackText = "",
  recentHistoryText = "",
  signal,
  onThinkingUpdate,
} = {}) {
  const selectedModel = MODEL_CATALOG.some((m) => m.id === model)
    ? model
    : DEFAULT_HYDROGEN_MODEL;

  if (!imageDataUrl) {
    throw new GeminiApiError("Missing 6x6 AI board PNG screenshot (`imageDataUrl`).", {
      status: 400,
    });
  }

  const tStart = typeof performance !== "undefined" ? performance.now() : Date.now();
  const payload = {
    model: selectedModel,
    previousInteractionId: String(previousInteractionId || ""),
    lap: Number(lap) || 1,
    turn: Number(turn) || 1,
    imageDataUrl: String(imageDataUrl),
    feedbackText: String(feedbackText || ""),
    recentHistoryText: String(recentHistoryText || ""),
    stream: true,
  };

  let res = null;
  try {
    res = await fetch(RACE_API_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "x-client-id": CLIENT_SESSION_ID,
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    console.error("[geminiApi] Network error reaching /api/race/plan:", err);
    throw new GeminiApiError(
      `Network error reaching Parking Bench Race API: ${String(err?.message || err || "fetch failed")}`,
      { status: 0 }
    );
  }

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errText = await res.text();
      const parsed = JSON.parse(errText);
      errMsg = parsed?.error || parsed?.message || errText || errMsg;
    } catch (_) {}
    throw new GeminiApiError(`Race AI API error (${res.status}): ${String(errMsg).slice(0, 280)}`, {
      status: res.status,
      isAuthError: res.status === 401 || res.status === 503,
    });
  }

  const contentType = String(res.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json") || !res.body) {
    const data = await res.json();
    if (data?.ok === false && data?.error) {
      throw new GeminiApiError(String(data.error), {
        status: Number(data.status) || 500,
        isAuthError: Number(data.status) === 401 || Number(data.status) === 503,
      });
    }
    const moves = normalizeMovesArray(data?.moves);
    const thinkingText = String(data?.thinkingText || data?.summary || "");
    if (thinkingText && typeof onThinkingUpdate === "function") {
      onThinkingUpdate({
        thinkingText,
        thoughtTokens: Number(data?.thoughtTokens) || 0,
        elapsedSec: Number(data?.durationSec) || 0,
      });
    }
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    return {
      interactionId: String(data?.interactionId || ""),
      model: String(data?.model || selectedModel),
      durationSec: Number(data?.durationSec) || +((now - tStart) / 1000).toFixed(2),
      thinkingText,
      moves,
      summary: String(data?.summary || ""),
      thoughtTokens: Number(data?.thoughtTokens) || 0,
      decisionTelemetry: data?.decisionTelemetry || null,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuf = "";
  let latestThinkingText = "";
  let latestThoughtTokens = 0;
  let finalResult = null;

  const handleSseLine = (rawLine) => {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) return;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === "[DONE]") return;

    let evt;
    try {
      evt = JSON.parse(dataStr);
    } catch (_) {
      return;
    }

    if (evt?.type === "thinking") {
      const nextText = stripTrailingMoveJson(evt.thinkingText || "");
      latestThoughtTokens = Number(evt.thoughtTokens) || latestThoughtTokens;
      if (nextText && nextText !== latestThinkingText) {
        latestThinkingText = nextText;
        if (typeof onThinkingUpdate === "function") {
          onThinkingUpdate({
            thinkingText: latestThinkingText,
            thoughtTokens: latestThoughtTokens,
            elapsedSec: Number(evt.elapsedSec) || 0,
          });
        }
      }
      return;
    }

    if (evt?.type === "result") {
      finalResult = evt;
      if (evt.thinkingText && evt.thinkingText !== latestThinkingText) {
        latestThinkingText = String(evt.thinkingText);
        if (typeof onThinkingUpdate === "function") {
          onThinkingUpdate({
            thinkingText: latestThinkingText,
            thoughtTokens: Number(evt.thoughtTokens) || latestThoughtTokens,
            elapsedSec: Number(evt.durationSec) || 0,
          });
        }
      }
      return;
    }

    if (evt?.type === "error" || evt?.ok === false) {
      throw new GeminiApiError(String(evt?.error || "Race AI stream failed."), {
        status: Number(evt?.status) || 500,
        isAuthError: Number(evt?.status) === 401 || Number(evt?.status) === 503,
      });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      sseBuf += decoder.decode();
      if (sseBuf.trim()) {
        for (const rem of sseBuf.split(/\r?\n/)) {
          handleSseLine(rem);
        }
      }
      break;
    }
    sseBuf += decoder.decode(value, { stream: true });
    const lines = sseBuf.split(/\r?\n/);
    sseBuf = lines.pop() || "";
    for (const line of lines) {
      handleSseLine(line);
    }
  }

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const durationSec =
    Number(finalResult?.durationSec) || +((now - tStart) / 1000).toFixed(2);
  const moves = normalizeMovesArray(finalResult?.moves);
  const summary = String(
    finalResult?.summary ||
      (moves[0] ? `${moves[0].car_coord} → ${moves[0].direction} ${moves[0].cells}` : "")
  );

  return {
    interactionId: String(finalResult?.interactionId || ""),
    model: String(finalResult?.model || selectedModel),
    durationSec,
    thinkingText: String(finalResult?.thinkingText || latestThinkingText || summary),
    moves,
    summary,
    thoughtTokens: Number(finalResult?.thoughtTokens ?? latestThoughtTokens) || 0,
    decisionTelemetry: finalResult?.decisionTelemetry || null,
  };
}

/**
 * Legacy single-turn wrapper preserved for backwards compatibility.
 */
export async function streamGeminiHydrogenTurn({
  model = DEFAULT_HYDROGEN_MODEL,
  previousInteractionId = "",
  lap = 1,
  turn = 1,
  imageDataUrl = "",
  feedbackText = "",
  recentHistoryText = "",
  signal,
  onThinkingUpdate = null,
} = {}) {
  const res = await planAiRaceMoves({
    model,
    previousInteractionId,
    lap,
    turn,
    imageDataUrl,
    feedbackText,
    recentHistoryText,
    signal,
    onThinkingUpdate,
  });
  return {
    ...res,
    turn,
    rawContent: res.summary,
    moveSpec: res.moves[0] || null,
    totalTokens: res.thoughtTokens,
  };
}
