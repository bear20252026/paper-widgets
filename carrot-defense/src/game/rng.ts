/** 可复现的伪随机数(mulberry32)。状态存放在 GameState.rngState 中,保证测试确定性。 */
export function nextRandom(holder: { rngState: number }): number {
  const s = (holder.rngState + 0x6d2b79f5) | 0;
  holder.rngState = s;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
