// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as b from 'react';
import * as m from 'react/jsx-runtime';
import { Ee, Wn, Xe, ao, et, qe } from '@/compat';
import { $c } from '@/components/HoursBar';
import { ja } from '@/components/KidAvatar';
import { Hm, Is } from '@/components/Layout';
import { yM } from '@/components/RollCallDialog';
import { tn, ue } from '@/i18n';
import { no } from '@/lib/constants';
import { Lb, Pb, jt, pl, qs } from '@/lib/date';
import { ta } from '@/lib/errors';
import { Ml } from '@/lib/format';
import { ls } from '@/lib/students';
import { gs } from '@/lib/useMeta';
import { WN, eD, gb, hb, pb, sD, xb } from '@/icons';

// 今日课程（时间轴、点名、续费提醒）。vM 为本地 useNow 钩子。

function vM() {
  const [t, a] = b.useState(() => new Date());
  return b.useEffect(() => {
    const r = setInterval(() => a(new Date()), 3e4);
    return () => clearInterval(r);
  }, []), t;
}
function xM() {
  const {
      m: t,
      formatDate: a
    } = tn(),
    r = vM(),
    l = qs(r),
    [i, c] = b.useState(() => {
      const V = new URLSearchParams(window.location.search).get("date");
      return V && /^\d{4}-\d{2}-\d{2}$/.test(V) ? V : l;
    }),
    [d, h] = b.useState(l);
  b.useEffect(() => {
    l !== d && (i === d && c(l), h(l));
  }, [l, d, i]);
  const p = Pb(i),
    g = Lb(p),
    x = i === l,
    y = i > l,
    w = r.getHours() * 60 + r.getMinutes(),
    E = gs(),
    C = qe.today.get.useQuery({
      date: i,
      weekday: g
    }),
    S = qe.students.list.useQuery(),
    [T, N] = b.useState(null),
    M = C.data ?? [],
    q = M.reduce((V, ae) => V + ae.students.length, 0),
    Q = M.filter(V => V.attendance.length > 0).length,
    A = x && M.some(V => w >= V.startMin && w < V.endMin),
    B = x && !A ? M.findIndex(V => V.startMin > w) : -1,
    j = b.useMemo(() => (S.data ?? []).filter(V => ls(V.balance.remaining) !== "ok" && V.slotIds.length > 0).sort((V, ae) => V.balance.remaining - ae.balance.remaining), [S.data]),
    R = qe.useUtils(),
    X = qe.students.renew.useMutation({
      onSuccess: (V, ae) => {
        const ce = S.data?.find(k => k.id === ae.id);
        Xe.success(ue(t.today.renewSuccess, {
          name: ce?.name ?? t.today.studentFallback
        })), R.students.list.invalidate(), R.today.get.invalidate(), R.students.get.invalidate();
      },
      onError: V => Xe.error(ta(V, t))
    }),
    W = x ? w < 720 ? t.today.greetingMorning : w < 1080 ? t.today.greetingAfternoon : t.today.greetingEvening : "",
    oe = x ? t.today.today : a(p, {
      month: "short",
      day: "numeric"
    }),
    se = a(p, {
      month: "short",
      day: "numeric"
    });
  return m.jsxs(Is, {
    children: [m.jsxs("div", {
      className: "px-4 py-6 md:px-8 md:py-8 max-w-[1320px]",
      children: [m.jsxs(Hm, {
        image: no.heroToday,
        title: Ml(M.length === 1 ? t.today.headerOne : t.today.headerOther, {
          greeting: W,
          date: m.jsx("span", {
            className: "crayon-underline",
            children: oe
          }),
          count: M.length
        }),
        subtitle: M.length > 0 ? ue(q === 1 ? t.today.subtitleOne : t.today.subtitleOther, {
          weekday: t.weekdays[g],
          date: se,
          total: q
        }) : ue(t.today.restSubtitle, {
          weekday: t.weekdays[g]
        }),
        children: [m.jsx("span", {
          className: "sticker bg-lemon",
          children: ue(t.today.rollCallProgress, {
            done: Q,
            total: M.length
          })
        }), m.jsx("span", {
          className: "sticker bg-alert-soft text-alert",
          children: ue(j.length === 1 ? t.today.renewalDueOne : t.today.renewalDueOther, {
            count: j.length
          })
        })]
      }), m.jsxs("div", {
        className: "grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]",
        children: [m.jsxs("section", {
          children: [m.jsxs("div", {
            className: "mb-4 flex flex-wrap items-center gap-2",
            children: [m.jsx("h2", {
              className: "text-2xl text-cocoa mr-auto",
              children: t.today.timelineTitle
            }), m.jsxs(et, {
              variant: "outline",
              size: "sm",
              className: "rounded-full font-bold",
              onClick: () => c(qs(pl(p, -1))),
              children: [m.jsx(hb, {
                className: "h-4 w-4"
              }), " ", t.today.previousDay]
            }), !x && m.jsxs(et, {
              variant: "outline",
              size: "sm",
              className: "rounded-full font-bold",
              onClick: () => c(l),
              children: [m.jsx(xb, {
                className: "h-4 w-4"
              }), " ", t.today.returnToday]
            }), m.jsxs(et, {
              variant: "outline",
              size: "sm",
              className: "rounded-full font-bold",
              onClick: () => c(qs(pl(p, 1))),
              children: [t.today.nextDay, " ", m.jsx(pb, {
                className: "h-4 w-4"
              })]
            })]
          }), C.isLoading ? m.jsx("div", {
            className: "space-y-4",
            children: [0, 1, 2].map(V => m.jsx(ao, {
              className: "h-36 rounded-[28px]"
            }, V))
          }) : M.length === 0 ? m.jsxs("div", {
            className: "doodle-card flex flex-col items-center py-12 text-center",
            children: [m.jsx("img", {
              src: no.emptySleep,
              alt: "",
              className: "h-44 w-44 rounded-full object-cover"
            }), m.jsx("p", {
              className: "mt-4 font-display text-2xl text-cocoa",
              children: t.today.emptyTitle
            }), m.jsx("p", {
              className: "mt-1 text-sm font-semibold text-cocoa-soft",
              children: t.today.emptyBody
            }), m.jsx(Wn, {
              href: "/schedule",
              children: m.jsx(et, {
                className: "mt-4 rounded-full font-extrabold",
                children: t.today.scheduleClass
              })
            })]
          }) : m.jsxs("ol", {
            className: "relative",
            children: [M.map((V, ae) => {
              const ce = E.course(V.courseId),
                k = E.teacher(V.teacherId),
                I = E.room(V.roomId),
                U = x && w >= V.startMin && w < V.endMin,
                le = x && w >= V.endMin || !x && !y,
                de = V.attendance.length > 0,
                D = V.attendance.filter(F => F.status === "present").length,
                z = ae === B,
                L = V.students.filter(F => ls(F.balance.remaining) !== "ok").length;
              return m.jsxs("li", {
                className: "relative pl-20 md:pl-28 pb-5 float-in",
                style: {
                  animationDelay: `${ae * 60}ms`
                },
                children: [m.jsxs("div", {
                  className: "absolute left-0 top-3 w-16 md:w-24 text-right",
                  children: [m.jsx("div", {
                    className: "font-black text-lg md:text-xl tabular-nums text-cocoa",
                    children: jt(V.startMin)
                  }), m.jsx("div", {
                    className: "text-xs font-bold text-cocoa-soft tabular-nums",
                    children: jt(V.endMin)
                  })]
                }), m.jsx("div", {
                  className: "absolute left-[4.6rem] md:left-[6.6rem] top-0 bottom-0 w-3 dotted-path"
                }), m.jsx("div", {
                  className: "absolute left-[4.35rem] md:left-[6.35rem] top-4 h-5 w-5 rounded-full border-[3px] border-card",
                  style: {
                    background: ce?.color,
                    boxShadow: "0 0 0 2px rgb(74 52 38 / 0.18)"
                  }
                }), z && m.jsxs("div", {
                  className: "relative -mt-1 mb-3 flex items-center gap-2",
                  children: [m.jsx("span", {
                    className: "sticker bg-alert text-white",
                    children: ue(t.today.now, {
                      time: jt(w)
                    })
                  }), m.jsx("span", {
                    className: "h-0.5 flex-1 rounded bg-alert/40"
                  })]
                }), m.jsxs("article", {
                  className: Ee("doodle-card doodle-card-lift relative overflow-hidden", le && !U && "opacity-80"),
                  children: [m.jsx("div", {
                    className: "crayon-fill absolute inset-y-0 left-0 w-2.5",
                    style: {
                      background: ce?.color
                    }
                  }), m.jsxs("div", {
                    className: "p-4 pl-6 md:p-5 md:pl-7",
                    children: [m.jsxs("div", {
                      className: "flex flex-wrap items-start gap-3",
                      children: [m.jsxs("div", {
                        className: "min-w-0 flex-1",
                        children: [m.jsxs("div", {
                          className: "flex flex-wrap items-center gap-2",
                          children: [m.jsx("h3", {
                            className: "text-2xl text-cocoa",
                            children: ce?.name
                          }), m.jsx("span", {
                            className: "sticker",
                            style: {
                              background: ce?.color
                            },
                            children: ce?.ageRange
                          }), U && m.jsx("span", {
                            className: "sticker bg-alert text-white",
                            children: t.today.live
                          }), de && m.jsxs("span", {
                            className: "sticker bg-mint",
                            children: [m.jsx(gb, {
                              className: "h-3 w-3"
                            }), " ", ue(t.today.classRollCallDone, {
                              present: D,
                              total: V.students.length
                            })]
                          })]
                        }), m.jsxs("div", {
                          className: "mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-cocoa-soft",
                          children: [m.jsxs("span", {
                            className: "inline-flex items-center gap-1.5",
                            children: [m.jsx(ja, {
                              seed: k?.avatarSeed ?? "t",
                              gender: V.teacherId % 2 ? "girl" : "boy",
                              adult: !0,
                              size: 22,
                              ring: !1
                            }), ue(t.today.teacherName, {
                              name: k?.name ?? ""
                            })]
                          }), m.jsxs("span", {
                            className: "inline-flex items-center gap-1",
                            children: [m.jsx(sD, {
                              className: "h-3.5 w-3.5"
                            }), I?.name]
                          }), m.jsxs("span", {
                            className: "inline-flex items-center gap-1",
                            children: [m.jsx(WN, {
                              className: "h-3.5 w-3.5"
                            }), ue((V.endMin - V.startMin) / 60 === 1 ? t.today.durationOne : t.today.durationOther, {
                              hours: (V.endMin - V.startMin) / 60
                            })]
                          }), m.jsxs("span", {
                            className: "inline-flex items-center gap-1",
                            children: [m.jsx(eD, {
                              className: "h-3.5 w-3.5"
                            }), ue(V.students.length === 1 ? t.today.capacityOne : t.today.capacityOther, {
                              students: V.students.length,
                              capacity: V.capacity
                            })]
                          })]
                        })]
                      }), m.jsx(et, {
                        className: Ee("rounded-full px-5 font-extrabold", de && "bg-secondary text-cocoa hover:bg-muted"),
                        onClick: () => N(V),
                        disabled: y,
                        title: y ? t.today.futureClassTitle : void 0,
                        children: de ? t.today.editRollCall : y ? t.today.upcoming : t.today.startRollCall
                      })]
                    }), m.jsx("div", {
                      className: "mt-4 flex flex-wrap gap-2",
                      children: V.students.map(F => {
                        const ne = ls(F.balance.remaining),
                          fe = V.attendance.find(te => te.studentId === F.id);
                        return m.jsxs(Wn, {
                          href: `/students/${F.id}`,
                          className: Ee("group flex items-center gap-1.5 rounded-full border-2 bg-paper/80 py-0.5 pl-0.5 pr-2.5 text-xs font-extrabold text-cocoa transition hover:-translate-y-0.5", ne === "ok" ? "border-cocoa/8" : "border-alert/60 bg-alert-soft", fe?.status === "leave" && "opacity-60", fe?.status === "absent" && "opacity-50 line-through"),
                          title: ue(F.balance.remaining === 1 ? t.today.studentBalanceOne : t.today.studentBalanceOther, {
                            name: F.name,
                            remaining: F.balance.remaining
                          }),
                          children: [m.jsx(ja, {
                            seed: F.avatarSeed,
                            gender: F.gender,
                            size: 26,
                            ring: !1
                          }), F.name, m.jsx("span", {
                            className: Ee("tabular-nums", ne === "ok" ? "text-cocoa-soft" : "text-alert"),
                            children: F.balance.remaining
                          })]
                        }, F.id);
                      })
                    }), L > 0 && m.jsx("p", {
                      className: "mt-3 text-xs font-bold text-alert",
                      children: ue(L === 1 ? t.today.lowKidsOne : t.today.lowKidsOther, {
                        count: L
                      })
                    })]
                  })]
                })]
              }, V.id);
            }), x && M.length > 0 && w >= M[M.length - 1].endMin && m.jsx("li", {
              className: "relative pl-20 md:pl-28",
              children: m.jsxs("div", {
                className: "flex items-center gap-2",
                children: [m.jsx("span", {
                  className: "sticker bg-alert text-white",
                  children: ue(t.today.now, {
                    time: jt(w)
                  })
                }), m.jsx("span", {
                  className: "text-sm font-bold text-cocoa-soft",
                  children: t.today.dayComplete
                })]
              })
            })]
          })]
        }), m.jsx("aside", {
          className: "space-y-4",
          children: m.jsxs("div", {
            className: "doodle-card relative p-5",
            children: [m.jsx("span", {
              className: "washi bg-alert/60"
            }), m.jsx("h2", {
              className: "text-2xl text-cocoa",
              children: t.today.renewalReminder
            }), m.jsx("p", {
              className: "mt-1 text-xs font-semibold text-cocoa-soft",
              children: t.today.renewalDescription
            }), m.jsxs("div", {
              className: "mt-4 space-y-3 max-h-[640px] overflow-y-auto scroll-soft pr-1",
              children: [S.isLoading && m.jsx(ao, {
                className: "h-40 rounded-2xl"
              }), j.length === 0 && !S.isLoading && m.jsx("p", {
                className: "py-6 text-center text-sm font-semibold text-cocoa-soft",
                children: t.today.plenty
              }), j.map(V => m.jsxs("div", {
                className: "rounded-2xl border-2 border-alert/25 bg-alert-soft/50 p-3",
                children: [m.jsxs("div", {
                  className: "flex items-center gap-2.5",
                  children: [m.jsx(Wn, {
                    href: `/students/${V.id}`,
                    children: m.jsx(ja, {
                      seed: V.avatarSeed,
                      gender: V.gender,
                      size: 40
                    })
                  }), m.jsxs("div", {
                    className: "min-w-0 flex-1",
                    children: [m.jsx(Wn, {
                      href: `/students/${V.id}`,
                      className: "font-extrabold text-cocoa hover:underline",
                      children: V.name
                    }), m.jsxs("div", {
                      className: "text-[11px] font-bold text-cocoa-soft",
                      children: [V.parentName, " · ", V.parentPhone]
                    })]
                  }), m.jsx(et, {
                    size: "sm",
                    className: "rounded-full bg-alert hover:bg-alert/90 text-white font-extrabold",
                    disabled: X.isPending,
                    onClick: () => X.mutate({
                      id: V.id
                    }),
                    children: t.today.renew
                  })]
                }), m.jsx($c, {
                  remaining: V.balance.remaining,
                  compact: !0,
                  className: "mt-2"
                })]
              }, V.id))]
            })]
          })
        })]
      })]
    }), T && m.jsx(yM, {
      open: !!T,
      onOpenChange: V => !V && N(null),
      slotId: T.id,
      date: i,
      courseName: E.course(T.courseId)?.name ?? "",
      courseColor: E.course(T.courseId)?.color ?? "#eee",
      startMin: T.startMin,
      endMin: T.endMin,
      students: T.students,
      existing: T.attendance
    })]
  });
}
export { vM, xM };
export default xM;
