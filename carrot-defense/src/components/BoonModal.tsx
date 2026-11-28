import { RELICS } from "../game/relics";
import type { GameSession } from "../game/session";
import type { RelicId } from "../game/types";
import { useUI } from "../store";
import { cn } from "../utils/cn";

interface Props {
  session: GameSession;
  onPick: (id: RelicId) => void;
}

/**
 * 遗物三选一。打开时引擎暂停(step 直接返回),所以这里不需要额外的暂停状态。
 * 卡片只展示图标 + 名称 + 一句话定位,不出现任何原始数值。
 */
export function BoonModal({ session, onPick }: Props) {
  const hud = useUI((s) => s.hud);
  const offer = session.state.boonOffer;
  const owned = session.state.relics;
  if (!offer || offer.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/72 p-3 backdrop-blur-sm">
      <div className="panel-wood anim-pop w-full max-w-2xl rounded-3xl p-1.5">
        <div className="rounded-[20px] bg-[linear-gradient(180deg,#102f1f,#081b11)] p-4 sm:p-5">
          <div className="text-center">
            <div className="kicker">Relic · 第 {hud?.wave ?? 0} 波后的抉择</div>
            <h2 className="title-carved mt-1 text-2xl sm:text-3xl">选择一件遗物</h2>
            <p className="mt-1 text-[11px] font-semibold text-emerald-100/70">
              战场已暂停 · 每种遗物改变一条构筑路线 · 一局最多 4 件
            </p>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {offer.map((id) => {
              const def = RELICS[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPick(id)}
                  className={cn(
                    "group flex flex-col items-center gap-2 rounded-2xl border-2 border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(0,0,0,0.25))] p-3 text-center",
                    "transition hover:-translate-y-1 hover:border-amber-300/70 hover:shadow-[0_10px_24px_rgba(0,0,0,0.45)] active:scale-[0.98]",
                  )}
                  style={{ boxShadow: `inset 0 0 0 1px ${def.color}33` }}
                >
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-lg"
                    style={{ background: `radial-gradient(circle at 35% 30%, ${def.color}, #0b1f14)` }}
                  >
                    {def.icon}
                  </span>
                  <span className="text-sm font-black text-cream">{def.name}</span>
                  <span className="text-[11px] leading-snug text-emerald-100/75">{def.desc}</span>
                  <span
                    className="mt-0.5 rounded-full px-2.5 py-1 text-[11px] font-black text-[#0b1f14]"
                    style={{ background: def.color }}
                  >
                    选择
                  </span>
                </button>
              );
            })}
          </div>

          {owned.length > 0 && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-100/70">
              <span>已拥有</span>
              {owned.map((id) => (
                <span key={id} title={RELICS[id].name} className="text-base">
                  {RELICS[id].icon}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
