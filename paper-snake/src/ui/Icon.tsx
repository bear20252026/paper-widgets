import type { SVGProps } from "react";

export type IconName = "arrow" | "back" | "chevron" | "close" | "settings" | "sound" | "muted" | "play" | "pause" | "user" | "coin" | "gem" | "gift" | "check" | "lock" | "crown" | "clock" | "infinity" | "leaf" | "spark" | "help" | "mouse" | "expand" | "search" | "grid" | "film" | "wave" | "kite" | "shield" | "download" | "magnet" | "bolt" | "double" | "swords" | "heart" | "globe";

const paths: Record<IconName, React.ReactNode> = {
  arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
  back: <path d="M20 12H5m6-7-7 7 7 7" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--paper, #f8f7f2)" /><circle cx="15" cy="17" r="3" fill="var(--paper, #f8f7f2)" /></>,
  sound: <><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
  muted: <><path d="M3 9v6h4l5 4V5L7 9H3Z" /><path d="m16 9 5 6m0-6-5 6" /></>,
  play: <path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none" />,
  pause: <><path d="M8 5v14M16 5v14" strokeWidth="3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5.5" /><path d="M12 9v6" /></>,
  gem: <><path d="m3 8 5-5h8l5 5-9 13L3 8Z" /><path d="M3 8h18M8 3l4 18 4-18" /></>,
  gift: <><path d="M4 10h16v11H4zM2 6h20v4H2zM12 6v15" /><path d="M12 6C6 6 5 3 7 2c3-1 5 4 5 4Zm0 0s2-5 5-4c2 1 1 4-5 4Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v2" /></>,
  crown: <><path d="m3 6 4 4 5-7 5 7 4-4-2 12H5L3 6ZM5 21h14" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  infinity: <path d="M12 12C9 6 3 6 3 12s6 6 9 0 9-6 9 0-6 6-9 0Z" />,
  leaf: <><path d="M5 19C0 10 7 3 21 3c0 14-7 21-16 16Z" /><path d="m3 21 13-13" /></>,
  spark: <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 1 1 4 3c-1 .4-1 1-1 2M12 17h.01" /></>,
  mouse: <><rect x="6" y="2" width="12" height="20" rx="6" /><path d="M12 2v6M6 9h12" /></>,
  expand: <path d="M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5" />,
  search: <><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  film: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 3v18M17 3v18M3 8h4m-4 8h4m10-8h4m-4 8h4M7 12h10" /></>,
  wave: <><path d="M2 7c4-6 6 6 10 0s6 6 10 0M2 12c4-6 6 6 10 0s6 6 10 0M2 17c4-6 6 6 10 0s6 6 10 0" /></>,
  kite: <><path d="m5 3 14 2 2 14L5 3Zm0 0 2 14 14 2M7 17c-8-1 1 7-5 5" /><path d="M5 3 7 17 19 5" /></>,
  shield: <><path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z" /><path d="m7 12 3 3 7-7" /></>,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  magnet: <><path d="M5 3v9a7 7 0 0 0 14 0V3h-4v9a3 3 0 0 1-6 0V3H5Z" /><path d="M5 7h4m6 0h4" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  double: <><path d="m4 8 6 8m0-8-6 8" /><path d="M14 9a3 3 0 1 1 5 2.2L14 16h6" /></>,
  swords: <><path d="M3 3l9 9m-2 2-3 3m-2-2 4 4M21 3l-9 9m2 2 3 3m2-2-4 4" /></>,
  heart: <path d="M12 21s-8-5-8-11a5 5 0 0 1 8-3 5 5 0 0 1 8 3c0 6-8 11-8 11Z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
};

export function Icon({ name, className = "", ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`ui-icon ${className}`} aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export function BrandMark({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 44 44" className={className} width="44" height="44" aria-hidden="true">
    <path d="M30 9H17a8 8 0 0 0 0 16h10a5 5 0 0 1 0 10H14" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    <ellipse cx="32" cy="9" rx="9" ry="7.5" fill="currentColor" />
    <circle cx="33" cy="6.6" r="1.5" fill="#f2c75b" /><circle cx="33" cy="11.4" r="1.5" fill="#f2c75b" />
  </svg>;
}

export function Motif({ value = "", className = "" }: { value?: string; className?: string }) {
  const name: IconName = /king|champion/.test(value) ? "crown"
    : /skin|collect/.test(value) ? "kite"
      : /length|len_|giant/.test(value) ? "infinity"
        : /orb|streak/.test(value) ? "spark"
          : /kill|hunt/.test(value) ? "shield"
            : /daily|loyal/.test(value) ? "gift" : "leaf";
  return <Icon name={name} className={className} />;
}