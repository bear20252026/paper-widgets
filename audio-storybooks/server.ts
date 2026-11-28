import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import {
  createInteraction,
  DEFAULT_AGENT_NAME,
  DEFAULT_MODEL_NAME,
  downloadEnvironmentFile,
  downloadSandboxStorybookAssets,
  type InlineSource,
  listEnvironmentFiles,
  resolveServerApiKey,
  streamInteraction,
} from "./server/lib/agentClient.ts";
import {
  extractJsonFromText,
  normalizeManagedAgentStorybook,
} from "./server/lib/jsonExtractor.ts";
import { synthesizeStorybookMediaOnServer } from "./server/lib/storybookSynthesizer.ts";

function stripHttpOptions(val: any): any {
  if (!val || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(stripHttpOptions);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (
      k === "httpOptions" ||
      k === "http_options" ||
      k === "__proto__" ||
      k === "constructor" ||
      k === "prototype" ||
      k === "cachedContent" ||
      k === "cached_content" ||
      k === "fileSearch" ||
      k === "file_search" ||
      k === "corpora" ||
      k === "semanticRetriever" ||
      k === "semantic_retriever"
    ) continue;
    if ((k === "fileData" || k === "file_data") && v && typeof v === "object") {
      const rawU = (v as any).fileUri ?? (v as any).file_uri;
      const u = typeof rawU === "string" ? rawU.trim() : "";
      if (!/^https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(u)) continue;
    }
    out[k] = stripHttpOptions(v);
  }
  return out;
}

const MOUNTED_REFERENCE_SCRIPTS = new Set(["books_spec.py", "voice_mastering.py", "update_timeline_manifest.py"]);

function getAgentInlineSources(dirPath: string, baseTarget = ".agents"): InlineSource[] {
  let sources: InlineSource[] = [];
  if (!fs.existsSync(dirPath)) return sources;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "__pycache__") continue;
    const fullPath = path.join(dirPath, entry.name);
    const targetPath = path.posix.join(baseTarget, entry.name);
    if (entry.isDirectory()) {
      sources = sources.concat(getAgentInlineSources(fullPath, targetPath));
    } else if (entry.isFile()) {
      if (baseTarget === ".agents/scripts" && !MOUNTED_REFERENCE_SCRIPTS.has(entry.name)) {
        continue;
      }
      sources.push({
        type: "inline",
        content: fs.readFileSync(fullPath, "utf-8"),
        target: targetPath,
      });
    }
  }
  return sources;
}

/** Insertion/access-ordered Map that evicts its oldest entries above `maxEntries`. */
class BoundedMap<K, V> {
  private readonly items = new Map<K, V>();
  private readonly maxEntries: number;

  constructor(maxEntries: number) {
    this.maxEntries = maxEntries;
  }

  set(key: K, value: V): void {
    if (this.items.has(key)) {
      this.items.delete(key);
    }
    this.items.set(key, value);
    while (this.items.size > this.maxEntries) {
      const oldest = this.items.keys().next();
      if (oldest.done) break;
      this.items.delete(oldest.value);
    }
  }

  get(key: K): V | undefined {
    const val = this.items.get(key);
    if (val !== undefined) {
      this.items.delete(key);
      this.items.set(key, val);
    }
    return val;
  }

  has(key: K): boolean {
    return this.items.has(key);
  }

  delete(key: K): boolean {
    return this.items.delete(key);
  }
}

const CLIENT_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{4,128}$/;
const INTERACTION_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

const OWNERSHIP_MAX_ENTRIES = 2000;
const ownedEnvironmentIds = new BoundedMap<string, string>(OWNERSHIP_MAX_ENTRIES);
const ownedInteractionIds = new BoundedMap<string, string>(OWNERSHIP_MAX_ENTRIES);
const activeAborts = new BoundedMap<string, { controller: AbortController; clientId: string }>(500);
const synthesizedStorybookCache = new BoundedMap<string, Record<string, any>>(40);

const FILE_CAPABILITY_SECRET = crypto.randomBytes(32);

function getClientId(req: express.Request): string | null {
  const raw = req.headers["x-client-id"];
  const val = Array.isArray(raw) ? raw[0] : raw;
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return CLIENT_ID_RE.test(trimmed) ? trimmed : null;
}

function mintEnvCapabilityToken(envId: string, clientId: string): string {
  return crypto
    .createHmac("sha256", FILE_CAPABILITY_SECRET)
    .update(`${envId}:${clientId}`)
    .digest("hex");
}

