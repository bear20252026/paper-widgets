import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BadgePercent,
  Banknote,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileWarning,
  Gift,
  HandCoins,
  Landmark,
  Pause,
  PhoneCall,
  Play,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldAlert,
  Siren,
  TicketPercent,
  Wallet,
  Wrench,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card, Modal, PageHeader, Pagination, SectionTitle, Tone, cn, downloadCsv, useToast } from '../components/ui';
import { ENTERPRISE_PAYS, LEDGER_GAPS, SPLIT_RULES, VOUCHER_BATCHES, WITHDRAWALS, formatFen } from '../lib/ops';
import type { LedgerGap, SplitRule, VoucherBatch, Withdrawal } from '../lib/ops';

/* ============================ 资金清结算 ============================ */

const WD_STATUS: Record<Withdrawal['status'], { label: string; tone: Tone }> = {
  queued: { label: '排队中', tone: 'slate' },
  verifying: { label: '电核中', tone: 'amber' },
  paying: { label: '代付中', tone: 'sky' },
  success: { label: '已到账', tone: 'emerald' },
  failed: { label: '失败', tone: 'rose' },
};

const GAP_KIND: Record<LedgerGap['kind'], { label: string; tone: Tone }> = {
  long: { label: '长款', tone: 'sky' },
  short: { label: '短款', tone: 'amber' },
  single: { label: '单边账', tone: 'rose' },
};

