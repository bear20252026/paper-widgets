import React, { useState } from 'react';
import {
  AppWindow,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  History,
  Newspaper,
  Power,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card, Modal, PageHeader, SectionTitle, Tone, cn, downloadCsv, useToast } from '../components/ui';
import { MINI_APPS, MP_ARTICLES } from '../lib/ops';
import type { MiniApp, MpArticle } from '../lib/ops';

const MINI_STATUS: Record<MiniApp['status'], { label: string; tone: Tone }> = {
  reviewing: { label: '审核中', tone: 'amber' },
  pass: { label: '已上线', tone: 'emerald' },
  reject: { label: '已驳回', tone: 'rose' },
  offline: { label: '已下架', tone: 'slate' },
};

/* ============================ 小程序提审 ============================ */

export const MiniReviewPage: React.FC = () => {
  const { push } = useToast();
  const [apps, setApps] = useState<MiniApp[]>(MINI_APPS);
  const [activeId, setActiveId] = useState(MINI_APPS[0].id);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const active = apps.find((a) => a.id === activeId) ?? apps[0];

  const decide = (result: 'pass' | 'reject') => {
    setApps((prev) => prev.map((a) => (a.id === activeId ? { ...a, status: result } : a)));
    push({ title: result === 'pass' ? '小程序已通过并发布' : '小程序已驳回', description: `${active.name} ${active.version} · 结论已同步开放平台`, tone: result === 'pass' ? 'success' : 'error' });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Open Ecosystem / Mini Programs"
        title="小程序提审与发布"
        description="代码包安全扫描 · 类目匹配校验 · 线上版本紧急回退 / 下架"
        meta={<Badge tone="amber">{apps.filter((a) => a.status === 'reviewing').length} 待审</Badge>}
        actions={
          <Button variant="primary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => { downloadCsv('mini-review.csv', ['名称', 'appid', '版本', '类目匹配', '状态'], apps.map((a) => [a.name, a.appid, a.version, a.match ? '一致' : '不一致', MINI_STATUS[a.status].label])); push({ title: '提审清单已导出', description: `${apps.length} 个小程序版本`, tone: 'success' }); }}>
            导出清单
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="p-4 xl:col-span-4">
          <SectionTitle title="提审队列" subtitle="按提交时间排序" />
          <div className="mt-3 space-y-2">
            {apps.map((a) => {
              const meta = MINI_STATUS[a.status];
              return (
                <button key={a.id} type="button" onClick={() => setActiveId(a.id)} className={cn('w-full cursor-pointer rounded-2xl p-3.5 text-left transition-all', activeId === a.id ? 'bg-[#111827] text-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.4)]' : 'bg-[#F9FAFB] hover:bg-[#F3F4F6]')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[12px] font-semibold"><AppWindow className="h-3.5 w-3.5" />{a.name}</span>
                    <Badge tone={activeId === a.id ? 'dark' : meta.tone} dot={false}>{activeId === a.id ? a.version : meta.label}</Badge>
                  </div>
                  <p className={cn('mt-1 font-mono text-[9px]', activeId === a.id ? 'text-white/60' : 'text-[#9CA3AF]')}>{a.appid} · {a.applicant}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {!a.match && <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-medium', activeId === a.id ? 'bg-rose-500/30 text-white' : 'bg-rose-50 text-rose-700')}>类目不一致</span>}
                    {a.scanIssues.length > 0 && <span className={cn('rounded px-1.5 py-0.5 font-mono text-[9px]', activeId === a.id ? 'bg-white/15 text-white' : 'bg-white text-[#9CA3AF] shadow-xs')}>{a.scanIssues.length} 个扫描问题</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-8">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#111827]">{active.name} <span className="font-mono text-[11px] font-normal text-[#9CA3AF]">{active.version}</span></h3>
                  <Badge tone={MINI_STATUS[active.status].tone}>{MINI_STATUS[active.status].label}</Badge>
                </div>
                <p className="mt-1 font-mono text-[10px] text-[#9CA3AF]">{active.appid} · 申请人 {active.applicant} · {active.updatedAt}</p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} disabled={active.status === 'pass'} onClick={() => decide('pass')}>通过发布</Button>
                <Button size="sm" variant="danger" icon={<XCircle className="h-3.5 w-3.5" />} disabled={active.status === 'reject'} onClick={() => decide('reject')}>驳回</Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#F9FAFB] p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#111827]"><ScanSearch className="h-3.5 w-3.5 text-[#6B7280]" />代码包安全扫描</p>
                {active.scanIssues.length === 0 ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" />未发现违规 API 调用，扫描通过</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {active.scanIssues.map((issue, i) => (
                      <div key={i} className="rounded-xl bg-white p-2.5 shadow-xs">
                        <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold', issue.level === '高危' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-700')}>{issue.level}</span>
                        <p className="mt-1 text-[10px] leading-relaxed text-[#4B5563]">{issue.desc}</p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 font-mono text-[9px] text-[#9CA3AF]">扫描引擎：wxscan v8.2 · 规则 1,204 条 · 2.1s</p>
              </div>
              <div className="rounded-2xl bg-[#F9FAFB] p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#111827]"><Copy className="h-3.5 w-3.5 text-[#6B7280]" />类目匹配校验</p>
                <div className="mt-2 space-y-1.5 text-[11px]">
                  <div className="flex justify-between rounded-lg bg-white px-2.5 py-2 shadow-xs"><span className="text-[#9CA3AF]">申请类目</span><span className="font-medium text-[#111827]">{active.appliedCategory}</span></div>
                  <div className="flex justify-between rounded-lg bg-white px-2.5 py-2 shadow-xs"><span className="text-[#9CA3AF]">实际识别</span><span className="font-medium text-[#111827]">{active.category}</span></div>
                </div>
                {active.match ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />功能与类目一致</p>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-rose-600"><ShieldAlert className="h-3.5 w-3.5" />类目不一致：疑似挂羊头卖狗肉</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle title="线上版本与回退" subtitle="紧急下架违规版本并回退到上一稳定版" />
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" icon={<History className="h-3.5 w-3.5" />} onClick={() => setRollbackOpen(true)}>版本回退</Button>
                <Button size="sm" variant="danger" icon={<Power className="h-3.5 w-3.5" />} onClick={() => { setApps((prev) => prev.map((a) => (a.id === activeId ? { ...a, status: 'offline' as const } : a))); push({ title: '小程序已紧急下架', description: `${active.name} · 结算已冻结，用户端停止服务`, tone: 'success' }); }}>紧急下架</Button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { v: active.version, t: '当前提交', cur: true },
                { v: '2.4.0', t: '线上稳定版', cur: false },
                { v: '2.3.9', t: '上一快照', cur: false },
              ].map((item) => (
                <div key={item.v} className={cn('rounded-xl px-3 py-2.5', item.cur ? 'bg-[#111827] text-white' : 'bg-[#F9FAFB]')}>
                  <p className="font-mono text-[11px] font-semibold">{item.v}</p>
                  <p className={cn('mt-0.5 text-[9px]', item.cur ? 'text-white/60' : 'text-[#9CA3AF]')}>{item.t}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={rollbackOpen} onClose={() => setRollbackOpen(false)} title="线上版本回退" subtitle="将线上流量切回上一稳定版本" icon={<History className="h-4 w-4" />} footer={<><Button variant="secondary" onClick={() => setRollbackOpen(false)}>取消</Button><Button variant="primary" onClick={() => { push({ title: '已回退到 2.4.0', description: 'CDN 与版本网关 30 秒内生效', tone: 'success' }); setRollbackOpen(false); }}>确认回退</Button></>}>
        <div className="space-y-2">
          {[['2.4.0', '线上稳定版 · 2026-02-20', true], ['2.3.9', '快照 · 2026-02-15', false]].map(([v, d, ok]) => (
            <div key={v as string} className="flex items-center justify-between rounded-xl bg-[#F9FAFB] px-4 py-3">
              <div><p className="font-mono text-xs font-semibold text-[#111827]">{v}</p><p className="mt-0.5 text-[10px] text-[#9CA3AF]">{d}</p></div>
              {ok ? <Badge tone="emerald">推荐</Badge> : <span className="text-[10px] text-[#9CA3AF]">可选</span>}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

/* ============================ 公众号文章 ============================ */

export const MpArticlePage: React.FC = () => {
  const { push } = useToast();
  const [articles, setArticles] = useState<MpArticle[]>(MP_ARTICLES);
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const batchDelete = () => {
    if (selected.length === 0) {
      push({ title: '请先选择文章', description: '勾选需要批量删除的违规文章', tone: 'error' });
      return;
    }
    setArticles((prev) => prev.map((a) => (selected.includes(a.id) ? { ...a, status: 'deleted' as const } : a)));
    push({ title: `已批量删除 ${selected.length} 篇`, description: '文章已下线，阅读链路返回“内容违规”', tone: 'success' });
    setSelected([]);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Open Ecosystem / MP Articles"
        title="公众号文章与素材"
        description="洗稿检测（全网相似度比对）· 违规文章批量删除 · 封禁发文权限"
        meta={<Badge tone="rose">{articles.filter((a) => a.similarity >= 80).length} 高疑似洗稿</Badge>}
        actions={
          <>
            <Button variant="secondary" icon={<Trash2 className="h-3.5 w-3.5 text-[#6B7280]" />} disabled={selected.length === 0} onClick={batchDelete}>
              批量删除{selected.length > 0 ? `（${selected.length}）` : ''}
            </Button>
            <Button variant="primary" icon={<Newspaper className="h-3.5 w-3.5" />} onClick={() => push({ title: '全网洗稿扫描已启动', description: '对比 4,200 万篇历史文章，预计 6 分钟完成', tone: 'info' })}>
              发起全网比对
            </Button>
          </>
        }
      />

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F9FAFB] text-[10px] font-medium tracking-wider text-[#9CA3AF] uppercase">
                <th className="w-10 rounded-l-xl py-3 pl-4"><input type="checkbox" aria-label="全选" checked={selected.length === articles.length} onChange={(e) => setSelected(e.target.checked ? articles.map((a) => a.id) : [])} className="h-3.5 w-3.5 cursor-pointer accent-[#111827]" /></th>
                <th className="py-3 pr-3 font-medium">文章 / 公众号</th>
                <th className="px-3 py-3 font-medium">洗稿相似度</th>
                <th className="px-3 py-3 font-medium">疑似原文</th>
                <th className="px-3 py-3 font-medium">状态</th>
                <th className="rounded-r-xl py-3 pr-4 pl-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-[#F9FAFB]/80">
                  <td className="py-3.5 pl-4"><input type="checkbox" aria-label={a.id} checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="h-3.5 w-3.5 cursor-pointer accent-[#111827]" /></td>
                  <td className="py-3.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F9FAFB] text-[#6B7280]"><FileText className="h-3.5 w-3.5" /></span>
                      <div className="min-w-0">
                        <p className="max-w-[260px] truncate text-xs font-medium text-[#111827]">{a.title}</p>
                        <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{a.account} · 阅读 {a.reads.toLocaleString('zh-CN')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#F3F4F6]"><div className={cn('h-full rounded-full', a.similarity >= 80 ? 'bg-rose-500' : a.similarity >= 30 ? 'bg-amber-400' : 'bg-emerald-500')} style={{ width: `${a.similarity}%` }} /></div>
                      <span className={cn('font-mono text-[11px] font-semibold', a.similarity >= 80 ? 'text-rose-600' : 'text-[#374151]')}>{a.similarity}%</span>
                    </div>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-3.5 text-[10px] text-[#6B7280]">{a.origin}</td>
                  <td className="px-3 py-3.5">{a.status === 'online' ? <Badge tone="emerald">在线</Badge> : a.status === 'deleted' ? <Badge tone="slate">已删除</Badge> : <Badge tone="rose">账号禁言</Badge>}</td>
                  <td className="py-3.5 pr-4 pl-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => push({ title: '相似度报告', description: `${a.id} · ${a.similarity}% · 飘红段落 14 处`, tone: 'info' })} className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[#6B7280] hover:bg-[#F3F4F6]">比对报告 <ArrowUpRight className="h-3 w-3" /></button>
                      <button type="button" disabled={a.status !== 'online'} onClick={() => { setArticles((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: 'deleted' as const } : x))); push({ title: '文章已删除', description: a.title, tone: 'success' }); }} className="cursor-pointer rounded-lg bg-[#F9FAFB] px-2 py-1.5 text-[11px] font-medium text-[#4B5563] hover:bg-[#F3F4F6] disabled:opacity-40">删除</button>
                      <button type="button" disabled={a.status === 'banned'} onClick={() => { setArticles((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: 'banned' as const } : x))); push({ title: '已封禁发文权限 30 天', description: a.account, tone: 'success' }); }} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-40"><Ban className="h-3 w-3" />禁言</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
