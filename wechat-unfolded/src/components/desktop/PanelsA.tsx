import { useMemo, useState } from "react";
import {
  ChevronRight,
  Download,
  File,
  FileText,
  Folder,
  Image as ImageIcon,
  Link2,
  Mic,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Users,
  Video,
} from "lucide-react";
import { assets, contacts, favorites, files, me, type Person } from "../../data";
import { Avatar, SectionLabel, WeChatLogo } from "../shared";
import { cn } from "../../utils/cn";

function PageHeader({
  title,
  right,
  search,
  searchPlaceholder = "搜索",
}: {
  title: string;
  right?: React.ReactNode;
  search?: string;
  searchPlaceholder?: string;
}) {
  return (
    <div className="shrink-0 border-b border-[#E9E9E9] bg-[#F7F7F7] px-4 pb-2.5 pt-3">
      <div className="flex h-7 items-center justify-between">
        <h2 className="text-[15px] font-medium tracking-[0.02em] text-[#1F1F1F]">{title}</h2>
        <div className="flex items-center gap-1 text-[#555]">{right}</div>
      </div>
      {search !== undefined && (
        <div className="mt-2 flex h-7 items-center gap-1.5 rounded-md bg-[#E9E9E9]/80 px-2 text-[#A2A2A2]">
          <Search size={13} />
          <input
            value={search}
            onChange={() => undefined}
            readOnly
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-[11px] text-[#333] outline-none placeholder:text-[#A2A2A2]"
          />
        </div>
      )}
    </div>
  );
}

function IconCircle({ bg, children }: { bg: string; children: React.ReactNode }) {
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white" style={{ background: bg }}>{children}</span>;
}

function HeroAction({ icon: Icon, label, onClick }: { icon: typeof Users; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 text-[#666] transition hover:text-[#07C160]">
      <span className="grid h-9 w-9 place-items-center rounded-full border border-[#E9E9E9] bg-white shadow-sm">
        <Icon size={16} strokeWidth={1.7} />
      </span>
      <span className="text-[10px]">{label}</span>
    </button>
  );
}

export function ContactsPage({ notify, onOpenChat }: { notify: (s: string) => void; onOpenChat: (id: string) => void }) {
  const [selectedId, setSelectedId] = useState<Person>(contacts[1]);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    if (!query) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.note?.includes(query));
  }, [query]);

  const sections = useMemo(() => {
    const groups: Record<string, Person[]> = {};
    filtered.forEach((c) => {
      const key = c.initial;
      groups[key] = [...(groups[key] || []), c];
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const letterIndex = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[258px] shrink-0 flex-col border-r border-[#E8E8E8] bg-[#F7F7F7]">
        <div className="shrink-0 border-b border-[#E9E9E9] px-4 pb-2.5 pt-3">
          <div className="flex h-7 items-center justify-between">
            <h2 className="text-[15px] font-medium text-[#1F1F1F]">通讯录</h2>
            <div className="flex items-center gap-2 text-[#555]">
              <button onClick={() => notify("添加朋友：微信号、手机号或扫码")}><Plus size={16} /></button>
              <button onClick={() => notify("通讯录管理")}><MoreHorizontal size={16} /></button>
            </div>
          </div>
          <div className="mt-2 flex h-7 items-center gap-1.5 rounded-md bg-[#E9E9E9]/80 px-2">
            <Search size={13} className="text-[#A2A2A2]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索联系人"
              className="w-full bg-transparent text-[11px] outline-none placeholder:text-[#A6A6A6]"
            />
          </div>
        </div>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-4">
          {[
            { label: "新的朋友", bg: "#F5B640", icon: <Users size={15} /> },
            { label: "仅聊天的朋友", bg: "#A7D36A", icon: <Users size={15} /> },
            { label: "群聊", bg: "#6DB7FF", icon: <Users size={15} /> },
            { label: "标签", bg: "#6DB7FF", icon: <Star size={15} /> },
            { label: "公众号", bg: "#7B8CFF", icon: <FileText size={15} /> },
            { label: "企业微信联系人", bg: "#5CA8FF", icon: <WeChatLogo mono className="h-4 w-4 text-white" /> },
          ].map((row) => (
            <button
              key={row.label}
              onClick={() => notify(`${row.label} · 页面已加载`)}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition hover:bg-[#ECECEC]"
            >
              <IconCircle bg={row.bg}>{row.icon}</IconCircle>
              <span className="text-[12px] text-[#303030]">{row.label}</span>
              <ChevronRight size={12} className="ml-auto text-[#C0C0C0]" />
            </button>
          ))}
          <div className="mx-4 my-1.5 border-t border-[#E7E7E7]" />
          {sections.length === 0 && <div className="px-4 py-8 text-center text-[11px] text-[#A2A2A2]">没有找到联系人</div>}
          {sections.map(([letter, people]) => (
            <div key={letter}>
              <div className="px-4 py-1 text-[9px] font-medium tracking-wider text-[#A2A2A2]">{letter}</div>
              {people.map((person) => (
                <button
                  key={person.id}
                  onClick={() => setSelectedId(person)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-4 py-2 text-left transition",
                    person.id === selectedId.id ? "bg-[#E4E4E4]" : "hover:bg-[#EDEDED]",
                  )}
                >
                  <Avatar src={person.avatar} name={person.name} className="h-7 w-7 rounded-[4px]" online={person.online} />
                  <span className="truncate text-[12px] text-[#2A2A2A]">{person.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="hidden h-7 shrink-0 items-center justify-center gap-1 border-t border-[#E9E9E9] text-[#B7B7B7]">
          {letterIndex.slice(0, 12).map((l) => <span key={l} className="text-[8px]">{l}</span>)}
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto bg-[#F7F7F7] px-10 py-8">
        <div className="mx-auto max-w-[570px]">
          <div className="flex items-start gap-7 rounded-xl border border-[#EBEBEB] bg-white p-7 shadow-[0_4px_24px_rgba(0,0,0,.035)]">
            <Avatar src={selectedId.avatar} name={selectedId.name} className="h-[78px] w-[78px] rounded-lg" online={selectedId.online} />
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-[21px] font-medium tracking-[0.01em] text-[#1A1A1A]">{selectedId.name}</h1>
                  <p className="mt-1 text-[10.5px] text-[#A2A2A2]">微信号：wxid_{selectedId.id}26 · {selectedId.region}</p>
                </div>
                <button onClick={() => notify("联系人已设为星标")} className="text-[#B8B8B8] hover:text-[#F5B640]"><Star size={17} /></button>
              </div>
              <p className="mt-3 text-[11.5px] text-[#777]">{selectedId.note}</p>
              <div className="mt-5 flex items-center gap-7">
                <HeroAction icon={ImageIcon} label="发消息" onClick={() => onOpenChat(selectedId.id)} />
                <HeroAction icon={Video} label="音视频通话" onClick={() => notify(`正在呼叫 ${selectedId.name}`)} />
                <HeroAction icon={MoreHorizontal} label="更多" onClick={() => notify("更多资料")} />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#EBEBEB] bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,.03)]">
            <SectionLabel>朋友圈</SectionLabel>
            <div className="mt-3 flex items-center gap-2">
              {[assets.gallery, assets.dawn, assets.coffee, assets.tulips].map((image, i) => (
                <button key={i} onClick={() => notify("正在查看该联系人的朋友圈")} className="group relative overflow-hidden rounded-md">
                  <img src={image} alt="朋友圈照片" className="h-[72px] w-[72px] object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                  <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                </button>
              ))}
              <button onClick={() => notify("已展开全部朋友圈")} className="grid h-[72px] w-[36px] place-items-center text-[#B6B6B6]"><ChevronRight size={14} /></button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-[#F0F0F0] pt-5">
              {[
                ["个性签名", selectedId.note || "这个人很懒，什么都没留下"],
                ["标签", "朋友 · 设计"],
                ["来源", "通过群聊「周末去哪儿」添加"],
                ["描述", "仅聊天"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[9.5px] text-[#A6A6A6]">{k}</div>
                  <div className="mt-1 text-[11px] text-[#444]">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-[#EBEBEB] bg-white px-5 py-3 text-[11px] text-[#555]">
            <div className="flex items-center gap-2"><ImageIcon size={14} className="text-[#07C160]" /> 共同群聊 · 4</div>
            <button onClick={() => notify("共同群聊：春日设计小组、周末去哪儿...")} className="flex items-center text-[#576B95]">查看 <ChevronRight size={12} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}

const favTypeStyles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  链接: { bg: "#EDF7F0", text: "#07A55B", icon: <Link2 size={13} /> },
  图片: { bg: "#EEF5FF", text: "#4C7CCB", icon: <ImageIcon size={13} /> },
  笔记: { bg: "#FFF6E6", text: "#B5842A", icon: <FileText size={13} /> },
  语音: { bg: "#F1F0FF", text: "#6F68C8", icon: <Mic size={13} /> },
  文件: { bg: "#EDF7F0", text: "#07A55B", icon: <Folder size={13} /> },
};

export function FavoritesPage({ notify }: { notify: (s: string) => void }) {
  const [active, setActive] = useState(favorites[0]);
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[258px] shrink-0 flex-col border-r border-[#E8E8E8] bg-[#F7F7F7]">
        <PageHeader title="收藏" right={<><Search size={15} /><Plus size={16} /></>} search="" searchPlaceholder="搜索收藏" />
        <div className="flex gap-1.5 px-4 py-2.5">
          {["全部", "图片", "笔记", "链接"].map((t, i) => (
            <button key={t} onClick={() => notify(`已筛选：${t}`)} className={cn("rounded px-2 py-1 text-[10px]", i === 0 ? "bg-[#07C160] text-white" : "bg-[#EBEBEB] text-[#777]")}>{t}</button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {favorites.map((item) => {
            const type = favTypeStyles[item.type] || favTypeStyles["链接"];
            return (
              <button
                key={item.id}
                onClick={() => setActive(item)}
                className={cn("flex w-full gap-3 border-b border-[#EFEFEF] px-4 py-3 text-left transition", active.id === item.id ? "bg-[#E6E6E6]" : "hover:bg-[#EDEDED]")}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md" style={{ background: type.bg, color: type.text }}>{type.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[11.5px] leading-4 text-[#2F2F2F]">{item.title}</span>
                  <span className="mt-1.5 flex items-center justify-between text-[9px] text-[#A6A6A6]"><span>{item.source}</span><span>{item.date}</span></span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-[#E9E9E9] p-3 text-center text-[9px] text-[#A6A6A6]">共 {favorites.length} 条收藏 · 已全部同步</div>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto bg-[#F7F7F7] px-10 py-7">
        <div className="mx-auto max-w-[620px]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-[9px] font-medium tracking-[0.16em] text-[#AAA]">FAVORITES / {active.type.toUpperCase()}</div>
              <h2 className="mt-1 text-[16px] font-medium text-[#222]">{active.source}</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={() => notify("已复制收藏内容")} className="rounded-md border border-[#E3E3E3] bg-white px-2.5 py-1.5 text-[10px] text-[#666]">复制</button>
              <button onClick={() => notify("已分享至聊天")} className="rounded-md bg-[#07C160] px-2.5 py-1.5 text-[10px] text-white">分享</button>
            </div>
          </div>
          <article className="overflow-hidden rounded-xl border border-[#EBEBEB] bg-white shadow-[0_8px_40px_rgba(0,0,0,.04)]">
            {active.image && <img src={active.image} alt={active.title} className="max-h-[255px] w-full object-cover" loading="lazy" />}
            <div className="p-7">
              <div className="flex items-center gap-2 text-[10px] text-[#A6A6A6]"><span className="rounded bg-[#F3F3F3] px-2 py-0.5">{active.type}</span><span>{active.date}</span></div>
              <h1 className="mt-4 text-[22px] font-medium leading-8 tracking-[-0.01em] text-[#1E1E1E]">{active.title}</h1>
              {active.type === "笔记" ? (
                <div className="mt-5 space-y-3 text-[12px] leading-6 text-[#555]">
                  <p>微信的界面并不需要被装饰。它更像一张干净的纸，让内容、关系与情绪自然地落在上面。</p>
                  <p>克制的灰阶、单一的绿色强调、恰到好处的圆角，构成了它在视觉上始终保持的温度。</p>
                  <p className="border-l-2 border-[#07C160] pl-3 text-[#777]">好的设计，是让人感觉不到设计。</p>
                </div>
              ) : (
                <p className="mt-4 text-[12px] leading-6 text-[#777]">在内容与留白之间，找到让人愿意停留的节奏。这里有我们在春日设计小组里反复讨论的细节：层级、触感，以及一次恰到好处的出现。</p>
              )}
              <div className="mt-6 flex items-center gap-3 border-t border-[#F1F1F1] pt-4">
                <Avatar src={me.avatar} name={me.name} className="h-7 w-7 rounded-[4px]" />
                <div className="text-[10px] text-[#888]">收藏于我的微信 <span className="mx-1 text-[#D0D0D0]">·</span> {active.date}</div>
                <button onClick={() => notify("收藏已标记")} className="ml-auto text-[#B9B9B9] hover:text-[#F5B640]"><Star size={16} /></button>
              </div>
            </div>
          </article>
          <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-[#AAA]">
            <button onClick={() => notify("已切换到上一条收藏")} className="hover:text-[#666]">上一条</button>
            <span className="h-3 w-px bg-[#DDD]" />
            <button onClick={() => notify("已切换到下一条收藏")} className="hover:text-[#666]">下一条</button>
          </div>
        </div>
      </section>
    </div>
  );
}

const fileAccent: Record<string, string> = { pdf: "#F07A7A", fig: "#9B7BE9", ppt: "#F09A50", img: "#4F9DE0", zip: "#B7A27A", txt: "#7D8B99" };

export function FilesPage({ notify }: { notify: (s: string) => void }) {
  const [selected, setSelected] = useState(files[0]);
  const [tab, setTab] = useState("全部文件");
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[258px] shrink-0 flex-col border-r border-[#E8E8E8] bg-[#F7F7F7]">
        <PageHeader title="文件" right={<><Search size={15} /><MoreHorizontal size={16} /></>} search="" searchPlaceholder="搜索文件" />
        <div className="space-y-0.5 px-2 py-2.5">
          {["全部文件", "最近使用", "图片", "文档"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px]", tab === t ? "bg-[#E4E4E4] text-[#1F1F1F]" : "text-[#666] hover:bg-[#EDEDED]")}>
              {t === "全部文件" ? <Folder size={14} className="text-[#07C160]" /> : <File size={14} className="text-[#A0A0A0]" />}
              {t}
              {t === "全部文件" && <span className="ml-auto text-[9px] text-[#B0B0B0]">{files.length}</span>}
            </button>
          ))}
        </div>
        <div className="mx-4 border-t border-[#E9E9E9]" />
        <div className="flex items-center gap-2.5 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[#07C160]"><Folder size={15} className="text-white" /></span>
          <div><div className="text-[11px] text-[#333]">文件传输助手</div><div className="mt-0.5 text-[9px] text-[#A6A6A6]">手机与电脑互传</div></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#EDEDED]">
          <div className="px-4 py-2 text-[9px] font-medium tracking-wider text-[#A6A6A6]">最近文件</div>
          {files.map((f) => (
            <button key={f.id} onClick={() => setSelected(f)} className={cn("flex w-full items-center gap-2.5 px-4 py-2.5 text-left", selected.id === f.id ? "bg-[#E6E6E6]" : "hover:bg-[#EDEDED]")}>
              <span className="grid h-7 w-7 place-items-center rounded text-[8px] font-bold uppercase text-white" style={{ background: fileAccent[f.icon] }}>{f.icon}</span>
              <span className="min-w-0"><span className="block truncate text-[10.5px] text-[#333]">{f.name}</span><span className="mt-0.5 block text-[8.5px] text-[#A6A6A6]">{f.meta}</span></span>
            </button>
          ))}
        </div>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto bg-[#F7F7F7]">
        <div className="sticky top-0 z-10 flex h-[54px] items-center justify-between border-b border-[#EAEAEA] bg-[#F7F7F7]/95 px-7 backdrop-blur">
          <div><h2 className="text-[14px] font-medium text-[#222]">{tab}</h2><p className="text-[9.5px] text-[#A6A6A6]">共 {files.length} 个文件 · 1.29 GB</p></div>
          <button onClick={() => notify("已打开文件选择器")} className="flex items-center gap-1.5 rounded-md bg-[#07C160] px-3 py-1.5 text-[10px] text-white transition hover:bg-[#06AD56]"><Plus size={12} /> 上传文件</button>
        </div>
        <div className="p-7">
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-5">
            <div className="flex items-center justify-between">
              <div><div className="text-[10px] text-[#999]">存储空间</div><div className="mt-1 text-[22px] font-medium tracking-tight text-[#222]">1.29 <span className="text-[11px] font-normal text-[#999]">GB / 10 GB</span></div></div>
              <button onClick={() => notify("正在扫描可清理的文件")} className="text-[10px] text-[#576B95]">管理存储</button>
            </div>
            <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-[#F0F0F0]">
              <span className="w-[38%] bg-[#07C160]" /><span className="w-[24%] bg-[#7ECB9D]" /><span className="w-[14%] bg-[#F5C26B]" />
            </div>
            <div className="mt-3 flex gap-4 text-[9px] text-[#999]"><span>● 聊天文件 490 MB</span><span>● 图片 310 MB</span><span>● 其他 180 MB</span></div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-[12px] font-medium text-[#333]">最近文件</h3>
            <div className="flex gap-3 text-[10px] text-[#A6A6A6]"><button onClick={() => notify("按时间排序")}>时间</button><button onClick={() => notify("按大小排序")}>大小</button></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {files.map((file) => (
              <button key={file.id} onClick={() => setSelected(file)} className={cn("flex items-center gap-3 rounded-lg border bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md", selected.id === file.id ? "border-[#07C160]/50 ring-2 ring-[#07C160]/10" : "border-[#ECECEC]")}>
                <span className="grid h-11 w-9 shrink-0 place-items-center rounded-[4px] text-[9px] font-bold uppercase text-white" style={{ background: fileAccent[file.icon] }}>{file.icon}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[11.5px] font-medium text-[#333]">{file.name}</span><span className="mt-1 block text-[9px] text-[#A6A6A6]">{file.meta}</span></span>
                <span onClick={(e) => { e.stopPropagation(); notify(`正在下载 ${file.name}`); }} className="grid h-6 w-6 place-items-center rounded text-[#A6A6A6] hover:bg-[#F4F4F4] hover:text-[#07C160]"><Download size={13} /></span>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-[#DADADA] bg-[#FBFBFB] p-7 text-center">
            <div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-[#F0F0F0] text-[#999]"><Plus size={17} /></div>
            <div className="mt-2 text-[11px] text-[#777]">拖拽文件到这里，快速发送到「文件传输助手」</div>
            <div className="mt-1 text-[9px] text-[#B2B2B2]">支持图片、视频、文档等格式 · 单文件最大 1 GB</div>
          </div>
        </div>
      </section>
    </div>
  );
}
