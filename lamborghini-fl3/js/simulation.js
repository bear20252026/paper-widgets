// Lamborghini FL3 Diesel Simulation Module
// Pure, testable ES module modeling the 3-cylinder air-cooled direct-injection diesel

export class FL3Simulation {
  constructor() {
    // Published specifications (exact)
    this.numCylinders = 3;
    this.bore = 0.092;        // 92 mm (published)
    this.stroke = 0.110;      // 110 mm (published)
    this.displacement = 0.002193; // 2,193 cc (published)
    this.ratedPowerW = 29100; // 29.1 kW = 39 hp at 2200 rpm (published)
    this.ratedRpm = 2200;     // published

    // Modelled parameters (all assumptions labelled as modelled)
    this.conRodLength = 0.200; // 200 mm rod
    this.crankRadius = this.stroke / 2; // 0.055 m
    this.compressionRatio = 17.0; // ~17:1 modelled
    this.pistonArea = Math.PI * Math.pow(this.bore / 2, 2); // ~0.0066476 m^2
    this.sweptVolPerCyl = this.pistonArea * this.stroke; // ~0.0007312 m^3
    this.clearanceVol = this.sweptVolPerCyl / (this.compressionRatio - 1); // ~4.57e-5 m^3
    this.flywheelInertia = 0.82; // kg·m^2 (prompt: about 0.8 kg·m^2)

    // Firing order: 1 - 2 - 3, every 240 degrees (4-stroke 720 deg cycle)
    this.cylPhase = [0, 240, 480]; // degrees

    // State variables
    this.crankAngle = 0; // radians [0, 4*PI)
    this.rpm = 0;
    this.omega = 0; // rad/s
    this.gasTorque = 0;
    this.frictionTorque = 0;
    this.blowerTorque = 0;
    this.loadTorque = 0;
    this.netTorque = 0;
    this.indicatedPower = 0;
    this.brakePowerW = 0;
    this.brakePowerHp = 0;
    this.flywheelTorque = 0;

    // Controls
    this.keyState = 'stop'; // 'stop', 'cranking', 'run'
    this.throttle = 0.0;     // 0.0 = idle (~700 rpm), 1.0 = high idle (~2350 rpm)
    this.ptoLoad = 0.0;       // 0.0 to 1.0 (PTO dynamometer brake)
    this.fuelRack = 0.0;      // 0.0 to 1.0
    this.targetGovernorRpm = 700;

    // Starter & ignition tracking
    this.crankingTime = 0;
    this.compressionsCount = 0;
    this.hasCaught = false;
    this.lastFiredCyl = -1;
    this.lastEvoCyl = -1;
    this.smokePuffIntensity = 0; // 0..1 for black smoke burst

    // Thermal model
    this.ambientTempC = 20;
    this.headTempC = 20; // settles 160..175 C at full load
    this.coolingAirM3Min = 0; // m^3/min
    this.fuelRateLPerH = 0;   // liters/hour

    // Diagnostics & live indicator data (cylinder 1)
    this.cylPressures = [1.0, 1.0, 1.0]; // bar
    this.cylVolumes = [this.clearanceVol, this.clearanceVol, this.clearanceVol];
    this.peakPressureBar = 1.0;
    this.recentPeakPressure = 1.0;
    this.fullLoadPeakPressure = 73.2; // reference ~73 bar
    this.pvLoopData = []; // cylinder 1 live loop points
    this.pvLoopReference = this.generateReferencePV();

    // Valve timing curves (degrees relative to TDC firing = 0)
    // 0..180: Expansion; 180..360: Exhaust; 360..540: Intake; 540..720: Compression
    this.evoAngle = 145; // Exhaust Valve Open at 145 deg ATDC
    this.evcAngle = 370; // Exhaust Valve Close at 10 deg ATDC
    this.ivoAngle = 350; // Intake Valve Open at 10 deg BTDC
    this.ivcAngle = 575; // Intake Valve Close at 35 deg ABDC

    // Event queue
    this.events = [];
  }

  // Pre-generate reference P-V curve for full load at 2200 rpm
  generateReferencePV() {
    const points = [];
    const steps = 180;
    for (let i = 0; i <= steps; i++) {
      const deg = (i / steps) * 720;
      const rad = (deg * Math.PI) / 180;
      const V = this.getCylinderVolume(rad);
      const P = this.calculateCylinderPressure(deg, 1.0, 2200, true);
      points.push({ deg, V: V * 1e6 /* cm^3 */, P /* bar */ });
    }
    return points;
  }

  // Exact slider-crank piston position from TDC (m)
  getPistonDisplacement(thetaRad) {
    const r = this.crankRadius;
    const l = this.conRodLength;
    const sinT = Math.sin(thetaRad);
    const cosT = Math.cos(thetaRad);
    return r * (1 - cosT) + l - Math.sqrt(Math.max(0.0001, l * l - r * r * sinT * sinT));
  }

