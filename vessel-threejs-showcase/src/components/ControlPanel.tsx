import { useState, type ReactNode } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Hexagon,
  Layers,
  Palette,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ARCHITECTURAL_PRESETS,
  DEFAULT_VESSEL_PARAMS,
  FINISH_PALETTES,
  type FinishPreset,
  type VesselParams,
} from '../types/vessel';

interface ControlPanelProps {
  params: VesselParams;
  activePresetId: string | null;
  open: boolean;
  onChange: <K extends keyof VesselParams>(key: K, value: VesselParams[K]) => void;
  onApplyPreset: (presetId: string, overrides: Partial<VesselParams>) => void;
  onReset: () => void;
  onClose: () => void;
}

interface SliderControlProps {
  label: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (val: number) => void;
}

function SliderControl({
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  unit = '',
  format,
  onChange,
}: SliderControlProps) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const formatted = format
    ? format(value)
    : step >= 1
      ? `${Math.round(value)}${unit}`
      : `${value.toFixed(step < 0.05 ? 3 : 2)}${unit}`;

  return (
    <div className="slider-row">
      <div className="slider-meta">
        <span
          className="slider-label"
          title="Double-click to reset to default"
          onDoubleClick={() => onChange(defaultValue)}
        >
          {label}
        </span>
        <span className="slider-val">{formatted}</span>
      </div>
      <input
        type="range"
        className="range-input"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{
          background: `linear-gradient(90deg, var(--accent) 0%, var(--accent-bright) ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
        }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="toggle-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="toggle-label">{label}</span>
      <div className={`switch-track ${checked ? 'is-on' : ''}`}>
        <div className="switch-thumb" />
      </div>
    </div>
  );
}

function AccordionSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  return (
    <div className="panel-section">
      <button type="button" className="panel-header" onClick={() => setExpanded((e) => !e)}>
        <span className="panel-header-left">
          {icon}
          <span>{title}</span>
        </span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {expanded && <div className="panel-body">{children}</div>}
    </div>
  );
}

export function ControlPanel({
  params,
  activePresetId,
  open,
  onChange,
  onApplyPreset,
  onReset,
  onClose,
}: ControlPanelProps) {
  return (
    <aside className={`inspector-drawer ${open ? '' : 'is-collapsed'}`}>
      <div className="inspector-top">
        <div className="inspector-heading">
          <Sliders size={14} />
          <span>Procedural Parameters</span>
        </div>
        <div className="inspector-top-actions">
          <button type="button" className="micro-btn" onClick={onReset} title="Reset all parameters">
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>
          <button type="button" className="micro-btn" onClick={onClose} title="Collapse panel (H)">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Quick Architectural Presets */}
      <div className="preset-strip">
        <div className="preset-strip-label">Architectural Presets</div>
        <div className="preset-grid">
          {ARCHITECTURAL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-chip ${activePresetId === preset.id ? 'is-active' : ''}`}
              title={preset.subtitle}
              onClick={() => onApplyPreset(preset.id, preset.overrides)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6 Collapsible Panels matching Blender 5.1 Geometry Nodes Modifier */}
      <div className="inspector-scroll">
        <AccordionSection title="1. Silhouette & Scale" icon={<Building2 size={14} />} defaultOpen>
          <SliderControl
            label="Radial Bays"
            value={params.radialBays}
            defaultValue={DEFAULT_VESSEL_PARAMS.radialBays}
            min={3}
            max={24}
            step={1}
            onChange={(v) => onChange('radialBays', Math.round(v))}
          />
          <SliderControl
            label="Vertical Levels"
            value={params.verticalLevels}
            defaultValue={DEFAULT_VESSEL_PARAMS.verticalLevels}
            min={2}
            max={20}
            step={1}
            onChange={(v) => onChange('verticalLevels', Math.round(v))}
          />
          <SliderControl
            label="Total Height"
            value={params.totalHeight}
            defaultValue={DEFAULT_VESSEL_PARAMS.totalHeight}
            min={6}
            max={90}
            step={0.5}
            unit=" m"
            format={(v) => `${v.toFixed(1)} m`}
            onChange={(v) => onChange('totalHeight', v)}
          />
          <SliderControl
            label="Base Radius"
            value={params.baseRadius}
            defaultValue={DEFAULT_VESSEL_PARAMS.baseRadius}
            min={2.5}
            max={30}
            step={0.25}
            unit=" m"
            format={(v) => `${v.toFixed(2)} m`}
            onChange={(v) => onChange('baseRadius', v)}
          />
          <SliderControl
            label="Top Radius"
            value={params.topRadius}
            defaultValue={DEFAULT_VESSEL_PARAMS.topRadius}
            min={4}
            max={50}
            step={0.25}
            unit=" m"
            format={(v) => `${v.toFixed(2)} m`}
            onChange={(v) => onChange('topRadius', v)}
          />
          <SliderControl
            label="Profile Power"
            value={params.profilePower}
            defaultValue={DEFAULT_VESSEL_PARAMS.profilePower}
            min={0.35}
            max={2.4}
            step={0.02}
            onChange={(v) => onChange('profilePower', v)}
          />
          <SliderControl
            label="Profile Bulge"
            value={params.profileBulge}
            defaultValue={DEFAULT_VESSEL_PARAMS.profileBulge}
            min={-8}
            max={12}
            step={0.1}
            format={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} m`}
            onChange={(v) => onChange('profileBulge', v)}
          />
          <SliderControl
            label="Vertical Power"
            value={params.verticalPower}
            defaultValue={DEFAULT_VESSEL_PARAMS.verticalPower}
            min={0.7}
            max={1.6}
            step={0.02}
            onChange={(v) => onChange('verticalPower', v)}
          />
          <SliderControl
            label="Spiral Twist"
            value={params.spiralTwistDeg}
            defaultValue={DEFAULT_VESSEL_PARAMS.spiralTwistDeg}
            min={-180}
            max={180}
            step={1}
            unit="°"
            onChange={(v) => onChange('spiralTwistDeg', v)}
          />
        </AccordionSection>

        <AccordionSection title="2. Honeycomb & Landings" icon={<Hexagon size={14} />} defaultOpen>
          <SliderControl
            label="Landing Ratio"
            value={params.landingRatio}
            defaultValue={DEFAULT_VESSEL_PARAMS.landingRatio}
            min={0.08}
            max={0.44}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onChange('landingRatio', v)}
          />
          <SliderControl
            label="Walkway Width"
            value={params.walkwayWidth}
            defaultValue={DEFAULT_VESSEL_PARAMS.walkwayWidth}
            min={1.0}
            max={6.5}
            step={0.1}
            format={(v) => `${v.toFixed(1)} m`}
            onChange={(v) => onChange('walkwayWidth', v)}
          />
          <SliderControl
            label="Double-Track Split"
            value={params.doubleTrackSplit}
            defaultValue={DEFAULT_VESSEL_PARAMS.doubleTrackSplit}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onChange('doubleTrackSplit', v)}
          />
          <SliderControl
            label="Flight Gap"
            value={params.flightGap}
            defaultValue={DEFAULT_VESSEL_PARAMS.flightGap}
            min={0}
            max={1.2}
            step={0.02}
            format={(v) => `${v.toFixed(2)} m`}
            onChange={(v) => onChange('flightGap', v)}
          />
          <ToggleControl
            label="Close Top Rim (360° Skywalk)"
            checked={params.closeTopRim}
            onChange={(v) => onChange('closeTopRim', v)}
          />
        </AccordionSection>

        <AccordionSection title="3. Stairs & Structural Hull" icon={<Layers size={14} />}>
          <SliderControl
            label="Steps Per Flight"
            value={params.stepsPerFlight}
            defaultValue={DEFAULT_VESSEL_PARAMS.stepsPerFlight}
            min={3}
            max={30}
            step={1}
            onChange={(v) => onChange('stepsPerFlight', Math.round(v))}
          />
          <SliderControl
            label="Step Nosing"
            value={params.stepNosing}
            defaultValue={DEFAULT_VESSEL_PARAMS.stepNosing}
            min={0}
            max={0.1}
            step={0.005}
            format={(v) => `${(v * 100).toFixed(1)} cm`}
            onChange={(v) => onChange('stepNosing', v)}
          />
          <SliderControl
            label="Slab Thickness"
            value={params.slabThickness}
            defaultValue={DEFAULT_VESSEL_PARAMS.slabThickness}
            min={0.06}
            max={1.0}
            step={0.02}
            format={(v) => `${v.toFixed(2)} m`}
            onChange={(v) => onChange('slabThickness', v)}
          />
          <SliderControl
            label="Soffit Depth"
            value={params.soffitDepth}
            defaultValue={DEFAULT_VESSEL_PARAMS.soffitDepth}
            min={0.06}
            max={2.2}
            step={0.02}
            format={(v) => `${v.toFixed(2)} m`}
            onChange={(v) => onChange('soffitDepth', v)}
          />
          <SliderControl
            label="Soffit Taper (Hull Keel)"
            value={params.soffitTaper}
            defaultValue={DEFAULT_VESSEL_PARAMS.soffitTaper}
            min={0}
            max={0.49}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onChange('soffitTaper', v)}
          />
          <SliderControl
            label="Stringer Width"
            value={params.stringerWidth}
            defaultValue={DEFAULT_VESSEL_PARAMS.stringerWidth}
            min={0.04}
            max={0.35}
            step={0.01}
            format={(v) => `${(v * 100).toFixed(0)} cm`}
            onChange={(v) => onChange('stringerWidth', v)}
          />
          <ToggleControl
            label="Show Structural Ribs"
            checked={params.showStructuralRibs}
            onChange={(v) => onChange('showStructuralRibs', v)}
          />
        </AccordionSection>

        <AccordionSection title="4. Balustrades & Handrails" icon={<Shield size={14} />}>
          <ToggleControl
            label="Show Railings"
            checked={params.showRailings}
            onChange={(v) => onChange('showRailings', v)}
          />
          <ToggleControl
            label="Show Glass Panels"
            checked={params.showGlass}
            onChange={(v) => onChange('showGlass', v)}
          />
          <SliderControl
            label="Railing Height"
            value={params.railingHeight}
            defaultValue={DEFAULT_VESSEL_PARAMS.railingHeight}
            min={0.45}
            max={2.2}
            step={0.05}
            format={(v) => `${v.toFixed(2)} m`}
            onChange={(v) => onChange('railingHeight', v)}
          />
          <SliderControl
            label="Glass Thickness"
            value={params.glassThickness}
            defaultValue={DEFAULT_VESSEL_PARAMS.glassThickness}
            min={0.015}
            max={0.14}
            step={0.005}
            format={(v) => `${(v * 100).toFixed(1)} cm`}
            onChange={(v) => onChange('glassThickness', v)}
          />
          <SliderControl
            label="Handrail Width"
            value={params.handrailWidth}
            defaultValue={DEFAULT_VESSEL_PARAMS.handrailWidth}
            min={0.04}
            max={0.28}
            step={0.01}
            format={(v) => `${(v * 100).toFixed(0)} cm`}
            onChange={(v) => onChange('handrailWidth', v)}
          />
          <SliderControl
            label="Handrail Height"
            value={params.handrailHeight}
            defaultValue={DEFAULT_VESSEL_PARAMS.handrailHeight}
            min={0.02}
            max={0.18}
            step={0.01}
            format={(v) => `${(v * 100).toFixed(0)} cm`}
            onChange={(v) => onChange('handrailHeight', v)}
          />
          <SliderControl
            label="Posts Per Span"
            value={params.postsPerSpan}
            defaultValue={DEFAULT_VESSEL_PARAMS.postsPerSpan}
            min={0}
            max={10}
            step={1}
            onChange={(v) => onChange('postsPerSpan', Math.round(v))}
          />
        </AccordionSection>

        <AccordionSection title="5. Base Plinth & Plaza" icon={<Sparkles size={14} />}>
          <ToggleControl
            label="Show Base Plinth"
            checked={params.showBasePlinth}
            onChange={(v) => onChange('showBasePlinth', v)}
          />
          <SliderControl
            label="Base Height"
            value={params.baseHeight}
            defaultValue={DEFAULT_VESSEL_PARAMS.baseHeight}
            min={0.2}
            max={4.0}
            step={0.05}
            format={(v) => `${v.toFixed(2)} m`}
            onChange={(v) => onChange('baseHeight', v)}
          />
          <SliderControl
            label="Base Overhang"
            value={params.baseOverhang}
            defaultValue={DEFAULT_VESSEL_PARAMS.baseOverhang}
            min={0}
            max={10}
            step={0.2}
            format={(v) => `${v.toFixed(1)} m`}
            onChange={(v) => onChange('baseOverhang', v)}
          />
          <SliderControl
            label="Base Step Tiers"
            value={params.baseStepTiers}
            defaultValue={DEFAULT_VESSEL_PARAMS.baseStepTiers}
            min={1}
            max={8}
            step={1}
            onChange={(v) => onChange('baseStepTiers', Math.round(v))}
          />
        </AccordionSection>

        <AccordionSection title="6. Materials & Atmosphere" icon={<Palette size={14} />}>
          <div className="swatch-grid">
            {(Object.keys(FINISH_PALETTES) as FinishPreset[]).map((key) => {
              const p = FINISH_PALETTES[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`swatch-btn ${params.finishPreset === key ? 'is-active' : ''}`}
                  onClick={() => onChange('finishPreset', key)}
                  title={p.label}
                >
                  <span className="swatch-orb" style={{ background: p.swatch }} />
                  <span>{p.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
          <SliderControl
            label="Copper Roughness"
            value={params.copperRoughness}
            defaultValue={DEFAULT_VESSEL_PARAMS.copperRoughness}
            min={0.04}
            max={0.65}
            step={0.01}
            onChange={(v) => onChange('copperRoughness', v)}
          />
          <SliderControl
            label="Copper Metalness"
            value={params.copperMetalness}
            defaultValue={DEFAULT_VESSEL_PARAMS.copperMetalness}
            min={0.1}
            max={1.0}
            step={0.02}
            onChange={(v) => onChange('copperMetalness', v)}
          />
          <SliderControl
            label="Sun Elevation"
            value={params.sunElevationDeg}
            defaultValue={DEFAULT_VESSEL_PARAMS.sunElevationDeg}
            min={2}
            max={78}
            step={1}
            unit="°"
            onChange={(v) => onChange('sunElevationDeg', v)}
          />
          <SliderControl
            label="Sun Azimuth"
            value={params.sunAzimuthDeg}
            defaultValue={DEFAULT_VESSEL_PARAMS.sunAzimuthDeg}
            min={-180}
            max={180}
            step={1}
            unit="°"
            onChange={(v) => onChange('sunAzimuthDeg', v)}
          />
        </AccordionSection>
      </div>

      <div className="inspector-footer">
        <span>Double-click any label to reset</span>
        <span>
          <span className="kbd-hint">H</span> UI &nbsp;
          <span className="kbd-hint">1–5</span> Cams
        </span>
      </div>
    </aside>
  );
}
