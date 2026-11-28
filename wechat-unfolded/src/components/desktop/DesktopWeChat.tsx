import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Compass,
  Folder,
  Image as ImageIcon,
  LayoutGrid,
  Lock,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Settings,
  Smartphone,
  Star,
  Sun,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";
import { contacts, me, type Chat, type Message, type Person } from "../../data";
import { useWeChatStore } from "../../store";
import { Avatar, GroupAvatar, WeChatBadge, WeChatFileIcon, WeChatLogo } from "../shared";
import { cn } from "../../utils/cn";
import { ChatView } from "./ChatView";
import { ContactsPage, FavoritesPage, FilesPage } from "./PanelsA";
import { ChannelsPage, MiniProgramsPage, MomentsPage, SettingsPage, WalletPage } from "./PanelsB";
import { ArticlesPage, ScreenLockPage, SearchHubPage } from "./PanelsC";

export type DesktopPage =
  | "chats"
  | "contacts"
  | "favorites"
  | "files"
  | "moments"
  | "channels"
  | "mini"
  | "search_hub"
  | "articles"
  | "wallet"
  | "lock"
  | "settings";

const railItems: { id: DesktopPage; label: string; icon: typeof MessageCircle }[] = [
  { id: "chats", label: "聊天", icon: MessageCircle },
  { id: "contacts", label: "通讯录", icon: Users },
  { id: "favorites", label: "收藏", icon: Star },
  { id: "files", label: "聊天文件", icon: Folder },
  { id: "moments", label: "朋友圈", icon: ImageIcon },
  { id: "channels", label: "视频号", icon: Video },
  { id: "articles", label: "看一看", icon: BookOpen },
  { id: "search_hub", label: "搜一搜", icon: Compass },
  { id: "mini", label: "小程序", icon: LayoutGrid },
  { id: "wallet", label: "微信支付", icon: Wallet },
];

function ChatListItem({
  chat,
  active,
  dark,
  onClick,
}: {
  chat: Chat;
  active: boolean;
  dark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-2.5 px-4 py-[9px] text-left transition",
        dark
          ? active
            ? "bg-white/15"
            : chat.pinned
              ? "bg-white/[0.04] hover:bg-white/10"
              : "hover:bg-white/[0.07]"
          : active
            ? "bg-[#E2E2E2]"
            : chat.pinned
              ? "bg-[#F0F0F0] hover:bg-[#E8E8E8]"
              : "hover:bg-[#ECECEC]",
      )}
    >
      {chat.avatars ? (
        <GroupAvatar images={chat.avatars} className="h-[38px] w-[38px] rounded-[5px]" />
      ) : chat.id === "file" ? (
        <WeChatFileIcon className="h-[38px] w-[38px] rounded-[5px]" />
      ) : chat.icon === "wechat" ? (
        <span className="grid h-[38px] w-[38px] place-items-center rounded-[5px] bg-[#07C160]">
          <WeChatLogo className="h-7 w-7" />
        </span>
      ) : (
        <Avatar src={chat.avatar} name={chat.name} className="h-[38px] w-[38px] rounded-[5px]" online={chat.online} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-1.5">
          <span className={cn("truncate text-[12px]", dark ? "text-white/90" : "text-[#272727]")}>{chat.name}</span>
          <span className="shrink-0 text-[8.5px] font-light text-[#AAA]">{chat.time}</span>
        </span>
        <span className="mt-[3px] flex items-center justify-between gap-1.5">
          <span className="truncate text-[9.5px] text-[#A2A2A2]">{chat.last}</span>
          <span className="flex shrink-0 items-center gap-1">
            {chat.muted && <span className="text-[9px] text-[#BFBFBF]">⌁</span>}
            {chat.unread ? <WeChatBadge count={chat.unread} /> : null}
          </span>
        </span>
      </span>
    </button>
  );
}

