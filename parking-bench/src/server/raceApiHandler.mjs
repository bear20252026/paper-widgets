/**
 * src/server/raceApiHandler.mjs — Server-Side Gemini 4 Hydrogen & Decisions API Handler
 * Project: Parking Bench · 6×6 Race
 *
 * Security & Pure-Vision Protocol Guarantees:
 *   1. Reads `process.env.GEMINI_API_KEY` strictly server-side (injected by AI Studio, zero browser exposure).
 *   2. Enforces per-client `x-client-id` session ownership with a FIFO-bounded Map (`MAX_OWNED_INTERACTIONS = 1000`)
 *      before attaching `previous_interaction_id` across turns.
 *   3. Enforces strict model allowlisting (`gemini-4-hydrogen`, `gemini-decision-1`), hardcoded
 *      `https://generativelanguage.googleapis.com` origins, `redirect: "error"`, header-only `x-goog-api-key`,
 *      and `2 MB` request body caps (`413` + `Connection: close` + deferred `req.destroy()`).
 *   4. Enforces `Origin` / `Sec-Fetch-Site` checks and bounded per-IP sliding-window + concurrency rate limits.
 *   5. Pure Vision Anti-Cheat: sends ONLY `pngBase64` + generic board rules + strictly sanitized own-move cell-count echoes.
 */

import { Buffer } from "node:buffer";

const INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DECISIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/decisions";

export const MAX_BODY_BYTES = 2 * 1024 * 1024;
export const MAX_BASE64_PNG_CHARS = 1_900_000;
const MAX_OWNED_INTERACTIONS = 1000;

const CLIENT_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const INTERACTION_ID_RE = /^v1_[a-zA-Z0-9_-]{8,160}$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const EXACT_SHOWCASE_HOST_RE =
  /^(?:[a-z0-9-]+-853813963450|ais-(?:dev|pre)-[a-z0-9-]+-73428471351)\.[a-z0-9-]+\.run\.app$/;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 60;
const RATE_MAX_CONCURRENT = 4;
const MAX_RATE_BUCKETS = 4096;
const rateBuckets = new Map();

function isCloudRunRuntime() {
  return (
    typeof process.env.K_SERVICE === "string" &&
    process.env.K_SERVICE.trim().length > 0
  );
}

export function isAllowedRequestOrigin(req) {
  const rawOrigin = req?.headers?.origin;
  const origin = typeof rawOrigin === "string" ? rawOrigin.trim() : "";
  const inCloudRun = isCloudRunRuntime();

  if (!origin) {
    const secFetchSite = String(
      req?.headers?.["sec-fetch-site"] || ""
    ).toLowerCase();
    return secFetchSite === "same-origin";
  }

  if (origin === "null") {
    return false;
  }

  try {
    const parsed = new URL(origin);
    if (inCloudRun && parsed.protocol !== "https:") {
      return false;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      !inCloudRun &&
      (hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.endsWith(".usercontent.goog"))
    ) {
      return true;
    }
    return (
      hostname === "aistudio.google.com" ||
      hostname === "ai.studio" ||
      hostname.endsWith(".ai.studio") ||
      EXACT_SHOWCASE_HOST_RE.test(hostname)
    );
  } catch {
    return false;
  }
}

function isInternalOrLoopbackIp(ip) {
  const clean = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean.startsWith("127.") ||
    clean.startsWith("10.") ||
    clean.startsWith("169.254.") ||
    clean.startsWith("192.168.") ||
    clean.startsWith("fe80:") ||
    clean.startsWith("fc") ||
    clean.startsWith("fd")
  ) {
    return true;
  }
  const m172 = clean.match(/^172\.(\d{1,3})\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function normalizeIpKey(rawIp) {
  const ip = String(rawIp || "").trim().toLowerCase();
  if (!ip) return "unknown";
  const v4Mapped = ip.startsWith("::ffff:") && ip.includes(".") ? ip.slice(7) : ip;
  if (!v4Mapped.includes(":")) {
    return v4Mapped;
  }
  const noZone = v4Mapped.split("%")[0];
  const parts = noZone.split("::");
  if (parts.length > 2) return noZone;
  const left = parts[0] ? parts[0].split(":").filter(Boolean) : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(":").filter(Boolean) : [];
  const fill = Math.max(0, 8 - (left.length + right.length));
  const full = [...left, ...Array(fill).fill("0000"), ...right].slice(0, 8);
  return `${full.slice(0, 4).map((h) => h.padStart(4, "0")).join(":")}::/64`;
}

export function extractClientIpKey(req) {
  const xff = req?.headers?.["x-forwarded-for"];
  const rawXff = Array.isArray(xff) ? xff.join(",") : typeof xff === "string" ? xff : "";
  if (rawXff) {
    const hops = rawXff
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    while (hops.length > 1 && isInternalOrLoopbackIp(hops[hops.length - 1])) {
      hops.pop();
    }
    if (hops.length > 0) {
      return normalizeIpKey(hops[hops.length - 1]);
    }
  }
  return normalizeIpKey(req?.socket?.remoteAddress || "unknown");
}

export function acquireRateLimitSlot(ipKey, now = Date.now()) {
  let bucket = rateBuckets.get(ipKey);
  if (!bucket) {
    if (rateBuckets.size >= MAX_RATE_BUCKETS) {
      const oldestKey = rateBuckets.keys().next().value;
      if (oldestKey !== undefined) rateBuckets.delete(oldestKey);
    }
    bucket = { timestamps: [], active: 0 };
    rateBuckets.set(ipKey, bucket);
  }

  const cutoff = now - RATE_WINDOW_MS;
  while (bucket.timestamps.length > 0 && bucket.timestamps[0] <= cutoff) {
    bucket.timestamps.shift();
  }

  if (
    bucket.active >= RATE_MAX_CONCURRENT ||
    bucket.timestamps.length >= RATE_MAX_REQUESTS
  ) {
    return null;
  }

  bucket.timestamps.push(now);
  bucket.active += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    bucket.active = Math.max(0, bucket.active - 1);
  };
}

