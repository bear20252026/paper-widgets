import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sky, Stars, Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Station } from './Station'
import { useStore, CAMERA_PRESETS, type TimeOfDay, type AuditResult, type AuditCheck } from '../store'

/* ------------------------------------------------------------------ */
/*  Time-of-day presets                                                */
/* ------------------------------------------------------------------ */
interface Atmo {
  el: number
  az: number
  sunI: number
  sunColor: string
  hemiSky: string
  hemiGround: string
  hemiI: number
  fog: string
  turbidity: number
  rayleigh: number
  mie: number
  mieG: number
  lamp: number
  pointI: number
  envSky: string
  envGround: string
  envWarm: string
  envI: number
  exposure: number
  stars: boolean
  fillI: number
}

const ATMO: Record<TimeOfDay, Atmo> = {
  day: {
    el: 38, az: 128, sunI: 2.8, sunColor: '#fff2dc', hemiSky: '#a8c8ec', hemiGround: '#5c5852', hemiI: 0.82,
    fog: '#c6d5e4', turbidity: 2.8, rayleigh: 1.15, mie: 0.004, mieG: 0.82, lamp: 0.65, pointI: 0,
    envSky: '#c6dcf4', envGround: '#605d58', envWarm: '#fff2dc', envI: 0.88, exposure: 0.94, stars: false, fillI: 0.35,
  },
  overcast: {
    el: 42, az: 155, sunI: 0.85, sunColor: '#eef2f7', hemiSky: '#c8d0da', hemiGround: '#505256', hemiI: 1.38,
    fog: '#b8c1cb', turbidity: 16, rayleigh: 0.32, mie: 0.04, mieG: 0.9, lamp: 1.9, pointI: 6,
    envSky: '#d0d6de', envGround: '#54565a', envWarm: '#efe8dd', envI: 1.0, exposure: 0.94, stars: false, fillI: 0.25,
  },
  dusk: {
    el: 10, az: 228, sunI: 2.5, sunColor: '#ffc992', hemiSky: '#7592bd', hemiGround: '#423b35', hemiI: 0.78,
    fog: '#7e8395', turbidity: 6.0, rayleigh: 2.3, mie: 0.012, mieG: 0.85, lamp: 2.6, pointI: 11,
    envSky: '#829cc4', envGround: '#3b3735', envWarm: '#ffc288', envI: 0.94, exposure: 0.98, stars: false, fillI: 0.3,
  },
  night: {
    el: -14, az: 250, sunI: 0.32, sunColor: '#8eaadc', hemiSky: '#212e4f', hemiGround: '#141318', hemiI: 0.56,
    fog: '#0d1320', turbidity: 4, rayleigh: 0.2, mie: 0.002, mieG: 0.8, lamp: 3.8, pointI: 24,
    envSky: '#223154', envGround: '#121318', envWarm: '#ffbe7c', envI: 0.76, exposure: 1.08, stars: true, fillI: 0.25,
  },
}

function sunDir(el: number, az: number) {
  const e = THREE.MathUtils.degToRad(el)
  const a = THREE.MathUtils.degToRad(az)
  return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a))
}

