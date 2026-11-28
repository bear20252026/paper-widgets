import { MAX_EFFECTS, MAX_EVENTS } from "./constants";
import type { Effect, GameEvent, GameState } from "./types";

/** 向事件队列追加事件(由表现层 / 音频消费)。 */
export function pushEvent(state: GameState, ev: GameEvent): void {
  state.events.push(ev);
  if (state.events.length > MAX_EVENTS) {
    state.events.splice(0, state.events.length - MAX_EVENTS);
  }
}

export type EffectInit = Omit<Effect, "id" | "maxTtl" | "x2" | "y2" | "radius"> &
  Partial<Pick<Effect, "x2" | "y2" | "radius">>;

/** 添加纯视觉效果(射线、冲击环、飘字),不影响逻辑。 */
export function addEffect(state: GameState, init: EffectInit): void {
  state.effects.push({
    x2: 0,
    y2: 0,
    radius: 0,
    ...init,
    id: state.nextId++,
    maxTtl: init.ttl,
  });
  if (state.effects.length > MAX_EFFECTS) {
    state.effects.splice(0, state.effects.length - MAX_EFFECTS);
  }
}

export function updateEffects(state: GameState, dt: number): void {
  let write = 0;
  for (const e of state.effects) {
    e.ttl -= dt;
    if (e.ttl > 0) state.effects[write++] = e;
  }
  state.effects.length = write;
}