  // Cylinder volume (m^3)
  getCylinderVolume(thetaRad) {
    const s = this.getPistonDisplacement(thetaRad);
    return this.clearanceVol + this.pistonArea * s;
  }

  // Effective kinematic lever arm: v_p / omega (m)
  getLeverArm(thetaRad) {
    const r = this.crankRadius;
    const l = this.conRodLength;
    const sinT = Math.sin(thetaRad);
    const cosT = Math.cos(thetaRad);
    const denom = Math.sqrt(Math.max(0.0001, l * l - r * r * sinT * sinT));
    return r * sinT + (r * r * sinT * cosT) / denom;
  }

  // Valve lift [0..1]
  getValveLifts(degInCycle) {
    const deg = ((degInCycle % 720) + 720) % 720;
    let intakeLift = 0;
    let exhaustLift = 0;

    // Intake valve: opens 350 deg, closes 575 deg
    if (deg >= this.ivoAngle && deg <= this.ivcAngle) {
      intakeLift = Math.sin(((deg - this.ivoAngle) / (this.ivcAngle - this.ivoAngle)) * Math.PI);
    }

    // Exhaust valve: opens 145 deg, closes 370 deg
    if (deg >= this.evoAngle && deg <= this.evcAngle) {
      exhaustLift = Math.sin(((deg - this.evoAngle) / (this.evcAngle - this.evoAngle)) * Math.PI);
    }

    return { intake: Math.max(0, intakeLift), exhaust: Math.max(0, exhaustLift) };
  }

  // Double-Wiebe in-cylinder pressure model
  calculateCylinderPressure(degInCycle, rack, rpm, forceFired = false) {
    const deg = ((degInCycle % 720) + 720) % 720;
    const rad = (deg * Math.PI) / 180;
    const V = this.getCylinderVolume(rad);
    const V_bdc = this.clearanceVol + this.sweptVolPerCyl;

    // Intake stroke: 360 to 540 deg
    if (deg >= 360 && deg < 540) {
      return 1.0;
    }

    // Exhaust stroke: 180 to 360 deg
    if (deg >= 180 && deg < 360) {
      const frac = (deg - 180) / 180;
      return 1.0 + 0.35 * (1 - frac);
    }

    // Compression stroke: 540 to 720 deg (i.e. -180 to 0 deg TDC)
    if (deg >= 540 && deg <= 720) {
      const polytropic_n = 1.34;
      const P_comp = 1.0 * Math.pow(V_bdc / V, polytropic_n);

      const fired = (this.hasCaught || forceFired) && rack > 0.01;
      if (fired && deg >= 708) { // 12 deg BTDC injection start
        const burnFrac = Math.pow((deg - 708) / 12, 2.0) * 0.18;
        const deltaP = rack * 29.5 * burnFrac;
        return P_comp + deltaP;
      }
      return P_comp;
    }

    // Expansion stroke: 0 to 180 deg
    if (deg >= 0 && deg < 180) {
      const fired = (this.hasCaught || forceFired) && rack > 0.01;
      if (!fired) {
        // Unfired compression loss
        const P_tdc_unfired = 1.0 * Math.pow(this.compressionRatio, 1.34);
        return Math.max(1.0, P_tdc_unfired * Math.pow(this.clearanceVol / V, 1.31));
      }

      // Fired: Double-Wiebe heat release
      // Peak lands at 72.5 - 73.5 bar at full rack
      const P_tdc_comp = 1.0 * Math.pow(this.compressionRatio, 1.34); // ~43.7 bar
      const maxDelta = 29.5 * rack; // +29.5 bar -> ~73.2 bar peak

      if (deg < 10) {
        const t = deg / 10;
        const wiebe = 1 - Math.exp(-4.5 * Math.pow(t, 2.1));
        return P_tdc_comp + maxDelta * wiebe;
      } else {
        const peakP = P_tdc_comp + maxDelta;
        const expFrac = (deg - 10) / 170;
        // Expansion down to ~3.5 bar at exhaust opening
        const P_end = 1.2 + 2.4 * rack;
        const P_exp = peakP * Math.pow(this.clearanceVol / V, 1.24) + (P_end - 1.0) * (1 - Math.pow(expFrac, 0.6));
        return Math.max(1.1, Math.min(peakP, P_exp));
      }
    }

    return 1.0;
  }

