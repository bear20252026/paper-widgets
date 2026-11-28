import { describe, expect, it } from "vitest";
import { DIFFICULTY, GameEngine } from "../engine";
import { POWER_INFO, collectPowerUps, powerActive, spawnPowerUp } from "../powerups";
import { createGameState, eatOrbs, createOrb, pullNearbyOrbs } from "../world";
import { createSnake } from "../snake";
import { createRng } from "../rng";
import type { GameEvent } from "../types";

function arena() {
  const state = createGameState({ seed: 1, mode: "endless" });
  const snake = createSnake({ id: 1, name: "p", x: 1000, y: 1000, angle: 0, skin: "mint", isPlayer: true, length: 80 });
  state.snakes.push(snake);
  return { state, snake };
}

describe("power-ups", () => {
  it("spawns spaced pick-ups and applies the effect on contact", () => {
    const { state, snake } = arena();
    const rng = createRng(4);
    for (let i = 0; i < 6; i++) spawnPowerUp(state, rng);
    expect(state.powerUps).toHaveLength(6);
    state.powerUps.push({ id: 999, x: snake.x + 5, y: snake.y, kind: "shield", phase: 0 });
    const got = collectPowerUps(state, snake);
    expect(got.map((g) => g.kind)).toEqual(["shield"]);
    expect(powerActive(snake, "shield", state.timeMs)).toBe(true);
    expect(snake.powers.shield).toBe(POWER_INFO.shield.durationMs);
    expect(state.powerUps.find((p) => p.id === 999)).toBeUndefined();
  });

  it("re-collecting extends rather than resets, with a cap", () => {
    const { state, snake } = arena();
    for (let i = 0; i < 4; i++) {
      state.powerUps.push({ id: 100 + i, x: snake.x, y: snake.y, kind: "magnet", phase: 0 });
      collectPowerUps(state, snake);
    }
    expect(snake.powers.magnet).toBe(POWER_INFO.magnet.durationMs * 1.6);
  });

  it("double makes every orb worth twice as much", () => {
    const { state, snake } = arena();
    state.orbs.push(createOrb({ x: snake.x, y: snake.y, tier: "large", id: 1 }));
    expect(eatOrbs(state, snake).gained).toBe(6);
    snake.powers.double = 5000;
    state.orbs.push(createOrb({ x: snake.x, y: snake.y, tier: "large", id: 2 }));
    expect(eatOrbs(state, snake).gained).toBe(12);
  });

  it("magnet pulls orbs from much further away", () => {
    const { state, snake } = arena();
    const far = createOrb({ x: snake.x + 180, y: snake.y, tier: "small", id: 1 });
    state.orbs.push(far);
    pullNearbyOrbs(state, 16);
    expect(far.x).toBe(snake.x + 180);
    snake.powers.magnet = 5000;
    pullNearbyOrbs(state, 16);
    expect(far.x).toBeLessThan(snake.x + 180);
  });

  it("shield lets a snake pass through other bodies; walls still apply", () => {
    const engine = new GameEngine({ seed: 3, mode: "endless", botCount: 3, powerUps: false });
    const p = engine.player;
    const bot = engine.state.snakes.find((s) => !s.isPlayer)!;
    p.spawnGrace = 0;
    p.powers.shield = 60_000;
    // drop the player's head right onto a rival body segment
    const seg = bot.points[Math.floor(bot.points.length / 2)];
    p.x = seg.x; p.y = seg.y;
    bot.spawnGrace = 0;
    engine.step(16.67);
    expect(p.alive).toBe(true);
  });

  it("turbo makes boosting free and allowed below 30 m", () => {
    const engine = new GameEngine({ seed: 5, mode: "endless", botCount: 3, powerUps: false });
    const p = engine.player;
    p.length = 25;
    expect(engine.canPlayerBoost()).toBe(false);
    p.powers.turbo = 60_000;
    expect(engine.canPlayerBoost()).toBe(true);
    engine.setBoost(true);
    const before = p.length;
    for (let i = 0; i < 30; i++) engine.step(16.67);
    expect(p.boosting).toBe(true);
    expect(p.length).toBeGreaterThanOrEqual(before);
  });

  it("the arena is seeded with pick-ups and keeps topping them up", () => {
    const engine = new GameEngine({ seed: 8, mode: "endless", botCount: 3 });
    expect(engine.state.powerUps.length).toBe(6);
    engine.state.powerUps = [];
    for (let i = 0; i < 300; i++) engine.step(16.67);
    expect(engine.state.powerUps.length).toBeGreaterThan(0);
  });
});

