import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarClock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { api, queryKeys } from "@/lib/api";
import { useCrm } from "@/contexts/CrmContext";
import { useI18n, interpolate, plural } from "@/i18n";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Client, Stage } from "@/lib/types";
import { Button, buttonStyles } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/modal";
import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";
import { ClientFormDialog } from "./ClientFormDialog";
import { StageStepper } from "./StagePieces";
import { Timeline } from "./Timeline";

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2 text-[13px]">
      <span className="flex w-[88px] shrink-0 items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground/90">{children}</span>
    </div>
  );
}

export function ClientDetail({ id, variant }: { id: number; variant: "drawer" | "page" }) {
  const { m } = useI18n();
  const { me, consultantMap, closeClient } = useCrm();
  const { moneyParts, followUp, shortDate, longDate } = useFormat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.client(id),
    queryFn: () => api.clients.get(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    queryClient.invalidateQueries({ queryKey: queryKeys.client(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.recentActivities });
  };

  const update = useMutation({
    mutationFn: (stage: Stage) => api.clients.update(id, { stage }),
    onSuccess: (client, stage) => {
      invalidate();
      if (stage === "won") {
        toast.success(m.kanban.wonToast.replace("{company}", client.company), {
          description: interpolate(m.client.wonToastBody, { amount: `${moneyParts(client.amount).value}${moneyParts(client.amount).unit}` }),
        });
      } else {
        toast(interpolate(m.client.movedTo, { stage: m.stages[stage].label }));
      }
    },
  });

  const remove = useMutation({
    mutationFn: () => api.clients.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivities });
      toast.success(m.client.deleted);
      closeClient();
      if (variant === "page") navigate("/clients");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-10 text-center text-sm text-muted-foreground">{m.client.notFound}</div>;
  }

  const { client, timeline } = data;
  const owner = consultantMap.get(client.consultantId);
  const follow = client.stage !== "won" ? followUp(client.nextFollowUpAt) : null;
  const amount = moneyParts(client.amount);

  const header = (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <CompanyLogo logoKey={client.logoKey} company={client.company} size={60} className="shadow-soft" />
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="truncate font-serif text-[24px] font-semibold leading-tight text-ink">
            {client.company}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3.5" />
              {client.industry}
            </span>
            {client.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {client.city}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 rounded-2xl bg-background px-4 py-3.5 ring-1 ring-border/70">
        <div>
          <div className="eyebrow">{m.client.opportunity}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="num text-[38px] font-medium leading-none text-ink">¥{amount.value}</span>
            <span className="text-sm text-muted-foreground">{amount.unit}</span>
          </div>
        </div>
        <div className="text-right text-[12.5px] text-muted-foreground">
          <div className="text-foreground/85">{client.projectName ?? m.common.defaultProject}</div>
          <div className="mt-0.5">
            {client.stage === "won"
              ? interpolate(m.client.signedOn, { date: shortDate(client.closedAt) })
              : interpolate(m.client.expectedClose, {
                  date: shortDate(client.expectedCloseAt ?? client.nextFollowUpAt),
                })}
          </div>
        </div>
      </div>

      <div>
        <div className="eyebrow mb-2">{m.client.stage}</div>
        <StageStepper stage={client.stage} onChange={(stage) => update.mutate(stage)} disabled={update.isPending} />
      </div>

      <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <Avatar src={client.contactAvatarUrl} name={client.contactName} size={46} className="ring-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">{client.contactName}</div>
            <div className="text-[12.5px] text-muted-foreground">
              {client.contactTitle ?? m.common.contact}
            </div>
          </div>
        </div>

        <div className="mt-3 divide-y divide-border/70 border-t border-border/70">
          <DetailRow icon={<Mail className="size-3.5" />} label={m.client.email}>
            {client.email ? (
              <a href={`mailto:${client.email}`} className="hover:underline">
                {client.email}
              </a>
            ) : (
              "—"
            )}
          </DetailRow>
          <DetailRow icon={<Phone className="size-3.5" />} label={m.client.phone}>
            {client.phone ? (
              <a href={`tel:${client.phone}`} className="tabular-nums hover:underline">
                {client.phone}
              </a>
            ) : (
              "—"
            )}
          </DetailRow>
          <DetailRow icon={<span className="size-3.5" />} label={m.client.owner}>
            {owner ? (
              <span className="inline-flex items-center gap-1.5">
                <Avatar src={owner.avatarUrl} name={owner.name} size={20} color={owner.color} className="ring-0" />
                {owner.name}
              </span>
            ) : (
              "—"
            )}
          </DetailRow>
          <DetailRow icon={<CalendarClock className="size-3.5" />} label={m.client.nextFollowUp}>
            {follow && follow.kind !== "none" ? (
              <span
                className={cn(
                  follow.kind === "overdue" && "font-medium text-[#A3311F]",
                  follow.kind === "today" && "font-medium text-ink",
                )}
              >
                {longDate(client.nextFollowUpAt)} · {follow.label}
              </span>
            ) : (
              "—"
            )}
          </DetailRow>
        </div>

        {client.notes && (
          <p className="mt-3 rounded-xl bg-background px-3 py-2.5 text-[13px] leading-relaxed text-foreground/80">
            {client.notes}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setEditOpen(true)}>
          <Pencil className="size-3.5" />
          {m.common.edit}
        </Button>
        {variant === "drawer" && (
          <Link
            to={`/clients/${client.id}`}
            onClick={closeClient}
            className={buttonStyles({ variant: "outline", size: "sm", className: "rounded-lg" })}
          >
            <ArrowUpRight className="size-3.5" />
            {m.client.fullPage}
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto rounded-lg text-muted-foreground hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-3.5" />
          {m.common.delete}
        </Button>
      </div>
    </div>
  );

  const history = (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-serif text-[18px] font-semibold text-ink">{m.client.historyTitle}</h3>
        <span className="text-[12px] text-muted-foreground">
          {plural(m.client.entriesOne, m.client.entries, timeline.length, {
            name: me?.name ?? m.common.consultant,
          })}
        </span>
      </div>
      <Timeline items={timeline} clientId={client.id} />
    </div>
  );

  return (
    <>
      {variant === "drawer" ? (
        <div className="space-y-8 p-6">
          {header}
          {history}
        </div>
      ) : (
        <div className="grid gap-8 px-5 pb-16 lg:grid-cols-[400px_minmax(0,1fr)] lg:px-10">
          <div className="lg:sticky lg:top-6 lg:self-start">{header}</div>
          <div className="surface p-5 lg:p-7">{history}</div>
        </div>
      )}

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={client as Client} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={interpolate(m.client.deleteTitle, { company: client.company })}
        description={plural(m.client.deleteBodyOne, m.client.deleteBody, timeline.length)}
        cancelLabel={m.common.cancel}
        confirmLabel={m.common.delete}
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
