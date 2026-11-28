import { useState, type ReactNode } from "react";

/* ---------------------------------------------------------------- */
/* Icons                                                             */
/* ---------------------------------------------------------------- */

type IconProps = { className?: string };

function BaseIcon({ children, className = "h-4 w-4" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const makeIcon = (paths: ReactNode) =>
  function Icon({ className }: IconProps) {
    return <BaseIcon className={className}>{paths}</BaseIcon>;
  };

const ArrowUpIcon = makeIcon(
  <>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </>
);
const ArrowRightIcon = makeIcon(
  <>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </>
);
const MessageIcon = makeIcon(
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
);
const DotsIcon = makeIcon(
  <>
    <circle cx="5" cy="12" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    <circle cx="19" cy="12" r="1.3" fill="currentColor" />
  </>
);
const EyeIcon = makeIcon(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </>
);
const EyeOffIcon = makeIcon(
  <>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
  </>
);
const SearchIcon = makeIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </>
);
const PlusIcon = makeIcon(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
);
const CheckIcon = makeIcon(<path d="M20 6 9 17l-5-5" />);
const XIcon = makeIcon(
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>
);
const StarIcon = makeIcon(
  <path d="M12 2.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7-5.4-4.7 7.1-.6z" />
);
const TicketIcon = makeIcon(
  <>
    <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
    <path d="M14 6v12" strokeDasharray="2 2" />
  </>
);
const BagIcon = makeIcon(
  <>
    <path d="M5 8h14l-1 12H6z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </>
);
const CoinIcon = makeIcon(
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v8M9.5 10.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.5-1 1.4-2.5 1.6-2.5.7-2.5 1.6 1 1.5 2.5 1.5 2.5-.5 2.5-1.5" />
  </>
);
const ListIcon = makeIcon(
  <>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </>
);
const WarnIcon = makeIcon(
  <>
    <path d="M12 3 2 21h20z" />
  </>
);

/* ---------------------------------------------------------------- */
/* Data                                                              */
/* ---------------------------------------------------------------- */

const CURRENCIES = {
  USD: { locale: "en-US", rate: 1 },
  IDR: { locale: "id-ID", rate: 15800 },
  MYR: { locale: "ms-MY", rate: 4.45 },
} as const;
type Currency = keyof typeof CURRENCIES;

const BASE_BALANCE = 92142.1;
const NAV_ITEMS = ["Overview", "Wealth", "Cards", "Tools"];

const SPENDING = {
  total: 916.1,
  percent: 62,
  note: "Rent is up",
  noteValue: "8.4%",
  legend: [
    { label: "Rent", value: 500.02, color: "#3f6b26" },
    { label: "Transport", value: 217.0, color: "#aab5a3" },
    { label: "Food", value: 100.0, color: "#c9d2c3" },
    { label: "Leisure", value: 100.0, color: "#dfe4db" },
  ],
};

const EARNINGS = [
  { label: "Investment", value: 2000, pct: 25 },
  { label: "Salary", value: 4000, pct: 51 },
  { label: "Freelance", value: 1335.01, pct: 17 },
  { label: "Other", value: 486, pct: 6 },
];

type Transaction = {
  id: number;
  name: string;
  meta: string;
  metaTone: "positive" | "muted";
  amount?: number;
  initial: string;
  avatar: string;
  pending?: boolean;
};

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 1,
    name: "Cloverend subscription",
    meta: "Payment confirmation",
    metaTone: "positive",
    initial: "N",
    avatar: "from-[#5b8def] to-[#3457c9]",
    pending: true,
  },
  {
    id: 2,
    name: "Salary payment",
    meta: "Today, 09:00",
    metaTone: "muted",
    amount: 5000,
    initial: "S",
    avatar: "from-[#5fb37a] to-[#2f8a4d]",
  },
  {
    id: 3,
    name: "Hardware purchase",
    meta: "Yesterday, 14:30",
    metaTone: "muted",
    amount: -4000,
    initial: "H",
    avatar: "from-[#3b423e] to-[#1b201d]",
  },
  {
    id: 4,
    name: "Refund — wallet",
    meta: "Apr 1, 2026",
    metaTone: "muted",
    amount: 120,
    initial: "R",
    avatar: "from-[#c99263] to-[#9a6236]",
  },
];

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const formatBalance = (currency: Currency) =>
  new Intl.NumberFormat(CURRENCIES[currency].locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(BASE_BALANCE * CURRENCIES[currency].rate);

/* ---------------------------------------------------------------- */
/* Shared styles                                                     */
/* ---------------------------------------------------------------- */

const CARD =
  "rounded-[28px] border border-white/80 bg-gradient-to-b from-white to-white/80 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_-14px_rgba(0,0,0,0.12)]";
const ICON_CHIP = "flex h-7 w-7 items-center justify-center rounded-full bg-[#eef1ec] text-slate-500";
const ICON_BTN =
  "flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-black/5";
const LIME = "#9dd04b";

/* ---------------------------------------------------------------- */
/* Header                                                            */
/* ---------------------------------------------------------------- */

function Header({ active, onChange }: { active: string; onChange: (item: string) => void }) {
  return (
    <header className="mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-[#f2b77a] via-[#d98a4b] to-[#7a4a2a] ring-2 ring-white" />
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Hello, Amara</h1>
      </div>

      <nav className="hidden items-center gap-1 md:flex">
        {NAV_ITEMS.map((item) => {
          const isActive = item === active;
          return (
            <button
              key={item}
              onClick={() => onChange(item)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                isActive ? "bg-[#b8e26a] text-slate-900 shadow-sm" : "text-slate-600 hover:bg-black/5"
              }`}
            >
              {item}
            </button>
          );
        })}
      </nav>

      <button
        aria-label="Search"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:shadow"
      >
        <SearchIcon className="h-4 w-4" />
      </button>
    </header>
  );
}

/* ---------------------------------------------------------------- */
/* Balance & Rewards                                                 */
/* ---------------------------------------------------------------- */

function BalanceCard() {
  const [currency, setCurrency] = useState<Currency>("USD");
  const [hidden, setHidden] = useState(false);

  return (
    <div className={`${CARD} relative flex min-h-[285px] flex-col justify-between p-5`}>
      <div className="flex items-start justify-between">
        <div className="inline-flex rounded-full bg-[#eeefeb] p-1">
          {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                c === currency ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Account number</p>
          <p className="mt-1 text-sm font-semibold tracking-wide text-slate-900">9034 0222 748</p>
        </div>
      </div>

      <div>
        <p className="text-sm text-slate-500">Active balance</p>
        <div className="mt-2 flex items-center gap-3">
          <p className="text-[44px] font-bold leading-none tracking-tight text-slate-900 md:text-[48px]">
            {hidden ? "••••••••" : formatBalance(currency)}
          </p>
          <button
            onClick={() => setHidden((h) => !h)}
            aria-label={hidden ? "Show balance" : "Hide balance"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f2ee] text-slate-500 transition hover:bg-[#e4e8e1]"
          >
            {hidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 pr-16">
        <button className="flex items-center gap-2 rounded-full bg-[#14221a] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#1f3327]">
          <ArrowUpIcon className="h-4 w-4" />
          Transfer
        </button>
        <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50">
          <MessageIcon className="h-4 w-4" />
          Request
        </button>
        <button
          aria-label="More actions"
          className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
        >
          <DotsIcon className="h-4 w-4" />
        </button>
      </div>

      <button
        aria-label="Go"
        className="absolute bottom-5 right-5 flex h-14 w-14 items-center justify-center rounded-full text-slate-900 shadow-md transition hover:scale-105"
        style={{ backgroundColor: LIME }}
      >
        <ArrowRightIcon className="h-6 w-6" />
      </button>
    </div>
  );
}

function RewardsCard() {
  return (
    <div
      className="relative flex min-h-[285px] flex-col overflow-hidden rounded-[28px] p-5 text-[#0f1a12] shadow-[0_12px_32px_-14px_rgba(90,140,20,0.45)]"
      style={{ background: "linear-gradient(135deg, #add95f 0%, #9bd24c 45%, #8cc83e 100%)" }}
    >
      {/* decorative sparkle */}
      <svg
        className="pointer-events-none absolute right-[70px] top-[18px] h-[190px] w-[190px] text-white/25"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <path d="M50 0C55 35 65 45 100 50C65 55 55 65 50 100C45 65 35 55 0 50C35 45 45 35 50 0Z" fill="currentColor" />
      </svg>

      <div className="relative flex items-center justify-between">
        <button className="flex items-center gap-2 rounded-full bg-[#14221a] py-2 pl-4 pr-2 text-sm font-semibold text-white shadow-sm">
          Priority
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15">
            <PlusIcon className="h-3 w-3" />
          </span>
        </button>
        <button aria-label="More" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/35 text-slate-800 transition hover:bg-white/50">
          <DotsIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-8">
        <p className="text-sm text-slate-800/70">Your rewards</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-[44px] font-bold leading-none tracking-tight md:text-[48px]">$12,172.07</p>
          <span className="rounded-full bg-white/40 px-3 py-1.5 text-xs font-semibold text-slate-900">
            +40% this month
          </span>
        </div>
      </div>

      <div className="relative mt-auto grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-2xl bg-white/40 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/60">
              <StarIcon className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm text-slate-800">Loyalty points</span>
          </div>
          <span className="text-sm font-semibold">4,780</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-white/40 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/60">
              <TicketIcon className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm text-slate-800">Vouchers</span>
          </div>
          <span className="text-sm font-semibold">124</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Lower panels                                                      */
/* ---------------------------------------------------------------- */

function SpendingCard() {
  const R = 62;
  const C = 2 * Math.PI * R;
  const dash = (SPENDING.percent / 100) * C;

  return (
    <div className={`${CARD} flex min-h-[380px] flex-col p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={ICON_CHIP}>
            <BagIcon className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-base font-semibold text-slate-900">Spending</h2>
        </div>
        <button className="rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-sm text-slate-700">
          April
        </button>
      </div>

      <div className="relative mx-auto mt-8 flex h-[150px] w-[150px] items-center justify-center">
        <svg viewBox="0 0 150 150" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <circle cx="75" cy="75" r={R} fill="none" stroke="#e4e6e2" strokeWidth={14} />
          <circle
            cx="75"
            cy="75"
            r={R}
            fill="none"
            stroke="#8ec43f"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            transform="rotate(-90 75 75)"
          />
        </svg>
        <div className="text-center">
          <p className="text-2xl font-semibold tracking-tight text-slate-900">{usd(SPENDING.total)}</p>
          <p className="text-sm font-medium text-[#5d9a26]">+12%</p>
        </div>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <StarIcon className="h-3 w-3 text-slate-500" />
        {SPENDING.note} <span className="font-semibold text-slate-700">{SPENDING.noteValue}</span> on last month
      </p>

      <div className="mt-auto grid grid-cols-2 gap-x-6 gap-y-3 pt-8 text-xs">
        {SPENDING.legend.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
            <span className="font-medium text-slate-800">{usd(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EarningCard() {
  return (
    <div className={`${CARD} flex min-h-[380px] flex-col p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={ICON_CHIP}>
            <CoinIcon className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-base font-semibold text-slate-900">Earning</h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <CoinIcon className="h-3 w-3 text-slate-500" />
          {usd(8400)}
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
            <span className="block h-full w-[60%] rounded-full" style={{ backgroundColor: LIME }} />
          </span>
        </div>
      </div>

      <div className="mt-7 text-center">
        <p className="text-[34px] font-semibold tracking-tight text-slate-900">$7,110.12</p>
        <p className="mt-1 text-xs text-slate-500">+18% vs last month</p>
      </div>

      <div className="mt-7 space-y-4">
        {EARNINGS.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">{item.label}</span>
              <span className="font-medium text-slate-900">{usd(item.value)}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-slate-200/80">
              <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: LIME }} />
              {item.pct >= 40 && (
                <span
                  className="absolute top-1/2 -translate-y-1/2 rounded-full bg-[#14221a] px-2 py-0.5 text-[10px] font-semibold text-white"
                  style={{ left: `calc(${item.pct}% - 22px)` }}
                >
                  {item.pct}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionsCard({
  transactions,
  onConfirm,
  onDismiss,
}: {
  transactions: Transaction[];
  onConfirm: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  return (
    <div className={`${CARD} flex min-h-[380px] flex-col p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={ICON_CHIP}>
            <ListIcon className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-base font-semibold text-slate-900">Transactions</h2>
        </div>
        <button aria-label="More" className={ICON_BTN}>
          <DotsIcon className="h-4 w-4" />
        </button>
      </div>

      <ul className="mt-5 space-y-3">
        {transactions.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${t.avatar} text-sm font-semibold text-white`}
            >
              {t.initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{t.name}</p>
              <p
                className={`mt-0.5 text-xs ${
                  t.metaTone === "positive" ? "font-medium text-[#5d9a26]" : "text-slate-500"
                }`}
              >
                {t.meta}
              </p>
            </div>

            {t.pending ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onConfirm(t.id)}
                  aria-label="Confirm payment"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8fc540] text-white shadow-sm transition hover:bg-[#7fb530]"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDismiss(t.id)}
                  aria-label="Dismiss"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:text-slate-700"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              t.amount !== undefined && (
                <p
                  className={`shrink-0 text-sm font-semibold ${
                    t.amount > 0 ? "text-[#5d9a26]" : "text-[#c2412d]"
                  }`}
                >
                  {t.amount > 0 ? "+" : "-"}
                  {usd(Math.abs(t.amount))}
                </p>
              )
            )}
          </li>
        ))}
      </ul>

      {transactions.length === 0 && (
        <div className="mt-auto flex flex-col items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <WarnIcon className="h-5 w-5" />
          No pending transactions
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* App                                                               */
/* ---------------------------------------------------------------- */

export default function App() {
  const [active, setActive] = useState("Overview");
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);

  const confirm = (id: number) =>
    setTransactions((list) =>
      list.map((t) => (t.id === id ? { ...t, pending: false, meta: "Confirmed · just now", metaTone: "positive" } : t))
    );

  const dismiss = (id: number) => setTransactions((list) => list.filter((t) => t.id !== id));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f1f2ef] via-[#e8eae5] to-[#dcdfd8] p-4 text-slate-900 antialiased sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px]">
        <Header active={active} onChange={setActive} />

        <section className="grid gap-5 lg:grid-cols-[0.88fr_1fr]">
          <BalanceCard />
          <RewardsCard />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.92fr_1fr_1.42fr]">
          <SpendingCard />
          <EarningCard />
          <TransactionsCard transactions={transactions} onConfirm={confirm} onDismiss={dismiss} />
        </section>
      </div>
    </div>
  );
}
