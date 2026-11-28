import { useGameStore } from "../store/gameStore";
import { getRankTier } from "../game/progression";
import { Icon, BrandMark } from "./Icon";
import { useT } from "../i18n/useT";
import { fmt, getLang } from "../i18n";
import { audio } from "../lib/audio";

export function GemIcon({ className = "" }: { className?: string }) {
  return <Icon name="gem" className={className} />;
}
export function CoinIcon({ className = "" }: { className?: string }) {
  return <Icon name="coin" className={className} />;
}

export function Topbar() {
  const t = useT();
  const lang = useGameStore((s) => s.lang);
  const setLanguage = useGameStore((s) => s.setLanguage);
  const phase = useGameStore((s) => s.phase);
  const coins = useGameStore((s) => s.coins);
  const playerName = useGameStore((s) => s.playerName);
  const rp = useGameStore((s) => s.rp);
  const sound = useGameStore((s) => s.sound);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const closet = useGameStore((s) => s.setClosetOpen);
  const profile = useGameStore((s) => s.setProfileOpen);
  const settings = useGameStore((s) => s.setSettingsOpen);
  const pause = useGameStore((s) => s.pause);

  if (phase !== "menu") return (
    <header className="battle-topbar">
      <div className="battle-brand"><BrandMark /><span>{t("纸格竞技场")}</span></div>
      <button type="button" aria-label={phase === "playing" ? t("暂停") : t("游戏设置")} onClick={() => phase === "playing" ? pause() : settings(true)} className="icon-button">
        <Icon name={phase === "playing" ? "pause" : "settings"} />
      </button>
    </header>
  );

  return (
    <header className="site-header">
      <button className="wordmark" type="button" onClick={() => useGameStore.getState().goMenu()} aria-label={t("纸格竞技场首页")}>
        <BrandMark /><span>{getLang() === "en" ? "Paper" : "纸格"}<span className="wordmark-en">PAPER SNAKE</span></span>
      </button>
      <nav className="main-nav" aria-label={t("主导航")}>
        <button type="button" aria-current="page">{t("游乐场")}</button>
        <button type="button" onClick={() => closet(true)}>{t("皮肤工坊")}</button>
        <button type="button" onClick={() => profile(true)}>{t("成长手册")}</button>
      </nav>
      <div className="header-tools">
        <button type="button" className="wallet-link" aria-label={t("{n} 金币，查看收集奖励", { n: coins })} onClick={() => useGameStore.getState().setDailyOpen(true)}><CoinIcon /><span>{fmt(coins)}</span></button>
        <span className="header-divider" />
        <button type="button" className="lang-switch" onClick={() => { audio.ui(); setLanguage(lang === "zh" ? "en" : "zh"); }} aria-label={lang === "zh" ? "Switch to English" : "切换到中文"} title={lang === "zh" ? "Switch to English" : "切换到中文"}>
          <span className={lang === "zh" ? "is-on" : ""}>中</span><i>/</i><span className={lang === "en" ? "is-on" : ""}>EN</span>
        </button>
        <button type="button" className="icon-button sound-button" onClick={toggleSound} aria-label={sound ? t("关闭音效") : t("打开音效")}><Icon name={sound ? "sound" : "muted"} /></button>
        <button type="button" className="icon-button" onClick={() => settings(true)} aria-label={t("设置")}><Icon name="settings" /></button>
        <button type="button" className="profile-link" onClick={() => profile(true)} aria-label={t("我的档案：{name}，{tier}", { name: playerName, tier: t(getRankTier(rp).name) })}><Icon name="user" /></button>
      </div>
    </header>
  );
}