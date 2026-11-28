import type { IconName } from './components/Icons';

export type Lighting = 'golden' | 'daybreak' | 'moonlit';
export type DiscoveryId = 'lumi' | 'spellbook' | 'trunk';
export type SceneMode = 'scene' | 'explore' | 'photo';

export interface Discovery {
  id: DiscoveryId;
  number: string;
  title: string;
  shortName: string;
  category: string;
  icon: IconName;
  x: number;
  y: number;
  focus: [number, number, number];
  story: string;
  footnote: string;
}

export const discoveries: Discovery[] = [
  { id: 'lumi', number: '01', title: 'A feathered familiar', shortName: 'Lumi', category: 'Familiar study', icon: 'feather', x: .323, y: .458, focus: [.405, .445, 1.42], story: 'Lumi has delivered letters through three winters, yet still insists on a sunny perch before every flight. Elara\'s glove is his favorite spot in the west wing.', footnote: 'A snowy owl, and a very old friend.' },
  { id: 'spellbook', number: '02', title: 'The open spellbook', shortName: 'Spellbook', category: 'Arcane artifact', icon: 'book', x: .748, y: .584, focus: [.749, .575, 1.65], story: 'Between lessons on levitation, Elara has pressed a tiny rowan leaf. The margins are filled with careful notes, wandering sketches, and one remarkably accurate drawing of Lumi.', footnote: 'Practical Enchantments, volume three.' },
  { id: 'trunk', number: '03', title: 'A well-travelled trunk', shortName: 'Travel trunk', category: 'Dormitory keepsake', icon: 'trunk', x: .057, y: .787, focus: [.12, .72, 1.55], story: 'Scuffed oak, polished brass, and a lock that only opens to a familiar voice. This trunk carried all of Elara\'s belongings on her very first journey to Aetherwick.', footnote: 'A little piece of home, brought along.' },
];

export const portraitPoints: Record<DiscoveryId, { x: number; y: number; focus: [number, number, number] }> = {
  lumi: { x: .286, y: .395, focus: [.37, .38, 1.32] },
  spellbook: { x: .898, y: .578, focus: [.79, .565, 1.52] },
  trunk: { x: .107, y: .803, focus: [.21, .74, 1.46] },
};

export const atmospheres: { id: Lighting; name: string; description: string; icon: IconName }[] = [
  { id: 'golden', name: 'Golden hour', description: 'Warm light, long shadows', icon: 'sun' },
  { id: 'daybreak', name: 'Soft daybreak', description: 'A bright, misty morning', icon: 'dawn' },
  { id: 'moonlit', name: 'Moonlit blue', description: 'The quiet after dusk', icon: 'moon' },
];

export function readSaved<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(`aetherwick:${key}`); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}

export function saveValue(key: string, value: unknown) {
  try { localStorage.setItem(`aetherwick:${key}`, JSON.stringify(value)); } catch { /* The room still works when storage is unavailable. */ }
}