/**
 * Pull the `women` array and the `QUOTES` map out of index.html into JSON,
 * so the local backend reads exactly the same data the page renders.
 *
 *   node tools/extract-data.js [path/to/index.html] [outDir]
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..", "..");  // the piece folder
const htmlPath = path.resolve(root, process.argv[2] || "index.html");
const outDir = path.resolve(__dirname, "..", process.argv[3] || "data");

const html = fs.readFileSync(htmlPath, "utf8");

/** Starting at `from`, return the balanced literal that follows. */
function balanced(from) {
  const open = html.indexOf(from);
  if (open < 0) throw new Error(`cannot find ${from}`);
  const start = open + from.length;
  const opener = html[start];
  const closer = opener === "[" ? "]" : "}";
  let depth = 0;
  let quote = null;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === opener) depth++;
    else if (ch === closer && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`unbalanced ${from}`);
}

function evaluate(literal) {
  // The literals are plain data; evaluate them in an empty context.
  return vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 2000 });
}

const women = evaluate(balanced("const women = "));
const quotes = evaluate(balanced("const QUOTES = "));

const slugs = women.map((w) => w.img.replace(/^reliefs\//, "").replace(/\.webp$/, ""));
if (new Set(slugs).size !== slugs.length) throw new Error("duplicate slugs");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "women.json"), JSON.stringify(women, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "quotes.json"), JSON.stringify(quotes, null, 2) + "\n");

console.log(`women: ${women.length}`);
console.log(`quotes: ${Object.keys(quotes).length}`);
console.log(`first: ${women[0].latin} (${slugs[0]})`);