function Atmosphere({ tod, fogDensity, shadows }: { tod: TimeOfDay; fogDensity: number; shadows: boolean }) {
  const a = ATMO[tod]
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.toneMappingExposure = a.exposure
  }, [gl, a.exposure])

  const skyDir = useMemo(() => sunDir(a.el, a.az), [a.el, a.az])
  const moonDir = useMemo(() => sunDir(52, 40), [])
  const lightDir = tod === 'night' ? moonDir : skyDir
  const lightPos = useMemo(() => [lightDir.x * 110, Math.max(lightDir.y, 0.05) * 110, lightDir.z * 110] as [number, number, number], [lightDir])

  return (
    <>
      <fogExp2 attach="fog" args={[a.fog, fogDensity]} />
      <group userData={{ auditIgnore: true }} name="sky-dome">
        <Sky distance={450000} sunPosition={[skyDir.x * 1000, skyDir.y * 1000, skyDir.z * 1000]} turbidity={a.turbidity} rayleigh={a.rayleigh} mieCoefficient={a.mie} mieDirectionalG={a.mieG} />
        {a.stars && <Stars radius={280} depth={80} count={2600} factor={4.5} fade speed={0.25} />}
      </group>
      <hemisphereLight args={[a.hemiSky, a.hemiGround, a.hemiI + 0.18]} />
      <directionalLight
        name="sun"
        position={lightPos}
        intensity={a.sunI}
        color={a.sunColor}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.065}
        shadow-radius={3.5}
        shadow-camera-left={-72}
        shadow-camera-right={72}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
        shadow-camera-near={10}
        shadow-camera-far={260}
      />
      {a.pointI > 0 &&
        [-22, -8, 6, 20, 34].map((x) => (
          <pointLight key={x} name="lamp-light" position={[x, 4.2, 0]} intensity={a.pointI} color="#ffdfb8" decay={1.7} distance={32} />
        ))}
      <Environment key={tod} frames={1} resolution={256} background={false} environmentIntensity={a.envI}>
        <mesh userData={{ auditIgnore: true }}>
          <sphereGeometry args={[42, 32, 20]} />
          <meshBasicMaterial color={a.envSky} side={THREE.BackSide} />
        </mesh>
        {/* Smooth overhead vaulted sky + gentle soft warm sunset glow wrap for silky clearcoat curves */}
        <Lightformer form="ring" intensity={1.35} color={a.envSky} position={[0, 16, 0]} rotation-x={Math.PI / 2} scale={[56, 56, 1]} />
        <Lightformer form="circle" intensity={3.8} color={a.envWarm} position={[skyDir.x * 26, Math.max(skyDir.y, 0.08) * 26, skyDir.z * 26]} scale={[16, 16, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.9} color={a.envWarm} position={[0, 4.5, -24]} scale={[60, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.8} color={a.envSky} position={[0, 5, 24]} scale={[60, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.6} color={a.envWarm} position={[0, 3.8, 0]} rotation-x={Math.PI / 2} scale={[44, 1.8, 1]} />
        <Lightformer form="rect" intensity={0.9} color={a.envGround} position={[0, -8, 0]} rotation-x={-Math.PI / 2} scale={[70, 70, 1]} />
      </Environment>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Weather: dust & rain                                               */
/* ------------------------------------------------------------------ */
function spriteTexture(kind: 'dot' | 'streak') {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')!
  if (kind === 'dot') {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.4)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, 64)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.45, 'rgba(255,255,255,0.9)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(30, 0, 3, 64)
    ctx.filter = 'blur(1px)'
    ctx.fillRect(28, 0, 8, 64)
    ctx.filter = 'none'
  }
  const t = new THREE.CanvasTexture(c)
  t.name = 'procedural-sprite'
  return t
}

function Dust() {
  const tex = useMemo(() => spriteTexture('dot'), [])
  const n = 360
  const { geo, mat } = useMemo(() => {
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -56 + Math.random() * 112
      pos[i * 3 + 1] = 0.3 + Math.random() * 4.2
      pos[i * 3 + 2] = -4 + Math.random() * 8
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({ size: 0.045, map: tex, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, color: '#ffe8c4' })
    return { geo, mat }
  }, [tex])
  const ref = useRef<THREE.Points>(null)
  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.03) * 0.02
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.22) * 0.12
  })
  return <points ref={ref} geometry={geo} material={mat} userData={{ auditIgnore: true }} name="dust" />
}

function Rain() {
  const tex = useMemo(() => spriteTexture('streak'), [])
  const n = 1100
  const { geo, mat, vel } = useMemo(() => {
    const pos = new Float32Array(n * 3)
    const vel = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -58 + Math.random() * 116
      pos[i * 3 + 1] = Math.random() * 9
      pos[i * 3 + 2] = -5 + Math.random() * 10
      vel[i] = 6 + Math.random() * 5
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({ size: 0.5, map: tex, transparent: true, opacity: 0.26, depthWrite: false, sizeAttenuation: true, color: '#dfe8f2', blending: THREE.AdditiveBlending })
    return { geo, mat, vel }
  }, [tex])
  const ref = useRef<THREE.Points>(null)
  useFrame((_, dt) => {
    const attr = geo.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const d = Math.min(dt, 0.05)
    for (let i = 0; i < n; i++) {
      arr[i * 3 + 1] -= vel[i] * d
      arr[i * 3] -= 1.6 * d
      if (arr[i * 3 + 1] < -1.5) {
        arr[i * 3 + 1] = 8.5
        arr[i * 3] = -58 + Math.random() * 116
      }
      if (arr[i * 3] < -60) arr[i * 3] = 58
    }
    attr.needsUpdate = true
  })
  return <points ref={ref} geometry={geo} material={mat} userData={{ auditIgnore: true }} name="rain" />
}

/* ------------------------------------------------------------------ */
/*  Camera rig                                                         */
/* ------------------------------------------------------------------ */
interface ControlsLike {
  target: THREE.Vector3
  update: () => void
}