export function resetRateLimitsForTest() {
  rateBuckets.clear();
}

const ALLOWED_MODELS = new Set([
  "gemini-4-hydrogen",
  "gemini-decision-1",
]);

function resolveModel(model) {
  const requested = String(model || "").trim() || "gemini-4-hydrogen";
  if (!ALLOWED_MODELS.has(requested)) {
    const err = new Error(
      `Unsupported model "${requested}". Allowed models: gemini-4-hydrogen, gemini-decision-1.`
    );
    err.status = 400;
    throw err;
  }
  return requested;
}

class BoundedOwnershipMap {
  constructor(maxEntries = MAX_OWNED_INTERACTIONS) {
    this.maxEntries = maxEntries;
    this.store = new Map();
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, value);
  }
}

const interactionOwners = new BoundedOwnershipMap(MAX_OWNED_INTERACTIONS);

export function redactSecrets(input) {
  return String(input || "")
    .replace(/AIza[0-9A-Za-z_-]+/g, "[REDACTED_KEY]")
    .replace(/AQ\.[0-9A-Za-z._-]+/g, "[REDACTED_KEY]")
    .replace(/ya29\.[0-9A-Za-z._-]+/g, "[REDACTED_TOKEN]");
}

function toSafeError(err) {
  const msg = redactSecrets(err instanceof Error ? err.message : String(err || "Unknown error"));
  const safe = new Error(msg);
  if (err && typeof err === "object" && "status" in err) {
    safe.status = err.status;
  }
  return safe;
}

export function resolveServerGeminiKey(envRecord = {}) {
  const candidates = [
    envRecord?.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY,
  ];
  for (const raw of candidates) {
    const trimmed = String(raw || "").trim();
    if (trimmed && trimmed !== "MY_GEMINI_API_KEY") {
      return trimmed;
    }
  }
  return "";
}

const SYSTEM_INSTRUCTION_6X6 = [
  "You are an elite visual spatial puzzle racer playing Parking Bench on a physical 6x6 wooden-and-slate sliding-car board.",
  "You receive ONLY a live 4:3 PNG screenshot of your 6x6 board (zero tools, zero grid JSON).",
  "",
  "6x6 BOARD GEOMETRY & COORDINATE RAILS:",
  "- Columns A..F run West-to-East (left to right along the top and bottom laser-etched beechwood rails).",
  "- Rows 1..6 run North-to-South (top to bottom along the left and right laser-etched beechwood rails).",
  "- GOAL: Slide the bright red 2-stall horizontal sports coupe on Row 3 RIGHT out the open East barrier gate at F3.",
  "- LEGAL SLIDES:",
  "  * Horizontal vehicles (pointing left-right along a row) ONLY slide LEFT or RIGHT (cells: 1..5) through empty dark-slate stalls.",
  "  * Vertical vehicles (pointing up-down along a column) ONLY slide UP (toward Row 1) or DOWN (toward Row 6) (cells: 1..4) through empty dark-slate stalls.",
  "- NAMING A VEHICLE: Set `car_coord` to ANY stall (A1..F6) occupied by that vehicle at the start of that move (accounting for any earlier moves in your batch).",
  "",
  "FAST MULTI-MOVE BATCH STRATEGY (1 TO 5 MOVES AT ONCE):",
  "- Skip cataloging unrelated perimeter vehicles — trace ONLY vehicles blocking Row 3 east of the red coupe so you respond as fast as possible!",
  "- Plan 1 to 5 legal moves in sequence to clear Row 3 east of the red coupe and exit as fast as possible.",
  "- CRITICAL EXIT RULE: Whenever your planned moves clear Row 3 east of the red coupe to F3 (or if Row 3 is already clear), ALWAYS include the final red coupe exit move (`{\"car_coord\":\"<red_coupe_stall_on_row_3>\",\"direction\":\"RIGHT\",\"cells\":5}`) at the end of your `moves` array so it exits F3 immediately!",
  "- Never repeat a move that just bumped (0 stalls moved).",
  "- Stream a concise, readable 4 to 6 bullet visual thinking trace on separate lines (do NOT use `{` or `}` inside bullets):",
  "  • Row 3 scan: locate the red coupe on Row 3 and identify each vehicle blocking stalls east to F3.",
  "  • Blocker clearance: check open dark-slate stalls above/below/beside each blocker (and any secondary blocker).",
  "  • Corridor path: trace how each slide opens Row 3 through F3 without collisions.",
  "  • Move sequence: list your 1 to 5 legal slides in order, ending with the red coupe sliding RIGHT out F3 whenever Row 3 clears.",
  "- On a new final line after the bullets, output ONLY this JSON object (no markdown code fences):",
  "  {\"moves\":[{\"car_coord\":\"D2\",\"direction\":\"UP\",\"cells\":1},{\"car_coord\":\"B3\",\"direction\":\"RIGHT\",\"cells\":5}],\"summary\":\"Clear D3 blocker and exit red coupe.\"}",
].join("\n");

