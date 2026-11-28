import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "./i18nContext";
import { MobileLogin } from "./components/MobileLogin";
import { QrLogin } from "./components/QrLogin";
import { WeChatLogo } from "./components/WeChatLogo";
import { cn } from "./utils/cn";

type Device = "mobile" | "desktop" | "web";
type Mode = "dark" | "light";

function useDarkMode() {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "light";
    const saved = localStorage.getItem("wx_mode");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem("wx_mode", mode);
    } catch {}
  }, [mode]);
  return { mode, setMode };
}

function TopBar({
  device,
  setDevice,
  mode,
  setMode,
}: {
  device: Device;
  setDevice: (d: Device) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
}) {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <WeChatLogo size={32} />
          <span className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t.brand}
          </span>
          <span className="ml-2 hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-[#07C160] dark:bg-emerald-900/30 sm:inline">
            {lang === "zh" ? "登录设计原型" : "Login prototype"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Device switcher */}
          <div className="hidden items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900 sm:flex">
            {(
              [
                { k: "mobile", label: "📱 Mobile", zh: "📱 手机" },
                { k: "desktop", label: "💻 PC", zh: "💻 电脑" },
                { k: "web", label: "🌐 Web", zh: "🌐 网页" },
              ] as const
            ).map((o) => (
              <button
                key={o.k}
                onClick={() => setDevice(o.k)}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition",
                  device === o.k
                    ? "bg-[#07C160] text-white shadow-sm"
                    : "text-slate-600 hover:text-[#07C160] dark:text-slate-300"
                )}
              >
                {lang === "zh" ? o.zh : o.label}
              </button>
            ))}
          </div>

          {/* Language */}
          <button
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:text-[#07C160] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {lang === "zh" ? "EN" : "中"}
          </button>

          {/* Dark mode */}
          <button
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:text-[#07C160] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            aria-label="toggle theme"
          >
            {mode === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
      {/* Mobile device chooser */}
      <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 text-xs dark:border-slate-800 sm:hidden">
        {(
          [
            { k: "mobile", zh: "📱 手机", en: "📱 Mobile" },
            { k: "desktop", zh: "💻 电脑", en: "💻 PC" },
            { k: "web", zh: "🌐 网页", en: "🌐 Web" },
          ] as const
        ).map((o) => (
          <button
            key={o.k}
            onClick={() => setDevice(o.k)}
            className={cn(
              "flex-shrink-0 rounded-full px-3 py-1 font-medium",
              device === o.k
                ? "bg-[#07C160] text-white"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            )}
          >
            {lang === "zh" ? o.zh : o.en}
          </button>
        ))}
      </div>
    </div>
  );
}

function DesktopQrPage() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[calc(100vh-100px)] items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-10 dark:from-slate-950 dark:to-slate-900">
      <div className="relative flex w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900 dark:shadow-black/30 dark:ring-slate-800">
        {/* Left art panel */}
        <div className="relative hidden w-[45%] flex-col items-center justify-center bg-gradient-to-br from-[#07C160] to-[#048f46] p-10 text-white md:flex">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute -right-10 bottom-10 h-60 w-60 rounded-full bg-white/20 blur-3xl" />
          </div>
          <WeChatLogo size={96} />
          <h2 className="mt-6 text-2xl font-semibold tracking-tight">WeChat</h2>
          <p className="mt-2 text-sm text-white/80">
            {t.brand} · 连接一切 · Connecting people
          </p>
          <ul className="mt-10 space-y-2 text-sm text-white/80">
            <li>· 实时聊天 · Instant messaging</li>
            <li>· 音视频通话 · Voice & video calls</li>
            <li>· 文件传输 · File transfer</li>
            <li>· 朋友圈 · Moments</li>
          </ul>
        </div>
        {/* Right QR panel */}
        <div className="flex-1">
          <QrLogin variant="desktop" />
        </div>
      </div>
    </div>
  );
}

function WebQrPage() {
  const { t, lang } = useI18n();
  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col bg-white dark:bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <WeChatLogo size={28} />
          <span className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {t.brand}
          </span>
          <span className="ml-1 text-xs text-slate-400">Web</span>
        </div>
        <nav className="hidden gap-6 text-sm text-slate-600 dark:text-slate-300 md:flex">
          <a className="hover:text-[#07C160]" href="#">{lang === "zh" ? "下载" : "Download"}</a>
          <a className="hover:text-[#07C160]" href="#">{lang === "zh" ? "帮助中心" : "Help"}</a>
          <a className="hover:text-[#07C160]" href="#">{lang === "zh" ? "开放平台" : "Open Platform"}</a>
        </nav>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <QrLogin variant="web" />
        </div>
      </main>
      <footer className="border-t border-slate-100 px-6 py-4 text-center text-xs text-slate-400 dark:border-slate-800">
        {t.footer}
      </footer>
    </div>
  );
}

function MobileView() {
  return (
    <div className="flex min-h-[calc(100vh-100px)] items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-100 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:p-8">
      {/* Phone frame */}
      <div className="relative w-full max-w-[390px] overflow-hidden rounded-[40px] border-[10px] border-slate-900 bg-[#EDEDED] shadow-2xl shadow-slate-400/30 dark:border-slate-800 dark:shadow-black/50">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-slate-900" />
        {/* Status bar */}
        <div className="relative flex h-8 items-center justify-between bg-[#EDEDED] px-6 pt-1 text-[11px] font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-200">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <span>●●●●</span>
            <span>📶</span>
            <span>🔋</span>
          </span>
        </div>
        <MobileLogin />
      </div>
    </div>
  );
}

function Shell() {
  const [device, setDevice] = useState<Device>("mobile");
  const { mode, setMode } = useDarkMode();
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <TopBar device={device} setDevice={setDevice} mode={mode} setMode={setMode} />
      {device === "mobile" && <MobileView />}
      {device === "desktop" && <DesktopQrPage />}
      {device === "web" && <WebQrPage />}
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  );
}
