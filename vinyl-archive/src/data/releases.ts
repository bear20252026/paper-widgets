export type Release = {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  color: string;
  ink: string;
  accent: string;
  description: string;
  tracks: { title: string; duration: string }[];
};

export const releases: Release[] = [
  {
    id: "SBL-001",
    title: "Velvet Arithmetic",
    artist: "Otis Barlow Quartet",
    year: 1994,
    genre: "Deep jazz",
    color: "#833b36",
    ink: "#f1e8d8",
    accent: "#dc7854",
    description:
      "The one that started it all. Loose-limbed rhythms, late-night conversations, and four musicians finding a language of their own.",
    tracks: [
      { title: "A Room Above", duration: "05:32" },
      { title: "Velvet Arithmetic", duration: "07:18" },
      { title: "The Long Way Home", duration: "06:04" },
      { title: "First Light", duration: "08:21" },
    ],
  },
  {
    id: "SBL-002",
    title: "Glasshouse Weather",
    artist: "Frida Voss",
    year: 1995,
    genre: "Ambient",
    color: "#d4e0cd",
    ink: "#334936",
    accent: "#71947b",
    description:
      "Field recordings from a rain-soaked conservatory, held together by delicate piano and the quiet rhythm of things growing.",
    tracks: [
      { title: "Under Glass", duration: "06:12" },
      { title: "Humidity", duration: "08:45" },
      { title: "Green Rooms", duration: "05:38" },
      { title: "A Change in Weather", duration: "09:02" },
    ],
  },
  {
    id: "SBL-003",
    title: "Night Bus to Ostend",
    artist: "Kamal Ives",
    year: 1996,
    genre: "Downtempo",
    color: "#262725",
    ink: "#f0eee2",
    accent: "#aaa28c",
    description:
      "An unhurried journey through sleeping cities. Dusty drums and half-remembered melodies, viewed through the window of the last bus.",
    tracks: [
      { title: "Departure Board", duration: "04:56" },
      { title: "Night Bus to Ostend", duration: "07:42" },
      { title: "Amber Windows", duration: "06:18" },
      { title: "End of the Line", duration: "08:11" },
    ],
  },
  {
    id: "SBL-004",
    title: "Soft Machinery",
    artist: "Miko Sato",
    year: 1997,
    genre: "Electronica",
    color: "#dfaeb5",
    ink: "#653b49",
    accent: "#c57289",
    description:
      "Small machines with human hearts. A collection of intricate electronic miniatures, as playful as they are quietly moving.",
    tracks: [
      { title: "Little Engines", duration: "05:12" },
      { title: "Soft Machinery", duration: "06:47" },
      { title: "Paper Circuit", duration: "04:38" },
      { title: "Sleep Mode", duration: "07:20" },
    ],
  },
  {
    id: "SBL-005",
    title: "Saltwater Hymns",
    artist: "The Ochre Signal",
    year: 1998,
    genre: "Dub / ambient",
    color: "#337580",
    ink: "#e6eee3",
    accent: "#b6c9b8",
    description:
      "Low frequencies meet the open sea. Patient, tidal dub from a makeshift studio on the very edge of the coast.",
    tracks: [
      { title: "Sounding Line", duration: "07:15" },
      { title: "Saltwater Hymns", duration: "08:36" },
      { title: "Low Water Mark", duration: "06:22" },
      { title: "Further Offshore", duration: "09:48" },
    ],
  },
  {
    id: "SBL-006",
    title: "Brass for Small Rooms",
    artist: "Juno Halvard",
    year: 1999,
    genre: "Modern jazz",
    color: "#e2bb51",
    ink: "#514226",
    accent: "#936d34",
    description:
      "Intimate brass arrangements for the spaces between people. Recorded live, with the windows open and the city quietly listening.",
    tracks: [
      { title: "An Open Window", duration: "05:44" },
      { title: "Brass for Small Rooms", duration: "07:09" },
      { title: "Afternoon Visitors", duration: "04:52" },
      { title: "Still Warm", duration: "06:38" },
    ],
  },
  {
    id: "SBL-007",
    title: "Afterimage",
    artist: "Moth Parade",
    year: 2000,
    genre: "Leftfield",
    color: "#3d2b5a",
    ink: "#ede4f4",
    accent: "#b49ec5",
    description:
      "Music that lingers after the lights go out. Blurred electronics and luminous textures from the elusive Moth Parade.",
    tracks: [
      { title: "Retinal Bloom", duration: "06:32" },
      { title: "Afterimage", duration: "08:14" },
      { title: "Ultraviolet", duration: "05:57" },
      { title: "When the Light Leaves", duration: "09:06" },
    ],
  },
  {
    id: "SBL-008",
    title: "Seven",
    artist: "Pavel Kite",
    year: 2001,
    genre: "Experimental",
    color: "#e6e5db",
    ink: "#30342c",
    accent: "#a15c3e",
    description:
      "Seven circles, seven days, one beautifully strange record. Tape experiments and found sounds assembled into an unexpected whole.",
    tracks: [
      { title: "One into Two", duration: "04:17" },
      { title: "A Circle of Seven", duration: "07:32" },
      { title: "Sunday Tape", duration: "06:08" },
      { title: "Begin Again", duration: "08:54" },
    ],
  },
  {
    id: "SBL-009",
    title: "Still Life, Moving",
    artist: "Alma / Ansel",
    year: 2002,
    genre: "Modern classical",
    color: "#a9a38d",
    ink: "#f2eedf",
    accent: "#555d45",
    description:
      "Piano, cello, and the sound of a room breathing. A patient conversation between two lifelong collaborators.",
    tracks: [
      { title: "Objects in Morning Light", duration: "06:24" },
      { title: "Still Life, Moving", duration: "09:12" },
      { title: "The Space Between", duration: "07:18" },
      { title: "Dust in the Air", duration: "05:43" },
    ],
  },
  {
    id: "SBL-010",
    title: "A Place Between",
    artist: "Soren Vale",
    year: 2003,
    genre: "Ambient",
    color: "#bec6b9",
    ink: "#38423b",
    accent: "#7d927f",
    description:
      "Neither here nor there. Soft-focus synthesis and distant voices trace an imaginary geography of belonging.",
    tracks: [
      { title: "Somewhere, Slowly", duration: "07:42" },
      { title: "A Place Between", duration: "08:18" },
      { title: "Familiar Distance", duration: "06:55" },
      { title: "Almost Home", duration: "09:14" },
    ],
  },
  {
    id: "SBL-011",
    title: "Concentric",
    artist: "Saoirse & Fog",
    year: 2004,
    genre: "Ambient",
    color: "#f0eadb",
    ink: "#4a4869",
    accent: "#8a87c2",
    description:
      "Ripples from a quiet place. Saoirse & Fog weave rain-soaked tape loops, weightless synthesis, and distant piano into a record that moves outwards, slowly, in ever-widening circles.",
    tracks: [
      { title: "Surface Tension", duration: "06:42" },
      { title: "Halation", duration: "08:16" },
      { title: "Concentric", duration: "09:24" },
      { title: "After the Rain", duration: "07:08" },
    ],
  },
  {
    id: "SBL-012",
    title: "Marigold Hours",
    artist: "Cerys Bellamy",
    year: 2005,
    genre: "Soul / jazz",
    color: "#d89038",
    ink: "#614020",
    accent: "#f3d37a",
    description:
      "Golden-hour music, made without a clock. Warm keys, honeyed vocals, and rhythms that leave just enough room for the sunlight.",
    tracks: [
      { title: "Honey in the Morning", duration: "04:58" },
      { title: "Marigold Hours", duration: "06:32" },
      { title: "Slow Bloom", duration: "05:47" },
      { title: "One More Summer", duration: "07:12" },
    ],
  },
  {
    id: "SBL-013",
    title: "Quiet Intersections",
    artist: "Pell Mirador",
    year: 2006,
    genre: "Electronica",
    color: "#b6c7e4",
    ink: "#384761",
    accent: "#718daf",
    description:
      "Where small paths cross. A quietly intricate meeting of clean-lined electronics, soft percussion, and everyday coincidence.",
    tracks: [
      { title: "Crossing Paths", duration: "05:18" },
      { title: "Quiet Intersections", duration: "07:44" },
      { title: "Parallel Lives", duration: "06:23" },
      { title: "The Way We Meet", duration: "08:07" },
    ],
  },
  {
    id: "SBL-014",
    title: "Moonlit Accounting",
    artist: "Hollis & Wren",
    year: 2007,
    genre: "Nocturnal jazz",
    color: "#242e47",
    ink: "#ecebd5",
    accent: "#9babc2",
    description:
      "An inventory of small hours. Muted trumpet, brushed percussion, and the particular silence of a city at three in the morning.",
    tracks: [
      { title: "Unsettled Figures", duration: "06:12" },
      { title: "Moonlit Accounting", duration: "07:53" },
      { title: "Night Ledger", duration: "05:46" },
      { title: "Nothing Owed", duration: "08:28" },
    ],
  },
  {
    id: "SBL-015",
    title: "Staircase Choir",
    artist: "Ina Marrow",
    year: 2008,
    genre: "Experimental",
    color: "#c75c45",
    ink: "#f7e7d0",
    accent: "#edb88d",
    description:
      "Voices finding each other in the architecture. Layer upon layer of unaccompanied song, recorded in a stairwell over one long winter.",
    tracks: [
      { title: "First Landing", duration: "05:27" },
      { title: "Staircase Choir", duration: "08:46" },
      { title: "Up to the Skylight", duration: "06:35" },
      { title: "An Echo, Answered", duration: "07:18" },
    ],
  },
  {
    id: "SBL-016",
    title: "Heat Haze",
    artist: "Yow Quai",
    year: 2009,
    genre: "Downtempo",
    color: "#e5c9a4",
    ink: "#6d4c36",
    accent: "#bc8962",
    description:
      "The air shimmers, the afternoon stretches on. Sun-bleached beats and hazy melodic fragments for doing absolutely nothing in particular.",
    tracks: [
      { title: "Thirty in the Shade", duration: "05:48" },
      { title: "Heat Haze", duration: "07:12" },
      { title: "Distant Traffic", duration: "06:34" },
      { title: "Until the Evening", duration: "08:02" },
    ],
  },
];

export const INITIAL_RELEASE = 10;
export const wrapIndex = (index: number) =>
  ((index % releases.length) + releases.length) % releases.length;
