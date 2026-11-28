import { useEffect, useRef, useState } from "react";
import { FEATURED_SKINS, getSkin, skinCollectionLabel, skinName, type Skin } from "../game/skins";
import { useT } from "../i18n/useT";
import { getLang } from "../i18n";
import type { Difficulty, GameMode } from "../game/types";
import { useGameStore } from "../store/gameStore";
import { audio } from "../lib/audio";
import { Icon } from "./Icon";
import { LobbyScene } from "./LobbyScene";

export function Home() {
  const t = useT();
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const equipped = useGameStore((s) => s.equipped);
  const owned = useGameStore((s) => s.owned);
  const mode = useGameStore((s) => s.mode);
  const setMode = useGameStore((s) => s.setMode);
  const start = useGameStore((s) => s.startGame);
  const equip = useGameStore((s) => s.equipSkin);
  const closet = useGameStore((s) => s.setClosetOpen);
  const guide = useGameStore((s) => s.setGuideOpen);
  const modalOpen = useGameStore((s) => s.closetOpen || s.guideOpen || s.profileOpen || s.dailyOpen || s.missionsOpen || s.settingsOpen);
  const stage = useRef<HTMLDivElement>(null);
  const choices: Skin[] = FEATURED_SKINS.some((s) => s.id === equipped) ? FEATURED_SKINS : [getSkin(equipped), ...FEATURED_SKINS];
  const [previewId, setPreviewId] = useState(equipped);
  useEffect(() => setPreviewId(equipped), [equipped]);
  const skin = getSkin(previewId);
  const index = Math.max(0, choices.findIndex((s) => s.id === previewId));
  const available = owned.includes(previewId);

  const cycle = (direction: number) => {
    audio.ui();
    const next = choices[(index + direction + choices.length) % choices.length];
    setPreviewId(next.id);
  };

  return (
    <main className="lobby" aria-label={t("纸格竞技场大厅")}>
      <div className="lobby-paper" aria-hidden="true" />
      <LobbyScene skin={previewId} target={stage} paused={modalOpen} />
      <div className="lobby-content">
        <section className="lobby-intro">
          <p className="editorial-kicker"><span />{t("一张纸，一整个游乐场")}</p>
          {getLang() === "en" ? <h1 className="is-en">More than<br />just a <span className="title-stroke">snake.</span></h1> : <h1>贪吃蛇，<br />不止是<span className="title-stroke">蛇。</span></h1>}
          <p className="lobby-description">{t("吞光点，绕个弯。")}{getLang() === "en" ? " " : ""}<br />{t("把小小的好奇心，游成大大的世界。")}</p>
        </section>
        <section className="lobby-play" aria-label={t("开始对局")}>
          <div className="mode-tabs" role="tablist" aria-label={t("选择模式")}>
            {([{ id: "endless", title: "无尽漫游", icon: "infinity" }, { id: "timed", title: "三分钟竞速", icon: "clock" }] as const).map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? "is-active" : ""} onClick={() => setMode(item.id as GameMode)}>
                <Icon name={item.icon} />{t(item.title)}
              </button>
            ))}
          </div>
          <div className="difficulty-row" role="radiogroup" aria-label={t("难度")}>
            <span>{t("难度")}</span>
            {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={difficulty === d} className={difficulty === d ? "is-active" : ""} onClick={() => { audio.ui(); setDifficulty(d); }}>
                {t(d === "easy" ? "轻松" : d === "normal" ? "标准" : "高手")}
              </button>
            ))}
            <small>{t(difficulty === "easy" ? "9 条对手 · 金币 ×0.8" : difficulty === "normal" ? "12 条对手 · 金币 ×1" : "15 条更大更快的对手 · 金币 ×1.35")}</small>
          </div>
          <div className="lobby-actions">
            <button type="button" className="play-button" onClick={() => {
              audio.ui();
              if (available && equipped !== previewId) equip(previewId);
              start(mode);
            }}>
              <span>{t("开始游戏")}</span><Icon name="arrow" />
            </button>
            <button type="button" className="text-link" onClick={() => guide(true)}>{t("怎么玩")}<Icon name="help" /></button>
          </div>
          <p className="control-note"><Icon name={available ? "mouse" : "shield"} />{available ? <><span className="desktop-controls-note">{t("鼠标转向，按住左键或空格加速")}</span><span className="touch-controls-note">{t("左侧摇杆转向，按住右侧按钮加速")}</span></> : t("当前为未解锁预览，本局使用「{name}」", { name: skinName(getSkin(equipped)) })}</p>
        </section>
        <div className="lobby-art-space" ref={stage} />
        <section className="skin-caption" aria-label={t("造型预览")}>
          <div className="skin-caption-copy" key={previewId}>
            <span className="skin-edition">{skinCollectionLabel(skin)} / {String(index + 1).padStart(2, "0")}</span>
            <h2>{skinName(skin)}<span>{getLang() === "en" ? t(skin.tagline) : skin.englishName ?? "Original Collection"}</span></h2>
            <button className="text-link" type="button" onClick={() => closet(true, previewId)}>
              {available ? t("去工坊逛逛 · 异想系列上新") : t("进工坊先试游 · {price} 金币解锁", { price: skin.price })}<Icon name="arrow" />
            </button>
          </div>
          <div className="skin-pagination" role="group" aria-label={t("选择展示造型")} onKeyDown={(event) => {
            if (event.key === "ArrowRight") { event.preventDefault(); cycle(1); }
            if (event.key === "ArrowLeft") { event.preventDefault(); cycle(-1); }
          }}>
            <button type="button" aria-label={t("上一款皮肤")} onClick={() => cycle(-1)}><Icon name="back" /></button>
            <span>{String(index + 1).padStart(2, "0")}<i>/ {String(choices.length).padStart(2, "0")}</i></span>
            <button type="button" aria-label={t("下一款皮肤")} onClick={() => cycle(1)}><Icon name="arrow" /></button>
          </div>
        </section>
      </div>
      <footer className="lobby-footer">
        <span>{t("一局刚刚好。")}<span className="footer-english"> A LITTLE BREAK, A LITTLE PLAY.</span></span>
        <span className="local-status"><span />{t("本地单机 · 无广告 · 皮肤不影响数值")}</span>
      </footer>
    </main>
  );
}