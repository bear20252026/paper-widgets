import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { WORLDS } from "../data/worlds";
import Mark from "./Mark";

const NAV = ["Home", "Worlds", "Kit", "Routes", "League", "Contact"];

function useDistance() {
  const [km, setKm] = useState(2412908);
  useEffect(() => {
    const id = window.setInterval(
      () => setKm((k) => k + Math.floor(3 + Math.random() * 11)),
      900
    );
    return () => window.clearInterval(id);
  }, []);
  return km;
}

export default function Hero() {
  const [active, setActive] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState("Home");
  const [menu, setMenu] = useState(false);
  const reduced = useReducedMotion();
  const world = WORLDS[active];
  const km = useDistance();

  /* auto-advance: the fox never stops, neither does the world */
  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(
      () => setActive((i) => (i + 1) % WORLDS.length),
      7200
    );
    return () => window.clearTimeout(t);
  }, [active, reduced]);

  /* header state + active section */
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 80);
      let id = "Home";
      for (const label of NAV) {
        const el = document.getElementById(label.toLowerCase());
        if (el && el.getBoundingClientRect().top <= 140) id = label;
      }
      setCurrent(id);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${
          scrolled
            ? "border-b border-ink/10 bg-salt/92 backdrop-blur-xl"
            : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-3.5 md:px-8">
          <a href="#home" className="flex items-center gap-2.5">
            <Mark
              className={`h-7 w-8 transition-colors duration-500 ${
                scrolled ? "text-ink" : "text-white"
              }`}
            />
            <span
              className={`display text-[1.02rem] leading-none tracking-[0.2em] transition-colors duration-500 ${
                scrolled ? "text-ink" : "text-white"
              }`}
            >
              Earshot
            </span>
          </a>

          <nav
            className={`hidden items-center gap-1 rounded-full p-1.5 md:flex ${
              scrolled
                ? "bg-ink/6"
                : "bg-white/16 ring-1 ring-white/35 backdrop-blur-md"
            }`}
          >
            {NAV.map((label) => {
              const on = current === label;
              return (
                <a
                  key={label}
                  href={`#${label.toLowerCase()}`}
                  className={`rounded-full px-4 py-2 text-[0.82rem] font-semibold transition-colors duration-300 ${
                    on
                      ? "bg-white text-ink"
                      : scrolled
                        ? "text-ink/70 hover:text-ink"
                        : "text-white/85 hover:text-white"
                  }`}
                >
                  {label}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="#contact"
              className="rounded-full bg-ochre px-5 py-2.5 text-[0.82rem] font-bold text-white shadow-[0_10px_30px_-12px_rgba(228,118,43,0.9)] transition hover:bg-clay"
            >
              Play
            </a>
            <button
              onClick={() => setMenu((m) => !m)}
              aria-label="Menu"
              aria-expanded={menu}
              className={`grid h-11 w-11 place-items-center rounded-full transition ${
                scrolled
                  ? "bg-ink/8 text-ink hover:bg-ink/15"
                  : "bg-white/16 text-white ring-1 ring-white/35 backdrop-blur-md hover:bg-white/28"
              }`}
            >
              <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
                <path
                  d={menu ? "M2 2l14 8M16 2L2 10" : "M0 1.5h18M0 10.5h18"}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menu && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden bg-salt/97 backdrop-blur-xl md:hidden"
            >
              <ul className="px-5 pb-5">
                {NAV.map((label) => (
                  <li key={label} className="border-b border-ink/10 last:border-0">
                    <a
                      href={`#${label.toLowerCase()}`}
                      onClick={() => setMenu(false)}
                      className="flex items-baseline justify-between py-3.5"
                    >
                      <span className="display-tight text-2xl">{label}</span>
                      <span className="eyebrow tnum text-dust">
                        {String(NAV.indexOf(label) + 1).padStart(2, "0")}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* ————— HERO STAGE ————— */}
      <section
        id="home"
        className="grain relative h-[100svh] min-h-[620px] w-full overflow-hidden bg-ink"
      >
        {WORLDS.map((w, i) => (
          <div
            key={w.id}
            className="absolute inset-0"
            style={{
              opacity: i === active ? 1 : 0,
              transition: "opacity 1100ms cubic-bezier(.4,0,.2,1)",
            }}
            aria-hidden={i !== active}
          >
            <img
              src={w.image}
              alt={`${w.name} — the fennec fox sprinting`}
              className="h-full w-full object-cover"
              style={{
                transform: `scale(${i === active ? 1.09 : 1.02})`,
                transition: "transform 9000ms linear",
              }}
            />
          </div>
        ))}

        {/* accent light sweep on every world change */}
        <AnimatePresence>
          <motion.div
            key={world.id + "-wipe"}
            className="pointer-events-none absolute inset-y-0 w-1/2 mix-blend-soft-light"
            initial={{ x: "-70%", opacity: 0 }}
            animate={{ x: "140%", opacity: [0, 0.8, 0] }}
            transition={{ duration: 1.25, ease: "easeInOut" }}
            style={{
              background: `linear-gradient(90deg, transparent, ${world.accent}, transparent)`,
            }}
          />
        </AnimatePresence>

        {/* speed streaks — the fox is always mid-stride */}
        <div
          className="pointer-events-none absolute inset-x-0 top-[18%] h-[34%] overflow-hidden opacity-[0.16] mix-blend-overlay"
          aria-hidden
        >
          <div
            className="marquee h-full w-max items-center"
            style={{ animationDuration: "11s" }}
          >
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center gap-16 pr-16">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span
                    key={i}
                    className="block h-px bg-white"
                    style={{ width: `${40 + ((i * 37) % 130)}px` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* scrims: warm ink, never pure black */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(20,17,13,0.86)_0%,rgba(20,17,13,0.34)_34%,rgba(20,17,13,0)_62%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_left,rgba(20,17,13,0.52)_0%,rgba(20,17,13,0)_58%)]" />

        {/* headline column — hard right, off-centre on purpose */}
        <div className="relative z-20 mx-auto flex h-full max-w-[1440px] flex-col justify-end px-5 pb-32 pt-28 md:justify-center md:px-8 md:pb-28">
          <div className="ms-auto flex w-full flex-col items-start md:w-[62%] md:items-end md:text-right lg:w-[56%]">
            <AnimatePresence mode="wait">
              <motion.div
                key={world.id}
                initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  y: -14,
                  filter: "blur(6px)",
                  transition: { duration: 0.22 },
                }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex w-full flex-col items-start md:items-end"
              >
                <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/14 px-3.5 py-2 ring-1 ring-white/30 backdrop-blur-md">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: world.accent }}
                  />
                  <span className="eyebrow text-white">{world.eyebrow}</span>
                </span>

                <h1 className="display text-white text-[clamp(3.1rem,11.5vw,9.5rem)] [text-shadow:0_18px_60px_rgba(20,17,13,0.35)]">
                  <span className="block">{world.headline[0]}</span>
                  <span className="block">{world.headline[1]}</span>
                </h1>

                <p className="mt-6 max-w-[34ch] text-[0.98rem] leading-relaxed text-white/92 drop-shadow-[0_2px_18px_rgba(20,17,13,0.6)] md:text-[1.06rem]">
                  {world.blurb}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#kit"
                className="group inline-flex items-center gap-3 rounded-full bg-white py-2 pl-6 pr-2 text-[0.92rem] font-bold text-ink transition hover:bg-salt"
              >
                View kit
                <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white transition-transform duration-300 group-hover:rotate-45">
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
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
              <a
                href="#worlds"
                className="inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-[0.92rem] font-semibold text-white ring-1 ring-white/35 transition hover:bg-white/12"
              >
                <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden>
                  <path d="M1 1l10 5.5L1 12z" fill="currentColor" />
                </svg>
                Watch the run
              </a>
            </div>
          </div>
        </div>

        {/* world switcher, floating on the horizon */}
        <div className="absolute inset-x-0 bottom-7 z-30 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="eyebrow tnum text-white/65">{world.index} / 03</span>
            <span className="h-px w-7 bg-white/40" />
            <span className="eyebrow text-white">{world.name}</span>
          </div>
          <div className="flex items-end gap-3">
            {WORLDS.map((w, i) => {
              const on = i === active;
              return (
                <button
                  key={w.id}
                  onClick={() => setActive(i)}
                  aria-label={`Switch world to ${w.name}`}
                  aria-current={on}
                  className="group relative"
                >
                  <span
                    className={`block h-[52px] w-[52px] overflow-hidden rounded-full transition-all duration-500 md:h-16 md:w-16 ${
                      on
                        ? "scale-110 ring-[3px] ring-white ring-offset-2 ring-offset-black/25"
                        : "opacity-70 ring-1 ring-white/45 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={w.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span
                    className={`eyebrow absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-white transition-opacity duration-300 ${
                      on ? "opacity-0" : "opacity-0 group-hover:opacity-80"
                    }`}
                  >
                    {w.name}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="h-[3px] w-24 overflow-hidden rounded-full bg-white/25">
            <div
              key={active}
              className="progress-run h-full w-full bg-ochre"
              style={reduced ? { transform: "scaleX(1)" } : undefined}
            />
          </div>
        </div>

        {/* live counter */}
        <div className="absolute bottom-8 right-5 z-30 hidden text-right md:block md:right-8">
          <div className="display tnum text-[2.1rem] leading-none text-white">
            {km.toLocaleString("en-US")}
          </div>
          <div className="eyebrow mt-2 text-white/60">
            km logged by the pack
          </div>
          <div className="mt-1 flex items-center justify-end gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ochre" />
            <span className="eyebrow text-white/45">live</span>
          </div>
        </div>
      </section>
    </>
  );
}
