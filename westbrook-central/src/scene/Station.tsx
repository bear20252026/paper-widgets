import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import '@react-three/fiber'
import * as THREE from 'three'
import * as T from './textures'
import * as G from './geometry'
import { useStore, type TrainScheduleState } from '../store'

/* ------------------------------------------------------------------ */
/*  Real-World Constants (metres)                                      */
/* ------------------------------------------------------------------ */
export const L = 400
export const PL = 120
export const PW = 8
export const RAIL_TOP = -1.0
export const GAUGE = 1.435
export const TRACK_Z = 6.5
export const GROUND = -1.45
export const SPRING = 3.95
export const RISE = 1.28
export const HW = 4.32
export const CROWN = SPRING + RISE

const archY = (z: number) => SPRING + RISE * (1 - Math.pow(z / HW, 2))
type V3 = [number, number, number]

const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16)
const CYL_SM = new THREE.CylinderGeometry(1, 1, 1, 8)
const PLANE = new THREE.PlaneGeometry(1, 1)
const DISC = new THREE.CircleGeometry(0.5, 40)

/* ------------------------------------------------------------------ */
/*  Shared Sculpted Geometries (built once, heavily instanced)         */
/* ------------------------------------------------------------------ */
const GEO = (() => {
  const glassPanels: [number, number][] = [
    [-1.92, -1.02],
    [1.02, 1.92],
  ]
  const solidPanels: [number, number][] = [
    [-HW, -1.92],
    [-1.02, 1.02],
    [1.92, HW],
  ]
  const benchSlat = G.makeBenchSlat()
  const canopyColumn = G.makeCastIronColumn(3.86)
  return {
    // Canopy
    solidVaults: solidPanels.map(([a, b]) => G.makeVaultStrip(PL, HW, SPRING, RISE, a, b, 0)),
    glassVaults: glassPanels.map(([a, b]) => G.makeVaultStrip(PL, HW, SPRING, RISE, a, b, 0.015)),
    vaultRib: G.makeVaultRib(HW, SPRING, RISE, 0.068),
    vaultPurlin: new THREE.CylinderGeometry(0.036, 0.036, PL, 10).rotateZ(Math.PI / 2),
    canopyFascia: G.makeCanopyFascia(PL),
    column: canopyColumn,
    spandrelPos: G.makeSpandrelBracket(1),
    spandrelNeg: G.makeSpandrelBracket(-1),
    spandrelRing: G.makeSpandrelRing(0.21, 0.025),
    tieRod: G.makeTieRod(2.94, 3.84, 0.34),
    keystone: G.makeRoundedBox(0.36, 0.52, 0.24, 0.05, 0.025, 2),
    lampHousing: G.makeLinearLampHousing(),
    lampDiffuser: G.makeLinearLampDiffuser(),
    clockBezel: G.makeClockHousing(),
    clockBody: G.makeClockBody(),
    // Viaduct walls & lighting
    viaductArch: G.makeViaductArchPanel(8.0, 5.25, 3.12, 1.48),
    archivolt: G.makeStoneArchivolt(3.08, 3.42),
    cornice: G.makeCornice(L),
    swanNeck: G.makeSwanNeck(),
    lanternHood: G.makeLanternHood(),
    lanternGlobe: G.makeLanternGlobe(),
    treeCrownA: G.makeOrganicCrown(1.3),
    treeCrownB: G.makeOrganicCrown(4.7),
    // Track & platform
    coping: G.makeBullnoseCoping(PL),
    railHead: G.makeRailHead(L),
    railWeb: G.makeRailWebFoot(L),
    ballast: G.makeBallastBed(L),
    sleeper: G.makeSleeper(),
    insulator: G.makeInsulator(),
    catenarySag: G.makeCatenarySpan(40, 0.56),
    signalHood: G.makeSignalHood(),
    signalHead: G.makeRoundedBox(0.46, 1.18, 0.3, 0.19, 0.04, 3),
    // Furniture & signage
    benchFrame: G.makeBenchFrame(),
    benchArm: G.makeBenchArmrest(),
    benchSlat,
    binBody: G.makeDomedBinBody(),
    binCap: G.makeDomedBinCap(),
    planter: G.makePlanterBowl(),
    blade: G.makeArchedBlade(0.68, 0.34),
    suitcase: G.makeSuitcase(),
    suitcaseHandle: G.makeSuitcaseHandle(),
    weekender: G.makeWeekenderBag(),
    shelterGlass: G.makeShelterGlass(),
    shelterRoof: G.makeRoundedBox(3.3, 0.08, 0.72, 0.04, 0.028, 3),
    signDirFrame: G.makeRoundedBox(0.085, 0.66, 2.52, 0.06, 0.022, 3),
    signDepFrame: G.makeRoundedBox(0.11, 0.72, 2.02, 0.06, 0.024, 3),
    signInfoFrame: G.makeRoundedBox(0.1, 0.76, 1.3, 0.06, 0.022, 3),
    totemBoard: G.makeRoundedBox(2.5, 0.54, 0.075, 0.05, 0.018, 3),
    totemNum: G.makeRoundedBox(0.47, 0.47, 0.07, 0.055, 0.016, 3),
    kioskBody: G.makeRoundedBox(1.02, 1.92, 0.82, 0.08, 0.032, 3),
    helpBody: G.makeRoundedBox(0.44, 1.72, 0.32, 0.07, 0.025, 3),
    posterFrame: G.makeRoundedBox(0.96, 1.54, 0.11, 0.055, 0.02, 3),
    cabinet: G.makeRoundedBox(1.12, 1.32, 0.56, 0.06, 0.025, 3),
    // Sculpted Express Train
    cabHull: G.makeCabHull(1.62),
    cabSkirt: G.makeCabSkirt(1.62),
    trainRoof: G.makeTrainRoofShell(19.6),
    trainCeiling: G.makeTrainInnerCeiling(19.4),
    roofPod: G.makeRoofPod(),
    wheel: G.makeTrainWheel(),
    couplerHead: G.makeRoundedBox(0.32, 0.28, 0.44, 0.075, 0.03, 3),
    couplerBar: new THREE.CylinderGeometry(0.09, 0.1, 0.72, 16).rotateZ(Math.PI / 2),
    // Ergonomic contoured saloon interior
    seatCushion: G.makeSeatCushion(),
    seatBack: G.makeSeatBackrest(),
    seatHeadrest: G.makeSeatHeadrest(),
    seatArm: G.makeSeatArmrest(),
    seatLoop: G.makeSeatGrabLoop(),
    seatLeg: G.makeRoundedBox(0.2, 0.4, 0.48, 0.05, 0.018, 1),
    seatTray: G.makeRoundedBox(0.022, 0.24, 0.34, 0.035, 0.008, 1),
    handStrap: G.makeHandStrap(),
    draughtGlass: G.makeDraughtGlass(),
    luggageShelf: G.makeRoundedBox(9.8, 0.038, 0.4, 0.018, 0.012, 2),
    ledTube: G.makeRoundedBox(18.2, 0.032, 0.16, 0.014, 0.01, 2),
    ceilingRib: G.makeVaultRib(1.38, 2.66, 0.26, 0.018),
  }
})()

/* ------------------------------------------------------------------ */
/*  PBR Materials (with real Sobel tangent-space normal maps)          */
/* ------------------------------------------------------------------ */
function rep(t: THREE.Texture, x: number, y: number) {
  const c = t.clone()
  c.repeat.set(x, y)
  c.needsUpdate = true
  return c
}

