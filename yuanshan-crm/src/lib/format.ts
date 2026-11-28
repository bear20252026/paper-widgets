import { useCallback, useMemo } from "react";
import { interpolate, useI18n } from "@/i18n";
import { formatNumberRaw } from "./utils";

export interface MoneyParts {
  value: string;
  unit: string;
}

export interface FollowUpMeta {
  kind: "overdue" | "today" | "tomorrow" | "soon" | "later" | "none";
  label: string;
  days: number;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function useFormat() {
  const { m, formatDate, tag, locale } = useI18n();

  const moneyParts = useCallback(
    (amount: number): MoneyParts => {
      if (!amount) return { value: "0", unit: "" };
      const system = m.units.system;
      if (system === "wan") {
        return { value: formatNumberRaw(amount / 10_000), unit: m.units.tenThousand };
      }
      if (Math.abs(amount) >= 1_000_000) {
        return { value: formatNumberRaw(amount / 1_000_000), unit: m.units.million };
      }
      return { value: formatNumberRaw(amount / 1_000), unit: m.units.thousand };
    },
    [m],
  );

  const money = useCallback(
    (amount: number): string => {
      const parts = moneyParts(amount);
      return interpolate(m.units.money, { value: parts.value, unit: parts.unit });
    },
    [m, moneyParts],
  );

  const shortDate = useCallback(
    (value?: string | Date | null): string => {
      if (!value) return "—";
      return formatDate(value, { month: "short", day: "numeric" });
    },
    [formatDate],
  );

  const longDate = useCallback(
    (value?: string | Date | null): string => {
      if (!value) return "—";
      return formatDate(value, { year: "numeric", month: "long", day: "numeric" });
    },
    [formatDate],
  );

  const relative = useCallback(
    (value?: string | null): string => {
      if (!value) return "—";
      const target = new Date(value);
      const now = new Date();
      const dayDiff = Math.round((startOfDay(now).getTime() - startOfDay(target).getTime()) / 86_400_000);
      const diffMs = now.getTime() - target.getTime();
      if (dayDiff <= 0) {
        const minutes = Math.floor(diffMs / 60_000);
        if (minutes < 1) return m.time.justNow;
        if (minutes < 60) return interpolate(m.time.minutesAgo, { n: minutes });
        return interpolate(m.time.hoursAgo, { n: Math.floor(minutes / 60) });
      }
      if (dayDiff === 1) return m.time.yesterday;
      if (dayDiff < 30) return interpolate(m.time.daysAgo, { n: dayDiff });
      return shortDate(value);
    },
    [m, shortDate],
  );

  const followUp = useCallback(
    (value?: string | null): FollowUpMeta => {
      if (!value) return { kind: "none", label: "—", days: 0 };
      const days = Math.round(
        (startOfDay(new Date(value)).getTime() - startOfDay(new Date()).getTime()) / 86_400_000,
      );
      if (days < 0)
        return { kind: "overdue", label: interpolate(m.time.overdue, { n: -days }), days };
      if (days === 0) return { kind: "today", label: m.time.dueToday, days };
      if (days === 1) return { kind: "tomorrow", label: m.time.tomorrow, days };
      return {
        kind: days <= 7 ? "soon" : "later",
        label: interpolate(m.time.inDays, { n: days }),
        days,
      };
    },
    [m],
  );

  const compare = useCallback(
    (a: string, b: string) => a.localeCompare(b, tag, { sensitivity: "base" }),
    [tag],
  );

  const greeting = useCallback(
    (name: string): string => {
      const hour = new Date().getHours();
      const key =
        hour < 5 ? "lateNight" : hour < 12 ? "morning" : hour < 14 ? "noon" : hour < 18 ? "afternoon" : "evening";
      return interpolate(m.greeting.line, { greeting: m.greeting[key], name });
    },
    [m],
  );

  const todayEyebrow = useMemo(() => {
    const label = formatDate(new Date(), { month: "short", day: "numeric", weekday: "long" });
    return locale === "en" ? label.toUpperCase() : label;
  }, [formatDate, locale]);

  const monthShort = useMemo(() => formatDate(new Date(), { month: "short" }), [formatDate]);

  return {
    m,
    money,
    moneyParts,
    relative,
    followUp,
    shortDate,
    longDate,
    compare,
    greeting,
    todayEyebrow,
    monthShort,
    formatDate,
  };
}
