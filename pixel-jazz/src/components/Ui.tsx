import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Disc3,
  Drum,
  Flame,
  Guitar,
  Lamp,
  ListMusic,
  Maximize2,
  Mic,
  Pause,
  Piano,
  Play,
  Plus,
  Repeat1,
  RotateCcw,
  ScanLine,
  Settings,
  Share2,
  Sparkles,
  Volume1,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import type { Kind } from '../pixel/art';
import { portraitURL } from '../pixel/portraits';
import { songDuration, type Song } from '../audio/songs';
import type { SceneCfg } from '../three/BandScene';

export type UiLive = {
  playing: boolean;
  external: boolean;
  onsetCount: number;
  time: number;
  duration: number;
  bpm: number;
  detectedBpm: number;
  beat: number;
  pos: number;
  low: number;
  mid: number;
  high: number;
  vocal: number;
  level: number;
  onset: number;
  active: Record<string, number>;
};

export type Member = { kind: Kind; label: string; role: string; inst: string; div: number };
export type StagePos = { kind: Kind; x: number; y: number };

export const ROLE_ICON: Record<Kind, typeof Mic> = {
  deer: AudioLines,
  cat: Drum,
  bear: Wind,
  raccoon: Guitar,
  tiger: Piano,
  owl: Mic,
};

export const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
};

