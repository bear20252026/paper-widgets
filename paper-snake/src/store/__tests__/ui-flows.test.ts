import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { useGameStore as StoreHook } from "../gameStore";
import { SkinTrial, TRIAL_STEP_MS } from "../../game/skinTrial";

let store: typeof StoreHook;
const memory = new Map<string, string>();

beforeAll(async () => {
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  store = (await import("../gameStore")).useGameStore;
});
beforeEach(() => { memory.clear(); store.setState(store.getInitialState(), true); });

describe("paper lobby interactions", () => {
  it("does not block the lobby and only guides a first start", () => {
    expect(store.getState().guideOpen).toBe(false);
    store.getState().startGame("timed");
    expect(store.getState().guideOpen).toBe(true);
    expect(store.getState().phase).toBe("menu");
    expect(store.getState().mode).toBe("timed");
    store.getState().completeOnboarding("纸格", "koi");
    store.getState().startGame("timed");
    expect(store.getState().phase).toBe("playing");
  });

  it("grants the starter gift once even when help is replayed", () => {
    const coins = store.getState().coins;
    store.getState().completeOnboarding("纸格", "koi");
    expect(store.getState().coins).toBe(coins + 300);
    store.getState().replayOnboarding();
    store.getState().completeOnboarding("纸格", "koi");
    expect(store.getState().coins).toBe(coins + 300);
  });

  it("previewing a locked skin never spends coins or changes equipment", () => {
    store.getState().setClosetOpen(true, "cinema");
    expect(store.getState().closetSelection).toBe("cinema");
    expect(store.getState().equipped).toBe("koi");
    expect(store.getState().coins).toBe(320);
    expect(store.getState().buySkin("cinema")).toBe(false);
    expect(store.getState().coins).toBe(320);
    expect(store.getState().owned).not.toContain("cinema");
  });

  it("unlocks the new jellyfish once and keeps its visual choice", () => {
    expect(store.getState().buySkin("jellyfish")).toBe(true);
    expect(store.getState().coins).toBe(40);
    expect(store.getState().equipped).toBe("jellyfish");
    expect(store.getState().buySkin("jellyfish")).toBe(true);
    expect(store.getState().coins).toBe(40);
    expect(store.getState().owned.filter((s) => s === "jellyfish")).toHaveLength(1);
  });

  it("opening a secondary screen pauses a match and return clears panels", () => {
    store.getState().completeOnboarding("纸格", "koi");
    store.getState().startGame("endless");
    store.getState().setSettingsOpen(true);
    expect(store.getState().phase).toBe("paused");
    store.getState().goMenu();
    expect(store.getState().settingsOpen).toBe(false);
    expect(store.getState().guideOpen).toBe(false);
    expect(store.getState().phase).toBe("menu");
  });

  it("never pays a daily sign-in reward twice on the same date", () => {
    expect(store.getState().claimSignIn()).not.toBeNull();
    const coins = store.getState().coins;
    expect(store.getState().claimSignIn()).toBeNull();
    expect(store.getState().coins).toBe(coins);
  });

  it("a complete locked-skin trial does not modify any saved UI or economy state", () => {
    const before = store.getState();
    const saved = memory.get("snake-arena-save-v1");
    const trial = new SkinTrial("orbit");
    trial.setBoost(true);
    for (let i = 0; i < 1201; i++) trial.update(TRIAL_STEP_MS);
    expect(trial.finished).toBe(true);
    expect(store.getState()).toBe(before);
    expect(memory.get("snake-arena-save-v1")).toBe(saved);
    expect(store.getState().owned).not.toContain("orbit");
  });

  it("existing saves gain the free garden without losing their currency or equipment", async () => {
    memory.set("snake-arena-save-v1", JSON.stringify({ version: 0, state: { coins: 471, owned: ["mint", "peach", "koi", "jellyfish"], equipped: "jellyfish", onboardingDone: true } }));
    await store.persist.rehydrate();
    expect(store.getState().coins).toBe(471);
    expect(store.getState().equipped).toBe("jellyfish");
    expect(store.getState().owned).toContain("garden");
    expect(store.getState().onboardingDone).toBe(true);
  });
});