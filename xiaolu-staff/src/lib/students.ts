// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import { zb } from '@/lib/constants';

// ls(balanceStatus)：剩余课时 → empty/low/ok。

function ls(t) {
  return t <= 0 ? "empty" : t <= zb ? "low" : "ok";
}
export { ls };