function CameraRig() {
  const preset = useStore((s) => s.settings.cameraPreset)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; tf: THREE.Vector3; tt: THREE.Vector3; t: number } | null>(null)
  const prevTrainX = useRef<number>(0)

  useEffect(() => {
    const p = CAMERA_PRESETS.find((c) => c.id === preset)!
    const tx = (window as unknown as { __trainX?: number }).__trainX || 0
    prevTrainX.current = tx
    const offsetPos: [number, number, number] = preset === 'inside-train' ? [p.pos[0] + tx, p.pos[1], p.pos[2]] : p.pos
    const offsetTarget: [number, number, number] = preset === 'inside-train' ? [p.target[0] + tx, p.target[1], p.target[2]] : p.target
    anim.current = {
      from: camera.position.clone(),
      to: new THREE.Vector3(...offsetPos),
      tf: controls ? controls.target.clone() : new THREE.Vector3(),
      tt: new THREE.Vector3(...offsetTarget),
      t: 0,
    }
  }, [preset, camera, controls])

  useFrame((_, dt) => {
    const tx = (window as unknown as { __trainX?: number }).__trainX || 0
    const deltaTx = tx - prevTrainX.current
    prevTrainX.current = tx

    if (preset === 'inside-train' && !anim.current) {
      camera.position.x += deltaTx
      if (controls) {
        controls.target.x += deltaTx
        controls.update()
      } else {
        camera.lookAt(tx + 12, 1.35, 6.5)
      }
      return
    }

    const a = anim.current
    if (!a) return
    a.t = dt > 0.2 ? 1 : Math.min(1, a.t + dt / 0.85)
    const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2
    camera.position.lerpVectors(a.from, a.to, e)
    if (controls) {
      controls.target.lerpVectors(a.tf, a.tt, e)
      controls.update()
    } else camera.lookAt(a.tt)
    if (a.t >= 1) anim.current = null
  })
  return null
}

/* ------------------------------------------------------------------ */
/*  Audit bridge: live stats + scene-graph audit + capture canvas      */
/* ------------------------------------------------------------------ */
function luminanceSRGB(c: THREE.Color) {
  const s = c.clone().convertLinearToSRGB()
  return 0.2126 * s.r + 0.7152 * s.g + 0.0722 * s.b
}

