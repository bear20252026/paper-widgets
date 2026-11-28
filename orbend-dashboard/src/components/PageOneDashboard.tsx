import React, { useState } from 'react';
import {
  Bell,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Download,
  Clock,
  MoreHorizontal,
  X,
  Check,
} from 'lucide-react';

interface PageOneDashboardProps {
  onNavigateToPageTwo?: () => void;
}

export const PageOneDashboard: React.FC<PageOneDashboardProps> = ({
  onNavigateToPageTwo,
}) => {
  const [activeNav, setActiveNav] = useState<string>('Dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quotesCount, setQuotesCount] = useState<number>(127);
  const [selectedDay, setSelectedDay] = useState<string>('Wed 13');
  const [showStandupCard, setShowStandupCard] = useState<boolean>(true);
  const [joinedCall, setJoinedCall] = useState<boolean>(false);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  const navItems = ['Dashboard', 'Projects', 'Clients', 'Quotes', 'Schedule', 'Notes'];

  const dealBars = [
    { month: 'Jun', value: 145, heightPct: 54, active: false },
    { month: 'Jul', value: 174, heightPct: 67, active: false },
    { month: 'Aug', value: 132, heightPct: 49, active: false },
    { month: 'Sep', value: 232, heightPct: 86, active: true },
    { month: 'Oct', value: 162, heightPct: 61, active: false },
    { month: 'Nov', value: 192, heightPct: 74, active: false },
    { month: 'Dec', value: 138, heightPct: 52, active: false },
  ];

  const days = ['Mon 11', 'Tue 12', 'Wed 13', 'Thu 14', 'Fri 15', 'Sat 16', 'Sun 17'];

  // Slot types: 'orange' (#F35B16), 'peach' (#FCE3D4), 'gray' (#F2F1ED)
  const scheduleRows: {
    time: string;
    slots: ('orange' | 'peach' | 'gray')[];
  }[] = [
    {
      time: '8 AM',
      slots: ['orange', 'gray', 'gray', 'orange', 'peach', 'gray', 'gray'],
    },
    {
      time: '12 PM',
      slots: ['gray', 'gray', 'orange', 'peach', 'gray', 'gray', 'gray'],
    },
    {
      time: '5 PM',
      slots: ['gray', 'orange', 'peach', 'gray', 'orange', 'gray', 'gray'],
    },
  ];

  return (
    <div className="w-full max-w-[1240px] mx-auto select-none">
      {/* Outer silver-gray tablet/desktop bezel matching reference screenshot */}
      <div className="bg-[#D7D7D5] p-[10px] sm:p-[13px] rounded-[34px] shadow-[0_25px_70px_rgba(0,0,0,0.45)] border border-white/30">
        {/* Inner warm off-white canvas */}
        <div className="bg-[#F7F6F2] rounded-[24px] px-5 sm:px-7 py-5 sm:py-6 text-[#1B1B1B] relative overflow-hidden">
          {/* Optional subtle interactive toast */}
          {toastMessage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1B1B1B] text-white text-[11.5px] font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-[#F35B16]" />
              {toastMessage}
            </div>
          )}

          {/* ================= ROW 1: TOP NAVIGATION BAR ================= */}
          <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
            {/* Brand Logo */}
            <div
              onClick={() => setActiveNav('Dashboard')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-[27px] h-[27px] rounded-[8px] bg-[#F35B16] flex items-center justify-center shadow-[0_2px_8px_rgba(243,91,22,0.35)] group-hover:scale-105 transition-transform">
                {/* 4-point star sparkle icon */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2C12.4 7.2 16.8 11.6 22 12C16.8 12.4 12.4 16.8 12 22C11.6 16.8 7.2 12.4 2 12C7.2 11.6 11.6 7.2 12 2Z"
                    fill="white"
                  />
                </svg>
              </div>
              <span className="text-[15.5px] font-bold tracking-[-0.02em] text-[#1B1B1B]">
                Orbend
              </span>
            </div>

            {/* Center Navigation Pill */}
            <nav className="bg-[#FDFCFA] border border-[#ECEAE4] rounded-full p-[3.5px] flex items-center gap-0.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-x-auto">
              {navItems.map((item) => {
                const isActive = activeNav === item;
                return (
                  <button
                    key={item}
                    onClick={() => {
                      setActiveNav(item);
                      if (item === 'Quotes' && onNavigateToPageTwo) {
                        triggerToast('Switched to Quotes / Sales Overview');
                      }
                    }}
                    className={`px-3.5 py-[6px] rounded-full text-[11.5px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#1B1B1B] text-white shadow-xs'
                        : 'text-[#6E6C66] hover:text-[#1B1B1B]'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </nav>

            {/* Right Utility Icons & User Avatar */}
            <div className="flex items-center gap-2">
              {/* Notification Bell with orange "2" badge */}
              <button
                onClick={() => triggerToast('2 unread workspace notifications')}
                className="w-[34px] h-[34px] rounded-full bg-[#F1F0EC] border border-[#E6E4DD] flex items-center justify-center relative hover:bg-[#EAE8E2] transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-[14px] h-[14px] text-[#2C2C2A]" strokeWidth={1.9} />
                <span className="absolute -top-0.5 -right-0.5 w-[14px] h-[14px] rounded-full bg-[#F35B16] text-white text-[8.5px] font-bold flex items-center justify-center leading-none shadow-xs">
                  2
                </span>
              </button>

              {/* 8-Ray Sunburst / Sparkle Icon Button */}
              <button
                onClick={() => {
                  if (onNavigateToPageTwo) {
                    onNavigateToPageTwo();
                  } else {
                    triggerToast('Workspace integrations synced');
                  }
                }}
                className="w-[34px] h-[34px] rounded-full bg-[#F1F0EC] border border-[#E6E4DD] flex items-center justify-center hover:bg-[#EAE8E2] transition-colors cursor-pointer"
                title="Sales Overview / Settings"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                   stroke="#2C2C2A"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <line x1="12" y1="3" x2="12" y2="21" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
                  <line x1="18.4" y1="5.6" x2="5.6" y2="18.4" />
                </svg>
              </button>

              {/* User Avatar AK */}
              <button
                onClick={() => triggerToast('Signed in as Alex K. (Admin)')}
                className="w-[34px] h-[34px] rounded-full bg-[#ED7944] text-white text-[11px] font-semibold flex items-center justify-center shadow-xs hover:brightness-95 transition-all cursor-pointer"
              >
                AK
              </button>
            </div>
          </header>

          {/* ================= ROW 2: SEARCH BAR & 3 KPI METRICS ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end mb-6">
            {/* Left: Large Search Input (spans 7 cols on lg) */}
            <div className="lg:col-span-7 border-b border-[#E5E3DC] pb-3 flex items-center justify-between gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    triggerToast(`Searching "${searchQuery}" across deals & clients...`);
                  }
                }}
                placeholder="Search something..."
                className="w-full bg-transparent text-[24px] sm:text-[27px] font-normal text-[#1B1B1B] placeholder:text-[#9D9B94] tracking-[-0.025em] outline-none leading-tight"
              />
              <button
                onClick={() =>
                  triggerToast(
                    searchQuery.trim()
                      ? `Searching for "${searchQuery}"`
                      : 'Type a deal, client, or quote to search'
                  )
                }
                className="w-[31px] h-[31px] rounded-full bg-[#EFECE6] hover:bg-[#E5E2DC] flex items-center justify-center text-[#2B2B29] shrink-0 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-[14px] h-[14px]" strokeWidth={1.9} />
              </button>
            </div>

            {/* Right: 3 KPI Metrics (spans 5 cols on lg) */}
            <div className="lg:col-span-5 flex items-center justify-between sm:justify-end gap-5 sm:gap-7 pb-1">
              {/* KPI 1: Project deals */}
              <div>
                <p className="text-[10.5px] font-medium text-[#7E7C75] mb-1.5">
                  Project deals
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[24px] sm:text-[26px] font-semibold text-[#1B1B1B] tracking-[-0.03em] leading-none">
                    1,368
                  </span>
                  <span className="bg-[#E3F2EA] text-[#35845B] text-[9.5px] font-semibold px-2 py-[2.5px] rounded-full leading-none">
                    +18%
                  </span>
                </div>
              </div>

              {/* KPI 2: Active clients */}
              <div>
                <p className="text-[10.5px] font-medium text-[#7E7C75] mb-1.5">
                  Active clients
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[24px] sm:text-[26px] font-semibold text-[#1B1B1B] tracking-[-0.03em] leading-none">
                    593
                  </span>
                  <span className="bg-[#FCEAE6] text-[#C85D4D] text-[9.5px] font-semibold px-2 py-[2.5px] rounded-full leading-none">
                    -5%
                  </span>
                </div>
              </div>

              {/* KPI 3: Quotes sent */}
              <div>
                <p className="text-[10.5px] font-medium text-[#7E7C75] mb-1.5">
                  Quotes sent
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[24px] sm:text-[26px] font-semibold text-[#1B1B1B] tracking-[-0.03em] leading-none">
                    960
                  </span>
                  <span className="bg-[#E3F2EA] text-[#35845B] text-[9.5px] font-semibold px-2 py-[2.5px] rounded-full leading-none">
                    +12%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ================= MAIN BENTO GRID (2 MACRO COLUMNS) ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* ---------- LEFT MACRO COLUMN (4/12): Integration health + Project deals ---------- */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* CARD 1: Integration health */}
              <div className="bg-white rounded-[22px] p-5 border border-[#ECEAE4] orbend-card-shadow flex flex-col justify-between h-[236px]">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-[14.5px] font-semibold text-[#1B1B1B] tracking-[-0.01em]">
                    Integration health
                  </h2>
                  <button
                    onClick={() => triggerToast('Add new workspace integration')}
                    className="w-[27px] h-[27px] rounded-full bg-[#F5F4F0] hover:bg-[#EAE8E2] flex items-center justify-center text-[#3D3C38] transition-colors cursor-pointer"
                  >
                    <Plus className="w-[13px] h-[13px]" strokeWidth={2} />
                  </button>
                </div>

                {/* Middle: Response Time + Speedometer Arc Gauge */}
                <div className="flex items-center justify-between my-1">
                  <div>
                    <p className="text-[10.5px] text-[#8A8881] mb-1">Avg. response</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[29px] font-semibold text-[#1B1B1B] tracking-[-0.03em] leading-none">
                        368
                      </span>
                      <span className="bg-[#E3F2EA] text-[#35845B] text-[9.5px] font-semibold px-2 py-[2.5px] rounded-full leading-none">
                        Fast
                      </span>
                    </div>
                    <p className="text-[10.5px] text-[#8A8881] mt-1.5">milliseconds</p>
                  </div>

                  {/* Speedometer Arc SVG */}
                  <div className="w-[128px] h-[84px] relative flex items-center justify-center mr-1">
                    <svg
                      viewBox="0 0 130 88"
                      className="w-full h-full overflow-visible"
                    >
                      {/* Gray background arch */}
                      <path
                        d="M 22 74 A 46 46 0 1 1 108 74"
                        pathLength="100"
                        fill="none"
                        stroke="#ECEAE4"
                        strokeWidth="12.5"
                        strokeLinecap="round"
                      />
                      {/* Active soft coral-orange arch (68% of the exact same path) */}
                      <path
                        d="M 22 74 A 46 46 0 1 1 108 74"
                        pathLength="100"
                        strokeDasharray="68 100"
                        fill="none"
                        stroke="#F4936A"
                        strokeWidth="12.5"
                        strokeLinecap="round"
                      />
                      {/* Sharp dark needle pointing to upper-right junction */}
                      <g transform="translate(65, 65)">
                        <path
                          d="M -2.4 -1.6 L 28 -25 L 2.4 1.6 Z"
                          fill="#1B1B1B"
                        />
                        <circle
                          cx="0"
                          cy="0"
                          r="3.2"
                          fill="#FFFFFF"
                          stroke="#1B1B1B"
                          strokeWidth="2.2"
                        />
                      </g>
                    </svg>
                  </div>
                </div>

                {/* Bottom: 3 Status Dots + Workspace app pill */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  {/* 3 circular integration badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Circle 1: Green + 15 */}
                    <div className="w-[33px] h-[33px] rounded-full bg-[#F2F1ED] relative flex items-center justify-center">
                      <span className="w-[9px] h-[9px] rounded-full bg-[#2E9B63]" />
                      <span className="absolute -top-1 -right-0.5 bg-[#FAD8C6] text-[#B85226] text-[7.5px] font-bold px-1 py-[0.5px] rounded-full leading-tight">
                        15
                      </span>
                    </div>
                    {/* Circle 2: Blue + 9 */}
                    <div className="w-[33px] h-[33px] rounded-full bg-[#F2F1ED] relative flex items-center justify-center">
                      <span className="w-[9px] h-[9px] rounded-full bg-[#3E63DD]" />
                      <span className="absolute -top-1 -right-0.5 bg-[#FAD8C6] text-[#B85226] text-[7.5px] font-bold px-1 py-[0.5px] rounded-full leading-tight">
                        9
                      </span>
                    </div>
                    {/* Circle 3: Purple + 4 */}
                    <div className="w-[33px] h-[33px] rounded-full bg-[#F2F1ED] relative flex items-center justify-center">
                      <span className="w-[9px] h-[9px] rounded-full bg-[#7C3AED]" />
                      <span className="absolute -top-1 -right-0.5 bg-[#FAD8C6] text-[#B85226] text-[7.5px] font-bold px-1 py-[0.5px] rounded-full leading-tight">
                        4
                      </span>
                    </div>
                  </div>

                  {/* Workspace app pill */}
                  <div
                    onClick={() => triggerToast('Opening Workspace app (16 new messages)')}
                    className="bg-[#F2F1ED] hover:bg-[#EAE8E2] transition-colors rounded-full pl-3 pr-1.5 py-1.5 flex items-center justify-between gap-2 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Tiny orange 4-point star */}
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="#F35B16"
                        className="shrink-0"
                      >
                        <path d="M12 2C12.5 7.5 16.5 11.5 22 12C16.5 12.5 12.5 16.5 12 22C11.5 16.5 7.5 12.5 2 12C7.5 11.5 11.5 7.5 12 2Z" />
                      </svg>
                      <div className="truncate">
                        <p className="text-[10px] font-semibold text-[#1B1B1B] leading-tight truncate">
                          Workspace app
                        </p>
                        <p className="text-[8.5px] text-[#8A8881] leading-tight truncate">
                          16 new messages
                        </p>
                      </div>
                    </div>
                    <div className="w-[22px] h-[22px] rounded-full bg-[#1B1B1B] text-white flex items-center justify-center shrink-0">
                      <ArrowUpRight className="w-[11px] h-[11px]" strokeWidth={2.2} />
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 2: Project deals (7-month bar chart) */}
              <div className="bg-white rounded-[22px] p-5 border border-[#ECEAE4] orbend-card-shadow flex flex-col justify-between h-[244px]">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-[14.5px] font-semibold text-[#1B1B1B] tracking-[-0.01em]">
                    Project deals
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => triggerToast('Filtering: Last 7 months')}
                      className="bg-[#F6F5F1] border border-[#E8E6DF] text-[10px] font-medium text-[#575653] px-3 py-1 rounded-full hover:bg-[#EFECE6] transition-colors cursor-pointer"
                    >
                      Last 7 months
                    </button>
                    <button
                      onClick={() => triggerToast('Exported Project Deals CSV')}
                      className="w-[27px] h-[27px] rounded-full bg-[#F6F5F1] border border-[#E8E6DF] hover:bg-[#EFECE6] flex items-center justify-center text-[#4A4945] transition-colors cursor-pointer"
                      title="Download CSV"
                    >
                      <Download className="w-[12px] h-[12px]" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* Chart Body */}
                <div className="flex items-end gap-3 h-[158px] pt-4">
                  {/* Y-Axis Labels */}
                  <div className="flex flex-col justify-between h-[122px] pb-5 text-[9.5px] text-[#A2A099] font-medium select-none shrink-0">
                    <span>250</span>
                    <span>200</span>
                    <span>150</span>
                    <span>100</span>
                  </div>

                  {/* Bars Container with faint horizontal grid lines */}
                  <div className="flex-1 h-full flex flex-col justify-end relative">
                    {/* Horizontal grid lines */}
                    <div className="absolute inset-x-0 top-[14px] bottom-[22px] flex flex-col justify-between pointer-events-none">
                      <div className="border-b border-[#F2F1ED] w-full" />
                      <div className="border-b border-[#F2F1ED] w-full" />
                      <div className="border-b border-[#F2F1ED] w-full" />
                      <div className="border-b border-[#F2F1ED] w-full" />
                    </div>

                    {/* 7 Pill Bars */}
                    <div className="grid grid-cols-7 gap-2.5 items-end h-[132px] relative z-10 px-0.5">
                      {dealBars.map((bar) => {
                        const isHighlighted =
                          hoveredMonth ? hoveredMonth === bar.month : bar.active;
                        return (
                          <div
                            key={bar.month}
                            onMouseEnter={() => setHoveredMonth(bar.month)}
                            onMouseLeave={() => setHoveredMonth(null)}
                            className="flex flex-col items-center justify-end h-full group cursor-pointer"
                          >
                            {/* Floating dark pill badge for active/hovered bar */}
                            <div className="h-[22px] flex items-center justify-center mb-1">
                              {isHighlighted && (
                                <span className="bg-[#1B1B1B] text-white text-[9.5px] font-semibold px-2.5 py-[2.5px] rounded-full leading-none shadow-xs">
                                  {bar.value}
                                </span>
                              )}
                            </div>

                            {/* Pill Bar */}
                            <div
                              style={{ height: `${bar.heightPct}%` }}
                              className={`w-full max-w-[30px] rounded-full transition-all duration-200 ${
                                isHighlighted
                                  ? 'bg-[#F35B16] shadow-[0_4px_12px_rgba(243,91,22,0.3)]'
                                  : 'hatched-bar'
                              }`}
                            />

                            {/* Month Label */}
                            <span
                              className={`text-[9.5px] mt-2 leading-none ${
                                isHighlighted
                                  ? 'font-semibold text-[#1B1B1B]'
                                  : 'text-[#8E8C85]'
                              }`}
                            >
                              {bar.month}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ---------- RIGHT MACRO COLUMN (8/12): 3 Top Cards + Meeting Schedule ---------- */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              {/* TOP SUB-ROW: Manage quotes (3) + Meeting notes (3) + Clients by region (6) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* CARD 3B: Manage quotes (Vibrant Orange Card) */}
                <div className="sm:col-span-3 bg-[#F35B16] rounded-[22px] p-4.5 text-white flex flex-col justify-between h-[236px] relative overflow-hidden shadow-[0_8px_24px_-4px_rgba(243,91,22,0.35)]">
                  {/* Subtle warm highlight at top-right */}
                  <div className="w-24 h-24 rounded-full bg-white/10 blur-xl absolute -top-6 -right-6 pointer-events-none" />

                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-[14.5px] font-medium text-white leading-[1.2] tracking-[-0.01em]">
                        Manage
                        <br />
                        quotes
                      </h2>
                      <button
                        onClick={() => {
                          if (onNavigateToPageTwo) onNavigateToPageTwo();
                          else triggerToast('Opening Quotes Manager');
                        }}
                        className="w-[26px] h-[26px] rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
                      >
                        <ArrowUpRight className="w-[12px] h-[12px]" strokeWidth={2} />
                      </button>
                    </div>

                    {/* + Create new pill button */}
                    <button
                      onClick={() => {
                        setQuotesCount((c) => c + 1);
                        triggerToast('Created new quote draft (#128)');
                      }}
                      className="mt-4 bg-[#1B1B1B] hover:bg-[#2B2B2B] text-white text-[10.5px] font-medium px-3.5 py-2 rounded-full inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      <Plus className="w-[11px] h-[11px]" strokeWidth={2.3} />
                      <span>Create new</span>
                    </button>
                  </div>

                  {/* Bottom stat: 127 average in a month */}
                  <div className="flex items-baseline gap-2 pt-2">
                    <span className="text-[35px] font-semibold text-white tracking-[-0.03em] leading-none">
                      {quotesCount}
                    </span>
                    <span className="text-[9.5px] text-white/85 leading-[1.25] font-normal">
                      average in a
                      <br />
                      month
                    </span>
                  </div>
                </div>

                {/* CARD 3C: Meeting notes */}
                <div className="sm:col-span-3 bg-white rounded-[22px] p-4.5 border border-[#ECEAE4] orbend-card-shadow flex flex-col justify-between h-[236px]">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-[14.5px] font-semibold text-[#1B1B1B] tracking-[-0.01em]">
                      Meeting notes
                    </h2>
                    <button
                      onClick={() => triggerToast('New meeting note created')}
                      className="w-[26px] h-[26px] rounded-full bg-[#F5F4F0] hover:bg-[#EAE8E2] flex items-center justify-center text-[#3D3C38] transition-colors cursor-pointer"
                    >
                      <Plus className="w-[12.5px] h-[12.5px]" strokeWidth={2} />
                    </button>
                  </div>

                  {/* Dark Note Inner Card */}
                  <div
                    onClick={() => triggerToast('Opening note: Brainstorming the product roadmap')}
                    className="bg-[#1B1B1B] hover:bg-[#232323] transition-colors rounded-[16px] p-3.5 text-white flex flex-col justify-between h-[124px] my-auto cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center justify-between text-[#A09E97]">
                      <div className="flex items-center gap-1 text-[9.5px]">
                        <Clock className="w-[10px] h-[10px]" strokeWidth={2} />
                        <span>2h ago</span>
                      </div>
                      <MoreHorizontal className="w-[13px] h-[13px]" />
                    </div>

                    <p className="text-[11px] font-medium text-white leading-[1.35] pr-1">
                      Brainstorming the product roadmap
                    </p>

                    <div className="flex items-center gap-1.5">
                      <span className="w-[6px] h-[6px] rounded-full bg-[#F35B16]" />
                      <span className="text-[9.5px] text-[#C8C6C0] font-normal">
                        Cloverend
                      </span>
                    </div>
                  </div>

                  {/* Bottom subtle spacer to match screenshot proportions */}
                  <div className="h-1" />
                </div>

                {/* CARD 3D: Clients by region */}
                <div className="sm:col-span-6 bg-white rounded-[22px] p-4.5 border border-[#ECEAE4] orbend-card-shadow flex flex-col justify-between h-[236px]">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <h2 className="text-[14.5px] font-semibold text-[#1B1B1B] leading-[1.2] tracking-[-0.01em]">
                      Clients by
                      <br />
                      region
                    </h2>
                    <button
                      onClick={() => triggerToast('Viewing global client distribution')}
                      className="w-[26px] h-[26px] rounded-full bg-[#F5F4F0] hover:bg-[#EAE8E2] flex items-center justify-center text-[#3D3C38] transition-colors cursor-pointer"
                    >
                      <ArrowUpRight className="w-[12.5px] h-[12.5px]" strokeWidth={2} />
                    </button>
                  </div>

                  {/* Stylized Grid Map with Orange Pin */}
                  <div className="region-map-grid rounded-[14px] h-[84px] relative overflow-hidden flex items-center justify-center border border-[#ECEAE4]/60 my-1">
                    {/* Subtle landmass silhouette shapes in background */}
                    <svg
                      viewBox="0 0 320 90"
                      className="absolute inset-0 w-full h-full opacity-45 pointer-events-none"
                    >
                      <path
                        d="M70 25 Q95 18 115 30 T145 28 T175 40 Q160 62 130 58 T80 48 Z"
                        fill="#E2E0D8"
                      />
                      <path
                        d="M185 18 Q215 15 240 28 T275 35 Q265 55 235 52 T190 38 Z"
                        fill="#E2E0D8"
                      />
                    </svg>

                    {/* Soft orange glow under pin */}
                    <div className="w-8 h-8 rounded-full bg-[#F35B16]/20 blur-md absolute" />

                    {/* Orange Teardrop Map Pin */}
                    <div className="relative z-10 -translate-y-1">
                      <svg
                        width="22"
                        height="27"
                        viewBox="0 0 24 30"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 0C5.37258 0 0 5.37258 0 12C0 19.5 12 30 12 30C12 30 24 19.5 24 12C24 5.37258 18.6274 0 12 0Z"
                          fill="#F35B16"
                        />
                        <circle cx="12" cy="11.5" r="4" fill="#F8986E" />
                      </svg>
                    </div>
                  </div>

                  {/* Bottom UK Region Pill Box */}
                  <div
                    onClick={() => triggerToast('United Kingdom: 48 active enterprise clients')}
                    className="bg-[#F2F1ED] hover:bg-[#EAE8E2] transition-colors rounded-[15px] px-3 py-2 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-[30px] h-[30px] rounded-full bg-[#6C7D93] text-white text-[9.5px] font-bold flex items-center justify-center">
                        UK
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-[#1B1B1B] leading-tight">
                          48
                        </p>
                        <p className="text-[9.5px] text-[#85837D] leading-tight">
                          United Kingdom
                        </p>
                      </div>
                    </div>
                    <div className="w-[22px] h-[22px] rounded-full bg-[#1B1B1B] text-white flex items-center justify-center">
                      <ArrowUpRight className="w-[11px] h-[11px]" strokeWidth={2.2} />
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTTOM SUB-ROW: Meeting schedule + Floating "Today's standup" Card */}
              <div className="bg-white rounded-[22px] p-5 border border-[#ECEAE4] orbend-card-shadow flex flex-col justify-between h-[244px] relative">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-[14.5px] font-semibold text-[#1B1B1B] tracking-[-0.01em]">
                    Meeting schedule
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => triggerToast('Calendar month: December')}
                      className="bg-[#F6F5F1] border border-[#E8E6DF] text-[10px] font-medium text-[#575653] px-3 py-1 rounded-full hover:bg-[#EFECE6] transition-colors cursor-pointer"
                    >
                      December
                    </button>
                    <button
                      onClick={() => {
                        setShowStandupCard(true);
                        triggerToast('Scheduled new standup slot');
                      }}
                      className="w-[27px] h-[27px] rounded-full bg-[#F6F5F1] border border-[#E8E6DF] hover:bg-[#EFECE6] flex items-center justify-center text-[#4A4945] transition-colors cursor-pointer"
                    >
                      <Plus className="w-[12.5px] h-[12.5px]" strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* Schedule Grid */}
                <div className="flex flex-col gap-2.5 mt-2">
                  {/* Days Header Row */}
                  <div className="grid grid-cols-[44px_1fr] items-center gap-2">
                    <div />
                    <div className="grid grid-cols-7 gap-2 text-center items-center">
                      {days.map((day) => {
                        const isWed = selectedDay === day;
                        return (
                          <button
                            key={day}
                            onClick={() => setSelectedDay(day)}
                            className={`text-[10px] py-1 rounded-full transition-all cursor-pointer ${
                              isWed
                                ? 'bg-[#1B1B1B] text-white font-medium shadow-xs'
                                : 'text-[#7D7B74] hover:text-[#1B1B1B]'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3 Time Rows (8 AM, 12 PM, 5 PM) */}
                  {scheduleRows.map((row) => (
                    <div
                      key={row.time}
                      className="grid grid-cols-[44px_1fr] items-center gap-2"
                    >
                      <span className="text-[9.5px] text-[#9A9891] font-medium">
                        {row.time}
                      </span>
                      <div className="grid grid-cols-7 gap-2">
                        {row.slots.map((slotType, idx) => {
                          let bgClass = 'bg-[#F2F1ED] hover:bg-[#EAE8E2]';
                          if (slotType === 'orange') {
                            bgClass = 'bg-[#F35B16] hover:brightness-95';
                          } else if (slotType === 'peach') {
                            bgClass = 'bg-[#FCE3D4] hover:brightness-95';
                          }
                          return (
                            <div
                              key={idx}
                              onClick={() =>
                                triggerToast(
                                  `${days[idx]} at ${row.time} — ${
                                    slotType === 'orange'
                                      ? 'Client Sync Call'
                                      : slotType === 'peach'
                                      ? 'Design Review'
                                      : 'Available slot'
                                  }`
                                )
                              }
                              className={`h-[33px] rounded-full transition-all cursor-pointer ${bgClass}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Floating Dark Card: "Today's standup" */}
                {showStandupCard && (
                  <div className="absolute right-4 bottom-3.5 w-[224px] bg-[#1B1B1B] text-white rounded-[20px] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.28)] z-20 flex flex-col justify-between gap-3">
                    {/* Top row */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-[13px] font-semibold text-white tracking-[-0.01em]">
                        Today&apos;s standup
                      </h3>
                      <button
                        onClick={() => setShowStandupCard(false)}
                        className="w-[20px] h-[20px] rounded-full bg-[#2E2E2E] hover:bg-[#3E3E3E] flex items-center justify-center text-[#B8B6B0] transition-colors cursor-pointer"
                        title="Dismiss"
                      >
                        <X className="w-[10px] h-[10px]" strokeWidth={2.2} />
                      </button>
                    </div>

                    {/* Middle row: Cloverend pill + 10 - 11 AM */}
                    <div className="flex items-center gap-2">
                      <span className="bg-[#F35B16] text-white text-[9.5px] font-medium px-2.5 py-[2.5px] rounded-full leading-none">
                        Cloverend
                      </span>
                      <div className="flex items-center gap-1 text-[9.5px] text-[#A2A09A]">
                        <Clock className="w-[10px] h-[10px]" strokeWidth={2} />
                        <span>10 - 11 AM</span>
                      </div>
                    </div>

                    {/* Bottom row: Mini avatars + Join the call + White plus button */}
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center -space-x-1.5">
                          <span className="w-[20px] h-[20px] rounded-full bg-[#F0824E] text-white text-[7.5px] font-bold flex items-center justify-center ring-1 ring-[#1B1B1B]">
                            AK
                          </span>
                          <span className="w-[20px] h-[20px] rounded-full bg-[#4EA885] text-white text-[7.5px] font-bold flex items-center justify-center ring-1 ring-[#1B1B1B]">
                            MF
                          </span>
                          <span className="w-[20px] h-[20px] rounded-full bg-[#7A6FF0] text-white text-[7.5px] font-bold flex items-center justify-center ring-1 ring-[#1B1B1B]">
                            SJ
                          </span>
                          <span className="w-[20px] h-[20px] rounded-full bg-[#333333] text-white text-[7.5px] font-semibold flex items-center justify-center ring-1 ring-[#1B1B1B]">
                            +2
                          </span>
                        </div>
                        <span className="text-[9.5px] text-[#C8C6C0] font-medium">
                          {joinedCall ? 'Joined' : 'Join the call'}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setJoinedCall(!joinedCall);
                          triggerToast(
                            !joinedCall
                              ? "Joined Today's standup (Cloverend)"
                              : 'Left standup call'
                          );
                        }}
                        className="w-[26px] h-[26px] rounded-full bg-white hover:bg-[#F2F1ED] text-[#1B1B1B] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      >
                        {joinedCall ? (
                          <Check className="w-[12px] h-[12px] text-[#2E8B57]" strokeWidth={2.5} />
                        ) : (
                          <Plus className="w-[12.5px] h-[12.5px]" strokeWidth={2.2} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
