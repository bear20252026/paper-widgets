import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Cpu,
  Download,
  FlaskConical,
  GitBranch,
  GripVertical,
  History,
  Laptop,
  Lock,
  MapPin,
  Network,
  Plus,
  Radar,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { Badge, Button, Card, Modal, PageHeader, SectionTitle, Select, TextInput, Tone, cn, downloadCsv, useToast } from '../components/ui';
import { RISK_CASES, RISK_GRAPH_EDGES, RISK_GRAPH_NODES, STRATEGY_VERSIONS, VISUAL_RULES, formatFen } from '../lib/ops';
import type { RiskCase, VisualRule } from '../lib/ops';

const RULE_STATUS: Record<VisualRule['status'], { label: string; tone: Tone }> = {
  draft: { label: '草稿', tone: 'slate' },
  gray: { label: '灰度中', tone: 'amber' },
  live: { label: '全量生效', tone: 'emerald' },
  rolledback: { label: '已回滚', tone: 'rose' },
};

const FACTOR_GROUPS: { label: string; fields: string[] }[] = [
  { label: '交易因子', fields: ['交易金额', '单日交易额', '提现金额', '1小时代付笔数', '历史拒付率'] },
  { label: '设备因子', fields: ['设备类型', '设备注册天数', '同设备账号数', 'Root/越狱'] },
  { label: '身份因子', fields: ['实名等级', '收款卡年龄', '黑名单命中', '账号注册天数'] },
  { label: '时空因子', fields: ['IP归属地', '时段', 'GPS 漂移距离', '代理 IP'] },
];

const FIELD_OPTIONS = FACTOR_GROUPS.flatMap((g) => g.fields);

const DEFAULT_VALUE_BY_FIELD: Record<string, { op: string; value: string }> = {
  交易金额: { op: '>', value: '10000 元' },
  单日交易额: { op: '>', value: '50000 元' },
  提现金额: { op: '>', value: '50000 元' },
  '1小时代付笔数': { op: '>', value: '5 笔' },
  历史拒付率: { op: '>', value: '3%' },
  设备类型: { op: '=', value: '模拟器/改机' },
  设备注册天数: { op: '<', value: '7 天' },
  同设备账号数: { op: '>', value: '3 个' },
  'Root/越狱': { op: '=', value: 'true' },
  实名等级: { op: '<', value: 'L2' },
  收款卡年龄: { op: '<', value: '30 天' },
  黑名单命中: { op: '=', value: 'true' },
  账号注册天数: { op: '<', value: '3 天' },
  IP归属地: { op: '!=', value: '常驻地' },
  时段: { op: 'in', value: '23:00-06:00' },
  'GPS 漂移距离': { op: '>', value: '500 km/h' },
  '代理 IP': { op: '=', value: 'true' },
};
const OP_OPTIONS = ['>', '<', '=', '!=', 'in', 'not in', 'contains'];
const ACTION_OPTIONS = ['仅告警', '拦截并冻结', '转人工复核', '降额放行', '设备拉黑'];

/* ============================ 规则编排实验室 ============================ */

