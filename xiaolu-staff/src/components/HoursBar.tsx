// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as m from 'react/jsx-runtime';
import { Ee } from '@/compat';
import { tn, ue } from '@/i18n';
import { _b } from '@/lib/constants';
import { ls } from '@/lib/students';

// 剩余课时条（低于阈值变橙色提醒）。

function $c({
  remaining: t,
  total: a = _b,
  compact: r = !1,
  className: l,
  showLabel: i = !0
}) {
  const {
      m: c
    } = tn(),
    d = ls(t),
    h = Math.max(0, Math.min(1, t / a)) * 100,
    p = t > a ? t - a : 0,
    g = d === "ok" ? "linear-gradient(90deg, #8FD9AE, #B5E8C8)" : "linear-gradient(90deg, #FF8A3D, #FFB36B)";
  return m.jsxs("div", {
    className: Ee("w-full", l),
    children: [i && m.jsxs("div", {
      className: Ee("flex items-baseline justify-between", r ? "mb-1 text-[11px]" : "mb-1.5 text-xs"),
      children: [m.jsxs("span", {
        className: Ee("font-bold", d === "ok" ? "text-cocoa-soft" : "text-alert"),
        children: [d === "ok" && c.hours.balance, d === "low" && c.hours.low, d === "empty" && c.hours.empty]
      }), m.jsxs("span", {
        className: "font-black tabular-nums text-cocoa",
        children: [m.jsx("span", {
          className: Ee(d !== "ok" && "text-alert", r ? "text-sm" : "text-base"),
          children: Math.max(t, 0)
        }), m.jsxs("span", {
          className: "text-cocoa-soft font-bold",
          children: [" ", ue(c.hours.ofTotal, {
            total: a
          })]
        }), p > 0 && m.jsx("span", {
          className: "ml-1 text-[10px] text-caramel-deep",
          children: ue(c.hours.extra, {
            extra: p
          })
        })]
      })]
    }), m.jsx("div", {
      className: Ee("relative overflow-hidden rounded-full border-2 border-cocoa/10 bg-paper-deep", r ? "h-2.5" : "h-3.5", d !== "ok" && "pulse-alert"),
      role: "progressbar",
      "aria-valuemin": 0,
      "aria-valuemax": a,
      "aria-valuenow": Math.max(t, 0),
      children: m.jsx("div", {
        className: "crayon-fill absolute inset-y-0 left-0 rounded-full",
        style: {
          width: `${h}%`,
          background: g,
          transition: "width 800ms cubic-bezier(0.34, 1.3, 0.64, 1), background 400ms ease"
        }
      })
    })]
  });
}
export { $c };
