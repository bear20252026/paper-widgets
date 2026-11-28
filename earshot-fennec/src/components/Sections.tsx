import { motion } from "framer-motion";
import { KIT, ROUTES, STANDINGS, WORLDS } from "../data/worlds";
import Mark from "./Mark";

const rise = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
};

const TICKER = [
  "Never stops",
  "No pause button",
  "Three worlds",
  "One stride",
  "Mirror · Village · Shore",
  "Run the horizon",
];

function Ticker() {
  return (
    <div className="relative overflow-hidden border-y border-ink/10 bg-ink py-5">
      <div className="marquee items-center">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex items-center gap-10 pr-10">
            {TICKER.map((t) => (
              <span key={t} className="flex items-center gap-10">
                <span className="display text-[1.55rem] text-salt md:text-[2.15rem]">
                  {t}
                </span>
                <span className="h-2.5 w-2.5 rotate-45 bg-ochre" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Worlds() {
  return (
    <section id="worlds" className="relative bg-salt">
      <div className="mx-auto max-w-[1440px] px-5 pb-14 pt-24 md:px-8">
        <motion.div {...rise} className="max-w-[52rem]">
          <p className="eyebrow text-ochre">The three terrains</p>
          <h2 className="display mt-6 text-[clamp(2.6rem,7vw,6rem)]">
            The ground changes.
            <br />
            The stride doesn&apos;t.
          </h2>
          <p className="mt-7 max-w-[46ch] text-[1.05rem] leading-relaxed text-dust">
            Every 60 seconds the terrain beneath the fox re-forms. There is no
            load screen, no cut, no rest — the salt simply becomes road, the road
            becomes shore, and your rhythm is the only thing carried across.
          </p>
        </motion.div>
      </div>

      {WORLDS.map((w, i) => (
        <article key={w.id} className="border-t border-ink/12">
          <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-16 md:px-8 lg:grid-cols-12 lg:gap-14 lg:py-24">
            <motion.div
              {...rise}
              className={`relative lg:col-span-5 ${i % 2 === 1 ? "lg:order-2" : ""}`}
            >
              <span
                className="display tnum pointer-events-none absolute -top-10 left-0 select-none text-[8rem] leading-none opacity-90 md:text-[11rem]"
                style={{ color: `color-mix(in srgb, ${w.accent} 55%, transparent)` }}
              >
                {w.index}
              </span>
              <div className="relative">
                <p className="eyebrow text-dust">{w.eyebrow}</p>
                <h3 className="display mt-4 text-[clamp(2.6rem,7.5vw,5.2rem)]">
                  {w.headline[0]}
                  <br />
                  {w.headline[1]}
                </h3>
                <p className="mt-6 max-w-[42ch] text-[1.02rem] leading-relaxed text-ink/75">
                  {w.blurb}
                </p>

                <dl className="mt-9 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-ink/15 pt-7">
                  {w.stats.map((s) => (
                    <div key={s.label}>
                      <dt className="eyebrow text-dust">{s.label}</dt>
                      <dd className="tnum mt-1.5 text-[1.02rem] font-semibold">
                        {s.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </motion.div>

            <motion.div
              {...rise}
              className={`relative lg:col-span-7 ${i % 2 === 1 ? "lg:order-1" : ""}`}
            >
              <div
                className="absolute -inset-3 hidden lg:block"
                style={{
                  background: `color-mix(in srgb, ${w.accent} 26%, transparent)`,
                }}
              />
              <figure className="relative overflow-hidden">
                <img
                  src={w.image}
                  alt={`${w.name} terrain`}
                  className="h-[64vw] w-full object-cover sm:h-[52vw] lg:h-[34rem]"
                  loading="lazy"
                />
                <figcaption className="absolute bottom-4 left-4 flex items-center gap-2.5 bg-ink/70 px-4 py-2.5 backdrop-blur-md">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: w.accent }}
                  />
                  <span className="eyebrow text-white">
                    W{w.index} · {w.name}
                  </span>
                </figcaption>
              </figure>
            </motion.div>
          </div>
        </article>
      ))}
    </section>
  );
}

function Kit() {
  return (
    <section id="kit" className="relative overflow-hidden bg-sand">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-24 md:px-8 lg:grid-cols-2 lg:gap-16">
        <motion.div {...rise} className="relative">
          <img
            src="images/kit-stilllife.jpg"
            alt="Courier kit laid out on a bench"
            className="h-[62vw] w-full object-cover lg:h-[42rem]"
            loading="lazy"
          />
          <div className="absolute bottom-0 left-0 bg-ochre px-6 py-4">
            <p className="display text-[1.5rem] text-white">Courier kit</p>
            <p className="tnum text-[0.82rem] font-semibold text-white/85">
              0.94 kg total · 4 pieces
            </p>
          </div>
        </motion.div>

        <motion.div {...rise} className="flex flex-col justify-center">
          <p className="eyebrow text-ochre">Kit</p>
          <h2 className="display mt-6 text-[clamp(2.5rem,6vw,4.6rem)]">
            Pack light
            <br />
            or pack it in
          </h2>
          <p className="mt-6 max-w-[44ch] text-[1.02rem] leading-relaxed text-ink/75">
            Weight is subtracted from your acceleration, not your health bar.
            Every piece below is earned through drops and can be shed mid-run —
            which is the only way to hold the record on the Mirror Mile.
          </p>

          <ul className="mt-10 border-t border-ink/15">
            {KIT.map((item) => (
              <li key={item.name}>
                <a
                  href="#kit"
                  className="group flex items-start justify-between gap-6 border-b border-ink/15 py-6 transition-colors duration-300 hover:bg-ink/5"
                >
                  <div>
                    <h3 className="display-tight text-[1.35rem] transition-transform duration-300 group-hover:translate-x-1.5">
                      {item.name}
                    </h3>
                    <p className="mt-1.5 max-w-[38ch] text-[0.92rem] text-dust">
                      {item.spec}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <p className="tnum text-right text-[1.15rem] font-bold">
                      {item.figure}
                      <span className="ml-1 text-[0.75rem] font-semibold text-dust">
                        {item.unit}
                      </span>
                    </p>
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-ink/20 transition-all duration-300 group-hover:bg-ink group-hover:text-sand">
                      <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden>
                        <path
                          d="M2 12L12 2M4 2h8v8"
                          stroke="currentColor"
                          strokeWidth="1.9"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}

function Routes() {
  return (
    <section id="routes" className="bg-salt">
      <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-8">
        <motion.div
          {...rise}
          className="flex flex-wrap items-end justify-between gap-6 border-b border-ink/15 pb-10"
        >
          <h2 className="display text-[clamp(2.4rem,6vw,4.6rem)]">
            Routes on record
          </h2>
          <p className="max-w-[34ch] text-[0.98rem] leading-relaxed text-dust">
            Measured by the league on the same clock, same kit, same fox.
            Times update every Monday at 06:00 UTC.
          </p>
        </motion.div>

        <div className="grid gap-px bg-ink/12 md:grid-cols-3">
          {ROUTES.map((r, i) => (
            <motion.div
              key={r.name}
              {...rise}
              transition={{ ...rise.transition, delay: i * 0.08 }}
              className="group bg-salt px-2 py-10 transition-colors duration-300 hover:bg-sand"
            >
              <p className="eyebrow text-dust">{r.world}</p>
              <h3 className="display-tight mt-3 text-[1.75rem]">{r.name}</h3>
              <p className="display tnum mt-8 text-[clamp(3.4rem,8vw,5.4rem)] leading-none">
                {r.length}
                <span className="ml-2 text-[1.15rem] font-semibold tracking-normal text-dust">
                  km
                </span>
              </p>
              <p className="tnum mt-5 border-t border-ink/15 pt-4 text-[0.92rem] text-dust">
                Record <span className="font-bold text-ink">{r.record}</span>
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function League() {
  return (
    <section id="league" className="relative overflow-hidden bg-ink">
      <img
        src="images/league-dusk.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-45"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,17,13,0.96)_18%,rgba(20,17,13,0.62)_70%,rgba(20,17,13,0.42)_100%)]" />

      <div className="relative mx-auto max-w-[1440px] px-5 py-24 md:px-8">
        <motion.div {...rise} className="max-w-[46rem]">
          <p className="eyebrow text-ochre">League</p>
          <h2 className="display mt-6 text-[clamp(2.5rem,6.5vw,5.2rem)] text-salt">
            Season 04
            <br />
            standings
          </h2>
        </motion.div>

        <motion.div {...rise} className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/25">
                {["Rank", "Runner", "World", "Stride", "Tier"].map((h) => (
                  <th key={h} className="eyebrow pb-4 text-white/55">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STANDINGS.map((s) => (
                <tr
                  key={s.rank}
                  className="border-b border-white/12 transition-colors duration-300 hover:bg-white/8"
                >
                  <td className="tnum display py-5 text-[1.35rem] text-ochre">
                    {s.rank}
                  </td>
                  <td className="py-5 pr-6">
                    <span className="display-tight text-[1.35rem] text-salt">
                      {s.runner}
                    </span>
                  </td>
                  <td className="py-5 pr-6 text-[0.92rem] text-white/70">
                    {s.world}
                  </td>
                  <td className="tnum py-5 pr-6 text-[1.05rem] font-bold text-salt">
                    {s.time}
                  </td>
                  <td className="py-5">
                    <span
                      className={`eyebrow rounded-full px-3 py-1.5 ${
                        s.tier === "Golden"
                          ? "bg-ochre text-white"
                          : s.tier === "Silver"
                            ? "bg-white/18 text-white"
                            : "bg-white/8 text-white/70"
                      }`}
                    >
                      {s.tier}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="relative overflow-hidden bg-ochre">
      <div className="mx-auto max-w-[1440px] px-5 py-24 md:px-8">
        <motion.div {...rise}>
          <p className="eyebrow text-ink">Ready when you are</p>
          <h2 className="display mt-7 text-[clamp(3.4rem,15vw,12rem)] text-white">
            Never
            <br />
            stops.
          </h2>
          <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-6 border-t border-ink/25 pt-10">
            <a
              href="#home"
              className="group inline-flex items-center gap-3 rounded-full bg-ink py-2 pl-7 pr-2 text-[1rem] font-bold text-salt transition hover:bg-clay"
            >
              Play the demo
              <span className="grid h-11 w-11 place-items-center rounded-full bg-ochre text-white transition-transform duration-300 group-hover:rotate-45">
                <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden>
                  <path
                    d="M2 12L12 2M4 2h8v8"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </a>
            <div className="text-ink">
              <p className="eyebrow text-ink">Press & creators</p>
              <a
                href="mailto:run@earshot.game"
                className="mt-1.5 block text-[1.15rem] font-bold underline decoration-ink/30 underline-offset-4 transition hover:decoration-ink"
              >
                run@earshot.game
              </a>
            </div>
            <div className="text-ink">
              <p className="eyebrow text-ink">Next drop</p>
              <p className="tnum mt-1.5 text-[1.15rem] font-bold">
                14 March · Season 05
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-ink text-salt">
      <div className="mx-auto max-w-[1440px] px-5 py-14 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <Mark className="h-7 w-8 text-white" />
              <span className="display text-[1.02rem] tracking-[0.2em]">
                Earshot
              </span>
            </div>
            <p className="mt-5 max-w-[30ch] text-[0.92rem] leading-relaxed text-white/55">
              An endless runner about rhythm, weight and the ground changing
              under you. Built by six people and one very fast fox.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-14 gap-y-8">
            {[
              { head: "Game", items: ["Worlds", "Kit", "Routes"] },
              { head: "League", items: ["Standings", "Rules", "Season 04"] },
              { head: "Studio", items: ["About", "Press kit", "Careers"] },
            ].map((col) => (
              <div key={col.head}>
                <p className="eyebrow text-white/40">{col.head}</p>
                <ul className="mt-4 space-y-2.5">
                  {col.items.map((it) => (
                    <li key={it}>
                      <a
                        href="#home"
                        className="text-[0.95rem] text-white/75 transition-colors hover:text-ochre"
                      >
                        {it}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/12 pt-7">
          <p className="tnum text-[0.82rem] text-white/45">
            © 2026 Earshot Studio · Lisbon · All strides reserved
          </p>
          <p className="eyebrow text-white/35">
            The world morphs · the fox never stops
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function Sections() {
  return (
    <>
      <Ticker />
      <Worlds />
      <Kit />
      <Routes />
      <League />
      <Contact />
      <Footer />
    </>
  );
}
