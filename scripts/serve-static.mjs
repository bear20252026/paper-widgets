// A no-dependency static server, shared by `npm run serve` (the built shelf) and `npm run dev:puzzle` (one static
// piece straight out of its folder).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

export function serveStatic(root, port, label) {
  createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
      let file = join(root, pathname.replace(/^[/\\]+/, ""));
      if (!file.startsWith(root)) {
        res.writeHead(403, { "content-type": "text/plain" }).end("forbidden");
        return;
      }
      let info = await stat(file).catch(() => null);
      if (info?.isDirectory()) {
        file = join(file, "index.html");
        info = await stat(file).catch(() => null);
      }
      if (!info?.isFile()) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "content-type": types[extname(file).toLowerCase()] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" }).end(String(error));
    }
  })
    .listen(port, "127.0.0.1", () => {
      console.log(`${label}: http://localhost:${port}/`);
    })
    .on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`port ${port} is busy — try: PORT=${port + 1} npm run ${label}`);
        process.exit(1);
      }
      throw error;
    });
}
