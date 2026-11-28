// Starship integrated flight study: simulation core.
// Pure module. No DOM, no three.js. Runs in the browser and in Node.
//
// Frame: 2D, Earth-centred, non-rotating. The launch mount sits at (0, R).
// "Downrange" is the arc length along the surface, positive to the east.
// Every number below that is not in PUBLISHED is a modelled assumption.

export const PUBLISHED = Object.freeze({
  stackHeight_m: 124, stackHeightHistoric_m: 121, diameter_m: 9, payloadLEO_t: '100+',
  boosterHeight_m: 72, boosterProp_t: 3650, boosterThrust_tf: 8240, boosterEngines: 33,
  boosterCentre: 13, boosterOuter: 20,
  shipHeight_m: 52, shipProp_t: 1600, shipEngines: 6, shipSL: 3, shipRVac: 3,
  raptor3SL_tf_low: 250, raptor3SL_tf_high: 280, raptor3IspVac_s: 350, raptor3Dry_kg: 1525,
  tiles_approx: 18000,
});

export const MODEL = Object.freeze({
  g0: 9.80665, mu: 3.986004418e14, R: 6.371e6,
  rho0: 1.225, H: 8400, p0: 101325, atmTop: 140e3,
  // mass (t)
  boosterDry_t: 260, shipDry_t: 120, payload_t: 0,
  mixtureRatio: 3.6,
  // engines. Booster engine sea-level thrust is calibrated to the conservative 250 tf anchor.
  raptorSL_tf: 250, raptorIspSL: 327, raptorIspVac: 350,
  rvacVac_tf: 290, rvacIspVac: 380, rvacSLFraction: 0.55,
  throttleMin: 0.4, startRate: 1.0, throttleRate: 0.4, shutRate: 4.0,
  // liftoff
  countStart: -10, ignitionT: -3.5, clampMargin: 1.25, towerHeight_m: 150, mountHeight_m: 20,
  // aero
  stackCdA: 0.55 * Math.PI * 4.5 * 4.5,
  boosterDescentCdA: 2.2 * Math.PI * 4.5 * 4.5,
  shipBellyCdA: 1.1 * 9 * 50, shipNoseCdA: 0.5 * Math.PI * 4.5 * 4.5,
  // ascent
  pitchStart: 12, pitchSpan: 130, pitchMax: 1.2, pitchExp: 0.66,
  boosterReserveFrac: 0.12,       // propellant held at MECO for return
  // staging
  stageEarly: 3.0, stageLate: 6.0, autoStageDelay: 2.0,
  shipLightDelay: 0.35, interstageVent: 1.25,
  // ship guidance
  shipTargetAlt: 165e3, shipPerigeeTarget: -50e3, shipLandingReserve_t: 25,
  // booster return
  flipTime: 8.0, boostbackEngines: 13, landingFloor_t: 55,
  gridFinMax: 5.0, catchHeight_m: 30, splashTarget_m: 5000, divertTarget_m: 400,
  goNoGoAlt: 3000, goNoGoRange: 250, goNoGoVh: 150,
  landingIgniteAccel: 30,
  catchPos_m: 8, catchVz: 2.5, catchVh: 2.0,
  entryBurnAlt: 45e3, entryBurnSpeed: 800, entryBurnStop: 650, entryBurnMax: 8,
  // thermal
  noseRadius: 9, suttonK: 1.7415e-4,
  fluxLimit: 650e3, recessionK: 1.6e-10, recessionThreshold: 150e3, tileThickness: 0.025,
  hardImpact: 30,
});

const { g0, mu, R } = MODEL;
const TF = 1000 * g0; // newtons per tonne-force

export function atmosphere(h) {
  if (h > MODEL.atmTop) return { rho: 0, p: 0 };
  const hh = Math.max(0, h);
  const e = Math.exp(-hh / MODEL.H);
  return { rho: MODEL.rho0 * e, p: MODEL.p0 * e };
}

// thrust per engine (N) and mass flow (kg/s) at ambient pressure p, full throttle
export function engineSpec(type, p) {
  if (type === 'rvac') {
    const fv = MODEL.rvacVac_tf * TF;
    const mdot = fv / (MODEL.rvacIspVac * g0);
    const fsl = fv * MODEL.rvacSLFraction;
    return { F: fv - (fv - fsl) * (p / MODEL.p0), mdot };
  }
  const fsl = MODEL.raptorSL_tf * TF;
  const mdot = fsl / (MODEL.raptorIspSL * g0);
  const fv = mdot * MODEL.raptorIspVac * g0;
  return { F: fv - (fv - fsl) * (p / MODEL.p0), mdot };
}

function makeEngines(types) { return types.map((type) => ({ type, cmd: 0, act: 0, startAt: Infinity })); }

function makeBody(name, dry_t, prop_t, types, height) {
  const mr = MODEL.mixtureRatio;
  return {
    name, height,
    pos: { x: 0, y: R + MODEL.mountHeight_m }, vel: { x: 0, y: 0 },
    dry: dry_t * 1000, lox: prop_t * 1000 * mr / (1 + mr), ch4: prop_t * 1000 / (1 + mr),
    propInit: prop_t * 1000,
    engines: makeEngines(types),
    alt: MODEL.mountHeight_m, downrange: 0, vz: 0, vh: 0, speed: 0, q: 0, accel: 0, thrust: 0, mdot: 0,
    attitude: 0, gimbal: 0, gridFin: 0, flapFwd: 0, flapAft: 0,
    status: 'pad', mode: 'pad',
    heat: { flux: 0, peak: 0, recession: 0, margin: 1, peakPassed: false },
  };
}

