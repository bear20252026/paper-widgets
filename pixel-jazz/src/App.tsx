import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock, Disc3, FileAudio, Music, Play, Plus, Sparkles, Upload, X } from 'lucide-react';
import { AudioEngine } from './audio/AudioEngine';
import { SONGS, makeSession, type Feel, type Song } from './audio/songs';
import { BandScene, BAND, type SceneCfg } from './three/BandScene';
import type { Kind } from './pixel/art';
import {
  BottomDock,
  FocusChip,
  MobileBand,
  SettingsModal,
  SongLine,
  StageBadge,
  StageLabels,
  Toast,
  TopBar,
  Transport,
  fmtTime,
  type Member,
  type StagePos,
  type UiLive,
} from './components/Ui';
import { SheetMusic } from './components/SheetMusic';
import { AudioAnalysis } from './components/AudioAnalysis';

const ZERO: UiLive = {
  playing: false,
  external: false,
  onsetCount: 0,
  time: 0,
  duration: 0,
  bpm: 0,
  detectedBpm: 0,
  beat: 0,
  pos: 0,
  low: 0,
  mid: 0,
  high: 0,
  vocal: 0,
  level: 0,
  onset: 0,
  active: {},
};

const SESSIONS_KEY = 'pixel-jazz-sessions-v1';

function hashSongId() {
  try { return decodeURIComponent(window.location.hash.slice(1)); }
  catch { return ''; }
}

