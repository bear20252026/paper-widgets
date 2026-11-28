import { DYING_TIME, SPAWN_TIME } from "../game/constants";
import type { Enemy, Obstacle, Projectile, TowerKind } from "../game/types";
import { ROLE_STYLE, TOWER_META } from "../game/towerMeta";
import { FONT, LEVEL_SCALE, PLATE_COLORS, TOWER_COLORS } from "./theme";

/** 每种炮塔的定位色(与图鉴卡片顶部色条同一来源)。 */
const ROLE_COLOR: Record<TowerKind, string> = Object.fromEntries(
  (Object.keys(TOWER_META) as TowerKind[]).map((k) => [k, ROLE_STYLE[TOWER_META[k].role].color]),
) as Record<TowerKind, string>;

const TAU = Math.PI * 2;

/* ---------- 基础图元(坐标单位 = 格子) ---------- */
export function disc(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  fill?: string, stroke?: string, lw = 0.03,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function oval(
  ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number,
  fill?: string, stroke?: string, lw = 0.03, rot = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function starPath(ctx: CanvasRenderingContext2D, ro: number, ri: number, n: number): void {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = (i * Math.PI) / n - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** 在格子坐标系中绘制文字(通过缩放保证任意分辨率下清晰)。 */
export function drawLabel(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  size: number, color: string, stroke = "rgba(40,20,0,0.75)",
): void {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 20;
  ctx.scale(s, s);
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function drawBar(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ratio: number,
): void {
  const r = Math.min(Math.max(ratio, 0), 1);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - w / 2 - 0.02, y - 0.02, w + 0.04, h + 0.04);
  ctx.fillStyle = r > 0.6 ? "#66bb6a" : r > 0.3 ? "#ffca28" : "#ef5350";
  ctx.fillRect(x - w / 2, y, w * r, h);
}

/* ---------- 炮塔 ---------- */
export function drawTowerSprite(
  ctx: CanvasRenderingContext2D, kind: TowerKind, level: number,
  x: number, y: number, angle: number, active: boolean, now: number, alpha = 1,
): void {
  const lv = Math.min(Math.max(level, 1), 3);
  const col = TOWER_COLORS[kind][lv - 1];
  const s = LEVEL_SCALE[lv - 1];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  // 底座(铜 / 银 / 金),3 级带金色光环
  disc(ctx, 0, 0.03, 0.43, "rgba(0,0,0,0.25)");
  // 定位色圈:和图鉴/坞里的色条一致,场上也能一眼区分单体/范围/控制
  disc(ctx, 0, 0, 0.45, undefined, ROLE_COLOR[kind], 0.055);
  disc(ctx, 0, 0, 0.41, PLATE_COLORS[lv - 1], "#4e342e", 0.035);
  disc(ctx, 0, 0, 0.33, "rgba(255,255,255,0.18)");
  if (lv >= 3) {
    ctx.globalAlpha = alpha * (0.6 + 0.3 * Math.sin(now / 260));
    disc(ctx, 0, 0, 0.47, undefined, "#fff59d", 0.05);
    ctx.globalAlpha = alpha;
  }

  ctx.save();
  switch (kind) {
    case "bottle": {
      ctx.rotate(angle + Math.PI / 2);
      ctx.scale(s, s);
      oval(ctx, 0, 0.05, 0.17, 0.22, col, "rgba(0,0,0,0.45)");
      ctx.fillStyle = col;
      ctx.fillRect(-0.06, -0.3, 0.12, 0.16);
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 0.03;
      ctx.strokeRect(-0.06, -0.3, 0.12, 0.16);
      ctx.fillStyle = "#fff8e1";
      ctx.fillRect(-0.08, -0.36, 0.16, 0.07);
      oval(ctx, -0.06, 0.02, 0.035, 0.1, "rgba(255,255,255,0.55)");
      break;
    }
    case "fan": {
      const n = lv + 2;
      ctx.rotate(now / 1000 * (active ? 9 : 1.6));
      ctx.scale(s, s);
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.rotate((i * TAU) / n);
        oval(ctx, 0, -0.17, 0.085, 0.19, col, "rgba(0,0,0,0.4)", 0.025);
        ctx.restore();
      }
      disc(ctx, 0, 0, 0.07, "#fff", "rgba(0,0,0,0.4)", 0.025);
      break;
    }
    case "sunflower": {
      const n = 4 + lv * 2;
      ctx.scale(s, s);
      ctx.rotate(now / 4000);
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.rotate((i * TAU) / n);
        oval(ctx, 0, -0.23, 0.065, 0.12, col, "rgba(120,70,0,0.55)", 0.02);
        ctx.restore();
      }
      ctx.rotate(-now / 4000);
      disc(ctx, 0, 0, 0.16, "#795548", "#4e342e", 0.025);
      disc(ctx, -0.05, -0.03, 0.022, "#fff");
      disc(ctx, 0.05, -0.03, 0.022, "#fff");
      ctx.beginPath();
      ctx.arc(0, 0.02, 0.06, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = "#ffe0b2";
      ctx.lineWidth = 0.025;
      ctx.stroke();
      break;
    }
    case "moon": {
      ctx.scale(s, s);
      ctx.rotate(Math.sin(now / 900) * 0.15);
      disc(ctx, 0, 0, 0.3, "rgba(179,157,219,0.25)");
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 0.25, 0, TAU);
      ctx.clip();
      ctx.beginPath();
      ctx.rect(-1, -1, 2, 2);
      ctx.moveTo(0.1 + 0.2, -0.05);
      ctx.arc(0.1, -0.05, 0.2, 0, TAU);
      ctx.fillStyle = col;
      ctx.fill("evenodd");
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, 0, 0.25, 0, TAU);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 0.025;
      ctx.stroke();
      for (let i = 0; i < lv - 1; i++) {
        const a = now / 700 + i * Math.PI;
        disc(ctx, Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0.04, "#fff59d");
      }
      break;
    }
    case "star": {
      ctx.rotate(now / 2200);
      ctx.scale(s, s);
      starPath(ctx, 0.32, 0.15, lv >= 3 ? 6 : 5);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = lv >= 3 ? "#0288d1" : "#ffffff";
      ctx.lineWidth = 0.035;
      ctx.stroke();
      disc(ctx, 0, 0, 0.06, "#fff");
      break;
    }
    case "arrow": {
      ctx.rotate(angle + Math.PI / 2);
      ctx.scale(s, s);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -0.34);
      ctx.lineTo(0.1, 0.18);
      ctx.lineTo(0, 0.08);
      ctx.lineTo(-0.1, 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 0.03;
      ctx.stroke();
      for (let i = 0; i < lv; i++) disc(ctx, (i - (lv - 1) / 2) * 0.1, 0.26, 0.03, "#fff");
      break;
    }
    case "cannon": {
      ctx.rotate(angle);
      ctx.scale(s, s);
      ctx.fillStyle = col;
      ctx.fillRect(-0.08, -0.08, 0.38, 0.16);
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 0.03;
      ctx.strokeRect(-0.08, -0.08, 0.38, 0.16);
      disc(ctx, -0.04, 0, 0.16, "#5d4037", "#3e2723", 0.03);
      break;
    }
    case "sniper": {
      ctx.rotate(angle);
      ctx.scale(s, s);
      ctx.fillStyle = col;
      ctx.fillRect(-0.12, -0.05, 0.5, 0.1);
      disc(ctx, -0.08, 0, 0.12, "#37474f", "#263238", 0.025);
      disc(ctx, 0.28, 0, 0.05, "#fff59d");
      break;
    }
    case "tesla": {
      ctx.scale(s, s);
      disc(ctx, 0, 0, 0.16, col, "#01579b", 0.03);
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.035;
      for (let i = 0; i < 3; i++) {
        const a = now / 180 + i * 2.1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 0.28, Math.sin(a) * 0.28);
        ctx.stroke();
      }
      disc(ctx, 0, 0, 0.06, "#e1f5fe");
      break;
    }
    case "poison": {
      ctx.scale(s, s);
      disc(ctx, 0, 0.04, 0.2, col, "#33691e", 0.03);
      oval(ctx, 0, -0.16, 0.08, 0.16, "#81c784", "#2e7d32", 0.02);
      disc(ctx, -0.08, 0, 0.05, "#7cb342");
      disc(ctx, 0.1, 0.06, 0.04, "#aed581");
      break;
    }
    case "mortar": {
      ctx.rotate(angle - Math.PI / 2);
      ctx.scale(s, s);
      disc(ctx, 0, 0.08, 0.18, "#6d4c41", "#3e2723", 0.03);
      ctx.fillStyle = col;
      ctx.fillRect(-0.07, -0.32, 0.14, 0.36);
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 0.03;
      ctx.strokeRect(-0.07, -0.32, 0.14, 0.36);
      break;
    }
    case "laser": {
      ctx.rotate(angle);
      ctx.scale(s, s);
      disc(ctx, -0.06, 0, 0.14, "#37474f", "#000", 0.025);
      ctx.fillStyle = col;
      ctx.fillRect(0.02, -0.04, 0.32, 0.08);
      if (active) {
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillRect(0.34, -0.015, 0.18, 0.03);
      }
      break;
    }
    case "spike": {
      ctx.scale(s, s);
      ctx.fillStyle = col;
      for (let i = 0; i < 4 + lv; i++) {
        const a = (i * Math.PI * 2) / (4 + lv) + now / 4000;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 0.28, Math.sin(a) * 0.28);
        ctx.lineTo(Math.cos(a + 0.25) * 0.1, Math.sin(a + 0.25) * 0.1);
        ctx.closePath();
        ctx.fill();
      }
      disc(ctx, 0, 0, 0.08, "#4a148c");
      break;
    }
    case "goldmine": {
      ctx.scale(s, s);
      ctx.fillStyle = col;
      ctx.fillRect(-0.18, -0.08, 0.36, 0.28);
      ctx.strokeStyle = "#5d4037";
      ctx.lineWidth = 0.03;
      ctx.strokeRect(-0.18, -0.08, 0.36, 0.28);
      disc(ctx, 0, 0.04, 0.1, "#fff8e1", "#ff8f00", 0.025);
      ctx.fillStyle = "#8d6e63";
      ctx.fillRect(-0.04, -0.26, 0.08, 0.2);
      break;
    }
    case "rocket": {
      ctx.rotate(angle + Math.PI / 2);
      ctx.scale(s, s);
      oval(ctx, 0, -0.04, 0.1, 0.22, col, "#bf360c", 0.03);
      ctx.beginPath();
      ctx.moveTo(-0.1, 0.12);
      ctx.lineTo(-0.18, 0.26);
      ctx.lineTo(-0.02, 0.16);
      ctx.moveTo(0.1, 0.12);
      ctx.lineTo(0.18, 0.26);
      ctx.lineTo(0.02, 0.16);
      ctx.strokeStyle = "#bf360c";
      ctx.lineWidth = 0.03;
      ctx.stroke();
      disc(ctx, 0, -0.2, 0.05, "#fff59d");
      break;
    }
    case "crossbow": {
      ctx.rotate(angle);
      ctx.scale(s, s);
      ctx.strokeStyle = col; ctx.lineWidth = 0.055;
      ctx.beginPath(); ctx.arc(0.02, 0, 0.22, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 0.03;
      ctx.beginPath(); ctx.moveTo(0.12, -0.2); ctx.lineTo(0.12, 0.2); ctx.stroke();
      ctx.fillStyle = "#efebe9";
      ctx.fillRect(-0.16, -0.025, 0.36, 0.05);
      break;
    }
    case "railgun": {
      ctx.rotate(angle);
      ctx.scale(s, s);
      ctx.fillStyle = "#455a64";
      ctx.fillRect(-0.14, -0.1, 0.2, 0.2);
      ctx.fillStyle = col;
      ctx.fillRect(0.0, -0.06, 0.46, 0.05);
      ctx.fillRect(0.0, 0.01, 0.46, 0.05);
      disc(ctx, -0.04, 0, 0.07, "#81d4fa", "#0277bd", 0.02);
      if (active) { ctx.globalAlpha = alpha * 0.8; disc(ctx, 0.46, 0, 0.06, "#e1f5fe"); }
      break;
    }
    case "flame": {
      ctx.rotate(angle);
      ctx.scale(s, s);
      disc(ctx, -0.08, 0, 0.17, "#6d4c41", "#3e2723", 0.03);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0.05, -0.1); ctx.lineTo(0.34, -0.04);
      ctx.lineTo(0.34, 0.04); ctx.lineTo(0.05, 0.1);
      ctx.closePath(); ctx.fill();
      if (active) {
        const f = 0.5 + 0.5 * Math.sin(now / 60);
        ctx.globalAlpha = alpha * (0.5 + f * 0.4);
        disc(ctx, 0.42, 0, 0.09 + f * 0.04, "#ffb74d");
        ctx.globalAlpha = alpha;
      }
      break;
    }
    case "boomerang": {
      ctx.rotate(now / 150);
      ctx.scale(s, s);
      ctx.strokeStyle = col; ctx.lineWidth = 0.1; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-0.2, 0.14); ctx.quadraticCurveTo(0, -0.22, 0.2, 0.14);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.03; ctx.stroke();
      break;
    }
    case "tornado": {
      ctx.scale(s, s);
      ctx.strokeStyle = col; ctx.lineWidth = 0.05;
      for (let i = 0; i < 3; i++) {
        const w = 0.26 - i * 0.07;
        const yy = -0.2 + i * 0.17;
        ctx.beginPath();
        ctx.ellipse(Math.sin(now / 200 + i) * 0.05, yy, w, 0.055, 0, 0, TAU);
        ctx.stroke();
      }
      break;
    }
    case "frostpillar": {
      ctx.scale(s, s);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -0.36); ctx.lineTo(0.16, -0.1); ctx.lineTo(0.1, 0.24);
      ctx.lineTo(-0.1, 0.24); ctx.lineTo(-0.16, -0.1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#0288d1"; ctx.lineWidth = 0.03; ctx.stroke();
      ctx.globalAlpha = alpha * (0.4 + 0.3 * Math.sin(now / 420));
      disc(ctx, 0, 0, 0.3, undefined, "#e1f5fe", 0.04);
      ctx.globalAlpha = alpha;
      break;
    }
    case "minefield": {
      ctx.scale(s, s);
      disc(ctx, 0, 0.05, 0.2, "#424242", "#212121", 0.03);
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        ctx.fillStyle = "#616161";
        ctx.fillRect(Math.cos(a) * 0.2 - 0.025, Math.sin(a) * 0.2 - 0.025 + 0.05, 0.05, 0.05);
      }
      disc(ctx, 0, 0.05, 0.07, active ? "#ff5252" : col);
      break;
    }
    case "prism": {
      ctx.rotate(now / 1800);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.moveTo(0, -0.28); ctx.lineTo(0.26, 0.16); ctx.lineTo(-0.26, 0.16);
      ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = "#f3e5f5"; ctx.lineWidth = 0.035; ctx.stroke();
      disc(ctx, 0, 0.02, 0.07, "rgba(255,255,255,0.85)");
      break;
    }
    case "bank": {
      ctx.scale(s, s);
      ctx.fillStyle = col;
      ctx.fillRect(-0.26, -0.06, 0.52, 0.3);
      ctx.strokeStyle = "#f57f17"; ctx.lineWidth = 0.03;
      ctx.strokeRect(-0.26, -0.06, 0.52, 0.3);
      ctx.beginPath();
      ctx.moveTo(-0.3, -0.06); ctx.lineTo(0, -0.3); ctx.lineTo(0.3, -0.06);
      ctx.closePath(); ctx.fillStyle = "#fff176"; ctx.fill(); ctx.stroke();
      for (let i = -1; i <= 1; i++) {
        ctx.fillStyle = "#f9a825";
        ctx.fillRect(i * 0.14 - 0.025, 0.0, 0.05, 0.2);
      }
      break;
    }
    case "obelisk": {
      ctx.scale(s, s);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -0.4); ctx.lineTo(0.13, -0.18); ctx.lineTo(0.13, 0.24);
      ctx.lineTo(-0.13, 0.24); ctx.lineTo(-0.13, -0.18);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#311b92"; ctx.lineWidth = 0.03; ctx.stroke();
      const pulse = 0.5 + 0.5 * Math.sin(now / 300);
      disc(ctx, 0, -0.02, 0.07 + pulse * 0.02, "#e1bee7");
      ctx.globalAlpha = alpha * (0.35 + pulse * 0.35);
      disc(ctx, 0, 0, 0.34, undefined, "#b388ff", 0.045);
      ctx.globalAlpha = alpha;
      break;
    }
    case "shotgun": {
      ctx.rotate(angle);
      ctx.scale(s, s);
      ctx.strokeStyle = col; ctx.lineWidth = 0.06; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-0.12, 0); ctx.lineTo(0.12, 0); ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(-0.06, -0.06, 0.12, 0.12);
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.03; ctx.strokeRect(-0.06, -0.06, 0.12, 0.12);
      break;
    }
    case "grenade": {
      ctx.rotate(angle);
      ctx.scale(s, s);
      disc(ctx, 0, 0, 0.16, col, "#5d4037", 0.03);
      ctx.beginPath(); ctx.arc(0, -0.14, 0.06, 0, Math.PI); ctx.fill();
      ctx.fillStyle = "#fff8e1"; disc(ctx, -0.03, -0.02, 0.025); disc(ctx, 0.03, -0.02, 0.025);
      break;
    }
    case "cutter": {
      ctx.rotate(angle);
      ctx.scale(s, s);
      ctx.fillStyle = col; ctx.fillRect(-0.04, -0.26, 0.08, 0.52);
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.03; ctx.strokeRect(-0.04, -0.26, 0.08, 0.52);
      disc(ctx, 0, -0.26, 0.05, "#fff59d");
      if (active) { ctx.globalAlpha = alpha * 0.7; ctx.fillRect(0.04, -0.26, 0.16, 0.03); ctx.globalAlpha = alpha; }
      break;
    }
    case "magnet": {
      ctx.scale(s, s);
      ctx.fillStyle = col; ctx.fillRect(-0.06, -0.06, 0.12, 0.12);
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.03; ctx.strokeRect(-0.06, -0.06, 0.12, 0.12);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.16, Math.sin(a) * 0.16);
        ctx.lineTo(Math.cos(a) * 0.24, Math.sin(a) * 0.24);
        ctx.strokeStyle = col; ctx.lineWidth = 0.04; ctx.stroke();
      }
      break;
    }
    case "medic": {
      ctx.scale(s, s);
      ctx.fillStyle = col; ctx.fillRect(-0.1, -0.08, 0.2, 0.16);
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.03; ctx.strokeRect(-0.1, -0.08, 0.2, 0.16);
      ctx.fillStyle = "#fff8e1"; ctx.fillRect(-0.06, -0.04, 0.04, 0.08); ctx.fillRect(0.02, -0.04, 0.04, 0.08);
      const pulse = 0.5 + 0.5 * Math.sin(now / 400);
      ctx.globalAlpha = alpha * pulse;
      disc(ctx, 0, 0, 0.18, undefined, "#81c784", 0.04);
      ctx.globalAlpha = alpha;
      break;
    }
    case "siege": {
      ctx.rotate(angle);
      ctx.scale(s, s);
      ctx.fillStyle = col; ctx.fillRect(-0.1, -0.05, 0.5, 0.1);
      disc(ctx, -0.08, 0, 0.14, "#37474f", "#263238", 0.03);
      disc(ctx, 0.3, 0, 0.06, "#ff5252");
      break;
    }
    case "trap": {
      ctx.scale(s, s);
      ctx.fillStyle = "#424242"; ctx.fillRect(-0.12, -0.04, 0.24, 0.08);
      ctx.strokeStyle = "#212121"; ctx.lineWidth = 0.03; ctx.strokeRect(-0.12, -0.04, 0.24, 0.08);
      for (let i = 0; i < 3; i++) {
        const xx = -0.08 + i * 0.08;
        disc(ctx, xx, 0, 0.03, "#ff5252");
      }
      break;
    }
    case "sonic": {
      ctx.rotate(angle);
      ctx.scale(s, s);
      ctx.fillStyle = col; ctx.fillRect(-0.06, -0.04, 0.32, 0.08);
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.03; ctx.strokeRect(-0.06, -0.04, 0.32, 0.08);
      ctx.fillStyle = "#e1bee7"; ctx.fillRect(0.02, -0.06, 0.04, 0.12);
      break;
    }
    case "chrono": {
      ctx.scale(s, s);
      ctx.fillStyle = col; ctx.fillRect(-0.1, -0.1, 0.2, 0.2);
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.03; ctx.strokeRect(-0.1, -0.1, 0.2, 0.2);
      const pulse = 0.5 + 0.5 * Math.sin(now / 200);
      ctx.globalAlpha = alpha * pulse;
      disc(ctx, 0, 0, 0.16 + pulse * 0.04, undefined, "#81d4fa", 0.04);
      ctx.globalAlpha = alpha;
      break;
    }
    case "nuke": {
      ctx.scale(s, s);
      ctx.fillStyle = col; ctx.fillRect(-0.14, -0.06, 0.28, 0.12);
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.03; ctx.strokeRect(-0.14, -0.06, 0.28, 0.12);
      disc(ctx, 0, 0, 0.07, "#fff176", "#d32f2f", 0.03);
      break;
    }
    default: {
      ctx.rotate(angle);
      ctx.scale(s, s);
      disc(ctx, 0, 0, 0.2, col, "rgba(0,0,0,0.4)", 0.03);
    }
  }
  ctx.restore();

  // 等级点
  for (let i = 0; i < lv; i++) {
    disc(ctx, (i - (lv - 1) / 2) * 0.12, 0.34, 0.04, "#fff", "#4e342e", 0.015);
  }
  ctx.restore();
}

