import { DEFAULT_VESSEL_PARAMS, type FinishPreset, type VesselParams } from '../types/vessel';

export const VIDEO_FPS = 60;
export const VIDEO_DURATION_SEC = 32.0;
export const VIDEO_TOTAL_FRAMES = Math.round(VIDEO_FPS * VIDEO_DURATION_SEC); // 1920 frames

export interface HudSliderSpec {
  label: string;
  valueText: string;
  progress: number; // 0..1
  accent?: boolean;
}

export interface DirectorFrameState {
  frame: number;
  timeSec: number;
  progress: number; // 0..1 overall video progress
  shotIndex: number; // 1..13
  shotCount: number;
  shotTime: number;
  shotProgress: number; // 0..1 within current shot
  params: VesselParams;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
  cameraFov: number;
  /** Shift optical frustum when full interactive UI drawer is shown (Shot 12). */
  showFullUI: boolean;
  /** Editorial kinetic typography & HUD state */
  eyebrow: string;
  headline: string;
  subline: string;
  hudSliders: HudSliderSpec[];
  togglePill?: { label: string; on: boolean };
  finishShowcase?: FinishPreset;
  wireframeBadge?: boolean;
  isHeroIntro?: boolean;
  isFinaleOutro?: boolean;
  cutFlash: number; // 0..1 subtle bright cut accent on major transitions
  beatPulse: number; // 0..1 120-BPM beat pulse for subtle UI glow
}

// Smooth easing curves (Remotion-grade springy & cubic motion)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const easeOutQuint = (t: number) => 1 - Math.pow(1 - clamp01(t), 5);
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(t)));

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** 13-beat viral timeline boundaries in seconds (every 2.0–2.7s!). */
export const SHOT_CUTS_SEC = [
  0.0,  // 01: Viral Hook (Blueprint -> Rose Copper growth)
  2.5,  // 02: Radial Symmetry Morph (4 -> 12 bays)
  5.0,  // 03: Macro Stair Detail Close-Up (Steps 4 -> 24)
  7.5,  // 04: Heatherwick Double-Track Split (0% -> 100%)
  10.0, // 05: Sculptural Silhouette Lab (Goblet -> Hourglass -> Trumpet)
  12.5, // 06: Inside Atrium Oculus (Chiseled Copper Soffits)
  15.0, // 07: Helical Spiral Twist (12x12, 0 -> 90 deg, 4,032 steps)
  17.5, // 08: 360° Skywalk Crown Lock (Isometric Noon)
  20.0, // 09: Rapid-Fire Alloy Finishes (4 alloys on the beat!)
  22.5, // 10: Golden Hour -> Blue Hour Sunset Time-Lapse (Plaza low angle)
  25.2, // 11: Night Oculus Kaleidoscope (Landing Ratio breathe)
  27.6, // 12: Full Real-Time Interactive UI Showcase
  30.0, // 13: Viral Finale & Outro Card
  32.0, // END
];

