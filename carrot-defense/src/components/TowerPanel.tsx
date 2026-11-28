import { sellValue, upgradeCostOf } from "../game/economy";
import { ENEMY_DEFS } from "../game/enemy";
import type { GameSession } from "../game/session";
import { PRIORITY_INFO } from "../game/tower";
import { AIR_LABEL, ROLE_STYLE, TOWER_META, towerPower } from "../game/towerMeta";
import { TOWER_DEFS, TOWER_PAGES, buildCost, getLevelStats } from "../game/towerDefs";
import type { Tower, TowerKind } from "../game/types";
import { useUI } from "../store";
import { cn } from "../utils/cn";
import { Btn, Chip, StatDots } from "./ui";

/** 分页快捷键(Q/W/E/R/T/Y/G 共 7 页)。 */
export const PAGE_KEYS = ["Q", "W", "E", "R", "T", "Y", "G"] as const;

interface Props {
  session: GameSession;
  onPickKind: (kind: TowerKind) => void;
  onUpgrade: (towerId: number) => void;
  onSell: (towerId: number) => void;
  onNextWave: () => void;
  onCyclePriority: (towerId: number) => void;
  className?: string;
}

/* ---------- 选中炮塔:检视面板 ---------- */

/** 升级收益:只说"伤害 +58%"这种人话,不堆 12→18 的原始数字。 */
function gainPct(cur: number, next: number, lowerIsBetter = false): number {
  if (cur <= 0) return 0;
  return Math.round(((lowerIsBetter ? cur / next : next / cur) - 1) * 100);
}

