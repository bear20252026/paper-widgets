import { useCallback, useEffect, useRef, useState } from "react";
import { type CameraMode, ValleyWorld } from "./three/ValleyWorld";
import { TREE_COUNT } from "./three/forest";
import { PETAL_COUNT } from "./three/petals";

const fmt = new Intl.NumberFormat("en-US");

const CAMERA_MODES: { id: CameraMode; label: string }[] = [
  { id: "vista", label: "Vista" },
  { id: "topdown", label: "Top-Down" },
  { id: "glide", label: "Glide" },
];

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-left text-xs font-medium text-pink-50/95 transition hover:border-pink-300/30 hover:bg-white/[0.11]"
    >
      <span>{label}</span>
      <span
        className={`relative h-4 w-8 rounded-full transition-colors ${
          checked
            ? "bg-gradient-to-r from-pink-400 to-fuchsia-400 shadow-[0_0_10px_rgba(244,114,182,0.55)]"
            : "bg-white/20"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function SliderRow({
  label,
  display,
  value,
  min,
  max,
  step = 0.01,
  onChange,
}: {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-pink-100/80">
        <span>{label}</span>
        <span className="text-cyan-200">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-pink-400"
      />
    </label>
  );
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<ValleyWorld | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const [fps, setFps] = useState(0);
  const [liveStorm, setLiveStorm] = useState(0.62);
  const [manualActive, setManualActive] = useState(false);

  const [cameraMode, setCameraMode] = useState<CameraMode>("vista");
  const [autoCruise, setAutoCruise] = useState(true);
  const [stormAuto, setStormAuto] = useState(true);
  const [stormManual, setStormManual] = useState(0.68);
  const [windScale, setWindScale] = useState(1.0);
  const [proceduralLevel, setProceduralLevel] = useState(0.65);
  const [gustFlash, setGustFlash] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let world: ValleyWorld | null = null;
    try {
      world = new ValleyWorld(container, {
        onReady: () => setReady(true),
        onStats: (s) => {
          setFps(Math.round(s.fps));
          setLiveStorm(s.liveStorm);
          setManualActive(s.manualActive);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "WebGL 2 is not available in this browser.");
      return;
    }

    worldRef.current = world;
    world.start();

    return () => {
      world?.dispose();
      worldRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (worldRef.current) worldRef.current.autoCruise = autoCruise;
  }, [autoCruise]);

  useEffect(() => {
    if (worldRef.current) worldRef.current.stormAuto = stormAuto;
  }, [stormAuto]);

  useEffect(() => {
    if (worldRef.current) worldRef.current.stormManual = stormManual;
  }, [stormManual]);

  useEffect(() => {
    if (worldRef.current) worldRef.current.windScale = windScale;
  }, [windScale]);

  useEffect(() => {
    if (worldRef.current) worldRef.current.proceduralLevel = proceduralLevel;
  }, [proceduralLevel]);

  const handleModeSelect = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
    setAutoCruise(true);
    worldRef.current?.setCameraMode(mode);
  }, []);

  const triggerGust = useCallback(() => {
    worldRef.current?.triggerGust();
    setGustFlash(true);
    window.setTimeout(() => setGustFlash(false), 650);
  }, []);

  // Spacebar triggers a sweeping sakura storm gust
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        triggerGust();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [triggerGust]);

  const displayedStorm = stormAuto ? liveStorm : stormManual;

  return (
    <div className="relative h-screen w-screen select-none overflow-hidden bg-[#241654] text-white">
      {/* Full-viewport Three.js WebGL2 canvas */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Gentle atmospheric edge vignette — preserves crystal-clear sky & valley colors */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_64%,rgba(22,10,48,0.34)_100%)]" />

      {/* Top-left minimal editorial title & live telemetry */}
      <header className="pointer-events-none absolute left-5 top-5 z-10 max-w-sm">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#1a0e38]/45 px-3 py-1 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(142,242,255,0.9)]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-pink-100/90">
            花吹雪 · Procedural Valley
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white drop-shadow-[0_2px_16px_rgba(32,12,66,0.75)] sm:text-3xl">
          Sakura Storm Valley
        </h1>
        <div className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full border border-white/12 bg-[#1a0e38]/48 px-3 py-1 font-mono text-[10px] tracking-[0.13em] text-pink-100/95 backdrop-blur-md">
          <span>{fmt.format(TREE_COUNT)} TREES</span>
          <span className="text-pink-300/60">·</span>
          <span>{fmt.format(PETAL_COUNT)} PETALS</span>
          {fps > 0 && (
            <>
              <span className="text-pink-300/60">·</span>
              <span className="text-cyan-200">{fps} FPS</span>
            </>
          )}
        </div>
      </header>

      {/* Top-right compact camera bar, storm gust trigger & collapsible controls */}
      <div className="absolute right-5 top-5 z-10 flex flex-col items-end gap-2.5">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {/* Scenic camera presets */}
          <div className="flex items-center rounded-full border border-white/15 bg-[#1a0e38]/50 p-1 backdrop-blur-md">
            {CAMERA_MODES.map((m) => {
              const active = cameraMode === m.id && !manualActive;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleModeSelect(m.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-pink-400/90 to-fuchsia-400/90 text-white shadow-[0_0_12px_rgba(244,114,182,0.5)]"
                      : "text-pink-100/80 hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Instant cherry blossom storm gust button */}
          <button
            type="button"
            onClick={triggerGust}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium backdrop-blur-md transition ${
              gustFlash
                ? "border-cyan-200/80 bg-pink-400/60 text-white shadow-[0_0_20px_rgba(255,150,215,0.75)]"
                : "border-pink-200/30 bg-[#1a0e38]/50 text-pink-100 hover:border-pink-200/60 hover:bg-pink-400/25"
            }`}
            title="Unleash a rising cherry blossom storm gust (Space)"
          >
            Storm Gust
          </button>

          {/* Collapsible control drawer toggle */}
          <button
            type="button"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium backdrop-blur-md transition ${
              panelOpen
                ? "border-cyan-300/50 bg-[#1a0e38]/75 text-cyan-200"
                : "border-white/15 bg-[#1a0e38]/50 text-pink-100/90 hover:border-white/30 hover:text-white"
            }`}
          >
            {panelOpen ? "Close" : "Tune"}
          </button>
        </div>

        {/* Expandable fine-tuning drawer */}
        {panelOpen && (
          <aside className="w-64 space-y-3 rounded-2xl border border-white/15 bg-[#180d34]/72 p-4 shadow-[0_12px_40px_rgba(14,5,34,0.55)] backdrop-blur-xl">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-pink-200/75">
              <span>Atmosphere & Physics</span>
              <span className="text-cyan-300">{manualActive ? "ORBIT" : "CRUISE"}</span>
            </div>

            <SwitchRow label="Auto camera cruise" checked={autoCruise} onChange={setAutoCruise} />
            <SwitchRow label="Dynamic storm pulse" checked={stormAuto} onChange={setStormAuto} />

            <SliderRow
              label="Storm intensity"
              display={`${Math.round(displayedStorm * 100)}%`}
              value={displayedStorm}
              min={0.05}
              max={1}
              onChange={(v) => {
                setStormAuto(false);
                setStormManual(v);
              }}
            />

            <SliderRow
              label="Wind & turbulence"
              display={`${windScale.toFixed(1)}×`}
              value={windScale}
              min={0.3}
              max={2.0}
              step={0.05}
              onChange={setWindScale}
            />

            <SliderRow
              label="Cyber contours"
              display={`${Math.round(proceduralLevel * 100)}%`}
              value={proceduralLevel}
              min={0}
              max={1}
              onChange={setProceduralLevel}
            />
          </aside>
        )}
      </div>

      {/* Subtle bottom control legend */}
      <footer className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/12 bg-[#1a0e38]/42 px-3.5 py-1 font-mono text-[10px] tracking-[0.12em] text-pink-100/80 backdrop-blur-md">
        Drag orbit · Right-drag pan · Scroll zoom · Space storm gust
      </footer>

      {/* Initial loading curtain */}
      {!ready && !error && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-b from-[#241654] via-[#6f39a8] to-[#ff9676]">
          <p className="animate-pulse font-mono text-xs uppercase tracking-[0.35em] text-white/90">
            Blooming Sakura Valley…
          </p>
        </div>
      )}

      {/* Graceful WebGL2 fallback */}
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#1c1038]/95 p-6">
          <div className="max-w-md rounded-2xl border border-pink-300/30 bg-black/45 p-6 text-center backdrop-blur-md">
            <h2 className="text-lg font-semibold text-pink-100">WebGL 2 Required</h2>
            <p className="mt-2 text-xs leading-relaxed text-pink-100/75">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
