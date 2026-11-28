import React, { useState } from 'react';
import { AlertTriangle, ArrowUpRight, Check, CheckCircle2, Clock3, Copy, Fingerprint, Globe2, KeyRound, Plus, RefreshCw, Search, Settings2, ShieldCheck, Users, XCircle } from 'lucide-react';
import type { ApiKeyMeta, OperatorAccount, PlatformSettings, Role, SecurityPolicy } from '../lib/types';
import { DEFAULT_PLATFORM_SETTINGS, INITIAL_API_KEYS } from '../lib/platform';
import { makeTemporaryPassword } from '../lib/platformCredentials';
import { storage } from '../lib/storage';
import { Badge, Button, Card, FormField, Modal, PageHeader, Select, Switch, TextInput, Textarea, cn, useToast } from '../components/ui';

interface PlatformSettingsProps {
  accounts: OperatorAccount[];
  currentUsername: string;
  policy: SecurityPolicy;
  onSavePolicy: (policy: SecurityPolicy) => void;
  onSetAccount: (username: string, updates: Partial<OperatorAccount>) => void;
  onCreateAccount: (account: OperatorAccount, tempPassword: string) => Promise<void>;
  onResetPassword: (username: string, tempPassword: string) => Promise<void>;
  onAudit: (action: string, target: string) => void;
}

const ROLE_NAMES: Record<Role, string> = { super_admin: '超级管理员', finance: '支付清结算', risk_ops: '风控运营', moderator: '内容审核' };
const stored = <T,>(key: string, fallback: T): T => { try { return JSON.parse(storage.get(key) ?? '') as T; } catch { return fallback; } };

