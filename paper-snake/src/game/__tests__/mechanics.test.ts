import { describe, expect, it } from "vitest";
import {
  BOOST_MIN_LENGTH,
  canBoost,
  drainLengthForBoost,
  tickBoost,
} from "@/game/boost";
import { baseSpeed, BOOST_SPEED_MULTIPLIER, currentSpeed, followSmoothingFor, segmentCountForLength, turnRateFor } from "@/game/speed";
import { createSnake, growSnake, moveSnake } from "@/game/snake";
import {
  buildBodyHash,
  headHitsBody,
  wallStatus,
  WALL_TOLERANCE,
  SpatialHash,
  angleDelta,
} from "@/game/collision";
import {
  createGameState,
  dropDeathOrbs,
  eatOrbs,
  pullNearbyOrbs,
  spawnAmbientOrbs,
  spawnEnergyTide,
  dropBossLoot,
  ORB_VALUES,
} from "@/game/world";
import { createRng } from "@/game/rng";
import { createOrb } from "@/game/world";
import { buildLeaderboard, playerRank, coinReward, coinBreakdownFor } from "@/game/ranking";
import { calcRpGain, evaluateMissions, getRankTier, streakTitle } from "@/game/progression";
import {
  EMPTY_DAILY,
  SEASON,
  SEASON_TIERS,
  SIGN_IN_REWARDS,
  TITLES,
  buildShareText,
  daysBetween,
  evaluateAchievements,
  evaluateDailyMissions,
  nextSignInDay,
  seasonTierFor,
  seasonTierProgress,
  seasonXpFromRun,
  todayKey,
  todaysMissions,
  unlockedTitles,
} from "@/game/meta";
import { AI_LABELS, decideAi, directionSafety } from "@/game/ai";
import type { Snake } from "@/game/types";
import { GameEngine } from "@/game/engine";
import { SKINS } from "@/game/skins";

function snakeAt(x: number, y: number, angle = 0, length = 80, id = 1): Snake {
  return createSnake({
    id,
    name: "tester",
    x,
    y,
    angle,
    skin: "mint",
    isPlayer: true,
    length,
  });
}

describe("boost: length cost & the hard 30 floor", () => {
  it("drains length while boosting", () => {
    expect(drainLengthForBoost(100, 1)).toBeGreaterThan(0);
    const tick = tickBoost(100, true, 1 / 60, 0);
    expect(tick.boosting).toBe(true);
    expect(tick.length).toBeLessThan(100);
    expect(tick.drained).toBeCloseTo(9 / 60, 5);
  });

  it("refuses boosting at or below 30 length", () => {
    expect(BOOST_MIN_LENGTH).toBe(30);
    expect(canBoost({ alive: true, length: 30 })).toBe(false);
    expect(canBoost({ alive: true, length: 29.9 })).toBe(false);
    expect(canBoost({ alive: true, length: 30.01 })).toBe(true);
    const denied = tickBoost(30, true, 1, 0);
    expect(denied.boosting).toBe(false);
    expect(denied.drained).toBe(0);
    expect(denied.length).toBe(30);
    expect(tickBoost(80, true, 100, 0).length).toBe(BOOST_MIN_LENGTH);
  });

  it("emits dropped light points while boosting", () => {
    const tick = tickBoost(120, true, 0.6, 0);
    expect(tick.drops).toBeGreaterThan(0);
  });

  it("engine only lets the player boost above 30", () => {
    const engine = new GameEngine({ seed: 7, mode: "endless", botCount: 3 });
    engine.player.length = 30;
    engine.setBoost(true);
    expect(engine.player.wantBoost).toBe(false);
    engine.player.length = 120;
    engine.setBoost(true);
    const before = engine.player.length;
    for (let i = 0; i < 20; i++) engine.step(1000 / 60);
    expect(engine.player.length).toBeLessThan(before);
  });
});

