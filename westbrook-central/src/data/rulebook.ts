export interface Rule {
  id: string
  section: string
  title: string
  body: string
  check: 'auto' | 'manual'
}

export const RULEBOOK: Rule[] = [
  // ---- Assets
  {
    id: 'AST-01',
    section: 'Assets',
    title: 'Zero downloaded scene assets',
    body: 'Every mesh is parametric geometry; every texture is drawn on a canvas at runtime. No GLTF, HDRI, image or font files may be loaded into the 3D scene. Reference photos live only in the UI.',
    check: 'auto',
  },
  {
    id: 'AST-02',
    section: 'Assets',
    title: 'Repetition is instanced',
    body: 'Sleepers, ballast, columns, lamps, and bolts repeat hundreds of times. Anything repeated more than 8× must be an InstancedMesh.',
    check: 'manual',
  },
  // ---- Scale
  {
    id: 'SCL-01',
    section: 'Scale',
    title: 'Real-world metres',
    body: 'Track gauge 1.435 m, rail head 1.00 m below platform coping, island platform 8.0 m wide. Barrel-vault canopy springs at 3.95 m and crowns at 5.17 m; glazed footbridge deck 5.70 m; sign underside ≥ 2.6 m; bench seat 0.45 m.',
    check: 'manual',
  },
  {
    id: 'SCL-02',
    section: 'Scale',
    title: 'Sleeper spacing 0.65 m',
    body: 'Concrete monobloc sleepers 2.5 × 0.25 × 0.2 m at 0.65 m centres, sitting in a ballast shoulder that stands proud of the formation.',
    check: 'manual',
  },
  // ---- Materials
  {
    id: 'MAT-01',
    section: 'Materials',
    title: 'PBR only',
    body: 'All visible surfaces use MeshStandardMaterial or MeshPhysicalMaterial. Unlit materials are allowed only for the sky dome.',
    check: 'auto',
  },
  {
    id: 'MAT-02',
    section: 'Materials',
    title: 'No pure black or pure white albedo',
    body: 'Real surfaces sit between ~0.04 and ~0.9 reflectance. Albedo luminance must stay inside [0.03, 0.95].',
    check: 'auto',
  },
  {
    id: 'MAT-03',
    section: 'Materials',
    title: 'Roughness bands',
    body: 'Concrete 0.85–0.95 (0.35–0.5 when wet), painted steel 0.45–0.6, rail head 0.3 metallic, glass 0.05–0.15, brick 0.9.',
    check: 'manual',
  },
  {
    id: 'MAT-04',
    section: 'Materials',
    title: 'Dirt gradients',
    body: 'Walls darken toward the ground, ballast is browner near rails, concrete has joint lines and stains. Nothing is uniformly clean.',
    check: 'manual',
  },
  // ---- Signage (derived from reference photos)
  {
    id: 'SGN-01',
    section: 'Signage',
    title: 'Hanging direction signs',
    body: 'Double-sided boards suspended from the canopy, ~2.4 × 0.6 m, white ground, dark sans-serif, platform number in a solid colour block, arrows at the outer ends (observed in London and Lisboa references).',
    check: 'manual',
  },
  {
    id: 'SGN-02',
    section: 'Signage',
    title: 'Station name boards repeat',
    body: 'Station name repeated every ~30 m on totems so it is readable from any door of a stopped train, with the previous/next station in small type (Kyoto reference).',
    check: 'manual',
  },
  {
    id: 'SGN-03',
    section: 'Signage',
    title: 'Departure board is the brightest thing',
    body: 'Black ground, amber/white monospaced rows, emissive and blooming slightly. Located near the centre of the platform (Kyoto / departures board references).',
    check: 'manual',
  },
  {
    id: 'SGN-04',
    section: 'Signage',
    title: 'Edge safety system',
    body: '100 mm yellow line 500 mm from the coping, 400 mm tactile dome strip behind it, "MIND THE GAP" stencil at door positions.',
    check: 'manual',
  },
  // ---- Lighting
  {
    id: 'LGT-01',
    section: 'Lighting',
    title: 'One sun, one sky',
    body: 'A single shadow-casting directional light plus a procedural sky/environment. Artificial lights are emissive strips that bloom; punctual lights ≤ 6.',
    check: 'auto',
  },
  {
    id: 'LGT-02',
    section: 'Lighting',
    title: 'Depth through fog',
    body: 'Exponential fog always on so the tracks dissolve before the end of the geometry. Density 0.003–0.014.',
    check: 'auto',
  },
  // ---- Camera
  {
    id: 'CAM-01',
    section: 'Camera',
    title: 'Eye level',
    body: 'Hero shots are taken between 1.2 m and 2.2 m above the platform, 35 mm-ish lens (45° vertical FOV).',
    check: 'auto',
  },
  {
    id: 'CAM-02',
    section: 'Camera',
    title: 'Never below the coping',
    body: 'No camera below platform level — track-level shots expose un-modelled undersides.',
    check: 'auto',
  },
  // ---- Rolling Stock
  {
    id: 'RLS-01',
    section: 'Rolling Stock',
    title: 'Sculpted body & furnished saloon',
    body: 'Aerodynamic lofted cab nose, domed roof barrel, rounded-corner windows, arched ceiling vault, ergonomic S-curve 2+2 moquette seats with winged headrests, fold-down trays, tubular grab loops, hand-straps, luggage racks, draught screens & LED PIS displays.',
    check: 'manual',
  },
  {
    id: 'RLS-02',
    section: 'Rolling Stock',
    title: 'Kinematic schedule & sliding doors',
    body: 'Trains operate on a timetable loop: smooth S-curve braking into platform 2, dwell countdown with automated sliding doors, and acceleration out onto the running line.',
    check: 'manual',
  },
  // ---- Performance
  {
    id: 'PRF-01',
    section: 'Performance',
    title: 'Draw-call budget',
    body: 'Fewer than 400 draw calls per frame.',
    check: 'auto',
  },
  {
    id: 'PRF-02',
    section: 'Performance',
    title: 'Triangle budget',
    body: 'Fewer than 600 k triangles per frame.',
    check: 'auto',
  },
  // ---- Process
  {
    id: 'REV-01',
    section: 'Process',
    title: 'Every change passes the loop',
    body: 'Run the automated audit, sign off each manual critic, write a note, close the round. A round with any failure is logged as REVISE and must be followed by another round.',
    check: 'manual',
  },
]

export const SECTIONS = Array.from(new Set(RULEBOOK.map((r) => r.section)))
export const MANUAL_RULE_IDS = RULEBOOK.filter((r) => r.check === 'manual').map((r) => r.id)
