import type { TowerKind } from "./types";

/** 用 Web Audio 合成的简单提示音,不依赖任何外部音频文件。 */
export type SoundName =
  | "shoot"
  | "build"
  | "upgrade"
  | "sell"
  | "kill"
  | "leak"
  | "wave"
  | "clear"
  | "error"
  | "click"
  | "win"
  | "lose";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
const lastPlayed = new Map<string, number>();

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

/** 在用户手势(点击)中调用,以满足浏览器的自动播放策略。 */
export function unlockAudio(): void {
  getCtx();
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

function tone(
  c: AudioContext, freq: number, endFreq: number, dur: number,
  type: OscillatorType, gain: number, delay = 0,
): void {
  if (!master) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const SHOOT: Record<TowerKind, [number, number, OscillatorType, number]> = {
  bottle: [700, 460, "sine", 0.1],
  fan: [320, 210, "triangle", 0.12],
  sunflower: [520, 780, "sine", 0.1],
  moon: [340, 260, "sine", 0.1],
  star: [900, 1350, "triangle", 0.1],
  arrow: [880, 520, "square", 0.08],
  cannon: [180, 90, "sawtooth", 0.16],
  sniper: [1100, 420, "triangle", 0.14],
  tesla: [1400, 400, "square", 0.1],
  poison: [280, 180, "sine", 0.12],
  mortar: [140, 70, "sawtooth", 0.18],
  laser: [1600, 900, "sawtooth", 0.06],
  spike: [200, 140, "square", 0.08],
  goldmine: [523, 784, "triangle", 0.12],
  rocket: [400, 180, "sawtooth", 0.14],
  crossbow: [980, 620, "square", 0.06],
  railgun: [1500, 220, "sawtooth", 0.2],
  flame: [240, 160, "sawtooth", 0.08],
  boomerang: [700, 900, "triangle", 0.1],
  tornado: [300, 500, "sine", 0.1],
  frostpillar: [600, 500, "sine", 0.08],
  minefield: [120, 60, "sawtooth", 0.18],
  prism: [1250, 1600, "triangle", 0.08],
  bank: [600, 900, "triangle", 0.12],
  obelisk: [500, 700, "sine", 0.1],
  shotgun: [200, 100, "sawtooth", 0.15],
  grenade: [100, 60, "sawtooth", 0.2],
  cutter: [1800, 2000, "sawtooth", 0.04],
  magnet: [400, 300, "sine", 0.1],
  medic: [600, 800, "triangle", 0.1],
  siege: [80, 50, "sawtooth", 0.25],
  trap: [150, 80, "square", 0.16],
  sonic: [1000, 600, "square", 0.08],
  chrono: [700, 500, "sine", 0.1],
  nuke: [60, 30, "sawtooth", 0.3],
};

const MIN_GAP: Partial<Record<SoundName, number>> = { shoot: 60, kill: 45, leak: 200 };

export function playSound(name: SoundName, variant?: TowerKind): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const now = performance.now();
  const key = name === "shoot" ? `shoot:${variant}` : name;
  const gap = MIN_GAP[name] ?? 0;
  if (gap > 0 && now - (lastPlayed.get(key) ?? -1e9) < gap) return;
  lastPlayed.set(key, now);

  try {
    switch (name) {
      case "shoot": {
        const [f0, f1, type, dur] = SHOOT[variant ?? "bottle"];
        tone(c, f0, f1, dur, type, 0.09);
        break;
      }
      case "build":
        tone(c, 330, 660, 0.12, "square", 0.1);
        tone(c, 495, 990, 0.14, "triangle", 0.1, 0.07);
        break;
      case "upgrade":
        [523, 659, 784].forEach((f, i) => tone(c, f, f * 1.01, 0.12, "triangle", 0.12, i * 0.07));
        break;
      case "sell":
        tone(c, 784, 392, 0.18, "triangle", 0.12);
        break;
      case "kill":
        tone(c, 600, 980, 0.07, "square", 0.06);
        break;
      case "leak":
        tone(c, 220, 70, 0.32, "sawtooth", 0.14);
        break;
      case "wave":
        tone(c, 392, 392, 0.14, "triangle", 0.14);
        tone(c, 587, 587, 0.2, "triangle", 0.14, 0.14);
        break;
      case "clear":
        tone(c, 660, 880, 0.12, "triangle", 0.12);
        tone(c, 880, 1320, 0.16, "triangle", 0.12, 0.1);
        break;
      case "error":
        tone(c, 170, 120, 0.14, "square", 0.1);
        break;
      case "click":
        tone(c, 520, 480, 0.04, "sine", 0.08);
        break;
      case "win":
        [523, 659, 784, 1047].forEach((f, i) => tone(c, f, f, 0.22, "triangle", 0.14, i * 0.14));
        break;
      case "lose":
        [392, 330, 262, 196].forEach((f, i) => tone(c, f, f * 0.97, 0.28, "sawtooth", 0.1, i * 0.2));
        break;
    }
  } catch {
    /* 音频失败不应影响游戏 */
  }
}