describe("collision: bodies, self and forgiving walls", () => {
  it("kills a head that hits another snake's body", () => {
    const a = snakeAt(20, 20, 0);
    const b = snakeAt(300, 300, 0, 120, 2);
    const hash = buildBodyHash([a, b]);
    const target = b.points[12];
    const hit = headHitsBody({ x: target.x, y: target.y }, a.radius, a.id, hash);
    expect(hit).not.toBeNull();
    expect(hit?.snakeId).toBe(b.id);
  });

  it("does NOT die when the head touches its own tail or body", () => {
    const a = snakeAt(500, 500, 0, 140);
    // bend the body so late segments (incl. the very tail) sit right on the head
    a.points[20] = { x: a.x, y: a.y };
    a.points[21] = { x: a.x, y: a.y };
    a.points[a.points.length - 1] = { x: a.x, y: a.y };
    const hash = buildBodyHash([a]);
    expect(headHitsBody({ x: a.x, y: a.y }, a.radius, a.id, hash)).toBeNull();
  });

  it("stays alive while coiling over itself for many steps", () => {
    const engine = new GameEngine({ seed: 777, mode: "endless", botCount: 3 });
    const player = engine.player;
    player.length = 400;
    // hard constant turn => the snake wraps tightly onto its own body
    for (let i = 0; i < 900; i++) {
      engine.setPlayerDirection(((i * 0.26) % (Math.PI * 2)) - Math.PI);
      engine.step(1000 / 60);
      if (engine.player.deathReason === "body" || engine.player.deathReason === "wall") break;
    }
    // it may still be killed by another snake, but never by its own body
    if (!engine.player.alive) {
      expect(engine.player.killerId).not.toBe(engine.player.id);
    }
  });

  it("tolerates the wall inside the grace band and kills deep overshoot", () => {
    const size = { width: 1000, height: 800 };
    expect(wallStatus({ x: 500, y: 400 }, size)).toBe("safe");
    expect(wallStatus({ x: 1000 + WALL_TOLERANCE - 1, y: 400 }, size)).toBe("graze");
    expect(wallStatus({ x: 1000 + WALL_TOLERANCE + 1, y: 400 }, size)).toBe("dead");
    expect(wallStatus({ x: 500, y: -WALL_TOLERANCE / 2 }, size)).toBe("graze");
  });

  it("steers a grazing snake back instead of teleporting it", () => {
    const s = snakeAt(995, 400, 0);
    moveSnake(s, 1000 / 60, 140, { width: 1000, height: 800, softWallMargin: 150 });
    expect(Number.isFinite(s.x)).toBe(true);
    // inward assist turned it, and it moved by normal speed rather than teleporting
    expect(Math.abs(s.angle)).toBeGreaterThan(0.05);
    expect(Math.hypot(s.x - 995, s.y - 400)).toBeLessThan(10);
  });

  it("spatial hash returns nearby candidates only", () => {
    const hash = new SpatialHash<{ x: number; y: number }>(100);
    hash.insert({ x: 10, y: 10 });
    hash.insert({ x: 950, y: 950 });
    expect(hash.queryCircle(10, 10, 40)).toHaveLength(1);
    expect(hash.queryRect(900, 900, 100, 100)).toHaveLength(1);
  });
});

describe("orbs: values, eating, death drops", () => {
  it("values different orbs differently and grows the snake", () => {
    for (const tier of ["small", "large", "corpse"] as const) {
      const state = createGameState({ seed: 1, mode: "endless" });
      const s = snakeAt(500, 500, 0, 60);
      state.snakes = [s];
      state.orbs = [createOrb({ x: s.x, y: s.y, tier, id: 1 })];
      const eaten = eatOrbs(state, s);
      expect(eaten.gained).toBe(ORB_VALUES[tier]);
      growSnake(s, eaten.gained);
      expect(s.length).toBe(60 + ORB_VALUES[tier]);
    }
    expect(ORB_VALUES.corpse).toBeGreaterThan(ORB_VALUES.large);
    expect(ORB_VALUES.large).toBeGreaterThan(ORB_VALUES.small);
  });

  it("explodes a dead snake into corpse > large > small light points", () => {
    const state = createGameState({ seed: 9, mode: "endless", width: 4000, height: 4000 });
    const s = snakeAt(1500, 1500, 0.5, 500);
    const rng = createRng(3);
    const orbs = dropDeathOrbs(state, rng, s);
    expect(orbs.length).toBeGreaterThan(30);
    const tiers = new Set(orbs.map((o) => o.tier));
    expect(tiers.has("corpse")).toBe(true);
    expect(tiers.has("large")).toBe(true);
    expect(tiers.has("small")).toBe(true);
    const corpse = orbs.filter((o) => o.tier === "corpse");
    expect(corpse[0].value).toBeGreaterThan(ORB_VALUES.large);
    expect(s.length).toBeGreaterThan(segmentCountForLength(40));
  });

  it("drops more light for a bigger corpse", () => {
    const rng = createRng(5);
    const state = createGameState({ seed: 2, mode: "endless" });
    const small = dropDeathOrbs(state, rng, snakeAt(200, 200, 0, 40)).length;
    const big = dropDeathOrbs(state, rng, snakeAt(400, 400, 0, 600)).length;
    expect(big).toBeGreaterThan(small);
  });
});

