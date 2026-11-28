// FL3 simulation: a pure, testable module. No DOM, no three.js.
// Published figures are in PUBLISHED. Everything in MODELLED is an assumption.

export const PUBLISHED = Object.freeze({
  cylinders: 3, bore: 0.092, stroke: 0.110, displacementCc: 2193,
  ratedKW: 29.1, ratedHP: 39, ratedRpm: 2200,
});

export const MODELLED = Object.freeze({
  rod: 0.200,            // m
  cr: 17,                // compression ratio
  pitch: 0.150,          // cylinder spacing, m
  idleSet: 740,          // governor setting at hand throttle closed, rpm
  highIdleSet: 2405,     // governor setting at hand throttle open, rpm
  droop: 120,            // rpm from no load to full rack
  rackLag: 0.07,         // s
  inertia: 0.8,          // kg m^2, flywheel and crank
  pIn: 0.95, pExh: 1.08, // bar
  nComp: 1.36, nExp: 1.40, gammaBurn: 1.33,
  peakTarget: 73,        // bar at full load
  starterStall: 300, starterFree: 290, // N m, rpm at the crank
  catchRpm: 480,
  frictionA: 23, frictionB: 0.0072, // N m, N m per rpm
  blowerC: 1.45e-6,      // N m per rpm^2
  blowerRatio: 2.1, blowerBlades: 12, airAtRated: 31, // m^3/min at 2200
  thermalSpeedup: 30,
  headToMetal: 0.25, headCap: 11500, headH: 51, ambient: 22,
  lhv: 42.8e6, heatToGas: 0.8, nExpUnfired: 1.40, fuelDensity: 0.835,
  evo: 140, evc: 370, ivo: 350, ivc: 570, // degrees after firing TDC
  valveLift: 0.010,
});

const DEG = Math.PI / 180;
const B = PUBLISHED.bore, S = PUBLISHED.stroke, R = S / 2, L = MODELLED.rod;
export const AREA = Math.PI / 4 * B * B;
export const VD = AREA * S;
export const VC = VD / (MODELLED.cr - 1);
export const RATED_OMEGA = PUBLISHED.ratedRpm * 2 * Math.PI / 60;
export const RATED_TORQUE = PUBLISHED.ratedKW * 1000 / RATED_OMEGA;

// ---------- kinematics ----------
// theta: crank angle from TDC (rad). Returns piston drop s (m), rod angle beta (rad), ds/dtheta (m/rad)
export function slider(theta) {
  const sn = Math.sin(theta), cs = Math.cos(theta);
  const k = Math.sqrt(L * L - R * R * sn * sn);
  const s = R + L - (R * cs + k);
  return { s, beta: Math.asin(R * sn / L), dsdth: R * sn * (1 + R * cs / k), pinY: R * cs + k };
}
export function volumeAt(phiDeg) { return VC + AREA * slider(phiDeg * DEG).s; }

const mod720 = a => ((a % 720) + 720) % 720;
// valve lift (m), phi in degrees after firing TDC
function windowLift(phi, open, close) {
  const dur = close - open; const u = mod720(phi - open);
  if (u >= dur) return 0;
  const s = Math.sin(Math.PI * u / dur); return MODELLED.valveLift * s * s;
}
export const exhaustLift = phi => windowLift(phi, MODELLED.evo, MODELLED.evc);
export const intakeLift = phi => windowLift(phi, MODELLED.ivo, MODELLED.ivc);
export function strokeName(phi) {
  phi = mod720(phi);
  return phi < 180 ? 'power' : phi < 360 ? 'exhaust' : phi < 540 ? 'intake' : 'compression';
}

// ---------- in-cylinder pressure tables ----------
const RES = 0.5, NPTS = 1440;
const FUEL_LEVELS = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.55, 0.7, 0.85, 1.0, 1.15];
const VOL = new Float64Array(NPTS + 1);
for (let i = 0; i <= NPTS; i++) VOL[i] = volumeAt(i * RES);

function wiebe(u, m) { return u <= 0 ? 0 : 1 - Math.exp(-6.9 * Math.pow(Math.min(u, 3), m + 1)); }
function burnFraction(dphi, f) { // dphi degrees after start of combustion; f relative fuel
  const beta = 0.16 + 0.42 * Math.pow(Math.max(0, 1 - f), 2); // premixed share, larger at light load
  return beta * wiebe(dphi / 9, 2) + (1 - beta) * wiebe(dphi / 58, 0.9);
}

