import { DYING_TIME, SPAWN_TIME } from "./constants";
import { samplePath } from "./path";
import type { Enemy, EnemyKind, Path } from "./types";

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  icon: string;
  desc: string;
  hp: number;
  speed: number;
  reward: number;
  leakDamage: number;
  radius: number;
  flying: boolean;
  freezeImmune: boolean;
  slowImmune?: boolean;
  armor?: number;
  healRadius?: number;
  healPerSec?: number;
  splitInto?: EnemyKind;
  splitCount?: number;
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  grunt: {
    kind: "grunt", name: "小喽啰", icon: "👾",
    desc: "血速中等,最常见的敌人",
    hp: 50, speed: 1.0, reward: 14, leakDamage: 1, radius: 0.28,
    flying: false, freezeImmune: false,
  },
  flyer: {
    kind: "flyer", name: "飞行怪", icon: "🦇",
    desc: "高速低血,直线飞向萝卜。对地炮塔打不到",
    hp: 32, speed: 1.8, reward: 18, leakDamage: 1, radius: 0.26,
    flying: true, freezeImmune: false,
  },
  fatty: {
    kind: "fatty", name: "胖子", icon: "🐷",
    desc: "低速高血,漏过扣 2 血,击杀 +168 金币",
    hp: 420, speed: 0.55, reward: 168, leakDamage: 2, radius: 0.4,
    flying: false, freezeImmune: false,
  },
  boss: {
    kind: "boss", name: "Boss", icon: "👹",
    desc: "每 5 波出现,极高血量,免疫冻结,漏过直接扣 5 血",
    hp: 1600, speed: 0.45, reward: 300, leakDamage: 5, radius: 0.52,
    flying: false, freezeImmune: true,
  },
  runner: {
    kind: "runner", name: "疾风", icon: "💨",
    desc: "极快的冲锋兵,血薄,漏了就来不及补防",
    hp: 28, speed: 2.4, reward: 16, leakDamage: 1, radius: 0.24,
    flying: false, freezeImmune: false,
  },
  armored: {
    kind: "armored", name: "铁甲兵", icon: "🛡️",
    desc: "45% 伤害减免,需要高伤或毒素磨死",
    hp: 90, speed: 0.8, reward: 28, leakDamage: 1, radius: 0.32,
    flying: false, freezeImmune: false, armor: 0.45,
  },
  healer: {
    kind: "healer", name: "巫医", icon: "💚",
    desc: "治疗周围友军。优先集火,否则群怪回不满",
    hp: 70, speed: 0.85, reward: 36, leakDamage: 1, radius: 0.3,
    flying: false, freezeImmune: false, healRadius: 1.6, healPerSec: 14,
  },
  splitter: {
    kind: "splitter", name: "分裂怪", icon: "🫧",
    desc: "死亡后分裂成 2 只虫群,沿原路继续走",
    hp: 55, speed: 0.95, reward: 20, leakDamage: 1, radius: 0.3,
    flying: false, freezeImmune: false, splitInto: "swarmling", splitCount: 2,
  },
  swarmling: {
    kind: "swarmling", name: "虫群", icon: "🐛",
    desc: "又小又密,闪电塔和溅射的最爱",
    hp: 18, speed: 1.35, reward: 6, leakDamage: 1, radius: 0.18,
    flying: false, freezeImmune: false,
  },
  airship: {
    kind: "airship", name: "飞艇", icon: "🎈",
    desc: "空中坦克,直线飞向萝卜。必须用对空火力",
    hp: 220, speed: 0.7, reward: 80, leakDamage: 2, radius: 0.42,
    flying: true, freezeImmune: false, armor: 0.2,
  },
  mage: {
    kind: "mage", name: "法师", icon: "🔮",
    desc: "免疫冻结和减速,只能硬打",
    hp: 85, speed: 1.05, reward: 32, leakDamage: 1, radius: 0.28,
    flying: false, freezeImmune: true, slowImmune: true,
  },
  brute: {
    kind: "brute", name: "蛮锤", icon: "🦍",
    desc: "迷你 Boss:高血、漏过扣 3 血,不定期混入波次",
    hp: 780, speed: 0.5, reward: 210, leakDamage: 3, radius: 0.46,
    flying: false, freezeImmune: false, armor: 0.15,
  },
  shieldman: {
    kind: "shieldman", name: "盾卫", icon: "🛡",
    desc: "65% 伤害减免,普通炮塔几乎打不动",
    hp: 150, speed: 0.7, reward: 44, leakDamage: 2, radius: 0.36,
    flying: false, freezeImmune: false, armor: 0.65,
  },
  ghost: {
    kind: "ghost", name: "幽灵", icon: "👻",
    desc: "高速且免疫一切减速与冻结",
    hp: 60, speed: 1.9, reward: 30, leakDamage: 1, radius: 0.27,
    flying: false, freezeImmune: true, slowImmune: true,
  },
  carrier: {
    kind: "carrier", name: "蜂巢母舰", icon: "🛸",
    desc: "空中母舰,被击落后释放 3 只飞行怪",
    hp: 300, speed: 0.6, reward: 95, leakDamage: 2, radius: 0.46,
    flying: true, freezeImmune: false, armor: 0.25,
    splitInto: "flyer", splitCount: 3,
  },
  golem: {
    kind: "golem", name: "岩石巨人", icon: "🗿",
    desc: "移动极慢但血量巨大,漏过扣 3 血",
    hp: 1200, speed: 0.34, reward: 240, leakDamage: 3, radius: 0.5,
    flying: false, freezeImmune: false, armor: 0.3,
  },
  bomber: {
    kind: "bomber", name: "自爆虫", icon: "💀",
    desc: "冲得飞快,一旦漏过直接扣 3 血",
    hp: 45, speed: 2.1, reward: 26, leakDamage: 3, radius: 0.26,
    flying: false, freezeImmune: false,
  },
  warlord: {
    kind: "warlord", name: "魔将", icon: "😈",
    desc: "终极 Boss:免疫冻结减速、高护甲,漏过扣 8 血",
    hp: 4200, speed: 0.4, reward: 600, leakDamage: 8, radius: 0.56,
    flying: false, freezeImmune: true, slowImmune: true, armor: 0.35,
  },
  ghoul: {
    kind: "ghoul", name: "幽灵猎手", icon: "👹",
    desc: "周期性隐身,隐身时不可被攻击",
    hp: 70, speed: 1.1, reward: 30, leakDamage: 1, radius: 0.28,
    flying: false, freezeImmune: false,
  },
  mimic: {
    kind: "mimic", name: "镜像怪", icon: "🪞",
    desc: "靠近炮塔时复制其攻击力,越强的塔越危险",
    hp: 60, speed: 0.9, reward: 32, leakDamage: 1, radius: 0.3,
    flying: false, freezeImmune: false,
  },
  lava: {
    kind: "lava", name: "熔岩怪", icon: "🌋",
    desc: "死亡后留下火场,持续灼烧路过的敌人",
    hp: 80, speed: 0.75, reward: 38, leakDamage: 1, radius: 0.34,
    flying: false, freezeImmune: false,
  },
  troll: {
    kind: "troll", name: "巨魔", icon: "👹",
    desc: "极速回血,需要爆发伤击杀",
    hp: 200, speed: 0.6, reward: 52, leakDamage: 2, radius: 0.38,
    flying: false, freezeImmune: false,
  },
  warlock: {
    kind: "warlock", name: "术士", icon: "🧙",
    desc: "定期召唤虫群协助,优先集火",
    hp: 90, speed: 0.85, reward: 40, leakDamage: 1, radius: 0.3,
    flying: false, freezeImmune: false,
  },
  dragonling: {
    kind: "dragonling", name: "幼龙", icon: "🐉",
    desc: "飞行高血,必须用对空火力",
    hp: 180, speed: 0.9, reward: 70, leakDamage: 2, radius: 0.4,
    flying: true, freezeImmune: false,
  },
  herald: {
    kind: "herald", name: "末日使者", icon: "😱",
    desc: "Boss前兆,增强周围敌人血量,漏过扣 4 血",
    hp: 300, speed: 0.5, reward: 120, leakDamage: 4, radius: 0.48,
    flying: false, freezeImmune: false, armor: 0.2,
  },
};

