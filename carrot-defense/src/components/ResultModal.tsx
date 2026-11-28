import { useEffect } from "react";
import { getLevel, LEVELS } from "../game/levels";
import { useUI } from "../store";
import { cn } from "../utils/cn";
import { DIFFICULTY_CLS, RATING_INFO, ratingStars } from "./text";

/** 胜利 / 失败结算。 */
export function ResultModal() {
  const hud = useUI((s) => s.hud);
  const levelId = useUI((s) => s.levelId);
  const restart = useUI((s) => s.restart);
  const backToMenu = useUI((s) => s.backToMenu);
  const startLevel = useUI((s) => s.startLevel);
  const recordResult = useUI((s) => s.recordResult);
  const mode = useUI((s) => s.mode);
  const endlessBest = useUI((s) => s.endlessBest);
  const recordEndless = useUI((s) => s.recordEndless);
  const startEndless = useUI((s) => s.startEndless);

  const status = hud?.status ?? "playing";
  const rating = hud?.rating ?? 0;
  const level = getLevel(levelId);

  useEffect(() => {
    if (mode === "endless") {
      if (status !== "playing" && hud) recordEndless(hud.wave);
      return;
    }
    if (status === "won" && rating > 0) recordResult(levelId, rating);
  }, [status, rating, levelId, recordResult, mode, recordEndless, hud]);

  if (!hud || status === "playing") return null;
  const won = status === "won";
  const endless = mode === "endless";
  const info = RATING_INFO[rating];
  const nextLevel = won ? LEVELS.find((l) => l.id === levelId + 1) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="panel-wood anim-pop w-full max-w-sm rounded-3xl p-1.5">
        <div className="rounded-[18px] bg-[linear-gradient(180deg,#14351f,#0a1f13)] p-5 text-center">
          <div className="kicker">{endless ? "Endless Challenge" : won ? "Stage Clear" : "Game Over"}</div>
          <h2 className="title-carved mt-1 text-3xl leading-tight sm:text-4xl">
            {endless ? "无尽挑战结束" : won ? "保卫成功" : "萝卜失守"}
          </h2>
          {endless && (
            <div className="mt-3 flex flex-col items-center gap-1">
              <span className="dsp text-4xl text-amber-300">第 {hud.wave} 波</span>
              <span className="text-[11px] font-bold text-emerald-100/70">
                历史最高:第 {Math.max(endlessBest, hud.wave)} 波
              </span>
            </div>
          )}

          {!endless && won && info ? (
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "dsp flex h-20 w-20 items-center justify-center rounded-full border-4 text-4xl shadow-xl",
                  info.cls,
                )}
                style={{ borderColor: info.ring, animation: "pop 0.45s cubic-bezier(0.34,1.56,0.64,1)" }}
              >
                🥕
              </span>
              <span className="dsp text-2xl" style={{ color: info.ring }}>
                {info.label}
              </span>
              <span className="dsp text-lg tracking-widest text-amber-300">{ratingStars(rating)}</span>
              <span className="text-[11px] font-semibold text-emerald-100/70">
                {rating === 3
                  ? "满血通关!这就是金萝卜的实力"
                  : `剩余 ${hud.lives}/${hud.maxLives} 点生命 · 满血通关可得金萝卜`}
              </span>
            </div>
          ) : endless ? null : (
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="text-5xl">💀</span>
              <p className="text-xs font-semibold text-emerald-100/75">
                撑到第 {hud.wave} / {hud.totalWaves} 波
              </p>
              <p className="rounded-lg border-2 border-black/30 bg-black/25 px-2.5 py-1.5 text-[11px] leading-snug text-amber-200/85">
                <span className="dsp">提示 · </span>
                {level.tip}
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-1.5 text-[11px]">
            {[
              ["波次", `${hud.wave}/${hud.totalWaves}`],
              ["击杀", `${hud.kills}`],
              ["生命", `${hud.lives}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border-2 border-black/35 bg-black/25 py-1.5">
                <div className="dsp text-lg leading-none text-cream">{v}</div>
                <div className="mt-0.5 font-bold text-emerald-200/60">{k}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {endless && (
              <>
                <button type="button" onClick={startEndless} className="btn btn-orange w-full py-2.5 text-sm">
                  ♾ 再战一局无尽
                </button>
                <button type="button" onClick={backToMenu} className="btn btn-slate w-full py-2.5 text-sm">
                  ⌂ 返回选关
                </button>
              </>
            )}
            {!endless && nextLevel && (
              <button type="button" onClick={() => startLevel(nextLevel.id)} className="btn btn-orange w-full py-2.5 text-sm">
                ▶ 下一关 · {nextLevel.name}
                <span className={cn("ml-2 rounded border px-1 text-[10px]", DIFFICULTY_CLS[nextLevel.difficulty])}>
                  {nextLevel.difficulty}
                </span>
              </button>
            )}
            {!endless && (
              <div className="flex gap-2">
                <button type="button" onClick={restart} className="btn btn-green flex-1 py-2.5 text-sm">
                  ↻ {won ? "再玩一次" : "重新挑战"}
                </button>
                <button type="button" onClick={backToMenu} className="btn btn-slate flex-1 py-2.5 text-sm">
                  ⌂ 选关
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
