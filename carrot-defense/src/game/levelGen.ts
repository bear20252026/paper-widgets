import type { Difficulty, ObstacleSpawn, SpawnGroup, WaveDef } from "./types";

/**
 * 关卡生成器 + 波次生成器。
 * 目标:在保证「路径合法、障碍不压路、可建造格充足」的前提下,
 * 批量产出 100 关,并让难度随关卡序号单调上升。
 * 全部使用确定性伪随机(种子由关卡序号决定),同一关每次生成结果一致。
 */

export interface WaveProfile {
  total: number;
  hpGrowth: number;
  flyerFrom: number;
  fattyFrom: number;
  swarm: number;
  gruntBase?: number;
  countScale?: number;
  bossGrowth?: number;
  variety?: boolean;
  elite?: boolean;
  /** 第四章:混入末日系敌人 */
  doom?: boolean;
}

export type WP = Array<[number, number]>;

export interface LevelDraft {
  name: string;
  desc: string;
  difficulty: Difficulty;
  tip: string;
  cols?: number;
  rows?: number;
  waypoints: WP[];
  obstacles: ObstacleSpawn[];
  startGold: number;
  firstWaveDelay: number;
  waves: WaveProfile;
}

/* ---------------- 确定性随机 ---------------- */

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 把一格宽的路径光栅化成集合,用于障碍避让。 */
export function pathCells(waypoints: WP[]): Set<string> {
  const set = new Set<string>();
  for (const wp of waypoints) {
    for (let i = 1; i < wp.length; i++) {
      const [c0, r0] = wp[i - 1];
      const [c1, r1] = wp[i];
      if (c0 !== c1 && r0 !== r1) continue;
      const dc = Math.sign(c1 - c0);
      const dr = Math.sign(r1 - r0);
      let c = c0;
      let r = r0;
      set.add(`${c},${r}`);
      while (c !== c1 || r !== r1) {
        c += dc;
        r += dr;
        set.add(`${c},${r}`);
      }
    }
    if (wp.length === 1) set.add(`${wp[0][0]},${wp[0][1]}`);
  }
  return set;
}

/* ---------------- 路径模板 ---------------- */

/** 蛇形往返:在 [rowTop, rowBottom] 之间来回,终点在 endCol。 */
function serpentine(
  cols: number, rowTop: number, rowBottom: number, endCol: number, startLeft = true,
): WP {
  const pts: WP = [];
  let left = startLeft;
  const rows: number[] = [];
  for (let r = rowTop; r <= rowBottom; r += 2) rows.push(r);
  rows.forEach((r, i) => {
    const c0 = left ? 0 : cols - 1;
    const c1 = left ? cols - 1 : 0;
    if (i === 0) pts.push([c0, r]);
    pts.push([c1, r]);
    if (i < rows.length - 1) pts.push([c1, rows[i + 1]]);
    left = !left;
  });
  const [lc, lr] = pts[pts.length - 1];
  if (lc !== endCol) pts.push([endCol, lr]);
  return pts;
}

/**
 * 生成一条路径。template 0..4,全部保证水平/垂直且在地图内。
 */
