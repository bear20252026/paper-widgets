// Builds the two public rooms from gallery/catalog.json: the finished shelf and the workshop.
// The catalog is the table of contents; edit it, then run `npm run galleries` (or `npm run site`).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "gallery", "catalog.json"), "utf8"));

const categoryOrder = [
  { id: "data", title: "Data", note: "Dashboards, finance, tables and analytical views · 数据 / 财务 / 表格" },
  { id: "widget", title: "Widget", note: "Small tools, toggles, sign-in prototypes and utilities · 小组件 / 工具 / 登录原型" },
  { id: "page", title: "Page", note: "Product, editorial and content pages · 产品 / 内容网页" },
  { id: "object", title: "Object", note: "3D objects, characters, products and spatial interactions · 3D 物件 / 空间交互" },
  { id: "scene", title: "Scene", note: "3D environments, rooms, skies and animation · 3D 场景 / 动画" },
  { id: "play", title: "Play", note: "Games and playable toys · 游戏" },
];

const kindOrder = [
  { id: "early-cut", title: "Early cuts", note: "First passes, kept beside the finished piece." },
  { id: "source-cut", title: "Source cuts", note: "The source cut, kept beside the playable piece." },
  { id: "prototype", title: "Prototypes", note: "Interaction prototypes that stop before a real service." },
  { id: "server-cut", title: "Server cuts", note: "The interface is here; the service it needs is not." },
  { id: "study", title: "Studies", note: "Single-technique experiments, bench builds and character studies." },
  { id: "alternate", title: "Alternate editions", note: "Second cuts of a finished piece, kept for comparison." },
];

const kindLabel = {
  "early-cut": "Early cut",
  "source-cut": "Source cut",
  "prototype": "Prototype",
  "server-cut": "Server cut",
  "study": "Study",
  alternate: "Alternate edition",
};

const shelf = catalog.pieces.filter((piece) => piece.tier === "shelf");
const workshop = catalog.pieces.filter((piece) => piece.tier === "workshop");
if (shelf.length !== 78 || workshop.length !== 24) {
  throw new Error(`catalog tier split is ${shelf.length}/${workshop.length}, expected 78/24`);
}
for (const piece of catalog.pieces) {
  if (!fs.existsSync(path.join(root, piece.id))) throw new Error(`missing piece folder: ${piece.id}`);
}

