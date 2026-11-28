// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as b from 'react';
import * as m from 'react/jsx-runtime';
import { Ee, Xe, ao, et, qe } from '@/compat';
import { ja } from '@/components/KidAvatar';
import { Hm, Is } from '@/components/Layout';
import { JR } from '@/components/SlotEditorDialog';
import { tn, ue } from '@/i18n';
import { no } from '@/lib/constants';
import { Wv, jt, pl, qs } from '@/lib/date';
import { Ym, ta } from '@/lib/errors';
import { Ml } from '@/lib/format';
import { F1, Qs, WR } from '@/lib/slots';
import { gs } from '@/lib/useMeta';
import { Ec, gb, hb, pb, tD, vb, wb } from '@/icons';

// 周课表（时间网格、重叠课程分栏、拖拽式编辑入口）。kn/dl/_n/ux 为时间轴常量，dx 为重叠分栏算法。

const kn = 510,
  dl = 1230,
  _n = 1.15,
  ux = 15;
function dx(t) {
  const a = [...t].sort((h, p) => h.startMin - p.startMin || h.endMin - p.endMin),
    r = new Map();
  let l = [],
    i = -1,
    c = [];
  const d = () => {
    const h = c.length;
    l.forEach(p => r.get(p.id).cols = h), l = [], c = [];
  };
  for (const h of a) {
    l.length && h.startMin >= i && d();
    let p = c.findIndex(g => g <= h.startMin);
    p === -1 ? (p = c.length, c.push(h.endMin)) : c[p] = h.endMin, r.set(h.id, {
      col: p,
      cols: 1
    }), l.push(h), i = Math.max(i, h.endMin);
  }
  return d(), r;
}
function eM() {
  const {
      m: t,
      formatDate: a
    } = tn(),
    r = gs(),
    l = qe.schedule.list.useQuery(),
    i = qe.useUtils(),
    [c, d] = b.useState({
      kind: "all"
    }),
    [h, p] = b.useState(() => Wv(new Date())),
    [g, x] = b.useState(null),
    [y, w] = b.useState(null),
    [E, C] = b.useState(null),
    [S, T] = b.useState(new Set()),
    [N, M] = b.useState(0),
    [q, Q] = b.useState([]),
    [A, B] = b.useState(null),
    j = b.useRef(null),
    R = new Date(),
    X = qs(R),
    W = b.useMemo(() => [1, 2, 3, 4, 5, 6, 7].map(re => pl(h, re - 1)), [h]),
    oe = W.map(qs),
    se = qe.schedule.weekAttendance.useQuery({
      dates: oe
    }),
    V = b.useMemo(() => (l.data ?? []).map(re => ({
      id: re.id,
      courseId: re.courseId,
      teacherId: re.teacherId,
      roomId: re.roomId,
      weekday: re.weekday,
      startMin: re.startMin,
      endMin: re.endMin,
      capacity: re.capacity,
      studentIds: re.studentIds
    })), [l.data]),
    ae = b.useMemo(() => WR(V), [V]),
    ce = b.useMemo(() => new Set(ae.flatMap(re => [re.aId, re.bId])), [ae]),
    k = b.useMemo(() => c.kind === "room" ? V.filter(re => re.roomId === c.id) : c.kind === "teacher" ? V.filter(re => re.teacherId === c.id) : V, [V, c]),
    I = r.rooms.map(re => re.id),
    U = c.kind === "all" ? Math.max(1, I.length) : 1,
    le = b.useMemo(() => {
      const re = new Map();
      for (let Re = 1; Re <= 7; Re++) {
        const Ce = k.filter(be => be.weekday === Re);
        if (c.kind === "all") {
          const be = [];
          I.forEach(($e, xt) => {
            const me = Ce.filter(Qe => Qe.roomId === $e),
              Be = dx(me);
            me.forEach(Qe => be.push({
              ...Qe,
              ...Be.get(Qe.id),
              lane: xt,
              lanes: U
            }));
          }), re.set(Re, be);
        } else {
          const be = dx(Ce);
          re.set(Re, Ce.map($e => ({
            ...$e,
            ...be.get($e.id),
            lane: 0,
            lanes: 1
          })));
        }
      }
      return re;
    }, [k, c.kind, I.join(","), U]),
    de = b.useCallback(re => {
      T(new Set(re)), M(Re => Re + 1), window.setTimeout(() => T(new Set()), 1400);
    }, []),
    D = qe.schedule.update.useMutation({
      onSuccess: () => {
        Xe.success(t.schedule.moved), i.schedule.list.invalidate(), i.today.get.invalidate(), i.meta.staff.invalidate();
      },
      onError: (re, Re) => {
        const Ce = Ym(re);
        Ce ? (de([Re.id, ...Ce.flatMap(be => [be.aId, be.bId])]), Xe.error(ue(t.schedule.moveConflict, {
          conflicts: Array.from(new Set(Ce.flatMap(be => be.kinds))).map(be => t.conflicts[be]).join(t.schedule.listSeparator)
        }))) : Xe.error(ta(re, t));
      }
    }),
    z = (dl - kn) * _n,
    L = [];
  for (let re = Math.ceil(kn / 60) * 60; re <= dl; re += 60) L.push(re);
  const F = re => {
      const Re = re.currentTarget.getBoundingClientRect(),
        Ce = re.clientY - Re.top;
      return kn + Ce / _n;
    },
    ne = re => {
      if (c.kind !== "all") return 0;
      const Re = re.currentTarget.getBoundingClientRect(),
        Ce = re.clientX - Re.left;
      return Math.max(0, Math.min(U - 1, Math.floor(Ce / Re.width * U)));
    },
    fe = (re, Re) => {
      const Ce = j.current;
      if (!Ce) return null;
      const be = V.find(Qe => Qe.id === Ce.id);
      if (!be) return null;
      const $e = be.endMin - be.startMin;
      let xt = Math.round((F(re) - Ce.offsetMin) / ux) * ux;
      xt = Math.max(kn, Math.min(dl - $e, xt));
      const me = ne(re),
        Be = c.kind === "all" ? I[me] : be.roomId;
      return {
        slot: be,
        weekday: Re,
        startMin: xt,
        endMin: xt + $e,
        lane: me,
        roomId: Be
      };
    },
    te = (re, Re) => {
      re.preventDefault();
      const Ce = fe(re, Re);
      if (B(null), j.current = null, !Ce) return;
      const {
        slot: be
      } = Ce;
      if (be.weekday === Ce.weekday && be.startMin === Ce.startMin && be.roomId === Ce.roomId) return;
      const $e = {
          ...be,
          weekday: Ce.weekday,
          startMin: Ce.startMin,
          endMin: Ce.endMin,
          roomId: Ce.roomId
        },
        xt = F1($e, V);
      if (xt.length) {
        de([be.id, ...xt.flatMap(me => [me.aId, me.bId])]), Xe.error(ue(t.schedule.moveConflict, {
          conflicts: xt.map(me => {
            const Be = V.find(Qe => Qe.id === (me.aId === be.id ? me.bId : me.aId));
            return ue(t.schedule.moveConflictDetail, {
              conflicts: me.kinds.map(Qe => t.conflicts[Qe]).join(t.schedule.listSeparator),
              course: r.course(Be?.courseId ?? 0)?.name ?? "",
              time: Be ? Qs(Be, t) : ""
            });
          }).join(t.schedule.conflictSeparator)
        }));
        return;
      }
      D.mutate({
        id: be.id,
        data: {
          courseId: be.courseId,
          teacherId: be.teacherId,
          roomId: Ce.roomId,
          weekday: Ce.weekday,
          startMin: Ce.startMin,
          endMin: Ce.endMin,
          capacity: be.capacity
        }
      });
    },
    pe = new Set((se.data ?? []).map(re => `${re.slotId}|${re.date}`)),
    we = oe.includes(X),
    je = R.getHours() * 60 + R.getMinutes(),
    De = {
      month: "short",
      day: "numeric"
    },
    _e = ue(t.schedule.weekRange, {
      start: a(W[0], De),
      end: a(W[6], De)
    }),
    Ot = [{
      key: "all",
      label: t.schedule.allRooms,
      mode: {
        kind: "all"
      }
    }, ...r.rooms.map(re => ({
      key: `r${re.id}`,
      label: re.name,
      mode: {
        kind: "room",
        id: re.id
      }
    }))],
    pt = c.kind === "all" ? "all" : c.kind === "room" ? `r${c.id}` : `t${c.id}`,
    nn = y ? oe[y.weekday - 1] : void 0;
  return m.jsxs(Is, {
    children: [m.jsxs("div", {
      className: "px-4 py-6 md:px-8 md:py-8",
      children: [m.jsxs(Hm, {
        image: no.bannerSchedule,
        title: Ml(t.schedule.title, {
          timetable: m.jsx("span", {
            className: "crayon-underline",
            children: t.schedule.timetable
          })
        }),
        subtitle: ue(t.schedule.subtitle, {
          count: V.length
        }),
        children: [ae.length > 0 ? m.jsxs("span", {
          className: "sticker bg-alert text-white",
          children: [m.jsx(Ec, {
            className: "h-3 w-3"
          }), " ", ue(ae.length === 1 ? t.schedule.conflictCountOne : t.schedule.conflictCount, {
            count: ae.length
          })]
        }) : m.jsx("span", {
          className: "sticker bg-mint",
          children: t.schedule.noConflicts
        }), m.jsxs("span", {
          className: "sticker bg-sky",
          children: [m.jsx(tD, {
            className: "h-3 w-3"
          }), " ", t.schedule.dragEdit]
        })]
      }), ae.length > 0 && m.jsxs("div", {
        className: "mb-5 doodle-card border-alert/40 bg-alert-soft/60 p-4",
        children: [m.jsxs("div", {
          className: "flex items-center gap-2 font-extrabold text-alert",
          children: [m.jsx(Ec, {
            className: "h-4 w-4"
          }), " ", t.schedule.conflictMessage]
        }), m.jsx("ul", {
          className: "mt-2 space-y-1.5 text-sm font-semibold text-cocoa",
          children: ae.map((re, Re) => {
            const Ce = V.find($e => $e.id === re.aId),
              be = V.find($e => $e.id === re.bId);
            return m.jsxs("li", {
              className: "flex flex-wrap items-center gap-2",
              children: [m.jsx("span", {
                className: "sticker bg-card",
                children: re.kinds.map($e => t.conflicts[$e]).join(t.schedule.listSeparator)
              }), m.jsx("button", {
                className: "underline decoration-dotted hover:text-alert",
                onClick: () => w(Ce),
                children: ue(t.schedule.classAtTime, {
                  course: r.course(Ce.courseId)?.name ?? "",
                  time: Qs(Ce, t)
                })
              }), t.schedule.conflictBetween, m.jsx("button", {
                className: "underline decoration-dotted hover:text-alert",
                onClick: () => w(be),
                children: ue(t.schedule.classAtTime, {
                  course: r.course(be.courseId)?.name ?? "",
                  time: Qs(be, t)
                })
              }), m.jsxs("span", {
                className: "text-cocoa-soft",
                children: [re.kinds.includes("room") && ue(t.schedule.conflictRoom, {
                  room: r.room(Ce.roomId)?.name ?? ""
                }), re.kinds.includes("teacher") && ue(t.schedule.conflictTeacher, {
                  teacher: r.teacher(Ce.teacherId)?.name ?? ""
                })]
              })]
            }, Re);
          })
        })]
      }), m.jsxs("div", {
        className: "mb-4 flex flex-wrap items-center gap-2",
        children: [m.jsxs("div", {
          className: "flex items-center gap-1 rounded-full border-2 border-cocoa/10 bg-card p-1",
          children: [m.jsx(et, {
            variant: "ghost",
            size: "icon",
            className: "h-8 w-8 rounded-full",
            onClick: () => p(pl(h, -7)),
            children: m.jsx(hb, {
              className: "h-4 w-4"
            })
          }), m.jsx("span", {
            className: "px-2 text-sm font-extrabold tabular-nums text-cocoa",
            children: _e
          }), m.jsx(et, {
            variant: "ghost",
            size: "icon",
            className: "h-8 w-8 rounded-full",
            onClick: () => p(pl(h, 7)),
            children: m.jsx(pb, {
              className: "h-4 w-4"
            })
          }), !we && m.jsx(et, {
            variant: "ghost",
            size: "sm",
            className: "rounded-full font-bold",
            onClick: () => p(Wv(new Date())),
            children: t.schedule.thisWeek
          })]
        }), m.jsxs("div", {
          className: "flex flex-wrap gap-1.5",
          children: [Ot.map(re => m.jsx("button", {
            onClick: () => d(re.mode),
            className: Ee("rounded-full border-2 px-3.5 py-1.5 text-sm font-extrabold transition", pt === re.key ? "border-caramel bg-peach text-cocoa" : "border-cocoa/10 bg-card text-cocoa-soft hover:text-cocoa"),
            children: re.label
          }, re.key)), m.jsxs("select", {
            className: Ee("rounded-full border-2 bg-card px-3 py-1.5 text-sm font-extrabold text-cocoa-soft outline-none", c.kind === "teacher" ? "border-caramel bg-peach text-cocoa" : "border-cocoa/10"),
            value: c.kind === "teacher" ? c.id : "",
            onChange: re => re.target.value ? d({
              kind: "teacher",
              id: Number(re.target.value)
            }) : d({
              kind: "all"
            }),
            children: [m.jsx("option", {
              value: "",
              children: t.schedule.viewByTeacher
            }), r.teachers.map(re => m.jsx("option", {
              value: re.id,
              children: ue(t.schedule.teacherName, {
                teacher: re.name
              })
            }, re.id))]
          })]
        }), m.jsxs(et, {
          className: "ml-auto rounded-full font-extrabold",
          onClick: () => C({}),
          children: [m.jsx(vb, {
            className: "h-4 w-4"
          }), " ", t.schedule.newClass]
        })]
      }), m.jsx("div", {
        className: "mb-4 flex flex-wrap gap-2",
        children: r.courses.map(re => m.jsxs("button", {
          onClick: () => x(Re => Re === re.id ? null : re.id),
          className: Ee("crayon-fill flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-extrabold text-cocoa transition", g === re.id ? "border-cocoa/50 scale-105" : "border-cocoa/10", g && g !== re.id && "opacity-40"),
          style: {
            background: re.color
          },
          children: [re.name, m.jsx("span", {
            className: "font-bold opacity-70",
            children: re.ageRange
          })]
        }, re.id))
      }), l.isLoading || r.isLoading ? m.jsx(ao, {
        className: "h-[640px] rounded-[28px]"
      }) : m.jsx("div", {
        className: "doodle-card overflow-x-auto scroll-soft",
        children: m.jsxs("div", {
          style: {
            minWidth: c.kind === "all" ? 1320 : 900
          },
          children: [m.jsxs("div", {
            className: "sticky top-0 z-20 grid border-b-2 border-dashed border-cocoa/10 bg-card/95 backdrop-blur",
            style: {
              gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))"
            },
            children: [m.jsx("div", {}), W.map((re, Re) => {
              const Ce = qs(re) === X,
                be = k.filter($e => $e.weekday === Re + 1).length;
              return m.jsxs("div", {
                className: Ee("px-2 py-3 text-center", Ce && "bg-lemon/50"),
                children: [m.jsx("div", {
                  className: "font-display text-lg text-cocoa",
                  children: t.weekdays[Re + 1]
                }), m.jsxs("div", {
                  className: "text-xs font-bold text-cocoa-soft",
                  children: [ue(t.schedule.daySummary, {
                    date: a(re, De),
                    detail: be ? ue(be === 1 ? t.schedule.classesOne : t.schedule.classesOther, {
                      count: be
                    }) : t.schedule.dayOff
                  }), Ce && m.jsx("span", {
                    className: "ml-1 sticker bg-alert text-white py-0 px-1.5",
                    children: t.schedule.today
                  })]
                }), c.kind === "all" && m.jsx("div", {
                  className: "mt-1.5 grid gap-0.5",
                  style: {
                    gridTemplateColumns: `repeat(${U}, 1fr)`
                  },
                  children: r.rooms.map($e => m.jsx("span", {
                    className: "truncate rounded-full bg-muted px-1 text-[10px] font-bold text-cocoa-soft",
                    title: $e.name,
                    children: t.schedule.roomSuffixes.reduce((xt, me) => xt.replace(me, ""), $e.name)
                  }, $e.id))
                })]
              }, Re);
            })]
          }), m.jsxs("div", {
            className: "grid",
            style: {
              gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))"
            },
            children: [m.jsx("div", {
              className: "relative",
              style: {
                height: z
              },
              children: L.map(re => m.jsx("div", {
                className: "absolute right-2 -translate-y-1/2 text-[11px] font-black tabular-nums text-cocoa-soft",
                style: {
                  top: (re - kn) * _n
                },
                children: jt(re)
              }, re))
            }), W.map((re, Re) => {
              const Ce = Re + 1,
                be = qs(re),
                $e = be === X,
                xt = le.get(Ce) ?? [];
              return m.jsxs("div", {
                className: Ee("relative border-l-2 border-dashed border-cocoa/8", $e && "bg-lemon/15"),
                style: {
                  height: z
                },
                onDragOver: me => {
                  me.preventDefault();
                  const Be = fe(me, Ce);
                  Be && B({
                    weekday: Ce,
                    startMin: Be.startMin,
                    endMin: Be.endMin,
                    lane: Be.lane
                  });
                },
                onDragLeave: me => {
                  me.currentTarget.contains(me.relatedTarget) || B(Be => Be?.weekday === Ce ? null : Be);
                },
                onDrop: me => te(me, Ce),
                onDoubleClick: me => {
                  const Be = me.currentTarget.getBoundingClientRect(),
                    Qe = Math.min(dl - 90, Math.floor((kn + (me.clientY - Be.top) / _n) / 30) * 30),
                    Ra = c.kind === "all" ? Math.floor((me.clientX - Be.left) / Be.width * U) : 0;
                  C({
                    weekday: Ce,
                    startMin: Qe,
                    endMin: Qe + 90,
                    roomId: c.kind === "room" ? c.id : c.kind === "all" ? I[Ra] : void 0,
                    teacherId: c.kind === "teacher" ? c.id : void 0
                  });
                },
                children: [L.map(me => m.jsx("div", {
                  className: "absolute inset-x-0 border-t border-cocoa/[0.06]",
                  style: {
                    top: (me - kn) * _n
                  }
                }, me)), c.kind === "all" && Array.from({
                  length: U - 1
                }).map((me, Be) => m.jsx("div", {
                  className: "absolute inset-y-0 border-l border-dotted border-cocoa/10",
                  style: {
                    left: `${(Be + 1) / U * 100}%`
                  }
                }, Be)), $e && we && je > kn && je < dl && m.jsxs("div", {
                  className: "absolute inset-x-0 z-10 flex items-center",
                  style: {
                    top: (je - kn) * _n
                  },
                  children: [m.jsx("span", {
                    className: "h-2.5 w-2.5 -ml-1.5 rounded-full bg-alert"
                  }), m.jsx("span", {
                    className: "h-0.5 flex-1 bg-alert/70"
                  })]
                }), A?.weekday === Ce && m.jsx("div", {
                  className: "pointer-events-none absolute z-0 rounded-2xl border-2 border-dashed border-caramel bg-peach/30",
                  style: {
                    top: (A.startMin - kn) * _n,
                    height: (A.endMin - A.startMin) * _n,
                    left: `calc(${A.lane / (c.kind === "all" ? U : 1) * 100}% + 2px)`,
                    width: `calc(${100 / (c.kind === "all" ? U : 1)}% - 4px)`
                  }
                }), xt.map(me => {
                  const Be = r.course(me.courseId),
                    Qe = r.teacher(me.teacherId),
                    Ra = r.room(me.roomId),
                    Nn = 100 / me.lanes,
                    er = me.lane * Nn + me.col * Nn / me.cols,
                    sa = Nn / me.cols,
                    ra = ce.has(me.id),
                    pn = S.has(me.id) || q.includes(me.id),
                    tr = pe.has(`${me.id}|${be}`),
                    gn = c.kind === "all",
                    oa = g !== null && g !== me.courseId;
                  return m.jsxs("div", {
                    draggable: !0,
                    onDragStart: dt => {
                      const an = dt.currentTarget.getBoundingClientRect();
                      j.current = {
                        id: me.id,
                        offsetMin: (dt.clientY - an.top) / _n
                      }, dt.dataTransfer.effectAllowed = "move", dt.dataTransfer.setData("text/plain", String(me.id));
                    },
                    onDragEnd: () => {
                      B(null), j.current = null;
                    },
                    onClick: () => w(me),
                    onDoubleClick: dt => dt.stopPropagation(),
                    className: Ee("group absolute z-[5] cursor-grab overflow-hidden rounded-[14px_11px_15px_12px] border-2 p-1.5 text-cocoa shadow-[2px_3px_0_rgb(74_52_38/0.10)] transition-[opacity,box-shadow] hover:z-[15] hover:shadow-[3px_6px_0_rgb(74_52_38/0.14)] active:cursor-grabbing", ra ? "border-alert border-dashed" : "border-cocoa/15", pn ? "shake-now z-[16]" : ra && "shake-loop", oa && "opacity-30"),
                    style: {
                      top: (me.startMin - kn) * _n + 1,
                      height: (me.endMin - me.startMin) * _n - 2,
                      left: `calc(${er}% + 2px)`,
                      width: `calc(${sa}% - 4px)`,
                      background: Be?.color
                    },
                    title: ue(t.schedule.slotTitle, {
                      course: Be?.name ?? "",
                      time: Qs(me, t),
                      teacher: Qe?.name ?? "",
                      room: Ra?.name ?? "",
                      students: me.studentIds.length,
                      capacity: me.capacity
                    }),
                    children: [m.jsx("div", {
                      className: "crayon-fill pointer-events-none absolute inset-0"
                    }), m.jsxs("div", {
                      className: "relative flex h-full flex-col",
                      children: [m.jsx("div", {
                        className: Ee("font-display leading-tight", gn ? "text-[13px]" : "text-base"),
                        children: Be?.name
                      }), m.jsxs("div", {
                        className: "text-[10px] font-black tabular-nums opacity-75",
                        children: [jt(me.startMin), !gn && ue(t.schedule.timeUntil, {
                          end: jt(me.endMin)
                        })]
                      }), m.jsxs("div", {
                        className: "mt-auto flex flex-wrap items-center gap-x-1 text-[10px] font-extrabold",
                        children: [gn ? m.jsx("span", {
                          children: ue(t.schedule.shortTeacher, {
                            teacher: Qe?.name.slice(0, 1) ?? ""
                          })
                        }) : m.jsxs(m.Fragment, {
                          children: [m.jsx(ja, {
                            seed: Qe?.avatarSeed ?? "t",
                            gender: me.teacherId % 2 ? "girl" : "boy",
                            adult: !0,
                            size: 18,
                            ring: !1
                          }), m.jsx("span", {
                            children: Qe?.name
                          }), m.jsxs("span", {
                            className: "opacity-70",
                            children: ["· ", Ra?.name]
                          })]
                        }), m.jsxs("span", {
                          className: "inline-flex items-center gap-0.5 opacity-80",
                          children: [m.jsx(wb, {
                            className: "h-2.5 w-2.5"
                          }), me.studentIds.length]
                        })]
                      }), tr && m.jsx(gb, {
                        className: "absolute right-0 top-0 h-3.5 w-3.5 text-[#3f9b63]"
                      }), ra && m.jsx("span", {
                        className: "absolute -right-0.5 bottom-0 rotate-[-6deg] rounded-full bg-alert px-1 text-[9px] font-black text-white",
                        children: t.schedule.conflict
                      })]
                    })]
                  }, `${me.id}-${pn ? N : 0}`);
                })]
              }, Re);
            })]
          })]
        })
      }), m.jsx("p", {
        className: "mt-3 text-xs font-semibold text-cocoa-soft",
        children: ue(t.schedule.tip, {
          roomMove: c.kind === "all" ? t.schedule.roomMoveTip : ""
        })
      })]
    }), m.jsx(JR, {
      open: !!y || !!E,
      onOpenChange: re => {
        re || (w(null), C(null));
      },
      slot: y,
      defaults: E ?? void 0,
      allSlots: V,
      dateForSlot: nn,
      canRollCall: !!nn && nn <= X,
      onConflictPreview: Q
    })]
  });
}
export { kn, dl, _n, ux, dx, eM };
export default eM;
