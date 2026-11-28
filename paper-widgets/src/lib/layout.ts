/**
 * Positions the animation computes, in pixels of the 1080 × 1080 stage. Everything static is in tokens.css; these
 * are the few numbers a per-frame write needs.
 */
export const STAGE = 1080;

/** Weather: the sun's path, a cubic from sunrise (8, 76) to sunset (240, 76) in a 248 × 86 box, over a horizon */
export const ARC = "M8 76 C 60 -14, 188 -14, 240 76";
export const ARC_BOX = { w: 248, h: 86 };
export const HORIZON_Y = 76;
export const ARC_DOTTED = { width: 1.2, dash: "2 4" };
export const ARC_LIT = 2; // stroke width of the travelled part
export const SUN_R = 6;
export const GLOW_R0 = 14; // the glow's radius before the first frame writes it

/** Now playing: the progress track and its knob, from the tile's left edge */
export const PROGRESS_X = 300;
export const PROGRESS_W = 288;
export const COVER_W = 248; // the new cover slides in from this far right

/** Focus timer: 60 ticks round a 200 × 200 dial, every fifth one longer and heavier */
export const DIAL = 200;
export const TICK_IN = 86; // inner radius
export const TICK_OUT = 96; // outer radius
export const TICK_OUT_MAJOR = 99;
export const TICK_W = 1.4;
export const TICK_W_MAJOR = 2;

/** Calendar: one event row every 76 px; the chip sits 16 px down the list */
export const ROW_PITCH = 76;
export const CHIP_TOP = 16;

/** Focus mode: the switch knob's travel */
export const KNOB_TRAVEL = 26;
