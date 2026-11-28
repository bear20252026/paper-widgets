import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  Filter,
  Landmark,
  MapPin,
  Play,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CopyButton,
  FormField,
  Modal,
  PageHeader,
  Pagination,
  Select,
  TextInput,
  Textarea,
  Tone,
  cn,
  downloadCsv,
  useToast,
} from '../components/ui';
import type { BeneficialOwner, MerchantApplication, MerchantStatus, Role } from '../lib/types';

const STATUS_META: Record<MerchantStatus, { label: string; tone: Tone }> = {
  pending_initial: { label: '待初审', tone: 'amber' },
  pending_review: { label: '待复审', tone: 'sky' },
  rejected: { label: '已驳回', tone: 'rose' },
  frozen: { label: '已冻结', tone: 'violet' },
  approved: { label: '已通过', tone: 'emerald' },
};

const CATEGORY_TREE = [
  {
    label: '电商零售',
    children: [
      { label: '品牌旗舰店', children: ['食品饮料', '服饰鞋包', '3C 数码', '家居日用'] },
      { label: '社交电商', children: ['直播店铺', '社区团购', '分销推广'] },
    ],
  },
  {
    label: '跨境电商',
    children: [
      { label: '进口贸易', children: ['美妆个护', '母婴食品', '保健营养'] },
      { label: '出口贸易', children: ['消费电子', '家居百货', '服饰配件'] },
    ],
  },
  {
    label: '数字服务',
    children: [
      { label: 'SaaS', children: ['企业服务', '协同办公', '数据工具'] },
      { label: '在线教育', children: ['职业培训', '课程订阅', '知识付费'] },
    ],
  },
  {
    label: '本地生活',
    children: [
      { label: '餐饮连锁', children: ['到店核销', '外卖配送', '团购套餐'] },
      { label: '到店服务', children: ['丽人美发', '休闲娱乐', '生活服务'] },
    ],
  },
  {
    label: '文化传媒',
    children: [
      { label: '视频号直播', children: ['直播带货', '品牌自播', 'MCN 机构'] },
      { label: '内容付费', children: ['专栏订阅', '会员服务', '数字内容'] },
    ],
  },
];

interface MerchantListProps {
  applications: MerchantApplication[];
  role: Role;
  onOpenDetail: (merchantNo: string) => void;
  onUpdateApplication: (merchantNo: string, status: MerchantStatus, notes: string, reviewer: string) => void;
}

interface MerchantFilters {
  merchantNo: string;
  company: string;
  legal: string;
  phone: string;
  status: string;
  startDate: string;
  endDate: string;
}

const EMPTY_FILTERS: MerchantFilters = {
  merchantNo: '',
  company: '',
  legal: '',
  phone: '',
  status: 'all',
  startDate: '',
  endDate: '',
};