/* ============================== header ============================== */
export function TopBar({
  onSessions,
  onAdd,
  onInfo,
  sessionsOpen,
}: {
  onSessions: () => void;
  onAdd: () => void;
  onInfo: () => void;
  sessionsOpen: boolean;
}) {
  return (
    <div className="chrome flex items-center gap-2.5 px-3 py-2 sm:px-4">
      <div className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-[#c8a870] bg-[#f6ead4] shadow-[inset_0_0_0_1px_#fff9ec]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3a2a1d" strokeWidth="2.1" strokeLinecap="round">
          <circle cx="7" cy="17" r="2.6" />
          <circle cx="17.5" cy="14.5" r="2.6" />
          <path d="M9.6 17V8.4l10.5-2.9v9" />
          <path d="M9.6 8.4 20.1 5.5" />
        </svg>
      </div>
      <div className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-[#3a2b1d] sm:text-[12.5px]">Pixel Jazz Band</div>
      <span className="hidden text-[10px] text-[#8b7657] md:inline">the blue note alley</span>
      <div className="ml-auto flex items-center gap-1.5">
        <button className="btn btn-cream !py-1.5 !text-[10.5px]" onClick={onSessions} aria-expanded={sessionsOpen}>
          <ListMusic size={13} /> <span className="hidden sm:inline">Sessions</span>
        </button>
        <button className="btn btn-gold !py-1.5 !text-[10.5px]" onClick={onAdd}>
          <Plus size={13} /> <span className="hidden sm:inline">Add music</span>
        </button>
        <button className="btn btn-ghost !px-1.5 !py-1.5 text-[13px] leading-none" title="stage settings" aria-label="Stage settings" onClick={onInfo}>
          •••
        </button>
      </div>
    </div>
  );
}

export function SongLine({
  song,
  songs,
  open,
  onClose,
  onSelect,
}: {
  song: Song;
  songs: Song[];
  open: boolean;
  onClose: () => void;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="relative flex items-center gap-2 border-b border-[#3a2c22] bg-[#1f1813] px-3 py-2 sm:px-4">
      <span className="serif text-[12px] tracking-[0.04em] text-[#d9c3a0]">{song.artist}</span>
      <span className="h-1 w-1 rounded-full bg-[#8a6837]" />
      <span className="truncate serif text-[13px] tracking-[0.05em] text-[#f4e8d4] sm:text-[15px]">{song.title}</span>
      <span className="ml-1 hidden text-[10px] text-[#8f7b60] sm:inline">
        {song.source === 'upload' ? 'audio reactive · local recording' : `${song.bpm} bpm · ${song.tempoFeel}`}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="hidden h-1.5 w-1.5 rounded-full bg-[#7d2130] sm:block" style={{ animation: 'bulb 1.4s infinite' }} />
        <span className="label !text-[8px] text-[#8f7b60]">{song.source === 'upload' ? 'local file' : 'live take'}</span>
      </div>
      {open && (
        <>
          <button className="fixed inset-0 z-30 cursor-default" onClick={onClose} aria-label="close" />
          <div className="panel absolute right-2 top-[calc(100%+6px)] z-40 w-[min(92vw,340px)] overflow-hidden p-1.5">
            <div className="flex items-center justify-between px-1.5 pb-1.5">
              <span className="label !text-[8px]">session book</span>
              <button className="text-[#a4917a] hover:text-cream" onClick={onClose}>
                <X size={12} />
              </button>
            </div>
            {songs.map((s, i) => (
              <button
                key={s.id}
                className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left transition-colors ${
                  s.id === song.id ? 'bg-[#3e2e22]' : 'hover:bg-[#332720]'
                }`}
                onClick={() => {
                  onSelect(i);
                  onClose();
                }}
              >
                <span className="w-3 shrink-0 text-center text-[9px] text-[#cba76b]">{s.id === song.id ? '▶' : i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] text-cream">{s.title}</span>
                  <span className="block truncate text-[10px] text-[#9c876d]">
                    {s.artist} · {Math.round(songDuration(s))}s
                  </span>
                </span>
                {s.id === song.id && <Check size={11} className="text-[#cba76b]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================== stage overlay ============================== */
export function StageLabels({
  positions,
  members,
  focus,
  solo,
  canMix,
  onFocus,
  onSolo,
}: {
  positions: StagePos[];
  members: Member[];
  focus: Kind | null;
  solo: string | null;
  canMix: boolean;
  onFocus: (k: Kind | null) => void;
  onSolo: (inst: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 hidden sm:block">
      {positions.map((p) => {
        const m = members.find((x) => x.kind === p.kind);
        if (!m) return null;
        const on = focus === p.kind;
        return (
          <div
            key={p.kind}
            className="pointer-events-auto absolute flex -translate-x-1/2 flex-col items-center gap-1"
            style={{ left: p.x, top: p.y, transition: 'left 60ms linear, top 60ms linear' }}
          >
            <button
              onClick={() => onFocus(on ? null : p.kind)}
              className={`whitespace-nowrap px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide transition-colors sm:text-[11.5px] ${
                on ? 'text-[#ffe3ad]' : 'text-[#f1e2c8]/85 hover:text-white'
              }`}
              style={{ textShadow: '0 1px 2px #120a04, 0 0 8px rgba(0,0,0,.8)' }}
            >
              {m.label}
            </button>
            <button
              onClick={() => onSolo(m.inst)}
              disabled={!canMix}
              className={`grid h-[19px] w-[19px] place-items-center rounded-full border text-[8.5px] font-semibold transition-all ${
                solo === m.inst
                  ? 'border-[#f0d9ac] bg-[#e8cd9a] text-[#2a1d0e]'
                  : 'border-[#b89a6e]/55 bg-[#20160f]/55 text-[#e8d7b8]/90 hover:bg-[#3a2a1e]'
              }`}
              title={canMix ? `solo ${m.label.toLowerCase()}` : 'Solo requires a generated arrangement'}
              style={{ backdropFilter: 'blur(1px)' }}
            >
              S
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function MobileBand({
  members,
  live,
  focus,
  solo,
  canMix,
  onFocus,
  onSolo,
}: {
  members: Member[];
  live: UiLive;
  focus: Kind | null;
  solo: string | null;
  canMix: boolean;
  onFocus: (kind: Kind | null) => void;
  onSolo: (inst: string) => void;
}) {
  return (
    <div className="mobile-band absolute inset-x-4 bottom-[11%] top-[36%] z-20 grid grid-cols-3 grid-rows-2 sm:hidden">
      {members.map((member) => {
        const activity = live.active[member.inst] ?? 0;
        const pose = live.playing ? Math.abs(Math.floor((live.external ? live.onsetCount : live.pos) * member.div)) % 4 : 0;
        const mouth = live.playing ? Math.min(3, Math.round(activity * 2.5)) : 0;
        const selected = focus === member.kind;
        return (
          <div key={member.kind} className="relative flex min-w-0 flex-col items-center justify-end gap-0.5 pb-2">
            <button
              type="button"
              onClick={() => onFocus(selected ? null : member.kind)}
              className="flex min-w-0 flex-col items-center"
              aria-label={`Spotlight ${member.label}`}
            >
              <img
                src={portraitURL(member.kind, pose, mouth)}
                alt=""
                className="pixelated mobile-band-sprite h-[74px] w-[74px] object-contain"
                style={{
                  transform: live.playing && activity > 0.4 ? 'translateY(-2px)' : undefined,
                  filter: selected ? 'drop-shadow(0 0 8px #f4cc80)' : undefined,
                }}
              />
              <span className={`mt-0.5 whitespace-nowrap text-[10px] font-medium ${selected ? 'text-[#ffe0a0]' : 'text-[#f1e2c8]'}`}>{member.label}</span>
            </button>
            <button
              type="button"
              onClick={() => onSolo(member.inst)}
              disabled={!canMix}
              className={`grid h-5 w-5 place-items-center rounded-full border text-[9px] ${solo === member.inst ? 'border-[#ffe4ad] bg-[#e8cd9a] text-[#291a0e]' : 'border-[#b49a6e] bg-[#21160e]/70 text-[#ead6b7]'}`}
              aria-label={canMix ? `${solo === member.inst ? 'Unsolo' : 'Solo'} ${member.label}` : `Solo unavailable for uploaded audio`}
            >
              S
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ============================== transport ============================== */
export function SeekBar({
  time,
  duration,
  onSeek,
  compact = false,
}: {
  time: number;
  duration: number;
  onSeek: (t: number) => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const at = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el || !duration) return;
      const r = el.getBoundingClientRect();
      onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration);
    },
    [duration, onSeek],
  );
  useEffect(() => {
    const mv = (e: PointerEvent) => drag.current && at(e.clientX);
    const up = () => (drag.current = false);
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
    };
  }, [at]);
  const p = duration ? Math.min(1, time / duration) : 0;
  return (
    <div
      ref={ref}
      className={`group relative cursor-pointer touch-none select-none ${compact ? 'h-4' : 'h-5'}`}
      onPointerDown={(e) => {
        drag.current = true;
        at(e.clientX);
      }}
    >
      <div className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 overflow-hidden rounded-full bg-[#3a2c22]">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p * 100}%`, background: '#d7b57c' }} />
      </div>
      <div
        className="absolute top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9c7a47] bg-[#f3e6d0] shadow-[0_1px_4px_rgba(0,0,0,.5)] transition-transform group-hover:scale-110"
        style={{ left: `${p * 100}%` }}
      />
    </div>
  );
}

export function Transport({
  live,
  loop,
  volume,
  onToggle,
  onSeek,
  onLoop,
  onRewind,
  onVolume,
  onAll,
  canMix,
}: {
  live: UiLive;
  loop: boolean;
  volume: number;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onLoop: () => void;
  onRewind: () => void;
  onVolume: (v: number) => void;
  onAll: (on: boolean) => void;
  canMix: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#3a2c22] bg-[#1f1813] px-3 py-3 sm:px-4">
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggle}
          className="grid h-10 w-10 place-items-center rounded-full border border-[#e2cfae] bg-[#f3e6d0] text-[#2c2119] shadow-[0_2px_10px_-2px_rgba(0,0,0,.6)] transition-transform hover:bg-[#fbf2e2] active:translate-y-px"
          title="play / pause (space)"
        >
          {live.playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
        </button>
        <button className="icon-btn !h-7 !w-7 !border-transparent !bg-transparent" onClick={onRewind} title="restart">
          <RotateCcw size={13} />
        </button>
      </div>
      <div className="flex min-w-[170px] flex-1 items-center gap-2.5">
        <span className="w-8 text-right text-[10.5px] tabular-nums text-[#e4d2b2]">{fmtTime(live.time)}</span>
        <div className="flex-1">
          <SeekBar time={live.time} duration={live.duration} onSeek={onSeek} />
        </div>
        <span className="w-8 text-[10.5px] tabular-nums text-[#9c876d]">{fmtTime(live.duration)}</span>
      </div>
      <div className="flex items-center gap-1">
        <button className={`btn !py-1 !text-[10px] ${loop ? 'btn-cream' : ''}`} onClick={onLoop} title="loop (L)">
          <Repeat1 size={12} /> Loop
        </button>
        <span className="mx-0.5 hidden h-4 w-px bg-[#3a2c22] sm:block" />
        <button className="btn btn-ghost !py-1 !text-[10px]" onClick={() => onAll(true)} disabled={!canMix} title={canMix ? 'Unmute all players' : 'Not available for a mixed recording'}>
          All on
        </button>
        <button className="btn btn-ghost !py-1 !text-[10px]" onClick={() => onAll(false)} disabled={!canMix} title={canMix ? 'Mute all players' : 'Not available for a mixed recording'}>
          All off
        </button>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-[#a4917a]">{volume === 0 ? <VolumeX size={13} /> : volume < 0.5 ? <Volume1 size={13} /> : <Volume2 size={13} />}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolume(parseFloat(e.target.value))}
          className="w-[74px]"
          title="volume"
        />
      </div>
    </div>
  );
}

/* ============================== bottom dock ============================== */
export function BottomDock({
  live,
  volume,
  onToggle,
  onVolume,
  onSettings,
  onFullscreen,
  onShare,
  settingsOpen,
}: {
  live: UiLive;
  volume: number;
  onToggle: () => void;
  onVolume: (v: number) => void;
  onSettings: () => void;
  onFullscreen: () => void;
  onShare: () => void;
  settingsOpen: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-[#3a2c22] bg-[#1b1410] px-3 py-2.5 sm:px-4">
      <button
        onClick={onToggle}
        className="grid h-10 w-10 place-items-center rounded-full border border-[#8f7250] text-[#f4e8d4] transition-all hover:bg-[#2e231b] active:scale-95"
        title="play / pause (space)"
      >
        {live.playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="flex flex-col">
        <span className="text-[11px] tabular-nums text-[#e4d2b2]">
          {fmtTime(live.time)} <span className="text-[#7e6a54]">/ {fmtTime(live.duration)}</span>
        </span>
        <span className="label !text-[8px]">{live.playing ? 'on the air' : 'rehearsal'}</span>
      </div>
      <div className="hidden items-center gap-1.5 sm:flex">
        <span className="text-[#a4917a]">{volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}</span>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => onVolume(parseFloat(e.target.value))} className="w-[84px]" />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <button className={`icon-btn ${settingsOpen ? '!border-[#cba76b] !text-[#f0d9ac]' : ''}`} onClick={onSettings} title="stage settings">
          <Settings size={14} />
        </button>
        <button className="icon-btn" onClick={onShare} title="copy link to the set">
          <Share2 size={14} />
        </button>
        <button className="icon-btn" onClick={onFullscreen} title="fullscreen">
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
}

/* ============================== settings modal ============================== */
export function SettingsModal({
  cfg,
  setCfg,
  members,
  live,
  mutes,
  solo,
  canMix,
  onMute,
  onSolo,
  onAll,
  onClose,
}: {
  cfg: SceneCfg;
  setCfg: (patch: Partial<SceneCfg>) => void;
  members: Member[];
  live: UiLive;
  mutes: Record<string, boolean>;
  solo: string | null;
  canMix: boolean;
  onMute: (k: Kind, inst: string) => void;
  onSolo: (inst: string) => void;
  onAll: (on: boolean) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'stage' | 'band'>('stage');
  const modes: SceneCfg['lightMode'][] = ['auto', 'warm', 'ice', 'rave'];
  const toggles: { k: keyof SceneCfg; icon: typeof Sparkles; label: string }[] = [
    { k: 'notes', icon: Sparkles, label: 'notes' },
    { k: 'smoke', icon: Flame, label: 'haze' },
    { k: 'disco', icon: Disc3, label: 'mirror' },
    { k: 'scan', icon: ScanLine, label: 'crt' },
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b0705]/70 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="panel w-full max-w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[#4a392b] px-3 py-2.5">
          <Settings size={13} className="text-[#cba76b]" />
          <span className="label !text-[9px] text-[#d6c3a4]">stage settings</span>
          <div className="ml-3 flex gap-1">
            {(['stage', 'band'] as const).map((t) => (
              <button key={t} className={`btn !py-1 !text-[9.5px] ${tab === t ? 'btn-cream' : 'btn-ghost'}`} onClick={() => setTab(t)}>
                {t === 'stage' ? 'Lights' : 'Band desk'}
              </button>
            ))}
          </div>
          <button className="ml-auto text-[#a4917a] hover:text-cream" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {tab === 'stage' ? (
          <div className="space-y-3 p-3">
            <div className="grid grid-cols-4 gap-1.5">
              {toggles.map(({ k, icon: Ico, label }) => {
                const on = k === 'scan' ? cfg.scan > 0.2 : !!cfg[k];
                return (
                  <button
                    key={k}
                    className={`btn !flex-col !gap-1 !py-2 !text-[9px] ${on ? '!border-[#e0c493] !bg-[#4a3826] !text-[#f7e7c8]' : ''}`}
                    onClick={() => (k === 'scan' ? setCfg({ scan: on ? 0 : 0.5 }) : setCfg({ [k]: !on } as Partial<SceneCfg>))}
                  >
                    <Ico size={14} /> {label}
                  </button>
                );
              })}
            </div>
            <div>
              <div className="label !text-[8.5px]">stage wash</div>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {modes.map((m) => (
                  <button key={m} className={`btn !py-1.5 !text-[9.5px] capitalize ${cfg.lightMode === m ? 'btn-gold' : ''}`} onClick={() => setCfg({ lightMode: m })}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {[
              { k: 'pixel' as const, label: 'pixel size', min: 2, max: 6, step: 0.2, fmt: (v: number) => `${v.toFixed(1)}×` },
              { k: 'glow' as const, label: 'bloom', min: 0, max: 1.6, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
              { k: 'scan' as const, label: 'scanlines', min: 0, max: 1, step: 0.02, fmt: (v: number) => `${Math.round(v * 100)}%` },
            ].map(({ k, label, min, max, step, fmt }) => (
              <div key={k}>
                <div className="flex items-center justify-between">
                  <span className="label !text-[8.5px]">{label}</span>
                  <span className="text-[10px] text-[#cba76b]">{fmt(cfg[k])}</span>
                </div>
                <input type="range" className="w-full" min={min} max={max} step={step} value={cfg[k]} onChange={(e) => setCfg({ [k]: parseFloat(e.target.value) } as Partial<SceneCfg>)} />
              </div>
            ))}
            <p className="rounded-[4px] border border-[#443324] bg-[#241c16] p-2 text-[10.5px] leading-relaxed text-[#a4917a]">
              <Lamp size={11} className="mr-1 inline text-[#cba76b]" /> The wash follows the analyser: cream on the downbeat, warm rose
              on the backbeat. Spotlight a player from the face plates to close the camera in.
            </p>
          </div>
        ) : (
          <div className="p-3">
            {!canMix && <p className="mb-2 text-[10px] text-[#cba76b]">Your file is a single stereo mix. Solo and mute are only available for generated arrangements.</p>}
            <div className="mb-2 flex items-center justify-between">
              <span className="label !text-[8.5px]">the six · solos & mutes</span>
              <div className="flex gap-1">
                <button className="btn btn-ghost !py-0.5 !text-[9px]" onClick={() => onAll(true)} disabled={!canMix}>
                  all on
                </button>
                <button className="btn btn-ghost !py-0.5 !text-[9px]" onClick={() => onAll(false)} disabled={!canMix}>
                  all off
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {members.map((m) => {
                const lvl = Math.max(live.active[m.inst] ?? 0, m.inst === 'voice' ? live.vocal * 2.4 : 0);
                const muted = !!mutes[m.inst];
                const pose = Math.abs(Math.floor(live.pos * m.div)) % 4;
                const mouth = lvl > 0.55 ? 2 : lvl > 0.2 ? 1 : 0;
                const Icon = ROLE_ICON[m.kind];
                return (
                  <div key={m.kind} className={`flex items-center gap-2 rounded-[4px] border px-1.5 py-1 ${solo === m.inst ? 'border-[#cba76b]/70 bg-[#3a2b1e]' : 'border-transparent hover:bg-[#2b211a]'}`}>
                    <img src={portraitURL(m.kind, pose, mouth)} alt={m.label} className="pixelated h-9 w-9" style={{ filter: muted ? 'grayscale(1) brightness(.55)' : undefined }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Icon size={10} className="text-[#cba76b]" />
                        <span className="text-[11px] text-cream">{m.label}</span>
                        {solo === m.inst && <span className="rounded-sm bg-[#e0c493] px-1 text-[7.5px] font-semibold text-[#2a1d0e]">SOLO</span>}
                      </div>
                      <div className="text-[9.5px] capitalize text-[#9c876d]">{m.role}</div>
                    </div>
                    <div className="flex h-5 w-12 items-end gap-[2px]">
                      {Array.from({ length: 8 }).map((_, k) => (
                        <span key={k} className="flex-1" style={{ height: `${24 + k * 9}%`, background: lvl > k / 8 ? '#d9b47c' : '#3a2c23' }} />
                      ))}
                    </div>
                    <button className={`btn !px-1.5 !py-0.5 !text-[9px] ${solo === m.inst ? 'btn-gold' : ''}`} onClick={() => onSolo(m.inst)} disabled={!canMix}>
                      S
                    </button>
                    <button className="btn !px-1 !py-0.5" onClick={() => onMute(m.kind, m.inst)} disabled={!canMix} style={{ opacity: muted ? 1 : 0.5 }} title="mute">
                      {muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-[#4a392b] px-3 py-2">
          <span className="text-[9.5px] tracking-wide text-[#8f7b60]">space · ←→ seek · ↑↓ volume · L loop · N notes · 1–6 spotlight</span>
          <button className="btn btn-gold !py-1 !text-[10px]" onClick={onClose}>
            done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================== small bits ============================== */
export function StageBadge({ live, lightMode }: { live: UiLive; lightMode: SceneCfg['lightMode'] }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
      <div className="flex items-center gap-2 px-1 py-1">
        <span className="h-1 w-1 rounded-full bg-[#e4b46a]/80" />
        <span className="text-[9px] uppercase tracking-[0.22em] text-[#e9d7b8]/75">The Little Jazz Club</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1.5 px-1 py-1">
          <span className={`h-1.5 w-1.5 rounded-full ${live.playing ? 'bg-[#e0654a]' : 'bg-[#8f7b60]'}`} style={{ animation: live.playing ? 'bulb 1.2s infinite' : undefined }} />
          <span className="text-[9px] uppercase tracking-[0.2em] text-[#e9d7b8]/80">{live.playing ? 'On air' : 'Standby'}</span>
        </span>
        <span className="hidden px-1 py-1 text-[9px] uppercase tracking-[0.2em] text-[#d6c3a4]/70 sm:block">
          {lightMode === 'auto' ? 'house lights' : `${lightMode} wash`}
        </span>
      </div>
    </div>
  );
}

export function FocusChip({ focus, onClear }: { focus: Kind | null; onClear: () => void }) {
  if (!focus) return null;
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-[3px] border border-[#cba76b]/60 bg-[#20150c]/85 px-2 py-1">
      <Crosshair size={10} className="text-[#f0d9ac]" />
      <span className="font-pixel text-[8px] uppercase tracking-[0.14em] text-[#f0d9ac]">{focus} featured</span>
      <button onClick={onClear} className="text-[#d6c3a4] hover:text-white">
        <X size={10} />
      </button>
    </div>
  );
}

export function ScoreNav({ range, onPan }: { range: string; onPan: (dir: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[#cba76b]">{range}</span>
      <div className="flex gap-1">
        <button className="icon-btn !h-6 !w-6" onClick={() => onPan(-1)} title="previous bars">
          <ChevronLeft size={12} />
        </button>
        <button className="icon-btn !h-6 !w-6" onClick={() => onPan(1)} title="next bars">
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

export function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [text, onDone]);
  return (
    <div className="fixed bottom-16 left-1/2 z-[60] -translate-x-1/2 rounded-[4px] border border-[#cba76b]/60 bg-[#241b15] px-3 py-1.5 text-[11px] text-cream shadow-lg">
      <Share2 size={11} className="mr-1.5 inline text-[#cba76b]" />
      {text}
    </div>
  );
}
