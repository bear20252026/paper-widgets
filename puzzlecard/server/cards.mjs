// Where the sealed cards live: one opaque file per id, nothing is decrypted or inspected here — the key never
// leaves the sender's link fragment, so this store only ever holds bytes nobody on this machine can read.
//
// A directory is enough for a small site: cards are written once, read rarely, and forgotten after a while. Swap
// this module for a bucket or a KV table when the traffic asks for it; the server only calls put/get/sweep.
import { randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ID = /^[A-Za-z0-9_-]{10,32}$/; // what the client can hold: a URL-safe, 12-character base64url id

export function createStore(dir, { ttlDays = 180 } = {}) {
  mkdirSync(dir, { recursive: true });
  const ttl = ttlDays * 86_400_000;

  // Drop what has outlived the letter. Runs once at start, and now and then while the server is up: an expired
  // card is already unreadable (get checks the mtime), this only gives the disk back.
  function sweep() {
    const cut = Date.now() - ttl;
    for (const name of readdirSync(dir)) {
      try {
        if (statSync(join(dir, name)).mtimeMs < cut) unlinkSync(join(dir, name));
      } catch {
        // a card being written or read right now; the next sweep will take it
      }
    }
  }
  sweep();
  const timer = setInterval(sweep, 6 * 3600_000);
  timer.unref(); // never keeps the process alive on its own

  return {
    dir, // so the server can say where the letters are kept
    // -> id. Write to a .part name first, then rename: a reader never sees half a card.
    async put(bytes) {
      const id = randomBytes(9).toString("base64url");
      const file = join(dir, id);
      await writeFile(`${file}.part`, bytes);
      await rename(`${file}.part`, file);
      return id;
    },
    // -> Uint8Array | null. A wrong-looking id is a miss, not an error: the id comes from a URL.
    async get(id) {
      if (!ID.test(id)) return null;
      try {
        const file = join(dir, id);
        const info = await stat(file);
        if (Date.now() - info.mtimeMs > ttl) return null;
        return new Uint8Array(await readFile(file));
      } catch {
        return null;
      }
    },
    sweep,
  };
}
