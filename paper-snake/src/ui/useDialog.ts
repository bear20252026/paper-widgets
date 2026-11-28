import { useEffect, useRef, type RefObject } from "react";

export function useDialog(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const controls = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, [tabindex="0"]'))
      .filter((el) => el.getClientRects().length > 0);
    (controls()[0] ?? root).focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const all = controls();
      const first = all[0]; const last = all[all.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    root.addEventListener("keydown", handleKey);
    return () => { root.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [open, ref]);
}