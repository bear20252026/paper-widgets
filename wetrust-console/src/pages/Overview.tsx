import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  Cpu,
  Database,
  Download,
  Flame,
  HeartPulse,
  Maximize2,
  MemoryStick,
  Minimize2,
  Plug2,
  Radio,
  RefreshCcw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Timer,
  TrendingDown,
  TrendingUp,
  Wifi,
  Zap,
} from 'lucide-react';
import { Badge, Button, Card, PageHeader, SectionTitle, Tone, cn, downloadCsv, useToast } from '../components/ui';
import { ALERT_POOL, CHANNEL_DONUT, DB_HEALTH, DEP_HEALTH, ECO_GMV, FUNNEL_STAGES, HOURLY_GMV, PROVINCE_TILES, SERVICE_HEALTH, formatFen } from '../lib/ops';
import { ChinaTileMap } from '../components/ChinaTileMap';
import type { MapMetric } from '../components/ChinaTileMap';
import type { AlertEvent } from '../lib/ops';
import type { Role, RouteKey } from '../lib/types';

const LEVEL_META: Record<string, { label: string; tone: Tone }> = {
  critical: { label: '致命', tone: 'rose' },
  high: { label: '高危', tone: 'orange' },
  medium: { label: '中危', tone: 'amber' },
};

const LiveSpark: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 120;
      const y = 30 - ((v - min) / Math.max(1, max - min)) * 26;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width="120" height="32" viewBox="0 0 120 32" fill="none" aria-hidden="true">
      <polyline points={pts} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * 120;
        const y = 30 - ((v - min) / Math.max(1, max - min)) * 26;
        return i === values.length - 1 ? <circle key={i} cx={x} cy={y} r="3" fill={color} /> : null;
      })}
    </svg>
  );
};