export const prop = (b) => b.lox + b.ch4;
export const mass = (b) => b.dry + b.lox + b.ch4;

export function createSim(options = {}) {
  const opt = {
    recovery: 'catch', seq: 'auto', tileWear: 0, dispersion: 0, boosterReserveFrac: MODEL.boosterReserveFrac,
    ...options,
  };
  const bTypes = Array.from({ length: 33 }, () => 'sl');
  const sTypes = ['sl', 'sl', 'sl', 'rvac', 'rvac', 'rvac'];
  const booster = makeBody('booster', MODEL.boosterDry_t, PUBLISHED.boosterProp_t, bTypes, PUBLISHED.boosterHeight_m);
  const ship = makeBody('ship', MODEL.shipDry_t + MODEL.payload_t, PUBLISHED.shipProp_t, sTypes, PUBLISHED.shipHeight_m);

  const s = {
    t: MODEL.countStart, phase: 'safe', armed: false, counting: false,
    attached: true, liftoffT: null, mecoT: null, stageCmdT: null, stageQueued: false, stageT: null,
    shipIgnT: null, sepT: null, cut: false, terminated: false,
    recovery: opt.recovery, seq: opt.seq, tileWear: opt.tileWear,
    maxq: { q: 0, t: 0, passed: false },
    towerClear: false, track: false, warp: 1, done: false,
    catchGo: null, boosterTarget: 0, boosterTargetAlt: MODEL.catchHeight_m,
    booster, ship, traj: { stack: [], booster: [] }, eventsAll: [],
    minProp: { booster: Infinity, ship: Infinity }, violations: [],
    entryBurnT: 0, events: [],
  };
  let trajClock = 0;

  const emit = (type, extra = {}) => {
    const e = { type, t: s.t, ...extra };
    s.events.push(e); s.eventsAll.push(e);
  };

  // ---------- helpers ----------
  function frame(b) {
    const r = Math.hypot(b.pos.x, b.pos.y);
    const up = { x: b.pos.x / r, y: b.pos.y / r };
    const east = { x: up.y, y: -up.x };
    return { r, up, east };
  }
  function updateDerived(b) {
    const { r, up, east } = frame(b);
    b.alt = r - R;
    b.downrange = R * Math.atan2(b.pos.x, b.pos.y);
    b.vz = b.vel.x * up.x + b.vel.y * up.y;
    b.vh = b.vel.x * east.x + b.vel.y * east.y;
    b.speed = Math.hypot(b.vel.x, b.vel.y);
    b.q = 0.5 * atmosphere(b.alt).rho * b.speed * b.speed;
  }
  function setEngines(b, idx, cmd, startAt = s.t) {
    for (const i of idx) {
      const e = b.engines[i];
      if (cmd > 0 && (s.cut || s.terminated)) continue;
      if (cmd > 0 && e.cmd === 0) e.startAt = startAt;
      e.cmd = cmd;
    }
  }
  const range = (a, n) => Array.from({ length: n }, (_, i) => a + i);
  const allIdx = (b) => range(0, b.engines.length);
  function enginesStep(b, dt) {
    for (const e of b.engines) {
      if (e.cmd <= 0 || s.t < e.startAt) { e.act = Math.max(0, e.act - MODEL.shutRate * dt); continue; }
      const target = Math.max(MODEL.throttleMin, e.cmd);
      if (e.act < MODEL.throttleMin) e.act = Math.min(target, e.act + MODEL.startRate * dt);
      else if (e.act < target) e.act = Math.min(target, e.act + MODEL.throttleRate * dt);
      else e.act = Math.max(target, e.act - MODEL.throttleRate * 2 * dt);
    }
  }
  function thrustOf(b) {
    const { p } = atmosphere(b.alt);
    let F = 0, md = 0;
    for (const e of b.engines) {
      if (e.act <= 0) continue;
      const sp = engineSpec(e.type, p);
      F += sp.F * e.act; md += sp.mdot * e.act;
    }
    return { F, md };
  }
  function anyBurning(b) { return b.engines.some((e) => e.act > 0.01); }
  function consume(b, md, dt) {
    let dm = md * dt;
    const p = prop(b);
    if (dm >= p) {
      dm = p;
      if (b.engines.some((e) => e.cmd > 0 || e.act > 0)) {
        for (const e of b.engines) { e.cmd = 0; e.act = 0; }
        if (!b.depleted) { b.depleted = true; emit('depletion', { body: b.name }); }
      }
    }
    const mr = MODEL.mixtureRatio;
    b.lox = Math.max(0, b.lox - dm * mr / (1 + mr));
    b.ch4 = Math.max(0, b.ch4 - dm / (1 + mr));
  }
  function gravity(b) {
    const r = Math.hypot(b.pos.x, b.pos.y);
    const k = -mu / (r * r * r);
    return { x: b.pos.x * k, y: b.pos.y * k };
  }
  function dirFromVertical(b, ang) {
    const { up, east } = frame(b);
    return { x: up.x * Math.cos(ang) + east.x * Math.sin(ang), y: up.y * Math.cos(ang) + east.y * Math.sin(ang) };
  }
  function integrate(b, dt, thrustDir, CdA, extraLatAcc = 0, massOverride) {
    const m = massOverride ?? mass(b);
    const { F, md } = thrustOf(b);
    const g = gravity(b);
    const { rho } = atmosphere(b.alt);
    const v = b.speed;
    let ax = g.x, ay = g.y;
    if (F > 0) { ax += thrustDir.x * F / m; ay += thrustDir.y * F / m; }
    if (rho > 0 && v > 0.01) {
      const D = 0.5 * rho * v * v * CdA / m;
      ax -= D * b.vel.x / v; ay -= D * b.vel.y / v;
    }
    if (extraLatAcc) { const { east } = frame(b); ax += east.x * extraLatAcc; ay += east.y * extraLatAcc; }
    b.vel.x += ax * dt; b.vel.y += ay * dt;
    b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt;
    b.thrust = F; b.mdot = md;
    b.accel = Math.hypot(ax - g.x, ay - g.y);
    return md;
  }
  function orbitPerigeeAlt(b) {
    const r = Math.hypot(b.pos.x, b.pos.y), v = b.speed;
    const eps = v * v / 2 - mu / r;
    const h = b.pos.x * b.vel.y - b.pos.y * b.vel.x;
    const a = -mu / (2 * eps);
    const e = Math.sqrt(Math.max(0, 1 + 2 * eps * h * h / (mu * mu)));
    return a * (1 - e) - R;
  }
  function predictImpact(b, targetAlt) {
    // ballistic propagation with descent drag, no thrust, no grid fins
    const p = { x: b.pos.x, y: b.pos.y }, v = { x: b.vel.x, y: b.vel.y };
    const m = mass(b);
    let t = 0, dt = 0.5, speed = 0, eb = b.entryDone ? MODEL.entryBurnMax : 0;
    const ebAcc = 3 * engineSpec('sl', 0).F / m;
    for (let i = 0; i < 4000; i++) {
      const r = Math.hypot(p.x, p.y);
      const alt = r - R;
      if (alt <= targetAlt && t > 1) { speed = Math.hypot(v.x, v.y); break; }
      const k = -mu / (r * r * r);
      let ax = p.x * k, ay = p.y * k;
      const { rho } = atmosphere(alt);
      const sp = Math.hypot(v.x, v.y);
      if (rho > 0 && sp > 0) { const D = 0.5 * rho * sp * sp * MODEL.boosterDescentCdA / m; ax -= D * v.x / sp; ay -= D * v.y / sp; }
      const vzp = (v.x * p.x + v.y * p.y) / r;
      if (eb < MODEL.entryBurnMax && alt < MODEL.entryBurnAlt && (eb > 0 || vzp < -MODEL.entryBurnSpeed) && sp > MODEL.entryBurnStop) { ax -= ebAcc * v.x / sp; ay -= ebAcc * v.y / sp; eb += dt; }
      else if (eb > 0) eb = MODEL.entryBurnMax;
      dt = alt < 5000 ? 0.1 : (alt < MODEL.entryBurnAlt + 5000 ? 0.1 : 0.5);
      v.x += ax * dt; v.y += ay * dt; p.x += v.x * dt; p.y += v.y * dt; t += dt;
    }
    return { downrange: R * Math.atan2(p.x, p.y), speed, t };
  }
  function landingPropNeed(b, speed) {
    const dv = speed * 1.3 + 80;
    const isp = MODEL.raptorIspSL;
    return mass(b) * (1 - Math.exp(-dv / (isp * g0))) + 8000;
  }

  // ---------- commands ----------
  function command(cmd, arg) {
    switch (cmd) {
      case 'arm':
        if (s.phase === 'safe' || s.phase === 'held') { s.armed = true; s.phase = 'armed'; emit('armed'); }
        return true;
      case 'safe':
        if (s.phase === 'armed') { s.armed = false; s.phase = 'safe'; emit('safed'); }
        return true;
      case 'ignite':
        if (!s.armed || s.phase !== 'armed') return false;
        s.phase = 'count'; s.counting = true; s.t = MODEL.countStart; emit('count');
        return true;
      case 'stage': return stageCommand();
      case 'recovery': if (s.catchGo === null) s.recovery = arg === 'splash' ? 'splash' : 'catch'; return true;
      case 'seq': if (s.stageT === null) s.seq = arg === 'manual' ? 'manual' : 'auto'; return true;
      case 'tileWear': if (s.ship.mode !== 'reentry') s.tileWear = Math.max(0, Math.min(1, arg)); return true;
      case 'cut': return cutCommand();
      case 'terminate': return terminateCommand();
    }
    return false;
  }
  function stageCommand() {
    if (!s.liftoffT || s.stageT !== null || s.stageCmdT !== null || s.done) return false;
    if (s.cut || s.terminated) return false;
    emit('stage_cmd');
    s.stageCmdT = s.t;
    if (s.mecoT === null) {
      const b = s.booster;
      const md = Math.max(1, b.mdot);
      const toMeco = (prop(b) - opt.boosterReserveFrac * b.propInit) / md;
      if (toMeco > MODEL.stageEarly) {
        // early: ship lights against a booster still at full thrust
        emit('hot_staging', { offNominal: 'early' });
        emit('failure', { reason: 'early_staging', body: 'stack' });
        loseStack('Interstage overpressure. The ship lit against a booster still at full thrust.');
        return true;
      }
      s.stageQueued = true; // executes at MECO
      return true;
    }
    if (s.t - s.mecoT <= MODEL.stageLate) { beginHotStage(); return true; }
    return false;
  }
  function cutCommand() {
    if (s.cut) return false;
    s.cut = true; emit('cut');
    for (const b of [s.booster, s.ship]) for (const e of b.engines) e.cmd = 0;
    if (!s.liftoffT && (s.phase === 'count' || s.phase === 'ignition')) {
      s.phase = 'held'; s.armed = false; s.counting = false; emit('abort', { reason: 'cut_on_pad' });
    }
    return true;
  }
  function terminateCommand() {
    if (s.terminated) return false;
    if (!s.liftoffT) {
      if (s.phase === 'count' || s.phase === 'ignition') {
        for (const e of s.booster.engines) e.cmd = 0;
        s.phase = 'held'; s.armed = false; s.counting = false; emit('abort', { reason: 'terminate_on_pad' });
      } else { s.phase = 'safe'; s.armed = false; }
      return true;
    }
    s.terminated = true; emit('terminate');
    emit('failure', { reason: 'flight_termination', body: 'all' });
    for (const b of [s.booster, s.ship]) {
      if (b.status === 'flying' || b.status === 'attached') { b.status = 'lost'; b.mode = 'lost'; for (const e of b.engines) { e.cmd = 0; e.act = 0; } zero(b); emit('vehicle_lost', { body: b.name, reason: 'flight termination' }); }
    }
    finish();
    return true;
  }
  function zero(b) { b.thrust = 0; b.mdot = 0; b.q = 0; b.speed = 0; b.vz = 0; b.vh = 0; b.vel.x = 0; b.vel.y = 0; }
  function loseStack(reason) {
    for (const b of [s.booster, s.ship]) { b.status = 'lost'; b.mode = 'lost'; for (const e of b.engines) { e.cmd = 0; e.act = 0; } zero(b); }
    emit('vehicle_lost', { body: 'stack', reason });
    finish();
  }
  function finish() { if (!s.done) { s.done = true; s.phase = 'done'; s.warp = 1; emit('mission_end'); } }

  function beginHotStage() {
    s.stageT = s.t; s.stageQueued = false; s.phase = 'staging';
    emit('hot_staging');
    setEngines(s.ship, [0, 1, 2], 1.0, s.t);
    setEngines(s.ship, [3, 4, 5], 1.0, s.t + 0.15);
  }

  // ---------- phase logic ----------
  function stepPad(dt) {
    if (s.phase === 'count') {
      if (s.t >= MODEL.ignitionT) {
        s.phase = 'ignition'; emit('ignition');
        // staggered start: centre 13 first, then the outer ring
        const b = s.booster;
        for (let i = 0; i < 33; i++) {
          const delay = i < 13 ? i * 0.03 : 0.4 + (i - 13) * 0.03;
          b.engines[i].cmd = 1.0; b.engines[i].startAt = s.t + delay;
        }
      }
    }
    enginesStep(s.booster, dt);
    const { F, md } = thrustOf(s.booster);
    s.booster.thrust = F; s.booster.mdot = md;
    if (md > 0) { consume(s.booster, md, dt); }
    const W = (mass(s.booster) + mass(s.ship)) * g0;
    if (s.phase === 'ignition' && s.t >= 0) {
      if (F >= MODEL.clampMargin * W) {
        s.liftoffT = s.t; s.phase = 'ascent'; s.booster.status = 'attached'; s.ship.status = 'attached';
        s.booster.mode = 'ascent'; s.ship.mode = 'ascent';
        emit('liftoff', { twr: F / W });
      } else {
        for (const e of s.booster.engines) e.cmd = 0;
        s.phase = 'held'; s.armed = false; emit('abort', { reason: 'thrust_low', twr: F / W });
      }
    }
  }

  function stepStack(dt) {
    const b = s.booster, sh = s.ship;
    enginesStep(b, dt); enginesStep(sh, dt);
    const tl = s.t - s.liftoffT;
    let ang = 0;
    if (tl > MODEL.pitchStart) ang = MODEL.pitchMax * Math.pow(Math.min(1, (tl - MODEL.pitchStart) / MODEL.pitchSpan), MODEL.pitchExp);
    if (s.cut) ang = Math.atan2(b.vh, Math.max(1e-3, b.vz));
    const dir = dirFromVertical(b, ang);
    // combined thrust: integrate booster with combined thrust and mass
    const tb = thrustOf(b), ts = thrustOf(sh);
    const m = mass(b) + mass(sh);
    const g = gravity(b);
    const { rho } = atmosphere(b.alt);
    let ax = g.x + dir.x * (tb.F + ts.F) / m, ay = g.y + dir.y * (tb.F + ts.F) / m;
    if (rho > 0 && b.speed > 0.01) { const D = 0.5 * rho * b.speed * b.speed * MODEL.stackCdA / m; ax -= D * b.vel.x / b.speed; ay -= D * b.vel.y / b.speed; }
    b.vel.x += ax * dt; b.vel.y += ay * dt; b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt;
    b.thrust = tb.F; sh.thrust = ts.F; b.mdot = tb.md; sh.mdot = ts.md;
    b.accel = sh.accel = Math.hypot(ax - g.x, ay - g.y);
    consume(b, tb.md, dt); if (ts.md > 0) consume(sh, ts.md, dt);
    b.attitude = ang; sh.attitude = ang;
    b.gimbal = Math.sin(s.t * 1.7) * 0.02 + (tl > MODEL.pitchStart && tl < MODEL.pitchStart + 6 ? 0.04 : 0);
    // ship rides on the booster
    updateDerived(b);
    const { up, east } = frame(b);
    const ax2 = { x: up.x * Math.cos(ang) + east.x * Math.sin(ang), y: up.y * Math.cos(ang) + east.y * Math.sin(ang) };
    sh.pos.x = b.pos.x + ax2.x * b.height; sh.pos.y = b.pos.y + ax2.y * b.height;
    sh.vel.x = b.vel.x; sh.vel.y = b.vel.y;
    updateDerived(sh);

    if (!s.towerClear && b.alt > MODEL.towerHeight_m) { s.towerClear = true; s.track = true; emit('tower_clear'); }
    // max Q
    if (!s.maxq.passed) {
      if (b.q > s.maxq.q) { s.maxq.q = b.q; s.maxq.t = s.t; }
      else if (s.maxq.q > 5000 && b.q < 0.97 * s.maxq.q) { s.maxq.passed = true; emit('maxq', { q: s.maxq.q, at: s.maxq.t }); }
    }
    // MECO
    if (s.mecoT === null && !s.cut && prop(b) <= opt.boosterReserveFrac * b.propInit) {
      s.mecoT = s.t; emit('meco');
      setEngines(b, range(3, 30), 0);
      setEngines(b, [0, 1, 2], 0.5);
      if (s.stageQueued) s.pendingStageAt = s.t + 0.5;
      else if (s.seq === 'auto') s.pendingStageAt = s.t + MODEL.autoStageDelay;
    }
    if (s.pendingStageAt && s.t >= s.pendingStageAt && s.stageT === null) { s.pendingStageAt = null; beginHotStage(); }
    if (s.mecoT !== null && s.stageT === null && s.t - s.mecoT > MODEL.stageLate && !s.done) {
      emit('failure', { reason: 'late_staging', body: 'stack' });
      loseStack('Staging window closed. The ship cannot light on unsettled propellant and flight rules call the stack lost.');
      return;
    }
    // hot staging sequence
    if (s.stageT !== null) {
      if (s.shipIgnT === null && sh.engines[0].act > 0.3) { s.shipIgnT = s.t; emit('ship_ignition'); }
      if (s.shipIgnT !== null && s.t - s.shipIgnT >= MODEL.interstageVent) separate();
    }
    // ground impact during ascent (cut or failure)
    if (b.alt <= 0 && s.liftoffT !== null && s.t - s.liftoffT > 2) {
      emit('failure', { reason: 'impact', body: 'stack' });
      loseStack('The stack came down on a ballistic arc.');
    }
  }

  function separate() {
    s.attached = false; s.sepT = s.t; s.phase = 'split';
    s.booster.status = 'flying'; s.ship.status = 'flying';
    s.booster.mode = 'flip'; s.ship.mode = 'burn';
    s.flipFrom = s.booster.attitude;
    emit('separation');
    setEngines(s.booster, [0, 1, 2], 0, s.t + 0.5);
    s.booster.engines.slice(0, 3).forEach((e) => { e.cmd = 0; });
    s.boosterTarget = s.recovery === 'catch' ? 0 : MODEL.splashTarget_m;
    s.boosterTargetAlt = s.recovery === 'catch' ? MODEL.catchHeight_m : 0;
  }

  function stepBooster(dt) {
    const b = s.booster;
    if (b.status !== 'flying') return;
    enginesStep(b, dt);
    let dir = { x: 0, y: 0 }, CdA = MODEL.boosterDescentCdA, lat = 0;
    const toward = b.downrange > s.boosterTarget ? -1 : 1;
    switch (b.mode) {
      case 'flip': {
        const k = Math.min(1, (s.t - s.sepT) / MODEL.flipTime);
        const tgt = toward * 1.5;
        b.attitude = s.flipFrom + (tgt - s.flipFrom) * (0.5 - 0.5 * Math.cos(Math.PI * k));
        if (k >= 1) {
          if (s.cut) { b.mode = 'descent'; break; }
          b.mode = 'boostback'; emit('boostback_start');
          setEngines(b, range(0, MODEL.boostbackEngines), 1.0);
        }
        break;
      }
      case 'boostback': {
        b.attitude = toward * 1.5;
        dir = dirFromVertical(b, b.attitude);
        const pr = predictImpact(b, s.boosterTargetAlt);
        const reached = toward < 0 ? pr.downrange <= s.boosterTarget : pr.downrange >= s.boosterTarget;
        const floor = prop(b) <= MODEL.landingFloor_t * 1000;
        if (reached || floor || s.cut) {
          setEngines(b, allIdx(b), 0);
          b.mode = 'descent';
          emit('boostback_end', { short: floor && !reached });
          if (floor && !reached) { s.boostbackShort = true; emit('budget_low', { body: 'booster' }); }
          if (opt.dispersion) { const { east } = frame(b); b.vel.x += east.x * opt.dispersion; b.vel.y += east.y * opt.dispersion; }
        }
        break;
      }
      case 'descent': {
        // engines-first descent; attitude opposes velocity
        b.attitude = Math.atan2(-b.vh, -b.vz); // nose away from the direction of travel
        // grid fins
        const qa = Math.min(MODEL.gridFinMax, b.q / 3000);
        if (qa > 0.05) {
          if (!b.predT || s.t - b.predT > 0.5) { b.pred = predictImpact(b, s.boosterTargetAlt); b.predT = s.t; }
          const tgo = Math.max(4, b.pred.t - (s.t - b.predT));
          const err = s.boosterTarget - b.pred.downrange;
          lat = Math.max(-qa, Math.min(qa, 2.2 * err / (tgo * tgo) - 0.15 * (b.vh - (b.pred.vhEnd ?? b.vh)) * 0));
          b.gridFin = lat / MODEL.gridFinMax;
        } else b.gridFin *= 0.95;
        // modelled entry burn
        if (!s.cut && !b.entryDone && b.alt < MODEL.entryBurnAlt && b.vz < -MODEL.entryBurnSpeed) {
          b.mode = 'entry'; s.entryBurnT = s.t; emit('entry_burn'); setEngines(b, [0, 1, 2], 1.0);
        }
        // go / no-go
        if (s.catchGo === null && b.alt < MODEL.goNoGoAlt + s.boosterTargetAlt) decideCatch();
        // landing burn ignition
        const h = b.alt - s.boosterTargetAlt;
        const areq = (b.vz * b.vz) / (2 * Math.max(1, h));
        if (!s.cut && b.vz < 0 && areq >= MODEL.landingIgniteAccel && h < 8000) {
          if (s.catchGo === null) decideCatch();
          b.mode = 'landing'; emit('landing_burn', { target: s.catchGo ? 'tower' : 'water' });
        }
        if (b.alt <= s.boosterTargetAlt && b.mode === 'descent') touchdown();
        break;
      }
      case 'entry': {
        b.attitude = Math.atan2(-b.vh, -b.vz);
        dir = { x: -b.vel.x / b.speed, y: -b.vel.y / b.speed };
        if (b.speed < MODEL.entryBurnStop || s.t - s.entryBurnT > MODEL.entryBurnMax || prop(b) < MODEL.landingFloor_t * 600) {
          setEngines(b, allIdx(b), 0); b.entryDone = true; b.mode = 'descent'; emit('entry_burn_end');
        }
        break;
      }
      case 'landing': {
        b.attitude = Math.atan2(-b.vh, -b.vz);
        const h = b.alt - s.boosterTargetAlt;
        const areq = Math.max(0, b.vz * b.vz - 1) / (2 * Math.max(0.5, h));
        const m = mass(b);
        const a1 = engineSpec('sl', atmosphere(b.alt).p).F / m;
        let need = areq + g0;
        if (h < 40) { const vzDes = -(0.8 + 0.35 * Math.max(0, h)); need = g0 + (vzDes - b.vz) * 2.0; }
        need = Math.max(0, need);
        let n = 13;
        if (need <= 3 * a1) n = 3;
        if (need < 3 * a1 * MODEL.throttleMin) n = 1;
        const thr = Math.max(MODEL.throttleMin, Math.min(1, need / (n * a1)));
        for (let i = 0; i < 33; i++) {
          const e = b.engines[i];
          if (i < n && !s.cut && !b.depleted) { if (e.cmd === 0) e.startAt = s.t; e.cmd = thr; if (e.act < MODEL.throttleMin) e.act = MODEL.throttleMin; e.act = thr; }
          else { e.cmd = 0; }
        }
        // gimbal-steered lateral correction (zero-effort-miss style, modelled gains)
        const tgo = Math.max(1.0, 2 * Math.max(0.5, h) / Math.max(1, -b.vz));
        const errH = s.boosterTarget - b.downrange;
        lat = 6 * errH / (tgo * tgo) - 4 * b.vh / tgo;
        lat = Math.max(-0.25 * need, Math.min(0.25 * need, lat));
        b.gimbal = Math.atan2(lat, need) * 0.8;
        const up = frame(b).up, east = frame(b).east;
        const nrm = Math.hypot(need, lat);
        dir = { x: (up.x * need + east.x * lat) / nrm, y: (up.y * need + east.y * lat) / nrm };
        lat = 0;
        if (h <= 0.5 || (b.vz > -0.4 && h < 4) || b.vz > 1) touchdown();
        break;
      }
    }
    const md = integrate(b, dt, dir, CdA, lat);
    consume(b, md, dt);
    updateDerived(b);
    if (b.status === 'flying' && b.alt <= 0) touchdown();
  }

  function decideCatch() {
    const b = s.booster;
    if (s.recovery !== 'catch') { s.catchGo = false; return; }
    const need = landingPropNeed(b, b.speed);
    const pr = predictImpact(b, s.boosterTargetAlt);
    const posOk = Math.abs(pr.downrange - 0) <= MODEL.goNoGoRange;
    const velOk = Math.abs(b.vh) <= MODEL.goNoGoVh;
    const propOk = prop(b) >= need && !s.boostbackShort;
    s.catchGo = posOk && velOk && propOk && !s.cut;
    emit(s.catchGo ? 'catch_go' : 'catch_nogo', { posOk, velOk, propOk, prop_t: prop(b) / 1000, need_t: need / 1000 });
    if (!s.catchGo) { s.boosterTarget = b.downrange >= 0 ? b.downrange + MODEL.divertTarget_m : MODEL.divertTarget_m; s.boosterTargetAlt = 0; }
  }

  function touchdown() {
    const b = s.booster;
    if (b.status !== 'flying') return;
    for (const e of b.engines) { e.cmd = 0; e.act = 0; }
    b.thrust = 0; b.mdot = 0;
    const atTower = s.catchGo && s.boosterTargetAlt > 0;
    const posErr = Math.abs(b.downrange - 0);
    const ok = atTower && posErr <= MODEL.catchPos_m && Math.abs(b.vz) <= MODEL.catchVz && Math.abs(b.vh) <= MODEL.catchVh;
    b.vel.x = 0; b.vel.y = 0;
    if (ok) {
      b.status = 'caught'; b.mode = 'caught';
      emit('catch', { posErr, vz: b.vz });
    } else {
      const speed = Math.hypot(b.vz, b.vh);
      if (atTower) emit('failure', { reason: 'catch_envelope', body: 'booster', posErr, vz: b.vz, vh: b.vh });
      // place on the water surface
      const ang = Math.max(b.downrange, MODEL.divertTarget_m) / R;
      b.pos.x = Math.sin(ang) * R; b.pos.y = Math.cos(ang) * R;
      updateDerived(b);
      const hard = speed > MODEL.hardImpact || s.cut;
      b.status = hard ? 'lost' : 'splashed'; b.mode = b.status;
      emit('splashdown', { body: 'booster', hard, speed });
      if (hard) emit('vehicle_lost', { body: 'booster', reason: 'water impact' });
    }
    b.vz = 0; b.vh = 0; b.speed = 0;
    checkDone();
  }

  function stepShip(dt) {
    const sh = s.ship;
    if (sh.status !== 'flying') return;
    enginesStep(sh, dt);
    let dir = { x: 0, y: 0 }, CdA = MODEL.shipNoseCdA;
    const { r } = frame(sh);
    switch (sh.mode) {
      case 'burn': {
        const { F } = thrustOf(sh);
        const A = Math.max(0.1, F / mass(sh));
        const geff = mu / (r * r) - (sh.vh * sh.vh) / r;
        const vzDes = Math.max(-120, Math.min(350, (MODEL.shipTargetAlt - sh.alt) / 30));
        const azCmd = (vzDes - sh.vz) / 8 + geff;
        const f = Math.max(-0.25, Math.min(0.95, azCmd / A));
        const ang = Math.acos(f);
        sh.attitude = ang; dir = dirFromVertical(sh, ang);
        sh.gimbal = Math.sin(s.t * 2.1) * 0.015;
        const pe = orbitPerigeeAlt(sh);
        if (pe >= MODEL.shipPerigeeTarget || prop(sh) <= MODEL.shipLandingReserve_t * 1000 || s.cut) {
          setEngines(sh, allIdx(sh), 0); sh.mode = 'coast';
          emit('seco', { perigee: pe, short: prop(sh) <= MODEL.shipLandingReserve_t * 1000 });
        }
        break;
      }
      case 'coast': {
        sh.attitude = Math.atan2(sh.vh, sh.vz);
        if (sh.alt < 120e3 && sh.vz < 0) { sh.mode = 'reentry'; emit('ship_reentry'); }
        break;
      }
      case 'reentry': {
        CdA = MODEL.shipBellyCdA;
        sh.attitude = Math.atan2(sh.vh, sh.vz) - 1.05; // belly into the flow
        sh.flapFwd = 0.35 + 0.12 * Math.sin(s.t * 0.9); sh.flapAft = 0.25 + 0.1 * Math.sin(s.t * 0.7 + 1);
        const { rho } = atmosphere(sh.alt);
        const flux = MODEL.suttonK * Math.sqrt(rho / MODEL.noseRadius) * Math.pow(sh.speed, 3);
        const h = sh.heat; h.flux = flux;
        if (flux > h.peak) h.peak = flux;
        else if (!h.peakPassed && h.peak > 50e3 && flux < 0.9 * h.peak) { h.peakPassed = true; emit('peak_heating', { flux: h.peak }); }
        if (flux > MODEL.recessionThreshold) h.recession += MODEL.recessionK * (flux - MODEL.recessionThreshold) * dt;
        const wear = s.tileWear;
        const fluxLim = MODEL.fluxLimit * (1 - 0.35 * wear), thick = MODEL.tileThickness * (1 - 0.6 * wear);
        h.margin = 1 - Math.max(h.peak / fluxLim, h.recession / thick);
        if (h.margin < 0) {
          emit('failure', { reason: 'thermal', body: 'ship' });
          sh.status = 'lost'; sh.mode = 'lost'; zero(sh);
          emit('vehicle_lost', { body: 'ship', reason: 'modelled thermal margin exceeded' });
          checkDone(); return;
        }
        if (sh.alt < 1500) {
          if (!s.cut && prop(sh) > 5000) { sh.mode = 'landing'; emit('ship_landing_burn'); setEngines(sh, [0, 1, 2], 0.8); }
          else sh.mode = 'fall';
        }
        break;
      }
      case 'landing': {
        sh.flapFwd *= 0.95; sh.flapAft *= 0.95;
        const areq = (sh.vz * sh.vz) / (2 * Math.max(1, sh.alt));
        const a1 = engineSpec('sl', atmosphere(sh.alt).p).F / mass(sh);
        const thr = Math.max(MODEL.throttleMin, Math.min(1, (areq + g0) / (3 * a1)));
        for (let i = 0; i < 3; i++) { sh.engines[i].cmd = thr; sh.engines[i].act = Math.max(sh.engines[i].act, Math.min(thr, sh.engines[i].act + 2 * dt)); }
        sh.attitude *= 0.9;
        dir = { x: frame(sh).up.x, y: frame(sh).up.y };
        if (sh.vz > -0.5 && sh.alt < 20) { /* hover guard */ for (let i = 0; i < 3; i++) sh.engines[i].cmd = 0; }
        break;
      }
      case 'fall': CdA = MODEL.shipBellyCdA; break;
    }
    const md = integrate(sh, dt, dir, CdA);
    consume(sh, md, dt);
    updateDerived(sh);
    if (sh.alt <= 0) {
      const speed = Math.hypot(sh.vz, sh.vh);
      for (const e of sh.engines) { e.cmd = 0; e.act = 0; }
      sh.vel.x = sh.vel.y = 0; sh.speed = 0; sh.thrust = 0; sh.mdot = 0;
      if (speed > MODEL.hardImpact) {
        emit('failure', { reason: 'impact', body: 'ship' });
        sh.status = 'lost'; sh.mode = 'lost';
        emit('vehicle_lost', { body: 'ship', reason: 'water impact at ' + speed.toFixed(0) + ' m/s' });
      } else {
        sh.status = 'splashed'; sh.mode = 'splashed';
        emit('ship_splashdown', { speed });
      }
      checkDone();
    }
  }

  function checkDone() {
    const fin = (b) => ['caught', 'splashed', 'lost'].includes(b.status);
    if (fin(s.booster) && fin(s.ship)) finish();
  }

  function recordTraj(dt) {
    trajClock += dt;
    const step = s.ship.mode === 'coast' ? 20 : 0.5;
    if (trajClock < step) return;
    trajClock = 0;
    const top = s.attached ? s.booster : s.ship;
    if (top.status === 'attached' || top.status === 'flying') s.traj.stack.push([s.t, top.downrange / 1000, top.alt / 1000]);
    if (!s.attached && s.booster.status === 'flying') s.traj.booster.push([s.t, s.booster.downrange / 1000, s.booster.alt / 1000]);
  }

  function substep(dt) {
    s.t += dt;
    if (s.done) return;
    if (!s.liftoffT) {
      if (s.phase === 'count' || s.phase === 'ignition') stepPad(dt);
      else if (s.phase === 'held') { enginesStep(s.booster, dt); s.booster.thrust = thrustOf(s.booster).F; }
    } else if (s.attached) stepStack(dt);
    else { stepBooster(dt); stepShip(dt); }
    // invariants
    for (const b of [s.booster, s.ship]) {
      const p = prop(b);
      s.minProp[b.name] = Math.min(s.minProp[b.name], p);
      if (p < 0) s.violations.push({ t: s.t, body: b.name, what: 'negative propellant' });
      if (p <= 0 && b.engines.some((e) => e.act > 0)) s.violations.push({ t: s.t, body: b.name, what: 'burning on empty tanks' });
    }
    const bDone = ['caught', 'splashed', 'lost'].includes(s.booster.status);
    // suggested display time compression (modelled presentation, not physics)
    let w = 1;
    if (!s.attached && bDone && s.ship.status === 'flying') {
      if (s.ship.mode === 'coast' && s.ship.alt > 125e3) w = 40;
      else if (s.ship.mode === 'coast' || s.ship.mode === 'reentry') w = s.ship.alt > 30e3 ? 8 : (s.ship.alt > 4e3 ? 3 : 1);
    }
    s.warp = w;
    if (s.liftoffT) recordTraj(dt);
  }

  function step(dt) {
    if (!s.counting && s.phase !== 'held') return drain();
    let rem = dt;
    while (rem > 1e-9) {
      const coast = !s.attached && s.ship.mode === 'coast' && s.ship.alt > 125e3 && ['caught', 'splashed', 'lost'].includes(s.booster.status);
      const h = Math.min(rem, coast ? 0.25 : 0.02);
      substep(h);
      rem -= h;
    }
    return drain();
  }
  function drain() { const e = s.events; s.events = []; return e; }

  // estimates for instruments
  function estimates() {
    const b = s.booster, sh = s.ship;
    const reserveB = opt.boosterReserveFrac * b.propInit;
    const burnB = b.mdot > 1 ? Math.max(0, (prop(b) - (s.mecoT === null ? reserveB : 0)) / b.mdot) : null;
    const burnS = sh.mdot > 1 ? Math.max(0, (prop(sh) - MODEL.shipLandingReserve_t * 1000) / sh.mdot) : null;
    const W = (s.attached ? mass(b) + mass(sh) : mass(b)) * g0;
    const twr = s.attached ? (b.thrust + sh.thrust) / W : b.thrust / (mass(b) * g0);
    return { reserveB, reserveS: MODEL.shipLandingReserve_t * 1000, burnB, burnS, twr, twrShip: sh.thrust / (mass(sh) * g0) };
  }

  updateDerived(booster);
  ship.pos.y = R + MODEL.mountHeight_m + booster.height; updateDerived(ship);
  return { state: s, step, command, drain, estimates, options: opt };
}

// convenience: run a whole flight headless
export function runFlight(options = {}, hooks = {}) {
  const sim = createSim(options);
  sim.command('arm'); sim.command('ignite');
  const events = [];
  const dt = 1 / 60;
  let guard = 0;
  while (!sim.state.done && guard++ < 400000) {
    if (hooks.before) hooks.before(sim);
    const ev = sim.step(dt * sim.state.warp);
    events.push(...ev);
    if (hooks.after) hooks.after(sim, ev);
  }
  return { sim, events };
}