// Builds p(phi) in bar for one cycle. q = heat released per cylinder per cycle (J), soc deg rel. TDC.
function buildTable(q, f, soc) {
  const p = new Float64Array(NPTS + 1);
  const { pIn, pExh, nComp, nExp, gammaBurn, evo } = MODELLED;
  // intake stroke and the early exhaust are open: fill later
  // closed part: 540 -> 720 -> 720+evo
  let pk = pIn; p[540 / RES] = pIn;
  let xPrev = 0;
  const end = (720 + evo) / RES;
  for (let k = 540 / RES; k < end; k++) {
    const i0 = k % NPTS, i1 = (k + 1) % NPTS;
    const v0 = k >= NPTS ? VOL[i0] : VOL[k], v1 = (k + 1) >= NPTS ? VOL[i1] : VOL[k + 1];
    const n = v1 < v0 ? nComp : (q > 0 ? nExp : MODELLED.nExpUnfired);
    const phiRel = (k + 1) * RES - 720; // relative to firing TDC
    const x = q > 0 ? burnFraction(phiRel - soc, f) : 0;
    const dq = q * (x - xPrev); xPrev = x;
    pk = pk * Math.pow(v0 / v1, n) + (gammaBurn - 1) * dq / ((v0 + v1) / 2) / 1e5;
    p[(k + 1) % NPTS] = pk;
    if (k + 1 === NPTS) p[NPTS] = pk;
  }
  const pEvo = pk;
  for (let k = evo / RES; k <= 540 / RES; k++) {
    const phi = k * RES; let v;
    if (phi < 360) v = pExh + (pEvo - pExh) * Math.exp(-(phi - evo) / 14);
    else v = pIn + (pExh - pIn) * Math.exp(-(phi - 360) / 12);
    p[k] = v;
  }
  p[0] = p[NPTS];
  return p;
}
function cycleWork(p) { // J per cylinder per cycle
  let w = 0;
  for (let i = 0; i < NPTS; i++) w += 0.5 * (p[i] + p[i + 1]) * 1e5 * (VOL[i + 1] - VOL[i]);
  return w;
}
function peakOf(p) { let m = 0; for (let i = 0; i <= NPTS; i++) if (p[i] > m) m = p[i]; return m; }

export function frictionTorque(rpm) { const a = Math.abs(rpm); return MODELLED.frictionA + MODELLED.frictionB * a; }
export function blowerTorque(rpm) { return MODELLED.blowerC * rpm * rpm; }
// full-rack fuel delivery shape vs speed (modelled torque backup), relative to rated
export function fullRackShape(rpm) { const x = rpm / PUBLISHED.ratedRpm; return 1 + 0.10 * (1 - x) - 0.06 * Math.max(0, x - 1); }

// Calibrate: heat per cycle at full fuel (Qfull) for exactly 29.1 kW at 2200, SOC for the target peak.
const CAL = (() => {
  const rpm = PUBLISHED.ratedRpm;
  const needInd = RATED_TORQUE + frictionTorque(rpm) + blowerTorque(rpm); // N m mean indicated
  const needW = needInd * 4 * Math.PI / 3; // J per cylinder per cycle
  let soc = -4, q = 3000;
  for (let it = 0; it < 30; it++) {
    let lo = 500, hi = 12000;
    for (let j = 0; j < 50; j++) { q = (lo + hi) / 2; if (cycleWork(buildTable(q, 1, soc)) > needW) hi = q; else lo = q; }
    const pk = peakOf(buildTable(q, 1, soc));
    soc += (pk - MODELLED.peakTarget) * 0.12; // later SOC lowers the peak
    soc = Math.max(-20, Math.min(12, soc));
  }
  return { q, soc };
})();
export const Q_FULL = CAL.q, SOC = CAL.soc;
const TABLES = FUEL_LEVELS.map(f => buildTable(Q_FULL * f, f, SOC));
export const MOTORED = TABLES[0];
export const FULL_LOAD = TABLES[10];
export const PEAK_FULL = peakOf(FULL_LOAD);

