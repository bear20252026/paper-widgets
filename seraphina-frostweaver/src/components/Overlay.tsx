import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Snowflake,
  Wind,
  Sparkles,
  Gem,
  Volume2,
  RotateCw,
  Maximize2,
  BookOpen,
  X,
  Crown,
  Mountain,
  MousePointer2,
  Diamond,
  Quote,
  Eye,
  Swords,
  ArrowUpDown,
  Sliders,
} from 'lucide-react';
import type { CameraViewPreset } from '../three/showcase';
import type { AnimationMode, CharacterPoseControls } from '../three/character';

interface OverlayProps {
  onVoice: () => void;
  onTriggerSlash: () => void;
  autoRotate: boolean;
  onToggleRotate: () => void;
  onResetView: () => void;
  activeView: CameraViewPreset;
  onSelectView: (view: CameraViewPreset) => void;
  pose: CharacterPoseControls;
  onChangePose: (partial: Partial<CharacterPoseControls>) => void;
}

const SKILLS = [
  {
    key: 'Q',
    icon: Snowflake,
    name: 'Shard of the Quiet',
    desc: 'Swings the Heavenshard staff in a wide frost crescent, hurling a singing splinter of biting rime.',
    cd: '8s',
    mode: 'swing' as AnimationMode,
    color: 'text-sky-300',
    frame: 'from-sky-400/30 to-cyan-500/10',
  },
  {
    key: 'W',
    icon: Wind,
    name: 'Shroud of Stillness',
    desc: 'Raises and lowers the crystal staff in a rhythmic pulse — enemies near Seraphina are slowed in deep snow.',
    cd: '13s',
    mode: 'updown' as AnimationMode,
    color: 'text-teal-300',
    frame: 'from-teal-400/30 to-emerald-500/10',
  },
  {
    key: 'E',
    icon: Gem,
    name: 'Heart of the Spire',
    desc: 'Passive — every third staff movement condenses into a hovering Heavenshard, empowering her next strike.',
    cd: 'Passive',
    mode: 'idle' as AnimationMode,
    color: 'text-indigo-300',
    frame: 'from-indigo-400/30 to-violet-500/10',
  },
  {
    key: 'R',
    icon: Sparkles,
    name: 'Eternal Avalanche',
    desc: 'Weaves the First Word in a sweeping figure-eight arc — a cataclysm of ice crashes down across the field.',
    cd: '60s',
    mode: 'dance' as AnimationMode,
    color: 'text-cyan-200',
    frame: 'from-cyan-300/35 to-sky-600/15',
  },
];

const VIEW_BUTTONS: { id: CameraViewPreset; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'back', label: 'Back' },
  { id: 'action', label: 'Slash Angle' },
  { id: 'closeup', label: 'Portrait' },
];

const MOTION_MODES: { id: AnimationMode; label: string }[] = [
  { id: 'idle', label: 'Float & Sway' },
  { id: 'updown', label: 'Arm Up / Down' },
  { id: 'swing', label: 'Staff Swing' },
  { id: 'dance', label: 'Spell Weave' },
];

const VOICE_LINES = [
  'Stillness is not the absence of the storm — it is the storm, holding its breath.',
  'The Spire does not rage. It remembers, and it endures.',
  'Come closer. The snow has such soft hands.',
];