function verifyEnvCapabilityToken(envId: string, ownerClientId: string, candidateToken: string): boolean {
  if (!candidateToken || !/^[0-9a-f]{64}$/i.test(candidateToken)) return false;
  const expected = mintEnvCapabilityToken(envId, ownerClientId);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(candidateToken.toLowerCase(), "hex"));
  } catch {
    return false;
  }
}

// Agent models the UI's free-text "AGENT MODEL" field may select.
const ALLOWED_AGENT_MODELS = new Set<string>([
  DEFAULT_MODEL_NAME,
  "gemini-3.1-pro-preview",
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
]);

const SAFE_ENV_FILE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/json",
  "text/plain",
]);

/** Allowlisted Content-Type for sandbox files; everything else is served as opaque bytes. */
function safeEnvFileContentType(upstreamType: string): string {
  const mime = String(upstreamType || "").split(";")[0].trim().toLowerCase();
  if (mime === "application/json" || mime === "text/plain") return `${mime}; charset=utf-8`;
  if (SAFE_ENV_FILE_TYPES.has(mime) || /^audio\/[a-z0-9.+-]+$/.test(mime)) return mime;
  return "application/octet-stream";
}

function normalizeOwnedEnvId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.replace(/^environments\//, "").replace(/^environment-/, "").trim();
  if (!clean || clean === "remote") return null;
  return /^[a-zA-Z0-9_-]{1,128}$/.test(clean) ? clean : null;
}

