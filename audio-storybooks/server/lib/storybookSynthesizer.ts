import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import util from "node:util";
import { GoogleGenAI, Modality } from "@google/genai";

const execFileAsync = util.promisify(execFile);

const SAMPLE_RATE = 24000;
const ROMANS = ["I", "II", "III", "IV", "V", "VI"];

const VALID_GEMINI_VOICES = [
  "Kore",
  "Aoede",
  "Charon",
  "Fenrir",
  "Orus",
  "Leda",
  "Puck",
  "Zephyr",
  "Iapetus",
] as const;

export interface SynthesizeStorybookOptions {
  storybook: Record<string, any>;
  apiKey: string;
  visualStyle?: string;
  narratorVoice?: string;
  signal?: AbortSignal;
  onProgress?: (stageIndex: number, stageLabel: string, message: string) => void;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new Error("Storybook synthesis aborted");
    err.name = "AbortError";
    throw err;
  }
}

function isDataOrHostedAsset(url: unknown): boolean {
  if (typeof url !== "string" || !url.trim()) return false;
  return (
    url.startsWith("data:") ||
    url.startsWith("/api/environments/") ||
    url.startsWith("https://www.gstatic.com/")
  );
}

function escapeXml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildArchivalSvgFallbackDataUri(
  title: string,
  subtitle: string,
  palette?: Record<string, string>
): string {
  const paper = palette?.paper || "#F6F2EA";
  const card = palette?.card || "#EFE9DC";
  const ink = palette?.ink || "#1E1B18";
  const muted = palette?.muted || "#7A7267";
  const accent = palette?.accent || "#4A6B53";
  const rule = palette?.rule || "#D5CBB8";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
    <rect width="1280" height="720" fill="${escapeXml(paper)}"/>
    <rect x="48" y="42" width="1184" height="636" fill="${escapeXml(card)}" stroke="${escapeXml(rule)}" stroke-width="2"/>
    <rect x="74" y="68" width="1132" height="584" fill="${escapeXml(paper)}" stroke="${escapeXml(accent)}" stroke-opacity="0.45" stroke-width="1.5"/>
    <circle cx="640" cy="290" r="110" fill="none" stroke="${escapeXml(accent)}" stroke-opacity="0.35" stroke-width="2"/>
    <circle cx="640" cy="290" r="76" fill="none" stroke="${escapeXml(rule)}" stroke-width="1.5"/>
    <path d="M585 305 Q640 225 695 305 Z" fill="none" stroke="${escapeXml(accent)}" stroke-width="2.5"/>
    <line x1="460" y1="455" x2="820" y2="455" stroke="${escapeXml(rule)}" stroke-width="1.5"/>
    <text x="640" y="510" text-anchor="middle" fill="${escapeXml(ink)}" font-family="Georgia, serif" font-size="34" font-style="italic">${escapeXml(title.slice(0, 56))}</text>
    <text x="640" y="555" text-anchor="middle" fill="${escapeXml(muted)}" font-family="Georgia, serif" font-size="18" letter-spacing="3">${escapeXml(subtitle.slice(0, 68).toUpperCase())}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf-8").toString("base64")}`;
}

function parseDataUriImage(dataUri: string): { mimeType: string; data: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri || "");
  if (!m) return null;
  if (m[1].includes("svg")) return null;
  return { mimeType: m[1], data: m[2] };
}