const pad = (n) => String(n).padStart(2, "0");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function card(piece, number, workshopPage) {
  const href = workshopPage ? piece.href.replace(/^\.\//, "../") : piece.href;
  const status = workshopPage
    ? `<div class="statusrow"><span class="status status--${piece.kind}">${kindLabel[piece.kind]}</span></div>`
    : "";
  const note = workshopPage && piece.note ? `<p class="why">${piece.note}</p>` : "";
  const statusLine = status ? `              ${status}\n` : "";
  const noteLine = note ? `              ${note}\n` : "";
  const searchText = workshopPage
    ? `${piece.dataText} ${kindLabel[piece.kind]} ${piece.note}`
    : piece.dataText;
  return `          <a class="piece" href="${href}" data-text="${searchText}" data-kind="${piece.kind}" data-category="${piece.category}">
            <div class="plate ${piece.plate}" style="--a:${piece.accent.a};--b:${piece.accent.b};--m:${piece.accent.m}">
              <span class="no">${workshopPage ? "W" : ""}${pad(number)}</span>
              <span class="motif" aria-hidden="true"></span>
            </div>
            <div class="copy">
${statusLine}              <div class="line"><h3>${piece.title}</h3><span class="arrow" aria-hidden="true">↗</span></div>
${noteLine}              <p>${piece.copy}</p>
              <ul class="tags">${piece.tags.map((tag) => `<li>${tag}</li>`).join("")}</ul>
            </div>
          </a>`;
}

function section(id, title, note, count, cards, field) {
  return `        <section class="section" id="${id}" data-${field}="${id}">
          <div class="sec-head">
            <h2>${title}</h2>
            <span class="sec-note">${plural(count, "piece")} · ${note}</span>
          </div>
          <div class="grid">
${cards}
          </div>
        </section>`;
}

function chips(items, field, labels) {
  return `        <div class="filters" data-filter-field="${field}" aria-label="Filter by ${field}">
          <button class="chip is-active" type="button" data-filter="all" aria-pressed="true">All</button>
${items.map((item) => `          <button class="chip" type="button" data-filter="${item}" aria-pressed="false">${labels[item]}</button>`).join("\n")}
        </div>`;
}

let shelfNumber = 0;
const shelfSections = categoryOrder.map((meta) => {
  const pieces = shelf.filter((piece) => piece.category === meta.id);
  if (!pieces.length) throw new Error(`no shelf pieces in ${meta.id}`);
  const cards = pieces.map((piece) => card(piece, ++shelfNumber, false)).join("\n");
  return section(meta.id, meta.title, meta.note, pieces.length, cards, "category");
});

let workshopNumber = 0;
const workshopSections = categoryOrder.map((meta) => {
  const pieces = workshop.filter((piece) => piece.category === meta.id);
  if (!pieces.length) throw new Error(`no workshop pieces in ${meta.id}`);
  const cards = pieces.map((piece) => card(piece, ++workshopNumber, true)).join("\n");
  return section(meta.id, meta.title, meta.note, pieces.length, cards, "category");
});

const labels = {
  data: "Data",
  widget: "Widget",
  page: "Page",
  object: "Object",
  scene: "Scene",
  play: "Play",
  all: "All",
};

const commonHead = (title, description, total, cssHref) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="icon" href="data:," />
    <link rel="stylesheet" href="${cssHref}" />
  </head>
  <body data-total="${total}">
    <div class="page">
`;

const mainPage = `${commonHead(
  "Paper — a shelf of finished pieces in six categories",
  "A shelf of 78 finished, self-contained pieces in six categories — data, widget, page, object, scene and play — with a separate workshop of 24 cuts, studies and prototypes.",
  shelf.length,
  "./gallery.css",
)}      <header class="mast">
        <div class="brand"><i></i>Paper</div>
        <nav>
          <a href="#data" data-sec>Data</a>
          <a href="#widget" data-sec>Widget</a>
          <a href="#page" data-sec>Page</a>
          <a href="#object" data-sec>Object</a>
          <a href="#scene" data-sec>Scene</a>
          <a href="#play" data-sec>Play</a>
          <a href="./workshop/">Workshop ↗</a>
          <a href="https://bear20252026.github.io/frontier-atlas/">Atlas ↗</a>
          <a href="https://github.com/bear20252026/paper-widgets">GitHub ↗</a>
        </nav>
      </header>

      <main>
        <section class="intro">
          <p class="eyebrow">Finished shelf · ${shelf.length} pieces · updated November 2026</p>
          <h1>Finished pieces, kept together.</h1>
          <p class="lead">
            Every piece here is a complete, self-contained browser app you can lift out and run on its own — data
            desks and finance tables, small tools and sign-ins, product and editorial pages, 3D objects and spatial
            interactions, scenes and animations, games and toys. No shared package, no monorepo: a piece is a folder,
            its README, and the code it needs. The 24 early cuts, source cuts, prototypes, server-dependent demos
            and studies are in a <a href="./workshop/">separate Workshop</a>, so they do not dilute the shelf.
          </p>
          <div class="tools">
            <label class="search">
              <span>Filter</span>
              <input id="q" type="search" placeholder="name, stack, mood — try “three”" autocomplete="off" />
            </label>
            <span class="count" id="count">${plural(shelf.length, "piece")}</span>
          </div>
${chips(categoryOrder.map((s) => s.id), "category", labels)}
        </section>

${shelfSections.join("\n\n")}

        <p class="empty" id="empty">Nothing on the shelf matches that. Try a shorter word, or open the Workshop.</p>
      </main>

      <footer>
        <p class="eyebrow">Run a piece on its own</p>
        <p class="cmds">
          <code>npm run install:pieces</code><code>npm run dev -- night-dial</code><code>npm run site</code><code>npm run serve</code>
        </p>
        <p class="fine">
          Vite pieces build with a relative base; static pieces are copied as they are. Some static scenes load
          three.js from a CDN, so they need a network connection. Everything else is in the folder.
        </p>
        <p class="fine">
          The <a href="./workshop/">Workshop</a> keeps the other ${workshop.length} — early cuts, source cuts,
          prototypes, server-dependent shelf cuts, alternate editions and single-technique studies. Same category
          taxonomy, separate room; nothing is deleted.
        </p>
        <p class="fine">
          Pieces arrive as they were published, or recovered from a public deployment when no repository exists. All
          are kept with their credit intact; unless a piece says otherwise, no licence is granted beyond reading and
          learning. Six arrivals name their authors in their own READMEs: mrdoob's New York, Guillermo Rauch's record
          player, Will Eastcott's splat shop, Robin Payot's Codrops tutorial, Yuri Artiukh's eighteen Codevember days
          and curllmooha's twenty-three.
        </p>
        <p class="fine"><b>Linked arrival, not counted above:</b> <a href="https://mjurczyk.github.io/openvdb/">OpenVDB</a> (Object / tool, <a href="https://github.com/bear20252026/openvdb">own fork</a>). Rain Alley’s film stays upstream; its <a href="./rain-alley-source/">source layer</a> is in the Workshop.</p>
      </footer>
    </div>
    <script src="./gallery.js"></script>
  </body>
</html>
`;

const workshopPage = `${commonHead(
  "Paper Workshop — cuts, studies and prototypes",
  "The workshop room: 24 early cuts, source cuts, prototypes, server-dependent shelf cuts, alternate editions and studies, kept apart from the 78 finished pieces.",
  workshop.length,
  "../gallery.css",
)}      <header class="mast">
        <div class="brand"><i></i>Paper Workshop</div>
        <nav>
          <a href="../">Shelf ↗</a>
          <a href="https://bear20252026.github.io/frontier-atlas/">Atlas ↗</a>
          <a href="https://github.com/bear20252026/paper-widgets">GitHub ↗</a>
        </nav>
      </header>

      <main>
        <section class="intro">
          <p class="eyebrow">Workshop · ${workshop.length} pieces · updated November 2026</p>
          <h1>Cuts, studies and prototypes.</h1>
          <p class="lead">
            The shelf holds ${shelf.length} finished pieces. This room holds the rest: early cuts, source cuts,
            prototypes, server-dependent shelf cuts, alternate editions and single-technique studies — kept because
            the code and the attempt are worth opening, not because they are finished. Every entry keeps its kind
            badge and is grouped under the same six categories as the shelf. Nothing here is deleted; it is
            simply not mixed into the shelf.
          </p>
          <div class="tools">
            <label class="search">
              <span>Filter</span>
              <input id="q" type="search" placeholder="name, stack, mood — try “study”" autocomplete="off" />
            </label>
            <span class="count" id="count">${plural(workshop.length, "piece")}</span>
          </div>
${chips(categoryOrder.map((s) => s.id), "category", labels)}
        </section>

${workshopSections.join("\n\n")}

        <p class="empty" id="empty">Nothing in the workshop matches that. Try a shorter word, or go back to the shelf.</p>
      </main>

      <footer>
        <p class="eyebrow">Why this room exists</p>
        <p class="fine">
          A finished piece is the primary edition of a work, complete in the browser without a missing service. The
          workshop holds everything else: first passes, source cuts, prototypes, server-dependent shelf cuts, alternate
          editions and single-technique studies. The <a href="../">shelf</a> holds ${shelf.length} finished pieces;
          this room holds ${workshop.length}.
        </p>
        <p class="cmds">
          <code>npm run install:pieces</code><code>npm run dev -- night-dial</code><code>npm run site</code><code>npm run serve</code>
        </p>
        <p class="fine">
          Vite pieces build with a relative base; static pieces are copied as they are. Some static scenes load
          three.js from a CDN, so they need a network connection. Everything else is in the folder.
        </p>
        <p class="fine">
          All pieces keep their credit. Unless a piece says otherwise, no licence is granted beyond reading and
          learning. The classification lives in <code>gallery/catalog.json</code> and <code>CURATION.md</code>.
        </p>
      </footer>
    </div>
    <script src="../gallery.js"></script>
  </body>
</html>
`;

fs.mkdirSync(path.join(root, "gallery", "workshop"), { recursive: true });
fs.writeFileSync(path.join(root, "gallery", "index.html"), mainPage);
fs.writeFileSync(path.join(root, "gallery", "workshop", "index.html"), workshopPage);
console.log(`galleries: ${shelf.length} finished / ${workshop.length} workshop`);
console.log(`sections: ${shelfSections.length} shelf, ${workshopSections.length} workshop`);
