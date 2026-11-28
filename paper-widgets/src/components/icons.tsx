/** Small line and solid icons on a 24-unit grid, drawn in currentColor. */

type IconProps = { size: number };

const solid = (size: number, d: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const Prev = ({ size }: IconProps) => solid(size, "M7 6h2v12H7zM20 6v12l-9-6z");
export const Pause = ({ size }: IconProps) => solid(size, "M7 5h4v14H7zM13 5h4v14h-4z");
export const Next = ({ size }: IconProps) => solid(size, "M15 6h2v12h-2zM4 6v12l9-6z");
export const Bolt = ({ size }: IconProps) => solid(size, "M13 2 4 14h7l-1 8 9-12h-7z");
export const Moon = ({ size }: IconProps) => solid(size, "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z");

const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.6 } as const;

export const Phone = ({ size }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="7" y="3" width="10" height="18" rx="2.5" {...line} />
  </svg>
);

export const Watch = ({ size }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6.5" y="6.5" width="11" height="11" rx="3" {...line} />
    <path d="M9 6.5 9.6 3h4.8l.6 3.5M9 17.5l.6 3.5h4.8l.6-3.5" {...line} />
  </svg>
);

export const Buds = ({ size }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M8 4a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3V20M16 4a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3V20"
      {...line}
      strokeLinecap="round"
    />
  </svg>
);
