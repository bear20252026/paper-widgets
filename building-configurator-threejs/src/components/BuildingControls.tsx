import React from 'react';
import { Columns3, Moon, Sparkles, Sun, Sunrise } from 'lucide-react';
import { ArchitecturalStyle, LightingPreset } from '../core/types';

interface BuildingControlsProps {
  style: ArchitecturalStyle;
  lighting: LightingPreset;
  showColumns: boolean;
  postFX: boolean;
  onStyleChange: (style: ArchitecturalStyle) => void;
  onLightingChange: (preset: LightingPreset) => void;
  onToggleColumns: () => void;
  onTogglePostFX: () => void;
}

const STYLES: { id: ArchitecturalStyle; label: string }[] = [
  { id: 'contemporary', label: 'Limestone' },
  { id: 'brick-loft', label: 'Brick Loft' },
  { id: 'travertine-bronze', label: 'Travertine' },
];

export const BuildingControls: React.FC<BuildingControlsProps> = ({
  style,
  lighting,
  showColumns,
  postFX,
  onStyleChange,
  onLightingChange,
  onToggleColumns,
  onTogglePostFX,
}) => {
  return (
    <div className="bottom-dock" role="toolbar" aria-label="PBR Architectural Controls">
      {STYLES.map((s) => (
        <button
          key={s.id}
          className={`dock-btn ${style === s.id ? 'active' : ''}`}
          onClick={() => onStyleChange(s.id)}
        >
          <span>{s.label}</span>
        </button>
      ))}

      <div className="dock-sep" />

      <button
        className={`dock-btn ${lighting === 'golden-hour' ? 'active-amber' : ''}`}
        onClick={() => onLightingChange('golden-hour')}
        title="Warm Golden Hour sun & reflections"
      >
        <Sunrise size={14} />
        <span>Golden</span>
      </button>

      <button
        className={`dock-btn ${lighting === 'daylight' ? 'active' : ''}`}
        onClick={() => onLightingChange('daylight')}
        title="Crisp Midday Architectural Daylight"
      >
        <Sun size={14} />
        <span>Day</span>
      </button>

      <button
        className={`dock-btn ${lighting === 'twilight' ? 'active-violet' : ''}`}
        onClick={() => onLightingChange('twilight')}
        title="Cobalt Twilight with warm glowing interiors & soffit lights"
      >
        <Moon size={14} />
        <span>Twilight</span>
      </button>

      <div className="dock-sep" />

      <button
        className={`dock-btn ${postFX ? 'active' : ''}`}
        onClick={onTogglePostFX}
        title="Toggle WebGPU Ground-Truth Ambient Occlusion (GTAO) + Film Grade"
      >
        <Sparkles size={13} />
        <span>GTAO</span>
      </button>

      <button
        className={`dock-btn ${showColumns ? 'active' : ''}`}
        onClick={onToggleColumns}
        title="Toggle structural pilotis columns beneath deep cantilevers"
      >
        <Columns3 size={13} />
        <span>Pilotis</span>
      </button>
    </div>
  );
};