/* ---------- 敌人 ---------- */
function eyes(
  ctx: CanvasRenderingContext2D, dx: number, y: number, r: number, look: number, angry = false,
): void {
  for (const sx of [-1, 1]) {
    disc(ctx, sx * dx, y, r, "#fff", "rgba(0,0,0,0.4)", 0.015);
    disc(ctx, sx * dx + Math.cos(look) * r * 0.35, y + Math.sin(look) * r * 0.35, r * 0.5, "#212121");
    if (angry) {
      ctx.beginPath();
      ctx.moveTo(sx * (dx + r * 1.2), y - r * 1.5);
      ctx.lineTo(sx * (dx - r * 1.0), y - r * 0.6);
      ctx.strokeStyle = "#212121";
      ctx.lineWidth = 0.035;
      ctx.stroke();
    }
  }
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, now: number): void {
  let alpha = 1;
  let scale = 1;
  if (e.state === "spawn") {
    const t = Math.min(e.stateTimer / SPAWN_TIME, 1);
    alpha = t;
    scale = 0.5 + 0.5 * t;
  } else if (e.state === "dying") {
    const t = Math.min(e.stateTimer / DYING_TIME, 1);
    alpha = 1 - t;
    scale = 1 + 0.35 * t;
  }
  const r = e.radius;
  const wob = Math.sin(now / 210 + e.id * 1.7);
  const lift = e.flying ? -0.18 + wob * 0.04 : -Math.abs(wob) * 0.03;

  ctx.save();
  // 影子
  ctx.globalAlpha = alpha * 0.28;
  oval(ctx, e.x, e.y + (e.flying ? 0.3 : r * 0.7), r * 0.9, r * 0.3, "#000");

  ctx.globalAlpha = alpha;
  ctx.translate(e.x, e.y + lift);
  ctx.scale(scale, scale);
  const look = e.angle;

  switch (e.kind) {
    case "grunt": {
      disc(ctx, -0.17, -0.2, 0.08, "#ef5350", "#b71c1c", 0.025);
      disc(ctx, 0.17, -0.2, 0.08, "#ef5350", "#b71c1c", 0.025);
      disc(ctx, 0, 0, r, "#ef5350", "#b71c1c", 0.04);
      oval(ctx, 0, 0.08, r * 0.7, r * 0.5, "rgba(255,205,210,0.5)");
      eyes(ctx, 0.095, -0.04, 0.075, look);
      ctx.beginPath();
      ctx.arc(0, 0.1, 0.07, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.strokeStyle = "#7f0000";
      ctx.lineWidth = 0.03;
      ctx.stroke();
      break;
    }
    case "flyer": {
      const flap = 0.5 + Math.sin(now / 70 + e.id) * 0.5;
      for (const sx of [-1, 1]) {
        ctx.save();
        ctx.translate(sx * 0.12, -0.04);
        ctx.rotate(sx * (0.2 + flap * 0.8));
        oval(ctx, sx * 0.14, 0, 0.19, 0.075, "#ce93d8", "#6a1b9a", 0.025);
        ctx.restore();
      }
      disc(ctx, 0, 0, r * 0.85, "#8e24aa", "#4a148c", 0.035);
      eyes(ctx, 0.07, -0.03, 0.058, look);
      break;
    }
    case "fatty": {
      ctx.translate(wob * 0.02, 0);
      disc(ctx, -0.27, -0.28, 0.1, "#ffb74d", "#e65100", 0.03);
      disc(ctx, 0.27, -0.28, 0.1, "#ffb74d", "#e65100", 0.03);
      disc(ctx, 0, 0, r, "#ffb74d", "#e65100", 0.045);
      oval(ctx, 0, 0.11, 0.26, 0.22, "#ffe0b2");
      eyes(ctx, 0.12, -0.1, 0.075, look, true);
      oval(ctx, 0, 0.04, 0.07, 0.045, "#d84315", "#bf360c", 0.015);
      break;
    }
    case "boss": {
      ctx.translate(0, wob * 0.015);
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 0.22, -0.34);
        ctx.lineTo(sx * 0.4, -0.66);
        ctx.lineTo(sx * 0.1, -0.44);
        ctx.closePath();
        ctx.fillStyle = "#ffd54f";
        ctx.fill();
        ctx.strokeStyle = "#f57f17";
        ctx.lineWidth = 0.03;
        ctx.stroke();
      }
      disc(ctx, 0, 0, r, "#7b1fa2", "#311b92", 0.05);
      oval(ctx, 0, 0.14, 0.34, 0.26, "#9c27b0");
      for (const sx of [-1, 1]) {
        disc(ctx, sx * 0.17, -0.1, 0.095, "#ffeb3b", "#b71c1c", 0.02);
        disc(ctx, sx * 0.17 + Math.cos(look) * 0.03, -0.1 + Math.sin(look) * 0.03, 0.045, "#d50000");
        ctx.beginPath();
        ctx.moveTo(sx * 0.3, -0.26);
        ctx.lineTo(sx * 0.07, -0.16);
        ctx.strokeStyle = "#1a0033";
        ctx.lineWidth = 0.05;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-0.2, 0.17);
      for (let i = 0; i <= 8; i++) ctx.lineTo(-0.2 + i * 0.05, 0.17 + (i % 2 === 0 ? 0 : 0.08));
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#1a0033";
      ctx.lineWidth = 0.025;
      ctx.stroke();
      break;
    }
    case "runner": {
      disc(ctx, 0, 0, r, "#26c6da", "#006064", 0.035);
      eyes(ctx, 0.08, -0.03, 0.055, look);
      oval(ctx, 0, 0.1, 0.12, 0.05, "#80deea");
      break;
    }
    case "armored": {
      disc(ctx, 0, 0, r, "#78909c", "#37474f", 0.04);
      ctx.strokeStyle = "#cfd8dc";
      ctx.lineWidth = 0.04;
      ctx.strokeRect(-r * 0.55, -r * 0.55, r * 1.1, r * 1.1);
      eyes(ctx, 0.09, -0.04, 0.06, look, true);
      break;
    }
    case "healer": {
      disc(ctx, 0, 0, r, "#66bb6a", "#1b5e20", 0.035);
      eyes(ctx, 0.08, -0.04, 0.06, look);
      ctx.strokeStyle = "#c8e6c9";
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.moveTo(-0.08, 0.08);
      ctx.lineTo(0.08, 0.08);
      ctx.moveTo(0, 0.0);
      ctx.lineTo(0, 0.16);
      ctx.stroke();
      disc(ctx, 0, 0, r * 1.25, undefined, "rgba(129,199,132,0.5)", 0.03);
      break;
    }
    case "splitter": {
      disc(ctx, -0.08, 0, r * 0.7, "#80cbc4", "#00695c", 0.03);
      disc(ctx, 0.1, 0.04, r * 0.55, "#4db6ac", "#004d40", 0.03);
      eyes(ctx, 0.07, -0.04, 0.05, look);
      break;
    }
    case "swarmling": {
      disc(ctx, 0, 0, r, "#aed581", "#33691e", 0.03);
      disc(ctx, -0.05, -0.03, 0.035, "#fff");
      disc(ctx, 0.05, -0.03, 0.035, "#fff");
      break;
    }
    case "airship": {
      oval(ctx, 0, 0, r * 1.15, r * 0.7, "#90caf9", "#1565c0", 0.04);
      oval(ctx, 0, 0.12, r * 0.5, r * 0.22, "#ffe082", "#f9a825", 0.02);
      eyes(ctx, 0.12, -0.06, 0.06, look);
      const flap = Math.sin(now / 90 + e.id);
      oval(ctx, -r, flap * 0.04, 0.12, 0.05, "#bbdefb");
      oval(ctx, r, -flap * 0.04, 0.12, 0.05, "#bbdefb");
      break;
    }
    case "mage": {
      disc(ctx, 0, 0.04, r, "#7e57c2", "#311b92", 0.035);
      ctx.beginPath();
      ctx.moveTo(-0.16, -0.12);
      ctx.lineTo(0, -0.38);
      ctx.lineTo(0.16, -0.12);
      ctx.closePath();
      ctx.fillStyle = "#4527a0";
      ctx.fill();
      eyes(ctx, 0.08, -0.02, 0.055, look);
      disc(ctx, 0.16, -0.2, 0.05, "#ffe082");
      break;
    }
    case "brute": {
      disc(ctx, 0, 0, r, "#6d4c41", "#3e2723", 0.045);
      oval(ctx, 0, 0.12, 0.28, 0.2, "#8d6e63");
      eyes(ctx, 0.13, -0.08, 0.07, look, true);
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(-0.34, -0.08, 0.12, 0.28);
      ctx.fillRect(0.22, -0.08, 0.12, 0.28);
      break;
    }
    case "shieldman": {
      disc(ctx, 0, 0, r, "#607d8b", "#263238", 0.04);
      eyes(ctx, 0.09, -0.05, 0.058, look, true);
      ctx.fillStyle = "#b0bec5";
      ctx.beginPath();
      ctx.moveTo(-0.42, -0.2); ctx.lineTo(-0.16, -0.26);
      ctx.lineTo(-0.16, 0.26); ctx.lineTo(-0.42, 0.2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#455a64"; ctx.lineWidth = 0.035; ctx.stroke();
      break;
    }
    case "ghost": {
      ctx.globalAlpha = alpha * 0.82;
      ctx.beginPath();
      ctx.arc(0, -0.04, r, Math.PI, 0);
      ctx.lineTo(r, 0.2);
      for (let i = 0; i < 4; i++) {
        ctx.quadraticCurveTo(r - (i + 0.5) * r / 2, 0.3, r - (i + 1) * r / 2, 0.2);
      }
      ctx.lineTo(-r, 0.2);
      ctx.closePath();
      ctx.fillStyle = "#e8eaf6"; ctx.fill();
      ctx.strokeStyle = "#9fa8da"; ctx.lineWidth = 0.03; ctx.stroke();
      disc(ctx, -0.08, -0.06, 0.045, "#311b92");
      disc(ctx, 0.08, -0.06, 0.045, "#311b92");
      break;
    }
    case "carrier": {
      const hum = Math.sin(now / 160 + e.id);
      oval(ctx, 0, 0.02, r * 1.2, r * 0.55, "#90a4ae", "#37474f", 0.04);
      oval(ctx, 0, -0.14, r * 0.62, r * 0.42, "#b3e5fc", "#0277bd", 0.035);
      for (let i = -1; i <= 1; i++) {
        disc(ctx, i * 0.26, 0.18, 0.055, hum > 0 ? "#ffd54f" : "#ff8a65");
      }
      break;
    }
    case "golem": {
      ctx.translate(0, Math.abs(wob) * 0.02);
      disc(ctx, 0, 0, r, "#757575", "#263238", 0.05);
      ctx.fillStyle = "#9e9e9e";
      ctx.fillRect(-0.4, -0.12, 0.16, 0.34);
      ctx.fillRect(0.24, -0.12, 0.16, 0.34);
      ctx.strokeStyle = "#4e342e"; ctx.lineWidth = 0.03;
      ctx.strokeRect(-0.4, -0.12, 0.16, 0.34);
      ctx.strokeRect(0.24, -0.12, 0.16, 0.34);
      eyes(ctx, 0.14, -0.08, 0.07, look, true);
      ctx.strokeStyle = "#546e7a"; ctx.lineWidth = 0.035;
      ctx.beginPath(); ctx.moveTo(-0.16, 0.14); ctx.lineTo(0.16, 0.2); ctx.stroke();
      break;
    }
    case "bomber": {
      const tick = Math.sin(now / 110 + e.id) > 0;
      disc(ctx, 0, 0, r, tick ? "#ff7043" : "#d84315", "#3e2723", 0.035);
      disc(ctx, 0, -r - 0.06, 0.05, tick ? "#fff176" : "#f57f17");
      eyes(ctx, 0.08, -0.02, 0.05, look, true);
      break;
    }
    case "warlord": {
      ctx.translate(0, wob * 0.012);
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 0.26, -0.36);
        ctx.lineTo(sx * 0.52, -0.78);
        ctx.lineTo(sx * 0.12, -0.46);
        ctx.closePath();
        ctx.fillStyle = "#d50000"; ctx.fill();
        ctx.strokeStyle = "#311b92"; ctx.lineWidth = 0.03; ctx.stroke();
      }
      disc(ctx, 0, 0, r, "#311b92", "#000", 0.055);
      oval(ctx, 0, 0.16, 0.36, 0.26, "#4527a0");
      for (const sx of [-1, 1]) {
        disc(ctx, sx * 0.19, -0.1, 0.1, "#ff5252", "#000", 0.02);
        disc(ctx, sx * 0.19 + Math.cos(look) * 0.03, -0.1 + Math.sin(look) * 0.03, 0.048, "#fff176");
      }
      ctx.beginPath();
      ctx.moveTo(-0.22, 0.18);
      for (let i = 0; i <= 8; i++) ctx.lineTo(-0.22 + i * 0.055, 0.18 + (i % 2 === 0 ? 0 : 0.1));
      ctx.fillStyle = "#fff"; ctx.fill();
      ctx.strokeStyle = "#000"; ctx.lineWidth = 0.025; ctx.stroke();
      const g = 0.5 + 0.5 * Math.sin(now / 240);
      ctx.globalAlpha = alpha * (0.3 + g * 0.4);
      disc(ctx, 0, 0, r * 1.35, undefined, "#ff1744", 0.05);
      ctx.globalAlpha = alpha;
      break;
    }
    case "ghoul": {
      // 半透明猎手,隐身时更淡
      ctx.globalAlpha = alpha * (e.cloaked ? 0.3 : 0.85);
      disc(ctx, 0, 0.02, r, "#b39ddb", "#4a148c", 0.035);
      eyes(ctx, 0.09, -0.04, 0.06, look, true);
      ctx.strokeStyle = "#ede7f6"; ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(-r, 0.14);
      for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(-r + (i + 0.5) * (r / 2), 0.28, -r + (i + 1) * (r / 2), 0.14);
      ctx.stroke();
      ctx.globalAlpha = alpha;
      break;
    }
    case "mimic": {
      ctx.scale(1 + wob * 0.03, 1 - wob * 0.03);
      disc(ctx, 0, 0, r, "#90caf9", "#1565c0", 0.035);
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 0.03;
      ctx.strokeRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2);
      disc(ctx, 0, 0, r * 0.5, "rgba(255,255,255,0.5)");
      eyes(ctx, 0.07, -0.03, 0.05, look);
      break;
    }
    case "lava": {
      const g = 0.5 + 0.5 * Math.sin(now / 200 + e.id);
      disc(ctx, 0, 0, r * 1.15, `rgba(255,87,34,${0.18 + g * 0.2})`);
      disc(ctx, 0, 0, r, "#ff7043", "#bf360c", 0.04);
      disc(ctx, 0, 0.02, r * 0.55, "#ffca28");
      eyes(ctx, 0.09, -0.06, 0.055, look, true);
      break;
    }
    case "troll": {
      ctx.translate(wob * 0.02, 0);
      disc(ctx, 0, 0, r, "#8d6e63", "#3e2723", 0.045);
      oval(ctx, 0, 0.1, r * 0.7, r * 0.5, "#a1887f");
      eyes(ctx, 0.11, -0.06, 0.062, look, true);
      // 回血绿十字
      ctx.fillStyle = "#a5d6a7";
      ctx.fillRect(-0.035, -0.38, 0.07, 0.16);
      ctx.fillRect(-0.08, -0.315, 0.16, 0.07);
      break;
    }
    case "warlock": {
      ctx.translate(0, wob * 0.02);
      ctx.beginPath();
      ctx.moveTo(-0.2, 0.22); ctx.lineTo(0, -0.42); ctx.lineTo(0.2, 0.22);
      ctx.closePath();
      ctx.fillStyle = "#4527a0"; ctx.fill();
      ctx.strokeStyle = "#1a0033"; ctx.lineWidth = 0.03; ctx.stroke();
      disc(ctx, 0, 0.02, r * 0.55, "#311b92");
      disc(ctx, -0.045, 0, 0.028, "#ffeb3b");
      disc(ctx, 0.045, 0, 0.028, "#ffeb3b");
      disc(ctx, 0.2, -0.16, 0.05 + Math.sin(now / 240) * 0.012, "#b388ff");
      break;
    }
    case "dragonling": {
      const flap = 0.5 + Math.sin(now / 80 + e.id) * 0.5;
      for (const sx of [-1, 1]) {
        ctx.save();
        ctx.translate(sx * 0.14, -0.06);
        ctx.rotate(sx * (0.25 + flap * 0.7));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(sx * 0.34, -0.18);
        ctx.lineTo(sx * 0.22, 0.06);
        ctx.closePath();
        ctx.fillStyle = "#ef5350"; ctx.fill();
        ctx.strokeStyle = "#b71c1c"; ctx.lineWidth = 0.02; ctx.stroke();
        ctx.restore();
      }
      oval(ctx, 0, 0.02, r * 0.8, r * 0.95, "#43a047", "#1b5e20", 0.035);
      for (let i = 0; i < 3; i++) disc(ctx, 0, -r * 0.2 + i * r * 0.3, 0.035, "#c8e6c9");
      eyes(ctx, 0.1, -r * 0.45, 0.05, look, true);
      break;
    }
    case "herald": {
      const pulse = 0.5 + 0.5 * Math.sin(now / 320);
      ctx.globalAlpha = alpha * (0.25 + pulse * 0.35);
      disc(ctx, 0, 0, r * 1.5, undefined, "#ffd54f", 0.05);
      ctx.globalAlpha = alpha;
      disc(ctx, 0, 0, r, "#455a64", "#1a237e", 0.045);
      // 号角
      ctx.strokeStyle = "#ffd54f"; ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.28, 0.0); ctx.quadraticCurveTo(-0.44, -0.14, -0.3, -0.26);
      ctx.stroke();
      eyes(ctx, 0.1, -0.04, 0.06, look, true);
      break;
    }
  }

  // 状态:冻结 / 减速
  if (e.state === "frozen") {
    disc(ctx, 0, 0, r * 1.2, "rgba(179,229,252,0.62)", "#e1f5fe", 0.05);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 0.025;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      ctx.lineTo(-Math.cos(a) * r * 0.9, -Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
  } else if (e.state === "slowed") {
    disc(ctx, 0, 0, r * 1.08, "rgba(100,181,246,0.38)", "rgba(33,150,243,0.6)", 0.03);
  }
  if (e.poisonTimer > 0) {
    disc(ctx, 0, 0, r * 1.12, "rgba(139,195,74,0.35)", "rgba(104,159,56,0.7)", 0.03);
  }
  ctx.restore();

  // 血条(受伤后显示,Boss 始终显示)
  if ((e.hp < e.maxHp || e.kind === "boss") && e.state !== "dying" && e.state !== "spawn") {
    ctx.save();
    ctx.globalAlpha = 0.95;
    const w = Math.max(0.5, r * 1.7);
    drawBar(ctx, e.x, e.y + lift - r - 0.17, w, 0.075, e.hp / e.maxHp);
    ctx.restore();
  }
}

