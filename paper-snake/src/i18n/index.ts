/**
 * Tiny gettext-style i18n. The Chinese source string is the key; English
 * lives in ./en.ts. Pure TS (no React) so the simulation and renderer can use
 * it too. `{name}` placeholders are filled from `vars`.
 */
import { EN } from "./en";

export type Lang = "zh" | "en";
export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: "zh", label: "简体中文", short: "中" },
  { id: "en", label: "English", short: "EN" },
];

let current: Lang = "zh";

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang === "en" ? "en" : "zh";
  if (typeof document !== "undefined") {
    document.documentElement.lang = current === "en" ? "en" : "zh-CN";
    document.title = current === "en" ? "Paper Snake · Snake IO Arena" : "纸格竞技场 · 贪吃蛇大作战";
  }
}

/** First-visit guess from the browser; Chinese browsers get Chinese, everyone else English. */
export function detectLang(): Lang {
  if (typeof navigator === "undefined") return "zh";
  const list = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  return list.some((l) => /^zh/i.test(l)) ? "zh" : list.length ? "en" : "zh";
}

export type Vars = Record<string, string | number>;

export function t(zh: string, vars?: Vars): string {
  let s = current === "en" ? EN[zh] ?? zh : zh;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m: string, k: string) => (k in vars ? String(vars[k]) : m));
  return s;
}

/** Same as t() but for an explicit language (tests, share text). */
export function tIn(lang: Lang, zh: string, vars?: Vars): string {
  const prev = current;
  current = lang;
  try {
    return t(zh, vars);
  } finally {
    current = prev;
  }
}

export function locale(): string {
  return current === "en" ? "en-US" : "zh-CN";
}

export function fmt(n: number): string {
  return n.toLocaleString(locale());
}

/** English plural helper: plural(3, "kill") → "3 kills". */
export function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

export function hasTranslation(zh: string): boolean {
  return Object.prototype.hasOwnProperty.call(EN, zh);
}
