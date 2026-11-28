import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { N, RELEASES, mod, runtime, type Release } from '../data';
import { coverURL, discURL } from '../art';

interface Props {
  release: Release;
  closing: boolean;
  onClose(): void;
  onStep(dir: number): void;
}

const Arrow = ({ flip = false }: { flip?: boolean }) => (
  <svg width="22" height="12" viewBox="0 0 22 12" fill="none" aria-hidden="true" className={flip ? 'rotate-180' : ''}>
    <path d="M0 6h20M15 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export default function ReleasePage({ release: r, closing, onClose, onStep }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const cover = useMemo(() => coverURL(r.idx), [r.idx]);
  const disc = useMemo(() => discURL(r.idx), [r.idx]);
  const next = RELEASES[mod(r.idx + 1, N)];
  const prev = RELEASES[mod(r.idx - 1, N)];

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    scroller.current?.focus({ preventScroll: true });
  }, [r.idx]);

  const vars = { '--bg': r.page.bg, '--fg': r.page.fg, '--ac': r.page.accent } as CSSProperties;
  const rule = 'border-[color-mix(in_srgb,var(--fg)_22%,transparent)]';
  const soft = 'text-[color-mix(in_srgb,var(--fg)_72%,transparent)]';

  return (
    <div
      style={vars}
      className={`absolute inset-0 z-40 overflow-hidden bg-[var(--bg)] text-[var(--fg)] transition-opacity duration-300 ${
        closing ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* the rim of the centre hole rushing past as we come through */}
      <div aria-hidden="true" className="hole-ring pointer-events-none absolute left-1/2 top-1/2 z-50" />

      <div
        ref={scroller}
        tabIndex={-1}
        role="document"
        aria-label={`${r.title} by ${r.artist}`}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden outline-none"
      >
      <div key={r.cat} className="arrive mx-auto flex min-h-full max-w-[1500px] flex-col">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-5 backdrop-blur-md sm:px-8 lg:h-[96px] lg:px-12">
          <button
            type="button"
            onClick={onClose}
            className={`group flex items-center gap-3 rounded-full border ${rule} py-2.5 pl-4 pr-5 text-[15px] transition-colors duration-200 hover:bg-[var(--fg)] hover:text-[var(--bg)]`}
          >
            <Arrow flip />
            Back to the shelf
          </button>
          <span className={`mono hidden text-[11px] uppercase tracking-[0.28em] md:block ${soft}`}>
            {r.cat} <span className="mx-2 opacity-50">—</span> {r.genre}
          </span>
          <div className="flex items-center gap-2">
            {[-1, 1].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onStep(d)}
                aria-label={d < 0 ? `Previous release: ${prev.title}` : `Next release: ${next.title}`}
                className={`grid h-11 w-11 place-items-center rounded-full border ${rule} transition-colors duration-200 hover:bg-[var(--fg)] hover:text-[var(--bg)]`}
              >
                <Arrow flip={d < 0} />
              </button>
            ))}
          </div>
        </header>

        <section className="grid gap-10 px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:px-12 lg:pb-20 lg:pt-10">
          <div className="lg:col-span-7">
            <p
              className={`mono rise flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] uppercase tracking-[0.28em] ${soft}`}
              style={{ animationDelay: '60ms' }}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--ac)]" />
              {[String(r.year), 'Compact Disc', `${r.tracks.length} tracks`, runtime(r)].map((t, i) => (
                <span key={t} className="flex items-center gap-4 whitespace-nowrap">
                  {i > 0 && <span className="opacity-50">/</span>}
                  {t}
                </span>
              ))}
            </p>
            <h1
              className="rise mt-6 text-balance text-[clamp(3.1rem,9.2vw,9.25rem)] font-semibold leading-[0.9] tracking-[-0.045em]"
              style={{ animationDelay: '120ms' }}
            >
              {r.title}
            </h1>
            <p
              className="rise mt-6 text-[clamp(1.35rem,2.4vw,2.1rem)] tracking-[-0.015em]"
              style={{ animationDelay: '190ms' }}
            >
              {r.artist}
            </p>
            <p
              className={`rise mt-8 max-w-[46ch] text-pretty text-[18px] leading-[1.55] lg:text-[20px] ${soft}`}
              style={{ animationDelay: '260ms' }}
            >
              {r.blurb}
            </p>
          </div>

          <div className="rise lg:col-span-5" style={{ animationDelay: '220ms' }}>
            <div className="relative mx-auto w-[78%] max-w-[440px] lg:ml-0 lg:mr-auto lg:mt-4">
              <div className="absolute left-[42%] top-[4%] aspect-square w-[92%]">
                <img
                  src={disc}
                  alt=""
                  className="page-disc h-full w-full rounded-full shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)]"
                />
              </div>
              <img
                src={cover}
                alt={`Sleeve artwork for ${r.title} by ${r.artist}`}
                className="relative block aspect-[1000/1024] w-full rounded-[3px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5),0_2px_0_rgba(255,255,255,0.25)_inset]"
              />
            </div>
          </div>
        </section>

        <section className={`grid gap-12 border-t ${rule} px-5 py-12 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:px-12 lg:py-16`}>
          <div className="lg:col-span-7">
            <h2 className={`mono text-[11px] uppercase tracking-[0.28em] ${soft}`}>Tracklist</h2>
            <ol className={`mt-6 border-t ${rule}`}>
              {r.tracks.map(([t, d], i) => (
                <li
                  key={t}
                  className={`group flex items-baseline gap-5 border-b ${rule} py-4 transition-[padding] duration-300 hover:pl-3`}
                >
                  <span className={`mono w-7 text-[12px] tracking-[0.14em] ${soft}`}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 text-[20px] tracking-[-0.01em] lg:text-[26px]">
                    {t}
                    {t === r.title && (
                      <span className="mono ml-3 align-middle text-[10px] uppercase tracking-[0.24em] text-[var(--ac)]">
                        Title track
                      </span>
                    )}
                  </span>
                  <span className={`mono text-[13px] tracking-[0.1em] ${soft}`}>{d}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="lg:col-span-4 lg:col-start-9">
            <h2 className={`mono text-[11px] uppercase tracking-[0.28em] ${soft}`}>Sleeve notes</h2>
            <dl className={`mt-6 border-t ${rule} text-[16px]`}>
              {[
                ['Catalogue', r.cat],
                ['Released', String(r.year)],
                ['Genre', r.genre],
                ['Recorded at', r.where],
                ['Engineered by', r.by],
                ['Running time', runtime(r)],
                ['Sleeve', 'Sable Studio'],
              ].map(([k, v]) => (
                <div key={k} className={`flex justify-between gap-6 border-b ${rule} py-3`}>
                  <dt className={soft}>{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <button
          type="button"
          onClick={() => onStep(1)}
          className={`group mt-auto flex items-end justify-between gap-6 border-t ${rule} px-5 py-10 text-left transition-colors duration-300 hover:bg-[var(--fg)] hover:text-[var(--bg)] sm:px-8 lg:px-12 lg:py-14`}
        >
          <span>
            <span className="mono block text-[11px] uppercase tracking-[0.28em] opacity-70">
              Next on the shelf <span className="mx-2 opacity-50">—</span> {next.cat}
            </span>
            <span className="mt-3 block text-[clamp(2rem,5.4vw,5rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
              {next.title}
            </span>
          </span>
          <span className="mb-3 transition-transform duration-300 group-hover:translate-x-2">
            <Arrow />
          </span>
        </button>
      </div>
      </div>
    </div>
  );
}