async function generateIllustrationDataUri(
  ai: GoogleGenAI,
  prompt: string,
  aspectRatio: "16:9" | "4:3" | "3:4" | "1:1" = "16:9",
  referenceImage?: { mimeType: string; data: string } | null,
  signal?: AbortSignal
): Promise<string | null> {
  const candidateModels = ["gemini-3.1-flash-lite-image", "gemini-2.5-flash-image"];
  for (const model of candidateModels) {
    throwIfAborted(signal);
    try {
      const contents: any = referenceImage
        ? [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: referenceImage.mimeType, data: referenceImage.data } },
                {
                  text: `Keep the character attire, faces, linework, and warm cream archival paper (#F6F2EA) aesthetic consistent with the reference sheet above.\n\n${prompt}`,
                },
              ],
            },
          ]
        : prompt;

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseModalities: [Modality.IMAGE],
          imageConfig: { aspectRatio },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part?.inlineData?.data) {
          const mime = part.inlineData.mimeType || "image/png";
          return `data:${mime};base64,${part.inlineData.data}`;
        }
      }
    } catch (err: any) {
      if (signal?.aborted || err?.name === "AbortError") throw err;
      console.warn(`[storybookSynthesizer] Image model ${model} warning:`, err?.message || err);
    }
  }
  return null;
}

/**
 * Applies studio voice mastering matching `agent/scripts/voice_mastering.py`:
 * - Trims excessive leading/trailing digital silence (>80ms, keeping 50ms natural breath pad)
 * - 2nd-order 60 Hz Butterworth high-pass filter to remove sub-bass rumble
 * - Active-speech RMS leveling (`targetRms = 3450 / 32768`, clamped to `[0.70, 1.35]`)
 * - True-peak ceiling at `-1.5 dBFS` (`0.84`) + 15ms linear fade-in/out
 */
function masterVoiceTurnPcm16(rawPcm: Buffer, sampleRate = SAMPLE_RATE): Buffer {
  const sampleCount = Math.floor(rawPcm.length / 2);
  if (sampleCount < 64) return rawPcm;

  const samples = new Float64Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = rawPcm.readInt16LE(i * 2) / 32768.0;
  }

  // 1. Trim digital silence (>80ms threshold ~ 0.006, preserving 50ms pad)
  const silenceThreshold = 0.006;
  const padSamples = Math.floor(sampleRate * 0.05);
  let firstActive = 0;
  while (firstActive < sampleCount && Math.abs(samples[firstActive]) < silenceThreshold) {
    firstActive++;
  }
  let lastActive = sampleCount - 1;
  while (lastActive > firstActive && Math.abs(samples[lastActive]) < silenceThreshold) {
    lastActive--;
  }
  const startIdx = firstActive > Math.floor(sampleRate * 0.08) ? Math.max(0, firstActive - padSamples) : 0;
  const endIdx =
    sampleCount - 1 - lastActive > Math.floor(sampleRate * 0.08)
      ? Math.min(sampleCount, lastActive + padSamples + 1)
      : sampleCount;

  const trimmedLen = Math.max(1, endIdx - startIdx);
  const filtered = new Float64Array(trimmedLen);

  // 2. 2nd-order Butterworth 60 Hz high-pass filter
  const fc = 60.0;
  const w0 = (2.0 * Math.PI * fc) / sampleRate;
  const cosw0 = Math.cos(w0);
  const alpha = Math.sin(w0) / Math.SQRT2;
  const a0 = 1.0 + alpha;
  const b0 = (1.0 + cosw0) / 2.0 / a0;
  const b1 = -(1.0 + cosw0) / a0;
  const b2 = (1.0 + cosw0) / 2.0 / a0;
  const a1 = (-2.0 * cosw0) / a0;
  const a2 = (1.0 - alpha) / a0;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < trimmedLen; i++) {
    const x0 = samples[startIdx + i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    filtered[i] = y0;
  }

  // 3. Active-speech RMS leveling
  let sumSq = 0;
  let activeCount = 0;
  for (let i = 0; i < trimmedLen; i++) {
    const v = filtered[i];
    if (Math.abs(v) > 0.008) {
      sumSq += v * v;
      activeCount++;
    }
  }
  const rms = activeCount > 0 ? Math.sqrt(sumSq / activeCount) : 0;
  const targetRms = 3450 / 32768;
  let gain = rms > 1e-5 ? targetRms / rms : 1.0;
  gain = Math.max(0.7, Math.min(1.35, gain));

  let peak = 0;
  for (let i = 0; i < trimmedLen; i++) {
    const absV = Math.abs(filtered[i] * gain);
    if (absV > peak) peak = absV;
  }
  if (peak > 0.84) {
    gain *= 0.84 / peak;
  }

  // 4. 15ms linear fade-in/fade-out and 16-bit PCM quantization
  const fadeSamples = Math.min(Math.floor(sampleRate * 0.015), Math.floor(trimmedLen / 4));
  const out = Buffer.alloc(trimmedLen * 2);
  for (let i = 0; i < trimmedLen; i++) {
    let env = 1.0;
    if (fadeSamples > 0) {
      if (i < fadeSamples) env = i / fadeSamples;
      else if (i >= trimmedLen - fadeSamples) env = (trimmedLen - 1 - i) / fadeSamples;
    }
    const val = Math.max(-1.0, Math.min(1.0, filtered[i] * gain * env));
    out.writeInt16LE(Math.round(val * 32767), i * 2);
  }
  return out;
}

