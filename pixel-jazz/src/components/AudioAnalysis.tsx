import { Activity, AudioLines } from 'lucide-react';
import type { Song } from '../audio/songs';
import type { UiLive } from './Ui';

const lanes = [
  { label: 'BASS', subtitle: 'deer · low end', key: 'low' as const, color: '#e0ae70' },
  { label: 'BODY', subtitle: 'guitar · midrange', key: 'mid' as const, color: '#d6a788' },
  { label: 'AIR', subtitle: 'flute · high end', key: 'high' as const, color: '#d7cbab' },
  { label: 'VOICE', subtitle: 'owl · vocal range', key: 'vocal' as const, color: '#edcb87' },
];

export function AudioAnalysis({ live, song }: { live: UiLive; song: Song }) {
  return (
    <section className="border-y border-[#3a2c22] bg-[#1d1612]">
      <div className="flex items-center gap-2 border-b border-[#3a2c22] px-3 py-2 sm:px-4">
        <AudioLines size={13} className="text-[#cba76b]" />
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d6c3a4]">Live audio reaction</h2>
        <span className="ml-auto font-pixel text-[8px] text-[#a38c6f]">{live.detectedBpm ? `${live.detectedBpm} BPM DETECTED` : 'LISTENING TO YOUR RECORDING'}</span>
      </div>
      <div className="grid h-[152px] grid-cols-2 gap-px bg-[#3a2c22] sm:grid-cols-4">
        {lanes.map((lane) => {
          const value = Math.min(1, live[lane.key] * 2.8);
          return (
            <div key={lane.label} className="flex flex-col justify-between bg-[#1d1612] px-3 py-2.5">
              <div>
                <span className="font-pixel text-[9px] tracking-wider text-[#dcc7a6]">{lane.label}</span>
                <p className="text-[9px] text-[#95806a]">{lane.subtitle}</p>
              </div>
              <div className="flex h-10 items-end gap-[3px]" aria-hidden="true">
                {Array.from({ length: 21 }, (_, i) => {
                  const wave = 0.38 + 0.62 * Math.abs(Math.sin(i * 1.82 + live.time * (1.8 + i * 0.04)));
                  const height = Math.max(9, value * wave * 100);
                  return (
                    <span
                      key={i}
                      className="flex-1 rounded-t-[1px] transition-[height] duration-100"
                      style={{ height: `${height}%`, background: lane.color, opacity: live.playing ? 0.45 + value * 0.55 : 0.25 }}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[9px] text-[#a4917a]">
                <Activity size={11} />
                <span>{Math.round(value * 100)}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="px-3 py-1.5 text-[9px] leading-relaxed text-[#8f7b60] sm:px-4">
        {song.title} is playing from this device. The band follows energy and detected onsets; no stems or sheet music are extracted from the file.
      </p>
    </section>
  );
}