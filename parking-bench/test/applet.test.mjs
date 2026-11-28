import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  MAX_BODY_BYTES,
  acquireRateLimitSlot,
  extractBase64Png,
  extractClientIpKey,
  extractMovesBatch,
  handleRaceApiRequest,
  isAllowedRequestOrigin,
  redactSecrets,
  resetRateLimitsForTest,
  sanitizeMoveEchoText,
  stripTrailingMoveJson,
  synthesizeDecisionMoves,
} from "../src/server/raceApiHandler.mjs";
import { GCS_ASSET_BASE_URL } from "../src/assets/assetLoader.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("metadata.json satisfies strict gallery character caps and capability flags", () => {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "metadata.json"), "utf8"));
  assert.equal(meta.name, "Parking Bench");
  assert.ok(meta.name.length < 20, `name length ${meta.name.length} must be < 20`);
  assert.ok(meta.description.length > 20 && meta.description.length < 150, `description length ${meta.description.length} must be < 150`);
  assert.deepEqual(meta.requestFramePermissions, []);
  assert.ok(Array.isArray(meta.majorCapabilities));
  assert.ok(meta.majorCapabilities.includes("MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"));
});

test("raceApiHandler parses multi-move batches, strips trailing JSON, and redacts secrets", () => {
  const raw = [
    "• Row 3 scan: Red coupe at B3-C3, vertical SUV blocking D3.",
    "• Move sequence: Slide D3 UP 1, then exit B3 RIGHT 5.",
    '{"moves":[{"car_coord":"D3","direction":"UP","cells":1},{"car_coord":"B3","direction":"RIGHT","cells":5}],"summary":"Clear D3 and exit."}',
  ].join("\n");

  const stripped = stripTrailingMoveJson(raw);
  assert.ok(!stripped.includes('"moves"'));
  assert.ok(stripped.includes("Row 3 scan"));

  const batch = extractMovesBatch(raw);
  assert.equal(batch.moves.length, 2);
  assert.equal(batch.moves[0].car_coord, "D3");
  assert.equal(batch.moves[1].isExit, true);

  assert.equal(
    sanitizeMoveEchoText("D3 -> UP 1 -> moved 0 cells; B3 RIGHT 5 -> exited"),
    "D3 UP 1 -> bumped (0 cells moved); B3 RIGHT 5 -> exited"
  );

  const synth = synthesizeDecisionMoves({
    is_exit_clear: { noul: 0.91, confidence: 0.95 },
    red_coupe_col: { choice: "B", confidence: 0.96 },
  });
  assert.equal(synth.moves.length, 1);
  assert.equal(synth.moves[0].car_coord, "B3");
  assert.equal(synth.moves[0].isExit, true);

  const fakeKey = "AIza" + "SyDummyKeyForUnitTestRedaction00000";
  assert.equal(redactSecrets(`err: ${fakeKey}`), "err: [REDACTED_KEY]");
});

test("externalized GCS asset base URL is public HTTPS storage.googleapis.com", () => {
  assert.ok(GCS_ASSET_BASE_URL.startsWith("https://storage.googleapis.com/aistudio-applet-demos-assets/parking-bench/"));
});

function createMockResponse() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.writableEnded = false;
  res.chunks = [];
  res.writeHead = (status, headers = {}) => {
    res.statusCode = status;
    for (const [k, v] of Object.entries(headers)) {
      res.headers[k.toLowerCase()] = v;
    }
  };
  res.write = (chunk) => {
    res.chunks.push(String(chunk));
    return true;
  };
  res.end = (chunk) => {
    if (chunk !== undefined) res.chunks.push(String(chunk));
    res.writableEnded = true;
    queueMicrotask(() => res.emit("finish"));
  };
  return res;
}

test("/api/health returns minimal status without leaking config metadata", async () => {
  const req = { method: "GET", url: "/api/health", headers: {} };
  const res = createMockResponse();
  const handled = await handleRaceApiRequest(req, res, { GEMINI_API_KEY: "AIzaDummySecret123456" });
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.chunks.join(""));
  assert.deepEqual(body, { status: "ok" });
  assert.equal("keyConfigured" in body, false);
  assert.equal("models" in body, false);
});