export function extractBase64Png(imageDataUrl = "", pngBase64 = "") {
  const candidate =
    pngBase64 && typeof pngBase64 === "string"
      ? pngBase64
      : typeof imageDataUrl === "string"
        ? imageDataUrl
        : "";
  const trimmed = candidate.trim();
  if (!trimmed) {
    return "";
  }
  if (/^data:/i.test(trimmed) && !/^data:image\/png;base64,/i.test(trimmed)) {
    return "";
  }

  const clean = trimmed
    .replace(/^data:image\/png;base64,/i, "")
    .replace(/\s+/g, "");
  if (
    clean.length < 64 ||
    clean.length > MAX_BASE64_PNG_CHARS ||
    clean.length % 4 !== 0 ||
    !BASE64_RE.test(clean)
  ) {
    return "";
  }

  const header = Buffer.from(clean.slice(0, 32), "base64");
  if (header.length < 24) {
    return "";
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (header[i] !== PNG_SIGNATURE[i]) {
      return "";
    }
  }
  if (header.toString("ascii", 12, 16) !== "IHDR") {
    return "";
  }
  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);
  if (width < 32 || width > 4096 || height < 32 || height > 4096) {
    return "";
  }
  return clean;
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
  const car_coord = normalizeCoord(rawMove.car_coord || rawMove.coord || rawMove.cell || rawMove.stall || "");
  const direction = normalizeDirection(rawMove.direction || rawMove.dir || rawMove.action || rawMove.move || "");
  if (!car_coord || !direction) return null;
  const rawCells = rawMove.cells ?? rawMove.steps ?? rawMove.distance ?? 1;
  const cells = Math.max(1, Math.min(5, Math.round(Number(rawCells) || 1)));
  const isRow3Right = car_coord.endsWith("3") && direction === "RIGHT" && (cells >= 4 || Boolean(rawMove.isExit));
  return {
    car_coord,
    direction,
    cells: isRow3Right ? Math.max(cells, 5) : cells,
    isExit: isRow3Right,
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
  if (fenceIdx >= 0) s = s.slice(0, fenceIdx);
  const jsonStart = s.search(/\{\s*"(?:moves|car_coord|coord|summary)"/);
  if (jsonStart >= 0) s = s.slice(0, jsonStart);
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
        const validMoves = obj.moves.map(sanitizeSingleMove).filter(Boolean).slice(0, 5);
        if (validMoves.length > 0) {
          return {
            moves: validMoves,
            summary: String(obj.summary || obj.reason || "").trim(),
          };
        }
      }
    } catch (_) {}
  }

  for (const cand of candidates) {
    try {
      const obj = JSON.parse(cand);
      const legacySingle = sanitizeSingleMove(obj);
      if (legacySingle) {
        return {
          moves: [legacySingle],
          summary: String(obj?.summary || obj?.reason || "").trim(),
        };
      }
    } catch (_) {}
  }
  return { moves: [], summary: "" };
}

