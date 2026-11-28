import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Download,
  Eye,
  EyeOff,
  Grid3X3,
  Moon,
  Orbit,
  Sliders,
  Sparkles,
  Sun,
  Sunrise,
} from 'lucide-react';
import { VesselViewport, type VesselViewportHandle } from './three/VesselViewport';
import { ControlPanel } from './components/ControlPanel';
import { ContactCard } from './components/ContactCard';
import { DirectorStage } from './director/DirectorStage';
import {
  DEFAULT_VESSEL_PARAMS,
  FINISH_PALETTES,
  type CameraPresetId,
  type LightingMood,
  type VesselParams,
  type VesselStats,
} from './types/vessel';

const CAMERA_BUTTONS: { id: CameraPresetId; label: string }[] = [
  { id: 'hero', label: 'Hero' },
  { id: 'oculus', label: 'Oculus' },
  { id: 'closeup', label: 'Detail' },
  { id: 'isometric', label: 'Iso' },
  { id: 'plaza', label: 'Plaza' },
];

const MOOD_BUTTONS: { id: LightingMood; label: string; sunElev: number }[] = [
  { id: 'golden', label: 'Golden', sunElev: 22 },
  { id: 'blueHour', label: 'Dusk', sunElev: 3 },
  { id: 'noon', label: 'Noon', sunElev: 56 },
  { id: 'studio', label: 'Studio', sunElev: 38 },
];

