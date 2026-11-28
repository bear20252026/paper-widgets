import React, { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, ClipboardCheck, FileText, Search, ShieldAlert, XCircle } from 'lucide-react';
import type { ApprovalItem, ApprovalStatus, Role } from '../lib/types';
import { APPROVAL_LABELS, APPROVAL_ROLES } from '../lib/platform';
import { Badge, Button, Card, Modal, PageHeader, SectionTitle, Select, Textarea, cn, useToast } from '../components/ui';
import { formatFen } from '../lib/ops';

interface ApprovalCenterProps {
  role: Role;
  approvals: ApprovalItem[];
  onDecide: (id: string, decision: 'approved' | 'rejected', reason: string) => void;
}

const urgency = (item: ApprovalItem, now: number): { text: string; cls: string; urgent: boolean } => {
  const minutes = Math.ceil((new Date(item.sla_deadline).getTime() - now) / 60000);
  if (item.status !== 'pending') return { text: '已裁决', cls: 'text-[#9CA3AF]', urgent: false };
  if (minutes <= 0) return { text: `逾期 ${Math.abs(minutes)} 分钟`, cls: 'text-rose-600', urgent: true };
  if (minutes < 60) return { text: `剩余 ${minutes} 分钟`, cls: 'text-rose-600', urgent: true };
  return { text: `剩余 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`, cls: 'text-[#6B7280]', urgent: false };
};