describe("speed–length curve", () => {
  it("is slow for hatchlings, fastest mid-game, slower for giants", () => {
    const hatchling = baseSpeed(30);
    const mid = baseSpeed(170);
    const giant = baseSpeed(1200);
    const huge = baseSpeed(2200);
    expect(hatchling).toBeLessThan(mid);
    expect(giant).toBeLessThan(mid);
    expect(huge).toBeLessThan(giant);
    expect(currentSpeed(200, true)).toBeGreaterThan(currentSpeed(200, false));
    expect(currentSpeed(200, true)).toBeCloseTo(baseSpeed(200) * BOOST_SPEED_MULTIPLIER, 5);
  });
});

describe("seeded world generation", () => {
  it("reproduces orb distribution byte-for-byte with the same seed", () => {
    const build = () => {
      const state = createGameState({ seed: 1234, mode: "endless" });
      const rng = createRng(state.seed);
      spawnAmbientOrbs(state, rng, 40);
      return state.orbs;
    };
    expect(build()).toEqual(build());
  });

  it("produces different fields with different seeds", () => {
    const a = createGameState({ seed: 1, mode: "endless" });
    spawnAmbientOrbs(a, createRng(a.seed), 20);
    const b = createGameState({ seed: 2, mode: "endless" });
    spawnAmbientOrbs(b, createRng(b.seed), 20);
    expect(a.orbs[0].x).not.toBe(b.orbs[0].x);
  });
});

describe("AI legality", () => {
  it("never requests boost at <= 30 length and returns a finite angle", () => {
    const engine = new GameEngine({ seed: 23, mode: "endless", botCount: 3 });
    const bot = engine.state.snakes.find((s) => !s.isPlayer)!;
    bot.length = 30;
    engine.state.orbs = [];
    const hash = buildBodyHash(engine.state.snakes);
    const decision = decideAi(engine.state, bot, hash);
    expect(decision.boost).toBe(false);
    expect(Number.isFinite(decision.targetAngle)).toBe(true);
    expect(Math.abs(decision.targetAngle)).toBeLessThanOrEqual(Math.PI + 1e-6);
  });

  it("senses the wall it is facing and prefers the safe side", () => {
    const state = createGameState({ seed: 4, mode: "endless" });
    const s = snakeAt(state.width - 40, 500, 0, 40);
    const hash = new SpatialHash<import("@/game/collision").BodyNode>(128);
    const outward = directionSafety(s, 0, hash, state);
    const inward = directionSafety(s, Math.PI, hash, state);
    expect(outward).toBeGreaterThan(inward);
    const decision = decideAi(state, s, hash);
    expect(Number.isFinite(decision.targetAngle)).toBe(true);
  });

  it("ignores its own body in the danger sensor", () => {
    const solo = snakeAt(2000, 2000, 0, 300);
    const hash = buildBodyHash([solo]);
    expect(directionSafety(solo, 0, hash, createGameState({ seed: 1, mode: "endless" }))).toBe(0);
  });

  it("AI uses the same body hash collision rules (no phasing)", () => {
    const owner = snakeAt(100, 100, 0, 120);
    const bot = createSnake({
      id: 2,
      name: "bot",
      x: owner.points[10].x,
      y: owner.points[10].y,
      angle: 0,
      skin: "peach",
      isPlayer: false,
      aiProfile: "aggressive",
      length: 60,
    });
    const hash = buildBodyHash([owner, bot]);
    expect(headHitsBody({ x: bot.x, y: bot.y }, bot.radius, bot.id, hash)).not.toBeNull();
  });
});