export function evaluateDirectorFrame(frame: number, fps = VIDEO_FPS): DirectorFrameState {
  const timeSec = Math.min(Math.max(frame / fps, 0), VIDEO_DURATION_SEC);
  const progress = clamp01(timeSec / VIDEO_DURATION_SEC);

  // Determine current shot 1..13
  let shotIdx = 0;
  for (let i = 0; i < SHOT_CUTS_SEC.length - 1; i++) {
    if (timeSec >= SHOT_CUTS_SEC[i] && timeSec < SHOT_CUTS_SEC[i + 1]) {
      shotIdx = i;
      break;
    }
    if (i === SHOT_CUTS_SEC.length - 2) shotIdx = i;
  }

  const shotStart = SHOT_CUTS_SEC[shotIdx];
  const shotEnd = SHOT_CUTS_SEC[shotIdx + 1];
  const shotDur = Math.max(0.001, shotEnd - shotStart);
  const shotTime = Math.max(0, timeSec - shotStart);
  const sp = clamp01(shotTime / shotDur);

  // 120 BPM musical beat pulse (2 beats per second)
  const beatPhase = (timeSec * 2.0) % 1.0;
  const beatPulse = Math.pow(1 - beatPhase, 3.0);

  // Subtle crisp 0.14s editorial cut flash at shot boundaries
  const cutFlash = shotIdx > 0 && shotTime < 0.14 ? (1 - shotTime / 0.14) * 0.22 : 0;

  const p: VesselParams = { ...DEFAULT_VESSEL_PARAMS };
  let cameraPos: [number, number, number] = [0, 34, 82];
  let cameraTarget: [number, number, number] = [0, 15.8, 0];
  let cameraFov = 40;
  let showFullUI = false;
  let eyebrow = 'HUDSON YARDS · NYC';
  let headline = 'THE VESSEL';
  let subline = '100% Procedural Architecture';
  let hudSliders: HudSliderSpec[] = [];
  let togglePill: { label: string; on: boolean } | undefined;
  let finishShowcase: FinishPreset | undefined;
  let wireframeBadge = false;
  let isHeroIntro = false;
  let isFinaleOutro = false;
  let extraFlash = 0;

  switch (shotIdx) {
    // -----------------------------------------------------------------------
    // SHOT 01 (0.0s - 2.5s): VIRAL HOOK — WIREFRAME GROWTH -> ROSE COPPER SLAM
    // -----------------------------------------------------------------------
    case 0: {
      isHeroIntro = true;
      const isWire = shotTime < 1.18;
      p.wireframe = isWire;
      wireframeBadge = isWire;
      const growT = easeOutExpo(clamp01(shotTime / 1.12));
      p.verticalLevels = Math.round(lerp(2, 10, growT));
      p.totalHeight = lerp(8, 30, growT);
      p.radialBays = 8;
      p.lightingMood = 'golden';
      p.sunElevationDeg = 22;
      p.sunAzimuthDeg = lerp(35, 52, sp);

      if (shotTime >= 1.18 && shotTime < 1.38) {
        extraFlash = (1 - (shotTime - 1.18) / 0.2) * 0.48;
      }

      const camT = easeOutQuint(sp);
      cameraPos = lerp3([-14, 42, 102], [14, 33, 78], camT);
      cameraTarget = lerp3([0, 11, 0], [0, 15.8, 0], camT);
      cameraFov = lerp(44, 39, camT);

      eyebrow = isWire ? 'PROCEDURAL TOPOLOGY · LIVE ENGINE' : 'BLENDER GEOMETRY NODES × THREE.JS';
      headline = 'THE VESSEL';
      subline = 'Zero Baked Meshes · 32 Live Architectural Parameters';
      hudSliders = [
        {
          label: 'VERTICAL LEVELS',
          valueText: `${p.verticalLevels} lvls`,
          progress: (p.verticalLevels - 2) / 18,
          accent: true,
        },
        {
          label: 'TOTAL HEIGHT',
          valueText: `${p.totalHeight.toFixed(1)} m`,
          progress: (p.totalHeight - 6) / 84,
        },
      ];
      break;
    }

    // -----------------------------------------------------------------------
    // SHOT 02 (2.5s - 5.0s): RADIAL SYMMETRY MORPH (4 -> 12 BAYS LIVE!)
    // -----------------------------------------------------------------------
    case 1: {
      const baySteps = [4, 5, 6, 8, 10, 12, 8];
      const stepIdx = Math.min(baySteps.length - 1, Math.floor(sp * baySteps.length));
      p.radialBays = baySteps[stepIdx];
      p.verticalLevels = 10;
      p.lightingMood = 'golden';
      p.sunAzimuthDeg = lerp(52, 68, sp);

      const angle = lerp(-0.42, 0.38, easeInOutCubic(sp));
      const rCam = 84;
      cameraPos = [Math.sin(angle) * rCam, lerp(44, 38, sp), Math.cos(angle) * rCam];
      cameraTarget = [0, 15.2, 0];
      cameraFov = 39;

      eyebrow = '02 / PARAMETRIC SYMMETRY';
      headline = `${p.radialBays}-FOLD LATTICE`;
      subline = 'Aligned polygonal plinth & honeycomb rebuild in real time';
      hudSliders = [
        {
          label: 'RADIAL BAYS',
          valueText: `${p.radialBays} bays`,
          progress: (p.radialBays - 3) / 21,
          accent: true,
        },
        {
          label: 'BASE POLYGON',
          valueText: `${p.radialBays}-gon`,
          progress: (p.radialBays - 3) / 21,
        },
      ];
      break;
    }

    // -----------------------------------------------------------------------
    // SHOT 03 (5.0s - 7.5s): MACRO STAIR DETAIL CLOSE-UP (STUDIO CRISP!)
    // -----------------------------------------------------------------------
    case 2: {
      p.lightingMood = 'studio';
      p.sunElevationDeg = 38;
      p.sunAzimuthDeg = 42;
      // Scrub Steps Per Flight 4 -> 24 -> 14 smoothly!
      const sCurve =
        sp < 0.65
          ? lerp(4, 24, easeInOutCubic(sp / 0.65))
          : lerp(24, 14, easeInOutCubic((sp - 0.65) / 0.35));
      p.stepsPerFlight = Math.round(sCurve);
      p.stepNosing = lerp(0.0, 0.075, Math.sin(sp * Math.PI));

      cameraPos = lerp3([11.2, 22.0, 26.2], [16.8, 19.8, 22.8], easeInOutCubic(sp));
      cameraTarget = lerp3([3.4, 16.8, 13.8], [4.6, 16.0, 12.8], easeInOutCubic(sp));
      cameraFov = 36;

      eyebrow = '03 / ARCHITECTURAL DETAIL';
      headline = 'LEVEL 3D TREADS';
      subline = 'Concrete treads, recessed steel risers, glass & bronze rails';
      hudSliders = [
        {
          label: 'STEPS / FLIGHT',
          valueText: `${p.stepsPerFlight}`,
          progress: (p.stepsPerFlight - 3) / 27,
          accent: true,
        },
        {
          label: 'STEP NOSING',
          valueText: `${(p.stepNosing * 100).toFixed(1)} cm`,
          progress: p.stepNosing / 0.1,
        },
      ];
      break;
    }

    // -----------------------------------------------------------------------
    // SHOT 04 (7.5s - 10.0s): DOUBLE-TRACK SPLIT ARCHITECTURE
    // -----------------------------------------------------------------------
    case 3: {
      p.lightingMood = 'golden';
      p.sunElevationDeg = 24;
      p.sunAzimuthDeg = 55;
      p.doubleTrackSplit = easeInOutCubic(clamp01((sp - 0.08) / 0.62));
      p.walkwayWidth =
        sp < 0.6
          ? lerp(2.2, 3.9, easeInOutCubic(sp / 0.6))
          : lerp(3.9, 3.2, easeInOutCubic((sp - 0.6) / 0.4));
      p.flightGap = lerp(0.0, 0.28, p.doubleTrackSplit);

      cameraPos = lerp3([-14, 28, 42], [10, 26, 40], easeInOutCubic(sp));
      cameraTarget = lerp3([0, 18.5, 14.5], [0, 18.0, 15.0], easeInOutCubic(sp));
      cameraFov = 38;

      eyebrow = '04 / HEATHERWICK GEOMETRY';
      headline = 'DOUBLE-TRACK SPLIT';
      subline = 'Up & down flights separate radially for infinite open headroom';
      hudSliders = [
        {
          label: 'DOUBLE-TRACK SPLIT',
          valueText: `${Math.round(p.doubleTrackSplit * 100)}%`,
          progress: p.doubleTrackSplit,
          accent: true,
        },
        {
          label: 'WALKWAY WIDTH',
          valueText: `${p.walkwayWidth.toFixed(1)} m`,
          progress: (p.walkwayWidth - 1.0) / 5.5,
        },
      ];
      break;
    }

    // -----------------------------------------------------------------------
    // SHOT 05 (10.0s - 12.5s): SCULPTURAL SILHOUETTE LAB
    // -----------------------------------------------------------------------
    case 4: {
      p.lightingMood = 'golden';
      p.sunElevationDeg = 22;
      p.sunAzimuthDeg = lerp(45, 72, sp);
      // Goblet -> Hourglass Trumpet -> Iconic Vessel
      if (sp < 0.45) {
        const k = easeInOutCubic(sp / 0.45);
        p.profilePower = lerp(0.42, 1.95, k);
        p.profileBulge = lerp(5.2, -4.8, k);
      } else {
        const k = easeInOutCubic((sp - 0.45) / 0.55);
        p.profilePower = lerp(1.95, 0.9, k);
        p.profileBulge = lerp(-4.8, 0.8, k);
      }

      const ang = lerp(0.45, -0.35, easeInOutCubic(sp));
      cameraPos = [Math.sin(ang) * 86, lerp(28, 34, sp), Math.cos(ang) * 86];
      cameraTarget = [0, 15.5, 0];
      cameraFov = 40;

      eyebrow = '05 / FORM-FINDING CURVE';
      headline = 'SCULPTURAL PROFILE';
      subline = 'Morph live from convex goblet to concave hourglass & trumpet';
      hudSliders = [
        {
          label: 'PROFILE POWER',
          valueText: p.profilePower.toFixed(2),
          progress: (p.profilePower - 0.35) / 2.05,
          accent: true,
        },
        {
          label: 'PROFILE BULGE',
          valueText: `${p.profileBulge >= 0 ? '+' : ''}${p.profileBulge.toFixed(1)} m`,
          progress: (p.profileBulge + 8) / 20,
        },
      ];
      break;
    }

    // -----------------------------------------------------------------------
    // SHOT 06 (12.5s - 15.0s): INSIDE ATRIUM OCULUS — CHISELED COPPER HULLS
    // -----------------------------------------------------------------------
    case 5: {
      p.lightingMood = 'golden';
      p.sunElevationDeg = 28;
      p.sunAzimuthDeg = 40;
      p.soffitTaper = easeInOutCubic(clamp01(sp / 0.72)) * 0.47;
      p.soffitDepth =
        sp < 0.68
          ? lerp(0.18, 1.45, easeInOutCubic(sp / 0.68))
          : lerp(1.45, 0.72, easeInOutCubic((sp - 0.68) / 0.32));
      p.showStructuralRibs = sp > 0.25;

      const spin = sp * 0.65;
      cameraPos = [Math.cos(spin) * 0.4, lerp(2.1, 3.4, sp), Math.sin(spin) * 0.4];
      cameraTarget = [Math.cos(spin + 1.2) * 2.2, 36.0, Math.sin(spin + 1.2) * 2.2];
      cameraFov = lerp(74, 82, easeInOutCubic(sp));

      eyebrow = '06 / INTERIOR ATRIUM OCULUS';
      headline = 'CHISELED COPPER HULLS';
      subline = '3-faceted reflective boat-hull soffits + dark steel collar ribs';
      hudSliders = [
        {
          label: 'SOFFIT TAPER',
          valueText: `${Math.round(p.soffitTaper * 100)}%`,
          progress: p.soffitTaper / 0.49,
          accent: true,
        },
        {
          label: 'SOFFIT DEPTH',
          valueText: `${p.soffitDepth.toFixed(2)} m`,
          progress: (p.soffitDepth - 0.06) / 2.14,
        },
      ];
      break;
    }

    // -----------------------------------------------------------------------
    // SHOT 07 (15.0s - 17.5s): HELICAL SPIRAL TWIST (12x12, 4,032 STEPS!)
    // -----------------------------------------------------------------------
    case 6: {
      p.lightingMood = 'golden';
      p.radialBays = 12;
      p.verticalLevels = 12;
      p.totalHeight = 36.0;
      p.baseRadius = 8.2;
      p.topRadius = 21.5;
      p.profilePower = 1.22;
      p.profileBulge = -1.4;
      p.walkwayWidth = 3.0;
      p.stepsPerFlight = 14;
      p.spiralTwistDeg =
        sp < 0.72
          ? lerp(0, 92, easeInOutCubic(sp / 0.72))
          : lerp(92, 40, easeInOutCubic((sp - 0.72) / 0.28));

      const ang = lerp(-0.15, 0.42, easeInOutCubic(sp));
      cameraPos = [Math.sin(ang) * 92, lerp(26, 40, sp), Math.cos(ang) * 92];
      cameraTarget = [0, 18.5, 0];
      cameraFov = 40;

      eyebrow = '07 / HELICAL TORSION';
      headline = 'SPIRAL TWIST ENGINE';
      subline = '12 bays × 12 levels · 4,032 live steps twisting seamlessly';
      hudSliders = [
        {
          label: 'SPIRAL TWIST',
          valueText: `${Math.round(p.spiralTwistDeg)}°`,
          progress: (p.spiralTwistDeg + 180) / 360,
          accent: true,
        },
        {
          label: 'ACTIVE STEPS',
          valueText: '4,032',
          progress: 0.86,
        },
      ];
      break;
    }

    // -----------------------------------------------------------------------
    // SHOT 08 (17.5s - 20.0s): 360° SKYWALK CROWN LOCK (HIGH ISOMETRIC NOON)
    // -----------------------------------------------------------------------
    case 7: {
      p.lightingMood = 'noon';
      p.sunElevationDeg = 54;
      p.sunAzimuthDeg = 42;
      p.radialBays = 12;
      p.verticalLevels = 12;
      p.totalHeight = 36.0;
      p.baseRadius = 8.2;
      p.topRadius = 21.5;
      p.profilePower = 1.22;
      p.profileBulge = -1.4;
      p.walkwayWidth = 3.0;
      p.spiralTwistDeg = 40;
      p.closeTopRim = shotTime >= 0.78;
      if (shotTime >= 0.78 && shotTime < 0.96) {
        extraFlash = (1 - (shotTime - 0.78) / 0.18) * 0.35;
      }

      const ang = lerp(0.75, 1.3, easeInOutCubic(sp));
      const rCam = 86;
      cameraPos = [Math.sin(ang) * rCam, lerp(64, 54, sp), Math.cos(ang) * rCam];
      cameraTarget = [0, 18.0, 0];
      cameraFov = 39;

      eyebrow = '08 / SUMMIT OBSERVATION DECK';
      headline = '360° SKYWALK CROWN';
      subline = 'One boolean toggle bridges every summit landing into a continuous ring';
      togglePill = { label: 'CLOSE TOP RIM', on: p.closeTopRim };
      break;
    }

    // -----------------------------------------------------------------------
    // SHOT 09 (20.0s - 22.5s): RAPID ALLOY SHOWCASE (4 FINISHES ON THE BEAT!)
    // -----------------------------------------------------------------------
    case 8: {
      const alloys: { finish: FinishPreset; name: string; mood: 'golden' | 'noon' }[] = [
        { finish: 'roseCopper', name: 'ROSE COPPER', mood: 'golden' },
        { finish: 'champagneGold', name: 'CHAMPAGNE GOLD', mood: 'golden' },
        { finish: 'titanium', name: 'BRUSHED TITANIUM', mood: 'noon' },
        { finish: 'obsidian', name: 'OBSIDIAN & GOLD', mood: 'golden' },
      ];
      const idx = Math.min(3, Math.floor(sp * 4));
      const cur = alloys[idx];
      p.finishPreset = cur.finish;
      p.lightingMood = cur.mood;
      p.sunElevationDeg = cur.mood === 'noon' ? 50 : 24;
      p.sunAzimuthDeg = 48;
      finishShowcase = cur.finish;

      // Subtle beat flash on alloy change
      const subT = (sp * 4) % 1;
      if (subT < 0.14 && idx > 0) extraFlash = (1 - subT / 0.14) * 0.22;

      const ang = lerp(0.35, -0.35, easeInOutCubic(sp));
      cameraPos = [Math.sin(ang) * 74, lerp(30, 34, sp), Math.cos(ang) * 74];
      cameraTarget = [0, 15.8, 0];
      cameraFov = 38;

      eyebrow = '09 / PROCEDURAL PBR ALLOYS';
      headline = cur.name;
      subline = 'Live procedural metallic panel seams, brushed grain & HDR reflections';
      break;
    }

    // -----------------------------------------------------------------------
    // SHOT 10 (22.5s - 25.2s): GOLDEN HOUR -> BLUE HOUR SUNSET TIME-LAPSE
    // -----------------------------------------------------------------------
    case 9: {
      p.finishPreset = 'roseCopper';
      const isDusk = sp >= 0.44;
      p.lightingMood = isDusk ? 'blueHour' : 'golden';
      p.sunElevationDeg = isDusk
        ? lerp(4.0, 2.0, (sp - 0.44) / 0.56)
        : lerp(26.0, 5.0, sp / 0.44);
      p.sunAzimuthDeg = lerp(52, 24, sp);

      if (sp >= 0.44 && sp < 0.51) {
        extraFlash = (1 - (sp - 0.44) / 0.07) * 0.25;
      }

      cameraPos = lerp3([24, 3.8, 78], [11, 5.2, 66], easeInOutCubic(sp));
      cameraTarget = lerp3([0, 16.5, 0], [0, 17.5, 0], easeInOutCubic(sp));
      cameraFov = 46;

      eyebrow = '10 / REAL-TIME ATMOSPHERE';
      headline = isDusk ? 'BLUE HOUR IGNITION' : 'MANHATTAN GOLDEN HOUR';
      subline = 'Physical sunset transition + warm architectural atrium uplights';
      hudSliders = [
        {
          label: 'SUN ELEVATION',
          valueText: `${p.sunElevationDeg.toFixed(1)}°`,
          progress: (p.sunElevationDeg - 2) / 76,
          accent: true,
        },
        {
          label: 'ATRIUM UPLIGHTS',
          valueText: isDusk ? 'IGNITED' : 'AMBIENT',
          progress: isDusk ? 1.0 : 0.2,
        },
      ];
      break;
    }

    // -----------------------------------------------------------------------
    // SHOT 11 (25.2s - 27.6s): NIGHT OCULUS KALEIDOSCOPE (LANDING RATIO BREATHE)
    // -----------------------------------------------------------------------
    case 10: {
      p.lightingMood = 'blueHour';
      p.sunElevationDeg = 2.5;
      p.sunAzimuthDeg = 20;
      // Hypnotic iris breathing!
      p.landingRatio = 0.25 + Math.sin(sp * Math.PI * 2) * 0.13;

      const spin = sp * 1.1;
      cameraPos = [Math.cos(spin) * 0.3, 2.3, Math.sin(spin) * 0.3];
      cameraTarget = [Math.cos(spin + 1.5) * 1.8, 36, Math.sin(spin + 1.5) * 1.8];
      cameraFov = lerp(78, 84, Math.sin(sp * Math.PI));

      eyebrow = '11 / LIVING HONEYCOMB IRIS';
      headline = '6 DRAW CALLS · 60 FPS';
      subline = 'Batched Float32Array geometry kernel updates 116K tris in real time';
      hudSliders = [
        {
          label: 'LANDING RATIO',
          valueText: `${Math.round(p.landingRatio * 100)}%`,
          progress: (p.landingRatio - 0.08) / 0.36,
          accent: true,
        },
      ];
      break;
    }

    // -----------------------------------------------------------------------
    // SHOT 12 (27.6s - 30.0s): FULL LIVE INTERACTIVE UI SHOWCASE!
    // -----------------------------------------------------------------------
    case 11: {
      showFullUI = true;
      p.lightingMood = 'golden';
      p.sunElevationDeg = 22;
      p.sunAzimuthDeg = 48;
      // Live height & level growth right inside the full real UI!
      const riseT = easeInOutCubic(sp);
      p.verticalLevels = Math.round(lerp(8, 14, riseT));
      p.totalHeight = lerp(24, 42, riseT);
      p.topRadius = lerp(19.5, 23.0, riseT);
      p.wireframe = sp >= 0.42 && sp <= 0.56;
      wireframeBadge = p.wireframe;

      const ang = lerp(-0.18, 0.22, riseT);
      cameraPos = [Math.sin(ang) * 96, lerp(34, 44, riseT), Math.cos(ang) * 96];
      cameraTarget = [0, lerp(14, 21, riseT), 0];
      cameraFov = 40;

      eyebrow = '12 / LIVE INTERACTIVE STUDIO';
      headline = 'TOTAL REAL-TIME CONTROL';
      subline = 'React 19 · TypeScript · Three.js 0.187 · Instant .GLB Export';
      break;
    }

    // -----------------------------------------------------------------------
    // SHOT 13 (30.0s - 32.0s): VIRAL FINALE & OUTRO CARD
    // -----------------------------------------------------------------------
    case 12:
    default: {
      isFinaleOutro = true;
      p.lightingMood = 'blueHour';
      p.sunElevationDeg = 3.2;
      p.sunAzimuthDeg = 38;
      p.radialBays = 8;
      p.verticalLevels = 10;
      p.totalHeight = 30.0;
      p.finishPreset = 'roseCopper';

      const t = easeOutQuint(sp);
      cameraPos = lerp3([-14, 33, 84], [16, 37, 94], t);
      cameraTarget = [0, 10.5, 0];
      cameraFov = lerp(39, 41, t);

      eyebrow = 'HUDSON YARDS · PROCEDURAL ARCHITECTURE';
      headline = 'THE VESSEL';
      subline = 'Blender 5.1 Geometry Nodes  ×  Three.js Live Showcase';
      break;
    }
  }

  return {
    frame,
    timeSec,
    progress,
    shotIndex: shotIdx + 1,
    shotCount: 13,
    shotTime,
    shotProgress: sp,
    params: p,
    cameraPos,
    cameraTarget,
    cameraFov,
    showFullUI,
    eyebrow,
    headline,
    subline,
    hudSliders,
    togglePill,
    finishShowcase,
    wireframeBadge,
    isHeroIntro,
    isFinaleOutro,
    cutFlash: Math.min(1, cutFlash + extraFlash),
    beatPulse,
  };
}
