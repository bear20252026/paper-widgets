import React, { useEffect, useMemo, useState } from 'react';
import { Activity, MapPinned, ShieldAlert } from 'lucide-react';
import { cn } from './ui';
import { PROVINCE_TILES, formatFen } from '../lib/ops';
import type { ProvinceTile } from '../lib/ops';

export type MapMetric = 'tx' | 'risk';

interface LiveEvent {
  id: number;
  code: string;
  text: string;
  kind: MapMetric;
  time: string;
}

const COLS = 8;
const ROWS = 9;

/** 在两种颜色之间插值，返回 rgb 字符串 */
const mix = (from: [number, number, number], to: [number, number, number], t: number): string => {
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(from[0] + (to[0] - from[0]) * k);
  const g = Math.round(from[1] + (to[1] - from[1]) * k);
  const b = Math.round(from[2] + (to[2] - from[2]) * k);
  return `rgb(${r}, ${g}, ${b})`;
};

const TX_FROM: [number, number, number] = [243, 244, 246];
const TX_TO: [number, number, number] = [17, 24, 39];
const RISK_FROM: [number, number, number] = [255, 241, 242];
const RISK_TO: [number, number, number] = [225, 29, 72];

const nowLabel = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

interface ChinaTileMapProps {
  metric: MapMetric;
  selected: string;
  onSelect: (code: string) => void;
}

