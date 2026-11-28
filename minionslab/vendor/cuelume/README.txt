cuelume 0.2.4 (MIT, Daniel Belyi) — https://cuelume.dev
Only the audio engine and sound recipes are vendored; Minion Lab plays "type" (one keystroke) on key press.
Local changes (appended at the end of audio/engine.js): audioContext() so a key can wait until its click has really played before the page changes, and warm() to start the audio output on the first gesture.
Also setBoost(x): scales the shared output before the limiter (the keys use 3, with the 'type' cue at emphasis strong), and prime(): builds the output chain ahead of the first play.
One change inside renderRecipe: cues start SCHEDULE_LEAD (30 ms) ahead of the audio clock, so a cue scheduled on a busy page keeps its attack (the first click on a fresh page used to come out as a faint tail).
