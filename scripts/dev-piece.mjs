// Runs one piece from the shelf root: `npm run dev -- night-dial`. Vite pieces start their own dev server;
// static pieces are served by the no-dependency server in serve-piece.mjs.
import { spawn } from "node:child_process";
import { pieces, staticPieces } from "./pieces.mjs";

const name = process.argv[2];

if (!name) {
  console.log("Usage: npm run dev -- <piece>\n");
  console.log("Vite pieces:");
  for (const p of pieces) console.log(`  ${p}`);
  console.log("\nStatic pieces:");
  for (const p of staticPieces) console.log(`  ${p}`);
  process.exit(0);
}

if (staticPieces.includes(name)) {
  const child = spawn(process.execPath, ["scripts/serve-piece.mjs", name], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
} else if (pieces.includes(name)) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(npm, ["--prefix", name, "run", "dev"], { stdio: "inherit", shell: true });
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  console.error(`Unknown piece: ${name}`);
  process.exit(1);
}
