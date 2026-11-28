import type { Skin } from "../game/skins";
import type { ArtId } from "./skinLayout";

type Ctx = CanvasRenderingContext2D;
type Drawer = (ctx: Ctx, width: number, height: number, skin: Skin) => void;
const TAU = Math.PI * 2;

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rotation = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
}

function polygon(ctx: Ctx, points: number[], fill: string, stroke?: string) {
  ctx.beginPath(); ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = 1.8; ctx.lineJoin = "round"; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, radius = 0) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}

function line(ctx: Ctx, points: number[], colour: string, width = 1.6) {
  ctx.beginPath(); ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.stroke();
}

function shadow(ctx: Ctx) { ctx.shadowColor = "rgba(43,51,36,.17)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 4; }

function eye(ctx: Ctx, x: number, y: number, r: number) {
  ellipse(ctx, x, y, r * 1.65, r * 1.45); ctx.fillStyle = "#fff9e9"; ctx.fill();
  ellipse(ctx, x + r * .22, y, r, r * 1.02); ctx.fillStyle = "#273e34"; ctx.fill();
  ellipse(ctx, x + r * .52, y - r * .35, r * .31, r * .31); ctx.fillStyle = "#ffffff"; ctx.fill();
}

function rivet(ctx: Ctx, x: number, y: number, r = 4) {
  ellipse(ctx, x, y, r, r); ctx.fillStyle = "#fae4af"; ctx.fill();
  ctx.strokeStyle = "#967344"; ctx.lineWidth = 1.2; ctx.stroke();
  line(ctx, [x - r * .5, y, x + r * .5, y], "#8a6f42", 1.3);
}

function leaf(ctx: Ctx, x: number, y: number, length: number, width: number, rotation: number, pale: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(length * .2, -width, length * .8, -width * .6, length, 0);
  ctx.bezierCurveTo(length * .62, width * .7, length * .2, width * .6, 0, 0);
  const g = ctx.createLinearGradient(0, -width, 0, width);
  g.addColorStop(0, pale ? "#abc291" : "#8ba98b");
  g.addColorStop(.5, pale ? "#839e6d" : "#60856a");
  g.addColorStop(1, pale ? "#627c52" : "#3e6650");
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = "#4e714d"; ctx.lineWidth = 1.7; ctx.stroke();
  line(ctx, [2, 0, length * .92, 0], "#cfdbac", 1.5);
  for (let i = 1; i < 5; i++) {
    const px = i * length * .16;
    line(ctx, [px, 0, px + length * .07, -width * .4], "rgba(221,233,187,.6)", 1.1);
    line(ctx, [px, 0, px + length * .07, width * .32], "rgba(221,233,187,.45)", 1.1);
  }
  ctx.restore();
}

const gardenHead: Drawer = (ctx) => {
  ctx.save(); shadow(ctx);
  leaf(ctx, 110, 95, 94, 37, -2.2, true);
  leaf(ctx, 110, 95, 94, 37, 2.2, false);
  leaf(ctx, 91, 95, 78, 30, Math.PI, false);
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(60, 95);
  ctx.bezierCurveTo(103, 20, 175, 42, 210, 95);
  ctx.bezierCurveTo(175, 148, 103, 170, 60, 95);
  const g = ctx.createLinearGradient(0, 46, 0, 146);
  g.addColorStop(0, "#bbcb84"); g.addColorStop(.48, "#95ad63"); g.addColorStop(1, "#5e7c48");
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = "#48623e"; ctx.lineWidth = 2.3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(69, 95); ctx.quadraticCurveTo(140, 110, 202, 95);
  ctx.strokeStyle = "#dce2aa"; ctx.lineWidth = 2; ctx.stroke();
  for (const y of [68, 122]) eye(ctx, 164, y, 7);
  ctx.fillStyle = "#d7af69";
  ellipse(ctx, 145, 56, 10, 4, -.3); ctx.fill(); ellipse(ctx, 145, 134, 10, 4, .3); ctx.fill();
  ellipse(ctx, 112, 62, 23, 5, -.2); ctx.fillStyle = "rgba(244,246,210,.5)"; ctx.fill();
};

const gardenStem: Drawer = (ctx) => {
  const g = ctx.createLinearGradient(0, 18, 0, 52);
  g.addColorStop(0, "#9fb084"); g.addColorStop(.5, "#6f8b5e"); g.addColorStop(1, "#3f6147");
  ctx.beginPath(); ctx.roundRect(-4, 18, 104, 34, 17); ctx.fillStyle = g; ctx.fill();
  line(ctx, [0, 25, 96, 25], "#c0cfa4", 2);
  line(ctx, [15, 46, 30, 38, 41, 42], "#4b6b4a", 1.6);
};

const gardenFlower: Drawer = (ctx) => {
  ctx.save(); shadow(ctx);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    ellipse(ctx, 50 + Math.cos(a) * 20, 50 + Math.sin(a) * 20, 22, 12, a);
    ctx.fillStyle = i % 2 ? "#f1deb4" : "#f8ebca"; ctx.fill();
    ctx.strokeStyle = "#d0b781"; ctx.lineWidth = 1.2; ctx.stroke();
  }
  ctx.restore();
  ellipse(ctx, 50, 50, 13, 13); ctx.fillStyle = "#c3964e"; ctx.fill();
  for (const [x, y] of [[45, 46], [54, 48], [49, 55]]) { ellipse(ctx, x, y, 2, 2); ctx.fillStyle = "#fcecc4"; ctx.fill(); }
};

