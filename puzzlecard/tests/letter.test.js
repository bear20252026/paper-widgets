// The letter and the link: three kinds of link open, and all of them have to come back exactly.
import test from "node:test";
import assert from "node:assert/strict";

// packLink and parseLink read the page's own address; give them one to read.
globalThis.location = { origin: "https://cards.test", pathname: "/", hash: "", search: "" };
const { hasLetter, packLink, parseLink } = await import("../src/letter.js");

const setAddress = (search = "", hash = "") => {
  globalThis.location.search = search;
  globalThis.location.hash = hash;
};

test("hasLetter notices any one of the three parts", () => {
  assert.equal(hasLetter(null), false);
  assert.equal(hasLetter({ to: " ", body: "", from: "" }), false);
  assert.equal(hasLetter({ to: "Mila", body: "", from: "" }), true);
  assert.equal(hasLetter({ to: "", body: "hello", from: "" }), true);
  assert.equal(hasLetter({ to: "", body: "", from: "Yuxuan" }), true);
});

test("a kept card makes the short link: ?c=<id>#k=<key>", () => {
  setAddress();
  const card = { id: "abc123def456", key: "c2VhbGVk" };
  assert.equal(packLink({ n: 20, f: 0 }, null, card), "https://cards.test/?c=abc123def456#k=c2VhbGVk");
});

test("the short link opens as a card, with nothing else in it", () => {
  setAddress("?c=abc123def456", "#k=c2VhbGVk");
  assert.deepEqual(parseLink(), {
    state: null,
    image: null,
    card: { id: "abc123def456", key: "c2VhbGVk" },
  });
});

test("with no card, the whole puzzle rides in the fragment and comes back the same", () => {
  setAddress();
  const state = { v: 1, n: 20, f: 0, d: 11, s: 3, to: "Mila", body: "你好，\n世界", from: "Yuxuan", g: 0 };
  const url = packLink(state, null);
  const [before, hash] = url.split("#");
  assert.match(before, /^https:\/\/cards\.test\/\?$|^https:\/\/cards\.test\/$/);
  assert.match(hash, /^p=[A-Za-z0-9_-]+$/);

  setAddress("", "#" + hash);
  const opened = parseLink();
  assert.deepEqual(opened.state, state);
  assert.equal(opened.image, null);
  assert.equal(opened.card, null);
});

test("an own photo travels beside the puzzle in the fragment", () => {
  const dataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
  const url = packLink({ n: 9 }, dataUrl);
  setAddress("", "#" + url.split("#")[1]);
  const opened = parseLink();
  assert.deepEqual(opened.state, { n: 9 });
  // the fragment drops base64 padding; atob reads it back all the same
  assert.equal(opened.image, dataUrl.replace(/=+$/, ""));
});

test("a malformed fragment opens nothing rather than throwing", () => {
  setAddress("", "#p=not-json");
  assert.equal(parseLink(), null);
  setAddress("?c=abc123def456", "");
  assert.equal(parseLink(), null); // an id without a key is not a link
  setAddress();
  assert.equal(parseLink(), null);
});
