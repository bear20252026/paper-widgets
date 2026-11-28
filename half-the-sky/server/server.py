"""Half the Sky — local server.

Serves the mirrored page and implements the two endpoints the page calls:

    GET  /api/chat        warm-up, 204
    POST /api/chat        {lang, persona, event, messages} -> SSE stream
    POST /api/nominate    {name, desc, source, contact, at, turnstile} -> JSON

With an OpenAI-compatible model configured (see env.example) the women
answer through it; without one the replies are composed from the same
records the page shows. Standard library only.

    python server.py [port]
"""

from __future__ import annotations

import collections
import hashlib
import json
import os
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import brain

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
PIECE_DIR = os.path.dirname(SERVER_DIR)  # the app itself lives one level up
MAX_BODY = 64 * 1024
NOMINATIONS = os.path.join(SERVER_DIR, "nominations.jsonl")
TURNSTILE_SECRET = os.environ.get("HTS_TURNSTILE_SECRET", "")
TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

NAME_OK = re.compile(r"[A-Za-z\u4e00-\u9fff\u0400-\u04ff\u0370-\u03ff\u0600-\u06ff]")

_hits: dict[str, collections.deque] = {}
_hits_lock = threading.Lock()
_write_lock = threading.Lock()


def _rate_ok(ip: str, bucket: str, limit: int, window: float) -> bool:
    now = time.monotonic()
    key = f"{bucket}:{ip}"
    with _hits_lock:
        q = _hits.setdefault(key, collections.deque())
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        return True


def _verify_turnstile(token: str, ip: str) -> bool:
    if not TURNSTILE_SECRET:
        return True  # local copy: the check is off unless a secret is set
    payload = urllib.parse.urlencode(
        {"secret": TURNSTILE_SECRET, "response": token, "remoteip": ip}
    ).encode()
    try:
        with urllib.request.urlopen(TURNSTILE_URL, data=payload, timeout=10) as r:
            return bool(json.load(r).get("success"))
    except Exception as exc:  # noqa: BLE001 - network failure should not accept
        print(f"[nominate] turnstile check failed: {exc}", flush=True)
        return False


class Handler(SimpleHTTPRequestHandler):
    server_version = "HalfTheSky/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PIECE_DIR, **kwargs)

    # ── plumbing ───────────────────────────────────────────────────────
    def _json(self, status: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            raise ValueError("bad content-length")
        data = json.loads(self.rfile.read(length) or b"{}")
        if not isinstance(data, dict):
            raise ValueError("body must be a JSON object")
        return data

    def do_GET(self) -> None:  # noqa: N802 - http.server API
        route = self.path.split("?", 1)[0]
        if route == "/api/chat":
            self.send_response(204)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if route.startswith("/api/"):
            self._json(404, {"error": "not found"})
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802 - http.server API
        route = self.path.split("?", 1)[0]
        try:
            if route == "/api/chat":
                self._chat()
            elif route == "/api/nominate":
                self._nominate()
            else:
                self._json(404, {"error": "not found"})
        except ValueError as exc:
            self._json(400, {"error": str(exc)})
        except BrokenPipeError:
            pass
        except Exception as exc:  # noqa: BLE001 - never take the server down
            print(f"[server] {route} failed: {type(exc).__name__}: {exc}", flush=True)
            try:
                self._json(500, {"error": "server error"})
            except Exception:
                pass

    # ── /api/chat ──────────────────────────────────────────────────────
    def _chat(self) -> None:
        ip = self.client_address[0]
        if not _rate_ok(ip, "chat", 40, 60):
            self._json(429, {"error": "too many requests"})
            return

        data = self._read_json()
        lang = data.get("lang") if data.get("lang") in {"en", "zh"} else "en"
        event = data.get("event") if data.get("event") in {"enter", "message"} else "message"
        persona = data.get("persona")
        if isinstance(persona, str):
            persona = persona.strip() or None
        else:
            persona = None
        messages = data.get("messages")
        if not isinstance(messages, list):
            messages = []

        started = time.monotonic()
        result = brain.reply(persona, lang, event, messages)
        took = int((time.monotonic() - started) * 1000)
        print(
            f"[chat] {result['speaker']:<26} event={event:<7} lang={lang} "
            f"mode={result['mode']:<7} match={result['match'] or '-':<24} {took}ms",
            flush=True,
        )

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

        text = result["reply"]
        # The page reveals the reply letter by letter; we keep that rhythm.
        step = 12 if lang == "en" else 8
        for i in range(0, len(text), step):
            chunk = text[i : i + step]
            frame = "data: " + json.dumps({"t": chunk}, ensure_ascii=False) + "\n\n"
            self.wfile.write(frame.encode("utf-8"))
            self.wfile.flush()
            time.sleep(0.018)

        done = {
            "done": True,
            "speaker": result["speaker"],
            "match": result["match"],
        }
        self.wfile.write(("data: " + json.dumps(done, ensure_ascii=False) + "\n\n").encode("utf-8"))
        self.wfile.flush()

    # ── /api/nominate ──────────────────────────────────────────────────
    def _nominate(self) -> None:
        ip = self.client_address[0]
        if not _rate_ok(ip, "nominate", 6, 60):
            self._json(429, {"error": "too many requests"})
            return

        data = self._read_json()
        name = str(data.get("name") or "").strip()
        if len(name) < 2 or len(name) > 80 or not NAME_OK.search(name):
            self._json(400, {"error": "invalid name"})
            return

        token = str(data.get("turnstile") or "")
        if TURNSTILE_SECRET and not _verify_turnstile(token, ip):
            self._json(403, {"error": "turnstile failed"})
            return

        entry = {
            "name": name,
            "desc": str(data.get("desc") or "").strip()[:2000],
            "source": str(data.get("source") or "").strip()[:500],
            "contact": str(data.get("contact") or "").strip()[:200],
            "lang": data.get("lang") if data.get("lang") in {"en", "zh"} else None,
            "received_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "ip": hashlib.sha256(ip.encode()).hexdigest()[:12],
        }
        line = json.dumps(entry, ensure_ascii=False)
        with _write_lock:
            with open(NOMINATIONS, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        print(f"[nominate] {name} -> nominations.jsonl", flush=True)
        self._json(200, {"ok": True})

    # ── quieter log ────────────────────────────────────────────────────
    def log_message(self, fmt: str, *args) -> None:
        if args and str(args[0]).startswith(("GET /api", "POST /api")):
            return  # already logged above
        sys.stdout.write(
            "%s %s\n" % (time.strftime("%H:%M:%S"), fmt % args)
        )


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("Half the Sky — local server")
    print(f"  http://localhost:{port}")
    print(f"  brain: {brain.model_mode()}")
    print(f"  nominations -> {os.path.relpath(NOMINATIONS, SERVER_DIR)}")
    print("  Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
