/**
 * Every motion number, in seconds of loop time. The loop is 11 s: the tiles rise in one after another, each widget
 * plays its intro, then three events happen (focus mode on at 4.4, the track changes at 6.0, the calendar rolls up
 * at 6.6), and at 11 s it starts again from an empty stage.
 */
export const LOOP = 11;
export const STILL_AT = 5.3; // the still shown with reduced motion: everything in, focus on, the equaliser mid-bounce

/** Tiles rise in: tile i over ENTER_START + i·STAGGER … ENTER_END + i·STAGGER, cubic out */
export const ENTER_START = 0.1;
export const ENTER_END = 0.75;
export const ENTER_STAGGER = 0.08;
export const ENTER_RISE = 22; // px below their place at the start
export const ENTER_SCALE = 0.955; // scale at the start …
export const ENTER_GROW = 0.045; // … grows by this to 1

/** Weather: the temperature counts up, the sun climbs the arc to 62% of the day */
export const TEMP_COUNT = [1.0, 2.2] as const; // cubic out
export const SUN_RISE = [1.2, 2.8] as const; // in-out
export const SUN_SHOW = [1.2, 1.4] as const; // sun and glow fade in
export const SUN_SHARE = 0.62;
export const GLOW_R = 12; // glow radius 12 ± 3, breathing at 3 rad/s
export const GLOW_PULSE = 3;
export const GLOW_SPEED = 3;

/** Now playing */
export const EQ_ON = 1.2; // the equaliser starts moving
export const EQ_REST = 3; // bar height at rest
export const EQ_MIN = 4; // bar height while playing: 4 + 10·|sin(t·(5 + 1.7i) + i)|
export const EQ_RANGE = 10;
export const EQ_SPEED = 5;
export const EQ_SPREAD = 1.7;
export const PROGRESS_IN = [1.1, 1.6] as const; // the progress bar grows to the playhead
export const PLAY_FROM = 1.2; // the first track plays on from its start position here
export const SKIP = 6.0; // the next button is pressed; everything else in the change is timed from here
export const COVER_SHIFT = -40; // px: the old cover drifts left …
export const COVER_SHRINK = 0.06; // … shrinks …
export const COVER_FADE = 0.9; // … and fades, while the new one slides in from the right
export const PRESS_SCALE = 0.12; // the next button dips 12%
export const PRESS_WASH = 0.07; // and gets an ink wash of this alpha

/** Focus timer: a 25-minute countdown run at 12× so a minute of ticks sweeps round in 5 s */
export const TIMER_START = 1.4;
export const TIMER_SPEED = 12;
export const TICKS_IN = [0.9, 1.6] as const; // ticks fade in clockwise
export const TICK_FADE = 60; // tick i opacity = intro·60 − 0.6·i
export const TICK_LAG = 0.6;

/** Steps */
export const STEPS_COUNT = [1.3, 2.7] as const; // cubic out
export const STEPS_BARS = [1.4, 2.0] as const; // bar i: + 0.08·i, back out
export const STEPS_BAR_STAGGER = 0.08;
export const STEPS_WALK = 6; // from here three more steps a second
export const STEPS_RATE = 3;

/** Batteries */
export const BATTERY_FILL = [1.5, 2.5] as const; // row i: + 0.12·i, cubic out
export const BATTERY_STAGGER = 0.12;
export const CHARGE_FROM = 2.6; // the charging row creeps up 0.4% a second and its shimmer runs
export const CHARGE_RATE = 0.004;
export const SHIMMER_SPEED = 0.55; // sweeps a second
export const SHIMMER_FROM = -30; // % of the fill width
export const SHIMMER_SPAN = 130;
export const BOLT_FROM = 2.4; // the bolt pulses 0.6 ± 0.4 at 4 rad/s
export const BOLT_BASE = 0.6;
export const BOLT_PULSE = 0.4;
export const BOLT_SPEED = 4;

/** Calendar: rows rise in, then the list rolls up one row to the next event */
export const EVENTS_IN = [1.5, 2.1] as const; // row i: + 0.1·i, cubic out
export const EVENTS_STAGGER = 0.1;
export const EVENTS_RISE = 12; // px
export const ROLL = 6.6; // the roll and the chip change are timed from here
export const CHIP_IN = [2.2, 2.5] as const;

/** Focus mode */
export const FOCUS_ON = 4.4; // the tap; the switch and the dark fade are timed from here
export const MOON_TURN = -40; // deg
export const MOON_SWELL = 0.08;
export const TOGGLE_DIP = 0.06;
