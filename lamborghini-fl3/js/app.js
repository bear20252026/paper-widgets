// Lamborghini FL3 Bench Study - Main Application Coordinator
import * as THREE from 'three';
import { FL3Simulation } from './simulation.js';
import { FL3AudioEngine } from './audio.js';
import { FL3EngineModel } from './engine-model.js';
import { FL3Instruments } from './instruments.js';
import { FL3Drawings } from './drawings.js';

export class FL3App {
  constructor() {
    this.sim = new FL3Simulation();
    this.audio = new FL3AudioEngine();
    this.instruments = new FL3Instruments();
    this.drawings = new FL3Drawings();

    this.container = document.getElementById('canvas3d-container');
    this.calloutsContainer = document.getElementById('callouts-container');
    this.narrationEl = document.getElementById('narration-text');

    // Controls state
    this.isSlowMotion = false;
    this.slowMoFactor = 1 / 25;
    this.currentViewMode = 'painted';

    // Camera targets for smooth scripted transitions
    this.cameraViews = {
      painted: { pos: new THREE.Vector3(0.65, 0.42, 0.85), target: new THREE.Vector3(0, 0.05, 0) },
      cutaway: { pos: new THREE.Vector3(-0.85, 0.28, 0.15), target: new THREE.Vector3(0, 0.10, 0) },
      airflow: { pos: new THREE.Vector3(0.85, 0.35, -0.45), target: new THREE.Vector3(0, 0.10, 0) },
      exploded: { pos: new THREE.Vector3(0.95, 0.75, 1.10), target: new THREE.Vector3(0, 0.12, 0) }
    };
    this.camTargetPos = this.cameraViews.painted.pos.clone();
    this.camTargetLook = this.cameraViews.painted.target.clone();

    // Orbit controller state
    this.orbit = {
      isDragging: false,
      prevX: 0,
      prevY: 0,
      spherical: new THREE.Spherical(1.25, Math.PI * 0.35, Math.PI * 0.28),
      target: new THREE.Vector3(0, 0.05, 0)
    };

    // Narration state
    this.lastNarration = '';
    this.narrationLockTimer = 0;

    this.initThree();
    this.initUI();
    this.bindEvents();
    this.setupTouchScrollHandling();

    // Start render & physics loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  initThree() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 20);
    this.camera.position.copy(this.camTargetPos);

    // Renderer (transparent canvas over ivory offset stock paper)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.container.appendChild(this.renderer.domElement);

    // Lighting (1960s catalog photographic lighting)
    const ambientLight = new THREE.AmbientLight(0xFFFAF0, 1.2);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xFFF8E8, 2.2);
    dirLight1.position.set(1.5, 2.5, 1.8);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 0.5;
    dirLight1.shadow.camera.far = 6;
    dirLight1.shadow.bias = -0.0005;
    dirLight1.shadow.camera.left = -0.8;
    dirLight1.shadow.camera.right = 0.8;
    dirLight1.shadow.camera.top = 0.8;
    dirLight1.shadow.camera.bottom = -0.8;
    this.scene.add(dirLight1);

    const fillLight = new THREE.DirectionalLight(0xD8EEF8, 1.1);
    fillLight.position.set(-1.8, 1.2, -1.2);
    this.scene.add(fillLight);

