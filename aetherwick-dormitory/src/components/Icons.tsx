import type { CSSProperties } from 'react';

export type IconName = 'arrow' | 'back' | 'chevron' | 'close' | 'sun' | 'dawn' | 'moon' | 'expand' | 'collapse' | 'mouse' | 'scroll' | 'camera' | 'keyboard' | 'compass' | 'feather' | 'book' | 'trunk' | 'check' | 'sparkle' | 'volume' | 'mute' | 'plus' | 'minus' | 'download' | 'eye' | 'hand' | 'reset' | 'leaf' | 'owl' | 'headphones';

const paths: Record<IconName, React.ReactNode> = {
  arrow: <><path d="M4 12h15M13 6l6 6-6 6" /></>,
  back: <><path d="M20 12H5m6-6-6 6 6 6" /></>,
  chevron: <path d="m7 9 5 5 5-5" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  sun: <><circle cx="12" cy="12" r="4.1" /><path d="M12 1.5v3m0 15v3M1.5 12h3m15 0h3M4.6 4.6l2.1 2.1m10.6 10.6 2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" /></>,
  dawn: <><path d="M2 17h20M4 20h16M6 17a6 6 0 0 1 12 0M12 3v4M3.8 7.8l2.6 2.6m11.2 0 2.6-2.6M1 13l3 1m16 0 3-1" /></>,
  moon: <><path d="M19.8 15.2A8.5 8.5 0 0 1 9 4.2a8.4 8.4 0 1 0 10.8 11Z" /><path d="m17 2 .8 2.3 2.2.7-2.2.8L17 8l-.8-2.2-2.2-.8 2.2-.7Z" /></>,
  expand: <path d="M8.5 4H4v4.5M15.5 4H20v4.5M4 15.5V20h4.5m7 0H20v-4.5" />,
  collapse: <path d="M4 8.5h4.5V4m7 0v4.5H20M8.5 20v-4.5H4m16 0h-4.5V20" />,
  mouse: <><rect x="6.3" y="2" width="11.4" height="20" rx="5.7" /><path d="M12 5.5V10" /></>,
  scroll: <><rect x="6.5" y="2" width="11" height="20" rx="5.5" /><path d="M12 6v5m-2-3 2-2 2 2" /></>,
  camera: <><path d="M8 6.8 9.4 4h5.2L16 6.8h4a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V8.3A1.5 1.5 0 0 1 4 6.8Z" /><circle cx="12" cy="12.9" r="3.8" /></>,
  keyboard: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M5.5 9h1m3 0h1m3 0h1m3 0h1m-13 3h1m3 0h1m3 0h1m3 0h1M8 15.5h8" /></>,
  compass: <><circle cx="12" cy="12" r="8.3" /><path d="m15.8 7.4-2 6.4-5.6 2.8 2.2-6.4Z" /><path d="m10.4 10.2 3.4 3.6M12 1v2.5m0 17V23M1 12h2.5m17 0H23" /></>,
  feather: <><path d="M3.5 21c3-6 9-12 15-17M6 16.4c-1.3-4.5 2.2-9.7 7.1-12.1C16 2.8 19.1 2.3 21 2c-.5 4.4-2.6 9.3-5.4 12.2-2.8 2.8-5.5 3.2-9.6 2.2Z" /><path d="m10.6 11-.2-3.3m2.8.7 3.7-.6m-6.5 4.3 3.4-.3" /></>,
  book: <><path d="M12 6.2C9.3 4.3 6 4 2.5 4.4v14c3.5-.5 6.8 0 9.5 2 2.7-2 6-2.5 9.5-2v-14c-3.5-.4-6.8-.1-9.5 1.8Z" /><path d="M12 6.2v14M5.5 8.2l3.5.7m6-.2 3.5-.7" /></>,
  trunk: <><rect x="2.5" y="8" width="19" height="12.5" rx="2" /><path d="M4 8V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5V8M2.5 12.5h19M6.5 8V20m11-12v12" /><rect x="10" y="11" width="4" height="4" rx=".5" /></>,
  check: <path d="m4.5 12 5 5 10-10" />,
  sparkle: <><path d="m10 3 1.7 5.3L17 10l-5.3 1.7L10 17l-1.7-5.3L3 10l5.3-1.7Z" /><path d="m18.5 14 .9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9Z" /></>,
  volume: <><path d="M4 9h4l5-4v14l-5-4H4Z" /><path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
  mute: <><path d="M3 9h4l5-4v14l-5-4H3Z" /><path d="m16 9 5 6m0-6-5 6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M4 15.5v4h16v-4" /></>,
  eye: <><path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  hand: <><path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-3V4a1.5 1.5 0 0 1 3 0v7m0-4.5a1.5 1.5 0 0 1 3 0v5m0-2.5a1.5 1.5 0 0 1 3 0v5.5c0 5-2.3 7.5-6.5 7.5-3 0-4.6-1.4-6-3.4L3.8 13a1.5 1.5 0 0 1 2.5-1.7L8 13.7Z" /></>,
  reset: <><path d="M4 8a8 8 0 1 1-.2 7M4 3.5V8h4.5" /></>,
  leaf: <><path d="M4 17C1 8 9 5 21 3.5c-1 10-7 17-15 14M2.5 21C7 14 13 10 17 7" /></>,
  owl: <><path d="m4 3 4 3c2.2-1 5.8-1 8 0l4-3-1 7c2.5 6.8-1.2 11-7 11S2.5 16.8 5 10Z" /><circle cx="8.4" cy="10.8" r="3" /><circle cx="15.6" cy="10.8" r="3" /><path d="m10.5 14 1.5 2 1.5-2M8 18l2 1m4 0 2-1" /><circle cx="9" cy="11" r=".7" fill="currentColor" /><circle cx="15" cy="11" r=".7" fill="currentColor" /></>,
  headphones: <><path d="M3.5 14v-3a8.5 8.5 0 0 1 17 0v3" /><rect x="3" y="12" width="4.5" height="8" rx="2" /><rect x="16.5" y="12" width="4.5" height="8" rx="2" /></>,
};

