export type Stat = { label: string; value: string };

export type World = {
  id: string;
  index: string;
  name: string;
  eyebrow: string;
  headline: [string, string];
  blurb: string;
  image: string;
  accent: string;
  stats: Stat[];
};

export const WORLDS: World[] = [
  {
    id: "salt",
    index: "01",
    name: "Salt Flat",
    eyebrow: "Mirror Stage",
    headline: ["Mirror", "Mile"],
    blurb:
      "Knee-deep reflection for sixty kilometres. The sky is under you too, so every stride lands twice and the horizon never gets closer.",
    image: "images/world-salt.jpg",
    accent: "#c9a4dd",
    stats: [
      { label: "Surface", value: "Salt crust / 40mm water" },
      { label: "Temperature", value: "41 °C" },
      { label: "Hazard", value: "Mirror blindness" },
      { label: "Best stride", value: "9.42 m" },
    ],
  },
  {
    id: "village",
    index: "02",
    name: "Village Road",
    eyebrow: "Courier Kit",
    headline: ["Pack", "Light"],
    blurb:
      "Bougainvillea arches, citrus groves and cobble that punishes heavy footfall. Unlock courier kit with every drop you carry.",
    image: "images/world-village.jpg",
    accent: "#e4762b",
    stats: [
      { label: "Surface", value: "Cobble & dry dust" },
      { label: "Temperature", value: "33 °C" },
      { label: "Hazard", value: "Arch crosswind" },
      { label: "Best stride", value: "8.10 m" },
    ],
  },
  {
    id: "shore",
    index: "03",
    name: "Tropical Shore",
    eyebrow: "Tide Window",
    headline: ["Tide", "Chaser"],
    blurb:
      "Wet sand, incoming water and a headwind that only exists at the shoreline. Miss the rhythm of the sets and you swim the rest.",
    image: "images/world-shore.jpg",
    accent: "#2fb3a6",
    stats: [
      { label: "Surface", value: "Wet sand / shell" },
      { label: "Temperature", value: "29 °C" },
      { label: "Hazard", value: "Incoming tide" },
      { label: "Best stride", value: "8.86 m" },
    ],
  },
];

export const KIT = [
  {
    name: "Courier Sash",
    spec: "Waxed canvas, brass buckle, sits above the stride line",
    figure: "0.34",
    unit: "kg",
  },
  {
    name: "Dust-Proof Sole",
    spec: "Salt-rated grip, 4mm lugs, self-clearing tread",
    figure: "0.11",
    unit: "kg",
  },
  {
    name: "Ear-Lock Hood",
    spec: "Holds shape in crosswind above 40 km/h",
    figure: "0.07",
    unit: "kg",
  },
  {
    name: "Flask 0.4 L",
    spec: "One-hand draw, no stride loss on the swap",
    figure: "0.42",
    unit: "kg",
  },
];

export const ROUTES = [
  { name: "Mirror Mile", world: "Salt Flat", length: "60.2", record: "4:12.08" },
  { name: "Arch Run", world: "Village Road", length: "12.8", record: "0:58.41" },
  { name: "Tide Line", world: "Tropical Shore", length: "24.4", record: "1:47.90" },
];

export const STANDINGS = [
  { rank: "01", runner: "K. Maroub", world: "Salt Flat", time: "4:12.08", tier: "Golden" },
  { rank: "02", runner: "T. Voss", world: "Village Road", time: "4:12.66", tier: "Golden" },
  { rank: "03", runner: "A. Ndiaye", world: "Tropical Shore", time: "4:13.90", tier: "Silver" },
  { rank: "04", runner: "R. Halle", world: "Salt Flat", time: "4:15.02", tier: "Silver" },
  { rank: "05", runner: "M. Okonkwo", world: "Village Road", time: "4:16.44", tier: "Bronze" },
  { rank: "06", runner: "S. Ibrahim", world: "Tropical Shore", time: "4:18.71", tier: "Bronze" },
];