function buildPath(
  template: number, cols: number, rows: number, lane: number, laneCount: number,
): WP {
  const safe = (n: number, max: number) => Math.min(Math.max(n, 0), max - 1);
  switch (template) {
    // 单条长蛇
    case 0:
      return serpentine(cols, 1, safe(rows - 2, rows), safe(Math.floor(cols / 2), cols), true);

    // 宽间距蛇形
    case 1:
      return serpentine(cols, 0, safe(rows - 1, rows), safe(cols - 2, cols), false);

    // 双路:上下两条,在右下汇合
    case 2: {
      const mid = Math.floor(rows / 2);
      if (lane === 0) {
        return serpentine(cols, 0, safe(mid - 1, rows), safe(cols - 2, cols), true);
      }
      return serpentine(cols, safe(mid, rows), safe(rows - 1, rows), safe(cols - 2, cols), false);
    }

    // 三路:每条路在自己的一条横带上蛇形,长度有保证
    case 3: {
      const band = Math.max(1, Math.floor((rows - 1) / 3));
      const top = safe(lane * band, rows);
      const bottom = safe(Math.min(top + band, rows - 1), rows);
      const endCol = safe(lane === 1 ? Math.floor(cols / 2) : lane === 0 ? cols - 2 : 1, cols);
      return serpentine(cols, top, bottom === top ? top + 1 : bottom, endCol, lane % 2 === 0);
    }

    // 外圈 + 内折:长路径
    case 4: {
      const right = cols - 1;
      const bottom = rows - 1;
      const innerTop = safe(2, rows);
      const innerRight = safe(cols - 3, cols);
      const innerBottom = safe(bottom - 1, rows);
      const centerR = safe(Math.floor(rows / 2), rows);
      const centerC = safe(Math.floor(cols / 2), cols);
      const pts: WP = [
        [0, 0], [right, 0], [right, bottom === 0 ? 0 : bottom],
        [0, bottom], [0, innerTop], [innerRight, innerTop],
        [innerRight, innerBottom], [1, innerBottom], [1, centerR], [centerC, centerR],
      ];
      return pts.filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]);
    }

    // 镜像双侧向内
    default: {
      const right = cols - 1;
      const yTop = safe(lane === 0 ? 1 : Math.floor(rows / 2), rows);
      const yEnd = safe(Math.floor(rows / 2) + 1, rows);
      const mid = safe(Math.floor(cols / 2), cols);
      const fromLeft = lane === 0;
      const pts2: WP = [
        [fromLeft ? 0 : right, yTop],
        [fromLeft ? right : 0, yTop],
        [fromLeft ? right : 0, yEnd],
        [mid, yEnd],
      ];
      return pts2.filter((p, i, arr) => i === 0 || p[0] !== arr[i - 1][0] || p[1] !== arr[i - 1][1]);
    }
  }
  void laneCount;
}

/* ---------------- 障碍物布置 ---------------- */

function placeObstacles(
  cols: number, rows: number, waypoints: WP[], seed: number, density: number,
): ObstacleSpawn[] {
  const blocked = pathCells(waypoints);
  const rand = lcg(seed * 7919 + 13);
  const out: ObstacleSpawn[] = [];
  const used = new Set<string>();
  const kinds: Array<ObstacleSpawn["kind"]> = ["rock", "stump", "chest"];
  const want = Math.round(cols * rows * density);
  let attempts = 0;
  while (out.length < want && attempts < want * 40) {
    attempts++;
    const c = Math.floor(rand() * cols);
    const r = Math.floor(rand() * rows);
    const key = `${c},${r}`;
    if (blocked.has(key) || used.has(key)) continue;
    // 与已放置障碍保持至少 1 格间隔,避免堵死建造区
    let tooClose = false;
    for (const o of out) {
      if (Math.abs(o.col - c) <= 0 && Math.abs(o.row - r) <= 0) tooClose = true;
      if (Math.abs(o.col - c) <= 0 && Math.abs(o.row - r) <= 0) break;
    }
    if (tooClose) continue;
    used.add(key);
    out.push({ col: c, row: r, kind: kinds[Math.floor(rand() * kinds.length)] });
  }
  return out;
}

/* ---------------- 波次生成(全关卡共用) ---------------- */