describe("ranking and rewards", () => {
  it("ranks live snakes by length and reports the player's place", () => {
    const engine = new GameEngine({ seed: 55, mode: "endless", botCount: 11 });
    const board = buildLeaderboard(engine.state.snakes, 10);
    expect(board).toHaveLength(10);
    for (let i = 1; i < board.length; i++) {
      expect(board[i - 1].length).toBeGreaterThanOrEqual(board[i].length);
    }
    expect(playerRank(engine.state.snakes, engine.state.playerId)).toBeGreaterThan(0);
  });

  it("pays more for big, high-ranked, high-kill runs", () => {
    const small = coinReward({ length: 40, rank: 10, kills: 0, mode: "endless", survivedMs: 10000 });
    const big = coinReward({ length: 600, rank: 1, kills: 3, mode: "endless", survivedMs: 120000 });
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThanOrEqual(8);
  });
});

describe("attract mode (home screen demo)", () => {
  it("drives the player snake automatically and never ends the run", () => {
    let ended = false;
    const engine = new GameEngine({
      seed: 4242,
      mode: "timed",
      autopilot: true,
      botCount: 6,
      onEnd: () => {
        ended = true;
      },
    });
    const startX = engine.player.x;
    const startY = engine.player.y;
    // manual input must be ignored while the demo drives itself
    engine.setPlayerDirection(0);
    engine.setBoost(true);
    expect(engine.player.wantBoost).toBe(false);
    for (let i = 0; i < 2400; i++) engine.step(1000 / 60);
    expect(ended).toBe(false);
    expect(engine.state.status).toBe("playing");
    expect(engine.player.alive).toBe(true);
    expect(Math.hypot(engine.player.x - startX, engine.player.y - startY)).toBeGreaterThan(50);
  });
});

describe("engine simulation", () => {
  it("runs fixed steps without NaN and keeps a live HUD", () => {
    const engine = new GameEngine({ seed: 99, mode: "endless", skin: "grape" });
    for (let i = 0; i < 180; i++) engine.step(1000 / 60);
    const hud = engine.getHud();
    expect(engine.state.timeMs).toBeGreaterThan(2990);
    expect(hud.leaderboard.length).toBeGreaterThanOrEqual(3);
    expect(hud.total).toBeGreaterThanOrEqual(10);
    expect(Number.isFinite(engine.player.x)).toBe(true);
    expect(Number.isFinite(engine.player.y)).toBe(true);
    expect(engine.state.orbs.length).toBeGreaterThan(400);
    expect(["playing", "dead"]).toContain(engine.state.status);
  });

  it("forward input moves the snake in that direction", () => {
    const engine = new GameEngine({ seed: 12, mode: "endless" });
    engine.setPlayerDirection(0);
    const startX = engine.player.x;
    for (let i = 0; i < 30; i++) engine.step(1000 / 60);
    expect(engine.player.x).toBeGreaterThan(startX + 20);
  });

  it("timed mode ends at the limit and produces a result", () => {
    let result: unknown = null;
    const engine = new GameEngine({
      seed: 31,
      mode: "timed",
      onEnd: (r) => {
        result = r;
      },
    });
    for (let i = 0; i < 40; i++) engine.step(5000);
    expect(engine.state.endReason).toBeDefined();
    expect(result).not.toBeNull();
  });
});

