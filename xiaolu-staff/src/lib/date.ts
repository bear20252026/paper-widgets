// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck


// 日期/时间工具：HH:MM 互转、本地日期串、周一起点、按周取整周。

function Zv(t) {
  return t === "leave" ? 0 : 1;
}
function jt(t) {
  const a = Math.floor(t / 60),
    r = t % 60;
  return `${String(a).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function $v(t) {
  const [a, r] = t.split(":").map(Number);
  return a * 60 + (r || 0);
}
function qs(t) {
  const a = t.getFullYear(),
    r = String(t.getMonth() + 1).padStart(2, "0"),
    l = String(t.getDate()).padStart(2, "0");
  return `${a}-${r}-${l}`;
}
function Pb(t) {
  const [a, r, l] = t.split("-").map(Number);
  return new Date(a, r - 1, l);
}
function Lb(t) {
  const a = t.getDay();
  return a === 0 ? 7 : a;
}
function Wv(t) {
  const a = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return a.setDate(a.getDate() - (Lb(a) - 1)), a;
}
function pl(t, a) {
  const r = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return r.setDate(r.getDate() + a), r;
}
export { Zv, jt, $v, qs, Pb, Lb, Wv, pl };
