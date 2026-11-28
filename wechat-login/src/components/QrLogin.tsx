import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "../i18nContext";
import { WeChatLogo } from "./WeChatLogo";
import { cn } from "../utils/cn";

type QrStatus = "pending" | "scanned" | "confirmed" | "expired";

const LIFETIME = 60; // seconds
const FINAL_COUNTDOWN = 10; // poll faster in the last 10 seconds

type Props = {
  variant?: "desktop" | "web";
};

function randToken() {
  return (
    "wechat-login-" +
    Math.random().toString(36).slice(2, 10) +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

export function QrLogin({ variant = "desktop" }: Props) {
  const { t, lang } = useI18n();
  const [token, setToken] = useState<string>(() => randToken());
  const [remaining, setRemaining] = useState(LIFETIME);
  const [status, setStatus] = useState<QrStatus>("pending");
  const [simulate, setSimulate] = useState<QrStatus>("pending");
  const tickRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const [pollCount, setPollCount] = useState(0);

  // Generate URL to encode in QR (real deeplink style)
  const qrValue = useMemo(() => {
    return `https://login.weixin.qq.com/l/${token}?lang=${lang}`;
  }, [token, lang]);

  // Ticking countdown
  useEffect(() => {
    if (status === "confirmed" || status === "expired" || status === "scanned") {
      return;
    }
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setStatus("expired");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [status, token]);

  // Polling — simulate backend long polling. In final seconds we double the rate
  useEffect(() => {
    if (status === "confirmed" || status === "expired" || status === "scanned")
      return;
    const poll = () => {
      setPollCount((c) => c + 1);
      // The demo environment doesn't have a real backend; we only advance if user has clicked simulate
      if (simulate !== "pending") {
        setStatus(simulate);
      }
    };
    const interval = remaining <= FINAL_COUNTDOWN ? 1000 : 2000;
    pollRef.current = window.setInterval(poll, interval);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [status, remaining, simulate]);

  // After 2s of "scanned", move to confirmed automatically (simulate user tapped confirm)
  useEffect(() => {
    if (status === "scanned") {
      const t = window.setTimeout(() => setStatus("confirmed"), 2500);
      return () => window.clearTimeout(t);
    }
  }, [status]);

  const refresh = () => {
    setToken(randToken());
    setRemaining(LIFETIME);
    setStatus("pending");
    setSimulate("pending");
    setPollCount(0);
  };

  // Allow the user to simulate scanning by clicking the QR in pending state (hidden dev affordance)
  const handleQrClick = () => {
    if (status === "pending") {
      setStatus("scanned");
      setSimulate("scanned");
    } else if (status === "expired") {
      refresh();
    }
  };

  const isDesktop = variant === "desktop";

  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-center",
        isDesktop ? "px-10 py-8" : "px-6 py-6"
      )}
    >
      {/* Title */}
      <h2
        className={cn(
          "mb-2 text-center font-medium text-slate-900 dark:text-slate-50",
          isDesktop ? "text-2xl" : "text-xl"
        )}
      >
        {t.qrTitle}
      </h2>
      <p
        className={cn(
          "mb-6 text-center text-slate-500 dark:text-slate-400",
          isDesktop ? "text-sm" : "text-xs"
        )}
      >
        {t.desktopHint}
      </p>

      {/* QR block */}
      <div
        className={cn(
          "relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800",
          isDesktop ? "h-[260px] w-[260px]" : "h-[240px] w-[240px]"
        )}
      >
        <button
          type="button"
          onClick={handleQrClick}
          className="relative block h-full w-full"
          aria-label="QR code"
        >
          {status === "pending" && (
            <div className="flex h-full w-full items-center justify-center [&_svg]:h-full [&_svg]:w-full">
              <QRCodeSVG
                value={qrValue}
                size={isDesktop ? 220 : 200}
                level="M"
                fgColor="#1f2937"
                bgColor="#ffffff"
                includeMargin={false}
                imageSettings={{
                  src:
                    "data:image/svg+xml;utf8," +
                    encodeURIComponent(
                      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%2307C160'/><path d='M24.8 14C15.5 14 8 20.4 8 28.2c0 4.4 2.4 8.3 6.2 11 .2.1.3.4.3.6l-.7 2.6c-.1.3.2.5.5.3l3.3-1.8c.2-.1.4-.1.6 0 1.9.8 4.1 1.2 6.4 1.2.5 0 1 0 1.5-.1-.3-1-.5-2-.5-3.1 0-7.4 7-13.4 15.7-13.4.5 0 1 0 1.5.1C41 18.5 33.5 14 24.8 14Z' fill='white'/><circle cx='18' cy='27' r='2' fill='%2307C160'/><circle cx='31' cy='27' r='2' fill='%2307C160'/><path d='M56 39.3c0-6.4-6.3-11.6-14-11.6s-14 5.2-14 11.6c0 6.5 6.3 11.6 14 11.6 1.7 0 3.4-.3 4.9-.8.2-.1.4-.1.5 0l2.7 1.4c.2.1.5 0 .4-.3l-.6-2.2c0-.2.1-.4.2-.5 3.6-2.2 5.9-5.5 5.9-9.2Z' fill='white'/><circle cx='36.5' cy='38.2' r='1.7' fill='%2307C160'/><circle cx='47.5' cy='38.2' r='1.7' fill='%2307C160'/></svg>`
                    ),
                  height: isDesktop ? 44 : 40,
                  width: isDesktop ? 44 : 40,
                  excavate: true,
                }}
              />
            </div>
          )}

          {status === "scanned" && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950">
                <svg
                  viewBox="0 0 24 24"
                  className="h-9 w-9 text-[#07C160]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <path d="M12 18h.01" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {t.qrScanned}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.qrScannedSubtitle}
              </p>
            </div>
          )}

          {status === "confirmed" && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950">
                <svg
                  viewBox="0 0 24 24"
                  className="h-9 w-9 text-[#07C160]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {t.qrSuccess}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.qrSuccessSubtitle}
              </p>
            </div>
          )}

          {/* Expired overlay */}
          {status === "expired" && (
            <div
              onClick={refresh}
              className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded bg-white/90 backdrop-blur-sm dark:bg-slate-800/90"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                <svg
                  viewBox="0 0 24 24"
                  className="h-7 w-7 text-slate-600 dark:text-slate-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-3-6.7" />
                  <path d="M21 3v6h-6" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-100">
                {t.qrExpired}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t.qrExpiredSubtitle}
              </p>
            </div>
          )}
        </button>
      </div>

      {/* Bottom area */}
      <div className="mt-4 flex w-full max-w-[260px] items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        {status === "pending" ? (
          <>
            <span>
              {t.countdown}
              <span
                className={cn(
                  "font-medium tabular-nums",
                  remaining <= FINAL_COUNTDOWN
                    ? "text-rose-500"
                    : "text-[#07C160] dark:text-emerald-400"
                )}
              >
                {remaining}
                {t.sec}
              </span>
            </span>
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-1 text-slate-500 transition hover:text-[#07C160] dark:text-slate-400 dark:hover:text-emerald-400"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 3v6h-6" />
              </svg>
              {t.refresh}
            </button>
          </>
        ) : status === "scanned" ? (
          <span className="mx-auto text-slate-500 dark:text-slate-400">
            · {pollCount} polls
          </span>
        ) : status === "confirmed" ? (
          <span className="mx-auto text-[#07C160]">✓ {t.qrSuccess}</span>
        ) : (
          <span className="mx-auto text-rose-500">
            {t.qrExpired} · {t.clickToRefresh}
          </span>
        )}
      </div>

      {/* Divider and transfer file link */}
      <div className="mt-6 w-full max-w-[320px]">
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          或 · or
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <WeChatLogo size={20} />
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="font-medium text-[#07C160] hover:underline dark:text-emerald-400"
          >
            {t.transferFile}
          </a>
          <span className="text-xs text-slate-400">· {t.transferFileTip}</span>
        </div>
      </div>
    </div>
  );
}