const gardenBud: Drawer = (ctx) => {
  leaf(ctx, 18, 45, 117, 40, 0, true);
  leaf(ctx, 22, 46, 79, 22, -.16, false);
};

const zipFabric: Drawer = (ctx) => {
  const g = ctx.createLinearGradient(0, 0, 0, 160);
  g.addColorStop(0, "#8aa99a"); g.addColorStop(.35, "#5a8576"); g.addColorStop(.6, "#3d655a"); g.addColorStop(1, "#6c9280");
  ctx.fillStyle = g; ctx.fillRect(0, 8, 100, 144);
  rect(ctx, 0, 60, 100, 40, "#244b43");
  line(ctx, [0, 10, 100, 10], "#b1c3a3", 2.5);
  line(ctx, [0, 151, 100, 151], "#365c4f", 2.5);
  ctx.setLineDash([6, 6]);
  line(ctx, [0, 28, 100, 28], "#cbd4ba", 1.7);
  line(ctx, [0, 131, 100, 131], "#b0bda0", 1.7);
  ctx.setLineDash([]);
  for (let y = 14; y < 150; y += 7) {
    if (y > 54 && y < 106) continue;
    line(ctx, [0, y, 100, y], "rgba(227,229,192,.075)", 1);
  }
};

const zipTeeth: Drawer = (ctx) => {
  for (let i = 0; i < 4; i++) {
    const x = i * 25;
    rect(ctx, x + 1, 22, 18, 31, "#a6814c", 4);
    rect(ctx, x + 3, 21, 16, 26, "#e4c17c", 4);
    rect(ctx, x + 9, 47, 18, 31, "#987345", 4);
    rect(ctx, x + 11, 45, 16, 27, "#d2ad68", 4);
    line(ctx, [x + 5, 25, x + 15, 25], "#f8e3aa", 1.8);
    line(ctx, [x + 13, 49, x + 22, 49], "#f8e3aa", 1.5);
  }
};

const zipHead: Drawer = (ctx) => {
  ctx.save(); shadow(ctx);
  polygon(ctx, [20, 35, 143, 24, 199, 57, 210, 85, 199, 113, 143, 146, 20, 135], "#be9354", "#927140");
  ctx.restore();
  polygon(ctx, [20, 35, 143, 24, 199, 57, 160, 85, 57, 85], "#ebcb8b");
  polygon(ctx, [57, 85, 160, 85, 199, 113, 143, 146, 20, 135], "#bd965d");
  polygon(ctx, [42, 47, 130, 41, 162, 62, 161, 108, 131, 129, 42, 122], "#57766a", "#405e52");
  rect(ctx, 69, 58, 54, 54, "#c5b586", 9);
  rect(ctx, 79, 67, 34, 36, "#536856", 6);
  eye(ctx, 173, 65, 6.3); eye(ctx, 173, 105, 6.3);
  line(ctx, [199, 81, 193, 85, 199, 89], "#7d5d36", 2);
  rivet(ctx, 39, 42, 3); rivet(ctx, 39, 128, 3);
};

const zipPull: Drawer = (ctx) => {
  ctx.save(); shadow(ctx);
  ctx.beginPath(); ctx.roundRect(12, 14, 134, 62, 19); ctx.roundRect(29, 27, 82, 36, 11);
  ctx.fillStyle = "#cfb179"; ctx.fill("evenodd");
  ctx.restore();
  ctx.beginPath(); ctx.roundRect(12, 14, 134, 62, 19); ctx.roundRect(29, 27, 82, 36, 11);
  ctx.strokeStyle = "#97794d"; ctx.lineWidth = 2.2; ctx.stroke();
  line(ctx, [30, 19, 125, 19], "#f3deb1", 2);
  rivet(ctx, 130, 45, 5);
};

