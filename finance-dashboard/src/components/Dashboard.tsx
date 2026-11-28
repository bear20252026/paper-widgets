import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";

import {
  BALANCE_PATH,
  BAR_BASE,
  BUSINESSES,
  DAYS,
  EXPENSE_PATH,
  HEAT,
  INCOME_PATH,
  MONTHS,
  PERIODS,
  SEGMENTS,
  SERIES,
  buildDots,
  type Period,
  type Segment,
} from "../lib/data";
import {
  IconBag,
  IconBars,
  IconBolt,
  IconChevron,
  IconDots,
  IconDownload,
  IconPencil,
  IconPersonAdd,
  IconPlus,
  IconRefresh,
  IconSend,
  IconShuffle,
} from "./Icons";

const BAR_LEFT = [42, 96, 148, 202, 258, 314];
const HIT = "button, .date-pill, .pager, .deal";

type MenuState = {
  kind: "monthly" | "contacts";
  left: number;
  top: number;
  width: number;
};

function redraw(path: SVGPathElement | null) {
  if (!path) return;
  try {
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], {
      duration: 900,
      fill: "both",
      easing: "cubic-bezier(.3,.6,.2,1)",
    });
  } catch {
    /* getTotalLength is unhappy with a hidden path; there is nothing to draw then. */
  }
}

function cardOf(el: Element | null) {
  return el?.closest(".card") as HTMLElement | null;
}

