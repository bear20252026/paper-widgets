---
name: character-sheet-illustrator
description: Specifies the 16:9 Character & Style Reference Sheet and reference-conditioned Scene Plates in storybook.json for server-side synthesis.
---

# Reference-Conditioned Fine-Press Illustration & Pop-Up Plates

In the isolated sandbox (`network: "disabled"`), author `charSheetPrompt` and `pages[].illustrationPrompt` inside `./workspace/data/storybook.json`; the host Studio Server executes `gemini-3.1-flash-lite-image` synthesis automatically after your turn completes:

## 1. 16:9 Character & Style Reference Sheet (`charSheetPrompt`)
Specify two main figures standing side-by-side in three-quarter profile facing each other on warm cream archival paper (`#F6F2EA`) using delicate pen-and-ink linework and muted period watercolour wash, with zero proper names, text, or borders.

## 2. Reference-Conditioned Scene Plates (`pages[].illustrationPrompt`)
The host Studio Server passes the synthesized Character Reference Sheet as a visual reference input when generating each 16:9 folio scene plate so character faces, silhouettes, attire, and linework remain consistent across all spreads.
