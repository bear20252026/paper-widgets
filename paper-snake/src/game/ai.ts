import type { AiProfile, GameState, Orb, Snake } from "./types";
import { angleDelta, normalizeAngle, type SpatialHash, type BodyNode } from "./collision";
import { baseSpeed, BOOST_MIN_LENGTH } from "./speed";

export interface AiDecision {
  targetAngle: number;
  boost: boolean;
  /** higher = safer, exposed for tests */
  safety: number;
}

export const AI_LABELS: Record<AiProfile, string> = {
  aggressive: "激进圈地",
  farmer: "稳健发育",
  evasive: "胆小避让",
  lure: "近身诱导",
};

export const AI_NAMES = [
  "小青团",
  "糖醋小蛇",
  "纸飞机",
  "贪吃小队长",
  "薄荷汽水",
  "奶盖不加冰",
  "闪电泡芙",
  "咕噜咕噜",
  "春日部防卫",
  "海绵不吸水",
  "芋泥波波",
  "把光点交出来",
  "草丛观察员",
  "S 形走位",
  "别追我啦",
  "一圈又一圈",
  "光点收藏家",
  "慢慢长大",
];

/** English opponent nicknames, used when the UI language is English. */
export const AI_NAMES_EN = [
  "Green Dumpling",
  "Sweet & Sour",
  "Paper Plane",
  "Snack Captain",
  "Mint Fizz",
  "No Ice Please",
  "Zap Puff",
  "Gurgle",
  "Backyard Guard",
  "Dry Sponge",
  "Taro Boba",
  "Hand Over Orbs",
  "Bush Watcher",
  "S-Turn Pro",
  "Stop Chasing Me",
  "Round & Round",
  "Orb Collector",
  "Slow Grower",
];

export function aiNamesFor(lang: "zh" | "en"): string[] {
  return lang === "en" ? AI_NAMES_EN : AI_NAMES;
}

const CANDIDATES = [0, 0.22, -0.22, 0.45, -0.45, 0.72, -0.72, 1.0, -1.0, 1.3, -1.3, 1.65, -1.65, 2.1, -2.1];

function nearestOrbs(state: GameState, snake: Snake, radius: number, limit: number): Orb[] {
  const result: { orb: Orb; d: number }[] = [];
  const r2 = radius * radius;
  for (const orb of state.orbs) {
    const dx = orb.x - snake.x;
    const dy = orb.y - snake.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < r2) result.push({ orb, d: Math.sqrt(d2) });
  }
  result.sort((a, b) => a.d - b.d);
  return result.slice(0, limit).map((r) => r.orb);
}

function pickPlayerTarget(state: GameState): Snake | null {
  const p = state.snakes.find((s) => s.isPlayer && s.alive);
  return p ?? null;
}

/** Safety of a candidate heading, sampled along a forward ray. */
export function directionSafety(
  snake: Snake,
  angle: number,
  bodyHash: SpatialHash<BodyNode>,
  state: Pick<GameState, "width" | "height">
): number {
  const look = 84 + baseSpeed(snake.length) * 0.55;
  let danger = 0;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  for (const t of [0.4, 0.72, 1]) {
    const px = snake.x + dirX * look * t;
    const py = snake.y + dirY * look * t;
    const nodes = bodyHash.queryCircle(px, py, snake.radius + 48);
    for (const node of nodes) {
      // Own body is never lethal, so the AI may coil over itself freely.
      if (node.snakeId === snake.id) continue;
      const dist = Math.hypot(node.x - px, node.y - py);
      const limit = snake.radius + node.r + 15;
      if (dist < limit) danger += (1 - dist / limit) * (1.5 - t) * 7;
    }
    if (px < 70 || py < 70 || px > state.width - 70 || py > state.height - 70) {
      danger += 4 * (1.5 - t);
    }
  }
  return danger;
}

/**
 * AI steering. Called at a lower frequency than the logic step (every 3 steps).
 * It shares the exact same collision and boost rules as the player.
 */