export function pressureAt(phiDeg, fuel) {
  const phi = mod720(phiDeg); const x = phi / RES; const i = Math.floor(x); const t = x - i;
  const f = Math.max(0, Math.min(FUEL_LEVELS[FUEL_LEVELS.length - 1], fuel));
  let j = 0; while (j < FUEL_LEVELS.length - 2 && FUEL_LEVELS[j + 1] < f) j++;
  const u = (f - FUEL_LEVELS[j]) / (FUEL_LEVELS[j + 1] - FUEL_LEVELS[j]);
  const a = TABLES[j], b = TABLES[j + 1];
  const pa = a[i] + (a[i + 1] - a[i]) * t, pb = b[i] + (b[i + 1] - b[i]) * t;
  return pa + (pb - pa) * u;
}
export function tableFor(fuel) { // a sampled loop for drawings: [{v,p}] every 2 deg
  const out = []; for (let d = 0; d <= 720; d += 2) out.push({ v: VOL[Math.round(d / RES) % NPTS || (d ? NPTS : 0)], p: pressureAt(d, fuel) });
  return out;
}
export function heatReleaseRate(phiDeg, fuel) { // relative 0..1, for the combustion glow
  if (fuel <= 0) return 0;
  const d = mod720(phiDeg + 180) - 180 - SOC; if (d < 0 || d > 120) return 0;
  return Math.max(0, (burnFraction(d + 1, fuel) - burnFraction(d, fuel))) * 14 * Math.min(1, fuel * 1.6 + 0.2);
}
// brake power at steady speed and a fixed rack, used by the check
export function steadyBrake(rpm, rack) {
  const f = rack * fullRackShape(rpm);
  // mean indicated torque from the table at that fuel
  let w = 0; for (let i = 0; i < NPTS; i++) { const p0 = pressureAt(i * RES, f), p1 = pressureAt((i + 1) * RES, f); w += 0.5 * (p0 + p1) * 1e5 * (VOL[i + 1] - VOL[i]); }
  const tInd = 3 * w / (4 * Math.PI);
  const t = tInd - frictionTorque(rpm) - blowerTorque(rpm);
  return { torque: t, kW: t * rpm * 2 * Math.PI / 60 / 1000 };
}

// ---------- the engine ----------
const EVENT_ANGLES = () => ({ soc: mod720(720 + SOC), evo: MODELLED.evo, tdcC: 0 });

