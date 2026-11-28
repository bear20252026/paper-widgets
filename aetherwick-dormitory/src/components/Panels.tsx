import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AcademyCrest, Icon, Ornament } from './Icons';
import { discoveries, type DiscoveryId } from '../sceneData';

export function ModalFrame({ children, onClose, label, variant = 'sheet' }: { children: ReactNode; onClose: () => void; label: string; variant?: 'sheet' | 'dialog' | 'photograph' }) {
  const container = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    container.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const elements = container.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === container.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); requestAnimationFrame(() => { if (previous?.isConnected) previous.focus({ preventScroll: true }); }); };
  }, []);

  return <div className={`modal-backdrop backdrop-${variant}`} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`modal-frame modal-${variant}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={container}>
      <button className="close-button icon-button" onClick={onClose} aria-label={`Close ${label}`}><Icon name="close" size={19} /></button>
      {children}
    </div>
  </div>;
}

export function JournalPanel({ found, onSelect, onExplore }: { found: DiscoveryId[]; onSelect: (id: DiscoveryId) => void; onExplore: () => void }) {
  const [filter, setFilter] = useState<'all' | 'recorded'>('all');
  const entries = discoveries.filter(n => filter === 'all' || found.includes(n.id));
  return <div className="journal-panel paper-panel">
    <div className="panel-crest"><AcademyCrest small /></div>
    <div className="eyebrow dark-ink"><Ornament /> VOLUME I</div>
    <h2 className="panel-heading">Field journal</h2>
    <p className="panel-intro">A collection of small wonders from the halls of Aetherwick.</p>
    <div className="journal-progress"><div><span className="micro-label">THE WEST WING</span><span>{found.length} <i>/</i> 3 entries</span></div><div className="progress-lines">{discoveries.map((d, i) => <i key={d.id} className={i < found.length ? 'complete' : ''} />)}</div></div>
    <div className="journal-tabs" aria-label="Journal entry filter"><button className={filter === 'all' ? 'active' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All entries</button><button className={filter === 'recorded' ? 'active' : ''} aria-pressed={filter === 'recorded'} onClick={() => setFilter('recorded')}>Recorded <span>{found.length}</span></button></div>
    <div className="journal-list">{entries.map(entry => <button key={entry.id} className="journal-entry" onClick={() => onSelect(entry.id)}>
      <span className="entry-illustration"><Icon name={entry.icon} size={29} /></span>
      <span className="entry-text"><span className="entry-type">FIELD NOTE {entry.number}</span><strong>{entry.title}</strong><span className="entry-status">{found.includes(entry.id) ? <><Icon name="check" size={12} /> Recorded in your journal</> : 'Locate in the room'}</span></span>
      <Icon name="arrow" size={16} />
    </button>)}</div>
    {entries.length === 0 && <div className="journal-empty"><Icon name="book" size={34} /><h3>A fresh page</h3><p>Examine a glimmer in the room and add its story to your field journal.</p><button className="ink-link" onClick={onExplore}>Explore the room <Icon name="arrow" size={15} /></button></div>}
    <div className="panel-colophon"><span className="colophon-rule" /><Icon name="feather" size={20} /><span className="colophon-rule" /></div>
    <p className="save-note">Your field notes are saved on this device.</p>
  </div>;
}

export function CompanionPanel({ onCall, onStudy }: { onCall: () => Promise<void>; onStudy: () => void }) {
  const [greetings, setGreetings] = useState(0);
  const [calling, setCalling] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const replies = ['Lumi answers with a soft, two-note hoot.', 'A sleepy hoot. You have his full attention.', 'Lumi gives a little trill of recognition.'];
  async function greet() {
    if (calling) return;
    setCalling(true);
    try { await onCall(); setGreetings(v => v + 1); }
    finally { timer.current = window.setTimeout(() => setCalling(false), 1500); }
  }
  return <div className="companion-panel paper-panel">
    <div className="companion-image"><img src="./images/lumi-portrait.webp" alt="Lumi's white feathers and bright amber eyes in the afternoon sun" /><div className="portrait-caption"><Icon name="feather" size={15} /><span>FAMILIAR STUDY</span></div></div>
    <div className="companion-copy"><div className="eyebrow dark-ink"><Ornament /> YOUR COMPANION</div><h2 className="panel-heading">Lumi</h2><div className="species">The snowy owl</div>
      <p className="companion-description">A faithful letter-carrier with a fondness for warm windowsills. Wherever Elara wanders, Lumi is never far behind.</p>
      <div className="companion-note" aria-live="polite"><Icon name="feather" size={19} /><p>{greetings ? replies[(greetings - 1) % replies.length] : 'He watches you with a curious tilt of his head.'}</p></div>
      <button className="ink-button" disabled={calling} onClick={() => void greet()}><Icon name="volume" size={17} />{calling ? 'Lumi is answering...' : 'Hear Lumi\'s call'}</button>
      <button className="ink-link companion-study" onClick={onStudy}>Examine familiar <Icon name="arrow" size={15} /></button>
    </div>
  </div>;
}

export function ControlsPanel({ motion, onMotion, onReset }: { motion: boolean; onMotion: () => void; onReset: () => void }) {
  const rows = [['Look around', 'Drag'], ['Zoom in or out', 'Scroll / pinch'], ['Explore the room', 'E'], ['Open field journal', 'J'], ['Photo mode', 'P'], ['Toggle sound', 'M'], ['Hide interface', 'H'], ['Return / close', 'Esc']];
  return <div className="controls-panel paper-panel"><div className="eyebrow dark-ink"><Ornament /> SCENE GUIDE</div><h2 className="panel-heading">At your fingertips</h2><p className="panel-intro">A few simple ways to enjoy the room.</p>
    <div className="control-list">{rows.map(([action, key]) => <div key={action}><span>{action}</span><kbd>{key}</kbd></div>)}</div>
    <div className="motion-setting"><span><strong>Ambient movement</strong><small>Gentle parallax and drifting dust</small></span><button className={`switch ${motion ? 'is-on' : ''}`} role="switch" aria-checked={motion} aria-label="Ambient movement" onClick={onMotion}><span /></button></div>
    <button className="ink-link" onClick={onReset}><Icon name="reset" size={15} /> Reset camera view</button>
  </div>;
}