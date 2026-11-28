import { useState } from 'react'
import { MANUAL_RULE_IDS, RULEBOOK } from '../data/rulebook'
import { useStore } from '../store'
import { cn } from '../utils/cn'

const CRITICS: { name: string; blurb: string; rules: string[] }[] = [
  { name: 'Materials critic', blurb: 'Compare roughness, dirt and colour against the Jakarta and canopy references.', rules: ['MAT-03', 'MAT-04', 'AST-02'] },
  { name: 'Scale critic', blurb: 'Check every dimension against the metre values in SCL rules.', rules: ['SCL-01', 'SCL-02'] },
  { name: 'Signage critic', blurb: 'Hold the London / Kyoto / Lisboa photos next to the viewport.', rules: ['SGN-01', 'SGN-02', 'SGN-03', 'SGN-04'] },
  { name: 'Rolling stock critic', blurb: 'Inspect commuter saloon: moquette seats, grab poles, ceiling lights, seated commuters & running schedule.', rules: ['RLS-01', 'RLS-02'] },
  { name: 'Process', blurb: 'Confirm this round followed the loop.', rules: ['REV-01'] },
]

function fmt(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function ReviewPanel() {
  const audit = useStore((s) => s.audit)
  const runAudit = useStore((s) => s.runAudit)
  const manual = useStore((s) => s.manual)
  const toggleManual = useStore((s) => s.toggleManual)
  const notes = useStore((s) => s.notes)
  const setNotes = useStore((s) => s.setNotes)
  const rounds = useStore((s) => s.rounds)
  const closeRound = useStore((s) => s.closeRound)
  const clearRounds = useStore((s) => s.clearRounds)
  const [open, setOpen] = useState<number | null>(null)

  const autoFails = audit ? audit.checks.filter((c) => !c.pass).length : null
  const signed = MANUAL_RULE_IDS.filter((id) => manual[id]).length
  const ready = audit !== null
  const wouldApprove = audit !== null && autoFails === 0 && signed === MANUAL_RULE_IDS.length
  const nextN = rounds.length + 1

  return (
    <div className="space-y-5 fade-in">
      {/* Step 1 */}
      <section className="rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[12px] font-semibold text-zinc-100">
            <span className="mr-2 rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px]">1</span>Automated audit
          </h3>
          <button onClick={runAudit} className="rounded-md bg-sky-500/90 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-400">
            {audit ? 'Re-run' : 'Run audit'}
          </button>
        </div>
        {!audit ? (
          <p className="text-[11px] text-zinc-500">Walks the live scene graph: textures, materials, lights, fog, camera height and frame cost.</p>
        ) : (
          <ul className="space-y-1">
            {audit.checks.map((c) => (
              <li key={c.ruleId} className="flex items-start gap-2 text-[11px]">
                <span className={cn('mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-sm text-center text-[9px] leading-[14px] font-bold', c.pass ? 'bg-emerald-500/25 text-emerald-300' : 'bg-rose-500/25 text-rose-300')}>
                  {c.pass ? '✓' : '✕'}
                </span>
                <span className="font-mono text-[10px] text-zinc-500">{c.ruleId}</span>
                <span className="flex-1 text-zinc-300">{c.label}</span>
                <span className={cn('font-mono text-[10px]', c.pass ? 'text-zinc-500' : 'text-rose-300')}>{c.measured}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Step 2 */}
      <section className="rounded-lg border border-white/10 bg-black/20 p-3">
        <h3 className="mb-2 text-[12px] font-semibold text-zinc-100">
          <span className="mr-2 rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px]">2</span>Critics sign-off
          <span className="ml-2 font-mono text-[10px] text-zinc-500">
            {signed}/{MANUAL_RULE_IDS.length}
          </span>
        </h3>
        <div className="space-y-3">
          {CRITICS.map((cr) => (
            <div key={cr.name}>
              <div className="text-[11px] font-medium text-zinc-200">{cr.name}</div>
              <div className="mb-1 text-[10px] text-zinc-500">{cr.blurb}</div>
              <ul className="space-y-0.5">
                {cr.rules.map((id) => {
                  const r = RULEBOOK.find((x) => x.id === id)!
                  const on = !!manual[id]
                  return (
                    <li key={id}>
                      <button onClick={() => toggleManual(id)} className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-left hover:bg-white/5">
                        <span className={cn('mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-sm border text-center text-[9px] leading-[12px]', on ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200' : 'border-zinc-600')}>
                          {on ? '✓' : ''}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">{id}</span>
                        <span className={cn('text-[11px]', on ? 'text-zinc-200' : 'text-zinc-400')}>{r.title}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Step 3 */}
      <section className="rounded-lg border border-white/10 bg-black/20 p-3">
        <h3 className="mb-2 text-[12px] font-semibold text-zinc-100">
          <span className="mr-2 rounded bg-zinc-700 px-1.5 py-0.5 font-mono text-[10px]">3</span>Notes & close round {nextN}
        </h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What changed since the last round? What did the critics flag?"
          rows={3}
          className="w-full resize-none rounded-md border border-white/10 bg-black/30 p-2 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/60 focus:outline-none"
        />
        <button
          disabled={!ready}
          onClick={() => closeRound(MANUAL_RULE_IDS)}
          className={cn(
            'mt-2 w-full rounded-md py-2 text-[12px] font-semibold transition-colors',
            !ready
              ? 'cursor-not-allowed bg-zinc-800 text-zinc-500'
              : wouldApprove
                ? 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
                : 'bg-amber-500 text-amber-950 hover:bg-amber-400',
          )}
        >
          {!ready ? 'Run the audit first' : wouldApprove ? `Close round ${nextN} as APPROVED` : `Close round ${nextN} as REVISE`}
        </button>
      </section>

      {/* History */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Round history</h3>
          {rounds.length > 0 && (
            <button onClick={clearRounds} className="text-[10px] text-zinc-500 hover:text-rose-300">
              clear
            </button>
          )}
        </div>
        {rounds.length === 0 ? (
          <p className="text-[11px] text-zinc-600">No rounds yet. The loop starts when you close round 1.</p>
        ) : (
          <ul className="space-y-1">
            {rounds.map((r) => (
              <li key={r.n} className="rounded-md border border-white/8 bg-black/20">
                <button onClick={() => setOpen(open === r.n ? null : r.n)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
                  <span className="font-mono text-[10px] text-zinc-500">#{r.n}</span>
                  <span className={cn('rounded px-1.5 py-0.5 font-mono text-[9px] font-bold', r.verdict === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300')}>
                    {r.verdict}
                  </span>
                  <span className="flex-1 truncate text-[11px] text-zinc-400">{r.notes || <em className="text-zinc-600">no notes</em>}</span>
                  <span className="text-[10px] text-zinc-600">{fmt(r.at)}</span>
                </button>
                {open === r.n && (
                  <div className="border-t border-white/8 px-2.5 py-2 text-[10.5px] text-zinc-400">
                    <div className="mb-1 font-mono text-[10px] text-zinc-500">
                      {r.settings.timeOfDay} · {r.settings.cameraPreset} · fog {r.settings.fogDensity.toFixed(4)} · {r.settings.wet ? 'wet' : 'dry'} ·{' '}
                      {r.settings.train ? 'train' : 'no train'}
                    </div>
                    {r.failures.length === 0 ? (
                      <div className="text-emerald-300">All checks passed.</div>
                    ) : (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {r.failures.map((f, i) => (
                          <li key={i} className="text-rose-300/90">
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
