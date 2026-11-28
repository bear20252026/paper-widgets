export interface InlineAgentSource {
  type: "inline";
  target: string;
  content: string;
}

export const DEFAULT_MANAGED_AGENT_ID = "antigravity-preview-09-2026";
export const DEFAULT_MANAGED_AGENT_MODEL = "gemini-4-neon";
export const GEMINI_API_CLI_REPO = "https://github.com/google-gemini/gemini-api-cli";
export const GEMINI_API_CLI_INSTALL_CMD =
  'mkdir -p ./workspace/data && python3 -m json.tool ./workspace/data/storybook.json > /dev/null # Sandbox network disabled; Stages II–V synthesized server-side';

export const AGENTS_MD_CONTENT = `# Folio & Voice — Classic Illustrated Audiobook Managed Agent (antigravity-preview-09-2026 · gemini-4-neon)

You are the **Folio & Voice Storybook Managed Agent**, running inside an isolated Google-managed sandbox environment (\`agent: "antigravity-preview-09-2026"\`, \`agent_config: { "type": "antigravity", "model": "gemini-4-neon" }\`, \`network: "disabled"\`).

## Step 1: Author \`./workspace/data/storybook.json\` (\`skills/dramaturgy-spec/SKILL.md\`)
- Define the fine-press editorial light palette (\`paper: "#F6F2EA"\`, \`card: "#EFE9DC"\`, \`ink: "#1E1B18"\`, \`muted: "#7A7267"\`, \`accent: "#4A6B53"\`, \`rule: "#D5CBB8"\`).
- Write a strictly anonymous, book-text-derived \`charSheetPrompt\` (ZERO character names, book titles, or movie references).
- Partition the script into 3 right-hand Folios (\`FOLIO I.1\`, \`FOLIO I.2\`, \`FOLIO I.3\`) under \`pages\`, each with \`pageNumber\`, \`sceneLabel\` (\`SCENE I\`, \`SCENE II\`, \`SCENE III\`), \`folioLabel\` (\`FOLIO I.1\`, \`FOLIO I.2\`, \`FOLIO I.3\`), \`chapterTitle\` (\`CHAPTER I\`), \`imageCaption\`, \`illustrationPrompt\`, and \`dialogueLines\` (\`speaker\`, \`speakerLabel\`, \`voiceRoleLabel\`, \`isDialogue\`, \`voiceName\`, \`stylePrompt\`, \`text\`, \`durationSeconds\`).
- Validate \`./workspace/data/storybook.json\` with \`python3 -m json.tool\` and output the JSON inside a \`\`\`json ... \`\`\` block.

## Step 2–4: Host Studio Server Media Synthesis (Zero API Keys in Sandbox)
- 16:9 Character Sheet & Folio Watercolour Plates (\`gemini-3.1-flash-lite-image\`)
- 24 kHz Multi-Voice Dramatized Narration & 60 Hz Butterworth Mastering (\`gemini-3.1-flash-tts-preview\`)
- Period Chamber Score & Synchronized Open-Folio Timeline (\`lyria-3-clip-preview\`)
`;

export const DRAMATURGY_SKILL_MD = `---
name: dramaturgy-spec
description: Adapts a user fairytale, story prompt, or literary chapter into the classic-audiobooks BOOKS_SPEC & storybook.json schema.
---
# Dramaturgy & Fine-Press Folio Specification (books_spec.py)
- Fine-Press Editorial Palette: paper #F6F2EA, card #EFE9DC, ink #1E1B18, muted #7A7267, accent #4A6B53, rule #D5CBB8.
- Anonymous Character Sheet Prompt (FORBIDDEN_WORDS Rule): Never include proper character names, book titles, or famous place names in image prompts.
- Three-Folio Right-Page Structure (FOLIO I.1, FOLIO I.2, FOLIO I.3): Separate narrator attribution clauses (isDialogue: false) from spoken character lines (isDialogue: true).
`;

export const ILLUSTRATOR_SKILL_MD = `---
name: character-sheet-illustrator
description: Specifies 16:9 fine-press plates on #F6F2EA cream paper for server-side synthesis.
---
# Reference-Conditioned Fine-Press Illustration Plates
1. Author strictly anonymous 16:9 plate prompts on warm cream archival paper (#F6F2EA) using delicate pen-and-ink linework and muted watercolour wash; the host Studio Server renders all plates via \`gemini-3.1-flash-lite-image\`.
`;

export const MULTI_VOICE_TTS_SKILL_MD = `---
name: multi-voice-tts
description: Casts studio voices for server-side 24kHz WAV narration synthesis.
---
# Multi-Voice Narration & Studio Mastering
- Studio Voices: Kore (Narrator), Aoede (Animated Female), Charon (Dry Baritone), Fenrir (Warm Narrator), Orus (Crisp Lead), Leda (Young Heroine), Puck (Lively Character), Iapetus (Resonant Debater).
- Assign \`voiceName\` and \`stylePrompt\` on each \`dialogueLines\` entry in \`storybook.json\` for host server synthesis.
`;

export const LYRIA_SCORE_SKILL_MD = `---
name: lyria-chamber-score
description: Specifies bespoke period-authentic acoustic chamber scores for server-side synthesis.
---
# Bespoke Instrumental Chamber Score & Audiobook Mix
- Set \`musicPrompt\` in \`storybook.json\` to request purely instrumental acoustic chamber recordings (cello, contrabass, viola, fortepiano, woodwinds, harp) with rich 80–400 Hz body and zero percussion/vocals.
`;

export function getInlineBrowserAgentSources(): InlineAgentSource[] {
  return [
    {
      type: "inline",
      target: ".agents/AGENTS.md",
      content: AGENTS_MD_CONTENT,
    },
    {
      type: "inline",
      target: ".agents/skills/dramaturgy-spec/SKILL.md",
      content: DRAMATURGY_SKILL_MD,
    },
    {
      type: "inline",
      target: ".agents/skills/character-sheet-illustrator/SKILL.md",
      content: ILLUSTRATOR_SKILL_MD,
    },
    {
      type: "inline",
      target: ".agents/skills/multi-voice-tts/SKILL.md",
      content: MULTI_VOICE_TTS_SKILL_MD,
    },
    {
      type: "inline",
      target: ".agents/skills/lyria-chamber-score/SKILL.md",
      content: LYRIA_SCORE_SKILL_MD,
    },
  ];
}