export default function App() {
  // Support frame-accurate video director mode (?director=1) and live reel preview (?director=play)
  const directorParam =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('director') : null;
  if (directorParam === '1' || directorParam === 'play') {
    return <DirectorStage autoplay={directorParam === 'play'} />;
  }

  const [params, setParams] = useState<VesselParams>(DEFAULT_VESSEL_PARAMS);
  const [activePresetId, setActivePresetId] = useState<string | null>('classic');
  const [activeCam, setActiveCam] = useState<CameraPresetId | null>('hero');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [uiHidden, setUiHidden] = useState(false);
  const [stats, setStats] = useState<VesselStats>({
    landings: 88,
    flights: 160,
    totalSteps: 2240,
    vertices: 0,
    triangles: 0,
    rebuildMs: 0,
    overallHeight: 33.0,
    overallDiameter: 45.2,
  });

  const viewportRef = useRef<VesselViewportHandle | null>(null);

  const handleParamChange = useCallback(
    <K extends keyof VesselParams>(key: K, value: VesselParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
      if (
        key !== 'autoOrbit' &&
        key !== 'wireframe' &&
        key !== 'lightingMood' &&
        key !== 'sunElevationDeg' &&
        key !== 'sunAzimuthDeg'
      ) {
        setActivePresetId(null);
      }
    },
    []
  );

  const handleApplyPreset = useCallback((presetId: string, overrides: Partial<VesselParams>) => {
    setParams((prev) => ({ ...prev, ...overrides }));
    setActivePresetId(presetId);
  }, []);

  const handleReset = useCallback(() => {
    setParams(DEFAULT_VESSEL_PARAMS);
    setActivePresetId('classic');
    viewportRef.current?.flyToPreset('hero');
  }, []);

  const handleMoodSelect = useCallback((mood: LightingMood, defaultElev: number) => {
    setParams((prev) => ({ ...prev, lightingMood: mood, sunElevationDeg: defaultElev }));
  }, []);

  // Keyboard shortcuts: H (hide UI), 1-5 (camera fly-to), Space (auto-orbit)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setUiHidden((v) => !v);
      } else if (e.key === ' ') {
        e.preventDefault();
        setParams((prev) => ({ ...prev, autoOrbit: !prev.autoOrbit }));
      } else if (e.key >= '1' && e.key <= '5') {
        const idx = parseInt(e.key, 10) - 1;
        const cam = CAMERA_BUTTONS[idx];
        if (cam) viewportRef.current?.flyToPreset(cam.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const fmtNum = (n: number) => n.toLocaleString('en-US');

  return (
    <div className="app-shell">
      <VesselViewport
        ref={viewportRef}
        params={params}
        inspectorVisible={inspectorOpen && !uiHidden}
        onStats={setStats}
        onActiveCameraChange={setActiveCam}
      />

      {/* Top-Left Editorial Title & Live Telemetry Plaque */}
      <header className={`hud-header ${uiHidden ? 'is-hidden' : ''}`}>
        <div className="brand-card">
          <div className="brand-eyebrow">
            <span className="brand-dot" />
            <span>Hudson Yards · New York City</span>
          </div>
          <h1 className="brand-title">THE VESSEL</h1>
          <p className="brand-subtitle">Procedural Honeycomb Staircase Showcase</p>

          <div className="telemetry-strip">
            <div className="stat-cell">
              <span className="stat-value">{fmtNum(stats.landings)}</span>
              <span className="stat-label">Landings</span>
            </div>
            <div className="stat-cell">
              <span className="stat-value">{fmtNum(stats.flights)}</span>
              <span className="stat-label">Flights</span>
            </div>
            <div className="stat-cell">
              <span className="stat-value">{fmtNum(stats.totalSteps)}</span>
              <span className="stat-label">Steps</span>
            </div>
            <div className="stat-cell">
              <span className="stat-value">{stats.rebuildMs.toFixed(1)}ms</span>
              <span className="stat-label">Build</span>
            </div>
          </div>

          <div className="stat-subrow">
            <span>
              <strong>{fmtNum(stats.triangles)}</strong> tris · 6 draw calls
            </span>
            <span>
              {stats.overallHeight.toFixed(1)}m H × {stats.overallDiameter.toFixed(1)}m Ø
            </span>
          </div>
        </div>
      </header>

      {/* Bottom-Center Floating Camera, Mood & Tool Dock */}
      <nav
        className={`bottom-dock ${inspectorOpen && !uiHidden ? 'is-shifted' : ''} ${uiHidden ? 'is-hidden' : ''}`}
        aria-label="Viewport controls"
      >
        <div className="dock-group">
          <Camera size={13} style={{ color: 'var(--accent)', marginLeft: 6, marginRight: 2 }} />
          {CAMERA_BUTTONS.map((cam) => (
            <button
              key={cam.id}
              type="button"
              className={`dock-btn ${activeCam === cam.id ? 'is-active' : ''}`}
              onClick={() => viewportRef.current?.flyToPreset(cam.id)}
            >
              {cam.label}
            </button>
          ))}
        </div>

        <div className="dock-divider" />

        <div className="dock-group">
          {MOOD_BUTTONS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`dock-btn ${params.lightingMood === m.id ? 'is-active' : ''}`}
              onClick={() => handleMoodSelect(m.id, m.sunElev)}
            >
              {m.id === 'golden' && <Sunrise size={12} />}
              {m.id === 'blueHour' && <Moon size={12} />}
              {m.id === 'noon' && <Sun size={12} />}
              {m.id === 'studio' && <Sparkles size={12} />}
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="dock-divider" />

        <div className="dock-group">
          <button
            type="button"
            className={`dock-btn dock-icon-btn ${params.autoOrbit ? 'is-active' : ''}`}
            title="Auto-Orbit (Space)"
            onClick={() => handleParamChange('autoOrbit', !params.autoOrbit)}
          >
            <Orbit size={14} />
          </button>
          <button
            type="button"
            className={`dock-btn dock-icon-btn ${params.wireframe ? 'is-active' : ''}`}
            title="Wireframe Topology"
            onClick={() => handleParamChange('wireframe', !params.wireframe)}
          >
            <Grid3X3 size={14} />
          </button>
          <button
            type="button"
            className="dock-btn dock-icon-btn"
            title="Export live 3D model as .GLB"
            onClick={() => viewportRef.current?.exportGLB()}
          >
            <Download size={14} />
          </button>
          <button
            type="button"
            className={`dock-btn dock-icon-btn ${inspectorOpen ? 'is-active' : ''}`}
            title="Toggle Parameters Panel"
            onClick={() => setInspectorOpen((v) => !v)}
          >
            <Sliders size={14} />
          </button>
          <button
            type="button"
            className="dock-btn dock-icon-btn"
            title="Hide HUD for Clean View (H)"
            onClick={() => setUiHidden(true)}
          >
            <EyeOff size={14} />
          </button>
        </div>
      </nav>

      {/* Restore UI Floating Pill */}
      {uiHidden && (
        <button type="button" className="restore-ui-btn" onClick={() => setUiHidden(false)}>
          <Eye size={14} />
          <span>Show UI (H)</span>
        </button>
      )}

      {/* Right-Hand Collapsible Procedural Parameters Drawer */}
      <ControlPanel
        params={params}
        activePresetId={activePresetId}
        open={inspectorOpen && !uiHidden}
        onChange={handleParamChange}
        onApplyPreset={handleApplyPreset}
        onReset={handleReset}
        onClose={() => setInspectorOpen(false)}
      />

      {/* Author / Profile & Open-Source Repo Card (Bottom-Right, synced to building accent) */}
      <ContactCard
        accent={FINISH_PALETTES[params.finishPreset].swatch}
        hidden={uiHidden}
      />
    </div>
  );
}