function buildWavBuffer(pcm16Mono: Buffer, sampleRate = SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44);
  const dataLen = pcm16Mono.length;
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataLen, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // Mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataLen, 40);
  return Buffer.concat([header, pcm16Mono]);
}

function normalizeVoiceName(
  rawVoice: string | undefined,
  speaker: string,
  speakerVoiceMap: Map<string, string>,
  defaultNarratorVoice: string
): string {
  if (rawVoice && (VALID_GEMINI_VOICES as readonly string[]).includes(rawVoice)) {
    speakerVoiceMap.set(speaker, rawVoice);
    return rawVoice;
  }
  const existing = speakerVoiceMap.get(speaker);
  if (existing) return existing;

  if (/narrator|storyteller/i.test(speaker)) {
    const nv = (VALID_GEMINI_VOICES as readonly string[]).includes(defaultNarratorVoice)
      ? defaultNarratorVoice
      : "Kore";
    speakerVoiceMap.set(speaker, nv);
    return nv;
  }

  const usedVoices = new Set(speakerVoiceMap.values());
  const nextVoice =
    VALID_GEMINI_VOICES.find((v) => !usedVoices.has(v) && v !== defaultNarratorVoice) ||
    VALID_GEMINI_VOICES[speakerVoiceMap.size % VALID_GEMINI_VOICES.length];
  speakerVoiceMap.set(speaker, nextVoice);
  return nextVoice;
}

async function synthesizeTurnPcm(
  ai: GoogleGenAI,
  text: string,
  voiceName: string,
  stylePrompt?: string,
  signal?: AbortSignal
): Promise<Buffer | null> {
  const cleanText = String(text || "").trim();
  if (!cleanText) return null;

  const prompt = stylePrompt
    ? `Perform with ${stylePrompt} delivery: ${cleanText}`
    : cleanText;

  const ttsModels = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];
  for (const model of ttsModels) {
    throwIfAborted(signal);
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });
      const b64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64) {
        const rawBytes = Buffer.from(b64, "base64");
        // Strip RIFF WAV header if model returned WAV instead of raw PCM
        const pcmBytes =
          rawBytes.length > 44 && rawBytes.subarray(0, 4).toString("ascii") === "RIFF"
            ? rawBytes.subarray(44)
            : rawBytes;
        return masterVoiceTurnPcm16(pcmBytes, SAMPLE_RATE);
      }
    } catch (err: any) {
      if (signal?.aborted || err?.name === "AbortError") throw err;
      console.warn(`[storybookSynthesizer] TTS model ${model} warning:`, err?.message || err);
    }
  }
  return null;
}

