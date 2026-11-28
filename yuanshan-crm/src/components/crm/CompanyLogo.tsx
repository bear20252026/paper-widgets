import { cn, monogramOf } from "@/lib/utils";

const PALETTES: [string, string][] = [
  ["#1E3A32", "#2F5E4F"],
  ["#274B40", "#1E3A32"],
  ["#3A6B59", "#1E3A32"],
  ["#4A8270", "#2F5E4F"],
  ["#6E9E8A", "#3A6B59"],
  ["#C9A227", "#7A5E0E"],
  ["#8A6B2F", "#2A3F36"],
  ["#2F5E4F", "#17261F"],
];

function hash(value: string): number {
  let result = 0;
  for (let i = 0; i < value.length; i += 1) {
    result = (result * 31 + value.charCodeAt(i)) % 1_000_000;
  }
  return result;
}

export function CompanyLogo({
  logoKey,
  company,
  size = 32,
  className,
}: {
  logoKey?: string;
  company: string;
  size?: number;
  className?: string;
}) {
  const key = logoKey || company;
  const [from, to] = PALETTES[hash(key) % PALETTES.length]!;
  const mark = monogramOf(company);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-[10px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${from}, ${to})`,
      }}
      aria-hidden
      title={company}
    >
      <span
        className="relative z-10 font-serif font-semibold tracking-[0.02em]"
        style={{ fontSize: Math.max(10, size * 0.36) }}
      >
        {mark}
      </span>
      <span
        className="absolute inset-x-0 bottom-0 h-[3px] opacity-60"
        style={{ background: "linear-gradient(90deg, rgba(201,162,39,0), #C9A227)" }}
      />
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -bottom-1 left-0 h-4 w-full text-white/10"
        aria-hidden
      >
        <path d="M0 34 L22 16 L38 27 L58 10 L78 26 L100 18" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </span>
  );
}
