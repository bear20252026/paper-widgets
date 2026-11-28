import type {
  Difficulty,
  GameEvent,
  GameMode,
  GameState,
  HudState,
  RunResult,
  SkinId,
  Snake,
} from "./types";
import { createRng, hashSeed, pick, randRange, type Rng } from "./rng";
import {
  createGameState,
  dropBoostOrbs,
  dropDeathOrbs,
  eatOrbs,
  initialStateOrbs,
  maintainOrbs,
  dropBossLoot,
  pullNearbyOrbs,
  randomAiLength,
  randomSpawnPosition,
  updateOrbs,
  spawnEnergyTide,
  createOrb,
  ORB_VALUES,
} from "./world";
import { createSnake, growSnake, moveSnake } from "./snake";
import { currentSpeed, displayLength, START_LENGTH } from "./speed";
import { buildBodyHash, headHitsBody, wallStatus, type SpatialHash, type BodyNode } from "./collision";
import { tickBoost, canBoost } from "./boost";
import { buildLeaderboard, coinBreakdownFor, currentKing, rankOf } from "./ranking";
import { calcRpGain } from "./progression";
import { decideAi, aiNamesFor } from "./ai";
import { SKINS, getSkin } from "./skins";
import { getLang, t } from "../i18n";
import {
  POWER_RESPAWN_MS,
  POWER_TARGET,
  TURBO_SPEED_BONUS,
  activePowers,
  collectPowerUps,
  powerActive,
  spawnPowerUp,
} from "./powerups";

export interface EngineOptions {
  seed?: number;
  mode?: GameMode;
  skin?: SkinId;
  playerName?: string;
  botCount?: number;
  bestLength?: number;
  difficulty?: Difficulty;
  /** offer one revive: the run pauses at "awaiting revive" instead of ending on death */
  allowRevive?: boolean;
  /** map pick-ups (default on) */
  powerUps?: boolean;
  /** Attract mode: the "player" snake is driven by the AI and never ends the run. */
  autopilot?: boolean;
  /** override objective pacing (tests / tuning) */
  objectiveTiming?: { firstBossMs?: number; firstTideMs?: number; bossIntervalMs?: number; tideIntervalMs?: number };
  onEvent?: (event: GameEvent) => void;
  onHud?: (hud: HudState) => void;
  onEnd?: (result: RunResult) => void;
}

export const AI_THINK_INTERVAL = 3; // logic frames
export const COMBO_WINDOW_MS = 11_000;
const HUD_INTERVAL_MS = 140;
const BOT_RESPAWN_MS = 3800;

/** Feel & pacing constants. */
export const HIT_STOP_KILL_MS = 34;
export const HIT_STOP_DEATH_MS = 58;
const FIRST_BOSS_MS = 26_000;
const BOSS_INTERVAL_MS = 62_000;
const FIRST_TIDE_MS = 15_000;
const TIDE_INTERVAL_MS = 34_000;
const MAX_ORBS = 860;

/** Per-difficulty arena tuning: bot population, AI reaction, bot size and coin multiplier. */
export const DIFFICULTY: Record<Difficulty, { bots: number; think: number; lengthScale: number; coinMult: number }> = {
  easy: { bots: 9, think: 5, lengthScale: 0.75, coinMult: 0.8 },
  normal: { bots: 12, think: AI_THINK_INTERVAL, lengthScale: 1, coinMult: 1 },
  hard: { bots: 15, think: 2, lengthScale: 1.3, coinMult: 1.35 },
};

const MILESTONES: { length: number; title: string }[] = [
  { length: 200, title: "突破 200 米 · 崭露头角" },
  { length: 400, title: "突破 400 米 · 巨蟒成型" },
  { length: 700, title: "突破 700 米 · 盘踞一方" },
  { length: 1000, title: "突破 1000 米 · 制霸纸格" },
];

/**
 * The whole simulation. Fixed-timestep update(fixedDeltaMS) driven by the
 * render host; contains no PixiJS imports and never reads render state.
 */
