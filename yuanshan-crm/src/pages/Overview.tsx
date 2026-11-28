import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Phone,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { api, queryKeys } from "@/lib/api";
import { useCrm } from "@/contexts/CrmContext";
import { interpolate, useI18n } from "@/i18n";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STAGES, STAGE_META, type ActivityKind, type Stage } from "@/lib/types";
import { PageHeader } from "@/components/crm/PageHeader";
import { Funnel } from "@/components/crm/Funnel";
import { CompanyLogo } from "@/components/crm/CompanyLogo";
import { Avatar } from "@/components/crm/Avatar";
import { MountainLines } from "@/components/crm/Brand";
import { Skeleton } from "@/components/ui/skeleton";

const ACTIVITY_ICON: Record<ActivityKind, typeof Phone> = {
  call: Phone,
  meeting: Users,
  email: ArrowRight,
  note: Sparkles,
  stage_change: ArrowRight,
  deal_won: Trophy,
};

function sameMonth(value: string | null | undefined, reference: Date): boolean {
  if (!value) return false;
  const date = new Date(value);
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

export function Overview() {
  const { m } = useI18n();
  const { me, consultants, consultantMap, openClient } = useCrm();
  const { money, moneyParts, relative, followUp, todayEyebrow, monthShort, greeting } = useFormat();
  const navigate = useNavigate();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: queryKeys.clients,
    queryFn: api.clients.list,
  });
  const { data: recent = [] } = useQuery({
    queryKey: queryKeys.recentActivities,
    queryFn: api.activities.recent,
  });

  const now = new Date();
  const stats = useMemo(() => {
    const wonThisMonth = clients.filter((client) => client.stage === "won" && sameMonth(client.closedAt, now));
    const wonLastMonth = clients.filter((client) => {
      if (client.stage !== "won" || !client.closedAt) return false;
      const date = new Date(client.closedAt);
      const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return date.getFullYear() === previous.getFullYear() && date.getMonth() === previous.getMonth();
    });

    const closedSum = wonThisMonth.reduce((sum, client) => sum + client.amount, 0);
    const lastMonthSum = wonLastMonth.reduce((sum, client) => sum + client.amount, 0);
    const openClients = clients.filter((client) => client.stage !== "won");
    const openSum = openClients.reduce((sum, client) => sum + client.amount, 0);
    const weighted = openClients.reduce(
      (sum, client) => sum + client.amount * STAGE_META[client.stage].probability,
      0,
    );
    const createdThisMonth = clients.filter((client) => sameMonth(client.createdAt, now)).length;

    const funnel = STAGES.map((stage) => {
      const rows =
        stage === "won" ? wonThisMonth : clients.filter((client) => client.stage === stage);
      return {
        stage,
        amount: rows.reduce((sum, client) => sum + client.amount, 0),
        count: rows.length,
      };
    });

    const dueAll = clients
      .filter((client) => client.stage !== "won" && followUp(client.nextFollowUpAt).days <= 0 && client.nextFollowUpAt)
      .sort((a, b) => (a.nextFollowUpAt ?? "").localeCompare(b.nextFollowUpAt ?? ""));
    const dueMine = me ? dueAll.filter((client) => client.consultantId === me.id) : [];

    const team = consultants.map((consultant) => {
      const won = wonThisMonth.filter((client) => client.consultantId === consultant.id);
      const open = openClients
        .filter((client) => client.consultantId === consultant.id)
        .reduce((sum, client) => sum + client.amount, 0);
      return {
        consultant,
        wonCount: won.length,
        wonSum: won.reduce((sum, client) => sum + client.amount, 0),
        openSum: open,
      };
    });

    return {
      wonThisMonth,
      closedSum,
      lastMonthSum,
      avgDeal: wonThisMonth.length ? closedSum / wonThisMonth.length : 0,
      openSum,
      weighted,
      createdThisMonth,
      funnel,
      dueAll,
      dueMine,
      team,
    };
  }, [clients, consultants, followUp, me, now]);

  const heroAmount = moneyParts(stats.closedSum);
  const delta =
    stats.lastMonthSum > 0
      ? Math.round(((stats.closedSum - stats.lastMonthSum) / stats.lastMonthSum) * 100)
      : null;

  const dueCount = stats.dueAll.length;
  const [dueScope, setDueScope] = useState<"mine" | "all">("all");
  const dueList = dueScope === "mine" ? stats.dueMine : stats.dueAll;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow={todayEyebrow}
        title={greeting(me?.name.split(" ")[0] ?? m.common.consultant)}
        description={
          dueCount > 0
            ? interpolate(m.overview.subtitleDue, { due: dueCount, won: stats.wonThisMonth.length })
            : interpolate(m.overview.subtitleClear, { won: stats.wonThisMonth.length })
        }
      />

      <div className="grid gap-4 px-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.62fr)] lg:px-10">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[22px] bg-ink p-7 text-primary-foreground shadow-lift lg:p-8">
          <MountainLines className="pointer-events-none absolute -bottom-2 left-0 h-28 w-full text-white/[0.12]" />
          <div className="absolute right-6 top-6 size-2.5 rounded-full bg-gold shadow-[0_0_0_6px_rgba(201,162,39,0.18)]" />
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary-foreground/55">
            {interpolate(m.overview.heroEyebrow, { month: monthShort })}
          </div>
          <div className="mt-4 flex items-end gap-2">
            <span className="num text-[58px] font-light leading-none tracking-tight lg:text-[64px]">
              ¥{heroAmount.value}
            </span>
            <span className="pb-1 font-serif text-[20px] text-primary-foreground/80">
              {heroAmount.unit}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] text-primary-foreground/85">
              <Trophy className="size-3" />
              {stats.lastMonthSum > 0
                ? interpolate(m.overview.lastMonth, { amount: money(stats.lastMonthSum) })
                : m.overview.noDealsLastMonth}
            </span>
            {delta != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-[11.5px] text-[#E9D48A]">
                {interpolate(m.overview.vsLastMonth, { delta })}
              </span>
            )}
          </div>

          <div className="mt-6 border-t border-white/12 pt-5">
            <div className="text-[12.5px] text-primary-foreground/75">
              {interpolate(m.overview.signedThisMonth, { n: stats.wonThisMonth.length })}
            </div>
            {stats.wonThisMonth.length > 0 && (
              <div className="mt-1 text-[12.5px] text-primary-foreground/60">
                {interpolate(m.overview.avgDeal, { amount: money(stats.avgDeal) })}
              </div>
            )}
            {stats.wonThisMonth.length === 0 && (
              <p className="mt-2 text-[13px] leading-relaxed text-primary-foreground/70">
                {m.overview.noDealsYet}
              </p>
            )}
          </div>

          {stats.wonThisMonth.length > 0 && (
            <div className="mt-auto space-y-2 pt-6">
              {stats.wonThisMonth.slice(0, 3).map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => openClient(client.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg py-1 text-left transition-opacity hover:opacity-80"
                >
                  <span className="size-1.5 rounded-full bg-gold" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-primary-foreground/85">
                    {client.company}
                  </span>
                  <span className="num text-[13px] text-primary-foreground/70">{money(client.amount)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="surface flex flex-col p-6 lg:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-[20px] font-semibold text-ink">{m.overview.funnelTitle}</h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{m.overview.funnelSubtitle}</p>
            </div>
            <Link
              to="/pipeline"
              className="inline-flex shrink-0 items-center gap-1 text-[12.5px] text-muted-foreground transition-colors hover:text-ink"
            >
              {m.overview.openPipeline}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-5 flex-1">
            {isLoading ? (
              <div className="space-y-3">
                {STAGES.map((stage) => (
                  <Skeleton key={stage} className="h-11 w-full" />
                ))}
              </div>
            ) : (
              <Funnel
                data={stats.funnel}
                onSelect={(stage: Stage) => navigate(`/pipeline?stage=${stage}`)}
              />
            )}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border/70 pt-5">
            {[
              { label: m.overview.statOpen, value: money(stats.openSum), hint: interpolate(m.overview.statOpenHint, { n: clients.filter((client) => client.stage !== "won").length }) },
              { label: m.overview.statWeighted, value: money(stats.weighted), hint: m.overview.statWeightedHint },
              { label: m.overview.statNew, value: String(stats.createdThisMonth), hint: m.overview.statNewHint },
            ].map((item) => (
              <div key={item.label}>
                <div className="eyebrow">{item.label}</div>
                <div className="num mt-1.5 text-[24px] font-medium leading-none text-ink">{item.value}</div>
                <div className="mt-1 text-[11.5px] text-muted-foreground">{item.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 px-5 lg:grid-cols-3 lg:px-10">
        <section className="surface flex flex-col p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-[17px] font-semibold text-ink">{m.overview.dueTitle}</h3>
            <DueToggle scope={dueScope} onChange={setDueScope} mine={stats.dueMine.length} all={stats.dueAll.length} />
          </div>
          <div className="mt-3 flex-1">
            {dueList.length === 0 ? (
              <div className="flex h-full min-h-[120px] items-center justify-center rounded-xl border border-dashed border-border/80 px-4 text-center text-[12.5px] text-muted-foreground">
                {m.overview.allCaughtUp}
              </div>
            ) : (
              <ul className="space-y-1">
                {dueList.slice(0, 4).map((client) => {
                  const follow = followUp(client.nextFollowUpAt);
                  const owner = consultantMap.get(client.consultantId);
                  return (
                    <li key={client.id}>
                      <button
                        type="button"
                        onClick={() => openClient(client.id)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-muted/60"
                      >
                        <CompanyLogo logoKey={client.logoKey} company={client.company} size={30} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium">{client.company}</div>
                          <div className="truncate text-[11.5px] text-muted-foreground">
                            {client.projectName ?? client.contactName}
                          </div>
                        </div>
                        {owner && (
                          <Avatar src={owner.avatarUrl} name={owner.name} size={20} color={owner.color} className="ring-0" />
                        )}
                        <span
                          className={cn(
                            "shrink-0 text-[11.5px]",
                            follow.kind === "overdue" ? "font-medium text-[#A3311F]" : "font-medium text-ink",
                          )}
                        >
                          {follow.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="surface p-5">
          <h3 className="font-serif text-[17px] font-semibold text-ink">{m.overview.recentTitle}</h3>
          <ul className="mt-3 space-y-1">
            {recent.slice(0, 5).map((activity) => {
              const Icon = ACTIVITY_ICON[activity.kind];
              const client = clients.find((item) => item.id === activity.clientId);
              return (
                <li key={activity.id}>
                  <button
                    type="button"
                    onClick={() => client && openClient(client.id)}
                    className="flex w-full items-start gap-2.5 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="size-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] text-foreground/85">
                        {activity.kind === "stage_change" ? m.activity.stage_change : activity.title || m.activity[activity.kind]}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {client?.company ?? ""} · {relative(activity.occurredAt)}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
            {recent.length === 0 && (
              <li className="py-6 text-center text-[12.5px] text-muted-foreground">{m.timeline.empty}</li>
            )}
          </ul>
        </section>

        <section className="surface p-5">
          <h3 className="font-serif text-[17px] font-semibold text-ink">{m.overview.teamTitle}</h3>
          <ul className="mt-3 space-y-2.5">
            {stats.team.map((row) => (
              <li key={row.consultant.id} className="flex items-center gap-2.5">
                <Avatar
                  src={row.consultant.avatarUrl}
                  name={row.consultant.name}
                  size={30}
                  color={row.consultant.color}
                  className="ring-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{row.consultant.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {interpolate(m.overview.teamOpen, { amount: money(row.openSum) })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-[15px] text-ink">{money(row.wonSum)}</div>
                  <div className="text-[10.5px] text-muted-foreground">
                    {interpolate(m.overview.teamWon, { n: row.wonCount })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function DueToggle({
  scope,
  onChange,
  mine,
  all,
}: {
  scope: "mine" | "all";
  onChange: (scope: "mine" | "all") => void;
  mine: number;
  all: number;
}) {
  const { m } = useI18n();
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border/80 bg-background p-0.5 text-[11.5px]">
      <button
        type="button"
        onClick={() => onChange("mine")}
        className={cn(
          "rounded-full px-2.5 py-1 transition-colors",
          scope === "mine" ? "bg-white font-medium text-ink shadow-soft" : "text-muted-foreground hover:text-ink",
        )}
      >
        {m.overview.mine} {mine}
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={cn(
          "rounded-full px-2.5 py-1 transition-colors",
          scope === "all" ? "bg-white font-medium text-ink shadow-soft" : "text-muted-foreground hover:text-ink",
        )}
      >
        {m.common.all} {all}
      </button>
    </div>
  );
}
