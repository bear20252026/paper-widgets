/** 游戏核心数据结构(纯数据,不含任何行为)。 */

export interface Vec2 {
  x: number;
  y: number;
}

export type EnemyKind =
  | "grunt" | "flyer" | "fatty" | "boss"
  | "runner" | "armored" | "healer" | "splitter"
  | "swarmling" | "airship" | "mage" | "brute"
  | "shieldman" | "ghost" | "carrier" | "golem" | "bomber" | "warlord"
  | "ghoul" | "mimic" | "lava" | "troll" | "warlock" | "dragonling" | "herald";
export type TowerKind =
  | "bottle" | "fan" | "sunflower" | "moon" | "star"
  | "arrow" | "cannon" | "sniper" | "tesla" | "poison"
  | "mortar" | "laser" | "spike" | "goldmine" | "rocket"
  | "crossbow" | "railgun" | "flame" | "boomerang" | "tornado"
  | "frostpillar" | "minefield" | "prism" | "bank" | "obelisk"
  | "shotgun" | "grenade" | "cutter" | "magnet" | "medic"
  | "siege" | "trap" | "sonic" | "chrono" | "nuke";
export type EnemyState =
  | "spawn"
  | "moving"
  | "slowed"
  | "frozen"
  | "dying"
  | "dead"
  | "leaked";
export type ObstacleKind = "rock" | "stump" | "chest";

/** Roguelite 遗物。 */
export type RelicId =
  | "power" | "haste" | "lens" | "bounty"
  | "interest" | "repair" | "chill" | "discount";
export type CellType = "ground" | "path";
export type GameStatus = "playing" | "won" | "lost";
/** 波次词缀:让同一波玩法不同。 */
export type AffixId = "swift" | "armored" | "regen" | "giant" | "mad" | "bounty";
export type GameMode = "campaign" | "endless";
export type WavePhase = "prep" | "spawning" | "finished";

/** 路径:折线 + 累计长度,用于按距离插值。 */
export interface Path {
  points: Vec2[];
  cumulative: number[];
  length: number;
}

export interface PathSample {
  x: number;
  y: number;
  angle: number;
  progress: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  path: Path;
  pathIndex: number;
  flying: boolean;
  distance: number; // 已沿路径行走的距离
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  baseSpeed: number;
  state: EnemyState;
  stateTimer: number;
  slowFactor: number;
  slowTimer: number;
  freezeTimer: number;
  freezeImmune: boolean;
  slowImmune: boolean;
  armor: number; // 0..1 伤害减免
  poisonDps: number;
  poisonTimer: number;
  healRadius: number;
  healPerSec: number;
  splitInto: EnemyKind | null;
  splitCount: number;
  leakDamage: number;
  reward: number;
  rewardPaid: boolean;
  radius: number;
  /** 幽灵猎手:周期性隐身,隐身时不可被攻击 */
  cloaked: boolean;
  cloakedTimer: number;
  /** 术士召唤间隔计时 */
  summonTimer: number;
  /** 末日使者治疗间隔计时 */
  auraTimer: number;
  /** 陷阱免疫剩余时间(踩雷后的短暂免疫,替代 setTimeout) */
  trapImmune: number;
}

export interface TargetRef {
  type: "enemy" | "obstacle";
  id: number;
}

/** 攻击优先级:最靠前 / 血最多 / 距离最近 */
export type TargetPriority = "first" | "strongest" | "closest";

export interface Tower {
  id: number;
  kind: TowerKind;
  level: number;
  priority: TargetPriority;
  col: number;
  row: number;
  x: number;
  y: number;
  cooldown: number;
  angle: number;
  invested: number; // 累计投入(建造 + 升级),出售按此计算
  target: TargetRef | null;
  /** 治疗塔光环:在此时间点前获得攻速加成(逻辑时间,非真实时间) */
  hasteUntil: number;
}

export interface Projectile {
  id: number;
  kind: TowerKind;
  x: number;
  y: number;
  tx: number; // 目标最后已知位置
  ty: number;
  speed: number;
  damage: number;
  target: TargetRef;
  splash: number;
  slowFactor: number;
  slowDuration: number;
  freezeChance: number;
  freezeDuration: number;
  poisonDps: number;
  poisonDuration: number;
  canHitAir: boolean;
}

