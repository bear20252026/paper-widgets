"""Smoke test for the local API. Run the server first, then:

    python tools/smoke_test.py [port]
"""

from __future__ import annotations

import json
import sys
import urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
BASE = f"http://localhost:{PORT}"


def post(path: str, payload: dict):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return urllib.request.urlopen(req, timeout=60)


def read_sse(resp):
    chunks, done = [], None
    for raw in resp:
        line = raw.decode("utf-8").strip()
        if not line.startswith("data: "):
            continue
        obj = json.loads(line[6:])
        if "t" in obj:
            chunks.append(obj["t"])
        elif obj.get("done"):
            done = obj
    return "".join(chunks), done


def main() -> int:
    failures = []

    with urllib.request.urlopen(BASE + "/", timeout=10) as r:
        length = len(r.read())
        print(f"GET /            {r.status}  {length} bytes")
        if r.status != 200 or length < 100000:
            failures.append("home page")

    with urllib.request.urlopen(BASE + "/reliefs/lin-huiyin.webp", timeout=10) as r:
        length = len(r.read())
        ctype = r.headers["Content-Type"]
        print(f"GET relief       {r.status}  {ctype} {length} bytes")
        if r.status != 200 or length < 1000:
            failures.append("relief image")

    req = urllib.request.Request(BASE + "/api/chat", method="GET")
    with urllib.request.urlopen(req, timeout=10) as r:
        print(f"GET /api/chat    {r.status}  (warm-up)")
        if r.status != 204:
            failures.append("warm-up")

    reply, done = read_sse(post("/api/chat", {
        "lang": "en",
        "persona": None,
        "event": "message",
        "messages": [{"role": "user", "content": "Who was the first woman to win a Nobel Prize?"}],
    }))
    print(f"POST /api/chat   {len(reply)} chars, speaker={done and done.get('speaker')}, "
          f"match={done and done.get('match')}")
    print(f"  reply: {reply[:120]}…")
    if not reply or not done or done.get("match") != "marie-curie":
        failures.append("clio answer")

    reply, done = read_sse(post("/api/chat", {
        "lang": "zh",
        "persona": "lin-huiyin",
        "event": "enter",
        "messages": [{"role": "assistant", "content": "你走到了林徽因的浮雕前。", "speaker": "clio"}],
    }))
    print(f"POST /api/chat   persona lin-huiyin, {len(reply)} chars, speaker={done and done.get('speaker')}")
    print(f"  reply: {reply[:80]}…")
    if not reply or not done or done.get("speaker") != "lin-huiyin":
        failures.append("persona answer")

    with post("/api/nominate", {"name": "测试 名字", "desc": "smoke test", "contact": "@smoke"}) as r:
        body = r.read()
        print(f"POST /api/nominate {r.status}  {body.decode()}")
        if r.status != 200 or not json.loads(body).get("ok"):
            failures.append("nominate")

    print("\nOK" if not failures else "\nFAILED: " + ", ".join(failures))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
