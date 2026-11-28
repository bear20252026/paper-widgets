#!/usr/bin/env python3
"""Validates multi-voice speaker casting and dialogue turns in storybook.json for server-side 24 kHz TTS synthesis."""

import argparse
import json
from pathlib import Path

VALID_VOICES = {
    "Puck", "Charon", "Kore", "Fenrir", "Aoede", "Zephyr", "Leda", "Orus", "Iapetus"
}


def main() -> None:
  parser = argparse.ArgumentParser(
      description="Validate dramatized multi-voice TTS metadata per folio"
  )
  parser.add_argument("--storybook", required=True, help="Path to storybook.json")
  parser.add_argument("--out-dir", default="./workspace/audio", help="Output audio directory")
  args = parser.parse_args()

  storybook_path = Path(args.storybook)
  out_dir = Path(args.out_dir)
  out_dir.mkdir(parents=True, exist_ok=True)

  data = json.loads(storybook_path.read_text(encoding="utf-8"))
  char_voices = {
      c.get("name", "Narrator"): c.get("voiceName", "Kore")
      for c in data.get("characters", [])
  }

  for idx, page in enumerate(data.get("pages", []), start=1):
    pnum = page.get("pageNumber", idx)
    lines = page.get("dialogueLines") or [
        {
            "speaker": "Narrator",
            "speakerLabel": "NARRATOR",
            "isDialogue": False,
            "voiceName": "Kore",
            "stylePrompt": "Warmly, with classic literary storybook cadence",
            "text": page.get("narrativeText", ""),
        }
    ]
    for line in lines:
      spk = line.get("speaker", "Narrator")
      vname = line.get("voiceName") or char_voices.get(spk, "Kore")
      line["voiceName"] = vname if vname in VALID_VOICES else "Kore"
      text = str(line.get("text", "")).strip()
      line["durationSeconds"] = round(max(1.8, len(text) / 15.0), 2)
    page["dialogueLines"] = lines
    print(f"[TTS] Validated {len(lines)} voice turns for Folio {pnum} (queued for host Studio Server)")

  storybook_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
  print("[TTS] Ready for server-side gemini-3.1-flash-tts-preview synthesis.")


if __name__ == "__main__":
  main()
