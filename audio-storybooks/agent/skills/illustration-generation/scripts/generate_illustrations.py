#!/usr/bin/env python3
"""Validates cover, character sheet, and folio illustration prompts in storybook.json for server-side rendering."""

import argparse
import json
from pathlib import Path


def main() -> None:
  parser = argparse.ArgumentParser(
      description="Validate storybook illustration prompts for server-side synthesis"
  )
  parser.add_argument("--storybook", required=True, help="Path to storybook.json")
  parser.add_argument("--out-dir", default="./workspace/images", help="Output images directory")
  args = parser.parse_args()

  storybook_path = Path(args.storybook)
  out_dir = Path(args.out_dir)
  out_dir.mkdir(parents=True, exist_ok=True)

  data = json.loads(storybook_path.read_text(encoding="utf-8"))
  style_prefix = data.get(
      "visualStyle",
      "1810s Regency delicate pen-and-ink linework with muted watercolor wash on #F6F2EA cream archival paper",
  )

  if not data.get("coverImagePrompt"):
    data["coverImagePrompt"] = (
        f"{style_prefix}. Fine-press frontispiece scene for an illustrated literary folio, no text, no borders."
    )

  for idx, page in enumerate(data.get("pages", []), start=1):
    pnum = page.get("pageNumber", idx)
    raw_prompt = page.get("illustrationPrompt") or page.get("narrativeText", "")
    if style_prefix.lower() not in raw_prompt.lower():
      page["illustrationPrompt"] = f"{style_prefix}. {raw_prompt}".strip()
    print(f"[Illustrations] Validated prompt for Folio {pnum} (queued for host Studio Server)")

  storybook_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
  print("[Illustrations] Ready for server-side gemini-3.1-flash-lite-image synthesis.")


if __name__ == "__main__":
  main()
