// A tiny static server for site/, so the gallery and every piece can be opened without extra tooling.
// Run `npm run site`, then `npm run serve` (http://localhost:4180).
import { fileURLToPath } from "node:url";
import { serveStatic } from "./serve-static.mjs";

serveStatic(fileURLToPath(new URL("../site/", import.meta.url)), Number(process.env.PORT ?? 4180), "serve");
