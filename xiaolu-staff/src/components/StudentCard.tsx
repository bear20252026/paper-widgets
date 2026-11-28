// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as m from 'react/jsx-runtime';
import { Ee, Wn } from '@/compat';
import { $c } from '@/components/HoursBar';
import { ja } from '@/components/KidAvatar';
import { tn, ue } from '@/i18n';
import { ls } from '@/lib/students';
import { aD } from '@/icons';

// 学员卡片。mx 为头像底色轮换数组。

const mx = ["#FFB5C8", "#A9DAF5", "#B5E8C8", "#FFEC99", "#D3C2F5", "#FFCF9E"];
function hM({
  student: t,
  courses: a,
  index: r = 0
}) {
  const {
      m: l
    } = tn(),
    i = ls(t.balance.remaining);
  return m.jsxs(Wn, {
    href: `/students/${t.id}`,
    className: Ee("doodle-card doodle-card-lift relative block p-4 pt-5 float-in", i !== "ok" && "border-alert/45"),
    style: {
      animationDelay: `${Math.min(r, 16) * 30}ms`
    },
    children: [m.jsx("span", {
      className: "washi",
      style: {
        background: mx[t.id % mx.length]
      }
    }), m.jsxs("div", {
      className: "flex items-center gap-3",
      children: [m.jsx(ja, {
        seed: t.avatarSeed,
        gender: t.gender,
        size: 62
      }), m.jsxs("div", {
        className: "min-w-0 flex-1",
        children: [m.jsxs("div", {
          className: "flex items-baseline gap-1.5",
          children: [m.jsx("span", {
            className: "font-display text-xl text-cocoa truncate",
            children: t.name
          }), t.nickname && m.jsxs("span", {
            className: "text-xs font-bold text-cocoa-soft",
            children: ["“", t.nickname, "”"]
          })]
        }), m.jsx("div", {
          className: "text-xs font-bold text-cocoa-soft",
          children: ue(l.studentCard.ageGender, {
            age: t.age,
            gender: t.gender === "girl" ? l.studentCard.genderGirl : l.studentCard.genderBoy
          })
        }), m.jsxs("div", {
          className: "mt-1.5 flex flex-wrap gap-1",
          children: [a.map(c => m.jsx("span", {
            className: "rounded-full px-2 py-0.5 text-[10px] font-extrabold text-cocoa",
            style: {
              background: c.color
            },
            children: c.name
          }, c.id)), a.length === 0 && m.jsx("span", {
            className: "text-[10px] font-bold text-cocoa-soft",
            children: l.studentCard.noClasses
          })]
        })]
      })]
    }), m.jsxs("div", {
      className: "mt-3",
      children: [m.jsx("div", {
        className: "mb-1.5 text-[11px] font-extrabold text-cocoa-soft",
        children: l.studentCard.recentWorks
      }), m.jsx("div", {
        className: "grid grid-cols-3 gap-1.5",
        children: [0, 1, 2].map(c => {
          const d = t.recentWorks[c];
          return d ? m.jsx("div", {
            className: "aspect-[4/3] overflow-hidden rounded-lg border-2 border-card bg-muted shadow-[1px_2px_0_rgb(74_52_38/0.1)]",
            style: {
              transform: `rotate(${(c - 1) * 2}deg)`
            },
            children: m.jsx("img", {
              src: d.imageUrl,
              alt: d.title,
              title: d.title,
              loading: "lazy",
              className: "h-full w-full object-cover"
            })
          }, d.id) : m.jsx("div", {
            className: "aspect-[4/3] flex items-center justify-center rounded-lg border-2 border-dashed border-cocoa/10 text-cocoa/25",
            children: m.jsx(aD, {
              className: "h-4 w-4"
            })
          }, `empty-${c}`);
        })
      })]
    }), m.jsx($c, {
      remaining: t.balance.remaining,
      compact: !0,
      className: "mt-3"
    })]
  });
}
export { mx, hM };