export const StrategyLabPage: React.FC = () => {
  const { push } = useToast();
  const [rules, setRules] = useState<VisualRule[]>(VISUAL_RULES);
  const [versions] = useState(STRATEGY_VERSIONS);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftLogic, setDraftLogic] = useState<'AND' | 'OR'>('AND');
  const [draftConds, setDraftConds] = useState<{ field: string; op: string; value: string }[]>([
    { field: '交易金额', op: '>', value: '10000 元' },
    { field: 'IP归属地', op: '!=', value: '常驻地' },
  ]);
  const [draftAction, setDraftAction] = useState('拦截并冻结');
  const [dropActive, setDropActive] = useState(false);
  const [trashActive, setTrashActive] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const buildCondition = (field: string) => ({ field, ...(DEFAULT_VALUE_BY_FIELD[field] ?? { op: '>', value: '' }) });

  const appendFactor = (field: string) => {
    if (draftConds.length >= 6) {
      push({ title: '条件已达上限', description: '单条规则最多 6 个条件，建议拆分为多条规则', tone: 'error' });
      return;
    }
    setDraftConds((prev) => [...prev, buildCondition(field)]);
  };

  /** 统一处理画布拖放：新增因子插入到 targetIndex，已有条件则移动排序 */
  const handleCanvasDrop = (raw: string, targetIndex: number) => {
    try {
      const payload = JSON.parse(raw) as { type: string; field?: string; index?: number };
      if (payload.type === 'factor' && payload.field) {
        if (draftConds.length >= 6) {
          push({ title: '条件已达上限', description: '单条规则最多 6 个条件', tone: 'error' });
          return;
        }
        const next = buildCondition(payload.field);
        setDraftConds((prev) => [...prev.slice(0, targetIndex), next, ...prev.slice(targetIndex)]);
      } else if (payload.type === 'move' && typeof payload.index === 'number') {
        const from = payload.index;
        setDraftConds((prev) => {
          const list = [...prev];
          const [moved] = list.splice(from, 1);
          const to = targetIndex > from ? targetIndex - 1 : targetIndex;
          list.splice(Math.min(to, list.length), 0, moved);
          return list;
        });
      }
    } catch {
      /* 非法拖拽数据直接忽略 */
    }
  };

  const liveCount = rules.filter((r) => r.status === 'live').length;
  const grayCount = rules.filter((r) => r.status === 'gray').length;

  const saveDraft = () => {
    if (draftName.trim().length < 2) {
      push({ title: '请填写规则名称', description: '至少 2 个字', tone: 'error' });
      return;
    }
    if (draftConds.some((c) => !c.value.trim())) {
      push({ title: '条件值不能为空', description: '请补全每条 if 条件的比较值', tone: 'error' });
      return;
    }
    const id = `VR-${300 + rules.length + Math.floor(Math.random() * 50)}`;
    setRules((prev) => [{ id, name: draftName.trim(), conditions: draftConds, logic: draftLogic, action: draftAction, grayPct: 0, killRate: 0, status: 'draft' }, ...prev]);
    push({ title: '规则草稿已保存', description: `${id} · 建议先灰度 1% 观察误杀率`, tone: 'success' });
    setBuilderOpen(false);
    setDraftName('');
  };

  const setGray = (id: string, pct: number) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, grayPct: pct, status: pct >= 100 ? 'live' as const : pct > 0 ? 'gray' as const : 'draft' as const, killRate: pct > 0 ? 0.05 + Math.random() * 0.3 : 0 } : r)));
  };

  const rollback = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'rolledback' as const, grayPct: 0 } : r)));
    push({ title: '已一键回滚', description: `${id} · 流量已切回上一个稳定版本，全网 5 秒生效`, tone: 'success' });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Risk Brain / Rule Lab"
        title="规则编排实验室"
        description="Drools 级可视化规则：if 条件编排 → 灰度放量 → 全量发布 → 一键回滚，误杀率实时 guard"
        meta={<Badge tone="emerald">{liveCount} 全量 · {grayCount} 灰度</Badge>}
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-3.5 w-3.5 text-[#6B7280]" />} onClick={() => { downloadCsv('visual-rules.csv', ['编号', '名称', '逻辑', '动作', '灰度', '误杀率', '状态'], rules.map((r) => [r.id, r.name, r.logic, r.action, String(r.grayPct), String(r.killRate), RULE_STATUS[r.status].label])); push({ title: '规则清单已导出', description: `${rules.length} 条可视化规则`, tone: 'success' }); }}>
              导出规则
            </Button>
            <Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setBuilderOpen(true)}>
              编排新规则
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
        <div className="space-y-3.5 xl:col-span-2">
          {rules.map((rule) => {
            const meta = RULE_STATUS[rule.status];
            return (
              <Card key={rule.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[13px] font-semibold text-[#111827]">{rule.name}</h3>
                      <span className="font-mono text-[10px] text-[#9CA3AF]">{rule.id}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-[#111827] px-1.5 py-1 font-mono text-[10px] text-white">IF</span>
                      {rule.conditions.map((c, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className={cn('rounded-md px-1.5 py-1 font-mono text-[10px] font-bold', rule.logic === 'AND' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700')}>{rule.logic}</span>}
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#F9FAFB] px-2 py-1.5 font-mono text-[10px] text-[#374151]">
                            <span className="font-semibold text-[#111827]">{c.field}</span>
                            <span className="text-orange-600">{c.op}</span>
                            <span>{c.value}</span>
                          </span>
                        </React.Fragment>
                      ))}
                      <ChevronRight className="h-3 w-3 text-[#9CA3AF]" />
                      <span className="rounded-md bg-white px-1.5 py-1 font-mono text-[10px] text-[#9CA3AF] shadow-xs">THEN</span>
                      <span className="rounded-lg bg-orange-50 px-2 py-1.5 text-[10px] font-medium text-orange-700">{rule.action}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 rounded-xl bg-[#F9FAFB] p-3.5 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-medium text-[#4B5563]">灰度放量</span>
                      <span className="font-mono font-semibold text-[#111827]">{rule.grayPct}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={1} value={rule.grayPct} onChange={(e) => setGray(rule.id, Number(e.target.value))} className="range-slider mt-2 w-full" aria-label={`${rule.name}灰度`} />
                    <div className="mt-1 flex justify-between font-mono text-[8px] text-[#9CA3AF]"><span>0%</span><span>1% 观察</span><span>20%</span><span>100% 全量</span></div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                    <span className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[10px]', rule.killRate > 1 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>
                      <FlaskConical className="h-3 w-3" />误杀 {rule.killRate.toFixed(2)}%
                    </span>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setGray(rule.id, 100)} className="cursor-pointer rounded-lg bg-[#111827] px-2.5 py-1.5 text-[10px] font-medium text-white hover:bg-[#242d3d]">全量</button>
                      <button type="button" onClick={() => rollback(rule.id)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-medium text-[#6B7280] shadow-xs hover:text-rose-600"><RotateCcw className="h-3 w-3" />回滚</button>
                    </div>
                  </div>
                </div>
                {rule.killRate > 1 && (
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-rose-600"><AlertTriangle className="h-3 w-3" />误杀率超过 1% 红线，已自动冻结继续放量，请先回滚排查</p>
                )}
              </Card>
            );
          })}
        </div>

        <div className="space-y-3.5">
          <Card className="p-5">
            <SectionTitle title="版本与回滚" subtitle="每次发布自动快照，可回滚到任一稳定版" right={<History className="h-4 w-4 text-[#9CA3AF]" />} />
            <div className="mt-4 space-y-0">
              {versions.map((v, i) => (
                <div key={v.version} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-full', v.stable ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')}>
                      {v.stable ? <CheckCircle2 className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                    </span>
                    {i < versions.length - 1 && <span className="h-10 w-px bg-[#E5E7EB]" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-[#111827]">{v.version}</span>
                      <span className="font-mono text-[9px] text-[#9CA3AF]">{v.time.slice(5)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-[#6B7280]">{v.change}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono text-[9px] text-[#9CA3AF]">{v.author} · 灰度 {v.grayPct}% · 误杀 {v.killRate}%</span>
                      {i > 0 && v.stable && (
                        <button type="button" onClick={() => push({ title: `已回滚到 ${v.version}`, description: '规则快照已恢复，全网 5 秒生效', tone: 'success' })} className="cursor-pointer rounded-md bg-[#F9FAFB] px-1.5 py-1 text-[9px] font-medium text-[#6B7280] hover:text-[#111827]">回滚到此版</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-violet-500" /><h3 className="text-xs font-semibold text-[#111827]">灰度发布规范</h3></div>
            <ul className="mt-3 space-y-2 text-[10px] leading-relaxed text-[#6B7280]">
              <li className="flex gap-1.5"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-violet-400" />新策略必须先 1% 灰度 ≥ 30 分钟，误杀率 &lt; 0.5% 才可放量到 20%。</li>
              <li className="flex gap-1.5"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-violet-400" />拦截类动作全量前需双人审批，凌晨 0-6 点禁止全量发布。</li>
              <li className="flex gap-1.5"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-violet-400" />任何版本保留 30 天快照，回滚不删除审计记录。</li>
            </ul>
          </Card>
        </div>
      </div>

      <Modal open={builderOpen} onClose={() => setBuilderOpen(false)} title="可视化规则编排" subtitle="从左侧因子库拖入 IF 画布 · 拖动排序 · 拖到回收区删除 · 实时生成 Drools 规则" icon={<Zap className="h-4 w-4" />} size="xl" footer={<><Button variant="secondary" onClick={() => setBuilderOpen(false)}>取消</Button><Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={saveDraft}>保存为草稿</Button></>}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#374151]">规则名称</label>
              <TextInput value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="如：跨境商户夜间大额拦截" />
            </div>
            <div className="rounded-2xl bg-[#F9FAFB] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#111827]"><GripVertical className="h-3.5 w-3.5 text-[#9CA3AF]" />因子组件库</p>
              <p className="mt-0.5 text-[9px] text-[#9CA3AF]">按住拖入右侧 IF 画布</p>
              <div className="mt-2.5 space-y-2.5">
                {FACTOR_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1 font-mono text-[9px] tracking-wider text-[#9CA3AF] uppercase">{group.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {group.fields.map((field) => (
                        <span
                          key={field}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'factor', field }));
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onDoubleClick={() => appendFactor(field)}
                          className="cursor-grab rounded-lg bg-white px-2 py-1 text-[10px] font-medium text-[#374151] shadow-xs transition-all select-none hover:-translate-y-px hover:shadow-sm active:cursor-grabbing"
                          title="拖拽或双击添加"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-[#F9FAFB] p-3">
              <p className="text-[11px] font-semibold text-[#111827]">动作组件</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {ACTION_OPTIONS.map((a) => (
                  <span
                    key={a}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'action', value: a }))}
                    onDoubleClick={() => setDraftAction(a)}
                    className="cursor-grab rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-medium text-orange-700 select-none active:cursor-grabbing"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDropActive(true);
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDropActive(false);
                handleCanvasDrop(e.dataTransfer.getData('text/plain'), draftConds.length);
              }}
              className={cn('min-h-[220px] rounded-2xl p-4 transition-all', dropActive ? 'bg-sky-50 shadow-[0_0_0_2px_#38BDF8]' : 'bg-[#F9FAFB]')}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[#111827] px-2 py-1 font-mono text-[10px] text-white">IF 条件画布</span>
                <div className="flex gap-1 rounded-lg bg-white p-1 shadow-xs">
                  {(['AND', 'OR'] as const).map((l) => (
                    <button key={l} type="button" onClick={() => setDraftLogic(l)} className={cn('cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] font-bold', draftLogic === l ? 'bg-[#111827] text-white' : 'text-[#9CA3AF]')}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {draftConds.length === 0 && (
                  <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-[#D1D5DB] text-center">
                    <GripVertical className="h-5 w-5 text-[#D1D5DB]" />
                    <p className="mt-1 text-[11px] text-[#9CA3AF]">把左侧因子拖到这里开始编排</p>
                  </div>
                )}
                {draftConds.map((c, i) => (
                  <React.Fragment key={`${c.field}-${i}`}>
                    {i > 0 && (
                      <div className="flex justify-center">
                        <span className={cn('rounded-md px-2 py-0.5 font-mono text-[9px] font-bold', draftLogic === 'AND' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700')}>{draftLogic}</span>
                      </div>
                    )}
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'move', index: i }));
                        setDraggingIndex(i);
                      }}
                      onDragEnd={() => setDraggingIndex(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropActive(false);
                        handleCanvasDrop(e.dataTransfer.getData('text/plain'), i);
                      }}
                      className={cn('flex items-center gap-1.5 rounded-xl bg-white p-2 shadow-xs transition-all', draggingIndex === i && 'opacity-40')}
                    >
                      <span className="cursor-grab px-1 text-[#C0C6CF] active:cursor-grabbing"><GripVertical className="h-4 w-4" /></span>
                      <span className="w-5 font-mono text-[9px] text-[#9CA3AF]">#{i + 1}</span>
                      <Select value={c.field} onChange={(e) => setDraftConds((prev) => prev.map((x, xi) => (xi === i ? { ...x, field: e.target.value } : x)))} className="flex-1 bg-[#F9FAFB] py-2 text-[11px]">
                        {FIELD_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </Select>
                      <Select value={c.op} onChange={(e) => setDraftConds((prev) => prev.map((x, xi) => (xi === i ? { ...x, op: e.target.value } : x)))} className="w-24 bg-[#F9FAFB] py-2 font-mono text-[11px]">
                        {OP_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </Select>
                      <TextInput value={c.value} onChange={(e) => setDraftConds((prev) => prev.map((x, xi) => (xi === i ? { ...x, value: e.target.value } : x)))} placeholder="比较值" className="flex-1 bg-[#F9FAFB] py-2 font-mono text-[11px]" />
                      <button type="button" onClick={() => setDraftConds((prev) => prev.filter((_, xi) => xi !== i))} className="cursor-pointer rounded-lg p-2 text-[#9CA3AF] hover:bg-rose-50 hover:text-rose-600" aria-label="删除条件"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  try {
                    const payload = JSON.parse(e.dataTransfer.getData('text/plain')) as { type: string; value?: string };
                    if (payload.type === 'action' && payload.value) setDraftAction(payload.value);
                  } catch {
                    /* 非法拖拽数据直接忽略 */
                  }
                }}
                className="flex items-center gap-2 rounded-2xl bg-[#F9FAFB] p-3"
              >
                <span className="rounded-md bg-white px-2 py-1 font-mono text-[10px] text-[#9CA3AF] shadow-xs">THEN</span>
                <span className="rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm">{draftAction}</span>
                <span className="text-[10px] text-[#9CA3AF]">← 拖入动作组件替换</span>
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setTrashActive(true);
                }}
                onDragLeave={() => setTrashActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setTrashActive(false);
                  try {
                    const payload = JSON.parse(e.dataTransfer.getData('text/plain')) as { type: string; index?: number };
                    if (payload.type === 'move' && typeof payload.index === 'number') {
                      setDraftConds((prev) => prev.filter((_, xi) => xi !== payload.index));
                    }
                  } catch {
                    /* 非法拖拽数据直接忽略 */
                  }
                }}
                className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed p-3 transition-all', trashActive ? 'border-rose-400 bg-rose-50 text-rose-600' : 'border-[#E5E7EB] text-[#9CA3AF]')}
              >
                <Trash2 className="h-4 w-4" />
                <span className="mt-1 text-[10px]">拖到此处删除</span>
              </div>
            </div>

            <div className="rounded-xl bg-[#0B1220] p-3.5 font-mono text-[10px] leading-relaxed text-gray-300">
              <span className="text-gray-500">// 实时编译预览 · drools-dsl</span><br />
              <span className="text-orange-400">rule</span> "{draftName || '未命名规则'}"<br />
              <span className="pl-3 text-sky-400">when</span><br />
              {draftConds.length === 0 ? <span className="pl-6 text-gray-500">// 暂无条件</span> : draftConds.map((c, i) => (
                <span key={i} className="block pl-6">{i > 0 && <span className="text-violet-300">{draftLogic === 'AND' ? '&& ' : '|| '}</span>}{c.field} <span className="text-orange-300">{c.op}</span> {c.value || '?'}</span>
              ))}
              <span className="pl-3 text-sky-400">then</span><br />
              <span className="pl-6">{draftAction}();</span><br />
              <span className="text-orange-400">end</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

/* ============================ 欺诈风险工作台 ============================ */

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = { user: User, device: Smartphone, ip: MapPin, card: CreditCard, contact: Users };

const RadarChart: React.FC<{ data: { label: string; score: number }[] }> = ({ data }) => {
  const size = 220;
  const center = size / 2;
  const radius = 78;
  const angle = (Math.PI * 2) / data.length;
  const point = (i: number, r: number) => {
    const a = -Math.PI / 2 + i * angle;
    return `${(center + Math.cos(a) * r).toFixed(1)},${(center + Math.sin(a) * r).toFixed(1)}`;
  };
  const poly = data.map((d, i) => point(i, (d.score / 100) * radius)).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-52 w-52" role="img" aria-label="行为雷达图">
      {[0.33, 0.66, 1].map((k) => (
        <polygon key={k} points={data.map((_, i) => point(i, radius * k)).join(' ')} fill="none" stroke="#E5E7EB" strokeWidth="1" />
      ))}
      {data.map((_, i) => (
        <line key={i} x1={center} y1={center} x2={point(i, radius).split(',')[0]} y2={point(i, radius).split(',')[1]} stroke="#F1F3F5" strokeWidth="1" />
      ))}
      <polygon points={poly} fill="rgba(244,63,94,0.18)" stroke="#F43F5E" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => {
        const [x, y] = point(i, (d.score / 100) * radius).split(',').map(Number);
        return <circle key={d.label} cx={x} cy={y} r="3" fill="#F43F5E" stroke="white" strokeWidth="1.5" />;
      })}
      {data.map((d, i) => {
        const [x, y] = point(i, radius + 22).split(',').map(Number);
        return (
          <text key={d.label} x={x} y={y} textAnchor="middle" fontSize="9" fill="#4B5563" fontWeight="600">
            {d.label}
            <tspan x={x} dy="10" fontSize="8" fill="#F43F5E" fontWeight="700">{d.score}</tspan>
          </text>
        );
      })}
    </svg>
  );
};

export const RiskEventsPage: React.FC = () => {
  const { push } = useToast();
  const [cases, setCases] = useState<RiskCase[]>(RISK_CASES);
  const [activeId, setActiveId] = useState(RISK_CASES[0].id);
  const [graphFocus, setGraphFocus] = useState<string | null>(null);
  const active = cases.find((c) => c.id === activeId) ?? cases[0];
  const avgScore = useMemo(() => Math.round(active.radar.reduce((s, r) => s + r.score, 0) / active.radar.length), [active]);

  const nodeById = (id: string) => RISK_GRAPH_NODES.find((n) => n.id === id);

  const freezeCase = () => {
    setCases((prev) => prev.map((c) => (c.id === activeId ? { ...c, status: 'frozen' as const } : c)));
    push({ title: '账户已冻结并止付', description: `${active.uid} · 零钱 + 银行卡代付通道同步冻结`, tone: 'success' });
  };
  const closeCase = () => {
    setCases((prev) => prev.map((c) => (c.id === activeId ? { ...c, status: 'closed' as const } : c)));
    push({ title: '风险单已结案', description: `${active.id} · 证据包已归档至合规库`, tone: 'success' });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Risk Brain / Fraud Cases"
        title="欺诈风险工作台"
        description="行为雷达画像 + 关联拓扑顺藤摸瓜，一次铲除整个黑产团伙"
        meta={<Badge tone="rose">{cases.filter((c) => c.status === 'open').length} 待处置</Badge>}
        actions={
          <Button variant="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => { downloadCsv('risk-cases.csv', ['单号', 'UID', '金额(元)', '等级', '状态'], cases.map((c) => [c.id, c.uid, String(c.amountFen / 100), c.level, c.status])); push({ title: '风险单已导出', description: `${cases.length} 条含雷达评分`, tone: 'success' }); }}>
            导出风险单
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {cases.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveId(c.id)}
            className={cn('cursor-pointer rounded-2xl bg-white p-4 text-left transition-all', activeId === c.id ? 'shadow-[0_0_0_2px_#111827,0_12px_30px_-18px_rgba(15,23,42,0.3)]' : 'shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,0.25)]')}
          >
            <div className="flex items-center justify-between">
              <Badge tone={c.level === 'critical' ? 'rose' : c.level === 'high' ? 'orange' : 'amber'}>{c.level === 'critical' ? '致命' : c.level === 'high' ? '高危' : '中危'}</Badge>
              {c.status === 'open' ? <Badge tone="amber">待处置</Badge> : c.status === 'frozen' ? <Badge tone="violet">已冻结</Badge> : <Badge tone="emerald">已结案</Badge>}
            </div>
            <p className="mt-2 truncate text-xs font-semibold text-[#111827]">{c.nickname}</p>
            <p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{c.id}</p>
            <p className="mt-1.5 font-mono text-sm font-semibold text-rose-600">{formatFen(c.amountFen)}</p>
          </button>
        ))}
        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="text-[11px] font-medium text-[#6B7280]">当前案件综合异常分</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-rose-600">{avgScore}<span className="text-xs font-normal text-[#9CA3AF]"> / 100</span></p>
          </div>
          <Radar className="h-8 w-8 text-rose-200" />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-4">
          <SectionTitle title="案件详情" subtitle={active.id} right={<Badge tone="rose">{active.time.slice(5)}</Badge>} />
          <div className="mt-3 rounded-2xl bg-[#F9FAFB] p-4">
            <p className="text-[10px] text-[#9CA3AF]">涉案金额</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-rose-600">{formatFen(active.amountFen)}</p>
            <p className="mt-1 font-mono text-[10px] text-[#6B7280]">{active.uid} · {active.nickname}</p>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[#374151]">{active.reason}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">{active.tags.map((t) => <Badge key={t} tone="rose">{t}</Badge>)}</div>
          <RadarChart data={active.radar} />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="danger" icon={<Lock className="h-3.5 w-3.5" />} disabled={active.status !== 'open'} onClick={freezeCase}>冻结账户</Button>
            <Button variant="primary" icon={<CheckCircle2 className="h-3.5 w-3.5" />} disabled={active.status === 'closed'} onClick={closeCase}>结案归档</Button>
          </div>
        </Card>

        <Card className="p-5 xl:col-span-8">
          <SectionTitle
            title="关联拓扑图"
            subtitle="以涉案用户为中心 · 自动关联设备 / IP / 银行卡 / 联系人"
            right={<span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#9CA3AF]"><Network className="h-3 w-3" />8 节点 · 8 边</span>}
          />
          <div className="relative mt-3 overflow-hidden rounded-2xl bg-[#0B1220] p-2">
            <svg viewBox="0 0 100 100" className="h-[380px] w-full" role="img" aria-label="关联拓扑图">
              {RISK_GRAPH_EDGES.map((e, i) => {
                const a = nodeById(e.from);
                const b = nodeById(e.to);
                if (!a || !b) return null;
                const focused = graphFocus === e.from || graphFocus === e.to;
                return (
                  <g key={i} opacity={graphFocus && !focused ? 0.25 : 1}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={focused ? '#FB923C' : '#334155'} strokeWidth={focused ? 0.7 : 0.4} />
                    <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 1.5} textAnchor="middle" fontSize="2.4" fill="#94A3B8">{e.label}</text>
                  </g>
                );
              })}
              {RISK_GRAPH_NODES.map((n) => {
                const isCenter = n.id === 'u0';
                const dim = graphFocus && graphFocus !== n.id;
                return (
                  <g key={n.id} opacity={dim ? 0.35 : 1} onMouseEnter={() => setGraphFocus(n.id)} onMouseLeave={() => setGraphFocus(null)} style={{ cursor: 'pointer' }}>
                    {isCenter && <circle cx={n.x} cy={n.y} r="8" fill="rgba(244,63,94,0.15)" />}
                    <circle cx={n.x} cy={n.y} r={isCenter ? 5.5 : 4.2} fill={n.risk >= 85 ? '#F43F5E' : n.risk >= 70 ? '#F59E0B' : '#334155'} stroke="white" strokeWidth="0.5" />
                    <text x={n.x} y={n.y + 1.6} textAnchor="middle" fontSize="3.4" fill="white" fontWeight="700">{n.label.slice(0, 1)}</text>
                    <text x={n.x} y={n.y + 9} textAnchor="middle" fontSize="2.6" fill="#E2E8F0" fontWeight="600">{n.label}</text>
                    <text x={n.x} y={n.y + 12} textAnchor="middle" fontSize="2.2" fill={n.risk >= 85 ? '#FDA4AF' : '#64748B'} fontFamily="monospace">risk {n.risk}</text>
                  </g>
                );
              })}
            </svg>
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
              {[['user', '用户'], ['device', '设备'], ['ip', 'IP'], ['card', '银行卡'], ['contact', '联系人']].map(([k, l]) => {
                const Icon = KIND_ICON[k];
                return <span key={k} className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-1 text-[9px] text-gray-300"><Icon className="h-2.5 w-2.5" />{l}</span>;
              })}
            </div>
            <div className="absolute right-3 bottom-3 rounded-lg bg-white/10 px-2 py-1.5 font-mono text-[9px] text-gray-300">图计算 · 2 跳扩散 · 实时</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: '关联设备', value: '2 台改机', icon: Laptop },
              { label: '关联 IP', value: '2 个代理出口', icon: MapPin },
              { label: '关联银行卡', value: '2 张 · 同进件', icon: CreditCard },
              { label: '团伙规模', value: '预估 6-9 人', icon: Users },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="rounded-xl bg-[#F9FAFB] px-3 py-2.5">
                  <p className="flex items-center gap-1 text-[10px] text-[#9CA3AF]"><Icon className="h-3 w-3" />{s.label}</p>
                  <p className="mt-1 text-[11px] font-semibold text-[#111827]">{s.value}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="danger" icon={<Ban className="h-3.5 w-3.5" />} onClick={() => push({ title: '团伙一键打击已下发', description: '2 设备 + 2 IP + 2 银行卡 + 1 联系人同步冻结拉黑', tone: 'success' })}>一键打击团伙</Button>
            <Button size="sm" variant="secondary" icon={<Cpu className="h-3.5 w-3.5" />} onClick={() => push({ title: '已启动 3 跳扩散', description: '正在图数据库中扩展二度、三度关联…约 40 秒完成', tone: 'info' })}>扩散 3 跳</Button>
            <Button size="sm" variant="ghost" icon={<ShieldCheck className="h-3.5 w-3.5" />} onClick={() => push({ title: '证据包已生成', description: '含 47 页链路日志 + 设备指纹 + 资金流水，已上链存证', tone: 'info' })}>生成证据包</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export const RISK_BRAIN_META = { RULE_STATUS };
