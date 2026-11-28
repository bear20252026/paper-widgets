/**
 * src/server/genaiClient.ts — Canonical Server-Side `@google/genai` SDK Factory
 *
 * Uses AI Studio's injected `process.env.GEMINI_API_KEY` strictly on the Node.js server
 * (`vertexai: false`) with zero browser exposure.
 */

import { GoogleGenAI } from "@google/genai";

export function readServerGeminiApiKey(envRecord?: Record<string, string | undefined>): string {
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

export function createServerGenAI(apiKey?: string): GoogleGenAI {
  const resolved = String(apiKey || readServerGeminiApiKey()).trim();
  return new GoogleGenAI({ vertexai: false, apiKey: resolved });
}
