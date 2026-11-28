import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => (
  <Sonner
    className="toaster group"
    toastOptions={{
      classNames: {
        toast:
          'group toast group-[.toaster]:bg-card group-[.toaster]:text-cocoa group-[.toaster]:border-2 group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-2xl group-[.toaster]:font-semibold',
        description: 'group-[.toast]:text-cocoa-soft',
        actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-cocoa',
        cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-cocoa-soft',
      },
    }}
    {...props}
  />
);

export { Toaster };
