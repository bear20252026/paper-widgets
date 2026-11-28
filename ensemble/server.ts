import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIVE_WS_URL = 'wss://generativelanguage.googleapis.com/v1beta/interactions/live';

const DANGEROUS_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'httpOptions',
  'http_options',
  'abortSignal',
  'abort_signal',
  'cachedContent',
  'cached_content',
  'fileSearch',
  'file_search',
  'fileSearchStoreNames',
  'file_search_store_names',
  'corpora',
  'fileData',
  'file_data',
  'environment',
  'previous_interaction_id',
  'previousInteractionId',
]);

function stripHttpOptions(val) {
  if (!val || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(stripHttpOptions);
  const out = {};
  for (const [k, v] of Object.entries(val)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    out[k] = stripHttpOptions(v);
  }
  return out;
}

function isAllowedWsOrigin(req) {
  const origin = req?.headers?.origin;
  if (!origin || typeof origin !== 'string') {
    return req?.headers?.['sec-fetch-site'] === 'same-origin';
  }
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    if (!process.env.K_SERVICE && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return true;
    }
    return (
      hostname.endsWith('-853813963450.us-east1.run.app') ||
      hostname.endsWith('-853813963450.us-west1.run.app') ||
      hostname === 'ai.studio' ||
      hostname.endsWith('.ai.studio')
    );
  } catch {
    return false;
  }
}


const DIRECTOR_SYS = `You are the music director for a real-time audio-video world model (Genie 4). Rewrite the draft into ONE vivid paragraph (90-140 words) that will be its world prompt.
Keep every instrument, voice, genre, tempo, venue and mood from the draft. Prioritise SOUND: name each instrument's role (bass, rhythm, harmony, melody, solo), the groove and tempo, dynamics, the mix and acoustic space, and a musical arc across one minute (intro → build → peak → resolve).
Also describe what the camera sees: the musicians playing those exact instruments on that stage, lighting, slow camera moves. Present tense. No lists, no markdown, no quotation marks, no dialogue or lyrics.`;

const PLACEHOLDER_KEYS = new Set(['GEMINI_API_KEY', 'YOUR_API_KEY', 'API_KEY']);

function resolveApiKey(reqKey?: string) {
  const trimmed = typeof reqKey === 'string' ? reqKey.trim() : '';
  if (trimmed && !PLACEHOLDER_KEYS.has(trimmed)) return trimmed;
  const envKey = (process.env.API_KEY || process.env.GEMINI_API_KEY || '').trim();
  return PLACEHOLDER_KEYS.has(envKey) ? '' : envKey;
}

function getAI(apiKey: string) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function safeHttpStatus(status: number): number {
  if (status === 403) return 401;
  if (status === 502 || status === 503 || status === 504) return 500;
  return status >= 400 && status < 600 ? status : 500;
}