export function createEnemy(
  id: number,
  kind: EnemyKind,
  path: Path,
  pathIndex: number,
  hpScale = 1,
): Enemy {
  const def = ENEMY_DEFS[kind];
  const start = samplePath(path, 0);
  const maxHp = Math.max(1, Math.round(def.hp * hpScale));
  return {
    id,
    kind,
    path,
    pathIndex,
    flying: def.flying,
    distance: 0,
    x: start.x,
    y: start.y,
    angle: start.angle,
    hp: maxHp,
    maxHp,
    baseSpeed: def.speed,
    state: "spawn",
    stateTimer: 0,
    slowFactor: 1,
    slowTimer: 0,
    freezeTimer: 0,
    freezeImmune: def.freezeImmune,
    slowImmune: !!def.slowImmune,
    armor: def.armor ?? 0,
    poisonDps: 0,
    poisonTimer: 0,
    healRadius: def.healRadius ?? 0,
    healPerSec: def.healPerSec ?? 0,
    splitInto: def.splitInto ?? null,
    splitCount: def.splitCount ?? 0,
    leakDamage: def.leakDamage,
    reward: def.reward,
    rewardPaid: false,
    radius: def.radius,
    cloaked: false,
    cloakedTimer: 0,
    summonTimer: 0,
    auraTimer: 0,
    trapImmune: 0,
  };
}