async function prefetchGutenbergReference(query: string, signal?: AbortSignal): Promise<string | null> {
  const trimmed = String(query || "").trim();
  if (!trimmed) return null;
  try {
    const resp = await fetch(`https://gutendex.com/books?search=${encodeURIComponent(trimmed)}`, {
      redirect: "follow",
      signal: signal ?? AbortSignal.timeout(4500),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { results?: Array<Record<string, any>> };
    const top = Array.isArray(data?.results) ? data.results.slice(0, 3) : [];
    if (top.length === 0) return null;
    const compact = top.map((b) => ({
      id: b.id,
      title: b.title,
      authors: b.authors,
      summaries: b.summaries,
      subjects: b.subjects,
    }));
    return JSON.stringify({ query: trimmed, matches: compact }, null, 2);
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 2);
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: "25mb" }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      req.body = stripHttpOptions(req.body);
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", hasKey: Boolean(resolveServerApiKey()) });
  });

  const ALLOWED_PASSTHROUGH_MODELS = new Set([
    "gemini-4-neon",
    "gemini-3.1-pro-preview",
    "gemini-3.8-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite-image",
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-flash-preview-tts",
  ]);
  app.post("/api/generate-content", express.json({ limit: "15mb" }), async (req, res): Promise<any> => {
    try {
      const requestedModel = String(req.body?.model || "").replace(/^models\//, "");
      if (!ALLOWED_PASSTHROUGH_MODELS.has(requestedModel)) {
        return res.status(400).json({ error: "Model not allowed." });
      }
      const apiKey = resolveServerApiKey();
      if (!apiKey) {
        return res.status(503).json({ error: "API key is not configured." });
      }
      const ai = new GoogleGenAI({ apiKey });
      const sanitizedBody = stripHttpOptions(req.body);
      const effectiveModel = requestedModel === "gemini-2.5-flash" ? "gemini-3-flash-preview" : requestedModel;
      const response = await ai.models.generateContent({ ...sanitizedBody, model: effectiveModel });
      return res.json({
        candidates: response?.candidates,
        promptFeedback: response?.promptFeedback,
        usageMetadata: response?.usageMetadata,
        modelVersion: response?.modelVersion,
        responseId: response?.responseId,
        text: response?.text,
        functionCalls: response?.functionCalls,
      });
    } catch (error: any) {
      console.error("[Backend] /api/generate-content error:", error);
      return res.status(500).json({ error: error.message || "Failed to generate content." });
    }
  });

  // Health & Agent Config introspection endpoint
  app.get(["/api/agent-config", "/api/agent-info"], (_req, res) => {
    const agentDir = path.join(process.cwd(), "agent");
    const inlineSources = getAgentInlineSources(agentDir);
    res.json({
      agent: DEFAULT_AGENT_NAME,
      agentConfig: {
        type: "antigravity",
        model: DEFAULT_MODEL_NAME,
      },
      cliRepo: "https://github.com/google-gemini/gemini-api-cli",
      mountedFiles: inlineSources.map((s) => s.target),
      modelsCatalog: [
        { role: "Managed Agent Orchestrator", model: "gemini-4-neon (Gemini 4 Neon)", agent: "antigravity-preview-09-2026" },
        { role: "Story & Script Adaptation", model: "gemini-3.1-pro-preview / gemini-3.8-flash", tool: "Managed Agent sandbox dramaturgy" },
        { role: "Book Cover & Spread Illustrations", model: "gemini-3.1-flash-lite-image", tool: "Server-side studio illustrator" },
        { role: "Multi-Voice Dramatized Narration", model: "gemini-3.1-flash-tts-preview", tool: "Server-side multi-voice TTS & mastering" },
        { role: "Ambient Musical Soundtrack", model: "lyria-3-clip-preview", tool: "Server-side chamber score mixer" },
      ],
    });
  });

  // Project Gutenberg search proxy for classic literature adaptation
  app.get("/api/gutenberg/search", async (req, res) => {
    try {
      const q = String(req.query.q || "alice in wonderland");
      const resp = await fetch(`https://gutendex.com/books?search=${encodeURIComponent(q)}`);
      if (!resp.ok) {
        return res.status(resp.status).json({ error: `Gutendex error ${resp.status}` });
      }
      const data = await resp.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to search Project Gutenberg" });
    }
  });

  // Multi-tenant cancel endpoint scoped strictly per `x-client-id`
  const handleCancelStorybook = (req: express.Request, res: express.Response, rawSessionId: unknown) => {
    const clientId = getClientId(req);
    if (!clientId) {
      return res.status(401).json({ error: "Missing or invalid x-client-id header" });
    }
    if (typeof rawSessionId !== "string" || !SESSION_ID_RE.test(rawSessionId)) {
      return res.status(400).json({ error: "Invalid sessionId" });
    }
    const entry = activeAborts.get(rawSessionId);
    if (!entry) {
      return res.status(404).json({ error: "Active storybook session not found" });
    }
    if (entry.clientId !== clientId) {
      return res.status(401).json({ error: "Unauthorized: session belongs to another client" });
    }
    entry.controller.abort();
    activeAborts.delete(rawSessionId);
    return res.json({ ok: true, cancelled: rawSessionId });
  };

  app.post("/api/cancel-storybook", (req, res) => {
    handleCancelStorybook(req, res, req.body?.sessionId);
  });

  app.post("/api/abort/:sessionId", (req, res) => {
    handleCancelStorybook(req, res, req.params.sessionId);
  });

  // Environments Files API proxy endpoints: strictly scoped per `x-client-id` (or capability token on GET file)
  app.get("/api/environments/:envId/files", async (req, res) => {
    try {
      const clientId = getClientId(req);
      const cleanEnvId = normalizeOwnedEnvId(req.params.envId);
      if (!clientId || !cleanEnvId || ownedEnvironmentIds.get(cleanEnvId) !== clientId) {
        return res.status(401).json({ error: "Access denied for environment" });
      }
      const dirPath = String(req.query.path || "workspace");
      const recursive = req.query.recursive !== "false";
      const files = await listEnvironmentFiles(cleanEnvId, dirPath, { recursive });
      res.json({ environmentId: cleanEnvId, path: dirPath, files });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to list environment files" });
    }
  });

  const serveOwnedEnvironmentFile = async (
    req: express.Request,
    res: express.Response,
    rawEnvId: unknown
  ) => {
    try {
      const cleanEnvId = normalizeOwnedEnvId(rawEnvId);
      const ownerClientId = cleanEnvId ? ownedEnvironmentIds.get(cleanEnvId) : undefined;
      if (!cleanEnvId || !ownerClientId) {
        return res.status(401).json({ error: "Access denied for environment" });
      }
      const reqClientId = getClientId(req);
      const capToken = typeof req.query.cap === "string" ? req.query.cap : "";
      const authorized =
        (reqClientId !== null && reqClientId === ownerClientId) ||
        verifyEnvCapabilityToken(cleanEnvId, ownerClientId, capToken);

      if (!authorized) {
        return res.status(401).json({ error: "Access denied for environment" });
      }

      const filePath = String(req.query.path || "");
      if (!filePath) {
        return res.status(400).json({ error: "Query parameter ?path= is required" });
      }
      const { buffer, mimeType } = await downloadEnvironmentFile(cleanEnvId, filePath);
      // SECURITY: never reflect the sandbox-chosen MIME type (stored XSS via .html/.svg).
      res.setHeader("Content-Type", safeEnvFileContentType(mimeType));
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(buffer);
    } catch (err: any) {
      res.status(404).json({ error: err?.message || "File not found in environment" });
    }
  };

  app.get("/api/environments/:envId/file", async (req, res) => {
    await serveOwnedEnvironmentFile(req, res, req.params.envId);
  });

  app.get("/api/sandbox-file", async (req, res) => {
    await serveOwnedEnvironmentFile(req, res, req.query.envId);
  });

  app.get("/api/environments/:envId/storybook", async (req, res) => {
    try {
      const clientId = getClientId(req);
      const cleanEnvId = normalizeOwnedEnvId(req.params.envId);
      if (!clientId || !cleanEnvId || ownedEnvironmentIds.get(cleanEnvId) !== clientId) {
        return res.status(401).json({ error: "Access denied for environment" });
      }

      const cached = synthesizedStorybookCache.get(cleanEnvId);
      if (cached) {
        return res.json({
          storybook: cached,
          environmentId: cleanEnvId,
          cached: true,
        });
      }

      const apiKey = resolveServerApiKey();
      if (!apiKey) {
        return res.status(503).json({ error: "API key is not configured." });
      }

      const capToken = mintEnvCapabilityToken(cleanEnvId, clientId);
      const assets = await downloadSandboxStorybookAssets(cleanEnvId, {
        apiKey,
        capabilityToken: capToken,
      });
      if (!assets.storybookData) {
        return res.status(404).json({ error: "No storybook.json found in environment" });
      }
      let storybook = normalizeManagedAgentStorybook(
        assets.storybookData,
        assets.imageAssets,
        assets.audioAssets,
        assets.timelineManifest
      );
      storybook = await synthesizeStorybookMediaOnServer({
        storybook,
        apiKey,
      });
      synthesizedStorybookCache.set(cleanEnvId, storybook);
      res.json({
        storybook,
        environmentId: cleanEnvId,
        filesCount: assets.files.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load storybook from environment" });
    }
  });

  // Main Managed Agent SSE endpoint for generating a complete Illustrated Storybook & Audiobook
  app.post("/api/generate-storybook", async (req, res) => {
    const {
      prompt,
      classicBookTitle,
      visualStyle,
      pageCount = 3,
      narratorVoice = "Kore",
      modelName = DEFAULT_MODEL_NAME,
      environmentId,
      previousInteractionId,
      sessionId,
    } = req.body || {};
    // SECURITY: the agent and API key are server-controlled; client-supplied
    // agentName/apiKey are ignored and modelName must be allowlisted.
    const agentName = DEFAULT_AGENT_NAME;
    const resolvedApiKey = resolveServerApiKey();
    const clientId = getClientId(req);

    if (!prompt && !classicBookTitle) {
      return res.status(400).json({ error: "A story prompt or classic book title is required" });
    }

    let validatedEnvId: string | undefined;
    if (environmentId !== undefined && environmentId !== null && environmentId !== "") {
      const clean = normalizeOwnedEnvId(environmentId);
      if (!clientId || !clean || ownedEnvironmentIds.get(clean) !== clientId) {
        return res.status(401).json({ error: "Invalid or unauthorized environmentId" });
      }
      validatedEnvId = clean;
    }

    let validatedPrevInteractionId: string | undefined;
    if (previousInteractionId !== undefined && previousInteractionId !== null && previousInteractionId !== "") {
      if (
        !clientId ||
        typeof previousInteractionId !== "string" ||
        !INTERACTION_ID_RE.test(previousInteractionId) ||
        ownedInteractionIds.get(previousInteractionId) !== clientId
      ) {
        return res.status(401).json({ error: "Invalid or unauthorized previousInteractionId" });
      }
      validatedPrevInteractionId = previousInteractionId;
    }

    const safeSessionId =
      typeof sessionId === "string" && SESSION_ID_RE.test(sessionId) ? sessionId : undefined;
    if (safeSessionId) {
      const existingSession = activeAborts.get(safeSessionId);
      if (existingSession && existingSession.clientId !== (clientId || "")) {
        return res.status(409).json({ error: "Session ID is already active for another client" });
      }
    }

    if (typeof modelName !== "string" || !ALLOWED_AGENT_MODELS.has(modelName)) {
      return res.status(400).json({ error: "Invalid modelName" });
    }

    if (!resolvedApiKey) {
      return res.status(400).json({
        error: "No valid GEMINI_API_KEY configured. Please provide a valid Gemini API key.",
      });
    }

    const effectiveOwnerId = clientId || `ephemeral_${crypto.randomUUID()}`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const abortController = new AbortController();
    if (safeSessionId && clientId) {
      activeAborts.set(safeSessionId, { controller: abortController, clientId });
    }
    // Cancelling in the UI aborts the fetch; stop the upstream agent run when the client disconnects.
    res.on("close", () => {
      if (!res.writableEnded) abortController.abort();
    });

    try {
      const agentDir = path.join(process.cwd(), "agent");
      const inlineSources = getAgentInlineSources(agentDir);

      // Optional server-side Gutenberg metadata lookup (sandbox runs with network: "disabled")
      if (classicBookTitle) {
        const gutenbergRef = await prefetchGutenbergReference(
          String(classicBookTitle),
          abortController.signal
        );
        if (gutenbergRef) {
          inlineSources.push({
            type: "inline",
            content: gutenbergRef,
            target: ".agents/gutenberg_reference.json",
          });
        }
      }

      const safePageCount = Math.max(1, Math.min(6, Number(pageCount) || 3));

      sendEvent("status", {
        message: `Booting Managed Agent (${agentName} / ${modelName}) & mounting ${inlineSources.length} skill files...`,
        stageIndex: 0,
        stageLabel: `Stage I · Booting Managed Agent Sandbox (${agentName})`,
        agent: agentName,
        model: modelName,
      });

      const fullPrompt = [
        classicBookTitle
          ? `Create an illustrated storybook and dramatized multi-voice audiobook adaptation of the classic work "${classicBookTitle}".`
          : `Create an original illustrated storybook and dramatized multi-voice audiobook based on this request: "${prompt}".`,
        prompt && classicBookTitle ? `Additional user direction: ${prompt}` : "",
        `Target number of illustrated folio spreads: ${safePageCount} (FOLIO I.1 through FOLIO I.${safePageCount}).`,
        visualStyle ? `Visual art direction: ${visualStyle}.` : "",
        `Primary Storyteller / Narrator voice: ${narratorVoice} (plus distinct Gemini TTS voices from Kore, Aoede, Charon, Fenrir, Orus, Leda, Puck, Zephyr, Iapetus for speaking characters).`,
        "",
        "IMPORTANT SANDBOX WORKFLOW (SERVER-SIDE MEDIA RENDERING):",
        "- For security isolation, GEMINI_API_KEY and network access are disabled inside this bash container.",
        "- Do NOT attempt `curl`, `git clone`, `gemini-api`, or outbound HTTP calls from bash.",
        "- Complete Stage II (Dramaturgy & Folio Spec) in the sandbox:",
        "  1. Create `./workspace/data` (`mkdir -p ./workspace/data`) and author `./workspace/data/storybook.json` (also copy to `./storybook.json`).",
        "  2. Include `title`, `subtitle`, `author`, `year`, `genreFooterLeft`, `settingFooterRight`, `palette` (`paper: \"#F6F2EA\"`, `card: \"#EFE9DC\"`, `ink: \"#1E1B18\"`, `muted: \"#7A7267\"`, `accent: \"#4A6B53\"`, `rule: \"#D5CBB8\"`), `visualStyle`, `musicPrompt`, strictly anonymous `charSheetPrompt` (physical descriptions only, zero proper character/book names), `coverImagePrompt`, `characters` (`id`, `name`, `role`, `description`, `voiceName`, `voiceStyle`), and `pages` (1.." +
          safePageCount +
          ") each with `pageNumber`, `sceneIdx`, `sceneLabel`, `folioLabel`, `chapterTitle`, `imageCaption`, strictly anonymous `illustrationPrompt`, `narrativeText`, and 4–6 `dialogueLines` (`speaker`, `speakerLabel`, `isDialogue`, `voiceName`, `stylePrompt`, `text`).",
        "  3. Validate `./workspace/data/storybook.json` with `python3 -m json.tool ./workspace/data/storybook.json > /dev/null` and output the final JSON inside a ```json ... ``` code block.",
        "- Immediately after your turn completes, the host Studio Server will synthesize all 16:9 archival watercolour plates, 24 kHz multi-voice TTS turns, and the chamber score server-side!",
      ]
        .filter(Boolean)
        .join("\n");

      const response = await createInteraction({
        prompt: fullPrompt,
        inlineSources,
        environmentId: validatedEnvId,
        previousInteractionId: validatedPrevInteractionId,
        agentName,
        modelName,
        apiKey: resolvedApiKey,
        signal: abortController.signal,
      });

      let fullText = "";
      let activeEnvId: string | undefined = validatedEnvId;
      let interactionId: string | undefined;

      await streamInteraction(response, {
        onCreated: (id, envId) => {
          interactionId = id;
          if (id && INTERACTION_ID_RE.test(id)) {
            ownedInteractionIds.set(id, effectiveOwnerId);
          }
          const normEnv = normalizeOwnedEnvId(envId);
          if (normEnv) {
            activeEnvId = normEnv;
            ownedEnvironmentIds.set(normEnv, effectiveOwnerId);
          }
          sendEvent("created", { id, envId: activeEnvId, agent: agentName, model: modelName });
        },
        onStatus: (status) => {
          sendEvent("status", {
            message: `Agent status: ${status}`,
            stageIndex: 1,
            stageLabel: "Stage II · Authoring 3-Folio Dramaturgy & Character Spec",
          });
        },
        onThinking: (thought) => {
          sendEvent("thinking", { thought });
        },
        onText: (text) => {
          fullText += text;
          sendEvent("text", { text });
        },
        onToolCall: (name, args, id) => {
          sendEvent("tool_call", { name, args, id });
        },
        onToolResult: (name, result, isError, callId) => {
          sendEvent("tool_result", { name, result, isError, callId });
        },
        onComplete: (_interaction, envId) => {
          const normEnv = normalizeOwnedEnvId(envId);
          if (normEnv) {
            activeEnvId = normEnv;
            ownedEnvironmentIds.set(normEnv, effectiveOwnerId);
          }
          sendEvent("status", {
            message: "Agent completed dramaturgy spec. Reading storybook.json from sandbox...",
          });
        },
        onError: (err) => {
          throw new Error(`Managed Agent error: ${JSON.stringify(err)}`);
        },
      });

      let storybookData: any = extractJsonFromText(fullText);
      let timelineManifest: any = null;
      let imageAssets: Record<string, string> = {};
      let audioAssets: Record<string, string> = {};

      if (activeEnvId) {
        try {
          const capToken = mintEnvCapabilityToken(activeEnvId, effectiveOwnerId);
          const downloaded = await downloadSandboxStorybookAssets(activeEnvId, {
            apiKey: resolvedApiKey,
            capabilityToken: capToken,
            signal: abortController.signal,
            onStatus: (message) => sendEvent("status", { message }),
          });
          if (downloaded.storybookData) {
            storybookData = downloaded.storybookData;
          }
          timelineManifest = downloaded.timelineManifest;
          imageAssets = downloaded.imageAssets;
          audioAssets = downloaded.audioAssets;
        } catch {
          // Proceed with storybookData extracted from model_output if sandbox file download fails
        }
      }

      if (!storybookData) {
        throw new Error("Could not extract storybook.json from sandbox workspace or agent output.");
      }

      storybookData = normalizeManagedAgentStorybook(
        storybookData,
        imageAssets,
        audioAssets,
        timelineManifest
      );

      // Server-side generation of Character Sheet, 16:9 Folio Plates, Multi-Voice 24 kHz TTS, and Chamber Score Mix
      storybookData = await synthesizeStorybookMediaOnServer({
        storybook: storybookData,
        apiKey: resolvedApiKey,
        visualStyle,
        narratorVoice,
        signal: abortController.signal,
        onProgress: (stageIndex, stageLabel, message) => {
          sendEvent("status", { message, stageIndex, stageLabel });
        },
      });

      if (activeEnvId) {
        synthesizedStorybookCache.set(activeEnvId, storybookData);
      }

      sendEvent("result", {
        storybook: storybookData,
        environmentId: activeEnvId,
        interactionId,
        agent: agentName,
        model: modelName,
      });
      res.end();
    } catch (error: any) {
      if (error?.name === "AbortError" || abortController.signal.aborted) {
        sendEvent("cancelled", { message: "Storybook generation was cancelled." });
      } else {
        sendEvent("error", { message: error?.message || "An unexpected error occurred" });
      }
      res.end();
    } finally {
      if (safeSessionId) {
        activeAborts.delete(safeSessionId);
      }
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Storybook Managed Agent Studio running on http://localhost:${PORT}`);
  });
}

startServer();
