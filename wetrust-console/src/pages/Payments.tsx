import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Code2,
  CreditCard,
  Download,
  Landmark,
  Loader2,
  QrCode,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Search,
  Settings2,
  Smartphone,
  Bookmark,
  CalendarDays,
  Plus,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CopyButton,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Tone,
  cn,
  downloadCsv,
  useToast,
  TextInput,
} from '../components/ui';
import { formatCNY } from '../lib/data';
import { readTransactionViews, writeTransactionViews } from '../lib/transactionViews';
import type { TransactionView } from '../lib/transactionViews';
import type { PaymentTransaction, PayMethod, RefundException, RefundStatus, TradeStatus } from '../lib/types';

const TRADE_STATUS_META: Record<TradeStatus, { label: string; tone: Tone }> = {
  success: { label: '支付成功', tone: 'emerald' },
  processing: { label: '处理中', tone: 'amber' },
  failed: { label: '支付失败', tone: 'rose' },
  closed: { label: '已关闭', tone: 'slate' },
};

const PAY_METHOD_META: Record<PayMethod, { label: string; short: string; tone: Tone; icon: React.ComponentType<{ className?: string }> }> = {
  qr: { label: '微信扫码支付', short: '扫码', tone: 'sky', icon: QrCode },
  card: { label: '微信刷卡支付', short: '刷卡', tone: 'violet', icon: CreditCard },
  api: { label: '微信小程序 API', short: 'API', tone: 'amber', icon: Code2 },
  mini_program: { label: '小程序支付', short: '小程序', tone: 'emerald', icon: Smartphone },
};

const REFUND_STATUS_META: Record<RefundStatus, { label: string; tone: Tone }> = {
  pending: { label: '待重试', tone: 'amber' },
  retrying: { label: '重试中', tone: 'sky' },
  resolved: { label: '已解决', tone: 'emerald' },
  manual_review: { label: '人工复核', tone: 'rose' },
};

// 金额筛选先转为整数「分」，避免 0.29 * 100 的浮点误差。
const amountToFen = (input: string): number | null => {
  if (!/^\d+(?:\.\d{0,2})?$/.test(input)) return null;
  const [yuan, cents = ''] = input.split('.');
  const fen = Number(yuan) * 100 + Number(cents.padEnd(2, '0'));
  return Number.isSafeInteger(fen) ? fen : null;
};

interface TransactionsProps {
  transactions: PaymentTransaction[];
  username: string;
}

type SortableColumn = keyof PaymentTransaction;

