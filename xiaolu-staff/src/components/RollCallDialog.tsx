// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as b from 'react';
import * as m from 'react/jsx-runtime';
import { Ee, Xe, et, fo, ho, mo, po, qe, uo } from '@/compat';
import { $c } from '@/components/HoursBar';
import { ja } from '@/components/KidAvatar';
import { tn, ue } from '@/i18n';
import { Pb, Zv, jt } from '@/lib/date';
import { ta } from '@/lib/errors';
import { Lm, iD } from '@/icons';

// 点名弹窗（到课/请假/缺课三态）。gM 为三态配色。

const gM = {
  present: "bg-mint border-[#6BCB8B] text-cocoa",
  leave: "bg-sky border-[#5BB6E8] text-cocoa",
  absent: "bg-blush border-[#FF7FA3] text-cocoa"
};
function yM(t) {
  const {
      m: a,
      formatDate: r
    } = tn(),
    {
      open: l,
      onOpenChange: i,
      slotId: c,
      date: d,
      students: h,
      existing: p
    } = t,
    g = qe.useUtils(),
    x = p.length > 0,
    y = b.useMemo(() => {
      const Q = {};
      return h.forEach(A => {
        const B = p.find(j => j.studentId === A.id);
        Q[A.id] = B ? B.status : x ? null : "present";
      }), Q;
    }, [h, p, x]),
    [w, E] = b.useState(y),
    [C, S] = b.useState(null);
  b.useEffect(() => {
    l && (E(y), S(null));
  }, [l, y]);
  const T = qe.attendance.save.useMutation({
      onSuccess: Q => {
        const A = {};
        Q.forEach(X => A[X.studentId] = X.after), S(A);
        const B = Q.reduce((X, W) => X + Math.max(0, W.before - W.after), 0),
          j = Q.reduce((X, W) => X + Math.max(0, W.after - W.before), 0);
        Xe.success(B > 0 ? ue(B === 1 ? a.rollCall.savedDeductedOne : a.rollCall.savedDeductedOther, {
          count: B
        }) : j > 0 ? ue(j === 1 ? a.rollCall.savedRefundedOne : a.rollCall.savedRefundedOther, {
          count: j
        }) : a.rollCall.savedUnchanged);
        const R = Q.filter(X => X.after <= 3 && X.before > 3);
        if (R.length) {
          const X = R.map(W => h.find(oe => oe.id === W.studentId)?.name).filter(Boolean);
          Xe.warning(ue(a.rollCall.lowWarning, {
            names: X.join("、")
          }));
        }
        g.today.get.invalidate(), g.students.list.invalidate(), g.students.get.invalidate(), g.schedule.weekAttendance.invalidate();
      },
      onError: Q => Xe.error(ta(Q, a))
    }),
    N = b.useMemo(() => {
      const Q = {
        present: 0,
        leave: 0,
        absent: 0,
        none: 0
      };
      return Object.values(w).forEach(A => A ? Q[A]++ : Q.none++), Q;
    }, [w]),
    M = Object.entries(w).reduce((Q, [A, B]) => {
      const j = p.find(W => W.studentId === Number(A)),
        R = j ? Zv(j.status) : 0,
        X = B ? Zv(B) : 0;
      return Q + (X - R);
    }, 0),
    q = () => {
      T.mutate({
        slotId: c,
        date: d,
        records: h.map(Q => ({
          studentId: Q.id,
          status: w[Q.id] ?? null
        }))
      });
    };
  return m.jsx(uo, {
    open: l,
    onOpenChange: i,
    children: m.jsxs(fo, {
      className: "sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-card border-2 border-cocoa/10 rounded-[28px]",
      children: [m.jsx(mo, {
        children: m.jsxs("div", {
          className: "flex items-center gap-3",
          children: [m.jsx("span", {
            className: "crayon-fill h-10 w-10 rounded-2xl border-2 border-cocoa/10",
            style: {
              background: t.courseColor
            }
          }), m.jsxs("div", {
            children: [m.jsx(ho, {
              className: "font-display text-2xl text-cocoa font-normal",
              children: ue(a.rollCall.title, {
                course: t.courseName
              })
            }), m.jsx(po, {
              className: "font-semibold text-cocoa-soft",
              children: ue(a.rollCall.description, {
                date: r(Pb(d), {
                  month: "short",
                  day: "numeric"
                }),
                start: jt(t.startMin),
                end: jt(t.endMin)
              })
            })]
          })]
        })
      }), m.jsxs("div", {
        className: "flex flex-wrap items-center gap-2 text-xs font-bold",
        children: [m.jsx("span", {
          className: "sticker bg-mint",
          children: ue(a.rollCall.statusCount, {
            status: a.attendance.present,
            count: N.present
          })
        }), m.jsx("span", {
          className: "sticker bg-sky",
          children: ue(a.rollCall.statusCount, {
            status: a.attendance.leave,
            count: N.leave
          })
        }), m.jsx("span", {
          className: "sticker bg-blush",
          children: ue(a.rollCall.statusCount, {
            status: a.attendance.absent,
            count: N.absent
          })
        }), N.none > 0 && m.jsx("span", {
          className: "sticker bg-muted",
          children: ue(a.rollCall.unmarkedCount, {
            count: N.none
          })
        }), m.jsxs(et, {
          variant: "ghost",
          size: "sm",
          className: "ml-auto rounded-full font-extrabold text-cocoa",
          onClick: () => E(Object.fromEntries(h.map(Q => [Q.id, "present"]))),
          disabled: !!C,
          children: [m.jsx(iD, {
            className: "h-4 w-4"
          }), " ", a.rollCall.markAllPresent]
        })]
      }), m.jsxs("div", {
        className: "-mx-2 px-2 overflow-y-auto scroll-soft flex-1 space-y-2.5 py-1",
        children: [h.length === 0 && m.jsx("p", {
          className: "py-10 text-center text-cocoa-soft font-semibold",
          children: a.rollCall.empty
        }), h.map(Q => {
          const A = w[Q.id],
            B = p.find(R => R.studentId === Q.id),
            j = C ? C[Q.id] ?? Q.balance.remaining : Q.balance.remaining;
          return m.jsxs("div", {
            className: "flex items-center gap-3 rounded-2xl border-2 border-cocoa/8 bg-paper/70 p-2.5",
            children: [m.jsx(ja, {
              seed: Q.avatarSeed,
              gender: Q.gender,
              size: 44
            }), m.jsxs("div", {
              className: "min-w-0 flex-1",
              children: [m.jsxs("div", {
                className: "flex items-center gap-2",
                children: [m.jsx("span", {
                  className: "font-extrabold text-cocoa",
                  children: Q.name
                }), B && !C && m.jsx("span", {
                  className: "text-[10px] font-bold text-cocoa-soft",
                  children: ue(a.rollCall.previousStatus, {
                    status: a.attendance[B.status]
                  })
                })]
              }), m.jsx($c, {
                remaining: j,
                compact: !0
              })]
            }), m.jsx("div", {
              className: "flex shrink-0 gap-1.5",
              children: ["present", "leave", "absent"].map(R => m.jsx("button", {
                type: "button",
                disabled: !!C,
                onClick: () => E(X => ({
                  ...X,
                  [Q.id]: X[Q.id] === R ? null : R
                })),
                className: Ee("rounded-full border-2 px-2.5 py-1 text-xs font-extrabold transition-all", A === R ? gM[R] + " scale-105" : "border-cocoa/10 bg-card text-cocoa-soft hover:border-cocoa/25"),
                children: a.attendance[R]
              }, R))
            })]
          }, Q.id);
        })]
      }), m.jsxs("div", {
        className: "flex items-center justify-between gap-3 border-t-2 border-dashed border-cocoa/10 pt-4",
        children: [m.jsx("span", {
          className: "text-sm font-bold text-cocoa-soft",
          children: C ? a.rollCall.balanceUpdated : M > 0 ? ue(M === 1 ? a.rollCall.projectedDeductOne : a.rollCall.projectedDeductOther, {
            count: M
          }) : M < 0 ? ue(-M === 1 ? a.rollCall.projectedRefundOne : a.rollCall.projectedRefundOther, {
            count: -M
          }) : a.rollCall.balanceUnchanged
        }), C ? m.jsxs(et, {
          className: "rounded-full px-6 font-extrabold",
          onClick: () => i(!1),
          children: [m.jsx(Lm, {
            className: "h-4 w-4"
          }), " ", a.rollCall.complete]
        }) : m.jsx(et, {
          className: "rounded-full px-6 font-extrabold",
          onClick: q,
          disabled: T.isPending || h.length === 0,
          children: T.isPending ? a.rollCall.saving : x ? a.rollCall.updateRollCall : a.rollCall.confirmRollCall
        })]
      })]
    })
  });
}
export { gM, yM };