function gear(ctx: Ctx, colour: string, light: string, dark: string) {
  const cx = 80, cy = 80, outside = 70, root = 58;
  ctx.save(); shadow(ctx);
  ctx.beginPath();
  for (let tooth = 0; tooth < 12; tooth++) {
    for (let j = 0; j < 4; j++) {
      const a = (tooth + j / 4) * TAU / 12;
      const r = j === 1 || j === 2 ? outside : root;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (!tooth && !j) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.closePath(); ctx.moveTo(cx + 34, cy); ctx.arc(cx, cy, 34, 0, TAU);
  const g = ctx.createLinearGradient(20, 12, 135, 148);
  g.addColorStop(0, light); g.addColorStop(.5, colour); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fill("evenodd"); ctx.restore();
  ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
  ellipse(ctx, cx, cy, 48, 48); ctx.strokeStyle = "rgba(253,235,187,.45)"; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    line(ctx, [cx, cy, cx + Math.cos(a) * 38, cy + Math.sin(a) * 38], dark, 11);
    line(ctx, [cx, cy - 1, cx + Math.cos(a) * 36, cy + Math.sin(a) * 36 - 1], colour, 7);
  }
  ellipse(ctx, 80, 80, 13, 13); ctx.fillStyle = light; ctx.fill();
};

const clockLink: Drawer = (ctx) => {
  ctx.save(); shadow(ctx);
  rect(ctx, 0, 13, 100, 18, "#a88a5d", 8); ctx.restore();
  rect(ctx, 0, 13, 100, 8, "#d6bc88", 4);
  rivet(ctx, 18, 23, 5); rivet(ctx, 82, 23, 5);
};

const clockHead: Drawer = (ctx) => {
  ctx.lineWidth = 6; ctx.strokeStyle = "#ab8955";
  for (const y of [68, 132]) { ellipse(ctx, 30, y, 20, 17); ctx.stroke(); }
  line(ctx, [29, 68, 29, 132], "#d4b475", 8);
  line(ctx, [29, 100, 88, 100], "#a88852", 13);
  line(ctx, [30, 97, 88, 97], "#e9cf91", 4);
  ctx.save(); shadow(ctx);
  polygon(ctx, [65, 47, 150, 28, 201, 65, 211, 100, 201, 135, 150, 172, 65, 153, 48, 119, 48, 81], "#c89c5b", "#907044");
  ctx.restore();
  polygon(ctx, [65, 47, 150, 28, 201, 65, 155, 79, 58, 80], "#ead097");
  polygon(ctx, [58, 120, 155, 121, 201, 135, 150, 172, 65, 153], "#9c7847");
  ellipse(ctx, 135, 100, 52, 52); ctx.fillStyle = "#516e61"; ctx.fill();
  ctx.strokeStyle = "#355044"; ctx.lineWidth = 2.4; ctx.stroke();
  ellipse(ctx, 135, 100, 40, 40); ctx.strokeStyle = "#bdba89"; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    line(ctx, [135 + Math.cos(a) * 33, 100 + Math.sin(a) * 33, 135 + Math.cos(a) * 37, 100 + Math.sin(a) * 37], "#d3c796", 1.5);
  }
  line(ctx, [135, 101, 124, 82], "#f2dab0", 3); line(ctx, [135, 101, 153, 103], "#dfb97a", 2.5);
  eye(ctx, 185, 81, 6.3); eye(ctx, 185, 119, 6.3);
  for (const [x, y] of [[71, 59], [71, 141], [153, 44], [153, 156]]) rivet(ctx, x, y, 4);
};

const clockHub: Drawer = (ctx) => { rivet(ctx, 22, 22, 13); };

