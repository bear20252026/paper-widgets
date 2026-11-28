import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { audio } from "../lib/audio";
import { Icon } from "./Icon";
import { Overlay, ModalHeader } from "./uiKit";
import { useT } from "../i18n/useT";

export function Onboarding() {
  const open = useGameStore((s) => s.guideOpen);
  const close = useGameStore((s) => s.setGuideOpen);
  return open ? <GuideContent onClose={() => close(false)} /> : null;
}

function GuideContent({ onClose }: { onClose: () => void }) {
  const t = useT();
  const done = useGameStore((s) => s.onboardingDone);
  const equipped = useGameStore((s) => s.equipped);
  const [name, setName] = useState(useGameStore.getState().playerName);
  const begin = () => {
    const state = useGameStore.getState();
    if (!done) state.completeOnboarding(name, equipped);
    onClose(); audio.ui();
    if (state.phase === "menu") useGameStore.getState().startGame(state.mode);
  };
  return (
    <Overlay onClose={onClose} className="max-w-[460px]" z="z-[70]">
      <ModalHeader eyebrow="A QUICK HELLO" title={t("只需记住三件小事。")} onClose={onClose} />
      <div className="guide-body">
        <p className="guide-description">{t("不必等准备好，边游边学就很好。")}</p>
        <ol className="guide-rules">
          <li><Icon name="mouse" /><div><strong>{t("向想去的地方游")}</strong><p>{t("鼠标转向。触屏使用左下方摇杆。")}</p></div></li>
          <li><Icon name="arrow" /><div><strong>{t("按住，快一点")}</strong><p>{t("左键或空格加速，消耗长度。超过 30 米才可冲刺。")}</p></div></li>
          <li><Icon name="shield" /><div><strong>{t("小蛇也能赢")}</strong><p>{t("让对手撞上你。自己的身体和尾巴都是安全的。")}</p></div></li>
          <li><Icon name="spark" /><div><strong>{t("捡起道具")}</strong><p>{t("磁铁、护盾、疾风与双倍会随机出现在赛场上，对手也会抢。")}</p></div></li>
        </ol>
        {!done && <label className="name-input">{t("怎么称呼你？")}<input autoComplete="off" maxLength={12} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("小蛇同学")} /></label>}
        <div className="guide-actions"><small>{!done ? t("初次出发赠送 300 金币与 5 宝石，仅领取一次。") : t("所有造型都使用相同的速度与碰撞判定。")}</small><button className="play-button" type="button" onClick={begin}>{t("出发吧")}<Icon name="arrow" /></button></div>
      </div>
    </Overlay>
  );
}