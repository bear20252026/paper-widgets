---
name: illustration-generation
description: Validate storybook cover and folio illustration prompts in `./workspace/data/storybook.json` for host Studio Server rendering.
---

# Illustration Prompt Validation Skill

Because the sandbox runs with `network: "disabled"` and zero API credentials, all `gemini-3.1-flash-lite-image` calls execute server-side on the host Studio Server once `storybook.json` is written.

You may optionally validate and normalize prompts in `./workspace/data/storybook.json` offline via:

```bash
python3 .agents/skills/illustration-generation/scripts/generate_illustrations.py \
  --storybook ./workspace/data/storybook.json \
  --out-dir ./workspace/images
```