export function Icon({ name, size = 20, className = '', style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]}</svg>;
}

export function AcademyCrest({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'academy-crest small' : 'academy-crest'} viewBox="0 0 55 66" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round">
      <path d="m27.5 3 18.8 16v23.5L27.5 59 8.7 42.5V19Z" />
      <path d="m27.5 7 15.5 13v21l-15.5 14L12 41V20Z" opacity=".65" />
      <path d="m15.3 22.3 9 3.3 3.2 3.7 3.2-3.7 9-3.3-3.3 12.6-8.9 13.6-8.9-13.6Z" />
      <path d="m15.3 22.3 10.1 8.1 2.1 6.8 2.1-6.8 10.1-8.1M18 28c.7 5.7 4.2 8.5 7.9 6.8M37 28c-.7 5.7-4.2 8.5-7.9 6.8m-5.5 3.4 3.9 5 3.9-5" />
      <path d="m3 17 2.5 2.2v25L22 59m30-42-2.5 2.2v25L33 59M27.5 0v5m0 53v7" opacity=".75" />
      <path d="m27.5 12 1.2 3.7 3.6 1.3-3.6 1.1-1.2 3.8-1.2-3.8-3.6-1.1 3.6-1.3Z" fill="currentColor" strokeWidth=".3" />
    </g>
    <g fill="currentColor"><circle cx="21.5" cy="30" r="1.5" /><circle cx="33.5" cy="30" r="1.5" /><path d="m27.5 59 2.3 3.2-2.3 3.2-2.3-3.2Z" /></g>
  </svg>;
}

export function Ornament({ className = '' }: { className?: string }) {
  return <svg className={className} width="49" height="12" viewBox="0 0 49 12" fill="none" aria-hidden="true"><path d="M0 6h28m5-4 4 4-4 4-4-4Z" stroke="currentColor" strokeWidth=".8" /><path d="m39 6 3-3 3 3-3 3Z" fill="currentColor" /><circle cx="48" cy="6" r="1" fill="currentColor" /></svg>;
}