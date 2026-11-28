import React, { useState } from 'react';
import {
  MoreHorizontal,
  ArrowRight,
  Plus,
  Calendar,
  Download,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  ArrowDownRight,
  ArrowUpRight,
  PhoneCall,
} from 'lucide-react';

interface PageTwoSalesOverviewProps {
  onNavigateToPageOne?: () => void;
}

export const PageTwoSalesOverview: React.FC<PageTwoSalesOverviewProps> = ({
  onNavigateToPageOne,
}) => {
  const [callState, setCallState] = useState<'incoming' | 'accepted' | 'declined'>(
    'incoming'
  );
  const [selectedPerfIndex, setSelectedPerfIndex] = useState<number>(5); // Index 5 is Apr 13 (6th bar)
  const [selectedStream, setSelectedStream] = useState<string>('Search');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState<boolean>(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2400);
  };

  // 13 radial segments from -108 deg to +108 deg (step 18 deg), first 9 are orange (#F35B16), last 4 are light gray (#EAE8E3)
  const totalSegments = 13;
  const activeSegments = 9;
  const gaugeSegments = Array.from({ length: totalSegments }, (_, i) => {
    const angleDeg = -108 + i * 18;
    const isOrange = i < activeSegments;
    return { index: i, angleDeg, isOrange };
  });

  // 11 bars in "Performance index" chart
  const perfBars = [
    { label: 'Apr 08', heightPct: 36, val: '71.4%' },
    { label: 'Apr 09', heightPct: 50, val: '76.0%' },
    { label: 'Apr 10', heightPct: 39, val: '72.8%' },
    { label: 'Apr 11', heightPct: 62, val: '79.5%' },
    { label: 'Apr 12', heightPct: 47, val: '74.9%' },
    { label: 'Apr 13', heightPct: 92, val: '85.2%' }, // Active orange bar with "Apr 13" pill
    { label: 'Apr 14', heightPct: 55, val: '77.8%' },
    { label: 'Apr 15', heightPct: 43, val: '73.6%' },
    { label: 'Apr 16', heightPct: 64, val: '80.1%' },
    { label: 'Apr 17', heightPct: 73, val: '82.4%' },
    { label: 'Apr 18', heightPct: 45, val: '74.2%' },
  ];

  // 4 revenue streams in "Target by revenue stream"
  const revenueStreams = [
    {
      name: 'Direct',
      pct: '20%',
      trend: 'down' as const,
      amount: '$3.4K',
      barHeight: 48,
    },
    {
      name: 'Social',
      pct: '45%',
      trend: 'down' as const,
      amount: '$4.5K',
      barHeight: 66,
    },
    {
      name: 'Search',
      pct: '70%',
      trend: 'up' as const,
      amount: '$7.7K',
      barHeight: 104,
    },
    {
      name: 'Other',
      pct: '50%',
      trend: 'down' as const,
      amount: '$5.5K',
      barHeight: 82,
    },
  ];

  // 12 perimeter tick dots for the dark circular "37.5% Convert rate" gauge
  const clockDots = Array.from({ length: 12 }, (_, i) => {
    const angleRad = ((i * 30 - 90) * Math.PI) / 180;
    const r = 84;
    const cx = 100 + r * Math.cos(angleRad);
    const cy = 100 + r * Math.sin(angleRad);
    return { cx, cy };
  });

  return (
    <div className="w-full max-w-[1240px] mx-auto select-none">
      {/* Outer silver-gray bezel matching reference screenshot */}
      <div className="bg-[#D7D7D5] p-[10px] sm:p-[13px] rounded-[34px] shadow-[0_25px_70px_rgba(0,0,0,0.45)] border border-white/30">
        {/* Inner warm off-white canvas */}
        <div className="bg-[#F4F3EF] rounded-[24px] p-5 sm:p-7 text-[#1B1B1B] relative overflow-hidden">
          {/* Interactive notification toast */}
          {toastMessage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#1B1B1B] text-white text-[11.5px] font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#F35B16]" />
              {toastMessage}
            </div>
          )}

          {/* Optional AI Assistant Popover */}
          {assistantOpen && (
            <div className="absolute top-18 right-7 z-40 w-[290px] bg-[#1B1B1B] text-white rounded-[20px] p-4 shadow-2xl border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#F35B16]" />
                  <span className="text-[12px] font-semibold">Orbend Sales AI</span>
                </div>
                <button
                  onClick={() => setAssistantOpen(false)}
                  className="text-[#9A9892] hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-[#C8C6C0] leading-relaxed mb-3">
                You&apos;re pacing at <strong className="text-white">67.2%</strong> of
                quarterly goal. Search revenue (<strong className="text-[#F35B16]">$7.7K</strong>
                ) is leading conversions at 37.5%.
              </p>
              {onNavigateToPageOne && (
                <button
                  onClick={onNavigateToPageOne}
                  className="w-full py-1.5 rounded-full bg-[#F35B16] text-white text-[11px] font-medium hover:brightness-95 transition-all cursor-pointer"
                >
                  Go to Main Dashboard →
                </button>
              )}
            </div>
          )}

          {/* ================= 2-COLUMN MACRO LAYOUT ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* ========== LEFT COLUMN (5/12): Full-Height "Sales overview" White Card ========== */}
            <div className="lg:col-span-5 bg-white rounded-[28px] p-6 sm:p-7 orbend-page2-card-shadow flex flex-col justify-between min-h-[590px]">
              {/* Top Section: Header + Performer Banner */}
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h1 className="text-[22px] sm:text-[24px] font-semibold text-[#1B1B1B] tracking-[-0.025em]">
                    Sales overview
                  </h1>
                  <button
                    onClick={() => triggerToast('Sales overview options')}
                    className="w-[34px] h-[34px] rounded-full border border-[#ECEAE4] bg-white hover:bg-[#F7F6F2] flex items-center justify-center text-[#575653] transition-colors cursor-pointer"
                  >
                    <MoreHorizontal className="w-[15px] h-[15px]" />
                  </button>
                </div>

                {/* Highlight Banner Pill: "You're in the top 15% of performers this quarter" */}
                <div
                  onClick={() =>
                    triggerToast('Top 15% leaderboard ranking across 84 sales reps')
                  }
                  className="bg-[#F5F4F0] hover:bg-[#EFECE6] transition-colors rounded-[16px] px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Soft peach circle with orange crown icon */}
                    <div className="w-[26px] h-[26px] rounded-full bg-[#FCE4D6] flex items-center justify-center shrink-0">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="#F35B16"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M3 18H21V20H3V18ZM3 15L2 6L7.5 10L12 4L16.5 10L22 6L21 15H3Z" />
                      </svg>
                    </div>
                    <p className="text-[11px] sm:text-[11.5px] text-[#3D3C38] font-medium truncate">
                      You&apos;re in the{' '}
                      <span className="text-[#F35B16] font-semibold">top 15%</span> of
                      performers this quarter
                    </p>
                  </div>
                  <ArrowRight
                    className="w-[13px] h-[13px] text-[#7D7B74] shrink-0"
                    strokeWidth={1.8}
                  />
                </div>
              </div>

              {/* Center Section: 13-Segment Arch Gauge (67.2% Of quarterly goal) */}
              <div className="my-auto py-4 flex flex-col items-center justify-center relative">
                <div className="w-[270px] h-[185px] relative flex items-center justify-center">
                  <svg
                    viewBox="0 0 280 200"
                    className="w-full h-full overflow-visible"
                  >
                    <g transform="translate(140, 128)">
                      {gaugeSegments.map((seg) => (
                        <g
                          key={seg.index}
                          transform={`rotate(${seg.angleDeg})`}
                          className="transition-transform duration-300 hover:scale-105 cursor-pointer"
                          onClick={() =>
                            triggerToast(
                              `Goal milestone ${seg.index + 1}/13 (${Math.round(
                                ((seg.index + 1) / 13) * 100
                              )}%)`
                            )
                          }
                        >
                          {/* Slightly tapered rounded-rectangle block matching screenshot */}
                          <path
                            d="M -9 -108 Q -9 -113 -4 -113 L 4 -113 Q 9 -113 9 -108 L 7.2 -76 Q 7 -72 3.5 -72 L -3.5 -72 Q -7 -72 -7.2 -76 Z"
                            fill={seg.isOrange ? '#F35B16' : '#EAE8E3'}
                          />
                        </g>
                      ))}
                    </g>
                  </svg>

                  {/* Center Percentage Text inside the Arch */}
                  <div className="absolute bottom-[22px] flex flex-col items-center text-center">
                    <div className="flex items-baseline justify-center text-[#1B1B1B] tracking-[-0.03em] leading-none">
                      <span className="text-[35px] font-semibold">67.2</span>
                      <span className="text-[22px] font-semibold">%</span>
                    </div>
                    <p className="text-[11px] text-[#7E7C75] font-medium mt-1.5">
                      Of quarterly goal
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Two Gray Sub-Cards (Deals closed & Total sales) */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* Sub-card 1: Deals closed */}
                <div className="bg-[#F4F3EF] rounded-[20px] p-4 flex flex-col justify-between h-[106px]">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-[#7E7C75] font-medium">
                      Deals closed
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#2E8B57]">
                      <ArrowUp className="w-[10px] h-[10px]" strokeWidth={2.5} />
                      3.5%
                    </span>
                  </div>
                  <p className="text-[25px] font-semibold text-[#1B1B1B] tracking-[-0.03em] leading-none">
                    1,304
                  </p>
                </div>

                {/* Sub-card 2: Total sales */}
                <div className="bg-[#F4F3EF] rounded-[20px] p-4 flex flex-col justify-between h-[106px]">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-[#7E7C75] font-medium">
                      Total sales
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#D65A47]">
                      <ArrowDown className="w-[10px] h-[10px]" strokeWidth={2.5} />
                      4.5%
                    </span>
                  </div>
                  <p className="text-[25px] font-semibold text-[#1B1B1B] tracking-[-0.03em] leading-none">
                    $21.1K
                  </p>
                </div>
              </div>
            </div>

            {/* ========== RIGHT COLUMN (7/12): Top Bar + Middle Row + Bottom Row ========== */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-5">
              {/* ---------- ROW 1: Top Collaboration & Action Bar ---------- */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left: Avatar Stack + "+ Invite" Black Pill */}
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center -space-x-2">
                    <div
                      onClick={() => triggerToast('Alex K. — Team Lead')}
                      className="w-[33px] h-[33px] rounded-full bg-[#EE8450] text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-[#F4F3EF] cursor-pointer"
                    >
                      AK
                    </div>
                    <div
                      onClick={() => triggerToast('Marcus F. — Account Executive')}
                      className="w-[33px] h-[33px] rounded-full bg-[#5C85E6] text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-[#F4F3EF] cursor-pointer"
                    >
                      MF
                    </div>
                    <div
                      onClick={() => triggerToast('Sarah J. — Sales Ops')}
                      className="w-[33px] h-[33px] rounded-full bg-[#926AE6] text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-[#F4F3EF] cursor-pointer"
                    >
                      SJ
                    </div>
                    <div
                      onClick={() => triggerToast('Taylor N. — SDR')}
                      className="w-[33px] h-[33px] rounded-full bg-[#4BAE86] text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-[#F4F3EF] cursor-pointer"
                    >
                      TN
                    </div>
                    <div
                      onClick={() => triggerToast('+6 more team members online')}
                      className="w-[33px] h-[33px] rounded-full bg-[#1B1B1B] text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-[#F4F3EF] cursor-pointer"
                    >
                      +6
                    </div>
                  </div>

                  <button
                    onClick={() => triggerToast('Invite link copied to clipboard')}
                    className="bg-[#1B1B1B] hover:bg-[#2E2E2E] text-white text-[11.5px] font-medium px-4 py-2 rounded-full inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-[12px] h-[12px]" strokeWidth={2.2} />
                    <span>Invite</span>
                  </button>
                </div>

                {/* Right: Calendar Button + "Download report" + "+ Ask the assistant" */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => triggerToast('Filtering: Q2 2025')}
                    className="w-[35px] h-[35px] rounded-full bg-white border border-[#ECEAE4] hover:bg-[#FAF9F5] flex items-center justify-center text-[#2C2C2A] transition-colors cursor-pointer shadow-2xs"
                    title="Select Date Range"
                  >
                    <Calendar className="w-[14px] h-[14px]" strokeWidth={1.9} />
                  </button>

                  <button
                    onClick={() => triggerToast('Downloading Q2 Sales Overview PDF...')}
                    className="bg-white border border-[#ECEAE4] hover:bg-[#FAF9F5] text-[#1B1B1B] text-[11.5px] font-medium px-3.5 py-2 rounded-full inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Download className="w-[12.5px] h-[12.5px]" strokeWidth={2} />
                    <span>Download report</span>
                  </button>

                  <button
                    onClick={() => setAssistantOpen((prev) => !prev)}
                    className="bg-[#F35B16] hover:brightness-95 text-white text-[11.5px] font-medium px-4 py-2 rounded-full inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_4px_12px_rgba(243,91,22,0.3)]"
                  >
                    <Plus className="w-[12.5px] h-[12.5px]" strokeWidth={2.2} />
                    <span>Ask the assistant</span>
                  </button>
                </div>
              </div>

              {/* ---------- ROW 2: "Performance index" Card + Dark Circular "37.5% Convert rate" ---------- */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                {/* Left (8/12): Performance index white card */}
                <div className="sm:col-span-8 bg-white rounded-[26px] p-5 sm:p-6 orbend-page2-card-shadow flex flex-col justify-between h-[212px]">
                  {/* Top Header */}
                  <div className="flex items-start justify-between">
                    <span className="text-[12px] text-[#7E7C75] font-medium">
                      Performance index
                    </span>
                    <span className="text-[25px] font-semibold text-[#1B1B1B] tracking-[-0.03em] leading-none">
                      {perfBars[selectedPerfIndex].val}
                    </span>
                  </div>

                  {/* 11 Vertical Rounded Bars with floating "Apr 13" dark tooltip */}
                  <div className="grid grid-cols-11 gap-2 items-end h-[128px] pt-6">
                    {perfBars.map((bar, idx) => {
                      const isActive = idx === selectedPerfIndex;
                      return (
                        <div
                          key={bar.label}
                          onClick={() => setSelectedPerfIndex(idx)}
                          onMouseEnter={() => setSelectedPerfIndex(idx)}
                          className="flex flex-col items-center justify-end h-full relative cursor-pointer group"
                        >
                          {/* Floating dark tooltip pill on active bar */}
                          {isActive && (
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                              <span className="bg-[#1B1B1B] text-white text-[9.5px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap leading-none shadow-sm">
                                {bar.label}
                              </span>
                              <div className="w-1.5 h-1.5 bg-[#1B1B1B] rotate-45 -mt-1" />
                            </div>
                          )}

                          {/* Vertical Bar */}
                          <div
                            style={{ height: `${bar.heightPct}%` }}
                            className={`w-full rounded-[6px] transition-all duration-200 ${
                              isActive
                                ? 'bg-[#F35B16] shadow-[0_4px_12px_rgba(243,91,22,0.28)]'
                                : 'bg-[#EAE8E3] group-hover:bg-[#DEDCD5]'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right (4/12): Dark Circular "37.5% Convert rate" Radial Widget */}
                <div className="sm:col-span-4 flex items-center justify-center">
                  <div
                    onClick={() => triggerToast('Lead-to-Deal Convert Rate: 37.5% (+4.2% QoQ)')}
                    className="w-[196px] h-[196px] rounded-full bg-[#1B1B1B] relative flex items-center justify-center shadow-[0_14px_30px_rgba(0,0,0,0.18)] cursor-pointer group"
                  >
                    <svg viewBox="0 0 200 200" className="w-full h-full">
                      {/* 12 Perimeter Clock Dots */}
                      {clockDots.map((dot, idx) => (
                        <circle
                          key={idx}
                          cx={dot.cx}
                          cy={dot.cy}
                          r="1.9"
                          fill="#7A7872"
                        />
                      ))}

                      {/* Inner Dark Gray Circular Track */}
                      <circle
                        cx="100"
                        cy="100"
                        r="68"
                        fill="none"
                        stroke="#2B2B2B"
                        strokeWidth="12"
                      />

                      {/* Active Orange Progress Ring (37.5% of circle starting at -82 deg) */}
                      <circle
                        cx="100"
                        cy="100"
                        r="68"
                        pathLength="100"
                        strokeDasharray="37.5 100"
                        transform="rotate(-82 100 100)"
                        fill="none"
                        stroke="#F35B16"
                        strokeWidth="12"
                        strokeLinecap="round"
                      />

                      {/* Tiny glowing dot inside the end of the orange arc (+53 deg) */}
                      <circle cx="140.9" cy="154.3" r="2.4" fill="#FAD7C5" />
                    </svg>

                    {/* Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[21px] font-semibold text-white tracking-[-0.02em] leading-none">
                        37.5%
                      </span>
                      <span className="text-[10px] text-[#9A9891] mt-1 font-normal">
                        Convert rate
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ---------- ROW 3: Orange "Incoming call" Card + "Target by revenue stream" Card ---------- */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-stretch">
                {/* Left (5/12): Bright Orange "Incoming call" Card with 3D Glossy Sphere */}
                <div className="sm:col-span-5 bg-[#F35B16] rounded-[26px] p-4.5 text-white relative overflow-hidden flex flex-col justify-between min-h-[296px] shadow-[0_12px_30px_-6px_rgba(243,91,22,0.4)]">
                  {/* Top-Left Header */}
                  <div className="relative z-10 pt-1 pl-1">
                    <h2 className="text-[16px] font-medium text-white leading-tight tracking-[-0.01em]">
                      {callState === 'accepted'
                        ? 'Call in progress'
                        : callState === 'declined'
                        ? 'Call missed'
                        : 'Incoming call'}
                    </h2>
                    <p className="text-[11px] text-white/80 mt-0.5 font-normal">
                      {callState === 'accepted'
                        ? '00:14 • Priority line'
                        : 'Inbound lead'}
                    </p>
                  </div>

                  {/* Top-Right 3D Glossy Peach/Terracotta Sphere (matching screenshot) */}
                  <div className="absolute -top-4 -right-5 w-[132px] h-[132px] pointer-events-none select-none">
                    {/* Soft warm cast shadow onto the orange card */}
                    <div className="absolute top-5 right-3 w-[112px] h-[112px] rounded-full bg-[#B53A05]/45 blur-md" />
                    <svg
                      viewBox="0 0 140 140"
                      className="w-full h-full relative z-10"
                    >
                      <defs>
                        <radialGradient
                          id="orbendSphereGrad"
                          cx="34%"
                          cy="28%"
                          r="68%"
                          fx="30%"
                          fy="24%"
                        >
                          <stop offset="0%" stopColor="#FCE3CE" />
                          <stop offset="28%" stopColor="#F2B48E" />
                          <stop offset="62%" stopColor="#DC8151" />
                          <stop offset="88%" stopColor="#B85322" />
                          <stop offset="100%" stopColor="#8E3810" />
                        </radialGradient>
                      </defs>
                      <circle
                        cx="72"
                        cy="66"
                        r="56"
                        fill="url(#orbendSphereGrad)"
                      />
                    </svg>
                  </div>

                  {/* Bottom Inner White Card */}
                  <div className="bg-white rounded-[20px] p-3.5 text-[#1B1B1B] relative z-10 shadow-[0_8px_20px_rgba(140,42,5,0.18)] mt-auto">
                    {/* Top Row inside white card: Accept Pill + Close Circle */}
                    <div className="flex items-center gap-2">
                      {callState === 'incoming' ? (
                        <>
                          <button
                            onClick={() => {
                              setCallState('accepted');
                              triggerToast('Connected with Brenda Johnson');
                            }}
                            className="flex-1 bg-[#F35B16] hover:brightness-95 text-white text-[12px] font-medium py-2.5 px-3 rounded-full flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          >
                            <Check className="w-[13px] h-[13px]" strokeWidth={2.4} />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => {
                              setCallState('declined');
                              triggerToast('Declined call from Brenda Johnson');
                            }}
                            className="w-[36px] h-[36px] rounded-full border border-[#ECEAE4] bg-[#FAF9F6] hover:bg-[#F0EFEA] text-[#575653] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            title="Decline"
                          >
                            <X className="w-[13px] h-[13px]" strokeWidth={2} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setCallState('incoming')}
                          className="w-full bg-[#1B1B1B] hover:bg-[#2E2E2E] text-white text-[11.5px] font-medium py-2.5 px-3 rounded-full flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <PhoneCall className="w-[12px] h-[12px] text-[#F35B16]" />
                          <span>
                            {callState === 'accepted'
                              ? 'End call (Reset)'
                              : 'Restore incoming call'}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Bottom Row inside white card: BJ Avatar + Brenda Johnson */}
                    <div className="flex items-center gap-2.5 mt-3.5 pt-0.5">
                      <div className="w-[32px] h-[32px] rounded-full bg-[#F27940] text-white text-[10.5px] font-semibold flex items-center justify-center shrink-0">
                        BJ
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-[#1B1B1B] leading-tight truncate">
                          Brenda Johnson
                        </p>
                        <p className="text-[10px] text-[#8A8881] leading-tight mt-0.5 truncate">
                          Priority customer
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right (7/12): White "Target by revenue stream" Card */}
                <div className="sm:col-span-7 bg-white rounded-[26px] p-5.5 orbend-page2-card-shadow flex flex-col justify-between min-h-[296px]">
                  {/* Top Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11.5px] text-[#7E7C75] font-medium">
                        Target by revenue stream
                      </p>
                      <h3 className="text-[27px] font-semibold text-[#1B1B1B] tracking-[-0.03em] leading-none mt-1.5">
                        $21.1K
                      </h3>
                    </div>
                    <button
                      onClick={() => triggerToast('Revenue stream breakdown settings')}
                      className="w-[33px] h-[33px] rounded-full border border-[#ECEAE4] bg-white hover:bg-[#F7F6F2] flex items-center justify-center text-[#575653] transition-colors cursor-pointer"
                    >
                      <MoreHorizontal className="w-[14px] h-[14px]" />
                    </button>
                  </div>

                  {/* Bottom 4-Column Bar Chart */}
                  <div className="mt-4">
                    {/* Percentage Row + Dashed Divider */}
                    <div className="grid grid-cols-4 gap-3 pb-2.5 border-b border-dashed border-[#E6E4DD]">
                      {revenueStreams.map((stream) => (
                        <div
                          key={stream.name}
                          className="flex items-center justify-center gap-0.5 text-[10.5px] text-[#6E6C66] font-medium"
                        >
                          <span>{stream.pct}</span>
                          {stream.trend === 'up' ? (
                            <ArrowUpRight
                              className="w-[11px] h-[11px] text-[#6E6C66]"
                              strokeWidth={1.8}
                            />
                          ) : (
                            <ArrowDownRight
                              className="w-[11px] h-[11px] text-[#9A9891]"
                              strokeWidth={1.8}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* 4 Bars with Overlapping Top Value Pills */}
                    <div className="grid grid-cols-4 gap-3 items-end h-[126px] pt-5">
                      {revenueStreams.map((stream) => {
                        const isSearch = selectedStream === stream.name;
                        return (
                          <div
                            key={stream.name}
                            onClick={() => setSelectedStream(stream.name)}
                            className="flex flex-col items-center justify-end h-full cursor-pointer group"
                          >
                            {/* Bar with pill straddling its top edge */}
                            <div
                              style={{ height: `${stream.barHeight}px` }}
                              className={`w-full rounded-[13px] relative transition-all duration-200 ${
                                isSearch
                                  ? 'bg-[#F35B16] shadow-[0_6px_16px_rgba(243,91,22,0.28)]'
                                  : 'bg-[#F0EFEA] group-hover:bg-[#E6E4DD]'
                              }`}
                            >
                              {/* Value Pill straddling the top center of the bar */}
                              <span
                                className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9.5px] font-semibold px-2.5 py-[2.5px] rounded-full leading-none whitespace-nowrap shadow-xs ${
                                  isSearch
                                    ? 'bg-[#1B1B1B] text-white'
                                    : 'bg-[#F35B16] text-white'
                                }`}
                              >
                                {stream.amount}
                              </span>
                            </div>

                            {/* Stream Name Label */}
                            <span
                              className={`text-[10.5px] mt-2.5 leading-none ${
                                isSearch
                                  ? 'font-semibold text-[#1B1B1B]'
                                  : 'text-[#7E7C75]'
                              }`}
                            >
                              {stream.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
