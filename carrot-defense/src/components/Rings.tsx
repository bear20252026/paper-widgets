import { sellValue, upgradeCostOf } from "../game/economy";
import type { GameSession } from "../game/session";
import { TOWER_DEFS, TOWER_PAGES, buildCost } from "../game/towerDefs";
import type { TowerKind } from "../game/types";
import { useUI } from "../store";
import { cn } from "../utils/cn";

interface Props {
  session: GameSession;
  stageWidth: number;
  onBuild: (kind: TowerKind, col: number, row: number) => void;
  onUpgrade: (towerId: number) => void;
  onSell: (towerId: number) => void;
}

interface Pt {
  x: number;
  y: number;
}

/** 环形布局:放得下就用整圆,贴边时朝地图中心展开成扇形,最后夹紧到舞台内。 */
function ringLayout(count: number, cx: number, cy: number, W: number, H: number, r: number, btn: number): Pt[] {
  const pad = btn / 2 + 2;
  const inside = (p: Pt) => p.x >= pad && p.x <= W - pad && p.y >= pad && p.y <= H - pad;
  const full: Pt[] = Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
  if (full.every(inside)) return full;
  const base = Math.atan2(H / 2 - cy, W / 2 - cx);
  const step = (52 * Math.PI) / 180;
  return Array.from({ length: count }, (_, i) => {
    const a = base + (i - (count - 1) / 2) * step;
    return {
      x: Math.min(Math.max(cx + Math.cos(a) * r, pad), W - pad),
      y: Math.min(Math.max(cy + Math.sin(a) * r, pad), H - pad),
    };
  });
}

/** 画布上的浮层:空格 → 炮塔选择环;炮塔 → 升级 / 出售。 */
export function Rings({ session, stageWidth, onBuild, onUpgrade, onSell }: Props) {
  const selectedCell = useUI((s) => s.selectedCell);
  const selectedTowerId = useUI((s) => s.selectedTowerId);
  const gold = useUI((s) => s.hud?.gold ?? 0);
  const towerPage = useUI((s) => s.towerPage);
  useUI((s) => s.version);
  const pageKinds = TOWER_PAGES[towerPage]?.kinds ?? TOWER_PAGES[0].kinds;

  const { cols, rows } = session.state.level;
  const cell = stageWidth / cols;
  const W = stageWidth;
  const H = cell * rows;
  if (W <= 0) return null;
  const btn = Math.min(Math.max(cell * 0.82, 40), 54);

  if (selectedCell) {
    const cx = (selectedCell.col + 0.5) * cell;
    const cy = (selectedCell.row + 0.5) * cell;
    const r = Math.max(cell * 1.2, btn * 1.2);
    const pts = ringLayout(pageKinds.length, cx, cy, W, H, r, btn);
    return (
      <div className="pointer-events-none absolute inset-0 z-10">
        <span
          className="absolute rounded-full border-2 border-amber-200/80"
          style={{
            left: cx, top: cy, width: btn * 0.9, height: btn * 0.9,
            transform: "translate(-50%,-50%)", animation: "ringPulse 1.6s ease-out infinite",
          }}
        />
        {pageKinds.map((kind, i) => {
          const def = TOWER_DEFS[kind];
          const cost = buildCost(kind);
          const afford = gold >= cost;
          return (
            <button
              key={kind}
              type="button"
              title={`${i + 1}. ${def.name} — ${def.desc}`}
              onClick={(e) => {
                onBuild(kind, selectedCell.col, selectedCell.row);
                e.currentTarget.blur();
              }}
              className={cn(
                "tw pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-[3px] leading-none",
                afford
                  ? "border-[#2b1a08] bg-[radial-gradient(circle_at_34%_26%,#ffd76a,#e08a12)] text-[#3d1f00] hover:brightness-110"
                  : "border-[#1b2a20] bg-[radial-gradient(circle_at_34%_26%,#5d6b62,#333f38)] text-slate-300",
              )}
              style={{
                left: pts[i].x, top: pts[i].y, width: btn, height: btn,
                animation: `ringIn 0.2s cubic-bezier(0.22,1,0.36,1) ${i * 0.025}s backwards`,
                boxShadow: "0 5px 14px rgba(0,0,0,0.5)",
              }}
            >
              <span style={{ fontSize: btn * 0.4 }}>{def.icon}</span>
              <span className="dsp" style={{ fontSize: Math.max(9, btn * 0.26) }}>
                {cost}
              </span>
              <span className="dsp absolute -right-1 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-black/40 bg-sky-500 text-[9px] text-white">
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (selectedTowerId !== null) {
    const tower = session.state.towers.find((t) => t.id === selectedTowerId);
    if (!tower) return null;
    const cx = (tower.col + 0.5) * cell;
    const cy = (tower.row + 0.5) * cell;
    const r = Math.max(cell * 0.98, btn * 0.98);
    const above = cy - r >= btn / 2 + 2;
    const y = above ? cy - r : Math.min(cy + r, H - btn / 2 - 2);
    const d = btn * 0.62;
    const clampX = (x: number) => Math.min(Math.max(x, btn / 2 + 2), W - btn / 2 - 2);
    const upCost = upgradeCostOf(tower);
    const maxed = upCost === null;
    return (
      <div className="pointer-events-none absolute inset-0 z-10">
        <button
          type="button"
          title={maxed ? "已满级" : `升级(🪙${upCost})`}
          onClick={(e) => {
            onUpgrade(tower.id);
            e.currentTarget.blur();
          }}
          disabled={maxed}
          className={cn(
            "tw anim-pop pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-[3px] leading-none",
            maxed
              ? "border-amber-200 bg-[radial-gradient(circle_at_34%_26%,#ffe9a8,#ffc53d)] text-amber-950"
              : "border-[#0f3a12] bg-[radial-gradient(circle_at_34%_26%,#7ee06a,#2f9c2c)] text-[#06240a] hover:brightness-110",
          )}
          style={{ left: clampX(cx - d), top: y, width: btn, height: btn, boxShadow: "0 5px 14px rgba(0,0,0,0.5)" }}
        >
          <span style={{ fontSize: btn * 0.34 }}>{maxed ? "★" : "⬆"}</span>
          <span className="dsp" style={{ fontSize: Math.max(9, btn * 0.26) }}>
            {maxed ? "MAX" : upCost}
          </span>
        </button>
        <button
          type="button"
          title={`出售(返还 🪙${sellValue(tower)})`}
          onClick={(e) => {
            onSell(tower.id);
            e.currentTarget.blur();
          }}
          className="tw anim-pop pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-[3px] border-[#4a0f0c] bg-[radial-gradient(circle_at_34%_26%,#ff8a7a,#d1372c)] leading-none text-[#2b0503] hover:brightness-110"
          style={{
            left: clampX(cx + d), top: y, width: btn, height: btn,
            animationDelay: "0.05s", boxShadow: "0 5px 14px rgba(0,0,0,0.5)",
          }}
        >
          <span style={{ fontSize: btn * 0.34 }}>💰</span>
          <span className="dsp" style={{ fontSize: Math.max(9, btn * 0.26) }}>
            +{sellValue(tower)}
          </span>
        </button>
      </div>
    );
  }
  return null;
}
