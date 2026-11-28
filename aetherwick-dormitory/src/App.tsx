import { useEffect, useRef, useState } from 'react';
import { AcademyCrest, Icon, Ornament } from './components/Icons';
import { Scene, type SceneHandle } from './components/Scene';
import { CompanionPanel, ControlsPanel, JournalPanel, ModalFrame } from './components/Panels';
import { atmospheres, discoveries, readSaved, saveValue, type DiscoveryId, type Lighting, type SceneMode } from './sceneData';
import { useAtmosphereAudio } from './useAtmosphereAudio';

type Panel = 'journal' | 'companion' | 'controls' | null;

export default function App() {
  const scene = useRef<SceneHandle>(null);
  const atmosphereControl = useRef<HTMLDivElement>(null);
  const atmosphereButton = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<SceneMode>('scene');
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<DiscoveryId | null>(null);
  const [lighting, setLighting] = useState<Lighting>(() => { const saved = readSaved<Lighting>('lighting', 'golden'); return atmospheres.some(a => a.id === saved) ? saved : 'golden'; });
  const [atmosphereOpen, setAtmosphereOpen] = useState(false);
  const [motion, setMotion] = useState(() => readSaved('motion', !window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  const [found, setFound] = useState<DiscoveryId[]>(() => { const values = readSaved<unknown>('journal', []); return Array.isArray(values) ? discoveries.filter(n => values.includes(n.id)).map(n => n.id) : []; });
  const [hidden, setHidden] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [photo, setPhoto] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(0);
  const flashTimer = useRef(0);
  const audio = useAtmosphereAudio();
  const atmosphere = atmospheres.find(a => a.id === lighting)!;
  const activeNote = discoveries.find(n => n.id === selected);
  const normalUI = !hidden && mode !== 'photo';
  const isModal = Boolean(panel || photo);

  useEffect(() => { saveValue('journal', found); }, [found]);
  useEffect(() => { saveValue('lighting', lighting); }, [lighting]);
  useEffect(() => { saveValue('motion', motion); }, [motion]);
  useEffect(() => {
    const onFull = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFull);
    return () => { document.removeEventListener('fullscreenchange', onFull); window.clearTimeout(toastTimer.current); window.clearTimeout(flashTimer.current); };
  }, []);
  useEffect(() => {
    if (!atmosphereOpen) return;
    const outside = (e: PointerEvent) => { if (!atmosphereControl.current?.contains(e.target as Node)) setAtmosphereOpen(false); };
    document.addEventListener('pointerdown', outside);
    atmosphereControl.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    return () => document.removeEventListener('pointerdown', outside);
  }, [atmosphereOpen]);

  function notify(message: string) {
    setToast(message); window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2900);
  }
  function goTo(next: SceneMode) {
    setMode(next); setSelected(null); setPanel(null); setHidden(false); setPhoto(null); setAtmosphereOpen(false); setToast('');
    if (next !== 'photo') scene.current?.reset();
  }
  function openPanel(next: Panel) { setAtmosphereOpen(false); setToast(''); setPanel(next); }
  function examine(id: DiscoveryId) {
    setPanel(null); setMode('explore'); setSelected(id); setAtmosphereOpen(false); setHidden(false); setToast('');
    scene.current?.focusOn(id); audio.chime();
  }
  function record(id: DiscoveryId) {
    if (found.includes(id)) return;
    setFound(v => [...v, id]); audio.chime();
    notify(found.length === 2 ? 'All three stories are in your field journal.' : 'A new field note, safely recorded.');
  }
  async function toggleSound() {
    try { await audio.setSound(!audio.enabled); } catch { notify('Audio is unavailable in this browser.'); }
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled) await document.documentElement.requestFullscreen();
      else { setHidden(true); notify('Immersive view. Select the eye to return.'); }
    } catch { setHidden(true); notify('Immersive view. Select the eye to return.'); }
  }
  function capture() {
    const image = scene.current?.photograph();
    if (!image) { notify('The scene is still developing. Try again in a moment.'); return; }
    setFlash(true);
    flashTimer.current = window.setTimeout(() => { setFlash(false); setPhoto(image); }, 140);
  }
  function changeAtmosphere(value: Lighting) {
    setLighting(value); setAtmosphereOpen(false); audio.chime(); atmosphereButton.current?.focus({ preventScroll: true });
  }

  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isModal || (e.target as Element)?.closest('input,textarea,select,[contenteditable="true"]')) return;
    const key = e.key.toLowerCase();
    if (key === 'escape') {
      if (atmosphereOpen) { setAtmosphereOpen(false); atmosphereButton.current?.focus(); }
      else if (hidden) setHidden(false);
      else if (selected) { setSelected(null); scene.current?.reset(); }
      else if (mode !== 'scene') goTo('scene');
      return;
    }
    if (atmosphereOpen) return;
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', '+', '-', '='].includes(key)) {
      e.preventDefault();
      if (key === 'arrowleft') scene.current?.nudge(-.025, 0);
      if (key === 'arrowright') scene.current?.nudge(.025, 0);
      if (key === 'arrowup') scene.current?.nudge(0, -.025);
      if (key === 'arrowdown') scene.current?.nudge(0, .025);
      if (key === '+' || key === '=') scene.current?.zoomBy(.1);
      if (key === '-') scene.current?.zoomBy(-.1);
      return;
    }
    if (e.repeat) return;
    if (key === 'h') { setHidden(v => !v); return; }
    if (hidden) return;
    if (key === 'e') goTo(mode === 'explore' ? 'scene' : 'explore');
    if (key === 'j') openPanel('journal');
    if (key === 'p') goTo(mode === 'photo' ? 'scene' : 'photo');
    if (key === 'm') void toggleSound();
    if (key === 'f') void toggleFullscreen();
    if (key === 'r') scene.current?.reset();
    if (key === '?') openPanel('controls');
  };
  useEffect(() => { const listener = (e: KeyboardEvent) => keyHandler.current(e); window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener); }, []);

  return <main className={`academy-world mode-${mode} ${motion ? '' : 'reduce-motion'} ${hidden ? 'ui-hidden' : ''}`}>
    <div className="world-canvas" inert={isModal} aria-hidden={isModal || undefined}>
      <Scene ref={scene} lighting={lighting} motion={motion} found={found} showDiscoveries={mode === 'explore' && !selected && !isModal && !hidden} onDiscover={examine} onZoom={setZoom} />
    </div>
    <div className={`scene-scrim ${normalUI ? '' : 'is-clear'} ${selected ? 'reading-scrim' : ''}`} aria-hidden="true" />

    {normalUI && <div className="interface" inert={isModal} aria-hidden={isModal || undefined}>
      <header className="world-header">
        <button className="brand" onClick={() => goTo('scene')} aria-label="Aetherwick Academy, return to scene"><AcademyCrest /><span className="brand-wordmark"><span>Aetherwick</span><small>ACADEMY OF MAGIC</small></span></button>
        <nav className="world-nav" aria-label="Academy navigation">
          <button className={!panel || panel === 'controls' ? 'active' : ''} onClick={() => goTo('scene')} aria-current={!panel ? 'page' : undefined}>Scene</button>
          <button className={panel === 'journal' ? 'active' : ''} onClick={() => openPanel('journal')}>Field journal</button>
          <button className={panel === 'companion' ? 'active' : ''} onClick={() => openPanel('companion')}>Companion</button>
        </nav>
        <div className="header-tools"><button className={`sound-control ${audio.enabled ? 'is-playing' : ''}`} onClick={() => void toggleSound()} aria-label={audio.enabled ? 'Mute ambient sound' : 'Enable ambient sound'} aria-pressed={audio.enabled} title="Toggle ambient sound (M)"><span className="sound-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span><span>Sound {audio.enabled ? 'on' : 'off'}</span></button><span className="tool-divider" /><button className="icon-button expand-control" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title="Fullscreen (F)"><Icon name={fullscreen ? 'collapse' : 'expand'} size={19} /></button></div>
      </header>

      {mode === 'scene' && <section className="scene-hud" aria-label="The Dormitory introduction">
        <div className="scene-introduction">
          <div className="eyebrow chapter-line"><Ornament /><span>CHAPTER I</span><i /><span>THE WEST WING</span></div>
          <h1>The Dormitory</h1>
          <p>{lighting === 'golden' ? 'Old oak, golden light, and a familiar friend.' : lighting === 'daybreak' ? 'First light, quiet pages, and a familiar friend.' : 'Soft moonlight, sleepy feathers, and a familiar friend.'}</p>
          <button className="parchment-button explore-button" onClick={() => { goTo('explore'); audio.chime(); }}><Icon name="compass" size={19} /><span>Explore the room</span><Icon name="arrow" size={17} /></button>
        </div>
        <div className="atmosphere-control" ref={atmosphereControl}>
          {atmosphereOpen && <div className="atmosphere-menu" role="menu" aria-label="Choose an atmosphere" onKeyDown={e => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault(); e.stopPropagation();
            const options = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
            const next = (options.indexOf(document.activeElement as HTMLButtonElement) + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length; options[next].focus();
          }}><div className="menu-heading">CHOOSE AN ATMOSPHERE</div>{atmospheres.map(a => <button role="menuitemradio" aria-checked={lighting === a.id} className={lighting === a.id ? 'selected' : ''} key={a.id} onClick={() => changeAtmosphere(a.id)}><Icon name={a.icon} size={23} /><span><strong>{a.name}</strong><small>{a.description}</small></span>{lighting === a.id && <Icon name="check" size={14} />}</button>)}</div>}
          <button className="atmosphere-trigger" ref={atmosphereButton} onClick={() => setAtmosphereOpen(v => !v)} aria-expanded={atmosphereOpen} aria-haspopup="menu" aria-label={`Atmosphere: ${atmosphere.name}. Change atmosphere`}>
            <span className="atmosphere-symbol"><Icon name={atmosphere.icon} size={28} /></span><span className="atmosphere-name"><small>ATMOSPHERE</small><strong>{atmosphere.name}</strong></span><Icon name="chevron" size={15} className={atmosphereOpen ? 'chevron-open' : ''} />
          </button>
        </div>
      </section>}

      {mode === 'explore' && <section className={`exploration-hud ${activeNote ? 'has-note' : ''}`} aria-label="Room exploration" key={selected ?? 'exploration'}>
        <button className="return-link" onClick={() => { if (selected) { setSelected(null); scene.current?.reset(); } else goTo('scene'); }}><Icon name="back" size={14} />{selected ? 'All discoveries' : 'Back to scene'}</button>
        {activeNote ? <><div className="eyebrow"><Ornament /><span>FIELD NOTE {activeNote.number}</span><i /><span>{activeNote.category}</span></div>
          <h2>{activeNote.title}</h2><p className="discovery-story">{activeNote.story}</p>
          <div className="note-actions">{found.includes(activeNote.id) ? <button className="recorded-link" onClick={() => openPanel('journal')}><Icon name="check" size={15} /> Recorded in journal</button> : <button className="parchment-button" onClick={() => record(activeNote.id)}><Icon name="book" size={17} />Add to field journal</button>}<button className="next-note" onClick={() => examine(discoveries[(discoveries.indexOf(activeNote) + 1) % discoveries.length].id)}>Next discovery <Icon name="arrow" size={15} /></button></div>
        </> : <><div className="eyebrow"><Ornament /><span>ROOM EXPLORATION</span><i /><span>{found.length} / 3 RECORDED</span></div><h2>A closer look</h2><p>Follow a glimmer to uncover a little of the room's story.</p><div className="discovery-links">{discoveries.map(note => <button onClick={() => examine(note.id)} key={note.id}><Icon name={note.icon} size={16} />{note.shortName}{found.includes(note.id) && <Icon name="check" size={12} />}</button>)}</div></>}
      </section>}

      <footer className="world-footer"><div className="movement-hints"><span className="desktop-hint"><Icon name="mouse" size={15} />Drag to look around</span><i className="hint-dot" /><span className="desktop-hint zoom-hint"><Icon name="scroll" size={15} />Scroll to zoom</span><span className="touch-hint"><Icon name="hand" size={15} />Drag to look around</span></div>
        <div className="footer-actions"><button onClick={() => goTo('photo')} title="Photo mode (P)"><Icon name="camera" size={17} /><span>Photo mode</span><kbd>P</kbd></button><span className="tool-divider" /><button className="controls-trigger" onClick={() => openPanel('controls')} title="Scene controls (?)"><Icon name="keyboard" size={18} /><span>Controls</span></button></div>
      </footer>
    </div>}

    {mode === 'photo' && !hidden && <div className="photo-mode" inert={isModal} aria-hidden={isModal || undefined}>
      <div className="viewfinder" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="photo-heading"><Icon name="camera" size={17} /><span>PHOTO MODE</span></div>
      <div className="photo-toolbar"><button className="exit-photo" onClick={() => goTo('scene')}><Icon name="back" size={16} /><span>Exit</span></button><i className="tool-divider" /><div className="zoom-tools"><button className="icon-button" onClick={() => scene.current?.zoomBy(-.15)} aria-label="Zoom out"><Icon name="minus" size={16} /></button><span>{zoom.toFixed(1)}x</span><button className="icon-button" onClick={() => scene.current?.zoomBy(.15)} aria-label="Zoom in"><Icon name="plus" size={16} /></button></div><button className="parchment-button" onClick={capture}><Icon name="camera" size={17} />Capture</button></div>
    </div>}
    {hidden && <button className="restore-interface" onClick={() => setHidden(false)} title="Show interface (H)" aria-label="Show interface"><Icon name="eye" size={19} /></button>}
    {toast && <div className="world-toast" role="status"><Icon name="sparkle" size={15} />{toast}</div>}
    {flash && <div className="camera-flash" />}

    {panel === 'journal' && <ModalFrame label="Field journal" onClose={() => setPanel(null)}><JournalPanel found={found} onSelect={examine} onExplore={() => goTo('explore')} /></ModalFrame>}
    {panel === 'companion' && <ModalFrame label="Companion" onClose={() => setPanel(null)}><CompanionPanel onCall={async () => { try { await audio.owlCall(); } catch { notify('Audio is unavailable in this browser.'); } }} onStudy={() => examine('lumi')} /></ModalFrame>}
    {panel === 'controls' && <ModalFrame label="Scene controls" variant="dialog" onClose={() => setPanel(null)}><ControlsPanel motion={motion} onMotion={() => setMotion(v => !v)} onReset={() => { scene.current?.reset(); setPanel(null); notify('Camera returned to its original view.'); }} /></ModalFrame>}
    {photo && <ModalFrame label="Photograph preview" variant="photograph" onClose={() => setPhoto(null)}><div className="photo-preview"><div className="eyebrow dark-ink"><Ornament /> A MOMENT TO KEEP</div><h2 className="panel-heading">Your photograph</h2><div className="photo-print"><img src={photo} alt="Your photograph of the Aetherwick dormitory" /><div><span>The Dormitory</span><small>AETHERWICK ACADEMY</small></div></div><div className="photo-save-actions"><button className="ink-link" onClick={() => setPhoto(null)}><Icon name="back" size={15} />Retake</button><a className="ink-button" href={photo} download={`Aetherwick-Dormitory-${lighting}.jpg`} onClick={() => notify('Your photograph is ready to save.')}><Icon name="download" size={16} />Save photograph</a></div></div></ModalFrame>}
  </main>;
}