describe("long-run invariants & content", () => {
  it("keeps simulation invariants over an extended run", () => {
    let ended: import("@/game/types").RunResult | null = null;
    const engine = new GameEngine({
      seed: 2026,
      mode: "endless",
      botCount: 12,
      skin: "grid",
      onEnd: (r) => {
        ended = r;
      },
    });
    let t = 0;
    for (let i = 0; i < 3600; i++) {
      t += 1000 / 60;
      engine.setPlayerDirection(Math.sin(t / 900) * 1.6 + Math.cos(t / 2400));
      engine.setBoost(i % 240 < 60);
      engine.step(1000 / 60);
      if (engine.state.status !== "playing") break;
      for (const snake of engine.state.snakes) {
        expect(Number.isFinite(snake.x)).toBe(true);
        expect(Number.isFinite(snake.y)).toBe(true);
        expect(Number.isFinite(snake.angle)).toBe(true);
        expect(snake.length).toBeGreaterThanOrEqual(30);
        // boosting can drain exactly onto the 30 floor during a step, but may
        // never push a snake below it, and a snake under 30 can never boost
        if (snake.boosting) expect(snake.length).toBeGreaterThanOrEqual(30);
        expect(snake.x).toBeGreaterThan(-200);
        expect(snake.x).toBeLessThan(engine.state.width + 200);
        expect(snake.y).toBeGreaterThan(-200);
        expect(snake.y).toBeLessThan(engine.state.height + 200);
      }
      expect(engine.state.killFeed.length).toBeLessThanOrEqual(4);
      expect(engine.state.orbs.length).toBeLessThan(900);
    }
    const board = engine.getHud().leaderboard;
    expect(board.length).toBeLessThanOrEqual(10);
    if (engine.state.status !== "playing") {
      expect(ended).not.toBeNull();
    }
  });

  it("ships 24 visual-only skins: grid camouflage + 16 distinct structural forms", () => {
    expect(SKINS).toHaveLength(24);
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
    expect(SKINS.filter((s) => s.free).length).toBeGreaterThanOrEqual(3);
    const structural = SKINS.filter((s) => s.form !== "classic");
    expect(structural).toHaveLength(16);
    expect(new Set(structural.map((s) => s.form)).size).toBe(16);
    expect(structural.some((s) => s.free)).toBe(true);
    expect(SKINS.some((s) => s.id === "grid" && s.pattern === "checker")).toBe(true);
    for (const skin of SKINS) {
      expect(skin.price).toBeGreaterThanOrEqual(0);
      // skins carry presentation fields only — no speed / boost / hitbox modifiers
      expect(Object.keys(skin)).not.toContain("speed");
      expect(Object.keys(skin)).not.toContain("boost");
      expect(skin.palette).toHaveLength(3);
    }
  });

  it("distributes death orbs along the entire fallen snake contour and pulls nearby orbs magnetically", () => {
    const state = createGameState({ seed: 11, mode: "endless" });
    const giant = snakeAt(2200, 2200, 0, 500, 9);
    const orbs = dropDeathOrbs(state, createRng(11), giant);
    const xs = orbs.map((o) => o.x);
    const spanX = Math.max(...xs) - Math.min(...xs);
    // A 500m horizontal snake spans hundreds of world pixels, not a single head clump
    expect(spanX).toBeGreaterThan(250);

    // Magnetic suction pulls nearby orbs toward the head while leaving distant orbs untouched
    const pullState = createGameState({ seed: 12, mode: "endless" });
    const eater = snakeAt(1000, 1000, 0, 80, 1);
    const nearOrb = createOrb({ x: 1036, y: 1000, tier: "small", id: 1 });
    const farOrb = createOrb({ x: 1500, y: 1500, tier: "small", id: 2 });
    pullState.snakes = [eater];
    pullState.orbs = [nearOrb, farOrb];
    pullNearbyOrbs(pullState, 16.67);
    expect(nearOrb.x).toBeLessThan(1036);
    expect(farOrb.x).toBe(1500);
  });

  it("calculates rank tiers, RP gains, bounty missions, and itemized coin breakdowns", () => {
    expect(getRankTier(0).id).toBe("bronze");
    expect(getRankTier(320).id).toBe("gold");
    expect(getRankTier(2100).id).toBe("king");

    const rp1 = calcRpGain({ length: 80, rank: 8, kills: 0, bestStreak: 0, survivedMs: 15000 });
    const rpKing = calcRpGain({ length: 650, rank: 1, kills: 4, bestStreak: 3, survivedMs: 120000 });
    expect(rpKing).toBeGreaterThan(rp1);

    const missions = evaluateMissions(
      {
        bestLength: 260,
        totalRuns: 2,
        totalKills: 4,
        bestStreak: 2,
        kingCount: 1,
        ownedSkinsCount: 3,
      },
      ["len_200"]
    );
    expect(missions.find((m) => m.id === "len_200")?.claimed).toBe(true);
    expect(missions.find((m) => m.id === "len_200")?.claimable).toBe(false);
    expect(missions.find((m) => m.id === "king_1")?.claimable).toBe(true);
    expect(missions.find((m) => m.id === "len_550")?.completed).toBe(false);

    const bd = coinBreakdownFor({
      length: 400,
      rank: 1,
      kills: 3,
      bestStreak: 2,
      mode: "timed",
      survivedMs: 180000,
      isRecord: true,
    });
    expect(bd.total).toBe(bd.base + bd.rankBonus + bd.killBonus + bd.streakBonus + bd.recordBonus);
    expect(streakTitle(3).label).toContain("三杀");
    expect(streakTitle(5).label).toContain("超神");
  });
});