export function generateWaves(p: WaveProfile): WaveDef[] {
  const waves: WaveDef[] = [];
  const scale = p.countScale ?? 1;
  const bossGrowth = p.bossGrowth ?? 0.6;
  for (let n = 1; n <= p.total; n++) {
    const hp = 1 + (n - 1) * p.hpGrowth;
    const groups: SpawnGroup[] = [];
    const extras: SpawnGroup[] = [];

    const gruntRaw = (p.gruntBase ?? 5) + Math.floor((n - 1) * 0.7) + (n >= 11 ? p.swarm : 0);
    const grunts = Math.max(5, Math.min(18, Math.round(gruntRaw * scale)));
    groups.push({
      kind: "grunt",
      count: grunts,
      interval: Math.max(0.7, 1.9 - n * 0.05),
      compress: 0.985,
      hpScale: hp,
    });

    if (n >= p.flyerFrom && (n - p.flyerFrom) % 2 === 0) {
      extras.push({
        kind: "flyer",
        count: Math.max(2, Math.round((3 + Math.floor((n - p.flyerFrom) / 2)) * scale)),
        interval: 1.0, compress: 0.97, delay: 4, hpScale: hp,
      });
    }
    if (n >= p.fattyFrom && n % 5 !== 0 && (n - p.fattyFrom) % 3 === 0) {
      extras.push({
        kind: "fatty",
        count: Math.max(1, Math.round((1 + Math.floor((n - p.fattyFrom) / 6)) * scale)),
        interval: 3.2, delay: 2, hpScale: hp,
      });
    }
    if (n % 5 === 0) {
      groups.push({
        kind: "boss",
        count: n >= 20 && n !== p.total ? 2 : 1,
        interval: 7, delay: 3,
        hpScale: 1 + (n / 5 - 1) * bossGrowth,
      });
    }

    if (p.variety) {
      if (n >= 6 && n % 2 === 0) {
        extras.push({ kind: "runner", count: Math.max(2, Math.round(2 * scale)), interval: 1.0, delay: 1.5, hpScale: hp });
      }
      if (n >= 9 && n % 3 === 0) {
        extras.push({ kind: "swarmling", count: Math.max(3, Math.round(4 * scale)), interval: 0.5, delay: 3, hpScale: hp });
      }
      if (n >= 11 && n % 4 === 3) {
        extras.push({ kind: "armored", count: 1, interval: 2.4, delay: 2.5, hpScale: hp });
      }
      if (n >= 12 && n % 5 === 2) {
        extras.push({ kind: "healer", count: 1, interval: 1, delay: 3, hpScale: hp });
      }
      if (n >= 10 && n % 4 === 2) {
        extras.push({ kind: "splitter", count: 1, interval: 2.6, delay: 2, hpScale: hp });
      }
      if (n >= 12 && n % 4 === 0) {
        extras.push({ kind: "airship", count: 1, interval: 3.5, delay: 5, hpScale: hp });
      }
      if (n >= 13 && n % 5 === 3) {
        extras.push({ kind: "mage", count: 1, interval: 2, delay: 4, hpScale: hp });
      }
      if (n >= 16 && n % 5 === 1) {
        extras.push({ kind: "brute", count: 1, interval: 4, delay: 6, hpScale: hp });
      }
    }

    if (p.elite) {
      if (n >= 8 && n % 3 === 2) {
        extras.push({ kind: "bomber", count: Math.max(1, Math.round(2 * scale)), interval: 0.9, delay: 3, hpScale: hp });
      }
      if (n >= 10 && n % 4 === 2) {
        extras.push({ kind: "shieldman", count: 1, interval: 2.2, delay: 3, hpScale: hp });
      }
      if (n >= 12 && n % 4 === 0) {
        extras.push({ kind: "ghost", count: Math.max(1, Math.round(2 * scale)), interval: 1.1, delay: 4, hpScale: hp });
      }
      if (n >= 14 && n % 5 === 4) {
        extras.push({ kind: "carrier", count: 1, interval: 4, delay: 5, hpScale: hp });
      }
      if (n >= 16 && n % 5 === 1) {
        extras.push({ kind: "golem", count: 1, interval: 5, delay: 6, hpScale: hp });
      }
      if (n === p.total && n % 5 !== 0) {
        extras.push({ kind: "warlord", count: 1, interval: 8, delay: 8, hpScale: 1 + p.total * 0.02 });
      }
    }

    if (p.doom) {
      if (n >= 4 && n % 3 === 1) {
        extras.push({ kind: "ghoul", count: Math.max(1, Math.round(2 * scale)), interval: 0.9, delay: 2, hpScale: hp });
      }
      if (n >= 6 && n % 4 === 2) {
        extras.push({ kind: "mimic", count: 1, interval: 2, delay: 3, hpScale: hp });
      }
      if (n >= 7 && n % 3 === 2) {
        extras.push({ kind: "lava", count: Math.max(1, Math.round(2 * scale)), interval: 1.2, delay: 2.5, hpScale: hp });
      }
      if (n >= 9 && n % 4 === 1) {
        extras.push({ kind: "troll", count: 1, interval: 3, delay: 3, hpScale: hp });
      }
      if (n >= 10 && n % 5 === 0 && n % 2 === 0) {
        extras.push({ kind: "warlock", count: 1, interval: 3, delay: 4, hpScale: hp });
      }
      if (n >= 11 && n % 4 === 3) {
        extras.push({ kind: "dragonling", count: 1, interval: 3, delay: 5, hpScale: hp });
      }
      if (n >= 12 && n % 6 === 0) {
        extras.push({ kind: "herald", count: 1, interval: 4, delay: 6, hpScale: hp });
      }
      // 终波不要与双 Boss 叠加:只在非 Boss 波追加魔将
      if (n === p.total && n % 5 !== 0) {
        extras.push({ kind: "warlord", count: 1, interval: 7, delay: 9, hpScale: 1.25 });
      }
    }

    // 同屏敌种上限:前期 2 / 中期 3 / 后期 4,保留更强的类型
    const cap = n <= 8 ? 2 : n <= 15 ? 3 : 4;
    if (extras.length > cap) extras.splice(0, extras.length - cap);
    groups.push(...extras);

    waves.push({ groups });
  }
  return waves;
}