/** 全网心跳波形：以消息吞吐驱动的 ECG，体现“生态呼吸感” */
const HeartbeatLine: React.FC<{ values: number[] }> = ({ values }) => {
  const width = 640;
  const height = 120;
  const mid = height / 2;
  const segment = width / values.length;
  const path = values
    .map((v, i) => {
      const x0 = i * segment;
      const amp = Math.max(8, Math.min(48, (v - 85) * 2.6));
      return [
        `${i === 0 ? 'M' : 'L'}${x0.toFixed(1)},${mid}`,
        `L${(x0 + segment * 0.35).toFixed(1)},${mid}`,
        `L${(x0 + segment * 0.45).toFixed(1)},${(mid - amp).toFixed(1)}`,
        `L${(x0 + segment * 0.55).toFixed(1)},${(mid + amp * 0.55).toFixed(1)}`,
        `L${(x0 + segment * 0.65).toFixed(1)},${mid}`,
        `L${(x0 + segment).toFixed(1)},${mid}`,
      ].join(' ');
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[120px] w-full" preserveAspectRatio="none" aria-label="全网心跳波形">
      <defs>
        <linearGradient id="ecgStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.15" />
          <stop offset="70%" stopColor="#10B981" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="1" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((k) => (
        <line key={k} x1="0" x2={width} y1={height * k} y2={height * k} stroke="#F1F3F5" strokeDasharray="4 6" />
      ))}
      <path d={path} fill="none" stroke="url(#ecgStroke)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width - 2} cy={mid} r="4" fill="#10B981">
        <animate attributeName="r" values="3;6;3" dur="1.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
};

export const OverviewPage: React.FC<{ role: Role; onNavigate: (route: RouteKey) => void }> = ({ onNavigate }) => {
  const { push } = useToast();
  const [tick, setTick] = useState(0);
  const [wsConns, setWsConns] = useState(2846118);
  const [tps, setTps] = useState(96420);
  const [intercept, setIntercept] = useState(3.42);
  const [tpsHist, setTpsHist] = useState<number[]>([88, 91, 89, 93, 95, 92, 96, 94, 97, 96, 98, 96]);
  const [selectedProvince, setSelectedProvince] = useState('GD');
  const [mapMetric, setMapMetric] = useState<MapMetric>('tx');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [alerts, setAlerts] = useState<AlertEvent[]>(ALERT_POOL);
  const [firingOnly, setFiringOnly] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      push({ title: '当前环境不支持全屏', description: '请在独立浏览器窗口中打开大屏模式', tone: 'error' });
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((t) => t + 1);
      setWsConns((v) => Math.max(2700000, v + Math.floor((Math.random() - 0.42) * 4200)));
      setTps((v) => {
        const next = Math.max(88000, Math.min(108000, v + Math.floor((Math.random() - 0.48) * 2600)));
        setTpsHist((h) => [...h.slice(-11), next / 1000]);
        return next;
      });
      setIntercept((v) => Math.max(2.8, Math.min(4.4, v + (Math.random() - 0.5) * 0.14)));
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  const gmv = ECO_GMV;
  const gmvDelta = ((gmv.totalFen - gmv.yesterdayFen) / gmv.yesterdayFen) * 100;
  const province = PROVINCE_TILES.find((p) => p.code === selectedProvince) ?? PROVINCE_TILES[0];
  const provinceRank = [...PROVINCE_TILES].sort((a, b) => (mapMetric === 'tx' ? b.txFen - a.txFen : b.riskCount - a.riskCount));
  const nationalTx = PROVINCE_TILES.reduce((sum, p) => sum + p.txFen, 0);
  const hotRiskCount = PROVINCE_TILES.filter((p) => p.riskCount >= 40).length;
  const shownAlerts = firingOnly ? alerts.filter((a) => a.status === 'firing') : alerts;

  const gmvSplit = useMemo(
    () => [
      { label: '线上', fen: gmv.onlineFen, color: 'bg-[#111827]', pct: (gmv.onlineFen / gmv.totalFen) * 100 },
      { label: '线下', fen: gmv.offlineFen, color: 'bg-orange-400', pct: (gmv.offlineFen / gmv.totalFen) * 100 },
      { label: '扫码', fen: gmv.qrFen, color: 'bg-emerald-500', pct: (gmv.qrFen / gmv.totalFen) * 100 },
      { label: '小程序API', fen: gmv.miniApiFen, color: 'bg-sky-400', pct: (gmv.miniApiFen / gmv.totalFen) * 100 },
    ],
    [gmv]
  );

  const handleFuse = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'resolved' as const } : a)));
    const target = alerts.find((a) => a.id === id);
    push({ title: '熔断指令已下发', description: `${target?.title} · ${target?.actionLabel}，全网 5 秒内生效`, tone: 'success' });
  };

  const mutedAlerts = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'muted' as const } : a)));
    push({ title: '告警已静默 30 分钟', description: id, tone: 'info' });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="God View / 生态呼吸感"
        title="业务总览大屏"
        description={`全生态 GMV、长连接、消息吞吐、风控拦截与底层运维健康度 · 每 2 秒心跳刷新（tick #${tick}）`}
        meta={<Badge tone="emerald"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />实时</Badge>}
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCcw className="h-3.5 w-3.5 text-[#6B7280]" />} onClick={() => push({ title: '已手动刷新全量指标', description: 'Flink / Prometheus / 支付网关三路对齐完成', tone: 'info' })}>
              刷新
            </Button>
            <Button
              variant="secondary"
              icon={isFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-[#6B7280]" /> : <Maximize2 className="h-3.5 w-3.5 text-[#6B7280]" />}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? '退出大屏' : '大屏模式'}
            </Button>
            <Button
              variant="primary"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={() => {
                downloadCsv('god-view-20260224.csv', ['指标', '数值'], [['全生态GMV(元)', String(gmv.totalFen / 100)], ['WS在线', String(wsConns)], ['消息吞吐tps', String(tps)], ['拦截率%', intercept.toFixed(2)]]);
                push({ title: '大盘快照已导出', description: '包含 GMV、连接数、吞吐与拦截率', tone: 'success' });
              }}
            >
              导出快照
            </Button>
          </>
        }
      />

      {/* 超核心指标群 */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]"><Zap className="h-3.5 w-3.5 text-orange-500" />今日全生态 GMV</p>
              <p className="mt-2 font-mono text-[28px] font-semibold tracking-tight text-[#111827] tabular-nums">{formatFen(gmv.totalFen)}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
              <ArrowUpRight className="h-3 w-3" />{gmvDelta.toFixed(1)}%
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {gmvSplit.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-[10px] text-[#6B7280]">{s.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F3F4F6]">
                  <div className={cn('h-full rounded-full transition-all duration-700', s.color)} style={{ width: `${s.pct}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right font-mono text-[10px] text-[#374151]">{formatFen(s.fen)}</span>
                <span className="w-10 shrink-0 text-right font-mono text-[10px] text-[#9CA3AF]">{s.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#F9FAFB] px-3 py-2 text-[10px] text-[#6B7280]">
            <span>昨日同期 {formatFen(gmv.yesterdayFen)}</span>
            <span className="inline-flex items-center gap-1 font-mono">预测今日收盘 ¥9,120 万 <TrendingUp className="h-3 w-3 text-emerald-500" /></span>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]"><Wifi className="h-3.5 w-3.5 text-sky-500" />WS 长连接</p>
          <p className="mt-2 font-mono text-[22px] font-semibold tracking-tight text-[#111827] tabular-nums">{wsConns.toLocaleString('zh-CN')}</p>
          <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600"><ArrowUpRight className="h-3 w-3" />+0.4% / min</p>
          <div className="mt-3 space-y-1.5 text-[10px] text-[#9CA3AF]">
            <div className="flex justify-between"><span>im-gateway</span><span className="font-mono">1,842,110</span></div>
            <div className="flex justify-between"><span>push 长连</span><span className="font-mono">764,220</span></div>
            <div className="flex justify-between"><span>小程序</span><span className="font-mono">239,788</span></div>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]"><Activity className="h-3.5 w-3.5 text-violet-500" />消息吞吐</p>
          <p className="mt-2 font-mono text-[22px] font-semibold tracking-tight text-[#111827] tabular-nums">{tps.toLocaleString('zh-CN')}<span className="ml-1 text-[10px] font-normal text-[#9CA3AF]">条/s</span></p>
          <div className="mt-1"><LiveSpark values={tpsHist} color="#8B5CF6" /></div>
          <p className="mt-1 text-[10px] text-[#9CA3AF]">峰值 108,400 · P99 延迟 31ms</p>
        </Card>

        <Card className="overflow-hidden p-5 lg:col-span-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]"><ShieldAlert className="h-3.5 w-3.5 text-rose-500" />AI 风控拦截率</p>
          <div className="mt-2 flex items-end gap-2">
            <p className="font-mono text-[26px] font-semibold tracking-tight text-rose-600 tabular-nums">{intercept.toFixed(2)}%</p>
            <p className="pb-1.5 text-[10px] text-[#9CA3AF]">实时滚动 · 窗口 5min</p>
          </div>
          <div className="relative mt-2 h-8 overflow-hidden rounded-lg bg-[#F9FAFB]">
            <div className="animate-marquee flex h-full items-center gap-6 whitespace-nowrap px-3 font-mono text-[10px] text-[#6B7280]">
              {[0, 1, 2].map((k) => (
                <span key={k}>BLOCK 203.0.113.42 薅羊毛 · BLOCK wx_uid_8849*** 洗钱 · PASS 正常支付 18,240/s · BLOCK 模拟器改机 ·</span>
              ))}
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px]">
            <span className="text-[#6B7280]">今日拦截 48,212 笔 · 止付 ¥218.4 万</span>
            <button type="button" onClick={() => onNavigate('risk-events')} className="cursor-pointer font-medium text-orange-600 hover:text-orange-700">进入工作台 →</button>
          </div>
        </Card>
      </div>

      {/* 地域热力（34 省方块地图） */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle title="地域热力下钻" subtitle="34 省级行政区实时热力 · 事件推送时对应省份闪烁 · 点击省份下钻" />
          <div className="flex items-center gap-2">
            <Badge tone="rose">{hotRiskCount} 个高危风险省</Badge>
            <div className="flex gap-1 rounded-xl bg-[#F9FAFB] p-1">
              {([['tx', '交易热力'], ['risk', '风险热力']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setMapMetric(k)} className={cn('cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all', mapMetric === k ? (k === 'tx' ? 'bg-[#111827] text-white shadow-sm' : 'bg-rose-600 text-white shadow-sm') : 'text-[#6B7280] hover:text-[#111827]')}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
          <ChinaTileMap metric={mapMetric} selected={selectedProvince} onSelect={setSelectedProvince} />
          <div className="space-y-3">
            <div className="rounded-2xl bg-[#111827] p-4 text-white">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold">{province.name} · 实时</p>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-gray-300">{province.code}</span>
              </div>
              <p className="mt-2 font-mono text-xl font-semibold tracking-tight">{formatFen(province.txFen)}</p>
              <p className="mt-0.5 text-[10px] text-gray-400">占全国 {((province.txFen / nationalTx) * 100).toFixed(2)}%</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-lg bg-white/5 px-2.5 py-2"><p className="text-gray-400">风险事件</p><p className="mt-0.5 font-mono text-sm font-semibold text-rose-300">{province.riskCount}</p></div>
                <div className="rounded-lg bg-white/5 px-2.5 py-2"><p className="text-gray-400">活跃商户</p><p className="mt-0.5 font-mono text-sm font-semibold">{province.users.toLocaleString('zh-CN')}</p></div>
              </div>
              <div className="mt-3 flex gap-1.5">
                <button type="button" onClick={() => onNavigate('transactions')} className="flex-1 cursor-pointer rounded-lg bg-white py-2 text-[11px] font-medium text-[#111827] hover:bg-gray-100">下钻流水</button>
                <button type="button" onClick={() => onNavigate('risk-events')} className="flex-1 cursor-pointer rounded-lg bg-white/10 py-2 text-[11px] font-medium text-white hover:bg-white/15">下钻风险</button>
              </div>
            </div>
            <div>
              <p className="mb-1.5 px-1 text-[10px] font-medium text-[#9CA3AF]">{mapMetric === 'tx' ? '交易额 TOP 6' : '风险事件 TOP 6'}</p>
              <div className="space-y-1">
                {provinceRank.slice(0, 6).map((p, i) => {
                  const ratio = mapMetric === 'tx' ? p.txFen / provinceRank[0].txFen : p.riskCount / provinceRank[0].riskCount;
                  const active = selectedProvince === p.code;
                  return (
                    <button key={p.code} type="button" onClick={() => setSelectedProvince(p.code)} className={cn('relative flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-2.5 py-1.5 text-left transition-colors', active ? 'bg-[#F3F4F6]' : 'hover:bg-[#F9FAFB]')}>
                      <span className={cn('absolute inset-y-0 left-0 opacity-60', mapMetric === 'tx' ? 'bg-[#E5E7EB]' : 'bg-rose-100')} style={{ width: `${ratio * 100}%` }} />
                      <span className="relative w-3 font-mono text-[10px] text-[#9CA3AF]">{i + 1}</span>
                      <span className="relative flex-1 text-[11px] font-medium text-[#111827]">{p.name}</span>
                      <span className="relative font-mono text-[10px] text-[#4B5563]">{mapMetric === 'tx' ? formatFen(p.txFen) : `${p.riskCount} 起`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* GMV 分时趋势 + 渠道占比 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <SectionTitle title="今日 GMV 分时趋势" subtitle="每小时实际成交（万元）· 虚线为模型预测收盘" />
            <div className="flex items-center gap-3 text-[10px] text-[#9CA3AF]">
              <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-[#111827]" />实际</span>
              <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-orange-400" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#FB923C 0 4px,transparent 4px 7px)' }} />预测</span>
              <Badge tone="emerald">当前 15:00 · ¥642 万</Badge>
            </div>
          </div>
          <div className="mt-4">
            <svg viewBox="0 0 760 220" className="h-[220px] w-full" role="img" aria-label="GMV 分时趋势">
              <defs>
                <linearGradient id="gmvHourFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#111827" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#111827" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              {[0, 0.33, 0.66, 1].map((k) => (
                <g key={k}>
                  <line x1="36" x2="752" y1={20 + (200 - 20) * (1 - k)} y2={20 + (200 - 20) * (1 - k)} stroke="#F1F3F5" />
                  <text x="4" y={24 + (200 - 20) * (1 - k)} fill="#B0B7C3" fontSize="9" fontFamily="JetBrains Mono, monospace">{Math.round(100 * k)}</text>
                </g>
              ))}
              {(() => {
                const max = 100;
                const x = (h: number) => 36 + (h / 23) * 716;
                const y = (v: number) => 20 + (1 - v / max) * 180;
                const actual = HOURLY_GMV.filter((d) => d.actual !== null);
                const line = actual.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.hour).toFixed(1)},${y(d.actual!).toFixed(1)}`).join(' ');
                const area = `${line} L${x(15).toFixed(1)},200 L36,200 Z`;
                const forecast = HOURLY_GMV.filter((d) => d.forecast !== null);
                const fStart = x(15);
                const fLine = `M${fStart},${y(HOURLY_GMV[15].actual ?? 0).toFixed(1)} ` + forecast.map((d) => `L${x(d.hour).toFixed(1)},${y(d.forecast!).toFixed(1)}`).join(' ');
                return (
                  <>
                    <path d={area} fill="url(#gmvHourFill)" />
                    <path d={line} fill="none" stroke="#111827" strokeWidth="2" strokeLinejoin="round" />
                    <path d={fLine} fill="none" stroke="#FB923C" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
                    <line x1={fStart} x2={fStart} y1="20" y2="200" stroke="#F59E0B" strokeDasharray="3 3" strokeWidth="1" />
                    <text x={fStart + 4} y="30" fill="#F59E0B" fontSize="9" fontFamily="JetBrains Mono, monospace">现在 15:00</text>
                    {actual.map((d) => <circle key={d.hour} cx={x(d.hour)} cy={y(d.actual!)} r="2.6" fill="white" stroke="#111827" strokeWidth="1.6" />)}
                    {forecast.map((d) => <circle key={d.hour} cx={x(d.hour)} cy={y(d.forecast!)} r="2.4" fill="#FB923C" />)}
                    {HOURLY_GMV.filter((_, i) => i % 3 === 0).map((d) => (
                      <text key={d.hour} x={x(d.hour)} y="214" textAnchor="middle" fill="#9CA3AF" fontSize="9" fontFamily="JetBrains Mono, monospace">{String(d.hour).padStart(2, '0')}h</text>
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#6B7280]">
            <span>晚高峰预测 19:00 达 ¥964 万 · 较昨日晚高峰 +11.2%</span>
            <span className="font-mono">模型：XGBoost + 节假日因子 · 每 15 分钟重训</span>
          </div>
        </Card>

        <Card className="flex flex-col p-5 xl:col-span-4">
          <SectionTitle title="今日渠道占比" subtitle="按实收金额" />
          <div className="mt-3 flex items-center justify-center">
            <div className="relative h-36 w-36">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#F3F4F6" strokeWidth="13" />
                {CHANNEL_DONUT.reduce<{ offset: number; nodes: React.ReactNode[] }>((acc, item) => {
                  const circumference = 2 * Math.PI * 40;
                  const total = CHANNEL_DONUT.reduce((s, c) => s + c.fen, 0);
                  const length = (item.fen / total) * circumference;
                  const node = (
                    <circle key={item.label} cx="50" cy="50" r="40" fill="none" stroke={item.color} strokeWidth="13"
                      strokeDasharray={`${length - 1.5} ${circumference - length + 1.5}`} strokeDashoffset={-acc.offset} />
                  );
                  return { offset: acc.offset + length, nodes: [...acc.nodes, node] };
                }, { offset: 0, nodes: [] }).nodes}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[9px] text-[#9CA3AF]">今日总额</span>
                <span className="font-mono text-[15px] font-semibold text-[#111827]">¥842.6万</span>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {CHANNEL_DONUT.map((c) => {
              const total = CHANNEL_DONUT.reduce((s, x) => s + x.fen, 0);
              return (
                <div key={c.label} className="flex items-center gap-2 text-[11px]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 text-[#4B5563]">{c.label}</span>
                  <span className="font-mono text-[10px] text-[#9CA3AF]">¥{(c.fen / 100 / 10000).toFixed(1)}万</span>
                  <span className="w-9 text-right font-mono font-semibold text-[#111827]">{((c.fen / total) * 100).toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 生态心跳 + 漏斗 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-7">
          <SectionTitle
            title="生态心跳"
            subtitle="消息吞吐驱动的全网心电图 · 每次心跳 = 一个 2 秒采样窗口"
            right={<Badge tone="emerald"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />{(tps / 1000).toFixed(1)}k msg/s</Badge>}
          />
          <div className="mt-3 rounded-2xl bg-[#F9FAFB] px-3 py-2">
            <HeartbeatLine values={tpsHist} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: '支付 TPS', value: '18,240', hint: '峰值 26,800', tone: 'text-[#111827]' },
              { label: '红包并发', value: '4,812/s', hint: '春节峰值 76 万/s', tone: 'text-orange-600' },
              { label: '朋友圈发布', value: '2,306/s', hint: '审核队列 1.2 万', tone: 'text-violet-600' },
              { label: '视频号在线', value: '612 万', hint: '直播间 4.8 万', tone: 'text-sky-600' },
            ].map((m) => (
              <div key={m.label} className="rounded-xl bg-[#F9FAFB] px-3 py-2.5">
                <p className="text-[10px] text-[#9CA3AF]">{m.label}</p>
                <p className={cn('mt-1 font-mono text-[15px] font-semibold', m.tone)}>{m.value}</p>
                <p className="mt-0.5 text-[9px] text-[#9CA3AF]">{m.hint}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5 xl:col-span-5">
          <SectionTitle title="漏斗瀑布流" subtitle="曝光 → 点击 → 加购 → 支付 → 结算 · 含流失率与耗时" right={<Badge tone="sky">转化 3.07%</Badge>} />
          <div className="mt-4 space-y-2.5">
            {FUNNEL_STAGES.map((s, i) => {
              const maxLog = Math.log10(FUNNEL_STAGES[0].count);
              const minLog = Math.log10(FUNNEL_STAGES[FUNNEL_STAGES.length - 1].count) - 0.4;
              const displayWidth = 22 + ((Math.log10(s.count) - minLog) / (maxLog - minLog)) * 78;
              const overall = (s.count / FUNNEL_STAGES[0].count) * 100;
              return (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-medium text-[#374151]">{s.stage} <span className="font-mono font-normal text-[#9CA3AF]">{s.en}</span></span>
                    <span className="font-mono text-[#6B7280]">{s.count.toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-7 flex-1 overflow-hidden rounded-lg bg-[#F3F4F6]">
                      <div className={cn('flex h-full items-center justify-end rounded-lg pr-2 transition-all duration-700', i === 3 ? 'bg-[#111827]' : i === 4 ? 'bg-emerald-500' : 'bg-sky-400/80')} style={{ width: `${Math.min(100, displayWidth)}%` }} title={`占曝光 ${overall.toFixed(2)}%`}>
                        <span className="font-mono text-[9px] text-white">{s.rate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[9px] text-[#9CA3AF]">
                    <span className="inline-flex items-center gap-1">{i === 0 ? '起点' : <><TrendingDown className="h-2.5 w-2.5 text-rose-400" />流失 {s.lossRate.toFixed(1)}%</>}</span>
                    <span className="inline-flex items-center gap-1 font-mono"><Timer className="h-2.5 w-2.5" />{s.avgMs === 0 ? '-' : `${s.avgMs}ms`}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[10px] leading-relaxed text-amber-800">
            <Flame className="h-3.5 w-3.5 shrink-0" />加购→支付流失 38.4%，主要归因：风控二次核验（41%）、价格敏感跳出（33%）、支付失败（26%）。
          </div>
        </Card>
      </div>

      {/* 系统健康度 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-5">
          <SectionTitle title="Rust 微服务集群" subtitle="CPU / 内存负载 · P99 · QPS" right={<span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#9CA3AF]"><Server className="h-3 w-3" />6 services</span>} />
          <div className="mt-4 space-y-3">
            {SERVICE_HEALTH.map((s) => (
              <div key={s.name} className="rounded-xl bg-[#F9FAFB] px-3.5 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-1.5 w-1.5 rounded-full', s.status === 'healthy' ? 'bg-emerald-500' : s.status === 'degraded' ? 'bg-amber-500' : 'bg-rose-500')} />
                    <span className="font-mono text-[11px] font-semibold text-[#111827]">{s.name}</span>
                    <span className="font-mono text-[9px] text-[#9CA3AF]">{s.version} · {s.pods}</span>
                  </div>
                  <span className="font-mono text-[9px] text-[#9CA3AF]">P99 {s.p99}ms · {s.qps.toLocaleString()}qps</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="h-3 w-3 shrink-0 text-[#9CA3AF]" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white"><div className={cn('h-full rounded-full', s.cpu > 80 ? 'bg-rose-500' : s.cpu > 60 ? 'bg-amber-400' : 'bg-[#111827]')} style={{ width: `${s.cpu}%` }} /></div>
                    <span className="w-7 font-mono text-[9px] text-[#6B7280]">{s.cpu}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MemoryStick className="h-3 w-3 shrink-0 text-[#9CA3AF]" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white"><div className={cn('h-full rounded-full', s.mem > 80 ? 'bg-rose-500' : 'bg-sky-400')} style={{ width: `${s.mem}%` }} /></div>
                    <span className="w-7 font-mono text-[9px] text-[#6B7280]">{s.mem}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 xl:col-span-3">
          <SectionTitle title="数据库主从" subtitle="TiDB / PgSQL 延迟" right={<Database className="h-3.5 w-3.5 text-[#9CA3AF]" />} />
          <div className="mt-4 space-y-2.5">
            {DB_HEALTH.map((d) => (
              <div key={d.name} className="rounded-xl bg-[#F9FAFB] px-3.5 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[#111827]">{d.name}</span>
                  <Badge tone={d.status === 'healthy' ? 'emerald' : 'amber'} dot={false}>{d.status === 'healthy' ? '正常' : '延迟高'}</Badge>
                </div>
                <p className="mt-0.5 font-mono text-[9px] text-[#9CA3AF]">{d.role}</p>
                <div className="mt-1.5 flex items-center justify-between font-mono text-[10px]">
                  <span className={cn('font-semibold', d.lagMs > 500 ? 'text-rose-600' : d.lagMs > 100 ? 'text-amber-600' : 'text-emerald-600')}>{d.lagMs}ms</span>
                  <span className="text-[#9CA3AF]">{d.qps.toLocaleString()} qps · 慢查 {d.slow}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 xl:col-span-4">
          <SectionTitle title="第三方依赖可用性" subtitle="公安 / 银行 / 清算通道" right={<Plug2 className="h-3.5 w-3.5 text-[#9CA3AF]" />} />
          <div className="mt-4 space-y-2">
            {DEP_HEALTH.map((d) => (
              <div key={d.name} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-[#F9FAFB]">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', d.status === 'up' ? 'bg-emerald-500' : d.status === 'flap' ? 'animate-pulse bg-amber-500' : 'bg-rose-500')} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-[#111827]">{d.name}</p>
                  <p className="text-[9px] text-[#9CA3AF]">{d.category} · {d.latencyMs}ms</p>
                </div>
                <span className={cn('font-mono text-[11px] font-semibold', d.availability < 98 ? 'text-amber-600' : 'text-[#111827]')}>{d.availability.toFixed(2)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#111827] px-3.5 py-2.5 text-white">
            <HeartPulse className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px]">全链路可用性 99.95% · 过去 24h 仅建行代付 1 次抖动</span>
          </div>
        </Card>
      </div>

      {/* 高危告警池 */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle title="高危实时告警池" subtitle="黑产攻击 · 资金异常 · 核心服务 · 每条附带一键处置" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setFiringOnly((v) => !v)} className={cn('cursor-pointer rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors', firingOnly ? 'bg-[#111827] text-white' : 'bg-[#F9FAFB] text-[#6B7280] hover:text-[#111827]')}>
              {firingOnly ? '仅看 firing' : '看全部'}
            </button>
            <Badge tone="rose"><Siren className="h-3 w-3" />{alerts.filter((a) => a.status === 'firing').length} firing</Badge>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
          {shownAlerts.map((a) => {
            const meta = LEVEL_META[a.level];
            return (
              <div key={a.id} className={cn('rounded-2xl p-4 transition-all', a.status === 'resolved' ? 'bg-[#F9FAFB] opacity-60' : a.level === 'critical' ? 'bg-rose-50/50' : 'bg-[#F9FAFB]')}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    {a.status === 'resolved' ? <Badge tone="emerald">已熔断</Badge> : a.status === 'muted' ? <Badge tone="slate">已静默</Badge> : <Badge tone="rose" dot={false}><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />FIRING</Badge>}
                  </div>
                  <span className="font-mono text-[9px] text-[#9CA3AF]">{a.time}</span>
                </div>
                <p className="mt-2 text-[12px] font-semibold leading-snug text-[#111827]">{a.title}</p>
                <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[#6B7280]">{a.detail}</p>
                <p className="mt-1.5 font-mono text-[9px] text-[#9CA3AF]">{a.id} · {a.source} · 影响 {a.count}</p>
                <div className="mt-3 flex gap-1.5">
                  {a.status !== 'resolved' ? (
                    <>
                      <Button size="xs" variant="danger" className="flex-1" icon={<AlertOctagon className="h-3 w-3" />} onClick={() => handleFuse(a.id)}>{a.actionLabel}</Button>
                      <Button size="xs" variant="secondary" icon={<BellRing className="h-3 w-3" />} onClick={() => mutedAlerts(a.id)}>静默</Button>
                    </>
                  ) : (
                    <div className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2 text-[10px] font-medium text-emerald-700">
                      <ShieldCheck className="h-3 w-3" />已处置 · 全网生效
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F9FAFB] px-4 py-2.5 text-[10px] text-[#6B7280]">
          <span className="inline-flex items-center gap-1.5"><Radio className="h-3.5 w-3.5 text-[#9CA3AF]" />告警订阅：企业微信群「支付值班」· 电话告警（致命 1 分钟内）· 当前值班：root</span>
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-500" />MTTR 8.2min</span>
            <span className="inline-flex items-center gap-1"><ArrowDownRight className="h-3 w-3 text-emerald-500" />误报率 1.2%</span>
          </span>
        </div>
      </Card>
    </div>
  );
};
