// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import { ue } from '@/i18n';
import { jt } from '@/lib/date';

// 课程时段工具：文案、时段重叠、冲突类型（老师/教室/学员）、全量冲突扫描。

function Qs(t, a) {
  return ue(a.common.slotTime, {
    day: a.weekdays[t.weekday],
    start: jt(t.startMin),
    end: jt(t.endMin)
  });
}
function $R(t, a) {
  return t.weekday === a.weekday && t.startMin < a.endMin && a.startMin < t.endMin;
}
function I1(t, a) {
  if (t.id === a.id || !$R(t, a)) return null;
  const r = [];
  t.teacherId === a.teacherId && r.push("teacher"), t.roomId === a.roomId && r.push("room");
  const l = new Set(a.studentIds),
    i = t.studentIds.filter(c => l.has(c));
  return i.length > 0 && r.push("student"), r.length === 0 ? null : {
    aId: t.id,
    bId: a.id,
    kinds: r,
    sharedStudentIds: i
  };
}
function WR(t) {
  const a = [];
  for (let r = 0; r < t.length; r++) for (let l = r + 1; l < t.length; l++) {
    const i = I1(t[r], t[l]);
    i && a.push(i);
  }
  return a;
}
function F1(t, a) {
  return a.filter(r => r.id !== t.id).map(r => I1(t, r)).filter(r => r !== null);
}
export { Qs, $R, I1, WR, F1 };
