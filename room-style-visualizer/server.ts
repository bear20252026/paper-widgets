import crypto from "crypto";
import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32);

function stripHttpOptions(val: any): any {
  if (!val || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(stripHttpOptions);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (
      k === "httpOptions" ||
      k === "http_options" ||
      k === "abortSignal" ||
      k === "abort_signal" ||
      k === "__proto__" ||
      k === "constructor" ||
      k === "prototype" ||
      k === "cachedContent" ||
      k === "cached_content" ||
      k === "fileSearch" ||
      k === "file_search" ||
      k === "fileSearchStoreNames" ||
      k === "file_search_store_names" ||
      k === "corpora" ||
      k === "semanticRetriever" ||
      k === "semantic_retriever" ||
      k === "previous_interaction_id" ||
      k === "previousInteractionId" ||
      k === "environment" ||
      k === "environment_id" ||
      k === "environmentId" ||
      k === "safetySettings" ||
      k === "safety_settings" ||
      k === "fileData" ||
      k === "file_data"
    ) {
      continue;
    }
    out[k] = stripHttpOptions(v);
  }
  return out;
}

const EXACT_SHOWCASE_HOST_RE =
  /^(?:[a-z0-9-]+-853813963450|ais-(?:dev|pre)-[a-z0-9-]+-73428471351)\.[a-z0-9-]+\.run\.app$/;

function isCloudRunRuntime(): boolean {
  return typeof process.env.K_SERVICE === "string" && process.env.K_SERVICE.trim().length > 0;
}

