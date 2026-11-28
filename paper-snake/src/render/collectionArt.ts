import type { Skin } from "../game/skins";
import type { ArtId } from "./skinLayout";

type Context = CanvasRenderingContext2D;
type Draw = (ctx: Context, w: number, h: number, skin: Skin) => void;

function shape(ctx: Context, pts: number[], fill: string, outline?: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

function eye(ctx: Context, x: number, y: number, r: number) {
  ctx.fillStyle = "#fffdf6";
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.55, r * 1.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#233d36";
  ctx.beginPath(); ctx.arc(x + r * 0.15, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.35, r * 0.32, 0, Math.PI * 2); ctx.fill();
}

function fold(ctx: Context, pts: number[], color = "rgba(70,60,40,.19)") {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineWidth = 1.2; ctx.strokeStyle = color; ctx.stroke();
}

function shadow(ctx: Context) {
  ctx.shadowColor = "rgba(65,47,29,.15)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 5;
}

const koiHead: Draw = (ctx) => {
  ctx.save(); shadow(ctx);
  shape(ctx, [22, 90, 65, 30, 144, 32, 205, 70, 213, 90, 205, 110, 144, 148, 65, 150], "#fdf7e8", "#d3be9b");
  ctx.restore();
  shape(ctx, [22, 90, 65, 30, 144, 32, 115, 90], "#fffaf0");
  shape(ctx, [22, 90, 65, 150, 144, 148, 115, 90], "#e6d2af");
  shape(ctx, [115, 90, 144, 32, 205, 70, 213, 90], "#ee7653");
  shape(ctx, [115, 90, 213, 90, 205, 110, 144, 148], "#d85e43");
  shape(ctx, [65, 30, 144, 32, 115, 90, 80, 58], "#f28a66");
  fold(ctx, [22, 90, 213, 90], "rgba(95,54,32,.18)");
  eye(ctx, 159, 58, 7); eye(ctx, 159, 122, 7);
  ctx.strokeStyle = "#984a36"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(203, 84); ctx.quadraticCurveTo(197, 90, 203, 96); ctx.stroke();
  fold(ctx, [45, 90, 79, 48], "rgba(255,255,255,.75)");
};

function koiScale(ctx: Context, coral: boolean) {
  const light = coral ? "#f59570" : "#fff9ec";
  const mid = coral ? "#eb7653" : "#f5e9d2";
  const dark = coral ? "#ce563c" : "#dec8a5";
  ctx.save(); shadow(ctx);
  shape(ctx, [8, 75, 34, 14, 110, 24, 132, 75, 110, 126, 34, 136], mid, coral ? "#c5573c" : "#d7c4a3");
  ctx.restore();
  shape(ctx, [8, 75, 34, 14, 80, 31, 132, 75], light);
  shape(ctx, [8, 75, 132, 75, 110, 126, 34, 136], dark);
  shape(ctx, [34, 14, 110, 24, 132, 75, 80, 31], mid);
  fold(ctx, [8, 75, 132, 75]);
  fold(ctx, [34, 14, 80, 31, 132, 75], "rgba(255,255,255,.65)");
}

const koiFin: Draw = (ctx) => {
  shape(ctx, [38, 95, 57, 6, 128, 28, 105, 95], "#f7c5a0", "#cd9772");
  shape(ctx, [38, 95, 57, 184, 128, 162, 105, 95], "#e9aa7f", "#cd9772");
  for (let i = 0; i < 5; i++) {
    fold(ctx, [48, 95, 64 + i * 12, 10 + i * 5], "rgba(255,255,255,.65)");
    fold(ctx, [48, 95, 64 + i * 12, 180 - i * 5], "rgba(255,255,255,.5)");
  }
};

const koiTail: Draw = (ctx) => {
  ctx.save(); shadow(ctx);
  shape(ctx, [188, 100, 22, 10, 45, 100, 22, 190], "#ee7653", "#bc593d");
  ctx.restore();
  shape(ctx, [188, 100, 22, 10, 82, 100], "#f99d71");
  shape(ctx, [188, 100, 82, 100, 22, 190], "#d75e3f");
  for (let i = 0; i < 5; i++) {
    fold(ctx, [178, 100, 29 + i * 6, 20 + i * 19], "rgba(255,247,221,.6)");
    fold(ctx, [178, 100, 29 + i * 6, 180 - i * 19], "rgba(255,247,221,.5)");
  }
};

const jellyHead: Draw = (ctx) => {
  ctx.save();
  ctx.shadowColor = "rgba(89,84,153,.19)"; ctx.shadowBlur = 13;
  ctx.beginPath(); ctx.moveTo(48, 35);
  ctx.bezierCurveTo(153, -2, 194, 46, 194, 105);
  ctx.bezierCurveTo(194, 164, 153, 212, 48, 175);
  ctx.quadraticCurveTo(70, 105, 48, 35);
  const g = ctx.createLinearGradient(40, 10, 180, 190);
  g.addColorStop(0, "#f4f1ff"); g.addColorStop(.45, "#c9baef"); g.addColorStop(1, "#9d9acf");
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.strokeStyle = "rgba(99,93,157,.65)"; ctx.lineWidth = 2; ctx.stroke();
  for (const offset of [-42, -15, 15, 42]) {
    ctx.beginPath(); ctx.moveTo(53, 105 + offset);
    ctx.bezierCurveTo(100, 105 + offset * 1.65, 152, 105 + offset * 1.3, 185, 105 + offset * .3);
    ctx.strokeStyle = "rgba(255,255,255,.48)"; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.beginPath(); ctx.ellipse(125, 44, 34, 12, .25, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(235,137,172,.35)";
  for (const y of [68, 142]) { ctx.beginPath(); ctx.ellipse(141, y, 13, 7, 0, 0, Math.PI * 2); ctx.fill(); }
  eye(ctx, 159, 85, 6); eye(ctx, 159, 125, 6);
  ctx.lineCap = "round"; ctx.strokeStyle = "#655d8b"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(173, 105, 6, -.6, .6); ctx.stroke();
};

const jellyRibbon: Draw = (ctx) => {
  ctx.beginPath(); ctx.moveTo(0, 30);
  ctx.bezierCurveTo(35, 0, 83, 56, 120, 22);
  ctx.lineTo(120, 45); ctx.bezierCurveTo(75, 69, 35, 17, 0, 47); ctx.closePath();
  const g = ctx.createLinearGradient(0, 12, 0, 60);
  g.addColorStop(0, "#d9d2f2"); g.addColorStop(.5, "#c3b5e9"); g.addColorStop(1, "#919bd3");
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.5; ctx.stroke();
};

const jellyCore: Draw = (ctx) => {
  const g = ctx.createRadialGradient(50, 50, 10, 50, 50, 49);
  g.addColorStop(0, "rgba(128,147,191,.45)"); g.addColorStop(.65, "rgba(169,172,213,.23)"); g.addColorStop(1, "rgba(169,172,213,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
};

const jellyPearl: Draw = (ctx) => {
  ctx.fillStyle = "#e8fffc"; ctx.beginPath(); ctx.arc(20, 20, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#afcfcf"; ctx.lineWidth = 2; ctx.stroke();
};

const filmHead: Draw = (ctx) => {
  ctx.save(); shadow(ctx);
  ctx.fillStyle = "#355e58"; ctx.beginPath(); ctx.roundRect(55, 55, 112, 92, 12); ctx.fill();
  ctx.restore();
  shape(ctx, [160, 82, 218, 61, 218, 135, 160, 116], "#d8b47a", "#a48252");
  shape(ctx, [160, 82, 218, 61, 218, 80, 160, 95], "#f6dbaf");
  ctx.fillStyle = "#29453f"; ctx.fillRect(207, 64, 13, 68);
  ctx.fillStyle = "#f2dfbb"; ctx.fillRect(78, 86, 66, 26);
  ctx.fillStyle = "#ca9261"; ctx.fillRect(85, 91, 18, 16);
  ctx.fillStyle = "#698f7a"; ctx.fillRect(109, 91, 27, 16);
  for (const [x, y, r] of [[50, 52, 38], [122, 37, 32]]) {
    ctx.fillStyle = "#b1c4b7"; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#385b50"; ctx.lineWidth = 3; ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      ctx.fillStyle = "#426157"; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * .58, y + Math.sin(a) * r * .58, r * .18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#e9d5b1"; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  }
  eye(ctx, 159, 78, 5); eye(ctx, 159, 127, 5);
  ctx.fillStyle = "#c8d7ca"; ctx.beginPath(); ctx.roundRect(75, 59, 62, 7, 3); ctx.fill();
};

function filmFrame(ctx: Context, version: number) {
  ctx.fillStyle = "#334944"; ctx.fillRect(0, 5, 140, 110);
  ctx.fillStyle = "#ede5ce"; ctx.fillRect(6, 24, 128, 72);
  const sky = ["#aac9c0", "#dfb28d", "#adbed0"][version];
  ctx.fillStyle = sky; ctx.fillRect(11, 29, 118, 62);
  shape(ctx, [11, 91, 11, 70, 48, 47, 80, 77, 104, 62, 129, 83, 129, 91], ["#537f73", "#9b6952", "#607e86"][version]);
  ctx.fillStyle = "#f6dfa7"; ctx.beginPath(); ctx.arc(101, 46, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f8f3e6";
  for (let x = 8; x < 140; x += 22) {
    ctx.fillRect(x, 10, 11, 8); ctx.fillRect(x, 102, 11, 8);
  }
  fold(ctx, [0, 5, 140, 5], "#688377");
}

const kiteHead: Draw = (ctx) => {
  ctx.save(); shadow(ctx);
  shape(ctx, [22, 110, 112, 13, 207, 110, 112, 207], "#e9b84c", "#a77c33");
  ctx.restore();
  shape(ctx, [22, 110, 112, 13, 112, 110], "#f5d77a");
  shape(ctx, [112, 13, 207, 110, 112, 110], "#e9985a");
  shape(ctx, [22, 110, 112, 110, 112, 207], "#416d65");
  shape(ctx, [112, 110, 207, 110, 112, 207], "#86a89a");
  fold(ctx, [22, 110, 207, 110], "#fff2d0"); fold(ctx, [112, 13, 112, 207], "#fff2d0");
  ctx.lineWidth = 2; ctx.strokeStyle = "#9a793f";
  ctx.beginPath(); ctx.moveTo(25, 110); ctx.quadraticCurveTo(0, 105, 0, 130); ctx.stroke();
  eye(ctx, 152, 93, 5.5); eye(ctx, 152, 127, 5.5);
};

function kiteSail(ctx: Context, flip: boolean) {
  ctx.save(); shadow(ctx);
  shape(ctx, [80, 80, 18, 12, 143, 35], flip ? "#e6ab58" : "#73a497", "#668476");
  shape(ctx, [80, 80, 18, 148, 143, 125], flip ? "#87aa9c" : "#f0cf75", "#af9a6b");
  ctx.restore();
  fold(ctx, [80, 80, 18, 12], "#fff4d6"); fold(ctx, [80, 80, 18, 148], "#fff4d6");
  shape(ctx, [80, 80, 143, 35, 100, 46], "rgba(255,255,255,.26)");
  shape(ctx, [80, 80, 143, 125, 100, 114], "rgba(100,65,30,.13)");
}

const kiteString: Draw = (ctx) => {
  ctx.fillStyle = "#a77f3f"; ctx.fillRect(0, 4, 64, 4);
  ctx.fillStyle = "#f0d49a"; ctx.fillRect(0, 4, 64, 1.3);
};

const kiteTail: Draw = (ctx) => {
  shape(ctx, [145, 60, 12, 15, 36, 56, 8, 82], "#efbd58", "#b38d48");
  shape(ctx, [145, 60, 12, 95, 43, 73, 18, 48], "#4d8378", "#346b60");
  fold(ctx, [145, 60, 15, 42], "#ffe6ae");
};

export const COLLECTION_DRAWERS = {
  "koi.head": koiHead,
  "koi.white": (ctx: Context) => koiScale(ctx, false),
  "koi.coral": (ctx: Context) => koiScale(ctx, true),
  "koi.fin": koiFin,
  "koi.tail": koiTail,
  "jelly.head": jellyHead,
  "jelly.ribbon": jellyRibbon,
  "jelly.core": jellyCore,
  "jelly.pearl": jellyPearl,
  "film.head": filmHead,
  "film.frame0": (ctx: Context) => filmFrame(ctx, 0),
  "film.frame1": (ctx: Context) => filmFrame(ctx, 1),
  "film.frame2": (ctx: Context) => filmFrame(ctx, 2),
  "kite.head": kiteHead,
  "kite.sail0": (ctx: Context) => kiteSail(ctx, false),
  "kite.sail1": (ctx: Context) => kiteSail(ctx, true),
  "kite.string": kiteString,
  "kite.tail": kiteTail,
} satisfies Partial<Record<ArtId, Draw>>;