test("origin validation enforces allowlist and sec-fetch-site fallback with 401 never 403", async () => {
  assert.equal(isAllowedRequestOrigin({ headers: {} }), false);
  assert.equal(isAllowedRequestOrigin({ headers: { "sec-fetch-site": "cross-site" } }), false);
  assert.equal(isAllowedRequestOrigin({ headers: { "sec-fetch-site": "same-origin" } }), true);
  assert.equal(isAllowedRequestOrigin({ headers: { origin: "null" } }), false);
  assert.equal(isAllowedRequestOrigin({ headers: { origin: "https://evil.example.com" } }), false);
  assert.equal(isAllowedRequestOrigin({ headers: { origin: "https://aistudio.google.com" } }), true);
  assert.equal(
    isAllowedRequestOrigin({
      headers: { origin: "https://parking-bench-99c2eaae-853813963450.us-east1.run.app" },
    }),
    true
  );

  const req = {
    method: "POST",
    url: "/api/race/plan",
    headers: { origin: "https://evil.example.com", "x-client-id": "client_12345678" },
  };
  const res = createMockResponse();
  const handled = await handleRaceApiRequest(req, res, {});
  assert.equal(handled, true);
  assert.equal(res.statusCode, 401);
});

test("rate limiter strips internal XFF hops and enforces concurrency + Retry-After 429", async () => {
  resetRateLimitsForTest();
  assert.equal(
    extractClientIpKey({
      headers: { "x-forwarded-for": "203.0.113.9, 10.1.2.3, 127.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" },
    }),
    "203.0.113.9"
  );

  const releases = [];
  for (let i = 0; i < 4; i += 1) {
    const rel = acquireRateLimitSlot("203.0.113.9", 1000 + i);
    assert.ok(rel);
    releases.push(rel);
  }
  assert.equal(acquireRateLimitSlot("203.0.113.9", 1010), null);

  const req = {
    method: "POST",
    url: "/api/race/plan",
    headers: {
      origin: "https://aistudio.google.com",
      "x-forwarded-for": "203.0.113.9, 127.0.0.1",
      "x-client-id": "client_12345678",
    },
  };
  const res = createMockResponse();
  await handleRaceApiRequest(req, res, {});
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["retry-after"], "60");

  for (const rel of releases) rel();
  const postRelease = acquireRateLimitSlot("203.0.113.9", 2000);
  assert.ok(postRelease);
  postRelease();
  resetRateLimitsForTest();
});

test("extractBase64Png enforces PNG signature and 413 defers req.destroy until finish", async () => {
  // Fake non-PNG payload wrapped in a PNG data URL
  const notPng = Buffer.from("<html>not a png at all, sorry</html>" + "A".repeat(48)).toString("base64");
  assert.equal(extractBase64Png(`data:image/png;base64,${notPng}`), "");
  assert.equal(extractBase64Png(`data:image/jpeg;base64,${notPng}`), "");

  // Valid PNG magic header + IHDR chunk (960x720)
  const hdr = Buffer.alloc(36, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(hdr, 0);
  hdr.writeUInt32BE(13, 8);
  hdr.write("IHDR", 12, "ascii");
  hdr.writeUInt32BE(960, 16);
  hdr.writeUInt32BE(720, 20);
  const validPngB64 = Buffer.concat([hdr, Buffer.alloc(32, 1)]).toString("base64");
  assert.equal(extractBase64Png(`data:image/png;base64,${validPngB64}`), validPngB64);

  // 413 handling must pause before flush and destroy only after res finishes
  resetRateLimitsForTest();
  const events = [];
  const req = new EventEmitter();
  req.method = "POST";
  req.url = "/api/race/plan";
  req.headers = {
    origin: "https://aistudio.google.com",
    "x-client-id": "client_12345678",
    "x-forwarded-for": "198.51.100.7",
  };
  req.pause = () => events.push("pause");
  req.destroy = () => events.push("destroy");

  const res = createMockResponse();
  res.on("finish", () => events.push("finish"));

  const pending = handleRaceApiRequest(req, res, { GEMINI_API_KEY: "AIzaDummySecret123456" });
  queueMicrotask(() => {
    req.emit("data", Buffer.alloc(MAX_BODY_BYTES + 128, 0x41));
  });
  await pending;
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(res.statusCode, 413);
  assert.equal(res.headers.connection, "close");
  assert.deepEqual(events, ["pause", "finish", "destroy"]);
  resetRateLimitsForTest();
});
