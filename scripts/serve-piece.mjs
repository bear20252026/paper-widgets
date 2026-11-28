// Serves one static piece straight from its folder — no build, no install. `npm run dev:puzzle` or
// `npm run dev:lumiloom` → localhost:5173, the same port the Vite pieces use, so only one piece runs at a time.
import { fileURLToPath } from "node:url";
import { serveStatic } from "./serve-static.mjs";

const piece = process.argv[2] ?? "puzzlecard";
serveStatic(fileURLToPath(new URL(`../${piece}/`, import.meta.url)), Number(process.env.PORT ?? 5173), `dev:${piece}`);