describe("commercial meta systems", () => {
  it("rotates exactly three deterministic daily missions with distinct metrics", () => {
    const a = todaysMissions("2026-05-01");
    const b = todaysMissions("2026-05-01");
    const c = todaysMissions("2026-05-02");
    expect(a).toHaveLength(3);
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
    expect(new Set(a.map((m) => m.metric)).size).toBe(3);
    expect(a.map((m) => m.id).join(",")).not.toBe(c.map((m) => m.id).join(","));

    const status = evaluateDailyMissions("2026-05-01", { ...EMPTY_DAILY, orbs: 999, kills: 1 }, [a[0].id]);
    expect(status.some((m) => m.claimed)).toBe(true);
    expect(status.every((m) => m.progress <= m.target)).toBe(true);
  });

  it("uses an escalating, forgiving 7-day sign-in ladder", () => {
    expect(SIGN_IN_REWARDS).toHaveLength(7);
    expect(SIGN_IN_REWARDS[6].coins).toBeGreaterThan(SIGN_IN_REWARDS[0].coins);
    expect(SIGN_IN_REWARDS[6].gems).toBeGreaterThan(0);
    expect(nextSignInDay(0)).toBe(1);
    expect(nextSignInDay(6)).toBe(7);
    expect(nextSignInDay(7)).toBe(1);
    expect(todayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(daysBetween("2026-01-05", "2026-01-08")).toBe(3);
  });

  it("evaluates achievements and unlocks honour titles from career metrics", () => {
    const metrics = {
      bestLength: 1200,
      totalRuns: 12,
      totalKills: 14,
      bestStreak: 3,
      kingCount: 2,
      ownedSkinsCount: 7,
      dailyStreak: 8,
      seasonTier: 20,
      totalOrbs: 900,
    };
    const list = evaluateAchievements(metrics, ["first_run"]);
    expect(list.find((a) => a.id === "first_run")?.claimed).toBe(true);
    expect(list.find((a) => a.id === "king_3")?.claimable).toBe(false);
    expect(list.find((a) => a.id === "length_1000")?.claimable).toBe(true);
    expect(list.filter((a) => a.claimable).length).toBeGreaterThan(4);

    const titles = unlockedTitles(metrics).map((t) => t.id);
    expect(titles).toContain("hunter");
    expect(titles).toContain("giant");
    expect(titles).toContain("king");
    expect(titles).toContain("champion");
    expect(TITLES.every((t) => t.unlock(metrics) || !t.unlock(metrics))).toBe(true);
  });

  it("awards season XP, clamps the 20-tier pass and progresses the track", () => {
    const low = seasonXpFromRun({ length: 40, kills: 0, rank: 9, mode: "endless" });
    const high = seasonXpFromRun({ length: 900, kills: 5, rank: 1, mode: "timed" });
    expect(high).toBeGreaterThan(low);
    expect(SEASON_TIERS).toHaveLength(SEASON.maxTier);
    expect(seasonTierFor(0)).toBe(0);
    expect(seasonTierFor(SEASON.xpPerTier)).toBe(1);
    expect(seasonTierFor(999_999)).toBe(SEASON.maxTier);
    const progress = seasonTierProgress(SEASON.xpPerTier + 60);
    expect(progress.tier).toBe(1);
    expect(progress.into).toBe(60);
    expect(progress.pct).toBeGreaterThan(0);
    expect(SEASON_TIERS[19].premium.gems).toBeGreaterThan(0);
  });

  it("builds a shareable match summary mentioning self-tail safety", () => {
    const text = buildShareText({
      playerName: "测试蛇",
      length: 428,
      rank: 2,
      kills: 3,
      bestStreak: 2,
      mode: "timed",
      tierName: "黄金灵蛇",
      titleName: "围猎者",
    });
    expect(text).toContain("测试蛇");
    expect(text).toContain("428");
    expect(text).toContain("2 连杀");
    expect(text).toContain("尾巴不会死");
  });

  it("reports orbs eaten and peak length in the final run result", () => {
    let result: import("@/game/types").RunResult | null = null;
    const engine = new GameEngine({
      seed: 616,
      mode: "timed",
      botCount: 4,
      onEnd: (r) => {
        result = r;
      },
    });
    for (let i = 0; i < 40; i++) engine.step(5000);
    expect(result).not.toBeNull();
    expect(result!.orbsEaten).toBeGreaterThanOrEqual(0);
    expect(result!.maxLength).toBeGreaterThanOrEqual(60);
    expect(result!.coinBreakdown.total).toBe(result!.coins);
  });
});

describe("feel: turn curve, follow smoothing and hit stop", () => {
  it("decays turn rate smoothly with size and speed instead of a hard clamp", () => {
    const small = turnRateFor(true, 60);
    const mid = turnRateFor(true, 500);
    const giant = turnRateFor(true, 2000);
    expect(small).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(giant);
    expect(giant).toBeGreaterThan(0);
    // no sudden stair-steps: neighbouring sizes differ only slightly
    expect(Math.abs(turnRateFor(true, 1000) - turnRateFor(true, 1010))).toBeLessThan(0.05);
    // boosting (higher speed) widens the arc
    expect(turnRateFor(true, 500, 240)).toBeLessThan(turnRateFor(true, 500, 120));
    expect(followSmoothingFor(60)).toBeGreaterThanOrEqual(0.55);
    expect(followSmoothingFor(2400)).toBeLessThanOrEqual(0.9);
    expect(followSmoothingFor(2400)).toBeGreaterThan(followSmoothingFor(60));
  });

  it("keeps the spine smooth while a long snake turns hard", () => {
    const engine = new GameEngine({ seed: 12, mode: "endless", botCount: 3 });
    engine.player.length = 700;
    for (let i = 0; i < 120; i++) {
      engine.setPlayerDirection(((i * 0.12) % (Math.PI * 2)) - Math.PI);
      engine.step(1000 / 60);
    }
    const pts = engine.player.points;
    let maxBend = 0;
    for (let i = 2; i < pts.length; i++) {
      const a1 = Math.atan2(pts[i - 1].y - pts[i - 2].y, pts[i - 1].x - pts[i - 2].x);
      const a2 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      maxBend = Math.max(maxBend, Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1))));
    }
    expect(maxBend).toBeLessThan(Math.PI / 2);
  });

  it("freezes the simulation for a few frames after a player kill/death", () => {
    const engine = new GameEngine({ seed: 31, mode: "endless", botCount: 3 });
    const player = engine.player;
    const bot = engine.state.snakes.find((s) => !s.isPlayer)!;
    player.spawnGrace = 0;
    bot.spawnGrace = 0;
    // park a lethal body segment right on the player's nose
    bot.x = player.x + 2;
    bot.y = player.y;
    bot.points[0] = { x: bot.x, y: bot.y };
    for (let i = 1; i < bot.points.length; i++) {
      bot.points[i] = { x: bot.x + i * 8, y: bot.y };
    }
    engine.step(1000 / 60);
    expect(player.alive).toBe(false);
    expect(engine.hitStopRemainingMs).toBeGreaterThan(0);
    const frozenAt = engine.state.timeMs;
    engine.step(1000 / 60);
    expect(engine.state.timeMs).toBe(frozenAt);
  });
});

