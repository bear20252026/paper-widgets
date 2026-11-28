import React, { useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  CheckCircle2,
  Download,
  Edit3,
  Fingerprint,
  Globe2,
  IdCard,
  Laptop,
  Phone,
  AudioLines,
  Lock,
  Plus,
  Power,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Unlock,
  UserX,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CopyButton,
  FormField,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Switch,
  TextInput,
  Textarea,
  Tone,
  cn,
  downloadCsv,
  useToast,
} from '../components/ui';
import { formatCNYCompact } from '../lib/data';
import type {
  BlacklistDimension,
  BlacklistEntry,
  MerchantApplication,
  RiskStrategy,
  StrategyAction,
  StrategyScope,
} from '../lib/types';

const ACTION_META: Record<StrategyAction, { label: string; description: string; tone: Tone }> = {
  alert: { label: '仅告警', description: '推送风险工单，不阻断用户交易', tone: 'amber' },
  block_freeze: { label: '拦截并冻结', description: '立即阻断交易并冻结涉事零钱账户', tone: 'rose' },
};

const EMPTY_STRATEGY: Omit<RiskStrategy, 'strategy_id' | 'hits_24h' | 'updated_at'> = {
  name: '',
  scope: 'global',
  merchant_no: null,
  merchant_name: null,
  single_limit_fen: 500000,
  daily_limit_fen: 2000000,
  action: 'alert',
  enabled: true,
  owner: 'root',
  description: '',
};

interface StrategiesProps {
  strategies: RiskStrategy[];
  merchants: MerchantApplication[];
  onSave: (strategy: RiskStrategy) => void;
  onToggle: (strategyId: string, enabled: boolean) => void;
}

