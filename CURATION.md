# Curation

The library has two rooms. The **shelf** holds finished primary editions. The **workshop** holds cuts, studies and
prototypes that are worth opening but are not the finished piece. The split is a field in
`gallery/catalog.json`, not a physical move: no folder is deleted or relocated.

Counts in November 2026: **79 on the shelf, 24 in the workshop**.

## Categories

Every piece, on the shelf or in the workshop, carries one of six categories:

| Category | Scope |
| --- | --- |
| `data` | 数据 / 财务 / 表格 — dashboards, finance, tables and analytical views |
| `widget` | 小组件 / 工具 / 登录原型 — small tools, toggles, sign-in prototypes and utilities |
| `page` | 产品 / 内容网页 — product, editorial and content pages |
| `object` | 3D 物件 / 空间交互 — 3D objects, characters, products and spatial interactions |
| `scene` | 3D 场景 / 动画 — 3D environments, rooms, skies and animation |
| `play` | 游戏 — games and playable toys |

## What earns a place on the shelf

A piece goes on the shelf when all of these are true:

- It is the primary edition of the work — the one to open first.
- It runs in the browser as published, without a missing server, API key or hosted model.
- It delivers the work's main experience, not one technique or one bench view.
- No other piece on the shelf is the same work in a different cut.

A finished piece may still load a CDN library or use sample data; that is part of the piece. A piece whose interface is
complete but whose core action needs a backend belongs in the workshop until the backend travels with it.

## What goes in the workshop

| Kind | What it is | Example |
| --- | --- | --- |
| `early-cut` | A first pass superseded by a finished piece on the shelf. | Sable — Archive Wall; FL3 first cut |
| `source-cut` | The source cut, kept beside a playable edition. | Dusk Patrol source cut |
| `prototype` | An interaction prototype that stops before a real service. | WeChat Login |
| `server-cut` | The interface is here; the service it needs is not. | Shoebox, Audio Storybooks, Room Visualizer, AI Talk Radio, Ensemble, Parking Bench |
| `alternate` | Another edition, camera or visual treatment of a shelf piece. | Aetheria Panorama, the two dormitory cuts, stylized Koi, Golden Hour Fox close cut |
| `study` | A single-technique experiment, bench build or character study. | Seam Transitions, Great White Jelly, ATX / FL3 / Starship bench studies |

## The rules

1. **One primary edition per work on the shelf.** Other cuts go to the workshop, with a note saying what they are.
2. **A missing service moves the piece, not the promise.** Server-dependent shelf cuts keep their interface and their
   sample data, but they do not sit beside finished pieces until the service is part of the piece.
3. **A study is not a finished piece just because it is polished.** If the piece demonstrates one technique, one bench
   or one character rather than the main experience, it belongs in the workshop.
4. **Nothing is deleted.** The workshop is a second room, not a bin. Every folder keeps its README, source and assets.
5. **The note explains the decision.** Every workshop card says why it is there, in one sentence, so the room is
   browsable rather than a pile.

## Changing a decision

Edit the piece's record in `gallery/catalog.json`:

- `tier`: `shelf` or `workshop`
- `kind`: required for workshop pieces; one of the six kinds above
- `note`: required for workshop pieces; one sentence on why it is there

Then run:

```bash
npm run galleries
npm run readme
```

Both pages and the README catalogue are generated from the same catalog, so they cannot drift apart. The build
(`npm run site`) runs `build-galleries.mjs` before copying the pages into `site/`.
