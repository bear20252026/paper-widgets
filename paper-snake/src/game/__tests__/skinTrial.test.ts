import { describe, expect, it } from "vitest";
import { SkinTrial, TRIAL_DURATION_MS, TRIAL_STEP_MS } from "../skinTrial";
import { CURIOUS_SKINS, FEATURED_SKINS, FREE_SKINS, SKINS } from "../skins";
import { BOOST_DRAIN_PER_SEC } from "../boost";

describe("curious objects collection", () => {
  it("adds four different structures and a free garden without changing existing skin ids", () => {
    expect(CURIOUS_SKINS).toHaveLength(4);
    expect(new Set(CURIOUS_SKINS.map((s) => s.form)).size).toBe(4);
    expect(FREE_SKINS).toContain("garden");
    expect(FREE_SKINS).toContain("koi");
    expect(FEATURED_SKINS).toHaveLength(8);
    expect(SKINS).toHaveLength(24);
  });
});

describe("isolated skin trial", () => {
  it("accepts locked skin ids without an economy or reward path", () => {
    const trial = new SkinTrial("clockwork");
    expect(trial.snake.skin).toBe("clockwork");
    expect(trial.state.snakes).toHaveLength(1);
    expect("coins" in trial).toBe(false);
    expect("onEnd" in trial).toBe(false);
    expect(trial.timeLeftMs).toBe(TRIAL_DURATION_MS);
  });

  it("uses real boost accounting and the strict 30m floor", () => {
    const trial = new SkinTrial("zip");
    trial.state.orbs = [];
    trial.setBoost(true);
    trial.update(TRIAL_STEP_MS);
    expect(trial.snake.length).toBeCloseTo(90 - BOOST_DRAIN_PER_SEC / 60, 6);
    trial.snake.length = 30;
    trial.setBoost(true);
    trial.update(TRIAL_STEP_MS);
    expect(trial.snake.boosting).toBe(false);
    expect(trial.snake.length).toBe(30);
    trial.snake.length = 30.4;
    trial.setBoost(true);
    trial.update(TRIAL_STEP_MS);
    expect(trial.snake.boosting).toBe(true);
    expect(trial.snake.length).toBeGreaterThan(30);
  });

  it("starts in cruise mode and accepts mouse/touch steering without invalid coordinates", () => {
    const trial = new SkinTrial("orbit");
    expect(trial.automatic).toBe(true);
    trial.setAim(NaN, Infinity);
    expect(trial.automatic).toBe(true);
    trial.setAim(350, 100);
    expect(trial.automatic).toBe(false);
    const start = { x: trial.snake.x, y: trial.snake.y };
    for (let i = 0; i < 90; i++) trial.update(TRIAL_STEP_MS);
    expect(Math.hypot(trial.snake.x - start.x, trial.snake.y - start.y)).toBeGreaterThan(30);
    trial.releaseAim();
    expect(trial.automatic).toBe(true);
    expect(trial.snake.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  it("is reproducible and skin-independent at equal seeds and inputs", () => {
    const a = new SkinTrial("garden", 90);
    const b = new SkinTrial("zip", 90);
    expect(a.state.orbs).toEqual(b.state.orbs);
    for (let i = 0; i < 240; i++) {
      a.update(TRIAL_STEP_MS); b.update(TRIAL_STEP_MS);
    }
    expect(a.snake.points).toEqual(b.snake.points);
    expect(a.snake.length).toBe(b.snake.length);
  });

  it("stops at 20 seconds without generating a result or advancing after finishing", () => {
    const trial = new SkinTrial("garden");
    for (let i = 0; i < 1201; i++) trial.update(TRIAL_STEP_MS);
    expect(trial.finished).toBe(true);
    expect(trial.state.status).toBe("ended");
    expect(trial.timeLeftMs).toBe(0);
    expect(trial.state.timeMs).toBe(TRIAL_DURATION_MS);
    const atEnd = JSON.stringify(trial.state);
    for (let i = 0; i < 30; i++) trial.update(TRIAL_STEP_MS);
    expect(JSON.stringify(trial.state)).toBe(atEnd);
  });

  it("remains within its practice field for extended control toward every corner", () => {
    for (const skin of CURIOUS_SKINS) {
      const trial = new SkinTrial(skin.id);
      for (let i = 0; i < 1201; i++) {
        if (i % 200 === 0) trial.setAim(i % 400 === 0 ? 0 : 640, i % 600 === 0 ? 0 : 480);
        trial.setBoost(i % 120 < 50); trial.update(TRIAL_STEP_MS);
        expect(trial.snake.x).toBeGreaterThan(0);
        expect(trial.snake.x).toBeLessThan(640);
        expect(trial.snake.y).toBeGreaterThan(0);
        expect(trial.snake.y).toBeLessThan(480);
        expect(trial.snake.length).toBeGreaterThanOrEqual(30);
      }
    }
  });
});