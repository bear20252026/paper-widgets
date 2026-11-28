/**
 * Strict 120 Hz Off-Piste Freeride Skiing Physics Engine (Wave 4):
 *  - Real slope-normal gravity decomposition on EU-DEM Chamonix slopes
 *  - 4-point terrain contact sampling (left ski, right ski, tip, tail) with powder tip-dive & ice edge-catch feedback
 *  - Carving vs. skidding (slip angle between ski heading & velocity) with crisp twin-ski track events
 *  - Switch (fakie / backwards) skiing on clean 180° / 540° landings (over-the-shoulder fall-line look!)
 *  - Dynamic Slab Avalanche trigger & propagation (automatic on steep >32° wind-loaded powder OR manual `G`)
 *  - Natural freeride wind-lip / cornice kicker ramp launch detection
 *  - 30 Hz lightweight Run Recorder (`replayFrames`) for instant Helicopter Replay (`P`)
 *  - Pre-load crouch + ollie/pop, independent 3-axis mid-air flips/spins/corks + Mute Grab
 *  - Strict landing alignment evaluation & authentic tumble/tomahawk wipeouts
 */
import * as THREE from 'three';
import { SURFACE_TYPES } from './terrain_data.js';

const GRAVITY = 9.81;

function wrapAngle(a) {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export class SkiPhysics {
  constructor(terrainData, colliders = [], kickers = []) {
    this.terrainData = terrainData;
    this.colliders = colliders;
    this.kickers = kickers;

    // Input state
    this.keys = new Set();
    this.mouseSteer = 0;
    this.gamepadSteer = 0;
    this.gamepadFore = 0;
    this.gamepadBrake = 0;
    this.gamepadCork = 0;
    this.gamepadJump = false;
    this.gamepadGrab = false;
    this.touchSteer = 0;
    this.touchFore = 0;
    this.smoothCarve = false;  // optional gentler progressive A/D ramp for laptop keyboard tapping
    this._smoothKeySteer = 0;
    this.lookYawOff = 0;       // head yaw relative to ski heading (radians, + = right)
    this.lookPitchOff = 0;     // head pitch relative to slope horizon (radians, + = up)
    this.headSteerEnabled = false; // PURE free mouse head-look (skis stay strictly controlled by A/D, independent of gaze!)
    this.freeLookHeld = false;
    this.grabHeld = false;
    this.touchPoleHeld = false;
    this.jumpHeld = false;
    this.prevJumpHeld = false;

    // Core kinematic state
    this.state = {
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      speed: 0,
      yaw: 0,           // ski heading compass radians (0 = North -Z, +pi/2 = East +X)
      edgeAngle: 0,
      crouch: 0,
      popCharge: 0,
      foreAft: 0,
      slipAngle: 0,
      turnLead: 0,
      shiftyAngle: 0,
      isSwitch: false,
      grounded: true,
      crashed: false,
      crashTimer: 0,
      crashReason: '',
      grabbing: false,
      airTime: 0,
      peakAirHeight: 0,
      launchY: 0,
      airPitch: 0,
      airYaw: 0,
      airRoll: 0,
      angPitch: 0,
      angYaw: 0,
      angRoll: 0,
      grabDuration: 0,
      surface: SURFACE_TYPES.POWDER,
      slopeDeg: 0,
      terrainY: 0,
      normal: new THREE.Vector3(0, 1, 0),
      quat: new THREE.Quaternion(),
      bodyQuat: new THREE.Quaternion(),
      prevLeftSki: null,
      prevRightSki: null,
      // 4-point contact telemetry
      rollContact: 0,
      pitchContact: 0,
      // Telemetry / stats
      startElev: 0,
      verticalDropped: 0,
      maxSpeedKmh: 0,
      lastTrickText: '',
      lastTrickTime: -99,
      lastLandingQuality: '',
      faceShotIntensity: 0,
      camShake: 0,
      landImpact: 0,
      sluffTrigger: 0,
      sprayRate: 0,
      breathing: 0,
      // Bundle B tactile skiing feel & body dynamics
      polePlantL: 0,
      polePlantR: 0,
      skatePhase: 0,
      skatePush: 0,
      insideUnweight: 0,
      scissorSpread: 0,
      bowWave: 0,
      // Wave 12 authentic fall-line / edging / poling telemetry
      edgeDeg: 0,         // signed physical edge angle relative to snow (-64..+64 deg)
      fallAngleDeg: 0,    // signed angle between ski heading and fall line (0=fall line, ±90=traverse, ±180=uphill)
      uphillEdge: 0,      // +1 biting uphill edge, -1 tipped downhill into fall line, 0 flat/level
      sideslip: 0,        // 0..1 active gravitational sideslip across steep slope
      washOut: 0,         // 0..1 edge traction saturation / icy chatter washout
      carveLoadG: 1.0,    // effective G-load on ski edges (1.0 = neutral gravity)
      stanceMode: 'FLAT', // 'FLAT' | 'POLE' | 'GLIDE' | 'CARVE' | 'SLIP' | 'SKID' | 'UPHILL' | 'AIR'
      poleStrokePulse: 0, // decaying pulse from discrete manual pole push (F / Q / E / W)
      stepBounce: 0,      // subtle vertical knee bounce during low-speed step-turns
    };

    // Dynamic Slab Avalanche simulation state
    this.avalanchesEnabled = true;
    this.avalanche = {
      active: false,
      strength: 0,
      originX: 0,
      originZ: 0,
      dirX: 0,
      dirZ: 1,
      frontDist: 0,
      width: 28,
      speed: 20,
      age: 0,
      maxDist: 920,
      proximity: 0,
      engulfed: false,
      cooldown: 0,
    };

    // 30 Hz Run Recorder for instant Helicopter Replay (`P`)
    this.replayFrames = [];
    this._recAccum = 0;
    this._kickerCooldown = 0;
    this._sprayAccum = 0;
    this._sluffAccum = 0;
    this._prevEdgeSign = 0;
    this._poleCooldown = 0;
    this._bootCreakCD = 0;
    this._prevCrouch = 0;
    this._prevSkateSin = 0;
    this._smoothKeySteer = 0;
    this._airPitchHoldMask = 0;
    this._whooshCD = new Map();

    // Active discrete pole-stroke impulse queue (smooth muscular drive phase rather than raw rocket thruster!)
    this._poleDriveTimer = 0;
    this._poleDriveDur = 0.28;
    this._poleDriveImpulse = 0;
    this._poleDriveSide = 0; // 0 = double-pole, -1 = left, +1 = right
    this._poleStrokeCD = 0;
    this._lastPoleHand = 0;
    this._lastPoleTime = -99;
    this._prevPoleF = false;
    this._prevPoleQ = false;
    this._prevPoleE = false;
    this._prevWPoling = false;
    this._poleBobY = 0;
    this._stepPhase = 0;
    this._reboundUnweight = 0;
    this._carveOmega = 0;

    // Reusable scratch vectors for 120 Hz fixed-step (zero GC churn!)
    this._tmpGrav = new THREE.Vector3();
    this._tmpGravTan = new THREE.Vector3();
    this._tmpFwd = new THREE.Vector3();
    this._tmpRight = new THREE.Vector3();
    this._tmpVel = new THREE.Vector3();
    this._tmpPushDir = new THREE.Vector3();

    this._tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._camFwdTmp = new THREE.Vector3();
    this._camUpTmp = new THREE.Vector3();
    this._camRgtTmp = new THREE.Vector3();
    this.camMode = 'gopro';
    this._smoothNormal = new THREE.Vector3(0, 1, 0);
    this._smoothCamRoll = 0;
    this._smoothSlopePitch = 0;
    this._switchYawBlend = 0;

    // Smooth critically-damped physical landing suspension & switch hop-spin state (Wave 14)
    this._landDisp = 0;
    this._landVel = 0;
    this._landPitch = 0;
    this._landPitchVel = 0;
    this._landRoll = 0;
    this._landRollVel = 0;
    this._scissorTarget = 0;
    this._switchSpinRem = 0;
    this._switchSpinDir = 1;
    this._switchHopT = 0;
    this._landingQuatBlend = 0;
    this._landingStartQuat = new THREE.Quaternion();
    this._tmpQuatTarget = new THREE.Quaternion();
    this._airBodyQuat = new THREE.Quaternion();
    this._upAxis = new THREE.Vector3(0, 1, 0);
    this._landCamDelta = new THREE.Vector3();
    this._prevCamRel = new THREE.Vector3();
    this._prevCamWasAir = false;
    this._hasPrevCamRel = false;

    this.events = [];
  }

  spawn(zone) {
    const t = this.terrainData.sampleTerrain(zone.x, zone.z);
    const s = this.state;
    s.x = zone.x;
    s.z = zone.z;
    s.y = t.y;
    s.terrainY = t.y;
    s.yaw = zone.yaw;
    s.vx = 0; s.vy = 0; s.vz = 0;
    s.speed = 0;
    s.edgeAngle = 0;
    s.crouch = 0;
    s.popCharge = 0;
    s.foreAft = 0;
    s.slipAngle = 0;
    s.turnLead = 0;
    s.shiftyAngle = 0;
    s.isSwitch = false;
    s.grounded = true;
    s.crashed = false;
    s.crashTimer = 0;
    s.crashReason = '';
    s.grabbing = false;
    s.airTime = 0;
    s.peakAirHeight = 0;
    s.airPitch = 0; s.airYaw = 0; s.airRoll = 0;
    s.angPitch = 0; s.angYaw = 0; s.angRoll = 0;
    s.grabDuration = 0;
    s.surface = t.surface;
    s.slopeDeg = t.slopeDeg;
    s.normal.set(t.nx, t.ny, t.nz);
    this._smoothNormal.set(t.nx, t.ny, t.nz);
    s.startElev = t.y;
    s.verticalDropped = 0;
    s.maxSpeedKmh = 0;
    s.prevLeftSki = null;
    s.prevRightSki = null;
    s.faceShotIntensity = 0;
    s.camShake = 0;
    s.landImpact = 0;
    s.sluffTrigger = 0;
    s.sprayRate = 0;
    s.breathing = 0;
    s.polePlantL = 0;
    s.polePlantR = 0;
    s.skatePhase = 0;
    s.skatePush = 0;
    s.insideUnweight = 0;
    s.scissorSpread = 0;
    s.bowWave = 0;
    s.edgeDeg = 0;
    const gHoriz = Math.hypot(t.gx, t.gz);
    if (gHoriz > 0.025) {
      const fYaw = Math.atan2(-t.gx, t.gz);
      s.fallAngleDeg = THREE.MathUtils.radToDeg(wrapAngle(fYaw - s.yaw));
    } else {
      s.fallAngleDeg = 0;
    }
    s.uphillEdge = 0;
    s.sideslip = 0;
    s.washOut = 0;
    s.carveLoadG = 1.0;
    s.stanceMode = t.slopeDeg < 5 ? 'FLAT' : 'GLIDE';
    s.poleStrokePulse = 0;
    s.stepBounce = 0;
    s.lastTrickText = '';
    s.rollContact = 0;
    s.pitchContact = 0;

    this.lookYawOff = 0;
    this.lookPitchOff = -0.14;
    this._smoothCamRoll = 0;
    this._switchYawBlend = 0;
    this._landDisp = 0;
    this._landVel = 0;
    this._landPitch = 0;
    this._landPitchVel = 0;
    this._landRoll = 0;
    this._landRollVel = 0;
    this._scissorTarget = 0;
    this._switchSpinRem = 0;
    this._switchSpinDir = 1;
    this._switchHopT = 0;
    this._landingQuatBlend = 0;
    this._airBodyQuat.setFromAxisAngle(this._upAxis, -s.yaw);
    s.bodyQuat.copy(this._airBodyQuat);
    this._landCamDelta.set(0, 0, 0);
    this._prevCamWasAir = false;
    this._hasPrevCamRel = false;
    const fwdX = Math.sin(s.yaw), fwdZ = -Math.cos(s.yaw);
    this._smoothSlopePitch = -Math.atan2(-t.gx * fwdX - t.gz * fwdZ, 1.0);
    this._updateGroundedQuaternion();

    this.resetAvalanche();
    this.replayFrames = [];
    this._recAccum = 0;
    this._kickerCooldown = 0;
    this._sprayAccum = 0;
    this._sluffAccum = 0;
    this._prevEdgeSign = 0;
    this._poleCooldown = 0;
    this._bootCreakCD = 0;
    this._prevCrouch = 0;
    this._prevSkateSin = 0;
    this._smoothKeySteer = 0;
    this._airPitchHoldMask = 0;
    this._poleDriveTimer = 0;
    this._poleDriveImpulse = 0;
    this._poleDriveSide = 0;
    this._poleStrokeCD = 0;
    this._lastPoleHand = 0;
    this._lastPoleTime = -99;
    this._prevPoleF = false;
    this._prevPoleQ = false;
    this._prevPoleE = false;
    this._prevWPoling = false;
    this._poleBobY = 0;
    this._stepPhase = 0;
    this._reboundUnweight = 0;
    this._carveOmega = 0;
    this._whooshCD = new Map();
    this.events.length = 0;
  }

  resetAvalanche() {
    const a = this.avalanche;
    a.active = false;
    a.strength = 0;
    a.frontDist = 0;
    a.age = 0;
    a.proximity = 0;
    a.engulfed = false;
    a.cooldown = 0;
  }

  setAvalanchesEnabled(enabled) {
    this.avalanchesEnabled = !!enabled;
    if (!this.avalanchesEnabled) {
      if (this.avalanche.active) {
        this.state.camShake = 0;
        this.events = this.events.filter((ev) => ev.type !== 'avalancheStart');
      }
      this.resetAvalanche();
    }
  }

  triggerAvalanche(uphillOffset = -22, customWidth = 30, force = false) {
    if (!this.avalanchesEnabled && !force) return false;
    const s = this.state;
    const t = this.terrainData.sampleTerrain(s.x, s.z);
    let dx = -t.gx;
    let dz = -t.gz;
    const mag = Math.hypot(dx, dz);
    if (mag > 0.04) {
      dx /= mag;
      dz /= mag;
    } else {
      dx = Math.sin(s.yaw);
      dz = -Math.cos(s.yaw);
    }
    const a = this.avalanche;
    a.active = true;
    a.strength = 1.0;
    // Crown fracture line rips uphill behind (or slightly ahead when custom offset > 0)
    a.originX = s.x + dx * uphillOffset;
    a.originZ = s.z + dz * uphillOffset;
    a.dirX = dx;
    a.dirZ = dz;
    a.frontDist = 4.0;
    a.width = customWidth;
    a.speed = 16.5 + THREE.MathUtils.clamp((t.slopeDeg - 20) * 0.45, 0, 10.0);
    a.age = 0;
    a.proximity = 0.65;
    a.engulfed = false;
    a.cooldown = 42.0;

    s.camShake = Math.max(s.camShake, 0.72);
    this.events.push({
      type: 'avalancheStart',
      x: a.originX,
      y: this.terrainData.sampleHeight(a.originX, a.originZ),
      z: a.originZ,
      width: a.width,
    });
    return true;
  }

  standUpHere() {
    const s = this.state;
    const t = this.terrainData.sampleTerrain(s.x, s.z);
    s.y = t.y;
    s.vx *= 0.1; s.vy = 0; s.vz *= 0.1;
    s.crashed = false;
    s.crashTimer = 0;
    s.grounded = true;
    s.isSwitch = false;
    s.edgeAngle = 0;
    s.crouch = 0;
    s.polePlantL = 0;
    s.polePlantR = 0;
    s.skatePush = 0;
    s.insideUnweight = 0;
    s.scissorSpread = 0;
    s.bowWave = 0;
    s.edgeDeg = 0;
    s.sideslip = 0;
    s.washOut = 0;
    s.carveLoadG = 1.0;
    s.poleStrokePulse = 0;
    s.stepBounce = 0;
    this._poleDriveTimer = 0;
    this._poleDriveImpulse = 0;
    this._poleBobY = 0;
    this._reboundUnweight = 0;
    this._carveOmega = 0;
    this._landDisp = 0;
    this._landVel = 0;
    this._landPitch = 0;
    this._landPitchVel = 0;
    this._landRoll = 0;
    this._landRollVel = 0;
    this._scissorTarget = 0;
    this._switchSpinRem = 0;
    this._switchSpinDir = 1;
    this._switchHopT = 0;
    this._landingQuatBlend = 0;
    s.landImpact = 0;
    s.angPitch = s.angYaw = s.angRoll = 0;
    s.airPitch = s.airYaw = s.airRoll = 0;
    s.prevLeftSki = null;
    s.prevRightSki = null;
    if (Math.hypot(t.gx, t.gz) > 0.08) {
      s.yaw = Math.atan2(-t.gx, t.gz);
    }
    this.lookYawOff = 0;
    this.lookPitchOff = -0.14;
    this._updateGroundedQuaternion();
  }

  /**
   * Toggle Switch (fakie) stance with a true 180° body AND camera perspective flip!
   *  - Live gameplay (`instant = false`): crisp 0.26s athletic hop-spin (`+8.5cm` unweight lift)
   *    turning both skis AND the player's first-person view 180° so you ride backward looking
   *    uphill over your ski tips and receding tracks (and can glance ±118° over your shoulder!).
   *  - Deterministic screenshot/API (`instant = true`): snaps cleanly 180° & syncs slope pitch.
   */
  toggleSwitch(time = 0, instant = false) {
    const s = this.state;
    if (!s.grounded || s.crashed) return false;
    s.isSwitch = !s.isSwitch;
    this._switchYawBlend = 0;
    if (instant) {
      const rem = this._switchSpinRem > 0.001 ? this._switchSpinDir * this._switchSpinRem : 0;
      s.yaw = wrapAngle(s.yaw + Math.PI - rem);
      this._switchSpinRem = 0;
      this._switchHopT = 0;
      this.lookYawOff = 0;
      const fwdX = Math.sin(s.yaw), fwdZ = -Math.cos(s.yaw);
      const slopeAlong = -(this.terrainData.sampleHeight(s.x + fwdX * 8, s.z + fwdZ * 8) - s.y) / 8.0;
      const pitchBias = this.camMode === 'chesty' ? -0.22 : -0.14;
      this._smoothSlopePitch = THREE.MathUtils.clamp(-Math.atan(slopeAlong) * 0.48 + pitchBias, -0.68, 0.46);
      this._landingQuatBlend = 0;
      this._updateGroundedQuaternion();
    } else {
      const dir = Math.abs(s.edgeAngle) > 0.08 ? Math.sign(s.edgeAngle) : 1;
      if (this._switchSpinRem > 0.01) {
        // Reversing mid-spin returns smoothly to the original heading instead of doing a full 360°!
        this._switchSpinRem = Math.PI - this._switchSpinRem;
        this._switchSpinDir = -this._switchSpinDir;
      } else {
        this._switchSpinRem = Math.PI;
        this._switchSpinDir = dir;
      }
      this._switchHopT = 1.0;
      this._landVel = Math.max(this._landVel, 0.45);
    }
    return true;
  }

  /**
   * Anatomical camera look bounds per mount so the player can NEVER twist into impossible
   * owl-neck angles or clip inside the skier's own shoulders, chest, collar, or backpack:
   *  - Helmet / Visor POV (gopro / clean): ±82° human neck+helmet swivel (spans ~±144° w/ 86° wide lens), -38°..+46° pitch
   *  - Sternum Harness (chesty): ±58° natural chest-mount sweep, -42°..+42° pitch
   *  - Airborne: tightened to ±72° for realistic landing spotting
   */
  getLookBounds(mode = this.camMode) {
    const isChesty = mode === 'chesty';
    // In Switch (fakie) stance, helmet/visor POV lets you naturally crane over either shoulder (±118°) to peek downhill!
    const maxYawDeg = isChesty ? 58 : (this.state.isSwitch && this.state.grounded ? 118 : 82);
    const maxYawBase = THREE.MathUtils.degToRad(maxYawDeg);
    const maxYaw = !this.state.grounded ? Math.min(maxYawBase, THREE.MathUtils.degToRad(72)) : maxYawBase;
    const minPitch = isChesty ? THREE.MathUtils.degToRad(-42) : THREE.MathUtils.degToRad(-38);
    const maxPitch = isChesty ? THREE.MathUtils.degToRad(42) : THREE.MathUtils.degToRad(46);
    return { maxYaw, minPitch, maxPitch };
  }

  setCamMode(mode) {
    this.camMode = mode || 'gopro';
    this.clampLookOffsets(this.camMode);
  }

  clampLookOffsets(mode = this.camMode) {
    const { maxYaw, minPitch, maxPitch } = this.getLookBounds(mode);
    this.lookYawOff = THREE.MathUtils.clamp(wrapAngle(this.lookYawOff), -maxYaw, maxYaw);
    this.lookPitchOff = THREE.MathUtils.clamp(this.lookPitchOff, minPitch, maxPitch);
  }

  addHeadLookDelta(dyaw, dpitch) {
    const s = this.state;
    if (s.crashed) return;
    const { maxYaw, minPitch, maxPitch } = this.getLookBounds(this.camMode);
    // Clamp WITHOUT wrapping across ±π so hitting your shoulder stop feels natural & solid (never flips backward!)
    this.lookYawOff = THREE.MathUtils.clamp(this.lookYawOff + dyaw, -maxYaw, maxYaw);
    this.lookPitchOff = THREE.MathUtils.clamp(this.lookPitchOff + dpitch, minPitch, maxPitch);
  }

  /**
   * Strict multi-point anti-mountain & boulder/serac near-plane clearance guard.
   * Ensures NOT A SINGLE corner of the camera's near frustum can ever clip underneath the snow or inside rock/ice!
   */
  enforceCameraClearance(camera, minClear = 0.42, checkProps = true) {
    if (!this.terrainData) return;
    const p = camera.position;
    this._camFwdTmp.set(0, 0, -1).applyQuaternion(camera.quaternion);
    this._camUpTmp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    this._camRgtTmp.set(1, 0, 0).applyQuaternion(camera.quaternion);

    // Extra slope-aware margin so bottom edge of wide 86°-92° frustum near plane never slices steep 35°-45° pitches
    const baseT = this.terrainData.sampleTerrain(p.x, p.z);
    const slopeTan = Math.min(1.15, Math.hypot(baseT.gx, baseT.gz));
    const slopePad = slopeTan * 0.24;

    let reqY = baseT.y + minClear + slopePad;
    const ringR = Math.max(0.38, Math.min(2.2, minClear * 0.65));
    const offsets = [
      [ringR, 0], [-ringR, 0], [0, ringR], [0, -ringR],
      [this._camFwdTmp.x * 0.34, this._camFwdTmp.z * 0.34],
      [this._camFwdTmp.x * 0.72, this._camFwdTmp.z * 0.72],
      [this._camFwdTmp.x * 0.34 + this._camRgtTmp.x * 0.28, this._camFwdTmp.z * 0.34 + this._camRgtTmp.z * 0.28],
      [this._camFwdTmp.x * 0.34 - this._camRgtTmp.x * 0.28, this._camFwdTmp.z * 0.34 - this._camRgtTmp.z * 0.28],
    ];
    for (let i = 0; i < offsets.length; i++) {
      const ox = offsets[i][0], oz = offsets[i][1];
      const gy = this.terrainData.sampleHeight(p.x + ox, p.z + oz);
      const isFwd = i >= 4;
      const pad = isFwd ? Math.max(0.26, minClear * 0.58) : (minClear * 0.72);
      // Account for downward view ray drop across forward probe distance
      const rayDrop = isFwd ? Math.max(0, -this._camFwdTmp.y * (i === 5 ? 0.72 : 0.34)) : 0;
      const need = gy + pad + rayDrop;
      if (need > reqY) reqY = need;
    }

    if (checkProps && this.colliders && this.colliders.length > 0) {
      for (let i = 0; i < this.colliders.length; i++) {
        const c = this.colliders[i];
        if (c.kind === 'tree') continue;
        const dx = p.x - c.x;
        const maxD = c.r + 0.85;
        if (Math.abs(dx) > maxD) continue;
        const dz = p.z - c.z;
        if (Math.abs(dz) > maxD) continue;
        if (p.y > c.y + c.h + 0.55) continue;
        const d = Math.hypot(dx, dz);
        if (d < maxD) {
          if (p.y > c.y + c.h * 0.65) {
            reqY = Math.max(reqY, c.y + c.h + 0.45);
          } else if (d > 0.001) {
            p.x = c.x + (dx / d) * maxD;
            p.z = c.z + (dz / d) * maxD;
            const pushedY = this.terrainData.sampleHeight(p.x, p.z) + minClear;
            if (pushedY > reqY) reqY = pushedY;
          } else {
            reqY = Math.max(reqY, c.y + c.h + 0.45);
          }
        }
      }
    }

    if (p.y < reqY) {
      p.y = reqY;
    }
  }

  _updateGroundedQuaternion(dt = 0) {
    const s = this.state;
    const up = this._smoothNormal;
    const rawFwd = new THREE.Vector3(Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    const fwd = rawFwd.clone().addScaledVector(up, -rawFwd.dot(up)).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    const trueUp = new THREE.Vector3().crossVectors(right, fwd).normalize();

    const m = new THREE.Matrix4().makeBasis(right, trueUp, fwd.clone().negate());
    if (this._landingQuatBlend > 0.001 && dt > 0) {
      this._tmpQuatTarget.setFromRotationMatrix(m);
      this._landingQuatBlend = Math.max(0, this._landingQuatBlend - dt * 7.2);
      const t = 1.0 - this._landingQuatBlend * this._landingQuatBlend; // smooth ease-out settle (~0.14s)
      s.quat.copy(this._landingStartQuat).slerp(this._tmpQuatTarget, t);
    } else {
      s.quat.setFromRotationMatrix(m);
    }
  }

  _sampleFourPoint(x, z, yaw) {
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = Math.sin(yaw);
    const hLeft = this.terrainData.sampleHeight(x - rx * 0.28, z - rz * 0.28);
    const hRight = this.terrainData.sampleHeight(x + rx * 0.28, z + rz * 0.28);
    const hTip = this.terrainData.sampleHeight(x + fx * 0.96, z + fz * 0.96);
    const hTail = this.terrainData.sampleHeight(x - fx * 0.86, z - fz * 0.86);
    return {
      rollContact: (hRight - hLeft) / 0.56,
      pitchContact: (hTip - hTail) / 1.82,
    };
  }

  _recordFrame(time) {
    const s = this.state;
    if (this.replayFrames.length >= 3600) {
      this.replayFrames.shift();
    }
    this.replayFrames.push({
      t: time,
      x: s.x, y: s.y, z: s.z,
      terrainY: s.terrainY,
      nx: s.normal.x, ny: s.normal.y, nz: s.normal.z,
      qx: s.quat.x, qy: s.quat.y, qz: s.quat.z, qw: s.quat.w,
      yaw: s.yaw,
      edgeAngle: s.edgeAngle,
      crouch: s.crouch,
      foreAft: s.foreAft,
      slipAngle: s.slipAngle,
      turnLead: s.turnLead,
      shiftyAngle: s.shiftyAngle,
      landImpact: s.landImpact,
      grabbing: s.grabbing,
      speed: s.speed,
      grounded: s.grounded,
      crashed: s.crashed,
      isSwitch: s.isSwitch,
      slopeDeg: s.slopeDeg,
      surfId: s.surface.id,
      sprayRate: s.sprayRate,
      polePlantL: s.polePlantL,
      polePlantR: s.polePlantR,
      skatePhase: s.skatePhase,
      skatePush: s.skatePush,
      insideUnweight: s.insideUnweight,
      scissorSpread: s.scissorSpread,
      bowWave: s.bowWave,
      edgeDeg: s.edgeDeg,
      fallAngleDeg: s.fallAngleDeg,
      stanceMode: s.stanceMode,
    });
  }

  _stepAvalanche(dt, s) {
    const a = this.avalanche;
    if (a.cooldown > 0) a.cooldown = Math.max(0, a.cooldown - dt);
    if (!a.active) {
      a.proximity = 0;
      return;
    }
    a.age += dt;
    // Sample slope at advancing avalanche front so it accelerates on steep chutes & slows on valley runouts!
    const fx = a.originX + a.dirX * a.frontDist;
    const fz = a.originZ + a.dirZ * a.frontDist;
    const ft = this.terrainData.sampleTerrain(fx, fz);
    const targetSpd = THREE.MathUtils.clamp(9.0 + Math.max(0, ft.slopeDeg - 10) * 0.65, 10.0, 29.0);
    a.speed += (targetSpd - a.speed) * Math.min(1, dt * 1.4);
    a.frontDist += a.speed * dt;
    a.width = Math.min(54, a.width + dt * 0.55);

    if (a.age > 28 || a.frontDist > a.maxDist) {
      a.strength = Math.max(0, a.strength - dt * 0.16);
      if (a.strength <= 0.01) {
        a.active = false;
        a.proximity = 0;
        return;
      }
    }

    // Skier position relative to slab fracture origin & axis
    const relX = s.x - a.originX;
    const relZ = s.z - a.originZ;
    const along = relX * a.dirX + relZ * a.dirZ;
    const across = relX * (-a.dirZ) + relZ * a.dirX;
    const distToFront = Math.hypot(along - a.frontDist, Math.max(0, Math.abs(across) - a.width * 0.72));
    a.proximity = THREE.MathUtils.clamp(1.0 - distToFront / 135.0, 0, 1) * a.strength;

    if (a.proximity > 0.25) {
      s.camShake = Math.max(s.camShake, a.proximity * 0.36);
    }

    // Check if churning slab overtakes the skier!
    const inCorridor = Math.abs(across) < a.width * 0.85 && along > 5.0;
    const overtaken = a.frontDist >= along - 3.5 && a.frontDist <= along + 42.0;
    const clearance = s.y - s.terrainY;
    if (inCorridor && overtaken && clearance < 6.5 && !s.crashed && a.age > 1.4) {
      s.faceShotIntensity = Math.min(1.0, s.faceShotIntensity + dt * 3.8);
      if (a.frontDist >= along + 3.0 && !a.engulfed) {
        a.engulfed = true;
        this._triggerCrash('ENGULFED BY SLAB AVALANCHE', this.terrainData.sampleTerrain(s.x, s.z), 18.0);
      }
    }
  }

  step(dt, time) {
    const s = this.state;
    const steerL = this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0;
    const steerR = this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0;
    const fwdIn  = this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0;
    const backIn = this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0;
    const corkL  = this.keys.has('KeyQ') ? 1 : 0;
    const corkR  = this.keys.has('KeyE') ? 1 : 0;
    const brakeKey = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1 : 0;
    const brake  = Math.min(1, Math.max(brakeKey, this.gamepadBrake || 0));
    const rawKeySteer = steerR - steerL;
    if (this.smoothCarve) {
      const rate = rawKeySteer !== 0 ? 6.2 : 9.5;
      this._smoothKeySteer += (rawKeySteer - this._smoothKeySteer) * Math.min(1, dt * rate);
      if (Math.abs(this._smoothKeySteer) < 0.005 && rawKeySteer === 0) this._smoothKeySteer = 0;
    } else {
      this._smoothKeySteer = rawKeySteer;
    }
    const steer  = THREE.MathUtils.clamp(this._smoothKeySteer + this.mouseSteer + (this.gamepadSteer || 0) + (this.touchSteer || 0), -1.35, 1.35);
    const foreIn = THREE.MathUtils.clamp((fwdIn - backIn) + (this.gamepadFore || 0) + (this.touchFore || 0), -1.0, 1.0);
    const corkIn = THREE.MathUtils.clamp((corkR - corkL) + (this.gamepadCork || 0), -1.0, 1.0);
    const jumpNow = this.keys.has('Space') || this.jumpHeld || !!this.gamepadJump;
    const grabNow = this.keys.has('KeyF') || this.grabHeld || !!this.gamepadGrab;
    s.grabbing = grabNow;

    if (this._kickerCooldown > 0) this._kickerCooldown = Math.max(0, this._kickerCooldown - dt);

    const t = this.terrainData.sampleTerrain(s.x, s.z);
    s.terrainY = t.y;
    s.surface = t.surface;
    s.slopeDeg = t.slopeDeg;
    s.normal.set(t.nx, t.ny, t.nz);
    this._smoothNormal.lerp(s.normal, Math.min(1, dt * 16)).normalize();

    // Update dynamic Slab Avalanche propagation
    this._stepAvalanche(dt, s);

    // Decay transient visual effects & integrate critically-damped landing suspension ODE
    s.faceShotIntensity = Math.max(0, s.faceShotIntensity - dt * 2.40);
    s.camShake = Math.max(0, s.camShake - dt * 3.2);
    s.sluffTrigger = Math.max(0, s.sluffTrigger - dt * 1.5);

    // Critically-damped physical knee suspension (k=28, c=8.9 -> wn=5.29 rad/s, zeta=0.841):
    // Smooth deep athletic compression peaking at ~0.18s (~14-18cm on normal ollie, ~28-33cm on big drop) & clean rebound!
    const fDisp = -28.0 * this._landDisp - 8.9 * this._landVel;
    this._landVel += fDisp * dt;
    this._landDisp = THREE.MathUtils.clamp(this._landDisp + this._landVel * dt, -0.05, 0.44);
    if (Math.abs(this._landDisp) < 0.0004 && Math.abs(this._landVel) < 0.002) {
      this._landDisp = 0;
      this._landVel = 0;
    }
    s.landImpact = THREE.MathUtils.clamp(Math.max(0, this._landDisp) / 0.28, 0, 1);

    // Subtle pitch-nod absorption & sketchy-landing roll balance spring-dampers
    const fPitch = -36.0 * this._landPitch - 10.2 * this._landPitchVel;
    this._landPitchVel += fPitch * dt;
    this._landPitch = THREE.MathUtils.clamp(this._landPitch + this._landPitchVel * dt, -0.26, 0.14);
    const fRoll = -42.0 * this._landRoll - 9.8 * this._landRollVel;
    this._landRollVel += fRoll * dt;
    this._landRoll = THREE.MathUtils.clamp(this._landRoll + this._landRollVel * dt, -0.24, 0.24);

    // Smooth 0.26s athletic 180° switch hop-spin turning BOTH skis AND perspective together!
    if (this._switchSpinRem > 0.0005 && s.grounded && !s.crashed) {
      const dSpin = Math.min(this._switchSpinRem, Math.max(dt * 7.2, this._switchSpinRem * Math.min(1, dt * 13.5)));
      s.yaw = wrapAngle(s.yaw + this._switchSpinDir * dSpin);
      this._switchSpinRem = Math.max(0, this._switchSpinRem - dSpin);
      this.lookYawOff *= Math.exp(-dt * 12.0);
    } else if (!s.grounded || s.crashed) {
      this._switchSpinRem = 0;
    }
    if (this._switchHopT > 0) {
      this._switchHopT = Math.max(0, this._switchHopT - dt * 3.85);
    }

    // Handle active wipeout tumble
    if (s.crashed) {
      s.crashTimer += dt;
      const n = s.normal;
      const gDotN = -GRAVITY * n.y;
      s.vx += (-n.x * gDotN) * dt * 0.45;
      s.vz += (-n.z * gDotN) * dt * 0.45;
      const drag = Math.exp(-dt * 2.15);
      s.vx *= drag; s.vz *= drag;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      const nt = this.terrainData.sampleTerrain(s.x, s.z);
      s.y = nt.y + 0.35;
      s.speed = Math.hypot(s.vx, s.vz);
      const spinScale = Math.min(1, s.speed / 6.0);
      const qStep = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(dt * 4.8 * spinScale, dt * 2.6 * spinScale, dt * 5.2 * spinScale)
      );
      s.quat.multiply(qStep);
      s.sprayRate = spinScale * 1.4;
      if (spinScale > 0.15) {
        this.events.push({ type: 'crashTrail', x: s.x, y: nt.y, z: s.z, speed: s.speed });
      }
      if (s.crashTimer > 2.35 && s.speed < 2.2) {
        this.standUpHere();
      }
      this._recAccum += dt;
      if (this._recAccum >= 1 / 30) {
        this._recAccum -= 1 / 30;
        this._recordFrame(time);
      }
      this.prevJumpHeld = jumpNow;
      return;
    }

    // Clamp to playable core massif margin (±5850 m)
    const bound = 5850.0;
    if (Math.abs(s.x) > bound || Math.abs(s.z) > bound) {
      s.x = THREE.MathUtils.clamp(s.x, -bound, bound);
      s.z = THREE.MathUtils.clamp(s.z, -bound, bound);
      s.vx *= -0.25; s.vz *= -0.25;
    }

    const poleL = corkL || (this.gamepadCork < -0.5 ? 1 : 0);
    const poleR = corkR || (this.gamepadCork > 0.5 ? 1 : 0);
    if (s.grounded) {
      this._stepGrounded(dt, t, steer, foreIn, brake, jumpNow, poleL, poleR, grabNow || this.touchPoleHeld, time);
    } else {
      this._stepAirborne(dt, t, steer, foreIn, corkIn, grabNow, time);
    }

    // Obstacle collisions & close-pass Doppler tree whoosh detection
    this._checkCollisions(time);

    s.verticalDropped = Math.max(s.verticalDropped, s.startElev - s.y);
    const kmh = s.speed * 3.6;
    if (kmh > s.maxSpeedKmh) s.maxSpeedKmh = kmh;
    if (kmh > 32) s.breathing = Math.min(1, s.breathing + dt * 0.16);
    else s.breathing = Math.max(0, s.breathing - dt * 0.055);

    // Record 30 Hz trajectory for Helicopter Replay!
    if (s.speed > 0.25 || !s.grounded || this.replayFrames.length > 0) {
      this._recAccum += dt;
      if (this._recAccum >= 1 / 30) {
        this._recAccum -= 1 / 30;
        this._recordFrame(time);
      }
    }

    this.prevJumpHeld = jumpNow;
  }

  /**
   * Fires a realistic physical pole stroke on flat / gentle / slow / uphill snow!
   *  - side =  0 : Double-pole push (`W` hold on flats or `F` tap/hold on ground)
   *  - side = -1 : Left diagonal pole stride (`Q` key on ground)
   *  - side = +1 : Right diagonal pole stride (`E` key on ground)
   */
  triggerPoleStroke(side = 0, time = 0, strengthScale = 1.0) {
    const s = this.state;
    if (!s.grounded || s.crashed) return false;
    const isDouble = side === 0;
    const minCD = isDouble ? 0.44 : 0.21;
    if (this._poleStrokeCD > 0 && isDouble) return false;
    if (!isDouble && this._poleStrokeCD > 0.16 && this._lastPoleHand === side) return false;

    const t = this.terrainData.sampleTerrain(s.x, s.z);
    const n = s.normal.set(t.nx, t.ny, t.nz);
    const rawFwdX = Math.sin(s.yaw), rawFwdZ = -Math.cos(s.yaw);
    const fwdDotN = rawFwdX * n.x + rawFwdZ * n.z;
    const fwd = this._tmpPushDir.set(rawFwdX - fwdDotN * n.x, -fwdDotN * n.y, rawFwdZ - fwdDotN * n.z).normalize();
    const right = this._tmpRight.crossVectors(fwd, n).normalize();
    const pushSign = s.isSwitch ? -1 : 1;
    const vAlong = (s.vx * fwd.x + s.vy * fwd.y + s.vz * fwd.z) * pushSign;

    // Speed ceiling: realistic alpine ski boots double-poling on flat ground (~20-26 km/h steady-state, max ~28 km/h); uphill/backward always gets full torque!
    const maxV = isDouble ? 8.0 : 7.4;
    if (vAlong >= maxV) return false;
    const taper = THREE.MathUtils.clamp(1.0 - Math.max(0, vAlong) / maxV, 0.08, 1.0);
    // Crisp purchase on packed/corn/crust, slightly softer in deep cold powder, slight tip slip on sheer blue ice!
    const surf = t.surface;
    const surfGrip = surf.id === 'packed' || surf.id === 'corn' ? 1.04
                   : surf.id === 'crust' ? 0.96
                   : surf.id === 'powder' ? 0.86
                   : 0.60;

    // Alternating Q <-> E rhythm bonus when switching hands cleanly within 0.14..1.05s!
    const dtPrev = time - this._lastPoleTime;
    const altBonus = (!isDouble && this._lastPoleHand !== 0 && this._lastPoleHand !== side && dtPrev > 0.14 && dtPrev < 1.05) ? 1.15 : 1.0;

    const baseImp = (isDouble ? 1.80 : 1.28) * surfGrip * altBonus * strengthScale;
    const impulse = baseImp * Math.pow(taper, 0.78);

    this._poleDriveDur = isDouble ? 0.28 : 0.22;
    this._poleDriveTimer = this._poleDriveDur;
    this._poleDriveImpulse = impulse;
    this._poleDriveSide = side;
    this._poleStrokeCD = minCD;
    this._lastPoleHand = side;
    this._lastPoleTime = time;
    s.poleStrokePulse = 1.0;

    if (isDouble) {
      s.polePlantL = Math.max(s.polePlantL, 0.95);
      s.polePlantR = Math.max(s.polePlantR, 0.95);
      s.skatePush = Math.max(s.skatePush, 0.85);
      const pxL = s.x - right.x * 0.44 + fwd.x * 0.46;
      const pzL = s.z - right.z * 0.44 + fwd.z * 0.46;
      const pxR = s.x + right.x * 0.44 + fwd.x * 0.46;
      const pzR = s.z + right.z * 0.44 + fwd.z * 0.46;
      this.events.push({ type: 'polePlant', side: -0.42, x: pxL, y: this.terrainData.sampleHeight(pxL, pzL), z: pzL, strength: 0.56 * strengthScale, powder: surf.id === 'powder' });
      this.events.push({ type: 'polePlant', side: 0.42, x: pxR, y: this.terrainData.sampleHeight(pxR, pzR), z: pzR, strength: 0.56 * strengthScale, powder: surf.id === 'powder' });
    } else {
      if (side < 0) s.polePlantL = 1.0;
      else s.polePlantR = 1.0;
      const px = s.x + right.x * side * 0.48 + fwd.x * 0.52;
      const pz = s.z + right.z * side * 0.48 + fwd.z * 0.52;
      this.events.push({ type: 'polePlant', side: side * 0.72, x: px, y: this.terrainData.sampleHeight(px, pz), z: pz, strength: 0.62 * strengthScale, powder: surf.id === 'powder' });
    }
    return true;
  }

  _stepGrounded(dt, t, steer, foreIn, brake, jumpNow, poleLIn = 0, poleRIn = 0, poleFIn = false, time = 0) {
    const s = this.state;
    const surf = t.surface;
    const n = s.normal;
    const altHeld = this.keys.has('AltLeft') || this.keys.has('AltRight') || this.freeLookHeld;
    const keySteer = steer;

    // 4-point terrain contact sampling (leftSki, rightSki, tip, tail)
    const fp = this._sampleFourPoint(s.x, s.z, s.yaw);
    s.rollContact = fp.rollContact;
    s.pitchContact = fp.pitchContact;

    // Fore-aft stance & crouch
    s.foreAft += (foreIn - s.foreAft) * Math.min(1, dt * 8.0);
    if (jumpNow) {
      s.popCharge = Math.min(1.0, s.popCharge + dt * 2.2);
    }

    // Current relative head angle (where the player's eyes/mouse are pointing relative to ski heading!)
    let relHead = wrapAngle(this.lookYawOff);
    const curSpeed = Math.hypot(s.vx, s.vy, s.vz);

    if (this.headSteerEnabled && !altHeld && curSpeed > 6.5 && Math.abs(relHead) > 2.05) {
      this.lookYawOff = wrapAngle(this.lookYawOff * Math.exp(-dt * 4.5));
      relHead = wrapAngle(this.lookYawOff);
    }

    let headSteer = 0;
    if (this.headSteerEnabled && !altHeld && this._switchSpinRem <= 0.05) {
      if (foreIn > 0.1 && curSpeed < 5.0 && Math.abs(relHead) > 0.025) {
        const stepTurn = Math.sign(relHead) * Math.min(Math.abs(relHead), 3.6 * dt);
        s.yaw += stepTurn;
        this.lookYawOff = wrapAngle(this.lookYawOff - stepTurn);
        relHead = wrapAngle(this.lookYawOff);
      }
      if (curSpeed >= 0.85 || foreIn > 0.1) {
        const dead = 0.025;
        if (Math.abs(relHead) > dead) {
          const effRel = relHead - Math.sign(relHead) * dead;
          headSteer = THREE.MathUtils.clamp(effRel / 0.52, -1.10, 1.10);
        }
      }
    }

    // --- 1. EXACT FALL-LINE, STEEPNESS & SKI-HEADING GEOMETRY ---
    const grav = this._tmpGrav.set(0, -GRAVITY, 0);
    const gNormal = grav.dot(n); // <= 0, magnitude = g * cos(slopeRad)
    const normalWeight = Math.max(0.5, -gNormal); // drops on steeper walls (9.81 @ 0°, 8.89 @ 25°, 7.51 @ 40°)
    const gravTan = this._tmpGravTan.copy(grav).addScaledVector(n, -gNormal); // exact downhill fall-line vector!
    const slopeMagTan = gravTan.length(); // g * sin(slopeRad)
    const sinSlope = Math.min(1.0, slopeMagTan / GRAVITY);

    const rawFwdX = Math.sin(s.yaw);
    const rawFwdZ = -Math.cos(s.yaw);
    const fwdDotN = rawFwdX * n.x + rawFwdZ * n.z;
    const fwd = this._tmpFwd.set(rawFwdX - fwdDotN * n.x, -fwdDotN * n.y, rawFwdZ - fwdDotN * n.z).normalize();
    const right = this._tmpRight.crossVectors(fwd, n).normalize();

    // Projections of fall-line gravity onto ski frame:
    //  gFwd > 0 = pointed downhill (accelerating), 0 = traverse across fall line, < 0 = uphill (braking!)
    //  gLat > 0 = fall line drops to skier's RIGHT (left edge is uphill!), < 0 = fall line drops to LEFT!
    const gFwd = gravTan.dot(fwd);
    const gLat = gravTan.dot(right);
    const hasSlope = slopeMagTan > 0.16; // > ~1.0° slope
    const fallAngle = hasSlope ? Math.atan2(gLat, gFwd) : 0.0;
    const sinFall = hasSlope ? (gLat / slopeMagTan) : 0.0; // +1 = downhill right, -1 = downhill left
    const cosFall = hasSlope ? (gFwd / slopeMagTan) : 1.0; // +1 = straight down fall line, -1 = straight uphill
    const uphillSign = Math.abs(gLat) > 0.18 ? -Math.sign(gLat) : 0; // -1 = uphill is LEFT, +1 = uphill is RIGHT
    s.fallAngleDeg = THREE.MathUtils.radToDeg(fallAngle);

    // Pre-update velocity along current ski basis
    const vFwdPre = s.vx * fwd.x + s.vy * fwd.y + s.vz * fwd.z;
    const vLatPre = s.vx * right.x + s.vy * right.y + s.vz * right.z;

    // --- 2. POLING ON FLAT GROUND, GENTLE SLOPES, & SHORT CLIMBS ---
    if (this._poleStrokeCD > 0) this._poleStrokeCD = Math.max(0, this._poleStrokeCD - dt);
    s.poleStrokePulse = Math.max(0, s.poleStrokePulse - dt * 2.8);

    const qDown = !!poleLIn;
    const eDown = !!poleRIn;
    const fDown = !!poleFIn;
    const qJust = qDown && !this._prevPoleQ;
    const eJust = eDown && !this._prevPoleE;
    const fJust = fDown && !this._prevPoleF;
    this._prevPoleQ = qDown;
    this._prevPoleE = eDown;
    this._prevPoleF = fDown;

    // Manual alternating Q (left) / E (right) diagonal pole push & F dedicated double-pole push on ground!
    if (!brake && !jumpNow) {
      if (fJust || (fDown && this._poleStrokeCD <= 0 && curSpeed < 7.8)) {
        this.triggerPoleStroke(0, time, 1.06);
      } else if (qJust || (qDown && !eDown && this._poleStrokeCD <= 0 && curSpeed < 7.2)) {
        this.triggerPoleStroke(-1, time, 1.0);
      } else if (eJust || (eDown && !qDown && this._poleStrokeCD <= 0 && curSpeed < 7.2)) {
        this.triggerPoleStroke(1, time, 1.0);
      }
    }

    // Automatic rhythmic double-poling while holding W/ArrowUp:
    //  - On flat, gentle, or uphill terrain (gFwd < 2.25 m/s², i.e. < ~13° downhill along skis): poles smoothly up to ~27 km/h!
    //  - On steeper downhill pitches (gFwd >= 2.25): poles only while starting out (< 5.0 m/s), then transitions seamlessly into aero tuck!
    const isFlatOrGentle = gFwd < 2.25;
    const wPoleSpeedCap = isFlatOrGentle ? 7.6 : 5.0;
    const wPolingActive = foreIn > 0.14 && !brake && !jumpNow && (vFwdPre * (s.isSwitch ? -1 : 1) < wPoleSpeedCap);
    if (wPolingActive) {
      s.skatePush = Math.min(1.0, s.skatePush + dt * 5.8);
      if (!this._prevWPoling) {
        // Immediate punchy first pole stroke the instant player presses W on flat/slow snow!
        s.skatePhase = 0.18;
        this.triggerPoleStroke(0, time, 0.96 * foreIn);
      }
      const cycleRate = 9.4 + Math.min(2.2, curSpeed * 0.24); // ~0.62-0.67 s natural Nordic double-pole cycle
      s.skatePhase += dt * cycleRate;
      const sinP = Math.sin(s.skatePhase);
      if (this._prevSkateSin <= 0 && sinP > 0 && this._poleStrokeCD <= 0) {
        this.triggerPoleStroke(0, time, 0.96 * foreIn);
      }
      this._prevSkateSin = sinP;
    } else if (this._poleDriveTimer > 0 && this._poleDriveSide === 0) {
      s.skatePush = Math.min(1.0, s.skatePush + dt * 6.5);
      s.skatePhase += dt * 10.2;
      this._prevSkateSin = Math.sin(s.skatePhase);
    } else {
      s.skatePush = Math.max(0, s.skatePush - dt * 4.8);
      this._prevSkateSin = 0;
    }
    this._prevWPoling = wPolingActive;

    // Apply smooth muscular drive curve of active pole stroke (discrete push-phase impulse, NOT flat thruster!)
    let poleBobTarget = 0;
    if (this._poleDriveTimer > 0) {
      const u = 1.0 - (this._poleDriveTimer / Math.max(0.05, this._poleDriveDur)); // 0 -> 1 over stroke
      const weight = Math.sin(u * Math.PI) * (Math.PI * 0.5); // integral over [0..1] === 1.0!
      const dv = (this._poleDriveImpulse / Math.max(0.05, this._poleDriveDur)) * weight * dt;
      const pushSign = s.isSwitch ? -1 : 1;
      s.vx += fwd.x * pushSign * dv;
      s.vy += fwd.y * pushSign * dv;
      s.vz += fwd.z * pushSign * dv;
      // Subtle realistic diagonal opposite-hand yaw nudge on single-pole Q/E stride (cancels to dead straight when alternating!)
      if (this._poleDriveSide !== 0) {
        const yawNudge = (-this._poleDriveSide) * 0.032 * (weight / Math.max(0.05, this._poleDriveDur)) * dt;
        s.yaw += yawNudge;
      }
      poleBobTarget = (this._poleDriveSide === 0 ? -0.044 : -0.022) * Math.sin(u * Math.PI);
      this._poleDriveTimer = Math.max(0, this._poleDriveTimer - dt);
    }
    this._poleBobY += (poleBobTarget - this._poleBobY) * Math.min(1, dt * 18.0);

    // Tuck target reflects poling vs downhill aero tuck (hold athletic crouch smoothly during active landing absorb so eyes drop DOWN on impact!)
    const baseTuck = jumpNow ? 0.92 : (wPolingActive ? 0.24 : (foreIn > 0.2 ? 0.62 : (brake ? 0.36 : 0.12)));
    const tuckTarget = Math.max(baseTuck, s.landImpact * 0.36);
    const risingDuringLand = tuckTarget < s.crouch && (this._landVel > 0.05 || s.landImpact > 0.14);
    s.crouch += (tuckTarget - s.crouch) * Math.min(1, dt * (risingDuringLand ? 2.2 : 11.0));

    // Subtle cold ski-boot plastic shell flex creak when pumping knees while stationary
    if (this._bootCreakCD > 0) this._bootCreakCD = Math.max(0, this._bootCreakCD - dt);
    const crouchDelta = Math.abs(s.crouch - this._prevCrouch);
    if (curSpeed < 1.3 && crouchDelta > 0.0045 && this._bootCreakCD <= 0) {
      this.events.push({ type: 'bootCreak', strength: Math.min(1.0, crouchDelta * 75.0) });
      this._bootCreakCD = 0.52;
    }
    this._prevCrouch = s.crouch;

    // --- 3. AUTHENTIC EDGING DYNAMICS (FALL LINE × STEEPNESS × SPEED) ---
    // Perspective now rotates with stance (`viewYaw = s.yaw + lookYawOff`), so screen-left/right matches A/D in BOTH forward & switch!
    const combinedSteer = THREE.MathUtils.clamp(keySteer + headSteer, -1.35, 1.35);
    const edgeVisualSteer = combinedSteer;
    const rawSteerInput = THREE.MathUtils.clamp(edgeVisualSteer, -1.0, 1.0);

    // Mild upright ankle self-stabilization ONLY holds gentle/moderate benches (caps at 0.22 ≈ 14° edge)!
    // On steep slopes (>20°), standing neutral across the fall line is NOT enough -> realistic downhill SIDESLIP until you edge uphill!
    const gentleUphillBias = hasSlope
      ? (-sinFall * THREE.MathUtils.clamp(sinSlope * 0.64, 0.0, 0.22) * (1.0 - Math.min(1, brake)))
      : 0.0;

    // Physical lean limit: on flat snow at 0 km/h you can only angle ankles ~22°; speed & steepness unlock deep 60°+ carving angulation!
    const speedEdgeCap = THREE.MathUtils.clamp(0.30 + curSpeed * 0.048 + sinSlope * 0.44, 0.30, 1.00);
    const pushingUphill = hasSlope && (rawSteerInput * gLat < -0.15);
    const steepAngBonus = pushingUphill ? sinSlope * 0.18 : 0.0;
    const maxEdge = Math.min(1.04, speedEdgeCap + steepAngBonus);

    let targetEdge;
    if (brake) {
      // Hockey stop / defensive edge hold: stays dug solidly into the uphill edge even down to 0 km/h on steep slopes!
      const stopSide = Math.abs(rawSteerInput) > 0.12
        ? Math.sign(rawSteerInput)
        : (uphillSign !== 0 ? uphillSign : (Math.abs(s.edgeAngle) > 0.08 ? Math.sign(s.edgeAngle) : 1));
      targetEdge = stopSide * Math.min(1.02, (curSpeed > 0.8 ? 0.78 : 0.62) + sinSlope * 0.34);
    } else if (Math.abs(rawSteerInput) > 0.04) {
      targetEdge = THREE.MathUtils.clamp(rawSteerInput * maxEdge, -1.04, 1.04);
    } else {
      targetEdge = gentleUphillBias;
    }

    // Weighted physical edge-roll transition (rolling through flat takes ~0.22-0.30s; switching edges fires rebound unweight!)
    const prevEdge = s.edgeAngle;
    const isReleasing = Math.abs(targetEdge) < Math.abs(s.edgeAngle);
    const edgeRate = brake ? 9.2 : (isReleasing ? 4.8 : (6.6 + Math.min(2.4, curSpeed * 0.10)));
    s.edgeAngle += (targetEdge - s.edgeAngle) * Math.min(1, dt * edgeRate);
    if (prevEdge * s.edgeAngle < -0.002 && Math.abs(prevEdge - s.edgeAngle) > 0.01 && curSpeed > 5.0) {
      this._reboundUnweight = Math.min(1.0, curSpeed / 16.0);
    }
    this._reboundUnweight = Math.max(0, this._reboundUnweight - dt * 3.8);

    s.edgeDeg = s.edgeAngle * 64.0; // ±1.0 -> ±64° physical ski edge angle relative to snow
    s.uphillEdge = !hasSlope || Math.abs(s.edgeAngle) < 0.08 ? 0 : (Math.sign(s.edgeAngle) === uphillSign ? 1 : -1);
    s.turnLead += (Math.sign(s.edgeAngle) * Math.min(1, Math.abs(s.edgeAngle)) - s.turnLead) * Math.min(1, dt * 7.5);

    // Independent left/right ski suspension unweighting & smooth-attack landing scissor-spread
    const targetUnweight = THREE.MathUtils.clamp(s.edgeAngle * Math.min(1.0, 0.25 + curSpeed / 12.0), -1.0, 1.0);
    s.insideUnweight += (targetUnweight - s.insideUnweight) * Math.min(1, dt * 10.0);
    this._scissorTarget *= Math.exp(-dt * 2.6);
    s.scissorSpread += (this._scissorTarget - s.scissorSpread) * Math.min(1, dt * 14.0);

    // Active downhill pole-plant rhythm on turn initiation / edge switch!
    s.polePlantL = Math.max(0, s.polePlantL - dt * 3.0);
    s.polePlantR = Math.max(0, s.polePlantR - dt * 3.0);
    if (this._poleCooldown > 0) this._poleCooldown = Math.max(0, this._poleCooldown - dt);
    if (Math.abs(s.edgeAngle) < 0.08 && Math.abs(targetEdge) < 0.10) {
      this._prevEdgeSign = 0;
    }
    if (curSpeed > 4.0 && !brake && s.skatePush < 0.25 && this._poleDriveTimer <= 0 && Math.abs(targetEdge) > 0.28) {
      const edgeSign = Math.sign(targetEdge);
      if (edgeSign !== this._prevEdgeSign && this._poleCooldown <= 0) {
        if (edgeSign > 0) s.polePlantR = 1.0;
        else s.polePlantL = 1.0;
        this._prevEdgeSign = edgeSign;
        this._poleCooldown = 0.44;
        const px = s.x + right.x * edgeSign * 0.56 + fwd.x * 0.65;
        const pz = s.z + right.z * edgeSign * 0.56 + fwd.z * 0.65;
        const py = this.terrainData.sampleHeight(px, pz);
        this.events.push({
          type: 'polePlant',
          side: edgeSign,
          x: px, y: py, z: pz,
          strength: Math.min(1.0, 0.45 + curSpeed / 22.0),
          powder: surf.id === 'powder',
        });
      }
    }

    // --- 4. TRUE PARABOLIC SIDECUT CARVING + FALL-LINE PULL + ROTARY SKID/STEP ---
    const absEdge = Math.abs(s.edgeAngle);
    const edgeRad = s.edgeAngle * 1.12; // ±1.12 rad = ±64°
    const absSinEdge = Math.abs(Math.sin(edgeRad));

    // Sidecut radius: 15.5m freeride twin-tip; W tip pressure tightens radius (-20%), S backseat widens radius (+26%)!
    const radiusMult = 1.0 - s.foreAft * (s.foreAft >= 0 ? 0.20 : 0.26);
    const rEff = 15.5 * THREE.MathUtils.clamp(radiusMult, 0.76, 1.32);

    // Slip attenuation: clean rail carves (|slip| < 18°) carve 100%; heavy skidding smears out sidecut rails!
    const absSlipPre = Math.abs(s.slipAngle);
    const railClean = 1.0 - THREE.MathUtils.smoothstep(absSlipPre, 0.22, 1.08) * 0.56;

    // Centripetal traction saturation (wash-out on blue ice / high-speed over-edging / steep low-normal faces!)
    const maxLatAccel = normalWeight * (0.42 + 1.88 * surf.grip * Math.pow(absSinEdge, 0.85));
    const rawCurv = (Math.sin(edgeRad) * (1.0 + 0.44 * absSinEdge)) / rEff;
    const vCarve = THREE.MathUtils.clamp(vFwdPre, -24, 36);
    const desiredOmegaCarve = vCarve * rawCurv * railClean;
    const desiredCentrip = Math.abs(vCarve * desiredOmegaCarve);
    const washOut = desiredCentrip > maxLatAccel && curSpeed > 5.0
      ? THREE.MathUtils.clamp((desiredCentrip - maxLatAccel) / Math.max(3.5, maxLatAccel), 0, 1)
      : 0.0;
    s.washOut += (washOut - s.washOut) * Math.min(1, dt * 10.0);
    const satScale = desiredCentrip > maxLatAccel && desiredCentrip > 0.01 ? (maxLatAccel / desiredCentrip) : 1.0;
    const surfCarveBite = (0.36 + 0.64 * surf.grip) * (0.45 + 0.55 * satScale);
    const omegaCarve = desiredOmegaCarve * surfCarveBite;
    this._carveOmega = omegaCarve;

    // Gentle low-speed step-turn / herringbone pivot ONLY when stationary/slow (< 4.5 m/s) so flat ground is never locked!
    const lowSpdMask = 1.0 - THREE.MathUtils.smoothstep(curSpeed, 0.8, 4.8);
    const stepSteer = keySteer;
    const omegaStep = this._switchSpinRem > 0.05 ? 0 : (stepSteer * 1.12 * lowSpdMask);
    if (lowSpdMask > 0.25 && Math.abs(stepSteer) > 0.15) {
      this._stepPhase += dt * 11.5;
      s.stepBounce = Math.abs(Math.sin(this._stepPhase)) * lowSpdMask;
    } else {
      s.stepBounce *= Math.exp(-dt * 12.0);
    }

    // Active rotary tail-smear: strong during Shift hockey-stop slash, subtle ankle-initiation assist in soft powder!
    let omegaRotary = 0;
    if (brake && curSpeed > 0.8) {
      const slashDir = Math.abs(rawSteerInput) > 0.10
        ? Math.sign(rawSteerInput)
        : (uphillSign !== 0 ? uphillSign : (Math.abs(s.edgeAngle) > 0.08 ? Math.sign(s.edgeAngle) : 1));
      // When holding Shift without A/D, pivot briskly across the fall line until perpendicular (~88°), then dig edge!
      const alreadyPerp = Math.abs(rawSteerInput) <= 0.10 && hasSlope && Math.abs(Math.abs(fallAngle) - Math.PI * 0.5) < 0.20;
      const brakeTurnGain = alreadyPerp ? 0.18 : 1.0;
      omegaRotary = slashDir * (1.85 + 0.45 * surf.grip) * brakeTurnGain * Math.min(1, curSpeed / 3.0);
    } else if (curSpeed > 1.2 && Math.abs(rawSteerInput) > 0.05) {
      const surfSmear = surf.id === 'powder' ? 0.34 : (surf.id === 'corn' ? 0.24 : 0.18);
      // Downhill release into the fall line pivots slightly easier than fighting uphill!
      const dropAssist = (hasSlope && rawSteerInput * gLat > 0.2) ? (1.0 + sinSlope * 0.45) : 1.0;
      omegaRotary = rawSteerInput * surfSmear * dropAssist * Math.min(1, curSpeed / 5.0);
    }

    // Natural Fall-Line Pull: when skis are flat/unweighted on a slope (> 6°) & moving, gravity nudges tips (or tails in Switch!) toward fall line!
    // Drops cleanly to 0 on flat terrain (< 3°), when locked onto an active edge (> 28°), or mid-switch-spin!
    const flatMask = 1.0 - THREE.MathUtils.smoothstep(absEdge, 0.12, 0.52);
    const slopePullMask = THREE.MathUtils.smoothstep(t.slopeDeg, 5.5, 22.0);
    const movePullMask = THREE.MathUtils.smoothstep(curSpeed, 0.5, 4.0);
    const fallDir = s.isSwitch ? -sinFall : sinFall;
    const omegaFallLine = (hasSlope && !brake && this._switchSpinRem <= 0.05)
      ? fallDir * sinSlope * flatMask * slopePullMask * movePullMask * (0.34 + 0.22 * Math.min(1, curSpeed / 14.0))
      : 0.0;

    // Ice cross-slope catch / micro-deflection on rough tilted crust/ice
    const crossCatch = (surf.id === 'ice' || surf.id === 'crust')
      ? THREE.MathUtils.clamp(fp.rollContact * 0.24, -0.35, 0.35) * Math.min(1, curSpeed / 16)
      : 0.0;

    let dYawHead = 0;
    if (headSteer !== 0) {
      const headRate = brake ? 2.2 : (0.9 + 0.85 * Math.min(1, curSpeed / 14.0));
      dYawHead = headSteer * headRate * (0.6 + 0.4 * surf.grip) * dt;
      if (Math.abs(dYawHead) > Math.abs(relHead)) dYawHead = relHead;
    }

    const totalOmega = omegaCarve + omegaStep + omegaRotary + omegaFallLine + crossCatch * 0.38;
    s.yaw += totalOmega * dt + dYawHead;
    this.lookYawOff = wrapAngle(this.lookYawOff - dYawHead);
    const steerEff = edgeVisualSteer;

    // Recompute tangent basis after yaw update so edge forces align cleanly with new ski heading
    const nRawFwdX = Math.sin(s.yaw), nRawFwdZ = -Math.cos(s.yaw);
    const nFwdDotN = nRawFwdX * n.x + nRawFwdZ * n.z;
    fwd.set(nRawFwdX - nFwdDotN * n.x, -nFwdDotN * n.y, nRawFwdZ - nFwdDotN * n.z).normalize();
    right.crossVectors(fwd, n).normalize();

    // --- 5. GRAVITY PROJECTION, LATERAL EDGE BITE, SIDESLIP & CARVE-VS-SKID ENERGY ---
    const vel = this._tmpVel.set(s.vx, s.vy, s.vz);
    vel.addScaledVector(gravTan, dt);
    const vDotN = vel.dot(n);
    vel.addScaledVector(n, -vDotN);

    const vFwd = vel.dot(fwd);
    const vLat = vel.dot(right);
    const speed = Math.hypot(vFwd, vLat);

    // Exit switch automatically if turning back downhill; never accidentally flip mid-spin or on a gentle uphill stall!
    if (this._switchSpinRem <= 0.05 && speed > 2.4) {
      if (s.isSwitch && vFwd > 2.2) s.isSwitch = false;
      else if (!s.isSwitch && vFwd < -5.8 && Math.abs(vLat) < 1.8) s.isSwitch = true;
    }

    s.slipAngle = speed > 0.55 ? Math.atan2(vLat, Math.max(0.28, Math.abs(vFwd))) : 0;
    const absSlip = Math.abs(s.slipAngle);

    // Compute live dynamic edge G-load (1.0 = neutral gravity, up to ~2.6G railing a steep high-speed turn!)
    const centripAccel = Math.abs(vFwd * omegaCarve);
    const totalNormal = Math.sqrt(normalWeight * normalWeight + centripAccel * centripAccel);
    s.carveLoadG += (THREE.MathUtils.clamp(totalNormal / GRAVITY, 0.65, 2.8) - s.carveLoadG) * Math.min(1, dt * 8.0);

    // Effective lateral edge resistance vs gravitational sideslip!
    //  - Moving/sliding RIGHT (vLat > 0 or gLat > 0) requires LEFT edge (edgeAngle < 0) biting into the hill!
    //  - Flat skis (edgeAngle ≈ 0) have LOW lateral friction -> realistic SIDESLIP on steep (>18°) traverses!
    const slideSign = Math.abs(vLat) > 0.10 ? Math.sign(vLat) : Math.sign(gLat);
    const edgeAgainstSlide = Math.max(0.0, -s.edgeAngle * slideSign);
    const edgeWithSlide = Math.max(0.0, s.edgeAngle * slideSign);
    const sinBite = Math.sin(Math.min(1.16, edgeAgainstSlide * 1.12));

    const baseLatMu = surf.id === 'ice' ? 0.09 : (surf.id === 'crust' ? 0.15 : (surf.id === 'powder' ? 0.22 : 0.19));
    // Dynamic compression pushes edges harder into snowpack during loaded turns (1.0..1.55x!)
    const dynPressure = 1.0 + Math.min(0.55, (s.carveLoadG - 1.0) * 0.42);
    const snowBankPile = surf.id === 'powder' ? (0.20 * Math.min(1.2, Math.abs(vLat) / 4.2)) : 0.0;
    const maxEdgeBite = normalWeight * dynPressure * surf.grip * (
      baseLatMu
      + 1.82 * Math.pow(sinBite, 0.88)
      + (brake ? 0.92 * surf.grip : 0.0)
      + snowBankPile
    ) * (1.0 - this._reboundUnweight * 0.25);

    // Catch-edge rattle when slamming downhill edge against high lateral slip on ice/crust!
    if ((surf.id === 'ice' || surf.id === 'crust') && ((Math.abs(fp.rollContact) > 0.32 && absSlip > 0.42 && speed > 10) || s.washOut > 0.25 || (edgeWithSlide > 0.35 && Math.abs(vLat) > 3.5))) {
      s.camShake = Math.max(s.camShake, Math.min(0.45, 0.16 + s.washOut * 0.30));
    }

    const absLat = Math.abs(vLat);
    const latLoss = Math.min(absLat, maxEdgeBite * dt);
    const newVLat = vLat - Math.sign(vLat) * latLoss;

    // Live sideslip telemetry (0..1): spikes when sliding sideways on flat skis across a steep slope or washing out!
    const slipRate = Math.max(0, Math.abs(newVLat) - 0.65) / 5.5;
    const targetSideslip = THREE.MathUtils.clamp(slipRate * (0.5 + 0.5 * Math.sin(absSlip)), 0, 1);
    s.sideslip += (targetSideslip - s.sideslip) * Math.min(1, dt * 8.0);

    // 4-point powder tip-dive penalty when leaning hard forward into a concave compression
    let tipDiveDrag = 0;
    if (surf.id === 'powder' && !s.isSwitch && s.foreAft > 0.55 && fp.pitchContact > 0.12 && speed > 10.0) {
      const dive = Math.min(1.0, (fp.pitchContact - 0.12) * 3.0) * (s.foreAft - 0.45);
      tipDiveDrag = dive * 4.2;
      s.faceShotIntensity = Math.min(0.42, s.faceShotIntensity + dive * dt * 0.55);
      s.camShake = Math.max(s.camShake, dive * 0.30);
    }

    // Real snow kinetic friction + powder low-speed sink vs high-speed planing + aerodynamic drag + skid plow braking!
    const muBase = surf.id === 'powder' ? 0.066
                 : surf.id === 'corn'   ? 0.044
                 : surf.id === 'packed' ? 0.036
                 : surf.id === 'crust'  ? 0.030
                 : surf.id === 'ice'    ? 0.016
                 : 0.095; // exposed granite
    const planeFactor = surf.id === 'powder'
      ? (1.0 + 0.34 * (1.0 - THREE.MathUtils.clamp(speed / 9.0, 0, 1)) - Math.max(0, -s.foreAft) * 0.28 - THREE.MathUtils.clamp((speed - 9.0) / 18.0, 0, 0.22))
      : 1.0;
    const bowCompaction = surf.id === 'powder'
      ? (0.00135 * speed * speed * (1.0 - Math.max(0, -s.foreAft) * 0.35))
      : 0.0;
    const edgeCutDrag = absEdge * absEdge * (surf.id === 'powder' ? 0.36 : 0.16) * normalWeight * 0.06;
    const aeroK = 0.0030 - Math.max(0, s.foreAft) * 0.0011 - s.crouch * 0.00055;
    const aeroDrag = Math.max(0.00125, aeroK) * speed * speed;

    const sinSlip = Math.sin(absSlip);
    const plowDrag = (sinSlip > 0.18)
      ? Math.pow((sinSlip - 0.18) / 0.82, 1.55) * normalWeight * (0.28 + surf.sinkDepth * 2.15 + (brake ? 0.58 : 0.0)) * (0.35 + 0.65 * Math.min(1.6, speed / 12.0))
      : 0.0;

    const glideDrag = (muBase * normalWeight * planeFactor) + edgeCutDrag + bowCompaction + aeroDrag + plowDrag + tipDiveDrag;

    let newVFwd = vFwd;
    if (Math.abs(newVFwd) > 0.01) {
      const decel = Math.min(Math.abs(newVFwd), glideDrag * dt);
      newVFwd -= Math.sign(newVFwd) * decel;
    }

    // Active hockey-stop / slash braking deceleration (smooth realistic ~0.85-1.1G spray slide instead of instant wall stop!)
    if (brake && speed > 0.35) {
      const brakeAlign = 0.42 + 0.58 * sinSlip; // stronger the more sideways you swing skis across the slope!
      const brakeForce = (4.4 + 5.8 * surf.grip) * brakeAlign * (0.48 + 0.52 * Math.min(1, speed / 12.0)) * (normalWeight / GRAVITY);
      const cut = Math.min(Math.abs(newVFwd), brakeForce * dt);
      newVFwd -= Math.sign(newVFwd) * cut;
    } else if (s.foreAft < -0.3 && speed > 4.0 && surf.id !== 'powder') {
      newVFwd *= Math.exp(-dt * 0.18 * (-s.foreAft));
    }

    // EXACT L2 KINETIC ENERGY CONSERVATION during carving vs skidding!
    // Never uses fake linear L1 `newVFwd += latLoss` (which created phantom perpetual-motion rocket speed while turning uphill!).
    // Released lateral kinetic energy: dE_lat = vLat² - newVLat² >= 0.
    // Clean rail carve redirects `carveEfficiency` (up to ~0.90) of dE_lat into forward motion along ski axis;
    // skidding / Shift hockey-stop dissipates ~95% into snow spray & deceleration!
    const cleanCarveMask = (1.0 - THREE.MathUtils.smoothstep(absSlip, 0.18, 0.72))
                         * THREE.MathUtils.smoothstep(edgeAgainstSlide, 0.10, 0.42);
    const baseEff = (surf.id === 'packed' || surf.id === 'corn') ? 0.90
                  : (surf.id === 'powder' ? 0.78 : (surf.id === 'ice' ? 0.55 : 0.68));
    const carveEfficiency = brake ? 0.04 : (0.12 + (baseEff - 0.12) * cleanCarveMask);
    const dELat = Math.max(0.0, vLat * vLat - newVLat * newVLat);
    if (dELat > 1e-6 && (Math.abs(newVFwd) > 0.25 || cleanCarveMask > 0.25)) {
      const fwdSign = Math.abs(newVFwd) > 0.05 ? Math.sign(newVFwd) : (vFwd >= 0 ? 1 : -1);
      newVFwd = fwdSign * Math.sqrt(newVFwd * newVFwd + carveEfficiency * dELat);
    }

    // Active stationary brake lock: holding Shift while stopped/crawling on a steep face digs edges in cleanly!
    if (brake && Math.hypot(newVFwd, newVLat) < 0.45 && Math.abs(gFwd) < 4.5) {
      newVFwd *= Math.exp(-dt * 12.0);
    }

    // Static snow stiction when virtually stopped on flat/gentle snow so skis rest calmly instead of crawling forever!
    if (this._poleDriveTimer <= 0 && !wPolingActive && t.slopeDeg < 5.0 && Math.hypot(newVFwd, newVLat) < 0.18 && Math.abs(gFwd) < muBase * normalWeight * 1.15) {
      newVFwd = 0;
    }
    if (t.slopeDeg < 6.5 && Math.abs(newVLat) < 0.08 && Math.abs(gLat) < maxEdgeBite * 0.9) {
      vel.copy(fwd).multiplyScalar(newVFwd);
    } else {
      vel.copy(fwd).multiplyScalar(newVFwd).addScaledVector(right, newVLat);
    }

    s.vx = vel.x; s.vy = vel.y; s.vz = vel.z;
    s.speed = vel.length();

    // Update live concise stance state for HUD & telemetry
    if (this._poleDriveTimer > 0 || wPolingActive) s.stanceMode = 'POLE';
    else if (brake) s.stanceMode = s.speed > 1.2 ? 'SKID' : 'HOLD';
    else if (hasSlope && t.slopeDeg > 3.5 && cosFall < -0.25 && s.speed > 0.6) s.stanceMode = 'UPHILL';
    else if (s.washOut > 0.28) s.stanceMode = 'SLIP';
    else if (s.sideslip > 0.26 && edgeAgainstSlide < 0.35) s.stanceMode = 'SLIP';
    else if (cleanCarveMask > 0.32 && absEdge > 0.26 && s.speed > 4.0) s.stanceMode = 'CARVE';
    else if (absSlip > 0.34 && s.speed > 3.5) s.stanceMode = 'SKID';
    else if (t.slopeDeg < 4.5 && s.speed < 0.8) s.stanceMode = 'FLAT';
    else s.stanceMode = 'GLIDE';

    const nextX = s.x + s.vx * dt;
    const nextZ = s.z + s.vz * dt;
    const nextT = this.terrainData.sampleTerrain(nextX, nextZ);

    // Check natural wind-lip / cornice kicker ramp launch!
    let kickerHit = null;
    if (this._kickerCooldown <= 0 && s.speed > 7.5 && this.kickers.length > 0) {
      for (let i = 0; i < this.kickers.length; i++) {
        const k = this.kickers[i];
        const dx = nextX - k.x;
        if (Math.abs(dx) > k.radius) continue;
        const dz = nextZ - k.z;
        if (Math.abs(dz) > k.radius) continue;
        const along = dx * k.fwdX + dz * k.fwdZ;
        const across = Math.abs(dx * (-k.fwdZ) + dz * k.fwdX);
        const velAlign = (s.vx * k.fwdX + s.vz * k.fwdZ) / Math.max(0.1, Math.hypot(s.vx, s.vz));
        if (along > 1.2 && along < k.radius && across < k.width && velAlign > 0.35) {
          kickerHit = k;
          break;
        }
      }
    }

    const popped = !jumpNow && this.prevJumpHeld && s.popCharge > 0.04;
    const expectedY = s.y + s.vy * dt;
    const slopeDropGap = expectedY - nextT.y;
    const detachSpeed = Math.hypot(s.vx, s.vz);
    const naturalLaunch = (slopeDropGap > 0.14 && detachSpeed > 13.0 && (s.slopeDeg > 20 || nextT.slopeDeg > s.slopeDeg + 6));

    if (popped || naturalLaunch || kickerHit) {
      s.grounded = false;
      s.stanceMode = 'AIR';
      s.airTime = 0;
      s.launchY = s.y;
      s.peakAirHeight = 0;
      s.airPitch = 0; s.airYaw = 0; s.airRoll = 0;
      s.grabDuration = 0;
      s.prevLeftSki = null;
      s.prevRightSki = null;
      this._poleDriveTimer = 0;
      // Start airborne body & camera gravity-upright (EXACT match to grounded posture -> ZERO takeoff/landing teleport snap!)
      this._airBodyQuat.setFromAxisAngle(this._upAxis, -s.yaw);
      s.bodyQuat.copy(this._airBodyQuat);

      // Mask continuously-held W/Up (downhill tuck) on takeoff so rollers/pops never cause accidental nose-first frontflips!
      this._airPitchHoldMask = foreIn > 0.20 ? 1 : 0;

      if (kickerHit) {
        this._kickerCooldown = 1.6;
        // Real ramp deflection: normal launch velocity proportional to incoming speed * sin(rampAngle) + optional timed ollie!
        const rampSlope = kickerHit.rampSlope || 0.24;
        const speedBoost = Math.min(4.8, s.speed * rampSlope);
        const ollieAdd = s.popCharge * 1.10;
        const kickV = THREE.MathUtils.clamp(speedBoost + ollieAdd, 1.8, 5.6);
        const lx = n.x * 0.55, ly = n.y * 0.78 + 0.22, lz = n.z * 0.55;
        const lMag = Math.hypot(lx, ly, lz) || 1;
        s.vx += (lx / lMag) * kickV;
        s.vy += (ly / lMag) * kickV;
        s.vz += (lz / lMag) * kickV;
        s.angYaw = steerEff * 1.3;
        s.angPitch = foreIn < -0.20 ? foreIn * 1.4 : 0;
        s.angRoll = 0;
        this.events.push({ type: 'pop', x: s.x, y: s.y, z: s.z, charge: Math.max(0.6, s.popCharge) });
      } else if (popped) {
        // Realistic human vertical leap in rigid alpine ski boots:
        //  - Quick tap: ~1.55 m/s (~0.12m / 5 in agile hop)
        //  - Full-charge crouch ollie: ~3.05 m/s packed (~0.47m / 1.55 ft!), ~2.44 m/s deep powder (~0.30m / 1.0 ft!)
        //  - Tail-flex spring bonus at speed: up to +0.35 m/s above 14 m/s!
        const surfPopMult = surf.id === 'powder' ? 0.80 : (surf.id === 'corn' ? 0.90 : 1.0);
        const flexBonus = THREE.MathUtils.clamp((curSpeed - 6.0) / 18.0, 0, 1) * 0.35 * s.popCharge;
        const popStrength = ((1.40 + 1.65 * Math.pow(s.popCharge, 0.85)) * surfPopMult) + flexBonus;
        const lx = n.x * 0.82, ly = n.y * 0.82 + 0.18, lz = n.z * 0.82;
        const lMag = Math.hypot(lx, ly, lz) || 1;
        s.vx += (lx / lMag) * popStrength;
        s.vy += (ly / lMag) * popStrength;
        s.vz += (lz / lMag) * popStrength;
        s.angYaw = steerEff * (1.1 + 1.9 * s.popCharge);
        s.angPitch = foreIn < -0.20 ? foreIn * (1.2 + 1.8 * s.popCharge) : 0;
        s.angRoll = 0;
        this.events.push({ type: 'pop', x: s.x, y: s.y, z: s.z, charge: s.popCharge });
      } else {
        s.angYaw = steerEff * 0.55;
        s.angPitch = 0;
        s.angRoll = 0;
      }
      s.popCharge = 0;
      this._landingQuatBlend = 0;
      if (popped) {
        // Gentle upward knee-extension spring on jump takeoff
        this._landVel = Math.min(0, this._landVel) - 0.35;
      }
      s.x = nextX; s.z = nextZ; s.y = Math.max(expectedY, nextT.y + 0.035);
      return;
    }

    s.x = nextX;
    s.z = nextZ;
    s.y = nextT.y;

    // Powder spray, 3D dynamic shovel bow-wave snow wash, & localized downhill sluff streams!
    const edgeEnergy = s.speed * (Math.abs(Math.sin(s.slipAngle)) * 1.45 + absEdge * 0.55 + s.sideslip * 0.65 + (brake ? 1.15 : 0));
    s.sprayRate = THREE.MathUtils.clamp((edgeEnergy / 11.5) * surf.sprayMult, 0, 2.5);
    let targetBow = 0;
    if (surf.id === 'powder') {
      const spdBow = THREE.MathUtils.clamp((s.speed - 4.8) / 13.0, 0, 1);
      targetBow = THREE.MathUtils.clamp(
        spdBow * (0.44 + 0.50 * Math.abs(s.edgeAngle) + 0.52 * Math.abs(Math.sin(s.slipAngle)) + Math.max(0, s.foreAft) * 0.25),
        0, 1.0
      );
    } else if ((surf.id === 'packed' || surf.id === 'corn') && brake && s.speed > 7.0) {
      targetBow = THREE.MathUtils.clamp((s.speed - 7.0) / 18.0, 0, 0.35);
    }
    s.bowWave += (targetBow - s.bowWave) * Math.min(1, dt * 6.5);

    if (s.sprayRate > 1.35 && surf.id === 'powder' && s.speed > 13.5) {
      s.faceShotIntensity = Math.min(0.55, s.faceShotIntensity + dt * (s.sprayRate - 1.25) * 0.42);
    }
    if (s.slopeDeg > 33 && s.sprayRate > 0.52 && surf.id === 'powder') {
      s.sluffTrigger = Math.min(1.0, s.sluffTrigger + dt * 1.25);
    }
    // Live localized downhill cold-powder sluff streams snaking down steep (>27°) pitch ahead/beside skis!
    if (s.slopeDeg > 27.0 && surf.id === 'powder' && s.sprayRate > 0.40 && s.speed > 5.0) {
      const gm = Math.hypot(t.gx, t.gz);
      if (gm > 0.15) {
        this._sluffAccum += dt * (4.5 + s.sprayRate * 5.0 * Math.min(1.5, (s.slopeDeg - 24.0) / 16.0));
        if (this._sluffAccum >= 1.0) {
          this._sluffAccum = Math.min(2.0, this._sluffAccum - 1.0);
          const dirX = -t.gx / gm, dirZ = -t.gz / gm;
          const sideX = -dirZ, sideZ = dirX;
          const lat = (Math.random() - 0.5) * 2.2;
          const sxPos = s.x + sideX * lat + dirX * (0.8 + Math.random() * 1.4);
          const szPos = s.z + sideZ * lat + dirZ * (0.8 + Math.random() * 1.4);
          this.events.push({
            type: 'sluffStream',
            x: sxPos,
            y: this.terrainData.sampleHeight(sxPos, szPos) + 0.08,
            z: szPos,
            dirX,
            dirZ,
            slopeDeg: s.slopeDeg,
            strength: THREE.MathUtils.clamp((s.slopeDeg - 26.0) / 18.0 + s.sprayRate * 0.35, 0.25, 1.0),
          });
        }
      }
    } else {
      this._sluffAccum = 0;
    }

    // Automatic rare Slab Avalanche trigger on steep >32° wind-loaded powder during aggressive hard carve!
    if (this.avalanchesEnabled && !this.avalanche.active && this.avalanche.cooldown <= 0 && s.slopeDeg > 32.0 && t.powder > 0.50 && s.sprayRate > 1.45 && s.speed > 13.0) {
      if (Math.random() < dt * 0.16) {
        this.triggerAvalanche(-22, 30);
      }
    }

    // Razor-sharp parallel twin ski track stamping (sep = 0.31m => 0.62m stance gauge with crisp untouched center white rib & anti-aliased wall!)
    const sep = 0.31;
    const rx = Math.cos(s.yaw), rz = Math.sin(s.yaw);
    const lx = s.x - rx * sep, lz = s.z - rz * sep;
    const rxp = s.x + rx * sep, rzp = s.z + rz * sep;
    if (surf.sinkDepth > 0.01 && s.speed > 0.35) {
      if (s.prevLeftSki) {
        const dMoved = Math.hypot(lx - s.prevLeftSki[0], lz - s.prevLeftSki[1]);
        if (dMoved > 0.14 && dMoved < 6.0) {
          const depth = THREE.MathUtils.clamp((surf.sinkDepth * 3.15) * (0.48 + 0.52 * Math.min(1, s.speed / 12) + Math.abs(s.edgeAngle) * 0.32), 0.14, 0.94);
          const berm = THREE.MathUtils.clamp(depth * (0.62 + Math.abs(Math.sin(s.slipAngle)) * 0.68 + (brake ? 0.5 : 0)), 0.18, 0.96);
          // Smooth anti-aliased edge width (>= 2.1 texels in 1536 buffer -> ZERO diagonal staircase beads!)
          const rad = 0.088 + Math.abs(Math.sin(s.slipAngle)) * 0.036 + (brake ? 0.068 : 0);
          this.events.push({
            type: 'track',
            lA: s.prevLeftSki, lB: [lx, lz],
            rA: s.prevRightSki, rB: [rxp, rzp],
            radius: rad, depth, berm,
            skew: Math.sign(s.edgeAngle || s.slipAngle || 1) * Math.min(1, Math.abs(s.slipAngle) * 1.6),
            iceGlint: surf.id === 'powder' ? 0.45 : 0.88,
          });
          s.prevLeftSki = [lx, lz];
          s.prevRightSki = [rxp, rzp];
        }
      } else {
        s.prevLeftSki = [lx, lz];
        s.prevRightSki = [rxp, rzp];
      }
    }

    // Rate-limited billowing carving coldsmoke rooster-tails (~28–42 events/sec, independent of 120 Hz physics tick so plumes never stack into an opaque wall!)
    if (s.sprayRate > 0.16 && s.speed > 2.8) {
      this._sprayAccum += dt * (18.0 + s.sprayRate * 16.0);
      if (this._sprayAccum >= 1.0) {
        this._sprayAccum = Math.min(2.0, this._sprayAccum - 1.0);
        const side = s.edgeAngle >= 0 ? -1 : 1;
        this.events.push({
          type: 'spray',
          x: s.x + rx * side * 0.35 - Math.sin(s.yaw) * 0.45,
          y: s.y + 0.08,
          z: s.z + rz * side * 0.35 + Math.cos(s.yaw) * 0.45,
          vx: s.vx * 0.28 + rx * side * (1.8 + s.sprayRate * 2.6),
          vy: 0.72 + s.sprayRate * 1.05,
          vz: s.vz * 0.28 + rz * side * (1.8 + s.sprayRate * 2.6),
          rate: s.sprayRate,
          sluff: s.sluffTrigger > 0.3,
          slopeX: -t.gx, slopeZ: -t.gz,
        });
      }
    } else {
      this._sprayAccum = 0;
    }

    this._updateGroundedQuaternion(dt);
  }

  _stepAirborne(dt, t, steer, foreIn, corkIn, grabNow, time) {
    const s = this.state;
    s.airTime += dt;
    s.stanceMode = 'AIR';
    s.sideslip = 0;
    s.washOut = 0;
    s.carveLoadG = 0.0;
    s.sprayRate = 0;
    s.bowWave = Math.max(0, s.bowWave - dt * 6.0);
    s.polePlantL = Math.max(0, s.polePlantL - dt * 4.5);
    s.polePlantR = Math.max(0, s.polePlantR - dt * 4.5);
    s.skatePush = Math.max(0, s.skatePush - dt * 5.0);
    s.insideUnweight *= Math.exp(-dt * 4.0);

    s.vy -= GRAVITY * dt;
    const airDrag = Math.exp(-dt * 0.045);
    s.vx *= airDrag; s.vz *= airDrag;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    s.speed = Math.hypot(s.vx, s.vy, s.vz);

    const groundT = this.terrainData.sampleTerrain(s.x, s.z);
    s.terrainY = groundT.y;
    s.normal.set(groundT.nx, groundT.ny, groundT.nz);
    const clearance = s.y - groundT.y;
    if (clearance > s.peakAirHeight) s.peakAirHeight = clearance;

    const grabBoost = grabNow ? 1.24 : 1.0;
    if (grabNow) s.grabDuration += dt;
    s.crouch += ((grabNow ? 0.85 : 0.32) - s.crouch) * Math.min(1, dt * 9);

    const maxSpin = 6.2 * grabBoost;
    const maxFlip = 5.4 * grabBoost;
    const maxCork = 4.6 * grabBoost;

    // Combine keyboard air spin with subtle natural head-spotting twist torque!
    const altHeld = this.keys.has('AltLeft') || this.keys.has('AltRight') || this.freeLookHeld;
    const headSpin = (this.headSteerEnabled && !altHeld && Math.abs(this.lookYawOff) > 0.08)
      ? THREE.MathUtils.clamp((this.lookYawOff - Math.sign(this.lookYawOff) * 0.08) * 0.72, -0.58, 0.58)
      : 0;
    const totalAirSteer = THREE.MathUtils.clamp(steer + headSpin, -1.25, 1.25);

    if (Math.abs(totalAirSteer) > 0.05) {
      s.angYaw = THREE.MathUtils.clamp(s.angYaw + totalAirSteer * 11.5 * grabBoost * dt, -maxSpin, maxSpin);
    } else {
      s.angYaw *= Math.exp(-dt * 2.2);
    }
    if (Math.abs(headSpin) > 0.01) {
      const bleed = Math.sign(this.lookYawOff) * Math.min(Math.abs(this.lookYawOff), Math.abs(s.angYaw) * dt * 0.45);
      this.lookYawOff = wrapAngle(this.lookYawOff - bleed);
    }
    if (this._airPitchHoldMask && foreIn <= 0.15) {
      this._airPitchHoldMask = 0;
    }
    const effForeIn = (this._airPitchHoldMask && foreIn > 0) ? 0 : foreIn;
    if (Math.abs(effForeIn) > 0.05) {
      s.angPitch = THREE.MathUtils.clamp(s.angPitch - effForeIn * 10.2 * grabBoost * dt, -maxFlip, maxFlip);
    } else {
      s.angPitch *= Math.exp(-dt * 3.2);
    }
    if (Math.abs(corkIn) > 0.05) {
      s.angRoll = THREE.MathUtils.clamp(s.angRoll + corkIn * 9.5 * grabBoost * dt, -maxCork, maxCork);
    } else {
      s.angRoll *= Math.exp(-dt * 2.6);
    }

    s.airYaw += s.angYaw * dt;
    s.airPitch += s.angPitch * dt;
    s.airRoll += s.angRoll * dt;

    const dq = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(s.angPitch * dt, -s.angYaw * dt, -s.angRoll * dt, 'YXZ')
    );
    s.quat.multiply(dq).normalize();
    this._airBodyQuat.multiply(dq).normalize();
    s.bodyQuat.copy(this._airBodyQuat);

    const fwdWorld = new THREE.Vector3(0, 0, -1).applyQuaternion(s.quat);
    if (Math.hypot(fwdWorld.x, fwdWorld.z) > 0.25) {
      s.yaw = Math.atan2(fwdWorld.x, -fwdWorld.z);
    }

    if (s.y <= groundT.y) {
      s.y = groundT.y;
      s.grounded = true;
      const n = new THREE.Vector3(groundT.nx, groundT.ny, groundT.nz);
      const vel = new THREE.Vector3(s.vx, s.vy, s.vz);
      const impactNormalSpeed = Math.max(0, -vel.dot(n));

      const skiUp = new THREE.Vector3(0, 1, 0).applyQuaternion(s.quat);
      const skiFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(s.quat);
      const upAlign = skiUp.dot(n);
      const tiltErrDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(upAlign, -1, 1)));

      const hVel = vel.clone().addScaledVector(n, -vel.dot(n));
      const hSpd = hVel.length();
      let crossErrDeg = 0;
      let signedTravelDot = 1.0;
      if (hSpd > 3.0) {
        const travelDir = hVel.clone().normalize();
        const skiFlat = skiFwd.clone().addScaledVector(n, -skiFwd.dot(n));
        if (skiFlat.length() > 0.1) {
          skiFlat.normalize();
          signedTravelDot = skiFlat.dot(travelDir);
          crossErrDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(Math.abs(signedTravelDot), 0, 1)));
        }
      }

      const surf = groundT.surface;
      const maxImpact = surf.id === 'powder' ? 21.5 : (surf.id === 'packed' || surf.id === 'corn' ? 16.5 : 13.0);
      const maxTilt = surf.id === 'powder' ? 58.0 : (surf.id === 'ice' || surf.id === 'granite' ? 38.0 : 48.0);
      const maxCross = surf.id === 'powder' ? 68.0 : (surf.id === 'ice' ? 42.0 : 54.0);

      const bigAir = s.airTime > 0.42 && s.peakAirHeight > 0.72;

      if (tiltErrDeg > maxTilt || impactNormalSpeed > maxImpact || (bigAir && crossErrDeg > maxCross && hSpd > 11)) {
        let reason = 'OVER-ROTATED LANDING';
        if (impactNormalSpeed > maxImpact) reason = `FLAT IMPACT (${impactNormalSpeed.toFixed(0)} m/s)`;
        else if (crossErrDeg > maxCross) reason = `CAUGHT EDGE (${crossErrDeg.toFixed(0)}° CROSS-LINE)`;
        else if (upAlign < 0) reason = 'INVERTED IMPACT';
        this._triggerCrash(reason, groundT, impactNormalSpeed);
        return;
      }

      // Clean Switch (fakie) landing detection!
      const wasSwitch = s.isSwitch;
      const landedSwitch = signedTravelDot < -0.35;
      s.isSwitch = landedSwitch;

      const sketchy = tiltErrDeg > maxTilt * 0.65 || impactNormalSpeed > maxImpact * 0.72 || crossErrDeg > maxCross * 0.72;
      s.lastLandingQuality = sketchy ? 'SKETCHY' : 'STOMPED';
      if (sketchy) {
        s.vx *= 0.72; s.vz *= 0.72;
        s.camShake = 0.85;
      } else {
        s.vx *= (surf.id === 'powder' ? 0.90 : 0.96);
        s.vz *= (surf.id === 'powder' ? 0.90 : 0.96);
        s.camShake = Math.min(0.55, impactNormalSpeed * 0.04);
      }

      const newVel = new THREE.Vector3(s.vx, s.vy, s.vz);
      newVel.addScaledVector(n, -newVel.dot(n));
      s.vx = newVel.x; s.vy = newVel.y; s.vz = newVel.z;

      // Inject physical normal impact velocity into critically-damped knee suspension spring-damper
      // (NO instant 1-frame s.crouch or s.landImpact teleport snap — knees smoothly flex DOWN 14-33cm & rebound!)
      const softFactor = surf.id === 'powder' ? 0.88 : (surf.id === 'ice' ? 1.12 : 1.02);
      const impDrive = 1.25 + Math.min(3.3, impactNormalSpeed * 0.36);
      this._landVel += Math.min(4.40, impDrive * softFactor);
      this._landPitchVel -= Math.min(2.6, (0.55 + impactNormalSpeed * 0.19) * softFactor);
      if (sketchy) {
        this._landRollVel += (s.edgeAngle >= 0 ? 1 : -1) * Math.min(2.4, impactNormalSpeed * 0.16);
      } else {
        this._landRollVel += (s.edgeAngle >= 0 ? -1 : 1) * Math.min(0.45, impactNormalSpeed * 0.03);
      }
      this._scissorTarget = (sketchy ? 0.86 : Math.min(0.60, impactNormalSpeed * 0.050)) * (s.edgeAngle >= 0 ? 1 : -1);
      if (surf.id === 'powder') {
        s.bowWave = Math.min(1.0, Math.max(s.bowWave, impactNormalSpeed * 0.085));
      }
      s.faceShotIntensity = Math.min(0.65, s.faceShotIntensity + (surf.id === 'powder' ? Math.min(0.38, impactNormalSpeed * 0.030) : 0.06));

      // Heavy landing stomp on steep wind-loaded powder (>32°) can fracture a Slab Avalanche!
      if (this.avalanchesEnabled && !this.avalanche.active && this.avalanche.cooldown <= 0 && groundT.slopeDeg > 32.0 && groundT.powder > 0.50 && impactNormalSpeed > 9.5) {
        if (Math.random() < 0.45) this.triggerAvalanche(-18, 32);
      }

      if (bigAir) {
        const parts = [];
        if (wasSwitch) parts.push('SWITCH');
        const flips = Math.round(Math.abs(s.airPitch) / (Math.PI * 1.65));
        const spins = Math.round(Math.abs(s.airYaw) / (Math.PI * 0.85)) * 180;
        const corks = Math.abs(s.airRoll) > 1.25;
        if (flips >= 1) parts.push((s.airPitch > 0 ? (flips > 1 ? 'DOUBLE BACKFLIP' : 'BACKFLIP') : (flips > 1 ? 'DOUBLE FRONTFLIP' : 'FRONTFLIP')));
        if (corks && spins >= 360) parts.push(`CORK ${spins}`);
        else if (spins >= 180) parts.push(`${spins}°`);
        if (s.grabDuration > 0.18) parts.push('MUTE GRAB');
        if (landedSwitch && !wasSwitch) parts.push('TO SWITCH');
        const label = parts.length ? parts.join(' · ') : 'CLIFF DROP';
        s.lastTrickText = `${s.lastLandingQuality} · ${label} (${s.peakAirHeight.toFixed(1)}m AIR)`;
        s.lastTrickTime = time;
      }

      this.events.push({
        type: 'land',
        x: s.x, y: groundT.y, z: s.z,
        impact: impactNormalSpeed,
        powder: surf.id === 'powder',
        sketchy,
      });

      s.angPitch = s.angYaw = s.angRoll = 0;
      this.clampLookOffsets(this.camMode);
      // Smoothly slerp ski/body quaternion onto landing slope normal over ~0.14s (eliminates 1-frame orientation snap!)
      this._landingStartQuat.copy(s.quat);
      this._landingQuatBlend = 1.0;
      this._updateGroundedQuaternion(dt);
    }
  }

  _triggerCrash(reason, groundT, impact) {
    const s = this.state;
    s.crashed = true;
    s.crashTimer = 0;
    s.crashReason = reason;
    s.lastLandingQuality = 'WIPEOUT';
    s.lastTrickText = `WIPEOUT · ${reason}`;
    s.lastTrickTime = performance.now() * 0.001;
    s.faceShotIntensity = 0.72;
    s.camShake = 1.0;
    s.vx *= 0.55; s.vz *= 0.55; s.vy = 0;
    this.events.push({ type: 'crash', x: s.x, y: groundT.y, z: s.z, impact: Math.max(8, impact), reason });
  }

  _checkCollisions(time = 0) {
    const s = this.state;
    if (s.crashed) return;
    const fastTreeCheck = s.speed > 9.0;
    const invSpd = fastTreeCheck ? (1.0 / Math.max(0.1, Math.hypot(s.vx, s.vz))) : 0;
    const vDirX = fastTreeCheck ? s.vx * invSpd : 0;
    const vDirZ = fastTreeCheck ? s.vz * invSpd : 0;
    const rgtX = Math.cos(s.yaw + this.lookYawOff);
    const rgtZ = Math.sin(s.yaw + this.lookYawOff);

    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const maxBox = (fastTreeCheck && c.kind === 'tree') ? 9.8 : (c.r + 1.5);
      const dx = s.x - c.x;
      if (Math.abs(dx) > maxBox) continue;
      const dz = s.z - c.z;
      if (Math.abs(dz) > maxBox) continue;
      if (s.y > c.y + c.h) continue;
      const d = Math.hypot(dx, dz);
      const minD = c.r + 0.55;
      if (d < minD && d > 0.001) {
        const nx = dx / d, nz = dz / d;
        s.x = c.x + nx * minD;
        s.z = c.z + nz * minD;
        const vn = s.vx * nx + s.vz * nz;
        if (vn < -10.5) {
          this._triggerCrash(`STRUCK ${c.kind.toUpperCase()}`, this.terrainData.sampleTerrain(s.x, s.z), -vn);
          return;
        } else if (vn < 0) {
          s.vx -= nx * vn * 1.35;
          s.vz -= nz * vn * 1.35;
          s.camShake = Math.max(s.camShake, 0.55);
        }
      } else if (fastTreeCheck && c.kind === 'tree' && d < 9.5) {
        // Stereo Doppler tree-whoosh right as evergreen boughs whip abeam of helmet!
        const tx = c.x - s.x;
        const tz = c.z - s.z;
        const along = tx * vDirX + tz * vDirZ;
        if (along > -2.2 && along < 3.5) {
          const lastT = this._whooshCD.get(i) ?? -99;
          if (time - lastT > 1.8) {
            this._whooshCD.set(i, time);
            const lat = tx * rgtX + tz * rgtZ;
            this.events.push({
              type: 'treeWhoosh',
              pan: THREE.MathUtils.clamp(lat / 5.5, -1, 1),
              closeness: THREE.MathUtils.clamp(1.0 - d / 9.5, 0.12, 1.0),
              speed: s.speed,
            });
          }
        }
      }
    }
  }

  applyCamera(camera, mode = 'gopro', time = 0, dt = 0.016) {
    const s = this.state;
    this.camMode = mode;
    this.clampLookOffsets(mode);

    const isChesty = mode === 'chesty';
    const poleBob = s.grounded ? (this._poleBobY + (s.stepBounce || 0) * 0.018) : 0;
    const switchHopLift = (s.grounded && this._switchHopT > 0) ? Math.sin(this._switchHopT * Math.PI) * 0.085 : 0;
    // Smooth physical spring-damper knee compression drop (zero 1-frame teleport snap!)
    const landDrop = Math.max(-0.04, this._landDisp) * (isChesty ? 0.78 : 0.96);
    const eyeHeight = (isChesty
      ? (1.20 - s.crouch * 0.24 - landDrop)
      : (1.63 - s.crouch * 0.36 - landDrop)) + poleBob + switchHopLift;
    const localEye = new THREE.Vector3(0, eyeHeight, isChesty ? -0.14 : -0.06);

    if (s.crashed) {
      localEye.set(0, 0.56, 0);
      localEye.applyQuaternion(s.quat);
      camera.position.set(s.x + localEye.x, Math.max(s.terrainY + 0.52, s.y + localEye.y), s.z + localEye.z);
      camera.quaternion.copy(s.quat);
      this.enforceCameraClearance(camera, 0.48, true);
      camera.fov += (94 - camera.fov) * Math.min(1, dt * 8);
      camera.updateProjectionMatrix();
      return;
    }

    if (s.grounded) {
      const chatterAmp = s.surface.chatter * Math.min(1.0, s.speed / 22.0) * (isChesty ? 0.025 : 0.022);
      // Smooth damped multi-frequency shudder instead of unfiltered Math.random() frame jitter
      const shakeEnv = s.camShake * 0.032;
      const vibX = Math.sin(time * 57.0) * chatterAmp + (Math.sin(time * 31.0) * 0.65 + Math.cos(time * 49.0) * 0.35) * shakeEnv;
      const vibY = Math.cos(time * 43.0) * chatterAmp * 0.8 + (Math.cos(time * 37.0) * 0.65 + Math.sin(time * 53.0) * 0.35) * shakeEnv;

      // TRUE perspective switch: camera faces directly along `s.yaw + lookYawOff`!
      // When you switch stance (`X`), BOTH skis and camera genuinely rotate 180° to look uphill over your tips & carved tracks!
      this._switchYawBlend = 0;
      const viewYaw = s.yaw + this.lookYawOff;
      const fwdX = Math.sin(viewYaw);
      const fwdZ = -Math.cos(viewYaw);

      const skiFwdX = Math.sin(s.yaw), skiFwdZ = -Math.cos(s.yaw);
      const skiRgtX = Math.cos(s.yaw), skiRgtZ = Math.sin(s.yaw);

      const slopeAlong = -(this.terrainData.sampleHeight(s.x + fwdX * 8, s.z + fwdZ * 8) - s.y) / 8.0;
      const pitchBias = isChesty ? -0.22 : -0.14;
      // Wide upper clamp (+0.46) ensures looking uphill in Switch stance on steep 35-45° pitches frames the slope cleanly above tips!
      const targetSlopePitch = THREE.MathUtils.clamp(-Math.atan(slopeAlong) * 0.48 + pitchBias, -0.68, 0.46);
      this._smoothSlopePitch += (targetSlopePitch - this._smoothSlopePitch) * Math.min(1, dt * 5.5);

      const minTotalPitch = isChesty ? -0.78 : -0.74;
      const maxTotalPitch = isChesty ? 0.70 : 0.84;
      const finalPitch = THREE.MathUtils.clamp(this._smoothSlopePitch + this.lookPitchOff + this._landPitch, minTotalPitch, maxTotalPitch);

      if (isChesty) {
        // Sternum-mounted 3D Chest-Mount "Chesty" harness: pushed gently ahead of sternum so ZERO chest/shoulder caps clip!
        const latShift = s.edgeAngle * 0.16;
        const chestPush = 0.12 + (s.skatePush || 0) * Math.sin(s.skatePhase || 0) * 0.025;
        const baseX = s.x + skiFwdX * chestPush + skiRgtX * latShift;
        const baseZ = s.z + skiFwdZ * chestPush + skiRgtZ * latShift;
        camera.position.set(
          baseX + fwdX * 0.13 + vibX,
          s.y + eyeHeight + vibY,
          baseZ + fwdZ * 0.13
        );
      } else {
        // True cervical neck-pivot orbital camera (note: Three.js fov=86° is VERTICAL FOV, so finalPitch=-0.74 keeps bottom ray <=85° down,
        // framing boots/skis/arms naturally while staying clear of the skier's own collar & backpack dome!)
        const latCamShift = s.edgeAngle * 0.18;
        const neckBack = 0.03 + s.crouch * 0.02;
        const downPush = THREE.MathUtils.smoothstep(-finalPitch, 0.28, 0.74);
        const eyeOrbit = 0.22 + downPush * 0.14;
        const sideAbs = Math.min(1.0, Math.abs(this.lookYawOff) / 1.4);
        const eyeLift = downPush * 0.07 + sideAbs * 0.04;
        const neckX = s.x - skiFwdX * neckBack + skiRgtX * latCamShift;
        const neckZ = s.z - skiFwdZ * neckBack + skiRgtZ * latCamShift;
        camera.position.set(
          neckX + fwdX * eyeOrbit + vibX,
          s.y + eyeHeight + eyeLift + vibY,
          neckZ + fwdZ * eyeOrbit
        );
      }

      // Capture exact residual camera offset across an airborne->grounded transition (e.g., landing slightly tilted from a trick)
      // and decay it smoothly over ~0.12s so EVERY landing (flat, steep 45° couloir, or sketchy backflip!) has ZERO 1-frame snap!
      const rawRelX = camera.position.x - s.x;
      const rawRelY = camera.position.y - s.y;
      const rawRelZ = camera.position.z - s.z;
      if (this._prevCamWasAir && this._hasPrevCamRel) {
        this._landCamDelta.set(
          THREE.MathUtils.clamp(this._prevCamRel.x - rawRelX, -0.55, 0.55),
          THREE.MathUtils.clamp(this._prevCamRel.y - rawRelY, -0.45, 0.45),
          THREE.MathUtils.clamp(this._prevCamRel.z - rawRelZ, -0.55, 0.55)
        );
      }
      this._landCamDelta.multiplyScalar(Math.exp(-dt * 15.0));
      if (this._landCamDelta.lengthSq() > 1e-6) {
        camera.position.add(this._landCamDelta);
      }
      this._prevCamRel.set(camera.position.x - s.x, camera.position.y - s.y, camera.position.z - s.z);
      this._prevCamWasAir = false;
      this._hasPrevCamRel = true;

      const targetRoll = THREE.MathUtils.clamp(-s.edgeAngle * (isChesty ? 0.36 : 0.32), -0.38, 0.34);
      this._smoothCamRoll += (targetRoll - this._smoothCamRoll) * Math.min(1, dt * 8.5);

      this._tmpEuler.set(
        finalPitch,
        -viewYaw,
        this._smoothCamRoll + this._landRoll + Math.sin(time * 31) * chatterAmp * 0.55,
        'YXZ'
      );
      camera.quaternion.setFromEuler(this._tmpEuler);
      this.enforceCameraClearance(camera, isChesty ? 0.56 : 0.62, true);
    } else {
      // Airborne: orbit eyes around gravity-upright `_airBodyQuat` (tracks flips/corks smoothly with ZERO slope-normal takeoff/landing teleport!)
      const lFwdX = Math.sin(this.lookYawOff);
      const lFwdZ = -Math.cos(this.lookYawOff);
      const viewPitch = THREE.MathUtils.clamp(this._smoothSlopePitch + this.lookPitchOff, isChesty ? -0.78 : -0.74, isChesty ? 0.70 : 0.84);
      if (isChesty) {
        const latShift = s.edgeAngle * 0.16;
        localEye.set(latShift + lFwdX * 0.13, eyeHeight, -0.12 + lFwdZ * 0.13);
      } else {
        const latCamShift = s.edgeAngle * 0.18;
        const neckBack = 0.03 + s.crouch * 0.02;
        const downPush = THREE.MathUtils.smoothstep(-viewPitch, 0.28, 0.74);
        const eyeOrbit = 0.22 + downPush * 0.14;
        const sideAbs = Math.min(1.0, Math.abs(this.lookYawOff) / 1.4);
        const eyeLift = downPush * 0.07 + sideAbs * 0.04;
        localEye.set(latCamShift + lFwdX * eyeOrbit, eyeHeight + eyeLift, neckBack + lFwdZ * eyeOrbit);
      }
      localEye.applyQuaternion(this._airBodyQuat);
      camera.position.set(s.x + localEye.x, Math.max(s.terrainY + 0.62, s.y + localEye.y), s.z + localEye.z);
      this._prevCamRel.set(camera.position.x - s.x, camera.position.y - s.y, camera.position.z - s.z);
      this._prevCamWasAir = true;
      this._hasPrevCamRel = true;
      this._landCamDelta.set(0, 0, 0);

      // Gentle slope-tracking pitch anticipation while flying upright so camera flows seamlessly into landing slope!
      const fwdAirX = Math.sin(s.yaw + this.lookYawOff), fwdAirZ = -Math.cos(s.yaw + this.lookYawOff);
      const slopeAhead = -(this.terrainData.sampleHeight(s.x + fwdAirX * 8, s.z + fwdAirZ * 8) - s.terrainY) / 8.0;
      const pitchBias = isChesty ? -0.22 : -0.14;
      const targetAirSlopePitch = THREE.MathUtils.clamp(-Math.atan(slopeAhead) * 0.48 + pitchBias, -0.68, 0.46);
      this._smoothSlopePitch += (targetAirSlopePitch - this._smoothSlopePitch) * Math.min(1, dt * 3.0);
      this._smoothCamRoll *= Math.exp(-dt * 4.5);

      const qPitchTilt = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(viewPitch, -this.lookYawOff, this._smoothCamRoll, 'YXZ')
      );
      camera.quaternion.copy(this._airBodyQuat).multiply(qPitchTilt);
      this.enforceCameraClearance(camera, 0.60, true);
    }

    const baseFov = isChesty ? 92 : (mode === 'gopro' ? 86 : 74);
    const targetFov = baseFov + Math.min(16, (s.speed * 3.6) * 0.145) + (s.grounded ? 0 : 4.0);
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 6.0);
    camera.updateProjectionMatrix();
  }
}