function killPlayer(engine: GameEngine) {
  const p = engine.player;
  const bot = engine.state.snakes.find((s) => !s.isPlayer && s.alive)!;
  p.spawnGrace = 0;
  bot.spawnGrace = 0;
  const seg = bot.points[Math.floor(bot.points.length / 2)];
  p.x = seg.x; p.y = seg.y;
  engine.step(16.67);
}

describe("revive", () => {
  it("pauses on death, keeps the world running, then revives once with half length", () => {
    const events: GameEvent[] = [];
    let ended = 0;
    const engine = new GameEngine({ seed: 11, mode: "endless", botCount: 4, allowRevive: true, powerUps: false, onEvent: (e) => events.push(e), onEnd: () => ended++ });
    engine.player.length = 300;
    killPlayer(engine);
    expect(engine.player.alive).toBe(false);
    expect(engine.isAwaitingRevive).toBe(true);
    expect(events.some((e) => e.type === "playerDown")).toBe(true);
    expect(ended).toBe(0);
    const t0 = engine.state.timeMs;
    for (let i = 0; i < 8; i++) engine.step(16.67); // past the death hit-stop
    expect(engine.state.timeMs).toBeGreaterThan(t0);
    expect(engine.emitHud().awaitingRevive).toBe(true);

    expect(engine.revive()).toBe(true);
    const p = engine.player;
    expect(p.alive).toBe(true);
    expect(p.length).toBeGreaterThanOrEqual(140);
    expect(powerActive(p, "shield", engine.state.timeMs)).toBe(true);
    expect(engine.revive()).toBe(false);

    // a second death ends the run for real
    p.powers.shield = 0;
    killPlayer(engine);
    expect(ended).toBe(1);
  });

  it("giving up finishes the run with the original death", () => {
    let result: { revived?: boolean; deathReason: string | null } | null = null;
    const engine = new GameEngine({ seed: 12, mode: "endless", botCount: 4, allowRevive: true, powerUps: false, onEnd: (r) => (result = r) });
    killPlayer(engine);
    engine.giveUp();
    expect(result).not.toBeNull();
    expect(result!.revived).toBe(false);
    expect(result!.deathReason).toBe("body");
  });

  it("without allowRevive a death ends the run immediately (legacy behaviour)", () => {
    let ended = 0;
    const engine = new GameEngine({ seed: 13, mode: "endless", botCount: 4, powerUps: false, onEnd: () => ended++ });
    killPlayer(engine);
    expect(ended).toBe(1);
    expect(engine.isAwaitingRevive).toBe(false);
  });
});

describe("difficulty", () => {
  it("sets bot population and scales coin rewards", () => {
    const easy = new GameEngine({ seed: 21, difficulty: "easy" });
    const hard = new GameEngine({ seed: 21, difficulty: "hard" });
    expect(easy.state.snakes.filter((s) => !s.isPlayer)).toHaveLength(DIFFICULTY.easy.bots);
    expect(hard.state.snakes.filter((s) => !s.isPlayer)).toHaveLength(DIFFICULTY.hard.bots);
    let r: { coins: number; coinBreakdown: { total: number; difficultyBonus?: number } } | null = null;
    const engine = new GameEngine({ seed: 22, difficulty: "hard", botCount: 4, powerUps: false, onEnd: (x) => (r = x) });
    engine.player.length = 200;
    killPlayer(engine);
    expect(r!.coinBreakdown.difficultyBonus).toBeGreaterThan(0);
    expect(r!.coins).toBe(r!.coinBreakdown.total);
  });
});