/* ---------- 障碍物 ---------- */
export function drawObstacle(
  ctx: CanvasRenderingContext2D, o: Obstacle, focused: boolean, now: number,
): void {
  ctx.save();
  ctx.translate(o.x, o.y);
  oval(ctx, 0, 0.3, 0.38, 0.12, "rgba(0,0,0,0.22)");
  switch (o.kind) {
    case "rock":
      ctx.beginPath();
      ctx.moveTo(-0.38, 0.28);
      ctx.lineTo(-0.3, -0.08);
      ctx.lineTo(-0.08, -0.32);
      ctx.lineTo(0.2, -0.25);
      ctx.lineTo(0.38, 0.05);
      ctx.lineTo(0.34, 0.28);
      ctx.closePath();
      ctx.fillStyle = "#9e9e9e";
      ctx.fill();
      ctx.strokeStyle = "#616161";
      ctx.lineWidth = 0.04;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-0.3, -0.08);
      ctx.lineTo(-0.08, -0.32);
      ctx.lineTo(0.05, -0.05);
      ctx.closePath();
      ctx.fillStyle = "#cfcfcf";
      ctx.fill();
      break;
    case "stump":
      ctx.fillStyle = "#8d6e63";
      ctx.fillRect(-0.3, -0.06, 0.6, 0.34);
      oval(ctx, 0, 0.28, 0.3, 0.1, "#6d4c41");
      oval(ctx, 0, -0.06, 0.3, 0.14, "#d7b98e", "#5d4037", 0.035);
      oval(ctx, 0, -0.06, 0.18, 0.08, undefined, "#a1887f", 0.025);
      oval(ctx, 0, -0.06, 0.07, 0.035, undefined, "#a1887f", 0.02);
      disc(ctx, -0.22, -0.14, 0.05, "#7cb342");
      break;
    case "chest":
      ctx.fillStyle = "#8d5524";
      ctx.fillRect(-0.34, -0.12, 0.68, 0.4);
      ctx.strokeStyle = "#3e2723";
      ctx.lineWidth = 0.04;
      ctx.strokeRect(-0.34, -0.12, 0.68, 0.4);
      ctx.beginPath();
      ctx.moveTo(-0.34, -0.12);
      ctx.quadraticCurveTo(0, -0.38, 0.34, -0.12);
      ctx.closePath();
      ctx.fillStyle = "#a9672e";
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffca28";
      ctx.fillRect(-0.07, -0.16, 0.14, 0.2);
      ctx.fillRect(-0.34, 0.04, 0.68, 0.06);
      disc(ctx, 0, -0.04, 0.03, "#5d4037");
      break;
  }
  ctx.restore();

  if (o.hp < o.maxHp) drawBar(ctx, o.x, o.y - 0.5, 0.6, 0.07, o.hp / o.maxHp);
  if (focused) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.strokeStyle = `rgba(255,82,82,${0.65 + pulse * 0.35})`;
    ctx.lineWidth = 0.05;
    disc(ctx, 0, 0, 0.5 + pulse * 0.04, undefined, ctx.strokeStyle);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 0.42, Math.sin(a) * 0.42);
      ctx.lineTo(Math.cos(a) * 0.62, Math.sin(a) * 0.62);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ---------- 萝卜 / 出怪口 / 弹道 ---------- */