    // Soft contact shadow plane on paper floor (y = -0.36)
    const shadowGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.28 });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.36;
    shadowMesh.receiveShadow = true;
    this.scene.add(shadowMesh);

    // Build procedural 3D engine model
    this.engineModel = new FL3EngineModel(this.scene);
  }

  initUI() {
    this.keyBtn = document.getElementById('key-switch');
    this.keyStateLabel = document.getElementById('key-state-label');
    this.throttleSlider = document.getElementById('slider-throttle');
    this.throttleValEl = document.getElementById('val-throttle');
    this.ptoSlider = document.getElementById('slider-pto');
    this.ptoValEl = document.getElementById('val-pto');

    this.viewButtons = {
      painted: document.getElementById('btn-view-painted'),
      cutaway: document.getElementById('btn-view-cutaway'),
      airflow: document.getElementById('btn-view-airflow'),
      exploded: document.getElementById('btn-view-exploded')
    };

    this.slowMoBtn = document.getElementById('btn-slowmo');
    this.soundBtn = document.getElementById('btn-sound');
    this.resetCamBtn = document.getElementById('btn-reset-cam');

    // Drawing Canvases
    this.drawCanvasFront = document.getElementById('canvas-front');
    this.drawCanvasRight = document.getElementById('canvas-right');
    this.drawCanvasPlan = document.getElementById('canvas-plan');
    this.drawCanvasSection = document.getElementById('canvas-section');

    // Instrument Canvases
    this.instCanvasTacho = document.getElementById('canvas-tacho');
    this.instCanvasCycle = document.getElementById('canvas-cycle');
    this.instCanvasPv = document.getElementById('canvas-pv');
    this.instCanvasChart = document.getElementById('canvas-chart');

    // Readings card elements
    this.readSpeed = document.getElementById('read-speed');
    this.readPower = document.getElementById('read-power');
    this.readTorque = document.getElementById('read-torque');
    this.readFuel = document.getElementById('read-fuel');
    this.readAir = document.getElementById('read-air');
    this.readTemp = document.getElementById('read-temp');

    this.setNarration('Key ready. Click ignition switch or press Space to crank the electric starter.');
  }

  setNarration(text, priority = false) {
    if (this.narrationLockTimer > 0 && !priority) return;
    if (this.lastNarration === text) return;
    this.lastNarration = text;
    if (this.narrationEl) {
      this.narrationEl.textContent = text;
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize());

    // Ignition key switch
    this.keyBtn.addEventListener('click', () => this.toggleIgnitionKey());

    // Levers
    this.throttleSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.sim.throttle = val;
      const targetGov = Math.round(700 + val * (2350 - 700));
      this.throttleValEl.textContent = `${targetGov} rpm`;
      if (val > 0.8 && this.sim.ptoLoad > 0.8) {
        this.setNarration('Full PTO load at 2,200 rpm: the rack is wide open and the FL3 makes its rated 39 hp.');
      } else if (val > 0.2) {
        this.setNarration('The hand throttle sets the governor, which opens the rack until the engine holds that speed.');
      }
    });

    this.ptoSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.sim.ptoLoad = val;
      this.ptoValEl.textContent = `${Math.round(val * 100)} %`;
      if (val > 0.8 && this.sim.throttle > 0.8) {
        this.setNarration('Full PTO load at 2,200 rpm: the rack is wide open and the FL3 makes its rated 39 hp.');
      }
    });

    // View buttons (keys 1 to 4)
    Object.keys(this.viewButtons).forEach((mode) => {
      const btn = this.viewButtons[mode];
      if (btn) {
        btn.addEventListener('click', () => this.switchView(mode));
      }
    });

    // Slow motion button (S)
    this.slowMoBtn.addEventListener('click', () => this.toggleSlowMotion());

    // Sound toggle
    this.soundBtn.addEventListener('click', () => {
      this.audio.ensureContext();
      const isMuted = this.audio.toggleMute();
      this.soundBtn.classList.toggle('active', !isMuted);
      this.soundBtn.textContent = isMuted ? 'Sound (Off)' : 'Sound (On)';
    });

    // Reset view
    this.resetCamBtn.addEventListener('click', () => {
      this.camTargetPos.copy(this.cameraViews[this.currentViewMode].pos);
      this.camTargetLook.copy(this.cameraViews[this.currentViewMode].target);
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      this.audio.ensureContext();
      if (e.code === 'Space') {
        e.preventDefault();
        this.toggleIgnitionKey();
      } else if (e.code === 'Digit1') {
        this.switchView('painted');
      } else if (e.code === 'Digit2') {
        this.switchView('cutaway');
      } else if (e.code === 'Digit3') {
        this.switchView('airflow');
      } else if (e.code === 'Digit4') {
        this.switchView('exploded');
      } else if (e.code === 'KeyS') {
        this.toggleSlowMotion();
      }
    });

    // Pointer orbit on 3D canvas
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
      this.audio.ensureContext();
      this.orbit.isDragging = true;
      this.orbit.prevX = e.clientX;
      this.orbit.prevY = e.clientY;
      dom.setPointerCapture(e.pointerId);
    });

    dom.addEventListener('pointermove', (e) => {
      if (!this.orbit.isDragging) return;
      const dx = e.clientX - this.orbit.prevX;
      const dy = e.clientY - this.orbit.prevY;
      this.orbit.prevX = e.clientX;
      this.orbit.prevY = e.clientY;

      const offset = this.camera.position.clone().sub(this.camTargetLook);
      this.orbit.spherical.setFromVector3(offset);

      this.orbit.spherical.theta -= dx * 0.007;
      this.orbit.spherical.phi = Math.max(0.12, Math.min(Math.PI * 0.48, this.orbit.spherical.phi - dy * 0.007));

      offset.setFromSpherical(this.orbit.spherical);
      this.camTargetPos.copy(this.camTargetLook).add(offset);
    });

    dom.addEventListener('pointerup', (e) => {
      this.orbit.isDragging = false;
      try { dom.releasePointerCapture(e.pointerId); } catch (_) {}
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * 0.0012;
      const offset = this.camera.position.clone().sub(this.camTargetLook);
      this.orbit.spherical.setFromVector3(offset);
      this.orbit.spherical.radius = Math.max(0.65, Math.min(2.8, this.orbit.spherical.radius + zoomDelta));
      offset.setFromSpherical(this.orbit.spherical);
      this.camTargetPos.copy(this.camTargetLook).add(offset);
    }, { passive: false });
  }

  // Mobile touch: horizontal drag turns engine, vertical swipe scrolls page
  setupTouchScrollHandling() {
    const dom = this.renderer.domElement;
    let touchStartX = 0;
    let touchStartY = 0;
    let isHorizontalGesture = false;

    dom.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isHorizontalGesture = false;
      }
    }, { passive: true });

    dom.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;

        if (!isHorizontalGesture && Math.abs(dx) > Math.abs(dy) + 6) {
          isHorizontalGesture = true;
        }

        if (isHorizontalGesture) {
          e.preventDefault();
          const offset = this.camera.position.clone().sub(this.camTargetLook);
          this.orbit.spherical.setFromVector3(offset);
          this.orbit.spherical.theta -= dx * 0.008;
          offset.setFromSpherical(this.orbit.spherical);
          this.camTargetPos.copy(this.camTargetLook).add(offset);
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      }
    }, { passive: false });
  }

  toggleIgnitionKey() {
    this.audio.ensureContext();
    if (this.sim.keyState === 'stop') {
      // Start cranking
      this.sim.keyState = 'cranking';
      this.keyBtn.classList.add('cranking');
      this.keyStateLabel.textContent = 'Cranking';
      this.audio.triggerSolenoidClunk(true);
      this.setNarration('Key turned. The starter pinion meshes with the flywheel and spins the engine at about 250 rpm.');
    } else {
      // Stop engine
      this.sim.keyState = 'stop';
      this.sim.hasCaught = false;
      this.keyBtn.classList.remove('cranking', 'running');
      this.keyStateLabel.textContent = 'Stop';
      this.audio.triggerSolenoidClunk(false);
      this.setNarration('Fuel cut. It runs down and rocks back on its last compression.');
    }
  }

  switchView(mode) {
    this.audio.ensureContext();
    if (mode === 'exploded' && this.sim.rpm > 10) {
      this.setNarration('Exploded view waits until the engine has stopped. Cutting fuel rack now...');
      this.sim.keyState = 'stop';
      this.sim.hasCaught = false;
      this.keyBtn.classList.remove('cranking', 'running');
      this.keyStateLabel.textContent = 'Stop';

      // Wait until stopped, then switch
      const checkInterval = setInterval(() => {
        if (this.sim.rpm < 2) {
          clearInterval(checkInterval);
          this.switchView('exploded');
        }
      }, 100);
      return;
    }

    this.currentViewMode = mode;
    Object.keys(this.viewButtons).forEach((m) => {
      this.viewButtons[m].classList.toggle('active', m === mode);
    });

    this.engineModel.setViewMode(mode);
    this.camTargetPos.copy(this.cameraViews[mode].pos);
    this.camTargetLook.copy(this.cameraViews[mode].target);

    if (mode === 'exploded') {
      this.audio.triggerExplodeCue(true);
      this.setNarration('Exploded view: separated along functional axes. Every assembly callout printed in Italian and English.');
    } else {
      if (this.engineModel.explodedProgress > 0.5) {
        this.audio.triggerExplodeCue(false);
      }
      if (mode === 'painted') {
        this.setNarration('Painted view: glossy celeste enamel on cast iron and sheet metal, mounted on the arancio test stand.');
      } else if (mode === 'cutaway') {
        this.setNarration('Cutaway view: section plane through cylinder axes. Pistons, rods, and crank stay whole while chamber combustion glows.');
      } else if (mode === 'airflow') {
        this.setNarration('No water anywhere. The blower pushes air down the cowl, across the fins, and out warm on the pump side.');
      }
    }
  }

  toggleSlowMotion() {
    this.isSlowMotion = !this.isSlowMotion;
    this.slowMoBtn.classList.toggle('active', this.isSlowMotion);
    this.slowMoBtn.textContent = this.isSlowMotion ? 'Slow motion (1/25x)' : 'Slow motion (S)';
    this.audio.timeScale = this.isSlowMotion ? 0.35 : 1.0;
    if (this.isSlowMotion) {
      this.setNarration('Slow motion engaged: time eased to 1/25th to watch each valve event and combustion cycle.');
    }
  }

  onResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // Update Callout Labels with Leader Lines in Exploded View
  updateCallouts() {
    if (this.currentViewMode !== 'exploded' || this.engineModel.explodedProgress < 0.6) {
      this.calloutsContainer.innerHTML = '';
      return;
    }

    const items = this.engineModel.explodedData;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    let svgLines = `<svg class="callout-svg-layer" width="${width}" height="${height}" style="position:absolute;top:0;left:0;pointer-events:none;">`;
    let htmlDivs = '';

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const worldPos = item.anchor.clone();
      worldPos.project(this.camera);

      const sx = ((worldPos.x + 1) / 2) * width;
      const sy = ((-worldPos.y + 1) / 2) * height;

      if (worldPos.z > 1.0) continue;

      const isRight = sx > width * 0.5;
      const labelW = 145;
      const labelX = isRight ? Math.min(width - labelW - 10, sx + 45) : Math.max(10, sx - labelW - 45);
      const labelY = Math.max(10, Math.min(height - 40, sy - 12 + (i % 2 === 0 ? -12 : 12)));

      const lineEndX = isRight ? labelX : labelX + labelW;
      const lineEndY = labelY + 12;

      // SVG leader line connecting orange dot on part to paper backing label
      svgLines += `
        <line x1="${sx}" y1="${sy}" x2="${lineEndX}" y2="${lineEndY}" stroke="#E0561C" stroke-width="1.2" stroke-dasharray="2,2" />
        <circle cx="${sx}" cy="${sy}" r="3.5" fill="#E0561C" stroke="#1C1B19" stroke-width="1" />
      `;

      htmlDivs += `
        <div class="callout-item" style="left:${labelX}px; top:${labelY}px; width:${labelW}px;">
          <div class="callout-en">${item.enName}</div>
          <div class="callout-it">${item.itName}</div>
        </div>
      `;
    }

    svgLines += `</svg>`;
    this.calloutsContainer.innerHTML = svgLines + htmlDivs;
  }

  // Update live readings card values
  updateReadingsCard() {
    const rpm = this.sim.rpm;
    const hp = this.sim.brakePowerHp;
    const kw = this.sim.brakePowerW / 1000;
    const torqueNm = this.sim.flywheelTorque;
    const fuelLh = this.sim.fuelRateLPerH;
    const airM3 = this.sim.coolingAirM3Min;
    const tempC = this.sim.headTempC;

    if (this.readSpeed) this.readSpeed.textContent = `${Math.round(rpm)} rpm`;
    if (this.readPower) this.readPower.textContent = `${hp.toFixed(1)} hp (${kw.toFixed(1)} kW)`;
    if (this.readTorque) this.readTorque.textContent = `${torqueNm.toFixed(1)} N·m`;
    if (this.readFuel) this.readFuel.textContent = `${fuelLh.toFixed(2)} l/h`;
    if (this.readAir) this.readAir.textContent = `${airM3.toFixed(1)} m³/min`;
    if (this.readTemp) this.readTemp.textContent = `${Math.round(tempC)} °C`;
  }

  // Main animation frame loop (60 fps)
  loop(timestamp) {
    requestAnimationFrame((t) => this.loop(t));

    const rawDt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    const dt = this.isSlowMotion ? rawDt * this.slowMoFactor : rawDt;

    // 1. Advance physics simulation
    this.sim.update(dt, timestamp);

    // Cranking narration cue
    if (this.sim.keyState === 'cranking' && this.sim.crankingTime > 0.45 && !this.sim.hasCaught) {
      this.setNarration('Squeezed about 17 to 1, the air gets hot enough to light the diesel. No spark plugs.');
    }

    // 2. Process simulation events & trigger synthesised Web Audio
    const events = this.sim.flushEvents();
    for (const ev of events) {
      if (ev.type === 'caught') {
        this.keyBtn.classList.remove('cranking');
        this.keyBtn.classList.add('running');
        this.keyStateLabel.textContent = 'Run';
        this.engineModel.emitSmokePuff(true, 1.2);
        this.setNarration('It caught.', true);
      } else if (ev.type === 'fire') {
        this.audio.triggerDieselKnock(ev.cylinder, ev.pressure, ev.fuelRack);
        this.instruments.onFire(ev.cylinder);
      } else if (ev.type === 'misfire') {
        this.audio.triggerStarterStrain(ev.cylinder);
        this.engineModel.emitSmokePuff(true, 0.8);
      } else if (ev.type === 'evo') {
        this.audio.triggerExhaustPop(ev.cylinder, ev.pressure, ev.rpm);
      } else if (ev.type === 'stalled') {
        this.setNarration('Engine stalled under excessive PTO dynamometer load.');
      } else if (ev.type === 'stop') {
        this.keyBtn.classList.remove('cranking', 'running');
        this.keyStateLabel.textContent = 'Stop';
      }
    }

    // Audio continuous speed/load tracking
    this.audio.updateContinuous(this.sim.rpm, this.sim.keyState, this.sim.ptoLoad);

    // Idling narration cue
    if (this.sim.hasCaught && this.sim.rpm > 650 && this.sim.rpm < 780 && this.sim.throttle < 0.1 && this.sim.ptoLoad < 0.1) {
      this.setNarration('Idling near 700 rpm: three power strokes every two turns, one every 240 degrees.');
    }

    // 3. Update procedural 3D model kinematics
    this.engineModel.update(dt, this.sim);

    // 4. Smooth camera scripting interpolation
    this.camera.position.lerp(this.camTargetPos, 0.08);
    this.camera.lookAt(this.camTargetLook);

    // 5. Render 3D engine scene
    this.renderer.render(this.scene, this.camera);

    // 6. Update exploded callouts
    this.updateCallouts();

    // 7. Update Live 2D Canvas Instruments
    this.instruments.update(dt, this.sim);
    this.instruments.drawTachometer(this.instCanvasTacho, this.sim);
    this.instruments.drawCycleWheel(this.instCanvasCycle, this.sim);
    this.instruments.drawPvDiagram(this.instCanvasPv, this.sim);
    this.instruments.drawChartRecorder(this.instCanvasChart, this.sim);

    // 8. Update Live Diazo Blueline Technical Drawings
    this.drawings.drawFrontView(this.drawCanvasFront, this.sim);
    this.drawings.drawRightSideView(this.drawCanvasRight, this.sim);
    this.drawings.drawPlanView(this.drawCanvasPlan, this.sim);
    this.drawings.drawSectionAA(this.drawCanvasSection, this.sim);

    // 9. Update Live Readings Card
    this.updateReadingsCard();
  }
}
