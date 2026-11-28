import React from 'react';
import { Building2, Link2, Unlink2, RotateCcw } from 'lucide-react';
import { BuildingStats } from '../core/types';

export type MassingPresetKey =
  | 'box'
  | 'stepped-tower'
  | 'cantilever-pavilion'
  | 'courtyard-complex';

interface TopBarProps {
  activePreset: MassingPresetKey | null;
  stats: BuildingStats;
  cameraSync: boolean;
  onSelectPreset: (preset: MassingPresetKey) => void;
  onToggleCameraSync: () => void;
  onResetCamera: () => void;
}

const PRESETS: { id: MassingPresetKey; label: string }[] = [
  { id: 'box', label: 'Default Box' },
  { id: 'stepped-tower', label: 'Stepped Tower' },
  { id: 'cantilever-pavilion', label: 'Cantilever' },
  { id: 'courtyard-complex', label: 'Courtyard' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activePreset,
  stats,
  cameraSync,
  onSelectPreset,
  onToggleCameraSync,
  onResetCamera,
}) => {
  return (
    <header className="top-bar">
      <div className="brand">
        <div className="brand-mark">
          <Building2 size={16} />
        </div>
        <span className="brand-title">VOLUMECRAFT</span>
        <span className="brand-sub">Parametric Building Configurator</span>
      </div>

      <div className="preset-group" role="group" aria-label="Massing Presets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`preset-btn ${activePreset === p.id ? 'active' : ''}`}
            onClick={() => onSelectPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="stats-strip" aria-label="Building Metrics">
        <div className="stat-item">
          <span className="stat-label">Height</span>
          <span className="stat-value">{stats.totalHeight.toFixed(1)}m</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-label">Floors</span>
          <span className="stat-value">{stats.floors}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-label">GFA</span>
          <span className="stat-value">{stats.grossFloorArea.toLocaleString()} m²</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-label">Faces</span>
          <span className="stat-value">{stats.faceCount}</span>
        </div>
      </div>

      <div className="header-actions">
        <button
          className={`icon-pill-btn ${cameraSync ? 'active' : ''}`}
          onClick={onToggleCameraSync}
          title="Synchronize camera orbit between Massing and PBR views"
        >
          {cameraSync ? <Link2 size={14} /> : <Unlink2 size={14} />}
          <span>Sync Views</span>
        </button>
        <button
          className="icon-pill-btn"
          onClick={onResetCamera}
          title="Reset camera angle on both viewports"
        >
          <RotateCcw size={13} />
          <span>Reset Cam</span>
        </button>
      </div>
    </header>
  );
};