  // Update simulation by dt (seconds)
  update(dt, timestamp = performance.now()) {
    if (dt <= 0) return;

    // Target governed speed based on throttle lever
    // Idle: ~700 rpm (throttle=0), High Idle: ~2350 rpm (throttle=1)
    // Mechanical governor has ~150 rpm droop from high idle under full fuel rack
    const noLoadTargetRpm = 700 + this.throttle * (2350 - 700);
    this.targetGovernorRpm = noLoadTargetRpm - (this.ptoLoad * 145.0);

    // Key handling & starter state machine
    if (this.keyState === 'cranking') {
      this.crankingTime += dt;
      // Starter electric motor torque targets ~250 rpm
      if (this.rpm < 250) {
        this.omega += (250 * (2 * Math.PI / 60) - this.omega) * Math.min(1.0, dt * 6.0);
      }

      // Catches after ~0.9s (a few compressions)
      if (this.crankingTime > 0.95 && !this.hasCaught) {
        this.hasCaught = true;
        this.keyState = 'run';
        this.smokePuffIntensity = 1.0;
        this.events.push({ type: 'caught', time: timestamp, rpm: this.rpm });
      }
    } else if (this.keyState === 'stop') {
      this.hasCaught = false;
      this.crankingTime = 0;
      this.governorIntegral = 0;
    }

    // Mechanical Governor: droop ~120 rpm with PI tracking
    // Controls fuel rack position [0..1]
    if (this.hasCaught && this.keyState === 'run') {
      const speedError = this.targetGovernorRpm - this.rpm;
      this.governorIntegral = (this.governorIntegral || 0) + speedError * dt * 0.05;
      this.governorIntegral = Math.max(-0.35, Math.min(0.65, this.governorIntegral));

      let targetRack = 0.16 + (speedError / 130.0) * 0.75 + this.governorIntegral;
      targetRack = Math.max(0.04, Math.min(1.0, targetRack));

      // Actuator inertia / lag
      const rackRate = 12.0;
      this.fuelRack += (targetRack - this.fuelRack) * Math.min(1.0, dt * rackRate);
    } else if (this.keyState === 'cranking') {
      this.fuelRack = 0.85; // cold start excess fuel
    } else {
      this.fuelRack = 0.0;  // fuel cut
    }

    // Load torque: PTO brake rises with omega^2
    // Calibrated: 100% load at 2200 rpm requires exactly full fuel (39 hp / 29.1 kW)
    const ratedOmega = (this.ratedRpm * 2 * Math.PI) / 60; // 230.38 rad/s
    const ratedTorque = this.ratedPowerW / ratedOmega;     // 126.31 N·m
    const k_pto = ratedTorque / (ratedOmega * ratedOmega);
    this.loadTorque = this.ptoLoad * k_pto * (this.omega * this.omega);

    // Friction & blower drag
    // At 700 rpm idle, friction ~14 N·m; at 2200 rpm, friction ~22 N·m
    const frictionTorque = (10.0 + 0.0055 * this.rpm) * (this.omega > 0.1 ? 1 : 0);
    const blowerTorque = (0.00021 * this.omega * this.omega) * (this.omega > 0.1 ? 1 : 0);
    this.frictionTorque = frictionTorque;
    this.blowerTorque = blowerTorque;

    // Sub-step crank integration (<= 2 deg per sub-step)
    const maxSubStepDeg = 2.0;
    const currentSpeedDegS = Math.max(60, (this.rpm * 360) / 60);
    const numSubSteps = Math.max(1, Math.min(80, Math.ceil((currentSpeedDegS * dt) / maxSubStepDeg)));
    const subDt = dt / numSubSteps;

    let avgGasTorque = 0;
    let currentPeak = 1.0;

    for (let step = 0; step < numSubSteps; step++) {
      let totalGasTorqueThisStep = 0;

      for (let c = 0; c < 3; c++) {
        const cylDeg = (((this.crankAngle * 180 / Math.PI) + this.cylPhase[c]) % 720 + 720) % 720;
        const cylRad = (cylDeg * Math.PI) / 180;

        const P_bar = this.calculateCylinderPressure(cylDeg, this.fuelRack, this.rpm);
        this.cylPressures[c] = P_bar;
        this.cylVolumes[c] = this.getCylinderVolume(cylRad);

        if (c === 0 && P_bar > currentPeak) {
          currentPeak = P_bar;
        }

        // Net gas force = (P - Patm) * Area
        const P_gauge_Pa = (P_bar - 1.013) * 1e5;
        const gasForce = P_gauge_Pa * this.pistonArea;

        // Kinematic lever arm
        const leverArm = this.getLeverArm(cylRad);
        // Calibrate multiplier so indicated torque matches engine displacement
        const cylTorque = gasForce * leverArm * 1.04;
        totalGasTorqueThisStep += cylTorque;

        // Firing event
        if (cylDeg >= 0 && cylDeg < 5 && this.lastFiredCyl !== c) {
          if (this.hasCaught) {
            this.events.push({
              type: 'fire',
              time: timestamp,
              cylinder: c + 1,
              pressure: P_bar,
              fuelRack: this.fuelRack
            });
          } else if (this.keyState === 'cranking') {
            this.compressionsCount++;
            this.events.push({
              type: 'misfire',
              time: timestamp,
              cylinder: c + 1,
              pressure: P_bar
            });
          }
          this.lastFiredCyl = c;
        } else if (cylDeg > 15 && this.lastFiredCyl === c) {
          this.lastFiredCyl = -1;
        }

        // Exhaust Valve Opening (EVO ~145 deg)
        if (cylDeg >= this.evoAngle && cylDeg < this.evoAngle + 6 && this.lastEvoCyl !== c) {
          this.events.push({
            type: 'evo',
            time: timestamp,
            cylinder: c + 1,
            pressure: P_bar,
            rpm: this.rpm
          });
          this.lastEvoCyl = c;
        } else if (cylDeg > this.evoAngle + 15 && this.lastEvoCyl === c) {
          this.lastEvoCyl = -1;
        }
      }

      // Starter torque while cranking
      let starterTorque = 0;
      if (this.keyState === 'cranking' && this.rpm < 280) {
        starterTorque = Math.max(0, 110.0 * (1 - this.rpm / 280));
      }

      // Net torque on flywheel
      const netT = totalGasTorqueThisStep + starterTorque - frictionTorque - blowerTorque - this.loadTorque;
      this.netTorque = netT;
      avgGasTorque += totalGasTorqueThisStep / numSubSteps;

      // Angular acceleration
      const alpha = netT / this.flywheelInertia;
      this.omega = Math.max(0, this.omega + alpha * subDt);

      // Advance crank
      this.crankAngle = (this.crankAngle + this.omega * subDt) % (4 * Math.PI);
    }

    this.gasTorque = avgGasTorque;
    this.rpm = (this.omega * 60) / (2 * Math.PI);

    // Stop or stall detection
    if (this.rpm < 180 && this.hasCaught && this.ptoLoad > 0.8 && this.throttle < 0.2) {
      this.hasCaught = false;
      this.keyState = 'stop';
      this.events.push({ type: 'stalled', time: timestamp, rpm: this.rpm });
    }
    if (this.rpm < 5 && this.keyState === 'stop') {
      this.rpm = 0;
      this.omega = 0;
      this.events.push({ type: 'stop', time: timestamp });
    }

    // Power and torque at flywheel
    this.flywheelTorque = Math.max(0, Math.min(132, this.loadTorque > 0 ? this.loadTorque : (this.gasTorque - this.frictionTorque - this.blowerTorque)));
    this.brakePowerW = Math.max(0, this.flywheelTorque * this.omega);
    this.brakePowerHp = this.brakePowerW / 745.7;

    // Peak pressure tracking for cylinder 1
    if (currentPeak > 5.0) {
      this.recentPeakPressure = currentPeak;
    }

    // Record P-V loop for Cylinder 1
    const cyl1Deg = ((this.crankAngle * 180 / Math.PI) % 720 + 720) % 720;
    this.pvLoopData.push({
      deg: cyl1Deg,
      V: this.cylVolumes[0] * 1e6, // cm^3
      P: this.cylPressures[0]      // bar
    });
    if (this.pvLoopData.length > 240) {
      this.pvLoopData.shift();
    }

    // Thermal simulation: head temperature (30x speedup)
    const thermalSpeedup = 30.0;
    const fuelHeatW = this.fuelRack * (this.rpm / this.ratedRpm) * 78000;
    const heatToMetalW = 0.25 * fuelHeatW;
    const coolingAirRatio = Math.max(0.08, this.rpm / this.ratedRpm);
    const heatRemovedW = coolingAirRatio * 42.0 * (this.headTempC - this.ambientTempC);
    const metalThermalMass = 3800.0;
    const dTemp = ((heatToMetalW - heatRemovedW) / metalThermalMass) * (dt * thermalSpeedup);
    this.headTempC = Math.max(this.ambientTempC, Math.min(185, this.headTempC + dTemp));

    // Consumables & cooling air
    this.fuelRateLPerH = (this.brakePowerHp / 39.0) * 8.2 + (this.rpm > 200 ? 0.8 * (this.rpm / 700) : 0);
    this.coolingAirM3Min = (this.rpm / this.ratedRpm) * 24.5;

    // Smoke puff decay
    if (this.smokePuffIntensity > 0) {
      this.smokePuffIntensity = Math.max(0, this.smokePuffIntensity - dt * 1.5);
    }
  }

  // Consume and clear queued events
  flushEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}
