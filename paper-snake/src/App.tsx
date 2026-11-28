import { Component, useEffect, type ReactNode } from "react";
import { GameScreen } from "./ui/GameScreen";
import { Closet } from "./ui/Closet";
import { DailyModal } from "./ui/DailyModal";
import { MissionsModal } from "./ui/MissionsModal";
import { Onboarding } from "./ui/Onboarding";
import { ProfileModal } from "./ui/ProfileModal";
import { SettingsModal } from "./ui/SettingsModal";
import { useGameStore } from "./store/gameStore";
import { Icon } from "./ui/Icon";
import { setLang, t } from "./i18n";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="paper-grid flex h-[100dvh] items-center justify-center p-6">
          <div className="max-w-[420px] rounded-[26px] border border-ink/10 bg-cream p-6 text-center shadow-lift">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-coral/15 text-xl">!</div>
            <h1 className="mt-3 font-display text-xl font-extrabold text-ink">{t("竞技场遇到了意外")}</h1>
            <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-ink/55">
              {t("本地存档不受影响。刷新页面即可继续。")}
            </p>
            <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-ink/[0.05] p-2 text-left text-[9px] text-ink/40">
              {this.state.error.message}
            </pre>
            <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-4 px-5 py-2.5 text-sm">
              {t("刷新重试")}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ToastView() {
  const toast = useGameStore((s) => s.toast);
  const dismiss = useGameStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => dismiss(), toast.tone === "reward" ? 3400 : 2600);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;
  return (
    <button
      type="button"
      onClick={dismiss}
      className="toast-paper animate-toast"
      role="status"
    >
      <Icon name={toast.tone === "error" ? "help" : "check"} />
      {toast.message}
    </button>
  );
}

export default function App() {
  const refreshDaily = useGameStore((s) => s.refreshDaily);
  const lang = useGameStore((s) => s.lang);
  useEffect(() => { setLang(lang); }, [lang]);

  useEffect(() => {
    refreshDaily();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshDaily();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refreshDaily]);

  return (
    <ErrorBoundary>
      <div className="min-h-[100dvh] w-full bg-paper">
        <GameScreen />
        <Closet />
        <MissionsModal />
        <DailyModal />
        <ProfileModal />
        <SettingsModal />
        <Onboarding />
        <ToastView />
      </div>
    </ErrorBoundary>
  );
}
