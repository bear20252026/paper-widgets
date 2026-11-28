export const PERIODS = ["Monthly", "Weekly", "Yearly"] as const;
export type Period = (typeof PERIODS)[number];

/** The six bars always end on the same baseline (204px from the top of the card); only their heights change. */
export const BAR_BASE = 204;

export const SERIES: Record<Period, { tip: string; bars: number[] }> = {
  Monthly: { tip: "$2,045.07", bars: [54, 96, 120, 74, 104, 130] },
  Weekly: { tip: "$512.40", bars: [68, 44, 96, 112, 58, 86] },
  Yearly: { tip: "$24,380.11", bars: [44, 66, 92, 118, 102, 122] },
};

export const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const SEGMENTS = ["Contacts", "Team", "Clients"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const DAYS = ["23 Nov", "24 Nov", "25 Nov", "26 Nov"];

export type Business = {
  brand: string;
  amount: string;
  total: string;
  chip: string;
  seg1: string;
  seg2: string;
};

export const BUSINESSES: Business[] = [
  { brand: "Dr. Firmarket", amount: "$20.18", total: "Total $2.18", chip: "+2.7%", seg1: "61%", seg2: "9.5%" },
  { brand: "Aster & Co.", amount: "$12.40", total: "Total $1.64", chip: "+1.4%", seg1: "42%", seg2: "14%" },
  { brand: "Lumen Studio", amount: "$31.06", total: "Total $3.40", chip: "+4.1%", seg1: "76%", seg2: "6%" },
];

export const INCOME_PATH =
  "M 50 127.0 L 54 135.8 L 58 138.5 L 62 131.5 L 66 126.5 L 70 129.0 L 74 125.5 L 78 115.0 L 82 116.2 L 86 131.0 L 90 141.2 L 94 142.0 L 98 140.5 L 102 136.8 L 106 126.0 L 110 115.0 L 114 113.8 L 118 117.8 L 122 119.8 L 126 122.2 L 130 129.0 L 134 135.8 L 138 137.0 L 142 131.5 L 146 122.0 L 150 118.2 L 154 122.0 L 158 121.2 L 162 116.5 L 166 121.5 L 170 134.2 L 174 140.5 L 178 139.2 L 182 138.2 L 186 134.5 L 190 121.5 L 194 110.5 L 198 114.5 L 202 123.5 L 206 126.5 L 210 129.5 L 214 136.2 L 218 138.5 L 222 132.2 L 226 122.8 L 230 115.2 L 234 114.5 L 238 119.0 L 242 121.0 L 246 121.8 L 250 129.0 L 254 137.2 L 258 135.0 L 262 129.5 L 266 133.0 L 270 134.8 L 274 121.5 L 278 110.8 L 282 119.2 L 286 132.0 L 290 136.0";

export const EXPENSE_PATH =
  "M 52 127.0 L 56 135.5 L 60 136.5 L 64 131.8 L 68 129.5 L 72 128.0 L 76 118.5 L 80 110.5 L 84 120.0 L 88 135.5 L 92 139.5 L 96 137.8 L 100 139.0 L 104 136.5 L 108 124.8 L 112 116.0 L 116 118.0 L 120 120.2 L 124 118.0 L 128 119.2 L 132 126.8 L 136 133.0 L 144 130.8 L 148 123.8 L 152 121.2 L 156 121.0 L 160 115.5 L 164 112.2 L 168 122.0 L 172 136.2 L 180 142.2 L 188 136.0 L 192 120.2 L 196 111.8 L 200 119.0 L 204 126.0 L 208 125.2 L 212 128.0 L 216 135.8 L 220 137.5 L 224 131.2 L 228 123.2 L 232 117.8 L 236 116.5 L 240 117.0 L 248 120.0 L 252 129.5 L 256 137.2 L 260 135.8 L 264 133.5 L 268 135.2 L 272 130.2 L 276 116.2 L 280 112.5 L 284 124.8 L 288 134.2 L 292 134.5 L 296 135.2 L 300 140.0";

export const BALANCE_PATH =
  "M14,158 L20,156 L26,153 L32,150 L38,148 L42,147 L46,154 L50,151 L54,148 L58,146 L62,146 L66,146 L70,147 L74,148 L78,150 L82,152 L86,153 L90,154 L94,154 L98,154 L102,152 L106,151 L110,148 L114,144 L118,142 L122,140 L126,140 L130,140 L134,142 L138,144 L142,146 L146,148 L150,148 L154,150 L158,150 L162,149 L166,148 L170,145 L174,141 L178,138 L182,136 L186,135 L190,135 L194,136 L198,138 L202,140 L206,141 L210,142 L214,144 L218,144 L222,144 L226,144 L230,142 L234,139 L238,135 L242,132 L246,130 L250,128 L254,128 L258,128 L262,128 L266,130 L270,131 L274,132 L278,134 L282,134 L286,136 L290,136 L294,136 L298,134 L302,132 L306,130";

/** The transaction heat row: 8 × 3 soft discs, the last four of the bottom row lit. */
export const HEAT = [
  "#F1EFEA", "#F1EFEA", "#F1EFEA", "#F1EFEA", "#F1EFEA", "#F1EFEA", "#F1EFEA", "#F1EFEA",
  "#F1EFEA", "#F1EFEA", "#F1EFEA", "#FFC3A8", "#FFBE9F", "#FFC3A8", "#FFBE9F", "#FFC0A4",
  "#FFBC9E", "#FFBD9F", "#FFC2A7", "#FFBE9F", "#FF5B14", "#FF5B14", "#FF5B14", "#FF5B14",
];

const DOTS_COLS = 94;
const DOTS_ROWS = 6;
const PALE = "rgba(24,21,16,.055)";

/** The profit matrix: a lit block of 30 columns, a sparse tail, everything else a pale grid.
 *  Deterministic, so the pattern is identical on every render. */
export function buildDots(): string[] {
  const out: string[] = [];
  for (let r = 0; r < DOTS_ROWS; r++) {
    for (let c = 0; c < DOTS_COLS; c++) {
      const inBlock = c >= 34 && c <= 63;
      if (inBlock) {
        const v = ((c * 7 + r * 13) % 11) / 11;
        const a = v < 0.18 ? 0.25 : v < 0.5 ? 0.45 : v < 0.8 ? 0.68 : 0.9;
        out.push(`rgba(255,91,20,${a})`);
      } else if ((c >= 69 && c <= 72 && (r + c) % 3 === 0) || (c >= 90 && r % 2 === 0)) {
        out.push("rgba(255,91,20,.3)");
      } else {
        out.push(PALE);
      }
    }
  }
  return out;
}
