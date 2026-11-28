import * as b from 'react';
import { messages as wD } from './messages';

// Locale descriptors recovered from the bundle (fD / mD / Cb / um / hc).
const fD: Record<string, { html: string; name: string; cjk: boolean; aliases: string[] }> = {
  en: { html: 'en', name: 'English', cjk: false, aliases: ['en-us', 'en-gb', 'english'] },
  'zh-TW': {
    html: 'zh-Hant-TW',
    name: '繁體中文',
    cjk: true,
    aliases: ['zh-hant', 'zh-hk', 'zh-mo', 'zh-hant-tw', 'tw', 'hk', 'zh-tc'],
  },
  'zh-CN': {
    html: 'zh-Hans-CN',
    name: '简体中文',
    cjk: true,
    aliases: ['zh-hans', 'zh-sg', 'zh-hans-cn', 'zh', 'cn', 'zh-sc'],
  },
  ko: { html: 'ko', name: '한국어', cjk: true, aliases: ['kr', 'ko-kr', 'kor'] },
  ja: { html: 'ja', name: '日本語', cjk: true, aliases: ['jp', 'ja-jp', 'jpn'] },
  pt: { html: 'pt-BR', name: 'Português', cjk: false, aliases: ['pt-br', 'pt-pt', 'br', 'por'] },
};
const mD = ['en', 'zh-TW', 'zh-CN', 'ko', 'ja', 'pt'];
const um = 'en';
const hc = 'locale';
const Cb = mD.map((code) => ({ code, ...fD[code] }));

function hD(code: string) {
  return Cb.find((item) => item.code === code);
}
function pD(raw?: string | null) {
  if (!raw) return um;
  const key = raw.trim().toLowerCase().replace(/_/g, '-');
  const found = Cb.find((item) => item.code.toLowerCase() === key || item.aliases.includes(key));
  return found ? found.code : um;
}
function ue(template: string, values: Record<string, any>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

let qv = false;
function CD() {
  if (qv || typeof window === 'undefined') return;
  qv = true;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = ((state: any, title: string, url?: string | URL | null) => {
      const locale = new URLSearchParams(window.location.search).get(hc);
      if (url != null && locale) {
        const next = new URL(String(url), window.location.href);
        if (next.origin === window.location.origin && !next.searchParams.has(hc)) {
          next.searchParams.set(hc, locale);
          url = next.pathname + next.search + next.hash;
        }
      }
      return original(state, title, url as any);
    }) as any;
  }
}
CD();

const Ob = b.createContext<any>(null);

const Hv = () =>
  typeof window === 'undefined' ? um : pD(new URLSearchParams(window.location.search).get(hc));

function OD({ children, onLocaleApplied }: { children: b.ReactNode; onLocaleApplied?: () => void }) {
  const [locale, setLocale] = b.useState(Hv);
  b.useEffect(() => {
    const sync = () => setLocale(Hv());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const info = hD(locale) ?? Cb[0];
  const dict = wD[locale];

  b.useEffect(() => {
    const root = document.documentElement;
    root.lang = info.html;
    root.dataset.cjk = String(info.cjk);
    document.title = dict.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', dict.meta.description);
    if (!onLocaleApplied) return;
    const frame = requestAnimationFrame(onLocaleApplied);
    return () => cancelAnimationFrame(frame);
  }, [info, dict, onLocaleApplied]);

  const value = b.useMemo(
    () => ({
      locale,
      tag: info.html,
      m: dict,
      formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(info.html, options).format(value),
      formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(info.html, options).format(date),
    }),
    [locale, info, dict],
  );

  return <Ob.Provider value={value}>{children}</Ob.Provider>;
}

function tn() {
  const value = b.useContext(Ob);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

export { Cb, CD, Hv, OD, hD, pD, tn, ue };
