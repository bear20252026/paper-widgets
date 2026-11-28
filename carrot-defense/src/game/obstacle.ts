import type { Obstacle, ObstacleKind, ObstacleSpawn } from "./types";

export interface ObstacleDef {
  name: string;
  hp: number;
  reward: number;
}

/** 障碍物:清除后所在格子变为可建造,并奖励金币(≥50)。 */
export const OBSTACLE_DEFS: Record<ObstacleKind, ObstacleDef> = {
  rock: { name: "岩石", hp: 80, reward: 50 },
  stump: { name: "树桩", hp: 130, reward: 70 },
  chest: { name: "宝箱", hp: 220, reward: 120 },
};

export function createObstacle(id: number, spawn: ObstacleSpawn): Obstacle {
  const def = OBSTACLE_DEFS[spawn.kind];
  return {
    id,
    kind: spawn.kind,
    col: spawn.col,
    row: spawn.row,
    x: spawn.col + 0.5,
    y: spawn.row + 0.5,
    hp: def.hp,
    maxHp: def.hp,
    reward: def.reward,
  };
}

/** 造成伤害,返回是否被摧毁。 */
export function damageObstacle(o: Obstacle, amount: number): boolean {
  if (o.hp <= 0 || amount <= 0) return false;
  o.hp = Math.max(0, o.hp - amount);
  return o.hp === 0;
}

export function obstacleAt(
  obstacles: Obstacle[],
  col: number,
  row: number,
): Obstacle | undefined {
  return obstacles.find((o) => o.col === col && o.row === row && o.hp > 0);
}
