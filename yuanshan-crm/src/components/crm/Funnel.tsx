import { useFormat } from "@/lib/format";
import { STAGE_META, type Stage } from "@/lib/types";
import { interpolate, plural, useI18n } from "@/i18n";

const WIDTH = 620;
const BAR_HEIGHT = 40;
const GAP = 12;
const MAX_BAR_WIDTH = 300;

export interface FunnelDatum {
  stage: Stage;
  amount: number;
  count: number;
}

export function Funnel({
  data,
  onSelect,
}: {
  data: FunnelDatum[];
  onSelect?: (stage: Stage) => void;
}) {
  const { m } = useI18n();
  const { money } = useFormat();

  const maxAmount = Math.max(1, ...data.map((item) => item.amount));
  const totalAmount = Math.max(1, data.reduce((sum, item) => sum + item.amount, 0));
  const centerX = 170 + MAX_BAR_WIDTH / 2;
  const widths = data.map((item) => Math.max(0.14, item.amount / maxAmount) * MAX_BAR_WIDTH);
  const height = data.length * BAR_HEIGHT + (data.length - 1) * GAP;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={m.funnel.ariaLabel}
    >
      {data.slice(0, -1).map((item, index) => {
        const top = index * (BAR_HEIGHT + GAP) + BAR_HEIGHT;
        const nextTop = top + GAP;
        const from = widths[index]!;
        const to = widths[index + 1]!;
        return (
          <path
            key={`connector-${item.stage}`}
            d={`M${centerX - from / 2 + 6} ${top} L${centerX + from / 2 - 6} ${top} L${
              centerX + to / 2 - 6
            } ${nextTop} L${centerX - to / 2 + 6} ${nextTop} Z`}
            fill={STAGE_META[data[index + 1]!.stage].color}
            opacity={0.16}
          />
        );
      })}

      {data.map((item, index) => {
        const top = index * (BAR_HEIGHT + GAP);
        const width = widths[index]!;
        const isWon = item.stage === "won";
        const label = m.stages[item.stage].label;
        const countLabel = interpolate(plural(m.funnel.clientsOne, m.funnel.clients, item.count), {
          n: item.count,
        });
        const share = Math.round((item.amount / totalAmount) * 100);

        return (
          <g
            key={item.stage}
            className="group"
            style={{ cursor: onSelect ? "pointer" : undefined }}
            onClick={() => onSelect?.(item.stage)}
          >
            <rect x={0} y={top - 4} width={WIDTH} height={BAR_HEIGHT + 8} fill="transparent" />
            <text x={0} y={top + 20} fontSize="14" fontWeight="600" fill="#1a1f1c">
              {label}
            </text>
            <text x={0} y={top + 37} fontSize="11.5" fill="#6b706a">
              {countLabel}
            </text>

            <rect
              x={centerX - width / 2}
              y={top}
              width={width}
              height={BAR_HEIGHT}
              rx={12}
              fill={STAGE_META[item.stage].color}
              className="funnel-bar transition-opacity group-hover:opacity-90"
              style={{ animationDelay: `${index * 70}ms` }}
            />

            {isWon && (
              <rect
                x={centerX - width / 2 + 12}
                y={top + BAR_HEIGHT - 4}
                width={Math.max(0, width - 24)}
                height={4}
                rx={2}
                fill="#C9A227"
                className="funnel-bar"
                style={{ animationDelay: "420ms" }}
              />
            )}

            {width > 70 && (
              <text
                x={centerX}
                y={top + BAR_HEIGHT / 2 + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="12"
                fontWeight="600"
                fill={index >= 2 ? "#F4F1E8" : "#1E3A32"}
              >
                {share}%
              </text>
            )}

            <text
              x={WIDTH}
              y={top + BAR_HEIGHT / 2 + 1}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="17"
              fontWeight="500"
              fill={isWon ? "#1E3A32" : "#2a302c"}
              style={{ fontFamily: "Fraunces, serif", fontVariantNumeric: "tabular-nums" }}
            >
              {money(item.amount)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
