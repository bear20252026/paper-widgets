import { RULEBOOK, SECTIONS } from '../data/rulebook'
import { useStore } from '../store'
import { cn } from '../utils/cn'

export function RulebookPanel() {
  const audit = useStore((s) => s.audit)
  const manual = useStore((s) => s.manual)
  const statusFor = (id: string) => {
    const c = audit?.checks.find((x) => x.ruleId === id)
    if (c) return c.pass ? 'pass' : 'fail'
    if (manual[id]) return 'signed'
    return null
  }
  return (
    <div className="space-y-5 fade-in">
      <p className="text-[12px] leading-relaxed text-zinc-400">
        The rulebook is the contract between the scene and the review loop. <span className="text-zinc-200">auto</span> rules are measured from the live
        scene graph; <span className="text-zinc-200">manual</span> rules are signed off by a critic against the reference photos.
      </p>
      {SECTIONS.map((sec) => (
        <section key={sec}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{sec}</h3>
          <ul className="space-y-1.5">
            {RULEBOOK.filter((r) => r.section === sec).map((r) => {
              const st = statusFor(r.id)
              return (
                <li key={r.id} className="rounded-lg border border-white/8 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-zinc-500">{r.id}</span>
                      <span className="text-[13px] font-medium text-zinc-100">{r.title}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 font-mono text-[9px] uppercase',
                          r.check === 'auto' ? 'bg-sky-500/15 text-sky-300' : 'bg-violet-500/15 text-violet-300',
                        )}
                      >
                        {r.check}
                      </span>
                      {st && (
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 font-mono text-[9px] uppercase',
                            st === 'fail' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300',
                          )}
                        >
                          {st}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-zinc-400">{r.body}</p>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
