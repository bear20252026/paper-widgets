import { FINISH_PALETTES, type FinishPreset, type VesselStats } from '../types/vessel';
import type { DirectorFrameState } from './directorTimeline';

interface DirectorOverlayProps {
  state: DirectorFrameState;
  stats: VesselStats;
}

const ALLOY_ORDER: FinishPreset[] = ['roseCopper', 'champagneGold', 'titanium', 'obsidian'];

/**
 * Remotion / Claude-video style kinetic 1080p motion-graphics overlay.
 * Crisp oversized typography, live animated parameter sliders, beat-synced
 * timeline progress bar, and real-time architectural telemetry counters.
 */
export function DirectorOverlay({ state, stats }: DirectorOverlayProps) {
  // Smooth entrance spring on every shot (first 0.28s)
  const enterT = Math.min(1, state.shotTime / 0.28);
  const enterEase = 1 - Math.pow(1 - enterT, 4);
  const slideY = (1 - enterEase) * 18;
  const fade = Math.min(1, state.shotTime / 0.16);

  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <div className="dir-overlay" aria-hidden="true">
      {/* Subtle cinematic top-edge progress timeline with 13 beat segments */}
      <div className="dir-top-bar" style={state.showFullUI ? { paddingRight: 386 } : undefined}>
        <div className="dir-progress-track">
          <div className="dir-progress-fill" style={{ width: `${state.progress * 100}%` }} />
        </div>
        <div className="dir-top-meta">
          <span className="dir-badge">
            <span
              className="dir-pulse-dot"
              style={{ transform: `scale(${1 + state.beatPulse * 0.45})` }}
            />
            PROCEDURAL LIVE ENGINE
          </span>
          <span className="dir-shot-counter">
            SCENE {String(state.shotIndex).padStart(2, '0')} / {state.shotCount}
          </span>
          {!state.showFullUI && (
            <span className="dir-telemetry-inline">
              <strong>{fmt(stats.landings)}</strong> LANDINGS · <strong>{fmt(stats.flights)}</strong>{' '}
              FLIGHTS · <strong>{fmt(stats.totalSteps)}</strong> STEPS ·{' '}
              <strong>{fmt(stats.triangles)}</strong> TRIS
            </span>
          )}
        </div>
      </div>

      {/* Subtle vignette for crisp editorial typography legibility */}
      <div className="dir-vignette" />

      {/* Main Kinetic Title Block (Hidden during Shot 12 full interactive UI so real UI shines) */}
      {!state.showFullUI && !state.isFinaleOutro && (
        <div
          className={`dir-title-block ${state.isHeroIntro ? 'is-hero' : ''}`}
          style={{
            opacity: fade,
            transform: `translateY(${slideY}px)`,
          }}
        >
          <div className="dir-eyebrow">{state.eyebrow}</div>
          <h1 className="dir-headline">{state.headline}</h1>
          <p className="dir-subline">{state.subline}</p>

          {state.wireframeBadge && (
            <div className="dir-wire-pill">WIREFRAME TOPOLOGY · ZERO BAKED MESHES</div>
          )}
        </div>
      )}

      {/* Shot 12 Compact Floating Callout Badge (left-bottom above dock while full UI is live!) */}
      {state.showFullUI && (
        <div
          className="dir-ui-callout"
          style={{ opacity: fade, transform: `translateY(${slideY}px)` }}
        >
          <span className="dir-eyebrow" style={{ marginBottom: 4 }}>
            {state.eyebrow}
          </span>
          <div className="dir-ui-callout-title">{state.headline}</div>
          <div className="dir-ui-callout-sub">{state.subline}</div>
        </div>
      )}

      {/* Floating Animated Real-Time Parameter Sliders Card (Bottom-Right!) */}
      {!state.showFullUI && state.hudSliders.length > 0 && (
        <div
          className="dir-param-card"
          style={{
            opacity: fade,
            transform: `translateY(${slideY}px)`,
          }}
        >
          <div className="dir-param-card-head">
            <span>LIVE PARAMETER MORPH</span>
            <span className="dir-live-tag">REAL-TIME</span>
          </div>
          {state.hudSliders.map((s) => (
            <div key={s.label} className="dir-slider-item">
              <div className="dir-slider-row-top">
                <span className="dir-slider-name">{s.label}</span>
                <span className={`dir-slider-num ${s.accent ? 'is-accent' : ''}`}>
                  {s.valueText}
                </span>
              </div>
              <div className="dir-slider-bar">
                <div
                  className="dir-slider-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(2, s.progress * 100))}%` }}
                />
                <div
                  className="dir-slider-knob"
                  style={{ left: `${Math.min(100, Math.max(0, s.progress * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shot 08: Animated Boolean Toggle Pill (CLOSE TOP RIM) */}
      {state.togglePill && (
        <div
          className="dir-toggle-card"
          style={{ opacity: fade, transform: `translateY(${slideY}px)` }}
        >
          <span className="dir-toggle-name">{state.togglePill.label}</span>
          <div className={`dir-toggle-switch ${state.togglePill.on ? 'is-on' : ''}`}>
            <div className="dir-toggle-knob" />
          </div>
          <span className={`dir-toggle-state ${state.togglePill.on ? 'is-on' : ''}`}>
            {state.togglePill.on ? 'ON' : 'OFF'}
          </span>
        </div>
      )}

      {/* Shot 09: Beat-Synced Metallic Alloy Swatch Strip */}
      {state.finishShowcase && (
        <div
          className="dir-alloy-strip"
          style={{ opacity: fade, transform: `translateY(${slideY}px)` }}
        >
          {ALLOY_ORDER.map((key) => {
            const pal = FINISH_PALETTES[key];
            const active = state.finishShowcase === key;
            return (
              <div key={key} className={`dir-alloy-item ${active ? 'is-active' : ''}`}>
                <span className="dir-alloy-orb" style={{ background: pal.swatch }} />
                <span>{pal.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Shot 13: Dramatic Viral Outro Card */}
      {state.isFinaleOutro && (
        <div
          className="dir-outro-card"
          style={{
            opacity: Math.min(1, state.shotTime / 0.45),
            transform: `translateY(${(1 - enterEase) * 24}px)`,
          }}
        >
          <div className="dir-outro-eyebrow">{state.eyebrow}</div>
          <h1 className="dir-outro-title">{state.headline}</h1>
          <div className="dir-outro-sub">{state.subline}</div>
          <div className="dir-outro-pills">
            <span>32 LIVE PARAMETERS</span>
            <span>6 DRAW CALLS</span>
            <span>100% PROCEDURAL CODE</span>
          </div>
        </div>
      )}

      {/* Subtle Crisp Cut-Flash Overlay */}
      {state.cutFlash > 0.005 && (
        <div
          className="dir-cut-flash"
          style={{ opacity: state.cutFlash }}
        />
      )}
    </div>
  );
}
