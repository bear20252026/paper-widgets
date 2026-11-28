export const views = [
  {
    id: 'panorama',
    name: 'The panorama',
    shortName: 'Panorama',
    eyebrow: 'SOMEWHERE BEYOND THE CLOUDS',
    title: 'Aetheria',
    subtitle: 'Let your imagination drift.',
    description: 'A gentle giant. A castle in the clouds.\nA little escape from the everyday.',
    position: [12.5, 0.3, 21.5],
    target: [-1.1, 2.9, 0],
  },
  {
    id: 'castle',
    name: 'The cloud castle',
    shortName: 'The castle',
    eyebrow: '02 / THE CLOUD CASTLE',
    title: 'Built from\ndaydreams.',
    subtitle: 'Every window holds a little wonder.',
    description: 'Follow the blossom-lined balconies,\nwhere a thousand small stories live.',
    position: [-2.2, 4.4, 9.2],
    target: [-0.9, 4.9, 0],
  },
  {
    id: 'wheel',
    name: 'The sky wheel',
    shortName: 'The sky wheel',
    eyebrow: '03 / THE SKY WHEEL',
    title: 'Around\nand a dream.',
    subtitle: 'The best views have no end.',
    description: 'A slow turn above the cherry trees.\nNothing to do but take it all in.',
    position: [7.4, 6.4, 5.4],
    target: [1.6, 5.3, -1],
  },
  {
    id: 'whale',
    name: 'The gentle giant',
    shortName: 'The whale',
    eyebrow: '04 / THE GENTLE GIANT',
    title: 'A softer\nkind of giant.',
    subtitle: 'An entire world, carried with care.',
    description: 'Drift beside our quiet guardian,\none unhurried breath at a time.',
    position: [10.6, 0.9, 6.4],
    target: [4.6, 0.5, 1.2],
  },
] as const;

export type ViewIndex = 0 | 1 | 2 | 3;
export type RenderQuality = 'balanced' | 'high' | 'gentle';

export function getInitialView(): ViewIndex {
  const index = views.findIndex((view) => view.id === window.location.hash.slice(1));
  return (index < 0 ? 0 : index) as ViewIndex;
}