export const MerchantListPage: React.FC<MerchantListProps> = ({
  applications,
  role,
  onOpenDetail,
  onUpdateApplication,
}) => {
  const { push } = useToast();
  const [draft, setDraft] = useState<MerchantFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<MerchantFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MerchantApplication | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [notes, setNotes] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const pageSize = 8;

  const counts = useMemo(
    () => ({
      all: applications.length,
      pending_initial: applications.filter((a) => a.status === 'pending_initial').length,
      pending_review: applications.filter((a) => a.status === 'pending_review').length,
      rejected: applications.filter((a) => a.status === 'rejected').length,
      frozen: applications.filter((a) => a.status === 'frozen').length,
    }),
    [applications]
  );

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      if (applied.merchantNo && !app.merchant_no.toLowerCase().includes(applied.merchantNo.toLowerCase())) return false;
      if (applied.company && !app.company_name.includes(applied.company.trim())) return false;
      if (applied.legal && !app.legal_name.includes(applied.legal.trim())) return false;
      if (applied.phone.trim()) {
        const digits = applied.phone.replace(/\D/g, '');
        const maskedHead = app.legal_phone_masked.slice(0, 3);
        const maskedTail = app.legal_phone_masked.slice(-4);
        const matched =
          app.legal_phone_masked.includes(applied.phone.trim()) ||
          (digits.length >= 3 && maskedHead === digits.slice(0, 3)) ||
          (digits.length >= 4 && maskedTail === digits.slice(-4));
        if (!matched) return false;
      }
      if (applied.status !== 'all' && app.status !== applied.status) return false;
      if (applied.startDate && app.applied_at.slice(0, 10) < applied.startDate) return false;
      if (applied.endDate && app.applied_at.slice(0, 10) > applied.endDate) return false;
      return true;
    });
  }, [applications, applied]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const applyFilters = () => {
    setApplied(draft);
    setPage(1);
    push({ title: '筛选条件已应用', description: '已按商户号、企业名称、法人、手机号与申请时间范围重新检索', tone: 'info' });
  };

  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  };

  const exportRows = () => {
    downloadCsv(
      'merchant-applications-20260224.csv',
      ['申请单号', '商户号', '企业名称', '法人姓名', '法人手机', '风控得分', '进件状态', '申请时间'],
      filtered.map((app) => [
        app.application_no,
        app.merchant_no,
        app.company_name,
        app.legal_name,
        app.legal_phone_masked,
        String(app.risk_score),
        STATUS_META[app.status].label,
        app.applied_at,
      ])
    );
    push({ title: `已导出 ${filtered.length} 条商户进件`, description: 'CSV 文件已按当前筛选条件生成', tone: 'success' });
  };

  const openReview = (merchant: MerchantApplication) => {
    setSelected(merchant);
    setDecision('approved');
    setNotes('');
    setDecisionError('');
  };

  const submitReview = () => {
    if (!selected) return;
    if (decision === 'rejected' && notes.trim().length < 8) {
      setDecisionError('驳回进件时必须填写不少于 8 个字的驳回原因');
      return;
    }
    const reviewer = role === 'super_admin' ? 'root（超级管理员）' : role === 'finance' ? '林清和（支付专员）' : '顾以宁（风控专员）';
    onUpdateApplication(selected.merchant_no, decision, notes.trim() || '资料核验通过，符合进件准入标准', reviewer);
    push({
      title: decision === 'approved' ? '进件审核已通过' : '进件申请已驳回',
      description: `${selected.company_name} · 状态已同步至商户中心`,
      tone: decision === 'approved' ? 'success' : 'error',
    });
    setSelected(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Payment Domain / Merchant Onboarding"
        title="商户进件审核"
        description="受理微信支付特约商户进件申请，完成企业资质、法人核验、股权穿透与合同签署全流程审查。"
        meta={<Badge tone="orange">{counts.pending_initial + counts.pending_review} 单待处理</Badge>}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Filter className="h-3.5 w-3.5 text-[#6B7280]" />}
              onClick={() => setShowFilters((prev) => !prev)}
            >
              {showFilters ? '收起筛选' : '展开筛选'}
            </Button>
            <Button variant="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={exportRows}>
              导出进件
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { key: 'all', label: '全部申请', value: counts.all, tone: 'dark' as Tone },
          { key: 'pending_initial', label: '待初审', value: counts.pending_initial, tone: 'amber' as Tone },
          { key: 'pending_review', label: '待复审', value: counts.pending_review, tone: 'sky' as Tone },
          { key: 'rejected', label: '已驳回', value: counts.rejected, tone: 'rose' as Tone },
          { key: 'frozen', label: '已冻结', value: counts.frozen, tone: 'violet' as Tone },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              const next = { ...draft, status: item.key };
              setDraft(next);
              setApplied(next);
              setPage(1);
            }}
            className={cn(
              'cursor-pointer rounded-2xl bg-white p-4 text-left transition-all',
              applied.status === item.key
                ? 'shadow-[0_0_0_2px_#111827,0_10px_24px_-12px_rgba(15,23,42,0.2)]'
                : 'shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_8px_20px_-12px_rgba(15,23,42,0.18)]'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#6B7280]">{item.label}</span>
              <Badge tone={item.tone} dot={false} className="font-mono">
                {item.key === 'all' ? 'ALL' : item.key.slice(0, 2).toUpperCase()}
              </Badge>
            </div>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-[#111827]">
              {String(item.value).padStart(2, '0')}
              <span className="ml-1 font-sans text-[11px] font-normal text-[#9CA3AF]">单</span>
            </p>
          </button>
        ))}
      </div>

      {showFilters && (
        <Card className="animate-page-enter p-5">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="商户号">
              <TextInput
                value={draft.merchantNo}
                onChange={(e) => setDraft({ ...draft, merchantNo: e.target.value })}
                placeholder="如 M2026022400189"
              />
            </FormField>
            <FormField label="企业名称">
              <TextInput
                value={draft.company}
                onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                placeholder="模糊匹配企业全称"
              />
            </FormField>
            <FormField label="法人姓名">
              <TextInput
                value={draft.legal}
                onChange={(e) => setDraft({ ...draft, legal: e.target.value })}
                placeholder="请输入法人姓名"
              />
            </FormField>
            <FormField label="法人手机号">
              <TextInput
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="支持后四位检索"
                inputMode="numeric"
              />
            </FormField>
            <FormField label="进件状态">
              <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                <option value="all">全部状态</option>
                <option value="pending_initial">待初审</option>
                <option value="pending_review">待复审</option>
                <option value="rejected">已驳回</option>
                <option value="frozen">已冻结</option>
                <option value="approved">已通过</option>
              </Select>
            </FormField>
            <FormField label="申请时间范围" hint="按自然日包含首尾" className="sm:col-span-2">
              <div className="flex items-center gap-1.5">
                <TextInput
                  type="date"
                  value={draft.startDate}
                  aria-label="申请开始时间"
                  onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                />
                <span className="shrink-0 text-[10px] text-[#9CA3AF]">至</span>
                <TextInput
                  type="date"
                  value={draft.endDate}
                  aria-label="申请结束时间"
                  onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                />
              </div>
            </FormField>
            <div className="flex items-end gap-2">
              <Button variant="primary" className="flex-1" icon={<Search className="h-3.5 w-3.5" />} onClick={applyFilters}>
                查询
              </Button>
              <Button variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5 text-[#6B7280]" />} onClick={resetFilters}>
                重置
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#111827]">进件申请列表</h3>
            <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 font-mono text-[10px] text-[#6B7280]">
              {filtered.length} records
            </span>
          </div>
          <p className="text-[11px] text-[#9CA3AF]">
            风控得分由设备指纹、企业涉诉、关联图谱与历史拒单率综合计算
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                <th className="rounded-l-xl py-3 pr-3 pl-4 font-medium">申请单号</th>
                <th className="px-3 py-3 font-medium">企业名称</th>
                <th className="px-3 py-3 font-medium">法人信息</th>
                <th className="px-3 py-3 font-medium">风控得分</th>
                <th className="px-3 py-3 font-medium">进件状态</th>
                <th className="px-3 py-3 font-medium">申请时间</th>
                <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((app) => {
                const meta = STATUS_META[app.status];
                const isHighRisk = app.risk_score > 80;
                return (
                  <tr key={app.merchant_no} className="group transition-colors hover:bg-[#F9FAFB]/80">
                    <td className="py-3.5 pr-3 pl-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10.5px] font-medium text-[#111827]">{app.application_no}</span>
                        <CopyButton value={app.application_no} />
                      </div>
                      <p className="mt-1 font-mono text-[9.5px] text-[#9CA3AF]">APP · 微信支付进件</p>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={app.company_short} tone="bg-[#111827]" size="sm" />
                        <div className="min-w-0">
                          <p className="max-w-[190px] truncate text-xs font-medium text-[#111827]">{app.company_name}</p>
                          <p className="mt-0.5 font-mono text-[9.5px] text-[#9CA3AF]">{app.merchant_no}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="text-xs font-medium text-[#111827]">{app.legal_name.slice(0, 1)}**</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{app.legal_phone_masked}</p>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex min-w-8 items-center justify-center rounded-md px-1.5 py-1 font-mono text-[11px] font-semibold',
                            isHighRisk ? 'bg-rose-600 text-white' : app.risk_score >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                          )}
                        >
                          {app.risk_score}
                        </span>
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#F3F4F6]">
                          <div
                            className={cn('h-full rounded-full', isHighRisk ? 'bg-rose-500' : app.risk_score >= 60 ? 'bg-amber-400' : 'bg-emerald-500')}
                            style={{ width: `${app.risk_score}%` }}
                          />
                        </div>
                      </div>
                      {isHighRisk && <p className="mt-1 text-[10px] text-rose-500">超过高危阈值 80</p>}
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <p className="mt-1.5 text-[10px] text-[#9CA3AF]">{app.risk_tags[0]}</p>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="font-mono text-[11px] text-[#4B5563]">{app.applied_at.slice(0, 10)}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{app.applied_at.slice(11)}</p>
                    </td>
                    <td className="py-3.5 pr-4 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {app.status === 'pending_initial' || app.status === 'pending_review' ? (
                          <button
                            type="button"
                            onClick={() => openReview(app)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#111827] px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[#242d3d]"
                          >
                            <FileCheck2 className="h-3 w-3" /> 审核
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelected(app)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#F3F4F6] px-2.5 py-1.5 text-[11px] font-medium text-[#6B7280] transition-colors hover:bg-[#E5E7EB]"
                          >
                            <FileCheck2 className="h-3 w-3" /> 复核
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenDetail(app.merchant_no)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
                        >
                          详情 <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Search className="mx-auto h-5 w-5 text-[#D1D5DB]" />
                    <p className="mt-2 text-xs text-[#9CA3AF]">未匹配到符合条件的进件申请，请调整检索条件</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `进件审核 · ${selected.company_short}` : '进件审核'}
        subtitle={selected ? `${selected.application_no} · 风控得分 ${selected.risk_score} · 申请时间 ${selected.applied_at}` : ''}
        icon={<FileCheck2 className="h-4 w-4" />}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              取消
            </Button>
            {selected?.status === 'pending_initial' || selected?.status === 'pending_review' ? (
              <Button variant={decision === 'approved' ? 'success' : 'danger'} onClick={submitReview}>
                {decision === 'approved' ? '确认通过进件' : '确认驳回申请'}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setSelected(null)}>
                关闭
              </Button>
            )}
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {selected.risk_tags.map((tag) => (
                <Badge key={tag} tone={selected.risk_score > 80 ? 'rose' : 'slate'}>
                  {tag}
                </Badge>
              ))}
              <Badge tone={STATUS_META[selected.status].tone}>{STATUS_META[selected.status].label}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#F9FAFB] p-4 text-xs sm:grid-cols-3">
              <div>
                <p className="text-[10px] text-[#9CA3AF]">企业全称</p>
                <p className="mt-1 font-medium text-[#111827]">{selected.company_name}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">统一社会信用代码</p>
                <p className="mt-1 font-mono text-[#111827]">{selected.business_license_no}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">注册资本</p>
                <p className="mt-1 font-mono text-[#111827]">{selected.registered_capital_wan} 万元</p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">法定代表人</p>
                <p className="mt-1 font-medium text-[#111827]">
                  {selected.legal_name} · {selected.legal_phone_masked}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">经营类目</p>
                <p className="mt-1 font-medium text-[#111827]">{selected.category_path.join(' / ')}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">结算账户</p>
                <p className="mt-1 font-medium text-[#111827]">
                  {selected.settlement.bank_name} · {selected.settlement.account_type === 'corporate' ? '对公' : '对私'}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-[#374151]">审核结论</p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDecision('approved')}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-xl p-3 text-left transition-all',
                    decision === 'approved' ? 'bg-emerald-50 shadow-[0_0_0_1.5px_#10B981]' : 'bg-[#F9FAFB] hover:bg-[#F3F4F6]'
                  )}
                >
                  <CheckCircle2 className={cn('h-4 w-4', decision === 'approved' ? 'text-emerald-600' : 'text-[#9CA3AF]')} />
                  <div>
                    <p className="text-xs font-medium text-[#111827]">通过准入</p>
                    <p className="mt-0.5 text-[10px] text-[#9CA3AF]">进入合同签署与账户开通</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('rejected')}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-xl p-3 text-left transition-all',
                    decision === 'rejected' ? 'bg-rose-50 shadow-[0_0_0_1.5px_#F43F5E]' : 'bg-[#F9FAFB] hover:bg-[#F3F4F6]'
                  )}
                >
                  <XCircle className={cn('h-4 w-4', decision === 'rejected' ? 'text-rose-600' : 'text-[#9CA3AF]')} />
                  <div>
                    <p className="text-xs font-medium text-[#111827]">驳回补充</p>
                    <p className="mt-0.5 text-[10px] text-[#9CA3AF]">退回商户补充或修正资料</p>
                  </div>
                </button>
              </div>
            </div>

            <FormField
              label={decision === 'approved' ? '审核意见（可选）' : '驳回原因'}
              hint={decision === 'approved' ? '将记录在进件档案' : '至少 8 个字'}
              error={decisionError}
            >
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  if (decisionError) setDecisionError('');
                }}
                placeholder={decision === 'approved' ? '资料核验通过，符合进件准入标准...' : '请说明证件模糊、经营范围不符或高风险命中项等具体原因...'}
              />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
};

