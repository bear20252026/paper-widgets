---
name: audio-mixing
description: Compute initial folio timeline estimates in `./workspace/data/storybook.json` prior to host Studio Server audio mastering and mixing.
---

# Folio Timeline Validation Skill

The host Studio Server mixes the mastered 24 kHz dialogue turns and chamber score automatically after reading `storybook.json`. You may optionally pre-validate timeline timestamps offline via:

```bash
python3 .agents/skills/audio-mixing/scripts/mix_storybook_audio.py \
  --storybook ./workspace/data/storybook.json
```