/* ---------------- 关卡生成 ---------------- */

const NAME_PREFIX = [
  "青草", "溪谷", "林间", "晨光", "风语", "苔原", "石桥", "木桩", "牧野", "花田",
  "双生", "回声", "虫巢", "铁壁", "潮汐", "迷雾", "萤火", "落叶", "沙丘", "冰湖",
  "深渊", "熔岩", "断裂", "枯骨", "黑塔", "灰烬", "霜牙", "雷鸣", "影沼", "龙脊",
  "末日", "虚空", "猩红", "终焉", "永夜", "破碎", "炼狱", "沉沦", "凋零", "天罚",
];
const NAME_SUFFIX = [
  "小径", "峡谷", "丛林", "走廊", "营地", "关隘", "渡口", "高地", "废墟", "平原",
  "回廊", "要塞", "谷口", "之环", "阶梯", "祭坛", "深坑", "前哨", "断桥", "之眼",
];

const TIPS = [
  "拐角处建塔可以覆盖两段路,收益最高。",
  "对空塔至少留两座,飞行怪会抄直线。",
  "先点障碍物锁定,射程内炮塔会自动清障。",
  "方尖碑贴着主力输出摆,加成能叠加。",
  "减速塔放长直道,能把敌人留在火力网里。",
  "别把钱全砸在一座塔上,数量同样重要。",
  "前期清宝箱换金币,中期再转输出。",
  "Boss 波前把升级点满,单发伤害更关键。",
  "最后一波可能是双 Boss,留好爆发。",
  "满血通关才是金萝卜,漏一只胖子就没了。",
];

const DIFFS: Difficulty[] = ["普通", "普通", "困难", "困难", "困难", "噩梦", "噩梦", "地狱"];

