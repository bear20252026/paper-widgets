import { useState } from "react";
import {
  BookOpen,
  Compass,
  Flame,
  Heart,
  Laptop,
  Lock,
  Search,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Unlock,
} from "lucide-react";
import { assets, me, miniApps, px } from "../../data";
import { useWeChatStore } from "../../store";
import { Avatar } from "../shared";
import { cn } from "../../utils/cn";

export function SearchHubPage({
  notify,
  onOpenArticle,
}: {
  notify: (s: string) => void;
  onOpenArticle: () => void;
}) {
  const [query, setQuery] = useState("春日回声 展览指南");
  const [category, setCategory] = useState("全部");
  const hotList = [
    { rank: "01", title: "「春日回声」天目里美术馆特展今日开幕", heat: "98.4w", tag: "热" },
    { rank: "02", title: "微信 2026 双端设计语言解析：克制与留白", heat: "76.1w", tag: "新" },
    { rank: "03", title: "杭州周末漫步地图：去有风的湖边喝咖啡", heat: "54.2w", tag: "荐" },
    { rank: "04", title: "如何用自然光拍出通透感静物照片", heat: "41.8w", tag: "" },
    { rank: "05", title: "微信状态 8.0 新增呼吸感渐变背景", heat: "35.0w", tag: "" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#F7F7F7]">
      <div className="border-b border-[#EAEAEA] bg-white px-8 pb-4 pt-6">
        <div className="mx-auto max-w-[680px]">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#07C160] text-white">
              <Search size={15} />
            </span>
            <h2 className="text-[17px] font-medium text-[#1F1F1F]">微信搜一搜</h2>
            <span className="rounded-full bg-[#EDF8F1] px-2 py-0.5 text-[9.5px] text-[#07A858]">聚合全生态内容</span>
          </div>

          <div className="mt-4 flex h-10 items-center gap-2 rounded-lg border border-[#07C160]/50 bg-[#FBFBFB] px-3.5 shadow-[0_2px_12px_rgba(7,193,96,.08)]">
            <Search size={15} className="text-[#07C160]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索公众号、文章、朋友圈、小程序、视频号..."
              className="flex-1 bg-transparent text-[12.5px] text-[#222] outline-none"
            />
            <button
              onClick={() => notify(`正在检索「${query}」`)}
              className="rounded-md bg-[#07C160] px-3 py-1 text-[10.5px] font-medium text-white hover:bg-[#06AD56]"
            >
              搜一搜
            </button>
          </div>

          <div className="mt-3 flex items-center gap-5 text-[11px]">
            {["全部", "公众号", "文章", "视频号", "小程序", "朋友圈", "表情"].map((tab) => (
              <button
                key={tab}
                onClick={() => setCategory(tab)}
                className={cn(
                  "relative pb-1 transition",
                  category === tab ? "font-medium text-[#07C160]" : "text-[#777] hover:text-[#222]",
                )}
              >
                {tab}
                {category === tab && <span className="absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full bg-[#07C160]" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[740px] gap-4 px-8 py-6 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-3.5">
          {/* AI Digest Card */}
          <div className="rounded-xl border border-[#DCEFE3] bg-gradient-to-br from-[#F4FBF6] to-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#07A858]">
                <Sparkles size={12} /> 搜一搜 · 智能摘要
              </span>
              <span className="text-[9px] text-[#999]">基于公众号与官方小程序整理</span>
            </div>
            <h3 className="mt-2 text-[13.5px] font-medium text-[#1E2A22]">「{query || "春日回声"}」看展与出行速览</h3>
            <p className="mt-1.5 text-[11px] leading-5 text-[#555]">
              展览位于杭州天目里美术馆 1–3 号厅，展期至 2026 年 8 月底。推荐下午 15:00 入场，自然光穿过玻璃穹顶时观展体验最佳。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={onOpenArticle}
                className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[10px] text-[#2F4536] ring-1 ring-[#DCE8DF] hover:bg-[#EDF7F0]"
              >
                <BookOpen size={11} className="text-[#07C160]" /> 阅读深度展评
              </button>
              <button
                onClick={() => notify("已打开天目里美术馆购票小程序")}
                className="flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[10px] text-[#2F4536] ring-1 ring-[#DCE8DF] hover:bg-[#EDF7F0]"
              >
                🎨 预约电子门票
              </button>
            </div>
          </div>

          {/* Article Result */}
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-4">
            <div className="flex items-center justify-between text-[9.5px] text-[#999]">
              <span>公众号文章 · 3 位朋友读过</span>
              <span>今天 14:10</span>
            </div>
            <div className="mt-2 flex gap-3.5">
              <div className="min-w-0 flex-1">
                <button onClick={onOpenArticle} className="text-left text-[13.5px] font-medium text-[#222] hover:text-[#07C160]">
                  在风经过的地方，重新理解日常与器物
                </button>
                <p className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-[#777]">
                  清晨六点半，天光刚刚漫过山的轮廓。把一整个春天装进白房子，也是与朋友分享此刻的方式。
                </p>
                <div className="mt-2 flex items-center gap-2 text-[9px] text-[#A2A2A2]">
                  <span className="text-[#576B95]">设计手记</span>
                  <span>·</span>
                  <span>阅读 2,318</span>
                  <span>·</span>
                  <span className="text-[#07A858]">林小满、Anna 在看</span>
                </div>
              </div>
              <img src={assets.gallery} alt="" className="h-[68px] w-[92px] shrink-0 rounded-md object-cover" />
            </div>
          </div>

          {/* Mini Program Direct Card */}
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EDF7F0] text-base">📖</span>
                <div>
                  <div className="text-[12px] font-medium text-[#222]">微信读书 · 展览同名书单</div>
                  <div className="text-[9px] text-[#999]">官方小程序 · 99+ 位朋友使用过</div>
                </div>
              </div>
              <button
                onClick={() => notify("已打开微信读书小程序")}
                className="rounded-full bg-[#07C160] px-3 py-1 text-[10px] text-white"
              >
                打开
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Hot Search & Friends */}
        <div className="space-y-3.5">
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#222]">
                <Flame size={13} className="text-[#FA5151]" /> 微信热搜榜
              </span>
              <span className="text-[9px] text-[#AAA]">实时更新</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {hotList.map((item, idx) => (
                <button
                  key={item.rank}
                  onClick={() => setQuery(item.title)}
                  className="flex w-full items-center gap-2 text-left group"
                >
                  <span className={cn("w-4 text-[10px] font-semibold", idx < 3 ? "text-[#FA5151]" : "text-[#B0B0B0]")}>
                    {item.rank}
                  </span>
                  <span className="flex-1 truncate text-[10.5px] text-[#333] group-hover:text-[#07C160]">{item.title}</span>
                  {item.tag && (
                    <span className="rounded bg-[#FFF0EE] px-1 py-0.2 text-[8px] text-[#FA5151]">{item.tag}</span>
                  )}
                  <span className="text-[8.5px] text-[#B8B8B8]">{item.heat}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#EBEBEB] bg-white p-4">
            <div className="text-[11px] font-medium text-[#222]">常用小程序直达</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {miniApps.slice(0, 6).map((app) => (
                <button
                  key={app.id}
                  onClick={() => notify(`已打开「${app.name}」`)}
                  className="flex flex-col items-center gap-1 rounded-lg bg-[#F9F9F9] p-2 hover:bg-[#F0F0F0]"
                >
                  <span className="text-base">{app.emoji}</span>
                  <span className="truncate text-[9px] text-[#555]">{app.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const articleList = [
  {
    id: "a1",
    title: "在风经过的地方，重新理解日常",
    author: "设计手记 · 陈知夏",
    reads: "2,318",
    likes: 142,
    cover: assets.gallery,
    friends: "林小满、Anna Chen 认为好看",
    tag: "生活美学",
  },
  {
    id: "a2",
    title: "为什么好用的界面，总是让人感觉不到设计？",
    author: "WeChat Design Lab",
    reads: "1.4w",
    likes: 826,
    cover: assets.desk,
    friends: "江屿、齐北 读过",
    tag: "界面研究",
  },
  {
    id: "a3",
    title: "洱海边的第一百四十三天：慢下来的胶片日记",
    author: "周予然在路上",
    reads: "6,510",
    likes: 389,
    cover: assets.dawn,
    friends: "葛一鸣 赞过",
    tag: "旅行手记",
  },
];

export function ArticlesPage({ notify }: { notify: (s: string) => void }) {
  const store = useWeChatStore();
  const [selected, setSelected] = useState(articleList[0]);
  const [liked, setLiked] = useState(true);
  const [highlightNote, setHighlightNote] = useState(true);

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[258px] shrink-0 flex-col border-r border-[#E8E8E8] bg-[#F7F7F7]">
        <div className="flex h-[55px] items-center justify-between border-b border-[#E9E9E9] px-4">
          <div className="flex items-center gap-1.5">
            <Compass size={16} className="text-[#F5A623]" />
            <h2 className="text-[15px] font-medium text-[#1F1F1F]">看一看</h2>
          </div>
          <span className="rounded-full bg-[#FFF5E4] px-2 py-0.5 text-[9px] text-[#D79A2F]">朋友在看</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-[#EFEFEF]">
          {articleList.map((art) => (
            <button
              key={art.id}
              onClick={() => setSelected(art)}
              className={cn(
                "flex w-full flex-col gap-1.5 p-3.5 text-left transition",
                selected.id === art.id ? "bg-[#E6E6E6]" : "hover:bg-[#EDEDED]",
              )}
            >
              <div className="flex items-center justify-between text-[9px] text-[#07A858]">
                <span>✦ {art.friends}</span>
                <span className="text-[#AAA]">{art.tag}</span>
              </div>
              <div className="flex gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[11.5px] font-medium leading-4 text-[#242424]">{art.title}</div>
                  <div className="mt-1.5 text-[9px] text-[#999]">{art.author}</div>
                </div>
                <img src={art.cover} alt="" className="h-12 w-14 shrink-0 rounded object-cover" />
              </div>
            </button>
          ))}
        </div>
        <div className="border-t border-[#E9E9E9] p-3 text-center text-[9px] text-[#AAA]">
          划线与「在看」将同步展示在手机端看一看
        </div>
      </aside>

      <section className="scrollbar-thin min-w-0 flex-1 overflow-y-auto bg-[#F7F7F7] px-10 py-7">
        <div className="mx-auto max-w-[620px] overflow-hidden rounded-xl border border-[#EBEBEB] bg-white shadow-[0_8px_34px_rgba(0,0,0,.04)]">
          <div className="relative h-[220px] overflow-hidden">
            <img
              src={selected.cover}
              alt={selected.title}
              onClick={() => store.openLightbox(selected.cover, selected.title, selected.author)}
              className="h-full w-full cursor-zoom-in object-cover transition duration-500 hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-6 right-6 text-white">
              <span className="rounded bg-[#07C160] px-2 py-0.5 text-[9px] font-medium">{selected.tag}</span>
              <h1 className="mt-2 text-[21px] font-medium leading-7">{selected.title}</h1>
            </div>
          </div>

          <div className="p-7">
            <div className="flex items-center justify-between border-b border-[#F2F2F2] pb-4">
              <div className="flex items-center gap-2.5">
                <Avatar src={px(20894157, 100, 100)} name={selected.author} className="h-8 w-8 rounded-full" />
                <div>
                  <div className="text-[11.5px] font-medium text-[#333]">{selected.author}</div>
                  <div className="text-[9px] text-[#AAA]">原创专栏 · 杭州 · 阅读 {selected.reads}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setLiked((v) => !v);
                    notify(liked ? "已取消在看" : "已点亮「在看」· 朋友将在看一看收到推荐");
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] transition",
                    liked ? "border-[#FA5151]/30 bg-[#FFF2F2] text-[#FA5151]" : "border-[#E5E5E5] text-[#666]",
                  )}
                >
                  <Heart size={11} fill={liked ? "currentColor" : "none"} /> 在看 {liked ? selected.likes + 1 : selected.likes}
                </button>
                <button
                  onClick={() => notify("文章已转发至「春日设计小组」")}
                  className="flex items-center gap-1 rounded-full border border-[#E5E5E5] px-2.5 py-1 text-[10px] text-[#666]"
                >
                  <Share2 size={11} /> 转发
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-4 text-[12.5px] leading-[1.95] text-[#3B3B3B]">
              <p>
                清晨六点半，天光刚刚漫过山的轮廓。湖面还没有醒，风从很远的地方来，带来一点水汽，和青草被露水打湿的味道。
              </p>
              <p>
                在数字界面里，我们也常常寻找同样的呼吸感。{" "}
                <span
                  onClick={() => setHighlightNote((v) => !v)}
                  className="cursor-pointer border-b-2 border-[#07C160] bg-[#EDF9F1] px-1 py-0.5 text-[#173A26]"
                >
                  克制的灰阶、单一的绿色强调、恰到好处的留白，是为了让真实的人与对话被看见。
                </span>
              </p>
              {highlightNote && (
                <div className="rounded-lg border border-[#D8EFE0] bg-[#F7FCF9] p-3 text-[10.5px] text-[#4C6856]">
                  <div className="flex items-center justify-between font-medium text-[#07A858]">
                    <span>✦ 128 人划线 · 热门批注</span>
                    <button onClick={() => notify("已加入我的收藏笔记")} className="text-[9.5px] underline">
                      收藏金句
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-[#666]">林小满、苏禾 等 4 位好友也划线了这段话。</p>
                </div>
              )}
              <p>
                朋友说，旅行的意义是抵达。但我觉得，很多时候它只是让我们在陌生的地方，重新看见习以为常的生活——比如一顿慢慢吃完的早餐，比如一整天都不用匆忙回复的自在。
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ScreenLockPage({
  notify,
  onUnlock,
}: {
  notify: (s: string) => void;
  onUnlock: () => void;
}) {
  const [unlocked, setUnlocked] = useState(false);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#232B26] via-[#1C221E] to-[#151A17] p-8 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{ backgroundImage: "radial-gradient(#7BC89A 0.75px, transparent 0.75px)", backgroundSize: "20px 20px" }}
      />
      <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center rounded-2xl border border-white/10 bg-white/[0.05] p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="relative">
          <Avatar src={me.avatar} name={me.name} className="h-20 w-20 rounded-2xl ring-2 ring-white/20" />
          <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-[#07C160] text-white shadow-lg">
            {unlocked ? <Unlock size={14} /> : <Lock size={14} />}
          </span>
        </div>
        <h2 className="mt-4 text-[18px] font-medium">{me.name} 的电脑端微信已锁定</h2>
        <p className="mt-1.5 text-[11px] leading-5 text-white/60">
          为保护你的聊天隐私，离开座位时可随时锁定桌面端。<br />
          可在手机微信点击「解锁」，或直接点击下方按钮恢复会话。
        </p>

        <div className="mt-6 w-full space-y-2 rounded-xl border border-white/10 bg-black/25 p-3.5 text-left">
          <div className="text-[9.5px] font-medium tracking-wider text-white/45 uppercase">当前已登录设备 · 2 台</div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5">
              <Laptop size={16} className="text-[#07C160]" />
              <div>
                <div className="text-[11px] font-medium">MacBook Pro 16" · macOS</div>
                <div className="text-[9px] text-white/45">当前设备 · 端到端加密已开启</div>
              </div>
            </div>
            <span className="rounded-full bg-[#07C160]/20 px-2 py-0.5 text-[9px] text-[#6CE39E]">已锁定</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-2">
            <div className="flex items-center gap-2.5">
              <Smartphone size={16} className="text-[#07C160]" />
              <div>
                <div className="text-[11px] font-medium">iPhone 16 Pro · iOS</div>
                <div className="text-[9px] text-white/45">主设备在线 · 可远程批准解锁</div>
              </div>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-white/75">在线</span>
          </div>
        </div>

        <div className="mt-6 flex w-full gap-2.5">
          <button
            onClick={() => {
              setUnlocked(true);
              notify("已在手机端验证通过，正在返回桌面端聊天");
              window.setTimeout(() => onUnlock(), 350);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#07C160] py-2.5 text-[12px] font-medium text-white shadow-lg transition hover:bg-[#06AD56]"
          >
            <Unlock size={14} /> 立即解锁进入微信
          </button>
          <button
            onClick={() => notify("已向手机端发送解锁提醒")}
            className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-[11px] text-white/80 hover:bg-white/10"
          >
            手机确认
          </button>
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-[9.5px] text-white/45">
          <ShieldCheck size={12} className="text-[#07C160]" /> 微信安全中心 · 实时守护多端登录安全
        </div>
      </div>
    </div>
  );
}
