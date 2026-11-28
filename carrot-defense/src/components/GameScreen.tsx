import { useCallback, useEffect, useMemo, useState } from "react";
import { isCellBuildable, towerAt, type FailReason } from "../game/economy";
import { getLevel } from "../game/levels";
import { createEndlessLevel } from "../game/endless";
import { OBSTACLE_DEFS, obstacleAt } from "../game/obstacle";
import { GameSession } from "../game/session";
import { PRIORITY_INFO } from "../game/tower";
import { TOWER_PAGES } from "../game/towerDefs";
import type { RelicId, TowerKind } from "../game/types";
import { useUI } from "../store";
import { cn } from "../utils/cn";
import { GameCanvas } from "./GameCanvas";
import { Hud } from "./Hud";
import { BoonModal } from "./BoonModal";
import { ResultModal } from "./ResultModal";
import { Rings } from "./Rings";
import { TowerPanel } from "./TowerPanel";
import { REASON_TEXT } from "./text";

const TOAST_CLS: Record<string, string> = {
  info: "border-sky-300/60 bg-[#0f2b3a]/95 text-sky-100",
  good: "border-amber-300/70 bg-[#3a2a06]/95 text-amber-100",
  bad: "border-rose-400/70 bg-[#3a0d0d]/95 text-rose-100",
};

function PauseOverlay({ onRestart, onMenu, onSkip, nextName }: { onRestart: () => void; onMenu: () => void; onSkip: () => void; nextName: string | null }) {
  const level = getLevel(useUI((s) => s.levelId));
  const togglePause = useUI((s) => s.togglePause);
  const speed = useUI((s) => s.speed);
  const toggleSpeed = useUI((s) => s.toggleSpeed);
  const muted = useUI((s) => s.muted);
  const toggleMute = useUI((s) => s.toggleMute);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px]">
      <div className="panel-wood anim-pop pointer-events-auto w-full max-w-xs rounded-2xl p-4 text-center">
        <div className="kicker">Paused</div>
        <h2 className="dsp mb-3 text-3xl text-cream">已 暂 停</h2>
        <div className="mb-3 rounded-lg border-2 border-black/30 bg-black/25 p-2 text-left text-[11px] leading-snug text-cream/80">
          <span className="dsp text-amber-300">提示 · </span>
          {level.tip}
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={togglePause} className="btn btn-green w-full py-2.5 text-sm">
            ▶ 继续游戏<span className="ml-1 opacity-70">(空格)</span>
          </button>
          <button type="button" onClick={onSkip} className="btn btn-gold w-full py-2 text-xs">
            ⏭ 跳过本关{nextName ? ` · 去「${nextName}」` : ""}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={toggleSpeed} className={cn("btn flex-1 py-2 text-xs", speed === 2 ? "btn-gold" : "btn-slate")}>
              <span className="dsp">{speed}×</span> 速度
            </button>
            <button type="button" onClick={toggleMute} className={cn("btn flex-1 py-2 text-xs", muted ? "btn-slate" : "btn-gold")}>
              {muted ? "🔇 已静音" : "🔊 音效开"}
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onRestart} className="btn btn-orange flex-1 py-2 text-xs">
              ↻ 重新开始
            </button>
            <button type="button" onClick={onMenu} className="btn btn-slate flex-1 py-2 text-xs">
              ⌂ 返回选关
            </button>
          </div>
        </div>
        <p className="mt-2.5 text-[10px] font-semibold text-cream/55">
          暂停中仍可建造、升级、出售与规划布阵
        </p>
      </div>
    </div>
  );
}

