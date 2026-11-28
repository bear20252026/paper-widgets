import { isCellBuildable } from "../game/economy";
import { isTargetable } from "../game/enemy";
import { PRIORITY_INFO } from "../game/tower";
import { TOWER_DEFS, getLevelStats } from "../game/towerDefs";
import type { Effect, GameState, TowerKind } from "../game/types";
import {
  disc,
  drawCarrot,
  drawEnemy,
  drawLabel,
  drawObstacle,
  drawPortal,
  drawProjectile,
  drawTowerSprite,
} from "./sprites";
import { COLORS } from "./theme";

const TAU = Math.PI * 2;

/** 渲染层只读游戏状态;交互状态(悬停/选中)通过 view 传入。 */
export interface RenderView {
  hoverCell: { col: number; row: number } | null;
  selectedCell: { col: number; row: number } | null;
  selectedTowerId: number | null;
  armedKind: TowerKind | null;
  now: number;
}

/* ---------- 静态背景缓存(草地 + 路径),只在尺寸变化时重绘 ---------- */
let bgCache: { key: string; canvas: HTMLCanvasElement } | null = null;

function hash(c: number, r: number, k: number): number {
  let h = (Math.imul(c, 374761393) + Math.imul(r, 668265263) + Math.imul(k, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function buildBackground(state: GameState, ppc: number): HTMLCanvasElement {
  const { cols, rows } = state.level;
  const cvs = document.createElement("canvas");
  cvs.width = Math.max(1, Math.round(cols * ppc));
  cvs.height = Math.max(1, Math.round(rows * ppc));
  const g = cvs.getContext("2d");
  if (!g) return cvs;
  g.setTransform(cvs.width / cols, 0, 0, cvs.height / rows, 0, 0);
  g.lineCap = "round";

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      g.fillStyle = (r + c) % 2 === 0 ? COLORS.grassA : COLORS.grassB;
      g.fillRect(c, r, 1.02, 1.02);
    }
  }
  // 草丛与小花(确定性随机)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (state.grid[r][c] !== "ground") continue;
      for (let k = 0; k < 2; k++) {
        const x = c + 0.12 + hash(c, r, k * 3) * 0.76;
        const y = r + 0.12 + hash(c, r, k * 3 + 1) * 0.76;
        const t = hash(c, r, k * 3 + 2);
        if (t < 0.55) {
          g.strokeStyle = COLORS.grassEdge;
          g.lineWidth = 0.025;
          g.beginPath();
          g.moveTo(x - 0.04, y);
          g.lineTo(x - 0.02, y - 0.07);
          g.moveTo(x, y);
          g.lineTo(x + 0.01, y - 0.09);
          g.moveTo(x + 0.04, y);
          g.lineTo(x + 0.03, y - 0.06);
          g.stroke();
        } else if (t > 0.88) {
          g.fillStyle = t > 0.94 ? "#fff59d" : "#f8bbd0";
          g.beginPath();
          g.arc(x, y, 0.035, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }
  // 路径
  const isPath = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < cols && r < rows && state.grid[r][c] === "path";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isPath(c, r)) continue;
      g.fillStyle = COLORS.path;
      g.fillRect(c, r, 1.02, 1.02);
      g.fillStyle = COLORS.pathInner;
      g.fillRect(c + 0.09, r + 0.09, 0.84, 0.84);
    }
  }
  g.strokeStyle = COLORS.pathEdge;
  g.lineWidth = 0.07;
  g.lineCap = "butt";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isPath(c, r)) continue;
      g.beginPath();
      if (!isPath(c, r - 1) && r > 0) { g.moveTo(c, r); g.lineTo(c + 1, r); }
      if (!isPath(c, r + 1) && r < rows - 1) { g.moveTo(c, r + 1); g.lineTo(c + 1, r + 1); }
      if (!isPath(c - 1, r) && c > 0) { g.moveTo(c, r); g.lineTo(c, r + 1); }
      if (!isPath(c + 1, r) && c < cols - 1) { g.moveTo(c + 1, r); g.lineTo(c + 1, r + 1); }
      g.stroke();
    }
  }
  return cvs;
}

function getBackground(state: GameState, ppc: number): HTMLCanvasElement {
  const key = `${state.level.id}:${state.level.cols}x${state.level.rows}:${Math.round(ppc)}`;
  if (!bgCache || bgCache.key !== key) bgCache = { key, canvas: buildBackground(state, ppc) };
  return bgCache.canvas;
}

/* ---------- 特效 ---------- */
function drawEffect(ctx: CanvasRenderingContext2D, e: Effect): void {
  const life = Math.max(e.ttl / e.maxTtl, 0);
  const p = 1 - life;
  ctx.save();
  switch (e.kind) {
    case "beam":
      ctx.lineCap = "round";
      ctx.globalAlpha = life * 0.85;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = e.radius * (0.5 + 0.5 * life);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x2, e.y2);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = e.radius * 0.25;
      ctx.stroke();
      break;
    case "pulse":
      ctx.globalAlpha = life * 0.5;
      disc(ctx, e.x, e.y, e.radius * (0.35 + 0.65 * p), "rgba(255,213,79,0.35)", e.color, 0.05);
      break;
    case "ring":
      ctx.globalAlpha = life;
      disc(ctx, e.x, e.y, e.radius * (0.35 + 0.65 * p), undefined, e.color, 0.06);
      break;
    case "text":
      ctx.globalAlpha = Math.min(1, life * 2);
      drawLabel(ctx, e.text ?? "", e.x, e.y - p * 0.6, 0.3, e.color);
      break;
  }
  ctx.restore();
}

