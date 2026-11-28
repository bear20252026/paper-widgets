import * as React from 'react';
import { cn } from '@/lib/cn';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-[var(--radius)] border-2 border-border bg-card text-card-foreground shadow-[0_4px_0_0_rgba(236,220,195,0.6)]', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-5', className)} {...props} />,
);
CardContent.displayName = 'CardContent';

export { Card, CardContent };
