import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Grid2X2,
  Image,
  Layers3,
  Maximize2,
  MousePointer2,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  SwatchBook,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import Viewer, { type CameraView, type ViewerHandle } from './Viewer';
import { activeDeviceIsMobile, type RenderMetrics } from './Viewer';
import type { CharacterQuality, RenderTier } from './character';

const palette = [
  { name: 'Forest wool', type: 'Tailored jacket', color: '#3e5341', detail: 'Rough spun cloth, a fine normal and a soft grazing sheen.' },
  { name: 'Golden hair', type: 'Sculpted locks', color: '#d9b664', detail: 'Warm, soft anisotropic glints follow each lock.' },
  { name: 'Sunlit gold', type: 'Long woven scarf', color: '#d0a538', detail: 'Double-sided cloth with a slow, skin-safe breeze.' },
  { name: 'Aged leather', type: 'Little boots', color: '#625044', detail: 'Matte leather, softly clear-coated at the worn edges.' },
];

type SideSection = 'character' | 'materials' | 'topology' | 'reference';
type RenderProfile = 'auto' | 'quality' | 'performance';

export default function App() {
  const viewerRef = useRef<ViewerHandle>(null);
  const [view, setView] = useState<CameraView | 'free'>('front');
  const [quality, setQuality] = useState<CharacterQuality>('LOD0');
  const [wireframe, setWireframe] = useState(false);
  const [turntable, setTurntable] = useState(false);
  const [animated, setAnimated] = useState(true);
  const [bloom, setBloom] = useState(true);
  const [showWorld, setShowWorld] = useState(true);
  const [showFox, setShowFox] = useState(false);
  const [renderProfile, setRenderProfile] = useState<RenderProfile>('auto');
  const [detectedTier, setDetectedTier] = useState<RenderTier>(() => activeDeviceIsMobile() ? 'performance' : 'quality');
  const [showReference, setShowReference] = useState(false);
  const [activeSection, setActiveSection] = useState<SideSection>('character');
  const [selectedMaterial, setSelectedMaterial] = useState(0);
  const [stats, setStats] = useState({ triangles: 0, meshes: 0, bones: 0, materials: 0 });
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [metrics, setMetrics] = useState<RenderMetrics>({ fps: 0, drawCalls: 0, sceneTriangles: 0, devicePixelRatio: 1, targetFps: 60, resolutionScale: 1 });

  useEffect(() => {
    if (renderProfile !== 'auto') return;
    const query = window.matchMedia('(max-width: 760px), (pointer: coarse)');
    const updateTier = () => setDetectedTier(activeDeviceIsMobile() ? 'performance' : 'quality');
    query.addEventListener('change', updateTier);
    window.addEventListener('resize', updateTier);
    updateTier();
    return () => {
      query.removeEventListener('change', updateTier);
      window.removeEventListener('resize', updateTier);
    };
  }, [renderProfile]);

  const tier: RenderTier = renderProfile === 'auto' ? detectedTier : renderProfile;

  const reportError = useCallback((message: string) => {
    setNotice(message);
    setShowReference(true);
    setActiveSection('reference');
  }, []);
  const onOrbit = useCallback(() => setView('free'), []);
  const chooseView = (next: CameraView) => {
    setShowReference(false);
    setActiveSection('character');
    setTurntable(false);
    setView(next);
    viewerRef.current?.setView(next);
  };
  const resetView = () => {
    setShowReference(false);
    setActiveSection('character');
    setTurntable(false);
    setView('front');
    viewerRef.current?.reset();
  };
  const openSection = (section: SideSection) => {
    setActiveSection(section);
    if (section === 'reference') {
      setShowReference(true);
      setTurntable(false);
    } else {
      setShowReference(false);
      setWireframe(section === 'topology');
      if (section === 'materials') {
        document.getElementById('material-palette')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };
  const download = async () => {
    if (exporting) return;
    setExporting(true);
    setNotice('');
    try {
      if (!viewerRef.current) throw new Error('The model is still loading. Please try again.');
      await viewerRef.current.exportModel();
      setNotice(`${quality} GLB is ready. Your download has started.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not export the model. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  const downloadTurnaround = async () => {
    try {
      if (!viewerRef.current) throw new Error('The model is still loading. Please try again.');
      await viewerRef.current.captureTurnaround();
      setNotice('Your front, side and back turnaround is ready.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create the turnaround image.');
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="Aster, a character atelier">
          <div className="brand-mark"><Sparkles size={19} strokeWidth={1.5} /></div>
          <div className="brand-text"><strong>ASTER<span>.</span></strong><small>CHARACTER ATELIER</small></div>
        </div>
        <div className="breadcrumb"><span>CHARACTER LIBRARY</span><ChevronRight size={13} /><strong>THE LITTLE PRINCE</strong></div>
        <div className="topbar-actions">
          <div className="saved-status"><span /> PROCEDURAL STUDY</div>
          <button className="help-button" aria-label="Viewer help" onClick={() => setHelpOpen(true)}><CircleHelp size={19} strokeWidth={1.5} /></button>
          <button className="export-button" onClick={download} disabled={exporting}>
            <ArrowDownToLine size={16} strokeWidth={1.8} /> {exporting ? 'Preparing...' : 'Export GLB'}
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-intro">
            <div className="tiny-label">A LITTLE WORLD <span>01 / 01</span></div>
            <h2>Made of<br /><em>wonder.</em></h2>
            <p>Thoughtful characters for stories worth telling.</p>
          </div>

          <div className="side-nav">
            <div className="side-label">WORKSPACE</div>
            <button className={activeSection === 'character' ? 'active' : ''} onClick={() => openSection('character')}><Box size={17} /> Character <ChevronRight size={14} className="nav-chevron" /></button>
            <button className={activeSection === 'materials' ? 'active' : ''} onClick={() => openSection('materials')}><SwatchBook size={17} /> Materials <ChevronRight size={14} className="nav-chevron" /></button>
            <button className={activeSection === 'topology' ? 'active' : ''} onClick={() => openSection('topology')}><Grid2X2 size={17} /> Wireframe <ChevronRight size={14} className="nav-chevron" /></button>
            <button className={activeSection === 'reference' ? 'active' : ''} onClick={() => openSection('reference')}><Layers3 size={17} /> Art reference <ChevronRight size={14} className="nav-chevron" /></button>
          </div>

          <div className="sidebar-spacer" />
          <button className="reference-link" onClick={() => openSection('reference')}>
            <span className="reference-thumb"><img src="/images/little-prince-reference.jpg" alt="" /></span>
            <span className="reference-copy"><span>THE INSPIRATION</span><strong>Meet the prince</strong><small>View concept art <ArrowUpRight size={12} /></small></span>
          </button>
          <div className="sidebar-footer"><span className="small-star">&#10038;</span> MADE FOR IMAGINATION <span>2025</span></div>
        </aside>

        <main className="main-content">
          <div className="title-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-star">&#10038;</span> CHARACTER STUDY <span className="eyebrow-divider">/</span> 01</div>
              <h1>The Little Prince<span className="title-period">.</span></h1>
              <p>A little wonder, ready for bigger adventures.</p>
            </div>
            <div className="title-aside"><span>AN ORIGINAL CHARACTER STUDY</span><strong>01 <i>/</i> 01</strong></div>
          </div>

          <div className={`viewer-stage ${showReference ? 'is-reference' : ''}`}>
            <div className="stage-topline">
              <div><span className="stage-cross">&#10035;</span> {showReference ? 'CONCEPT REFERENCE' : view === 'free' ? 'FREE VIEW' : `${view.toUpperCase()} VIEW`} <span className="stage-divider">/</span> 01</div>
              <div className="stage-live"><span /> {showReference ? 'ART DIRECTION' : 'LIVE 3D VIEW'}</div>
            </div>
            <div className="canvas-wrap">
              <Viewer
                ref={viewerRef}
                quality={quality}
                tier={tier}
                wireframe={wireframe}
                turntable={turntable}
                animated={animated}
                bloom={bloom}
                showWorld={showWorld}
                showFox={showFox}
                onStats={setStats}
                onPerformance={setMetrics}
                onOrbit={onOrbit}
                onError={reportError}
              />
              {showReference && <div className="reference-stage"><img src="/images/little-prince-reference.jpg" alt="Concept art reference for the Little Prince character" /><span>CONCEPT ART <i>/</i> NOT THE 3D MODEL</span></div>}
            </div>

            <div className="stage-tools" aria-label="Viewer tools">
              <button title="Zoom in" aria-label="Zoom in" onClick={() => { setShowReference(false); viewerRef.current?.zoom(1); }}><ZoomIn size={17} /></button>
              <button title="Zoom out" aria-label="Zoom out" onClick={() => { setShowReference(false); viewerRef.current?.zoom(-1); }}><ZoomOut size={17} /></button>
              <span />
              <button title="Reset view" aria-label="Reset view" onClick={resetView}><Maximize2 size={16} /></button>
              <button title="Save transparent PNG" aria-label="Save transparent PNG" onClick={() => { setShowReference(false); viewerRef.current?.capture(); }}><Camera size={17} /></button>
              <button title="Toggle art reference" aria-label="Toggle art reference" onClick={() => { setShowReference(!showReference); setActiveSection(showReference ? 'character' : 'reference'); setTurntable(false); }}><Image size={17} /></button>
            </div>

            <div className="stage-bottomline">
              <div className="stage-coordinate"><span>+</span> CHARACTER / 001</div>
              <div className="stage-caption">A LITTLE WORLD OF ITS OWN <span>&#10038;</span></div>
            </div>
            <div className="view-dock" aria-label="Camera views">
              {(['front', 'side', 'back'] as CameraView[]).map((item) => (
                <button key={item} className={!showReference && view === item ? 'selected' : ''} onClick={() => chooseView(item)}>{item}</button>
              ))}
              <span className="dock-divider" />
              <button className={`dock-icon ${turntable ? 'selected' : ''}`} title="Toggle turntable" aria-label="Toggle turntable" aria-pressed={turntable} onClick={() => { setShowReference(false); setTurntable(!turntable); setView('free'); }}><Orbit size={16} /></button>
            </div>
          </div>

          <div className="viewer-bottom">
            <div><MousePointer2 size={14} /> <span>Drag to rotate</span><i /> <span>Scroll to zoom</span></div>
            <button onClick={resetView}><RotateCcw size={13} /> Reset view</button>
          </div>
        </main>

        <aside className="inspector">
          <div className="inspector-top"><span>THE DETAILS</span><span>01 <i>/</i> 01</span></div>
          <div className="inspector-intro">
            <div className="asset-label"><span /> CHARACTER ASSET</div>
            <h2>A little prince,<br /><em>a lot of heart.</em></h2>
            <p>From his windswept hair to his well-loved boots, every detail has a story.</p>
          </div>

          <div className="inspector-section" id="material-palette">
            <div className="section-title"><span>MATERIAL PALETTE</span><span>0{selectedMaterial + 1} / 04</span></div>
            <div className="swatches">
              {palette.map((item, index) => (
                <button key={item.name} className={selectedMaterial === index ? 'selected' : ''} onClick={() => { setSelectedMaterial(index); setActiveSection('materials'); }} aria-label={`Inspect ${item.name}`} title={item.name}>
                  <span style={{ backgroundColor: item.color }} />
                </button>
              ))}
            </div>
            <div className="material-name"><strong>{palette[selectedMaterial].name}</strong><span>{palette[selectedMaterial].type}</span></div>
            <p className="material-description">{palette[selectedMaterial].detail}</p>
          </div>

          <div className="inspector-section specs-section">
            <div className="section-title"><span>MODEL DETAILS</span><span>+</span></div>
            <div className="spec-row"><span>Geometry</span><strong>{stats.triangles ? `${stats.triangles.toLocaleString()} tris` : 'Preparing...'}</strong></div>
            <div className="spec-row"><span>Separate meshes</span><strong>{stats.meshes || '-'}</strong></div>
            <div className="spec-row"><span>Skin rig</span><strong>{stats.bones ? `${stats.bones} bones` : '-'}</strong></div>
            <div className="spec-row"><span>Materials</span><strong>{stats.materials || '-'}</strong></div>
            <div className="spec-row quality-row"><label htmlFor="quality">Level of detail</label><div className="select-wrap"><select id="quality" value={quality} onChange={(event) => setQuality(event.target.value as CharacterQuality)}><option value="LOD0">LOD 0</option><option value="LOD1">LOD 1</option></select><ChevronDown size={12} /></div></div>
          </div>

          <div className="inspector-section preview-section">
            <div className="section-title"><span>PREVIEW OPTIONS</span></div>
            <button className="option-row" onClick={() => { setWireframe(!wireframe); setShowReference(false); setActiveSection(!wireframe ? 'topology' : 'character'); }}><span><Grid2X2 size={15} /> Wireframe</span><span className={`toggle ${wireframe ? 'on' : ''}`} /></button>
            <button className="option-row" onClick={() => { setAnimated(!animated); setShowReference(false); }}><span>{animated ? <Pause size={15} /> : <Play size={15} />} Gentle idle</span><span className={`toggle ${animated ? 'on' : ''}`} /></button>
            <button className="turnaround-button" onClick={downloadTurnaround}><span><Camera size={15} /> Save 3-view turnaround</span><ArrowDownToLine size={14} /></button>
          </div>
          <div className="inspector-section render-section">
            <div className="section-title"><span>SCENE &amp; RENDERING</span><span>{metrics.targetFps} FPS</span></div>
            <label className="render-profile-row" htmlFor="render-profile">
              <span>Hardware preset</span>
              <select id="render-profile" value={renderProfile} onChange={(event) => setRenderProfile(event.target.value as RenderProfile)}>
                <option value="auto">Auto · device aware</option>
                <option value="quality">Quality · desktop</option>
                <option value="performance">Performance · mobile</option>
              </select>
            </label>
            <button className="option-row" onClick={() => setBloom(!bloom)}><span><Sparkles size={15} /> Rose &amp; star bloom</span><span className={`toggle ${bloom ? 'on' : ''}`} /></button>
            <button className="option-row" onClick={() => setShowWorld(!showWorld)}><span><Orbit size={15} /> B-612 &amp; glass rose</span><span className={`toggle ${showWorld ? 'on' : ''}`} /></button>
            <button className="option-row" onClick={() => setShowFox(!showFox)}><span><Box size={15} /> The little fox</span><span className={`toggle ${showFox ? 'on' : ''}`} /></button>
            <div className="render-readout"><span>{metrics.fps || '--'} / {metrics.targetFps} fps</span><span>{metrics.drawCalls || '--'} draws</span><span>{metrics.sceneTriangles ? `${Math.round(metrics.sceneTriangles / 1000)}k tris` : '-- tris'}</span><span>DPR {metrics.devicePixelRatio.toFixed(1)}</span></div>
          </div>
          <div className="inspector-note"><Sparkles size={16} /><span>Made to explore.<br /><strong>Created with a little wonder.</strong></span></div>
        </aside>
      </div>

      {notice && <div className="toast" role="status"><Check size={15} /> {notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
      {helpOpen && <div className="modal-backdrop" onClick={() => setHelpOpen(false)}><div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close help" onClick={() => setHelpOpen(false)}><X size={19} /></button><span className="eyebrow">ASTER REAL-TIME STUDIO / THREE.JS R186</span><h2 id="help-title">A small world,<br /><em>in real time.</em></h2><p>Drag the character, switch between orthographic turnarounds and inspect the PBR surfaces. The yellow scarf has a GLSL wind offset applied after bone skinning; skin uses a restrained wrapped-light SSS approximation, and golden strands use MeshPhysicalMaterial anisotropy.</p><p>The scene uses a local 1k HDR star panorama and PMREM lighting, a warm shadow-casting directional sun, a cool fill and hemisphere ambient. Post uses RenderPass, a half-resolution UnrealBloomPass, SMAA on quality or FXAA on mobile, then OutputPass.</p><p>Auto quality caps mobile at 30 fps, DPR 1.35 and a 0.72 render scale; desktop targets 60 fps with DPR capped at 2. Bloom and one 512 / 1024 directional shadow map are bounded. WebGL is a real-time preview pipeline, not an equivalent to Unity HDRP, a complete offline skin shader, or production-baked assets.</p><div className="help-links"><a href="https://threejs.org/docs/pages/PMREMGenerator.html" target="_blank" rel="noreferrer">PMREMGenerator <ArrowUpRight size={13} /></a><a href="https://threejs.org/docs/pages/EffectComposer.html" target="_blank" rel="noreferrer">EffectComposer <ArrowUpRight size={13} /></a><a href="https://threejs.org/docs/pages/MeshPhysicalMaterial.html" target="_blank" rel="noreferrer">MeshPhysicalMaterial <ArrowUpRight size={13} /></a></div><button className="modal-action" onClick={() => setHelpOpen(false)}>Back to B-612 <ChevronRight size={16} /></button></div></div>}
    </div>
  );
}