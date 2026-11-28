// The letter on the back of the print. It is drawn once into a canvas the size of the print (alpha = ink);
// the renderer samples it on the back face, so each piece carries its own part of the handwriting.
// System handwriting faces only (no download): Latin first, then the Chinese hand-written ones.
export const HAND = '"Bradley Hand", "Noteworthy", "Hannotate SC", "HanziPen SC", "Kaiti SC", "Segoe Print", "Comic Sans MS", cursive';
// shared with the writing overlay, so what you type sits where it will be printed
export const LAYOUT = { mx: 0.08, my: 0.09, size: 0.062, leading: 1.45 };

export function hasLetter(l) { return !!(l && (l.body.trim() || l.to.trim() || l.from.trim())); }

const CJK = '\\u2E80-\\u9FFF\\uF900-\\uFAFF\\uFF00-\\uFFEF\\u3000-\\u303F';
const TOKENS = new RegExp(`[${CJK}]|[^\\s${CJK}]+|\\s+`, 'g');
// words wrap as words, Chinese wraps per character
function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const t of para.match(TOKENS) || []) {
      if (line.trim() && ctx.measureText(line + t).width > maxW) { lines.push(line.trimEnd()); line = /^\s+$/.test(t) ? '' : t; }
      else line += t;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function renderLetter(l, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const mx = W * LAYOUT.mx, my = H * LAYOUT.my, maxW = W - 2 * mx;
  const greet = l.to.trim() ? `Dear ${l.to.trim()},` : '';
  const sign = l.from.trim() ? `— ${l.from.trim()}` : '';
  // the size you wrote at; a long letter shrinks until it fits the card
  let fs = H * LAYOUT.size, lh = 0, lines = [];
  for (let i = 0; i < 14; i++) {
    ctx.font = `${fs}px ${HAND}`; lh = fs * LAYOUT.leading;
    lines = [];
    if (greet) lines.push(greet, '');
    lines.push(...wrap(ctx, l.body.trim(), maxW));
    if ((lines.length + (sign ? 1.5 : 0)) * lh <= H - 2 * my) break;
    fs *= 0.92;
  }
  ctx.fillStyle = '#000'; ctx.textBaseline = 'top';
  let y = my;
  for (const ln of lines) { ctx.fillText(ln, mx, y); y += lh; }
  if (sign) { ctx.textAlign = 'right'; ctx.fillText(sign, W - mx, H - my - lh); }
  c.lines = [my / H, lh / H, lines.length];   // where the lines sit (top, pitch, count): the renderer writes them in one by one
  return c;
}

// ---- the link: everything the recipient needs travels in the URL's hash (which is never sent to a server) ----
const toB64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64 = (str) => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
// card: { id, key } of everything kept (encrypted) by the site — the short link: /?c=<id>#k=<key>.
// Without one (the site could not keep it), the settings and letter ride in the link (#p=…), and an own photo too (&i=…: long).
export function packLink(state, imageDataUrl, card) {
  if (card) return location.origin + location.pathname + '?c=' + card.id + '#k=' + card.key;
  let hash = 'p=' + toB64(new TextEncoder().encode(JSON.stringify(state)));
  if (imageDataUrl) hash += '&i=' + imageDataUrl.split(',')[1].replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return location.origin + location.pathname + '#' + hash;
}
// Three kinds of link open: /?c=<id>#k=<key> (state is in the card: state null), /?c=<id>#p=…&k=… (first cards: photo in
// the card, state in the link), and #p=…[&i=…] (no card).
export function parseLink() {
  const q = new URLSearchParams(location.hash.slice(1));
  const c = new URLSearchParams(location.search).get('c'), k = q.get('k');
  if (!q.get('p')) return c && k ? { state: null, image: null, card: { id: c, key: k } } : null;
  try {
    const state = JSON.parse(new TextDecoder().decode(fromB64(q.get('p'))));
    const i = q.get('i');
    return { state, image: i ? 'data:image/jpeg;base64,' + i.replace(/-/g, '+').replace(/_/g, '/') : null, card: c && k ? { id: c, key: k } : null };
  } catch { return null; }
}
