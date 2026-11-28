import { useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import { useFrame } from "../lib/clock";
import { out, seg } from "../lib/motion";
import { ENTER_END, ENTER_GROW, ENTER_RISE, ENTER_SCALE, ENTER_STAGGER, ENTER_START } from "../lib/timeline";
import styles from "./Tile.module.css";

type TileProps = {
  /** Order of entry, 0 … 6 */
  index: number;
  col: number;
  row: number;
  /** Spans two cells */
  wide?: boolean;
  /** The widget's own class: sets custom properties for its children (e.g. --label-left) */
  className?: string;
  children: ReactNode;
};

/** One paper tile on the 3 × 3 grid. It rises in, in turn, at the start of the loop. */
export function Tile({ index, col, row, wide = false, className, children }: TileProps) {
  const tile = useRef<HTMLDivElement>(null);

  useFrame(
    useCallback(
      (t: number) => {
        const el = tile.current;
        if (!el) return;
        const k = seg(t, ENTER_START + index * ENTER_STAGGER, ENTER_END + index * ENTER_STAGGER, out);
        el.style.opacity = String(k);
        el.style.transform = `translateY(${(1 - k) * ENTER_RISE}px) scale(${ENTER_SCALE + ENTER_GROW * k})`;
      },
      [index],
    ),
  );

  const place = { "--col": col, "--row": row } as CSSProperties;
  return (
    <div
      ref={tile}
      className={`${styles.tile} ${wide ? styles.wide : ""} ${className ?? ""}`}
      style={place}
    >
      {children}
    </div>
  );
}
