import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Command, CornerDownLeft, Search, Zap } from 'lucide-react';
import { cn } from './ui';

export interface PaletteItem {
  id: string;
  group: '页面' | '操作' | '角色';
  label: string;
  hint: string;
  keywords: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  items: PaletteItem[];
  onClose: () => void;
}

/** 全局命令面板：页面跳转 / 角色切换 / 快捷操作，支持键盘上下选择与回车执行 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, items, onClose }) => {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => `${item.label} ${item.hint} ${item.keywords}`.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const execute = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const groups = (['页面', '操作', '角色'] as const)
    .map((group) => ({ group, list: results.filter((r) => r.group === group) }))
    .filter((g) => g.list.length > 0);

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-[#0B1220]/35 px-4 pt-[12vh] backdrop-blur-[3px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-modal-in w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_rgba(15,23,42,0.3)]">
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <Search className="h-4 w-4 text-[#9CA3AF]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(results.length - 1, c + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                execute(groups.flatMap((g) => g.list)[cursor]);
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="搜索页面、操作或切换角色…"
            className="flex-1 bg-transparent text-sm text-[#111827] placeholder-[#9CA3AF] outline-none"
          />
          <kbd className="rounded-md bg-[#F3F4F6] px-1.5 py-0.5 font-mono text-[10px] text-[#9CA3AF]">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto border-t border-[#F3F4F6] p-2">
          {groups.length === 0 && <p className="py-10 text-center text-xs text-[#9CA3AF]">没有匹配「{query}」的结果</p>}
          {groups.map(({ group, list }) => (
            <div key={group} className="mb-1">
              <p className="px-2.5 pt-2 pb-1 font-mono text-[9px] tracking-wider text-[#9CA3AF] uppercase">{group}</p>
              {list.map((item) => {
                runningIndex += 1;
                const index = runningIndex;
                const active = index === cursor;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => execute(item)}
                    className={cn('flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors', active ? 'bg-[#111827] text-white' : 'text-[#111827]')}
                  >
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', active ? 'bg-white/10 text-orange-400' : 'bg-[#F9FAFB] text-[#9CA3AF]')}>
                      {item.group === '页面' ? <ArrowRight className="h-3.5 w-3.5" /> : item.group === '操作' ? <Zap className="h-3.5 w-3.5" /> : <Command className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium">{item.label}</span>
                      <span className={cn('block truncate text-[10px]', active ? 'text-white/50' : 'text-[#9CA3AF]')}>{item.hint}</span>
                    </span>
                    {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-white/60" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between bg-[#F9FAFB] px-4 py-2 font-mono text-[9.5px] text-[#9CA3AF]">
          <span>↑↓ 选择 · ↵ 执行 · ESC 关闭</span>
          <span>{results.length} 项</span>
        </div>
      </div>
    </div>
  );
};
