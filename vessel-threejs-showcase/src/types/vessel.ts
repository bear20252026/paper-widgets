export type LightingMood = 'golden' | 'blueHour' | 'noon' | 'studio';

export type FinishPreset = 'roseCopper' | 'brushedBronze' | 'champagneGold' | 'titanium' | 'obsidian';

export type CameraPresetId = 'hero' | 'oculus' | 'closeup' | 'isometric' | 'plaza';

export interface VesselParams {
  // 1. Silhouette & Scale
  radialBays: number;
  verticalLevels: number;
  totalHeight: number;
  baseRadius: number;
  topRadius: number;
  profilePower: number;
  profileBulge: number;
  verticalPower: number;
  spiralTwistDeg: number;

  // 2. Honeycomb & Landings
  landingRatio: number;
  walkwayWidth: number;
  doubleTrackSplit: number;
  flightGap: number;
  closeTopRim: boolean;

  // 3. Stairs & Structural Hull
  stepsPerFlight: number;
  stepNosing: number;
  slabThickness: number;
  soffitDepth: number;
  soffitTaper: number;
  stringerWidth: number;
  showStructuralRibs: boolean;

  // 4. Balustrades & Handrails
  showRailings: boolean;
  showGlass: boolean;
  railingHeight: number;
  glassThickness: number;
  handrailWidth: number;
  handrailHeight: number;
  postsPerSpan: number;

  // 5. Base Plinth & Plaza
  showBasePlinth: boolean;
  baseHeight: number;
  baseOverhang: number;
  baseStepTiers: number;

  // 6. Materials & Atmosphere
  finishPreset: FinishPreset;
  copperRoughness: number;
  copperMetalness: number;
  lightingMood: LightingMood;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  wireframe: boolean;
  autoOrbit: boolean;
}

export interface VesselStats {
  landings: number;
  flights: number;
  totalSteps: number;
  vertices: number;
  triangles: number;
  rebuildMs: number;
  overallHeight: number;
  overallDiameter: number;
}

export const DEFAULT_VESSEL_PARAMS: VesselParams = {
  // 1. Silhouette & Scale (matches Blender 5.1 Geometry Nodes defaults!)
  radialBays: 8,
  verticalLevels: 10,
  totalHeight: 30.0,
  baseRadius: 8.0,
  topRadius: 21.0,
  profilePower: 0.90,
  profileBulge: 0.80,
  verticalPower: 1.18,
  spiralTwistDeg: 0,

  // 2. Honeycomb & Landings
  landingRatio: 0.25,
  walkwayWidth: 3.2,
  doubleTrackSplit: 1.0,
  flightGap: 0.18,
  closeTopRim: false,

  // 3. Stairs & Structural Hull
  stepsPerFlight: 14,
  stepNosing: 0.03,
  slabThickness: 0.24,
  soffitDepth: 0.68,
  soffitTaper: 0.32,
  stringerWidth: 0.11,
  showStructuralRibs: true,

  // 4. Balustrades & Handrails
  showRailings: true,
  showGlass: true,
  railingHeight: 1.15,
  glassThickness: 0.035,
  handrailWidth: 0.10,
  handrailHeight: 0.06,
  postsPerSpan: 4,

  // 5. Base Plinth & Plaza
  showBasePlinth: true,
  baseHeight: 0.90,
  baseOverhang: 3.2,
  baseStepTiers: 3,

  // 6. Materials & Atmosphere
  finishPreset: 'roseCopper',
  copperRoughness: 0.16,
  copperMetalness: 0.96,
  lightingMood: 'golden',
  sunElevationDeg: 22,
  sunAzimuthDeg: 48,
  wireframe: false,
  autoOrbit: false,
};

export interface ArchitecturalPreset {
  id: string;
  label: string;
  subtitle: string;
  overrides: Partial<VesselParams>;
}

