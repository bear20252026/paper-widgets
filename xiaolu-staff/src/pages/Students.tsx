// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as b from 'react';
import * as m from 'react/jsx-runtime';
import { Ee, Pn, ao, et, qe } from '@/compat';
import { Hm, Is } from '@/components/Layout';
import { hM } from '@/components/StudentCard';
import { J1 } from '@/components/StudentFormDialog';
import { tn, ue } from '@/i18n';
import { no } from '@/lib/constants';
import { Ml } from '@/lib/format';
import { ls } from '@/lib/students';
import { gs } from '@/lib/useMeta';
import { bb, vb } from '@/icons';

// 学员列表（搜索、标签筛选、剩余课时条）。Lf 为筛选标签组件。

function pM() {
  const {
      m: t
    } = tn(),
    a = gs(),
    r = qe.students.list.useQuery(),
    l = qe.schedule.list.useQuery(),
    [i, c] = b.useState(""),
    [d, h] = b.useState("all"),
    [p, g] = b.useState("id"),
    [x, y] = b.useState(!1),
    w = b.useMemo(() => new Map((l.data ?? []).map(T => [T.id, T.courseId])), [l.data]),
    E = r.data ?? [],
    C = E.filter(T => ls(T.balance.remaining) !== "ok").length,
    S = b.useMemo(() => {
      let T = E.filter(M => !i || M.name.includes(i) || (M.nickname ?? "").includes(i) || (M.parentPhone ?? "").includes(i));
      d === "low" ? T = T.filter(M => ls(M.balance.remaining) !== "ok") : typeof d == "number" && (T = T.filter(M => M.slotIds.some(q => w.get(q) === d)));
      const N = [...T];
      return p === "hours" && N.sort((M, q) => M.balance.remaining - q.balance.remaining), p === "age" && N.sort((M, q) => M.age - q.age), N;
    }, [E, i, d, p, w]);
  return m.jsxs(Is, {
    children: [m.jsxs("div", {
      className: "px-4 py-6 md:px-8 md:py-8 max-w-[1400px]",
      children: [m.jsx(Hm, {
        image: no.bannerStudents,
        title: Ml(t.students.title, {
          emphasis: m.jsx("span", {
            className: "crayon-underline",
            children: t.students.titleEmphasis
          })
        }),
        subtitle: ue(E.length === 1 ? t.students.subtitleOne : t.students.subtitleOther, {
          count: E.length
        }),
        children: m.jsx("span", {
          className: "sticker bg-alert-soft text-alert",
          children: ue(C === 1 ? t.students.needsRenewalOne : t.students.needsRenewalOther, {
            count: C
          })
        })
      }), m.jsxs("div", {
        className: "mb-5 flex flex-wrap items-center gap-2",
        children: [m.jsxs("div", {
          className: "relative w-full sm:w-64",
          children: [m.jsx(bb, {
            className: "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-soft"
          }), m.jsx(Pn, {
            value: i,
            onChange: T => c(T.target.value),
            placeholder: t.students.searchPlaceholder,
            className: "rounded-full pl-9 bg-card"
          })]
        }), m.jsxs("div", {
          className: "flex flex-wrap gap-1.5",
          children: [m.jsx(Lf, {
            active: d === "all",
            onClick: () => h("all"),
            children: t.students.filterAll
          }), m.jsx(Lf, {
            active: d === "low",
            onClick: () => h("low"),
            className: "data-[active=true]:bg-alert data-[active=true]:text-white data-[active=true]:border-alert",
            children: ue(C === 1 ? t.students.lowFilterOne : t.students.lowFilterOther, {
              count: C
            })
          }), a.courses.map(T => m.jsx(Lf, {
            active: d === T.id,
            onClick: () => h(T.id),
            color: T.color,
            children: T.name
          }, T.id))]
        }), m.jsxs("select", {
          value: p,
          onChange: T => g(T.target.value),
          className: "rounded-full border-2 border-cocoa/10 bg-card px-3 py-1.5 text-sm font-extrabold text-cocoa-soft outline-none",
          children: [m.jsx("option", {
            value: "id",
            children: t.students.sortEnrollment
          }), m.jsx("option", {
            value: "hours",
            children: t.students.sortHours
          }), m.jsx("option", {
            value: "age",
            children: t.students.sortAge
          })]
        }), m.jsxs(et, {
          className: "ml-auto rounded-full font-extrabold",
          onClick: () => y(!0),
          children: [m.jsx(vb, {
            className: "h-4 w-4"
          }), " ", t.students.newStudent]
        })]
      }), r.isLoading ? m.jsx("div", {
        className: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
        children: Array.from({
          length: 8
        }).map((T, N) => m.jsx(ao, {
          className: "h-72 rounded-[28px]"
        }, N))
      }) : S.length === 0 ? m.jsxs("div", {
        className: "doodle-card py-16 text-center",
        children: [m.jsx("img", {
          src: no.emptySleep,
          alt: "",
          className: "mx-auto h-36 w-36 rounded-full object-cover"
        }), m.jsx("p", {
          className: "mt-3 font-display text-xl text-cocoa",
          children: t.students.emptyState
        })]
      }) : m.jsx("div", {
        className: "grid gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
        children: S.map((T, N) => {
          const q = Array.from(new Set(T.slotIds.map(Q => w.get(Q)).filter(Q => !!Q))).map(Q => a.course(Q)).filter(Q => !!Q);
          return m.jsx(hM, {
            student: T,
            courses: q,
            index: N
          }, T.id);
        })
      })]
    }), m.jsx(J1, {
      open: x,
      onOpenChange: y
    })]
  });
}
function Lf({
  active: t,
  onClick: a,
  children: r,
  color: l,
  className: i
}) {
  return m.jsx("button", {
    "data-active": t,
    onClick: a,
    className: Ee("rounded-full border-2 px-3 py-1.5 text-xs font-extrabold transition", t ? "border-cocoa/40 text-cocoa scale-105" : "border-cocoa/10 text-cocoa-soft hover:text-cocoa", !l && t && "bg-peach", !l && !t && "bg-card", i),
    style: l ? {
      background: t ? l : `${l}66`
    } : void 0,
    children: r
  });
}
export { pM, Lf };
export default pM;
