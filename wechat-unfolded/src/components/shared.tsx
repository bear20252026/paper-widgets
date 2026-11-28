import { cn } from "../utils/cn";

export function WeChatLogo({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-label="微信">
      {!mono && <circle cx="20" cy="20" r="20" fill="#07C160" />}
      <g fill={mono ? "currentColor" : "#fff"}>
        <path d="M16.4 10c-5.3 0-9.6 3.5-9.6 7.9 0 2.5 1.3 4.7 3.4 6.1l-.8 2.7 3-1.5c1.2.4 2.6.6 4 .6h.7c-.2-.6-.3-1.2-.3-1.8 0-4.2 4-7.6 9-7.6.4 0 .8 0 1.2.1C26.2 12.8 21.7 10 16.4 10Z" />
        <circle cx="13" cy="16.5" r="1.25" fill={mono ? "#fff" : "#07C160"} />
        <circle cx="19.7" cy="16.5" r="1.25" fill={mono ? "#fff" : "#07C160"} />
        <path d="M26.7 18c-4.3 0-7.8 2.9-7.8 6.4 0 3.5 3.5 6.4 7.8 6.4 1 0 2-.2 2.9-.5l2.4 1.3-.7-2.3c1.7-1.2 2.7-3 2.7-4.9 0-3.5-3.5-6.4-7.3-6.4Z" />
        <circle cx="24.2" cy="23.5" r=".95" fill={mono ? "#fff" : "#07C160"} />
        <circle cx="29.3" cy="23.5" r=".95" fill={mono ? "#fff" : "#07C160"} />
      </g>
    </svg>
  );
}

export function Avatar({
  src,
  name = "",
  className,
  online,
  rounded = "rounded-[7px]",
}: {
  src?: string;
  name?: string;
  className?: string;
  online?: boolean;
  rounded?: string;
}) {
  return (
    <span className={cn("relative inline-block shrink-0", className)}>
      <span className={cn("block h-full w-full overflow-hidden bg-[#e7e7e7] text-[#8a8a8a]", rounded)}>
        {src ? (
          <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs font-medium">{name.slice(0, 1)}</span>
        )}
      </span>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#07C160]" />
      )}
    </span>
  );
}

export function GroupAvatar({ images, className }: { images: string[]; className?: string }) {
  const shown = images.slice(0, 4);
  return (
    <span className={cn("grid h-11 w-11 shrink-0 grid-cols-2 gap-[2px] overflow-hidden rounded-[7px] bg-[#e7e7e7]", className)}>
      {shown.map((img, i) => (
        <img key={i} src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
      ))}
      {shown.length < 4 &&
        Array.from({ length: 4 - shown.length }).map((_, i) => <span key={i} className="bg-[#ececec]" />)}
    </span>
  );
}

export function WeChatFileIcon({ className }: { className?: string }) {
  return (
    <span className={cn("grid place-items-center bg-[#F0F0F0]", className)}>
      <WeChatLogo className="h-3/5 w-3/5" />
    </span>
  );
}

export function PhoneStatusBar({ dark = true, bg = "transparent" }: { dark?: boolean; bg?: string }) {
  const color = dark ? "text-[#111]" : "text-white";
  return (
    <div className={cn("relative z-30 flex h-[30px] shrink-0 items-center justify-between px-6 pt-1 text-[10.5px] font-semibold", color, bg)}>
      <span className="tracking-[-0.02em]">9:41</span>
      <div className="flex items-center gap-1">
        <svg viewBox="0 0 18 12" className="h-2.5 w-4 fill-current">
          <rect x="0" y="8" width="2.5" height="4" rx=".6" />
          <rect x="4" y="5.5" width="2.5" height="6.5" rx=".6" />
          <rect x="8" y="3" width="2.5" height="9" rx=".6" />
          <rect x="12" y="0" width="2.5" height="12" rx=".6" />
        </svg>
        <svg viewBox="0 0 14 11" className="h-2.5 w-3.5 fill-current">
          <path d="M7 9.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM3.7 7.9l1.2 1.2A3.3 3.3 0 0 1 9.2 9L10.4 7.8a5 5 0 0 0-6.7 0ZM1 5.3l1.2 1.2a7 7 0 0 1 9.6 0l1.2-1.2a8.8 8.8 0 0 0-12 0Z" transform="translate(0 -2)" />
        </svg>
        <span className="ml-0.5 h-[9px] w-[17px] rounded-[3px] border border-current/60 p-[1px]">
          <span className="block h-full w-[80%] rounded-[1.5px] bg-current" />
        </span>
      </div>
    </div>
  );
}

export function Switch({ on, onChange, small = false }: { on: boolean; onChange?: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      aria-label={on ? "关闭" : "开启"}
      onClick={onChange}
      className={cn(
        "relative shrink-0 rounded-full transition-colors duration-200",
        small ? "h-[18px] w-[30px]" : "h-[22px] w-[38px]",
        on ? "bg-[#07C160]" : "bg-[#E5E5E5]",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] rounded-full bg-white shadow-sm transition-transform duration-200",
          small ? "h-[14px] w-[14px]" : "h-[18px] w-[18px]",
          on ? (small ? "translate-x-[14px]" : "translate-x-[18px]") : "translate-x-[2px]",
        )}
      />
    </button>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[10px] font-medium tracking-[0.14em] text-[#9B9B93] uppercase", className)}>{children}</div>
  );
}

export function WeChatBadge({ count }: { count: number }) {
  return (
    <span className="grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#FA5151] px-1 text-[10px] font-medium leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function EmojiSticker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid place-items-center rounded-2xl bg-[#F7F7F7] text-4xl", className)}>{children}</div>
  );
}

export const stickerSets = [
  ["🌿", "🌷", "✦", "☕", "🥐", "🌙", "🫧", "🌤️"],
  ["🐱", "🐰", "🐻", "🦊", "🐼", "🐥", "🦋", "🐳"],
  ["😊", "🥹", "😎", "🤍", "😴", "🤭", "😌", "🙌"],
];