function extractGeminiError(err: any, fallbackMessage: string): { status: number; message: string } {
  const rawMessage =
    typeof err?.message === 'string'
      ? err.message.replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]')
      : '';
  const status = typeof err?.status === 'number' ? err.status : 500;
  const lower = rawMessage.toLowerCase();

  if (lower.includes('requested entity was not found') || status === 404) {
    return {
      status: 404,
      message: rawMessage || 'Requested entity was not found. Please select a valid paid Gemini API key.',
    };
  }
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthenticated')
  ) {
    return {
      status: status === 403 ? 403 : 401,
      message: rawMessage || 'Invalid or unauthorized Gemini API key.',
    };
  }
  if (status === 429 || lower.includes('resource_exhausted')) {
    return {
      status: 429,
      message: 'Gemini API rate limit exceeded. Please try again shortly.',
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage || fallbackMessage,
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 2);
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ limit: '4mb', extended: true }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = stripHttpOptions(req.body);
    }
    next();
  });

  app.get('/api/key-status', (_req, res) => {
    res.json({ hasKey: Boolean(resolveApiKey()) });
  });

  app.post('/api/direct', async (req, res) => {
    const draft = typeof req.body?.draft === 'string' ? req.body.draft.trim() : '';
    if (!draft) {
      res.status(400).json({ error: { message: 'Missing draft prompt' } });
      return;
    }

    const apiKey = resolveApiKey(req.get('x-gemini-api-key') || req.body?.apiKey);
    if (!apiKey) {
      res.status(401).json({ error: { code: 401, message: 'Missing Gemini API key. Please select a paid API key.' } });
      return;
    }

    const models = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'];
    let lastError: any = null;

    for (const model of models) {
      try {
        const ai = getAI(apiKey);
        const interaction = await ai.interactions.create({
          model,
          input: draft,
          system_instruction: DIRECTOR_SYS,
          generation_config: {
            temperature: 0.9,
            max_output_tokens: 2048,
          },
        });

        let text = '';
        for (const step of interaction.steps || []) {
          if (step.type === 'model_output') {
            for (const part of step.content || []) {
              if (part.type === 'text' && part.text) {
                text += part.text;
              }
            }
          }
        }
        if (!text && interaction.output_text) {
          text = interaction.output_text;
        }
        text = text.trim();
        if (text.split(/\s+/).length < 25) {
          throw new Error('director reply too short');
        }
        res.json({ text });
        return;
      } catch (err) {
        console.error('Direct request failed:', err);
        lastError = err;
      }
    }

    const mapped = extractGeminiError(lastError, 'Director request failed. Please try again.');
    res.status(safeHttpStatus(mapped.status)).json({ error: { code: mapped.status, message: mapped.message } });
  });

  app.post('/api/sticker', async (req, res) => {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) {
      res.status(400).json({ error: { message: 'Missing sticker prompt' } });
      return;
    }

    const apiKey = resolveApiKey(req.get('x-gemini-api-key') || req.body?.apiKey);
    if (!apiKey) {
      res.status(401).json({ error: { code: 401, message: 'Missing Gemini API key. Please select a paid API key.' } });
      return;
    }

    const models = ['gemini-3.1-flash-lite-image', 'gemini-nano-banana-2.1'];
    let lastError: any = null;

    for (const model of models) {
      try {
        const ai = getAI(apiKey);
        const interaction = await ai.interactions.create({
          model,
          input: prompt,
          response_modalities: ['image'],
          generation_config: {
            image_config: {
              aspect_ratio: '1:1',
            },
          },
        });

        const img = interaction.output_image;
        if (img?.data) {
          res.json({ data: img.data, mimeType: img.mime_type || 'image/png' });
          return;
        }

        for (const step of interaction.steps || []) {
          if (step.type === 'model_output') {
            const imagePart = step.content?.find((c) => c.type === 'image');
            if (imagePart && 'data' in imagePart && imagePart.data) {
              res.json({
                data: imagePart.data,
                mimeType: imagePart.mime_type || 'image/png',
              });
              return;
            }
          }
        }

        throw new Error('no image returned');
      } catch (err) {
        console.error('Sticker request failed:', err);
        lastError = err;
      }
    }

    const mapped = extractGeminiError(lastError, 'Sticker generation failed. Please try again.');
    res.status(safeHttpStatus(mapped.status)).json({ error: { code: mapped.status, message: mapped.message } });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = req.url ? req.url.split('?')[0] : '';
    if (pathname === '/api/live') {
      if (!isAllowedWsOrigin(req)) {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        wss.emit('connection', clientWs, req);
      });
    }
  });

  wss.on('connection', (clientWs, req) => {
    const queryString = req?.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
    const clientKey = new URLSearchParams(queryString).get('key') || '';
    const apiKey = resolveApiKey(clientKey);
    if (!apiKey) {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            event_type: 'error',
            error: { code: 401, message: 'Missing Gemini API key. Please select a paid API key.' },
          })
        );
        clientWs.close(1011, 'Missing API key');
      }
      return;
    }

    const pendingMessages: Array<{ data: any; isBinary: boolean }> = [];
    const upstreamWs = new WebSocket(`${LIVE_WS_URL}?key=${encodeURIComponent(apiKey)}`);
    let sentHandshakeError = false;

    upstreamWs.on('open', () => {
      while (pendingMessages.length > 0 && upstreamWs.readyState === WebSocket.OPEN) {
        const msg = pendingMessages.shift();
        if (msg) {
          upstreamWs.send(msg.data, { binary: msg.isBinary });
        }
      }
    });

    upstreamWs.on('message', (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    upstreamWs.on('unexpected-response', (_req, upstreamRes) => {
      const status = upstreamRes.statusCode || 500;
      let body = '';
      upstreamRes.on('data', (chunk) => {
        if (body.length < 2048) body += chunk.toString('utf8');
      });
      upstreamRes.on('end', () => {
        sentHandshakeError = true;
        let msg = `Upstream Live API rejected connection (${status}).`;
        try {
          const parsed = JSON.parse(body);
          if (parsed?.error?.message) msg = parsed.error.message;
        } catch {
          if (body.trim()) msg = body.trim().slice(0, 300);
        }
        msg = msg.replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]');
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              event_type: 'error',
              error: { code: status, message: msg },
            })
          );
          clientWs.close(1011, msg.slice(0, 120));
        }
      });
    });

    upstreamWs.on('error', (err) => {
      if (err instanceof Error) {
        if (typeof err.message === 'string') {
          err.message = err.message.replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]');
        }
        if (typeof err.stack === 'string') {
          err.stack = err.stack.replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]');
        }
      }
      console.error('Upstream Live WebSocket error:', err);
      if (!sentHandshakeError && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            event_type: 'error',
            error: { message: 'Upstream Live API connection error' },
          })
        );
      }
    });

    upstreamWs.on('close', (code, reason) => {
      const rawReason = reason ? reason.toString().replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]') : '';
      if (typeof code === 'number' && code !== 1000 && code !== 1005) {
        console.error(`Upstream Live WebSocket closed abnormally (code ${code})${rawReason ? `: ${rawReason}` : ''}`);
      }
      if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
        const safeCode =
          typeof code === 'number' && code >= 1000 && code <= 4999 && code !== 1005 && code !== 1006
            ? code
            : 1000;
        try {
          clientWs.close(safeCode, rawReason ? rawReason.slice(0, 120) : undefined);
        } catch (err) {
          console.error('Failed to close client Live WebSocket:', err);
          clientWs.close();
        }
      }
    });

    clientWs.on('message', (data, isBinary) => {
      let forwardedData: string | Buffer | ArrayBuffer | Buffer[] = data;
      try {
        const text =
          typeof data === 'string'
            ? data
            : Buffer.isBuffer(data)
              ? data.toString('utf8')
              : Array.isArray(data)
                ? Buffer.concat(data).toString('utf8')
                : Buffer.from(data).toString('utf8');
        const normalizedText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
        const parsed = JSON.parse(normalizedText);
        if (parsed && typeof parsed === 'object') {
          const clean = stripHttpOptions(parsed);
          if (clean.event_type === 'interaction.create') {
            clean.model = 'genie-4';
            delete clean.agent;
          }
          const sanitizedJson = JSON.stringify(clean);
          forwardedData = msgIsBinary(isBinary) ? Buffer.from(sanitizedJson, 'utf8') : sanitizedJson;
        }
      } catch {
        // not JSON, forward as-is
      }
      if (upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.send(forwardedData, { binary: msgIsBinary(isBinary) });
      } else if (upstreamWs.readyState === WebSocket.CONNECTING) {
        pendingMessages.push({ data: forwardedData, isBinary: msgIsBinary(isBinary) });
      }
    });

    clientWs.on('close', () => {
      if (upstreamWs.readyState === WebSocket.OPEN || upstreamWs.readyState === WebSocket.CONNECTING) {
        try {
          upstreamWs.close(1000);
        } catch (err) {
          console.error('Failed to close upstream Live WebSocket cleanly:', err);
          upstreamWs.terminate();
        }
      }
    });

    clientWs.on('error', (err) => {
      console.error('Client Live WebSocket error:', err);
      if (upstreamWs.readyState === WebSocket.OPEN || upstreamWs.readyState === WebSocket.CONNECTING) {
        upstreamWs.terminate();
      }
    });
  });

  app.all('/server.cjs', (_req, res) => res.status(404).end());
  app.all('/server.cjs.map', (_req, res) => res.status(404).end());

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ensemble server listening on http://0.0.0.0:${PORT}`);
  });
}

function msgIsBinary(isBinary) {
  return Boolean(isBinary);
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
