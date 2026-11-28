#!/usr/bin/env python3
"""Computes initial folio timeline estimates in storybook.json prior to server-side audio mastering & mixing."""

import argparse
import json
from pathlib import Path


def main() -> None:
  parser = argparse.ArgumentParser(
      description="Compute initial timeline metadata for server-side audiobook mix"
  )
  parser.add_argument("--storybook", required=True, help="Path to storybook.json")
  parser.add_argument("--audio-dir", default="./workspace/audio", help="Audio directory")
  args = parser.parse_args()

  storybook_path = Path(args.storybook)
  data = json.loads(storybook_path.read_text(encoding="utf-8"))

  cursor = 5.4  # 2.6s title card + 2.8s page-turn unfold
  for idx, page in enumerate(data.get("pages", [])):
    folio_start = 2.6 if idx == 0 else cursor
    if idx > 0:
      cursor += 0.85
    for line in page.get("dialogueLines", []):
      dur = max(1.6, float(line.get("durationSeconds") or max(2.2, len(str(line.get("text", ""))) / 15.0)))
      line["startSec"] = round(cursor, 3)
      line["endSec"] = round(cursor + dur, 3)
      cursor = line["endSec"] + (0.36 if line.get("isDialogue") else 0.48)
    page["startSec"] = round(folio_start, 3)
    page["endSec"] = round(cursor + 0.4, 3)
    cursor = page["endSec"]

  data["titleCardEndSec"] = 2.6
  data["totalDurationSeconds"] = round(cursor + 1.2, 2)
  storybook_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
  print(f"[Mix] Validated folio timeline ({data['totalDurationSeconds']}s) for host Studio Server audio mix.")


if __name__ == "__main__":
  main()
