import { useCallback, useEffect, useRef, useState } from 'react';
import { N, RELEASES, mod } from './data';
import { Archive } from './scene';
import { Radio } from './radio';
import { coverURL, fontsReady } from './art';
import Timeline from './components/Timeline';
import IndexPanel, { type PanelTab } from './components/IndexPanel';
import ReleasePage from './components/ReleasePage';

const START = 10; // SBL-011 Concentric
type Mode = 'shelf' | 'opening' | 'page' | 'closing';
type Status = 'loading' | 'ready' | 'nogl';

const ArrowIcon = ({ flip = false }: { flip?: boolean }) => (
  <svg width="26" height="14" viewBox="0 0 26 14" fill="none" aria-hidden="true" className={flip ? 'rotate-180' : ''}>
    <path d="M1 7h23M18 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

export default function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const playedRef = useRef<HTMLDivElement>(null);
  const archRef = useRef<Archive | null>(null);
  const radioRef = useRef<Radio | null>(null);

  const [status, setStatus] = useState<Status>('loading');
  const [cur, setCur] = useState(START);
  const [mode, setMode] = useState<Mode>('shelf');
  const [pageIdx, setPageIdx] = useState(START);
  const [panel, setPanel] = useState<PanelTab | null>(null);
  const [radio, setRadio] = useState(false);

  const rel = RELEASES[cur];
  const shelfLive = mode === 'shelf' && !panel;

  /* ---- 3D shelf ---- */
  useEffect(() => {
    let dead = false;
    let arch: Archive | null = null;
    const placeMarker = (pos: number) => {
      let m = mod(pos, N);
      if (m > N - 0.5) m -= N;
      const f = Math.max(-0.004, Math.min(1.004, m / (N - 1))) * 100;
      if (markerRef.current) markerRef.current.style.left = `${f}%`;
      if (playedRef.current) playedRef.current.style.clipPath = `inset(0 ${100 - f}% 0 0)`;
    };
    fontsReady().then(() => {
      if (dead || !hostRef.current) return;
      try {
        arch = new Archive(
          hostRef.current,
          {
            onIndex: setCur,
            onPos: placeMarker,
            onOpenProgress: (p) => rootRef.current?.style.setProperty('--open', p.toFixed(3)),
            onOpening: () => setMode('opening'),
            onOpened: (i) => {
              setPageIdx(i);
              setMode('page');
            },
            onClosed: () => setMode('shelf'),
          },
          START,
        );
        archRef.current = arch;
        if (import.meta.env.DEV) (window as unknown as { __sable: Archive }).__sable = arch;
        setStatus('ready');
      } catch (err) {
        console.error('WebGL unavailable', err);
        placeMarker(START);
        setStatus('nogl');
      }
    });
    return () => {
      dead = true;
      arch?.dispose();
      archRef.current = null;
    };
  }, []);

  /* ---- keep the shelf centred between header and transport dock ---- */
  useEffect(() => {
    if (status !== 'ready') return;
    const measure = () => {
      if (headRef.current && dockRef.current)
        archRef.current?.setInsets(headRef.current.offsetHeight, dockRef.current.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (headRef.current) ro.observe(headRef.current);
    if (dockRef.current) ro.observe(dockRef.current);
    return () => ro.disconnect();
  }, [status]);

  /* ---- actions ---- */
  const step = useCallback((dir: number) => {
    if (archRef.current) archRef.current.step(dir);
    else setCur((c) => mod(c + dir, N));
  }, []);

  const seek = useCallback((i: number) => {
    if (archRef.current) archRef.current.goToIndex(i, true);
    else setCur(i);
  }, []);

  const openCurrent = useCallback(() => {
    if (archRef.current) archRef.current.open();
    else {
      setPageIdx(cur);
      setMode('page');
    }
  }, [cur]);

  const closePage = useCallback(() => {
    if (archRef.current) {
      setMode('closing');
      archRef.current.close();
    } else setMode('shelf');
  }, []);

  const stepPage = useCallback(
    (dir: number) => {
      const n = mod(pageIdx + dir, N);
      archRef.current?.swapOpen(dir);
      setPageIdx(n);
      if (!archRef.current) setCur(n);
    },
    [pageIdx],
  );

  const pick = useCallback((i: number) => {
    setPanel(null);
    if (archRef.current) archRef.current.goToIndex(i);
    else {
      setCur(i);
      setPageIdx(i);
      setMode('page');
    }
  }, []);

  const toggleRadio = () => {
    if (radio) {
      radioRef.current?.stop();
      radioRef.current = null;
      setRadio(false);
    } else {
      const r = new Radio();
      if (r.start(cur)) {
        radioRef.current = r;
        setRadio(true);
      }
    }
  };

  /* ---- radio follows the platter and turns it on its own ---- */
  useEffect(() => {
    radioRef.current?.setRelease(mode === 'page' ? pageIdx : cur);
  }, [cur, pageIdx, mode]);

  useEffect(() => {
    if (!radio || !shelfLive) return;
    const t = window.setTimeout(() => step(1), 9000);
    return () => window.clearTimeout(t);
  }, [radio, shelfLive, cur, step]);

  useEffect(() => () => radioRef.current?.stop(), []);

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const onControl = (e.target as HTMLElement | null)?.closest?.('button, a, [role="slider"]');
      if (panel) {
        if (e.key === 'Escape') setPanel(null);
        return;
      }
      if (mode === 'page') {
        if (e.key === 'Escape') closePage();
        else if (e.key === 'ArrowRight') stepPage(1);
        else if (e.key === 'ArrowLeft') stepPage(-1);
        return;
      }
      if (mode !== 'shelf') return;
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if ((e.key === 'Enter' || e.key === ' ') && !onControl) {
        e.preventDefault();
        openCurrent();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, mode, step, stepPage, closePage, openCurrent]);

  const navBtn = 'navlink text-[17px] tracking-[-0.005em] text-[#121212] lg:text-[18px]';

  return (
    <div
      ref={rootRef}
      className="stage fixed inset-1.5 overflow-hidden rounded-[18px] sm:inset-2.5 sm:rounded-[22px]"
    >
      {/* 3D stage */}
      <div ref={hostRef} className="absolute inset-0 z-10" />

      {status === 'nogl' && (
        <div className="absolute inset-x-0 top-[96px] z-10 flex flex-col items-center gap-6 px-5">
          <p className="mono max-w-[60ch] text-center text-[11px] uppercase tracking-[0.24em] text-[#121212]/60">
            3D is unavailable in this browser — the shelf is laid flat instead.
          </p>
          <div className="flex w-full snap-x gap-4 overflow-x-auto pb-4">
            {RELEASES.map((r) => (
              <button
                key={r.cat}
                type="button"
                onClick={() => pick(r.idx)}
                aria-label={`Open ${r.title} by ${r.artist}`}
                className="w-[38vh] max-w-[70vw] shrink-0 snap-center transition-transform duration-300 hover:-translate-y-1.5"
              >
                <img src={coverURL(r.idx)} alt="" className="block w-full rounded-[3px] shadow-xl" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- shelf chrome ---- */}
      <div
        className="chrome absolute inset-0 z-20"
        style={{ pointerEvents: 'none' }}
        inert={mode !== 'shelf' || !!panel}
      >
        <header
          ref={headRef}
          className="rise absolute inset-x-0 top-0 flex h-[72px] items-center justify-between px-5 sm:px-8 lg:h-[96px] lg:px-12"
        >
          <div className="pointer-events-auto flex items-center gap-4 lg:gap-5">
            <button
              type="button"
              onClick={() => seek(START)}
              aria-label="Sable — back to the featured release"
              className="flex items-center gap-3"
            >
              <span
                data-on={radio}
                className="logo-disc relative block h-9 w-9 rounded-full bg-[#121212] lg:h-10 lg:w-10"
              >
                <span className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e8542b]" />
                <span className="absolute left-1/2 top-1/2 h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#121212]" />
                <span className="absolute left-[18%] top-[46%] h-px w-[14%] bg-white/50" />
              </span>
              <span className="text-[27px] font-medium tracking-[-0.03em] lg:text-[31px]">Sable</span>
            </button>
            <span className="hidden h-px w-10 bg-[#121212]/30 sm:block lg:w-14" />
            <span className="mono hidden text-[11px] uppercase tracking-[0.32em] text-[#121212]/55 sm:block lg:text-[12px]">
              Disc Archive
            </span>
          </div>

          <div
            aria-live="polite"
            className="mono absolute left-1/2 hidden -translate-x-1/2 items-center gap-4 whitespace-nowrap text-[11px] uppercase tracking-[0.32em] xl:flex xl:text-[12px]"
          >
            <span className={`block h-2 w-2 rounded-full bg-[#e8542b] ${radio ? 'on-air' : ''}`} />
            <span className="text-[#121212]/55">{radio ? 'On air' : 'On the platter'}</span>
            <span className="h-px w-10 bg-[#121212]/30" />
            <span key={cur} className="swap text-[#121212]">
              {rel.cat} {rel.title}
            </span>
          </div>

          <nav className="pointer-events-auto flex items-center gap-6 lg:gap-10" aria-label="Primary">
            <button type="button" className={`${navBtn} hidden md:block`} onClick={() => setPanel('releases')}>
              Releases
            </button>
            <button type="button" className={`${navBtn} hidden md:block`} onClick={() => setPanel('artists')}>
              Artists
            </button>
            <button
              type="button"
              className={`${navBtn} flex items-center gap-2`}
              aria-pressed={radio}
              onClick={toggleRadio}
              title={radio ? 'Turn the radio off' : 'Play a generative pad tuned to the disc on the platter'}
            >
              {radio && <span className="on-air block h-1.5 w-1.5 rounded-full bg-[#e8542b]" />}
              Radio
            </button>
            <button
              type="button"
              onClick={() => setPanel('releases')}
              aria-label="Open the catalogue index"
              className="group -mr-2 grid h-11 w-11 place-items-center"
            >
              <span className="flex w-10 flex-col items-end gap-[7px]">
                <span className="block h-[1.5px] w-10 bg-[#121212] transition-all duration-300 group-hover:w-6" />
                <span className="block h-[1.5px] w-6 bg-[#121212] transition-all duration-300 group-hover:w-10" />
              </span>
            </button>
          </nav>
        </header>

        <div ref={dockRef} className="absolute inset-x-0 bottom-0 px-5 pb-4 pt-1 sm:px-8 lg:px-12 lg:pb-6">
          <div
            className="rise relative mx-auto flex items-center justify-between gap-3 lg:px-[max(16%,calc(50%-420px))]"
            style={{ animationDelay: '150ms' }}
          >
            <span
              aria-hidden="true"
              className="mono absolute left-0 top-0 hidden text-[11px] uppercase tracking-[0.32em] text-[#121212]/35 lg:block xl:text-[12px]"
            >
              Archive — Vol. 01
            </span>
            <span
              aria-hidden="true"
              className="mono absolute right-0 top-0 hidden text-[11px] uppercase tracking-[0.32em] text-[#121212]/35 lg:block xl:text-[12px]"
            >
              {N} cases — 1994 / 2009
            </span>
            <button
              type="button"
              data-dir="-1"
              onClick={() => step(-1)}
              aria-label="Previous release"
              className="round-btn pointer-events-auto h-14 w-14 shrink-0 lg:h-[76px] lg:w-[76px]"
            >
              <ArrowIcon flip />
            </button>

            <div key={cur} className="swap pointer-events-auto min-w-0 text-center">
              <p className="mono flex items-center justify-center gap-3 text-[11px] uppercase tracking-[0.32em] text-[#121212]/55 lg:text-[12px]">
                <span className="block h-2 w-2 rounded-full" style={{ background: rel.page.accent }} />
                {rel.cat} <span className="opacity-60">—</span> {rel.genre}
              </p>
              <button
                type="button"
                onClick={openCurrent}
                title="Open this release"
                className="group mt-2 inline-flex max-w-full items-center gap-3 text-[24px] font-medium tracking-[-0.015em] lg:mt-3 lg:text-[29px]"
              >
                <span className="truncate border-b border-transparent pb-0.5 transition-colors duration-200 group-hover:border-[#121212]">
                  {rel.title}
                </span>
              </button>
              <p className="mt-1 truncate text-[19px] tracking-[-0.01em] text-[#121212]/45 lg:mt-2 lg:text-[26px]">
                {rel.artist}, {rel.year}
              </p>
            </div>

            <button
              type="button"
              data-dir="1"
              onClick={() => step(1)}
              aria-label="Next release"
              className="round-btn pointer-events-auto h-14 w-14 shrink-0 lg:h-[76px] lg:w-[76px]"
            >
              <ArrowIcon />
            </button>
          </div>

          <div className="rise pointer-events-auto mt-4 px-3 sm:px-1 lg:mt-3 lg:px-0" style={{ animationDelay: '260ms' }}>
            <Timeline current={cur} markerRef={markerRef} playedRef={playedRef} onSeek={seek} />
          </div>

          <footer
            className="rise mono pointer-events-auto mt-3 hidden items-center justify-between text-[11px] uppercase tracking-[0.3em] text-[#121212]/50 sm:flex lg:mt-5 lg:text-[12px] [@media(max-height:680px)]:!hidden"
            style={{ animationDelay: '340ms' }}
          >
            <span>© 2026 Sable Records</span>
            <span className="hidden text-[#121212]/40 lg:block">Drag to turn · Click the case to open</span>
            <span className="flex gap-7">
              <a className="transition-colors hover:text-[#121212]" href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                Instagram
              </a>
              <a className="transition-colors hover:text-[#121212]" href="https://bandcamp.com/" target="_blank" rel="noreferrer">
                Bandcamp
              </a>
            </span>
          </footer>
        </div>
      </div>

      {/* ---- loading veil ---- */}
      <div
        aria-hidden={status !== 'loading'}
        className={`stage pointer-events-none absolute inset-0 z-30 grid place-items-center transition-opacity duration-700 ${
          status === 'loading' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-4">
          <span data-on="true" className="logo-disc relative block h-8 w-8 rounded-full bg-[#121212]">
            <span className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e8542b]" />
            <span className="absolute left-[18%] top-[46%] h-px w-[14%] bg-white/60" />
          </span>
          <span className="mono text-[11px] uppercase tracking-[0.32em] text-[#121212]/60">Loading the shelf</span>
        </div>
      </div>

      {(mode === 'page' || mode === 'closing') && (
        <ReleasePage release={RELEASES[pageIdx]} closing={mode === 'closing'} onClose={closePage} onStep={stepPage} />
      )}

      {panel && (
        <IndexPanel tab={panel} current={cur} onTab={setPanel} onPick={pick} onClose={() => setPanel(null)} />
      )}
    </div>
  );
}
