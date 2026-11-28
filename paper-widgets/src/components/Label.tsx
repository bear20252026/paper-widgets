import { type ReactNode } from "react";
import styles from "./Label.module.css";

/** A widget's label: a 6 px accent dot and the word, top left of its tile. */
export function Label({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`${styles.label} ${className ?? ""}`}>
      <i className={styles.dot} />
      {children}
    </div>
  );
}
