// The sealed card: what goes on the wire is "PC2" + type + IV + ciphertext, and it has to open with the key alone.
import test from "node:test";
import assert from "node:assert/strict";

const realFetch = globalThis.fetch;
test.after(() => {
  globalThis.fetch = realFetch;
});

const { storeCard, loadCard } = await import("../src/card.js");

// A stand-in for the site's /api/card: it keeps the bytes it is handed, and gives them back by id.
function fakeApi() {
  let kept = null;
  globalThis.fetch = async (url, init) => {
    if (init?.method === "POST") {
      kept = new Uint8Array(init.body);
      return { ok: true, json: async () => ({ id: "testcard01" }) };
    }
    assert.match(String(url), /^\/api\/card\?id=testcard01$/);
    const copy = kept.buffer.slice(kept.byteOffset, kept.byteOffset + kept.byteLength);
    return { ok: true, arrayBuffer: async () => copy };
  };
  return () => kept;
}

test("storeCard seals {settings, letter} with a fresh key; loadCard opens it with the link's key", async () => {
  const kept = fakeApi();
  const state = { v: 1, n: 20, f: 0, d: 11, s: 3, to: "Mila", body: "你好，世界", from: "Yuxuan", g: 0 };

  const card = await storeCard(state, null);
  assert.equal(card.id, "testcard01");
  assert.match(card.key, /^[A-Za-z0-9_-]+$/);

  const bytes = kept();
  assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2]), "PC2");
  assert.equal(bytes[3], 0, "no photo, so type 0");
  assert.ok(bytes.length > 16 + 12, "IV and ciphertext are there");

  const opened = await loadCard(card.id, card.key);
  assert.deepEqual(opened, { state, image: null });
});

test("a card that is not a card is refused, and a wrong key does not open it", async () => {
  const kept = fakeApi();
  const card = await storeCard({ n: 9 }, null);

  await assert.rejects(() => loadCard(card.id, "AAAAAAAAAAAA"), "wrong key must not open the card");

  kept()[2] = 0x30; // "PC0"
  await assert.rejects(() => loadCard(card.id, card.key), /not a card/);
});

test("storeCard reports a failed upload instead of handing back half a link", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 507 });
  await assert.rejects(() => storeCard({ n: 9 }, null), /upload 507/);
});