function AuditBridge() {
  const { gl, scene, camera } = useThree()
  const setAuditRunner = useStore((s) => s.setAuditRunner)
  const setLive = useStore((s) => s.setLive)
  const setCanvas = useStore((s) => s.setCanvas)
  const frameStats = useRef({ calls: 0, tris: 0 })
  const acc = useRef({ frames: 0, time: 0 })

  useEffect(() => {
    gl.info.autoReset = false
    setCanvas(gl.domElement)
    return () => {
      gl.info.autoReset = true
      setCanvas(null)
    }
  }, [gl, setCanvas])

  useFrame((_, dt) => {
    frameStats.current = { calls: gl.info.render.calls, tris: gl.info.render.triangles }
    gl.info.reset()
    acc.current.frames++
    acc.current.time += dt
    if (acc.current.time >= 0.5) {
      setLive({ fps: Math.round(acc.current.frames / acc.current.time), drawCalls: frameStats.current.calls, triangles: frameStats.current.tris })
      acc.current = { frames: 0, time: 0 }
    }
  }, -100)

  useEffect(() => {
    const run = (): AuditResult => {
      let lights = 0
      let textureCount = 0
      const nonPBR: string[] = []
      const external: string[] = []
      const badAlbedo: string[] = []
      const seenTex = new Set<THREE.Texture>()
      const seenMat = new Set<THREE.Material>()
      const texKeys = ['map', 'emissiveMap', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap'] as const

      const walk = (o: THREE.Object3D, ignored: boolean) => {
        const ig = ignored || !!o.userData?.auditIgnore
        const anyO = o as unknown as { isLight?: boolean; isAmbientLight?: boolean; isHemisphereLight?: boolean }
        if (anyO.isLight && !anyO.isAmbientLight && !anyO.isHemisphereLight) lights++
        const mesh = o as THREE.Mesh
        if ((mesh as unknown as { isMesh?: boolean }).isMesh && !ig) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const m of mats) {
            if (!m || seenMat.has(m)) continue
            seenMat.add(m)
            const am = m as unknown as Record<string, unknown> & { isMeshStandardMaterial?: boolean; isMeshPhysicalMaterial?: boolean; color?: THREE.Color; map?: THREE.Texture | null }
            const label = o.name || o.type
            if (!am.isMeshStandardMaterial && !am.isMeshPhysicalMaterial) nonPBR.push(`${label} (${m.type})`)
            for (const k of texKeys) {
              const t = am[k] as THREE.Texture | null | undefined
              if (!t) continue
              if (!seenTex.has(t)) {
                seenTex.add(t)
                textureCount++
              }
              const img = t.image as unknown
              const isCanvas =
                (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) ||
                (typeof OffscreenCanvas !== 'undefined' && img instanceof OffscreenCanvas)
              if (img && !isCanvas) external.push(`${label}.${k}`)
            }
            if (am.color && !am.map) {
              const l = luminanceSRGB(am.color)
              if (l < 0.03 || l > 0.95) badAlbedo.push(`${label} L=${l.toFixed(2)}`)
            }
          }
        }
        for (const ch of o.children) walk(ch, ig)
      }
      walk(scene, false)

      const fog = scene.fog as THREE.FogExp2 | null
      const density = fog && 'density' in fog ? fog.density : 0
      const camY = camera.position.y
      const { calls, tris } = frameStats.current
      const short = (arr: string[]) => (arr.length ? `${arr.length}: ${arr.slice(0, 3).join(', ')}${arr.length > 3 ? '…' : ''}` : '0')

      const checks: AuditCheck[] = [
        { ruleId: 'AST-01', label: 'External textures in scene', pass: external.length === 0, measured: `${textureCount} textures, ${short(external)} external` },
        { ruleId: 'MAT-01', label: 'Non-PBR materials', pass: nonPBR.length === 0, measured: short(nonPBR) },
        { ruleId: 'MAT-02', label: 'Albedo out of range', pass: badAlbedo.length === 0, measured: short(badAlbedo) },
        { ruleId: 'LGT-01', label: 'Punctual lights ≤ 6', pass: lights <= 6, measured: `${lights} lights` },
        { ruleId: 'LGT-02', label: 'Fog density 0.003–0.014', pass: density >= 0.003 && density <= 0.014, measured: `density ${density.toFixed(4)}` },
        { ruleId: 'CAM-01', label: 'Camera 1.2–2.2 m', pass: camY >= 1.2 && camY <= 2.2, measured: `y = ${camY.toFixed(2)} m` },
        { ruleId: 'CAM-02', label: 'Camera above coping', pass: camY >= 0, measured: `y = ${camY.toFixed(2)} m` },
        { ruleId: 'PRF-01', label: 'Draw calls < 400', pass: calls < 400, measured: `${calls} calls` },
        { ruleId: 'PRF-02', label: 'Triangles < 600k', pass: tris < 600000, measured: `${(tris / 1000).toFixed(0)}k tris` },
      ]
      return { at: Date.now(), checks, stats: { drawCalls: calls, triangles: tris, textures: textureCount, lights, cameraY: camY } }
    }
    setAuditRunner(run)
    return () => setAuditRunner(null)
  }, [gl, scene, camera, setAuditRunner])

  return null
}

/* ------------------------------------------------------------------ */
/*  Scene root                                                         */
/* ------------------------------------------------------------------ */
export function Scene() {
  const settings = useStore((s) => s.settings)
  const a = ATMO[settings.timeOfDay]
  const initial = CAMERA_PRESETS.find((c) => c.id === settings.cameraPreset)!

  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: true }}
      camera={{ fov: 43, near: 0.08, far: 800, position: initial.pos }}
    >
      <Suspense fallback={null}>
        <Atmosphere tod={settings.timeOfDay} fogDensity={settings.fogDensity} shadows={settings.shadows} />
        <Station wet={settings.wet} train={settings.train} lampOn={a.lamp} />
        <Dust />
        {settings.rain && <Rain />}
      </Suspense>
      <OrbitControls makeDefault enableDamping dampingFactor={0.075} maxDistance={130} minDistance={0.5} maxPolarAngle={Math.PI * 0.6} rotateSpeed={0.45} panSpeed={0.5} />
      <CameraRig />
      <AuditBridge />
      {settings.bloom && (
        <EffectComposer multisampling={4} enableNormalPass={false}>
          <Bloom mipmapBlur intensity={0.36} luminanceThreshold={1.22} luminanceSmoothing={0.28} />
          <Vignette eskil={false} offset={0.26} darkness={0.48} />
          <Noise opacity={0.02} premultiply />
        </EffectComposer>
      )}
    </Canvas>
  )
}
