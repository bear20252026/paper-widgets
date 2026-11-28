// Installs every Vite piece that has no node_modules yet. Pieces with a lockfile use `npm ci`; the rest fall back
// to `npm install`. This is what the Pages workflow runs before `npm run site`.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { pieces } from "./pieces.mjs";

for (const piece of pieces) {
  if (existsSync(`${piece}/node_modules`)) {
    console.log(`✓ ${piece} — already installed`);
    continue;
  }
  const command = existsSync(`${piece}/package-lock.json`)
    ? `npm --prefix ${piece} ci --no-audit --no-fund`
    : `npm --prefix ${piece} install --no-audit --no-fund`;
  console.log(`\n▸ ${piece} — ${command}`);
  execSync(command, { stdio: "inherit" });
}
console.log(`\n✓ ${pieces.length} Vite pieces installed`);