export const SettlementPage: React.FC = () => {
  const { push } = useToast();
  const [tab, setTab] = useState<'split' | 'withdraw' | 'gap'>('split');
  const [splits, setSplits] = useState<SplitRule[]>(SPLIT_RULES);
  const [withdraws, setWithdraws] = useState<Withdrawal[]>(WITHDRAWALS);
  const [gaps, setGaps] = useState<LedgerGap[]>(LEDGER_GAPS);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [ratioModal, setRatioModal] = useState<SplitRule | null>(null);
  const [ratioDraft, setRatioDraft] = useState(3);
  const [phoneModal, setPhoneModal] = useState<Withdrawal | null>(null);
  const [phoneNote, setPhoneNote] = useState('');
  const pageSize = 6;

  const filteredWithdraws = useMemo(
    () => withdraws.filter((w) => !keyword.trim() || w.merchantName.includes(keyword.trim()) || w.id.toLowerCase().includes(keyword.trim().toLowerCase()) || w.merchantNo.includes(keyword.trim())),
    [withdraws, keyword]
  );
  const pagedWithdraws = filteredWithdraws.slice((page - 1) * pageSize, page * pageSize);
  const queuedFen = withdraws.filter((w) => w.status !== 'success').reduce((s, w) => s + w.amountFen, 0);

  const retryWithdraw = (id: string) => {
    setWithdraws((prev) => prev.map((w) => (w.id === id ? { ...w, status: 'paying' as const, failReason: null } : w)));
    push({ title: '提现重试已提交', description: `${id} · 重新发起银行代付，预计 10 分钟到账`, tone: 'info' });
    window.setTimeout(() => {
      setWithdraws((prev) => prev.map((w) => (w.id === id ? { ...w, status: 'success' as const } : w)));
      push({ title: '提现已到账', description: id, tone: 'success' });
    }, 2400);
  };

  const fixGap = (id: string, action: string) => {
    setGaps((prev) => prev.map((g) => (g.id === id ? { ...g, status: 'fixing' as const } : g)));
    push({ title: `${action}已触发`, description: `${id} · 正在执行对账修复流水`, tone: 'info' });
    window.setTimeout(() => {
      setGaps((prev) => prev.map((g) => (g.id === id ? { ...g, status: 'fixed' as const } : g)));
      push({ title: '差错已修复', description: `${id} · 长短款已轧平`, tone: 'success' });
    }, 2200);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Payment Lifecycle / Settlement"
        title="资金清结算与对账"
        description="服务商分账、T+0/T+1 提现队列、大额电核与长短款差错修复 · 每一笔资金可追溯"
        meta={<Badge tone="amber">在途 {formatFen(queuedFen)}</Badge>}
        actions={
          <Button
            variant="primary"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => {
              downloadCsv('settlement-20260224.csv', ['单号', '商户', '金额(元)', '状态'], withdraws.map((w) => [w.id, w.merchantName, String(w.amountFen / 100), WD_STATUS[w.status].label]));
              push({ title: '清结算报表已导出', description: `${withdraws.length} 笔提现记录`, tone: 'success' });
            }}
          >
            导出报表
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '本月分账金额', value: formatFen(splits.reduce((s, r) => s + r.monthFen, 0)), hint: '5 家服务商 · 延迟分账 2 家', icon: ArrowLeftRight },
          { label: '提现排队', value: `${withdraws.filter((w) => w.status === 'queued' || w.status === 'verifying').length} 笔`, hint: 'T0 即时 · T1 次日 6 点', icon: Clock },
          { label: '未修复差错', value: `${gaps.filter((g) => g.status !== 'fixed').length} 笔`, hint: '单边账优先自动补单', icon: FileWarning },
          { label: '大额待电核', value: `${withdraws.filter((w) => w.amountFen > 50000000 && !w.phoneVerified).length} 笔`, hint: '>50 万强制人工电核', icon: PhoneCall },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-[#6B7280]">{m.label}</p>
                <Icon className="h-4 w-4 text-[#9CA3AF]" />
              </div>
              <p className="mt-2 font-mono text-lg font-semibold tracking-tight text-[#111827]">{m.value}</p>
              <p className="mt-1 text-[10px] text-[#9CA3AF]">{m.hint}</p>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'split' as const, label: '分账管理', count: splits.length },
          { key: 'withdraw' as const, label: '提现管理', count: withdraws.filter((w) => w.status !== 'success').length },
          { key: 'gap' as const, label: '差错处理', count: gaps.filter((g) => g.status !== 'fixed').length },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setPage(1); }}
            className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-all', tab === t.key ? 'bg-[#111827] text-white shadow-[0_2px_8px_rgba(17,24,39,0.14)]' : 'bg-white text-[#6B7280] hover:text-[#111827]')}
          >
            {t.label}
            <span className={cn('rounded-full px-1.5 py-0.5 font-mono text-[9px]', tab === t.key ? 'bg-white/15' : 'bg-[#F3F4F6] text-[#6B7280]')}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'split' && (
        <Card className="animate-page-enter p-6">
          <SectionTitle title="服务商分账规则" subtitle="抽成比例 · 延迟分账 · 分账回退需二级审批" right={<Badge tone="slate">T+1 自动执行</Badge>} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left">
              <thead>
                <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  <th className="rounded-l-xl py-3 pr-3 pl-4 font-medium">规则 / 商户</th>
                  <th className="px-3 py-3 font-medium">抽成比例</th>
                  <th className="px-3 py-3 font-medium">分账模式</th>
                  <th className="px-3 py-3 font-medium">本月分账</th>
                  <th className="px-3 py-3 font-medium">状态</th>
                  <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-[#F9FAFB]/80">
                    <td className="py-3.5 pr-3 pl-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F9FAFB] text-[#6B7280]"><BadgePercent className="h-3.5 w-3.5" /></span>
                        <div>
                          <p className="text-xs font-medium text-[#111827]">{r.merchantName}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{r.id} · {r.merchantNo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="font-mono text-xs font-semibold text-[#111827]">{r.ratio.toFixed(1)}%</span>
                      <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-[#F3F4F6]"><div className="h-full rounded-full bg-[#111827]" style={{ width: `${(r.ratio / 10) * 100}%` }} /></div>
                    </td>
                    <td className="px-3 py-3.5">
                      {r.mode === 'realtime' ? <Badge tone="emerald">实时分账</Badge> : <Badge tone="amber">延迟 {r.delayDays} 天</Badge>}
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs text-[#374151]">{formatFen(r.monthFen)}</td>
                    <td className="px-3 py-3.5">
                      {r.status === 'active' ? <Badge tone="emerald">执行中</Badge> : r.status === 'paused' ? <Badge tone="slate">已暂停</Badge> : <Badge tone="rose">回退审批中</Badge>}
                      <p className="mt-1 text-[10px] text-[#9CA3AF]">审批人 {r.approver}</p>
                    </td>
                    <td className="py-3.5 pr-4 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => { setRatioModal(r); setRatioDraft(r.ratio); }} className="cursor-pointer rounded-lg px-2 py-1.5 text-[11px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]">调比例</button>
                        <button
                          type="button"
                          onClick={() => {
                            setSplits((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: x.status === 'active' ? 'paused' as const : 'active' as const } : x)));
                            push({ title: r.status === 'active' ? '分账已暂停' : '分账已恢复', description: r.id, tone: 'info' });
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#F9FAFB] px-2 py-1.5 text-[11px] font-medium text-[#4B5563] hover:bg-[#F3F4F6]"
                        >
                          {r.status === 'active' ? <><Pause className="h-3 w-3" />暂停</> : <><Play className="h-3 w-3" />恢复</>}
                        </button>
                        <button
                          type="button"
                          disabled={r.status === 'rollback_pending'}
                          onClick={() => {
                            setSplits((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'rollback_pending' as const } : x)));
                            push({ title: '分账回退已提交审批', description: `${r.id} · 需财务主管 + 风控双人审批`, tone: 'info' });
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <RotateCcw className="h-3 w-3" />回退
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#F9FAFB] px-4 py-3 text-[10px] leading-relaxed text-[#6B7280]">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
            风控提示：厦门澄海跨境的分账回退申请涉及 86.4 万元在途资金，回退前需冻结商户提现并完成 AML 复核。
          </div>
        </Card>
      )}

      {tab === 'withdraw' && (
        <Card className="animate-page-enter p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title="提现队列（T+0 / T+1）" subtitle="大额 >50 万强制人工电核 · 失败支持原路重试" />
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索商户 / 提现单号" className="w-56 rounded-xl bg-[#F9FAFB] py-2.5 pr-3 pl-9 text-xs outline-none focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]" />
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  <th className="rounded-l-xl py-3 pr-3 pl-4 font-medium">提现单 / 商户</th>
                  <th className="px-3 py-3 font-medium">金额 / 类型</th>
                  <th className="px-3 py-3 font-medium">收款银行</th>
                  <th className="px-3 py-3 font-medium">电核</th>
                  <th className="px-3 py-3 font-medium">状态</th>
                  <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {pagedWithdraws.map((w) => {
                  const meta = WD_STATUS[w.status];
                  const big = w.amountFen > 50000000;
                  return (
                    <tr key={w.id} className="transition-colors hover:bg-[#F9FAFB]/80">
                      <td className="py-3.5 pr-3 pl-4">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F9FAFB] text-[#6B7280]"><Landmark className="h-3.5 w-3.5" /></span>
                          <div>
                            <p className="font-mono text-[11px] font-medium text-[#111827]">{w.id}</p>
                            <p className="mt-0.5 max-w-[200px] truncate text-[10px] text-[#9CA3AF]">{w.merchantName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="font-mono text-xs font-semibold text-[#111827]">{formatFen(w.amountFen)}</p>
                        <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{w.type} · {w.createdAt.slice(5, 16)}</p>
                      </td>
                      <td className="px-3 py-3.5 text-[11px] text-[#4B5563]">{w.bank}</td>
                      <td className="px-3 py-3.5">
                        {big && !w.phoneVerified ? (
                          <button type="button" onClick={() => { setPhoneModal(w); setPhoneNote(''); }} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-rose-50 px-2 py-1.5 text-[10px] font-medium text-rose-700 hover:bg-rose-100">
                            <PhoneCall className="h-3 w-3" />待电核
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />{big ? '已电核' : '免电核'}</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {w.failReason && <p className="mt-1 max-w-[220px] text-[10px] leading-relaxed text-rose-600">{w.failReason}</p>}
                      </td>
                      <td className="py-3.5 pr-4 pl-3 text-right">
                        {w.status === 'failed' ? (
                          <button type="button" onClick={() => retryWithdraw(w.id)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#111827] px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-[#242d3d]">
                            <RefreshCcw className="h-3 w-3" />失败重试
                          </button>
                        ) : w.status === 'success' ? (
                          <span className="text-[10px] text-[#9CA3AF]">—</span>
                        ) : (
                          <button type="button" onClick={() => push({ title: '已催办银行代付', description: `${w.id} · ${w.bank}通道`, tone: 'info' })} className="cursor-pointer rounded-lg px-2 py-1.5 text-[11px] font-medium text-[#6B7280] hover:bg-[#F3F4F6]">催办</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filteredWithdraws.length} onPageChange={setPage} />
        </Card>
      )}

      {tab === 'gap' && (
        <Card className="animate-page-enter p-6">
          <SectionTitle title="长短款与单边账" subtitle="自动触发补单或退款 · 修复全程留痕" right={<Badge tone="rose">{gaps.filter((g) => g.status === 'open').length} 待修复</Badge>} />
          <div className="mt-4 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {gaps.map((g) => {
              const kind = GAP_KIND[g.kind];
              return (
                <div key={g.id} className="rounded-2xl bg-[#F9FAFB] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={kind.tone}>{kind.label}</Badge>
                      <span className="font-mono text-[10px] text-[#9CA3AF]">{g.id}</span>
                    </div>
                    {g.status === 'fixed' ? <Badge tone="emerald">已修复</Badge> : g.status === 'fixing' ? <Badge tone="sky">修复中</Badge> : <Badge tone="amber">待处理</Badge>}
                  </div>
                  <p className="mt-2 font-mono text-lg font-semibold text-[#111827]">{formatFen(g.amountFen)}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#4B5563]">{g.reason}</p>
                  <p className="mt-1 font-mono text-[9px] text-[#9CA3AF]">{g.tradeNo} · {g.channel} · {g.createdAt}</p>
                  {g.status === 'open' && (
                    <div className="mt-3 flex gap-1.5">
                      <Button size="xs" variant="primary" className="flex-1" icon={<Wrench className="h-3 w-3" />} onClick={() => fixGap(g.id, g.kind === 'single' ? '自动补单' : '自动退款')}>{g.kind === 'single' ? '自动补单' : '触发退款'}</Button>
                      <Button size="xs" variant="secondary" icon={<ChevronRight className="h-3 w-3" />} onClick={() => push({ title: '已转人工复核', description: `${g.id} · 财务将在 2 小时内处理`, tone: 'info' })}>转人工</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal open={Boolean(ratioModal)} onClose={() => setRatioModal(null)} title="调整分账比例" subtitle={ratioModal ? `${ratioModal.merchantName} · 当前 ${ratioModal.ratio}%` : ''} icon={<BadgePercent className="h-4 w-4" />} footer={<><Button variant="secondary" onClick={() => setRatioModal(null)}>取消</Button><Button variant="primary" icon={<Check className="h-3.5 w-3.5" />} onClick={() => { if (!ratioModal) return; setSplits((prev) => prev.map((r) => (r.id === ratioModal.id ? { ...r, ratio: ratioDraft } : r))); push({ title: '分账比例已更新', description: `${ratioModal.id} → ${ratioDraft.toFixed(1)}%，下个结算周期生效`, tone: 'success' }); setRatioModal(null); }}>保存比例</Button></>}>
        <div>
          <div className="flex items-center justify-between"><span className="text-xs font-medium text-[#374151]">抽成比例</span><span className="font-mono text-sm font-semibold text-[#111827]">{ratioDraft.toFixed(1)}%</span></div>
          <input type="range" min={0.5} max={10} step={0.1} value={ratioDraft} onChange={(e) => setRatioDraft(Number(e.target.value))} className="range-slider mt-2 w-full" aria-label="抽成比例" />
          <p className="mt-2 text-[10px] text-[#9CA3AF]">调整超过 ±2% 将自动触发风控复核并通知商户确认。</p>
        </div>
      </Modal>

      <Modal open={Boolean(phoneModal)} onClose={() => setPhoneModal(null)} title="大额提现人工电核" subtitle={phoneModal ? `${phoneModal.id} · ${formatFen(phoneModal.amountFen)} · 超过 50 万强制电核` : ''} icon={<PhoneCall className="h-4 w-4" />} footer={<><Button variant="secondary" onClick={() => setPhoneModal(null)}>取消</Button><Button variant="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => { if (!phoneModal) return; if (phoneNote.trim().length < 4) { push({ title: '请填写电核记录', description: '至少记录接听人、核对事项与结论', tone: 'error' }); return; } setWithdraws((prev) => prev.map((w) => (w.id === phoneModal.id ? { ...w, phoneVerified: true, status: 'paying' as const } : w))); push({ title: '电核通过，已恢复代付', description: phoneModal.id, tone: 'success' }); setPhoneModal(null); }}>电核通过</Button></>}>
        <div className="space-y-3">
          <div className="rounded-xl bg-[#F9FAFB] p-3.5 text-[11px] leading-relaxed text-[#4B5563]">
            <p className="font-medium text-[#111827]">电核话术（必问）</p>
            <p className="mt-1">1. 确认提现是否为法人本人操作；2. 确认收款账户是否变更；3. 确认大额资金用途与发票情况。</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#374151]">电核记录</label>
            <textarea rows={3} value={phoneNote} onChange={(e) => setPhoneNote(e.target.value)} placeholder="如：14:20 致电法人顾清和本人接听，确认 62 万为供应商货款，账户无变更，同意放行…" className="w-full resize-none rounded-xl bg-[#F9FAFB] p-3 text-xs outline-none focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]" />
          </div>
        </div>
      </Modal>
    </div>
  );
};

/* ============================ 营销与企业付款 ============================ */

export const MarketingPage: React.FC = () => {
  const { push } = useToast();
  const [batches, setBatches] = useState<VoucherBatch[]>(VOUCHER_BATCHES);
  const [pays] = useState(ENTERPRISE_PAYS);
  const [tab, setTab] = useState<'voucher' | 'epay'>('voucher');

  const fuseBatch = (id: string) => {
    setBatches((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'fused' as const } : b)));
    push({ title: '超发熔断已触发', description: `${id} · 已暂停发券，在途核销不受影响`, tone: 'success' });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Payment Lifecycle / Marketing"
        title="营销与资金发放"
        description="代金券预算水位、超发熔断、企业付款限额与失败资金原路退回追踪"
        meta={<Badge tone="orange">预算使用 68.4%</Badge>}
        actions={
          <Button variant="primary" icon={<Gift className="h-3.5 w-3.5" />} onClick={() => push({ title: '发券批次创建向导', description: '预算审批 → 风控策略绑定 → 灰度放量三步完成', tone: 'info' })}>
            新建发券批次
          </Button>
        }
      />

      <div className="flex gap-1.5">
        {[{ key: 'voucher' as const, label: '代金券 / 立减金' }, { key: 'epay' as const, label: '企业付款 / 红包' }].map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn('cursor-pointer rounded-xl px-3.5 py-2 text-xs font-medium transition-all', tab === t.key ? 'bg-[#111827] text-white' : 'bg-white text-[#6B7280] hover:text-[#111827]')}>{t.label}</button>
        ))}
      </div>

      {tab === 'voucher' && (
        <div className="animate-page-enter grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {batches.map((b) => {
            const usedPct = (b.issuedFen / b.budgetFen) * 100;
            const nearFuse = usedPct >= b.fuseThreshold;
            return (
              <Card key={b.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-white"><TicketPercent className="h-4 w-4" /></div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#111827]">{b.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{b.id} · {b.channel}</p>
                    </div>
                  </div>
                  {b.status === 'running' ? <Badge tone="emerald">发放中</Badge> : b.status === 'fused' ? <Badge tone="rose">已熔断</Badge> : <Badge tone="slate">已结束</Badge>}
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#6B7280]">预算水位线</span>
                    <span className="font-mono text-[#111827]">{formatFen(b.issuedFen)} / {formatFen(b.budgetFen)} · {usedPct.toFixed(1)}%</span>
                  </div>
                  <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#F3F4F6]">
                    <div className={cn('h-full rounded-full transition-all', nearFuse ? 'bg-rose-500' : 'bg-[#111827]')} style={{ width: `${Math.min(usedPct, 100)}%` }} />
                    <span className="absolute top-0 bottom-0 w-0.5 bg-amber-400" style={{ left: `${b.fuseThreshold}%` }} title={`熔断线 ${b.fuseThreshold}%`} />
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] text-[#9CA3AF]"><span>熔断线 {b.fuseThreshold}%</span><span>核销 {b.redeemed.toLocaleString()} · 核销率 {b.redeemRate}%</span></div>
                </div>
                {nearFuse && b.status === 'running' && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-[10px] font-medium text-rose-700">
                    <Siren className="h-3.5 w-3.5" />预算使用超过熔断线，建议立即熔断防止超发
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  {b.status === 'running' ? (
                    <>
                      <Button size="sm" variant="secondary" className="flex-1" icon={<Banknote className="h-3.5 w-3.5" />} onClick={() => push({ title: '核销实时监控', description: `${b.id} · 近 1 小时核销 ${Math.floor(b.redeemed / 24).toLocaleString()} 张`, tone: 'info' })}>核销监控</Button>
                      <Button size="sm" variant="danger" icon={<Siren className="h-3.5 w-3.5" />} onClick={() => fuseBatch(b.id)}>超发熔断</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => push({ title: '批次复盘报告', description: `${b.id} · ROI 与作弊核销分析已生成`, tone: 'info' })}>查看复盘</Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'epay' && (
        <Card className="animate-page-enter p-6">
          <SectionTitle title="企业付款与红包" subtitle="单日限额 · 收款人资质审查 · 失败资金原路退回" right={<Badge tone="slate">单日限额 ¥50,000 / 付款方</Badge>} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-left">
              <thead>
                <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  <th className="rounded-l-xl py-3 pr-3 pl-4 font-medium">付款单 / 收款人</th>
                  <th className="px-3 py-3 font-medium">金额 / 限额</th>
                  <th className="px-3 py-3 font-medium">收款资质</th>
                  <th className="px-3 py-3 font-medium">状态</th>
                  <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {pays.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-[#F9FAFB]/80">
                    <td className="py-3.5 pr-3 pl-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F9FAFB] text-[#6B7280]"><HandCoins className="h-3.5 w-3.5" /></span>
                        <div>
                          <p className="text-xs font-medium text-[#111827]">{p.receiver}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{p.id} · {p.receiverUid}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="font-mono text-xs font-semibold text-[#111827]">{formatFen(p.amountFen)}</p>
                      <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-[#F3F4F6]"><div className="h-full rounded-full bg-orange-400" style={{ width: `${(p.dayUsedFen / p.dayLimitFen) * 100}%` }} /></div>
                      <p className="mt-0.5 font-mono text-[9px] text-[#9CA3AF]">今日 {formatFen(p.dayUsedFen)} / {formatFen(p.dayLimitFen)}</p>
                    </td>
                    <td className="px-3 py-3.5">
                      {p.kyc === 'pass' ? <Badge tone="emerald">实名通过</Badge> : p.kyc === 'pending' ? <Badge tone="amber">待核验</Badge> : <Badge tone="rose">命中黑名单</Badge>}
                    </td>
                    <td className="px-3 py-3.5">
                      {p.status === 'success' ? <Badge tone="emerald">发放成功</Badge> : p.status === 'refunding' ? <Badge tone="sky">退回中</Badge> : <Badge tone="rose">发放失败</Badge>}
                      {p.failReason && <p className="mt-1 max-w-[240px] text-[10px] leading-relaxed text-rose-600">{p.failReason}</p>}
                    </td>
                    <td className="py-3.5 pr-4 pl-3 text-right">
                      <button type="button" onClick={() => push({ title: '资金轨迹', description: `${p.id} · 付款 → ${p.status === 'success' ? '收款零钱' : p.status === 'refunding' ? '原路退回中（T+1)' : '拦截止付'}`, tone: 'info' })} className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]">
                        资金轨迹 <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#F9FAFB] px-4 py-3 text-[10px] text-[#6B7280]">
            <Wallet className="h-3.5 w-3.5 text-[#9CA3AF]" />失败资金统一 T+1 原路退回付款方余额，退回进度可在交易流水按原单号追踪。
          </div>
        </Card>
      )}
    </div>
  );
};

export const SETTLEMENT_EXPORT = { WD_STATUS, GAP_KIND };
export { XCircle };