export const ARCHITECTURAL_PRESETS: ArchitecturalPreset[] = [
  {
    id: 'classic',
    label: 'Hudson Classic',
    subtitle: '8-bay iconic Vessel',
    overrides: {
      radialBays: 8,
      verticalLevels: 10,
      totalHeight: 30.0,
      baseRadius: 8.0,
      topRadius: 21.0,
      profilePower: 0.90,
      profileBulge: 0.80,
      verticalPower: 1.18,
      spiralTwistDeg: 0,
      landingRatio: 0.25,
      walkwayWidth: 3.2,
      doubleTrackSplit: 1.0,
      closeTopRim: false,
      stepsPerFlight: 14,
      soffitDepth: 0.68,
      soffitTaper: 0.32,
      finishPreset: 'roseCopper',
    },
  },
  {
    id: 'monument16',
    label: '16-Story NYC',
    subtitle: 'Full 46m scale · 15 levels',
    overrides: {
      radialBays: 6,
      verticalLevels: 15,
      totalHeight: 45.0,
      baseRadius: 7.5,
      topRadius: 23.0,
      profilePower: 0.88,
      profileBulge: 1.2,
      verticalPower: 1.12,
      spiralTwistDeg: 0,
      landingRatio: 0.24,
      walkwayWidth: 3.4,
      doubleTrackSplit: 1.0,
      closeTopRim: true,
      stepsPerFlight: 16,
      soffitDepth: 0.78,
      soffitTaper: 0.35,
      finishPreset: 'roseCopper',
    },
  },
  {
    id: 'twistedCrown',
    label: 'Twisted Crown',
    subtitle: '12 bays · 40° helix · skywalk',
    overrides: {
      radialBays: 12,
      verticalLevels: 12,
      totalHeight: 36.0,
      baseRadius: 8.2,
      topRadius: 21.5,
      profilePower: 1.22,
      profileBulge: -1.4,
      verticalPower: 1.16,
      spiralTwistDeg: 40,
      landingRatio: 0.24,
      walkwayWidth: 3.0,
      doubleTrackSplit: 1.0,
      closeTopRim: true,
      stepsPerFlight: 14,
      soffitDepth: 0.64,
      soffitTaper: 0.34,
      finishPreset: 'champagneGold',
    },
  },
  {
    id: 'referenceBowl',
    label: 'Ref Bowl',
    subtitle: '6 bays · unified ribbon',
    overrides: {
      radialBays: 6,
      verticalLevels: 8,
      totalHeight: 24.0,
      baseRadius: 8.0,
      topRadius: 21.0,
      profilePower: 0.95,
      profileBulge: 0.0,
      verticalPower: 1.18,
      spiralTwistDeg: 0,
      landingRatio: 0.26,
      walkwayWidth: 3.0,
      doubleTrackSplit: 0.0,
      closeTopRim: false,
      stepsPerFlight: 14,
      soffitDepth: 0.55,
      soffitTaper: 0.25,
      finishPreset: 'titanium',
    },
  },
  {
    id: 'cathedral',
    label: 'Cathedral Keel',
    subtitle: '10 bays · sculpted bronze',
    overrides: {
      radialBays: 10,
      verticalLevels: 13,
      totalHeight: 38.0,
      baseRadius: 7.2,
      topRadius: 24.0,
      profilePower: 1.38,
      profileBulge: -0.6,
      verticalPower: 1.22,
      spiralTwistDeg: -22,
      landingRatio: 0.22,
      walkwayWidth: 3.3,
      doubleTrackSplit: 1.0,
      closeTopRim: false,
      stepsPerFlight: 15,
      soffitDepth: 0.95,
      soffitTaper: 0.46,
      finishPreset: 'brushedBronze',
    },
  },
];

export const FINISH_PALETTES: Record<
  FinishPreset,
  {
    label: string;
    copperHex: string;
    handrailHex: string;
    steelHex: string;
    concreteHex: string;
    glassHex: string;
    swatch: string;
  }
> = {
  roseCopper: {
    label: 'Rose Copper',
    copperHex: '#c46c43',
    handrailHex: '#d48858',
    steelHex: '#181a1f',
    concreteHex: '#9c978f',
    glassHex: '#b8ced6',
    swatch: '#c46c43',
  },
  brushedBronze: {
    label: 'Warm Bronze',
    copperHex: '#9a7144',
    handrailHex: '#b88e5b',
    steelHex: '#161618',
    concreteHex: '#959088',
    glassHex: '#c2c8be',
    swatch: '#9a7144',
  },
  champagneGold: {
    label: 'Champagne Gold',
    copperHex: '#d4ae73',
    handrailHex: '#e2c18a',
    steelHex: '#1a1c22',
    concreteHex: '#a39f98',
    glassHex: '#c7d5de',
    swatch: '#d4ae73',
  },
  titanium: {
    label: 'Brushed Titanium',
    copperHex: '#b6bcc4',
    handrailHex: '#d0d5dc',
    steelHex: '#20242c',
    concreteHex: '#b4b6b8',
    glassHex: '#cbe0eb',
    swatch: '#b6bcc4',
  },
  obsidian: {
    label: 'Obsidian & Gold',
    copperHex: '#2c303a',
    handrailHex: '#d6a256',
    steelHex: '#101217',
    concreteHex: '#6c6e73',
    glassHex: '#7f98a6',
    swatch: '#2c303a',
  },
};
