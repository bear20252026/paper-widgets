import { useState } from "react";
import {
  Aperture,
  ChevronRight,
  Disc3,
  Eye,
  FileText,
  Gamepad2,
  LayoutGrid,
  MapPin,
  MoreHorizontal,
  Plus,
  QrCode,
  Radio,
  ScanLine,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";
import { contacts, me, miniApps } from "../../data";
import { useWeChatStore } from "../../store";
import { Avatar, GroupAvatar, PhoneStatusBar, WeChatBadge, WeChatFileIcon, WeChatLogo } from "../shared";
import { cn } from "../../utils/cn";
import { MobileCell, MobileTile, TabBar } from "./atoms";
import type { MobileScreen } from "./types";
import {
  ChannelsScreen,
  ChatScreen,
  MiniProgramsScreen,
  MomentsScreen,
  ReadingScreen,
  ScanScreen,
  SearchScreen,
} from "./PhoneScreensA";
import {
  CallScreen,
  CardsScreen,
  FavoritesScreen,
  NewFriendsScreen,
  PayScreen,
  ProfileScreen,
  RedPacketScreen,
  SettingsScreen,
  StickersScreen,
  WalletScreen,
} from "./PhoneScreensB";
import {
  FloatingScreen,
  PostMomentScreen,
  QRCodeScreen,
  StatusScreen,
  TransferScreen,
} from "./PhoneScreensC";

function HomeHeader({
  title,
  onSearch,
  right,
  onPullDown,
  dark = false,
}: {
  title: string;
  onSearch?: () => void;
  right?: React.ReactNode;
  onPullDown?: () => void;
  dark?: boolean;
}) {
  return (
    <div className={cn("shrink-0 px-3 pt-[28px]", dark ? "bg-[#191919] text-white" : "bg-[#EDEDED]")}>
      {onPullDown && (
        <button
          onClick={onPullDown}
          title="下拉打开小程序与浮窗任务栏"
          className="mx-auto flex items-center gap-1 py-0.5 text-[#888] transition hover:text-[#07C160]"
        >
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
        </button>
      )}
      <div className="relative flex h-[40px] items-center justify-center">
        <div className="absolute left-0 flex items-center gap-3.5">
          {onSearch ? (
            <button onClick={onSearch} className={cn("grid h-8 w-8 place-items-center", dark ? "text-white/85" : "text-[#2A2A2A]")}>
              <Search size={19} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
        <h1 className={cn("text-[15.5px] font-medium tracking-[0.02em]", dark ? "text-white" : "text-[#1C1C1C]")}>{title}</h1>
        <div className={cn("absolute right-0 flex items-center gap-2", dark ? "text-white/85" : "text-[#2A2A2A]")}>
          {right ?? (
            <button className="grid h-8 w-8 place-items-center">
              <Plus size={22} strokeWidth={1.7} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatRow({
  chat,
  dark,
  onClick,
}: {
  chat: ReturnType<typeof useWeChatStore>["chats"][number];
  dark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-2.5 px-3.5 py-[9px] text-left transition",
        dark
          ? chat.pinned
            ? "bg-[#202020] active:bg-[#2A2A2A]"
            : "bg-[#191919] active:bg-[#242424]"
          : chat.pinned
            ? "bg-[#F4F4F4] active:bg-[#E9E9E9]"
            : "bg-white active:bg-[#EDEDED]",
      )}
    >
      <div className="relative">
        {chat.avatars ? (
          <GroupAvatar images={chat.avatars} className="h-[44px] w-[44px] rounded-[5px]" />
        ) : chat.id === "file" ? (
          <WeChatFileIcon className="h-[44px] w-[44px] rounded-[5px]" />
        ) : chat.icon === "wechat" ? (
          <span className="grid h-[44px] w-[44px] place-items-center rounded-[5px] bg-[#07C160]">
            <WeChatLogo className="h-8 w-8" />
          </span>
        ) : (
          <Avatar src={chat.avatar} name={chat.name} className="h-[44px] w-[44px] rounded-[5px]" online={chat.online} />
        )}
        {chat.unread ? (
          <span className="absolute -right-1.5 -top-1.5">
            <WeChatBadge count={chat.unread} />
          </span>
        ) : null}
      </div>
      <div className={cn("min-w-0 flex-1 border-b pb-[9px] pt-[1px]", dark ? "border-white/10" : "border-[#F3F3F3]")}>
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-[13.5px]", dark ? "text-white/90" : "text-[#222]")}>{chat.name}</span>
          <span className="shrink-0 text-[9px] text-[#B2B2B2]">{chat.time}</span>
        </div>
        <div className="mt-[3px] flex items-center gap-1">
          <span className="line-clamp-1 flex-1 text-[10.5px] text-[#A3A3A3]">
            {chat.muted && <span className="mr-1 inline text-[10px] text-[#C0C0C0]">⌁</span>}
            {chat.last}
          </span>
          {chat.id === "anna" && (
            <span className="text-[#C2C2C2]">
              <MoreHorizontal size={14} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ChatsScreen({
  onOpenChat,
  onNavigate,
  onNotify,
}: {
  onOpenChat: (id: string) => void;
  onNavigate: (screen: MobileScreen) => void;
  onNotify: (s: string) => void;
}) {
  const store = useWeChatStore();
  const [sheet, setSheet] = useState(false);
  const [miniDrawer, setMiniDrawer] = useState(false);
  const sorted = [...store.chats].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));

  return (
    <div className={cn("relative flex h-full flex-col", store.wechatDark ? "bg-[#111]" : "bg-[#F7F7F7]")}>
      <HomeHeader
        title="微信"
        dark={store.wechatDark}
        onPullDown={() => setMiniDrawer((v) => !v)}
        right={
          <>
            <button onClick={() => onNavigate("search")} className="grid h-8 w-8 place-items-center" title="搜一搜">
              <Search size={19} strokeWidth={1.8} />
            </button>
            <button onClick={() => setSheet(true)} className="grid h-8 w-8 place-items-center" title="快捷菜单">
              <Plus size={21} strokeWidth={1.7} />
            </button>
          </>
        }
      />

      {/* Pull-down Mini Program & Floating Drawer */}
      {miniDrawer && (
        <div className="border-b border-white/10 bg-[#232B26] px-3.5 py-3 text-white shadow-inner">
          <div className="flex items-center justify-between text-[9.5px] text-white/65">
            <span>最近使用的小程序与浮窗</span>
            <button onClick={() => setMiniDrawer(false)} className="text-white/60 hover:text-white">
              收起 ▲
            </button>
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-2">
            {miniApps.slice(0, 4).map((app) => (
              <button
                key={app.id}
                onClick={() => {
                  setMiniDrawer(false);
                  onNavigate("mini");
                }}
                className="flex flex-col items-center gap-1"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-lg">{app.emoji}</span>
                <span className="truncate text-[8.5px] text-white/80">{app.name}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setMiniDrawer(false);
              onNavigate("floating");
            }}
            className="mt-3 flex w-full items-center justify-between rounded-lg bg-white/10 px-3 py-1.5 text-[10px]"
          >
            <span className="flex items-center gap-1.5">
              <Disc3 size={13} className="animate-spin text-[#07C160] [animation-duration:6s]" />
              正在播放：房东的猫 - 风经过的地方
            </span>
            <span className="text-white/60">打开浮窗 ›</span>
          </button>
        </div>
      )}

      {/* Search & Status Strip */}
      <div className={cn("shrink-0 px-3 pb-2", store.wechatDark ? "bg-[#191919]" : "bg-[#EDEDED]")}>
        <div className="flex gap-1.5">
          <button
            onClick={() => onNavigate("search")}
            className={cn(
              "flex h-[30px] flex-1 items-center gap-1.5 rounded-md px-2.5 text-[#AAA]",
              store.wechatDark ? "bg-white/10" : "bg-white/85",
            )}
          >
            <Search size={13} />
            <span className="text-[10.5px]">搜索</span>
          </button>
          <button
            onClick={() => onNavigate("floating")}
            title="打开音乐与浮窗"
            className={cn(
              "flex h-[30px] items-center gap-1 rounded-md px-2 text-[9.5px]",
              store.wechatDark ? "bg-white/10 text-[#6CE39E]" : "bg-white/85 text-[#07994E]",
            )}
          >
            <Disc3 size={12} className="animate-spin [animation-duration:7s]" /> 音乐浮窗
          </button>
        </div>
      </div>

      {/* Desktop Sync Banner */}
      <button
        onClick={() => onNotify("Windows / macOS 微信已登录，消息实时双向同步中")}
        className={cn(
          "flex h-[32px] shrink-0 items-center justify-between border-b px-4 text-[10px]",
          store.wechatDark
            ? "border-white/10 bg-[#202020] text-white/70"
            : "border-[#EAEAEA] bg-[#F7F7F7] text-[#666]",
        )}
      >
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#07C160]" />
          Mac 微信已登录 · 跨端实时同步中
        </span>
        <span className="text-[9px] text-[#07A858]">{store.myStatus.emoji} {store.myStatus.label}</span>
      </button>

      <div className={cn("min-h-0 flex-1 overflow-y-auto", store.wechatDark ? "bg-[#191919]" : "bg-white")}>
        {sorted.map((chat) => (
          <ChatRow key={chat.id} chat={chat} dark={store.wechatDark} onClick={() => onOpenChat(chat.id)} />
        ))}
        <div
          className={cn(
            "flex h-[54px] items-center justify-between px-3.5",
            store.wechatDark ? "bg-[#191919]" : "bg-white",
          )}
        >
          <div className="flex items-center gap-2 text-[10px] text-[#AAA]">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-[#F5F5F5] dark:bg-white/10">
              <LayoutGrid size={14} />
            </span>
            折叠的群聊
          </div>
          <span className="text-[9px] text-[#C0C0C0]">2 个群</span>
        </div>
      </div>
      <TabBar active="chats" onChange={(t) => onNavigate(t)} />

      {sheet && (
        <div className="absolute inset-0 z-40 flex flex-col bg-black/25" onClick={() => setSheet(false)}>
          <div className="mt-auto rounded-t-2xl bg-[#F7F7F7] pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-[#D4D4D4]" />
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] font-medium text-[#222]">快捷入口</span>
              <button onClick={() => setSheet(false)}>
                <X size={16} className="text-[#999]" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-y-4 px-4 pb-2">
              {[
                {
                  icon: Users,
                  label: "发起群聊",
                  bg: "#07B25A",
                  action: () => {
                    setSheet(false);
                    onOpenChat("spring");
                  },
                },
                {
                  icon: Plus,
                  label: "添加朋友",
                  bg: "#F5B640",
                  action: () => {
                    setSheet(false);
                    onNavigate("newfriends");
                  },
                },
                {
                  icon: ScanLine,
                  label: "扫一扫",
                  bg: "#4C8EDB",
                  action: () => {
                    setSheet(false);
                    onNavigate("scan");
                  },
                },
                {
                  icon: QrCode,
                  label: "收付款",
                  bg: "#07B25A",
                  action: () => {
                    setSheet(false);
                    onNavigate("pay");
                  },
                },
              ].map((item) => (
                <button key={item.label} onClick={item.action} className="flex flex-col items-center gap-1.5">
                  <span
                    className="grid h-12 w-12 place-items-center rounded-xl text-white shadow-sm"
                    style={{ background: item.bg }}
                  >
                    <item.icon size={21} strokeWidth={1.7} />
                  </span>
                  <span className="text-[9px] text-[#555]">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactsScreen({
  onOpenContact,
  onNavigate,
  onNotify,
}: {
  onOpenContact: (id: string) => void;
  onNavigate: (screen: MobileScreen) => void;
  onNotify: (s: string) => void;
}) {
  const sorted = [...contacts].sort((a, b) => a.initial.localeCompare(b.initial));
  const quick = [
    { label: "新的朋友", bg: "#F5B640", icon: <Users size={16} />, action: () => onNavigate("newfriends") },
    { label: "仅聊天的朋友", bg: "#A7D36A", icon: <Users size={16} />, action: () => onNotify("仅聊天的朋友") },
    { label: "群聊", bg: "#67A3E8", icon: <Users size={16} />, action: () => onNotify("群聊列表") },
    { label: "标签", bg: "#67A3E8", icon: <Star size={16} />, action: () => onNotify("标签管理") },
    { label: "公众号", bg: "#8D7CDF", icon: <FileText size={16} />, action: () => onNavigate("reading") },
  ];
  return (
    <div className="flex h-full flex-col bg-[#F5F5F5]">
      <HomeHeader
        title="通讯录"
        right={
          <button onClick={() => onNavigate("newfriends")}>
            <Plus size={22} strokeWidth={1.7} />
          </button>
        }
      />
      <div className="shrink-0 bg-[#EDEDED] px-3 pb-2.5">
        <button
          onClick={() => onNavigate("search")}
          className="flex h-[30px] w-full items-center gap-1.5 rounded-md bg-white/80 px-2.5 text-[#AAA]"
        >
          <Search size={13} />
          <span className="text-[10.5px]">搜索</span>
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="bg-white">
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={q.action}
              className="flex w-full items-center gap-2.5 border-b border-[#F5F5F5] px-3.5 py-2.5 pr-6 text-left"
            >
              <MobileTile icon={q.icon} color={q.bg} />
              <span className="text-[12px] text-[#333]">{q.label}</span>
            </button>
          ))}
        </div>
        {["A", "C", "G", "H", "J", "L", "Q", "Z"].map((letter) => {
          const people = sorted.filter((p) => p.initial === letter);
          if (!people.length) return null;
          return (
            <div key={letter}>
              <div className="bg-[#F5F5F5] px-3.5 py-1 text-[9px] font-medium text-[#999]">{letter}</div>
              <div className="bg-white">
                {people.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onOpenContact(p.id)}
                    className="flex w-full items-center gap-2.5 border-b border-[#F7F7F7] px-3.5 py-2.5 pr-6 text-left"
                  >
                    <Avatar src={p.avatar} name={p.name} className="h-9 w-9 rounded-[5px]" online={p.online} />
                    <span className="text-[12.5px] text-[#222]">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-center py-4 text-[8.5px] text-[#B4B4B4]">共 {contacts.length} 位联系人</div>
        <div className="absolute right-0 top-[8px] flex flex-col gap-[1px] px-1 text-[7px] text-[#9B9B9B]">
          {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
            <button key={l} onClick={() => onNotify(`定位到 ${l}`)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <TabBar active="contacts" onChange={(t) => onNavigate(t)} />
    </div>
  );
}

function DiscoverRow({
  icon,
  color,
  label,
  right,
  onClick,
  border = true,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  right?: React.ReactNode;
  onClick: () => void;
  border?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-h-[50px] w-full items-center gap-3 bg-white px-3.5 text-left active:bg-[#F5F5F5]",
        border && "border-b border-[#F4F4F4]",
      )}
    >
      <MobileTile icon={icon} color={color} size="md" />
      <span className="flex-1 text-[13px] text-[#222]">{label}</span>
      {right}
      <ChevronRight size={15} className="text-[#C7C7C7]" />
    </button>
  );
}

function DiscoverScreen({ onNavigate, onNotify }: { onNavigate: (screen: MobileScreen) => void; onNotify: (s: string) => void }) {
  const store = useWeChatStore();
  return (
    <div className="flex h-full flex-col bg-[#F5F5F5]">
      <HomeHeader
        title="发现"
        right={
          <button onClick={() => onNavigate("search")}>
            <Search size={20} strokeWidth={1.8} />
          </button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto pb-3 pt-2.5">
        <div className="bg-white">
          <DiscoverRow
            icon={<Aperture size={17} />}
            color="#5B9BD5"
            label="朋友圈"
            right={
              <div className="flex items-center gap-1">
                <div className="flex -space-x-1.5">
                  {store.moments.slice(0, 3).map((m) => (
                    <img key={m.id} src={m.avatar} alt="" className="h-5 w-5 rounded-[3px] border border-white object-cover" />
                  ))}
                </div>
                <span className="ml-0.5 h-[7px] w-[7px] rounded-full bg-[#FA5151]" />
              </div>
            }
            onClick={() => onNavigate("moments")}
            border={false}
          />
        </div>
        <div className="mt-2 bg-white">
          <DiscoverRow
            icon={<Video size={17} />}
            color="#E97860"
            label="视频号"
            right={<span className="rounded bg-[#FFF1EE] px-1.5 py-0.5 text-[7.5px] text-[#E97860]">2 场直播</span>}
            onClick={() => onNavigate("channels")}
          />
          <DiscoverRow icon={<Radio size={17} />} color="#E97860" label="直播" onClick={() => onNavigate("channels")} border={false} />
        </div>
        <div className="mt-2 bg-white">
          <DiscoverRow icon={<ScanLine size={17} />} color="#4C8EDB" label="扫一扫" onClick={() => onNavigate("scan")} />
          <DiscoverRow icon={<Disc3 size={17} />} color="#07B25A" label="听一听 · 音乐浮窗" onClick={() => onNavigate("floating")} border={false} />
        </div>
        <div className="mt-2 bg-white">
          <DiscoverRow
            icon={<Eye size={17} />}
            color="#E8A431"
            label="看一看"
            right={<span className="h-[7px] w-[7px] rounded-full bg-[#FA5151]" />}
            onClick={() => onNavigate("reading")}
          />
          <DiscoverRow icon={<Search size={17} />} color="#F09A50" label="搜一搜" onClick={() => onNavigate("search")} />
          <DiscoverRow icon={<MapPin size={17} />} color="#67A3E8" label="附近" onClick={() => onNotify("附近的人与展览")} border={false} />
        </div>
        <div className="mt-2 bg-white">
          <DiscoverRow icon={<ShoppingBag size={17} />} color="#F09090" label="购物" onClick={() => onNotify("微信小店 · 今日好物")} />
          <DiscoverRow icon={<Gamepad2 size={17} />} color="#8D7CDF" label="游戏" onClick={() => onNotify("微信游戏中心")} border={false} />
        </div>
        <div className="mt-2 bg-white">
          <DiscoverRow
            icon={<LayoutGrid size={16} />}
            color="#4DB6AC"
            label="小程序"
            right={<span className="text-[8.5px] text-[#B6B6B6]">12 个最近使用</span>}
            onClick={() => onNavigate("mini")}
            border={false}
          />
        </div>
        <div className="py-4 text-center text-[8px] text-[#B5B5B5]">发现更多，连接每一种生活</div>
      </div>
      <TabBar active="discover" onChange={(t) => onNavigate(t)} />
    </div>
  );
}

function MeScreen({ onNavigate, onNotify }: { onNavigate: (screen: MobileScreen) => void; onNotify: (s: string) => void }) {
  const store = useWeChatStore();
  return (
    <div className="flex h-full flex-col bg-[#F5F5F5]">
      <HomeHeader
        title="我"
        right={
          <button onClick={() => onNavigate("settings")}>
            <Settings size={20} strokeWidth={1.7} />
          </button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative overflow-hidden bg-white px-4 pb-4 pt-4">
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-40 bg-gradient-to-bl from-[#E7F3EB] to-transparent" />
          <div className="relative z-10 flex w-full items-start gap-3 text-left">
            <Avatar src={me.avatar} name={me.name} className="h-[62px] w-[62px] rounded-lg shadow-sm" online />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="text-[18px] font-medium tracking-wide text-[#1D1D1D]">{me.name}</div>
              <div className="mt-1 text-[9.5px] text-[#A2A2A2]">微信号：suhe_2026</div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => onNavigate("status")}
                  className="inline-flex items-center gap-1 rounded-full bg-[#EDF8F1] px-2.5 py-0.5 text-[9px] font-medium text-[#07994E] ring-1 ring-[#07C160]/20"
                >
                  <span>{store.myStatus.emoji}</span>
                  <span>{store.myStatus.label}</span>
                  <span className="opacity-60">· 换状态 ›</span>
                </button>
                <button
                  onClick={() => onNavigate("status")}
                  className="inline-flex items-center gap-0.5 rounded-full border border-[#E5E5E5] px-2 py-0.5 text-[8.5px] text-[#777]"
                >
                  + 状态
                </button>
              </div>
            </div>
            <button
              onClick={() => onNavigate("qrcode")}
              title="我的二维码名片"
              className="mt-1 flex items-center gap-1 rounded-lg p-1.5 text-[#777] hover:bg-[#F5F5F5]"
            >
              <QrCode size={17} />
              <ChevronRight size={14} className="text-[#C8C8C8]" />
            </button>
          </div>
          <div className="relative z-10 mt-3 flex items-center gap-2 border-t border-[#F3F3F3] pt-3">
            {["朋友", "群聊", "收藏"].map((label, i) => (
              <button
                key={label}
                onClick={() => (i === 2 ? onNavigate("favorites") : onNotify(`${label}：${[11, 4, 5][i]} 个`))}
                className="flex flex-1 flex-col items-center"
              >
                <span className="text-[13px] font-medium text-[#333]">{[11, 4, 8][i]}</span>
                <span className="text-[8px] text-[#AAA]">{label}</span>
              </button>
            ))}
            <span className="h-6 w-px bg-[#F0F0F0]" />
            <button onClick={() => onNavigate("qrcode")} className="flex flex-1 flex-col items-center">
              <QrCode size={15} className="text-[#07994E]" />
              <span className="mt-0.5 text-[8px] text-[#07994E]">名片码</span>
            </button>
          </div>
        </div>

        <div className="mt-2 bg-white">
          <button
            onClick={() => onNavigate("wallet")}
            className="flex w-full items-center gap-3 border-b border-[#F3F3F3] px-4 py-3.5 text-left"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#07C160] text-white">
              <Wallet size={17} />
            </span>
            <span className="flex-1">
              <span className="block text-[13px] text-[#222]">服务</span>
              <span className="mt-0.5 block text-[8.5px] text-[#AAA]">收付款 · 转账 · 钱包</span>
            </span>
            <span className="rounded-full bg-[#07C160]/10 px-2 py-1 text-[7.5px] text-[#07A858]">余额 ¥12,860</span>
            <ChevronRight size={15} className="text-[#C7C7C7]" />
          </button>
          <button
            onClick={() => onNavigate("status")}
            className="flex w-full items-center gap-2 border-t border-[#F3F3F3] px-4 py-2.5 text-left text-[8.5px] text-[#9AA29A]"
          >
            <Sparkles size={11} className="text-[#07A858]" />
            <span>当前状态：{store.myStatus.emoji} {store.myStatus.label}</span>
            <span className="mx-1 h-2.5 w-px bg-[#E5E8E2]" />
            <span>{store.myStatus.friendsCount} 位朋友同状态</span>
            <span className="ml-auto text-[#576B95]">去设置 ›</span>
          </button>
        </div>

        <div className="mt-2 bg-white">
          <MobileCell
            icon={<MobileTile icon={<Star size={15} />} color="#E8A431" />}
            label="收藏"
            sublabel="链接、图片、笔记与文件"
            right={<span className="text-[9px] text-[#AAA]">5</span>}
            onClick={() => onNavigate("favorites")}
          />
          <MobileCell
            icon={<MobileTile icon={<Aperture size={15} />} color="#5B9BD5" />}
            label="朋友圈"
            sublabel="记录此刻，支持跨端同步发表"
            onClick={() => onNavigate("moments")}
          />
          <MobileCell
            icon={<MobileTile icon={<ShoppingBag size={15} />} color="#E97860" />}
            label="卡包"
            sublabel="优惠券、会员卡与展览门票"
            onClick={() => onNavigate("cards")}
          />
          <MobileCell
            icon={<MobileTile icon={<SmileIcon size={15} />} color="#8D7CDF" />}
            label="表情"
            sublabel="我的表情与联名专辑"
            onClick={() => onNavigate("stickers")}
          />
        </div>

        <div className="mt-2 bg-white">
          <MobileCell
            icon={<MobileTile icon={<Settings size={15} />} color="#7C8B84" />}
            label="设置"
            sublabel="账号与安全、深浅色外观、通用"
            onClick={() => onNavigate("settings")}
            border={false}
          />
        </div>
        <div className="flex justify-center py-5">
          <div className="flex items-center gap-1.5 text-[7.5px] text-[#B3B3B3]">
            <WeChatLogo className="h-3 w-3" /> 微信 · 一个生活方式
          </div>
        </div>
      </div>
      <TabBar active="me" onChange={(t) => onNavigate(t)} />
    </div>
  );
}

function SmileIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="text-[14px] leading-none" style={{ fontSize: size }}>
      🙂
    </span>
  );
}

export function PhoneWeChat({
  screen,
  onScreenChange,
  onNotify,
}: {
  screen: MobileScreen;
  onScreenChange: (screen: MobileScreen) => void;
  onNotify: (text: string) => void;
}) {
  const store = useWeChatStore();
  const [contactId, setContactId] = useState("lin");

  const openChat = (id: string) => {
    store.setActiveChatId(id);
    onScreenChange("chat");
  };
  const openContact = (id: string) => {
    setContactId(id);
    onScreenChange("profile");
  };

  const lightStatusScreens: MobileScreen[] = [
    "channels",
    "call",
    "moments",
    "redpacket",
    "pay",
    "scan",
    "reading",
    "status",
    "floating",
  ];
  const isDark = lightStatusScreens.includes(screen) || (store.wechatDark && screen === "chats");

  const renderScreen = () => {
    switch (screen) {
      case "chats":
        return <ChatsScreen onOpenChat={openChat} onNavigate={onScreenChange} onNotify={onNotify} />;
      case "contacts":
        return <ContactsScreen onOpenContact={openContact} onNavigate={onScreenChange} onNotify={onNotify} />;
      case "discover":
        return <DiscoverScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "me":
        return <MeScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "chat":
        return <ChatScreen chatId={store.activeChatId} onNavigate={onScreenChange} onNotify={onNotify} />;
      case "profile":
        return (
          <ProfileScreen
            contactId={contactId}
            onOpenChat={openChat}
            onBack={() => onScreenChange("contacts")}
            onNotify={onNotify}
          />
        );
      case "newfriends":
        return <NewFriendsScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "moments":
        return <MomentsScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "moments_post":
        return <PostMomentScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "channels":
        return <ChannelsScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "mini":
        return <MiniProgramsScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "search":
        return <SearchScreen onBack={() => onScreenChange("chats")} onNotify={onNotify} />;
      case "scan":
        return <ScanScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "reading":
        return <ReadingScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "favorites":
        return <FavoritesScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "cards":
        return <CardsScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "stickers":
        return <StickersScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "settings":
        return <SettingsScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "wallet":
        return <WalletScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "pay":
        return <PayScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "transfer":
        return <TransferScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "redpacket":
        return <RedPacketScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "call":
        return <CallScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "status":
        return <StatusScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "floating":
        return <FloatingScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      case "qrcode":
        return <QRCodeScreen onNavigate={onScreenChange} onNotify={onNotify} />;
      default:
        return <ChatsScreen onOpenChat={openChat} onNavigate={onScreenChange} onNotify={onNotify} />;
    }
  };

  return (
    <div className="relative shrink-0 select-none">
      <div className="pointer-events-none absolute -left-[3px] top-[150px] h-[26px] w-[3px] rounded-l bg-[#282828]" />
      <div className="pointer-events-none absolute -left-[3px] top-[192px] h-[46px] w-[3px] rounded-l bg-[#282828]" />
      <div className="pointer-events-none absolute -left-[3px] top-[248px] h-[46px] w-[3px] rounded-l bg-[#282828]" />
      <div className="pointer-events-none absolute -right-[3px] top-[184px] h-[68px] w-[3px] rounded-r bg-[#282828]" />
      <div className="relative h-[700px] w-[336px] rounded-[46px] bg-[#1C1C1C] p-[7px] shadow-[0_30px_70px_-22px_rgba(28,40,32,.55),0_2px_4px_rgba(0,0,0,.35),inset_0_0_0_1px_rgba(255,255,255,.16)]">
        <div className="relative h-full w-full overflow-hidden rounded-[40px] bg-white">
          {store.inspectSpecs && (
            <div className="pointer-events-none absolute inset-x-0 top-[74px] z-[55] flex items-center justify-between border-y border-dashed border-[#FA5151]/70 bg-[#FA5151]/10 px-3 py-0.5 font-mono text-[8px] text-[#FA5151]">
              <span>SafeTop 30pt · NavBar 44pt</span>
              <span>Row 64pt · TabBar 70pt</span>
            </div>
          )}
          <div className="relative h-full w-full overflow-hidden">{renderScreen()}</div>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[60]">
            <PhoneStatusBar dark={!isDark} />
            <div className="absolute left-1/2 top-[9px] h-[23px] w-[91px] -translate-x-1/2 rounded-full bg-black" />
            <span className="absolute left-[calc(50%+27px)] top-[18px] h-[5px] w-[5px] rounded-full bg-[#233128] ring-1 ring-[#35443A]" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-[6px] z-[60] flex justify-center">
            <span className={cn("h-[4px] w-[106px] rounded-full", isDark ? "bg-white/85" : "bg-black/85")} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-[8px] tracking-[0.16em] text-[#9E9E96]">
        <span className="h-1 w-1 rounded-full bg-[#07C160]" />
        WECHAT MOBILE · 26 INTERACTIVE SCREENS
      </div>
    </div>
  );
}
