import React, { useMemo, useState } from 'react';
import {
  AlarmClock,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Download,
  Inbox,
  Megaphone,
  MessageSquareText,
  Pause,
  Play,
  Search,
  Send,
  Smartphone,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import { Badge, Button, Card, Modal, PageHeader, Pagination, Select, Tone, cn, downloadCsv, useToast } from '../components/ui';
import { TOUCH_TEMPLATES } from '../lib/ops';
import type { Ticket, TouchTemplate } from '../lib/ops';

const TICKET_STATUS: Record<Ticket['status'], { label: string; tone: Tone }> = {
  open: { label: '待处理', tone: 'amber' },
  doing: { label: '处理中', tone: 'sky' },
  escalated: { label: '已升级', tone: 'rose' },
  closed: { label: '已关闭', tone: 'emerald' },
};

const PRIORITY_TONE: Record<Ticket['priority'], Tone> = { P0: 'rose', P1: 'orange', P2: 'slate' };
const CHANNEL_ICON: Record<TouchTemplate['channel'], React.ComponentType<{ className?: string }>> = {
  站内信: Inbox,
  短信: MessageSquareText,
  模板消息: Send,
  Push: Smartphone,
};

/* ============================ 全局工单 ============================ */

export const TicketsPage: React.FC<{ tickets: Ticket[]; onUpdateTicket: (id: string, updates: Partial<Ticket>) => void }> = ({ tickets, onUpdateTicket }) => {
  const { push } = useToast();
  const [statusTab, setStatusTab] = useState<'all' | Ticket['status']>('all');
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [assignTo, setAssignTo] = useState('林清和');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const filtered = useMemo(
    () => tickets.filter((t) => (statusTab === 'all' || t.status === statusTab) && (!keyword.trim() || t.title.includes(keyword.trim()) || t.id.toLowerCase().includes(keyword.trim().toLowerCase()) || t.requester.includes(keyword.trim()))),
    [tickets, statusTab, keyword]
  );
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const slaRisk = tickets.filter((t) => t.slaLeft < 60 && t.status !== 'closed').length;

  const slaBar = (t: Ticket) => {
    const pct = Math.max(0, Math.min(100, (t.slaLeft / t.slaMinutes) * 100));
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#F3F4F6]">
          <div className={cn('h-full rounded-full', t.slaLeft < 0 ? 'bg-rose-600' : t.slaLeft < 60 ? 'bg-rose-400' : t.slaLeft < 180 ? 'bg-amber-400' : 'bg-emerald-500')} style={{ width: `${t.slaLeft < 0 ? 100 : pct}%` }} />
        </div>
        <span className={cn('font-mono text-[10px] font-medium', t.slaLeft < 0 ? 'text-rose-600' : t.slaLeft < 60 ? 'text-rose-500' : 'text-[#6B7280]')}>
          {t.status === 'closed' ? '—' : t.slaLeft < 0 ? `超时 ${Math.abs(t.slaLeft)}m` : `剩 ${t.slaLeft}m`}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Service / Tickets"
        title="全局工单系统"
        description="用户申诉 · 商户投诉 · 资金解冻 · 支持跨部门流转与 SLA 倒计时自动升级"
        meta={<Badge tone="rose"><AlarmClock className="h-3 w-3" />{slaRisk} 即将超时</Badge>}
        actions={
          <Button variant="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => { downloadCsv('tickets.csv', ['工单', '类型', '标题', '优先级', 'SLA剩余(分)', '状态', '处理人'], tickets.map((t) => [t.id, t.kind, t.title, t.priority, String(t.slaLeft), TICKET_STATUS[t.status].label, t.assignee])); push({ title: '工单报表已导出', description: `${tickets.length} 条含 SLA`, tone: 'success' }); }}>
            导出工单
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '待处理', value: tickets.filter((t) => t.status === 'open').length, tone: 'text-amber-600' },
          { label: '处理中', value: tickets.filter((t) => t.status === 'doing').length, tone: 'text-sky-600' },
          { label: '已升级', value: tickets.filter((t) => t.status === 'escalated').length, tone: 'text-rose-600' },
          { label: 'SLA 达成率', value: '92.4%', tone: 'text-emerald-600' },
        ].map((m) => (
          <Card key={m.label} className="p-4">
            <p className="text-[11px] font-medium text-[#6B7280]">{m.label}</p>
            <p className={cn('mt-1.5 font-mono text-xl font-semibold', m.tone)}>{m.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {([['all', '全部'], ['open', '待处理'], ['doing', '处理中'], ['escalated', '已升级'], ['closed', '已关闭']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => { setStatusTab(k); setPage(1); }} className={cn('cursor-pointer rounded-xl px-3 py-2 text-[11px] font-medium transition-all', statusTab === k ? 'bg-[#111827] text-white' : 'bg-[#F9FAFB] text-[#6B7280] hover:text-[#111827]')}>{l}</button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} placeholder="搜索工单 / 标题 / 发起方" className="w-60 rounded-xl bg-[#F9FAFB] py-2.5 pr-3 pl-9 text-xs outline-none focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]" />
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                <th className="rounded-l-xl py-3 pr-3 pl-4 font-medium">工单 / 标题</th>
                <th className="px-3 py-3 font-medium">类型</th>
                <th className="px-3 py-3 font-medium">优先级</th>
                <th className="px-3 py-3 font-medium">SLA 倒计时</th>
                <th className="px-3 py-3 font-medium">处理人</th>
                <th className="px-3 py-3 font-medium">状态</th>
                <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-[#F9FAFB]/80">
                  <td className="py-3.5 pr-3 pl-4">
                    <p className="max-w-[280px] truncate text-xs font-medium text-[#111827]">{t.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{t.id} · {t.requester}</p>
                  </td>
                  <td className="px-3 py-3.5"><span className="rounded-md bg-[#F3F4F6] px-2 py-1 text-[10px] text-[#4B5563]">{t.kind}</span></td>
                  <td className="px-3 py-3.5"><Badge tone={PRIORITY_TONE[t.priority]} dot={false}>{t.priority}</Badge></td>
                  <td className="px-3 py-3.5">{slaBar(t)}</td>
                  <td className="px-3 py-3.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#4B5563]"><UserRound className="h-3 w-3 text-[#9CA3AF]" />{t.assignee}</span>
                  </td>
                  <td className="px-3 py-3.5"><Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge></td>
                  <td className="py-3.5 pr-4 pl-3 text-right">
                    <button type="button" onClick={() => { setDetail(t); setAssignTo(t.assignee === '待分配' ? '林清和' : t.assignee); }} className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]">
                      处理 <ChevronRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
      </Card>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="工单处理" subtitle={detail ? `${detail.id} · ${detail.kind} · ${detail.priority}` : ''} icon={<MessageSquareText className="h-4 w-4" />} size="lg" footer={<><Button variant="secondary" onClick={() => setDetail(null)}>关闭</Button><Button variant="primary" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => { if (!detail) return; onUpdateTicket(detail.id, { status: 'closed', assignee: assignTo }); push({ title: '工单已关闭', description: `${detail.id} · 处理人 ${assignTo}`, tone: 'success' }); setDetail(null); }}>办结工单</Button></>}>
        {detail && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-[#111827]">{detail.title}</p>
              <p className="mt-1 text-[11px] text-[#6B7280]">发起方：{detail.requester} · {detail.createdAt}</p>
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-[#374151]">跨部门流转 / 指派</p>
                <div className="flex gap-1.5">
                  <Select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="flex-1 py-2.5 text-xs">
                    {['林清和', '顾以宁', '沈知微', 'root'].map((p) => <option key={p} value={p}>{p}</option>)}
                  </Select>
                  <Button size="sm" variant="secondary" icon={<ArrowRight className="h-3 w-3" />} onClick={() => { onUpdateTicket(detail.id, { assignee: assignTo, status: 'doing' }); push({ title: `已流转给 ${assignTo}`, description: detail.id, tone: 'info' }); }}>流转</Button>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-[#F9FAFB] p-3.5">
                <p className="text-[10px] text-[#9CA3AF]">SLA</p>
                <p className="mt-1 font-mono text-[11px] text-[#111827]">总时长 {detail.slaMinutes} 分钟 · {detail.slaLeft < 0 ? `已超时 ${Math.abs(detail.slaLeft)} 分钟` : `剩余 ${detail.slaLeft} 分钟`}</p>
                {detail.slaLeft < 60 && detail.status !== 'closed' && <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-rose-600"><BellRing className="h-3 w-3" />即将超时，超时将自动升级给主管</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-[#374151]">处理时间线</p>
              <div className="mt-2 space-y-0">
                {detail.timeline.map((s, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#111827] text-white"><span className="h-1 w-1 rounded-full bg-white" /></span>
                      {i < detail.timeline.length - 1 && <span className="h-8 w-px bg-[#E5E7EB]" />}
                    </div>
                    <div className="pb-2">
                      <p className="text-[11px] font-medium text-[#111827]">{s.action}</p>
                      <p className="mt-0.5 font-mono text-[9px] text-[#9CA3AF]">{s.time} · {s.actor}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

/* ============================ 多渠道触达 ============================ */

export const TouchPage: React.FC = () => {
  const { push } = useToast();
  const [templates, setTemplates] = useState<TouchTemplate[]>(TOUCH_TEMPLATES);
  const [preview, setPreview] = useState<TouchTemplate | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Service / Touch Center"
        title="多渠道触达配置"
        description="站内信 · 短信 · 微信模板消息 · Push · 模板管理 / 发送频控 / 回执监控"
        meta={<Badge tone="emerald">今日发送 143.2 万</Badge>}
        actions={
          <Button variant="primary" icon={<Megaphone className="h-3.5 w-3.5" />} onClick={() => push({ title: '新建触达任务', description: '选择模板 → 圈选人群 → 频控校验 → 定时发送', tone: 'info' })}>
            新建发送任务
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '发送成功率', value: '98.6%', icon: TrendingUp },
          { label: '用户拉黑', value: '18,486', icon: BellRing },
          { label: '频控拦截', value: '4,212', icon: AlarmClock },
          { label: '在用模板', value: `${templates.filter((t) => t.status === 'active').length} / ${templates.length}`, icon: MessageSquareText },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="p-4">
              <div className="flex items-center justify-between"><p className="text-[11px] font-medium text-[#6B7280]">{m.label}</p><Icon className="h-4 w-4 text-[#9CA3AF]" /></div>
              <p className="mt-1.5 font-mono text-xl font-semibold text-[#111827]">{m.value}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {templates.map((t) => {
          const Icon = CHANNEL_ICON[t.channel];
          return (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F9FAFB] text-[#4B5563]"><Icon className="h-4 w-4" /></div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[13px] font-semibold text-[#111827]">{t.name}</p>
                      <Badge tone="slate" dot={false}>{t.channel}</Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{t.id} · 频控：{t.freqLimit}</p>
                  </div>
                </div>
                {t.status === 'active' ? <Badge tone="emerald">发送中</Badge> : <Badge tone="slate">已暂停</Badge>}
              </div>
              <div className="mt-3 rounded-xl bg-[#F9FAFB] p-3.5 text-[11px] leading-relaxed text-[#4B5563]">{t.content}</div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#F9FAFB] py-2"><p className="font-mono text-[13px] font-semibold text-[#111827]">{t.sent.toLocaleString('zh-CN')}</p><p className="mt-0.5 text-[9px] text-[#9CA3AF]">累计发送</p></div>
                <div className="rounded-xl bg-[#F9FAFB] py-2"><p className="font-mono text-[13px] font-semibold text-emerald-600">{t.successRate}%</p><p className="mt-0.5 text-[9px] text-[#9CA3AF]">成功率</p></div>
                <div className="rounded-xl bg-[#F9FAFB] py-2"><p className="font-mono text-[13px] font-semibold text-rose-600">{t.blocked.toLocaleString('zh-CN')}</p><p className="mt-0.5 text-[9px] text-[#9CA3AF]">拉黑</p></div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => setPreview(t)}>预览回执</Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={t.status === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  onClick={() => {
                    setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: x.status === 'active' ? 'paused' as const : 'active' as const } : x)));
                    push({ title: t.status === 'active' ? '模板已暂停' : '模板已恢复', description: t.name, tone: 'info' });
                  }}
                >
                  {t.status === 'active' ? '暂停' : '恢复'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="发送回执" subtitle={preview ? `${preview.id} · ${preview.name} · ${preview.channel}` : ''} icon={<Send className="h-4 w-4" />} footer={<><Button variant="secondary" onClick={() => setPreview(null)}>关闭</Button><Button variant="primary" onClick={() => { push({ title: '回执明细已导出', description: '含成功 / 失败 / 拉黑三态', tone: 'success' }); setPreview(null); }}>导出回执</Button></>}>
        {preview && (
          <div className="space-y-2.5">
            {[
              { label: '发送成功', value: Math.floor(preview.sent * (preview.successRate / 100)), tone: 'bg-emerald-500' },
              { label: '发送失败', value: preview.sent - Math.floor(preview.sent * (preview.successRate / 100)) - preview.blocked, tone: 'bg-amber-400' },
              { label: '用户拉黑', value: preview.blocked, tone: 'bg-rose-500' },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-2.5 rounded-xl bg-[#F9FAFB] px-3.5 py-2.5">
                <span className={cn('h-2 w-2 rounded-full', r.tone)} />
                <span className="text-[11px] text-[#4B5563]">{r.label}</span>
                <span className="ml-auto font-mono text-[11px] font-semibold text-[#111827]">{r.value.toLocaleString('zh-CN')}</span>
              </div>
            ))}
            <p className="text-[10px] leading-relaxed text-[#9CA3AF]">失败主因：手机号空号（42%）、模板变量缺失（31%）、用户退订（27%）。拉黑用户自动进入 30 天免打扰名单。</p>
          </div>
        )}
      </Modal>
    </div>
  );
};
