export interface Release {
  idx: number;
  cat: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  motif: string;
  /** bg = sleeve colour, ink = type, a/b/c = print accents */
  pal: { bg: string; ink: string; a: string; b: string; c: string };
  page: { bg: string; fg: string; accent: string };
  blurb: string;
  where: string;
  by: string;
  tracks: [string, string][];
}

type Raw = Omit<Release, 'idx' | 'cat' | 'year'>;

const RAW: Raw[] = [
  {
    title: 'Low Tide Radio',
    artist: 'Marisol Vane',
    genre: 'Balearic',
    motif: 'tide',
    pal: { bg: '#efe7d6', ink: '#1f2a36', a: '#e9643b', b: '#2f6f8f', c: '#efe7d6' },
    page: { bg: '#efe7d6', fg: '#1f2a36', accent: '#e9643b' },
    blurb:
      'The first Sable release. A shortwave set and a four-track left running in a boathouse for one August, edited down to six pieces that drift in and out of tune with the harbour.',
    where: 'Boathouse 4, Cala Morell',
    by: 'Marisol Vane',
    tracks: [
      ['Harbour Static', '5:12'],
      ['Low Tide Radio', '6:40'],
      ['Salt on the Dial', '4:58'],
      ['Nine Knots', '7:03'],
      ['Lighthouse, Off', '5:31'],
      ['Shipping Forecast for Nobody', '8:14'],
    ],
  },
  {
    title: 'Paper Satellites',
    artist: 'The Quiet Engines',
    genre: 'Kosmische',
    motif: 'satellites',
    pal: { bg: '#2b3ec2', ink: '#f3f1ea', a: '#f4c542', b: '#9fb2ff', c: '#f3f1ea' },
    page: { bg: '#2b3ec2', fg: '#f3f1ea', accent: '#f4c542' },
    blurb:
      'Two organs, one drum machine and a rule that nothing could be played faster than a slow orbit. Motorik for people who would rather stay in the capsule.',
    where: 'Halle 9, Düsseldorf',
    by: 'Anselm Reuter',
    tracks: [
      ['Fold One', '3:45'],
      ['Apogee for Beginners', '6:22'],
      ['Paper Satellites', '7:51'],
      ['Telemetry', '4:09'],
      ['The Quiet Engines', '9:30'],
      ['Re-entry, Softly', '5:17'],
    ],
  },
  {
    title: 'Velvet Arithmetic',
    artist: 'Oda Brume Quartet',
    genre: 'Modal Jazz',
    motif: 'arithmetic',
    pal: { bg: '#8a1c2c', ink: '#f6e7d8', a: '#c9324a', b: '#e9b872', c: '#5e0f1c' },
    page: { bg: '#8a1c2c', fg: '#f6e7d8', accent: '#e9b872' },
    blurb:
      'Recorded in two evenings with the tape never stopped. Brume counts the quartet in with sums instead of numbers; the answers are all in the bass.',
    where: 'Studio Kvart, Oslo',
    by: 'Henrik Sol',
    tracks: [
      ['Sum of Small Hours', '8:02'],
      ['Velvet Arithmetic', '6:47'],
      ['Carry the One', '5:20'],
      ['Long Division', '9:11'],
      ['Remainder', '4:36'],
      ['Equals Blue', '7:25'],
    ],
  },
  {
    title: 'Glasshouse Weather',
    artist: 'Ferenc Vos',
    genre: 'Fourth World',
    motif: 'glasshouse',
    pal: { bg: '#e3eee2', ink: '#1e4a35', a: '#3c8a5a', b: '#a6cf8f', c: '#f7fbf5' },
    page: { bg: '#e3eee2', fg: '#1e4a35', accent: '#3c8a5a' },
    blurb:
      'Marimba, breath and contact mics taped to the panes of a botanical garden after closing. You can hear the sprinklers come on in the fourth track.',
    where: 'Palm House, Leiden',
    by: 'Ferenc Vos',
    tracks: [
      ['Condensation', '4:44'],
      ['Fern Logic', '6:18'],
      ['Glasshouse Weather', '7:32'],
      ['Humid Arithmetic', '5:05'],
      ['Orchid Relay', '6:51'],
      ['Vent, Open', '3:58'],
    ],
  },
  {
    title: 'Night Bus to Ostend',
    artist: 'Kasimir Lowe',
    genre: 'Dub Techno',
    motif: 'nightbus',
    pal: { bg: '#151518', ink: '#f1ead8', a: '#f2c14e', b: '#d6453d', c: '#2a2a31' },
    page: { bg: '#151518', fg: '#f1ead8', accent: '#f2c14e' },
    blurb:
      'Chords that smear like sodium light on a wet window. Written on the last coach out of Brussels, mixed so the kick sits two rows behind you.',
    where: 'Kelder 12, Ghent',
    by: 'Kasimir Lowe',
    tracks: [
      ['N41 Departure', '6:06'],
      ['Sodium', '7:48'],
      ['Night Bus to Ostend', '9:02'],
      ['Ferry Lights', '5:39'],
      ['Upper Deck, Empty', '6:57'],
      ['Terminus', '8:21'],
    ],
  },
  {
    title: 'Soft Machinery',
    artist: 'Mirae Sato',
    genre: 'Electro-pop',
    motif: 'machinery',
    pal: { bg: '#f0a9c1', ink: '#5b1230', a: '#d6304f', b: '#fbe6d0', c: '#b8496d' },
    page: { bg: '#f0a9c1', fg: '#5b1230', accent: '#d6304f' },
    blurb:
      'Love songs for small motors. Sato built every drum sound from a sewing machine and then sang over the top as if nothing unusual had happened.',
    where: 'Room 303, Osaka',
    by: 'Mirae Sato',
    tracks: [
      ['Warm Gears', '3:52'],
      ['Soft Machinery', '4:27'],
      ['Felt Hammer', '3:36'],
      ['Cotton Circuit', '5:01'],
      ['Love as a Servo', '4:13'],
      ['Power Down, Gently', '5:48'],
    ],
  },
  {
    title: 'Saltwater Hymns',
    artist: 'The Orchard Signal',
    genre: 'Slowcore',
    motif: 'hymns',
    pal: { bg: '#2f7281', ink: '#f2ecdc', a: '#f08a4b', b: '#9fd0cf', c: '#245a67' },
    page: { bg: '#2f7281', fg: '#f2ecdc', accent: '#f6b27a' },
    blurb:
      'Five voices and a harmonium in a chapel with the doors propped open to the estuary. The tide is credited as the sixth member.',
    where: 'St Wenna, Fal Estuary',
    by: 'Dora Penhale',
    tracks: [
      ['Brine', '5:14'],
      ['First Hymn (Estuary)', '6:40'],
      ['Gull Choir', '4:22'],
      ['Saltwater Hymn', '8:09'],
      ['The Orchard Signal', '5:55'],
      ['Tidewrack', '7:16'],
    ],
  },
  {
    title: 'Brass for Small Rooms',
    artist: 'Juno Halvard',
    genre: 'Chamber Jazz',
    motif: 'brass',
    pal: { bg: '#e3b23a', ink: '#3a2408', a: '#f6dd8e', b: '#b5521f', c: '#fff4d0' },
    page: { bg: '#e3b23a', fg: '#3a2408', accent: '#8f3b12' },
    blurb:
      'A flugelhorn, a tuba and a trombone arranged around one microphone in a bedsit. Played quietly enough not to wake the neighbours; they came to the launch.',
    where: 'Flat 2b, Gothenburg',
    by: 'Juno Halvard',
    tracks: [
      ['Bedsit Fanfare', '3:18'],
      ['Mute', '5:42'],
      ['Brass for Small Rooms', '6:29'],
      ['Landing Light', '4:50'],
      ['Two Chairs', '5:07'],
      ['Lullaby for a Radiator', '7:01'],
    ],
  },
  {
    title: 'Afterimage',
    artist: 'Moth Parade',
    genre: 'Shoegaze',
    motif: 'afterimage',
    pal: { bg: '#3a2060', ink: '#f1e6ff', a: '#ff4f9a', b: '#39c6e6', c: '#ffd84a' },
    page: { bg: '#3a2060', fg: '#f1e6ff', accent: '#ff7ab4' },
    blurb:
      'Four guitars pointed at one amp until the room started to hum back. The vocals are in there somewhere; close your eyes and they stay on the inside of the lids.',
    where: 'The Lamp Works, Leeds',
    by: 'Priya Okafor',
    tracks: [
      ['Blink', '4:03'],
      ['Afterimage', '5:58'],
      ['Halation', '6:31'],
      ['Moth Parade', '4:46'],
      ['Retina Burn', '7:12'],
      ['Slow Shutter', '8:40'],
    ],
  },
  {
    title: 'Seven',
    artist: 'Ravel Kite',
    genre: 'Minimal Techno',
    motif: 'seven',
    pal: { bg: '#ecece9', ink: '#161616', a: '#e4572e', b: '#8d8d8a', c: '#ffffff' },
    page: { bg: '#ecece9', fg: '#161616', accent: '#e4572e' },
    blurb:
      'Six tracks named for primes, each exactly as long as its title. Seven speakers on the sleeve, one of them out of phase. Kite has never explained which.',
    where: 'Unit 7, Rotterdam',
    by: 'Ravel Kite',
    tracks: [
      ['Two', '2:00'],
      ['Three', '3:00'],
      ['Five', '5:00'],
      ['Seven', '7:00'],
      ['Eleven', '11:00'],
      ['Thirteen', '13:00'],
    ],
  },
  {
    title: 'Concentric',
    artist: 'Saoirse & Fog',
    genre: 'Ambient',
    motif: 'concentric',
    pal: { bg: '#f3efe4', ink: '#3b43b5', a: '#5b63d6', b: '#c9cffa', c: '#ffffff' },
    page: { bg: '#eceefb', fg: '#2b318f', accent: '#5b63d6' },
    blurb:
      'A single tape loop lowered into a lake on a fishing line, recorded from the bank as it slowed. Everything here is the same eleven seconds, widening.',
    where: 'Lough Derg, County Clare',
    by: 'Saoirse Ní Bhriain',
    tracks: [
      ['Drop', '4:12'],
      ['Ring One', '7:30'],
      ['Ring Two', '8:45'],
      ['Concentric', '10:02'],
      ['Reel, Floating', '6:18'],
      ['Stillwater', '9:27'],
    ],
  },
  {
    title: 'Marigold Hours',
    artist: 'Cass Bellamy',
    genre: 'Folk',
    motif: 'marigold',
    pal: { bg: '#e8943a', ink: '#3d1c05', a: '#f8d24a', b: '#c8501e', c: '#fff1c9' },
    page: { bg: '#e8943a', fg: '#3d1c05', accent: '#7a2c08' },
    blurb:
      'Songs written between six and seven in the morning on an allotment in Sheffield. Nylon strings, a thermos, and a robin that would not leave the take.',
    where: 'Plot 31, Sheffield',
    by: 'Cass Bellamy',
    tracks: [
      ['Six A.M., Orange', '3:29'],
      ['Marigold Hours', '4:44'],
      ['Seed Packet', '2:58'],
      ['Allotment Waltz', '4:10'],
      ['Sundial', '5:22'],
      ['Dead-heading', '3:51'],
    ],
  },
  {
    title: 'Quiet Intersections',
    artist: 'Pell Mirador',
    genre: 'Post-rock',
    motif: 'intersections',
    pal: { bg: '#a9c5ef', ink: '#16264d', a: '#f25c3c', b: '#5d7fc4', c: '#f4f6fb' },
    page: { bg: '#a9c5ef', fg: '#16264d', accent: '#c63d20' },
    blurb:
      'Instrumentals mapped to a grid of empty junctions at four in the morning. Every crescendo waits for the lights to change before it goes.',
    where: 'Depot Sound, Winnipeg',
    by: 'Theo Marchetti',
    tracks: [
      ['Amber Phase', '5:33'],
      ['Four-Way', '7:14'],
      ['Quiet Intersections', '9:48'],
      ['Pedestrian Hymn', '4:27'],
      ['Grid North', '6:39'],
      ['All Lights Green', '11:05'],
    ],
  },
  {
    title: 'Moonlit Accounting',
    artist: 'Hollis & Wren',
    genre: 'Lo-fi House',
    motif: 'moonlit',
    pal: { bg: '#1b2552', ink: '#f3ecd6', a: '#e0564a', b: '#6f80c8', c: '#f3ecd6' },
    page: { bg: '#1b2552', fg: '#f3ecd6', accent: '#f0b55a' },
    blurb:
      'Made after hours in the back office of a carpet warehouse, with an adding machine doing duty as the hi-hat. Balanced to the penny.',
    where: 'Back Office, Croydon',
    by: 'Hollis & Wren',
    tracks: [
      ['Opening Balance', '5:20'],
      ['Moonlit Accounting', '6:54'],
      ['Petty Cash', '4:31'],
      ['Double Entry', '7:07'],
      ['Night Audit', '6:12'],
      ['Carried Forward', '8:36'],
    ],
  },
  {
    title: 'Staircase Choir',
    artist: 'Ilsa Marrow',
    genre: 'Choral Electronics',
    motif: 'staircase',
    pal: { bg: '#d9492c', ink: '#fff1df', a: '#8e2413', b: '#2a1410', c: '#fbe6cf' },
    page: { bg: '#d9492c', fg: '#fff1df', accent: '#ffd08a' },
    blurb:
      'Nine singers, one per step, in the stairwell of a decommissioned bank. Marrow conducted from the ground floor and processed the reverb, never the voices.',
    where: 'Stairwell C, Riga',
    by: 'Ilsa Marrow',
    tracks: [
      ['Ground Floor', '3:40'],
      ['Landing', '5:16'],
      ['Staircase Choir', '6:48'],
      ['Bannister', '4:05'],
      ['Mezzanine', '5:52'],
      ['Roof Door', '7:33'],
    ],
  },
  {
    title: 'Heat Haze',
    artist: 'Tove Adair',
    genre: 'Balearic Pop',
    motif: 'haze',
    pal: { bg: '#f1cfae', ink: '#5a2a12', a: '#f6a04a', b: '#e2603c', c: '#f9ead8' },
    page: { bg: '#f1cfae', fg: '#5a2a12', accent: '#c9461f' },
    blurb:
      'The last disc on the shelf, and the warmest. Slide guitar bent until the pitch shimmers, drums recorded outdoors at noon, everything slightly overexposed.',
    where: 'Casa Lido, Almería',
    by: 'Tove Adair',
    tracks: [
      ['Tarmac Shimmer', '4:18'],
      ['Heat Haze', '5:09'],
      ['Siesta Engine', '3:47'],
      ['Mirage, Probably', '6:26'],
      ['Lido', '4:55'],
      ['Long Shadow Home', '7:40'],
    ],
  },
];

export const FIRST_YEAR = 1994;

export const RELEASES: Release[] = RAW.map((r, i) => ({
  ...r,
  idx: i,
  cat: `SBL-${String(i + 1).padStart(3, '0')}`,
  year: FIRST_YEAR + i,
}));

export const N = RELEASES.length;

export function runtime(r: Release): string {
  const s = r.tracks.reduce((acc, [, d]) => {
    const [m, sec] = d.split(':').map(Number);
    return acc + m * 60 + sec;
  }, 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const mod = (n: number, m: number) => ((n % m) + m) % m;
