import { useEffect, useRef } from "react";
import { t } from "../i18n";
import { Application } from "pixi.js";
import { InterpolatedTicker } from "pixijs-interpolated-ticker";
import type { GameEngine } from "../game/engine";
import { PixiRenderer } from "./PixiRenderer";

interface GameCanvasProps {
  engine: GameEngine;
  paused: boolean;
  showDirectionArrow?: boolean;
  showNames?: boolean;
  onRenderer?: (renderer: PixiRenderer | null) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}

const FIXED_STEP_MS = 1000 / 60;

/**
 * React host for the PixiJS 8 canvas.
 * Logic runs at a fixed 60Hz through InterpolatedTicker.update(fixedDeltaMS);
 * rendering happens on the display's refresh rate with container interpolation.
 */
export function GameCanvas({
  engine,
  paused,
  showDirectionArrow = true,
  showNames = true,
  onRenderer,
  onReady,
  onError,
}: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PixiRenderer | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.settings.showDirectionArrow = showDirectionArrow;
      rendererRef.current.settings.showNames = showNames;
    }
  }, [showDirectionArrow, showNames]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let ticker: InterpolatedTicker | null = null;
    let renderer: PixiRenderer | null = null;
    let app: Application | null = null;
    let observer: ResizeObserver | null = null;

    const boot = async () => {
      const width = Math.max(320, host.clientWidth);
      const height = Math.max(320, host.clientHeight);
      let instance = new Application();
      try {
        await instance.init({
          width,
          height,
          background: "#fbf9f1",
          antialias: true,
          autoDensity: true,
          resolution: Math.min(2, window.devicePixelRatio || 1),
          preference: "webgl",
        });
      } catch {
        instance = new Application();
        try {
          await instance.init({
            width,
            height,
            background: "#fbf9f1",
            antialias: true,
            autoDensity: true,
            resolution: Math.min(2, window.devicePixelRatio || 1),
          });
        } catch {
          onError?.(t("设备无法初始化 WebGL / WebGPU 图形引擎，请更换浏览器后重试。"));
          return;
        }
      }
      if (cancelled) {
        instance.destroy(true);
        return;
      }
      app = instance;
      host.appendChild(instance.canvas);
      instance.canvas.style.width = "100%";
      instance.canvas.style.height = "100%";
      instance.canvas.style.display = "block";
      instance.canvas.style.touchAction = "none";

      try {
        renderer = new PixiRenderer(instance);
        renderer.settings.showDirectionArrow = showDirectionArrow;
        renderer.settings.showNames = showNames;
        rendererRef.current = renderer;
        onRenderer?.(renderer);
      } catch {
        onError?.(t("渲染器创建失败，请刷新页面或更换浏览器。"));
        instance.destroy(true, { children: true });
        app = null;
        return;
      }
      if (cancelled) {
        onRenderer?.(null);
        renderer.destroy();
        return;
      }

      observer = new ResizeObserver(() => {
        if (!renderer) return;
        renderer.resize(Math.max(320, host.clientWidth), Math.max(320, host.clientHeight));
      });
      observer.observe(host);

      ticker = new InterpolatedTicker({
        renderer: instance.renderer,
        stage: instance.stage,
        fixedDeltaMS: FIXED_STEP_MS,
        interpolation: true,
        interpolationOptions: { capacity: 5200, maxCapacity: 9000, maxPositionDelta: 180 },
      });
      ticker.start({
        update: (fixedDeltaMS) => {
          if (!pausedRef.current) engine.step(fixedDeltaMS);
          renderer?.draw(engine.state);
        },
      });
      onReady?.();
    };

    void boot();

    return () => {
      cancelled = true;
      observer?.disconnect();
      ticker?.stop();
      onRenderer?.(null);
      renderer?.destroy();
      if (!renderer && app) app.destroy(true, { children: true });
      rendererRef.current = null;
      app = null;
      host.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // Input: mouse steering + hold left button / space to boost. UI overlays stop propagation.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let boostHeld = false;
    let pointerSeen = false;
    const keyboard = new Set<string>();

    const steer = (clientX: number, clientY: number) => {
      if (pausedRef.current) return;
      const r = rendererRef.current;
      if (!r) return;
      const p = engine.player;
      if (!p.alive) return;
      const w = r.screenToWorld(clientX, clientY);
      const dx = w.x - p.x;
      const dy = w.y - p.y;
      if (Math.hypot(dx, dy) > 16) engine.setPlayerDirection(Math.atan2(dy, dx));
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointerSeen = true;
      steer(e.clientX, e.clientY);
    };
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || pausedRef.current) return;
      if (!pointerSeen) steer(e.clientX, e.clientY);
      boostHeld = true;
      engine.setBoost(true);
    };
    const release = () => {
      boostHeld = false;
      engine.setBoost(!pausedRef.current && keyboard.has("Space"));
    };
    const releaseAll = () => { keyboard.clear(); release(); };
    const vectorFromKeys = () => {
      let x = 0;
      let y = 0;
      if (keyboard.has("ArrowLeft") || keyboard.has("KeyA")) x -= 1;
      if (keyboard.has("ArrowRight") || keyboard.has("KeyD")) x += 1;
      if (keyboard.has("ArrowUp") || keyboard.has("KeyW")) y -= 1;
      if (keyboard.has("ArrowDown") || keyboard.has("KeyS")) y += 1;
      if (x !== 0 || y !== 0) engine.setPlayerVector(x, y);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (pausedRef.current || (e.target as HTMLElement)?.matches("input, textarea, select")) return;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        const target = e.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA", "BUTTON"].includes(target.tagName)) return;
        e.preventDefault();
      }
      if (e.repeat) return;
      if (e.code === "Space") engine.setBoost(true);
      keyboard.add(e.code);
      vectorFromKeys();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keyboard.delete(e.code);
      if (e.code === "Space") engine.setBoost(!pausedRef.current && boostHeld);
      vectorFromKeys();
    };

    host.addEventListener("pointermove", onMove);
    host.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", release);
    window.addEventListener("blur", releaseAll);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", release);
      window.removeEventListener("blur", releaseAll);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      engine.setBoost(false);
    };
  }, [engine]);

  return <div ref={hostRef} className="absolute inset-0 h-full w-full select-none" aria-label={t("游戏画面")} />;
}