export class GameEngine {
  readonly state: GameState;
  readonly runId: string;
  private rng: Rng;
  private opts: EngineOptions;
  private hudAccum = 0;
  private bestLength: number;
  private ended = false;
  readonly autopilot: boolean;
  private orbMaintainAccum = 0;
  private bodyHash: SpatialHash<BodyNode> | null = null;
  private nextMilestoneIdx = 0;
  private playerEverKing = false;
  private lastKingAnnounceAt = -99999;
  private playerOrbsEaten = 0;
  private playerMaxLength = START_LENGTH;
  private hitStopMs = 0;
  private bossId: number | null = null;
  private firstBossMs = FIRST_BOSS_MS;
  private firstTideMs = FIRST_TIDE_MS;
  private bossIntervalMs = BOSS_INTERVAL_MS;
  private tideIntervalMs = TIDE_INTERVAL_MS;
  private nextBossAt = FIRST_BOSS_MS;
  private nextTideAt = FIRST_TIDE_MS;
  private tideUntil = 0;
  private difficulty: Difficulty;
  private botTarget: number;
  private thinkInterval: number;
  private powerRng: Rng;
  private powersEnabled: boolean;
  private playerPowers = 0;
  private recordAnnounced = false;
  private awaitingRevive = false;
  private revived = false;
  private downLength = 0;
  private lastShieldFxAt = -99999;

  constructor(opts: EngineOptions = {}) {
    const seed = (opts.seed ?? hashSeed(`arena-${Date.now()}`)) >>> 0;
    this.opts = opts;
    this.autopilot = opts.autopilot ?? false;
    this.bestLength = opts.bestLength ?? 0;
    if (opts.objectiveTiming) {
      this.firstBossMs = opts.objectiveTiming.firstBossMs ?? FIRST_BOSS_MS;
      this.firstTideMs = opts.objectiveTiming.firstTideMs ?? FIRST_TIDE_MS;
      this.bossIntervalMs = opts.objectiveTiming.bossIntervalMs ?? BOSS_INTERVAL_MS;
      this.tideIntervalMs = opts.objectiveTiming.tideIntervalMs ?? TIDE_INTERVAL_MS;
    }
    this.nextBossAt = this.firstBossMs;
    this.nextTideAt = this.firstTideMs;
    this.runId = `run-${seed}-${Date.now().toString(36)}`;
    this.state = createGameState({ seed, mode: opts.mode ?? "endless" });
    this.rng = createRng(seed);
    // Separate stream so pick-ups never perturb the deterministic world RNG.
    this.powerRng = createRng((seed ^ 0x9e3779b9) >>> 0);
    this.difficulty = opts.difficulty ?? "normal";
    const tune = DIFFICULTY[this.difficulty];
    this.botTarget = opts.difficulty ? tune.bots : 12;
    this.thinkInterval = tune.think;
    this.powersEnabled = opts.powerUps ?? true;
    initialStateOrbs(this.state, this.rng);
    this.spawnPlayer(opts.skin ?? "mint", opts.playerName ?? t("你"));
    const bots = Math.max(3, opts.botCount ?? this.botTarget);
    for (let i = 0; i < bots; i++) this.spawnBot(true);
    const king = currentKing(this.state.snakes);
    this.state.kingId = king?.id ?? -1;
    if (king?.isPlayer) this.playerEverKing = true;
    this.bodyHash = buildBodyHash(this.state.snakes);
    if (this.powersEnabled) {
      for (let i = 0; i < 6; i++) {
        spawnPowerUp(this.state, this.powerRng, { x: this.state.width / 2, y: this.state.height / 2, radius: 380 });
      }
    }
  }

  get player(): Snake {
    return this.state.snakes.find((s) => s.id === this.state.playerId)!;
  }

  get playerRank(): number {
    return rankOf(this.state.snakes, this.state.playerId);
  }

  private spawnPlayer(skin: SkinId, name: string): void {
    const snake = createSnake({
      id: this.state.nextSnakeId++,
      name,
      x: this.state.width / 2,
      y: this.state.height / 2,
      angle: -Math.PI / 2,
      skin,
      isPlayer: true,
      aiProfile: this.autopilot ? "farmer" : null,
      length: START_LENGTH,
      now: this.state.timeMs,
    });
    snake.spawnGrace = 1200;
    this.state.snakes.push(snake);
    this.state.playerId = snake.id;
  }

