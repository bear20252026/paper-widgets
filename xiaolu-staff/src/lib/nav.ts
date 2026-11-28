// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import { VN, cD, rD, wb } from '@/icons';

// 主导航配置 $D 与激活判断 WD。

const $D = [{
  href: "/",
  label: "today",
  icon: cD,
  color: "#FFCF9E"
}, {
  href: "/schedule",
  label: "schedule",
  icon: VN,
  color: "#A9DAF5"
}, {
  href: "/students",
  label: "students",
  icon: wb,
  color: "#FFB5C8"
}, {
  href: "/staff",
  label: "staff",
  icon: rD,
  color: "#B5E8C8"
}];
function WD(t, a) {
  return a === "/" ? t === "/" : t.startsWith(a);
}
export { $D, WD };
