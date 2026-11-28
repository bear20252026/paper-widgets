import { useMemo, useRef, type PointerEvent as RPE, type RefObject } from 'react';
import { FIRST_YEAR, N, RELEASES } from '../data';

const PER = 10;
const COUNT = (N - 1) * PER + 1;

interface Props {
  current: number;
  markerRef: RefObject<HTMLDivElement | null>;
  playedRef: RefObject<HTMLDivElement | null>;
  onSeek(i: number): void;
}

function Ticks({ heights, className }: { heights: number[]; className: string }) {
  return (
    <svg
      className={`absolute inset-0 h-full w-full ${className}`}
      viewBox={`0 0 ${COUNT - 1} 100`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {heights.map((hgt, i) => (
        <line
          key={i}
          x1={i}
          x2={i}
          y1={100}
          y2={100 - hgt}
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          className={i % PER === 0 ? '' : i % 2 ? 'max-md:hidden' : 'max-sm:opacity-70'}
        />
      ))}
    </svg>
  );
}

export default function Timeline({ current, markerRef, playedRef, onSeek }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const heights = useMemo(() => {
    let s = 41;
    const rnd = () => ((s = (s * 16807) % 2147483647) & 0xffff) / 0xffff;
    return Array.from({ length: COUNT }, (_, i) => {
      if (i % PER === 0) return 100;
      const swell = 0.5 + 0.5 * Math.sin(i * 0.31) * Math.sin(i * 0.07 + 1);
      return 22 + swell * 34 + rnd() * 26;
    });
  }, []);

  const seek = (e: RPE<HTMLDivElement>) => {
    const r = trackRef.current!.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    onSeek(Math.round(f * (N - 1)));
  };

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Release year"
        aria-valuemin={FIRST_YEAR}
        aria-valuemax={FIRST_YEAR + N - 1}
        aria-valuenow={FIRST_YEAR + current}
        aria-valuetext={`${RELEASES[current].year}, ${RELEASES[current].title}`}
        className="relative h-9 cursor-pointer touch-none sm:h-11"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seek(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1 || e.pointerType === 'touch') {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(e);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.stopPropagation();
            onSeek(Math.max(0, Math.min(N - 1, current + (e.key === 'ArrowRight' ? 1 : -1))));
          }
        }}
      >
        <Ticks heights={heights} className="text-[#121212]/20" />
        <div ref={playedRef} className="absolute inset-0" style={{ clipPath: 'inset(0 100% 0 0)' }}>
          <Ticks heights={heights} className="text-[#121212]" />
        </div>
        <div ref={markerRef} className="pointer-events-none absolute -top-2 bottom-0 w-0" style={{ left: '0%' }}>
          <span className="absolute -left-px top-0 h-full w-[2px] bg-[#e8542b]" />
          <span className="absolute -left-[5px] -top-[5px] h-[10px] w-[10px] rounded-full bg-[#e8542b]" />
        </div>
      </div>
      <div className="relative mt-2 h-6 sm:mt-3">
        {RELEASES.map((r, i) => {
          const full = i % 3 === 0 || i === current;
          return (
            <button
              key={r.cat}
              type="button"
              onClick={() => onSeek(i)}
              aria-label={`${r.year} — ${r.title}`}
              aria-current={i === current}
              style={{ left: `${(i / (N - 1)) * 100}%` }}
              className={`mono absolute top-0 -translate-x-1/2 whitespace-nowrap rounded px-1 text-[13px] tracking-[0.14em] transition-colors duration-200 sm:text-[15px] lg:text-[17px] ${
                i === current ? 'text-[#121212]' : 'text-[#121212]/55 hover:text-[#121212]'
              } ${i === current || (i % 3 === 0 && Math.abs(i - current) > 2) ? '' : 'hidden md:block'}`}
            >
              {full ? r.year : `’${String(r.year).slice(2)}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
