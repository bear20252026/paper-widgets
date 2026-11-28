#!/usr/bin/env python3
"""Records instrumental chamber music prompt metadata for server-side Lyria synthesis."""

import argparse
import json
from pathlib import Path


def main() -> None:
  parser = argparse.ArgumentParser(
      description="Prepare instrumental chamber score prompt for server-side synthesis"
  )
  parser.add_argument("--prompt", required=True, help="Instrumental music prompt")
  parser.add_argument("--out", default="./workspace/audio/ambient.mp3", help="Output MP3 path")
  args = parser.parse_args()

  prompt = args.prompt.strip()
  if "instrumental" not in prompt.lower():
    prompt = f"{prompt}, purely instrumental acoustic chamber ensemble, no vocals"

  for candidate in (Path("./workspace/data/storybook.json"), Path("./storybook.json")):
    if candidate.exists():
      try:
        data = json.loads(candidate.read_text(encoding="utf-8"))
        data["musicPrompt"] = prompt
        candidate.write_text(json.dumps(data, indent=2), encoding="utf-8")
      except Exception:
        pass

  print(f"[Music] Recorded chamber score direction for host Studio Server: {prompt[:96]}")


if __name__ == "__main__":
  main()
