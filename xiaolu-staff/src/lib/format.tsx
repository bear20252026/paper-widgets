// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as b from 'react';
import * as m from 'react/jsx-runtime';

// Ml：把带 {placeholder} 的文案渲染成 React 片段；Ub：金额格式化。

function Ml(t, a) {
  return t.split(/\{(\w+)\}/g).map((l, i) => i % 2 === 1 ? m.jsx(b.Fragment, {
    children: l in a ? a[l] : `{${l}}`
  }, i) : l || null);
}
function Ub(t) {
  return `$${(t / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0
  })}`;
}
export { Ml, Ub };
