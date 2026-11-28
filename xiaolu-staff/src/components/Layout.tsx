// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as m from 'react/jsx-runtime';
import { Ee, Gc, Wn } from '@/compat';
import { tn, ue } from '@/i18n';
import { ZD, _b, no, zb } from '@/lib/constants';
import { Ml, Ub } from '@/lib/format';
import { $D, WD } from '@/lib/nav';

// 侧边栏 + 移动端底栏 + 页面头部组件 Hm(PageHeader)。$D 导航项定义在 lib/nav.ts。

function Is({
  children: t
}) {
  const [a] = Gc(),
    {
      m: r
    } = tn();
  return m.jsxs("div", {
    className: "min-h-screen lg:flex",
    children: [m.jsx("aside", {
      className: "lg:sticky lg:top-0 lg:h-screen lg:w-60 shrink-0 border-b-2 lg:border-b-0 lg:border-r-2 border-dashed border-cocoa/10 bg-sidebar/70 backdrop-blur",
      children: m.jsxs("div", {
        className: "flex lg:flex-col h-full gap-3 px-4 py-3 lg:px-5 lg:py-7",
        children: [m.jsxs(Wn, {
          href: "/",
          className: "flex items-center gap-2.5 lg:mb-8 shrink-0",
          children: [m.jsx("img", {
            src: no.logo,
            alt: r.brand.logoAlt,
            className: "h-11 w-11 lg:h-14 lg:w-14 rounded-full object-cover border-2 border-cocoa/10 bg-paper wiggle"
          }), m.jsxs("div", {
            className: "leading-tight",
            children: [m.jsx("div", {
              className: "font-display text-xl lg:text-2xl text-cocoa",
              children: m.jsxs("span", {
                className: "relative",
                children: [r.brand.name, m.jsx("span", {
                  className: "absolute -right-1.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-blush"
                })]
              })
            }), m.jsx("div", {
              className: "hidden lg:block text-[11px] font-bold text-cocoa-soft tracking-widest",
              children: r.brand.tagline
            })]
          })]
        }), m.jsx("nav", {
          "aria-label": r.nav.label,
          className: "flex lg:flex-col gap-1.5 lg:gap-3 overflow-x-auto scroll-soft flex-1",
          children: $D.map(l => {
            const i = WD(a, l.href),
              c = l.icon;
            return m.jsxs(Wn, {
              href: l.href,
              className: Ee("group relative flex items-center gap-2.5 whitespace-nowrap rounded-full py-2 pl-2 pr-4 text-sm font-extrabold transition-all", i ? "text-cocoa translate-x-0 lg:translate-x-2" : "text-cocoa-soft hover:text-cocoa hover:lg:translate-x-1"),
              style: {
                background: i ? l.color : "transparent"
              },
              children: [m.jsx("span", {
                className: "crayon-fill flex h-8 w-8 items-center justify-center rounded-full border-2 border-cocoa/10",
                style: {
                  background: l.color
                },
                children: m.jsx(c, {
                  className: "h-4 w-4 text-cocoa",
                  strokeWidth: 2.5
                })
              }), r.nav[l.label], i && m.jsx("span", {
                className: "hidden lg:block absolute -right-3 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[14px] border-l-[12px] border-y-transparent",
                style: {
                  borderLeftColor: l.color
                }
              })]
            }, l.href);
          })
        }), m.jsxs("div", {
          className: "hidden lg:block doodle-card p-4 text-xs text-cocoa-soft leading-relaxed",
          children: [m.jsx("div", {
            className: "font-display text-base text-cocoa mb-1",
            children: r.packageCard.title
          }), ue(r.packageCard.price, {
            hours: _b,
            price: Ub(ZD)
          }), m.jsx("br", {}), Ml(r.packageCard.rule, {
            threshold: zb,
            orange: m.jsx("span", {
              className: "font-black text-alert",
              children: r.packageCard.orange
            })
          })]
        })]
      })
    }), m.jsx("main", {
      className: "flex-1 min-w-0",
      children: t
    })]
  });
}
function Hm({
  title: t,
  subtitle: a,
  image: r,
  children: l
}) {
  return m.jsxs("header", {
    className: "relative overflow-hidden doodle-card float-in mb-6",
    children: [r && m.jsx("img", {
      src: r,
      alt: "",
      className: "absolute inset-0 h-full w-full object-cover object-right opacity-95"
    }), m.jsx("div", {
      className: "absolute inset-0 bg-gradient-to-r from-[#fffdf8] via-[#fffdf8]/85 to-transparent"
    }), m.jsxs("div", {
      className: "relative px-6 py-7 md:px-9 md:py-9 max-w-xl",
      children: [m.jsx("h1", {
        className: "text-3xl md:text-4xl text-cocoa",
        children: t
      }), a && m.jsx("p", {
        className: "mt-2 text-sm md:text-base font-semibold text-cocoa-soft",
        children: a
      }), l && m.jsx("div", {
        className: "mt-4 flex flex-wrap gap-2",
        children: l
      })]
    })]
  });
}
export { Is, Hm };