/** 生成某一章的补充关卡。 */
export function generateChapterLevels(
  chapter: number,
  count: number,
  idStart: number,
): LevelDraft[] {
  const out: LevelDraft[] = [];
  for (let i = 0; i < count; i++) {
    const globalIdx = idStart + i; // 0-based 全局序号
    const t = Math.min(1, globalIdx / 99); // 0..1 难度系数
    const seed = 1000 + globalIdx * 37;

    // 地图尺寸随进度增大
    const cols = chapter === 1 ? 12 + (globalIdx > 10 ? 1 : 0)
      : chapter === 2 ? 13 + (globalIdx > 30 ? 1 : 0)
      : chapter === 3 ? 14 + (globalIdx > 55 ? 1 : 0)
      : 15 + (globalIdx > 80 ? 1 : 0);
    const rows = cols <= 12 ? 8 : cols === 13 ? 9 : cols === 14 ? 9 : 10;

    const template = (chapter + i) % 6;
    const multi = template === 2 || template === 3;
    const laneCount = template === 3 ? 3 : template === 2 ? 2 : 1;
    const waypoints: WP[] = [];
    if (laneCount > 1) {
      // 多路:地图纵向切成互不重叠的横带,每条带内蛇形,最终汇入同一个萝卜
      const band = Math.max(2, Math.floor(rows / laneCount));
      const endCol = cols - 2;
      for (let lane = 0; lane < laneCount; lane++) {
        const top = Math.min(lane * band, rows - 2);
        const bottom = Math.min(top + band - 1, rows - 1);
        // 必须从左侧进场:若从右侧出生,终点萝卜就在旁边一格,敌人会瞬间漏过
        waypoints.push(serpentine(cols, top, Math.max(top + 1, bottom), endCol, true));
      }
    } else {
      let wp = buildPath(template === 5 ? 5 : template, cols, rows, 0, 1);
      let len = 0;
      for (let i = 1; i < wp.length; i++) {
        len += Math.abs(wp[i][0] - wp[i - 1][0]) + Math.abs(wp[i][1] - wp[i - 1][1]);
      }
      // 单路:路径过短会让敌人穿过火力网过快,用整幅蛇形兜底
      const minLen = Math.max(30, Math.round((cols + rows) * 1.7));
      if (len < minLen) wp = serpentine(cols, 1, rows - 2, Math.floor(cols / 2), true);
      waypoints.push(wp);
    }

    const density = 0.08 + t * 0.03;
    let obstacles = placeObstacles(cols, rows, waypoints, seed, density);
    // 可建造格下限:路径 + 障碍不能把地图塞满(否则玩家无塔可建)
    const pathCount = pathCells(waypoints).size;
    while (obstacles.length > 0 && cols * rows - pathCount - obstacles.length < 34) {
      obstacles = obstacles.slice(0, -1);
    }

    const difficulty = chapter === 1 && i < 4 ? "简单" : DIFFS[Math.min(DIFFS.length - 1, Math.floor(t * 8))];

    out.push({
      name: `${NAME_PREFIX[(chapter - 1) * 10 + (i % 10)]}${NAME_SUFFIX[(i * 3 + chapter) % NAME_SUFFIX.length]}`,
      desc: `第 ${idStart + i + 1} 关:${multi ? `${laneCount} 条路径同时压境` : "单路径防线"},地图 ${cols}×${rows}。`,
      difficulty,
      tip: TIPS[(i + chapter) % TIPS.length],
      cols,
      rows,
      waypoints,
      obstacles,
      startGold: Math.round(350 + t * 120 + (laneCount - 1) * 270),
      firstWaveDelay: 12,
      waves: {
        total: 16 + Math.round(t * 9),
        hpGrowth: 0.07 + t * 0.26,
        flyerFrom: Math.max(3, 6 - Math.floor(t * 3)),
        fattyFrom: 6,
        swarm: 2 + Math.round(t * 3),
        countScale: laneCount === 3 ? 0.4 : laneCount === 2 ? 0.52 : 0.86,
        bossGrowth: 0.5 + t * 1.0,
        variety: chapter >= 2,
        elite: chapter >= 3,
        doom: chapter >= 4,
      },
    });
  }
  return out;
}