describe("AI behaviour layers", () => {
  const baseState = () => createGameState({ seed: 21, mode: "endless" });
  const playerNear = (state: ReturnType<typeof createGameState>, length: number) => {
    const p = createSnake({ id: 99, name: "p", x: 1500, y: 1500, angle: 0, skin: "mint", isPlayer: true, length });
    p.spawnGrace = 0;
    state.snakes.push(p);
    return p;
  };

  it("maps each behaviour layer to a label", () => {
    expect(AI_LABELS.aggressive).toContain("圈地");
    expect(AI_LABELS.evasive).toContain("避让");
    expect(AI_LABELS.lure).toContain("诱导");
    expect(AI_LABELS.farmer).toContain("发育");
  });

  it("timid snakes steer away from bigger snakes and prefer loose orbs", () => {
    const state = baseState();
    const player = playerNear(state, 600);
    const timid = createSnake({
      id: 2, name: "t", x: player.x + 140, y: player.y, angle: 0, skin: "peach",
      isPlayer: false, aiProfile: "evasive", length: 90,
    });
    timid.spawnGrace = 0;
    state.snakes.push(timid);
    state.orbs = [createOrb({ x: player.x + 320, y: player.y + 40, tier: "corpse", id: 1 })];
    const d = decideAi(state, timid, buildBodyHash(state.snakes));
    expect(d.boost).toBe(false);
    const away = Math.atan2(timid.y - player.y, timid.x - player.x);
    expect(Math.cos(angleDelta(d.targetAngle, away))).toBeGreaterThan(0);
  });

  it("aggressive snakes commit to an encirclement and boost when they out-size the player", () => {
    const state = baseState();
    const player = playerNear(state, 80);
    const hunter = createSnake({
      id: 3, name: "h", x: player.x + 220, y: player.y + 40, angle: Math.PI,
      skin: "grape", isPlayer: false, aiProfile: "aggressive", length: 320,
    });
    hunter.spawnGrace = 0;
    state.snakes.push(hunter);
    const d = decideAi(state, hunter, buildBodyHash(state.snakes));
    expect(d.boost).toBe(true);
    expect(Number.isFinite(d.targetAngle)).toBe(true);
    // it should not simply dive head-on into the player
    const direct = Math.atan2(player.y - hunter.y, player.x - hunter.x);
    expect(Math.cos(angleDelta(d.targetAngle, direct))).toBeLessThan(0.995);
    // ...but it should still be hunting in the player's neighbourhood
    expect(d.safety).toBeLessThan(20);
  });

  it("lure snakes boost to cut the player's nose only at close range", () => {
    const state = baseState();
    const player = playerNear(state, 200);
    const lurker = createSnake({
      id: 4, name: "l", x: player.x + 180, y: player.y - 60, angle: Math.PI,
      skin: "caramel", isPlayer: false, aiProfile: "lure", length: 260,
    });
    lurker.spawnGrace = 0;
    state.snakes.push(lurker);
    const close = decideAi(state, lurker, buildBodyHash(state.snakes));
    expect(close.boost).toBe(true);
    const cut = Math.atan2(player.y - lurker.y, player.x + 105 - lurker.x);
    expect(Math.cos(angleDelta(close.targetAngle, cut))).toBeGreaterThan(0);
    // far away it stops committing to the cut
    lurker.x = player.x + 900;
    const far = decideAi(state, lurker, buildBodyHash(state.snakes));
    expect(far.boost).toBe(false);
  });

  it("never boosts a lure snake below the 30m floor", () => {
    const state = baseState();
    const player = playerNear(state, 100);
    const lurker = createSnake({
      id: 5, name: "l2", x: player.x + 100, y: player.y, angle: 0, skin: "caramel",
      isPlayer: false, aiProfile: "lure", length: 30,
    });
    lurker.spawnGrace = 0;
    state.snakes.push(lurker);
    expect(decideAi(state, lurker, buildBodyHash(state.snakes)).boost).toBe(false);
  });
});