function Inspector({ tower, onUpgrade, onSell, onCyclePriority }: {
  tower: Tower;
  onUpgrade: (id: number) => void;
  onSell: (id: number) => void;
  onCyclePriority: (id: number) => void;
}) {
  const gold = useUI((s) => s.hud?.gold ?? 0);
  const def = TOWER_DEFS[tower.kind];
  const meta = TOWER_META[tower.kind];
  const role = ROLE_STYLE[meta.role];
  const air = AIR_LABEL[meta.air];
  const cur = getLevelStats(tower.kind, tower.level);
  const upCost = upgradeCostOf(tower);
  const maxed = upCost === null;
  const next = maxed ? undefined : getLevelStats(tower.kind, tower.level + 1);
  const canUp = !maxed && gold >= (upCost ?? 0);
  const isEconomy = def.attack === "idle";
  const prio = PRIORITY_INFO[tower.priority];

  return (
    <div className="flex w-full flex-col gap-2">
      {/* 身份 + 等级 */}
      <div className="flex items-center gap-2.5 rounded-xl border-2 border-black/35 bg-black/25 p-2">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 text-2xl"
          style={{ borderColor: role.color, background: `${role.color}26` }}
        >
          {def.icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-black text-cream">{def.name}</span>
            <span className="dsp rounded bg-amber-400 px-1.5 text-[11px] text-amber-950">
              {maxed ? "MAX" : `LV${tower.level}`}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Chip tone={role.color}>{role.icon} {role.label}</Chip>
            <Chip className={air.cls}>{air.short}</Chip>
          </div>
        </div>
      </div>

      {/* 能力:三颗点 + 升级收益,不显示原始数值 */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 rounded-xl border-2 border-black/35 bg-black/25 px-3 py-2">
        {isEconomy ? (
          <div className="text-[12px] font-bold text-cream/85">
            每 {cur.cooldown}s 产出
            <span className="dsp ml-1 text-amber-300">{cur.goldPerTick}🪙</span>
            {next && (
              <span className="ml-2 text-lime-300">升级后 {next.goldPerTick}🪙</span>
            )}
          </div>
        ) : (
          <>
            <StatDots label="伤害" value={lvlDots(tower, "damage")} color="#ff8a65" />
            <StatDots label="射程" value={lvlDots(tower, "range")} color="#81d4fa" />
            <StatDots label="攻速" value={lvlDots(tower, "speed")} color="#ffd54f" />
          </>
        )}
        {next && !isEconomy && (
          <div className="mt-0.5 flex flex-wrap gap-x-2.5 text-[11px] font-bold text-lime-300">
            <span>升级 ⬆ 伤害 +{gainPct(cur.damage, next.damage)}%</span>
            <span>攻速 +{gainPct(cur.cooldown, next.cooldown, true)}%</span>
          </div>
        )}
      </div>

      {/* 操作 */}
      <div className="flex shrink-0 gap-2">
        {!isEconomy && (
          <Btn
            tone="ghost"
            size="md"
            className="flex-1 flex-col !gap-0 leading-tight"
            onClick={() => onCyclePriority(tower.id)}
            title={`攻击优先级:${prio.hint}(点击切换)`}
          >
            <span className="text-[10px] opacity-60">优先</span>
            <span className="text-[12px]">{prio.icon} {prio.label}</span>
          </Btn>
        )}
        <Btn
          tone={maxed ? "gold" : "green"}
          size="md"
          disabled={maxed || !canUp}
          className="flex-[1.3] flex-col !gap-0 leading-tight"
          onClick={() => onUpgrade(tower.id)}
        >
          <span className="text-[12px]">{maxed ? "★ 已满级" : "⬆ 升级"}</span>
          {!maxed && <span className="dsp text-[11px] opacity-85">{upCost}🪙</span>}
        </Btn>
        <Btn
          tone="red"
          size="md"
          className="flex-1 flex-col !gap-0 leading-tight"
          onClick={() => onSell(tower.id)}
        >
          <span className="text-[12px]">💰 出售</span>
          <span className="dsp text-[11px] opacity-85">+{sellValue(tower)}</span>
        </Btn>
      </div>
    </div>
  );
}

/** 当前等级在满级基准上的点数(1–5),让玩家看到"升级后会变长"。 */
function lvlDots(tower: Tower, key: "damage" | "range" | "speed"): number {
  const max = towerPower(tower.kind);
  const cur = getLevelStats(tower.kind, tower.level);
  const top = getLevelStats(tower.kind, 3);
  const base = key === "damage" ? cur.damage / top.damage
    : key === "range" ? cur.range / top.range
    : top.cooldown / cur.cooldown;
  const full = key === "damage" ? max.damage : key === "range" ? max.range : max.speed;
  return Math.max(1, Math.round(full * base));
}

/* ---------- 波次控制 ---------- */
function WaveControl({ onNextWave }: { onNextWave: () => void }) {
  const hud = useUI((s) => s.hud);
  const inPrep = hud?.phase === "prep" && hud.status === "playing";
  const finished = hud?.phase === "finished";

  if (inPrep) {
    const pct = Math.max(0, Math.min(1, (hud?.prepSeconds ?? 0) / 5));
    return (
      <Btn tone="orange" size="md" block onClick={onNextWave} className="relative overflow-hidden">
        <span
          className="absolute inset-y-0 left-0 bg-black/20"
          style={{ width: `${pct * 100}%`, transition: "width 0.4s linear" }}
        />
        <span className="relative flex items-center gap-1.5">
          <span className="dsp">▶ 下一波</span>
          <span className="dsp opacity-75">{hud?.prepSeconds}s</span>
          {(hud?.nextWaveBonus ?? 0) > 0 && (
            <span className="dsp rounded bg-black/25 px-1 text-amber-100">+{hud?.nextWaveBonus}🪙</span>
          )}
        </span>
      </Btn>
    );
  }
  return (
    <div className="panel-plate flex h-11 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-[12px] font-bold text-emerald-100/85">
      {finished ? (
        <>🏁 最后一波 · 剩 <span className="dsp text-rose-300">{hud?.enemies ?? 0}</span></>
      ) : (
        <>⚔ 第 <span className="dsp text-cream">{hud?.wave ?? 0}</span> 波 · 场上 <span className="dsp text-rose-300">{hud?.enemies ?? 0}</span></>
      )}
    </div>
  );
}

/* ---------- 下一波预告 ---------- */
function WavePreview({ session }: { session: GameSession }) {
  const hud = useUI((s) => s.hud);
  useUI((s) => s.version);
  const waves = session.state.level.waves;
  const idx = Math.min(hud?.wave ?? 0, waves.length - 1);
  const w = waves[idx];
  if (!w) return null;
  const boss = w.groups.some((g) => g.kind === "boss");
  return (
    <div className="panel-plate flex items-center gap-2 rounded-xl px-2.5 py-1.5">
      <span className="dsp shrink-0 text-[10px] tracking-widest text-emerald-200/55">
        下一波
      </span>
      <span className="flex flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
        {w.groups.map((g, i) => (
          <span key={i} className="flex items-center gap-1 text-[11px] font-bold">
            <span className="text-sm">{ENEMY_DEFS[g.kind].icon}</span>
            <span className={cn("dsp", g.kind === "boss" ? "text-rose-300" : "text-cream")}>×{g.count}</span>
          </span>
        ))}
      </span>
      {boss && <Chip className="bg-rose-600 text-white">BOSS</Chip>}
    </div>
  );
}

/* ---------- 炮塔卡片 ---------- */
function TowerCard({ kind, index, armed, gold, onPick }: {
  kind: TowerKind; index: number; armed: boolean; gold: number; onPick: (k: TowerKind) => void;
}) {
  const def = TOWER_DEFS[kind];
  const meta = TOWER_META[kind];
  const role = ROLE_STYLE[meta.role];
  const cost = buildCost(kind);
  const afford = gold >= cost;

  return (
    <button
      type="button"
      title={`${def.name} · ${role.label} · ${meta.pitch}`}
      aria-label={`建造 ${def.name},花费 ${cost} 金币`}
      onClick={(e) => {
        onPick(kind);
        e.currentTarget.blur();
      }}
      className={cn(
        "tw group relative flex h-[72px] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border-2 px-1 transition-all duration-150",
        "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-amber-300",
        armed
          ? "-translate-y-1 border-amber-200 bg-[linear-gradient(180deg,#ff9c2e,#d1600a)] text-[#2b1200] shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
          : "border-[#2b1a08] bg-[linear-gradient(180deg,#8a5a2b,#5e3a19)] text-cream hover:-translate-y-0.5 hover:brightness-110",
        !afford && !armed && "opacity-50 saturate-50",
      )}
    >
      {/* 顶部定位色条:一眼区分单体/范围/控制 */}
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: role.color }} />
      <span className="dsp absolute left-1 top-1 text-[9px] text-sky-200/80">{index + 1}</span>
      {meta.air !== "groundOnly" && (
        <span className="absolute right-1 top-1 text-[9px] leading-none" title={AIR_LABEL[meta.air].full}>
          {meta.air === "airOnly" ? "🛩" : "↑"}
        </span>
      )}
      <span className="mt-1 text-[22px] leading-none">{def.icon}</span>
      {/* 完整塔名:两字也好三字也好都放得下 */}
      <span className="w-full truncate px-0.5 text-center text-[11px] font-black leading-tight">
        {def.name}
      </span>
      <span className={cn("dsp text-[12px] leading-none", afford ? "text-amber-300" : "text-rose-300")}>
        {cost}
      </span>
    </button>
  );
}

