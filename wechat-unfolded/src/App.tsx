import { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Circle,
  Download,
  FileText,
  Grid2X2,
  Layers,
  Menu,
  Monitor,
  Moon,
  QrCode,
  Ruler,
  Share2,
  Smartphone,
  Sparkles,
  Sun,
  X,
  ZoomIn,
} from "lucide-react";
import { WeChatLogo } from "./components/shared";
import { DesktopWeChat, type DesktopPage } from "./components/desktop/DesktopWeChat";
import { PhoneWeChat } from "./components/phone/PhoneWeChat";
import { DESKTOP_PAGES, MOBILE_PAGES, type MobileScreen } from "./components/phone/types";
import { useWeChatStore } from "./store";
import { cn } from "./utils/cn";

type DeviceView = "both" | "desktop" | "mobile";
type CatalogFilter = "all" | "desktop" | "mobile";

function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const notify = (text: string) => {
    setMessage(text);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2600);
  };
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  return { message, notify };
}

function ScrollLink({ target, children, className }: { target: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className={className}
    >
      {children}
    </button>
  );
}

function PageSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  accent = false,
}: {
  label: string;
  value: T;
  options: { id: T; title: string; english: string }[];
  onChange: (v: T) => void;
  accent?: boolean;
}) {
  return (
    <div className="group relative flex items-center gap-2">
      <span className={cn("h-1.5 w-1.5 rounded-full", accent ? "bg-[#07C160]" : "bg-[#A7ADA4]")} />
      <span className="hidden text-[8px] font-medium tracking-[0.12em] text-[#969C93] uppercase sm:block">{label}</span>
      <span className="text-[10px] font-medium text-[#2D342D]">{options.find((o) => o.id === value)?.title}</span>
      <ChevronDown size={11} className="text-[#8E958C]" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title} / {o.english}
          </option>
        ))}
      </select>
    </div>
  );
}

