/** Pure game domain types. Nothing in this folder may import PixiJS or React. */

export type Vec2 = { x: number; y: number };

export type GameMode = "endless" | "timed";

export type Difficulty = "easy" | "normal" | "hard";

/** Map pick-ups. Timers are simulation timestamps (ms) when the effect ends. */
export type PowerKind = "magnet" | "shield" | "turbo" | "double";

export interface PowerUp {
  id: number;
  x: number;
  y: number;
  kind: PowerKind;
  phase: number;
}

export type PowerTimers = Record<PowerKind, number>;

export type AiProfile = "aggressive" | "farmer" | "evasive" | "lure";

export type SkinId =
  | "mint"
  | "peach"
  | "grape"
  | "caramel"
  | "aurora"
  | "midnight"
  | "grid"
  | "gold"
  // structural (non-traditional silhouette) skins
  | "sketch"
  | "retro"
  | "express"
  | "origami"
  | "dna"
  | "starmap"
  | "comet"
  | "dragon"
  | "koi"
  | "jellyfish"
  | "cinema"
  | "kite"
  | "garden"
  | "zip"
  | "clockwork"
  | "orbit";

export type OrbTier = "small" | "large" | "corpse";

export interface Orb {
  id: number;
  x: number;
  y: number;
  tier: OrbTier;
  value: number;
  radius: number;
  color: string;
  /** stable phase for tiny idle animation in the renderer */
  phase: number;
  vx: number;
  vy: number;
  /** life remaining for death drops, ms */
  ttl: number;
  snakeColor?: string;
}

export interface Snake {
  id: number;
  name: string;
  isPlayer: boolean;
  aiProfile: AiProfile | null;
  /** golden neutral boss python — a public objective, not a player */
  isBoss?: boolean;
  skin: SkinId;
  alive: boolean;
  length: number;
  /** head position (logical, fixed-step) */
  x: number;
  y: number;
  angle: number;
  targetAngle: number;
  radius: number;
  speed: number;
  boosting: boolean;
  wantBoost: boolean;
  /** body centreline, index 0 is head */
  points: Vec2[];
  kills: number;
  /** active multi-kill combo count */
  streak: number;
  /** highest streak achieved this run */
  bestStreak: number;
  /** simulation timestamp (ms) of most recent kill */
  lastKillAt: number;
  /** timestamp (ms) of most recent orb eaten — used by renderer for mouth/head gulp juice */
  lastEatAt: number;
  deathReason: "body" | "wall" | null;
  killerId: number | null;
  bornAt: number;
  aiThinkCooldown: number;
  boostDropAccum: number;
  graze: boolean;
  /** safe spawn grace (ms) during which collisions are ignored */
  spawnGrace: number;
  /** active pick-up effects: end timestamp per kind (0 = inactive) */
  powers: PowerTimers;
}

export interface KillFeedItem {
  id: number;
  killer: string;
  victim: string;
  at: number;
  streak?: number;
  wasKing?: boolean;
}

export interface CorpseHotspot {
  id: number;
  x: number;
  y: number;
  until: number;
  kind?: "feast" | "tide";
}

export interface GameState {
  seed: number;
  mode: GameMode;
  status: "playing" | "dead" | "ended";
  timeMs: number;
  limitMs: number;
  width: number;
  height: number;
  snakes: Snake[];
  orbs: Orb[];
  playerId: number;
  kingId: number;
  nextOrbId: number;
  nextSnakeId: number;
  nextFeedId: number;
  killFeed: KillFeedItem[];
  hotspots: CorpseHotspot[];
  botRespawnTimer: number;
  powerUps: PowerUp[];
  powerTimer: number;
  deathAt: number;
  endReason: "death" | "time" | null;
}

export interface LeaderRow {
  id: number;
  name: string;
  length: number;
  skin: SkinId;
  kills: number;
  isPlayer: boolean;
  alive: boolean;
  isKing?: boolean;
}

export interface RadarPoint {
  id: number;
  x: number;
  y: number;
  isPlayer: boolean;
  isKing: boolean;
  isBoss?: boolean;
}

export interface RadarSnapshot {
  width: number;
  height: number;
  playerAngle: number;
  snakes: RadarPoint[];
  hotspots: { x: number; y: number; kind?: "feast" | "tide" }[];
  powerUps?: { x: number; y: number; kind: PowerKind }[];
}

export interface HudState {
  status: GameState["status"];
  length: number;
  displayLength: number;
  rank: number;
  total: number;
  aliveCount: number;
  kills: number;
  streak: number;
  bestStreak: number;
  kingId: number;
  kingName: string;
  kingLength: number;
  isKing: boolean;
  timeLeftMs: number;
  timeMs: number;
  mode: GameMode;
  boosting: boolean;
  canBoost: boolean;
  speed: number;
  graze: boolean;
  leaderboard: LeaderRow[];
  killFeed: KillFeedItem[];
  radar: RadarSnapshot;
  skin: SkinId;
  /** public objective state */
  boss: { name: string; length: number; alive: boolean } | null;
  tideActive: boolean;
  nextBossInMs: number;
  nextTideInMs: number;
  /** active player effects with remaining time */
  powers: { kind: PowerKind; leftMs: number; totalMs: number }[];
  difficulty: Difficulty;
  /** player is down and a revive may be offered */
  awaitingRevive: boolean;
  /** name of the snake the camera follows while the player is down */
  spectating: string | null;
}

export interface CoinBreakdown {
  base: number;
  rankBonus: number;
  killBonus: number;
  streakBonus: number;
  recordBonus: number;
  difficultyBonus?: number;
  total: number;
}

export interface RunResult {
  runId: string;
  mode: GameMode;
  length: number;
  rank: number;
  total: number;
  kills: number;
  bestStreak: number;
  wasKing: boolean;
  orbsEaten: number;
  maxLength: number;
  timeMs: number;
  deathReason: Snake["deathReason"];
  killerName: string | null;
  coins: number;
  coinBreakdown: CoinBreakdown;
  rpGain: number;
  bestBefore: number;
  isRecord: boolean;
  skin: SkinId;
  difficulty?: Difficulty;
  revived?: boolean;
  powersCollected?: number;
}

export type GameEvent =
  | { type: "eat"; tier: OrbTier; value: number; x: number; y: number; player: boolean }
  | { type: "boostStart"; player: boolean }
  | { type: "death"; player: boolean; x: number; y: number; reason: Snake["deathReason"]; victimLength: number }
  | {
      type: "kill";
      player: boolean;
      killerName: string;
      name: string;
      streak: number;
      wasKing: boolean;
      victimLength: number;
      x: number;
      y: number;
    }
  | { type: "king"; player: boolean; name: string; length: number }
  | { type: "bossSpawn"; name: string; length: number }
  | { type: "bossDefeated"; player: boolean; name: string; x: number; y: number }
  | { type: "tide"; x: number; y: number; count: number }
  | { type: "hitStop"; frames: number; heavy: boolean }
  | { type: "milestone"; length: number; title: string }
  | { type: "spawnBot"; name: string }
  | { type: "power"; kind: PowerKind; player: boolean; x: number; y: number }
  | { type: "record"; length: number }
  | { type: "playerDown"; killerName: string | null; length: number }
  | { type: "revive"; length: number }
  | { type: "shieldBlock"; player: boolean; x: number; y: number };

export interface WorldConfig {
  width: number;
  height: number;
  wallTolerance: number;
  softWallMargin: number;
  orbTarget: number;
}
