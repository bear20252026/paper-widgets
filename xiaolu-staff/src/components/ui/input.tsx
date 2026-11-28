import * as React from 'react';
import { cn } from '@/lib/cn';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-2xl border-2 border-border bg-card px-3.5 py-2 text-sm font-semibold text-cocoa shadow-sm transition placeholder:text-cocoa-soft/60 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
