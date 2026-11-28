import { useEffect, useMemo, useRef } from 'react';
import { RELEASES, runtime } from '../data';

export type PanelTab = 'releases' | 'artists';

interface Props {
  tab: PanelTab;
  current: number;
  onTab(t: PanelTab): void;
  onPick(i: number): void;
  onClose(): void;
}

const sortKey = (s: string) => s.replace(/^The\s+/i, '');

export default function IndexPanel({ tab, current, onTab, onPick, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);

  const rows = useMemo(
    () =>
      tab === 'releases'
        ? RELEASES
        : [...RELEASES].sort((a, b) => sortKey(a.artist).localeCompare(sortKey(b.artist))),
    [tab],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Catalogue index"
      className="panel-in absolute inset-0 z-50 flex flex-col bg-[#101010] text-[#ecece8]"
    >
      <div className="flex h-[72px] shrink-0 items-center justify-between px-5 sm:px-8 lg:h-[96px] lg:px-12">
        <div className="flex items-center gap-2">
          {(['releases', 'artists'] as PanelTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTab(t)}
              aria-pressed={tab === t}
              className={`rounded-full border px-4 py-2 text-[15px] capitalize transition-colors duration-200 ${
                tab === t
                  ? 'border-[#ecece8] bg-[#ecece8] text-[#101010]'
                  : 'border-white/20 text-[#ecece8]/75 hover:border-white/60 hover:text-[#ecece8]'
              }`}
            >
              {t}
            </button>
          ))}
          <span className="mono ml-4 hidden text-[11px] uppercase tracking-[0.28em] text-white/45 sm:block">
            {tab === 'releases' ? 'By catalogue number' : 'A — Z'}
          </span>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mono flex items-center gap-3 rounded-full px-3 py-2 text-[11px] uppercase tracking-[0.28em] text-white/75 transition-colors hover:text-white"
        >
          Close
          <span aria-hidden="true" className="relative block h-4 w-4">
            <span className="absolute left-0 top-1/2 h-px w-4 rotate-45 bg-current" />
            <span className="absolute left-0 top-1/2 h-px w-4 -rotate-45 bg-current" />
          </span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-10 sm:px-8 lg:px-12">
        <ul className="border-t border-white/15">
          {rows.map((r) => (
            <li key={r.cat} className="border-b border-white/15">
              <button
                type="button"
                onClick={() => onPick(r.idx)}
                className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 py-3.5 text-left transition-colors duration-200 hover:bg-white/[0.06] sm:grid-cols-[92px_1.4fr_1fr_120px_64px] sm:gap-x-6 sm:px-3 lg:py-4"
              >
                <span className="mono flex items-center gap-2.5 text-[11px] tracking-[0.2em] text-white/55">
                  <span
                    className="block h-5 w-[7px] rounded-[1.5px] ring-1 ring-white/20"
                    style={{ background: r.pal.bg }}
                  />
                  {r.cat}
                </span>
                <span className="flex min-w-0 flex-col sm:contents">
                  <span className="truncate text-[19px] font-medium tracking-[-0.01em] transition-transform duration-300 group-hover:translate-x-1.5 lg:text-[24px]">
                    {tab === 'releases' ? r.title : r.artist}
                    {r.idx === current && (
                      <span className="ml-3 inline-block h-2 w-2 -translate-y-[3px] rounded-full bg-[#e8542b]" />
                    )}
                  </span>
                  <span className="truncate text-[14px] text-white/60 lg:text-[16px]">
                    {tab === 'releases' ? r.artist : r.title}
                  </span>
                </span>
                <span className="mono hidden text-[11px] uppercase tracking-[0.2em] text-white/45 sm:block">
                  {r.genre}
                </span>
                <span className="mono text-right text-[12px] tracking-[0.14em] text-white/70">
                  {r.year}
                  <span className="sr-only">, {runtime(r)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