export const ApprovalCenterPage: React.FC<ApprovalCenterProps> = ({ role, approvals, onDecide }) => {
  const { push } = useToast();
  const [now, setNow] = useState(Date.now());
  const [status, setStatus] = useState<'all' | ApprovalStatus>('pending');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const allowed = useMemo(() => approvals.filter((a) => APPROVAL_ROLES[a.category].includes(role)), [approvals, role]);
  const pending = allowed.filter((a) => a.status === 'pending');
  const urgentCount = pending.filter((a) => urgency(a, now).urgent).length;
  const visible = useMemo(() => allowed.filter((a) => {
    if (status !== 'all' && a.status !== status) return false;
    if (category !== 'all' && a.category !== category) return false;
    const q = query.trim().toLowerCase();
    return !q || `${a.title} ${a.approval_id} ${a.target_id} ${a.applicant}`.toLowerCase().includes(q);
  }).sort((a, b) => new Date(a.sla_deadline).getTime() - new Date(b.sla_deadline).getTime()), [allowed, status, category, query]);

  const open = (item: ApprovalItem) => {
    setSelected(item);
    setDecision('approved');
    setReason('');
    setError('');
  };

  const submit = () => {
    if (!selected || selected.status !== 'pending') return;
    if (decision === 'rejected' && reason.trim().length < 8) {
      setError('驳回必须填写不少于 8 个字的具体原因，并将写入审计日志');
      return;
    }
    onDecide(selected.approval_id, decision, reason.trim() || '资料核验通过，已记录本次裁决。');
    push({ title: decision === 'approved' ? '审批已通过' : '审批已驳回', description: `${selected.approval_id} · 结论已同步通知中心与审计日志`, tone: decision === 'approved' ? 'success' : 'info' });
    setSelected(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Workspace / Unified Approvals" title="审批中心" description="跨域统一待办池 · 按岗位权限过滤 · 风险分级、SLA 倒计时与不可篡改裁决留痕" meta={<Badge tone="orange">{pending.length} 项待处理</Badge>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '我的待审批', number: pending.length, hint: '仅展示本角色授权类别', tone: 'text-[#111827]', icon: ClipboardCheck },
          { label: '紧急 / 已逾期', number: urgentCount, hint: 'SLA 小于 60 分钟', tone: 'text-rose-600', icon: AlertTriangle },
          { label: '高危待决', number: pending.filter((a) => a.risk_level !== 'medium').length, hint: '需审阅完整证据', tone: 'text-orange-600', icon: ShieldAlert },
          { label: '今日已裁决', number: allowed.filter((a) => a.status !== 'pending').length, hint: '通过与驳回皆保留记录', tone: 'text-emerald-600', icon: CheckCircle2 },
        ].map((item) => <Card key={item.label} className="flex items-start justify-between p-4"><div><p className="text-[11px] text-[#6B7280]">{item.label}</p><p className={cn('mt-2 font-mono text-2xl font-semibold', item.tone)}>{String(item.number).padStart(2, '0')}</p><p className="mt-1 text-[10px] text-[#9CA3AF]">{item.hint}</p></div><item.icon className="h-4 w-4 text-[#B6BDC7]" /></Card>)}
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="审批队列" subtitle="按 SLA 到期时间排序，优先处理即将逾期项目" />
          <div className="flex flex-wrap gap-2">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" /><input aria-label="搜索审批" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="申请编号、目标或发起人" className="w-52 rounded-xl bg-[#F9FAFB] py-2.5 pl-9 pr-3 text-xs outline-none focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]" /></div>
            <Select aria-label="审批类别" value={category} onChange={(e) => setCategory(e.target.value)} className="w-36 py-2.5 text-xs"><option value="all">全部类别</option>{Object.entries(APPROVAL_LABELS).filter(([key]) => APPROVAL_ROLES[key as ApprovalItem['category']].includes(role)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
            <Select aria-label="审批状态" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-28 py-2.5 text-xs"><option value="pending">待审批</option><option value="approved">已通过</option><option value="rejected">已驳回</option><option value="all">全部</option></Select>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          {visible.length === 0 && <div className="py-16 text-center text-xs text-[#9CA3AF]">当前筛选下没有审批记录，调整类别或状态后重试</div>}
          {visible.map((item) => {
            const sla = urgency(item, now);
            return (
              <div key={item.approval_id} className="group flex flex-wrap items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[#F9FAFB] sm:flex-nowrap">
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', sla.urgent ? 'bg-rose-50 text-rose-600' : 'bg-[#F3F4F6] text-[#6B7280]')}><ClipboardCheck className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-xs font-semibold text-[#111827]">{item.title}</span><Badge tone={item.risk_level === 'critical' ? 'rose' : item.risk_level === 'high' ? 'orange' : 'slate'} dot={false}>{item.risk_level === 'critical' ? '致命风险' : item.risk_level === 'high' ? '高风险' : '中风险'}</Badge></div><p className="mt-1 truncate font-mono text-[10px] text-[#9CA3AF]">{item.approval_id} · {APPROVAL_LABELS[item.category]} · {item.target_id} · {item.applicant}</p></div>
                <div className="min-w-[110px]"><p className={cn('flex items-center gap-1 font-mono text-[10px] font-medium', sla.cls)}><Clock3 className="h-3 w-3" />{sla.text}</p>{item.amount_fen !== null && <p className="mt-1 font-mono text-[11px] font-semibold text-[#111827]">{formatFen(item.amount_fen)}</p>}</div>
                <div className="flex shrink-0 items-center gap-2"><Badge tone={item.status === 'pending' ? 'amber' : item.status === 'approved' ? 'emerald' : 'rose'}>{item.status === 'pending' ? '待审批' : item.status === 'approved' ? '已通过' : '已驳回'}</Badge><button type="button" onClick={() => open(item)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#111827] px-3 py-2 text-[11px] font-medium text-white hover:bg-[#242d3d]">{item.status === 'pending' ? '进入审批' : '查看记录'} <ArrowUpRight className="h-3 w-3" /></button></div>
              </div>
            );
          })}
        </div>
      </Card>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `${APPROVAL_LABELS[selected.category]} · ${selected.approval_id}` : '审批详情'} subtitle={selected ? `${selected.title} · ${selected.target_id}` : ''} size="lg" icon={<ClipboardCheck className="h-4 w-4" />} footer={selected?.status === 'pending' ? <><Button variant="secondary" onClick={() => setSelected(null)}>取消</Button><Button variant={decision === 'approved' ? 'success' : 'danger'} icon={decision === 'approved' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} onClick={submit}>确认{decision === 'approved' ? '通过' : '驳回'}</Button></> : <Button variant="primary" onClick={() => setSelected(null)}>关闭</Button>}>
        {selected && <div className="space-y-4">
          <div className="rounded-xl bg-[#F9FAFB] p-4"><div className="flex items-start gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /><div><p className="text-xs font-medium text-[#111827]">风险研判提示</p><p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">{selected.risk_note}</p></div></div></div>
          <div><p className="mb-2 text-xs font-medium text-[#374151]">审查材料（{selected.evidence.length} 项）</p><div className="grid gap-2 sm:grid-cols-2">{selected.evidence.map((e) => <div key={e} className="flex items-center gap-2 rounded-lg bg-[#F9FAFB] p-2.5 text-[11px] text-[#4B5563]"><FileText className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />{e}</div>)}</div></div>
          {selected.amount_fen !== null && <div className="rounded-xl bg-[#F9FAFB] px-4 py-3"><p className="text-[10px] text-[#9CA3AF]">关联金额</p><p className="mt-1 font-mono text-xl font-semibold text-[#111827]">{formatFen(selected.amount_fen)}</p></div>}
          {selected.status === 'pending' ? <>
            <div className="grid grid-cols-2 gap-2">{(['approved', 'rejected'] as const).map((d) => <button key={d} type="button" onClick={() => { setDecision(d); setError(''); }} className={cn('rounded-xl p-3 text-left text-xs font-medium transition-all', d === decision ? 'bg-[#111827] text-white' : 'bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6]')}>{d === 'approved' ? '通过：准入/放行' : '驳回：退回修改'}</button>)}</div>
            <label htmlFor="approval-reason" className="block text-xs font-medium text-[#374151]">裁决理由{decision === 'rejected' ? '（必填）' : '（可选）'}</label><Textarea id="approval-reason" rows={3} value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }} placeholder="填写具体的审批依据，结论将同步通知与审计日志" />{error && <p role="alert" className="text-[11px] text-rose-600">{error}</p>}
          </> : <div className="rounded-xl bg-[#F9FAFB] p-4 text-xs text-[#4B5563]"><p>裁决人：{selected.reviewer}</p><p className="mt-1">原因：{selected.decision_reason}</p><p className="mt-1 font-mono text-[10px] text-[#9CA3AF]">{selected.decided_at}</p></div>}
        </div>}
      </Modal>
    </div>
  );
};