export function TowerPanel({
  session, onPickKind, onUpgrade, onSell, onNextWave, onCyclePriority, className,
}: Props) {
  const hud = useUI((s) => s.hud);
  const selectedTowerId = useUI((s) => s.selectedTowerId);
  const selectedCell = useUI((s) => s.selectedCell);
  const armedKind = useUI((s) => s.armedKind);
  const towerPage = useUI((s) => s.towerPage);
  const setTowerPage = useUI((s) => s.setTowerPage);
  useUI((s) => s.version);

  const pageKinds = TOWER_PAGES[towerPage]?.kinds ?? TOWER_PAGES[0].kinds;
  const tower = selectedTowerId !== null
    ? session.state.towers.find((t) => t.id === selectedTowerId)
    : undefined;
  const gold = hud?.gold ?? 0;

  return (
    <div
      className={cn(
        "panel-wood flex w-full shrink-0 flex-col gap-2 rounded-2xl p-2",
        className,
        // 宽屏:右侧竖排侧栏,固定宽度,内部可滚动
        "lg:h-full lg:w-[19rem] lg:overflow-y-auto xl:w-[21rem]",
      )}
    >
      <div className="flex w-full shrink-0 flex-col gap-1.5">
        <WaveControl onNextWave={onNextWave} />
        <p className="text-center text-[10px] font-semibold leading-snug text-cream/55">
          {armedKind
            ? `已选「${TOWER_DEFS[armedKind].name}」· 点空地放置`
            : selectedCell
              ? "在环中选塔 · 或按 1–5"
              : "点空地建造 · 点炮塔升级"}
        </p>
        <WavePreview session={session} />
      </div>

      <div className="min-w-0 flex-1">
        {tower ? (
          <Inspector
            tower={tower}
            onUpgrade={onUpgrade}
            onSell={onSell}
            onCyclePriority={onCyclePriority}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {TOWER_PAGES.map((p, i) => (
                <Btn
                  key={p.id}
                  size="xs"
                  tone={i === towerPage ? "gold" : "ghost"}
                  onClick={() => setTowerPage(i)}
                >
                  {p.name}
                  <span className="ml-0.5 opacity-55">{PAGE_KEYS[i] ?? ""}</span>
                </Btn>
              ))}
              <span className="ml-auto hidden text-[10px] font-semibold text-cream/45 sm:inline">
                Tab 翻页 · 1–5 建造
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {pageKinds.map((kind, i) => (
                <TowerCard
                  key={kind}
                  kind={kind}
                  index={i}
                  armed={armedKind === kind}
                  gold={gold}
                  onPick={onPickKind}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
