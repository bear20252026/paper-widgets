import { useEffect, useRef, type ReactNode } from "react";
import type { GameSession } from "../game/session";
import { renderScene } from "../render/renderer";
import { useUI } from "../store";

interface Props {
  session: GameSession;
  onCellClick: (col: number, row: number) => void;
  onResize: (widthPx: number) => void;
  children?: ReactNode;
}

/**
 * 棋盘舞台:填满父容器的可用空间,按关卡宽高比取最大内接矩形。
 * 放置武器(armedKind)时画面**不缩放、不遮罩**,保持原样供玩家精准点格。
 */
export function GameCanvas({ session, onCellClick, onResize, children }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<{ col: number; row: number } | null>(null);
  const { cols, rows } = session.state.level;

  useEffect(() => {
    const host = hostRef.current;
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!host || !box || !canvas) return;

    const apply = () => {
      const availW = host.clientWidth;
      const availH = host.clientHeight;
      if (availW <= 0 || availH <= 0) return;
      const ratio = cols / rows;
      let w = availW;
      let h = w / ratio;
      if (h > availH) {
        h = availH;
        w = h * ratio;
      }
      w = Math.floor(w);
      h = Math.floor(h);
      box.style.width = `${w}px`;
      box.style.height = `${h}px`;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      onResize(w);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [cols, rows, onResize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    let raf = 0;
    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.max(0, (t - last) / 1000);
      last = t;
      const ui = useUI.getState();
      session.update(dt, ui.paused ? 0 : ui.speed);
      if (ctx && canvas && canvas.width > 1) {
        renderScene(ctx, session.state, {
          hoverCell: hoverRef.current,
          selectedCell: ui.selectedCell,
          selectedTowerId: ui.selectedTowerId,
          armedKind: ui.armedKind,
          now: t,
        });
      }
      ui.setHud(session.snapshot());
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [session]);

  const toCell = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const col = Math.floor(((clientX - rect.left) / rect.width) * cols);
    const row = Math.floor(((clientY - rect.top) / rect.height) * rows);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return { col, row };
  };

  return (
    <div ref={hostRef} className="flex min-h-0 w-full flex-1 items-center justify-center">
      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-2xl border-4 border-emerald-950/70 bg-emerald-700 shadow-2xl shadow-black/50"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-pointer"
          style={{ touchAction: "manipulation" }}
          onPointerMove={(e) => {
            if (e.pointerType === "mouse") hoverRef.current = toCell(e.clientX, e.clientY);
          }}
          onPointerLeave={() => {
            hoverRef.current = null;
          }}
          onClick={(e) => {
            const cell = toCell(e.clientX, e.clientY);
            if (cell) onCellClick(cell.col, cell.row);
          }}
        />
        {children}
      </div>
    </div>
  );
}
