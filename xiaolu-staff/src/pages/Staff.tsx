// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as m from 'react/jsx-runtime';
import { Wn, ao, qe } from '@/compat';
import { ja } from '@/components/KidAvatar';
import { Is } from '@/components/Layout';
import { tn, ue } from '@/i18n';
import { jt } from '@/lib/date';
import { Ml } from '@/lib/format';
import { gs } from '@/lib/useMeta';

// 老师与教室页。zf 为统计小卡组件。

function tM() {
  const {
      m: t,
      formatNumber: a
    } = tn(),
    r = gs(),
    l = qe.meta.staff.useQuery(),
    i = l.data ?? [],
    c = r.teachers.length,
    d = r.rooms.length,
    h = r.courses.length,
    p = c === 1 ? d === 1 ? h === 1 ? t.staff.summaryOneOneOne : t.staff.summaryOneOneOther : h === 1 ? t.staff.summaryOneOtherOne : t.staff.summaryOneOtherOther : d === 1 ? h === 1 ? t.staff.summaryOtherOneOne : t.staff.summaryOtherOneOther : h === 1 ? t.staff.summaryOtherOtherOne : t.staff.summaryOtherOtherOther,
    g = 1800;
  return m.jsx(Is, {
    children: m.jsxs("div", {
      className: "px-4 py-6 md:px-8 md:py-8 max-w-[1280px]",
      children: [m.jsx("h1", {
        className: "text-4xl text-cocoa float-in",
        children: Ml(t.staff.title, {
          rooms: m.jsx("span", {
            className: "crayon-underline",
            children: t.staff.roomsWord
          })
        })
      }), m.jsx("p", {
        className: "mt-1 text-sm font-semibold text-cocoa-soft",
        children: ue(p, {
          teachers: c,
          rooms: d,
          courses: h
        })
      }), l.isLoading || r.isLoading ? m.jsx(ao, {
        className: "mt-6 h-96 rounded-[28px]"
      }) : m.jsxs(m.Fragment, {
        children: [m.jsx("h2", {
          className: "mt-8 mb-4 text-2xl text-cocoa",
          children: t.staff.teachers
        }), m.jsx("div", {
          className: "grid gap-5 md:grid-cols-2 xl:grid-cols-3",
          children: r.teachers.map((x, y) => {
            const w = i.filter(N => N.teacherId === x.id),
              E = w.reduce((N, M) => N + (M.endMin - M.startMin), 0),
              C = w.reduce((N, M) => N + M.count, 0),
              S = Array.from(new Set(w.map(N => N.courseId))),
              T = Array.from(new Set(w.map(N => N.weekday))).sort();
            return m.jsxs("article", {
              className: "doodle-card doodle-card-lift relative p-5 float-in",
              style: {
                animationDelay: `${y * 60}ms`
              },
              children: [m.jsx("span", {
                className: "washi",
                style: {
                  background: ["#FFB5C8", "#A9DAF5", "#B5E8C8", "#D3C2F5", "#FFEC99"][y % 5]
                }
              }), m.jsxs("div", {
                className: "flex items-center gap-3",
                children: [m.jsx(ja, {
                  seed: x.avatarSeed,
                  gender: x.id % 2 ? "girl" : "boy",
                  adult: !0,
                  size: 64
                }), m.jsxs("div", {
                  children: [m.jsx("h3", {
                    className: "text-2xl text-cocoa",
                    children: ue(t.staff.teacherName, {
                      name: x.name
                    })
                  }), m.jsx("p", {
                    className: "text-xs font-bold text-cocoa-soft",
                    children: x.specialty
                  })]
                })]
              }), m.jsx("p", {
                className: "mt-3 text-sm font-semibold leading-relaxed text-cocoa-soft",
                children: x.bio
              }), m.jsxs("div", {
                className: "mt-4 grid grid-cols-3 gap-2 text-center",
                children: [m.jsx(zf, {
                  label: t.staff.weeklyClasses,
                  value: w.length
                }), m.jsx(zf, {
                  label: t.staff.weeklyHours,
                  value: a(E / 60, {
                    maximumFractionDigits: 1
                  })
                }), m.jsx(zf, {
                  label: t.staff.studentVisits,
                  value: C
                })]
              }), m.jsx("div", {
                className: "mt-3 flex flex-wrap gap-1.5",
                children: S.map(N => {
                  const M = r.course(N);
                  return m.jsx("span", {
                    className: "rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-cocoa",
                    style: {
                      background: M?.color
                    },
                    children: M?.name
                  }, N);
                })
              }), m.jsx("p", {
                className: "mt-2 text-[11px] font-bold text-cocoa-soft",
                children: ue(t.staff.classDays, {
                  days: T.map(N => t.weekdays[N]).join(t.staff.classDaySeparator) || t.staff.noClassDays
                })
              })]
            }, x.id);
          })
        }), m.jsx("h2", {
          className: "mt-10 mb-4 text-2xl text-cocoa",
          children: t.staff.rooms
        }), m.jsx("div", {
          className: "grid gap-5 lg:grid-cols-3",
          children: r.rooms.map(x => {
            const y = i.filter(C => C.roomId === x.id),
              w = y.reduce((C, S) => C + (S.endMin - S.startMin), 0),
              E = Math.min(100, Math.round(w / g * 100));
            return m.jsxs("article", {
              className: "doodle-card p-5",
              children: [m.jsxs("div", {
                className: "flex items-baseline justify-between",
                children: [m.jsx("h3", {
                  className: "text-2xl text-cocoa",
                  children: x.name
                }), m.jsx("span", {
                  className: "sticker bg-lemon",
                  children: ue(t.staff.seats, {
                    count: x.capacity
                  })
                })]
              }), m.jsx("p", {
                className: "text-xs font-semibold text-cocoa-soft",
                children: x.note
              }), m.jsx("div", {
                className: "mt-3 text-xs font-bold text-cocoa-soft",
                children: ue(t.staff.weeklySchedule, {
                  hours: a(w / 60, {
                    maximumFractionDigits: 1
                  }),
                  usage: E
                })
              }), m.jsx("div", {
                className: "mt-1 h-3 overflow-hidden rounded-full border-2 border-cocoa/10 bg-paper-deep",
                children: m.jsx("div", {
                  className: "crayon-fill h-full rounded-full bg-sky",
                  style: {
                    width: `${E}%`
                  }
                })
              }), m.jsxs("div", {
                className: "mt-4 space-y-1.5",
                children: [[1, 2, 3, 4, 5, 6, 7].map(C => {
                  const S = y.filter(T => T.weekday === C).sort((T, N) => T.startMin - N.startMin);
                  return m.jsxs("div", {
                    className: "flex items-center gap-2 text-xs",
                    children: [m.jsx("span", {
                      className: "w-8 shrink-0 font-display text-cocoa",
                      children: t.weekdays[C]
                    }), m.jsx("div", {
                      className: "relative h-5 flex-1 rounded-full bg-paper",
                      children: S.map(T => m.jsx("span", {
                        className: "absolute top-0.5 bottom-0.5 rounded-full border border-cocoa/10",
                        style: {
                          left: `${(T.startMin - 480) / 780 * 100}%`,
                          width: `${(T.endMin - T.startMin) / 780 * 100}%`,
                          background: r.course(T.courseId)?.color
                        },
                        title: ue(t.staff.slotTitle, {
                          course: r.course(T.courseId)?.name ?? "",
                          start: jt(T.startMin),
                          end: jt(T.endMin)
                        })
                      }, T.id))
                    })]
                  }, C);
                }), m.jsxs("div", {
                  className: "flex justify-between pl-10 text-[10px] font-bold text-cocoa-soft",
                  children: [m.jsx("span", {
                    children: "08:00"
                  }), m.jsx("span", {
                    children: "14:30"
                  }), m.jsx("span", {
                    children: "21:00"
                  })]
                })]
              })]
            }, x.id);
          })
        }), m.jsx("h2", {
          className: "mt-10 mb-4 text-2xl text-cocoa",
          children: t.staff.courses
        }), m.jsx("div", {
          className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
          children: r.courses.map(x => m.jsxs(Wn, {
            href: "/schedule",
            className: "crayon-fill doodle-card-lift block rounded-[24px_20px_26px_22px] border-2 border-cocoa/10 p-4 text-cocoa",
            style: {
              background: x.color
            },
            children: [m.jsxs("div", {
              className: "flex items-baseline justify-between",
              children: [m.jsx("span", {
                className: "font-display text-2xl",
                children: x.name
              }), m.jsx("span", {
                className: "text-xs font-extrabold",
                children: x.ageRange
              })]
            }), m.jsx("p", {
              className: "mt-1 text-sm font-semibold opacity-80",
              children: x.description
            }), m.jsx("p", {
              className: "mt-2 text-xs font-extrabold",
              children: ue(i.filter(y => y.courseId === x.id).length === 1 ? t.staff.weeklyClassOne : t.staff.weeklyClassOther, {
                count: i.filter(y => y.courseId === x.id).length
              })
            })]
          }, x.id))
        })]
      })]
    })
  });
}
function zf({
  label: t,
  value: a
}) {
  return m.jsxs("div", {
    className: "rounded-xl bg-paper py-2",
    children: [m.jsx("div", {
      className: "text-lg font-black tabular-nums text-cocoa",
      children: a
    }), m.jsx("div", {
      className: "text-[10px] font-bold text-cocoa-soft",
      children: t
    })]
  });
}
export { tM, zf };
export default tM;
