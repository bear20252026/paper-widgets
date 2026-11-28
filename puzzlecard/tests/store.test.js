// The store behind /api/card: opaque bytes in, opaque bytes out, and nothing else gets through.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, utimes } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore } from "../server/cards.mjs";

const scratch = () => mkdtemp(join(tmpdir(), "puzzlecard-"));

test("put then get returns the same bytes, under a URL-safe id", async () => {
  const dir = await scratch();
  try {
    const store = createStore(dir, { ttlDays: 180 });
    const card = new Uint8Array([0x50, 0x43, 0x32, 0, 1, 2, 3, 4]);
    const id = await store.put(card);
    assert.match(id, /^[A-Za-z0-9_-]{10,32}$/);
    assert.deepEqual(await store.get(id), card);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ids that could wander off the directory are misses, not errors", async () => {
  const dir = await scratch();
  try {
    const store = createStore(dir);
    for (const bad of ["../../etc/passwd", "..", "", "x", "not an id", "a".repeat(40)]) {
      assert.equal(await store.get(bad), null, JSON.stringify(bad));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a card older than the ttl is gone, and a sweep gives the disk back", async () => {
  const dir = await scratch();
  try {
    const store = createStore(dir, { ttlDays: 1 });
    const id = await store.put(new Uint8Array([1, 2, 3]));
    const long = new Date(Date.now() - 3 * 86_400_000);
    await utimes(join(dir, id), long, long);

    assert.equal(await store.get(id), null, "expired is unreadable");
    store.sweep();
    assert.equal(await store.get(id), null);
    assert.ok(!existsSync(join(dir, id)), "and the file is gone");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
