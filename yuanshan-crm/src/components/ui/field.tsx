import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-xl border border-input bg-white px-3 text-[13px] text-foreground shadow-xs outline-none transition",
          "placeholder:text-muted-foreground/70 focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/15",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-input bg-white px-3 py-2.5 text-[13px] leading-relaxed text-foreground shadow-xs outline-none transition",
          "placeholder:text-muted-foreground/70 focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/15",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "h-9 w-full appearance-none rounded-xl border border-input bg-white px-3 pr-8 text-[13px] text-foreground shadow-xs outline-none transition",
            "focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/15 disabled:opacity-60",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
        >
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    );
  },
);

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-[12px] font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}
