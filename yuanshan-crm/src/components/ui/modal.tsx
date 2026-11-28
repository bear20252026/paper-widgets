import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

function Overlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-0 bg-[#101915]/45 backdrop-blur-[2px] animate-[fade-in_160ms_ease-out]"
      onClick={onClose}
    />
  );
}

function useDialogBehaviour(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onOpenChange,
  children,
  className,
  labelledBy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  useDialogBehaviour(open, () => onOpenChange(false));
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Overlay onClose={() => onOpenChange(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          "relative z-10 max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-lift",
          "animate-[modal-in_180ms_cubic-bezier(0.22,1,0.36,1)]",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Sheet({
  open,
  onOpenChange,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  useDialogBehaviour(open, () => onOpenChange(false));
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <Overlay onClose={() => onOpenChange(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed inset-y-0 right-0 z-10 flex w-full max-w-[600px] flex-col overflow-y-auto border-l border-border bg-[#FBFAF6] p-0 shadow-lift",
          "animate-[sheet-in_240ms_cubic-bezier(0.22,1,0.36,1)]",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  cancelLabel,
  confirmLabel,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  pending?: boolean;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} className="max-w-[420px]" labelledBy="confirm-title">
      <h3 id="confirm-title" className="font-serif text-[20px] font-semibold text-ink">
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onConfirm}
          disabled={pending}
          className="bg-destructive hover:bg-destructive/90"
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function IconButton({
  onClick,
  label,
  children,
  className,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className={cn("size-8 rounded-lg text-muted-foreground hover:text-foreground", className)}
    >
      {children}
    </Button>
  );
}

export function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <IconButton onClick={onClick} label={label} className="absolute right-4 top-4">
      <X className="size-4" />
    </IconButton>
  );
}