export function sanitizeMoveEchoText(rawText = "") {
  if (!rawText) return "";
  const s = String(rawText);
  const entryRe =
    /([A-F][1-6])\s*(?:->|→)?\s*(UP|DOWN|LEFT|RIGHT)\s+([1-5])(?:\s*(?:->|→|:|\()\s*(moved\s+([0-5])\s+cells?|bumped|blocked|empty\s+cell|empty_coord|axis\s+mismatch|axis_mismatch|exited))?/gi;
  const sanitized = [];
  let m;
  while ((m = entryRe.exec(s)) !== null) {
    const coord = m[1].toUpperCase();
    const dir = m[2].toUpperCase();
    const cells = m[3];
    const rawOutcome = (m[4] || "").toLowerCase().trim();
    if (!rawOutcome) {
      sanitized.push(`${coord} ${dir} ${cells}`);
    } else if (rawOutcome.startsWith("moved")) {
      const n = Number(m[5] ?? 0);
      sanitized.push(
        n === 0
          ? `${coord} ${dir} ${cells} -> bumped (0 cells moved)`
          : `${coord} ${dir} ${cells} -> moved ${n} ${n === 1 ? "cell" : "cells"}`
      );
    } else if (rawOutcome === "bumped" || rawOutcome === "blocked") {
      sanitized.push(`${coord} ${dir} ${cells} -> bumped (0 cells moved)`);
    } else if (rawOutcome === "empty cell" || rawOutcome === "empty_coord") {
      sanitized.push(`${coord} ${dir} ${cells} -> empty cell`);
    } else if (rawOutcome === "axis mismatch" || rawOutcome === "axis_mismatch") {
      sanitized.push(`${coord} ${dir} ${cells} -> axis mismatch`);
    } else if (rawOutcome === "exited") {
      sanitized.push(`${coord} ${dir} ${cells} -> exited`);
    }
    if (sanitized.length >= 12) break;
  }
  return sanitized.join("; ");
}

function buildInteractionsPrompt({ lap = 1, turn = 1, feedbackText = "", recentHistoryText = "" }) {
  const safeLap = Math.max(1, Math.min(5, Math.round(Number(lap) || 1)));
  const safeTurn = Math.max(1, Math.min(50, Math.round(Number(turn) || 1)));
  const safeFeedback = sanitizeMoveEchoText(feedbackText);
  const safeHistory = sanitizeMoveEchoText(recentHistoryText);
  const lines = [
    `Lap ${safeLap}/5 · Turn ${safeTurn}: Inspect your live 6x6 board PNG (Columns A..F West-to-East, Rows 1..6 North-to-South, red sports coupe horizontal on Row 3 exiting right at F3).`,
  ];
  if (safeFeedback) lines.push(`Previous move attempt outcome: ${safeFeedback}`);
  if (safeHistory) lines.push(`Moves already attempted on this lap: ${safeHistory}`);
  lines.push(
    "Plan 1 to 5 legal moves at once to unblock Row 3 and slide the red coupe RIGHT out F3 as fast as possible (ALWAYS append the red coupe RIGHT cells:5 move at the end of `moves` if your sequence clears Row 3!). First write a concise 4 to 6 bullet visual thinking trace (`• Row 3 scan: ...`, `• Blocker clearance: ...`, `• Move sequence: ...`), then on a new final line output ONLY JSON:",
    '{"moves":[{"car_coord":"D2","direction":"UP","cells":1},{"car_coord":"B3","direction":"RIGHT","cells":5}],"summary":"..."}'
  );
  return lines.join("\n\n");
}

async function runInteractionsTurn({
  apiKey,
  clientId,
  model,
  previousInteractionId = "",
  lap = 1,
  turn = 1,
  pngBase64,
  feedbackText = "",
  recentHistoryText = "",
  onThinkingUpdate = null,
}) {
  const tStart = Date.now();
  const turnPrompt = buildInteractionsPrompt({ lap, turn, feedbackText, recentHistoryText });
  const generationConfig = {
    thinking_level: "low",
    thinking_summaries: "auto",
    max_output_tokens: 4096,
  };

  // Only forward previous_interaction_id when validated AND owned by this clientId
  let verifiedPrevId = "";
  const candidatePrev = String(previousInteractionId || "").trim();
  if (
    candidatePrev &&
    INTERACTION_ID_RE.test(candidatePrev) &&
    interactionOwners.get(candidatePrev) === clientId
  ) {
    verifiedPrevId = candidatePrev;
  }

  async function openUpstream(prevId) {
    const payload = {
      model,
      system_instruction: SYSTEM_INSTRUCTION_6X6,
      stream: true,
      generation_config: generationConfig,
      input: [
        {
          type: "user_input",
          content: [
            { type: "image", mime_type: "image/png", data: pngBase64 },
            { type: "text", text: turnPrompt },
          ],
        },
      ],
    };
    if (prevId) {
      payload.previous_interaction_id = prevId;
    }
    return fetch(INTERACTIONS_ENDPOINT, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
  }

  let res = await openUpstream(verifiedPrevId);
  if (!res.ok && verifiedPrevId && (res.status === 400 || res.status === 404)) {
    res = await openUpstream("");
  }
  if (!res.ok) {
    const errTxt = redactSecrets(await res.text());
    const err = new Error(`Upstream Interactions API (${res.status}): ${errTxt.slice(0, 360)}`);
    err.status = res.status;
    throw err;
  }
  if (!res.body) throw new Error("Upstream Interactions API returned empty stream body.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuf = "";
  let interactionId = "";
  let thoughtSummaryText = "";
  let outputText = "";
  let thoughtTokens = 0;
  let totalTokens = 0;
  let lastEmittedText = "";
  let thoughtStepCount = 0;

  const buildCombinedThinkingTrace = () => {
    const primary = thoughtSummaryText.trim();
    const prose = stripTrailingMoveJson(outputText);
    if (primary && prose && primary !== prose) {
      return `${primary}\n\n${prose}`;
    }
    return primary || prose;
  };

  const emitProgress = () => {
    const activeThoughts = buildCombinedThinkingTrace();
    if (activeThoughts && activeThoughts !== lastEmittedText) {
      lastEmittedText = activeThoughts;
      if (typeof onThinkingUpdate === "function") {
        onThinkingUpdate({
          thinkingText: activeThoughts,
          thoughtTokens,
          elapsedSec: +((Date.now() - tStart) / 1000).toFixed(2),
        });
      }
    }
  };

  const handleLine = (rawLine) => {
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

    const evtType = evt?.event_type || evt?.type || "";
    if (evtType === "interaction.created" || evtType === "interaction.status_update") {
      const id = evt?.interaction?.id || evt?.interaction_id || "";
      if (id && INTERACTION_ID_RE.test(id)) {
        interactionId = id;
        interactionOwners.set(id, clientId);
      }
      return;
    }
    if (evtType === "step.start") {
      if (evt?.step?.type === "thought") {
        if (thoughtStepCount > 0 && thoughtSummaryText && !thoughtSummaryText.endsWith("\n\n")) {
          thoughtSummaryText += "\n\n";
        }
        thoughtStepCount++;
      }
      return;
    }
    if (evtType === "step.delta") {
      const delta = evt?.delta;
      if (!delta) return;
      if (delta.type === "thought_summary") {
        const chunk =
          typeof delta.content?.text === "string"
            ? delta.content.text
            : typeof delta.text === "string"
              ? delta.text
              : "";
        if (chunk) {
          thoughtSummaryText += chunk;
          emitProgress();
        }
        return;
      }
      if (delta.type === "text") {
        const chunk =
          typeof delta.text === "string"
            ? delta.text
            : typeof delta.content?.text === "string"
              ? delta.content.text
              : "";
        if (chunk) {
          outputText += chunk;
          emitProgress();
        }
      }
      return;
    }
    if (evtType === "interaction.completed") {
      const id = evt?.interaction?.id || "";
      if (id && INTERACTION_ID_RE.test(id)) {
        interactionId = id;
        interactionOwners.set(id, clientId);
      }
      const usage = evt?.interaction?.usage;
      if (usage) {
        thoughtTokens = Number(usage.total_thought_tokens) || thoughtTokens;
        totalTokens = Number(usage.total_tokens) || totalTokens;
      }
      const steps = Array.isArray(evt?.interaction?.steps)
        ? evt.interaction.steps
        : Array.isArray(evt?.interaction?.outputs)
          ? evt.interaction.outputs
          : [];
      if (!thoughtSummaryText.trim() && steps.length > 0) {
        const summaries = [];
        for (const st of steps) {
          if (st?.type === "thought" && Array.isArray(st.summary)) {
            for (const item of st.summary) if (item?.text) summaries.push(item.text);
          } else if (st?.type === "thought_summary" && st?.content?.text) {
            summaries.push(st.content.text);
          }
        }
        if (summaries.length > 0) thoughtSummaryText = summaries.join("\n\n");
      }
      if (!outputText.trim() && steps.length > 0) {
        const texts = [];
        for (const st of steps) {
          if (st?.type === "text" && st?.text) texts.push(st.text);
          else if (st?.type === "model_output" && Array.isArray(st.content)) {
            for (const c of st.content) if (c?.type === "text" && c?.text) texts.push(c.text);
          }
        }
        if (texts.length > 0) outputText = texts.join("");
      }
      emitProgress();
      return;
    }
    if (evtType === "error" || evtType === "interaction.failed") {
      throw new Error(
        redactSecrets(evt?.error?.message || evt?.interaction?.error?.message || "Upstream stream error.")
      );
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      sseBuf += decoder.decode();
      if (sseBuf.trim()) for (const rem of sseBuf.split(/\r?\n/)) handleLine(rem);
      break;
    }
    sseBuf += decoder.decode(value, { stream: true });
    const lines = sseBuf.split(/\r?\n/);
    sseBuf = lines.pop() || "";
    for (const line of lines) handleLine(line);
  }

  const durationSec = +((Date.now() - tStart) / 1000).toFixed(2);
  const { moves, summary } = extractMovesBatch(outputText);
  const prosePlan = stripTrailingMoveJson(outputText);
  const thinkingText =
    (thoughtSummaryText.trim() && prosePlan && thoughtSummaryText.trim() !== prosePlan
      ? `${thoughtSummaryText.trim()}\n\n${prosePlan}`
      : thoughtSummaryText.trim() || prosePlan) ||
    summary ||
    "Evaluated 6x6 board visually.";

  return {
    interactionId,
    model,
    durationSec,
    thinkingText,
    moves,
    summary: summary || (moves[0] ? `${moves[0].car_coord} → ${moves[0].direction} ${moves[0].cells}` : ""),
    thoughtTokens,
    totalTokens,
    decisionTelemetry: null,
    generationConfigUsed: { thinking_level: "low" },
  };
}

const ACTION_CRITERIA = {
  UP_1: "Slide vertical vehicle UP (north toward Row 1) by 1 stall.",
  UP_2: "Slide vertical vehicle UP (north toward Row 1) by 2 stalls.",
  UP_3: "Slide vertical vehicle UP (north toward Row 1) by 3 stalls.",
  UP_4: "Slide vertical vehicle UP (north toward Row 1) by 4 stalls.",
  DOWN_1: "Slide vertical vehicle DOWN (south toward Row 6) by 1 stall.",
  DOWN_2: "Slide vertical vehicle DOWN (south toward Row 6) by 2 stalls.",
  DOWN_3: "Slide vertical vehicle DOWN (south toward Row 6) by 3 stalls.",
  DOWN_4: "Slide vertical vehicle DOWN (south toward Row 6) by 4 stalls.",
  LEFT_1: "Slide horizontal vehicle LEFT (west toward Col A) by 1 stall.",
  LEFT_2: "Slide horizontal vehicle LEFT (west toward Col A) by 2 stalls.",
  LEFT_3: "Slide horizontal vehicle LEFT (west toward Col A) by 3 stalls.",
  LEFT_4: "Slide horizontal vehicle LEFT (west toward Col A) by 4 stalls.",
  RIGHT_1: "Slide horizontal vehicle RIGHT (east toward Col F) by 1 stall.",
  RIGHT_2: "Slide horizontal vehicle RIGHT (east toward Col F) by 2 stalls.",
  RIGHT_3: "Slide horizontal vehicle RIGHT (east toward Col F) by 3 stalls.",
  RIGHT_4: "Slide horizontal vehicle RIGHT (east toward Col F / exit F3) by 4+ stalls.",
};

const COL_CRITERIA = {
  A: "Column A (1st column from left / West).",
  B: "Column B (2nd column from left).",
  C: "Column C (3rd column from left).",
  D: "Column D (4th column from left).",
  E: "Column E (5th column from left).",
  F: "Column F (6th / right-most East column with exit gate at F3).",
};

const ROW_CRITERIA = {
  "1": "Row 1 (top / North-most row).",
  "2": "Row 2 (2nd row from top).",
  "3": "Row 3 (exit corridor row containing the red sports coupe and East gate F3).",
  "4": "Row 4 (4th row from top).",
  "5": "Row 5 (5th row from top).",
  "6": "Row 6 (bottom / South-most row).",
};

function parseActionToken(actionKey) {
  const m = String(actionKey || "").trim().toUpperCase().match(/^(UP|DOWN|LEFT|RIGHT)_([1-4])$/);
  if (!m) return { direction: "UP", cells: 1 };
  return { direction: m[1], cells: parseInt(m[2], 10) };
}

function parseBlockedMovesFromFeedback(feedbackText = "", recentHistoryText = "") {
  const blocked = new Set();
  const combined = `${sanitizeMoveEchoText(feedbackText)}\n${sanitizeMoveEchoText(recentHistoryText)}`;
  const bumpRe =
    /([A-F][1-6])\s+(UP|DOWN|LEFT|RIGHT)\s+\d+\s*->\s*(?:bumped|axis mismatch)/gi;
  let m;
  while ((m = bumpRe.exec(combined)) !== null) {
    blocked.add(`${m[1].toUpperCase()}_${m[2].toUpperCase()}`);
  }
  const emptyRe = /([A-F][1-6])\s+(?:UP|DOWN|LEFT|RIGHT)\s+\d+\s*->\s*empty cell/gi;
  while ((m = emptyRe.exec(combined)) !== null) {
    blocked.add(`EMPTY_${m[1].toUpperCase()}`);
  }
  return blocked;
}

function pickRunnerUpKey(probabilities, excludeKey) {
  if (!probabilities || typeof probabilities !== "object") return excludeKey;
  const sorted = Object.entries(probabilities)
    .filter(([k]) => k !== excludeKey)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  return sorted[0]?.[0] || excludeKey;
}

export function synthesizeDecisionMoves(answers = {}, usage = {}, feedbackText = "", recentHistoryText = "") {
  const isClearAns = answers.is_exit_clear || {};
  const pExit = Number(isClearAns.noul ?? 0);
  const confExit = Number(isClearAns.confidence ?? Math.max(pExit, 1 - pExit));

  const redColAns = answers.red_coupe_col || {};
  const redCol = String(redColAns.choice || "B").trim().toUpperCase();
  const confRed = Number(redColAns.confidence ?? 0);

  const m1ColAns = answers.m1_col || {};
  const m1RowAns = answers.m1_row || {};
  const m1ActAns = answers.m1_action || {};

  const m2ColAns = answers.m2_col || {};
  const m2RowAns = answers.m2_row || {};
  const m2ActAns = answers.m2_action || {};

  const blockedSet = parseBlockedMovesFromFeedback(feedbackText, recentHistoryText);

  let m1Col = String(m1ColAns.choice || "D").toUpperCase();
  let m1Row = String(m1RowAns.choice || "3");
  let m1ActKey = String(m1ActAns.choice || "UP_1").toUpperCase();
  let m1Coord = `${m1Col}${m1Row}`;
  let m1Parsed = parseActionToken(m1ActKey);

  if (blockedSet.has(`EMPTY_${m1Coord}`)) {
    m1Col = pickRunnerUpKey(m1ColAns.probabilities, m1Col);
    m1Coord = `${m1Col}${m1Row}`;
  }
  if (blockedSet.has(`${m1Coord}_${m1Parsed.direction}`)) {
    const altAct = pickRunnerUpKey(m1ActAns.probabilities, m1ActKey);
    const altParsed = parseActionToken(altAct);
    if (!blockedSet.has(`${m1Coord}_${altParsed.direction}`) && Number(m1ActAns.probabilities?.[altAct] || 0) >= 0.12) {
      m1ActKey = altAct;
      m1Parsed = altParsed;
    } else {
      m1Col = pickRunnerUpKey(m1ColAns.probabilities, m1Col);
      m1Coord = `${m1Col}${m1Row}`;
    }
  }

  const m1Conf = +(
    (Number(m1ColAns.confidence || 0.5) +
      Number(m1RowAns.confidence || 0.5) +
      Number(m1ActAns.confidence || 0.5)) /
    3
  ).toFixed(2);

  const m2Col = String(m2ColAns.choice || "B").toUpperCase();
  const m2Row = String(m2RowAns.choice || "3");
  const m2ActKey = String(m2ActAns.choice || "RIGHT_4").toUpperCase();
  const m2Coord = `${m2Col}${m2Row}`;
  const m2Parsed = parseActionToken(m2ActKey);
  const m2Conf = +(
    (Number(m2ColAns.confidence || 0.5) +
      Number(m2RowAns.confidence || 0.5) +
      Number(m2ActAns.confidence || 0.5)) /
    3
  ).toFixed(2);

  const moves = [];
  const lines = [
    "Decisions API (0 output tokens)",
    `• P(Row 3 exit clear) = ${pExit.toFixed(2)} (conf ${confExit.toFixed(2)}) · Red coupe @ ${redCol}3 (conf ${confRed.toFixed(2)})`,
  ];

  if (pExit > 0.65) {
    moves.push({
      car_coord: `${redCol}3`,
      direction: "RIGHT",
      cells: 5,
      isExit: true,
    });
    lines.push(`• Exit Trigger: ${redCol}3 → RIGHT 5 out F3 (P=${pExit.toFixed(2)} > 0.65)`);
  } else {
    const m1IsExit = m1Coord === `${redCol}3` && m1Parsed.direction === "RIGHT" && m1Parsed.cells >= 3;
    const move1 = {
      car_coord: m1Coord,
      direction: m1Parsed.direction,
      cells: m1IsExit ? 5 : m1Parsed.cells,
      isExit: m1IsExit,
    };
    moves.push(move1);
    lines.push(`• Move 1: ${move1.car_coord} → ${move1.direction} ${move1.cells} (conf ${m1Conf.toFixed(2)})`);

    const isDistinctMove2 =
      !(m2Coord === move1.car_coord && m2Parsed.direction === move1.direction) &&
      !blockedSet.has(`EMPTY_${m2Coord}`) &&
      !blockedSet.has(`${m2Coord}_${m2Parsed.direction}`);

    if (isDistinctMove2 && !m1IsExit && m2Conf >= 0.34) {
      const m2IsExit = m2Coord === `${redCol}3` && m2Parsed.direction === "RIGHT" && m2Parsed.cells >= 3;
      const move2 = {
        car_coord: m2Coord,
        direction: m2Parsed.direction,
        cells: m2IsExit ? 5 : m2Parsed.cells,
        isExit: m2IsExit,
      };
      moves.push(move2);
      lines.push(`• Move 2: ${move2.car_coord} → ${move2.direction} ${move2.cells} (conf ${m2Conf.toFixed(2)})`);
    }
  }

  const summary = moves.map((m) => `${m.car_coord} ${m.direction} ${m.cells}`).join(" · ");

  return {
    moves,
    summary,
    thinkingText: lines.join("\n"),
    decisionTelemetry: {
      zeroOutputTokens: true,
      totalInputTokens: Number(usage?.total_input_tokens || 0),
      totalOutputTokens: Number(usage?.total_output_tokens ?? 0),
      isExitClearProb: +pExit.toFixed(4),
      isExitClearConf: +confExit.toFixed(4),
      redCoupeCol: redCol,
      redCoupeConf: +confRed.toFixed(4),
      move1Conf: m1Conf,
      move2Conf: m2Conf,
    },
  };
}

async function runDecisionsTurn({
  apiKey,
  lap = 1,
  turn = 1,
  pngBase64,
  feedbackText = "",
  recentHistoryText = "",
  onThinkingUpdate = null,
}) {
  const tStart = Date.now();
  const safeLap = Math.max(1, Math.min(5, Math.round(Number(lap) || 1)));
  const safeTurn = Math.max(1, Math.min(50, Math.round(Number(turn) || 1)));
  const safeFeedback = sanitizeMoveEchoText(feedbackText);
  const safeHistory = sanitizeMoveEchoText(recentHistoryText);
  const contextLines = [
    `Parking Bench 6x6 sliding-car board — Lap ${safeLap}/5, Turn ${safeTurn}.`,
    "Coordinate system: Columns A..F run West-to-East (left to right on top/bottom wooden rails); Rows 1..6 run North-to-South (top to bottom on left/right wooden rails).",
    "Goal: Clear any vehicles blocking Row 3 to the right (east) of the 2-stall bright red horizontal sports coupe so the red coupe can slide RIGHT out the open East barrier gate at F3.",
    "Physical rules: Horizontal cars only slide LEFT or RIGHT into empty dark-slate stalls. Vertical cars only slide UP (toward Row 1) or DOWN (toward Row 6) into empty dark-slate stalls.",
  ];
  if (safeFeedback) {
    contextLines.push(
      `IMPORTANT — Previous move attempt outcome (do NOT repeat any move that bumped or hit an empty cell): ${safeFeedback}`
    );
  }
  if (safeHistory) {
    contextLines.push(`Recent move attempts on this lap: ${safeHistory}`);
  }
  const contextText = contextLines.join("\n");

  const m1Anchor =
    "Identify Move 1 — among vehicles blocking Row 3 (or blocking a Row 3 blocker) that can legally slide RIGHT NOW into empty dark-slate stalls without hitting the wooden frame or another car (and never repeating a bumped move), pick the single movable vehicle in the RIGHT-MOST column (closest to Column F; if tied, top-most row).";
  const m2Anchor =
    "Identify Move 2 — pick the NEXT legal vehicle slide immediately AFTER Move 1 (choose a DIFFERENT movable blocker in the next right-most column to free Row 3, or slide the red coupe on Row 3 RIGHT_4 out F3 if Move 1 clears Row 3).";

  const payload = {
    model: "gemini-decision-1",
    input: [
      { type: "image", mime_type: "image/png", data: pngBase64 },
      { type: "text", text: contextText },
    ],
    questions: {
      is_exit_clear: {
        type: "noul",
        instructions:
          "Look across Row 3 to the right (east) of the bright red horizontal sports coupe all the way to the East exit gate at F3. Are ALL stalls on Row 3 east of the red coupe completely empty of other vehicles right now?",
        criteria: {
          true_description:
            "Every stall on Row 3 east of the red sports coupe through F3 is empty dark slate with zero blocking cars.",
          false_description:
            "At least one vehicle occupies a stall on Row 3 east of the red sports coupe, blocking its path to F3.",
        },
      },
      red_coupe_col: {
        type: "choice",
        instructions:
          "On Row 3 of this 6x6 board (Columns A..F left-to-right), which column is the LEFT-MOST stall currently occupied by the 2-cell bright red horizontal sports coupe?",
        criteria: {
          A: "Red coupe spans A3-B3 (left-most column A).",
          B: "Red coupe spans B3-C3 (left-most column B).",
          C: "Red coupe spans C3-D3 (left-most column C).",
          D: "Red coupe spans D3-E3 (left-most column D).",
          E: "Red coupe spans E3-F3 (left-most column E).",
        },
      },
      m1_col: {
        type: "choice",
        instructions: `${m1Anchor} Which column (A..F, left to right) contains the vehicle to slide in Move 1?`,
        criteria: COL_CRITERIA,
      },
      m1_row: {
        type: "choice",
        instructions: `${m1Anchor} Which row (1..6, top to bottom) is an occupied stall of the vehicle to slide in Move 1?`,
        criteria: ROW_CRITERIA,
      },
      m1_action: {
        type: "choice",
        instructions: `${m1Anchor} Which direction and stall count should that Move 1 vehicle slide (UP/DOWN for vertical cars, LEFT/RIGHT for horizontal cars)?`,
        criteria: ACTION_CRITERIA,
      },
      m2_col: {
        type: "choice",
        instructions: `${m2Anchor} Which column (A..F, left to right) contains the vehicle to slide in Move 2?`,
        criteria: COL_CRITERIA,
      },
      m2_row: {
        type: "choice",
        instructions: `${m2Anchor} Which row (1..6, top to bottom) is an occupied stall of the vehicle to slide in Move 2?`,
        criteria: ROW_CRITERIA,
      },
      m2_action: {
        type: "choice",
        instructions: `${m2Anchor} Which direction and stall count should that Move 2 vehicle slide?`,
        criteria: ACTION_CRITERIA,
      },
    },
  };

  const res = await fetch(DECISIONS_ENDPOINT, {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errTxt = redactSecrets(await res.text());
    const err = new Error(`Upstream Decisions API (${res.status}): ${errTxt.slice(0, 360)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const durationSec = +((Date.now() - tStart) / 1000).toFixed(2);
  const synth = synthesizeDecisionMoves(data?.answers || {}, data?.usage || {}, feedbackText, recentHistoryText);

  if (typeof onThinkingUpdate === "function") {
    onThinkingUpdate({
      thinkingText: synth.thinkingText,
      thoughtTokens: 0,
      elapsedSec: durationSec,
    });
  }

  return {
    interactionId: "",
    model: "gemini-decision-1",
    durationSec,
    thinkingText: synth.thinkingText,
    moves: synth.moves,
    summary: synth.summary,
    thoughtTokens: 0,
    totalTokens: Number(data?.usage?.total_tokens || 0),
    decisionTelemetry: synth.decisionTelemetry,
  };
}

export async function runRacePlanTurn({
  apiKey,
  clientId,
  model = "gemini-4-hydrogen",
  previousInteractionId = "",
  lap = 1,
  turn = 1,
  imageDataUrl = "",
  pngBase64 = "",
  feedbackText = "",
  recentHistoryText = "",
  onThinkingUpdate = null,
}) {
  const cleanKey = String(apiKey || "").trim();
  if (!cleanKey) {
    const err = new Error(
      "GEMINI_API_KEY is not configured. Add GEMINI_API_KEY in AI Studio Settings > Secrets."
    );
    err.status = 401;
    throw err;
  }

  const requestedModel = String(model || "").trim() || "gemini-4-hydrogen";
  if (!ALLOWED_MODELS.has(requestedModel)) {
    const err = new Error(
      `Unsupported model "${requestedModel}". Allowed models: gemini-4-hydrogen, gemini-decision-1.`
    );
    err.status = 400;
    throw err;
  }

  const cleanPng = extractBase64Png(imageDataUrl, pngBase64);
  if (!cleanPng) {
    const err = new Error("Missing or oversized 6x6 board PNG base64 data.");
    err.status = 400;
    throw err;
  }

  if (requestedModel === "gemini-decision-1") {
    return runDecisionsTurn({
      apiKey: cleanKey,
      lap,
      turn,
      pngBase64: cleanPng,
      feedbackText: String(feedbackText || ""),
      recentHistoryText: String(recentHistoryText || ""),
      onThinkingUpdate,
    });
  }

  return runInteractionsTurn({
    apiKey: cleanKey,
    clientId,
    model: requestedModel,
    previousInteractionId: String(previousInteractionId || ""),
    lap,
    turn,
    pngBase64: cleanPng,
    feedbackText: String(feedbackText || ""),
    recentHistoryText: String(recentHistoryText || ""),
    onThinkingUpdate,
  });
}

function readJsonBodyBounded(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const rawLen = Number(req?.headers?.["content-length"] || 0);
    if (Number.isFinite(rawLen) && rawLen > maxBytes) {
      req.pause?.();
      const err = new Error("PAYLOAD_TOO_LARGE");
      err.status = 413;
      reject(err);
      return;
    }

    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    req.on("data", (chunk) => {
      if (settled) return;
      const buf = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        settled = true;
        req.pause?.();
        const err = new Error("PAYLOAD_TOO_LARGE");
        err.status = 413;
        reject(err);
        return;
      }
      chunks.push(buf);
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed = raw.trim() ? JSON.parse(raw) : {};
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          const err = new Error("JSON body must be an object.");
          err.status = 400;
          reject(err);
          return;
        }
        resolve(parsed);
      } catch (_) {
        const err = new Error("Invalid JSON request body.");
        err.status = 400;
        reject(err);
      }
    });

    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const safeStatus = status === 403 ? 401 : status;
  res.writeHead(safeStatus, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

/**
 * Handles `/api/health` and `/api/race/plan`. Returns `true` if handled, `false` to pass to static/Vite middleware.
 */
export async function handleRaceApiRequest(req, res, envRecord = {}) {
  const rawUrl = String(req.url || "/");
  const pathname = rawUrl.split("?")[0];

  if (pathname === "/api/health") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed." });
      return true;
    }
    sendJson(res, 200, { status: "ok" });
    return true;
  }

  if (pathname !== "/api/race/plan") {
    return false;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed. Use POST /api/race/plan." });
    return true;
  }

  if (!isAllowedRequestOrigin(req)) {
    sendJson(res, 401, {
      ok: false,
      status: 401,
      error: "Unauthorized request origin.",
    });
    return true;
  }

  const clientIpKey = extractClientIpKey(req);
  const releaseRateSlot = acquireRateLimitSlot(clientIpKey);
  if (!releaseRateSlot) {
    sendJson(
      res,
      429,
      {
        ok: false,
        status: 429,
        error: "Rate limit exceeded. Please wait before sending another planning request.",
      },
      { "Retry-After": "60" }
    );
    return true;
  }

  try {
    // Enforce per-client session identifier unconditionally
    const rawClientHeader = req.headers?.["x-client-id"];
    const clientId = String(
      Array.isArray(rawClientHeader) ? rawClientHeader[0] || "" : rawClientHeader || ""
    ).trim();
    if (!CLIENT_ID_RE.test(clientId)) {
      sendJson(res, 400, {
        ok: false,
        status: 400,
        error: "Missing or invalid x-client-id session header.",
      });
      return true;
    }

    const apiKey = resolveServerGeminiKey(envRecord);
    if (!apiKey) {
      sendJson(res, 401, {
        ok: false,
        status: 401,
        error: "GEMINI_API_KEY is not configured. Add GEMINI_API_KEY in AI Studio Settings > Secrets.",
      });
      return true;
    }

    let body;
    try {
      body = await readJsonBodyBounded(req, MAX_BODY_BYTES);
    } catch (err) {
      const safeErr = toSafeError(err);
      console.error("[raceApi] Invalid request body:", safeErr);
      const status = safeErr.status === 413 ? 413 : 400;
      if (status === 413) {
        res.once?.("finish", () => req.destroy?.());
        sendJson(
          res,
          413,
          { ok: false, status: 413, error: "Request payload exceeds 2 MB limit." },
          { Connection: "close" }
        );
        return true;
      }
      sendJson(res, status, {
        ok: false,
        status,
        error: safeErr.message,
      });
      return true;
    }

  const acceptHeader = String(req.headers?.accept || "");
  const wantsSse =
    acceptHeader.includes("text/event-stream") ||
    (body.stream !== false && body.stream !== "false" && !acceptHeader.includes("application/json"));

  if (!wantsSse || body.stream === false) {
    try {
      const result = await runRacePlanTurn({
        apiKey,
        clientId,
        model: resolveModel(body.model),
        previousInteractionId: body.previousInteractionId,
        lap: body.lap,
        turn: body.turn,
        imageDataUrl: body.imageDataUrl,
        pngBase64: body.pngBase64,
        feedbackText: body.feedbackText,
        recentHistoryText: body.recentHistoryText,
      });
      sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      const safeErr = toSafeError(err);
      console.error("[raceApi] Non-streaming turn error:", safeErr);
      const rawStatus = Number(safeErr.status);
      const status = rawStatus >= 400 && rawStatus < 600 && rawStatus !== 403 ? rawStatus : 500;
      sendJson(res, status, { ok: false, status, error: safeErr.message });
    }
    return true;
  }

  req.socket?.setNoDelay?.(true);
  res.socket?.setNoDelay?.(true);

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "X-Content-Type-Options": "nosniff",
  });
  res.flushHeaders?.();

  const SSE_FLUSH_PAD = `: ${" ".repeat(2048)}\n`;
  if (!res.writableEnded) {
    res.write(`${SSE_FLUSH_PAD}: stream-open\n\n`);
  }

  const writeSse = (payload) => {
    if (!res.writableEnded) {
      res.write(`${SSE_FLUSH_PAD}data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  try {
    const result = await runRacePlanTurn({
      apiKey,
      clientId,
      model: resolveModel(body.model),
      previousInteractionId: body.previousInteractionId,
      lap: body.lap,
      turn: body.turn,
      imageDataUrl: body.imageDataUrl,
      pngBase64: body.pngBase64,
      feedbackText: body.feedbackText,
      recentHistoryText: body.recentHistoryText,
      onThinkingUpdate: ({ thinkingText, thoughtTokens, elapsedSec }) => {
        writeSse({
          type: "thinking",
          thinkingText,
          thoughtTokens: thoughtTokens || 0,
          elapsedSec: elapsedSec || 0,
        });
      },
    });

    writeSse({ type: "result", ok: true, ...result });
    if (!res.writableEnded) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (err) {
    const safeErr = toSafeError(err);
    console.error("[raceApi] Streaming turn error:", safeErr);
    writeSse({
      type: "error",
      ok: false,
      status: Number(safeErr.status) || 500,
      error: safeErr.message,
    });
    if (!res.writableEnded) res.end();
  }
  return true;
  } finally {
    releaseRateSlot();
  }
}