/* ---------- 场景 ---------- */
export function renderScene(
  ctx: CanvasRenderingContext2D, state: GameState, view: RenderView,
): void {
  const canvas = ctx.canvas;
  const { cols } = state.level;
  const ppc = canvas.width / cols;
  const now = view.now;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(getBackground(state, ppc), 0, 0, canvas.width, canvas.height);
  ctx.setTransform(ppc, 0, 0, ppc, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 悬停提示
  const hc = view.hoverCell;
  if (hc) {
    const free = isCellBuildable(state, hc.col, hc.row);
    if (free) {
      ctx.fillStyle = COLORS.hover;
      ctx.fillRect(hc.col + 0.04, hc.row + 0.04, 0.92, 0.92);
    }
  }
  // 选中的空格子
  if (view.selectedCell) {
    const { col, row } = view.selectedCell;
    const pulse = 0.5 + 0.5 * Math.sin(now / 180);
    ctx.fillStyle = "rgba(255,241,118,0.22)";
    ctx.fillRect(col, row, 1, 1);
    ctx.strokeStyle = COLORS.select;
    ctx.lineWidth = 0.06 + pulse * 0.03;
    ctx.strokeRect(col + 0.05, row + 0.05, 0.9, 0.9);
  }

  // 出怪口与萝卜
  for (const path of state.paths) {
    const s = path.points[0];
    drawPortal(ctx, s.x, s.y, now);
  }
  const drawnEnds = new Set<string>();
  for (const path of state.paths) {
    const e = path.points[path.points.length - 1];
    const key = `${e.x},${e.y}`;
    if (drawnEnds.has(key)) continue;
    drawnEnds.add(key);
    drawCarrot(ctx, e.x, e.y, state.lives, state.maxLives, now);
  }

  // 障碍物
  for (const o of state.obstacles) drawObstacle(ctx, o, state.focusObstacleId === o.id, now);

  // 炮塔
  for (const t of state.towers) {
    drawTowerSprite(ctx, t.kind, t.level, t.x, t.y, t.angle, t.target !== null, now);
  }

  // 射程圈(选中炮塔)与放置预览(已选塔 + 悬停)
  if (view.selectedTowerId !== null) {
    const t = state.towers.find((x) => x.id === view.selectedTowerId);
    if (t) {
      const range = getLevelStats(t.kind, t.level).range;
      ctx.beginPath();
      ctx.arc(t.x, t.y, range, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.range;
      ctx.fill();
      ctx.lineWidth = 0.04;
      ctx.strokeStyle = COLORS.rangeStroke;
      ctx.setLineDash([0.18, 0.12]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = COLORS.select;
      ctx.lineWidth = 0.05;
      ctx.strokeRect(t.col + 0.03, t.row + 0.03, 0.94, 0.94);
      // 当前攻击优先级:直接标在塔头顶,不用回面板确认
      drawLabel(ctx, PRIORITY_INFO[t.priority].label, t.x, t.y - 0.62, 0.3, "#fff59d");
    }
  }
  if (view.armedKind && hc && isCellBuildable(state, hc.col, hc.row)) {
    const range = TOWER_DEFS[view.armedKind].levels[0].range;
    ctx.beginPath();
    ctx.arc(hc.col + 0.5, hc.row + 0.5, range, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.range;
    ctx.fill();
    ctx.lineWidth = 0.03;
    ctx.strokeStyle = COLORS.rangeStroke;
    ctx.stroke();
    drawTowerSprite(ctx, view.armedKind, 1, hc.col + 0.5, hc.row + 0.5, -Math.PI / 2, false, now, 0.65);
  }

  // 敌人:地面怪按 y 排序(下方遮挡上方),弹道在中间,飞行怪在最上层
  const ground = state.enemies.filter((e) => !e.flying).sort((a, b) => a.y - b.y);
  const air = state.enemies.filter((e) => e.flying);
  for (const e of ground) drawEnemy(ctx, e, now);
  for (const p of state.projectiles) drawProjectile(ctx, p, now);
  for (const e of air) drawEnemy(ctx, e, now);

  // 被攻击中的目标标记(仅可被选中的敌人)
  for (const t of state.towers) {
    if (t.target?.type !== "enemy") continue;
    const e = state.enemies.find((x) => x.id === t.target?.id);
    if (e && isTargetable(e) && view.selectedTowerId === t.id) {
      disc(ctx, e.x, e.y, e.radius + 0.1, undefined, "rgba(255,82,82,0.9)", 0.04);
    }
  }

  // 地面危险区(熔岩火场):先铺地,再叠特效
  for (const h of state.hazards) {
    const life = Math.max(0, Math.min(1, h.ttl / 5));
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.25 * life;
    disc(ctx, h.x, h.y, h.radius * (0.85 + 0.15 * Math.sin(now / 120)), "rgba(255,87,34,0.55)", "#ff7043", 0.05);
    ctx.globalAlpha = 0.75 * life;
    for (let i = 0; i < 3; i++) {
      const a = now / 260 + (i * TAU) / 3;
      disc(ctx, h.x + Math.cos(a) * h.radius * 0.45, h.y + Math.sin(a) * h.radius * 0.45, 0.09, "#ffca28");
    }
    ctx.restore();
  }

  for (const fx of state.effects) drawEffect(ctx, fx);
}
