import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, Clock3, Download, FileSpreadsheet, Files, LoaderCircle, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import type { ApprovalItem, AuditLog, BlacklistEntry, ExportJob, MerchantApplication, PaymentTransaction, RefundException, ReportKey, Role } from '../lib/types';
import type { Ticket } from '../lib/ops';
import { APPROVAL_ROLES, REPORT_TEMPLATES } from '../lib/platform';
import { Badge, Button, Card, PageHeader, SectionTitle, cn } from '../components/ui';

export interface ReportData {
  merchants: MerchantApplication[];
  transactions: PaymentTransaction[];
  refunds: RefundException[];
  blacklist: BlacklistEntry[];
  tickets: Ticket[];
  approvals: ApprovalItem[];
  logs: AuditLog[];
}

export const buildReport = (key: ReportKey, data: ReportData, role: Role): { headers: string[]; rows: string[][] } => {
  switch (key) {
    case 'merchant_applications': return { headers: ['申请单号', '商户号', '企业名称', '法人姓名', '法人手机', '风控分', '状态', '审查意见', '申请时间'], rows: data.merchants.map((m) => [m.application_no, m.merchant_no, m.company_name, `${m.legal_name[0]}**`, m.legal_phone_masked, String(m.risk_score), m.status, m.review_notes, m.applied_at]) };
    case 'transaction_daily': return { headers: ['微信支付单号', '商户单号', '商户号', '商户名称', '金额(元)', '退款(元)', '交易类型', '渠道', '状态', '支付时间'], rows: data.transactions.map((t) => [t.wechat_trade_no, t.merchant_trade_no, t.merchant_no, t.merchant_name, (t.amount_fen / 100).toFixed(2), (t.refund_fen / 100).toFixed(2), t.trade_type, t.pay_method, t.status, t.paid_at]) };
    case 'refund_exceptions': return { headers: ['退款单号', '交易单号', '商户号', '商户名称', '金额(元)', '失败代码', '失败原因', '重试次数', '状态'], rows: data.refunds.map((r) => [r.refund_no, r.trade_no, r.merchant_no, r.merchant_name, (r.amount_fen / 100).toFixed(2), r.reason_code, r.reason, String(r.retry_count), r.status]) };
    case 'blacklist': return { headers: ['名单编号', '维度', '主体值', '关联账号数', '加入原因', '来源', '操作人', '加入时间'], rows: data.blacklist.map((b) => [b.entry_id, b.dimension, b.value, String(b.related_accounts), b.reason, b.source, b.operator, b.added_at]) };
    case 'sla_monthly': return { headers: ['工单号', '类别', '主题', '发起人', '优先级', 'SLA(分)', '剩余(分)', '状态', '责任人', '创建时间'], rows: data.tickets.map((t) => [t.id, t.kind, t.title, t.requester, t.priority, String(t.slaMinutes), String(t.slaLeft), t.status, t.assignee, t.createdAt]) };
    case 'approval_audit': return { headers: ['审批编号', '类别', '标题', '发起人', '关联目标', '金额(元)', '风险等级', '结论', '裁决人', '理由', '裁决时间'], rows: data.approvals.filter((a) => APPROVAL_ROLES[a.category].includes(role)).map((a) => [a.approval_id, a.category, a.title, a.applicant, a.target_id, a.amount_fen == null ? '' : (a.amount_fen / 100).toFixed(2), a.risk_level, a.status, a.reviewer ?? '', a.decision_reason ?? '', a.decided_at ?? '']) };
  }
};

interface ExportCenterProps {
  role: Role;
  jobs: ExportJob[];
  onCreate: (key: ReportKey) => void;
  onDownload: (job: ExportJob) => void;
}

const JOB_LABELS: Record<ExportJob['status'], string> = { queued: '排队中', running: '生成中', completed: '可下载', failed: '失败', expired: '已过期' };

