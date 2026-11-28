// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as m from 'react/jsx-runtime';
import { Gc, QN, et, qN } from '@/compat';
import { tn } from '@/i18n';
import { ZN, nD } from '@/icons';

// 404 页。

function Xv() {
  const [, t] = Gc(),
    {
      m: a
    } = tn(),
    r = () => {
      t("/");
    };
  return m.jsx("div", {
    className: "min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100",
    children: m.jsx(qN, {
      className: "w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm",
      children: m.jsxs(QN, {
        className: "pt-8 pb-8 text-center",
        children: [m.jsx("div", {
          className: "flex justify-center mb-6",
          children: m.jsxs("div", {
            className: "relative",
            children: [m.jsx("div", {
              className: "absolute inset-0 bg-red-100 rounded-full animate-pulse"
            }), m.jsx(ZN, {
              className: "relative h-16 w-16 text-red-500"
            })]
          })
        }), m.jsx("h1", {
          className: "text-4xl font-bold text-slate-900 mb-2",
          children: "404"
        }), m.jsx("h2", {
          className: "text-xl font-semibold text-slate-700 mb-4",
          children: a.notFound.title
        }), m.jsxs("p", {
          className: "text-slate-600 mb-8 leading-relaxed",
          children: [a.notFound.body, m.jsx("br", {}), a.notFound.hint]
        }), m.jsx("div", {
          id: "not-found-button-group",
          className: "flex flex-col sm:flex-row gap-3 justify-center",
          children: m.jsxs(et, {
            onClick: r,
            className: "bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg",
            children: [m.jsx(nD, {
              className: "w-4 h-4 mr-2"
            }), a.notFound.home]
          })
        })]
      })
    })
  });
}
export { Xv };
export default Xv;
