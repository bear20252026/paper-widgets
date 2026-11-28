import { useState } from "react";
import {
  AtSign,
  ChevronRight,
  Compass,
  Delete,
  Disc3,
  Download,
  FileText,
  Headphones,
  Heart,
  MapPin,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Smile,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { assets, contacts, me, miniApps, px } from "../../data";
import { STATUS_PRESETS, useWeChatStore } from "../../store";
import { Avatar } from "../shared";
import { cn } from "../../utils/cn";
import { MobileTop, PhoneBack } from "./atoms";
import type { MobileScreen } from "./types";

type BaseProps = {
  onNavigate: (screen: MobileScreen) => void;
  onNotify: (message: string) => void;
};

export function StatusScreen({ onNavigate, onNotify }: BaseProps) {
  const store = useWeChatStore();
  const [selected, setSelected] = useState(store.myStatus);
  const [customNote, setCustomNote] = useState("把日常过成喜欢的样子 🌿");

  const applyStatus = () => {
    store.setMyStatus(selected);
    onNotify(`已设为「${selected.emoji} ${selected.label}」· 24小时内有效`);
    onNavigate("me");
  };

  return (
    <div className={cn("relative flex h-full flex-col overflow-hidden bg-gradient-to-b pt-[30px] text-white transition-all duration-500", selected.bg)}>
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(#fff 0.7px, transparent 0.7px)", backgroundSize: "18px 18px" }} />
      <div className="relative z-10 flex h-[44px] items-center justify-between px-3">
        <button onClick={() => onNavigate("me")} className="grid h-8 w-8 place-items-center rounded-full bg-black/20">
          <X size={18} />
        </button>
        <span className="text-[13.5px] font-medium">设为状态</span>
        <button
          onClick={applyStatus}
          className="rounded-full bg-[#07C160] px-3 py-1 text-[11px] font-medium text-white shadow"
        >
          就这样
        </button>
      </div>

      {/* Live Preview Card */}
      <div className="relative z-10 mx-4 mt-2 overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar src={me.avatar} name={me.name} className="h-10 w-10 rounded-full ring-2 ring-white/30" />
            <div>
              <div className="text-[13px] font-medium">{me.name}</div>
              <div className="text-[9.5px] text-white/75">{selected.place}</div>
            </div>
          </div>
          <span className="text-3xl">{selected.emoji}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2">
          <Smile size={14} className="text-white/70" />
          <input
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="写下此刻的想法..."
            className="w-full bg-transparent text-[11.5px] text-white outline-none placeholder:text-white/50"
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[9px] text-white/70">
          <span className="flex items-center gap-1">
            <MapPin size={10} /> {selected.place}
          </span>
          <span>同状态朋友 {selected.friendsCount} 人 ›</span>
        </div>
      </div>

      {/* Presets Grid */}
      <div className="relative z-10 mt-3 flex-1 overflow-y-auto px-4 pb-6">
        <div className="mb-2 text-[9.5px] font-medium tracking-wider text-white/65">心情与日常状态</div>
        <div className="grid grid-cols-3 gap-2">
          {STATUS_PRESETS.map((item) => {
            const active = selected.id === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition",
                  active
                    ? "border-white bg-white/25 shadow-lg"
                    : "border-white/10 bg-white/10 hover:bg-white/15",
                )}
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="text-[11px] font-medium">{item.label}</span>
                <span className="text-[8px] text-white/60">{item.friendsCount} 人同款</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-[9.5px] text-white/70">好友也在用状态</div>
          <div className="mt-2 flex items-center gap-3">
            {contacts.slice(0, 4).map((c, i) => (
              <div key={c.id} className="flex flex-col items-center gap-1">
                <div className="relative">
                  <Avatar src={c.avatar} name={c.name} className="h-9 w-9 rounded-full" />
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-black/70 px-1 text-[9px]">
                    {STATUS_PRESETS[i % STATUS_PRESETS.length].emoji}
                  </span>
                </div>
                <span className="text-[8.5px] text-white/75">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TransferScreen({ onNavigate, onNotify }: BaseProps) {
  const store = useWeChatStore();
  const [amount, setAmount] = useState("88.00");
  const [note, setNote] = useState("周末看展门票与咖啡 🌿");
  const targetChat = store.chats.find((c) => c.id === store.activeChatId) || store.chats[0];

  const tapKey = (k: string) => {
    if (k === "back") {
      setAmount((a) => (a.length <= 1 ? "0" : a.slice(0, -1)));
      return;
    }
    setAmount((a) => {
      if (a === "0") return k === "." ? "0." : k;
      if (k === "." && a.includes(".")) return a;
      if (a.length >= 8) return a;
      return a + k;
    });
  };

  const confirmTransfer = () => {
    const finalAmount = Number(amount) > 0 ? Number(amount).toFixed(2) : "88.00";
    store.sendMessage(
      targetChat.id,
      {
        id: `tr-${Date.now()}`,
        side: "me",
        kind: "transfer",
        amount: finalAmount,
        title: note || `转账给 ${targetChat.name}`,
        time: "刚刚",
      },
      "移动端",
    );
    onNotify(`已向 ${targetChat.name} 转账 ¥${finalAmount} · 桌面端聊天已同步`);
    onNavigate("chat");
  };

  return (
    <div className="flex h-full flex-col bg-[#F5F5F5]">
      <MobileTop title="转账" onBack={() => onNavigate("chat")} right={<MoreHorizontal size={19} />} />

      {/* Recipient Header */}
      <div className="flex flex-col items-center py-4">
        <Avatar src={targetChat.avatar || px(14664508, 160, 160)} name={targetChat.name} className="h-12 w-12 rounded-lg shadow-xs" />
        <div className="mt-2 text-[13px] font-medium text-[#222]">转账给 {targetChat.name} (**满)</div>
        <div className="mt-0.5 text-[9px] text-[#999]">微信号：wxid_{targetChat.id}_2026</div>
      </div>

      {/* White Amount Card */}
      <div className="mx-3 flex-1 rounded-t-2xl bg-white p-5 shadow-xs">
        <div className="text-[11px] text-[#555]">转账金额</div>
        <div className="mt-2 flex items-baseline border-b border-[#EDEDED] pb-3">
          <span className="mr-1.5 text-[24px] font-semibold text-[#1A1A1A]">¥</span>
          <span className="text-[36px] font-semibold tracking-tight text-[#1A1A1A]">{amount || "0"}</span>
          <span className="ml-1 h-7 w-[2px] animate-pulse bg-[#07C160]" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加转账说明（50字以内）"
            className="flex-1 bg-transparent text-[11px] text-[#333] outline-none placeholder:text-[#AAA]"
          />
          <span className="text-[9.5px] text-[#576B95]">常用语</span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {["52.00", "66.66", "88.00", "120.00"].map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className="rounded-full bg-[#F5F5F5] px-2.5 py-1 text-[9.5px] text-[#555] hover:bg-[#EAF8EF] hover:text-[#07A858]"
            >
              ¥{preset}
            </button>
          ))}
        </div>
      </div>

      {/* Authentic WeChat Numeric Keypad */}
      <div className="shrink-0 bg-[#F7F7F7] p-1.5 pb-6">
        <div className="grid grid-cols-4 gap-1.5">
          <div className="col-span-3 grid grid-cols-3 gap-1.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "."].map((key) => (
              <button
                key={key}
                onClick={() => tapKey(key)}
                className={cn(
                  "flex h-11 items-center justify-center rounded-md bg-white text-[17px] font-medium text-[#222] shadow-2xs active:bg-[#E5E5E5]",
                  key === "0" && "col-span-2",
                )}
              >
                {key}
              </button>
            ))}
          </div>
          <div className=" flex flex-col gap-1.5">
            <button
              onClick={() => tapKey("back")}
              className="flex h-11 items-center justify-center rounded-md bg-white text-[#333] shadow-2xs active:bg-[#E5E5E5]"
            >
              <Delete size={18} />
            </button>
            <button
              onClick={confirmTransfer}
              className="flex flex-1 items-center justify-center rounded-md bg-[#07C160] text-[14px] font-medium text-white shadow-sm active:bg-[#06AD56]"
            >
              转账
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PostMomentScreen({ onNavigate, onNotify }: BaseProps) {
  const store = useWeChatStore();
  const [text, setText] = useState("把今日份的春天和咖啡留在相册里 🌿");
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([assets.gallery, assets.coffee, assets.tulips]);
  const [location, setLocation] = useState("杭州 · 天目里美术馆");
  const candidatePhotos = [assets.gallery, assets.coffee, assets.tulips, assets.dawn, assets.cat, assets.desk];

  const togglePhoto = (src: string) => {
    setSelectedPhotos((prev) => (prev.includes(src) ? prev.filter((p) => p !== src) : [...prev, src]));
  };

  const publish = () => {
    store.publishMoment({
      text,
      images: selectedPhotos,
      location,
    });
    onNotify("朋友圈发表成功 · 已同步至桌面端朋友圈");
    onNavigate("moments");
  };

  return (
    <div className="flex h-full flex-col bg-white pt-[30px]">
      <div className="flex h-[44px] shrink-0 items-center justify-between border-b border-[#F2F2F2] px-3">
        <button onClick={() => onNavigate("moments")} className="text-[12.5px] text-[#333]">
          取消
        </button>
        <span className="text-[13.5px] font-medium text-[#1F1F1F]">发表朋友圈</span>
        <button
          onClick={publish}
          className="rounded-md bg-[#07C160] px-3 py-1 text-[11.5px] font-medium text-white active:bg-[#06AD56]"
        >
          发表
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="这一刻的想法..."
          className="w-full resize-none text-[13px] leading-5 text-[#222] outline-none placeholder:text-[#B2B2B2]"
        />

        {/* Selected 3x3 Grid */}
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {selectedPhotos.map((img) => (
            <div key={img} className="group relative aspect-square overflow-hidden rounded-[4px]">
              <img src={img} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => togglePhoto(img)}
                className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          {selectedPhotos.length < 6 && (
            <button
              onClick={() => {
                const next = candidatePhotos.find((p) => !selectedPhotos.includes(p));
                if (next) togglePhoto(next);
              }}
              className="grid aspect-square place-items-center rounded-[4px] bg-[#F7F7F7] text-[#B0B0B0]"
            >
              <Plus size={24} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-[9.5px] text-[#999]">
          <span>已选 {selectedPhotos.length} 张照片 · 点击照片可移除</span>
          <button
            onClick={() => setSelectedPhotos([assets.dawn, assets.tulips])}
            className="text-[#576B95]"
          >
            换一组配图
          </button>
        </div>

        {/* Options List */}
        <div className="mt-5 divide-y divide-[#F2F2F2] border-y border-[#F2F2F2]">
          <button
            onClick={() => setLocation((l) => (l.includes("天目里") ? "大理 · 洱海生态廊道" : "杭州 · 天目里美术馆"))}
            className="flex w-full items-center gap-3 py-3 text-left"
          >
            <MapPin size={16} className="text-[#07C160]" />
            <span className="flex-1 text-[12.5px] text-[#222]">所在位置</span>
            <span className="text-[11px] text-[#07A858]">{location}</span>
            <ChevronRight size={14} className="text-[#CCC]" />
          </button>
          <button
            onClick={() => onNotify("已提醒林小满、Anna Chen 查看")}
            className="flex w-full items-center gap-3 py-3 text-left"
          >
            <AtSign size={16} className="text-[#666]" />
            <span className="flex-1 text-[12.5px] text-[#222]">提醒谁看</span>
            <span className="text-[11px] text-[#999]">林小满</span>
            <ChevronRight size={14} className="text-[#CCC]" />
          </button>
          <button
            onClick={() => onNotify("可见范围：公开（所有朋友可见）")}
            className="flex w-full items-center gap-3 py-3 text-left"
          >
            <Users size={16} className="text-[#666]" />
            <span className="flex-1 text-[12.5px] text-[#222]">谁可以看</span>
            <span className="text-[11px] text-[#999]">公开</span>
            <ChevronRight size={14} className="text-[#CCC]" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#F7FBF8] px-3 py-2 text-[9.5px] text-[#07A858]">
          <Sparkles size={12} /> 发表后将实时同步至左侧桌面端朋友圈列表
        </div>
      </div>
    </div>
  );
}

export function FloatingScreen({ onNavigate, onNotify }: BaseProps) {
  const [playing, setPlaying] = useState(true);
  const [likedSong, setLikedSong] = useState(true);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[#1D2822] via-[#18201C] to-[#111613] pt-[30px] text-white">
      <div className="flex h-[44px] shrink-0 items-center justify-between px-3">
        <PhoneBack onClick={() => onNavigate("chats")} dark />
        <span className="text-[13px] font-medium text-white/90">音乐与浮窗</span>
        <button onClick={() => onNotify("浮窗已最小化至屏幕边缘")} className="text-white/70">
          <MoreHorizontal size={19} />
        </button>
      </div>

      {/* Vinyl Music Card */}
      <div className="mx-3.5 mt-1 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
        <div className="flex items-center justify-between text-[9px] text-white/60">
          <span className="flex items-center gap-1">
            <Headphones size={11} className="text-[#07C160]" /> 微信音乐 · 朋友也在听
          </span>
          <span>SQ 无损音质</span>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className={cn("relative h-20 w-20 shrink-0 rounded-full bg-[#111] p-2 shadow-xl ring-2 ring-white/15", playing && "animate-spin [animation-duration:9s]")}>
            <img src={assets.dawn} alt="" className="h-full w-full rounded-full object-cover" />
            <span className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1D2822]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-medium">风经过的地方</div>
            <div className="mt-0.5 text-[10px] text-white/65">房东的猫 · 春日回声 OST</div>
            <div className="mt-2 rounded-md bg-black/25 px-2.5 py-1.5 text-[10px] italic text-[#9CE3B8]">
              “风从很远的地方来，吹皱一湖春水”
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-[8.5px] text-white/50">
          <span>01:42</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-[44%] rounded-full bg-[#07C160]" />
          </div>
          <span>04:12</span>
        </div>

        <div className="mt-3 flex items-center justify-between px-2">
          <button
            onClick={() => setLikedSong((v) => !v)}
            className={cn("text-white/75", likedSong && "text-[#FA5151]")}
          >
            <Heart size={17} fill={likedSong ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => setPlaying((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#07C160] text-white shadow-lg"
          >
            {playing ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
          </button>
          <button
            onClick={() => onNotify("已将歌曲设为我的微信状态")}
            className="rounded-full border border-white/20 px-2.5 py-1 text-[9px] text-white/85"
          >
            设为状态
          </button>
        </div>
      </div>

      {/* Floating Multitask Items */}
      <div className="mt-3 flex-1 overflow-y-auto px-3.5 pb-6">
        <div className="mb-2 flex items-center justify-between text-[9.5px] text-white/60">
          <span>我的浮窗 (3)</span>
          <button onClick={() => onNotify("已清理全部浮窗")} className="text-white/45">
            清空
          </button>
        </div>
        <div className="space-y-2">
          {[
            {
              title: "在风经过的地方，重新理解日常",
              sub: "公众号文章 · 阅读至 68%",
              icon: <FileText size={14} className="text-[#07C160]" />,
              action: () => onNavigate("reading"),
            },
            {
              title: "微信设计规范 v2.4.pdf",
              sub: "文件传输助手 · 第 14 页",
              icon: <Disc3 size={14} className="text-[#F5A623]" />,
              action: () => onNavigate("favorites"),
            },
            {
              title: "天目里美术馆 · 电子门票",
              sub: "小程序浮窗 · 周六 15:00",
              icon: <Compass size={14} className="text-[#5D9CE0]" />,
              action: () => onNavigate("cards"),
            },
          ].map((item) => (
            <button
              key={item.title}
              onClick={item.action}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-left transition hover:bg-white/10"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10">{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-medium">{item.title}</span>
                <span className="mt-0.5 block text-[9px] text-white/55">{item.sub}</span>
              </span>
              <ChevronRight size={14} className="text-white/40" />
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-2 text-[9.5px] text-white/60">最近使用的小程序</div>
          <div className="grid grid-cols-4 gap-2">
            {miniApps.slice(0, 4).map((app) => (
              <button
                key={app.id}
                onClick={() => onNavigate("mini")}
                className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.05] py-2.5"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-base">{app.emoji}</span>
                <span className="text-[8.5px] text-white/75">{app.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const qrStyles = [
  { id: "emerald", name: "翡翠绿", fg: "#07994E", bg: "from-[#E8F6EE] to-[#F7FBF8]" },
  { id: "classic", name: "经典墨", fg: "#1C241E", bg: "from-[#F2F2EE] to-[#FFFFFF]" },
  { id: "amber", name: "暖阳金", fg: "#9C6521", bg: "from-[#FDF5E8] to-[#FFFDF9]" },
];

export function QRCodeScreen({ onNavigate, onNotify }: BaseProps) {
  const [styleIdx, setStyleIdx] = useState(0);
  const current = qrStyles[styleIdx];

  return (
    <div className="flex h-full flex-col bg-[#EDEDED]">
      <MobileTop title="二维码名片" onBack={() => onNavigate("me")} right={<MoreHorizontal size={19} />} />

      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-6">
        <div className={cn("w-full rounded-2xl bg-gradient-to-b p-5 shadow-[0_12px_36px_rgba(0,0,0,.07)] ring-1 ring-black/[0.04]", current.bg)}>
          <div className="flex items-center gap-3">
            <Avatar src={me.avatar} name={me.name} className="h-12 w-12 rounded-lg shadow-xs" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-medium text-[#1D1D1D]">{me.name}</span>
                <span className="rounded bg-[#07C160]/15 px-1.5 py-0.5 text-[8px] text-[#07994E]">{ current.name }</span>
              </div>
              <div className="mt-0.5 text-[9.5px] text-[#888]">{me.region}</div>
            </div>
          </div>

          {/* Stylized Matrix QR */}
          <div className="relative mx-auto my-5 aspect-square w-[184px] rounded-xl bg-white p-3 shadow-inner ring-1 ring-black/[0.05]">
            <div className="grid h-full w-full grid-cols-[repeat(19,minmax(0,1fr))] gap-[1px]">
              {Array.from({ length: 361 }).map((_, i) => {
                const r = Math.floor(i / 19);
                const c = i % 19;
                const inCorner = (r < 5 && c < 5) || (r < 5 && c > 13) || (r > 13 && c < 5);
                const inCenter = r >= 7 && r <= 11 && c >= 7 && c <= 11;
                const filled = inCorner || (!inCenter && ((r * 13 + c * 7 + styleIdx * 5) % 3 === 0));
                return (
                  <span
                    key={i}
                    className="rounded-[1px]"
                    style={{ background: filled ? current.fg : "transparent" }}
                  />
                );
              })}
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-1 shadow">
              <Avatar src={me.avatar} name={me.name} className="h-8 w-8 rounded-md" />
            </div>
          </div>

          <div className="text-center text-[9.5px] text-[#888]">扫一扫上面的二维码图案，加我为朋友</div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-5 flex items-center gap-5 text-[10.5px] text-[#576B95]">
          <button
            onClick={() => setStyleIdx((i) => (i + 1) % qrStyles.length)}
            className="flex items-center gap-1 hover:underline"
          >
            <RefreshCw size={12} /> 换个样式
          </button>
          <span className="h-3 w-px bg-[#D5D5D5]" />
          <button
            onClick={() => onNotify("二维码名片已保存到系统相册")}
            className="flex items-center gap-1 hover:underline"
          >
            <Download size={12} /> 保存图片
          </button>
          <span className="h-3 w-px bg-[#D5D5D5]" />
          <button
            onClick={() => onNavigate("scan")}
            className="flex items-center gap-1 hover:underline"
          >
            扫一扫
          </button>
        </div>
      </div>
    </div>
  );
}
