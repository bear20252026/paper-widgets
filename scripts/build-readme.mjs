// Rewrites the catalogue part of README.md from gallery/catalog.json.
// The prose above and below stays put; the block between "## The shelf" and "## The library page" is generated.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "gallery", "catalog.json"), "utf8"));
const readmePath = path.join(root, "README.md");

const sectionOrder = [
  ["data", "Data — 数据 / 财务 / 表格"],
  ["widget", "Widget — 小组件 / 工具 / 登录原型"],
  ["page", "Page — 产品 / 内容网页"],
  ["object", "Object — 3D 物件 / 空间交互"],
  ["scene", "Scene — 3D 场景 / 动画"],
  ["play", "Play — 游戏"],
];

const kindOrder = [
  ["early-cut", "Early cuts"],
  ["source-cut", "Source cuts"],
  ["prototype", "Prototypes"],
  ["server-cut", "Server cuts"],
  ["study", "Studies"],
  ["alternate", "Alternate editions"],
];

const kindLabel = {
  "early-cut": "Early cut",
  "source-cut": "Source cut",
  prototype: "Prototype",
  "server-cut": "Server cut",
  study: "Study",
  alternate: "Alternate edition",
};

const shelf = catalog.pieces.filter((piece) => piece.tier === "shelf");
const workshop = catalog.pieces.filter((piece) => piece.tier === "workshop");
const decode = (value) => value
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;/g, " ");

const item = (piece) => {
  const title = decode(piece.title);
  const copy = decode(piece.copy).replace(/\s+/g, " ").trim();
  const why = piece.tier === "workshop" ? ` *Workshop (${kindLabel[piece.kind]}): ${decode(piece.note)}*` : "";
  return `- [${title}](./${piece.id}) — ${copy}${why}`;
};

const shelfBlocks = sectionOrder.map(([id, title]) => {
  const pieces = shelf.filter((piece) => piece.category === id);
  return `### ${title} (${pieces.length} finished ${pieces.length === 1 ? "piece" : "pieces"})\n\n${pieces.map(item).join("\n")}`;
});

const workshopBlocks = sectionOrder.map(([id, title]) => {
  const pieces = workshop.filter((piece) => piece.category === id);
  return `### ${title} (${pieces.length} workshop ${pieces.length === 1 ? "piece" : "pieces"})\n\n${pieces.map(item).join("\n")}`;
});

const generated = `## The shelf

**${shelf.length} finished pieces, kept together.** Every piece here is the primary edition of a work: it runs in the
browser as published, without a missing service. The other ${workshop.length} cuts, studies and prototypes are in the
[Workshop](./gallery/workshop/index.html), separately.

${shelfBlocks.join("\n\n")}

## The workshop

**${workshop.length} cuts, studies and prototypes, kept apart.** The [Workshop](./gallery/workshop/index.html) holds
early cuts, source cuts, prototypes, server-dependent shelf cuts, alternate editions and single-technique studies —
pieces that are worth opening but are not the finished edition. Each entry keeps its kind badge and sits under the
same six categories as the shelf. Nothing is deleted; it is simply not mixed into the shelf.

${workshopBlocks.join("\n\n")}
`;

const readme = fs.readFileSync(readmePath, "utf8");
const start = readme.indexOf("## The shelf");
const end = readme.indexOf("## The library page");
if (start < 0 || end < 0 || end <= start) throw new Error("README is missing the shelf / library page markers");
fs.writeFileSync(readmePath, readme.slice(0, start) + generated + "\n" + readme.slice(end));
console.log(`readme: ${shelf.length} finished / ${workshop.length} workshop`);