  private spawnBot(initial = false): void {
    const profiles = ["aggressive", "farmer", "evasive", "lure", "evasive", "aggressive"] as const;
    const profile = initial ? profiles[(this.state.snakes.length - 1) % profiles.length] : pick(this.rng, profiles);
    const skin = pick(this.rng, SKINS).id;
    const player = this.state.snakes.find((s) => s.isPlayer);
    // Prefer a genuinely empty patch so bots don't spawn on top of a body.
    let pos = randomSpawnPosition(this.state, this.rng, {
      x: player?.x ?? this.state.width / 2,
      y: player?.y ?? this.state.height / 2,
      radius: initial ? 900 : 1150,
    });
    for (let attempt = 0; attempt < 18; attempt++) {
      let nearest = Infinity;
      for (const other of this.state.snakes) {
        if (!other.alive) continue;
        for (let i = 0; i < other.points.length; i += 3) {
          const d = Math.hypot(other.points[i].x - pos.x, other.points[i].y - pos.y);
          if (d < nearest) nearest = d;
        }
      }
      if (nearest > 460) break;
      pos = randomSpawnPosition(this.state, this.rng, {
        x: player?.x ?? this.state.width / 2,
        y: player?.y ?? this.state.height / 2,
        radius: initial ? 900 : 1150,
      });
    }
    const length = Math.max(32, Math.round(randomAiLength(this.rng) * DIFFICULTY[this.difficulty].lengthScale));
    const names = aiNamesFor(getLang());
    const name = names[Math.floor(this.rng() * names.length)];
    const snake = createSnake({
      id: this.state.nextSnakeId++,
      name,
      x: pos.x,
      y: pos.y,
      angle: randRange(this.rng, -Math.PI, Math.PI),
      skin,
      isPlayer: false,
      aiProfile: profile,
      length,
      now: this.state.timeMs,
    });
    snake.spawnGrace = 900;
    this.state.snakes.push(snake);
    this.opts.onEvent?.({ type: "spawnBot", name });
  }

  private spawnBoss(): void {
    const state = this.state;
    const player = this.player;
    const pos = randomSpawnPosition(state, this.rng, {
      x: player?.x ?? state.width / 2,
      y: player?.y ?? state.height / 2,
      radius: 900,
    });
    const length = 380 + Math.floor(this.rng() * 160);
    const boss = createSnake({
      id: state.nextSnakeId++,
      name: t("黄金巨蟒"),
      x: pos.x,
      y: pos.y,
      angle: randRange(this.rng, -Math.PI, Math.PI),
      skin: "gold",
      isPlayer: false,
      aiProfile: "aggressive",
      length,
      now: state.timeMs,
    });
    boss.isBoss = true;
    boss.spawnGrace = 1400;
    state.snakes.push(boss);
    this.bossId = boss.id;
    this.opts.onEvent?.({ type: "bossSpawn", name: boss.name, length: Math.round(length) });
  }

  /** Read-only countdowns for the HUD objective tracker. */
  /** Remaining freeze for tests / debugging UI. */
  get hitStopRemainingMs(): number {
    return this.hitStopMs;
  }

  get objectiveTimers(): { bossInMs: number; tideInMs: number } {
    const t = this.state.timeMs;
    return {
      bossInMs: this.bossId === null ? Math.max(0, this.nextBossAt - t) : 0,
      tideInMs: Math.max(0, this.nextTideAt - t),
    };
  }

  setPlayerDirection(angle: number): void {
    if (this.autopilot) return;
    const p = this.player;
    if (p.alive) p.targetAngle = angle;
  }

  setPlayerVector(x: number, y: number): void {
    if (Math.abs(x) + Math.abs(y) < 0.12) return;
    this.setPlayerDirection(Math.atan2(y, x));
  }

  /** Boost is allowed above 30 m, or at any length while turbo is active. */
  private snakeCanBoost(snake: Snake): boolean {
    return canBoost(snake) || (snake.alive && powerActive(snake, "turbo", this.state.timeMs));
  }

  get isAwaitingRevive(): boolean {
    return this.awaitingRevive;
  }

  get hasRevived(): boolean {
    return this.revived;
  }

  setBoost(on: boolean): void {
    if (this.autopilot) return;
    const p = this.player;
    const next = on && this.snakeCanBoost(p);
    if (next && !p.wantBoost) {
      this.opts.onEvent?.({ type: "boostStart", player: true });
    }
    p.wantBoost = next;
  }

  isBoosting(): boolean {
    return this.player.boosting;
  }

