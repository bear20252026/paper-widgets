import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { api, queryKeys } from "@/lib/api";
import { interpolate, useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { STAGES, STAGE_META, type Client, type Stage } from "@/lib/types";
import { useFormat } from "@/lib/format";
import { DealCard } from "./DealCard";

function DraggableCard({
  client,
  onOpen,
  justWon,
}: {
  client: Client;
  onOpen: (id: number) => void;
  justWon: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: client.id,
    data: { stage: client.stage },
  });

  return (
    <DealCard
      ref={setNodeRef}
      client={client}
      dragging={isDragging}
      justWon={justWon}
      onClick={() => onOpen(client.id)}
      className="cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
    />
  );
}

function Column({
  stage,
  clients,
  onOpen,
  justWonId,
}: {
  stage: Stage;
  clients: Client[];
  onOpen: (id: number) => void;
  justWonId: number | null;
}) {
  const { m } = useI18n();
  const { money } = useFormat();
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = clients.reduce((sum, client) => sum + client.amount, 0);
  const meta = STAGE_META[stage];

  return (
    <div className="flex w-[292px] shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: meta.color }} />
          <span className="text-[12.5px] font-semibold text-ink">{m.stages[stage].label}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {clients.length}
          </span>
        </div>
        <span className="text-[11.5px] tabular-nums text-muted-foreground">{money(total)}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[520px] flex-1 flex-col gap-2.5 rounded-2xl border border-transparent p-2.5 transition-colors",
          "bg-[#EFEDE6]/55",
          isOver && "border-dashed border-ink/25 bg-[#E8EFE9]",
          stage === "won" && "bg-[#EFEDE6]/40",
        )}
      >
        {clients.map((client) => (
          <DraggableCard
            key={client.id}
            client={client}
            onOpen={onOpen}
            justWon={justWonId === client.id}
          />
        ))}

        {clients.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/80 px-3 py-8 text-center text-[12px] text-muted-foreground">
            {stage === "won" ? m.kanban.dropWonHere : m.kanban.empty}
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  clients,
  onOpen,
}: {
  clients: Client[];
  onOpen: (id: number) => void;
}) {
  const { m } = useI18n();
  const { money } = useFormat();
  const queryClient = useQueryClient();
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [justWonId, setJustWonId] = useState<number | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const move = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: Stage }) => api.clients.move(id, stage),
    onSuccess: (updated, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivities });
      const client = clients.find((item) => item.id === variables.id);
      if (!client) return;
      if (updated.stage === "won") {
        setJustWonId(client.id);
        window.setTimeout(() => setJustWonId(null), 1200);
        toast.success(interpolate(m.kanban.wonToast, { company: client.company }), {
          description: interpolate(m.kanban.wonToastBody, {
            project: client.projectName ?? m.common.defaultProject,
            amount: money(client.amount),
          }),
        });
      } else {
        toast(interpolate(m.kanban.movedToast, {
          company: client.company,
          stage: m.stages[updated.stage].label,
        }), { description: m.kanban.movedToastBody });
      }
    },
    onError: (error) => toast.error(interpolate(m.kanban.moveFailed, { error: error.message })),
  });

  const onDragStart = (event: DragStartEvent) => {
    const id = Number(event.active.id);
    setActiveClient(clients.find((client) => client.id === id) ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveClient(null);
    const over = event.over?.id;
    const active = clients.find((client) => client.id === Number(event.active.id));
    if (!active || !over) return;
    const stage = over as Stage;
    if (!STAGES.includes(stage) || stage === active.stage) return;
    move.mutate({ id: active.id, stage });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveClient(null)}
    >
      <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            clients={clients.filter((client) => client.stage === stage)}
            onOpen={onOpen}
            justWonId={justWonId}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeClient ? <DealCard client={activeClient} overlay className="w-[276px]" /> : null}
      </DragOverlay>
    </DndContext>
  );
}