const orbitHead: Drawer = (ctx) => {
  ctx.save(); shadow(ctx);
  polygon(ctx, [85, 74, 25, 22, 47, 79], "#dbbc82", "#a9956f");
  polygon(ctx, [85, 126, 25, 178, 47, 121], "#b59667", "#a18b67");
  ellipse(ctx, 112, 100, 93, 62);
  const g = ctx.createLinearGradient(0, 38, 0, 162);
  g.addColorStop(0, "#c9dcdd"); g.addColorStop(.5, "#7f9ea8"); g.addColorStop(1, "#5a778b");
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.strokeStyle = "#506b7b"; ctx.lineWidth = 2.4; ctx.stroke();
  ellipse(ctx, 112, 100, 79, 48); ctx.lineWidth = 3; ctx.strokeStyle = "#d7c08e"; ctx.stroke();
  ellipse(ctx, 143, 100, 49, 42);
  const dome = ctx.createRadialGradient(155, 81, 4, 143, 100, 49);
  dome.addColorStop(0, "#f5fbec"); dome.addColorStop(.45, "#bfdace"); dome.addColorStop(1, "#719c9c");
  ctx.fillStyle = dome; ctx.fill(); ctx.strokeStyle = "#486a76"; ctx.lineWidth = 2; ctx.stroke();
  ellipse(ctx, 147, 75, 25, 7, -.1); ctx.fillStyle = "rgba(255,255,243,.6)"; ctx.fill();
  eye(ctx, 162, 87, 6); eye(ctx, 162, 113, 6);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * .72 + i * Math.PI * .18;
    ellipse(ctx, 112 + Math.cos(a) * 80, 100 + Math.sin(a) * 48, 4, 4);
    ctx.fillStyle = "#f2d9a1"; ctx.fill();
  }
  line(ctx, [15, 100, 43, 100], "#d2ba85", 4);
};

const orbitBand: Drawer = (ctx) => {
  ctx.save(); ctx.translate(48, 45); ctx.scale(1, .9);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 48);
  g.addColorStop(0, "rgba(114,143,158,.4)"); g.addColorStop(.5, "rgba(130,154,170,.2)"); g.addColorStop(1, "rgba(139,163,178,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 48, 0, TAU); ctx.fill(); ctx.restore();
  line(ctx, [0, 45, 96, 45], "#8a9ea1", 4);
  line(ctx, [0, 42, 96, 42], "rgba(255,251,232,.7)", 1.3);
};

const orbitRing: Drawer = (ctx) => {
  ctx.save(); shadow(ctx);
  ellipse(ctx, 85, 70, 69, 46); ctx.strokeStyle = "#5f798b"; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
  ctx.beginPath(); ctx.ellipse(85, 70, 69, 46, 0, -Math.PI, 0); ctx.strokeStyle = "#d6b67c"; ctx.lineWidth = 5; ctx.stroke();
  ellipse(ctx, 85, 70, 57, 36); ctx.strokeStyle = "rgba(122,156,169,.4)"; ctx.lineWidth = 1.8; ctx.stroke();
  for (const a of [0, Math.PI]) { ellipse(ctx, 85 + Math.cos(a) * 69, 70, 5, 5); ctx.fillStyle = "#f4e6c5"; ctx.fill(); }
};

const orbitSatellite: Drawer = (ctx) => {
  rect(ctx, 2, 17, 20, 27, "#567382", 2); rect(ctx, 48, 17, 20, 27, "#567382", 2);
  for (const x of [3, 49]) { line(ctx, [x + 5, 18, x + 5, 43], "#a1b9bc", 1); line(ctx, [x + 11, 18, x + 11, 43], "#a1b9bc", 1); }
  line(ctx, [10, 30, 60, 30], "#e2c68d", 3);
  ctx.save(); shadow(ctx); rect(ctx, 23, 11, 24, 38, "#e9d5a3", 9); ctx.restore();
  rect(ctx, 28, 17, 14, 13, "#f9f1d9", 4);
  line(ctx, [34, 3, 34, 11], "#7a8c88", 2);
};

const orbitStar: Drawer = (ctx) => {
  polygon(ctx, [24, 6, 29, 19, 42, 24, 29, 29, 24, 42, 19, 29, 6, 24, 19, 19], "#efd49c", "#a1946d");
};

export const CURIOUS_DRAWERS = {
  "garden.head": gardenHead,
  "garden.stem": gardenStem,
  "garden.leaf0": (ctx: Ctx) => leaf(ctx, 135, 45, 122, 41, Math.PI, true),
  "garden.leaf1": (ctx: Ctx) => leaf(ctx, 135, 45, 122, 41, Math.PI, false),
  "garden.flower": gardenFlower,
  "garden.bud": gardenBud,
  "zip.head": zipHead,
  "zip.fabric": zipFabric,
  "zip.teeth": zipTeeth,
  "zip.pull": zipPull,
  "clock.head": clockHead,
  "clock.gear0": (ctx: Ctx) => gear(ctx, "#c79d60", "#efcf91", "#927047"),
  "clock.gear1": (ctx: Ctx) => gear(ctx, "#779081", "#b3c1a7", "#46685b"),
  "clock.link": clockLink,
  "clock.hub": clockHub,
  "orbit.head": orbitHead,
  "orbit.band": orbitBand,
  "orbit.ring": orbitRing,
  "orbit.satellite": orbitSatellite,
  "orbit.star": orbitStar,
} satisfies Partial<Record<ArtId, Drawer>>;