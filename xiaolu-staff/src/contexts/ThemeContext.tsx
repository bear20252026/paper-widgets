// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as b from 'react';
import * as m from 'react/jsx-runtime';

// 主题上下文（默认 light）。

const YD = b.createContext(void 0);
function XD({
  children: t,
  defaultTheme: a = "light",
  switchable: r = !1
}) {
  const [l, i] = b.useState(() => r && localStorage.getItem("theme") || a);
  b.useEffect(() => {
    const d = document.documentElement;
    l === "dark" ? d.classList.add("dark") : d.classList.remove("dark"), r && localStorage.setItem("theme", l);
  }, [l, r]);
  const c = r ? () => {
    i(d => d === "light" ? "dark" : "light");
  } : void 0;
  return m.jsx(YD.Provider, {
    value: {
      theme: l,
      toggleTheme: c,
      switchable: r
    },
    children: t
  });
}
export { YD, XD };
