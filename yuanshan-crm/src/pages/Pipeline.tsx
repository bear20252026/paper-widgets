import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, X } from "lucide-react";
import { api, queryKeys } from "@/lib/api";
import { useCrm } from "@/contexts/CrmContext";
import { interpolate, useI18n } from "@/i18n";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STAGE_META, type Stage } from "@/lib/types";
import { PageHeader } from "@/components/crm/PageHeader";
import { ConsultantFilter } from "@/components/crm/ConsultantFilter";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { Button } from "@/components/ui/button";

export function Pipeline() {
  const { m } = useI18n();
  const { money } = useFormat();
  const { openClient, setNewClientOpen } = useCrm();
  const [params, setParams] = useSearchParams();
  const ownerParam = Number(params.get("owner"));
  const [owner, setOwner] = useState<number | null>(
    Number.isFinite(ownerParam) && ownerParam > 0 ? ownerParam : null,
  );
  const [query, setQuery] = useState("");

  const stageParam = params.get("stage");
  const stage = stageParam && stageParam in STAGE_META ? (stageParam as Stage) : null;

  const { data: clients = [], isLoading } = useQuery({
    queryKey: queryKeys.clients,
    queryFn: api.clients.list,
  });

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return clients.filter((client) => {
      if (owner != null && client.consultantId !== owner) return false;
      if (stage && client.stage !== stage) return false;
      if (!term) return true;
      return [client.company, client.contactName, client.city, client.projectName ?? "", client.email]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [clients, owner, query, stage]);

  const openValue = visible
    .filter((client) => client.stage !== "won")
    .reduce((sum, client) => sum + client.amount, 0);
  const weighted = visible
    .filter((client) => client.stage !== "won")
    .reduce((sum, client) => sum + client.amount * STAGE_META[client.stage].probability, 0);

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow={m.pipeline.eyebrow}
        title={m.pipeline.title}
        description={m.pipeline.description}
        actions={
          <Button onClick={() => setNewClientOpen(true)}>
            <Plus className="size-4" />
            {m.nav.newClient}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 px-5 pb-5 lg:px-10">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={m.pipeline.searchPlaceholder}
            className="h-[38px] w-[236px] rounded-xl border border-border/80 bg-white pl-9 pr-3 text-[12.5px] shadow-soft outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/15"
          />
        </div>

        <ConsultantFilter value={owner} onChange={setOwner} />

        {stage && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("stage");
              setParams(next, { replace: true });
            }}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-xl border border-ink/20 bg-white px-3 text-[12.5px] text-ink shadow-soft transition hover:bg-muted/40"
          >
            <span className="size-1.5 rounded-full" style={{ background: STAGE_META[stage].color }} />
            {interpolate(m.pipeline.stageFilter, { stage: m.stages[stage].label })}
            <X className="size-3.5 text-muted-foreground" />
          </button>
        )}

        <div className="ml-auto flex items-center gap-4 text-[11.5px] text-muted-foreground">
          <span>
            <span className="eyebrow mr-1.5">{m.overview.statOpen}</span>
            <span className="num text-[13px] text-ink">{money(openValue)}</span>
          </span>
          <span className="hidden sm:inline">
            <span className="eyebrow mr-1.5">{m.overview.statWeighted}</span>
            <span className="num text-[13px] text-ink">{money(weighted)}</span>
          </span>
          <span className="tabular-nums">
            {interpolate(m.pipeline.deals, { n: visible.length })}
          </span>
        </div>
      </div>

      <div className={cn("px-5 lg:px-10", isLoading && "opacity-60")}>
        {!isLoading && visible.length === 0 ? (
          <div className="surface px-6 py-20 text-center text-[13px] text-muted-foreground">
            {m.clients.empty}
          </div>
        ) : (
          <KanbanBoard clients={visible} onOpen={openClient} />
        )}
      </div>
    </div>
  );
}
