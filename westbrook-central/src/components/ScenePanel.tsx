import { CAMERA_PRESETS, useStore, type TimeOfDay } from '../store'
import { cn } from '../utils/cn'

const TODS: { id: TimeOfDay; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'overcast', label: 'Overcast' },
  { id: 'dusk', label: 'Dusk' },
  { id: 'night', label: 'Night' },
]

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <button onClick={onChange} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-white/5">
      <span>
        <span className="text-zinc-200">{label}</span>
        {hint && <span className="ml-2 text-xs text-zinc-500">{hint}</span>}
      </span>
      <span className={cn('relative h-5 w-9 rounded-full transition-colors', on ? 'bg-amber-500' : 'bg-zinc-700')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', on ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  )
}

export function ScenePanel() {
  const settings = useStore((s) => s.settings)
  const set = useStore((s) => s.setSettings)
  const capture = useStore((s) => s.triggerCapture)
  const capturedAt = useStore((s) => s.capturedAt)
  const audit = useStore((s) => s.audit)

  // train state
  const trainState = useStore((s) => s.trainState)
  const trainSpeedKmh = useStore((s) => s.trainSpeedKmh)
  const trainDwellRemaining = useStore((s) => s.trainDwellRemaining)
  const trainHold = useStore((s) => s.trainHold)
  const setTrainHold = useStore((s) => s.setTrainHold)
  const triggerDepart = useStore((s) => s.triggerDepart)
  const triggerArrive = useStore((s) => s.triggerArrive)

  return (
    <div className="space-y-5 fade-in">
      {/* Train Operations */}
      <section className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', trainState === 'at_station' ? 'bg-emerald-400' : 'bg-amber-400')} />
              <span className={cn('relative inline-flex h-2 w-2 rounded-full', trainState === 'at_station' ? 'bg-emerald-500' : 'bg-amber-500')} />
            </span>
            <h3 className="text-[12px] font-semibold text-zinc-100">Class 387 Commuter Train</h3>
          </div>
          <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
            {trainSpeedKmh > 0 ? `${trainSpeedKmh} km/h` : 'Platform 2'}
          </span>
        </div>

        <div className="mb-3 rounded-lg border border-white/8 bg-black/30 p-2.5 text-[11.5px]">
          <div className="flex items-center justify-between text-zinc-300">
            <span className="font-medium">
              {trainState === 'at_station' && (trainHold ? 'Holding at platform (Doors open)' : `Boarding — departs in ${trainDwellRemaining}s`)}
              {trainState === 'departing' && `Departing west (${trainSpeedKmh} km/h)`}
              {trainState === 'in_transit' && `En route down line (${trainDwellRemaining}s until next)`}
              {trainState === 'arriving' && `Arriving Platform 2 — braking (${trainSpeedKmh} km/h)`}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span>Contoured 2+2 seating · winged headrests · hand-straps · clear windows</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {trainState === 'at_station' ? (
            <button
              onClick={triggerDepart}
              className="rounded-lg bg-amber-400/90 py-1.5 text-center text-[11.5px] font-semibold text-amber-950 transition-colors hover:bg-amber-300"
            >
              Depart now ➔
            </button>
          ) : (
            <button
              onClick={triggerArrive}
              className="rounded-lg bg-sky-500/80 py-1.5 text-center text-[11.5px] font-semibold text-white transition-colors hover:bg-sky-400"
            >
              Call train to platform
            </button>
          )}

          <button
            onClick={() => set({ cameraPreset: 'inside-train' })}
            className="rounded-lg border border-white/15 bg-white/5 py-1.5 text-center text-[11.5px] font-medium text-zinc-200 hover:border-amber-400/50 hover:bg-white/10"
          >
            Ride inside train
          </button>
        </div>

        <div className="mt-2.5 pt-2 border-t border-white/8">
          <Toggle
            on={trainHold}
            onChange={() => setTrainHold(!trainHold)}
            label="Hold at station"
            hint="keeps doors open to inspect interior"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Time of day</h3>
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/30 p-1">
          {TODS.map((t) => (
            <button
              key={t.id}
              onClick={() => set({ timeOfDay: t.id })}
              className={cn(
                'rounded-md py-1.5 text-xs font-medium transition-colors',
                settings.timeOfDay === t.id ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Camera</h3>
        <div className="grid grid-cols-2 gap-1">
          {CAMERA_PRESETS.map((c) => (
            <button
              key={c.id}
              onClick={() => set({ cameraPreset: c.id })}
              className={cn(
                'rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                settings.cameraPreset === c.id
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                  : 'border-white/10 text-zinc-300 hover:border-white/20 hover:bg-white/5',
              )}
            >
              <div>{c.label}</div>
              {c.note && <div className="text-[10px] text-rose-400">{c.note}</div>}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-zinc-500">Drag to orbit, scroll to dolly. Camera height is audited by the review loop.</p>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Fog density</h3>
        <input
          type="range"
          min={0}
          max={0.02}
          step={0.0005}
          value={settings.fogDensity}
          onChange={(e) => set({ fogDensity: parseFloat(e.target.value) })}
          className="w-full accent-amber-500"
        />
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>0</span>
          <span className={cn(settings.fogDensity < 0.003 || settings.fogDensity > 0.014 ? 'text-rose-400' : 'text-zinc-300')}>{settings.fogDensity.toFixed(4)}</span>
          <span>0.02</span>
        </div>
      </section>

      <section className="space-y-0.5">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Scene</h3>
        <Toggle on={settings.wet} onChange={() => set({ wet: !settings.wet })} label="Wet platform" hint="roughness 0.42" />
        <Toggle on={settings.train} onChange={() => set({ train: !settings.train })} label="Train at platform 2" />
        <Toggle on={settings.shadows} onChange={() => set({ shadows: !settings.shadows })} label="Sun shadows" hint="2048²" />
        <Toggle on={settings.bloom} onChange={() => set({ bloom: !settings.bloom })} label="Post (bloom · grain)" />
        <Toggle on={settings.rain} onChange={() => set({ rain: !settings.rain })} label="Rain" />
      </section>

      <button
        onClick={capture}
        className="flex w-full items-center justify-between rounded-lg bg-amber-400 px-3 py-2.5 text-[12px] font-semibold text-amber-950 transition-colors hover:bg-amber-300"
      >
        <span>Save a still (PNG)</span>
        <span className="font-mono text-[10px] opacity-70">{capturedAt ? 'saved ✓' : 'capture'}</span>
      </button>

      <section className="rounded-lg border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-zinc-400">
        <div className="mb-1 flex items-center justify-between font-semibold text-zinc-200">
          <span>Runtime budget</span>
          {audit && <span className="font-mono text-[10px] font-normal text-zinc-400">{audit.stats.drawCalls} calls · {(audit.stats.triangles / 1000).toFixed(0)}k tris</span>}
        </div>
        Lofted curves, lathed cast-iron, bevelled furniture, and runtime Sobel normal maps — zero downloaded scene assets. Reference photos live only in the{' '}
        <span className="text-zinc-200">Photos</span> tab.
      </section>
    </div>
  )
}