function DeviceToggle({ value, onChange, compact = false }: { value: DeviceView; onChange: (v: DeviceView) => void; compact?: boolean }) {
  const items: { id: DeviceView; label: string; icon: typeof Layers }[] = [
    { id: "both", label: "双端同屏", icon: Layers },
    { id: "desktop", label: "桌面端", icon: Monitor },
    { id: "mobile", label: "手机端", icon: Smartphone },
  ];
  return (
    <div className={cn("flex items-center rounded-full border border-[#D9DCD3] bg-[#F6F6F0] p-0.5", compact && "scale-95")}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9px] transition sm:text-[10px]",
            value === item.id ? "bg-[#1F2922] text-white shadow-sm" : "text-[#82887D] hover:text-[#3F463E]",
          )}
        >
          <item.icon size={11} strokeWidth={1.9} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function MiniScreenArt({ type, tone = "light" }: { type: string; tone?: "light" | "dark" }) {
  const isPhoto = ["moments", "channels", "reading", "call", "profile", "status", "floating"].includes(type);
  const isGrid = ["discover", "mini", "cards", "stickers", "moments_post"].includes(type);
  const isWallet = ["wallet", "pay", "redpacket", "transfer", "qrcode"].includes(type);
  const isChat = ["chats", "chat"].includes(type);
  return (
    <div
      className={cn(
        "relative h-[126px] w-[76px] overflow-hidden rounded-[10px] border shadow-sm",
        tone === "dark" ? "border-black/20 bg-[#181D19]" : "border-[#E2E1D8] bg-[#F4F4EF]",
      )}
    >
      <div className="flex items-center justify-between px-2 pt-1.5">
        <span className={cn("h-1 w-4 rounded-full", tone === "dark" ? "bg-white/30" : "bg-black/15")} />
        <span className={cn("h-1 w-2 rounded-full", tone === "dark" ? "bg-white/30" : "bg-black/15")} />
      </div>
      <div className={cn("mx-1.5 mt-1.5 flex h-3 items-center justify-center rounded-[3px]", isPhoto ? "bg-white/10" : "bg-white")}>
        <span className={cn("h-1 w-5 rounded-full", tone === "dark" ? "bg-white/30" : "bg-black/15")} />
      </div>
      {isPhoto ? (
        <div className="relative mx-1 mt-1 h-[48px] overflow-hidden rounded-[3px] bg-[#6D8173]">
          <span className="absolute left-1.5 top-1.5 h-1 w-8 rounded-full bg-white/60" />
          <span className="absolute bottom-1.5 left-1.5 h-1 w-12 rounded-full bg-white/35" />
          <span className="absolute bottom-1.5 right-1.5 grid h-3 w-3 place-items-center rounded-full bg-white/30">
            <span className="ml-[1px] h-0 w-0 border-y-[2px] border-l-[3px] border-y-transparent border-l-white/80" />
          </span>
        </div>
      ) : isWallet ? (
        <div className={cn("mx-1 mt-1 h-[44px] rounded-[4px] p-1.5", type === "redpacket" ? "bg-[#CD4A3B]" : type === "transfer" ? "bg-[#F5A623]" : "bg-[#07C160]")}>
          <span className="block h-1 w-6 rounded-full bg-white/50" />
          <span className="mt-1 block text-[7px] font-medium leading-none text-white">
            {type === "qrcode" ? "QR CARD" : type === "transfer" ? "¥ 88.00" : "¥ 12,860"}
          </span>
        </div>
      ) : isGrid ? (
        <div className="mx-1.5 mt-1.5 grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className={cn("aspect-square rounded-[2px]", i % 3 === 0 ? "bg-[#B7D7C1]" : "bg-white")} />
          ))}
        </div>
      ) : isChat ? (
        <div className="mt-1.5 space-y-1 px-1.5">
          <div className="ml-1 h-2.5 w-[28px] rounded-[2px] bg-white" />
          <div className="h-2.5 w-[34px] rounded-[2px] bg-[#95EC69]" />
          <div className="ml-2 h-2.5 w-[38px] rounded-[2px] bg-white" />
          <div className="h-2.5 w-[22px] rounded-[2px] bg-[#95EC69]" />
        </div>
      ) : (
        <div className="mt-1.5 space-y-[3px] px-1.5">
          {Array.from({ length: type === "newfriends" ? 3 : 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1 rounded-[2px] bg-white p-1">
              <span className={cn("h-2.5 w-2.5 rounded-full", type === "profile" ? "bg-[#D8C6B4]" : "bg-[#CADDC9]")} />
              <span className="min-w-0 flex-1">
                <span className="block h-[2px] w-[60%] rounded-full bg-black/15" />
                <span className="mt-[2px] block h-[2px] w-[80%] rounded-full bg-black/[0.07]" />
              </span>
            </div>
          ))}
        </div>
      )}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 flex h-4 items-center justify-around border-t px-1",
          tone === "dark" ? "border-white/10 bg-black/40" : "border-black/[0.04] bg-white/70",
        )}
      >
        {["微信", "通讯录", "发现", "我"].map((t, i) => (
          <span key={t} className={cn("text-[4px]", i === 0 ? "text-[#07C160]" : tone === "dark" ? "text-white/40" : "text-black/25")}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function DesktopScreenArt({ type }: { type: string }) {
  return (
    <div className="h-[110px] w-full overflow-hidden rounded-[8px] border border-[#E1E0D7] bg-[#F6F6F1] shadow-sm">
      <div className="flex h-3.5 items-center gap-1 border-b border-[#E6E5DC] bg-[#EDEDE8] px-1.5">
        <span className="h-1 w-1 rounded-full bg-[#DF8D7F]" />
        <span className="h-1 w-1 rounded-full bg-[#DFC27F]" />
        <span className="h-1 w-1 rounded-full bg-[#A6C6A2]" />
      </div>
      <div className="flex h-[calc(100%-14px)]">
        <div className="flex w-3 flex-col items-center gap-1 bg-[#2E332E] py-1.5">
          <span className="h-1.5 w-1.5 rounded-sm bg-[#BCC8B9]" />
          <span className="mt-1 h-1.5 w-1.5 rounded-sm bg-[#07C160]" />
          <span className="h-1.5 w-1.5 rounded-sm bg-white/20" />
          <span className="h-1.5 w-1.5 rounded-sm bg-white/20" />
        </div>
        {type === "lock" ? (
          <div className="flex flex-1 flex-col items-center justify-center bg-[#1D2420] p-2">
            <span className="h-5 w-5 rounded-full bg-[#07C160]/80" />
            <span className="mt-1.5 h-1.5 w-14 rounded-full bg-white/40" />
            <span className="mt-2 h-3 w-16 rounded bg-[#07C160]" />
          </div>
        ) : (
          <>
            <div className="w-[42px] border-r border-[#E7E6DE] bg-white/60 p-1">
              <span className="block h-1.5 w-7 rounded-full bg-black/15" />
              <span className="mt-1 block h-2 w-full rounded-sm bg-[#ECECE6]" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="mt-1.5 flex gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#D7D6CB]" />
                  <span className="flex-1">
                    <span className="block h-1 w-[85%] rounded-full bg-black/10" />
                    <span className="mt-[2px] block h-1 w-[55%] rounded-full bg-black/[0.05]" />
                  </span>
                </div>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col bg-[#F1F1EB]">
              <div className="h-4 border-b border-[#E7E6DE] bg-[#F5F5F0] px-2 py-1">
                <span className="block h-1 w-10 rounded-full bg-black/10" />
              </div>
              <div className="flex-1 space-y-1 p-2">
                {type === "chats" || type === "files" ? (
                  <>
                    <span className="block h-2.5 w-[34%] rounded-sm bg-white" />
                    <span className="ml-auto block h-2.5 w-[46%] rounded-sm bg-[#95EC69]" />
                    <span className="block h-2.5 w-[28%] rounded-sm bg-white" />
                    <span className="ml-auto block h-2.5 w-[38%] rounded-sm bg-[#95EC69]" />
                  </>
                ) : type === "mini" || type === "search_hub" ? (
                  <div className="grid grid-cols-4 gap-1">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <span key={i} className="aspect-square rounded-sm bg-white" />
                    ))}
                  </div>
                ) : type === "wallet" ? (
                  <div className="h-9 rounded bg-[#07C160] p-1.5">
                    <span className="block h-1 w-8 rounded bg-white/50" />
                    <span className="mt-1 block h-2 w-12 rounded-sm bg-white/85" />
                  </div>
                ) : (
                  <>
                    <div className="h-8 rounded bg-[#DDE5DC]" />
                    <div className="grid grid-cols-3 gap-1">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <span key={i} className="h-5 rounded bg-white" />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const store = useWeChatStore();
  const [desktopPage, setDesktopPage] = useState<DesktopPage>("chats");
  const [mobileScreen, setMobileScreen] = useState<MobileScreen>("chats");
  const [device, setDevice] = useState<DeviceView>("both");
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("all");
  const [mobileGroupFilter, setMobileGroupFilter] = useState<string>("全部");
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);
  const { message, notify } = useToast();
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setHeroLoaded(true), 80);
    return () => window.clearTimeout(t);
  }, []);

  const revealDesktop = (page: DesktopPage) => {
    setDesktopPage(page);
    const tooNarrow = typeof window !== "undefined" && window.innerWidth < 768;
    setDevice((d) => (d === "mobile" || (d === "both" && tooNarrow) ? "desktop" : d));
  };
  const revealMobile = (page: MobileScreen) => {
    setMobileScreen(page);
    setDevice((d) => (d === "desktop" ? "mobile" : d));
  };
  const openDesktop = (page: DesktopPage) => {
    revealDesktop(page);
    document.getElementById("showcase")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const openMobile = (page: MobileScreen) => {
    revealMobile(page);
    document.getElementById("showcase")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeDesktop = DESKTOP_PAGES.find((p) => p.id === desktopPage) || DESKTOP_PAGES[0];
  const activeMobile = MOBILE_PAGES.find((p) => p.id === mobileScreen) || MOBILE_PAGES[0];
  const currentMobileIndex = MOBILE_PAGES.findIndex((p) => p.id === mobileScreen);
  const currentDesktopIndex = DESKTOP_PAGES.findIndex((p) => p.id === desktopPage);

  const visibleDesktop = catalogFilter !== "mobile";
  const visibleMobile = catalogFilter !== "desktop";
  const filteredMobilePages =
    mobileGroupFilter === "全部"
      ? MOBILE_PAGES
      : MOBILE_PAGES.filter((p) => p.group === mobileGroupFilter);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F3F2EC] text-[#222923] antialiased">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-[#DDDDD4]/90 bg-[#F3F2EC]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-[64px] max-w-[1540px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <WeChatLogo className="h-[30px] w-[30px] drop-shadow-sm" />
            <div className="h-6 w-px bg-[#D7D7CD]" />
            <div className="leading-none">
              <div className="text-[17px] font-medium tracking-[-0.01em] text-[#1E2821]">
                微信 <span className="ml-0.5 font-serif text-[15px] italic text-[#7A847A]">unfolded</span>
              </div>
              <div className="mt-1.5 text-[6.5px] font-medium tracking-[0.28em] text-[#9AA095]">
                WECHAT DUAL-PLATFORM UI ARCHIVE
              </div>
            </div>
          </div>
          <nav className="hidden items-center gap-7 text-[11px] text-[#666E65] md:flex">
            <ScrollLink target="showcase" className="transition hover:text-[#17251C]">
              双端交互台
            </ScrollLink>
            <ScrollLink target="screen-index" className="transition hover:text-[#17251C]">
              38 页全图鉴
            </ScrollLink>
            <ScrollLink target="design-language" className="transition hover:text-[#17251C]">
              设计规范系统
            </ScrollLink>
            <ScrollLink target="about" className="transition hover:text-[#17251C]">
              参赛作品说明
            </ScrollLink>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                store.setInspectSpecs(!store.inspectSpecs);
                notify(store.inspectSpecs ? "已关闭规范尺寸标注透视" : "已开启设计规范标注透视（Redline Inspector）");
              }}
              className={cn(
                "hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9.5px] font-medium transition lg:flex",
                store.inspectSpecs
                  ? "border-[#FA5151] bg-[#FFF1F0] text-[#FA5151]"
                  : "border-[#D8DAD0] bg-white/60 text-[#5C645B] hover:bg-white",
              )}
            >
              <Ruler size={11} /> {store.inspectSpecs ? "标注透视：开启" : "规范标注"}
            </button>
            <button
              onClick={() => store.setWechatDark(!store.wechatDark)}
              className={cn(
                "hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9.5px] font-medium transition sm:flex",
                store.wechatDark
                  ? "border-[#233128] bg-[#1D2821] text-[#8CE6B0]"
                  : "border-[#D8DAD0] bg-white/60 text-[#5C645B] hover:bg-white",
              )}
            >
              {store.wechatDark ? <Sun size={11} /> : <Moon size={11} />}
              {store.wechatDark ? "微信深色" : "微信浅色"}
            </button>
            <ScrollLink
              target="screen-index"
              className="hidden rounded-full bg-[#1F2A22] px-4 py-2 text-[10px] font-medium text-white transition hover:bg-[#344139] sm:block"
            >
              浏览 38 个页面 <ArrowUpRight size={11} className="ml-1 inline" />
            </ScrollLink>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-8 w-8 place-items-center rounded-full border border-[#D8DAD0] text-[#4A5148] md:hidden"
            >
              {menuOpen ? <X size={15} /> : <Menu size={15} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-[#E2E1D8] bg-[#F3F2EC] px-6 py-4 md:hidden">
            <div className="grid grid-cols-2 gap-3 text-[12px] text-[#555D53]">
              {[
                ["双端交互台", "showcase"],
                ["38 页全图鉴", "screen-index"],
                ["设计规范系统", "design-language"],
                ["参赛作品说明", "about"],
              ].map(([label, target]) => (
                <ScrollLink key={target} target={target} className="rounded-lg border border-[#DFDFD5] px-3 py-2.5 text-left">
                  {label}
                </ScrollLink>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage: "radial-gradient(#D8D8CE 0.7px, transparent 0.7px)",
            backgroundSize: "18px 18px",
            maskImage: "linear-gradient(to bottom, black, transparent 82%)",
          }}
        />
        <div className="pointer-events-none absolute -right-28 top-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,#D7E8D9_0%,transparent_65%)] opacity-70" />
        <div className="relative mx-auto grid max-w-[1540px] items-center gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:gap-14">
          <div className={cn("transition-all duration-700", heroLoaded ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
            <div className="flex flex-wrap items-center gap-2.5 text-[8px] font-medium tracking-[0.18em] text-[#7C8579]">
              <span className="h-[1px] w-6 bg-[#AAB2A6]" />
              UI DESIGN COMPETITION SHOWCASE · 桌面端 × 移动端全量复刻
              <span className="rounded-full border border-[#CBD7C9] bg-[#EBF2E8] px-2 py-0.5 text-[7.5px] tracking-[0.1em] text-[#07994E]">
                38 SCREENS · LIVE SYNC
              </span>
            </div>
            <h1 className="mt-4 text-[36px] font-medium leading-[1.14] tracking-[-0.055em] text-[#1C271F] sm:text-[48px] lg:text-[54px]">
              让每一次连接，
              <br />
              <span className="relative inline-block">
                都自然发生。
                <svg className="absolute -bottom-1 left-0 h-[8px] w-full text-[#07C160]/55" viewBox="0 0 260 10" preserveAspectRatio="none">
                  <path d="M1 8C58 2 152 1 259 6" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <span className="h-px w-7 bg-[#C7C8BD]" />
              <p className="font-serif text-[15px] italic leading-none text-[#697567] sm:text-[18px]">
                Every connection, thoughtfully recreated across Desktop & Mobile.
              </p>
            </div>
            <p className="mt-3 max-w-[565px] text-[10.5px] leading-[1.85] text-[#6B746A] sm:text-[11.5px]">
              面向 UI 设计比赛打造的微信双端交互图鉴。完整覆盖 <strong className="font-medium text-[#2A3A2E]">12 个桌面端界面</strong> 与{" "}
              <strong className="font-medium text-[#2A3A2E]">26 个移动端界面</strong>，支持<strong className="font-medium text-[#07994E]">双端消息与朋友圈实时同步</strong>、
              深浅色模式一键切换、语音转文字、数字键盘转账、状态 8.0 及设计规范标注透视。
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="group flex items-center gap-3 rounded-full bg-[#1D2A21] py-2 pl-5 pr-2 text-[11px] font-medium text-white shadow-[0_8px_22px_rgba(29,42,33,.16)] transition hover:bg-[#2E3E33]"
              >
                进入双端同屏体验
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#07C160] transition group-hover:rotate-[-35deg]">
                  <ArrowDownRight size={14} />
                </span>
              </button>
              <ScrollLink
                target="screen-index"
                className="flex items-center gap-2 rounded-full border border-[#D5D7CD] bg-[#F7F7F2]/70 px-4 py-2.5 text-[10.5px] text-[#586056] transition hover:border-[#BFC5B8] hover:bg-white"
              >
                浏览 38 页图鉴 <ArrowRight size={12} />
              </ScrollLink>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[8.5px] text-[#8E968C]">
              {[
                ["38", "可交互界面"],
                ["26", "手机端页面"],
                ["12", "桌面端页面"],
                ["100%", "双端状态同步"],
              ].map(([value, label]) => (
                <div key={label} className="flex items-baseline gap-1.5">
                  <span className="text-[13.5px] font-semibold tracking-[-0.03em] text-[#2F3F33]">{value}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            className={cn(
              "relative hidden h-[276px] transition-all delay-150 duration-1000 lg:block",
              heroLoaded ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
            )}
          >
            <div className="absolute right-0 top-0 w-[84%] overflow-hidden rounded-[22px] bg-[#1B3527] p-6 text-white shadow-[0_24px_60px_rgba(30,50,37,.18)]">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.14]"
                style={{ backgroundImage: "radial-gradient(#fff 0.6px, transparent 0.6px)", backgroundSize: "14px 14px" }}
              />
              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <WeChatLogo className="h-6 w-6" />
                  <span className="text-[7px] font-medium tracking-[0.22em] text-white/55">
                    WECHAT
                    <br />
                    ARCHIVE
                  </span>
                </div>
                <span className="font-serif text-[10px] italic text-[#9AC3A7]">Desktop 4.0 × iOS 8.0.62</span>
              </div>
              <div className="relative z-10 mt-7 flex items-end justify-between">
                <div>
                  <div className="text-[44px] font-medium leading-none tracking-[-0.06em]">
                    微信<span className="ml-1 text-[24px] font-light text-[#A9CBB4]">。</span>
                  </div>
                  <div className="mt-2.5 text-[8px] tracking-[0.24em] text-white/45">38 INTERACTIVE SCREENS · SYNCED</div>
                </div>
                <div className="h-13 w-13 rounded-full border border-white/15 bg-[#07C160] p-2.5">
                  <div className="grid h-full w-full grid-cols-2 gap-1">
                    <span className="rounded-[2px] bg-white/80" />
                    <span className="rounded-[2px] bg-white/25" />
                    <span className="rounded-[2px] bg-white/25" />
                    <span className="rounded-[2px] bg-white/80" />
                  </div>
                </div>
              </div>
              <div className="relative z-10 mt-6 flex items-center justify-between border-t border-white/10 pt-2.5">
                <span className="text-[8px] text-white/55">当前状态：{store.myStatus.emoji} {store.myStatus.label}</span>
                <span className="flex items-center gap-1 text-[8px] text-[#9AC3A7]">
                  双端实时联动 <ArrowUpRight size={9} />
                </span>
              </div>
            </div>

            <div className="absolute -bottom-1 left-0 w-[195px] rotate-[-4deg] rounded-xl border border-white/80 bg-[#FBFBF6] p-3 shadow-[0_14px_34px_rgba(35,49,38,.13)]">
              <div className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-[3px] bg-[#07C160]" />
                <span className="text-[7.5px] font-medium text-[#455246]">林小满</span>
                <span className="ml-auto text-[6px] text-[#A9AEA5]">跨端同步</span>
              </div>
              <div className="mt-2 rounded-[3px] rounded-tl-none bg-white px-2 py-1.5 text-[8px] leading-4 text-[#5A6359] shadow-sm">
                这周末的展，一起去吧 🌿
              </div>
              <div className="ml-auto mt-1.5 w-fit rounded-[3px] rounded-tr-none bg-[#95EC69] px-2 py-1.5 text-[8px] text-[#31402F]">
                好呀，美术馆见！
              </div>
            </div>

            <div className="absolute bottom-4 right-5 z-10 h-[106px] w-[82px] rotate-[5deg] overflow-hidden rounded-[10px] border-[3px] border-[#FAFAF4] bg-[#DDE3D9] shadow-lg">
              <img
                src="https://images.pexels.com/photos/35983785/pexels-photo-35983785.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=220&h=280"
                alt="春日花束"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-2 pb-1.5 pt-4 text-[6px] text-white">
                Moments Sync
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Stage */}
      <section id="showcase" ref={stageRef} className="scroll-mt-[74px] px-3 pb-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1540px] overflow-hidden rounded-[22px] border border-[#D8D8CE] bg-[#EAE9E2] shadow-[0_12px_40px_rgba(43,53,44,.06)]">
          {/* Top Stage Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9D9CF] bg-[#F0EFE9]/95 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1F2B22] text-[#A5D8B3]">
                <Sparkles size={13} />
              </span>
              <div>
                <div className="flex items-center gap-2 text-[10.5px] font-medium text-[#2E3A32]">
                  实时双端同屏工作台
                  <span className="rounded bg-[#07C160]/15 px-1.5 py-0.5 text-[8px] font-medium text-[#07994E]">
                    双向同步已开启
                  </span>
                </div>
                <div className="mt-0.5 text-[8.5px] text-[#7D857B]">
                  {store.lastSyncEvent?.text || "在一端发送消息、发朋友圈或改状态，另一端即时响应"}
                </div>
              </div>
            </div>

            <div className="order-3 flex w-full flex-wrap items-center justify-between gap-2 sm:order-none sm:w-auto">
              <div className="flex items-center divide-x divide-[#D9D9CF] rounded-full border border-[#D9DAD2] bg-[#F7F7F1] px-3 py-1.5">
                <PageSelect
                  label="Desktop"
                  value={desktopPage}
                  options={DESKTOP_PAGES as { id: DesktopPage; title: string; english: string }[]}
                  onChange={(v) => revealDesktop(v)}
                />
                <div className="ml-3 flex items-center pl-3">
                  <PageSelect
                    label="Mobile"
                    accent
                    value={mobileScreen}
                    options={MOBILE_PAGES}
                    onChange={(v) => revealMobile(v)}
                  />
                </div>
              </div>
              <DeviceToggle value={device} onChange={setDevice} />
            </div>
          </div>

          {/* Interactive Scenario Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DFDFD5] bg-[#F6F5EF] px-4 py-2 sm:px-5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[9px] font-medium text-[#7D857B]">比赛演示剧本：</span>
              {[
                {
                  label: "💬 双端同步聊天",
                  action: () => {
                    setDevice("both");
                    setDesktopPage("chats");
                    setMobileScreen("chat");
                    notify("已对齐桌面端与手机端聊天窗口，发送消息即可测试双向同步");
                  },
                },
                {
                  label: "💸 手机数字键盘转账",
                  action: () => {
                    setDesktopPage("chats");
                    setMobileScreen("transfer");
                    notify("点击手机端数字键盘「转账」，桌面端聊天将同步收到转账卡片");
                  },
                },
                {
                  label: "🌿 发表朋友圈双端同步",
                  action: () => {
                    setDesktopPage("moments");
                    setMobileScreen("moments_post");
                    notify("在手机端点击「发表」，左侧桌面端朋友圈将立即刷出新动态");
                  },
                },
                {
                  label: "✨ 微信 8.0 个人状态",
                  action: () => {
                    setDesktopPage("chats");
                    setMobileScreen("status");
                    notify("选择任意状态并点击「就这样」，双端状态徽章将同步更新");
                  },
                },
                {
                  label: "💿 音乐与浮窗任务栏",
                  action: () => {
                    setMobileScreen("floating");
                    notify("已打开微信黑胶音乐播放器与多任务浮窗");
                  },
                },
                {
                  label: "🔒 桌面端锁定与解锁",
                  action: () => {
                    setDesktopPage("lock");
                    notify("已锁定桌面端微信，点击「立即解锁」可恢复会话");
                  },
                },
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={s.action}
                  className="rounded-full border border-[#DCDCD2] bg-white px-2.5 py-1 text-[9.5px] text-[#3F4A40] shadow-2xs transition hover:border-[#07C160] hover:text-[#07994E]"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => store.setWechatDark(!store.wechatDark)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-medium transition",
                  store.wechatDark
                    ? "border-[#07C160] bg-[#1E2A23] text-[#7CE8A5]"
                    : "border-[#DCDCD2] bg-white text-[#555]",
                )}
              >
                {store.wechatDark ? <Sun size={10} /> : <Moon size={10} />}
                {store.wechatDark ? "深色模式中" : "切换深色"}
              </button>
              <button
                onClick={() => store.setInspectSpecs(!store.inspectSpecs)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-medium transition",
                  store.inspectSpecs
                    ? "border-[#FA5151] bg-[#FFF1F0] text-[#FA5151]"
                    : "border-[#DCDCD2] bg-white text-[#555]",
                )}
              >
                <Ruler size={10} /> 尺寸标注
              </button>
            </div>
          </div>

          {/* Stage Canvas */}
          <div className="stage-canvas relative overflow-x-auto overflow-y-hidden p-4 sm:p-7 lg:px-8 lg:py-8">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.28]"
              style={{ backgroundImage: "radial-gradient(#9CA79A 0.7px, transparent 0.7px)", backgroundSize: "20px 20px" }}
            />
            <div className="pointer-events-none absolute -left-16 top-14 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,#C9DFCC_0%,transparent_68%)] opacity-50" />
            <div className="pointer-events-none absolute -bottom-16 -right-10 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,#DCE5C8_0%,transparent_66%)] opacity-45" />

            <div
              className={cn(
                "relative z-10 mx-auto flex w-full items-start justify-center",
                device === "both" && "flex-col gap-9 xl:flex-row xl:gap-8",
                device === "desktop" && "w-full",
              )}
            >
              <div
                className={cn(
                  "min-w-0",
                  device === "mobile" ? "hidden" : device === "both" ? "hidden md:block md:w-full xl:flex-1" : "block w-full",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-[18px] items-center gap-1 rounded-full border border-[#D3D6CC] bg-[#F2F2EB] px-2 text-[7.5px] font-medium tracking-[0.12em] text-[#6D766B]">
                      <Monitor size={9} /> DESKTOP 4.0
                    </span>
                    <span className="text-[8.5px] text-[#8F968B]">12 个桌面界面 · 跨端实时联动</span>
                  </div>
                  <div className="flex items-center gap-2 text-[8px] text-[#8D9489]">
                    <span className="text-[#535D52]">{activeDesktop.title}</span>
                    <span className="text-[#B5BAB0]">/</span>
                    <span className="font-serif italic">{activeDesktop.english}</span>
                  </div>
                </div>
                <DesktopWeChat page={desktopPage} onPageChange={setDesktopPage} onNotify={notify} />
              </div>

              <div className={cn("flex flex-col items-center", device === "desktop" && "hidden", device === "both" && "mx-auto xl:mx-0")}>
                <div className="mb-3 flex w-full max-w-[336px] items-center justify-between">
                  <div className="flex items-center gap-1.5 rounded-full border border-[#D3D6CC] bg-[#F2F2EB] px-2 py-1 text-[7.5px] font-medium tracking-[0.12em] text-[#6D766B]">
                    <Smartphone size={9} /> MOBILE 8.0.62
                  </div>
                  <div className="flex items-center gap-1.5 text-[8px] text-[#8D9489]">
                    <span className="text-[#535D52]">{activeMobile.title}</span>
                    <span className="text-[#B5BAB0]">/</span>
                    <span className="font-serif italic">{activeMobile.english}</span>
                  </div>
                </div>
                <PhoneWeChat screen={mobileScreen} onScreenChange={setMobileScreen} onNotify={notify} />
              </div>
            </div>

            {/* Bottom Stage Pager */}
            <div className="relative z-10 mx-auto mt-6 flex max-w-[1060px] flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D7D9CE]/80 bg-[#F4F3ED]/85 px-3.5 py-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[8.5px] font-medium text-[#687266]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#07C160] opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#07C160]" />
                </span>
                <span>点击图片可开启微信看图灯箱与 OCR 提取文字</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const next = MOBILE_PAGES[(currentMobileIndex - 1 + MOBILE_PAGES.length) % MOBILE_PAGES.length];
                    setMobileScreen(next.id);
                    notify(`移动端 · ${next.title}`);
                  }}
                  className="grid h-6 w-6 place-items-center rounded-full border border-[#DADBD2] bg-white/70 text-[#7B8379] transition hover:bg-white hover:text-[#263528]"
                  aria-label="上一个移动端页面"
                >
                  <ArrowLeft size={11} />
                </button>
                <div className="min-w-[148px] px-1 text-center">
                  <div className="text-[8.5px] font-medium text-[#566155]">
                    手机端 {String(currentMobileIndex + 1).padStart(2, "0")} / {String(MOBILE_PAGES.length).padStart(2, "0")} · {activeMobile.title}
                  </div>
                  <div className="mt-0.5 text-[6.5px] tracking-[0.12em] text-[#A0A69B]">
                    桌面端 {String(currentDesktopIndex + 1).padStart(2, "0")} / {String(DESKTOP_PAGES.length).padStart(2, "0")} · {activeDesktop.title}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = MOBILE_PAGES[(currentMobileIndex + 1) % MOBILE_PAGES.length];
                    setMobileScreen(next.id);
                    notify(`移动端 · ${next.title}`);
                  }}
                  className="grid h-6 w-6 place-items-center rounded-full border border-[#DADBD2] bg-white/70 text-[#7B8379] transition hover:bg-white hover:text-[#263528]"
                  aria-label="下一个移动端页面"
                >
                  <ArrowRight size={11} />
                </button>
              </div>
              <div className="flex items-center gap-2 text-[8px] text-[#959C92]">
                <button
                  onClick={() => document.getElementById("screen-index")?.scrollIntoView({ behavior: "smooth" })}
                  className="flex items-center gap-1 rounded-full bg-[#E8EDE4] px-2.5 py-1 font-medium text-[#475B48]"
                >
                  展开全部 38 页图鉴 <ArrowDownRight size={10} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Screen Index (38 Screens) */}
      <section id="screen-index" className="scroll-mt-[82px] px-5 pb-16 pt-12 sm:px-8 sm:pt-16">
        <div className="mx-auto max-w-[1540px]">
          <div className="flex flex-col justify-between gap-6 border-b border-[#D9D9CF] pb-7 md:flex-row md:items-end">
            <div>
              <div className="flex items-center gap-2 text-[8px] font-medium tracking-[0.18em] text-[#8C9388]">
                <span className="h-1 w-1 rounded-full bg-[#07C160]" /> THE 38-SCREEN INDEX / 双端全页面图鉴
              </div>
              <h2 className="mt-4 text-[32px] font-medium leading-[1.25] tracking-[-0.04em] text-[#202B23] sm:text-[40px]">
                不只是几个界面，
                <br />
                <span className="font-serif font-normal italic text-[#5B6D5C]">而是 38 个页面的完整生态。</span>
              </h2>
            </div>
            <div className="flex flex-col items-start gap-4 md:items-end">
              <p className="max-w-[390px] text-[10.5px] leading-[1.8] text-[#7A8379] md:text-right">
                涵盖桌面端 12 个功能视图与移动端 26 个高频场景。点击任意图鉴卡片，即可在上方交互台中实时载入该页面。
              </p>
              <div className="flex items-center gap-1 rounded-full border border-[#D9DAD1] bg-[#F7F7F1] p-0.5">
                {[
                  { id: "all" as const, label: "全部 38" },
                  { id: "desktop" as const, label: "桌面端 12" },
                  { id: "mobile" as const, label: "移动端 26" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setCatalogFilter(f.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[9px]",
                      catalogFilter === f.id ? "bg-[#223027] text-white shadow-sm" : "text-[#858C81] hover:text-[#3F473D]",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7 space-y-10">
            {visibleDesktop && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-6 w-6 place-items-center rounded-full border border-[#CDD2C7] bg-[#F7F7F1] text-[#5A675A]">
                      <Monitor size={12} />
                    </span>
                    <h3 className="text-[12px] font-medium text-[#39453B]">
                      桌面端 <span className="ml-1 font-serif text-[11px] font-normal italic text-[#9AA296]">Desktop WeChat 4.0</span>
                    </h3>
                    <span className="rounded bg-[#E9EDE3] px-1.5 py-0.5 text-[7px] text-[#7B8978]">12 SCREENS</span>
                  </div>
                  <button onClick={() => setCatalogFilter("desktop")} className="text-[8.5px] text-[#8B9287] hover:text-[#3F473D]">
                    只看桌面端 <ArrowRight size={10} className="inline" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {DESKTOP_PAGES.map((page, i) => (
                    <button
                      key={page.id}
                      onClick={() => openDesktop(page.id as DesktopPage)}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border bg-[#F9F9F4] p-2.5 text-left transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(36,50,38,.09)]",
                        desktopPage === page.id ? "border-[#07C160]/70 ring-2 ring-[#07C160]/10" : "border-[#E2E1D8] hover:border-[#C7CDC0]",
                      )}
                    >
                      <div className="flex items-center justify-between px-0.5 pb-2">
                        <span className="text-[7.5px] font-medium tracking-[0.14em] text-[#A0A69B]">
                          {String(i + 1).padStart(2, "0")} / DESKTOP
                        </span>
                        <div className="flex items-center gap-1">
                          {page.badge && (
                            <span
                              className={cn(
                                "rounded px-1 py-0.2 text-[6.5px] font-semibold",
                                page.badge === "SYNC" ? "bg-[#E8F7EE] text-[#07994E]" : "bg-[#FFF2E5] text-[#D7822C]",
                              )}
                            >
                              {page.badge}
                            </span>
                          )}
                          <ArrowUpRight size={11} className="text-[#B0B6AC] transition group-hover:text-[#07C160]" />
                        </div>
                      </div>
                      <DesktopScreenArt type={page.id} />
                      <div className="px-0.5 pt-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11.5px] font-medium text-[#313D33]">{page.title}</span>
                          <span className="font-serif text-[8px] italic text-[#9DA497]">{page.english}</span>
                        </div>
                        <div className="mt-1 line-clamp-1 text-[8px] text-[#8B9287]">{page.caption}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visibleMobile && (
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-6 w-6 place-items-center rounded-full border border-[#CDD2C7] bg-[#F7F7F1] text-[#5A675A]">
                      <Smartphone size={12} />
                    </span>
                    <h3 className="text-[12px] font-medium text-[#39453B]">
                      移动端 <span className="ml-1 font-serif text-[11px] font-normal italic text-[#9AA296]">Mobile WeChat 8.0.62</span>
                    </h3>
                    <span className="rounded bg-[#E9EDE3] px-1.5 py-0.5 text-[7px] text-[#7B8978]">26 SCREENS</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {["全部", "核心", "关系", "发现", "我", "服务"].map((g) => (
                      <button
                        key={g}
                        onClick={() => setMobileGroupFilter(g)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[8.5px] transition",
                          mobileGroupFilter === g
                            ? "bg-[#07C160] text-white"
                            : "bg-[#EAE9E1] text-[#6E766C] hover:bg-[#DFDFD5]",
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
                  {filteredMobilePages.map((page, i) => (
                    <button
                      key={page.id}
                      onClick={() => openMobile(page.id)}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border bg-[#F9F9F4] p-2.5 text-left transition duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(36,50,38,.09)]",
                        mobileScreen === page.id ? "border-[#07C160]/70 ring-2 ring-[#07C160]/10" : "border-[#E2E1D8] hover:border-[#C7CDC0]",
                      )}
                    >
                      <div className="flex items-center justify-between px-0.5 pb-2">
                        <span className="text-[7.5px] font-medium tracking-[0.14em] text-[#A0A69B]">
                          {String(i + 1).padStart(2, "0")} · {page.group}
                        </span>
                        <div className="flex items-center gap-1">
                          {page.badge && (
                            <span
                              className={cn(
                                "rounded px-1 py-0.2 text-[6.5px] font-semibold",
                                page.badge === "SYNC" ? "bg-[#E8F7EE] text-[#07994E]" : "bg-[#FFF2E5] text-[#D7822C]",
                              )}
                            >
                              {page.badge}
                            </span>
                          )}
                          <ArrowUpRight size={11} className="text-[#B0B6AC] transition group-hover:text-[#07C160]" />
                        </div>
                      </div>
                      <div className="flex justify-center rounded-lg bg-[#EEEDE5] pb-0 pt-2.5">
                        <MiniScreenArt
                          type={page.id}
                          tone={["channels", "call", "redpacket", "status", "floating"].includes(page.id) ? "dark" : "light"}
                        />
                      </div>
                      <div className="px-0.5 pt-3">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-[11.5px] font-medium text-[#313D33]">{page.title}</span>
                          <span className="font-serif text-[7.5px] italic text-[#9DA497]">{page.english}</span>
                        </div>
                        <div className="mt-1 line-clamp-1 text-[8px] text-[#8B9287]">{page.caption}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Design Language */}
      <section id="design-language" className="scroll-mt-[82px] border-y border-[#DCDCD2] bg-[#EDECE5] px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1540px]">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
            <div>
              <div className="flex items-center gap-2 text-[8px] font-medium tracking-[0.18em] text-[#8C9388]">
                <span className="h-1 w-1 rounded-full bg-[#07C160]" /> DESIGN LANGUAGE / 设计语言
              </div>
              <h2 className="mt-4 text-[32px] font-medium leading-[1.3] tracking-[-0.04em] text-[#202B23] sm:text-[40px]">
                克制，是为了
                <br />
                <span className="font-serif font-normal italic text-[#5B6D5C]">让内容被看见。</span>
              </h2>
              <p className="mt-4 max-w-[350px] text-[10.5px] leading-[1.9] text-[#798278]">
                微信的视觉从来不喧哗。大量留白、克制的灰阶与唯一的绿色强调，让界面退后一步，把每一次沟通推到前面。
              </p>
              <div className="mt-7 space-y-3">
                {[
                  ["01", "熟悉感与直觉优先", "不为了不同而不同，让桌面端三栏效率与手机端单手触控各得其所。"],
                  ["02", "单一绿色品牌强调", "微信绿 (#07C160) 只属于「可行动」与「已连接」的元素，层级清晰。"],
                  ["03", "跨端无感流转", "从手机扫码、消息互传到浮窗接力，双端如同同一块画布的自然延展。"],
                ].map(([n, title, desc]) => (
                  <div key={n} className="flex gap-3 border-t border-[#D4D5CA] pt-3">
                    <span className="font-serif text-[11px] italic text-[#8E998B]">{n}</span>
                    <div>
                      <div className="text-[10.5px] font-medium text-[#3D4B40]">{title}</div>
                      <div className="mt-1 text-[9px] leading-4 text-[#879085]">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#DFE0D6] bg-[#F8F8F2] p-5 shadow-[0_2px_12px_rgba(45,56,46,.03)] sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-medium tracking-[0.12em] text-[#737E70]">COLOR SYSTEM · 浅色与深色双轨</span>
                  <span className="text-[8px] text-[#A1A79C]">6 Core Tokens</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[
                    ["#07C160", "WeChat Green", "品牌与主行动"],
                    ["#95EC69", "Bubble Green", "发送方气泡"],
                    ["#191919", "Ink / Dark", "主字色与深色底"],
                    ["#576B95", "Link Slate", "朋友圈与交互蓝"],
                    ["#EDEDED", "Mist Surface", "导航与中性灰底"],
                    ["#FA5151", "Badge Red", "未读与重要提醒"],
                  ].map(([hex, name, desc]) => (
                    <div key={hex}>
                      <div className="h-[52px] rounded-lg border border-black/[0.04] shadow-inner" style={{ background: hex }} />
                      <div className="mt-2 text-[8.5px] font-medium text-[#49544A]">{name}</div>
                      <div className="mt-0.5 text-[7.5px] tracking-wider text-[#9AA196]">{hex}</div>
                      <div className="mt-0.5 text-[7px] text-[#B0B6AB]">{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#DFE0D6] bg-[#F8F8F2] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-medium tracking-[0.12em] text-[#737E70]">TYPOGRAPHY</span>
                  <span className="font-serif text-[10px] italic text-[#A0A69B]">PingFang SC × Inter</span>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-[32px] font-medium tracking-[-0.04em] text-[#253127]">Aa</span>
                  <span className="text-[21px] text-[#6A7569]">微信设计</span>
                  <span className="ml-auto text-[7.5px] text-[#A1A79C]">4pt Baseline</span>
                </div>
                <div className="mt-3 space-y-1 border-t border-[#E4E4DA] pt-3">
                  {[
                    ["导航标题 / NavBar", "15.5px / 500", "text-[13px]"],
                    ["会话正文 / Bubble", "13px / 400 · 1.55", "text-[11px]"],
                    ["时间戳与辅助 / Meta", "10px / 400", "text-[9px]"],
                  ].map(([label, spec, cls]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className={cn("text-[#49544A]", cls)}>{label}</span>
                      <span className="text-[7px] tracking-wider text-[#A5ABA0]">{spec}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#DFE0D6] bg-[#F8F8F2] p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-medium tracking-[0.12em] text-[#737E70]">COMPONENT ANATOMY</span>
                  <span className="text-[8px] text-[#A1A79C]">Interactive Atoms</span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative max-w-[150px] rounded-md bg-white px-2.5 py-1.5 text-[9px] text-[#444] shadow-sm">
                      下午三点，美术馆见 🌿
                      <span className="absolute -right-1 top-2 h-2 w-2 rotate-45 bg-white" />
                    </div>
                    <div className="rounded-md bg-[#95EC69] px-2.5 py-1.5 text-[9px] text-[#2E3A2B]">好呀</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[8.5px] text-[#717C6E]">状态胶囊 / Status 8.0</span>
                    <span className="rounded-full bg-[#EDF8F1] px-2.5 py-0.5 text-[8px] font-medium text-[#07994E]">
                      {store.myStatus.emoji} {store.myStatus.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#E4E4DA] pt-2.5">
                    <span className="text-[8.5px] text-[#717C6E]">尺寸标注透视</span>
                    <button
                      onClick={() => store.setInspectSpecs(!store.inspectSpecs)}
                      className="rounded bg-[#FA5151]/10 px-2 py-0.5 text-[8px] font-medium text-[#FA5151]"
                    >
                      {store.inspectSpecs ? "已开启" : "点击开启"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#E4E4DA] pt-2.5">
                    <span className="text-[8.5px] text-[#717C6E]">双端栅格 / Grid</span>
                    <div className="flex items-center gap-2.5 text-[#07C160]">
                      <span className="grid h-5 w-5 place-items-center rounded bg-[#2E2E2E]">
                        <Circle size={7} fill="currentColor" />
                      </span>
                      <Grid2X2 size={12} className="text-[#6E796B]" />
                      <Monitor size={12} className="text-[#6E796B]" />
                      <Smartphone size={12} className="text-[#6E796B]" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#DFE0D6] bg-[#203428] p-5 text-white sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-[8px] font-medium tracking-[0.18em] text-[#8FB39A]">MICRO DETAIL · 像素级还原</div>
                    <div className="mt-2 font-serif text-[20px] italic leading-tight text-[#F3F1E7]">
                      “好的界面，应该在需要时出现，
                      <br />
                      在不需要时退后。”
                    </div>
                  </div>
                  <div className="flex items-center gap-5 border-l border-white/10 pl-5">
                    {[
                      ["60px", "桌面侧边栏"],
                      ["258px", "会话列表宽"],
                      ["44pt", "移动触控高"],
                      ["5px", "消息气泡圆角"],
                    ].map(([value, label]) => (
                      <div key={label}>
                        <div className="text-[17px] font-medium tracking-tight text-[#CFE3D3]">{value}</div>
                        <div className="mt-1 text-[7px] tracking-wider text-white/45">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-[82px] px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1540px]">
          <div className="grid gap-8 rounded-2xl border border-[#DDDED3] bg-[#F8F8F2] p-6 sm:p-9 lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
            <div>
              <div className="flex items-center gap-2 text-[8px] font-medium tracking-[0.18em] text-[#8C9388]">
                <span className="h-1 w-1 rounded-full bg-[#07C160]" /> ABOUT THE STUDY / 作品说明
              </div>
              <h2 className="mt-4 text-[27px] font-medium leading-[1.4] tracking-[-0.035em] text-[#233027] sm:text-[32px]">
                一次重新注视日常的
                <br />
                <span className="font-serif font-normal italic text-[#5B6D5C]">双端 UI 架构与交互实现。</span>
              </h2>
              <p className="mt-4 max-w-[520px] text-[10.5px] leading-[2] text-[#727D71]">
                本参赛作品以微信桌面端（4.0 架构）与移动端（8.0 架构）为研究对象，完成 38 个页面的高保真视觉与状态联动。
                无论是从电脑端发出的图片、在手机端通过数字键盘发起的转账，还是在朋友圈发表的九宫格动态，都能在双端之间实时流转。
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  "React 19",
                  "TypeScript",
                  "Tailwind CSS",
                  "Cross-Device Sync",
                  "38 Interactive Screens",
                  "Dark Mode",
                  "Redline Spec Inspector",
                ].map((tag) => (
                  <span key={tag} className="rounded-full border border-[#DEDFD5] bg-white/60 px-2.5 py-1 text-[8px] text-[#788375]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                ["38", "高保真页面", "桌面端 12 页 + 移动端 26 页", "SCREENS"],
                ["02", "双端实时同步", "消息、朋友圈、状态与深色主题", "LIVE SYNC"],
                ["80+", "可交互微动效", "语音转文字、看图OCR、红包与转账", "INTERACTIONS"],
                ["100%", "代码原生绘制", "支持打开尺寸标注透视层检验细节", "CRAFTED"],
              ].map(([value, label, desc, en]) => (
                <div key={label} className="rounded-xl border border-[#E2E2D8] bg-[#FDFDF8] p-4">
                  <div className="flex items-start justify-between">
                    <span className="text-[25px] font-medium leading-none tracking-[-0.04em] text-[#29372C]">{value}</span>
                    <span className="text-[6px] tracking-[0.13em] text-[#A6ACA1]">{en}</span>
                  </div>
                  <div className="mt-3 text-[9.5px] font-medium text-[#4C584D]">{label}</div>
                  <div className="mt-1 text-[8px] leading-4 text-[#959D92]">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-col justify-between gap-5 border-t border-[#DADBD1] pt-6 sm:flex-row sm:items-end">
            <div className="flex items-center gap-3">
              <WeChatLogo className="h-8 w-8" />
              <div>
                <div className="text-[14px] font-medium tracking-[-0.01em] text-[#2B362D]">
                  微信 <span className="font-serif italic text-[#788576]">unfolded</span>
                </div>
                <div className="mt-1 text-[7.5px] tracking-[0.16em] text-[#A0A69B]">
                  UI DESIGN COMPETITION · 38-SCREEN DUAL-PLATFORM EDITION
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[8.5px] text-[#969D92]">
              <span className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-[#07C160]" /> 非官方概念设计比赛作品
              </span>
              <span>仅用于 UI/UX 设计展示与交流</span>
              <ScrollLink target="showcase" className="text-[#5F6F60] hover:text-[#203026]">
                回到双端工作台 ↑
              </ScrollLink>
            </div>
          </div>
        </div>
      </section>

      {/* Global WeChat Image Viewer Lightbox */}
      {store.lightbox && (
        <div
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/85 p-6 backdrop-blur-md"
          onClick={() => {
            store.closeLightbox();
            setZoomed(false);
            setOcrResult(null);
          }}
        >
          <div
            className="relative flex max-w-[780px] flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex w-full items-center justify-between text-white/80">
              <div className="text-[12px]">
                <span className="font-medium text-white">{store.lightbox.author || "微信图片预览"}</span>
                {store.lightbox.caption && <span className="ml-2 text-white/60">· {store.lightbox.caption}</span>}
              </div>
              <button
                onClick={() => {
                  store.closeLightbox();
                  setZoomed(false);
                  setOcrResult(null);
                }}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-white/15 bg-[#111] shadow-2xl">
              <img
                src={store.lightbox.src}
                alt="预览大图"
                onClick={() => setZoomed((z) => !z)}
                className={cn(
                  "max-h-[65vh] w-auto cursor-zoom-in object-contain transition-transform duration-300",
                  zoomed && "scale-125 cursor-zoom-out",
                )}
              />
              {ocrResult && (
                <div className="absolute inset-x-4 bottom-4 rounded-xl border border-[#07C160]/40 bg-black/80 p-3.5 text-white backdrop-blur-md">
                  <div className="flex items-center justify-between text-[10px] text-[#6CE39E]">
                    <span>✦ 微信图片文字提取（OCR）已完成</span>
                    <button
                      onClick={() => {
                        notify("已复制提取的文字内容");
                      }}
                      className="underline"
                    >
                      复制全文
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-5 text-white/90">{ocrResult}</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] text-white backdrop-blur-md">
              <button
                onClick={() => setZoomed((z) => !z)}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 hover:bg-white/15"
              >
                <ZoomIn size={13} /> {zoomed ? "还原 100%" : "放大 125%"}
              </button>
              <button
                onClick={() =>
                  setOcrResult("「春日回声 · ECHOES OF SPRING」天目里美术馆 1–3 号展厅 · 每日 10:00–20:00 开放 · 把一整个春天装进白房子。")
                }
                className="flex items-center gap-1 rounded-full bg-[#07C160] px-3 py-1 font-medium text-white"
              >
                <FileText size={13} /> 提取图中文字
              </button>
              <button
                onClick={() => notify("已识别图中展览小程序码 · 正在跳转")}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 hover:bg-white/15"
              >
                <QrCode size={13} /> 识别图中二维码
              </button>
              <button
                onClick={() => notify("已转发至「春日设计小组」")}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 hover:bg-white/15"
              >
                <Share2 size={13} /> 转发给朋友
              </button>
              <button
                onClick={() => notify("原图已保存至系统相册")}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 hover:bg-white/15"
              >
                <Download size={13} /> 保存图片
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-7 z-[100] flex justify-center transition-all duration-300",
          message ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        <div className="flex max-w-[calc(100vw-32px)] items-center gap-2.5 rounded-full border border-white/10 bg-[#1D2821]/95 px-4 py-2.5 text-[10px] text-[#E9F2EA] shadow-[0_12px_40px_rgba(15,25,18,.28)] backdrop-blur">
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#07C160]">
            <Check size={10} />
          </span>
          <span className="line-clamp-1">{message || "操作成功"}</span>
        </div>
      </div>
    </div>
  );
}
