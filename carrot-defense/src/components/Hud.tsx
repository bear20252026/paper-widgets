import { useEffect, useRef, useState } from "react";
import type { LevelDef } from "../game/types";
import { RELICS, SKILL_COST } from "../game/relics";
import { AFFIXES } from "../game/endless";
import { useUI } from "../store";
import { cn } from "../utils/cn";
import { DIFFICULTY_CLS } from "./text";
import { IconBtn } from "./ui";

interface Props {
  level: LevelDef;
  onMenu: () => void;
  onSkill: () => void;
  onSkip?: () => void;
}

/**
 * 生命显示:原来铺 10 个萝卜格,宽度吃掉半条顶栏还会把关卡名挤没。
 * 改成「大数字 + 一条血槽」,宽度恒定,受伤时抖动 + 变红。
 */
function LifeGauge({ lives, max }: { lives: number; max: number }) {
  const [hit, setHit] = useState(false);
  const prev = useRef(lives);
  useEffect(() => {
    if (lives < prev.current) {
      setHit(true);
      const id = window.setTimeout(() => setHit(false), 460);
      prev.current = lives;
      return () => window.clearTimeout(id);
    }
    prev.current = lives;
  }, [lives]);

  const ratio = max > 0 ? lives / max : 0;
  const danger = lives <= 3;

  return (
    <div
      className={cn(
        "panel-plate flex h-11 shrink-0 items-center gap-2 rounded-xl px-2.5",
        hit && "anim-shake",
        danger && "border-rose-500/70",
      )}
      title={`萝卜生命 ${lives}/${max}`}
    >
      <span className={cn("text-xl leading-none", danger && "anim-bump")}>🥕</span>
      <div className="w-[52px]">
        <div className="flex items-baseline gap-0.5 leading-none">
          <span className={cn("dsp text-xl", danger ? "text-rose-300" : "text-cream")}>{lives}</span>
          <span className="dsp text-[11px] text-cream/45">/{max}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/55">
          <div
            className="h-full rounded-full transition-[width,background] duration-300"
            style={{
              width: `${ratio * 100}%`,
              background: danger ? "#ff5252" : ratio > 0.6 ? "#66bb6a" : "#ffca28",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function GoldPlate({ gold }: { gold: number }) {
  const [bump, setBump] = useState(false);
  const prev = useRef(gold);
  useEffect(() => {
    if (gold !== prev.current) {
      prev.current = gold;
      setBump(true);
      const id = window.setTimeout(() => setBump(false), 340);
      return () => window.clearTimeout(id);
    }
  }, [gold]);
  return (
    <div className="panel-plate flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3" title="金币">
      <span className="text-lg leading-none">🪙</span>
      <span className={cn("dsp text-xl leading-none text-amber-300", bump && "anim-bump")}>{gold}</span>
    </div>
  );
}

function WaveTrack({ wave, total, enemies }: { wave: number; total: number; enemies: number }) {
  const pct = total > 0 ? Math.min(wave / total, 1) * 100 : 0;
  return (
    <div className="panel-plate flex h-11 min-w-0 flex-1 flex-col justify-center rounded-xl px-3">
      <div className="flex items-baseline gap-1.5">
        <span className="dsp shrink-0 text-[10px] tracking-[0.2em] text-emerald-200/55">WAVE</span>
        <span className="dsp shrink-0 text-base leading-none text-cream">
          {wave}
          <span className="text-[11px] text-cream/45">/{total}</span>
        </span>
        <span className="ml-auto shrink-0 text-[11px] font-bold text-rose-300">👾{enemies}</span>
      </div>
      <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-black/55">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#ffc53d,#ff7a1a)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
        {Array.from({ length: Math.floor(total / 5) }, (_, i) => (
          <span
            key={i}
            className="absolute top-0 h-full w-px bg-black/50"
            style={{ left: `${(((i + 1) * 5) / total) * 100}%` }}
            title={`第 ${(i + 1) * 5} 波 Boss`}
          />
        ))}
      </div>
    </div>
  );
}

export function Hud({ level, onMenu, onSkill, onSkip }: Props) {
  const hud = useUI((s) => s.hud);
  const paused = useUI((s) => s.paused);
  const speed = useUI((s) => s.speed);
  const muted = useUI((s) => s.muted);
  const togglePause = useUI((s) => s.togglePause);
  const toggleSpeed = useUI((s) => s.toggleSpeed);
  const toggleMute = useUI((s) => s.toggleMute);

  const lives = hud?.lives ?? level.maxLives ?? 10;
  const maxLives = hud?.maxLives ?? level.maxLives ?? 10;
  const gold = hud?.gold ?? level.startGold;
  const energy = hud?.energy ?? 0;
  const ready = energy >= SKILL_COST;
  const relics = hud?.relicIds ?? [];
  const affixId = hud && hud.wave > 0 ? level.waves[hud.wave - 1]?.affix : undefined;
  const affix = affixId ? AFFIXES[affixId] : undefined;

  return (
    <div className="panel-wood flex w-full flex-wrap items-center gap-2 rounded-2xl p-2 sm:flex-nowrap">
      {/* 关卡铭牌:min-w-0 + truncate,名字再长也不会把右边挤出去 */}
      <div className="flex min-w-0 items-center gap-2">
        <IconBtn onClick={onMenu} title="返回选关" aria-label="返回选关" size="md">
          <span className="dsp text-base">←</span>
        </IconBtn>
        <div className="panel-plate flex h-11 min-w-0 items-center gap-2 rounded-xl px-2.5">
          <span className="dsp flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400 text-sm text-amber-950">
            {level.id}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-black leading-tight text-cream">{level.name}</div>
            <span
              className={cn(
                "inline-block rounded border px-1 text-[9px] font-bold leading-tight",
                DIFFICULTY_CLS[level.difficulty],
              )}
            >
              {level.difficulty}
            </span>
          </div>
        </div>
      </div>

      <WaveTrack
        wave={hud?.wave ?? 0}
        total={hud?.totalWaves ?? level.waves.length}
        enemies={hud?.enemies ?? 0}
      />

      <div className="flex shrink-0 items-center gap-2">
        <LifeGauge lives={lives} max={maxLives} />
        <GoldPlate gold={gold} />

        {/* 萝卜冲击波:击杀积攒能量,满槽可放(X) */}
        <button
          type="button"
          onClick={onSkill}
          disabled={!ready}
          title={ready ? "萝卜冲击波就绪 (X)" : `冲击波充能 ${energy}/${SKILL_COST}`}
          aria-label="释放萝卜冲击波"
          className={cn(
            "relative flex h-11 w-11 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border-2 transition",
            ready
              ? "border-cyan-200 bg-gradient-to-b from-cyan-400 to-sky-600 text-white shadow-[0_0_14px_rgba(56,189,248,0.55)]"
              : "border-white/10 bg-black/35 text-cream/70",
          )}
        >
          <span className={cn("text-base leading-none", ready && "anim-bump")}>💥</span>
          <span className="dsp mt-0.5 text-[9px] leading-none">
            {ready ? "X 就绪" : `${energy}%`}
          </span>
          <span
            className="absolute inset-x-0 bottom-0 h-1"
            style={{ width: `${energy}%`, background: ready ? "#e0f7fa" : "#38bdf8" }}
          />
        </button>
      </div>

      {/* 本波词缀(仅无尽模式有):一眼看出这波的特殊规则 */}
      {affix && (
        <span
          title={affix.desc}
          className="panel-plate flex shrink-0 items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-black"
          style={{ color: affix.color }}
        >
          <span className="text-sm">{affix.icon}</span>
          <span>{affix.name}</span>
        </span>
      )}

      {/* 已获得遗物:只看图标与悬浮说明,不堆数值 */}
      {relics.length > 0 && (
        <div className="hidden shrink-0 items-center gap-1 rounded-xl bg-black/30 px-1.5 py-1 lg:flex">
          {relics.map((id) => (
            <span
              key={id}
              title={`${RELICS[id].name}:${RELICS[id].desc}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 text-sm"
              style={{ background: `${RELICS[id].color}22` }}
            >
              {RELICS[id].icon}
            </span>
          ))}
        </div>
      )}

      {/* 控制组:固定在最右,永远完整显示 */}
      <div className="flex shrink-0 items-center gap-1.5">
        <IconBtn
          size="md"
          onClick={togglePause}
          active={paused}
          title={paused ? "继续 (空格)" : "暂停 (空格)"}
          aria-label={paused ? "继续" : "暂停"}
        >
          <span className="text-sm">{paused ? "▶" : "❚❚"}</span>
        </IconBtn>
        {onSkip && (
          <IconBtn size="md" onClick={onSkip} title="跳过本关,直接进入下一关" aria-label="跳过本关">
            <span className="dsp text-sm">⏭</span>
          </IconBtn>
        )}
        <IconBtn size="md" onClick={toggleSpeed} active={speed === 2} title="切换倍速" aria-label="切换倍速">
          <span className="dsp text-sm">{speed}×</span>
        </IconBtn>
        <IconBtn size="md" onClick={toggleMute} title={muted ? "开启声音" : "静音"} aria-label="声音开关">
          <span className="text-sm">{muted ? "🔇" : "🔊"}</span>
        </IconBtn>
      </div>
    </div>
  );
}