function getConfiguredAppHostname(): string {
  const raw = (process.env.APP_URL || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isAllowedOriginUrl(rawUrl: string, inCloudRun: boolean): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (inCloudRun && parsed.protocol !== "https:") return false;
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const hostname = parsed.hostname.toLowerCase();
    const configuredHost = getConfiguredAppHostname();
    if (configuredHost && hostname === configuredHost) {
      return true;
    }
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

function isAllowedRequestOrigin(req: express.Request): boolean {
  const secFetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (secFetchSite === "cross-site") {
    return false;
  }
  const rawOrigin = req.headers.origin;
  const origin = typeof rawOrigin === "string" ? rawOrigin.trim() : "";
  const inCloudRun = isCloudRunRuntime();

  if (!origin) {
    if (secFetchSite === "same-origin") {
      return true;
    }
    if (req.method === "GET") {
      const referer = typeof req.headers.referer === "string" ? req.headers.referer.trim() : "";
      if (referer) {
        return isAllowedOriginUrl(referer, inCloudRun);
      }
    }
    return false;
  }
  if (origin === "null") return false;
  return isAllowedOriginUrl(origin, inCloudRun);
}

function isInternalOrLoopbackIp(ip: string): boolean {
  const clean = ip.toLowerCase().startsWith("::ffff:") ? ip.slice(7) : ip.toLowerCase();
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
  const m172 = /^172\.(\d{1,3})\./.exec(clean);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function getClientIpKey(req: express.Request): string {
  const rawXff = req.headers["x-forwarded-for"];
  const xffStr = Array.isArray(rawXff)
    ? rawXff.join(",")
    : typeof rawXff === "string"
      ? rawXff
      : "";
  if (xffStr) {
    const hops = xffStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    while (hops.length > 1 && isInternalOrLoopbackIp(hops[hops.length - 1])) {
      hops.pop();
    }
    if (hops.length > 0 && isCloudRunRuntime()) {
      return `ip:${hops[hops.length - 1].toLowerCase()}`;
    }
  }
  return `ip:${(req.ip || req.socket?.remoteAddress || "unknown").toLowerCase()}`;
}

function requireClientKey(req: express.Request): string | null {
  const raw = req?.headers?.["x-client-id"];
  if (typeof raw === "string" && /^[a-zA-Z0-9._-]{8,128}$/.test(raw.trim())) {
    return `cid:${raw.trim()}`;
  }
  return null;
}

interface RateBucket {
  timestamps: number[];
  active: number;
}

interface MultiRateLimits {
  ipMaxConcurrent: number;
  ipMaxPerMinute: number;
  clientMaxConcurrent: number;
  clientMaxPerMinute: number;
  globalMaxConcurrent: number;
  globalMaxPerMinute: number;
}

const MAX_RATE_BUCKETS = 4096;
const rateBuckets = new Map<string, RateBucket>();

function pruneIdleRateBuckets(cutoff: number): void {
  for (const [k, b] of rateBuckets.entries()) {
    while (b.timestamps.length > 0 && b.timestamps[0] <= cutoff) {
      b.timestamps.shift();
    }
    if (b.active === 0 && b.timestamps.length === 0) {
      rateBuckets.delete(k);
    }
  }
}

function tryAcquireSingleBucket(
  key: string,
  now: number,
  cutoff: number,
  maxConcurrent: number,
  maxPerMinute: number
): (() => void) | null {
  let bucket = rateBuckets.get(key);
  if (bucket) {
    rateBuckets.delete(key);
    rateBuckets.set(key, bucket);
  } else {
    if (rateBuckets.size >= MAX_RATE_BUCKETS) {
      pruneIdleRateBuckets(cutoff);
    }
    if (rateBuckets.size >= MAX_RATE_BUCKETS) {
      const oldest = rateBuckets.keys().next().value;
      if (oldest !== undefined) rateBuckets.delete(oldest);
    }
    bucket = { timestamps: [], active: 0 };
    rateBuckets.set(key, bucket);
  }
  while (bucket.timestamps.length > 0 && bucket.timestamps[0] <= cutoff) {
    bucket.timestamps.shift();
  }
  if (bucket.active >= maxConcurrent || bucket.timestamps.length >= maxPerMinute) {
    return null;
  }
  bucket.timestamps.push(now);
  bucket.active += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    bucket!.active = Math.max(0, bucket!.active - 1);
  };
}

function acquireMultiRateSlot(
  scope: string,
  ipKey: string,
  clientKey: string | null,
  limits: MultiRateLimits
): (() => void) | null {
  const now = Date.now();
  const cutoff = now - 60_000;
  const releasers: Array<() => void> = [];

  const globalRelease = tryAcquireSingleBucket(
    `${scope}:global`,
    now,
    cutoff,
    limits.globalMaxConcurrent,
    limits.globalMaxPerMinute
  );
  if (!globalRelease) return null;
  releasers.push(globalRelease);

  const ipRelease = tryAcquireSingleBucket(
    `${scope}:${ipKey}`,
    now,
    cutoff,
    limits.ipMaxConcurrent,
    limits.ipMaxPerMinute
  );
  if (!ipRelease) {
    globalRelease();
    const gBucket = rateBuckets.get(`${scope}:global`);
    if (gBucket && gBucket.timestamps.length > 0) gBucket.timestamps.pop();
    return null;
  }
  releasers.push(ipRelease);

  if (clientKey) {
    const clientRelease = tryAcquireSingleBucket(
      `${scope}:${clientKey}`,
      now,
      cutoff,
      limits.clientMaxConcurrent,
      limits.clientMaxPerMinute
    );
    if (!clientRelease) {
      ipRelease();
      globalRelease();
      const ipBucket = rateBuckets.get(`${scope}:${ipKey}`);
      if (ipBucket && ipBucket.timestamps.length > 0) ipBucket.timestamps.pop();
      const gBucket = rateBuckets.get(`${scope}:global`);
      if (gBucket && gBucket.timestamps.length > 0) gBucket.timestamps.pop();
      return null;
    }
    releasers.push(clientRelease);
  }

  let allReleased = false;
  return () => {
    if (allReleased) return;
    allReleased = true;
    for (const fn of releasers) fn();
  };
}

function detectImageMimeFromBuffer(buf: Buffer): string | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const MAX_INLINE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_INLINE_IMAGE_BASE64_CHARS = Math.ceil((MAX_INLINE_IMAGE_BYTES * 4) / 3) + 128;
const DATA_IMAGE_RE = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i;
const BASE64_ONLY_RE = /^[A-Za-z0-9+/=\s]+$/;

function parseValidatedBase64Image(
  rawBytes: unknown,
  rawMime?: unknown
): { mimeType: string; data: string } | null {
  if (
    typeof rawBytes !== "string" ||
    !rawBytes.trim() ||
    rawBytes.length > MAX_INLINE_IMAGE_BASE64_CHARS ||
    !BASE64_ONLY_RE.test(rawBytes)
  ) {
    return null;
  }
  const cleaned = rawBytes.replace(/\s+/g, "");
  const buf = Buffer.from(cleaned, "base64");
  if (buf.length <= 0 || buf.length > MAX_INLINE_IMAGE_BYTES) {
    return null;
  }
  const detectedMime = detectImageMimeFromBuffer(buf);
  if (!detectedMime) return null;
  if (typeof rawMime === "string" && rawMime.trim()) {
    const norm = rawMime.trim().toLowerCase();
    if (
      norm !== "image/jpeg" &&
      norm !== "image/jpg" &&
      norm !== "image/png" &&
      norm !== "image/webp"
    ) {
      return null;
    }
  }
  return { mimeType: detectedMime, data: cleaned };
}

function parseValidatedDataImage(raw: unknown): { mimeType: string; data: string } | null {
  if (typeof raw !== "string" || !raw || raw.length > MAX_INLINE_IMAGE_BASE64_CHARS + 64) {
    return null;
  }
  const match = DATA_IMAGE_RE.exec(raw.trim());
  if (!match) return null;
  return parseValidatedBase64Image(match[2], match[1]);
}


function getSpaceLiftHmacKey(): Buffer {
  const configuredSecret = (
    process.env.FILE_TOKEN_SECRET ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    ""
  ).trim();
  if (!configuredSecret) {
    return EPHEMERAL_FALLBACK_SECRET;
  }
  return crypto
    .createHmac("sha256", "space-lift-hmac:v1")
    .update(`${process.env.APPLET_ID || ""}:${configuredSecret}`)
    .digest();
}

function signOwnedFile(rawId: string, ownerKey: string): string {
  const sig = crypto
    .createHmac("sha256", getSpaceLiftHmacKey())
    .update(`file:${ownerKey}:${rawId}`)
    .digest("hex")
    .slice(0, 32);
  return `${rawId}.${sig}`;
}

function verifyOwnedFile(token: unknown, ownerKey: string): string | null {
  if (typeof token !== "string" || !token) return null;
  const cleaned = token.trim();
  const dotIdx = cleaned.lastIndexOf(".");
  if (dotIdx <= 0) return null;
  const rawId = cleaned.slice(0, dotIdx);
  const sig = cleaned.slice(dotIdx + 1);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(rawId) || rawId.startsWith("environment-")) return null;
  if (!/^[0-9a-f]{32}$/.test(sig)) return null;
  const expectedSig = crypto
    .createHmac("sha256", getSpaceLiftHmacKey())
    .update(`file:${ownerKey}:${rawId}`)
    .digest("hex")
    .slice(0, 32);
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  return rawId;
}

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is missing");
    }
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        timeout: 300000,
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const ALLOWED_STYLE_PROMPTS = new Set<string>([
  "Interior design of a living room, Japandi style, earthy neutrals, low platform light wood furniture, zero clutter, minimalist ceramic decor, neutral palette",
  "Interior design of a living room, Industrial Modern style, charcoal tones, exposed brick wall, distressed leather sofa, iron pipe detailing, large industrial windows",
  "Interior design of a living room, Mid-Century Modern style, tapered peg legs on furniture, rich walnut wood finishes, mustard yellow and burnt orange accents",
  "Interior design of a living room, Biophilic Urban Jungle style, abundant indoor green plants, hanging vines, rattan accents, plush cream fabrics, natural sunlight",
  "Interior design of a living room, Luxury Contemporary style, plush boucle textures, elegant polished marble coffee table, gold and brass hardware accents, sophisticated lighting",
  "Interior design of a living room, Bohemian Chic style, eclectic patterns, vintage rugs, macrame wall hangings, warm earthy tones, lots of textures, relaxed vibe",
  "Interior design of a living room, Pure Minimalist style, clean white walls, hidden storage, singular statement furniture pieces, monotone palette, ample negative space",
  "Interior design of a living room, Modern Coastal style, breezy light blues, whitewashed driftwood furniture, natural linen fabrics, airy and bright, beachside atmosphere",
  "Interior design of a living room, Art Deco style, geometric patterns, velvet seating, bold jewel tones, mirrored surfaces, glamorous metallic accents",
  "Interior design of a living room, Modern Farmhouse style, rustic shiplap walls, reclaimed wood furniture, sleek black iron fixtures, cozy and inviting, neutral tones",
]);

