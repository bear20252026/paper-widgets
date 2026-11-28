import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Expand, Minimize, MousePointer2, Volume2, VolumeX } from 'lucide-react';
import SanctuaryScene from './SanctuaryScene';

function SanctuaryMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 2.5 36.5 20 20 37.5 3.5 20 20 2.5Z" />
      <path d="M12.2 27.3V18a7.8 7.8 0 0 1 15.6 0v9.3M16 27.3v-9.2a4 4 0 0 1 8 0v9.2M10 27.5h20" />
    </svg>
  );
}

function createSoundscape() {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0.2;
  master.connect(context.destination);

  const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const wind = context.createBufferSource();
  wind.buffer = buffer;
  wind.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 360;
  const windVolume = context.createGain();
  windVolume.gain.value = 0.1;
  wind.connect(filter).connect(windVolume).connect(master);
  wind.start();

  [110, 164.81].forEach((frequency) => {
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.type = 'sine';
    tone.frequency.value = frequency;
    volume.gain.value = 0.012;
    tone.connect(volume).connect(master);
    tone.start();
  });
  return context;
}

function App() {
  const [entered, setEntered] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [sceneReady, setSceneReady] = useState<boolean | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      void audioRef.current?.close();
    };
  }, []);

  const toggleSound = async () => {
    try {
      if (!audioRef.current) audioRef.current = createSoundscape();
      if (soundOn) {
        await audioRef.current.suspend();
        setSoundOn(false);
      } else {
        await audioRef.current.resume();
        setSoundOn(true);
      }
    } catch {
      setSoundOn(false);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen can be unavailable in embedded browser previews.
    }
  };

  return (
    <div className={`experience ${entered ? 'experience--entered' : ''} ${sceneReady === false ? 'experience--fallback' : ''}`}>
      <div className="atmosphere" />
      <SanctuaryScene entered={entered} onReady={setSceneReady} />
      <div className="scene-wash" />
      <div className="scene-vignette" />
      <div className="film-grain" />

      <header className="site-header">
        <button className="brand" onClick={() => setEntered(false)} aria-label="Aether, return to the opening view">
          <SanctuaryMark />
          <span className="brand-name">AETHER<span>AN IMMERSIVE WORLD</span></span>
        </button>

        <div className="header-actions">
          <button className="sound-button" onClick={() => void toggleSound()} aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'} aria-pressed={soundOn}>
            {soundOn ? <Volume2 size={16} strokeWidth={1.5} /> : <VolumeX size={16} strokeWidth={1.5} />}
            <span>SOUND {soundOn ? 'ON' : 'OFF'}</span>
          </button>
          {document.fullscreenEnabled && (
            <button className="expand-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
              {fullscreen ? <Minimize size={16} strokeWidth={1.5} /> : <Expand size={16} strokeWidth={1.5} />}
            </button>
          )}
        </div>
      </header>

      <main className="main-content">
        <div className="intro" aria-hidden={entered}>
          <div className="eyebrow"><span /> A WORLD ABOVE THE CLOUDS</div>
          <h1>The Ivory<br /><em>Sanctuary</em><span className="title-period">.</span></h1>
          <p>A quiet place between earth and sky.<br />Come a little closer.</p>
          <button className="enter-button" onClick={() => setEntered(true)} disabled={sceneReady === false} tabIndex={entered ? -1 : 0}>
            <span>{sceneReady === false ? '3D VIEW UNAVAILABLE' : 'ENTER THE SANCTUARY'}</span>
            <ArrowUpRight size={17} strokeWidth={1.5} />
          </button>
        </div>

        <div className="entered-content" aria-hidden={!entered}>
          <span className="entered-kicker">THE IVORY SANCTUARY</span>
          <button className="return-button" onClick={() => setEntered(false)} tabIndex={entered ? 0 : -1}>
            <ArrowLeft size={16} strokeWidth={1.5} />
            RETURN TO THE VISTA
          </button>
        </div>
      </main>

      <footer className="site-footer">
        <div className="drag-hint"><MousePointer2 size={15} strokeWidth={1.4} /><span>{sceneReady === false ? '3D VIEW UNAVAILABLE' : 'DRAG TO LOOK AROUND'}</span></div>
      </footer>
    </div>
  );
}

export default App;