async function tryGenerateChamberMusicMp3(
  ai: GoogleGenAI,
  musicPrompt: string,
  signal?: AbortSignal
): Promise<Buffer | null> {
  throwIfAborted(signal);
  try {
    const fullPrompt = musicPrompt.toLowerCase().includes("instrumental")
      ? musicPrompt
      : `${musicPrompt}. Period-authentic acoustic chamber ensemble (cello, viola, fortepiano, harp), warm room acoustics, instrumental only, no vocals.`;
    const response = await ai.models.generateContent({
      model: "lyria-3-clip-preview",
      contents: fullPrompt,
      config: {
        responseModalities: [Modality.AUDIO],
      },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part?.inlineData?.data) {
        return Buffer.from(part.inlineData.data, "base64");
      }
    }
  } catch (err: any) {
    if (signal?.aborted || err?.name === "AbortError") throw err;
    console.warn("[storybookSynthesizer] Optional Lyria score skipped:", err?.message || err);
  }
  return null;
}

async function tryMixWithFfmpeg(
  speechWav: Buffer,
  lyriaMusic: Buffer | null,
  totalSec: number
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "folio-mix-"));
  try {
    const speechPath = path.join(tmpDir, "speech.wav");
    const outMp3Path = path.join(tmpDir, "master.mp3");
    fs.writeFileSync(speechPath, speechWav);

    if (lyriaMusic && lyriaMusic.length > 256) {
      const musicPath = path.join(tmpDir, "music.mp3");
      fs.writeFileSync(musicPath, lyriaMusic);
      const fadeOutStart = Math.max(0, totalSec - 1.8).toFixed(2);
      const filterComplex =
        `[1:a]volume=0.14,afade=t=in:st=0:d=1.2,afade=t=out:st=${fadeOutStart}:d=1.8[bed];` +
        `[0:a][bed]amix=inputs=2:duration=first:dropout_transition=2[out]`;
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-i",
          speechPath,
          "-stream_loop",
          "-1",
          "-i",
          musicPath,
          "-filter_complex",
          filterComplex,
          "-map",
          "[out]",
          "-c:a",
          "libmp3lame",
          "-b:a",
          "192k",
          outMp3Path,
        ],
        { timeout: 30000 }
      );
    } else {
      await execFileAsync(
        "ffmpeg",
        ["-y", "-i", speechPath, "-c:a", "libmp3lame", "-b:a", "192k", outMp3Path],
        { timeout: 25000 }
      );
    }

    if (fs.existsSync(outMp3Path)) {
      const buf = fs.readFileSync(outMp3Path);
      if (buf.length > 0) {
        return { buffer: buf, mimeType: "audio/mpeg" };
      }
    }
  } catch {
    // ffmpeg may not be installed in minimal container images; pure-PCM WAV fallback handles this cleanly
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
  return null;
}

/**
 * Pure-PCM warm acoustic chamber chord bed mixed gently beneath the Title Card (0..5.4s),
 * inter-folio transitions, and musical outro (ducked automatically whenever speech is active).
 */
