import { Check } from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { STAGES, STAGE_META, type Stage } from "@/lib/types";

export function StageBadge({ stage }: { stage: Stage }) {
  const { m } = useI18n();
  const meta = STAGE_META[stage];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium"
      style={{ background: meta.soft, color: stage === "won" ? "#7A5E0E" : "#1E3A32" }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: stage === "won" ? "#C9A227" : meta.color }}
      />
      {m.stages[stage].label}
    </span>
  );
}

export function StageStepper({
  stage,
  onChange,
  disabled,
}: {
  stage: Stage;
  onChange: (stage: Stage) => void;
  disabled?: boolean;
}) {
  const { m } = useI18n();
  const index = STAGES.indexOf(stage);

  return (
    <div className="flex items-stretch gap-1">
      {STAGES.map((item, position) => {
        const reached = position <= index;
        const current = position === index;
        const isWon = item === "won";
        return (
          <button
            key={item}
            type="button"
            disabled={disabled}
            onClick={() => item !== stage && onChange(item)}
            title={m.client.moveTo.replace("{stage}", m.stages[item].label)}
            className={cn(
              "group flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-muted/70",
              current && "bg-muted/70",
              disabled && "cursor-not-allowed opacity-70",
            )}
          >
            <span
              className="h-1.5 w-full rounded-full transition-colors"
              style={{
                background: reached ? (isWon && current ? "#C9A227" : STAGE_META[item].color) : "#E6E3D9",
              }}
            />
            <span
              className={cn(
                "flex items-center gap-1 truncate text-[11.5px]",
                current ? "font-semibold text-ink" : "text-muted-foreground",
              )}
            >
              {current && <Check className="size-3 shrink-0" />}
              {m.stages[item].label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