/** 地面危险区(熔岩怪留下的火场)。属于游戏状态,不是渲染特效。 */
export interface Hazard {
  id: number;
  x: number;
  y: number;
  radius: number;
  ttl: number;
  dps: number;
  color: string;
}

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  col: number;
  row: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  reward: number;
}

export type EffectKind = "beam" | "pulse" | "ring" | "text" | "fire";
export interface Effect {
  id: number;
  kind: EffectKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  radius: number;
  ttl: number;
  maxTtl: number;
  color: string;
  text?: string;
}

export type GameEvent =
  | { type: "shoot"; tower: TowerKind }
  | { type: "kill"; enemy: EnemyKind }
  | { type: "leak"; damage: number }
  | { type: "waveStart"; wave: number }
  | { type: "obstacleCleared"; reward: number }
  | { type: "boon" }
  | { type: "skill" }
  | { type: "win" }
  | { type: "lose" };

/* ---------- 波次 ---------- */
export interface SpawnGroup {
  kind: EnemyKind;
  count: number;
  interval: number; // 基础出怪间隔(秒)
  compress?: number; // 间隔压缩系数:第 i 个间隔 = interval * compress^i
  delay?: number; // 相对波次开始的延迟
  pathIndex?: number | "alternate"; // 出怪口,默认轮流
  hpScale?: number;
}
export interface WaveDef {
  groups: SpawnGroup[];
  /** 本波词缀(无尽模式使用) */
  affix?: AffixId;
  /** 该波是否包含 Boss(用于 UI 提示与测试,不参与战斗逻辑) */
  boss?: boolean;
}
export interface SpawnEvent {
  time: number;
  kind: EnemyKind;
  pathIndex: number;
  hpScale: number;
}
export interface WaveState {
  phase: WavePhase;
  waveNumber: number; // 已开始的波数(0 = 尚未开始)
  totalWaves: number;
  prepTimer: number;
  spawnClock: number;
  queue: SpawnEvent[];
  queueIndex: number;
}

/* ---------- 关卡 ---------- */
export interface ObstacleSpawn {
  col: number;
  row: number;
  kind: ObstacleKind;
}
export type Difficulty = "简单" | "普通" | "困难" | "噩梦" | "地狱";

export interface LevelDef {
  id: number;
  name: string;
  desc: string;
  difficulty: Difficulty;
  tip: string;
  chapter: 1 | 2 | 3 | 4;
  cols: number;
  rows: number;
  /** 每条路径的路径点(格子坐标,相邻点必须同行或同列) */
  waypoints: Array<Array<[number, number]>>;
  obstacles: ObstacleSpawn[];
  startGold: number;
  maxLives?: number;
  firstWaveDelay: number;
  waves: WaveDef[];
}

export interface GameStats {
  kills: number;
  leaked: number;
  goldEarned: number;
  goldSpent: number;
}

export interface GameState {
  level: LevelDef;
  time: number;
  status: GameStatus;
  rating: 0 | 1 | 2 | 3; // 3 = 金萝卜, 2 = 银萝卜, 1 = 铜萝卜
  gold: number;
  lives: number;
  maxLives: number;
  grid: CellType[][];
  paths: Path[];
  airPaths: Path[];
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  obstacles: Obstacle[];
  hazards: Hazard[];
  effects: Effect[];
  waves: WaveState;
  focusObstacleId: number | null;
  events: GameEvent[];
  stats: GameStats;
  nextId: number;
  rngState: number;
  /** 已获得的遗物(每局最多 4 个) */
  relics: RelicId[];
  /** 当前待选的三张遗物卡;非空时游戏逻辑暂停 */
  boonOffer: RelicId[] | null;
  boonsTaken: number;
  /** 已经结算过的波数(用于发放利息与遗物) */
  clearedWaves: number;
  /** 大招能量 0..100 */
  energy: number;
  skillCasts: number;
}
