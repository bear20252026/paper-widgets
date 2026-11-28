import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import type { AudioEngine } from '../audio/AudioEngine';
import type { Song, Track } from '../audio/songs';

const DEGREE = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const STEP = 3.6;
const LANES: { inst: Track['inst'] | 'drums'; name: string; color: string }[] = [
  { inst: 'bass', name: 'Double Bass', color: '#e8cb96' },
  { inst: 'drums', name: 'Drums', color: '#d8a87e' },
  { inst: 'flute', name: 'Flute', color: '#f0dcc0' },
  { inst: 'guitar', name: 'Guitar', color: '#e0b98f' },
  { inst: 'synth', name: 'Synth', color: '#d9c6a4' },
  { inst: 'voice', name: 'Voice', color: '#f2e2c4' },
];

function degOf(midi: number) {
  return (Math.floor(midi / 12) - 1) * 7 + DEGREE[midi % 12];
}

export function SheetMusic({ engine, song }: { engine: AudioEngine; song: Song }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState(0);
  const panRef = useRef(0);
  panRef.current = pan;
  const [range, setRange] = useState('Bars 1–4');

  useEffect(() => setPan(0), [song.id]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !laneRef.current) return;
    const g = cv.getContext('2d')!;
    let raf = 0;
    let lastRange = '';
    let lastFrame = 0;

    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (now - lastFrame < 32) return;
      lastFrame = now;
      const w = Math.max(120, cv.clientWidth);
      const h = Math.max(120, cv.clientHeight);
      if (cv.width !== w) cv.width = w;
      if (cv.height !== h) cv.height = h;
      const live = engine.live;
      const rowH = h / LANES.length;
      const pxPerBeat = 26;
      const originX = Math.min(180, w * 0.28);
      const pos = live.pos + panRef.current * 8;
      const startBeat = pos - originX / pxPerBeat;
      const endBeat = pos + (w - originX) / pxPerBeat;

      g.clearRect(0, 0, w, h);
      g.fillStyle = '#1d1612';
      g.fillRect(0, 0, w, h);

      // bar lines + chord names in the header row of the score
      const firstBar = Math.max(0, Math.floor(startBeat / 4));
      for (let b = firstBar; b < song.bars; b++) {
        const x = Math.round(originX + (b * 4 - pos) * pxPerBeat) + 0.5;
        if (x < -4 || x > w + 20) continue;
        g.strokeStyle = b % 4 === 0 ? 'rgba(214,186,140,0.22)' : 'rgba(200,176,138,0.09)';
        g.lineWidth = b % 4 === 0 ? 1 : 1;
        g.beginPath();
        g.moveTo(x, 2);
        g.lineTo(x, h - 2);
        g.stroke();
        g.fillStyle = 'rgba(214,180,124,0.8)';
        g.font = '500 9px "IBM Plex Sans", sans-serif';
        const ch = song.chords[b];
        if (ch) g.fillText(ch.name, x + 4, 11);
      }

      const barNow = Math.floor(Math.max(0, live.pos) / 4) + 1;
      const lastBar = Math.min(song.bars, Math.floor(endBeat / 4) + 1);
      const nr = `Bars ${barNow}–${Math.max(barNow, lastBar)}`;
      if (nr !== lastRange) {
        lastRange = nr;
        setRange(nr);
      }

      LANES.forEach((lane, li) => {
        const top = li * rowH;
        const staveTop = top + rowH * 0.34;
        const baseY = staveTop + STEP * 4;
        // stave
        g.strokeStyle = 'rgba(206,184,150,0.12)';
        g.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const y = Math.round(staveTop + i * STEP * 2) + 0.5;
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(w, y);
          g.stroke();
        }
        g.strokeStyle = 'rgba(148,120,86,0.12)';
        g.beginPath();
        g.moveTo(0.5, top + 0.5);
        g.lineTo(w, top + 0.5);
        g.stroke();

        const active = lane.inst === 'drums' ? live.onset * 0.6 : (live.active[lane.inst] ?? 0);
        // lane label lives in the HTML gutter; paint a subtle activity pip here
        g.fillStyle = active > 0.35 ? '#e8cd9a' : 'rgba(148,120,86,0.5)';
        g.fillRect(4, staveTop + STEP * 4 - 1.5, 3, 3);

        if (lane.inst === 'drums') {
          for (const hit of song.drums) {
            if (hit.t > endBeat + 1) break;
            const x = originX + (hit.t - pos) * pxPerBeat;
            if (x < -6 || x > w + 6) continue;
            const laneY =
              hit.k === 'kick' ? baseY + STEP * 2 : hit.k === 'snare' ? baseY : hit.k === 'hat' ? baseY - STEP * 2 : baseY - STEP * 3;
            const sounding = live.pos >= hit.t && live.pos < hit.t + 0.3;
            const past = live.pos > hit.t + 0.3;
            const ink = sounding ? '#f6dfa9' : past ? 'rgba(224,196,150,0.28)' : 'rgba(224,196,150,0.55)';
            if (hit.k === 'hat' || hit.k === 'ride') {
              // light ticks for cymbals
              g.strokeStyle = ink;
              g.lineWidth = 1;
              g.beginPath();
              g.moveTo(x - 1.6, laneY - 1.6);
              g.lineTo(x + 1.6, laneY + 1.6);
              g.moveTo(x + 1.6, laneY - 1.6);
              g.lineTo(x - 1.6, laneY + 1.6);
              g.stroke();
            } else {
              g.fillStyle = ink;
              g.beginPath();
              g.ellipse(x, laneY, 2.6, 2.1, -0.3, 0, Math.PI * 2);
              g.fill();
              g.strokeStyle = ink;
              g.lineWidth = 1;
              g.beginPath();
              g.moveTo(x + 2.5, laneY - 1);
              g.lineTo(x + 2.5, laneY - 9);
              g.stroke();
            }
          }
          return;
        }

        const notes = song.tracks.find((t) => t.inst === lane.inst)?.notes ?? [];
        for (const n of notes) {
          if (n.t > endBeat + 1) break;
          const x = originX + (n.t - pos) * pxPerBeat;
          if (x < -8 || x > w + 12) continue;
          const shift = lane.inst === 'bass' ? 12 : 0;
          const y = Math.round(baseY - (degOf(n.p + shift) - degOf(67)) * STEP);
          if (y < top + 3 || y > top + rowH - 2) continue;
          const sounding = live.pos >= n.t && live.pos <= n.t + n.d;
          const alpha = live.pos > n.t + n.d ? 0.4 : sounding ? 1 : 0.72;
          g.globalAlpha = alpha;
          if (sounding) {
            g.shadowColor = 'rgba(255,225,170,0.6)';
            g.shadowBlur = 5;
          }
          g.fillStyle = sounding ? '#fff3d8' : lane.color;
          g.beginPath();
          g.ellipse(x, y, 3.1, 2.4, -0.34, 0, Math.PI * 2);
          g.fill();
          g.shadowBlur = 0;
          g.strokeStyle = sounding ? '#fff3d8' : lane.color;
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x + 3, y - 1);
          g.lineTo(x + 3, y - 11);
          g.stroke();
          if (n.d <= 0.55) {
            g.beginPath();
            g.moveTo(x + 3, y - 11);
            g.quadraticCurveTo(x + 7, y - 8, x + 4, y - 4);
            g.stroke();
          }
          g.globalAlpha = 1;
        }
      });


      // playhead
      const ph = originX + (live.pos - pos) * pxPerBeat;
      if (ph > 0) {
        const grad = g.createLinearGradient(ph - 10, 0, ph + 10, 0);
        grad.addColorStop(0, 'rgba(232,205,154,0)');
        grad.addColorStop(0.5, 'rgba(244,222,180,0.10)');
        grad.addColorStop(1, 'rgba(232,205,154,0)');
        g.fillStyle = grad;
        g.fillRect(ph - 10, 0, 20, h);
        g.strokeStyle = 'rgba(244,222,180,0.75)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(ph, 0);
        g.lineTo(ph, h);
        g.stroke();
        g.fillStyle = '#f4debc';
        g.beginPath();
        g.moveTo(ph - 3, 0);
        g.lineTo(ph + 3, 0);
        g.lineTo(ph, 5);
        g.closePath();
        g.fill();
      }
      // left fade (history dissolves)
      const lfade = g.createLinearGradient(0, 0, 48, 0);
      lfade.addColorStop(0, '#1d1612');
      lfade.addColorStop(1, 'rgba(29,22,18,0)');
      g.fillStyle = lfade;
      g.fillRect(0, 0, 48, h);
      // right fade
      const fade = g.createLinearGradient(w - 40, 0, w, 0);
      fade.addColorStop(0, 'rgba(29,22,18,0)');
      fade.addColorStop(1, '#1d1612');
      g.fillStyle = fade;
      g.fillRect(w - 40, 0, 40, h);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [engine, song]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2.5 border-y border-[#3a2c22] bg-[#1f1813] px-3 py-2 sm:px-4">
        <ScrollText size={13} className="text-[#cba76b]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d6c3a4]">The Score</span>
        <span className="h-3 w-px bg-[#4a392b]" />
        <span className="text-[10.5px] text-[#cba76b]">{range}</span>
        <span className="ml-2 hidden items-center gap-2 sm:flex">
          {LANES.slice(0, 3).map((l) => (
            <span key={l.inst} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
              <span className="text-[9px] uppercase tracking-wider text-[#8f7b60]">{l.name}</span>
            </span>
          ))}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button className="icon-btn !h-6 !w-6" onClick={() => setPan((p) => Math.max(0, p - 2))} title="previous bars">
            <ChevronLeft size={12} />
          </button>
          <button className="icon-btn !h-6 !w-6" onClick={() => setPan((p) => Math.min(Math.ceil(song.bars / 2), p + 2))} title="next bars">
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
      <div ref={laneRef} className="flex h-[184px] bg-[#1d1612]">
        <div className="w-[96px] shrink-0 border-r border-[#3a2c22]/70 bg-[#1d1612] py-1">
          {LANES.map((l) => (
            <div key={l.inst} className="flex h-[calc(100%/6)] items-center gap-1.5 px-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: l.color }} />
              <span className="truncate text-[9px] leading-tight text-[#b7a184] sm:text-[10px]">{l.name}</span>
            </div>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <canvas ref={ref} className="block h-full w-full" />
          <div className="pointer-events-none absolute bottom-1.5 right-2 flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-[#7d2130]" style={{ animation: 'bulb 1.2s infinite' }} />
            <span className="text-[8px] uppercase tracking-[0.16em] text-[#8f7b60]">live arrangement</span>
          </div>
        </div>
      </div>
    </div>
  );
}
