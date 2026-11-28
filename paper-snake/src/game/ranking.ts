import type { CoinBreakdown, GameMode, LeaderRow, Snake } from "./types";

export function buildLeaderboard(snakes: Snake[], limit = 10): LeaderRow[] {
  const sorted = snakes
    .slice()
    .sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return b.length - a.length;
    });
  const kingId = sorted[0]?.alive ? sorted[0].id : -1;
  return sorted.slice(0, limit).map((s) => ({
    id: s.id,
    name: s.name,
    length: Math.round(s.length),
    skin: s.skin,
    kills: s.kills,
    isPlayer: s.isPlayer,
    alive: s.alive,
    isKing: s.id === kingId,
  }));
}

export function currentKing(snakes: Snake[]): Snake | null {
  let best: Snake | null = null;
  for (const s of snakes) {
    if (!s.alive) continue;
    if (!best || s.length > best.length) best = s;
  }
  return best;
}

export function playerRank(snakes: Snake[], playerId: number): number {
  const sorted = snakes.slice().sort((a, b) => b.length - a.length);
  const idx = sorted.findIndex((s) => s.id === playerId);
  return idx < 0 ? snakes.length : idx + 1;
}

export function rankOf(snakes: Snake[], snakeId: number): number {
  const sorted = snakes.slice().sort((a, b) => b.length - a.length);
  const idx = sorted.findIndex((s) => s.id === snakeId);
  return idx < 0 ? snakes.length + 1 : idx + 1;
}

export function coinReward(opts: {
  length: number;
  rank: number;
  kills: number;
  mode: GameMode;
  survivedMs: number;
}): number {
  const base = Math.floor(opts.length * 0.55);
  const rankBonus = Math.max(0, 11 - opts.rank) * 8;
  const killBonus = opts.kills * 22;
  const survival = Math.floor(opts.survivedMs / 10000) * 2;
  const modeBonus = opts.mode === "timed" ? 25 : 10;
  return Math.max(8, base + rankBonus + killBonus + survival + modeBonus);
}

export function coinBreakdownFor(opts: {
  length: number;
  rank: number;
  kills: number;
  bestStreak: number;
  mode: GameMode;
  survivedMs: number;
  isRecord: boolean;
}): CoinBreakdown {
  const survival = Math.floor(opts.survivedMs / 10000) * 2;
  const modeBonus = opts.mode === "timed" ? 25 : 10;
  const base = Math.max(8, Math.floor(opts.length * 0.55) + survival + modeBonus);
  const rankBonus = Math.max(0, 11 - opts.rank) * 8 + (opts.rank === 1 ? 25 : 0);
  const killBonus = opts.kills * 22;
  const streakBonus = opts.bestStreak >= 2 ? (opts.bestStreak - 1) * 15 : 0;
  const recordBonus = opts.isRecord ? 30 : 0;
  const total = base + rankBonus + killBonus + streakBonus + recordBonus;
  return { base, rankBonus, killBonus, streakBonus, recordBonus, total };
}