export function drawCarrot(
  ctx: CanvasRenderingContext2D, x: number, y: number, lives: number, maxLives: number, now: number,
): void {
  const sway = Math.sin(now / 520);
  ctx.save();
  ctx.translate(x, y + 0.02);
  const sc = 1 + Math.sin(now / 380) * 0.015;
  ctx.scale(sc, sc);
  oval(ctx, 0, 0.36, 0.28, 0.09, "rgba(0,0,0,0.25)");
  // 叶子
  for (const [rot, len] of [[-0.55, 0.26], [0, 0.32], [0.55, 0.26]] as const) {
    ctx.save();
    ctx.translate(0, -0.2);
    ctx.rotate(rot + sway * 0.1);
    oval(ctx, 0, -len * 0.55, 0.07, len * 0.6, "#66bb6a", "#2e7d32", 0.025);
    ctx.restore();
  }
  // 身体(满血时偏金色)
  const body = lives >= maxLives ? "#ffa726" : lives > maxLives * 0.4 ? "#fb8c00" : "#ef6c00";
  ctx.beginPath();
  ctx.moveTo(-0.24, -0.16);
  ctx.quadraticCurveTo(0, -0.3, 0.24, -0.16);
  ctx.quadraticCurveTo(0.2, 0.18, 0.03, 0.4);
  ctx.quadraticCurveTo(0, 0.43, -0.03, 0.4);
  ctx.quadraticCurveTo(-0.2, 0.18, -0.24, -0.16);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = "#bf360c";
  ctx.lineWidth = 0.035;
  ctx.stroke();
  ctx.strokeStyle = "rgba(191,54,12,0.45)";
  ctx.lineWidth = 0.02;
  for (const [yy, hw] of [[0.02, 0.1], [0.16, 0.07]] as const) {
    ctx.beginPath();
    ctx.moveTo(-hw, yy);
    ctx.lineTo(-hw + 0.06, yy + 0.015);
    ctx.stroke();
  }
  // 脸
  disc(ctx, -0.08, -0.06, 0.04, "#212121");
  disc(ctx, 0.08, -0.06, 0.04, "#212121");
  disc(ctx, -0.07, -0.075, 0.012, "#fff");
  disc(ctx, 0.09, -0.075, 0.012, "#fff");
  ctx.beginPath();
  if (lives > maxLives * 0.35) ctx.arc(0, 0.01, 0.06, 0.1 * Math.PI, 0.9 * Math.PI);
  else ctx.arc(0, 0.08, 0.05, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.strokeStyle = "#5d1f00";
  ctx.lineWidth = 0.03;
  ctx.stroke();
  ctx.restore();
}

export function drawPortal(ctx: CanvasRenderingContext2D, x: number, y: number, now: number): void {
  ctx.save();
  ctx.translate(x, y);
  disc(ctx, 0, 0, 0.42, "#311b92", "#7e57c2", 0.05);
  disc(ctx, 0, 0, 0.3, "#4527a0");
  ctx.rotate(now / 500);
  ctx.strokeStyle = "#b39ddb";
  ctx.lineWidth = 0.05;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, 0.2, (i * TAU) / 3, (i * TAU) / 3 + 1.4);
    ctx.stroke();
  }
  disc(ctx, 0, 0, 0.07, "#ede7f6");
  ctx.restore();
}

export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, now: number): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  switch (p.kind) {
    case "moon":
      disc(ctx, 0, 0, 0.17, "rgba(179,157,219,0.35)");
      disc(ctx, 0, 0, 0.1, "#d1c4e9", "#7e57c2", 0.025);
      break;
    case "star":
      ctx.rotate(now / 120);
      starPath(ctx, 0.14, 0.06, 5);
      ctx.fillStyle = "#e1f5fe";
      ctx.fill();
      ctx.strokeStyle = "#29b6f6";
      ctx.lineWidth = 0.025;
      ctx.stroke();
      break;
    default:
      disc(ctx, 0, 0, 0.075, "#e1f5fe", "#0288d1", 0.025);
      disc(ctx, -0.02, -0.02, 0.025, "#fff");
  }
  ctx.restore();
}
