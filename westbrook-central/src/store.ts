import { create } from 'zustand'

export type TimeOfDay = 'day' | 'overcast' | 'dusk' | 'night'
export type CameraPresetId =
  | 'arrival'
  | 'under-canopy'
  | 'inside-train'
  | 'train-side'
  | 'signage'
  | 'track-level'
  | 'drone'

export interface CameraPreset {
  id: CameraPresetId
  label: string
  pos: [number, number, number]
  target: [number, number, number]
  note?: string
}

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'arrival', label: 'Arrival', pos: [41.6, 1.56, -0.65], target: [6, 1.6, 3.2] },
  { id: 'under-canopy', label: 'Under canopy', pos: [-5, 1.58, -1.9], target: [-42, 1.95, 1.4] },
  { id: 'inside-train', label: 'Inside train', pos: [-3.4, 1.38, 6.5], target: [12, 1.28, 6.5] },
  { id: 'train-side', label: 'Train side', pos: [18, 1.52, 1.85], target: [-6, 1.62, 6.2] },
  { id: 'signage', label: 'Signage', pos: [32, 1.6, 1.8], target: [12, 2.35, -0.2] },
  { id: 'track-level', label: 'Track level', pos: [-30, -0.6, -6.5], target: [30, 0.2, -6.5], note: 'violates CAM-02' },
  { id: 'drone', label: 'Drone', pos: [-60, 14, 26], target: [0, 0, 0], note: 'violates CAM-01' },
]

export interface SceneSettings {
  timeOfDay: TimeOfDay
  wet: boolean
  train: boolean
  fogDensity: number
  bloom: boolean
  shadows: boolean
  rain: boolean
  cameraPreset: CameraPresetId
}

export type TrainScheduleState = 'at_station' | 'departing' | 'in_transit' | 'arriving'

export interface AuditCheck {
  ruleId: string
  label: string
  pass: boolean
  measured: string
}

export interface AuditResult {
  at: number
  checks: AuditCheck[]
  stats: { drawCalls: number; triangles: number; textures: number; lights: number; cameraY: number }
}

export interface ReviewRound {
  n: number
  at: number
  verdict: 'APPROVED' | 'REVISE'
  failures: string[]
  notes: string
  settings: SceneSettings
}

export interface LiveStats {
  fps: number
  drawCalls: number
  triangles: number
}

interface Store {
  settings: SceneSettings
  setSettings: (p: Partial<SceneSettings>) => void

  // train operations
  trainState: TrainScheduleState
  trainSpeedKmh: number
  trainDwellRemaining: number
  trainHold: boolean
  trainManualTrigger: 'depart' | 'arrive' | null
  setTrainHold: (hold: boolean) => void
  triggerDepart: () => void
  triggerArrive: () => void
  clearTrainTrigger: () => void
  updateTrainStatus: (state: TrainScheduleState, speed: number, dwell: number) => void

  live: LiveStats
  setLive: (s: LiveStats) => void

  canvas: HTMLCanvasElement | null
  setCanvas: (c: HTMLCanvasElement | null) => void
  capturedAt: number | null
  triggerCapture: () => void

  // bridge from the canvas
  auditRunner: (() => AuditResult) | null
  setAuditRunner: (fn: (() => AuditResult) | null) => void

  audit: AuditResult | null
  runAudit: () => void

  manual: Record<string, boolean>
  toggleManual: (id: string) => void
  notes: string
  setNotes: (s: string) => void

  rounds: ReviewRound[]
  closeRound: (manualIds: string[]) => void
  clearRounds: () => void
}

const LS_KEY = 'station-review-rounds-v1'

function loadRounds(): ReviewRound[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as ReviewRound[]) : []
  } catch {
    return []
  }
}

export const useStore = create<Store>((set, get) => ({
  settings: {
    timeOfDay: 'dusk',
    wet: true,
    train: true,
    fogDensity: 0.0042,
    bloom: true,
    shadows: true,
    rain: false,
    cameraPreset: 'arrival',
  },
  setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

  // train state
  trainState: 'at_station',
  trainSpeedKmh: 0,
  trainDwellRemaining: 12,
  trainHold: false,
  trainManualTrigger: null,
  setTrainHold: (trainHold) => set({ trainHold }),
  triggerDepart: () => set({ trainManualTrigger: 'depart' }),
  triggerArrive: () => set({ trainManualTrigger: 'arrive' }),
  clearTrainTrigger: () => set({ trainManualTrigger: null }),
  updateTrainStatus: (trainState, trainSpeedKmh, trainDwellRemaining) =>
    set({ trainState, trainSpeedKmh, trainDwellRemaining }),

  live: { fps: 0, drawCalls: 0, triangles: 0 },
  setLive: (live) => set({ live }),

  canvas: null,
  setCanvas: (canvas) => set({ canvas }),
  capturedAt: null,
  triggerCapture: () => {
    const { canvas } = get()
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `westbrook-central-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`
    a.click()
    set({ capturedAt: Date.now() })
  },

  auditRunner: null,
  setAuditRunner: (fn) => set({ auditRunner: fn }),

  audit: null,
  runAudit: () => {
    const fn = get().auditRunner
    if (fn) set({ audit: fn() })
  },

  manual: {},
  toggleManual: (id) => set((s) => ({ manual: { ...s.manual, [id]: !s.manual[id] } })),
  notes: '',
  setNotes: (notes) => set({ notes }),

  rounds: loadRounds(),
  closeRound: (manualIds) => {
    const { audit, manual, notes, rounds, settings } = get()
    const failures: string[] = []
    if (!audit) failures.push('AUDIT: not run')
    else audit.checks.filter((c) => !c.pass).forEach((c) => failures.push(`${c.ruleId}: ${c.measured}`))
    manualIds.filter((id) => !manual[id]).forEach((id) => failures.push(`${id}: not signed off`))
    const round: ReviewRound = {
      n: rounds.length + 1,
      at: Date.now(),
      verdict: failures.length === 0 ? 'APPROVED' : 'REVISE',
      failures,
      notes,
      settings: { ...settings },
    }
    const next = [round, ...rounds]
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    set({ rounds: next, manual: {}, notes: '', audit: null })
  },
  clearRounds: () => {
    localStorage.removeItem(LS_KEY)
    set({ rounds: [] })
  },
}))
