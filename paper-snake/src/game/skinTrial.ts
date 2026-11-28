import type { GameState, SkinId, Snake, Vec2 } from "./types";
import { createRng, type Rng } from "./rng";
import { canBoost, tickBoost } from "./boost";
import { createSnake, growSnake, moveSnake } from "./snake";
import { currentSpeed, segmentSpacing } from "./speed";
import { createGameState, createOrb, dropBoostOrbs, eatOrbs, pullNearbyOrbs, updateOrbs } from "./world";

export const TRIAL_DURATION_MS = 20_000;
export const TRIAL_STEP_MS = 1000 / 60;

/** Isolated practice world: no store, economy, rankings, rewards or main-match events. */
export class SkinTrial {
  readonly state: GameState;
  readonly snake: Snake;
  private rng: Rng;
  private aim: Vec2 | null = null;
  private refillMs = 0;
  eaten = 0;

  constructor(skin: SkinId, seed = 73) {
    this.rng = createRng(seed);
    this.state = createGameState({ seed, mode: "endless", width: 640, height: 480 });
    this.snake = createSnake({ id: 1, name: "试游", x: 446, y: 240, angle: Math.PI / 2, skin, isPlayer: true, length: 90 });
    const spacing = segmentSpacing(this.snake.radius);
    this.snake.points.forEach((point, i) => {
      const a = -i * spacing / 126;
      point.x = 320 + Math.cos(a) * 126;
      point.y = 240 + Math.sin(a) * 126;
    });
    this.state.snakes = [this.snake]; this.state.playerId = 1;
    this.refill();
  }

  get finished(): boolean { return this.state.timeMs >= TRIAL_DURATION_MS; }
  get timeLeftMs(): number { return Math.max(0, TRIAL_DURATION_MS - this.state.timeMs); }
  get automatic(): boolean { return this.aim === null; }

  setAim(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.aim = { x: Math.min(580, Math.max(60, x)), y: Math.min(420, Math.max(60, y)) };
  }

  releaseAim(): void { this.aim = null; }
  setBoost(on: boolean): void { this.snake.wantBoost = on && !this.finished && canBoost(this.snake); }

  update(dtMs: number): void {
    if (!Number.isFinite(dtMs) || dtMs <= 0 || this.finished) return;
    const dt = Math.min(dtMs, TRIAL_STEP_MS, this.timeLeftMs);
    this.state.timeMs += dt;
    const snake = this.snake;
    if (snake.x < 65 || snake.y < 65 || snake.x > 575 || snake.y > 415) {
      snake.targetAngle = Math.atan2(240 - snake.y, 320 - snake.x);
    } else if (this.aim) {
      snake.targetAngle = Math.atan2(this.aim.y - snake.y, this.aim.x - snake.x);
    } else {
      const bearing = Math.atan2(snake.y - 240, snake.x - 320);
      snake.targetAngle = Math.atan2(240 + Math.sin(bearing + .6) * 126 - snake.y, 320 + Math.cos(bearing + .6) * 126 - snake.x);
    }
    const boost = tickBoost(snake.length, snake.wantBoost, dt / 1000, snake.boostDropAccum);
    snake.length = boost.length; snake.boostDropAccum = boost.dropAccum;
    snake.boosting = boost.boosting && snake.length > 30;
    if (boost.drops > 0) dropBoostOrbs(this.state, this.rng, snake, boost.drops, 1);
    moveSnake(snake, dt, currentSpeed(snake.length, snake.boosting), { width: 640, height: 480, softWallMargin: 70 });
    pullNearbyOrbs(this.state, dt); updateOrbs(this.state, dt);
    const meal = eatOrbs(this.state, snake);
    if (meal.gained > 0) { growSnake(snake, meal.gained); snake.lastEatAt = this.state.timeMs; this.eaten += meal.eaten.length; }
    this.refillMs += dt;
    if (this.refillMs >= 1000) { this.refillMs = 0; this.refill(); }
    if (this.finished) { snake.wantBoost = false; snake.boosting = false; this.state.status = "ended"; }
  }

  private refill(): void {
    while (this.state.orbs.length < 18) {
      this.state.orbs.push(createOrb({ id: this.state.nextOrbId++, x: 75 + this.rng() * 490, y: 75 + this.rng() * 330, tier: this.state.nextOrbId % 4 === 0 ? "large" : "small", rng: this.rng }));
    }
  }
}