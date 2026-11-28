// The server as a visitor meets it: the page, its modules, and a card that goes in and comes out whole.
// Spawned for real, on any free port, with its own card directory — this is the test that would have caught a
// containment check that refuses to serve anything but the root page.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PIECE = fileURLToPath(new URL("../", import.meta.url));

async function startServer(dir) {
  const child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: PIECE,
    env: { ...process.env, PORT: "0", CARDS_DIR: dir },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 5000);
    child.stdout.on("data", (chunk) => {
      const found = /(http:\/\/127\.0\.0\.1:\d+)\//.exec(String(chunk));
      if (found) {
        clearTimeout(timer);
        resolve(found[1]);
      }
    });
    child.on("exit", (code) => reject(new Error(`server exited ${code}`)));
  });
  return { child, base };
}

test("the server serves the piece, refuses to climb out, and keeps a card", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "puzzlecard-cards-"));
  const { child, base } = await startServer(dir);
  t.after(async () => {
    child.kill();
    await rm(dir, { recursive: true, force: true });
  });

  // what the browser asks for on the first paint
  for (const path of ["/", "/src/game.js", "/src/cut.js", "/assets/machine-slim.png", "/assets/icons/favicon.svg"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${path} is empty`);
  }

  // ../package.json, URL-encoded so the client does not normalise it away
  assert.equal((await fetch(`${base}/..%2Fpackage.json`)).status, 403);
  assert.equal((await fetch(`${base}/nope.js`)).status, 404);

  // a card goes in and comes out byte for byte
  const card = new Uint8Array([0x50, 0x43, 0x32, 0, ...Array.from({ length: 40 }, (_, i) => i)]);
  const posted = await fetch(`${base}/api/card`, { method: "POST", body: card });
  assert.equal(posted.status, 200);
  const { id } = await posted.json();
  assert.match(id, /^[A-Za-z0-9_-]{10,32}$/);

  const got = await fetch(`${base}/api/card?id=${id}`);
  assert.equal(got.status, 200);
  assert.deepEqual(new Uint8Array(await got.arrayBuffer()), card);

  // and the two ways a card is not a card
  const notCard = await fetch(`${base}/api/card`, { method: "POST", body: new Uint8Array([1, 2, 3]) });
  assert.equal(notCard.status, 400);
  assert.equal((await fetch(`${base}/api/card?id=nope`)).status, 404);
});
