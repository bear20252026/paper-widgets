---
name: multi-voice-tts
description: Casts character voices and styles in `storybook.json` for host Studio Server 24 kHz WAV synthesis and 60 Hz Butterworth mastering.
---

# Multi-Voice Narration & Studio Mastering Specification

Assign distinct studio voices and `stylePrompt` performance notes in `pages[].dialogueLines` inside `./workspace/data/storybook.json`; the host Studio Server synthesizes every turn at 24 kHz mono PCM and applies studio mastering server-side:

- `Kore` — Poised literary narrator
- `Aoede` — Animated, expressive female character
- `Charon` — Dry, deadpan baritone gentleman
- `Fenrir` — Warm, observant Victorian narrator
- `Orus` — Crisp, incisive intellectual lead
- `Leda` — Young, curious storybook heroine
- `Puck` — Brisk, lively character voice
- `Zephyr` — Airy, youthful adventurer
- `Iapetus` — Skeptical, resonant debater
