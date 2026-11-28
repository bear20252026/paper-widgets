import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { ModalHeader, Overlay, Switch } from "./uiKit";
import { Icon } from "./Icon";
import { useT } from "../i18n/useT";
import { LANGS } from "../i18n";

export function SettingsModal() {
  const open = useGameStore((s) => s.settingsOpen);
  return open ? <Preferences /> : null;
}

function Preferences() {
  const t = useT();
  const s = useGameStore();
  const [name, setName] = useState(s.playerName);
  const [confirm, setConfirm] = useState(false);
  const rows = [
    { label: "游戏音效", desc: "光点、加速与击杀的声音", checked: s.sound, action: s.toggleSound },
    { label: "背景音乐", desc: "一点轻轻的节奏", checked: s.bgm, action: s.toggleBgm },
    { label: "方向箭头", desc: "显示蛇头的转向指引", checked: s.showDirectionArrow, action: s.toggleDirectionArrow },
    { label: "小地图", desc: "查看蛇王和公共目标的位置", checked: s.showMinimap, action: s.toggleMinimap },
    { label: "对手昵称", desc: "显示其他蛇的名字", checked: s.showNames, action: s.toggleShowNames },
    { label: "常显摇杆", desc: "也适合触屏笔记本", checked: s.forceTouchControls, action: s.toggleForceTouchControls },
    { label: "触感反馈", desc: "支持的设备上使用短振动", checked: s.haptics, action: s.toggleHaptics },
  ];
  return <Overlay onClose={() => s.setSettingsOpen(false)} className="max-w-[490px]">
    <ModalHeader eyebrow="MAKE YOURSELF COMFORTABLE" title={t("偏好设置")} onClose={() => s.setSettingsOpen(false)} />
    <div className="preferences-body">
      <div className="preference-row language-row">
        <div><strong>{t("语言")} · Language</strong><p>{t("界面、对手昵称与战报")}</p></div>
        <div className="segmented" role="radiogroup" aria-label="Language">
          {LANGS.map((l) => <button key={l.id} type="button" role="radio" aria-checked={s.lang === l.id} className={s.lang === l.id ? "is-active" : ""} onClick={() => s.setLanguage(l.id)}>{l.label}</button>)}
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); s.rename(name); s.notify(t("昵称已保存")); }} className="name-form"><label>{t("玩家昵称")}<input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} aria-label={t("玩家昵称")} /></label><button className="small-button" type="submit">{t("保存")}</button></form>
      <div className="preference-switches">{rows.map((row) => <div className="preference-row" key={row.label}><div><strong>{t(row.label)}</strong><p>{t(row.desc)}</p></div><Switch checked={row.checked} onChange={row.action} label={t(row.label)} /></div>)}</div>
      <div className="volume-grid">{([{ label: "主音量", channel: "master", value: s.masterVolume }, { label: "音效", channel: "sfx", value: s.sfxVolume }, { label: "音乐", channel: "bgm", value: s.bgmVolume }] as const).map((item) => <label key={item.channel}><span>{t(item.label)}<small>{Math.round(item.value * 100)}%</small></span><input type="range" min={0} max={100} aria-label={t(item.label)} value={Math.round(item.value * 100)} onChange={(e) => s.setVolume(item.channel, Number(e.target.value) / 100)} /></label>)}</div>
      <button type="button" className="preference-help" onClick={() => s.replayOnboarding()}>{t("再看一次操作说明")}<Icon name="arrow" /></button>
      <div className="reset-line"><div><strong>{t("本地存档")}</strong><p>{t("保存在此浏览器，不会上传。")}</p></div><button type="button" className="text-link" onClick={() => { if (!confirm) return setConfirm(true); s.resetProgress(); setConfirm(false); s.notify(t("存档已重置"), "info"); }}>{confirm ? t("确认清空所有进度") : t("重置进度")}</button></div>
    </div>
  </Overlay>;
}
