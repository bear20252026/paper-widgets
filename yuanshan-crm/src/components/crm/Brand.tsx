import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#1E3A32" />
      <path
        d="M6 27 L15 16 L20 21.5 L26 12 L34 27"
        fill="none"
        stroke="#F4F1E8"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 31.5 L13 25 L19 29 L27 22 L34 31.5"
        fill="none"
        stroke="#F4F1E8"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="29.5" cy="10" r="2" fill="#C9A227" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  const { m } = useI18n();
  return (
    <div className="flex items-center gap-2.5" aria-label={m.brand.name}>
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className="font-serif text-[19px] font-bold tracking-[0.08em] text-ink">
            {m.brand.wordmark}
          </div>
          <div className="mt-1 whitespace-nowrap text-[8px] font-semibold tracking-[0.22em] text-muted-foreground">
            {m.brand.tagline}
          </div>
        </div>
      )}
    </div>
  );
}

export function MountainLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="none" className={cn(className)} aria-hidden>
      <path
        d="M0 95 L60 60 L105 82 L170 30 L230 72 L290 45 L345 78 L400 55"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M0 110 L50 88 L120 104 L185 70 L250 98 L320 76 L400 96"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.55"
      />
      <path
        d="M0 120 L70 108 L150 116 L220 98 L300 114 L400 104"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.3"
      />
    </svg>
  );
}
