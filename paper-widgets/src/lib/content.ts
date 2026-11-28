/** The words and data on the widgets. All names are fictional. */

export const WEATHER = {
  city: "Lisbon",
  range: "H 26° · L 17°",
  temp: 24, // counts up from 0
  sky: "Clear",
  sunrise: "07:42",
  sunset: "18:31",
};

export type Track = {
  title: string;
  artist: string;
  length: number; // seconds
  from: number; // where it is when the loop starts playing it, seconds
};

export const NOW_PLAYING = {
  label: "Now playing",
  coverMark: "LT—01", // printed on the first cover
  tracks: [
    { title: "Low Tide", artist: "Marina Vale", length: 228, from: 72 },
    { title: "Paper Moons", artist: "Ode Club", length: 245, from: 0 },
  ] satisfies Track[],
};

export const TIMER = {
  label: "Focus timer",
  minutes: 25,
  caption: "Deep work",
};

export const STEPS = {
  label: "Steps",
  count: 8240,
  goal: "of 10,000 · 82%",
  days: ["M", "T", "W", "T", "F", "S", "S"], // the last one is today
  heights: [0.62, 0.84, 0.48, 0.92, 0.7, 0.36, 0.82], // share of the bar
};

export type Device = { icon: "phone" | "watch" | "buds"; name: string; level: number; charging: boolean };

export const BATTERIES = {
  label: "Batteries",
  devices: [
    { icon: "phone", name: "Phone", level: 0.64, charging: true },
    { icon: "watch", name: "Watch", level: 0.38, charging: false },
    { icon: "buds", name: "Buds", level: 0.91, charging: false },
  ] satisfies Device[],
};

export type CalendarEvent = { time: string; title: string; detail: string };

export const CALENDAR = {
  weekday: "Thursday",
  day: "30",
  month: "October",
  summary: "4 events today",
  events: [
    { time: "10:00", title: "Design review", detail: "Studio · 45 min" },
    { time: "13:30", title: "Lunch with Ana", detail: "Café Lua" },
    { time: "16:00", title: "Studio sync", detail: "Video call · 30 min" },
    { time: "18:30", title: "Run", detail: "Riverside · 5 km" },
  ] satisfies CalendarEvent[],
  chips: ["in 20 min", "in 3 h"], // time to the next event, before and after the roll
};

export const FOCUS = {
  label: "Focus",
  off: { state: "Off", caption: "Tap to silence" },
  on: { state: "On", caption: "Until 12:00 · 6 apps quiet" },
};