const ALLOWED_STYLE_DESCRIPTIONS = new Set<string>([
  "Japandi minimalism blends serene Scandinavian functionality with Japanese rustic warmth to create peace.",
  "Industrial Modern embraces raw architectural elements with charcoal tones and exposed brick for an urban edge.",
  "Mid-Century Modern pairs warm retro aesthetics with sleek lines, peg legs, and vibrant autumnal accent colors.",
  "Biophilic design brings the outdoors inside, layering abundant plant life with natural rattan and cream fabrics.",
  "Luxury Contemporary exudes opulence through rich boucle textures, polished marble tables, and refined brass hardware.",
  "Bohemian Chic layers eclectic patterns, vintage rugs, and macrame accents for a free-spirited, relaxed aesthetic.",
  "Pure Minimalist focuses on the essentials with clean white walls, hidden storage, and singular statement pieces.",
  "Modern Coastal blends breezy light blues, whitewashed driftwood, and natural linen for a relaxed beachside feel.",
  "Art Deco brings glamorous symmetry to life with geometric patterns, velvet seating, and bold jewel tones.",
  "Modern Farmhouse pairs rustic shiplap walls and reclaimed woods with sleek black iron fixtures for a cozy appeal.",
]);

function parseValidatedImageList(rawList: unknown, maxItems = 2): Array<{ data: string; mimeType: string }> | null {
  if (rawList === undefined || rawList === null) return [];
  if (!Array.isArray(rawList) || rawList.length > maxItems) return null;
  const out: Array<{ data: string; mimeType: string }> = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") return null;
    const parsed = parseValidatedBase64Image((item as any).data, (item as any).mimeType);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

function mapSafeStatus(err: any): number {
  return Number(err?.status ?? err?.code) === 429 ? 429 : 500;
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 2);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.urlencoded({ limit: "64kb", extended: false }));
  app.use(express.json({ limit: "12mb" }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      req.body = stripHttpOptions(req.body);
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", (req, res, next) => {
    if (!isAllowedRequestOrigin(req)) {
      res.status(401).json({ error: "Untrusted request origin." });
      return;
    }
    next();
  });

  app.post("/api/generate", async (req, res): Promise<any> => {
    const ownerKey = requireClientKey(req);
    if (!ownerKey) {
      return res.status(400).json({ error: "Missing or invalid x-client-id header." });
    }
    const release = acquireMultiRateSlot("gen", getClientIpKey(req), ownerKey, {
      ipMaxConcurrent: 3,
      ipMaxPerMinute: 24,
      clientMaxConcurrent: 3,
      clientMaxPerMinute: 20,
      globalMaxConcurrent: 20,
      globalMaxPerMinute: 180,
    });
    if (!release) {
      res.setHeader("Retry-After", "4");
      return res.status(429).json({ error: "Rate limit reached. Please wait a moment." });
    }

    try {
      const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
      if (!ALLOWED_STYLE_PROMPTS.has(prompt)) {
        return res.status(400).json({ error: "Invalid interior style preset." });
      }

      const parts: any[] = [
        {
          text: `${prompt} Photography, high-resolution interior, cinematic lighting. Keep the original room structure, walls, windows, and main layout exactly the same. Only change the furniture, decor, and styling.`,
        },
      ];
      if (req.body?.imageBase64) {
        const parsedImg = parseValidatedDataImage(req.body.imageBase64);
        if (!parsedImg) {
          return res.status(400).json({ error: "Invalid uploaded room photo." });
        }
        parts.unshift({
          inlineData: {
            mimeType: parsedImg.mimeType,
            data: parsedImg.data,
          },
        });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: { parts },
        config: {
          imageConfig: { aspectRatio: "4:3" },
        },
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          const outMime = part.inlineData.mimeType || "image/png";
          return res.json({ imageUrl: `data:${outMime};base64,${part.inlineData.data}` });
        }
      }
      return res.status(500).json({ error: "No image generated." });
    } catch (error: any) {
      console.error("Error generating image:", error);
      const status = mapSafeStatus(error);
      if (status === 429) res.setHeader("Retry-After", "5");
      return res.status(status).json({ error: "Failed to generate styled room image." });
    } finally {
      release();
    }
  });

  app.post("/api/generate-prompt", async (req, res): Promise<any> => {
    const ownerKey = requireClientKey(req);
    if (!ownerKey) {
      return res.status(400).json({ error: "Missing or invalid x-client-id header." });
    }
    const release = acquireMultiRateSlot("prompt", getClientIpKey(req), ownerKey, {
      ipMaxConcurrent: 2,
      ipMaxPerMinute: 16,
      clientMaxConcurrent: 2,
      clientMaxPerMinute: 12,
      globalMaxConcurrent: 16,
      globalMaxPerMinute: 120,
    });
    if (!release) {
      res.setHeader("Retry-After", "5");
      return res.status(429).json({ error: "Rate limit reached. Please wait a moment." });
    }

    try {
      const productImages = parseValidatedImageList(req.body?.productImages, 2);
      const atmosphereImages = parseValidatedImageList(req.body?.atmosphereImages, 2);
      const rawDesc = typeof req.body?.productDesc === "string" ? req.body.productDesc.trim() : "";
      if (!productImages || !atmosphereImages || productImages.length === 0) {
        return res.status(400).json({ error: "Valid reference image is required." });
      }
      const safeDesc = ALLOWED_STYLE_DESCRIPTIONS.has(rawDesc) ? rawDesc : "Interior room showcase";

      const ai = getAiClient();
      const promptWriterSystemInstruction = `## Role
You are an elite product-film director, editor and Gemini Omni prompt engineer in one box. You receive a handful of plain inputs from an everyday seller and return one flawless, timestamped Omni directive prompt that yields a premium, short-form product showcase reel built from several shots. You direct like a luxury commercial and cut like a master editor. Your taste is the product: restrained, expensive, clarifying. Never slop, never gimmick, never overclaim.
Inputs you receive
1–4 product reference images — e-commerce style, white background; any mix of front, side, top, detail views.
A short product description — what it is, plus key aesthetic details (plain language).
A simple style brief — often only a few words (e.g. "white studio", "clinical skincare lab"). May include a camera or shot request.
Optional extra notes — treat any later or added input as an override.
Non-negotiable taste
Classy, simple, high-end. A tight, deliberate edit where every cut earns its place.
Forbidden: vulgar, crass, busy, cheap, "AI-looking", frantic over-cutting.
Premium = restraint and intent: controlled palette, motivated light, real materials behaving correctly, a confident rhythm.
Format & length
~10 seconds total. 2–7 shots. You decide the count for this product — never pad to seven.
Each shot = one timestamp. Beats typically 1–2s; vary deliberately.
Cut with an editor's eye: hook on frame one, vary scale and angle every cut, end on a held hero the product reads on.
Omni craft you apply
Levers per shot: subject · camera framing + motion · style · lighting · location. Detail buys control; specify deliberately, never bloat.
Reference the images. Lock identity, geometry, proportions, label and material from all views. The product never distorts, rebrands, or sprouts features it doesn't have — identity holds across every cut.
Camera repertoire. Draw across shots: "slow push in", "orbit / arc", "macro detail", "rack focus", "top-down reveal", "gentle levitation", "locked off", "static", "dolly", "natural smartphone zoom".
Physics & materials. Omni reasons about gravity, fluids and light. Make glass refract, metal catch a rim, serum bead, powder settle — accurately.
World knowledge. Don't over-explain. State intent and let Omni reason the rest.
Hard suppressions (always enforce in the output)
No music of any kind. No score, soundtrack, background music, beat, or musical sting — ever.
No voice. No voiceover, narration, dialogue or vocals.
No overlaid graphics. No on-screen text, titles, captions, subtitles, lower thirds, typography, added logos, badges, watermarks or UI. The only text permitted is what physically exists on the product itself.
Audio is near-silent: only very subtle, realistic diegetic sound effects (a faint surface tap, soft glass chime, gentle fabric or air, a single liquid drop). Often barely there.
Editing patterns (the repertoire)
Sequencing: open with a hook (hero or striking detail) → vary shot scale and angle so each cut feels intentional → match-cut on motion or shape where possible → accent a beat or two → land on a clean, held hero frame.
Rhythm: brisk but never frantic; let the final shot breathe ~0.5s longer.
Default arc (adapt, don't obey): hero wide → macro detail → arc → push-in → held hero.
Method (run silently, then output)
Read the product — category, material, finish, features most worth showing.
Translate the brief into a crafted environment, palette and light. Elevate; never literalise crudely.
"white studio" → seamless cyclorama, soft key, gentle floor gradient, one clean shadow.
"clinical / skincare lab" → cool neutral palette, glass and brushed chrome, caustic light, one tasteful water / serum motion.
Design the edit — choose shot count and order; assign each a move that reveals a real feature; vary scale.
Time it across ~10s with editorial rhythm and a held final beat.
Write the directive prompt per the contract below.
Output contract
Output only the directive prompt — nothing else. No "shot logic" line, no headings, no fences, no explanation before or after. It must begin with the words "Create a professional product showcase reel" and read as one clean, paste-ready directive in this shape:
Create a professional product showcase reel of <product> locked to the reference images so its identity, proportions, label and material stay accurate in every shot. Hard cuts between shots; the product is the hero throughout. Environment: <details>. Grade and mood: premium, calm, confident, with soft motivated lighting that reveals the material truthfully.
0.0–0.0s — <shot detail>.
0.0–0.0s — <shot detail>.
… (2–7 shots, varied in scale and motion) …
0.0–10.0s — <shot detail>.
Materials and physics: <how light and matter behave securely>. Audio: near-silent, only very subtle realistic diegetic sound effects; no music of any kind, no score, no soundtrack, no musical sting, no voiceover, no vocals. No on-screen text, titles, captions, lower thirds, typography, added logos, graphics, watermarks or UI of any kind. Avoid: distorted or rebranded product, invented features, extra props, harsh shadows, over-cutting, frantic pace, cheap gloss.
Guardrails
Missing input → make the smallest premium assumption and fold it silently into the directive.
The product is the star; the environment and the edit exist only to serve it.
Never pad the shot count; fewer, better beats beat seven busy ones.
Specs (duration, shot ceiling, image count, aspect) are a dated snapshot — defer to any current limits the operator supplies.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: [
          {
            text: `Product: ${safeDesc}\nAtmosphere: (infer from the reference images)\n\nProduct reference images:`,
          },
          ...productImages.map((img) => ({
            inlineData: { mimeType: img.mimeType, data: img.data },
          })),
          { text: "Atmosphere reference images:" },
          ...atmosphereImages.map((img) => ({
            inlineData: { mimeType: img.mimeType, data: img.data },
          })),
        ],
        config: { systemInstruction: promptWriterSystemInstruction },
      });

      return res.json({ prompt: response.text || "" });
    } catch (e: any) {
      console.error("Error generating prompt:", e);
      const status = mapSafeStatus(e);
      if (status === 429) res.setHeader("Retry-After", "5");
      return res.status(status).json({ error: "Failed to generate video prompt." });
    } finally {
      release();
    }
  });

  app.post("/api/generate-video", async (req, res): Promise<any> => {
    const ownerKey = requireClientKey(req);
    if (!ownerKey) {
      return res.status(400).json({ error: "Missing or invalid x-client-id header." });
    }
    const release = acquireMultiRateSlot("vid", getClientIpKey(req), ownerKey, {
      ipMaxConcurrent: 2,
      ipMaxPerMinute: 6,
      clientMaxConcurrent: 2,
      clientMaxPerMinute: 4,
      globalMaxConcurrent: 12,
      globalMaxPerMinute: 36,
    });
    if (!release) {
      res.setHeader("Retry-After", "10");
      return res.status(429).json({ error: "Too many video generation requests. Please wait a moment." });
    }

    try {
      const productImages = parseValidatedImageList(req.body?.productImages, 2);
      const atmosphereImages = parseValidatedImageList(req.body?.atmosphereImages, 2);
      const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim().slice(0, 6000) : "";
      if (!productImages || !atmosphereImages || productImages.length === 0 || !prompt) {
        return res.status(400).json({ error: "Valid reference image and prompt are required." });
      }
      const ai = getAiClient();

      const interaction = await ai.interactions.create({
        model: "gemini-omni-1.2-flash",
        input: [
          ...productImages.map((img) => ({
            type: "image" as const,
            data: img.data,
            mime_type: img.mimeType,
          })),
          ...atmosphereImages.map((img) => ({
            type: "image" as const,
            data: img.data,
            mime_type: img.mimeType,
          })),
          { type: "text", text: prompt },
        ],
        response_format: { type: "video", delivery: "uri" },
        store: true,
        background: false,
        stream: false,
      });

      const outputVideo =
        (interaction as any)?.output_video ??
        (interaction as any)?.outputs?.find((o: any) => o?.type === "video");
      if (!outputVideo || !outputVideo.uri) {
        throw new Error("No video URI returned from interaction.");
      }

      const fileIdMatch = outputVideo.uri.match(/files\/([a-zA-Z0-9_-]{1,128})/);
      const rawFileId =
        fileIdMatch && !fileIdMatch[1].startsWith("environment-") ? fileIdMatch[1] : null;
      if (!rawFileId) {
        throw new Error("Invalid video file reference returned from interaction.");
      }

      const signedFileId = signOwnedFile(rawFileId, ownerKey);
      return res.json({ fileId: signedFileId });
    } catch (e: any) {
      console.error("Error generating video:", e);
      const status = mapSafeStatus(e);
      if (status === 429) res.setHeader("Retry-After", "10");
      return res.status(status).json({ error: "Failed to generate video." });
    } finally {
      release();
    }
  });

  app.get("/api/file-status/:fileId", async (req, res): Promise<any> => {
    const ownerKey = requireClientKey(req);
    if (!ownerKey) {
      return res.status(400).json({ error: "Missing or invalid x-client-id header." });
    }
    const release = acquireMultiRateSlot("poll", getClientIpKey(req), ownerKey, {
      ipMaxConcurrent: 6,
      ipMaxPerMinute: 90,
      clientMaxConcurrent: 4,
      clientMaxPerMinute: 60,
      globalMaxConcurrent: 36,
      globalMaxPerMinute: 480,
    });
    if (!release) {
      res.setHeader("Retry-After", "5");
      return res.status(429).json({ error: "Polling too quickly." });
    }

    try {
      const rawFileId = verifyOwnedFile(req.params.fileId, ownerKey);
      if (!rawFileId || !/^[a-zA-Z0-9_-]{1,128}$/.test(rawFileId) || rawFileId.startsWith("environment-")) {
        return res.status(404).json({ error: "Video file not found." });
      }
      const ai = getAiClient();
      const fInfo = await ai.files.get({ name: `files/${rawFileId}` });
      const state = (fInfo.state as any)?.name || fInfo.state;
      return res.json({ state });
    } catch (e: any) {
      console.error("Error getting file status:", e);
      return res.status(mapSafeStatus(e)).json({ error: "Failed to check file status." });
    } finally {
      release();
    }
  });

  const videoCache = new Map<string, Buffer>();

  app.get("/api/video/:fileId", async (req, res): Promise<any> => {
    const ownerKey = requireClientKey(req);
    if (!ownerKey) {
      return res.status(400).json({ error: "Missing or invalid x-client-id header." });
    }
    const release = acquireMultiRateSlot("dl", getClientIpKey(req), ownerKey, {
      ipMaxConcurrent: 4,
      ipMaxPerMinute: 48,
      clientMaxConcurrent: 4,
      clientMaxPerMinute: 36,
      globalMaxConcurrent: 24,
      globalMaxPerMinute: 240,
    });
    if (!release) {
      res.setHeader("Retry-After", "5");
      return res.status(429).json({ error: "Too many video download requests." });
    }

    try {
      const rawFileId = verifyOwnedFile(req.params.fileId, ownerKey);
      if (!rawFileId || !/^[a-zA-Z0-9_-]{1,128}$/.test(rawFileId) || rawFileId.startsWith("environment-")) {
        return res.status(404).json({ error: "Video file not found." });
      }
      let buffer = videoCache.get(rawFileId);

      if (buffer) {
        videoCache.delete(rawFileId);
        videoCache.set(rawFileId, buffer);
      } else {
        const apiKey = (process.env.GEMINI_API_KEY || "").trim();
        const url = `https://generativelanguage.googleapis.com/v1beta/files/${encodeURIComponent(rawFileId)}:download?alt=media`;
        const upstream = await fetch(url, {
          headers: { "x-goog-api-key": apiKey },
          redirect: "error",
        });
        if (!upstream.ok) {
          const errStatus = upstream.status === 404 ? 404 : upstream.status === 429 ? 429 : 500;
          return res.status(errStatus).json({ error: "Failed to fetch video." });
        }
        buffer = Buffer.from(await upstream.arrayBuffer());
        if (videoCache.size >= 12) {
          const oldest = videoCache.keys().next().value;
          if (oldest) videoCache.delete(oldest);
        }
        videoCache.set(rawFileId, buffer);
      }

      const total = buffer.length;
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      res.setHeader("Cache-Control", "private, no-store");

      const range = req.headers.range;
      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range);
        let start = match && match[1] ? parseInt(match[1], 10) : 0;
        let end = match && match[2] ? parseInt(match[2], 10) : total - 1;
        if (Number.isNaN(start)) start = 0;
        if (Number.isNaN(end) || end >= total) end = total - 1;
        if (start > end || start >= total) {
          res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
          return;
        }
        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
        res.setHeader("Content-Length", end - start + 1);
        res.end(buffer.subarray(start, end + 1));
      } else {
        res.setHeader("Content-Length", total);
        res.end(buffer);
      }
    } catch (e: any) {
      console.error("Error streaming video:", e);
      return res.status(500).json({ error: "Failed to stream video." });
    } finally {
      release();
    }
  });

  const isProductionRuntime = (): boolean =>
    process.env.NODE_ENV === "production" ||
    Boolean((process.env.K_SERVICE || "").trim()) ||
    Boolean((process.env.APP_URL || "").trim());

  app.use("/api", (_req: any, res: any) => {
    res.status(404).json({ error: "API endpoint not found." });
  });

  if (!isProductionRuntime()) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { dotfiles: "ignore" }));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
