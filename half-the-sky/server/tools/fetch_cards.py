"""Refresh data/cards from the women-on-the-wall dataset.

    python tools/fetch_cards.py

Cards are CC BY-SA 4.0, (c) yuxuan-o-o:
https://github.com/yuxuan-o-o/women-on-the-wall
"""

from __future__ import annotations

import json
import os
import time
import urllib.request

BASE = "https://raw.githubusercontent.com/yuxuan-o-o/women-on-the-wall/main/women"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "cards")

IDS = [
    "ada-lovelace", "amelia-earhart", "artemisia-gentileschi", "begum-rokeya",
    "benazir-bhutto", "bertha-lutz", "catherine-the-great", "ching-shih",
    "clara-zetkin", "cleopatra", "elizabeth-garrett-anderson", "emmeline-pankhurst",
    "florence-nightingale", "frida-kahlo", "funmilayo-ransome-kuti", "harriet-tubman",
    "hedy-lamarr", "huda-shaarawi", "hypatia", "junko-tabei", "kate-sheppard",
    "lin-huiyin", "lin-qiaozhi", "marie-curie", "mary-wollstonecraft", "maya-angelou",
    "olympe-de-gouges", "rosalind-franklin", "ruth-bader-ginsburg", "shirley-chisholm",
    "simone-de-beauvoir", "sojourner-truth", "sor-juana", "wangari-maathai",
    "wu-zetian", "zheng-yuxiu",
]


def get(url: str) -> bytes:
    last = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "women-on-the-wall-mirror"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception as exc:  # noqa: BLE001 - retry on any transport failure
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise SystemExit(f"failed: {url} ({last})")


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    names = IDS + ["schema"]
    ok = 0
    for name in names:
        data = get(f"{BASE}/{name}.json")
        try:
            json.loads(data)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"{name}.json is not valid JSON: {exc}")
        path = os.path.join(OUT, f"{name}.json")
        with open(path, "wb") as f:
            f.write(data)
        ok += 1
        print(f"  {name}.json  {len(data) // 1024} KB")
    print(f"{ok} files -> data/cards/")


if __name__ == "__main__":
    main()
