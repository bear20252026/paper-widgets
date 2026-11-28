import { useEffect, useState } from 'react'
import { Scene } from './scene/Scene'
import { ScenePanel } from './components/ScenePanel'
import { RulebookPanel } from './components/RulebookPanel'
import { ReviewPanel } from './components/ReviewPanel'
import { ReferencesPanel } from './components/ReferencesPanel'
import { CAMERA_PRESETS, useStore, type TimeOfDay } from './store'
import { cn } from './utils/cn'

type Tab = 'scene' | 'rulebook' | 'review' | 'references'
const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'scene', label: 'Scene', hint: 'Look' },
  { id: 'rulebook', label: 'Rulebook', hint: '19 rules' },
  { id: 'review', label: 'Review', hint: 'Loop' },
  { id: 'references', label: 'Photos', hint: '8 refs' },
]

const TOD: { id: TimeOfDay; label: string; dot: string }[] = [
  { id: 'day', label: 'Day', dot: 'bg-sky-300' },
  { id: 'overcast', label: 'Grey', dot: 'bg-zinc-300' },
  { id: 'dusk', label: 'Dusk', dot: 'bg-orange-400' },
  { id: 'night', label: 'Night', dot: 'bg-indigo-400' },
]

function BrandMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" className="shrink-0">
      <rect x="1" y="1" width="32" height="32" rx="8" stroke="rgba(255,255,255,0.24)" />
      <path d="M8 24.5V15.2c0-3.4 3.6-5.4 9-5.4s9 2 9 5.4v9.3" stroke="#fbbf24" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 24V16.6m10 7.4V16.6M8 20h18" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11.5 28.5 14 25m9 3.5L20.5 25" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function Dock() {
  const settings = useStore((s) => s.settings)
  const set = useStore((s) => s.setSettings)
  const triggerCapture = useStore((s) => s.triggerCapture)
  const capturedAt = useStore((s) => s.capturedAt)
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 flex max-w-[calc(100vw-2rem)] flex-col gap-2">
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 p-1 backdrop-blur-xl">
        <span className="pl-2 pr-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Time</span>
        {TOD.map((t) => (
          <button
            key={t.id}
            onClick={() => set({ timeOfDay: t.id })}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] transition-colors',
              settings.timeOfDay === t.id ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-white',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-black/45 p-1 backdrop-blur-xl">
        {CAMERA_PRESETS.filter((c) => !c.note).map((c) => (
          <button
            key={c.id}
            onClick={() => set({ cameraPreset: c.id })}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-[11px] transition-colors',
              settings.cameraPreset === c.id ? 'bg-amber-400 font-medium text-amber-950' : 'text-zinc-300 hover:bg-white/10',
            )}
          >
            {c.label}
          </button>
        ))}
        <button
          onClick={triggerCapture}
          title="Download a still"
          className="ml-0.5 flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-zinc-200 hover:border-amber-300/60 hover:text-amber-200"
        >
          <span className="text-[13px] leading-none">◉</span>
          {capturedAt ? 'Saved' : 'Still'}
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('scene')
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1024)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1400)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    let wasNarrow = window.innerWidth < 900
    const onResize = () => {
      const narrow = window.innerWidth < 900
      if (narrow !== wasNarrow) {
        setOpen(!narrow)
        wasNarrow = narrow
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#08090c] text-zinc-100">
      <div className="absolute inset-0">
        <Scene />
      </div>

      {/* cinematic top scrim so the header always reads */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 via-black/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Header */}
      <div className="pointer-events-none absolute top-4 left-4 flex items-start gap-3 select-none">
        <BrandMark />
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[8.5px] font-semibold tracking-[0.16em] text-amber-300 uppercase">Platform 2</span>
            <span className="hidden text-[8.5px] font-medium uppercase tracking-[0.18em] text-zinc-400 sm:inline">Procedural · no scene assets</span>
          </div>
          <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-white drop-shadow-lg">Westbrook Central</h1>
          <p className="hidden text-[11px] text-zinc-400 sm:block">London · 14:28 · 6°C · a little rain earlier</p>
        </div>
      </div>

      {/* Sidebar */}
      <div className={cn('absolute top-3 right-3 bottom-3 flex w-[372px] max-w-[calc(100vw-1.5rem)] flex-col transition-all duration-500 sm:top-4 sm:right-4 sm:bottom-4', open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-[calc(100%+1.5rem)] opacity-0')}>
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f13]/85 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          <div className="flex items-center gap-1 border-b border-white/8 px-2.5 pt-2.5 pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn('group relative flex-1 rounded-lg px-2 py-1.5 text-left transition-colors', tab === t.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]')}
              >
                <div className={cn('text-[11.5px] font-medium', tab === t.id ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200')}>{t.label}</div>
                <div className="text-[9px] tracking-wide text-zinc-600 uppercase">{t.hint}</div>
                {tab === t.id && <span className="absolute inset-x-2 -bottom-[7px] h-[2px] rounded-full bg-amber-400" />}
              </button>
            ))}
            <button onClick={() => setOpen(false)} className="ml-0.5 rounded-md p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white" title="Hide panel">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
          <div className="panel-scroll flex-1 overflow-y-auto p-3 pb-8">
            {tab === 'scene' && <ScenePanel />}
            {tab === 'rulebook' && <RulebookPanel />}
            {tab === 'review' && <ReviewPanel />}
            {tab === 'references' && <ReferencesPanel />}
          </div>
        </div>
      </div>

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0d0f13]/85 px-3 py-2 text-[11px] text-zinc-200 backdrop-blur-xl hover:border-white/25"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          Panels
        </button>
      )}

      <Dock />

      {/* first-run hint (only shown on ultra-wide viewports where dock has generous clearance) */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[10px] text-zinc-400 backdrop-blur-md 2xl:flex">
        <span className="h-1 w-1 rounded-full bg-amber-400" />
        drag to look around · scroll to move · every surface is generated in the browser
      </div>

      {/* Loading veil */}
      <div className={cn('pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#08090c] transition-opacity duration-700', ready ? 'invisible opacity-0' : 'visible opacity-100')}>
        <BrandMark />
        <div className="mt-4 text-[10px] font-semibold tracking-[0.3em] text-zinc-500 uppercase">Painting textures</div>
        <div className="mt-3 h-[2px] w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-amber-400" />
        </div>
      </div>
    </div>
  )
}
