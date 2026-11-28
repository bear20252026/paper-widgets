import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

/* ============ 统一按钮 ============
 * 所有可点元素走同一套尺寸 / 配色 / 触感,保证最小点击区 ≥40px,
 * 文字永不被压缩截断(shrink-0 + whitespace-nowrap)。
 */

export type BtnTone = "orange" | "gold" | "green" | "red" | "slate" | "ghost";
export type BtnSize = "xs" | "sm" | "md" | "lg";

const TONE: Record<BtnTone, string> = {
  orange: "bg-[linear-gradient(180deg,#ff9b35,#e8720c)] border-[#9c4700] text-[#331400]",
  gold: "bg-[linear-gradient(180deg,#ffd45c,#eda80c)] border-[#9a6a00] text-[#3a2600]",
  green: "bg-[linear-gradient(180deg,#59c64f,#2e8e27)] border-[#17571a] text-[#042207]",
  red: "bg-[linear-gradient(180deg,#f05a4e,#c32b20)] border-[#7d1812] text-[#fff1ef]",
  slate: "bg-[linear-gradient(180deg,#4a6657,#2c4336)] border-[#16261c] text-[#e8f6ec]",
  ghost: "bg-black/30 border-black/50 text-cream/85 hover:bg-black/45",
};

const SIZE: Record<BtnSize, string> = {
  xs: "h-8 min-w-8 px-2 text-[11px] rounded-lg border-b-[3px]",
  sm: "h-9 min-w-9 px-2.5 text-xs rounded-xl border-b-[3px]",
  md: "h-11 min-w-11 px-4 text-sm rounded-xl border-b-4",
  lg: "h-13 min-w-13 px-6 text-base rounded-2xl border-b-4",
};

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: BtnTone;
  size?: BtnSize;
  active?: boolean;
  block?: boolean;
  icon?: ReactNode;
}

export function Btn({
  tone = "slate", size = "sm", active, block, icon, className, children, ...rest
}: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      onClick={(e) => {
        rest.onClick?.(e);
        e.currentTarget.blur();
      }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-2 font-extrabold",
        "shadow-[0_4px_10px_rgba(0,0,0,0.3)] transition-[transform,filter] duration-100",
        "hover:brightness-110 active:translate-y-[2px] active:border-b-2",
        "disabled:cursor-default disabled:saturate-50 disabled:brightness-75 disabled:active:translate-y-0",
        "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-amber-300 focus-visible:outline-offset-2",
        TONE[active ? "gold" : tone],
        SIZE[size],
        block && "w-full",
        className,
      )}
    >
      {icon && <span className="shrink-0 leading-none">{icon}</span>}
      {children}
    </button>
  );
}

/** 图标按钮:强制正方形,避免被 flex 压扁。 */
export function IconBtn({ size = "sm", className, children, ...rest }: BtnProps) {
  return (
    <Btn
      {...rest}
      size={size}
      className={cn("!px-0 aspect-square", size === "md" && "w-11", size === "sm" && "w-9", className)}
    >
      {children}
    </Btn>
  );
}

/* ============ 五点强度条 ============ */

export function StatDots({
  label, value, color = "#ffc53d", max = 5,
}: { label: string; value: number; color?: string; max?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-8 shrink-0 text-[10px] font-bold text-emerald-100/55">{label}</span>
      <span className="flex gap-[3px]">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className="h-2 w-2.5 rounded-[2px] transition-colors"
            style={{ background: i < value ? color : "rgba(255,255,255,0.13)" }}
          />
        ))}
      </span>
    </div>
  );
}

/** 横向强度条(用于敌人威胁度等)。 */
export function StatBar({
  label, ratio, color = "#ff7a1a", hint,
}: { label: string; ratio: number; color?: string; hint?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-bold text-emerald-100/55">{label}</span>
        {hint && <span className="dsp text-[10px] text-cream/70">{hint}</span>}
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-black/45">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%`, background: color }}
        />
      </div>
    </div>
  );
}

/** 小标签(定位 / 对空 / 难度)。 */
export function Chip({
  children, className, tone,
}: { children: ReactNode; className?: string; tone?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-[1px] text-[10px] font-black leading-[1.4]",
        className,
      )}
      style={tone ? { background: tone, color: "#13240f" } : undefined}
    >
      {children}
    </span>
  );
}
