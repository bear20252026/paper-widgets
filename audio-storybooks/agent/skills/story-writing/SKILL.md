---
name: story-writing
description: Author a structured multi-page illustrated storybook & dramatized multi-voice audiobook script (`./workspace/data/storybook.json`) inside the isolated sandbox.
---

# Story Writing & Classic Literature Adaptation Skill

Use this skill to author `./workspace/data/storybook.json` (and copy it to `./storybook.json`) — the master blueprint for the illustrated storybook and multi-voice dramatized audiobook.

## 1. Isolated Sandbox Workflow
- Your sandbox runs with `network: "disabled"` and zero API keys. Do **not** invoke `curl`, `git clone`, or `gemini-api` from bash.
- If `.agents/gutenberg_reference.json` is mounted in the workspace, consult it for authentic public-domain character, chapter, and setting details.

## 2. Character Voice Casting (`gemini-3.1-flash-tts-preview` Voices)
Assign every character (plus `"Narrator"` / `"The Storyteller"`) a distinct prebuilt Gemini TTS voice:

| Voice Name | Vocal Quality & Ideal Casting |
| :--- | :--- |
| `Charon` | Warm, resonant, authoritative classic storyteller / wise elder |
| `Kore` | Bright, expressive, poised narrator / curious heroine |
| `Puck` | Lively, nimble, eccentric or whimsical character / trickster |
| `Fenrir` | Deep, dramatic, warm Victorian narrator / sea captain |
| `Aoede` | Lyrical, melodic, animated character / fairy queen |
| `Zephyr` | Airy, youthful, energetic adventurer |
| `Leda` | Refined, poised, young storybook heroine |
| `Orus` | Steady, crisp, intellectual or earnest lead |
| `Iapetus` | Skeptical, resonant debater |

## 3. Visual Consistency & Anonymous Prompts Rule
Choose a single unmistakable artistic medium for `visualStyle` (for example: *"1810s Regency delicate pen-and-ink linework with muted watercolor wash on #F6F2EA cream archival paper"*).
Every `charSheetPrompt`, `coverImagePrompt`, and `pages[].illustrationPrompt` must use strictly anonymous physical descriptions (age, period attire, fabric, posture, lighting) with **zero proper character names or book titles**.

## 4. Output Location & Validation
```bash
mkdir -p ./workspace/data
python3 -m json.tool ./workspace/data/storybook.json > /dev/null && cp ./workspace/data/storybook.json ./storybook.json
```
