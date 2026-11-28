import React, { useEffect, useState } from 'react';
import { Keyboard, LayoutPanelTop, Settings2, Shield, X } from 'lucide-react';
import type { UiPreferences } from '../lib/types';
import { Modal, Switch, cn } from './ui';

interface ConsolePreferencesProps {
  value: UiPreferences;
  onChange: (next: UiPreferences) => void;
  onHelpOpen?: () => void;
}

export const ConsolePreferences: React.FC<ConsolePreferencesProps> = ({ value, onChange, onHelpOpen }) => {
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const showHelp = () => setHelp(true);
    window.addEventListener('wt:shortcut-help', showHelp);
    return () => window.removeEventListener('wt:shortcut-help', showHelp);
  }, []);
  return (
    <div className="relative">
      <button type="button" aria-label="偏好设置" title="偏好设置" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={cn('flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-[#6B7280] transition-colors hover:bg-[#F3F4F6]', open ? 'bg-[#F3F4F6]' : 'bg-[#F9FAFB]')}><Settings2 className="h-4 w-4" /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl bg-white p-3 shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
            <div className="flex items-center justify-between px-1 pb-2"><div><p className="text-xs font-semibold text-[#111827]">工作台偏好</p><p className="mt-0.5 text-[10px] text-[#9CA3AF]">自动保存在当前浏览器</p></div><X className="h-3.5 w-3.5 cursor-pointer text-[#9CA3AF]" onClick={() => setOpen(false)} /></div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-[#F9FAFB] p-3"><span className="flex items-start gap-2"><Shield className="mt-0.5 h-3.5 w-3.5 text-[#6B7280]" /><span><span className="block text-[11px] font-medium text-[#111827]">内容水印</span><span className="mt-0.5 block text-[10px] text-[#9CA3AF]">平铺操作者身份与日期</span></span></span><Switch label="内容水印" checked={value.watermark} onChange={(v) => onChange({ ...value, watermark: v })} /></div>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-[#F9FAFB] p-3"><span className="flex items-start gap-2"><LayoutPanelTop className="mt-0.5 h-3.5 w-3.5 text-[#6B7280]" /><span><span className="block text-[11px] font-medium text-[#111827]">紧凑密度</span><span className="mt-0.5 block text-[10px] text-[#9CA3AF]">收紧表格行高与卡片间距</span></span></span><Switch label="紧凑密度" checked={value.compact} onChange={(v) => onChange({ ...value, compact: v })} /></div>
            </div>
            <button type="button" onClick={() => { setOpen(false); setHelp(true); onHelpOpen?.(); }} className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-medium text-[#4B5563] hover:bg-[#F9FAFB]"><Keyboard className="h-3.5 w-3.5" />快捷键帮助 <span className="ml-auto font-mono text-[10px] text-[#9CA3AF]">?</span></button>
          </div>
        </>
      )}
      <Modal open={help} onClose={() => setHelp(false)} title="键盘快捷键" subtitle="高频操作无需离开键盘" icon={<Keyboard className="h-4 w-4" />} size="sm">
        <div className="space-y-1">
          {[
            ['⌘ K / Ctrl K', '打开命令面板'],
            ['Ctrl Shift W', '切换内容水印'],
            ['Ctrl Shift D', '切换紧凑密度'],
            ['Alt W', '关闭当前页签'],
            ['Alt R', '刷新当前页签'],
            ['Alt Shift T', '撤销关闭页签（8 秒内）'],
            ['Alt ← / →', '在已打开页签间切换'],
            ['Esc', '关闭弹窗与面板'],
          ].map(([key, label]) => <div key={key} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2.5 text-xs"><span className="text-[#374151]">{label}</span><kbd className="rounded-md bg-white px-2 py-1 font-mono text-[10px] text-[#6B7280] shadow-xs">{key}</kbd></div>)}
        </div>
      </Modal>
    </div>
  );
};

const xml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const ContentWatermark: React.FC<{ operator: string }> = ({ operator }) => {
  const text = xml(`WeTrust  ${operator}  ${new Date().toISOString().slice(0, 10)}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="310" height="170" viewBox="0 0 310 170"><text x="20" y="90" transform="rotate(-24 150 85)" fill="#111827" fill-opacity="0.085" font-size="15" font-family="sans-serif" font-weight="600">${text}</text></svg>`;
  return <div aria-hidden="true" data-testid="content-watermark" className="pointer-events-none absolute inset-0 z-10" style={{ backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, backgroundRepeat: 'repeat' }} />;
};