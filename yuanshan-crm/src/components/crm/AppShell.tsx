import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Globe, LayoutDashboard, Plus, SquareKanban, Users } from "lucide-react";
import { api, queryKeys } from "@/lib/api";
import { useCrm } from "@/contexts/CrmContext";
import { LOCALES, useI18n, type Locale } from "@/i18n";
import { useFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { MountainLines, Wordmark } from "./Brand";
import { Button } from "@/components/ui/button";

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);
  return ref;
}

function IdentityMenu({ compact = false }: { compact?: boolean }) {
  const { me, consultants, setMeId } = useCrm();
  const { m } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  if (!me) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className={cn(
          "flex items-center gap-2.5 rounded-xl text-left transition-colors hover:bg-sidebar-accent",
          compact ? "p-1" : "w-full p-2",
        )}
      >
        <Avatar src={me.avatarUrl} name={me.name} size={compact ? 30 : 34} color={me.color} className="ring-1" />
        {!compact && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{me.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{me.title}</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+6px)] left-0 z-40 w-56 rounded-xl border border-border bg-white p-1 shadow-lift animate-[fade-in_120ms_ease-out]">
          <div className="px-2.5 py-2 text-xs text-muted-foreground">{m.nav.switchIdentity}</div>
          <div className="mb-1 h-px bg-border" />
          {consultants.map((consultant) => (
            <button
              key={consultant.id}
              type="button"
              onClick={() => {
                setMeId(consultant.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted"
            >
              <Avatar
                src={consultant.avatarUrl}
                name={consultant.name}
                size={24}
                color={consultant.color}
                className="ring-0"
              />
              <span className="flex-1 truncate">{consultant.name}</span>
              {consultant.id === me.id && <Check className="size-4 text-ink" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LocaleMenu() {
  const { locale, setLocale, m } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        aria-label={m.brand.name}
      >
        <Globe className="size-3.5" />
        <span className="flex-1 text-left">{LOCALES[locale].name}</span>
        <ChevronDown className="size-3" />
      </button>
      {open && (
        <div className="absolute bottom-[calc(100%+4px)] left-0 z-40 w-44 rounded-xl border border-border bg-white p-1 shadow-lift animate-[fade-in_120ms_ease-out]">
          {(Object.keys(LOCALES) as Locale[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setLocale(key);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-muted"
            >
              <span className="flex-1">{LOCALES[key].name}</span>
              {locale === key && <Check className="size-3.5 text-ink" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const { m } = useI18n();
  const { pathname } = useLocation();
  const items = [
    { href: "/", key: "overview" as const, icon: LayoutDashboard },
    { href: "/pipeline", key: "pipeline" as const, icon: SquareKanban },
    { href: "/clients", key: "clients" as const, icon: Users },
  ];

  return (
    <nav className={cn(mobile ? "ml-2 flex flex-1 items-center gap-1 overflow-x-auto" : "space-y-0.5")}>
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              mobile
                ? "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px]"
                : "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors",
              active
                ? "bg-white font-medium text-ink shadow-soft ring-1 ring-black/[0.04]"
                : "text-foreground/70 hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            {!mobile && (
              <Icon className={cn("size-[17px]", active ? "text-ink" : "text-muted-foreground")} />
            )}
            {m.nav[item.key]}
          </Link>
        );
      })}
    </nav>
  );
}

function TeamList() {
  const { consultants } = useCrm();
  const { money } = useFormat();
  const { data: clients = [] } = useQuery({ queryKey: queryKeys.clients, queryFn: api.clients.list });

  const openByConsultant = useMemo(() => {
    const totals = new Map<number, number>();
    for (const client of clients) {
      if (client.stage === "won") continue;
      totals.set(client.consultantId, (totals.get(client.consultantId) ?? 0) + client.amount);
    }
    return totals;
  }, [clients]);

  return (
    <div className="space-y-0.5">
      {consultants.map((consultant) => (
        <Link
          key={consultant.id}
          to={`/pipeline?owner=${consultant.id}`}
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent"
        >
          <Avatar src={consultant.avatarUrl} name={consultant.name} size={22} color={consultant.color} className="ring-0" />
          <span className="flex-1 truncate">{consultant.name}</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {money(openByConsultant.get(consultant.id) ?? 0)}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { m } = useI18n();
  const { setNewClientOpen } = useCrm();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[224px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="px-5 pb-6 pt-6">
          <Link to="/">
            <Wordmark />
          </Link>
        </div>

        <div className="px-3">
          <Button
            onClick={() => setNewClientOpen(true)}
            className="mb-4 h-9 w-full justify-start gap-2 rounded-xl bg-ink text-[13px] shadow-soft hover:bg-ink-soft"
          >
            <Plus className="size-4" />
            {m.nav.newClient}
          </Button>
          <NavLinks />
        </div>

        <div className="mt-8 px-3">
          <div className="eyebrow mb-2 px-2">{m.nav.team}</div>
          <TeamList />
        </div>

        <div className="relative mt-auto">
          <MountainLines className="pointer-events-none absolute -top-16 left-0 h-16 w-full text-ink/15" />
          <div className="space-y-1 border-t border-sidebar-border p-3">
            <IdentityMenu />
            <LocaleMenu />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link to="/">
          <Wordmark compact />
        </Link>
        <NavLinks mobile />
        <Button
          size="icon"
          className="size-8 rounded-lg bg-ink"
          onClick={() => setNewClientOpen(true)}
          aria-label={m.nav.newClient}
        >
          <Plus className="size-4" />
        </Button>
        <IdentityMenu compact />
      </header>

      <main className="lg:pl-[224px]">{children}</main>
    </div>
  );
}