export function Dashboard() {
  const rootRef = useRef<HTMLDivElement>(null);
  const salesRef = useRef<HTMLElement>(null);
  const quickRef = useRef<HTMLElement>(null);
  const teamRef = useRef<HTMLElement>(null);
  const bizRef = useRef<HTMLElement>(null);
  const balanceRef = useRef<HTMLElement>(null);
  const profitRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const monthlyRef = useRef<HTMLButtonElement>(null);
  const contactsRef = useRef<HTMLButtonElement>(null);
  const busy = useRef<{ buy?: boolean; invite?: boolean }>({});
  const timers = useRef<number[]>([]);
  const reduce = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  const [period, setPeriod] = useState<Period>("Monthly");
  const [segment, setSegment] = useState<Segment>("Contacts");
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [bought, setBought] = useState(false);
  const [ignored, setIgnored] = useState(false);
  const [invited, setInvited] = useState(false);
  const [biz, setBiz] = useState(0);
  const [day, setDay] = useState(0);
  const dots = useMemo(() => buildDots(), []);
  const bizNow = BUSINESSES[biz];

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /* ---- ripple: every press starts where the finger is ---- */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onDown = (e: globalThis.PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(HIT);
      if (!el || (el as HTMLButtonElement).disabled) return;

      const r = el.getBoundingClientRect();
      const sc = r.width / (el.offsetWidth || 1) || 1;
      const x = (e.clientX - r.left) / sc;
      const y = (e.clientY - r.top) / sc;
      const d = Math.max(el.offsetWidth, el.offsetHeight) * 1.5;
      const rgb = getComputedStyle(el).backgroundColor.match(/[\d.]+/g) ?? ["255", "255", "255"];
      const lum = (0.2126 * Number(rgb[0]) + 0.7152 * Number(rgb[1]) + 0.0722 * Number(rgb[2])) | 0;

      const span = document.createElement("span");
      span.className = "fx-ripple";
      span.style.cssText =
        `width:${d}px;height:${d}px;left:${x - d / 2}px;top:${y - d / 2}px;` +
        `background:${lum > 150 ? "rgba(20,19,16,.16)" : "rgba(255,255,255,.5)"}`;
      el.classList.add("fx");
      if (getComputedStyle(el).position === "static") el.classList.add("fx-rel");
      el.appendChild(span);
      window.setTimeout(() => span.remove(), 680);
    };

    root.addEventListener("pointerdown", onDown, { passive: true });
    return () => root.removeEventListener("pointerdown", onDown);
  }, []);

  /* ---- the six bars: drawn up on load, and again whenever the period changes ---- */
  useEffect(() => {
    if (reduce || !salesRef.current) return;
    const sales = salesRef.current;
    const heights = SERIES[period].bars;
    const bars = sales.querySelectorAll<HTMLElement>(".bar");

    bars.forEach((bar, i) => {
      bar.animate([{ height: "0px" }, { height: `${heights[i]}px` }], {
        duration: 600,
        delay: i * 60,
        fill: "both",
        easing: "cubic-bezier(.2,.8,.3,1)",
      });
      bar.querySelector(".node")?.animate(
        [
          { transform: "translateX(-50%) scale(.2)", opacity: 0 },
          { transform: "translateX(-50%) scale(1)", opacity: 1 },
        ],
        { duration: 360, delay: 260 + i * 60, fill: "both", easing: "cubic-bezier(.2,1.5,.4,1)" },
      );
    });
  }, [period, reduce]);

  /* ---- first-load motion: heat dots, floating tooltip ---- */
  useEffect(() => {
    if (reduce) return;
    const sales = salesRef.current;
    const heat = rootRef.current?.querySelectorAll<HTMLElement>(".heat i");
    heat?.forEach((d, i) =>
      d.animate(
        [
          { transform: "scale(.25)", opacity: 0 },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 480, delay: 120 + i * 22, fill: "both", easing: "cubic-bezier(.2,.9,.3,1.2)" },
      ),
    );

    const tip = sales?.querySelector<HTMLElement>(".tooltip");
    const float = tip?.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-2px)" }, { transform: "translateY(0)" }],
      { duration: 3200, iterations: Infinity, easing: "ease-in-out" },
    );
    return () => float?.cancel();
  }, [reduce]);

  /* ---- dropdowns ---- */
  useEffect(() => {
    if (!menu) return;
    const close = (e: globalThis.PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest(".fx-menu") || t?.closest(".monthly") || t?.closest(".contacts")) return;
      setMenu(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", close, { passive: true });
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const openAt = (kind: MenuState["kind"]) => (e: MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    setMenu((m) =>
      m?.kind === kind
        ? null
        : {
            kind,
            left: el.offsetLeft,
            top: el.offsetTop + el.offsetHeight + 6,
            width: Math.max(el.offsetWidth, 104),
          },
    );
  };

  const pickPeriod = (p: Period) => {
    setPeriod(p);
    setMenu(null);
    monthlyRef.current?.animate([{ transform: "scale(.96)" }, { transform: "scale(1)" }], {
      duration: 260,
      easing: "cubic-bezier(.2,.9,.3,1.2)",
    });
  };

  const pickSegment = (s: Segment) => {
    setSegment(s);
    setMenu(null);
    contactsRef.current?.animate([{ transform: "scale(.96)" }, { transform: "scale(1)" }], {
      duration: 260,
      easing: "cubic-bezier(.2,.9,.3,1.2)",
    });
  };

  /* ---- quick deal ---- */
  const buy = () => {
    if (busy.current.buy) return;
    busy.current.buy = true;
    setBought(true);
    quickRef.current?.querySelector<HTMLElement>(".btn-primary")?.animate(
      [{ transform: "scale(.94)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }],
      { duration: 420, easing: "cubic-bezier(.2,.8,.3,1)" },
    );
    quickRef.current?.querySelectorAll<HTMLElement>(".deal").forEach((d, i) =>
      d.animate(
        [{ borderColor: "#E8E4DC" }, { borderColor: "rgba(255,91,20,.45)" }, { borderColor: "#E8E4DC" }],
        { duration: 700, delay: i * 60, easing: "ease" },
      ),
    );
    later(() => {
      setBought(false);
      busy.current.buy = false;
    }, 1500);
  };

  const toggleIgnore = () => {
    setIgnored((v) => !v);
    quickRef.current?.querySelector<HTMLElement>(".ignore")?.animate(
      [{ transform: "scale(.95)" }, { transform: "scale(1)" }],
      { duration: 240, easing: "ease-out" },
    );
  };

  /* ---- team ---- */
  const invite = () => {
    if (busy.current.invite) return;
    busy.current.invite = true;
    setInvited(true);
    teamRef.current?.querySelector<HTMLElement>(".btn-primary")?.animate(
      [{ transform: "scale(.96)" }, { transform: "scale(1.02)" }, { transform: "scale(1)" }],
      { duration: 380, easing: "cubic-bezier(.2,.8,.3,1)" },
    );
    teamRef.current?.querySelector(".team-add svg")?.animate(
      [
        { transform: "rotate(0) scale(1)" },
        { transform: "rotate(180deg) scale(1.15)" },
        { transform: "rotate(180deg) scale(1)" },
      ],
      { duration: 520, easing: "cubic-bezier(.2,.8,.3,1)" },
    );
    later(() => {
      setInvited(false);
      busy.current.invite = false;
    }, 1500);
  };

  /* ---- pager: the numbers swap, the bars slide ---- */
  const firstBiz = useRef(true);
  useEffect(() => {
    if (firstBiz.current) {
      firstBiz.current = false;
      return;
    }
    if (reduce || !bizRef.current) return;
    bizRef.current
      .querySelectorAll<HTMLElement>(".profit-amount, .brand-name, .biz-total, .chip-mint")
      .forEach((el) =>
        el.animate(
          [
            { opacity: 0, transform: "translateY(5px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 320, fill: "both", easing: "cubic-bezier(.2,.8,.3,1)" },
        ),
      );
  }, [biz, reduce]);

  /* ---- sparkline swaps ---- */
  const shuffle = (e: MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    btn.animate([{ transform: "rotate(0)" }, { transform: "rotate(180deg)" }], {
      duration: 520,
      fill: "forwards",
      easing: "cubic-bezier(.2,.8,.3,1)",
    });
    const card = cardOf(btn);
    redraw(card?.querySelector<SVGPathElement>(".spark path") ?? null);
    card?.querySelector<HTMLElement>(".amount")?.animate(
      [
        { opacity: 0.4, transform: "translateY(3px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 420, fill: "both", easing: "cubic-bezier(.2,.8,.3,1)" },
    );
  };

  const refresh = () => {
    const card = balanceRef.current;
    if (!card) return;
    card.querySelector(".refresh svg")?.animate([{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], {
      duration: 700,
      easing: "cubic-bezier(.3,.7,.2,1)",
    });
    redraw(card.querySelector<SVGPathElement>(".spark path"));
    card.querySelector<HTMLElement>(".balance-num")?.animate(
      [
        { opacity: 0.35, filter: "blur(2px)" },
        { opacity: 1, filter: "blur(0)" },
      ],
      { duration: 520, fill: "both", easing: "ease-out" },
    );
    card.querySelector(".spark circle")?.animate(
      [
        { transform: "scale(.4)", opacity: 0 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 420, delay: 520, fill: "both", easing: "cubic-bezier(.2,1.4,.4,1)" },
    );
  };

  const stepDay = () => {
    setDay((d) => (d + 1) % DAYS.length);
    rootRef.current?.querySelector<HTMLElement>(".date-pill")?.animate(
      [{ transform: "scale(.94)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }],
      { duration: 320, easing: "cubic-bezier(.2,.8,.3,1)" },
    );
  };

  /* ---- the profit matrix leans toward the pointer ---- */
  const raf = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });

  const spotlight = () => {
    raf.current = 0;
    const grid = gridRef.current;
    if (!grid) return;
    const r = grid.getBoundingClientRect();
    const sc = r.width / grid.offsetWidth || 1;
    const x = (pointer.current.x - r.left) / sc;
    const y = (pointer.current.y - r.top) / sc;
    for (const dot of grid.children) {
      const el = dot as HTMLElement;
      const k = Math.max(0, 1 - Math.hypot(el.offsetLeft + 1.5 - x, el.offsetTop + 1.5 - y) / 86);
      el.style.transform = k > 0.02 ? `scale(${1 + k * 1.9})` : "";
    }
  };

  const onProfitMove = (e: PointerEvent<HTMLElement>) => {
    if (reduce) return;
    pointer.current = { x: e.clientX, y: e.clientY };
    if (!raf.current) raf.current = requestAnimationFrame(spotlight);
  };

  const onProfitLeave = () => {
    gridRef.current?.querySelectorAll<HTMLElement>("i").forEach((d) => {
      d.style.transform = "";
    });
  };

  const bounce = (e: MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget.querySelector(".dl-orb") as HTMLElement | null)?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(3px)" },
        { transform: "translateY(-2px)" },
        { transform: "translateY(0)" },
      ],
      { duration: 460, easing: "cubic-bezier(.2,.8,.3,1)" },
    );
  };

  const series = SERIES[period];

  return (
    <div className="app" ref={rootRef}>
      <div className="grid">
        {/* ---------- My profile ---------- */}
        <section className="card c-profile">
          <div className="hd">
            <h2>My profile</h2>
            <button className="icon-btn menu" type="button" aria-label="More options">
              <IconDots />
            </button>
          </div>

          <div className="ring outer" />
          <div className="ring inner" />
          <div className="avatar me">AK</div>

          <button className="orb dark bolt" type="button" aria-label="Boost profile">
            <IconBolt />
          </button>
          <button className="orb orange send" type="button" aria-label="Send message">
            <IconSend />
          </button>
          <button className="orb dark pencil" type="button" aria-label="Edit profile">
            <IconPencil />
          </button>
        </section>

        {/* ---------- My sales ---------- */}
        <section className="card c-sales" ref={salesRef}>
          <div className="hd">
            <h2>My sales</h2>
          </div>
          <button
            className="monthly"
            type="button"
            ref={monthlyRef}
            aria-haspopup="menu"
            aria-expanded={menu?.kind === "monthly"}
            onClick={openAt("monthly")}
          >
            {period} <IconChevron />
          </button>

          {series.bars.map((h, i) => (
            <div
              key={MONTHS[i]}
              className={`bar${i === 2 ? " sep" : ""}`}
              style={{ left: BAR_LEFT[i], top: BAR_BASE - h, height: h }}
            >
              <span className="node" />
            </div>
          ))}

          <div className="tooltip">{series.tip}</div>

          {MONTHS.map((m, i) => (
            <span key={m} className="month" style={{ left: BAR_LEFT[i] }}>
              {m}
            </span>
          ))}

          {menu?.kind === "monthly" && (
            <div className="fx-menu open" style={{ left: menu.left, top: menu.top, minWidth: menu.width }}>
              {PERIODS.map((p) => (
                <button key={p} type="button" className={p === period ? "sel" : ""} onClick={() => pickPeriod(p)}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ---------- Quick deal ---------- */}
        <section className="card c-quick" ref={quickRef}>
          <div className="hd">
            <h2>Quick deal</h2>
            <button
              className="icon-btn"
              type="button"
              aria-label="More options"
              style={{ width: 30, height: 30, marginTop: -2 }}
            >
              <IconDots />
            </button>
          </div>

          <div className={`deal${ignored ? " is-ignored" : ""}`} style={{ top: 60 }}>
            <span className="tick-dot" style={{ background: "#141310" }} />
            <span className="ticker">QVRA</span>
            <span className="price">$194.34</span>
          </div>
          <div className={`deal${ignored ? " is-ignored" : ""}`} style={{ top: 114 }}>
            <span className="tick-dot" style={{ background: "#5B76A1" }} />
            <span className="ticker">TL0X</span>
            <span className="price">$191.10</span>
          </div>

          <button
            className="icon-btn ignore"
            type="button"
            onClick={toggleIgnore}
            style={{
              position: "absolute",
              left: 20,
              top: 194,
              width: 150,
              height: 30,
              borderRadius: 15,
              background: "var(--soft)",
              color: "#8B877E",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
            }}
          >
            {ignored ? "Ignored" : "Ignore"}
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={buy}
            style={{ left: 182, top: 194, width: 146, height: 30, fontSize: 13 }}
          >
            {bought ? "✓\u00A0\u00A0Bought" : "Buy"}
          </button>
        </section>

        {/* ---------- My team ---------- */}
        <section className="card c-team" ref={teamRef}>
          <div className="hd">
            <h2>My team</h2>
            <button
              className="icon-btn"
              type="button"
              aria-label="Team info"
              style={{ width: 30, height: 30, marginTop: -2 }}
            >
              <IconBars />
            </button>
          </div>

          <button className="team-add" type="button" aria-label="Add teammate">
            <IconPersonAdd />
          </button>
          <div className="avatar team-avatar">AP</div>
          <div className="team-name">Aaron Paul</div>
          <div className="team-role">Operations</div>
          <button className="icon-btn team-edit" type="button" aria-label="Edit member">
            <IconPencil stroke="#6F6C64" />
          </button>

          <div className="card-strip">
            <span className="card-badge">CARD</span>
            <span className="card-num">5193 5253 4077 5982</span>
          </div>

          <button className="btn-primary" type="button" onClick={invite}>
            {invited ? "✓\u00A0\u00A0Invite sent" : "+\u00A0\u00A0Add member"}
          </button>
        </section>

        {/* ---------- My businesses ---------- */}
        <section className="card c-biz" ref={bizRef}>
          <div className="hd">
            <h2>My businesses</h2>
          </div>
          <button
            className="icon-btn orange tool edit"
            type="button"
            aria-label="Edit business"
            style={{ left: 270, top: 14 }}
          >
            <IconPencil />
          </button>
          <button
            className="icon-btn orange tool bag"
            type="button"
            aria-label="Business orders"
            style={{ left: 304, top: 14 }}
          >
            <IconBag />
          </button>

          <div className="profit-row">
            <span className="profit-label">Profit</span>
            <span className="profit-amount">{bizNow.amount}</span>
            <span className="profit-unit">M</span>
            <span className="chip-mint">{bizNow.chip}</span>
          </div>

          <div className="progress">
            <div className="seg1" style={{ width: bizNow.seg1 }} />
            <div className="seg2" style={{ width: bizNow.seg2 }} />
            <div className="seg3" />
          </div>

          <div className="biz-brand">
            <span className="brand-mark" />
            <span className="brand-name">{bizNow.brand}</span>
          </div>
          <div className="biz-total">{bizNow.total}</div>

          <div className="pager" role="tablist" aria-label="Businesses">
            {BUSINESSES.map((b, i) => (
              <span
                key={b.brand}
                role="tab"
                aria-selected={i === biz}
                aria-label={b.brand}
                className={i === biz ? "p1" : "p2"}
                onClick={() => i !== biz && setBiz(i)}
              />
            ))}
          </div>
        </section>

        {/* ---------- Add a business / report ---------- */}
        <div className="stack">
          <button className="cta-orange" type="button">
            <span className="plus-orb">
              <IconPlus />
            </span>
            <span className="label">Add a new business</span>
          </button>
          <button className="report" type="button" onClick={bounce}>
            <span className="dl-orb">
              <IconDownload />
            </span>
            <span className="label">Report.pdf</span>
          </button>
        </div>

        {/* ---------- My income ---------- */}
        <section className="card c-income">
          <div className="hd">
            <h2>My income</h2>
          </div>
          <button className="icon-btn orange shuffle-btn" type="button" aria-label="Convert currency" onClick={shuffle}>
            <IconShuffle />
          </button>

          <svg className="spark" viewBox="0 0 352 250" fill="none" aria-hidden="true">
            <path
              d={INCOME_PATH}
              stroke="#FF5B14"
              strokeWidth="2.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          <div className="amount-row">
            <span className="tri up" />
            <span className="amount">$3,000.02</span>
          </div>
        </section>

        {/* ---------- My expense ---------- */}
        <section className="card c-expense">
          <div className="hd">
            <h2>My expense</h2>
          </div>
          <button className="icon-btn soft shuffle-btn" type="button" aria-label="Convert currency" onClick={shuffle}>
            <IconShuffle stroke="#6E6B63" />
          </button>

          <svg className="spark" viewBox="0 0 352 250" fill="none" aria-hidden="true">
            <path
              d={EXPENSE_PATH}
              stroke="#ABA8A2"
              strokeWidth="2.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          <div className="amount-row">
            <span className="tri down" />
            <span className="amount">$2,045.07</span>
          </div>
        </section>

        {/* ---------- My balance ---------- */}
        <section className="card c-balance" ref={balanceRef}>
          <div className="hd">
            <h2>My balance</h2>
          </div>
          <button className="icon-btn refresh" type="button" aria-label="Refresh balance" onClick={refresh}>
            <IconRefresh />
          </button>

          <div
            className="date-pill"
            role="button"
            tabIndex={0}
            aria-label="Next day"
            onClick={stepDay}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                stepDay();
              }
            }}
          >
            {DAYS[day]}
          </div>

          <svg
            className="spark"
            style={{ position: "absolute", left: 0, top: 0, width: 352, height: 248 }}
            viewBox="0 0 352 248"
            fill="none"
            aria-hidden="true"
          >
            <path
              d={BALANCE_PATH}
              stroke="#FF6A2B"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx="174" cy="142" r="4.5" fill="#141310" />
          </svg>

          <div className="balance-num">$2,045.07</div>
        </section>

        {/* ---------- Transactions ---------- */}
        <section className="card c-trans">
          <div className="hd">
            <h2>Transactions</h2>
          </div>
          <div className="tx-badge">23</div>
          <button
            className="contacts"
            type="button"
            ref={contactsRef}
            aria-haspopup="menu"
            aria-expanded={menu?.kind === "contacts"}
            onClick={openAt("contacts")}
          >
            {segment} <IconChevron />
          </button>

          <div className="tx-count">13</div>
          <div className="avatar-row">
            {[
              ["#EF6B2E", "AK"],
              ["#3F6EA8", "MR"],
              ["#4C7F5C", "SU"],
              ["#977AC2", "TN"],
              ["#EF7B3C", "LP"],
              ["#3D5C8C", "DV"],
            ].map(([bg, initials]) => (
              <span key={initials} className="mini" style={{ background: bg }}>
                {initials}
              </span>
            ))}
          </div>

          <div className="heat" aria-hidden="true">
            {HEAT.map((bg, i) => (
              <i key={i} style={{ background: bg }} />
            ))}
          </div>

          {menu?.kind === "contacts" && (
            <div className="fx-menu open" style={{ left: menu.left, top: menu.top, minWidth: menu.width }}>
              {SEGMENTS.map((s) => (
                <button key={s} type="button" className={s === segment ? "sel" : ""} onClick={() => pickSegment(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ---------- Profit statistics ---------- */}
        <section className="card c-profit" ref={profitRef} onPointerMove={onProfitMove} onPointerLeave={onProfitLeave}>
          <div className="hd">
            <h2>Profit statistics</h2>
          </div>
          <div className="goal">
            Your goal <b>60%</b>
          </div>

          <div className="stat-labels">
            <span>Opening</span>
            <span>In period</span>
            <span>Other</span>
          </div>
          <div className="stat-values">
            <span>$232.82</span>
            <span>$330.02</span>
            <span>$192.12</span>
          </div>

          <div className="dots-grid" ref={gridRef} aria-hidden="true">
            {dots.map((bg, i) => (
              <i key={i} style={{ background: bg }} />
            ))}
          </div>

          <div className="net">
            <span className="net-orb">
              <IconDownload />
            </span>
            <span className="net-label">Net profit</span>
            <span className="net-value">$754.94</span>
          </div>

          <div className="accountant">
            <span className="acc-avatar">AR</span>
            <span className="acc-name">Ariana Khouri</span>
            <span className="acc-role">Accountant</span>
          </div>
        </section>
      </div>
    </div>
  );
}
