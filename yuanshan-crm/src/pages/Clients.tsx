import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Plus, Search } from "lucide-react";
import { api, queryKeys } from "@/lib/api";
import { useCrm } from "@/contexts/CrmContext";
import { interpolate, useI18n } from "@/i18n";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STAGES, STAGE_META, type Client, type Stage } from "@/lib/types";
import { PageHeader } from "@/components/crm/PageHeader";
import { ConsultantFilter } from "@/components/crm/ConsultantFilter";
import { CompanyLogo } from "@/components/crm/CompanyLogo";
import { Avatar } from "@/components/crm/Avatar";
import { StageBadge } from "@/components/crm/StagePieces";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type SortKey = "recent" | "amount" | "company";

function comparator(sort: SortKey) {
  return (a: Client, b: Client) => {
    if (sort === "amount") return b.amount - a.amount;
    if (sort === "company") return a.company.localeCompare(b.company, "zh-Hans-CN");
    return (b.lastActivityAt ?? b.updatedAt).localeCompare(a.lastActivityAt ?? a.updatedAt);
  };
}

export function Clients() {
  const { m } = useI18n();
  const { money, followUp, relative } = useFormat();
  const { openClient, setNewClientOpen, consultantMap } = useCrm();
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [sort, setSort] = useState<SortKey>("recent");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: queryKeys.clients,
    queryFn: api.clients.list,
  });

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return clients
      .filter((client) => {
        if (owner != null && client.consultantId !== owner) return false;
        if (stage && client.stage !== stage) return false;
        if (!term) return true;
        return [client.company, client.contactName, client.city ?? "", client.projectName ?? "", client.email ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort(comparator(sort));
  }, [clients, owner, query, sort, stage]);

  const counts = useMemo(() => {
    const base = clients.filter((client) => owner == null || client.consultantId === owner);
    return {
      all: base.length,
      lead: base.filter((client) => client.stage === "lead").length,
      contact: base.filter((client) => client.stage === "contact").length,
      proposal: base.filter((client) => client.stage === "proposal").length,
      negotiation: base.filter((client) => client.stage === "negotiation").length,
      won: base.filter((client) => client.stage === "won").length,
    };
  }, [clients, owner]);

  const subtitle =
    rows.length === 1
      ? interpolate(m.clients.subtitleOne, { n: rows.length })
      : interpolate(m.clients.subtitle, { n: rows.length });

  return (
    <div className="pb-14">
      <PageHeader
        eyebrow={m.clients.eyebrow}
        title={m.clients.title}
        description={subtitle}
        actions={
          <Button onClick={() => setNewClientOpen(true)}>
            <Plus className="size-4" />
            {m.nav.newClient}
          </Button>
        }
      />

      <div className="px-5 lg:px-10">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={m.clients.searchPlaceholder}
              className="h-[38px] w-[248px] rounded-xl border border-border/80 bg-white pl-9 pr-3 text-[12.5px] shadow-soft outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/15"
            />
          </div>

          <ConsultantFilter value={owner} onChange={setOwner} />

          <div className="relative ml-auto">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="h-[38px] appearance-none rounded-xl border border-border/80 bg-white pl-3 pr-8 text-[12.5px] shadow-soft outline-none focus:ring-2 focus:ring-ring/15"
            >
              <option value="recent">{m.clients.sortRecent}</option>
              <option value="amount">{m.clients.sortAmount}</option>
              <option value="company">{m.clients.sortCompany}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StageChip active={stage == null} label={m.clients.allStages} count={counts.all} onClick={() => setStage(null)} />
          {STAGES.map((item) => (
            <StageChip
              key={item}
              active={stage === item}
              label={m.stages[item].label}
              count={counts[item]}
              color={item === "won" ? "#C9A227" : STAGE_META[item].color}
              onClick={() => setStage(stage === item ? null : item)}
            />
          ))}
        </div>

        <div className="surface mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border/80 bg-[#FBFAF5] text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">{m.clients.colCompany}</th>
                  <th className="px-4 py-3 font-semibold">{m.clients.colContact}</th>
                  <th className="px-4 py-3 font-semibold">{m.clients.colStage}</th>
                  <th className="px-4 py-3 text-right font-semibold">{m.clients.colAmount}</th>
                  <th className="px-4 py-3 font-semibold">{m.clients.colOwner}</th>
                  <th className="px-4 py-3 font-semibold">{m.clients.colFollowUp}</th>
                  <th className="px-4 py-3 font-semibold">{m.clients.colLast}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="border-b border-border/60">
                      <td className="px-4 py-4" colSpan={7}>
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))}

                {!isLoading &&
                  rows.map((client) => {
                    const ownerRow = consultantMap.get(client.consultantId);
                    const follow = followUp(client.nextFollowUpAt);
                    return (
                      <tr
                        key={client.id}
                        tabIndex={0}
                        role="button"
                        onClick={() => openClient(client.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openClient(client.id);
                          }
                        }}
                        className="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-[#F7F6F0] focus:bg-[#F7F6F0] focus:outline-none"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <CompanyLogo logoKey={client.logoKey} company={client.company} size={32} />
                            <div className="min-w-0">
                              <div className="truncate text-[13.5px] font-medium text-ink">{client.company}</div>
                              <div className="truncate text-[11.5px] text-muted-foreground">
                                {[client.industry, client.city].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="truncate text-[12.5px]">{client.contactName}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {client.contactTitle ?? client.email ?? ""}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <StageBadge stage={client.stage} />
                        </td>
                        <td className="num px-4 py-3.5 text-right text-[13.5px] font-medium text-ink">
                          {money(client.amount)}
                        </td>
                        <td className="px-4 py-3.5">
                          {ownerRow && (
                            <div className="flex items-center gap-2">
                              <Avatar
                                src={ownerRow.avatarUrl}
                                name={ownerRow.name}
                                size={22}
                                color={ownerRow.color}
                                className="ring-0"
                              />
                              <span className="text-[12px] text-foreground/80">{ownerRow.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "whitespace-nowrap text-[12px]",
                              follow.kind === "overdue"
                                ? "font-medium text-[#A3311F]"
                                : follow.kind === "today"
                                  ? "font-medium text-ink"
                                  : "text-muted-foreground",
                            )}
                          >
                            {follow.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-[11.5px] text-muted-foreground">
                          {relative(client.lastActivityAt)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {!isLoading && rows.length === 0 && (
            <div className="px-6 py-14 text-center text-[13px] text-muted-foreground">{m.clients.empty}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StageChip({
  active,
  label,
  count,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
        active
          ? "border-ink/15 bg-ink text-primary-foreground"
          : "border-border/80 bg-white text-muted-foreground hover:text-ink",
      )}
    >
      {color && <span className="size-1.5 rounded-full" style={{ background: color }} />}
      {label}
      <span className={cn("tabular-nums", active ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
        {count}
      </span>
    </button>
  );
}
