// The one server this piece needs: the files, and /api/card so a letter can travel as a short link.
// Node's own http, fs and crypto — no dependencies, which is also why the piece needs no build.
//
//   npm start                 http://127.0.0.1:5173 (dev)
//   HOST=0.0.0.0 PORT=8080 npm start        on a host, behind whatever proxy you like
//   CARDS_DIR=/var/cards CARD_TTL_DAYS=180   where the sealed cards go, and how long they are kept
//
// The app asks for /api/card relative to its own root, so serve it at the root of a host (this server does). On a
// static host with no API there is no failure to handle: the client puts the whole puzzle in the link instead.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./cards.mjs";

// fileURLToPath keeps the trailing separator; drop it so the containment check has one clean prefix to compare
// against (`startsWith(ROOT + sep)`, not `startsWith(ROOT + sep + sep)`).
const ROOT = fileURLToPath(new URL("../", import.meta.url)).replace(/[\\/]+$/, "");
const PORT = Number(process.env.PORT ?? 5173);
const HOST = process.env.HOST ?? "127.0.0.1";
const MAX_BODY = 2 * 1024 * 1024; // the client caps a photo at 1 MB; everything else on a card is small

const CARDS_DIR = process.env.CARDS_DIR
  ? resolve(process.env.CARDS_DIR)
  : fileURLToPath(new URL("../.data/cards/", import.meta.url));

const cards = createStore(CARDS_DIR, {
  ttlDays: Number(process.env.CARD_TTL_DAYS ?? 180),
});

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const json = (res, status, body) =>
  res
    .writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" })
    .end(JSON.stringify(body));

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("too large"), { status: 413 });
    chunks.push(chunk);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

// POST seals a card, GET opens it. The bytes are opaque here: "PC1"/"PC2", a type byte, an IV, ciphertext.
async function apiCard(req, res, url) {
  if (req.method === "POST") {
    let bytes;
    try {
      bytes = await readBody(req);
    } catch (error) {
      return json(res, error.status ?? 400, { error: error.message });
    }
    if (bytes.length < 16 || bytes[0] !== 0x50 || bytes[1] !== 0x43 || (bytes[2] !== 0x31 && bytes[2] !== 0x32)) {
      return json(res, 400, { error: "not a card" });
    }
    return json(res, 200, { id: await cards.put(bytes) });
  }
  if (req.method === "GET" || req.method === "HEAD") {
    const bytes = await cards.get(url.searchParams.get("id") ?? "");
    if (!bytes) return json(res, 404, { error: "not found" });
    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": bytes.length,
      // a card is written once and never changes, but an id is a secret-ish handle: keep it out of shared caches
      "cache-control": "private, max-age=3600",
    });
    return res.end(req.method === "HEAD" ? undefined : bytes);
  }
  res.writeHead(405, { allow: "GET, HEAD, POST", "content-type": "text/plain" }).end("method not allowed");
}

async function serveFile(req, res, pathname) {
  const rel = decodeURIComponent(pathname).replace(/^[/\\]+/, "");
  let file = join(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403, { "content-type": "text/plain" }).end("forbidden");
    return;
  }
  if (pathname.endsWith("/")) file = join(file, "index.html");
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    file = join(file, "index.html");
    info = await stat(file).catch(() => null);
  }
  if (!info?.isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
    return;
  }
  const body = await readFile(file);
  res.writeHead(200, {
    "content-type": types[extname(file).toLowerCase()] ?? "application/octet-stream",
    "content-length": body.length,
    "cache-control": "no-cache",
  });
  res.end(req.method === "HEAD" ? undefined : body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (url.pathname === "/api/card") return await apiCard(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.writeHead(405, { allow: "GET, HEAD", "content-type": "text/plain" }).end("method not allowed");
    }
    return await serveFile(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" }).end("server error");
    else res.end();
  }
});

server
  .listen(PORT, HOST, () => {
    // PORT may be 0 (any free port) — print the one that was actually taken, the tests read it from here
    const port = server.address().port;
    console.log(`puzzlecard: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${port}/`);
    console.log(`cards:      ${CARDS_DIR} · kept ${process.env.CARD_TTL_DAYS ?? 180} days`);
  })
  .on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`port ${PORT} is busy — try: PORT=${PORT + 1} npm start`);
      process.exit(1);
    }
    throw error;
  });
