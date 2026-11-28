import { CELL, MOUTHS, POSES, makeBandAtlas, type Kind } from './art';

const atlas = new Map<Kind, HTMLCanvasElement>();
export function atlasCanvas(kind: Kind): HTMLCanvasElement {
  if (!atlas.has(kind)) atlas.set(kind, makeBandAtlas(kind));
  return atlas.get(kind)!;
}

const urls = new Map<string, string>();
/** single sprite cell as a data-URL (used by the HTML UI, 2x for crispness) */
export function portraitURL(kind: Kind, pose = 1, mouth = 1, scale = 2): string {
  const key = `${kind}:${pose}:${mouth}:${scale}`;
  if (urls.has(key)) return urls.get(key)!;
  const src = atlasCanvas(kind);
  const c = document.createElement('canvas');
  c.width = CELL * scale;
  c.height = CELL * scale;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(src, (pose * MOUTHS + mouth) * CELL, 0, CELL, CELL, 0, 0, CELL * scale, CELL * scale);
  const url = c.toDataURL();
  urls.set(key, url);
  return url;
}

export function frameFor(beat: number, div: number, mouth: number) {
  const pi = Math.abs(Math.floor(beat * div)) % POSES;
  return { frame: pi * MOUTHS + Math.min(MOUTHS - 1, Math.max(0, mouth)), pose: pi };
}
