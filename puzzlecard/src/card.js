// Puzzle Card: the SHORT link. Everything a puzzle needs is kept by the site, encrypted HERE first, and the link is only
//   /?c=<id>#k=<key>                                           (~70 characters, however long the letter)
// - the card holds the settings and the letter, and your own photo if you used one (a sample photo is named by its
//   number, so a sample card is a few hundred bytes)
// - a fresh random AES-GCM key seals it; the sealed bytes go to the site (api/card.js), the key only into the link's
//   #fragment, which browsers never send to a server. So the site keeps bytes nobody can read, letter included.
// Card bytes:  "PC2" · type (0 none, 1 webp, 2 jpeg) · 12-byte IV · ciphertext of [4-byte length · settings JSON · photo]
// The first cards (11/20, "PC1") held only a photo, with the settings in the link (#p=…&k=…); they still open.
const TYPES = { 1: 'image/webp', 2: 'image/jpeg' };
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

function blobOf(canvas, type, q) { return new Promise((res) => canvas.toBlob(res, type, q)); }

// the photo as a file of at most ~1 MB: 1200 px, then smaller steps only if a picture is unusually heavy
async function encodePhoto(source) {
  const w = source.width, h = source.height;
  for (const [side, q] of [[1200, 0.82], [1200, 0.7], [960, 0.7], [800, 0.65]]) {
    const k = Math.min(1, side / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    let b = await blobOf(c, 'image/webp', q);
    if (!b || b.type !== 'image/webp') b = await blobOf(c, 'image/jpeg', q + 0.05);   // Safari cannot write WebP
    if (b && b.size < 1_000_000) return b;
  }
  throw new Error('photo too heavy');
}

// seal and keep: the settings (with the letter) and, for your own photo, the photo. Resolves to { id, key }.
export async function storeCard(state, photoSource) {
  const json = new TextEncoder().encode(JSON.stringify(state));
  const photo = photoSource ? await encodePhoto(photoSource) : null;
  const pic = photo ? new Uint8Array(await photo.arrayBuffer()) : new Uint8Array(0);
  const plain = new Uint8Array(4 + json.length + pic.length);
  new DataView(plain.buffer).setUint32(0, json.length); plain.set(json, 4); plain.set(pic, 4 + json.length);
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 128 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const body = new Uint8Array(16 + sealed.length);
  body.set([0x50, 0x43, 0x32], 0); body[3] = !photo ? 0 : photo.type === 'image/webp' ? 1 : 2; body.set(iv, 4); body.set(sealed, 16);
  const r = await fetch('/api/card', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body });
  if (!r.ok) throw new Error('upload ' + r.status);
  const { id } = await r.json();
  return { id, key: b64url(new Uint8Array(await crypto.subtle.exportKey('raw', key))) };
}

function imageFrom(bytes, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = url; });
}

// the other end: fetch the card, open it with the key from the link. Resolves to { state, image } — state is null
// for a first-version card (its settings are in the link), image is null for a sample photo.
export async function loadCard(id, keyText) {
  const r = await fetch('/api/card?id=' + encodeURIComponent(id));
  if (!r.ok) throw new Error('card ' + r.status);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf[0] !== 0x50 || buf[1] !== 0x43 || (buf[2] !== 0x31 && buf[2] !== 0x32)) throw new Error('not a card');
  const key = await crypto.subtle.importKey('raw', unb64url(keyText), { name: 'AES-GCM' }, false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(4, 16) }, key, buf.slice(16)));
  if (buf[2] === 0x31) return { state: null, image: await imageFrom(plain, TYPES[buf[3]] || 'image/jpeg') };
  const n = new DataView(plain.buffer).getUint32(0), state = JSON.parse(new TextDecoder().decode(plain.slice(4, 4 + n)));
  return { state, image: TYPES[buf[3]] ? await imageFrom(plain.slice(4 + n), TYPES[buf[3]]) : null };
}
