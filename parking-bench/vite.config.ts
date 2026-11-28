import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { handleRaceApiRequest } from './src/server/raceApiHandler.mjs';

interface MiddlewareReq {
  url?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { setNoDelay?: (noDelay?: boolean) => void } | null;
  on(event: string, listener: (...args: any[]) => void): unknown;
  destroy(): void;
}

interface MiddlewareRes {
  statusCode: number;
  headersSent: boolean;
  writableEnded: boolean;
  socket?: { setNoDelay?: (noDelay?: boolean) => void } | null;
  setHeader(name: string, value: string): void;
  writeHead(statusCode: number, headers?: Record<string, string>): unknown;
  flushHeaders?: () => void;
  write(chunk: string): boolean;
  end(chunk?: string): unknown;
}

interface MiddlewareHost {
  middlewares: {
    use: (
      fn: (
        req: MiddlewareReq,
        res: MiddlewareRes,
        next: () => void,
      ) => void,
    ) => unknown;
  };
}

function parkingBenchServerApiPlugin(env: Record<string, string>): Plugin {
  const attach = (server: MiddlewareHost) => {
    server.middlewares.use(
      (req: MiddlewareReq, res: MiddlewareRes, next: () => void) => {
        const pathname = (req.url || '/').split('?')[0];
        if (pathname !== '/api/race/plan' && pathname !== '/api/health') {
          next();
          return;
        }
        handleRaceApiRequest(req, res, env).catch((err: unknown) => {
          console.error('[vite-api] Unhandled /api error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ ok: false, error: 'Internal server error.' }));
          } else if (!res.writableEnded) {
            res.end();
          }
        });
      },
    );
  };

  return {
    name: 'parking-bench-server-api',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig(({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), parkingBenchServerApiPlugin(env)],
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 3000,
    },
  };
});