describe("public objectives: boss python and energy tide", () => {
  it("spawns a golden boss on schedule and reports it on the HUD", () => {
    const events: string[] = [];
    const engine = new GameEngine({
      seed: 77,
      mode: "endless",
      botCount: 4,
      objectiveTiming: { firstBossMs: 200, firstTideMs: 999_999 },
      onEvent: (e) => events.push(e.type),
    });
    for (let i = 0; i < 18; i++) engine.step(1000 / 60);
    const hud = engine.getHud();
    expect(events).toContain("bossSpawn");
    expect(hud.boss).not.toBeNull();
    expect(hud.boss!.length).toBeGreaterThan(300);
    expect(hud.radar.snakes.some((s) => s.isBoss)).toBe(true);
  });

  it("opens an energy tide cluster and marks it on the radar", () => {
    const engine = new GameEngine({
      seed: 78,
      mode: "endless",
      botCount: 4,
      objectiveTiming: { firstBossMs: 999_999, firstTideMs: 200 },
    });
    const before = engine.state.orbs.length;
    for (let i = 0; i < 22; i++) engine.step(1000 / 60);
    const hud = engine.getHud();
    expect(engine.state.orbs.length).toBeGreaterThan(before);
    expect(hud.tideActive).toBe(true);
    expect(hud.radar.hotspots.some((h) => h.kind === "tide")).toBe(true);
  });

  it("drops 28 golden pieces for a fallen boss python", () => {
    const state = createGameState({ seed: 88, mode: "endless" });
    const loot = dropBossLoot(state, createRng(3), 1200, 1200);
    expect(loot).toHaveLength(28);
    expect(loot.every((o) => o.tier === "corpse" || o.tier === "large")).toBe(true);
    const tide = spawnEnergyTide(state, createRng(4));
    expect(tide.count).toBeGreaterThanOrEqual(34);
    expect(state.orbs.length).toBeGreaterThan(60);
  });
});
