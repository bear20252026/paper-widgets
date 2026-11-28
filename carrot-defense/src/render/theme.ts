import type { TowerKind } from "../game/types";

export const COLORS = {
  grassA: "#86c97b",
  grassB: "#7cc072",
  grassEdge: "#5f9e57",
  path: "#ecd6a4",
  pathInner: "#f3e2b8",
  pathEdge: "#b8955a",
  hover: "rgba(255,255,255,0.28)",
  hoverBad: "rgba(255,80,80,0.22)",
  select: "#fff176",
  range: "rgba(255,255,255,0.16)",
  rangeStroke: "rgba(255,255,255,0.75)",
} as const;

export const TOWER_COLORS: Record<TowerKind, [string, string, string]> = {
  bottle: ["#4fc3f7", "#26c6da", "#ab47bc"],
  fan: ["#ffb74d", "#ff9800", "#f4511e"],
  sunflower: ["#ffee58", "#ffca28", "#ff8f00"],
  moon: ["#b39ddb", "#9575cd", "#5e35b1"],
  star: ["#81d4fa", "#4dd0e1", "#e0f7fa"],
  arrow: ["#a5d6a7", "#66bb6a", "#2e7d32"],
  cannon: ["#bcaaa4", "#8d6e63", "#4e342e"],
  sniper: ["#90caf9", "#42a5f5", "#1565c0"],
  tesla: ["#80d8ff", "#00b0ff", "#0091ea"],
  poison: ["#c5e1a5", "#9ccc65", "#558b2f"],
  mortar: ["#ffcc80", "#ffa726", "#ef6c00"],
  laser: ["#ef9a9a", "#ef5350", "#c62828"],
  spike: ["#ce93d8", "#ab47bc", "#6a1b9a"],
  goldmine: ["#ffe082", "#ffc107", "#ff8f00"],
  rocket: ["#ffab91", "#ff7043", "#d84315"],
  crossbow: ["#c5e1a5", "#8bc34a", "#33691e"],
  railgun: ["#b0bec5", "#78909c", "#37474f"],
  flame: ["#ffcc80", "#ff7043", "#bf360c"],
  boomerang: ["#ffe082", "#ffb300", "#e65100"],
  tornado: ["#b3e5fc", "#4fc3f7", "#0277bd"],
  frostpillar: ["#e1f5fe", "#81d4fa", "#0288d1"],
  minefield: ["#ef9a9a", "#e53935", "#8e0000"],
  prism: ["#ce93d8", "#ab47bc", "#4a148c"],
  bank: ["#fff59d", "#fdd835", "#f57f17"],
  obelisk: ["#b39ddb", "#7e57c2", "#4527a0"],
  shotgun: ["#ff8a80", "#ff5252", "#d32f2f"],
  grenade: ["#ffab91", "#ff7043", "#e64a19"],
  cutter: ["#ff5252", "#d32f2f", "#b71c1c"],
  magnet: ["#80deea", "#4dd0e1", "#00acc1"],
  medic: ["#a5d6a7", "#81c784", "#388e3c"],
  siege: ["#f48fb1", "#f06292", "#c2185b"],
  trap: ["#9e9e9e", "#757575", "#424242"],
  sonic: ["#e1bee7", "#ce93d8", "#8e24aa"],
  chrono: ["#b2dfdb", "#80cbc4", "#00897b"],
  nuke: ["#ffebee", "#ffcdd2", "#ef9a9a"],
};

export const PLATE_COLORS = ["#a1887f", "#cfd8dc", "#ffd54f"] as const;
export const LEVEL_SCALE = [0.9, 1.0, 1.12] as const;
export const FONT = '"PingFang SC","Microsoft YaHei",system-ui,sans-serif';
