// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import { ue } from '@/i18n';

// 解析后端错误信封（app-error / slot-conflict），按错误码翻译成用户文案。

function Ym(t) {
  const a = t?.message;
  if (!a) return null;
  try {
    const r = JSON.parse(a);
    if (r?.type === "slot-conflict") return r.conflicts;
  } catch {
    return null;
  }
  return null;
}
function Q1(t) {
  if (!t) return null;
  try {
    const a = JSON.parse(t);
    if (Array.isArray(a)) return Q1(a[0]?.message);
    if (a?.type === "app-error" && typeof a.code == "string") return a;
  } catch {
    return null;
  }
  return null;
}
function ta(t, a) {
  const r = t?.message,
    l = Q1(r);
  if (!l) return a.errors.generic;
  const i = a.errors[l.code] ?? a.errors.generic;
  return ue(i, l.params ?? {});
}
export { Ym, Q1, ta };