export function useMaterials(wet: boolean, lampOn: number) {
  return useMemo(() => {
    const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)
    const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p)
    const v2 = (s: number) => new THREE.Vector2(s, s)

    const concNorm = rep(T.concreteNormal(), PL / 2.4, PW / 2.4)
    const brickNorm = rep(T.brickNormal(), L, 4)
    const archBrickMap = T.brick()
    const archBrickNorm = T.brickNormal()
    const tacNorm = rep(T.tactileNormal(), PL / 0.4, 1)

    return {
      // Honed dark granite/concrete station slabs with real normal depth & damp sheen patches
      platform: std({
        map: rep(T.concrete(), PL / 2.4, PW / 2.4),
        normalMap: concNorm,
        normalScale: v2(0.38),
        roughnessMap: wet ? rep(T.wetRoughness(), PL / 12, PW / 12) : null,
        roughness: wet ? 0.56 : 0.88,
        metalness: wet ? 0.04 : 0.01,
        color: wet ? '#9ba1aa' : '#ced2d8',
        envMapIntensity: wet ? 1.25 : 0.58,
      }),
      serviceStrip: std({
        map: rep(T.concrete(), PL / 2.4, 0.65),
        normalMap: rep(T.concreteNormal(), PL / 2.4, 0.65),
        normalScale: v2(0.32),
        roughnessMap: wet ? rep(T.wetRoughness(), PL / 12, 1.2) : null,
        roughness: wet ? 0.46 : 0.85,
        metalness: wet ? 0.05 : 0.01,
        color: wet ? '#848a94' : '#aeb3ba',
        envMapIntensity: wet ? 1.28 : 0.58,
      }),
      coping: std({
        map: rep(T.dressedStone(), PL / 3.0, 0.35),
        normalMap: rep(T.concreteNormal(), PL / 2.4, 0.25),
        normalScale: v2(0.4),
        roughness: wet ? 0.44 : 0.84,
        color: wet ? '#bcb8ae' : '#d8d4ca',
        envMapIntensity: wet ? 1.1 : 0.55,
      }),
      platformSide: std({
        map: rep(T.concrete(), PL / 2.4, 0.4),
        color: '#5b5d61',
        roughness: 0.94,
      }),
      contactAO: std({
        map: T.contactAO(),
        transparent: true,
        depthWrite: false,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
      tactile: std({
        map: rep(T.tactile(), PL / 0.4, 1),
        normalMap: tacNorm,
        normalScale: v2(0.85),
        roughness: wet ? 0.42 : 0.72,
        envMapIntensity: wet ? 1.0 : 0.45,
      }),
      yellowLine: std({ color: '#d8b43c', roughness: wet ? 0.38 : 0.58, envMapIntensity: wet ? 1.0 : 0.45 }),
      whiteLine: std({ color: '#c8c6be', roughness: 0.62 }),
      ballast: std({ map: T.ballast(), roughness: 0.96 }),
      sleeper: std({ map: rep(T.dressedStone(), 1, 0.2), color: '#7e7c76', roughness: 0.93 }),
      railHead: std({ color: '#9c9fa4', roughness: 0.22, metalness: 0.96, envMapIntensity: 1.6 }),
      railWeb: std({ map: rep(T.rust(), L / 2, 1), roughness: 0.88, metalness: 0.32 }),
      // Heritage coated architectural cast-iron (deep satin charcoal-teal-slate)
      castIron: phys({
        color: '#2c3742',
        roughness: 0.44,
        metalness: 0.52,
        clearcoat: 0.22,
        clearcoatRoughness: 0.38,
        envMapIntensity: 1.15,
      }),
      steel: std({ map: rep(T.paintedSteel('#34414d'), 1, 1), roughness: 0.48, metalness: 0.42, envMapIntensity: 1.05 }),
      steelWarm: std({ color: '#4c5258', roughness: 0.48, metalness: 0.45, envMapIntensity: 1.0 }),
      steelLight: std({ color: '#b4b8be', roughness: 0.38, metalness: 0.52, envMapIntensity: 1.15 }),
      brushedSteel: phys({
        color: '#bcc1c8',
        roughness: 0.28,
        metalness: 0.86,
        clearcoat: 0.15,
        clearcoatRoughness: 0.25,
        envMapIntensity: 1.4,
      }),
      brass: std({ color: '#c8a45c', roughness: 0.32, metalness: 0.82, envMapIntensity: 1.25 }),
      oak: phys({
        map: T.oakWood(),
        roughness: 0.46,
        metalness: 0.0,
        clearcoat: 0.28,
        clearcoatRoughness: 0.34,
        color: '#d8c2a6',
        envMapIntensity: 0.9,
      }),
      soffit: std({
        map: rep(T.soffitPanels(), PL / 1.4, 2.2),
        color: '#d4cfc4',
        roughness: 0.56,
        metalness: 0.18,
        side: THREE.DoubleSide,
      }),
      roofTop: std({ color: '#333840', roughness: 0.78, metalness: 0.3 }),
      glassRoof: phys({
        color: '#b4cbd8',
        roughness: 0.08,
        metalness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        transparent: true,
        opacity: 0.34,
        envMapIntensity: 1.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      brick: std({
        map: rep(T.brick(), L / 2.2, 1.4),
        normalMap: brickNorm,
        normalScale: v2(0.7),
        roughness: 0.9,
        color: '#cfbfb2',
      }),
      archBrick: std({
        map: archBrickMap,
        normalMap: archBrickNorm,
        normalScale: v2(0.72),
        roughness: 0.88,
        color: '#d8c7b8',
      }),
      stone: std({
        map: T.dressedStone(),
        roughness: 0.86,
        color: '#c2b9aa',
      }),
      planterStone: std({
        map: T.dressedStone(),
        roughness: 0.78,
        color: '#9b968e',
      }),
      soil: std({ color: '#2f2924', roughness: 0.98 }),
      foliageSoft: std({ color: '#3d5438', roughness: 0.72, side: THREE.DoubleSide }),
      foliageTip: std({ color: '#6b7548', roughness: 0.68, side: THREE.DoubleSide }),
      foliageWarm: std({ map: T.treeFoliageMap(551, true), roughness: 0.92 }),
      foliageDeep: std({ map: T.treeFoliageMap(559, false), roughness: 0.94 }),
      asphalt: std({ map: rep(T.asphalt(), L / 2, 30), roughness: 0.96 }),
      ground: std({ color: '#3c433a', roughness: 0.98 }),
      building: std({
        map: T.facadeMap(),
        emissiveMap: T.facadeEmissive(),
        emissive: '#ffd59c',
        emissiveIntensity: Math.min(0.18 + lampOn * 0.16, 0.95),
        roughness: 0.86,
        color: '#c6cad0',
      }),
      skyline: std({ color: '#424a56', roughness: 0.92 }),
      darkMetal: std({ color: '#272b32', roughness: 0.48, metalness: 0.62, envMapIntensity: 1.0 }),
      glass: phys({
        color: '#203240',
        roughness: 0.05,
        metalness: 0.08,
        transparent: true,
        opacity: 0.42,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        envMapIntensity: 1.9,
        depthWrite: false,
      }),
      // Soft glowing architectural lamps & warm heritage globes
      lamp: std({ color: '#e6e2d8', emissive: '#ffeed2', emissiveIntensity: Math.max(0.6, lampOn * 0.72), roughness: 0.35 }),
      globeLamp: std({ color: '#ebe2cf', emissive: '#ffcf8c', emissiveIntensity: Math.max(0.7, lampOn * 0.95), roughness: 0.28 }),
      lampHousing: std({ color: '#40464e', roughness: 0.42, metalness: 0.55 }),
      // Crisp real-world railway signage
      hangingSign: std({ map: T.hangingSign(), roughness: 0.36 }),
      nameBoard: std({ map: T.nameBoard(), roughness: 0.36 }),
      wallSign: std({ map: T.wallSign(), roughness: 0.32, metalness: 0.12 }),
      departure: std({
        map: T.departureBoard(),
        emissiveMap: T.departureBoard(),
        emissive: '#fff4dc',
        emissiveIntensity: 1.9,
        roughness: 0.24,
      }),
      infoScreen: std({
        map: T.infoScreen(),
        emissiveMap: T.infoScreen(),
        emissive: '#e8f4ff',
        emissiveIntensity: 1.5,
        roughness: 0.2,
      }),
      mtg: std({ map: T.mindTheGap(), transparent: true, roughness: 0.78, polygonOffset: true, polygonOffsetFactor: -2 }),
      pn1: std({ map: T.platformNumber('1', '#1d4ed8'), roughness: 0.42 }),
      pn2: std({ map: T.platformNumber('2', '#b91c1c'), roughness: 0.42 }),
      poster0: std({ map: T.poster(0), emissiveMap: T.poster(0), emissive: '#ffffff', emissiveIntensity: 0.42, roughness: 0.28 }),
      poster1: std({ map: T.poster(1), emissiveMap: T.poster(1), emissive: '#ffffff', emissiveIntensity: 0.42, roughness: 0.28 }),
      clock: std({ map: T.clockFace(), transparent: true, roughness: 0.28, envMapIntensity: 1.2 }),
      // Glossy clearcoated metallic-enamel modern commuter express train!
      trainBody: phys({
        map: T.trainSide(),
        roughness: 0.3,
        metalness: 0.28,
        clearcoat: 0.65,
        clearcoatRoughness: 0.14,
        envMapIntensity: 1.15,
        transparent: true,
        alphaTest: 0.15,
      }),
      cabHead: phys({
        map: T.cabFrontMap(true),
        emissiveMap: T.cabFrontEmissive(true),
        emissive: '#ffffff',
        emissiveIntensity: 2.0,
        roughness: 0.22,
        metalness: 0.22,
        clearcoat: 0.9,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.35,
      }),
      cabTail: phys({
        map: T.cabFrontMap(false),
        emissiveMap: T.cabFrontEmissive(false),
        emissive: '#ffffff',
        emissiveIntensity: 1.9,
        roughness: 0.22,
        metalness: 0.22,
        clearcoat: 0.9,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.35,
      }),
      trainPlain: phys({
        color: '#cdd3da',
        roughness: 0.28,
        metalness: 0.3,
        clearcoat: 0.6,
        clearcoatRoughness: 0.14,
        envMapIntensity: 1.15,
      }),
      trainRoof: phys({
        color: '#8e959e',
        roughness: 0.46,
        metalness: 0.42,
        clearcoat: 0.22,
        clearcoatRoughness: 0.32,
        envMapIntensity: 1.1,
      }),
      trainGlass: phys({
        color: '#aac4d6',
        roughness: 0.05,
        metalness: 0.06,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        transparent: true,
        opacity: 0.22,
        envMapIntensity: 1.7,
        depthWrite: false,
      }),
      trainInteriorGlow: std({ color: '#3b3126', emissive: '#ffcf92', emissiveIntensity: 0.55 + lampOn * 0.35, roughness: 0.8 }),
      // Tactile sculpted commuter saloon materials
      seatMoquette: std({
        map: T.seatMoquette(),
        normalMap: T.moquetteNormal(),
        normalScale: v2(0.6),
        roughness: 0.88,
        color: '#dcdad4',
      }),
      headrest: phys({
        color: '#292e36',
        roughness: 0.46,
        clearcoat: 0.18,
        clearcoatRoughness: 0.42,
      }),
      seatFrame: std({ color: '#383e47', roughness: 0.44, metalness: 0.52 }),
      seatTray: std({ color: '#555c66', roughness: 0.5, metalness: 0.12 }),
      grabPole: phys({
        color: '#e09f2a',
        roughness: 0.24,
        metalness: 0.25,
        clearcoat: 0.55,
        clearcoatRoughness: 0.16,
      }),
      strapMat: std({ color: '#3a3f46', roughness: 0.58, metalness: 0.05 }),
      interiorCeiling: std({ color: '#dcd7ce', roughness: 0.72, side: THREE.DoubleSide }),
      interiorWall: std({ color: '#d8d3ca', roughness: 0.74 }),
      trainFloor: std({ map: rep(T.trainFloor(), 19.6, 2.7), roughness: 0.82 }),
      trainCeilingLight: std({ color: '#dedad0', emissive: '#fff1d6', emissiveIntensity: 2.0, roughness: 0.25 }),
      routeStrip: std({ map: T.trainRouteStrip(), roughness: 0.4 }),
      pisBanner: std({
        map: T.pisBanner(),
        emissiveMap: T.pisBanner(),
        emissive: '#ffffff',
        emissiveIntensity: 1.65,
        roughness: 0.24,
      }),
      // Trackside railway signals & props
      headlight: std({ color: '#d6d4cc', emissive: '#fff4da', emissiveIntensity: 3.4, roughness: 0.2 }),
      taillight: std({ color: '#7a1414', emissive: '#ff2f1f', emissiveIntensity: 2.8, roughness: 0.25 }),
      signalRed: std({ color: '#561010', emissive: '#ff2b1c', emissiveIntensity: 3.4, roughness: 0.18 }),
      signalGreen: std({ color: '#104426', emissive: '#22ee7e', emissiveIntensity: 3.2, roughness: 0.18 }),
      signalOff: std({ color: '#262a2e', roughness: 0.3 }),
      vendingFront: std({ color: '#3a4658', emissive: '#8cc0ff', emissiveIntensity: 0.85, roughness: 0.2 }),
      help: std({ color: '#d4dce6', emissive: '#64b2ff', emissiveIntensity: 1.0, roughness: 0.35 }),
      suitcaseMat: phys({ color: '#36414f', roughness: 0.34, metalness: 0.12, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
      leather: phys({ color: '#6b422a', roughness: 0.48, clearcoat: 0.18, clearcoatRoughness: 0.4 }),
      paper: std({ map: T.newsprint(), roughness: 0.84 }),
      ceramic: phys({ color: '#8f98a2', roughness: 0.18, clearcoat: 0.85, clearcoatRoughness: 0.08 }),
      trunk: std({ color: '#403830', roughness: 0.94 }),
    }
  }, [wet, lampOn])
}
export type Materials = ReturnType<typeof useMaterials>

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function B({
  p,
  s,
  m,
  r,
  cast = false,
  recv = true,
  name,
}: {
  p: V3
  s: V3
  m: THREE.Material
  r?: V3
  cast?: boolean
  recv?: boolean
  name?: string
}) {
  return <mesh geometry={BOX} material={m} position={p} scale={s} rotation={r} castShadow={cast} receiveShadow={recv} name={name} />
}

function Instanced({
  geometry = BOX,
  material,
  items,
  cast = false,
  recv = true,
  name,
}: {
  geometry?: THREE.BufferGeometry
  material: THREE.Material
  items: { p: V3; s?: V3; r?: V3 }[]
  cast?: boolean
  recv?: boolean
  name?: string
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new THREE.Object3D()
    items.forEach((it, i) => {
      o.position.set(...it.p)
      o.scale.set(...(it.s ?? [1, 1, 1]))
      o.rotation.set(...(it.r ?? [0, 0, 0]))
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [items, geometry, material])
  return <instancedMesh ref={ref} args={[geometry, undefined, items.length]} material={material} castShadow={cast} receiveShadow={recv} frustumCulled={false} name={name} />
}

function range(from: number, to: number, step: number) {
  const out: number[] = []
  for (let x = from; x <= to + 1e-6; x += step) out.push(x)
  return out
}

/* ------------------------------------------------------------------ */
/*  Track (Vignoles curved-head rails, beveled sleepers, sloped ballast)*/
/* ------------------------------------------------------------------ */
function Track({ z, M }: { z: number; M: Materials }) {
  const sleepers = useMemo(() => range(-L / 2, L / 2, 0.65).map((x) => ({ p: [x, RAIL_TOP - 0.26, z] as V3 })), [z])
  const clips = useMemo(() => {
    const items: { p: V3; s: V3 }[] = []
    range(-PL / 2, PL / 2, 0.65).forEach((x) => {
      ;[-1, 1].forEach((s) => {
        items.push({ p: [x, RAIL_TOP - 0.155, z + s * (GAUGE / 2 + 0.088)], s: [0.045, 0.045, 0.04] })
        items.push({ p: [x, RAIL_TOP - 0.155, z + s * (GAUGE / 2 - 0.088)], s: [0.045, 0.045, 0.04] })
      })
    })
    return items
  }, [z])
  return (
    <group>
      {/* Gently sloped rounded gravel ballast shoulder */}
      <mesh geometry={GEO.ballast} material={M.ballast} position={[0, RAIL_TOP - 0.3, z]} receiveShadow name="ballast" />
      <Instanced geometry={GEO.sleeper} material={M.sleeper} items={sleepers} name="sleepers" />
      <Instanced geometry={CYL_SM} material={M.darkMetal} items={clips} name="rail-clips" />
      {[-1, 1].map((s) => {
        const rz = z + (s * GAUGE) / 2
        return (
          <group key={s} position={[0, RAIL_TOP, rz]}>
            <mesh geometry={GEO.railHead} material={M.railHead} name="rail-head" />
            <mesh geometry={GEO.railWeb} material={M.railWeb} receiveShadow name="rail-web" />
          </group>
        )
      })}
      {/* Subtle dark wheel-grease centreline strip */}
      <mesh geometry={PLANE} material={M.asphalt} position={[0, RAIL_TOP - 0.24, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[L, 0.72, 1]} receiveShadow />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Victorian Arched Brick Viaduct Walls, Globe Lanterns & Skyline      */
/* ------------------------------------------------------------------ */
function Surroundings({ M }: { M: Materials }) {
  const {
    archBays,
    archivolts,
    swanNecks,
    hoods,
    globes,
    cabinets,
    bldgMain,
    bldgFar,
    bldgCornices,
    crownsA,
    crownsB,
    trunks,
  } = useMemo(() => {
    const archBays: { p: V3; r: V3 }[] = []
    const archivolts: { p: V3; r: V3 }[] = []
    const swanNecks: { p: V3; r: V3 }[] = []
    const hoods: { p: V3 }[] = []
    const globes: { p: V3 }[] = []

    const bayXs = range(-68, 68, 8)
    for (const s of [1, -1] as const) {
      const rotY = s > 0 ? Math.PI : 0
      const faceZ = s * 11.96
      bayXs.forEach((x) => {
        archBays.push({ p: [x, GROUND, faceZ], r: [0, rotY, 0] })
        archivolts.push({ p: [x, GROUND + 1.48, s * 11.68], r: [0, rotY, 0] })
      })
      // Graceful curved wrought-iron swan-neck warm globe lanterns mounted on alternate stone piers
      range(-60, 60, 16).forEach((x) => {
        const px = x + 4 // centred directly on viaduct pier
        const zMount = s * 11.62
        swanNecks.push({ p: [px, GROUND + 3.55, zMount], r: [0, rotY, 0] })
        const gZ = zMount - s * 0.8
        hoods.push({ p: [px, GROUND + 3.56, gZ] })
        globes.push({ p: [px, GROUND + 3.4, gZ] })
      })
    }

    const cabinets = [-44, -12, 22, 48].map((x, i) => ({
      p: [x, GROUND + 0.66, (i % 2 ? 1 : -1) * 10.65] as V3,
    }))

    // Varied European urban city skyline with softly topped roofs & trim cornices
    let seed = 91
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const bldgMain: { p: V3; s: V3 }[] = []
    const bldgCornices: { p: V3; s: V3 }[] = []
    const bldgFar: { p: V3; s: V3 }[] = []
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? 1 : -1
      const x = -185 + rnd() * 370
      const w = 15 + rnd() * 24
      const h = 10 + rnd() * 26
      const d = 13 + rnd() * 20
      const z = side * (32 + rnd() * 68)
      const topY = GROUND + 3.2 + h
      bldgMain.push({ p: [x, GROUND + 3.2 + h / 2, z], s: [w, h, d] })
      bldgCornices.push({ p: [x, topY + 0.22, z], s: [w + 0.8, 0.45, d + 0.8] })
    }
    for (let i = 0; i < 12; i++) {
      const x = (i % 2 ? 1 : -1) * (155 + rnd() * 85)
      const w = 14 + rnd() * 24
      const h = 14 + rnd() * 28
      bldgFar.push({ p: [x, GROUND + 3 + h / 2, -45 + rnd() * 90], s: [w, h, w] })
    }

    // Soft sculpted rounded background urban foliage rising organically above both brick viaduct rims
    const crownsA: { p: V3; s: V3; r: V3 }[] = []
    const crownsB: { p: V3; s: V3; r: V3 }[] = []
    const trunks: { p: V3; s: V3 }[] = []
    let ts = 421
    const trnd = () => ((ts = (ts * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 28; i++) {
      const side = i % 2 ? 1 : -1
      const x = -110 + (i / 28) * 220 + (trnd() - 0.5) * 8
      const z = side * (16.5 + trnd() * 14)
      const base = GROUND + 5.2
      const r = 2.1 + trnd() * 1.9
      const cy = base + 2.4 + trnd() * 2.4
      trunks.push({ p: [x, base + 1.5, z], s: [0.22, 3.2, 0.22] })
      const target = i % 2 === 0 ? crownsA : crownsB
      target.push({ p: [x, cy, z], s: [r * 1.15, r * 0.95, r * 1.1], r: [0, trnd() * 6, 0] })
      // secondary lobe for soft cloud-like natural canopy silhouette
      target.push({
        p: [x + (trnd() - 0.5) * r * 1.1, cy - r * 0.22, z + (trnd() - 0.5) * r * 0.9],
        s: [r * 0.78, r * 0.72, r * 0.78],
        r: [0, trnd() * 6, 0],
      })
    }

    return { archBays, archivolts, swanNecks, hoods, globes, cabinets, bldgMain, bldgFar, bldgCornices, crownsA, crownsB, trunks }
  }, [])

  return (
    <group>
      {/* Rail bed formation */}
      <mesh geometry={PLANE} material={M.asphalt} position={[0, GROUND, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[L, 26, 1]} receiveShadow name="formation" />
      <Track z={-TRACK_Z} M={M} />
      <Track z={TRACK_Z} M={M} />

      {/* Continuous backing walls, moulded stone cornices, cable troughs & heritage wall nameplates */}
      {[1, -1].map((s) => (
        <group key={s}>
          <B p={[0, GROUND + 2.65, s * 12.22]} s={[L, 5.3, 0.48]} m={M.brick} name="retaining-wall" />
          <mesh geometry={GEO.cornice} material={M.stone} position={[0, GROUND + 5.38, s * 11.96]} name="wall-cornice" />
          {/* recessed concrete lineside cable conduit */}
          <B p={[0, GROUND + 0.14, s * 10.85]} s={[L, 0.26, 0.44]} m={M.stone} />
          {/* horizontal smooth steel conduit rail */}
          <mesh geometry={CYL} material={M.darkMetal} position={[0, GROUND + 4.46, s * 11.58]} rotation={[0, 0, Math.PI / 2]} scale={[0.042, L, 0.042]} />
          {/* classic enamelled station signs inset inside arch bays */}
          {[-28, 28].map((x) => (
            <group key={x} position={[x, 1.95, s * 11.88]} rotation={[0, s > 0 ? Math.PI : 0, 0]}>
              <mesh geometry={PLANE} material={M.wallSign} scale={[4.8, 1.2, 1]} />
            </group>
          ))}
        </group>
      ))}

      {/* Sculpted semicircular Victorian brick viaduct arch bays + rounded stone archivolt rings & carved keystones */}
      <Instanced geometry={GEO.viaductArch} material={M.archBrick} items={archBays} name="viaduct-arches" />
      <Instanced geometry={GEO.archivolt} material={M.stone} items={archivolts} name="stone-archivolts" />
      <Instanced
        geometry={GEO.keystone}
        material={M.stone}
        items={archivolts.map((a) => ({ p: [a.p[0], a.p[1] + 3.24, a.p[2]] as V3 }))}
        name="arch-keystones"
      />

      {/* Graceful distant multi-arch brick overbridge & low misty embankment closing both horizons */}
      <group position={[-122, GROUND, 0]}>
        <B p={[0, 9.6, 0]} s={[6.4, 4.2, 46]} m={M.brick} recv={false} name="far-overbridge" />
        <B p={[0, 11.8, 0]} s={[7.0, 0.58, 47]} m={M.stone} recv={false} />
        <mesh geometry={CYL} material={M.brick} position={[0, 4.2, -13]} scale={[2.8, 8.4, 2.8]} />
        <mesh geometry={CYL} material={M.brick} position={[0, 4.2, 0]} scale={[2.1, 8.4, 2.1]} />
        <mesh geometry={CYL} material={M.brick} position={[0, 4.2, 13]} scale={[2.8, 8.4, 2.8]} />
        {/* soft distant tree-lined city rise closing the vanishing-point gap behind the bridge */}
        <B p={[-52, 6.2, 0]} s={[10, 14, 140]} m={M.skyline} recv={false} />
      </group>

      {/* Graceful curved wrought-iron swan-neck wall lanterns with frosted glowing warm glass globes */}
      <Instanced geometry={GEO.swanNeck} material={M.castIron} items={swanNecks} name="lantern-brackets" />
      <Instanced geometry={GEO.lanternHood} material={M.castIron} items={hoods} name="lantern-hoods" />
      <Instanced geometry={GEO.lanternGlobe} material={M.globeLamp} items={globes} recv={false} name="lantern-globes" />

      {/* Bevelled lineside signalling cabinets */}
      <Instanced geometry={GEO.cabinet} material={M.steelLight} items={cabinets} name="signalling-cabinets" />

      {/* Trackside hooded colour-light signals (rounded casing + circular cylindrical sun visors) */}
      {[
        [-52, 4.45, 1, true],
        [52, -4.45, -1, false],
      ].map(([sx, sz, sdir, greenTop], idx) => (
        <group key={idx} position={[sx as number, GROUND, sz as number]}>
          <mesh geometry={CYL} material={M.castIron} position={[0, 2.2, 0]} scale={[0.075, 4.4, 0.075]} />
          <mesh geometry={GEO.signalHead} material={M.darkMetal} position={[0, 4.18, 0]} name="signal-head" />
          {[4.44, 4.16, 3.88].map((ly, li) => {
            const mat =
              li === 0
                ? greenTop
                  ? M.signalGreen
                  : M.signalOff
                : li === 2
                  ? greenTop
                    ? M.signalOff
                    : M.signalRed
                  : M.signalOff
            return (
              <group key={li} position={[(sdir as number) * 0.16, ly, 0]}>
                <mesh geometry={CYL} material={mat} rotation={[0, 0, Math.PI / 2]} scale={[0.088, 0.03, 0.088]} />
                <mesh
                  geometry={GEO.signalHood}
                  material={M.darkMetal}
                  position={[(sdir as number) * 0.11, 0, 0]}
                  rotation={[0, (sdir as number) > 0 ? 0 : Math.PI, 0]}
                />
              </group>
            )
          })}
        </group>
      ))}

      {/* Distant surrounding city & softly contoured rolling urban trees */}
      <mesh geometry={PLANE} material={M.ground} position={[0, GROUND + 5.25, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[760, 360, 1]} receiveShadow />
      <Instanced material={M.building} items={bldgMain} name="city-buildings" />
      <Instanced material={M.stone} items={bldgCornices} name="city-cornices" />
      <Instanced material={M.skyline} items={bldgFar} name="city-far" />

      {/* Grand headhouse station building behind north wall */}
      <group position={[-16, 0, -21]}>
        <B p={[0, 9.6, 0]} s={[82, 11.4, 12]} m={M.building} />
        <B p={[0, 15.4, 0]} s={[84, 0.58, 13.2]} m={M.stone} />
        <B p={[0, 4.3, 5.4]} s={[84, 0.5, 1.4]} m={M.stone} />
      </group>

      {/* Smooth organic multi-lobed distant tree silhouettes (3D curved geometry, zero boxy cards) */}
      <Instanced geometry={CYL} material={M.trunk} items={trunks} name="tree-trunks" />
      <Instanced geometry={GEO.treeCrownA} material={M.foliageDeep} items={crownsA} name="tree-crowns-a" />
      <Instanced geometry={GEO.treeCrownB} material={M.foliageWarm} items={crownsB} name="tree-crowns-b" />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Platform (honed granite + bullnose stone coping + ground AO pads)  */
/* ------------------------------------------------------------------ */
export const DOOR_X = [-20, 0, 20].flatMap((c) => [c - 6.4, c + 6.4])
const COLUMN_X = range(-48, 48, 12)
const BENCH_X = [-32, -8, 16, 38]
const BIN_SPOTS: [number, number][] = [
  [-35.4, -2.72],
  [-11.4, 2.72],
  [12.6, -2.72],
  [24.6, 2.72],
]
const PLANTER_SPOTS: [number, number][] = [
  [-42.5, 2.15],
  [-15.5, -2.15],
  [8.5, 2.15],
  [30.5, -2.15],
]

function Platform({ M }: { M: Materials }) {
  const half = PW / 2

  // Soft feathered ambient-occlusion contact shadows under columns, benches, bins, planters & luggage
  const aoPads = useMemo(() => {
    const out: { p: V3; s: V3; r: V3 }[] = []
    const add = (x: number, z: number, sx: number, sz: number) =>
      out.push({ p: [x, 0.005, z], s: [sx, sz, 1], r: [-Math.PI / 2, 0, 0] })
    COLUMN_X.forEach((x) => {
      add(x, -2.95, 1.25, 1.25)
      add(x, 2.95, 1.25, 1.25)
    })
    BENCH_X.forEach((x) => {
      add(x, 1.48, 2.55, 1.15)
      add(x, -1.48, 2.55, 1.15)
    })
    BIN_SPOTS.forEach(([x, z]) => add(x, z, 1.05, 1.05))
    PLANTER_SPOTS.forEach(([x, z]) => add(x, z, 1.65, 1.65))
    add(16.7, 2.15, 1.25, 0.95) // luggage cluster
    return out
  }, [])

  return (
    <group>
      {/* Recessed structural platform undercroft wall (projects bullnose shadow along tracks) */}
      <B p={[0, -0.55, 0]} s={[PL, 0.92, PW - 0.36]} m={M.platformSide} />
      {/* Honed dark granite platform paving deck with normal map + damp roughness patches */}
      <mesh geometry={PLANE} material={M.platform} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} scale={[PL, PW - 1.16, 1]} receiveShadow name="platform-slab" />
      {/* Subtle tonal centre promenade strip bounded by brushed stainless slot drains */}
      <mesh geometry={PLANE} material={M.serviceStrip} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} scale={[PL, 1.8, 1]} receiveShadow name="platform-centre" />
      <Instanced
        material={M.darkMetal}
        items={[-0.91, 0.91].map((z) => ({ p: [0, 0.003, z] as V3, s: [PL, 0.004, 0.045] as V3 }))}
        name="drain-channels"
      />
      {/* Crisp subtle stone expansion joints */}
      <Instanced
        material={M.darkMetal}
        items={range(-58, 58, 6).map((x) => ({ p: [x, 0.0025, 0] as V3, s: [0.018, 0.004, PW - 1.3] as V3 }))}
        name="joints"
      />
      {/* Feathered soft ground-contact AO shadows under every platform object */}
      <Instanced geometry={PLANE} material={M.contactAO} items={aoPads} recv={false} name="contact-ao" />

      {/* True rounded bullnose coping stones + tactile dome blister strip + edge line */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh
            geometry={GEO.coping}
            material={M.coping}
            position={[0, 0, s * (half - 0.32)]}
            rotation={[0, s > 0 ? 0 : Math.PI, 0]}
            receiveShadow
            castShadow
            name="coping"
          />
          <mesh geometry={PLANE} material={M.yellowLine} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, s * (half - 0.56)]} scale={[PL, 0.1, 1]} receiveShadow />
          <mesh geometry={PLANE} material={M.tactile} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, s * (half - 0.86)]} scale={[PL, 0.4, 1]} receiveShadow name="tactile" />
          <mesh geometry={PLANE} material={M.whiteLine} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, s * (half - 0.14)]} scale={[PL, 0.035, 1]} />
        </group>
      ))}
      {/* End slope ramps */}
      {[-1, 1].map((s) => (
        <B key={s} p={[s * (PL / 2 + 3), -0.5, 0]} s={[6, 1, PW]} m={M.platformSide} r={[0, 0, s * 0.165]} />
      ))}
      {/* Worn "MIND THE GAP" platform safety stencils */}
      <Instanced
        geometry={PLANE}
        material={M.mtg}
        items={[-1, 1].flatMap((s) =>
          DOOR_X.map((x) => ({ p: [x, 0.006, s * (half - 1.36)] as V3, s: [2, 0.4, 1] as V3, r: [-Math.PI / 2, 0, s > 0 ? Math.PI : 0] as V3 })),
        )}
        name="mind-the-gap"
      />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Barrel-Vault Canopy (turned cast-iron columns, curved filigree)    */
/* ------------------------------------------------------------------ */
const LAMP_X = range(-54, 54, 6)

function Canopy({ M }: { M: Materials }) {
  const {
    columns,
    spandrelInPos,
    spandrelInNeg,
    rings,
    ribs,
    lampHousings,
    lampBars,
    lampRods,
    glazingMulls,
  } = useMemo(() => {
    const columns = COLUMN_X.flatMap((x) => [-2.95, 2.95].map((z) => ({ p: [x, 0, z] as V3 })))
    // Curved arch brackets arching inward from z = -2.95 (+Z) and from z = +2.95 (-Z) up to vault ribs
    const spandrelInPos = COLUMN_X.map((x) => ({ p: [x, 0, -2.95] as V3 }))
    const spandrelInNeg = COLUMN_X.map((x) => ({ p: [x, 0, 2.95] as V3 }))
    // Pierced heritage decorative cast-iron ring sitting gracefully in every spandrel corner!
    const rings = COLUMN_X.flatMap((x) => [
      { p: [x, 4.02, -2.56] as V3 },
      { p: [x, 4.02, 2.56] as V3 },
    ])
    const ribs = range(-58, 58, 4).map((x) => ({ p: [x, 0, 0] as V3 }))
    const lampHousings = LAMP_X.flatMap((x) => [-1.48, 1.48].map((z) => ({ p: [x, archY(z) - 0.34, z] as V3 })))
    const lampBars = LAMP_X.flatMap((x) => [-1.48, 1.48].map((z) => ({ p: [x, archY(z) - 0.375, z] as V3 })))
    const lampRods = LAMP_X.flatMap((x) =>
      [-1.48, 1.48].flatMap((z) => [-0.68, 0.68].map((ox) => ({ p: [x + ox, archY(z) - 0.17, z] as V3, s: [0.011, 0.34, 0.011] as V3 }))),
    )
    const glazingMulls = range(-58, 58, 2).flatMap((x) =>
      [-1.47, 1.47].map((z) => ({
        p: [x, archY(z) + 0.012, z] as V3,
        s: [0.022, 0.92, 0.022] as V3,
        r: [Math.PI / 2 + (z > 0 ? 0.2 : -0.2), 0, 0] as V3,
      })),
    )
    return { columns, spandrelInPos, spandrelInNeg, rings, ribs, lampHousings, lampBars, lampRods, glazingMulls }
  }, [])

  return (
    <group>
      {/* Smooth curved riveted soffit strips & skylight glass lanterns */}
      {GEO.solidVaults.map((g, i) => (
        <mesh key={i} geometry={g} material={M.soffit} receiveShadow name="vault-panel" />
      ))}
      {GEO.glassVaults.map((g, i) => (
        <mesh key={i} geometry={g} material={M.glassRoof} name="skylight" />
      ))}
      {/* Rounded continuous vault ribs + sleek cylindrical purlins + skylight frame dividers */}
      <Instanced geometry={GEO.vaultRib} material={M.castIron} items={ribs} name="vault-ribs" />
      <Instanced
        geometry={GEO.vaultPurlin}
        material={M.castIron}
        items={[-3.6, -2.55, -1.92, -1.02, 0, 1.02, 1.92, 2.55, 3.6].map((z) => ({ p: [0, archY(z) - 0.05, z] as V3 }))}
        name="purlins"
      />
      <Instanced geometry={CYL_SM} material={M.steelLight} items={glazingMulls} name="skylight-mullions" />
      {/* Sculpted moulded cast-iron heritage platform columns + arched spandrel brackets, pierced rings & cambered tie-rods */}
      <Instanced geometry={GEO.column} material={M.castIron} items={columns} cast name="columns" />
      <Instanced geometry={GEO.spandrelPos} material={M.castIron} items={spandrelInPos} name="spandrels-l" />
      <Instanced geometry={GEO.spandrelNeg} material={M.castIron} items={spandrelInNeg} name="spandrels-r" />
      <Instanced geometry={GEO.spandrelRing} material={M.castIron} items={rings} name="spandrel-rings" />
      <Instanced geometry={GEO.tieRod} material={M.castIron} items={COLUMN_X.map((x) => ({ p: [x, 0, 0] as V3 }))} name="vault-tie-rods" />
      <Instanced
        geometry={CYL}
        material={M.brass}
        items={COLUMN_X.map((x) => ({ p: [x, 4.18, 0] as V3, s: [0.075, 0.055, 0.075] as V3, r: [0, 0, Math.PI / 2] as V3 }))}
        name="tie-rosettes"
      />
      {/* Sleek rounded capsule linear pendant lamps on twin round cables */}
      <Instanced geometry={GEO.lampHousing} material={M.lampHousing} items={lampHousings} name="lamp-housings" />
      <Instanced geometry={GEO.lampDiffuser} material={M.lamp} items={lampBars} recv={false} name="lamps" />
      <Instanced geometry={CYL_SM} material={M.brushedSteel} items={lampRods} name="lamp-cables" />
      {/* Molded softly curved cantilevered gutter fascia on both canopy eaves */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={GEO.canopyFascia}
          material={M.castIron}
          position={[0, SPRING - 0.02, s * HW]}
          rotation={[0, s > 0 ? 0 : Math.PI, 0]}
          name="fascia"
        />
      ))}
      {/* Rounded cylindrical cast-iron rainwater downpipes next to alternate columns */}
      <Instanced
        geometry={CYL}
        material={M.castIron}
        items={COLUMN_X.filter((_, i) => i % 2 === 0).map((x) => ({ p: [x + 0.24, 1.95, 2.95] as V3, s: [0.042, 3.9, 0.042] as V3 }))}
        name="downpipes"
      />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Glazed Architectural Footbridge                                    */
/* ------------------------------------------------------------------ */
function Footbridge({ M }: { M: Materials }) {
  const x = -43
  const deckY = 5.75
  const posts = useMemo(
    () =>
      range(-12, 12, 2.0).flatMap((z) =>
        [-1.55, 1.55].map((ox) => ({ p: [x + ox, deckY + 1.32, z] as V3, s: [0.042, 2.15, 0.042] as V3 })),
      ),
    [x],
  )
  const bridgeVault = useMemo(() => {
    const g = G.makeVaultStrip(25.2, 2.0, deckY + 2.38, 0.42, -1.96, 1.96, 0)
    g.rotateY(Math.PI / 2)
    return g
  }, [deckY])

  return (
    <group>
      <B p={[x, deckY - 0.16, 0]} s={[3.25, 0.34, 24.8]} m={M.castIron} name="bridge-deck" />
      <B p={[x, deckY + 0.02, 0]} s={[2.9, 0.05, 24.4]} m={M.steelLight} />
      {/* Slender cylindrical steel glazed gallery mullions */}
      <Instanced geometry={CYL} material={M.castIron} items={posts} name="bridge-mullions" />
      {/* Clear laminated acoustic side glass + stainless handrails */}
      <Instanced material={M.glass} items={[-1, 1].map((s) => ({ p: [x + s * 1.55, deckY + 1.3, 0] as V3, s: [0.03, 1.95, 24.2] as V3 }))} name="bridge-glazing" />
      <Instanced
        geometry={CYL}
        material={M.brushedSteel}
        items={[-1, 1].map((s) => ({ p: [x + s * 1.55, deckY + 0.96, 0] as V3, s: [0.032, 24.4, 0.032] as V3, r: [Math.PI / 2, 0, 0] as V3 }))}
        name="bridge-rails"
      />
      <Instanced
        geometry={CYL}
        material={M.castIron}
        items={[-1, 1].map((s) => ({ p: [x + s * 1.55, deckY + 2.38, 0] as V3, s: [0.06, 24.8, 0.06] as V3, r: [Math.PI / 2, 0, 0] as V3 }))}
        name="bridge-headers"
      />
      {/* Graceful arched cylindrical supporting bridge piers */}
      <Instanced
        geometry={CYL}
        material={M.castIron}
        items={[-11.4, 11.4].flatMap((z) => [-1.3, 1.3].map((ox) => ({ p: [x + ox, (deckY + GROUND) / 2, z] as V3, s: [0.22, deckY - GROUND, 0.22] as V3 })))}
        name="bridge-piers"
      />
      {/* Matching gently curved barrel roof over the footbridge! */}
      <mesh geometry={bridgeVault} material={M.soffit} position={[x, 0, 0]} name="bridge-roof" />
      <B p={[x, deckY + 2.52, 0]} s={[0.42, 0.04, 22.8]} m={M.lamp} recv={false} />
      {/* Soft rounded nameplate centered on footbridge side */}
      <group position={[x + 1.66, deckY + 0.56, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={GEO.totemBoard} material={M.castIron} scale={[0.96, 0.92, 0.9]} />
        <mesh geometry={PLANE} material={M.nameBoard} position={[0, 0, 0.042]} scale={[2.24, 0.44, 1]} />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Smooth Bevelled Signage & Spun-Metal Station Clocks                */
/* ------------------------------------------------------------------ */
function Signage({ M }: { M: Materials }) {
  const { dirFrames, depFrame, infoFrame, rods, dirFaces, depFaces, infoFaces, totemPosts, totemBoards, totemNums, totemFaces, num1, num2, clockBodies, clockRods, clockFaces } = useMemo(() => {
    const top = archY(0) - 0.06
    const dirXs = [-30, -4, 42]
    const dirFrames: { p: V3 }[] = []
    const rods: { p: V3; s: V3 }[] = []
    const dirFaces: { p: V3; s: V3; r: V3 }[] = []

    const addHangers = (x: number, w: number, cy: number, h: number) => {
      const span = Math.max(0.15, top - (cy + h / 2))
      ;[-w / 2 + 0.26, w / 2 - 0.26].forEach((oz) => rods.push({ p: [x, cy + h / 2 + span / 2, oz], s: [0.013, span + 0.04, 0.013] }))
    }

    dirXs.forEach((x) => {
      const cy = top - 0.84
      dirFrames.push({ p: [x, cy, 0] })
      addHangers(x, 2.4, cy, 0.6)
      ;[1, -1].forEach((sd) => dirFaces.push({ p: [x + sd * 0.046, cy, 0], s: [2.36, 0.56, 1], r: [0, sd > 0 ? Math.PI / 2 : -Math.PI / 2, 0] }))
    })

    const depY = top - 0.86
    const depFrame = [{ p: [18, depY, 0] as V3 }]
    addHangers(18, 1.9, depY, 0.64)
    const depFaces = [1, -1].map((sd) => ({ p: [18 + sd * 0.058, depY, 0] as V3, s: [1.88, 0.6, 1] as V3, r: [0, sd > 0 ? Math.PI / 2 : -Math.PI / 2, 0] as V3 }))

    const infoY = top - 0.92
    const infoFrame = [{ p: [52, infoY, 0] as V3 }]
    addHangers(52, 1.2, infoY, 0.68)
    const infoFaces = [1, -1].map((sd) => ({ p: [52 + sd * 0.054, infoY, 0] as V3, s: [1.18, 0.64, 1] as V3, r: [0, sd > 0 ? Math.PI / 2 : -Math.PI / 2, 0] as V3 }))

    // Tubular stainless station name totems parallel to tracks
    const spots: [number, number][] = [
      [-44, -2.65],
      [-16, 2.65],
      [14, -2.65],
      [42, 2.65],
    ]
    const totemPosts: { p: V3; s: V3 }[] = []
    const totemBoards: { p: V3 }[] = []
    const totemNums: { p: V3 }[] = []
    const totemFaces: { p: V3; s: V3; r: V3 }[] = []
    const num1: { p: V3; s: V3; r: V3 }[] = []
    const num2: { p: V3; s: V3; r: V3 }[] = []

    spots.forEach(([x, z]) => {
      ;[-1.08, 1.08].forEach((ox) => totemPosts.push({ p: [x + ox, 1.44, z], s: [0.036, 2.88, 0.036] }))
      totemBoards.push({ p: [x, 2.58, z] })
      totemNums.push({ p: [x, 2.02, z] })
      ;[1, -1].forEach((sd) => {
        totemFaces.push({ p: [x, 2.58, z + sd * 0.041], s: [2.36, 0.46, 1], r: [0, sd > 0 ? 0 : Math.PI, 0] })
        const arr = z > 0 ? num2 : num1
        arr.push({ p: [x, 2.02, z + sd * 0.039], s: [0.4, 0.4, 1], r: [0, sd > 0 ? 0 : Math.PI, 0] })
      })
    })

    // Spun-metal circular double-sided Swiss railway clocks
    const clockXs = [-18, 30]
    const clockY = top - 0.72
    const clockBodies = clockXs.map((x) => ({ p: [x, clockY, 0] as V3 }))
    const clockRods = clockXs.map((x) => ({ p: [x, top - 0.2, 0] as V3, s: [0.02, 0.44, 0.02] as V3 }))
    const clockFaces = clockXs.flatMap((x) => [
      { p: [x + 0.052, clockY, 0] as V3, s: [0.64, 0.64, 1] as V3, r: [0, Math.PI / 2, 0] as V3 },
      { p: [x - 0.052, clockY, 0] as V3, s: [0.64, 0.64, 1] as V3, r: [0, -Math.PI / 2, 0] as V3 },
    ])

    return { dirFrames, depFrame, infoFrame, rods, dirFaces, depFaces, infoFaces, totemPosts, totemBoards, totemNums, totemFaces, num1, num2, clockBodies, clockRods, clockFaces }
  }, [])

  return (
    <group>
      {/* Rounded bevelled brushed-aluminum hanging sign housings */}
      <Instanced geometry={GEO.signDirFrame} material={M.darkMetal} items={dirFrames} name="dir-sign-frames" />
      <Instanced geometry={GEO.signDepFrame} material={M.darkMetal} items={depFrame} name="dep-sign-frame" />
      <Instanced geometry={GEO.signInfoFrame} material={M.darkMetal} items={infoFrame} name="info-sign-frame" />
      <Instanced geometry={CYL} material={M.brushedSteel} items={rods} name="sign-rods" />
      <Instanced geometry={PLANE} material={M.hangingSign} items={dirFaces} name="dir-sign-faces" />
      <Instanced geometry={PLANE} material={M.departure} items={depFaces} recv={false} name="departure-faces" />
      <Instanced geometry={PLANE} material={M.infoScreen} items={infoFaces} recv={false} name="info-faces" />
      {/* Round-tube station name totems */}
      <Instanced geometry={CYL} material={M.castIron} items={totemPosts} name="totem-posts" />
      <Instanced geometry={GEO.totemBoard} material={M.darkMetal} items={totemBoards} name="totem-boards" />
      <Instanced geometry={GEO.totemNum} material={M.darkMetal} items={totemNums} name="totem-num-frames" />
      <Instanced geometry={PLANE} material={M.nameBoard} items={totemFaces} name="station-name-boards" />
      <Instanced geometry={PLANE} material={M.pn1} items={num1} name="platform-num-1" />
      <Instanced geometry={PLANE} material={M.pn2} items={num2} name="platform-num-2" />
      {/* Classic spun-metal double-sided circular clocks with domed torus bezel */}
      <Instanced geometry={CYL} material={M.brushedSteel} items={clockRods} name="clock-rods" />
      <Instanced geometry={GEO.clockBody} material={M.darkMetal} items={clockBodies} name="clock-bodies" />
      <Instanced geometry={GEO.clockBezel} material={M.brushedSteel} items={clockBodies} name="clock-bezels" />
      <Instanced geometry={DISC} material={M.clock} items={clockFaces} name="clock-faces" />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Sculpted Organic Platform Furniture                                */
/* ------------------------------------------------------------------ */
function Furniture({ M }: { M: Materials }) {
  const {
    benchFrames,
    benchArms,
    benchSlats,
    bins,
    planters,
    soils,
    blades,
    bladeTips,
    shelterPosts,
    shelterRoofs,
    shelterGlass,
    spiderPins,
    cctvPoles,
    cctvBodies,
  } = useMemo(() => {
    const benchFrames: { p: V3; r: V3 }[] = []
    const benchArms: { p: V3; r: V3 }[] = []
    const benchSlats: { p: V3; r: V3 }[] = []
    BENCH_X.forEach((x) => {
      for (const side of [1, -1] as const) {
        const z = side * 1.48
        const ry = side > 0 ? 0 : Math.PI
        // 3 graceful cast-iron curved hoop legs + 2 swept curved armrests per bench
        ;[-0.86, 0, 0.86].forEach((ox) => benchFrames.push({ p: [x + ox, 0, z], r: [0, ry, 0] }))
        ;[-0.92, 0.92].forEach((ox) => benchArms.push({ p: [x + ox, 0, z], r: [0, ry, 0] }))
        // 11 smooth rounded warm oiled-oak bench slats curving smoothly through waterfall lip & backrest!
        G.BENCH_SLATS.forEach(([sy, sz, tilt]) => {
          benchSlats.push({
            p: [x, sy, z + side * sz],
            r: [side * tilt, 0, 0],
          })
        })
      }
    })

    const bins = BIN_SPOTS.map(([x, z]) => ({ p: [x, 0, z] as V3 }))

    // Sculpted rolled-rim stone planters filled with dark earth & graceful arched ornamental grasses
    const planters = PLANTER_SPOTS.map(([x, z]) => ({ p: [x, 0, z] as V3 }))
    const soils = PLANTER_SPOTS.map(([x, z]) => ({ p: [x, 0.56, z] as V3, s: [0.49, 0.04, 0.49] as V3 }))
    const blades: { p: V3; s: V3; r: V3 }[] = []
    const bladeTips: { p: V3; s: V3; r: V3 }[] = []
    let bs = 811
    const br = () => ((bs = (bs * 16807) % 2147483647) / 2147483647)
    PLANTER_SPOTS.forEach(([px, pz]) => {
      // Rich fountain-shaped ornamental grasses cascading gracefully over the rounded stone bowl rim
      const count = 42
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + br() * 0.22
        const ring = i < 14 ? 0.06 + br() * 0.12 : 0.14 + br() * 0.22
        const sc = i < 14 ? 0.9 + br() * 0.48 : 0.68 + br() * 0.46
        const lift = i < 14 ? -0.58 - br() * 0.36 : -0.1 + br() * 0.32
        const item = {
          p: [px + Math.cos(a) * ring, 0.55, pz + Math.sin(a) * ring] as V3,
          s: [sc * 0.85, sc, sc] as V3,
          r: [lift, a, 0] as V3,
        }
        if (i % 3 === 0) bladeTips.push(item)
        else blades.push(item)
      }
    })

    // Curved-edge architectural glass-and-stainless waiting windbreaks with tubular posts & circular clasps
    const shXs = [-22, 4]
    const shelterPosts = shXs.flatMap((x) =>
      [-1.5, 1.5].map((ox) => ({ p: [x + ox, 1.18, 0] as V3, s: [0.05, 2.36, 0.05] as V3 })),
    )
    const shelterRoofs = shXs.map((x) => ({ p: [x, 2.36, 0] as V3 }))
    const shelterGlass = shXs.map((x) => ({ p: [x, 1.24, 0] as V3 }))
    const spiderPins = shXs.flatMap((x) =>
      [-1.36, 1.36].flatMap((ox) => [0.58, 1.92].map((y) => ({ p: [x + ox, y, 0] as V3, s: [0.045, 0.08, 0.045] as V3, r: [Math.PI / 2, 0, 0] as V3 }))),
    )

    // Sleek slim circular dome CCTV cameras on rounded tubes
    const cXs = [-28, 12, 46]
    const cctvPoles = cXs.map((x) => ({ p: [x, 1.78, -2.5] as V3, s: [0.036, 3.56, 0.036] as V3 }))
    const cctvBodies = cXs.map((x) => ({ p: [x, 3.45, -2.42] as V3, s: [0.11, 0.11, 0.11] as V3 }))

    return { benchFrames, benchArms, benchSlats, bins, planters, soils, blades, bladeTips, shelterPosts, shelterRoofs, shelterGlass, spiderPins, cctvPoles, cctvBodies }
  }, [])

  return (
    <group>
      {/* Sculpted curved S-profile warm oiled-oak timber platform benches */}
      <Instanced geometry={GEO.benchFrame} material={M.castIron} items={benchFrames} cast name="bench-frames" />
      <Instanced geometry={GEO.benchArm} material={M.castIron} items={benchArms} name="bench-arms" />
      <Instanced geometry={GEO.benchSlat} material={M.oak} items={benchSlats} name="bench-oak-slats" />
      {/* Casual folded newspaper & take-away ceramic coffee cup on a bench */}
      <group position={[-8, 0, 1.48]}>
        <mesh geometry={PLANE} material={M.paper} position={[0.45, 0.486, 0.05]} rotation={[-Math.PI / 2, 0, 0.24]} scale={[0.3, 0.38, 1]} />
        <mesh geometry={CYL} material={M.ceramic} position={[-0.52, 0.52, 0.06]} scale={[0.042, 0.11, 0.042]} />
      </group>

      {/* Smooth spun stainless-steel domed railway litter bins */}
      <Instanced geometry={GEO.binBody} material={M.darkMetal} items={bins} cast name="bin-bodies" />
      <Instanced geometry={GEO.binCap} material={M.brushedSteel} items={bins} name="bin-caps" />

      {/* Moulded curved architectural cast-stone bowls with lush two-tone arching ornamental grasses */}
      <Instanced geometry={GEO.planter} material={M.planterStone} items={planters} cast name="planter-bowls" />
      <Instanced geometry={CYL} material={M.soil} items={soils} name="planter-soil" />
      <Instanced geometry={GEO.blade} material={M.foliageSoft} items={blades} name="planter-grass" />
      <Instanced geometry={GEO.blade} material={M.foliageTip} items={bladeTips} name="planter-grass-warm" />

      {/* Soft beveled wheeled cabin suitcase + naturally slumped leather weekender bag */}
      <group position={[16.8, 0, 2.08]} rotation={[0, 0.32, 0]}>
        <mesh geometry={GEO.suitcase} material={M.suitcaseMat} position={[0, 0.35, 0]} castShadow name="suitcase" />
        <mesh geometry={GEO.suitcaseHandle} material={M.brushedSteel} name="suitcase-handle" />
        {[-0.14, 0.14].flatMap((wx) =>
          [-0.08, 0.08].map((wz) => (
            <mesh key={`${wx}${wz}`} geometry={CYL} material={M.darkMetal} position={[wx, 0.025, wz]} scale={[0.028, 0.022, 0.028]} rotation={[Math.PI / 2, 0, 0]} />
          )),
        )}
        <mesh geometry={GEO.weekender} material={M.leather} position={[-0.48, 0, 0.12]} rotation={[0, -0.45, 0]} castShadow name="weekender-bag" />
      </group>

      {/* Glass-and-stainless architectural platform waiting windbreaks */}
      <Instanced geometry={CYL} material={M.brushedSteel} items={shelterPosts} name="shelter-posts" />
      <Instanced geometry={GEO.shelterRoof} material={M.castIron} items={shelterRoofs} name="shelter-roofs" />
      <Instanced geometry={GEO.shelterGlass} material={M.glass} items={shelterGlass} name="shelter-glass" />
      <Instanced geometry={CYL} material={M.brushedSteel} items={spiderPins} name="shelter-clasps" />

      {/* Rounded CCTV dome poles */}
      <Instanced geometry={CYL} material={M.castIron} items={cctvPoles} name="cctv-poles" />
      <Instanced geometry={GEO.lanternGlobe} material={M.darkMetal} items={cctvBodies} name="cctv-domes" />

      {/* Bevelled passenger help point & ticket vending kiosk */}
      <group position={[-14, 0, -2.55]}>
        <mesh geometry={GEO.helpBody} material={M.castIron} position={[0, 0.86, 0]} castShadow name="help-point" />
        <B p={[0, 1.4, 0.165]} s={[0.32, 0.36, 0.015]} m={M.help} recv={false} />
        <B p={[0, 1.04, 0.165]} s={[0.22, 0.12, 0.015]} m={M.darkMetal} />
      </group>
      <group position={[-20, 0, -2.18]}>
        <mesh geometry={GEO.kioskBody} material={M.darkMetal} position={[0, 0.96, 0]} castShadow name="ticket-kiosk" />
        <B p={[0, 1.18, 0.415]} s={[0.76, 1.12, 0.016]} m={M.vendingFront} recv={false} />
        <B p={[0, 0.36, 0.415]} s={[0.56, 0.22, 0.018]} m={M.brushedSteel} />
      </group>

      {/* Soft bevelled double-sided railway advertising displays near far platform end */}
      {[
        [-48, -2.6, M.poster0],
        [-38, -2.6, M.poster1],
      ].map(([px, pz, mat], i) => (
        <group key={i} position={[px as number, 0, pz as number]}>
          <mesh geometry={GEO.posterFrame} material={M.darkMetal} position={[0, 1.18, 0]} castShadow name="poster-box" />
          <mesh geometry={PLANE} material={mat as THREE.Material} position={[0, 1.2, 0.058]} scale={[0.84, 1.32, 1]} />
          <mesh geometry={PLANE} material={mat as THREE.Material} position={[0, 1.2, -0.058]} rotation={[0, Math.PI, 0]} scale={[0.84, 1.32, 1]} />
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Overhead Electrification (parabolic gravity sag + ceramic sheds)   */
/* ------------------------------------------------------------------ */
function Catenary({ M }: { M: Materials }) {
  const { masts, arms, stays, insulators, sags, droppers } = useMemo(() => {
    const xs = range(-L / 2 + 20, L / 2 - 20, 40)
    const masts = xs.flatMap((x) => [-1, 1].map((s) => ({ p: [x, GROUND + 3.7, s * 10.6] as V3, s: [0.095, 7.4, 0.095] as V3 })))
    const arms = xs.flatMap((x) =>
      [-1, 1].map((s) => ({ p: [x, GROUND + 6.52, s * 8.45] as V3, s: [0.036, 4.3, 0.036] as V3, r: [Math.PI / 2, 0, 0] as V3 })),
    )
    const stays = xs.flatMap((x) =>
      [-1, 1].map((s) => ({ p: [x, GROUND + 6.95, s * 8.6] as V3, s: [0.018, 4.1, 0.018] as V3, r: [Math.PI / 2 + s * 0.24, 0, 0] as V3 })),
    )
    const insulators = xs.flatMap((x) => [-1, 1].map((s) => ({ p: [x, GROUND + 6.32, s * TRACK_Z] as V3 })))
    // Real parabolic sagging catenary messenger spans between masts!
    const sags: { p: V3 }[] = []
    const droppers: { p: V3; s: V3 }[] = []
    for (let x = -L / 2 + 40; x <= L / 2 - 40; x += 40) {
      for (const s of [-1, 1]) {
        sags.push({ p: [x, RAIL_TOP + 6.18, s * TRACK_Z] })
        // vertical tension dropper wires hanging cleanly from curved messenger to flat contact wire
        if (Math.abs(x) <= 80) {
          for (const f of [0.2, 0.35, 0.5, 0.65, 0.8]) {
            const dx = (f - 0.5) * 40
            const topY = RAIL_TOP + 6.18 - 0.56 * 4 * f * (1 - f)
            const botY = RAIL_TOP + 5.26
            const h = topY - botY
            droppers.push({ p: [x + dx, botY + h / 2, s * TRACK_Z], s: [0.006, h, 0.006] })
          }
        }
      }
    }
    return { masts, arms, stays, insulators, sags, droppers }
  }, [])

  return (
    <group>
      <Instanced geometry={CYL} material={M.castIron} items={masts} name="catenary-masts" />
      <Instanced geometry={CYL} material={M.castIron} items={arms} name="catenary-arms" />
      <Instanced geometry={CYL} material={M.brushedSteel} items={stays} name="catenary-stays" />
      <Instanced geometry={GEO.insulator} material={M.ceramic} items={insulators} name="ceramic-insulators" />
      <Instanced geometry={GEO.catenarySag} material={M.darkMetal} items={sags} recv={false} name="catenary-messenger" />
      <Instanced geometry={CYL_SM} material={M.darkMetal} items={droppers} recv={false} name="catenary-droppers" />
      {/* Tensioned horizontal cylindrical copper-dark contact wires */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={CYL}
          material={M.darkMetal}
          position={[0, RAIL_TOP + 5.26, s * TRACK_Z]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[0.011, L, 0.011]}
          name="contact-wire"
        />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Smooth Aerodynamic Class 387 Express Train + Contoured Saloon      */
/* ------------------------------------------------------------------ */
const CAR = 19.6
const CAR_X = [-20.1, 0, 20.1]
const WINDOWS: [number, number][] = [
  [-8.38, 1.66],
  [-3.82, 2.26],
  [-1.26, 2.24],
  [1.26, 2.24],
  [3.82, 2.26],
  [8.38, 1.66],
]

/** Smooth monolithic compound-curved aerodynamic railcar cab (zero sharp box edges!). */
function SculptedCab({ dir, M, head }: { dir: 1 | -1; M: Materials; head: boolean }) {
  const X = dir * (CAR / 2)
  return (
    <group position={[X, 0, 0]} rotation={[0, dir === 1 ? 0 : Math.PI, 0]}>
      {/* Seamless clearcoated aerodynamic nose shell with curved windscreen, LED clusters & swoosh stripe */}
      <mesh geometry={GEO.cabHull} material={head ? M.cabHead : M.cabTail} castShadow receiveShadow name={head ? 'cab-front' : 'cab-tail'} />
      {/* Smooth swept lower graphite valance / obstacle deflector cowling */}
      <mesh geometry={GEO.cabSkirt} material={M.darkMetal} castShadow name="cab-skirt" />
      {/* Sculpted rounded Scharfenberg automatic coupler protruding smoothly from below nose */}
      <mesh geometry={GEO.couplerBar} material={M.darkMetal} position={[1.18, -0.08, 0]} castShadow />
      <mesh geometry={GEO.couplerHead} material={M.steel} position={[1.54, -0.08, 0]} castShadow />
      {/* Subtle glossy curved nose horn/light accent bezel bar */}
      <mesh geometry={CYL} material={M.brushedSteel} position={[1.38, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.022, 0.68, 0.022]} />
    </group>
  )
}

/** Smooth-roofed passenger carriage with clear rounded-corner windows & vaulted acoustic interior. */
function Car({ x, M, front, back }: { x: number; M: Materials; front?: boolean; back?: boolean }) {
  const floor = 0.1
  const bodyH = 3.06
  const cy = 1.44
  return (
    <group position={[x, 0, TRACK_Z]}>
      {/* Seamless clearcoated automotive metallic side skins with smooth rounded window openings */}
      <mesh geometry={PLANE} material={M.trainBody} position={[0, cy, -1.445]} rotation={[0, Math.PI, 0]} scale={[CAR, bodyH, 1]} castShadow name="train-side" />
      <mesh geometry={PLANE} material={M.trainBody} position={[0, cy, 1.445]} scale={[CAR, bodyH, 1]} name="train-side" />

      {/* Smooth tangent-blended elliptical curved outer carriage roof shell + streamlined HVAC pods */}
      <mesh geometry={GEO.trainRoof} material={M.trainRoof} castShadow receiveShadow name="train-roof" />
      <mesh geometry={GEO.roofPod} material={M.trainPlain} position={[-5.1, 3.16, 0]} castShadow name="hvac-pod" />
      <mesh geometry={GEO.roofPod} material={M.trainPlain} position={[5.1, 3.16, 0]} castShadow name="hvac-pod" />

      {/* Softly arched seamless interior vaulted acoustic ceiling! */}
      <mesh geometry={GEO.trainCeiling} material={M.interiorCeiling} name="train-inner-ceiling" />

      {/* Curved saloon interior lower walls, padded acoustic pillars & soft brushed window sills */}
      <B p={[0, 0.72, -1.39]} s={[CAR - 0.16, 1.24, 0.06]} m={M.interiorWall} />
      <B p={[0, 0.72, 1.39]} s={[CAR - 0.16, 1.24, 0.06]} m={M.interiorWall} />
      {/* Bevelled warm wood/metal interior window-ledge armrest sill running down both walls */}
      <mesh geometry={CYL} material={M.interiorWall} position={[0, 1.35, -1.35]} rotation={[0, 0, Math.PI / 2]} scale={[0.042, CAR - 0.3, 0.042]} />
      <mesh geometry={CYL} material={M.interiorWall} position={[0, 1.35, 1.35]} rotation={[0, 0, Math.PI / 2]} scale={[0.042, CAR - 0.3, 0.042]} />
      <B p={[0, 2.6, -1.39]} s={[CAR - 0.16, 0.36, 0.06]} m={M.interiorWall} />
      <B p={[0, 2.6, 1.39]} s={[CAR - 0.16, 0.36, 0.06]} m={M.interiorWall} />

      {/* Rounded moulded interior acoustic piers batched in a single instanced mesh */}
      <Instanced
        geometry={CYL}
        material={M.interiorWall}
        items={[-9.48, -7.38, -5.28, -2.52, 0, 2.52, 5.28, 7.38, 9.48].flatMap((px) => [
          { p: [px, 1.94, -1.38] as V3, s: [0.1, 1.18, 0.05] as V3 },
          { p: [px, 1.94, 1.38] as V3, s: [0.1, 1.18, 0.05] as V3 },
        ])}
        name="car-piers"
      />

      {/* Clean car-end interior walk-through bulkheads + warm glowing amber PIS display */}
      {[-9.65, 9.65].map((bx) => (
        <group key={bx} position={[bx, 0, 0]}>
          <B p={[0, 1.48, -0.96]} s={[0.09, 2.62, 0.84]} m={M.interiorWall} />
          <B p={[0, 1.48, 0.96]} s={[0.09, 2.62, 0.84]} m={M.interiorWall} />
          <B p={[0, 2.52, 0]} s={[0.09, 0.56, 1.12]} m={M.interiorWall} />
          <mesh
            geometry={PLANE}
            material={M.pisBanner}
            position={[bx < 0 ? 0.055 : -0.055, 2.38, 0]}
            rotation={[0, bx < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
            scale={[1.04, 0.14, 1]}
          />
        </group>
      ))}

      {/* Anti-slip floor + curved platform-threshold safety edge */}
      <B p={[0, floor + 0.06, 0]} s={[CAR, 0.12, 2.76]} m={M.trainFloor} />
      {[-6.4, 6.4].map((dx) => (
        <B key={dx} p={[dx, floor + 0.122, -1.28]} s={[1.45, 0.005, 0.16]} m={M.yellowLine} />
      ))}

      {/* Rounded streamlined dark lower equipment shroud skirts */}
      <B p={[0, -0.15, 0]} s={[CAR - 0.35, 0.36, 2.62]} m={M.darkMetal} />
      <mesh geometry={CYL} material={M.darkMetal} position={[0, -0.08, -1.32]} rotation={[0, 0, Math.PI / 2]} scale={[0.14, CAR - 0.5, 0.14]} />
      <mesh geometry={CYL} material={M.darkMetal} position={[0, -0.08, 1.32]} rotation={[0, 0, Math.PI / 2]} scale={[0.14, CAR - 0.5, 0.14]} />

      {/* Seamless sculpted aerodynamic front & rear cab cones */}
      {front && <SculptedCab dir={-1} M={M} head />}
      {back && <SculptedCab dir={1} M={M} head={false} />}
    </group>
  )
}

/** Smooth sculpted ergonomic commuter train interior: contoured plush seats, headrests, tubular loops, hand-straps & glowing LED coves. */
function TrainSaloon({
  M,
  leftDoorsRef,
  rightDoorsRef,
}: {
  M: Materials
  leftDoorsRef: React.RefObject<THREE.Group | null>
  rightDoorsRef: React.RefObject<THREE.Group | null>
}) {
  const {
    cushions,
    backs,
    headrests,
    legs,
    arms,
    loops,
    trays,
    poles,
    rails,
    straps,
    shelves,
    draughtGlass,
    lights,
    ceilingRibs,
    routes,
    leftDoorItems,
    rightDoorItems,
  } = useMemo(() => {
    const cushions: { p: V3; r: V3 }[] = []
    const backs: { p: V3; r: V3 }[] = []
    const headrests: { p: V3; r: V3 }[] = []
    const legs: { p: V3 }[] = []
    const arms: { p: V3; r: V3 }[] = []
    const loops: { p: V3; r: V3 }[] = []
    const trays: { p: V3; r: V3 }[] = []
    const poles: { p: V3; s: V3 }[] = []
    const rails: { p: V3; s: V3; r: V3 }[] = []
    const straps: { p: V3 }[] = []
    const shelves: { p: V3 }[] = []
    const draughtGlass: { p: V3 }[] = []
    const lights: { p: V3 }[] = []
    const ceilingRibs: { p: V3 }[] = []
    const routes: { p: V3; s: V3; r: V3 }[] = []
    const leftDoorItems: { p: V3; s: V3 }[] = []
    const rightDoorItems: { p: V3; s: V3 }[] = []

    const rowXs = [-8.75, -7.85, -4.65, -3.72, -2.78, -1.85, -0.92, 0.0, 0.92, 1.85, 2.78, 3.72, 4.65, 7.85, 8.75]

    CAR_X.forEach((cx) => {
      // 1. Ergonomically contoured 2+2 seating with waterfall cushion, S-curve backrest,
      //    twin separate sculpted leatherette pillow headrests, graceful armrests & tubular grab loops!
      rowXs.forEach((rx, ri) => {
        const x = cx + rx
        const facing = ri < 2 ? 1 : -1
        const ry = facing === 1 ? 0 : Math.PI
        for (const oz of [-0.86, 0.86]) {
          const z = TRACK_Z + oz
          cushions.push({ p: [x + facing * 0.03, 0.48, z], r: [0, ry, 0] })
          backs.push({ p: [x - facing * 0.16, 0.51, z], r: [0, ry, 0] })
          legs.push({ p: [x - facing * 0.06, 0.3, z] })
          // Twin individual rounded leatherette headrest bolsters (gives lush realistic two-seat curve!)
          headrests.push({ p: [x - facing * 0.25, 1.18, z - 0.22], r: [0, 0, -facing * 0.16] })
          headrests.push({ p: [x - facing * 0.25, 1.18, z + 0.22], r: [0, 0, -facing * 0.16] })
          // Graceful sweeping tubular corner grab handle on top aisle side of seat back
          const isPos = oz > 0
          const aisleZ = z + (isPos ? -0.44 : 0.44)
          loops.push({ p: [x - facing * 0.25, 1.24, aisleZ], r: [0, isPos ? 0 : Math.PI, 0] })
          // Soft curved tubular aisle armrest
          arms.push({ p: [x, 0.64, aisleZ], r: [0, ry, 0] })
          // Compact bevelled rear seat-back tray tables (two individual fold-downs)
          trays.push({ p: [x - facing * 0.28, 0.85, z - 0.21], r: [0, 0, -facing * 0.14] })
          trays.push({ p: [x - facing * 0.28, 0.85, z + 0.21], r: [0, 0, -facing * 0.14] })
        }
      })

      // 2. Smooth rounded laminated-glass vestibule draught screens separating doors from seats
      ;[-7.36, -5.44, 5.44, 7.36].forEach((sx) => {
        ;[-0.88, 0.88].forEach((oz) => {
          draughtGlass.push({ p: [cx + sx, 1.38, TRACK_Z + oz] })
        })
      })

      // 3. Sleek round gloss-amber vertical grab stanchions
      ;[-6.4, 6.4].forEach((dx) => {
        ;[-0.64, 0.64].forEach((ox) => {
          ;[-0.56, 0.56].forEach((oz) => {
            poles.push({ p: [cx + dx + ox, 1.5, TRACK_Z + oz], s: [0.02, 2.66, 0.02] })
          })
        })
      })
      ;[-2.8, 0.0, 2.8].forEach((px) => {
        ;[-0.41, 0.41].forEach((oz) => {
          poles.push({ p: [cx + px, 1.5, TRACK_Z + oz], s: [0.019, 2.68, 0.019] })
        })
      })

      // 4. Continuous brushed-aluminum tubular overhead grab rails + real teardrop hanging commuter hand-straps!
      ;[-0.44, 0.44].forEach((oz) => {
        rails.push({ p: [cx, 2.26, TRACK_Z + oz], s: [0.016, CAR - 1.0, 0.016], r: [0, 0, Math.PI / 2] })
        ;[-6.8, -6.0, -3.4, -1.8, -0.2, 1.4, 3.0, 6.0, 6.8].forEach((sx) => {
          straps.push({ p: [cx + sx, 2.25, TRACK_Z + oz] })
        })
      })

      // 5. Rounded anodized-aluminum overhead luggage racks along both sides
      ;[-1.08, 1.08].forEach((oz) => shelves.push({ p: [cx, 2.34, TRACK_Z + oz] }))

      // 6. Dual recessed softly bevelled warm-white linear ceiling LED coves + delicate arched ceiling panel trims
      ;[-0.48, 0.48].forEach((oz) => lights.push({ p: [cx, 2.85, TRACK_Z + oz] }))
      ;[-7.4, -5.2, -2.5, 0, 2.5, 5.2, 7.4].forEach((rx) => ceilingRibs.push({ p: [cx + rx, 0, TRACK_Z] }))

      // 7. Crisp inner route-line station strips mounted flush above windows
      routes.push({ p: [cx, 2.52, TRACK_Z - 1.35], s: [3.2, 0.16, 1], r: [0, 0, 0] })
      routes.push({ p: [cx, 2.52, TRACK_Z + 1.35], s: [3.2, 0.16, 1], r: [0, Math.PI, 0] })

      // 8. Animated rounded double-leaf sliding plug doors (platform side)
      ;[-6.4, 6.4].forEach((dx) => {
        leftDoorItems.push({ p: [cx + dx - 0.36, 1.46, TRACK_Z - 1.415], s: [0.68, 2.32, 0.032] })
        rightDoorItems.push({ p: [cx + dx + 0.36, 1.46, TRACK_Z - 1.415], s: [0.68, 2.32, 0.032] })
      })
    })

    return {
      cushions,
      backs,
      headrests,
      legs,
      arms,
      loops,
      trays,
      poles,
      rails,
      straps,
      shelves,
      draughtGlass,
      lights,
      ceilingRibs,
      routes,
      leftDoorItems,
      rightDoorItems,
    }
  }, [])

  return (
    <group name="train-saloon">
      <Instanced geometry={GEO.seatCushion} material={M.seatMoquette} items={cushions} name="seat-cushions" />
      <Instanced geometry={GEO.seatBack} material={M.seatMoquette} items={backs} name="seat-backs" />
      <Instanced geometry={GEO.seatHeadrest} material={M.headrest} items={headrests} name="seat-headrests" />
      <Instanced geometry={GEO.seatLeg} material={M.seatFrame} items={legs} name="seat-legs" />
      <Instanced geometry={GEO.seatArm} material={M.darkMetal} items={arms} name="seat-armrests" />
      <Instanced geometry={GEO.seatLoop} material={M.brushedSteel} items={loops} name="seat-grab-loops" />
      <Instanced geometry={GEO.seatTray} material={M.seatTray} items={trays} name="seat-trays" />
      <Instanced geometry={CYL} material={M.grabPole} items={poles} name="grab-poles" />
      <Instanced geometry={CYL} material={M.brushedSteel} items={rails} name="overhead-rails" />
      <Instanced geometry={GEO.handStrap} material={M.strapMat} items={straps} name="hand-straps" />
      <Instanced geometry={GEO.luggageShelf} material={M.brushedSteel} items={shelves} name="luggage-racks" />
      <Instanced geometry={GEO.draughtGlass} material={M.glass} items={draughtGlass} name="draught-screens" />
      <Instanced geometry={GEO.ceilingRib} material={M.steelLight} items={ceilingRibs} name="ceiling-ribs" />
      <Instanced geometry={GEO.ledTube} material={M.trainCeilingLight} items={lights} recv={false} name="train-ceiling-lights" />
      <Instanced geometry={PLANE} material={M.routeStrip} items={routes} name="route-strips" />

      <group ref={leftDoorsRef}>
        <Instanced material={M.trainPlain} items={leftDoorItems} name="left-sliding-doors" />
      </group>
      <group ref={rightDoorsRef}>
        <Instanced material={M.trainPlain} items={rightDoorItems} name="right-sliding-doors" />
      </group>
    </group>
  )
}

/** Flanged steel wheels, rounded rubber gangways, clear acoustic glass, coil springs & graceful pantograph. */
function TrainDetail({ M }: { M: Materials }) {
  const { glass, bogies, springs, wheels, gangways } = useMemo(() => {
    const glass: { p: V3; s: V3 }[] = []
    const bogies: { p: V3; s: V3 }[] = []
    const springs: { p: V3; s: V3 }[] = []
    const wheels: { p: V3 }[] = []
    const gangways: { p: V3; s: V3 }[] = []

    CAR_X.forEach((cx) => {
      WINDOWS.forEach(([wx, ww]) =>
        [-1, 1].forEach((s) => {
          glass.push({ p: [cx + wx, 1.95, TRACK_Z + s * 1.44], s: [ww, 0.96, 0.012] })
        }),
      )
      ;[-6.5, 6.5].forEach((bx) => {
        bogies.push({ p: [cx + bx, RAIL_TOP + 0.52, TRACK_Z], s: [2.7, 0.42, 2.25] })
        // secondary pneumatic air-spring bellows cushions!
        ;[-1.08, 1.08].forEach((sz) => springs.push({ p: [cx + bx, RAIL_TOP + 0.62, TRACK_Z + sz], s: [0.24, 0.28, 0.24] }))
        ;[-1.25, 1.25].forEach((wx) =>
          [-1, 1].forEach((s) => wheels.push({ p: [cx + bx + wx, RAIL_TOP + 0.44, TRACK_Z + (s * GAUGE) / 2] })),
        )
      })
    })

    // Corrugated soft-profile hollow walkthrough rubber gangway bellows between cars
    for (let i = 0; i < CAR_X.length - 1; i++) {
      const gx = CAR_X[i] + CAR / 2 + 0.25
      for (const off of [-0.14, 0, 0.14]) {
        gangways.push({ p: [gx + off, 1.46, TRACK_Z - 1.12], s: [0.11, 2.68, 0.2] })
        gangways.push({ p: [gx + off, 1.46, TRACK_Z + 1.12], s: [0.11, 2.68, 0.2] })
        gangways.push({ p: [gx + off, 2.86, TRACK_Z], s: [0.11, 0.22, 2.38] })
      }
    }
    return { glass, bogies, springs, wheels, gangways }
  }, [])

  return (
    <group>
      <Instanced material={M.trainGlass} items={glass} name="train-glass" />
      <Instanced material={M.darkMetal} items={bogies} name="train-bogies" />
      <Instanced geometry={CYL} material={M.castIron} items={springs} name="bogie-springs" />
      <Instanced geometry={GEO.wheel} material={M.railHead} items={wheels} name="train-wheels" />
      <Instanced material={M.darkMetal} items={gangways} name="gangways" />
      {/* Graceful tubular single-arm Brecknell Willis rooftop pantograph on centre carriage */}
      <group position={[1.2, 3.22, TRACK_Z]}>
        {[-0.65, 0.65].map((z) => (
          <mesh key={z} geometry={GEO.insulator} material={M.ceramic} position={[0, 0.14, z]} scale={[0.7, 0.65, 0.7]} />
        ))}
        <mesh geometry={CYL} material={M.brushedSteel} position={[-0.36, 0.48, 0]} rotation={[0, 0, -0.78]} scale={[0.028, 1.18, 0.028]} />
        <mesh geometry={CYL} material={M.brushedSteel} position={[0.24, 0.86, 0]} rotation={[0, 0, 0.85]} scale={[0.024, 1.08, 0.024]} />
        <mesh geometry={CYL} material={M.darkMetal} position={[-0.1, 1.08, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.026, 1.88, 0.026]} />
      </group>
    </group>
  )
}

/** Distant matching sculpted express train visible smoothly down Track 1 in the haze. */
function DistantTrain({ M }: { M: Materials }) {
  return (
    <group position={[-106, 0, -TRACK_Z]}>
      <B p={[0, 1.44, 0]} s={[38, 2.86, 2.82]} m={M.trainPlain} />
      <mesh geometry={GEO.trainRoof} material={M.trainRoof} position={[0, 0, 0]} scale={[1.94, 1, 1]} />
      <mesh geometry={GEO.cabHull} material={M.cabHead} position={[19, 0, 0]} />
      {[-1, 1].map((s) => (
        <B key={s} p={[0, 1.9, s * 1.42]} s={[34, 0.88, 0.02]} m={M.trainInteriorGlow} recv={false} />
      ))}
    </group>
  )
}

/** Running scheduled Class 387 train (direct GPU-friendly Three.js transform + sliding doors). */
function Train({ M }: { M: Materials }) {
  const trainGroupRef = useRef<THREE.Group>(null)
  const leftDoorsRef = useRef<THREE.Group>(null)
  const rightDoorsRef = useRef<THREE.Group>(null)
  const updateTrainStatus = useStore((s) => s.updateTrainStatus)

  const sim = useRef({
    x: 0,
    v: 0,
    state: 'at_station' as TrainScheduleState,
    dwell: 13.0,
    door: 1.0,
    lastSec: -1,
  })
  const prevState = useRef<string>('at_station')

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.25)
    const s = sim.current
    const storeState = useStore.getState()

    if (storeState.trainManualTrigger === 'depart') {
      s.dwell = 0
      s.door = 0
      s.v = -2.5
      s.state = 'departing'
      storeState.clearTrainTrigger()
    } else if (storeState.trainManualTrigger === 'arrive') {
      s.x = 185
      s.v = -14.0
      s.state = 'arriving'
      storeState.clearTrainTrigger()
    }

    if (s.state === 'at_station') {
      s.x = 0
      s.v = 0
      if (!storeState.trainHold) s.dwell -= dt
      if (s.dwell > 10.5) s.door = Math.min(1.0, s.door + dt * 1.5)
      else if (s.dwell <= 1.8) s.door = Math.max(0, s.door - dt * 1.8)
      if (s.dwell <= 0) {
        s.door = 0
        s.state = 'departing'
        s.dwell = 0
      }
    } else if (s.state === 'departing') {
      s.door = 0
      s.v = Math.max(s.v - 3.4 * dt, -16.0)
      s.x += s.v * dt
      if (s.x < -185) {
        s.state = 'in_transit'
        s.dwell = 6.0
      }
    } else if (s.state === 'in_transit') {
      s.door = 0
      s.v = 0
      s.dwell -= dt
      if (s.dwell <= 0) {
        s.x = 185
        s.v = -14.0
        s.state = 'arriving'
      }
    } else if (s.state === 'arriving') {
      s.door = 0
      const targetSpeed = -Math.max(1.1, Math.sqrt(2 * 2.2 * Math.max(0.1, s.x)))
      s.v = Math.max(s.v - 2.8 * dt, targetSpeed)
      s.x += s.v * dt
      if (s.x <= 0.05) {
        s.x = 0
        s.v = 0
        s.state = 'at_station'
        s.dwell = 13.0
        s.door = 0
      }
    }

    if (trainGroupRef.current) trainGroupRef.current.position.x = s.x
    if (leftDoorsRef.current) leftDoorsRef.current.position.x = -0.42 * s.door
    if (rightDoorsRef.current) rightDoorsRef.current.position.x = 0.42 * s.door
    ;(window as unknown as { __trainX: number }).__trainX = s.x

    const curSec = Math.floor(s.dwell)
    if (s.lastSec !== curSec || s.state !== prevState.current) {
      s.lastSec = curSec
      prevState.current = s.state
      updateTrainStatus(s.state, Math.round(Math.abs(s.v) * 3.6), Math.max(0, curSec))
    }
  })

  return (
    <group name="train">
      <group ref={trainGroupRef}>
        <Car x={CAR_X[0]} M={M} front />
        <Car x={CAR_X[1]} M={M} />
        <Car x={CAR_X[2]} M={M} back />
        <TrainSaloon M={M} leftDoorsRef={leftDoorsRef} rightDoorsRef={rightDoorsRef} />
        <TrainDetail M={M} />
      </group>
      <DistantTrain M={M} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Station Root                                                       */
/* ------------------------------------------------------------------ */
export function Station({ wet, train, lampOn }: { wet: boolean; train: boolean; lampOn: number }) {
  const M = useMaterials(wet, lampOn)
  return (
    <group name="station">
      <Surroundings M={M} />
      <Platform M={M} />
      <Canopy M={M} />
      <Footbridge M={M} />
      <Signage M={M} />
      <Furniture M={M} />
      <Catenary M={M} />
      {train && <Train M={M} />}
    </group>
  )
}