  canPlayerBoost(): boolean {
    return this.snakeCanBoost(this.player);
  }

  /**
   * Bring the downed player back: a fresh snake at a quiet spot with half the
   * length it had, keeping kills and streak records. Only once per run.
   */
  revive(): boolean {
    if (!this.awaitingRevive || this.ended) return false;
    const old = this.player;
    const others = this.state.snakes.filter((s) => s.alive);
    let pos = randomSpawnPosition(this.state, this.rng);
    for (let attempt = 0; attempt < 30; attempt++) {
      const clear = others.every((o) => o.points.every((pt, i) => i % 4 !== 0 || Math.hypot(pt.x - pos.x, pt.y - pos.y) > 520));
      if (clear) break;
      pos = randomSpawnPosition(this.state, this.rng);
    }
    const length = Math.max(START_LENGTH, Math.round(this.downLength * 0.5));
    const fresh = createSnake({
      id: old.id,
      name: old.name,
      x: pos.x,
      y: pos.y,
      angle: randRange(this.rng, -Math.PI, Math.PI),
      skin: old.skin,
      isPlayer: true,
      aiProfile: null,
      length,
      now: this.state.timeMs,
    });
    fresh.kills = old.kills;
    fresh.bestStreak = old.bestStreak;
    fresh.spawnGrace = 1500;
    fresh.powers.shield = this.state.timeMs + 4000;
    const index = this.state.snakes.findIndex((s) => s.id === old.id);
    if (index >= 0) this.state.snakes[index] = fresh;
    this.awaitingRevive = false;
    this.revived = true;
    this.state.status = "playing";
    this.opts.onEvent?.({ type: "revive", length: displayLength(length) });
    this.emitHud();
    return true;
  }

  /** Decline the revive and finish the run with the original death. */
  giveUp(): void {
    if (!this.awaitingRevive || this.ended) return;
    this.awaitingRevive = false;
    this.endGame("death");
  }

