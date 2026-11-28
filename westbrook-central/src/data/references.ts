export interface Reference {
  id: number
  title: string
  place: string
  credit: string
  creditUrl: string
  pageUrl: string
  thumb: string
  full: string
  takeaway: string
  rules: string[]
}

const px = (id: number, w: number, h: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=${h}&w=${w}`

export const REFERENCES: Reference[] = [
  {
    id: 38277924,
    title: 'Modern platform, sunny day',
    place: 'London, UK',
    credit: 'Lajos Kristóf Kántor',
    creditUrl: 'https://www.pexels.com/@lajos-kristof-kantor-2158796893',
    pageUrl: 'https://www.pexels.com/photo/modern-train-station-in-london-uk-38277924/',
    thumb: px(38277924, 560, 300),
    full: px(38277924, 1200, 627),
    takeaway: 'Yellow line + tactile strip spacing, white hanging signs with black type, canopy fascia proportions.',
    rules: ['SGN-01', 'SGN-04', 'SCL-01'],
  },
  {
    id: 17642206,
    title: 'Urban railway station',
    place: 'Lisboa, Portugal',
    credit: 'Nesshi Oliveira',
    creditUrl: 'https://www.pexels.com/@nesshi-oliveira-144653',
    pageUrl: 'https://www.pexels.com/photo/railway-station-in-town-17642206/',
    thumb: px(17642206, 560, 300),
    full: px(17642206, 1200, 627),
    takeaway: 'Island platform with tracks both sides, catenary masts spacing, how ballast sits proud of the formation.',
    rules: ['SCL-02', 'SGN-01'],
  },
  {
    id: 20150833,
    title: 'Station name board',
    place: 'Kyoto, Japan',
    credit: 'Shernon Hague',
    creditUrl: 'https://www.pexels.com/@shernon-hague-739230088',
    pageUrl: 'https://www.pexels.com/photo/signboard-in-tokyo-in-black-and-white-20150833/',
    thumb: px(20150833, 560, 300),
    full: px(20150833, 1200, 627),
    takeaway: 'Wide board, big station name centred, previous / next stations small with arrows at the edges.',
    rules: ['SGN-02'],
  },
  {
    id: 30389540,
    title: 'Digital departure sign',
    place: 'Kyoto Station',
    credit: 'Bruna Santos',
    creditUrl: 'https://www.pexels.com/@brunafisantos',
    pageUrl: 'https://www.pexels.com/photo/digital-train-sign-at-kyoto-station-displaying-schedule-30389540/',
    thumb: px(30389540, 560, 300),
    full: px(30389540, 1200, 627),
    takeaway: 'Black panel, amber monospace rows, header band, bright enough to glow against the ceiling.',
    rules: ['SGN-03'],
  },
  {
    id: 5868296,
    title: 'Electronic platform board',
    place: '—',
    credit: 'Chung-En HU',
    creditUrl: 'https://www.pexels.com/@chung-en-hu-3927838',
    pageUrl: 'https://www.pexels.com/photo/close-up-of-departures-board-on-airport-5868296/',
    thumb: px(5868296, 560, 300),
    full: px(5868296, 1200, 627),
    takeaway: 'Time column left, destination centre, status right. Housing is a thick dark box, not a flat plane.',
    rules: ['SGN-03'],
  },
  {
    id: 7545887,
    title: 'Columns under a roof',
    place: 'Platform canopy',
    credit: 'Gül Işık',
    creditUrl: 'https://www.pexels.com/@ekrulila',
    pageUrl: 'https://www.pexels.com/photo/train-station-with-columns-near-railroad-7545887/',
    thumb: px(7545887, 560, 300),
    full: px(7545887, 1200, 627),
    takeaway: 'Column rhythm, benches between columns, bins beside columns, soffit much lighter than the roof.',
    rules: ['SCL-01', 'MAT-04'],
  },
  {
    id: 15177183,
    title: 'Empty platform & tracks',
    place: 'Jakarta, Indonesia',
    credit: 'Syafirdaus Adam',
    creditUrl: 'https://www.pexels.com/@syafirdaus-adam-366529122',
    pageUrl: 'https://www.pexels.com/photo/tracks-on-railway-station-15177183/',
    thumb: px(15177183, 560, 300),
    full: px(15177183, 1200, 627),
    takeaway: 'Rail head shine vs rusty web, dark grease stain between the rails, coping stone edge lighter than the slab.',
    rules: ['MAT-03', 'MAT-04'],
  },
  {
    id: 1630427,
    title: 'Platforms at golden hour',
    place: 'Dawn',
    credit: 'Nuno Campos',
    creditUrl: 'https://www.pexels.com/@nuno-campos-756632',
    pageUrl: 'https://www.pexels.com/photo/train-station-during-golden-hour-1630427/',
    thumb: px(1630427, 560, 300),
    full: px(1630427, 1200, 627),
    takeaway: 'Low sun, long shadows, fog eating the far end of the tracks, lamps already glowing.',
    rules: ['LGT-01', 'LGT-02'],
  },
]
