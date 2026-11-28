# Paper Widgets

Seven everyday widgets in one paper-white style with a single ultramarine accent, on an 11-second loop: weather in
Lisbon, now playing, focus timer, steps, batteries, the day's calendar, and a focus-mode switch that turns its tile
dark.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## How it works

React renders the stage once. Every frame `draw(t)` (`src/lib/clock.ts`) hands the loop time to each component's
writer, which writes its own elements through refs — inline styles, `textContent`, SVG attributes, class toggles. No
React state per frame, so the whole piece runs on one clock. Motion numbers live in `src/lib/timeline.ts`; the copy
and data in `src/lib/content.ts`; the computed positions in `src/lib/layout.ts`.

## Frame-exact export

`window.__render(t)` draws any moment of the 11-second loop. Set `window.__RENDERING__ = true` before the page loads
and the live loop never starts, so a recorder can call `__render(t)` and screenshot frame by frame. Otherwise the loop
plays from t = 0 once the fonts have loaded.

## Reduced motion

With `prefers-reduced-motion: reduce` the loop doesn't run: the stage holds the still at t = 5.3 — everything in, Low
Tide at 1:16, focus on.

Built with React 19, Vite 8 and TypeScript 7; nothing beyond React. Type is Geist, Geist Mono and Inter from Google
Fonts.
