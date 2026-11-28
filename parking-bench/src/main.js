/**
 * src/main.js — Application Bootstrap & 1.0x Deterministic Virtual Clock Harness
 * Project: Parking Bench — Human vs. Gemini AI 6x6 Visual Spatial Race (hydrogen-parking-bench)
 */

import { DemoCore } from "./core.js";
import { initUI } from "./ui.js";
import { dispatchAction, DEMO_ACTIONS, state } from "./contract.js";
import { ensureTelemetry } from "./kits/world_cohesion_agx.js";

ensureTelemetry();

const FIXED_DT = 1 / 60;
let core = null;
let lastTime = 0;
let accumulator = 0;
let externalClockActive = typeof window !== "undefined" && Boolean(window.__virtualClock);
if (externalClockActive && typeof document !== "undefined") {
  document.documentElement.classList.add("is-virtual-clock");
}

async function init() {
  const canvas = document.getElementById("stage-canvas");
  initUI();
  core = new DemoCore(canvas);

  let isCoreReady = false;
  let initialBootCompleted = false;

  const applyInitialRouteAndFrame0 = () => {
    if (initialBootCompleted) return;
    initialBootCompleted = true;

    let stateParam = null;
    let modelParam = null;
    try {
      const params = new URLSearchParams(window.location.search);
      stateParam = params.get("state");
      modelParam = params.get("model");
    } catch (_) {}

    if (modelParam) {
      dispatchAction(DEMO_ACTIONS.SELECT_MODEL, { model: modelParam.trim() });
    }

    if (stateParam) {
      const normalized = stateParam.trim().toLowerCase();
      if (normalized === "autoplay" || normalized === "race") {
        window.DEMO_AUTOPLAY_ACTIVE = true;
        window.__unlockAudio?.();
        dispatchAction(DEMO_ACTIONS.SET_STATE, { state: "autoplay" });
      } else {
        const matchingPill = document.querySelector(`[data-state="${normalized}"]`);
        if (matchingPill) {
          matchingPill.click();
        } else {
          dispatchAction(DEMO_ACTIONS.SET_STATE, { state: normalized });
        }
      }
    } else {
      dispatchAction(DEMO_ACTIONS.SET_STATE, { state: state.currentState || "setup" });
    }

    if (!externalClockActive) {
      core.advanceFrame(FIXED_DT, 0, 0);
    }
  };

  const readyPromise = Promise.resolve(core.ready).then(() => {
    isCoreReady = true;
    applyInitialRouteAndFrame0();
  });
  window.__DEMO_READY__ = readyPromise;

  window.__advanceFrame = (dt = FIXED_DT, timestamp = undefined, frameIndex = undefined) => {
    if (!externalClockActive) {
      externalClockActive = true;
      document.documentElement.classList.add("is-virtual-clock");
    }
    if (!isCoreReady) {
      return readyPromise.then(() => {
        core.advanceFrame(dt, timestamp, frameIndex);
      });
    }
    applyInitialRouteAndFrame0();
    core.advanceFrame(dt, timestamp, frameIndex);
  };

  if (typeof window.__startAutoPlayDemo !== "function") {
    window.__startAutoPlayDemo = () => {
      window.DEMO_AUTOPLAY_ACTIVE = true;
      window.__unlockAudio?.();
      dispatchAction(DEMO_ACTIONS.START_RACE, { freshPack: false });
      return window.__getPuzzleDiagnostics?.() || { started: true };
    };
  }

  window.__startRace = (opts = {}) => {
    window.__unlockAudio?.();
    dispatchAction(DEMO_ACTIONS.START_RACE, opts);
  };

  window.__selectModel = (model) => {
    dispatchAction(DEMO_ACTIONS.SELECT_MODEL, { model });
  };

  window.__getScaleDiagnostics = () => {
    return core?.world?.getScaleDiagnostics?.() || window.__sceneMetrics || null;
  };

  window.__selectLevel = (n) => {
    dispatchAction(DEMO_ACTIONS.SELECT_LEVEL, { level: Number(n) || 1 });
  };

  window.__ensureDemoClick = (demoId) => {
    const el = document.querySelector(`[data-demo-id="${demoId}"], [data-demo-alias="${demoId}"]`);
    if (el) el.click();
  };

  await readyPromise;

  let rafId = null;
  function rafLoop(now) {
    rafId = null;
    if (!externalClockActive && !core?.world?.isContextLost?.()) {
      if (!lastTime) lastTime = now;
      const frameDt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      accumulator += frameDt;
      let subSteps = 0;
      while (accumulator >= FIXED_DT && subSteps < 4) {
        core.advanceFrame(FIXED_DT, now);
        accumulator -= FIXED_DT;
        subSteps++;
      }
      if (subSteps === 0 && core.renderOnly) {
        core.renderOnly();
      }
      if (!core?.world?.isContextLost?.()) {
        rafId = requestAnimationFrame(rafLoop);
      }
    }
  }

  canvas?.addEventListener?.(
    "webglcontextrestored",
    () => {
      if (!externalClockActive && rafId === null && !core?.world?.isContextLost?.()) {
        lastTime = 0;
        rafId = requestAnimationFrame(rafLoop);
      }
    },
    false
  );

  if (!externalClockActive && !core?.world?.isContextLost?.()) {
    rafId = requestAnimationFrame(rafLoop);
  }
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
