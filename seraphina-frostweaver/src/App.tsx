import { useEffect, useRef, useState } from 'react';
import { createShowcase, type CameraViewPreset, type ShowcaseApi } from './three/showcase';
import type { AnimationMode, CharacterPoseControls } from './three/character';
import Overlay from './components/Overlay';

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const showcaseRef = useRef<ShowcaseApi | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activeView, setActiveView] = useState<CameraViewPreset>('front');
  const [pose, setPose] = useState<CharacterPoseControls>({
    mode: 'idle',
    armLift: 0,
    staffSwing: 0,
    speed: 1.0,
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!stageRef.current) return;
    try {
      const api = createShowcase(stageRef.current);
      showcaseRef.current = api;

      // Support optional URL parameters for instant angle / animation inspection
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') as CameraViewPreset | null;
      if (viewParam && ['front', 'side', 'back', 'left', 'action', 'closeup'].includes(viewParam)) {
        api.setCameraView(viewParam, true);
        setActiveView(viewParam);
      }
      const modeParam = params.get('mode') as AnimationMode | null;
      if (modeParam && ['idle', 'updown', 'swing', 'dance'].includes(modeParam)) {
        api.setPoseControls({ mode: modeParam });
        setPose((p) => ({ ...p, mode: modeParam }));
      }

      return () => {
        api.dispose();
        showcaseRef.current = null;
      };
    } catch (err) {
      console.error('WebGL showcase failed to initialise:', err);
      setFailed(true);
      return undefined;
    }
  }, []);

  const handleVoice = () => showcaseRef.current?.burst();
  const handleTriggerSlash = () => showcaseRef.current?.triggerSwingSlash();

  const handleToggleRotate = () => {
    setAutoRotate((v) => {
      showcaseRef.current?.setAutoRotate(!v);
      return !v;
    });
  };

  const handleSelectView = (view: CameraViewPreset) => {
    setAutoRotate(false);
    showcaseRef.current?.setAutoRotate(false);
    setActiveView(view);
    showcaseRef.current?.setCameraView(view);
  };

  const handleResetView = () => {
    handleSelectView('front');
  };

  const handleChangePose = (partial: Partial<CharacterPoseControls>) => {
    showcaseRef.current?.setPoseControls(partial);
    setPose((prev) => ({ ...prev, ...partial }));
  };

  return (
    <main className="relative h-full w-full overflow-hidden bg-abyss-950 font-body text-slate-200">
      {/* painted sky realm behind the real-time render */}
      <img
        src="/images/sky-realm.jpg"
        alt="Misty lavender mountains and the distant ice palace of the Glacier Spire"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {/* tint + horizon mend so the 3D platform feels grounded in the painting */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#1b2340]/55 via-[#232f55]/20 to-[#070c1f]/90" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#070c1f] to-transparent" />

      {/* real-time WebGL stage */}
      <div
        ref={stageRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D model of Seraphina the Frostweaver"
      />

      {/* cinematic frame treatment */}
      <div className="vignette pointer-events-none absolute inset-0" />
      <div className="top-shade pointer-events-none absolute inset-0" />
      <div className="bottom-shade pointer-events-none absolute inset-0" />
      <div className="grain pointer-events-none absolute inset-0" />

      {/* interface */}
      <Overlay
        onVoice={handleVoice}
        onTriggerSlash={handleTriggerSlash}
        autoRotate={autoRotate}
        onToggleRotate={handleToggleRotate}
        onResetView={handleResetView}
        activeView={activeView}
        onSelectView={handleSelectView}
        pose={pose}
        onChangePose={handleChangePose}
      />

      {/* WebGL fallback */}
      {failed && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-abyss-950/90 p-8 text-center">
          <div>
            <p className="font-display text-2xl font-bold text-cyan-200">The Spire is silent.</p>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              This showcase needs WebGL to conjure Seraphina in real time. Please enable hardware acceleration or try a
              WebGL-capable browser.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