const SortHeader: React.FC<{
  label: string;
  column: SortableColumn;
  activeKey: SortableColumn;
  direction: 'asc' | 'desc';
  onSort: (column: SortableColumn) => void;
  className?: string;
}> = ({ label, column, activeKey, direction, onSort, className }) => (
  <th className={className} aria-sort={activeKey === column ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <button type="button" onClick={() => onSort(column)} aria-label={`按${label}排序`}
      className="group/sort inline-flex cursor-pointer items-center gap-1 font-medium tracking-wider text-[#9CA3AF] uppercase hover:text-[#111827]">
      {label}
      <span className={cn('inline-flex flex-col leading-none', activeKey === column ? 'text-orange-500' : 'text-[#D1D5DB] group-hover/sort:text-[#9CA3AF]')}>
        <ChevronUp className={cn('h-2.5 w-2.5', activeKey === column && direction === 'asc' ? 'opacity-100' : 'opacity-40')} />
        <ChevronDown className={cn('-mt-0.5 h-2.5 w-2.5', activeKey === column && direction === 'desc' ? 'opacity-100' : 'opacity-40')} />
      </span>
    </button>
  </th>
);

export const TransactionsPage: React.FC<TransactionsProps> = ({ transactions, username }) => {
  const { push } = useToast();
  const [keyword, setKeyword] = useState('');
  const [method, setMethod] = useState('all');
  const [status, setStatus] = useState('all');
  const [tradeType, setTradeType] = useState<'all' | 'payment' | 'refund'>('all');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<PaymentTransaction | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [txSelected, setTxSelected] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [views, setViews] = useState<TransactionView[]>(() => readTransactionViews(username));
  const [viewName, setViewName] = useState('');
  const [viewEditorOpen, setViewEditorOpen] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof PaymentTransaction>('paid_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [columns, setColumns] = useState<Record<string, boolean>>({
    tradeNo: true, merchant: true, amount: true, method: true, status: true, time: true, desc: false,
  });
  const COLUMN_DEFS: { key: string; label: string }[] = [
    { key: 'tradeNo', label: '单号' }, { key: 'merchant', label: '商户' }, { key: 'amount', label: '金额' },
    { key: 'method', label: '支付方式' }, { key: 'status', label: '状态' }, { key: 'time', label: '支付时间' },
    { key: 'desc', label: '商品描述' },
  ];

  const pseudoUid = (tx: PaymentTransaction) => `wx_uid_8849${tx.wechat_trade_no.slice(-4)}`;
  const pseudoTail = (tx: PaymentTransaction) => tx.wechat_trade_no.slice(-4);
  const pseudoIp = (tx: PaymentTransaction) => {
    const n = Number(tx.wechat_trade_no.slice(-2)) % 250 + 2;
    const m = Number(tx.wechat_trade_no.slice(-4, -2)) % 250 + 2;
    return `113.108.${n}.${m}`;
  };

  const filtered = useMemo(
    () => {
      const minFen = amountMin ? amountToFen(amountMin) : null;
      const maxFen = amountMax ? amountToFen(amountMax) : null;
      if ((amountMin && minFen === null) || (amountMax && maxFen === null)) return [];
      return transactions.filter((tx) => {
        const query = keyword.trim().toLowerCase();
        const matchKeyword =
          !query ||
          tx.wechat_trade_no.toLowerCase().includes(query) ||
          tx.merchant_trade_no.toLowerCase().includes(query) ||
          tx.merchant_name.includes(query) ||
          tx.payer_openid.toLowerCase().includes(query) ||
          pseudoUid(tx).toLowerCase().includes(query) ||
          pseudoTail(tx).includes(query) ||
          pseudoIp(tx).includes(query);
        const date = tx.paid_at.slice(0, 10);
        const matchDate = (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
        const matchAmount = (minFen === null || tx.amount_fen >= minFen) && (maxFen === null || tx.amount_fen <= maxFen);
        const matchMethod = method === 'all' || tx.pay_method === method;
        const matchStatus = status === 'all' || tx.status === status;
        const matchType = tradeType === 'all' || tx.trade_type === tradeType;
        return matchKeyword && matchDate && matchAmount && matchMethod && matchStatus && matchType;
      });
    },
    [transactions, keyword, method, status, tradeType, dateFrom, dateTo, amountMin, amountMax]
  );

  const sorted = useMemo(() => {
    const key = sortKey;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va ?? '').localeCompare(String(vb ?? ''), 'zh-CN') * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
  const totalPayment = filtered.filter((tx) => tx.trade_type === 'payment').reduce((sum, tx) => sum + tx.amount_fen, 0);
  const totalRefund = filtered.filter((tx) => tx.trade_type === 'refund').reduce((sum, tx) => sum + tx.amount_fen, 0);
  const successRate = filtered.length
    ? ((filtered.filter((tx) => tx.status === 'success').length / filtered.length) * 100).toFixed(2)
    : '0.00';

  const toggleSort = (key: keyof PaymentTransaction) => {
    if (sortKey === key) setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'amount_fen' ? 'desc' : 'asc');
    }
    setPage(1);
    setActiveViewId(null);
  };

  const persistViews = (next: TransactionView[]) => { setViews(next); writeTransactionViews(username, next); };

  const applyView = (view: TransactionView) => {
    setKeyword(view.keyword);
    setMethod(view.method);
    setStatus(view.status);
    setTradeType(view.tradeType);
    setDateFrom(view.dateFrom);
    setDateTo(view.dateTo);
    setAmountMin(view.amountMin);
    setAmountMax(view.amountMax);
    setSortKey(view.sortKey);
    setSortDir(view.sortDir);
    setColumns({ ...view.columns });
    setPageSize(view.pageSize);
    setPage(1);
    setTxSelected([]);
    setActiveViewId(view.id);
    push({ title: `已载入「${view.name}」`, description: '日期、金额、渠道、排序和列配置已同步', tone: 'success' });
  };

  const saveView = () => {
    const name = viewName.trim();
    if (name.length < 2 || name.length > 20) { push({ title: '请输入 2-20 字的视图名称', tone: 'error' }); return; }
    if (views.some((v) => v.name === name)) { push({ title: '视图名称已存在', description: '请使用其他名称或先删除旧视图', tone: 'error' }); return; }
    if (views.length >= 6) { push({ title: '最多保存 6 个筛选视图', description: '请先删除不再使用的视图', tone: 'error' }); return; }
    const view: TransactionView = { id: `view-${Date.now()}`, name, keyword, method: method as TransactionView['method'], status: status as TransactionView['status'], tradeType, dateFrom, dateTo, amountMin, amountMax, sortKey, sortDir, columns: { ...columns }, pageSize, createdAt: new Date().toISOString() };
    persistViews([...views, view]);
    setActiveViewId(view.id);
    setViewName('');
    setViewEditorOpen(false);
    push({ title: `已保存筛选视图「${name}」`, description: '此账号下次打开可一键复用', tone: 'success' });
  };

  const resetFilters = () => {
    setKeyword(''); setMethod('all'); setStatus('all'); setTradeType('all');
    setDateFrom(''); setDateTo(''); setAmountMin(''); setAmountMax('');
    setSortKey('paid_at'); setSortDir('desc'); setPage(1); setTxSelected([]);
    setActiveViewId(null);
  };

  const activeFilterCount = [keyword, dateFrom, dateTo, amountMin, amountMax].filter(Boolean).length + Number(method !== 'all') + Number(status !== 'all') + Number(tradeType !== 'all');

  const exportTransactions = (onlySelected = false) => {
    const rows = onlySelected ? filtered.filter((tx) => txSelected.includes(tx.wechat_trade_no)) : filtered;
    if (onlySelected && rows.length === 0) {
      push({ title: '没有可导出的选中行', description: '请先勾选流水左侧复选框', tone: 'error' });
      return;
    }
    downloadCsv(
      onlySelected ? 'wechat-transactions-selected.csv' : 'wechat-transactions-20260224.csv',
      ['微信支付单号', '商户单号', '商户名称', '交易类型', '金额(元)', '支付方式', '状态', '支付时间', '结算时间'],
      rows.map((tx) => [
        tx.wechat_trade_no,
        tx.merchant_trade_no,
        tx.merchant_name,
        tx.trade_type === 'payment' ? '收款' : '退款',
        (tx.amount_fen / 100).toFixed(2),
        PAY_METHOD_META[tx.pay_method].label,
        TRADE_STATUS_META[tx.status].label,
        tx.paid_at,
        tx.settled_at ?? '未结算',
      ])
    );
    push({ title: `已导出 ${rows.length} 条交易流水`, description: onlySelected ? '仅导出勾选行' : '文件包含微信支付单与商户单全量字段', tone: 'success' });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Payment Domain / Transactions"
        title="全量交易流水"
        description="聚合微信支付全渠道收退款流水，逐笔可追溯至商户订单、结算批次与清算通道。"
        meta={<Badge tone="emerald">支付通道正常</Badge>}
        actions={
          <Button variant="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => exportTransactions()}>
            导出流水
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '交易总笔数', value: String(filtered.length), unit: '笔', hint: '当前筛选结果', icon: ReceiptText, color: 'text-[#111827]' },
          { label: '收款总额', value: formatCNY(totalPayment), unit: '', hint: '含处理中订单', icon: ArrowDownLeft, color: 'text-emerald-600' },
          { label: '退款总额', value: formatCNY(totalRefund), unit: '', hint: '含部分退款', icon: ArrowUpRight, color: 'text-rose-600' },
          { label: '支付成功率', value: successRate, unit: '%', hint: '按笔数口径', icon: CheckCircle2, color: 'text-sky-600' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-[#6B7280]">{item.label}</p>
                <Icon className={cn('h-4 w-4', item.color)} />
              </div>
              <p className={cn('mt-2.5 font-mono text-xl font-semibold tracking-tight', item.color)}>
                {item.value}
                <span className="ml-0.5 font-sans text-[10px] font-normal text-[#9CA3AF]">{item.unit}</span>
              </p>
              <p className="mt-1 text-[10px] text-[#9CA3AF]">{item.hint}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F9FAFB] px-3 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]"><Bookmark className="h-3.5 w-3.5" />我的视图</span>
              {views.length === 0 && <span className="text-[10px] text-[#9CA3AF]">保存常用筛选，跨会话一键复用</span>}
              {views.map((view) => <div key={view.id} className={cn('flex items-center rounded-lg text-[11px] transition-colors', activeViewId === view.id ? 'bg-[#111827] text-white' : 'bg-white text-[#4B5563] shadow-xs')}><button type="button" aria-label={`应用视图 ${view.name}`} onClick={() => applyView(view)} className="max-w-36 cursor-pointer truncate px-2.5 py-1.5">{view.name}</button><button type="button" aria-label={`删除视图 ${view.name}`} title={`删除视图 ${view.name}`} onClick={() => { persistViews(views.filter((v) => v.id !== view.id)); if (activeViewId === view.id) setActiveViewId(null); }} className={cn('mr-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded', activeViewId === view.id ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-[#9CA3AF] hover:bg-rose-50 hover:text-rose-600')}><Trash2 className="h-3 w-3" /></button></div>)}
            </div>
            <button type="button" onClick={() => setViewEditorOpen((v) => !v)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-medium text-[#374151] shadow-xs hover:text-orange-600"><Plus className="h-3 w-3" />保存当前视图</button>
          </div>
          {viewEditorOpen && <div className="flex flex-wrap items-center gap-2 rounded-xl bg-orange-50/65 px-3 py-2.5"><span className="text-[11px] font-medium text-[#374151]">保存筛选配置</span><TextInput aria-label="视图名称" value={viewName} onChange={(e) => setViewName(e.target.value)} maxLength={20} placeholder="例如：今日高风险退款" className="max-w-56 bg-white py-1.5 text-xs" /><Button size="xs" variant="primary" onClick={saveView}>确认保存</Button><Button size="xs" variant="ghost" onClick={() => setViewEditorOpen(false)}>取消</Button><span className="text-[10px] text-[#9CA3AF]">最多 6 个 · 仅当前账号可见</span></div>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {[
                { key: 'all' as const, label: '全部流水' },
                { key: 'payment' as const, label: '仅收款' },
                { key: 'refund' as const, label: '仅退款' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setTradeType(item.key);
                    setPage(1);
                    setActiveViewId(null);
                  }}
                  className={cn(
                    'cursor-pointer rounded-xl px-3.5 py-2 text-xs font-medium transition-all',
                    tradeType === item.key
                      ? 'bg-[#111827] text-white shadow-[0_2px_8px_rgba(17,24,39,0.14)]'
                      : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setPage(1);
                    setActiveViewId(null);
                  }}
                  placeholder="单号 / 商户 / UID / 卡尾号 / IP"
                  className="w-64 rounded-xl bg-[#F9FAFB] py-2.5 pr-3 pl-9 text-xs text-[#111827] placeholder-[#9CA3AF] outline-none transition-all focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]"
                />
              </div>
              <Select
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  setPage(1);
                    setActiveViewId(null);
                }}
                className="w-36 py-2.5 text-xs"
              >
                <option value="all">全部支付方式</option>
                <option value="qr">微信扫码</option>
                <option value="card">刷卡支付</option>
                <option value="api">小程序 API</option>
                <option value="mini_program">小程序支付</option>
              </Select>
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                    setActiveViewId(null);
                }}
                className="w-32 py-2.5 text-xs"
              >
                <option value="all">全部状态</option>
                <option value="success">支付成功</option>
                <option value="processing">处理中</option>
                <option value="failed">支付失败</option>
                <option value="closed">已关闭</option>
              </Select>
              <Select
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                    setActiveViewId(null);
                }}
                className="w-24 py-2.5 text-xs"
                aria-label="每页条数"
              >
                <option value="20">20 / 页</option>
                <option value="50">50 / 页</option>
                <option value="100">100 / 页</option>
                <option value="200">200 / 页</option>
              </Select>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setColumnMenuOpen((v) => !v)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-medium text-[#374151] shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:bg-[#F9FAFB]"
                >
                  <Settings2 className="h-3.5 w-3.5 text-[#9CA3AF]" /> 列配置
                </button>
                {columnMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setColumnMenuOpen(false)} />
                    <div className="absolute right-0 z-30 mt-2 w-44 rounded-2xl bg-white p-2 shadow-[0_14px_40px_rgba(15,23,42,0.14)]">
                      <p className="px-2 py-1.5 font-mono text-[9px] tracking-wider text-[#9CA3AF] uppercase">显示 / 隐藏列</p>
                      {COLUMN_DEFS.map((col) => (
                        <label key={col.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#374151] hover:bg-[#F9FAFB]">
                          <input
                            type="checkbox"
                            checked={columns[col.key]}
                            onChange={() => { setColumns((prev) => ({ ...prev, [col.key]: !prev[col.key] })); setActiveViewId(null); }}
                            className="h-3.5 w-3.5 accent-[#111827]"
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5 text-[#6B7280]" />} disabled={txSelected.length === 0} onClick={() => exportTransactions(true)}>
                导出选中{txSelected.length > 0 ? `（${txSelected.length}）` : ''}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-t border-[#F3F4F6] pt-3">
            <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#9CA3AF]" /><span className="text-[11px] font-medium text-[#6B7280]">时间</span></div>
            <TextInput aria-label="交易开始日期" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1); setActiveViewId(null); }} className="w-40 py-2 text-xs" />
            <span className="text-[10px] text-[#9CA3AF]">至</span>
            <TextInput aria-label="交易结束日期" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1); setActiveViewId(null); }} className="w-40 py-2 text-xs" />
            <span className="ml-1 text-[11px] font-medium text-[#6B7280]">金额</span>
            <TextInput aria-label="最低交易金额" type="number" min="0" step="0.01" value={amountMin} onChange={(e) => { setAmountMin(e.target.value); setPage(1); setActiveViewId(null); }} placeholder="最低 ¥" className="w-28 py-2 text-xs" />
            <span className="text-[10px] text-[#9CA3AF]">至</span>
            <TextInput aria-label="最高交易金额" type="number" min="0" step="0.01" value={amountMax} onChange={(e) => { setAmountMax(e.target.value); setPage(1); setActiveViewId(null); }} placeholder="最高 ¥" className="w-28 py-2 text-xs" />
            <span className="ml-auto text-[10px] text-[#9CA3AF]">{activeFilterCount} 个筛选条件</span>
            <button type="button" onClick={resetFilters} disabled={activeFilterCount === 0} className="cursor-pointer rounded-lg px-2 py-2 text-[10px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-30">清空筛选</button>
          </div>

          {((dateFrom && dateTo && dateFrom > dateTo) || (amountMin && amountToFen(amountMin) === null) || (amountMax && amountToFen(amountMax) === null) || (amountMin && amountMax && Number(amountMin) > Number(amountMax))) && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700">筛选区间不合法：日期需按先后排列；金额须为非负、最多两位小数且最低值不超过最高值</p>}

          <div className="overflow-x-auto rounded-xl">
            <table className="w-full min-w-[1060px] border-collapse text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  <th className="sticky left-0 z-20 w-9 rounded-l-xl bg-[#F9FAFB] py-3 pl-4 pr-1 shadow-[1px_0_0_#EEF0F3]">
                    <input
                      type="checkbox"
                      aria-label="全选当前页"
                      checked={paged.length > 0 && paged.every((tx) => txSelected.includes(tx.wechat_trade_no))}
                      onChange={(e) => {
                        if (e.target.checked) setTxSelected((prev) => Array.from(new Set([...prev, ...paged.map((tx) => tx.wechat_trade_no)])));
                        else setTxSelected((prev) => prev.filter((id) => !paged.some((tx) => tx.wechat_trade_no === id)));
                      }}
                      className="h-3.5 w-3.5 cursor-pointer accent-[#111827]"
                    />
                  </th>
                  {columns.tradeNo && <SortHeader label="微信支付单号" column="wechat_trade_no" activeKey={sortKey} direction={sortDir} onSort={toggleSort} className="sticky left-9 z-20 bg-[#F9FAFB] px-3 py-3 shadow-[1px_0_0_#EEF0F3]" />}
                  {columns.merchant && <SortHeader label="商户" column="merchant_name" activeKey={sortKey} direction={sortDir} onSort={toggleSort} className="px-3 py-3" />}
                  {columns.amount && <SortHeader label="交易金额" column="amount_fen" activeKey={sortKey} direction={sortDir} onSort={toggleSort} className="px-3 py-3" />}
                  {columns.method && <SortHeader label="支付方式" column="pay_method" activeKey={sortKey} direction={sortDir} onSort={toggleSort} className="px-3 py-3" />}
                  {columns.status && <SortHeader label="状态" column="status" activeKey={sortKey} direction={sortDir} onSort={toggleSort} className="px-3 py-3" />}
                  {columns.desc && <SortHeader label="商品" column="description" activeKey={sortKey} direction={sortDir} onSort={toggleSort} className="px-3 py-3" />}
                  {columns.time && <SortHeader label="支付时间" column="paid_at" activeKey={sortKey} direction={sortDir} onSort={toggleSort} className="px-3 py-3" />}
                  <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((tx) => {
                  const statusMeta = TRADE_STATUS_META[tx.status];
                  const methodMeta = PAY_METHOD_META[tx.pay_method];
                  const MethodIcon = methodMeta.icon;
                  const isRefund = tx.trade_type === 'refund';
                  return (
                    <tr key={tx.wechat_trade_no} className="group transition-colors hover:bg-[#F9FAFB]/80">
                      <td className="sticky left-0 z-10 bg-white py-3.5 pl-4 pr-1 shadow-[1px_0_0_#EEF0F3] group-hover:bg-[#F9FAFB]">
                        <input
                          type="checkbox"
                          aria-label={'选择 ' + tx.wechat_trade_no}
                          checked={txSelected.includes(tx.wechat_trade_no)}
                          onChange={(e) => setTxSelected((prev) => (e.target.checked ? [...prev, tx.wechat_trade_no] : prev.filter((id) => id !== tx.wechat_trade_no)))}
                          className="h-3.5 w-3.5 cursor-pointer accent-[#111827]"
                        />
                      </td>
                      {columns.tradeNo && (
                      <td className="sticky left-9 z-10 bg-white px-3 py-3.5 shadow-[1px_0_0_#EEF0F3] group-hover:bg-[#F9FAFB]">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('flex h-6 w-6 items-center justify-center rounded-md', isRefund ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600')}>
                            {isRefund ? <RotateCcw className="h-3 w-3" /> : <ReceiptText className="h-3 w-3" />}
                          </span>
                          <span className="font-mono text-[11px] font-medium text-[#111827]">{tx.wechat_trade_no.slice(0, 16)}...{tx.wechat_trade_no.slice(-4)}</span>
                          <CopyButton value={tx.wechat_trade_no} />
                        </div>
                        <p className="mt-1 pl-7.5 font-mono text-[10px] text-[#9CA3AF]">{tx.merchant_trade_no}</p>
                      </td>
                      )}
                      {columns.merchant && (
                      <td className="px-3 py-3.5">
                        <p className="max-w-[180px] truncate text-xs font-medium text-[#111827]">{tx.merchant_name}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{tx.merchant_no}</p>
                      </td>
                      )}
                      {columns.amount && (
                      <td className="px-3 py-3.5">
                        <p className={cn('font-mono text-xs font-semibold', isRefund ? 'text-rose-600' : 'text-emerald-600')}>
                          {isRefund ? '-' : '+'}
                          {formatCNY(tx.amount_fen)}
                        </p>
                        {tx.refund_fen > 0 && (
                          <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">已退 {formatCNY(tx.refund_fen)}</p>
                        )}
                        <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{isRefund ? '退款交易' : '收款交易'}</p>
                      </td>
                      )}
                      {columns.method && (
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F9FAFB] px-2.5 py-1.5 text-[11px] font-medium text-[#4B5563]">
                          <MethodIcon className="h-3.5 w-3.5 text-[#6B7280]" />
                          {methodMeta.short}
                        </span>
                      </td>
                      )}
                      {columns.status && (
                      <td className="px-3 py-3.5">
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      </td>
                      )}
                      {columns.desc && (
                      <td className="max-w-[160px] truncate px-3 py-3.5 text-[11px] text-[#6B7280]">{tx.description}</td>
                      )}
                      {columns.time && (
                      <td className="px-3 py-3.5">
                        <p className="font-mono text-[11px] text-[#4B5563]">{tx.paid_at.slice(0, 10)}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{tx.paid_at.slice(11)}</p>
                      </td>
                      )}
                      <td className="py-3.5 pr-4 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDetail(tx)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
                        >
                          详情 <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={2 + Object.values(columns).filter(Boolean).length} className="py-16 text-center text-xs text-[#9CA3AF]">
                      <p>暂无符合筛选条件的交易流水</p>
                      <button type="button" onClick={resetFilters} className="mt-3 cursor-pointer rounded-lg bg-[#F3F4F6] px-3 py-1.5 font-medium text-[#374151] hover:bg-[#E5E7EB]">清空条件，查看全部</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={sorted.length} onPageChange={setPage} />
        </div>
      </Card>

      {txSelected.length > 0 && (
        <div role="region" aria-label="批量操作" className="animate-toast-in fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#111827] px-5 py-3 text-white shadow-[0_16px_40px_rgba(15,23,42,0.3)]">
          <span className="text-xs font-medium">已选 <span className="font-mono text-orange-300">{txSelected.length}</span> 条流水</span>
          <span className="h-4 w-px bg-white/15" />
          <button type="button" onClick={() => exportTransactions(true)} className="cursor-pointer rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-medium hover:bg-white/20">导出选中</button>
          <button type="button" onClick={() => { setTxSelected([]); push({ title: '已清空选择', tone: 'info' }); }} className="cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-medium text-gray-300 hover:bg-white/10 hover:text-white">清空</button>
        </div>
      )}

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="交易详情"
        subtitle={detail ? `微信支付单号 ${detail.wechat_trade_no}` : ''}
        icon={<Wallet className="h-4 w-4" />}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetail(null)}>
              关闭
            </Button>
            <Button
              variant="primary"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => {
                push({ title: '退款申请已发起', description: `原交易 ${detail?.wechat_trade_no.slice(-8)} · 需商户二次确认`, tone: 'info' });
                setDetail(null);
              }}
            >
              发起退款
            </Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#F9FAFB] p-5 text-center">
              <p className="text-[10px] text-[#9CA3AF]">{detail.trade_type === 'refund' ? '退款金额' : '实收金额'}</p>
              <p className={cn('mt-1.5 font-mono text-3xl font-semibold tracking-tight', detail.trade_type === 'refund' ? 'text-rose-600' : 'text-[#111827]')}>
                {formatCNY(detail.amount_fen)}
              </p>
              <div className="mt-2 flex justify-center gap-2">
                <Badge tone={TRADE_STATUS_META[detail.status].tone}>{TRADE_STATUS_META[detail.status].label}</Badge>
                <Badge tone={detail.trade_type === 'refund' ? 'rose' : 'emerald'}>{detail.trade_type === 'refund' ? '退款' : '收款'}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {[
                { label: '商户名称', value: detail.merchant_name },
                { label: '商户号', value: detail.merchant_no, mono: true },
                { label: '商户单号', value: detail.merchant_trade_no, mono: true },
                { label: '微信支付单号', value: detail.wechat_trade_no, mono: true },
                { label: '支付方式', value: PAY_METHOD_META[detail.pay_method].label },
                { label: '结算批次', value: detail.settled_at ? `STL-${detail.paid_at.slice(0, 10).replace(/-/g, '')}-091` : '待清算', mono: true },
                { label: '付款方 openid', value: detail.payer_openid, mono: true },
                { label: '商品描述', value: detail.description },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-[#F9FAFB] px-4 py-3">
                  <p className="text-[10px] text-[#9CA3AF]">{item.label}</p>
                  <p className={cn('mt-1 text-[11px] break-all text-[#111827]', item.mono && 'font-mono')}>{item.value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-[#374151]">交易时序</p>
              <div className="space-y-2">
                {[
                  { label: '用户发起支付', time: detail.paid_at, done: true },
                  { label: '微信支付网关受理', time: detail.paid_at, done: true },
                  { label: '交易资金入账', time: detail.status === 'success' ? detail.paid_at : '待完成', done: detail.status === 'success' },
                  { label: '清分结算至商户', time: detail.settled_at ?? '待结算', done: Boolean(detail.settled_at) },
                ].map((step) => (
                  <div key={step.label} className="flex items-center gap-2.5 rounded-lg bg-[#F9FAFB] px-3 py-2">
                    <span className={cn('flex h-4 w-4 items-center justify-center rounded-full', step.done ? 'bg-emerald-500 text-white' : 'bg-[#E5E7EB] text-[#9CA3AF]')}>
                      {step.done ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-2.5 w-2.5" />}
                    </span>
                    <span className="text-[11px] font-medium text-[#374151]">{step.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-[#9CA3AF]">{step.time}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-[#374151]">全链路追踪（毫秒级）</p>
                <span className="font-mono text-[9px] text-[#9CA3AF]">trace {detail.wechat_trade_no.slice(-12)} · 全程 {(180 + (Number(detail.wechat_trade_no.slice(-2)) % 400)).toFixed(0)}ms</span>
              </div>
              <div className="overflow-hidden rounded-xl bg-[#0B1220]">
                <div className="grid grid-cols-[86px_1fr_64px] gap-0 font-mono text-[9px]">
                  <div className="bg-white/5 px-2.5 py-1.5 text-gray-500">时间</div>
                  <div className="bg-white/5 px-2.5 py-1.5 text-gray-500">链路节点 / 日志</div>
                  <div className="bg-white/5 px-2.5 py-1.5 text-right text-gray-500">耗时</div>
                </div>
                {[
                  ['+0ms', '客户端发起 pay.unifiedorder · openid 校验通过', '3ms'],
                  ['+12ms', '风控 risk-engine：规则 42 条全过 · 评分 12', '28ms'],
                  ['+41ms', '路由 router：银联通道权重 62%，选中 CMB-01', '6ms'],
                  ['+48ms', '银行扣款 CMB 代扣 · 银行卡尾号 ' + detail.wechat_trade_no.slice(-4), '320ms'],
                  ['+372ms', '回调 callback：商户 HTTP 200 · 签名验证通过', '18ms'],
                  ['+391ms', '入账 ledger：资金冻结 → 可用余额，推送对账', '9ms'],
                ].map(([t, log, cost], i) => (
                  <div key={i} className="grid grid-cols-[86px_1fr_64px] gap-0 border-t border-white/5 font-mono text-[9px]">
                    <span className="px-2.5 py-1.5 text-orange-300">{t}</span>
                    <span className="px-2.5 py-1.5 text-gray-300">{log}</span>
                    <span className="px-2.5 py-1.5 text-right text-gray-400">{cost}</span>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 font-mono text-[9px] text-[#9CA3AF]">付款 IP {pseudoIp(detail)} · 设备指纹已绑定 · 诊断：{detail.status === 'failed' ? '银行返回余额不足，建议换卡重试' : '全链路正常'}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

interface RefundsProps {
  refunds: RefundException[];
  onRetry: (refundNo: string) => void;
}

export const RefundExceptionsPage: React.FC<RefundsProps> = ({ refunds, onRetry }) => {
  const { push } = useToast();
  const [tab, setTab] = useState<'all' | RefundStatus>('all');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<RefundException | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filtered = useMemo(
    () =>
      refunds.filter((item) => {
        const matchTab = tab === 'all' || item.status === tab;
        const query = keyword.trim().toLowerCase();
        const matchKeyword =
          !query ||
          item.refund_no.toLowerCase().includes(query) ||
          item.trade_no.toLowerCase().includes(query) ||
          item.merchant_name.includes(query) ||
          item.reason.includes(query);
        return matchTab && matchKeyword;
      }),
    [refunds, tab, keyword]
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const unresolved = refunds.filter((r) => r.status !== 'resolved');
  const totalAmount = unresolved.reduce((sum, r) => sum + r.amount_fen, 0);
  const counts = {
    all: refunds.length,
    pending: refunds.filter((r) => r.status === 'pending').length,
    retrying: refunds.filter((r) => r.status === 'retrying').length,
    manual_review: refunds.filter((r) => r.status === 'manual_review').length,
    resolved: refunds.filter((r) => r.status === 'resolved').length,
  };

  const reasonStats = useMemo(() => {
    const map = new Map<string, number>();
    refunds.forEach((item) => map.set(item.reason_code, (map.get(item.reason_code) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [refunds]);

  const exportRefunds = () => {
    downloadCsv(
      'refund-exceptions-20260224.csv',
      ['退款单号', '原交易单号', '商户', '金额(元)', '失败原因码', '失败原因', '重试次数', '状态', '创建时间'],
      filtered.map((item) => [
        item.refund_no,
        item.trade_no,
        item.merchant_name,
        (item.amount_fen / 100).toFixed(2),
        item.reason_code,
        item.reason,
        String(item.retry_count),
        REFUND_STATUS_META[item.status].label,
        item.created_at,
      ])
    );
    push({ title: `已导出 ${filtered.length} 笔异常退款`, description: '包含失败归因码与银行通道信息', tone: 'success' });
  };

  const bulkRetry = () => {
    const actionable = refunds.filter(
      (item) => selected.includes(item.refund_no) && item.status !== 'retrying' && item.status !== 'resolved'
    );
    if (actionable.length === 0) {
      push({ title: '没有可重试的退款单', description: '已解决的退款不可重复提交，请重新选择', tone: 'error' });
      return;
    }
    actionable.forEach((item) => onRetry(item.refund_no));
    push({ title: `已批量提交 ${actionable.length} 笔退款重试`, description: '系统将依次请求原清算通道并回写结果', tone: 'info' });
    setSelected([]);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Payment Domain / Refund Exceptions"
        title="异常退款池"
        description="集中处置因银行卡状态、账户冻结或通道异常导致的退款失败，支持原路重试与人工介入。"
        meta={<Badge tone="rose">{unresolved.length} 笔待处理</Badge>}
        actions={
          <Button variant="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={exportRefunds}>
            导出异常池
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-[11px] font-medium text-[#6B7280]">待处置退款金额</p>
          <p className="mt-2.5 font-mono text-xl font-semibold text-rose-600">{formatCNY(totalAmount)}</p>
          <p className="mt-1 text-[10px] text-[#9CA3AF]">含人工复核 2 笔 · 待重试 2 笔</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-medium text-[#6B7280]">平均处置时长</p>
          <p className="mt-2.5 font-mono text-xl font-semibold text-[#111827]">3.4<span className="ml-1 font-sans text-[11px] font-normal text-[#9CA3AF]">小时</span></p>
          <p className="mt-1 text-[10px] text-[#9CA3AF]">目标 SLA ≤ 4 小时</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-medium text-[#6B7280]">近 24h 自动重试</p>
          <p className="mt-2.5 font-mono text-xl font-semibold text-[#111827]">18<span className="ml-1 font-sans text-[11px] font-normal text-[#9CA3AF]">次</span></p>
          <p className="mt-1 text-[10px] text-[#9CA3AF]">成功恢复 14 笔 · 成功率 77.8%</p>
        </Card>
        <Card className="p-5">
          <p className="text-[11px] font-medium text-[#6B7280]">清算通道健康度</p>
          <div className="mt-2.5 flex items-center gap-2">
            <p className="font-mono text-xl font-semibold text-emerald-600">99.98%</p>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#F3F4F6]">
              <span className="block h-full w-[99%] rounded-full bg-emerald-500" />
            </span>
          </div>
          <p className="mt-1 text-[10px] text-[#9CA3AF]">银联 / 网联双通道自动切换</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Card className="p-6 xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'all' as const, label: '全部', count: counts.all },
                { key: 'pending' as const, label: '待重试', count: counts.pending },
                { key: 'retrying' as const, label: '重试中', count: counts.retrying },
                { key: 'manual_review' as const, label: '人工复核', count: counts.manual_review },
                { key: 'resolved' as const, label: '已解决', count: counts.resolved },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setTab(item.key);
                    setPage(1);
                  }}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-medium transition-all',
                    tab === item.key ? 'bg-[#111827] text-white' : 'bg-[#F9FAFB] text-[#6B7280] hover:text-[#111827]'
                  )}
                >
                  {item.label}
                  <span className={cn('rounded-full px-1.5 font-mono text-[9px]', tab === item.key ? 'bg-white/15' : 'bg-white text-[#9CA3AF]')}>
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索退款单号 / 商户 / 原因"
                  className="w-56 rounded-xl bg-[#F9FAFB] py-2.5 pr-3 pl-9 text-xs text-[#111827] placeholder-[#9CA3AF] outline-none transition-all focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={selected.length === 0}
                icon={<RefreshCcw className="h-3.5 w-3.5" />}
                onClick={bulkRetry}
              >
                批量重试{selected.length > 0 ? `（${selected.length}）` : ''}
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left">
              <thead>
                <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                  <th className="w-9 rounded-l-xl py-3 pl-4">
                    <input
                      type="checkbox"
                      aria-label="全选退款单"
                      checked={paged.length > 0 && paged.every((item) => selected.includes(item.refund_no))}
                      onChange={(e) => {
                        if (e.target.checked) setSelected(Array.from(new Set([...selected, ...paged.map((item) => item.refund_no)])));
                        else setSelected(selected.filter((id) => !paged.some((item) => item.refund_no === id)));
                      }}
                      className="h-3.5 w-3.5 cursor-pointer accent-[#111827]"
                    />
                  </th>
                  <th className="py-3 pr-3 font-medium">退款单号 / 商户</th>
                  <th className="px-3 py-3 font-medium">退款金额</th>
                  <th className="px-3 py-3 font-medium">失败原因</th>
                  <th className="px-3 py-3 font-medium">重试</th>
                  <th className="px-3 py-3 font-medium">状态</th>
                  <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((item) => {
                  const meta = REFUND_STATUS_META[item.status];
                  const isRetrying = item.status === 'retrying';
                  return (
                    <tr key={item.refund_no} className="group transition-colors hover:bg-[#F9FAFB]/80">
                      <td className="py-3.5 pl-4">
                        <input
                          type="checkbox"
                          aria-label={`选择退款单 ${item.refund_no}`}
                          checked={selected.includes(item.refund_no)}
                          onChange={(e) => {
                            setSelected((prev) => (e.target.checked ? [...prev, item.refund_no] : prev.filter((id) => id !== item.refund_no)));
                          }}
                          className="h-3.5 w-3.5 cursor-pointer accent-[#111827]"
                        />
                      </td>
                      <td className="py-3.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-medium text-[#111827]">{item.refund_no}</span>
                          <CopyButton value={item.refund_no} />
                        </div>
                        <p className="mt-1 max-w-[180px] truncate text-[10px] text-[#9CA3AF]">{item.merchant_name}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="font-mono text-xs font-semibold text-rose-600">{formatCNY(item.amount_fen)}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{item.bank_name}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="max-w-[220px] text-[11px] font-medium text-[#374151]">{item.reason}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{item.reason_code}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="font-mono text-[11px] text-[#4B5563]">{item.retry_count} 次</span>
                        <p className="mt-0.5 font-mono text-[9px] text-[#9CA3AF]">{item.last_attempt_at.slice(5, 16)}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="py-3.5 pr-4 pl-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            disabled={isRetrying || item.status === 'resolved'}
                            onClick={() => {
                              onRetry(item.refund_no);
                              push({
                                title: `已提交退款重试 · ${item.refund_no}`,
                                description: `${item.bank_name} 原路退回通道，预计 10 分钟内返回结果`,
                                tone: 'info',
                              });
                            }}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#111827] px-2.5 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-[#242d3d] disabled:cursor-not-allowed disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
                          >
                            {isRetrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                            {isRetrying ? '重试中' : '手动重试'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDetail(item)}
                            className="cursor-pointer rounded-lg px-2 py-1.5 text-[10px] font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
                          >
                            详情
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-xs text-[#9CA3AF]">
                      当前分类下暂无异常退款记录
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <h3 className="text-xs font-semibold text-[#111827]">失败原因分布</h3>
            </div>
            <div className="mt-4 space-y-3">
              {reasonStats.map(([code, count]) => (
                <div key={code}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono text-[#6B7280]">{code}</span>
                    <span className="font-mono font-medium text-[#111827]">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
                    <div className="h-full rounded-full bg-orange-400" style={{ width: `${(count / refunds.length) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-[#6B7280]" />
              <h3 className="text-xs font-semibold text-[#111827]">处置建议</h3>
            </div>
            <ul className="mt-3 space-y-2.5 text-[11px] leading-relaxed text-[#6B7280]">
              <li className="flex gap-2"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-orange-400" />银行卡注销或冻结时，建议联系商户通过线下转账完成退款并留存凭证。</li>
              <li className="flex gap-2"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-orange-400" />通道维护导致的失败，可等待 2 小时后批量重试，避免触发银行限流。</li>
              <li className="flex gap-2"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-orange-400" />命中风控规则的退款需先完成风险单复核，再释放退款指令。</li>
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="异常退款详情"
        subtitle={detail ? `${detail.refund_no} · 原交易 ${detail.trade_no}` : ''}
        icon={<RefreshCcw className="h-4 w-4" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDetail(null)}>
              关闭
            </Button>
            <Button
              variant="primary"
              icon={<RefreshCcw className="h-3.5 w-3.5" />}
              disabled={!detail || detail.status === 'resolved' || detail.status === 'retrying'}
              onClick={() => {
                if (!detail) return;
                onRetry(detail.refund_no);
                push({ title: '已重新提交退款', description: `${detail.refund_no} · 通过 ${detail.bank_name} 原路退回`, tone: 'info' });
                setDetail(null);
              }}
            >
              再次发起重试
            </Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#F9FAFB] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-rose-500" />
                  <span className="text-xs font-medium text-[#111827]">退款指令执行失败</span>
                </div>
                <Badge tone={REFUND_STATUS_META[detail.status].tone}>{REFUND_STATUS_META[detail.status].label}</Badge>
              </div>
              <p className="mt-2 font-mono text-2xl font-semibold text-rose-600">{formatCNY(detail.amount_fen)}</p>
              <p className="mt-1 text-[11px] text-[#6B7280]">{detail.reason}</p>
              <p className="mt-1 font-mono text-[10px] text-[#9CA3AF]">错误码 {detail.reason_code}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: '商户名称', value: detail.merchant_name },
                { label: '商户号', value: detail.merchant_no },
                { label: '收款银行', value: detail.bank_name },
                { label: '累计重试', value: `${detail.retry_count} 次` },
                { label: '创建时间', value: detail.created_at },
                { label: '最后尝试', value: detail.last_attempt_at },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-[#F9FAFB] px-4 py-3">
                  <p className="text-[10px] text-[#9CA3AF]">{item.label}</p>
                  <p className="mt-1 text-[11px] font-medium text-[#111827]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export const REFUND_META = REFUND_STATUS_META;
