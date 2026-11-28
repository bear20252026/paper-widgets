import { forwardRef } from "react";
import { CalendarCheck } from "lucide-react";
import { useCrm } from "@/contexts/CrmContext";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Client } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";

export interface DealCardProps extends React.HTMLAttributes<HTMLDivElement> {
  client: Client;
  overlay?: boolean;
  dragging?: boolean;
  justWon?: boolean;
}

export const DealCard = forwardRef<HTMLDivElement, DealCardProps>(function DealCard(
  { client, overlay, dragging, justWon, className, ...props },
  ref,
) {
  const { consultantMap } = useCrm();
  const { moneyParts, relative, shortDate, followUp } = useFormat();
  const owner = consultantMap.get(client.consultantId);
  const follow = client.stage !== "won" ? followUp(client.nextFollowUpAt) : null;
  const amount = moneyParts(client.amount);
  const isWon = client.stage === "won";

  return (
    <div
      ref={ref}
      {...props}
      className={cn(
        "group relative select-none rounded-[14px] border border-border/70 bg-white p-3.5 shadow-soft transition-[box-shadow,transform,opacity] duration-200",
        "hover:border-border hover:shadow-[0_2px_4px_rgba(23,38,31,0.05),0_16px_32px_-16px_rgba(23,38,31,0.22)]",
        dragging && "opacity-35",
        overlay && "rotate-[2deg] cursor-grabbing shadow-lift ring-1 ring-ink/10",
        justWon && "animate-won-glow",
        className,
      )}
    >
      {isWon && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-gold" />}

      <div className="flex items-start gap-2.5">
        <CompanyLogo logoKey={client.logoKey} company={client.company} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-5 text-foreground">
            {client.company}
          </div>
          <div className="truncate text-[12px] text-muted-foreground">
            {client.industry}
            {client.city ? ` · ${client.city}` : ""}
          </div>
        </div>
        {owner && (
          <Avatar
            src={owner.avatarUrl}
            name={owner.name}
            size={22}
            color={owner.color}
            className="ring-1"
          />
        )}
      </div>

      {client.projectName && (
        <div className="mt-2.5 truncate text-[12.5px] text-foreground/70">{client.projectName}</div>
      )}

      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="num text-[24px] font-medium leading-none text-ink">¥{amount.value}</span>
        <span className="text-[12px] text-muted-foreground">{amount.unit}</span>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-dashed border-border pt-2.5">
        <Avatar
          src={client.contactAvatarUrl}
          name={client.contactName}
          size={22}
          className="ring-1"
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/80" title={client.contactTitle}>
          {client.contactName}
        </span>
        {isWon ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F5EED6] px-2 py-0.5 text-[11px] font-medium text-[#7A5E0E]">
            <CalendarCheck className="size-3" />
            {shortDate(client.closedAt)}
          </span>
        ) : follow && (follow.kind === "overdue" || follow.kind === "today") ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              follow.kind === "overdue" ? "bg-[#FBE9E7] text-[#A3311F]" : "bg-[#E8EFE9] text-ink",
            )}
          >
            <CalendarCheck className="size-3" />
            {follow.label}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">{relative(client.lastActivityAt)}</span>
        )}
      </div>
    </div>
  );
});