export const ExportCenterPage: React.FC<ExportCenterProps> = ({ role, jobs, onCreate, onDownload }) => {
  const [query, setQuery] = useState('');
  const templates = REPORT_TEMPLATES.filter((t) => t.roles.includes(role));
  const visibleJobs = useMemo(() => jobs.filter((job) => {
    const template = REPORT_TEMPLATES.find((t) => t.key === job.template_key);
    return template?.roles.includes(role) && (role === 'super_admin' || job.requested_role === role) && `${job.job_id} ${template.title} ${job.requested_by}`.toLowerCase().includes(query.toLowerCase());
  }), [jobs, role, query]);

  return <div className="space-y-5">
    <PageHeader eyebrow="Data / Export Center" title="导出中心" description="后台 Worker 异步生成 · 下载真实 CSV · 按角色限定报表范围 · 文件 7 天后过期" meta={<Badge tone="sky">{visibleJobs.filter((j) => j.status === 'running' || j.status === 'queued').length} 个任务生成中</Badge>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      { title: '可用模板', value: templates.length, icon: Files },
      { title: '生成中', value: visibleJobs.filter((j) => j.status === 'running' || j.status === 'queued').length, icon: LoaderCircle },
      { title: '已完成', value: visibleJobs.filter((j) => j.status === 'completed').length, icon: CheckCircle2 },
      { title: '已过期 / 失败', value: visibleJobs.filter((j) => j.status === 'failed' || j.status === 'expired').length, icon: Clock3 },
    ].map((m) => <Card key={m.title} className="flex items-start justify-between p-4"><div><p className="text-[11px] text-[#6B7280]">{m.title}</p><p className="mt-1.5 font-mono text-xl font-semibold text-[#111827]">{String(m.value).padStart(2, '0')}</p></div><m.icon className="h-4 w-4 text-[#B6BDC7]" /></Card>)}</div>

    <div><SectionTitle title="选择报表模板" subtitle="点击生成，数据从当前业务数据集获取；不同角色只看到授权范围" className="mb-3" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{templates.map((t) => <Card key={t.key} className="group flex flex-col p-4 transition-shadow hover:shadow-[0_5px_25px_rgba(15,23,42,0.08)]"><div className="flex items-start justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F9FAFB] text-[#4B5563] group-hover:bg-orange-50 group-hover:text-orange-600"><FileSpreadsheet className="h-4 w-4" /></div><Badge tone="slate" dot={false}>{t.domain}</Badge></div><h3 className="mt-3 text-[13px] font-semibold text-[#111827]">{t.title}</h3><p className="mt-1 min-h-8 text-[11px] leading-relaxed text-[#6B7280]">{t.description}</p><div className="mt-auto flex items-center justify-between pt-3"><span className="font-mono text-[9px] text-[#9CA3AF]">{t.code} · {t.fields} 字段</span><button type="button" onClick={() => onCreate(t.key)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#111827] px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-[#242d3d]"><ArrowDownToLine className="h-3 w-3" />生成报表</button></div></Card>)}</div></div>

    <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><SectionTitle title="导出任务" subtitle="任务离开当前页签后继续执行；生成完成即可下载 UTF-8 CSV" /><div className="relative"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" /><input aria-label="搜索导出任务" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索任务编号、模板" className="w-52 rounded-xl bg-[#F9FAFB] py-2.5 pl-9 pr-3 text-xs outline-none" /></div></div>
      {visibleJobs.length === 0 ? <div className="py-16 text-center"><FileSpreadsheet className="mx-auto h-6 w-6 text-[#D1D5DB]" /><p className="mt-2 text-xs text-[#9CA3AF]">还没有导出任务，选择上方模板开始生成</p></div> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[780px] border-collapse text-left"><thead><tr className="bg-[#F9FAFB] text-[10px] tracking-wider text-[#9CA3AF] uppercase"><th className="rounded-l-xl py-3 pl-4">任务 / 模板</th><th className="px-3 py-3">生成进度</th><th className="px-3 py-3">行数</th><th className="px-3 py-3">有效期</th><th className="px-3 py-3">状态</th><th className="rounded-r-xl py-3 pr-4 text-right">操作</th></tr></thead><tbody>{visibleJobs.map((j) => <tr key={j.job_id} className="hover:bg-[#F9FAFB]/80"><td className="py-3.5 pl-4"><p className="text-xs font-medium text-[#111827]">{REPORT_TEMPLATES.find((t) => t.key === j.template_key)?.title}</p><p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{j.job_id} · {j.requested_by}</p></td><td className="px-3 py-3.5"><div className="flex items-center gap-2"><div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#F3F4F6]"><div className={cn('h-full rounded-full transition-all duration-500', j.status === 'failed' ? 'bg-rose-500' : j.status === 'completed' ? 'bg-emerald-500' : 'bg-orange-400')} style={{ width: `${j.progress}%` }} /></div><span className="font-mono text-[10px] text-[#6B7280]">{j.progress}%</span></div></td><td className="px-3 py-3.5 font-mono text-[11px] text-[#374151]">{j.row_count.toLocaleString('zh-CN')}</td><td className="px-3 py-3.5 font-mono text-[10px] text-[#9CA3AF]">{j.expires_at.slice(0, 10)}</td><td className="px-3 py-3.5"><Badge tone={j.status === 'completed' ? 'emerald' : j.status === 'failed' ? 'rose' : j.status === 'expired' ? 'slate' : 'amber'}>{JOB_LABELS[j.status]}</Badge></td><td className="py-3.5 pr-4 text-right">{j.status === 'completed' ? <Button size="xs" variant="primary" icon={<Download className="h-3 w-3" />} onClick={() => onDownload(j)}>下载 CSV</Button> : j.status === 'failed' ? <Button size="xs" variant="secondary" icon={<RefreshCw className="h-3 w-3" />} onClick={() => onCreate(j.template_key)}>重试</Button> : <span className="text-[10px] text-[#9CA3AF]">{j.status === 'expired' ? '已过期' : 'Worker 处理中'}</span>}</td></tr>)}</tbody></table></div>}
      <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#F9FAFB] px-3 py-2 text-[10px] text-[#9CA3AF]"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />仅操作人及同角色授权人员可下载；生成任务和下载行为记录在审计日志。</p>
    </Card>
  </div>;
};