  /** Fixed-timestep logic tick — the ONLY way the simulation advances. */
  step(fixedDeltaMS: number): void {
    if (this.ended) return;
    if (this.state.status !== "playing" && !this.awaitingRevive) return;
    // Hit stop: a kill/death freezes the simulation for 1–3 fixed steps while
    // the renderer keeps drawing, which is what makes impacts land.
    if (this.hitStopMs > 0) {
      this.hitStopMs = Math.max(0, this.hitStopMs - fixedDeltaMS);
      return;
    }
    const state = this.state;
    const dtSec = fixedDeltaMS / 1000;
    state.timeMs += fixedDeltaMS;

    if (!this.autopilot && state.mode === "timed" && state.timeMs >= state.limitMs) {
      state.timeMs = state.limitMs;
      if (this.awaitingRevive) {
        this.awaitingRevive = false;
        this.endGame("death");
      } else this.endGame("time");
      return;
    }

    // 1. AI steering (lower frequency than the logic tick).
    for (const snake of state.snakes) {
      if (!snake.alive) continue;
      if (snake.isPlayer && !this.autopilot) continue;
      snake.aiThinkCooldown -= 1;
      if (snake.aiThinkCooldown <= 0) {
        snake.aiThinkCooldown = snake.isBoss ? AI_THINK_INTERVAL : this.thinkInterval;
        const decision = decideAi(state, snake, this.bodyHash ?? buildBodyHash(state.snakes));
        snake.targetAngle = decision.targetAngle;
        snake.wantBoost = decision.boost && this.snakeCanBoost(snake);
      }
    }

    // 2. Movement, boost drain, wall grace, streak decay.
    for (const snake of state.snakes) {
      if (!snake.alive) continue;
      if (snake.streak > 0 && state.timeMs - snake.lastKillAt > COMBO_WINDOW_MS) {
        snake.streak = 0;
      }
      const turbo = powerActive(snake, "turbo", state.timeMs);
      if (snake.isPlayer && snake.wantBoost && !this.snakeCanBoost(snake)) snake.wantBoost = false;
      if (turbo) {
        // Turbo: boosting is free — no length drain, no dropped light.
        snake.boosting = snake.wantBoost;
        snake.boostDropAccum = 0;
      } else {
        const boost = tickBoost(snake.length, snake.wantBoost, dtSec, snake.boostDropAccum);
        snake.boosting = boost.boosting;
        snake.boostDropAccum = boost.dropAccum;
        if (boost.drained > 0) snake.length = boost.length;
        if (snake.boosting && boost.drops > 0) {
          dropBoostOrbs(state, this.rng, snake, boost.drops, ORB_VALUES.small * 0.5);
        }
      }
      const speed = currentSpeed(snake.length, snake.boosting) * (turbo ? TURBO_SPEED_BONUS : 1);
      moveSnake(snake, fixedDeltaMS, speed, {
        width: state.width,
        height: state.height,
        softWallMargin: 150,
      });
      const wall = wallStatus({ x: snake.x, y: snake.y }, state);
      snake.graze = wall === "graze";
      if (wall === "graze") {
        // forgiving wall: gentle push back inside
        snake.x = Math.max(-40, Math.min(state.width + 40, snake.x));
        snake.y = Math.max(-40, Math.min(state.height + 40, snake.y));
      } else if (wall === "dead") {
        this.killSnake(snake, "wall", null);
        continue;
      }
    }

    // 3. Orbs: magnetic suction, idle motion, eating, milestones.
    pullNearbyOrbs(state, fixedDeltaMS);
    updateOrbs(state, fixedDeltaMS);
    for (const snake of state.snakes) {
      if (!snake.alive) continue;
      const eaten = eatOrbs(state, snake);
      if (eaten.gained > 0) {
        growSnake(snake, eaten.gained);
        snake.lastEatAt = state.timeMs;
        if (snake.isPlayer) {
          this.playerOrbsEaten += eaten.eaten.length;
          this.playerMaxLength = Math.max(this.playerMaxLength, snake.length);
          for (const orb of eaten.eaten) {
            this.opts.onEvent?.({
              type: "eat",
              tier: orb.tier,
              value: orb.value,
              x: orb.x,
              y: orb.y,
              player: true,
            });
          }
          if (!this.recordAnnounced && this.bestLength >= 100 && displayLength(snake.length) > this.bestLength) {
            this.recordAnnounced = true;
            this.opts.onEvent?.({ type: "record", length: displayLength(snake.length) });
          }
          while (
            this.nextMilestoneIdx < MILESTONES.length &&
            snake.length >= MILESTONES[this.nextMilestoneIdx].length
          ) {
            const m = MILESTONES[this.nextMilestoneIdx++];
            this.opts.onEvent?.({ type: "milestone", length: m.length, title: m.title });
          }
        }
      }
    }

    // 3b. Pick-ups.
    if (this.powersEnabled && state.powerUps.length > 0) {
      for (const snake of state.snakes) {
        if (!snake.alive) continue;
        const got = collectPowerUps(state, snake);
        for (const p of got) {
          if (snake.isPlayer) this.playerPowers += 1;
          this.opts.onEvent?.({ type: "power", kind: p.kind, player: snake.isPlayer, x: p.x, y: p.y });
        }
      }
    }

    // 4. Head vs body collisions (identical rules for every snake; own body is immune).
    const prevKingId = state.kingId;
    const hash = buildBodyHash(state.snakes);
    this.bodyHash = hash;
    const collisions: { victim: Snake; killerId: number }[] = [];
    for (const snake of state.snakes) {
      if (!snake.alive || snake.spawnGrace > 0) continue;
      const hit = headHitsBody({ x: snake.x, y: snake.y }, snake.radius * 1.16, snake.id, hash);
      if (!hit) continue;
      if (powerActive(snake, "shield", state.timeMs)) {
        if (state.timeMs - this.lastShieldFxAt > 450 && snake.isPlayer) {
          this.lastShieldFxAt = state.timeMs;
          this.opts.onEvent?.({ type: "shieldBlock", player: true, x: snake.x, y: snake.y });
        }
        continue;
      }
      collisions.push({ victim: snake, killerId: hit.snakeId });
    }
    for (const { victim, killerId } of collisions) {
      if (!victim.alive) continue;
      const killer = state.snakes.find((s) => s.id === killerId);
      if (killer && !killer.alive) continue;
      const wasKing = victim.id === prevKingId && victim.length >= 110;
      if (killer) {
        killer.kills += 1;
        if (state.timeMs - killer.lastKillAt <= COMBO_WINDOW_MS) {
          killer.streak += 1;
        } else {
          killer.streak = 1;
        }
        killer.lastKillAt = state.timeMs;
        if (killer.streak > killer.bestStreak) killer.bestStreak = killer.streak;
        this.opts.onEvent?.({
          type: "kill",
          player: killer.isPlayer,
          killerName: killer.name,
          name: victim.name,
          streak: killer.streak,
          wasKing,
          victimLength: Math.round(victim.length),
          x: victim.x,
          y: victim.y,
        });
      }
      this.killSnake(victim, "body", killerId, wasKing);
      if (this.ended) break;
    }
    if (this.ended) return;

    // 5. Update Snake King crown holder & announce player coronation.
    const nextKing = currentKing(state.snakes);
    const nextKingId = nextKing?.id ?? -1;
    if (nextKingId !== prevKingId && nextKing) {
      state.kingId = nextKingId;
      if (nextKing.isPlayer) {
        this.playerEverKing = true;
        if (state.timeMs - this.lastKingAnnounceAt > 8000 && state.timeMs > 1500) {
          this.lastKingAnnounceAt = state.timeMs;
          this.opts.onEvent?.({
            type: "king",
            player: true,
            name: nextKing.name,
            length: Math.round(nextKing.length),
          });
        }
      }
    }

    // 6. Cleanup, hotspots expiry, ambient top-up, respawns, HUD.
    state.snakes = state.snakes.filter((s) => s.alive || s.isPlayer);
    if (state.hotspots.length > 0) {
      state.hotspots = state.hotspots.filter((h) => h.until > state.timeMs);
    }
    const aliveBots = state.snakes.filter((s) => s.alive && !s.isPlayer && !s.isBoss).length;
    if (aliveBots < this.botTarget) {
      state.botRespawnTimer += fixedDeltaMS;
      if (state.botRespawnTimer >= BOT_RESPAWN_MS) {
        state.botRespawnTimer = 0;
        this.spawnBot();
      }
    } else {
      state.botRespawnTimer = 0;
    }
    // Public objectives: golden boss python + drifting energy tide.
    if (!this.autopilot) {
      if (this.bossId === null && state.timeMs >= this.nextBossAt) {
        this.spawnBoss();
        this.nextBossAt = state.timeMs + this.bossIntervalMs;
      }
      if (state.timeMs >= this.nextTideAt) {
        const player = this.player;
        const tide = spawnEnergyTide(state, this.rng, {
          x: player?.x ?? state.width / 2,
          y: player?.y ?? state.height / 2,
          radius: 260,
        });
        state.hotspots.push({ id: state.nextFeedId++, x: tide.x, y: tide.y, until: state.timeMs + 22_000, kind: "tide" });
        if (state.hotspots.length > 6) state.hotspots.shift();
        this.opts.onEvent?.({ type: "tide", x: tide.x, y: tide.y, count: tide.count });
        this.tideUntil = state.timeMs + 22_000;
        this.nextTideAt = state.timeMs + this.tideIntervalMs;
      }
    }
    if (this.powersEnabled && state.powerUps.length < POWER_TARGET) {
      state.powerTimer += fixedDeltaMS;
      if (state.powerTimer >= POWER_RESPAWN_MS) {
        state.powerTimer = 0;
        const p = this.player;
        spawnPowerUp(state, this.powerRng, { x: p.x, y: p.y, radius: 420 });
      }
    }
    if (state.orbs.length > MAX_ORBS) state.orbs.splice(0, state.orbs.length - MAX_ORBS);

    this.orbMaintainAccum += fixedDeltaMS;
    if (this.orbMaintainAccum > 700) {
      this.orbMaintainAccum = 0;
      maintainOrbs(state, this.rng);
    }
    state.killFeed = state.killFeed.slice(-4);
    this.hudAccum += fixedDeltaMS;
    if (this.hudAccum >= HUD_INTERVAL_MS) {
      this.hudAccum = 0;
      this.emitHud();
    }
  }