export const PlatformSettingsPage: React.FC<PlatformSettingsProps> = ({ accounts, currentUsername, policy, onSavePolicy, onSetAccount, onCreateAccount, onResetPassword, onAudit }) => {
  const { push } = useToast();
  const [tab, setTab] = useState<'accounts' | 'security' | 'keys' | 'base'>('accounts');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ username: '', display_name: '', department: '', role: 'finance' as Role });
  const [draftError, setDraftError] = useState('');
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null);
  const [security, setSecurity] = useState<SecurityPolicy>(policy);
  const [allowlistText, setAllowlistText] = useState(policy.ip_allowlist.join('\n'));
  const [keys, setKeys] = useState<ApiKeyMeta[]>(() => stored('wt.apiKeys', INITIAL_API_KEYS));
  const [base, setBase] = useState<PlatformSettings>(() => stored('wt.baseSettings', DEFAULT_PLATFORM_SETTINGS));
  const [keyName, setKeyName] = useState('');
  const [rotateId, setRotateId] = useState('key-pay-prod');

  const showError = (message: string) => push({ title: '操作未完成', description: message, tone: 'error' });

  const createAccount = async () => {
    if (!/^[a-z][a-z0-9_]{3,23}$/.test(draft.username.trim())) { setDraftError('账号需以字母开头，长度 4-24 位，只能包含小写字母、数字和下划线'); return; }
    if (!draft.display_name.trim() || !draft.department.trim()) { setDraftError('请填写真实姓名和所属部门'); return; }
    if (accounts.some((a) => a.username === draft.username.trim())) { setDraftError('该账号已存在'); return; }
    try {
      const temp = makeTemporaryPassword();
      const account: OperatorAccount = { operator_id: `stf_${String(Date.now()).slice(-7)}`, username: draft.username.trim(), display_name: draft.display_name.trim(), department: draft.department.trim(), role: draft.role, mfa_enabled: true, enabled: true, session_count: 0, last_login_at: null, created_at: new Date().toISOString() };
      await onCreateAccount(account, temp);
      setCreateOpen(false);
      setDraft({ username: '', display_name: '', department: '', role: 'finance' });
      setSecret({ label: `新账号 ${account.username} 的临时密码`, value: temp });
      push({ title: '运营账号已创建', description: '临时密码只展示一次，请安全转交本人', tone: 'success' });
    } catch (err) { showError(err instanceof Error ? err.message : '创建失败'); }
  };

  const resetPassword = async (username: string) => {
    try {
      const temp = makeTemporaryPassword();
      await onResetPassword(username, temp);
      setSecret({ label: `${username} 的新临时密码`, value: temp });
    } catch (err) { showError(err instanceof Error ? err.message : '重置失败'); }
  };

  const saveSecurity = () => {
    const list = allowlistText.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    if (list.length === 0 || list.some((x) => !/^(?:\d{1,3}\.){3}\d{1,3}\/(?:\d|[12]\d|3[0-2])$/.test(x))) { showError('IP 白名单至少保留一个合法 CIDR 网段（例如 10.20.0.0/16）'); return; }
    if (security.session_minutes < 30 || security.session_minutes > 720) { showError('会话超时必须在 30-720 分钟之间'); return; }
    onSavePolicy({ ...security, ip_allowlist: list, updated_at: new Date().toISOString() });
    push({ title: '安全策略已保存', description: '会话、锁定阈值与 IP 白名单已更新', tone: 'success' });
  };

  const rotateKey = async () => {
    const target = keys.find((k) => k.key_id === rotateId);
    if (!target) return;
    try {
      if (!globalThis.crypto?.getRandomValues || !globalThis.crypto.subtle) throw new Error('需要 HTTPS 安全上下文才能轮换密钥');
      const random = globalThis.crypto.getRandomValues(new Uint8Array(32));
      const value = `wt_live_${Array.from(random, (n) => n.toString(16).padStart(2, '0')).join('')}`;
      const hash = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), (n) => n.toString(16).padStart(2, '0')).join('');
      const now = new Date();
      const expiry = new Date(now.getTime() + 24 * 3600_000).toISOString();
      const newKey: ApiKeyMeta = { key_id: `key-${now.getTime().toString(36)}`, name: keyName.trim() || `${target.name} · 轮换`, key_prefix: `${value.slice(0, 17)}…`, scopes: [...target.scopes], status: 'active', created_at: now.toISOString(), expires_at: null, last_used_at: null };
      const next = keys.map((k) => k.key_id === target.key_id ? { ...k, status: 'retiring' as const, expires_at: expiry } : k);
      const updated = [newKey, ...next];
      storage.set('wt.apiKeyHashes', JSON.stringify({ ...stored<Record<string, string>>('wt.apiKeyHashes', {}), [newKey.key_id]: hash }));
      storage.set('wt.apiKeys', JSON.stringify(updated));
      setKeys(updated);
      setSecret({ label: `API 密钥 ${newKey.key_id}（关闭后无法再次查看）`, value });
      onAudit('轮换 API 密钥', target.key_id);
      push({ title: '密钥已轮换', description: '新旧密钥双跑 24 小时，旧密钥到期后自动失效', tone: 'success' });
    } catch (err) { showError(err instanceof Error ? err.message : '密钥轮换失败'); }
  };

  const createApiKey = async () => {
    if (!keyName.trim()) { showError('请填写新密钥名称'); return; }
    try {
      if (!globalThis.crypto?.getRandomValues || !globalThis.crypto.subtle) throw new Error('需要 HTTPS 安全上下文才能创建密钥');
      const value = `wt_live_${Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, '0')).join('')}`;
      const hash = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), (n) => n.toString(16).padStart(2, '0')).join('');
      const meta: ApiKeyMeta = { key_id: `key-${Date.now().toString(36)}`, name: keyName.trim(), key_prefix: `${value.slice(0, 17)}…`, scopes: ['payment.read'], status: 'active', created_at: new Date().toISOString(), expires_at: null, last_used_at: null };
      const updated = [meta, ...keys];
      storage.set('wt.apiKeyHashes', JSON.stringify({ ...stored<Record<string, string>>('wt.apiKeyHashes', {}), [meta.key_id]: hash }));
      storage.set('wt.apiKeys', JSON.stringify(updated));
      setKeys(updated);
      setKeyName('');
      setRotateId(meta.key_id);
      setSecret({ label: `新 API 密钥 ${meta.name}（仅展示一次）`, value });
      onAudit('创建 API 密钥', meta.key_id);
    } catch (err) { showError(err instanceof Error ? err.message : '创建密钥失败'); }
  };

  const disableKey = (id: string) => {
    const next = keys.map((k) => k.key_id === id ? { ...k, status: 'disabled' as const } : k);
    setKeys(next);
    storage.set('wt.apiKeys', JSON.stringify(next));
    onAudit('禁用 API 密钥', id);
  };

  const saveBase = () => {
    if (base.platform_name.trim().length < 2 || !base.support_email.includes('@') || base.log_retention_days < 30) { showError('请检查平台名、邮箱与日志保留天数（至少 30 天）'); return; }
    const updated = { ...base, updated_at: new Date().toISOString() };
    setBase(updated);
    storage.set('wt.baseSettings', JSON.stringify(updated));
    onAudit('更新基础参数', updated.platform_name);
    push({ title: '基础参数已更新', description: `日志保留 ${updated.log_retention_days} 天 · ${updated.timezone}`, tone: 'success' });
  };

  return <div className="space-y-5">
    <PageHeader eyebrow="System / Platform Operations" title="系统设置" description="运营账号、访问安全、API 密钥和基础参数的集中治理 · 所有变更写入审计日志" meta={<Badge tone="dark">仅超级管理员</Badge>} />
    <div role="tablist" aria-label="系统设置分类" className="flex flex-wrap items-center gap-1.5">{[
      { key: 'accounts' as const, name: '运营账号', count: accounts.length, icon: Users },
      { key: 'security' as const, name: '安全策略', count: null, icon: ShieldCheck },
      { key: 'keys' as const, name: 'API 密钥', count: keys.length, icon: KeyRound },
      { key: 'base' as const, name: '基础参数', count: null, icon: Settings2 },
    ].map((item) => <button key={item.key} role="tab" aria-selected={tab === item.key} type="button" onClick={() => setTab(item.key)} className={cn('inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-colors', tab === item.key ? 'bg-[#111827] text-white shadow-sm' : 'bg-white text-[#6B7280] hover:text-[#111827]')}><item.icon className="h-3.5 w-3.5" />{item.name}{item.count !== null && <span className={cn('rounded px-1.5 font-mono text-[10px]', tab === item.key ? 'bg-white/15' : 'bg-[#F3F4F6]')}>{item.count}</span>}</button>)}</div>

    {tab === 'accounts' && <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#111827]">运营账号目录</h2><p className="mt-1 text-[11px] text-[#9CA3AF]">禁用账号会撤销其所有活跃会话 · 重置密码生成一次性临时密码</p></div><div className="flex items-center gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" /><input aria-label="搜索运营账号" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="姓名、账号或部门" className="w-44 rounded-xl bg-[#F9FAFB] py-2.5 pl-9 pr-2 text-xs outline-none" /></div><Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => { setDraftError(''); setCreateOpen(true); }}>新建账号</Button></div></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left"><thead><tr className="bg-[#F9FAFB] text-[10px] tracking-wider text-[#9CA3AF] uppercase"><th className="rounded-l-xl py-3 pl-4">账号 / 部门</th><th className="px-3 py-3">权限角色</th><th className="px-3 py-3">MFA</th><th className="px-3 py-3">在线会话</th><th className="px-3 py-3">最近登录</th><th className="px-3 py-3">状态</th><th className="rounded-r-xl py-3 pr-4 text-right">操作</th></tr></thead><tbody>{accounts.filter((a) => `${a.username}${a.display_name}${a.department}`.toLowerCase().includes(search.trim().toLowerCase())).map((a) => <tr key={a.operator_id} className="group hover:bg-[#F9FAFB]/80"><td className="py-3.5 pl-4"><p className="text-xs font-medium text-[#111827]">{a.display_name} <span className="ml-1 font-mono text-[10px] text-[#9CA3AF]">{a.username}</span></p><p className="mt-0.5 text-[10px] text-[#9CA3AF]">{a.operator_id} · {a.department}</p></td><td className="px-3 py-3.5"><Select aria-label={`${a.username} 角色`} value={a.role} disabled={a.username === currentUsername || !a.enabled} onChange={(e) => onSetAccount(a.username, { role: e.target.value as Role, session_count: 0 })} className="w-28 py-1.5 text-[10px]">{(Object.entries(ROLE_NAMES) as [Role, string][]).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</Select></td><td className="px-3 py-3.5"><Switch label={`${a.username} MFA`} checked={a.mfa_enabled} disabled={!a.enabled || policy.require_mfa} onChange={(v) => onSetAccount(a.username, { mfa_enabled: v })} /></td><td className="px-3 py-3.5 font-mono text-[11px] text-[#374151]">{a.session_count}<span className="ml-1 font-sans text-[10px] text-[#9CA3AF]">台终端</span></td><td className="px-3 py-3.5 font-mono text-[10px] text-[#6B7280]">{a.last_login_at?.replace('T', ' ').slice(0, 16) ?? '从未登录'}</td><td className="px-3 py-3.5"><Badge tone={a.enabled ? 'emerald' : 'slate'}>{a.enabled ? '正常' : '已禁用'}</Badge></td><td className="py-3.5 pr-4 text-right"><div className="flex items-center justify-end gap-1"><button type="button" disabled={!a.enabled || a.session_count === 0 || a.username === currentUsername} onClick={() => onSetAccount(a.username, { session_count: 0 })} className="cursor-pointer rounded-lg px-2 py-1.5 text-[10px] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30">踢出会话</button><button type="button" disabled={!a.enabled} onClick={() => resetPassword(a.username)} className="cursor-pointer rounded-lg px-2 py-1.5 text-[10px] text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-30">重置密码</button><button type="button" disabled={a.username === currentUsername} onClick={() => onSetAccount(a.username, { enabled: !a.enabled, session_count: 0 })} className={cn('cursor-pointer rounded-lg px-2.5 py-1.5 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-30', a.enabled ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100')}>{a.username === currentUsername ? '当前账号' : a.enabled ? '禁用 / 踢出' : '启用'}</button></div></td></tr>)}</tbody></table></div>
    </Card>}

    {tab === 'security' && <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]"><Card className="p-6"><h2 className="text-sm font-semibold text-[#111827]">登录与会话安全</h2><p className="mt-1 text-[11px] text-[#9CA3AF]">修改后对新会话立即生效，已有会话将在下一次心跳刷新</p><div className="mt-5 space-y-5">{[
      { label: '会话超时', key: 'session_minutes' as const, min: 30, max: 720, step: 30, unit: '分钟', hint: '30 分钟至 12 小时' },
      { label: '失败锁定阈值', key: 'failed_login_limit' as const, min: 3, max: 10, step: 1, unit: '次', hint: '连续失败后冻结登录' },
      { label: '最短密码长度', key: 'min_password_length' as const, min: 8, max: 24, step: 1, unit: '位', hint: '新账号及重置密码适用' },
    ].map((field) => <div key={field.key}><div className="flex justify-between text-xs"><span className="font-medium text-[#374151]">{field.label}</span><span className="font-mono font-semibold text-[#111827]">{security[field.key]} {field.unit}</span></div><input aria-label={field.label} type="range" className="range-slider mt-2 w-full" min={field.min} max={field.max} step={field.step} value={security[field.key]} onChange={(e) => setSecurity({ ...security, [field.key]: Number(e.target.value) })} /><p className="mt-1 text-[10px] text-[#9CA3AF]">{field.hint}</p></div>)}<div className="flex items-center justify-between rounded-xl bg-[#F9FAFB] px-4 py-3"><div><p className="text-xs font-medium text-[#111827]">强制 MFA</p><p className="mt-0.5 text-[10px] text-[#9CA3AF]">所有运营账号登录必须验证第二因素</p></div><Switch label="强制 MFA" checked={security.require_mfa} onChange={(v) => setSecurity({ ...security, require_mfa: v })} /></div><FormField label="IP 白名单" hint="每行一个 CIDR"><Textarea rows={3} value={allowlistText} onChange={(e) => setAllowlistText(e.target.value)} className="font-mono" /></FormField><Button variant="primary" icon={<Check className="h-3.5 w-3.5" />} onClick={saveSecurity}>保存安全策略</Button></div></Card><Card className="h-fit p-6"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h3 className="mt-3 text-sm font-semibold text-[#111827]">当前防护基线</h3><div className="mt-4 space-y-3">{['所有高危操作需要二次确认', '会话超时自动撤销访问', '失败锁定与 IP 白名单并行校验', '账号停用即刻撤销活跃会话'].map((t) => <p key={t} className="flex items-start gap-2 text-[11px] leading-relaxed text-[#6B7280]"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />{t}</p>)}</div><p className="mt-4 rounded-xl bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-800">演示预览使用浏览器本地状态；生产环境必须由 Axum 鉴权中间件与服务端会话存储强制执行。</p></Card></div>}

    {tab === 'keys' && <div className="space-y-4"><Card className="p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#111827]">服务间 API 密钥</h2><p className="mt-1 text-[11px] text-[#9CA3AF]">完整密钥仅生成时展示一次，轮换时旧密钥双跑 24 小时</p></div><Badge tone="emerald">仅存 SHA-256 摘要</Badge></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead><tr className="bg-[#F9FAFB] text-[10px] tracking-wider text-[#9CA3AF] uppercase"><th className="rounded-l-xl py-3 pl-4">名称 / 前缀</th><th className="px-3 py-3">授权 Scope</th><th className="px-3 py-3">上次调用</th><th className="px-3 py-3">状态</th><th className="rounded-r-xl py-3 pr-4 text-right">操作</th></tr></thead><tbody>{keys.map((key) => <tr key={key.key_id} className="hover:bg-[#F9FAFB]"><td className="py-3 pl-4"><p className="text-xs font-medium text-[#111827]">{key.name}</p><p className="mt-0.5 font-mono text-[10px] text-[#9CA3AF]">{key.key_prefix}</p></td><td className="px-3 py-3"><div className="flex gap-1">{key.scopes.map((s) => <span key={s} className="rounded bg-[#F3F4F6] px-1.5 py-0.5 font-mono text-[9px] text-[#6B7280]">{s}</span>)}</div></td><td className="px-3 py-3 font-mono text-[10px] text-[#6B7280]">{key.last_used_at?.replace('T', ' ').slice(5, 16) ?? '未使用'}</td><td className="px-3 py-3"><Badge tone={key.status === 'active' ? 'emerald' : key.status === 'retiring' ? 'amber' : 'slate'}>{key.status === 'active' ? '生效' : key.status === 'retiring' ? '双跑即将失效' : '已禁用'}</Badge></td><td className="py-3 pr-4 text-right"><button type="button" disabled={key.status === 'disabled'} onClick={() => disableKey(key.key_id)} className="cursor-pointer rounded-lg px-2 py-1.5 text-[10px] text-rose-600 hover:bg-rose-50 disabled:opacity-35">禁用</button></td></tr>)}</tbody></table></div></Card><Card className="p-5"><h3 className="text-xs font-semibold text-[#111827]">创建与安全轮换</h3><div className="mt-3 flex flex-wrap items-end gap-2"><FormField label="选择需轮换的密钥" className="min-w-52 flex-1"><Select value={rotateId} onChange={(e) => setRotateId(e.target.value)}>{keys.filter((k) => k.status === 'active').map((k) => <option key={k.key_id} value={k.key_id}>{k.name}</option>)}</Select></FormField><FormField label="新密钥名称" className="min-w-44 flex-1"><TextInput value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="创建必填 / 轮换可选" /></FormField><Button variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={createApiKey}>新建密钥</Button><Button variant="primary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={rotateKey}>轮换密钥</Button></div><p className="mt-3 flex items-start gap-1.5 text-[10px] text-[#9CA3AF]"><Clock3 className="mt-0.5 h-3 w-3 shrink-0" />轮换后新旧密钥双跑 24 小时；旧密钥自动停用，客户端永不持久化明文。</p></Card></div>}

    {tab === 'base' && <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><Card className="p-6"><h2 className="text-sm font-semibold text-[#111827]">平台基础参数</h2><p className="mt-1 text-[11px] text-[#9CA3AF]">影响控制台品牌、报表时区与审计归档周期</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><FormField label="平台名称"><TextInput value={base.platform_name} onChange={(e) => setBase({ ...base, platform_name: e.target.value })} /></FormField><FormField label="时区"><Select value={base.timezone} onChange={(e) => setBase({ ...base, timezone: e.target.value })}><option value="Asia/Shanghai">Asia/Shanghai · UTC+8</option><option value="Asia/Hong_Kong">Asia/Hong_Kong · UTC+8</option><option value="UTC">UTC · UTC+0</option></Select></FormField><FormField label="日志保留天数" hint="至少 30 天"><TextInput type="number" min={30} max={3650} value={base.log_retention_days} onChange={(e) => setBase({ ...base, log_retention_days: Number(e.target.value) })} /></FormField><FormField label="运维联系邮箱"><TextInput type="email" value={base.support_email} onChange={(e) => setBase({ ...base, support_email: e.target.value })} /></FormField></div><div className="mt-5"><Button variant="primary" icon={<Check className="h-3.5 w-3.5" />} onClick={saveBase}>保存基础参数</Button></div></Card><Card className="h-fit p-6"><Globe2 className="h-5 w-5 text-orange-500" /><h3 className="mt-3 text-sm font-semibold text-[#111827]">环境信息</h3><div className="mt-3 space-y-2 text-[11px] text-[#6B7280]"><p>运行区：cn-south-1 · 生产镜像</p><p>默认货币：CNY · 金额单位：分</p><p>审计日志：只追加、跨区容灾</p><p>上次修改：{base.updated_at.replace('T', ' ').slice(0, 19)}</p></div><button type="button" onClick={() => push({ title: '系统健康度', description: '支付网关、风控引擎与运营控制台正常', tone: 'info' })} className="mt-4 flex cursor-pointer items-center gap-1 text-[11px] text-orange-600">检查服务状态 <ArrowUpRight className="h-3 w-3" /></button></Card></div>}

    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建运营账号" subtitle="临时密码只展示一次；首次登录必须完成 MFA" icon={<Plus className="h-4 w-4" />} footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>取消</Button><Button variant="primary" onClick={createAccount}>创建账号</Button></>}><div className="grid gap-3 sm:grid-cols-2"><FormField label="账号" required className="sm:col-span-2"><TextInput value={draft.username} onChange={(e) => { setDraft({ ...draft, username: e.target.value.toLowerCase() }); setDraftError(''); }} placeholder="例如 finance03" /></FormField><FormField label="真实姓名" required><TextInput value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} /></FormField><FormField label="所属部门" required><TextInput value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} /></FormField><FormField label="授权角色"><Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>{(Object.entries(ROLE_NAMES) as [Role, string][]).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</Select></FormField></div>{draftError && <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-rose-600"><AlertTriangle className="h-3.5 w-3.5" />{draftError}</p>}</Modal>
    <Modal open={Boolean(secret)} onClose={() => setSecret(null)} title="一次性密钥交接" subtitle="关闭此窗口后无法再次查看完整值，请立即复制到安全保管工具" icon={<Fingerprint className="h-4 w-4" />} size="sm" footer={<Button variant="primary" onClick={() => setSecret(null)}>我已妥善保存</Button>}>{secret && <div className="space-y-3"><p className="text-xs font-medium text-[#374151]">{secret.label}</p><div className="flex items-center gap-2 rounded-xl bg-[#111827] p-3"><code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-white">{secret.value}</code><button type="button" aria-label="复制一次性密钥" onClick={() => { navigator.clipboard?.writeText(secret.value); push({ title: '已复制', tone: 'success' }); }} className="cursor-pointer text-gray-300 hover:text-white"><Copy className="h-4 w-4" /></button></div><p className="flex items-start gap-1 text-[10px] leading-relaxed text-rose-600"><XCircle className="mt-0.5 h-3 w-3 shrink-0" />不会再次展示。演示模式仅在本次弹窗保留明文；服务端只存密码哈希或密钥摘要。</p></div>}</Modal>
  </div>;
};