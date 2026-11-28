import { useRef, type ReactNode } from "react";
import { t } from "../i18n";
import { Icon, BrandMark } from "./Icon";
import { useDialog } from "./useDialog";

export function Overlay({ onClose, children, className = "", z = "z-50" }: { onClose: () => void; children: ReactNode; className?: string; z?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(true, ref, onClose);
  return (
    <div className={`dialog-backdrop pointer-events-auto ${z}`}>
      <button type="button" aria-label={t("关闭弹窗背景")} className="dialog-scrim" tabIndex={-1} onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={t("游戏面板")} tabIndex={-1} className={`polished-dialog ${className}`}>{children}</div>
    </div>
  );
}

export function ModalHeader({ eyebrow, title, subtitle, onClose, right }: { eyebrow: string; title: string; subtitle?: string; onClose: () => void; right?: ReactNode }) {
  return (
    <div className="dialog-header">
      <div><div className="dialog-kicker">{eyebrow}</div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      <div className="dialog-header-actions">{right}<button className="icon-button" type="button" onClick={onClose} aria-label={t("关闭")}><Icon name="close" /></button></div>
    </div>
  );
}

export interface TabItem { id: string; label: string; badge?: number }
export function Tabs({ items, value, onChange }: { items: TabItem[]; value: string; onChange: (id: string) => void }) {
  return <div className="quiet-tabs" role="tablist">{items.map((item) => (
    <button key={item.id} type="button" role="tab" aria-selected={value === item.id} onClick={() => onChange(item.id)} className={value === item.id ? "is-active" : ""}>{item.label}{!!item.badge && <sup>{item.badge}</sup>}</button>
  ))}</div>;
}

export function Progress({ value, max, tone = "mint", className = "", height = "h-1.5" }: { value: number; max: number; tone?: "mint" | "gold" | "coral" | "ink"; className?: string; height?: string }) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, value / max * 100));
  const colour = { mint: "#8aa18a", gold: "#ceae6a", coral: "#d89072", ink: "#4d6957" }[tone];
  return <div className={`flat-progress ${className} ${height}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}><span style={{ width: `${pct}%`, background: colour }} /></div>;
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string; accent?: boolean }) {
  return <div className="quiet-stat"><label>{label}</label><strong>{value}</strong>{sub && <small>{sub}</small>}</div>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className="relative h-6 w-11 shrink-0 rounded-full transition-colors" style={{ background: checked ? "#769179" : "#d9dfd1" }}><span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all" style={{ left: checked ? 22 : 2 }} /></button>;
}

export function RewardChip({ coins = 0, gems = 0, label }: { coins?: number; gems?: number; label?: string; compact?: boolean }) {
  return <div className="reward-values">{coins > 0 && <span><Icon name="coin" />{coins}</span>}{gems > 0 && <span><Icon name="gem" />{gems}</span>}{label && <small>{label}</small>}</div>;
}

export function SeasonEmblem({ className = "" }: { className?: string }) {
  return <BrandMark className={className} />;
}