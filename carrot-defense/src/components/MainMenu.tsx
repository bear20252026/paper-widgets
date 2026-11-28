import { useEffect, useMemo, useRef, useState } from "react";
import { unlockAudio } from "../game/audio";
import { RELICS, RELIC_IDS, SKILL_COST } from "../game/relics";
import { AFFIXES, AFFIX_ORDER, ENDLESS_TOTAL_WAVES } from "../game/endless";
import { ENEMY_DEFS } from "../game/enemy";
import { LEVELS } from "../game/levels";
import {
  CHAPTERS,
  CHAPTER_INFO,
  CLASSIC_COUNT,
  type Chapter,
  chapterLevels,
  chapterProgress,
  clearedCount,
  frontierLevelId,
  goldenCount,
  isClassicCleared,
  isLevelUnlocked,
} from "../game/progress";
import { rasterizeCells } from "../game/path";
import { TOWER_DEFS, TOWER_ORDER, buildCost } from "../game/towerDefs";
import {
  AIR_LABEL,
  ROLE_STYLE,
  TOWER_META,
  costTier,
  towerPower,
  type TowerRole,
} from "../game/towerMeta";
import type { LevelDef, TowerKind } from "../game/types";
import { useUI } from "../store";
import { cn } from "../utils/cn";
import { DIFFICULTY_CLS, RATING_INFO, ratingStars } from "./text";
import { Btn, Chip, StatBar, StatDots } from "./ui";

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>(".reveal"));
    if (!targets.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ---------- 背景:天空 / 阳光 / 远山 / 流云 ---------- */
function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#123c55_0%,#1d6b52_38%,#14472c_72%,#0a2415_100%)]" />
      <div className="absolute -right-24 -top-28 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(255,196,86,0.55),rgba(255,170,50,0.12)_45%,transparent_70%)]" />
      <div className="absolute left-[-6rem] top-24 h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,rgba(84,214,255,0.16),transparent_68%)]" />
      <svg
        className="absolute inset-x-0 bottom-0 h-[46vh] w-full"
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M0 190 L120 120 L230 180 L340 96 L470 186 L600 120 L720 190 L850 130 L1000 196 L1000 300 L0 300Z" fill="#1c5c37" opacity="0.85" />
        <path d="M0 236 L150 186 L300 232 L450 178 L620 238 L780 190 L900 236 L1000 210 L1000 300 L0 300Z" fill="#123f26" />
        <path d="M0 268 L1000 250 L1000 300 L0 300Z" fill="#0b2a19" />
      </svg>
      {[
        { top: "8%", dur: "74s", scale: 1, delay: "-10s", op: 0.5 },
        { top: "20%", dur: "104s", scale: 0.7, delay: "-48s", op: 0.35 },
        { top: "33%", dur: "132s", scale: 1.25, delay: "-86s", op: 0.24 },
      ].map((c) => (
        <div
          key={c.top}
          className="absolute"
          style={{
            top: c.top,
            animation: `drift ${c.dur} linear infinite`,
            animationDelay: c.delay,
            opacity: c.op,
            transform: `scale(${c.scale})`,
          }}
        >
          <svg width="190" height="70" viewBox="0 0 190 70" aria-hidden>
            <g fill="#eaf7ff">
              <ellipse cx="52" cy="44" rx="46" ry="22" />
              <ellipse cx="96" cy="32" rx="38" ry="26" />
              <ellipse cx="140" cy="46" rx="42" ry="20" />
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
}

/* ---------- 关卡缩略图 ---------- */
function LevelThumb({ level, className }: { level: LevelDef; className?: string }) {
  const cells = useMemo(() => level.waypoints.flatMap((wp) => rasterizeCells(wp)), [level]);
  const starts = level.waypoints.map((wp) => wp[0]);
  const ends = level.waypoints.map((wp) => wp[wp.length - 1]);
  return (
    <svg
      viewBox={`0 0 ${level.cols} ${level.rows}`}
      className={cn("rounded-lg", className)}
      aria-hidden
    >
      <rect width={level.cols} height={level.rows} fill="#2f7d46" />
      {cells.map(([c, r]) => (
        <rect key={`${c},${r}`} x={c} y={r} width={1.02} height={1.02} fill="#e6cf9c" />
      ))}
      {level.obstacles.map((o) => (
        <rect
          key={`${o.col},${o.row}`}
          x={o.col + 0.16} y={o.row + 0.16} width={0.68} height={0.68} rx={0.18}
          fill={o.kind === "chest" ? "#ffb300" : o.kind === "stump" ? "#8d6e63" : "#9e9e9e"}
        />
      ))}
      {starts.map(([c, r], i) => (
        <circle key={`s${i}`} cx={c + 0.5} cy={r + 0.5} r={0.44} fill="#5e35b1" />
      ))}
      {ends.map(([c, r], i) => (
        <circle
          key={`e${i}`} cx={c + 0.5} cy={r + 0.5} r={0.44}
          fill="#ff8a1f" stroke="#7d3d05" strokeWidth={0.12}
        />
      ))}
    </svg>
  );
}

/* ---------- 选关地图(桌面) ---------- */
/* ---------- 选关:关卡卡片网格(四章通用) ---------- */
function LevelCard({ level, rating, unlocked, isFrontier, onPlay, onSkip }: {
  level: LevelDef;
  rating: number;
  unlocked: boolean;
  isFrontier: boolean;
  onPlay: (id: number) => void;
  onSkip: (id: number) => void;
}) {
  const info = rating > 0 ? RATING_INFO[rating] : null;
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all duration-150",
        unlocked
          ? "border-[#2b1a08] bg-[linear-gradient(170deg,#1f5133,#113021)] hover:-translate-y-1 hover:border-amber-300/70"
          : "border-[#1b2a20] bg-[#15231b]",
      )}
    >
      {isFrontier && unlocked && (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-amber-950">
          进行中
        </span>
      )}

      <button
        type="button"
        disabled={!unlocked}
        onClick={() => onPlay(level.id)}
        className="relative block w-full text-left disabled:cursor-default"
        aria-label={`第 ${level.id} 关 ${level.name}`}
      >
        <LevelThumb level={level} className={cn("w-full", !unlocked && "opacity-25 grayscale")} />
        {!unlocked && (
          <span className="absolute inset-0 flex items-center justify-center text-3xl">🔒</span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1 p-2">
        <div className="flex items-center gap-1.5">
          <span className="dsp flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-400 text-[12px] text-amber-950">
            {level.id}
          </span>
          <span className={cn("truncate text-[13px] font-black", unlocked ? "text-cream" : "text-slate-400")}>
            {level.name}
          </span>
          <Chip className={cn("ml-auto", DIFFICULTY_CLS[level.difficulty])}>{level.difficulty}</Chip>
        </div>

        <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold text-emerald-100/55">
          <span>🌊{level.waves.length}</span>
          <span>🛤{level.waypoints.length}</span>
          <span>🪙{level.startGold}</span>
          <span>{level.cols}×{level.rows}</span>
          <span className={cn("ml-auto", info ? "text-amber-300" : "opacity-40")}>
            {info ? `${info.label} ${ratingStars(rating)}` : "未通关"}
          </span>
        </div>

        {unlocked ? (
          <Btn tone="orange" size="xs" block className="mt-0.5" onClick={() => onPlay(level.id)}>
            ▶ 开始
          </Btn>
        ) : (
          <Btn tone="ghost" size="xs" block className="mt-0.5" onClick={() => onSkip(level.id)}>
            ⏭ 跳到这关
          </Btn>
        )}
      </div>
    </div>
  );
}

function LevelGrid({ chapter, onPlay, onSkip }: {
  chapter: Chapter;
  onPlay: (id: number) => void;
  onSkip: (id: number) => void;
}) {
  const best = useUI((s) => s.best);
  const freeSelect = useUI((s) => s.freeSelect);
  const frontier = frontierLevelId(best);
  const levels = chapterLevels(chapter);
  const prog = chapterProgress(best, chapter);

  return (
    <div className="panel-wood rounded-[24px] p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <div className="kicker">{CHAPTER_INFO[chapter].sub}</div>
          <h2 className="dsp text-xl text-cream sm:text-2xl">{CHAPTER_INFO[chapter].name}</h2>
        </div>
        <div className="text-right">
          <div className="dsp text-2xl leading-none" style={{ color: "var(--gold)" }}>
            {prog.cleared}
            <span className="text-base opacity-55">/{prog.total}</span>
          </div>
          <div className="text-[10px] font-semibold opacity-65">🥕 金萝卜 {prog.gold}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {levels.map((level) => (
          <LevelCard
            key={level.id}
            level={level}
            rating={best[level.id] ?? 0}
            unlocked={isLevelUnlocked(best, level.id, freeSelect)}
            isFrontier={level.id === frontier}
            onPlay={onPlay}
            onSkip={onSkip}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- 图鉴 ---------- */
/** 窄屏:卡片列表(避免表格横向滚动)。 */
/** 炮塔卡:定位色 + 一句话卖点 + 三条强度点,默认不出现任何原始数值。 */
function TowerCodexCard({ kind, detailed }: { kind: TowerKind; detailed: boolean }) {
  const def = TOWER_DEFS[kind];
  const meta = TOWER_META[kind];
  const role = ROLE_STYLE[meta.role];
  const air = AIR_LABEL[meta.air];
  const power = towerPower(kind);
  const cost = buildCost(kind);
  const tier = costTier(kind);
  const top = def.levels[2];
  const isEco = def.attack === "idle";

  return (
    <div
      className="relative overflow-hidden rounded-2xl border-2 border-black/40 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(0,0,0,0.25))] p-3 transition-transform hover:-translate-y-0.5"
      style={{ boxShadow: `inset 0 2px 0 rgba(255,255,255,0.07), 0 0 0 1px ${role.color}22` }}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: role.color }} />

      <div className="flex items-start gap-2.5">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 text-2xl"
          style={{ borderColor: role.color, background: `${role.color}22` }}
        >
          {def.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-black text-cream">{def.name}</span>
            <Chip tone={role.color}>{role.icon} {role.label}</Chip>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-emerald-100/70">{meta.pitch}</p>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={cn(
              "dsp text-lg leading-none",
              tier === "cheap" ? "text-lime-300" : tier === "mid" ? "text-amber-300" : "text-orange-400",
            )}
          >
            {cost}
          </div>
          <div className="text-[9px] font-bold text-emerald-200/45">建造价</div>
        </div>
      </div>

      <div className="mt-2 flex items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {isEco ? (
            <div className="text-[12px] font-bold text-amber-200">
              每 {top.cooldown}s 产出 {top.goldPerTick}🪙(满级)
            </div>
          ) : (
            <>
              <StatDots label="伤害" value={power.damage} color="#ff8a65" />
              <StatDots label="射程" value={power.range} color="#81d4fa" />
              <StatDots label="攻速" value={power.speed} color="#ffd54f" />
              {power.area > 1 && <StatDots label="范围" value={power.area} color="#a5d6a7" />}
            </>
          )}
        </div>
        <Chip className={cn("mb-0.5", air.cls)}>{air.short}</Chip>
      </div>

      {detailed && !isEco && (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-lg bg-black/30 p-2 text-[10px] text-emerald-100/65">
          <span>伤害 {def.levels.map((l) => l.damage).join(" / ")}</span>
          <span>射程 {def.levels.map((l) => l.range).join(" / ")}</span>
          <span>间隔 {def.levels.map((l) => `${l.cooldown}s`).join(" / ")}</span>
          <span>升级价 {def.levels.map((l) => l.cost).join(" / ")}</span>
          <span className="col-span-2 text-amber-200/80">满级 DPS ≈ {power.dps}</span>
        </div>
      )}
    </div>
  );
}

function TowerCodex() {
  const [detailed, setDetailed] = useState(false);
  const [role, setRole] = useState<TowerRole | "all">("all");

  const roles: Array<TowerRole | "all"> = [
    "all", "single", "splash", "pierce", "control", "support", "economy",
  ];
  const shown = TOWER_ORDER.filter((k) => role === "all" || TOWER_META[k].role === role);

  return (
    <section className="reveal panel-dark rounded-[24px] p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="dsp text-2xl text-cream">炮塔图鉴</h2>
        <span className="kicker">Towers</span>
        <Btn
          size="xs"
          tone={detailed ? "gold" : "ghost"}
          className="ml-auto"
          onClick={() => setDetailed((v) => !v)}
        >
          {detailed ? "✓ 详细数值" : "详细数值"}
        </Btn>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {roles.map((r) => (
          <Btn key={r} size="xs" tone={role === r ? "gold" : "ghost"} onClick={() => setRole(r)}>
            {r === "all" ? `全部 ${TOWER_ORDER.length}` : `${ROLE_STYLE[r].icon} ${ROLE_STYLE[r].label}`}
          </Btn>
        ))}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((kind) => (
          <TowerCodexCard key={kind} kind={kind} detailed={detailed} />
        ))}
      </div>
      <p className="mt-2.5 text-[11px] text-emerald-100/45">
        点数为满级时的相对强度(5 点 = 同类最强),顶部色条代表定位。
      </p>
    </section>
  );
}

/* ---------- 敌人图鉴 ---------- */
const THREAT_HP = 1600;
const THREAT_SPEED = 2.4;

function enemyTraits(e: (typeof ENEMY_DEFS)[keyof typeof ENEMY_DEFS]) {
  const out: Array<{ label: string; cls: string }> = [];
  if (e.flying) out.push({ label: "🛩 飞行", cls: "bg-sky-500 text-sky-950" });
  if (e.armor && e.armor > 0) {
    out.push({ label: `🛡 减伤 ${Math.round(e.armor * 100)}%`, cls: "bg-stone-400 text-stone-900" });
  }
  if (e.freezeImmune) out.push({ label: "❄ 免疫冻结", cls: "bg-indigo-400 text-indigo-950" });
  if (e.slowImmune) out.push({ label: "💨 免疫减速", cls: "bg-violet-400 text-violet-950" });
  if (e.healPerSec) out.push({ label: "💚 治疗友军", cls: "bg-emerald-400 text-emerald-950" });
  if (e.splitInto) out.push({ label: "🫧 死后分裂", cls: "bg-teal-400 text-teal-950" });
  if (e.leakDamage >= 3) out.push({ label: `💔 漏过 −${e.leakDamage}`, cls: "bg-rose-500 text-white" });
  return out;
}

function EnemyCodex() {
  return (
    <section className="reveal panel-dark rounded-[24px] p-4">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="dsp text-2xl text-cream">敌人图鉴</h2>
        <span className="kicker">Enemies</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.values(ENEMY_DEFS).map((e) => {
          const traits = enemyTraits(e);
          return (
            <div
              key={e.kind}
              className="flex items-start gap-2.5 rounded-xl border-2 border-black/35 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),transparent)] p-2.5 transition-transform hover:translate-x-0.5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#3b2a4a,#1b1424)] text-xl">
                {e.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-black text-cream">{e.name}</span>
                  <span className="dsp ml-auto shrink-0 text-[11px] text-amber-300">+{e.reward}🪙</span>
                </div>
                <div className="mt-1 flex gap-2">
                  <StatBar label="血量" ratio={Math.min(1, e.hp / THREAT_HP)} color="#ef5350" />
                  <StatBar label="速度" ratio={Math.min(1, e.speed / THREAT_SPEED)} color="#4fc3f7" />
                </div>
                {traits.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {traits.map((t) => (
                      <Chip key={t.label} className={t.cls}>{t.label}</Chip>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 遗物图鉴:新系统的说明书,只用图标 + 一句话,不堆数值。 */
function RelicCodex() {
  return (
    <section className="reveal panel-dark rounded-[24px] p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <h2 className="dsp text-2xl text-cream">遗物图鉴</h2>
        <span className="kicker">Relics</span>
        <span className="ml-auto text-[11px] font-semibold text-emerald-100/60">
          每 {4} 波三选一 · 一局最多 4 件
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {RELIC_IDS.map((id) => {
          const r = RELICS[id];
          return (
            <div
              key={id}
              className="flex items-start gap-2 rounded-xl border-2 border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.2))] p-2.5"
              style={{ boxShadow: `inset 0 0 0 1px ${r.color}30` }}
            >
              <span
                className="dsp flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                style={{ background: `radial-gradient(circle at 35% 30%, ${r.color}, #0b1f14)` }}
              >
                {r.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-black text-cream">{r.name}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-emerald-100/70">{r.desc}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 p-2.5">
        <span className="text-xl">💥</span>
        <div className="min-w-0">
          <div className="text-xs font-black text-cyan-100">萝卜冲击波(本局主动技能)</div>
          <p className="text-[11px] leading-snug text-cyan-100/75">
            击杀与过关积攒能量,满 {SKILL_COST} 点后按 X 释放:冻结全场普通敌人并造成重创,Boss 改为重度减速。
          </p>
        </div>
      </div>
    </section>
  );
}

/** 无尽模式介绍:词缀一览 + 规则,给玩家一个明确的新目标。 */
function EndlessCard() {
  const startEndless = useUI((s) => s.startEndless);
  const endlessBest = useUI((s) => s.endlessBest);
  return (
    <section className="reveal panel-dark rounded-[24px] p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-3">
        <h2 className="dsp text-2xl text-cream">♾ 无尽挑战</h2>
        <span className="kicker">Endless</span>
        <span className="ml-auto text-[11px] font-semibold text-emerald-100/60">
          历史最高:第 {endlessBest} 波
        </span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-emerald-100/80">
        60 波不断升级的敌潮,每张图每局都不一样。从第 3 波起每波带一条<b className="text-amber-200">词缀</b>,
        每 3 波三选一遗物(最多 8 件),失败也会记录你到达的最远波数。
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {AFFIX_ORDER.map((id) => {
          const a = AFFIXES[id];
          return (
            <div
              key={id}
              title={a.desc}
              className="flex flex-col items-center gap-1 rounded-xl border-2 border-white/10 bg-black/25 p-2 text-center"
              style={{ boxShadow: `inset 0 0 0 1px ${a.color}30` }}
            >
              <span className="text-xl">{a.icon}</span>
              <span className="text-[11px] font-black" style={{ color: a.color }}>{a.name}</span>
              <span className="text-[10px] leading-tight text-emerald-100/65">{a.desc}</span>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          unlockAudio();
          startEndless();
        }}
        className="btn btn-green mt-3 w-full py-2.5 text-sm"
      >
        ♾ 开始无尽挑战 · {ENDLESS_TOTAL_WAVES} 波
      </button>
    </section>
  );
}

function HowTo() {
  const rows: Array<[string, string]> = [
    ["点击空地", "弹出炮塔环,点选或按 1–5 建造"],
    ["点击炮塔", "显示射程圈,底部面板可升级 / 出售(返还 70%)"],
    ["点击障碍物", "锁定它,射程内炮塔优先清除,得金币并解锁建造位"],
    ["空格 / Esc", "暂停继续 / 取消选择"],
    ["Q / W / E / R / T / Y / G", "切换炮塔分页(共 7 页),1–5 选当前页"],
    ["X 或 💥", "能量满时放萝卜冲击波:冻结全场并造成重创"],
    ["遗物", "战役每 4 波、无尽每 3 波三选一,决定本局构筑方向"],
    ["无尽挑战", "60 波递增敌潮,每波带词缀,记录你到达的最高波数"],
    ["N / U / S", "提前开下一波(有金币奖励) / 升级 / 出售"],
    ["跳关", "可跳过第一章(25 关),或点未解锁关卡直接跳到那里"],
    ["评价规则", "满血通关 = 金萝卜,6–9 血 = 银,1–5 血 = 铜"],
  ];
  return (
    <section className="reveal panel-dark rounded-[24px] p-4">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="dsp text-2xl text-cream">操作说明</h2>
        <span className="kicker">How to play</span>
      </div>
      <ul className="flex flex-col gap-1.5 text-[13px]">
        {rows.map(([k, v]) => (
          <li key={k} className="flex items-start gap-2.5">
            <span className="dsp mt-px shrink-0 rounded-md border-b-2 border-black/50 bg-[#2c4a37] px-2 py-0.5 text-[11px] text-cream">
              {k}
            </span>
            <span className="text-emerald-100/80">{v}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- 主菜单 ---------- */
export default function MainMenu() {
  const startLevel = useUI((s) => s.startLevel);
  const best = useUI((s) => s.best);
  const muted = useUI((s) => s.muted);
  const toggleMute = useUI((s) => s.toggleMute);
  const skipClassic = useUI((s) => s.skipClassic);
  const skipTo = useUI((s) => s.skipTo);
  const freeSelect = useUI((s) => s.freeSelect);
  const toggleFreeSelect = useUI((s) => s.toggleFreeSelect);
  const startEndless = useUI((s) => s.startEndless);
  const endlessBest = useUI((s) => s.endlessBest);
  const classicDone = isClassicCleared(best);
  const [chapter, setChapter] = useState<Chapter>(
    classicDone ? LEVELS[frontierLevelId(best) - 1].chapter : 1,
  );
  const rootRef = useReveal<HTMLDivElement>();
  const frontier = frontierLevelId(best);

  const play = (id: number) => {
    unlockAudio();
    startLevel(id);
  };

  return (
    <div ref={rootRef} className="min-h-dvh w-full overflow-x-hidden">
      <Backdrop />

      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-3 py-6 sm:px-5 sm:py-9">
        {/* 顶部:左侧标识 + 右侧进度盘 */}
        <header className="reveal in flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-3">
            <span className="anim-bob text-5xl drop-shadow-[0_6px_0_rgba(0,0,0,0.35)] sm:text-6xl">🥕</span>
            <div>
              <div className="kicker mb-1">Carrot Defense · 塔防复刻</div>
              <h1 className="title-carved text-4xl leading-none sm:text-6xl">保卫萝卜</h1>
              <p className="mt-1.5 text-xs font-semibold text-emerald-100/75 sm:text-sm">
{LEVELS.length} 关 · 35 种炮塔 ×3 级 · 25 类敌人 · 四章战役
              </p>
            </div>
          </div>

          <div className="panel-plate rivets flex items-center gap-3 rounded-2xl px-6 py-2.5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/60">进度</div>
              <div className="dsp text-2xl leading-none text-cream">
                {clearedCount(best)}
                <span className="text-sm opacity-55">/{LEVELS.length}</span>
              </div>
            </div>
            <div className="h-9 w-px bg-white/15" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/60">金萝卜</div>
              <div className="dsp text-2xl leading-none text-amber-300">{goldenCount(best)}</div>
            </div>
            <Btn size="md" className="ml-1" onClick={toggleMute} title={muted ? "开启声音" : "静音"}>
              {muted ? "🔇" : "🔊"}
            </Btn>
          </div>
        </header>

        {/* 继续游戏 + 跳关 */}
        <div className="reveal flex flex-wrap items-center gap-2.5">
          <Btn tone="orange" size="lg" onClick={() => play(frontier)}>
            ▶ 继续冒险 · 第 {frontier} 关 {LEVELS[frontier - 1].name}
          </Btn>
          {!classicDone && (
            <Btn
              tone="gold"
              size="md"
              onClick={() => {
                skipClassic();
                setChapter(2);
              }}
            >
              ⏭ 跳过第一章({CLASSIC_COUNT} 关)
            </Btn>
          )}
          <Btn
            size="md"
            tone={freeSelect ? "gold" : "slate"}
            onClick={toggleFreeSelect}
            title="打开后所有关卡都能直接进入"
          >
            {freeSelect ? "✓ 自由选关" : "🔓 自由选关"}
          </Btn>
          <Btn
            size="md"
            tone="green"
            onClick={() => {
              unlockAudio();
              startEndless();
            }}
            title="无尽模式:每波带词缀,每 3 波一件遗物"
          >
            ♾ 无尽挑战
            {endlessBest > 0 && <span className="ml-1.5 dsp text-amber-200">最高 {endlessBest} 波</span>}
          </Btn>
          <span className="text-xs font-semibold text-emerald-100/65">
            {freeSelect ? "已解锁全部 " + LEVELS.length + " 关,随便挑" : LEVELS[frontier - 1].tip}
          </span>
        </div>

        {/* 章节切换 */}
        <div className="flex flex-wrap gap-2">
          {CHAPTERS.map((ch) => {
            const prog = chapterProgress(best, ch);
            return (
              <Btn
                key={ch}
                size="md"
                tone={chapter === ch ? "gold" : "slate"}
                onClick={() => setChapter(ch)}
              >
                {CHAPTER_INFO[ch].name}
                <span className="ml-1 opacity-70">{prog.cleared}/{prog.total}</span>
              </Btn>
            );
          })}
        </div>

        <LevelGrid
          chapter={chapter}
          onPlay={play}
          onSkip={(id) => {
            skipTo(id);
            setChapter(LEVELS[id - 1].chapter);
          }}
        />

        <TowerCodex />
        <RelicCodex />
        <EndlessCard />
        <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          <EnemyCodex />
          <HowTo />
        </div>

        <footer className="pb-2 text-center text-[11px] font-semibold text-emerald-100/50">
          全部图形由 Canvas 矢量绘制,音效由 Web Audio 合成 · 无外部素材 · 进度保存在本机
        </footer>
      </div>
    </div>
  );
}