function mixChamberHarmonicPadPcm16(speechPcm: Buffer, sampleRate = SAMPLE_RATE): Buffer {
  const totalSamples = Math.floor(speechPcm.length / 2);
  const out = Buffer.alloc(speechPcm.length);
  // Warm D-major / G-major pastoral chamber fifths & thirds (D3, A3, F#4, D4)
  const freqs = [146.83, 220.0, 293.66, 369.99];
  const weights = [0.42, 0.28, 0.18, 0.12];
  const fadeInSamples = Math.floor(sampleRate * 1.2);
  const fadeOutSamples = Math.floor(sampleRate * 1.8);
  const introEndSamples = Math.floor(sampleRate * 5.2);

  let envFollower = 0;
  for (let i = 0; i < totalSamples; i++) {
    const dry = speechPcm.readInt16LE(i * 2) / 32768.0;
    const absDry = Math.abs(dry);
    envFollower = absDry > envFollower ? envFollower * 0.992 + absDry * 0.008 : envFollower * 0.9995;

    const t = i / sampleRate;
    let pad = 0;
    for (let f = 0; f < freqs.length; f++) {
      const slowSwell = 0.85 + 0.15 * Math.sin(2 * Math.PI * (0.11 + f * 0.03) * t);
      pad += weights[f] * slowSwell * Math.sin(2 * Math.PI * freqs[f] * t);
    }

    let fade = 1.0;
    if (i < fadeInSamples) fade = i / fadeInSamples;
    else if (i > totalSamples - fadeOutSamples) fade = Math.max(0, (totalSamples - i) / fadeOutSamples);

    // Richer chamber presence during opening title card & outro, subtle -26dB bed under spoken prose
    const baseLevel = i < introEndSamples || i > totalSamples - Math.floor(sampleRate * 2.2) ? 0.055 : 0.018;
    const duckFactor = 1.0 / (1.0 + envFollower * 14.0);
    const mixed = Math.max(-0.96, Math.min(0.96, dry + pad * fade * baseLevel * duckFactor));
    out.writeInt16LE(Math.round(mixed * 32767), i * 2);
  }
  return out;
}

/**
 * Generates missing illustrations, multi-voice dramatized narration turns, chamber music score,
 * and synchronized master audiobook track strictly on the Node server using `apiKey`.
 */
