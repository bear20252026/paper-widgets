import * as THREE from "three";

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function finish(c: HTMLCanvasElement, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, fn: () => THREE.Texture) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key)!;
}

/** Warm stone floor tiles */
export function floorTexture() {
  return cached("floor", () => {
    const [c, g] = makeCanvas(512, 512);
    const r = rand(7);
    const n = 4;
    const s = 512 / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const l = 62 + r() * 10;
        g.fillStyle = `hsl(34, 42%, ${l}%)`;
        g.fillRect(x * s, y * s, s, s);
        for (let i = 0; i < 40; i++) {
          g.fillStyle = `hsla(30, 40%, ${40 + r() * 30}%, 0.08)`;
          g.beginPath();
          g.arc(x * s + r() * s, y * s + r() * s, r() * 20, 0, Math.PI * 2);
          g.fill();
        }
      }
    g.strokeStyle = "rgba(90,60,30,0.6)";
    g.lineWidth = 4;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo(i * s, 0);
      g.lineTo(i * s, 512);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i * s);
      g.lineTo(512, i * s);
      g.stroke();
    }
    return finish(c, 5, 5);
  });
}

/** Plaster + brick wall */
export function brickTexture() {
  return cached("brick", () => {
    const [c, g] = makeCanvas(512, 512);
    const r = rand(13);
    g.fillStyle = "#c9a77a";
    g.fillRect(0, 0, 512, 512);
    const bh = 32;
    const bw = 96;
    for (let row = 0; row < 512 / bh; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < 512 + bw; x += bw) {
        const l = 62 + r() * 12;
        g.fillStyle = `hsl(33, 38%, ${l}%)`;
        g.fillRect(x + off + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
    g.strokeStyle = "rgba(80,55,30,0.55)";
    g.lineWidth = 2;
    for (let row = 0; row < 512 / bh; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < 512 + bw; x += bw) {
        g.strokeRect(x + off + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
    return finish(c, 2, 2);
  });
}

/** Wood grain */
export function woodTexture(dark = false) {
  return cached("wood" + dark, () => {
    const [c, g] = makeCanvas(256, 256);
    const r = rand(dark ? 3 : 5);
    g.fillStyle = dark ? "#4a2f1c" : "#8a5a33";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const x = r() * 256;
      g.strokeStyle = dark
        ? `rgba(20,10,5,${0.15 + r() * 0.25})`
        : `rgba(60,30,10,${0.1 + r() * 0.25})`;
      g.lineWidth = 1 + r() * 2;
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y <= 256; y += 16) g.lineTo(x + Math.sin(y * 0.05 + i) * 3, y);
      g.stroke();
    }
    return finish(c, 1, 1);
  });
}

/** Persian-style rug */
export function rugTexture() {
  return cached("rug", () => {
    const [c, g] = makeCanvas(512, 512);
    g.fillStyle = "#8a4a2a";
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = "#b8784a";
    g.fillRect(24, 24, 464, 464);
    g.fillStyle = "#7a3a22";
    g.fillRect(48, 48, 416, 416);
    g.strokeStyle = "#e0b078";
    g.lineWidth = 6;
    g.strokeRect(60, 60, 392, 392);
    g.lineWidth = 3;
    g.strokeRect(80, 80, 352, 352);
    // diamond motifs
    g.fillStyle = "#c98c58";
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const cx = 128 + x * 85.3;
        const cy = 128 + y * 85.3;
        g.beginPath();
        g.moveTo(cx, cy - 26);
        g.lineTo(cx + 26, cy);
        g.lineTo(cx, cy + 26);
        g.lineTo(cx - 26, cy);
        g.closePath();
        g.fill();
        g.strokeStyle = "#5a2a18";
        g.lineWidth = 2;
        g.stroke();
      }
    // border zigzag
    g.strokeStyle = "#e8c090";
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = 30 + i * (452 / 24);
      g.lineTo(x, i % 2 ? 32 : 42);
    }
    g.stroke();
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = 30 + i * (452 / 24);
      g.lineTo(x, i % 2 ? 470 : 480);
    }
    g.stroke();
    return finish(c, 1, 1);
  });
}

/** House banner with lion */
export function bannerTexture() {
  return cached("banner", () => {
    const [c, g] = makeCanvas(256, 512);
    g.fillStyle = "#8c2a1e";
    g.fillRect(0, 0, 256, 512);
    g.fillStyle = "#c9a15a";
    g.fillRect(0, 0, 256, 18);
    g.fillRect(14, 0, 8, 512);
    g.fillRect(234, 0, 8, 512);
    // chequered top
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 6; x++) {
        if ((x + y) % 2) continue;
        g.fillStyle = "#d8b878";
        g.fillRect(22 + x * 35, 30 + y * 30, 35, 30);
      }
    // lion silhouette (stylised rampant)
    g.fillStyle = "#e0b45a";
    g.save();
    g.translate(128, 300);
    g.beginPath();
    g.ellipse(0, 0, 40, 70, 0.2, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(18, -78, 32, 0, Math.PI * 2);
    g.fill();
    g.fillRect(-40, 40, 22, 80);
    g.fillRect(10, 40, 22, 80);
    g.fillRect(30, -40, 60, 18);
    g.fillRect(-70, -20, 40, 16);
    g.beginPath();
    g.moveTo(-30, 60);
    g.quadraticCurveTo(-110, 40, -80, -40);
    g.lineWidth = 10;
    g.strokeStyle = "#e0b45a";
    g.stroke();
    g.restore();
    // pointed bottom fade
    g.fillStyle = "#c9a15a";
    g.fillRect(0, 494, 256, 18);
    return finish(c, 1, 1);
  });
}

/** Owl feather speckle */
export function featherTexture(base: string, speck: string) {
  return cached("feather" + base + speck, () => {
    const [c, g] = makeCanvas(256, 256);
    const r = rand(base.length * 31 + speck.length);
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = speck;
      g.globalAlpha = 0.35 + r() * 0.5;
      const x = r() * 256;
      const y = r() * 256;
      g.beginPath();
      g.ellipse(x, y, 2 + r() * 3, 1.2 + r() * 1.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    return finish(c, 1, 1);
  });
}

/** Damask pattern for vest */
export function vestTexture() {
  return cached("vest", () => {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = "#6b2f2c";
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#86413b";
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const cx = x * 32 + (y % 2 ? 16 : 0);
        const cy = y * 32 + 16;
        g.beginPath();
        g.moveTo(cx, cy - 8);
        g.lineTo(cx + 6, cy);
        g.lineTo(cx, cy + 8);
        g.lineTo(cx - 6, cy);
        g.fill();
      }
    return finish(c, 3, 3);
  });
}
