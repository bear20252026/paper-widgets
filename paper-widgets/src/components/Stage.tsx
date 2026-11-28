import { useLayoutEffect, useRef, type ReactNode } from "react";
import { STAGE } from "../lib/layout";
import styles from "./Stage.module.css";

/** The stage: a fixed 1080 square scaled to fit the window's shorter side, centred on the page. */
export function Stage({ label, children }: { label: string; children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => el.style.setProperty("--s", String(Math.min(window.innerWidth, window.innerHeight) / STAGE));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div ref={stage} className={styles.stage} role="img" aria-label={label}>
      {children}
    </div>
  );
}
