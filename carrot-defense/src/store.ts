import { create } from "zustand";
import { setMuted } from "./game/audio";
import { skipClassic as skipClassicFn, skipThrough } from "./game/progress";
import type { HudSnapshot } from "./game/session";
import type { GameMode, TowerKind } from "./game/types";
import { TOWER_PAGES } from "./game/towerDefs";

const BEST_KEY = "carrot-defense:best-v2";
const MUTE_KEY = "carrot-defense:muted-v1";
const FREE_KEY = "carrot-defense:free-v2";
const ENDLESS_KEY = "carrot-defense:endless-v1";

function loadBest(): Record<number, number> {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw ? (JSON.parse(raw) as Record<number, number>) : {};
  } catch {
    return {};
  }
}

function saveBest(best: Record<number, number>): void {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    /* 隐私模式下忽略 */
  }
}

function loadFree(): boolean {
  try {
    return localStorage.getItem(FREE_KEY) === "1";
  } catch {
    return false;
  }
}

function loadEndlessBest(): number {
  try {
    return Number(localStorage.getItem(ENDLESS_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export interface Cell {
  col: number;
  row: number;
}
export type ToastKind = "info" | "good" | "bad";

interface UIStore {
  screen: "menu" | "game";
  levelId: number;
  sessionKey: number;
  paused: boolean;
  speed: 1 | 2;
  muted: boolean;
  selectedCell: Cell | null;
  selectedTowerId: number | null;
  armedKind: TowerKind | null;
  towerPage: number;
  hud: HudSnapshot | null;
  version: number;
  toast: { text: string; id: number; kind: ToastKind } | null;
  best: Record<number, number>;
  freeSelect: boolean;
  mode: GameMode;
  endlessSeed: number;
  endlessBest: number;

  startLevel: (id: number) => void;
  startEndless: () => void;
  recordEndless: (wave: number) => void;
  restart: () => void;
  backToMenu: () => void;
  togglePause: () => void;
  setPaused: (p: boolean) => void;
  toggleSpeed: () => void;
  toggleMute: () => void;
  selectCell: (c: Cell | null) => void;
  selectTower: (id: number | null) => void;
  armKind: (k: TowerKind | null) => void;
  clearSelection: () => void;
  setHud: (h: HudSnapshot) => void;
  bump: () => void;
  showToast: (text: string, kind?: ToastKind) => void;
  recordResult: (levelId: number, rating: number) => void;
  setTowerPage: (page: number) => void;
  cycleTowerPage: (dir?: 1 | -1) => void;
  skipClassic: () => void;
  skipTo: (levelId: number) => void;
  toggleFreeSelect: () => void;
}

const initialMuted = loadMuted();
setMuted(initialMuted);

const freshGameUI = {
  paused: false,
  selectedCell: null,
  selectedTowerId: null,
  armedKind: null,
  hud: null,
  toast: null,
} as const;

let toastSeq = 0;

export const useUI = create<UIStore>((set, get) => ({
  screen: "menu",
  levelId: 1,
  sessionKey: 0,
  paused: false,
  speed: 1,
  muted: initialMuted,
  selectedCell: null,
  selectedTowerId: null,
  armedKind: null,
  towerPage: 0,
  hud: null,
  version: 0,
  toast: null,
  best: loadBest(),
  freeSelect: loadFree(),
  mode: "campaign",
  endlessSeed: 1,
  endlessBest: loadEndlessBest(),

  startLevel: (id) =>
    set((s) => ({
      ...freshGameUI,
      screen: "game",
      mode: "campaign",
      levelId: id,
      sessionKey: s.sessionKey + 1,
    })),
  startEndless: () =>
    set((s) => ({
      ...freshGameUI,
      screen: "game",
      mode: "endless",
      endlessSeed: s.sessionKey + 1,
      sessionKey: s.sessionKey + 1,
    })),
  recordEndless: (wave) => {
    if (wave <= get().endlessBest) return;
    try {
      localStorage.setItem(ENDLESS_KEY, String(wave));
    } catch {
      /* ignore */
    }
    set({ endlessBest: wave });
  },
  restart: () =>
    set((s) => ({
      ...freshGameUI,
      sessionKey: s.sessionKey + 1,
      endlessSeed: s.mode === "endless" ? s.sessionKey + 1 : s.endlessSeed,
    })),
  backToMenu: () => set({ ...freshGameUI, screen: "menu" }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setPaused: (paused) => set({ paused }),
  toggleSpeed: () => set((s) => ({ speed: s.speed === 1 ? 2 : 1 })),
  toggleMute: () => {
    const muted = !get().muted;
    setMuted(muted);
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ muted });
  },
  selectCell: (selectedCell) => set({ selectedCell, selectedTowerId: null, armedKind: null }),
  selectTower: (selectedTowerId) => set({ selectedTowerId, selectedCell: null, armedKind: null }),
  armKind: (armedKind) => set({ armedKind, selectedCell: null, selectedTowerId: null }),
  clearSelection: () => set({ selectedCell: null, selectedTowerId: null, armedKind: null }),
  setHud: (h) => {
    const cur = get().hud;
    if (cur) {
      let same = true;
      for (const k of Object.keys(h) as Array<keyof HudSnapshot>) {
        if (cur[k] !== h[k]) {
          same = false;
          break;
        }
      }
      if (same) return;
    }
    set({ hud: h });
  },
  bump: () => set((s) => ({ version: s.version + 1 })),
  showToast: (text, kind = "info") => set({ toast: { text, id: ++toastSeq, kind } }),
  recordResult: (levelId, rating) => {
    const best = { ...get().best };
    if ((best[levelId] ?? 0) < rating) {
      best[levelId] = rating;
      saveBest(best);
      set({ best });
    }
  },
  setTowerPage: (page) => set({ towerPage: ((page % TOWER_PAGES.length) + TOWER_PAGES.length) % TOWER_PAGES.length }),
  cycleTowerPage: (dir = 1) =>
    set((s) => ({ towerPage: (s.towerPage + dir + TOWER_PAGES.length) % TOWER_PAGES.length })),
  skipClassic: () => {
    const best = skipClassicFn(get().best);
    saveBest(best);
    set({ best });
  },
  skipTo: (levelId) => {
    const best = skipThrough(get().best, levelId - 1);
    saveBest(best);
    set({ best });
  },
  toggleFreeSelect: () => {
    const freeSelect = !get().freeSelect;
    try {
      localStorage.setItem(FREE_KEY, freeSelect ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ freeSelect });
  },
}));
