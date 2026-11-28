import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  BookMarked,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileWarning,
  Filter,
  Flag,
  Link2,
  Lock,
  MessageSquareWarning,
  Plus,
  QrCode,
  Radio,
  Scan,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Video,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { Avatar, Badge, Button, Card, Modal, PageHeader, Pagination, SectionTitle, Select, Switch, Tone, cn, downloadCsv, useToast } from '../components/ui';
import { CHAT_CONTEXT, INTERCEPT_ITEMS, LIVE_WALL, SENS_WORDS, VIDEO_QUEUE } from '../lib/ops';
import type { LiveRoomFull, SensWord, VideoItem } from '../lib/ops';

/* ============================ IM 聊天审计 ============================ */

const CAT_TONE: Record<SensWord['category'], Tone> = { 涉政: 'violet', 涉黄: 'rose', 涉诈: 'orange', 广告: 'amber' };

export const ImAuditPage: React.FC = () => {
  const { push } = useToast();
  const [tab, setTab] = useState<'words' | 'context' | 'files' | 'video'>('words');
  const [words, setWords] = useState<SensWord[]>(SENS_WORDS);
  const [wordKeyword, setWordKeyword] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [masked, setMasked] = useState(true);
  const [videos, setVideos] = useState<VideoItem[]>(VIDEO_QUEUE);
  const [activeVideo, setActiveVideo] = useState(VIDEO_QUEUE[0].id);
  const [appealOpen, setAppealOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const video = videos.find((v) => v.id === activeVideo) ?? videos[0];

  const filteredWords = useMemo(
    () => words.filter((w) => (catFilter === 'all' || w.category === catFilter) && (!wordKeyword.trim() || w.word.toLowerCase().includes(wordKeyword.trim().toLowerCase()))),
    [words, catFilter, wordKeyword]
  );
  const pagedWords = filteredWords.slice((page - 1) * pageSize, page * pageSize);

  const toggleWord = (id: string) => {
    setWords((prev) => prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
  };

  const maskContent = (content: string) =>
    masked ? content.replace(/wx_[a-z0-9_]+/gi, 'wx_****').replace(/\d{3,}/g, (m) => `${m.slice(0, 2)}****`) : content;

  const reviewVideo = (id: string, result: 'pass' | 'reject') => {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, status: result } : v)));
    push({ title: result === 'pass' ? '视频已通过复审' : '视频已驳回下架', description: `${id} · 裁定已同步推荐池与处罚中心`, tone: result === 'pass' ? 'success' : 'error' });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Social Deep / IM & Video Audit"
        title="IM 聊天审计与视频号复审"
        description="敏感词库（正则/多语言）· 举报上下文调取（前后 50 条脱敏）· 文件链接拦截 · 视频逐帧复审与申诉二审"
        meta={<Badge tone="rose">合规调取全程留痕</Badge>}
        actions={
          <Button variant="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => { downloadCsv('sens-words.csv', ['编号', '词条', '分类', '语言', '正则', '命中', '状态'], words.map((w) => [w.id, w.word, w.category, w.lang, w.regex ? '是' : '否', String(w.hitCount), w.enabled ? '启用' : '停用'])); push({ title: '词库已导出', description: `${words.length} 条敏感词规则`, tone: 'success' }); }}>
            导出词库
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'words' as const, label: '敏感词库', icon: BookMarked },
          { key: 'context' as const, label: '聊天上下文调取', icon: MessageSquareWarning },
          { key: 'files' as const, label: '文件与链接拦截', icon: Link2 },
          { key: 'video' as const, label: '视频号复审', icon: Video },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-all', tab === t.key ? 'bg-[#111827] text-white shadow-[0_2px_8px_rgba(17,24,39,0.14)]' : 'bg-white text-[#6B7280] hover:text-[#111827]')}>
              <Icon className="h-3.5 w-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {tab === 'words' && (
        <Card className="animate-page-enter p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title="敏感词库管理" subtitle="支持正则表达式 · 中/英/越等多语言 · 命中自动拦截或转人工" />
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                <input value={wordKeyword} onChange={(e) => { setWordKeyword(e.target.value); setPage(1); }} placeholder="搜索词条 / 编号" className="w-52 rounded-xl bg-[#F9FAFB] py-2.5 pr-3 pl-9 text-xs outline-none focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]" />
              </div>
              <Select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }} className="w-28 py-2.5 text-xs">
                <option value="all">全部分类</option>
                <option value="涉政">涉政</option>
                <option value="涉黄">涉黄</option>
                <option value="涉诈">涉诈</option>
                <option value="广告">广告</option>
              </Select>
              <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => push({ title: '新增词条', description: '词条需经双人评审后生效，正则先在沙箱验证回溯误杀', tone: 'info' })}>新增词条</Button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  <th className="rounded-l-xl py-3 pr-3 pl-4 font-medium">词条 / 编号</th>
                  <th className="px-3 py-3 font-medium">分类</th>
                  <th className="px-3 py-3 font-medium">语言</th>
                  <th className="px-3 py-3 font-medium">正则</th>
                  <th className="px-3 py-3 font-medium">24h 命中</th>
                  <th className="px-3 py-3 font-medium">启用</th>
                  <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedWords.map((w) => (
                  <tr key={w.id} className="transition-colors hover:bg-[#F9FAFB]/80">
                    <td className="py-3.5 pr-3 pl-4">
                      <p className="max-w-[280px] truncate font-mono text-[11px] font-medium text-[#111827]">{w.word}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{w.id}</p>
                    </td>
                    <td className="px-3 py-3.5"><Badge tone={CAT_TONE[w.category]}>{w.category}</Badge></td>
                    <td className="px-3 py-3.5 text-[11px] text-[#4B5563]">{w.lang}</td>
                    <td className="px-3 py-3.5">{w.regex ? <Badge tone="sky" dot={false}>REGEX</Badge> : <span className="text-[10px] text-[#9CA3AF]">精确匹配</span>}</td>
                    <td className="px-3 py-3.5 font-mono text-[11px] font-medium text-[#111827]">{w.hitCount.toLocaleString('zh-CN')}</td>
                    <td className="px-3 py-3.5"><Switch checked={w.enabled} onChange={() => toggleWord(w.id)} label={w.id} /></td>
                    <td className="py-3.5 pr-4 pl-3 text-right">
                      <button type="button" onClick={() => push({ title: '回溯验证', description: `${w.id} · 近 7 天回放误杀率 0.04%，可放心全量`, tone: 'info' })} className="cursor-pointer rounded-lg px-2 py-1.5 text-[11px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]">回溯验证</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filteredWords.length} onPageChange={setPage} />
        </Card>
      )}

      {tab === 'context' && (
        <div className="animate-page-enter grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="p-5 xl:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle title="举报上下文调取" subtitle="举报单 REP-20260224-771 · 违规消息前后 50 条（脱敏显示）" />
              <button type="button" onClick={() => setMasked((v) => !v)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#F9FAFB] px-2.5 py-1.5 text-[10px] font-medium text-[#4B5563] hover:bg-[#F3F4F6]">
                {masked ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}{masked ? '脱敏开' : '脱敏关'}
              </button>
            </div>
            <div className="mt-4 max-h-[460px] space-y-2.5 overflow-y-auto rounded-2xl bg-[#F9FAFB] p-4">
              {CHAT_CONTEXT.map((m) => (
                <div key={m.msgId} className={cn('flex gap-2', m.mine ? 'flex-row-reverse' : 'flex-row')}>
                  <Avatar name={m.from} tone={m.mine ? 'bg-rose-500' : 'bg-slate-700'} size="sm" />
                  <div className={cn('max-w-[75%] rounded-2xl px-3.5 py-2.5', m.hit ? 'bg-rose-50 shadow-[0_0_0_1.5px_#F43F5E]' : m.mine ? 'bg-white shadow-xs' : 'bg-white shadow-xs')}>
                    <p className="text-[9px] text-[#9CA3AF]">{m.from} · <span className="font-mono">{m.time}</span></p>
                    <p className={cn('mt-1 text-[12px] leading-relaxed', m.hit ? 'font-medium text-rose-800' : 'text-[#111827]')}>{maskContent(m.content)}</p>
                    {m.hit && <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-rose-600 px-1.5 py-0.5 text-[9px] font-medium text-white"><Flag className="h-2.5 w-2.5" />命中涉诈词库 SW-1201</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-[10px] text-gray-300">
              <Lock className="h-3.5 w-3.5 text-orange-400" />合规水印：调取人 root · 工单 REP-771 · 用途 举报核实 · 全程录屏留痕
            </div>
          </Card>
          <div className="space-y-4 xl:col-span-5">
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-[#111827]">举报信息</h3>
              <div className="mt-3 space-y-2.5 text-[11px]">
                {[
                  ['举报人', '陆屿科技 王工（已实名）'],
                  ['被举报人', '福利派发官 007 · wx_uid_88492265'],
                  ['举报类型', '欺诈 / 诱导添加外部微信'],
                  ['举报时间', '2026-02-24 02:14:22'],
                  ['历史处罚', '封号 1 次 · 禁言 2 次'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><span className="shrink-0 text-[#9CA3AF]">{k}</span><span className="text-right font-medium text-[#111827]">{v}</span></div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => push({ title: '举报成立', description: '已并入 MOM-20260224-0091 处罚，建议永久封号', tone: 'success' })}>举报成立</Button>
                <Button variant="secondary" icon={<XCircle className="h-3.5 w-3.5 text-[#9CA3AF]" />} onClick={() => push({ title: '举报不成立', description: '已通知举报人复核结论', tone: 'info' })}>不成立</Button>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-[#111827]">快捷处罚</h3>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {['禁言3天', '禁言7天', '永久封号'].map((p) => (
                  <button key={p} type="button" onClick={() => push({ title: `已执行：${p}`, description: '处罚已同步 IM 网关，被处罚方可申诉', tone: p === '永久封号' ? 'error' : 'success' })} className={cn('cursor-pointer rounded-xl py-2.5 text-[11px] font-medium transition-all', p === '永久封号' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-[#F9FAFB] text-[#4B5563] hover:bg-[#F3F4F6]')}>{p}</button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'files' && (
        <Card className="animate-page-enter p-6">
          <SectionTitle title="文件与链接拦截" subtitle="高危下载链接 · 木马文件 · 违规小程序一键封禁" right={<Badge tone="rose">{INTERCEPT_ITEMS.length} 今日拦截</Badge>} />
          <div className="mt-4 space-y-2.5">
            {INTERCEPT_ITEMS.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-2xl bg-[#F9FAFB] p-4 sm:flex-row sm:items-center">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-rose-500 shadow-xs">
                  {item.type === '链接' ? <Link2 className="h-4 w-4" /> : item.type === '文件' ? <FileWarning className="h-4 w-4" /> : <Scan className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[#111827]">{item.name}</span>
                    <Badge tone="slate" dot={false}>{item.type}</Badge>
                    <Badge tone="rose">{item.risk}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-[#4B5563]">{item.detail}</p>
                  <p className="mt-0.5 font-mono text-[9px] text-[#9CA3AF]">{item.id} · {item.time}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-[10px] text-emerald-600 lg:inline">{item.action}</span>
                  <Button size="xs" variant="secondary" onClick={() => push({ title: '样本已同步', description: `${item.id} · 已同步威胁情报库全网拦截`, tone: 'info' })}>全网封禁</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'video' && (
        <div className="animate-page-enter grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="p-5 xl:col-span-4">
            <SectionTitle title="机器初审拦截池" subtitle="AI 裸露 / 暴恐 / 导流识别" />
            <div className="mt-3 space-y-2">
              {videos.map((v) => (
                <button key={v.id} type="button" onClick={() => setActiveVideo(v.id)} className={cn('w-full cursor-pointer rounded-2xl p-3.5 text-left transition-all', activeVideo === v.id ? 'bg-[#111827] text-white' : 'bg-[#F9FAFB] hover:bg-[#F3F4F6]')}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold">{v.author}</span>
                    {v.status === 'pending' ? <Badge tone={activeVideo === v.id ? 'dark' : v.riskScore > 80 ? 'rose' : 'amber'} dot={false}>AI {v.riskScore}</Badge> : v.status === 'pass' ? <Badge tone="emerald">已通过</Badge> : <Badge tone="rose">已驳回</Badge>}
                  </div>
                  <p className={cn('mt-1 font-mono text-[9px]', activeVideo === v.id ? 'text-white/60' : 'text-[#9CA3AF]')}>{v.id} · {v.duration} · 举报 {v.reports}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">{v.aiTags.map((t) => <span key={t} className={cn('rounded px-1.5 py-0.5 text-[9px]', activeVideo === v.id ? 'bg-white/15 text-white' : 'bg-white text-[#6B7280] shadow-xs')}>{t}</span>)}</div>
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-5 xl:col-span-5">
            <SectionTitle title="人工复审 · 逐帧预览" subtitle={`${video.id} · 大图 / 逐帧 / 弹幕`} right={<Badge tone="rose">AI {video.riskScore} 分</Badge>} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {video.frames.map((f, i) => (
                <div key={f.label} className={cn('relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br', f.tone)}>
                  <Video className="h-5 w-5 text-white/80" />
                  <span className="mt-1 text-[9px] font-medium text-white/90">{f.label}</span>
                  <span className="absolute top-1.5 left-1.5 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[8px] text-white">帧 {i + 1}</span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-medium text-[#374151]">复审标签</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {['涉政', '低俗', '广告', '欺诈', '正常'].map((t) => (
                  <button key={t} type="button" onClick={() => push({ title: `已标记：${t}`, description: video.id, tone: 'info' })} className={cn('cursor-pointer rounded-xl px-3 py-2 text-[11px] font-medium', t === '正常' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-[#F9FAFB] text-[#4B5563] hover:bg-[#F3F4F6]')}>{t}</button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="success" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => reviewVideo(video.id, 'pass')}>通过</Button>
              <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => reviewVideo(video.id, 'reject')}>驳回下架</Button>
            </div>
          </Card>
          <div className="space-y-4 xl:col-span-3">
            <Card className="p-5">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#111827]"><TrendingDown className="h-3.5 w-3.5 text-amber-500" />降权与限流</h3>
              <div className="mt-3 space-y-2.5">
                {[
                  { label: '朋友圈对好友折叠', desc: '仅自己可见，7 天后复评', on: true },
                  { label: '移出视频号推荐池', desc: '停止公域流量分发', on: true },
                  { label: '禁止直播 30 天', desc: '同步扣除信用分 20', on: false },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-2 rounded-xl bg-[#F9FAFB] px-3 py-2.5">
                    <div><p className="text-[11px] font-medium text-[#111827]">{s.label}</p><p className="mt-0.5 text-[9px] text-[#9CA3AF]">{s.desc}</p></div>
                    <Switch checked={s.on} onChange={() => push({ title: s.label, description: '策略已同步推荐引擎', tone: 'info' })} />
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#111827]"><ShieldAlert className="h-3.5 w-3.5 text-rose-500" />二审与申诉</h3>
              <p className="mt-1.5 text-[10px] leading-relaxed text-[#6B7280]">被处罚用户申诉由高级审核员复核，推翻一审需填写理由并记入一审责任追溯。</p>
              <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setAppealOpen(true)}>处理申诉（2）</Button>
            </Card>
          </div>
        </div>
      )}

      <Modal open={appealOpen} onClose={() => setAppealOpen(false)} title="申诉二审" subtitle="MOM-20260224-0088 · 高级审核员复核（责任追溯）" icon={<ShieldCheck className="h-4 w-4" />} footer={<><Button variant="secondary" onClick={() => setAppealOpen(false)}>取消</Button><Button variant="danger" icon={<VolumeX className="h-3.5 w-3.5" />} onClick={() => { push({ title: '维持一审处罚', description: '禁言 7 天维持，申诉驳回', tone: 'info' }); setAppealOpen(false); }}>维持原判</Button><Button variant="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => { push({ title: '已推翻一审', description: '处罚撤销，一审审核员记差错 1 次', tone: 'success' }); setAppealOpen(false); }}>推翻一审</Button></>}>
        <div className="space-y-3">
          <div className="rounded-xl bg-[#F9FAFB] p-3.5 text-[11px] leading-relaxed text-[#4B5563]">
            <p className="font-medium text-[#111827]">用户申诉理由</p>
            <p className="mt-1">“我是正规跨境店铺，视频里的是客服微信不是私人号，请求复核。”</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3.5 text-[11px] leading-relaxed text-amber-800">
            <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5" />一审记录（责任追溯）</p>
            <p className="mt-1">一审：沈知微 · 2026-02-24 10:14 · 标签「欺诈/广告」· 处罚禁言 7 天 · 证据：OCR 命中微信号 + 收益承诺话术。</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#9CA3AF]"><Filter className="h-3 w-3" />二审结论将同步用户申诉入口，并计入审核员月度差错率。</div>
        </div>
      </Modal>
    </div>
  );
};

/* ============================ 直播监看墙 ============================ */

export const LiveWallPage: React.FC = () => {
  const { push } = useToast();
  const [rooms, setRooms] = useState<LiveRoomFull[]>(LIVE_WALL);
  const [cutTarget, setCutTarget] = useState<LiveRoomFull | null>(null);
  const [cutReason, setCutReason] = useState('');
  const [scanStep, setScanStep] = useState(0);
  const [keyword, setKeyword] = useState('');

  const filtered = rooms.filter((r) => !keyword.trim() || r.title.includes(keyword.trim()) || r.anchor.includes(keyword.trim()));

  const startCut = (room: LiveRoomFull) => {
    setCutTarget(room);
    setCutReason('');
    setScanStep(0);
  };

  const confirmCut = () => {
    if (!cutTarget) return;
    if (cutReason.trim().length < 4) {
      push({ title: '请填写断流原因', description: '至少 4 个字，将同步主播端并扣除信用分', tone: 'error' });
      return;
    }
    if (scanStep < 2) {
      push({ title: '需完成扫码二次授权', description: '请使用企业微信扫码确认高危操作', tone: 'error' });
      return;
    }
    setRooms((prev) => prev.map((r) => (r.id === cutTarget.id ? { ...r, status: 'cut' as const, credit: Math.max(0, r.credit - 20) } : r)));
    push({ title: '直播已强制断流', description: `${cutTarget.id} · 主播信用分 -20 · 录像已固证`, tone: 'success' });
    setCutTarget(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Social Deep / Live Monitor"
        title="直播实时监看墙"
        description="九宫格同时监看 9 路直播 · 实时抓取弹幕关键词 · 强制断流需扫码二次授权"
        meta={<Badge tone="rose"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />9 路 · 3 路预警</Badge>}
        actions={
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索主播 / 标题关键词" className="w-56 rounded-xl bg-white py-2.5 pr-3 pl-9 text-xs shadow-[0_1px_2px_rgba(15,23,42,0.05)] outline-none focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]" />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((room) => (
          <Card key={room.id} className="overflow-hidden">
            <div className="relative bg-[#0B1220] p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {room.status === 'cut' ? <Badge tone="slate" dot={false}>已断流</Badge> : <Badge tone="rose" dot={false}><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE</Badge>}
                  <span className="font-mono text-[9px] text-gray-400">{room.id} · {room.category}</span>
                </div>
                <span className={cn('rounded-md px-1.5 py-0.5 font-mono text-[9px]', room.riskScore >= 80 ? 'bg-rose-500 text-white' : room.riskScore >= 50 ? 'bg-amber-400 text-[#111827]' : 'bg-white/15 text-gray-300')}>RISK {room.riskScore}</span>
              </div>
              <p className="mt-2 truncate text-[12px] font-semibold text-white">{room.title}</p>
              <p className="mt-0.5 text-[10px] text-gray-400">{room.anchor} · {room.viewers.toLocaleString('zh-CN')} 人观看 · 信用 {room.credit}</p>
              <div className="mt-2.5 space-y-1 rounded-xl bg-white/5 p-2.5">
                {room.danmaku.map((d, i) => (
                  <p key={i} className={cn('truncate text-[10px]', d.hit ? 'font-medium text-rose-300' : 'text-gray-300')}>
                    <span className="text-gray-500">{d.user}：</span>{d.text}
                    {d.hit && <span className="ml-1 rounded bg-rose-500 px-1 py-px text-[8px] text-white">命中</span>}
                  </p>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 p-3">
              {room.status === 'cut' ? (
                <div className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#F9FAFB] py-2.5 text-[11px] font-medium text-[#9CA3AF]"><Ban className="h-3.5 w-3.5" />已断流 · 录像固证中</div>
              ) : (
                <>
                  <Button size="sm" variant="secondary" className="flex-1" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => push({ title: '已进入单路详看', description: `${room.id} · 4 倍速回放 + 全量弹幕`, tone: 'info' })}>详看</Button>
                  <Button size="sm" variant="secondary" icon={<VolumeX className="h-3.5 w-3.5" />} onClick={() => push({ title: '已禁言违规弹幕用户', description: `${room.id} · 命中关键词用户禁言 24 小时`, tone: 'info' })}>禁言</Button>
                  <Button size="sm" variant="danger" icon={<Radio className="h-3.5 w-3.5" />} onClick={() => startCut(room)}>断流</Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={Boolean(cutTarget)} onClose={() => setCutTarget(null)} title="强制断流（高危）" subtitle={cutTarget ? `${cutTarget.id} · ${cutTarget.anchor} · ${cutTarget.title}` : ''} icon={<Radio className="h-4 w-4 text-rose-500" />} footer={<><Button variant="secondary" onClick={() => setCutTarget(null)}>取消</Button><Button variant="danger" icon={<Ban className="h-3.5 w-3.5" />} onClick={confirmCut}>确认断流</Button></>}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#374151]">断流原因（必填，同步主播端）</label>
            <textarea rows={2} value={cutReason} onChange={(e) => setCutReason(e.target.value)} placeholder="如：主播引导站外交易，话术“加微信私下转”…" className="w-full resize-none rounded-xl bg-[#F9FAFB] p-3 text-xs outline-none focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]" />
          </div>
          <div className="rounded-2xl bg-[#F9FAFB] p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-[#111827]"><QrCode className="h-3.5 w-3.5" />扫码二次授权</p>
            <div className="mt-3 flex items-center gap-4">
              <button type="button" onClick={() => setScanStep((s) => Math.min(2, s + 1))} className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl bg-white shadow-xs transition-transform hover:scale-105" title="点击模拟扫码">
                <QrCode className="h-8 w-8 text-[#111827]" />
                <span className="mt-1 font-mono text-[8px] text-[#9CA3AF]">{scanStep === 0 ? '待扫码' : scanStep === 1 ? '已扫码' : '已确认'}</span>
              </button>
              <div className="flex-1 space-y-1.5">
                {['企业微信扫码', '主管二次确认', '断流指令下发'].map((s, i) => (
                  <div key={s} className="flex items-center gap-2 text-[11px]">
                    <span className={cn('flex h-4 w-4 items-center justify-center rounded-full', scanStep > i ? 'bg-emerald-500 text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]')}>
                      {scanStep > i ? <CheckCircle2 className="h-2.5 w-2.5" /> : <span className="text-[8px] font-bold">{i + 1}</span>}
                    </span>
                    <span className={scanStep > i ? 'text-[#111827]' : 'text-[#9CA3AF]'}>{s}</span>
                  </div>
                ))}
                <p className="text-[9px] text-[#9CA3AF]">演示环境点击二维码模拟扫码确认</p>
              </div>
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-[#9CA3AF]"><ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />断流后自动扣除主播信用分 20，近 5 分钟直播流固证并生成违规工单。</p>
        </div>
      </Modal>
    </div>
  );
};
