---
name: tts-generation
description: Validate multi-speaker voice casting and turn timing metadata in `./workspace/data/storybook.json` for host Studio Server TTS synthesis.
---

# Multi-Speaker Storybook TTS Validation Skill

All `gemini-3.1-flash-tts-preview` synthesis runs server-side on the host Studio Server after your sandbox turn completes. You may validate speaker voice names offline via:

```bash
python3 .agents/skills/tts-generation/scripts/generate_page_audio.py \
  --storybook ./workspace/data/storybook.json \
  --out-dir ./workspace/audio
```