export class Engine {
  constructor() { this.reset(); }
  reset() {
    this.t = 0; this.theta = 30; this.omega = 0; // deg, rad/s
    this.state = 'off';   // off | cranking | running | stopping
    this.throttle = 0; this.load = 0; this.rack = 0; this.rackTarget = 0;
    this.fuelOn = false; this.starter = false; this.compressions = 0; this.crankTime = 0;
    this.cyl = [0, 1, 2].map(() => ({ fuel: 0, burn: 0, lastFire: -9, temp: MODELLED.ambient, glow: 0 }));
    this.events = []; this.pending = [];
    this.navg = 0; this.brakeT = 0; this.loadT = 0; this.tGas = 0; this.reaction = 0;
    this.smoke = 0; this.fuelRate = 0; this.hours = 1843.62; this.firstFire = -1;
    this.everCaught = false;
  }
  get rpm() { return this.omega * 60 / (2 * Math.PI); }
  // commands are queued with the time they were raised and applied at the start of the next step
  command(name, value) { this.pending.push({ name, value }); }
  emit(type, t, data = {}) { this.events.push({ type, t, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  governedRpm(th = this.throttle) { return MODELLED.idleSet - 22 + th * (MODELLED.highIdleSet - MODELLED.idleSet); }

  applyCommands() {
    for (const c of this.pending) {
      if (c.name === 'throttle') this.throttle = Math.max(0, Math.min(1, c.value));
      else if (c.name === 'load') this.load = Math.max(0, Math.min(1, c.value));
      else if (c.name === 'key') this.key();
      else if (c.name === 'start') { if (this.state === 'off' || (this.state === 'stopping' && this.rpm < 40)) this.key(); }
      else if (c.name === 'stop') { if (this.state === 'running' || this.state === 'cranking') this.key(); }
    }
    this.pending.length = 0;
  }
  key() {
    if (this.state === 'off' || (this.state === 'stopping' && Math.abs(this.rpm) < 40)) {
      this.state = 'cranking'; this.starter = true; this.fuelOn = true; this.compressions = 0; this.crankTime = 0;
      this.firstFire = -1; this.emit('crank', this.t);
    } else if (this.state === 'cranking') {
      this.state = this.rpm > 30 ? 'stopping' : 'off'; this.starter = false; this.fuelOn = false; this.emit('keyoff', this.t);
    } else if (this.state === 'running') {
      this.state = 'stopping'; this.fuelOn = false; this.emit('fuelcut', this.t);
    }
  }

  // advance by dt seconds of simulation time
  step(dt) {
    this.applyCommands();
    const maxDeg = 2, maxDt = 0.0015;
    let left = dt;
    while (left > 1e-9) {
      const w = Math.abs(this.omega);
      let h = Math.min(left, maxDt, w > 1e-3 ? (maxDeg * DEG) / w : maxDt);
      this.substep(h); left -= h;
    }
    // thermal model, 30x time
    const air = this.airflow();
    const tdt = dt * MODELLED.thermalSpeedup;
    const hNow = 4 + MODELLED.headH * Math.pow(Math.max(0, air / MODELLED.airAtRated), 0.8);
    for (let i = 0; i < 3; i++) {
      const c = this.cyl[i];
      const qIn = MODELLED.headToMetal * this.fuelRate / 3;
      const dT = (qIn - hNow * (c.temp - MODELLED.ambient)) / MODELLED.headCap;
      c.temp += dT * tdt * (1 + 0.04 * (i - 1)); // rear cylinder sees warmer air
    }
    // hour meter: real hours x30 at rated speed
    this.hours += dt * MODELLED.thermalSpeedup / 3600 * Math.max(0, this.rpm) / PUBLISHED.ratedRpm * (this.state === 'running' ? 1 : 0);
    this.smoke *= Math.exp(-dt * 1.4);
  }
  airflow() { return MODELLED.airAtRated * Math.max(0, this.rpm) / PUBLISHED.ratedRpm; }

  substep(h) {
    const rpm = this.rpm;
    const th0 = this.theta;
    // governor with rack lag
    const set = this.governedRpm();
    let target = this.fuelOn ? Math.max(0, Math.min(1, (set - this.navg) / MODELLED.droop)) : 0;
    if (this.state === 'cranking') target = this.fuelOn ? 1 : 0;
    this.rackTarget = target;
    this.rack += (target - this.rack) * Math.min(1, h / MODELLED.rackLag);
    if (!this.fuelOn) this.rack = Math.max(0, this.rack - h * 8);

    // gas torque
    let tg = 0;
    for (let i = 0; i < 3; i++) {
      const phi = mod720(th0 - 240 * i);
      const c = this.cyl[i];
      const p = pressureAt(phi, c.fuel * c.burn);
      const k = slider((phi % 360) * DEG);
      tg += (p - 1.0) * 1e5 * AREA * k.dsdth;
    }
    // trapped charge leaks away once the engine has come to rest
    if (this.state === 'off') tg *= Math.min(1, Math.abs(rpm) / 15);
    this.tGas = tg;
    let ts = 0;
    if (this.starter) { ts = Math.max(0, MODELLED.starterStall * (1 - rpm / MODELLED.starterFree)); }
    const tf = frictionTorque(rpm) * Math.sign(this.omega || tg + ts || 0);
    const tb = blowerTorque(rpm) * Math.sign(this.omega);
    const tl = RATED_TORQUE * this.load * Math.pow(Math.max(0, rpm) / PUBLISHED.ratedRpm, 2);
    this.loadT = tl;
    const net = tg + ts - tf - tb - tl;
    // static stick near zero speed
    if (Math.abs(this.omega) < 0.6 && Math.abs(tg + ts) < MODELLED.frictionA * 1.05 && !this.starter) {
      this.omega *= 0.5;
      if (Math.abs(this.omega) < 0.05) {
        this.omega = 0;
        if (this.state === 'stopping' || (this.state === 'running')) { this.state = 'off'; this.emit('stop', this.t); this.rack = 0; }
      }
    } else {
      this.omega += net / MODELLED.inertia * h;
    }
    this.reaction += ((tg + ts) - this.reaction) * Math.min(1, h * 30);
    const dth = this.omega * h / DEG;
    this.theta = th0 + dth;
    if (this.theta > 1e7) this.theta -= 7200 * Math.floor(this.theta / 7200 - 1);
    const t0 = this.t; this.t += h;

    // averages over about one cycle
    const frac = Math.min(1, Math.abs(dth) / 360);
    this.navg += (rpm - this.navg) * Math.max(frac, h / 0.25);
    this.brakeT += (tl - this.brakeT) * Math.min(1, h / 0.35);

    // events by crossing
    if (dth > 0) this.crossings(th0, this.theta, t0, h);
    this.fuelRate += (this.fuelRateNow() - this.fuelRate) * Math.min(1, h / 0.4);
    for (const c of this.cyl) c.glow *= Math.exp(-h * 18);

    // state transitions
    if (this.state === 'cranking') {
      this.crankTime += h;
      if (this.firstFire >= 0 && rpm > MODELLED.catchRpm) {
        this.state = 'running'; this.starter = false; this.everCaught = true; this.emit('caught', this.t);
      } else if (this.crankTime > 8) { this.starter = false; this.fuelOn = false; this.state = 'stopping'; this.emit('keyoff', this.t); }
    } else if (this.state === 'running' && rpm < 260) {
      this.fuelOn = false; this.state = 'stopping'; this.emit('stalled', this.t);
    }
  }
  fuelRateNow() { // W of fuel heat
    if (!this.fuelOn || this.omega <= 0) return 0;
    const cyclesPerSec = this.rpm / 120;
    return 3 * cyclesPerSec * Q_FULL * this.rack * fullRackShape(this.rpm) / MODELLED.heatToGas;
  }
  crossings(a, b, t0, h) {
    const ang = EVENT_ANGLES();
    const list = [];
    for (let i = 0; i < 3; i++) {
      for (const [name, local] of [['soc', ang.soc], ['evo', ang.evo], ['tdcC', 700]]) {
        const base = 240 * i + local;
        let k = Math.ceil((a - base) / 720);
        let x = base + 720 * k;
        if (x <= a) x += 720;
        while (x <= b) { list.push({ name, i, x }); x += 720; }
      }
    }
    list.sort((p, q) => p.x - q.x);
    for (const e of list) {
      const te = t0 + h * (e.x - a) / (b - a);
      const c = this.cyl[e.i];
      if (e.name === 'soc') this.combust(e.i, te);
      else if (e.name === 'evo') {
        const pe = pressureAt(MODELLED.evo, c.fuel * c.burn);
        this.emit('evo', te, { cyl: e.i, p: pe, rpm: this.rpm, load: c.fuel * c.burn, fired: c.burn > 0 });
      } else if (e.name === 'tdcC') {
        this.emit('compress', te, { cyl: e.i });
      }
    }
  }
  combust(i, te) {
    const c = this.cyl[i];
    const fuel = this.fuelOn && this.omega > 0 ? this.rack * fullRackShape(this.rpm) : 0;
    this.compressions++;
    if (fuel <= 0.001) { c.fuel = 0; c.burn = 0; return; }
    c.fuel = fuel;
    if (this.state === 'cranking' && this.compressions <= 3) { // charge still too cold
      c.burn = 0; this.emit('misfire', te, { cyl: i, smoke: 0.15, dry: true });
      this.smoke = Math.min(1, this.smoke + 0.15);
    } else if (this.state === 'cranking' && this.compressions <= 5) { // first cycles burn poorly and rich
      c.burn = 0.35; this.emit('misfire', te, { cyl: i, smoke: 0.55 });
      this.smoke = Math.min(1, this.smoke + 0.55);
      if (this.firstFire < 0) this.firstFire = te;
    } else {
      c.burn = 1; c.glow = 1; c.lastFire = te;
      if (this.firstFire < 0) this.firstFire = te;
      const rich = Math.max(0, (this.rack - this.rackTarget)) + (this.state === 'cranking' ? 0.35 : 0) + Math.max(0, fuel - 0.9) * 0.5;
      if (rich > 0.05) this.smoke = Math.min(1, this.smoke + rich * 0.5);
      this.emit('fire', te, { cyl: i, fuel, smoke: rich });
    }
  }

  // live readings for the card
  readings() {
    const rpm = Math.max(0, this.navg);
    const kW = Math.min(PUBLISHED.ratedKW, Math.max(0, this.brakeT * rpm * 2 * Math.PI / 60 / 1000));
    const torque = rpm > 50 ? kW * 1000 / (rpm * 2 * Math.PI / 60) : 0;
    const lph = this.fuelRate / MODELLED.lhv / MODELLED.fuelDensity * 3600;
    const head = Math.max(...this.cyl.map(c => c.temp));
    return { rpm, kW, hp: kW / 0.7457, torque, lph, air: this.airflow(), head };
  }
  // geometry state for the 3D model and drawings
  cylinderState(i) {
    const phi = mod720(this.theta - 240 * i);
    const k = slider((phi % 360) * DEG);
    const c = this.cyl[i];
    return {
      phi, s: k.s, beta: k.beta, stroke: strokeName(phi),
      p: pressureAt(phi, c.fuel * c.burn), v: volumeAt(phi),
      inLift: intakeLift(phi), exLift: exhaustLift(phi),
      glow: Math.max(c.glow * 0.6, heatReleaseRate(phi, c.fuel * c.burn)), fuel: c.fuel * c.burn, temp: c.temp,
    };
  }
}
