import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Files, RefreshCw, X } from 'lucide-react';
import type { WorkspaceTab } from '../lib/types';
import { cn } from './ui';

interface WorkspaceTabsProps {
  tabs: WorkspaceTab[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onRefresh: () => void;
  onRefreshTab: (id: string) => void;
}

export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({ tabs, activeId, onActivate, onClose, onCloseOthers, onCloseAll, onRefresh, onRefreshTab }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('resize', close);
    };
  }, [contextMenu]);

  const openContextMenu = (event: React.MouseEvent, tabId: string) => {
    event.preventDefault();
    setMenuOpen(false);
    setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 190), y: Math.min(event.clientY, window.innerHeight - 170), tabId });
  };

  useEffect(() => {
    const active = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []).find((el) => el.dataset.tabId === activeId);
    active?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [activeId]);

  return (
    <div className="relative z-20 flex h-12 shrink-0 items-center bg-white shadow-[0_1px_2px_rgba(15,23,42,0.035)]" aria-label="工作区页签">
      <div ref={listRef} role="tablist" aria-label="已打开页面" className="flex h-full min-w-0 flex-1 items-stretch gap-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.length === 0 && <span className="flex items-center gap-2 px-3 text-xs text-[#9CA3AF]"><Files className="h-3.5 w-3.5" /> 暂无打开的页签</span>}
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <div key={tab.id} onContextMenu={(e) => openContextMenu(e, tab.id)} className={cn('group relative my-1.5 flex shrink-0 items-center rounded-lg transition-colors', active ? 'bg-[#111827] text-white' : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]')}>
              <button
                type="button"
                role="tab"
                data-tab-id={tab.id}
                aria-selected={active}
                onClick={() => onActivate(tab.id)}
                className="flex h-9 max-w-[210px] cursor-pointer items-center gap-2 truncate py-1.5 pl-3 pr-1 text-[11px] font-medium"
                title={tab.label}
              >
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', active ? 'bg-orange-400' : 'bg-[#D1D5DB]')} />
                <span className="truncate">{tab.label}</span>
              </button>
              <button
                type="button"
                aria-label={`关闭页签 ${tab.label}`}
                title={`关闭 ${tab.label}`}
                onClick={() => onClose(tab.id)}
                className={cn('mr-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors', active ? 'text-white/65 hover:bg-white/15 hover:text-white' : 'text-[#C0C6CF] hover:bg-[#E5E7EB] hover:text-[#374151]')}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
      {contextMenu && (
        <div role="menu" aria-label="页签右键菜单" style={{ left: contextMenu.x, top: contextMenu.y }} className="fixed z-50 w-44 rounded-xl bg-white p-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.18)]">
          {[
            { text: '激活此页签', action: () => onActivate(contextMenu.tabId) },
            { text: '刷新此页签', action: () => { onActivate(contextMenu.tabId); onRefreshTab(contextMenu.tabId); } },
            { text: '关闭此页签', action: () => onClose(contextMenu.tabId) },
            { text: '关闭其他页签', action: onCloseOthers, disabled: tabs.length < 2 },
            { text: '关闭全部页签', action: onCloseAll, disabled: tabs.length === 0 },
          ].map((item) => <button key={item.text} role="menuitem" type="button" disabled={item.disabled} onClick={() => { setContextMenu(null); item.action(); }} className="flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-xs text-[#374151] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-35">{item.text}</button>)}
        </div>
      )}
      <div className="relative flex h-full shrink-0 items-center gap-1 bg-white px-2 shadow-[-5px_0_10px_-6px_rgba(15,23,42,0.12)]">
        <button type="button" aria-label="刷新当前页签" title="刷新当前页签：重置未保存状态" disabled={!activeId} onClick={onRefresh} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F9FAFB] hover:text-[#111827] disabled:opacity-30"><RefreshCw className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="页签操作" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)} className="flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11px] text-[#6B7280] hover:bg-[#F9FAFB]"><ChevronDown className="h-3.5 w-3.5" /><span className="hidden sm:inline">页签操作</span></button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-2 top-full z-40 mt-1.5 w-44 rounded-xl bg-white p-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.15)]">
              {[
                { text: '刷新当前页', action: onRefresh, disabled: !activeId },
                { text: '关闭当前页', action: () => onClose(activeId), disabled: !activeId },
                { text: '关闭其他页', action: onCloseOthers, disabled: tabs.length < 2 },
                { text: '关闭全部页', action: onCloseAll, disabled: tabs.length === 0 },
              ].map((item) => <button key={item.text} type="button" disabled={item.disabled} onClick={() => { setMenuOpen(false); item.action(); }} className="flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-xs text-[#374151] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-35">{item.text}</button>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
};