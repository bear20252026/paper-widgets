import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import { useCrm } from "@/contexts/CrmContext";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

export function ConsultantFilter({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const { consultants } = useCrm();
  const { m } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = value != null ? consultants.find((item) => item.id === value) : null;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className={cn(
          "inline-flex h-[38px] items-center gap-2 rounded-xl border border-border/80 bg-white px-3 text-[12.5px] shadow-soft transition hover:bg-muted/40",
          open && "ring-2 ring-ring/15",
        )}
      >
        {current ? (
          <Avatar src={current.avatarUrl} name={current.name} size={20} color={current.color} className="ring-0" />
        ) : (
          <Users className="size-3.5 text-muted-foreground" />
        )}
        <span className="max-w-[130px] truncate">{current ? current.name : m.common.all}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-56 overflow-hidden rounded-xl border border-border bg-white p-1 shadow-lift animate-[fade-in_120ms_ease-out]">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted"
          >
            <span className="flex size-[22px] items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="size-3" />
            </span>
            <span className="flex-1">{m.common.all}</span>
            {value == null && <Check className="size-4 text-ink" />}
          </button>
          {consultants.map((consultant) => (
            <button
              key={consultant.id}
              type="button"
              onClick={() => {
                onChange(consultant.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted"
            >
              <Avatar
                src={consultant.avatarUrl}
                name={consultant.name}
                size={22}
                color={consultant.color}
                className="ring-0"
              />
              <span className="flex-1 truncate">{consultant.name}</span>
              {consultant.id === value && <Check className="size-4 text-ink" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