  private killSnake(
    victim: Snake,
    reason: Snake["deathReason"],
    killerId: number | null,
    wasKing = false
  ): void {
    if (!victim.alive) return;
    victim.alive = false;
    victim.boosting = false;
    victim.speed = 0;
    victim.deathReason = reason;
    victim.killerId = killerId;
    victim.wantBoost = false;
    const midPt = victim.points[Math.floor(victim.points.length * 0.35)] ?? { x: victim.x, y: victim.y };
    dropDeathOrbs(this.state, this.rng, victim);
    if (victim.length >= 110) {
      this.state.hotspots.push({
        id: this.state.nextFeedId++,
        x: midPt.x,
        y: midPt.y,
        until: this.state.timeMs + 13_000,
        kind: "feast",
      });
      if (this.state.hotspots.length > 6) this.state.hotspots.shift();
    }
    this.opts.onEvent?.({
      type: "death",
      player: victim.isPlayer,
      x: victim.x,
      y: victim.y,
      reason,
      victimLength: Math.round(victim.length),
    });
    const killer = this.state.snakes.find((s) => s.id === killerId && s.id !== victim.id);
    if (killer) {
      this.state.killFeed.push({
        id: this.state.nextFeedId++,
        killer: killer.name,
        victim: victim.name,
        at: this.state.timeMs,
        streak: killer.streak,
        wasKing,
      });
      if (this.state.killFeed.length > 4) this.state.killFeed.shift();
    }

    // Boss python: a public objective worth fighting over.
    if (victim.isBoss) {
      this.bossId = null;
      this.nextBossAt = this.state.timeMs + this.bossIntervalMs;
      if (killer) growSnake(killer, 26);
      dropBossLoot(this.state, this.rng, victim.x, victim.y);
      this.opts.onEvent?.({
        type: "bossDefeated",
        player: !!killer?.isPlayer,
        name: victim.name,
        x: victim.x,
        y: victim.y,
      });
    }

    // Hit stop: freeze the sim for 2–3 fixed steps on player kills / deaths.
    if (!this.autopilot && (victim.isPlayer || killer?.isPlayer)) {
      this.hitStopMs = victim.isPlayer ? HIT_STOP_DEATH_MS : HIT_STOP_KILL_MS;
      this.opts.onEvent?.({
        type: "hitStop",
        frames: Math.max(1, Math.round(this.hitStopMs / (1000 / 60))),
        heavy: victim.isPlayer,
      });
    }

    if (victim.isPlayer && this.autopilot) {
      this.respawnAutopilot(victim);
      return;
    }
    if (victim.isPlayer) {
      this.state.status = "dead";
      this.state.deathAt = this.state.timeMs;
      if (this.opts.allowRevive && !this.revived) {
        this.awaitingRevive = true;
        this.downLength = victim.length;
        this.opts.onEvent?.({ type: "playerDown", killerName: killer?.name ?? null, length: displayLength(victim.length) });
        this.emitHud();
        return;
      }
      this.endGame("death");
    }
  }

