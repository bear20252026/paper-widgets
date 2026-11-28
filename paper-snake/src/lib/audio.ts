import type { GameEvent } from "../game/types";

const EAT_SCALE_HZ = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];
const BGM_NOTES_HZ = [261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 349.23];

/**
 * Commercial-feel procedural WebAudio soundscape — zero external MP3s.
 * Independent master / SFX / BGM volume; never throws under autoplay limits.
 */
class GameAudio {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private bgmEnabled = false;
  private master = 0.8;
  private sfx = 0.9;
  private bgm = 0.45;
  private lastEatAt = 0;
  private eatChain = 0;
  private feastChain = 0;
  private bgmTimer: number | null = null;
  private bgmStep = 0;

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) this.stopBgmLoop();
    else if (this.bgmEnabled) this.startBgmLoop();
  }

  setBgmEnabled(value: boolean): void {
    this.bgmEnabled = value;
    if (value && this.enabled) this.startBgmLoop();
    else this.stopBgmLoop();
  }

  setVolumes(master: number, sfx: number, bgm: number): void {
    this.master = Math.max(0, Math.min(1, master));
    this.sfx = Math.max(0, Math.min(1, sfx));
    this.bgm = Math.max(0, Math.min(1, bgm));
    if (!this.bgm || !this.master) this.stopBgmLoop();
    else if (this.bgmEnabled && this.enabled) this.startBgmLoop();
  }

  private context(): AudioContext | null {
    if (!this.enabled || typeof window === "undefined") return null;
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
      return this.ctx;
    }
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private startBgmLoop(): void {
    if (typeof window === "undefined" || this.bgmTimer !== null) return;
    this.bgmTimer = window.setInterval(() => {
      if (!this.enabled || !this.bgmEnabled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      const ctx = this.ctx;
      if (!ctx || ctx.state !== "running") return;
      const note = BGM_NOTES_HZ[this.bgmStep++ % BGM_NOTES_HZ.length];
      this.tone(note, 0.34, "sine", 0.028, 0, undefined, "bgm");
      if (this.bgmStep % 4 === 1) {
        this.tone(note * 0.5, 0.46, "triangle", 0.022, 0, undefined, "bgm");
      }
    }, 430);
  }

  private stopBgmLoop(): void {
    if (this.bgmTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
    endFreq?: number,
    channel: "sfx" | "bgm" = "sfx"
  ): void {
    const ctx = this.context();
    if (!ctx) return;
    const channelGain = channel === "bgm" ? this.bgm : this.sfx;
    const finalGain = gain * channelGain * this.master;
    if (finalGain <= 0.00001) return;
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      const t0 = ctx.currentTime + delay;
      osc.frequency.setValueAtTime(freq, t0);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(finalGain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.03);
    } catch {
      // Audio failure must never interrupt gameplay.
    }
  }

  /** Ascending pentatonic marimba chimes when vacuuming orbs in a row. */
  /**
   * Chimes climb while a feast is being vacuumed up: each orb within the combo
   * window adds a step (pentatonic scale) and big/corpse orbs add a semitone
   * lift, so a long corpse ribbon ends on a bright, rising pitch.
   */
  eat(tier: "small" | "large" | "corpse"): void {
    const now = performance.now();
    if (now - this.lastEatAt < 38) return;
    const gap = now - this.lastEatAt;
    if (gap < 2200) {
      this.eatChain = Math.min(EAT_SCALE_HZ.length - 1, this.eatChain + 1);
      this.feastChain = Math.min(12, this.feastChain + (tier === "corpse" ? 2 : tier === "large" ? 1 : 0.4));
    } else {
      this.eatChain = 0;
      this.feastChain = 0;
    }
    this.lastEatAt = now;
    const base = EAT_SCALE_HZ[this.eatChain];
    const pitchLift = Math.pow(2, this.feastChain / 12);
    const mult = (tier === "corpse" ? 1.12 : tier === "large" ? 1.05 : 1) * pitchLift;
    this.tone(base * mult, 0.085, "sine", tier === "small" ? 0.085 : 0.13);
    if (tier !== "small") {
      this.tone(base * mult * 1.5, 0.075, "triangle", 0.06, 0.025);
      this.tone(base * mult * 2, 0.09, "sine", 0.045, 0.05);
    }
    // a shimmering flourish every 8 steps of a big feast
    if (tier === "corpse" && this.feastChain >= 6) {
      this.tone(base * mult * 2.5, 0.12, "sine", 0.03, 0.06);
    }
  }

  boost(): void {
    this.tone(240, 0.11, "sine", 0.05, 0, 420);
  }

  kill(streak = 1, wasKing = false): void {
    if (wasKing || streak >= 3) {
      [523.25, 659.25, 783.99, 1046.5].forEach((n, i) =>
        this.tone(n, 0.14, "triangle", 0.11, i * 0.055)
      );
      return;
    }
    if (streak === 2) {
      this.tone(587.33, 0.1, "triangle", 0.1, 0);
      this.tone(783.99, 0.12, "triangle", 0.11, 0.055);
      this.tone(987.77, 0.15, "sine", 0.1, 0.11);
      return;
    }
    this.tone(523.25, 0.09, "triangle", 0.09, 0);
    this.tone(783.99, 0.13, "sine", 0.1, 0.055);
  }

  fanfare(): void {
    [587.33, 739.99, 880.0, 1174.66].forEach((n, i) =>
      this.tone(n, 0.15, "sine", 0.09, i * 0.06)
    );
  }

  reward(): void {
    this.tone(987.77, 0.08, "sine", 0.1, 0);
    this.tone(1318.51, 0.16, "sine", 0.11, 0.065);
  }

  gift(): void {
    [659.25, 880, 1046.5, 1318.51].forEach((n, i) =>
      this.tone(n, 0.11, "triangle", 0.07, i * 0.045)
    );
  }

  achievement(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((n, i) =>
      this.tone(n, 0.16, "sine", 0.08, i * 0.07)
    );
  }

  countdown(step: number): void {
    if (step <= 0) {
      this.tone(523.25, 0.16, "triangle", 0.1, 0);
      this.tone(783.99, 0.22, "triangle", 0.1, 0.02);
      this.tone(1046.5, 0.28, "sine", 0.09, 0.04);
      return;
    }
    const freq = step === 3 ? 392 : step === 2 ? 493.88 : 587.33;
    this.tone(freq, 0.12, "sine", 0.09);
  }

  death(): void {
    this.tone(310, 0.16, "triangle", 0.11, 0, 210);
    this.tone(210, 0.24, "sine", 0.09, 0.11, 130);
  }

  ui(): void {
    const ctx = this.context();
    if (ctx && this.bgmEnabled && this.bgmTimer === null) this.startBgmLoop();
    this.tone(620, 0.045, "sine", 0.05);
  }

  power(kind: string): void {
    const base = kind === "magnet" ? 440 : kind === "shield" ? 392 : kind === "turbo" ? 523.25 : 587.33;
    this.tone(base, 0.08, "square", 0.05, 0);
    this.tone(base * 1.5, 0.1, "triangle", 0.08, 0.05);
    this.tone(base * 2, 0.16, "sine", 0.08, 0.1);
  }

  block(): void {
    this.tone(880, 0.05, "square", 0.04, 0, 660);
  }

  revive(): void {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((n, i) => this.tone(n, 0.12, "sine", 0.08, i * 0.05));
  }

  handleEvent(event: GameEvent): void {
    if (event.type === "power" && event.player) return this.power(event.kind);
    if (event.type === "shieldBlock") return this.block();
    if (event.type === "revive") return this.revive();
    if (event.type === "record") return this.achievement();
    if (event.type === "eat" && event.player) this.eat(event.tier);
    else if (event.type === "boostStart" && event.player) this.boost();
    else if (event.type === "kill" && event.player) this.kill(event.streak, event.wasKing);
    else if (event.type === "king" && event.player) this.fanfare();
    else if (event.type === "milestone") this.reward();
    else if (event.type === "death" && event.player) this.death();
  }
}

export const audio = new GameAudio();
