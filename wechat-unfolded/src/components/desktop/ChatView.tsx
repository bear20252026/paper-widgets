import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  FileText,
  Folder,
  Gift,
  Image as ImageIcon,
  Info,
  Mic,
  MoreHorizontal,
  Phone,
  Scissors,
  Search,
  Smile,
  Sparkles,
  Video,
  Volume2,
  X,
  ZoomIn,
} from "lucide-react";
import type { Chat, Message } from "../../data";
import { assets, contacts, me } from "../../data";
import { useWeChatStore } from "../../store";
import { Avatar, GroupAvatar, Switch, stickerSets } from "../shared";
import { cn } from "../../utils/cn";

function BubbleTail({ mine }: { mine: boolean }) {
  return (
    <span
      className={cn(
        "absolute top-[13px] h-2 w-2 rotate-45",
        mine ? "-right-1 bg-[#95EC69]" : "-left-1 bg-white dark:bg-[#2C2C2C]",
      )}
    />
  );
}

function MessageContent({
  message,
  onOpenImage,
  onNotify,
}: {
  message: Message;
  onOpenImage: (src: string) => void;
  onNotify: (text: string) => void;
}) {
  const mine = message.side === "me";
  const [playingVoice, setPlayingVoice] = useState(false);
  const [transcribed, setTranscribed] = useState<string | null>(null);

  useEffect(() => {
    if (!playingVoice) return;
    const t = window.setTimeout(() => setPlayingVoice(false), 2600);
    return () => window.clearTimeout(t);
  }, [playingVoice]);

  if (message.kind === "sticker") {
    return <div className="py-1 text-[44px] leading-none transition-transform hover:scale-110">{message.text}</div>;
  }
  if (message.kind === "image") {
    return (
      <button
        type="button"
        onClick={() => message.image && onOpenImage(message.image)}
        className="group relative overflow-hidden rounded-md bg-white p-[3px] shadow-[0_1px_2px_rgba(0,0,0,.05)] transition hover:shadow-md"
      >
        <img src={message.image} alt="聊天图片" className="max-h-[168px] w-[230px] rounded-[4px] object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[9px] text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
          <ZoomIn size={10} /> 查看原图
        </span>
      </button>
    );
  }
  if (message.kind === "voice") {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPlayingVoice((v) => !v)}
            className={cn(
              "relative flex h-[34px] items-center gap-2 rounded-[4px] px-3 transition",
              mine ? "bg-[#95EC69]" : "bg-white dark:bg-[#2C2C2C] dark:text-white",
            )}
          >
            <BubbleTail mine={mine} />
            <Volume2 size={14} className={cn("text-[#444] dark:text-white/80", playingVoice && "animate-pulse text-[#07C160]")} />
            <div className="flex items-center gap-[2px]">
              {[5, 11, 8, 15, 7, 12, 5, 9].map((h, i) => (
                <span
                  key={i}
                  className={cn("w-[2px] rounded-full transition-all", playingVoice ? "animate-pulse bg-[#07C160]" : "bg-[#6b6b6b]/50")}
                  style={{ height: playingVoice ? Math.max(4, (h + ((i * 5) % 9))) : h }}
                />
              ))}
            </div>
            <span className="ml-1 text-[11px] text-[#666] dark:text-white/70">{message.duration}″</span>
          </button>
          {!transcribed && (
            <button
              type="button"
              onClick={() => setTranscribed(message.duration === 12 ? "晚上回来吃饭吗？给你炖了玉米排骨汤。" : "设计稿我看过了，移动端交互细节特别棒！")}
              className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[9.5px] text-[#576B95] transition hover:bg-black/[0.08]"
            >
              转文字
            </button>
          )}
        </div>
        {transcribed && (
          <div className="max-w-[240px] rounded-[4px] bg-white/90 px-2.5 py-1.5 text-[11px] leading-4 text-[#333] shadow-xs">
            <span className="mr-1 inline-flex items-center text-[9px] text-[#07C160]">
              <Check size={9} className="mr-0.5" /> 语音转文字：
            </span>
            {transcribed}
          </div>
        )}
      </div>
    );
  }
  if (message.kind === "file") {
    return (
      <button
        type="button"
        onClick={() => onNotify(`已打开文件预览：${message.title}`)}
        className="relative w-[250px] rounded-[5px] bg-white p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,.06)] transition hover:shadow-md dark:bg-[#2C2C2C]"
      >
        <BubbleTail mine={mine} />
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-9 shrink-0 place-items-center rounded-[3px] bg-[#FF7B7B] text-[9px] font-bold text-white">PDF</div>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-medium text-[#222] dark:text-white">{message.title}</div>
            <div className="mt-1 text-[10px] text-[#999]">{message.size}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[#EFEFEF] pt-1.5 text-[10px] text-[#A3A3A3] dark:border-white/10">
          <span>微信电脑版</span>
          <span className="text-[#576B95]">另存为</span>
        </div>
      </button>
    );
  }
  if (message.kind === "link") {
    return (
      <button
        type="button"
        onClick={() => onNotify(`正在打开链接：${message.title}`)}
        className="relative w-[274px] rounded-[5px] bg-white p-3 text-left shadow-[0_1px_2px_rgba(0,0,0,.06)] transition hover:shadow-md dark:bg-[#2C2C2C]"
      >
        <BubbleTail mine={mine} />
        <div className="mb-2.5 line-clamp-2 text-[12.5px] leading-5 text-[#222] dark:text-white">{message.title}</div>
        <div className="flex gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-[10.5px] leading-4 text-[#999]">{message.description}</div>
            <div className="mt-2 text-[9.5px] text-[#B7B7B7]">微信派</div>
          </div>
          {message.image && <img src={message.image} alt="" className="h-[42px] w-[42px] rounded-[3px] object-cover" />}
        </div>
      </button>
    );
  }
  if (message.kind === "transfer") {
    return (
      <button
        type="button"
        onClick={() => onNotify(`已确认收款 ¥${message.amount || "88.00"} · 已存入微信零钱`)}
        className="w-[218px] overflow-hidden rounded-[5px] bg-[#F5A623] text-left text-white shadow-sm transition hover:brightness-105"
      >
        <div className="flex items-center gap-2.5 p-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 text-base font-semibold">¥</span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium">¥ {message.amount || "88.00"}</div>
            <div className="mt-0.5 truncate text-[10px] text-white/85">{message.title || "转账给朋友"}</div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-white/20 px-3 py-1.5 text-[9px] text-white/75">
          <span>微信转账</span>
          <span>点击收款</span>
        </div>
      </button>
    );
  }
  if (message.kind === "redpacket") {
    return (
      <button
        type="button"
        onClick={() => onNotify("🎉 恭喜发财！已在桌面端拆开红包 +¥66.66")}
        className="w-[218px] overflow-hidden rounded-[5px] bg-[#FA9D3B] text-left text-white shadow-sm transition hover:brightness-105"
      >
        <div className="flex items-center gap-2.5 p-3">
          <span className="text-2xl">🧧</span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium">{message.text || "恭喜发财，大吉大利"}</div>
            <div className="mt-0.5 text-[10px] text-white/85">领取红包</div>
          </div>
        </div>
        <div className="border-t border-white/20 px-3 py-1 text-[9px] text-white/75">微信红包</div>
      </button>
    );
  }
  return (
    <div
      className={cn(
        "relative max-w-[390px] rounded-[5px] px-3 py-2 text-[13px] leading-[1.55] shadow-[0_1px_2px_rgba(0,0,0,.04)]",
        mine ? "bg-[#95EC69] text-[#1A1A1A]" : "bg-white text-[#1A1A1A] dark:bg-[#2C2C2C] dark:text-[#EDEDED]",
      )}
    >
      <BubbleTail mine={mine} />
      <span className="whitespace-pre-wrap">{message.text}</span>
    </div>
  );
}

export function ChatView({
  chat,
  messages,
  onSend,
  onNotify,
}: {
  chat: Chat;
  messages: Message[];
  onSend: (chatId: string, message: Message) => void;
  onNotify: (text: string) => void;
}) {
  const store = useWeChatStore();
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [call, setCall] = useState<null | "video" | "voice">(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesForChat = useMemo(() => messages, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messagesForChat, chat.id]);

  const send = () => {
    if (!draft.trim()) return;
    onSend(chat.id, {
      id: `${Date.now()}`,
      side: "me",
      kind: "text",
      text: draft.trim(),
      time: "刚刚",
    });
    setDraft("");
    setShowEmoji(false);
  };

  const sendSampleImage = () => {
    onSend(chat.id, {
      id: `${Date.now()}`,
      side: "me",
      kind: "image",
      image: assets.gallery,
      time: "刚刚",
    });
    onNotify("图片已发送并实时同步到手机端");
  };

  const sendSampleRedPacket = () => {
    onSend(chat.id, {
      id: `${Date.now()}`,
      side: "me",
      kind: "redpacket",
      text: "春日看展快乐 🌿",
      time: "刚刚",
    });
    onNotify("已发出微信红包 · 可在手机端同步查看");
  };

  const sendSampleFile = () => {
    onSend(chat.id, {
      id: `${Date.now()}`,
      side: "me",
      kind: "file",
      title: "WeChat_UI_Benchmark_2026.pdf",
      size: "24.8 MB",
      time: "刚刚",
    });
    onNotify("已发送设计规范文档");
  };

  const subtitle =
    chat.type === "group" ? "4 位成员 · 跨端实时同步中" : chat.id === "file" ? "与手机互传文件" : chat.id === "wechat" ? "官方服务号" : chat.online ? "在线 · 手机与电脑同步" : "微信用户";

  return (
    <section
      className={cn(
        "relative flex min-w-0 flex-1 flex-col transition-colors",
        store.wechatDark ? "bg-[#111111] text-[#EDEDED]" : "bg-[#F5F5F5]",
      )}
    >
      {store.inspectSpecs && (
        <div className="pointer-events-none absolute inset-x-0 top-[55px] z-30 flex items-center justify-between border-b border-dashed border-[#FA5151]/60 bg-[#FA5151]/5 px-3 py-0.5 text-[9px] font-mono text-[#FA5151]">
          <span>HEADER: 55px · Border #E7E7E7</span>
          <span>BUBBLE: #95EC69 / Radius 5px / Max 390px</span>
        </div>
      )}

      <header
        className={cn(
          "flex h-[55px] shrink-0 items-center justify-between border-b px-5 transition-colors",
          store.wechatDark ? "border-white/10 bg-[#191919]" : "border-[#E7E7E7] bg-[#F7F7F7]",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={cn("truncate text-[14px] font-medium", store.wechatDark ? "text-white" : "text-[#1D1D1D]")}>
                {chat.name}
              </h3>
              {chat.type === "group" && <span className="text-[10px] text-[#A2A2A2]">(4)</span>}
              <span className="inline-flex items-center gap-1 rounded-full bg-[#07C160]/12 px-2 py-0.5 text-[9px] font-medium text-[#07A858]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#07C160]" /> 手机端同步
              </span>
            </div>
            <p className="text-[10px] text-[#A2A2A2]">{subtitle}</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-0.5", store.wechatDark ? "text-white/70" : "text-[#666]")}>
          <button
            onClick={() => setCall("voice")}
            className="grid h-8 w-8 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
            title="语音通话"
          >
            <Phone size={17} strokeWidth={1.8} />
          </button>
          <button
            onClick={() => setCall("video")}
            className="grid h-8 w-8 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
            title="视频通话"
          >
            <Video size={18} strokeWidth={1.8} />
          </button>
          <button
            onClick={() => setShowInfo((v) => !v)}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10",
              showInfo && "bg-[#E7E7E7] dark:bg-white/15",
            )}
            title="聊天信息"
          >
            <Info size={18} strokeWidth={1.8} />
          </button>
          <button
            onClick={() => onNotify("更多操作：消息免打扰、置顶聊天、清空记录")}
            className="grid h-8 w-8 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10"
            title="更多"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-7 py-5",
              store.wechatDark ? "bg-[#111111]" : "chat-canvas",
            )}
          >
            <div className="mx-auto flex w-full max-w-[650px] flex-col gap-4">
              {messagesForChat.map((message) => {
                if (message.side === "system") {
                  return (
                    <div key={message.id} className="py-0.5 text-center text-[10px] text-[#A8A8A8]">
                      {message.text}
                    </div>
                  );
                }
                const mine = message.side === "me";
                const sender = message.sender?.replace(/\s/g, "");
                const senderAvatar = sender
                  ? contacts.find(
                      (c) =>
                        c.name.replace(/\s/g, "") === sender ||
                        c.name.replace(/\s/g, "").startsWith(sender),
                    )?.avatar
                  : undefined;
                return (
                  <div key={message.id} className={cn("flex items-start gap-2.5", mine && "flex-row-reverse")}>
                    <Avatar
                      src={mine ? me.avatar : senderAvatar || chat.avatar}
                      className="mt-0.5 h-[34px] w-[34px] rounded-[4px]"
                      name={mine ? me.name : message.sender || chat.name}
                    />
                    <div className={cn("flex min-w-0 flex-col gap-1", mine ? "items-end" : "items-start")}>
                      {chat.type === "group" && !mine && message.sender && (
                        <span className="px-1 text-[10px] text-[#A2A2A2]">{message.sender}</span>
                      )}
                      <MessageContent
                        message={message}
                        onOpenImage={(src) => store.openLightbox(src, `${chat.name} · 聊天原图`, message.sender || chat.name)}
                        onNotify={onNotify}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="h-1" />
            </div>
          </div>

          <div
            className={cn(
              "shrink-0 border-t transition-colors",
              store.wechatDark ? "border-white/10 bg-[#191919]" : "border-[#E7E7E7] bg-[#F7F7F7]",
            )}
          >
            <div className={cn("flex h-[36px] items-center gap-3.5 px-5", store.wechatDark ? "text-white/70" : "text-[#666]")}>
              <button
                className="transition hover:text-[#07C160]"
                onClick={() => setShowEmoji((v) => !v)}
                title="表情"
              >
                <Smile size={18} strokeWidth={1.7} />
              </button>
              <button
                className="transition hover:text-[#07C160]"
                onClick={sendSampleImage}
                title="发送示例图片（双端同步）"
              >
                <ImageIcon size={17} strokeWidth={1.7} />
              </button>
              <button
                className="transition hover:text-[#07C160]"
                onClick={sendSampleFile}
                title="发送文件"
              >
                <Folder size={17} strokeWidth={1.7} />
              </button>
              <button
                className="transition hover:text-[#07C160]"
                onClick={sendSampleRedPacket}
                title="发送微信红包"
              >
                <Gift size={17} strokeWidth={1.7} />
              </button>
              <button
                className="transition hover:text-[#07C160]"
                onClick={() => onNotify("截图功能已就绪（快捷键 Alt + A）")}
                title="截图"
              >
                <Scissors size={16} strokeWidth={1.7} />
              </button>
              <button
                className="transition hover:text-[#07C160]"
                onClick={() => onNotify("聊天记录已按日期与多媒体分类")}
                title="聊天记录"
              >
                <Search size={16} strokeWidth={1.7} />
              </button>

              <div className="ml-auto flex items-center gap-1.5">
                {[
                  { label: "+发图", action: sendSampleImage },
                  { label: "+红包", action: sendSampleRedPacket },
                  { label: "+PDF", action: sendSampleFile },
                ].map((q) => (
                  <button
                    key={q.label}
                    onClick={q.action}
                    className="rounded border border-[#DCDCDC] bg-white/80 px-1.5 py-0.5 text-[9.5px] text-[#555] transition hover:border-[#07C160] hover:text-[#07C160] dark:border-white/15 dark:bg-white/10 dark:text-white/80"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {showEmoji && (
              <div className="mx-5 mb-2 grid grid-cols-8 gap-1 rounded-lg border border-[#EBEBEB] bg-white p-2 shadow-sm dark:border-white/10 dark:bg-[#242424]">
                {stickerSets.flat().slice(0, 24).map((emoji, i) => (
                  <button
                    key={`${emoji}-${i}`}
                    className="grid h-7 place-items-center rounded text-xl transition hover:bg-[#F5F5F5] dark:hover:bg-white/10"
                    onClick={() => setDraft((d) => d + emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-3 px-5 pb-3.5 pt-0.5">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="输入消息，按 Enter 发送并实时同步到右侧手机端..."
                className={cn(
                  "min-h-[54px] flex-1 resize-none bg-transparent text-[13px] leading-6 outline-none placeholder:text-[#A8A8A8]",
                  store.wechatDark ? "text-white" : "text-[#222]",
                )}
              />
              <button
                onClick={send}
                disabled={!draft.trim()}
                className={cn(
                  "mb-0.5 flex h-7 items-center gap-1 rounded px-3 text-[11px] font-medium transition",
                  draft.trim()
                    ? "bg-[#07C160] text-white hover:bg-[#06AD56]"
                    : "bg-[#EAEAEA] text-[#B5B5B5] dark:bg-white/10 dark:text-white/30",
                )}
              >
                发送 <span className="text-[9px] opacity-60">Enter</span>
              </button>
            </div>
          </div>
        </div>

        {showInfo && (
          <aside className="w-[218px] shrink-0 overflow-y-auto border-l border-[#E7E7E7] bg-[#F7F7F7] px-4 py-5 dark:border-white/10 dark:bg-[#191919]">
            <div className="flex flex-col items-center">
              {chat.avatars ? (
                <GroupAvatar images={chat.avatars} className="h-14 w-14 rounded-lg" />
              ) : (
                <Avatar src={chat.avatar} name={chat.name} className="h-14 w-14 rounded-lg" />
              )}
              <div className="mt-2.5 text-[13px] font-medium text-[#222] dark:text-white">{chat.name}</div>
              <div className="mt-1 text-[10px] text-[#A2A2A2]">
                {chat.type === "group" ? "春日设计小组 · 4 人" : chat.id === "file" ? "文件传输助手" : "微信号：wxid_suhe2026"}
              </div>
            </div>
            <div className="mt-5 flex justify-around border-b border-[#E9E9E9] pb-4 dark:border-white/10">
              {[
                { icon: ImageIcon, label: "图片" },
                { icon: Folder, label: "文件" },
                { icon: FileText, label: "链接" },
                { icon: Sparkles, label: "同步" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => onNotify(`${item.label}记录已同步`)}
                  className="flex flex-col items-center gap-1.5 text-[#777] hover:text-[#07C160]"
                >
                  <item.icon size={16} strokeWidth={1.6} />
                  <span className="text-[9.5px]">{item.label}</span>
                </button>
              ))}
            </div>
            <div className="space-y-3.5 border-b border-[#E9E9E9] py-4 dark:border-white/10">
              {[
                { label: "消息免打扰", on: chat.muted || false },
                { label: "置顶聊天", on: chat.pinned || false },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-[11px] text-[#333] dark:text-white/80">
                  <span>{row.label}</span>
                  <Switch small on={row.on} onChange={() => onNotify(`${row.label}设置已更新`)} />
                </div>
              ))}
            </div>
            <div className="pt-4">
              <div className="mb-2.5 flex items-center justify-between text-[10px] text-[#8E8E8E]">
                <span>聊天相册与文件</span>
                <button onClick={() => onNotify("已打开全部聊天文件")} className="text-[#576B95]">
                  全部
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[assetsGallery, assetsDesk, assetsTulips, assetsBrunch].map((img, i) => (
                  <button
                    key={i}
                    onClick={() => store.openLightbox(img, "聊天相册历史图片", chat.name)}
                    className="overflow-hidden rounded-sm"
                  >
                    <img src={img} alt="聊天文件" className="aspect-square w-full object-cover transition hover:scale-105" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => onNotify("已打开聊天设置")}
              className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-md border border-[#E4E4E4] py-1.5 text-[10px] text-[#666] hover:bg-white dark:border-white/15 dark:text-white/70"
            >
              <Bell size={11} /> 聊天设置
            </button>
          </aside>
        )}
      </div>

      {call && (
        <div className="absolute inset-0 z-30 overflow-hidden bg-[#1C2723]">
          <img src={call === "video" ? assetsLakeWide : assetsDawnWide} alt="" className="h-full w-full object-cover opacity-55 blur-[1px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/70" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-7 py-5 text-white">
            <div>
              <div className="text-[13px] font-medium">{call === "video" ? "视频通话" : "语音通话"}</div>
              <div className="mt-0.5 text-[10px] text-white/60">端到端加密 · 跨端低延迟音视频</div>
            </div>
            <button
              onClick={() => setCall(null)}
              className="grid h-7 w-7 place-items-center rounded-full bg-black/25 text-white backdrop-blur"
            >
              <X size={15} />
            </button>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center pb-8">
            <Avatar src={chat.avatar} name={chat.name} className="h-20 w-20 rounded-xl shadow-2xl" />
            <div className="mt-4 text-[17px] font-medium text-white">{chat.name}</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/65">
              <span className="flex gap-[3px]">
                <span className="h-1 w-1 animate-pulse rounded-full bg-[#07C160]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-[#07C160] [animation-delay:150ms]" />
                <span className="h-1 w-1 animate-pulse rounded-full bg-[#07C160] [animation-delay:300ms]" />
              </span>
              正在等待对方接受邀请...
            </div>
          </div>
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4">
            <button onClick={() => onNotify("麦克风已静音")} className="grid h-11 w-11 place-items-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30">
              <Mic size={19} />
            </button>
            <button onClick={() => setCall(null)} className="grid h-12 w-12 place-items-center rounded-full bg-[#FA5151] text-white shadow-lg hover:bg-[#e34848]">
              <Phone size={20} className="rotate-[135deg]" />
            </button>
            <button onClick={() => setCall(null)} className="grid h-11 w-11 place-items-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30">
              <Video size={19} />
            </button>
          </div>
          <div className="absolute bottom-6 right-5 flex h-24 w-16 items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-black/20">
            <Avatar src={me.avatar} className="h-full w-full rounded-lg" name="我" />
          </div>
        </div>
      )}
    </section>
  );
}

const assetsGallery = "https://images.pexels.com/photos/35436850/pexels-photo-35436850.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=300&h=300";
const assetsDesk = "https://images.pexels.com/photos/2842457/pexels-photo-2842457.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=300&h=300";
const assetsTulips = "https://images.pexels.com/photos/35983785/pexels-photo-35983785.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=300&h=300";
const assetsBrunch = "https://images.pexels.com/photos/9000104/pexels-photo-9000104.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=300&h=300";
const assetsLakeWide = "https://images.pexels.com/photos/4084851/pexels-photo-4084851.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700";
const assetsDawnWide = "https://images.pexels.com/photos/28593673/pexels-photo-28593673.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700";

export { assetsBrunch, assetsDesk, assetsGallery, assetsLakeWide, assetsTulips };
