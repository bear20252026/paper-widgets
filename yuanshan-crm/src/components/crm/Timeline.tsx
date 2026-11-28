import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Mail,
  Phone,
  StickyNote,
  Trash2,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api, queryKeys } from "@/lib/api";
import { useCrm } from "@/contexts/CrmContext";
import { useI18n } from "@/i18n";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Avatar } from "./Avatar";

const KINDS: { kind: "call" | "meeting" | "email" | "note"; icon: LucideIcon; placeholderKey: string }[] = [
  { kind: "call", icon: Phone, placeholderKey: "placeholderCall" },
  { kind: "meeting", icon: Users, placeholderKey: "placeholderMeeting" },
  { kind: "email", icon: Mail, placeholderKey: "placeholderEmail" },
  { kind: "note", icon: StickyNote, placeholderKey: "placeholderNote" },
];

const KIND_META: Record<Activity["kind"], { icon: LucideIcon; color: string; soft: string }> = {
  call: { icon: Phone, color: "#1E3A32", soft: "#E8EFE9" },
  meeting: { icon: Users, color: "#2F5E4F", soft: "#E7F0EB" },
  email: { icon: Mail, color: "#4A8270", soft: "#E1ECE7" },
  note: { icon: StickyNote, color: "#8A6B2F", soft: "#F5EED6" },
  stage_change: { icon: ArrowRightLeft, color: "#2C5246", soft: "#EEEBE1" },
  deal_won: { icon: Trophy, color: "#7A5E0E", soft: "#F5EED6" },
};

function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function Timeline({
  items,
  clientId,
}: {
  items: Activity[];
  clientId: number;
}) {
  const { m } = useI18n();
  const { me, consultantMap } = useCrm();
  const { relative, formatDate } = useFormat();
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<(typeof KINDS)[number]["kind"]>("call");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => toLocalInput(new Date()));
  const [followUp, setFollowUp] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.client(clientId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.clients });
    queryClient.invalidateQueries({ queryKey: queryKeys.recentActivities });
  };

  const add = useMutation({
    mutationFn: api.activities.add,
    onSuccess: () => {
      invalidate();
      setTitle("");
      setBody("");
      setFollowUp("");
      setOccurredAt(toLocalInput(new Date()));
      toast.success(m.timeline.saved);
    },
  });

  const remove = useMutation({
    mutationFn: api.activities.remove,
    onSuccess: invalidate,
  });

  const groups = useMemo(() => {
    const buckets = new Map<string, Activity[]>();
    for (const item of items) {
      const key = item.occurredAt.slice(0, 7);
      const existing = buckets.get(key);
      if (existing) existing.push(item);
      else buckets.set(key, [item]);
    }
    return [...buckets.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [items]);

  const placeholder = m.timeline[KINDS.find((item) => item.kind === kind)!.placeholderKey as keyof typeof m.timeline] as string;

  const submit = () => {
    if (!body.trim() && !title.trim()) {
      toast.error(m.timeline.writeSomething);
      return;
    }
    add.mutate({
      clientId,
      kind,
      title: title.trim() || m.timeline.defaultTitle.replace("{type}", m.activity[kind]),
      body: body.trim(),
      occurredAt: new Date(occurredAt).toISOString(),
      authorId: me?.id ?? 1,
      nextFollowUpAt: followUp ? new Date(`${followUp}T09:00:00`).toISOString() : undefined,
    });
  };

  return (
    <div>
      <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-1.5">
          {KINDS.map(({ kind: value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors",
                kind === value
                  ? "bg-ink text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-3.5" />
              {m.activity[value]}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2.5">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={placeholder}
            className="h-9"
          />
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={m.timeline.contentPlaceholder}
            rows={3}
          />
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[170px]">
              <span className="mb-1 block text-[11px] text-muted-foreground">{m.timeline.submit}</span>
              <Input
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                className="h-8 text-[12px]"
              />
            </label>
            <label className="flex-1 min-w-[150px]">
              <span className="mb-1 block text-[11px] text-muted-foreground">{m.timeline.nextFollowUp}</span>
              <Input
                type="date"
                value={followUp}
                onChange={(event) => setFollowUp(event.target.value)}
                className="h-8 text-[12px]"
              />
            </label>
            <Button size="sm" className="h-8 rounded-lg" onClick={submit} disabled={add.isPending}>
              {add.isPending ? m.common.saving : m.timeline.submit}
            </Button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">{m.timeline.empty}</div>
      ) : (
        <div className="mt-6 space-y-7">
          {groups.map(([month, entries]) => (
            <section key={month}>
              <div className="mb-3 flex items-center gap-2">
                <span className="eyebrow">
                  {formatDate(`${month}-01T12:00:00`, { year: "numeric", month: "long" })}
                </span>
                <span className="h-px flex-1 bg-border/70" />
              </div>
              <ol className="relative space-y-4 pl-[26px]">
                <span className="absolute bottom-2 left-[9px] top-1 w-px bg-border/70" aria-hidden />
                {entries.map((entry) => {
                  const meta = KIND_META[entry.kind];
                  const Icon = meta.icon;
                  const author = consultantMap.get(entry.authorId);
                  const text =
                    entry.kind === "stage_change"
                      ? m.timeline.stageChange
                          .replace("{from}", entry.fromStage ? m.stages[entry.fromStage].label : "")
                          .replace("{to}", entry.toStage ? m.stages[entry.toStage].label : "")
                      : entry.kind === "deal_won"
                        ? m.timeline.dealWon
                        : entry.title;

                  return (
                    <li key={entry.id} className="group relative">
                      <span
                        className="absolute -left-[26px] top-1 flex size-[18px] items-center justify-center rounded-full ring-4 ring-[#FBFAF6]"
                        style={{ background: meta.soft, color: meta.color }}
                      >
                        <Icon className="size-2.5" />
                      </span>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-[13.5px] font-medium text-foreground">{text}</span>
                            {entry.kind !== "stage_change" && entry.kind !== "deal_won" && (
                              <span className="text-[11.5px] text-muted-foreground">
                                {m.activity[entry.kind]}
                              </span>
                            )}
                          </div>
                          {entry.body && (
                            <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-foreground/70">
                              {entry.body}
                            </p>
                          )}
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {author && (
                              <>
                                <Avatar
                                  src={author.avatarUrl}
                                  name={author.name}
                                  size={16}
                                  color={author.color}
                                  className="ring-0"
                                />
                                <span>{author.name}</span>
                                <span className="opacity-40">·</span>
                              </>
                            )}
                            <span>{formatDate(entry.occurredAt, { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}</span>
                            <span className="opacity-40">·</span>
                            <span>{relative(entry.occurredAt)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={m.timeline.deleteEntry}
                          onClick={() => remove.mutate(entry.id)}
                          className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
