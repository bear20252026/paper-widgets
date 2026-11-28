// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as b from 'react';
import * as m from 'react/jsx-runtime';
import { Ee, It, Mb, Pn, Wn, Xe, ao, et, fo, ho, mo, po, qe, uo } from '@/compat';
import { $c } from '@/components/HoursBar';
import { ja } from '@/components/KidAvatar';
import { Is } from '@/components/Layout';
import { J1 } from '@/components/StudentFormDialog';
import { tn, ue } from '@/i18n';
import { jt } from '@/lib/date';
import { Ym, ta } from '@/lib/errors';
import { Ub } from '@/lib/format';
import { Qs } from '@/lib/slots';
import { ls } from '@/lib/students';
import { gs } from '@/lib/useMeta';
import { JN, KN, Sb, YN, lD, oD, uD, yb } from '@/icons';

// 学员详情（课时包、出勤历史、作品墙、选课时段/上传作品弹窗）。iM/cM/uM 为课时包与出勤状态映射。

const iM = {
  "First enrollment": "first",
  Renewal: "renewal"
};
function cM(t, a) {
  if (!t) return "";
  const r = iM[t];
  return r ? a.pkgNotes[r] : t;
}
const uM = {
  present: "bg-mint",
  leave: "bg-sky",
  absent: "bg-blush"
};
function dM() {
  const t = Mb(),
    a = Number(t.id),
    {
      m: r,
      formatDate: l
    } = tn(),
    i = R => l(typeof R == "string" ? new Date(R) : R, {
      year: "numeric",
      month: "short",
      day: "numeric"
    }),
    c = gs(),
    d = qe.students.get.useQuery({
      id: a
    }, {
      enabled: Number.isFinite(a) && a > 0
    }),
    h = qe.schedule.list.useQuery(),
    p = qe.useUtils(),
    [g, x] = b.useState(!1),
    [y, w] = b.useState(!1),
    [E, C] = b.useState(!1),
    [S, T] = b.useState(null),
    N = () => {
      p.students.get.invalidate({
        id: a
      }), p.students.list.invalidate(), p.today.get.invalidate();
    },
    M = qe.students.renew.useMutation({
      onSuccess: () => {
        Xe.success(r.studentDetail.renewSuccess), N();
      },
      onError: R => Xe.error(ta(R, r))
    }),
    q = qe.students.shuffleAvatar.useMutation({
      onSuccess: N
    }),
    Q = qe.artworks.remove.useMutation({
      onSuccess: () => {
        Xe.success(r.studentDetail.artworkRemoved), N();
      }
    });
  if (d.isLoading) return m.jsx(Is, {
    children: m.jsx("div", {
      className: "px-4 py-8 md:px-8",
      children: m.jsx(ao, {
        className: "h-96 rounded-[28px]"
      })
    })
  });
  if (!d.data) return m.jsx(Is, {
    children: m.jsxs("div", {
      className: "px-4 py-16 text-center",
      children: [m.jsx("p", {
        className: "font-display text-2xl text-cocoa",
        children: r.studentDetail.notFoundTitle
      }), m.jsx(Wn, {
        href: "/students",
        children: m.jsx(et, {
          className: "mt-4 rounded-full",
          children: r.studentDetail.backToProfiles
        })
      })]
    })
  });
  const A = d.data,
    B = ls(A.balance.remaining),
    j = (h.data ?? []).filter(R => A.slotIds.includes(R.id));
  return m.jsxs(Is, {
    children: [m.jsxs("div", {
      className: "px-4 py-6 md:px-8 md:py-8 max-w-[1280px]",
      children: [m.jsxs(Wn, {
        href: "/students",
        className: "mb-4 inline-flex items-center gap-1 text-sm font-extrabold text-cocoa-soft hover:text-cocoa",
        children: [m.jsx(KN, {
          className: "h-4 w-4"
        }), " ", r.studentDetail.backToProfiles]
      }), m.jsxs("div", {
        className: "grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]",
        children: [m.jsxs("div", {
          className: "space-y-5",
          children: [m.jsxs("section", {
            className: Ee("doodle-card relative p-6 text-center float-in", B !== "ok" && "border-alert/45"),
            children: [m.jsx("span", {
              className: "washi bg-blush"
            }), m.jsxs("div", {
              className: "relative mx-auto w-fit",
              children: [m.jsx(ja, {
                seed: A.avatarSeed,
                gender: A.gender,
                size: 132
              }), m.jsx("button", {
                onClick: () => q.mutate({
                  id: a
                }),
                className: "absolute -right-1 bottom-1 rounded-full border-2 border-cocoa/10 bg-card p-1.5 text-cocoa-soft shadow hover:text-cocoa",
                title: r.studentDetail.changeAvatar,
                children: m.jsx(JN, {
                  className: "h-4 w-4"
                })
              })]
            }), m.jsx("h1", {
              className: "mt-3 text-4xl text-cocoa",
              children: A.name
            }), m.jsx("p", {
              className: "text-sm font-bold text-cocoa-soft",
              children: A.nickname ? ue(r.studentDetail.nicknameAgeGender, {
                nickname: A.nickname,
                age: A.age,
                gender: A.gender === "girl" ? r.studentDetail.girl : r.studentDetail.boy
              }) : ue(r.studentDetail.ageGender, {
                age: A.age,
                gender: A.gender === "girl" ? r.studentDetail.girl : r.studentDetail.boy
              })
            }), m.jsxs("div", {
              className: "mt-4 space-y-1 rounded-2xl bg-paper p-3 text-left text-sm font-semibold text-cocoa",
              children: [m.jsxs("div", {
                className: "flex items-center gap-2",
                children: [m.jsx(lD, {
                  className: "h-3.5 w-3.5 text-cocoa-soft"
                }), ue(r.studentDetail.parentInfo, {
                  parentName: A.parentName ?? r.studentDetail.parent,
                  parentPhone: A.parentPhone ?? r.studentDetail.notEntered
                })]
              }), m.jsx("div", {
                className: "text-xs text-cocoa-soft",
                children: ue(r.studentDetail.joined, {
                  date: i(A.joinedAt)
                })
              }), A.note && m.jsxs("p", {
                className: "pt-1 text-xs leading-relaxed text-cocoa-soft",
                children: ["“", A.note, "”"]
              })]
            }), m.jsxs(et, {
              variant: "outline",
              size: "sm",
              className: "mt-3 rounded-full font-bold",
              onClick: () => x(!0),
              children: [m.jsx(oD, {
                className: "h-3.5 w-3.5"
              }), " ", r.studentDetail.editProfile]
            })]
          }), m.jsxs("section", {
            className: Ee("doodle-card p-5", B !== "ok" && "bg-alert-soft/40"),
            children: [m.jsxs("div", {
              className: "flex items-center justify-between",
              children: [m.jsx("h2", {
                className: "text-2xl text-cocoa",
                children: r.packageCard.title
              }), m.jsxs(et, {
                size: "sm",
                className: Ee("rounded-full font-extrabold", B !== "ok" && "bg-alert hover:bg-alert/90 text-white"),
                onClick: () => M.mutate({
                  id: a
                }),
                disabled: M.isPending,
                children: [m.jsx(uD, {
                  className: "h-4 w-4"
                }), " ", r.studentDetail.renew]
              })]
            }), m.jsx($c, {
              remaining: A.balance.remaining,
              className: "mt-4"
            }), m.jsxs("div", {
              className: "mt-3 grid grid-cols-3 gap-2 text-center",
              children: [m.jsx(Pf, {
                label: r.studentDetail.totalPurchased,
                value: `${A.balance.purchased}`
              }), m.jsx(Pf, {
                label: r.studentDetail.used,
                value: `${A.balance.used}`
              }), m.jsx(Pf, {
                label: r.studentDetail.remaining,
                value: `${A.balance.remaining}`,
                alert: B !== "ok"
              })]
            }), m.jsx("div", {
              className: "mt-4 space-y-1.5",
              children: A.packages.map(R => m.jsxs("div", {
                className: "flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-xs font-bold text-cocoa",
                children: [m.jsx("span", {
                  children: ue(r.studentDetail.packageEntry, {
                    date: i(R.purchasedAt),
                    note: cM(R.note, r) || r.packageCard.title
                  })
                }), m.jsx("span", {
                  className: "tabular-nums",
                  children: ue(r.studentDetail.packagePrice, {
                    hours: R.hours,
                    price: Ub(R.priceCents)
                  })
                })]
              }, R.id))
            })]
          })]
        }), m.jsxs("div", {
          className: "space-y-6",
          children: [m.jsxs("section", {
            className: "doodle-card p-5",
            children: [m.jsxs("div", {
              className: "flex items-center justify-between",
              children: [m.jsxs("h2", {
                className: "text-2xl text-cocoa",
                children: [r.studentDetail.portfolio, " ", m.jsx("span", {
                  className: "text-base text-cocoa-soft",
                  children: ue(A.artworks.length === 1 ? r.studentDetail.artworkCountOne : r.studentDetail.artworkCountOther, {
                    count: A.artworks.length
                  })
                })]
              }), m.jsxs(et, {
                size: "sm",
                className: "rounded-full font-extrabold",
                onClick: () => C(!0),
                children: [m.jsx(yb, {
                  className: "h-4 w-4"
                }), " ", r.studentDetail.uploadArtwork]
              })]
            }), A.artworks.length === 0 ? m.jsx("p", {
              className: "py-10 text-center text-sm font-semibold text-cocoa-soft",
              children: r.studentDetail.noArtwork
            }) : m.jsx("div", {
              className: "mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3",
              children: A.artworks.map((R, X) => m.jsxs("figure", {
                className: "group relative cursor-zoom-in rounded-xl bg-card p-2 pb-1 shadow-[2px_4px_0_rgb(74_52_38/0.10)] border-2 border-cocoa/8 transition hover:-translate-y-1",
                style: {
                  transform: `rotate(${(X % 3 - 1) * 1.2}deg)`
                },
                onClick: () => T(R),
                children: [m.jsx("div", {
                  className: "aspect-[4/3] overflow-hidden rounded-lg bg-muted",
                  children: m.jsx("img", {
                    src: R.imageUrl,
                    alt: R.title,
                    loading: "lazy",
                    className: "h-full w-full object-cover"
                  })
                }), m.jsxs("figcaption", {
                  className: "mt-1.5 flex items-center justify-between px-0.5 text-xs font-extrabold text-cocoa",
                  children: [m.jsx("span", {
                    className: "truncate",
                    children: R.title
                  }), m.jsx("span", {
                    className: "text-[10px] text-cocoa-soft",
                    children: i(R.createdAt)
                  })]
                }), R.courseId && m.jsx("span", {
                  className: "absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-cocoa",
                  style: {
                    background: c.course(R.courseId)?.color
                  },
                  children: c.course(R.courseId)?.name
                }), m.jsx("button", {
                  className: "absolute right-3 top-3 hidden rounded-full bg-card/90 p-1 text-cocoa-soft hover:text-destructive group-hover:block",
                  onClick: W => {
                    W.stopPropagation(), confirm(ue(r.studentDetail.removeArtworkConfirm, {
                      title: R.title
                    })) && Q.mutate({
                      id: R.id
                    });
                  },
                  title: r.studentDetail.removeArtwork,
                  children: m.jsx(Sb, {
                    className: "h-3.5 w-3.5"
                  })
                })]
              }, R.id))
            })]
          }), m.jsxs("section", {
            className: "doodle-card p-5",
            children: [m.jsxs("div", {
              className: "flex items-center justify-between",
              children: [m.jsx("h2", {
                className: "text-2xl text-cocoa",
                children: r.studentDetail.weeklyClasses
              }), m.jsxs(et, {
                variant: "outline",
                size: "sm",
                className: "rounded-full font-bold",
                onClick: () => w(!0),
                children: [m.jsx(YN, {
                  className: "h-4 w-4"
                }), " ", r.studentDetail.adjustClasses]
              })]
            }), m.jsxs("div", {
              className: "mt-4 flex flex-wrap gap-3",
              children: [j.length === 0 && m.jsx("p", {
                className: "text-sm font-semibold text-cocoa-soft",
                children: r.studentDetail.noClasses
              }), j.map(R => {
                const X = c.course(R.courseId);
                return m.jsxs("div", {
                  className: "crayon-fill rounded-2xl border-2 border-cocoa/10 px-4 py-3 text-cocoa",
                  style: {
                    background: X?.color
                  },
                  children: [m.jsx("div", {
                    className: "font-display text-lg",
                    children: X?.name
                  }), m.jsx("div", {
                    className: "text-xs font-extrabold",
                    children: Qs(R, r)
                  }), m.jsx("div", {
                    className: "text-xs font-bold opacity-75",
                    children: ue(r.studentDetail.teacherRoom, {
                      teacher: c.teacher(R.teacherId)?.name ?? "",
                      room: c.room(R.roomId)?.name ?? ""
                    })
                  })]
                }, R.id);
              })]
            })]
          }), m.jsxs("section", {
            className: "doodle-card p-5",
            children: [m.jsx("h2", {
              className: "text-2xl text-cocoa",
              children: r.studentDetail.classRecords
            }), m.jsx("p", {
              className: "text-xs font-semibold text-cocoa-soft",
              children: r.studentDetail.classRecordsHint
            }), m.jsxs("div", {
              className: "mt-3 grid gap-1.5 sm:grid-cols-2",
              children: [A.attendance.length === 0 && m.jsx("p", {
                className: "text-sm font-semibold text-cocoa-soft",
                children: r.studentDetail.noClassRecords
              }), A.attendance.map(R => {
                const X = R.courseId ? c.course(R.courseId) : void 0;
                return m.jsxs("div", {
                  className: "flex items-center gap-2 rounded-xl bg-paper px-3 py-2 text-xs font-bold text-cocoa",
                  children: [m.jsx("span", {
                    className: "h-2.5 w-2.5 rounded-full",
                    style: {
                      background: X?.color ?? "#ddd"
                    }
                  }), m.jsx("span", {
                    className: "tabular-nums",
                    children: i(R.date)
                  }), m.jsx("span", {
                    className: "truncate",
                    children: X?.name ?? r.studentDetail.deletedClass
                  }), m.jsx("span", {
                    className: Ee("ml-auto rounded-full px-2 py-0.5", uM[R.status]),
                    children: r.attendance[R.status]
                  }), m.jsx("span", {
                    className: "w-10 text-right tabular-nums text-cocoa-soft",
                    children: R.hoursDeducted ? ue(r.studentDetail.deductedHours, {
                      hours: R.hoursDeducted
                    }) : r.studentDetail.noHoursDeducted
                  })]
                }, R.id);
              })]
            })]
          })]
        })]
      })]
    }), m.jsx(J1, {
      open: g,
      onOpenChange: x,
      student: A
    }), m.jsx(fM, {
      open: y,
      onOpenChange: w,
      studentId: a,
      current: A.slotIds,
      age: A.age
    }), m.jsx(mM, {
      open: E,
      onOpenChange: C,
      studentId: a
    }), m.jsx(uo, {
      open: !!S,
      onOpenChange: R => !R && T(null),
      children: m.jsxs(fo, {
        className: "sm:max-w-3xl bg-card rounded-[28px] border-2 border-cocoa/10",
        children: [m.jsxs(mo, {
          children: [m.jsx(ho, {
            className: "font-display text-2xl font-normal text-cocoa",
            children: S?.title
          }), m.jsx(po, {
            className: "font-semibold text-cocoa-soft",
            children: ue(r.studentDetail.artworkByStudent, {
              name: A.name
            })
          })]
        }), S && m.jsx("img", {
          src: S.imageUrl,
          alt: S.title,
          className: "w-full rounded-2xl"
        })]
      })
    })]
  });
}
function Pf({
  label: t,
  value: a,
  alert: r
}) {
  return m.jsxs("div", {
    className: "rounded-xl bg-paper py-2",
    children: [m.jsx("div", {
      className: Ee("text-xl font-black tabular-nums", r ? "text-alert" : "text-cocoa"),
      children: a
    }), m.jsx("div", {
      className: "text-[10px] font-bold text-cocoa-soft",
      children: t
    })]
  });
}
function fM({
  open: t,
  onOpenChange: a,
  studentId: r,
  current: l,
  age: i
}) {
  const {
      m: c
    } = tn(),
    d = gs(),
    h = qe.schedule.list.useQuery(),
    p = qe.useUtils(),
    [g, x] = b.useState(l),
    [y, w] = b.useState(null),
    [E, C] = b.useState(0);
  b.useEffect(() => {
    t && x(l);
  }, [t]);
  const S = qe.students.setSlots.useMutation({
      onSuccess: () => {
        Xe.success(c.studentDetail.classPicker.saved), p.students.get.invalidate({
          id: r
        }), p.students.list.invalidate(), p.schedule.list.invalidate(), p.today.get.invalidate(), p.meta.staff.invalidate(), a(!1);
      },
      onError: A => {
        const B = Ym(A);
        B ? (w(B[0].aId), C(j => j + 1), Xe.error(c.studentDetail.classPicker.selectedOverlap)) : Xe.error(ta(A, c));
      }
    }),
    T = h.data ?? [],
    N = b.useMemo(() => {
      const A = new Map();
      return T.forEach(B => A.set(B.weekday, [...(A.get(B.weekday) ?? []), B])), A;
    }, [T]),
    M = T.filter(A => g.includes(A.id)),
    q = A => M.find(B => B.id !== A.id && B.weekday === A.weekday && B.startMin < A.endMin && A.startMin < B.endMin),
    Q = A => {
      if (g.includes(A.id)) {
        x(j => j.filter(R => R !== A.id));
        return;
      }
      const B = q(A);
      if (B) {
        w(A.id), C(j => j + 1), Xe.error(ue(c.studentDetail.classPicker.existingOverlap, {
          course: d.course(B.courseId)?.name ?? "",
          slot: Qs(B, c)
        }));
        return;
      }
      if (A.studentIds.length >= A.capacity && !l.includes(A.id)) {
        Xe.error(c.studentDetail.classPicker.full);
        return;
      }
      x(j => [...j, A.id]);
    };
  return m.jsx(uo, {
    open: t,
    onOpenChange: a,
    children: m.jsxs(fo, {
      className: "sm:max-w-3xl max-h-[90vh] overflow-y-auto scroll-soft bg-card rounded-[28px] border-2 border-cocoa/10",
      children: [m.jsxs(mo, {
        children: [m.jsx(ho, {
          className: "font-display text-2xl font-normal text-cocoa",
          children: c.studentDetail.classPicker.title
        }), m.jsx(po, {
          className: "font-semibold text-cocoa-soft",
          children: ue(c.studentDetail.classPicker.description, {
            age: i
          })
        })]
      }), m.jsx("div", {
        className: "space-y-3",
        children: [1, 2, 3, 4, 5, 6, 7].map(A => {
          const B = N.get(A) ?? [];
          return B.length ? m.jsxs("div", {
            className: "flex gap-3",
            children: [m.jsx("div", {
              className: "w-10 shrink-0 pt-2 font-display text-cocoa",
              children: c.weekdays[A]
            }), m.jsx("div", {
              className: "flex flex-wrap gap-2",
              children: B.map(j => {
                const R = d.course(j.courseId),
                  X = g.includes(j.id),
                  W = j.studentIds.length >= j.capacity && !l.includes(j.id);
                return m.jsxs("button", {
                  onClick: () => Q(j),
                  className: Ee("crayon-fill rounded-xl border-2 px-3 py-1.5 text-left text-xs font-bold text-cocoa transition", X ? "border-cocoa/60 scale-105 shadow-[2px_3px_0_rgb(74_52_38/0.15)]" : "border-transparent opacity-70 hover:opacity-100", W && !X && "opacity-40", y === j.id && "shake-now"),
                  style: {
                    background: R?.color
                  },
                  children: [m.jsxs("div", {
                    className: "font-extrabold",
                    children: [R?.name, " ", X && "✓"]
                  }), m.jsxs("div", {
                    className: "tabular-nums",
                    children: [ue(c.studentDetail.classPicker.timeRange, {
                      start: jt(j.startMin),
                      end: jt(j.endMin)
                    }), " · ", d.teacher(j.teacherId)?.name]
                  }), m.jsx("div", {
                    className: "opacity-70",
                    children: ue(W ? c.studentDetail.classPicker.capacityFull : c.studentDetail.classPicker.capacity, {
                      count: j.studentIds.length,
                      capacity: j.capacity
                    })
                  })]
                }, `${j.id}-${y === j.id ? E : 0}`);
              })
            })]
          }, A) : null;
        })
      }), m.jsxs("div", {
        className: "flex justify-end gap-2 border-t-2 border-dashed border-cocoa/10 pt-4",
        children: [m.jsx(et, {
          variant: "ghost",
          className: "rounded-full font-bold",
          onClick: () => a(!1),
          children: c.common.cancel
        }), m.jsx(et, {
          className: "rounded-full px-6 font-extrabold",
          disabled: S.isPending,
          onClick: () => S.mutate({
            id: r,
            slotIds: g
          }),
          children: ue(g.length === 1 ? c.studentDetail.classPicker.saveOne : c.studentDetail.classPicker.saveOther, {
            count: g.length
          })
        })]
      })]
    })
  });
}
function mM({
  open: t,
  onOpenChange: a,
  studentId: r
}) {
  const {
      m: l
    } = tn(),
    i = gs(),
    c = qe.useUtils(),
    [d, h] = b.useState(""),
    [p, g] = b.useState(null),
    [x, y] = b.useState(null),
    w = qe.artworks.upload.useMutation({
      onSuccess: () => {
        Xe.success(l.studentDetail.upload.success), c.students.get.invalidate({
          id: r
        }), c.students.list.invalidate(), h(""), y(null), g(null), a(!1);
      },
      onError: C => Xe.error(ta(C, l))
    }),
    E = C => {
      if (!C) return;
      if (!C.type.startsWith("image/")) {
        Xe.error(l.studentDetail.upload.imageFileRequired);
        return;
      }
      if (C.size > 8 * 1024 * 1024) {
        Xe.error(l.studentDetail.upload.imageTooLarge);
        return;
      }
      const S = new FileReader();
      S.onload = () => y(String(S.result)), S.readAsDataURL(C), d || h(C.name.replace(/\.[^.]+$/, "").slice(0, 30));
    };
  return m.jsx(uo, {
    open: t,
    onOpenChange: a,
    children: m.jsxs(fo, {
      className: "sm:max-w-md bg-card rounded-[28px] border-2 border-cocoa/10",
      children: [m.jsxs(mo, {
        children: [m.jsx(ho, {
          className: "font-display text-2xl font-normal text-cocoa",
          children: l.studentDetail.upload.title
        }), m.jsx(po, {
          className: "font-semibold text-cocoa-soft",
          children: l.studentDetail.upload.description
        })]
      }), m.jsxs("label", {
        className: "flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-cocoa/20 bg-paper text-sm font-bold text-cocoa-soft hover:border-caramel",
        children: [x ? m.jsx("img", {
          src: x,
          alt: l.studentDetail.upload.previewAlt,
          className: "h-full w-full object-cover"
        }) : m.jsxs("span", {
          className: "flex flex-col items-center gap-2",
          children: [m.jsx(yb, {
            className: "h-8 w-8"
          }), l.studentDetail.upload.chooseImage]
        }), m.jsx("input", {
          type: "file",
          accept: "image/png,image/jpeg,image/webp",
          className: "hidden",
          onChange: C => E(C.target.files?.[0])
        })]
      }), m.jsxs("div", {
        className: "space-y-1.5",
        children: [m.jsx(It, {
          className: "font-extrabold",
          children: l.studentDetail.upload.artworkName
        }), m.jsx(Pn, {
          className: "rounded-xl",
          value: d,
          onChange: C => h(C.target.value),
          placeholder: l.studentDetail.upload.artworkNamePlaceholder
        })]
      }), m.jsx("div", {
        className: "flex flex-wrap gap-1.5",
        children: i.courses.map(C => m.jsx("button", {
          type: "button",
          onClick: () => g(S => S === C.id ? null : C.id),
          className: Ee("rounded-full border-2 px-2.5 py-1 text-xs font-extrabold text-cocoa", p === C.id ? "border-cocoa/50" : "border-transparent opacity-70"),
          style: {
            background: C.color
          },
          children: C.name
        }, C.id))
      }), m.jsx(et, {
        className: "rounded-full font-extrabold",
        disabled: !x || !d.trim() || w.isPending,
        onClick: () => x && w.mutate({
          studentId: r,
          title: d.trim(),
          courseId: p,
          dataUrl: x
        }),
        children: w.isPending ? l.studentDetail.upload.uploading : l.studentDetail.upload.attach
      })]
    })
  });
}
export { iM, cM, uM, dM, Pf, fM, mM };
export default dM;
