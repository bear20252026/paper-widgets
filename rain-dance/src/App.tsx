import { useCallback, useEffect, useRef, useState } from 'react';
import { Experience, BEATS_PER_SCENE } from './three/Experience';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const serif = { fontFamily: "'Cormorant Garamond','Iowan Old Style','Palatino Linotype','Book Antiqua',Georgia,serif" };

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const exp = useRef<Experience | null>(null);
  const [meta, setMeta] = useState<{ title: string; line: string }[]>([]);
  const [scene, setScene] = useState(0);
  const [beat, setBeat] = useState(0);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!host.current) return;
    try {
      const e = new Experience(host.current, { onScene: setScene, onBeat: setBeat });
      exp.current = e;
      setMeta(e.envs.map((x) => ({ title: x.title, line: x.line })));
      return () => { e.dispose(); exp.current = null; };
    } catch (err) {
      console.error(err);
      setError('This piece needs WebGL, which does not seem to be available in this browser.');
    }
  }, []);

  const begin = useCallback(() => { exp.current?.begin(); setStarted(true); setPaused(false); }, []);
  const toggleMute = useCallback(() => setMuted((m) => { exp.current?.score.setMuted(!m); return !m; }), []);
  const togglePause = useCallback(() => { if (exp.current) setPaused(exp.current.togglePause()); }, []);
  const jump = useCallback((i: number) => exp.current?.jump(((i % 8) + 8) % 8), []);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && exp.current && !exp.current.paused) setPaused(exp.current.togglePause());
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!started) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); begin(); } return; }
      if (ev.key === ' ') { ev.preventDefault(); togglePause(); }
      else if (ev.key === 'm' || ev.key === 'M') toggleMute();
      else if (ev.key === 'ArrowRight') jump(scene + 1);
      else if (ev.key === 'ArrowLeft') jump(scene - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, scene, begin, togglePause, toggleMute, jump]);

  const m = meta[scene];
  const btn = 'pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white/80 backdrop-blur-md transition hover:border-white/50 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-black text-white select-none">
      <div ref={host} className={`absolute inset-0 transition-[filter,transform] duration-[1600ms] ease-out ${started ? '' : 'scale-105 blur-[6px] brightness-[0.6]'}`} />

      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black p-8 text-center text-white/80">{error}</div>
      )}

      {/* cinematic bars */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[7vh] bg-gradient-to-b from-black/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[26vh] bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      {/* intro */}
      <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center transition-opacity duration-1000 ${started ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        <p className="mb-5 text-[11px] uppercase tracking-[0.5em] text-white/60">A study in code, light &amp; water</p>
        <h1 style={serif} className="text-5xl font-light italic leading-[1.05] text-white drop-shadow-[0_2px_30px_rgba(255,120,160,0.45)] sm:text-7xl md:text-8xl">
          Eight Beats<br />of Rain
        </h1>
        <p style={serif} className="mt-6 max-w-md text-lg leading-relaxed text-white/75 sm:text-xl">
          A girl, an umbrella and the rain — dancing through eight scenes of one small love story.
        </p>
        <button
          onClick={begin}
          className="cta-pulse group mt-10 rounded-full border border-white/40 bg-white/10 px-10 py-3.5 text-xs uppercase tracking-[0.4em] text-white backdrop-blur-md transition hover:border-white hover:bg-white hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Step into the rain
        </button>
        <p className="mt-6 text-[11px] tracking-[0.2em] text-white/45">Sound on · everything you see and hear is generated live</p>
      </div>

      {/* HUD */}
      <div className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-1000 ${started ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute left-5 top-5 flex items-center gap-3 sm:left-8 sm:top-7">
          <span style={serif} className="text-lg italic text-white/90">Eight Beats of Rain</span>
          <span className="hidden text-[10px] uppercase tracking-[0.35em] text-white/45 sm:inline">three.js · procedural</span>
        </div>

        <div className="absolute right-5 top-5 flex gap-2 sm:right-8 sm:top-6">
          <button className={btn} onClick={togglePause} aria-label={paused ? 'Play' : 'Pause'} title="Space" tabIndex={started ? 0 : -1}>
            {paused ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9-5.5z" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2.5" y="1.5" width="3" height="11" rx="1" /><rect x="8.5" y="1.5" width="3" height="11" rx="1" /></svg>
            )}
          </button>
          <button className={btn} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title="M" tabIndex={started ? 0 : -1}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor" />
              {muted ? <path d="M11 6l3.5 4M14.5 6L11 10" /> : <path d="M10.5 5.5a3.5 3.5 0 010 5M12.5 3.5a6.5 6.5 0 010 9" />}
            </svg>
          </button>
        </div>

        {/* caption */}
        <div className="absolute bottom-24 left-5 right-5 sm:bottom-16 sm:left-8 sm:right-auto sm:max-w-xl">
          {m && (
            <div key={scene} className="caption">
              <div className="mb-2 flex items-baseline gap-3">
                <span style={serif} className="text-2xl italic text-white/60">{ROMAN[scene]}</span>
                <span className="h-px w-10 bg-white/40" />
                <span className="text-[10px] uppercase tracking-[0.4em] text-white/60">Scene {scene + 1} of 8</span>
              </div>
              <h2 style={serif} className="text-4xl font-light leading-none text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.8)] sm:text-6xl">{m.title}</h2>
              <p style={serif} className="mt-3 text-balance text-lg italic leading-snug text-white/85 drop-shadow-[0_1px_10px_rgba(0,0,0,0.9)] sm:text-xl">{m.line}</p>
            </div>
          )}
        </div>

        <div className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/30 lg:block">
          Space pause&ensp;·&ensp;M mute&ensp;·&ensp;← → scenes
        </div>

        {/* scene + beat navigation */}
        <div className="absolute bottom-4 left-5 right-5 flex flex-col items-start gap-2.5 sm:bottom-7 sm:left-auto sm:right-8 sm:items-end sm:gap-3">
          <div className="h-[2px] w-full max-w-[220px] overflow-hidden rounded-full bg-white/15" aria-hidden="true">
            <div
              className="h-full rounded-full bg-white/80 transition-[width] duration-500 ease-linear"
              style={{ width: `${((beat + 1) / BEATS_PER_SCENE) * 100}%` }}
            />
          </div>
          <div className="flex items-end gap-[3px]" aria-hidden="true">
            {Array.from({ length: BEATS_PER_SCENE }, (_, i) => (
              <span
                key={i}
                className={`w-[2px] rounded-full transition-all duration-150 ${i % 8 === 0 ? 'h-4' : 'h-2.5'} ${i === beat ? 'scale-y-150 bg-white' : i < beat ? 'bg-white/60' : 'bg-white/20'} ${i % 8 === 7 ? 'mr-1.5' : ''}`}
              />
            ))}
          </div>
          <div className="flex gap-1 sm:gap-1.5">
            {ROMAN.map((r, i) => (
              <button
                key={r}
                onClick={() => jump(i)}
                tabIndex={started ? 0 : -1}
                aria-label={`Scene ${i + 1}${meta[i] ? ': ' + meta[i].title : ''}`}
                aria-current={i === scene}
                title={meta[i]?.title}
                className={`pointer-events-auto flex h-8 min-w-8 items-center justify-center rounded-full border px-1.5 text-[11px] sm:px-2 tracking-wider transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${i === scene ? 'border-white bg-white text-black' : 'border-white/20 bg-black/25 text-white/65 backdrop-blur-md hover:border-white/60 hover:text-white'}`}
                style={serif}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