function savedSessions(): Song[] {
  try {
    const value = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((song): song is Song =>
      song && song.source !== 'upload' && typeof song.id === 'string' && typeof song.title === 'string' &&
      typeof song.bpm === 'number' && song.bpm > 0 &&
      Array.isArray(song.chords) && Array.isArray(song.tracks) && Array.isArray(song.drums),
    );
  } catch {
    return [];
  }
}

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const engine = useMemo(() => new AudioEngine(), []);
  const sceneRef = useRef<BandScene | null>(null);

  const [songs, setSongs] = useState<Song[]>(() => [...SONGS, ...savedSessions()]);
  const [idx, setIdx] = useState(() => {
    const id = hashSongId();
    return Math.max(0, songs.findIndex((entry) => entry.id === id));
  });
  const song = songs[Math.min(idx, songs.length - 1)];

  const [live, setLive] = useState<UiLive>(ZERO);
  const [positions, setPositions] = useState<StagePos[]>([]);
  const [loop, setLoop] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [mutes, setMutes] = useState<Record<string, boolean>>({});
  const [solo, setSolo] = useState<string | null>(null);
  const [focus, setFocus] = useState<Kind | null>(null);
  const [booted, setBooted] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<SceneCfg>({
    notes: true,
    smoke: true,
    disco: false,
    pixel: 2.6,
    scan: 0,
    glow: 0.6,
    lightMode: 'auto',
    focus: null,
    energy: 1,
  });

  const members: Member[] = useMemo(() => BAND.map((b) => ({ kind: b.kind, label: b.label, role: b.role, inst: b.inst, div: b.div })), []);

  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(songs.slice(SONGS.length).filter((entry) => entry.source !== 'upload')));
    } catch {
      // Private browsing can disable storage; the current session still plays.
    }
  }, [songs]);

  useEffect(() => {
    const openFromHash = () => {
      const id = hashSongId();
      const found = songs.findIndex((entry) => entry.id === id);
      if (found >= 0) setIdx(found);
    };
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, [songs]);

  useEffect(() => {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${encodeURIComponent(song.id)}`);
  }, [song.id]);

  useEffect(() => () => engine.dispose(), [engine]);

  /* ---------------- scene ---------------- */
  useEffect(() => {
    if (!stageRef.current) return;
    let sc: BandScene | null = null;
    try {
      sc = new BandScene(stageRef.current, () => engine.update(performance.now() / 1000));
      sc.onPick = (k) => setFocus((prev) => (prev === k ? null : k));
      sc.start();
      sceneRef.current = sc;
      const title = songs[idx];
      if (title) sc.setSignTitle(title.title, title.artist.replace('a-ha', 'a · ha'));
      document.fonts?.ready.then(() => {
        const s = sceneRef.current;
        const cur = songs[idx];
        if (s && cur) s.setSignTitle(cur.title, cur.artist.replace('a-ha', 'a · ha'));
      });
    } catch (err) {
      console.error('webgl stage failed', err);
      setStageError('WebGL could not start in this browser. The player, band desk and live score still work.');
    }
    return () => {
      sc?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  /* ---------------- song ---------------- */
  useEffect(() => {
    const was = engine.live.playing;
    engine.pause();
    engine.setSong(song);
    setLive((p) => ({ ...p, duration: engine.live.duration, time: 0, pos: 0 }));
    setFocus(null);
    const apply = () => sceneRef.current?.setSignTitle(song.title, song.artist.replace('a-ha', 'a · ha'));
    apply();
    const t = window.setTimeout(apply, 350);
    if (was) void engine.play();
    return () => clearTimeout(t);
  }, [engine, song]);

  /* ---------------- scene config ---------------- */
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    sc.cfg.notes = cfg.notes;
    sc.cfg.smoke = cfg.smoke;
    sc.cfg.disco = cfg.disco;
    sc.cfg.scan = cfg.scan;
    sc.cfg.glow = cfg.glow;
    sc.cfg.lightMode = cfg.lightMode;
    sc.cfg.focus = focus;
    if (Math.abs(sc.cfg.pixel - cfg.pixel) > 0.001) sc.setPixelScale(cfg.pixel);
  }, [cfg, focus]);

  /* ---------------- ui poll ---------------- */
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 50) return;
      last = t;
      const l = engine.live;
      setLive({
        playing: l.playing,
        external: l.external,
        onsetCount: l.onsetCount,
        time: l.time,
        duration: l.duration,
        bpm: l.bpm,
        detectedBpm: l.detectedBpm,
        beat: l.beat,
        pos: l.pos,
        low: l.low,
        mid: l.mid,
        high: l.high,
        vocal: l.vocal,
        level: l.level,
        onset: l.onset,
        active: { ...l.active },
      });
      const sc = sceneRef.current;
      if (sc) setPositions(sc.labels());
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  /* ---------------- controls ---------------- */
  const toggle = useCallback(() => {
    engine.ensure();
    if (!engine.song) engine.setSong(song);
    if (engine.ctx?.state === 'suspended') void engine.ctx.resume().catch(() => undefined);
    engine.toggle();
    setBooted(true);
  }, [engine, song]);

  const select = useCallback(
    (i: number) => {
      setIdx(i);
      setSessionsOpen(false);
    },
    [],
  );

  const seek = useCallback((t: number) => engine.seek(t), [engine]);

  const setAll = useCallback((on: boolean) => {
    if (on) {
      setMutes({});
      setSolo(null);
    } else {
      setMutes(Object.fromEntries(['bass', 'drums', 'flute', 'guitar', 'synth', 'pad', 'voice'].map((k) => [k, true])));
    }
  }, []);

  useEffect(() => {
    for (const inst of ['bass', 'drums', 'flute', 'guitar', 'synth', 'pad', 'voice'] as const) {
      const base = mutes[inst] ? 0 : 1;
      const duck = solo ? (inst === solo || (solo === 'voice' && inst === 'pad') ? 1.15 : 0.15) : 1;
      engine.setInstGain(inst, base * duck);
    }
  }, [mutes, solo, engine]);

  useEffect(() => {
    engine.loop = loop;
  }, [loop, engine]);
  useEffect(() => {
    engine.setVolume(volume);
  }, [volume, engine]);

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') {
        setNewOpen(false);
        setSettingsOpen(false);
        setSessionsOpen(false);
      } else if (newOpen || settingsOpen || sessionsOpen) {
        return;
      } else if (k === ' ') {
        e.preventDefault();
        const ae = document.activeElement as HTMLElement | null;
        if (ae && ae.tagName === 'BUTTON') ae.blur();
        toggle();
      } else if (e.shiftKey && k === 'arrowright') select((idx + 1) % songs.length);
      else if (e.shiftKey && k === 'arrowleft') select((idx - 1 + songs.length) % songs.length);
      else if (k === 'arrowright') engine.seek(Math.min(engine.live.duration, engine.live.time + 5));
      else if (k === 'arrowleft') engine.seek(Math.max(0, engine.live.time - 5));
      else if (k === 'arrowup') {
        e.preventDefault();
        setVolume((v) => {
          const nv = Math.min(1, v + 0.05);
          engine.setVolume(nv);
          return nv;
        });
      } else if (k === 'arrowdown') {
        e.preventDefault();
        setVolume((v) => {
          const nv = Math.max(0, v - 0.05);
          engine.setVolume(nv);
          return nv;
        });
      } else if (k === 'l') setLoop((l) => !l);
      else if (k === 'n') setCfg((c) => ({ ...c, notes: !c.notes }));
      else if (k === 'd') setCfg((c) => ({ ...c, disco: !c.disco }));
      else if (k === '0') setFocus(null);
      else if (/^[1-6]$/.test(k)) {
        const m = BAND[parseInt(k, 10) - 1];
        setFocus((f) => (f === m.kind ? null : m.kind));
      } else if (e.shiftKey && (k === '.' || k === '>')) select((idx + 1) % songs.length);
      else if (e.shiftKey && (k === ',' || k === '<')) select((idx - 1 + songs.length) % songs.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, toggle, idx, songs.length, select, newOpen, settingsOpen, sessionsOpen]);

  const addSession = (title: string, bpm: number, feel: Feel) => {
    const s = makeSession({ title, bpm, feel });
    setSongs((list) => [...list, s]);
    setIdx(songs.length);
    setNewOpen(false);
    setToast(`“${s.title}” added to the session book`);
  };

  const addFile = async (file: File) => {
    if (file.size > 80 * 1024 * 1024) throw new Error('Choose an audio file under 80 MB.');
    const buffer = await engine.decodeFile(file);
    const id = `upload-${Date.now()}`;
    const title = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Your recording';
    const bpm = 120;
    const uploaded: Song = {
      id,
      title,
      artist: 'your music',
      note: 'Your recording plays locally. The animals respond to its sound, but the instruments cannot be separated from the stereo mix.',
      source: 'upload',
      duration: buffer.duration,
      bpm,
      swing: 0,
      bars: Math.ceil(buffer.duration * bpm / 240),
      key: 'live audio',
      tempoFeel: 'audio reactive',
      tracks: [],
      drums: [],
      chords: [],
    };
    engine.registerFile(id, buffer);
    setSongs((list) => [...list, uploaded]);
    setIdx(songs.length);
    setNewOpen(false);
    setToast('Recording ready. Press play to begin.');
  };

  const share = async () => {
    if (song.source === 'upload') {
      setToast('Local audio stays on your device and cannot be shared by a link.');
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast(song.id.startsWith('session-') ? 'Link copied. Custom sessions are saved on this device.' : 'Link to this set copied');
    } catch {
      setToast('Copy this page to share the set');
    }
  };

  const fullscreen = () => {
    const el = appRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => setToast('Fullscreen is blocked in this frame'));
  };

  return (
    <div className="h-dvh w-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1140px] px-2 py-3 sm:px-4 sm:py-4 lg:py-5">
        <div ref={appRef} className="frame relative mx-auto w-full overflow-hidden">
          <TopBar onSessions={() => setSessionsOpen((v) => !v)} onAdd={() => setNewOpen(true)} onInfo={() => setSettingsOpen(true)} sessionsOpen={sessionsOpen} />
          <SongLine song={song} songs={songs} open={sessionsOpen} onClose={() => setSessionsOpen(false)} onSelect={select} />

          {/* ---------------- the stage ---------------- */}
          <div className="stage-window relative overflow-hidden bg-[#0e0906]">
            <div ref={stageRef} className="absolute inset-0" />
            <div className="stage-edge pointer-events-none absolute inset-0 z-30" />
            <div className="pointer-events-none absolute inset-0 vignette" />
            <div className="stage-marquee pointer-events-none absolute inset-x-0 top-[7%] z-10 flex flex-col items-center text-center" aria-hidden="true">
              <div className="stage-marquee-rule" />
              <span className="stage-marquee-kicker">one more</span>
              <span className="stage-marquee-title">chorus</span>
              <div className="stage-marquee-rule" />
            </div>
            <StageBadge live={live} lightMode={cfg.lightMode} />
            <StageLabels positions={positions} members={members} focus={focus} solo={solo} canMix={song.source !== 'upload'} onFocus={setFocus} onSolo={(i) => setSolo((cur) => (cur === i ? null : i))} />
            <MobileBand members={members} live={live} focus={focus} solo={solo} canMix={song.source !== 'upload'} onFocus={setFocus} onSolo={(i) => setSolo((cur) => (cur === i ? null : i))} />
            <FocusChip focus={focus} onClear={() => setFocus(null)} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-[#140d08]/85 to-transparent" />
            {!booted && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center">
                <button className="btn btn-gold pointer-events-auto !gap-2 !rounded-full !px-4 !py-2 !text-[11.5px] shadow-[0_8px_30px_-8px_rgba(0,0,0,.9)]" onClick={toggle}>
                  <Play size={13} /> start the set
                  <span className="ml-1 hidden text-[9.5px] font-normal tracking-wide opacity-70 sm:inline">audio is generated live</span>
                </button>
              </div>
            )}
            {stageError && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-[#150e09] p-6 text-center">
                <p className="max-w-sm text-[11px] leading-relaxed text-[#c0ac8e]">{stageError}</p>
              </div>
            )}
            <div className="pointer-events-none absolute bottom-1.5 right-2 z-10 hidden items-center gap-1.5 sm:flex">
              <span className="font-pixel text-[7.5px] uppercase tracking-[0.16em] text-[#cbb794]/70">
                {song.source === 'upload' ? `LIVE AUDIO · ${live.detectedBpm || '--'} BPM DETECTED` : `${live.bpm || '--'} bpm · bar ${Math.floor(live.pos / 4) + 1} · beat ${(Math.floor(live.pos) % 4) + 1}`}
              </span>
            </div>
          </div>
          <Transport
            live={live}
            loop={loop}
            volume={volume}
            onToggle={toggle}
            onSeek={seek}
            onLoop={() => setLoop((l) => !l)}
            onRewind={() => engine.seek(0)}
            onVolume={(v) => {
              setVolume(v);
              engine.setVolume(v);
            }}
            onAll={setAll}
            canMix={song.source !== 'upload'}
          />

          {song.source === 'upload' ? <AudioAnalysis live={live} song={song} /> : <SheetMusic engine={engine} song={song} />}

          <BottomDock
            live={live}
            volume={volume}
            onToggle={toggle}
            onVolume={(v) => {
              setVolume(v);
              engine.setVolume(v);
            }}
            onSettings={() => setSettingsOpen(true)}
            onShare={share}
            onFullscreen={fullscreen}
            settingsOpen={settingsOpen}
          />
        </div>

        <footer className="mx-auto mt-3 flex max-w-[1240px] flex-wrap items-center justify-between gap-2 px-1 pb-2 text-[9.5px] tracking-wide text-[#8f7b60]">
          <span className="flex items-center gap-2">
            <Disc3 size={11} className="text-[#a5814a]" />
            {song.source === 'upload' ? 'your recording stays on this device · the stage reacts to its rhythm' : 'six animals, no humans · sprites, textures and the whole mix generated in your browser'}
          </span>
          <span className="flex items-center gap-3">
            <span className="hidden items-center gap-1 sm:flex">
              <Clock size={10} /> {fmtTime(live.duration)} set
            </span>
            <span className="hidden sm:inline">space · ←→ · ↑↓ · L · N · 1–6</span>
            <button className="inline-flex items-center gap-1 text-[#cba76b] hover:text-[#f0d9ac]" onClick={() => setNewOpen(true)}>
              <Plus size={10} /> add music
            </button>
          </span>
        </footer>
      </div>

      {settingsOpen && (
        <SettingsModal
          cfg={cfg}
          setCfg={(patch) => setCfg((c) => ({ ...c, ...patch }))}
          members={members}
          live={live}
          mutes={mutes}
          solo={solo}
          onMute={(_k, inst) => setMutes((m) => ({ ...m, [inst]: !m[inst] }))}
          onSolo={(inst) => setSolo((cur) => (cur === inst ? null : inst))}
          onAll={setAll}
          canMix={song.source !== 'upload'}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {newOpen && <NewSessionModal onClose={() => setNewOpen(false)} onCreate={addSession} onUpload={addFile} />}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function NewSessionModal({ onClose, onCreate, onUpload }: {
  onClose: () => void;
  onCreate: (title: string, bpm: number, feel: Feel) => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const [title, setTitle] = useState('Basement Session');
  const [bpm, setBpm] = useState(118);
  const [feel, setFeel] = useState<Feel>('swing');
  const [mode, setMode] = useState<'compose' | 'upload'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const importFile = async () => {
    if (!file || loading) return;
    setError('');
    setLoading(true);
    try {
      await onUpload(file);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open this recording.');
    } finally {
      setLoading(false);
    }
  };
  const feels: { id: Feel; name: string; blurb: string }[] = [
    { id: 'swing', name: 'Medium swing', blurb: 'brushed kit, walking bass, horn lines' },
    { id: 'bossa', name: 'Bossa nova', blurb: 'soft rim clicks, nylon comping, airy flute' },
    { id: 'boogie', name: 'Boogie woogie', blurb: 'shuffle hats, boogie bass, rowdy guitar' },
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b0705]/75 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="panel max-h-[90dvh] w-full max-w-[440px] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Add music" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[#4a392b] px-3.5 py-3">
          <Sparkles size={13} className="text-[#cba76b]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e4d2b2]">Add music</span>
          <span className="ml-auto text-[9.5px] text-[#8f7b60]">bring a record or write a chart</span>
          <button className="ml-2 text-[#a4917a] hover:text-cream" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className="flex gap-1 border-b border-[#4a392b] px-3.5 pt-2.5">
          <button className={`px-3 py-2 text-[11px] ${mode === 'upload' ? 'border-b-2 border-[#d9b778] text-[#f4e8d4]' : 'text-[#9c876d]'}`} onClick={() => setMode('upload')}>
            <Upload size={12} className="mr-1 inline" /> Play your file
          </button>
          <button className={`px-3 py-2 text-[11px] ${mode === 'compose' ? 'border-b-2 border-[#d9b778] text-[#f4e8d4]' : 'text-[#9c876d]'}`} onClick={() => setMode('compose')}>
            <Music size={12} className="mr-1 inline" /> Compose a session
          </button>
        </div>
        {mode === 'upload' ? (
          <div className="space-y-3 p-3.5">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[5px] border border-dashed border-[#8b6a45] bg-[#211811] px-5 py-7 text-center transition-colors hover:bg-[#302219]">
              <FileAudio size={27} className="text-[#d2ad73]" />
              <span className="text-[12px] text-[#f4e8d4]">{file ? file.name : 'Choose a song from your device'}</span>
              <span className="text-[10px] text-[#9c876d]">MP3, WAV, OGG or another browser-supported audio format · up to 80 MB</span>
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
                className="sr-only"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(''); }}
              />
            </label>
            <p className="text-[10.5px] leading-relaxed text-[#b3a084]">
              The original recording plays locally. The animals react to its bass, mids, highs and detected beats. Audio is never uploaded to a server.
            </p>
            {error && <p className="text-[10.5px] text-[#f0a48a]" role="alert">{error}</p>}
          </div>
        ) : <div className="space-y-3.5 p-3.5">
          <label className="block">
            <span className="label !text-[8.5px]">title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={34}
              className="mt-1 w-full rounded-[4px] border border-[#4a392b] bg-[#1d1611] px-2.5 py-2 text-[12.5px] text-cream outline-none focus:border-[#a5814a]"
              placeholder="name this session"
            />
          </label>
          <div>
            <div className="flex items-center justify-between">
              <span className="label !text-[8.5px]">tempo</span>
              <span className="text-[11px] text-[#cba76b]">{bpm} bpm</span>
            </div>
            <input type="range" min={72} max={176} step={1} value={bpm} onChange={(e) => setBpm(parseInt(e.target.value, 10))} className="w-full" />
            <div className="flex justify-between text-[8.5px] uppercase tracking-wider text-[#7e6a54]">
              <span>ballad</span>
              <span>bop</span>
            </div>
          </div>
          <div>
            <span className="label !text-[8.5px]">feel</span>
            <div className="mt-1 grid gap-1.5">
              {feels.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFeel(f.id)}
                  className={`flex items-center gap-2 rounded-[4px] border px-2.5 py-2 text-left transition-colors ${
                    feel === f.id ? 'border-[#cba76b] bg-[#3c2c1f]' : 'border-[#443324] bg-[#221a14] hover:border-[#6d5540]'
                  }`}
                >
                  <span className={`grid h-4 w-4 place-items-center rounded-full border ${feel === f.id ? 'border-[#f0d9ac] bg-[#e8cd9a]' : 'border-[#6d5540]'}`}>
                    {feel === f.id && <span className="h-1.5 w-1.5 rounded-full bg-[#2a1d0e]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11.5px] text-cream">{f.name}</span>
                    <span className="block truncate text-[9.5px] text-[#9c876d]">{f.blurb}</span>
                  </span>
                  <Music size={12} className={feel === f.id ? 'text-[#cba76b]' : 'text-[#5c4a39]'} />
                </button>
              ))}
            </div>
          </div>
        </div>}
        <div className="flex items-center justify-between border-t border-[#4a392b] bg-[#241b15] px-3.5 py-2.5">
          <span className="max-w-[190px] text-[9.5px] text-[#8f7b60]">{mode === 'upload' ? 'Your file stays in this tab until you close it.' : 'Changes, melody, bass and drums are composed on the spot.'}</span>
          {mode === 'upload' ? (
            <button className="btn btn-gold !py-1.5 !text-[11px]" disabled={!file || loading} onClick={importFile}>
              {loading ? 'opening record...' : 'open recording'} <ArrowRight size={12} />
            </button>
          ) : (
            <button className="btn btn-gold !py-1.5 !text-[11px]" onClick={() => onCreate(title, bpm, feel)}>
              write the chart <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
