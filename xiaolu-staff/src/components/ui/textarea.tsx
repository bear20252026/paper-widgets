import * as React from 'react';
import { cn } from '@/lib/cn';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[84px] w-full rounded-2xl border-2 border-border bg-card px-3.5 py-2.5 text-sm font-semibold text-cocoa shadow-sm transition placeholder:text-cocoa-soft/60 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
