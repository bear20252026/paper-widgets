import React from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  Layers,
  Magnet,
  Minus,
  Plus,
  Redo2,
  Scissors,
  SquareDashed,
  Undo2,
} from 'lucide-react';
import { MassingFace, SplitAxis, ToolMode, TYPICAL_FLOOR_HEIGHT } from '../core/types';
import { dirLabel } from '../core/math2d';

interface MassingToolbarProps {
  toolMode: ToolMode;
  splitAxis: SplitAxis;
  floorSnap: boolean;
  canUndo: boolean;
  canRedo: boolean;
  selectedFace: MassingFace | null;
  onToolChange: (tool: ToolMode) => void;
  onSplitAxisChange: (axis: SplitAxis) => void;
  onToggleFloorSnap: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onResetBox: () => void;
  onQuickExtrude: (distance: number, insetMargin?: number) => void;
  onQuickSplit: () => void;
  onQuickInset: () => void;
}

export const MassingToolbar: React.FC<MassingToolbarProps> = ({
  toolMode,
  splitAxis,
  floorSnap,
  canUndo,
  canRedo,
  selectedFace,
  onToolChange,
  onSplitAxisChange,
  onToggleFloorSnap,
  onUndo,
  onRedo,
  onResetBox,
  onQuickExtrude,
  onQuickSplit,
  onQuickInset,
}) => {
  const isVerticalFace =
    selectedFace !== null && (selectedFace.dir === '+y' || selectedFace.dir === '-y');
  const stepDist = isVerticalFace ? TYPICAL_FLOOR_HEIGHT : 3.0;
  const stepLabel = isVerticalFace ? '+1 Floor (3.6m)' : '+3.0m Out';

  return (
    <>
      {/* Selected Face Quick-Action Inspector */}
      {selectedFace && (
        <div className="face-inspector">
          <div className="face-inspector-top">
            <span className="face-inspector-title">
              <Box size={13} strokeWidth={1.8} />
              {dirLabel(selectedFace.dir)}
            </span>
            <span className="face-inspector-dims">
              {selectedFace.width.toFixed(1)}m × {selectedFace.height.toFixed(1)}m
            </span>
          </div>

          <div className="face-quick-actions">
            {selectedFace.dir === '-y' && selectedFace.plane > 0.1 && (
              <button
                className="quick-btn primary"
                onClick={() => onQuickExtrude(selectedFace.plane, 0)}
                title="Pull overhang cleanly down to ground (0.0m) and merge into a single full-height block"
              >
                <ArrowDownToLine size={12} />
                <span>Drop to Ground (0.0m)</span>
              </button>
            )}
            <button
              className="quick-btn primary"
              onClick={() => onQuickExtrude(stepDist, 0)}
              title="Extrude selected face outward, spawning new selectable side faces"
            >
              <Plus size={12} />
              <span>{stepLabel}</span>
            </button>
            <button
              className="quick-btn violet"
              onClick={() => onQuickExtrude(stepDist, 1.6)}
              title="Inset and extrude in one step to create a setback terrace"
            >
              <Layers size={12} />
              <span>Setback +</span>
            </button>
            <button
              className="quick-btn"
              onClick={onQuickSplit}
              title="Split this face into 2 independent sub-faces"
            >
              <Scissors size={12} />
              <span>Split 1/2</span>
            </button>
            <button
              className="quick-btn"
              onClick={onQuickInset}
              title="Inset face to create border strips + inner face"
            >
              <SquareDashed size={12} />
              <span>Inset</span>
            </button>
            <button
              className="quick-btn danger"
              onClick={() => onQuickExtrude(isVerticalFace ? -TYPICAL_FLOOR_HEIGHT : -2.0, 0)}
              title="Carve / push this face inward"
            >
              <Minus size={12} />
              <span>Carve</span>
            </button>
          </div>

          <div className="face-hint">
            Drag the 3D arrow handle to extrude · Shift+Drag for setback · Alt for 0.5m snap
          </div>
        </div>
      )}

      {/* Split Axis Sub-options */}
      {toolMode === 'split' && (
        <div className="split-subbar">
          {(['auto', 'u', 'v', 'grid'] as SplitAxis[]).map((axis) => (
            <button
              key={axis}
              className={`sub-chip ${splitAxis === axis ? 'active' : ''}`}
              onClick={() => onSplitAxisChange(axis)}
            >
              {axis === 'auto'
                ? 'Auto Cut'
                : axis === 'u'
                ? 'Cut U'
                : axis === 'v'
                ? 'Cut V'
                : '2×2 Grid'}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Floating CAD Tool Dock */}
      <div className="bottom-dock" role="toolbar" aria-label="Massing CAD Tools">
        <button
          className={`dock-btn ${toolMode === 'extrude' ? 'active' : ''}`}
          onClick={() => onToolChange('extrude')}
          title="Select a face and drag its 3D arrow to extrude or carve (E)"
        >
          <ArrowUpFromLine size={14} />
          <span>Extrude</span>
          <span className="kbd-hint">E</span>
        </button>

        <button
          className={`dock-btn ${toolMode === 'setback' ? 'active-violet' : ''}`}
          onClick={() => onToolChange('setback')}
          title="Inset & extrude simultaneously for architectural terraces (S)"
        >
          <Layers size={14} />
          <span>Setback</span>
          <span className="kbd-hint">S</span>
        </button>

        <button
          className={`dock-btn ${toolMode === 'split' ? 'active-amber' : ''}`}
          onClick={() => onToolChange('split')}
          title="Click any face to split it into independently extrudable sub-faces (K)"
        >
          <Scissors size={14} />
          <span>Split</span>
          <span className="kbd-hint">K</span>
        </button>

        <button
          className={`dock-btn ${toolMode === 'inset' ? 'active' : ''}`}
          onClick={() => onToolChange('inset')}
          title="Click any face to inset an inner panel + 4 border strips (I)"
        >
          <SquareDashed size={14} />
          <span>Inset</span>
          <span className="kbd-hint">I</span>
        </button>

        <div className="dock-sep" />

        <button
          className={`dock-btn ${floorSnap ? 'active' : ''}`}
          onClick={onToggleFloorSnap}
          title="Toggle architectural floor-height snapping (3.6m vertical / 1m horizontal)"
        >
          <Magnet size={14} />
          <span>{floorSnap ? 'Floor Snap' : 'Free 0.5m'}</span>
        </button>

        <div className="dock-sep" />

        <button className="dock-btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button className="dock-btn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo2 size={14} />
        </button>
        <button className="dock-btn" onClick={onResetBox} title="Reset to default box">
          <Box size={14} />
          <span>Reset</span>
        </button>
      </div>
    </>
  );
};
