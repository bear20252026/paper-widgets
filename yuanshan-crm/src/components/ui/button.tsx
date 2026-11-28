import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost" | "secondary" | "destructive";
type Size = "default" | "sm" | "icon" | "lg";

const variants: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground shadow-soft hover:bg-ink-soft",
  outline: "border border-border bg-white text-foreground shadow-xs hover:bg-muted/60",
  ghost: "text-foreground hover:bg-muted/70",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const sizes: Record<Size, string> = {
  default: "h-9 px-4 py-2 text-[13px]",
  sm: "h-8 gap-1.5 rounded-lg px-3 text-[12.5px]",
  icon: "size-9",
  lg: "h-10 rounded-xl px-6 text-sm",
};

export function buttonStyles({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-colors outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "default", type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonStyles({ variant, size, className })} {...props} />
  );
});
