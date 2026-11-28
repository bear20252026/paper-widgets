// Builds every piece into site/, with the gallery page on top. No dependencies: npm builds each piece, node copies
// the result. Run `npm run site`, then `npm run serve`.
import { execSync } from "node:child_process";
import { cpSync, copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { pieces, staticPieces } from "./pieces.mjs";

// A static piece is copied whole, minus the workshop around it: its README, screenshot and the files a project
// keeps for itself (package.json, lint config, server, tests) are repo furniture, not part of the shelf.
const repoOnly = new Set([
  "README.md", "screenshot.webp", "package.json", "package-lock.json",
  ".gitignore", ".oxlintrc.json", "server", "tests", "node_modules", ".data",
]);

execSync("node scripts/build-galleries.mjs", { stdio: "inherit" });

rmSync("site", { recursive: true, force: true });
mkdirSync("site", { recursive: true });
mkdirSync("site/workshop", { recursive: true });

for (const piece of pieces) {
  console.log(`\n▸ ${piece}`);
  // relative asset paths, so every piece runs from a subfolder of any static host
  execSync(`npm --prefix ${piece} run build -- --base=./`, { stdio: "inherit" });
  cpSync(`${piece}/dist`, `site/${piece}`, { recursive: true });
}

for (const piece of staticPieces) {
  console.log(`\n▸ ${piece} (static, no build)`);
  cpSync(piece, `site/${piece}`, {
    recursive: true,
    filter: (src) => !repoOnly.has(src.split(/[\\/]/).pop()),
  });
}

copyFileSync("gallery/index.html", "site/index.html");
copyFileSync("gallery/gallery.css", "site/gallery.css");
copyFileSync("gallery/gallery.js", "site/gallery.js");
copyFileSync("gallery/workshop/index.html", "site/workshop/index.html");
writeFileSync("site/.nojekyll", ""); // GitHub Pages: keep every file, dotfiles aside
console.log(`\n✓ site/ — ${pieces.length + staticPieces.length} pieces, ready to serve (npm run serve)`);
