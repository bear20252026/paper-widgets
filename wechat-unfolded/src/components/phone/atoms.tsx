import { ChevronLeft, ChevronRight, MessageCircle, Compass, UserRound, Users } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { WeChatBadge } from "../shared";

export function PhoneBack({ onClick, dark = false }: { onClick: () => void; dark?: boolean }) {
  return (
    <button onClick={onClick} className={cn("grid h-7 w-7 place-items-center", dark ? "text-white" : "text-[#191919]")} aria-label="返回">
      <ChevronLeft size={25} strokeWidth={1.7} />
    </button>
  );
}

export function MobileTop({
  title,
  subtitle,
  onBack,
  left,
  right,
  tappableTitle,
  onTitleClick,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  left?: ReactNode;
  right?: ReactNode;
  tappableTitle?: boolean;
  onTitleClick?: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-black/[0.06] bg-[#EDEDED] pt-[30px]">
      <div className="relative flex h-[44px] items-center justify-between px-2.5">
        <div className="flex min-w-[58px] items-center">{onBack && <PhoneBack onClick={onBack} />}{left}</div>
        <button onClick={onTitleClick} disabled={!tappableTitle} className="min-w-0 px-1 text-center">
          <div className="truncate text-[15px] font-medium tracking-[0.01em] text-[#1A1A1A]">{title}</div>
          {subtitle && <div className="mt-0.5 text-[8.5px] font-normal text-[#999]">{subtitle}</div>}
        </button>
        <div className="flex min-w-[58px] items-center justify-end gap-3.5 text-[#272727]">{right}</div>
      </div>
    </header>
  );
}

export function MobileCell({
  icon,
  label,
  sublabel,
  right,
  onClick,
  badge,
  border = true,
  className,
}: {
  icon?: ReactNode;
  label: string;
  sublabel?: string;
  right?: ReactNode;
  onClick?: () => void;
  badge?: ReactNode;
  border?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("flex min-h-[50px] w-full items-center gap-3 bg-white px-4 text-left transition active:bg-[#F3F3F3]", border && "border-b border-[#F0F0F0]", className)}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-[#222]">{label}</span>
        {sublabel && <span className="mt-0.5 block truncate text-[9.5px] text-[#A6A6A6]">{sublabel}</span>}
      </span>
      {badge}
      {right}
      <ChevronRight size={15} className="shrink-0 text-[#C5C5C5]" strokeWidth={1.7} />
    </button>
  );
}

export function MobileTile({
  icon,
  color,
  size = "md",
}: {
  icon: ReactNode;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-[9px] text-white", {
        "h-6 w-6": size === "sm",
        "h-[30px] w-[30px]": size === "md",
        "h-9 w-9": size === "lg",
      })}
      style={{ background: color }}
    >
      {icon}
    </span>
  );
}

export function GroupTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 pb-1.5 pt-3.5 text-[9px] font-medium tracking-[0.08em] text-[#999]", className)}>{children}</div>;
}

export function TabBar({
  active,
  onChange,
}: {
  active: "chats" | "contacts" | "discover" | "me";
  onChange: (tab: "chats" | "contacts" | "discover" | "me") => void;
}) {
  const items = [
    { id: "chats" as const, label: "微信", icon: MessageCircle, badge: 8 },
    { id: "contacts" as const, label: "通讯录", icon: Users },
    { id: "discover" as const, label: "发现", icon: Compass, dot: true },
    { id: "me" as const, label: "我", icon: UserRound },
  ];
  return (
    <nav className="relative z-20 flex h-[70px] shrink-0 items-start border-t border-[#DEDEDE] bg-[#F7F7F7] px-1 pt-[5px]">
      {items.map((item) => {
        const activeItem = active === item.id;
        return (
          <button key={item.id} onClick={() => onChange(item.id)} className="relative flex flex-1 flex-col items-center gap-[2px] py-0.5">
            <span className="relative">
              <item.icon size={23} strokeWidth={activeItem ? 2.05 : 1.65} className={activeItem ? "text-[#07C160]" : "text-[#5A5A5A]"} />
              {item.badge && <span className="absolute -right-3 -top-1.5"><WeChatBadge count={item.badge} /></span>}
              {item.dot && <span className="absolute -right-[3px] top-0 h-[6px] w-[6px] rounded-full bg-[#FA5151]" />}
            </span>
            <span className={cn("text-[9px] leading-3", activeItem ? "font-medium text-[#07C160]" : "text-[#666]")}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
