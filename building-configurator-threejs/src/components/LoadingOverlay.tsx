import React, { useEffect, useState } from 'react';
import { Building2, Check, Loader2 } from 'lucide-react';
import { BuildingLoadSnapshot } from '../viewports/BuildingViewport';

interface LoadingOverlayProps {
  massingReady: boolean;
  snapshot: BuildingLoadSnapshot;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  massingReady,
  snapshot,
}) => {
  const gpuDone = massingReady && snapshot.gpuReady;
  const texturesDone =
    snapshot.texturesTotal > 0 && snapshot.texturesLoaded >= snapshot.texturesTotal;
  const hdrisDone = snapshot.hdrisTotal > 0 && snapshot.hdrisLoaded >= snapshot.hdrisTotal;
  const allReady = gpuDone && texturesDone && hdrisDone && snapshot.warmedUp;

  const gpuFrac = (massingReady ? 0.5 : 0) + (snapshot.gpuReady ? 0.5 : 0);
  const texFrac =
    snapshot.texturesTotal > 0
      ? Math.min(1, snapshot.texturesLoaded / snapshot.texturesTotal)
      : 0;
  const hdriFrac =
    snapshot.hdrisTotal > 0 ? Math.min(1, snapshot.hdrisLoaded / snapshot.hdrisTotal) : 0;
  const warmupFrac = snapshot.warmedUp ? 1 : 0;

  const progress = Math.round(
    gpuFrac * 15 + texFrac * 50 + hdriFrac * 30 + warmupFrac * 5
  );

  const [fading, setFading] = useState(false);
  const [unmounted, setUnmounted] = useState(false);

  useEffect(() => {
    if (!allReady) return;
    const t1 = window.setTimeout(() => setFading(true), 180);
    const t2 = window.setTimeout(() => setUnmounted(true), 640);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [allReady]);

  if (unmounted) return null;

  const statusLabel = allReady
    ? 'Ready'
    : !gpuDone
    ? 'Initializing 3D engine'
    : !texturesDone
    ? `Loading materials (${snapshot.texturesLoaded}/${snapshot.texturesTotal})`
    : !hdrisDone
    ? `Loading lighting (${snapshot.hdrisLoaded}/${snapshot.hdrisTotal})`
    : 'Preparing studio';

  return (
    <div
      className={`loader-overlay ${fading ? 'fading' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading 3D building configurator assets"
    >
      <div className="loader-card">
        <div className="loader-header">
          <div className="loader-logo">
            <Building2 size={18} strokeWidth={1.8} />
          </div>
          <div className="loader-brand-copy">
            <div className="loader-title">VOLUMECRAFT</div>
            <div className="loader-subtitle">Parametric Building Studio</div>
          </div>
        </div>

        <div className="loader-bar-wrap">
          <div className="loader-track">
            <div className="loader-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="loader-bar-meta">
            <span className="loader-status-text">{statusLabel}</span>
            <span className="loader-percent">{progress}%</span>
          </div>
        </div>

        <div className="loader-steps">
          <div className={`loader-step ${gpuDone ? 'done' : 'active'}`}>
            <span className="loader-step-icon">
              {gpuDone ? <Check size={11} strokeWidth={2.2} /> : <Loader2 size={11} className="spin" />}
            </span>
            <span className="loader-step-label">{snapshot.gpuBackend ?? 'Engine'}</span>
          </div>

          <div className={`loader-step ${texturesDone ? 'done' : gpuDone ? 'active' : ''}`}>
            <span className="loader-step-icon">
              {texturesDone ? <Check size={11} strokeWidth={2.2} /> : <Loader2 size={11} className="spin" />}
            </span>
            <span className="loader-step-label">
              Materials {snapshot.texturesLoaded}/{snapshot.texturesTotal}
            </span>
          </div>

          <div className={`loader-step ${hdrisDone ? 'done' : texturesDone ? 'active' : ''}`}>
            <span className="loader-step-icon">
              {hdrisDone ? <Check size={11} strokeWidth={2.2} /> : <Loader2 size={11} className="spin" />}
            </span>
            <span className="loader-step-label">
              Lighting {snapshot.hdrisLoaded}/{snapshot.hdrisTotal}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