export async function synthesizeStorybookMediaOnServer(
  opts: SynthesizeStorybookOptions
): Promise<Record<string, any>> {
  const apiKey = (opts.apiKey || "").trim();
  if (!apiKey) {
    throw new Error("Server GEMINI_API_KEY is required for storybook media synthesis.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const book = { ...opts.storybook };
  const pages: any[] = Array.isArray(book.pages) ? book.pages.map((p: any) => ({ ...p })) : [];
  const defaultStyle =
    opts.visualStyle ||
    book.visualStyle ||
    "1810s Regency fine dip-pen sepia ink line drawing with delicate muted watercolour wash on warm cream archival paper (#F6F2EA)";
  const defaultNarratorVoice = opts.narratorVoice || "Kore";

  // ── STAGE III: Illustrations (Character Reference Sheet + Scene Plates + Cover) ──
  const needsCharSheet = !isDataOrHostedAsset(book.charSheetImageUrl);
  const pagesMissingImg = pages.some((p) => !isDataOrHostedAsset(p.imageUrl));

  if (needsCharSheet || pagesMissingImg) {
    opts.onProgress?.(
      2,
      "Stage III · Engraving 16:9 Archival Watercolour Plates (gemini-3.1-flash-lite-image)",
      "Stage III · Generating 16:9 Character Reference Sheet & Scene Plates server-side..."
    );
  }

  let charSheetDataUrl: string | undefined = isDataOrHostedAsset(book.charSheetImageUrl)
    ? book.charSheetImageUrl
    : undefined;

  if (!charSheetDataUrl) {
    const rawCharPrompt =
      book.charSheetPrompt ||
      book.char_sheet_prompt ||
      "Two storybook protagonists standing in three-quarter profile facing each other in period attire";
    const fullCharPrompt = `${rawCharPrompt}. Minimalist editorial book illustration character reference sheet on clean warm cream archival paper (#F6F2EA). ${defaultStyle}. Pure flat 2D archival plate, no text, no borders, no watermarks.`;
    charSheetDataUrl =
      (await generateIllustrationDataUri(ai, fullCharPrompt, "16:9", null, opts.signal)) ||
      undefined;
    if (charSheetDataUrl) {
      book.charSheetImageUrl = charSheetDataUrl;
    }
  }

  const charRefInline = charSheetDataUrl ? parseDataUriImage(charSheetDataUrl) : null;

  // Deduplicate scene plate prompts so folios sharing a scene reuse the same plate cleanly
  const scenePromptCache = new Map<string, Promise<string>>();
  await Promise.all(
    pages.map(async (page, idx) => {
      if (isDataOrHostedAsset(page.imageUrl)) return;
      const pnum = page.pageNumber || idx + 1;
      const rawPrompt =
        page.illustrationPrompt ||
        page.scenePrompt ||
        page.imageCaption ||
        page.narrativeText ||
        book.title ||
        "Storybook scene";
      const cacheKey = `${page.sceneIdx ?? idx}::${String(rawPrompt).trim().slice(0, 240)}`;

      let platePromise = scenePromptCache.get(cacheKey);
      if (!platePromise) {
        platePromise = (async () => {
          const fullScenePrompt = `${rawPrompt}. ${defaultStyle}. Flat 2D fine-press book illustration directly on warm cream archival paper (#F6F2EA) filling the 16:9 frame edge-to-edge, no text, no typography, no borders.`;
          const generated = await generateIllustrationDataUri(
            ai,
            fullScenePrompt,
            "16:9",
            charRefInline,
            opts.signal
          );
          return (
            generated ||
            charSheetDataUrl ||
            buildArchivalSvgFallbackDataUri(
              book.title || "Illustrated Folio",
              page.imageCaption || `Plate ${ROMANS[idx] || pnum}`,
              book.palette
            )
          );
        })();
        scenePromptCache.set(cacheKey, platePromise);
      }

      const resolvedPlateUrl = await platePromise;
      const rom = ROMANS[idx] || String(pnum);
      const caption = page.imageCaption || `Scene ${rom}`;
      page.imageUrl = resolvedPlateUrl;
      page.imageDataUrl = resolvedPlateUrl;
      page.dioramaUrl = resolvedPlateUrl;
      page.plates = [
        {
          plateNumberRoman: rom,
          plateLabel: `PLATE ${rom} OF ${ROMANS[Math.max(0, pages.length - 1)] || "III"}`,
          title: caption,
          illustrationPrompt: rawPrompt,
          imageUrl: resolvedPlateUrl,
          imageDataUrl: resolvedPlateUrl,
        },
        ...(charSheetDataUrl
          ? [
              {
                plateNumberRoman: "I",
                plateLabel: "CHARACTER SHEET",
                title: "Character Reference Sheet",
                illustrationPrompt: book.charSheetPrompt || "",
                imageUrl: charSheetDataUrl,
                imageDataUrl: charSheetDataUrl,
              },
            ]
          : []),
      ];
    })
  );

  if (!charSheetDataUrl && pages[0]?.imageUrl) {
    book.charSheetImageUrl = pages[0].imageUrl;
  }

  if (!isDataOrHostedAsset(book.coverImageUrl)) {
    const coverImg = pages[0]?.imageUrl || book.charSheetImageUrl || buildArchivalSvgFallbackDataUri(book.title || "Folio Edition", book.subtitle || "Chapter I", book.palette);
    book.coverImageUrl = coverImg;
    book.coverImageDataUrl = coverImg;
  }

  // ── STAGE IV: Multi-Voice Dramatized Narration TTS (24 kHz) ──
  const alreadyHasMasterAudio = isDataOrHostedAsset(book.masterAudioUrl);
  if (!alreadyHasMasterAudio && pages.length > 0) {
    const speakerVoiceMap = new Map<string, string>();
    if (Array.isArray(book.characters)) {
      for (const c of book.characters) {
        if (c?.name && c?.voiceName && (VALID_GEMINI_VOICES as readonly string[]).includes(c.voiceName)) {
          speakerVoiceMap.set(String(c.name), String(c.voiceName));
        }
      }
    }

    interface TurnJob {
      pageIdx: number;
      lineIdx: number;
      text: string;
      voiceName: string;
      stylePrompt?: string;
      isDialogue: boolean;
    }

    const jobs: TurnJob[] = [];
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const p = pages[pIdx];
      const rawLines =
        Array.isArray(p.dialogueLines) && p.dialogueLines.length > 0
          ? p.dialogueLines
          : [
              {
                speaker: "Narrator",
                speakerLabel: "NARRATOR",
                voiceRoleLabel: "Literary Narration",
                isDialogue: false,
                voiceName: defaultNarratorVoice,
                text: p.narrativeText || book.title || "",
              },
            ];
      p.dialogueLines = rawLines.map((line: any) => {
        const spk = String(line.speaker || "Narrator");
        const vName = normalizeVoiceName(line.voiceName, spk, speakerVoiceMap, defaultNarratorVoice);
        return { ...line, speaker: spk, voiceName: vName };
      });
      for (let lIdx = 0; lIdx < p.dialogueLines.length; lIdx++) {
        const l = p.dialogueLines[lIdx];
        jobs.push({
          pageIdx: pIdx,
          lineIdx: lIdx,
          text: String(l.ttsText || l.text || ""),
          voiceName: l.voiceName,
          stylePrompt: l.stylePrompt,
          isDialogue: Boolean(l.isDialogue),
        });
      }
    }

    opts.onProgress?.(
      3,
      "Stage IV · Synthesizing & Mastering 24 kHz Multi-Voice Turns (gemini-3.1-flash-tts-preview)",
      `Stage IV · Synthesizing ${jobs.length} multi-voice narration & dialogue turns at 24 kHz...`
    );

    const musicPrompt =
      book.musicPrompt ||
      `${book.genreFooterLeft || "Classical literary"} chamber music for ${book.title || "storybook"}`;
    const musicPromise = tryGenerateChamberMusicMp3(ai, musicPrompt, opts.signal);

    const pcmResults = new Array<Buffer | null>(jobs.length).fill(null);
    let cursorIdx = 0;
    const concurrency = Math.min(4, Math.max(1, jobs.length));
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (cursorIdx < jobs.length) {
          const jIdx = cursorIdx++;
          const job = jobs[jIdx];
          pcmResults[jIdx] = await synthesizeTurnPcm(
            ai,
            job.text,
            job.voiceName,
            job.stylePrompt,
            opts.signal
          );
        }
      })
    );

    // ── STAGE V: Timeline Assembly & Chamber Score Mastering ──
    opts.onProgress?.(
      4,
      "Stage V · Scoring Chamber Ensemble & Binding Folios (lyria-3-clip-preview)",
      "Stage V · Mixing chamber score and binding synchronized folio timeline..."
    );

    const titleCardEndSec = 2.6;
    const openingUnfoldSec = 2.8; // First turn starts at 5.4s, matching App.tsx ensureBookTimeline
    const titleAndUnfoldSilence = Buffer.alloc(
      Math.round((titleCardEndSec + openingUnfoldSec) * SAMPLE_RATE) * 2,
      0
    );

    const masterChunks: Buffer[] = [titleAndUnfoldSilence];
    let elapsedSamples = Math.floor(titleAndUnfoldSilence.length / 2);
    let jobCursor = 0;
    let synthesizedTurnCount = 0;

    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const page = pages[pIdx];
      const folioStartSec = pIdx === 0 ? titleCardEndSec : Number((elapsedSamples / SAMPLE_RATE).toFixed(3));
      if (pIdx > 0) {
        const pageTurnSilence = Buffer.alloc(Math.round(0.85 * SAMPLE_RATE) * 2, 0);
        masterChunks.push(pageTurnSilence);
        elapsedSamples += Math.floor(pageTurnSilence.length / 2);
      }

      const pageChunks: Buffer[] = [];
      for (let lIdx = 0; lIdx < page.dialogueLines.length; lIdx++) {
        const line = page.dialogueLines[lIdx];
        const pcm = pcmResults[jobCursor++];
        const startSec = Number((elapsedSamples / SAMPLE_RATE).toFixed(3));

        let turnPcm: Buffer;
        if (pcm && pcm.length > 0) {
          turnPcm = pcm;
          synthesizedTurnCount++;
          const lineWav = buildWavBuffer(pcm, SAMPLE_RATE);
          line.audioDataUrl = `data:audio/wav;base64,${lineWav.toString("base64")}`;
        } else {
          const estSec = Math.max(2.2, Math.round(String(line.text || "").length / 15));
          turnPcm = Buffer.alloc(Math.round(estSec * SAMPLE_RATE) * 2, 0);
        }

        const durSec = Number((turnPcm.length / 2 / SAMPLE_RATE).toFixed(3));
        masterChunks.push(turnPcm);
        pageChunks.push(turnPcm);
        elapsedSamples += Math.floor(turnPcm.length / 2);

        const endSec = Number((elapsedSamples / SAMPLE_RATE).toFixed(3));
        line.durationSeconds = durSec;
        line.startSec = startSec;
        line.endSec = endSec;

        const pauseSec = line.isDialogue ? 0.36 : 0.48;
        const pauseBuf = Buffer.alloc(Math.round(pauseSec * SAMPLE_RATE) * 2, 0);
        masterChunks.push(pauseBuf);
        pageChunks.push(pauseBuf);
        elapsedSamples += Math.floor(pauseBuf.length / 2);
      }

      const folioTail = Buffer.alloc(Math.round(0.4 * SAMPLE_RATE) * 2, 0);
      masterChunks.push(folioTail);
      elapsedSamples += Math.floor(folioTail.length / 2);

      const folioEndSec = Number((elapsedSamples / SAMPLE_RATE).toFixed(3));
      page.startSec = folioStartSec;
      page.endSec = folioEndSec;
      page.durationSeconds = Number((folioEndSec - folioStartSec).toFixed(2));

      if (pageChunks.length > 0 && synthesizedTurnCount > 0) {
        const pageWav = buildWavBuffer(Buffer.concat(pageChunks), SAMPLE_RATE);
        page.audioDataUrl = `data:audio/wav;base64,${pageWav.toString("base64")}`;
        page.audioUrl = page.audioDataUrl;
      }
    }

    const outroSilence = Buffer.alloc(Math.round(2.0 * SAMPLE_RATE) * 2, 0);
    masterChunks.push(outroSilence);
    elapsedSamples += Math.floor(outroSilence.length / 2);

    const totalDurationSeconds = Number((elapsedSamples / SAMPLE_RATE).toFixed(2));
    book.titleCardEndSec = titleCardEndSec;
    book.totalDurationSeconds = totalDurationSeconds;

    const lyriaMp3 = await musicPromise;
    if (lyriaMp3 && lyriaMp3.length > 256) {
      const musicDataUri = `data:audio/mpeg;base64,${lyriaMp3.toString("base64")}`;
      book.backgroundMusicUrl = musicDataUri;
      book.backgroundMusicDataUrl = musicDataUri;
    }

    if (synthesizedTurnCount > 0) {
      const rawMasterPcm = Buffer.concat(masterChunks);
      const rawMasterWav = buildWavBuffer(rawMasterPcm, SAMPLE_RATE);
      const ffmpegMixed = await tryMixWithFfmpeg(rawMasterWav, lyriaMp3, totalDurationSeconds);

      let masterDataUri: string;
      if (ffmpegMixed) {
        masterDataUri = `data:${ffmpegMixed.mimeType};base64,${ffmpegMixed.buffer.toString("base64")}`;
      } else {
        const withChamberPad = mixChamberHarmonicPadPcm16(rawMasterPcm, SAMPLE_RATE);
        const masterWav = buildWavBuffer(withChamberPad, SAMPLE_RATE);
        masterDataUri = `data:audio/wav;base64,${masterWav.toString("base64")}`;
      }

      book.masterAudioUrl = masterDataUri;
      book.fullAudiobookUrl = masterDataUri;
      book.fullAudiobookDataUrl = masterDataUri;
    }
  }

  book.pages = pages;
  return book;
}