  /** Attract mode never stops: the demo snake simply hatches again. */
  private respawnAutopilot(victim: Snake): void {
    const pos = randomSpawnPosition(this.state, this.rng, {
      x: victim.x,
      y: victim.y,
      radius: 900,
    });
    const fresh = createSnake({
      id: victim.id,
      name: victim.name,
      x: pos.x,
      y: pos.y,
      angle: randRange(this.rng, -Math.PI, Math.PI),
      skin: victim.skin,
      isPlayer: true,
      aiProfile: "farmer",
      length: START_LENGTH,
      now: this.state.timeMs,
    });
    fresh.spawnGrace = 1200;
    const index = this.state.snakes.findIndex((s) => s.id === victim.id);
    if (index >= 0) this.state.snakes[index] = fresh;
  }

  private endGame(reason: "death" | "time"): void {
    if (this.ended) return;
    this.ended = true;
    this.state.endReason = reason;
    if (reason === "time") this.state.status = "ended";
    this.hudAccum = 0;
    this.emitHud();
    this.opts.onEnd?.(this.buildResult(reason));
  }

  private buildResult(reason: "death" | "time"): RunResult {
    const p = this.player;
    const rank = this.playerRank;
    const length = displayLength(p.length);
    const isRecord = length > this.bestLength;
    const rawBreakdown = coinBreakdownFor({
      length,
      rank,
      kills: p.kills,
      bestStreak: p.bestStreak,
      mode: this.state.mode,
      survivedMs: this.state.timeMs,
      isRecord,
    });
    const difficultyBonus = Math.round(rawBreakdown.total * (DIFFICULTY[this.difficulty].coinMult - 1));
    const breakdown = { ...rawBreakdown, difficultyBonus, total: Math.max(0, rawBreakdown.total + difficultyBonus) };
    const rpGain = calcRpGain({
      length,
      rank,
      kills: p.kills,
      bestStreak: p.bestStreak,
      survivedMs: this.state.timeMs,
    });
    return {
      runId: this.runId,
      mode: this.state.mode,
      length,
      rank,
      total: this.state.snakes.length,
      kills: p.kills,
      bestStreak: p.bestStreak,
      wasKing: this.playerEverKing || rank === 1,
      orbsEaten: this.playerOrbsEaten,
      maxLength: Math.round(this.playerMaxLength),
      timeMs: this.state.timeMs,
      deathReason: p.deathReason,
      killerName:
        reason === "death"
          ? this.state.snakes.find((s) => s.id === p.killerId)?.name ?? null
          : null,
      coins: breakdown.total,
      coinBreakdown: breakdown,
      rpGain,
      bestBefore: this.bestLength,
      isRecord,
      skin: p.skin,
      difficulty: this.difficulty,
      revived: this.revived,
      powersCollected: this.playerPowers,
    };
  }