export function decideAi(
  state: GameState,
  snake: Snake,
  bodyHash: SpatialHash<BodyNode>
): AiDecision {
  const profile: AiProfile = snake.aiProfile ?? "farmer";
  const player = pickPlayerTarget(state);
  const huntablePlayer = !!player && snake.length > player.length * 1.08 + 10;
  const playerDist = player ? Math.hypot(player.x - snake.x, player.y - snake.y) : Infinity;

  // ── behaviour layers ──────────────────────────────────────────────────────
  // evasive  : flee anything bigger, vacuum loose orbs
  // farmer   : value-per-distance orb farming, safe boosts
  // aggressive: when longer than the player, trace a big enclosing ring
  // lure     : linger nearby, then boost across the player's path at close range
  const orbLimit = profile === "farmer" || profile === "evasive" ? 8 : 5;
  const orbits = nearestOrbs(state, snake, profile === "evasive" ? 900 : 760, orbLimit);
  const orbs = orbits;
  const playerAhead = player
    ? {
        x: player.x + Math.cos(player.angle) * 190,
        y: player.y + Math.sin(player.angle) * 190,
        dist: playerDist,
      }
    : null;

  const dangerWeight =
    profile === "evasive" ? 2.35 : profile === "aggressive" ? 1.2 : profile === "lure" ? 1.5 : 1.35;
  const foodWeight = profile === "farmer" ? 1.3 : profile === "evasive" ? 0.85 : profile === "lure" ? 0.45 : 0.68;
  const playerWeight = profile === "aggressive" ? 1.1 : profile === "lure" ? 0.9 : 0.1;
  // Aggressive snakes commit to an encirclement when they clearly out-size the player.
  const encircle = profile === "aggressive" && huntablePlayer && playerDist < 760;
  const encircleRadius = Math.max(180, Math.min(420, playerDist + 120));
  const tangent = player ? Math.atan2(snake.y - player.y, snake.x - player.x) + Math.PI / 2 : 0;
  const goal =
    encircle && player
      ? {
          x: player.x + Math.cos(tangent) * encircleRadius,
          y: player.y + Math.sin(tangent) * encircleRadius,
        }
      : null;
  // Close-range lure: the moment the player is near, cut across their nose.
  const lureNow = profile === "lure" && !!player && playerDist < 300;
  const cutPoint =
    player && lureNow
      ? {
          x: player.x + Math.cos(player.angle) * 105,
          y: player.y + Math.sin(player.angle) * 105,
        }
      : null;

  // Pick-ups are worth a detour for everyone (same rules as the player).
  let power: { x: number; y: number; d: number } | null = null;
  for (const p of state.powerUps ?? []) {
    const d = Math.hypot(p.x - snake.x, p.y - snake.y);
    if (d < 620 && (!power || d < power.d)) power = { x: p.x, y: p.y, d };
  }

  let bestAngle = snake.angle;
  let bestScore = -Infinity;
  let bestSafety = -Infinity;

  for (const offset of CANDIDATES) {
    const angle = normalizeAngle(snake.angle + offset);
    const danger = directionSafety(snake, angle, bodyHash, state);
    // continuity is comfortable / life-like
    let score = -danger * dangerWeight - Math.abs(offset) * 0.55;

    for (const orb of orbs) {
      const dist = Math.hypot(orb.x - snake.x, orb.y - snake.y) || 1;
      const orbAngle = Math.atan2(orb.y - snake.y, orb.x - snake.x);
      const align = Math.cos(angleDelta(angle, orbAngle));
      if (align > 0.2) {
        const tierBoost = orb.tier === "corpse" ? 1.6 : orb.tier === "large" ? 1.25 : 1;
        score += (align * tierBoost * Math.min(8, orb.value)) / (1 + dist / 210) * foodWeight;
      }
    }

    if (power) {
      const pa = Math.atan2(power.y - snake.y, power.x - snake.x);
      const align = Math.cos(angleDelta(angle, pa));
      if (align > 0) score += (align * 6.5) / (1 + power.d / 260);
    }
    if (goal) {
      const ga = Math.atan2(goal.y - snake.y, goal.x - snake.x);
      score += Math.cos(angleDelta(angle, ga)) * 3.4;
      // keep the ring closed: prefer the tangent rather than diving at the player
      const inward = Math.atan2(player!.y - snake.y, player!.x - snake.x);
      score -= Math.cos(angleDelta(angle, inward)) * 1.3;
    }
    if (cutPoint) {
      const ca = Math.atan2(cutPoint.y - snake.y, cutPoint.x - snake.x);
      score += Math.cos(angleDelta(angle, ca)) * 3.2;
    }
    if (playerAhead && playerAhead.dist < 1100) {
      const tAngle = Math.atan2(playerAhead.y - snake.y, playerAhead.x - snake.x);
      const align = Math.cos(angleDelta(angle, tAngle));
      if (align > 0) score += align * (1100 - playerAhead.dist) * 0.004 * playerWeight;
      // cut-off: aim slightly to the front of the player's heading
      if (profile === "aggressive" && player && playerAhead.dist < 420 && !goal) {
        const cut = Math.atan2(
          player.y + Math.sin(player.angle) * 130 - snake.y,
          player.x + Math.cos(player.angle) * 130 - snake.x
        );
        score += Math.cos(angleDelta(angle, cut)) * 1.9;
      }
      // timid snakes flee anything noticeably bigger, and keep their distance
      if (profile === "evasive" && player) {
        const bigger = player.length > snake.length + 10;
        const away = Math.atan2(snake.y - player.y, snake.x - player.x);
        score += Math.cos(angleDelta(angle, away)) * (bigger ? 2.4 : 0.35);
      }
      // scavengers sweep in on freshly dropped feasts
      if (profile === "evasive" || profile === "farmer") {
        const feast = orbs.find((o) => o.tier === "corpse");
        if (feast) {
          const fa = Math.atan2(feast.y - snake.y, feast.x - snake.x);
          score += Math.cos(angleDelta(angle, fa)) * 1.15;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
      bestSafety = danger;
    }
  }

  let boost = false;
  if (snake.length > BOOST_MIN_LENGTH) {
    if (profile === "aggressive") {
      boost = huntablePlayer && playerDist < 560;
    } else if (profile === "evasive") {
      // flight boost only when a bigger snake is breathing down its neck
      boost = !!player && player.length > snake.length + 20 && playerDist < 300 && bestSafety > 3;
    } else if (profile === "lure") {
      boost = lureNow && bestSafety < 8;
    } else {
      boost = bestSafety < 1.2 && snake.length > 110 && orbs.length > 0;
    }
  }
  // Never emit an illegal boost request.
  if (snake.length <= BOOST_MIN_LENGTH) boost = false;

  return { targetAngle: bestAngle, boost, safety: bestSafety };
}