export default function GameScreen() {
  const levelId = useUI((s) => s.levelId);
  const sessionKey = useUI((s) => s.sessionKey);
  const mode = useUI((s) => s.mode);
  const endlessSeed = useUI((s) => s.endlessSeed);
  const level = useMemo(
    () => (mode === "endless" ? createEndlessLevel(endlessSeed) : getLevel(levelId)),
    [mode, endlessSeed, levelId],
  );
  // sessionKey 变化(重开一局)时重建会话
  const session = useMemo(() => new GameSession(level), [level, sessionKey]);

  const [stageW, setStageW] = useState(0);
  const [banner, setBanner] = useState<{ text: string; boss: boolean } | null>(null);

  const paused = useUI((s) => s.paused);
  const toast = useUI((s) => s.toast);
  const wave = useUI((s) => s.hud?.wave ?? 0);
  const status = useUI((s) => s.hud?.status ?? "playing");
  const backToMenu = useUI((s) => s.backToMenu);
  const restart = useUI((s) => s.restart);
  const skipTo = useUI((s) => s.skipTo);
  const startLevel = useUI((s) => s.startLevel);
  const nextLevelName = getLevel(Math.min(levelId + 1, 100)).name;
  const isEndless = useUI((s) => s.mode) === "endless";
  const doSkip = useCallback(() => {
    skipTo(levelId);
    if (levelId < 100) startLevel(levelId + 1);
    else useUI.getState().backToMenu();
  }, [skipTo, startLevel, levelId]);

  const fail = useCallback((reason: FailReason) => {
    useUI.getState().showToast(REASON_TEXT[reason], "bad");
  }, []);

  /* ---------- 玩家操作 ---------- */
  const doBuild = useCallback(
    (kind: TowerKind, col: number, row: number) => {
      const ui = useUI.getState();
      const res = session.build(kind, col, row);
      if (res.ok) ui.clearSelection();
      else fail(res.reason);
      ui.bump();
    },
    [session, fail],
  );

  const doUpgrade = useCallback(
    (id: number) => {
      const res = session.upgrade(id);
      if (res.ok) useUI.getState().showToast("升级成功,属性已提升", "good");
      else fail(res.reason);
      useUI.getState().bump();
    },
    [session, fail],
  );

  const doSell = useCallback(
    (id: number) => {
      const res = session.sell(id);
      const ui = useUI.getState();
      if (res.ok) {
        ui.clearSelection();
        ui.showToast(`已出售,返还 🪙${res.refund}`, "good");
      } else fail(res.reason);
      ui.bump();
    },
    [session, fail],
  );

  const doCyclePriority = useCallback(
    (id: number) => {
      const p = session.cyclePriority(id);
      const ui = useUI.getState();
      if (p) ui.showToast(`攻击优先级:${PRIORITY_INFO[p].icon} ${PRIORITY_INFO[p].hint}`, "info");
      ui.bump();
    },
    [session],
  );

  const doSkill = useCallback(() => {
    const ui = useUI.getState();
    if (session.castSkill()) ui.showToast("萝卜冲击波!全场冻结", "good");
    else if ((ui.hud?.energy ?? 0) < 100) ui.showToast("能量不足:击杀敌人充能", "info");
    ui.bump();
  }, [session]);

  const doPickRelic = useCallback((id: RelicId) => {
    const ui = useUI.getState();
    if (session.chooseBoon(id)) ui.bump();
  }, [session]);

  const doNextWave = useCallback(() => {
    const bonus = session.nextWave();
    const ui = useUI.getState();
    if (bonus !== null && bonus > 0) ui.showToast(`提前开波,奖励 🪙${bonus}`, "good");
    ui.bump();
  }, [session]);

  const onPickKind = useCallback(
    (kind: TowerKind) => {
      const ui = useUI.getState();
      if (ui.selectedCell) doBuild(kind, ui.selectedCell.col, ui.selectedCell.row);
      else ui.armKind(ui.armedKind === kind ? null : kind);
    },
    [doBuild],
  );

  const onCellClick = useCallback(
    (col: number, row: number) => {
      const ui = useUI.getState();
      const s = session.state;
      if (s.status !== "playing") return;

      const tower = towerAt(s, col, row);
      if (tower) {
        ui.selectTower(ui.selectedTowerId === tower.id ? null : tower.id);
        return;
      }
      const ob = obstacleAt(s.obstacles, col, row);
      if (ob) {
        const on = session.toggleFocus(ob.id);
        ui.clearSelection();
        ui.showToast(
          on
            ? `锁定「${OBSTACLE_DEFS[ob.kind].name}」· 射程内炮塔优先清除 · +${ob.reward}🪙`
            : "已取消锁定障碍物",
          on ? "good" : "info",
        );
        ui.bump();
        return;
      }
      if (isCellBuildable(s, col, row)) {
        if (ui.armedKind) doBuild(ui.armedKind, col, row);
        else if (ui.selectedCell?.col === col && ui.selectedCell.row === row) ui.selectCell(null);
        else ui.selectCell({ col, row });
        return;
      }
      ui.clearSelection();
    },
    [session, doBuild],
  );

  /* ---------- 键盘 ---------- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const ui = useUI.getState();
      if (e.code === "Space") {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        if (session.state.status === "playing") ui.togglePause();
        return;
      }
      if (e.key === "Escape") {
        ui.clearSelection();
        return;
      }
      if (/^[1-5]$/.test(e.key)) {
        const kinds = TOWER_PAGES[ui.towerPage]?.kinds ?? TOWER_PAGES[0].kinds;
        onPickKind(kinds[Number(e.key) - 1]);
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "tab") {
        e.preventDefault();
        ui.cycleTowerPage(e.shiftKey ? -1 : 1);
        return;
      }
      const pageKey = ["q", "w", "e", "r", "t", "y", "g"].indexOf(key);
      if (pageKey >= 0 && pageKey < TOWER_PAGES.length) {
        ui.setTowerPage(pageKey);
        return;
      }
      if (key === "x") doSkill();
      else if (key === "n") doNextWave();
      else if (key === "u" && ui.selectedTowerId !== null) doUpgrade(ui.selectedTowerId);
      else if ((key === "s" || key === "delete") && ui.selectedTowerId !== null) doSell(ui.selectedTowerId);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") e.preventDefault();
    };
    const onVisibility = () => {
      if (document.hidden && session.state.status === "playing") useUI.getState().setPaused(true);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session, onPickKind, doNextWave, doUpgrade, doSell, doSkill]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => useUI.setState({ toast: null }), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  /* ---------- 波次横幅 / Boss 警示 ---------- */
  const bossWave = wave > 0 && !!level.waves[wave - 1]?.groups.some((g) => g.kind === "boss");
  useEffect(() => {
    if (wave <= 0) return;
    const boss = !!level.waves[wave - 1]?.groups.some((g) => g.kind === "boss");
    setBanner({ text: boss ? `第 ${wave} 波 · BOSS 来袭` : `第 ${wave} 波`, boss });
    const id = window.setTimeout(() => setBanner(null), 1900);
    return () => window.clearTimeout(id);
  }, [wave, level]);

  return (
    <div className="flex h-dvh w-full select-none flex-col gap-1 overflow-hidden bg-[radial-gradient(120%_90%_at_50%_-10%,#1d5c3c,#0a2415_60%,#06170e)] p-1">
      <Hud level={level} onMenu={backToMenu} onSkill={doSkill} onSkip={mode === "endless" ? undefined : doSkip} />

      {/* 主区:棋盘占最大空间,操作栏紧凑贴边。放置武器时画面不缩放、不遮罩。 */}
      <div className="flex min-h-0 flex-1 flex-col gap-1 lg:flex-row">
        {/* 左侧棋盘:宽屏占剩余全部宽度,窄屏占高度大部分 */}
        <div className="flex-1 min-w-0 flex min-h-0">
          <GameCanvas session={session} onCellClick={onCellClick} onResize={setStageW}>
            <Rings
              session={session}
              stageWidth={stageW}
              onBuild={doBuild}
              onUpgrade={doUpgrade}
              onSell={doSell}
            />

            {bossWave && status === "playing" && !paused && (
              <div className="anim-danger pointer-events-none absolute inset-0 z-10 rounded-xl" />
            )}

            {banner && status === "playing" && (
              <div className="pointer-events-none absolute inset-x-0 top-[12%] z-20 flex justify-center">
                <div
                  className={cn(
                    "anim-banner dsp rounded-xl border-b-4 px-5 py-1.5 text-xl shadow-2xl sm:text-3xl",
                    banner.boss
                      ? "border-rose-900 bg-[linear-gradient(180deg,#ff5a4d,#a3160c)] text-white"
                      : "border-[#7d3d05] bg-[linear-gradient(180deg,#ffc53d,#e08a12)] text-[#3a1a00]",
                  )}
                >
                  {banner.text}
                </div>
              </div>
            )}

            {toast && (
              <div key={toast.id} className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex justify-center">
                <div
                  className={cn(
                    "anim-pop max-w-full rounded-xl border-2 px-3 py-1.5 text-center text-[11px] font-bold shadow-xl sm:text-xs",
                    TOAST_CLS[toast.kind] ?? TOAST_CLS.info,
                  )}
                >
                  {toast.text}
                </div>
              </div>
            )}

            {paused && status === "playing" && <PauseOverlay onRestart={restart} onMenu={backToMenu} onSkip={doSkip} nextName={!isEndless && levelId < 100 ? nextLevelName : null} />}
          </GameCanvas>
        </div>

        {/* 右侧操作栏:宽屏固定窄宽度,窄屏下方紧凑堆叠 */}
        <TowerPanel
          session={session}
          onPickKind={onPickKind}
          onUpgrade={doUpgrade}
          onSell={doSell}
          onNextWave={doNextWave}
          onCyclePriority={doCyclePriority}
          className={cn(
            "shrink-0",
            "lg:w-[21rem] xl:w-[23rem]",
            "hidden lg:flex",
          )}
        />
        {/* 窄屏下方操作栏 */}
        <TowerPanel
          session={session}
          onPickKind={onPickKind}
          onUpgrade={doUpgrade}
          onSell={doSell}
          onNextWave={doNextWave}
          onCyclePriority={doCyclePriority}
          className={cn(
            "shrink-0",
            "lg:hidden",
          )}
        />
      </div>

      <BoonModal session={session} onPick={doPickRelic} />
      <ResultModal />
    </div>
  );
}
