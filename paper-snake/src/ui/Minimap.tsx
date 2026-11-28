import type { RadarSnapshot } from "../game/types";
import { useT } from "../i18n/useT";
import { POWER_INFO } from "../game/powerups";

interface MinimapProps {
  radar: RadarSnapshot | undefined;
  size?: number;
  className?: string;
}

/**
 * Commercial IO Radar Minimap:
 * - Shows 3x3 arena sectors
 * - Pulsing amber rings for fresh giant-snake corpse feasts (盛宴热点)
 * - Slate dots for rivals, golden crown marker for #1 Snake King
 * - Bright mint dot + directional heading cone for the player
 */
export function Minimap({ radar, size = 108, className = "" }: MinimapProps) {
  const t = useT();
  const W = radar?.width ?? 4400;
  const H = radar?.height ?? 4400;
  const pad = 8;
  const inner = size - pad * 2;

  const toMap = (wx: number, wy: number) => ({
    x: pad + Math.max(0, Math.min(1, wx / W)) * inner,
    y: pad + Math.max(0, Math.min(1, wy / H)) * inner,
  });

  const player = radar?.snakes.find((s) => s.isPlayer);
  const playerPos = player ? toMap(player.x, player.y) : { x: size / 2, y: size / 2 };
  const angle = radar?.playerAngle ?? -Math.PI / 2;
  const coneLen = 13;
  const coneSpread = 0.48;
  const c1x = playerPos.x + Math.cos(angle - coneSpread) * coneLen;
  const c1y = playerPos.y + Math.sin(angle - coneSpread) * coneLen;
  const c2x = playerPos.x + Math.cos(angle + coneSpread) * coneLen;
  const c2y = playerPos.y + Math.sin(angle + coneSpread) * coneLen;

  return (
    <div
      className={`relative overflow-hidden rounded-[18px] border border-[#5c7457]/20 bg-[#fffdf7]/86 shadow-[0_12px_30px_-14px_rgba(23,58,48,0.38)] backdrop-blur-xl select-none ${className}`}
      style={{ width: size, height: size }}
      aria-label={t("赛场雷达小地图")}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        {/* Arena Playable Box */}
        <rect
          x={pad}
          y={pad}
          width={inner}
          height={inner}
          rx={6}
          fill="rgba(62, 207, 174, 0.06)"
          stroke="rgba(23, 58, 48, 0.16)"
          strokeWidth={1}
        />

        {/* 3x3 Sector Grid + Center Ring */}
        {[1 / 3, 2 / 3].map((f) => (
          <g key={f}>
            <line
              x1={pad + inner * f}
              y1={pad}
              x2={pad + inner * f}
              y2={pad + inner}
              stroke="rgba(23, 58, 48, 0.08)"
              strokeDasharray="2 2"
            />
            <line
              x1={pad}
              y1={pad + inner * f}
              x2={pad + inner}
              y2={pad + inner * f}
              stroke="rgba(23, 58, 48, 0.08)"
              strokeDasharray="2 2"
            />
          </g>
        ))}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={inner * 0.22}
          fill="none"
          stroke="rgba(23, 58, 48, 0.08)"
        />

        {/* Corpse Feast Hotspots */}
        {(radar?.hotspots ?? []).map((h, idx) => {
          const p = toMap(h.x, h.y);
          const tide = h.kind === "tide";
          return (
            <g key={`hs-${idx}`}>
              <circle cx={p.x} cy={p.y} r={tide ? 7 : 5.5} fill={tide ? "rgba(126,242,212,0.3)" : "rgba(255, 168, 52, 0.24)"} />
              <circle cx={p.x} cy={p.y} r={tide ? 3.2 : 2.6} fill={tide ? "#2bb99d" : "#ff8a3d"} />
            </g>
          );
        })}

        {/* Pick-ups */}
        {(radar?.powerUps ?? []).map((u, idx) => {
          const p = toMap(u.x, u.y);
          return <rect key={`pu-${idx}`} x={p.x - 1.9} y={p.y - 1.9} width={3.8} height={3.8} rx={0.8} fill={POWER_INFO[u.kind].color} opacity={0.85} />;
        })}

        {/* Rival Snakes */}
        {(radar?.snakes ?? []).map((s) => {
          if (s.isPlayer) return null;
          const p = toMap(s.x, s.y);
          if (s.isBoss) {
            return (
              <g key={s.id}>
                <rect x={p.x - 3.6} y={p.y - 3.6} width={7.2} height={7.2} rx={1.4} fill="#ffcf4a" stroke="#8a6410" strokeWidth={0.8} transform={`rotate(45 ${p.x} ${p.y})`} />
              </g>
            );
          }
          if (s.isKing) {
            return (
              <g key={s.id}>
                <circle cx={p.x} cy={p.y} r={5.2} fill="rgba(245, 176, 37, 0.28)" />
                <polygon
                  points={`${p.x},${p.y - 4.2} ${p.x + 4},${p.y} ${p.x},${p.y + 4.2} ${p.x - 4},${p.y}`}
                  fill="#e6a117"
                  stroke="#ffffff"
                  strokeWidth={0.8}
                />
              </g>
            );
          }
          return <circle key={s.id} cx={p.x} cy={p.y} r={2.2} fill="rgba(45, 92, 78, 0.58)" />;
        })}

        {/* Player Heading Cone + Marker */}
        {player && (
          <g>
            <polygon
              points={`${playerPos.x},${playerPos.y} ${c1x},${c1y} ${c2x},${c2y}`}
              fill="rgba(28, 159, 133, 0.28)"
            />
            <circle cx={playerPos.x} cy={playerPos.y} r={4.6} fill="#173a30" />
            <circle cx={playerPos.x} cy={playerPos.y} r={3.1} fill={player.isKing ? "#ffd76a" : "#3ecfae"} />
          </g>
        )}
      </svg>
      <div className="pointer-events-none absolute bottom-1 left-2 right-2 flex items-center justify-between text-[7px] font-extrabold tracking-wider text-ink/40">
        <span>RADAR</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#e6a117]" />
          {t("蛇王")}
        </span>
      </div>
    </div>
  );
}
