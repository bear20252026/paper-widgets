"""Local preview for the Minion Lab mirror.

Serves this folder on http://localhost:8000 so the relative asset paths,
fetch('bricks.json') and the town iframes resolve over HTTP (canvas pixel
reads need a same-origin page).

    python serve.py [port]
"""

import functools
import http.server
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(ROOT)
    handler = functools.partial(Handler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), handler) as httpd:
        print(f"Minion Lab -> http://localhost:{PORT}  (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
