import { useEffect, useState } from "react";
import {
  chats as initialChats,
  conversations as initialConversations,
  moments as initialMoments,
  type Chat,
  type Message,
  type Moment,
} from "./data";

export type UserStatus = {
  id: string;
  emoji: string;
  label: string;
  place?: string;
  bg: string;
  friendsCount: number;
};

export const STATUS_PRESETS: UserStatus[] = [
  { id: "coffee", emoji: "☕", label: "喝咖啡", place: "天目里 · %Arabica", bg: "from-[#6E5641] via-[#4C3B2D] to-[#271F18]", friendsCount: 4 },
  { id: "exhibit", emoji: "🌿", label: "看展中", place: "天目里美术馆", bg: "from-[#355242] via-[#263C30] to-[#16241C]", friendsCount: 6 },
  { id: "music", emoji: "🎧", label: "听歌", place: "房东的猫 · 风经过的地方", bg: "from-[#3B4E6B] via-[#28364A] to-[#18212E]", friendsCount: 9 },
  { id: "work", emoji: "💻", label: "搬砖", place: "Figma · 微信设计规范", bg: "from-[#4A4E54] via-[#32363B] to-[#1D2024]", friendsCount: 12 },
  { id: "happy", emoji: "🌷", label: "美滋滋", place: "杭州 · 春日午后", bg: "from-[#7A545E] via-[#573A42] to-[#2D1E23]", friendsCount: 7 },
  { id: "dream", emoji: "🌙", label: "发呆", place: "在生活里慢慢走", bg: "from-[#3E3A63] via-[#2A2745] to-[#181629]", friendsCount: 3 },
];

type SharedState = {
  chats: Chat[];
  messages: Record<string, Message[]>;
  moments: Moment[];
  likedMomentIds: string[];
  myStatus: UserStatus;
  activeChatId: string;
  wechatDark: boolean;
  inspectSpecs: boolean;
  lightbox: { src: string; caption?: string; author?: string } | null;
  lastSyncEvent: { text: string; timestamp: number } | null;
};

let state: SharedState = {
  chats: initialChats,
  messages: initialConversations,
  moments: initialMoments,
  likedMomentIds: ["mo1"],
  myStatus: STATUS_PRESETS[1],
  activeChatId: "lin",
  wechatDark: false,
  inspectSpecs: false,
  lightbox: null,
  lastSyncEvent: { text: "双端实时同步已就绪", timestamp: Date.now() },
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function useWeChatStore() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    ...state,
    setActiveChatId(id: string) {
      state = {
        ...state,
        activeChatId: id,
        chats: state.chats.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
      };
      emit();
    },
    sendMessage(chatId: string, message: Message, source: "桌面端" | "移动端" = "移动端") {
      const prevList = state.messages[chatId] || [];
      const preview =
        message.kind === "image"
          ? "[图片]"
          : message.kind === "voice"
            ? `[语音] ${message.duration || 6}″`
            : message.kind === "redpacket"
              ? `[微信红包] ${message.text || "恭喜发财，大吉大利"}`
              : message.kind === "transfer"
                ? `[转账] ¥${message.amount || "88.00"}`
                : message.kind === "file"
                  ? `[文件] ${message.title}`
                  : message.kind === "sticker"
                    ? `[动画表情] ${message.text}`
                    : message.text || "";

      const existsInChats = state.chats.some((c) => c.id === chatId);
      const updatedChats = existsInChats
        ? state.chats.map((c) => (c.id === chatId ? { ...c, last: preview, time: "刚刚", unread: 0 } : c))
        : state.chats;

      state = {
        ...state,
        activeChatId: chatId,
        chats: updatedChats,
        messages: {
          ...state.messages,
          [chatId]: [...prevList, message],
        },
        lastSyncEvent: {
          text: `${source}发送消息 · 已实时同步至另一端`,
          timestamp: Date.now(),
        },
      };
      emit();
    },
    toggleLikeMoment(momentId: string) {
      const liked = state.likedMomentIds.includes(momentId);
      const nextLiked = liked
        ? state.likedMomentIds.filter((id) => id !== momentId)
        : [...state.likedMomentIds, momentId];
      state = {
        ...state,
        likedMomentIds: nextLiked,
        lastSyncEvent: {
          text: liked ? "已取消朋友圈点赞 · 双端已同步" : "已赞朋友圈 · 双端已同步",
          timestamp: Date.now(),
        },
      };
      emit();
    },
    addMomentComment(momentId: string, text: string, author = "苏禾") {
      if (!text.trim()) return;
      state = {
        ...state,
        moments: state.moments.map((m) =>
          m.id === momentId
            ? { ...m, comments: [...m.comments, { name: author, text: text.trim() }] }
            : m,
        ),
        lastSyncEvent: {
          text: "朋友圈新评论 · 双端已同步",
          timestamp: Date.now(),
        },
      };
      emit();
    },
    publishMoment(payload: { text: string; images: string[]; location?: string }) {
      const newMoment: Moment = {
        id: `mo-${Date.now()}`,
        name: "苏 禾",
        avatar: "https://images.pexels.com/photos/38785088/pexels-photo-38785088.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=240&h=240",
        text: payload.text || "分享今日的光线与心情 🌿",
        images: payload.images.length ? payload.images : undefined,
        location: payload.location || "杭州 · 天目里",
        time: "刚刚",
        likes: ["林小满", "Anna Chen"],
        comments: [{ name: "林小满", text: "好看！刚刚在桌面端也刷到了 ✦" }],
      };
      state = {
        ...state,
        moments: [newMoment, ...state.moments],
        likedMomentIds: [newMoment.id, ...state.likedMomentIds],
        lastSyncEvent: {
          text: "已发表新朋友圈 · 桌面端与手机端同步更新",
          timestamp: Date.now(),
        },
      };
      emit();
    },
    setMyStatus(status: UserStatus) {
      state = {
        ...state,
        myStatus: status,
        lastSyncEvent: {
          text: `状态已更新为「${status.emoji} ${status.label}」`,
          timestamp: Date.now(),
        },
      };
      emit();
    },
    setWechatDark(dark: boolean) {
      state = {
        ...state,
        wechatDark: dark,
        lastSyncEvent: {
          text: dark ? "已切换为微信深色模式 · Dark Mode" : "已切换为微信浅色模式 · Light Mode",
          timestamp: Date.now(),
        },
      };
      emit();
    },
    setInspectSpecs(inspect: boolean) {
      state = {
        ...state,
        inspectSpecs: inspect,
      };
      emit();
    },
    openLightbox(src: string, caption?: string, author?: string) {
      state = {
        ...state,
        lightbox: { src, caption, author },
      };
      emit();
    },
    closeLightbox() {
      state = {
        ...state,
        lightbox: null,
      };
      emit();
    },
    markAllRead() {
      state = {
        ...state,
        chats: state.chats.map((c) => ({ ...c, unread: 0 })),
        lastSyncEvent: {
          text: "全部未读消息已清零",
          timestamp: Date.now(),
        },
      };
      emit();
    },
  };
}
