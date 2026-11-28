import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { translations, Lang, defaultLang } from "./i18n";

type I18nContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (typeof translations)[Lang];
};

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("wx_lang") : null;
    if (saved === "zh" || saved === "en") return saved;
    return defaultLang;
  });

  const value = useMemo<I18nContextType>(
    () => ({
      lang,
      setLang: (l) => {
        setLang(l);
        try {
          localStorage.setItem("wx_lang", l);
        } catch {}
      },
      t: translations[lang],
    }),
    [lang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be inside I18nProvider");
  return ctx;
}