export const StrategiesPage: React.FC<StrategiesProps> = ({ strategies, merchants, onSave, onToggle }) => {
  const { push } = useToast();
  const [keyword, setKeyword] = useState('');
  const [scopeTab, setScopeTab] = useState<'all' | StrategyScope>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<RiskStrategy, 'strategy_id' | 'hits_24h' | 'updated_at'>>(EMPTY_STRATEGY);
  const [errors, setErrors] = useState<{ name?: string; merchant?: string }>({});
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const filtered = useMemo(
    () =>
      strategies.filter((strategy) => {
        const matchScope = scopeTab === 'all' || strategy.scope === scopeTab;
        const query = keyword.trim().toLowerCase();
        const matchKeyword =
          !query ||
          strategy.name.toLowerCase().includes(query) ||
          (strategy.merchant_name ?? '').toLowerCase().includes(query) ||
          strategy.strategy_id.toLowerCase().includes(query);
        return matchScope && matchKeyword;
      }),
    [strategies, scopeTab, keyword]
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalHits = strategies.reduce((sum, item) => sum + item.hits_24h, 0);

  const openCreate = () => {
    setEditingId(null);
    setDraft({ ...EMPTY_STRATEGY });
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (strategy: RiskStrategy) => {
    setEditingId(strategy.strategy_id);
    setDraft({
      name: strategy.name,
      scope: strategy.scope,
      merchant_no: strategy.merchant_no,
      merchant_name: strategy.merchant_name,
      single_limit_fen: strategy.single_limit_fen,
      daily_limit_fen: strategy.daily_limit_fen,
      action: strategy.action,
      enabled: strategy.enabled,
      owner: strategy.owner,
      description: strategy.description,
    });
    setErrors({});
    setModalOpen(true);
  };

  const saveStrategy = () => {
    const nextErrors: { name?: string; merchant?: string } = {};
    if (draft.name.trim().length < 2) nextErrors.name = '请输入不少于 2 个字的策略名称';
    if (draft.scope === 'merchant' && !draft.merchant_no) nextErrors.merchant = '特定商户范围必须选择目标商户';
    if (draft.daily_limit_fen < draft.single_limit_fen) {
      nextErrors.name = '单日限额不得低于单笔限额';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const selectedMerchant = merchants.find((m) => m.merchant_no === draft.merchant_no);
    const saved: RiskStrategy = {
      strategy_id: editingId ?? `RS-${2500 + strategies.length + Math.floor(Math.random() * 100)}`,
      name: draft.name.trim(),
      scope: draft.scope,
      merchant_no: draft.scope === 'merchant' ? draft.merchant_no : null,
      merchant_name: draft.scope === 'merchant' ? selectedMerchant?.company_name ?? null : null,
      single_limit_fen: draft.single_limit_fen,
      daily_limit_fen: draft.daily_limit_fen,
      action: draft.action,
      enabled: draft.enabled,
      hits_24h: editingId ? strategies.find((s) => s.strategy_id === editingId)?.hits_24h ?? 0 : 0,
      updated_at: '2026-02-24 15:12:08',
      owner: draft.owner,
      description: draft.description.trim() || '通过可视化限额与动作配置生成的实时风控策略。',
    };
    onSave(saved);
    push({
      title: editingId ? '风控策略已更新' : '风控策略创建成功',
      description: `${saved.name} · ${saved.scope === 'global' ? '全局生效' : saved.merchant_name} · ${ACTION_META[saved.action].label}`,
      tone: 'success',
    });
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Risk Domain / Policy Engine"
        title="风控策略配置"
        description="以可视化限额与处置动作编排实时交易风控策略，策略发布后 5 秒内全节点热生效。"
        meta={<Badge tone="emerald">{strategies.filter((s) => s.enabled).length} 条生效中</Badge>}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Download className="h-3.5 w-3.5 text-[#6B7280]" />}
              onClick={() => {
                downloadCsv(
                  'risk-strategies-20260224.csv',
                  ['策略编号', '策略名称', '生效范围', '单笔限额(元)', '单日限额(元)', '处置动作', '状态', '24h命中'],
                  strategies.map((s) => [
                    s.strategy_id,
                    s.name,
                    s.scope === 'global' ? '全局' : s.merchant_name ?? '特定商户',
                    (s.single_limit_fen / 100).toFixed(2),
                    (s.daily_limit_fen / 100).toFixed(2),
                    ACTION_META[s.action].label,
                    s.enabled ? '生效中' : '已停用',
                    String(s.hits_24h),
                  ])
                );
                push({ title: '策略清单已导出', description: `共 ${strategies.length} 条策略及限额配置`, tone: 'success' });
              }}
            >
              导出策略
            </Button>
            <Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>
              新建策略
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: '生效策略', value: `${strategies.filter((s) => s.enabled).length}`, unit: ` / ${strategies.length} 条`, hint: '全节点 5s 热更新', icon: ShieldCheck },
          { label: '24h 策略命中', value: totalHits.toLocaleString('zh-CN'), unit: ' 次', hint: '较昨日 +8.7%', icon: Activity },
          { label: '拦截冻结资金', value: '¥ 218,400', unit: '', hint: '高风险交易 21 笔', icon: Lock },
          { label: '全局覆盖率', value: '100', unit: '%', hint: '支付链路全部接入', icon: Globe2 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-[#6B7280]">{item.label}</p>
                <Icon className="h-4 w-4 text-[#9CA3AF]" />
              </div>
              <p className="mt-2.5 font-mono text-xl font-semibold tracking-tight text-[#111827]">
                {item.value}
                <span className="ml-0.5 font-sans text-[10px] font-normal text-[#9CA3AF]">{item.unit}</span>
              </p>
              <p className="mt-1 text-[10px] text-[#9CA3AF]">{item.hint}</p>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {[
            { key: 'all' as const, label: '全部策略' },
            { key: 'global' as const, label: '全局生效' },
            { key: 'merchant' as const, label: '特定商户' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setScopeTab(item.key);
                setPage(1);
              }}
              className={cn(
                'cursor-pointer rounded-xl px-3.5 py-2 text-xs font-medium transition-all',
                scopeTab === item.key ? 'bg-[#111827] text-white' : 'bg-white text-[#6B7280] hover:text-[#111827]'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder="搜索策略名称、编号或商户"
            className="w-64 rounded-xl bg-white py-2.5 pr-3 pl-9 text-xs text-[#111827] placeholder-[#9CA3AF] shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {paged.map((strategy) => {
          const action = ACTION_META[strategy.action];
          return (
            <Card key={strategy.strategy_id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', strategy.enabled ? 'bg-[#111827] text-white' : 'bg-[#F3F4F6] text-[#9CA3AF]')}>
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[13px] font-semibold text-[#111827]">{strategy.name}</h3>
                      <span className="font-mono text-[10px] text-[#9CA3AF]">{strategy.strategy_id}</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
                      {strategy.scope === 'global' ? (
                        <><Globe2 className="h-3 w-3" /> 全局生效</>
                      ) : (
                        <><Users className="h-3 w-3" /> {strategy.merchant_name}</>
                      )}
                      <span className="text-[#D1D5DB]">·</span>
                      <span>近 24h 命中 {strategy.hits_24h} 次</span>
                    </p>
                  </div>
                </div>
                <Switch
                  checked={strategy.enabled}
                  label={`${strategy.name}启停`}
                  onChange={(next) => {
                    onToggle(strategy.strategy_id, next);
                    push({
                      title: next ? '策略已启用' : '策略已停用',
                      description: `${strategy.name} · 变更将于 5 秒内同步至支付网关`,
                      tone: next ? 'success' : 'info',
                    });
                  }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-[#F9FAFB] px-3.5 py-2.5">
                  <p className="text-[10px] text-[#9CA3AF]">单笔限额</p>
                  <p className="mt-1 font-mono text-xs font-semibold text-[#111827]">{formatCNYCompact(strategy.single_limit_fen)}</p>
                </div>
                <div className="rounded-xl bg-[#F9FAFB] px-3.5 py-2.5">
                  <p className="text-[10px] text-[#9CA3AF]">单日限额</p>
                  <p className="mt-1 font-mono text-xs font-semibold text-[#111827]">{formatCNYCompact(strategy.daily_limit_fen)}</p>
                </div>
              </div>

              <p className="mt-3 line-clamp-2 text-[11px] leading-relaxed text-[#6B7280]">{strategy.description}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={action.tone}>{action.label}</Badge>
                <Badge tone={strategy.enabled ? 'emerald' : 'slate'}>{strategy.enabled ? '生效中' : '已停用'}</Badge>
                <span className="ml-auto font-mono text-[10px] text-[#9CA3AF]">{strategy.updated_at.slice(0, 16)}</span>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-[#F3F4F6] pt-3">
                <Button size="sm" variant="secondary" icon={<Edit3 className="h-3 w-3 text-[#6B7280]" />} onClick={() => openEdit(strategy)} className="flex-1">
                  编辑策略
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Activity className="h-3 w-3" />}
                  onClick={() => push({ title: `${strategy.name} · 命中明细`, description: '近 24 小时共命中 ' + strategy.hits_24h + ' 次，其中高风险 12 次，已推送处置工单', tone: 'info' })}
                >
                  命中日志
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="p-2">
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? '编辑风控策略' : '新建风控策略'}
        subtitle="配置生效范围、交易限额与命中后的处置动作，策略保存即刻生效"
        icon={<SlidersHorizontal className="h-4 w-4" />}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button variant="primary" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={saveStrategy}>
              保存并发布策略
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="策略名称" required error={errors.name} hint="便于运营识别的业务名称">
            <TextInput
              value={draft.name}
              onChange={(e) => {
                setDraft({ ...draft, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              placeholder="如：夜间大额交易熔断"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="生效范围" required>
              <Select
                value={draft.scope}
                onChange={(e) => {
                  const nextScope = e.target.value as StrategyScope;
                  setDraft({
                    ...draft,
                    scope: nextScope,
                    merchant_no: nextScope === 'global' ? null : draft.merchant_no,
                    merchant_name: nextScope === 'global' ? null : draft.merchant_name,
                  });
                }}
              >
                <option value="global">全局生效（所有商户）</option>
                <option value="merchant">特定商户</option>
              </Select>
            </FormField>
            <FormField label="启用状态">
              <div className="flex h-[42px] items-center justify-between rounded-xl bg-[#F9FAFB] px-3.5">
                <span className="text-xs text-[#4B5563]">{draft.enabled ? '立即生效' : '保存为停用草稿'}</span>
                <Switch checked={draft.enabled} onChange={(next) => setDraft({ ...draft, enabled: next })} />
              </div>
            </FormField>
          </div>

          {draft.scope === 'merchant' && (
            <FormField label="目标商户" required error={errors.merchant}>
              <Select
                value={draft.merchant_no ?? ''}
                onChange={(e) => {
                  const merchant = merchants.find((m) => m.merchant_no === e.target.value);
                  setDraft({ ...draft, merchant_no: e.target.value || null, merchant_name: merchant?.company_name ?? null });
                  if (errors.merchant) setErrors({ ...errors, merchant: undefined });
                }}
              >
                <option value="">请选择目标商户</option>
                {merchants.map((merchant) => (
                  <option key={merchant.merchant_no} value={merchant.merchant_no}>
                    {merchant.company_name} · {merchant.merchant_no}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          <div className="space-y-4 rounded-2xl bg-[#F9FAFB] p-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#374151]">单笔交易限额</label>
                <span className="font-mono text-xs font-semibold text-[#111827]">{formatCNYCompact(draft.single_limit_fen)}</span>
              </div>
              <input
                type="range"
                min={10000}
                max={5000000}
                step={10000}
                value={draft.single_limit_fen}
                onChange={(e) => setDraft({ ...draft, single_limit_fen: Number(e.target.value) })}
                className="range-slider mt-2 w-full"
                aria-label="单笔交易限额"
              />
              <div className="mt-1 flex justify-between font-mono text-[9px] text-[#9CA3AF]">
                <span>¥100</span>
                <span>¥50,000</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[#374151]">单日累计限额</label>
                <span className="font-mono text-xs font-semibold text-[#111827]">{formatCNYCompact(draft.daily_limit_fen)}</span>
              </div>
              <input
                type="range"
                min={50000}
                max={20000000}
                step={50000}
                value={draft.daily_limit_fen}
                onChange={(e) => setDraft({ ...draft, daily_limit_fen: Number(e.target.value) })}
                className="range-slider mt-2 w-full"
                aria-label="单日累计限额"
              />
              <div className="mt-1 flex justify-between font-mono text-[9px] text-[#9CA3AF]">
                <span>¥500</span>
                <span>¥200,000</span>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-[#374151]">命中后处置动作（单选）</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(Object.keys(ACTION_META) as StrategyAction[]).map((key) => {
                const meta = ACTION_META[key];
                const active = draft.action === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDraft({ ...draft, action: key })}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-xl p-3.5 text-left transition-all',
                      active ? 'bg-white shadow-[0_0_0_1.5px_#111827]' : 'bg-[#F9FAFB] hover:bg-[#F3F4F6]'
                    )}
                  >
                    <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full', active ? 'bg-[#111827] text-white' : 'bg-[#E5E7EB]')}>
                      {active && <CheckCircle2 className="h-2.5 w-2.5" />}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-[#111827]">{meta.label}</p>
                        <Badge tone={meta.tone} dot={false}>{key === 'alert' ? 'L1' : 'L2'}</Badge>
                      </div>
                      <p className="mt-1 text-[10px] leading-relaxed text-[#9CA3AF]">{meta.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <FormField label="策略说明" hint="可选">
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="描述策略的业务背景、适用时段与豁免条件..."
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
};

/* =============================== 黑名单治理 =============================== */

const DIMENSION_META: Record<BlacklistDimension, { label: string; icon: React.ComponentType<{ className?: string }>; tone: Tone; hint: string; sample: string; prefix: string }> = {
  user: { label: '用户 UID', icon: UserX, tone: 'rose', hint: 'UID 级账号拦截', sample: 'wx_uid_88492265', prefix: 'BL-U' },
  idcard: { label: '身份证', icon: IdCard, tone: 'orange', hint: '实名主体全量拦截', sample: '350203********1514', prefix: 'BL-C' },
  phone: { label: '手机号', icon: Phone, tone: 'amber', hint: '注册 / 绑卡拦截', sample: '171****8842', prefix: 'BL-P' },
  device: { label: '设备 IMEI/MAC', icon: Laptop, tone: 'violet', hint: '硬件指纹拦截', sample: 'A4:C3:F0:19:8B:2D', prefix: 'BL-D' },
  ip: { label: '恶意 IP 段', icon: Globe2, tone: 'sky', hint: 'C 段网段与单 IP', sample: '192.0.2.0/24', prefix: 'BL-I' },
  voice: { label: '声纹', icon: AudioLines, tone: 'slate', hint: '电诈语音声纹比对', sample: 'VP-7F21A9C3', prefix: 'BL-V' },
};

interface BlacklistProps {
  entries: BlacklistEntry[];
  onRemove: (entryId: string) => void;
  onAdd: (entry: BlacklistEntry) => void;
}

export const BlacklistPage: React.FC<BlacklistProps> = ({ entries, onRemove, onAdd }) => {
  const { push } = useToast();
  const [dimension, setDimension] = useState<BlacklistDimension>('user');
  const [keyword, setKeyword] = useState('');
  const [unbanTarget, setUnbanTarget] = useState<BlacklistEntry | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState({ dimension: 'user' as BlacklistDimension, value: '', reason: '' });
  const [addError, setAddError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const dimensionEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (entry.dimension !== dimension) return false;
        const query = keyword.trim().toLowerCase();
        return !query || entry.value.toLowerCase().includes(query) || entry.reason.includes(query) || entry.entry_id.toLowerCase().includes(query);
      }),
    [entries, dimension, keyword]
  );

  const paged = dimensionEntries.slice((page - 1) * pageSize, page * pageSize);
  const counts: Record<BlacklistDimension, number> = {
    user: entries.filter((e) => e.dimension === 'user').length,
    idcard: entries.filter((e) => e.dimension === 'idcard').length,
    phone: entries.filter((e) => e.dimension === 'phone').length,
    device: entries.filter((e) => e.dimension === 'device').length,
    ip: entries.filter((e) => e.dimension === 'ip').length,
    voice: entries.filter((e) => e.dimension === 'voice').length,
  };

  const downloadEntries = () => {
    downloadCsv(
      `blacklist-${dimension}-20260224.csv`,
      ['条目编号', '黑名单值', '维度', '关联账号数', '加入原因', '来源', '操作人', '加入时间'],
      dimensionEntries.map((entry) => [
        entry.entry_id,
        entry.value,
        DIMENSION_META[entry.dimension].label,
        String(entry.related_accounts),
        entry.reason,
        entry.source,
        entry.operator,
        entry.added_at,
      ])
    );
    push({ title: '黑名单数据已导出', description: `${DIMENSION_META[dimension].label} · ${dimensionEntries.length} 条记录`, tone: 'success' });
  };

  const submitAdd = () => {
    if (!addDraft.value.trim() || addDraft.reason.trim().length < 4) {
      setAddError('请填写黑名单值与不少于 4 个字的加入原因');
      return;
    }
    const prefix = DIMENSION_META[addDraft.dimension].prefix;
    onAdd({
      entry_id: `${prefix}-${Math.floor(Math.random() * 9000 + 1000)}`,
      dimension: addDraft.dimension,
      value: addDraft.value.trim(),
      related_accounts: 0,
      reason: addDraft.reason.trim(),
      source: '人工录入',
      operator: 'root',
      added_at: '2026-02-24 15:18:32',
    });
    push({ title: '黑名单条目已加入', description: `${addDraft.value.trim()} · 实时同步至风控引擎`, tone: 'success' });
    setAddOpen(false);
    setAddDraft({ dimension: 'user', value: '', reason: '' });
    setAddError('');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Risk Domain / List Governance"
        title="黑名单治理"
        description="用户 UID / 身份证 / 手机号 · 设备 IMEI-MAC 指纹 · 恶意 IP 段 · 声纹 · 名单变更秒级同步全链路"
        meta={<Badge tone="rose">{entries.length} 条生效中</Badge>}
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-3.5 w-3.5 text-[#6B7280]" />} onClick={downloadEntries}>
              下载名单
            </Button>
            <Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddOpen(true)}>
              新增黑名单
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {(Object.keys(DIMENSION_META) as BlacklistDimension[]).map((key) => {
          const meta = DIMENSION_META[key];
          const Icon = meta.icon;
          const active = dimension === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setDimension(key);
                setPage(1);
              }}
              className={cn(
                'flex cursor-pointer flex-col rounded-2xl bg-white p-4 text-left transition-all',
                active ? 'shadow-[0_0_0_2px_#111827,0_12px_30px_-16px_rgba(15,23,42,0.24)]' : 'shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_10px_26px_-16px_rgba(15,23,42,0.18)]'
              )}
            >
              <div className="flex items-center justify-between">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', active ? 'bg-[#111827] text-white' : 'bg-[#F9FAFB] text-[#6B7280]')}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="font-mono text-lg font-semibold text-[#111827]">{String(counts[key]).padStart(2, '0')}</span>
              </div>
              <p className="mt-3 text-xs font-semibold text-[#111827]">{meta.label}</p>
              <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{meta.hint}</p>
            </button>
          );
        })}
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#111827]">{DIMENSION_META[dimension].label}</h3>
            <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 font-mono text-[10px] text-[#6B7280]">{dimensionEntries.length} records</span>
          </div>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              placeholder="搜索黑名单值、原因或编号"
              className="w-64 rounded-xl bg-[#F9FAFB] py-2.5 pr-3 pl-9 text-xs text-[#111827] placeholder-[#9CA3AF] outline-none transition-all focus:bg-white focus:shadow-[0_0_0_2px_rgba(17,24,39,0.09)]"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                <th className="rounded-l-xl py-3 pr-3 pl-4 font-medium">黑名单值</th>
                <th className="px-3 py-3 font-medium">关联账号数</th>
                <th className="px-3 py-3 font-medium">加入原因 / 来源</th>
                <th className="px-3 py-3 font-medium">操作人</th>
                <th className="px-3 py-3 font-medium">加入时间</th>
                <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((entry) => {
                const Icon = DIMENSION_META[entry.dimension].icon;
                return (
                  <tr key={entry.entry_id} className="group transition-colors hover:bg-[#F9FAFB]/80">
                    <td className="py-3.5 pr-3 pl-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F9FAFB] text-[#6B7280]">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-medium text-[#111827]">{entry.value}</span>
                            <CopyButton value={entry.value} />
                          </div>
                          <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{entry.entry_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-semibold', entry.related_accounts >= 5 ? 'bg-rose-50 text-rose-700' : 'bg-[#F3F4F6] text-[#4B5563]')}>
                          {entry.related_accounts}
                        </span>
                        <span className="text-[10px] text-[#9CA3AF]">个账号</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="max-w-[280px] text-[11px] text-[#374151]">{entry.reason}</p>
                      <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{entry.source}</p>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="text-[11px] text-[#4B5563]">{entry.operator}</span>
                    </td>
                    <td className="px-3 py-3.5 font-mono text-[11px] text-[#6B7280]">{entry.added_at}</td>
                    <td className="py-3.5 pr-4 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setUnbanTarget(entry)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                        >
                          <Unlock className="h-3 w-3" /> 解封
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            downloadCsv(
                              `${entry.entry_id}.csv`,
                              ['条目编号', '维度', '黑名单值', '关联账号数', '原因', '操作人', '加入时间'],
                              [[entry.entry_id, DIMENSION_META[entry.dimension].label, entry.value, String(entry.related_accounts), entry.reason, entry.operator, entry.added_at]]
                            );
                            push({ title: '条目凭证已下载', description: entry.entry_id, tone: 'success' });
                          }}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
                        >
                          <Download className="h-3 w-3" /> 下载
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-xs text-[#9CA3AF]">
                    当前维度下暂无匹配的黑名单条目
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={dimensionEntries.length} onPageChange={setPage} />
      </Card>

      <Modal
        open={Boolean(unbanTarget)}
        onClose={() => setUnbanTarget(null)}
        title="解除黑名单限制"
        subtitle="解封后该主体可立即恢复登录、支付与营销活动资格，请确认风险已消除"
        icon={<Unlock className="h-4 w-4" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setUnbanTarget(null)}>
              取消
            </Button>
            <Button
              variant="success"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              onClick={() => {
                if (!unbanTarget) return;
                onRemove(unbanTarget.entry_id);
                push({ title: '黑名单已解除', description: `${unbanTarget.value} 已从${DIMENSION_META[unbanTarget.dimension].label}移除`, tone: 'success' });
                setUnbanTarget(null);
              }}
            >
              确认解封
            </Button>
          </>
        }
      >
        {unbanTarget && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[#F9FAFB] p-4">
              <p className="text-[10px] text-[#9CA3AF]">黑名单值</p>
              <p className="mt-1 font-mono text-sm font-medium text-[#111827]">{unbanTarget.value}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-[#6B7280]">加入原因：{unbanTarget.reason}</p>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3.5 text-[11px] leading-relaxed text-amber-800">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              解封操作将写入不可篡改的审计日志，并通知风控负责人。若该主体再次命中策略，将自动重新加入并升级处置等级。
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="新增黑名单条目"
        subtitle="录入后将立即同步至风控引擎，建议确认主体信息后再提交"
        icon={<Ban className="h-4 w-4" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={submitAdd}>
              加入黑名单
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="黑名单维度" required>
            <Select
              value={addDraft.dimension}
              onChange={(e) => setAddDraft({ ...addDraft, dimension: e.target.value as BlacklistDimension })}
            >
              <option value="user">用户黑名单（UID）</option>
              <option value="device">设备 MAC 黑名单</option>
              <option value="ip">恶意 IP 段</option>
              <option value="idcard">身份证黑名单</option>
              <option value="phone">手机号黑名单</option>
              <option value="voice">声纹黑名单</option>
            </Select>
          </FormField>
          <FormField label="黑名单值" required hint={`如 ${DIMENSION_META[addDraft.dimension].sample}`} error={addError || undefined}>
            <TextInput
              value={addDraft.value}
              onChange={(e) => {
                setAddDraft({ ...addDraft, value: e.target.value });
                setAddError('');
              }}
              placeholder="请输入精确的黑名单主体值"
              className="font-mono"
            />
          </FormField>
          <FormField label="加入原因" required>
            <Textarea
              rows={3}
              value={addDraft.reason}
              onChange={(e) => {
                setAddDraft({ ...addDraft, reason: e.target.value });
                setAddError('');
              }}
              placeholder="请描述命中规则、涉案情况或人工判定依据..."
            />
          </FormField>
          <div className="flex items-center gap-2 rounded-xl bg-[#F9FAFB] px-3.5 py-2.5 text-[10px] text-[#9CA3AF]">
            <Fingerprint className="h-3.5 w-3.5" /> 操作人：root · 来源：人工录入 · 同步链路：风控引擎 / 支付网关
          </div>
        </div>
      </Modal>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">自动解封策略</h3>
            <p className="mt-1 text-[11px] text-[#9CA3AF]">轻度违规 7 天无再犯自动移出 · 中度 30 天 · 重度永不自动解封</p>
          </div>
          <Badge tone="emerald">策略运行中</Badge>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ['轻度 · 营销打扰', '7 天后自动解封', '128 条待到期', 'emerald'],
            ['中度 · 批量注册', '30 天后人工复核解封', '36 条待复核', 'amber'],
            ['重度 · 欺诈洗钱', '永不自动解封', '12 条永久冻结', 'rose'],
          ].map(([t, d, c]) => (
            <div key={t as string} className="rounded-xl bg-[#F9FAFB] px-3.5 py-3">
              <p className="text-[11px] font-semibold text-[#111827]">{t}</p>
              <p className="mt-0.5 text-[10px] text-[#6B7280]">{d}</p>
              <p className="mt-1 font-mono text-[10px] text-[#9CA3AF]">{c}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-5 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 名单数据每小时与集团反诈黑库自动双向同步 · 覆盖身份证 / 手机号 / IMEI / 声纹
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#9CA3AF]">
          <span className="inline-flex items-center gap-1"><Power className="h-3 w-3" /> 拦截链路正常</span>
          <span className="inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> 近 30 天自动清除 14 条过期条目</span>
        </div>
      </div>
    </div>
  );
};
