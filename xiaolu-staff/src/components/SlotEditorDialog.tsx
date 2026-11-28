// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as b from 'react';
import * as m from 'react/jsx-runtime';
import { Ee, Gc, It, Pn, Xe, cc, et, fo, ho, ic, lc, mo, oc, po, qe, rc, uo } from '@/compat';
import { ja } from '@/components/KidAvatar';
import { tn, ue } from '@/i18n';
import { $v, jt } from '@/lib/date';
import { Ym, ta } from '@/lib/errors';
import { F1, Qs } from '@/lib/slots';
import { gs } from '@/lib/useMeta';
import { $N, Ec, Sb, bb } from '@/icons';

// 排课/调课弹窗：选课程、时段冲突检测、学员点名式多选。

function JR({
  open: t,
  onOpenChange: a,
  slot: r,
  defaults: l,
  allSlots: i,
  dateForSlot: c,
  canRollCall: d,
  onConflictPreview: h
}) {
  const {
      m: p
    } = tn(),
    g = gs(),
    x = qe.students.list.useQuery(),
    y = qe.useUtils(),
    [, w] = Gc(),
    E = {
      id: -1,
      courseId: l?.courseId ?? 1,
      teacherId: l?.teacherId ?? 1,
      roomId: l?.roomId ?? 1,
      weekday: l?.weekday ?? 6,
      startMin: l?.startMin ?? 540,
      endMin: l?.endMin ?? 630,
      capacity: l?.capacity ?? 8,
      studentIds: []
    },
    [C, S] = b.useState(r ?? E),
    [T, N] = b.useState(""),
    [M, q] = b.useState(null),
    [Q, A] = b.useState(0);
  b.useEffect(() => {
    t && (S(r ?? E), N(""), q(null));
  }, [t, r?.id]);
  const B = b.useMemo(() => F1(C, i), [C, i]);
  b.useEffect(() => {
    if (!t) return;
    const z = B.flatMap(L => [L.aId, L.bId]).filter(L => L !== -1);
    h(z), B.length && A(L => L + 1);
  }, [t, JSON.stringify(B)]), b.useEffect(() => {
    t || h([]);
  }, [t]);
  const j = z => {
      Xe.success(z), y.schedule.list.invalidate(), y.today.get.invalidate(), y.students.list.invalidate(), y.students.get.invalidate(), y.meta.staff.invalidate(), a(!1);
    },
    R = z => {
      const L = Ym(z);
      L ? (q(L), A(F => F + 1), Xe.error(p.slotEditor.conflictError)) : Xe.error(ta(z, p));
    },
    X = qe.schedule.create.useMutation({
      onSuccess: () => j(p.slotEditor.created),
      onError: R
    }),
    W = qe.schedule.update.useMutation({
      onSuccess: () => j(p.slotEditor.updated),
      onError: R
    }),
    oe = qe.schedule.remove.useMutation({
      onSuccess: () => j(p.slotEditor.deleted),
      onError: z => Xe.error(ta(z, p))
    }),
    se = (z = !1) => {
      const L = {
        courseId: C.courseId,
        teacherId: C.teacherId,
        roomId: C.roomId,
        weekday: C.weekday,
        startMin: C.startMin,
        endMin: C.endMin,
        capacity: C.capacity,
        studentIds: C.studentIds
      };
      r ? W.mutate({
        id: r.id,
        data: L,
        force: z
      }) : X.mutate({
        data: L,
        force: z
      });
    },
    V = g.course(C.courseId),
    ae = new Set(C.studentIds),
    ce = x.data ?? [],
    k = ce.filter(z => !T || z.name.includes(T) || (z.nickname ?? "").includes(T)).sort((z, L) => Number(ae.has(L.id)) - Number(ae.has(z.id))),
    I = C.endMin <= C.startMin,
    U = C.studentIds.length > C.capacity,
    le = B.length ? B : M ?? [],
    de = X.isPending || W.isPending,
    D = z => {
      const L = z.aId === C.id ? z.bId : z.aId,
        F = i.find(ne => ne.id === L);
      return F ? ue(p.slotEditor.otherClass, {
        course: g.course(F.courseId)?.name ?? "",
        time: Qs(F, p),
        teacher: g.teacher(F.teacherId)?.name ?? "",
        room: g.room(F.roomId)?.name ?? ""
      }) : "";
    };
  return m.jsx(uo, {
    open: t,
    onOpenChange: a,
    children: m.jsxs(fo, {
      className: "sm:max-w-3xl max-h-[92vh] overflow-y-auto scroll-soft bg-card border-2 border-cocoa/10 rounded-[28px]",
      children: [m.jsx(mo, {
        children: m.jsxs("div", {
          className: "flex items-center gap-3",
          children: [m.jsx("span", {
            className: "crayon-fill h-10 w-10 rounded-2xl border-2 border-cocoa/10",
            style: {
              background: V?.color
            }
          }), m.jsxs("div", {
            children: [m.jsx(ho, {
              className: "font-display text-2xl font-normal text-cocoa",
              children: r ? p.slotEditor.editTitle : p.slotEditor.newTitle
            }), m.jsx(po, {
              className: "font-semibold text-cocoa-soft",
              children: ue(p.slotEditor.timeSummary, {
                day: p.weekdays[C.weekday],
                start: jt(C.startMin),
                end: jt(C.endMin)
              })
            })]
          }), r && d && c && m.jsxs(et, {
            variant: "outline",
            className: "ml-auto rounded-full font-extrabold",
            onClick: () => w(`/?date=${c}`),
            children: [m.jsx($N, {
              className: "h-4 w-4"
            }), " ", p.slotEditor.rollCall]
          })]
        })
      }), le.length > 0 && m.jsxs("div", {
        className: "shake-now rounded-2xl border-2 border-dashed border-alert bg-alert-soft p-3 text-sm",
        children: [m.jsxs("div", {
          className: "flex items-center gap-2 font-extrabold text-alert",
          children: [m.jsx(Ec, {
            className: "h-4 w-4"
          }), " ", ue(le.length === 1 ? p.slotEditor.conflictCountOne : p.slotEditor.conflictCount, {
            count: le.length
          })]
        }), m.jsx("ul", {
          className: "mt-1.5 space-y-1 font-semibold text-cocoa",
          children: le.map((z, L) => m.jsxs("li", {
            children: [ue(p.slotEditor.conflictItem, {
              conflicts: z.kinds.map(F => p.conflicts[F]).join(p.slotEditor.listSeparator),
              classInfo: D(z)
            }), z.sharedStudentIds.length > 0 && m.jsx("span", {
              className: "text-cocoa-soft",
              children: ue(p.slotEditor.sharedStudents, {
                students: z.sharedStudentIds.map(F => ce.find(ne => ne.id === F)?.name).filter(Boolean).join(p.slotEditor.listSeparator)
              })
            })]
          }, L))
        })]
      }, Q), m.jsxs("div", {
        className: "grid gap-4 sm:grid-cols-2",
        children: [m.jsxs("div", {
          className: "space-y-1.5",
          children: [m.jsx(It, {
            className: "font-extrabold",
            children: p.slotEditor.course
          }), m.jsxs(rc, {
            value: String(C.courseId),
            onValueChange: z => S(L => ({
              ...L,
              courseId: Number(z)
            })),
            children: [m.jsx(lc, {
              className: "rounded-xl",
              children: m.jsx(oc, {})
            }), m.jsx(ic, {
              children: g.courses.map(z => m.jsxs(cc, {
                value: String(z.id),
                children: [m.jsx("span", {
                  className: "inline-block h-3 w-3 rounded-full mr-1.5 align-middle",
                  style: {
                    background: z.color
                  }
                }), ue(p.slotEditor.courseOption, {
                  course: z.name,
                  ageRange: z.ageRange
                })]
              }, z.id))
            })]
          })]
        }), m.jsxs("div", {
          className: "space-y-1.5",
          children: [m.jsx(It, {
            className: "font-extrabold",
            children: p.slotEditor.teacher
          }), m.jsxs(rc, {
            value: String(C.teacherId),
            onValueChange: z => S(L => ({
              ...L,
              teacherId: Number(z)
            })),
            children: [m.jsx(lc, {
              className: "rounded-xl",
              children: m.jsx(oc, {})
            }), m.jsx(ic, {
              children: g.teachers.map(z => m.jsx(cc, {
                value: String(z.id),
                children: ue(p.slotEditor.teacherOption, {
                  teacher: z.name,
                  specialty: z.specialty
                })
              }, z.id))
            })]
          })]
        }), m.jsxs("div", {
          className: "space-y-1.5",
          children: [m.jsx(It, {
            className: "font-extrabold",
            children: p.slotEditor.room
          }), m.jsxs(rc, {
            value: String(C.roomId),
            onValueChange: z => S(L => ({
              ...L,
              roomId: Number(z)
            })),
            children: [m.jsx(lc, {
              className: "rounded-xl",
              children: m.jsx(oc, {})
            }), m.jsx(ic, {
              children: g.rooms.map(z => m.jsx(cc, {
                value: String(z.id),
                children: ue(p.slotEditor.roomOption, {
                  room: z.name,
                  capacity: z.capacity
                })
              }, z.id))
            })]
          })]
        }), m.jsxs("div", {
          className: "space-y-1.5",
          children: [m.jsx(It, {
            className: "font-extrabold",
            children: p.slotEditor.weekday
          }), m.jsxs(rc, {
            value: String(C.weekday),
            onValueChange: z => S(L => ({
              ...L,
              weekday: Number(z)
            })),
            children: [m.jsx(lc, {
              className: "rounded-xl",
              children: m.jsx(oc, {})
            }), m.jsx(ic, {
              children: [1, 2, 3, 4, 5, 6, 7].map(z => m.jsx(cc, {
                value: String(z),
                children: p.weekdays[z]
              }, z))
            })]
          })]
        }), m.jsxs("div", {
          className: "grid grid-cols-3 gap-3 sm:col-span-2",
          children: [m.jsxs("div", {
            className: "space-y-1.5",
            children: [m.jsx(It, {
              className: "font-extrabold",
              children: p.slotEditor.startTime
            }), m.jsx(Pn, {
              type: "time",
              step: 900,
              className: "rounded-xl",
              value: jt(C.startMin),
              onChange: z => z.target.value && S(L => ({
                ...L,
                startMin: $v(z.target.value)
              }))
            })]
          }), m.jsxs("div", {
            className: "space-y-1.5",
            children: [m.jsx(It, {
              className: "font-extrabold",
              children: p.slotEditor.endTime
            }), m.jsx(Pn, {
              type: "time",
              step: 900,
              className: Ee("rounded-xl", I && "border-destructive"),
              value: jt(C.endMin),
              onChange: z => z.target.value && S(L => ({
                ...L,
                endMin: $v(z.target.value)
              }))
            })]
          }), m.jsxs("div", {
            className: "space-y-1.5",
            children: [m.jsx(It, {
              className: "font-extrabold",
              children: p.slotEditor.capacity
            }), m.jsx(Pn, {
              type: "number",
              min: 1,
              max: 30,
              className: "rounded-xl",
              value: C.capacity,
              onChange: z => S(L => ({
                ...L,
                capacity: Math.max(1, Math.min(30, Number(z.target.value) || 1))
              }))
            })]
          })]
        }), I && m.jsx("p", {
          className: "sm:col-span-2 -mt-2 text-xs font-bold text-destructive",
          children: p.slotEditor.endAfterStart
        })]
      }), m.jsxs("div", {
        className: "rounded-2xl border-2 border-cocoa/8 bg-paper/60 p-3",
        children: [m.jsxs("div", {
          className: "flex flex-wrap items-center gap-2",
          children: [m.jsx("span", {
            className: "font-extrabold text-cocoa",
            children: p.slotEditor.classStudents
          }), m.jsx("span", {
            className: Ee("sticker", U ? "bg-alert-soft text-alert" : "bg-lemon"),
            children: ue(p.slotEditor.enrolledCount, {
              students: C.studentIds.length,
              capacity: C.capacity
            })
          }), m.jsxs("div", {
            className: "relative ml-auto w-48",
            children: [m.jsx(bb, {
              className: "absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cocoa-soft"
            }), m.jsx(Pn, {
              value: T,
              onChange: z => N(z.target.value),
              placeholder: p.slotEditor.searchStudents,
              className: "h-8 rounded-full pl-8 text-sm"
            })]
          })]
        }), m.jsx("div", {
          className: "mt-3 grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto scroll-soft pr-1 sm:grid-cols-3",
          children: k.map(z => {
            const L = ae.has(z.id);
            return m.jsxs("button", {
              type: "button",
              onClick: () => S(F => ({
                ...F,
                studentIds: L ? F.studentIds.filter(ne => ne !== z.id) : [...F.studentIds, z.id]
              })),
              className: Ee("flex items-center gap-2 rounded-full border-2 py-0.5 pl-0.5 pr-2 text-left text-xs font-bold transition", L ? "border-caramel bg-peach/60 text-cocoa" : "border-transparent text-cocoa-soft hover:bg-muted"),
              children: [m.jsx(ja, {
                seed: z.avatarSeed,
                gender: z.gender,
                size: 26,
                ring: !1
              }), m.jsx("span", {
                className: "truncate",
                children: z.name
              }), m.jsx("span", {
                className: "ml-auto tabular-nums opacity-70",
                children: ue(p.slotEditor.age, {
                  age: z.age
                })
              })]
            }, z.id);
          })
        })]
      }), m.jsxs("div", {
        className: "flex flex-wrap items-center gap-2 border-t-2 border-dashed border-cocoa/10 pt-4",
        children: [r && m.jsxs(et, {
          variant: "ghost",
          className: "rounded-full font-bold text-destructive hover:text-destructive",
          onClick: () => {
            confirm(p.slotEditor.deleteConfirm) && oe.mutate({
              id: r.id
            });
          },
          children: [m.jsx(Sb, {
            className: "h-4 w-4"
          }), " ", p.slotEditor.deleteClass]
        }), m.jsxs("div", {
          className: "ml-auto flex gap-2",
          children: [le.length > 0 && m.jsx(et, {
            variant: "outline",
            className: "rounded-full font-bold",
            disabled: de || I || U,
            onClick: () => se(!0),
            children: p.slotEditor.saveAnyway
          }), m.jsx(et, {
            className: "rounded-full px-6 font-extrabold",
            disabled: de || I || U,
            onClick: () => {
              if (B.length) {
                A(z => z + 1), h(B.flatMap(z => [z.aId, z.bId]).filter(z => z !== -1)), Xe.error(p.slotEditor.unresolvedConflict);
                return;
              }
              se(!1);
            },
            children: de ? p.slotEditor.saving : r ? p.slotEditor.saveChanges : p.slotEditor.scheduleClass
          })]
        })]
      })]
    })
  });
}
export { JR };
