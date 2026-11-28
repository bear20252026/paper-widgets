import * as THREE from 'three';

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d')! };
}

function toTexture(canvas: HTMLCanvasElement, srgb = true) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Vertical gradient (v=0 bottom -> v=1 top) */
export function verticalGradient(stops: Array<[number, string]>, w = 64, h = 256) {
  const { canvas, ctx } = makeCanvas(w, h);
  const grad = ctx.createLinearGradient(0, h, 0, 0);
  for (const [pos, color] of stops) grad.addColorStop(pos, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return toTexture(canvas);
}

/**
 * 1024x1024 UV-mapped painterly game-style anime face texture for the sculpted head sphere.
 * Standard Three.js SphereGeometry UV mapping:
 * - Front center (+Z) corresponds to u = 0.25 (after rotating sphere -PI/2 around Y, +Z is u = 0.5!)
 *   We will rotate the head geometry by -Math.PI/2 around Y so that +Z (front center of face)
 *   maps cleanly to u = 0.5, and equator (y = 0) maps to v = 0.5 (canvas y = 512)!
 */
export function animeFaceTexture() {
  // True 2:1 equirectangular canvas (2048 x 1024) so spherical UV pixels are 1:1 isotropic!
  const W = 2048;
  const H = 1024;
  const { canvas, ctx } = makeCanvas(W, H);

  // 1. Rich warm porcelain anime skin gradient (never washed out under studio lights)
  const skinGrad = ctx.createLinearGradient(0, 0, 0, H);
  skinGrad.addColorStop(0.0, '#f3cfc1');
  skinGrad.addColorStop(0.38, '#fbdcd0');
  skinGrad.addColorStop(0.58, '#f9d8cb');
  skinGrad.addColorStop(0.82, '#efc6b7');
  skinGrad.addColorStop(1.0, '#e2b3a2');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(0, 0, W, H);

  // Front center (+Z) maps to u = 0.5 -> cx = 1024; equator maps to cy = 512
  const cx = 1024;

  // 2. Soft cheek, temple & jawline sculptural shading
  const drawBlush = (x: number, y: number, rx: number, ry: number, alpha: number, color = '246, 128, 144') => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${color}, ${alpha})`);
    g.addColorStop(0.6, `rgba(${color}, ${alpha * 0.45})`);
    g.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Rosy anime cheeks below outer corners of eyes
  drawBlush(cx - 135, 586, 78, 42, 0.34);
  drawBlush(cx + 135, 586, 78, 42, 0.34);
  // Subtle cheekbone warmth & nose tip glow
  drawBlush(cx, 594, 24, 18, 0.18, '238, 134, 138');
  // Subtle shadow under front hairline & temples
  drawBlush(cx, 330, 210, 56, 0.16, '175, 130, 142');
  // Soft jawline & under-chin sculptural contour
  drawBlush(cx, 748, 110, 42, 0.24, '196, 134, 124');

  // 3. Delicate nose bridge & tip shading (aligned with 3D sculpted nose at cy = 590)
  ctx.save();
  const noseShade = ctx.createRadialGradient(cx + 8, 598, 2, cx + 8, 598, 22);
  noseShade.addColorStop(0, 'rgba(188, 122, 110, 0.42)');
  noseShade.addColorStop(1, 'rgba(188, 122, 110, 0)');
  ctx.fillStyle = noseShade;
  ctx.beginPath();
  ctx.arc(cx + 8, 598, 22, 0, Math.PI * 2);
  ctx.fill();
  const noseHi = ctx.createRadialGradient(cx - 2, 588, 0, cx - 2, 588, 11);
  noseHi.addColorStop(0, 'rgba(255, 252, 250, 0.65)');
  noseHi.addColorStop(1, 'rgba(255, 252, 250, 0)');
  ctx.fillStyle = noseHi;
  ctx.beginPath();
  ctx.arc(cx - 2, 588, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Expressive Soulful Anime Eyes (true 1:1 spherical proportions, centered at cy = 522)
  const drawEye = (side: -1 | 1) => {
    const ex = cx + side * 116;
    const ey = 522;

    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(side, 1); // local +X points outward toward ear

    // Soft rose-peach eyeshadow framing upper lid & outer corner
    const shadowG = ctx.createRadialGradient(8, -14, 10, 8, -8, 78);
    shadowG.addColorStop(0, 'rgba(212, 116, 134, 0.42)');
    shadowG.addColorStop(0.65, 'rgba(222, 138, 150, 0.18)');
    shadowG.addColorStop(1, 'rgba(222, 138, 150, 0)');
    ctx.fillStyle = shadowG;
    ctx.beginPath();
    ctx.ellipse(8, -10, 74, 44, -0.06, 0, Math.PI * 2);
    ctx.fill();

    // Big graceful almond eye aperture (full, serene anime proportions like Reference Image 1!)
    const eyePath = () => {
      ctx.beginPath();
      ctx.moveTo(-54, 7); // inner tear duct
      ctx.bezierCurveTo(-34, -36, 24, -40, 60, -5); // arched upper lid
      ctx.bezierCurveTo(42, 30, -22, 32, -54, 7); // soft lower lid
      ctx.closePath();
    };

    ctx.save();
    eyePath();
    ctx.clip();

    // Sclera gradient with soft cool upper lid shadow
    const sclGrad = ctx.createLinearGradient(0, -38, 0, 34);
    sclGrad.addColorStop(0, '#b8cadc');
    sclGrad.addColorStop(0.28, '#eaf1f8');
    sclGrad.addColorStop(0.70, '#ffffff');
    sclGrad.addColorStop(1, '#f4e4e6');
    ctx.fillStyle = sclGrad;
    ctx.fillRect(-70, -48, 140, 96);

    // Subtle tear-duct rose glow
    const ductG = ctx.createRadialGradient(-50, 7, 0, -50, 7, 18);
    ductG.addColorStop(0, 'rgba(232, 135, 146, 0.72)');
    ductG.addColorStop(1, 'rgba(232, 135, 146, 0)');
    ctx.fillStyle = ductG;
    ctx.fillRect(-66, -16, 38, 42);

    // Big Luminous Emerald-Jade Iris
    const ix = -2;
    const iy = 1;
    const ir = 31;

    const irisGrad = ctx.createRadialGradient(ix, iy + 4, 4, ix, iy, ir);
    irisGrad.addColorStop(0, '#072428');
    irisGrad.addColorStop(0.30, '#0e5456');
    irisGrad.addColorStop(0.60, '#1fa694');
    irisGrad.addColorStop(0.84, '#6cf2d4');
    irisGrad.addColorStop(0.95, '#104448');
    irisGrad.addColorStop(1, '#08242a');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(ix, iy, ir * 0.94, ir * 1.04, 0, 0, Math.PI * 2);
    ctx.fill();

    // Radiant lower-crescent aqua jewel reflection inside the iris
    const jewelGrad = ctx.createRadialGradient(ix, iy + 15, 2, ix, iy + 15, 20);
    jewelGrad.addColorStop(0, 'rgba(195, 255, 246, 0.96)');
    jewelGrad.addColorStop(0.55, 'rgba(92, 240, 218, 0.62)');
    jewelGrad.addColorStop(1, 'rgba(60, 200, 190, 0)');
    ctx.fillStyle = jewelGrad;
    ctx.beginPath();
    ctx.ellipse(ix, iy + 14, 21, 12.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Deep glossy pupil
    ctx.fillStyle = '#051c22';
    ctx.beginPath();
    ctx.ellipse(ix, iy - 1, 12.5, 13.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Soft upper eyelid shadow across top 32% of iris
    const lidShade = ctx.createLinearGradient(0, -34, 0, 6);
    lidShade.addColorStop(0, 'rgba(12, 32, 46, 0.68)');
    lidShade.addColorStop(0.55, 'rgba(16, 44, 56, 0.24)');
    lidShade.addColorStop(1, 'rgba(16, 44, 56, 0)');
    ctx.fillStyle = lidShade;
    ctx.fillRect(-64, -40, 128, 48);

    // Crisp dual anime catchlights
    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.beginPath();
    ctx.ellipse(ix - 10, iy - 10, 7.6, 6.4, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(215, 255, 252, 0.90)';
    ctx.beginPath();
    ctx.arc(ix + 11, iy + 10, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // end eye clip

    // Bold, graceful tapered upper eyelash arch with winged outer flick
    ctx.fillStyle = '#14202b';
    ctx.beginPath();
    ctx.moveTo(-56, 7);
    ctx.bezierCurveTo(-34, -42, 26, -46, 68, -8);
    ctx.quadraticCurveTo(75, -10, 78, -16);
    ctx.quadraticCurveTo(68, -2, 58, -1);
    ctx.bezierCurveTo(24, -30, -32, -30, -54, 7);
    ctx.closePath();
    ctx.fill();

    // Fine lower outer lash shading
    ctx.strokeStyle = 'rgba(54, 48, 62, 0.56)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(4, 28);
    ctx.quadraticCurveTo(36, 25, 58, 0);
    ctx.stroke();

    // Delicate double-eyelid crease line above upper lash
    ctx.strokeStyle = 'rgba(156, 98, 94, 0.62)';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-42, -20);
    ctx.bezierCurveTo(-14, -48, 28, -50, 58, -24);
    ctx.stroke();

    // Refined soft teal-brown arched eyebrow
    ctx.fillStyle = 'rgba(32, 92, 96, 0.86)';
    ctx.beginPath();
    ctx.moveTo(-48, -58);
    ctx.bezierCurveTo(-14, -72, 24, -72, 66, -50);
    ctx.bezierCurveTo(26, -61, -14, -61, -48, -50);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  drawEye(-1);
  drawEye(1);

  // 5. Serene, elegant rose-coral anime lips (gentle wide natural contour at cy = 672)
  ctx.save();
  const ly = 672;
  const lipGrad = ctx.createRadialGradient(cx, ly + 3, 6, cx, ly + 3, 62);
  lipGrad.addColorStop(0, 'rgba(216, 96, 114, 0.86)');
  lipGrad.addColorStop(0.58, 'rgba(232, 128, 142, 0.68)');
  lipGrad.addColorStop(1, 'rgba(244, 174, 180, 0)');
  ctx.fillStyle = lipGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 56, ly + 1);
  ctx.quadraticCurveTo(cx - 22, ly - 13, cx, ly - 6);
  ctx.quadraticCurveTo(cx + 22, ly - 13, cx + 56, ly + 1);
  ctx.quadraticCurveTo(cx + 26, ly + 22, cx, ly + 21);
  ctx.quadraticCurveTo(cx - 26, ly + 22, cx - 56, ly + 1);
  ctx.closePath();
  ctx.fill();

  // Delicate serene lip parting line with softly lifted corners
  ctx.strokeStyle = 'rgba(146, 58, 72, 0.62)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 48, ly + 1);
  ctx.quadraticCurveTo(cx, ly + 7, cx + 48, ly + 1);
  ctx.stroke();

  // Soft lower-lip gloss highlight
  ctx.fillStyle = 'rgba(255, 242, 246, 0.62)';
  ctx.beginPath();
  ctx.ellipse(cx - 10, ly + 12, 13, 3.8, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 14, ly + 12, 7, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 6. Crisp glowing ice-cyan 6-pointed snowflake mark on center forehead (cy = 408)
  ctx.save();
  ctx.translate(cx, 408);
  ctx.strokeStyle = '#6cf4ff';
  ctx.fillStyle = '#e0ffff';
  ctx.shadowColor = '#2ee2ff';
  ctx.shadowBlur = 16;
  ctx.lineWidth = 4.2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 26);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return toTexture(canvas);
}

/**
 * Silky turquoise-emerald anime hair strand texture aligned along TubeGeometry U (horizontal axis)
 * so strands flow smoothly from roots to tips and catch an anisotropic angel-ring sheen!
 */
export function hairStrandTexture() {
  const { canvas, ctx } = makeCanvas(512, 256);
  // Gradient from roots (x=0) -> glossy mid-length -> vibrant aqua tips (x=512)
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0.0, '#0f7e7f');
  grad.addColorStop(0.24, '#18a8a4');
  grad.addColorStop(0.45, '#3cdad0');
  grad.addColorStop(0.62, '#1cb4ae');
  grad.addColorStop(0.84, '#149494');
  grad.addColorStop(1.0, '#2ec8c4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Fine silky strands running horizontally along U (length of each TubeGeometry lock!)
  for (let y = 0; y < 256; y += 3) {
    const bright = Math.sin(y * 0.42) * 0.5 + 0.5;
    ctx.strokeStyle = bright > 0.5 ? 'rgba(170,255,248,0.18)' : 'rgba(6,52,58,0.20)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Glossy anime angel-ring highlight band across mid-length
  const ring = ctx.createLinearGradient(155, 0, 235, 0);
  ring.addColorStop(0, 'rgba(205,255,252,0)');
  ring.addColorStop(0.5, 'rgba(205,255,252,0.34)');
  ring.addColorStop(1, 'rgba(205,255,252,0)');
  ctx.fillStyle = ring;
  ctx.fillRect(155, 0, 80, 256);

  return toTexture(canvas);
}

/** Plush winter fur color & soft bump textures so white fur never looks like smooth plastic */
export function furColorTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#f5f9ff';
  ctx.fillRect(0, 0, 256, 256);

  // Soft feathery fur strokes in cool white & pale ice-lavender shadow
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 8 + Math.random() * 14;
    const ang = Math.PI * 0.45 + (Math.random() - 0.5) * 0.5;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(195,212,240,0.42)' : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  const tex = toTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

export function furBumpTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 7 + Math.random() * 12;
    const ang = Math.PI * 0.45 + (Math.random() - 0.5) * 0.55;
    const v = i % 2 === 0 ? 225 : 65;
    ctx.strokeStyle = `rgba(${v},${v},${v},0.48)`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  const tex = toTexture(canvas, false);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/**
 * Leg & thigh-high boot texture (v=0 ankle -> v=1 upper hip):
 * - v = 0.00..0.16: deep royal sapphire ankle
 * - v = 0.16..0.48: rich cobalt-to-cerulean calf
 * - v = 0.48..0.74: luminous pale ice-cyan knee & mid-thigh stocking
 * - v = 0.71..0.78: embossed white snow-lotus floral lace cuff
 * - v = 0.78..1.00: warm fair porcelain bare upper thigh skin
 */
export function bootGradient() {
  const { canvas, ctx } = makeCanvas(256, 512);
  const grad = ctx.createLinearGradient(0, 512, 0, 0);
  grad.addColorStop(0.0, '#182b78');
  grad.addColorStop(0.15, '#2142a0');
  grad.addColorStop(0.35, '#3b74c6');
  grad.addColorStop(0.55, '#86cbe8');
  grad.addColorStop(0.72, '#d4f2fb');
  grad.addColorStop(0.768, '#f6fcff');
  grad.addColorStop(0.778, '#ffe5d9');
  grad.addColorStop(0.84, '#ffe2d5');
  grad.addColorStop(1.0, '#ffd8c9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);

  // Subtle vertical knee highlight sheen on stocking
  const sheen = ctx.createLinearGradient(64, 0, 192, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.16)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(64, 120, 128, 392);

  // Embossed white snow-lotus lace border along top of thigh-high stocking
  const laceY = 124;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = 'rgba(165,216,245,0.95)';
  ctx.lineWidth = 2;
  for (let x = 16; x < 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, laceY - 14);
    ctx.quadraticCurveTo(x + 12, laceY, x, laceY + 24);
    ctx.quadraticCurveTo(x - 12, laceY, x, laceY - 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x - 10, laceY + 7, 5.5, 0, Math.PI * 2);
    ctx.arc(x + 10, laceY + 7, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  return toTexture(canvas);
}

/** Sculpted bodice satin gradient with subtle ice-blue waist shading & snow-white bust */
export function bodiceGradient() {
  const { canvas, ctx } = makeCanvas(256, 256);
  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0.0, '#8ad2ec');
  grad.addColorStop(0.22, '#bce6f6');
  grad.addColorStop(0.50, '#e2f2fc');
  grad.addColorStop(0.76, '#f6fbff');
  grad.addColorStop(1.0, '#ffffff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle vertical princess-seam contour shading
  for (const x of [76, 180]) {
    const g = ctx.createLinearGradient(x - 14, 0, x + 14, 0);
    g.addColorStop(0, 'rgba(120,175,215,0)');
    g.addColorStop(0.5, 'rgba(120,175,215,0.22)');
    g.addColorStop(1, 'rgba(120,175,215,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 14, 0, 28, 256);
  }
  return toTexture(canvas);
}

/** Front Apron panel: luminous turquoise-to-sapphire shield with crisp white frost crest */
export function apronGradient() {
  const { canvas, ctx } = makeCanvas(256, 384);
  const grad = ctx.createLinearGradient(0, 0, 0, 384);
  grad.addColorStop(0.0, '#44b8e8');
  grad.addColorStop(0.42, '#2e88cf');
  grad.addColorStop(0.82, '#1c53a8');
  grad.addColorStop(1.0, '#143884');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 384);

  const glow = ctx.createRadialGradient(128, 170, 8, 128, 170, 120);
  glow.addColorStop(0, 'rgba(175, 245, 255, 0.38)');
  glow.addColorStop(1, 'rgba(175, 245, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 384);

  // Crisp white geometric frost fleur-de-lis / diamond emblem (Reference Image 1)
  ctx.strokeStyle = '#eefaff';
  ctx.fillStyle = '#eefaff';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';

  // Side decorative wing curls
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(128 + s * 30, 246);
    ctx.quadraticCurveTo(128 + s * 68, 224, 128 + s * 78, 186);
    ctx.stroke();
  }

  // Central pointed diamond
  ctx.beginPath();
  ctx.moveTo(128, 166);
  ctx.lineTo(162, 232);
  ctx.lineTo(128, 298);
  ctx.lineTo(94, 232);
  ctx.closePath();
  ctx.stroke();

  // Inner luminous diamond
  ctx.beginPath();
  ctx.moveTo(128, 202);
  ctx.lineTo(144, 232);
  ctx.lineTo(128, 262);
  ctx.lineTo(112, 232);
  ctx.closePath();
  ctx.fill();

  return toTexture(canvas);
}

/** Back rounded skirt texture (Images 3, 4, 5): turquoise -> deep royal blue + 4-diamond frost knot */
export function backSkirtTexture() {
  const { canvas, ctx } = makeCanvas(512, 512);
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#44cce2');
  grad.addColorStop(0.28, '#2b9dd0');
  grad.addColorStop(0.56, '#1e5ab2');
  grad.addColorStop(0.82, '#183288');
  grad.addColorStop(1.0, '#122266');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Soft center sheen
  const sheen = ctx.createRadialGradient(256, 170, 20, 256, 170, 220);
  sheen.addColorStop(0, 'rgba(145, 240, 255, 0.28)');
  sheen.addColorStop(1, 'rgba(145, 240, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 512, 512);

  // Glowing ice-blue 4-diamond frost-knot emblem near bottom hem
  ctx.save();
  ctx.strokeStyle = '#70e4ff';
  ctx.shadowColor = '#54e6ff';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 5;

  const drawDiamond = (cx: number, cy: number, rx: number, ry: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    ctx.lineTo(cx + rx, cy);
    ctx.lineTo(cx, cy + ry);
    ctx.lineTo(cx - rx, cy);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - ry * 0.45);
    ctx.lineTo(cx + rx * 0.45, cy);
    ctx.lineTo(cx, cy + ry * 0.45);
    ctx.lineTo(cx - rx * 0.45, cy);
    ctx.closePath();
    ctx.stroke();
  };

  drawDiamond(256, 336, 32, 42);
  drawDiamond(256, 418, 32, 42);
  drawDiamond(206, 378, 28, 36);
  drawDiamond(306, 378, 28, 36);

  ctx.lineWidth = 4;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(256 + s * 70, 425);
    ctx.quadraticCurveTo(256 + s * 150, 390, 256 + s * 200, 310);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(256 + s * 85, 385);
    ctx.lineTo(256 + s * 125, 365);
    ctx.lineTo(256 + s * 115, 335);
    ctx.stroke();
  }
  ctx.restore();

  return toTexture(canvas);
}

/** Long ceremonial coat-tail streamer — royal sapphire cloth, plush white fur edges, pointed spear motif */
export function tapestryTexture() {
  const { canvas, ctx } = makeCanvas(256, 1024);
  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#2a6cc2');
  grad.addColorStop(0.35, '#1d489c');
  grad.addColorStop(0.75, '#162f7c');
  grad.addColorStop(1, '#10205c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1024);

  const sheen = ctx.createLinearGradient(44, 0, 212, 0);
  sheen.addColorStop(0, 'rgba(90,165,245,0)');
  sheen.addColorStop(0.5, 'rgba(120,200,255,0.32)');
  sheen.addColorStop(1, 'rgba(90,165,245,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 256, 1024);

  // Inner glowing cyan pinstripe
  ctx.strokeStyle = 'rgba(115, 212, 255, 0.72)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(36, 0);
  ctx.lineTo(36, 900);
  ctx.lineTo(128, 985);
  ctx.lineTo(220, 900);
  ctx.lineTo(220, 0);
  ctx.stroke();

  // Ornate spearhead motif near bottom pointed tip (seen in Side Image 2!)
  ctx.strokeStyle = '#70e2ff';
  ctx.fillStyle = '#70e2ff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(128, 775);
  ctx.lineTo(174, 875);
  ctx.lineTo(128, 955);
  ctx.lineTo(82, 875);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(128, 828);
  ctx.lineTo(150, 875);
  ctx.lineTo(128, 916);
  ctx.lineTo(106, 875);
  ctx.closePath();
  ctx.fill();

  return toTexture(canvas);
}

/** Crescent frost slash wave texture (Action Image 5) */
export function slashWaveTexture() {
  const { canvas, ctx } = makeCanvas(512, 512);
  ctx.clearRect(0, 0, 512, 512);
  ctx.save();
  ctx.translate(256, 256);

  for (let pass = 0; pass < 3; pass++) {
    const rOuter = 238 - pass * 14;
    const rInner = 152 + pass * 12;
    const grad = ctx.createRadialGradient(0, 0, rInner * 0.8, 0, 0, rOuter);
    grad.addColorStop(0, 'rgba(80, 220, 255, 0)');
    grad.addColorStop(0.55, 'rgba(90, 225, 255, 0.38)');
    grad.addColorStop(0.86, 'rgba(185, 250, 255, 0.94)');
    grad.addColorStop(0.96, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1, 'rgba(120, 235, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rOuter, -Math.PI * 0.72, Math.PI * 0.72);
    ctx.arc(18, 0, rInner, Math.PI * 0.72, -Math.PI * 0.72, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  return toTexture(canvas);
}

/** Rune circle — outer glyph ring for the summoning seal */
export function runeRingTexture(variant: 'outer' | 'inner') {
  const { canvas, ctx } = makeCanvas(512, 512);
  ctx.clearRect(0, 0, 512, 512);
  ctx.translate(256, 256);
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#54e6ff';
  ctx.shadowBlur = 16;

  const ring = (r: number, w: number, alpha = 1) => {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  };

  if (variant === 'outer') {
    ring(238, 6);
    ring(198, 2.5, 0.85);
    ring(112, 2.5, 0.85);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const long = i % 3 === 0;
      ctx.save();
      ctx.rotate(a);
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = long ? 5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -198);
      ctx.lineTo(0, long ? -228 : -216);
      ctx.stroke();
      if (i % 6 === 0) {
        ctx.beginPath();
        ctx.moveTo(0, -168);
        ctx.lineTo(10, -150);
        ctx.lineTo(0, -132);
        ctx.lineTo(-10, -150);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
  } else {
    ring(150, 4);
    ring(72, 3.5, 0.9);
    ctx.globalAlpha = 0.92;
    ctx.lineWidth = 3.5;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 2 + (k * Math.PI) / 4;
        const x = Math.cos(a) * 148;
        const y = Math.sin(a) * 148;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, -44);
    ctx.quadraticCurveTo(7, -8, 44, 0);
    ctx.quadraticCurveTo(7, 8, 0, 44);
    ctx.quadraticCurveTo(-7, 8, -44, 0);
    ctx.quadraticCurveTo(-7, -8, 0, -44);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas);
}

/** Soft 4-pointed sparkle sprite */
export function sparkleTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(190,246,255,0.85)');
  grad.addColorStop(1, 'rgba(120,220,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  ctx.globalCompositeOperation = 'lighter';
  const flare = (w: number, h: number, rot: number) => {
    ctx.save();
    ctx.translate(64, 64);
    ctx.rotate(rot);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  };
  flare(7, 110, 0);
  flare(7, 110, Math.PI / 2);
  flare(3, 66, Math.PI / 4);
  flare(3, 66, -Math.PI / 4);
  return toTexture(canvas);
}

/** Radial glow sprite for the crystal halo */
export function glowTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.24, 'rgba(120,245,255,0.68)');
  grad.addColorStop(0.55, 'rgba(42,205,245,0.22)');
  grad.addColorStop(1, 'rgba(30,175,235,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return toTexture(canvas, false);
}

/** Soft round snowflake sprite */
export function snowTexture() {
  const { canvas, ctx } = makeCanvas(64, 64);
  ctx.clearRect(0, 0, 64, 64);
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.45, 'rgba(225,242,255,0.55)');
  grad.addColorStop(1, 'rgba(200,230,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(canvas);
}