/* ============================== 商户进件详情页 ============================== */

const TABS = [
  { key: 'company', label: '企业信息', icon: Building2 },
  { key: 'legal', label: '法人信息', icon: BadgeCheck },
  { key: 'beneficial', label: '受益人穿透', icon: Users },
  { key: 'settlement', label: '结算账户', icon: Landmark },
  { key: 'contract', label: '电子合同', icon: FileText },
];

const InfoRow: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="rounded-xl bg-[#F9FAFB] px-4 py-3.5">
    <p className="text-[10px] font-medium tracking-wide text-[#9CA3AF]">{label}</p>
    <div className={cn('mt-1.5 text-xs font-medium text-[#111827]', mono && 'font-mono')}>{value}</div>
  </div>
);

const OwnerTypeLabel: Record<BeneficialOwner['owner_type'], string> = {
  holding_company: '控股企业',
  natural_person: '自然人',
  partnership: '有限合伙',
};

interface MerchantDetailProps {
  application: MerchantApplication;
  onBack: () => void;
  onNotify: (title: string, description?: string) => void;
  onDecision: (status: MerchantStatus, notes: string) => void;
}

export const MerchantDetailPage: React.FC<MerchantDetailProps> = ({ application, onBack, onNotify, onDecision }) => {
  const [activeTab, setActiveTab] = useState('company');
  const [showId, setShowId] = useState(false);
  const [expandedOwners, setExpandedOwners] = useState<string[]>(
    application.beneficial_owners.flatMap((owner) => (owner.children ? [owner.owner_id, ...owner.children.map((c) => c.owner_id)] : [owner.owner_id]))
  );
  const [unionCode, setUnionCode] = useState(application.settlement.union_pay_code);
  const [unionValidation, setUnionValidation] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryPath, setCategoryPath] = useState(application.category_path);
  const [categoryDraft, setCategoryDraft] = useState(application.category_path);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [pdfOpen, setPdfOpen] = useState(false);

  useEffect(() => {
    if (!videoPlaying) return;
    const timer = window.setInterval(() => {
      setVideoProgress((prev) => {
        if (prev >= 100) {
          setVideoPlaying(false);
          return 100;
        }
        return prev + 2;
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [videoPlaying]);

  const meta = STATUS_META[application.status];
  const totalRatio = application.beneficial_owners.reduce((sum, owner) => sum + owner.ratio_percent, 0);

  const toggleOwner = (ownerId: string) => {
    setExpandedOwners((prev) => (prev.includes(ownerId) ? prev.filter((id) => id !== ownerId) : [...prev, ownerId]));
  };

  const renderOwnerRows = (owners: BeneficialOwner[], depth = 0): React.ReactNode[] =>
    owners.flatMap((owner) => {
      const rows: React.ReactNode[] = [
        <tr key={owner.owner_id} className="group transition-colors hover:bg-[#F9FAFB]/80">
          <td className="py-3.5 pl-4">
            <div className="flex items-center" style={{ paddingLeft: `${depth * 24}px` }}>
              {owner.children ? (
                <button
                  type="button"
                  onClick={() => toggleOwner(owner.owner_id)}
                  className="mr-1.5 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#111827]"
                  aria-label="展开或收起股东层级"
                >
                  <ChevronRight
                    className={cn('h-3.5 w-3.5 transition-transform', expandedOwners.includes(owner.owner_id) && 'rotate-90')}
                  />
                </button>
              ) : (
                <span className="mr-1.5 ml-5 h-px w-3 bg-[#E5E7EB]" />
              )}
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold',
                  owner.owner_type === 'natural_person' ? 'bg-orange-50 text-orange-600' : 'bg-[#111827] text-white'
                )}
              >
                {owner.name.slice(0, 1)}
              </span>
              <div className="ml-2.5">
                <p className="text-xs font-medium text-[#111827]">{owner.name}</p>
                <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{owner.id_no_masked}</p>
              </div>
            </div>
          </td>
          <td className="px-3 py-3.5">
            <span className="rounded-md bg-[#F3F4F6] px-2 py-1 text-[10px] text-[#4B5563]">{OwnerTypeLabel[owner.owner_type]}</span>
          </td>
          <td className="px-3 py-3.5">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#F3F4F6]">
                <div className="h-full rounded-full bg-[#111827]" style={{ width: `${owner.ratio_percent}%` }} />
              </div>
              <span className="font-mono text-[11px] font-semibold text-[#111827]">{owner.ratio_percent.toFixed(1)}%</span>
            </div>
          </td>
          <td className="px-3 py-3.5">
            {owner.is_ubo ? <Badge tone="orange">最终受益人 UBO</Badge> : <span className="text-[11px] text-[#9CA3AF]">非 UBO</span>}
          </td>
          <td className="px-3 py-3.5 text-[11px] text-[#6B7280]">{owner.region}</td>
          <td className="py-3.5 pr-4 pl-3 text-right">
            <button
              type="button"
              onClick={() => onNotify('股东材料核验', `${owner.name} 的持股证明与身份材料已通过交叉核验`)}
              className="cursor-pointer rounded-lg px-2 py-1 text-[10px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
            >
              核验材料
            </button>
          </td>
        </tr>,
      ];
      if (owner.children && expandedOwners.includes(owner.owner_id)) {
        rows.push(...renderOwnerRows(owner.children, depth + 1));
      }
      return rows;
    });

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回进件审核列表
      </button>

      <Card className="p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#111827] text-base font-semibold text-white shadow-[0_6px_18px_rgba(17,24,39,0.16)]">
              {application.company_short.slice(0, 2)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold tracking-tight text-[#111827]">{application.company_name}</h1>
                <Badge tone={meta.tone}>{meta.label}</Badge>
                {application.risk_score > 80 && <Badge tone="rose">高风控 {application.risk_score}</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#6B7280]">
                <span className="inline-flex items-center gap-1 font-mono">
                  {application.application_no} <CopyButton value={application.application_no} />
                </span>
                <span className="font-mono">商户号 {application.merchant_no}</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#9CA3AF]" /> {application.address}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="secondary" icon={<Download className="h-3.5 w-3.5 text-[#6B7280]" />} onClick={() => onNotify('进件档案导出中', '包含证照、法人、股权与合同附件，将生成加密压缩包')}>
              导出档案
            </Button>
            {application.status === 'pending_initial' || application.status === 'pending_review' ? (
              <>
                <Button variant="secondary" icon={<XCircle className="h-3.5 w-3.5 text-rose-500" />} onClick={() => onNotify('已发起驳回流程', '请在进件列表审核弹窗中补充驳回原因')}>
                  驳回
                </Button>
                <Button
                  variant="success"
                  icon={<Check className="h-3.5 w-3.5" />}
                  onClick={() => {
                    onDecision('approved', '资料核验通过，符合进件准入标准');
                    onNotify('进件已通过准入', `${application.company_short} 已进入合同签署与账户开通流程`);
                  }}
                >
                  通过进件
                </Button>
              </>
            ) : (
              <Button variant="primary" icon={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => onNotify('商户中心已打开', '即将跳转至商户资金账户与费率配置页面')}>
                进入商户中心
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#F3F4F6] pt-5 sm:grid-cols-4">
          {[
            { label: '风控综合得分', value: String(application.risk_score), hint: '阈值 80 高危', tone: application.risk_score > 80 ? 'text-rose-600' : 'text-[#111827]' },
            { label: '注册资本', value: `${application.registered_capital_wan} 万`, hint: '人民币实缴', tone: 'text-[#111827]' },
            { label: '持股穿透', value: `${totalRatio.toFixed(0)}%`, hint: '受益人合计', tone: totalRatio === 100 ? 'text-emerald-600' : 'text-rose-600' },
            { label: '申请时间', value: application.applied_at.slice(5, 10), hint: application.applied_at.slice(11, 16), tone: 'text-[#111827]' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-[#F9FAFB] px-4 py-3">
              <p className="text-[10px] text-[#9CA3AF]">{item.label}</p>
              <p className={cn('mt-1 font-mono text-lg font-semibold tracking-tight', item.tone)}>{item.value}</p>
              <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{item.hint}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-all',
                active
                  ? 'bg-white text-[#111827] shadow-[0_2px_10px_rgba(15,23,42,0.08)]'
                  : 'text-[#6B7280] hover:bg-white/70 hover:text-[#111827]'
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', active ? 'text-orange-500' : 'text-[#9CA3AF]')} />
              {tab.label}
              {active && <span className="ml-1 h-1 w-1 rounded-full bg-orange-500" />}
            </button>
          );
        })}
      </div>

      {activeTab === 'company' && (
        <div className="animate-page-enter grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="p-6 xl:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">企业主体信息</h3>
                <p className="mt-1 text-[11px] text-[#9CA3AF]">工商登记数据已通过国家企业信用信息公示系统核验</p>
              </div>
              <Badge tone="emerald">工商核验通过</Badge>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoRow label="企业全称" value={application.company_name} />
              <InfoRow label="统一社会信用代码" value={application.business_license_no} mono />
              <InfoRow label="注册资本" value={<span className="font-mono">{application.registered_capital_wan} 万元人民币</span>} />
              <InfoRow label="成立日期" value={<span className="font-mono">{application.established_at}</span>} mono />
              <InfoRow label="企业类型" value={application.company_type} />
              <InfoRow label="营业执照有效期" value={<span className="font-mono">{application.business_license_expire}</span>} />
              <InfoRow label="注册地址" value={application.address} />
              <InfoRow label="联系人" value={`${application.contact_name} · ${application.contact_phone}`} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2.5 rounded-2xl bg-[#F9FAFB] p-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] text-[#9CA3AF]">营业执照 OCR 解析</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />与填报一致 · 置信度 99.2%</p>
                <p className="mt-0.5 font-mono text-[9px] text-[#9CA3AF]">OCR：{application.business_license_no}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">营业期限校验</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />有效 · 剩余 3,656 天</p>
                <p className="mt-0.5 font-mono text-[9px] text-[#9CA3AF]">过期将自动拦截进件</p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">国家统计局 4 级代码</p>
                <p className="mt-1 font-mono text-[11px] font-semibold text-[#111827]">5292 · 5263 · 5193 · 5299</p>
                <p className="mt-0.5 text-[9px] text-[#9CA3AF]">精确到小类，已映射费率</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-medium tracking-wide text-[#9CA3AF]">经营范围</p>
              <p className="mt-1.5 rounded-xl bg-[#F9FAFB] px-4 py-3 text-xs leading-relaxed text-[#4B5563]">
                {application.business_scope}
              </p>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#111827]">经营类目（4 级级联）</h3>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryDraft(categoryPath);
                    setCategoryModalOpen(true);
                  }}
                  className="cursor-pointer text-[11px] font-medium text-orange-600 hover:text-orange-700"
                >
                  变更类目
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {categoryPath.map((level, index) => (
                  <div key={level} className="flex items-center gap-2.5 rounded-xl bg-[#F9FAFB] px-3.5 py-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white font-mono text-[10px] text-[#9CA3AF] shadow-xs">
                      {index + 1}
                    </span>
                    <span className="text-xs font-medium text-[#111827]">{level}</span>
                    {index < categoryPath.length - 1 && <ChevronRight className="ml-auto h-3 w-3 text-[#D1D5DB]" />}
                    {index === categoryPath.length - 1 && <Badge tone="emerald" className="ml-auto">准入</Badge>}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div
                className="relative h-44 w-full"
                style={{
                  backgroundColor: '#F3F4F6',
                  backgroundImage:
                    'linear-gradient(#E5E7EB 1px, transparent 1px), linear-gradient(90deg, #E5E7EB 1px, transparent 1px), linear-gradient(120deg, #EEF2F6 0%, #F8FAFC 60%, #EFF6FF 100%)',
                  backgroundSize: '28px 28px, 28px 28px, 100% 100%',
                }}
              >
                <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111827] text-white shadow-[0_6px_16px_rgba(17,24,39,0.3)]">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span className="mt-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium text-[#111827] shadow-sm">
                    {application.company_short}
                  </span>
                </div>
                <div className="absolute right-3 bottom-3 rounded-lg bg-white/95 px-2.5 py-1.5 font-mono text-[10px] text-[#6B7280] shadow-sm">
                  {application.location.lat.toFixed(4)}, {application.location.lng.toFixed(4)}
                </div>
              </div>
              <div className="p-4">
                <p className="text-[10px] font-medium tracking-wide text-[#9CA3AF]">企业实际经营地址</p>
                <p className="mt-1 text-xs leading-relaxed text-[#374151]">{application.address}</p>
                <button
                  type="button"
                  onClick={() => onNotify('已唤起地图核验', `正在核验 ${application.company_short} 的实际经营地址与注册地址一致性`)}
                  className="mt-2 inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-orange-600 hover:text-orange-700"
                >
                  实勘地址核验 <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            </Card>
          </div>

          <Card className="p-6 xl:col-span-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">进件材料清单</h3>
              <span className="text-[11px] text-[#9CA3AF]">共 {application.documents.length} 份 · 已 AI OCR 核验</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {application.documents.map((doc) => (
                <button
                  key={doc.name}
                  type="button"
                  onClick={() => onNotify('材料预览', `${doc.name} · 已通过 OCR 与防伪水印核验`)}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl bg-[#F9FAFB] p-3.5 text-left transition-colors hover:bg-[#F3F4F6]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#6B7280] shadow-xs group-hover:text-orange-500">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-[#111827]">{doc.name}</p>
                    <p className="mt-0.5 text-[10px] text-[#9CA3AF]">
                      {doc.type} · {doc.size}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'legal' && (
        <div className="animate-page-enter grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="p-6 xl:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">法定代表人身份核验</h3>
                <p className="mt-1 text-[11px] text-[#9CA3AF]">身份证信息与公安部 NCIIC 实名库比对一致</p>
              </div>
              <Badge tone="emerald">四要素核验通过</Badge>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoRow label="法人姓名" value={application.legal_name} />
              <InfoRow label="法人手机号" value={<span className="font-mono">{application.legal_phone_masked}</span>} />
              <div className="rounded-xl bg-[#F9FAFB] px-4 py-3.5">
                <p className="text-[10px] font-medium tracking-wide text-[#9CA3AF]">身份证号码（掩码显示）</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium text-[#111827]">
                    {showId ? application.legal_id_plain : application.legal_id_masked}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowId((prev) => !prev)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[#6B7280] transition-colors hover:bg-white hover:text-[#111827]"
                  >
                    {showId ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showId ? '隐藏' : '显示'}
                  </button>
                </div>
              </div>
              <InfoRow label="法人邮箱" value={application.legal_email} mono />
              <InfoRow label="证件有效期" value="2022-04-18 至 2042-04-18" mono />
              <InfoRow label="实名认证时间" value={application.applied_at} mono />
            </div>
            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-emerald-50/70 p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-medium text-emerald-900">法人身份未被列入失信被执行人名单</p>
                <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/80">
                  已完成最高法失信名单、涉诉信息、税务非正常户与公安在逃人员库的多源交叉核验，核验批次 NCIIC-20260224-0091。
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">活体检测视频</h3>
              <Badge tone="emerald">已通过</Badge>
            </div>
            <div className="relative mt-4 overflow-hidden rounded-2xl bg-[#111827]">
              <div className="flex h-44 flex-col items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#334155_0%,#0f172a_60%)]">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                  <Users className="h-7 w-7 text-white/80" />
                </div>
                <span className="mt-2 font-mono text-[10px] text-gray-400">LIVENESS-20260224-7731</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVideoModalOpen(true);
                  setVideoPlaying(true);
                  setVideoProgress(0);
                }}
                className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
                aria-label="回放活体检测视频"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#111827] shadow-lg transition-transform hover:scale-105">
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                </span>
              </button>
              <div className="absolute right-3 bottom-3 rounded-md bg-black/50 px-2 py-0.5 font-mono text-[10px] text-white">
                00:08
              </div>
            </div>
            <div className="mt-4 space-y-2.5">
              {[
                { label: '活体动作随机指令', value: '眨眼 + 转头 + 读数', ok: true },
                { label: '人脸比对相似度', value: '98.7%', ok: true },
                { label: '检测设备', value: 'iPhone 15 Pro · 前置', ok: true },
                { label: '视频哈希上链', value: '0x8f42...a91c', ok: true },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-[11px]">
                  <span className="text-[#6B7280]">{row.label}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[#111827]">
                    {row.value}
                    {row.ok && <Check className="h-3 w-3 text-emerald-500" />}
                  </span>
                </div>
              ))}
            </div>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              icon={<Play className="h-3.5 w-3.5" />}
              onClick={() => {
                setVideoModalOpen(true);
                setVideoPlaying(true);
                setVideoProgress(0);
              }}
            >
              回放活体检测
            </Button>
          </Card>
        </div>
      )}

      {activeTab === 'beneficial' && (
        <div className="animate-page-enter space-y-4">
          <Card
            className={cn(
              'flex flex-wrap items-center justify-between gap-3 p-4',
              totalRatio === 100 ? 'bg-emerald-50/70' : 'bg-rose-50/70'
            )}
          >
            <div className="flex items-center gap-2.5">
              {totalRatio === 100 ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-rose-600" />
              )}
              <p className="text-xs font-medium text-[#111827]">
                第一层股东持股比例合计 <span className="font-mono">{totalRatio.toFixed(2)}%</span>
                {totalRatio === 100 ? ' · 比例校验通过' : ' · 比例异常，禁止提交'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[#6B7280]">最终受益人识别：</span>
              <Badge tone="orange">3 名 UBO</Badge>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card className="flex items-start gap-2.5 bg-amber-50/60 p-4">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-[11px] font-semibold text-amber-900">UBO 补充材料提醒（持股 &gt;25%）</p>
                <p className="mt-1 text-[10px] leading-relaxed text-amber-800">星野数字科技集团（55%）、陈默远（30%）已触发 UBO 认定，需补充：① UBO 身份证 / 护照 ② 持股证明 ③ 资金来源声明。材料缺失将阻塞复审。</p>
              </div>
            </Card>
            <Card className="flex items-start gap-2.5 bg-emerald-50/60 p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-[11px] font-semibold text-emerald-900">AML 黑名单碰撞：通过</p>
                <p className="mt-1 text-[10px] leading-relaxed text-emerald-800">5 个持股主体已碰撞反洗钱黑库、涉诉库与制裁名单（OFAC / UN），0 命中。碰撞批次 AML-20260224-3318。</p>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">股权穿透树形明细</h3>
                <p className="mt-1 text-[11px] text-[#9CA3AF]">
                  依据《企业信息公示暂行条例》按持股比例穿透计算，标记最终受益所有人（≥ 25%）
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="slate">共 5 个持股主体</Badge>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setExpandedOwners(
                      expandedOwners.length > 0
                        ? []
                        : application.beneficial_owners.flatMap((owner) => (owner.children ? [owner.owner_id, ...owner.children.map((c) => c.owner_id)] : [owner.owner_id]))
                    );
                  }}
                >
                  {expandedOwners.length > 0 ? '全部收起' : '展开全部'}
                </Button>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                    <th className="rounded-l-xl py-3 pr-3 pl-4 font-medium">股东 / 持股主体</th>
                    <th className="px-3 py-3 font-medium">主体类型</th>
                    <th className="px-3 py-3 font-medium">持股比例</th>
                    <th className="px-3 py-3 font-medium">最终受益人</th>
                    <th className="px-3 py-3 font-medium">所在地区</th>
                    <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">材料</th>
                  </tr>
                </thead>
                <tbody>{renderOwnerRows(application.beneficial_owners)}</tbody>
                <tfoot>
                  <tr className="bg-[#F9FAFB]">
                    <td className="rounded-l-xl py-3 pl-4 text-xs font-semibold text-[#111827]">第一层股东合计</td>
                    <td />
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-[#111827]">{totalRatio.toFixed(2)}%</td>
                    <td colSpan={3} className="pr-4 text-right text-[11px] text-[#6B7280]">
                      穿透后最终自然人受益合计 50.00%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'settlement' && (
        <div className="animate-page-enter grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="p-6 xl:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">结算账户信息</h3>
                <p className="mt-1 text-[11px] text-[#9CA3AF]">用于微信支付交易资金清分与 T+1 自动结算</p>
              </div>
              <Badge tone={unionValidation === 'valid' ? 'emerald' : 'amber'}>
                {unionValidation === 'valid' ? '联行号校验通过' : '待复核联行号'}
              </Badge>
            </div>

            <div className="mt-4 rounded-2xl bg-[linear-gradient(125deg,#111827_0%,#1f2937_60%,#334155_100%)] p-5 text-white shadow-[0_10px_30px_rgba(15,23,42,0.2)]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-orange-400" />
                  <span className="text-xs font-medium">{application.settlement.bank_name}</span>
                </div>
                <Badge tone="dark" dot={false} className="bg-white/10 text-white">
                  {application.settlement.account_type === 'corporate' ? '对公账户' : '对私账户'}
                </Badge>
              </div>
              <p className="mt-6 font-mono text-lg tracking-[0.14em] text-white">{application.settlement.account_no_masked}</p>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="text-[9px] tracking-wider text-gray-400 uppercase">Account Holder</p>
                  <p className="mt-0.5 text-xs font-medium">{application.settlement.account_holder}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] tracking-wider text-gray-400 uppercase">Branch</p>
                  <p className="mt-0.5 text-[11px]">{application.settlement.branch_name}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoRow label="开户类型" value={application.settlement.account_type === 'corporate' ? '对公账户' : '对私账户'} />
              <InfoRow label="开户人 / 户名" value={application.settlement.account_holder} />
              <InfoRow label="开户省份" value={application.settlement.province} />
              <InfoRow label="开户城市" value={application.settlement.city} />
              <InfoRow label="开户支行全称" value={application.settlement.branch_name} />
              <InfoRow label="超级网银联行号" value={<span className="font-mono">{application.settlement.union_pay_code}</span>} />
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-[#111827]">联行号实时校验</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
                请输入 12 位超级网银联行号，系统将实时核验开户行归属与支行状态。
              </p>
              <div className="mt-4 space-y-3">
                <FormField
                  label="超级网银联行号"
                  hint="12 位数字"
                  error={unionValidation === 'invalid' ? '联行号格式不正确，必须为 12 位纯数字' : undefined}
                >
                  <TextInput
                    value={unionCode}
                    maxLength={12}
                    inputMode="numeric"
                    onChange={(e) => {
                      setUnionCode(e.target.value.replace(/\D/g, '').slice(0, 12));
                      setUnionValidation('idle');
                    }}
                    className="font-mono tracking-[0.18em]"
                  />
                </FormField>
                <Button
                  variant="primary"
                  className="w-full"
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  onClick={() => {
                    const valid = /^\d{12}$/.test(unionCode);
                    setUnionValidation(valid ? 'valid' : 'invalid');
                    onNotify(valid ? '联行号校验通过' : '联行号校验失败', valid ? `${application.settlement.bank_name}${application.settlement.branch_name}` : '请输入 12 位超级网银联行号后重试');
                  }}
                >
                  校验联行号
                </Button>
                {unionValidation === 'valid' && (
                  <div className="rounded-xl bg-emerald-50 p-3.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" /> 清算行号有效
                    </p>
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-emerald-700">
                      {unionCode} · {application.settlement.bank_name}
                      {application.settlement.branch_name}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#111827]">开户许可 + 小额打款验证</h3>
                <Badge tone="emerald">已验证</Badge>
              </div>
              <div className="mt-3 space-y-2 text-[11px]">
                <div className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2"><span className="text-[#6B7280]">开户许可证 OCR</span><span className="font-medium text-emerald-600">一致 · 99.6%</span></div>
                <div className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2"><span className="text-[#6B7280]">小额打款（0.13 元）</span><span className="font-medium text-emerald-600">已回填确认</span></div>
                <div className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2"><span className="text-[#6B7280]">银行四要素</span><span className="font-medium text-[#111827]">户名/卡号/证件/手机一致</span></div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#6B7280]" />
                <h3 className="text-xs font-semibold text-[#111827]">账户变更风控提示</h3>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[#6B7280]">
                该商户近 90 天内未发生结算账户变更。若需变更账户，将触发人工复核并暂停自动结算 24 小时。
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => onNotify('账户变更申请已创建', '需要商户法人重新完成人脸核验与银行四要素校验')}
              >
                发起账户变更
              </Button>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'contract' && (
        <div className="animate-page-enter grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="p-6 xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">电子合同签署状态</h3>
                <p className="mt-1 font-mono text-[11px] text-[#9CA3AF]">{application.contract.contract_no}</p>
              </div>
              <Badge
                tone={
                  application.contract.status === 'signed'
                    ? 'emerald'
                    : application.contract.status === 'signing'
                      ? 'amber'
                      : application.contract.status === 'expired'
                        ? 'slate'
                        : 'rose'
                }
              >
                {application.contract.status === 'signed'
                  ? '已签署生效'
                  : application.contract.status === 'signing'
                    ? '待签署'
                    : application.contract.status === 'expired'
                      ? '已过期'
                      : '已作废'}
              </Badge>
            </div>

            <div className="mt-4 rounded-xl bg-[#F9FAFB] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#111827]">{application.contract.title}</p>
                <span className="rounded-md bg-white px-2 py-1 font-mono text-[9px] text-[#6B7280] shadow-xs">模板 T-2026-STD-04 · v4</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] text-[#9CA3AF]">签署方</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#374151]">
                    {application.contract.signatories.join(' / ')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#9CA3AF]">合同有效期</p>
                  <p className="mt-1 font-mono text-[11px] text-[#374151]">
                    {application.contract.signed_at ?? '待签署'} ~ {application.contract.expire_at}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#9CA3AF]">法人 CA 签名校验</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" />CA 有效 · 意愿认证通过</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#9CA3AF]">签约全流程存证</p>
                  <p className="mt-1 font-mono text-[10px] text-[#374151]">蚂蚁链 #48,219,703 · 哈希已固化</p>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium text-[#374151]">签署流程</p>
              <div className="mt-3 space-y-0">
                {[
                  { title: '发起合同签署', date: application.applied_at, done: true, desc: '平台已生成标准电子合同并发送商户' },
                  { title: '企业法人签章', date: application.contract.signed_at ?? '待完成', done: Boolean(application.contract.signed_at), desc: '法人通过微信电子签完成意愿认证' },
                  { title: '平台审核签章', date: application.contract.signed_at ?? '待完成', done: Boolean(application.contract.signed_at), desc: '财付通支付科技有限公司合同专用章' },
                  { title: '合同生效归档', date: application.contract.status === 'signed' ? application.contract.expire_at : '待生效', done: application.contract.status === 'signed', desc: '同步至区块链存证，支持司法调证' },
                ].map((step, index, arr) => (
                  <div key={step.title} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                          step.done ? 'bg-emerald-500 text-white' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                        )}
                      >
                        {step.done ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </span>
                      {index < arr.length - 1 && <span className={cn('h-9 w-px', step.done ? 'bg-emerald-200' : 'bg-[#E5E7EB]')} />}
                    </div>
                    <div className="pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11px] font-medium text-[#111827]">{step.title}</p>
                        <span className="font-mono text-[10px] text-[#9CA3AF]">{step.date}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-6">
              <FileCheck2 className="h-7 w-7 text-orange-500" />
              <h3 className="mt-3 text-sm font-semibold text-[#111827]">合同 PDF 在线预览</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
                支持在线预览加盖 CA 数字签章的 PDF 合同原文，下载文件附带可信时间戳。
              </p>
              <Button variant="primary" className="mt-4 w-full" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => setPdfOpen(true)}>
                预览电子合同
              </Button>
              <Button
                variant="secondary"
                className="mt-2 w-full"
                icon={<Download className="h-3.5 w-3.5 text-[#6B7280]" />}
                onClick={() => onNotify('合同下载任务已创建', '文件将在 1 分钟内生成并自动下载，已同步区块链存证哈希')}
              >
                下载 PDF
              </Button>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-semibold text-[#111827]">区块链存证</p>
              </div>
              <p className="mt-2 font-mono text-[10px] leading-relaxed break-all text-[#6B7280]">
                TX 0x7b3f9a2c...e4d810c6
                <br />
                Block #48,219,703
              </p>
              <p className="mt-2 text-[10px] text-[#9CA3AF]">存证时间 2026-02-24 10:42:18 · 蚂蚁链</p>
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="变更经营类目"
        subtitle="请按一级 / 二级 / 三级依次选择准确的经营范围，变更将触发合规复核"
        icon={<Building2 className="h-4 w-4" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCategoryModalOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setCategoryPath(categoryDraft);
                setCategoryModalOpen(false);
                onNotify('经营类目已更新', `新类目：${categoryDraft.join(' / ')}，已进入合规复核队列`);
              }}
            >
              保存类目
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label="一级类目" required>
            <Select
              value={categoryDraft[0]}
              onChange={(e) => {
                const nextL1 = CATEGORY_TREE.find((c) => c.label === e.target.value) ?? CATEGORY_TREE[0];
                const nextL2 = nextL1.children[0];
                setCategoryDraft([nextL1.label, nextL2.label, nextL2.children[0]]);
              }}
            >
              {CATEGORY_TREE.map((level1) => (
                <option key={level1.label} value={level1.label}>
                  {level1.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="二级类目" required>
            <Select
              value={categoryDraft[1]}
              onChange={(e) => {
                const level1 = CATEGORY_TREE.find((c) => c.label === categoryDraft[0]) ?? CATEGORY_TREE[0];
                const level2 = level1.children.find((c) => c.label === e.target.value) ?? level1.children[0];
                setCategoryDraft([categoryDraft[0], level2.label, level2.children[0]]);
              }}
            >
              {(CATEGORY_TREE.find((c) => c.label === categoryDraft[0]) ?? CATEGORY_TREE[0]).children.map((level2) => (
                <option key={level2.label} value={level2.label}>
                  {level2.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="三级类目" required>
            <Select
              value={categoryDraft[2]}
              onChange={(e) => setCategoryDraft([categoryDraft[0], categoryDraft[1], e.target.value])}
            >
              {(
                (CATEGORY_TREE.find((c) => c.label === categoryDraft[0]) ?? CATEGORY_TREE[0]).children.find(
                  (c) => c.label === categoryDraft[1]
                ) ?? (CATEGORY_TREE.find((c) => c.label === categoryDraft[0]) ?? CATEGORY_TREE[0]).children[0]
              ).children.map((level3) => (
                <option key={level3} value={level3}>
                  {level3}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="mt-4 rounded-xl bg-[#F9FAFB] p-4">
          <p className="text-[10px] text-[#9CA3AF]">当前选定类目路径</p>
          <p className="mt-1 text-xs font-medium text-[#111827]">{categoryDraft.join('  /  ')}</p>
        </div>
      </Modal>

      <Modal
        open={videoModalOpen}
        onClose={() => {
          setVideoModalOpen(false);
          setVideoPlaying(false);
        }}
        title="法人活体检测回放"
        subtitle={`${application.legal_name} · 检测时间 ${application.applied_at} · 设备 iPhone 15 Pro`}
        icon={<Play className="h-4 w-4" />}
        size="md"
        footer={
          <>
            <Badge tone="emerald">活体通过 · 相似度 98.7%</Badge>
            <Button variant="primary" onClick={() => setVideoModalOpen(false)}>
              关闭回放
            </Button>
          </>
        }
      >
        <div className="overflow-hidden rounded-2xl bg-[#0B1220]">
          <div className="relative flex h-64 items-center justify-center bg-[radial-gradient(circle_at_50%_30%,#334155_0%,#0b1220_75%)]">
            <div className="relative flex h-32 w-24 flex-col items-center justify-center rounded-[45%] bg-slate-700/50">
              <div className="h-14 w-14 rounded-full bg-slate-500/50" />
              <div className="mt-1 flex gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
            </div>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', videoPlaying ? 'animate-pulse bg-rose-500' : 'bg-gray-500')} />
              <span className="font-mono text-[10px] text-white">{videoPlaying ? 'PLAYBACK' : 'PAUSED'}</span>
            </div>
            <div className="absolute right-3 bottom-3 rounded-md bg-black/50 px-2 py-1 font-mono text-[10px] text-white">
              00:{String(Math.floor((videoProgress / 100) * 8)).padStart(2, '0')} / 00:08
            </div>
            <button
              type="button"
              onClick={() => {
                if (videoProgress >= 100) setVideoProgress(0);
                setVideoPlaying((prev) => !prev);
              }}
              className="absolute bottom-3 left-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-[#111827] hover:scale-105"
              aria-label={videoPlaying ? '暂停' : '播放'}
            >
              <Play className={cn('h-3.5 w-3.5 fill-current', videoPlaying && 'hidden')} />
              {videoPlaying && <span className="flex gap-0.5"><span className="h-3 w-1 rounded-sm bg-current" /><span className="h-3 w-1 rounded-sm bg-current" /></span>}
            </button>
          </div>
          <div className="px-4 pt-3 pb-4">
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${videoProgress}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {['眨眼检测', '转头检测', '读数检测'].map((label, index) => (
                <div key={label} className="rounded-lg bg-white/5 px-2.5 py-2">
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> {videoProgress > (index + 1) * 22 ? '通过' : '检测中'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        title="电子合同在线预览"
        subtitle={`${application.contract.contract_no} · ${application.contract.title}`}
        icon={<FileText className="h-4 w-4" />}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPdfOpen(false)}>
              关闭
            </Button>
            <Button
              variant="primary"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={() => onNotify('PDF 下载已开始', `${application.contract.contract_no}.pdf · 已包含数字签章与时间戳`)}
            >
              下载合同 PDF
            </Button>
          </>
        }
      >
        <div className="mx-auto max-w-2xl rounded-xl bg-[#F3F4F6] p-4">
          <div className="rounded-lg bg-white px-8 py-7 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#111827] text-[10px] font-bold text-white">微</div>
                <span className="text-[11px] font-semibold text-[#111827]">微信支付 · 商户服务</span>
              </div>
              <span className="font-mono text-[9px] text-[#9CA3AF]">{application.contract.contract_no}</span>
            </div>
            <h2 className="mt-5 text-center text-sm font-semibold tracking-wide text-[#111827]">
              {application.contract.title}
            </h2>
            <div className="mt-4 space-y-2 text-[10px] leading-relaxed text-[#4B5563]">
              <p>
                <span className="font-medium text-[#111827]">甲方（商户）：</span>
                {application.company_name}
              </p>
              <p>
                <span className="font-medium text-[#111827]">乙方（支付机构）：</span>
                财付通支付科技有限公司
              </p>
              <div className="mt-3 space-y-2 border-t border-[#F3F4F6] pt-3">
                <p>
                  <span className="font-medium text-[#111827]">第一条 服务内容：</span>
                  乙方为甲方提供微信支付特约商户收单、资金结算、交易查询及对账服务，甲方应保证所提交的进件资料真实、完整、有效。
                </p>
                <p>
                  <span className="font-medium text-[#111827]">第二条 结算规则：</span>
                  交易资金按 T+1 周期自动结算至甲方指定账户，最低结算金额为人民币 100 元。若触发风控规则，乙方有权延迟结算并要求甲方补充材料。
                </p>
                <p>
                  <span className="font-medium text-[#111827]">第三条 商户义务：</span>
                  甲方不得将支付接口出租、出借或用于非法交易，不得实施虚假交易、洗钱、电信网络诈骗等违法行为，否则乙方有权冻结资金并终止服务。
                </p>
                <p>
                  <span className="font-medium text-[#111827]">第四条 费率与争议：</span>
                  手续费率按双方另行签署的补充协议执行。因本合同引发的争议，双方应协商解决；协商不成的，提交乙方所在地有管辖权的人民法院诉讼解决。
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-end justify-between border-t border-[#F3F4F6] pt-4">
              <div className="space-y-1 text-[9px] text-[#6B7280]">
                <p>甲方（盖章）：{application.company_short}</p>
                <p>授权代表：{application.legal_name}</p>
                <p className="font-mono">签署日期：{application.contract.signed_at ?? '待签署'}</p>
              </div>
              <div className="flex h-16 w-16 rotate-[-8deg] flex-col items-center justify-center rounded-full border-2 border-rose-500/70 text-center">
                <span className="text-[7px] font-semibold text-rose-600">财付通支付科技</span>
                <span className="text-[7px] text-rose-500">合同专用章</span>
                <span className="mt-0.5 font-mono text-[6px] text-rose-400">2026.02.24</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};