export const ChinaTileMap: React.FC<ChinaTileMapProps> = ({ metric, selected, onSelect }) => {
  const [flashing, setFlashing] = useState<{ id: number; code: string }[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [hover, setHover] = useState<ProvinceTile | null>(null);

  const maxTx = useMemo(() => Math.max(...PROVINCE_TILES.map((p) => p.txFen)), []);
  const maxRisk = useMemo(() => Math.max(...PROVINCE_TILES.map((p) => p.riskCount)), []);

  // 实时事件流：按交易/风险权重随机抽取省份闪烁，模拟 Flink 推送
  useEffect(() => {
    let seq = 0;
    const pickWeighted = (kind: MapMetric): ProvinceTile => {
      const weights = PROVINCE_TILES.map((p) => (kind === 'tx' ? p.txFen : p.riskCount * 1000000 + 1));
      const total = weights.reduce((s, w) => s + w, 0);
      let r = Math.random() * total;
      for (let i = 0; i < PROVINCE_TILES.length; i += 1) {
        r -= weights[i];
        if (r <= 0) return PROVINCE_TILES[i];
      }
      return PROVINCE_TILES[0];
    };
    const timer = window.setInterval(() => {
      const kind: MapMetric = Math.random() < 0.68 ? 'tx' : 'risk';
      const target = pickWeighted(kind);
      seq += 1;
      const amount = Math.floor(Math.random() * 48000 + 1200);
      const riskTexts = ['薅羊毛设备农场', '异地大额转账', '模拟器改机', '代理 IP 批量注册', '涉赌代付'];
      const event: LiveEvent = {
        id: seq,
        code: target.code,
        kind,
        time: nowLabel(),
        text:
          kind === 'tx'
            ? `${target.name} · 支付成功 +¥${amount.toLocaleString('zh-CN')}`
            : `${target.name} · 拦截「${riskTexts[seq % riskTexts.length]}」`,
      };
      const flashId = seq;
      setFlashing((prev) => [...prev.slice(-7), { id: flashId, code: target.code }]);
      setEvents((prev) => [event, ...prev].slice(0, 6));
      window.setTimeout(() => {
        setFlashing((prev) => prev.filter((f) => f.id !== flashId));
      }, 1600);
    }, 1100);
    return () => window.clearInterval(timer);
  }, []);

  const tiles = useMemo(() => {
    const grid: (ProvinceTile | null)[][] = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
    PROVINCE_TILES.forEach((p) => {
      grid[p.row][p.col] = p;
    });
    return grid;
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
      <div className="relative">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
          {tiles.flatMap((row, r) =>
            row.map((p, c) => {
              if (!p) return <div key={`${r}-${c}`} className="aspect-square" />;
              const ratio = metric === 'tx' ? Math.sqrt(p.txFen / maxTx) : Math.sqrt(p.riskCount / maxRisk);
              const bg = metric === 'tx' ? mix(TX_FROM, TX_TO, ratio) : mix(RISK_FROM, RISK_TO, ratio);
              const dark = ratio > 0.5;
              const isFlash = flashing.some((f) => f.code === p.code);
              const isSelected = selected === p.code;
              const hotRisk = p.riskCount >= 40;
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => onSelect(p.code)}
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    'group relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg transition-all duration-300 hover:z-10 hover:scale-110',
                    isSelected && 'z-10 ring-2 ring-orange-500 ring-offset-2 ring-offset-white'
                  )}
                  style={{ backgroundColor: bg }}
                  aria-label={`${p.name} 交易 ${formatFen(p.txFen)} 风险 ${p.riskCount}`}
                >
                  {isFlash && (
                    <span className={cn('absolute inset-0 animate-ping rounded-lg', metric === 'risk' || hotRisk ? 'bg-rose-500/40' : 'bg-emerald-400/50')} />
                  )}
                  {metric === 'risk' && hotRisk && <span className="absolute top-1 right-1 h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
                  <span className={cn('relative text-[12px] leading-none font-bold sm:text-[13px]', dark ? 'text-white' : 'text-[#374151]')}>{p.short}</span>
                  <span className={cn('relative mt-0.5 hidden font-mono text-[7.5px] leading-none sm:block', dark ? 'text-white/60' : 'text-[#9CA3AF]')}>
                    {metric === 'tx' ? `${(p.txFen / 100 / 10000).toFixed(0)}万` : p.riskCount}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {hover && (
          <div className="pointer-events-none absolute top-0 left-0 z-20 w-44 rounded-xl bg-[#111827] px-3 py-2.5 text-white shadow-xl">
            <p className="text-[11px] font-semibold">{hover.name}</p>
            <p className="mt-1 font-mono text-[10px] text-gray-300">交易 {formatFen(hover.txFen)}</p>
            <p className="font-mono text-[10px] text-rose-300">风险事件 {hover.riskCount}</p>
            <p className="font-mono text-[10px] text-gray-400">活跃商户 {hover.users.toLocaleString('zh-CN')}</p>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <span className="text-[9px] text-[#9CA3AF]">低</span>
          <div
            className="h-1.5 flex-1 rounded-full"
            style={{
              background:
                metric === 'tx'
                  ? 'linear-gradient(90deg, rgb(243,244,246), rgb(17,24,39))'
                  : 'linear-gradient(90deg, rgb(255,241,242), rgb(225,29,72))',
            }}
          />
          <span className="text-[9px] text-[#9CA3AF]">高</span>
          <span className="ml-2 font-mono text-[9px] text-[#9CA3AF]">√ 标度 · 34 省级行政区</span>
        </div>
      </div>

      <div className="flex flex-col rounded-2xl bg-[#F9FAFB] p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#111827]">
            <Activity className="h-3 w-3 text-emerald-500" />实时事件流
          </span>
          <span className="flex items-center gap-1 font-mono text-[8.5px] text-[#9CA3AF]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />LIVE
          </span>
        </div>
        <div className="mt-2 flex-1 space-y-1.5 overflow-hidden">
          {events.length === 0 && <p className="py-6 text-center text-[10px] text-[#9CA3AF]">等待事件推送…</p>}
          {events.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelect(e.code)}
              className="animate-toast-in flex w-full cursor-pointer items-start gap-2 rounded-lg bg-white px-2 py-1.5 text-left shadow-xs transition-opacity hover:bg-white/80"
              style={{ opacity: 1 - i * 0.12 }}
            >
              {e.kind === 'tx' ? (
                <MapPinned className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
              ) : (
                <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-rose-500" />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-[10px] font-medium', e.kind === 'tx' ? 'text-[#111827]' : 'text-rose-700')}>{e.text}</span>
                <span className="block font-mono text-[8.5px] text-[#9CA3AF]">{e.time}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