export function DesktopWeChat({
  page,
  onPageChange,
  onNotify,
}: {
  page: DesktopPage;
  onPageChange: (page: DesktopPage) => void;
  onNotify: (text: string) => void;
}) {
  const store = useWeChatStore();
  const [query, setQuery] = useState("");
  const [globalSearch, setGlobalSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [plusMenu, setPlusMenu] = useState(false);
  const [filterMode, setFilterMode] = useState<"全部" | "未读" | "群聊">("全部");
  const [ephemeral, setEphemeral] = useState<Person | null>(null);

  const activeChat = useMemo(() => {
    const found = store.chats.find((c) => c.id === store.activeChatId);
    if (found) return found;
    if (ephemeral?.id === store.activeChatId) {
      return {
        id: ephemeral.id,
        name: ephemeral.name,
        avatar: ephemeral.avatar,
        type: "direct" as const,
        last: "",
        time: "",
        online: ephemeral.online,
      };
    }
    return store.chats[0];
  }, [store.chats, store.activeChatId, ephemeral]);

  const filteredChats = useMemo(() => {
    return store.chats.filter((c) => {
      const matchQuery =
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.last.toLowerCase().includes(query.toLowerCase());
      if (!matchQuery) return false;
      if (filterMode === "未读") return Boolean(c.unread && c.unread > 0);
      if (filterMode === "群聊") return c.type === "group";
      return true;
    });
  }, [store.chats, query, filterMode]);

  const openChat = (id: string) => {
    const existing = store.chats.find((c) => c.id === id);
    if (!existing) {
      const contact = contacts.find((c) => c.id === id);
      if (contact) {
        setEphemeral(contact);
      }
    }
    store.setActiveChatId(id);
    onPageChange("chats");
    setGlobalSearch(false);
    setPlusMenu(false);
  };

  const sendMessage = (chatId: string, message: Message) => {
    store.sendMessage(chatId, message, "桌面端");
  };

  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      return {
        people: contacts.slice(0, 3),
        conversations: store.chats.slice(0, 3),
        moments: store.moments.slice(0, 2),
      };
    }
    return {
      people: contacts.filter((p) => p.name.toLowerCase().includes(q) || p.note?.toLowerCase().includes(q)).slice(0, 4),
      conversations: store.chats.filter((c) => c.name.toLowerCase().includes(q) || c.last.toLowerCase().includes(q)).slice(0, 4),
      moments: store.moments.filter((m) => m.text.toLowerCase().includes(q)).slice(0, 2),
    };
  }, [searchTerm, store.chats, store.moments]);

  const totalUnread = store.chats.reduce((acc, c) => acc + (c.unread || 0), 0);

  return (
    <div
      className={cn(
        "relative flex h-[640px] min-w-[680px] flex-col overflow-hidden rounded-[13px] border shadow-[0_30px_80px_-24px_rgba(24,30,26,.45),0_2px_6px_rgba(0,0,0,.12)] transition-colors",
        store.wechatDark ? "border-white/15 bg-[#191919] text-white" : "border-black/10 bg-[#F7F7F7]",
      )}
    >
      {store.inspectSpecs && (
        <div className="pointer-events-none absolute left-[60px] top-[31px] z-40 rounded-br-md bg-[#FA5151] px-2 py-0.5 font-mono text-[8.5px] text-white shadow">
          Rail: 60px (#2E2E2E) · List: 258px (#F7F7F7) · Canvas: Flex-1
        </div>
      )}

      {/* Window Titlebar */}
      <div
        className={cn(
          "flex h-[31px] shrink-0 items-center gap-2 border-b px-3.5 transition-colors",
          store.wechatDark ? "border-white/10 bg-[#222222]" : "border-[#DCDCDC] bg-[#ECECEC]",
        )}
      >
        <div className="flex items-center gap-[6px]">
          <span className="h-[10px] w-[10px] rounded-full bg-[#FF5F57]" />
          <span className="h-[10px] w-[10px] rounded-full bg-[#FEBC2E]" />
          <span className="h-[10px] w-[10px] rounded-full bg-[#28C840]" />
        </div>
        <div className="mx-auto flex items-center gap-1.5 text-[9.5px] text-[#8B8B8B]">
          <WeChatLogo className="h-3 w-3" /> 微信 4.0 <ChevronRight size={8} className="text-[#B8B8B8]" /> {me.name}
          <span className="ml-1 rounded-full bg-[#07C160]/15 px-1.5 py-0.2 text-[8.5px] text-[#07A858]">
            {store.myStatus.emoji} {store.myStatus.label}
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-[#8B8B8B]">
          <button
            onClick={() => store.setWechatDark(!store.wechatDark)}
            title="切换深浅色模式"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] hover:bg-black/5 hover:text-[#222] dark:hover:bg-white/10 dark:hover:text-white"
          >
            {store.wechatDark ? <Sun size={11} className="text-[#F5B640]" /> : <Moon size={11} />}
            <span>{store.wechatDark ? "浅色" : "深色"}</span>
          </button>
          <button onClick={() => setGlobalSearch(true)} title="全局搜索 (⌘K)" className="hover:text-[#07C160]">
            <Search size={11} />
          </button>
          <button onClick={() => onPageChange("lock")} title="锁定微信" className="hover:text-[#07C160]">
            <Lock size={11} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left Navigation Rail */}
        <aside className="flex w-[60px] shrink-0 flex-col items-center bg-[#2E2E2E] py-3.5">
          <button onClick={() => onPageChange("settings")} className="group relative mb-3" title={`${me.name} · ${store.myStatus.label}`}>
            <Avatar src={me.avatar} name={me.name} className="h-[34px] w-[34px] rounded-[6px] ring-1 ring-white/10" online />
            <span className="absolute -bottom-1 -left-1 grid h-4 w-4 place-items-center rounded-full bg-[#1F1F1F] text-[9px] shadow">
              {store.myStatus.emoji}
            </span>
          </button>
          <div className="flex w-full flex-col items-center gap-1">
            {railItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                title={item.label}
                className={cn(
                  "group relative grid h-8 w-9 place-items-center rounded-lg transition",
                  page === item.id ? "bg-white/[0.13] text-[#07C160]" : "text-[#9B9B9B] hover:bg-white/[0.07] hover:text-[#E5E5E5]",
                )}
              >
                <item.icon size={18} strokeWidth={1.65} />
                {item.id === "chats" && totalUnread > 0 && (
                  <span className="absolute right-[6px] top-[5px] h-1.5 w-1.5 rounded-full bg-[#FA5151] ring-2 ring-[#2E2E2E]" />
                )}
                <span className="pointer-events-none absolute left-[48px] z-30 hidden whitespace-nowrap rounded bg-[#1A1A1A] px-2 py-1 text-[9px] text-white shadow-xl group-hover:block">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-auto flex flex-col items-center gap-1">
            <button
              onClick={() => onPageChange("lock")}
              title="锁定桌面端"
              className={cn(
                "grid h-8 w-9 place-items-center rounded-lg transition",
                page === "lock" ? "bg-white/[0.13] text-[#07C160]" : "text-[#9B9B9B] hover:bg-white/[0.07] hover:text-[#E5E5E5]",
              )}
            >
              <Lock size={17} strokeWidth={1.65} />
            </button>
            <button
              onClick={() => onNotify("手机端与桌面端已开启实时双向同步")}
              title="手机已连接"
              className="grid h-8 w-9 place-items-center rounded-lg text-[#07C160] transition hover:bg-white/[0.07]"
            >
              <Smartphone size={17} strokeWidth={1.65} />
            </button>
            <button
              onClick={() => onPageChange("settings")}
              title="设置"
              className={cn(
                "grid h-8 w-9 place-items-center rounded-lg transition",
                page === "settings" ? "bg-white/[0.13] text-[#07C160]" : "text-[#9B9B9B] hover:bg-white/[0.07] hover:text-[#E5E5E5]",
              )}
            >
              <Settings size={17} strokeWidth={1.65} />
            </button>
          </div>
        </aside>

        {page === "chats" && (
          <div className="flex min-h-0 min-w-0 flex-1">
            <aside
              className={cn(
                "flex w-[258px] shrink-0 flex-col border-r transition-colors",
                store.wechatDark ? "border-white/10 bg-[#191919]" : "border-[#E5E5E5] bg-[#F7F7F7]",
              )}
            >
              <div className="shrink-0 px-4 pb-2 pt-3">
                <div className="flex h-7 items-center justify-between">
                  <h2 className={cn("text-[15px] font-medium tracking-[0.02em]", store.wechatDark ? "text-white" : "text-[#1F1F1F]")}>
                    微信
                  </h2>
                  <div className="relative flex items-center gap-2 text-[#555] dark:text-white/70">
                    <button onClick={() => setGlobalSearch(true)} title="搜索">
                      <Search size={15} />
                    </button>
                    <button onClick={() => setPlusMenu((v) => !v)} title="新建">
                      <Plus size={16} />
                    </button>
                    {plusMenu && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setPlusMenu(false)} />
                        <div className="absolute -right-1 top-7 z-40 w-[160px] rounded-lg border border-[#E6E6E6] bg-white py-1.5 shadow-[0_12px_34px_rgba(0,0,0,.15)] dark:border-white/10 dark:bg-[#262626]">
                          {[
                            ["发起群聊", Users],
                            ["添加朋友", Plus],
                            ["搜一搜", Compass],
                            ["看一看专栏", BookOpen],
                            ["锁定微信", Lock],
                          ].map(([label, Icon]) => {
                            const I = Icon as typeof Users;
                            return (
                              <button
                                key={label as string}
                                onClick={() => {
                                  setPlusMenu(false);
                                  if (label === "发起群聊") {
                                    onNotify("已进入「春日设计小组」群聊");
                                    openChat("spring");
                                  } else if (label === "搜一搜") onPageChange("search_hub");
                                  else if (label === "看一看专栏") onPageChange("articles");
                                  else if (label === "锁定微信") onPageChange("lock");
                                  else onNotify("添加朋友：搜索微信号 / 手机号");
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-[10.5px] text-[#444] hover:bg-[#F5F5F5] dark:text-white/85 dark:hover:bg-white/10"
                              >
                                <I size={13} className="text-[#777]" /> {label as string}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-2 flex h-[29px] items-center gap-1.5 rounded-md px-2",
                    store.wechatDark ? "bg-white/10" : "bg-[#E9E9E9]",
                  )}
                >
                  <Search size={12} className="text-[#A2A2A2]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索聊天与联系人"
                    className={cn(
                      "w-full bg-transparent text-[10.5px] outline-none placeholder:text-[#A6A6A6]",
                      store.wechatDark ? "text-white" : "text-[#333]",
                    )}
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="text-[#A6A6A6]">
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <div
                  className={cn(
                    "flex items-center gap-1.5 border-b px-4 pb-1.5 pt-1",
                    store.wechatDark ? "border-white/10" : "border-[#EAEAEA]",
                  )}
                >
                  {(["全部", "未读", "群聊"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterMode(t)}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[8.5px] transition",
                        filterMode === t
                          ? "bg-[#07C160] text-white"
                          : "text-[#A6A6A6] hover:text-[#555]",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {filteredChats.map((chat) => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    dark={store.wechatDark}
                    active={chat.id === activeChat.id}
                    onClick={() => {
                      setEphemeral(null);
                      store.setActiveChatId(chat.id);
                    }}
                  />
                ))}
                {filteredChats.length === 0 && (
                  <div className="py-8 text-center text-[10px] text-[#AAA]">没有匹配的会话</div>
                )}
              </div>
              <div
                className={cn(
                  "flex h-7 shrink-0 items-center justify-between border-t px-3 text-[8.5px] text-[#B0B0B0]",
                  store.wechatDark ? "border-white/10" : "border-[#E9E9E9]",
                )}
              >
                <span>{totalUnread > 0 ? `${totalUnread} 条未读` : "全部已读"}</span>
                <button
                  onClick={() => {
                    store.markAllRead();
                    onNotify("所有未读消息已清零");
                  }}
                  className="hover:text-[#07C160]"
                >
                  全部已读
                </button>
              </div>
            </aside>
            <ChatView
              chat={activeChat}
              messages={store.messages[activeChat.id] || []}
              onSend={sendMessage}
              onNotify={onNotify}
            />
          </div>
        )}

        {page === "contacts" && <ContactsPage notify={onNotify} onOpenChat={openChat} />}
        {page === "favorites" && <FavoritesPage notify={onNotify} />}
        {page === "files" && <FilesPage notify={onNotify} />}
        {page === "moments" && <MomentsPage notify={onNotify} />}
        {page === "channels" && <ChannelsPage notify={onNotify} />}
        {page === "mini" && <MiniProgramsPage notify={onNotify} />}
        {page === "search_hub" && <SearchHubPage notify={onNotify} onOpenArticle={() => onPageChange("articles")} />}
        {page === "articles" && <ArticlesPage notify={onNotify} />}
        {page === "wallet" && <WalletPage notify={onNotify} />}
        {page === "lock" && <ScreenLockPage notify={onNotify} onUnlock={() => onPageChange("chats")} />}
        {page === "settings" && <SettingsPage notify={onNotify} />}
      </div>

      {globalSearch && (
        <div
          className="absolute inset-0 z-50 flex items-start justify-center bg-black/25 px-7 pt-[50px] backdrop-blur-[2px]"
          onClick={() => setGlobalSearch(false)}
        >
          <div
            className="w-full max-w-[530px] overflow-hidden rounded-xl border border-black/10 bg-[#FBFBFB] shadow-[0_20px_60px_rgba(0,0,0,.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 items-center gap-2 border-b border-[#EAEAEA] bg-white px-4">
              <Search size={16} className="text-[#8A8A8A]" />
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索聊天、联系人、朋友圈、公众号"
                className="flex-1 bg-transparent text-[12px] text-[#333] outline-none placeholder:text-[#B0B0B0]"
              />
              <span className="rounded border border-[#E7E7E7] px-1.5 py-0.5 text-[8px] text-[#AAA]">ESC</span>
              <button onClick={() => setGlobalSearch(false)} className="text-[#A6A6A6]">
                <X size={15} />
              </button>
            </div>
            <div className="flex gap-2 border-b border-[#F0F0F0] bg-[#FAFAFA] px-4 py-2">
              {["综合", "聊天记录", "联系人", "朋友圈", "收藏"].map((t, i) => (
                <button
                  key={t}
                  onClick={() => onNotify(`搜索分类：${t}`)}
                  className={cn(
                    "rounded px-2 py-1 text-[9px]",
                    i === 0 ? "bg-[#07C160] text-white" : "text-[#888] hover:bg-[#F0F0F0]",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="scrollbar-thin max-h-[390px] overflow-y-auto p-2">
              <div className="px-2 py-1.5 text-[8.5px] font-medium tracking-wider text-[#A6A6A6]">联系人</div>
              {searchResults.people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openChat(p.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-[#F2F2F2]"
                >
                  <Avatar src={p.avatar} name={p.name} className="h-7 w-7 rounded-[4px]" />
                  <span className="text-[10.5px] text-[#333]">{p.name}</span>
                  <span className="ml-auto text-[8.5px] text-[#AAA]">{p.note}</span>
                  <ChevronRight size={11} className="text-[#C6C6C6]" />
                </button>
              ))}
              <div className="mt-1 px-2 py-1.5 text-[8.5px] font-medium tracking-wider text-[#A6A6A6]">聊天</div>
              {searchResults.conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openChat(c.id)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-[#F2F2F2]"
                >
                  <Avatar src={c.avatar} name={c.name} className="h-7 w-7 rounded-[4px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10.5px] text-[#333]">{c.name}</span>
                    <span className="mt-0.5 block truncate text-[8.5px] text-[#AAA]">{c.last}</span>
                  </span>
                  <span className="text-[8px] text-[#B0B0B0]">{c.time}</span>
                </button>
              ))}
              <div className="mt-1 px-2 py-1.5 text-[8.5px] font-medium tracking-wider text-[#A6A6A6]">朋友圈</div>
              {searchResults.moments.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onPageChange("moments");
                    setGlobalSearch(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-[#F2F2F2]"
                >
                  <Avatar src={m.avatar} name={m.name} className="h-7 w-7 rounded-[4px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] text-[#333]">{m.name}</span>
                    <span className="mt-0.5 block truncate text-[8.5px] text-[#AAA]">{m.text}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-[#EDEDED] bg-[#FAFAFA] px-4 py-2 text-[8px] text-[#B0B0B0]">
              <span>↑↓ 选择 · Enter 打开会话</span>
              <span>搜索范围：双端同步记录</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