export default function Overlay({
  onVoice,
  onTriggerSlash,
  autoRotate,
  onToggleRotate,
  onResetView,
  activeView,
  onSelectView,
  pose,
  onChangePose,
}: OverlayProps) {
  const [loreOpen, setLoreOpen] = useState(false);
  const [showSliders, setShowSliders] = useState(false);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [voiceFlash, setVoiceFlash] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const voiceTimer = useRef<number | null>(null);

  const playChime = useCallback(() => {
    try {
      if (!audioRef.current)
        audioRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') void ctx.resume();

      const master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);

      const notes = [659.26, 830.61, 987.77, 1244.51, 1661.22];
      notes.forEach((freq, i) => {
        const t0 = ctx.currentTime + i * 0.14;
        for (const detune of [0, 3]) {
          const osc = ctx.createOscillator();
          osc.type = detune === 0 ? 'triangle' : 'sine';
          osc.frequency.value = freq;
          osc.detune.value = detune;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.exponentialRampToValueAtTime(0.45 / (i + 1), t0 + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
          osc.connect(gain);
          gain.connect(master);
          osc.start(t0);
          osc.stop(t0 + 1.9);
        }
      });
    } catch {
      // audio unavailable
    }
  }, []);

  const handleVoice = useCallback(() => {
    playChime();
    onVoice();
    setVoiceFlash((n) => n + 1);
    if (voiceTimer.current) window.clearTimeout(voiceTimer.current);
    voiceTimer.current = window.setTimeout(() => {
      setVoiceIndex((i) => (i + 1) % VOICE_LINES.length);
    }, 2600);
  }, [playChime, onVoice]);

  useEffect(
    () => () => {
      if (voiceTimer.current) window.clearTimeout(voiceTimer.current);
      void audioRef.current?.close();
    },
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* ============ top bar ============ */}
      <header className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-3 px-5 pt-4 sm:px-8 sm:pt-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_28px_rgba(84,230,255,0.25)]">
            <Snowflake className="spin-slow h-6 w-6 text-cyan-300" strokeWidth={1.6} />
          </div>
          <div>
            <div className="font-display text-[17px] font-bold tracking-[0.32em] text-slate-100 sm:text-lg">
              FROSTBOUND
            </div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.3em] text-cyan-300/80 sm:text-[10px]">
              3D Character Turntable & Motion Studio
            </div>
          </div>
        </div>

        {/* Camera Angle Bar (Front / Side / Back / Slash Angle / Portrait) */}
        <div className="panel pointer-events-auto flex items-center gap-1 rounded-xl p-1">
          <span className="hidden items-center gap-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/80 lg:inline-flex">
            <Eye className="h-3.5 w-3.5" /> View
          </span>
          {VIEW_BUTTONS.map((btn) => {
            const active = activeView === btn.id && !autoRotate;
            return (
              <button
                key={btn.id}
                onClick={() => onSelectView(btn.id)}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-all ${
                  active
                    ? 'bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950 shadow-[0_0_18px_rgba(84,230,255,0.45)]'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={handleVoice}
            title="Hear her voice & cast frost wave"
            aria-label="Play voice line"
            className="icon-btn grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-slate-950/55 text-slate-300 backdrop-blur-md"
          >
            <Volume2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
          <button
            onClick={onToggleRotate}
            title="Toggle 360° turntable orbit"
            aria-label="Toggle auto-rotate"
            aria-pressed={autoRotate}
            className={`icon-btn grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-slate-950/55 text-slate-300 backdrop-blur-md ${
              autoRotate ? 'active' : ''
            }`}
          >
            <RotateCw className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
          <button
            onClick={onResetView}
            title="Reset camera to Front"
            aria-label="Reset camera"
            className="icon-btn grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-slate-950/55 text-slate-300 backdrop-blur-md"
          >
            <Maximize2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
          <button
            onClick={() => setLoreOpen((v) => !v)}
            title="Read her story"
            aria-label="Toggle lore panel"
            aria-pressed={loreOpen}
            className={`icon-btn grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-slate-950/55 text-slate-300 backdrop-blur-md ${
              loreOpen ? 'active' : ''
            }`}
          >
            <BookOpen className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {/* ============ left dossier ============ */}
      <section className="absolute bottom-28 left-4 max-w-md sm:bottom-24 sm:left-8 lg:bottom-20">
        <div className="mb-2 flex items-center gap-3">
          <div className="hairline w-10" />
          <span className="text-[9px] font-bold uppercase tracking-[0.42em] text-cyan-300/90 sm:text-[10px]">
            The Iceborn Court
          </span>
        </div>

        <h1 className="font-display text-[38px] font-extrabold leading-none tracking-[0.08em] text-slate-50 text-glow sm:text-5xl lg:text-[58px]">
          SERAPHINA
        </h1>
        <div className="shimmer-text font-display mt-1.5 text-[11px] font-bold uppercase tracking-[0.48em] sm:text-xs">
          The Frostweaver
        </div>

        <p className="font-quote mt-2.5 hidden max-w-xs text-[14px] italic leading-snug text-slate-300/95 sm:block">
          “Stillness is not the absence of the storm — it is the storm, holding its breath.”
        </p>

        <div className="mt-3 hidden flex-wrap items-center gap-2 sm:flex">
          <span className="chip-glow panel-edge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <Crown className="h-3 w-3" strokeWidth={2} /> Glacier Spire
          </span>
          <span
            className="chip-glow panel-edge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-indigo-200"
            style={{ animationDelay: '0.6s' }}
          >
            <Mountain className="h-3 w-3" strokeWidth={2} /> Cryomancy
          </span>
          <span className="panel-edge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            Difficulty
            <span className="flex items-center gap-0.5">
              <Diamond className="h-2.5 w-2.5 fill-cyan-300 text-cyan-300" />
              <Diamond className="h-2.5 w-2.5 fill-cyan-300 text-cyan-300" />
              <Diamond className="h-2.5 w-2.5 fill-cyan-300 text-cyan-300" />
            </span>
          </span>
        </div>
      </section>

      {/* ============ right — interactive signature skills ============ */}
      <aside className="absolute right-4 top-1/2 hidden w-[300px] -translate-y-1/2 flex-col gap-2 md:flex lg:right-8 lg:w-[325px]">
        <div className="mb-1 flex items-center justify-end gap-3 pr-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.38em] text-slate-400">
            Click Skill to Animate
          </span>
          <div className="hairline w-8" />
        </div>
        {SKILLS.map((s) => {
          const isActive = pose.mode === s.mode;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                onChangePose({ mode: s.mode });
                onTriggerSlash();
              }}
              className={`skill-card panel pointer-events-auto flex w-full items-start gap-3 rounded-xl p-2.5 text-left ${
                isActive ? 'border-cyan-300/55 shadow-[0_0_24px_rgba(84,230,255,0.22)]' : ''
              }`}
            >
              <div
                className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-gradient-to-br ${s.frame}`}
              >
                <s.icon className={`h-5 w-5 ${s.color}`} strokeWidth={1.7} />
                <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-md border border-cyan-300/30 bg-slate-950 text-[9px] font-bold text-cyan-300">
                  {s.key}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-[11px] font-bold tracking-[0.08em] text-slate-100">
                    {s.name.toUpperCase()}
                  </h3>
                  <span className="shrink-0 text-[9px] font-semibold tabular-nums text-cyan-400/80">{s.cd}</span>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{s.desc}</p>
              </div>
            </button>
          );
        })}
      </aside>

      {/* ============ bottom-center — Arm & Staff Motion Controller ============ */}
      <div className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        {/* Manual Arm Lift & Staff Swing Sliders drawer */}
        {showSliders && (
          <div className="panel flex flex-wrap items-center gap-5 rounded-2xl px-5 py-3 text-xs">
            <label className="flex items-center gap-2.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-cyan-300" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
                Arm & Staff Lift
              </span>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.02}
                value={pose.armLift}
                onChange={(e) => onChangePose({ armLift: parseFloat(e.target.value) })}
                className="h-1.5 w-28 cursor-pointer accent-cyan-300"
              />
            </label>
            <label className="flex items-center gap-2.5">
              <Swords className="h-3.5 w-3.5 text-cyan-300" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
                Staff Swing Arc
              </span>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.02}
                value={pose.staffSwing}
                onChange={(e) => onChangePose({ staffSwing: parseFloat(e.target.value) })}
                className="h-1.5 w-28 cursor-pointer accent-cyan-300"
              />
            </label>
            <button
              type="button"
              onClick={() => onChangePose({ armLift: 0, staffSwing: 0 })}
              className="rounded-lg border border-cyan-300/25 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200 hover:bg-cyan-400/15"
            >
              Center
            </button>
          </div>
        )}

        {/* Motion Mode Bar */}
        <div className="panel flex flex-wrap items-center gap-1.5 rounded-2xl px-3 py-2">
          {MOTION_MODES.map((m) => {
            const active = pose.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangePose({ mode: m.id })}
                className={`rounded-xl px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${
                  active
                    ? 'bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950 shadow-[0_0_20px_rgba(84,230,255,0.45)]'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            );
          })}

          <div className="mx-1 h-5 w-px bg-cyan-300/20" />

          <button
            type="button"
            onClick={onTriggerSlash}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-300/40 bg-cyan-400/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200 transition hover:bg-cyan-400/25 hover:text-white"
          >
            <Swords className="h-3.5 w-3.5" /> Slash Wave
          </button>

          <button
            type="button"
            onClick={() => setShowSliders((s) => !s)}
            title="Manual Arm & Staff Pose Sliders"
            className={`grid h-8 w-8 place-items-center rounded-xl border transition ${
              showSliders
                ? 'border-cyan-300/60 bg-cyan-300/25 text-cyan-200'
                : 'border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ============ voice line flash ============ */}
      {voiceFlash > 0 && (
        <div
          key={voiceFlash}
          className="voice-flash absolute bottom-28 left-1/2 w-full max-w-lg -translate-x-1/2 px-6 text-center sm:bottom-32"
        >
          <Quote className="mx-auto mb-1 h-4 w-4 rotate-180 text-cyan-400/80" strokeWidth={2} />
          <p className="font-quote text-lg italic leading-snug text-cyan-50 drop-shadow-[0_2px_12px_rgba(20,200,238,0.45)] sm:text-xl">
            {VOICE_LINES[voiceIndex]}
          </p>
        </div>
      )}

      {/* ============ controls hint + credit ============ */}
      <div className="absolute bottom-4 left-4 hidden items-center gap-2 text-[9px] font-medium uppercase tracking-[0.22em] text-slate-400 xl:flex xl:left-8">
        <MousePointer2 className="h-3.5 w-3.5 text-cyan-400/80" strokeWidth={1.8} />
        Drag to orbit · Scroll to zoom
      </div>
      <div className="absolute bottom-4 right-4 hidden text-[8px] font-semibold uppercase tracking-[0.28em] text-slate-500 xl:block xl:right-8">
        Sculpted in real time · WebGL
      </div>

      {/* ============ lore drawer ============ */}
      <div
        className={`lore-panel panel pointer-events-auto absolute bottom-4 right-4 top-[72px] flex w-[330px] flex-col overflow-hidden rounded-2xl sm:right-6 sm:w-[400px] lg:right-8 xl:w-[440px] ${
          loreOpen ? 'open' : ''
        }`}
        role="dialog"
        aria-label="Character lore"
      >
        <div className="relative h-44 w-full shrink-0 overflow-hidden sm:h-52">
          <img
            src="/images/seraphina-portrait.jpg"
            alt="Seraphina, the Frostweaver, bearing the Heavenshard staff"
            className="h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1226] via-[#0d1226]/35 to-transparent" />
          <button
            onClick={() => setLoreOpen(false)}
            aria-label="Close lore"
            className="icon-btn absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-slate-950/60 text-slate-300 backdrop-blur-md"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
          <div className="absolute bottom-3 left-4">
            <div className="text-[8px] font-bold uppercase tracking-[0.4em] text-cyan-300/90">
              Chapter VII — The Frozen Veil
            </div>
            <div className="font-display text-xl font-bold tracking-[0.06em] text-slate-50">
              The Last Voice of the Spire
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-[12.5px] leading-relaxed text-slate-300">
            She was born during the Long Hush, when no birdsong had crossed the Glacier Spire for a century and the
            aurora froze mid-sky. The keepers found her on a cradle of blue ice, unblinking, humming a note the
            crystal vault answered with resonant harmony — every shard in the Spire sang with her, and has not been
            silent since.
          </p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-slate-300">
            Seraphina mastered cryomancy before she mastered speech. She does not command the cold; she{' '}
            <em className="text-cyan-300">asks</em> it, and it adores her. When the Sundered King marched on the frozen
            passes, she did not raise an army. She raised the blizzard — and the passes have closed every winter since,
            and will close for every winter after, for as long as she wills it.
          </p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-slate-300">
            They say the Heavenshard she carries is the first note the world ever sang, held in crystal so it could
            never fade. When she finally speaks it aloud, the age of storms will end — one breath that lasts forever.
          </p>

          <div className="hairline my-4" />
          <div className="grid grid-cols-2 gap-3 text-[10px]">
            <div>
              <div className="font-bold uppercase tracking-[0.24em] text-slate-500">Regalia</div>
              <div className="mt-0.5 text-slate-300">Heavenshard Staff · Diadem of the First Hush</div>
            </div>
            <div>
              <div className="font-bold uppercase tracking-[0.24em] text-slate-500">Alignment</div>
              <div className="mt-0.5 text-slate-300">Sentinel of the Silent Veil</div>
            </div>
            <div>
              <div className="font-bold uppercase tracking-[0.24em] text-slate-500">Domain</div>
              <div className="mt-0.5 text-slate-300">Cryomancy · Stillness · Aurora</div>
            </div>
            <div>
              <div className="font-bold uppercase tracking-[0.24em] text-slate-500">Devotion</div>
              <div className="mt-0.5 text-slate-300">The Spire Remembers</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
