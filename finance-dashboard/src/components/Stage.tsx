import { useEffect, useRef, type ReactNode } from "react";

/** The composition is authored at 1624 × 900 and scaled as one piece, exactly like a sheet of paper laid on
 *  the wall: nothing inside reflows, the whole thing just gets smaller. */
const W = 1624;
const H = 900;

export function Stage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const fit = () => {
      const s = Math.min(window.innerWidth / W, window.innerHeight / H);
      host.style.setProperty("--s", String(s));
    };

    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="stage" ref={ref}>
      {children}
    </div>
  );
}
