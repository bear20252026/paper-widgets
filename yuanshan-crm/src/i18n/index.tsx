import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import pt from "./locales/pt.json";

export type Locale = "en" | "zh-CN" | "zh-TW" | "ja" | "ko" | "pt";
export type Messages = typeof en;

export const LOCALES: Record<
  Locale,
  { html: string; name: string; cjk: boolean; aliases: string[] }
> = {
  en: { html: "en", name: "English", cjk: false, aliases: ["en-us", "en-gb", "english"] },
  "zh-TW": {
    html: "zh-Hant-TW",
    name: "繁體中文",
    cjk: true,
    aliases: ["zh-hant", "zh-hk", "zh-mo", "zh-hant-tw", "tw", "hk", "zh-tc"],
  },
  "zh-CN": {
    html: "zh-Hans-CN",
    name: "简体中文",
    cjk: true,
    aliases: ["zh-hans", "zh-sg", "zh-hans-cn", "zh", "cn", "zh-sc"],
  },
  ko: { html: "ko", name: "한국어", cjk: true, aliases: ["kr", "ko-kr", "kor"] },
  ja: { html: "ja", name: "日本語", cjk: true, aliases: ["jp", "ja-jp", "jpn"] },
  pt: {
    html: "pt-BR",
    name: "Português",
    cjk: false,
    aliases: ["pt-br", "pt-pt", "br", "portuguese"],
  },
};

const MESSAGES: Record<Locale, Messages> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja,
  ko,
  pt,
};

const LOCALE_QUERY_KEY = "locale";
const LOCALE_STORAGE_KEY = "yuanshan.locale";

export function resolveLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const fromQuery = new URLSearchParams(window.location.search).get(LOCALE_QUERY_KEY);
  if (fromQuery) {
    const normalized = fromQuery.toLowerCase();
    if (normalized in MESSAGES) return normalized as Locale;
    for (const [key, meta] of Object.entries(LOCALES) as [Locale, (typeof LOCALES)[Locale]][]) {
      if (meta.aliases.includes(normalized) || meta.html.toLowerCase() === normalized) return key;
    }
  }
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && stored in MESSAGES) return stored as Locale;
  } catch {
    // storage can be blocked; fall back to the browser languages
  }
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    for (const [key, meta] of Object.entries(LOCALES) as [Locale, (typeof LOCALES)[Locale]][]) {
      if (meta.aliases.includes(lower) || meta.html.toLowerCase() === lower) return key;
    }
    const base = lower.split("-")[0]!;
    if (base === "zh") return "zh-CN";
    if (base === "pt") return "pt";
    if (base === "ja") return "ja";
    if (base === "ko") return "ko";
    if (base === "en") return "en";
  }
  return "en";
}

interface I18nValue {
  locale: Locale;
  tag: string;
  m: Messages;
  setLocale: (locale: Locale) => void;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => resolveLocale());
  const meta = LOCALES[locale];
  const messages = MESSAGES[locale];

  useEffect(() => {
    const root = document.documentElement;
    root.lang = meta.html;
    root.dataset.cjk = String(meta.cjk);
    document.title = messages.meta.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", messages.meta.description);
  }, [locale, meta, messages]);

  useEffect(() => {
    const onPopState = () => setLocaleState(resolveLocale());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      tag: meta.html,
      m: messages,
      setLocale: (next) => {
        setLocaleState(next);
        try {
          window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
        } catch {
          // ignore storage failures
        }
        const url = new URL(window.location.href);
        url.searchParams.set(LOCALE_QUERY_KEY, next);
        window.history.pushState({}, "", url);
      },
      formatNumber: (input, options) => new Intl.NumberFormat(meta.html, options).format(input),
      formatDate: (input, options) =>
        new Intl.DateTimeFormat(meta.html, options).format(
          typeof input === "string" ? new Date(input) : input,
        ),
    }),
    [locale, meta, messages],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}

export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}

export function plural(
  one: string,
  many: string,
  count: number,
  values: Record<string, string | number> = {},
): string {
  return interpolate(count === 1 ? one : many, { ...values, n: count });
}