export function isTargetable(e: Enemy): boolean {
  if (e.cloaked) return false;
  return e.state === "moving" || e.state === "slowed" || e.state === "frozen";
}

export function isActive(e: Enemy): boolean {
  return e.state === "spawn" || isTargetable(e);
}

export function currentSpeed(e: Enemy): number {
  if (e.state === "frozen") return 0;
  if (e.state === "slowed") return e.baseSpeed * e.slowFactor;
  if (e.state === "moving") return e.baseSpeed;
  return 0;
}

export function applySlow(e: Enemy, factor: number, duration: number): void {
  if (!isTargetable(e) || e.slowImmune) return;
  e.slowFactor = e.slowTimer > 0 ? Math.min(e.slowFactor, factor) : factor;
  e.slowTimer = Math.max(e.slowTimer, duration);
  if (e.state === "moving") e.state = "slowed";
}

export function applyFreeze(e: Enemy, duration: number): boolean {
  if (!isTargetable(e) || e.freezeImmune) return false;
  e.freezeTimer = Math.max(e.freezeTimer, duration);
  e.state = "frozen";
  return true;
}

/** 毒素:取更高 DPS,时长取较大值。 */
export function applyPoison(e: Enemy, dps: number, duration: number): void {
  if (!isTargetable(e) || dps <= 0) return;
  e.poisonDps = e.poisonTimer > 0 ? Math.max(e.poisonDps, dps) : dps;
  e.poisonTimer = Math.max(e.poisonTimer, duration);
}

export function damageEnemy(e: Enemy, amount: number): boolean {
  if (!isTargetable(e) || amount <= 0) return false;
  const reduced = e.armor > 0 ? Math.max(1, amount * (1 - e.armor)) : amount;
  e.hp -= reduced;
  if (e.hp <= 0) {
    e.hp = 0;
    e.state = "dying";
    e.stateTimer = 0;
    e.freezeTimer = 0;
    e.slowTimer = 0;
    e.poisonTimer = 0;
    return true;
  }
  return false;
}

export function updateEnemy(e: Enemy, dt: number): "leaked" | null {
  // 幽灵猎手:周期性隐身(2 秒周期,隐身 1 秒)
  if (e.kind === "ghoul") {
    e.cloakedTimer += dt;
    if (e.cloakedTimer >= 2) e.cloakedTimer -= 2;
    e.cloaked = e.cloakedTimer < 1;
  }
  // 巨魔:极速回血
  if (e.kind === "troll" && e.state !== "dying" && e.state !== "dead") {
    e.hp = Math.min(e.maxHp, e.hp + 6 * dt);
  }

  switch (e.state) {
    case "spawn":
      e.stateTimer += dt;
      if (e.stateTimer >= SPAWN_TIME) {
        e.state = "moving";
        e.stateTimer = 0;
      }
      return null;
    case "dying":
      e.stateTimer += dt;
      if (e.stateTimer >= DYING_TIME) e.state = "dead";
      return null;
    case "dead":
    case "leaked":
      return null;
    default:
      break;
  }

  if (e.freezeTimer > 0) e.freezeTimer = Math.max(0, e.freezeTimer - dt);
  if (e.slowTimer > 0) {
    e.slowTimer = Math.max(0, e.slowTimer - dt);
    if (e.slowTimer === 0) e.slowFactor = 1;
  }
  if (e.poisonTimer > 0) {
    const tick = Math.min(e.poisonTimer, dt);
    e.poisonTimer = Math.max(0, e.poisonTimer - dt);
    if (damageEnemy(e, e.poisonDps * tick)) return null;
    if (e.poisonTimer === 0) e.poisonDps = 0;
  }

  e.state = e.freezeTimer > 0 ? "frozen" : e.slowTimer > 0 ? "slowed" : "moving";

  e.distance += currentSpeed(e) * dt;
  if (e.distance >= e.path.length) {
    e.distance = e.path.length;
    const end = samplePath(e.path, e.distance);
    e.x = end.x;
    e.y = end.y;
    e.state = "leaked";
    return "leaked";
  }
  const p = samplePath(e.path, e.distance);
  e.x = p.x;
  e.y = p.y;
  e.angle = p.angle;
  return null;
}

/** 巫医给周围友军回血(不含自己,不含出生/死亡)。 */
export function applyHeals(enemies: Enemy[], dt: number): void {
  for (const h of enemies) {
    if (!isTargetable(h) || h.healPerSec <= 0 || h.healRadius <= 0) continue;
    const amount = h.healPerSec * dt;
    for (const e of enemies) {
      if (e.id === h.id || !isTargetable(e) || e.hp >= e.maxHp) continue;
      if (Math.hypot(e.x - h.x, e.y - h.y) <= h.healRadius) {
        e.hp = Math.min(e.maxHp, e.hp + amount);
      }
    }
  }
}