  emitHud(): HudState {
    const p = this.player;
    const king = currentKing(this.state.snakes);
    const kingId = king?.id ?? -1;
    const hud: HudState = {
      status: this.state.status,
      length: p.length,
      displayLength: displayLength(p.length),
      rank: this.playerRank,
      total: this.state.snakes.length,
      aliveCount: this.state.snakes.filter((s) => s.alive).length,
      kills: p.kills,
      streak: p.streak,
      bestStreak: p.bestStreak,
      kingId,
      kingName: king?.name ?? "—",
      kingLength: displayLength(king?.length ?? 0),
      isKing: p.alive && p.id === kingId,
      timeLeftMs:
        this.state.mode === "timed"
          ? Math.max(0, this.state.limitMs - this.state.timeMs)
          : 0,
      timeMs: this.state.timeMs,
      mode: this.state.mode,
      boosting: p.boosting,
      canBoost: this.snakeCanBoost(p),
      speed: p.speed,
      graze: p.graze,
      boss: this.bossSnapshot(),
      tideActive: this.state.timeMs < this.tideUntil,
      nextBossInMs: this.bossId === null ? Math.max(0, this.nextBossAt - this.state.timeMs) : 0,
      nextTideInMs: Math.max(0, this.nextTideAt - this.state.timeMs),
      leaderboard: buildLeaderboard(this.state.snakes, 10),
      killFeed: this.state.killFeed.slice(-3),
      radar: {
        width: this.state.width,
        height: this.state.height,
        playerAngle: p.angle,
        snakes: this.state.snakes
          .filter((s) => s.alive)
          .map((s) => ({
            id: s.id,
            x: s.x,
            y: s.y,
            isPlayer: s.isPlayer,
            isKing: s.id === kingId,
            isBoss: !!s.isBoss,
          })),
        hotspots: this.state.hotspots.map((h) => ({ x: h.x, y: h.y, kind: h.kind })),
        powerUps: this.state.powerUps.map((u) => ({ x: u.x, y: u.y, kind: u.kind })),
      },
      skin: p.skin,
      powers: activePowers(p, this.state.timeMs),
      difficulty: this.difficulty,
      awaitingRevive: this.awaitingRevive,
      spectating: this.awaitingRevive ? this.state.snakes.find((s) => s.id === p.killerId && s.alive)?.name ?? null : null,
    };
    this.opts.onHud?.(hud);
    return hud;
  }

  private bossSnapshot(): { name: string; length: number; alive: boolean } | null {
    if (this.bossId === null) return null;
    const boss = this.state.snakes.find((s) => s.id === this.bossId && s.alive);
    if (!boss) return null;
    return { name: boss.name, length: Math.round(boss.length), alive: true };
  }

  getHud(): HudState {
    return this.emitHud();
  }

  /** Read-only helper for HUD/skins (no Pixi here). */
  skinOf(snake: Snake) {
    return getSkin(snake.skin);
  }

  debugSpawnOrb(): void {
    this.state.orbs.push(
      createOrb({
        x: this.player.x + 160,
        y: this.player.y,
        tier: "large",
        id: this.state.nextOrbId++,
        rng: this.rng,
      })
    );
  }
}
