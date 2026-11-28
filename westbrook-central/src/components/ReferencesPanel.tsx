import { useState } from 'react'
import { REFERENCES, type Reference } from '../data/references'

export function ReferencesPanel() {
  const [active, setActive] = useState<Reference | null>(null)
  return (
    <div className="space-y-4 fade-in">
      <p className="text-[12px] leading-relaxed text-zinc-400">
        Real platform photography collected from Pexels. These are the <em>only</em> downloaded images in the project and they are used as a visual
        contract for signage, edge markings and material wear — never as textures.
      </p>
      <ul className="space-y-3">
        {REFERENCES.map((r) => (
          <li key={r.id} className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
            <button onClick={() => setActive(r)} className="block w-full">
              <img src={r.thumb} alt={r.title} loading="lazy" className="aspect-[16/9] w-full object-cover transition-opacity hover:opacity-90" />
            </button>
            <div className="p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[12px] font-medium text-zinc-100">{r.title}</div>
                <div className="shrink-0 text-[10px] text-zinc-500">{r.place}</div>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-zinc-400">{r.takeaway}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {r.rules.map((id) => (
                  <span key={id} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">
                    {id}
                  </span>
                ))}
                <a href={r.pageUrl} target="_blank" rel="noreferrer" className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-200">
                  Photo: {r.credit} ↗
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={() => setActive(null)}>
          <div className="max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <img src={active.full} alt={active.title} className="max-h-[80vh] rounded-lg shadow-2xl" />
            <div className="mt-2 flex items-center justify-between text-[12px] text-zinc-300">
              <span>
                {active.title} — {active.place}
              </span>
              <a href={active.creditUrl} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-white">
                © {active.credit} / Pexels
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
