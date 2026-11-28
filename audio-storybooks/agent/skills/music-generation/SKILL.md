---
name: music-generation
description: Record an instrumental ambient chamber score prompt in `./workspace/data/storybook.json` for host Studio Server synthesis.
---

# Ambient Storybook Score Prompt Skill

Set `musicPrompt` directly in `./workspace/data/storybook.json` (or run the offline helper below) so the host Studio Server synthesizes the instrumental chamber score server-side:

```bash
python3 .agents/skills/music-generation/scripts/generate_music.py \
  --prompt "Gentle Regency chamber strings, cello, harp, and fortepiano, purely instrumental, 80 BPM"
```
